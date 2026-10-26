const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

function memoryStorage(initial = {}) {
    const data = structuredClone(initial);
    const pick = keys => {
        if (keys == null) return structuredClone(data);
        const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
        return Object.fromEntries(list.filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]));
    };
    return {
        data,
        async get(keys) { return pick(keys); },
        async set(values) { Object.assign(data, structuredClone(values)); },
        async remove(keys) { [].concat(keys).forEach(key => delete data[key]); }
    };
}

// FunPay as seen by the background: which user each session key belongs to (null = expired key).
async function setup({ initial = {}, users = {}, cookie = '', snapshots = {}, automation = false, probe = null } = {}) {
    const { createAccountsService } = await load('accounts_service.js');
    const { createProfileManager } = await load('account_profiles.js');
    const { createAccountVault, createMemoryVaultBackend } = await load('account_vault.js');
    const storage = memoryStorage(initial);
    const vault = createAccountVault(createMemoryVaultBackend());
    const profiles = createProfileManager({ storage, vault });
    const jar = { value: cookie };
    const calls = { reloads: 0, after: 0, snapshots: [] };
    const guard = {
        invalidate() {},
        async current() {
            const user = users[jar.value];
            return user ? { accountId: user.id, username: user.name } : { accountId: null };
        }
    };
    let ids = 0;
    const service = createAccountsService({
        storage, vault, profiles, guard,
        cookies: {
            get: async () => (jar.value ? { value: jar.value } : null),
            capture: async () => ({ value: jar.value }),
            write: async value => { jar.value = value; },
            restore: async original => { jar.value = original?.value || ''; }
        },
        snapshot: async key => { calls.snapshots.push(key); return snapshots[key] ?? null; },
        isAutomationActive: async () => (typeof automation === 'function' ? automation() : automation),
        hash: async value => `h:${value}`,
        probeCurrent: async () => (probe ? probe(jar.value) : null),
        reloadFunPayTabs: async () => { calls.reloads += 1; },
        afterProfileChange: async () => { calls.after += 1; },
        now: () => 5000,
        randomId: () => `acc_${++ids}`,
        log: { warn() {}, error() {} }
    });
    return { service, storage, vault, profiles, jar, calls };
}

const baseUsers = () => ({ 'key-a': { id: '100', name: 'Alpha' }, 'key-b': { id: '200', name: 'Bravo' } });

test('legacy records move their keys out of storage and keep working by id', async () => {
    const users = baseUsers();
    const { service, storage, vault } = await setup({ cookie: 'key-a', users, initial: {
        fpToolsAccounts: [{ name: 'Alpha', key: 'key-a', username: 'Alpha' }, { name: 'Bravo', key: 'key-b' }]
    } });
    assert.deepEqual(await service.migrate(), { migrated: true });
    const accounts = storage.data.fpToolsAccounts;
    assert.deepEqual(accounts.map(account => account.id), ['acc_1', 'acc_2']);
    assert.ok(accounts.every(account => !('key' in account)), 'no keys in storage');
    assert.deepEqual(await vault.getSecret('acc_2'), { key: 'key-b', keyHash: 'h:key-b' });
    const listed = await service.list();
    assert.equal(listed.activeId, 'acc_1');
    assert.equal(listed.sessionStale, false);
    assert.equal(storage.data.fpToolsAccounts[0].userId, '100', 'the active record learns its FunPay id');
    assert.doesNotMatch(JSON.stringify(listed), /key-a|key-b/);
    assert.deepEqual(await service.migrate(), { migrated: false });
});

test('adding the current account dedupes by FunPay id and refreshes an expired session', async () => {
    const users = baseUsers();
    const { service, storage, vault, jar } = await setup({ cookie: 'key-a', users });
    const first = await service.addCurrent({ name: 'Alpha' });
    assert.equal(first.updated, false);
    assert.deepEqual(storage.data.fpToolsAccounts, [{ id: 'acc_1', userId: '100', name: 'Alpha', username: 'Alpha', note: '', loggedIn: true }]);
    await service.rename({ id: 'acc_1', name: 'Основной' });
    storage.data.fpToolsAccounts[0].loggedIn = false;

    // A new session key for the same user (signed in again): the existing record takes it.
    users['key-a2'] = users['key-a'];
    jar.value = 'key-a2';
    assert.equal((await service.list()).sessionStale, true);
    const again = await service.addCurrent({ name: 'Alpha' });
    assert.equal(again.updated, true);
    assert.equal(storage.data.fpToolsAccounts.length, 1);
    assert.equal(storage.data.fpToolsAccounts[0].name, 'Основной', 'renaming no longer breaks the match');
    assert.equal(storage.data.fpToolsAccounts[0].loggedIn, true);
    assert.equal((await vault.getSecret('acc_1')).key, 'key-a2');
    assert.equal((await service.list()).sessionStale, false);

    jar.value = '';
    await assert.rejects(service.addCurrent(), /Войдите в аккаунт FunPay/);
    jar.value = 'unknown';
    await assert.rejects(service.addCurrent(), /Не удалось определить аккаунт/);
});

test('refresh keeps the last good snapshot time when FunPay fails or automation blocks it', async () => {
    const users = baseUsers();
    let automation = false;
    const { service, storage, jar } = await setup({ cookie: 'key-a', users, automation: () => automation, snapshots: {
        'key-b': { userId: '200', username: 'Bravo', balance: '50 ₽', unread: 2, loggedIn: true, pending: { totals: { '₽': 10 }, count: 1 } }
    } });
    await service.addCurrent();
    jar.value = 'key-b';
    await service.addCurrent();
    jar.value = 'key-a';

    const ok = await service.refresh({ id: 'acc_2' });
    assert.equal(ok.status, 'ok');
    assert.equal(ok.account.balance, '50 ₽');
    assert.equal(ok.account._snapTs, 5000);
    assert.deepEqual(ok.account.refresh, { status: 'ok', at: 5000 });

    const failed = await service.refresh({ id: 'acc_1' });
    assert.equal(failed.status, 'failed');
    assert.equal(storage.data.fpToolsAccounts[0]._snapTs, undefined, 'a failure does not look like fresh data');
    assert.equal(storage.data.fpToolsAccounts[0].refresh.status, 'failed');

    automation = true;
    const locked = await service.refresh({ id: 'acc_2' });
    assert.equal(locked.status, 'locked');
    assert.match(locked.error, /автоматизация/);
    assert.equal(storage.data.fpToolsAccounts[1].balance, '50 ₽', 'the previous snapshot stays');
    assert.equal(storage.data.fpToolsAccounts[1].refresh.status, 'locked');
});

test('a snapshot of a key that now belongs to another user is rejected', async () => {
    const users = baseUsers();
    const { service, storage, jar } = await setup({ cookie: 'key-b', users, snapshots: { 'key-b': { userId: '999', loggedIn: true, balance: '1 ₽' } } });
    await service.addCurrent();
    jar.value = 'key-a';
    const result = await service.refresh({ id: 'acc_1' });
    assert.equal(result.status, 'failed');
    assert.equal(storage.data.fpToolsAccounts[0].balance, undefined);
});

test('a wrong saved FunPay id is corrected when the key still opens the same nickname', async () => {
    const users = baseUsers();
    const { service, storage } = await setup({ cookie: 'key-a', users, snapshots: { 'key-a': { userId: '100', username: 'Alpha', loggedIn: true, balance: '5 ₽' } } });
    await service.addCurrent();
    storage.data.fpToolsAccounts[0].userId = '200'; // recorded by an old snapshot taken in a mixed session
    const result = await service.refresh({ id: 'acc_1' });
    assert.equal(result.status, 'ok');
    assert.equal(storage.data.fpToolsAccounts[0].userId, '100');
    assert.equal(storage.data.fpToolsAccounts[0].balance, '5 ₽');

    storage.data.fpToolsAccounts[0].userId = '200';
    assert.equal((await service.addCurrent()).updated, true, 'session refresh finds the record by nickname');
    assert.equal(storage.data.fpToolsAccounts.length, 1);
    assert.equal(storage.data.fpToolsAccounts[0].userId, '100');
});

test('switching suspends the current config, loads the target one and rolls back an expired key', async () => {
    const users = baseUsers();
    const { service, storage, jar, calls } = await setup({ cookie: 'key-a', users, initial: {
        fpToolsAutoReplies: { greetingEnabled: true }, autoBumpEnabled: true
    } });
    await service.addCurrent();
    jar.value = 'key-b';
    await service.addCurrent();
    jar.value = 'key-a';
    await service.reconcile();
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '100');

    const result = await service.switchTo({ id: 'acc_2' });
    assert.deepEqual(result, { success: true, created: true, userId: '200' });
    assert.equal(jar.value, 'key-b');
    assert.deepEqual(storage.data.fpToolsAutoReplies, {});
    assert.equal(storage.data.autoBumpEnabled, false);
    assert.equal(calls.after, 1);
    assert.equal(calls.reloads, 1);
    const listed = await service.list();
    assert.equal(listed.activeId, 'acc_2');
    assert.deepEqual(listed.notice, { accountId: '200', at: storage.data.fpToolsProfileNotice.at });
    assert.equal(listed.profiles['100'].automation, true);

    await service.switchTo({ id: 'acc_1' });
    assert.equal(storage.data.fpToolsAutoReplies.greetingEnabled, true, 'automation of A is back');
    assert.equal(storage.data.autoBumpEnabled, true);

    // The saved key for B stopped working: the cookie and A's config come back, B is marked expired.
    delete users['key-b'];
    await assert.rejects(service.switchTo({ id: 'acc_2' }), /Сессия истекла/);
    assert.equal(jar.value, 'key-a');
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '100');
    assert.equal(storage.data.fpToolsAutoReplies.greetingEnabled, true);
    assert.equal(storage.data.fpToolsAccounts[1].loggedIn, false);

    // B's record holds a key that now opens another account: nothing is switched or relabelled.
    users['key-b'] = { id: '300', name: 'Charlie' };
    await assert.rejects(service.switchTo({ id: 'acc_2' }), /другому аккаунту/);
    assert.equal(jar.value, 'key-a');
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '100');
    assert.equal(storage.data.fpToolsAccounts[1].userId, '200');
});

test('a manual login elsewhere is reconciled and sync works by record id', async () => {
    const users = baseUsers();
    const { service, storage, jar, calls } = await setup({ cookie: 'key-a', users, initial: { fpToolsBlacklist: [{ username: 'spam' }] } });
    await service.addCurrent();
    await service.reconcile();
    jar.value = 'key-b';
    const changed = await service.reconcile();
    assert.equal(changed.changed, true);
    assert.equal(calls.reloads, 1);
    assert.equal(storage.data.fpToolsBlacklist, undefined);
    await service.addCurrent();
    await assert.rejects(service.sync({ fromId: 'acc_1', toId: 'missing' }), /не найден/);
    const synced = await service.sync({ fromId: 'acc_1', toId: 'acc_2' });
    assert.equal(synced.live, true);
    assert.deepEqual(storage.data.fpToolsBlacklist, [{ username: 'spam' }]);
    assert.equal((await service.list()).lastSync.accountId, '200');
    await service.undoSync();
    assert.equal(storage.data.fpToolsBlacklist, undefined);
    assert.equal((await service.reconcile()).changed, false);
});

test('notes are trimmed and limited, deleting drops the key but keeps the config', async () => {
    const users = baseUsers();
    const { service, storage, vault } = await setup({ cookie: 'key-a', users });
    await service.addCurrent();
    await service.reconcile();
    await service.setNote({ id: 'acc_1', note: `  основной\r\n${'x'.repeat(600)}  ` });
    assert.equal(storage.data.fpToolsAccounts[0].note.length, 500);
    assert.ok(storage.data.fpToolsAccounts[0].note.startsWith('основной\nx'));
    await assert.rejects(service.rename({ id: 'acc_1', name: '   ' }), /пустым/);
    await service.remove({ id: 'acc_1' });
    assert.deepEqual(storage.data.fpToolsAccounts, []);
    assert.equal(await vault.getSecret('acc_1'), undefined);
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '100', 'the config of the account stays');
});

test('switching before the owner was marked saves the live config first and refuses when the account is unknown', async () => {
    const users = baseUsers();
    const { service, storage, vault, jar } = await setup({ cookie: 'key-a', users, initial: { fpToolsBlacklist: [{ username: 'spam' }] } });
    await service.addCurrent();
    jar.value = 'key-b';
    await service.addCurrent();
    jar.value = 'key-a';
    assert.equal(storage.data.fpToolsProfileOwner, undefined, 'startup could not tell the account yet');
    await service.switchTo({ id: 'acc_2' });
    assert.deepEqual((await vault.getProfile('100')).values.fpToolsBlacklist, [{ username: 'spam' }], 'the config of A is kept');
    assert.equal(storage.data.fpToolsBlacklist, undefined);
    assert.equal(storage.data.fpToolsProfileOwner.accountId, '200');

    const other = await setup({ cookie: 'key-x', users: { ...baseUsers() }, initial: { fpToolsBlacklist: [{ username: 'keep' }] } });
    await other.vault.putSecret('acc_9', { key: 'key-b', keyHash: 'h:key-b' });
    other.storage.data.fpToolsAccounts = [{ id: 'acc_9', userId: '200', name: 'Bravo' }];
    await assert.rejects(other.service.switchTo({ id: 'acc_9' }), /Не удалось определить текущий аккаунт/);
    assert.equal(other.jar.value, 'key-x');
    assert.deepEqual(other.storage.data.fpToolsBlacklist, [{ username: 'keep' }]);
    assert.equal(other.service.isSwitching(), false);
});

test('daily keepalive refreshes only the current account and never swaps keys', async () => {
    const users = baseUsers();
    const probes = [];
    const probe = key => { probes.push(key); return { key, snap: { loggedIn: true, userId: users[key].id, username: users[key].name, balance: '7 ₽' } }; };
    const { service, storage, jar, calls } = await setup({ cookie: 'key-a', users, probe });
    await service.addCurrent();
    jar.value = 'key-b';
    await service.addCurrent();
    jar.value = 'key-a';
    probes.length = 0;
    assert.equal((await service.keepalive()).status, 'ok');
    assert.deepEqual(probes, ['key-a'], 'only the current key is probed');
    assert.equal(calls.snapshots.length, 0, 'no snapshot swap of other accounts');
    assert.equal(jar.value, 'key-a');
    assert.equal(storage.data.fpToolsAccounts[0].refresh.status, 'ok');
    assert.equal(storage.data.fpToolsAccounts[1].refresh ?? null, null);
});

test('daily keepalive marks a dead key as expired instead of failing silently', async () => {
    const users = baseUsers();
    let loggedIn = true;
    const { service, storage, jar } = await setup({ cookie: 'key-a', users, probe: key => ({ key, snap: { loggedIn, userId: users[key].id } }) });
    await service.addCurrent();
    loggedIn = false;
    const result = await service.keepalive();
    assert.equal(result.status, 'failed');
    assert.equal(storage.data.fpToolsAccounts[0].loggedIn, false);
    assert.match(storage.data.fpToolsAccounts[0].refresh.error, /закрыта/);
    assert.equal((await service.list()).sessionStale, true);
    assert.equal(jar.value, 'key-a');
});
