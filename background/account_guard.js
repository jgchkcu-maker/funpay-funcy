/*
 * FunPay Funcy — текущий аккаунт и эпоха сессии.
 *
 * Автоматизация обслуживает один подтверждённый аккаунт FunPay. Эпоха растёт при
 * каждой смене аккаунта или ключа сессии; операции и кэши запоминают
 * { accountId, epoch } и непосредственно перед эффектом сверяют их с текущими.
 * Это снижает риск действовать от чужого аккаунта, но не делает вкладки
 * изолированными: ручной вход между последним чтением и записью всё ещё возможен.
 *
 * Ключ сессии не хранится — только короткий хэш для сравнения.
 */

export const ACCOUNT_EPOCH_KEY = 'fpToolsAccountEpoch';

export class AccountChangedError extends Error {
    constructor(message = 'Аккаунт FunPay сменился — действие остановлено.') {
        super(message);
        this.name = 'AccountChangedError';
        this.code = 'account-changed';
    }
}

export async function sha256Short(text) {
    const data = new TextEncoder().encode(String(text || ''));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest).slice(0, 8)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// storage — chrome.storage.local-подобный объект; readSession() -> { goldenKey, userId, username }.
export function createAccountGuard({ storage, readSession, hash = sha256Short, now = () => Date.now(), cacheMs = 15000 } = {}) {
    if (!storage || typeof readSession !== 'function') throw new Error('Проверка аккаунта не настроена.');
    let cached = null;
    let pending = null;
    const listeners = new Set();
    let chain = Promise.resolve();

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function refresh() {
        const session = await readSession();
        const accountId = session?.userId != null && /^\d+$/.test(String(session.userId)) ? String(session.userId) : null;
        const keyHash = session?.goldenKey ? await hash(session.goldenKey) : null;
        return serialize(async () => {
            const { [ACCOUNT_EPOCH_KEY]: stored } = await storage.get(ACCOUNT_EPOCH_KEY);
            let record = stored && typeof stored === 'object' ? stored : null;
            const changed = !record || record.accountId !== accountId || record.keyHash !== keyHash;
            if (changed) {
                record = { accountId, keyHash, username: session?.username || null, epoch: (record?.epoch || 0) + 1, since: now() };
                await storage.set({ [ACCOUNT_EPOCH_KEY]: record });
                if (stored) listeners.forEach(listener => { try { listener(record, stored); } catch (_) {} });
            }
            cached = { at: now(), value: { accountId, epoch: record.epoch, username: record.username || session?.username || null, since: record.since } };
            return cached.value;
        });
    }

    // { accountId, epoch, username }. accountId === null — аккаунт не определён.
    function current({ fresh = false } = {}) {
        if (!fresh && cached && now() - cached.at < cacheMs) return Promise.resolve(cached.value);
        if (!pending) pending = refresh().finally(() => { pending = null; });
        return pending;
    }

    // Бросает AccountChangedError, если аккаунт или эпоха отличаются от ожидаемых.
    async function assertCurrent(expected) {
        const state = await current({ fresh: true });
        if (!state.accountId || !expected?.accountId) throw new AccountChangedError('Аккаунт FunPay не определён.');
        if (state.accountId !== String(expected.accountId) || (expected.epoch != null && state.epoch !== expected.epoch)) {
            throw new AccountChangedError();
        }
        return state;
    }

    function invalidate() {
        cached = null;
    }

    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    return Object.freeze({ current, assertCurrent, invalidate, onChange });
}
