const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);
const auth = { csrf_token: 'csrf' };

function respond(status, body) {
    return async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });
}

test('strict sender posts exactly once and classifies every outcome', async () => {
    const { createStrictChatSender } = await load('chat_sender.js');
    const calls = [];
    const counting = impl => async (...args) => { calls.push(args); return impl(...args); };

    const cases = [
        [respond(200, JSON.stringify({ objects: [{ type: 'chat_node', id: '77', data: { messages: [{ id: 901, author: 100, html: '<div>Ваш&nbsp;ключ: <b>K-1</b></div>' }] } }] })), 'confirmed'],
        [respond(200, JSON.stringify({ objects: [], response: false })), 'accepted'],
        [respond(200, '<html>login</html>'), 'uncertain'],
        [respond(200, ''), 'uncertain'],
        [respond(200, JSON.stringify({ error: 'flood' })), 'rejected'],
        [respond(400, ''), 'rejected'],
        [respond(429, ''), 'rejected'],
        [respond(502, ''), 'uncertain'],
        [async () => { throw new TypeError('Failed to fetch'); }, 'uncertain']
    ];
    for (const [impl, expected] of cases) {
        calls.length = 0;
        const sender = createStrictChatSender({ fetchImpl: counting(impl) });
        const result = await sender.send({ chatId: '77', text: 'Ваш ключ: K-1', auth, accountId: '100' });
        assert.equal(result.status, expected);
        assert.equal(calls.length, 1, 'the sender never repeats a POST');
    }
    const confirmed = await createStrictChatSender({ fetchImpl: cases[0][0] }).send({ chatId: '77', text: 'Ваш ключ: K-1', auth, accountId: '100' });
    assert.equal(confirmed.messageId, '901');
    const otherAuthor = await createStrictChatSender({ fetchImpl: cases[0][0] }).send({ chatId: '77', text: 'Ваш ключ: K-1', auth, accountId: '555' });
    assert.equal(otherAuthor.status, 'accepted', 'a message by someone else is not our receipt');

    const slow = createStrictChatSender({ timeoutMs: 20, fetchImpl: (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }) });
    assert.equal((await slow.send({ chatId: '77', text: 'x', auth })).status, 'uncertain');
    assert.equal((await slow.send({ chatId: 'abc', text: 'x', auth })).status, 'rejected');
});

test('account guard bumps the epoch on account or key change and rejects stale effects', async () => {
    const { createAccountGuard, AccountChangedError } = await load('account_guard.js');
    const data = {};
    const storage = { get: async key => ({ [key]: data[key] }), set: async patch => Object.assign(data, patch) };
    let session = { userId: 100, goldenKey: 'k1', username: 'seller' };
    const changes = [];
    const guard = createAccountGuard({ storage, readSession: async () => session, hash: async value => `h:${value}`, cacheMs: 0 });
    guard.onChange(record => changes.push(record.epoch));

    const first = await guard.current();
    assert.deepEqual([first.accountId, first.epoch], ['100', 1]);
    assert.equal(data.fpToolsAccountEpoch.keyHash, 'h:k1', 'only a hash of the key is stored');
    await guard.assertCurrent(first);

    session = { userId: 100, goldenKey: 'k2' };
    await assert.rejects(() => guard.assertCurrent(first), AccountChangedError, 'a new session key is a new epoch');
    const second = await guard.current();
    assert.equal(second.epoch, 2);
    session = { userId: 200, goldenKey: 'k2' };
    assert.equal((await guard.current()).epoch, 3);
    session = {};
    const none = await guard.current();
    assert.equal(none.accountId, null);
    await assert.rejects(() => guard.assertCurrent({ accountId: '200', epoch: 3 }), AccountChangedError);
    assert.deepEqual(changes, [2, 3, 4]);
});
