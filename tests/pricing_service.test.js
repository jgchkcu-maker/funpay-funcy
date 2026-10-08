const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

async function setup({ forms, costs }) {
    const { createLotWriter, createLotWriteQueue } = await load('lot_writer.js');
    const { createPricingService } = await load('pricing_service.js');
    const lots = new Map(Object.entries(forms).map(([id, form]) => [id, { ...form }]));
    const readForm = async lot => ({ ...lots.get(lot.id) });
    const writer = createLotWriter({ readForm, saveForm: async (payload, lot) => { const next = { ...payload }; delete next.offer_id; lots.set(lot.id, next); } });
    const data = { fpToolsCostBasis: { version: 1, offers: costs } };
    const storage = { get: async key => ({ [key]: structuredClone(data[key]) }), set: async patch => Object.assign(data, structuredClone(patch)) };
    const guard = { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => ({}) };
    const queue = createLotWriteQueue({ writer, deleteOffer: async () => {}, guard, log: { warn() {} } });
    const due = [];
    const scheduler = { scheduleDue: async (n, at) => due.push([n, at]), clearDue: async n => due.push([n, null]) };
    const service = createPricingService({ storage, guard, readForm, queue, scheduler, log: { warn() {} } });
    return { service, lots, data, due };
}

const RULE = { name: 'Наценка', mode: 'markup', value: '25', minProfit: '10', step: '1', allowRaise: true, currency: 'RUB' };

test('preview reads fresh prices and costs; apply writes only previewed rows with expect', async () => {
    const env = await setup({
        forms: { 1: { price: '100', active: 'on' }, 2: { price: '50', active: 'on' }, 3: { price: '10', active: 'on' } },
        costs: { 1: { amount: 100, currency: 'RUB' }, 2: { amount: 40, currency: 'USD' } }
    });
    const rule = await env.service.saveRule({ rule: RULE });
    const lots = ['1', '2', '3'].map(offerId => ({ offerId, nodeId: '42' }));
    const preview = await env.service.preview({ ruleId: rule.ruleId, lots });
    assert.deepEqual(preview.rows.map(row => [row.offerId, row.action, row.target ?? null]), [['1', 'raise', '125'], ['2', 'skip', null], ['3', 'skip', null]]);
    assert.equal(preview.explanation, 'Наценка 25% = маржа 20%');

    env.lots.get('1').price = '101'; // the seller edits the price after the preview
    const conflict = await env.service.apply({ previewId: preview.previewId, offerIds: ['1'] });
    assert.equal(conflict.results[0].status, 'conflict');
    assert.equal(env.lots.get('1').price, '101');
    await assert.rejects(() => env.service.apply({ previewId: preview.previewId, offerIds: ['1'] }), /устарел/);

    const fresh = await env.service.preview({ ruleId: rule.ruleId, lots });
    const applied = await env.service.apply({ previewId: fresh.previewId, offerIds: ['1', '2'] });
    assert.equal(applied.results[0].status, 'saved');
    assert.equal(env.lots.get('1').price, '125');
    assert.equal(applied.results[1].status, 'skipped');
});

test('a changed cost or rule invalidates the preview', async () => {
    const env = await setup({ forms: { 1: { price: '100', active: 'on' } }, costs: { 1: { amount: 100, currency: 'RUB' } } });
    const rule = await env.service.saveRule({ rule: RULE });
    const preview = await env.service.preview({ ruleId: rule.ruleId, lots: [{ offerId: '1', nodeId: '42' }] });
    env.data.fpToolsCostBasis.offers[1].amount = 90;
    const result = await env.service.apply({ previewId: preview.previewId, offerIds: ['1'] });
    assert.equal(result.results[0].status, 'stale');
    const again = await env.service.preview({ ruleId: rule.ruleId, lots: [{ offerId: '1', nodeId: '42' }] });
    await env.service.saveRule({ rule: { ...RULE, ruleId: rule.ruleId, value: '30' } });
    await assert.rejects(() => env.service.apply({ previewId: again.previewId, offerIds: ['1'] }), /Правило изменилось/);
});

test('auto pricing is bounded per run and pauses after a manual price edit', async () => {
    const env = await setup({ forms: { 1: { price: '100', active: 'on' } }, costs: { 1: { amount: 100, currency: 'RUB' } } });
    const rule = await env.service.saveRule({ rule: { ...RULE, value: '50', maxStepPercent: '10' } });
    await env.service.bindLots({ ruleId: rule.ruleId, lots: [{ offerId: '1', nodeId: '42' }] });
    let run = await env.service.runAuto();
    assert.equal(run.results.length, 0, 'auto is off until explicitly enabled');
    await env.service.setAuto({ ruleId: rule.ruleId, auto: true });
    run = await env.service.runAuto();
    assert.equal(env.lots.get('1').price, '110', 'one run moves the price by at most 10%');
    run = await env.service.runAuto();
    assert.equal(env.lots.get('1').price, '121');
    env.lots.get('1').price = '200';
    run = await env.service.runAuto();
    assert.equal(run.results[0].status, 'paused');
    assert.equal(env.lots.get('1').price, '200', 'a manual edit is not overwritten');
    assert.equal(env.due.at(-1)[0], 'fpToolsPricingAuto');
});
