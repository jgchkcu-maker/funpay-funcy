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
    const RATES = { RUB: 1, USD: 1 / 0.011, EUR: 1.08 / 0.011 };
    const OPERATION_TYPE_LABELS = {
        order: 'Заказы',
        payment: 'Пополнения',
        withdraw: 'Выводы',
        withdraw_cancel: 'Отмены выводов',
        other: 'Другое'
    };

    // Состояние контроллера
    const state = {
        initialized: false,
        container: null,
        activeSubtab: 'overview',
        period: '7d',
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

        const buckets = groupOrdersByStep(orders, step);

        if (!buckets.length) {
            chartContainer.innerHTML = `
                <div class="fpt-fin-empty-state" style="padding:28px 16px;margin:8px 0;">
                    <span class="material-symbols-rounded fpt-fin-empty-icon" style="font-size:30px;">show_chart</span>
                    <div class="fpt-fin-empty-title">${esc(emptyTitle)}</div>
                    <div class="fpt-fin-empty-desc">${esc(emptyDesc)}</div>
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

    function cleanupPurchases() {
        hideTooltip();
        removeTooltip();
        state.purchasesRenderToken++;

        const ddOverlay = document.getElementById('fpt-dd-overlay');
        if (ddOverlay) ddOverlay.remove();
    }

    async function updateLastUpdatedText(subtab) {
        if (!state.container) return;
        const lastUpdatedEl = state.container.querySelector('#fptFinLastUpdatedText');
        if (!lastUpdatedEl) return;

        const type = subtab === 'purchases' ? 'purchases' : (subtab === 'operations' ? 'operations' : 'sales');
        if (root.FPTFinanceData && typeof root.FPTFinanceData.getMeta === 'function') {
            try {
                const meta = await root.FPTFinanceData.getMeta(type);
                if (meta && meta.lastUpdate) {
                    const d = new Date(meta.lastUpdate);
                    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    lastUpdatedEl.textContent = `Обновлено: в ${timeStr}`;
                    return;
                }
            } catch (_) {}
        }
        lastUpdatedEl.textContent = 'Не обновлялось';
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

                const orders = await root.FPTFinanceData.getPurchases({
                    period: state.period,
                    useMsk: true,
                    sort: 'date-desc'
                });

                if (currentToken !== state.purchasesRenderToken) return;

                const agg = root.FPTFinanceData.aggregatePurchases(orders, {
                    period: state.period,
                    useMsk: true
                });

                state.cachedPurchasesOrders = orders;
                state.cachedPurchasesAgg = agg;
                state.cachedPurchasesPeriod = state.period;
                state.visiblePurchasesLimit = 50;
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
        return ({
            today: 'за сегодня',
            yesterday: 'за вчера',
            '24h': 'за 24 часа',
            '7d': 'за неделю',
            '30d': 'за месяц',
            '90d': 'за 3 месяца',
            '365d': 'за год',
            all: 'за всё время'
        })[state.period] || '';
    }

    function operationFlowChart(cardEl, agg) {
        if (!cardEl) return;
        const daily = ['today', 'yesterday', '24h', '7d', '30d'].includes(state.period);
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

        const W = 680, H = 220, PAD = { t: 18, r: 18, b: 38, l: 56 };
        const chartWidth = W - PAD.l - PAD.r;
        const chartHeight = H - PAD.t - PAD.b;
        const incoming = keys.map(key => Number(buckets[key].in) || 0);
        const outgoing = keys.map(key => Number(buckets[key].out) || 0);
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
            const tip = `${key}: +${fmtAxis(incoming[index])} ₽ / −${fmtAxis(outgoing[index])} ₽`;
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
            <div class="fpt-fin-operation-chart-legend"><span class="fpt-fin-operation-in">▮</span> приход <span class="fpt-fin-operation-out">▮</span> расход <span>· визуальная ось нормализована к ₽</span></div>`;
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
                const operations = await root.FPTFinanceData.getOperations({ period: state.period, sort: 'date-desc', useMsk: true });
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
    // LIFECYCLE & EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────────

    function onSubtabChange(target, prev) {
        state.activeSubtab = target;

        if (prev === 'sales' && target !== 'sales') {
            cleanupSales();
        }
        if (prev === 'purchases' && target !== 'purchases') {
            cleanupPurchases();
        }
        if (prev === 'operations' && target !== 'operations') {
            cleanupOperations();
        }

        updateLastUpdatedText(target);

        if (target === 'sales') {
            renderSalesSubtab(false);
        } else if (target === 'purchases') {
            renderPurchasesSubtab(false);
        } else if (target === 'operations') {
            renderOperationsSubtab(false);
        }
    }

    function onPeriodChange(newPeriod) {
        state.period = newPeriod || '7d';
        state.cachedOrders = null;
        state.cachedAgg = null;
        state.cachedPeriod = null;

        state.cachedPurchasesOrders = null;
        state.cachedPurchasesAgg = null;
        state.cachedPurchasesPeriod = null;
        state.cachedOperations = null;
        state.cachedOperationsAgg = null;
        state.cachedOperationsPeriod = null;

        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(true);
        } else if (state.activeSubtab === 'purchases') {
            renderPurchasesSubtab(true);
        } else if (state.activeSubtab === 'operations') {
            renderOperationsSubtab(true);
        }
    }

    /**
     * Фоновое обновление финансовых данных (продажи или покупки в зависимости от активного таба)
     */
    async function refresh() {
        if (!state.container) return;
        const refreshBtn = state.container.querySelector('#fptFinRefreshBtn');
        const lastUpdatedEl = state.container.querySelector('#fptFinLastUpdatedText');

        if (refreshBtn) refreshBtn.classList.add('fpt-fin-btn-spin');

        const isPurchases = state.activeSubtab === 'purchases';
        const isOperations = state.activeSubtab === 'operations';
        const pCfg = getPurchasesConfig();
        const actionName = isOperations ? 'updateFinance' : (isPurchases ? (pCfg.updateAction || 'updatePurchases') : 'updateSales');
        const subtabType = isOperations ? 'operations' : (isPurchases ? 'purchases' : 'sales');
        const notificationMsg = isOperations ? 'Данные об операциях обновлены' : (isPurchases ? 'Данные о покупках обновлены' : 'Данные о продажах обновлены');

        try {
            await new Promise(resolve => {
                const timer = setTimeout(resolve, 8000);
                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                        chrome.runtime.sendMessage({ action: actionName }, () => {
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
                    const meta = await root.FPTFinanceData.getMeta(subtabType);
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

            // Принудительно перерисовываем активную подвкладку
            if (state.activeSubtab === 'sales') {
                await renderSalesSubtab(true);
            } else if (state.activeSubtab === 'purchases') {
                await renderPurchasesSubtab(true);
            } else if (state.activeSubtab === 'operations') {
                await renderOperationsSubtab(true);
            }

            // Анимация пульсации активных карточек
            const activeCards = state.container.querySelectorAll('.fpt-fin-tab-pane.active .fpt-fin-card');
            activeCards.forEach(c => {
                c.classList.remove('fpt-fin-pulse-anim');
                void c.offsetWidth;
                c.classList.add('fpt-fin-pulse-anim');
            });

            if (typeof root.showNotification === 'function') {
                root.showNotification(notificationMsg, false);
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

        updateLastUpdatedText(state.activeSubtab);

        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(false);
        } else if (state.activeSubtab === 'purchases') {
            renderPurchasesSubtab(false);
        } else if (state.activeSubtab === 'operations') {
            renderOperationsSubtab(false);
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

        updateLastUpdatedText(state.activeSubtab);

        if (state.activeSubtab === 'sales') {
            renderSalesSubtab(false);
        } else if (state.activeSubtab === 'purchases') {
            renderPurchasesSubtab(false);
        } else if (state.activeSubtab === 'operations') {
            renderOperationsSubtab(false);
        }
    }

    // Экспорт контроллера
    const hub = {
        init,
        onOpen,
        onSubtabChange,
        onPeriodChange,
        onPageLeave: () => {
            cleanupSales();
            cleanupPurchases();
            cleanupOperations();
        },
        refresh,
        renderSalesSubtab,
        renderPurchasesSubtab,
        renderOperationsSubtab,
        cleanupSales,
        cleanupPurchases,
        cleanupOperations,
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
