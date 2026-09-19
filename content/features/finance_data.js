/**
 * FunPay Tools — Finance Data Adapter (Core + Parity Aggregations)
 *
 * Единый read-only слой доступа к финансовым данным:
 * - getSalesRaw(): сырые заказы на продажу
 * - getPurchasesRaw(): сырые заказы на покупку
 * - getOperationsRaw(): сырые финансовые операции по счёту
 * - getMeta(type?): метаданные коллекций (lastUpdate, count)
 * - getSales({ period, statuses, currency, sort }): фильтрация продаж
 * - getPurchases({ period, statuses, currency, sort }): фильтрация покупок
 * - getOperations({ period, types, currency, statuses, sort }): фильтрация операций
 * - aggregateSales(ordersOrOptions, options): агрегации продаж
 * - aggregatePurchases(ordersOrOptions, options): агрегации покупок
 * - aggregateOperations(txnsOrOptions, options): агрегации операций
 * - resolvePeriodRange(period, options): нормализация интервалов дат
 *
 * Инварианты:
 * - Read-only: никаких автоматических циклов сбора/обновления;
 * - Никаких DOM queries или манипуляций (adapter не знает про Finance Hub DOM);
 * - Покупки пользователя и операции никогда не смешиваются и не становятся себестоимостью;
 * - Валюты (RUB/USD/EUR) не смешиваются в единый денежный total;
 * - Возвраты и статусы различаются явно;
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
        if (ts instanceof Date && !isNaN(ts.getTime())) {
            return ts.getTime();
        }
        return null;
    }

    /**
     * Нормализация цены/числа.
     * @param {*} val
     * @returns {number}
     */
    function normalizePrice(val) {
        if (typeof val === 'number' && !isNaN(val)) return val;
        if (typeof val === 'string' && val.trim().length > 0) {
            const n = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(n)) return n;
        }
        return 0;
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

    // ─────────────────────────────────────────────────────────────────────────────
    // РАСЧЁТ ПЕРИОДОВ И ФИЛЬТРЫ
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Разрешить период в диапазон [start, end] в миллисекундах.
     * Поддерживает строковые пресеты ('today', 'yesterday', '24h', '7d', '30d', '90d', '365d', 'all')
     * и объекты вида { start, end } или { from, to }.
     * @param {string|Object} [period]
     * @param {Object} [options]
     * @param {number} [options.now]
     * @param {boolean} [options.useMsk] Использовать границу суток по МСК (UTC+3)
     * @returns {{ start: number|null, end: number|null, label: string, period: string }}
     */
    function resolvePeriodRange(period, options) {
        const now = (options && typeof options.now === 'number' && !isNaN(options.now))
            ? options.now
            : Date.now();
        const oneDay = 24 * 3600 * 1000;

        if (period && typeof period === 'object') {
            const start = normalizeTimestamp(period.start !== undefined ? period.start : period.from);
            const end = normalizeTimestamp(period.end !== undefined ? period.end : period.to);
            const label = period.label || (
                start && end ? 'custom' : (start ? 'custom-from' : (end ? 'custom-to' : 'всё время'))
            );
            return {
                start,
                end,
                label,
                period: period.period || 'custom'
            };
        }

        const p = typeof period === 'string' ? period.trim().toLowerCase() : 'all';

        // Расчёт полуночи текущих суток (локально или по МСК)
        let todayStart;
        if (options && options.useMsk) {
            const mskOffset = 3 * 3600 * 1000;
            todayStart = Math.floor((now + mskOffset) / oneDay) * oneDay - mskOffset;
        } else {
            const d = new Date(now);
            todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }

        switch (p) {
            case 'today':
                return { start: todayStart, end: null, label: 'сегодня', period: 'today' };
            case 'yesterday':
                return { start: todayStart - oneDay, end: todayStart, label: 'вчера', period: 'yesterday' };
            case '24h':
                return { start: now - oneDay, end: null, label: '24 часа', period: '24h' };
            case '7d':
            case 'week':
                return { start: now - 7 * oneDay, end: null, label: '7 дней', period: '7d' };
            case '30d':
            case 'month':
                return { start: now - 30 * oneDay, end: null, label: '30 дней', period: '30d' };
            case '90d':
            case 'quarter':
                return { start: now - 90 * oneDay, end: null, label: '90 дней', period: '90d' };
            case '365d':
            case 'year':
                return { start: now - 365 * oneDay, end: null, label: 'год', period: '365d' };
            case 'all':
            case 'total':
            default:
                return { start: null, end: null, label: 'всё время', period: 'all' };
        }
    }

    /**
     * Проверка статуса заказа по фильтру.
     * Поддерживает:
     * - строку (например, 'closed')
     * - массив строк (['closed', 'paid'])
     * - Set строк
     * - объект флагов (например, { stClosed: true, stPaid: true, stRefunded: false } или { closed: true })
     * @param {string} status
     * @param {*} filter
     * @returns {boolean}
     */
    function isStatusAllowed(status, filter) {
        if (filter === undefined || filter === null || filter === '' || filter === 'all') {
            return true;
        }
        const st = String(status || '').toLowerCase();
        if (typeof filter === 'string') {
            return st === filter.toLowerCase();
        }
        if (Array.isArray(filter)) {
            return filter.some(f => String(f).toLowerCase() === st);
        }
        if (filter instanceof Set) {
            for (const item of filter) {
                if (String(item).toLowerCase() === st) return true;
            }
            return false;
        }
        if (typeof filter === 'object') {
            const aliases = {
                closed: ['closed', 'stClosed'],
                paid: ['paid', 'stPaid'],
                refunded: ['refunded', 'stRefunded'],
                complete: ['complete', 'stComplete'],
                cancel: ['cancel', 'cancelled', 'stCancel', 'stCancelled'],
                waiting: ['waiting', 'stWaiting']
            };

            const targetAliases = aliases[st] || [st];
            for (const key of targetAliases) {
                if (typeof filter[key] === 'boolean') {
                    return filter[key];
                }
            }
            if (typeof filter[status] === 'boolean') {
                return filter[status];
            }

            const knownKeys = ['closed', 'stClosed', 'paid', 'stPaid', 'refunded', 'stRefunded', 'complete', 'cancel', 'waiting'];
            const matchesAnyKnown = knownKeys.some(k => filter[k] !== undefined);

            if (matchesAnyKnown) {
                if (aliases[st]) return false;
                // Неизвестные статусы не прячем в режиме флагов (паритет с sales_modes.js line 64)
                return true;
            }

            const hasTrue = Object.values(filter).some(v => v === true);
            if (hasTrue) return false;
            return true;
        }
        return true;
    }

    /**
     * Проверка типа операции по фильтру.
     * @param {string} type
     * @param {*} filter
     * @returns {boolean}
     */
    function isTypeAllowed(type, filter) {
        if (filter === undefined || filter === null || filter === '' || filter === 'all') {
            return true;
        }
        const tp = String(type || '').toLowerCase();
        if (typeof filter === 'string') {
            return tp === filter.toLowerCase();
        }
        if (Array.isArray(filter)) {
            return filter.some(f => String(f).toLowerCase() === tp);
        }
        if (filter instanceof Set) {
            for (const item of filter) {
                if (String(item).toLowerCase() === tp) return true;
            }
            return false;
        }
        if (typeof filter === 'object') {
            if (typeof filter[tp] === 'boolean') return filter[tp];
            if (typeof filter[type] === 'boolean') return filter[type];
            const hasTrue = Object.values(filter).some(v => v === true);
            if (hasTrue) return false;
            return true;
        }
        return true;
    }

    /**
     * Проверка валюты по фильтру.
     * @param {string} currency
     * @param {*} filter
     * @returns {boolean}
     */
    function isCurrencyAllowed(currency, filter) {
        if (filter === undefined || filter === null || filter === '' || filter === 'all') {
            return true;
        }
        const cur = String(currency || '').toUpperCase();
        if (typeof filter === 'string') {
            return cur === filter.toUpperCase();
        }
        if (Array.isArray(filter)) {
            return filter.some(f => String(f).toUpperCase() === cur);
        }
        if (filter instanceof Set) {
            for (const item of filter) {
                if (String(item).toUpperCase() === cur) return true;
            }
            return false;
        }
        if (typeof filter === 'object') {
            if (typeof filter[cur] === 'boolean') return filter[cur];
            if (typeof filter[cur.toLowerCase()] === 'boolean') return filter[cur.toLowerCase()];
            const hasTrue = Object.values(filter).some(v => v === true);
            if (hasTrue) return false;
            return true;
        }
        return true;
    }

    /**
     * Сортировка заказов (по дате или цене).
     * @param {Array<Object>} arr
     * @param {string|Function|false} [sort='date-desc']
     * @returns {Array<Object>}
     */
    function sortOrders(arr, sort) {
        const a = Array.isArray(arr) ? arr.slice() : [];
        if (typeof sort === 'function') {
            return a.sort(sort);
        }
        if (sort === false || sort === 'none') {
            return a;
        }
        const getDate = o => typeof o.orderDate === 'number' ? o.orderDate : (normalizeTimestamp(o.orderDate) || 0);
        const getPrice = o => normalizePrice(o.price);

        switch (sort) {
            case 'date-asc':
                return a.sort((x, y) => getDate(x) - getDate(y));
            case 'price-desc':
                return a.sort((x, y) => getPrice(y) - getPrice(x));
            case 'price-asc':
                return a.sort((x, y) => getPrice(x) - getPrice(y));
            case 'date-desc':
            default:
                return a.sort((x, y) => getDate(y) - getDate(x));
        }
    }

    /**
     * Сортировка финансовых операций.
     * @param {Array<Object>} arr
     * @param {string|Function|false} [sort='date-desc']
     * @returns {Array<Object>}
     */
    function sortOperations(arr, sort) {
        const a = Array.isArray(arr) ? arr.slice() : [];
        if (typeof sort === 'function') {
            return a.sort(sort);
        }
        if (sort === false || sort === 'none') {
            return a;
        }
        const getDate = t => typeof t.date === 'number' ? t.date : (normalizeTimestamp(t.date) || 0);
        const getAmt = t => Math.abs(typeof t.signed === 'number' ? t.signed : (parseFloat(t.signed) || (typeof t.amount === 'number' ? t.amount : (parseFloat(t.amount) || 0))));

        switch (sort) {
            case 'date-asc':
                return a.sort((x, y) => getDate(x) - getDate(y));
            case 'amt-desc':
            case 'amount-desc':
                return a.sort((x, y) => getAmt(y) - getAmt(x));
            case 'amt-asc':
            case 'amount-asc':
                return a.sort((x, y) => getAmt(x) - getAmt(y));
            case 'date-desc':
            default:
                return a.sort((x, y) => getDate(y) - getDate(x));
        }
    }

    /**
     * Внутренняя фильтрация заказов по options.
     * @param {Array<Object>} all
     * @param {Object} [options]
     * @returns {Array<Object>}
     */
    function filterOrders(all, options) {
        const list = Array.isArray(all) ? all : [];
        if (!options) return list;
        const hasPeriod = options.period !== undefined && options.period !== null;
        const range = hasPeriod ? resolvePeriodRange(options.period, { useMsk: options.useMsk }) : null;

        return list.filter(o => {
            if (range) {
                const d = typeof o.orderDate === 'number' ? o.orderDate : (normalizeTimestamp(o.orderDate) || 0);
                if (range.start && d < range.start) return false;
                if (range.end && d > range.end) return false;
            }
            if (options.statuses !== undefined && options.statuses !== null && !isStatusAllowed(o.orderStatus, options.statuses)) return false;
            if (options.currency !== undefined && options.currency !== null && !isCurrencyAllowed(o.currency, options.currency)) return false;
            if (options.category !== undefined && options.category !== null && options.category !== '' && options.category !== 'all') {
                const cat = o.subcategoryName || o.category || 'Без категории';
                if (cat.toLowerCase() !== String(options.category).toLowerCase()) return false;
            }
            return true;
        });
    }

    /**
     * Внутренняя фильтрация операций по options.
     * @param {Array<Object>} all
     * @param {Object} [options]
     * @returns {Array<Object>}
     */
    function filterOperations(all, options) {
        const list = Array.isArray(all) ? all : [];
        if (!options) return list;
        const hasPeriod = options.period !== undefined && options.period !== null;
        const useMsk = options.useMsk !== undefined ? options.useMsk : true;
        const range = hasPeriod ? resolvePeriodRange(options.period, { useMsk }) : null;

        return list.filter(t => {
            if (range) {
                const d = typeof t.date === 'number' ? t.date : (normalizeTimestamp(t.date) || 0);
                if (range.start && d < range.start) return false;
                if (range.end && d > range.end) return false;
            }
            if (options.types !== undefined && options.types !== null && !isTypeAllowed(t.type, options.types)) return false;
            if (options.currency !== undefined && options.currency !== null && !isCurrencyAllowed(t.currency, options.currency)) return false;
            if (options.statuses !== undefined && options.statuses !== null && !isStatusAllowed(t.status, options.statuses)) return false;
            return true;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // API ФИЛЬТРАЦИИ
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Получить отфильтрованные и отсортированные заказы продаж.
     * @param {Object} [options]
     * @param {string|Object} [options.period]
     * @param {string|Array<string>|Set<string>|Object} [options.statuses]
     * @param {string|Array<string>|Set<string>} [options.currency]
     * @param {string|Function|false} [options.sort='date-desc']
     * @param {boolean} [options.useMsk]
     * @returns {Promise<Array<Object>>}
     */
    async function getSales(options) {
        const all = await getSalesRaw();
        const filtered = filterOrders(all, options);
        return sortOrders(filtered, options && options.sort);
    }

    /**
     * Получить отфильтрованные и отсортированные заказы покупок.
     * @param {Object} [options]
     * @param {string|Object} [options.period]
     * @param {string|Array<string>|Set<string>|Object} [options.statuses]
     * @param {string|Array<string>|Set<string>} [options.currency]
     * @param {string|Function|false} [options.sort='date-desc']
     * @param {boolean} [options.useMsk]
     * @returns {Promise<Array<Object>>}
     */
    async function getPurchases(options) {
        const all = await getPurchasesRaw();
        const filtered = filterOrders(all, options);
        return sortOrders(filtered, options && options.sort);
    }

    /**
     * Получить отфильтрованные и отсортированные финансовые операции.
     * @param {Object} [options]
     * @param {string|Object} [options.period]
     * @param {string|Array<string>|Set<string>|Object} [options.types]
     * @param {string|Array<string>|Set<string>} [options.currency]
     * @param {string|Array<string>|Set<string>|Object} [options.statuses]
     * @param {string|Function|false} [options.sort='date-desc']
     * @param {boolean} [options.useMsk=true] По умолчанию операции используют календарь МСК
     * @returns {Promise<Array<Object>>}
     */
    async function getOperations(options) {
        const all = await getOperationsRaw();
        const filtered = filterOperations(all, options);
        return sortOperations(filtered, options && options.sort);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // API АГРЕГАЦИИ
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Чистый расчёт агрегатов продаж по переданному списку заказов.
     * @param {Array<Object>} orders
     * @param {Object} [options]
     * @returns {Object}
     */
    function calculateSalesAggregation(orders, options) {
        const list = Array.isArray(orders) ? orders : [];
        // Веса для нормализации к единой оси графика в legacy sales_modes.js:
        const rates = { RUB: 0.011, USD: 1, EUR: 1.08 };

        const byDay = {};
        const byCategory = {};
        const byCategoryRevenue = {};
        const byStatus = { closed: 0, paid: 0, refunded: 0 };
        const byCurrency = {};
        const closedRevenue = {};
        const pendingRevenue = {};
        const refundedRevenue = {};
        const currencyValidOrderCount = {};
        const byBuyer = {};
        const byProduct = {};
        const uniqueBuyerIds = new Set();

        let pendingRevenueRUB = 0;
        let revenueUSD = 0;
        let count = 0; // число завершённых/оплаченных заказов (valid)

        for (const o of list) {
            const st = o.orderStatus || 'unknown';
            if (byStatus[st] == null) byStatus[st] = 0;
            byStatus[st]++;

            const cur = String(o.currency || 'UNKNOWN').toUpperCase();
            const price = normalizePrice(o.price);
            const valid = (st === 'closed' || st === 'paid');

            // Посуточный ключ YYYY-MM-DD
            const ts = typeof o.orderDate === 'number' ? o.orderDate : (normalizeTimestamp(o.orderDate) || 0);
            const d = new Date(ts);
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!byDay[dayKey]) {
                byDay[dayKey] = {
                    count: 0,
                    total: 0,
                    validCount: 0,
                    revenue: 0,
                    revenueByCurrency: {},
                    statusCounts: {}
                };
            }
            byDay[dayKey].count++;
            byDay[dayKey].total++;
            if (!byDay[dayKey].statusCounts[st]) byDay[dayKey].statusCounts[st] = 0;
            byDay[dayKey].statusCounts[st]++;

            // Категории
            const cat = o.subcategoryName || 'Без категории';
            byCategory[cat] = (byCategory[cat] || 0) + 1;

            // Контрагент (покупатель или продавец)
            const buyer = o.buyerUsername || o.sellerUsername || o.sellerName || '-';
            const buyerId = o.buyerId || o.sellerId || 0;
            if (!byBuyer[buyer]) {
                byBuyer[buyer] = {
                    count: 0,
                    id: buyerId,
                    revenueByCurrency: {}
                };
            }
            byBuyer[buyer].count++;

            if (buyerId) {
                uniqueBuyerIds.add(String(buyerId));
            } else if (buyer !== '-') {
                uniqueBuyerIds.add(buyer);
            }

            // Товар/описание
            const prod = o.description || '-';
            byProduct[prod] = (byProduct[prod] || 0) + 1;

            // Выручка по статусам (разграничена строго по валютам)
            if (st === 'closed') {
                closedRevenue[cur] = (closedRevenue[cur] || 0) + price;
            } else if (st === 'paid') {
                pendingRevenue[cur] = (pendingRevenue[cur] || 0) + price;
                pendingRevenueRUB += price * (rates[cur] || 0) / rates.RUB;
            } else if (st === 'refunded') {
                refundedRevenue[cur] = (refundedRevenue[cur] || 0) + price;
            }

            // Учёт действительной выручки (closed + paid)
            if (valid) {
                count++;
                byCurrency[cur] = (byCurrency[cur] || 0) + price;
                currencyValidOrderCount[cur] = (currencyValidOrderCount[cur] || 0) + 1;
                revenueUSD += price * (rates[cur] || 0);

                byDay[dayKey].validCount++;
                byDay[dayKey].revenue += price * (rates[cur] || 0) / rates.RUB;
                byDay[dayKey].revenueByCurrency[cur] = (byDay[dayKey].revenueByCurrency[cur] || 0) + price;

                if (!byCategoryRevenue[cat]) byCategoryRevenue[cat] = {};
                byCategoryRevenue[cat][cur] = (byCategoryRevenue[cat][cur] || 0) + price;

                if (!byBuyer[buyer].revenueByCurrency[cur]) byBuyer[buyer].revenueByCurrency[cur] = 0;
                byBuyer[buyer].revenueByCurrency[cur] += price;
            }
        }

        // Средний чек по каждой валюте отдельно
        const averageCheck = {};
        for (const cur of Object.keys(byCurrency)) {
            const curCount = currencyValidOrderCount[cur] || 0;
            averageCheck[cur] = curCount > 0 ? byCurrency[cur] / curCount : 0;
        }

        const topBuyers = Object.entries(byBuyer)
            .map(([name, b]) => ({
                name,
                count: b.count,
                id: b.id,
                revenueByCurrency: b.revenueByCurrency
            }))
            .sort((a, b) => b.count - a.count);

        const topProducts = Object.entries(byProduct)
            .map(([name, c]) => ({ name, count: c }))
            .sort((a, b) => b.count - a.count);

        const topCategories = Object.entries(byCategory)
            .map(([name, c]) => ({ name, count: c }))
            .sort((a, b) => b.count - a.count);

        return {
            total: list.length,
            count,
            byStatus,
            byCurrency,
            closedRevenue,
            pendingRevenue,
            refundedRevenue,
            averageCheck,
            byDay,
            byCategory,
            byCategoryRevenue,
            byBuyer,
            byProduct,
            topBuyers,
            topProducts,
            topCategories,
            uniqueBuyers: uniqueBuyerIds.size,
            pendingRevenueRUB,
            revenueUSD
        };
    }

    /**
     * Агрегация продаж.
     * Принимает массив заказов или options для их загрузки.
     * @param {Array<Object>|Object} ordersOrOptions
     * @param {Object} [options]
     * @returns {Promise<Object>|Object}
     */
    function aggregateSales(ordersOrOptions, options) {
        if (!Array.isArray(ordersOrOptions)) {
            const opts = ordersOrOptions || {};
            return getSales(opts).then(orders => calculateSalesAggregation(orders, options || opts));
        }
        const list = options ? filterOrders(ordersOrOptions, options) : ordersOrOptions;
        return calculateSalesAggregation(list, options);
    }

    /**
     * Чистый расчёт агрегатов покупок по переданному списку заказов.
     * @param {Array<Object>} orders
     * @param {Object} [options]
     * @returns {Object}
     */
    function calculatePurchasesAggregation(orders, options) {
        const base = calculateSalesAggregation(orders, options);
        // Семантические алиасы для режима покупок:
        const bySeller = base.byBuyer;
        const topSellers = base.topBuyers;
        const uniqueSellers = base.uniqueBuyers;

        return Object.assign({}, base, {
            bySeller,
            topSellers,
            uniqueSellers
        });
    }

    /**
     * Агрегация покупок.
     * Принимает массив заказов или options для их загрузки.
     * ВАЖНО: покупки никогда не вычитаются из продаж и не становятся себестоимостью!
     * @param {Array<Object>|Object} ordersOrOptions
     * @param {Object} [options]
     * @returns {Promise<Object>|Object}
     */
    function aggregatePurchases(ordersOrOptions, options) {
        if (!Array.isArray(ordersOrOptions)) {
            const opts = ordersOrOptions || {};
            return getPurchases(opts).then(orders => calculatePurchasesAggregation(orders, options || opts));
        }
        const list = options ? filterOrders(ordersOrOptions, options) : ordersOrOptions;
        return calculatePurchasesAggregation(list, options);
    }

    /**
     * Чистый расчёт агрегатов финансовых операций по счёту.
     * @param {Array<Object>} txns
     * @param {Object} [options]
     * @param {boolean} [options.includeNonComplete=false]
     * @returns {Object}
     */
    function calculateOperationsAggregation(txns, options) {
        const all = Array.isArray(txns) ? txns : [];
        const rates = { RUB: 1, USD: 90, EUR: 98, UNKNOWN: 0 }; // справочные веса для динамики

        const includeNonComplete = options && options.includeNonComplete === true;
        const effectiveList = includeNonComplete
            ? all
            : all.filter(t => t.status === 'complete');

        const inByCur = {};
        const outByCur = {};
        const netByCur = {};
        const byType = {};
        const byMonth = {};
        const byDay = {};
        const byStatus = { complete: 0, cancel: 0, waiting: 0 };

        for (const t of all) {
            const st = t.status || 'unknown';
            if (byStatus[st] == null) byStatus[st] = 0;
            byStatus[st]++;
        }

        for (const t of effectiveList) {
            const cur = String(t.currency || 'UNKNOWN').toUpperCase();
            const signed = typeof t.signed === 'number' && !isNaN(t.signed)
                ? t.signed
                : (normalizePrice(t.signed) || normalizePrice(t.amount) || 0);
            const absVal = Math.abs(signed);

            const acc = signed >= 0 ? inByCur : outByCur;
            acc[cur] = (acc[cur] || 0) + absVal;

            const type = t.type || 'other';
            if (!byType[type]) {
                byType[type] = { in: {}, out: {}, net: {}, count: 0 };
            }
            const tacc = signed >= 0 ? byType[type].in : byType[type].out;
            tacc[cur] = (tacc[cur] || 0) + absVal;
            byType[type].count++;

            const ts = typeof t.date === 'number' ? t.date : (normalizeTimestamp(t.date) || 0);
            const d = new Date(ts);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const dk = `${mk}-${String(d.getDate()).padStart(2, '0')}`;
            const rub = absVal * (rates[cur] || 0);

            if (!byMonth[mk]) {
                byMonth[mk] = { in: 0, out: 0, inByCur: {}, outByCur: {}, netByCur: {}, count: 0 };
            }
            if (!byDay[dk]) {
                byDay[dk] = { in: 0, out: 0, inByCur: {}, outByCur: {}, netByCur: {}, count: 0 };
            }

            byMonth[mk].count++;
            byDay[dk].count++;

            if (signed >= 0) {
                byMonth[mk].in += rub;
                byDay[dk].in += rub;
                byMonth[mk].inByCur[cur] = (byMonth[mk].inByCur[cur] || 0) + absVal;
                byDay[dk].inByCur[cur] = (byDay[dk].inByCur[cur] || 0) + absVal;
            } else {
                byMonth[mk].out += rub;
                byDay[dk].out += rub;
                byMonth[mk].outByCur[cur] = (byMonth[mk].outByCur[cur] || 0) + absVal;
                byDay[dk].outByCur[cur] = (byDay[dk].outByCur[cur] || 0) + absVal;
            }
        }

        // Чистое сальдо (нетто) по каждой валюте раздельно
        const allCurs = new Set([...Object.keys(inByCur), ...Object.keys(outByCur)]);
        for (const c of allCurs) {
            netByCur[c] = (inByCur[c] || 0) - (outByCur[c] || 0);
        }

        // Сальдо по типам
        for (const type of Object.keys(byType)) {
            const item = byType[type];
            const typeCurs = new Set([...Object.keys(item.in), ...Object.keys(item.out)]);
            for (const c of typeCurs) {
                item.net[c] = (item.in[c] || 0) - (item.out[c] || 0);
            }
        }

        // Сальдо по месяцам и дням
        for (const mk of Object.keys(byMonth)) {
            const m = byMonth[mk];
            const mCurs = new Set([...Object.keys(m.inByCur), ...Object.keys(m.outByCur)]);
            for (const c of mCurs) {
                m.netByCur[c] = (m.inByCur[c] || 0) - (m.outByCur[c] || 0);
            }
        }
        for (const dk of Object.keys(byDay)) {
            const d = byDay[dk];
            const dCurs = new Set([...Object.keys(d.inByCur), ...Object.keys(d.outByCur)]);
            for (const c of dCurs) {
                d.netByCur[c] = (d.inByCur[c] || 0) - (d.outByCur[c] || 0);
            }
        }

        return {
            list: effectiveList,
            inByCur,
            outByCur,
            netByCur,
            byType,
            byMonth,
            byDay,
            byStatus,
            count: effectiveList.length,
            total: all.length
        };
    }

    /**
     * Агрегация финансовых операций.
     * Принимает массив операций или options для их загрузки.
     * @param {Array<Object>|Object} txnsOrOptions
     * @param {Object} [options]
     * @returns {Promise<Object>|Object}
     */
    function aggregateOperations(txnsOrOptions, options) {
        if (!Array.isArray(txnsOrOptions)) {
            const opts = txnsOrOptions || {};
            return getOperations(opts).then(txns => calculateOperationsAggregation(txns, options || opts));
        }
        const list = options ? filterOperations(txnsOrOptions, options) : txnsOrOptions;
        return calculateOperationsAggregation(list, options);
    }

    /**
     * Агрегация реализованной прибыли и покрытия (T07B).
     * Делегирует в чистый модуль FPTProfitEngine.
     * @param {Array<Object>|Object} [ordersOrOptions]
     * @param {Object} [options]
     * @returns {Promise<Object>|Object}
     */
    function aggregateProfit(ordersOrOptions, options) {
        const engine = (typeof FPTProfitEngine !== 'undefined' && FPTProfitEngine)
            ? FPTProfitEngine
            : (typeof window !== 'undefined' && window.FPTProfitEngine)
            ? window.FPTProfitEngine
            : (typeof root !== 'undefined' && root.FPTProfitEngine)
            ? root.FPTProfitEngine
            : null;

        if (!engine) {
            throw new Error('[FPTFinanceData] FPTProfitEngine is not loaded');
        }

        if (Array.isArray(ordersOrOptions)) {
            return engine.calculateProfitAggregates(ordersOrOptions, options);
        }

        return engine.getRealisedProfit(ordersOrOptions || options);
    }

    const api = {
        // Core сырые методы (T02A)
        getSalesRaw,
        getPurchasesRaw,
        getOperationsRaw,
        getMeta,

        // Методы фильтрации и нормализации (T02B)
        resolvePeriodRange,
        isStatusAllowed,
        isTypeAllowed,
        isCurrencyAllowed,
        sortOrders,
        sortOperations,
        getSales,
        getPurchases,
        getOperations,

        // Методы агрегации (T02B + T07B)
        aggregateSales,
        aggregatePurchases,
        aggregateOperations,
        aggregateProfit
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
