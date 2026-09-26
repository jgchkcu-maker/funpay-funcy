/* Finance Hub operations module. */
(function (root) {
    'use strict';
    const modules = root.FPTFinanceHubModules || (root.FPTFinanceHubModules = {});
    modules.createOperations = function createOperations(context) {
        const state = context.state;
        const root = context.root;
        const esc = (...args) => context.esc(...args);
        const formatMoney = (...args) => context.formatMoney(...args);
        const periodLabel = (...args) => context.periodLabel(...args);
        const periodKey = (...args) => context.periodKey(...args);
        const showTooltip = (...args) => context.showTooltip(...args);
        const hideTooltip = (...args) => context.hideTooltip(...args);
        const fmtAxis = (...args) => context.fmtAxis(...args);
        const SYMBOLS = context.SYMBOLS;
        const OPERATION_TYPE_LABELS = context.OPERATION_TYPE_LABELS;
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

            function getOperationsNetEntries(inByCur, outByCur) {
                const currencies = new Set([
                    ...Object.keys(inByCur || {}),
                    ...Object.keys(outByCur || {})
                ]);
                const priority = { RUB: 0, USD: 1, EUR: 2 };
                return Array.from(currencies)
                    .map(currency => ({
                        currency,
                        value: (inByCur && inByCur[currency] || 0) - (outByCur && outByCur[currency] || 0)
                    }))
                    .filter(item => Math.abs(item.value) > 0.005)
                    .sort((a, b) => {
                        const ap = Object.prototype.hasOwnProperty.call(priority, a.currency) ? priority[a.currency] : 99;
                        const bp = Object.prototype.hasOwnProperty.call(priority, b.currency) ? priority[b.currency] : 99;
                        return ap - bp || a.currency.localeCompare(b.currency);
                    });
            }

            function formatOperationsNet(inByCur, outByCur) {
                const entries = getOperationsNetEntries(inByCur, outByCur);
                return entries.length
                    ? entries.map(item => formatMoney(item.value, item.currency)).join(' · ')
                    : '0 ₽';
            }

            function renderOperationsNetBadges(inByCur, outByCur) {
                const entries = getOperationsNetEntries(inByCur, outByCur);
                if (!entries.length) {
                    return '<span class="fpt-fin-operation-amount-badge is-neutral">0 ₽</span>';
                }
                return entries.map(item => {
                    const cls = item.value > 0 ? 'is-positive' : (item.value < 0 ? 'is-negative' : 'is-neutral');
                    return `<span class="fpt-fin-operation-amount-badge ${cls}">${esc(formatMoney(item.value, item.currency))}</span>`;
                }).join('');
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
                const key = periodKey(state.period);
                if (key === 'custom') return 'за ' + periodLabel(state.period);
                return ({
                    today: 'за сегодня',
                    yesterday: 'за вчера',
                    '24h': 'за 24 часа',
                    '7d': 'за неделю',
                    '30d': 'за месяц',
                    '90d': 'за 3 месяца',
                    '365d': 'за год',
                    all: 'за всё время'
                })[key] || '';
            }

            function operationFlowChart(cardEl, agg) {
                if (!cardEl) return;
                const daily = ['today', 'yesterday', '24h', '7d', '30d', 'custom'].includes(periodKey(state.period));
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
                    body.innerHTML = '<div class="fpt-ui-state fpt-fin-visual-empty"><p class="fpt-ui-state-title">Нет операций за период</p><p class="fpt-ui-state-text">Измените период или фильтры, чтобы увидеть динамику.</p></div>';
                    return;
                }

                const opCurs = new Set([
                    ...Object.keys(agg.inByCur || {}),
                    ...Object.keys(agg.outByCur || {})
                ]);
                const isSingleCurrency = opCurs.size === 1;
                const singleCur = isSingleCurrency ? [...opCurs][0] : null;
                const activeCur = (state.currency && state.currency !== 'all')
                    ? state.currency
                    : (cardEl.dataset.chosenCur || (isSingleCurrency ? singleCur : null));

                if (!activeCur && opCurs.size > 1) {
                    const curButtons = Array.from(opCurs).map(c =>
                        `<button type="button" class="fpt-ui-button fpt-ui-button--secondary fpt-fin-cur-select-btn" data-cur="${esc(c)}">${esc(c)} (${esc(SYMBOLS[c] || c)})</button>`
                    ).join('');
                    body.innerHTML = `
                        <div class="fpt-ui-state fpt-fin-visual-empty fpt-fin-currency-choice">
                            <span class="material-symbols-rounded fpt-fin-empty-icon" aria-hidden="true">currency_exchange</span>
                            <p class="fpt-ui-state-title">Выберите валюту для графика</p>
                            <p class="fpt-ui-state-text">В выбранном периоде есть разные валюты. Динамика показывается отдельно без искусственной конвертации.</p>
                            <div class="fpt-fin-chart-cur-actions">
                                ${curButtons}
                            </div>
                        </div>`;
                    body.querySelectorAll('.fpt-fin-cur-select-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            cardEl.dataset.chosenCur = btn.dataset.cur;
                            operationFlowChart(cardEl, agg);
                        });
                    });
                    return;
                }

                const sym = SYMBOLS[activeCur] || (activeCur ? ` ${activeCur}` : ' ₽');
                const W = 680, H = 220, PAD = { t: 18, r: 18, b: 38, l: 56 };
                const chartWidth = W - PAD.l - PAD.r;
                const chartHeight = H - PAD.t - PAD.b;
                const incoming = keys.map(key => {
                    const b = buckets[key];
                    if (activeCur && b.inByCur) return Number(b.inByCur[activeCur]) || 0;
                    return Number(b.in) || 0;
                });
                const outgoing = keys.map(key => {
                    const b = buckets[key];
                    if (activeCur && b.outByCur) return Number(b.outByCur[activeCur]) || 0;
                    return Number(b.out) || 0;
                });
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
                    const tip = `${key}: +${fmtAxis(incoming[index])} ${sym} / −${fmtAxis(outgoing[index])} ${sym}`;
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
                    <div class="fpt-fin-operation-chart-legend"><span class="fpt-fin-operation-in">▮</span> приход <span class="fpt-fin-operation-out">▮</span> расход ${activeCur ? `<span>· валюта: ${esc(activeCur)}</span>` : ''}</div>`;
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
                return `<div class="fpt-fin-operation-modal-row" role="listitem">
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
                overlay.innerHTML = `<div class="fpt-fin-operations-dialog" role="dialog" aria-modal="true" aria-labelledby="fpt-fin-operations-title">
                    <div class="fpt-fin-operations-dialog-head"><div class="fpt-fin-operations-heading"><strong id="fpt-fin-operations-title">${esc(title)}</strong><span>${operations.length} операций</span></div><button type="button" class="fpt-fin-operations-close" aria-label="Закрыть" title="Закрыть"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
                    <div class="fpt-fin-operations-tools"><label class="fpt-fin-operations-search"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" placeholder="Поиск по операциям…" autocomplete="off" aria-label="Поиск по операциям"></label><select class="fpt-fin-operations-sort" aria-label="Сортировка операций"><option value="date-desc">Сначала новые</option><option value="date-asc">Сначала старые</option><option value="amount-desc">Сначала крупные</option><option value="amount-asc">Сначала мелкие</option></select></div>
                    <div class="fpt-fin-operations-modal-list" role="list"></div></div>`;

                const themeSource = (state.container && typeof state.container.closest === 'function'
                    ? state.container.closest('.fp-tools-popup')
                    : null) || document.querySelector('.fp-tools-popup');
                if (themeSource) {
                    const themeStyle = typeof getComputedStyle === 'function' ? getComputedStyle(themeSource) : null;
                    const themeProps = [
                        '--fptm-bg', '--fptm-head', '--fptm-nav', '--fptm-text', '--fptm-muted', '--fptm-faint',
                        '--fptm-border', '--fptm-surface', '--fptm-surface-2', '--fptm-hover', '--fptm-field',
                        '--fptm-accent', '--fptm-accent-soft', '--fptm-accent-border', '--fptm-on-accent',
                        '--fptm-shadow', '--fptm-nav-fade',
                        '--fpt-accent', '--fpt-accent-soft', '--fpt-accent-border',
                        '--fpt-text', '--fpt-text-muted', '--fpt-bg', '--fpt-surface', '--fpt-surface-2', '--fpt-border'
                    ];
                    themeProps.forEach(name => {
                        const inlineValue = themeSource.style && typeof themeSource.style.getPropertyValue === 'function'
                            ? themeSource.style.getPropertyValue(name).trim()
                            : '';
                        const computedValue = !inlineValue && themeStyle ? themeStyle.getPropertyValue(name).trim() : '';
                        const value = inlineValue || computedValue;
                        if (value) overlay.style.setProperty(name, value);
                    });
                    const themeBg = (overlay.style.getPropertyValue('--fptm-bg')
                        || (themeStyle ? themeStyle.getPropertyValue('--fptm-bg') : '')).trim().toLowerCase();
                    overlay.style.colorScheme = (/^#(?:fff|ffffff)$/.test(themeBg) || /^rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)$/.test(themeBg))
                        ? 'light'
                        : 'dark';
                }

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
                const previouslyFocused = document.activeElement;
                const close = () => {
                    if (!overlay.isConnected) return;
                    document.removeEventListener('keydown', onKeydown);
                    overlay.remove();
                    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                        try { previouslyFocused.focus({ preventScroll: true }); } catch (_) { previouslyFocused.focus(); }
                    }
                };
                function onKeydown(event) {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        close();
                    }
                }
                overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
                overlay.querySelector('.fpt-fin-operations-close').addEventListener('click', close);
                document.addEventListener('keydown', onKeydown);
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
                card.classList.add('fpt-fin-operation-breakdown-card');

                const rows = Object.entries(agg.byType || {})
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([type, item]) => {
                        const label = operationTypeLabel(type);
                        return `<button type="button" class="fpt-fin-operation-type-row" data-fin-operation-type="${esc(type)}" aria-label="${esc(label)}: ${item.count} операций. Открыть список">
                            <span class="fpt-fin-operation-type-copy">
                                <strong>${esc(label)}</strong>
                                <small>${item.count} операций</small>
                            </span>
                            <span class="fpt-fin-operation-type-value" aria-label="Сальдо по валютам">
                                ${renderOperationsNetBadges(item.in, item.out)}
                            </span>
                            <span class="material-symbols-rounded fpt-fin-operation-type-chevron" aria-hidden="true">chevron_right</span>
                        </button>`;
                    }).join('');

                card.innerHTML = `<div class="fpt-fin-card-header">
                    <h5 class="fpt-fin-card-title">По типам операций</h5>
                    <span class="material-symbols-rounded" aria-hidden="true">account_balance_wallet</span>
                </div>
                <div class="fpt-fin-operation-types">${rows || '<div class="fpt-fin-empty-state">Нет операций за период.</div>'}</div>`;

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
                        const filterOpts = { period: state.period, sort: 'date-desc', useMsk: true };
                        if (state.currency && state.currency !== 'all') filterOpts.currency = state.currency;
                        if (state.operationStatus && state.operationStatus !== 'all') filterOpts.statuses = state.operationStatus;
                        const operations = await root.FPTFinanceData.getOperations(filterOpts);
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
        return { operationTypeLabel, operationSignedValue, formatOperationsMap, getOperationsNetEntries, formatOperationsNet, renderOperationsNetBadges, operationDateValue, operationDateLabel, operationStatusLabel, operationPeriodLabel, operationFlowChart, operationModalRow, openOperationsDrilldown, renderOperationsCards, renderOperationsBreakdown, renderOperationsTable, renderOperationsSubtabLoading, renderOperationsSubtab };
    };
})(typeof window !== 'undefined' ? window : globalThis);
