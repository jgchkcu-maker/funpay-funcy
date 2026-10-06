// FunPay support screen: ticket list, ticket conversations, new tickets and order-confirmation requests.
// Network work stays in support.js and the background worker; this module only builds the view.
(function (root) {
    'use strict';

    const PAGE_ID = 'tickets';
    const SUPPORT_URL = 'https://support.funpay.com';
    const AUTO_KEY = 'fpToolsSupportAutoTicket';
    const AGE_HOURS = Object.freeze({ min: 1, max: 168 });
    const MAX_ORDERS = Object.freeze({ min: 1, max: 20 });
    const DEFAULT_AUTO = Object.freeze({ ageHours: 24, maxOrders: 5 });
    const STALE_AFTER_MS = 2 * 60 * 1000;
    const SAVE_DELAY_MS = 400;
    const STATUS_FILTERS = Object.freeze([
        { value: 'all', label: 'Все' },
        { value: 'active', label: 'Актуальные' },
        { value: 'solved', label: 'Закрытые' }
    ]);
    const SORTS = Object.freeze([
        { value: 'newest_first', label: 'Сначала новые' },
        { value: 'oldest_first', label: 'Сначала старые' },
        { value: 'last_answered', label: 'По последнему ответу' }
    ]);
    const STATUS_META = Object.freeze({
        open: { label: 'Открыта', icon: 'mark_chat_unread' },
        pending: { label: 'В ожидании', icon: 'schedule' },
        solved: { label: 'Решена', icon: 'task_alt' },
        closed: { label: 'Закрыта', icon: 'lock' },
        unknown: { label: 'Статус неизвестен', icon: 'help' }
    });
    const COMMENT_FIELD_PREFIX = 'ticket[comment]';
    const NICK_FIELD_PATTERN = /ник|логин|login|nickname/i;

    // --- Pure helpers (exported for tests) ---------------------------------------------------

    // The site words statuses in several forms («Открыт», «Открыта», «Решено»…), so match the stem.
    function statusKind(status) {
        const text = String(status || '').trim().toLowerCase();
        if (text.startsWith('откр')) return 'open';
        if (text.includes('ожид')) return 'pending';
        if (text.startsWith('реш')) return 'solved';
        if (text.startsWith('закр')) return 'closed';
        return 'unknown';
    }

    function isActiveKind(kind) {
        return kind === 'open' || kind === 'pending';
    }

    function ticketKey(ticket) {
        if (ticket && Number.isFinite(ticket.sortKey)) return ticket.sortKey;
        return parseInt(ticket && ticket.id, 10) || 0;
    }

    function countTickets(tickets) {
        const list = Array.isArray(tickets) ? tickets : [];
        let active = 0;
        let solved = 0;
        list.forEach(ticket => {
            const kind = statusKind(ticket.status);
            if (isActiveKind(kind)) active += 1;
            else if (kind === 'solved' || kind === 'closed') solved += 1;
        });
        return { all: list.length, active, solved };
    }

    function filterTickets(tickets, { query = '', status = 'all', sort = 'newest_first' } = {}) {
        const needle = String(query || '').trim().toLowerCase().replace(/^#/, '');
        let result = (Array.isArray(tickets) ? tickets : []).filter(ticket => {
            if (needle && !String(ticket.title || '').toLowerCase().includes(needle)
                && !String(ticket.id || '').toLowerCase().includes(needle)) return false;
            const kind = statusKind(ticket.status);
            if (status === 'active') return isActiveKind(kind);
            if (status === 'solved') return kind === 'solved' || kind === 'closed';
            return true;
        });
        if (sort === 'newest_first') result = result.slice().sort((a, b) => ticketKey(b) - ticketKey(a));
        else if (sort === 'oldest_first') result = result.slice().sort((a, b) => ticketKey(a) - ticketKey(b));
        // last_answered keeps the order the support site returned.
        return result;
    }

    function clampInt(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, Math.round(number)));
    }

    function normalizeAuto(raw) {
        const value = raw && typeof raw === 'object' ? raw : {};
        return {
            ageHours: clampInt(value.ageHours, AGE_HOURS.min, AGE_HOURS.max, DEFAULT_AUTO.ageHours),
            maxOrders: clampInt(value.maxOrders, MAX_ORDERS.min, MAX_ORDERS.max, DEFAULT_AUTO.maxOrders)
        };
    }

    // Form fields carry a JSON condition such as {"type":"equals","fieldId":3,"value":2}.
    function evaluateCondition(condition, values) {
        if (!condition) return true;
        try {
            const rule = JSON.parse(condition);
            const current = values[`ticket[fields][${rule.fieldId}]`] || '';
            if (rule.type === 'equals') return current === String(rule.value);
        } catch (_) {}
        return false;
    }

    function formatAge(hours) {
        if (!Number.isFinite(hours) || hours < 0) return '';
        if (hours < 1) return 'меньше часа';
        if (hours < 48) return `${Math.floor(hours)} ч`;
        return `${Math.floor(hours / 24)} дн`;
    }

    // --- DOM helpers ---------------------------------------------------------------------------

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

    function createButton(className, iconName, label) {
        const button = node('button', className);
        button.type = 'button';
        if (iconName) button.appendChild(icon(iconName));
        if (label) button.appendChild(node('span', 'fpt-sp-button-label', label));
        return button;
    }

    function externalLink(className, href, label, iconName = 'open_in_new') {
        const link = node('a', className);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.append(node('span', '', label), icon(iconName));
        return link;
    }

    function safeUrl(raw, { images = false } = {}) {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (images && /^data:image\/(png|gif|jpe?g|webp);/i.test(value)) return value;
        try {
            const url = new URL(value, SUPPORT_URL);
            return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    const INLINE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'CODE', 'SPAN', 'SMALL', 'SUB', 'SUP']);
    const BLOCK_TAGS = new Set(['P', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE']);
    const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'LINK', 'META']);

    // Comment bodies arrive as HTML from support.funpay.com. Rebuild them from an allow-list so no
    // attribute, handler or style from the site reaches the popup.
    function sanitizeCommentHtml(html) {
        const fragment = document.createDocumentFragment();
        let parsed;
        try {
            parsed = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
        } catch (_) {
            fragment.appendChild(document.createTextNode(String(html || '')));
            return fragment;
        }
        const copy = (source, target) => {
            source.childNodes.forEach(child => {
                if (child.nodeType === 3) {
                    target.appendChild(document.createTextNode(child.nodeValue));
                    return;
                }
                if (child.nodeType !== 1) return;
                const tag = child.tagName.toUpperCase();
                if (DROP_TAGS.has(tag)) return;
                if (tag === 'BR') {
                    target.appendChild(document.createElement('br'));
                    return;
                }
                if (tag === 'IMG') {
                    const src = safeUrl(child.getAttribute('src'), { images: true });
                    if (!src) return;
                    const link = node('a', 'fpt-sp-msg-image');
                    link.href = src;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    const image = document.createElement('img');
                    image.src = src;
                    image.alt = child.getAttribute('alt') || 'Вложение';
                    image.loading = 'lazy';
                    image.referrerPolicy = 'no-referrer';
                    link.appendChild(image);
                    target.appendChild(link);
                    return;
                }
                if (tag === 'A') {
                    const href = safeUrl(child.getAttribute('href'));
                    const element = href ? document.createElement('a') : document.createElement('span');
                    if (href) {
                        element.href = href;
                        element.target = '_blank';
                        element.rel = 'noopener noreferrer';
                    }
                    copy(child, element);
                    target.appendChild(element);
                    return;
                }
                if (INLINE_TAGS.has(tag) || BLOCK_TAGS.has(tag)) {
                    const element = document.createElement(tag.toLowerCase());
                    copy(child, element);
                    target.appendChild(element);
                    return;
                }
                if (/^H[1-6]$/.test(tag)) {
                    const element = document.createElement('p');
                    const strong = document.createElement('strong');
                    copy(child, strong);
                    element.appendChild(strong);
                    target.appendChild(element);
                    return;
                }
                copy(child, target);
            });
        };
        copy(parsed.body, fragment);
        return fragment;
    }

    function getUsername() {
        const name = document.querySelector('.user-link-name');
        if (name && name.textContent.trim()) return name.textContent.trim();
        try {
            const data = JSON.parse(document.body.dataset.appData || '{}');
            return (Array.isArray(data) ? data[0] : data)?.userName || '';
        } catch (_) {
            return '';
        }
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-sp-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по поддержке');
        panel.appendChild(node('h2', '', 'Поддержка FunPay'));
        const list = node('ul');
        [
            'Заявки отправляются от вашего аккаунта на support.funpay.com — так же, как с сайта.',
            'Перед отправкой всегда показывается текст заявки: ничего не уходит без подтверждения.',
            '«Подтверждение заказов» собирает оплаченные заказы старше выбранного возраста и просит поддержку их закрыть.',
            'Чтобы ответить в заявке или закрыть её, откройте её из списка.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    function createCard({ iconName, title, description, className = '' }) {
        const card = node('section', `fpt-sp-card ${className}`.trim());
        // A div head on purpose: the site theme styles bare `header` elements.
        const head = node('div', 'fpt-sp-card-head');
        const iconWrap = node('span', 'fpt-sp-card-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-sp-card-copy');
        copy.append(node('h2', 'fpt-sp-card-title', title));
        if (description) copy.appendChild(node('p', 'fpt-sp-card-description', description));
        const tools = node('div', 'fpt-sp-card-tools');
        head.append(iconWrap, copy, tools);
        const body = node('div', 'fpt-sp-card-body');
        card.append(head, body);
        return { card, head, body, tools };
    }

    function createNumberField({ id, label, hint, min, max, suffix }) {
        const field = node('label', 'fpt-sp-number');
        field.htmlFor = id;
        const copy = node('span', 'fpt-sp-number-copy');
        copy.append(node('strong', '', label), node('span', '', hint));
        const box = node('span', 'fpt-sp-number-box');
        const input = node('input', 'fpt-sp-number-input');
        input.type = 'number';
        input.id = id;
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        input.inputMode = 'numeric';
        box.append(input, node('span', 'fpt-sp-number-suffix', suffix));
        field.append(copy, box);
        return { element: field, input };
    }

    function statusBadge(status) {
        const kind = statusKind(status);
        const badge = node('span', 'fpt-sp-status');
        badge.dataset.kind = kind;
        badge.append(node('i', 'fpt-sp-status-dot'), node('span', '', String(status || '').trim() || STATUS_META[kind].label));
        return badge;
    }

    // --- Mount -----------------------------------------------------------------------------------

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptSupportMounted === 'true') return;
        page.dataset.fptSupportMounted = 'true';

        const ui = root.FPTPopupUI;
        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const toast = (text, kind = 'success') => ui.showToast(popup, text, kind);
        const state = {
            tickets: [],
            loaded: false,
            loading: false,
            error: '',
            loadedAt: 0,
            query: '',
            status: 'all',
            sort: 'newest_first',
            auto: normalizeAuto(null),
            thread: null
        };
        try {
            const stored = await run('getSettings', { keys: [AUTO_KEY] });
            state.auto = normalizeAuto(stored && stored[AUTO_KEY]);
        } catch (_) {}

        const helpPanel = makeHelpPanel();
        const header = ui.ensureCategoryHeader(page, 'Поддержка FunPay', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-sp');
        view.dataset.view = 'home';
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }
        const home = node('div', 'fpt-sp-home');
        const threadView = node('section', 'fpt-sp-thread');
        threadView.hidden = true;

        // --- Hero ----------------------------------------------------------------------------
        const hero = node('section', 'fpt-sp-hero');
        hero.setAttribute('aria-labelledby', 'fpt-sp-hero-title');
        const heroMain = node('div', 'fpt-sp-hero-main');
        const heroIcon = node('span', 'fpt-sp-hero-icon');
        heroIcon.appendChild(icon('support_agent'));
        const heroCopy = node('div', 'fpt-sp-hero-copy');
        const heroTitleRow = node('div', 'fpt-sp-hero-title-row');
        const heroTitle = node('h2', 'fpt-sp-hero-title', 'Заявки в техподдержку');
        heroTitle.id = 'fpt-sp-hero-title';
        const heroPill = node('span', 'fpt-sp-pill');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-sp-hero-description',
            'Создавайте обращения, отвечайте поддержке и следите за статусом — не уходя с FunPay.'));
        heroMain.append(heroIcon, heroCopy);
        const heroActions = node('div', 'fpt-sp-hero-actions');
        const createButtonEl = createButton('fpt-sp-button fpt-sp-button--primary', 'add', 'Новая заявка');
        createButtonEl.id = 'fp-create-ticket-btn';
        const refreshButton = createButton('fpt-sp-button', 'refresh', 'Обновить');
        refreshButton.id = 'fp-ticket-refresh-btn';
        const siteLink = externalLink('fpt-sp-link', `${SUPPORT_URL}/tickets`, 'Открыть сайт поддержки');
        heroActions.append(createButtonEl, refreshButton, siteLink);
        const metrics = node('div', 'fpt-sp-metrics');
        const metric = (iconName, label, filter) => {
            const button = node('button', 'fpt-sp-metric');
            button.type = 'button';
            button.dataset.filter = filter;
            const iconWrap = node('span', 'fpt-sp-metric-icon');
            iconWrap.appendChild(icon(iconName));
            const value = node('strong', 'fpt-sp-metric-value', '—');
            const copy = node('span', 'fpt-sp-metric-copy');
            copy.append(value, node('span', 'fpt-sp-metric-label', label));
            button.append(iconWrap, copy);
            button.setAttribute('aria-label', `${label}: показать в списке`);
            metrics.appendChild(button);
            return { button, value };
        };
        const metricAll = metric('inbox', 'Всего заявок', 'all');
        const metricActive = metric('mark_chat_unread', 'Актуальные', 'active');
        const metricSolved = metric('task_alt', 'Закрытые', 'solved');
        hero.append(heroMain, heroActions, metrics);

        // --- Order confirmation --------------------------------------------------------------
        const auto = createCard({
            iconName: 'fact_check', title: 'Подтверждение заказов', className: 'fpt-sp-auto',
            description: 'FunPay не всегда подтверждает заказы сам. Расширение соберёт ваши оплаченные, но не подтверждённые заказы и подготовит заявку с просьбой их закрыть.'
        });
        const ageField = createNumberField({
            id: 'fp-ticket-age-hours', label: 'Возраст заказа', hint: 'Не моложе, чем', min: AGE_HOURS.min, max: AGE_HOURS.max, suffix: 'ч'
        });
        const maxField = createNumberField({
            id: 'fp-ticket-max-orders', label: 'Заказов в заявке', hint: 'Не больше, чем', min: MAX_ORDERS.min, max: MAX_ORDERS.max, suffix: 'шт.'
        });
        const autoFields = node('div', 'fpt-sp-auto-fields');
        autoFields.append(ageField.element, maxField.element);
        const autoFooter = node('div', 'fpt-sp-auto-footer');
        const autoButton = createButton('fpt-sp-button fpt-sp-button--primary', 'playlist_add_check', 'Собрать заказы');
        autoButton.id = 'fp-send-auto-ticket-btn';
        const autoStatus = node('p', 'fpt-sp-inline-status');
        autoStatus.id = 'fp-auto-ticket-status';
        autoStatus.setAttribute('role', 'status');
        autoStatus.hidden = true;
        autoFooter.append(autoButton, autoStatus);
        auto.body.append(autoFields, autoFooter);

        // --- Ticket list ---------------------------------------------------------------------
        const list = createCard({ iconName: 'confirmation_number', title: 'Ваши заявки', className: 'fpt-sp-list-card' });
        const listCount = node('span', 'fpt-sp-pill');
        list.tools.appendChild(listCount);
        const toolbar = node('div', 'fpt-sp-toolbar');
        const searchWrap = node('label', 'fpt-sp-search');
        searchWrap.appendChild(icon('search'));
        const search = node('input', 'fpt-sp-search-input');
        search.type = 'search';
        search.id = 'fp-tickets-search';
        search.placeholder = 'Поиск по теме или номеру';
        search.autocomplete = 'off';
        search.spellcheck = false;
        search.setAttribute('aria-label', 'Поиск по заявкам');
        searchWrap.appendChild(search);
        const seg = node('div', 'fpt-sp-seg');
        seg.setAttribute('role', 'radiogroup');
        seg.setAttribute('aria-label', 'Статус заявок');
        const segButtons = STATUS_FILTERS.map(filter => {
            const button = node('button', 'fpt-sp-seg-button');
            button.type = 'button';
            button.dataset.value = filter.value;
            button.setAttribute('role', 'radio');
            button.append(node('span', '', filter.label), node('span', 'fpt-sp-seg-count', ''));
            seg.appendChild(button);
            return button;
        });
        const sortHost = node('div', 'fpt-sp-sort');
        const sortSelect = node('select', 'fpt-sp-sort-select');
        sortSelect.id = 'fp-tickets-sort';
        sortSelect.setAttribute('aria-label', 'Сортировка заявок');
        SORTS.forEach(option => {
            const element = node('option', '', option.label);
            element.value = option.value;
            sortSelect.appendChild(element);
        });
        sortHost.appendChild(sortSelect);
        toolbar.append(searchWrap, seg, sortHost);
        const listBody = node('div', 'fpt-sp-list');
        listBody.id = 'fp-tickets-list';
        listBody.setAttribute('aria-live', 'polite');
        list.body.append(toolbar, listBody);

        home.append(hero, auto.card, list.card);

        // --- Thread view ---------------------------------------------------------------------
        const threadHead = node('div', 'fpt-sp-thread-head');
        const backButton = createButton('fpt-sp-icon-button', 'arrow_back', '');
        backButton.id = 'fp-ticket-detail-back';
        backButton.setAttribute('aria-label', 'Назад к заявкам');
        backButton.title = 'Назад к заявкам';
        const threadCopy = node('div', 'fpt-sp-thread-copy');
        const threadTitle = node('h2', 'fpt-sp-thread-title');
        threadTitle.id = 'fp-ticket-detail-title';
        const threadMeta = node('div', 'fpt-sp-thread-meta');
        threadMeta.id = 'fp-ticket-detail-status';
        threadCopy.append(threadTitle, threadMeta);
        const threadTools = node('div', 'fpt-sp-thread-tools');
        const threadReload = createButton('fpt-sp-icon-button', 'refresh', '');
        threadReload.setAttribute('aria-label', 'Обновить переписку');
        threadReload.title = 'Обновить переписку';
        const threadClose = createButton('fpt-sp-button fpt-sp-button--danger', 'lock', 'Закрыть заявку');
        const threadSite = node('a', 'fpt-sp-icon-button');
        threadSite.target = '_blank';
        threadSite.rel = 'noopener noreferrer';
        threadSite.title = 'Открыть на сайте поддержки';
        threadSite.setAttribute('aria-label', 'Открыть на сайте поддержки');
        threadSite.appendChild(icon('open_in_new'));
        threadTools.append(threadReload, threadClose, threadSite);
        threadHead.append(backButton, threadCopy, threadTools);
        const messages = node('div', 'fpt-sp-messages');
        messages.id = 'fp-tdm';
        messages.setAttribute('role', 'log');
        messages.setAttribute('aria-label', 'Переписка с поддержкой');
        const composer = node('div', 'fpt-sp-composer');
        composer.id = 'fp-tria';
        const replyInput = node('textarea', 'fpt-sp-composer-input');
        replyInput.id = 'fp-tri';
        replyInput.rows = 1;
        replyInput.placeholder = 'Ответ поддержке…';
        replyInput.setAttribute('aria-label', 'Ответ поддержке');
        const replyButton = createButton('fpt-sp-send', 'send', '');
        replyButton.id = 'fp-ticket-reply-btn';
        replyButton.setAttribute('aria-label', 'Отправить ответ');
        replyButton.title = 'Отправить (Enter)';
        composer.append(replyInput, replyButton);
        const composerHint = node('p', 'fpt-sp-composer-hint', 'Enter — отправить, Shift + Enter — новая строка');
        const closedNote = node('p', 'fpt-sp-thread-note');
        closedNote.append(icon('lock'), node('span', '', 'Заявка закрыта — ответить в ней нельзя. Если вопрос остался, создайте новую.'));
        threadView.append(threadHead, messages, composer, composerHint, closedNote);

        view.append(home, threadView);
        page.appendChild(view);
        ui.enhanceSelect?.(sortSelect, sortHost);

        // --- Rendering -----------------------------------------------------------------------
        function renderHero() {
            const counts = countTickets(state.tickets);
            const ready = state.loaded && !state.error;
            metricAll.value.textContent = ready ? String(counts.all) : '—';
            metricActive.value.textContent = ready ? String(counts.active) : '—';
            metricSolved.value.textContent = ready ? String(counts.solved) : '—';
            [metricAll, metricActive, metricSolved].forEach(item => {
                item.button.disabled = !ready;
                item.button.setAttribute('aria-pressed', ready && item.button.dataset.filter === state.status ? 'true' : 'false');
            });
            if (state.loading && !state.loaded) {
                heroPill.dataset.kind = 'neutral';
                heroPill.textContent = 'Загрузка…';
            } else if (state.error) {
                heroPill.dataset.kind = 'error';
                heroPill.textContent = 'Нет связи с поддержкой';
            } else if (counts.active) {
                heroPill.dataset.kind = 'info';
                heroPill.textContent = `${counts.active} ${ui.pluralize(counts.active, ['актуальная', 'актуальные', 'актуальных'])}`;
            } else {
                heroPill.dataset.kind = 'success';
                heroPill.textContent = 'Открытых заявок нет';
            }
            refreshButton.disabled = state.loading;
            refreshButton.setAttribute('aria-busy', state.loading ? 'true' : 'false');
        }

        function renderToolbar() {
            const counts = countTickets(state.tickets);
            const index = Math.max(0, STATUS_FILTERS.findIndex(filter => filter.value === state.status));
            segButtons.forEach((button, i) => {
                const selected = i === index;
                button.setAttribute('aria-checked', selected ? 'true' : 'false');
                button.tabIndex = selected ? 0 : -1;
                button.querySelector('.fpt-sp-seg-count').textContent = state.loaded ? String(counts[button.dataset.value]) : '';
            });
            if (sortSelect.value !== state.sort) {
                sortSelect.value = state.sort;
                sortSelect.dispatchEvent(new Event('change'));
            }
            const disabled = !state.loaded || !!state.error || !state.tickets.length;
            search.disabled = disabled;
            segButtons.forEach(button => { button.disabled = disabled; });
            sortSelect.disabled = disabled;
        }

        function emptyState({ iconName, title, text, action, kind = 'neutral' }) {
            const box = node('div', 'fpt-sp-empty');
            box.dataset.kind = kind;
            const iconWrap = node('span', 'fpt-sp-empty-icon');
            iconWrap.appendChild(icon(iconName));
            box.append(iconWrap, node('strong', 'fpt-sp-empty-title', title), node('p', 'fpt-sp-empty-text', text));
            if (action) box.appendChild(action);
            return box;
        }

        function ticketRow(ticket) {
            const kind = statusKind(ticket.status);
            const row = node('article', 'fpt-sp-ticket');
            row.dataset.kind = kind;
            row.dataset.ticketId = String(ticket.id);
            const open = node('button', 'fpt-sp-ticket-open');
            open.type = 'button';
            open.setAttribute('aria-label', `Открыть заявку #${ticket.id}: ${ticket.title || ''}`.trim());
            const iconWrap = node('span', 'fpt-sp-ticket-icon');
            iconWrap.appendChild(icon(STATUS_META[kind].icon));
            const copy = node('span', 'fpt-sp-ticket-copy');
            const title = node('strong', 'fpt-sp-ticket-title', ticket.title || `Заявка #${ticket.id}`);
            const meta = node('span', 'fpt-sp-ticket-meta');
            meta.append(node('span', 'fpt-sp-ticket-id', `#${ticket.id}`));
            if (ticket.lastUpdate) meta.append(node('span', 'fpt-sp-ticket-date', ticket.lastUpdate));
            copy.append(title, meta);
            open.append(iconWrap, copy, statusBadge(ticket.status), icon('chevron_right'));
            open.addEventListener('click', () => openThread(ticket));
            row.appendChild(open);
            if (isActiveKind(kind)) {
                const close = createButton('fpt-sp-row-action', 'lock', '');
                close.setAttribute('aria-label', `Закрыть заявку #${ticket.id}`);
                close.title = 'Закрыть заявку';
                close.addEventListener('click', () => confirmClose(ticket));
                row.appendChild(close);
            }
            return row;
        }

        function renderList() {
            const counts = countTickets(state.tickets);
            listCount.hidden = !state.loaded || !!state.error;
            listCount.textContent = `${counts.all} ${ui.pluralize(counts.all, ['заявка', 'заявки', 'заявок'])}`;
            listBody.dataset.state = state.loading && !state.loaded ? 'loading' : state.error ? 'error' : 'ready';
            listBody.setAttribute('aria-busy', state.loading ? 'true' : 'false');

            if (state.loading && !state.loaded) {
                const skeleton = node('div', 'fpt-sp-skeleton');
                skeleton.setAttribute('aria-label', 'Загружаем заявки');
                for (let i = 0; i < 4; i++) skeleton.appendChild(node('span', 'fpt-sp-skeleton-row'));
                listBody.replaceChildren(skeleton);
                return;
            }
            if (state.error) {
                const retry = createButton('fpt-sp-button', 'refresh', 'Повторить');
                retry.addEventListener('click', () => loadTickets({ force: true }));
                listBody.replaceChildren(emptyState({
                    iconName: 'cloud_off', kind: 'error', title: 'Не удалось загрузить заявки',
                    text: `${state.error} Проверьте, что вы вошли на FunPay, и попробуйте ещё раз.`, action: retry
                }));
                return;
            }
            if (!state.tickets.length) {
                const create = createButton('fpt-sp-button fpt-sp-button--primary', 'add', 'Создать заявку');
                create.addEventListener('click', openNewTicket);
                listBody.replaceChildren(emptyState({
                    iconName: 'forum', title: 'Заявок пока нет',
                    text: 'Здесь появятся ваши обращения в поддержку FunPay и ответы на них.', action: create
                }));
                return;
            }
            const visible = filterTickets(state.tickets, state);
            if (!visible.length) {
                const reset = createButton('fpt-sp-button', 'filter_alt_off', 'Сбросить фильтры');
                reset.addEventListener('click', () => {
                    state.query = '';
                    search.value = '';
                    state.status = 'all';
                    render();
                });
                listBody.replaceChildren(emptyState({
                    iconName: 'search_off', title: 'Ничего не найдено',
                    text: 'Измените запрос или статус — подходящих заявок нет.', action: reset
                }));
                return;
            }
            listBody.replaceChildren(...visible.map(ticketRow));
        }

        function renderAuto() {
            if (document.activeElement !== ageField.input) ageField.input.value = String(state.auto.ageHours);
            if (document.activeElement !== maxField.input) maxField.input.value = String(state.auto.maxOrders);
        }

        function render() {
            renderHero();
            renderToolbar();
            renderList();
            renderAuto();
        }

        // --- Loading ---------------------------------------------------------------------------
        let loadToken = 0;
        async function loadTickets({ force = false, quiet = false } = {}) {
            if (state.loading && !force) return;
            const token = ++loadToken;
            state.loading = true;
            if (!quiet) state.error = '';
            render();
            try {
                const response = await run('fp-ticket-refresh-btn');
                if (token !== loadToken) return;
                state.tickets = Array.isArray(response && response.tickets) ? response.tickets : [];
                state.loaded = true;
                state.error = '';
                state.loadedAt = Date.now();
            } catch (error) {
                if (token !== loadToken) return;
                // A failed background refresh keeps the list that is already on screen.
                if (quiet && state.loaded) toast(`Не удалось обновить заявки: ${error.message || 'ошибка сети'}`, 'error');
                else state.error = error.message || 'Ошибка сети.';
            } finally {
                if (token === loadToken) {
                    state.loading = false;
                    render();
                }
            }
        }

        function ensureFresh() {
            if (!state.loaded && !state.loading) loadTickets();
            else if (state.loaded && Date.now() - state.loadedAt > STALE_AFTER_MS) loadTickets({ quiet: true });
        }

        // --- Sending (shared by the order request and the new-ticket form) -------------------
        // Shows the exact text that will be sent. Resolves true once support accepted the ticket and
        // false when the user backs out; a failed send keeps the dialog open for another try.
        function sendDraft(draft, { title, description, preview, orders = [], onBack }) {
            return new Promise(resolve => {
                const dialog = ui.createDialog(popup, title, { description });
                dialog.dialog.classList.add('fpt-sp-dialog');
                if (orders.length) {
                    const chips = node('div', 'fpt-sp-order-chips');
                    orders.forEach(order => {
                        const chip = externalLink('fpt-sp-order-chip', `https://funpay.com/orders/${encodeURIComponent(order.id)}/`, `#${order.id}`, 'north_east');
                        if (Number.isFinite(order.ageHours)) chip.prepend(node('span', 'fpt-sp-order-age', formatAge(order.ageHours)));
                        chips.appendChild(chip);
                    });
                    dialog.body.appendChild(chips);
                }
                const box = node('pre', 'fpt-sp-preview', preview);
                box.id = 'fp-ticket-confirm-text';
                box.tabIndex = 0;
                box.setAttribute('aria-label', 'Текст заявки');
                dialog.body.appendChild(box);
                const cancel = node('button', 'fpt-lot-dialog-button', onBack ? 'Назад' : 'Отмена');
                cancel.type = 'button';
                cancel.id = 'fp-ticket-confirm-no';
                const send = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--primary', 'Отправить в поддержку');
                send.type = 'button';
                send.id = 'fp-ticket-confirm-yes';
                dialog.footer.append(cancel, send);

                let done = false;
                const finish = value => {
                    if (done) return;
                    done = true;
                    observer.disconnect();
                    resolve(value);
                };
                // Escape, the close button and a backdrop click all remove the dialog.
                const observer = new MutationObserver(() => { if (!dialog.backdrop.isConnected) finish(false); });
                observer.observe(popup, { childList: true });
                cancel.addEventListener('click', () => {
                    dialog.close();
                    finish(false);
                    if (onBack) onBack();
                });
                send.addEventListener('click', async () => {
                    dialog.setBusy(true);
                    send.textContent = 'Отправляем…';
                    try {
                        const result = await run('fp-ticket-confirm-yes', draft);
                        dialog.setBusy(false);
                        finish(true);
                        dialog.close({ force: true });
                        toast(result && result.ticketId ? `Заявка #${result.ticketId} отправлена.` : 'Заявка отправлена.');
                        loadTickets({ force: true, quiet: state.loaded });
                    } catch (error) {
                        dialog.setBusy(false);
                        send.textContent = 'Отправить в поддержку';
                        toast(error.message || 'Не удалось отправить заявку.', 'error');
                    }
                });
            });
        }

        // --- Order confirmation flow ---------------------------------------------------------
        function setAutoStatus(text, kind = 'neutral') {
            autoStatus.hidden = !text;
            autoStatus.dataset.kind = kind;
            autoStatus.replaceChildren();
            if (!text) return;
            autoStatus.append(icon({ error: 'error', success: 'check_circle', warning: 'info' }[kind] || 'info'), node('span', '', text));
        }

        let autoSaveTimer = null;
        function editAuto() {
            const next = normalizeAuto({
                ageHours: ageField.input.value === '' ? state.auto.ageHours : ageField.input.value,
                maxOrders: maxField.input.value === '' ? state.auto.maxOrders : maxField.input.value
            });
            if (next.ageHours === state.auto.ageHours && next.maxOrders === state.auto.maxOrders) return;
            state.auto = next;
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                autoSaveTimer = null;
                run('saveSettings', { settings: { [AUTO_KEY]: { ...state.auto } } })
                    .catch(error => toast(error.message || 'Не удалось сохранить настройку.', 'error'));
            }, SAVE_DELAY_MS);
        }
        [ageField.input, maxField.input].forEach(input => {
            input.addEventListener('input', editAuto);
            input.addEventListener('change', () => { editAuto(); renderAuto(); });
            input.addEventListener('blur', renderAuto);
        });

        async function buildAutoTicket() {
            editAuto();
            renderAuto();
            setAutoStatus('');
            autoButton.disabled = true;
            autoButton.setAttribute('aria-busy', 'true');
            autoButton.querySelector('.fpt-sp-button-label').textContent = 'Собираем заказы…';
            let draft;
            try {
                draft = await run('fp-send-auto-ticket-btn', { ...state.auto });
            } catch (error) {
                setAutoStatus(error.message || 'Не удалось получить список заказов.', 'error');
                return;
            } finally {
                autoButton.disabled = false;
                autoButton.removeAttribute('aria-busy');
                autoButton.querySelector('.fpt-sp-button-label').textContent = 'Собрать заказы';
            }
            const orderIds = Array.isArray(draft && draft.orderIds) ? draft.orderIds : [];
            if (!orderIds.length) {
                const skipped = Number(draft && draft.youngerCount) || 0;
                setAutoStatus(skipped
                    ? `Неподтверждённых заказов старше ${state.auto.ageHours} ч нет. Моложе — ${skipped}: им ещё рано.`
                    : 'Неподтверждённых заказов нет — писать в поддержку не нужно.', 'success');
                return;
            }
            const orders = Array.isArray(draft.orders) && draft.orders.length
                ? draft.orders
                : orderIds.map(id => ({ id }));
            const username = draft.fieldValues && draft.fieldValues['ticket[fields][1]'];
            const preview = [
                'Категория: Подтверждение заказа',
                `Ник: ${username}`,
                `Заказы: ${orderIds.join(', ')}`,
                '',
                'Сообщение:',
                draft.message
            ].join('\n');
            const count = orderIds.length;
            const sent = await sendDraft(draft, {
                title: 'Проверьте заявку',
                description: `Найдено ${count} ${ui.pluralize(count, ['заказ', 'заказа', 'заказов'])}. Именно этот текст уйдёт в поддержку FunPay.`,
                preview,
                orders
            });
            if (sent) setAutoStatus(`Заявка по ${count} ${ui.pluralize(count, ['заказу', 'заказам', 'заказам'])} отправлена.`, 'success');
        }

        // --- New ticket ----------------------------------------------------------------------
        let newTicketDraft = null; // restored when the user steps back from the preview

        function fieldInput(field, values, onChange) {
            const wrap = node('div', 'fpt-sp-form-field');
            wrap.dataset.fieldId = field.id;
            const labelId = `fpt-sp-f-${Math.random().toString(36).slice(2, 9)}`;
            const label = node('label', 'fpt-sp-form-label', field.name);
            label.id = labelId;
            if (field.required) label.appendChild(node('span', 'fpt-sp-required', ' *'));
            wrap.appendChild(label);
            const initial = values[field.id] ?? (NICK_FIELD_PATTERN.test(field.name) ? getUsername() : field.defaultValue || '');
            const options = Array.isArray(field.options) ? field.options : [];
            // Long option lists read better as a dropdown than as a wall of radio tiles.
            if (field.type === 'select' && options.length > 6) {
                const host = node('div', 'fpt-sp-category');
                const select = node('select', 'fpt-sp-category-select');
                select.setAttribute('aria-labelledby', labelId);
                const placeholder = node('option', '', 'Выберите…');
                placeholder.value = '';
                select.append(placeholder, ...options.map(option => {
                    const element = node('option', '', option.text);
                    element.value = option.value;
                    return element;
                }));
                select.value = options.some(option => String(option.value) === String(initial)) ? String(initial) : '';
                select.addEventListener('change', onChange);
                host.appendChild(select);
                wrap.appendChild(host);
                ui.enhanceSelect?.(select, host);
                return { wrap, field, read: () => select.value, focus: () => host.querySelector('.fpt-select-trigger')?.focus() };
            }
            if (field.type === 'radio' || field.type === 'select') {
                const group = node('div', 'fpt-sp-choice-group');
                group.setAttribute('role', 'radiogroup');
                group.setAttribute('aria-labelledby', labelId);
                options.forEach(option => {
                    const choice = node('label', 'fpt-sp-choice');
                    const radio = node('input', 'fpt-sp-choice-input');
                    radio.type = 'radio';
                    radio.name = `fpt-sp-${labelId}`;
                    radio.value = option.value;
                    radio.checked = String(initial) === String(option.value);
                    radio.addEventListener('change', onChange);
                    choice.append(radio, node('span', 'fpt-sp-choice-mark'), node('span', 'fpt-sp-choice-text', option.text));
                    group.appendChild(choice);
                });
                wrap.appendChild(group);
                return { wrap, field, read: () => group.querySelector('input:checked')?.value || '', focus: () => group.querySelector('input')?.focus() };
            }
            const multiline = field.type === 'textarea';
            const input = node(multiline ? 'textarea' : 'input', 'fpt-sp-form-input');
            if (!multiline) input.type = 'text';
            else input.rows = field.id.startsWith(COMMENT_FIELD_PREFIX) ? 6 : 3;
            input.id = `${labelId}-input`;
            label.htmlFor = input.id;
            input.value = initial;
            if (field.id.startsWith(COMMENT_FIELD_PREFIX)) input.placeholder = 'Опишите проблему как можно подробнее';
            input.addEventListener('input', onChange);
            wrap.appendChild(input);
            return { wrap, field, read: () => input.value.trim(), focus: () => input.focus() };
        }

        async function openNewTicket() {
            const dialog = ui.createDialog(popup, 'Новая заявка', {
                wide: true,
                description: 'Выберите тему обращения — поля формы подгрузятся с сайта поддержки.'
            });
            dialog.dialog.classList.add('fpt-sp-dialog');
            const form = node('div', 'fpt-sp-form');
            form.id = 'fp-new-ticket-fields';
            const categoryWrap = node('div', 'fpt-sp-form-field');
            const categoryLabel = node('label', 'fpt-sp-form-label', 'Тема обращения');
            categoryLabel.htmlFor = 'fp-ticket-cat-select';
            const categoryHost = node('div', 'fpt-sp-category');
            const categorySelect = node('select', 'fpt-sp-category-select');
            categorySelect.id = 'fp-ticket-cat-select';
            categorySelect.setAttribute('aria-label', 'Тема обращения');
            categoryHost.appendChild(categorySelect);
            categoryWrap.append(categoryLabel, categoryHost);
            const fieldsHost = node('div', 'fpt-sp-form-fields');
            const formStatus = node('p', 'fpt-sp-inline-status');
            formStatus.hidden = true;
            formStatus.setAttribute('role', 'status');
            form.append(categoryWrap, fieldsHost, formStatus);
            dialog.body.appendChild(form);
            const cancel = node('button', 'fpt-lot-dialog-button', 'Отмена');
            cancel.type = 'button';
            cancel.id = 'fp-new-ticket-close';
            const next = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--primary', 'Проверить и отправить');
            next.type = 'button';
            next.id = 'fp-new-ticket-submit';
            next.disabled = true;
            dialog.footer.append(cancel, next);
            cancel.addEventListener('click', () => { newTicketDraft = null; dialog.close(); });

            const setStatus = (text, kind = 'neutral') => {
                formStatus.hidden = !text;
                formStatus.dataset.kind = kind;
                formStatus.replaceChildren();
                if (text) formStatus.append(icon(kind === 'error' ? 'error' : 'progress_activity'), node('span', '', text));
            };

            let categories = [];
            let controls = [];
            let fieldsToken = 0;

            const visibleControls = () => controls.filter(control => !control.wrap.hidden);
            const currentValues = () => {
                const values = {};
                controls.forEach(control => {
                    const value = control.read();
                    if (value) values[control.field.id] = value;
                });
                return values;
            };
            const applyConditions = () => {
                const values = currentValues();
                controls.forEach(control => {
                    control.wrap.hidden = !evaluateCondition(control.field.condition, values);
                });
            };

            async function loadFields(categoryId, restore = {}) {
                const token = ++fieldsToken;
                controls = [];
                fieldsHost.replaceChildren();
                next.disabled = true;
                if (!categoryId) return;
                setStatus('Загружаем поля формы…');
                try {
                    const response = await run('getTicketFields', { categoryId });
                    if (token !== fieldsToken || !dialog.backdrop.isConnected) return;
                    const fields = Array.isArray(response && response.fields) ? response.fields : [];
                    setStatus('');
                    controls = fields.map(field => fieldInput(field, restore, event => {
                        const wrap = event && event.target && event.target.closest('.fpt-sp-form-field');
                        if (wrap && wrap.dataset.invalid) {
                            delete wrap.dataset.invalid;
                            setStatus('');
                        }
                        applyConditions();
                    }));
                    fieldsHost.replaceChildren(...controls.map(control => control.wrap));
                    applyConditions();
                    next.disabled = false;
                    if (!fields.length) setStatus('У этой темы нет полей — опишите проблему на сайте поддержки.', 'error');
                } catch (error) {
                    if (token !== fieldsToken) return;
                    setStatus(error.message || 'Не удалось загрузить поля формы.', 'error');
                }
            }

            let restoreValues = null;
            categorySelect.addEventListener('change', () => {
                const restore = restoreValues || {};
                restoreValues = null;
                loadFields(categorySelect.value, restore);
            });

            next.addEventListener('click', async () => {
                const categoryId = categorySelect.value;
                const visible = visibleControls();
                const missing = visible.find(control => control.field.required && !control.read());
                if (missing) {
                    setStatus(`Заполните поле «${missing.field.name}».`, 'error');
                    missing.wrap.dataset.invalid = 'true';
                    missing.focus();
                    return;
                }
                visible.forEach(control => { delete control.wrap.dataset.invalid; });
                const values = {};
                visible.forEach(control => {
                    const value = control.read();
                    if (value) values[control.field.id] = value;
                });
                const messageControl = visible.find(control => control.field.id.startsWith(COMMENT_FIELD_PREFIX))
                    || visible.filter(control => control.field.type === 'textarea').pop();
                const message = messageControl ? messageControl.read() : '';
                const fieldValues = {};
                Object.entries(values).forEach(([key, value]) => {
                    if (!key.startsWith(COMMENT_FIELD_PREFIX)) fieldValues[key] = value;
                });
                const categoryName = categories.find(category => String(category.id) === String(categoryId))?.name || categoryId;
                const lines = [`Тема: ${categoryName}`];
                visible.forEach(control => {
                    if (control === messageControl) return;
                    const value = control.read();
                    if (!value) return;
                    const option = (control.field.options || []).find(item => String(item.value) === String(value));
                    lines.push(`${control.field.name}: ${option ? option.text : value}`);
                });
                lines.push('', 'Сообщение:', message);
                let draft;
                try {
                    draft = await run('fp-new-ticket-submit', { categoryId, message, fieldValues, preview: lines.join('\n') });
                } catch (error) {
                    setStatus(error.message, 'error');
                    messageControl?.focus();
                    return;
                }
                newTicketDraft = { categoryId, values };
                dialog.close();
                const sent = await sendDraft(draft, {
                    title: 'Проверьте заявку',
                    description: 'Именно этот текст уйдёт в поддержку FunPay.',
                    preview: draft.preview,
                    onBack: () => openNewTicket()
                });
                if (sent) newTicketDraft = null;
            });

            setStatus('Загружаем темы обращений…');
            try {
                const response = await run('fp-create-ticket-btn');
                if (!dialog.backdrop.isConnected) return;
                categories = Array.isArray(response && response.categories) ? response.categories : [];
                const placeholder = node('option', '', 'Выберите тему…');
                placeholder.value = '';
                categorySelect.replaceChildren(placeholder, ...categories.map(category => {
                    const option = node('option', '', category.name);
                    option.value = String(category.id);
                    return option;
                }));
                ui.enhanceSelect?.(categorySelect, categoryHost);
                setStatus(categories.length ? '' : 'Сайт поддержки не вернул ни одной темы.', categories.length ? 'neutral' : 'error');
                // Stepping back from the preview brings the filled-in form back.
                if (newTicketDraft && categories.some(category => String(category.id) === String(newTicketDraft.categoryId))) {
                    restoreValues = newTicketDraft.values;
                    categorySelect.value = String(newTicketDraft.categoryId);
                    categorySelect.dispatchEvent(new Event('change'));
                }
            } catch (error) {
                if (!dialog.backdrop.isConnected) return;
                setStatus(error.message || 'Не удалось загрузить темы обращений.', 'error');
            }
        }

        // --- Closing ---------------------------------------------------------------------------
        function confirmClose(ticket) {
            const dialog = ui.createDialog(popup, `Закрыть заявку #${ticket.id}?`, {
                description: 'Заявка перейдёт в закрытые, и ответить в ней будет нельзя. Если вопрос не решён, оставьте её открытой.'
            });
            dialog.dialog.classList.add('fpt-sp-dialog');
            if (ticket.title) dialog.body.appendChild(node('p', 'fpt-sp-dialog-subject', ticket.title));
            const cancel = node('button', 'fpt-lot-dialog-button', 'Оставить открытой');
            cancel.type = 'button';
            const confirm = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--danger', 'Закрыть заявку');
            confirm.type = 'button';
            dialog.footer.append(cancel, confirm);
            cancel.addEventListener('click', () => dialog.close());
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                confirm.textContent = 'Закрываем…';
                try {
                    await run('closeTicket', { ticketId: ticket.id });
                    dialog.setBusy(false);
                    dialog.close({ force: true });
                    toast(`Заявка #${ticket.id} закрыта.`);
                    if (state.thread && String(state.thread.id) === String(ticket.id)) loadThread();
                    loadTickets({ force: true, quiet: true });
                } catch (error) {
                    dialog.setBusy(false);
                    confirm.textContent = 'Закрыть заявку';
                    toast(error.message || 'Не удалось закрыть заявку.', 'error');
                }
            });
        }

        // --- Thread ----------------------------------------------------------------------------
        function bubble(comment, me) {
            const mine = !!me && comment.author === me;
            const row = node('div', 'fpt-sp-msg');
            row.dataset.side = mine ? 'me' : 'them';
            if (comment.pending) row.dataset.pending = 'true';
            if (!mine) {
                const avatar = node('span', 'fpt-sp-avatar', (comment.author || '?').trim().charAt(0).toUpperCase() || '?');
                const src = safeUrl(comment.avatarUrl);
                if (src) {
                    const image = document.createElement('img');
                    image.src = src;
                    image.alt = '';
                    image.loading = 'lazy';
                    image.referrerPolicy = 'no-referrer';
                    image.addEventListener('error', () => image.remove());
                    avatar.appendChild(image);
                }
                row.appendChild(avatar);
            }
            const column = node('div', 'fpt-sp-msg-column');
            const meta = node('div', 'fpt-sp-msg-meta');
            if (!mine) meta.appendChild(node('strong', '', comment.author || 'Поддержка'));
            if (comment.timestamp) meta.appendChild(node('span', '', comment.timestamp));
            const body = node('div', 'fpt-sp-msg-bubble');
            if (comment.plain) body.textContent = comment.plain;
            else body.appendChild(sanitizeCommentHtml(comment.text));
            column.append(meta, body);
            row.appendChild(column);
            return row;
        }

        function renderThread() {
            const thread = state.thread;
            if (!thread) return;
            const details = thread.details;
            const status = (details && details.status) || thread.status || '';
            threadTitle.textContent = (details && details.title) || thread.title || `Заявка #${thread.id}`;
            threadMeta.replaceChildren(node('span', 'fpt-sp-ticket-id', `#${thread.id}`), statusBadge(status));
            threadSite.href = `${SUPPORT_URL}/tickets/${encodeURIComponent(thread.id)}`;
            const active = isActiveKind(statusKind(status));
            threadClose.hidden = !active || !details;
            threadReload.disabled = thread.loading;
            threadReload.setAttribute('aria-busy', thread.loading ? 'true' : 'false');
            messages.setAttribute('aria-busy', thread.loading ? 'true' : 'false');

            if (thread.loading && !details) {
                const skeleton = node('div', 'fpt-sp-skeleton fpt-sp-skeleton--thread');
                for (let i = 0; i < 3; i++) skeleton.appendChild(node('span', 'fpt-sp-skeleton-bubble'));
                messages.replaceChildren(skeleton);
            } else if (thread.error && !details) {
                const retry = createButton('fpt-sp-button', 'refresh', 'Повторить');
                retry.addEventListener('click', loadThread);
                messages.replaceChildren(emptyState({ iconName: 'cloud_off', kind: 'error', title: 'Не удалось открыть заявку', text: thread.error, action: retry }));
            } else if (details) {
                const me = getUsername();
                const comments = (details.comments || []).concat(thread.outbox || []);
                if (!comments.length) messages.replaceChildren(emptyState({ iconName: 'chat_bubble', title: 'Сообщений пока нет', text: 'Поддержка ещё не ответила.' }));
                else messages.replaceChildren(...comments.map(comment => bubble(comment, me)));
            }
            const canReply = !!(details && details.canReply && details.token);
            composer.hidden = !canReply;
            composerHint.hidden = !canReply;
            closedNote.hidden = !details || canReply;
            replyButton.disabled = !canReply || thread.sending || !replyInput.value.trim();
            replyInput.disabled = !canReply || thread.sending;
            replyButton.setAttribute('aria-busy', thread.sending ? 'true' : 'false');
        }

        function scrollThreadToEnd() {
            messages.scrollTop = messages.scrollHeight;
        }

        async function loadThread() {
            const thread = state.thread;
            if (!thread) return;
            const token = ++thread.token;
            thread.loading = true;
            thread.error = '';
            renderThread();
            try {
                const details = await run('openTicket', { ticketId: thread.id });
                if (state.thread !== thread || token !== thread.token) return;
                thread.details = details || {};
                thread.outbox = [];
                // Keep the list in step with what the ticket page says.
                const listed = state.tickets.find(item => String(item.id) === String(thread.id));
                if (listed && details && details.status && statusKind(details.status) !== statusKind(listed.status)) {
                    listed.status = details.status;
                    render();
                }
            } catch (error) {
                if (state.thread !== thread || token !== thread.token) return;
                thread.error = error.message || 'Ошибка сети.';
                if (thread.details) toast(`Не удалось обновить переписку: ${thread.error}`, 'error');
            } finally {
                if (state.thread === thread && token === thread.token) {
                    thread.loading = false;
                    renderThread();
                    scrollThreadToEnd();
                }
            }
        }

        function openThread(ticket) {
            state.thread = { id: ticket.id, title: ticket.title, status: ticket.status, details: null, outbox: [], loading: false, sending: false, error: '', token: 0 };
            replyInput.value = '';
            resizeComposer();
            view.dataset.view = 'thread';
            home.hidden = true;
            threadView.hidden = false;
            page.closest('.fp-tools-content')?.scrollTo?.({ top: 0 });
            backButton.focus({ preventScroll: true });
            loadThread();
        }

        function closeThread() {
            const id = state.thread && state.thread.id;
            state.thread = null;
            view.dataset.view = 'home';
            threadView.hidden = true;
            home.hidden = false;
            const row = id != null ? listBody.querySelector(`[data-ticket-id="${CSS.escape(String(id))}"] .fpt-sp-ticket-open`) : null;
            (row || refreshButton).focus({ preventScroll: true });
            row?.scrollIntoView?.({ block: 'nearest' });
        }

        // Important inline height: the shared field styles pin textareas to a fixed height.
        function resizeComposer() {
            replyInput.style.setProperty('height', '40px', 'important');
            replyInput.style.setProperty('height', `${Math.min(Math.max(replyInput.scrollHeight, 40), 160)}px`, 'important');
        }

        async function sendReply() {
            const thread = state.thread;
            const text = replyInput.value.trim();
            if (!thread || !text || thread.sending || !thread.details || !thread.details.token) return;
            thread.sending = true;
            const pending = { author: getUsername(), plain: text, timestamp: 'отправляется…', pending: true };
            thread.outbox.push(pending);
            renderThread();
            scrollThreadToEnd();
            try {
                await run('fp-ticket-reply-btn', { ticketId: thread.id, message: text, token: thread.details.token });
                if (state.thread !== thread) return;
                replyInput.value = '';
                resizeComposer();
                pending.pending = false;
                pending.timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                toast('Ответ отправлен.');
                thread.sending = false;
                // Reload for the server copy of the message and a fresh form token.
                loadThread();
            } catch (error) {
                thread.outbox = thread.outbox.filter(item => item !== pending);
                toast(error.message || 'Не удалось отправить ответ.', 'error');
            } finally {
                if (state.thread === thread) {
                    thread.sending = false;
                    renderThread();
                    if (!replyInput.disabled) replyInput.focus({ preventScroll: true });
                }
            }
        }

        // --- Interactions ----------------------------------------------------------------------
        refreshButton.addEventListener('click', () => loadTickets({ force: true, quiet: state.loaded }));
        createButtonEl.addEventListener('click', () => { newTicketDraft = null; openNewTicket(); });
        autoButton.addEventListener('click', buildAutoTicket);
        [metricAll, metricActive, metricSolved].forEach(item => item.button.addEventListener('click', () => {
            state.status = item.button.dataset.filter;
            render();
            list.card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        }));
        search.addEventListener('input', () => {
            state.query = search.value;
            renderList();
        });
        segButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                if (state.status === button.dataset.value) return;
                state.status = button.dataset.value;
                render();
            });
            button.addEventListener('keydown', event => {
                const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
                if (!step) return;
                event.preventDefault();
                const target = segButtons[(index + step + segButtons.length) % segButtons.length];
                target.focus();
                target.click();
            });
        });
        sortSelect.addEventListener('change', () => {
            if (state.sort === sortSelect.value) return;
            state.sort = sortSelect.value;
            renderList();
        });
        backButton.addEventListener('click', closeThread);
        threadReload.addEventListener('click', loadThread);
        threadClose.addEventListener('click', () => state.thread && confirmClose(state.thread));
        replyInput.addEventListener('input', () => {
            resizeComposer();
            if (state.thread) replyButton.disabled = state.thread.sending || !replyInput.value.trim();
        });
        replyInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                sendReply();
            }
        });
        replyButton.addEventListener('click', sendReply);
        threadView.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !popup.querySelector('.fpt-lot-dialog-backdrop') && event.target !== replyInput) {
                event.preventDefault();
                closeThread();
            }
        });

        root.chrome?.storage?.onChanged?.addListener((changes, area) => {
            if (area !== 'local' || !page.isConnected || !changes[AUTO_KEY] || autoSaveTimer) return;
            state.auto = normalizeAuto(changes[AUTO_KEY].newValue);
            renderAuto();
        });
        ui.onPageActivated(page, ensureFresh);

        render();
        if (page.classList.contains('active')) ensureFresh();
    }

    root.FPTSupportPage = Object.freeze({
        mount,
        statusKind,
        countTickets,
        filterTickets,
        normalizeAuto,
        evaluateCondition,
        formatAge,
        DEFAULT_AUTO,
        AUTO_KEY
    });
})(window);
