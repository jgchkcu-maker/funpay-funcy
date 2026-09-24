const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const STORE_PATH = path.join(ROOT, 'background', 'auto_reply_store.js');

const storeModulePromise = import(pathToFileURL(STORE_PATH).href).catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
});

function createStorage(initial = {}, { beforeSet } = {}) {
    const state = structuredClone(initial);
    const metrics = { activeGets: 0, maxActiveGets: 0, writes: 0 };
    return {
        state,
        metrics,
        async get(key) {
            metrics.activeGets++;
            metrics.maxActiveGets = Math.max(metrics.maxActiveGets, metrics.activeGets);
            await new Promise(resolve => setTimeout(resolve, 2));
            const result = { [key]: structuredClone(state[key] || {}) };
            metrics.activeGets--;
            return result;
        },
        async set(values) {
            metrics.writes++;
            if (beforeSet) await beforeSet(structuredClone(values), metrics.writes);
            Object.assign(state, structuredClone(values));
        }
    };
}

async function makeStore(initial, options) {
    const storeModule = await storeModulePromise;
    assert.equal(typeof storeModule?.createAutoReplyStore, 'function',
        'background/auto_reply_store.js must export createAutoReplyStore(storage)');
    const storage = createStorage({ fpToolsAutoReplies: initial }, options);
    return { store: storeModule.createAutoReplyStore(storage), storage };
}

test('serializes UI patches and background updates against the latest saved object', async () => {
    const { store, storage } = await makeStore({
        greetingText: 'old',
        reviewTemplates: { '1': 'one', '2': 'two' },
        lastSeenMsgIds: { chatA: 4 },
        privateFutureField: { kept: true }
    });

    await Promise.all([
        store.patchAutoReplies({ set: { greetingText: 'new' } }),
        store.updateAutoReplies(current => {
            current.lastSeenMsgIds.chatB = 9;
        }),
        store.patchAutoReplies({ merge: { reviewTemplates: { '5': 'thanks' } } })
    ]);

    assert.deepEqual(storage.state.fpToolsAutoReplies, {
        greetingText: 'new',
        reviewTemplates: { '1': 'one', '2': 'two', '5': 'thanks' },
        lastSeenMsgIds: { chatA: 4, chatB: 9 },
        privateFutureField: { kept: true }
    });
    assert.equal(storage.metrics.maxActiveGets, 1, 'storage reads should run one at a time');
});

test('patch replaces fields, merges rating maps, and can unset map entries', async () => {
    const { store, storage } = await makeStore({
        greetingText: 'old greeting',
        reviewTemplates: { '1': 'one', '4': 'four', '5': 'old five' },
        reviewTemplateImages: { '4': ['four.png'], '5': ['old.png'] },
        reviewRequestTemplate: 'remove me',
        randomBonuses: ['one']
    });

    await store.patchAutoReplies({
        set: { greetingText: 'replacement' },
        merge: {
            reviewTemplates: { '5': 'new five' },
            reviewTemplateImages: { '5': ['new.png'] }
        },
        arrayOps: { randomBonuses: [{ op: 'append', value: 'two' }] },
        unset: { fields: ['reviewRequestTemplate'], reviewTemplateImages: ['4'] }
    });

    assert.deepEqual(storage.state.fpToolsAutoReplies, {
        greetingText: 'replacement',
        reviewTemplates: { '1': 'one', '4': 'four', '5': 'new five' },
        reviewTemplateImages: { '5': ['new.png'] },
        randomBonuses: ['one', 'two']
    });
});

test('parallel list additions, edits, and removals preserve every current item', async () => {
    const first = { keyword: 'first', response: 'one', matchMode: 'exact' };
    const second = { keyword: 'second', response: 'two', matchMode: 'contains' };
    const editedSecond = { keyword: 'second', response: 'updated', matchMode: 'contains' };
    const third = { keyword: 'third', response: 'three', matchMode: 'exact' };
    const { store, storage } = await makeStore({ keywords: [first, second] });

    await Promise.all([
        store.patchAutoReplies({ arrayOps: { keywords: [{ op: 'append', value: third }] } }),
        store.patchAutoReplies({ arrayOps: { keywords: [{ op: 'upsert', index: 1, expected: second, value: editedSecond }] } }),
        store.patchAutoReplies({ arrayOps: { keywords: [{ op: 'remove', index: 0, expected: first }] } })
    ]);

    assert.deepEqual(storage.state.fpToolsAutoReplies.keywords, [editedSecond, third]);
});

test('rejects a stale index edit instead of deleting the item that shifted into its place', async () => {
    const first = { keyword: 'first', response: 'one', matchMode: 'exact' };
    const second = { keyword: 'second', response: 'two', matchMode: 'exact' };
    const third = { keyword: 'third', response: 'three', matchMode: 'exact' };
    const { store, storage } = await makeStore({ keywords: [first, second, third] });

    const results = await Promise.allSettled([
        store.patchAutoReplies({ arrayOps: { keywords: [{ op: 'remove', index: 1, expected: second }] } }),
        store.patchAutoReplies({ arrayOps: { keywords: [{ op: 'remove', index: 1, expected: second }] } })
    ]);

    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.code, 'STALE_AUTO_REPLY_EDIT');
    assert.deepEqual(storage.state.fpToolsAutoReplies.keywords, [first, third]);
});

test('imports user preferences while preserving local runtime markers and fields omitted by old backups', async () => {
    const { store, storage } = await makeStore({
        greetingText: 'local text',
        reviewRequestTemplate: 'local request',
        reviewTemplates: { '1': 'local one', '4': 'local four', '5': 'local five' },
        reviewTemplateImages: { '4': ['local-four.png'] },
        futurePreference: { enabled: true },
        processedMessageIds: ['local-id'],
        lastSeenMsgIds: { chatLocal: 30 },
        lastHandledText: { chatLocal: 'local marker' },
        autoResponderSeeded: true,
        greetedUsers: ['local-chat'],
        greetedTimestamps: { 'local-chat': 100 },
        repliedOrderIds: ['local-order'],
        repliedNewOrders: ['local-new-order'],
        repliedConfirmedOrders: ['local-confirmed-order'],
        deliveredOrderIds: ['local-delivery']
    });

    await store.importAutoReplies({
        greetingText: 'backup text',
        reviewTemplates: { '5': 'backup five' },
        reviewTemplateImages: { '5': ['backup-five.png'] },
        futureBackupField: 'import this unknown preference',
        processedMessageIds: ['remote-id'],
        lastSeenMsgIds: { remote: 1 },
        lastHandledText: { remote: 'remote marker' },
        autoResponderSeeded: false,
        greetedUsers: ['remote-chat'],
        greetedTimestamps: { remote: 1 },
        repliedOrderIds: ['remote-order'],
        repliedNewOrders: ['remote-new-order'],
        repliedConfirmedOrders: ['remote-confirmed-order'],
        deliveredOrderIds: ['remote-delivery']
    });

    assert.deepEqual(storage.state.fpToolsAutoReplies, {
        greetingText: 'backup text',
        reviewRequestTemplate: 'local request',
        reviewTemplates: { '1': 'local one', '4': 'local four', '5': 'backup five' },
        reviewTemplateImages: { '4': ['local-four.png'], '5': ['backup-five.png'] },
        futurePreference: { enabled: true },
        futureBackupField: 'import this unknown preference',
        processedMessageIds: ['local-id'],
        lastSeenMsgIds: { chatLocal: 30 },
        lastHandledText: { chatLocal: 'local marker' },
        autoResponderSeeded: true,
        greetedUsers: ['local-chat'],
        greetedTimestamps: { 'local-chat': 100 },
        repliedOrderIds: ['local-order'],
        repliedNewOrders: ['local-new-order'],
        repliedConfirmedOrders: ['local-confirmed-order'],
        deliveredOrderIds: ['local-delivery']
    });
});

test('a failed storage write rejects its caller and does not poison later queue operations', async () => {
    let failNextWrite = true;
    const { store, storage } = await makeStore({ greetingText: 'before' }, {
        beforeSet: async () => {
            if (failNextWrite) {
                failNextWrite = false;
                throw new Error('storage unavailable');
            }
        }
    });

    await assert.rejects(store.patchAutoReplies({ set: { greetingText: 'failed' } }), /storage unavailable/);
    await store.patchAutoReplies({ set: { greetingText: 'saved after recovery' } });

    assert.equal(storage.state.fpToolsAutoReplies.greetingText, 'saved after recovery');
});

test('repository code outside the store does not write fpToolsAutoReplies directly', () => {
    const sourceDirs = ['background', 'content', 'popup', 'offscreen'];
    const directWriter = /chrome\.storage\.local\.set\s*\(\s*\{[^;]*\bfpToolsAutoReplies\b/s;
    const violations = [];

    for (const relativeDir of sourceDirs) {
        const dir = path.join(ROOT, relativeDir);
        const stack = [dir];
        while (stack.length) {
            const current = stack.pop();
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const absolute = path.join(current, entry.name);
                if (entry.isDirectory()) stack.push(absolute);
                else if (entry.isFile() && entry.name.endsWith('.js')) {
                    if (path.resolve(absolute) === path.resolve(STORE_PATH)) continue;
                    const source = fs.readFileSync(absolute, 'utf8');
                    if (directWriter.test(source)) violations.push(path.relative(ROOT, absolute));
                }
            }
        }
    }

    assert.deepEqual(violations, []);

    const settingsIo = fs.readFileSync(path.join(ROOT, 'content', 'features', 'settings_io.js'), 'utf8');
    assert.match(settingsIo, /k === 'fpToolsAutoReplies'[\s\S]*?hasAutoRepliesToImport = true;[\s\S]*?continue;/,
        '.fpconfig import must remove auto-reply data from the generic storage write');
    assert.match(settingsIo, /await window\.fptImportAutoReplies\(autoRepliesToImport\)/,
        '.fpconfig import must pass auto-reply data through the service-worker queue');

    const settingsLoader = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'settings_loader.js'), 'utf8');
    assert.match(settingsLoader, /'fpToolsAutoReplies'\s*\]\)/,
        'settings initialization must fetch the complete saved auto-reply object');
    assert.match(settingsLoader, /await initializeAutoReviewUI\(settings\.fpToolsAutoReplies\s*\|\|\s*\{\}\)/,
        'review controls must finish initializing from that complete object');
    assert.match(settingsLoader, /window\.__fptAutoReplySettingsReady\s*=\s*false/);
    assert.match(settingsLoader, /window\.__fptAutoReplySettingsReady\s*=\s*true/);
});

test('content helper waits for the service-worker write and reports storage errors', async () => {
    const helperSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_reply_store.js'), 'utf8');
    const messages = [];
    let nextResponse = { ok: true, autoReplies: { greetingText: 'saved' } };
    const context = vm.createContext({
        window: {},
        chrome: { runtime: { sendMessage: async message => { messages.push(message); return nextResponse; } } },
        Error
    });
    vm.runInContext(helperSource, context, { filename: 'content/features/auto_reply_store.js' });

    const patchPromise = context.window.fptPatchAutoReplies({ set: { greetingText: 'saved' } });
    assert.deepEqual(await patchPromise, { greetingText: 'saved' });
    assert.deepEqual(JSON.parse(JSON.stringify(messages[0])), {
        action: 'fptPatchAutoReplies',
        patch: { set: { greetingText: 'saved' } }
    });

    nextResponse = { ok: false, code: 'STALE_AUTO_REPLY_EDIT', error: 'Reload the list.' };
    await assert.rejects(context.window.fptPatchAutoReplies({}), error => {
        assert.equal(error.code, 'STALE_AUTO_REPLY_EDIT');
        assert.equal(error.message, 'Reload the list.');
        return true;
    });
});

test('split auto-reply pages initialize once from the complete saved object before autosave handlers can race', async () => {
    const reviewPage = { dataset: { page: 'auto_review' }, listeners: {}, addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); } };
    const replyPage = { dataset: { page: 'auto_reply' }, listeners: {}, addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); } };
    const elements = new Map();
    const getElement = id => {
        if (!elements.has(id)) {
            elements.set(id, {
                id, value: '', checked: false, dataset: {}, style: {}, textContent: '',
                listeners: {},
                addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); },
                focus() {}, scrollIntoView() {},
                classList: { add() {}, remove() {}, contains() { return false; } },
                set innerHTML(value) { this._innerHTML = value; },
                get innerHTML() { return this._innerHTML || ''; }
            });
        }
        return elements.get(id);
    };
    const radios = [
        { name: 'bonusMode', value: 'single', checked: false, addEventListener() {} },
        { name: 'bonusMode', value: 'random', checked: false, addEventListener() {} }
    ];
    const exactMode = { value: 'exact', checked: true };
    const document = {
        getElementById: getElement,
        querySelector(selector) {
            if (selector === '.fp-tools-page-content[data-page="auto_review"]') return reviewPage;
            if (selector === '.fp-tools-page-content[data-page="auto_reply"]') return replyPage;
            if (selector === 'input[name="bonusMode"]:checked') return radios.find(radio => radio.checked) || null;
            if (selector.startsWith('input[name="bonusMode"][value="')) {
                const value = selector.includes('[value="random"]') ? 'random' : 'single';
                return radios.find(radio => radio.value === value) || null;
            }
            if (selector.startsWith('input[name="newKeywordMatchMode"]')) return exactMode;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === 'input[name="bonusMode"]') return radios;
            return [];
        }
    };
    const context = vm.createContext({
        document,
        window: {},
        chrome: { storage: { local: { async get() { throw new Error('initializer must use its saved snapshot'); } } } },
        console,
        Promise,
        JSON,
        Math,
        Array,
        showNotification() {}
    });
    const source = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_review.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'content/features/auto_review.js' });
    const saved = {
        autoReviewEnabled: true,
        reviewTemplates: { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five' },
        greetingEnabled: true,
        greetingText: 'saved greeting',
        onlyNewChats: true,
        ignoreSystemMessages: true,
        greetingCooldownDays: 7,
        keywordsEnabled: true,
        keywords: [{ keyword: 'term', response: 'reply', matchMode: 'contains' }],
        bonusForReviewEnabled: true,
        bonusMode: 'random',
        singleBonusText: 'single gift',
        randomBonuses: ['first gift', 'second gift'],
        bonusForReviewDelaySec: 13,
        newOrderReplyEnabled: true,
        newOrderReplyText: 'new order',
        orderConfirmReplyEnabled: true,
        orderConfirmReplyText: 'confirmed order',
        typingDelay: true
    };

    const replyInit = context.initializeAutoReplyUI(saved);
    const concurrentReplyInit = context.initializeAutoReplyUI({ greetingText: 'should not replace saved value' });
    const reviewInit = context.initializeAutoReviewUI(saved);
    const concurrentReviewInit = context.initializeAutoReviewUI({ reviewTemplates: { '5': 'should not replace saved value' } });
    assert.equal(replyInit, concurrentReplyInit, 'auto_reply calls before initialization completes share one promise');
    assert.equal(reviewInit, concurrentReviewInit, 'auto_review calls before initialization completes share one promise');
    await Promise.all([replyInit, reviewInit]);
    await context.initializeAutoReplyUI({ greetingText: 'should not replace saved value' });
    await context.initializeAutoReviewUI({ reviewTemplates: { '5': 'should not replace saved value' } });

    assert.equal(replyPage.dataset.initialized, 'true');
    assert.equal(reviewPage.dataset.initialized, 'true');
    assert.equal(getElement('fpt-review-1').value, 'one');
    assert.equal(getElement('fpt-review-5').value, 'five');
    assert.equal(getElement('greetingText').value, 'saved greeting');
    assert.equal(getElement('onlyNewChats').checked, true);
    assert.equal(getElement('ignoreSystemMessages').checked, true);
    assert.equal(getElement('greetingCooldownDays').value, 7);
    assert.equal(getElement('newOrderReplyText').value, 'new order');
    assert.equal(getElement('orderConfirmReplyText').value, 'confirmed order');
    assert.equal(getElement('bonusForReviewDelaySec').value, 13);
    assert.equal(getElement('bonus-list-container').innerHTML.includes('second gift'), true);
    assert.equal(getElement('keywords-list-container').innerHTML.includes('term'), true);
    assert.equal((replyPage.listeners.click || []).length, 1, 'auto_reply page event handlers should be bound once');
    assert.equal((reviewPage.listeners.click || []).length, 1, 'auto_review page event handlers should be bound once');
});

test('autosave builder patches the changed rating and unsets only its cleared image key', () => {
    const elements = new Map([
        ['fpt-review-5', { id: 'fpt-review-5', value: 'thank you', dataset: {} }],
        ['greetingText', { id: 'greetingText', value: 'unchanged', dataset: { fptImages: '["hello.png"]' } }]
    ]);
    const context = vm.createContext({
        document: { getElementById: id => elements.get(id) || null },
        window: {},
        Set,
        Object,
        Array,
        Math,
        JSON,
        parseFloat
    });
    const source = fs.readFileSync(path.join(ROOT, 'content', 'features', 'misc.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'content/features/misc.js' });

    const patch = context.fptBuildAutoReplyPatch([elements.get('fpt-review-5')]);
    assert.deepEqual(JSON.parse(JSON.stringify(patch)), {
        set: {},
        merge: { reviewTemplates: { '5': 'thank you' } },
        unset: { reviewTemplateImages: ['5'] }
    });
});
