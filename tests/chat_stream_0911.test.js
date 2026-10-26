const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);
const account = { accountId: '100', epoch: 1 };
const message = (id, authorId = '200', text = 'команда') => ({ id: String(id), authorId, text, kind: 'text' });

// All protocol inputs in this file are SYNTHETIC, not captured live FunPay data.
async function fixture(options = {}) {
    const { createChatStream } = await load('chat_stream.js');
    const { createAutoReplyStore } = await load('auto_reply_store.js');
    const data = { fpToolsAutoReplies: {} };
    const store = createAutoReplyStore({ get: async () => structuredClone(data), set: async patch => Object.assign(data, structuredClone(patch)) });
    let current = account;
    const calls = [], batches = [];
    const reader = { batchSize: 4,
        bookmarks: async () => ({ chats: [{ chatId: '77', msgId: '10', chatName: 'Buyer' }] }),
        batch: async (_, __, ids) => { batches.push(ids); return { 77: { ok: true, messages: [message(10), message(11), message(12, '100')] } }; },
        history: async () => ({ ok: true, messages: [] }), ...options.reader };
    const guard = { assertCurrent: async expected => { if (current.accountId !== expected.accountId || current.epoch !== expected.epoch) throw new Error('account-changed'); } };
    const args = { reader, guard, readSettings: async () => structuredClone(data.fpToolsAutoReplies), updateSettings: store.updateAutoReplies,
        processMessage: async msg => calls.push(msg), ...options };
    const stream = createChatStream(args);
    return { stream, data, calls, batches, reader, store, args, switch: value => { current = value; },
        state: () => data.fpToolsAutoReplies.chatStreams['100'].chats['77'] };
}

test('bootstrap ignores history; buyer before own last message is processed exactly once', async () => {
    const f = await fixture();
    await f.stream.poll(account, {});
    assert.equal(f.calls.length, 0);
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '12' }] });
    await f.stream.poll(account, {});
    assert.deepEqual(f.calls.map(m => m.id), ['11']);
    assert.equal(f.state().cursor, '12');
    await f.stream.poll(account, {});
    assert.equal(f.calls.length, 1);
});

test('system origin comes only from numeric author; marker-prefixed buyer remains buyer', async () => {
    const f = await fixture();
    await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '13' }] });
    f.reader.batch = async () => ({ 77: { ok: true, messages: [message(13, '0', 'оплатил заказ #ABCDEFGH'), message(12, '200', '\u2061команда'), message(11, '200', 'оплатил заказ #ABCDEFGH'), message(10)] } });
    await f.stream.poll(account, {});
    assert.deepEqual(f.calls.map(m => [m.id, m.system]), [['11', false], ['12', false], ['13', true]]);
});

test('unknown author blocks cursor before later own messages', async () => {
    const f = await fixture(); await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '12' }] });
    f.reader.batch = async () => ({ 77: { ok: true, messages: [message(10), message(11, null), message(12, '100')] } });
    await f.stream.poll(account, {});
    assert.equal(f.state().cursor, '10'); assert.equal(f.calls.length, 0); assert.match(f.state().error, /Автор/);
});

test('interrupted processing survives worker recreation and never replays a reserved reply', async () => {
    let attempts = 0;
    const f = await fixture({ processMessage: async () => { attempts++; throw new Error('lost response'); } });
    await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '12' }] });
    await f.stream.poll(account, {});
    assert.equal(f.state().handling.id, '11'); assert.equal(f.state().cursor, '10');
    const { createChatStream } = await load('chat_stream.js');
    await createChatStream(f.args).poll(account, {});
    assert.equal(attempts, 1);
});

test('backfill persists across passes and stops on repeated history without jumping cursor', async () => {
    let tick = 1000;
    const f = await fixture({ historyPages: 1, now: () => tick });
    await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '16' }] });
    f.reader.batch = async () => ({ 77: { ok: true, messages: [message(15), message(16)] } });
    f.reader.history = async (_, __, before) => ({ ok: true, messages: before === '15' ? [message(13), message(14)] : [message(10), message(11), message(12)] });
    await f.stream.poll(account, {});
    assert.equal(f.state().cursor, '10'); assert.ok(f.state().backfill.length);
    await f.stream.poll(account, {});
    assert.equal(f.state().cursor, '16'); assert.equal(f.calls.length, 6); assert.equal(f.state().backfill, undefined);
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '20' }] });
    f.reader.batch = async () => ({ 77: { ok: true, messages: [message(20)] } });
    f.reader.history = async () => ({ ok: true, messages: [message(20)] });
    await f.stream.poll(account, {});
    assert.equal(f.state().cursor, '16'); assert.match(f.state().error, /пропуск/);
});

test('late account change cannot advance cursor or write into the next scope', async () => {
    const f = await fixture(); await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: [{ chatId: '77', msgId: '12' }] });
    f.reader.batch = async () => { f.switch({ accountId: '300', epoch: 2 }); return { 77: { ok: true, messages: [message(10), message(11)] } }; };
    await assert.rejects(f.stream.poll(account, {}), /account-changed/);
    assert.equal(f.state().cursor, '10'); assert.equal(f.calls.length, 0);
    assert.equal(f.data.fpToolsAutoReplies.chatStreams['300'], undefined);
});

test('pending reads coalesce, batches are bounded, and new chat starts after bootstrap boundary', async () => {
    const f = await fixture(); await f.stream.poll(account, {});
    f.reader.bookmarks = async () => ({ chats: Array.from({ length: 12 }, (_, i) => ({ chatId: String(80 + i), msgId: String(20 + i) })) });
    f.reader.batch = async (_, __, ids) => { f.batches.push(ids); return Object.fromEntries(ids.map(id => [id, { ok: true, messages: [message(20 + Number(id) - 80)] }])); };
    await f.stream.poll(account, {});
    assert.deepEqual(f.batches.map(ids => ids.length), [4, 4]);
    assert.equal(f.calls.length, 3); // Shared history budget also applies to proving a new chat's beginning.
    assert.equal(f.data.fpToolsAutoReplies.chatStreams['100'].pending.length, 9);
    for (let pass = 0; pass < 3; pass++) await f.stream.poll(account, {});
    assert.equal(f.calls.length, 12);
});

test('IDs stay lossless, duplicate conflicts fail closed, and imported cursors are ignored', async () => {
    const { orderedMessages, messageId } = await load('chat_protocol.js');
    assert.equal(messageId(Number.MAX_SAFE_INTEGER + 1), null);
    assert.deepEqual(orderedMessages([message('9007199254740993'), message('9007199254740992')]).map(m => m.id), ['9007199254740992', '9007199254740993']);
    assert.equal(orderedMessages([message(11), message('11')]).length, 1);
    assert.throws(() => orderedMessages([message(11), message(11, '300')]), /повтор/);
    const f = await fixture(); await f.stream.poll(account, {});
    await f.store.importAutoReplies({ greetingText: 'new', chatStreams: { malicious: true } });
    assert.equal(f.state().cursor, '10'); assert.equal(f.data.fpToolsAutoReplies.greetingText, 'new');
});

test('runtime cursor writes do not request another engine pass; configuration edits still do', async () => {
    const { hasAutoReplyConfigurationChanges } = await load('auto_reply_store.js');
    const before = { keywordsEnabled: true, keywords: [], chatStreams: { 100: { cursor: '1' } }, greetedUsers: [] };
    assert.equal(hasAutoReplyConfigurationChanges(before, { ...before, chatStreams: { 100: { cursor: '2' } }, greetedUsers: ['77'] }), false);
    assert.equal(hasAutoReplyConfigurationChanges(before, { ...before, keywordsEnabled: false }), true);
    assert.equal(hasAutoReplyConfigurationChanges(before, { ...before, keywords: [{ keyword: 'changed' }] }), true);
});

test('reader serializes batches per account, persists 429 cooldown, and never immediately retries', async () => {
    const { createChatReader } = await load('chat_reader.js');
    let calls = 0, cooldown = 0;
    const reader = createChatReader({ now: () => 1000, getCooldown: async () => cooldown,
        setCooldown: async (_, value) => { cooldown = value; },
        fetchImpl: async () => { calls++; return { ok: false, status: 429, headers: { get: () => '120' } }; } });
    const results = await Promise.allSettled([reader.bookmarks(account, {}), reader.bookmarks(account, {})]);
    assert.ok(results.every(r => r.status === 'rejected')); assert.equal(calls, 1); assert.equal(cooldown, 121000);
    const { readDelay } = await load('chat_protocol.js');
    assert.equal(readDelay({ status: 403, headers: { get: () => null } }), 900000);
});

test('wired autoresponder handles a buyer payment quotation as ordinary text; only system author registers an order; delivery stays unmarked', async () => {
    const previousChrome = global.chrome, previousFetch = global.fetch;
    const stored = { fpToolsAutoReplies: { keywordsEnabled: true, keywords: [
        { keyword: 'оплатил заказ', matchMode: 'contains', response: 'Обычный ответ' }
    ] } };
    const sent = [], observed = [];
    let target = '10';
    const messages = [message(10), message(11, '200', 'оплатил заказ #ABCDEFGH'), message(12, '100'), message(13, '0', 'оплатил заказ #ABCDEFGH'), message(14, '100')];
    global.chrome = { cookies: { get: async () => ({ value: 'synthetic-only' }) },
        tabs: { query: async () => [{ id: 1 }], sendMessage: async () => ({ success: true, data: { 'csrf-token': 'synthetic', userId: '100' } }) },
        storage: { local: { get: async key => ({ [key]: structuredClone(stored[key]) }), set: async patch => Object.assign(stored, structuredClone(patch)) } },
        offscreen: { createDocument: async () => {}, closeDocument: async () => {} },
        runtime: { getURL: file => file, getContexts: async () => [], sendMessage: async request =>
            request.action === 'parseChatList' ? [{ chatId: '77', msgId: target, chatName: 'Buyer' }] : { ok: true, messages: request.messages } }
    };
    global.fetch = async (_, options) => {
        const payload = options.body;
        const effect = JSON.parse(payload.get('request'));
        if (effect) { sent.push(effect.data.content); return { ok: true, status: 200, text: async () => '{"objects":[]}' }; }
        const objects = JSON.parse(payload.get('objects'));
        const body = objects[0].type === 'chat_bookmarks' ? { objects: [{ type: 'chat_bookmarks', data: { html: 'synthetic' } }] }
            : { objects: [{ type: 'chat_node', id: '77', data: { node: { id: '77' }, messages } }] };
        return { ok: true, status: 200, json: async () => body };
    };
    try {
        const ar = await load('autoresponder.js');
        ar.configureOrderAutomation({ guard: { current: async () => account, assertCurrent: async () => account },
            roleOf: async () => 'seller', dispatcher: { observe: async value => {
                observed.push(value); assert.equal(stored.fpToolsAutoReplies.chatStreams['100'].chats['77'].cursor, '12');
                return { status: 'observed' };
            } } });
        await ar.runAutoResponderCycle(); target = '14'; await ar.runAutoResponderCycle();
        assert.deepEqual(sent, ['\u2061Обычный ответ']);
        assert.equal(observed.length, 1); assert.equal(observed[0].orderId, 'ABCDEFGH');
        assert.equal(stored.fpToolsAutoReplies.chatStreams['100'].chats['77'].cursor, '14');
        await ar.getDeliveryChatSender().send({ chatId: '77', text: 'KEY\u2060-1', accountId: '100', auth: { csrf_token: 'synthetic' } });
        assert.equal(sent.at(-1), 'KEY\u2060-1');
    } finally { global.chrome = previousChrome; global.fetch = previousFetch; }
});
