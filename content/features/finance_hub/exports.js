/* Finance Hub exports module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createExports = function createExports(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const formatRevenueMulti = (...args) => context.formatRevenueMulti(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const periodKey = (...args) => context.periodKey(...args);
        const filterPotentialLots = (...args) => context.filterPotentialLots(...args);
        const filterProfitOrders = (...args) => context.filterProfitOrders(...args);
            function applyFinanceThemeToExportOverlay(overlay) {
                if (!overlay || !overlay.style) return;
                const popup = (state.container && typeof state.container.closest === 'function'
                    ? state.container.closest('.fp-tools-popup')
                    : null) || document.querySelector('.fp-tools-popup');
                if (!popup || typeof window.getComputedStyle !== 'function') return;

                const computed = window.getComputedStyle(popup);
                [
                    '--fptm-surface',
                    '--fptm-surface-2',
                    '--fptm-field',
                    '--fptm-border',
                    '--fptm-text',
                    '--fptm-muted',
                    '--fptm-accent',
                    '--fptm-accent-soft',
                    '--fptm-on-accent'
                ].forEach((name) => {
                    const value = computed.getPropertyValue(name).trim();
                    if (value) overlay.style.setProperty(name, value);
                });
            }

            async function getDatasetForExport(datasetKey) {
                const dataset = datasetKey || (state.activeSubtab === 'overview' ? 'sales' : state.activeSubtab);
                const meta = {
                    dataset,
                    period: dataset === 'potential' ? 'snapshot' : state.period,
                    currency: state.currency,
                    status: dataset === 'operations' ? state.operationStatus : state.orderStatus,
                    orderStatus: state.orderStatus,
                    operationStatus: state.operationStatus,
                    category: state.category,
                    exportedAt: new Date().toISOString()
                };

                if (dataset === 'sales') {
                    let orders = state.cachedOrders;
                    let agg = state.cachedAgg;
                    if (!orders || state.cachedPeriod !== state.period) {
                        if (root.FPTFinanceData && typeof root.FPTFinanceData.getSales === 'function') {
                            const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                            if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                            if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                            if (state.category && state.category !== 'all') filterOpts.category = state.category;
                            orders = await root.FPTFinanceData.getSales(filterOpts);
                            agg = root.FPTFinanceData.aggregateSales(orders, { period: state.period, useMsk: true });
                        } else {
                            orders = [];
                            agg = { count: 0, total: 0, byCurrency: {} };
                        }
                    }
                    return { dataset: 'sales', items: orders || [], totals: agg || {}, meta };
                }

                if (dataset === 'purchases') {
                    let orders = state.cachedPurchasesOrders;
                    let agg = state.cachedPurchasesAgg;
                    if (!orders || state.cachedPurchasesPeriod !== state.period) {
                        if (root.FPTFinanceData && typeof root.FPTFinanceData.getPurchases === 'function') {
                            const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                            if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                            if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                            if (state.category && state.category !== 'all') filterOpts.category = state.category;
                            orders = await root.FPTFinanceData.getPurchases(filterOpts);
                            agg = root.FPTFinanceData.aggregatePurchases(orders, { period: state.period, useMsk: true });
                        } else {
                            orders = [];
                            agg = { count: 0, total: 0, byCurrency: {} };
                        }
                    }
                    return { dataset: 'purchases', items: orders || [], totals: agg || {}, meta };
                }

                if (dataset === 'operations') {
                    let operations = state.cachedOperations;
                    let agg = state.cachedOperationsAgg;
                    if (!operations || state.cachedOperationsPeriod !== state.period) {
                        if (root.FPTFinanceData && typeof root.FPTFinanceData.getOperations === 'function') {
                            const filterOpts = { period: state.period, useMsk: true, sort: 'date-desc' };
                            if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                            if (state.operationStatus && state.operationStatus !== 'all') filterOpts.statuses = state.operationStatus;
                            operations = await root.FPTFinanceData.getOperations(filterOpts);
                            agg = root.FPTFinanceData.aggregateOperations(operations);
                        } else {
                            operations = [];
                            agg = { count: 0, inByCur: {}, outByCur: {} };
                        }
                    }
                    return { dataset: 'operations', items: operations || [], totals: agg || {}, meta };
                }

                if (dataset === 'profit') {
                    const profitEngine = (typeof window !== 'undefined' && window.FPTProfitEngine) || root.FPTProfitEngine;
                    let allOrders = state.cachedProfitOrders;
                    let agg = state.cachedProfitAgg;
                    if (!allOrders || state.cachedProfitPeriod !== state.period) {
                        if (profitEngine && typeof profitEngine.getRealisedProfit === 'function') {
                            const filterOpts = { period: state.period, useMsk: true };
                            if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                            if (state.category && state.category !== 'all') filterOpts.category = state.category;
                            if (state.orderStatus && state.orderStatus !== 'all') filterOpts.statuses = state.orderStatus;
                            const result = await profitEngine.getRealisedProfit(filterOpts);
                            allOrders = Array.isArray(result.orders) ? result.orders : [];
                            agg = result.byCurrency || {};
                        } else {
                            allOrders = [];
                            agg = {};
                        }
                    }
                    const filteredOrders = filterProfitOrders(allOrders || [], state.profitFilter || 'all');
                    const availableCurrencies = Object.keys(agg || {});
                    const primaryCurrency = (state.currency && state.currency !== 'all')
                        ? state.currency
                        : ((agg && agg[state.profitCurrency]) ? state.profitCurrency : (availableCurrencies[0] || 'RUB'));

                    const aggResult = (profitEngine && typeof profitEngine.calculateProfitAggregates === 'function')
                        ? profitEngine.calculateProfitAggregates(filteredOrders, { currency: primaryCurrency })
                        : null;
                    const totals = aggResult ? aggResult.totals : ((agg && agg[primaryCurrency]) || { currency: primaryCurrency });

                    return { dataset: 'profit', items: filteredOrders, totals, meta: Object.assign(meta, { primaryCurrency }) };
                }

                if (dataset === 'potential') {
                    const potentialEngine = (typeof window !== 'undefined' && window.FPTPotential) || root.FPTPotential;
                    let lots = state.cachedPotentialLots;
                    let agg = state.cachedPotentialAgg;
                    if (!lots) {
                        if (potentialEngine && typeof potentialEngine.getInventory === 'function') {
                            lots = await potentialEngine.getInventory({ enrichPotential: true });
                            agg = potentialEngine.calculatePotentialAggregates(lots);
                        } else {
                            lots = [];
                            agg = {};
                        }
                    }
                    const activeLots = (state.category && state.category !== 'all')
                        ? (lots || []).filter(l => (l.category || '').toLowerCase() === state.category.toLowerCase())
                        : (lots || []);
                    const filteredLots = filterPotentialLots(activeLots, state.potentialFilter || 'all');
                    const availableCurrencies = Object.keys(agg || {});
                    const primaryCurrency = (state.currency && state.currency !== 'all')
                        ? state.currency
                        : ((agg && agg[state.potentialCurrency]) ? state.potentialCurrency : (availableCurrencies[0] || 'RUB'));

                    const totals = (potentialEngine && typeof potentialEngine.calculateCurrencyTotals === 'function')
                        ? potentialEngine.calculateCurrencyTotals(filteredLots, primaryCurrency)
                        : ((agg && agg[primaryCurrency]) || { currency: primaryCurrency });

                    return { dataset: 'potential', items: filteredLots, totals, meta: Object.assign(meta, { primaryCurrency }) };
                }

                return { dataset, items: [], totals: null, meta };
            }

            async function exportFinanceData(dataset, format) {
                const studio = (typeof window !== 'undefined' && window.FPTExportStudio) || root.FPTExportStudio;
                const engine = studio && studio.financeExport;
                if (!engine || typeof engine.download !== 'function') {
                    throw new Error('Модуль FPTExportStudio.financeExport не найден');
                }
                const data = await getDatasetForExport(dataset);
                return engine.download(data.dataset, format, data.items, data.totals, data.meta);
            }

            function closeExportModal() {
                if (typeof document === 'undefined') return;
                const modal = document.getElementById('fpt-fin-export-modal');
                if (modal) modal.remove();
            }

            function openExportModal() {
                if (typeof document === 'undefined') return;
                closeExportModal();

                const activeSubtab = state.activeSubtab;
                let currentDataset = ['sales', 'purchases', 'operations', 'profit', 'potential'].includes(activeSubtab)
                    ? activeSubtab
                    : 'sales';

                const overlay = document.createElement('div');
                overlay.id = 'fpt-fin-export-modal';
                overlay.className = 'fpt-fin-export-overlay';

                const periodNames = {
                    today: 'Сегодня',
                    yesterday: 'Вчера',
                    '24h': '24 часа',
                    '7d': '7 дней',
                    '30d': '30 дней',
                    '365d': '365 дней',
                    all: 'Всё время'
                };

                const orderStatusNames = {
                    all: 'Все статусы',
                    closed: 'Закрытые',
                    paid: 'Оплаченные',
                    refunded: 'Возвраты'
                };

                const operationStatusNames = {
                    all: 'Все статусы',
                    complete: 'Завершено',
                    cancel: 'Отменено',
                    waiting: 'Ожидание'
                };

                function getPeriodBadgeText(ds) {
                    if (ds === 'potential') return 'Текущий снимок';
                    return periodNames[periodKey(state.period)] || periodLabel(state.period);
                }

                function getStatusBadgeText(ds) {
                    if (ds === 'potential') return '—';
                    if (ds === 'operations') {
                        const s = state.operationStatus || 'all';
                        return operationStatusNames[s] || s;
                    }
                    const s = state.orderStatus || 'all';
                    return orderStatusNames[s] || s;
                }

                overlay.innerHTML = `
                    <div class="fpt-fin-export-dialog" role="dialog" aria-modal="true" aria-labelledby="fpt-fin-export-title">
                        <div class="fpt-fin-export-head">
                            <div class="fpt-fin-export-title-row">
                                <span class="material-symbols-rounded fpt-fin-export-title-icon">file_download</span>
                                <h4 id="fpt-fin-export-title">Экспорт финансовых данных</h4>
                            </div>
                            <button type="button" class="fpt-fin-export-close" aria-label="Закрыть">×</button>
                        </div>
                        <div class="fpt-fin-export-body">
                            <div class="fpt-fin-export-filters-bar" id="fptFinExportFiltersBar">
                                <span id="fptFinExportPeriodBadge">Период: <strong>${esc(getPeriodBadgeText(currentDataset))}</strong></span>
                                <span>Валюта: <strong>${esc(state.currency === 'all' ? 'Все валюты' : state.currency)}</strong></span>
                                <span id="fptFinExportStatusBadge">Статус: <strong>${esc(getStatusBadgeText(currentDataset))}</strong></span>
                                ${state.category !== 'all' ? `<span>Категория: <strong>${esc(state.category)}</strong></span>` : ''}
                            </div>

                            <div>
                                <div class="fpt-fin-export-section-label">Выберите набор данных:</div>
                                <div class="fpt-fin-export-tabs" id="fptFinExportTabs">
                                    <button type="button" class="fpt-fin-export-tab ${currentDataset === 'sales' ? 'active' : ''}" data-ds="sales">Продажи</button>
                                    <button type="button" class="fpt-fin-export-tab ${currentDataset === 'purchases' ? 'active' : ''}" data-ds="purchases">Покупки</button>
                                    <button type="button" class="fpt-fin-export-tab ${currentDataset === 'operations' ? 'active' : ''}" data-ds="operations">Операции</button>
                                    <button type="button" class="fpt-fin-export-tab ${currentDataset === 'profit' ? 'active' : ''}" data-ds="profit">Прибыль</button>
                                    <button type="button" class="fpt-fin-export-tab ${currentDataset === 'potential' ? 'active' : ''}" data-ds="potential">Инвентарь и потенциал</button>
                                </div>
                            </div>

                            <div class="fpt-fin-export-card" id="fptFinExportCard">
                                <div class="fpt-fin-export-loading">Загрузка данных...</div>
                            </div>

                            <div class="fpt-fin-export-actions">
                                <button type="button" class="fpt-fin-export-btn fpt-fin-export-btn-csv" id="fptFinExportDownloadCsv">
                                    <span class="material-symbols-rounded" style="font-size:16px;">table_view</span>
                                    <span>Скачать CSV</span>
                                </button>
                                <button type="button" class="fpt-fin-export-btn fpt-fin-export-btn-json" id="fptFinExportDownloadJson">
                                    <span class="material-symbols-rounded" style="font-size:16px;">data_object</span>
                                    <span>Скачать JSON</span>
                                </button>
                            </div>

                            <div class="fpt-fin-export-hint">
                                • CSV содержит UTF-8 с BOM, разделитель точка с запятой (;) и блок итогов (# TOTALS).<br>
                                • JSON содержит полную структуру с метаданными фильтров, итогами и строками.<br>
                                • Поля себестоимости и прибыли при отсутствии данных строго сохраняются как <code>null</code>.
                            </div>
                        </div>
                    </div>
                `;

                applyFinanceThemeToExportOverlay(overlay);
                document.body.appendChild(overlay);

                const cardEl = overlay.querySelector('#fptFinExportCard');
                const csvBtn = overlay.querySelector('#fptFinExportDownloadCsv');
                const jsonBtn = overlay.querySelector('#fptFinExportDownloadJson');
                const tabsEl = overlay.querySelector('#fptFinExportTabs');

                async function updateCard() {
                    if (!cardEl) return;
                    cardEl.innerHTML = '<div class="fpt-fin-export-loading">Подготовка набора данных...</div>';
                    if (csvBtn) csvBtn.disabled = true;
                    if (jsonBtn) jsonBtn.disabled = true;

                    try {
                        const data = await getDatasetForExport(currentDataset);
                        const itemsCount = data.items ? data.items.length : 0;
                        let summaryHtml = '';

                        if (currentDataset === 'sales') {
                            const rev = data.totals && data.totals.byCurrency ? formatRevenueMulti(data.totals.byCurrency) : '0 ₽';
                            summaryHtml = `
                                <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Продажи</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Заказов к выгрузке:</span><strong>${itemsCount}</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Выручка от продаж:</span><strong>${esc(rev)}</strong></div>
                            `;
                        } else if (currentDataset === 'purchases') {
                            const cost = data.totals && data.totals.byCurrency ? formatRevenueMulti(data.totals.byCurrency) : '0 ₽';
                            summaryHtml = `
                                <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Покупки</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Покупок к выгрузке:</span><strong>${itemsCount}</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Сумма покупок:</span><strong>${esc(cost)}</strong></div>
                            `;
                        } else if (currentDataset === 'operations') {
                            summaryHtml = `
                                <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Операции</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Операций к выгрузке:</span><strong>${itemsCount}</strong></div>
                            `;
                        } else if (currentDataset === 'profit') {
                            const cur = (data.totals && data.totals.currency) || 'RUB';
                            const net = data.totals && data.totals.realisedNetProfit !== null && data.totals.realisedNetProfit !== undefined
                                ? formatMoney(data.totals.realisedNetProfit, cur)
                                : 'null';
                            const knownCount = data.totals && data.totals.knownCostOrdersCount !== undefined ? data.totals.knownCostOrdersCount : 0;
                            summaryHtml = `
                                <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Реализованная прибыль</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Заказов к выгрузке:</span><strong>${itemsCount}</strong> (с себестоимостью: ${knownCount})</div>
                                <div class="fpt-fin-export-card-row"><span>Чистая прибыль:</span><strong>${esc(net)}</strong></div>
                            `;
                        } else if (currentDataset === 'potential') {
                            const cur = (data.totals && data.totals.currency) || 'RUB';
                            const potProfit = data.totals && data.totals.knownPotentialProfit !== null && data.totals.knownPotentialProfit !== undefined
                                ? formatMoney(data.totals.knownPotentialProfit, cur)
                                : 'null';
                            const finiteCount = data.totals && data.totals.finiteOffers !== undefined ? data.totals.finiteOffers : 0;
                            summaryHtml = `
                                <div class="fpt-fin-export-card-row"><span>Набор данных:</span><strong>Инвентарь и потенциал</strong></div>
                                <div class="fpt-fin-export-card-row"><span>Лотов к выгрузке:</span><strong>${itemsCount}</strong> (с остатком: ${finiteCount})</div>
                                <div class="fpt-fin-export-card-row"><span>Потенциал чистой прибыли:</span><strong>${esc(potProfit)}</strong></div>
                            `;
                        }

                        cardEl.innerHTML = summaryHtml;
                        if (csvBtn) csvBtn.disabled = false;
                        if (jsonBtn) jsonBtn.disabled = false;
                    } catch (err) {
                        console.error('[FPTFinanceHub] Export prepare error:', err);
                        cardEl.innerHTML = `<div class="fpt-fin-export-error">Ошибка загрузки данных: ${esc(err.message || err)}</div>`;
                        if (csvBtn) csvBtn.disabled = true;
                        if (jsonBtn) jsonBtn.disabled = true;
                    }
                }

                tabsEl.onclick = (e) => {
                    const btn = e.target.closest('.fpt-fin-export-tab');
                    if (!btn) return;
                    tabsEl.querySelectorAll('.fpt-fin-export-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    currentDataset = btn.dataset.ds;
                    const statusBadge = overlay.querySelector('#fptFinExportStatusBadge');
                    if (statusBadge) {
                        statusBadge.innerHTML = `Статус: <strong>${esc(getStatusBadgeText(currentDataset))}</strong>`;
                    }
                    const periodBadge = overlay.querySelector('#fptFinExportPeriodBadge');
                    if (periodBadge) {
                        periodBadge.innerHTML = `Период: <strong>${esc(getPeriodBadgeText(currentDataset))}</strong>`;
                    }
                    updateCard();
                };

                const doDownload = async (format) => {
                    const btn = format === 'csv' ? csvBtn : jsonBtn;
                    if (!btn) return;
                    const orig = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<span class="fpt-fin-export-spinner" aria-hidden="true">↻</span> Формирование...';
                    try {
                        await exportFinanceData(currentDataset, format);
                        btn.innerHTML = '✓ Скачано';
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.innerHTML = orig;
                        }, 1800);
                    } catch (err) {
                        console.error('[FPTFinanceHub] Export error:', err);
                        alert('Ошибка экспорта: ' + (err.message || err));
                        btn.disabled = false;
                        btn.innerHTML = orig;
                    }
                };

                if (csvBtn) csvBtn.onclick = () => doDownload('csv');
                if (jsonBtn) jsonBtn.onclick = () => doDownload('json');

                const closeBtn = overlay.querySelector('.fpt-fin-export-close');
                if (closeBtn) closeBtn.onclick = closeExportModal;
                overlay.onclick = (e) => {
                    if (e.target === overlay) closeExportModal();
                };

                const onEsc = (e) => {
                    if (e.key === 'Escape') {
                        closeExportModal();
                        document.removeEventListener('keydown', onEsc);
                    }
                };
                document.addEventListener('keydown', onEsc);

                updateCard();
            }
        return { applyFinanceThemeToExportOverlay, getDatasetForExport, exportFinanceData, closeExportModal, openExportModal };
    };
})(typeof window !== 'undefined' ? window : globalThis);
