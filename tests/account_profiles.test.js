const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const classification = require('./settings_io_key_classification.json');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

// chrome.storage.local stand-in that records every write as one change set, like onChanged does.
function memoryStorage(initial = {}) {
    const data = structuredClone(initial);
    const writes = [];
    const pick = keys => {
        if (keys == null) return structuredClone(data);
        const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
        return Object.fromEntries(list.filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]));
    };
    return {
        data, writes,
        async get(keys) { return pick(keys); },
        async set(values) { writes.push({ set: Object.keys(values) }); Object.assign(data, structuredClone(values)); },
        async remove(keys) { const list = [].concat(keys); writes.push({ remove: list }); list.forEach(key => delete data[key]); }
    };
}

async function setup(initial) {
    const { createProfileManager } = await load('account_profiles.js');
    const { createAccountVault, createMemoryVaultBackend } = await load('account_vault.js');
    const { AUTO_REPLY_RUNTIME_FIELDS } = await load('auto_reply_store.js');
    const storage = memoryStorage(initial);
    const vault = createAccountVault(createMemoryVaultBackend());
    let clock = 1000;
    const profiles = createProfileManager({ storage, vault, runtimeFields: [...AUTO_REPLY_RUNTIME_FIELDS], now: () => ++clock });
    return { storage, vault, profiles };
}

const accountA = {
    fpToolsAutoReplies: { greetingEnabled: true, greetingText: 'Привет от A', lastSeenMsgIds: { 1: 5 }, autoResponderSeeded: true, deliveredOrderIds: ['A-1'] },
    autoBumpEnabled: true,
    fpToolsBlacklist: [{ username: 'spam' }],
    fpToolsAutoDeliveryLots: { 111: { mode: 'secrets' } },
    fpToolsTheme: { accent: 'red' }
};

test('key lists are disjoint, classified and leave per-account lot services alone', async () => {
    const { ACCOUNT_CONFIG_KEYS, ACCOUNT_DATA_KEYS } = await load('account_profiles.js');
    const known = new Set([...classification.exported, ...classification.deviceOnly, 'autoBumpEnabled', 'autoBumpCooldown']);
    assert.equal(new Set([...ACCOUNT_CONFIG_KEYS, ...ACCOUNT_DATA_KEYS]).size, ACCOUNT_CONFIG_KEYS.length + ACCOUNT_DATA_KEYS.length);
    for (const key of [...ACCOUNT_CONFIG_KEYS, ...ACCOUNT_DATA_KEYS]) assert.ok(known.has(key), `${key} is a known storage key`);
    for (const key of ['fpToolsAutoReplies', 'autoBumpEnabled', 'fpToolsTemplateSettings', 'fpToolsBlacklist']) assert.ok(ACCOUNT_CONFIG_KEYS.includes(key), key);
    for (const key of ['fpToolsAutoDeliveryLots', 'fpToolsPinnedLots']) assert.ok(ACCOUNT_DATA_KEYS.includes(key), key);
    // These already keep accountId inside every rule; swapping them would mix up other accounts' rules.
    for (const key of ['fpToolsLotSchedules', 'fpToolsPricing', 'fpToolsLotPolicies', 'fpToolsJobDeadlines', 'fpToolsTheme', 'fpToolsAccounts']) {
        assert.ok(![...ACCOUNT_CONFIG_KEYS, ...ACCOUNT_DATA_KEYS].includes(key), key);
    }
});

test('first run marks the current account as owner without touching live settings', async () => {
    const { storage, profiles } = await setup(accountA);
    const before = structuredClone(storage.data);
    assert.deepEqual(await profiles.reconcile('100'), { changed: false, migrated: true, accountId: '100' });
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '100');
    delete storage.data.fpToolsProfileOwner;
    assert.deepEqual(storage.data, before);
    assert.equal((await profiles.reconcile(null)).changed, false, 'signed out: nothing happens');
});

test('switching stores the old config, gives a new account defaults and restores the old one on return', async () => {
    const { storage, vault, profiles } = await setup(accountA);
    await profiles.reconcile('100');
    const toB = await profiles.reconcile('200');
    assert.equal(toB.changed, true);
    assert.equal(toB.created, true);
    assert.deepEqual(storage.data.fpToolsAutoReplies, {}, 'automation of A is off on B');
    assert.equal(storage.data.autoBumpEnabled, false);
    assert.equal(storage.data.autoBumpCooldown, 245);
    assert.equal(storage.data.fpToolsBlacklist, undefined);
    assert.equal(storage.data.fpToolsAutoDeliveryLots, undefined);
    assert.deepEqual(storage.data.fpToolsTheme, { accent: 'red' }, 'appearance is shared');
    assert.deepEqual(storage.data.fpToolsProfileNotice.accountId, '200');
    assert.equal((await vault.getProfile('100')).values.fpToolsAutoReplies.greetingText, 'Привет от A');
    // The replacement and the owner marker arrive in one write, so the background can tell a switch from an edit.
    assert.ok(storage.writes.some(write => write.set?.includes('fpToolsAutoReplies') && write.set.includes('fpToolsProfileOwner')));

    storage.data.fpToolsAutoReplies = { keywordsEnabled: true, deliveredOrderIds: ['B-1'] };
    const back = await profiles.reconcile('100');
    assert.equal(back.created, false);
    assert.equal(storage.data.autoBumpEnabled, true);
    assert.deepEqual(storage.data.fpToolsBlacklist, [{ username: 'spam' }]);
    assert.deepEqual(storage.data.fpToolsAutoDeliveryLots, { 111: { mode: 'secrets' } });
    const replies = storage.data.fpToolsAutoReplies;
    assert.equal(replies.greetingText, 'Привет от A');
    assert.deepEqual(replies.deliveredOrderIds, ['A-1'], 'order history of A comes back with it');
    assert.equal(replies.lastSeenMsgIds, undefined, 'chats are seeded again instead of answered in bulk');
    assert.equal(replies.autoResponderSeeded, undefined);
    assert.equal((await vault.getProfile('200')).values.fpToolsAutoReplies.keywordsEnabled, true);
    assert.deepEqual(await profiles.summary('200'), { exists: true, automation: true, live: false });
    assert.deepEqual(await profiles.summary('300'), { exists: false, automation: false, live: false });
});

test('sync copies config only, keeps the target history and can be undone', async () => {
    const { storage, vault, profiles } = await setup(accountA);
    await profiles.reconcile('100');
    await vault.putProfile('200', { values: {
        fpToolsAutoReplies: { keywordsEnabled: false, greetingText: 'B', deliveredOrderIds: ['B-1'] },
        fpToolsAutoDeliveryLots: { 222: { mode: 'template' } },
        fpToolsBlacklist: [{ username: 'other' }]
    }, savedAt: 1 });
    await assert.rejects(profiles.sync('100', '100'), /разные/);
    await assert.rejects(profiles.sync('300', '100'), /нет своих настроек/);

    const result = await profiles.sync('100', '200');
    assert.deepEqual(result, { from: '100', to: '200', live: false, automation: true });
    const synced = (await vault.getProfile('200')).values;
    assert.equal(synced.fpToolsAutoReplies.greetingText, 'Привет от A');
    assert.deepEqual(synced.fpToolsAutoReplies.deliveredOrderIds, ['B-1'], 'runtime history stays with the target');
    assert.equal(synced.fpToolsAutoReplies.lastSeenMsgIds, undefined);
    assert.deepEqual(synced.fpToolsBlacklist, [{ username: 'spam' }]);
    assert.deepEqual(synced.fpToolsAutoDeliveryLots, { 222: { mode: 'template' } }, 'lot bindings are not copied');
    assert.equal(synced.autoBumpEnabled, true);
    assert.equal(storage.data.fpToolsAutoReplies.greetingText, 'Привет от A', 'the source is untouched');

    assert.equal((await profiles.lastSync()).accountId, '200');
    assert.deepEqual(await profiles.undoSync(), { accountId: '200', live: false });
    const restored = (await vault.getProfile('200')).values;
    assert.equal(restored.fpToolsAutoReplies.greetingText, 'B');
    assert.deepEqual(restored.fpToolsBlacklist, [{ username: 'other' }]);
    assert.equal(restored.autoBumpEnabled, undefined);
    await assert.rejects(profiles.undoSync(), /Нечего отменять/);
});

test('sync into the active account writes live keys and clears its fresh-account notice', async () => {
    const { storage, vault, profiles } = await setup(accountA);
    await profiles.reconcile('100');
    await profiles.reconcile('200');
    assert.equal(storage.data.fpToolsProfileNotice.accountId, '200');
    storage.data.fpToolsAutoReplies = { deliveredOrderIds: ['B-9'] };
    const result = await profiles.sync('100', '200');
    assert.equal(result.live, true);
    assert.equal(storage.data.fpToolsAutoReplies.greetingEnabled, true);
    assert.deepEqual(storage.data.fpToolsAutoReplies.deliveredOrderIds, ['B-9']);
    assert.deepEqual(storage.data.fpToolsBlacklist, [{ username: 'spam' }]);
    assert.equal(storage.data.fpToolsProfileNotice, undefined);
    // Undo after more orders were delivered keeps the newer history.
    storage.data.fpToolsAutoReplies.deliveredOrderIds = ['B-9', 'B-10'];
    await profiles.undoSync();
    assert.equal(storage.data.fpToolsAutoReplies.greetingEnabled, undefined);
    assert.deepEqual(storage.data.fpToolsAutoReplies.deliveredOrderIds, ['B-9', 'B-10']);
    assert.equal(storage.data.fpToolsBlacklist, undefined);
    assert.equal((await vault.getProfile('100')).values.fpToolsAutoReplies.greetingText, 'Привет от A');
});

test('automationEnabledIn reads auto-reply switches and auto bump', async () => {
    const { automationEnabledIn } = await load('account_profiles.js');
    assert.equal(automationEnabledIn({}), false);
    assert.equal(automationEnabledIn({ fpToolsAutoReplies: { greetingText: 'x' } }), false);
    assert.equal(automationEnabledIn({ fpToolsAutoReplies: { autoDeliveryEnabled: true } }), true);
    assert.equal(automationEnabledIn({ autoBumpEnabled: true }), true);
});
