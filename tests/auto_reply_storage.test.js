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

test('checked patches reject concurrent scalar and rating changes inside the storage queue', async () => {
    const { createAutoReplyStore } = await storeModulePromise;
    const state = { fpToolsAutoReplies: { reviewTemplates: { 5: 'Original' }, greetingEnabled: true } };
    const store = createAutoReplyStore({
        async get() { return structuredClone(state); },
        async set(next) { Object.assign(state, structuredClone(next)); }
    });
    const changed = store.patchAutoReplies({ merge: { reviewTemplates: { 5: 'Other window' } }, set: { autoReviewEnabled: true } });
    const stale = store.patchAutoReplies({ expected: { values: { reviewTemplates: { 5: 'Original' } }, absent: ['autoReviewEnabled'] },
        merge: { reviewTemplates: { 5: 'My draft' } } });
    await changed;
    await assert.rejects(stale, { code: 'STALE_AUTO_REPLY_EDIT' });
    assert.equal(state.fpToolsAutoReplies.reviewTemplates[5], 'Other window');
    await assert.rejects(store.patchAutoReplies({ expected: { values: {}, absent: ['autoReviewEnabled'] }, set: { autoReviewEnabled: false } }), { code: 'STALE_AUTO_REPLY_EDIT' });
    await store.patchAutoReplies({ expected: { values: { reviewTemplates: { 5: 'Other window' } }, absent: ['bonusMode'] },
        merge: { reviewTemplates: { 2: 'Help' } } });
    assert.equal(state.fpToolsAutoReplies.reviewTemplates[2], 'Help');
    assert.equal(state.fpToolsAutoReplies.greetingEnabled, true);
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
    const settingsLoader = fs.readFileSync(path.join(ROOT, 'content/ui/settings_loader.js'), 'utf8');
    assert.match(settingsLoader, /chrome\.storage\.local\.get\(null\)/, 'headless state loading includes the complete auto-reply snapshot');
    assert.match(settingsLoader, /window\.__fptAutoReplySettingsReady\s*=\s*false/);
    assert.match(settingsLoader, /window\.__fptAutoReplySettingsReady\s*=\s*true/);
    assert.match(settingsIo, /await window\.fptImportAutoReplies\(data.settings.fpToolsAutoReplies\)/);

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

test('rating patches work without any old controls and retain atomic-store semantics', async () => {
    const { context } = require('./helpers/popup_actions_harness');
    const h = context();
    let patch;
    h.ctx.window.fptPatchAutoReplies = async value => { patch = value; return value; };
    await h.api.run('auto_review', 'saveSettings', { patch: {
        set: {}, merge: { reviewTemplates: { '5': 'thank you' } }, unset: { reviewTemplateImages: ['5'] }
    } });
    assert.deepEqual(JSON.parse(JSON.stringify(patch)), {
        set: {}, merge: { reviewTemplates: { '5': 'thank you' } }, unset: { reviewTemplateImages: ['5'] }
    });
});
