/*
 * FunPay Funcy — журнал заказов и операций (IndexedDB `fpt-ops-db`).
 *
 * Зачем: любая внешняя операция (выдача товара, заказ у поставщика, смена цены)
 * сначала записывается сюда, потом выполняется. Если service worker остановится
 * посреди отправки, при следующем запуске операция в состоянии `sending` станет
 * `uncertain` и не будет повторена вслепую.
 *
 * Хранилища:
 *   orders — заказы FunPay (ключ orderId), чтобы функции знали покупателя, чат и лот;
 *   ops    — попытки операций (ключ key, например `delivery:ABCD1234`);
 *   stock  — склад (этап 2);
 *   meta   — служебные значения.
 *
 * Модуль не обращается к chrome.* и indexedDB напрямую: бэкенд передаётся снаружи,
 * поэтому в node-тестах используется createMemoryBackend().
 */

export const OPS_DB_NAME = 'fpt-ops-db';
export const OPS_DB_VERSION = 1;

const STORES = Object.freeze({
    orders: 'orderId',
    ops: 'key',
    stock: 'id',
    meta: 'k'
});

export const OP_STATES = Object.freeze(['pending', 'sending', 'done', 'uncertain', 'failed']);

// failed -> sending нужен для повторной попытки после однозначного отказа FunPay.
// uncertain -> pending — только ручное решение продавца «отправить ещё раз».
const OP_TRANSITIONS = Object.freeze({
    pending: ['sending', 'done', 'failed'],
    sending: ['done', 'uncertain', 'failed'],
    uncertain: ['done', 'failed', 'pending'],
    failed: ['sending', 'pending'],
    done: []
});

const ORDER_ID_RE = /^[A-Z0-9]{8}$/;
// Однажды записанные значения, которые повторные события не должны сдвигать.
const WRITE_ONCE_ORDER_FIELDS = new Set(['purchasedAt']);

export function canTransitionOp(from, to) {
    return (OP_TRANSITIONS[from] || []).includes(to);
}

function clone(value) {
    return value == null ? value : structuredClone(value);
}

export function createMemoryBackend() {
    const data = new Map(Object.keys(STORES).map(name => [name, new Map()]));

    function storeOf(name) {
        const store = data.get(name);
        if (!store) throw new Error(`Неизвестное хранилище журнала: ${name}`);
        return store;
    }

    return Object.freeze({
        async get(name, key) {
            return clone(storeOf(name).get(key));
        },
        async getAll(name) {
            return [...storeOf(name).values()].map(clone);
        },
        async put(name, record) {
            storeOf(name).set(record[STORES[name]], clone(record));
        },
        async delete(name, key) {
            storeOf(name).delete(key);
        },
        // Чтение и запись без await между ними — так же атомарно, как одна транзакция IDB.
        async update(name, key, mutate) {
            const store = storeOf(name);
            const next = mutate(clone(store.get(key)));
            if (next === undefined) return clone(store.get(key));
            if (next === null) store.delete(key);
            else store.set(key, clone(next));
            return clone(next);
        }
    });
}

export function createIndexedDbBackend(idb, dbName = OPS_DB_NAME) {
    if (!idb || typeof idb.open !== 'function') throw new Error('IndexedDB недоступна.');
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = idb.open(dbName, OPS_DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                for (const [name, keyPath] of Object.entries(STORES)) {
                    if (db.objectStoreNames.contains(name)) continue;
                    const store = db.createObjectStore(name, { keyPath });
                    if (name === 'ops') {
                        store.createIndex('state', 'state', { unique: false });
                        store.createIndex('orderId', 'orderId', { unique: false });
                    }
                    if (name === 'stock') store.createIndex('poolId', 'poolId', { unique: false });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => { db.close(); dbPromise = null; };
                db.onclose = () => { dbPromise = null; };
                resolve(db);
            };
            req.onerror = () => { dbPromise = null; reject(req.error); };
            req.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB open blocked')); };
        });
        return dbPromise;
    }

    async function run(name, mode, body) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(name, mode);
            let result;
            let failure = null;
            const fail = error => {
                failure = error;
                try { tx.abort(); } catch (_) {}
            };
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(failure || tx.error || new Error('Транзакция журнала прервана.'));
            tx.onerror = () => { if (!failure) reject(tx.error); };
            body(tx.objectStore(name), value => { result = value; }, fail);
        });
    }

    return Object.freeze({
        get(name, key) {
            return run(name, 'readonly', (store, done) => {
                const req = store.get(key);
                req.onsuccess = () => done(req.result);
            });
        },
        getAll(name) {
            return run(name, 'readonly', (store, done) => {
                const req = store.getAll();
                req.onsuccess = () => done(req.result || []);
            });
        },
        put(name, record) {
            return run(name, 'readwrite', store => { store.put(record); });
        },
        delete(name, key) {
            return run(name, 'readwrite', store => { store.delete(key); });
        },
        // get + put в одной readwrite-транзакции: параллельные update по одному ключу
        // выполняются строго по очереди.
        update(name, key, mutate) {
            return run(name, 'readwrite', (store, done, fail) => {
                const req = store.get(key);
                req.onsuccess = () => {
                    const current = req.result;
                    let next;
                    try {
                        next = mutate(current);
                    } catch (error) {
                        fail(error);
                        return;
                    }
                    if (next === undefined) { done(current); return; }
                    if (next === null) store.delete(key);
                    else store.put(next);
                    done(next);
                };
            });
        }
    });
}

function hasValue(value) {
    return value !== undefined && value !== null && value !== '';
}

export function createOpsJournal({ backend, now = () => Date.now(), instanceId } = {}) {
    if (!backend) throw new Error('Не задан бэкенд журнала операций.');
    const owner = instanceId || `sw-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    async function recordOrder(order) {
        const orderId = String(order?.orderId || '').replace(/^#/, '').toUpperCase();
        if (!ORDER_ID_RE.test(orderId)) throw new Error('Некорректный номер заказа.');
        const source = order.source || 'unknown';
        let created = false;
        const saved = await backend.update('orders', orderId, current => {
            const at = now();
            created = !current;
            const next = { ...(current || { orderId, firstSeenAt: at, sources: [] }) };
            // Новые непустые сведения дополняют запись, пустые не затирают уже известное.
            for (const [field, value] of Object.entries(order)) {
                if (field === 'orderId' || field === 'source' || field === 'firstSeenAt' || field === 'sources') continue;
                if (!hasValue(value)) continue;
                if (WRITE_ONCE_ORDER_FIELDS.has(field) && hasValue(next[field])) continue;
                next[field] = value;
            }
            if (!next.sources.includes(source)) next.sources = [...next.sources, source];
            next.updatedAt = at;
            return next;
        });
        return { order: saved, created };
    }

    async function getOrder(orderId) {
        return (await backend.get('orders', String(orderId || '').toUpperCase())) || null;
    }

    async function listOrders() {
        return backend.getAll('orders');
    }

    // Идемпотентный старт: второй вызов с тем же key возвращает существующую запись
    // и created=false, ничего не меняя.
    async function beginOp({ key, kind, orderId = null, payload = null, state = 'pending' }) {
        if (!key || !kind) throw new Error('Для операции нужны key и kind.');
        if (!OP_STATES.includes(state) || state === 'done') throw new Error(`Недопустимое начальное состояние: ${state}`);
        let created = false;
        const op = await backend.update('ops', key, current => {
            if (current) return undefined;
            created = true;
            const at = now();
            return { key, kind, orderId, payload, state, owner, attempts: state === 'sending' ? 1 : 0, lastError: null, createdAt: at, updatedAt: at };
        });
        return { op, created };
    }

    async function transitionOp(key, to, patch = {}) {
        if (!OP_STATES.includes(to)) throw new Error(`Неизвестное состояние операции: ${to}`);
        return backend.update('ops', key, current => {
            if (!current) throw new Error(`Операция ${key} не найдена.`);
            if (!canTransitionOp(current.state, to)) {
                throw new Error(`Переход ${current.state} → ${to} для операции ${key} запрещён.`);
            }
            return {
                ...current,
                ...patch,
                key: current.key,
                state: to,
                owner: to === 'sending' ? owner : current.owner,
                attempts: to === 'sending' ? (current.attempts || 0) + 1 : current.attempts,
                updatedAt: now()
            };
        });
    }

    async function getOp(key) {
        return (await backend.get('ops', key)) || null;
    }

    async function listOps({ states, kind, orderId } = {}) {
        const all = await backend.getAll('ops');
        return all.filter(op => (!states || states.includes(op.state))
            && (!kind || op.kind === kind)
            && (!orderId || op.orderId === orderId));
    }

    // Операции, которые отправлял предыдущий экземпляр service worker, могли
    // как дойти, так и не дойти до FunPay — помечаем их uncertain. Свои текущие
    // отправки (owner === этот экземпляр) не трогаем: heartbeat может прийти посреди них.
    async function recoverInterruptedOps() {
        const stale = (await backend.getAll('ops')).filter(op => op.state === 'sending' && op.owner !== owner);
        const recovered = [];
        for (const op of stale) {
            const next = await backend.update('ops', op.key, current => {
                if (!current || current.state !== 'sending' || current.owner === owner) return undefined;
                return { ...current, state: 'uncertain', lastError: 'Отправка прервана остановкой расширения.', updatedAt: now() };
            });
            if (next?.state === 'uncertain') recovered.push(next);
        }
        return recovered;
    }

    async function getMeta(k) {
        return (await backend.get('meta', k))?.v;
    }

    async function setMeta(k, v) {
        await backend.put('meta', { k, v });
    }

    // Удаляет завершённые операции и заказы старше maxAgeMs; незавершённые не трогает.
    async function prune(maxAgeMs) {
        const border = now() - maxAgeMs;
        const ops = await backend.getAll('ops');
        const liveOrders = new Set();
        let removed = 0;
        for (const op of ops) {
            if ((op.state === 'done' || op.state === 'failed') && op.updatedAt < border) {
                await backend.delete('ops', op.key);
                removed += 1;
            } else if (op.orderId) {
                liveOrders.add(op.orderId);
            }
        }
        for (const order of await backend.getAll('orders')) {
            if (order.updatedAt < border && !liveOrders.has(order.orderId)) {
                await backend.delete('orders', order.orderId);
                removed += 1;
            }
        }
        return removed;
    }

    return Object.freeze({
        owner,
        recordOrder, getOrder, listOrders,
        beginOp, transitionOp, getOp, listOps, recoverInterruptedOps,
        getMeta, setMeta, prune
    });
}
