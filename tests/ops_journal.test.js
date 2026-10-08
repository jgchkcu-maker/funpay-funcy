const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const opsUrl = pathToFileURL(path.join(__dirname, '../background/ops_db.js')).href;

async function journal({ instanceId = 'sw-a', backend, clock } = {}) {
    const api = await import(opsUrl);
    const time = clock || { now: 1000 };
    const store = backend || api.createMemoryBackend();
    return { api, backend: store, clock: time, journal: api.createOpsJournal({ backend: store, instanceId, now: () => time.now }) };
}

test('recordOrder merges repeated sightings without erasing known fields or moving purchasedAt', async () => {
    const { journal: j, clock } = await journal();
    const first = await j.recordOrder({ orderId: '#abcd1234', source: 'chat', chatId: '77', buyerName: 'Buyer', purchasedAt: 1000 });
    assert.equal(first.created, true);
    assert.equal(first.order.orderId, 'ABCD1234');

    clock.now = 5000;
    const second = await j.recordOrder({ orderId: 'ABCD1234', source: 'reconcile', chatId: '', lotId: '501', purchasedAt: 4000 });
    assert.equal(second.created, false);
    assert.equal(second.order.chatId, '77', 'an empty value must not erase a known chat');
    assert.equal(second.order.lotId, '501');
    assert.equal(second.order.purchasedAt, 1000, 'the first purchase time is kept');
    assert.deepEqual(second.order.sources, ['chat', 'reconcile']);
    assert.equal(second.order.updatedAt, 5000);

    await assert.rejects(() => j.recordOrder({ orderId: 'bad', source: 'chat' }), /Некорректный номер заказа/);
});

test('beginOp is idempotent and transitions follow the state machine', async () => {
    const { journal: j } = await journal();
    const started = await j.beginOp({ key: 'delivery:ABCD1234', kind: 'delivery', orderId: 'ABCD1234', state: 'sending' });
    assert.equal(started.created, true);
    assert.equal(started.op.attempts, 1);

    const again = await j.beginOp({ key: 'delivery:ABCD1234', kind: 'delivery', orderId: 'ABCD1234', state: 'sending' });
    assert.equal(again.created, false, 'a repeated event must see the existing operation');
    assert.equal(again.op.state, 'sending');

    await j.transitionOp('delivery:ABCD1234', 'failed', { lastError: 'HTTP 400' });
    const retried = await j.transitionOp('delivery:ABCD1234', 'sending');
    assert.equal(retried.attempts, 2);
    await j.transitionOp('delivery:ABCD1234', 'done');
    await assert.rejects(() => j.transitionOp('delivery:ABCD1234', 'sending'), /запрещён/);
    assert.equal((await j.getOp('delivery:ABCD1234')).state, 'done');
});

test('concurrent beginOp calls for one key create exactly one operation', async () => {
    const { journal: j } = await journal();
    const results = await Promise.all(Array.from({ length: 5 }, () =>
        j.beginOp({ key: 'delivery:LAST0001', kind: 'delivery', state: 'sending' })));
    assert.equal(results.filter(result => result.created).length, 1);
});

test('recovery marks only sends of a previous worker as uncertain', async () => {
    const { api, backend, clock } = await journal();
    const oldWorker = api.createOpsJournal({ backend, instanceId: 'sw-old', now: () => clock.now });
    await oldWorker.beginOp({ key: 'delivery:OLD00001', kind: 'delivery', state: 'sending' });

    const current = api.createOpsJournal({ backend, instanceId: 'sw-new', now: () => clock.now });
    await current.beginOp({ key: 'delivery:NEW00001', kind: 'delivery', state: 'sending' });
    await current.beginOp({ key: 'delivery:PEND0001', kind: 'delivery' });

    const recovered = await current.recoverInterruptedOps();
    assert.deepEqual(recovered.map(op => op.key), ['delivery:OLD00001']);
    assert.equal((await current.getOp('delivery:OLD00001')).state, 'uncertain');
    assert.equal((await current.getOp('delivery:NEW00001')).state, 'sending', 'an in-flight send of this worker is untouched');
    assert.equal((await current.getOp('delivery:PEND0001')).state, 'pending');
    assert.deepEqual(await current.recoverInterruptedOps(), [], 'recovery is idempotent');
});

test('prune drops old finished records and keeps orders with live operations', async () => {
    const { journal: j, clock } = await journal();
    await j.recordOrder({ orderId: 'OLDDONE1', source: 'chat' });
    await j.recordOrder({ orderId: 'OLDLIVE1', source: 'chat' });
    await j.beginOp({ key: 'delivery:OLDDONE1', kind: 'delivery', orderId: 'OLDDONE1', state: 'sending' });
    await j.transitionOp('delivery:OLDDONE1', 'done');
    await j.beginOp({ key: 'delivery:OLDLIVE1', kind: 'delivery', orderId: 'OLDLIVE1', state: 'sending' });
    await j.transitionOp('delivery:OLDLIVE1', 'uncertain');

    clock.now = 1000 + 10_000;
    await j.recordOrder({ orderId: 'FRESH001', source: 'chat' });
    await j.prune(5_000);

    assert.equal(await j.getOrder('OLDDONE1'), null);
    assert.equal(await j.getOp('delivery:OLDDONE1'), null);
    assert.ok(await j.getOrder('OLDLIVE1'), 'an uncertain delivery keeps its order');
    assert.ok(await j.getOp('delivery:OLDLIVE1'));
    assert.ok(await j.getOrder('FRESH001'));
});

test('meta values round-trip', async () => {
    const { journal: j } = await journal();
    assert.equal(await j.getMeta('reconcileSeededAt'), undefined);
    await j.setMeta('reconcileSeededAt', 42);
    assert.equal(await j.getMeta('reconcileSeededAt'), 42);
});
