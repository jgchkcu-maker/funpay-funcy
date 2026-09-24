/* Finance Hub overview module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createOverview = function createOverview(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const formatRevenueMulti = (...args) => context.formatRevenueMulti(...args);
        const formatAvgCheckMulti = (...args) => context.formatAvgCheckMulti(...args);
        const getMskParts = (...args) => context.getMskParts(...args);
        const getMskDayKey = (...args) => context.getMskDayKey(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const updateCategorySelectOptions = (...args) => context.updateCategorySelectOptions(...args);
        const showTooltip = (...args) => context.showTooltip(...args);
        const hideTooltip = (...args) => context.hideTooltip(...args);
        const openDrilldown = (...args) => context.openDrilldown(...args);
        const smoothPath = (...args) => context.smoothPath(...args);
        const niceMax = (...args) => context.niceMax(...args);
        const fmtAxis = (...args) => context.fmtAxis(...args);
        const groupOrdersByStep = (...args) => context.groupOrdersByStep(...args);
        const renderCategoryDonut = (...args) => context.renderCategoryDonut(...args);
        const updateLastUpdatedText = (...args) => context.updateLastUpdatedText(...args);
        const operationTypeLabel = (...args) => context.operationTypeLabel(...args);
        const operationSignedValue = (...args) => context.operationSignedValue(...args);
        const operationDateLabel = (...args) => context.operationDateLabel(...args);
        const operationStatusLabel = (...args) => context.operationStatusLabel(...args);
        const getPotentialStockBreakdown = (...args) => context.getPotentialStockBreakdown(...args);
        const SYMBOLS = context.SYMBOLS;
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
                const stockBreakdown = getPotentialStockBreakdown(lotsList, potCurrency);
                if (offersEl) {
                    offersEl.textContent = (potTotals && typeof potTotals.totalActiveOffers === 'number')
                        ? `${potTotals.totalActiveOffers} активных лотов`
                        : '—';
                }
                const offersSubEl = pane.querySelector('#fptFinOverviewPotOffersSub');
                if (offersSubEl) {
                    if (potTotals && stockBreakdown) {
                        offersSubEl.innerHTML = `<span class="fpt-fin-mini-badge">С остатком: ${stockBreakdown.availableOffers}</span><span class="fpt-fin-mini-badge">0 шт.: ${stockBreakdown.zeroStockOffers}</span><span class="fpt-fin-mini-badge">Неизвестно: ${stockBreakdown.unknownStockOffers}</span><span class="fpt-fin-mini-badge">∞: ${stockBreakdown.unlimitedStockOffers}</span>`;
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

            function bindOverviewKpiKeyboard(pane) {
                if (!pane) return;

                pane.querySelectorAll('.fpt-fin-overview-kpi[role="button"]').forEach(card => {
                    if (card.dataset.fptKpiKeyboardBound === 'true') return;
                    card.dataset.fptKpiKeyboardBound = 'true';
                    card.addEventListener('keydown', event => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        card.click();
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
                bindOverviewKpiKeyboard(pane);
                await updateLastUpdatedText('overview');
            }
        return { renderOverviewSubtabLoading, renderOverviewRow1, renderOverviewRow2, renderOverviewDynamicChart, renderOverviewCharts, renderOverviewTopProducts, renderOverviewTopCategories, renderOverviewOperations, bindOverviewChartToggles, bindOverviewKpiKeyboard, renderOverviewSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
