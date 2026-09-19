/**
 * FunPay Funcy — Finance Data Layer (FPTFinanceData)
 * 
 * Единый слой доступа к финансовым данным для Finance Hub и аналитики.
 * Полностью отвязан от текущего URL и DOM FunPay.
 * 
 * Источники данных:
 * - Продажи: FPTSalesDB
 * - Покупки: FPTPurchasesDB
 * - Операции: FPTFinanceDB
 */

(function (root) {
    'use strict';

    const ONE_DAY_MS = 24 * 3600 * 1000;
    const MSK_OFFSET_MS = 3 * 3600 * 1000; // FunPay оперирует сутками по МСК (UTC+3)

    const CURRENCY_SYMBOLS = {
        RUB: '₽',
        USD: '$',
        EUR: '€',
        UNKNOWN: ''
    };

    const APPROX_RATES = {
        RUB: 1,
        USD: 90,
        EUR: 98,
        UNKNOWN: 0
    };

    /**
     * Возвращает временные рамки для заданного периода с учётом МСК.
     * @param {string} period 'today' | 'yesterday' | '24h' | '7d' | '30d' | '365d' | 'all'
     * @returns {{ start: number|null, end: number|null, label: string }}
     */
    function getPeriodRange(period) {
        const now = Date.now();
        // Полночь текущего дня по Москве
        const mskNow = now + MSK_OFFSET_MS;
        const mskMidnight = Math.floor(mskNow / ONE_DAY_MS) * ONE_DAY_MS;
        const todayStart = mskMidnight - MSK_OFFSET_MS;

        switch (period) {
            case 'today':
                return { start: todayStart, end: null, label: 'Сегодня' };
            case 'yesterday':
                return { start: todayStart - ONE_DAY_MS, end: todayStart, label: 'Вчера' };
            case '24h':
                return { start: now - ONE_DAY_MS, end: null, label: '24 часа' };
            case '7d':
                return { start: now - 7 * ONE_DAY_MS, end: null, label: '7 дней' };
            case '30d':
                return { start: now - 30 * ONE_DAY_MS, end: null, label: '30 дней' };
            case '365d':
                return { start: now - 365 * ONE_DAY_MS, end: null, label: 'Год' };
            case 'all':
            default:
                return { start: null, end: null, label: 'Всё время' };
        }
    }

    function formatMoney(amount, currency) {
        const cur = currency || 'RUB';
        const sym = CURRENCY_SYMBOLS[cur] || cur;
        const rounded = Math.round(Number(amount) || 0).toLocaleString('ru-RU');
        return `${rounded} ${sym}`.trim();
    }

    function formatPreciseMoney(amount, currency) {
        const cur = currency || 'RUB';
        const sym = CURRENCY_SYMBOLS[cur] || cur;
        const val = Number(amount) || 0;
        const formatted = val.toLocaleString('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${formatted} ${sym}`.trim();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПРОДАЖИ (FPTSalesDB)
    // ─────────────────────────────────────────────────────────────────────────────

    async function getSales(options) {
        options = options || {};
        const range = options.range || getPeriodRange(options.period || '7d');
        const db = root.FPTSalesDB;
        if (!db || typeof db.getAllAsArray !== 'function') {
            return { orders: [], count: 0, totalCount: 0 };
        }

        const all = await db.getAllAsArray();
        const totalCount = all.length;

        const flt = options.statusFilter || { stClosed: true, stPaid: true, stRefunded: true };
        const query = options.search ? String(options.search).trim().toLowerCase() : null;

        let orders = all.filter(o => {
            if (!o) return false;
            // Фильтр по дате
            if (range.start && (o.orderDate || 0) < range.start) return false;
            if (range.end && (o.orderDate || 0) > range.end) return false;

            // Фильтр по статусу
            if (flt.stClosed === false && o.orderStatus === 'closed') return false;
            if (flt.stPaid === false && o.orderStatus === 'paid') return false;
            if (flt.stRefunded === false && o.orderStatus === 'refunded') return false;

            // Текстовый поиск
            if (query) {
                const id = String(o.orderId || '').toLowerCase();
                const desc = String(o.description || '').toLowerCase();
                const buyer = String(o.buyerUsername || '').toLowerCase();
                const cat = String(o.subcategoryName || '').toLowerCase();
                if (!id.includes(query) && !desc.includes(query) && !buyer.includes(query) && !cat.includes(query)) {
                    return false;
                }
            }

            return true;
        });

        // Сортировка
        const sort = options.sort || 'date-desc';
        orders.sort((a, b) => {
            if (sort === 'date-asc') return (a.orderDate || 0) - (b.orderDate || 0);
            if (sort === 'price-desc') return (b.price || 0) - (a.price || 0);
            if (sort === 'price-asc') return (a.price || 0) - (b.price || 0);
            return (b.orderDate || 0) - (a.orderDate || 0); // date-desc default
        });

        return {
            orders,
            count: orders.length,
            totalCount
        };
    }

    function aggregateSales(orders) {
        orders = orders || [];
        const stats = {
            totalRevenue: { RUB: 0, USD: 0, EUR: 0 },
            refundedRevenue: { RUB: 0, USD: 0, EUR: 0 },
            pendingRevenue: { RUB: 0, USD: 0, EUR: 0 },
            averageCheck: { RUB: 0, USD: 0, EUR: 0 },
            totalOrders: 0,
            totalClosed: 0,
            totalPending: 0,
            totalRefunded: 0,
            uniqueBuyersCount: 0,
            mostPopularProduct: '-',
            mostPopularCategory: '-',
            mostActiveBuyer: null,
            mostExpensiveSale: { price: 0, currency: 'RUB', orderId: '' },

            // Распределения для графиков и таблиц
            byDay: {},
            byCategory: {},
            byStatus: { closed: 0, paid: 0, refunded: 0 },
            byCurrency: { RUB: 0, USD: 0, EUR: 0 },
            byBuyer: {},
            byProduct: {},
            totalRevenueRUB: 0
        };

        const uniqueBuyers = new Set();
        const productCount = new Map();
        const categoryCount = new Map();
        const buyerMap = new Map();

        for (const o of orders) {
            const price = Number(o.price) || 0;
            const cur = o.currency || 'RUB';
            const status = o.orderStatus || 'closed';

            // Возвраты
            if (status === 'refunded') {
                stats.totalRefunded++;
                if (stats.refundedRevenue[cur] != null) {
                    stats.refundedRevenue[cur] += price;
                }
                if (stats.byStatus[status] != null) stats.byStatus[status]++;
                continue;
            }

            stats.totalOrders++;
            if (o.buyerId) uniqueBuyers.add(o.buyerId);

            if (status === 'paid') {
                stats.totalPending++;
                if (stats.pendingRevenue[cur] != null) stats.pendingRevenue[cur] += price;
            } else if (status === 'closed') {
                stats.totalClosed++;
            }

            if (stats.byStatus[status] != null) stats.byStatus[status]++;
            if (stats.totalRevenue[cur] != null) stats.totalRevenue[cur] += price;
            if (stats.byCurrency[cur] != null) stats.byCurrency[cur]++;

            const rubRate = APPROX_RATES[cur] || 0;
            const priceInRUB = price * rubRate;
            stats.totalRevenueRUB += priceInRUB;

            // Самая дорогая продажа
            const currentMaxRUB = (stats.mostExpensiveSale.price || 0) * (APPROX_RATES[stats.mostExpensiveSale.currency] || 1);
            if (priceInRUB > currentMaxRUB) {
                stats.mostExpensiveSale = { price, currency: cur, orderId: o.orderId };
            }

            // По дням
            if (o.orderDate) {
                const d = new Date(o.orderDate);
                const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!stats.byDay[dayKey]) stats.byDay[dayKey] = { count: 0, revenue: 0 };
                stats.byDay[dayKey].count++;
                stats.byDay[dayKey].revenue += priceInRUB;
            }

            // По категориям
            const cat = o.subcategoryName || 'Без категории';
            categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
            if (!stats.byCategory[cat]) stats.byCategory[cat] = { count: 0, revenue: 0 };
            stats.byCategory[cat].count++;
            stats.byCategory[cat].revenue += priceInRUB;

            // По товарам
            const desc = o.description || 'Без описания';
            productCount.set(desc, (productCount.get(desc) || 0) + 1);
            if (!stats.byProduct[desc]) stats.byProduct[desc] = { count: 0, revenue: 0 };
            stats.byProduct[desc].count++;
            stats.byProduct[desc].revenue += priceInRUB;

            // По покупателям
            const bUser = o.buyerUsername || 'Неизвестный';
            const bId = o.buyerId || 0;
            const bKey = `${bUser}|${bId}`;
            if (!buyerMap.has(bKey)) {
                buyerMap.set(bKey, { username: bUser, id: bId, count: 0, revenue: 0 });
            }
            const bData = buyerMap.get(bKey);
            bData.count++;
            bData.revenue += priceInRUB;
        }

        stats.uniqueBuyersCount = uniqueBuyers.size;

        // Средний чек
        const paidAndClosed = stats.totalClosed + stats.totalPending;
        if (paidAndClosed > 0) {
            for (const c of ['RUB', 'USD', 'EUR']) {
                stats.averageCheck[c] = stats.totalRevenue[c] / paidAndClosed;
            }
        }

        // Популярный товар
        if (productCount.size > 0) {
            const topProd = [...productCount.entries()].reduce((a, b) => b[1] > a[1] ? b : a);
            stats.mostPopularProduct = topProd[0] || '-';
        }

        // Популярная категория
        if (categoryCount.size > 0) {
            const topCat = [...categoryCount.entries()].reduce((a, b) => b[1] > a[1] ? b : a);
            stats.mostPopularCategory = topCat[0] || '-';
        }

        // Самый активный покупатель
        if (buyerMap.size > 0) {
            const topB = [...buyerMap.values()].reduce((a, b) => b.count > a.count ? b : a);
            stats.mostActiveBuyer = topB;
        }

        stats.byBuyer = Object.fromEntries(buyerMap);
        return stats;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОКУПКИ (FPTPurchasesDB)
    // ─────────────────────────────────────────────────────────────────────────────

    async function getPurchases(options) {
        options = options || {};
        const range = options.range || getPeriodRange(options.period || '7d');
        const db = root.FPTPurchasesDB;
        if (!db || typeof db.getAllAsArray !== 'function') {
            return { orders: [], count: 0, totalCount: 0 };
        }

        const all = await db.getAllAsArray();
        const totalCount = all.length;

        // Для покупок по умолчанию возвраты не учитываются в расходах
        const flt = options.statusFilter || { stClosed: true, stPaid: true, stRefunded: false };
        const query = options.search ? String(options.search).trim().toLowerCase() : null;

        let orders = all.filter(o => {
            if (!o) return false;
            if (range.start && (o.orderDate || 0) < range.start) return false;
            if (range.end && (o.orderDate || 0) > range.end) return false;

            if (flt.stClosed === false && o.orderStatus === 'closed') return false;
            if (flt.stPaid === false && o.orderStatus === 'paid') return false;
            if (flt.stRefunded === false && o.orderStatus === 'refunded') return false;

            if (query) {
                const id = String(o.orderId || '').toLowerCase();
                const desc = String(o.description || '').toLowerCase();
                const seller = String(o.sellerUsername || o.buyerUsername || '').toLowerCase();
                const cat = String(o.subcategoryName || '').toLowerCase();
                if (!id.includes(query) && !desc.includes(query) && !seller.includes(query) && !cat.includes(query)) {
                    return false;
                }
            }

            return true;
        });

        const sort = options.sort || 'date-desc';
        orders.sort((a, b) => {
            if (sort === 'date-asc') return (a.orderDate || 0) - (b.orderDate || 0);
            if (sort === 'price-desc') return (b.price || 0) - (a.price || 0);
            if (sort === 'price-asc') return (a.price || 0) - (b.price || 0);
            return (b.orderDate || 0) - (a.orderDate || 0);
        });

        return {
            orders,
            count: orders.length,
            totalCount
        };
    }

    function aggregatePurchases(orders) {
        orders = orders || [];
        const stats = {
            totalSpent: { RUB: 0, USD: 0, EUR: 0 },
            refundedAmount: { RUB: 0, USD: 0, EUR: 0 },
            pendingAmount: { RUB: 0, USD: 0, EUR: 0 },
            averageCheck: { RUB: 0, USD: 0, EUR: 0 },
            totalOrders: 0,
            totalClosed: 0,
            totalPending: 0,
            totalRefunded: 0,
            uniqueSellersCount: 0,
            mostPopularProduct: '-',
            mostPopularCategory: '-',
            mostActiveSeller: null,
            mostExpensivePurchase: { price: 0, currency: 'RUB', orderId: '' },

            byDay: {},
            byCategory: {},
            byStatus: { closed: 0, paid: 0, refunded: 0 },
            byCurrency: { RUB: 0, USD: 0, EUR: 0 },
            bySeller: {},
            byProduct: {},
            totalSpentRUB: 0
        };

        const uniqueSellers = new Set();
        const productCount = new Map();
        const categoryCount = new Map();
        const sellerMap = new Map();

        for (const o of orders) {
            const price = Number(o.price) || 0;
            const cur = o.currency || 'RUB';
            const status = o.orderStatus || 'closed';
            const sellerUsername = o.sellerUsername || o.buyerUsername || 'Неизвестный продавец';
            const sellerId = o.sellerId || o.buyerId || 0;

            if (status === 'refunded') {
                stats.totalRefunded++;
                if (stats.refundedAmount[cur] != null) {
                    stats.refundedAmount[cur] += price;
                }
                if (stats.byStatus[status] != null) stats.byStatus[status]++;
                continue;
            }

            stats.totalOrders++;
            if (sellerId) uniqueSellers.add(sellerId);

            if (status === 'paid') {
                stats.totalPending++;
                if (stats.pendingAmount[cur] != null) stats.pendingAmount[cur] += price;
            } else if (status === 'closed') {
                stats.totalClosed++;
            }

            if (stats.byStatus[status] != null) stats.byStatus[status]++;
            if (stats.totalSpent[cur] != null) stats.totalSpent[cur] += price;
            if (stats.byCurrency[cur] != null) stats.byCurrency[cur]++;

            const rubRate = APPROX_RATES[cur] || 0;
            const priceInRUB = price * rubRate;
            stats.totalSpentRUB += priceInRUB;

            // Самая дорогая покупка
            const currentMaxRUB = (stats.mostExpensivePurchase.price || 0) * (APPROX_RATES[stats.mostExpensivePurchase.currency] || 1);
            if (priceInRUB > currentMaxRUB) {
                stats.mostExpensivePurchase = { price, currency: cur, orderId: o.orderId };
            }

            // По дням
            if (o.orderDate) {
                const d = new Date(o.orderDate);
                const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!stats.byDay[dayKey]) stats.byDay[dayKey] = { count: 0, spent: 0 };
                stats.byDay[dayKey].count++;
                stats.byDay[dayKey].spent += priceInRUB;
            }

            // По категориям
            const cat = o.subcategoryName || 'Без категории';
            categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
            if (!stats.byCategory[cat]) stats.byCategory[cat] = { count: 0, spent: 0 };
            stats.byCategory[cat].count++;
            stats.byCategory[cat].spent += priceInRUB;

            // По товарам
            const desc = o.description || 'Без описания';
            productCount.set(desc, (productCount.get(desc) || 0) + 1);
            if (!stats.byProduct[desc]) stats.byProduct[desc] = { count: 0, spent: 0 };
            stats.byProduct[desc].count++;
            stats.byProduct[desc].spent += priceInRUB;

            // По продавцам
            const sKey = `${sellerUsername}|${sellerId}`;
            if (!sellerMap.has(sKey)) {
                sellerMap.set(sKey, { username: sellerUsername, id: sellerId, count: 0, spent: 0 });
            }
            const sData = sellerMap.get(sKey);
            sData.count++;
            sData.spent += priceInRUB;
        }

        stats.uniqueSellersCount = uniqueSellers.size;

        const paidAndClosed = stats.totalClosed + stats.totalPending;
        if (paidAndClosed > 0) {
            for (const c of ['RUB', 'USD', 'EUR']) {
                stats.averageCheck[c] = stats.totalSpent[c] / paidAndClosed;
            }
        }

        if (productCount.size > 0) {
            const topProd = [...productCount.entries()].reduce((a, b) => b[1] > a[1] ? b : a);
            stats.mostPopularProduct = topProd[0] || '-';
        }

        if (categoryCount.size > 0) {
            const topCat = [...categoryCount.entries()].reduce((a, b) => b[1] > a[1] ? b : a);
            stats.mostPopularCategory = topCat[0] || '-';
        }

        if (sellerMap.size > 0) {
            const topS = [...sellerMap.values()].reduce((a, b) => b.count > a.count ? b : a);
            stats.mostActiveSeller = topS;
        }

        stats.bySeller = Object.fromEntries(sellerMap);
        return stats;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ОПЕРАЦИИ БАЛАНСА (FPTFinanceDB)
    // ─────────────────────────────────────────────────────────────────────────────

    async function getOperations(options) {
        options = options || {};
        const range = options.range || getPeriodRange(options.period || '7d');
        const db = root.FPTFinanceDB;
        if (!db || typeof db.getAllAsArray !== 'function') {
            return { txns: [], count: 0, totalCount: 0 };
        }

        const all = await db.getAllAsArray();
        const totalCount = all.length;

        const typeFilter = options.typeFilter || 'all';
        const query = options.search ? String(options.search).trim().toLowerCase() : null;

        let txns = all.filter(t => {
            if (!t) return false;
            if (range.start && (t.date || 0) < range.start) return false;
            if (range.end && (t.date || 0) > range.end) return false;

            if (typeFilter !== 'all' && t.type !== typeFilter) return false;

            if (query) {
                const desc = String(t.description || '').toLowerCase();
                const type = String(t.type || '').toLowerCase();
                const id = String(t.id || '').toLowerCase();
                if (!desc.includes(query) && !type.includes(query) && !id.includes(query)) {
                    return false;
                }
            }

            return true;
        });

        const sort = options.sort || 'date-desc';
        txns.sort((a, b) => {
            if (sort === 'date-asc') return (a.date || 0) - (b.date || 0);
            if (sort === 'amount-desc') return Math.abs(b.signed || 0) - Math.abs(a.signed || 0);
            if (sort === 'amount-asc') return Math.abs(a.signed || 0) - Math.abs(b.signed || 0);
            return (b.date || 0) - (a.date || 0);
        });

        return {
            txns,
            count: txns.length,
            totalCount
        };
    }

    function aggregateOperations(txns) {
        txns = txns || [];
        const inByCur = { RUB: 0, USD: 0, EUR: 0 };
        const outByCur = { RUB: 0, USD: 0, EUR: 0 };
        const netByCur = { RUB: 0, USD: 0, EUR: 0 };

        const byType = {}; // type -> { in: {}, out: {}, count, totalInRUB, totalOutRUB }
        const byMonth = {}; // 'YYYY-MM' -> { in: rub, out: rub, net: rub }
        const byDay = {};   // 'YYYY-MM-DD' -> { in: rub, out: rub, net: rub }

        let totalInRUB = 0;
        let totalOutRUB = 0;
        let commissionsRUB = 0;

        for (const t of txns) {
            // Учитываем завершённые операции
            if (t.status && t.status !== 'complete') continue;

            const cur = t.currency || 'RUB';
            const signed = Number(t.signed) || 0;
            const absAmt = Math.abs(signed);
            const rate = APPROX_RATES[cur] || 1;
            const rubAmt = absAmt * rate;

            if (signed >= 0) {
                if (inByCur[cur] != null) inByCur[cur] += absAmt;
                totalInRUB += rubAmt;
            } else {
                if (outByCur[cur] != null) outByCur[cur] += absAmt;
                totalOutRUB += rubAmt;
            }

            if (netByCur[cur] != null) netByCur[cur] += signed;

            // Тип операции
            const type = t.type || 'other';
            if (!byType[type]) {
                byType[type] = { in: {}, out: {}, count: 0, totalInRUB: 0, totalOutRUB: 0 };
            }
            byType[type].count++;
            if (signed >= 0) {
                byType[type].in[cur] = (byType[type].in[cur] || 0) + absAmt;
                byType[type].totalInRUB += rubAmt;
            } else {
                byType[type].out[cur] = (byType[type].out[cur] || 0) + absAmt;
                byType[type].totalOutRUB += rubAmt;
            }

            if (type === 'withdraw' || (t.description && t.description.toLowerCase().includes('комисси'))) {
                commissionsRUB += rubAmt * 0.03; // примерная оценка сервисных издержек
            }

            // По дням и месяцам
            if (t.date) {
                const d = new Date(t.date);
                const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const dk = `${mk}-${String(d.getDate()).padStart(2, '0')}`;

                if (!byMonth[mk]) byMonth[mk] = { in: 0, out: 0, net: 0 };
                if (!byDay[dk]) byDay[dk] = { in: 0, out: 0, net: 0 };

                if (signed >= 0) {
                    byMonth[mk].in += rubAmt;
                    byMonth[mk].net += rubAmt;
                    byDay[dk].in += rubAmt;
                    byDay[dk].net += rubAmt;
                } else {
                    byMonth[mk].out += rubAmt;
                    byMonth[mk].net -= rubAmt;
                    byDay[dk].out += rubAmt;
                    byDay[dk].net -= rubAmt;
                }
            }
        }

        const totalNetRUB = totalInRUB - totalOutRUB;

        return {
            inByCur,
            outByCur,
            netByCur,
            totalInRUB,
            totalOutRUB,
            totalNetRUB,
            commissionsRUB,
            byType,
            byMonth,
            byDay,
            count: txns.length
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // СИНХРОНИЗАЦИЯ И МЕТАДАННЫЕ
    // ─────────────────────────────────────────────────────────────────────────────

    function triggerBackgroundUpdate(action) {
        return new Promise((resolve) => {
            try {
                if (chrome && chrome.runtime && chrome.runtime.id) {
                    chrome.runtime.sendMessage({ action }, (resp) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                            return;
                        }
                        resolve(resp || { success: true });
                    });
                } else {
                    resolve({ success: false, error: 'Extension runtime unavailable' });
                }
            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        });
    }

    async function refreshSales() {
        return await triggerBackgroundUpdate('updateSales');
    }

    async function refreshPurchases() {
        return await triggerBackgroundUpdate('updatePurchases');
    }

    async function refreshOperations() {
        return await triggerBackgroundUpdate('updateFinance');
    }

    async function getLastUpdated() {
        return new Promise((resolve) => {
            try {
                if (chrome && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get([
                        'fpToolsSalesLastUpdate',
                        'fpToolsPurchasesLastUpdate',
                        'fpToolsFinanceLastUpdate'
                    ], (res) => {
                        resolve({
                            sales: res.fpToolsSalesLastUpdate || null,
                            purchases: res.fpToolsPurchasesLastUpdate || null,
                            finance: res.fpToolsFinanceLastUpdate || null
                        });
                    });
                } else {
                    resolve({ sales: null, purchases: null, finance: null });
                }
            } catch (_) {
                resolve({ sales: null, purchases: null, finance: null });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ЭКСПОРТ
    // ─────────────────────────────────────────────────────────────────────────────

    const FPTFinanceData = {
        getPeriodRange,
        formatMoney,
        formatPreciseMoney,

        getSales,
        aggregateSales,

        getPurchases,
        aggregatePurchases,

        getOperations,
        aggregateOperations,

        refreshSales,
        refreshPurchases,
        refreshOperations,

        getLastUpdated
    };

    root.FPTFinanceData = FPTFinanceData;

})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this)));
