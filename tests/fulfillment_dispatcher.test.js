const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

const PAGE = {
    recognized: true, pageOrderId: 'ABCD1234', currentUserId: '100', sellerId: '100', buyerId: '555',
    buyerUsername: 'Buyer', buyerChatId: '777', statusText: 'Оплачен', quantityText: '2 шт.',
    lotId: '987', nodeId: '42', lotName: 'Ключ', secrets: ['K1', 'K2']
};

async function setup({ page = PAGE, sends = [], settings = {}, config = { 987: { enabled: true, mode: 'secrets' } }, account = { accountId: '100', epoch: 1 }, backend = null, instanceId = 'w1', savedClock = null } = {}) {
    const ops = await load('ops_db.js');
    const facts = await load('order_facts.js');
    const { createFulfillmentDispatcher } = await load('fulfillment_dispatcher.js');
    const clock = savedClock || { now: 1000 };
    backend ||= ops.createMemoryBackend();
    const journal = ops.createOpsJournal({ backend, now: () => clock.now, instanceId });
    const state = { page: { ...page }, account: { ...account }, sent: [], loads: 0, settings: { autoDeliveryEnabled: true, ...settings }, config };
    const outcomes = [...sends];
    const guard = {
        current: async () => state.account,
        assertCurrent: async expected => {
            if (expected.accountId !== state.account.accountId || expected.epoch !== state.account.epoch) throw new Error('Аккаунт сменился');
            return state.account;
        }
    };
    const dispatcher = createFulfillmentDispatcher({
        journal, guard,
        loadFacts: async orderId => { state.loads += 1; return { ...facts.normalizeOrderFacts(state.page, { requestedOrderId: orderId, observedAt: clock.now }), lotCandidate: null }; },
        sender: { send: async ({ chatId, text }) => { state.sent.push({ chatId, text }); return outcomes.shift() || { status: 'confirmed', messageId: String(state.sent.length) }; } },
        getAuth: async () => ({ csrf_token: 'x' }),
        getAutoReplies: async () => state.settings,
        getDeliveryConfigs: async () => state.config,
        render: (text, vars) => text.replace('{orderid}', vars.orderId).replace('{quantity}', vars.quantity),
        sleep: async () => {},
        hash: async text => `h${text.length}`,
        now: () => clock.now,
        log: { error() {}, warn() {} }
    });
    return { journal, dispatcher, state, clock, backend };
}

test('chat and reconcile share one delivery; a repeat sends nothing', async () => {
    const { journal, dispatcher, state } = await setup();
    const [a, b] = await Promise.all([
        dispatcher.observe({ orderId: 'ABCD1234', source: 'chat', eventChatId: '777' }),
        dispatcher.observe({ orderId: 'abcd1234', source: 'reconcile', adopt: true })
    ]);
    assert.equal(a, b, 'concurrent observers share one run');
    assert.equal(a.status, 'done');
    assert.deepEqual(state.sent, [{ chatId: '777', text: 'K1\nK2' }]);
    const again = await dispatcher.observe({ orderId: 'ABCD1234', source: 'chat' });
    assert.equal(again.status, 'already');
    assert.equal(state.sent.length, 1);
    const order = await journal.getAccountOrder('100', 'ABCD1234');
    assert.equal(order.deliveryState, 'done');
    assert.equal(order.fulfillmentSource, 'funpay_secrets');
    assert.ok(order.verifiedFulfillmentCompletedAt, 'confirmed parts with full coverage are verified fulfillment');
});

test('unknown quantity, refund, foreign chat or missing binding block delivery', async () => {
    for (const [patch, reason, extra] of [
        [{ quantityText: '1,5' }, 'quantity-unknown'],
        [{ statusText: 'Возврат' }, 'status-refunded'],
        [{ lotId: null }, 'binding-missing'],
        [{}, 'chat-mismatch', { eventChatId: '1' }]
    ]) {
        const { dispatcher, state } = await setup({ page: { ...PAGE, ...patch } });
        const result = await dispatcher.observe({ orderId: 'ABCD1234', source: 'chat', ...(extra || {}) });
        assert.equal(result.status, 'blocked', reason);
        assert.ok(result.reasons.includes(reason), `${reason}: ${result.reasons}`);
        assert.equal(state.sent.length, 0);
    }
});

test('a purchase of my own and an unknown role are skipped without effects', async () => {
    const own = await setup({ page: { ...PAGE, sellerId: '900', buyerId: '100' } });
    assert.equal((await own.dispatcher.observe({ orderId: 'ABCD1234' })).status, 'skipped');
    const unknown = await setup({ page: { ...PAGE, sellerId: null } });
    const result = await unknown.dispatcher.observe({ orderId: 'ABCD1234' });
    assert.equal(result.status, 'skipped');
    assert.ok(result.reasons.includes('role-unknown'));
    assert.equal(unknown.state.sent.length, 0);
});

test('an uncertain part stops the delivery and is never repeated automatically', async () => {
    const { journal, dispatcher, state } = await setup({
        config: { 987: { enabled: true, mode: 'template', text: 'Заказ {orderid}$sleep=1Второе' } },
        sends: [{ status: 'confirmed', messageId: '1' }, { status: 'uncertain', error: 'timeout' }]
    });
    const result = await dispatcher.observe({ orderId: 'ABCD1234', source: 'chat' });
    assert.equal(result.status, 'uncertain');
    assert.deepEqual(state.sent.map(item => item.text), ['Заказ ABCD1234', 'Второе']);
    assert.equal((await dispatcher.observe({ orderId: 'ABCD1234', source: 'reconcile' })).status, 'already');
    assert.equal(state.sent.length, 2);

    const order = await journal.getAccountOrder('100', 'ABCD1234');
    const parts = await journal.listParts('delivery:100:ABCD1234:g1');
    assert.deepEqual(parts.map(part => part.state), ['confirmed', 'uncertain']);
    await dispatcher.resendUncertainPart({ orderKey: order.key, partId: parts[1].partId, expectedRevision: order.revision });
    assert.deepEqual(state.sent.map(item => item.text), ['Заказ ABCD1234', 'Второе', 'Второе'], 'only the uncertain part is sent again, on request');
    assert.equal((await journal.getAccountOrder('100', 'ABCD1234')).deliveryState, 'done');
    assert.equal((await journal.getAccountOrder('100', 'ABCD1234')).problemState, 'none', 'resolved uncertainty no longer contributes to the badge');
});

test('a definite rejection before anything was sent may be retried, sending only unsent parts', async () => {
    const { dispatcher, state } = await setup({ sends: [{ status: 'rejected', error: 'HTTP 400' }] });
    assert.equal((await dispatcher.observe({ orderId: 'ABCD1234' })).status, 'failed');
    assert.equal((await dispatcher.observe({ orderId: 'ABCD1234', source: 'reconcile' })).status, 'done');
    assert.equal(state.sent.length, 2);
});

test('an account switch between parts stops the delivery', async () => {
    const { dispatcher, state } = await setup({
        config: { 987: { enabled: true, mode: 'template', text: 'A$sleep=1B' } }
    });
    const originalPush = state.sent.push.bind(state.sent);
    state.sent.push = item => { originalPush(item); state.account = { accountId: '100', epoch: 2 }; return state.sent.length; };
    const result = await dispatcher.observe({ orderId: 'ABCD1234' });
    assert.equal(state.sent.length, 1);
    assert.equal(result.status, 'partial');
});

test('orders delivered by the previous version are not delivered again; not adopted orders only observed', async () => {
    const legacy = await setup({ settings: { deliveredOrderIds: ['ABCD1234'] } });
    assert.equal((await legacy.dispatcher.observe({ orderId: 'ABCD1234' })).status, 'already');
    assert.equal(legacy.state.sent.length, 0);
    const seed = await setup();
    const observed = await seed.dispatcher.observe({ orderId: 'ABCD1234', source: 'reconcile', adopt: false });
    assert.equal(observed.status, 'observed');
    assert.equal(seed.state.sent.length, 0);
});

test('fewer FunPay secrets than the quantity is a partial result flagged for attention', async () => {
    const { journal, dispatcher } = await setup({ page: { ...PAGE, secrets: ['ONLY-ONE'] } });
    await dispatcher.observe({ orderId: 'ABCD1234' });
    const order = await journal.getAccountOrder('100', 'ABCD1234');
    assert.equal(order.resultCoverage, 'partial');
    assert.equal(order.problemState, 'attention');
    assert.equal(order.verifiedFulfillmentCompletedAt, undefined);
});


test('a long sleep persists pending parts and resumes after a worker restart exactly once', async () => {
    const config = { 987: { enabled: true, mode: 'template', text: 'A$sleep=3600B$sleep=30C' } };
    const a = await setup({ config });
    assert.equal((await a.dispatcher.observe({ orderId: 'ABCD1234' })).status, 'pending');
    assert.deepEqual(a.state.sent.map(s => s.text), ['A']);
    const op = await a.journal.getOp('delivery:100:ABCD1234:g1');
    assert.equal(op.state, 'pending');
    const b = await setup({ config, backend: a.backend, instanceId: 'w2', savedClock: a.clock });
    await b.journal.recoverInterruptedOps();
    await b.dispatcher.resumeDue();
    assert.equal(b.state.sent.length, 0);
    b.clock.now += 3600000;
    await b.dispatcher.resumeDue();
    assert.deepEqual(b.state.sent.map(s => s.text), ['B']);
    b.clock.now += 30000;
    await b.dispatcher.resumeDue();
    await b.dispatcher.resumeDue();
    assert.deepEqual(b.state.sent.map(s => s.text), ['B', 'C']);
    assert.equal((await b.journal.getAccountOrder('100', 'ABCD1234')).deliveryState, 'done');
});

test('continuations recheck disable, refund, holds and session epoch before sending', async () => {
    for (const stop of ['disabled', 'refund', 'hold', 'epoch']) {
        const config = { 987: { enabled: true, mode: 'template', text: 'A$sleep=60B' } };
        const a = await setup({ config });
        await a.dispatcher.observe({ orderId: 'ABCD1234' });
        a.clock.now += 60000;
        if (stop === 'disabled') a.state.settings.autoDeliveryEnabled = false;
        if (stop === 'refund') a.state.page.statusText = 'Возврат';
        if (stop === 'hold') await a.journal.updateAccountOrder('100:ABCD1234', () => ({ holds: [{ owner: 'seller' }] }));
        if (stop === 'epoch') a.state.account.epoch++;
        await a.dispatcher.resumeDue();
        assert.deepEqual(a.state.sent.map(s => s.text), ['A'], stop);
    }
});

test('all lines are validated before the first POST and quantity does not repeat instructions', async () => {
    const tooLong = await setup({ config: { 987: { enabled: true, mode: 'template', text: 'first$sleep=1' + 'X'.repeat(1001) } } });
    assert.ok((await tooLong.dispatcher.observe({ orderId: 'ABCD1234' })).reasons.includes('delivery-line-too-long'));
    assert.equal(tooLong.state.sent.length, 0);
    const quantity = await setup({ config: { 987: { enabled: true, mode: 'template', text: 'Quantity: {quantity}' } } });
    await quantity.dispatcher.observe({ orderId: 'ABCD1234' });
    assert.deepEqual(quantity.state.sent.map(s => s.text), ['Quantity: 2']);
    const { splitDeliveryText } = await load('fulfillment_dispatcher.js');
    const chunks = splitDeliveryText(['K'.repeat(600), 'L'.repeat(600)].join('\n'));
    assert.deepEqual(chunks.map(p => p.text.length), [600, 600]);
});

test('continuation uses frozen parts and stops if verified quantity changed', async () => {
    for (const changedQuantity of [false, true]) {
        const config = { 987: { enabled: true, mode: 'template', text: 'A$sleep=60B' } };
        const env = await setup({ config });
        await env.dispatcher.observe({ orderId: 'ABCD1234' });
        config[987].text = '';
        if (changedQuantity) env.state.page.quantityText = '3 шт.';
        env.clock.now += 60000;
        await env.dispatcher.resumeDue();
        assert.deepEqual(env.state.sent.map(s => s.text), changedQuantity ? ['A'] : ['A', 'B']);
    }
});
