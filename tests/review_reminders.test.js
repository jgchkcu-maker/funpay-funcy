const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);
const HOUR = 3600 * 1000;

async function setup({ sends = [], settings = {} } = {}) {
    const ops = await load('ops_db.js');
    const facts = await load('order_facts.js');
    const { createReviewReminders } = await load('review_reminders.js');
    const clock = { now: 1_000_000_000 };
    const journal = ops.createOpsJournal({ backend: ops.createMemoryBackend(), now: () => clock.now, instanceId: 'w1' });
    const state = {
        settings: { reviewReminderEnabled: true, reviewReminderDelayHours: 2, reviewReminderExpiryDays: 3, reviewReminderChatCapDays: 7, ...settings },
        pages: {}, sent: [], loads: [], sales: { first: { orders: [] } }, account: { accountId: '100', epoch: 1 }
    };
    const outcomes = [...sends];
    const page = (orderId, extra = {}) => ({
        recognized: true, pageOrderId: orderId, currentUserId: '100', sellerId: '100', buyerId: '5', buyerUsername: 'Buyer',
        buyerChatId: '77', statusText: 'Закрыт', quantityText: '1', lotId: '9', review: { sectionFound: true }, ...extra
    });
    const reminders = createReviewReminders({
        journal,
        guard: { current: async () => state.account, assertCurrent: async expected => { if (expected.epoch !== state.account.epoch) throw new Error('changed'); return state.account; } },
        loadFacts: async orderId => (state.loads.push(orderId), facts.normalizeOrderFacts(state.pages[orderId] || page(orderId), { requestedOrderId: orderId, observedAt: clock.now })),
        fetchSalesPage: async token => state.sales[token || 'first'] || { orders: [] },
        sender: { send: async ({ chatId, text }) => { state.sent.push({ chatId, text }); return outcomes.shift() || { status: 'confirmed' }; } },
        getAuth: async () => ({ csrf_token: 'x' }),
        getSettings: async () => state.settings,
        now: () => clock.now,
        hash: async () => 'h',
        log: { warn() {} }
    });
    const fulfilled = async (orderId, extra = {}) => {
        const { order } = await journal.recordAccountOrder({
            accountId: '100', orderId, source: 'chat', adopted: true, chatId: '77', buyerName: 'Buyer', lotName: 'Ключ', lotId: '9',
            deliveryState: 'done', verifiedFulfillmentCompletedAt: clock.now, fpConfirmedAt: clock.now, fpStatus: 'closed', reviewPresence: 'absent', ...extra
        });
        return reminders.observeOrder({ order });
    };
    return { journal, reminders, state, clock, page, fulfilled };
}

test('only orders after enabling, with verified fulfillment and confirmation, get one task', async () => {
    const env = await setup();
    await env.journal.recordAccountOrder({ accountId: '100', orderId: 'OLDORD01', source: 'seed' });
    env.clock.now += 1000;
    await env.reminders.onSettingsChanged();
    env.clock.now += 1000;
    const task = await env.fulfilled('NEWORD01');
    assert.equal(task.state, 'scheduled');
    assert.equal(task.dueAt, env.clock.now + 2 * HOUR);
    env.clock.now += HOUR;
    const again = await env.fulfilled('NEWORD01');
    assert.equal(again.dueAt, task.dueAt, 'a repeated event does not move the due time');
    assert.equal(await env.fulfilled('NOVERIF1', { verifiedFulfillmentCompletedAt: null }), null, 'no verified fulfillment, no task');
    const { order: old } = await env.journal.recordAccountOrder({ accountId: '100', orderId: 'OLDORD01', source: 'chat', adopted: true, verifiedFulfillmentCompletedAt: env.clock.now, fpConfirmedAt: env.clock.now, chatId: '77' });
    assert.equal(await env.reminders.observeOrder({ order: old }), null, 'orders seen before enabling never get a reminder');

    env.clock.now += 2 * HOUR;
    await env.reminders.run();
    assert.equal(env.state.sent.length, 1);
    assert.match(env.state.sent[0].text, /orders\/NEWORD01/);
    await env.reminders.run();
    assert.equal(env.state.sent.length, 1, 'never twice');
});

test('any review cancels, an unknown review defers, refund and problems cancel', async () => {
    const env = await setup();
    await env.reminders.onSettingsChanged();
    env.clock.now += 1000;
    await env.fulfilled('REVIEW01');
    await env.fulfilled('UNKNOWN1');
    await env.fulfilled('REFUND01');
    env.state.pages.REVIEW01 = env.page('REVIEW01', { review: { sectionFound: true, rating: 1 } });
    env.state.pages.UNKNOWN1 = env.page('UNKNOWN1', { review: { sectionFound: false } });
    env.state.pages.REFUND01 = env.page('REFUND01', { statusText: 'Возврат' });
    env.clock.now += 3 * HOUR;
    await env.reminders.run();
    const byId = Object.fromEntries((await env.reminders.list()).tasks.map(task => [task.orderId, task]));
    assert.equal(byId.REVIEW01.state, 'cancelled', 'a one-star review cancels too');
    assert.equal(byId.UNKNOWN1.state, 'deferred');
    assert.equal(byId.REFUND01.state, 'cancelled');
    assert.equal(env.state.sent.length, 0);

    const { order } = await env.journal.recordAccountOrder({ accountId: '100', orderId: 'PROBLEM1', source: 'chat', adopted: true, chatId: '78', verifiedFulfillmentCompletedAt: env.clock.now, fpConfirmedAt: env.clock.now });
    await env.reminders.observeOrder({ order });
    const withHold = await env.journal.updateAccountOrder(order.key, () => ({ holds: [{ owner: 'seller', reason: 'x' }] }));
    await env.reminders.observeOrder({ order: withHold });
    assert.equal((await env.journal.getRecord('reminders', 'review-reminder:100:PROBLEM1')).state, 'cancelled');
    const released = await env.journal.updateAccountOrder(order.key, () => ({ holds: [] }));
    await env.reminders.observeOrder({ order: released });
    assert.equal((await env.journal.getRecord('reminders', 'review-reminder:100:PROBLEM1')).state, 'cancelled', 'fixing the problem does not revive the task');
});

test('one reminder per chat within the cap; uncertain sends are not repeated and use the cap', async () => {
    const env = await setup({ sends: [{ status: 'uncertain', error: 'timeout' }] });
    await env.reminders.onSettingsChanged();
    env.clock.now += 1000;
    await env.fulfilled('CHATA001');
    await env.fulfilled('CHATA002');
    env.clock.now += 3 * HOUR;
    await env.reminders.run();
    const tasks = Object.fromEntries((await env.reminders.list()).tasks.map(task => [task.orderId, task]));
    assert.equal(env.state.sent.length, 1);
    assert.equal(tasks.CHATA001.state, 'uncertain');
    assert.equal(tasks.CHATA002.state, 'cancelled', 'the second order in the same chat is past its expiry before the cap ends');
});

test('disabling cancels pending tasks; re-enabling starts a new baseline without reviving them', async () => {
    const env = await setup();
    await env.reminders.onSettingsChanged();
    env.clock.now += 1000;
    await env.fulfilled('PENDING1');
    env.state.settings.reviewReminderEnabled = false;
    await env.reminders.onSettingsChanged();
    assert.equal((await env.journal.getRecord('reminders', 'review-reminder:100:PENDING1')).state, 'cancelled');
    env.state.settings.reviewReminderEnabled = true;
    await env.reminders.onSettingsChanged();
    env.clock.now += 3 * HOUR;
    await env.reminders.run();
    assert.equal(env.state.sent.length, 0);
    assert.equal((await env.journal.getMeta('reminderBaseline:100')).active, true);
});

test('candidates: closed orders without a review, checked once and grouped by lot and buyer', async () => {
    const env = await setup();
    const row = (orderId, extra = {}) => ({ orderId, orderStatus: 'closed', description: `Лот ${orderId}`, buyerUsername: 'Buyer', orderDate: new Date(env.clock.now).toISOString(), price: 100, currency: 'RUB', ...extra });
    env.state.sales.first = { orders: [row('NOREV001'), row('HASREV01'), row('UNKNOW01'), row('PAIDORD1', { orderStatus: 'paid' }), row('NOREV002', { buyerUsername: 'Other' })], nextOrderId: 'P2' };
    env.state.sales.P2 = { orders: [row('REFUND01')], nextOrderId: null };
    env.state.pages.HASREV01 = env.page('HASREV01', { review: { sectionFound: true, rating: 5 } });
    env.state.pages.UNKNOW01 = env.page('UNKNOW01', { review: { sectionFound: false } });
    env.state.pages.REFUND01 = env.page('REFUND01', { statusText: 'Возврат' });
    env.state.pages.NOREV002 = env.page('NOREV002', { lotId: '11', buyerUsername: 'Other', buyerChatId: '78' });

    const first = await env.reminders.candidates();
    assert.deepEqual(first.orders.map(order => order.orderId).sort(), ['NOREV001', 'NOREV002']);
    assert.equal(first.unknown, 1, 'an unrecognized review section is not listed as «no review»');
    assert.equal(first.pending, 0);
    assert.deepEqual(first.lots.map(lot => [lot.offerId, lot.count]).sort(), [['11', 1], ['9', 1]]);
    assert.deepEqual(first.buyers.map(buyer => buyer.name).sort(), ['Buyer', 'Other']);
    assert.ok(!env.state.loads.includes('PAIDORD1'), 'paid orders are not checked');

    const loads = env.state.loads.length;
    await env.reminders.candidates();
    assert.equal(env.state.loads.length, loads, 'fresh checks are cached');
    const presentLoads = env.state.loads.filter(id => id === 'HASREV01').length;
    env.clock.now += 7 * HOUR;
    await env.reminders.candidates();
    assert.equal(env.state.loads.filter(id => id === 'HASREV01').length, presentLoads, 'a present review is never re-checked');
    assert.ok(env.state.loads.filter(id => id === 'NOREV001').length === 2, 'an absent review is re-checked after the TTL');
    assert.equal((await env.journal.getAccountOrder('100', 'NOREV001')), null, 'the order projection is not touched');
});

test('candidates honours the per-call check limit', async () => {
    const env = await setup();
    env.state.sales.first = { orders: Array.from({ length: 5 }, (_, index) => ({ orderId: `LIMIT00${index}`, orderStatus: 'closed', orderDate: env.clock.now - index })) };
    const result = await env.reminders.candidates({ limit: 2 });
    assert.equal(result.orders.length, 2);
    assert.equal(result.pending, 3);
});

test('manual reminder: old closed order without review, even with automation off', async () => {
    const env = await setup({ settings: { reviewReminderEnabled: false, reviewReminderExcludedLots: ['9'] } });
    await env.journal.recordAccountOrder({ accountId: '100', orderId: 'OLDMAN01', source: 'seed', fpStatus: 'closed', buyerName: 'Buyer' });
    env.state.sales.first = { orders: [{ orderId: 'OLDMAN01', orderStatus: 'closed' }, { orderId: 'NOTCHK01', orderStatus: 'closed' }] };
    await env.reminders.candidates({ limit: 1 });
    const { results } = await env.reminders.sendManual({ orderIds: ['OLDMAN01', 'NOTCHK01'] });
    const byId = Object.fromEntries(results.map(item => [item.orderId, item]));
    assert.equal(byId.OLDMAN01.state, 'sent', 'exclusions and the «new orders only» rule do not apply to an explicit choice');
    assert.equal(byId.NOTCHK01.state, 'skipped', 'an order that was never checked is not sent');
    assert.equal(env.state.sent.length, 1);
    assert.match(env.state.sent[0].text, /orders\/OLDMAN01/);

    const again = await env.reminders.sendManual({ orderIds: ['OLDMAN01'] });
    assert.equal(again.results[0].state, 'skipped');
    assert.equal(env.state.sent.length, 1, 'never twice');
    await assert.rejects(env.reminders.sendManual({ orderIds: Array.from({ length: 11 }, (_, i) => `MANY${i}`) }));
});

test('manual reminder re-checks the page and respects reviews, holds and the chat cap', async () => {
    const env = await setup();
    env.state.sales.first = { orders: ['MANREV01', 'MANHLD01', 'MANCAP01', 'MANCAP02'].map(orderId => ({ orderId, orderStatus: 'closed' })) };
    env.state.pages.MANCAP02 = env.page('MANCAP02', { buyerChatId: '77' });
    await env.reminders.candidates();
    env.state.pages.MANREV01 = env.page('MANREV01', { review: { sectionFound: true, rating: 4 } });
    const { order } = await env.journal.recordAccountOrder({ accountId: '100', orderId: 'MANHLD01', source: 'chat', fpStatus: 'closed' });
    await env.journal.updateAccountOrder(order.key, () => ({ holds: [{ owner: 'seller', reason: 'x' }] }));
    const { results } = await env.reminders.sendManual({ orderIds: ['MANREV01', 'MANHLD01', 'MANCAP01', 'MANCAP02'] });
    const byId = Object.fromEntries(results.map(item => [item.orderId, item]));
    assert.equal(byId.MANREV01.state, 'cancelled');
    assert.equal(byId.MANHLD01.state, 'cancelled');
    assert.equal(byId.MANCAP01.state, 'sent');
    assert.equal(byId.MANCAP02.state, 'cancelled', 'the same chat within the cap is not written to again');
    assert.equal(env.state.sent.length, 1);
    const pending = (await env.reminders.list()).tasks.filter(task => ['scheduled', 'deferred'].includes(task.state));
    assert.equal(pending.length, 0, 'manual tasks never linger');
});
