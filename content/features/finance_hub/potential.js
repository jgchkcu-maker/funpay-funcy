/* Finance Hub potential module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createPotential = function createPotential(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const updateCategorySelectOptions = (...args) => context.updateCategorySelectOptions(...args);
        const openDrilldown = (...args) => context.openDrilldown(...args);
        const updateLastUpdatedText = (...args) => context.updateLastUpdatedText(...args);
            function filterPotentialLots(lots, filter) {
                if (!Array.isArray(lots)) return [];
                if (filter === 'with-cost') {
                    return lots.filter(lot => lot.costBasis !== null);
                }
                if (filter === 'without-cost') {
                    return lots.filter(lot => lot.costBasis === null);
                }
                if (filter === 'finite-stock') {
                    return lots.filter(lot => lot.stockKind === 'finite' && typeof lot.stock === 'number');
                }
                return lots;
            }

            function getPotentialStockBreakdown(lots, currency) {
                const breakdown = {
                    totalActiveOffers: 0,
                    availableOffers: 0,
                    zeroStockOffers: 0,
                    unknownStockOffers: 0,
                    unlimitedStockOffers: 0
                };
                if (!Array.isArray(lots)) return breakdown;

                const targetCurrency = String(currency || '').toUpperCase();
                lots.forEach(lot => {
                    if (!lot || lot.active !== true) return;
                    if (targetCurrency && String(lot.currency || 'RUB').toUpperCase() !== targetCurrency) return;
                    breakdown.totalActiveOffers++;

                    if (lot.stockKind === 'finite' && typeof lot.stock === 'number' && Number.isFinite(lot.stock) && lot.stock >= 0) {
                        if (lot.stock === 0) breakdown.zeroStockOffers++;
                        else breakdown.availableOffers++;
                    } else if (lot.stockKind === 'unlimited') {
                        breakdown.unlimitedStockOffers++;
                    } else {
                        breakdown.unknownStockOffers++;
                    }
                });

                return breakdown;
            }

            function renderPotentialCards(pane, totals, currency, filteredLots) {
                if (!pane || !totals) return;

                // 1. Потенциал выручки
                const revEl = pane.querySelector('#fptFinPotRevenue');
                if (revEl) {
                    revEl.textContent = formatMoney(totals.sellerRevenue, currency);
                }
                const revSubEl = pane.querySelector('#fptFinPotRevenueSub');
                if (revSubEl) {
                    const gmvText = totals.buyerGmv !== null ? formatMoney(totals.buyerGmv, currency) : '—';
                    revSubEl.textContent = `Покупательский GMV: ${gmvText}`;
                }

                // 2. Потенциал прибыли
                const profEl = pane.querySelector('#fptFinPotProfit');
                if (profEl) {
                    profEl.textContent = totals.knownPotentialProfit !== null ? formatMoney(totals.knownPotentialProfit, currency) : '—';
                    profEl.className = 'fpt-fin-card-value' + (totals.knownPotentialProfit > 0 ? ' fpt-fin-operation-in' : (totals.knownPotentialProfit < 0 ? ' fpt-fin-operation-out' : ''));
                }
                const profSubEl = pane.querySelector('#fptFinPotProfitSub');
                if (profSubEl) {
                    const marginText = totals.knownMargin !== null ? `${totals.knownMargin}%` : '—';
                    const roiText = totals.knownRoi !== null ? `${totals.knownRoi}%` : '—';
                    profSubEl.textContent = `Маржа: ${marginText} • ROI: ${roiText}`;
                }

                // 3. Стоимость склада
                const costEl = pane.querySelector('#fptFinPotCost');
                if (costEl) {
                    costEl.textContent = totals.knownInventoryCost !== null ? formatMoney(totals.knownInventoryCost, currency) : '—';
                }
                const costSubEl = pane.querySelector('#fptFinPotCostSub');
                if (costSubEl) {
                    const covText = totals.costCoveragePercent !== null ? `${totals.costCoveragePercent}%` : '—';
                    costSubEl.textContent = `Покрытие себестоимости: ${covText}`;
                }

                // 4. Лоты в продаже
                const offersEl = pane.querySelector('#fptFinPotOffers');
                const stockBreakdown = getPotentialStockBreakdown(filteredLots, currency);
                if (offersEl) {
                    const activeOffers = typeof totals.totalActiveOffers === 'number'
                        ? totals.totalActiveOffers
                        : stockBreakdown.totalActiveOffers;
                    offersEl.textContent = `${activeOffers} активных лотов`;
                }
                const offersSubEl = pane.querySelector('#fptFinPotOffersSub');
                if (offersSubEl) {
                    offersSubEl.textContent = `С остатком: ${stockBreakdown.availableOffers} · 0 шт.: ${stockBreakdown.zeroStockOffers} · Неизвестно: ${stockBreakdown.unknownStockOffers} · ∞: ${stockBreakdown.unlimitedStockOffers}`;
                }

                // Drilldown binding
                const lotsList = Array.isArray(filteredLots) ? filteredLots : (state.cachedPotentialLots || []);
                const revCard = revEl && revEl.closest('.fpt-fin-card');
                if (revCard) {
                    revCard.classList.add('fpt-fin-clickable');
                    revCard.title = 'Показать лоты инвентаря';
                    revCard.onclick = () => openDrilldown('Потенциал выручки (лоты)', `${lotsList.length} предложений · ${formatMoney(totals.sellerRevenue, currency)}`, lotsList);
                }
                const profCard = profEl && profEl.closest('.fpt-fin-card');
                if (profCard) {
                    profCard.classList.add('fpt-fin-clickable');
                    profCard.title = 'Показать лоты инвентаря';
                    const profLabel = totals.knownPotentialProfit !== null ? formatMoney(totals.knownPotentialProfit, currency) : '—';
                    profCard.onclick = () => openDrilldown('Потенциал прибыли (лоты)', `${lotsList.length} предложений · ${profLabel}`, lotsList);
                }
                const costCard = costEl && costEl.closest('.fpt-fin-card');
                if (costCard) {
                    costCard.classList.add('fpt-fin-clickable');
                    costCard.title = 'Показать лоты инвентаря';
                    const costLabel = totals.knownInventoryCost !== null ? formatMoney(totals.knownInventoryCost, currency) : '—';
                    costCard.onclick = () => openDrilldown('Себестоимость склада (лоты)', `${lotsList.length} предложений · ${costLabel}`, lotsList);
                }
                const offersCard = offersEl && offersEl.closest('.fpt-fin-card');
                if (offersCard) {
                    offersCard.classList.add('fpt-fin-clickable');
                    offersCard.title = 'Показать лоты инвентаря';
                    offersCard.onclick = () => openDrilldown('Предложения в продаже', `${lotsList.length} предложений`, lotsList);
                }
            }

            function setPotentialTableEmptyState(pane, showEmpty, titleText, descriptionText, isError = false) {
                if (!pane) return;

                const tableWrap = pane.querySelector('#fptFinPotTableWrap');
                const emptyState = pane.querySelector('#fptFinPotEmptyState');
                const title = pane.querySelector('#fptFinPotEmptyTitle');
                const description = pane.querySelector('#fptFinPotEmptyDescription');

                if (tableWrap) tableWrap.classList.toggle('fpt-fin-control-hidden', showEmpty);
                if (emptyState) {
                    emptyState.classList.toggle('fpt-fin-control-hidden', !showEmpty);
                    emptyState.classList.toggle('is-error', showEmpty && isError);
                    emptyState.setAttribute('aria-hidden', showEmpty ? 'false' : 'true');
                }
                if (title && showEmpty) title.textContent = titleText || '';
                if (description && showEmpty) description.textContent = descriptionText || '';
            }

            function renderPotentialTable(pane) {
                if (!pane) return;
                const lots = state.cachedPotentialLots || [];
                const activeLots = (state.category && state.category !== 'all')
                    ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                    : lots;
                const filtered = filterPotentialLots(activeLots, state.potentialFilter || 'all');

                const badge = pane.querySelector('#fptFinPotCountBadge');
                if (badge) {
                    badge.innerHTML = `<span class="material-symbols-rounded">storefront</span> ${filtered.length} предложений`;
                }

                const tbody = pane.querySelector('#fptFinPotTableBody');
                if (!tbody) return;

                if (!filtered.length) {
                    const hasInventory = lots.length > 0;
                    setPotentialTableEmptyState(
                        pane,
                        true,
                        hasInventory ? 'По выбранным фильтрам лоты не найдены' : 'Нет активных предложений',
                        hasInventory
                            ? (activeLots.length > 0 ? 'Измените фильтр или выберите другую категорию.' : 'Для выбранной категории нет активных лотов.')
                            : 'Добавьте или активируйте лоты, чтобы увидеть их потенциал.'
                    );
                    tbody.innerHTML = '';
                    return;
                }

                setPotentialTableEmptyState(pane, false, '', '');
                tbody.innerHTML = filtered.map(lot => {
                    const offerId = lot.offerId || '';
                    const titleText = lot.title || ('Лот #' + offerId);
                    const linkHref = offerId ? `https://funpay.com/lots/offerEdit?offer=${encodeURIComponent(offerId)}` : '#';
                    const activeStatus = lot.active === false
                        ? ' <span class="fpt-fin-status-badge" style="background:rgba(229,115,115,0.15);color:#e57373;border:1px solid rgba(229,115,115,0.3);font-size:10px;padding:1px 5px;">Деактивирован</span>'
                        : '';

                    const titleCell = `<a href="${esc(linkHref)}" target="_blank" class="fpt-fin-lot-link">${esc(titleText)}</a>${activeStatus}`;
                    const categoryCell = esc(lot.category || '—');

                    let stockCell = '<span class="fpt-fin-muted">—</span>';
                    if (lot.stockKind === 'finite' && typeof lot.stock === 'number') {
                        stockCell = `${lot.stock} шт.`;
                    } else if (lot.stockKind === 'unlimited') {
                        stockCell = '<span title="Неограничено">∞</span>';
                    } else if (lot.stockKind === 'unknown') {
                        stockCell = '<span class="fpt-fin-badge-unknown" title="FunPay не указал остаток; доступное количество неизвестно." aria-label="Остаток неизвестен: FunPay не указал доступное количество">Не указан</span>';
                    }

                    const sellerPriceCell = lot.sellerPrice !== null ? esc(formatMoney(lot.sellerPrice, lot.currency)) : '—';
                    const buyerPriceCell = lot.buyerPrice !== null ? esc(formatMoney(lot.buyerPrice, lot.currency)) : '<span class="fpt-fin-muted">—</span>';
                    const costBasisCell = lot.costBasis !== null ? esc(formatMoney(lot.costBasis, lot.currency)) : '<span class="fpt-fin-muted">—</span>';
                    const revenueCell = lot.sellerRevenue !== null ? esc(formatMoney(lot.sellerRevenue, lot.currency)) : '<span class="fpt-fin-muted">—</span>';

                    let profitCell = '<span class="fpt-fin-muted">—</span>';
                    if (lot.potentialProfit !== null) {
                        const profitColor = lot.potentialProfit > 0 ? '#4caf82' : (lot.potentialProfit < 0 ? '#e57373' : '');
                        profitCell = `<span style="${profitColor ? `color:${profitColor};font-weight:600;` : ''}">${esc(formatMoney(lot.potentialProfit, lot.currency))}</span>`;
                    }

                    const marginCell = lot.margin !== null ? `${esc(lot.margin)}%` : '<span class="fpt-fin-muted">—</span>';

                    return `<tr><td>${titleCell}</td><td>${categoryCell}</td><td>${stockCell}</td><td>${sellerPriceCell}</td><td>${buyerPriceCell}</td><td>${costBasisCell}</td><td>${revenueCell}</td><td>${profitCell}</td><td>${marginCell}</td></tr>`;
                }).join('');
            }

            function bindPotentialFilters(pane) {
                if (!pane) return;
                const filterGroup = pane.querySelector('#fptFinPotFilterGroup');
                if (!filterGroup || filterGroup.dataset.fptBound) return;
                filterGroup.dataset.fptBound = '1';

                const chips = filterGroup.querySelectorAll('.fpt-fin-filter-chip');
                chips.forEach(chip => {
                    chip.addEventListener('click', (e) => {
                        e.preventDefault();
                        chips.forEach(c => c.classList.remove('active'));
                        chip.classList.add('active');
                        state.potentialFilter = chip.dataset.filter || 'all';

                        const lots = state.cachedPotentialLots || [];
                        const activeLots = (state.category && state.category !== 'all')
                            ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                            : lots;
                        const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
                        const primaryCurrency = (state.currency && state.currency !== 'all') ? state.currency : (state.potentialCurrency || 'RUB');
                        const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                        const totals = potentialEngine ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency) : null;

                        renderPotentialCards(pane, totals, primaryCurrency, filteredLots);
                        renderPotentialTable(pane);
                    });
                });
            }

            function renderPotentialSubtabLoading(pane) {
                if (!pane) return;
                setPotentialTableEmptyState(pane, false, '', '');
                ['#fptFinPotRevenue', '#fptFinPotProfit', '#fptFinPotCost', '#fptFinPotOffers'].forEach(sel => {
                    const el = pane.querySelector(sel);
                    if (el) el.innerHTML = '<div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>';
                });
                const tbody = pane.querySelector('#fptFinPotTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr><tr><td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td></tr>';
                }
            }

            async function renderPotentialSubtab(forceReload) {
                const pane = state.container && state.container.querySelector('.fpt-fin-tab-pane[data-subtab="potential"]');
                if (!pane) return;

                const currentToken = ++state.potentialRenderToken;

                if (forceReload || !state.cachedPotentialLots) {
                    state.isPotentialLoading = true;
                    renderPotentialSubtabLoading(pane);

                    try {
                        const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                        if (!potentialEngine || typeof potentialEngine.getInventory !== 'function') {
                            throw new Error('FPTPotential is not available');
                        }

                        const lots = await potentialEngine.getInventory({ enrichPotential: true, forceRefresh: forceReload });
                        const agg = potentialEngine.calculatePotentialAggregates(lots);

                        if (currentToken !== state.potentialRenderToken) return;

                        state.cachedPotentialLots = Array.isArray(lots) ? lots : [];
                        state.cachedPotentialAgg = agg || {};
                        state.potentialLastUpdate = Date.now();
                        updateLastUpdatedText('potential');
                    } catch (err) {
                        console.error('[FPTFinanceHub] Error loading inventory potential:', err);
                        if (currentToken !== state.potentialRenderToken) return;
                        const tbody = pane.querySelector('#fptFinPotTableBody');
                        setPotentialTableEmptyState(pane, true, 'Не удалось загрузить инвентарь', 'Обновите Finance Hub и попробуйте ещё раз.', true);
                        if (tbody) tbody.innerHTML = '';
                        state.isPotentialLoading = false;
                        return;
                    }
                    state.isPotentialLoading = false;
                }

                if (currentToken !== state.potentialRenderToken) return;

                const lots = state.cachedPotentialLots || [];
                updateCategorySelectOptions(lots.map(l => l.category));

                const activeLots = (state.category && state.category !== 'all')
                    ? lots.filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                    : lots;

                const agg = state.cachedPotentialAgg || {};
                const availableCurrencies = Object.keys(agg);
                const primaryCurrency = (state.currency && state.currency !== 'all')
                    ? state.currency
                    : ((agg[state.potentialCurrency]) ? state.potentialCurrency : (availableCurrencies[0] || 'RUB'));

                const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
                const totals = (potentialEngine && typeof potentialEngine.calculateCurrencyTotals === 'function')
                    ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency)
                    : (agg[primaryCurrency] || {
                        currency: primaryCurrency,
                        sellerRevenue: 0,
                        buyerGmv: 0,
                        knownInventoryCost: 0,
                        knownPotentialProfit: 0,
                        unknownStockOffers: 0,
                        finiteOffers: 0,
                        costCoveragePercent: 0,
                        knownMargin: null,
                        knownRoi: null
                    });

                renderPotentialCards(pane, totals, primaryCurrency, filteredLots);
                renderPotentialTable(pane);
                bindPotentialFilters(pane);
                await updateLastUpdatedText('potential');
            }
        return { filterPotentialLots, getPotentialStockBreakdown, renderPotentialCards, setPotentialTableEmptyState, renderPotentialTable, bindPotentialFilters, renderPotentialSubtabLoading, renderPotentialSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
