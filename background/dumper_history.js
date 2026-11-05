/*
 * FunPay Funcy — автодемпер: история наблюдений, решений, записей цены и ошибок.
 *
 * Хранится в IndexedDB этого браузера с привязкой к аккаунту: до 30 дней или
 * 50 000 записей на аккаунт (старые удаляются первыми). В перенос настроек не входит.
 * Запись: { accountId, key, at, type, text, data }, type —
 * observation | decision | write | error | pause | resume | gap | intent.
 */

export const HISTORY_DB_NAME = 'funcy-dumper-history';
export const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const HISTORY_MAX_PER_ACCOUNT = 50000;
const STORE = 'events';

function request(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export function createIndexedDbHistoryBackend(indexedDB) {
    if (!indexedDB) throw new Error('IndexedDB недоступна.');
    let opening = null;
    function open() {
        opening ||= new Promise((resolve, reject) => {
            const req = indexedDB.open(HISTORY_DB_NAME, 1);
            req.onupgradeneeded = () => {
                const store = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('byAccountAt', ['accountId', 'at']);
                store.createIndex('byKeyAt', ['key', 'at']);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => { opening = null; reject(req.error); };
        });
        return opening;
    }
    async function tx(mode, fn) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, mode);
            let result;
            Promise.resolve(fn(t.objectStore(STORE))).then(value => { result = value; }, reject);
            t.oncomplete = () => resolve(result);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        });
    }
    return {
        add: record => tx('readwrite', store => request(store.add(record))),
        // Новые первыми; key — одно предложение, иначе весь аккаунт.
        list: ({ accountId, key = null, limit = 200, types = null }) => tx('readonly', store => new Promise((resolve, reject) => {
            const out = [];
            const index = key ? store.index('byKeyAt') : store.index('byAccountAt');
            const range = key ? IDBKeyRange.bound([key, 0], [key, Infinity]) : IDBKeyRange.bound([accountId, 0], [accountId, Infinity]);
            const cursorReq = index.openCursor(range, 'prev');
            cursorReq.onerror = () => reject(cursorReq.error);
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (!cursor || out.length >= limit) { resolve(out); return; }
                const value = cursor.value;
                if (value.accountId === accountId && (!types || types.includes(value.type))) out.push(value);
                cursor.continue();
            };
        })),
        prune: ({ accountId, olderThan, maxCount }) => tx('readwrite', store => new Promise((resolve, reject) => {
            let kept = 0;
            let removed = 0;
            const cursorReq = store.index('byAccountAt').openCursor(IDBKeyRange.bound([accountId, 0], [accountId, Infinity]), 'prev');
            cursorReq.onerror = () => reject(cursorReq.error);
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (!cursor) { resolve(removed); return; }
                if (cursor.value.at < olderThan || kept >= maxCount) { cursor.delete(); removed += 1; }
                else kept += 1;
                cursor.continue();
            };
        }))
    };
}

// Для тестов и как запасной вариант: история в памяти.
export function createMemoryHistoryBackend() {
    const rows = [];
    let id = 0;
    return {
        rows,
        add: async record => { rows.push({ ...record, id: ++id }); return id; },
        list: async ({ accountId, key = null, limit = 200, types = null }) => rows
            .filter(r => r.accountId === accountId && (!key || r.key === key) && (!types || types.includes(r.type)))
            .sort((a, b) => b.at - a.at || b.id - a.id).slice(0, limit),
        prune: async ({ accountId, olderThan, maxCount }) => {
            const mine = rows.filter(r => r.accountId === accountId).sort((a, b) => b.at - a.at || b.id - a.id);
            const drop = new Set(mine.filter((r, index) => r.at < olderThan || index >= maxCount));
            for (let i = rows.length - 1; i >= 0; i -= 1) if (drop.has(rows[i])) rows.splice(i, 1);
            return drop.size;
        }
    };
}

export function createDumperHistory({ backend, now = () => Date.now(), log = console } = {}) {
    if (!backend) throw new Error('Хранилище истории не настроено.');
    let writes = 0;
    async function add(entry) {
        const record = {
            accountId: String(entry.accountId), key: entry.key || null, at: entry.at || now(),
            type: entry.type, text: String(entry.text || '').slice(0, 500), data: entry.data ?? null
        };
        try {
            await backend.add(record);
            writes += 1;
            if (writes % 200 === 1) await prune(record.accountId);
        } catch (error) {
            log.warn?.('FunPay Funcy: история демпера не записана:', error?.message || error);
        }
        return record;
    }
    function prune(accountId) {
        return backend.prune({ accountId: String(accountId), olderThan: now() - HISTORY_MAX_AGE_MS, maxCount: HISTORY_MAX_PER_ACCOUNT });
    }
    function list(query) {
        return backend.list({ ...query, accountId: String(query.accountId), limit: Math.min(Math.max(Number(query.limit) || 200, 1), 1000) });
    }
    return Object.freeze({ add, list, prune });
}
