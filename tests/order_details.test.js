const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const detailsUrl = pathToFileURL(path.join(__dirname, '../background/order_details.js')).href;
const schedulerUrl = pathToFileURL(path.join(__dirname, '../background/job_scheduler.js')).href;

test('lot is resolved from the offer link first, then from a unique title in the same category', async () => {
    const { resolveOrderLotId } = await import(detailsUrl);
    const lots = [
        { id: '501', nodeId: '42', title: 'Steam ключ  Elden Ring' },
        { id: '502', nodeId: '43', title: 'Steam ключ Elden Ring' },
        { id: '503', nodeId: '42', title: 'Дубль' },
        { id: '504', nodeId: '42', title: 'дубль' }
    ];
    assert.deepEqual(resolveOrderLotId({ lotId: '777', lotName: 'x' }, lots), { lotId: '777', source: 'link' });
    assert.deepEqual(resolveOrderLotId({ lotName: 'steam ключ elden ring', nodeId: '42' }, lots), { lotId: '501', source: 'title' });
    assert.deepEqual(resolveOrderLotId({ lotName: 'Steam ключ Elden Ring' }, lots), { lotId: null, source: 'ambiguous' },
        'the same title in two categories must not guess');
    assert.deepEqual(resolveOrderLotId({ lotName: 'Дубль', nodeId: '42' }, lots), { lotId: null, source: 'ambiguous' });
    assert.deepEqual(resolveOrderLotId({ lotName: 'Нет такого' }, lots), { lotId: null, source: null });
    assert.deepEqual(resolveOrderLotId({ lotId: '12345678' /* chat id would look like this */, lotName: '' }, []).source, 'link');
});

test('order loader reads each order once per account window and never invents quantity or binding', async () => {
    const { createOrderDetailsLoader } = await import(detailsUrl);
    const clock = { now: 0 };
    const calls = { order: 0, lots: 0 };
    const page = (orderId, extra) => ({ recognized: true, pageOrderId: orderId, sellerId: '100', currentUserId: '100', statusText: 'Оплачен', ...extra });
    const loader = createOrderDetailsLoader({
        now: () => clock.now,
        fetchOrderFacts: async orderId => {
            calls.order += 1;
            return orderId === 'LINKED01'
                ? page(orderId, { lotId: '501', nodeId: '42', quantityText: '3 шт.' })
                : page(orderId, { lotId: null, nodeId: '42', lotName: 'Лот', quantityText: '' });
        },
        listOwnLots: async () => { calls.lots += 1; return [{ id: '600', nodeId: '42', title: 'Лот' }]; }
    });

    const scope = { accountId: '100', epoch: 1 };
    const [a, b] = await Promise.all([loader.load('LINKED01', scope), loader.load('linked01', scope)]);
    assert.equal(a, b);
    assert.equal(calls.order, 1);
    assert.equal(calls.lots, 0, 'a linked lot needs no profile request');
    assert.equal(a.quantity.value, 3);
    assert.equal(a.lotId, '501');

    const titled = await loader.load('TITLED01', scope);
    assert.equal(titled.lotId, null, 'a matching title is not a binding');
    assert.deepEqual(titled.lotCandidate, { offerId: '600', source: 'title' });
    assert.equal(titled.quantity.kind, 'unknown', 'missing quantity stays unknown');

    await loader.load('LINKED01', { accountId: '200', epoch: 1 });
    assert.equal(calls.order, 3, 'another account never reuses the cache');
    await loader.load('LINKED01', { ...scope, fresh: true });
    assert.equal(calls.order, 4, 'fresh reads bypass the cache');
    clock.now = 61_000;
    await loader.load('LINKED01', scope);
    assert.equal(calls.order, 5, 'the cache expires');
});

test('scheduler dispatches only its own alarms, keeps a running periodic alarm, and serializes recovery', async () => {
    const { createJobScheduler } = await import(schedulerUrl);
    const created = [];
    const existing = new Map();
    const alarms = {
        create(name, info) { created.push([name, info]); existing.set(name, { name, ...info }); },
        clear(name) { existing.delete(name); return Promise.resolve(true); },
        async get(name) { return existing.get(name); }
    };
    const clock = { now: 100_000 };
    const scheduler = createJobScheduler({ alarms, now: () => clock.now, log: { error() {} } });
    const handled = [];
    scheduler.register('job', alarm => handled.push(alarm.name));
    scheduler.register('broken', () => { throw new Error('boom'); });

    assert.equal(await scheduler.handleAlarm({ name: 'job' }), true);
    assert.equal(await scheduler.handleAlarm({ name: 'broken' }), true, 'a failing job is still consumed');
    assert.equal(await scheduler.handleAlarm({ name: 'foreign' }), false);
    assert.deepEqual(handled, ['job']);

    assert.equal(await scheduler.ensurePeriodic('job', 5, { delayInMinutes: 1 }), true);
    assert.equal(await scheduler.ensurePeriodic('job', 5, { delayInMinutes: 1 }), false, 'a running alarm is not reset');
    assert.equal(created.length, 1);

    let runs = 0;
    scheduler.registerRecovery('ops', async () => { runs += 1; return runs; });
    scheduler.registerRecovery('bad', async () => { throw new Error('nope'); });
    const [first, second] = await Promise.all([scheduler.runRecovery(), scheduler.runRecovery()]);
    assert.equal(first, second, 'parallel callers share one pass');
    assert.deepEqual(first.map(r => [r.name, r.ok]), [['ops', true], ['bad', false]]);
    assert.deepEqual(await scheduler.runRecovery(), [], 'heartbeat recovery is throttled');
    clock.now += 31_000;
    await scheduler.runRecovery();
    assert.equal(runs, 2);
});

test('persisted deadlines survive a worker restart and run once when overdue', async () => {
    const { createJobScheduler } = await import(schedulerUrl);
    const data = {};
    const storage = { get: async key => ({ [key]: data[key] }), set: async patch => Object.assign(data, structuredClone(patch)) };
    const existing = new Map();
    const alarms = {
        create(name, info) { existing.set(name, { name, scheduledTime: info.when }); return Promise.resolve(); },
        clear(name) { existing.delete(name); return Promise.resolve(true); },
        async get(name) { return existing.get(name); }
    };
    const clock = { now: 1_000_000 };
    const first = createJobScheduler({ alarms, storage, now: () => clock.now, log: { error() {} } });
    first.register('schedules', () => {});
    first.register('reminders', () => {});
    await first.scheduleDue('schedules', clock.now + 60_000);
    await first.scheduleDue('reminders', clock.now + 600_000);
    await assert.rejects(() => first.scheduleDue('unknown', 1), /не зарегистрировано/);

    // The worker dies, Chrome loses the alarms, the computer sleeps for a while.
    existing.clear();
    clock.now += 120_000;
    const runs = [];
    const second = createJobScheduler({ alarms, storage, now: () => clock.now, log: { error() {} } });
    second.register('schedules', alarm => runs.push([alarm.name, alarm.recovered]));
    second.register('reminders', alarm => runs.push([alarm.name, alarm.recovered]));
    await second.recoverDeadlines();
    assert.deepEqual(runs, [['schedules', true]], 'only the overdue job runs, once');
    assert.ok(existing.has('reminders'), 'the future alarm is recreated');
    assert.equal((await second.getDeadlines()).schedules, undefined);
    await second.recoverDeadlines();
    assert.equal(runs.length, 1, 'recovery does not replay');
    await second.clearDue('reminders');
    assert.deepEqual(await second.getDeadlines(), {});
});
