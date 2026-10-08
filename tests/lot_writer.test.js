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

const policyUrl = pathToFileURL(path.join(__dirname, '../background/lot_policy.js')).href;

async function activityEnv(forms) {
    const { createLotWriter, createLotWriteQueue } = await import(writerUrl);
    const { createLotActivityService } = await import(availabilityUrl);
    const { createLotPolicyStore } = await import(policyUrl);
    const site = fakeFunPay(forms);
    const data = {};
    const storage = {
        get: async keys => Object.fromEntries([].concat(keys).map(key => [key, structuredClone(data[key])])),
        set: async patch => Object.assign(data, structuredClone(patch))
    };
    const guard = { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => ({}) };
    const queue = createLotWriteQueue({ writer: createLotWriter(site), deleteOffer: async () => {}, guard, log: { warn() {} } });
    const policies = createLotPolicyStore({ storage });
    const activity = createLotActivityService({ queue, policies });
    return { site, data, storage, policies, activity };
}

test('activity service leaves unmanaged lots alone and never reads or acts on stock', async () => {
    const env = await activityEnv({ '501': { active: 'on', secrets: '' }, '502': { active: '', secrets: 'a\nb' } });
    assert.equal((await env.activity.apply({ accountId: '100', offerId: '501', nodeId: '42' })).status, 'not-managed');
    // A managed lot with no blocker is not switched by its stock, in either direction.
    for (const id of ['501', '502']) await env.policies.update('100', id, policy => ({ ...policy, manageActive: true }), { nodeId: '42' });
    await env.activity.apply({ accountId: '100', offerId: '501', nodeId: '42' });
    await env.activity.apply({ accountId: '100', offerId: '502', nodeId: '42' });
    assert.equal(env.site.saves.length, 0);
    assert.equal((await env.policies.get('100', '502')).inactiveEvidence, 'unknown', 'a lot that was off is not ours to switch on');
});

test('a manual change by the seller pauses management; manual off is never overridden', async () => {
    const env = await activityEnv({ '601': { active: 'on', secrets: 'k' } });
    await env.policies.update('100', '601', policy => ({ ...policy, manageActive: true }), { nodeId: '42' });
    await env.policies.setBlocker('100', '601', 'schedule', true, { reason: 'Вне окна' });
    assert.equal((await env.activity.apply({ accountId: '100', offerId: '601', nodeId: '42' })).decision, 'deactivate');
    assert.equal(env.site.lots.get('601').active, undefined);
    // The seller switches the lot back on by hand while the blocker is still there.
    env.site.lots.get('601').active = 'on';
    await env.activity.apply({ accountId: '100', offerId: '601', nodeId: '42' });
    assert.equal(env.site.lots.get('601').active, 'on', 'a manual activation is not fought');
    assert.equal((await env.policies.get('100', '601')).paused.reason, 'external-change');

    const env2 = await activityEnv({ '602': { active: '', secrets: 'x' } });
    await env2.policies.update('100', '602', policy => ({ ...policy, manageActive: true, manualIntent: 'off', adoptInactive: true }), { nodeId: '42' });
    await env2.activity.apply({ accountId: '100', offerId: '602', nodeId: '42' });
    assert.equal(env2.site.saves.length, 0, '«Не включать автоматически» wins');
});

test('traces of the retired stock sweep neither hold a lot off nor let automation switch it on', async () => {
    const { withoutRetiredStockState, releaseStockManagedLots, STOCK_MANAGEMENT_RELEASED_KEY, LOT_POLICIES_KEY } = await import(policyUrl);
    const legacy = { manageActive: true, blockers: { stock: { reason: 'Склад пуст' }, schedule: { reason: 'x' } }, disabledBy: ['stock'], inactiveEvidence: null };
    const cleaned = withoutRetiredStockState(legacy);
    assert.deepEqual(Object.keys(cleaned.blockers), ['schedule']);
    assert.deepEqual(cleaned.disabledBy, []);
    assert.equal(cleaned.inactiveEvidence, 'unknown', 'a lot the sweep switched off is not ours to switch on any more');
    assert.equal(withoutRetiredStockState({ ...legacy, blockers: {}, disabledBy: [], inactiveEvidence: 'stock-empty' }).inactiveEvidence, 'unknown');
    const mixed = withoutRetiredStockState({ ...legacy, disabledBy: ['stock', 'schedule'] });
    assert.deepEqual(mixed.disabledBy, ['schedule']);
    assert.equal(mixed.inactiveEvidence, null);

    const env = await activityEnv({ '701': { active: 'on' } });
    const base = { revision: 1, nodeId: '42', blockers: {}, disabledBy: [], manualIntent: 'auto', adoptInactive: false };
    env.data[LOT_POLICIES_KEY] = {
        '100:1': { ...base, accountId: '100', offerId: '1', manageActive: true },
        '100:2': { ...base, accountId: '100', offerId: '2', manageActive: true },
        '100:3': { ...base, accountId: '100', offerId: '3', manageActive: true, manualIntent: 'off' },
        '100:4': { ...base, accountId: '100', offerId: '4', manageActive: false }
    };
    env.data.fpToolsLotSchedules = { bindings: { '100:2': { ruleId: 'r1' }, '100:9': { ruleId: null } } };
    env.data.fpToolsPricing = { bindings: {} };
    const released = await releaseStockManagedLots({ storage: env.storage, policies: env.policies, bindingKeys: ['fpToolsLotSchedules', 'fpToolsPricing'] });
    assert.equal(released, 2, 'lots nothing else manages are released, manual commands included');
    const managed = Object.fromEntries((await env.policies.list('100')).map(policy => [policy.offerId, [policy.manageActive, policy.manualIntent]]));
    assert.deepEqual(managed, { 1: [false, 'auto'], 2: [true, 'auto'], 3: [false, 'auto'], 4: [false, 'auto'] });
    assert.equal(env.data[STOCK_MANAGEMENT_RELEASED_KEY], true);
    assert.equal(await releaseStockManagedLots({ storage: env.storage, policies: env.policies, bindingKeys: [] }), 0, 'the release runs once');
});
