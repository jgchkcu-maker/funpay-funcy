// Pure helpers for the Finance Hub screen: money formatting, chart series, rankings and period deltas.
// No DOM access, so the module can be unit-tested in Node and reused by the page and chart code.
(function (root) {
    'use strict';

    const MSK_OFFSET_MS = 3 * 3600 * 1000;
    const ONE_DAY_MS = 24 * 3600 * 1000;
    const SYMBOLS = Object.freeze({ RUB: '₽', USD: '$', EUR: '€', UAH: '₴', KZT: '₸', BYN: 'Br' });
    const CURRENCY_ORDER = Object.freeze(['RUB', 'USD', 'EUR']);
    const MONTHS = Object.freeze(['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']);
    const PERIODS = Object.freeze([
        { id: 'today', label: 'Сегодня' },
        { id: '7d', label: '7 дней' },
        { id: '30d', label: '30 дней' },
        { id: '90d', label: '90 дней' },
        { id: '365d', label: 'Год' },
        { id: 'all', label: 'Всё время' },
        { id: 'custom', label: 'Свой период' }
    ]);
    const OPERATION_TYPE_LABELS = Object.freeze({
        order: 'Заказы',
        payment: 'Пополнения',
        withdraw: 'Выводы',
        withdraw_cancel: 'Отмена вывода',
        other: 'Прочее'
    });
    const STATUS_LABELS = Object.freeze({
        closed: 'Закрыт', paid: 'Оплачен', refunded: 'Возврат',
        complete: 'Завершено', cancel: 'Отменено', waiting: 'Ожидание'
    });

    const isNum = value => typeof value === 'number' && Number.isFinite(value);
    const pad = value => String(value).padStart(2, '0');

    function currencySymbol(currency) {
        const code = String(currency || 'RUB').toUpperCase();
        return SYMBOLS[code] || code;
    }

    function formatNumber(value, { maxFraction = 2 } = {}) {
        if (!isNum(value)) return '—';
        const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
        const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 1e-6;
        return rounded.toLocaleString('ru-RU', {
            minimumFractionDigits: hasFraction ? Math.min(2, maxFraction) : 0,
            maximumFractionDigits: maxFraction
        });
    }

    function formatMoney(value, currency) {
        if (!isNum(value)) return '—';
        return `${formatNumber(value)} ${currencySymbol(currency)}`;
    }

    // Axis-friendly short form: 1 250 -> 1,3 тыс., 2 400 000 -> 2,4 млн.
    function formatCompact(value) {
        if (!isNum(value)) return '—';
        const abs = Math.abs(value);
        const sign = value < 0 ? '−' : '';
        const short = (n, suffix) => `${sign}${(Math.round(n * 10) / 10).toLocaleString('ru-RU')} ${suffix}`;
        if (abs >= 1e9) return short(abs / 1e9, 'млрд');
        if (abs >= 1e6) return short(abs / 1e6, 'млн');
        if (abs >= 1e4) return short(abs / 1e3, 'тыс.');
        return `${sign}${Math.round(abs).toLocaleString('ru-RU')}`;
    }

    function formatPercent(value, digits = 1) {
        if (!isNum(value)) return '—';
        const fixed = value.toFixed(digits).replace('.', ',');
        return `${fixed}%`;
    }

    function formatSigned(value, currency) {
        if (!isNum(value)) return '—';
        if (Math.abs(value) < 0.005) return formatMoney(0, currency);
        return `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value), currency)}`;
    }

    function plural(count, forms) {
        const abs = Math.abs(Number(count) || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return forms[2];
        if (rem > 1 && rem < 5) return forms[1];
        if (rem === 1) return forms[0];
        return forms[2];
    }

    function countLabel(count, forms) {
        return `${(Number(count) || 0).toLocaleString('ru-RU')} ${plural(count, forms)}`;
    }

    // --- Calendar (MSK, no DST) ------------------------------------------------------------
    function mskParts(timestamp) {
        const d = new Date(Number(timestamp) + MSK_OFFSET_MS);
        return {
            year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
            hours: d.getUTCHours(), minutes: d.getUTCMinutes(), dow: d.getUTCDay()
        };
    }
    const dayKey = ts => { const p = mskParts(ts); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
    const monthKey = ts => { const p = mskParts(ts); return `${p.year}-${pad(p.month)}`; };
    function weekKey(ts) {
        const p = mskParts(ts);
        return dayKey(ts - ((p.dow + 6) % 7) * ONE_DAY_MS);
    }
    function keyToTs(key) {
        const [y, m, d] = key.split('-').map(Number);
        return Date.UTC(y, m - 1, d || 1) - MSK_OFFSET_MS;
    }
    function nextKey(key, step) {
        const ts = keyToTs(key);
        if (step === 'month') {
            const [y, m] = key.split('-').map(Number);
            return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
        }
        return dayKey(ts + (step === 'week' ? 7 : 1) * ONE_DAY_MS);
    }
    function formatDateTime(ts) {
        if (!isNum(ts) || ts <= 0) return '—';
        const p = mskParts(ts);
        return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hours)}:${pad(p.minutes)}`;
    }
    function formatShortDate(ts) {
        if (!isNum(ts) || ts <= 0) return '—';
        const p = mskParts(ts);
        return `${pad(p.day)}.${pad(p.month)} ${pad(p.hours)}:${pad(p.minutes)}`;
    }
    function bucketLabel(key, step, full) {
        const [y, m, d] = key.split('-').map(Number);
        if (step === 'month') return full ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
        if (step === 'week') return full ? `Неделя с ${pad(d)}.${pad(m)}` : `${pad(d)}.${pad(m)}`;
        return full ? `${d} ${MONTHS[m - 1]} ${y}` : `${pad(d)}.${pad(m)}`;
    }
    function orderTimestamp(order) {
        const raw = order && (order.orderDate ?? order.date);
        if (isNum(raw)) return raw;
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    // --- Currencies -----------------------------------------------------------------------
    function sortCurrencies(list) {
        return Array.from(new Set(list.map(c => String(c).toUpperCase())))
            .sort((a, b) => {
                const ia = CURRENCY_ORDER.indexOf(a); const ib = CURRENCY_ORDER.indexOf(b);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
            });
    }

    // Chooses the one currency charts are drawn in. A selected currency wins; otherwise the
    // currency with the largest revenue. Amounts in different currencies are never summed.
    function pickCurrency(selected, byCurrency, fallbackList) {
        if (selected && selected !== 'all') return String(selected).toUpperCase();
        const entries = Object.entries(byCurrency || {}).filter(([, v]) => isNum(v));
        if (entries.length) return entries.sort((a, b) => b[1] - a[1])[0][0];
        const list = sortCurrencies(fallbackList || []);
        return list[0] || 'RUB';
    }

    // "1 200 ₽ · 15 $" for a currency map, skipping empty entries.
    function formatCurrencyMap(map, { signed = false } = {}) {
        const parts = sortCurrencies(Object.keys(map || {}))
            .filter(cur => isNum(map[cur]) && Math.abs(map[cur]) > 0.005)
            .map(cur => (signed ? formatSigned(map[cur], cur) : formatMoney(map[cur], cur)));
        return parts.length ? parts.join(' · ') : '';
    }

    // --- Periods ----------------------------------------------------------------------------
    function periodLabel(period) {
        if (period && typeof period === 'object') return period.label || 'Свой период';
        const found = PERIODS.find(item => item.id === period);
        return found ? found.label : 'Всё время';
    }

    function chooseStep(period, orders) {
        if (period === 'today' || period === 'yesterday' || period === '24h' || period === '7d' || period === '30d') return 'day';
        if (period === '90d') return 'week';
        if (period === '365d') return 'month';
        const stamps = (orders || []).map(orderTimestamp).filter(Boolean);
        if (!stamps.length) return 'day';
        const spanDays = (Math.max(...stamps) - Math.min(...stamps)) / ONE_DAY_MS;
        if (spanDays > 150) return 'month';
        if (spanDays > 45) return 'week';
        return 'day';
    }

    // --- Series ----------------------------------------------------------------------------
    const keyFor = (ts, step) => (step === 'month' ? monthKey(ts) : step === 'week' ? weekKey(ts) : dayKey(ts));

    function fillGaps(buckets, step, make) {
        const keys = Array.from(buckets.keys()).sort();
        if (!keys.length) return [];
        const result = [];
        let key = keys[0];
        const last = keys[keys.length - 1];
        for (let guard = 0; key <= last && guard < 800; guard++) {
            result.push(buckets.get(key) || make(key));
            key = nextKey(key, step);
        }
        return result;
    }

    // Revenue / order count / realised profit per bucket for orders in one currency.
    // Valid orders are closed or paid; profit comes from profitInfo when present.
    function buildSalesSeries(orders, { step = 'day', currency } = {}) {
        const buckets = new Map();
        const make = key => ({ key, label: bucketLabel(key, step), fullLabel: bucketLabel(key, step, true),
            revenue: 0, count: 0, profit: null, refunded: 0 });
        for (const order of orders || []) {
            const status = String(order.orderStatus || order.status || '').toLowerCase();
            const cur = String(order.currency || 'RUB').toUpperCase();
            if (currency && cur !== String(currency).toUpperCase()) continue;
            const ts = orderTimestamp(order);
            if (!ts) continue;
            const key = keyFor(ts, step);
            const bucket = buckets.get(key) || make(key);
            buckets.set(key, bucket);
            if (status === 'refunded') { bucket.refunded += 1; continue; }
            if (status !== 'closed' && status !== 'paid') continue;
            bucket.revenue += Number(order.price) || 0;
            bucket.count += 1;
            const info = order.profitInfo;
            if (info && info.hasCost && isNum(info.netProfit) && !info.isRefunded) {
                bucket.profit = (bucket.profit || 0) + info.netProfit;
            }
        }
        const series = fillGaps(buckets, step, make);
        series.step = step;
        return series;
    }

    function buildOperationSeries(operations, { currency, step = 'month' } = {}) {
        const buckets = new Map();
        const make = key => ({ key, label: bucketLabel(key, step), fullLabel: bucketLabel(key, step, true), in: 0, out: 0, net: 0, count: 0 });
        for (const op of operations || []) {
            const cur = String(op.currency || 'UNKNOWN').toUpperCase();
            if (currency && cur !== String(currency).toUpperCase()) continue;
            const ts = isNum(op.date) ? op.date : Date.parse(op.date) || 0;
            if (!ts) continue;
            const signed = isNum(op.signed) ? op.signed : Number(op.amount) || 0;
            const key = keyFor(ts, step);
            const bucket = buckets.get(key) || make(key);
            buckets.set(key, bucket);
            if (signed >= 0) bucket.in += signed; else bucket.out += Math.abs(signed);
            bucket.net += signed;
            bucket.count += 1;
        }
        const series = fillGaps(buckets, step, make);
        series.step = step;
        return series;
    }

    // --- Rankings --------------------------------------------------------------------------
    function groupBy(orders, currency, nameOf) {
        const map = new Map();
        for (const order of orders || []) {
            const status = String(order.orderStatus || order.status || '').toLowerCase();
            if (status !== 'closed' && status !== 'paid') continue;
            if (currency && String(order.currency || 'RUB').toUpperCase() !== String(currency).toUpperCase()) continue;
            const name = String(nameOf(order) || '').trim() || '—';
            const row = map.get(name) || { name, count: 0, revenue: 0 };
            row.count += 1;
            row.revenue += Number(order.price) || 0;
            map.set(name, row);
        }
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.count - a.count);
    }

    const rankByCategory = (orders, currency) => groupBy(orders, currency, o => o.subcategoryName || o.category || 'Без категории');
    const rankByProduct = (orders, currency) => groupBy(orders, currency, o => o.description || o.title);
    const rankByCounterparty = (orders, currency) => groupBy(orders, currency, o => o.buyerUsername || o.sellerUsername || o.sellerName);

    // Top-N slices with the tail folded into one neutral "Прочее" entry.
    function foldTail(rows, limit, valueKey = 'revenue') {
        const total = rows.reduce((sum, row) => sum + (row[valueKey] || 0), 0);
        const head = rows.slice(0, limit).map(row => ({ ...row, share: total > 0 ? (row[valueKey] || 0) / total : 0 }));
        const tail = rows.slice(limit);
        if (tail.length) {
            const value = tail.reduce((sum, row) => sum + (row[valueKey] || 0), 0);
            const count = tail.reduce((sum, row) => sum + (row.count || 0), 0);
            head.push({ name: 'Прочее', count, [valueKey]: value, share: total > 0 ? value / total : 0, folded: tail.length });
        }
        return { rows: head, total };
    }

    // --- Deltas ----------------------------------------------------------------------------
    // Change against the previous period. Unavailable (no baseline) is explicit, never 0 or Infinity.
    function delta(current, previous) {
        if (!isNum(current) || !isNum(previous) || Math.abs(previous) < 1e-9) {
            return { state: 'na', percent: null, text: '' };
        }
        const percent = ((current - previous) / Math.abs(previous)) * 100;
        if (Math.abs(percent) < 0.05) return { state: 'flat', percent: 0, text: '0%' };
        const state = percent > 0 ? 'up' : 'down';
        const digits = Math.abs(percent) >= 100 ? 0 : 1;
        return { state, percent, text: `${percent > 0 ? '+' : '−'}${Math.abs(percent).toFixed(digits).replace('.', ',')}%` };
    }

    function averageCheck(revenue, count) {
        return isNum(revenue) && count > 0 ? revenue / count : null;
    }

    // Compact table of nice y-axis ticks: returns { max, ticks }.
    function niceScale(maxValue, tickCount = 4) {
        const max = isNum(maxValue) && maxValue > 0 ? maxValue : 1;
        const rough = max / tickCount;
        const pow = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm = rough / pow;
        const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * pow;
        const niceMax = Math.ceil(max / step) * step;
        const ticks = [];
        for (let v = 0; v <= niceMax + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
        return { max: niceMax, ticks };
    }

    const api = Object.freeze({
        PERIODS, SYMBOLS, OPERATION_TYPE_LABELS, STATUS_LABELS,
        currencySymbol, formatNumber, formatMoney, formatCompact, formatPercent, formatSigned,
        formatCurrencyMap, plural, countLabel, formatDateTime, formatShortDate,
        dayKey, monthKey, weekKey, bucketLabel, orderTimestamp,
        sortCurrencies, pickCurrency, periodLabel, chooseStep,
        buildSalesSeries, buildOperationSeries,
        rankByCategory, rankByProduct, rankByCounterparty, foldTail,
        delta, averageCheck, niceScale
    });
    root.FPTFinanceModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
