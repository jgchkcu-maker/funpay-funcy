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

test('order loader reads each order once per window and only lists lots when the link is missing', async () => {
    const { createOrderDetailsLoader } = await import(detailsUrl);
    const clock = { now: 0 };
    const calls = { order: 0, lots: 0 };
    const loader = createOrderDetailsLoader({
        now: () => clock.now,
        fetchOrderInfo: async orderId => {
            calls.order += 1;
            return orderId === 'LINKED01'
                ? { lotId: '501', nodeId: '42', amount: 3 }
                : { lotId: null, nodeId: '42', lotName: 'Лот', amount: null };
        },
        listOwnLots: async () => { calls.lots += 1; return [{ id: '600', nodeId: '42', title: 'Лот' }]; }
    });

    const [a, b] = await Promise.all([loader.load('LINKED01'), loader.load('linked01')]);
    assert.equal(a, b);
    assert.equal(calls.order, 1);
    assert.equal(calls.lots, 0, 'a linked lot needs no profile request');
    assert.equal(a.amount, 3);

    const titled = await loader.load('TITLED01');
    assert.equal(titled.lotId, '600');
    assert.equal(titled.lotIdSource, 'title');
    assert.equal(titled.amount, 1, 'missing quantity defaults to one');

    clock.now = 61_000;
    await loader.load('LINKED01');
    assert.equal(calls.order, 3, 'the cache expires');
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
