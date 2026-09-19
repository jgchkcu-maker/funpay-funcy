/**
 * FunPay Funcy — Finance Hub Controller (FPTFinanceHub)
 * 
 * Управляет логикой и рендерингом страниц Finance Hub:
 * - Обзор (Overview)
 * - Продажи (Sales)
 * - Покупки (Purchases)
 * - Операции (Operations)
 * 
 * Взаимодействует с FPTFinanceData для получения данных.
 */

(function (root) {
    'use strict';

    const PALETTE = [
        '#1b75bb', '#0891b2', '#059669', '#d97706', '#dc2626',
        '#0ea5e9', '#db2777', '#65a30d', '#14b8a6', '#8b5cf6'
    ];

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function fmtMoney(amount, cur) {
        if (root.FPTFinanceData && typeof root.FPTFinanceData.formatMoney === 'function') {
            return root.FPTFinanceData.formatMoney(amount, cur);
        }
        const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₽';
        return `${Math.round(Number(amount) || 0).toLocaleString('ru-RU')} ${sym}`;
    }

    function fmtRevenueMulti(revObj) {
        if (!revObj) return '0 ₽';
        const parts = [];
        if (revObj.RUB) parts.push(`${Math.round(revObj.RUB).toLocaleString('ru-RU')} ₽`);
        if (revObj.USD) parts.push(`${Math.round(revObj.USD).toLocaleString('ru-RU')} $`);
        if (revObj.EUR) parts.push(`${Math.round(revObj.EUR).toLocaleString('ru-RU')} €`);
        return parts.length ? parts.join(' · ') : '0 ₽';
    }

    // ── СОСТОЯНИЕ ХАБА ────────────────────────────────────────────────────────
    const state = {
        activeTab: 'overview',
        period: '7d',
        loading: {
            overview: false,
            sales: false,
            purchases: false,
            operations: false
        },
        sales: {
            statusFilter: { stClosed: true, stPaid: true, stRefunded: true },
            sort: 'date-desc',
            search: '',
            chartMetric: 'revenue', // 'revenue' | 'count'
            donutMetric: 'category', // 'category' | 'status' | 'currency'
            visibleOrdersCount: 20
        },
        purchases: {
            statusFilter: { stClosed: true, stPaid: true, stRefunded: false },
            sort: 'date-desc',
            search: '',
            chartMetric: 'spent', // 'spent' | 'count'
            donutMetric: 'category',
            visibleOrdersCount: 20
        },
        operations: {
            typeFilter: 'all',
            sort: 'date-desc',
            search: '',
            chartInterval: 'month', // 'month' | 'day'
            visibleCount: 20
        },
        overview: {
            chartMetric: 'revenue'
        },
        storageListenerBound: false
    };

    function getContainer() {
        return document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
    }

    function getPane(tabName) {
        const c = getContainer();
        return c ? c.querySelector(`.fpt-fin-tab-pane[data-subtab="${tabName}"]`) : null;
    }

    // ── SVG РЕНДЕРЕРЫ: ГРАФИКИ И ДИАГРАММЫ ─────────────────────────────────────

    function catmullRom2bezier(pts) {
        let d = `M${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i === 0 ? 0 : i - 1];
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
        if (v >= 1000000) return (Math.round(v / 100000) / 10) + 'М';
        if (v >= 1000) return (Math.round(v / 100) / 10) + 'к';
        return String(Math.round(v));
    }

    function renderLineChartSVG(days, byDayData, metricKey, isMoney) {
        if (!days.length) {
            return `<div class="fpt-fin-chart-empty">Нет данных за выбранный период</div>`;
        }

        const vals = days.map(d => byDayData[d] ? (byDayData[d][metricKey] || 0) : 0);
        const maxVal = niceMax(Math.max(1, ...vals));

        const W = 680, H = 220, PAD = { t: 20, r: 20, b: 35, l: 55 };
        const cw = W - PAD.l - PAD.r;
        const ch = H - PAD.t - PAD.b;
        const slot = cw / Math.max(days.length - 1, 1);
        const baseY = PAD.t + ch;

        // Сетка и подписи Y
        let grid = '', yLabels = '';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const y = baseY - (i / steps) * ch;
            grid += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--fptm-border, rgba(255,255,255,0.08))" stroke-width="1" />`;
            const v = (maxVal / steps) * i;
            yLabels += `<text x="${PAD.l - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--fptm-muted, #9099b8)">${isMoney ? fmtAxis(v) : Math.round(v)}</text>`;
        }

        // Точки линии
        const pts = days.map((d, i) => ({
            x: PAD.l + (days.length === 1 ? cw / 2 : i * slot),
            y: baseY - ((byDayData[d] ? byDayData[d][metricKey] || 0 : 0) / maxVal) * ch,
            day: d,
            val: byDayData[d] ? byDayData[d][metricKey] || 0 : 0
        }));

        let pathD = '', areaD = '';
        if (pts.length === 1) {
            pathD = `M${PAD.l},${pts[0].y} L${W - PAD.r},${pts[0].y}`;
            areaD = `M${PAD.l},${pts[0].y} L${W - PAD.r},${pts[0].y} L${W - PAD.r},${baseY} L${PAD.l},${baseY} Z`;
        } else {
            pathD = catmullRom2bezier(pts);
            areaD = `${pathD} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;
        }

        // Подписи X
        let xLabels = '';
        const stepX = Math.ceil(days.length / 8);
        days.forEach((d, i) => {
            if (i % stepX === 0 || i === days.length - 1) {
                const x = PAD.l + (days.length === 1 ? cw / 2 : i * slot);
                const label = d.slice(5); // MM-DD
                xLabels += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--fptm-muted, #9099b8)">${label}</text>`;
            }
        });

        // Интерактивные точки
        let interactiveDots = '';
        pts.forEach(p => {
            const labelVal = isMoney ? fmtMoney(p.val, 'RUB') : `${p.val} зак.`;
            interactiveDots += `
                <g class="fpt-fin-chart-pt" tabindex="0">
                    <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--fptm-accent, #1b75bb)" stroke="#ffffff" stroke-width="2" />
                    <title>${p.day}: ${labelVal}</title>
                </g>
            `;
        });

        return `
            <svg class="fpt-fin-svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible;">
                <defs>
                    <linearGradient id="fptFinAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--fptm-accent, #1b75bb)" stop-opacity="0.35" />
                        <stop offset="100%" stop-color="var(--fptm-accent, #1b75bb)" stop-opacity="0.0" />
                    </linearGradient>
                </defs>
                ${grid}
                ${yLabels}
                ${xLabels}
                <path d="${areaD}" fill="url(#fptFinAreaGrad)" />
                <path d="${pathD}" fill="none" stroke="var(--fptm-accent, #1b75bb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                ${interactiveDots}
            </svg>
        `;
    }

    function renderDonutSVG(title, entries, fmtVal) {
        const total = entries.reduce((s, e) => s + (e.value || 0), 0);
        if (!total) {
            return `
                <div class="fpt-fin-donut-box">
                    <div class="fpt-fin-card-title">${esc(title)}</div>
                    <div style="padding:24px;text-align:center;color:var(--fptm-muted,#9099b8);font-size:12px;">Нет данных</div>
                </div>
            `;
        }

        const cx = 65, cy = 65, r = 50, rin = 30;
        let acc = 0, paths = '', legend = '';
        const topEntries = entries.slice(0, 6);

        topEntries.forEach((e, i) => {
            const frac = e.value / total;
            const a0 = acc * 2 * Math.PI - Math.PI / 2;
            acc += frac;
            const a1 = acc * 2 * Math.PI - Math.PI / 2;
            const large = frac > 0.5 ? 1 : 0;

            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const xi1 = cx + rin * Math.cos(a1), yi1 = cy + rin * Math.sin(a1);
            const xi0 = cx + rin * Math.cos(a0), yi0 = cy + rin * Math.sin(a0);

            const col = PALETTE[i % PALETTE.length];
            const valStr = fmtVal ? fmtVal(e.value) : String(e.value);
            const ttVal = `${valStr} (${Math.round(frac * 100)}%)`;

            paths += `<path class="fpt-fin-donut-seg" d="M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${rin},${rin} 0 ${large} 0 ${xi0},${yi0} Z" fill="${col}">
                <title>${esc(e.label)}: ${esc(ttVal)}</title>
            </path>`;

            legend += `
                <div class="fpt-fin-donut-leg-row">
                    <span class="fpt-fin-donut-dot" style="background:${col}"></span>
                    <span class="fpt-fin-donut-label" title="${esc(e.label)}">${esc(e.label)}</span>
                    <span class="fpt-fin-donut-val">${Math.round(frac * 100)}%</span>
                </div>
            `;
        });

        return `
            <div class="fpt-fin-donut-box">
                <div class="fpt-fin-card-title">${esc(title)}</div>
                <div class="fpt-fin-donut-content">
                    <svg class="fpt-fin-donut-svg" viewBox="0 0 130 130" width="130" height="130">
                        ${paths}
                        <text x="65" y="70" text-anchor="middle" font-size="13" font-weight="700" fill="var(--fptm-text, #fff)">${total}</text>
                    </svg>
                    <div class="fpt-fin-donut-legend">${legend}</div>
                </div>
            </div>
        `;
    }

    // ── РЕНДЕРИНГ ВКЛАДКИ «ПРОДАЖИ» ──────────────────────────────────────────

    async function renderSales() {
        const pane = getPane('sales');
        if (!pane) return;

        state.loading.sales = true;

        const dataLayer = root.FPTFinanceData;
        if (!dataLayer) {
            pane.innerHTML = `<div class="fpt-fin-empty-state"><p class="fpt-fin-empty-desc">Служба данных не загружена</p></div>`;
            state.loading.sales = false;
            return;
        }

        const period = state.period || '7d';
        const salesFilter = state.sales.statusFilter;
        const search = state.sales.search;
        const sort = state.sales.sort;

        const { orders, count, totalCount } = await dataLayer.getSales({
            period,
            statusFilter: salesFilter,
            search,
            sort
        });

        const agg = dataLayer.aggregateSales(orders);
        state.loading.sales = false;

        // Если вообще нет данных в базе
        if (totalCount === 0) {
            pane.innerHTML = `
                <div class="fpt-fin-empty-state">
                    <span class="material-symbols-rounded fpt-fin-empty-icon">payments</span>
                    <h4 class="fpt-fin-empty-title">Заказы продаж не найдены</h4>
                    <p class="fpt-fin-empty-desc">Нажмите кнопку «Обновить» вверху, чтобы синхронизировать историю заказов с FunPay, или перейдите в раздел продаж.</p>
                    <button type="button" class="btn btn-primary fpt-fin-btn" id="fptFinSalesInitialSyncBtn">
                        <span class="material-symbols-rounded">sync</span>
                        <span>Синхронизировать продажи</span>
                    </button>
                </div>
            `;
            const syncBtn = pane.querySelector('#fptFinSalesInitialSyncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => refresh());
            }
            return;
        }

        // Дни для графика
        const days = Object.keys(agg.byDay).sort();
        const chartMetric = state.sales.chartMetric; // 'revenue' | 'count'
        const isMoneyMetric = chartMetric === 'revenue';

        // Диаграмма
        const donutMetric = state.sales.donutMetric;
        let donutTitle = 'Продажи по категориям';
        let donutEntries = [];
        let donutFmt = null;

        if (donutMetric === 'category') {
            donutTitle = 'Продажи по категориям';
            donutEntries = Object.entries(agg.byCategory)
                .map(([k, v]) => ({ label: k, value: v.count }))
                .sort((a, b) => b.value - a.value);
        } else if (donutMetric === 'status') {
            donutTitle = 'Заказы по статусам';
            const stLabels = { closed: 'Закрыт', paid: 'Оплачен', refunded: 'Возврат' };
            donutEntries = Object.entries(agg.byStatus)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ label: stLabels[k] || k, value: v }))
                .sort((a, b) => b.value - a.value);
        } else {
            donutTitle = 'Выручка по валютам';
            donutEntries = Object.entries(agg.totalRevenue)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ label: k, value: Math.round(v) }))
                .sort((a, b) => b.value - a.value);
            donutFmt = (v) => `${v.toLocaleString('ru-RU')}`;
        }

        // Топ покупателей
        const topBuyers = Object.values(agg.byBuyer)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Топ товаров
        const topProducts = Object.entries(agg.byProduct)
            .map(([desc, d]) => ({ desc, count: d.count, revenue: d.revenue }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Список заказов (ограниченный видимым количеством)
        const visibleOrders = orders.slice(0, state.sales.visibleOrdersCount);

        pane.innerHTML = `
            <!-- Фильтры и поиск -->
            <div class="fpt-fin-toolbar">
                <div class="fpt-fin-filter-group">
                    <button type="button" class="fpt-fin-filter-chip ${salesFilter.stClosed ? 'active' : ''}" data-st="closed">
                        <span class="material-symbols-rounded">check_circle</span> Закрытые
                    </button>
                    <button type="button" class="fpt-fin-filter-chip ${salesFilter.stPaid ? 'active' : ''}" data-st="paid">
                        <span class="material-symbols-rounded">schedule</span> В ожидании
                    </button>
                    <button type="button" class="fpt-fin-filter-chip ${salesFilter.stRefunded ? 'active' : ''}" data-st="refunded">
                        <span class="material-symbols-rounded">assignment_return</span> Возвраты
                    </button>
                </div>
                <div class="fpt-fin-search-box">
                    <span class="material-symbols-rounded fpt-fin-search-icon">search</span>
                    <input type="text" class="fpt-fin-search-input" id="fptFinSalesSearch" placeholder="Поиск по товару, покупателю, ID..." value="${esc(search)}" autocomplete="off" />
                    ${search ? `<button type="button" class="fpt-fin-search-clear" id="fptFinSalesSearchClear">×</button>` : ''}
                </div>
            </div>

            <!-- Сетка KPI -->
            <div class="fpt-fin-grid">
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-drill="revenue" title="Кликните для просмотра заказов">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Выручка от продаж</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">payments</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.totalRevenue)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Закрыто: ${agg.totalClosed}</span>
                            ${agg.totalPending > 0 ? `<span>· Ожидают: ${agg.totalPending}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-drill="orders" title="Кликните для просмотра заказов">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Оплачено заказов</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, #1b75bb);">check_circle</span>
                        </div>
                        <div class="fpt-fin-card-value">${agg.totalOrders}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Уник. покупателей: ${agg.uniqueBuyersCount}</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Средний чек</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.averageCheck)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>По всем оплаченным</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-drill="refunded" title="Кликните для просмотра возвратов">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Возвраты</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#f4c84a;">assignment_return</span>
                        </div>
                        <div class="fpt-fin-card-value">${agg.totalRefunded}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Сумма: ${fmtRevenueMulti(agg.refundedRevenue)}</span>
                        </div>
                    </div>
                </div>

                <!-- График продаж и Диаграмма -->
                <div class="fpt-fin-col-8">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Динамика продаж</h5>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'revenue' ? 'active' : ''}" data-metric="revenue">Выручка</button>
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'count' ? 'active' : ''}" data-metric="count">Заказы</button>
                            </div>
                        </div>
                        <div class="fpt-fin-chart-wrap" style="height:220px;position:relative;">
                            ${renderLineChartSVG(days, agg.byDay, chartMetric, isMoneyMetric)}
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-4">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Структура</h5>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'category' ? 'active' : ''}" data-donut="category">Категории</button>
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'status' ? 'active' : ''}" data-donut="status">Статусы</button>
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'currency' ? 'active' : ''}" data-donut="currency">Валюты</button>
                            </div>
                        </div>
                        ${renderDonutSVG(donutTitle, donutEntries, donutFmt)}
                    </div>
                </div>

                <!-- Топы покупателей и товаров -->
                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Топ покупателей</h5>
                            <span class="fpt-fin-card-sub">${topBuyers.length} лидеров</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Покупатель</th>
                                        <th style="text-align:right;">Заказов</th>
                                        <th style="text-align:right;">Выручка</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topBuyers.length ? topBuyers.map((b, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td>
                                                <a href="${b.id ? `https://funpay.com/users/${b.id}/` : '#'}" target="_blank" class="fpt-fin-user-link">
                                                    ${esc(b.username)}
                                                </a>
                                            </td>
                                            <td style="text-align:right;">
                                                <button type="button" class="fpt-fin-mini-badge-btn" data-drill-buyer="${esc(b.username)}" title="Показать заказы покупателя">
                                                    ${b.count} зак.
                                                </button>
                                            </td>
                                            <td style="text-align:right;font-weight:600;">${fmtMoney(b.revenue, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Топ товаров</h5>
                            <span class="fpt-fin-card-sub">${topProducts.length} позиций</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Товар</th>
                                        <th style="text-align:right;">Продано</th>
                                        <th style="text-align:right;">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topProducts.length ? topProducts.map((p, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td class="fpt-fin-desc-cell" title="${esc(p.desc)}">${esc(p.desc)}</td>
                                            <td style="text-align:right;">
                                                <button type="button" class="fpt-fin-mini-badge-btn" data-drill-product="${esc(p.desc)}" title="Показать заказы товара">
                                                    ${p.count} раз
                                                </button>
                                            </td>
                                            <td style="text-align:right;font-weight:600;">${fmtMoney(p.revenue, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Таблица детальных заказов -->
                <div class="fpt-fin-col-12">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <h5 class="fpt-fin-card-title">Детализация заказов</h5>
                                <span class="fpt-fin-mini-badge">Показано ${visibleOrders.length} из ${orders.length}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <select class="fpt-fin-sort-select" id="fptFinSalesSortSelect" aria-label="Сортировка">
                                    <option value="date-desc" ${sort === 'date-desc' ? 'selected' : ''}>Сначала новые</option>
                                    <option value="date-asc" ${sort === 'date-asc' ? 'selected' : ''}>Сначала старые</option>
                                    <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Дороже сверху</option>
                                    <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Дешевле сверху</option>
                                </select>
                            </div>
                        </div>

                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>Заказ</th>
                                        <th>Товар / Описание</th>
                                        <th>Категория</th>
                                        <th>Покупатель</th>
                                        <th>Дата</th>
                                        <th>Сумма</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${visibleOrders.length ? visibleOrders.map(o => {
                                        const d = o.orderDate ? new Date(o.orderDate) : null;
                                        const dateStr = d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '—';
                                        const stBadge = o.orderStatus === 'closed'
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-closed">Закрыт</span>`
                                            : o.orderStatus === 'paid'
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-paid">Оплачен</span>`
                                            : `<span class="fpt-fin-badge-pill fpt-fin-badge-refunded">Возврат</span>`;
                                        return `
                                            <tr>
                                                <td style="font-family:monospace;font-weight:600;">
                                                    <a href="https://funpay.com/orders/${esc(o.orderId)}/" target="_blank" class="fpt-fin-order-link">
                                                        #${esc(o.orderId)}
                                                    </a>
                                                </td>
                                                <td class="fpt-fin-desc-cell" title="${esc(o.description)}">${esc(o.description)}</td>
                                                <td><span class="fpt-fin-subcat-badge">${esc(o.subcategoryName || '—')}</span></td>
                                                <td>
                                                    <a href="${o.buyerId ? `https://funpay.com/users/${o.buyerId}/` : '#'}" target="_blank" class="fpt-fin-user-link">
                                                        ${esc(o.buyerUsername || '—')}
                                                    </a>
                                                </td>
                                                <td style="color:var(--fptm-muted,#888);font-size:11px;">${dateStr}</td>
                                                <td style="font-weight:700;font-variant-numeric:tabular-nums;">${fmtMoney(o.price, o.currency)}</td>
                                                <td>${stBadge}</td>
                                            </tr>
                                        `;
                                    }).join('') : `
                                        <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--fptm-muted,#888);">Нет заказов по текущим фильтрам</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>

                        ${orders.length > visibleOrders.length ? `
                            <div class="fpt-fin-table-footer">
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinSalesLoadMoreBtn">
                                    <span>Показать ещё ${Math.min(50, orders.length - visibleOrders.length)} заказов</span>
                                </button>
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinSalesLoadAllBtn">
                                    <span>Показать все (${orders.length})</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Привязываем обработчики событий внутри вкладки продаж
        wireSalesEvents(pane, orders, agg);
    }

    function wireSalesEvents(pane, orders, agg) {
        // Статусные фильтры
        pane.querySelectorAll('.fpt-fin-filter-chip[data-st]').forEach(chip => {
            chip.addEventListener('click', () => {
                const st = chip.getAttribute('data-st');
                if (st === 'closed') state.sales.statusFilter.stClosed = !state.sales.statusFilter.stClosed;
                if (st === 'paid') state.sales.statusFilter.stPaid = !state.sales.statusFilter.stPaid;
                if (st === 'refunded') state.sales.statusFilter.stRefunded = !state.sales.statusFilter.stRefunded;
                renderSales();
            });
        });

        // Поиск с дебаунсом
        const searchInput = pane.querySelector('#fptFinSalesSearch');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.sales.search = e.target.value.trim();
                    renderSales();
                }, 300);
            });
        }
        const clearSearchBtn = pane.querySelector('#fptFinSalesSearchClear');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                state.sales.search = '';
                renderSales();
            });
        }

        // Переключатель метрик графика
        pane.querySelectorAll('.fpt-fin-chart-toggle[data-metric]').forEach(t => {
            t.addEventListener('click', () => {
                state.sales.chartMetric = t.getAttribute('data-metric');
                renderSales();
            });
        });

        // Переключатель диаграммы
        pane.querySelectorAll('.fpt-fin-chart-toggle[data-donut]').forEach(t => {
            t.addEventListener('click', () => {
                state.sales.donutMetric = t.getAttribute('data-donut');
                renderSales();
            });
        });

        // Сортировка таблицы
        const sortSelect = pane.querySelector('#fptFinSalesSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.sales.sort = e.target.value;
                renderSales();
            });
        }

        // Кнопки «Показать ещё»
        const loadMoreBtn = pane.querySelector('#fptFinSalesLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                state.sales.visibleOrdersCount += 50;
                renderSales();
            });
        }
        const loadAllBtn = pane.querySelector('#fptFinSalesLoadAllBtn');
        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => {
                state.sales.visibleOrdersCount = orders.length;
                renderSales();
            });
        }

        // Drill-down по карточкам KPI
        pane.querySelectorAll('.fpt-fin-clickable-card[data-drill]').forEach(card => {
            card.addEventListener('click', () => {
                const drill = card.getAttribute('data-drill');
                let subset = orders;
                let title = 'Заказы продаж';
                if (drill === 'revenue') {
                    subset = orders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
                    title = 'Оплаченные и закрытые заказы';
                } else if (drill === 'refunded') {
                    subset = orders.filter(o => o.orderStatus === 'refunded');
                    title = 'Возвращённые заказы';
                }
                openDrilldownModal(title, `${subset.length} заказов`, subset);
            });
        });

        // Drill-down по покупателю
        pane.querySelectorAll('[data-drill-buyer]').forEach(btn => {
            btn.addEventListener('click', () => {
                const buyer = btn.getAttribute('data-drill-buyer');
                const subset = orders.filter(o => o.buyerUsername === buyer);
                openDrilldownModal(`Заказы покупателя ${buyer}`, `${subset.length} заказов`, subset);
            });
        });

        // Drill-down по товару
        pane.querySelectorAll('[data-drill-product]').forEach(btn => {
            btn.addEventListener('click', () => {
                const prod = btn.getAttribute('data-drill-product');
                const subset = orders.filter(o => o.description === prod);
                openDrilldownModal(`Заказы: ${prod}`, `${subset.length} заказов`, subset);
            });
        });
    }

    // ── МОДАЛЬНОЕ ОКНО DRILL-DOWN ─────────────────────────────────────────────

    function openDrilldownModal(title, subtitle, orders) {
        if (typeof root.fptOpenOrdersDrilldown === 'function') {
            root.fptOpenOrdersDrilldown(title, subtitle, orders);
            return;
        }

        // Фолбэк-модалка, если stats_drilldown не загружен
        const old = document.getElementById('fpt-hub-dd-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'fpt-hub-dd-modal';
        modal.className = 'fpt-dd-overlay';
        modal.innerHTML = `
            <div class="fpt-dd-modal" role="dialog" aria-modal="true" style="max-width:740px;">
                <div class="fpt-dd-head">
                    <div>
                        <div class="fpt-dd-title">${esc(title)}</div>
                        <div class="fpt-dd-sub">${esc(subtitle)}</div>
                    </div>
                    <button class="fpt-dd-close" title="Закрыть">×</button>
                </div>
                <div class="fpt-dd-list" style="max-height:480px;overflow-y:auto;">
                    ${orders.map(o => `
                        <div class="fpt-dd-row" style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--fptm-border,rgba(255,255,255,0.08));">
                            <div>
                                <a href="https://funpay.com/orders/${esc(o.orderId)}/" target="_blank" style="font-weight:600;color:var(--fptm-accent,#1b75bb);">#${esc(o.orderId)}</a>
                                <span style="margin-left:8px;color:var(--fptm-text,#fff);">${esc(o.description)}</span>
                            </div>
                            <div style="font-weight:700;">${fmtMoney(o.price, o.currency)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('.fpt-dd-close').addEventListener('click', close);
    }

    // ── РЕНДЕРИНГ ВКЛАДКИ «ПОКУПКИ» ─────────────────────────────────────────

    async function renderPurchases() {
        const pane = getPane('purchases');
        if (!pane) return;

        state.loading.purchases = true;

        const dataLayer = root.FPTFinanceData;
        if (!dataLayer) {
            pane.innerHTML = `<div class="fpt-fin-empty-state"><p class="fpt-fin-empty-desc">Служба данных не загружена</p></div>`;
            state.loading.purchases = false;
            return;
        }

        const period = state.period || '7d';
        const purchasesFilter = state.purchases.statusFilter;
        const search = state.purchases.search;
        const sort = state.purchases.sort;

        const { orders, count, totalCount } = await dataLayer.getPurchases({
            period,
            statusFilter: purchasesFilter,
            search,
            sort
        });

        const agg = dataLayer.aggregatePurchases(orders);
        state.loading.purchases = false;

        if (totalCount === 0) {
            pane.innerHTML = `
                <div class="fpt-fin-empty-state">
                    <span class="material-symbols-rounded fpt-fin-empty-icon">shopping_bag</span>
                    <h4 class="fpt-fin-empty-title">Покупки не найдены</h4>
                    <p class="fpt-fin-empty-desc">Нажмите кнопку ниже или «Обновить» вверху, чтобы синхронизировать историю ваших покупок с FunPay.</p>
                    <button type="button" class="btn btn-primary fpt-fin-btn" id="fptFinPurchasesInitialSyncBtn">
                        <span class="material-symbols-rounded">sync</span>
                        <span>Синхронизировать покупки</span>
                    </button>
                </div>
            `;
            const syncBtn = pane.querySelector('#fptFinPurchasesInitialSyncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => refresh());
            }
            return;
        }

        const days = Object.keys(agg.byDay).sort();
        const chartMetric = state.purchases.chartMetric; // 'spent' | 'count'
        const isMoneyMetric = chartMetric === 'spent';

        const donutMetric = state.purchases.donutMetric;
        let donutTitle = 'Покупки по категориям';
        let donutEntries = [];
        let donutFmt = null;

        if (donutMetric === 'category') {
            donutTitle = 'Покупки по категориям';
            donutEntries = Object.entries(agg.byCategory)
                .map(([k, v]) => ({ label: k, value: v.count }))
                .sort((a, b) => b.value - a.value);
        } else if (donutMetric === 'status') {
            donutTitle = 'Покупки по статусам';
            const stLabels = { closed: 'Закрыт', paid: 'Оплачен', refunded: 'Возврат' };
            donutEntries = Object.entries(agg.byStatus)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ label: stLabels[k] || k, value: v }))
                .sort((a, b) => b.value - a.value);
        } else {
            donutTitle = 'Траты по валютам';
            donutEntries = Object.entries(agg.totalSpent)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ label: k, value: Math.round(v) }))
                .sort((a, b) => b.value - a.value);
            donutFmt = (v) => `${v.toLocaleString('ru-RU')}`;
        }

        const topSellers = Object.values(agg.bySeller)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const topProducts = Object.entries(agg.byProduct)
            .map(([desc, d]) => ({ desc, count: d.count, spent: d.spent }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const visibleOrders = orders.slice(0, state.purchases.visibleOrdersCount);

        pane.innerHTML = `
            <!-- Фильтры и поиск -->
            <div class="fpt-fin-toolbar">
                <div class="fpt-fin-filter-group">
                    <button type="button" class="fpt-fin-filter-chip ${purchasesFilter.stClosed ? 'active' : ''}" data-pst="closed">
                        <span class="material-symbols-rounded">check_circle</span> Завершённые
                    </button>
                    <button type="button" class="fpt-fin-filter-chip ${purchasesFilter.stPaid ? 'active' : ''}" data-pst="paid">
                        <span class="material-symbols-rounded">schedule</span> В процессе
                    </button>
                    <button type="button" class="fpt-fin-filter-chip ${purchasesFilter.stRefunded ? 'active' : ''}" data-pst="refunded">
                        <span class="material-symbols-rounded">assignment_return</span> Возвраты
                    </button>
                </div>
                <div class="fpt-fin-search-box">
                    <span class="material-symbols-rounded fpt-fin-search-icon">search</span>
                    <input type="text" class="fpt-fin-search-input" id="fptFinPurchasesSearch" placeholder="Поиск по товару, продавцу, ID..." value="${esc(search)}" autocomplete="off" />
                    ${search ? `<button type="button" class="fpt-fin-search-clear" id="fptFinPurchasesSearchClear">×</button>` : ''}
                </div>
            </div>

            <!-- Сетка KPI -->
            <div class="fpt-fin-grid">
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-pdrill="spent" title="Кликните для просмотра покупок">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Потрачено на покупки</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">shopping_bag</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.totalSpent)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Закрыто: ${agg.totalClosed}</span>
                            ${agg.totalPending > 0 ? `<span>· В ожидании: ${agg.totalPending}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-pdrill="orders" title="Кликните для просмотра покупок">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Куплено товаров</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, #1b75bb);">inventory_2</span>
                        </div>
                        <div class="fpt-fin-card-value">${agg.totalOrders}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Уник. продавцов: ${agg.uniqueSellersCount}</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Средний чек покупки</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt_long</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.averageCheck)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>По завершённым покупкам</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-pdrill="refunded" title="Кликните для просмотра возвратов">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Возвраты средств</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">verified</span>
                        </div>
                        <div class="fpt-fin-card-value">${agg.totalRefunded}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Сумма: ${fmtRevenueMulti(agg.refundedAmount)}</span>
                        </div>
                    </div>
                </div>

                <!-- График расходов и Диаграмма -->
                <div class="fpt-fin-col-8">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Динамика покупок</h5>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'spent' ? 'active' : ''}" data-pmetric="spent">Траты</button>
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'count' ? 'active' : ''}" data-pmetric="count">Покупки</button>
                            </div>
                        </div>
                        <div class="fpt-fin-chart-wrap" style="height:220px;position:relative;">
                            ${renderLineChartSVG(days, agg.byDay, chartMetric, isMoneyMetric)}
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-4">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Структура</h5>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'category' ? 'active' : ''}" data-pdonut="category">Категории</button>
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'status' ? 'active' : ''}" data-pdonut="status">Статусы</button>
                                <button type="button" class="fpt-fin-chart-toggle ${donutMetric === 'currency' ? 'active' : ''}" data-pdonut="currency">Валюты</button>
                            </div>
                        </div>
                        ${renderDonutSVG(donutTitle, donutEntries, donutFmt)}
                    </div>
                </div>

                <!-- Топы продавцов и товаров -->
                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Топ продавцов</h5>
                            <span class="fpt-fin-card-sub">${topSellers.length} партнёров</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Продавец</th>
                                        <th style="text-align:right;">Покупок</th>
                                        <th style="text-align:right;">Потрачено</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topSellers.length ? topSellers.map((s, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td>
                                                <a href="${s.id ? `https://funpay.com/users/${s.id}/` : '#'}" target="_blank" class="fpt-fin-user-link">
                                                    ${esc(s.username)}
                                                </a>
                                            </td>
                                            <td style="text-align:right;">
                                                <button type="button" class="fpt-fin-mini-badge-btn" data-pdrill-seller="${esc(s.username)}" title="Показать покупки у этого продавца">
                                                    ${s.count} пок.
                                                </button>
                                            </td>
                                            <td style="text-align:right;font-weight:600;">${fmtMoney(s.spent, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Купленные товары</h5>
                            <span class="fpt-fin-card-sub">${topProducts.length} позиций</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Товар</th>
                                        <th style="text-align:right;">Куплено</th>
                                        <th style="text-align:right;">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topProducts.length ? topProducts.map((p, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td class="fpt-fin-desc-cell" title="${esc(p.desc)}">${esc(p.desc)}</td>
                                            <td style="text-align:right;">
                                                <button type="button" class="fpt-fin-mini-badge-btn" data-pdrill-product="${esc(p.desc)}" title="Показать покупки этого товара">
                                                    ${p.count} раз
                                                </button>
                                            </td>
                                            <td style="text-align:right;font-weight:600;">${fmtMoney(p.spent, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Таблица детальных покупок -->
                <div class="fpt-fin-col-12">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <h5 class="fpt-fin-card-title">История покупок</h5>
                                <span class="fpt-fin-mini-badge">Показано ${visibleOrders.length} из ${orders.length}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <select class="fpt-fin-sort-select" id="fptFinPurchasesSortSelect" aria-label="Сортировка">
                                    <option value="date-desc" ${sort === 'date-desc' ? 'selected' : ''}>Сначала новые</option>
                                    <option value="date-asc" ${sort === 'date-asc' ? 'selected' : ''}>Сначала старые</option>
                                    <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Дороже сверху</option>
                                    <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Дешевле сверху</option>
                                </select>
                            </div>
                        </div>

                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>Заказ</th>
                                        <th>Товар / Описание</th>
                                        <th>Категория</th>
                                        <th>Продавец</th>
                                        <th>Дата</th>
                                        <th>Сумма</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${visibleOrders.length ? visibleOrders.map(o => {
                                        const d = o.orderDate ? new Date(o.orderDate) : null;
                                        const dateStr = d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '—';
                                        const stBadge = o.orderStatus === 'closed'
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-closed">Закрыт</span>`
                                            : o.orderStatus === 'paid'
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-paid">Оплачен</span>`
                                            : `<span class="fpt-fin-badge-pill fpt-fin-badge-refunded">Возврат</span>`;
                                        const sellerName = o.sellerUsername || o.buyerUsername || '—';
                                        const sellerId = o.sellerId || o.buyerId;
                                        return `
                                            <tr>
                                                <td style="font-family:monospace;font-weight:600;">
                                                    <a href="https://funpay.com/orders/${esc(o.orderId)}/" target="_blank" class="fpt-fin-order-link">
                                                        #${esc(o.orderId)}
                                                    </a>
                                                </td>
                                                <td class="fpt-fin-desc-cell" title="${esc(o.description)}">${esc(o.description)}</td>
                                                <td><span class="fpt-fin-subcat-badge">${esc(o.subcategoryName || '—')}</span></td>
                                                <td>
                                                    <a href="${sellerId ? `https://funpay.com/users/${sellerId}/` : '#'}" target="_blank" class="fpt-fin-user-link">
                                                        ${esc(sellerName)}
                                                    </a>
                                                </td>
                                                <td style="color:var(--fptm-muted,#888);font-size:11px;">${dateStr}</td>
                                                <td style="font-weight:700;font-variant-numeric:tabular-nums;">${fmtMoney(o.price, o.currency)}</td>
                                                <td>${stBadge}</td>
                                            </tr>
                                        `;
                                    }).join('') : `
                                        <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--fptm-muted,#888);">Нет покупок по текущим фильтрам</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>

                        ${orders.length > visibleOrders.length ? `
                            <div class="fpt-fin-table-footer">
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinPurchasesLoadMoreBtn">
                                    <span>Показать ещё ${Math.min(50, orders.length - visibleOrders.length)} покупок</span>
                                </button>
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinPurchasesLoadAllBtn">
                                    <span>Показать все (${orders.length})</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        wirePurchasesEvents(pane, orders, agg);
    }

    function wirePurchasesEvents(pane, orders, agg) {
        pane.querySelectorAll('.fpt-fin-filter-chip[data-pst]').forEach(chip => {
            chip.addEventListener('click', () => {
                const st = chip.getAttribute('data-pst');
                if (st === 'closed') state.purchases.statusFilter.stClosed = !state.purchases.statusFilter.stClosed;
                if (st === 'paid') state.purchases.statusFilter.stPaid = !state.purchases.statusFilter.stPaid;
                if (st === 'refunded') state.purchases.statusFilter.stRefunded = !state.purchases.statusFilter.stRefunded;
                renderPurchases();
            });
        });

        const searchInput = pane.querySelector('#fptFinPurchasesSearch');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.purchases.search = e.target.value.trim();
                    renderPurchases();
                }, 300);
            });
        }
        const clearSearchBtn = pane.querySelector('#fptFinPurchasesSearchClear');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                state.purchases.search = '';
                renderPurchases();
            });
        }

        pane.querySelectorAll('.fpt-fin-chart-toggle[data-pmetric]').forEach(t => {
            t.addEventListener('click', () => {
                state.purchases.chartMetric = t.getAttribute('data-pmetric');
                renderPurchases();
            });
        });

        pane.querySelectorAll('.fpt-fin-chart-toggle[data-pdonut]').forEach(t => {
            t.addEventListener('click', () => {
                state.purchases.donutMetric = t.getAttribute('data-pdonut');
                renderPurchases();
            });
        });

        const sortSelect = pane.querySelector('#fptFinPurchasesSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.purchases.sort = e.target.value;
                renderPurchases();
            });
        }

        const loadMoreBtn = pane.querySelector('#fptFinPurchasesLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                state.purchases.visibleOrdersCount += 50;
                renderPurchases();
            });
        }
        const loadAllBtn = pane.querySelector('#fptFinPurchasesLoadAllBtn');
        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => {
                state.purchases.visibleOrdersCount = orders.length;
                renderPurchases();
            });
        }

        pane.querySelectorAll('.fpt-fin-clickable-card[data-pdrill]').forEach(card => {
            card.addEventListener('click', () => {
                const drill = card.getAttribute('data-pdrill');
                let subset = orders;
                let title = 'История покупок';
                if (drill === 'spent') {
                    subset = orders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');
                    title = 'Оплаченные покупки';
                } else if (drill === 'refunded') {
                    subset = orders.filter(o => o.orderStatus === 'refunded');
                    title = 'Возвращённые покупки';
                }
                openDrilldownModal(title, `${subset.length} покупок`, subset);
            });
        });

        pane.querySelectorAll('[data-pdrill-seller]').forEach(btn => {
            btn.addEventListener('click', () => {
                const seller = btn.getAttribute('data-pdrill-seller');
                const subset = orders.filter(o => (o.sellerUsername || o.buyerUsername) === seller);
                openDrilldownModal(`Покупки у продавца ${seller}`, `${subset.length} покупок`, subset);
            });
        });

        pane.querySelectorAll('[data-pdrill-product]').forEach(btn => {
            btn.addEventListener('click', () => {
                const prod = btn.getAttribute('data-pdrill-product');
                const subset = orders.filter(o => o.description === prod);
                openDrilldownModal(`Покупки товара: ${prod}`, `${subset.length} покупок`, subset);
            });
        });
    }

    // ── РЕНДЕРИНГ ДИАГРАММЫ ОПЕРАЦИЙ (BAR CHART) ───────────────────────────

    function renderOperationsBarChartSVG(keys, dataMap) {
        if (!keys.length) {
            return `<div class="fpt-fin-chart-empty">Нет операций за выбранный период</div>`;
        }

        const maxVal = niceMax(Math.max(1, ...keys.map(k => Math.max(dataMap[k] ? dataMap[k].in || 0 : 0, dataMap[k] ? dataMap[k].out || 0 : 0))));

        const W = 680, H = 220, PAD = { t: 20, r: 20, b: 35, l: 55 };
        const cw = W - PAD.l - PAD.r;
        const ch = H - PAD.t - PAD.b;
        const slot = cw / Math.max(keys.length, 1);
        const barW = Math.max(2, Math.min(18, Math.floor(slot / 2) - 2));
        const baseY = PAD.t + ch;

        let grid = '', yLabels = '';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const y = baseY - (i / steps) * ch;
            grid += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="var(--fptm-border, rgba(255,255,255,0.08))" stroke-width="1" />`;
            const v = (maxVal / steps) * i;
            yLabels += `<text x="${PAD.l - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--fptm-muted, #9099b8)">${fmtAxis(v)}</text>`;
        }

        let bars = '', xLabels = '';
        const stepX = Math.ceil(keys.length / 10);

        keys.forEach((k, i) => {
            const entry = dataMap[k] || { in: 0, out: 0, net: 0 };
            const slotX = PAD.l + i * slot + slot / 2;

            const inH = Math.max(0, (entry.in / maxVal) * ch);
            const outH = Math.max(0, (entry.out / maxVal) * ch);

            const inY = baseY - inH;
            const outY = baseY - outH;

            const inX = slotX - barW - 1;
            const outX = slotX + 1;

            bars += `
                <g class="fpt-fin-chart-bar-group" tabindex="0">
                    <title>${k}: Приход: +${fmtMoney(entry.in, 'RUB')}, Расход: −${fmtMoney(entry.out, 'RUB')}, Нетто: ${entry.net >= 0 ? '+' : ''}${fmtMoney(entry.net, 'RUB')}</title>
                    ${inH > 0 ? `<rect x="${inX}" y="${inY}" width="${barW}" height="${inH}" fill="#4caf82" rx="2" opacity="0.85" />` : ''}
                    ${outH > 0 ? `<rect x="${outX}" y="${outY}" width="${barW}" height="${outH}" fill="#e57373" rx="2" opacity="0.85" />` : ''}
                </g>
            `;

            if (i % stepX === 0 || i === keys.length - 1) {
                const label = k.slice(5); // MM или DD
                xLabels += `<text x="${slotX}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--fptm-muted, #9099b8)">${label}</text>`;
            }
        });

        return `
            <svg class="fpt-fin-svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible;">
                ${grid}
                ${yLabels}
                ${xLabels}
                ${bars}
            </svg>
        `;
    }

    // ── РЕНДЕРИНГ ВКЛАДКИ «ОПЕРАЦИИ» ────────────────────────────────────────

    async function renderOperations() {
        const pane = getPane('operations');
        if (!pane) return;

        state.loading.operations = true;

        const dataLayer = root.FPTFinanceData;
        if (!dataLayer) {
            pane.innerHTML = `<div class="fpt-fin-empty-state"><p class="fpt-fin-empty-desc">Служба данных не загружена</p></div>`;
            state.loading.operations = false;
            return;
        }

        const period = state.period || '7d';
        const typeFilter = state.operations.typeFilter;
        const search = state.operations.search;
        const sort = state.operations.sort;

        const { txns, count, totalCount } = await dataLayer.getOperations({
            period,
            typeFilter,
            search,
            sort
        });

        const agg = dataLayer.aggregateOperations(txns);
        state.loading.operations = false;

        if (totalCount === 0) {
            pane.innerHTML = `
                <div class="fpt-fin-empty-state">
                    <span class="material-symbols-rounded fpt-fin-empty-icon">account_balance</span>
                    <h4 class="fpt-fin-empty-title">Операции баланса не найдены</h4>
                    <p class="fpt-fin-empty-desc">Нажмите кнопку ниже или «Обновить» вверху, чтобы синхронизировать историю операций баланса с FunPay.</p>
                    <button type="button" class="btn btn-primary fpt-fin-btn" id="fptFinOperationsInitialSyncBtn">
                        <span class="material-symbols-rounded">sync</span>
                        <span>Синхронизировать баланс</span>
                    </button>
                </div>
            `;
            const syncBtn = pane.querySelector('#fptFinOperationsInitialSyncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => refresh());
            }
            return;
        }

        const chartInterval = state.operations.chartInterval; // 'month' | 'day'
        const intervalMap = chartInterval === 'month' ? agg.byMonth : agg.byDay;
        const intervalKeys = Object.keys(intervalMap).sort();

        // Разбивка по типам для пончика
        const TYPE_NAMES = {
            order: 'Заказы',
            payment: 'Пополнения',
            withdraw: 'Выводы',
            withdraw_cancel: 'Отмены выводов',
            other: 'Другое'
        };

        const typeEntries = Object.entries(agg.byType)
            .map(([k, d]) => ({ label: TYPE_NAMES[k] || k, value: d.count }))
            .sort((a, b) => b.value - a.value);

        const visibleTxns = txns.slice(0, state.operations.visibleCount);

        const netClass = agg.totalNetRUB >= 0 ? '#4caf82' : '#e57373';
        const netPrefix = agg.totalNetRUB >= 0 ? '+' : '';

        pane.innerHTML = `
            <!-- Фильтры по типам и поиск -->
            <div class="fpt-fin-toolbar">
                <div class="fpt-fin-filter-group">
                    <button type="button" class="fpt-fin-filter-chip ${typeFilter === 'all' ? 'active' : ''}" data-opt-type="all">Все</button>
                    <button type="button" class="fpt-fin-filter-chip ${typeFilter === 'order' ? 'active' : ''}" data-opt-type="order">Заказы</button>
                    <button type="button" class="fpt-fin-filter-chip ${typeFilter === 'payment' ? 'active' : ''}" data-opt-type="payment">Пополнения</button>
                    <button type="button" class="fpt-fin-filter-chip ${typeFilter === 'withdraw' ? 'active' : ''}" data-opt-type="withdraw">Выводы</button>
                    <button type="button" class="fpt-fin-filter-chip ${typeFilter === 'other' ? 'active' : ''}" data-opt-type="other">Прочее</button>
                </div>
                <div class="fpt-fin-search-box">
                    <span class="material-symbols-rounded fpt-fin-search-icon">search</span>
                    <input type="text" class="fpt-fin-search-input" id="fptFinOperationsSearch" placeholder="Поиск по описанию, ID..." value="${esc(search)}" autocomplete="off" />
                    ${search ? `<button type="button" class="fpt-fin-search-clear" id="fptFinOperationsSearchClear">×</button>` : ''}
                </div>
            </div>

            <!-- Сетка KPI -->
            <div class="fpt-fin-grid">
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Поступления (+)</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">arrow_circle_down</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.inByCur)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>В рублях: +${fmtMoney(agg.totalInRUB, 'RUB')}</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Расходы (−)</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">arrow_circle_up</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(agg.outByCur)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>В рублях: −${fmtMoney(agg.totalOutRUB, 'RUB')}</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Чистый поток (нетто)</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, #1b75bb);">account_balance</span>
                        </div>
                        <div class="fpt-fin-card-value" style="color:${netClass}!important;">${netPrefix}${fmtMoney(agg.totalNetRUB, 'RUB')}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Изменение баланса за период</span>
                        </div>
                    </div>
                </div>
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Операции и сборы</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#f4c84a;">price_check</span>
                        </div>
                        <div class="fpt-fin-card-value">${agg.count} оп.</div>
                        <div class="fpt-fin-card-sub">
                            <span>Комиссии: ~${fmtMoney(agg.commissionsRUB, 'RUB')}</span>
                        </div>
                    </div>
                </div>

                <!-- График динамики и Разбивка по типам -->
                <div class="fpt-fin-col-8">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <h5 class="fpt-fin-card-title">Динамика баланса</h5>
                                <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--fptm-muted,#888);">
                                    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#4caf82;"></span> Приход</span>
                                    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:#e57373;"></span> Расход</span>
                                </div>
                            </div>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${chartInterval === 'month' ? 'active' : ''}" data-op-interval="month">По месяцам</button>
                                <button type="button" class="fpt-fin-chart-toggle ${chartInterval === 'day' ? 'active' : ''}" data-op-interval="day">По дням</button>
                            </div>
                        </div>
                        <div class="fpt-fin-chart-wrap" style="height:220px;position:relative;">
                            ${renderOperationsBarChartSVG(intervalKeys, intervalMap)}
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-4">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Разбивка операций</h5>
                        </div>
                        ${renderDonutSVG('Типы операций', typeEntries)}
                    </div>
                </div>

                <!-- Таблица операций -->
                <div class="fpt-fin-col-12">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <h5 class="fpt-fin-card-title">История операций баланса</h5>
                                <span class="fpt-fin-mini-badge">Показано ${visibleTxns.length} из ${txns.length}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <select class="fpt-fin-sort-select" id="fptFinOperationsSortSelect" aria-label="Сортировка операций">
                                    <option value="date-desc" ${sort === 'date-desc' ? 'selected' : ''}>Сначала новые</option>
                                    <option value="date-asc" ${sort === 'date-asc' ? 'selected' : ''}>Сначала старые</option>
                                    <option value="amount-desc" ${sort === 'amount-desc' ? 'selected' : ''}>Сумма (макс)</option>
                                    <option value="amount-asc" ${sort === 'amount-asc' ? 'selected' : ''}>Сумма (мин)</option>
                                </select>
                            </div>
                        </div>

                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Дата</th>
                                        <th>Тип</th>
                                        <th>Описание / Реквизиты</th>
                                        <th style="text-align:right;">Сумма</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${visibleTxns.length ? visibleTxns.map(t => {
                                        const d = t.date ? new Date(t.date) : null;
                                        const dateStr = d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '—';
                                        const isPos = (t.signed || 0) >= 0;
                                        const amtStr = `${isPos ? '+' : '−'}${fmtMoney(Math.abs(t.signed || 0), t.currency)}`;
                                        const amtColor = isPos ? '#4caf82' : '#e57373';
                                        const typeLabel = TYPE_NAMES[t.type] || t.type || 'Операция';
                                        const statusBadge = (t.status === 'complete' || !t.status)
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-closed">Выполнено</span>`
                                            : `<span class="fpt-fin-badge-pill fpt-fin-badge-refunded">${esc(t.status)}</span>`;

                                        return `
                                            <tr>
                                                <td style="font-family:monospace;font-weight:600;color:var(--fptm-muted,#888);">#${esc(t.id || '—')}</td>
                                                <td style="color:var(--fptm-muted,#888);font-size:11px;">${dateStr}</td>
                                                <td><span class="fpt-fin-subcat-badge">${esc(typeLabel)}</span></td>
                                                <td class="fpt-fin-desc-cell" title="${esc(t.description || '')}">${esc(t.description || '—')}</td>
                                                <td style="text-align:right;font-weight:700;color:${amtColor};font-variant-numeric:tabular-nums;">${amtStr}</td>
                                                <td>${statusBadge}</td>
                                            </tr>
                                        `;
                                    }).join('') : `
                                        <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--fptm-muted,#888);">Нет операций по текущим фильтрам</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>

                        ${txns.length > visibleTxns.length ? `
                            <div class="fpt-fin-table-footer">
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinOperationsLoadMoreBtn">
                                    <span>Показать ещё ${Math.min(50, txns.length - visibleTxns.length)} операций</span>
                                </button>
                                <button type="button" class="btn btn-default fpt-fin-btn" id="fptFinOperationsLoadAllBtn">
                                    <span>Показать все (${txns.length})</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        wireOperationsEvents(pane, txns, agg);
    }

    function wireOperationsEvents(pane, txns, agg) {
        pane.querySelectorAll('.fpt-fin-filter-chip[data-opt-type]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.operations.typeFilter = chip.getAttribute('data-opt-type');
                renderOperations();
            });
        });

        const searchInput = pane.querySelector('#fptFinOperationsSearch');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.operations.search = e.target.value.trim();
                    renderOperations();
                }, 300);
            });
        }
        const clearSearchBtn = pane.querySelector('#fptFinOperationsSearchClear');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                state.operations.search = '';
                renderOperations();
            });
        }

        pane.querySelectorAll('.fpt-fin-chart-toggle[data-op-interval]').forEach(t => {
            t.addEventListener('click', () => {
                state.operations.chartInterval = t.getAttribute('data-op-interval');
                renderOperations();
            });
        });

        const sortSelect = pane.querySelector('#fptFinOperationsSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.operations.sort = e.target.value;
                renderOperations();
            });
        }

        const loadMoreBtn = pane.querySelector('#fptFinOperationsLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                state.operations.visibleCount += 50;
                renderOperations();
            });
        }
        const loadAllBtn = pane.querySelector('#fptFinOperationsLoadAllBtn');
        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => {
                state.operations.visibleCount = txns.length;
                renderOperations();
            });
        }
    }

    // ── РЕНДЕРИНГ ВКЛАДКИ «ОБЗОР» ───────────────────────────────────────────

    async function renderOverview() {
        const pane = getPane('overview');
        if (!pane) return;

        state.loading.overview = true;

        const dataLayer = root.FPTFinanceData;
        if (!dataLayer) {
            pane.innerHTML = `<div class="fpt-fin-empty-state"><p class="fpt-fin-empty-desc">Служба данных не загружена</p></div>`;
            state.loading.overview = false;
            return;
        }

        const period = state.period || '7d';

        // Запрашиваем данные параллельно
        const [salesRes, purchasesRes, opsRes] = await Promise.all([
            dataLayer.getSales({ period, statusFilter: { stClosed: true, stPaid: true, stRefunded: true } }),
            dataLayer.getPurchases({ period, statusFilter: { stClosed: true, stPaid: true, stRefunded: false } }),
            dataLayer.getOperations({ period, typeFilter: 'all' })
        ]);

        const salesAgg = dataLayer.aggregateSales(salesRes.orders);
        const purchasesAgg = dataLayer.aggregatePurchases(purchasesRes.orders);
        const opsAgg = dataLayer.aggregateOperations(opsRes.txns);

        state.loading.overview = false;

        const totalAny = salesRes.totalCount + purchasesRes.totalCount + opsRes.totalCount;
        if (totalAny === 0) {
            pane.innerHTML = `
                <div class="fpt-fin-empty-state">
                    <span class="material-symbols-rounded fpt-fin-empty-icon">dashboard</span>
                    <h4 class="fpt-fin-empty-title">Финансовые данные ещё не загружены</h4>
                    <p class="fpt-fin-empty-desc">Запустите синхронизацию данных с FunPay, чтобы построить общую аналитику продаж, покупок и баланса.</p>
                    <button type="button" class="btn btn-primary fpt-fin-btn" id="fptFinOverviewInitialSyncBtn">
                        <span class="material-symbols-rounded">sync</span>
                        <span>Синхронизировать всё</span>
                    </button>
                </div>
            `;
            const syncBtn = pane.querySelector('#fptFinOverviewInitialSyncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => refresh());
            }
            return;
        }

        const chartMetric = state.overview.chartMetric || 'revenue'; // 'revenue' | 'count' | 'spent'
        let chartDays = [];
        let chartDataMap = {};
        let isMoney = true;

        if (chartMetric === 'revenue') {
            chartDays = Object.keys(salesAgg.byDay).sort();
            chartDataMap = salesAgg.byDay;
            isMoney = true;
        } else if (chartMetric === 'count') {
            chartDays = Object.keys(salesAgg.byDay).sort();
            chartDataMap = salesAgg.byDay;
            isMoney = false;
        } else {
            chartDays = Object.keys(purchasesAgg.byDay).sort();
            chartDataMap = purchasesAgg.byDay;
            isMoney = true;
        }

        // Структура по категориям продаж
        const catEntries = Object.entries(salesAgg.byCategory)
            .map(([k, v]) => ({ label: k, value: v.count }))
            .sort((a, b) => b.value - a.value);

        // Топ товаров
        const topProducts = Object.entries(salesAgg.byProduct)
            .map(([desc, d]) => ({ desc, count: d.count, revenue: d.revenue }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        // Топ категорий
        const topCategories = Object.entries(salesAgg.byCategory)
            .map(([cat, d]) => ({ cat, count: d.count, revenue: d.revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);

        // Свежие события (объединяем заказы и операции, сортируем по дате)
        const recentEvents = [];
        salesRes.orders.slice(0, 8).forEach(o => {
            recentEvents.push({
                type: 'sale',
                id: o.orderId,
                date: o.orderDate,
                desc: o.description,
                price: o.price,
                cur: o.currency,
                party: o.buyerUsername,
                status: o.orderStatus
            });
        });
        purchasesRes.orders.slice(0, 6).forEach(o => {
            recentEvents.push({
                type: 'purchase',
                id: o.orderId,
                date: o.orderDate,
                desc: o.description,
                price: o.price,
                cur: o.currency,
                party: o.sellerUsername || o.buyerUsername,
                status: o.orderStatus
            });
        });
        recentEvents.sort((a, b) => (b.date || 0) - (a.date || 0));
        const displayEvents = recentEvents.slice(0, 8);

        const netClass = opsAgg.totalNetRUB >= 0 ? '#4caf82' : '#e57373';
        const netPrefix = opsAgg.totalNetRUB >= 0 ? '+' : '';

        pane.innerHTML = `
            <div class="fpt-fin-grid">
                <!-- Главные KPI: 4 колонки -->
                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-ov-nav="sales" title="Перейти к продажам">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Выручка от продаж</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">payments</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(salesAgg.totalRevenue)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Закрыто: ${salesAgg.totalClosed} зак.</span>
                            ${salesAgg.totalPending > 0 ? `<span>· В ожидании: ${salesAgg.totalPending}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-ov-nav="sales" title="Перейти к продажам">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Оплачено заказов</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, #1b75bb);">check_circle</span>
                        </div>
                        <div class="fpt-fin-card-value">${salesAgg.totalOrders}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Средний чек: ${fmtRevenueMulti(salesAgg.averageCheck)}</span>
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-ov-nav="purchases" title="Перейти к покупкам">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Расходы на покупки</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">shopping_bag</span>
                        </div>
                        <div class="fpt-fin-card-value">${fmtRevenueMulti(purchasesAgg.totalSpent)}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Куплено: ${purchasesAgg.totalOrders} товаров</span>
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-3">
                    <div class="fpt-fin-card fpt-fin-clickable-card" data-ov-nav="operations" title="Перейти к операциям">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Чистый поток (нетто)</h5>
                            <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, #1b75bb);">account_balance</span>
                        </div>
                        <div class="fpt-fin-card-value" style="color:${netClass}!important;">${netPrefix}${fmtMoney(opsAgg.totalNetRUB, 'RUB')}</div>
                        <div class="fpt-fin-card-sub">
                            <span>Изменение баланса за период</span>
                        </div>
                    </div>
                </div>

                <!-- График динамики и Структура -->
                <div class="fpt-fin-col-8">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Динамика активности</h5>
                            <div class="fpt-fin-chart-toggles" role="group">
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'revenue' ? 'active' : ''}" data-ov-metric="revenue">Выручка</button>
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'count' ? 'active' : ''}" data-ov-metric="count">Заказы</button>
                                <button type="button" class="fpt-fin-chart-toggle ${chartMetric === 'spent' ? 'active' : ''}" data-ov-metric="spent">Покупки</button>
                            </div>
                        </div>
                        <div class="fpt-fin-chart-wrap" style="height:220px;position:relative;">
                            ${renderLineChartSVG(chartDays, chartDataMap, chartMetric === 'spent' ? 'spent' : chartMetric, isMoney)}
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-4">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Структура продаж</h5>
                        </div>
                        ${renderDonutSVG('Категории товаров', catEntries)}
                    </div>
                </div>

                <!-- Топ товаров и Топ категорий -->
                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Популярные товары</h5>
                            <span class="fpt-fin-card-sub">${topProducts.length} позиций</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Товар</th>
                                        <th style="text-align:right;">Продано</th>
                                        <th style="text-align:right;">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topProducts.length ? topProducts.map((p, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td class="fpt-fin-desc-cell" title="${esc(p.desc)}">${esc(p.desc)}</td>
                                            <td style="text-align:right;font-weight:600;">${p.count} раз</td>
                                            <td style="text-align:right;font-weight:700;">${fmtMoney(p.revenue, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="fpt-fin-col-6">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Топ категорий</h5>
                            <span class="fpt-fin-card-sub">${topCategories.length} категорий</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Категория</th>
                                        <th style="text-align:right;">Заказов</th>
                                        <th style="text-align:right;">Выручка</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topCategories.length ? topCategories.map((c, i) => `
                                        <tr>
                                            <td style="width:28px;color:var(--fptm-muted,#888);">${i + 1}</td>
                                            <td style="font-weight:500;">${esc(c.cat)}</td>
                                            <td style="text-align:right;font-weight:600;">${c.count} зак.</td>
                                            <td style="text-align:right;font-weight:700;">${fmtMoney(c.revenue, 'RUB')}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="4" style="text-align:center;padding:16px;">Нет данных</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Последние события -->
                <div class="fpt-fin-col-12">
                    <div class="fpt-fin-card">
                        <div class="fpt-fin-card-header">
                            <h5 class="fpt-fin-card-title">Последние события</h5>
                            <span class="fpt-fin-card-sub">${displayEvents.length} последних записей</span>
                        </div>
                        <div class="fpt-fin-table-wrap">
                            <table class="fpt-fin-table">
                                <thead>
                                    <tr>
                                        <th>Тип</th>
                                        <th>Заказ / Событие</th>
                                        <th>Партнёр</th>
                                        <th>Дата</th>
                                        <th style="text-align:right;">Сумма</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${displayEvents.length ? displayEvents.map(ev => {
                                        const d = ev.date ? new Date(ev.date) : null;
                                        const dateStr = d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '—';
                                        const isSale = ev.type === 'sale';
                                        const typeBadge = isSale
                                            ? `<span class="fpt-fin-badge-pill fpt-fin-badge-closed">Продажа</span>`
                                            : `<span class="fpt-fin-badge-pill fpt-fin-badge-paid">Покупка</span>`;
                                        const amtColor = isSale ? '#4caf82' : '#e57373';
                                        const amtPrefix = isSale ? '+' : '−';

                                        return `
                                            <tr>
                                                <td>${typeBadge}</td>
                                                <td>
                                                    <a href="https://funpay.com/orders/${esc(ev.id)}/" target="_blank" class="fpt-fin-order-link" style="font-family:monospace;font-weight:600;">
                                                        #${esc(ev.id)}
                                                    </a>
                                                    <span style="margin-left:6px;color:var(--fptm-text,#fff);">${esc(ev.desc || '')}</span>
                                                </td>
                                                <td>${esc(ev.party || '—')}</td>
                                                <td style="color:var(--fptm-muted,#888);font-size:11px;">${dateStr}</td>
                                                <td style="text-align:right;font-weight:700;color:${amtColor};font-variant-numeric:tabular-nums;">
                                                    ${amtPrefix}${fmtMoney(ev.price, ev.cur)}
                                                </td>
                                                <td>
                                                    <span class="fpt-fin-badge-pill ${ev.status === 'closed' ? 'fpt-fin-badge-closed' : ev.status === 'paid' ? 'fpt-fin-badge-paid' : 'fpt-fin-badge-refunded'}">
                                                        ${ev.status === 'closed' ? 'Закрыт' : ev.status === 'paid' ? 'Оплачен' : 'Возврат'}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('') : `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--fptm-muted,#888);">События отсутствуют</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        wireOverviewEvents(pane);
    }

    function wireOverviewEvents(pane) {
        pane.querySelectorAll('[data-ov-nav]').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.getAttribute('data-ov-nav');
                openTab(target);
            });
        });

        pane.querySelectorAll('.fpt-fin-chart-toggle[data-ov-metric]').forEach(t => {
            t.addEventListener('click', () => {
                state.overview.chartMetric = t.getAttribute('data-ov-metric');
                renderOverview();
            });
        });
    }

    // ── ЗАГЛУШКИ ДЛЯ БУДУЩИХ ЭТАПОВ (ПРИБЫЛЬ И ПОТЕНЦИАЛ) ────────────────────

    function renderProfit() {
        const pane = getPane('profit');
        if (!pane) return;
        pane.innerHTML = `
            <div class="fpt-fin-empty-state">
                <span class="material-symbols-rounded fpt-fin-empty-icon">savings</span>
                <h4 class="fpt-fin-empty-title">Учёт чистой прибыли и маржинальности</h4>
                <p class="fpt-fin-empty-desc">
                    Раздел находится в разработке. Расчёт чистой прибыли, маржинальности и себестоимости проданного станет доступен после внедрения учёта себестоимости лотов в следующем обновлении.
                </p>
                <span class="fpt-fin-empty-badge">
                    <span class="material-symbols-rounded" style="font-size:14px;">info</span>
                    Аналитика продаж, покупок и операций уже доступна в соседних вкладках
                </span>
            </div>
        `;
    }

    function renderPotential() {
        const pane = getPane('potential');
        if (!pane) return;
        pane.innerHTML = `
            <div class="fpt-fin-empty-state">
                <span class="material-symbols-rounded fpt-fin-empty-icon">insights</span>
                <h4 class="fpt-fin-empty-title">Потенциальная выручка и оценка склада</h4>
                <p class="fpt-fin-empty-desc">
                    Раздел находится в разработке. Оценка стоимости активных предложений на складе и расчёт потенциальной выручки станут доступны в следующем обновлении.
                </p>
                <span class="fpt-fin-empty-badge">
                    <span class="material-symbols-rounded" style="font-size:14px;">info</span>
                    Аналитика продаж, покупок и операций уже доступна в соседних вкладках
                </span>
            </div>
        `;
    }

    // ── ОБЩИЙ КОНТРОЛЛЕР ХАБА ────────────────────────────────────────────────

    function openTab(tabName) {
        if (!tabName) return;
        state.activeTab = tabName;

        const container = getContainer();
        if (!container) return;

        // Переключаем subtabs
        container.querySelectorAll('.fpt-fin-subtab').forEach(b => {
            const isTarget = b.dataset.subtab === tabName;
            b.classList.toggle('active', isTarget);
            b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
            if (isTarget) {
                const tabsContainer = b.closest('.fpt-fin-subtabs');
                if (tabsContainer && tabsContainer.scrollWidth > tabsContainer.clientWidth) {
                    const left = b.offsetLeft - (tabsContainer.clientWidth - b.offsetWidth) / 2;
                    try {
                        tabsContainer.scrollTo({ left, behavior: 'smooth' });
                    } catch (_) {
                        tabsContainer.scrollLeft = left;
                    }
                }
            }
        });

        // Переключаем panes
        container.querySelectorAll('.fpt-fin-tab-pane').forEach(p => {
            p.classList.toggle('active', p.dataset.subtab === tabName);
        });

        try { sessionStorage.setItem('fpt_fin_active_subtab', tabName); } catch (_) {}

        // Рендерим нужную вкладку
        switch (tabName) {
            case 'sales': renderSales(); break;
            case 'purchases': renderPurchases(); break;
            case 'operations': renderOperations(); break;
            case 'profit': renderProfit(); break;
            case 'potential': renderPotential(); break;
            case 'overview':
            default:
                renderOverview();
                break;
        }
    }

    function setPeriod(newPeriod) {
        if (!newPeriod || state.period === newPeriod) return;
        state.period = newPeriod;

        try { sessionStorage.setItem('fpt_fin_last_period', newPeriod); } catch (_) {}

        const container = getContainer();
        if (container) {
            const sel = container.querySelector('#fptFinPeriodSelect');
            if (sel && sel.value !== newPeriod) sel.value = newPeriod;
        }

        openTab(state.activeTab);
    }

    async function refresh() {
        const container = getContainer();
        const refreshBtn = container ? container.querySelector('#fptFinRefreshBtn') : null;
        const lastUpdatedEl = container ? container.querySelector('#fptFinLastUpdatedText') : null;

        if (refreshBtn) refreshBtn.classList.add('fpt-fin-btn-spin');

        const dataLayer = root.FPTFinanceData;
        if (dataLayer) {
            if (state.activeTab === 'sales') await dataLayer.refreshSales();
            else if (state.activeTab === 'purchases') await dataLayer.refreshPurchases();
            else if (state.activeTab === 'operations') await dataLayer.refreshOperations();
            else {
                await Promise.all([
                    dataLayer.refreshSales(),
                    dataLayer.refreshPurchases(),
                    dataLayer.refreshOperations()
                ]);
            }
        }

        if (lastUpdatedEl) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            lastUpdatedEl.textContent = `Обновлено: в ${timeStr}`;
        }

        if (typeof root.showNotification === 'function') {
            root.showNotification('Синхронизация данных запущена', false);
        }

        // Перерисовываем активную вкладку
        openTab(state.activeTab);

        setTimeout(() => {
            if (refreshBtn) refreshBtn.classList.remove('fpt-fin-btn-spin');
        }, 600);
    }

    function bindBackgroundEvents() {
        if (state.storageListenerBound) return;
        state.storageListenerBound = true;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local') return;

                const salesChanged = !!changes.fpToolsSalesLastUpdate;
                const purchasesChanged = !!changes.fpToolsPurchasesLastUpdate;
                const financeChanged = !!changes.fpToolsFinanceLastUpdate;

                if (salesChanged && state.activeTab === 'sales') {
                    renderSales();
                } else if (purchasesChanged && state.activeTab === 'purchases') {
                    renderPurchases();
                } else if (financeChanged && state.activeTab === 'operations') {
                    renderOperations();
                } else if ((salesChanged || purchasesChanged || financeChanged) && state.activeTab === 'overview') {
                    renderOverview();
                }
            });
        }
    }

    function init() {
        const container = getContainer();
        if (!container) return;
        if (container.dataset.hubInitialized === '1') {
            openTab(state.activeTab);
            return;
        }
        container.dataset.hubInitialized = '1';

        // Восстанавливаем период
        try {
            const savedPeriod = sessionStorage.getItem('fpt_fin_last_period');
            if (savedPeriod) state.period = savedPeriod;
        } catch (_) {}

        const periodSelect = container.querySelector('#fptFinPeriodSelect');
        if (periodSelect) {
            periodSelect.value = state.period;
            periodSelect.addEventListener('change', (e) => {
                setPeriod(e.target.value);
            });
        }

        // Кнопка обновления
        const refreshBtn = container.querySelector('#fptFinRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                refresh();
            });
        }

        // Привязка кликов по подвкладкам
        container.querySelectorAll('.fpt-fin-subtab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTab(btn.dataset.subtab);
            });
        });

        // Слушатель background-обновлений
        bindBackgroundEvents();

        // Восстанавливаем активную вкладку
        let initialTab = 'overview';
        try {
            const savedTab = sessionStorage.getItem('fpt_fin_active_subtab');
            if (savedTab) initialTab = savedTab;
        } catch (_) {}

        openTab(initialTab);
    }

    function destroy() {
        const container = getContainer();
        if (container) delete container.dataset.hubInitialized;
    }

    // ── ЭКСПОРТ КОНТРОЛЛЕРА ──────────────────────────────────────────────────
    const FPTFinanceHub = {
        init,
        destroy,
        openTab,
        setPeriod,
        refresh,
        renderSales,
        renderPurchases,
        renderOperations,
        renderOverview,
        renderProfit,
        renderPotential,
        getState: () => state
    };

    root.FPTFinanceHub = FPTFinanceHub;

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (getContainer()) init();
            });
        } else {
            if (getContainer()) init();
        }
    }

})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this)));
