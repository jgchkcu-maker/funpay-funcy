/* Finance Hub shared ui module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createSharedUi = function createSharedUi(context) {
        const state = context.state;
        const getMskParts = (...args) => context.getMskParts(...args);
        const getMskDayKey = (...args) => context.getMskDayKey(...args);
        const getMskMonthKey = (...args) => context.getMskMonthKey(...args);
        const getMskWeekKey = (...args) => context.getMskWeekKey(...args);
        const formatMskDateTime = (...args) => context.formatMskDateTime(...args);
        const formatCustomDateLabel = (...args) => context.formatCustomDateLabel(...args);
        const PALETTE = context.PALETTE;
        const SYMBOLS = context.SYMBOLS;
            function esc(s) {
                return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                }[ch]));
            }

            function formatMoney(v, cur) {
                if (v == null || isNaN(v)) return '0 ₽';
                const c = String(cur || 'RUB').toUpperCase();
                const sym = SYMBOLS[c] || c;
                const value = Number(v);
                const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
                const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0.000001;
                const formatted = rounded.toLocaleString('ru-RU', {
                    minimumFractionDigits: hasFraction ? 2 : 0,
                    maximumFractionDigits: 2
                });
                return `${formatted}\u00A0${sym}`;
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

            function pluralPurchases(n) {
                const abs = Math.abs(n || 0) % 100;
                const rem = abs % 10;
                if (abs > 10 && abs < 20) return `${n} покупок`;
                if (rem > 1 && rem < 5) return `${n} покупки`;
                if (rem === 1) return `${n} покупка`;
                return `${n} покупок`;
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

            function openDrilldown(title, subtitle, orders) {
                const list = Array.isArray(orders) ? orders : [];
                if (typeof window !== 'undefined' && typeof window.fptOpenDrilldownModal === 'function') {
                    window.fptOpenDrilldownModal(title, subtitle, list);
                } else {
                    console.warn('[FPTFinanceHub] Drilldown modal is not available');
                }
            }

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
        return { esc, formatMoney, formatRevenueMulti, formatAvgCheckMulti, formatDate, periodLabel, pluralOrders, pluralBuyers, pluralSellers, pluralProducts, pluralCategories, pluralPurchases, updateCountBadge, updatePurchasesCountBadge, getTooltip, showTooltip, hideTooltip, removeTooltip, openDrilldown, smoothPath, niceMax, fmtAxis, groupOrdersByStep, renderDynamicChart, renderCategoryDonut };
    };
})(typeof window !== 'undefined' ? window : globalThis);
