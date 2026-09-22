/*
 * FunPay Funcy — хранилище заказов в IndexedDB.
 *
 * Зачем: раньше все заказы лежали одним объектом в chrome.storage.local,
 * который ограничен ~10 МБ. На ~18800 заказах квота кончалась
 * (Resource::kQuotaBytes quota exceeded) и сбор статистики падал.
 * IndexedDB такого лимита не имеет — туда влезают все 65к+ заказов.
 *
 * Экспортирует глобальный объект FPTSalesDB со следующим API:
 *   await FPTSalesDB.putOrders(arrayOfOrders)   — добавить/обновить заказы (ключ orderId)
 *   await FPTSalesDB.getAllAsMap()              — { orderId: order, ... } (как старый fpToolsSalesData)
 *   await FPTSalesDB.getAllAsArray()            — [order, ...]
 *   await FPTSalesDB.count()                    — число заказов
 *   await FPTSalesDB.getMeta(key)               — служебное значение (firstOrderId/lastOrderId/lastUpdate)
 *   await FPTSalesDB.setMeta(key, value)
 *   await FPTSalesDB.clearAll()                 — стереть всё
 *   await FPTSalesDB.migrateFromLocalStorage()  — однократный перенос старых данных из chrome.storage.local
 */
(function (root) {
    'use strict';

    const DB_NAME = 'fpt-sales-db';
    const DB_VERSION = 1;
    const STORE_ORDERS = 'orders';
    const STORE_META = 'meta';

    let _dbPromise = null;

    function openDB() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_ORDERS)) {
                    const os = db.createObjectStore(STORE_ORDERS, { keyPath: 'orderId' });
                    os.createIndex('orderDate', 'orderDate', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META, { keyPath: 'k' });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => { db.close(); _dbPromise = null; };
                db.onclose = () => { _dbPromise = null; };
                resolve(db);
            };
            req.onerror = () => { _dbPromise = null; reject(req.error); };
            req.onblocked = () => { _dbPromise = null; reject(new Error('IndexedDB open blocked')); };
        });
        return _dbPromise;
    }

    function txDone(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error || new Error('tx aborted'));
            tx.onerror = () => reject(tx.error);
        });
    }

    let _costBasisOverrideForTesting = null;

    function setCostBasisOverrideForTesting(map) {
        _costBasisOverrideForTesting = map;
    }

    async function getCostBasisSnapshot(offerId) {
        if (offerId == null) return null;
        const id = String(offerId).trim();
        if (!id) return null;

        // 1. Testing override if provided
        if (_costBasisOverrideForTesting && _costBasisOverrideForTesting[id]) {
            const entry = _costBasisOverrideForTesting[id];
            if (entry && typeof entry.amount === 'number' && entry.amount > 0) {
                return {
                    costBasisSnapshot: entry.amount,
                    costBasisCurrency: entry.currency || 'RUB',
                    costBasisCapturedAt: Date.now()
                };
            }
        }

        // 2. FPTCostBasis if available in runtime
        if (root.FPTCostBasis && typeof root.FPTCostBasis.createSnapshot === 'function') {
            try {
                const snap = await root.FPTCostBasis.createSnapshot(id);
                if (snap) return snap;
            } catch (_) {}
        }
        if (root.FPTCostBasis && typeof root.FPTCostBasis.get === 'function') {
            try {
                const entry = await root.FPTCostBasis.get(id);
                if (entry && typeof entry.amount === 'number' && entry.amount > 0) {
                    return {
                        costBasisSnapshot: entry.amount,
                        costBasisCurrency: entry.currency || 'RUB',
                        costBasisCapturedAt: Date.now()
                    };
                }
            } catch (_) {}
        }

        // 3. Direct chrome.storage.local read (works in Service Worker)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                const data = await chrome.storage.local.get(['fpToolsCostBasis']);
                const store = data && data.fpToolsCostBasis;
                const entry = store && store.offers && store.offers[id];
                if (entry && typeof entry.amount === 'number' && entry.amount > 0) {
                    return {
                        costBasisSnapshot: entry.amount,
                        costBasisCurrency: entry.currency || 'RUB',
                        costBasisCapturedAt: Date.now()
                    };
                }
            } catch (_) {}
        }

        return null;
    }

    async function getExistingOrdersMap(ids) {
        if (!ids || !ids.length) return {};
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_ORDERS, 'readonly');
            const store = tx.objectStore(STORE_ORDERS);
            const map = {};
            let remaining = ids.length;
            for (const id of ids) {
                if (!id) {
                    if (--remaining === 0) resolve(map);
                    continue;
                }
                const req = store.get(id);
                req.onsuccess = () => {
                    if (req.result) map[id] = req.result;
                    if (--remaining === 0) resolve(map);
                };
                req.onerror = () => {
                    if (--remaining === 0) resolve(map);
                };
            }
        });
    }

    async function putOrders(orders) {
        if (!orders || !orders.length) return;
        const db = await openDB();

        // 1. Проверяем, какие заказы уже есть в базе, чтобы не делать бэкфилл старых записей
        const ids = orders.map(o => o && o.orderId).filter(Boolean);
        const existingMap = await getExistingOrdersMap(ids);

        // 2. Для действительно новых заказов с известным offerId предварительно запрашиваем снимок себестоимости
        const snapshotMap = {};
        for (const o of orders) {
            if (!o || typeof o.orderId !== 'string') continue;
            if (existingMap[o.orderId]) continue; // Уже в базе - старый заказ, бэкфилл запрещен

            // Проверяем наличие достоверного offerId от источника
            const rawOfferId = (o.offerId != null && String(o.offerId).trim() !== '')
                ? String(o.offerId).trim()
                : null;

            if (rawOfferId && !snapshotMap[rawOfferId]) {
                snapshotMap[rawOfferId] = await getCostBasisSnapshot(rawOfferId);
            }
        }

        // 3. Открываем транзакцию на запись и сохраняем заказы
        const tx = db.transaction(STORE_ORDERS, 'readwrite');
        const store = tx.objectStore(STORE_ORDERS);

        for (const o of orders) {
            if (!o || typeof o.orderId !== 'string') continue;

            const existing = existingMap[o.orderId];
            if (existing) {
                // СУЩЕСТВУЮЩИЙ ЗАКАЗ:
                // Если у него уже был зафиксирован снимок себестоимости - сохраняем его неизменным
                if (existing.costBasisSnapshot !== undefined) {
                    o.costBasisSnapshot = existing.costBasisSnapshot;
                    o.costBasisCurrency = existing.costBasisCurrency;
                    o.costBasisCapturedAt = existing.costBasisCapturedAt;
                }
                if (existing.offerId && !o.offerId) {
                    o.offerId = existing.offerId;
                }
                // ВАЖНО: Никакого автоматического бэкфилла для старых заказов без снимка!
            } else {
                // НОВЫЙ ЗАКАЗ:
                const rawOfferId = (o.offerId != null && String(o.offerId).trim() !== '')
                    ? String(o.offerId).trim()
                    : null;

                if (rawOfferId) {
                    o.offerId = rawOfferId;
                    if (o.costBasisSnapshot === undefined) {
                        const snap = snapshotMap[rawOfferId];
                        if (snap) {
                            o.costBasisSnapshot = snap.costBasisSnapshot;
                            o.costBasisCurrency = snap.costBasisCurrency;
                            o.costBasisCapturedAt = snap.costBasisCapturedAt;
                        }
                    }
                } else {
                    // Если offerId неизвестен - снимок строго отсутствует (не угадывать по title/description!)
                    delete o.costBasisSnapshot;
                    delete o.costBasisCurrency;
                    delete o.costBasisCapturedAt;
                }
            }

            store.put(o);
        }
        await txDone(tx);
    }

    async function getAllAsArray() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(STORE_ORDERS, 'readonly').objectStore(STORE_ORDERS).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllAsMap() {
        const arr = await getAllAsArray();
        const map = {};
        for (const o of arr) map[o.orderId] = o;
        return map;
    }

    async function count() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(STORE_ORDERS, 'readonly').objectStore(STORE_ORDERS).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getMeta(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key);
            req.onsuccess = () => resolve(req.result ? req.result.v : null);
            req.onerror = () => reject(req.error);
        });
    }

    async function setMeta(key, value) {
        const db = await openDB();
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({ k: key, v: value });
        await txDone(tx);
    }

    async function clearAll() {
        const db = await openDB();
        const tx = db.transaction([STORE_ORDERS, STORE_META], 'readwrite');
        tx.objectStore(STORE_ORDERS).clear();
        tx.objectStore(STORE_META).clear();
        await txDone(tx);
    }

    // Однократный перенос старых данных из chrome.storage.local в IndexedDB.
    // Возвращает число перенесённых заказов. Если в IndexedDB уже что-то есть
    // или мигрировать нечего — возвращает 0 и ничего не трогает.
    async function migrateFromLocalStorage() {
        try {
            const already = await count();
            const flag = await getMeta('migratedFromLocal');
            if (flag) return 0;
            if (already > 0) { await setMeta('migratedFromLocal', true); return 0; }

            const data = await chrome.storage.local.get([
                'fpToolsSalesData', 'fpToolsFirstOrderId', 'fpToolsLastOrderId', 'fpToolsSalesLastUpdate'
            ]);
            const old = data.fpToolsSalesData;
            if (!old || typeof old !== 'object') { await setMeta('migratedFromLocal', true); return 0; }

            const orders = Object.values(old).filter(o => o && typeof o.orderId === 'string');
            if (orders.length) await putOrders(orders);

            if (data.fpToolsFirstOrderId) await setMeta('firstOrderId', data.fpToolsFirstOrderId);
            if (data.fpToolsLastOrderId) await setMeta('lastOrderId', data.fpToolsLastOrderId);
            if (data.fpToolsSalesLastUpdate) await setMeta('lastUpdate', data.fpToolsSalesLastUpdate);
            await setMeta('migratedFromLocal', true);

            // Освобождаем квоту: убираем гигантский объект из storage.local.
            // Оставляем lastUpdate как маленькое значение для обратной совместимости UI.
            try {
                await chrome.storage.local.remove(['fpToolsSalesData', 'fpToolsFirstOrderId', 'fpToolsLastOrderId']);
            } catch (_) {}

            console.log(`FunPay Funcy: перенесено ${orders.length} заказов из storage.local в IndexedDB. Квота освобождена.`);
            return orders.length;
        } catch (e) {
            console.warn('FunPay Funcy: миграция заказов в IndexedDB не удалась:', e && e.message);
            return 0;
        }
    }

    const api = {
        putOrders,
        getAllAsArray,
        getAllAsMap,
        count,
        getMeta,
        setMeta,
        clearAll,
        migrateFromLocalStorage,
        getCostBasisSnapshot,
        setCostBasisOverrideForTesting
    };

    root.FPTSalesDB = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
