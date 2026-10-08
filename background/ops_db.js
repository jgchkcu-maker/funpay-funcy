/*
 * FunPay Funcy — журнал заказов и операций (IndexedDB `fpt-ops-db`).
 *
 * Зачем: любая внешняя операция (выдача товара, смена цены)
 * сначала записывается сюда, потом выполняется. Если service worker остановится
 * посреди отправки, при следующем запуске операция в состоянии `sending` станет
 * `uncertain` и не будет повторена вслепую.
 *
 * Хранилища:
 *   orders        — заказы версии 1 (ключ orderId, без аккаунта): только наблюдение,
 *                   по ним ничего не исполняется автоматически;
 *   accountOrders — проекция заказа по аккаунту (ключ `${accountId}:${orderId}`):
 *                   результат, выдача, статус FunPay и проблемы раздельно;
 *   ops           — попытки внешних эффектов (ключ key, например `delivery:<acc>:<id>:1`);
 *   events        — неизменяемая история решений и результатов по заказу;
 *   parts         — части выдачи с собственным состоянием и квитанцией;
 *   reminders     — задачи напоминаний об отзыве и их итоговые отметки;
 *   stock         — локальный склад (единицы пулов);
 *   meta          — служебные значения.
 *
 * Модуль не обращается к chrome.* и indexedDB напрямую: бэкенд передаётся снаружи,
 * поэтому в node-тестах используется createMemoryBackend().
 */

export const OPS_DB_NAME = 'fpt-ops-db';
export const OPS_DB_VERSION = 4;
// Хранилища удалённого модуля поставщиков; при обновлении схемы удаляются.
const RETIRED_STORES = Object.freeze(['results', 'budgets', 'reservations', 'tombstones', 'costs']);

const STORES = Object.freeze({
    orders: 'orderId',
    ops: 'key',
    stock: 'id',
    meta: 'k',
    accountOrders: 'key',
    events: 'id',
    parts: 'partId',
    reminders: 'key'
});

const INDEXES = Object.freeze({
    ops: [['state', 'state'], ['orderId', 'orderId']],
    stock: [['poolId', 'poolId']],
    accountOrders: [['accountId', 'accountId']],
    events: [['orderKey', 'orderKey']],
    parts: [['opKey', 'opKey']],
    reminders: [['state', 'state']]
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

export const PART_STATES = Object.freeze(['pending', 'sending', 'confirmed', 'accepted', 'rejected', 'uncertain', 'manual']);

const ORDER_ID_RE = /^[A-Z0-9]{8}$/;
const ACCOUNT_ID_RE = /^\d+$/;
// Однажды записанные значения, которые повторные события не должны сдвигать.
const WRITE_ONCE_ORDER_FIELDS = new Set(['purchasedAt', 'verifiedFulfillmentCompletedAt', 'fpConfirmedAt', 'firstPaidSeenAt']);

export function canTransitionOp(from, to) {
    return (OP_TRANSITIONS[from] || []).includes(to);
}

export function orderKeyOf(accountId, orderId) {
    const account = String(accountId || '');
    const order = String(orderId || '').replace(/^#/, '').toUpperCase();
    if (!ACCOUNT_ID_RE.test(account)) throw new Error('Некорректный аккаунт заказа.');
    if (!ORDER_ID_RE.test(order)) throw new Error('Некорректный номер заказа.');
    return `${account}:${order}`;
}

export class RevisionConflictError extends Error {
    constructor(message = 'Запись изменилась — обновите карточку и повторите действие.') {
        super(message);
        this.name = 'RevisionConflictError';
        this.code = 'conflict';
    }
}

function clone(value) {
    return value == null ? value : structuredClone(value);
}

// Последовательная очередь: каждая операция памяти выполняется целиком, как транзакция IDB.
function createMutex() {
    let tail = Promise.resolve();
    return task => {
        const run = tail.then(task, task);
        tail = run.catch(() => {});
        return run;
    };
}

export function createMemoryBackend() {
    const data = new Map(Object.keys(STORES).map(name => [name, new Map()]));
    const exclusive = createMutex();

    function storeOf(name, source = data) {
        const store = source.get(name);
        if (!store) throw new Error(`Неизвестное хранилище журнала: ${name}`);
        return store;
    }

    function txFor(source) {
        return {
            async get(name, key) { return clone(storeOf(name, source).get(key)); },
            async getAll(name) { return [...storeOf(name, source).values()].map(clone); },
            async put(name, record) { storeOf(name, source).set(record[STORES[name]], clone(record)); },
            async delete(name, key) { storeOf(name, source).delete(key); }
        };
    }

    return Object.freeze({
        get(name, key) { return exclusive(() => txFor(data).get(name, key)); },
        getAll(name) { return exclusive(() => txFor(data).getAll(name)); },
        put(name, record) { return exclusive(() => txFor(data).put(name, record)); },
        delete(name, key) { return exclusive(() => txFor(data).delete(name, key)); },
        update(name, key, mutate) {
            return exclusive(() => {
                const store = storeOf(name);
                const next = mutate(clone(store.get(key)));
                if (next === undefined) return clone(store.get(key));
                if (next === null) store.delete(key);
                else store.set(key, clone(next));
                return clone(next);
            });
        },
        // Всё или ничего: тело работает с копией и применяется только без ошибок.
        transact(names, body) {
            return exclusive(async () => {
                const draft = new Map(names.map(name => [name, new Map([...storeOf(name)].map(([k, v]) => [k, clone(v)]))]));
                const result = await body(txFor(draft));
                for (const [name, store] of draft) data.set(name, store);
                return clone(result);
            });
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
                for (const name of RETIRED_STORES) {
                    if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
                }
                for (const [name, keyPath] of Object.entries(STORES)) {
                    const store = db.objectStoreNames.contains(name)
                        ? req.transaction.objectStore(name)
                        : db.createObjectStore(name, { keyPath });
                    for (const [indexName, path] of INDEXES[name] || []) {
                        if (!store.indexNames.contains(indexName)) store.createIndex(indexName, path, { unique: false });
                    }
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

    function request(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
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
        },
        // Одна readwrite-транзакция на несколько хранилищ. Тело может ждать только
        // запросы этой же транзакции (tx.get/put), иначе IDB завершит её раньше времени.
        async transact(names, body) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(names, 'readwrite');
                let result;
                let failure = null;
                tx.oncomplete = () => resolve(result);
                tx.onabort = () => reject(failure || tx.error || new Error('Транзакция журнала прервана.'));
                tx.onerror = () => { if (!failure) reject(tx.error); };
                const api = {
                    get: (name, key) => request(tx.objectStore(name).get(key)),
                    getAll: name => request(tx.objectStore(name).getAll()),
                    put: (name, record) => request(tx.objectStore(name).put(record)),
                    delete: (name, key) => request(tx.objectStore(name).delete(key))
                };
                Promise.resolve().then(() => body(api)).then(value => { result = value; }, error => {
                    failure = error;
                    try { tx.abort(); } catch (_) {}
                });
            });
        }
    });
}

function hasValue(value) {
    return value !== undefined && value !== null && value !== '';
}

function randomId(prefix, now) {
    return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOpsJournal({ backend, now = () => Date.now(), instanceId } = {}) {
    if (!backend) throw new Error('Не задан бэкенд журнала операций.');
    const owner = instanceId || `sw-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // --- Заказы версии 1 (без аккаунта) -------------------------------------------
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

    // --- Проекция заказа по аккаунту ---------------------------------------------
    function mergeOrder(current, fields, { accountId, orderId, key, source }) {
        const at = now();
        const next = {
            ...(current || {
                key, accountId, orderId, firstSeenAt: at, sources: [], revision: 0,
                resultCoverage: 'none', deliveryState: 'none',
                fpStatus: 'unknown', problemState: 'none', holds: [], fulfillmentGeneration: 1
            })
        };
        for (const [field, value] of Object.entries(fields || {})) {
            if (['key', 'accountId', 'orderId', 'source', 'firstSeenAt', 'sources', 'revision', 'expectedRevision'].includes(field)) continue;
            if (!hasValue(value)) continue;
            if (WRITE_ONCE_ORDER_FIELDS.has(field) && hasValue(next[field])) continue;
            next[field] = value;
        }
        if (source && !next.sources.includes(source)) next.sources = [...next.sources, source];
        next.revision = (current?.revision || 0) + 1;
        next.updatedAt = at;
        return next;
    }

    async function recordAccountOrder(fields) {
        const key = orderKeyOf(fields?.accountId, fields?.orderId);
        const [accountId, orderId] = key.split(':');
        let created = false;
        const order = await backend.update('accountOrders', key, current => {
            created = !current;
            return mergeOrder(current, fields, { accountId, orderId, key, source: fields.source || 'unknown' });
        });
        return { order, created };
    }

    async function getAccountOrder(accountId, orderId) {
        return (await backend.get('accountOrders', orderKeyOf(accountId, orderId))) || null;
    }

    async function listAccountOrders({ accountId } = {}) {
        const all = await backend.getAll('accountOrders');
        return accountId ? all.filter(order => order.accountId === String(accountId)) : all;
    }

    // mutate(order) -> новые поля (или undefined — без изменений). expectedRevision
    // защищает от команды из устаревшей карточки.
    async function updateAccountOrder(key, mutate, { expectedRevision = null } = {}) {
        return backend.update('accountOrders', key, current => {
            if (!current) throw new Error(`Заказ ${key} не найден в журнале.`);
            if (expectedRevision !== null && current.revision !== expectedRevision) throw new RevisionConflictError();
            const patch = mutate(structuredClone(current));
            if (patch === undefined) return undefined;
            // undefined в патче означает «не менять», а не «стереть».
            const defined = Object.fromEntries(Object.entries(patch).filter(([field, value]) => value !== undefined
                && !(WRITE_ONCE_ORDER_FIELDS.has(field) && hasValue(current[field]))));
            return { ...current, ...defined, key: current.key, accountId: current.accountId, orderId: current.orderId, revision: current.revision + 1, updatedAt: now() };
        });
    }

    // --- История ------------------------------------------------------------------
    async function appendEvent(orderKey, type, data = {}) {
        const at = now();
        const event = { id: randomId('ev', at), orderKey, type, at, data };
        await backend.put('events', event);
        return event;
    }

    async function listEvents(orderKey) {
        const all = await backend.getAll('events');
        return all.filter(event => event.orderKey === orderKey).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    }

    // --- Операции -----------------------------------------------------------------
    // Идемпотентный старт: второй вызов с тем же key возвращает существующую запись
    // и created=false, ничего не меняя.
    async function beginOp({ key, kind, orderId = null, orderKey = null, payload = null, state = 'pending' }) {
        if (!key || !kind) throw new Error('Для операции нужны key и kind.');
        if (!OP_STATES.includes(state) || state === 'done') throw new Error(`Недопустимое начальное состояние: ${state}`);
        let created = false;
        const op = await backend.update('ops', key, current => {
            if (current) return undefined;
            created = true;
            const at = now();
            return { key, kind, orderId, orderKey, payload, state, owner, attempts: state === 'sending' ? 1 : 0, lastError: null, createdAt: at, updatedAt: at };
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

    async function listOps({ states, kind, orderId, orderKey } = {}) {
        const all = await backend.getAll('ops');
        return all.filter(op => (!states || states.includes(op.state))
            && (!kind || op.kind === kind)
            && (!orderId || op.orderId === orderId)
            && (!orderKey || op.orderKey === orderKey));
    }

    // Операции, которые отправлял предыдущий экземпляр service worker, могли
    // как дойти, так и не дойти до FunPay — помечаем их uncertain. Свои текущие
    // отправки (owner === этот экземпляр) не трогаем: heartbeat может прийти посреди них.
    // Части выдачи в состоянии sending тоже становятся uncertain.
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
        for (const part of await backend.getAll('parts')) {
            if (part.state !== 'sending' || part.owner === owner) continue;
            await backend.update('parts', part.partId, current => (current?.state === 'sending' && current.owner !== owner
                ? { ...current, state: 'uncertain', error: 'Отправка прервана остановкой расширения.', updatedAt: now() }
                : undefined));
        }
        return recovered;
    }

    // --- Части выдачи -------------------------------------------------------------
    async function putParts(parts) {
        for (const part of parts) await backend.update('parts', part.partId, current => current || { ...part, owner: null, createdAt: now(), updatedAt: now() });
    }

    async function listParts(opKey) {
        const all = await backend.getAll('parts');
        return all.filter(part => part.opKey === opKey).sort((a, b) => a.index - b.index);
    }

    async function updatePart(partId, patch) {
        if (patch.state && !PART_STATES.includes(patch.state)) throw new Error(`Неизвестное состояние части: ${patch.state}`);
        return backend.update('parts', partId, current => {
            if (!current) throw new Error(`Часть ${partId} не найдена.`);
            return { ...current, ...patch, partId: current.partId, owner: patch.state === 'sending' ? owner : current.owner, updatedAt: now() };
        });
    }

    // Атомарно: запись попытки и события.
    // Повтор с тем же opKey возвращает существующую попытку (created=false).
    async function beginAttempt({ opKey, kind, orderKey, payload = null, state = 'pending' }) {
        if (!opKey || !kind || !orderKey) throw new Error('Для попытки нужны opKey, kind и orderKey.');
        return backend.transact(['ops', 'events'], async tx => {
            const existing = await tx.get('ops', opKey);
            if (existing) return { op: existing, created: false };
            const at = now();
            const op = {
                key: opKey, kind, orderKey, orderId: orderKey.split(':')[1] || null, payload: { ...(payload || {}) },
                state, owner, attempts: state === 'sending' ? 1 : 0, lastError: null, createdAt: at, updatedAt: at
            };
            await tx.put('ops', op);
            await tx.put('events', { id: randomId('ev', at), orderKey, type: `${kind}.attempt`, at, data: { opKey } });
            return { op, created: true };
        });
    }

    // --- Общий доступ для модулей -------------------------------------------------
    function getRecord(store, key) { return backend.get(store, key).then(value => value || null); }
    function listRecords(store) { return backend.getAll(store); }
    function putRecord(store, record) { return backend.put(store, record); }
    function updateRecord(store, key, mutate) { return backend.update(store, key, mutate); }
    function deleteRecord(store, key) { return backend.delete(store, key); }
    function transact(stores, body) { return backend.transact(stores, body); }

    async function getMeta(k) {
        return (await backend.get('meta', k))?.v;
    }

    async function setMeta(k, v) {
        await backend.put('meta', { k, v });
    }

    // Удаляет завершённые операции и заказы старше maxAgeMs; незавершённые не трогает.
    // Итоговые отметки напоминаний не удаляются: по ним защищается повтор сообщений.
    async function prune(maxAgeMs) {
        const border = now() - maxAgeMs;
        const ops = await backend.getAll('ops');
        const liveOrders = new Set();
        const liveOrderKeys = new Set();
        let removed = 0;
        for (const op of ops) {
            const finished = op.state === 'done' || op.state === 'failed';
            if (finished && op.updatedAt < border) {
                await backend.delete('ops', op.key);
                for (const part of await listParts(op.key)) await backend.delete('parts', part.partId);
                removed += 1;
            } else {
                if (op.orderId) liveOrders.add(op.orderId);
                if (op.orderKey) liveOrderKeys.add(op.orderKey);
            }
        }
        for (const order of await backend.getAll('orders')) {
            if (order.updatedAt < border && !liveOrders.has(order.orderId)) {
                await backend.delete('orders', order.orderId);
                removed += 1;
            }
        }
        for (const order of await backend.getAll('accountOrders')) {
            const settled = ['done', 'none', 'cancelled'].includes(order.deliveryState);
            if (order.updatedAt < border && settled && !liveOrderKeys.has(order.key)) {
                await backend.delete('accountOrders', order.key);
                for (const event of await listEvents(order.key)) await backend.delete('events', event.id);
                removed += 1;
            }
        }
        return removed;
    }

    return Object.freeze({
        owner,
        recordOrder, getOrder, listOrders,
        recordAccountOrder, getAccountOrder, listAccountOrders, updateAccountOrder,
        appendEvent, listEvents,
        beginOp, transitionOp, getOp, listOps, recoverInterruptedOps,
        putParts, listParts, updatePart,
        beginAttempt,
        getRecord, listRecords, putRecord, updateRecord, deleteRecord, transact,
        getMeta, setMeta, prune
    });
}
