/* Finance Hub profit module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createProfit = function createProfit(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const formatDate = (...args) => context.formatDate(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const updateCategorySelectOptions = (...args) => context.updateCategorySelectOptions(...args);
        const openDrilldown = (...args) => context.openDrilldown(...args);
        const updateLastUpdatedText = (...args) => context.updateLastUpdatedText(...args);
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
                                const selectedTotals = byCurrency[state.profitCurrency] || totals;
                                renderProfitMissingCostWarning(pane, selectedTotals, state.profitCurrency);
                                renderProfitCards(pane, selectedTotals, state.profitCurrency, byCurrency, filteredOrders);
                                renderProfitCoverage(pane, selectedTotals, state.profitCurrency);
                                renderProfitChart(pane, selectedTotals, filteredOrders, state.profitCurrency);
                                renderProfitTable(pane);
                            });
                        });
                    } else {
                        chipsContainer.innerHTML = '';
                    }
                }
            }

            function getProfitCostCoverageNotice(totals, isLoading, isError) {
                if (isError) {
                    return {
                        type: 'error',
                        title: 'Не удалось загрузить данные о прибыли',
                        description: 'Повторите обновление, чтобы проверить прибыль и покрытие себестоимости.',
                        action: false
                    };
                }
                if (isLoading) {
                    return {
                        type: 'loading',
                        title: 'Загружаем данные о себестоимости',
                        description: 'Проверяем покрытие завершённых заказов за выбранный период.',
                        action: false
                    };
                }

                const eligible = totals && Number.isFinite(Number(totals.eligibleOrdersCount))
                    ? Math.max(0, Number(totals.eligibleOrdersCount))
                    : 0;
                const known = totals && Number.isFinite(Number(totals.knownCostOrdersCount))
                    ? Math.max(0, Number(totals.knownCostOrdersCount))
                    : 0;
                const mismatched = totals && Number.isFinite(Number(totals.currencyMismatchCount))
                    ? Math.max(0, Number(totals.currencyMismatchCount))
                    : 0;

                if (eligible === 0) {
                    return {
                        type: 'empty',
                        title: 'Нет завершённых заказов за выбранный период',
                        description: 'После завершения заказа здесь появятся данные о себестоимости и реализованной прибыли.',
                        action: false
                    };
                }

                if (known === 0 && mismatched > 0) {
                    const orderWord = mismatched === 1 ? 'заказ имеет' : 'заказов имеют';
                    return {
                        type: 'mismatch',
                        title: 'Себестоимость не удалось применить',
                        description: `${mismatched} ${orderWord} себестоимость в другой валюте. Проверьте валюту себестоимости; эти заказы можно посмотреть отдельно.`,
                        action: true,
                        actionLabel: 'Показать заказы без расчёта прибыли'
                    };
                }

                if (known === 0) {
                    const orderWord = eligible === 1 ? 'завершённый заказ' : (eligible >= 2 && eligible <= 4 ? 'завершённых заказа' : 'завершённых заказов');
                    return {
                        type: 'missing',
                        title: 'Нет заказов с указанной себестоимостью',
                        description: `За выбранный период найдено ${eligible} ${orderWord}, но ни у одного не указана себестоимость. Добавьте себестоимость проданных лотов — после этого появятся прибыль, маржинальность и ROI.`,
                        action: true,
                        actionLabel: 'Показать заказы без себестоимости'
                    };
                }

                if (known < eligible) {
                    const missing = Math.max(0, eligible - known);
                    return {
                        type: 'partial',
                        title: 'Себестоимость указана не для всех заказов',
                        description: `Покрыто ${known} из ${eligible} завершённых заказов; у ${missing} заказов прибыль, маржинальность и ROI неизвестны.${mismatched > 0 ? ` В ${mismatched} заказах также не совпадает валюта себестоимости.` : ''}`,
                        action: true,
                        actionLabel: 'Показать заказы без себестоимости'
                    };
                }

                return {
                    type: 'complete',
                    title: 'Себестоимость учтена для всех заказов',
                    description: `Расчёт прибыли, маржинальности и ROI включает все ${known} завершённых заказов.`,
                    action: false
                };
            }

            function renderProfitMissingCostWarning(pane, totals, currency, isLoading = false, isError = false) {
                if (!pane) return;
                const warning = pane.querySelector('#fptFinProfitCostWarning');
                if (!warning) return;

                const notice = getProfitCostCoverageNotice(totals, isLoading, isError);
                const panel = warning.querySelector('.fpt-fin-profit-cost-warning');
                const icon = warning.querySelector('.fpt-fin-profit-cost-warning-icon');
                const title = warning.querySelector('.fpt-fin-profit-cost-warning-copy strong');
                const desc = warning.querySelector('.fpt-fin-profit-cost-warning-copy span');
                const action = warning.querySelector('#fptFinProfitCostWarningAction');
                const noticeClasses = ['is-loading', 'is-error', 'is-empty', 'is-missing', 'is-mismatch', 'is-partial', 'is-complete'];

                warning.classList.remove('fpt-fin-control-hidden');
                warning.setAttribute('aria-hidden', 'false');
                if (panel) {
                    noticeClasses.forEach(className => panel.classList.remove(className));
                    panel.classList.add(`is-${notice.type}`);
                }
                if (icon) {
                    icon.textContent = notice.type === 'complete' ? 'check_circle' : (notice.type === 'loading' ? 'progress_activity' : (notice.type === 'empty' ? 'info' : (notice.type === 'error' ? 'error_outline' : 'warning_amber')));
                    icon.classList.toggle('fpt-fin-profit-cost-warning-icon--spin', notice.type === 'loading');
                }
                if (title) title.textContent = notice.title;
                if (desc) desc.textContent = notice.description;
                if (action) {
                    action.hidden = !notice.action;
                    action.textContent = notice.actionLabel || '';
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

                const profitClass = (totals.realisedNetProfit !== null && typeof totals.realisedNetProfit === 'number')
                    ? (totals.realisedNetProfit > 0 ? ' is-positive' : (totals.realisedNetProfit < 0 ? ' is-negative' : ''))
                    : '';

                chartEl.innerHTML = `
                    <div class="fpt-fin-profit-summary">
                        <div class="fpt-fin-profit-summary-row">
                            <span class="fpt-fin-profit-summary-label">Выручка закрытых заказов</span>
                            <span class="fpt-fin-profit-summary-value">${esc(formatMoney(totals.eligibleRevenue, currency))}</span>
                        </div>
                        <div class="fpt-fin-profit-summary-row">
                            <span class="fpt-fin-profit-summary-label">Выручка с известной себестоимостью</span>
                            <span class="fpt-fin-profit-summary-value is-accent">${esc(formatMoney(totals.knownCostRevenue, currency))}</span>
                        </div>
                        <div class="fpt-fin-profit-summary-row">
                            <span class="fpt-fin-profit-summary-label">Себестоимость проданного</span>
                            <span class="fpt-fin-profit-summary-value is-cost">${esc(costStr)}</span>
                        </div>
                        <div class="fpt-fin-profit-summary-row is-total">
                            <span class="fpt-fin-profit-summary-label is-strong">Реализованная чистая прибыль</span>
                            <span class="fpt-fin-profit-summary-value is-strong${profitClass}">${esc(profitStr)}</span>
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
                    tbody.innerHTML = '<tr class="fpt-fin-empty-row"><td colspan="8"><div class="fpt-ui-state fpt-fin-table-empty"><p class="fpt-ui-state-title">Нет заказов по выбранному фильтру</p><p class="fpt-ui-state-text">Измените фильтр или период, чтобы увидеть заказы.</p></div></td></tr>';
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
                        statusCell = '<span class="fpt-fin-status-badge fpt-fin-status-success">Закрыт</span>';
                    }

                    return `
                        <tr>
                            <td><strong>${orderId}</strong></td>
                            <td class="fpt-fin-table-muted">${dateStr}</td>
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

                const missingCostAction = pane.querySelector('#fptFinProfitCostWarningAction');
                const withoutCostChip = group.querySelector('.fpt-fin-filter-chip[data-filter="without-cost"]');
                if (missingCostAction && withoutCostChip) {
                    missingCostAction.addEventListener('click', (event) => {
                        event.preventDefault();
                        withoutCostChip.click();
                    });
                }

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

                        renderProfitMissingCostWarning(pane, totals, primaryCurrency);
                        renderProfitCards(pane, totals, primaryCurrency, aggResult ? aggResult.byCurrency : null, filteredOrders);
                        renderProfitCoverage(pane, totals, primaryCurrency);
                        renderProfitChart(pane, totals, filteredOrders, primaryCurrency);
                        renderProfitTable(pane);
                    });
                });
            }

            function renderProfitSubtabLoading(pane) {
                if (!pane) return;
                renderProfitMissingCostWarning(pane, null, state.profitCurrency, true);
                ['#fptFinProfitNet', '#fptFinProfitCost', '#fptFinProfitMargin', '#fptFinProfitRoi'].forEach(sel => {
                    const el = pane.querySelector(sel);
                    if (el) el.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
                });
                const tbody = pane.querySelector('#fptFinProfitTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="8"><div class="fpt-fin-skeleton fpt-fin-table-skeleton"></div></td></tr><tr><td colspan="8"><div class="fpt-fin-skeleton fpt-fin-table-skeleton"></div></td></tr>';
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
                        state.isProfitLoading = false;
                        renderProfitMissingCostWarning(pane, null, state.profitCurrency, false, true);
                        const tbody = pane.querySelector('#fptFinProfitTableBody');
                        if (tbody) {
                            tbody.innerHTML = '<tr class="fpt-fin-empty-row"><td colspan="8"><div class="fpt-ui-state fpt-fin-table-empty is-error"><p class="fpt-ui-state-title">Не удалось загрузить данные о прибыли</p><p class="fpt-ui-state-text">Попробуйте обновить Finance Hub ещё раз.</p></div></td></tr>';
                        }
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

                renderProfitMissingCostWarning(pane, totals, primaryCurrency);
                renderProfitCards(pane, totals, primaryCurrency, aggResult ? aggResult.byCurrency : agg, filteredOrders);
                renderProfitCoverage(pane, totals, primaryCurrency);
                renderProfitChart(pane, totals, filteredOrders, primaryCurrency);
                renderProfitTable(pane);
                bindProfitFilters(pane);
                await updateLastUpdatedText('profit');
            }
        return { filterProfitOrders, renderProfitCards, getProfitCostCoverageNotice, renderProfitMissingCostWarning, renderProfitCoverage, renderProfitChart, renderProfitTable, bindProfitFilters, renderProfitSubtabLoading, renderProfitSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
