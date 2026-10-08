const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const writerUrl = pathToFileURL(path.join(__dirname, '../background/lot_writer.js')).href;
const availabilityUrl = pathToFileURL(path.join(__dirname, '../background/lot_availability.js')).href;

function fakeFunPay(initial, { ignoreSave = false } = {}) {
    const lots = new Map(Object.entries(initial).map(([id, form]) => [id, { ...form }]));
    const saves = [];
    let beforeRead = null;
    return {
        saves,
        lots,
        onRead(fn) { beforeRead = fn; },
        readForm: async lot => {
            if (beforeRead) beforeRead(lot);
            const form = lots.get(lot.id);
            if (!form) throw new Error('lot not found');
            return { ...form, csrf_token: 'csrf' };
        },
        saveForm: async (payload, lot) => {
            saves.push({ payload: { ...payload }, lot });
            if (ignoreSave) return;
            const next = { ...payload };
            delete next.offer_id;
            delete next.csrf_token;
            lots.set(lot.id, next);
        }
    };
}

test('patchLot saves only real changes and verifies them after a re-read', async () => {
    const { createLotWriter } = await import(writerUrl);
    const site = fakeFunPay({ '501': { price: '100', active: 'on', 'fields[summary][ru]': 'Лот' } });
    const writer = createLotWriter(site);

    const unchanged = await writer.patchLot({ offerId: '501', nodeId: '42', mutate: form => ({ ...form, price: '100.00' }) });
    assert.equal(unchanged.status, 'unchanged');
    assert.equal(site.saves.length, 0);

    const saved = await writer.patchLot({ offerId: '501', nodeId: '42', expect: { price: '100' }, mutate: form => ({ ...form, price: '120' }) });
    assert.equal(saved.status, 'saved');
    assert.deepEqual(saved.changed, ['price']);
    assert.equal(site.saves[0].payload.offer_id, '501');
    assert.equal(site.lots.get('501').price, '120');
});

test('patchLot refuses to overwrite a manual edit made after the caller looked at the lot', async () => {
    const { createLotWriter } = await import(writerUrl);
    const site = fakeFunPay({ '501': { price: '150', active: 'on' } });
    const writer = createLotWriter(site);

    const result = await writer.patchLot({ offerId: '501', nodeId: '42', expect: { price: '100' }, mutate: form => ({ ...form, price: '90' }) });
    assert.equal(result.status, 'conflict');
    assert.deepEqual(result.conflicts.map(item => item.field), ['price']);
    assert.equal(site.saves.length, 0);
});

test('setLotActive removes the active field to deactivate and reports unverified saves', async () => {
    const { createLotWriter } = await import(writerUrl);
    const site = fakeFunPay({ '501': { price: '100', active: 'on' } });
    const writer = createLotWriter(site);

    const off = await writer.setLotActive({ offerId: '501', nodeId: '42', active: false, expectActive: true });
    assert.equal(off.status, 'saved');
    assert.equal('active' in site.saves[0].payload, false, 'FunPay reads presence of active as "on"');

    const conflict = await writer.setLotActive({ offerId: '501', nodeId: '42', active: true, expectActive: true });
    assert.equal(conflict.status, 'conflict');

    const ignoring = fakeFunPay({ '502': { price: '100', active: '' } }, { ignoreSave: true });
    const result = await createLotWriter(ignoring).setLotActive({ offerId: '502', nodeId: '43', active: true });
    assert.equal(result.status, 'unverified');
    assert.deepEqual(result.notApplied, ['active']);
});

test('availability decisions never act on unknown stock and respect per-lot opt-outs', async () => {
    const { decideLotAvailability } = await import(availabilityUrl);
    const on = { restoreEnabled: true, disableEnabled: true };
    assert.equal(decideLotAvailability({ ...on, config: { productCount: null }, active: true }), null);
    assert.equal(decideLotAvailability({ ...on, config: { mode: 'template', productCount: 0 }, active: true }), null);
    assert.equal(decideLotAvailability({ ...on, config: { productCount: 0 }, active: true }), 'deactivate');
    assert.equal(decideLotAvailability({ ...on, config: { productCount: 0, autoDisableEnabled: false }, active: true }), null);
    assert.equal(decideLotAvailability({ ...on, config: { productCount: 3 }, active: false }), 'activate');
    assert.equal(decideLotAvailability({ ...on, config: { productCount: 3, autoRestoreEnabled: false }, active: false }), null);
    assert.equal(decideLotAvailability({ restoreEnabled: false, disableEnabled: true, config: { productCount: 3 }, active: false }), null);
});

test('background sweep toggles lots without an open tab and skips lots it cannot locate', async () => {
    const { createLotWriter } = await import(writerUrl);
    const { createLotAvailabilitySweep } = await import(availabilityUrl);
    const site = fakeFunPay({
        '501': { active: 'on', 'fields[summary][ru]': 'Пустой' },
        '502': { active: '' },
        '503': { active: 'on' }
    });
    const notices = [];
    const sweep = createLotAvailabilitySweep({
        getSettings: async () => ({
            fpToolsAutoRestoreEnabled: true,
            fpToolsAutoDisableEnabled: true,
            fpToolsAutoDeliveryLots: {
                '501': { productCount: 0, nodeId: '42' },
                '502': { productCount: 5 },
                '503': { productCount: null, nodeId: '44' },
                '504': { productCount: 2 }
            }
        }),
        listOwnLots: async () => [{ id: '502', nodeId: '43', title: 'Пополненный' }],
        writer: createLotWriter(site),
        notify: change => notices.push(change),
        log: { warn() {} }
    });

    const result = await sweep.sweep();
    assert.deepEqual(result.changed, [{ id: '501', decision: 'deactivate' }, { id: '502', decision: 'activate' }]);
    assert.deepEqual(result.skipped, ['504'], 'a lot without a known category is skipped');
    assert.equal(site.saves.some(save => save.lot.id === '503'), false, 'unknown stock is never touched');
    assert.deepEqual(notices.map(n => [n.offerId, n.title, n.active]), [['501', 'Пустой', false], ['502', 'Пополненный', true]]);
});
