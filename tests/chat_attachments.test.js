const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = () => import(pathToFileURL(path.join(__dirname, '../background/chat_attachments.js')).href);
const dataUrl = 'data:image/png;base64,aGVsbG8=';
const auth = { csrf_token: 'fixture-csrf' };
const args = { chatId: '77', dataUrl, fileName: 'fixture.png', auth };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Synthetic response bodies. Only the field contract was read from the live client bundle.
async function fixture(upload = response({ fileId: 123 }), runner = response({ response: {}, objects: [] })) {
    const { createChatAttachmentSender } = await load();
    const calls = [];
    const sender = createChatAttachmentSender({ fetchImpl: async (url, options) => {
        if (url.startsWith('data:')) return { blob: async () => new Blob(['hello'], { type: 'image/png' }) };
        calls.push({ url, options });
        const reply = url.includes('addChatImage') ? upload : runner;
        if (reply instanceof Error) throw reply;
        return reply;
    } });
    return { sender, calls };
}

test('images use native multipart and image_id; caption is a separate last message', async () => {
    const f = await fixture();
    for (const name of ['one.png', 'two.png', 'three.png']) {
        assert.deepEqual(await f.sender.sendImage({ ...args, fileName: name }), { status: 'accepted', fileId: 123 });
    }
    await f.sender.sendText({ chatId: '77', text: 'Подпись', auth });
    assert.equal(f.calls.length, 7);
    assert.deepEqual(f.calls.map(c => c.url.split('/').pop() || 'runner'), ['addChatImage', 'runner', 'addChatImage', 'runner', 'addChatImage', 'runner', 'runner']);
    for (const c of f.calls) {
        assert.equal(c.options.credentials, 'include');
        assert.equal(c.options.keepalive, undefined);
        assert.equal(c.options.headers.cookie, undefined);
    }
    assert.deepEqual([...f.calls[0].options.body.keys()], ['file']);
    assert.equal(f.calls[0].options.body.get('file').name, 'one.png');
    const image = JSON.parse(f.calls[1].options.body.get('request'));
    assert.deepEqual(image, { action: 'chat_message', data: { node: '77', last_message: -1, content: '', image_id: 123 } });
    const caption = JSON.parse(f.calls[6].options.body.get('request'));
    assert.equal(caption.data.content, 'Подпись');
    assert.equal(caption.data.image_id, undefined);
});

test('upload refusals, missing IDs and bad JSON never reach runner', async () => {
    for (const reply of [response({ error: 'too big' }), response({}), response({}, 429), new TypeError('Failed to fetch'), { ok: true, json: async () => { throw Error('html'); } }]) {
        const f = await fixture(reply);
        await assert.rejects(f.sender.sendImage(args), e => e.status === 'rejected');
        assert.equal(f.calls.length, 1);
    }
});

test('runner failures are classified without replaying upload or message', async () => {
    for (const [reply, expected] of [
        [response({ response: { error: 'flood' } }), 'rejected'],
        [response({ error: 'csrf' }), 'rejected'],
        [response({ response: { url: '/account/login' } }), 'rejected'],
        [response({}, 400), 'rejected'], [response({}, 429), 'rejected'],
        [response({}, 502), 'uncertain'], [response({}), 'uncertain'],
        [new TypeError('Failed to fetch'), 'uncertain'],
        [{ ok: true, json: async () => { throw Error('bad JSON'); } }, 'uncertain']
    ]) {
        const f = await fixture(undefined, reply);
        await assert.rejects(f.sender.sendImage(args), e => e.status === expected);
        assert.equal(f.calls.length, 2);
    }
});

test('timeout also bounds reading response bodies and never resends a message', async () => {
    const { createChatAttachmentSender } = await load();
    let requests = 0;
    const sender = createChatAttachmentSender({ timeoutMs: 10, fetchImpl: async (_, options) => {
        requests++;
        return { ok: true, json: () => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(Error('aborted'), { name: 'AbortError' })))) };
    } });
    await assert.rejects(sender.sendText({ chatId: '77', text: 'caption', auth }), e => e.status === 'uncertain');
    assert.equal(requests, 1);
});

test('invalid payloads cannot fetch arbitrary URLs or start uploads', async () => {
    const f = await fixture();
    for (const input of [{ dataUrl: 'https://example.invalid/image.png' }, { chatId: '../oops' }, { auth: {} }, { dataUrl: 'data:image/png;base64,' + 'x'.repeat(10 * 1024 * 1024) }]) {
        await assert.rejects(f.sender.sendImage({ ...args, ...input }), e => e.status === 'rejected');
    }
    assert.equal(f.calls.length, 0);
    const valid = await f.sender.sendImage({ ...args, chatId: 'users-100-200' });
    assert.equal(valid.fileId, 123);
});

test('account change between upload and runner prevents sending to a new account', async () => {
    const f = await fixture();
    let checks = 0;
    await assert.rejects(f.sender.sendImage({ ...args, beforeSend: async () => { if (++checks === 2) throw Error('account-changed'); } }), /account-changed/);
    assert.equal(f.calls.length, 1);
});
