const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

async function journal(clock = { now: 1000 }, instanceId = 'sw-a', backend = null) {
    const api = await load('ops_db.js');
    const store = backend || api.createMemoryBackend();
    return { api, backend: store, clock, j: api.createOpsJournal({ backend: store, instanceId, now: () => clock.now }) };
}

test('account orders are keyed by account and order and carry a revision', async () => {
    const { api, j } = await journal();
    const a = await j.recordAccountOrder({ accountId: '100', orderId: 'abcd1234', source: 'chat', chatId: '1' });
    const b = await j.recordAccountOrder({ accountId: '200', orderId: 'ABCD1234', source: 'chat', chatId: '2' });
    assert.equal(a.order.key, '100:ABCD1234');
    assert.equal(b.order.key, '200:ABCD1234', 'the same order number on another account is a separate record');
    assert.equal(a.order.deliveryState, 'none');
    const again = await j.recordAccountOrder({ accountId: '100', orderId: 'ABCD1234', source: 'reconcile', chatId: '', fpStatus: 'paid' });
    assert.equal(again.created, false);
    assert.equal(again.order.chatId, '1');
    assert.equal(again.order.revision, 2);
    await assert.rejects(() => j.updateAccountOrder('100:ABCD1234', () => ({ problemState: 'open' }), { expectedRevision: 1 }), api.RevisionConflictError);
    const updated = await j.updateAccountOrder('100:ABCD1234', () => ({ problemState: 'open' }), { expectedRevision: 2 });
    assert.equal(updated.revision, 3);
    assert.equal((await j.listAccountOrders({ accountId: '100' })).length, 1);
    assert.throws(() => api.orderKeyOf('', 'ABCD1234'), /аккаунт/);
});

test('an attempt and its event are written once per opKey', async () => {
    const { j } = await journal();
    const first = await j.beginAttempt({ opKey: 'delivery:100:ABCD1234:1', kind: 'delivery', orderKey: '100:ABCD1234' });
    assert.equal(first.created, true);
    const repeat = await j.beginAttempt({ opKey: 'delivery:100:ABCD1234:1', kind: 'delivery', orderKey: '100:ABCD1234' });
    assert.equal(repeat.created, false, 'a repeated claim sees the same attempt');
    assert.equal((await j.listEvents('100:ABCD1234')).filter(event => event.type === 'delivery.attempt').length, 1);
});

test('prune keeps unfinished attempts and their orders', async () => {
    const clock = { now: 1000 };
    const { j } = await journal(clock);
    await j.recordAccountOrder({ accountId: '100', orderId: 'OLDP0001', source: 'chat', deliveryState: 'done' });
    await j.beginAttempt({ opKey: 'delivery:100:OLDP0001:1', kind: 'delivery', orderKey: '100:OLDP0001', state: 'sending' });
    await j.recordAccountOrder({ accountId: '100', orderId: 'OLDD0001', source: 'chat', deliveryState: 'done' });
    clock.now = 1000 + 10_000;
    await j.prune(5_000);
    assert.ok(await j.getOp('delivery:100:OLDP0001:1'));
    assert.ok(await j.getAccountOrder('100', 'OLDP0001'), 'an order with a live attempt stays');
    assert.equal(await j.getAccountOrder('100', 'OLDD0001'), null, 'a delivered old order is pruned');
});

test('recovery marks interrupted delivery parts uncertain', async () => {
    const clock = { now: 1000 };
    const { api, backend } = await journal(clock);
    const old = api.createOpsJournal({ backend, instanceId: 'old', now: () => clock.now });
    await old.putParts([{ partId: 'op#0', opKey: 'op', index: 0, state: 'pending' }, { partId: 'op#1', opKey: 'op', index: 1, state: 'pending' }]);
    await old.updatePart('op#0', { state: 'sending' });
    await old.updatePart('op#1', { state: 'confirmed' });
    const fresh = api.createOpsJournal({ backend, instanceId: 'new', now: () => clock.now });
    await fresh.recoverInterruptedOps();
    const parts = await fresh.listParts('op');
    assert.deepEqual(parts.map(part => part.state), ['uncertain', 'confirmed']);
});
