/**
 * FunPay Tools — Realised Profit Engine (T07B)
 *
 * Чистый read-only модуль расчёта реализованной прибыли и покрытия:
 * - per-order расчёт прибыли для закрытых заказов (`closed`) со снимком себестоимости (`costBasisSnapshot`);
 * - исключение возвратов (`refunded`) из реализованных итогов;
 * - обработка валютных несовпадений (cross-currency mismatch -> profit null);
 * - расчет агрегатов строго раздельно по каждой валюте (RUB, USD, EUR);
 * - маржа (margin), окупаемость (ROI), покрытие по заказам (order coverage) и выручке (revenue coverage);
 * - поддержка отрицательной прибыли (запрещен silent clamp к нулю);
 * - полная изоляция от покупок пользователя (purchases не являются себестоимостью).
 */
(function (root) {
    'use strict';

    /**
     * Нормализация кода валюты.
     * @param {*} curr
     * @returns {string|null}
     */
    function normalizeCurrency(curr) {
        if (!curr || typeof curr !== 'string') return null;
        const c = curr.trim().toUpperCase();
        if (!c) return null;
        if (c === '₽' || c === 'РУБ' || c === 'RUB' || c === 'РУБ.') return 'RUB';
        if (c === '$' || c === 'USD') return 'USD';
        if (c === '€' || c === 'EUR') return 'EUR';
        if (/^[A-Z0-9]{2,10}$/.test(c)) return c;
        return null;
    }

    /**
     * Нормализация цены/суммы.
     * @param {*} val
     * @returns {number}
     */
    function normalizePrice(val) {
        if (typeof val === 'number' && !isNaN(val)) return Math.round(val * 100) / 100;
        if (typeof val === 'string' && val.trim().length > 0) {
            const n = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(n)) return Math.round(n * 100) / 100;
        }
        return 0;
    }

    /**
     * Округление до 2 знаков.
     * @param {number} val
     * @returns {number}
     */
    function round2(val) {
        return Math.round(val * 100) / 100;
    }

    /**
     * Создать пустой объект агрегатов для валюты.
     * @param {string} currency
     * @returns {Object}
     */
    function createEmptyAggregate(currency) {
        return {
            currency,
            eligibleOrdersCount: 0,
            eligibleRevenue: 0,
            knownCostOrdersCount: 0,
            missingCostOrdersCount: 0,
            knownCostRevenue: 0,
            realisedCost: 0,
            realisedNetProfit: 0,
            margin: null,
            roi: null,
            orderCoverage: 0,
            revenueCoverage: 0,
            refundedOrdersCount: 0,
            refundedRevenue: 0,
            currencyMismatchCount: 0
        };
    }

    /**
     * Расчёт прибыли для отдельного заказа продаж (per-order metrics).
     *
     * Инварианты:
     * - closed + known same-currency snapshot => profit known;
     * - closed + no snapshot => profit null;
     * - refunded => excluded from realised totals;
     * - cross-currency mismatch => profit null / error state, не silent convert;
     * - negative profit сохраняется (запрещено принудительно занулять отрицательную прибыль).
     *
     * @param {Object} order
     * @returns {Object}
     */
    function calculateOrderProfit(order) {
        if (!order) {
            return {
                orderId: null,
                status: '',
                currency: 'RUB',
                sellerRevenue: 0,
                costBasis: null,
                costBasisCurrency: null,
                costBasisCapturedAt: null,
                netProfit: null,
                margin: null,
                roi: null,
                isEligible: false,
                isClosed: false,
                isRefunded: false,
                hasCost: false,
                hasCurrencyMismatch: false
            };
        }

        // Sales records use orderStatus; keep status as a compatibility alias for
        // callers that already provide the shorter field.
        const rawStatus = order.status != null && String(order.status).trim() !== ''
            ? order.status
            : order.orderStatus;
        const status = String(rawStatus || '').toLowerCase().trim();
        const isRefunded = status === 'refunded' || status.includes('refund');
        const isClosed = status === 'closed';
        const isEligible = isClosed && !isRefunded;

        const sellerRevenue = normalizePrice(order.price != null ? order.price : order.sellerPrice);
        const currency = normalizeCurrency(order.currency) || 'RUB';

        const rawSnapshot = order.costBasisSnapshot;
        const hasSnapshot = typeof rawSnapshot === 'number' && !isNaN(rawSnapshot) && rawSnapshot > 0;
        const costBasis = hasSnapshot ? round2(rawSnapshot) : null;
        const costBasisCurrency = hasSnapshot ? (normalizeCurrency(order.costBasisCurrency) || currency) : null;
        const costBasisCapturedAt = (hasSnapshot && typeof order.costBasisCapturedAt === 'number')
            ? order.costBasisCapturedAt
            : null;

        let hasCurrencyMismatch = false;
        if (hasSnapshot && costBasisCurrency && costBasisCurrency !== currency) {
            hasCurrencyMismatch = true;
        }

        let netProfit = null;
        let margin = null;
        let roi = null;
        let hasCost = false;

        if (isEligible) {
            if (hasSnapshot && !hasCurrencyMismatch) {
                hasCost = true;
                // Canonical realised net profit: realizedSellerRevenue - costBasisSnapshot
                netProfit = round2(sellerRevenue - costBasis);
                if (sellerRevenue > 0) {
                    margin = round2((netProfit / sellerRevenue) * 100);
                }
                if (costBasis > 0) {
                    roi = round2((netProfit / costBasis) * 100);
                }
            }
        }

        return {
            orderId: order.orderId || null,
            status,
            currency,
            sellerRevenue,
            costBasis,
            costBasisCurrency,
            costBasisCapturedAt,
            netProfit,
            margin,
            roi,
            isEligible,
            isClosed,
            isRefunded,
            hasCost,
            hasCurrencyMismatch
        };
    }

    /**
     * Обогатить массив заказов расчётами прибыли без мутации исходных объектов.
     * @param {Array<Object>} orders
     * @returns {Array<Object>}
     */
    function enrichSalesWithProfit(orders) {
        if (!Array.isArray(orders)) return [];
        return orders.map(o => {
            const profitInfo = calculateOrderProfit(o);
            return {
                ...o,
                profitInfo,
                netProfit: profitInfo.netProfit,
                margin: profitInfo.margin,
                roi: profitInfo.roi,
                hasCostBasis: profitInfo.hasCost,
                hasCurrencyMismatch: profitInfo.hasCurrencyMismatch
            };
        });
    }

    /**
     * Чистый расчёт агрегатов прибыли по валютам.
     *
     * @param {Array<Object>} orders
     * @param {Object} [options]
     * @param {string} [options.currency]
     * @returns {{ byCurrency: Object<string, Object>, totals: Object, currency: string }}
     */
    function calculateProfitAggregates(orders, options = {}) {
        const list = Array.isArray(orders) ? orders : [];
        const byCurrency = {};

        for (const o of list) {
            const info = (o && o.profitInfo) ? o.profitInfo : calculateOrderProfit(o);
            const cur = info.currency || 'RUB';

            if (!byCurrency[cur]) {
                byCurrency[cur] = createEmptyAggregate(cur);
            }
            const agg = byCurrency[cur];

            if (info.isRefunded) {
                agg.refundedOrdersCount++;
                agg.refundedRevenue += info.sellerRevenue;
                continue; // Возвраты полностью исключаются из реализованных итогов
            }

            if (info.isEligible) {
                agg.eligibleOrdersCount++;
                agg.eligibleRevenue += info.sellerRevenue;

                if (info.hasCurrencyMismatch) {
                    agg.currencyMismatchCount++;
                    agg.missingCostOrdersCount++;
                } else if (info.hasCost) {
                    agg.knownCostOrdersCount++;
                    agg.knownCostRevenue += info.sellerRevenue;
                    agg.realisedCost += info.costBasis;
                    agg.realisedNetProfit += info.netProfit;
                } else {
                    agg.missingCostOrdersCount++;
                }
            }
        }

        // Финализация расчетов и метрик покрытия по каждой валюте
        for (const cur of Object.keys(byCurrency)) {
            const agg = byCurrency[cur];
            agg.eligibleRevenue = round2(agg.eligibleRevenue);
            agg.knownCostRevenue = round2(agg.knownCostRevenue);
            agg.refundedRevenue = round2(agg.refundedRevenue);

            if (agg.knownCostOrdersCount === 0 && agg.eligibleOrdersCount > 0) {
                agg.realisedCost = null;
                agg.realisedNetProfit = null;
                agg.margin = null;
                agg.roi = null;
            } else {
                agg.realisedCost = round2(agg.realisedCost);
                agg.realisedNetProfit = round2(agg.knownCostRevenue - agg.realisedCost);

                // Margin & ROI
                agg.margin = agg.knownCostRevenue > 0
                    ? round2((agg.realisedNetProfit / agg.knownCostRevenue) * 100)
                    : null;

                agg.roi = agg.realisedCost > 0
                    ? round2((agg.realisedNetProfit / agg.realisedCost) * 100)
                    : null;
            }

            // Coverage
            agg.orderCoverage = agg.eligibleOrdersCount > 0
                ? round2((agg.knownCostOrdersCount / agg.eligibleOrdersCount) * 100)
                : 0;

            agg.revenueCoverage = agg.eligibleRevenue > 0
                ? round2((agg.knownCostRevenue / agg.eligibleRevenue) * 100)
                : 0;
        }

        // Выбор целевого aggregate
        const targetCurrency = normalizeCurrency(options.currency);
        let totals;
        if (targetCurrency) {
            totals = byCurrency[targetCurrency] || createEmptyAggregate(targetCurrency);
        } else {
            // При отсутствии фильтра по валюте целевым является RUB, либо первая присутствующая валюта
            totals = byCurrency['RUB'] || byCurrency[Object.keys(byCurrency)[0]] || createEmptyAggregate('RUB');
        }

        return {
            byCurrency,
            totals,
            currency: totals.currency
        };
    }

    /**
     * Получить заказы и рассчитать реализованную прибыль.
     * Если orders не переданы, использует FPTFinanceData.getSales(options).
     *
     * @param {Object} [options]
     * @param {Array<Object>} [options.orders]
     * @param {string|Object} [options.period]
     * @param {string} [options.currency]
     * @returns {Promise<{ orders: Array<Object>, byCurrency: Object, totals: Object, currency: string }>}
     */
    async function getRealisedProfit(options = {}) {
        let orders = options.orders;
        if (!Array.isArray(orders)) {
            const financeData = (typeof FPTFinanceData !== 'undefined' && FPTFinanceData)
                ? FPTFinanceData
                : (typeof window !== 'undefined' && window.FPTFinanceData)
                ? window.FPTFinanceData
                : (root && root.FPTFinanceData)
                ? root.FPTFinanceData
                : null;

            if (financeData && typeof financeData.getSales === 'function') {
                orders = await financeData.getSales(options);
            } else {
                orders = [];
            }
        }

        const enrichedOrders = enrichSalesWithProfit(orders);
        const aggResult = calculateProfitAggregates(enrichedOrders, options);

        return {
            orders: enrichedOrders,
            byCurrency: aggResult.byCurrency,
            totals: aggResult.totals,
            currency: aggResult.currency
        };
    }

    const api = {
        normalizeCurrency,
        normalizePrice,
        createEmptyAggregate,
        calculateOrderProfit,
        enrichSalesWithProfit,
        calculateProfitAggregates,
        getRealisedProfit
    };

    root.FPTProfitEngine = api;
    if (typeof window !== 'undefined') {
        window.FPTProfitEngine = api;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.FPTProfitEngine = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
