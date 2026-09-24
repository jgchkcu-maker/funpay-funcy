/**
 * FunPay Funcy — Finance Hub Controller (Sales, Purchases & Operations — T03A/T03B/T03C)
 *
 * Связующий контроллер Finance Hub для статистики продаж, покупок и операций:
 * - Управление периодом и состоянием подвкладок;
 * - Доступ к данным продаж, покупок и операций строго через window.FPTFinanceData;
 * - Раздельные подвкладки "Продажи" и "Покупки" без смешивания с себестоимостью;
 * - Рендеринг подвкладки "Продажи" (KPI, динамика, категории, топы, drill-down);
 * - Рендеринг подвкладки "Покупки" (KPI, динамика трат, топ продавцов, детализация, drill-down);
 * - Рендеринг подвкладки "Операции" (приход/расход/нетто, типы, динамика, список, drill-down);
 * - Lifecycle cleanup: корректная очистка tooltips, модалок и отмена устаревших рендеров при переключении табов;
 * - Refresh: фоновое обновление продаж (updateSales), покупок (updatePurchases) и операций (updateFinance).
 */
(function (root) {
    'use strict';

    const PALETTE = [
        '#2563eb', '#0891b2', '#059669', '#d97706',
        '#dc2626', '#0ea5e9', '#db2777', '#65a30d',
        '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899'
    ];

    const SYMBOLS = { RUB: '₽', USD: '$', EUR: '€' };
    const OPERATION_TYPE_LABELS = {
        order: 'Заказы',
        payment: 'Пополнения',
        withdraw: 'Выводы',
        withdraw_cancel: 'Отмены выводов',
        other: 'Другое'
    };
    const DEFAULT_PERIOD = '7d';
    const PERIOD_STORAGE_KEY = 'fpt_fin_last_period';
    const CUSTOM_RANGE_STORAGE_KEY = 'fpt_fin_custom_range';

    // Состояние контроллера
    const state = {
        initialized: false,
        container: null,
        activeSubtab: 'overview',
        period: DEFAULT_PERIOD,
        customRange: null,
        periodBeforeCustom: DEFAULT_PERIOD,
        pendingCustomRange: false,
        currency: 'all',           // 'all' | 'RUB' | 'USD' | 'EUR'
        orderStatus: 'all',        // 'all' | 'closed' | 'paid' | 'refunded'
        operationStatus: 'all',    // 'all' | 'complete' | 'cancel' | 'waiting'
        status: 'all',             // compatible mirror of active subtab status
        category: 'all',           // 'all' | <categoryName>
        salesStep: 'day',          // 'day' | 'week' | 'month'
        salesView: 'orders',       // 'orders' | 'buyers' | 'products' | 'categories'
        visibleOrdersLimit: 50,
        renderToken: 0,
        isLoading: false,
        cachedOrders: null,
        cachedAgg: null,
        cachedPeriod: null,

        purchasesStep: 'day',          // 'day' | 'week' | 'month'
        purchasesView: 'orders',       // 'orders' | 'sellers' | 'products' | 'categories'
        purchasesCol4View: 'sellers',  // 'sellers' | 'categories'
        visiblePurchasesLimit: 50,
        purchasesRenderToken: 0,
        isPurchasesLoading: false,
        cachedPurchasesOrders: null,
        cachedPurchasesAgg: null,
        cachedPurchasesPeriod: null,

        operationsRenderToken: 0,
        isOperationsLoading: false,
        cachedOperations: null,
        cachedOperationsAgg: null,
        cachedOperationsPeriod: null,

        potentialRenderToken: 0,
        isPotentialLoading: false,
        cachedPotentialLots: null,
        cachedPotentialAgg: null,
        potentialFilter: 'all',
        potentialCurrency: 'RUB',
        potentialLastUpdate: null,

        profitRenderToken: 0,
        isProfitLoading: false,
        cachedProfitOrders: null,
        cachedProfitAgg: null,
        cachedProfitPeriod: null,
        profitFilter: 'all',
        profitCurrency: 'RUB',
        profitLastUpdate: null,

        overviewRenderToken: 0,
        isOverviewLoading: false,
        overviewMetric: 'revenue',
        cachedOverviewData: null,
        cachedOverviewPeriod: null,
        overviewLastUpdate: null,
        isRefreshing: false,

        tooltipEl: null
    };

    // Один mount контроллера на DOM-контейнер. Повторное открытие попапа
    // использует уже запущенный рендер, а не создает новый fetch.
    let activeRenderPromise = null;

    // ─────────────────────────────────────────────────────────────────────────────
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ФОРМАТИРОВАНИЯ
    // ─────────────────────────────────────────────────────────────────────────────









    // ─────────────────────────────────────────────────────────────────────────────
    // ЕДИНАЯ КАЛЕНДАРНАЯ МОДЕЛЬ МСК (UTC+3, без DST) (T06)
    // ─────────────────────────────────────────────────────────────────────────────

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





















    // ─────────────────────────────────────────────────────────────────────────────
    // ТУЛТИП ДЛЯ ГРАФИКОВ И ДИАГРАММ
    // ─────────────────────────────────────────────────────────────────────────────









    // ─────────────────────────────────────────────────────────────────────────────
    // DRILL-DOWN INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // SVG ГРАФИК ДИНАМИКИ ПРОДАЖ
    // ─────────────────────────────────────────────────────────────────────────────







    /**
     * Группировка заказов по шагам: день, неделя, месяц (по календарю МСК, T06)
     */




    // ─────────────────────────────────────────────────────────────────────────────
    // SVG КРУГОВАЯ ДИАГРАММА (DONUT) ПО КАТЕГОРИЯМ
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // ТАБЛИЦА ДЕТАЛИЗАЦИИ И ТОПЫ (ORDERS / BUYERS / PRODUCTS / CATEGORIES)
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // ОСНОВНОЙ РЕНДЕР ПОДВКЛАДКИ SALES
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // LIFECYCLE & CLEANUP
    // ─────────────────────────────────────────────────────────────────────────────

    function cleanupSales() {
        hideTooltip();
        removeTooltip();
        state.renderToken++;

        // Закрыть модальное окно drill-down, если оно открыто
        const ddOverlay = document.getElementById('fpt-dd-overlay');
        if (ddOverlay) ddOverlay.remove();
    }

    function cleanupPurchases() {
        hideTooltip();
        removeTooltip();
        state.purchasesRenderToken++;

        const ddOverlay = document.getElementById('fpt-dd-overlay');
        if (ddOverlay) ddOverlay.remove();
    }

    function formatLastUpdatedText(timestamp) {
        if (!timestamp) {
            return 'Не обновлялось';
        }
        let num = Number(timestamp);
        if (isNaN(num) || num <= 0) {
            const parsed = Date.parse(timestamp);
            if (!isNaN(parsed) && parsed > 0) num = parsed;
        }
        if (isNaN(num) || num <= 0) {
            return 'Не обновлялось';
        }
        const mskTs = getMskParts(num);
        const mskNow = getMskParts(Date.now());
        const timeStr = `${String(mskTs.hours).padStart(2, '0')}:${String(mskTs.minutes).padStart(2, '0')}`;

        if (mskTs.year === mskNow.year && mskTs.month === mskNow.month && mskTs.day === mskNow.day) {
            return `Обновлено: в ${timeStr}`;
        }
        return `Обновлено: ${String(mskTs.day).padStart(2, '0')}.${String(mskTs.month).padStart(2, '0')}.${mskTs.year} ${timeStr}`;
    }

    async function updateLastUpdatedText(subtab) {
        if (!state.container) return;
        const lastUpdatedEl = state.container.querySelector('#fptFinLastUpdatedText');
        if (!lastUpdatedEl) return;

        const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;

        if (subtab === 'overview') {
            let salesLastUpdate = null;
            let opsLastUpdate = null;
            if (finData && typeof finData.getMeta === 'function') {
                try {
                    const [sMeta, oMeta] = await Promise.all([
                        finData.getMeta('sales'),
                        finData.getMeta('operations')
                    ]);
                    if (sMeta && sMeta.lastUpdate) salesLastUpdate = sMeta.lastUpdate;
                    if (oMeta && oMeta.lastUpdate) opsLastUpdate = oMeta.lastUpdate;
                } catch (_) {}
            }
            const potLastUpdate = state.potentialLastUpdate || null;

            // T08: Overview -> use oldest required source timestamp (Math.min). Never newest.
            const requiredTimestamps = [];
            if (salesLastUpdate) requiredTimestamps.push(salesLastUpdate);
            if (opsLastUpdate) requiredTimestamps.push(opsLastUpdate);
            if (potLastUpdate) requiredTimestamps.push(potLastUpdate);

            const sStr = salesLastUpdate ? formatLastUpdatedText(salesLastUpdate).replace('Обновлено: ', '') : 'не обновлялось';
            const oStr = opsLastUpdate ? formatLastUpdatedText(opsLastUpdate).replace('Обновлено: ', '') : 'не обновлялось';
            const pStr = potLastUpdate ? formatLastUpdatedText(potLastUpdate).replace('Обновлено: ', '') : 'не обновлялось';
            lastUpdatedEl.title = `Продажи: ${sStr} · Операции: ${oStr} · Инвентарь: ${pStr}`;

            if (requiredTimestamps.length > 0) {
                const oldestTs = Math.min(...requiredTimestamps);
                state.overviewLastUpdate = oldestTs;
                lastUpdatedEl.textContent = formatLastUpdatedText(oldestTs);
            } else if (state.overviewLastUpdate) {
                lastUpdatedEl.textContent = formatLastUpdatedText(state.overviewLastUpdate);
            } else {
                lastUpdatedEl.textContent = 'Не обновлялось';
            }
            return;
        }

        if (subtab === 'profit') {
            // T08: Profit -> sales freshness
            let salesLastUpdate = null;
            if (finData && typeof finData.getMeta === 'function') {
                try {
                    const sMeta = await finData.getMeta('sales');
                    if (sMeta && sMeta.lastUpdate) salesLastUpdate = sMeta.lastUpdate;
                } catch (_) {}
            }
            if (salesLastUpdate) {
                state.profitLastUpdate = salesLastUpdate;
                lastUpdatedEl.textContent = formatLastUpdatedText(salesLastUpdate);
                lastUpdatedEl.title = 'Свежесть рассчитана по исходным данным о продажах';
            } else if (state.profitLastUpdate) {
                lastUpdatedEl.textContent = formatLastUpdatedText(state.profitLastUpdate);
                lastUpdatedEl.title = '';
            } else {
                lastUpdatedEl.textContent = 'Не обновлялось';
                lastUpdatedEl.title = '';
            }
            return;
        }

        if (subtab === 'potential') {
            // T08: Potential -> time of real inventory fetch
            if (state.potentialLastUpdate) {
                lastUpdatedEl.textContent = formatLastUpdatedText(state.potentialLastUpdate);
                lastUpdatedEl.title = 'Время последнего получения данных инвентаря';
            } else {
                lastUpdatedEl.textContent = 'Не обновлялось';
                lastUpdatedEl.title = '';
            }
            return;
        }

        const type = subtab === 'purchases' ? 'purchases' : (subtab === 'operations' ? 'operations' : 'sales');
        if (finData && typeof finData.getMeta === 'function') {
            try {
                const meta = await finData.getMeta(type);
                if (meta && meta.lastUpdate) {
                    lastUpdatedEl.textContent = formatLastUpdatedText(meta.lastUpdate);
                    lastUpdatedEl.title = '';
                    return;
                }
            } catch (_) {}
        }
        lastUpdatedEl.textContent = 'Не обновлялось';
        lastUpdatedEl.title = '';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // РЕНДЕР КАРТОЧКИ ТОП ПРОДАВЦОВ (COL 4 В PURCHASES)
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // ТАБЛИЦА ДЕТАЛИЗАЦИИ ПОКУПОК (COL 12 В PURCHASES)
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // ОСНОВНОЙ РЕНДЕР ПОДВКЛАДКИ PURCHASES
    // ─────────────────────────────────────────────────────────────────────────────



    // ─────────────────────────────────────────────────────────────────────────────
    // OPERATIONS SUBTAB (T03C)
    // ─────────────────────────────────────────────────────────────────────────────





































    function cleanupOperations() {
        hideTooltip();
        state.operationsRenderToken++;
        const modal = document.getElementById('fpt-fin-operations-modal');
        if (modal) modal.remove();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ПОТЕНЦИАЛ (T06C)
    // ─────────────────────────────────────────────────────────────────────────────

















    function cleanupPotential() {
        hideTooltip();
        state.potentialRenderToken++;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ПРИБЫЛЬ (T07C)
    // ─────────────────────────────────────────────────────────────────────────────





















    function cleanupProfit() {
        hideTooltip();
        state.profitRenderToken++;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ОБЗОР (T08)
    // ─────────────────────────────────────────────────────────────────────────────























    function cleanupOverview() {
        hideTooltip();
        state.overviewRenderToken++;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // LIFECYCLE & EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    function onSubtabChange(target, prev) {
        state.activeSubtab = target;

        if (prev === 'overview' && target !== 'overview') {
            cleanupOverview();
        }
        if (prev === 'sales' && target !== 'sales') {
            cleanupSales();
        }
        if (prev === 'purchases' && target !== 'purchases') {
            cleanupPurchases();
        }
        if (prev === 'operations' && target !== 'operations') {
            cleanupOperations();
        }
        if (prev === 'potential' && target !== 'potential') {
            cleanupPotential();
        }
        if (prev === 'profit' && target !== 'profit') {
            cleanupProfit();
        }

        updateLastUpdatedText(target);
        updateHeaderFiltersVisibility(target);

        if (target === 'overview') {
            renderOverviewSubtab(false);
        } else if (target === 'sales') {
            renderSalesSubtab(false);
        } else if (target === 'purchases') {
            renderPurchasesSubtab(false);
        } else if (target === 'operations') {
            renderOperationsSubtab(false);
        } else if (target === 'potential') {
            renderPotentialSubtab(false);
        } else if (target === 'profit') {
            renderProfitSubtab(false);
        }
    }

    function invalidateSalesCache() {
        state.cachedOrders = null;
        state.cachedAgg = null;
        state.cachedPeriod = null;
        state.cachedProfitOrders = null;
        state.cachedProfitAgg = null;
        state.cachedProfitPeriod = null;
        state.cachedOverviewData = null;
        state.cachedOverviewPeriod = null;
    }

    function invalidatePurchasesCache() {
        state.cachedPurchasesOrders = null;
        state.cachedPurchasesAgg = null;
        state.cachedPurchasesPeriod = null;
    }

    function invalidateOperationsCache() {
        state.cachedOperations = null;
        state.cachedOperationsAgg = null;
        state.cachedOperationsPeriod = null;
        state.cachedOverviewData = null;
        state.cachedOverviewPeriod = null;
    }

    function invalidateProfitCache() {
        state.cachedProfitOrders = null;
        state.cachedProfitAgg = null;
        state.cachedProfitPeriod = null;
        state.cachedOrders = null;
        state.cachedAgg = null;
        state.cachedPeriod = null;
        state.cachedOverviewData = null;
        state.cachedOverviewPeriod = null;
    }

    function invalidatePotentialCache() {
        state.cachedPotentialLots = null;
        state.cachedPotentialAgg = null;
        state.cachedOverviewData = null;
        state.cachedOverviewPeriod = null;
    }

    function invalidateOverviewCache() {
        state.cachedOverviewData = null;
        state.cachedOverviewPeriod = null;
    }

    function invalidateAllCaches() {
        invalidateSalesCache();
        invalidatePurchasesCache();
        invalidateOperationsCache();
        invalidateProfitCache();
        invalidatePotentialCache();
        invalidateOverviewCache();
    }

    function renderActiveSubtab(forceReload) {
        if (state.activeSubtab === 'overview') {
            return renderOverviewSubtab(forceReload);
        } else if (state.activeSubtab === 'sales') {
            return renderSalesSubtab(forceReload);
        } else if (state.activeSubtab === 'purchases') {
            return renderPurchasesSubtab(forceReload);
        } else if (state.activeSubtab === 'operations') {
            return renderOperationsSubtab(forceReload);
        } else if (state.activeSubtab === 'potential') {
            return renderPotentialSubtab(forceReload);
        } else if (state.activeSubtab === 'profit') {
            return renderProfitSubtab(forceReload);
        }
    }

    function reRenderActiveSubtab() {
        return renderActiveSubtab(true);
    }

























    function persistPeriod(period) {
        try {
            sessionStorage.setItem(PERIOD_STORAGE_KEY, typeof period === 'string' ? period : JSON['stringify'](period));
            if (period && typeof period === 'object') {
                sessionStorage.setItem(CUSTOM_RANGE_STORAGE_KEY, JSON['stringify'](period));
            }
        } catch (_) {}
    }

    function removeCustomRangeStorage() {
        try {
            if (typeof sessionStorage.removeItem === 'function') {
                sessionStorage.removeItem(CUSTOM_RANGE_STORAGE_KEY);
            }
        } catch (_) {}
    }

    function onCustomRangeApply(from, to) {
        if (from && typeof from === 'object') {
            to = from.to !== undefined ? from.to : from.end;
            from = from.from !== undefined ? from.from : from.start;
        }
        if (from === undefined || to === undefined) {
            const controls = getCustomRangeControls();
            from = controls && controls.from ? controls.from.value : '';
            to = controls && controls.to ? controls.to.value : '';
        }

        const range = makeCustomRange(from, to);
        if (!range) {
            setCustomRangeError(!from || !to
                ? 'Укажите обе даты.'
                : (from > to ? 'Начальная дата не может быть позже конечной.' : 'Укажите корректные календарные даты.'));
            return false;
        }

        if (typeof state.period === 'string' && state.period !== 'custom') {
            state.periodBeforeCustom = state.period;
        }
        state.customRange = range;
        state.period = range;
        state.pendingCustomRange = false;
        persistPeriod(range);
        const controls = getCustomRangeControls();
        if (controls && controls.period) {
            controls.period.value = 'custom';
            syncFinanceCustomSelect(controls.period, false);
        }
        syncCustomRangeControls(true);
        invalidateAllCaches();
        reRenderActiveSubtab();
        return true;
    }

    function onCustomRangeReset() {
        const fallback = (typeof state.periodBeforeCustom === 'string' && state.periodBeforeCustom !== 'custom')
            ? state.periodBeforeCustom
            : DEFAULT_PERIOD;
        state.period = fallback;
        state.customRange = null;
        state.pendingCustomRange = false;
        persistPeriod(fallback);
        removeCustomRangeStorage();
        const controls = getCustomRangeControls();
        if (controls) {
            if (controls.period) {
                controls.period.value = fallback;
                syncFinanceCustomSelect(controls.period, false);
            }
            if (controls.from) controls.from.value = '';
            if (controls.to) controls.to.value = '';
        }
        syncCustomRangeControls(false);
        invalidateAllCaches();
        reRenderActiveSubtab();
        return true;
    }

    function onPeriodChange(newPeriod) {
        if (newPeriod && typeof newPeriod === 'object') {
            return onCustomRangeApply(newPeriod);
        }
        if (newPeriod === 'custom') {
            if (typeof state.period === 'string' && state.period !== 'custom') {
                state.periodBeforeCustom = state.period;
            }
            state.pendingCustomRange = true;
            const controls = getCustomRangeControls();
            if (controls && controls.period) {
                controls.period.value = 'custom';
                syncFinanceCustomSelect(controls.period, false);
            }
            syncCustomRangeControls(true);
            return false;
        }

        state.period = newPeriod || DEFAULT_PERIOD;
        state.customRange = null;
        state.pendingCustomRange = false;
        persistPeriod(state.period);
        removeCustomRangeStorage();
        syncCustomRangeControls(false);
        invalidateAllCaches();
        reRenderActiveSubtab();
        return true;
    }

    function onCurrencyChange(newCurrency) {
        state.currency = newCurrency || 'all';
        invalidateAllCaches();
        reRenderActiveSubtab();
    }

    function onStatusChange(newStatus) {
        const val = newStatus || 'all';
        if (state.container) {
            const statusSelect = state.container.querySelector('#fptFinStatusSelect');
            if (statusSelect && statusSelect.value !== val) {
                statusSelect.value = val;
            }
        }
        if (state.activeSubtab === 'operations') {
            state.operationStatus = val;
            state.status = val;
            invalidateOperationsCache();
            renderOperationsSubtab(true);
        } else {
            state.orderStatus = val;
            state.status = val;
            if (state.activeSubtab === 'overview') {
                invalidateOverviewCache();
                renderOverviewSubtab(true);
            } else if (state.activeSubtab === 'sales') {
                invalidateSalesCache();
                renderSalesSubtab(true);
            } else if (state.activeSubtab === 'purchases') {
                invalidatePurchasesCache();
                renderPurchasesSubtab(true);
            } else if (state.activeSubtab === 'profit') {
                invalidateProfitCache();
                renderProfitSubtab(true);
            }
        }
    }

    function onCategoryChange(newCategory) {
        state.category = newCategory || 'all';
        invalidateAllCaches();
        reRenderActiveSubtab();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ЭКСПОРТ ДАННЫХ (T09B)
    // ─────────────────────────────────────────────────────────────────────────────










    /**
     * Глобальное обновление Finance Hub.
     * Один клик синхронизирует все независимые источники данных:
     * продажи, покупки, операции и инвентарь. Прибыль пересчитывается из продаж.
     */
    async function refresh() {
        if (!state.container) return;
        if (state.isRefreshing) return;
        state.isRefreshing = true;

        const refreshBtn = state.container.querySelector('#fptFinRefreshBtn');
        const refreshLabel = refreshBtn && typeof refreshBtn.querySelector === 'function'
            ? refreshBtn.querySelector('span:last-child')
            : null;
        const originalLabel = refreshLabel && refreshLabel.textContent ? refreshLabel.textContent : 'Обновить';
        const originalTitle = refreshBtn && refreshBtn.title ? refreshBtn.title : '';

        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('fpt-fin-btn-spin');
            refreshBtn.title = 'Обновляются продажи, покупки, операции и потенциал';
        }

        const totalSources = 4;
        let completedSources = 0;
        const setProgress = (done) => {
            if (refreshLabel) refreshLabel.textContent = `Обновление ${done}/${totalSources}`;
        };
        setProgress(0);

        function runBackgroundUpdate(actionName) {
            return new Promise((resolve, reject) => {
                let settled = false;
                let timer = null;
                const finish = (fn, value) => {
                    if (settled) return;
                    settled = true;
                    if (timer) clearTimeout(timer);
                    fn(value);
                };
                timer = setTimeout(() => {
                    finish(reject, new Error('Не удалось дождаться ответа фонового обновления'));
                }, 120000);

                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                        chrome.runtime.sendMessage({ action: actionName }, (response) => {
                            if (chrome.runtime.lastError) {
                                finish(reject, new Error(chrome.runtime.lastError.message || 'Ошибка фонового обновления'));
                                return;
                            }
                            if (!response || response.success !== true) {
                                finish(reject, new Error(response && response.error ? response.error : 'Фоновое обновление завершилось с ошибкой'));
                                return;
                            }
                            finish(resolve, response);
                        });
                    } else {
                        finish(reject, new Error('Фоновое обновление недоступно'));
                    }
                } catch (error) {
                    finish(reject, error);
                }
            });
        }

        const track = (promise) => Promise.resolve(promise).finally(() => {
            completedSources += 1;
            setProgress(completedSources);
        });

        try {
            const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
            const purchasesConfig = getPurchasesConfig();
            const purchasesAction = purchasesConfig.updateAction || 'updatePurchases';

            const results = await Promise.allSettled([
                track(runBackgroundUpdate('updateSales')),
                track(runBackgroundUpdate(purchasesAction)),
                track(runBackgroundUpdate('updateFinance')),
                track(Promise.resolve().then(async () => {
                    if (!potentialEngine || typeof potentialEngine.getInventory !== 'function') {
                        throw new Error('Модуль инвентаря недоступен');
                    }
                    return potentialEngine.getInventory({ enrichPotential: true, forceRefresh: true });
                }))
            ]);

            const sourceResults = [
                { key: 'sales', label: 'продажи', result: results[0] },
                { key: 'purchases', label: 'покупки', result: results[1] },
                { key: 'operations', label: 'операции', result: results[2] },
                { key: 'potential', label: 'потенциал', result: results[3] }
            ];

            const salesOk = results[0].status === 'fulfilled';
            const purchasesOk = results[1].status === 'fulfilled';
            const operationsOk = results[2].status === 'fulfilled';
            const potentialOk = results[3].status === 'fulfilled';

            // Инвалидируем только те durable-источники, которые реально обновились.
            // Неактивные вкладки не перерисовываем: они подхватят свежие данные при открытии.
            if (salesOk) {
                invalidateSalesCache();
                invalidateProfitCache();
                const salesUpdatedAt = results[0].value && results[0].value.updatedAt;
                if (salesUpdatedAt) state.profitLastUpdate = salesUpdatedAt;
            }
            if (purchasesOk) {
                invalidatePurchasesCache();
            }
            if (operationsOk) {
                invalidateOperationsCache();
            }
            if (potentialOk) {
                invalidatePotentialCache();
                const lots = Array.isArray(results[3].value) ? results[3].value : [];
                state.cachedPotentialLots = lots;
                if (potentialEngine && typeof potentialEngine.calculatePotentialAggregates === 'function') {
                    state.cachedPotentialAgg = potentialEngine.calculatePotentialAggregates(lots);
                }
                state.potentialLastUpdate = Date.now();
            }
            if (salesOk || operationsOk || potentialOk) {
                invalidateOverviewCache();
            }

            const failed = sourceResults.filter(item => item.result.status === 'rejected');
            const successCount = totalSources - failed.length;
            if (successCount === 0) {
                const details = failed.map(item => `${item.label}: ${item.result.reason && item.result.reason.message ? item.result.reason.message : 'ошибка'}`);
                throw new Error(`Не удалось обновить ни один источник. ${details.join(' · ')}`);
            }

            if (refreshLabel) refreshLabel.textContent = 'Применение…';
            await Promise.resolve(renderActiveSubtab(false));
            await updateLastUpdatedText(state.activeSubtab);

            // Анимация пульсации только текущей вкладки — остальные рендерятся лениво при открытии.
            const activeCards = state.container.querySelectorAll('.fpt-fin-tab-pane.active .fpt-fin-card');
            activeCards.forEach(c => {
                c.classList.remove('fpt-fin-pulse-anim');
                void c.offsetWidth;
                c.classList.add('fpt-fin-pulse-anim');
            });

            if (failed.length > 0) {
                const details = failed.map(item => `${item.label} (${item.result.reason && item.result.reason.message ? item.result.reason.message : 'ошибка'})`);
                if (typeof root.showNotification === 'function') {
                    root.showNotification(`Обновлено частично: ${successCount} из ${totalSources}. Ошибки: ${details.join(', ')}`, true);
                }
            } else if (typeof root.showNotification === 'function') {
                root.showNotification('Все разделы финансов обновлены', false);
            }
        } catch (err) {
            console.warn('[FPTFinanceHub] Refresh error:', err);
            if (typeof root.showNotification === 'function') {
                const message = err && err.message ? err.message : 'Не удалось обновить финансовые данные';
                root.showNotification(`Ошибка обновления: ${message}`, true);
            }
        } finally {
            state.isRefreshing = false;
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('fpt-fin-btn-spin');
                refreshBtn.title = originalTitle;
            }
            if (refreshLabel) refreshLabel.textContent = originalLabel;
        }
    }
    function startInitialRender() {
        const renderResult = renderActiveSubtab(false);
        const promise = Promise.resolve(renderResult);
        activeRenderPromise = promise;
        promise.then(
            () => {
                if (activeRenderPromise === promise) activeRenderPromise = null;
            },
            () => {
                if (activeRenderPromise === promise) activeRenderPromise = null;
            }
        );
        return promise;
    }

    function init(container) {
        if (!container) return null;

        // Повторный mount того же DOM-узла не должен восстанавливать состояние,
        // перевешивать handlers или запускать второй render/fetch.
        if (state.initialized && state.container === container) {
            return activeRenderPromise;
        }

        if (state.initialized && state.container && state.container !== container) {
            closeExportModal();
            cleanupOverview();
            cleanupSales();
            cleanupPurchases();
            cleanupOperations();
            cleanupPotential();
            cleanupProfit();
            activeRenderPromise = null;
        }

        state.container = container;
        state.initialized = true;

        // Восстановление активной подвкладки и периода
        try {
            const savedSubtab = sessionStorage.getItem('fpt_fin_active_subtab');
            if (savedSubtab) state.activeSubtab = savedSubtab;

            const savedPeriod = sessionStorage.getItem(PERIOD_STORAGE_KEY);
            let restoredRange = null;
            if (savedPeriod && savedPeriod.trim().charAt(0) === '{') {
                try {
                    const parsed = JSON.parse(savedPeriod);
                    restoredRange = makeCustomRange(parsed.from, parsed.to);
                } catch (_) {}
            } else if (savedPeriod === 'custom') {
                try {
                    const parsed = JSON.parse(sessionStorage.getItem(CUSTOM_RANGE_STORAGE_KEY) || '');
                    restoredRange = makeCustomRange(parsed.from, parsed.to);
                } catch (_) {}
            }
            if (restoredRange) {
                state.period = restoredRange;
                state.customRange = restoredRange;
            } else if (savedPeriod && savedPeriod !== 'custom') {
                state.period = savedPeriod;
                state.periodBeforeCustom = savedPeriod;
            }
        } catch (_) {}

        const periodSelect = container.querySelector('#fptFinPeriodSelect');
        if (periodSelect && state.period) {
            periodSelect.value = periodKey(state.period);
        }

        setupHeaderFilters(container);

        updateLastUpdatedText(state.activeSubtab);

        return startInitialRender();
    }

    function onOpen() {
        if (!state.container) {
            const el = document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
            return el ? init(el) : null;
        }

        // init() уже смонтировал контейнер. Пока первый render идет, возвращаем
        // его promise; после завершения повторное открытие не делает новый fetch.
        return activeRenderPromise;
    }

    // Compose the ordered classic-script modules around this controller's explicit state/services.
    const financeHubModules = root.FPTFinanceHubModules;
    if (!financeHubModules) throw new Error('Finance Hub UI modules must load before finance_hub.js');
    const moduleContext = { root, state, PALETTE, SYMBOLS, OPERATION_TYPE_LABELS, DEFAULT_PERIOD, PERIOD_STORAGE_KEY, CUSTOM_RANGE_STORAGE_KEY, MSK_OFFSET_MS, ONE_DAY_MS, getMskParts, getMskDayKey, getMskMonthKey, getMskWeekKey, formatMskDateTime, periodKey, isDateOnly, isValidDateOnly, formatCustomDateLabel, makeCustomRange, cleanupSales, cleanupPurchases, formatLastUpdatedText, updateLastUpdatedText, cleanupOperations, cleanupPotential, cleanupProfit, cleanupOverview, onSubtabChange, invalidateSalesCache, invalidatePurchasesCache, invalidateOperationsCache, invalidateProfitCache, invalidatePotentialCache, invalidateOverviewCache, invalidateAllCaches, renderActiveSubtab, reRenderActiveSubtab, persistPeriod, removeCustomRangeStorage, onCustomRangeApply, onCustomRangeReset, onPeriodChange, onCurrencyChange, onStatusChange, onCategoryChange, refresh, startInitialRender, init, onOpen };
    const moduleApis = [
        financeHubModules.createSharedUi(moduleContext),
        financeHubModules.createFilters(moduleContext),
        financeHubModules.createExports(moduleContext),
        financeHubModules.createOverview(moduleContext),
        financeHubModules.createSales(moduleContext),
        financeHubModules.createPurchases(moduleContext),
        financeHubModules.createOperations(moduleContext),
        financeHubModules.createPotential(moduleContext),
        financeHubModules.createProfit(moduleContext)
    ];
    Object.assign(moduleContext, ...moduleApis);
    const { esc, formatMoney, formatRevenueMulti, formatAvgCheckMulti, formatDate, periodLabel, pluralOrders, pluralBuyers, pluralSellers, pluralProducts, pluralCategories, pluralPurchases, updateCountBadge, updatePurchasesCountBadge, getTooltip, showTooltip, hideTooltip, removeTooltip, openDrilldown, smoothPath, niceMax, fmtAxis, groupOrdersByStep, renderDynamicChart, renderCategoryDonut, updateCategorySelectOptions, getCustomRangeControls, getFinanceControlVisualHost, setFinanceControlVisible, financeCustomSelectParts, syncFinanceCustomSelectScrollbar, syncFinanceCustomSelect, closeFinanceCustomSelect, closeOtherFinanceCustomSelects, openFinanceCustomSelect, enhanceFinanceCustomSelect, setCustomRangeError, syncCustomRangeControls, setupHeaderFilters, updateHeaderFiltersVisibility, applyFinanceThemeToExportOverlay, getDatasetForExport, exportFinanceData, closeExportModal, openExportModal, renderOverviewSubtabLoading, renderOverviewRow1, renderOverviewRow2, renderOverviewDynamicChart, renderOverviewCharts, renderOverviewTopProducts, renderOverviewTopCategories, renderOverviewOperations, bindOverviewChartToggles, bindOverviewKpiKeyboard, renderOverviewSubtab, renderDetailsContent, renderSalesSubtab, getPurchasesConfig, renderPurchasesTopSellersCard, renderPurchasesDetailsContent, renderPurchasesSubtab, operationTypeLabel, operationSignedValue, formatOperationsMap, getOperationsNetEntries, formatOperationsNet, renderOperationsNetBadges, operationDateValue, operationDateLabel, operationStatusLabel, operationPeriodLabel, operationFlowChart, operationModalRow, openOperationsDrilldown, renderOperationsCards, renderOperationsBreakdown, renderOperationsTable, renderOperationsSubtabLoading, renderOperationsSubtab, filterPotentialLots, getPotentialStockBreakdown, renderPotentialCards, setPotentialTableEmptyState, renderPotentialTable, bindPotentialFilters, renderPotentialSubtabLoading, renderPotentialSubtab, filterProfitOrders, renderProfitCards, getProfitCostCoverageNotice, renderProfitMissingCostWarning, renderProfitCoverage, renderProfitChart, renderProfitTable, bindProfitFilters, renderProfitSubtabLoading, renderProfitSubtab } = moduleContext;

    // Экспорт контроллера
    const hub = {
        init,
        onOpen,
        onSubtabChange,
        onPeriodChange,
        onCustomRangeApply,
        onCustomRangeReset,
        onCurrencyChange,
        onStatusChange,
        onCategoryChange,
        onPageLeave: () => {
            closeExportModal();
            hideTooltip();
            // Не инвалидируем первичный mount, пока он еще получает данные:
            // повторное открытие той же страницы присоединяется к этому же
            // promise и не создает параллельный fetch.
            if (!activeRenderPromise) {
                cleanupOverview();
                cleanupSales();
                cleanupPurchases();
                cleanupOperations();
                cleanupPotential();
                cleanupProfit();
            }
        },
        refresh,
        openExportModal,
        closeExportModal,
        getDatasetForExport,
        exportFinanceData,
        renderOverviewSubtab,
        renderSalesSubtab,
        renderPurchasesSubtab,
        renderOperationsSubtab,
        renderPotentialSubtab,
        renderProfitSubtab,
        cleanupOverview,
        cleanupSales,
        cleanupPurchases,
        cleanupOperations,
        cleanupPotential,
        cleanupProfit,
        getState: () => Object.assign({}, state),
        getMskParts,
        getMskDayKey,
        getMskMonthKey,
        getMskWeekKey,
        formatMskDateTime,
        MSK_OFFSET_MS,
        groupOrdersByStep,
        renderDynamicChart,
        operationFlowChart,
        renderOverviewDynamicChart,
        formatLastUpdatedText,
        updateLastUpdatedText,
        resolvePreviousPeriodRange: (p, o) => {
            const fd = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
            return fd && typeof fd.resolvePreviousPeriodRange === 'function' ? fd.resolvePreviousPeriodRange(p, o) : null;
        },
        formatKpiComparison: (c, p, o) => {
            const fd = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
            return fd && typeof fd.formatKpiComparison === 'function' ? fd.formatKpiComparison(c, p, o) : null;
        },
        compareKpis: (c, p, o) => {
            const fd = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
            return fd && typeof fd.compareKpis === 'function' ? fd.compareKpis(c, p, o) : null;
        }
    };

    if (typeof window !== 'undefined') {
        window.fptFinanceHub = hub;
        window.FPTFinanceHub = hub;
    }
    if (root) {
        root.fptFinanceHub = hub;
        root.FPTFinanceHub = hub;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = hub;
    }

    if (typeof document !== 'undefined') {
        const page = document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
        if (page) {
            init(page);
        }
    }

})(typeof window !== 'undefined' ? window : this);
