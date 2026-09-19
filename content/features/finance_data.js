/**
 * FunPay Tools — Finance Data Adapter (Core Raw Access)
 *
 * Единый read-only слой доступа к сырым финансовым данным:
 * - getSalesRaw(): заказы на продажу
 * - getPurchasesRaw(): заказы на покупку
 * - getOperationsRaw(): финансовые операции по счёту
 * - getMeta(type?): метаданные коллекций (lastUpdate, count)
 *
 * Инварианты:
 * - Read-only: никаких автоматических циклов сбора/обновления;
 * - Никаких DOM queries или манипуляций;
 * - Никаких агрегаций бизнес-метрик (profit, margin, potential) до специализированных задач;
 * - Возвращает plain data / Promise<plain data>.
 */
(function (root) {
    'use strict';

    /**
     * Безопасное получение глобального объекта DB по имени.
     * Проверяет window, self, globalThis и root.
     * @param {string} name
     * @returns {Object|null}
     */
    function getDB(name) {
        if (typeof window !== 'undefined' && window[name]) return window[name];
        if (typeof self !== 'undefined' && self[name]) return self[name];
        if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
        if (root && root[name]) return root[name];
        return null;
    }

    /**
     * Нормализация метки времени: число или числовая/ISO строка -> timestamp number или null.
     * @param {*} ts
     * @returns {number|null}
     */
    function normalizeTimestamp(ts) {
        if (typeof ts === 'number' && !isNaN(ts) && ts > 0) {
            return ts;
        }
        if (typeof ts === 'string' && ts.trim().length > 0) {
            const n = Number(ts);
            if (!isNaN(n) && n > 0) return n;
            const parsed = Date.parse(ts);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return null;
    }

    /**
     * Получить сырые заказы продаж из FPTSalesDB.
     * @returns {Promise<Array<Object>>}
     */
    async function getSalesRaw() {
        try {
            const db = getDB('FPTSalesDB');
            if (db && typeof db.getAllAsArray === 'function') {
                const orders = await db.getAllAsArray();
                return Array.isArray(orders) ? orders : [];
            }
        } catch (e) {
            console.warn('[FPTFinanceData] getSalesRaw error:', e && e.message);
        }
        return [];
    }

    /**
     * Получить сырые заказы покупок из FPTPurchasesDB.
     * @returns {Promise<Array<Object>>}
     */
    async function getPurchasesRaw() {
        try {
            const db = getDB('FPTPurchasesDB');
            if (db && typeof db.getAllAsArray === 'function') {
                const orders = await db.getAllAsArray();
                return Array.isArray(orders) ? orders : [];
            }
        } catch (e) {
            console.warn('[FPTFinanceData] getPurchasesRaw error:', e && e.message);
        }
        return [];
    }

    /**
     * Получить сырые финансовые операции из FPTFinanceDB.
     * @returns {Promise<Array<Object>>}
     */
    async function getOperationsRaw() {
        try {
            const db = getDB('FPTFinanceDB');
            if (db && typeof db.getAllAsArray === 'function') {
                const txns = await db.getAllAsArray();
                return Array.isArray(txns) ? txns : [];
            }
        } catch (e) {
            console.warn('[FPTFinanceData] getOperationsRaw error:', e && e.message);
        }
        return [];
    }

    /**
     * Вспомогательное чтение ключей из chrome.storage.local.
     * @param {Array<string>} keys
     * @returns {Promise<Object>}
     */
    function readStorage(keys) {
        return new Promise((resolve) => {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(keys, (res) => {
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                            resolve({});
                            return;
                        }
                        resolve(res || {});
                    });
                } else {
                    resolve({});
                }
            } catch (_) {
                resolve({});
            }
        });
    }

    /**
     * Получить количество записей продаж.
     * @returns {Promise<number>}
     */
    async function getSalesCount() {
        try {
            const db = getDB('FPTSalesDB');
            if (db && typeof db.count === 'function') {
                const c = await db.count();
                if (typeof c === 'number' && !isNaN(c) && c >= 0) return c;
            }
        } catch (_) {}
        return 0;
    }

    /**
     * Получить количество записей покупок.
     * @returns {Promise<number>}
     */
    async function getPurchasesCount() {
        try {
            const db = getDB('FPTPurchasesDB');
            if (db && typeof db.count === 'function') {
                const c = await db.count();
                if (typeof c === 'number' && !isNaN(c) && c >= 0) return c;
            }
        } catch (_) {}
        return 0;
    }

    /**
     * Получить количество записей финансовых операций.
     * @param {Promise<Object>} [storagePromise]
     * @returns {Promise<number>}
     */
    async function getOperationsCount(storagePromise) {
        try {
            const db = getDB('FPTFinanceDB');
            if (db && typeof db.count === 'function') {
                const c = await db.count();
                if (typeof c === 'number' && !isNaN(c) && c >= 0) return c;
            }
        } catch (_) {}
        if (storagePromise) {
            try {
                const storageData = await storagePromise;
                if (storageData && typeof storageData.fpToolsFinanceCount === 'number') {
                    return storageData.fpToolsFinanceCount;
                }
            } catch (_) {}
        }
        return 0;
    }

    /**
     * Получить метаданные по финансовым данным (даты последних обновлений, счётчики).
     * @param {'sales'|'purchases'|'operations'|'lastUpdate'} [type] Опциональный ключ среза ('sales'|'purchases'|'operations'|'lastUpdate').
     * @returns {Promise<Object|number|null>}
     */
    async function getMeta(type) {
        const storagePromise = readStorage([
            'fpToolsSalesLastUpdate',
            'fpToolsPurchasesLastUpdate',
            'fpToolsFinanceLastUpdate',
            'fpToolsFinanceCount'
        ]);

        const [storageData, salesCount, purchasesCount, operationsCount] = await Promise.all([
            storagePromise,
            getSalesCount(),
            getPurchasesCount(),
            getOperationsCount(storagePromise)
        ]);

        const salesLastUpdate = normalizeTimestamp(storageData.fpToolsSalesLastUpdate);
        const purchasesLastUpdate = normalizeTimestamp(storageData.fpToolsPurchasesLastUpdate);
        const operationsLastUpdate = normalizeTimestamp(storageData.fpToolsFinanceLastUpdate);

        const timestamps = [salesLastUpdate, purchasesLastUpdate, operationsLastUpdate].filter(
            t => typeof t === 'number' && !isNaN(t) && t > 0
        );
        const overallLastUpdate = timestamps.length ? Math.max(...timestamps) : null;

        const meta = {
            sales: {
                lastUpdate: salesLastUpdate,
                count: salesCount
            },
            purchases: {
                lastUpdate: purchasesLastUpdate,
                count: purchasesCount
            },
            operations: {
                lastUpdate: operationsLastUpdate,
                count: operationsCount
            },
            lastUpdate: overallLastUpdate
        };

        if (type !== undefined && type !== null) {
            return Object.prototype.hasOwnProperty.call(meta, type) ? meta[type] : null;
        }
        return meta;
    }

    const api = {
        getSalesRaw,
        getPurchasesRaw,
        getOperationsRaw,
        getMeta
    };

    root.FPTFinanceData = api;
    if (typeof window !== 'undefined') {
        window.FPTFinanceData = api;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.FPTFinanceData = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
