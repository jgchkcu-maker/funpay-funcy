const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const responderUrl = pathToFileURL(path.join(__dirname, '../background/autoresponder.js')).href;

test('auto-delivery stock utilities count non-empty secret rows and preserve concurrent lot updates', async () => {
    const utilities = await import(responderUrl);
    assert.equal(typeof utilities.countAutoDeliverySecrets, 'function');
    assert.equal(typeof utilities.createAutoDeliveryStore, 'function');

    assert.equal(utilities.countAutoDeliverySecrets('alpha\r\nbeta\r\n'), 2);
    assert.equal(utilities.countAutoDeliverySecrets(' \n\r\n '), 0);
    assert.equal(utilities.countAutoDeliverySecrets(null), null);

    const saved = { fpToolsAutoDeliveryLots: {
        '501': { enabled: true, text: 'keep template', productCount: 2 },
        '502': { mode: 'template', text: 'custom' },
        '503': { enabled: true, mode: 'secrets', productCount: 7 }
    } };
    const storage = {
        async get(key) { return structuredClone({ [key]: saved[key] }); },
        async set(patch) { Object.assign(saved, structuredClone(patch)); }
    };
    const store = utilities.createAutoDeliveryStore(storage, async lot => {
        if (lot.id === '503') throw new Error('FunPay unavailable');
        if (lot.id === '504') return {};
        if (lot.id === '505') return { offer_id: '505' };
        return { secrets: lot.id === '501' ? 'one\ntwo\nthree' : '' };
    });

    const [savedLot, syncResult] = await Promise.all([
        store.patchLot('501', { mode: 'secrets' }),
        store.syncLots([
            { id: '501', nodeId: '42' },
            { id: '502', nodeId: '43' },
            { id: '503', nodeId: '44' },
            { id: '504', nodeId: '45' },
            { id: '505', nodeId: '46' }
        ])
    ]);

    assert.equal(savedLot.text, 'keep template');
    assert.deepEqual(syncResult.counts, { '501': 3, '502': null, '505': 0 });
    assert.deepEqual(new Set(syncResult.errors.map(item => item.lotId)), new Set(['503', '504']));
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].enabled, true);
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].productCount, 3);
    assert.equal(saved.fpToolsAutoDeliveryLots['502'].productCount, null);
    assert.equal(saved.fpToolsAutoDeliveryLots['503'].productCount, 7, 'a failed stock read must preserve the last known count');
    assert.equal(saved.fpToolsAutoDeliveryLots['504'], undefined, 'unreadable stock must not configure unrelated lots');
    assert.equal(JSON.stringify(saved).includes('alpha'), false);

    const storeApi = await import(pathToFileURL(path.join(__dirname, '../background/auto_delivery_store.js')).href);
    storeApi.configureAutoDeliveryStore(storage, async () => ({ secrets: '' }));
    await storeApi.saveAutoDeliveryLot('501', { enabled: false, mode: 'secrets', text: '', productCount: 1 });
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].productCount, 3, 'saving an older row must preserve a newer stock sync');
    await storeApi.saveAutoDeliveryLot('504', { enabled: true, mode: 'secrets', text: '', productCount: 5 });
    assert.equal(saved.fpToolsAutoDeliveryLots['504'].productCount, 5, 'a newly configured lot keeps the manually loaded count');
    await storeApi.saveAutoDeliveryLot('501', { enabled: true, mode: 'template', text: 'Ваш шаблон', productCount: null });
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].productCount, null);
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].stockSnapshot, 3, 'switching to a template keeps the last stock count for later');
    await storeApi.saveAutoDeliveryLot('501', { enabled: true, mode: 'secrets', text: '', productCount: null });
    assert.equal(saved.fpToolsAutoDeliveryLots['501'].productCount, 3, 'returning to secrets restores the preserved count');
    await assert.rejects(
        () => storeApi.saveAutoDeliveryLot('505', { enabled: true, mode: 'template', text: '  ', productCount: null }),
        /Введите текст выдачи/
    );
    assert.equal(saved.fpToolsAutoDeliveryLots['505'], undefined, 'empty templates must never be stored');
});

test('auto-delivery lot switch gates new delivery while legacy settings remain allowed', async () => {
    const utilities = await import(responderUrl);
    assert.equal(typeof utilities.isAutoDeliveryLotEnabled, 'function');
    assert.equal(utilities.isAutoDeliveryLotEnabled({ enabled: false }), false);
    assert.equal(utilities.isAutoDeliveryLotEnabled({ enabled: true }), true);
    assert.equal(utilities.isAutoDeliveryLotEnabled({ mode: 'secrets' }), true);
    assert.equal(utilities.isAutoDeliveryLotEnabled(null), true);
});

test('secret stock refresh follows a successful delivery and respects explicit lot disablement', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../background/autoresponder.js'), 'utf8')
        .replace(/^import .*;\s*$/gm, '')
        .replace(/^export .*;\s*$/gm, '')
        .replace(/^export (?=(?:async )?(?:function|const|let|class))/gm, '')
        + '\nglobalThis.__handleAutoDelivery = handleAutoDelivery;';

    const { createOrderDetailsLoader } = await import(pathToFileURL(path.join(__dirname, '../background/order_details.js')).href);

    async function deliver({ config, runnerStatus = 200 }) {
        const stored = {
            fpToolsAutoDeliveryLots: { '501': config },
            fpToolsBlacklist: []
        };
        const fetched = [];
        const stockRefreshes = [];
        const sandbox = {
            URLSearchParams,
            console: { log() {}, warn() {}, error() {} },
            fetch: async url => {
                fetched.push(String(url));
                if (String(url).includes('/orders/')) return {
                    ok: true, status: 200, async text() { return '<order />'; }
                };
                if (String(url).includes('/runner/')) return {
                    ok: runnerStatus >= 200 && runnerStatus < 300,
                    status: runnerStatus,
                    async json() { return {}; }
                };
                throw new Error(`Unexpected fetch: ${url}`);
            },
            chrome: {
                storage: { local: { async get(key) { return { [key]: stored[key] }; } } },
                runtime: {
                    async getContexts() { return [{}]; },
                    getURL(path) { return path; },
                    async sendMessage(message) {
                        assert.equal(message.target, 'offscreen');
                        return { secrets: 'qa-secret', lotId: '501', nodeId: '42', buyerChatId: 'chat-9' };
                    }
                },
                offscreen: { async createDocument() {} }
            },
            async updateAutoReplies(update) { update(stored); },
            async refreshAutoDeliveryLotStock(...args) { stockRefreshes.push(args); },
            isAutoDeliveryLotEnabled(config) { return config?.enabled !== false; },
            createOrderDetailsLoader
        };
        vm.createContext(sandbox);
        vm.runInContext(source, sandbox);
        await sandbox.__handleAutoDelivery(
            { messageText: 'Пользователь оплатил заказ #ABCD1234', buyerName: 'QA покупатель', chatId: 'chat-9' },
            { golden_key: 'qa-key', phpsessid: 'qa-session', csrf_token: 'qa-csrf' },
            { autoDeliveryEnabled: true }
        );
        return { fetched, stockRefreshes, delivered: stored.deliveredOrderIds || [] };
    }

    const success = await deliver({ config: { enabled: true, mode: 'secrets' } });
    assert.deepEqual(success.stockRefreshes, [['501', '42']]);
    assert.deepEqual(Array.from(success.delivered), ['ABCD1234']);

    const disabled = await deliver({ config: { enabled: false, mode: 'secrets' } });
    assert.ok(disabled.fetched.every(url => !url.includes('/runner/')), 'disabled lot must not send an order message');
    assert.deepEqual(disabled.stockRefreshes, []);

    const legacy = await deliver({ config: { mode: 'secrets' } });
    assert.deepEqual(legacy.stockRefreshes, [['501', '42']], 'missing enabled remains compatible with prior settings');

    const failedSend = await deliver({ config: { enabled: true, mode: 'secrets' }, runnerStatus: 400 });
    assert.deepEqual(failedSend.stockRefreshes, [], 'failed delivery must not refresh stock');
    assert.deepEqual(failedSend.delivered, []);
});

test('the page only announces availability changes; toggling lives in the background sweep', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../content/features/auto_restore_lots.js'), 'utf8');
    assert.doesNotMatch(source, /offerSave|fetch\(/, 'the content script must not edit lots any more');

    let listener = null;
    const shown = [];
    const sandbox = {
        chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
        showNotification: (message, isError) => shown.push([message, isError])
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    listener({ action: 'fpToolsLotAvailabilityChanged', offerId: '501', title: 'Ключ', active: false });
    listener({ action: 'fpToolsLotAvailabilityChanged', offerId: '502', active: true });
    listener({ action: 'somethingElse' });
    assert.deepEqual(shown, [
        ['Лот "Ключ" деактивирован: товары закончились', false],
        ['Лот "Лот #502" восстановлен: товары пополнены', false]
    ]);

    const background = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
    assert.match(background, /jobScheduler\.register\(AUTO_RESTORE_ALARM_NAME, \(\) => lotAvailability\.sweep\(\)\)/);
    assert.doesNotMatch(background, /fpToolsCheckRestoreLots/);
});

test('a delivery is journaled before sending: repeats are skipped and unclear sends become uncertain', async () => {
    const { createOpsJournal, createMemoryBackend } = await import(pathToFileURL(path.join(__dirname, '../background/ops_db.js')).href);
    const { createOrderDetailsLoader } = await import(pathToFileURL(path.join(__dirname, '../background/order_details.js')).href);
    const source = fs.readFileSync(path.join(__dirname, '../background/autoresponder.js'), 'utf8')
        .replace(/^import .*;\s*$/gm, '')
        .replace(/^export \{.*;\s*$/gm, '')
        .replace(/^export (?=(?:async )?(?:function|const|let|class))/gm, '')
        + '\nglobalThis.__handleAutoDelivery = handleAutoDelivery; globalThis.__configureOrderJournal = configureOrderJournal;';

    function responder({ runner }) {
        const stored = { fpToolsAutoDeliveryLots: { '501': { enabled: true, mode: 'secrets' } }, fpToolsBlacklist: [] };
        const sends = [];
        const sandbox = {
            URLSearchParams,
            setTimeout: (fn) => fn(),
            console: { log() {}, warn() {}, error() {} },
            fetch: async (url, options) => {
                if (String(url).includes('/orders/')) return { ok: true, status: 200, async text() { return '<order />'; } };
                if (String(url).includes('/runner/')) { sends.push(options.body.toString()); return runner(); }
                throw new Error(`Unexpected fetch: ${url}`);
            },
            chrome: {
                storage: { local: { async get(key) { return { [key]: stored[key] }; } } },
                runtime: {
                    async getContexts() { return [{}]; },
                    getURL(p) { return p; },
                    async sendMessage() { return { secrets: 'qa-secret', lotId: '501', nodeId: '42', buyerChatId: 'chat-9' }; }
                },
                offscreen: { async createDocument() {} }
            },
            async updateAutoReplies(update) { update(stored); },
            async refreshAutoDeliveryLotStock() {},
            isAutoDeliveryLotEnabled(config) { return config?.enabled !== false; },
            createOrderDetailsLoader
        };
        vm.createContext(sandbox);
        vm.runInContext(source, sandbox);
        return { sandbox, sends, stored };
    }

    const msg = { messageText: 'Пользователь оплатил заказ #ABCD1234', buyerName: 'QA', chatId: 'chat-9' };
    const auth = { golden_key: 'k', phpsessid: 's', csrf_token: 'c' };

    // Network failure after retries: the message may have reached FunPay.
    const backend = createMemoryBackend();
    const firstWorker = createOpsJournal({ backend, instanceId: 'sw-1' });
    const flaky = responder({ runner: async () => { throw new TypeError('Failed to fetch'); } });
    flaky.sandbox.__configureOrderJournal(firstWorker);
    await flaky.sandbox.__handleAutoDelivery(msg, auth, { autoDeliveryEnabled: true });
    assert.equal((await firstWorker.getOp('delivery:ABCD1234')).state, 'uncertain');
    assert.deepEqual(flaky.stored.deliveredOrderIds, undefined);
    assert.equal((await firstWorker.getOrder('ABCD1234')).lotId, '501', 'the order is journaled with its lot');

    // The same order seen again (chat repeat, reconcile, restart) is not resent.
    const ok = responder({ runner: async () => ({ ok: true, status: 200, async json() { return {}; } }) });
    ok.sandbox.__configureOrderJournal(createOpsJournal({ backend, instanceId: 'sw-2' }));
    await ok.sandbox.__handleAutoDelivery(msg, auth, { autoDeliveryEnabled: true });
    assert.equal(ok.sends.length, 0, 'an uncertain delivery is never retried automatically');

    // A definite refusal from FunPay is retried on the next event and then completes.
    const refusedBackend = createMemoryBackend();
    const refused = responder({ runner: async () => ({ ok: false, status: 400, async json() { return {}; } }) });
    refused.sandbox.__configureOrderJournal(createOpsJournal({ backend: refusedBackend, instanceId: 'sw-1' }));
    await refused.sandbox.__handleAutoDelivery(msg, auth, { autoDeliveryEnabled: true });
    const journal = createOpsJournal({ backend: refusedBackend, instanceId: 'sw-2' });
    assert.equal((await journal.getOp('delivery:ABCD1234')).state, 'failed');

    const retry = responder({ runner: async () => ({ ok: true, status: 200, async json() { return {}; } }) });
    retry.sandbox.__configureOrderJournal(journal);
    await retry.sandbox.__handleAutoDelivery(msg, auth, { autoDeliveryEnabled: true });
    await retry.sandbox.__handleAutoDelivery(msg, auth, { autoDeliveryEnabled: true });
    assert.equal(retry.sends.length, 1, 'delivered exactly once');
    const op = await journal.getOp('delivery:ABCD1234');
    assert.equal(op.state, 'done');
    assert.equal(op.attempts, 2);
});
