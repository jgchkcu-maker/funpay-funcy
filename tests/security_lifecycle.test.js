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

test('cookie snapshot restores attributes before a queued account switch or logout', async () => {
    const source = read('background/background.js');
    const code = source.slice(source.indexOf('let _fptSnapChain'), source.indexOf('// --- Главный обработчик сообщений ---'));
    let current = { value: 'original', hostOnly: true, domain: 'funpay.com', path: '/', secure: true, sameSite: 'strict', storeId: '0', expirationDate: 1234567890 };
    const calls = []; let release;
    const gate = new Promise(resolve => { release = resolve; });
    const sandbox = { Date, console, chrome: { cookies: {
        get: async () => ({ ...current }), set: async details => { calls.push(details); current = details; return details; }, remove: async () => { current = null; }
    } }, fetch: async () => { await gate; return { text: async () => '' }; }, parseHtmlViaOffscreen: async () => ({ loggedIn: false }) };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    const snapshot = sandbox.fptSnapshotForKey('temporary');
    const change = sandbox.withCookieLock(async () => { assert.equal(current.value, 'original'); current = { value: 'selected' }; });
    await Promise.resolve(); release(); await snapshot; await change;
    assert.equal(current.value, 'selected');
    assert.equal(calls[0].httpOnly, true); assert.equal(calls[1].httpOnly, true);
    assert.equal(calls[0].domain, undefined); assert.equal(calls[1].domain, undefined);
    assert.equal(calls[1].expirationDate, 1234567890); assert.equal(calls[1].sameSite, 'strict');
    await assert.rejects(sandbox.withCookieLock(async () => { throw Error('failure'); }));
    await sandbox.withCookieLock(async () => { current = null; }); assert.equal(current, null);
    for (const action of ['setGoldenKey', 'deleteCookiesAndReload']) {
        assert.match(source.slice(source.indexOf(`if (request.action === '${action}')`), source.indexOf('return true;', source.indexOf(`if (request.action === '${action}')`))), /withCookieLock/);
    }
});

test('verification sweep never deletes ordinary lots, old unowned records, or another account', async () => {
    const source = read('content/features/profile_descriptions.js');
    const code = source.slice(source.indexOf('  async function trackPendingLot'), source.indexOf('  async function pollConfirm'));
    const pending = { 11: { at: Date.now(), accountId: 1 }, 12: { at: Date.now(), accountId: 1 }, 13: { at: Date.now(), accountId: 2 }, 14: Date.now() - 8 * 86400000 };
    const deleted = [], fetched = [];
    const sandbox = { console, Date, PENDING_LOTS_KEY: 'pending', VERIFY_TITLE: 'FPT Verify',
        getMyUserId: () => 1, getCsrf: () => 'csrf', storageGet: async () => ({ pending }), storageSet: async () => {},
        fetch: async url => { fetched.push(url); return { ok: true, text: async () => url.includes('11') ? 'Ordinary lot' : 'FPT Verify CODE' }; },
        DOMParser: class { parseFromString(title) { return { querySelector: () => ({ value: title }) }; } },
        deleteVerificationLot: async id => deleted.push(id) };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    await sandbox.sweepPendingLots();
    assert.deepEqual(deleted, ['12']); assert.deepEqual(Object.keys(pending), ['13']);
    assert.equal(fetched.length, 2);
    await sandbox.trackPendingLot('15', 'CODE_15'); assert.equal(pending['15'].accountId, 1); assert.equal(pending['15'].code, 'CODE_15');
});

test('verification code identifies titleless lots exactly and never falls back to a title on mismatch', async () => {
    const source = read('content/features/profile_descriptions.js');
    const code = source.slice(source.indexOf('  async function trackPendingLot'), source.indexOf('  async function pollConfirm'));
    const pending = Object.fromEntries(['21', '22', '23', '24', '25', '26'].map(id => [id, { at: Date.now(), accountId: 1, code: 'CHALLENGE_' + id }]));
    const forms = {
        21: { 'fields[desc][ru]': 'CHALLENGE_21' },
        22: { 'fields[desc][en]': ' CHALLENGE_22 ' },
        23: { 'fields[desc][ru]': 'ordinary lot with CHALLENGE_23 mentioned' },
        24: { 'fields[summary][ru]': 'FPT Verify', 'fields[desc][ru]': 'WRONG' },
        25: { 'fields[summary][ru]': 'FPT Verify' },
        26: { 'fields[desc][ru]': 'CHALLENGE_26', switchAccount: true }
    };
    const deleted = []; let accountId = 1;
    const sandbox = { console, Date, PENDING_LOTS_KEY: 'pending', VERIFY_TITLE: 'FPT Verify',
        getMyUserId: () => accountId, getCsrf: () => 'csrf', storageGet: async () => ({ pending }), storageSet: async () => {},
        fetch: async url => ({ ok: true, text: async () => JSON.stringify(forms[url.match(/offer=(\d+)/)[1]]) }),
        DOMParser: class { parseFromString(json) { const fields = JSON.parse(json); if (fields.switchAccount) accountId = 2;
            return { querySelector: selector => { const name = selector.match(/name="([^"]+)"/)[1]; return name in fields ? { value: fields[name] } : null; } }; } },
        deleteVerificationLot: async id => deleted.push(id) };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    await sandbox.sweepPendingLots();
    assert.deepEqual(deleted, ['21', '22']); assert.deepEqual(Object.keys(pending), ['26']);
    accountId = 1;
    await assert.rejects(sandbox.trackPendingLot('27', ''), /VERIFY_CODE_MISSING/);
    assert.equal(pending['27'], undefined);
});

test('verification fallback finds a titleless lot only by its exact description code', async () => {
    const source = read('content/features/profile_descriptions.js');
    const find = source.slice(source.indexOf('  async function findLotByCode'), source.indexOf('  async function createVerificationLot'));
    const match = source.slice(source.indexOf('  function verificationLotMatches'), source.indexOf('  // Удаляет лот с несколькими попытками'));
    const requested = [];
    const sandbox = { VERIFY_NODE_ID: '2046', VERIFY_TITLE: 'FPT Verify',
        fetch: async url => { requested.push(url); return { ok: true, text: async () => url.endsWith('/trade') ? 'list' : url.endsWith('=32') ? 'correct' : 'wrong' }; },
        DOMParser: class { parseFromString(body) {
            if (body === 'list') return { querySelectorAll: () => [...Array.from({ length: 12 }, (_, i) => String(40 + i)), '31', '32', '32'].map(id => ({ getAttribute: () => id })) };
            return { querySelector: selector => selector.includes('fields[desc][en]') ? { value: body === 'correct' ? 'CODE' : 'mentions CODE' } : null };
        } } };
    vm.createContext(sandbox); vm.runInContext(match + find, sandbox);
    assert.equal(await sandbox.findLotByCode('CODE'), 32);
    assert.equal(requested.length, 15); assert.ok(requested[13].includes('offerEdit?offer=31'));
});
