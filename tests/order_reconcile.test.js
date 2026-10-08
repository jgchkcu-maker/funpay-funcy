const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

async function setup(pages) {
    const ops = await load('ops_db.js');
    const { createOrderReconcile } = await load('order_reconcile.js');
    const clock = { now: 10_000_000_000 };
    const journal = ops.createOpsJournal({ backend: ops.createMemoryBackend(), now: () => clock.now });
    const observed = [];
    const fetched = [];
    const reconcile = createOrderReconcile({
        journal,
        guard: { current: async () => ({ accountId: '100', epoch: 1 }) },
        fetchSalesPage: async token => { fetched.push(token || 'first'); return pages[token || 'first'] || { orders: [] }; },
        dispatcher: { observe: async input => { observed.push(input); return { status: 'done' }; } },
        now: () => clock.now,
        maxObserves: 3,
        log: { warn() {} }
    });
    return { journal, reconcile, observed, fetched, clock, pages };
}

const row = (orderId, orderDate, orderStatus = 'paid') => ({ orderId, orderDate, orderStatus, buyerUsername: 'b', description: 'd' });

test('the first pass only records a baseline and never executes old orders', async () => {
    const { journal, reconcile, observed } = await setup({ first: { orders: [row('OLDPAID1', 9_000_000_000)], nextOrderId: 'X' } });
    const result = await reconcile.run();
    assert.equal(result.seeded, 1);
    assert.equal(observed.length, 0);
    const order = await journal.getAccountOrder('100', 'OLDPAID1');
    assert.notEqual(order.adopted, true, 'seeded orders are observed, not adopted');
});

test('known unfulfilled orders are retried even when they are far beyond the first page', async () => {
    const env = await setup({ first: { orders: [] } });
    await env.reconcile.run();
    env.clock.now += 60_000;
    await env.journal.recordAccountOrder({ accountId: '100', orderId: 'DEEP0001', source: 'chat', fpStatus: 'paid', adopted: true, deliveryState: 'blocked' });
    await env.journal.recordAccountOrder({ accountId: '100', orderId: 'DONE0001', source: 'chat', fpStatus: 'paid', adopted: true, deliveryState: 'done' });
    await env.journal.recordAccountOrder({ accountId: '100', orderId: 'SEED0001', source: 'seed', fpStatus: 'paid' });
    await env.reconcile.run();
    assert.deepEqual(env.observed.map(item => item.orderId), ['DEEP0001']);
    await env.reconcile.run();
    assert.equal(env.observed.length, 1, 'a queued order waits for its next check time');
});

test('pages are followed with continue until the previous border, missed paid orders are adopted', async () => {
    const env = await setup({ first: { orders: [] } });
    await env.reconcile.run();
    env.clock.now += 3 * 60 * 60 * 1000;
    const t = env.clock.now;
    env.pages.first = { orders: [row('NEWA0001', t - 1000), row('NEWB0001', t - 2000, 'closed')], nextOrderId: 'P2' };
    env.pages.P2 = { orders: [row('NEWC0001', t - 3000)], nextOrderId: 'P3' };
    env.pages.P3 = { orders: [row('ANCIENT1', 1)], nextOrderId: 'P4' };
    env.pages.P4 = { orders: [row('NEVER001', 1)], nextOrderId: 'P5' };
    const result = await env.reconcile.run();
    assert.deepEqual(env.fetched.slice(1), ['first', 'P2', 'P3'], 'stops at the page that reaches the border');
    assert.deepEqual(env.observed.map(item => item.orderId), ['NEWA0001', 'NEWC0001']);
    assert.equal(result.found, 2);
    assert.equal((await env.journal.getAccountOrder('100', 'NEWB0001')).adopted, undefined, 'a closed order is only recorded');
});

test('a repeating continue cursor ends the pass', async () => {
    const env = await setup({ first: { orders: [] } });
    await env.reconcile.run();
    env.clock.now += 1000;
    env.pages.first = { orders: [row('LOOP0001', env.clock.now)], nextOrderId: 'SAME' };
    env.pages.SAME = { orders: [row('LOOP0002', env.clock.now)], nextOrderId: 'SAME' };
    await env.reconcile.run();
    assert.deepEqual(env.fetched.slice(1), ['first', 'SAME']);
});
