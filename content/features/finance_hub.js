// Financial operations and calendar helpers for replacement views.
(function(root) {
    const MSK_OFFSET_MS = 3 * 3600 * 1000;
    const ONE_DAY_MS = 24 * 3600 * 1000;

    function getMskParts(timestamp) {
        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
        if (finData && typeof finData.getMskParts === 'function') {
            return finData.getMskParts(timestamp);
        }
        const ts = (typeof timestamp === 'number' && !isNaN(timestamp))
            ? timestamp
            : (typeof timestamp === 'string' ? (Date.parse(timestamp) || 0) : 0);
        const d = new Date(ts + MSK_OFFSET_MS);
        return {
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            day: d.getUTCDate(),
            hours: d.getUTCHours(),
            minutes: d.getUTCMinutes(),
            seconds: d.getUTCSeconds(),
            milliseconds: d.getUTCMilliseconds(),
            dayOfWeek: d.getUTCDay()
        };
    }

    function getMskDayKey(timestamp) {
        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
        if (finData && typeof finData.getMskDayKey === 'function') {
            return finData.getMskDayKey(timestamp);
        }
        const p = getMskParts(timestamp);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    function getMskMonthKey(timestamp) {
        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
        if (finData && typeof finData.getMskMonthKey === 'function') {
            return finData.getMskMonthKey(timestamp);
        }
        const p = getMskParts(timestamp);
        return `${p.year}-${String(p.month).padStart(2, '0')}`;
    }

    function getMskWeekKey(timestamp) {
        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
        if (finData && typeof finData.getMskWeekKey === 'function') {
            return finData.getMskWeekKey(timestamp);
        }
        const ts = (typeof timestamp === 'number' && !isNaN(timestamp))
            ? timestamp
            : (typeof timestamp === 'string' ? (Date.parse(timestamp) || 0) : 0);
        const p = getMskParts(ts);
        const dayShift = (p.dayOfWeek + 6) % 7;
        const mondayTs = ts - (dayShift * ONE_DAY_MS);
        return getMskDayKey(mondayTs);
    }

    function formatMskDateTime(timestamp, includeSeconds = false) {
        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
        if (finData && typeof finData.formatMskDateTime === 'function') {
            return finData.formatMskDateTime(timestamp, includeSeconds);
        }
        if (!timestamp) return '—';
        const ts = (typeof timestamp === 'number' && !isNaN(timestamp))
            ? timestamp
            : (typeof timestamp === 'string' ? (Date.parse(timestamp) || 0) : 0);
        if (!ts) return '—';
        const p = getMskParts(ts);
        const dd = String(p.day).padStart(2, '0');
        const mm = String(p.month).padStart(2, '0');
        const yyyy = p.year;
        const hh = String(p.hours).padStart(2, '0');
        const min = String(p.minutes).padStart(2, '0');
        if (includeSeconds) {
            const ss = String(p.seconds).padStart(2, '0');
            return `${dd}.${mm}.${yyyy} ${hh}:${min}:${ss}`;
        }
        return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
    }





    function periodKey(period) {
        return period && typeof period === 'object' ? (period.period || 'custom') : period;
    }

    function isDateOnly(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    function isValidDateOnly(value) {
        if (!isDateOnly(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(0);
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCFullYear(year, month - 1, day);
        return date.getUTCFullYear() === year
            && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function formatCustomDateLabel(value) {
        if (isDateOnly(value)) {
            const [year, month, day] = value.split('-');
            return `${day}.${month}.${year}`;
        }
        return value == null || value === '' ? '…' : String(value);
    }

    function makeCustomRange(from, to) {
        if (!isValidDateOnly(from) || !isValidDateOnly(to) || from > to) return null;
        return {
            period: 'custom',
            from,
            to,
            label: `${formatCustomDateLabel(from)} — ${formatCustomDateLabel(to)}`
        };
    }





















            function groupOrdersByStep(orders, step, targetCurrency) {
                const buckets = {};
                const allOrders = Array.isArray(orders) ? orders : [];
                const validOrders = allOrders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
                const ruMonths = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

                const currenciesPresent = new Set();
                for (const o of validOrders) {
                    currenciesPresent.add(String(o.currency || 'RUB').toUpperCase());
                }
                const isSingleCurrency = currenciesPresent.size === 1;
                const singleCur = isSingleCurrency ? [...currenciesPresent][0] : null;
                const effectiveCur = (targetCurrency && targetCurrency !== 'all')
                    ? String(targetCurrency).toUpperCase()
                    : (isSingleCurrency ? singleCur : null);
                const isMultiCurrency = !effectiveCur && currenciesPresent.size > 1;

                for (const o of validOrders) {
                    const ts = typeof o.orderDate === 'number' ? o.orderDate : (Date.parse(o.orderDate) || 0);
                    if (!ts) continue;

                    const msk = getMskParts(ts);
                    let key;
                    let displayLabel;
                    if (step === 'month') {
                        key = getMskMonthKey(ts);
                        displayLabel = `${ruMonths[msk.month - 1] || ''} ${msk.year} г.`;
                    } else if (step === 'week') {
                        key = getMskWeekKey(ts);
                        const wp = getMskParts(key);
                        displayLabel = `${String(wp.day).padStart(2, '0')}.${String(wp.month).padStart(2, '0')}`;
                    } else {
                        key = getMskDayKey(ts);
                        displayLabel = `${String(msk.day).padStart(2, '0')}.${String(msk.month).padStart(2, '0')}`;
                    }

                    if (!buckets[key]) {
                        buckets[key] = {
                            key,
                            label: displayLabel,
                            revenue: isMultiCurrency ? null : 0,
                            revenueByCur: {},
                            count: 0,
                            orders: [],
                            isMultiCurrency
                        };
                    }

                    const p = Number(o.price) || 0;
                    const cur = String(o.currency || 'RUB').toUpperCase();
                    buckets[key].count++;
                    buckets[key].orders.push(o);
                    buckets[key].revenueByCur[cur] = (buckets[key].revenueByCur[cur] || 0) + p;

                    if (effectiveCur) {
                        if (cur === effectiveCur) {
                            buckets[key].revenue = (buckets[key].revenue || 0) + p;
                        }
                    }
                }

                const keys = Object.keys(buckets).sort();
                const res = keys.map(k => buckets[k]);
                res.isMultiCurrency = isMultiCurrency;
                res.currency = effectiveCur;
                res.currencies = Array.from(currenciesPresent);
                return res;
            }


    const state = { period: '7d', activeSubtab: 'overview', currency: 'all', category: 'all' };
    let periodBeforeCustom = '7d';
    function onPeriodChange(period) {
        state.period = period;
        try { sessionStorage.setItem('fpt_fin_last_period', JSON.stringify(period)); } catch (_) {}
        return true;
    }
    function onCustomRangeApply(from, to) {
        const range = makeCustomRange(from, to);
        if (!range) return false;
        if (typeof state.period === 'string' && state.period !== 'custom') periodBeforeCustom = state.period;
        return onPeriodChange(range);
    }
    const delegate = name => (...args) => root.FPTFinanceData?.[name](...args);
    const hub = { getMskParts, getMskDayKey, getMskMonthKey, getMskWeekKey,
        formatMskDateTime, MSK_OFFSET_MS, groupOrdersByStep, makeCustomRange,
        init: () => state, getState: () => ({ ...state }), onPeriodChange, onCustomRangeApply,
        onCustomRangeReset: () => onPeriodChange(periodBeforeCustom),
        resolvePreviousPeriodRange: delegate('resolvePreviousPeriodRange'),
        formatKpiComparison: delegate('formatKpiComparison'), compareKpis: delegate('compareKpis'),
        getData: getPopupFinanceData, refresh: refreshPopupFinance };
    root.FPTFinanceHub = root.fptFinanceHub = hub;
    if (typeof module !== 'undefined' && module.exports) module.exports = hub;
})(typeof window !== 'undefined' ? window : this);

// Data operations for new views use the existing financial engines directly.
async function getPopupFinanceData(p = {}) {
    const data = window.FPTFinanceData;
    if (!data) throw new Error('Модуль финансовых данных недоступен.');
    const mode = p.mode || 'overview';
    const options = p.filters || {};
    if (mode === 'potential') {
        const inventory = await window.FPTPotential.getInventory({ enrichPotential: true });
        let lots = Array.isArray(inventory) ? inventory : inventory.lots || [];
        if (options.category && options.category !== 'all') lots = lots.filter(lot => String(lot.category || '').toLowerCase() === String(options.category).toLowerCase());
        if (options.currency && options.currency !== 'all') lots = lots.filter(lot => String(lot.currency || 'RUB').toUpperCase() === String(options.currency).toUpperCase());
        if (p.filter === 'with-cost') lots = lots.filter(lot => lot.costBasis != null);
        if (p.filter === 'without-cost') lots = lots.filter(lot => lot.costBasis == null);
        if (p.filter === 'finite-stock') lots = lots.filter(lot => lot.stockKind === 'finite' && typeof lot.stock === 'number');
        const byCurrency = window.FPTPotential.calculatePotentialAggregates(lots);
        const currency = options.currency && options.currency !== 'all' ? String(options.currency).toUpperCase()
            : (p.primaryCurrency && byCurrency[p.primaryCurrency] ? p.primaryCurrency : Object.keys(byCurrency)[0] || 'RUB');
        const totals = window.FPTPotential.calculateCurrencyTotals(lots, currency);
        return { items: lots, totals, byCurrency, currency, period: 'snapshot' };
    }
    if (mode === 'profit') {
        const result = await data.aggregateProfit(options);
        let items = result.orders || [];
        if (p.filter === 'with-cost') items = items.filter(order => order.profitInfo?.hasCost);
        if (p.filter === 'without-cost') items = items.filter(order => order.profitInfo && !order.profitInfo.hasCost && !order.profitInfo.isRefunded);
        if (p.filter === 'refunded') items = items.filter(order => order.profitInfo?.isRefunded);
        const currency = options.currency && options.currency !== 'all' ? options.currency : p.primaryCurrency;
        return { ...result, ...window.FPTProfitEngine.calculateProfitAggregates(items, { ...options, currency }), items };
    }
    const getters = { sales: 'getSales', purchases: 'getPurchases', operations: 'getOperations' };
    const aggregators = { sales: 'aggregateSales', purchases: 'aggregatePurchases', operations: 'aggregateOperations' };
    if (mode === 'overview') {
        // The previous period has the same length as the current one, so KPI cards can show a delta.
        // "all time" has no previous period; its deltas stay unavailable instead of being invented.
        const previousRange = data.resolvePreviousPeriodRange(options.period);
        const previousOptions = previousRange
            ? { ...options, period: { start: previousRange.start, end: previousRange.end, period: 'custom', label: previousRange.label } }
            : null;
        const settle = promise => promise.then(value => value, () => null);
        const [sales, operations, potential, profit, previousSales, previousProfit] = await Promise.all([
            getPopupFinanceData({ mode: 'sales', filters: options }),
            getPopupFinanceData({ mode: 'operations', filters: options }),
            getPopupFinanceData({ mode: 'potential', filters: { currency: options.currency }, primaryCurrency: p.primaryCurrency }),
            getPopupFinanceData({ mode: 'profit', filters: options, primaryCurrency: p.primaryCurrency }),
            previousOptions ? settle(getPopupFinanceData({ mode: 'sales', filters: previousOptions })) : null,
            previousOptions ? settle(getPopupFinanceData({ mode: 'profit', filters: previousOptions, primaryCurrency: p.primaryCurrency })) : null
        ]);
        return { sales, operations, potential, profit, previous: previousOptions ? { sales: previousSales, profit: previousProfit, range: previousRange } : null };
    }
    if (!getters[mode]) throw new Error('Неизвестный раздел финансов.');
    const items = await data[getters[mode]](options);
    return { items, totals: await data[aggregators[mode]](items, options) };
}
let popupFinanceRefreshPromise = null;
async function refreshPopupFinance(p = {}) {
    if (popupFinanceRefreshPromise) return popupFinanceRefreshPromise;
    popupFinanceRefreshPromise = (async () => {
        const jobs = ['updateSales', 'updatePurchases', 'updateFinance'].map(async action => {
            const response = await chrome.runtime.sendMessage({ action });
            if (!response?.success) throw new Error(response?.error || `${action} failed`);
            return response;
        });
        jobs.push(Promise.resolve().then(() => window.FPTPotential.getInventory({ enrichPotential: true, forceRefresh: true })));
        const results = await Promise.allSettled(jobs);
        p.onProgress?.(results);
        return { sources: Object.fromEntries(['sales', 'purchases', 'operations', 'potential'].map((key, index) => [key, results[index]])) };
    })();
    try { return await popupFinanceRefreshPromise; } finally { popupFinanceRefreshPromise = null; }
}
async function exportPopupFinance(p = {}) {
    const dataset = p.mode || 'sales';
    if (!['sales', 'purchases', 'operations', 'profit', 'potential'].includes(dataset)) throw new Error('Неизвестный набор данных для экспорта.');
    const data = await getPopupFinanceData({ ...p, mode: dataset });
    const meta = { ...p.filters, period: dataset === 'potential' ? 'snapshot' : p.filters?.period,
        exportedAt: new Date().toISOString() };
    const result = { dataset, ...data, meta };
    if (p.format) {
        if (!['json', 'csv'].includes(p.format)) throw new Error('Неизвестный формат экспорта.');
        const engine = window.FPTExportStudio?.financeExport || window.FPTFinanceExport;
        if (!engine) throw new Error('Модуль экспорта недоступен.');
        result.content = engine[p.format === 'json' ? 'buildJSON' : 'buildCSV'](dataset, data.items, data.totals, meta);
        result.mimeType = p.format === 'json' ? 'application/json' : 'text/csv';
    }
    return result;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('finance_hub', id, fn);
    register('fptFinRefreshBtn', refreshPopupFinance);
    register('getFinanceData', getPopupFinanceData);
    register('fptFinShowMoreOrdersBtn', p => getPopupFinanceData({ ...p, mode: 'sales' }));
    register('fptFinShowMorePurchasesBtn', p => getPopupFinanceData({ ...p, mode: 'purchases' }));
    register('fptFinExportBtn', exportPopupFinance);
    register('exportFinanceData', exportPopupFinance);
    register('fptFinExportDownloadCsv', p => exportPopupFinance({ ...p, format: 'csv' }));
    register('fptFinExportDownloadJson', p => exportPopupFinance({ ...p, format: 'json' }));
    register('fptFinCustomApplyBtn', async p => {
        const hub = window.FPTFinanceHub;
        if (!hub.makeCustomRange(p.from, p.to)) throw new Error('Укажите корректный диапазон дат.');
        if (typeof p.filters?.period === 'string' && p.filters.period !== 'custom') hub.onPeriodChange(p.filters.period);
        hub.onCustomRangeApply(p.from, p.to);
        const period = hub.getState().period;
        return getPopupFinanceData({ mode: p.mode, filters: { ...p.filters, period } });
    });
    register('fptFinCustomResetBtn', p => {
        const hub = window.FPTFinanceHub;
        hub.onCustomRangeReset();
        return getPopupFinanceData({ mode: p.mode, filters: { ...p.filters, period: hub.getState().period } });
    });
    register('fptFinProfitCostWarningAction', () => window.FPTCostBasis.getAll());
    register('saveCostBasis', p => window.FPTCostBasis.set(p.offerId, p.value));
}
