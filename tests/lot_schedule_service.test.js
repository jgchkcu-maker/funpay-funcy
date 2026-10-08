const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

async function setup(forms) {
    const { createLotWriter, createLotWriteQueue } = await load('lot_writer.js');
    const { createLotActivityService } = await load('lot_availability.js');
    const { createLotPolicyStore } = await load('lot_policy.js');
    const { createLotScheduleService } = await load('lot_schedule_service.js');
    const lots = new Map(Object.entries(forms).map(([id, form]) => [id, { ...form }]));
    const saves = [];
    const writer = createLotWriter({
        readForm: async lot => ({ ...lots.get(lot.id) }),
        saveForm: async (payload, lot) => { saves.push([lot.id, payload.active || '']); const next = { ...payload }; delete next.offer_id; lots.set(lot.id, next); }
    });
    const data = {};
    const storage = { get: async key => ({ [key]: structuredClone(data[key]) }), set: async patch => Object.assign(data, structuredClone(patch)) };
    const guard = { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => ({}) };
    const queue = createLotWriteQueue({ writer, deleteOffer: async () => {}, guard, log: { warn() {} } });
    const policies = createLotPolicyStore({ storage });
    const activity = createLotActivityService({ queue, policies });
    const due = [];
    const scheduler = { scheduleDue: async (name, at) => due.push([name, at]), clearDue: async name => due.push([name, null]) };
    const clock = { now: Date.UTC(2026, 9, 9, 12, 0) }; // Friday 12:00 UTC
    const service = createLotScheduleService({ storage, guard, policies, activity, scheduler, now: () => clock.now, log: { warn() {} } });
    return { service, lots, saves, policies, due, clock, data };
}

const RULE = { name: 'Вечер', timezone: 'UTC', windows: [{ day: 'fri', start: '18:00', end: '02:00' }] };

test('a saved rule is a draft; enabling it closes the lot and schedules one alarm', async () => {
    const env = await setup({ 1: { active: 'on', price: '10' } });
    const rule = await env.service.saveRule({ rule: RULE });
    assert.equal(rule.enabled, false);
    await env.service.bindLots({ ruleId: rule.ruleId, lots: [{ offerId: '1', nodeId: '42', title: 'Лот' }] });
    assert.equal(env.saves.length, 0, 'a draft rule changes nothing');

    const preview = await env.service.preview({ ruleId: rule.ruleId });
    assert.equal(preview.openNow, false);
    assert.equal(preview.transitions[0].local, '2026-10-09 18:00');

    await env.service.setRuleEnabled({ ruleId: rule.ruleId, enabled: true, expectedRevision: rule.revision });
    assert.deepEqual(env.saves, [['1', '']]);
    assert.deepEqual(env.due.at(-1), ['fpToolsLotSchedules', Date.UTC(2026, 9, 9, 18, 0)]);
    assert.equal(env.data.fpToolsLotSchedulesEnabled, true);

    env.clock.now = Date.UTC(2026, 9, 9, 18, 5);
    await env.service.evaluate();
    assert.deepEqual(env.saves.at(-1), ['1', 'on'], 'the window opens the lot we closed');
    env.clock.now = Date.UTC(2026, 9, 9, 18, 6);
    await env.service.evaluate();
    assert.equal(env.saves.length, 2, 'no repeated writes inside the window');
});

test('after a long sleep only the current state is applied, once', async () => {
    const env = await setup({ 1: { active: 'on', price: '10' } });
    const rule = await env.service.saveRule({ rule: RULE });
    await env.service.bindLots({ ruleId: rule.ruleId, lots: [{ offerId: '1', nodeId: '42' }] });
    await env.service.setRuleEnabled({ ruleId: rule.ruleId, enabled: true });
    env.clock.now += 7 * 24 * 3600 * 1000 + 3 * 3600 * 1000; // a week later, Friday 15:00 — closed
    await env.service.evaluate();
    assert.deepEqual(env.saves, [['1', '']], 'missed openings and closings are not replayed');
});

test('a lot that was already off is not switched on by the schedule; disabling a rule lifts only its blocker', async () => {
    const env = await setup({ 2: { active: '', price: '10' } });
    const rule = await env.service.saveRule({ rule: { ...RULE, windows: [{ day: 'fri', start: '00:00', end: '24:00' }] } });
    await env.service.bindLots({ ruleId: rule.ruleId, lots: [{ offerId: '2', nodeId: '42' }] });
    await env.service.setRuleEnabled({ ruleId: rule.ruleId, enabled: true });
    assert.equal(env.saves.length, 0, 'an already inactive lot is not owned by the schedule');

    const env2 = await setup({ 3: { active: 'on', price: '10' } });
    const evening = await env2.service.saveRule({ rule: RULE });
    await env2.service.bindLots({ ruleId: evening.ruleId, lots: [{ offerId: '3', nodeId: '42' }] });
    await env2.service.setRuleEnabled({ ruleId: evening.ruleId, enabled: true });
    await env2.policies.setBlocker('100', '3', 'price', true, { reason: 'Нет безопасной цены' });
    await env2.service.setRuleEnabled({ ruleId: evening.ruleId, enabled: false });
    assert.equal(env2.lots.get('3').active, undefined, 'another module still blocks the lot');
    assert.equal((await env2.policies.get('100', '3')).blockers.schedule, undefined);
    assert.deepEqual(env2.due.at(-1), ['fpToolsLotSchedules', null]);
});

test('invalid rules and foreign revisions are refused', async () => {
    const env = await setup({});
    await assert.rejects(() => env.service.saveRule({ rule: { ...RULE, timezone: 'Nowhere/Zone' } }), /часовой пояс/);
    const rule = await env.service.saveRule({ rule: RULE });
    await assert.rejects(() => env.service.saveRule({ rule: { ...RULE, ruleId: rule.ruleId }, expectedRevision: 99 }), /изменилось/);
});
