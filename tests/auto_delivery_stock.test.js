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
            isAutoDeliveryLotEnabled(config) { return config?.enabled !== false; }
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

test('unknown inventory never triggers automatic restoration or deactivation', async () => {
    const messages = [];
    const sandbox = {
        console,
        URLSearchParams,
        fetch: async () => ({ ok: true, async text() { return '<profile />'; }, async json() { return { error: 0 }; } }),
        document: { body: { dataset: { appData: JSON.stringify([{ userId: 'qa-user', 'csrf-token': 'csrf' }]) } } },
        DOMParser: class { parseFromString() { return { querySelector() {
            return { style: {}, closest() { return { classList: { contains() { return true; } } }; } };
        } }; } },
        chrome: {
            storage: { local: { async get(keys) { return {
                fpToolsAutoRestoreEnabled: true,
                fpToolsAutoDisableEnabled: true,
                fpToolsAutoDeliveryLots: { '501': { enabled: true, productCount: null } }
            }; } } },
            runtime: {
                onMessage: { addListener() {} },
                async sendMessage(message, callback) {
                    messages.push(message);
                    const result = message.action === 'getUserLotsList'
                        ? [{ id: '501', nodeId: '42', title: 'Лот' }]
                        : { success: true, data: { secrets: '' } };
                    callback?.(result);
                    return result;
                }
            }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../content/features/auto_restore_lots.js'), 'utf8'), sandbox);

    await sandbox.checkAndRestoreLots();

    assert.deepEqual(messages.map(message => message.action), ['getUserLotsList']);
});
