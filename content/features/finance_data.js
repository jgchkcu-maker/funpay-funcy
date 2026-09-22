/**
 * FunPay Funcy — Finance Data Adapter (Core + Parity Aggregations)
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
     * Преобразовать календарную дату YYYY-MM-DD в границу суток по МСК.
     * Date.parse('YYYY-MM-DD') трактует такую строку как UTC-полуночь, поэтому
     * для пользовательского диапазона дата разбирается явно и не зависит от
     * часового пояса браузера.
     *
     * @param {*} value
     * @param {boolean} endOfDay
     * @returns {number|null}
     */
    function parseMskDateBoundary(value, endOfDay) {
        if (typeof value === 'string') {
            const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const year = Number(match[1]);
                const month = Number(match[2]);
                const day = Number(match[3]);
                const utcDate = new Date(0);
                utcDate.setUTCHours(0, 0, 0, 0);
                utcDate.setUTCFullYear(year, month - 1, day);
                if (
                    utcDate.getUTCFullYear() !== year
                    || utcDate.getUTCMonth() !== month - 1
                    || utcDate.getUTCDate() !== day
                ) {
                    return null;
                }
                const start = utcDate.getTime() - MSK_OFFSET_MS;
                return endOfDay ? start + ONE_DAY_MS - 1 : start;
            }
        }
        return normalizeTimestamp(value);
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
        // T08: Never use the newest Overview source timestamp as overall freshness because it hides stale dependencies.
        // Use the oldest required source timestamp (Math.min).
        const oldestLastUpdate = timestamps.length ? Math.min(...timestamps) : null;

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
            lastUpdate: oldestLastUpdate,
            oldestLastUpdate,
            componentFreshness: {
                sales: salesLastUpdate,
                purchases: purchasesLastUpdate,
                operations: operationsLastUpdate
            }
        };

        if (type !== undefined && type !== null) {
            return Object.prototype.hasOwnProperty.call(meta, type) ? meta[type] : null;
        }
        return meta;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ЕДИНАЯ КАЛЕНДАРНАЯ МОДЕЛЬ МСК (UTC+3, без DST) (T06)
    // ─────────────────────────────────────────────────────────────────────────────

    const MSK_OFFSET_MS = 3 * 3600 * 1000;
    const ONE_DAY_MS = 24 * 3600 * 1000;

    /**
     * Извлечь компоненты даты/времени в часовом поясе МСК (UTC+3)
     * строго независимо от часового пояса операционной системы.
     * @param {number|string|Date} timestamp
     * @returns {{ year: number, month: number, day: number, hours: number, minutes: number, seconds: number, milliseconds: number, dayOfWeek: number }}
     */
    function getMskParts(timestamp) {
        const ts = normalizeTimestamp(timestamp) || 0;
        const d = new Date(ts + MSK_OFFSET_MS);
        return {
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            day: d.getUTCDate(),
            hours: d.getUTCHours(),
            minutes: d.getUTCMinutes(),
            seconds: d.getUTCSeconds(),
            milliseconds: d.getUTCMilliseconds(),
            dayOfWeek: d.getUTCDay() // 0 = вс, 1 = пн, ..., 6 = сб
        };
    }

    /**
     * Получить ключ дня в формате YYYY-MM-DD по календарю МСК.
     * @param {number|string|Date} timestamp
     * @returns {string}
     */
    function getMskDayKey(timestamp) {
        const p = getMskParts(timestamp);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    /**
     * Получить ключ месяца в формате YYYY-MM по календарю МСК.
     * @param {number|string|Date} timestamp
     * @returns {string}
     */
    function getMskMonthKey(timestamp) {
        const p = getMskParts(timestamp);
        return `${p.year}-${String(p.month).padStart(2, '0')}`;
    }

    /**
     * Получить ключ недели в формате YYYY-MM-DD (понедельник недели) по календарю МСК.
     * @param {number|string|Date} timestamp
     * @returns {string}
     */
    function getMskWeekKey(timestamp) {
        const ts = normalizeTimestamp(timestamp) || 0;
        const p = getMskParts(ts);
        // Смещение до понедельника: понедельник = 0, вторник = 1, ..., воскресенье = 6
        const dayShift = (p.dayOfWeek + 6) % 7;
        const mondayTs = ts - (dayShift * ONE_DAY_MS);
        return getMskDayKey(mondayTs);
    }

    /**
     * Форматировать дату и время по МСК (DD.MM.YYYY HH:mm или DD.MM.YYYY HH:mm:ss).
     * @param {number|string|Date} timestamp
     * @param {boolean} [includeSeconds=false]
     * @returns {string}
     */
    function formatMskDateTime(timestamp, includeSeconds = false) {
        if (!timestamp) return '—';
        const ts = normalizeTimestamp(timestamp);
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
     * @param {boolean} [options.useMsk=true] Использовать границу суток по МСК (UTC+3)
     * @returns {{ start: number|null, end: number|null, label: string, period: string }}
     */
    function resolvePeriodRange(period, options) {
        const now = (options && typeof options.now === 'number' && !isNaN(options.now))
            ? options.now
            : Date.now();
        const oneDay = ONE_DAY_MS;

        if (period && typeof period === 'object') {
            const rawStart = period.start !== undefined ? period.start : period.from;
            const rawEnd = period.end !== undefined ? period.end : period.to;
            const start = parseMskDateBoundary(rawStart, false);
            const end = parseMskDateBoundary(rawEnd, true);
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

        // Расчёт полуночи текущих суток (по умолчанию строго по МСК)
        const useMsk = (options && options.useMsk !== undefined) ? Boolean(options.useMsk) : true;
        let todayStart;
        if (useMsk) {
            todayStart = Math.floor((now + MSK_OFFSET_MS) / oneDay) * oneDay - MSK_OFFSET_MS;
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

    function isDateOnly(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    }

    function formatCustomDateLabel(value) {
        if (isDateOnly(value)) {
            const [year, month, day] = value.trim().split('-');
            return `${day}.${month}.${year}`;
        }
        return value == null || value === '' ? '…' : String(value);
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    /**
     * Разрешить предыдущий период равной длительности для сравнения KPI (T12).
     * Сравнивает текущий период с непосредственно предшествующим периодом той же продолжительности:
     * - 7 days → предыдущие 7 дней;
     * - 30 days → предыдущие 30 дней;
     * - custom Sep 10–18 → предыдущий равный диапазон дат.
     *
     * Для 'all' или бесконечных интервалов возвращает null.
     *
     * @param {string|Object} [period]
     * @param {Object} [options]
     * @param {number} [options.now]
     * @param {boolean} [options.useMsk=true] Использовать границу суток по МСК
     * @returns {{ start: number, end: number, label: string, period: string, from?: string, to?: string }|null}
     */
    function resolvePreviousPeriodRange(period, options) {
        const current = resolvePeriodRange(period, options);
        if (!current || current.period === 'all' || current.start === null) {
            return null;
        }

        const now = (options && typeof options.now === 'number' && !isNaN(options.now))
            ? options.now
            : Date.now();
        const oneDay = ONE_DAY_MS;
        const useMsk = (options && options.useMsk !== undefined) ? Boolean(options.useMsk) : true;

        // 1. Кастомный диапазон объектов с заданными границами
        if (period && typeof period === 'object') {
            if (current.start === null || current.end === null) {
                return null;
            }
            const duration = current.end - current.start + 1;
            if (duration <= 0) return null;
            const prevEnd = current.start - 1;
            const prevStart = prevEnd - duration + 1;

            const rawStart = period.start !== undefined ? period.start : period.from;
            const rawEnd = period.end !== undefined ? period.end : period.to;

            let fromKey;
            let toKey;
            let label;
            if (isDateOnly(rawStart) && isDateOnly(rawEnd)) {
                fromKey = getMskDayKey(prevStart);
                toKey = getMskDayKey(prevEnd);
                label = `${formatCustomDateLabel(fromKey)} — ${formatCustomDateLabel(toKey)}`;
            } else {
                label = 'предыдущий период';
            }

            return {
                start: prevStart,
                end: prevEnd,
                from: fromKey,
                to: toKey,
                label,
                period: 'custom'
            };
        }

        // 2. Строковые пресеты
        const p = typeof period === 'string' ? period.trim().toLowerCase() : 'all';
        let todayStart;
        if (useMsk) {
            todayStart = Math.floor((now + MSK_OFFSET_MS) / oneDay) * oneDay - MSK_OFFSET_MS;
        } else {
            const d = new Date(now);
            todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }

        switch (p) {
            case 'today':
                return {
                    start: todayStart - oneDay,
                    end: todayStart - 1,
                    label: 'вчера',
                    period: 'yesterday'
                };
            case 'yesterday':
                return {
                    start: todayStart - 2 * oneDay,
                    end: todayStart - oneDay - 1,
                    label: 'позавчера',
                    period: 'day_before_yesterday'
                };
            case '24h':
                return {
                    start: now - 2 * oneDay,
                    end: now - oneDay - 1,
                    label: 'предыдущие 24 часа',
                    period: '24h'
                };
            case '7d':
            case 'week':
                return {
                    start: now - 14 * oneDay,
                    end: now - 7 * oneDay - 1,
                    label: 'предыдущие 7 дней',
                    period: '7d'
                };
            case '30d':
            case 'month':
                return {
                    start: now - 60 * oneDay,
                    end: now - 30 * oneDay - 1,
                    label: 'предыдущие 30 дней',
                    period: '30d'
                };
            case '90d':
            case 'quarter':
                return {
                    start: now - 180 * oneDay,
                    end: now - 90 * oneDay - 1,
                    label: 'предыдущие 90 дней',
                    period: '90d'
                };
            case '365d':
            case 'year':
                return {
                    start: now - 730 * oneDay,
                    end: now - 365 * oneDay - 1,
                    label: 'предыдущий год',
                    period: '365d'
                };
            case 'all':
            case 'total':
            default:
                return null;
        }
    }

    /**
     * Форматирование дельты KPI по сравнению с предыдущим периодом (T12).
     *
     * Правила:
     * - Если предыдущее значение = 0 (или отсутствует): neutral unavailable state ('—').
     *   Категорически запрещено выводить Infinity или NaN.
     * - При положительной дельте: '+12.4% vs previous period' (positive).
     * - При отрицательной дельте: '−8.1% vs previous period' (negative, unicode minus).
     * - При нулевой дельте: '0.0% vs previous period' (neutral).
     *
     * @param {number|null} currVal
     * @param {number|null} prevVal
     * @param {Object} [options]
     * @param {string} [options.kpi]
     * @param {string} [options.id]
     * @returns {{ diff: number|null, percent: number|null, text: string, fullText: string, state: string, badgeHtml: string }}
     */
    function formatKpiComparison(currVal, prevVal, options = {}) {
        const idAttr = options.id ? ` id="${esc(options.id)}"` : '';
        const kpiAttr = options.kpi ? ` data-kpi="${esc(options.kpi)}"` : '';

        // Защита от деления на ноль и недопустимых значений (R13)
        if (
            prevVal === null || prevVal === undefined || isNaN(prevVal) ||
            currVal === null || currVal === undefined || isNaN(currVal) ||
            Math.abs(prevVal) < 1e-9
        ) {
            return {
                available: false,
                direction: 'neutral',
                diff: null,
                percent: null,
                diffPercent: null,
                text: '—',
                formattedText: '—',
                fullText: '—',
                state: 'unavailable',
                badgeHtml: ''
            };
        }

        const diff = currVal - prevVal;
        const pct = (diff / Math.abs(prevVal)) * 100;
        const rounded = Math.round(pct * 10) / 10;

        let text;
        let state;
        let direction;
        if (rounded > 0) {
            text = `+${rounded.toFixed(1)}%`;
            state = 'positive';
            direction = 'up';
        } else if (rounded < 0) {
            text = `\u2212${Math.abs(rounded).toFixed(1)}%`;
            state = 'negative';
            direction = 'down';
        } else {
            text = '0.0%';
            state = 'neutral';
            direction = 'neutral';
        }

        const fullText = `${text} к пред. периоду`;
        const badgeClass = state === 'positive'
            ? 'fpt-fin-diff-positive'
            : (state === 'negative' ? 'fpt-fin-diff-negative' : 'fpt-fin-diff-neutral');

        const badgeHtml = `<span class="fpt-fin-kpi-diff ${badgeClass}"${kpiAttr}${idAttr}><span class="fpt-fin-diff-value">${esc(text)}</span> <span class="fpt-fin-diff-label">к пред. периоду</span></span>`;

        return {
            available: true,
            direction,
            diff,
            percent: rounded,
            diffPercent: rounded,
            text,
            formattedText: fullText,
            fullText,
            state,
            badgeHtml
        };
    }

    /**
     * Сравнение ключевых показателей между текущим и предыдущим периодами (T12).
     *
     * Initial KPIs:
     * - Revenue (Выручка)
     * - Orders (Оплаченные заказы)
     * - Average check (Средний чек)
     * - Realised profit (Реализованная чистая прибыль)
     *
     * Валютные сравнения не смешивают валюты (Currency comparisons must stay within the same currency).
     *
     * @param {Object} current
     * @param {Object} [current.salesAgg]
     * @param {Object} [current.profitData]
     * @param {Object} previous
     * @param {Object} [previous.salesAgg]
     * @param {Object} [previous.profitData]
     * @param {Object} [options]
     * @param {string} [options.currency='all']
     * @param {string} [options.primaryCurrency='RUB']
     * @returns {{ revenue: Object, orders: Object, averageCheck: Object, profit: Object }}
     */
    function compareKpis(current, previous, options = {}) {
        const primaryCur = (options.currency && options.currency !== 'all')
            ? String(options.currency).toUpperCase()
            : String(options.primaryCurrency || 'RUB').toUpperCase();

        // 1. Revenue
        let revenueDiff = null;
        if (current && current.salesAgg && previous && previous.salesAgg) {
            const currByCur = current.salesAgg.byCurrency || {};
            const prevByCur = previous.salesAgg.byCurrency || {};

            if (options.currency && options.currency !== 'all') {
                const cur = String(options.currency).toUpperCase();
                const currVal = typeof currByCur[cur] === 'number' ? currByCur[cur] : null;
                const prevVal = typeof prevByCur[cur] === 'number' ? prevByCur[cur] : null;
                revenueDiff = formatKpiComparison(currVal, prevVal, { kpi: 'revenue', id: 'fptFinOverviewRevenueDiff' });
            } else {
                // currency === 'all'
                const currCurs = Object.keys(currByCur).filter(c => currByCur[c] > 0);
                const prevCurs = Object.keys(prevByCur).filter(c => prevByCur[c] > 0);

                if (currCurs.length === 1 && prevCurs.length === 1 && currCurs[0] === prevCurs[0]) {
                    const cur = currCurs[0];
                    revenueDiff = formatKpiComparison(currByCur[cur], prevByCur[cur], { kpi: 'revenue', id: 'fptFinOverviewRevenueDiff' });
                } else if (currCurs.length > 0 && currCurs.includes(primaryCur) && prevCurs.includes(primaryCur)) {
                    revenueDiff = formatKpiComparison(currByCur[primaryCur], prevByCur[primaryCur], { kpi: 'revenue', id: 'fptFinOverviewRevenueDiff' });
                } else {
                    // Разные или смешанные валюты без единой базы не смешиваются
                    revenueDiff = formatKpiComparison(null, null, { kpi: 'revenue', id: 'fptFinOverviewRevenueDiff' });
                }
            }
        } else {
            revenueDiff = formatKpiComparison(null, null, { kpi: 'revenue', id: 'fptFinOverviewRevenueDiff' });
        }

        // 2. Orders (количество оплаченных заказов)
        let ordersDiff = null;
        if (current && current.salesAgg && previous && previous.salesAgg) {
            const currCount = typeof current.salesAgg.count === 'number' ? current.salesAgg.count : null;
            const prevCount = typeof previous.salesAgg.count === 'number' ? previous.salesAgg.count : null;
            ordersDiff = formatKpiComparison(currCount, prevCount, { kpi: 'orders', id: 'fptFinOverviewOrdersDiff' });
        } else {
            ordersDiff = formatKpiComparison(null, null, { kpi: 'orders', id: 'fptFinOverviewOrdersDiff' });
        }

        // 3. Average check (средний чек в той же валюте)
        let avgCheckDiff = null;
        if (current && current.salesAgg && previous && previous.salesAgg) {
            const currAvgByCur = current.salesAgg.averageCheck || {};
            const prevAvgByCur = previous.salesAgg.averageCheck || {};

            let curToUse = null;
            if (options.currency && options.currency !== 'all') {
                curToUse = String(options.currency).toUpperCase();
            } else {
                const currCurs = Object.keys(currAvgByCur).filter(c => currAvgByCur[c] > 0);
                const prevCurs = Object.keys(prevAvgByCur).filter(c => prevAvgByCur[c] > 0);
                if (currCurs.length === 1 && prevCurs.length === 1 && currCurs[0] === prevCurs[0]) {
                    curToUse = currCurs[0];
                } else if (currCurs.length > 0 && currCurs.includes(primaryCur) && prevCurs.includes(primaryCur)) {
                    curToUse = primaryCur;
                }
            }

            if (curToUse) {
                const currAvg = typeof currAvgByCur[curToUse] === 'number' ? currAvgByCur[curToUse] : null;
                const prevAvg = typeof prevAvgByCur[curToUse] === 'number' ? prevAvgByCur[curToUse] : null;
                avgCheckDiff = formatKpiComparison(currAvg, prevAvg, { kpi: 'averageCheck', id: 'fptFinOverviewAvgCheckDiff' });
            } else {
                avgCheckDiff = formatKpiComparison(null, null, { kpi: 'averageCheck', id: 'fptFinOverviewAvgCheckDiff' });
            }
        } else {
            avgCheckDiff = formatKpiComparison(null, null, { kpi: 'averageCheck', id: 'fptFinOverviewAvgCheckDiff' });
        }

        // 4. Realised profit (чистая прибыль в той же валюте)
        let profitDiff = null;
        if (current && current.profitData && previous && previous.profitData) {
            const currProfitByCur = current.profitData.byCurrency || {};
            const prevProfitByCur = previous.profitData.byCurrency || {};

            let curToUse = null;
            if (options.currency && options.currency !== 'all') {
                curToUse = String(options.currency).toUpperCase();
            } else {
                const currCurs = Object.keys(currProfitByCur);
                const prevCurs = Object.keys(prevProfitByCur);
                if (currCurs.length === 1 && prevCurs.length === 1 && currCurs[0] === prevCurs[0]) {
                    curToUse = currCurs[0];
                } else if (currCurs.length > 0 && currCurs.includes(primaryCur) && prevCurs.includes(primaryCur)) {
                    curToUse = primaryCur;
                }
            }

            if (curToUse) {
                const currProfObj = currProfitByCur[curToUse] || null;
                const prevProfObj = prevProfitByCur[curToUse] || null;

                const currNet = currProfObj && typeof currProfObj.realisedNetProfit === 'number'
                    ? currProfObj.realisedNetProfit
                    : null;
                const prevNet = prevProfObj && typeof prevProfObj.realisedNetProfit === 'number'
                    ? prevProfObj.realisedNetProfit
                    : null;

                profitDiff = formatKpiComparison(currNet, prevNet, { kpi: 'profit', id: 'fptFinOverviewProfitDiff' });
            } else {
                profitDiff = formatKpiComparison(null, null, { kpi: 'profit', id: 'fptFinOverviewProfitDiff' });
            }
        } else {
            profitDiff = formatKpiComparison(null, null, { kpi: 'profit', id: 'fptFinOverviewProfitDiff' });
        }

        return {
            revenue: revenueDiff,
            orders: ordersDiff,
            averageCheck: avgCheckDiff,
            profit: profitDiff
        };
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
        // Веса для нормализации к единой оси графика в legacy sales_modes.js (deprecated, Finance Hub не использует их):
        const legacyRates = { RUB: 0.011, USD: 1, EUR: 1.08 };

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

        const currenciesPresent = new Set();
        for (const o of list) {
            const st = o.orderStatus || 'unknown';
            if (st === 'closed' || st === 'paid') {
                currenciesPresent.add(String(o.currency || 'UNKNOWN').toUpperCase());
            }
        }
        const isSingleCurrency = currenciesPresent.size === 1;
        const singleCur = isSingleCurrency ? [...currenciesPresent][0] : null;
        const targetCur = (options && options.currency && options.currency !== 'all')
            ? String(options.currency).toUpperCase()
            : (isSingleCurrency ? singleCur : null);
        const isMultiCurrency = !targetCur && currenciesPresent.size > 1;

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

            // Посуточный ключ YYYY-MM-DD по МСК
            const ts = typeof o.orderDate === 'number' ? o.orderDate : (normalizeTimestamp(o.orderDate) || 0);
            const dayKey = getMskDayKey(ts);
            if (!byDay[dayKey]) {
                byDay[dayKey] = {
                    count: 0,
                    total: 0,
                    validCount: 0,
                    revenue: isMultiCurrency ? null : 0,
                    revenueByCurrency: {},
                    statusCounts: {},
                    isMultiCurrency
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
                pendingRevenueRUB += price * (legacyRates[cur] || 0) / legacyRates.RUB;
            } else if (st === 'refunded') {
                refundedRevenue[cur] = (refundedRevenue[cur] || 0) + price;
            }

            // Учёт действительной выручки (closed + paid)
            if (valid) {
                count++;
                byCurrency[cur] = (byCurrency[cur] || 0) + price;
                currencyValidOrderCount[cur] = (currencyValidOrderCount[cur] || 0) + 1;
                revenueUSD += price * (legacyRates[cur] || 0);

                byDay[dayKey].validCount++;
                if (targetCur && cur === targetCur) {
                    byDay[dayKey].revenue = (byDay[dayKey].revenue || 0) + price;
                }
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
            isMultiCurrency,
            currency: targetCur,
            currencies: Array.from(currenciesPresent),
            // Deprecated legacy fields preserved for older sales_modes.js:
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

        const includeNonComplete = options && options.includeNonComplete === true;
        const effectiveList = includeNonComplete
            ? all
            : all.filter(t => t.status === 'complete');

        const effectiveCurrencies = new Set();
        for (const t of effectiveList) {
            effectiveCurrencies.add(String(t.currency || 'UNKNOWN').toUpperCase());
        }
        const isSingleCurrency = effectiveCurrencies.size === 1;
        const singleCur = isSingleCurrency ? [...effectiveCurrencies][0] : null;
        const targetCur = (options && options.currency && options.currency !== 'all')
            ? String(options.currency).toUpperCase()
            : (isSingleCurrency ? singleCur : null);
        const isMultiCurrency = !targetCur && effectiveCurrencies.size > 1;

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
            const mk = getMskMonthKey(ts);
            const dk = getMskDayKey(ts);

            if (!byMonth[mk]) {
                byMonth[mk] = {
                    in: isMultiCurrency ? null : 0,
                    out: isMultiCurrency ? null : 0,
                    inByCur: {},
                    outByCur: {},
                    netByCur: {},
                    count: 0,
                    isMultiCurrency
                };
            }
            if (!byDay[dk]) {
                byDay[dk] = {
                    in: isMultiCurrency ? null : 0,
                    out: isMultiCurrency ? null : 0,
                    inByCur: {},
                    outByCur: {},
                    netByCur: {},
                    count: 0,
                    isMultiCurrency
                };
            }

            byMonth[mk].count++;
            byDay[dk].count++;

            if (signed >= 0) {
                if (targetCur && cur === targetCur) {
                    byMonth[mk].in = (byMonth[mk].in || 0) + absVal;
                    byDay[dk].in = (byDay[dk].in || 0) + absVal;
                }
                byMonth[mk].inByCur[cur] = (byMonth[mk].inByCur[cur] || 0) + absVal;
                byDay[dk].inByCur[cur] = (byDay[dk].inByCur[cur] || 0) + absVal;
            } else {
                if (targetCur && cur === targetCur) {
                    byMonth[mk].out = (byMonth[mk].out || 0) + absVal;
                    byDay[dk].out = (byDay[dk].out || 0) + absVal;
                }
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
            total: all.length,
            isMultiCurrency,
            currency: targetCur,
            currencies: Array.from(effectiveCurrencies)
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

        // Методы фильтрации и нормализации (T02B + T12)
        resolvePeriodRange,
        resolvePreviousPeriodRange,
        formatKpiComparison,
        compareKpis,
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
        aggregateProfit,

        // Единая календарная модель МСК (T06)
        MSK_OFFSET_MS,
        ONE_DAY_MS,
        getMskParts,
        getMskDayKey,
        getMskMonthKey,
        getMskWeekKey,
        formatMskDateTime
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
