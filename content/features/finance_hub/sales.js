/* Finance Hub sales module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createSales = function createSales(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const formatRevenueMulti = (...args) => context.formatRevenueMulti(...args);
        const formatAvgCheckMulti = (...args) => context.formatAvgCheckMulti(...args);
        const formatDate = (...args) => context.formatDate(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const updateCountBadge = (...args) => context.updateCountBadge(...args);
        const updateCategorySelectOptions = (...args) => context.updateCategorySelectOptions(...args);
        const openDrilldown = (...args) => context.openDrilldown(...args);
        const renderDynamicChart = (...args) => context.renderDynamicChart(...args);
        const renderCategoryDonut = (...args) => context.renderCategoryDonut(...args);
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
        return { renderDetailsContent, renderSalesSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
