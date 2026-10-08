const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

function fakeSite(initial) {
    const forms = new Map(Object.entries(initial).map(([id, form]) => [id, { ...form }]));
    const log = [];
    return {
        forms, log,
        readForm: async lot => {
            log.push(['read', lot.id]);
            await new Promise(resolve => setTimeout(resolve, 1));
            const form = forms.get(lot.id);
            return form ? { ...form } : null;
        },
        saveForm: async (payload, lot) => {
            log.push(['save', lot.id, payload.price, payload.active || '']);
            forms.set(lot.id, { ...payload });
        },
        deleteOffer: async id => { log.push(['delete', id]); forms.delete(id); }
    };
}

async function setup(initial, account = { accountId: '100', epoch: 1 }) {
    const { createLotWriter, createLotWriteQueue } = await load('lot_writer.js');
    const site = fakeSite(initial);
    const state = { account: { ...account } };
    const guard = {
        current: async () => state.account,
        assertCurrent: async expected => {
            if (expected.accountId !== state.account.accountId || expected.epoch !== state.account.epoch) throw new Error('Аккаунт FunPay сменился');
            return state.account;
        }
    };
    const data = {};
    const storage = { get: async key => ({ [key]: data[key] }), set: async patch => Object.assign(data, patch) };
    const queue = createLotWriteQueue({ writer: createLotWriter(site), deleteOffer: site.deleteOffer, guard, storage, log: { warn() {} } });
    return { site, queue, state, data };
}

test('tiny prices are compared exactly', async () => {
    const { lotFieldsEqual, changedLotFields } = await load('lot_writer.js');
    assert.equal(lotFieldsEqual('price', '0.003', '0.004'), false);
    assert.equal(lotFieldsEqual('price', '120', '120.00'), true);
    assert.equal(lotFieldsEqual('price', '1,5', '1.50'), true);
    assert.deepEqual(changedLotFields({ price: '0.003' }, { price: '0.004' }), ['price']);
});

test('price rules are computed exactly from the fresh form', async () => {
    const { computeAdjustedPrice } = await load('lot_writer.js');
    assert.equal(computeAdjustedPrice('100', { mode: 'add', value: '0.1' }), '100.1');
    assert.equal(computeAdjustedPrice('100', { mode: 'percent_up', value: '10' }), '110');
    assert.equal(computeAdjustedPrice('99.99', { mode: 'percent_down', value: '15' }), '84.99');
    assert.equal(computeAdjustedPrice('10.2', { mode: 'add', value: '0', round: true }), '11');
    assert.equal(computeAdjustedPrice('10', { mode: 'sub', value: '20' }), null, 'a non-positive price is refused');
    assert.equal(computeAdjustedPrice('10', { mode: 'add', value: '100', max: '50' }), '50');
});

test('queued operations on one lot run in order against a fresh form', async () => {
    const { site, queue } = await setup({ 7: { price: '100', active: 'on', 'fields[summary][ru]': 'A' } });
    const results = await Promise.all([
        queue.enqueue({ offerId: '7', nodeId: '42', op: { type: 'setActive', active: false } }),
        queue.enqueue({ offerId: '7', nodeId: '42', op: { type: 'adjustPrice', mode: 'add', value: '5' } })
    ]);
    assert.deepEqual(results.map(r => r.status), ['saved', 'saved']);
    const form = site.forms.get('7');
    assert.equal(form.price, '105');
    assert.equal(form.active, undefined, 'the price change does not resurrect the stale active flag');
    const reads = site.log.filter(entry => entry[0] === 'read').length;
    assert.equal(reads, 4, 'each operation reads the form itself and re-reads after saving');
});

test('a stale bulk form cannot reopen a closed lot: only the intended fields are applied', async () => {
    const { site, queue } = await setup({ 8: { price: '10', active: 'on', 'fields[desc][ru]': 'old' } });
    await queue.enqueue({ offerId: '8', nodeId: '42', op: { type: 'setActive', active: false } });
    const result = await queue.enqueue({ offerId: '8', nodeId: '42', op: { type: 'setFields', fields: { 'fields[desc][ru]': 'new' }, expect: { 'fields[desc][ru]': 'old' } } });
    assert.equal(result.status, 'saved');
    assert.equal(site.forms.get('8')['fields[desc][ru]'], 'new');
    assert.equal(site.forms.get('8').active, undefined);
    const conflict = await queue.enqueue({ offerId: '8', nodeId: '42', op: { type: 'setFields', fields: { price: '20' }, expect: { price: '11' } } });
    assert.equal(conflict.status, 'conflict', 'a manual edit made meanwhile is not overwritten');
});

test('a deleted lot is terminal for later queued updates', async () => {
    const { site, queue, data } = await setup({ 9: { price: '10', active: 'on' } });
    const [update1, removal, update2] = await Promise.all([
        queue.enqueue({ offerId: '9', nodeId: '42', op: { type: 'setPrice', price: '11' } }),
        queue.enqueue({ offerId: '9', nodeId: '42', op: { type: 'delete' } }),
        queue.enqueue({ offerId: '9', nodeId: '42', op: { type: 'setActive', active: true } })
    ]);
    assert.equal(update1.status, 'saved');
    assert.equal(removal.status, 'deleted-now');
    assert.equal(update2.status, 'deleted');
    assert.equal(site.log.filter(entry => entry[0] === 'save').length, 1);
    assert.ok(data.fpToolsDeletedOffers['100:9'], 'the terminal mark survives a restart');
});

test('an account switch stops queued writes; a foreign page is refused', async () => {
    const { site, queue, state } = await setup({ 5: { price: '10', active: 'on' } });
    await assert.rejects(() => queue.enqueue({ offerId: '5', nodeId: '42', op: { type: 'setPrice', price: '12' }, expectedAccountId: '200' }), /другим аккаунтом/);
    const pending = queue.enqueue({ offerId: '5', nodeId: '42', op: { type: 'setPrice', price: '12' } });
    state.account = { accountId: '100', epoch: 2 };
    await assert.rejects(pending, /сменился/);
    assert.equal(site.forms.get('5').price, '10');
    await assert.rejects(() => queue.enqueue({ offerId: '0', nodeId: '42', op: { type: 'setPrice', price: '1' } }), /существующие/);
});
