// Finance Hub screen: «Обзор и аналитика» with six tabs (overview, sales, purchases, profit,
// potential, operations). The page is built at runtime into the empty finance_hub category shell;
// data comes only through fptPopupActions, charts through FPTFinanceCharts.
(function (root) {
    'use strict';

    const PAGE_ID = 'finance_hub';
    const PERIOD_KEY = 'fpt_fin_last_period';
    const TAB_KEY = 'fpt_fin_active_subtab';
    const PAGE_SIZE = 25;
    const STALE_MS = 45000;
    // FunPay data older than this is reloaded on its own when the page is opened.
    const AUTO_REFRESH_MS = 15 * 60 * 1000;
    const MODES = Object.freeze([
        { id: 'overview', label: 'Обзор', icon: 'dashboard', action: 'fptFinTabOverview' },
        { id: 'sales', label: 'Продажи', icon: 'trending_up', action: 'fptFinTabSales' },
        { id: 'purchases', label: 'Покупки', icon: 'shopping_bag', action: 'fptFinTabPurchases' },
        { id: 'profit', label: 'Прибыль', icon: 'paid', action: 'fptFinTabProfit' },
        { id: 'potential', label: 'Потенциал', icon: 'inventory_2', action: 'fptFinTabPotential' },
        { id: 'operations', label: 'Операции', icon: 'account_balance_wallet', action: 'fptFinTabOperations' }
    ]);
    const MODE_IDS = MODES.map(mode => mode.id);
    const ORDER_STATUSES = Object.freeze([
        ['all', 'Все статусы'], ['closed', 'Закрытые'], ['paid', 'Оплаченные'], ['refunded', 'Возвраты']
    ]);
    const OPERATION_STATUSES = Object.freeze([
        ['complete', 'Завершённые'], ['waiting', 'В ожидании'], ['cancel', 'Отменённые'], ['all', 'Все статусы']
    ]);

    const M = () => root.FPTFinanceModel;
    const C = () => root.FPTFinanceCharts;

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = String(text);
        return element;
    }

    function icon(name) {
        const element = node('span', 'material-symbols-rounded', name);
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    function button(className, iconName, label, { title } = {}) {
        const el = node('button', className);
        el.type = 'button';
        if (iconName) el.appendChild(icon(iconName));
        if (label) el.appendChild(node('span', 'fpt-fin-btn-label', label));
        if (title) { el.title = title; el.setAttribute('aria-label', title); }
        return el;
    }

    function isValid(order) {
        const status = String(order.orderStatus || order.status || '').toLowerCase();
        return status === 'closed' || status === 'paid';
    }

    // Revenue, count and refunds for orders in one currency.
    function summarize(orders, currency) {
        const result = { revenue: 0, count: 0, avg: null, refundedCount: 0, refundedSum: 0, paidCount: 0, closedCount: 0, pending: 0 };
        for (const order of orders || []) {
            if (currency && String(order.currency || 'RUB').toUpperCase() !== currency) continue;
            const status = String(order.orderStatus || order.status || '').toLowerCase();
            const price = Number(order.price) || 0;
            if (status === 'refunded') { result.refundedCount++; result.refundedSum += price; continue; }
            if (status !== 'closed' && status !== 'paid') continue;
            result.revenue += price;
            result.count++;
            if (status === 'paid') { result.paidCount++; result.pending += price; } else result.closedCount++;
        }
        result.avg = M().averageCheck(result.revenue, result.count);
        return result;
    }

    function readStored(key) {
        try {
            const raw = sessionStorage.getItem(key);
            return raw == null ? null : JSON.parse(raw);
        } catch (_) { return null; }
    }

    const segmentedPillSync = new WeakMap();

    function makeSegmented(items, value, onChange, label) {
        const group = node('div', 'fpt-fin-segmented');
        group.setAttribute('role', 'group');
        if (label) group.setAttribute('aria-label', label);
        const pill = node('span', 'fpt-fin-seg-pill');
        pill.setAttribute('aria-hidden', 'true');
        group.appendChild(pill);
        const buttons = items.map(([id, text, disabled]) => {
            const el = node('button', 'fpt-fin-seg-btn', text);
            el.type = 'button';
            el.dataset.value = id;
            el.disabled = !!disabled;
            el.setAttribute('aria-pressed', String(id === value));
            el.addEventListener('click', () => {
                if (el.disabled || el.getAttribute('aria-pressed') === 'true') return;
                buttons.forEach(b => b.setAttribute('aria-pressed', String(b === el)));
                syncPill();
                onChange(id, el.closest('.fpt-fin-card'));
            });
            group.appendChild(el);
            return el;
        });
        function syncPill() {
            const active = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
            if (!active || !group.isConnected) return;
            const groupRect = group.getBoundingClientRect();
            const buttonRect = active.getBoundingClientRect();
            const style = getComputedStyle(group);
            const x = buttonRect.left - groupRect.left - (parseFloat(style.borderLeftWidth) || 0) + group.scrollLeft;
            const y = buttonRect.top - groupRect.top - (parseFloat(style.borderTopWidth) || 0);
            pill.style.width = `${buttonRect.width}px`;
            pill.style.height = `${buttonRect.height}px`;
            pill.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            if (!group.classList.contains('is-ready')) {
                pill.getBoundingClientRect();
                group.classList.add('is-ready');
            }
        }
        segmentedPillSync.set(group, syncPill);
        requestAnimationFrame(syncPill);
        return group;
    }

    // Keep live controls attached so their pill transitions and keyboard focus survive a redraw.
    function updateCardHeader(current, next) {
        if (current.matches('.fpt-fin-segmented') && next.matches('.fpt-fin-segmented')) {
            const oldButtons = Array.from(current.querySelectorAll('.fpt-fin-seg-btn'));
            const newButtons = Array.from(next.querySelectorAll('.fpt-fin-seg-btn'));
            if (oldButtons.length === newButtons.length && oldButtons.every((button, i) => button.dataset.value === newButtons[i].dataset.value)) {
                oldButtons.forEach((button, i) => {
                    button.disabled = newButtons[i].disabled;
                    button.setAttribute('aria-pressed', newButtons[i].getAttribute('aria-pressed'));
                });
                segmentedPillSync.get(current)?.();
                return;
            }
        }
        const oldChildren = Array.from(current.children);
        const newChildren = Array.from(next.children);
        if (current.querySelector('.fpt-fin-segmented') && current.className === next.className && oldChildren.length === newChildren.length) {
            oldChildren.forEach((child, i) => updateCardHeader(child, newChildren[i]));
        } else {
            current.replaceWith(next);
        }
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        if (!root.FPTFinanceModel || !root.FPTFinanceCharts) throw new Error('Не загружены модули графиков финансов.');
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptFinanceMounted === 'true') return;
        page.dataset.fptFinanceMounted = 'true';

        const model = M();
        const charts = C();
        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const savedPeriod = readStored(PERIOD_KEY);
        const savedMode = (() => { try { return sessionStorage.getItem(TAB_KEY); } catch (_) { return null; } })();

        const state = {
            mode: MODE_IDS.includes(page.dataset.fptPageMode) ? page.dataset.fptPageMode : (MODE_IDS.includes(savedMode) ? savedMode : 'overview'),
            period: savedPeriod && (typeof savedPeriod === 'object' || model.PERIODS.some(p => p.id === savedPeriod)) ? savedPeriod : '30d',
            customFrom: '', customTo: '',
            currency: 'all', category: 'all', orderStatus: 'all', operationStatus: 'complete',
            step: 'auto', metric: 'revenue',
            profitFilter: 'all', potentialFilter: 'all',
            limits: { sales: PAGE_SIZE, purchases: PAGE_SIZE, profit: PAGE_SIZE, potential: PAGE_SIZE, operations: PAGE_SIZE },
            tableViews: {},
            data: {}, loadedAt: {}, token: 0, loading: false, error: null,
            currencies: new Set(), categories: new Set(), refreshing: false, notice: null
        };

        // --- Shell --------------------------------------------------------------------------
        const help = node('aside', 'fpt-fin-help fpt-lot-help-popover');
        help.hidden = true;
        help.setAttribute('role', 'region');
        help.setAttribute('aria-label', 'Справка по финансам');
        help.appendChild(node('h2', '', 'Обзор и аналитика'));
        const helpList = node('ul');
        [
            'Данные берутся из локальной копии ваших продаж, покупок и операций — нажмите «Обновить», чтобы загрузить свежие с FunPay.',
            'Суммы в разных валютах не складываются: графики строятся в одной валюте, выберите её в фильтре.',
            'Прибыль считается только по закрытым заказам, у которых известна себестоимость. Укажите её в редакторе лота.',
            '«Потенциал» — снимок текущих лотов, период на него не влияет.'
        ].forEach(text => helpList.appendChild(node('li', '', text)));
        help.appendChild(helpList);

        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Обзор и аналитика', {
            onHelp: event => {
                const open = help.hidden;
                help.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-finance');
        view.dataset.mode = state.mode;
        if (header.helpButton) {
            const anchor = node('span', 'fpt-ad-help-anchor');
            header.helpButton.before(anchor);
            anchor.append(header.helpButton, help);
        } else {
            view.appendChild(help);
        }

        // Tabs
        const tabs = node('div', 'fpt-fin-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Разделы финансов');
        const tabPill = node('span', 'fpt-fin-tab-pill');
        tabPill.setAttribute('aria-hidden', 'true');
        tabs.appendChild(tabPill);
        const tabButtons = MODES.map(mode => {
            const tab = node('button', 'fpt-fin-tab');
            tab.type = 'button';
            tab.id = mode.action;
            tab.setAttribute('role', 'tab');
            tab.dataset.mode = mode.id;
            tab.append(icon(mode.icon), node('span', 'fpt-fin-tab-label', mode.label));
            tab.addEventListener('click', () => selectMode(mode.id, true));
            tab.addEventListener('keydown', event => {
                const index = MODE_IDS.indexOf(state.mode);
                const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : null;
                if (next === null) return;
                event.preventDefault();
                const target = MODE_IDS[(next + MODE_IDS.length) % MODE_IDS.length];
                selectMode(target, true);
                tabButtons[MODE_IDS.indexOf(target)].focus();
            });
            tabs.appendChild(tab);
            return tab;
        });
        let pillFrame = null;
        function scheduleTabPill() {
            if (pillFrame !== null) return;
            pillFrame = requestAnimationFrame(() => {
                pillFrame = null;
                const active = tabButtons.find(tab => tab.dataset.mode === state.mode);
                if (!active || !active.offsetWidth || !tabs.getClientRects().length) return;
                tabPill.style.width = `${active.offsetWidth}px`;
                tabPill.style.height = `${active.offsetHeight}px`;
                tabPill.style.transform = `translateX(${active.offsetLeft}px)`;
                if (!tabs.classList.contains('is-ready')) {
                    // Commit the initial position before enabling transitions.
                    tabPill.getBoundingClientRect();
                    tabs.classList.add('is-ready');
                }
            });
        }
        const tabResizeObserver = new ResizeObserver(scheduleTabPill);
        tabResizeObserver.observe(tabs);
        tabButtons.forEach(tab => tabResizeObserver.observe(tab));
        const tabDetachObserver = new MutationObserver(() => {
            if (page.isConnected) return;
            tabResizeObserver.disconnect();
            tabDetachObserver.disconnect();
            if (pillFrame !== null) cancelAnimationFrame(pillFrame);
        });
        tabDetachObserver.observe(document.body, { childList: true, subtree: true });

        // Filters
        const filters = node('div', 'fpt-fin-filters');
        function field(label, select, key) {
            const wrap = node('div', 'fpt-fin-field');
            wrap.dataset.field = key;
            const caption = node('span', 'fpt-fin-field-label', label);
            const holder = node('span', 'fpt-fin-select');
            select.className = 'fpt-fin-select-input';
            holder.append(select);
            root.FPTPopupUI.enhanceSelect(select, holder);
            wrap.append(caption, holder);
            return wrap;
        }
        function fillSelect(select, options, value) {
            select.replaceChildren(...options.map(([id, text]) => {
                const option = node('option', '', text);
                option.value = id;
                return option;
            }));
            select.value = options.some(([id]) => id === value) ? value : options[0][0];
        }
        const periodSelect = node('select');
        fillSelect(periodSelect, model.PERIODS.map(p => [p.id, p.label]), typeof state.period === 'object' ? 'custom' : state.period);
        const currencySelect = node('select');
        const categorySelect = node('select');
        const statusSelect = node('select');
        const periodField = field('Период', periodSelect, 'period');
        const currencyField = field('Валюта', currencySelect, 'currency');
        const categoryField = field('Категория', categorySelect, 'category');
        const statusField = field('Статус', statusSelect, 'status');

        const customRange = node('div', 'fpt-fin-custom');
        customRange.hidden = typeof state.period !== 'object' && state.period !== 'custom';
        const fromInput = node('input', 'fpt-fin-date');
        fromInput.type = 'date'; fromInput.setAttribute('aria-label', 'Начало периода');
        const toInput = node('input', 'fpt-fin-date');
        toInput.type = 'date'; toInput.setAttribute('aria-label', 'Конец периода');
        const applyRange = button('fpt-fin-btn fpt-fin-btn--primary', 'check', 'Применить');
        applyRange.id = 'fptFinCustomApplyBtn';
        const resetRange = button('fpt-fin-btn', 'restart_alt', 'Сбросить');
        resetRange.id = 'fptFinCustomResetBtn';
        const rangeError = node('span', 'fpt-fin-range-error');
        rangeError.setAttribute('role', 'alert');
        customRange.append(fromInput, node('span', 'fpt-fin-custom-dash', '—'), toInput, applyRange, resetRange, rangeError);
        if (state.period && typeof state.period === 'object') {
            fromInput.value = state.period.from || '';
            toInput.value = state.period.to || '';
        }

        const actions = node('div', 'fpt-fin-actions');
        const refreshBtn = button('fpt-fin-btn', 'refresh', 'Обновить', { title: 'Обновить данные с FunPay' });
        refreshBtn.id = 'fptFinRefreshBtn';
        const exportWrap = node('div', 'fpt-fin-export');
        const exportBtn = button('fpt-fin-btn', 'download', 'Экспорт', { title: 'Экспорт данных' });
        exportBtn.id = 'fptFinExportBtn';
        exportBtn.setAttribute('aria-haspopup', 'menu');
        exportBtn.setAttribute('aria-expanded', 'false');
        const exportMenu = node('div', 'fpt-fin-menu');
        exportMenu.setAttribute('role', 'menu');
        exportMenu.hidden = true;
        const csvItem = button('fpt-fin-menu-item', 'table_view', 'Таблица CSV');
        csvItem.id = 'fptFinExportDownloadCsv';
        const jsonItem = button('fpt-fin-menu-item', 'code', 'Данные JSON');
        jsonItem.id = 'fptFinExportDownloadJson';
        [csvItem, jsonItem].forEach(item => item.setAttribute('role', 'menuitem'));
        exportMenu.append(csvItem, jsonItem);
        exportWrap.append(exportBtn, exportMenu);
        actions.append(refreshBtn, exportWrap);

        filters.append(periodField, customRange, currencyField, categoryField, statusField, actions);
        const statusLine = node('p', 'fpt-fin-statusline');
        statusLine.setAttribute('aria-live', 'polite');
        const toolbar = node('div', 'fpt-fin-toolbar');
        toolbar.append(tabs, filters, statusLine);
        const body = node('div', 'fpt-fin-body');
        view.append(toolbar, body);
        page.appendChild(view);

        // --- Filters -> payload ---------------------------------------------------------------
        const statusEnabled = () => ['sales', 'purchases', 'operations'].includes(state.mode);
        function buildFilters(mode = state.mode) {
            const filtersPayload = { period: state.period, currency: state.currency };
            if (state.category !== 'all' && mode !== 'operations' && mode !== 'potential') filtersPayload.category = state.category;
            if ((mode === 'sales' || mode === 'purchases') && state.orderStatus !== 'all') filtersPayload.statuses = state.orderStatus;
            if (mode === 'operations') {
                if (state.operationStatus !== 'all') filtersPayload.statuses = state.operationStatus;
                else filtersPayload.includeNonComplete = true;
            }
            return filtersPayload;
        }

        function syncFilterControls() {
            const mode = state.mode;
            periodField.hidden = mode === 'potential';
            customRange.hidden = mode === 'potential' || !(periodSelect.value === 'custom');
            categoryField.hidden = ['operations', 'potential'].includes(mode);
            statusField.hidden = !statusEnabled();
            if (statusEnabled()) {
                const operations = mode === 'operations';
                statusField.querySelector('.fpt-fin-field-label').textContent = operations ? 'Статус операции' : 'Статус заказа';
                fillSelect(statusSelect, operations ? OPERATION_STATUSES : ORDER_STATUSES, operations ? state.operationStatus : state.orderStatus);
            }
            const currencies = model.sortCurrencies(Array.from(state.currencies));
            fillSelect(currencySelect, [['all', 'Все валюты'], ...currencies.map(c => [c, `${c} (${model.currencySymbol(c)})`])], state.currency);
            const categories = Array.from(state.categories).sort((a, b) => a.localeCompare(b, 'ru'));
            fillSelect(categorySelect, [['all', 'Все категории'], ...categories.map(c => [c, c])], state.category);
            exportBtn.disabled = false;
        }

        function rememberFilterOptions(result) {
            const take = orders => (orders || []).forEach(order => {
                if (order.currency) state.currencies.add(String(order.currency).toUpperCase());
                const category = order.subcategoryName || order.category;
                if (category && state.category === 'all') state.categories.add(String(category));
            });
            const sales = result.sales || (result.items && ['sales', 'purchases'].includes(state.mode) ? result : null);
            take(sales?.items); take(result.profit?.items);
            if (state.mode === 'profit' || state.mode === 'sales' || state.mode === 'purchases') take(result.items);
            (result.totals?.currencies || []).forEach(c => state.currencies.add(String(c).toUpperCase()));
            (result.sales?.totals?.currencies || []).forEach(c => state.currencies.add(String(c).toUpperCase()));
            Object.keys(result.byCurrency || {}).forEach(c => state.currencies.add(String(c).toUpperCase()));
            (result.operations?.totals?.currencies || []).forEach(c => state.currencies.add(String(c).toUpperCase()));
            Object.keys(result.potential?.byCurrency || {}).forEach(c => state.currencies.add(String(c).toUpperCase()));
            state.currencies.delete('UNKNOWN');
        }

        // --- Shared UI blocks --------------------------------------------------------------------
        function card(title, { iconName, subtitle, controls, className = '' } = {}) {
            const el = node('section', `fpt-fin-card ${className}`.trim());
            const head = node('header', 'fpt-fin-card-head');
            const copy = node('div', 'fpt-fin-card-copy');
            const heading = node('h3', 'fpt-fin-card-title');
            if (iconName) heading.appendChild(icon(iconName));
            heading.appendChild(node('span', '', title));
            copy.appendChild(heading);
            if (subtitle) copy.appendChild(node('p', 'fpt-fin-card-sub', subtitle));
            head.appendChild(copy);
            if (controls) head.appendChild(controls);
            const content = node('div', 'fpt-fin-card-body');
            el.append(head, content);
            return { el, body: content, head };
        }

        function deltaBadge(deltaValue, { invert = false } = {}) {
            if (!deltaValue || deltaValue.state === 'na') return null;
            const tone = deltaValue.state === 'flat' ? 'flat' : ((deltaValue.state === 'up') !== invert ? 'good' : 'bad');
            const badge = node('span', 'fpt-fin-delta');
            badge.dataset.tone = tone;
            badge.dataset.state = deltaValue.state;
            badge.title = 'Изменение к предыдущему периоду такой же длины';
            badge.append(icon(deltaValue.state === 'up' ? 'arrow_upward' : deltaValue.state === 'down' ? 'arrow_downward' : 'remove'),
                node('span', '', deltaValue.text));
            return badge;
        }

        function kpi({ label, iconName, tone = 'accent', value, hint, delta: deltaValue, spark, muted = false, invert = false }) {
            const el = node('article', 'fpt-fin-kpi');
            el.dataset.tone = tone;
            const head = node('div', 'fpt-fin-kpi-head');
            const tile = node('span', 'fpt-fin-kpi-icon');
            tile.appendChild(icon(iconName));
            head.append(tile, node('h4', 'fpt-fin-kpi-label', label));
            const valueEl = node('strong', 'fpt-fin-kpi-value', value);
            if (muted) valueEl.dataset.muted = 'true';
            const foot = node('div', 'fpt-fin-kpi-foot');
            const badge = deltaBadge(deltaValue, { invert });
            if (badge) foot.appendChild(badge);
            if (hint) foot.appendChild(node('span', 'fpt-fin-kpi-hint', hint));
            el.append(head, valueEl, foot);
            if (spark) el.appendChild(spark);
            return el;
        }

        function kpiRow(...items) {
            const row = node('div', 'fpt-fin-kpis');
            row.append(...items.filter(Boolean));
            return row;
        }

        function stateBlock(kind, title, description, actionLabel, onAction) {
            const block = node('div', `fpt-fin-state fpt-fin-state--${kind}`);
            block.setAttribute('role', kind === 'error' ? 'alert' : 'status');
            const iconName = kind === 'loading' ? 'progress_activity' : kind === 'error' ? 'error' : kind === 'empty-data' ? 'cloud_download' : 'inbox';
            const mark = node('span', 'fpt-fin-state-icon');
            mark.appendChild(icon(iconName));
            const copy = node('div', 'fpt-fin-state-copy');
            copy.append(node('strong', '', title), node('span', '', description));
            block.append(mark, copy);
            if (actionLabel) {
                const action = button('fpt-fin-btn fpt-fin-btn--primary', kind === 'error' ? 'refresh' : null, actionLabel);
                action.addEventListener('click', onAction);
                block.appendChild(action);
            }
            return block;
        }

        function inlineEmpty(text) {
            const el = node('p', 'fpt-fin-inline-empty', text);
            return el;
        }

        function currencyNote(currency, byCurrency) {
            if (state.currency !== 'all') return null;
            const others = model.sortCurrencies(Object.keys(byCurrency || {})).filter(cur => cur !== currency && Math.abs(byCurrency[cur]) > 0.005);
            if (!others.length) return null;
            const note = node('div', 'fpt-fin-note');
            note.append(icon('info'),
                node('span', '', `Графики и ключевые цифры показаны в ${model.currencySymbol(currency)}. Есть также: ${others.map(cur => model.formatMoney(byCurrency[cur], cur)).join(' · ')} — выберите валюту в фильтре, чтобы увидеть её отдельно.`));
            return note;
        }

        function statusPill(kind, text) {
            return root.FPTPopupUI.statusPill(kind, text);
        }

        function dataTable({ columns, rows, caption, key }) {
            const wrap = node('div', 'fpt-fin-table-wrap');
            const table = node('table', 'fpt-fin-table');
            if (caption) table.setAttribute('aria-label', caption);
            const thead = node('thead');
            const headRow = node('tr');
            columns.forEach(col => {
                const th = node('th', `${col.align === 'right' ? 'is-right' : ''} ${col.optional ? 'is-optional' : ''}`.trim(), col.label);
                th.scope = 'col';
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            const tbody = node('tbody');
            rows.forEach(row => {
                const tr = node('tr');
                columns.forEach(col => {
                    const td = node('td', `${col.align === 'right' ? 'is-right' : ''} ${col.optional ? 'is-optional' : ''} ${col.className || ''}`.trim());
                    const content = col.render(row);
                    if (content instanceof Node) td.appendChild(content); else td.textContent = content == null || content === '' ? '—' : String(content);
                    if (col.title) td.title = col.title(row) || '';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.append(thead, tbody);
            wrap.appendChild(table);
            return wrap;
        }

        // A paged table card with a "show more" footer.
        function tableCard({ title, iconName, columns, rows, limitKey, emptyText, caption, controls, subtitle }) {
            const limit = state.limits[limitKey] || PAGE_SIZE;
            const shown = rows.slice(0, limit);
            const { el, body: content } = card(title, {
                iconName, controls, subtitle: subtitle || (rows.length ? `${model.countLabel(rows.length, ['запись', 'записи', 'записей'])}` : ''),
                className: 'fpt-fin-card--table'
            });
            el.dataset.tableKey = limitKey;
            if (!rows.length) {
                content.appendChild(inlineEmpty(emptyText));
                return el;
            }
            content.appendChild(dataTable({ columns, rows: shown, caption: caption || title }));
            const foot = node('div', 'fpt-fin-table-foot');
            foot.appendChild(node('span', 'fpt-fin-table-count', `Показано ${shown.length} из ${rows.length}`));
            if (rows.length > shown.length) {
                const more = button('fpt-fin-btn', 'expand_more', 'Показать ещё');
                more.addEventListener('click', () => {
                    state.limits[limitKey] = limit + PAGE_SIZE;
                    renderPane(el);
                });
                foot.appendChild(more);
            }
            content.appendChild(foot);
            return el;
        }

        // A chart card whose body can flip to an accessible data table.
        function chartCard({ title, iconName, subtitle, controls, makeChart, tableColumns, tableRows, viewKey, className = '' }) {
            const toggle = button('fpt-fin-icon-btn', 'table_chart', null, { title: 'Показать как таблицу' });
            const tools = node('div', 'fpt-fin-card-tools');
            if (controls) tools.appendChild(controls);
            tools.appendChild(toggle);
            const { el, body: content } = card(title, { iconName, subtitle, controls: tools, className });
            const drawChart = () => { content.replaceChildren(makeChart()); };
            const drawTable = () => { content.replaceChildren(dataTable({ columns: tableColumns, rows: tableRows, caption: title })); };
            const showTable = !!state.tableViews[viewKey];
            const apply = asTable => {
                state.tableViews[viewKey] = asTable;
                toggle.firstChild.textContent = asTable ? 'bar_chart' : 'table_chart';
                toggle.title = asTable ? 'Показать график' : 'Показать как таблицу';
                toggle.setAttribute('aria-label', toggle.title);
                toggle.setAttribute('aria-pressed', String(asTable));
                if (asTable) drawTable(); else drawChart();
            };
            toggle.addEventListener('click', () => apply(!state.tableViews[viewKey]));
            apply(showTable);
            return el;
        }

        function grid(...cells) {
            const g = node('div', 'fpt-fin-grid');
            cells.forEach(([span, el]) => { if (!el) return; el.classList.add(`fpt-fin-span-${span}`); g.appendChild(el); });
            return g;
        }

        // --- Chart builders ----------------------------------------------------------------------
        function stepSegmented(items) {
            const auto = model.chooseStep(state.period, items);
            const current = state.step === 'auto' ? auto : state.step;
            return makeSegmented([['day', 'Дни'], ['week', 'Недели'], ['month', 'Месяцы']], current, (value, target) => {
                state.step = value;
                renderPane(target);
            }, 'Шаг графика');
        }

        function dynamicsChart({ orders, profitOrders, currency, metrics = ['revenue', 'count', 'profit'], viewKey, title, iconName, subtitle }) {
            const step = state.step === 'auto' ? model.chooseStep(state.period, orders) : state.step;
            const base = model.buildSalesSeries(orders, { step, currency });
            const profitSeries = profitOrders ? model.buildSalesSeries(profitOrders, { step, currency }) : null;
            const profitMap = new Map((profitSeries || []).map(bucket => [bucket.key, bucket.profit]));
            const hasProfit = !!profitSeries && profitSeries.some(bucket => bucket.profit !== null);
            let metric = metrics.includes(state.metric) ? state.metric : metrics[0];
            if (metric === 'profit' && !hasProfit) metric = 'revenue';

            const defs = {
                revenue: { label: 'Выручка', format: v => model.formatMoney(v, currency), pick: b => b.revenue, color: 0 },
                count: { label: 'Заказы', format: v => model.countLabel(v, ['заказ', 'заказа', 'заказов']), pick: b => b.count, color: 1, axis: v => String(Math.round(v)) },
                profit: { label: 'Прибыль', format: v => model.formatMoney(v, currency), pick: b => (profitMap.get(b.key) ?? 0), color: 2 }
            };
            const def = defs[metric];
            const controls = node('div', 'fpt-fin-card-controls');
            if (metrics.length > 1) {
                controls.appendChild(makeSegmented(metrics.map(id => [id, defs[id].label, id === 'profit' && !hasProfit]), metric, (value, target) => {
                    state.metric = value;
                    renderPane(target);
                }, 'Показатель'));
            }
            controls.appendChild(stepSegmented(orders));

            const hasData = base.some(bucket => def.pick(bucket) !== 0);
            return chartCard({
                title, iconName, subtitle: subtitle || `${def.label} · ${model.periodLabel(state.period).toLowerCase()} · ${model.currencySymbol(currency)}`,
                controls, viewKey: `${viewKey}:${metric}`, className: 'fpt-fin-card--chart',
                makeChart: () => {
                    if (!base.length || !hasData) return inlineEmpty('За выбранный период нет данных для графика.');
                    return charts.line({
                        points: base.map(bucket => ({ label: bucket.label, fullLabel: bucket.fullLabel, value: def.pick(bucket),
                            extra: metric === 'revenue' ? model.countLabel(bucket.count, ['заказ', 'заказа', 'заказов']) : '' })),
                        name: def.label, format: def.format, formatAxis: def.axis, colorIndex: def.color,
                        ariaLabel: `${title}: ${def.label}, ${base.length} периодов`
                    });
                },
                tableColumns: [
                    { label: 'Период', render: b => b.fullLabel },
                    { label: def.label, align: 'right', render: b => def.format(def.pick(b)) },
                    { label: 'Заказов', align: 'right', optional: true, render: b => b.count }
                ],
                tableRows: base.slice().reverse()
            });
        }

        function categoryDonutCard({ orders, currency, title = 'Структура по категориям', viewKey }) {
            const ranked = model.rankByCategory(orders, currency);
            const folded = model.foldTail(ranked, 5);
            const total = folded.total;
            const { el, body: content } = card(title, { iconName: 'donut_large', subtitle: ranked.length ? `${model.countLabel(ranked.length, ['категория', 'категории', 'категорий'])} · ${model.currencySymbol(currency)}` : '' });
            if (!folded.rows.length || total <= 0) {
                content.appendChild(inlineEmpty('Нет продаж в выбранной валюте.'));
                return el;
            }
            content.appendChild(charts.donut({
                rows: folded.rows.map(row => ({ ...row, value: row.revenue })),
                format: row => `${model.formatMoney(row.revenue, currency)} · ${Math.round(row.share * 100)}%`,
                centerValue: model.formatCompact(total), centerLabel: model.currencySymbol(currency)
            }));
            return el;
        }

        function rankingCard({ title, iconName, rows, currency, emptyText, metaFor, colorIndex = 0, limit = 6 }) {
            const { el, body: content } = card(title, { iconName, subtitle: rows.length ? `по выручке · ${model.currencySymbol(currency)}` : '' });
            if (!rows.length) {
                content.appendChild(inlineEmpty(emptyText));
                return el;
            }
            content.appendChild(charts.hbars({
                colorIndex,
                rows: rows.slice(0, limit).map(row => ({
                    name: row.name, value: row.revenue, valueText: model.formatMoney(row.revenue, currency),
                    meta: metaFor ? metaFor(row) : model.countLabel(row.count, ['заказ', 'заказа', 'заказов'])
                }))
            }));
            return el;
        }

        function orderColumns({ counterpartyLabel, counterparty }) {
            return [
                { label: 'Дата', render: o => model.formatShortDate(model.orderTimestamp(o)), className: 'is-nowrap' },
                { label: 'Заказ', optional: true, render: o => (o.orderId ? `#${String(o.orderId).replace(/^#/, '')}` : '—'), className: 'is-nowrap' },
                { label: 'Товар', render: o => o.description || '—', className: 'is-wide', title: o => o.description },
                { label: counterpartyLabel, optional: true, render: o => counterparty(o) || '—' },
                { label: 'Категория', optional: true, render: o => o.subcategoryName || o.category || '—' },
                { label: 'Сумма', align: 'right', render: o => model.formatMoney(Number(o.price) || 0, o.currency), className: 'is-nowrap is-strong' },
                { label: 'Статус', render: o => {
                    const status = String(o.orderStatus || '').toLowerCase();
                    return statusPill(status === 'refunded' ? 'error' : status === 'paid' ? 'warning' : 'success', model.STATUS_LABELS[status] || status || '—');
                } }
            ];
        }

        // --- Panes ----------------------------------------------------------------------------------
        function periodHint() { return model.periodLabel(state.period).toLowerCase(); }

        function renderOverview(d) {
            const sales = d.sales || { items: [], totals: {} };
            const orders = sales.items || [];
            const totals = sales.totals || {};
            const currency = model.pickCurrency(state.currency, totals.byCurrency, totals.currencies);
            const current = summarize(orders, currency);
            const previous = d.previous?.sales ? summarize(d.previous.sales.items, currency) : null;
            const profitTotals = d.profit?.byCurrency?.[currency] || (d.profit?.currency === currency ? d.profit?.totals : null);
            const previousProfit = d.previous?.profit?.byCurrency?.[currency] || null;
            const potential = d.potential?.totals || {};
            const potentialCurrency = d.potential?.currency || currency;
            const step = state.step === 'auto' ? model.chooseStep(state.period, orders) : state.step;
            const series = model.buildSalesSeries(orders, { step, currency });
            const hasCost = profitTotals && profitTotals.realisedNetProfit !== null && profitTotals.realisedNetProfit !== undefined;
            const spark = pick => series.length > 1 ? charts.sparkline(series.map(pick), 0) : null;

            const pane = node('div', 'fpt-fin-pane');
            const note = currencyNote(currency, totals.byCurrency);
            if (note) pane.appendChild(note);

            pane.appendChild(kpiRow(
                kpi({ label: 'Выручка', iconName: 'payments', tone: 'violet', value: model.formatMoney(current.revenue, currency),
                    hint: previous ? 'к пред. периоду' : periodHint(), delta: previous ? model.delta(current.revenue, previous.revenue) : null, spark: spark(b => b.revenue) }),
                kpi({ label: 'Чистая прибыль', iconName: 'savings', tone: 'green',
                    value: hasCost ? model.formatMoney(profitTotals.realisedNetProfit, currency) : '—', muted: !hasCost,
                    hint: hasCost ? (previousProfit ? 'к пред. периоду' : `маржа ${model.formatPercent(profitTotals.margin)}`) : 'Нужна себестоимость',
                    delta: hasCost && previousProfit ? model.delta(profitTotals.realisedNetProfit, previousProfit.realisedNetProfit) : null,
                    spark: hasCost ? charts.sparkline(model.buildSalesSeries(d.profit.items || [], { step, currency }).map(b => b.profit || 0), 2) : null }),
                kpi({ label: 'Заказы', iconName: 'shopping_cart_checkout', tone: 'blue', value: current.count.toLocaleString('ru-RU'),
                    hint: previous ? 'к пред. периоду' : periodHint(), delta: previous ? model.delta(current.count, previous.count) : null, spark: spark(b => b.count) }),
                kpi({ label: 'Средний чек', iconName: 'receipt_long', tone: 'amber', value: current.avg === null ? '—' : model.formatMoney(current.avg, currency), muted: current.avg === null,
                    hint: previous ? 'к пред. периоду' : (current.count ? `по ${model.countLabel(current.count, ['заказу', 'заказам', 'заказам'])}` : ''),
                    delta: previous ? model.delta(current.avg, previous.avg) : null })
            ));

            const potentialHead = node('div', 'fpt-fin-section-head');
            potentialHead.append(node('h3', 'fpt-fin-section-title', 'Склад и потенциал'));
            pane.appendChild(potentialHead);
            pane.appendChild(kpiRow(
                kpi({ label: 'Потенциальная выручка', iconName: 'trending_up', tone: 'cyan', value: model.formatMoney(potential.sellerRevenue || 0, potentialCurrency),
                    hint: potential.finiteOffers ? `по ${model.countLabel(potential.finiteOffers, ['лоту', 'лотам', 'лотам'])} с остатком` : 'нет лотов с остатком' }),
                kpi({ label: 'Потенциал прибыли', iconName: 'moving', tone: 'green', value: potential.knownCostOffers ? model.formatMoney(potential.knownPotentialProfit || 0, potentialCurrency) : '—', muted: !potential.knownCostOffers,
                    hint: potential.knownCostOffers ? `себестоимость у ${potential.knownCostOffers} из ${potential.finiteOffers}` : 'Укажите себестоимость лотов' }),
                kpi({ label: 'Стоимость склада', iconName: 'warehouse', tone: 'amber', value: potential.knownCostOffers ? model.formatMoney(potential.knownInventoryCost || 0, potentialCurrency) : '—', muted: !potential.knownCostOffers,
                    hint: 'по известной себестоимости' }),
                kpi({ label: 'Активные лоты', iconName: 'sell', tone: 'violet', value: (potential.totalActiveOffers || 0).toLocaleString('ru-RU'),
                    hint: potential.unknownStockOffers ? `остаток неизвестен: ${potential.unknownStockOffers}` : (potential.unlimitedStockOffers ? `без лимита: ${potential.unlimitedStockOffers}` : 'в продаже сейчас') })
            ));

            const profitOrders = d.profit?.items || null;
            const dyn = dynamicsChart({ orders, profitOrders, currency, viewKey: 'overview', title: 'Динамика', iconName: 'show_chart' });
            const cats = categoryDonutCard({ orders, currency, viewKey: 'overview' });
            const products = rankingCard({ title: 'Топ товаров', iconName: 'workspace_premium', rows: model.rankByProduct(orders, currency), currency, emptyText: 'Пока нет проданных товаров.', colorIndex: 0 });
            const topCats = rankingCard({ title: 'Топ категорий', iconName: 'category', rows: model.rankByCategory(orders, currency), currency, emptyText: 'Пока нет категорий с продажами.', colorIndex: 3,
                metaFor: row => `${model.countLabel(row.count, ['заказ', 'заказа', 'заказов'])} · средний чек ${model.formatMoney(row.count ? row.revenue / row.count : 0, currency)}` });
            const events = latestEventsCard(d.operations);
            pane.appendChild(grid([8, dyn], [4, cats], [6, products], [6, topCats], [12, events]));
            return pane;
        }

        function latestEventsCard(operationsResult) {
            const items = (operationsResult?.items || []).slice(0, 6);
            const { el, body: content } = card('Последние события', { iconName: 'history', subtitle: items.length ? 'Операции по балансу' : '' });
            if (!items.length) {
                content.appendChild(inlineEmpty('За выбранный период операций нет.'));
                return el;
            }
            const list = node('ul', 'fpt-fin-events');
            items.forEach(op => {
                const signed = Number.isFinite(op.signed) ? op.signed : Number(op.amount) || 0;
                const li = node('li', 'fpt-fin-event');
                const mark = node('span', 'fpt-fin-event-icon');
                mark.dataset.dir = signed >= 0 ? 'in' : 'out';
                mark.appendChild(icon(signed >= 0 ? 'south_west' : 'north_east'));
                const copy = node('div', 'fpt-fin-event-copy');
                const title = node('strong', '', op.title || model.OPERATION_TYPE_LABELS[op.type] || 'Операция');
                title.title = title.textContent;
                copy.append(title, node('span', '', `${model.OPERATION_TYPE_LABELS[op.type] || 'Прочее'} · ${model.formatDateTime(op.date)}`));
                const amount = node('b', 'fpt-fin-event-amount', model.formatSigned(signed, op.currency));
                amount.dataset.dir = signed >= 0 ? 'in' : 'out';
                li.append(mark, copy, amount);
                list.appendChild(li);
            });
            content.appendChild(list);
            return el;
        }

        function ordersPane(d, { kind }) {
            const orders = d.items || [];
            const totals = d.totals || {};
            const currency = model.pickCurrency(state.currency, totals.byCurrency, totals.currencies);
            const current = summarize(orders, currency);
            const isSales = kind === 'sales';
            const pane = node('div', 'fpt-fin-pane');
            const note = currencyNote(currency, totals.byCurrency);
            if (note) pane.appendChild(note);
            const series = model.buildSalesSeries(orders, { step: state.step === 'auto' ? model.chooseStep(state.period, orders) : state.step, currency });
            const spark = pick => series.length > 1 ? charts.sparkline(series.map(pick), isSales ? 0 : 1) : null;

            pane.appendChild(kpiRow(
                kpi({ label: isSales ? 'Выручка от продаж' : 'Расходы на покупки', iconName: isSales ? 'payments' : 'shopping_bag', tone: isSales ? 'violet' : 'amber',
                    value: model.formatMoney(current.revenue, currency), hint: periodHint(), spark: spark(b => b.revenue) }),
                kpi({ label: isSales ? 'Оплачено заказов' : 'Куплено товаров', iconName: isSales ? 'task_alt' : 'inventory', tone: 'blue',
                    value: current.count.toLocaleString('ru-RU'), hint: isSales && current.paidCount ? `ожидают закрытия: ${current.paidCount}` : model.countLabel(current.count, ['заказ', 'заказа', 'заказов']), spark: spark(b => b.count) }),
                kpi({ label: isSales ? 'Средний чек продажи' : 'Средний чек покупки', iconName: 'receipt_long', tone: 'cyan',
                    value: current.avg === null ? '—' : model.formatMoney(current.avg, currency), muted: current.avg === null, hint: current.count ? periodHint() : '' }),
                isSales
                    ? kpi({ label: 'Возвраты и споры', iconName: 'assignment_return', tone: 'red', value: current.refundedCount.toLocaleString('ru-RU'),
                        hint: current.refundedCount ? model.formatMoney(current.refundedSum, currency) : 'возвратов нет', invert: true })
                    : kpi({ label: 'Завершено покупок', iconName: 'verified', tone: 'green', value: current.closedCount.toLocaleString('ru-RU'),
                        hint: current.paidCount ? `в процессе: ${current.paidCount}` : 'все завершены' })
            ));

            const dyn = dynamicsChart({ orders, currency, metrics: ['revenue', 'count'], viewKey: kind,
                title: isSales ? 'Динамика продаж' : 'Динамика расходов на покупки', iconName: 'show_chart' });
            const side = isSales
                ? categoryDonutCard({ orders, currency, title: 'Продажи по категориям', viewKey: kind })
                : rankingCard({ title: 'Топ продавцов', iconName: 'storefront', rows: model.rankByCounterparty(orders, currency), currency, emptyText: 'Пока нет покупок.', colorIndex: 1 });
            const columns = orderColumns(isSales
                ? { counterpartyLabel: 'Покупатель', counterparty: o => o.buyerUsername }
                : { counterpartyLabel: 'Продавец', counterparty: o => o.sellerUsername || o.sellerName });
            const sorted = orders.slice().sort((a, b) => model.orderTimestamp(b) - model.orderTimestamp(a));
            const table = tableCard({ title: isSales ? 'Детализация продаж' : 'История покупок', iconName: 'list_alt', columns, rows: sorted, limitKey: kind,
                emptyText: isSales ? 'Продаж за выбранный период нет.' : 'Покупок за выбранный период нет.' });
            pane.appendChild(grid([8, dyn], [4, side], [12, table]));
            return pane;
        }

        function renderProfit(d) {
            const totals = d.totals || {};
            const currency = d.currency || model.pickCurrency(state.currency, null, Object.keys(d.byCurrency || {}));
            const eligible = totals.eligibleOrdersCount || 0;
            const missing = totals.missingCostOrdersCount || 0;
            const known = totals.knownCostOrdersCount || 0;
            const hasCost = known > 0 && totals.realisedNetProfit !== null && totals.realisedNetProfit !== undefined;
            const pane = node('div', 'fpt-fin-pane');
            const note = currencyNote(currency, Object.fromEntries(Object.entries(d.byCurrency || {}).map(([cur, agg]) => [cur, agg.eligibleRevenue || 0])));
            if (note) pane.appendChild(note);

            pane.appendChild(kpiRow(
                kpi({ label: 'Реализованная прибыль', iconName: 'paid', tone: 'green', value: hasCost ? model.formatMoney(totals.realisedNetProfit, currency) : '—', muted: !hasCost,
                    hint: hasCost ? `по ${model.countLabel(known, ['заказу', 'заказам', 'заказам'])}` : 'нужна себестоимость' }),
                kpi({ label: 'Себестоимость продаж', iconName: 'inventory', tone: 'amber', value: hasCost ? model.formatMoney(totals.realisedCost, currency) : '—', muted: !hasCost, hint: 'по закрытым заказам' }),
                kpi({ label: 'Маржинальность', iconName: 'percent', tone: 'violet', value: hasCost && totals.margin !== null ? model.formatPercent(totals.margin) : '—', muted: !(hasCost && totals.margin !== null), hint: 'прибыль / выручка' }),
                kpi({ label: 'ROI инвестиций', iconName: 'insights', tone: 'cyan', value: hasCost && totals.roi !== null ? model.formatPercent(totals.roi) : '—', muted: !(hasCost && totals.roi !== null), hint: 'прибыль / себестоимость' })
            ));

            pane.appendChild(coverageCard(totals, currency, { eligible, missing, known }));

            const orders = (d.items || []).slice();
            const step = state.step === 'auto' ? model.chooseStep(state.period, orders) : state.step;
            const series = model.buildSalesSeries(orders.filter(o => o.profitInfo?.hasCost), { step, currency });
            const hasSeries = series.some(b => b.revenue !== 0 || (b.profit || 0) !== 0);
            const chart = chartCard({
                title: 'Выручка vs Прибыль', iconName: 'stacked_bar_chart', subtitle: `Заказы с известной себестоимостью · ${model.currencySymbol(currency)}`,
                controls: stepSegmented(orders), viewKey: 'profit-compare', className: 'fpt-fin-card--chart',
                makeChart: () => !hasSeries ? inlineEmpty('Нет заказов с себестоимостью за выбранный период.') : charts.bars({
                    categories: series.map(b => ({ label: b.label, fullLabel: b.fullLabel })),
                    series: [
                        { name: 'Выручка', colorIndex: 0, values: series.map(b => b.revenue) },
                        { name: 'Прибыль', colorIndex: 2, values: series.map(b => b.profit || 0) }
                    ],
                    format: v => model.formatMoney(v, currency)
                }),
                tableColumns: [
                    { label: 'Период', render: b => b.fullLabel },
                    { label: 'Выручка', align: 'right', render: b => model.formatMoney(b.revenue, currency) },
                    { label: 'Прибыль', align: 'right', render: b => (b.profit === null ? '—' : model.formatMoney(b.profit, currency)) }
                ],
                tableRows: series.slice().reverse()
            });

            const filterDefs = [['all', 'Все'], ['with-cost', 'С себестоимостью'], ['without-cost', 'Без себестоимости'], ['refunded', 'Возвраты']];
            const filtered = orders.filter(order => {
                const info = order.profitInfo || {};
                if (state.profitFilter === 'with-cost') return info.hasCost;
                if (state.profitFilter === 'without-cost') return !info.hasCost && !info.isRefunded;
                if (state.profitFilter === 'refunded') return info.isRefunded;
                return true;
            }).sort((a, b) => model.orderTimestamp(b) - model.orderTimestamp(a));
            const chips = makeSegmented(filterDefs, state.profitFilter, (value, target) => { state.profitFilter = value; state.limits.profit = PAGE_SIZE; renderPane(target); }, 'Фильтр заказов');
            chips.classList.add('fpt-fin-chips');
            const table = tableCard({
                title: 'Заказы и чистая прибыль', iconName: 'list_alt', controls: chips, limitKey: 'profit', rows: filtered,
                emptyText: state.profitFilter === 'all' ? 'Заказов за выбранный период нет.' : 'В этом фильтре заказов нет.',
                columns: [
                    { label: 'Дата', render: o => model.formatShortDate(model.orderTimestamp(o)), className: 'is-nowrap' },
                    { label: 'Товар', render: o => o.description || '—', className: 'is-wide', title: o => o.description },
                    { label: 'Выручка', align: 'right', render: o => model.formatMoney(o.profitInfo?.sellerRevenue ?? o.price, o.currency), className: 'is-nowrap' },
                    { label: 'Себестоимость', align: 'right', optional: true, render: o => (o.profitInfo?.hasCost ? model.formatMoney(o.profitInfo.costBasis, o.profitInfo.costBasisCurrency || o.currency) : '—'), className: 'is-nowrap' },
                    { label: 'Прибыль', align: 'right', render: o => {
                        const info = o.profitInfo || {};
                        if (info.isRefunded) return statusPill('error', 'Возврат');
                        if (!info.hasCost) return statusPill('neutral', info.isEligible ? 'Нет себестоимости' : 'Не закрыт');
                        const profit = node('span', `fpt-fin-profit ${info.netProfit < 0 ? 'is-negative' : 'is-positive'}`, model.formatSigned(info.netProfit, o.currency));
                        return profit;
                    }, className: 'is-nowrap is-strong' }
                ]
            });
            pane.appendChild(grid([12, chart], [12, table]));
            return pane;
        }

        function coverageCard(totals, currency, { eligible, missing, known }) {
            const { el, body: content } = card('Покрытие себестоимости', { iconName: 'fact_check', subtitle: eligible ? `${model.countLabel(eligible, ['закрытый заказ', 'закрытых заказа', 'закрытых заказов'])} в периоде` : '' });
            el.classList.add('fpt-fin-coverage');
            if (!eligible) {
                content.appendChild(inlineEmpty('За выбранный период закрытых заказов нет — считать пока нечего.'));
                return el;
            }
            const percent = Math.max(0, Math.min(100, totals.orderCoverage || 0));
            const meter = node('div', 'fpt-fin-meter');
            meter.setAttribute('role', 'progressbar');
            meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100'); meter.setAttribute('aria-valuenow', String(Math.round(percent)));
            meter.setAttribute('aria-label', 'Покрытие себестоимостью');
            const fill = node('span', 'fpt-fin-meter-fill');
            fill.style.width = `${percent}%`;
            meter.appendChild(fill);
            const head = node('div', 'fpt-fin-coverage-head');
            head.append(node('strong', 'fpt-fin-coverage-value', model.formatPercent(percent, 0)),
                node('span', 'fpt-fin-coverage-text', `${known} из ${eligible} заказов имеют себестоимость`));
            content.append(head, meter);
            const warning = node('div', 'fpt-fin-warning');
            warning.dataset.kind = missing ? (known ? 'partial' : 'missing') : 'complete';
            warning.append(icon(missing ? 'warning' : 'check_circle'));
            const copy = node('div', 'fpt-fin-warning-copy');
            if (!missing) {
                copy.append(node('strong', '', 'Себестоимость указана для всех заказов'), node('span', '', 'Прибыль и маржа посчитаны по всем закрытым заказам периода.'));
                warning.appendChild(copy);
            } else {
                copy.append(
                    node('strong', '', known ? `Себестоимости нет у ${missing} ${model.plural(missing, ['заказа', 'заказов', 'заказов'])}` : 'Прибыль пока не посчитать'),
                    node('span', '', 'Укажите себестоимость в редакторе лота — новые продажи сохранят её автоматически. Заказы без неё не попадают в прибыль и маржу.')
                );
                const cta = button('fpt-fin-btn', 'filter_alt', 'Показать заказы без себестоимости');
                cta.id = 'fptFinProfitCostWarningAction';
                cta.addEventListener('click', () => { state.profitFilter = 'without-cost'; state.limits.profit = PAGE_SIZE; renderPane(body.querySelector('[data-table-key="profit"]')); });
                warning.append(copy, cta);
            }
            content.appendChild(warning);
            return el;
        }

        function renderPotential(d) {
            const totals = d.totals || {};
            const currency = d.currency || 'RUB';
            const lots = (d.items || []).filter(lot => lot.active !== false && String(lot.currency || 'RUB').toUpperCase() === currency);
            const pane = node('div', 'fpt-fin-pane');
            const note = currencyNote(currency, Object.fromEntries(Object.entries(d.byCurrency || {}).map(([cur, agg]) => [cur, agg.sellerRevenue || 0])));
            if (note) pane.appendChild(note);
            pane.appendChild(kpiRow(
                kpi({ label: 'Потенциал выручки', iconName: 'trending_up', tone: 'cyan', value: model.formatMoney(totals.sellerRevenue || 0, currency),
                    hint: totals.finiteOffers ? `по ${model.countLabel(totals.finiteOffers, ['лоту', 'лотам', 'лотам'])} с остатком` : 'нет лотов с остатком' }),
                kpi({ label: 'Потенциал прибыли', iconName: 'moving', tone: 'green', value: totals.knownCostOffers ? model.formatMoney(totals.knownPotentialProfit || 0, currency) : '—', muted: !totals.knownCostOffers,
                    hint: totals.knownCostOffers ? `маржа ${model.formatPercent(totals.knownMargin)}` : 'нужна себестоимость' }),
                kpi({ label: 'Стоимость склада', iconName: 'warehouse', tone: 'amber', value: totals.knownCostOffers ? model.formatMoney(totals.knownInventoryCost || 0, currency) : '—', muted: !totals.knownCostOffers, hint: 'по известной себестоимости' }),
                kpi({ label: 'Лоты в продаже', iconName: 'sell', tone: 'violet', value: (totals.totalActiveOffers || 0).toLocaleString('ru-RU'),
                    hint: `остаток известен у ${totals.finiteOffers || 0}` })
            ));
            const issues = [];
            if (totals.unknownStockOffers) issues.push(`у ${model.countLabel(totals.unknownStockOffers, ['лота', 'лотов', 'лотов'])} остаток неизвестен`);
            if (totals.unlimitedStockOffers) issues.push(`у ${model.countLabel(totals.unlimitedStockOffers, ['лота', 'лотов', 'лотов'])} остаток без лимита`);
            if (totals.missingCostOffers) issues.push(`у ${model.countLabel(totals.missingCostOffers, ['лота', 'лотов', 'лотов'])} нет себестоимости`);
            if (issues.length) {
                const caveat = node('div', 'fpt-fin-note');
                caveat.append(icon('info'), node('span', '', `В итоги не вошли: ${issues.join('; ')}. Потенциал считается только по лотам с известным конечным остатком.`));
                pane.appendChild(caveat);
            }

            const filterDefs = [['all', 'Все'], ['with-cost', 'С себестоимостью'], ['without-cost', 'Без себестоимости'], ['finite-stock', 'С остатком']];
            const rows = lots.filter(lot => {
                if (state.potentialFilter === 'with-cost') return lot.costBasis != null;
                if (state.potentialFilter === 'without-cost') return lot.costBasis == null;
                if (state.potentialFilter === 'finite-stock') return lot.stockKind === 'finite' && typeof lot.stock === 'number';
                return true;
            }).sort((a, b) => (b.sellerRevenue || 0) - (a.sellerRevenue || 0));
            const chips = makeSegmented(filterDefs, state.potentialFilter, (value, target) => { state.potentialFilter = value; state.limits.potential = PAGE_SIZE; renderPane(target); }, 'Фильтр лотов');
            chips.classList.add('fpt-fin-chips');
            const stockText = lot => lot.stockKind === 'finite' ? String(lot.stock) : lot.stockKind === 'unlimited' ? '∞' : '?';
            pane.appendChild(tableCard({
                title: 'Таблица активных предложений', iconName: 'list_alt', controls: chips, limitKey: 'potential', rows,
                emptyText: state.potentialFilter === 'all' ? 'Активных лотов не найдено. Нажмите «Обновить», чтобы загрузить их с FunPay.' : 'В этом фильтре лотов нет.',
                columns: [
                    { label: 'Лот', render: lot => lot.title || lot.summary || `#${lot.offerId}`, className: 'is-wide', title: lot => lot.title },
                    { label: 'Категория', optional: true, render: lot => lot.category || '—' },
                    { label: 'Цена', align: 'right', render: lot => model.formatMoney(lot.sellerPrice, lot.currency), className: 'is-nowrap' },
                    { label: 'Остаток', align: 'right', render: stockText, className: 'is-nowrap' },
                    { label: 'Себестоимость', align: 'right', optional: true, render: lot => (lot.costBasis != null ? model.formatMoney(lot.costBasis, lot.currency) : '—'), className: 'is-nowrap' },
                    { label: 'Потенциал', align: 'right', render: lot => (lot.sellerRevenue != null ? model.formatMoney(lot.sellerRevenue, lot.currency) : '—'), className: 'is-nowrap is-strong' },
                    { label: 'Прибыль', align: 'right', optional: true, render: lot => (lot.potentialProfit != null ? model.formatSigned(lot.potentialProfit, lot.currency) : '—'), className: 'is-nowrap' }
                ]
            }));
            return pane;
        }

        function renderOperations(d) {
            const agg = d.totals || {};
            const items = d.items || agg.list || [];
            const currency = model.pickCurrency(state.currency, agg.inByCur, agg.currencies);
            const typeIn = type => agg.byType?.[type]?.in?.[currency] || 0;
            const typeOut = type => agg.byType?.[type]?.out?.[currency] || 0;
            const deposits = typeIn('payment');
            const withdrawals = Math.max(0, typeOut('withdraw') - typeIn('withdraw_cancel'));
            const net = agg.netByCur?.[currency] || 0;
            const pane = node('div', 'fpt-fin-pane');
            const note = currencyNote(currency, agg.inByCur);
            if (note) pane.appendChild(note);
            pane.appendChild(kpiRow(
                kpi({ label: 'Всего пополнений', iconName: 'add_card', tone: 'green', value: model.formatMoney(deposits, currency), hint: periodHint() }),
                kpi({ label: 'Всего выводов', iconName: 'outbox', tone: 'amber', value: model.formatMoney(withdrawals, currency), hint: 'с учётом отмен' }),
                kpi({ label: 'Чистый поток (нетто)', iconName: 'swap_vert', tone: 'violet', value: model.formatSigned(net, currency), hint: `поступления ${model.formatCompact(agg.inByCur?.[currency] || 0)} · расходы ${model.formatCompact(agg.outByCur?.[currency] || 0)}` }),
                kpi({ label: 'Операций за период', iconName: 'receipt_long', tone: 'blue', value: (agg.count || 0).toLocaleString('ru-RU'), hint: agg.total > agg.count ? `ещё ${agg.total - agg.count} не завершено` : periodHint() })
            ));

            const step = state.step === 'auto' ? (() => {
                const stamps = items.map(op => op.date).filter(Number.isFinite);
                const span = stamps.length ? (Math.max(...stamps) - Math.min(...stamps)) / 86400000 : 0;
                return span > 60 ? 'month' : span > 21 ? 'week' : 'day';
            })() : state.step;
            const series = model.buildOperationSeries(items, { currency, step });
            const dyn = chartCard({
                title: 'Динамика баланса', iconName: 'bar_chart', subtitle: `Поступления и расходы · ${model.currencySymbol(currency)}`,
                controls: makeSegmented([['day', 'Дни'], ['week', 'Недели'], ['month', 'Месяцы']], step, (value, target) => { state.step = value; renderPane(target); }, 'Шаг графика'),
                viewKey: 'operations-flow', className: 'fpt-fin-card--chart',
                makeChart: () => !series.length ? inlineEmpty('За выбранный период операций нет.') : charts.bars({
                    categories: series.map(b => ({ label: b.label, fullLabel: b.fullLabel })),
                    series: [
                        { name: 'Поступления', colorIndex: 0, values: series.map(b => b.in) },
                        { name: 'Расходы', colorIndex: 1, values: series.map(b => b.out) }
                    ],
                    format: v => model.formatMoney(v, currency)
                }),
                tableColumns: [
                    { label: 'Период', render: b => b.fullLabel },
                    { label: 'Поступления', align: 'right', render: b => model.formatMoney(b.in, currency) },
                    { label: 'Расходы', align: 'right', render: b => model.formatMoney(b.out, currency) },
                    { label: 'Нетто', align: 'right', render: b => model.formatSigned(b.net, currency) }
                ],
                tableRows: series.slice().reverse()
            });

            const typeRows = Object.entries(agg.byType || {}).map(([type, info]) => {
                const total = (info.in?.[currency] || 0) + (info.out?.[currency] || 0);
                return { name: model.OPERATION_TYPE_LABELS[type] || 'Прочее', revenue: total, count: info.count || 0 };
            }).filter(row => row.revenue > 0).sort((a, b) => b.revenue - a.revenue);
            const folded = model.foldTail(typeRows, 5);
            const { el: structure, body: structureBody } = card('Структура движения', { iconName: 'donut_large', subtitle: typeRows.length ? `по типам операций · ${model.currencySymbol(currency)}` : '' });
            if (!typeRows.length) structureBody.appendChild(inlineEmpty('Нет движения в выбранной валюте.'));
            else structureBody.appendChild(charts.donut({
                rows: folded.rows.map(row => ({ ...row, value: row.revenue })),
                format: row => `${model.formatMoney(row.revenue, currency)} · ${Math.round(row.share * 100)}%`,
                centerValue: model.formatCompact(folded.total), centerLabel: model.currencySymbol(currency)
            }));

            const table = tableCard({
                title: 'История операций баланса', iconName: 'list_alt', limitKey: 'operations',
                rows: items.slice().sort((a, b) => (b.date || 0) - (a.date || 0)), emptyText: 'Операций за выбранный период нет.',
                columns: [
                    { label: 'Дата', render: op => model.formatDateTime(op.date), className: 'is-nowrap' },
                    { label: 'Операция', render: op => op.title || '—', className: 'is-wide', title: op => op.title },
                    { label: 'Тип', optional: true, render: op => model.OPERATION_TYPE_LABELS[op.type] || 'Прочее' },
                    { label: 'Статус', optional: true, render: op => statusPill(op.status === 'cancel' ? 'error' : op.status === 'waiting' ? 'warning' : 'success', model.STATUS_LABELS[op.status] || op.status || '—') },
                    { label: 'Сумма', align: 'right', className: 'is-nowrap is-strong', render: op => {
                        const signed = Number.isFinite(op.signed) ? op.signed : Number(op.amount) || 0;
                        const amount = node('span', `fpt-fin-profit ${signed < 0 ? 'is-negative' : 'is-positive'}`, model.formatSigned(signed, op.currency));
                        return amount;
                    } }
                ]
            });
            pane.appendChild(grid([8, dyn], [4, structure], [12, table]));
            return pane;
        }

        // --- Loading / rendering -------------------------------------------------------------------
        function skeletonPane() {
            const pane = node('div', 'fpt-fin-pane fpt-fin-pane--loading');
            pane.setAttribute('aria-busy', 'true');
            const row = node('div', 'fpt-fin-kpis');
            for (let i = 0; i < 4; i++) row.appendChild(node('div', 'fpt-fin-skeleton fpt-fin-skeleton--kpi'));
            const g = node('div', 'fpt-fin-grid');
            const a = node('div', 'fpt-fin-skeleton fpt-fin-skeleton--chart fpt-fin-span-8');
            const b = node('div', 'fpt-fin-skeleton fpt-fin-skeleton--chart fpt-fin-span-4');
            g.append(a, b);
            pane.append(row, g);
            return pane;
        }

        function hasAnyData(mode, d) {
            if (!d) return false;
            if (mode === 'overview') return (d.sales?.items?.length || 0) + (d.operations?.items?.length || 0) + (d.potential?.items?.length || 0) > 0;
            if (mode === 'profit') return (d.items?.length || 0) > 0;
            return (d.items?.length || 0) > 0;
        }

        function freshnessText(meta) {
            if (!meta) return '';
            const key = { overview: null, sales: 'sales', purchases: 'purchases', operations: 'operations', profit: 'sales', potential: null }[state.mode];
            const stamp = key ? meta[key]?.lastUpdate : meta.oldestLastUpdate;
            return stamp ? `Данные обновлены ${model.formatDateTime(stamp)} МСК` : 'Данные ещё не загружались';
        }

        async function readMeta() {
            try { return await root.FPTFinanceData?.getMeta?.(); } catch (_) { return null; }
        }

        function setStatusLine(text, kind) {
            statusLine.replaceChildren();
            if (!text) { delete statusLine.dataset.kind; return; }
            if (kind) statusLine.dataset.kind = kind; else delete statusLine.dataset.kind;
            const marks = { loading: 'progress_activity', success: 'check_circle', error: 'error', warning: 'warning' };
            if (marks[kind]) statusLine.appendChild(icon(marks[kind]));
            statusLine.appendChild(node('span', '', text));
        }

        let renderVersion = 0;
        let pendingDirection = null;
        async function renderPane(target) {
            const version = ++renderVersion;
            const mode = state.mode;
            const currentCards = Array.from(body.querySelectorAll('.fpt-fin-card'));
            const targetIndex = target ? currentCards.indexOf(target) : -1;
            const focusedValue = target?.contains(document.activeElement) ? document.activeElement.dataset.value : null;
            const commit = pane => {
                if (version !== renderVersion || state.mode !== mode) return;
                pane.querySelectorAll('.fpt-fin-card').forEach((card, i) => {
                    card.style.setProperty('--fpt-nav-child-delay', `${Math.min(i, 9) * 14}ms`);
                });
                if (targetIndex >= 0 && target.isConnected) {
                    const replacement = pane.querySelectorAll('.fpt-fin-card')[targetIndex];
                    if (replacement) {
                        updateCardHeader(target.querySelector('.fpt-fin-card-head'), replacement.querySelector('.fpt-fin-card-head'));
                        const nextBody = replacement.querySelector('.fpt-fin-card-body');
                        nextBody.classList.add('is-switching');
                        target.querySelector('.fpt-fin-card-body').replaceWith(nextBody);
                        if (focusedValue != null) Array.from(target.querySelectorAll('[data-value]')).find(el => el.dataset.value === focusedValue)?.focus({ preventScroll: true });
                        return;
                    }
                }
                body.replaceChildren(pane);
            };
            view.dataset.mode = mode;
            tabButtons.forEach(tab => {
                const active = tab.dataset.mode === mode;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
                tab.classList.toggle('is-active', active);
            });
            scheduleTabPill();
            syncFilterControls();
            const pane = node('div', 'fpt-fin-tab-pane');
            pane.dataset.subtab = mode;
            if (pendingDirection) pane.dataset.direction = pendingDirection;
            pendingDirection = null;
            pane.setAttribute('role', 'tabpanel');
            pane.setAttribute('aria-labelledby', MODES.find(m => m.id === mode).action);

            const data = state.data[mode];
            if (state.loading && !data) {
                if (body.firstElementChild?.dataset.subtab !== mode) { pane.appendChild(skeletonPane()); commit(pane); }
                return;
            }
            if (state.error && !data) {
                pane.appendChild(stateBlock('error', 'Не удалось собрать данные', state.error, 'Повторить', () => load({ force: true })));
                commit(pane);
                return;
            }
            if (!data) return;

            const meta = await readMeta();
            if (state.mode !== mode || version !== renderVersion) return;
            if (state.loading) setStatusLine('Обновляем данные…', 'loading');
            else if (state.notice) setStatusLine(state.notice.text, state.notice.kind);
            else setStatusLine(freshnessText(meta), '');
            if (!hasAnyData(mode, data)) {
                const neverLoaded = !meta || !(meta.sales?.count || meta.purchases?.count || meta.operations?.count);
                pane.appendChild(neverLoaded && mode !== 'potential'
                    ? stateBlock('empty-data', 'Данных пока нет', 'Загрузите продажи, покупки и операции с FunPay, чтобы увидеть аналитику.', 'Загрузить данные', () => refresh())
                    : stateBlock('empty', mode === 'potential' ? 'Активных лотов не найдено' : 'За выбранный период ничего нет', mode === 'potential'
                        ? 'Нажмите «Обновить», чтобы загрузить текущие лоты с FunPay.' : 'Измените период или фильтры — либо обновите данные.', 'Сбросить фильтры', resetFilters));
                commit(pane);
                return;
            }
            const renderers = {
                overview: renderOverview, sales: d => ordersPane(d, { kind: 'sales' }), purchases: d => ordersPane(d, { kind: 'purchases' }),
                profit: renderProfit, potential: renderPotential, operations: renderOperations
            };
            try {
                pane.appendChild(renderers[mode](data));
            } catch (error) {
                console.error('FunPay Funcy: ошибка отрисовки финансов', error);
                pane.appendChild(stateBlock('error', 'Не удалось показать раздел', error.message || 'Попробуйте обновить данные.', 'Повторить', () => load({ force: true })));
            }
            commit(pane);
        }

        async function load({ force = false } = {}) {
            const mode = state.mode;
            const token = ++state.token;
            if (!force && state.data[mode] && Date.now() - (state.loadedAt[mode] || 0) < STALE_MS) {
                // Fresh data that is already on screen needs no redraw (the page can be re-activated repeatedly).
                if (body.firstElementChild?.dataset.subtab !== mode || state.loading) renderPane();
                return;
            }
            state.loading = true; state.error = null;
            setStatusLine('Обновляем данные…', 'loading');
            if (!state.data[mode]) renderPane();
            try {
                const result = await run('getFinanceData', { mode, filters: buildFilters(mode), primaryCurrency: state.currency === 'all' ? undefined : state.currency });
                if (token !== state.token) return;
                state.data[mode] = result;
                state.loadedAt[mode] = Date.now();
                rememberFilterOptions(result);
                state.loading = false;
            } catch (error) {
                if (token !== state.token) return;
                state.loading = false;
                state.error = error?.message || 'Неизвестная ошибка.';
                if (state.data[mode]) root.FPTPopupUI.showToast(popup, state.error, 'error');
            }
            renderPane();
        }

        function invalidate() { state.data = {}; state.loadedAt = {}; state.notice = null; }

        function resetFilters() {
            state.period = '30d'; state.currency = 'all'; state.category = 'all'; state.orderStatus = 'all'; state.operationStatus = 'complete';
            fillSelect(periodSelect, model.PERIODS.map(p => [p.id, p.label]), '30d');
            try { root.FPTFinanceHub?.onPeriodChange('30d'); } catch (_) {}
            invalidate();
            load({ force: true });
        }

        async function refresh({ silent = false } = {}) {
            if (state.refreshing) return;
            state.refreshing = true;
            refreshBtn.disabled = true;
            refreshBtn.classList.add('is-busy');
            setStatusLine('Загружаем свежие данные с FunPay…', 'loading');
            try {
                const result = await run('fptFinRefreshBtn', {});
                const sourceNames = { sales: 'продажи', purchases: 'покупки', operations: 'операции', potential: 'лоты' };
                const expectedSources = Object.keys(sourceNames);
                const sources = result?.sources;
                const failed = expectedSources.filter(key => sources?.[key]?.status !== 'fulfilled');
                invalidate();
                await load({ force: true });
                if (state.error) {
                    state.notice = { text: `Не удалось загрузить данные: ${state.error}`, kind: 'error' };
                    setStatusLine(state.notice.text, state.notice.kind);
                    root.FPTPopupUI.showToast(popup, state.notice.text, 'error');
                } else if (failed.length) {
                    state.notice = { text: `Не удалось обновить: ${failed.map(key => sourceNames[key]).join(', ')}. Показаны сохранённые данные.`, kind: 'warning' };
                    setStatusLine(state.notice.text, state.notice.kind);
                    root.FPTPopupUI.showToast(popup, 'Часть данных не обновилась. Проверьте, что вы авторизованы на FunPay.', 'error');
                } else if (!silent) {
                    root.FPTPopupUI.showToast(popup, 'Обновление завершено', 'success');
                }
            } catch (error) {
                state.notice = { text: error?.message || 'Не удалось обновить данные.', kind: 'error' };
                setStatusLine(state.notice.text, state.notice.kind);
                root.FPTPopupUI.showToast(popup, state.notice.text, 'error');
            } finally {
                state.refreshing = false;
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('is-busy');
            }
        }

        async function download(format) {
            exportMenu.hidden = true;
            exportBtn.setAttribute('aria-expanded', 'false');
            const dataset = ['overview', 'profit'].includes(state.mode) ? (state.mode === 'overview' ? 'sales' : 'profit') : state.mode;
            try {
                const result = await run(format === 'csv' ? 'fptFinExportDownloadCsv' : 'fptFinExportDownloadJson', { mode: dataset, filters: buildFilters(dataset) });
                if (!result?.content) throw new Error('Нет данных для экспорта.');
                const blob = new Blob([format === 'csv' ? `﻿${result.content}` : result.content], { type: result.mimeType || 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const stamp = new Date().toISOString().slice(0, 10);
                link.href = url; link.download = `funpay-${dataset}-${stamp}.${format}`;
                document.body.appendChild(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                root.FPTPopupUI.showToast(popup, `Экспорт готов: ${dataset}.${format}`, 'success');
            } catch (error) {
                root.FPTPopupUI.showToast(popup, error?.message || 'Не удалось выполнить экспорт.', 'error');
            }
        }

        // --- Events ---------------------------------------------------------------------------------
        function selectMode(mode, viaAction) {
            if (!MODE_IDS.includes(mode)) return;
            const action = MODES.find(m => m.id === mode).action;
            if (viaAction && root.fptPopupActions.list(PAGE_ID).includes(action)) {
                // Routes through the shared page-mode handler so persistence and search stay in sync.
                run(action).then(() => applyMode(mode), () => applyMode(mode));
                return;
            }
            applyMode(mode);
        }

        function applyMode(mode) {
            if (!MODE_IDS.includes(mode) || mode === state.mode) return;
            pendingDirection = MODE_IDS.indexOf(mode) > MODE_IDS.indexOf(state.mode) ? 'next' : 'previous';
            state.mode = mode;
            state.step = 'auto';
            try { sessionStorage.setItem(TAB_KEY, mode); } catch (_) {}
            load();
        }

        periodSelect.addEventListener('change', () => {
            const value = periodSelect.value;
            if (value === 'custom') {
                customRange.hidden = false;
                fromInput.focus();
                return;
            }
            customRange.hidden = true;
            state.period = value;
            try { root.FPTFinanceHub?.onPeriodChange(value); } catch (_) {}
            invalidate();
            load({ force: true });
        });
        applyRange.addEventListener('click', async () => {
            rangeError.textContent = '';
            if (!fromInput.value || !toInput.value || fromInput.value > toInput.value) {
                rangeError.textContent = 'Укажите корректный диапазон дат.';
                return;
            }
            try {
                await run('fptFinCustomApplyBtn', { from: fromInput.value, to: toInput.value, mode: state.mode, filters: { ...buildFilters(), period: typeof state.period === 'string' ? state.period : 'custom' } });
                state.period = root.FPTFinanceHub?.getState?.().period || { period: 'custom', from: fromInput.value, to: toInput.value };
                invalidate();
                load({ force: true });
            } catch (error) {
                rangeError.textContent = error?.message || 'Не удалось применить диапазон.';
            }
        });
        resetRange.addEventListener('click', async () => {
            rangeError.textContent = '';
            fromInput.value = ''; toInput.value = '';
            try { await run('fptFinCustomResetBtn', { mode: state.mode, filters: buildFilters() }); } catch (_) {}
            const restored = root.FPTFinanceHub?.getState?.().period;
            state.period = restored && typeof restored === 'string' ? restored : '30d';
            fillSelect(periodSelect, model.PERIODS.map(p => [p.id, p.label]), state.period);
            customRange.hidden = true;
            invalidate();
            load({ force: true });
        });
        currencySelect.addEventListener('change', () => { state.currency = currencySelect.value; invalidate(); load({ force: true }); });
        categorySelect.addEventListener('change', () => { state.category = categorySelect.value; invalidate(); load({ force: true }); });
        statusSelect.addEventListener('change', () => {
            if (state.mode === 'operations') state.operationStatus = statusSelect.value; else state.orderStatus = statusSelect.value;
            state.data[state.mode] = undefined;
            load({ force: true });
        });
        refreshBtn.addEventListener('click', refresh);
        exportBtn.addEventListener('click', () => {
            const open = exportMenu.hidden;
            exportMenu.hidden = !open;
            exportBtn.setAttribute('aria-expanded', String(open));
            if (open) csvItem.focus();
        });
        csvItem.addEventListener('click', () => download('csv'));
        jsonItem.addEventListener('click', () => download('json'));
        const closeMenu = event => {
            if (!page.isConnected) { document.removeEventListener('pointerdown', closeMenu); return; }
            if (!exportMenu.hidden && !exportWrap.contains(event.target)) { exportMenu.hidden = true; exportBtn.setAttribute('aria-expanded', 'false'); }
        };
        document.addEventListener('pointerdown', closeMenu);
        exportWrap.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !exportMenu.hidden) { exportMenu.hidden = true; exportBtn.setAttribute('aria-expanded', 'false'); exportBtn.focus(); }
        });

        // The shared page-mode handler writes data-fpt-page-mode; follow it.
        new MutationObserver(() => {
            const mode = page.dataset.fptPageMode;
            if (MODE_IDS.includes(mode) && mode !== state.mode) applyMode(mode);
        }).observe(page, { attributes: true, attributeFilter: ['data-fpt-page-mode'] });

        // Pulls fresh data from FunPay when the stored copy is missing or older than AUTO_REFRESH_MS.
        async function maybeAutoRefresh() {
            if (state.refreshing) return;
            const meta = await readMeta();
            const updated = Number(meta?.oldestLastUpdate) || 0;
            if (updated && Date.now() - updated < AUTO_REFRESH_MS) return;
            if (page.classList.contains('active')) await refresh({ silent: true });
        }

        // Load lazily when the page becomes visible; refresh stale data on every return to it.
        const onActivated = () => {
            load();
            maybeAutoRefresh();
        };
        root.FPTPopupUI.onPageActivated(page, onActivated);

        renderPane();
        if (page.classList.contains('active')) onActivated();
    }

    root.FPTFinanceHubPage = Object.freeze({ mount, summarize });
})(window);
