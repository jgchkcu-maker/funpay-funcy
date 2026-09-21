/**
 * FunPay Tools — Finance Hub Controller (Sales, Purchases & Operations — T03A/T03B/T03C)
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

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function formatMoney(v, cur) {
        if (v == null || isNaN(v)) return '0 ₽';
        const c = String(cur || 'RUB').toUpperCase();
        const sym = SYMBOLS[c] || c;
        return `${Math.round(v).toLocaleString('ru-RU')} ${sym}`;
    }

    function formatRevenueMulti(byCurrency) {
        if (!byCurrency || typeof byCurrency !== 'object') return '0 ₽';
        const parts = [];
        for (const cur of ['RUB', 'USD', 'EUR']) {
            const val = byCurrency[cur];
            if (typeof val === 'number' && val > 0) {
                parts.push(formatMoney(val, cur));
            }
        }
        for (const [cur, val] of Object.entries(byCurrency)) {
            if (!['RUB', 'USD', 'EUR'].includes(cur) && typeof val === 'number' && val > 0) {
                parts.push(formatMoney(val, cur));
            }
        }
        return parts.length ? parts.join(' · ') : '0 ₽';
    }

    function formatAvgCheckMulti(avgCheck) {
        if (!avgCheck || typeof avgCheck !== 'object') return '—';
        const parts = [];
        for (const cur of ['RUB', 'USD', 'EUR']) {
            const val = avgCheck[cur];
            if (typeof val === 'number' && val > 0) {
                parts.push(formatMoney(val, cur));
            }
        }
        for (const [cur, val] of Object.entries(avgCheck)) {
            if (!['RUB', 'USD', 'EUR'].includes(cur) && typeof val === 'number' && val > 0) {
                parts.push(formatMoney(val, cur));
            }
        }
        return parts.length ? parts.join(' · ') : '—';
    }

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

    function formatDate(ts) {
        return formatMskDateTime(ts, false);
    }

    function periodLabel(period) {
        const map = {
            today: 'сегодня',
            yesterday: 'вчера',
            '24h': 'последние 24 часа',
            '7d': 'последние 7 дней',
            '30d': 'последние 30 дней',
            '365d': 'последний год',
            all: 'всё время'
        };
        if (period && typeof period === 'object') {
            if (period.label) return period.label;
            const from = period.from || period.start || '…';
            const to = period.to || period.end || '…';
            return `${formatCustomDateLabel(from)} — ${formatCustomDateLabel(to)}`;
        }
        return map[period] || period;
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

    function pluralOrders(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} заказов`;
        if (rem > 1 && rem < 5) return `${n} заказа`;
        if (rem === 1) return `${n} заказ`;
        return `${n} заказов`;
    }

    function pluralBuyers(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} покупателей`;
        if (rem > 1 && rem < 5) return `${n} покупателя`;
        if (rem === 1) return `${n} покупатель`;
        return `${n} покупателей`;
    }

    function pluralSellers(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} продавцов`;
        if (rem > 1 && rem < 5) return `${n} продавца`;
        if (rem === 1) return `${n} продавец`;
        return `${n} продавцов`;
    }

    function pluralProducts(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} товаров`;
        if (rem > 1 && rem < 5) return `${n} товара`;
        if (rem === 1) return `${n} товар`;
        return `${n} товаров`;
    }

    function pluralCategories(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} категорий`;
        if (rem > 1 && rem < 5) return `${n} категории`;
        if (rem === 1) return `${n} категория`;
        return `${n} категорий`;
    }

    function getPurchasesConfig() {
        if (typeof window !== 'undefined' && window.FPTPurchasesConfig) {
            return window.FPTPurchasesConfig;
        }
        if (root && root.FPTPurchasesConfig) {
            return root.FPTPurchasesConfig;
        }
        return {
            updateAction: 'updatePurchases',
            resetAction: 'resetPurchasesStorage',
            collectingKey: 'fpToolsPurchasesCollecting',
            lastUpdateKey: 'fpToolsPurchasesLastUpdate',
            filterKey: 'fpToolsPurchasesFilters',
            title: 'Статистика покупок',
            totalMoneyLabel: 'Расходы на покупки',
            partyLabel: 'Продавец',
            topTableLabel: 'Топ продавцов',
            countLabel: 'Покупок',
            chartHeading: 'Покупки'
        };
    }

    function updateCountBadge(detailsCard, orders, agg, view) {
        const countBadge = detailsCard.querySelector('#fptFinSalesCountBadge');
        if (!countBadge) return;
        if (view === 'buyers') {
            const n = (agg && agg.topBuyers) ? agg.topBuyers.length : 0;
            countBadge.textContent = pluralBuyers(n);
        } else if (view === 'products') {
            const n = (agg && agg.topProducts) ? agg.topProducts.length : 0;
            countBadge.textContent = pluralProducts(n);
        } else if (view === 'categories') {
            const n = (agg && agg.topCategories) ? agg.topCategories.length : 0;
            countBadge.textContent = pluralCategories(n);
        } else {
            countBadge.textContent = pluralOrders(orders ? orders.length : 0);
        }
    }

    function pluralPurchases(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} покупок`;
        if (rem > 1 && rem < 5) return `${n} покупки`;
        if (rem === 1) return `${n} покупка`;
        return `${n} покупок`;
    }

    function updatePurchasesCountBadge(detailsCard, orders, agg, view) {
        const countBadge = detailsCard.querySelector('#fptFinPurchasesCountBadge') || detailsCard.querySelector('.fpt-fin-empty-badge');
        if (!countBadge) return;
        if (view === 'sellers') {
            const n = (agg && agg.topSellers) ? agg.topSellers.length : ((agg && agg.topBuyers) ? agg.topBuyers.length : 0);
            countBadge.textContent = pluralSellers(n);
        } else if (view === 'products') {
            const n = (agg && agg.topProducts) ? agg.topProducts.length : 0;
            countBadge.textContent = pluralProducts(n);
        } else if (view === 'categories') {
            const n = (agg && agg.topCategories) ? agg.topCategories.length : 0;
            countBadge.textContent = pluralCategories(n);
        } else {
            countBadge.textContent = pluralPurchases(orders ? orders.length : 0);
        }
    }

    function updateCategorySelectOptions(categories) {
        if (!state.container) return;
        const select = state.container.querySelector('#fptFinCategorySelect');
        if (!select) return;

        if (!state.knownCategories) {
            state.knownCategories = new Set();
        }

        if (Array.isArray(categories)) {
            categories.forEach(c => {
                if (c && typeof c === 'string' && c.trim() && c.trim() !== 'Без категории') {
                    state.knownCategories.add(c.trim());
                }
            });
        }

        const sortedCats = Array.from(state.knownCategories).sort((a, b) => a.localeCompare(b, 'ru'));
        const currentOptions = Array.from(select.options || []).map(o => o.value);
        const newOptions = ['all', ...sortedCats];

        if (currentOptions.length === newOptions.length && currentOptions.every((v, i) => v === newOptions[i])) {
            select.value = state.category;
            return;
        }

        select.innerHTML = '<option value="all">Все категории</option>' +
            sortedCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

        if (state.category && state.knownCategories.has(state.category)) {
            select.value = state.category;
        } else {
            select.value = 'all';
            state.category = 'all';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ТУЛТИП ДЛЯ ГРАФИКОВ И ДИАГРАММ
    // ─────────────────────────────────────────────────────────────────────────────

    function getTooltip() {
        if (!state.tooltipEl) {
            let el = document.getElementById('fpt-fin-floating-tooltip');
            if (!el) {
                el = document.createElement('div');
                el.id = 'fpt-fin-floating-tooltip';
                el.className = 'fpt-fin-tooltip';
                document.body.appendChild(el);
            }
            state.tooltipEl = el;
        }
        return state.tooltipEl;
    }

    function showTooltip(html, x, y) {
        const tip = getTooltip();
        tip.innerHTML = html;
        tip.style.display = 'block';
        const pad = 12;
        let left = x + pad;
        let top = y + pad;
        const tipW = tip.offsetWidth;
        const tipH = tip.offsetHeight;
        if (left + tipW > window.innerWidth - 8) {
            left = Math.max(8, x - tipW - pad);
        }
        if (top + tipH > window.innerHeight - 8) {
            top = Math.max(8, y - tipH - pad);
        }
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function hideTooltip() {
        if (state.tooltipEl) {
            state.tooltipEl.style.display = 'none';
        }
    }

    function removeTooltip() {
        if (state.tooltipEl) {
            state.tooltipEl.remove();
            state.tooltipEl = null;
        }
        const el = document.getElementById('fpt-fin-floating-tooltip');
        if (el) el.remove();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DRILL-DOWN INTEGRATION
    // ─────────────────────────────────────────────────────────────────────────────

    function openDrilldown(title, subtitle, orders) {
        const list = Array.isArray(orders) ? orders : [];
        if (typeof window !== 'undefined' && typeof window.fptOpenDrilldownModal === 'function') {
            window.fptOpenDrilldownModal(title, subtitle, list);
        } else {
            console.warn('[FPTFinanceHub] Drilldown modal is not available');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SVG ГРАФИК ДИНАМИКИ ПРОДАЖ
    // ─────────────────────────────────────────────────────────────────────────────

    function smoothPath(pts) {
        if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
        let d = `M${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;
            const t = 0.16;
            const c1x = p1.x + (p2.x - p0.x) * t;
            const c1y = p1.y + (p2.y - p0.y) * t;
            const c2x = p2.x - (p3.x - p1.x) * t;
            const c2y = p2.y - (p3.y - p1.y) * t;
            d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
        }
        return d;
    }

    function niceMax(v) {
        if (v <= 0) return 1;
        const mag = Math.pow(10, Math.floor(Math.log10(v)));
        const n = v / mag;
        const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
        return step * mag;
    }

    function fmtAxis(v) {
        if (v >= 1000000) return (Math.round(v / 100000) / 10) + 'млн';
        if (v >= 1000) return (Math.round(v / 100) / 10) + 'к';
        return String(Math.round(v));
    }

    /**
     * Группировка заказов по шагам: день, неделя, месяц (по календарю МСК, T06)
     */
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

    function renderDynamicChart(cardEl, orders, step, options) {
        let chartContainer = cardEl.querySelector('.fpt-fin-chart-container');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.className = 'fpt-fin-chart-container';
            const sk = cardEl.querySelector('.fpt-fin-skeleton-chart');
            if (sk) sk.replaceWith(chartContainer);
            else cardEl.appendChild(chartContainer);
        }

        const opts = options || {};
        const isPurchases = opts.isPurchases === true;
        const valLabel = isPurchases ? 'Потрачено' : 'Выручка';
        const cntLabel = isPurchases ? 'Покупок' : 'Заказов';
        const emptyTitle = isPurchases ? 'Нет данных о покупках' : 'Нет данных о продажах';
        const emptyDesc = isPurchases
            ? 'За выбранный период нет завершённых покупок.'
            : 'За выбранный период нет закрытых или оплаченных заказов.';
        const accent = opts.color || (isPurchases ? '#e57373' : 'var(--fptm-accent, var(--fpt-accent, #1b75bb))');
        const stopColor = isPurchases ? '#e57373' : '#1b75bb';

        const targetCur = opts.currency || (state.currency !== 'all' ? state.currency : (cardEl.dataset.chosenCur || null));
        const buckets = groupOrdersByStep(orders, step, targetCur);

        if (!buckets.length) {
            chartContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">show_chart</span>
                    <div class="fpt-fin-empty-title">${esc(emptyTitle)}</div>
                    <div class="fpt-fin-empty-desc">${esc(emptyDesc)}</div>
                </div>`;
            return;
        }

        if (buckets.isMultiCurrency) {
            const curButtons = (buckets.currencies || []).map(c =>
                `<button type="button" class="fpt-fin-btn fpt-fin-btn-secondary fpt-fin-cur-select-btn" data-cur="${esc(c)}" style="margin:4px;padding:4px 12px;font-size:12px;border-radius:14px;cursor:pointer;">${esc(c)} (${esc(SYMBOLS[c] || c)})</button>`
            ).join('');
            chartContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;text-align:center;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;color:var(--fptm-muted, #9099b8);">currency_exchange</span>
                    <div class="fpt-fin-empty-title" style="font-size:14px;font-weight:600;margin-top:8px;">Выберите валюту для отображения денежного графика</div>
                    <div class="fpt-fin-empty-desc" style="font-size:12px;color:var(--fptm-muted, #9099b8);margin-top:4px;max-width:460px;margin-left:auto;margin-right:auto;">
                        В выборке присутствуют операции в нескольких валютах. Финансовый хаб не строит общую денежную ось с приблизительной конвертацией.
                    </div>
                    <div class="fpt-fin-chart-cur-actions" style="margin-top:12px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
                        ${curButtons}
                    </div>
                </div>`;
            chartContainer.querySelectorAll('.fpt-fin-cur-select-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    cardEl.dataset.chosenCur = btn.dataset.cur;
                    renderDynamicChart(cardEl, orders, step, Object.assign({}, opts, { currency: btn.dataset.cur }));
                });
            });
            return;
        }

        const W = 680;
        const H = 200;
        const PAD = { t: 20, r: 20, b: 36, l: 56 };
        const cw = W - PAD.l - PAD.r;
        const ch = H - PAD.t - PAD.b;
        const baseY = PAD.t + ch;
        const slot = cw / Math.max(1, buckets.length);

        const vals = buckets.map(b => Number(b.revenue) || 0);
        const rawMax = Math.max(1, ...vals);
        const maxV = niceMax(rawMax);

        // Grid & Y labels
        let grid = '';
        let yLabels = '';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const y = baseY - (i / steps) * ch;
            grid += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--fptm-border, rgba(255,255,255,0.08))" stroke-width="1" opacity="${i === 0 ? 0.8 : 0.4}"/>`;
            const v = (maxV / steps) * i;
            yLabels += `<text x="${PAD.l - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--fptm-muted, #9099b8)" font-family="inherit">${fmtAxis(v)}</text>`;
        }

        const pts = buckets.map((b, i) => ({
            x: PAD.l + slot * i + slot / 2,
            y: baseY - (b.revenue / maxV) * ch,
            bucket: b
        }));

        const line = smoothPath(pts);
        const area = pts.length > 1
            ? `${line} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`
            : '';

        const uid = 'fptFinGrad_' + Math.random().toString(36).slice(2, 8);

        // X labels
        const MIN_GAP = 54;
        let lastX = -Infinity;
        let xLabels = '';
        pts.forEach((p, i) => {
            const isLast = i === pts.length - 1;
            if (isLast || (p.x - lastX >= MIN_GAP)) {
                xLabels += `<text x="${p.x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--fptm-muted, #9099b8)" font-family="inherit">${esc(p.bucket.label)}</text>`;
                lastX = p.x;
            }
        });

        // Visible circle points
        let dots = '';
        if (pts.length === 1) {
            dots = `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="5" fill="${accent}" stroke="var(--fptm-surface, #171922)" stroke-width="2"/>`;
        } else if (pts.length <= 45) {
            dots = pts.map(p =>
                `<circle class="fpt-fin-chart-dot" cx="${p.x}" cy="${p.y}" r="${pts.length <= 20 ? 3.5 : 2.5}" fill="${accent}" opacity="0.85"/>`
            ).join('');
        }

        // Hit zones for hover tooltip & drill-down
        const hits = pts.map((p, i) => {
            const b = p.bucket;
            return `<rect class="fpt-fin-svg-hit" data-idx="${i}" x="${p.x - slot / 2}" y="${PAD.t}" width="${slot}" height="${ch}" fill="transparent" style="cursor:pointer;" tabindex="0"></rect>`;
        }).join('');

        chartContainer.innerHTML = `
            <svg class="fpt-fin-chart-svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
                <defs>
                    <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${stopColor}" stop-opacity="0.28"/>
                        <stop offset="100%" stop-color="${stopColor}" stop-opacity="0.01"/>
                    </linearGradient>
                </defs>
                ${grid}
                ${area ? `<path d="${area}" fill="url(#${uid})" stroke="none"/>` : ''}
                ${line ? `<path d="${line}" fill="none" stroke="${accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
                ${dots}
                ${yLabels}
                ${xLabels}
                ${hits}
            </svg>`;

        // Event listeners on hit zones
        const svgHits = chartContainer.querySelectorAll('.fpt-fin-svg-hit');
        svgHits.forEach(hit => {
            const idx = Number(hit.dataset.idx);
            const b = buckets[idx];
            if (!b) return;

            hit.addEventListener('mouseenter', (e) => {
                const revStr = formatRevenueMulti(b.revenueByCur);
                const html = `<strong>${esc(b.label)}</strong><br/>${valLabel}: ${esc(revStr)}<br/>${cntLabel}: ${b.count} шт.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });

            hit.addEventListener('mousemove', (e) => {
                const revStr = formatRevenueMulti(b.revenueByCur);
                const html = `<strong>${esc(b.label)}</strong><br/>${valLabel}: ${esc(revStr)}<br/>${cntLabel}: ${b.count} шт.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });

            hit.addEventListener('mouseleave', () => {
                hideTooltip();
            });

            hit.addEventListener('click', () => {
                hideTooltip();
                const revStr = formatRevenueMulti(b.revenueByCur);
                const countStr = isPurchases ? pluralPurchases(b.count) : pluralOrders(b.count);
                const drillTitle = isPurchases ? `Покупки за ${b.label}` : `Заказы за ${b.label}`;
                openDrilldown(drillTitle, `${countStr} · ${revStr}`, b.orders);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SVG КРУГОВАЯ ДИАГРАММА (DONUT) ПО КАТЕГОРИЯМ
    // ─────────────────────────────────────────────────────────────────────────────

    function renderCategoryDonut(cardEl, orders, agg, options) {
        cardEl.querySelectorAll('.fpt-fin-skeleton, .fpt-fin-skeleton-text, .fpt-fin-skeleton-chart').forEach(s => s.remove());
        let donutContainer = cardEl.querySelector('.fpt-fin-donut-container');
        if (!donutContainer) {
            donutContainer = document.createElement('div');
            donutContainer.className = 'fpt-fin-donut-container';
            const sk = cardEl.querySelector('.fpt-fin-sellers-container');
            if (sk) sk.replaceWith(donutContainer);
            else cardEl.appendChild(donutContainer);
        }

        const opts = options || {};
        const isPurchases = opts.isPurchases === true;
        const valLabel = isPurchases ? 'Потрачено' : 'Выручка';
        const cntWord = isPurchases ? 'покупок' : 'заказов';
        const cntShort = isPurchases ? 'пок.' : 'зак.';
        const emptyDesc = isPurchases ? 'За выбранный период нет покупок.' : 'За выбранный период нет заказов.';

        const validOrders = (Array.isArray(orders) ? orders : []).filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
        const catMap = {};
        for (const o of validOrders) {
            const cat = o.subcategoryName || 'Без категории';
            if (!catMap[cat]) catMap[cat] = { count: 0, revenueByCur: {}, orders: [] };
            catMap[cat].count++;
            catMap[cat].orders.push(o);
            const cur = String(o.currency || 'RUB').toUpperCase();
            const p = Number(o.price) || 0;
            catMap[cat].revenueByCur[cur] = (catMap[cat].revenueByCur[cur] || 0) + p;
        }

        const entries = Object.entries(catMap)
            .map(([name, data]) => ({ name, count: data.count, revenueByCur: data.revenueByCur, orders: data.orders }))
            .sort((a, b) => b.count - a.count);

        if (!entries.length) {
            donutContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">pie_chart</span>
                    <div class="fpt-fin-empty-title">Нет категорий</div>
                    <div class="fpt-fin-empty-desc">${esc(emptyDesc)}</div>
                </div>`;
            return;
        }

        const totalOrders = entries.reduce((s, e) => s + e.count, 0);
        const topSlices = entries.slice(0, 6);
        const otherEntries = entries.slice(6);
        if (otherEntries.length) {
            const otherOrders = [];
            const otherCur = {};
            let otherCount = 0;
            for (const oe of otherEntries) {
                otherCount += oe.count;
                otherOrders.push(...oe.orders);
                for (const [cur, sum] of Object.entries(oe.revenueByCur)) {
                    otherCur[cur] = (otherCur[cur] || 0) + sum;
                }
            }
            topSlices.push({
                name: 'Другие категории',
                count: otherCount,
                revenueByCur: otherCur,
                orders: otherOrders
            });
        }

        const cx = 70, cy = 70, r = 56, rin = 34;
        let acc = 0;
        let paths = '';
        let legendHTML = '';

        topSlices.forEach((slice, i) => {
            const frac = slice.count / Math.max(1, totalOrders);
            const pct = Math.round(frac * 100);
            const a0 = acc * 2 * Math.PI - Math.PI / 2;
            acc += frac;
            const a1 = acc * 2 * Math.PI - Math.PI / 2;
            const large = frac > 0.5 ? 1 : 0;

            const x0 = cx + r * Math.cos(a0);
            const y0 = cy + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1);
            const y1 = cy + r * Math.sin(a1);

            const xi1 = cx + rin * Math.cos(a1);
            const yi1 = cy + rin * Math.sin(a1);
            const xi0 = cx + rin * Math.cos(a0);
            const yi0 = cy + rin * Math.sin(a0);

            const col = PALETTE[i % PALETTE.length];

            if (frac >= 0.9999 || topSlices.length === 1) {
                paths += `<path class="fpt-fin-donut-seg" data-idx="${i}" d="M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r},${r} 0 1 1 ${cx},${cy - r} M${cx},${cy - rin} A${rin},${rin} 0 1 0 ${cx},${cy + rin} A${rin},${rin} 0 1 0 ${cx},${cy - rin} Z" fill="${col}" style="cursor:pointer;transition:opacity .15s;" tabindex="0"></path>`;
            } else {
                paths += `<path class="fpt-fin-donut-seg" data-idx="${i}" d="M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${rin},${rin} 0 ${large} 0 ${xi0},${yi0} Z" fill="${col}" style="cursor:pointer;transition:opacity .15s;" tabindex="0"></path>`;
            }

            legendHTML += `
                <div class="fpt-fin-legend-row" data-idx="${i}">
                    <span class="fpt-fin-legend-dot" style="background:${col};"></span>
                    <span class="fpt-fin-legend-label" title="${esc(slice.name)}">${esc(slice.name)}</span>
                    <span class="fpt-fin-legend-val">${pct}% (${slice.count} ${cntShort})</span>
                </div>`;
        });

        donutContainer.innerHTML = `
            <div class="fpt-fin-donut-wrap">
                <svg class="fpt-fin-donut-svg" viewBox="0 0 140 140" width="140" height="140">
                    ${paths}
                    <text x="70" y="74" text-anchor="middle" font-size="14" font-weight="700" fill="var(--fptm-text, #fff)" font-family="inherit">${totalOrders}</text>
                    <text x="70" y="87" text-anchor="middle" font-size="9" fill="var(--fptm-muted, #9099b8)" font-family="inherit">${esc(cntWord)}</text>
                </svg>
                <div class="fpt-fin-donut-legend">
                    ${legendHTML}
                </div>
            </div>`;

        // Tooltip and click handlers
        const attachSliceEvents = (el, slice) => {
            el.addEventListener('mouseenter', (e) => {
                const revStr = formatRevenueMulti(slice.revenueByCur);
                const html = `<strong>${esc(slice.name)}</strong><br/>${isPurchases ? 'Покупок' : 'Заказов'}: ${slice.count}<br/>${valLabel}: ${esc(revStr)}<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });
            el.addEventListener('mousemove', (e) => {
                const revStr = formatRevenueMulti(slice.revenueByCur);
                const html = `<strong>${esc(slice.name)}</strong><br/>${isPurchases ? 'Покупок' : 'Заказов'}: ${slice.count}<br/>${valLabel}: ${esc(revStr)}<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });
            el.addEventListener('mouseleave', () => {
                hideTooltip();
            });
            el.addEventListener('click', () => {
                hideTooltip();
                const revStr = formatRevenueMulti(slice.revenueByCur);
                const countStr = isPurchases ? pluralPurchases(slice.count) : pluralOrders(slice.count);
                openDrilldown(`Категория: ${slice.name}`, `${countStr} · ${revStr}`, slice.orders);
            });
        };

        donutContainer.querySelectorAll('.fpt-fin-donut-seg').forEach(seg => {
            const idx = Number(seg.dataset.idx);
            if (topSlices[idx]) attachSliceEvents(seg, topSlices[idx]);
        });
        donutContainer.querySelectorAll('.fpt-fin-legend-row').forEach(row => {
            const idx = Number(row.dataset.idx);
            if (topSlices[idx]) attachSliceEvents(row, topSlices[idx]);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ТАБЛИЦА ДЕТАЛИЗАЦИИ И ТОПЫ (ORDERS / BUYERS / PRODUCTS / CATEGORIES)
    // ─────────────────────────────────────────────────────────────────────────────

    function renderDetailsContent(contentEl, orders, agg, view) {
        const allOrders = Array.isArray(orders) ? orders : [];

        if (view === 'buyers') {
            const topBuyers = agg && agg.topBuyers ? agg.topBuyers : [];
            if (!topBuyers.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о покупателях</div></div>';
                return;
            }
            const rows = topBuyers.slice(0, 50).map((b, i) => {
                const revStr = formatRevenueMulti(b.revenueByCurrency);
                const userLink = b.id ? `<a class="fpt-fin-table-link" href="https://funpay.com/users/${esc(b.id)}/" target="_blank" rel="noopener">${esc(b.name)}</a>` : `<span>${esc(b.name)}</span>`;
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td>${userLink}</td>
                    <td style="font-weight:700;">${b.count} шт.</td>
                    <td style="font-weight:600;">${esc(revStr)}</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn" data-buyer-name="${esc(b.name)}">Заказы</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Покупатель</th>
                            <th>Заказов</th>
                            <th>Сумма покупок</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-buyer-name]').forEach(btn => {
                const bName = btn.dataset.buyerName;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.buyerUsername || o.sellerUsername || o.sellerName || '-') === bName);
                    openDrilldown(`Покупатель: ${bName}`, `${filtered.length} заказов`, filtered);
                });
            });
            return;
        }

        if (view === 'products') {
            const topProducts = agg && agg.topProducts ? agg.topProducts : [];
            if (!topProducts.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о товарах</div></div>';
                return;
            }
            const rows = topProducts.slice(0, 50).map((p, i) => {
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;" title="${esc(p.name)}">${esc(p.name)}</td>
                    <td style="font-weight:700;">${p.count} раз</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn" data-prod-name="${esc(p.name)}">Заказы</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Товар / Описание</th>
                            <th>Продано</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-prod-name]').forEach(btn => {
                const pName = btn.dataset.prodName;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.description || '-') === pName);
                    openDrilldown(`Товар: ${pName}`, `${filtered.length} продаж`, filtered);
                });
            });
            return;
        }

        if (view === 'categories') {
            const topCats = agg && agg.topCategories ? agg.topCategories : [];
            if (!topCats.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о категориях</div></div>';
                return;
            }
            const rows = topCats.slice(0, 50).map((c, i) => {
                const revByCur = (agg && agg.byCategoryRevenue && agg.byCategoryRevenue[c.name]) || {};
                const revStr = formatRevenueMulti(revByCur);
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td>${esc(c.name)}</td>
                    <td style="font-weight:700;">${c.count} зак.</td>
                    <td style="font-weight:600;">${esc(revStr)}</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn" data-cat-name="${esc(c.name)}">Заказы</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Категория</th>
                            <th>Заказов</th>
                            <th>Выручка</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-cat-name]').forEach(btn => {
                const cName = btn.dataset.catName;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.subcategoryName || 'Без категории') === cName);
                    openDrilldown(`Категория: ${cName}`, `${filtered.length} заказов`, filtered);
                });
            });
            return;
        }

        // View: 'orders' (По умолчанию)
        if (!allOrders.length) {
            contentEl.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:32px 16px;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;">receipt_long</span>
                    <div class="fpt-fin-empty-title">Нет заказов</div>
                    <div class="fpt-fin-empty-desc">За период ${esc(periodLabel(state.period))} заказов на продажу не обнаружено.</div>
                </div>`;
            return;
        }

        const visibleOrders = allOrders.slice(0, state.visibleOrdersLimit);
        const rows = visibleOrders.map(o => {
            let badgeClass = 'fpt-fin-status-neutral';
            let statusText = 'В обработке';
            if (o.orderStatus === 'closed') {
                badgeClass = 'fpt-fin-status-success';
                statusText = 'Завершён';
            } else if (o.orderStatus === 'paid') {
                badgeClass = 'fpt-fin-status-warning';
                statusText = 'Оплачен';
            } else if (o.orderStatus === 'refunded') {
                badgeClass = 'fpt-fin-status-danger';
                statusText = 'Возврат';
            }

            const buyerInner = o.buyerId
                ? `<a class="fpt-fin-table-link" href="https://funpay.com/users/${esc(o.buyerId)}/" target="_blank" rel="noopener">${esc(o.buyerUsername || '—')}</a>`
                : esc(o.buyerUsername || '—');

            const orderIdStr = String(o.orderId || '').replace(/^#/, '');
            const orderLink = orderIdStr
                ? `<a class="fpt-fin-table-link" href="https://funpay.com/orders/trade?id=${esc(orderIdStr)}" target="_blank" rel="noopener">#${esc(orderIdStr)}</a>`
                : '—';

            return `
            <tr>
                <td>${orderLink}</td>
                <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;" title="${esc(o.description)}">${esc(o.description || '—')}</td>
                <td>${buyerInner}</td>
                <td style="color:var(--fptm-muted,#8a90ab);">${esc(formatDate(o.orderDate))}</td>
                <td style="font-weight:700;">${esc(formatMoney(o.price, o.currency))}</td>
                <td><span class="fpt-fin-status-badge ${badgeClass}">${esc(statusText)}</span></td>
            </tr>`;
        }).join('');

        let moreBtnHTML = '';
        if (allOrders.length > state.visibleOrdersLimit) {
            const rest = allOrders.length - state.visibleOrdersLimit;
            moreBtnHTML = `
            <div class="fpt-fin-table-footer">
                <span style="font-size:12px;color:var(--fptm-muted, #9099b8);">Показано ${visibleOrders.length} из ${allOrders.length}</span>
                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinShowMoreOrdersBtn" style="padding:4px 14px;font-size:12px;">Показать ещё ${Math.min(50, rest)}</button>
            </div>`;
        }

        contentEl.innerHTML = `
            <table class="fpt-fin-table">
                <thead>
                    <tr>
                        <th>Заказ</th>
                        <th>Товар / Описание</th>
                        <th>Покупатель</th>
                        <th>Дата</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${moreBtnHTML}`;

        const moreBtn = contentEl.querySelector('#fptFinShowMoreOrdersBtn');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                state.visibleOrdersLimit += 50;
                const currentOrders = state.cachedOrders || allOrders;
                const currentAgg = state.cachedAgg || agg;
                renderDetailsContent(contentEl, currentOrders, currentAgg, 'orders');
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ОСНОВНОЙ РЕНДЕР ПОДВКЛАДКИ SALES
    // ─────────────────────────────────────────────────────────────────────────────

    async function renderSalesSubtab(forceReload) {
        if (!state.container) return;
        const salesPane = state.container.querySelector('.fpt-fin-tab-pane[data-subtab="sales"]');
        if (!salesPane) return;

        const currentToken = ++state.renderToken;

        // Если период изменился или запрошен forceReload — загружаем данные через адаптер
        if (forceReload || state.cachedPeriod !== state.period || !state.cachedOrders) {
            state.isLoading = true;

            // Если это не моментальная перерисовка из кэша, покажем skeletons в карточках
            if (!state.cachedOrders) {
                salesPane.querySelectorAll('.fpt-fin-card-value').forEach(v => {
                    v.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
                });
            }

            try {
                if (!root.FPTFinanceData || typeof root.FPTFinanceData.getSales !== 'function') {
                    console.warn('[FPTFinanceHub] FPTFinanceData is not available');
                    return;
                }

                const filterOpts = {
                    period: state.period,
                    useMsk: true,
                    sort: 'date-desc'
                };
                if (state.orderStatus && state.orderStatus !== 'all') {
                    filterOpts.statuses = state.orderStatus;
                }
                if (state.currency && state.currency !== 'all') {
                    filterOpts.currency = state.currency;
                }
                if (state.category && state.category !== 'all') {
                    filterOpts.category = state.category;
                }

                const orders = await root.FPTFinanceData.getSales(filterOpts);

                if (currentToken !== state.renderToken) return;

                const agg = root.FPTFinanceData.aggregateSales(orders, {
                    period: state.period,
                    useMsk: true
                });

                let prevSalesAgg = null;
                let salesKpiDiffs = null;
                const prevPeriod = (root.FPTFinanceData && typeof root.FPTFinanceData.resolvePreviousPeriodRange === 'function')
                    ? root.FPTFinanceData.resolvePreviousPeriodRange(state.period, { useMsk: true })
                    : null;
                if (prevPeriod) {
                    try {
                        const prevOrders = await root.FPTFinanceData.getSales(Object.assign({}, filterOpts, { period: prevPeriod }));
                        prevSalesAgg = root.FPTFinanceData.aggregateSales(prevOrders, { period: prevPeriod, useMsk: true });
                        if (typeof root.FPTFinanceData.compareKpis === 'function') {
                            salesKpiDiffs = root.FPTFinanceData.compareKpis({ salesAgg: agg }, { salesAgg: prevSalesAgg }, { currency: state.currency, primaryCurrency: state.profitCurrency || 'RUB' });
                        }
                    } catch (_) {}
                }

                state.cachedOrders = orders;
                state.cachedAgg = agg;
                state.cachedPrevSalesAgg = prevSalesAgg;
                state.cachedSalesKpiDiffs = salesKpiDiffs;
                state.cachedPeriod = state.period;
                state.visibleOrdersLimit = 50;
                updateCategorySelectOptions(orders.map(o => o.subcategoryName || o.category));
            } catch (err) {
                console.error('[FPTFinanceHub] Error loading sales data:', err);
                if (currentToken !== state.renderToken) return;
            } finally {
                state.isLoading = false;
            }
        }

        if (currentToken !== state.renderToken) return;

        const orders = state.cachedOrders || [];
        const agg = state.cachedAgg || {
            count: 0, total: 0, byStatus: { closed: 0, paid: 0, refunded: 0 },
            byCurrency: {}, averageCheck: {}, refundedRevenue: {}, byDay: {}, byCategory: {},
            topBuyers: [], topProducts: [], topCategories: []
        };

        const validOrders = orders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
        const refundedOrders = orders.filter(o => o.orderStatus === 'refunded');

        // 1. KPI Карточки
        const cards = salesPane.querySelectorAll('.fpt-fin-col-3 .fpt-fin-card');
        if (cards.length >= 4) {
            // Карточка 0: Выручка от продаж
            const revCard = cards[0];
            revCard.classList.add('fpt-fin-clickable');
            const revStr = formatRevenueMulti(agg.byCurrency);
            const revDiffHtml = (state.cachedSalesKpiDiffs && state.cachedSalesKpiDiffs.revenue) ? state.cachedSalesKpiDiffs.revenue.badgeHtml : '';
            revCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Выручка от продаж</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">payments</span>
                </div>
                <div class="fpt-fin-card-value">${esc(revStr)}</div>
                <div class="fpt-fin-card-sub">${revDiffHtml}${revDiffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">${agg.byStatus.closed || 0} закрыто · ${agg.byStatus.paid || 0} в ожидании</span></div>`;
            revCard.title = 'Нажмите для просмотра оплаченных заказов';
            revCard.onclick = () => openDrilldown('Выручка от продаж', `${periodLabel(state.period)} · ${validOrders.length} заказов · ${revStr}`, validOrders);

            // Карточка 1: Оплачено заказов
            const ordCard = cards[1];
            ordCard.classList.add('fpt-fin-clickable');
            const ordDiffHtml = (state.cachedSalesKpiDiffs && state.cachedSalesKpiDiffs.orders) ? state.cachedSalesKpiDiffs.orders.badgeHtml : '';
            ordCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Оплачено заказов</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, var(--fpt-accent, #1b75bb));">check_circle</span>
                </div>
                <div class="fpt-fin-card-value">${agg.count} шт.</div>
                <div class="fpt-fin-card-sub">${ordDiffHtml}${ordDiffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Всего заказов: ${agg.total} (учтено: ${agg.count})</span></div>`;
            ordCard.title = 'Нажмите для просмотра оплаченных заказов';
            ordCard.onclick = () => openDrilldown('Оплаченные заказы', `${periodLabel(state.period)} · ${validOrders.length} заказов`, validOrders);

            // Карточка 2: Средний чек продажи
            const avgCard = cards[2];
            avgCard.classList.add('fpt-fin-clickable');
            const avgStr = formatAvgCheckMulti(agg.averageCheck);
            const avgDiffHtml = (state.cachedSalesKpiDiffs && state.cachedSalesKpiDiffs.averageCheck) ? state.cachedSalesKpiDiffs.averageCheck.badgeHtml : '';
            avgCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Средний чек продажи</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt</span>
                </div>
                <div class="fpt-fin-card-value">${esc(avgStr)}</div>
                <div class="fpt-fin-card-sub">${avgDiffHtml}${avgDiffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">По ${agg.count} оплаченным заказам</span></div>`;
            avgCard.title = 'Нажмите для просмотра учтённых заказов';
            avgCard.onclick = () => openDrilldown('Средний чек продажи', `${periodLabel(state.period)} · средний чек: ${avgStr}`, validOrders);

            // Карточка 3: Возвраты и споры
            const refCard = cards[3];
            refCard.classList.add('fpt-fin-clickable');
            const refRevStr = formatRevenueMulti(agg.refundedRevenue);
            refCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Возвраты и споры</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#f4c84a;">assignment_return</span>
                </div>
                <div class="fpt-fin-card-value">${agg.byStatus.refunded || 0} шт.</div>
                <div class="fpt-fin-card-sub">${esc(refRevStr)} возвращено</div>`;
            refCard.title = 'Нажмите для просмотра возвращённых заказов';
            refCard.onclick = () => openDrilldown('Возвраты и споры', `${periodLabel(state.period)} · ${refundedOrders.length} возвратов · ${refRevStr}`, refundedOrders);
        }

        // 2. График динамики продаж
        const dynCard = salesPane.querySelector('.fpt-fin-col-8 .fpt-fin-card');
        if (dynCard) {
            // Подключение переключателей шага: день / неделя / месяц
            const stepToggles = dynCard.querySelectorAll('.fpt-fin-chart-toggle[data-period-step]');
            stepToggles.forEach(toggle => {
                const step = toggle.dataset.periodStep;
                toggle.classList.toggle('active', step === state.salesStep);
                if (!toggle.dataset.fptBound) {
                    toggle.dataset.fptBound = '1';
                    toggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        stepToggles.forEach(t => t.classList.remove('active'));
                        toggle.classList.add('active');
                        state.salesStep = toggle.dataset.periodStep || 'day';
                        const currentOrders = state.cachedOrders || [];
                        renderDynamicChart(dynCard, currentOrders, state.salesStep);
                    });
                }
            });
            renderDynamicChart(dynCard, orders, state.salesStep);
        }

        // 3. Круговая диаграмма по категориям
        const catCard = salesPane.querySelector('.fpt-fin-col-4 .fpt-fin-card');
        if (catCard) {
            renderCategoryDonut(catCard, orders, agg);
        }

        // 4. Детализация продаж и топы
        const detailsCard = salesPane.querySelector('.fpt-fin-col-12 .fpt-fin-card');
        if (detailsCard) {
            updateCountBadge(detailsCard, orders, agg, state.salesView);

            // Переключатели вида (Заказы / Топ покупателей / Топ товаров / Топ категорий)
            const viewToggles = detailsCard.querySelectorAll('.fpt-fin-chart-toggle[data-sales-view]');
            viewToggles.forEach(toggle => {
                const view = toggle.dataset.salesView;
                toggle.classList.toggle('active', view === state.salesView);
                if (!toggle.dataset.fptBound) {
                    toggle.dataset.fptBound = '1';
                    toggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        viewToggles.forEach(t => t.classList.remove('active'));
                        toggle.classList.add('active');
                        state.salesView = toggle.dataset.salesView || 'orders';
                        const detailsContent = detailsCard.querySelector('#fptFinSalesDetailsContent') || detailsCard.querySelector('.fpt-fin-table-wrap');
                        if (detailsContent) {
                            const currentOrders = state.cachedOrders || [];
                            const currentAgg = state.cachedAgg || (root.FPTFinanceData ? root.FPTFinanceData.aggregateSales(currentOrders) : null);
                            updateCountBadge(detailsCard, currentOrders, currentAgg, state.salesView);
                            renderDetailsContent(detailsContent, currentOrders, currentAgg, state.salesView);
                        }
                    });
                }
            });

            const detailsContent = detailsCard.querySelector('#fptFinSalesDetailsContent') || detailsCard.querySelector('.fpt-fin-table-wrap');
            if (detailsContent) {
                renderDetailsContent(detailsContent, orders, agg, state.salesView);
            }
        }
    }

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

    function renderPurchasesTopSellersCard(cardEl, orders, agg) {
        const topSellers = (agg && agg.topSellers) ? agg.topSellers : ((agg && agg.topBuyers) ? agg.topBuyers : []);

        const titleEl = cardEl.querySelector('.fpt-fin-card-title');
        if (titleEl) {
            titleEl.textContent = state.purchasesCol4View === 'categories' ? 'Категории' : 'Топ продавцов';
        }

        // Управляем переключателем в заголовке карточки
        const cardHeader = cardEl.querySelector('.fpt-fin-card-header');
        if (cardHeader && !cardHeader.querySelector('.fpt-fin-chart-toggles')) {
            const toggles = document.createElement('div');
            toggles.className = 'fpt-fin-chart-toggles';
            toggles.setAttribute('role', 'group');
            toggles.setAttribute('aria-label', 'Вид аналитики');
            toggles.innerHTML = `
                <button type="button" class="fpt-fin-chart-toggle ${state.purchasesCol4View === 'sellers' ? 'active' : ''}" data-col4-view="sellers">Продавцы</button>
                <button type="button" class="fpt-fin-chart-toggle ${state.purchasesCol4View === 'categories' ? 'active' : ''}" data-col4-view="categories">Категории</button>
            `;
            cardHeader.appendChild(toggles);
        }

        const toggles = cardEl.querySelectorAll('.fpt-fin-chart-toggle[data-col4-view]');
        toggles.forEach(toggle => {
            const view = toggle.dataset.col4View;
            toggle.classList.toggle('active', view === state.purchasesCol4View);
            if (!toggle.dataset.fptBound) {
                toggle.dataset.fptBound = '1';
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggles.forEach(t => t.classList.remove('active'));
                    toggle.classList.add('active');
                    state.purchasesCol4View = toggle.dataset.col4View || 'sellers';
                    const currentOrders = state.cachedPurchasesOrders || orders;
                    const currentAgg = state.cachedPurchasesAgg || agg;
                    renderPurchasesTopSellersCard(cardEl, currentOrders, currentAgg);
                });
            }
        });

        // Если выбран режим категорий — отрисовываем круговую диаграмму
        if (state.purchasesCol4View === 'categories') {
            const sellersWrap = cardEl.querySelector('.fpt-fin-sellers-container');
            if (sellersWrap) sellersWrap.remove();
            renderCategoryDonut(cardEl, orders, agg, { isPurchases: true });
            return;
        }

        // Режим 'sellers'
        const donutWrap = cardEl.querySelector('.fpt-fin-donut-container');
        if (donutWrap) donutWrap.remove();

        let sellersContainer = cardEl.querySelector('.fpt-fin-sellers-container');
        if (!sellersContainer) {
            sellersContainer = document.createElement('div');
            sellersContainer.className = 'fpt-fin-sellers-container';
            cardEl.querySelectorAll('.fpt-fin-skeleton, .fpt-fin-skeleton-text, .fpt-fin-skeleton-chart').forEach(s => s.remove());
            cardEl.appendChild(sellersContainer);
        }

        if (!topSellers.length) {
            sellersContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">storefront</span>
                    <div class="fpt-fin-empty-title">Нет продавцов</div>
                    <div class="fpt-fin-empty-desc">За выбранный период нет завершённых покупок.</div>
                </div>`;
            return;
        }

        const topSlices = topSellers.slice(0, 5);
        const allOrders = Array.isArray(orders) ? orders : [];

        const itemsHTML = topSlices.map((s, idx) => {
            const revStr = formatRevenueMulti(s.revenueByCurrency);
            const userLink = s.id
                ? `<a class="fpt-fin-table-link" href="https://funpay.com/users/${esc(s.id)}/" target="_blank" rel="noopener" onclick="event.stopPropagation();">${esc(s.name)}</a>`
                : `<span>${esc(s.name)}</span>`;
            return `
                <div class="fpt-fin-seller-item" data-seller-name="${esc(s.name)}" title="Кликните для деталей заказов">
                    <span class="fpt-fin-seller-rank">#${idx + 1}</span>
                    <div class="fpt-fin-seller-info">
                        <div class="fpt-fin-seller-name">${userLink}</div>
                        <div class="fpt-fin-seller-meta">${s.count} ${pluralPurchases(s.count)}</div>
                    </div>
                    <div class="fpt-fin-seller-spent">${esc(revStr)}</div>
                </div>
            `;
        }).join('');

        sellersContainer.innerHTML = `
            <div class="fpt-fin-top-sellers-list">
                ${itemsHTML}
            </div>
        `;

        sellersContainer.querySelectorAll('.fpt-fin-seller-item').forEach(item => {
            const sellerName = item.dataset.sellerName;
            item.addEventListener('click', (e) => {
                if (e.target.closest('a')) return;
                const currentOrders = state.cachedPurchasesOrders || allOrders;
                const filtered = currentOrders.filter(o => (o.sellerUsername || o.sellerName || o.buyerUsername || '-') === sellerName);
                const sObj = topSellers.find(s => s.name === sellerName);
                const revStr = sObj ? formatRevenueMulti(sObj.revenueByCurrency) : '';
                openDrilldown(`Продавец: ${sellerName}`, `${filtered.length} ${pluralPurchases(filtered.length)} · ${revStr}`, filtered);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ТАБЛИЦА ДЕТАЛИЗАЦИИ ПОКУПОК (COL 12 В PURCHASES)
    // ─────────────────────────────────────────────────────────────────────────────

    function renderPurchasesDetailsContent(contentEl, orders, agg, view) {
        const allOrders = Array.isArray(orders) ? orders : [];

        if (view === 'sellers') {
            const topSellers = (agg && agg.topSellers) ? agg.topSellers : ((agg && agg.topBuyers) ? agg.topBuyers : []);
            if (!topSellers.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о продавцах</div></div>';
                return;
            }
            const rows = topSellers.slice(0, 50).map((s, i) => {
                const revStr = formatRevenueMulti(s.revenueByCurrency);
                const userLink = s.id ? `<a class="fpt-fin-table-link" href="https://funpay.com/users/${esc(s.id)}/" target="_blank" rel="noopener">${esc(s.name)}</a>` : `<span>${esc(s.name)}</span>`;
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td>${userLink}</td>
                    <td style="font-weight:700;">${s.count} шт.</td>
                    <td style="font-weight:600;">${esc(revStr)}</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn-coral" data-seller-idx="${i}">Покупки</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Продавец</th>
                            <th>Покупок</th>
                            <th>Сумма покупок</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-seller-idx]').forEach(btn => {
                const idx = Number(btn.dataset.sellerIdx);
                const sObj = topSellers[idx];
                if (!sObj) return;
                const sName = sObj.name;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedPurchasesOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.sellerUsername || o.sellerName || o.buyerUsername || '-') === sName);
                    const revStr = formatRevenueMulti(sObj.revenueByCurrency);
                    openDrilldown(`Продавец: ${sName}`, `${filtered.length} ${pluralPurchases(filtered.length)} · ${revStr}`, filtered);
                });
            });
            return;
        }

        if (view === 'products') {
            const topProducts = agg && agg.topProducts ? agg.topProducts : [];
            if (!topProducts.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о товарах</div></div>';
                return;
            }
            const rows = topProducts.slice(0, 50).map((p, i) => {
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;" title="${esc(p.name)}">${esc(p.name)}</td>
                    <td style="font-weight:700;">${p.count} раз</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn-coral" data-prod-idx="${i}">Покупки</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Товар / Описание</th>
                            <th>Куплено</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-prod-idx]').forEach(btn => {
                const idx = Number(btn.dataset.prodIdx);
                const pObj = topProducts[idx];
                if (!pObj) return;
                const pName = pObj.name;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedPurchasesOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.description || '-') === pName);
                    openDrilldown(`Товар: ${pName}`, `${filtered.length} ${pluralPurchases(filtered.length)}`, filtered);
                });
            });
            return;
        }

        if (view === 'categories') {
            const topCats = agg && agg.topCategories ? agg.topCategories : [];
            if (!topCats.length) {
                contentEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:24px;"><div class="fpt-fin-empty-title">Нет данных о категориях</div></div>';
                return;
            }
            const rows = topCats.slice(0, 50).map((c, i) => {
                const revByCur = (agg && agg.byCategoryRevenue && agg.byCategoryRevenue[c.name]) || {};
                const revStr = formatRevenueMulti(revByCur);
                return `
                <tr>
                    <td style="width:40px;color:var(--fptm-muted, #9099b8);font-weight:600;">#${i + 1}</td>
                    <td>${esc(c.name)}</td>
                    <td style="font-weight:700;">${c.count} пок.</td>
                    <td style="font-weight:600;">${esc(revStr)}</td>
                    <td style="text-align:right;">
                        <button type="button" class="fpt-fin-table-action-btn-coral" data-cat-idx="${i}">Покупки</button>
                    </td>
                </tr>`;
            }).join('');

            contentEl.innerHTML = `
                <table class="fpt-fin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Категория</th>
                            <th>Покупок</th>
                            <th>Потрачено</th>
                            <th style="text-align:right;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;

            contentEl.querySelectorAll('button[data-cat-idx]').forEach(btn => {
                const idx = Number(btn.dataset.catIdx);
                const cObj = topCats[idx];
                if (!cObj) return;
                const cName = cObj.name;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentOrders = state.cachedPurchasesOrders || allOrders;
                    const filtered = currentOrders.filter(o => (o.subcategoryName || 'Без категории') === cName);
                    const revByCur = (agg && agg.byCategoryRevenue && agg.byCategoryRevenue[cName]) || {};
                    const revStr = formatRevenueMulti(revByCur);
                    openDrilldown(`Категория: ${cName}`, `${filtered.length} ${pluralPurchases(filtered.length)} · ${revStr}`, filtered);
                });
            });
            return;
        }

        // View: 'orders' (По умолчанию)
        if (!allOrders.length) {
            contentEl.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:32px 16px;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;">receipt_long</span>
                    <div class="fpt-fin-empty-title">Нет покупок</div>
                    <div class="fpt-fin-empty-desc">За период ${esc(periodLabel(state.period))} покупок не обнаружено.</div>
                </div>`;
            return;
        }

        const visibleOrders = allOrders.slice(0, state.visiblePurchasesLimit);
        const rows = visibleOrders.map(o => {
            let badgeClass = 'fpt-fin-status-neutral';
            let statusText = 'В обработке';
            if (o.orderStatus === 'closed') {
                badgeClass = 'fpt-fin-status-success';
                statusText = 'Завершён';
            } else if (o.orderStatus === 'paid') {
                badgeClass = 'fpt-fin-status-warning';
                statusText = 'Оплачен';
            } else if (o.orderStatus === 'refunded') {
                badgeClass = 'fpt-fin-status-danger';
                statusText = 'Возврат';
            }

            const sellerName = o.sellerUsername || o.sellerName || o.buyerUsername || '—';
            const sellerId = o.sellerId || o.buyerId || 0;
            const sellerInner = sellerId
                ? `<a class="fpt-fin-table-link" href="https://funpay.com/users/${esc(sellerId)}/" target="_blank" rel="noopener">${esc(sellerName)}</a>`
                : esc(sellerName);

            const orderIdStr = String(o.orderId || '').replace(/^#/, '');
            const orderLink = orderIdStr
                ? `<a class="fpt-fin-table-link" href="https://funpay.com/orders/${esc(orderIdStr)}/" target="_blank" rel="noopener">#${esc(orderIdStr)}</a>`
                : '—';

            return `
            <tr>
                <td>${orderLink}</td>
                <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;" title="${esc(o.description)}">${esc(o.description || '—')}</td>
                <td>${sellerInner}</td>
                <td style="color:var(--fptm-muted,#8a90ab);">${esc(formatDate(o.orderDate))}</td>
                <td style="font-weight:700;">${esc(formatMoney(o.price, o.currency))}</td>
                <td><span class="fpt-fin-status-badge ${badgeClass}">${esc(statusText)}</span></td>
            </tr>`;
        }).join('');

        let moreBtnHTML = '';
        if (allOrders.length > state.visiblePurchasesLimit) {
            const rest = allOrders.length - state.visiblePurchasesLimit;
            moreBtnHTML = `
            <div class="fpt-fin-table-footer">
                <span style="font-size:12px;color:var(--fptm-muted, #9099b8);">Показано ${visibleOrders.length} из ${allOrders.length}</span>
                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinShowMorePurchasesBtn" style="padding:4px 14px;font-size:12px;">Показать ещё ${Math.min(50, rest)}</button>
            </div>`;
        }

        contentEl.innerHTML = `
            <table class="fpt-fin-table">
                <thead>
                    <tr>
                        <th>Заказ</th>
                        <th>Товар / Описание</th>
                        <th>Продавец</th>
                        <th>Дата</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${moreBtnHTML}`;

        const moreBtn = contentEl.querySelector('#fptFinShowMorePurchasesBtn');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                state.visiblePurchasesLimit += 50;
                const currentOrders = state.cachedPurchasesOrders || allOrders;
                const currentAgg = state.cachedPurchasesAgg || agg;
                renderPurchasesDetailsContent(contentEl, currentOrders, currentAgg, 'orders');
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ОСНОВНОЙ РЕНДЕР ПОДВКЛАДКИ PURCHASES
    // ─────────────────────────────────────────────────────────────────────────────

    async function renderPurchasesSubtab(forceReload) {
        if (!state.container) return;
        const purchasesPane = state.container.querySelector('.fpt-fin-tab-pane[data-subtab="purchases"]');
        if (!purchasesPane) return;

        const currentToken = ++state.purchasesRenderToken;

        if (forceReload || state.cachedPurchasesPeriod !== state.period || !state.cachedPurchasesOrders) {
            state.isPurchasesLoading = true;

            if (!state.cachedPurchasesOrders) {
                purchasesPane.querySelectorAll('.fpt-fin-card-value').forEach(v => {
                    v.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
                });
            }

            try {
                if (!root.FPTFinanceData || typeof root.FPTFinanceData.getPurchases !== 'function') {
                    console.warn('[FPTFinanceHub] FPTFinanceData.getPurchases is not available');
                    return;
                }

                const filterOpts = {
                    period: state.period,
                    useMsk: true,
                    sort: 'date-desc'
                };
                if (state.orderStatus && state.orderStatus !== 'all') {
                    filterOpts.statuses = state.orderStatus;
                }
                if (state.currency && state.currency !== 'all') {
                    filterOpts.currency = state.currency;
                }
                if (state.category && state.category !== 'all') {
                    filterOpts.category = state.category;
                }

                const orders = await root.FPTFinanceData.getPurchases(filterOpts);

                if (currentToken !== state.purchasesRenderToken) return;

                const agg = root.FPTFinanceData.aggregatePurchases(orders, {
                    period: state.period,
                    useMsk: true
                });

                state.cachedPurchasesOrders = orders;
                state.cachedPurchasesAgg = agg;
                state.cachedPurchasesPeriod = state.period;
                state.visiblePurchasesLimit = 50;
                updateCategorySelectOptions(orders.map(o => o.subcategoryName || o.category));
            } catch (err) {
                console.error('[FPTFinanceHub] Error loading purchases data:', err);
                if (currentToken !== state.purchasesRenderToken) return;
            } finally {
                state.isPurchasesLoading = false;
            }
        }

        if (currentToken !== state.purchasesRenderToken) return;

        const orders = state.cachedPurchasesOrders || [];
        const agg = state.cachedPurchasesAgg || {
            count: 0, total: 0, byStatus: { closed: 0, paid: 0, refunded: 0 },
            byCurrency: {}, averageCheck: {}, refundedRevenue: {}, closedRevenue: {},
            byDay: {}, byCategory: {}, topSellers: [], topBuyers: [],
            topProducts: [], topCategories: []
        };

        const validOrders = orders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
        const closedOrders = orders.filter(o => o.orderStatus === 'closed');
        const refundedOrders = orders.filter(o => o.orderStatus === 'refunded');

        // 1. KPI Карточки
        const cards = purchasesPane.querySelectorAll('.fpt-fin-col-3 .fpt-fin-card');
        if (cards.length >= 4) {
            // Карточка 0: Расходы на покупки
            const revCard = cards[0];
            revCard.classList.add('fpt-fin-clickable');
            const spentStr = formatRevenueMulti(agg.byCurrency);
            revCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Расходы на покупки</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">shopping_bag</span>
                </div>
                <div class="fpt-fin-card-value">${esc(spentStr)}</div>
                <div class="fpt-fin-card-sub">${agg.byStatus.closed || 0} закрыто · ${agg.byStatus.paid || 0} в ожидании</div>`;
            revCard.title = 'Нажмите для просмотра покупок';
            revCard.onclick = () => openDrilldown('Расходы на покупки', `${periodLabel(state.period)} · ${validOrders.length} покупок · ${spentStr}`, validOrders);

            // Карточка 1: Куплено товаров
            const ordCard = cards[1];
            ordCard.classList.add('fpt-fin-clickable');
            ordCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Куплено товаров</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, var(--fpt-accent, #1b75bb));">inventory_2</span>
                </div>
                <div class="fpt-fin-card-value">${agg.count} шт.</div>
                <div class="fpt-fin-card-sub">Всего покупок: ${agg.total} (учтено: ${agg.count})</div>`;
            ordCard.title = 'Нажмите для просмотра покупок';
            ordCard.onclick = () => openDrilldown('Куплено товаров', `${periodLabel(state.period)} · ${validOrders.length} покупок`, validOrders);

            // Карточка 2: Средний чек покупки
            const avgCard = cards[2];
            avgCard.classList.add('fpt-fin-clickable');
            const avgStr = formatAvgCheckMulti(agg.averageCheck);
            avgCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Средний чек покупки</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt_long</span>
                </div>
                <div class="fpt-fin-card-value">${esc(avgStr)}</div>
                <div class="fpt-fin-card-sub">По ${agg.count} завершённым покупкам</div>`;
            avgCard.title = 'Нажмите для просмотра учтённых покупок';
            avgCard.onclick = () => openDrilldown('Средний чек покупки', `${periodLabel(state.period)} · средний чек: ${avgStr}`, validOrders);

            // Карточка 3: Завершено покупок
            const doneCard = cards[3];
            doneCard.classList.add('fpt-fin-clickable');
            const refCount = agg.byStatus.refunded || 0;
            const refSub = refCount > 0 ? ` · ${refCount} возврат.` : '';
            doneCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Завершено покупок</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">verified</span>
                </div>
                <div class="fpt-fin-card-value">${agg.byStatus.closed || 0} шт.</div>
                <div class="fpt-fin-card-sub">${agg.byStatus.paid || 0} в ожидании${refSub}</div>`;
            doneCard.title = 'Нажмите для просмотра завершённых покупок';
            doneCard.onclick = () => openDrilldown('Завершённые покупки', `${periodLabel(state.period)} · ${closedOrders.length} покупок`, closedOrders);
        }

        // 2. График динамики расходов на покупки
        const dynCard = purchasesPane.querySelector('.fpt-fin-col-8 .fpt-fin-card');
        if (dynCard) {
            const dynHeader = dynCard.querySelector('.fpt-fin-card-header');
            if (dynHeader && !dynHeader.querySelector('.fpt-fin-chart-toggles')) {
                const togglesDiv = document.createElement('div');
                togglesDiv.className = 'fpt-fin-chart-toggles';
                togglesDiv.setAttribute('role', 'group');
                togglesDiv.setAttribute('aria-label', 'Интервал покупок');
                togglesDiv.innerHTML = `
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesStep === 'day' ? 'active' : ''}" data-purchases-step="day">По дням</button>
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesStep === 'week' ? 'active' : ''}" data-purchases-step="week">По неделям</button>
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesStep === 'month' ? 'active' : ''}" data-purchases-step="month">По месяцам</button>
                `;
                dynHeader.appendChild(togglesDiv);
            }

            const stepToggles = dynCard.querySelectorAll('.fpt-fin-chart-toggle[data-purchases-step]');
            stepToggles.forEach(toggle => {
                const step = toggle.dataset.purchasesStep;
                toggle.classList.toggle('active', step === state.purchasesStep);
                if (!toggle.dataset.fptBound) {
                    toggle.dataset.fptBound = '1';
                    toggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        stepToggles.forEach(t => t.classList.remove('active'));
                        toggle.classList.add('active');
                        state.purchasesStep = toggle.dataset.purchasesStep || 'day';
                        const currentOrders = state.cachedPurchasesOrders || [];
                        renderDynamicChart(dynCard, currentOrders, state.purchasesStep, {
                            isPurchases: true,
                            color: '#e57373'
                        });
                    });
                }
            });

            renderDynamicChart(dynCard, orders, state.purchasesStep, {
                isPurchases: true,
                color: '#e57373'
            });
        }

        // 3. Топ продавцов (Col 4)
        const sellersCard = purchasesPane.querySelector('.fpt-fin-col-4 .fpt-fin-card');
        if (sellersCard) {
            renderPurchasesTopSellersCard(sellersCard, orders, agg);
        }

        // 4. Детализация покупок (Col 12)
        const detailsCard = purchasesPane.querySelector('.fpt-fin-col-12 .fpt-fin-card');
        if (detailsCard) {
            const detailsHeader = detailsCard.querySelector('.fpt-fin-card-header');
            if (detailsHeader && !detailsHeader.querySelector('.fpt-fin-chart-toggles')) {
                const togglesDiv = document.createElement('div');
                togglesDiv.className = 'fpt-fin-chart-toggles';
                togglesDiv.setAttribute('role', 'group');
                togglesDiv.setAttribute('aria-label', 'Вид детализации покупок');
                togglesDiv.innerHTML = `
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesView === 'orders' ? 'active' : ''}" data-purchases-view="orders">Покупки</button>
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesView === 'sellers' ? 'active' : ''}" data-purchases-view="sellers">Топ продавцов</button>
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesView === 'products' ? 'active' : ''}" data-purchases-view="products">Топ товаров</button>
                    <button type="button" class="fpt-fin-chart-toggle ${state.purchasesView === 'categories' ? 'active' : ''}" data-purchases-view="categories">Топ категорий</button>
                `;
                const badge = detailsHeader.querySelector('.fpt-fin-empty-badge');
                if (badge) {
                    badge.id = 'fptFinPurchasesCountBadge';
                    detailsHeader.insertBefore(togglesDiv, badge);
                } else {
                    detailsHeader.appendChild(togglesDiv);
                }
            }

            updatePurchasesCountBadge(detailsCard, orders, agg, state.purchasesView);

            const viewToggles = detailsCard.querySelectorAll('.fpt-fin-chart-toggle[data-purchases-view]');
            viewToggles.forEach(toggle => {
                const view = toggle.dataset.purchasesView;
                toggle.classList.toggle('active', view === state.purchasesView);
                if (!toggle.dataset.fptBound) {
                    toggle.dataset.fptBound = '1';
                    toggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        viewToggles.forEach(t => t.classList.remove('active'));
                        toggle.classList.add('active');
                        state.purchasesView = toggle.dataset.purchasesView || 'orders';
                        const detailsContent = detailsCard.querySelector('#fptFinPurchasesDetailsContent') || detailsCard.querySelector('.fpt-fin-table-wrap');
                        if (detailsContent) {
                            const currentOrders = state.cachedPurchasesOrders || [];
                            const currentAgg = state.cachedPurchasesAgg || (root.FPTFinanceData ? root.FPTFinanceData.aggregatePurchases(currentOrders) : null);
                            updatePurchasesCountBadge(detailsCard, currentOrders, currentAgg, state.purchasesView);
                            renderPurchasesDetailsContent(detailsContent, currentOrders, currentAgg, state.purchasesView);
                        }
                    });
                }
            });

            const detailsContent = detailsCard.querySelector('#fptFinPurchasesDetailsContent') || detailsCard.querySelector('.fpt-fin-table-wrap');
            if (detailsContent) {
                detailsContent.id = 'fptFinPurchasesDetailsContent';
                renderPurchasesDetailsContent(detailsContent, orders, agg, state.purchasesView);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // OPERATIONS SUBTAB (T03C)
    // ─────────────────────────────────────────────────────────────────────────────

    function operationTypeLabel(type) {
        return OPERATION_TYPE_LABELS[type] || (type ? String(type) : 'Другое');
    }

    function operationSignedValue(txn) {
        const signed = Number(txn && txn.signed);
        if (Number.isFinite(signed)) return signed;
        const amount = Number(txn && txn.amount);
        return Number.isFinite(amount) ? amount : 0;
    }

    function formatOperationsMap(map) {
        if (!map || typeof map !== 'object') return '0 ₽';
        const parts = Object.entries(map)
            .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 0.005)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, value]) => formatMoney(value, currency));
        return parts.length ? parts.join(' · ') : '0 ₽';
    }

    function formatOperationsNet(inByCur, outByCur) {
        const currencies = new Set([
            ...Object.keys(inByCur || {}),
            ...Object.keys(outByCur || {})
        ]);
        const net = {};
        currencies.forEach(currency => {
            const value = (inByCur && inByCur[currency] || 0) - (outByCur && outByCur[currency] || 0);
            if (Math.abs(value) > 0.005) net[currency] = value;
        });
        return formatOperationsMap(net);
    }

    function operationDateValue(txn) {
        const value = txn && txn.date;
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value || '');
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function operationDateLabel(txn) {
        const timestamp = operationDateValue(txn);
        if (!timestamp) return '—';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '—';
        return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    function operationStatusLabel(status) {
        return ({ complete: 'Завершено', cancel: 'Отменено', waiting: 'Ожидание' })[status]
            || (status ? String(status) : 'Неизвестно');
    }

    function operationPeriodLabel() {
        const key = periodKey(state.period);
        if (key === 'custom') return 'за ' + periodLabel(state.period);
        return ({
            today: 'за сегодня',
            yesterday: 'за вчера',
            '24h': 'за 24 часа',
            '7d': 'за неделю',
            '30d': 'за месяц',
            '90d': 'за 3 месяца',
            '365d': 'за год',
            all: 'за всё время'
        })[key] || '';
    }

    function operationFlowChart(cardEl, agg) {
        if (!cardEl) return;
        const daily = ['today', 'yesterday', '24h', '7d', '30d', 'custom'].includes(periodKey(state.period));
        const buckets = daily ? (agg.byDay || {}) : (agg.byMonth || {});
        const keys = Object.keys(buckets).sort().slice(daily ? -31 : -12);
        const titleEl = cardEl.querySelector('.fpt-fin-card-title');
        if (titleEl) titleEl.textContent = daily ? 'Динамика по дням' : 'Динамика по месяцам';

        const body = cardEl.querySelector('.fpt-fin-operation-chart') || document.createElement('div');
        body.className = 'fpt-fin-operation-chart';
        if (!body.parentElement) {
            const skeleton = cardEl.querySelector('.fpt-fin-skeleton-chart');
            if (skeleton) skeleton.replaceWith(body);
            else cardEl.appendChild(body);
        }
        if (!keys.length) {
            body.innerHTML = '<div class="fpt-fin-empty-state" style="padding:28px 16px;">Нет операций за период.</div>';
            return;
        }

        const opCurs = new Set([
            ...Object.keys(agg.inByCur || {}),
            ...Object.keys(agg.outByCur || {})
        ]);
        const isSingleCurrency = opCurs.size === 1;
        const singleCur = isSingleCurrency ? [...opCurs][0] : null;
        const activeCur = (state.currency && state.currency !== 'all')
            ? state.currency
            : (cardEl.dataset.chosenCur || (isSingleCurrency ? singleCur : null));

        if (!activeCur && opCurs.size > 1) {
            const curButtons = Array.from(opCurs).map(c =>
                `<button type="button" class="fpt-fin-btn fpt-fin-btn-secondary fpt-fin-cur-select-btn" data-cur="${esc(c)}" style="margin:4px;padding:4px 12px;font-size:12px;border-radius:14px;cursor:pointer;">${esc(c)} (${esc(SYMBOLS[c] || c)})</button>`
            ).join('');
            body.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;text-align:center;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;color:var(--fptm-muted, #9099b8);">currency_exchange</span>
                    <div class="fpt-fin-empty-title" style="font-size:14px;font-weight:600;margin-top:8px;">Выберите валюту для отображения денежного графика</div>
                    <div class="fpt-fin-empty-desc" style="font-size:12px;color:var(--fptm-muted, #9099b8);margin-top:4px;max-width:460px;margin-left:auto;margin-right:auto;">
                        В операциях за выбранный период присутствуют разные валюты. Финансовый хаб отображает динамику по каждой валюте без искусственной конвертации.
                    </div>
                    <div class="fpt-fin-chart-cur-actions" style="margin-top:12px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
                        ${curButtons}
                    </div>
                </div>`;
            body.querySelectorAll('.fpt-fin-cur-select-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    cardEl.dataset.chosenCur = btn.dataset.cur;
                    operationFlowChart(cardEl, agg);
                });
            });
            return;
        }

        const sym = SYMBOLS[activeCur] || (activeCur ? ` ${activeCur}` : ' ₽');
        const W = 680, H = 220, PAD = { t: 18, r: 18, b: 38, l: 56 };
        const chartWidth = W - PAD.l - PAD.r;
        const chartHeight = H - PAD.t - PAD.b;
        const incoming = keys.map(key => {
            const b = buckets[key];
            if (activeCur && b.inByCur) return Number(b.inByCur[activeCur]) || 0;
            return Number(b.in) || 0;
        });
        const outgoing = keys.map(key => {
            const b = buckets[key];
            if (activeCur && b.outByCur) return Number(b.outByCur[activeCur]) || 0;
            return Number(b.out) || 0;
        });
        const maxValue = Math.max(1, ...incoming, ...outgoing);
        const slot = chartWidth / keys.length;
        const barWidth = Math.max(3, Math.min(20, slot / 2 - 3));
        const zeroY = PAD.t + chartHeight / 2;
        const halfHeight = chartHeight / 2;
        let bars = '';
        let labels = '';
        const labelStep = Math.max(1, Math.ceil(keys.length / 8));
        keys.forEach((key, index) => {
            const center = PAD.l + slot * index + slot / 2;
            const inHeight = incoming[index] / maxValue * halfHeight;
            const outHeight = outgoing[index] / maxValue * halfHeight;
            const label = daily ? key.slice(5).replace('-', '.') : key.slice(5) + '.' + key.slice(2, 4);
            const tip = `${key}: +${fmtAxis(incoming[index])} ${sym} / −${fmtAxis(outgoing[index])} ${sym}`;
            bars += `<rect class="fpt-fin-op-bar" x="${center - barWidth - 1}" y="${zeroY - inHeight}" width="${barWidth}" height="${inHeight}" rx="2" fill="#22c55e" data-tip="${esc(tip)}"></rect>`;
            bars += `<rect class="fpt-fin-op-bar" x="${center + 1}" y="${zeroY}" width="${barWidth}" height="${outHeight}" rx="2" fill="#ef4444" data-tip="${esc(tip)}"></rect>`;
            if (index % labelStep === 0 || index === keys.length - 1) {
                labels += `<text x="${center}" y="${H - 9}" text-anchor="middle" font-size="9" fill="var(--fptm-muted,#9099b8)">${esc(label)}</text>`;
            }
        });
        body.innerHTML = `<svg class="fpt-fin-operation-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Динамика операций">
            <line x1="${PAD.l}" y1="${zeroY}" x2="${W - PAD.r}" y2="${zeroY}" stroke="var(--fptm-border,rgba(255,255,255,.12))" />
            <text x="${PAD.l - 7}" y="${PAD.t + 4}" text-anchor="end" font-size="9" fill="var(--fptm-muted,#9099b8)">${esc(fmtAxis(maxValue))}</text>
            <text x="${PAD.l - 7}" y="${zeroY + 3}" text-anchor="end" font-size="9" fill="var(--fptm-muted,#9099b8)">0</text>
            <text x="${PAD.l - 7}" y="${H - PAD.b + 2}" text-anchor="end" font-size="9" fill="var(--fptm-muted,#9099b8)">${esc(fmtAxis(maxValue))}</text>
            ${bars}${labels}</svg>
            <div class="fpt-fin-operation-chart-legend"><span class="fpt-fin-operation-in">▮</span> приход <span class="fpt-fin-operation-out">▮</span> расход ${activeCur ? `<span>· валюта: ${esc(activeCur)}</span>` : ''}</div>`;
        body.querySelectorAll('.fpt-fin-op-bar').forEach(bar => {
            bar.addEventListener('mouseenter', event => showTooltip(esc(bar.dataset.tip || ''), event.clientX, event.clientY));
            bar.addEventListener('mousemove', event => showTooltip(esc(bar.dataset.tip || ''), event.clientX, event.clientY));
            bar.addEventListener('mouseleave', hideTooltip);
        });
    }

    function operationModalRow(txn) {
        const value = operationSignedValue(txn);
        const currency = String(txn && txn.currency || 'UNKNOWN').toUpperCase();
        const valueClass = value >= 0 ? 'fpt-fin-operation-in' : 'fpt-fin-operation-out';
        const sign = value >= 0 ? '+' : '−';
        const id = txn && (txn.id || txn.operationId || txn.transactionId) || '—';
        const title = txn && (txn.title || txn.description || operationTypeLabel(txn.type)) || 'Операция';
        return `<div class="fpt-fin-operation-modal-row">
            <div class="fpt-fin-operation-modal-main"><strong>${esc(title)}</strong>
                <span>${esc(operationTypeLabel(txn && txn.type))} · ${esc(operationStatusLabel(txn && txn.status))} · ${esc(operationDateLabel(txn))}</span>
                <small>ID: ${esc(id)}</small></div>
            <b class="${valueClass}">${sign} ${esc(formatMoney(Math.abs(value), currency))}</b>
        </div>`;
    }

    function openOperationsDrilldown(title, list) {
        const operations = Array.isArray(list) ? list.slice() : [];
        const old = document.getElementById('fpt-fin-operations-modal');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'fpt-fin-operations-modal';
        overlay.className = 'fpt-fin-operations-modal';
        overlay.innerHTML = `<div class="fpt-fin-operations-dialog">
            <div class="fpt-fin-operations-dialog-head"><div><strong>${esc(title)}</strong><span>${operations.length} операций</span></div><button type="button" class="fpt-fin-operations-close" aria-label="Закрыть">×</button></div>
            <div class="fpt-fin-operations-tools"><input type="search" placeholder="Поиск по операциям…" autocomplete="off"><select><option value="date-desc">Сначала новые</option><option value="date-asc">Сначала старые</option><option value="amount-desc">Большая сумма</option><option value="amount-asc">Малая сумма</option></select></div>
            <div class="fpt-fin-operations-modal-list"></div></div>`;
        document.body.appendChild(overlay);
        const search = overlay.querySelector('input');
        const sort = overlay.querySelector('select');
        const listEl = overlay.querySelector('.fpt-fin-operations-modal-list');
        const renderList = () => {
            let filtered = operations.slice();
            const query = search.value.trim().toLowerCase();
            if (query) filtered = filtered.filter(txn => {
                const haystack = [txn.title, txn.description, txn.type, txn.currency, txn.id, txn.operationId].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(query);
            });
            if (sort.value === 'date-asc') filtered.sort((a, b) => operationDateValue(a) - operationDateValue(b));
            else if (sort.value === 'amount-desc') filtered.sort((a, b) => Math.abs(operationSignedValue(b)) - Math.abs(operationSignedValue(a)));
            else if (sort.value === 'amount-asc') filtered.sort((a, b) => Math.abs(operationSignedValue(a)) - Math.abs(operationSignedValue(b)));
            else filtered.sort((a, b) => operationDateValue(b) - operationDateValue(a));
            listEl.innerHTML = filtered.length
                ? filtered.map(operationModalRow).join('')
                : '<div class="fpt-fin-empty-state">Ничего не найдено.</div>';
        };
        renderList();
        search.addEventListener('input', renderList);
        sort.addEventListener('change', renderList);
        const close = () => overlay.remove();
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        overlay.querySelector('.fpt-fin-operations-close').addEventListener('click', close);
    }

    function renderOperationsCards(pane, agg) {
        const cards = Array.from(pane.querySelectorAll('.fpt-fin-col-3 .fpt-fin-card')).slice(0, 4);
        const values = [
            { key: 'in', label: 'Поступления', value: formatOperationsMap(agg.inByCur), color: 'fpt-fin-operation-in', list: agg.list.filter(txn => operationSignedValue(txn) >= 0) },
            { key: 'out', label: 'Расходы', value: formatOperationsMap(agg.outByCur), color: 'fpt-fin-operation-out', list: agg.list.filter(txn => operationSignedValue(txn) < 0) },
            { key: 'count', label: 'Операций за период', value: String(agg.count || 0), color: '', list: agg.list },
            { key: 'complete', label: 'Завершено', value: String(agg.byStatus && agg.byStatus.complete || 0), color: '', list: agg.list }
        ];
        cards.forEach((card, index) => {
            const item = values[index];
            if (!item) return;
            card.dataset.finOperationCard = item.key;
            card.classList.add('fpt-fin-operation-card');
            card.innerHTML = `<div class="fpt-fin-card-header"><h5 class="fpt-fin-card-title">${esc(item.label)}</h5><span class="material-symbols-rounded">${item.key === 'in' ? 'arrow_circle_down' : item.key === 'out' ? 'arrow_circle_up' : 'receipt_long'}</span></div>
                <div class="fpt-fin-card-value ${item.color}">${esc(item.value)}</div><div class="fpt-fin-card-sub">${esc(operationPeriodLabel())}</div>`;
            if (!card.dataset.fptOperationsBound) {
                card.dataset.fptOperationsBound = '1';
                card.addEventListener('click', () => {
                    const current = state.cachedOperationsAgg || { list: [] };
                    const currentList = item.key === 'in'
                        ? current.list.filter(txn => operationSignedValue(txn) >= 0)
                        : item.key === 'out'
                            ? current.list.filter(txn => operationSignedValue(txn) < 0)
                            : current.list;
                    openOperationsDrilldown(item.label + ' ' + operationPeriodLabel(), currentList);
                });
            }
        });
    }

    function renderOperationsBreakdown(card, agg) {
        if (!card) return;
        const rows = Object.entries(agg.byType || {}).sort(([, a], [, b]) => b.count - a.count).map(([type, item]) => `<button type="button" class="fpt-fin-operation-type-row" data-fin-operation-type="${esc(type)}"><span><strong>${esc(operationTypeLabel(type))}</strong><small>${item.count} операций</small></span><b>${esc(formatOperationsNet(item.in, item.out))}</b></button>`).join('');
        card.innerHTML = `<div class="fpt-fin-card-header"><h5 class="fpt-fin-card-title">По типам операций</h5><span class="material-symbols-rounded">category</span></div><div class="fpt-fin-operation-types">${rows || '<div class="fpt-fin-empty-state">Нет операций за период.</div>'}</div>`;
        card.querySelectorAll('[data-fin-operation-type]').forEach(row => row.addEventListener('click', () => {
            const type = row.dataset.finOperationType;
            openOperationsDrilldown(operationTypeLabel(type) + ' ' + operationPeriodLabel(), agg.list.filter(txn => txn.type === type));
        }));
    }

    function renderOperationsTable(card, agg) {
        if (!card) return;
        const visible = agg.list.slice(0, 100);
        const rows = visible.map((txn, index) => {
            const value = operationSignedValue(txn);
            const currency = String(txn.currency || 'UNKNOWN').toUpperCase();
            const title = txn.title || txn.description || operationTypeLabel(txn.type);
            const id = txn.id || txn.operationId || txn.transactionId || '—';
            return `<tr class="fpt-fin-operation-row" data-fin-operation-index="${index}"><td>${esc(id)}</td><td>${esc(operationDateLabel(txn))}</td><td>${esc(operationTypeLabel(txn.type))}</td><td>${esc(title)}</td><td class="${value >= 0 ? 'fpt-fin-operation-in' : 'fpt-fin-operation-out'}">${value >= 0 ? '+' : '−'} ${esc(formatMoney(Math.abs(value), currency))}</td><td>${esc(operationStatusLabel(txn.status))}</td></tr>`;
        }).join('');
        const tail = agg.list.length > visible.length ? `<tr><td colspan="6" class="fpt-fin-operation-more">Показаны первые ${visible.length} из ${agg.list.length}. Нажмите на строку или заголовок, чтобы открыть полный список.</td></tr>` : '';
        card.innerHTML = `<div class="fpt-fin-card-header"><h5 class="fpt-fin-card-title">История операций</h5><span class="fpt-fin-empty-badge">${agg.list.length} операций</span></div><div class="fpt-fin-table-wrap"><table class="fpt-fin-table fpt-fin-operation-table"><thead><tr><th>ID</th><th>Дата</th><th>Тип операции</th><th>Описание / Реквизиты</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="fpt-fin-operation-more">Нет операций за период.</td></tr>'}${tail}</tbody></table></div>`;
        card.querySelectorAll('[data-fin-operation-index]').forEach(row => row.addEventListener('click', () => openOperationsDrilldown('Операции ' + operationPeriodLabel(), agg.list)));
        card.querySelector('.fpt-fin-card-header').addEventListener('click', () => openOperationsDrilldown('Операции ' + operationPeriodLabel(), agg.list));
    }

    function renderOperationsSubtabLoading(pane) {
        if (!pane) return;
        pane.querySelectorAll('.fpt-fin-card-value').forEach(value => { value.textContent = 'Загрузка…'; });
    }

    async function renderOperationsSubtab(forceReload) {
        const pane = state.container && state.container.querySelector('.fpt-fin-tab-pane[data-subtab="operations"]');
        if (!pane) return;
        const currentToken = ++state.operationsRenderToken;
        if (forceReload || state.cachedOperationsPeriod !== state.period || !state.cachedOperations) {
            state.isOperationsLoading = true;
            renderOperationsSubtabLoading(pane);
            try {
                if (!root.FPTFinanceData || typeof root.FPTFinanceData.getOperations !== 'function') {
                    throw new Error('FPTFinanceData.getOperations is not available');
                }
                const filterOpts = { period: state.period, sort: 'date-desc', useMsk: true };
                if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                if (state.operationStatus && state.operationStatus !== 'all') filterOpts.statuses = state.operationStatus;
                const operations = await root.FPTFinanceData.getOperations(filterOpts);
                const aggregate = root.FPTFinanceData.aggregateOperations(operations);
                if (currentToken !== state.operationsRenderToken) return;
                state.cachedOperations = Array.isArray(operations) ? operations : [];
                state.cachedOperationsAgg = aggregate || { list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 };
                state.cachedOperationsPeriod = state.period;
            } catch (error) {
                console.error('[FPTFinanceHub] Error loading operations data:', error);
                if (currentToken !== state.operationsRenderToken) return;
                pane.querySelector('.fpt-fin-col-12 .fpt-fin-card').innerHTML = `<div class="fpt-fin-empty-state">Не удалось загрузить операции.</div>`;
                state.isOperationsLoading = false;
                return;
            }
            state.isOperationsLoading = false;
        }
        if (currentToken !== state.operationsRenderToken) return;
        const aggregate = state.cachedOperationsAgg || { list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 };
        renderOperationsCards(pane, aggregate);
        operationFlowChart(pane.querySelector('.fpt-fin-col-8 .fpt-fin-card'), aggregate);
        renderOperationsBreakdown(pane.querySelector('.fpt-fin-col-4 .fpt-fin-card'), aggregate);
        renderOperationsTable(pane.querySelector('.fpt-fin-col-12 .fpt-fin-card'), aggregate);
    }

    function cleanupOperations() {
        hideTooltip();
        state.operationsRenderToken++;
        const modal = document.getElementById('fpt-fin-operations-modal');
        if (modal) modal.remove();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ПОТЕНЦИАЛ (T06C)
    // ─────────────────────────────────────────────────────────────────────────────

    function filterPotentialLots(lots, filter) {
        if (!Array.isArray(lots)) return [];
        if (filter === 'with-cost') {
            return lots.filter(lot => lot.costBasis !== null);
        }
        if (filter === 'without-cost') {
            return lots.filter(lot => lot.costBasis === null);
        }
        if (filter === 'finite-stock') {
            return lots.filter(lot => lot.stockKind === 'finite' && typeof lot.stock === 'number');
        }
        return lots;
    }

    function renderPotentialCards(pane, totals, currency, filteredLots) {
        if (!pane || !totals) return;

        // 1. Потенциал выручки
        const revEl = pane.querySelector('#fptFinPotRevenue');
        if (revEl) {
            revEl.textContent = formatMoney(totals.sellerRevenue, currency);
        }
        const revSubEl = pane.querySelector('#fptFinPotRevenueSub');
        if (revSubEl) {
            const gmvText = totals.buyerGmv !== null ? formatMoney(totals.buyerGmv, currency) : '—';
            revSubEl.textContent = `Покупательский GMV: ${gmvText}`;
        }

        // 2. Потенциал прибыли
        const profEl = pane.querySelector('#fptFinPotProfit');
        if (profEl) {
            profEl.textContent = totals.knownPotentialProfit !== null ? formatMoney(totals.knownPotentialProfit, currency) : '—';
            profEl.className = 'fpt-fin-card-value' + (totals.knownPotentialProfit > 0 ? ' fpt-fin-operation-in' : (totals.knownPotentialProfit < 0 ? ' fpt-fin-operation-out' : ''));
        }
        const profSubEl = pane.querySelector('#fptFinPotProfitSub');
        if (profSubEl) {
            const marginText = totals.knownMargin !== null ? `${totals.knownMargin}%` : '—';
            const roiText = totals.knownRoi !== null ? `${totals.knownRoi}%` : '—';
            profSubEl.textContent = `Маржа: ${marginText} • ROI: ${roiText}`;
        }

        // 3. Стоимость склада
        const costEl = pane.querySelector('#fptFinPotCost');
        if (costEl) {
            costEl.textContent = totals.knownInventoryCost !== null ? formatMoney(totals.knownInventoryCost, currency) : '—';
        }
        const costSubEl = pane.querySelector('#fptFinPotCostSub');
        if (costSubEl) {
            const covText = totals.costCoveragePercent !== null ? `${totals.costCoveragePercent}%` : '—';
            costSubEl.textContent = `Покрытие себестоимости: ${covText}`;
        }

        // 4. Лоты в продаже
        const offersEl = pane.querySelector('#fptFinPotOffers');
        if (offersEl) {
            offersEl.textContent = `${totals.finiteOffers} с остатком`;
        }
        const offersSubEl = pane.querySelector('#fptFinPotOffersSub');
        if (offersSubEl) {
            offersSubEl.textContent = totals.unknownStockOffers > 0
                ? `+ ${totals.unknownStockOffers} без остатка`
                : 'Все остатки известны';
        }

        // Drilldown binding
        const lotsList = Array.isArray(filteredLots) ? filteredLots : (state.cachedPotentialLots || []);
        const revCard = revEl && revEl.closest('.fpt-fin-card');
        if (revCard) {
            revCard.classList.add('fpt-fin-clickable');
            revCard.title = 'Показать лоты инвентаря';
            revCard.onclick = () => openDrilldown('Потенциал выручки (лоты)', `${lotsList.length} предложений · ${formatMoney(totals.sellerRevenue, currency)}`, lotsList);
        }
        const profCard = profEl && profEl.closest('.fpt-fin-card');
        if (profCard) {
            profCard.classList.add('fpt-fin-clickable');
            profCard.title = 'Показать лоты инвентаря';
            const profLabel = totals.knownPotentialProfit !== null ? formatMoney(totals.knownPotentialProfit, currency) : '—';
            profCard.onclick = () => openDrilldown('Потенциал прибыли (лоты)', `${lotsList.length} предложений · ${profLabel}`, lotsList);
        }
        const costCard = costEl && costEl.closest('.fpt-fin-card');
        if (costCard) {
            costCard.classList.add('fpt-fin-clickable');
            costCard.title = 'Показать лоты инвентаря';
            const costLabel = totals.knownInventoryCost !== null ? formatMoney(totals.knownInventoryCost, currency) : '—';
            costCard.onclick = () => openDrilldown('Себестоимость склада (лоты)', `${lotsList.length} предложений · ${costLabel}`, lotsList);
        }
        const offersCard = offersEl && offersEl.closest('.fpt-fin-card');
        if (offersCard) {
            offersCard.classList.add('fpt-fin-clickable');
            offersCard.title = 'Показать лоты инвентаря';
            offersCard.onclick = () => openDrilldown('Предложения в продаже', `${lotsList.length} предложений`, lotsList);
        }
    }

    function renderPotentialTable(pane) {
        if (!pane) return;
        const lots = state.cachedPotentialLots || [];
        const activeLots = (state.category && state.category !== 'all')
            ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
            : lots;
        const filtered = filterPotentialLots(activeLots, state.potentialFilter || 'all');

        const badge = pane.querySelector('#fptFinPotCountBadge');
        if (badge) {
            badge.innerHTML = `<span class="material-symbols-rounded">storefront</span> ${filtered.length} предложений`;
        }

        const tbody = pane.querySelector('#fptFinPotTableBody');
        if (!tbody) return;

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="fpt-fin-empty-state" style="text-align:center;padding:24px;">Лоты не найдены по выбранному фильтру</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(lot => {
            const offerId = lot.offerId || '';
            const titleText = lot.title || ('Лот #' + offerId);
            const linkHref = offerId ? `https://funpay.com/lots/offerEdit?offer=${encodeURIComponent(offerId)}` : '#';
            const activeStatus = lot.active === false
                ? ' <span class="fpt-fin-status-badge" style="background:rgba(229,115,115,0.15);color:#e57373;border:1px solid rgba(229,115,115,0.3);font-size:10px;padding:1px 5px;">Деактивирован</span>'
                : '';

            const titleCell = `<a href="${esc(linkHref)}" target="_blank" class="fpt-fin-lot-link">${esc(titleText)}</a>${activeStatus}`;
            const categoryCell = esc(lot.category || '—');

            let stockCell = '<span class="fpt-fin-muted">—</span>';
            if (lot.stockKind === 'finite' && typeof lot.stock === 'number') {
                stockCell = `${lot.stock} шт.`;
            } else if (lot.stockKind === 'unlimited') {
                stockCell = '<span title="Неограничено">∞</span>';
            } else if (lot.stockKind === 'unknown') {
                stockCell = '<span class="fpt-fin-badge-unknown">Не указан</span>';
            }

            const sellerPriceCell = lot.sellerPrice !== null ? esc(formatMoney(lot.sellerPrice, lot.currency)) : '—';
            const buyerPriceCell = lot.buyerPrice !== null ? esc(formatMoney(lot.buyerPrice, lot.currency)) : '<span class="fpt-fin-muted">—</span>';
            const costBasisCell = lot.costBasis !== null ? esc(formatMoney(lot.costBasis, lot.currency)) : '<span class="fpt-fin-muted">—</span>';
            const revenueCell = lot.sellerRevenue !== null ? esc(formatMoney(lot.sellerRevenue, lot.currency)) : '<span class="fpt-fin-muted">—</span>';

            let profitCell = '<span class="fpt-fin-muted">—</span>';
            if (lot.potentialProfit !== null) {
                const profitColor = lot.potentialProfit > 0 ? '#4caf82' : (lot.potentialProfit < 0 ? '#e57373' : '');
                profitCell = `<span style="${profitColor ? `color:${profitColor};font-weight:600;` : ''}">${esc(formatMoney(lot.potentialProfit, lot.currency))}</span>`;
            }

            const marginCell = lot.margin !== null ? `${esc(lot.margin)}%` : '<span class="fpt-fin-muted">—</span>';

            return `<tr><td>${titleCell}</td><td>${categoryCell}</td><td>${stockCell}</td><td>${sellerPriceCell}</td><td>${buyerPriceCell}</td><td>${costBasisCell}</td><td>${revenueCell}</td><td>${profitCell}</td><td>${marginCell}</td></tr>`;
        }).join('');
    }

    function bindPotentialFilters(pane) {
        if (!pane) return;
        const filterGroup = pane.querySelector('#fptFinPotFilterGroup');
        if (!filterGroup || filterGroup.dataset.fptBound) return;
        filterGroup.dataset.fptBound = '1';

        const chips = filterGroup.querySelectorAll('.fpt-fin-filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.potentialFilter = chip.dataset.filter || 'all';

                const lots = state.cachedPotentialLots || [];
                const activeLots = (state.category && state.category !== 'all')
                    ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                    : lots;
                const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
                const primaryCurrency = (state.currency && state.currency !== 'all') ? state.currency : (state.potentialCurrency || 'RUB');
                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                const totals = potentialEngine ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency) : null;

                renderPotentialCards(pane, totals, primaryCurrency, filteredLots);
                renderPotentialTable(pane);
            });
        });
    }

    function renderPotentialSubtabLoading(pane) {
        if (!pane) return;
        ['#fptFinPotRevenue', '#fptFinPotProfit', '#fptFinPotCost', '#fptFinPotOffers'].forEach(sel => {
            const el = pane.querySelector(sel);
            if (el) el.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
        });
        const tbody = pane.querySelector('#fptFinPotTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr><tr><td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr>';
        }
    }

    async function renderPotentialSubtab(forceReload) {
        const pane = state.container && state.container.querySelector('.fpt-fin-tab-pane[data-subtab="potential"]');
        if (!pane) return;

        const currentToken = ++state.potentialRenderToken;

        if (forceReload || !state.cachedPotentialLots) {
            state.isPotentialLoading = true;
            renderPotentialSubtabLoading(pane);

            try {
                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                if (!potentialEngine || typeof potentialEngine.getInventory !== 'function') {
                    throw new Error('FPTPotential is not available');
                }

                const lots = await potentialEngine.getInventory({ enrichPotential: true, forceRefresh: forceReload });
                const agg = potentialEngine.calculatePotentialAggregates(lots);

                if (currentToken !== state.potentialRenderToken) return;

                state.cachedPotentialLots = Array.isArray(lots) ? lots : [];
                state.cachedPotentialAgg = agg || {};
                state.potentialLastUpdate = Date.now();
                updateLastUpdatedText('potential');
            } catch (err) {
                console.error('[FPTFinanceHub] Error loading inventory potential:', err);
                if (currentToken !== state.potentialRenderToken) return;
                const tbody = pane.querySelector('#fptFinPotTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="9" class="fpt-fin-empty-state" style="text-align:center;padding:24px;">Не удалось загрузить данные инвентаря</td></tr>';
                }
                state.isPotentialLoading = false;
                return;
            }
            state.isPotentialLoading = false;
        }

        if (currentToken !== state.potentialRenderToken) return;

        const lots = state.cachedPotentialLots || [];
        updateCategorySelectOptions(lots.map(l => l.category));

        const activeLots = (state.category && state.category !== 'all')
            ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
            : lots;

        const agg = state.cachedPotentialAgg || {};
        const availableCurrencies = Object.keys(agg);
        const primaryCurrency = (state.currency && state.currency !== 'all')
            ? state.currency
            : ((agg[state.potentialCurrency]) ? state.potentialCurrency : (availableCurrencies[0] || 'RUB'));

        const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
        const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
        const totals = (potentialEngine && typeof potentialEngine.calculateCurrencyTotals === 'function')
            ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency)
            : (agg[primaryCurrency] || {
                currency: primaryCurrency,
                sellerRevenue: 0,
                buyerGmv: 0,
                knownInventoryCost: 0,
                knownPotentialProfit: 0,
                unknownStockOffers: 0,
                finiteOffers: 0,
                costCoveragePercent: 0,
                knownMargin: null,
                knownRoi: null
            });

        renderPotentialCards(pane, totals, primaryCurrency, filteredLots);
        renderPotentialTable(pane);
        bindPotentialFilters(pane);
        await updateLastUpdatedText('potential');
    }

    function cleanupPotential() {
        hideTooltip();
        state.potentialRenderToken++;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ПРИБЫЛЬ (T07C)
    // ─────────────────────────────────────────────────────────────────────────────

    function filterProfitOrders(orders, filter) {
        if (!Array.isArray(orders)) return [];
        if (filter === 'with-cost') {
            return orders.filter(o => o.profitInfo && o.profitInfo.hasCost);
        }
        if (filter === 'without-cost') {
            return orders.filter(o => o.profitInfo && !o.profitInfo.hasCost && !o.profitInfo.isRefunded);
        }
        if (filter === 'refunded') {
            return orders.filter(o => o.profitInfo && o.profitInfo.isRefunded);
        }
        return orders;
    }

    function renderProfitCards(pane, totals, currency, byCurrency, filteredOrders) {
        if (!pane || !totals) return;

        // 1. Реализованная чистая прибыль
        const netEl = pane.querySelector('#fptFinProfitNet');
        if (netEl) {
            if (totals.realisedNetProfit !== null && typeof totals.realisedNetProfit === 'number') {
                netEl.textContent = formatMoney(totals.realisedNetProfit, currency);
                netEl.className = 'fpt-fin-card-value' + (totals.realisedNetProfit > 0 ? ' fpt-fin-operation-in' : (totals.realisedNetProfit < 0 ? ' fpt-fin-operation-out' : ''));
            } else {
                netEl.textContent = '—';
                netEl.className = 'fpt-fin-card-value';
            }
        }
        const netSubEl = pane.querySelector('#fptFinProfitNetSub');
        if (netSubEl) {
            const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
            const prevNet = (state.cachedPrevProfitData && state.cachedPrevProfitData.byCurrency && state.cachedPrevProfitData.byCurrency[currency])
                ? state.cachedPrevProfitData.byCurrency[currency].realisedNetProfit
                : null;
            const profitDiff = (finData && typeof finData.formatKpiComparison === 'function')
                ? finData.formatKpiComparison(totals.realisedNetProfit, prevNet, { kpi: 'profit', id: 'fptFinProfitNetDiff' })
                : null;
            const diffHtml = profitDiff ? profitDiff.badgeHtml : '';
            netSubEl.innerHTML = `${diffHtml}${diffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Выручка с себестоимостью: ${esc(formatMoney(totals.knownCostRevenue, currency))}</span>`;
        }

        // 2. Себестоимость продаж
        const costEl = pane.querySelector('#fptFinProfitCost');
        if (costEl) {
            costEl.textContent = (totals.realisedCost !== null && typeof totals.realisedCost === 'number')
                ? formatMoney(totals.realisedCost, currency)
                : '—';
        }
        const costSubEl = pane.querySelector('#fptFinProfitCostSub');
        if (costSubEl) {
            costSubEl.textContent = `Покрытие: ${totals.revenueCoverage}% по выручке`;
        }

        // 3. Маржинальность
        const marginEl = pane.querySelector('#fptFinProfitMargin');
        if (marginEl) {
            marginEl.textContent = totals.margin !== null ? `${totals.margin}%` : '—';
            marginEl.className = 'fpt-fin-card-value' + (totals.margin > 0 ? ' fpt-fin-operation-in' : (totals.margin < 0 ? ' fpt-fin-operation-out' : ''));
        }
        const marginSubEl = pane.querySelector('#fptFinProfitMarginSub');
        if (marginSubEl) {
            marginSubEl.textContent = 'На базе известных затрат';
        }

        // 4. ROI инвестиций
        const roiEl = pane.querySelector('#fptFinProfitRoi');
        if (roiEl) {
            roiEl.textContent = totals.roi !== null ? `${totals.roi}%` : '—';
            roiEl.className = 'fpt-fin-card-value' + (totals.roi > 0 ? ' fpt-fin-operation-in' : (totals.roi < 0 ? ' fpt-fin-operation-out' : ''));
        }
        const roiSubEl = pane.querySelector('#fptFinProfitRoiSub');
        if (roiSubEl) {
            roiSubEl.textContent = 'Окупаемость вложений';
        }

        // Drilldown binding
        const ords = Array.isArray(filteredOrders) ? filteredOrders : (state.cachedProfitOrders || []);
        const netCard = netEl && typeof netEl.closest === 'function' && netEl.closest('.fpt-fin-card');
        if (netCard) {
            netCard.classList.add('fpt-fin-clickable');
            netCard.title = 'Показать заказы за этой цифрой';
            const netLabel = (totals.realisedNetProfit !== null && typeof totals.realisedNetProfit === 'number')
                ? formatMoney(totals.realisedNetProfit, currency)
                : '—';
            netCard.onclick = () => openDrilldown('Реализованная чистая прибыль', `${periodLabel(state.period)} · ${ords.length} заказов · ${netLabel}`, ords);
        }
        const costCard = costEl && typeof costEl.closest === 'function' && costEl.closest('.fpt-fin-card');
        if (costCard) {
            costCard.classList.add('fpt-fin-clickable');
            costCard.title = 'Показать заказы за этой цифрой';
            const costLabel = (totals.realisedCost !== null && typeof totals.realisedCost === 'number')
                ? formatMoney(totals.realisedCost, currency)
                : '—';
            costCard.onclick = () => openDrilldown('Себестоимость продаж', `${periodLabel(state.period)} · ${ords.length} заказов · ${costLabel}`, ords);
        }
        const marginCard = marginEl && typeof marginEl.closest === 'function' && marginEl.closest('.fpt-fin-card');
        if (marginCard) {
            marginCard.classList.add('fpt-fin-clickable');
            marginCard.title = 'Показать заказы за этой цифрой';
            marginCard.onclick = () => openDrilldown('Маржинальность продаж', `${periodLabel(state.period)} · ${ords.length} заказов`, ords);
        }
        const roiCard = roiEl && typeof roiEl.closest === 'function' && roiEl.closest('.fpt-fin-card');
        if (roiCard) {
            roiCard.classList.add('fpt-fin-clickable');
            roiCard.title = 'Показать заказы за этой цифрой';
            roiCard.onclick = () => openDrilldown('ROI инвестиций', `${periodLabel(state.period)} · ${ords.length} заказов`, ords);
        }

        // Переключатель валют (если в данных несколько валют)
        const chipsContainer = pane.querySelector('#fptFinProfitCurrencyChips');
        if (chipsContainer && byCurrency) {
            const curKeys = Object.keys(byCurrency);
            if (curKeys.length > 1) {
                chipsContainer.innerHTML = curKeys.map(c => {
                    const cAgg = byCurrency[c];
                    const activeCls = c === currency ? ' active' : '';
                    return `<button type="button" class="fpt-fin-currency-chip${activeCls}" data-cur="${esc(c)}">${esc(c)}: ${esc(formatMoney(cAgg.realisedNetProfit, c))}</button>`;
                }).join('');
                chipsContainer.querySelectorAll('.fpt-fin-currency-chip').forEach(btn => {
                    btn.addEventListener('click', () => {
                        state.profitCurrency = btn.dataset.cur;
                        renderProfitCards(pane, byCurrency[state.profitCurrency] || totals, state.profitCurrency, byCurrency, filteredOrders);
                        renderProfitCoverage(pane, byCurrency[state.profitCurrency] || totals, state.profitCurrency);
                        renderProfitChart(pane, byCurrency[state.profitCurrency] || totals, filteredOrders, state.profitCurrency);
                        renderProfitTable(pane);
                    });
                });
            } else {
                chipsContainer.innerHTML = '';
            }
        }
    }

    function renderProfitCoverage(pane, totals, currency) {
        if (!pane || !totals) return;
        const card = pane.querySelector('#fptFinProfitCoverageCard');
        if (!card) return;

        card.innerHTML = `
            <div class="fpt-fin-coverage-wrap">
                <div class="fpt-fin-coverage-row">
                    <div class="fpt-fin-coverage-label-wrap">
                        <span class="fpt-fin-coverage-label">По заказам</span>
                        <span class="fpt-fin-coverage-val">${totals.orderCoverage}% (${totals.knownCostOrdersCount} из ${totals.eligibleOrdersCount})</span>
                    </div>
                    <div class="fpt-fin-coverage-bar">
                        <div class="fpt-fin-coverage-bar-fill" style="width: ${Math.min(100, Math.max(0, totals.orderCoverage))}%;"></div>
                    </div>
                </div>
                <div class="fpt-fin-coverage-row">
                    <div class="fpt-fin-coverage-label-wrap">
                        <span class="fpt-fin-coverage-label">По выручке</span>
                        <span class="fpt-fin-coverage-val">${totals.revenueCoverage}% (${formatMoney(totals.knownCostRevenue, currency)} из ${formatMoney(totals.eligibleRevenue, currency)})</span>
                    </div>
                    <div class="fpt-fin-coverage-bar">
                        <div class="fpt-fin-coverage-bar-fill" style="width: ${Math.min(100, Math.max(0, totals.revenueCoverage))}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderProfitChart(pane, totals, orders, currency) {
        if (!pane || !totals) return;
        const chartEl = pane.querySelector('#fptFinProfitChart');
        if (!chartEl) return;

        const costStr = (totals.realisedCost !== null && typeof totals.realisedCost === 'number')
            ? formatMoney(totals.realisedCost, currency)
            : '—';

        const profitStr = (totals.realisedNetProfit !== null && typeof totals.realisedNetProfit === 'number')
            ? `${totals.realisedNetProfit > 0 ? '+' : ''}${formatMoney(totals.realisedNetProfit, currency)}`
            : '—';

        const profitColor = (totals.realisedNetProfit !== null && typeof totals.realisedNetProfit === 'number')
            ? (totals.realisedNetProfit > 0 ? '#4caf82' : (totals.realisedNetProfit < 0 ? '#e57373' : '#fff'))
            : '#fff';

        chartEl.innerHTML = `
            <div style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color:var(--fptm-muted, #9099b8);">Выручка закрытых заказов</span>
                    <span style="font-weight: 600; color: #fff;">${formatMoney(totals.eligibleRevenue, currency)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color:var(--fptm-muted, #9099b8);">Выручка с известной себестоимостью</span>
                    <span style="font-weight: 600; color: var(--fptm-accent, #1b75bb);">${formatMoney(totals.knownCostRevenue, currency)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color:var(--fptm-muted, #9099b8);">Себестоимость проданного</span>
                    <span style="font-weight: 600; color: #e57373;">${costStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                    <span style="font-weight: 600; color: #fff;">Реализованная чистая прибыль</span>
                    <span style="font-weight: 700; color: ${profitColor};">${profitStr}</span>
                </div>
            </div>
        `;
    }

    function renderProfitTable(pane) {
        if (!pane) return;
        const tbody = pane.querySelector('#fptFinProfitTableBody');
        const badge = pane.querySelector('#fptFinProfitCountBadge');
        if (!tbody) return;

        const allOrders = state.cachedProfitOrders || [];
        const filtered = filterProfitOrders(allOrders, state.profitFilter || 'all');

        if (badge) {
            badge.innerHTML = `<span class="material-symbols-rounded">receipt_long</span> ${filtered.length} заказов`;
        }

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="fpt-fin-empty-state" style="text-align:center;padding:24px;">Нет заказов по выбранному фильтру</td></tr>';
            return;
        }

        const rows = filtered.map(o => {
            const info = o.profitInfo || {};
            const orderId = esc(o.orderId || '—');
            const dateStr = esc(formatDate(o.orderDate || o.date));
            const cur = info.currency || 'RUB';

            const revenueCell = esc(formatMoney(info.sellerRevenue, cur));

            let costCell = '<span class="fpt-fin-badge-unknown">Без себестоимости</span>';
            if (info.hasCost) {
                costCell = esc(formatMoney(info.costBasis, info.costBasisCurrency || cur));
            } else if (info.hasCurrencyMismatch) {
                costCell = '<span class="fpt-fin-badge-unknown" title="Несовпадение валют">Валюта не совпадает</span>';
            }

            let profitCell = '<span class="fpt-fin-muted">—</span>';
            if (info.netProfit !== null) {
                const isPos = info.netProfit > 0;
                const isNeg = info.netProfit < 0;
                const cls = isPos ? 'fpt-fin-badge-profit-pos' : (isNeg ? 'fpt-fin-badge-profit-neg' : '');
                profitCell = `<span class="${cls}">${isPos ? '+' : ''}${esc(formatMoney(info.netProfit, cur))}</span>`;
            }

            let marginCell = '<span class="fpt-fin-muted">—</span>';
            if (info.margin !== null) {
                const isPos = info.margin > 0;
                const isNeg = info.margin < 0;
                const cls = isPos ? 'fpt-fin-badge-profit-pos' : (isNeg ? 'fpt-fin-badge-profit-neg' : '');
                marginCell = `<span class="${cls}">${esc(info.margin)}%</span>`;
            }

            let roiCell = '<span class="fpt-fin-muted">—</span>';
            if (info.roi !== null) {
                const isPos = info.roi > 0;
                const isNeg = info.roi < 0;
                const cls = isPos ? 'fpt-fin-badge-profit-pos' : (isNeg ? 'fpt-fin-badge-profit-neg' : '');
                roiCell = `<span class="${cls}">${esc(info.roi)}%</span>`;
            }

            let statusCell = esc(o.status || o.orderStatus || '—');
            if (info.isRefunded) {
                statusCell = '<span class="fpt-fin-badge-refunded">Возврат</span>';
            } else if (info.isClosed) {
                statusCell = '<span style="color:#4caf82;font-size:11px;">Закрыт</span>';
            }

            return `
                <tr>
                    <td><strong>${orderId}</strong></td>
                    <td style="font-size:11.5px;color:var(--fptm-muted,#9099b8);">${dateStr}</td>
                    <td>${revenueCell}</td>
                    <td>${costCell}</td>
                    <td>${profitCell}</td>
                    <td>${marginCell}</td>
                    <td>${roiCell}</td>
                    <td>${statusCell}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
    }

    function bindProfitFilters(pane) {
        if (!pane) return;
        const group = pane.querySelector('#fptFinProfitFilterGroup');
        if (!group || group.dataset.fptBound) return;
        group.dataset.fptBound = '1';

        const chips = group.querySelectorAll('.fpt-fin-filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.profitFilter = chip.dataset.filter || 'all';

                const allOrders = state.cachedProfitOrders || [];
                const filteredOrders = filterProfitOrders(allOrders, state.profitFilter || 'all');
                const primaryCurrency = (state.currency && state.currency !== 'all') ? state.currency : (state.profitCurrency || 'RUB');
                const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
                const aggResult = profitEngine ? profitEngine.calculateProfitAggregates(filteredOrders, { currency: primaryCurrency }) : null;
                const totals = aggResult ? aggResult.totals : null;

                renderProfitCards(pane, totals, primaryCurrency, aggResult ? aggResult.byCurrency : null, filteredOrders);
                renderProfitCoverage(pane, totals, primaryCurrency);
                renderProfitChart(pane, totals, filteredOrders, primaryCurrency);
                renderProfitTable(pane);
            });
        });
    }

    function renderProfitSubtabLoading(pane) {
        if (!pane) return;
        ['#fptFinProfitNet', '#fptFinProfitCost', '#fptFinProfitMargin', '#fptFinProfitRoi'].forEach(sel => {
            const el = pane.querySelector(sel);
            if (el) el.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
        });
        const tbody = pane.querySelector('#fptFinProfitTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr><tr><td colspan="8"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr>';
        }
    }

    async function renderProfitSubtab(forceReload) {
        const pane = state.container && state.container.querySelector('.fpt-fin-tab-pane[data-subtab="profit"]');
        if (!pane) return;

        const currentToken = ++state.profitRenderToken;

        if (forceReload || state.cachedProfitPeriod !== state.period || !state.cachedProfitOrders) {
            state.isProfitLoading = true;
            renderProfitSubtabLoading(pane);

            try {
                const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
                if (!profitEngine || typeof profitEngine.getRealisedProfit !== 'function') {
                    throw new Error('FPTProfitEngine is not available');
                }

                const profitOpts = {
                    period: state.period,
                    useMsk: true
                };
                if (state.currency && state.currency !== 'all') {
                    profitOpts.currency = state.currency;
                }
                if (state.category && state.category !== 'all') {
                    profitOpts.category = state.category;
                }
                if (state.orderStatus && state.orderStatus !== 'all') {
                    profitOpts.statuses = state.orderStatus;
                }

                const result = await profitEngine.getRealisedProfit(profitOpts);

                let prevProfitData = null;
                const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
                const prevPeriod = (finData && typeof finData.resolvePreviousPeriodRange === 'function')
                    ? finData.resolvePreviousPeriodRange(state.period, { useMsk: true })
                    : null;
                if (prevPeriod) {
                    try {
                        prevProfitData = await profitEngine.getRealisedProfit(Object.assign({}, profitOpts, { period: prevPeriod }));
                    } catch (_) {}
                }

                if (currentToken !== state.profitRenderToken) return;

                state.cachedProfitOrders = Array.isArray(result.orders) ? result.orders : [];
                state.cachedProfitAgg = result.byCurrency || {};
                state.cachedPrevProfitData = prevProfitData;
                state.cachedProfitPeriod = state.period;
                await updateLastUpdatedText('profit');
            } catch (err) {
                console.error('[FPTFinanceHub] Error loading realised profit:', err);
                if (currentToken !== state.profitRenderToken) return;
                const tbody = pane.querySelector('#fptFinProfitTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="8" class="fpt-fin-empty-state" style="text-align:center;padding:24px;">Не удалось загрузить данные о прибыли</td></tr>';
                }
                state.isProfitLoading = false;
                return;
            }
            state.isProfitLoading = false;
        }

        if (currentToken !== state.profitRenderToken) return;

        const allOrders = state.cachedProfitOrders || [];
        updateCategorySelectOptions(allOrders.map(o => o.subcategoryName || o.category));

        const agg = state.cachedProfitAgg || {};
        const availableCurrencies = Object.keys(agg);
        const primaryCurrency = (state.currency && state.currency !== 'all')
            ? state.currency
            : ((agg[state.profitCurrency]) ? state.profitCurrency : (availableCurrencies[0] || 'RUB'));

        const filteredOrders = filterProfitOrders(allOrders, state.profitFilter || 'all');
        const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
        const aggResult = (profitEngine && typeof profitEngine.calculateProfitAggregates === 'function')
            ? profitEngine.calculateProfitAggregates(filteredOrders, { currency: primaryCurrency })
            : null;

        const totals = aggResult ? aggResult.totals : (agg[primaryCurrency] || {
            currency: primaryCurrency,
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
        });

        renderProfitCards(pane, totals, primaryCurrency, aggResult ? aggResult.byCurrency : agg, filteredOrders);
        renderProfitCoverage(pane, totals, primaryCurrency);
        renderProfitChart(pane, totals, filteredOrders, primaryCurrency);
        renderProfitTable(pane);
        bindProfitFilters(pane);
        await updateLastUpdatedText('profit');
    }

    function cleanupProfit() {
        hideTooltip();
        state.profitRenderToken++;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ПОДВКЛАДКА: ОБЗОР (T08)
    // ─────────────────────────────────────────────────────────────────────────────

    function renderOverviewSubtabLoading(pane) {
        if (!pane) return;
        const valueSelectors = [
            '#fptFinOverviewRevenue', '#fptFinOverviewRevenueSub',
            '#fptFinOverviewProfit', '#fptFinOverviewProfitSub',
            '#fptFinOverviewOrders', '#fptFinOverviewOrdersSub',
            '#fptFinOverviewAvgCheck', '#fptFinOverviewAvgCheckSub',
            '#fptFinOverviewPotRevenue', '#fptFinOverviewPotRevenueSub',
            '#fptFinOverviewPotProfit', '#fptFinOverviewPotProfitSub',
            '#fptFinOverviewPotCost', '#fptFinOverviewPotCostSub',
            '#fptFinOverviewPotOffers', '#fptFinOverviewPotOffersSub'
        ];
        valueSelectors.forEach(sel => {
            const el = pane.querySelector(sel);
            if (el) {
                el.innerHTML = sel.endsWith('Sub')
                    ? '<div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>'
                    : '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
            }
        });
        const chart = pane.querySelector('#fptFinOverviewChart');
        if (chart) chart.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>';
        const cats = pane.querySelector('#fptFinOverviewCategoriesChart');
        if (cats) cats.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>';
        const topP = pane.querySelector('#fptFinOverviewTopProducts');
        if (topP) topP.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>';
        const topC = pane.querySelector('#fptFinOverviewTopCategories');
        if (topC) topC.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>';
        const ops = pane.querySelector('#fptFinOverviewOperations');
        if (ops) ops.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:36px;"></div><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:36px;"></div>';
    }

    function renderOverviewRow1(pane, salesAgg, profitData, primaryCurrency, salesOrders, profitOrders, kpiDiffs) {
        if (!pane) return;

        const diffs = kpiDiffs || (state.cachedOverviewData && state.cachedOverviewData.kpiDiffs) || null;

        // 1. Выручка
        const revEl = pane.querySelector('#fptFinOverviewRevenue');
        if (revEl) {
            revEl.textContent = salesAgg ? formatRevenueMulti(salesAgg.byCurrency) : '—';
        }
        const revSubEl = pane.querySelector('#fptFinOverviewRevenueSub');
        if (revSubEl) {
            const diffHtml = (diffs && diffs.revenue) ? diffs.revenue.badgeHtml : '';
            if (salesAgg && salesAgg.closedRevenue) {
                const closedStr = formatRevenueMulti(salesAgg.closedRevenue);
                revSubEl.innerHTML = `${diffHtml}${diffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Завершено: ${esc(closedStr)}</span>`;
            } else if (diffHtml) {
                revSubEl.innerHTML = diffHtml;
            } else {
                revSubEl.textContent = '—';
            }
        }

        // 2. Реализованная чистая прибыль + покрытие
        const profitEl = pane.querySelector('#fptFinOverviewProfit');
        const profitSubEl = pane.querySelector('#fptFinOverviewProfitSub');
        const profitTotals = (profitData && profitData.byCurrency)
            ? (profitData.byCurrency[primaryCurrency] || Object.values(profitData.byCurrency)[0])
            : null;

        if (profitEl) {
            if (profitTotals && typeof profitTotals.realisedNetProfit === 'number') {
                profitEl.textContent = formatMoney(profitTotals.realisedNetProfit, profitTotals.currency || primaryCurrency);
                profitEl.className = 'fpt-fin-card-value' + (profitTotals.realisedNetProfit > 0 ? ' fpt-fin-operation-in' : (profitTotals.realisedNetProfit < 0 ? ' fpt-fin-operation-out' : ''));
            } else {
                profitEl.textContent = '—';
                profitEl.className = 'fpt-fin-card-value';
            }
        }
        if (profitSubEl) {
            const diffHtml = (diffs && diffs.profit) ? diffs.profit.badgeHtml : '';
            if (profitTotals) {
                const orderCov = typeof profitTotals.orderCoverage === 'number' ? `${profitTotals.orderCoverage}%` : '—';
                const revCov = typeof profitTotals.revenueCoverage === 'number' ? `${profitTotals.revenueCoverage}%` : '—';
                profitSubEl.innerHTML = `${diffHtml}${diffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Покрытие: ${esc(orderCov)} зак. (${esc(revCov)} выр.)</span>`;
            } else if (diffHtml) {
                profitSubEl.innerHTML = diffHtml;
            } else {
                profitSubEl.textContent = '—';
            }
        }

        // 3. Заказы
        const ordersEl = pane.querySelector('#fptFinOverviewOrders');
        if (ordersEl) {
            ordersEl.textContent = salesAgg ? `${salesAgg.count} зак.` : '—';
        }
        const ordersSubEl = pane.querySelector('#fptFinOverviewOrdersSub');
        if (ordersSubEl) {
            const diffHtml = (diffs && diffs.orders) ? diffs.orders.badgeHtml : '';
            if (salesAgg) {
                const refCount = (salesAgg.byStatus && salesAgg.byStatus.refunded) || 0;
                ordersSubEl.innerHTML = `${diffHtml}${diffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Всего: ${salesAgg.total || 0} (возвратов: ${refCount})</span>`;
            } else if (diffHtml) {
                ordersSubEl.innerHTML = diffHtml;
            } else {
                ordersSubEl.textContent = '—';
            }
        }

        // 4. Средний чек
        const avgEl = pane.querySelector('#fptFinOverviewAvgCheck');
        if (avgEl) {
            avgEl.textContent = salesAgg ? formatAvgCheckMulti(salesAgg.averageCheck) : '—';
        }
        const avgSubEl = pane.querySelector('#fptFinOverviewAvgCheckSub');
        if (avgSubEl) {
            const diffHtml = (diffs && diffs.averageCheck) ? diffs.averageCheck.badgeHtml : '';
            if (salesAgg) {
                avgSubEl.innerHTML = `${diffHtml}${diffHtml ? ' ' : ''}<span class="fpt-fin-sub-extra">Средний чек покупателя</span>`;
            } else if (diffHtml) {
                avgSubEl.innerHTML = diffHtml;
            } else {
                avgSubEl.textContent = '—';
            }
        }

        // Drilldown wire
        const salesList = Array.isArray(salesOrders) ? salesOrders : [];
        const validSales = salesList.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
        const profitList = Array.isArray(profitOrders) ? profitOrders : [];

        const revCard = revEl && typeof revEl.closest === 'function' && revEl.closest('.fpt-fin-card');
        if (revCard) {
            revCard.classList.add('fpt-fin-clickable');
            revCard.title = 'Показать заказы за этой цифрой';
            revCard.onclick = () => openDrilldown('Выручка от продаж', `${periodLabel(state.period)} · ${validSales.length} заказов`, validSales);
        }
        const profitCard = profitEl && typeof profitEl.closest === 'function' && profitEl.closest('.fpt-fin-card');
        if (profitCard) {
            profitCard.classList.add('fpt-fin-clickable');
            profitCard.title = 'Показать заказы за этой цифрой';
            profitCard.onclick = () => openDrilldown('Реализованная чистая прибыль', `${periodLabel(state.period)} · ${profitList.length} заказов`, profitList);
        }
        const ordersCard = ordersEl && typeof ordersEl.closest === 'function' && ordersEl.closest('.fpt-fin-card');
        if (ordersCard) {
            ordersCard.classList.add('fpt-fin-clickable');
            ordersCard.title = 'Показать заказы за этой цифрой';
            ordersCard.onclick = () => openDrilldown('Оплаченные заказы', `${periodLabel(state.period)} · ${validSales.length} заказов`, validSales);
        }
        const avgCard = avgEl && typeof avgEl.closest === 'function' && avgEl.closest('.fpt-fin-card');
        if (avgCard) {
            avgCard.classList.add('fpt-fin-clickable');
            avgCard.title = 'Показать заказы за этой цифрой';
            avgCard.onclick = () => openDrilldown('Средний чек продажи', `${periodLabel(state.period)} · ${validSales.length} заказов`, validSales);
        }
    }

    function renderOverviewRow2(pane, potTotals, potCurrency, lotsList) {
        if (!pane) return;

        // 1. Потенциал выручки
        const revEl = pane.querySelector('#fptFinOverviewPotRevenue');
        if (revEl) {
            revEl.textContent = (potTotals && typeof potTotals.sellerRevenue === 'number')
                ? formatMoney(potTotals.sellerRevenue, potCurrency)
                : '—';
        }
        const revSubEl = pane.querySelector('#fptFinOverviewPotRevenueSub');
        if (revSubEl) {
            if (potTotals && typeof potTotals.buyerGmv === 'number') {
                revSubEl.textContent = `Покупательский GMV: ${formatMoney(potTotals.buyerGmv, potCurrency)}`;
            } else {
                revSubEl.textContent = '—';
            }
        }

        // 2. Потенциал прибыли
        const profEl = pane.querySelector('#fptFinOverviewPotProfit');
        if (profEl) {
            if (potTotals && potTotals.knownPotentialProfit !== null && typeof potTotals.knownPotentialProfit === 'number') {
                profEl.textContent = formatMoney(potTotals.knownPotentialProfit, potCurrency);
                profEl.className = 'fpt-fin-card-value' + (potTotals.knownPotentialProfit > 0 ? ' fpt-fin-operation-in' : (potTotals.knownPotentialProfit < 0 ? ' fpt-fin-operation-out' : ''));
            } else {
                profEl.textContent = '—';
                profEl.className = 'fpt-fin-card-value';
            }
        }
        const profSubEl = pane.querySelector('#fptFinOverviewPotProfitSub');
        if (profSubEl) {
            if (potTotals) {
                const marginText = potTotals.knownMargin !== null ? `${potTotals.knownMargin}%` : '—';
                const roiText = potTotals.knownRoi !== null ? `${potTotals.knownRoi}%` : '—';
                profSubEl.textContent = `Маржа: ${marginText} • ROI: ${roiText}`;
            } else {
                profSubEl.textContent = '—';
            }
        }

        // 3. Стоимость склада
        const costEl = pane.querySelector('#fptFinOverviewPotCost');
        if (costEl) {
            costEl.textContent = (potTotals && potTotals.knownInventoryCost !== null && typeof potTotals.knownInventoryCost === 'number')
                ? formatMoney(potTotals.knownInventoryCost, potCurrency)
                : '—';
        }
        const costSubEl = pane.querySelector('#fptFinOverviewPotCostSub');
        if (costSubEl) {
            if (potTotals) {
                const covText = potTotals.costCoveragePercent !== null ? `${potTotals.costCoveragePercent}%` : '—';
                costSubEl.textContent = `Покрытие себестоимости: ${covText}`;
            } else {
                costSubEl.textContent = '—';
            }
        }

        // 4. Активные лоты
        const offersEl = pane.querySelector('#fptFinOverviewPotOffers');
        if (offersEl) {
            offersEl.textContent = (potTotals && typeof potTotals.finiteOffers === 'number')
                ? `${potTotals.finiteOffers} с остатком`
                : '—';
        }
        const offersSubEl = pane.querySelector('#fptFinOverviewPotOffersSub');
        if (offersSubEl) {
            if (potTotals) {
                offersSubEl.innerHTML = potTotals.unknownStockOffers > 0
                    ? `<span class="fpt-fin-mini-badge">+ ${potTotals.unknownStockOffers} без остатка</span>`
                    : '<span class="fpt-fin-mini-badge">Все остатки известны</span>';
            } else {
                offersSubEl.innerHTML = '<span class="fpt-fin-mini-badge">—</span>';
            }
        }

        // Drilldown wire
        const lots = Array.isArray(lotsList) ? lotsList : [];
        const revCard = revEl && typeof revEl.closest === 'function' && revEl.closest('.fpt-fin-card');
        if (revCard) {
            revCard.classList.add('fpt-fin-clickable');
            revCard.title = 'Показать лоты инвентаря';
            revCard.onclick = () => openDrilldown('Потенциал выручки (лоты)', `${lots.length} предложений`, lots);
        }
        const profCard = profEl && typeof profEl.closest === 'function' && profEl.closest('.fpt-fin-card');
        if (profCard) {
            profCard.classList.add('fpt-fin-clickable');
            profCard.title = 'Показать лоты инвентаря';
            profCard.onclick = () => openDrilldown('Потенциал прибыли (лоты)', `${lots.length} предложений`, lots);
        }
        const costCard = costEl && typeof costEl.closest === 'function' && costEl.closest('.fpt-fin-card');
        if (costCard) {
            costCard.classList.add('fpt-fin-clickable');
            costCard.title = 'Показать лоты инвентаря';
            costCard.onclick = () => openDrilldown('Себестоимость склада (лоты)', `${lots.length} предложений`, lots);
        }
        const offersCard = offersEl && typeof offersEl.closest === 'function' && offersEl.closest('.fpt-fin-card');
        if (offersCard) {
            offersCard.classList.add('fpt-fin-clickable');
            offersCard.title = 'Показать лоты инвентаря';
            offersCard.onclick = () => openDrilldown('Предложения в продаже', `${lots.length} предложений`, lots);
        }
    }

    function renderOverviewDynamicChart(wrapEl, salesOrders, profitData, metric, currency) {
        if (!wrapEl) return;
        wrapEl.innerHTML = '';

        const W = 680;
        const H = 200;
        const PAD = { t: 20, r: 20, b: 36, l: 56 };
        const cw = W - PAD.l - PAD.r;
        const ch = H - PAD.t - PAD.b;
        const baseY = PAD.t + ch;

        let buckets = [];
        let accent = '#4caf82';
        let stopColor = '#4caf82';
        let valLabel = 'Выручка';
        let emptyTitle = 'Нет данных о динамике';
        let emptyDesc = 'За выбранный период нет данных для графика.';
        let activeCur = null;

        if (metric === 'profit') {
            accent = 'var(--fptm-accent, var(--fpt-accent, #1b75bb))';
            stopColor = '#1b75bb';
            valLabel = 'Чистая прибыль';
            emptyTitle = 'Нет данных о прибыли';
            emptyDesc = 'За выбранный период нет закрытых заказов с известной себестоимостью.';

            const pOrders = (profitData && Array.isArray(profitData.orders)) ? profitData.orders : [];
            const profitClosed = pOrders.filter(o => {
                const info = o.profitInfo;
                return info && info.isClosed && info.netProfit !== null;
            });
            const pCurs = new Set(profitClosed.map(o => String((o.profitInfo && o.profitInfo.currency) || o.currency || 'RUB').toUpperCase()));
            const isSingleCur = pCurs.size === 1;
            const singleCur = isSingleCur ? [...pCurs][0] : null;
            const chosenCur = wrapEl.dataset.chosenCur || null;
            activeCur = (currency && currency !== 'all')
                ? currency
                : (chosenCur || (isSingleCur ? singleCur : null));

            if (!activeCur && pCurs.size > 1) {
                const curButtons = Array.from(pCurs).map(c =>
                    `<button type="button" class="fpt-fin-btn fpt-fin-btn-secondary fpt-fin-cur-select-btn" data-cur="${esc(c)}" style="margin:4px;padding:4px 12px;font-size:12px;border-radius:14px;cursor:pointer;">${esc(c)} (${esc(SYMBOLS[c] || c)})</button>`
                ).join('');
                wrapEl.innerHTML = `
                    <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;text-align:center;">
                        <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;color:var(--fptm-muted, #9099b8);">currency_exchange</span>
                        <div class="fpt-fin-empty-title" style="font-size:14px;font-weight:600;margin-top:8px;">Выберите валюту для отображения денежного графика</div>
                        <div class="fpt-fin-empty-desc" style="font-size:12px;color:var(--fptm-muted, #9099b8);margin-top:4px;max-width:460px;margin-left:auto;margin-right:auto;">
                            В расчёте прибыли присутствуют заказы в нескольких валютах. Выберите валюту для отображения графика чистой прибыли.
                        </div>
                        <div class="fpt-fin-chart-cur-actions" style="margin-top:12px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
                            ${curButtons}
                        </div>
                    </div>`;
                wrapEl.querySelectorAll('.fpt-fin-cur-select-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        wrapEl.dataset.chosenCur = btn.dataset.cur;
                        renderOverviewDynamicChart(wrapEl, salesOrders, profitData, metric, currency);
                    });
                });
                return;
            }

            const bucketsMap = {};
            for (const o of profitClosed) {
                const info = o.profitInfo;
                const oCur = String(info.currency || o.currency || 'RUB').toUpperCase();
                if (activeCur && oCur !== activeCur) continue;

                const ts = typeof o.orderDate === 'number' ? o.orderDate : (Date.parse(o.orderDate || o.date) || 0);
                if (!ts) continue;

                const key = getMskDayKey(ts);
                const p = getMskParts(ts);
                const label = `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}`;
                if (!bucketsMap[key]) {
                    bucketsMap[key] = { key, label, val: 0, count: 0, knownCostCount: 0, orders: [] };
                }
                bucketsMap[key].count++;
                bucketsMap[key].orders.push(o);
                bucketsMap[key].val += info.netProfit;
                bucketsMap[key].knownCostCount++;
            }
            const keys = Object.keys(bucketsMap).sort();
            buckets = keys.map(k => bucketsMap[k]);
        } else if (metric === 'orders') {
            accent = '#f4c84a';
            stopColor = '#f4c84a';
            valLabel = 'Заказы';
            emptyTitle = 'Нет заказов';
            emptyDesc = 'За выбранный период нет закрытых или оплаченных заказов.';

            const rawBuckets = groupOrdersByStep(salesOrders, 'day');
            buckets = rawBuckets.map(b => ({
                key: b.key,
                label: b.label,
                val: b.count,
                count: b.count,
                revenueByCur: b.revenueByCur,
                orders: b.orders
            }));
        } else {
            // metric === 'revenue' (по умолчанию)
            accent = '#4caf82';
            stopColor = '#4caf82';
            valLabel = 'Выручка';
            emptyTitle = 'Нет данных о выручке';
            emptyDesc = 'За выбранный период нет закрытых или оплаченных заказов.';

            const validOrders = (Array.isArray(salesOrders) ? salesOrders : []).filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
            const revCurs = new Set(validOrders.map(o => String(o.currency || 'RUB').toUpperCase()));
            const isSingleCur = revCurs.size === 1;
            const singleCur = isSingleCur ? [...revCurs][0] : null;
            const chosenCur = wrapEl.dataset.chosenCur || null;
            activeCur = (currency && currency !== 'all')
                ? currency
                : (chosenCur || (isSingleCur ? singleCur : null));

            if (!activeCur && revCurs.size > 1) {
                const curButtons = Array.from(revCurs).map(c =>
                    `<button type="button" class="fpt-fin-btn fpt-fin-btn-secondary fpt-fin-cur-select-btn" data-cur="${esc(c)}" style="margin:4px;padding:4px 12px;font-size:12px;border-radius:14px;cursor:pointer;">${esc(c)} (${esc(SYMBOLS[c] || c)})</button>`
                ).join('');
                wrapEl.innerHTML = `
                    <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;text-align:center;">
                        <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:32px;color:var(--fptm-muted, #9099b8);">currency_exchange</span>
                        <div class="fpt-fin-empty-title" style="font-size:14px;font-weight:600;margin-top:8px;">Выберите валюту для отображения денежного графика</div>
                        <div class="fpt-fin-empty-desc" style="font-size:12px;color:var(--fptm-muted, #9099b8);margin-top:4px;max-width:460px;margin-left:auto;margin-right:auto;">
                            В продажах за период присутствуют разные валюты. Финансовый хаб строит денежные графики строго по каждой валюте без приблизительной конвертации.
                        </div>
                        <div class="fpt-fin-chart-cur-actions" style="margin-top:12px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
                            ${curButtons}
                        </div>
                    </div>`;
                wrapEl.querySelectorAll('.fpt-fin-cur-select-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        wrapEl.dataset.chosenCur = btn.dataset.cur;
                        renderOverviewDynamicChart(wrapEl, salesOrders, profitData, metric, currency);
                    });
                });
                return;
            }

            const rawBuckets = groupOrdersByStep(salesOrders, 'day', activeCur);
            buckets = rawBuckets.map(b => ({
                key: b.key,
                label: b.label,
                val: b.revenue || 0,
                count: b.count,
                revenueByCur: b.revenueByCur,
                orders: b.orders
            }));
        }

        if (!buckets.length) {
            wrapEl.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">show_chart</span>
                    <div class="fpt-fin-empty-title">${esc(emptyTitle)}</div>
                    <div class="fpt-fin-empty-desc">${esc(emptyDesc)}</div>
                </div>`;
            return;
        }

        const slot = cw / Math.max(1, buckets.length);
        const vals = buckets.map(b => b.val);

        let minV = Math.min(0, ...vals);
        let rawMax = Math.max(1, ...vals);
        let maxV = niceMax(rawMax);

        if (minV < 0) {
            const symMax = niceMax(Math.max(Math.abs(minV), maxV));
            minV = -symMax;
            maxV = symMax;
        }

        const vRange = maxV - minV || 1;
        const zeroY = baseY - (-minV / vRange) * ch;

        // Grid & Y labels
        let grid = '';
        let yLabels = '';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const y = baseY - (i / steps) * ch;
            grid += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--fptm-border, rgba(255,255,255,0.08))" stroke-width="1" opacity="${i === 0 ? 0.8 : 0.4}"/>`;
            const v = minV + (vRange / steps) * i;
            yLabels += `<text x="${PAD.l - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--fptm-muted, #9099b8)" font-family="inherit">${fmtAxis(v)}</text>`;
        }

        const pts = buckets.map((b, i) => ({
            x: PAD.l + slot * i + slot / 2,
            y: baseY - ((b.val - minV) / vRange) * ch,
            bucket: b
        }));

        const line = smoothPath(pts);
        const area = pts.length > 1
            ? `${line} L${pts[pts.length - 1].x},${zeroY} L${pts[0].x},${zeroY} Z`
            : '';

        const uid = 'fptFinGradOverview_' + Math.random().toString(36).slice(2, 8);

        // X labels
        const MIN_GAP = 54;
        let lastX = -Infinity;
        let xLabels = '';
        pts.forEach((p, i) => {
            const isLast = i === pts.length - 1;
            if (isLast || (p.x - lastX >= MIN_GAP)) {
                xLabels += `<text x="${p.x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--fptm-muted, #9099b8)" font-family="inherit">${esc(p.bucket.label)}</text>`;
                lastX = p.x;
            }
        });

        // Visible circle points
        let dots = '';
        if (pts.length === 1) {
            dots = `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="5" fill="${accent}" stroke="var(--fptm-surface, #171922)" stroke-width="2"/>`;
        } else if (pts.length <= 45) {
            dots = pts.map(p =>
                `<circle class="fpt-fin-chart-dot" cx="${p.x}" cy="${p.y}" r="${pts.length <= 20 ? 3.5 : 2.5}" fill="${accent}" opacity="0.85"/>`
            ).join('');
        }

        // Hit zones for hover tooltip & drill-down
        const hits = pts.map((p, i) => {
            return `<rect class="fpt-fin-svg-hit" data-idx="${i}" x="${p.x - slot / 2}" y="${PAD.t}" width="${slot}" height="${ch}" fill="transparent" style="cursor:pointer;" tabindex="0"></rect>`;
        }).join('');

        wrapEl.innerHTML = `
            <svg class="fpt-fin-chart-svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
                <defs>
                    <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${stopColor}" stop-opacity="0.28"/>
                        <stop offset="100%" stop-color="${stopColor}" stop-opacity="0.01"/>
                    </linearGradient>
                </defs>
                ${grid}
                ${area ? `<path d="${area}" fill="url(#${uid})" stroke="none"/>` : ''}
                ${line ? `<path d="${line}" fill="none" stroke="${accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
                ${dots}
                ${yLabels}
                ${xLabels}
                ${hits}
            </svg>`;

        // Tooltip & drilldown events
        wrapEl.querySelectorAll('.fpt-fin-svg-hit').forEach(hit => {
            const idx = Number(hit.dataset.idx);
            const b = buckets[idx];
            if (!b) return;

            const makeTooltipHtml = () => {
                if (metric === 'profit') {
                    const profStr = formatMoney(b.val, activeCur || currency);
                    return `<strong>${esc(b.label)}</strong><br/>Чистая прибыль: ${esc(profStr)}<br/>С себестоимостью: ${b.knownCostCount} из ${b.count} зак.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                } else if (metric === 'orders') {
                    const revStr = b.revenueByCur ? formatRevenueMulti(b.revenueByCur) : '';
                    return `<strong>${esc(b.label)}</strong><br/>Заказов: ${b.count} шт.<br/>${revStr ? `Выручка: ${esc(revStr)}<br/>` : ''}<span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                } else {
                    const revStr = b.revenueByCur ? (activeCur ? formatMoney(b.val, activeCur) : formatRevenueMulti(b.revenueByCur)) : formatMoney(b.val, activeCur || currency);
                    return `<strong>${esc(b.label)}</strong><br/>Выручка: ${esc(revStr)}<br/>Заказов: ${b.count} шт.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                }
            };

            hit.addEventListener('mouseenter', (e) => showTooltip(makeTooltipHtml(), e.clientX, e.clientY));
            hit.addEventListener('mousemove', (e) => showTooltip(makeTooltipHtml(), e.clientX, e.clientY));
            hit.addEventListener('mouseleave', () => hideTooltip());
            hit.addEventListener('click', () => {
                hideTooltip();
                const drillTitle = metric === 'profit' ? `Прибыль за ${b.label}` : (metric === 'orders' ? `Заказы за ${b.label}` : `Выручка за ${b.label}`);
                const subTitle = `${b.count} зак.`;
                openDrilldown(drillTitle, subTitle, b.orders);
            });
        });
    }

    function renderOverviewCharts(pane, salesOrders, profitData, currency) {
        if (!pane) return;
        const chartWrap = pane.querySelector('#fptFinOverviewChart');
        if (chartWrap) {
            renderOverviewDynamicChart(chartWrap, salesOrders || [], profitData, state.overviewMetric, currency);
        }
        const catsWrap = pane.querySelector('#fptFinOverviewCategoriesChart');
        if (catsWrap) {
            renderCategoryDonut(catsWrap, salesOrders || [], state.cachedOverviewData ? state.cachedOverviewData.salesAgg : null);
        }
    }

    function renderOverviewTopProducts(pane, salesOrders, agg, currency) {
        if (!pane) return;
        const topEl = pane.querySelector('#fptFinOverviewTopProducts');
        if (!topEl) return;

        const topProducts = (agg && Array.isArray(agg.topProducts)) ? agg.topProducts.slice(0, 5) : [];
        if (!topProducts.length) {
            topEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:20px 12px;"><div class="fpt-fin-empty-title">Нет данных о товарах</div></div>';
            return;
        }

        const rows = topProducts.map((p, i) => `
            <div class="fpt-fin-top-row" data-prod-name="${esc(p.name)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .12s;font-size:12px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                    <span style="font-weight:700;color:var(--fptm-muted, #9099b8);width:20px;">#${i + 1}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fptm-text, #fff);" title="${esc(p.name)}">${esc(p.name)}</span>
                </div>
                <span style="font-weight:600;color:var(--fptm-muted, #9099b8);margin-left:8px;flex-shrink:0;">${p.count} зак.</span>
            </div>
        `).join('');

        topEl.innerHTML = `<div class="fpt-fin-top-list" style="display:flex;flex-direction:column;gap:4px;">${rows}</div>`;

        topEl.querySelectorAll('[data-prod-name]').forEach(row => {
            const pName = row.dataset.prodName;
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--fptm-hover, rgba(255, 255, 255, 0.06))'; });
            row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
            row.addEventListener('click', () => {
                const orders = Array.isArray(salesOrders) ? salesOrders : [];
                const filtered = orders.filter(o => (o.description || '-') === pName);
                openDrilldown(`Товар: ${pName}`, `${filtered.length} продаж`, filtered);
            });
        });
    }

    function renderOverviewTopCategories(pane, salesOrders, agg, currency) {
        if (!pane) return;
        const topEl = pane.querySelector('#fptFinOverviewTopCategories');
        if (!topEl) return;

        const topCategories = (agg && Array.isArray(agg.topCategories)) ? agg.topCategories.slice(0, 5) : [];
        if (!topCategories.length) {
            topEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:20px 12px;"><div class="fpt-fin-empty-title">Нет данных о категориях</div></div>';
            return;
        }

        const rows = topCategories.map((c, i) => {
            const revByCur = (agg && agg.byCategoryRevenue && agg.byCategoryRevenue[c.name]) || {};
            const revStr = formatRevenueMulti(revByCur);
            return `
                <div class="fpt-fin-top-row" data-cat-name="${esc(c.name)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .12s;font-size:12px;">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                        <span style="font-weight:700;color:var(--fptm-muted, #9099b8);width:20px;">#${i + 1}</span>
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fptm-text, #fff);" title="${esc(c.name)}">${esc(c.name)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;margin-left:8px;flex-shrink:0;">
                        <span style="color:var(--fptm-muted, #9099b8);">${c.count} зак.</span>
                        <span style="font-weight:600;color:var(--fptm-text, #fff);">${esc(revStr)}</span>
                    </div>
                </div>
            `;
        }).join('');

        topEl.innerHTML = `<div class="fpt-fin-top-list" style="display:flex;flex-direction:column;gap:4px;">${rows}</div>`;

        topEl.querySelectorAll('[data-cat-name]').forEach(row => {
            const cName = row.dataset.catName;
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--fptm-hover, rgba(255, 255, 255, 0.06))'; });
            row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
            row.addEventListener('click', () => {
                const orders = Array.isArray(salesOrders) ? salesOrders : [];
                const filtered = orders.filter(o => (o.subcategoryName || 'Без категории') === cName);
                openDrilldown(`Категория: ${cName}`, `${filtered.length} заказов`, filtered);
            });
        });
    }

    function renderOverviewOperations(pane, operations, currency) {
        if (!pane) return;
        const opsEl = pane.querySelector('#fptFinOverviewOperations');
        if (!opsEl) return;

        const list = Array.isArray(operations) ? operations.slice(0, 5) : [];
        if (!list.length) {
            opsEl.innerHTML = '<div class="fpt-fin-empty-state" style="padding:20px 12px;"><div class="fpt-fin-empty-title">Нет последних событий за выбранный период</div></div>';
            return;
        }

        const rows = list.map((txn, index) => {
            const value = operationSignedValue(txn);
            const cur = String(txn.currency || 'RUB').toUpperCase();
            const title = txn.title || txn.description || operationTypeLabel(txn.type);
            const id = txn.id || txn.operationId || txn.transactionId || '—';
            return `
                <tr class="fpt-fin-operation-row" data-fin-op-idx="${index}" style="cursor:pointer;">
                    <td>${esc(id)}</td>
                    <td>${esc(operationDateLabel(txn))}</td>
                    <td>${esc(operationTypeLabel(txn.type))}</td>
                    <td>${esc(title)}</td>
                    <td class="${value >= 0 ? 'fpt-fin-operation-in' : 'fpt-fin-operation-out'}">${value >= 0 ? '+' : '−'} ${esc(formatMoney(Math.abs(value), cur))}</td>
                    <td>${esc(operationStatusLabel(txn.status))}</td>
                </tr>
            `;
        }).join('');

        opsEl.innerHTML = `
            <div class="fpt-fin-table-wrap">
                <table class="fpt-fin-table fpt-fin-operation-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Дата</th>
                            <th>Тип операции</th>
                            <th>Описание / Реквизиты</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        opsEl.querySelectorAll('[data-fin-op-idx]').forEach(row => {
            row.addEventListener('click', () => {
                const opsBtn = state.container && state.container.querySelector('.fpt-fin-subtab-btn[data-subtab="operations"]');
                if (opsBtn) opsBtn.click();
            });
        });
    }

    function bindOverviewChartToggles(pane) {
        if (!pane) return;
        const toggles = pane.querySelector('#fptFinOverviewChartToggles');
        if (!toggles || toggles.dataset.bound === 'true') return;
        toggles.dataset.bound = 'true';

        toggles.querySelectorAll('.fpt-fin-chart-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const metric = btn.dataset.metric;
                if (!metric || metric === state.overviewMetric) return;

                toggles.querySelectorAll('.fpt-fin-chart-toggle').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                state.overviewMetric = metric;

                const chartWrap = pane.querySelector('#fptFinOverviewChart');
                if (chartWrap && state.cachedOverviewData) {
                    const d = state.cachedOverviewData;
                    renderOverviewDynamicChart(chartWrap, d.sales || [], d.profitData, state.overviewMetric, state.profitCurrency || 'RUB');
                }
            });
        });
    }

    async function renderOverviewSubtab(forceReload) {
        const pane = state.container && state.container.querySelector('.fpt-fin-tab-pane[data-subtab="overview"]');
        if (!pane) return;

        const currentToken = ++state.overviewRenderToken;

        if (forceReload || state.cachedOverviewPeriod !== state.period || !state.cachedOverviewData) {
            state.isOverviewLoading = true;
            renderOverviewSubtabLoading(pane);

            try {
                const finData = (typeof window !== 'undefined' && window.FPTFinanceData) || root.FPTFinanceData;
                const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;

                const filterOpts = {
                    period: state.period,
                    useMsk: true
                };
                if (state.currency && state.currency !== 'all') {
                    filterOpts.currency = state.currency;
                }
                if (state.orderStatus && state.orderStatus !== 'all') {
                    filterOpts.statuses = state.orderStatus;
                }
                if (state.category && state.category !== 'all') {
                    filterOpts.category = state.category;
                }

                const salesPromise = (finData && typeof finData.getSales === 'function')
                    ? finData.getSales(Object.assign({ sort: 'date-desc' }, filterOpts))
                    : Promise.resolve([]);

                const profitPromise = (profitEngine && typeof profitEngine.getRealisedProfit === 'function')
                    ? profitEngine.getRealisedProfit(filterOpts)
                    : Promise.resolve(null);

                const potentialPromise = (potentialEngine && typeof potentialEngine.getInventory === 'function')
                    ? (state.cachedPotentialLots && !forceReload
                        ? Promise.resolve(state.cachedPotentialLots)
                        : potentialEngine.getInventory({ enrichPotential: true, forceRefresh: forceReload }))
                    : Promise.resolve(null);

                const opsFilter = { period: state.period, sort: 'date-desc', useMsk: true };
                if (filterOpts.currency) opsFilter.currency = filterOpts.currency;
                // T04: Strictly do not pass order-status into operations filter
                const opsPromise = (finData && typeof finData.getOperations === 'function')
                    ? finData.getOperations(opsFilter)
                    : Promise.resolve([]);

                const prevPeriod = (finData && typeof finData.resolvePreviousPeriodRange === 'function')
                    ? finData.resolvePreviousPeriodRange(state.period, { useMsk: true })
                    : null;

                const prevSalesPromise = (prevPeriod && finData && typeof finData.getSales === 'function')
                    ? finData.getSales(Object.assign({ sort: 'date-desc' }, filterOpts, { period: prevPeriod }))
                    : Promise.resolve(null);

                const prevProfitPromise = (prevPeriod && profitEngine && typeof profitEngine.getRealisedProfit === 'function')
                    ? profitEngine.getRealisedProfit(Object.assign({}, filterOpts, { period: prevPeriod }))
                    : Promise.resolve(null);

                const [salesRes, profitRes, potRes, opsRes, prevSalesRes, prevProfitRes] = await Promise.allSettled([
                    salesPromise,
                    profitPromise,
                    potentialPromise,
                    opsPromise,
                    prevSalesPromise,
                    prevProfitPromise
                ]);

                if (currentToken !== state.overviewRenderToken) return;

                const sales = salesRes.status === 'fulfilled' && Array.isArray(salesRes.value) ? salesRes.value : [];
                const salesAgg = (finData && typeof finData.aggregateSales === 'function')
                    ? finData.aggregateSales(sales)
                    : null;

                const profitData = profitRes.status === 'fulfilled' ? profitRes.value : null;

                const prevSales = (prevSalesRes && prevSalesRes.status === 'fulfilled' && Array.isArray(prevSalesRes.value)) ? prevSalesRes.value : null;
                const prevSalesAgg = (prevSales && finData && typeof finData.aggregateSales === 'function')
                    ? finData.aggregateSales(prevSales, { period: prevPeriod, useMsk: true })
                    : null;
                const prevProfitData = (prevProfitRes && prevProfitRes.status === 'fulfilled') ? prevProfitRes.value : null;

                const kpiDiffs = (finData && typeof finData.compareKpis === 'function')
                    ? finData.compareKpis(
                        { salesAgg, profitData },
                        { salesAgg: prevSalesAgg, profitData: prevProfitData },
                        { currency: filterOpts.currency || state.currency, primaryCurrency: state.profitCurrency || 'RUB' }
                    )
                    : null;

                let potTotals = null;
                let potCurrency = 'RUB';
                let lots = [];
                if (potRes.status === 'fulfilled' && potRes.value) {
                    try {
                        const rawLots = Array.isArray(potRes.value) ? potRes.value : (potRes.value.lots || []);
                        lots = (filterOpts.category)
                            ? rawLots.filter(l => (l.category || '').toLowerCase() === filterOpts.category.toLowerCase())
                            : rawLots;
                        if (!state.cachedPotentialLots || forceReload) {
                            state.cachedPotentialLots = rawLots;
                            state.potentialLastUpdate = Date.now();
                        }
                        if (Array.isArray(lots) && potentialEngine && typeof potentialEngine.calculatePotentialAggregates === 'function') {
                            const enriched = (typeof potentialEngine.calculateRowPotential === 'function')
                                ? lots.map(l => (l && l.stockKind) ? l : Object.assign({}, l, potentialEngine.calculateRowPotential(l)))
                                : lots;
                            const potAggs = potentialEngine.calculatePotentialAggregates(enriched);
                            const targetCur = (filterOpts.currency) ? filterOpts.currency : state.profitCurrency;
                            potCurrency = potAggs[targetCur] ? targetCur : (Object.keys(potAggs)[0] || 'RUB');
                            potTotals = potAggs[potCurrency] || null;
                        }
                    } catch (potErr) {
                        console.warn('[FPTFinanceHub] Failed to aggregate potential data:', potErr);
                        potTotals = null;
                    }
                }

                const operations = opsRes.status === 'fulfilled' && Array.isArray(opsRes.value) ? opsRes.value : [];

                state.cachedOverviewData = {
                    sales,
                    salesAgg,
                    profitData,
                    potTotals,
                    potCurrency,
                    lots,
                    operations,
                    prevSalesAgg,
                    prevProfitData,
                    kpiDiffs
                };
                state.cachedOverviewPeriod = state.period;
                await updateLastUpdatedText('overview');
                updateCategorySelectOptions(sales.map(o => o.subcategoryName || o.category).concat(lots.map(l => l.category)));
            } catch (err) {
                console.error('[FPTFinanceHub] Error loading overview data:', err);
                if (currentToken !== state.overviewRenderToken) return;
                state.isOverviewLoading = false;
                return;
            }
            state.isOverviewLoading = false;
        }

        if (currentToken !== state.overviewRenderToken) return;

        const data = state.cachedOverviewData || {};
        const primaryCurrency = (data.salesAgg && data.salesAgg.byCurrency && Object.keys(data.salesAgg.byCurrency)[0]) || state.profitCurrency || 'RUB';

        renderOverviewRow1(pane, data.salesAgg, data.profitData, primaryCurrency, data.sales, data.profitData ? data.profitData.orders : [], data.kpiDiffs);
        renderOverviewRow2(pane, data.potTotals, data.potCurrency || 'RUB', data.lots || []);
        renderOverviewCharts(pane, data.sales, data.profitData, primaryCurrency);
        renderOverviewTopProducts(pane, data.sales, data.salesAgg, primaryCurrency);
        renderOverviewTopCategories(pane, data.sales, data.salesAgg, primaryCurrency);
        renderOverviewOperations(pane, data.operations, primaryCurrency);
        bindOverviewChartToggles(pane);
        await updateLastUpdatedText('overview');
    }

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

    function getCustomRangeControls() {
        if (!state.container) return null;
        return {
            wrap: state.container.querySelector('#fptFinCustomRange'),
            from: state.container.querySelector('#fptFinCustomFrom'),
            to: state.container.querySelector('#fptFinCustomTo'),
            error: state.container.querySelector('#fptFinCustomRangeError'),
            period: state.container.querySelector('#fptFinPeriodSelect')
        };
    }

    function setCustomRangeError(message) {
        const controls = getCustomRangeControls();
        if (!controls || !controls.error) return;
        controls.error.textContent = message || '';
        controls.error.style.display = message ? '' : 'none';
    }

    function syncCustomRangeControls(visible) {
        const controls = getCustomRangeControls();
        if (!controls) return;
        if (controls.wrap) controls.wrap.style.display = visible ? 'flex' : 'none';
        if (controls.from && state.customRange && !controls.from.value) {
            controls.from.value = state.customRange.from;
        }
        if (controls.to && state.customRange && !controls.to.value) {
            controls.to.value = state.customRange.to;
        }
        setCustomRangeError('');
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
                : (from > to ? 'Дата From не может быть позже даты To.' : 'Укажите корректные календарные даты.'));
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
        if (controls && controls.period) controls.period.value = 'custom';
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
            if (controls.period) controls.period.value = fallback;
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
            if (controls && controls.period) controls.period.value = 'custom';
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

    function updateStatusSelectOptions(subtab) {
        if (!state.container) return;
        const statusSelect = state.container.querySelector('#fptFinStatusSelect');
        if (!statusSelect) return;

        if (subtab === 'potential') {
            statusSelect.style.display = 'none';
            return;
        }

        statusSelect.style.display = '';

        if (subtab === 'operations') {
            statusSelect.setAttribute('aria-label', 'Статус операций');
            statusSelect.innerHTML = `
                <option value="all">Все статусы</option>
                <option value="complete">Завершено</option>
                <option value="cancel">Отменено</option>
                <option value="waiting">Ожидание</option>
            `;
            statusSelect.value = state.operationStatus || 'all';
            state.status = state.operationStatus || 'all';
        } else {
            statusSelect.setAttribute('aria-label', 'Статус заказов');
            statusSelect.innerHTML = `
                <option value="all">Все статусы</option>
                <option value="closed">Закрытые</option>
                <option value="paid">Оплаченные</option>
                <option value="refunded">Возвраты</option>
            `;
            statusSelect.value = state.orderStatus || 'all';
            state.status = state.orderStatus || 'all';
        }
    }

    function setupHeaderFilters(container) {
        if (!container) return;
        const periodWrap = container.querySelector('.fpt-fin-period-wrap');
        if (!periodWrap) return;

        // 0. Potential Snapshot Badge (T05)
        let snapshotBadge = container.querySelector('#fptFinPeriodSnapshotBadge');
        if (!snapshotBadge) {
            snapshotBadge = document.createElement('div');
            snapshotBadge.id = 'fptFinPeriodSnapshotBadge';
            snapshotBadge.className = 'fpt-fin-snapshot-badge';
            snapshotBadge.setAttribute('role', 'status');
            snapshotBadge.setAttribute('aria-label', 'Текущий снимок инвентаря');
            snapshotBadge.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px;color:#94a3b8;vertical-align:middle;margin-right:4px;">inventory_2</span><span>Текущий снимок</span>';
            snapshotBadge.style.display = 'none';
            const periodSelect = container.querySelector('#fptFinPeriodSelect');
            if (periodSelect && periodSelect.parentNode) {
                periodSelect.parentNode.insertBefore(snapshotBadge, periodSelect.nextSibling);
            } else {
                periodWrap.appendChild(snapshotBadge);
            }
        }

        // 1. Period Select
        const periodSelect = container.querySelector('#fptFinPeriodSelect');
        if (periodSelect) {
            periodSelect.value = periodKey(state.period) || DEFAULT_PERIOD;
            periodSelect.onchange = (e) => onPeriodChange(e.target.value);
        }

        // 2. Custom date range controls
        const customApplyBtn = container.querySelector('#fptFinCustomApplyBtn');
        if (customApplyBtn) {
            customApplyBtn.onclick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return onCustomRangeApply();
            };
        }
        const customResetBtn = container.querySelector('#fptFinCustomResetBtn');
        if (customResetBtn) {
            customResetBtn.onclick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return onCustomRangeReset();
            };
        }
        syncCustomRangeControls(state.pendingCustomRange || periodKey(state.period) === 'custom');

        // 3. Currency Select
        let curSelect = container.querySelector('#fptFinCurrencySelect');
        if (!curSelect) {
            curSelect = document.createElement('select');
            curSelect.id = 'fptFinCurrencySelect';
            curSelect.className = 'fpt-fin-period-select';
            curSelect.setAttribute('aria-label', 'Валюта статистики');
            curSelect.innerHTML = `
                <option value="all">Все валюты</option>
                <option value="RUB">₽ RUB</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
            `;
            periodWrap.appendChild(curSelect);
        }
        curSelect.value = state.currency || 'all';
        curSelect.onchange = (e) => onCurrencyChange(e.target.value);

        // 4. Status Select (options dynamically configured by updateStatusSelectOptions)
        let statusSelect = container.querySelector('#fptFinStatusSelect');
        if (!statusSelect) {
            statusSelect = document.createElement('select');
            statusSelect.id = 'fptFinStatusSelect';
            statusSelect.className = 'fpt-fin-period-select';
            periodWrap.appendChild(statusSelect);
        }
        statusSelect.onchange = (e) => onStatusChange(e.target.value);

        // 5. Category Select
        let catSelect = container.querySelector('#fptFinCategorySelect');
        if (!catSelect) {
            catSelect = document.createElement('select');
            catSelect.id = 'fptFinCategorySelect';
            catSelect.className = 'fpt-fin-period-select';
            catSelect.setAttribute('aria-label', 'Категория товаров');
            catSelect.innerHTML = `<option value="all">Все категории</option>`;
            periodWrap.appendChild(catSelect);
        }
        catSelect.value = state.category || 'all';
        catSelect.onchange = (e) => onCategoryChange(e.target.value);

        // 6. Refresh button activation
        const refreshBtn = container.querySelector('#fptFinRefreshBtn');
        if (refreshBtn) {
            refreshBtn.onclick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return refresh();
            };
        }

        // 7. Export button activation
        const exportBtn = container.querySelector('#fptFinExportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.removeAttribute('disabled');
            exportBtn.title = 'Экспорт финансовых данных (CSV, JSON)';
            exportBtn.setAttribute('aria-label', 'Экспорт финансовых данных');
            exportBtn.onclick = () => openExportModal();
        }

        updateHeaderFiltersVisibility(state.activeSubtab);
    }

    function updateHeaderFiltersVisibility(subtab) {
        if (!state.container) return;
        const periodSelect = state.container.querySelector('#fptFinPeriodSelect');
        const snapshotBadge = state.container.querySelector('#fptFinPeriodSnapshotBadge');
        const catSelect = state.container.querySelector('#fptFinCategorySelect');
        const customRangeWrap = state.container.querySelector('#fptFinCustomRange');

        // T05: Potential is a live snapshot, not a historical date range
        if (subtab === 'potential') {
            if (periodSelect) {
                if (typeof periodSelect.style.setProperty === 'function') {
                    periodSelect.style.setProperty('display', 'none', 'important');
                } else {
                    periodSelect.style.display = 'none';
                }
            }
            if (snapshotBadge) {
                snapshotBadge.style.display = 'inline-flex';
            }
            if (customRangeWrap) customRangeWrap.style.display = 'none';
        } else {
            if (periodSelect) {
                if (typeof periodSelect.style.removeProperty === 'function') {
                    periodSelect.style.removeProperty('display');
                }
                periodSelect.style.display = '';
                // Restore user's previous period selection
                if (state.period) {
                    if (typeof state.period === 'string') {
                        periodSelect.value = state.period;
                    } else {
                        periodSelect.value = periodKey(state.period);
                    }
                }
            }
            if (snapshotBadge) {
                snapshotBadge.style.display = 'none';
            }
            if (customRangeWrap) {
                customRangeWrap.style.display = (state.pendingCustomRange || periodKey(state.period) === 'custom')
                    ? 'flex'
                    : 'none';
            }
        }

        if (catSelect) {
            catSelect.style.display = (subtab === 'operations') ? 'none' : '';
        }
        updateStatusSelectOptions(subtab);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ЭКСПОРТ ДАННЫХ (T09B)
    // ─────────────────────────────────────────────────────────────────────────────

    function ensureExportModalStyles() {
        if (typeof document === 'undefined' || document.getElementById('fpt-fin-export-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'fpt-fin-export-modal-styles';
        style.textContent = `
            .fpt-fin-export-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                box-sizing: border-box;
                font-family: inherit;
            }
            .fpt-fin-export-dialog {
                background: #1a1c23;
                border: 1px solid #2e3342;
                border-radius: 12px;
                width: 100%;
                max-width: 580px;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55);
                color: #e2e8f0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .fpt-fin-export-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 18px;
                background: #21242d;
                border-bottom: 1px solid #2e3342;
            }
            .fpt-fin-export-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .fpt-fin-export-head h4 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #f1f5f9;
            }
            .fpt-fin-export-close {
                background: transparent;
                border: none;
                color: #94a3b8;
                font-size: 22px;
                cursor: pointer;
                line-height: 1;
                padding: 0 4px;
            }
            .fpt-fin-export-close:hover {
                color: #fff;
            }
            .fpt-fin-export-body {
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .fpt-fin-export-filters-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 12px;
                font-size: 12px;
                color: #94a3b8;
                background: #14161d;
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid #282c37;
            }
            .fpt-fin-export-filters-bar strong {
                color: #cbd5e1;
            }
            .fpt-fin-export-tabs {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .fpt-fin-export-tab {
                background: #242834;
                border: 1px solid #33394a;
                color: #cbd5e1;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .fpt-fin-export-tab:hover {
                background: #2d3342;
                color: #fff;
            }
            .fpt-fin-export-tab.active {
                background: #2563eb;
                border-color: #3b82f6;
                color: #fff;
            }
            .fpt-fin-export-card {
                background: #14161d;
                border: 1px solid #282c37;
                border-radius: 8px;
                padding: 12px 14px;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .fpt-fin-export-card-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: #cbd5e1;
            }
            .fpt-fin-export-card-row strong {
                color: #fff;
                font-weight: 600;
            }
            .fpt-fin-export-actions {
                display: flex;
                gap: 10px;
                margin-top: 4px;
            }
            .fpt-fin-export-btn {
                flex: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 9px 16px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: opacity 0.15s ease;
            }
            .fpt-fin-export-btn:hover {
                opacity: 0.9;
            }
            .fpt-fin-export-btn-csv {
                background: #059669;
                color: #fff;
            }
            .fpt-fin-export-btn-json {
                background: #2563eb;
                color: #fff;
            }
            .fpt-fin-export-hint {
                font-size: 11px;
                color: #64748b;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }

    async function getDatasetForExport(datasetKey) {
        const dataset = datasetKey || (state.activeSubtab === 'overview' ? 'sales' : state.activeSubtab);
        const meta = {
            dataset,
            period: dataset === 'potential' ? 'snapshot' : state.period,
            currency: state.currency,
            status: dataset === 'operations' ? state.operationStatus : state.orderStatus,
            orderStatus: state.orderStatus,
            operationStatus: state.operationStatus,
            category: state.category,
            exportedAt: new Date().toISOString()
        };

        if (dataset === 'sales') {
            let orders = state.cachedOrders;
            let agg = state.cachedAgg;
            if (!orders || state.cachedPeriod !== state.period) {
                if (root.FPTFinanceData && typeof root.FPTFinanceData.getSales === 'function') {
                    const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                    if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                    if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                    if (state.category && state.category !== 'all') filterOpts.category = state.category;
                    orders = await root.FPTFinanceData.getSales(filterOpts);
                    agg = root.FPTFinanceData.aggregateSales(orders, { period: state.period, useMsk: true });
                } else {
                    orders = [];
                    agg = { count: 0, total: 0, byCurrency: {} };
                }
            }
            return { dataset: 'sales', items: orders || [], totals: agg || {}, meta };
        }

        if (dataset === 'purchases') {
            let orders = state.cachedPurchasesOrders;
            let agg = state.cachedPurchasesAgg;
            if (!orders || state.cachedPurchasesPeriod !== state.period) {
                if (root.FPTFinanceData && typeof root.FPTFinanceData.getPurchases === 'function') {
                    const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                    if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                    if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                    if (state.category && state.category !== 'all') filterOpts.category = state.category;
                    orders = await root.FPTFinanceData.getPurchases(filterOpts);
                    agg = root.FPTFinanceData.aggregatePurchases(orders, { period: state.period, useMsk: true });
                } else {
                    orders = [];
                    agg = { count: 0, total: 0, byCurrency: {} };
                }
            }
            return { dataset: 'purchases', items: orders || [], totals: agg || {}, meta };
        }

        if (dataset === 'operations') {
            let operations = state.cachedOperations;
            let agg = state.cachedOperationsAgg;
            if (!operations || state.cachedOperationsPeriod !== state.period) {
                if (root.FPTFinanceData && typeof root.FPTFinanceData.getOperations === 'function') {
                    const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                    if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                    if (state.operationStatus && state.operationStatus !== 'all') filterOpts.statuses = state.operationStatus;
                    operations = await root.FPTFinanceData.getOperations(filterOpts);
                    agg = root.FPTFinanceData.aggregateOperations(operations);
                } else {
                    operations = [];
                    agg = { count: 0, inByCur: {}, outByCur: {} };
                }
            }
            return { dataset: 'operations', items: operations || [], totals: agg || {}, meta };
        }

        if (dataset === 'profit') {
            const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
            let allOrders = state.cachedProfitOrders;
            let agg = state.cachedProfitAgg;
            if (!allOrders || state.cachedProfitPeriod !== state.period) {
                if (profitEngine && typeof profitEngine.getRealisedProfit === 'function') {
                    const filterOpts = { period: state.period, useMsk: true };
                    if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                    if (state.category && state.category !== 'all') filterOpts.category = state.category;
                    if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                    const result = await profitEngine.getRealisedProfit(filterOpts);
                    allOrders = Array.isArray(result.orders) ? result.orders : [];
                    agg = result.byCurrency || {};
                } else {
                    allOrders = [];
                    agg = {};
                }
            }
            const filteredOrders = filterProfitOrders(allOrders || [], state.profitFilter || 'all');
            const availableCurrencies = Object.keys(agg || {});
            const primaryCurrency = (state.currency && state.currency !== 'all')
                ? state.currency
                : ((agg && agg[state.profitCurrency]) ? state.profitCurrency : (availableCurrencies[0] || 'RUB'));

            const aggResult = (profitEngine && typeof profitEngine.calculateProfitAggregates === 'function')
                ? profitEngine.calculateProfitAggregates(filteredOrders, { currency: primaryCurrency })
                : null;
            const totals = aggResult ? aggResult.totals : ((agg && agg[primaryCurrency]) || { currency: primaryCurrency });

            return { dataset: 'profit', items: filteredOrders, totals, meta: Object.assign(meta, { primaryCurrency }) };
        }

        if (dataset === 'potential') {
            const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
            let lots = state.cachedPotentialLots;
            let agg = state.cachedPotentialAgg;
            if (!lots) {
                if (potentialEngine && typeof potentialEngine.getInventory === 'function') {
                    lots = await potentialEngine.getInventory({ enrichPotential: true });
                    agg = potentialEngine.calculatePotentialAggregates(lots);
                } else {
                    lots = [];
                    agg = {};
                }
            }
            const activeLots = (state.category && state.category !== 'all')
                ? (lots || []).filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                : (lots || []);
            const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
            const availableCurrencies = Object.keys(agg || {});
            const primaryCurrency = (state.currency && state.currency !== 'all')
                ? state.currency
                : ((agg && agg[state.potentialCurrency]) ? state.potentialCurrency : (availableCurrencies[0] || 'RUB'));

            const totals = (potentialEngine && typeof potentialEngine.calculateCurrencyTotals === 'function')
                ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency)
                : ((agg && agg[primaryCurrency]) || { currency: primaryCurrency });

            return { dataset: 'potential', items: filteredLots, totals, meta: Object.assign(meta, { primaryCurrency }) };
        }

        return { dataset, items: [], totals: null, meta };
    }

    async function exportFinanceData(dataset, format) {
        const studio = (typeof window !== 'undefined' && window.FPTExportStudio) || root.FPTExportStudio;
        const engine = studio && studio.financeExport;
        if (!engine || typeof engine.download !== 'function') {
            throw new Error('Модуль FPTExportStudio.financeExport не найден');
        }
        const data = await getDatasetForExport(dataset);
        return engine.download(data.dataset, format, data.items, data.totals, data.meta);
    }

    function closeExportModal() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('fpt-fin-export-modal');
        if (modal) modal.remove();
    }

    function openExportModal() {
        if (typeof document === 'undefined') return;
        closeExportModal();
        ensureExportModalStyles();

        const activeSubtab = state.activeSubtab;
        let currentDataset = ['sales', 'purchases', 'operations', 'profit', 'potential'].includes(activeSubtab)
            ? activeSubtab
            : 'sales';

        const overlay = document.createElement('div');
        overlay.id = 'fpt-fin-export-modal';
        overlay.className = 'fpt-fin-export-overlay';

        const periodNames = {
            today: 'Сегодня',
            yesterday: 'Вчера',
            '24h': '24 часа',
            '7d': '7 дней',
            '30d': '30 дней',
            '365d': '365 дней',
            all: 'Всё время'
        };

        const orderStatusNames = {
            all: 'Все статусы',
            closed: 'Закрытые',
            paid: 'Оплаченные',
            refunded: 'Возвраты'
        };

        const operationStatusNames = {
            all: 'Все статусы',
            complete: 'Завершено',
            cancel: 'Отменено',
            waiting: 'Ожидание'
        };

        function getPeriodBadgeText(ds) {
            if (ds === 'potential') return 'Текущий снимок';
            return periodNames[periodKey(state.period)] || periodLabel(state.period);
        }

        function getStatusBadgeText(ds) {
            if (ds === 'potential') return '—';
            if (ds === 'operations') {
                const s = state.operationStatus || 'all';
                return operationStatusNames[s] || s;
            }
            const s = state.orderStatus || 'all';
            return orderStatusNames[s] || s;
        }

        overlay.innerHTML = `
            <div class="fpt-fin-export-dialog" role="dialog" aria-modal="true" aria-labelledby="fpt-fin-export-title">
                <div class="fpt-fin-export-head">
                    <div class="fpt-fin-export-title-row">
                        <span class="material-symbols-rounded" style="color:#2563eb;font-size:20px;">file_download</span>
                        <h4 id="fpt-fin-export-title">Экспорт финансовых данных</h4>
                    </div>
                    <button type="button" class="fpt-fin-export-close" aria-label="Закрыть">×</button>
                </div>
                <div class="fpt-fin-export-body">
                    <div class="fpt-fin-export-filters-bar" id="fptFinExportFiltersBar">
                        <span id="fptFinExportPeriodBadge">Период: <strong>${esc(getPeriodBadgeText(currentDataset))}</strong></span>
                        <span>Валюта: <strong>${esc(state.currency === 'all' ? 'Все валюты' : state.currency)}</strong></span>
                        <span id="fptFinExportStatusBadge">Статус: <strong>${esc(getStatusBadgeText(currentDataset))}</strong></span>
                        ${state.category !== 'all' ? `<span>Категория: <strong>${esc(state.category)}</strong></span>` : ''}
                    </div>

                    <div>
                        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#94a3b8;">Выберите набор данных:</div>
                        <div class="fpt-fin-export-tabs" id="fptFinExportTabs">
                            <button type="button" class="fpt-fin-export-tab ${currentDataset === 'sales' ? 'active' : ''}" data-ds="sales">Продажи</button>
                            <button type="button" class="fpt-fin-export-tab ${currentDataset === 'purchases' ? 'active' : ''}" data-ds="purchases">Покупки</button>
                            <button type="button" class="fpt-fin-export-tab ${currentDataset === 'operations' ? 'active' : ''}" data-ds="operations">Операции</button>
                            <button type="button" class="fpt-fin-export-tab ${currentDataset === 'profit' ? 'active' : ''}" data-ds="profit">Прибыль</button>
                            <button type="button" class="fpt-fin-export-tab ${currentDataset === 'potential' ? 'active' : ''}" data-ds="potential">Инвентарь и потенциал</button>
                        </div>
                    </div>

                    <div class="fpt-fin-export-card" id="fptFinExportCard">
                        <div style="color:#94a3b8;font-size:12px;">Загрузка данных...</div>
                    </div>

                    <div class="fpt-fin-export-actions">
                        <button type="button" class="fpt-fin-export-btn fpt-fin-export-btn-csv" id="fptFinExportDownloadCsv">
                            <span class="material-symbols-rounded" style="font-size:16px;">table_view</span>
                            <span>Скачать CSV</span>
                        </button>
                        <button type="button" class="fpt-fin-export-btn fpt-fin-export-btn-json" id="fptFinExportDownloadJson">
                            <span class="material-symbols-rounded" style="font-size:16px;">data_object</span>
                            <span>Скачать JSON</span>
                        </button>
                    </div>

                    <div class="fpt-fin-export-hint">
                        • CSV содержит UTF-8 с BOM, разделитель точка с запятой (;) и блок итогов (# TOTALS).<br>
                        • JSON содержит полную структуру с метаданными фильтров, итогами и строками.<br>
                        • Поля себестоимости и прибыли при отсутствии данных строго сохраняются как <code>null</code>.
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cardEl = overlay.querySelector('#fptFinExportCard');
        const csvBtn = overlay.querySelector('#fptFinExportDownloadCsv');
        const jsonBtn = overlay.querySelector('#fptFinExportDownloadJson');
        const tabsEl = overlay.querySelector('#fptFinExportTabs');

        async function updateCard() {
            if (!cardEl) return;
            cardEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;">Подготовка набора данных...</div>';
            if (csvBtn) csvBtn.disabled = true;
            if (jsonBtn) jsonBtn.disabled = true;

            try {
                const data = await getDatasetForExport(currentDataset);
                const itemsCount = data.items ? data.items.length : 0;
                let summaryHtml = '';

                if (currentDataset === 'sales') {
                    const rev = data.totals && data.totals.byCurrency ? formatRevenueMulti(data.totals.byCurrency) : '0 ₽';
                    summaryHtml = `
                        <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Продажи</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Заказов к выгрузке:</span><strong>${itemsCount}</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Выручка от продаж:</span><strong>${esc(rev)}</strong></div>
                    `;
                } else if (currentDataset === 'purchases') {
                    const cost = data.totals && data.totals.byCurrency ? formatRevenueMulti(data.totals.byCurrency) : '0 ₽';
                    summaryHtml = `
                        <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Покупки</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Покупок к выгрузке:</span><strong>${itemsCount}</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Сумма покупок:</span><strong>${esc(cost)}</strong></div>
                    `;
                } else if (currentDataset === 'operations') {
                    summaryHtml = `
                        <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Операции</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Операций к выгрузке:</span><strong>${itemsCount}</strong></div>
                    `;
                } else if (currentDataset === 'profit') {
                    const cur = (data.totals && data.totals.currency) || 'RUB';
                    const net = data.totals && data.totals.realisedNetProfit !== null && data.totals.realisedNetProfit !== undefined
                        ? formatMoney(data.totals.realisedNetProfit, cur)
                        : 'null';
                    const knownCount = data.totals && data.totals.knownCostOrdersCount !== undefined ? data.totals.knownCostOrdersCount : 0;
                    summaryHtml = `
                        <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Реализованная прибыль</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Заказов к выгрузке:</span><strong>${itemsCount}</strong> (с себестоимостью: ${knownCount})</div>
                        <div class="fpt-fin-export-card-row"><span>Чистая прибыль:</span><strong>${esc(net)}</strong></div>
                    `;
                } else if (currentDataset === 'potential') {
                    const cur = (data.totals && data.totals.currency) || 'RUB';
                    const potProfit = data.totals && data.totals.knownPotentialProfit !== null && data.totals.knownPotentialProfit !== undefined
                        ? formatMoney(data.totals.knownPotentialProfit, cur)
                        : 'null';
                    const finiteCount = data.totals && data.totals.finiteOffers !== undefined ? data.totals.finiteOffers : 0;
                    summaryHtml = `
                        <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Инвентарь и потенциал</strong></div>
                        <div class="fpt-fin-export-card-row"><span>Лотов к выгрузке:</span><strong>${itemsCount}</strong> (с остатком: ${finiteCount})</div>
                        <div class="fpt-fin-export-card-row"><span>Потенциал чистой прибыли:</span><strong>${esc(potProfit)}</strong></div>
                    `;
                }

                cardEl.innerHTML = summaryHtml;
                if (csvBtn) csvBtn.disabled = false;
                if (jsonBtn) jsonBtn.disabled = false;
            } catch (err) {
                console.error('[FPTFinanceHub] Export prepare error:', err);
                cardEl.innerHTML = `<div style="color:#ef4444;font-size:12px;">Ошибка загрузки данных: ${esc(err.message || err)}</div>`;
                if (csvBtn) csvBtn.disabled = true;
                if (jsonBtn) jsonBtn.disabled = true;
            }
        }

        tabsEl.onclick = (e) => {
            const btn = e.target.closest('.fpt-fin-export-tab');
            if (!btn) return;
            tabsEl.querySelectorAll('.fpt-fin-export-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            currentDataset = btn.dataset.ds;
            const statusBadge = overlay.querySelector('#fptFinExportStatusBadge');
            if (statusBadge) {
                statusBadge.innerHTML = `Статус: <strong>${esc(getStatusBadgeText(currentDataset))}</strong>`;
            }
            const periodBadge = overlay.querySelector('#fptFinExportPeriodBadge');
            if (periodBadge) {
                periodBadge.innerHTML = `Период: <strong>${esc(getPeriodBadgeText(currentDataset))}</strong>`;
            }
            updateCard();
        };

        const doDownload = async (format) => {
            const btn = format === 'csv' ? csvBtn : jsonBtn;
            if (!btn) return;
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span style="display:inline-block;animation:spin 1s infinite linear;">↻</span> Формирование...';
            try {
                await exportFinanceData(currentDataset, format);
                btn.innerHTML = '✓ Скачано';
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = orig;
                }, 1800);
            } catch (err) {
                console.error('[FPTFinanceHub] Export error:', err);
                alert('Ошибка экспорта: ' + (err.message || err));
                btn.disabled = false;
                btn.innerHTML = orig;
            }
        };

        if (csvBtn) csvBtn.onclick = () => doDownload('csv');
        if (jsonBtn) jsonBtn.onclick = () => doDownload('json');

        const closeBtn = overlay.querySelector('.fpt-fin-export-close');
        if (closeBtn) closeBtn.onclick = closeExportModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeExportModal();
        };

        const onEsc = (e) => {
            if (e.key === 'Escape') {
                closeExportModal();
                document.removeEventListener('keydown', onEsc);
            }
        };
        document.addEventListener('keydown', onEsc);

        updateCard();
    }

    /**
     * Фоновое обновление финансовых данных в зависимости от активного таба (T03)
     */
    async function refresh() {
        if (!state.container) return;
        if (state.isRefreshing) return;
        state.isRefreshing = true;

        const refreshBtn = state.container.querySelector('#fptFinRefreshBtn');
        const lastUpdatedEl = state.container.querySelector('#fptFinLastUpdatedText');

        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('fpt-fin-btn-spin');
        }

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
                }, 8000);

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

        async function applyFreshness(updateResult, subtab) {
            if (lastUpdatedEl && updateResult && updateResult.updatedAt) {
                lastUpdatedEl.textContent = formatLastUpdatedText(updateResult.updatedAt);
                lastUpdatedEl.title = '';
            } else if (root.FPTFinanceData && typeof root.FPTFinanceData.getMeta === 'function') {
                try {
                    const meta = await root.FPTFinanceData.getMeta(subtab);
                    if (lastUpdatedEl && meta && meta.lastUpdate) {
                        lastUpdatedEl.textContent = formatLastUpdatedText(meta.lastUpdate);
                        lastUpdatedEl.title = '';
                        return;
                    }
                } catch (_) {}
                await updateLastUpdatedText(subtab);
            } else {
                await updateLastUpdatedText(subtab);
            }
        }

        try {
            const currentSubtab = state.activeSubtab;

            if (currentSubtab === 'sales') {
                const updateResult = await runBackgroundUpdate('updateSales');
                invalidateSalesCache();
                await renderSalesSubtab(true);
                await applyFreshness(updateResult, 'sales');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные о продажах обновлены', false);
                }
            } else if (currentSubtab === 'purchases') {
                const pCfg = getPurchasesConfig();
                const actionName = pCfg.updateAction || 'updatePurchases';
                const updateResult = await runBackgroundUpdate(actionName);
                invalidatePurchasesCache();
                await renderPurchasesSubtab(true);
                await applyFreshness(updateResult, 'purchases');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные о покупках обновлены', false);
                }
            } else if (currentSubtab === 'operations') {
                const updateResult = await runBackgroundUpdate('updateFinance');
                invalidateOperationsCache();
                await renderOperationsSubtab(true);
                await applyFreshness(updateResult, 'operations');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные об операциях обновлены', false);
                }
            } else if (currentSubtab === 'profit') {
                // Прибыль рассчитывается на основе продаж и не может обновляться без продаж
                const updateResult = await runBackgroundUpdate('updateSales');
                invalidateProfitCache();
                await renderProfitSubtab(true);
                if (updateResult && updateResult.updatedAt) {
                    state.profitLastUpdate = updateResult.updatedAt;
                }
                await updateLastUpdatedText('profit');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные о прибыли обновлены', false);
                }
            } else if (currentSubtab === 'potential') {
                invalidatePotentialCache();
                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                if (!potentialEngine || typeof potentialEngine.getInventory !== 'function') {
                    throw new Error('Модуль инвентаря недоступен');
                }
                const lots = await potentialEngine.getInventory({ enrichPotential: true, forceRefresh: true });
                state.cachedPotentialLots = Array.isArray(lots) ? lots : [];
                if (typeof potentialEngine.calculatePotentialAggregates === 'function') {
                    state.cachedPotentialAgg = potentialEngine.calculatePotentialAggregates(state.cachedPotentialLots);
                }
                state.potentialLastUpdate = Date.now();
                await renderPotentialSubtab(false);
                await updateLastUpdatedText('potential');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные о потенциале обновлены', false);
                }
            } else if (currentSubtab === 'overview') {
                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                const [salesRes, opsRes, invRes] = await Promise.allSettled([
                    runBackgroundUpdate('updateSales'),
                    runBackgroundUpdate('updateFinance'),
                    (async () => {
                        if (!potentialEngine || typeof potentialEngine.getInventory !== 'function') {
                            throw new Error('Модуль инвентаря недоступен');
                        }
                        return await potentialEngine.getInventory({ enrichPotential: true, forceRefresh: true });
                    })()
                ]);

                const salesOk = salesRes.status === 'fulfilled';
                const opsOk = opsRes.status === 'fulfilled';
                const invOk = invRes.status === 'fulfilled';

                // Инвалидируем только релевантные кэши
                invalidateOverviewCache();
                if (salesOk) invalidateSalesCache();
                if (opsOk) invalidateOperationsCache();
                if (invOk) {
                    state.cachedPotentialLots = Array.isArray(invRes.value) ? invRes.value : [];
                    if (potentialEngine && typeof potentialEngine.calculatePotentialAggregates === 'function') {
                        state.cachedPotentialAgg = potentialEngine.calculatePotentialAggregates(state.cachedPotentialLots);
                    }
                    state.potentialLastUpdate = Date.now();
                }

                const failed = [];
                if (!salesOk) failed.push(`продажи (${salesRes.reason && salesRes.reason.message ? salesRes.reason.message : 'ошибка'})`);
                if (!opsOk) failed.push(`операции (${opsRes.reason && opsRes.reason.message ? opsRes.reason.message : 'ошибка'})`);
                if (!invOk) failed.push(`инвентарь (${invRes.reason && invRes.reason.message ? invRes.reason.message : 'ошибка'})`);

                if (failed.length === 3) {
                    throw new Error(`Не удалось обновить данные обзора: ${failed.join(', ')}`);
                }

                const prevOverviewUpdate = state.overviewLastUpdate;
                await renderOverviewSubtab(false);

                if (failed.length > 0) {
                    state.overviewLastUpdate = prevOverviewUpdate;
                    await updateLastUpdatedText('overview');
                    if (typeof root.showNotification === 'function') {
                        root.showNotification(`Обновлено частично. Ошибки: ${failed.join(', ')}`, true);
                    }
                } else {
                    await updateLastUpdatedText('overview');
                    if (typeof root.showNotification === 'function') {
                        root.showNotification('Данные обзора обновлены', false);
                    }
                }
            } else {
                // Fallback для неизвестной подвкладки: обновляем продажи
                const updateResult = await runBackgroundUpdate('updateSales');
                invalidateSalesCache();
                await renderSalesSubtab(true);
                await applyFreshness(updateResult, 'sales');
                if (typeof root.showNotification === 'function') {
                    root.showNotification('Данные о продажах обновлены', false);
                }
            }

            // Анимация пульсации активных карточек
            const activeCards = state.container.querySelectorAll('.fpt-fin-tab-pane.active .fpt-fin-card');
            activeCards.forEach(c => {
                c.classList.remove('fpt-fin-pulse-anim');
                void c.offsetWidth;
                c.classList.add('fpt-fin-pulse-anim');
            });
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
            }
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
