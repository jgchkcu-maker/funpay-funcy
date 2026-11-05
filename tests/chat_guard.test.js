const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);
const message = (id, authorId = '200', text = 'Вопрос', kind = 'text', extra = {}) => ({ id: String(id), authorId, text, kind, ...extra });

async function fixture(options = {}) {
    const { createAutoReplyStore } = await load('auto_reply_store.js');
    const { createChatGuard } = await load('chat_guard.js');
    const { createChatStream } = await load('chat_stream.js');
    let clock = 100000, current = { accountId: '100', epoch: 1 }, target = '10';
    const data = { fpToolsAutoReplies: { chatGuardEnabled: true, ...options.settings } };
    const storage = { get: async () => structuredClone(data), set: async patch => Object.assign(data, structuredClone(patch)) };
    const store = createAutoReplyStore(storage);
    const guard = { current: async () => current, assertCurrent: async expected => {
        if (current.accountId !== expected.accountId || current.epoch !== expected.epoch) throw new Error('account-changed');
    } };
    const args = { readSettings: async () => structuredClone(data.fpToolsAutoReplies), updateSettings: store.updateAutoReplies, guard, now: () => clock };
    let observer = createChatGuard(args);
    const reader = { batchSize: 4, bookmarks: async () => ({ chats: [{ chatId: '77', msgId: target, chatName: 'Покупатель' }] }),
        batch: async () => ({ 77: { ok: true, messages: f.messages } }), history: async () => ({ ok: true, messages: [] }) };
    const calls = [];
    let stream;
    const restart = () => {
        observer = createChatGuard(args);
        stream = createChatStream({ ...args, observer, reader, processMessage: options.processMessage || (async msg => calls.push(msg.id)) });
    };
    const f = { data, store, guard, reader, calls, messages: [message(10)],
        state: () => data.fpToolsAutoReplies.chatGuardState['100'],
        waiting: () => f.state().waiting['77'],
        advance: amount => { clock += amount; }, switch: id => { current = { accountId: id, epoch: current.epoch + 1 }; },
        poll: () => stream.poll(current, {}),
        add: (...messages) => { f.messages.push(...messages); target = messages.at(-1).id; },
        restart, observer: () => observer,
        snooze: () => observer.command({ operation: 'snooze', chatId: '77', minutes: 15, lastBuyerMessageId: f.waiting()?.lastBuyerMessageId, expectedAccountId: '100' }) };
    restart();
    await f.poll();
    return f;
}

test('ChatGuard baseline is independent of existing autoreply cursors; only new buyer messages count', async () => {
    const f = await fixture({ settings: { chatGuardEnabled: false } });
    f.add(message(11)); await f.poll();
    await f.store.patchAutoReplies({ set: { chatGuardEnabled: true } });
    await f.poll(); assert.equal(f.waiting(), undefined);
    f.add(message(12, '0', 'Оплатил заказ')); await f.poll(); assert.equal(f.waiting(), undefined);
    f.add(message(13, '200', '', 'image')); await f.poll();
    assert.equal(f.waiting().text, 'Фото');
    assert.equal(f.waiting().lastBuyerMessageId, '13');
});

test('ChatGuard preserves first detection time, cancels snooze on a new message and ignores duplicate IDs', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    const since = f.waiting().since;
    await f.snooze(); const deadline = f.waiting().snoozedUntil;
    f.restart(); await f.poll(); assert.equal(f.waiting().snoozedUntil, deadline);
    f.advance(60000); f.add(message(12, '200', 'Есть кто?')); await f.poll();
    assert.equal(f.waiting().since, since); assert.equal(f.waiting().snoozedUntil, 0);
    await f.snooze(); await f.poll(); assert.ok(f.waiting().snoozedUntil > 0);
    f.add(message(13, '100', 'Отвечаю')); await f.poll(); assert.equal(f.waiting(), undefined);
    f.restart(); await f.poll(); assert.equal(f.waiting(), undefined);
});

test('ChatGuard resume returns a snoozed chat; dismiss drops the wait until the next buyer message', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    const run = (operation, extra = {}) => f.observer().command({ operation, chatId: '77', lastBuyerMessageId: f.waiting()?.lastBuyerMessageId, expectedAccountId: '100', ...extra });
    await run('snooze', { minutes: 180 }); assert.equal(f.waiting().snoozedUntil, 100000 + 180 * 60000);
    await assert.rejects(run('snooze', { minutes: 30 }), /отсрочка/);
    await run('resume'); assert.equal(f.waiting().snoozedUntil, 0);
    await assert.rejects(run('dismiss', { lastBuyerMessageId: '10' }), /Чат изменился/);
    await run('dismiss'); assert.equal(f.waiting(), undefined);
    f.restart(); await f.poll(); assert.equal(f.waiting(), undefined, 'the dismissed message is not detected again');
    f.add(message(12, '200', 'Ещё вопрос')); await f.poll();
    assert.equal(f.waiting().lastBuyerMessageId, '12');
});

test('ChatGuard observes buyer → auto greeting → manual answer → new buyer in message order', async () => {
    const f = await fixture();
    f.add(message(11), message(12, '100', '\u2061Здравствуйте'), message(13, '100', 'Да'), message(14, '200', 'Ещё вопрос'));
    await f.poll();
    assert.equal(f.waiting().firstMessageId, '14'); assert.equal(f.waiting().text, 'Ещё вопрос');
});

test('ChatGuard records unmarked automatic delivery before sending, matches receipt by author/boundary/hash, and never stores secrets', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    let posts = 0;
    await f.observer().trackSend({ chatId: '77', text: 'secret-product', accountId: '100' }, async ({ afterMessageId }) => {
        posts++; assert.equal(afterMessageId, '11');
        assert.equal(f.state().outgoing[0].status, 'sending');
        return { status: 'accepted' };
    });
    assert.equal(JSON.stringify(f.state()).includes('secret-product'), false);
    f.add(message(12, '100', 'secret-product')); await f.poll();
    assert.ok(f.waiting()); assert.equal(posts, 1); assert.equal(f.state().outgoing.length, 0);
    f.add(message(13, '100', 'Ручной быстрый ответ')); await f.poll(); assert.equal(f.waiting(), undefined);
});

test('ChatGuard automatic image and manual image have distinct provenance', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    await f.observer().trackSend({ chatId: '77', imageId: '500', accountId: '100' }, async () => ({ status: 'accepted' }));
    f.add(message(12, '100', '', 'image', { imageId: '500' })); await f.poll(); assert.ok(f.waiting());
    f.add(message(13, '100', '', 'image', { imageId: '501' })); await f.poll(); assert.equal(f.waiting(), undefined);
});

test('ChatGuard retains ambiguous automatic sends through a restart, then accepts a definite manual answer', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    let posts = 0;
    await assert.rejects(f.observer().trackSend({ chatId: '77', imageId: '500', accountId: '100' }, async () => { posts++; throw new Error('timeout'); }));
    f.restart(); f.add(message(12, '100', '', 'image')); await f.poll();
    assert.match(f.waiting().uncertain, /источник/); assert.equal(posts, 1);
    f.add(message(13, '100', 'Сейчас помогу')); await f.poll(); assert.equal(f.waiting(), undefined);
});

test('ChatGuard does not guess which of two identical own messages was the automatic send', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    await f.observer().trackSend({ chatId: '77', text: 'Одинаковый текст' }, async () => ({ status: 'uncertain' }));
    f.add(message(12, '100', 'Одинаковый текст'), message(13, '100', 'Одинаковый текст'));
    await f.poll(); assert.ok(f.waiting().uncertain);
    f.add(message(14, '100', 'Другой ручной ответ')); await f.poll(); assert.equal(f.waiting(), undefined);
});

test('ChatGuard keeps observing a blocked automatic handler without replaying its side effect', async () => {
    let attempts = 0;
    const f = await fixture({ processMessage: async () => { attempts++; throw new Error('uncertain send'); } });
    f.add(message(11)); await f.poll(); assert.ok(f.waiting());
    assert.equal(f.data.fpToolsAutoReplies.chatStreams['100'].chats['77'].handling.id, '11');
    f.advance(61000); f.restart(); f.add(message(12, '100', 'Ручной ответ')); await f.poll();
    assert.equal(f.waiting(), undefined); assert.equal(attempts, 1);
    assert.equal(f.data.fpToolsAutoReplies.chatStreams['100'].chats['77'].handling.id, '11');
});

test('ChatGuard resume reconciles saved waiting chats, but baselines other chats again', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    await f.store.patchAutoReplies({ set: { chatGuardEnabled: false } });
    f.add(message(12, '100', 'Отвечено во время паузы'));
    await f.poll(); assert.ok(f.waiting());
    await f.store.patchAutoReplies({ set: { chatGuardEnabled: true } });
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '88', msgId: '13', chatName: 'Другой' }] });
    await f.poll(); assert.equal(f.waiting(), undefined);
    assert.equal(f.state().waiting['88'], undefined);
});

test('ChatGuard stale account commands and late network responses cannot mutate the next account', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    f.reader.batch = async () => { f.switch('300'); return { 77: { ok: true, messages: f.messages } }; };
    f.add(message(12)); await assert.rejects(f.poll(), /account-changed/);
    await assert.rejects(f.snooze(), /Аккаунт/);
    assert.equal(f.data.fpToolsAutoReplies.chatGuardState['300'], undefined);
});

test('ChatGuard runtime stays local during imports and does not wake the engine on every cursor write', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    const { hasAutoReplyConfigurationChanges } = await load('auto_reply_store.js');
    const before = structuredClone(f.data.fpToolsAutoReplies);
    await f.snooze();
    assert.equal(hasAutoReplyConfigurationChanges(before, f.data.fpToolsAutoReplies), false);
    const runtime = structuredClone(f.state());
    await f.store.importAutoReplies({ chatGuardEnabled: true, chatGuardThresholdMinutes: 5, chatGuardState: { hacked: true } });
    assert.deepEqual(f.state(), runtime); assert.equal(f.data.fpToolsAutoReplies.chatGuardThresholdMinutes, 5);
});

test('ChatGuard alone activates the shared heartbeat; default remains off', async () => {
    const { anyAutomationEnabled } = await load('fpt_engine.js');
    const previous = global.chrome;
    try {
        let settings = {};
        global.chrome = { storage: { local: { get: async () => ({ fpToolsAutoReplies: settings }) } } };
        assert.equal(await anyAutomationEnabled(), false);
        settings = { chatGuardEnabled: true }; assert.equal(await anyAutomationEnabled(), true);
    } finally { global.chrome = previous; }
});

test('ChatGuard notification leases deduplicate tabs and survive restart and extra buyer messages', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll(); f.advance(31 * 60000); await f.poll();
    const command = (operation, extra = {}) => f.observer().command({ operation, expectedAccountId: '100', notificationTabId: 1, ...extra });
    const claims = await Promise.all([command('claimNotification'), command('claimNotification', { notificationTabId: 2 })]);
    assert.equal(claims.filter(result => result.notification).length, 1);
    const claim = claims.find(result => result.notification).notification;
    await command('ackNotification', { token: claim.token, notificationTabId: 999 });
    assert.equal(f.waiting().notifiedAt, undefined, 'another tab cannot acknowledge the lease');
    await command('ackNotification', { token: claim.token });
    assert.ok(f.waiting().notifiedAt);
    f.restart(); f.add(message(12)); await f.poll();
    assert.equal((await command('claimNotification')).notification, undefined);
    f.add(message(13, '100', 'Ответ'), message(14)); await f.poll(); f.advance(31 * 60000); await f.poll();
    assert.ok((await command('claimNotification')).notification, 'a new wait can notify');
});

test('ChatGuard notifications require fresh reconciled state, ignore viewed/snoozed chats and recover abandoned leases', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll(); f.advance(31 * 60000);
    const claim = extra => f.observer().command({ operation: 'claimNotification', expectedAccountId: '100', notificationTabId: 1, ...extra });
    assert.equal((await claim()).notification, undefined, 'stale snapshot');
    await f.poll();
    assert.equal((await claim({ excludeChatId: '77' })).notification, undefined);
    await f.snooze(); assert.equal((await claim()).notification, undefined);
    f.advance(16 * 60000); await f.poll();
    const first = (await claim()).notification;
    assert.ok(first);
    f.advance(16000);
    assert.ok((await claim()).notification, 'expired lease is retried');
});

test('ChatGuard dismissal undo is bounded and never restores a wait over newer messages', async () => {
    const f = await fixture(); f.add(message(11)); await f.poll();
    const dismiss = () => f.observer().command({ operation: 'dismiss', expectedAccountId: '100', chatId: '77', lastBuyerMessageId: f.waiting().lastBuyerMessageId });
    const undo = token => f.observer().command({ operation: 'undoDismiss', expectedAccountId: '100', token });
    const first = await dismiss(); assert.equal(f.waiting(), undefined);
    await undo(first.undoToken); assert.equal(f.waiting().firstMessageId, '11');
    const second = await dismiss(); f.add(message(12)); await f.poll();
    await assert.rejects(undo(second.undoToken), /изменился/);
    assert.equal(f.waiting().firstMessageId, '12');
    const third = await dismiss(); f.advance(11000);
    await assert.rejects(undo(third.undoToken), /изменился/);
});
