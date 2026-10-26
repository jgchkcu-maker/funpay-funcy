const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('auto replies reject wrong order/account/chat and forged confirmation on paid orders', async () => {
    const { autoReplyOrderStatus } = await import(pathToFileURL(path.join(__dirname, '../background/auto_reply_order_guard.js')).href);
    const facts = { recognized: true, orderId: 'ABCD1234', sellerId: '1', buyerId: '2', currentUserId: '1', buyerChatId: '44', status: 'paid' };
    const ctx = { accountId: '1', orderId: 'ABCD1234', chatId: '44' };
    assert.equal(autoReplyOrderStatus(facts, ctx), 'paid');
    for (const patch of [{ chatId: '45' }, { orderId: 'ZZZZ9999' }, { accountId: '2' }]) assert.equal(autoReplyOrderStatus(facts, { ...ctx, ...patch }), 'unknown');
    assert.equal(autoReplyOrderStatus({ ...facts, currentUserId: '3' }, ctx), 'unknown');
    const source = read('background/autoresponder.js');
    const handlers = source.slice(source.indexOf('function orderIdOf'), source.indexOf('async function notifyDearVendors'));
    const sent = [], writes = [];
    let status = 'paid';
    const sandbox = { console, RX: { ORDER_ID: /#([A-Z0-9]{8})/ }, orderAutomation: { statusOf: async (_, chatId) => chatId === '44' ? status : 'unknown' },
        applyVariables: s => s, isBlacklisted: async () => false, sendReplyContent: async (...args) => sent.push(args), atomicUpdate: async fn => { const s = {}; fn(s); writes.push(s); } };
    vm.createContext(sandbox); vm.runInContext(handlers, sandbox);
    const msg = { messageText: 'Order #ABCD1234', chatId: '44' };
    const settings = { orderConfirmReplyEnabled: true, orderConfirmReplyText: 'Thanks', newOrderReplyEnabled: true, newOrderReplyText: 'Received' };
    await sandbox.handleOrderConfirmed(msg, {}, settings);
    assert.equal(sent.length, 0); assert.equal(writes.length, 0);
    status = 'closed'; await sandbox.handleOrderConfirmed({ ...msg, chatId: '45' }, {}, settings);
    assert.equal(sent.length, 0); assert.equal(writes.length, 0);
    await sandbox.handleOrderConfirmed(msg, {}, settings);
    assert.equal(sent.length, 1); assert.deepEqual(Array.from(writes[0].repliedConfirmedOrders), ['ABCD1234']);
    status = 'refunded'; await sandbox.handleOrderPurchased(msg, {}, settings); assert.equal(sent.length, 1);
    status = 'paid'; await sandbox.handleOrderPurchased(msg, {}, settings); assert.equal(sent.length, 2);
});

test('cookie snapshot swaps the whole session and restores it before a queued account switch or logout', async () => {
    const source = read('background/background.js');
    const code = source.slice(source.indexOf('let _fptSnapChain'), source.indexOf('// --- Сохранённые аккаунты и свой конфиг у каждого ---'));
    // FunPay cookie jar: PHPSESSID and golden_seal belong to the session of the original key.
    const jar = new Map([
        ['golden_key', { name: 'golden_key', value: 'original', hostOnly: true, domain: 'funpay.com', path: '/', secure: true, httpOnly: true, sameSite: 'strict', storeId: '0', expirationDate: 1234567890 }],
        ['PHPSESSID', { name: 'PHPSESSID', value: 'sess-a', hostOnly: false, domain: '.funpay.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax', storeId: '0', session: true }],
        ['golden_seal', { name: 'golden_seal', value: 'seal-a', hostOnly: false, domain: '.funpay.com', path: '/', secure: true, httpOnly: false, sameSite: 'lax', storeId: '0', expirationDate: 1999999999 }]
    ]);
    const value = name => jar.get(name)?.value;
    const calls = []; const seen = []; let release;
    const gate = new Promise(resolve => { release = resolve; });
    const sandbox = { Date, console, chrome: { cookies: {
        get: async ({ name }) => (jar.has(name) ? { ...jar.get(name) } : null),
        getAll: async ({ name }) => (jar.has(name) ? [{ ...jar.get(name) }] : []),
        set: async details => { calls.push(details); jar.set(details.name, { ...details, hostOnly: !details.domain }); return details; },
        remove: async ({ name }) => { jar.delete(name); }
    } }, fetch: async () => {
        await gate;
        seen.push({ key: value('golden_key'), sess: value('PHPSESSID'), seal: value('golden_seal') });
        jar.set('PHPSESSID', { name: 'PHPSESSID', value: 'sess-b', domain: '.funpay.com', path: '/', secure: true, session: true });
        return { text: async () => '' };
    }, parseHtmlViaOffscreen: async () => ({ loggedIn: false }) };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    const snapshot = sandbox.fptSnapshotForKey('temporary');
    const change = sandbox.withCookieLock(async () => {
        assert.equal(value('golden_key'), 'original');
        jar.set('golden_key', { name: 'golden_key', value: 'selected' });
    });
    await Promise.resolve(); release(); await snapshot;
    assert.deepEqual(seen, [{ key: 'temporary', sess: undefined, seal: undefined }], 'the other key never meets the current session');
    const key = calls.find(details => details.name === 'golden_key' && details.value === 'original');
    assert.equal(key.httpOnly, true); assert.equal(key.domain, undefined);
    assert.equal(key.expirationDate, 1234567890); assert.equal(key.sameSite, 'strict');
    assert.equal(value('PHPSESSID'), 'sess-a'); assert.equal(value('golden_seal'), 'seal-a');
    assert.equal(calls.find(details => details.name === 'PHPSESSID').expirationDate, undefined, 'session cookie stays a session cookie');
    await change;
    assert.equal(value('golden_key'), 'selected');
    await assert.rejects(sandbox.withCookieLock(async () => { throw Error('failure'); }));
    await sandbox.withCookieLock(async () => { jar.clear(); }); assert.equal(jar.size, 0);
    const logout = source.indexOf("if (request.action === 'deleteCookiesAndReload')");
    assert.match(source.slice(logout, source.indexOf('return true;', logout)), /withCookieLock/);
    // Account switches run inside the same queue: the service receives it as cookieLock.
    assert.match(source, /cookieLock: withCookieLock/);
});

test('retired profile descriptions cannot create, verify, delete lots or contact their server', () => {
    const forbidden = () => assert.fail('retired profile service ran');
    vm.runInNewContext(read('content/features/profile_descriptions.js'), {
        fetch: forbidden, setTimeout: forbidden, setInterval: forbidden,
        document: new Proxy({}, { get: forbidden }), chrome: new Proxy({}, { get: forbidden })
    });
    assert.doesNotMatch(read('content/features/profile_descriptions.js'), /SHARED_KEY|workers\.dev|createVerificationLot|sweepPendingLots/);
});
