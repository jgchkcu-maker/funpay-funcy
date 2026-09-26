/* Finance Hub purchases module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createPurchases = function createPurchases(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const formatRevenueMulti = (...args) => context.formatRevenueMulti(...args);
        const formatAvgCheckMulti = (...args) => context.formatAvgCheckMulti(...args);
        const formatDate = (...args) => context.formatDate(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const pluralPurchases = (...args) => context.pluralPurchases(...args);
        const updatePurchasesCountBadge = (...args) => context.updatePurchasesCountBadge(...args);
        const updateCategorySelectOptions = (...args) => context.updateCategorySelectOptions(...args);
        const openDrilldown = (...args) => context.openDrilldown(...args);
        const renderDynamicChart = (...args) => context.renderDynamicChart(...args);
        const renderCategoryDonut = (...args) => context.renderCategoryDonut(...args);
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

            function renderPurchasesTopSellersCard(cardEl, orders, agg) {
                const topSellers = (agg && agg.topSellers) ? agg.topSellers : ((agg && agg.topBuyers) ? agg.topBuyers : []);
                const sideCol = cardEl?.closest('.fpt-fin-col-4');
                const primaryCol = sideCol?.previousElementSibling?.classList?.contains('fpt-fin-col-8')
                    ? sideCol.previousElementSibling
                    : null;
                const setSideAnalyticsVisible = visible => {
                    const hasContent = Boolean(visible);
                    sideCol?.classList.toggle('fpt-fin-secondary-empty', !hasContent);
                    primaryCol?.classList.toggle('fpt-fin-primary-full', !hasContent);
                };

                const titleEl = cardEl.querySelector('.fpt-fin-card-title');
                if (titleEl) {
                    titleEl.textContent = state.purchasesCol4View === 'categories' ? 'Категории' : 'Топ продавцов';
                }

                // Управляем переключателем в заголовке карточки
                const cardHeader = cardEl.querySelector('.fpt-fin-card-header');
                if (cardHeader && !cardHeader.querySelector('.fpt-fin-chart-toggles')) {
                    const toggles = document.createElement('div');
                    toggles.className = 'fpt-ui-segmented fpt-fin-chart-toggles';
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
                    const hasCategoryBreakdown = (Array.isArray(orders) ? orders : [])
                        .some(order => order.orderStatus === 'closed' || order.orderStatus === 'paid');
                    setSideAnalyticsVisible(hasCategoryBreakdown);
                    if (hasCategoryBreakdown) {
                        renderCategoryDonut(cardEl, orders, agg, { isPurchases: true });
                    }
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
                    setSideAnalyticsVisible(false);
                    sellersContainer.innerHTML = '';
                    return;
                }

                setSideAnalyticsVisible(true);
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
                        togglesDiv.className = 'fpt-ui-segmented fpt-fin-chart-toggles';
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
                        togglesDiv.className = 'fpt-ui-segmented fpt-fin-chart-toggles';
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
        return { getPurchasesConfig, renderPurchasesTopSellersCard, renderPurchasesDetailsContent, renderPurchasesSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
