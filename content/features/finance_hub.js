/**
 * FunPay Tools — Finance Hub Controller (Sales Subtab — T03A)
 *
 * Связующий контроллер Finance Hub для статистики продаж:
 * - Управление периодом и состоянием подвкладок;
 * - Доступ к данным продаж строго через window.FPTFinanceData;
 * - Рендеринг подвкладки "Продажи":
 *   * Карточки KPI (выручка, оплачено заказов, средний чек, возвраты);
 *   * Интерактивный график динамики продаж с группировкой (по дням, по неделям, по месяцам);
 *   * Круговая диаграмма структуры продаж по категориям (donut) с интерактивной легендой;
 *   * Детализация: переключение между "Заказы", "Топ покупателей", "Топ товаров", "Топ категорий";
 *   * Drill-down: клик по карточкам, столбцам графика или строкам топов открывает модальное окно со списком заказов;
 * - Lifecycle cleanup: корректная очистка tooltips, модалок и отмена устаревших рендеров при переключении табов;
 * - Refresh: фоновое обновление продаж (updateSales) через контроллер с последующим перечитыванием адаптера.
 */
(function (root) {
    'use strict';

    const PALETTE = [
        '#2563eb', '#0891b2', '#059669', '#d97706',
        '#dc2626', '#0ea5e9', '#db2777', '#65a30d',
        '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899'
    ];

    const SYMBOLS = { RUB: '₽', USD: '$', EUR: '€' };
    const RATES = { RUB: 1, USD: 1 / 0.011, EUR: 1.08 / 0.011 };

    // Состояние контроллера
    const state = {
        initialized: false,
        container: null,
        activeSubtab: 'overview',
        period: '7d',
        salesStep: 'day',      // 'day' | 'week' | 'month'
        salesView: 'orders',   // 'orders' | 'buyers' | 'products' | 'categories'
        visibleOrdersLimit: 50,
        renderToken: 0,
        isLoading: false,
        cachedOrders: null,
        cachedAgg: null,
        cachedPeriod: null,
        tooltipEl: null
    };

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

    function formatDate(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '—';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${mins}`;
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
        return map[period] || period;
    }

    function pluralOrders(n) {
        const abs = Math.abs(n || 0) % 100;
        const rem = abs % 10;
        if (abs > 10 && abs < 20) return `${n} заказов`;
        if (rem > 1 && rem < 5) return `${n} заказа`;
        if (rem === 1) return `${n} заказ`;
        return `${n} заказов`;
    }

    function updateCountBadge(detailsCard, orders, agg, view) {
        const countBadge = detailsCard.querySelector('#fptFinSalesCountBadge');
        if (!countBadge) return;
        if (view === 'buyers') {
            const n = (agg && agg.topBuyers) ? agg.topBuyers.length : 0;
            countBadge.textContent = `${n} покупателей`;
        } else if (view === 'products') {
            const n = (agg && agg.topProducts) ? agg.topProducts.length : 0;
            countBadge.textContent = `${n} товаров`;
        } else if (view === 'categories') {
            const n = (agg && agg.topCategories) ? agg.topCategories.length : 0;
            countBadge.textContent = `${n} категорий`;
        } else {
            countBadge.textContent = pluralOrders(orders ? orders.length : 0);
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
     * Группировка заказов по шагам: день, неделя, месяц
     */
    function groupOrdersByStep(orders, step) {
        const buckets = {};
        const allOrders = Array.isArray(orders) ? orders : [];
        const validOrders = allOrders.filter(o => o.orderStatus === 'closed' || o.orderStatus === 'paid');

        for (const o of validOrders) {
            const ts = typeof o.orderDate === 'number' ? o.orderDate : (Date.parse(o.orderDate) || 0);
            const d = new Date(ts);
            if (isNaN(d.getTime())) continue;

            let key;
            let displayLabel;
            if (step === 'month') {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                displayLabel = d.toLocaleString('ru-RU', { month: 'short', year: 'numeric' });
            } else if (step === 'week') {
                // Понедельник текущей недели
                const dayOfWeek = (d.getDay() + 6) % 7;
                const monday = new Date(d);
                monday.setDate(d.getDate() - dayOfWeek);
                key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                displayLabel = `${String(monday.getDate()).padStart(2, '0')}.${String(monday.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                displayLabel = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!buckets[key]) {
                buckets[key] = {
                    key,
                    label: displayLabel,
                    revenue: 0,
                    revenueByCur: {},
                    count: 0,
                    orders: []
                };
            }

            const p = Number(o.price) || 0;
            const cur = String(o.currency || 'RUB').toUpperCase();
            const norm = p * (RATES[cur] || 1);
            buckets[key].count++;
            buckets[key].orders.push(o);
            buckets[key].revenue += norm;
            buckets[key].revenueByCur[cur] = (buckets[key].revenueByCur[cur] || 0) + p;
        }

        const keys = Object.keys(buckets).sort();
        return keys.map(k => buckets[k]);
    }

    function renderDynamicChart(cardEl, orders, step) {
        let chartContainer = cardEl.querySelector('.fpt-fin-chart-container');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.className = 'fpt-fin-chart-container';
            const sk = cardEl.querySelector('.fpt-fin-skeleton-chart');
            if (sk) sk.replaceWith(chartContainer);
            else cardEl.appendChild(chartContainer);
        }

        const buckets = groupOrdersByStep(orders, step);

        if (!buckets.length) {
            chartContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">show_chart</span>
                    <div class="fpt-fin-empty-title">Нет данных о продажах</div>
                    <div class="fpt-fin-empty-desc">За выбранный период нет закрытых или оплаченных заказов.</div>
                </div>`;
            return;
        }

        const W = 680;
        const H = 200;
        const PAD = { t: 20, r: 20, b: 36, l: 56 };
        const cw = W - PAD.l - PAD.r;
        const ch = H - PAD.t - PAD.b;
        const baseY = PAD.t + ch;
        const slot = cw / Math.max(1, buckets.length);

        const vals = buckets.map(b => b.revenue);
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
        const accent = 'var(--fptm-accent, var(--fpt-accent, #1b75bb))';

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
                        <stop offset="0%" stop-color="#1b75bb" stop-opacity="0.28"/>
                        <stop offset="100%" stop-color="#1b75bb" stop-opacity="0.01"/>
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
                const html = `<strong>${esc(b.label)}</strong><br/>Выручка: ${esc(revStr)}<br/>Заказов: ${b.count} шт.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });

            hit.addEventListener('mousemove', (e) => {
                const revStr = formatRevenueMulti(b.revenueByCur);
                const html = `<strong>${esc(b.label)}</strong><br/>Выручка: ${esc(revStr)}<br/>Заказов: ${b.count} шт.<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });

            hit.addEventListener('mouseleave', () => {
                hideTooltip();
            });

            hit.addEventListener('click', () => {
                hideTooltip();
                const revStr = formatRevenueMulti(b.revenueByCur);
                openDrilldown(`Заказы за ${b.label}`, `${b.count} заказов · ${revStr}`, b.orders);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SVG КРУГОВАЯ ДИАГРАММА (DONUT) ПО КАТЕГОРИЯМ
    // ─────────────────────────────────────────────────────────────────────────────

    function renderCategoryDonut(cardEl, orders, agg) {
        let donutContainer = cardEl.querySelector('.fpt-fin-donut-container');
        if (!donutContainer) {
            donutContainer = document.createElement('div');
            donutContainer.className = 'fpt-fin-donut-container';
            const sk = cardEl.querySelector('.fpt-fin-skeleton-chart');
            if (sk) sk.replaceWith(donutContainer);
            else cardEl.appendChild(donutContainer);
        }

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
                    <div class="fpt-fin-empty-desc">За выбранный период нет заказов.</div>
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
                    <span class="fpt-fin-legend-val">${pct}% (${slice.count} зак.)</span>
                </div>`;
        });

        donutContainer.innerHTML = `
            <div class="fpt-fin-donut-wrap">
                <svg class="fpt-fin-donut-svg" viewBox="0 0 140 140" width="140" height="140">
                    ${paths}
                    <text x="70" y="74" text-anchor="middle" font-size="14" font-weight="700" fill="var(--fptm-text, #fff)" font-family="inherit">${totalOrders}</text>
                    <text x="70" y="87" text-anchor="middle" font-size="9" fill="var(--fptm-muted, #9099b8)" font-family="inherit">заказов</text>
                </svg>
                <div class="fpt-fin-donut-legend">
                    ${legendHTML}
                </div>
            </div>`;

        // Tooltip and click handlers
        const attachSliceEvents = (el, slice) => {
            el.addEventListener('mouseenter', (e) => {
                const revStr = formatRevenueMulti(slice.revenueByCur);
                const html = `<strong>${esc(slice.name)}</strong><br/>Заказов: ${slice.count}<br/>Выручка: ${esc(revStr)}<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });
            el.addEventListener('mousemove', (e) => {
                const revStr = formatRevenueMulti(slice.revenueByCur);
                const html = `<strong>${esc(slice.name)}</strong><br/>Заказов: ${slice.count}<br/>Выручка: ${esc(revStr)}<br/><span style="font-size:10px;opacity:.7;">Кликните для деталей</span>`;
                showTooltip(html, e.clientX, e.clientY);
            });
            el.addEventListener('mouseleave', () => {
                hideTooltip();
            });
            el.addEventListener('click', () => {
                hideTooltip();
                const revStr = formatRevenueMulti(slice.revenueByCur);
                openDrilldown(`Категория: ${slice.name}`, `${slice.count} заказов · ${revStr}`, slice.orders);
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

                const orders = await root.FPTFinanceData.getSales({
                    period: state.period,
                    useMsk: true,
                    sort: 'date-desc'
                });

                if (currentToken !== state.renderToken) return;

                const agg = root.FPTFinanceData.aggregateSales(orders, {
                    period: state.period,
                    useMsk: true
                });

                state.cachedOrders = orders;
                state.cachedAgg = agg;
                state.cachedPeriod = state.period;
                state.visibleOrdersLimit = 50;
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
            revCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Выручка от продаж</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">payments</span>
                </div>
                <div class="fpt-fin-card-value">${esc(revStr)}</div>
                <div class="fpt-fin-card-sub">${agg.byStatus.closed || 0} закрыто · ${agg.byStatus.paid || 0} в ожидании</div>`;
            revCard.title = 'Нажмите для просмотра оплаченных заказов';
            revCard.onclick = () => openDrilldown('Выручка от продаж', `${periodLabel(state.period)} · ${validOrders.length} заказов · ${revStr}`, validOrders);

            // Карточка 1: Оплачено заказов
            const ordCard = cards[1];
            ordCard.classList.add('fpt-fin-clickable');
            ordCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Оплачено заказов</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:var(--fptm-accent, var(--fpt-accent, #1b75bb));">check_circle</span>
                </div>
                <div class="fpt-fin-card-value">${agg.count} шт.</div>
                <div class="fpt-fin-card-sub">Всего заказов: ${agg.total} (учтено: ${agg.count})</div>`;
            ordCard.title = 'Нажмите для просмотра оплаченных заказов';
            ordCard.onclick = () => openDrilldown('Оплаченные заказы', `${periodLabel(state.period)} · ${validOrders.length} заказов`, validOrders);

            // Карточка 2: Средний чек продажи
            const avgCard = cards[2];
            avgCard.classList.add('fpt-fin-clickable');
            const avgStr = formatAvgCheckMulti(agg.averageCheck);
            avgCard.innerHTML = `
                <div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">Средний чек продажи</h5>
                    <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt</span>
                </div>
                <div class="fpt-fin-card-value">${esc(avgStr)}</div>
                <div class="fpt-fin-card-sub">По ${agg.count} оплаченным заказам</div>`;
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

    function onSubtabChange(target, prev) {
        state.activeSubtab = target;

        if (prev === 'sales' && target !== 'sales') {
            cleanupSales();
        }

        if (target === 'sales') {
            renderSalesSubtab(false);
        }
    }

    function onPeriodChange(newPeriod) {
        state.period = newPeriod || '7d';
        state.cachedOrders = null;
        state.cachedAgg = null;
        state.cachedPeriod = null;

        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(true);
        }
    }

    /**
     * Фоновое обновление финансовых данных по продажам
     */
    async function refresh() {
        if (!state.container) return;
        const refreshBtn = state.container.querySelector('#fptFinRefreshBtn');
        const lastUpdatedEl = state.container.querySelector('#fptFinLastUpdatedText');

        if (refreshBtn) refreshBtn.classList.add('fpt-fin-btn-spin');

        try {
            // Запуск фонового обновления только для продаж (updateSales)
            await new Promise(resolve => {
                const timer = setTimeout(resolve, 8000);
                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                        chrome.runtime.sendMessage({ action: 'updateSales' }, () => {
                            clearTimeout(timer);
                            resolve();
                        });
                    } else {
                        clearTimeout(timer);
                        resolve();
                    }
                } catch (_) {
                    clearTimeout(timer);
                    resolve();
                }
            });

            // Перечитываем метаданные через адаптер
            if (root.FPTFinanceData && typeof root.FPTFinanceData.getMeta === 'function') {
                try {
                    const meta = await root.FPTFinanceData.getMeta('sales');
                    if (lastUpdatedEl && meta && meta.lastUpdate) {
                        const d = new Date(meta.lastUpdate);
                        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        lastUpdatedEl.textContent = `Обновлено: в ${timeStr}`;
                    }
                } catch (_) {}
            }

            if (!lastUpdatedEl || !lastUpdatedEl.textContent.includes('в ')) {
                if (lastUpdatedEl) {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    lastUpdatedEl.textContent = `Обновлено: в ${timeStr}`;
                }
            }

            // Если открыта вкладка продаж — принудительно перерисовываем
            if (state.activeSubtab === 'sales') {
                await renderSalesSubtab(true);
            }

            // Анимация пульсации активных карточек
            const activeCards = state.container.querySelectorAll('.fpt-fin-tab-pane.active .fpt-fin-card');
            activeCards.forEach(c => {
                c.classList.remove('fpt-fin-pulse-anim');
                void c.offsetWidth;
                c.classList.add('fpt-fin-pulse-anim');
            });

            if (typeof root.showNotification === 'function') {
                root.showNotification('Данные о продажах обновлены', false);
            }
        } catch (err) {
            console.warn('[FPTFinanceHub] Refresh error:', err);
        } finally {
            if (refreshBtn) {
                setTimeout(() => {
                    refreshBtn.classList.remove('fpt-fin-btn-spin');
                }, 500);
            }
        }
    }

    function init(container) {
        if (!container) return;
        state.container = container;
        state.initialized = true;

        // Восстановление активной подвкладки и периода
        try {
            const savedSubtab = sessionStorage.getItem('fpt_fin_active_subtab');
            if (savedSubtab) state.activeSubtab = savedSubtab;

            const savedPeriod = sessionStorage.getItem('fpt_fin_last_period');
            if (savedPeriod) state.period = savedPeriod;
        } catch (_) {}

        const periodSelect = container.querySelector('#fptFinPeriodSelect');
        if (periodSelect && state.period) {
            periodSelect.value = state.period;
        }

        // Если активна вкладка "sales", отрисовать её
        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(false);
        }
    }

    function onOpen() {
        if (!state.container) {
            const el = document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
            if (el) init(el);
        }

        try {
            const savedSubtab = sessionStorage.getItem('fpt_fin_active_subtab');
            if (savedSubtab) state.activeSubtab = savedSubtab;
        } catch (_) {}

        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(false);
        }
    }

    // Экспорт контроллера
    const hub = {
        init,
        onOpen,
        onSubtabChange,
        onPeriodChange,
        onPageLeave: cleanupSales,
        refresh,
        renderSalesSubtab,
        cleanupSales,
        getState: () => Object.assign({}, state)
    };

    if (typeof window !== 'undefined') {
        window.fptFinanceHub = hub;
        window.FPTFinanceHub = hub;
    }
    if (root) {
        root.fptFinanceHub = hub;
        root.FPTFinanceHub = hub;
    }

    if (typeof document !== 'undefined') {
        const page = document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
        if (page) {
            init(page);
        }
    }

})(typeof window !== 'undefined' ? window : this);
