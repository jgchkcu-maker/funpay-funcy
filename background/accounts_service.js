/*
 * FunPay Funcy — сохранённые аккаунты FunPay: реестр, переключение, снимки, синхронизация.
 *
 * Реестр (fpToolsAccounts в chrome.storage.local) хранит только публичные поля, его читает
 * интерфейс. Ключи сессий лежат в закрытом хранилище (account_vault.js) и не покидают фон:
 * интерфейс обращается к аккаунтам по id записи. Реестр пишет только этот сервис, одной очередью.
 *
 * Запись: { id, userId, name, username, note, avatar, balance, unread, funds, pending,
 *           loggedIn, _snapTs, refresh: { status: 'ok'|'failed'|'locked', at, error } }.
 */

import { PROFILE_NOTICE_KEY } from './account_profiles.js';

export const ACCOUNTS_KEY = 'fpToolsAccounts';
const NAME_MAX = 60;
const NOTE_MAX = 500;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const accountIdOf = value => (value != null && /^\d+$/.test(String(value)) ? String(value) : null);
const sameName = (account, username) => {
    const name = String(username || '').trim().toLowerCase();
    return Boolean(name) && [account.username, account.name].some(value => String(value || '').trim().toLowerCase() === name);
};
const defaultId = () => `acc_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

export function mergeAccountSnapshot(account, snapshot, at) {
    Object.assign(account, {
        avatar: snapshot.avatar || account.avatar || '',
        balance: snapshot.balance || account.balance || '',
        unread: typeof snapshot.unread === 'number' ? snapshot.unread : account.unread || 0,
        _snapTs: at
    });
    if (typeof snapshot.loggedIn === 'boolean') account.loggedIn = snapshot.loggedIn;
    if (snapshot.username) account.username = snapshot.username;
    if (accountIdOf(snapshot.userId)) account.userId = String(snapshot.userId);
    if (isRecord(snapshot.funds)) account.funds = snapshot.funds;
    if (isRecord(snapshot.pending)) {
        account.pending = { totals: { ...(snapshot.pending.totals || {}) }, count: Number(snapshot.pending.count) || 0 };
    }
    return account;
}

// cookies: { get() -> cookie golden_key|null, capture() -> куки сессии, write(value), restore(captured) }.
// snapshot(key) -> объект снимка или null при ошибке; cookieLock(fn) — очередь подмен cookie.
export function createAccountsService({
    storage, vault, profiles, guard, cookies, snapshot, isAutomationActive, cookieLock = fn => fn(),
    probeCurrent = async () => null,
    hash, reloadFunPayTabs = async () => {}, afterProfileChange = async () => {},
    now = () => Date.now(), randomId = defaultId, log = console
} = {}) {
    if (!storage || !vault || !profiles || !guard || !cookies || !snapshot || !hash) throw new Error('Сервис аккаунтов не настроен.');
    let chain = Promise.resolve();
    let switching = false;

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }
    async function read() {
        const { [ACCOUNTS_KEY]: stored } = await storage.get(ACCOUNTS_KEY);
        return Array.isArray(stored) ? stored.filter(isRecord) : [];
    }
    // updater(accounts) меняет список на месте и возвращает результат операции.
    const mutate = updater => serialize(async () => {
        const accounts = await read();
        const result = await updater(accounts);
        await storage.set({ [ACCOUNTS_KEY]: accounts });
        return result;
    });
    function find(accounts, id) {
        const account = accounts.find(item => item.id === id);
        if (!account) throw new Error('Аккаунт не найден.');
        return account;
    }
    async function currentSession() {
        const cookie = await cookies.get();
        const key = cookie?.value || '';
        return { cookie, key, keyHash: key ? await hash(key) : null };
    }

    // Старые записи хранили ключ прямо в реестре: он переносится в закрытое хранилище.
    function migrate() {
        return serialize(async () => {
            const accounts = await read();
            let changed = false;
            for (const account of accounts) {
                if (!account.id) { account.id = randomId(); changed = true; }
                if (typeof account.key === 'string') {
                    if (account.key) await vault.putSecret(account.id, { key: account.key, keyHash: await hash(account.key) });
                    delete account.key;
                    changed = true;
                }
            }
            if (changed) await storage.set({ [ACCOUNTS_KEY]: accounts });
            return { migrated: changed };
        });
    }

    async function list() {
        const accounts = await read();
        const session = await currentSession();
        const current = session.key ? await guard.current().catch(() => ({ accountId: null })) : { accountId: null };
        const secrets = await Promise.all(accounts.map(account => vault.getSecret(account.id).catch(() => null)));
        const username = current.username || '';
        let index = current.accountId ? accounts.findIndex(account => account.userId === current.accountId) : -1;
        if (index < 0 && session.keyHash) index = secrets.findIndex(secret => secret?.keyHash === session.keyHash);
        if (index < 0 && username) index = accounts.findIndex(account => !account.userId && (account.username || account.name) === username);
        const active = index >= 0 ? accounts[index] : null;
        if (active && !active.userId && current.accountId) {
            await mutate(list => { const record = list.find(item => item.id === active.id); if (record) record.userId = current.accountId; });
            active.userId = current.accountId;
        }
        // Фон не смог определить аккаунт при запуске: живые ключи помечаются текущим аккаунтом сейчас.
        if (!(await profiles.owner()) && current.accountId) await profiles.reconcile(current.accountId);
        const summaries = {};
        for (const account of accounts) {
            if (account.userId && !summaries[account.userId]) summaries[account.userId] = await profiles.summary(account.userId);
        }
        const owner = await profiles.owner();
        const { [PROFILE_NOTICE_KEY]: notice } = await storage.get(PROFILE_NOTICE_KEY);
        const lastSync = await profiles.lastSync().catch(() => null);
        return {
            accounts,
            activeId: active?.id || '',
            // Вход выполнен в сохранённый аккаунт, но его ключ устарел или помечен истёкшим.
            sessionStale: Boolean(active && (active.loggedIn === false || secrets[index]?.keyHash !== session.keyHash)),
            current: { userId: current.accountId || '', username, loggedIn: Boolean(session.key && current.accountId) },
            profiles: summaries,
            ownerId: owner?.accountId || '',
            notice: notice?.accountId && notice.accountId === owner?.accountId ? { accountId: notice.accountId, at: notice.at || 0 } : null,
            lastSync: lastSync?.accountId ? { accountId: lastSync.accountId, from: lastSync.from || '', at: lastSync.at || 0 } : null,
            automationActive: Boolean(await isAutomationActive())
        };
    }

    // Сохраняет аккаунт, в который выполнен вход. Если он уже есть в списке — обновляет его
    // ключ: так возвращается аккаунт с истёкшей сессией.
    async function addCurrent({ name } = {}) {
        const session = await currentSession();
        if (!session.key) throw new Error('Не удалось получить ключ сессии. Войдите в аккаунт FunPay.');
        guard.invalidate?.();
        const current = await guard.current({ fresh: true });
        const userId = accountIdOf(current.accountId);
        if (!userId) throw new Error('Не удалось определить аккаунт FunPay. Обновите страницу и попробуйте снова.');
        const username = String(current.username || '').trim();
        return mutate(async accounts => {
            // По нику находится и запись с неверным ID: ник на FunPay уникален.
            const existing = accounts.find(account => account.userId === userId)
                || accounts.find(account => sameName(account, username));
            if (existing) {
                Object.assign(existing, { userId, loggedIn: true, refresh: null });
                if (username) existing.username = username;
                await vault.putSecret(existing.id, { key: session.key, keyHash: session.keyHash });
                return { account: existing, updated: true };
            }
            let title = String(name || username || `ID ${userId}`).trim().slice(0, NAME_MAX);
            if (accounts.some(account => account.name === title)) title = `${title} (${userId})`.slice(0, NAME_MAX);
            const account = { id: randomId(), userId, name: title, username: username || title, note: '', loggedIn: true };
            await vault.putSecret(account.id, { key: session.key, keyHash: session.keyHash });
            accounts.push(account);
            return { account, updated: false };
        });
    }

    async function rename({ id, name } = {}) {
        const title = String(name ?? '').trim().slice(0, NAME_MAX);
        if (!title) throw new Error('Название не может быть пустым.');
        return mutate(accounts => { find(accounts, id).name = title; return true; });
    }

    async function setNote({ id, note } = {}) {
        const text = String(note ?? '').replace(/\r\n/g, '\n').trim().slice(0, NOTE_MAX);
        return mutate(accounts => { find(accounts, id).note = text; return true; });
    }

    // Конфиг аккаунта (по userId) остаётся: если добавить аккаунт снова, настройки вернутся.
    async function remove({ id } = {}) {
        await mutate(accounts => {
            const index = accounts.indexOf(find(accounts, id));
            accounts.splice(index, 1);
        });
        await vault.deleteSecret(id).catch(() => {});
        return true;
    }

    async function setRefresh(id, refresh, apply) {
        return mutate(accounts => {
            const account = accounts.find(item => item.id === id);
            if (!account) return null;
            apply?.(account);
            account.refresh = refresh;
            return account;
        });
    }

    // Обновляет баланс, аватар и счётчики. Неудача не трогает время последнего снимка.
    async function refresh({ id } = {}) {
        const account = find(await read(), id);
        const secret = await vault.getSecret(account.id);
        if (!secret?.key) {
            const error = 'Ключ сессии не найден — войдите в аккаунт и нажмите «Обновить сессию».';
            return { status: 'failed', error, account: await setRefresh(id, { status: 'failed', at: now(), error }) };
        }
        const session = await currentSession();
        if (session.key !== secret.key && await isAutomationActive()) {
            const error = 'Пока работает автоматизация, данные других аккаунтов не обновляются.';
            return { status: 'locked', error, account: await setRefresh(id, { status: 'locked', at: now(), error }) };
        }
        let snap = null;
        try { snap = await snapshot(secret.key); } catch (error) { log.warn?.('FunPay Funcy: снимок аккаунта не получен:', error?.message || error); }
        if (!isRecord(snap)) {
            const error = 'FunPay не ответил. Проверьте соединение и попробуйте ещё раз.';
            return { status: 'failed', error, account: await setRefresh(id, { status: 'failed', at: now(), error }) };
        }
        const snapUserId = accountIdOf(snap.userId);
        // Тот же ник на FunPay — значит, неверен сохранённый ID (его могли записать прошлые версии
        // по странице чужой сессии): он исправляется снимком. Иначе ключ лежит не в той записи.
        if (snapUserId && account.userId && snapUserId !== account.userId && !sameName(account, snap.username)) {
            const error = 'Ключ принадлежит другому аккаунту FunPay — войдите в нужный аккаунт и обновите сессию.';
            return { status: 'failed', error, account: await setRefresh(id, { status: 'failed', at: now(), error }) };
        }
        const at = now();
        const updated = await setRefresh(id, { status: 'ok', at }, record => mergeAccountSnapshot(record, snap, at));
        return { status: 'ok', account: updated };
    }

    // Переключает сессию: конфиг текущего аккаунта сохраняется и выключается, ставится ключ
    // выбранного, загружается его конфиг. Если ключ не принят — всё возвращается как было.
    async function switchTo({ id } = {}) {
        const account = find(await read(), id);
        const secret = await vault.getSecret(account.id);
        if (!secret?.key) throw new Error('Ключ сессии не найден — войдите в аккаунт и нажмите «Обновить сессию».');
        const result = await cookieLock(async () => {
            const original = await cookies.get();
            if (original?.value === secret.key) return { success: true, already: true };
            // Сессия снимается целиком (ключ и привязанные к нему куки): при неудаче она
            // возвращается как была, и вход в исходный аккаунт не теряется.
            const saved = await cookies.capture();
            switching = true;
            // Чей конфиг сейчас в живых ключах, должно быть известно до того, как он будет убран:
            // иначе он пропал бы без сохранения. Если владелец ещё не отмечен (фон не смог определить
            // аккаунт при запуске), он определяется сейчас; без входа живой конфиг достаётся цели.
            let ownerKnown = Boolean(await profiles.owner());
            if (!ownerKnown && original?.value) {
                guard.invalidate?.();
                const before = await guard.current({ fresh: true });
                if (!accountIdOf(before.accountId)) {
                    switching = false;
                    throw new Error('Не удалось определить текущий аккаунт FunPay. Обновите страницу и попробуйте снова.');
                }
                await profiles.reconcile(before.accountId);
                ownerKnown = true;
            }
            const ownerBefore = (await profiles.owner())?.accountId || null;
            let activated = false;
            try {
                if (ownerKnown) await profiles.suspend();
                await cookies.write(secret.key);
                guard.invalidate?.();
                const current = await guard.current({ fresh: true });
                const userId = accountIdOf(current.accountId);
                if (!userId) {
                    const error = new Error('Сессия истекла — войдите в этот аккаунт на FunPay и нажмите «Обновить сессию».');
                    error.code = 'session-expired';
                    throw error;
                }
                if (account.userId && userId !== account.userId) {
                    const error = new Error('Ключ принадлежит другому аккаунту FunPay — войдите в нужный аккаунт и нажмите «Обновить сессию».');
                    error.code = 'wrong-account';
                    throw error;
                }
                const activation = ownerKnown ? await profiles.activate(userId) : { created: false, ...(await profiles.reconcile(userId)) };
                activated = true;
                await mutate(accounts => {
                    const record = accounts.find(item => item.id === id);
                    if (!record) return;
                    record.userId = userId;
                    record.loggedIn = true;
                    if (current.username) record.username = current.username;
                });
                return { success: true, created: activation.created, userId };
            } catch (error) {
                if (!activated) {
                    try { await cookies.restore(saved); } catch (restoreError) { log.error?.('FunPay Funcy: cookie не восстановлена:', restoreError); }
                    guard.invalidate?.();
                    if (ownerBefore) await profiles.activate(ownerBefore).catch(activateError => log.error?.('FunPay Funcy: конфиг не восстановлен:', activateError));
                    if (error.code === 'session-expired') {
                        await mutate(accounts => { const record = accounts.find(item => item.id === id); if (record) record.loggedIn = false; });
                    }
                }
                throw error;
            } finally {
                switching = false;
            }
        });
        if (!result.already) {
            await afterProfileChange().catch(error => log.warn?.('FunPay Funcy: автоматизация не перенастроена:', error?.message || error));
        }
        await reloadFunPayTabs();
        return result;
    }

    // Сверяет конфиг с аккаунтом, в который вошли вручную на сайте FunPay.
    async function reconcile() {
        guard.invalidate?.();
        const current = await guard.current({ fresh: true });
        const result = await profiles.reconcile(current.accountId);
        if (result.changed) {
            await afterProfileChange().catch(error => log.warn?.('FunPay Funcy: автоматизация не перенастроена:', error?.message || error));
            await reloadFunPayTabs();
        }
        return result;
    }

    async function sync({ fromId, toId } = {}) {
        const accounts = await read();
        const from = find(accounts, fromId);
        const to = find(accounts, toId);
        if (!from.userId || !to.userId) throw new Error('Аккаунт ещё не определён — нажмите «Обновить» и попробуйте снова.');
        const result = await profiles.sync(from.userId, to.userId);
        if (result.live) await afterProfileChange().catch(() => {});
        return result;
    }

    async function undoSync() {
        const result = await profiles.undoSync();
        if (result.live) await afterProfileChange().catch(() => {});
        return result;
    }

    // Ежедневная проверка текущего аккаунта: только его собственная сессия, без подмены кук.
    // probeCurrent() -> { key, snap } — снимок под текущим ключом (обновляет golden_seal).
    // Неактивные аккаунты не трогаются: подмена ключа ради проверки — лишний вход в чужой аккаунт.
    async function keepalive() {
        if (switching) return { status: 'busy' };
        const probe = await probeCurrent();
        if (!probe?.key) return { status: 'none' };
        const keyHash = await hash(probe.key);
        const accounts = await read();
        let record = null;
        for (const account of accounts) {
            const secret = await vault.getSecret(account.id).catch(() => null);
            if (secret?.keyHash === keyHash) { record = account; break; }
        }
        if (!record) return { status: 'unknown' };
        const fail = (error, apply) => setRefresh(record.id, { status: 'failed', at: now(), error }, apply)
            .then(account => ({ status: 'failed', error, account }));
        if (!isRecord(probe.snap)) {
            return fail('FunPay не ответил. Проверка повторится завтра или нажмите «Обновить».');
        }
        if (!probe.snap.loggedIn) {
            return fail('Сессия FunPay закрыта — войдите в этот аккаунт и нажмите «Обновить сессию».', account => { account.loggedIn = false; });
        }
        const snapUserId = accountIdOf(probe.snap.userId);
        if (snapUserId && record.userId && snapUserId !== record.userId) {
            return fail('Ключ принадлежит другому аккаунту FunPay — войдите в нужный аккаунт и обновите сессию.');
        }
        const at = now();
        const account = await setRefresh(record.id, { status: 'ok', at }, target => {
            mergeAccountSnapshot(target, probe.snap, at);
            target.loggedIn = true;
            if (snapUserId) target.userId = snapUserId;
        });
        return { status: 'ok', account };
    }

    async function dismissNotice() {
        await storage.remove(PROFILE_NOTICE_KEY);
        return true;
    }

    return Object.freeze({
        migrate, list, addCurrent, rename, setNote, remove, refresh, switchTo, reconcile, sync, undoSync, dismissNotice, keepalive,
        isSwitching: () => switching
    });
}
