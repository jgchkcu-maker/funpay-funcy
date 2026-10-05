// Interface elements: buttons, fields and menu items Funcy adds to FunPay pages. Each one can be hidden live.
(function (root) {
    'use strict';
    const PAGE_ID = 'needs';
    const STORAGE_KEY = 'fpToolsDisabledFeatures';
    // A child element lives inside its parent on FunPay, so it is listed under it.
    const PARENT_BY_CHILD = Object.freeze({ lot_keyboard_btn: 'lot_font_controls' });
    const GROUP_ICONS = Object.freeze({
        'Верхняя панель': 'web_asset',
        'Чат': 'forum',
        'Создание и оформление лота': 'edit_note',
        'Копирование и импорт лотов': 'content_copy',
        'Цены и аналитика': 'query_stats',
        'Список лотов и профиль': 'view_list'
    });
    const SUBGROUP_ICONS = Object.freeze({ 'Поле ввода': 'keyboard', 'Шапка диалога': 'top_panel_open', 'Действия в диалоге': 'more_vert' });
    const FILTERS = Object.freeze([
        { value: 'all', label: 'Все' }, { value: 'shown', label: 'Показаны' }, { value: 'hidden', label: 'Скрыты' }
    ]);
    const AI_EXAMPLES = Object.freeze([
        'Убери лишнее из чата', 'Не копирую чужие лоты', 'Скрой всё про ИИ', 'Не нужны кнопки в редакторе лота'
    ]);

    const normalize = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
    const pluralize = (count, forms) => root.FPTPopupUI?.pluralize
        ? root.FPTPopupUI.pluralize(count, forms)
        : forms[count === 1 ? 0 : 2];

    function registry() {
        if (typeof FPT_FEATURE_REGISTRY !== 'undefined' && Array.isArray(FPT_FEATURE_REGISTRY)) return FPT_FEATURE_REGISTRY;
        return Array.isArray(root.FPT_FEATURE_REGISTRY) ? root.FPT_FEATURE_REGISTRY : [];
    }
    // feature_registry.js declares the taxonomy as top-level consts shared by all content scripts.
    const groupOrder = () => typeof FPT_NEEDS_GROUP_ORDER !== 'undefined' ? FPT_NEEDS_GROUP_ORDER : [];
    const subgroupOrder = () => typeof FPT_NEEDS_CHAT_SUBGROUP_ORDER !== 'undefined' ? FPT_NEEDS_CHAT_SUBGROUP_ORDER : [];
    const legacyPageLabels = () => typeof FPT_NEEDS_LEGACY_PAGE_LABELS !== 'undefined' ? FPT_NEEDS_LEGACY_PAGE_LABELS : [];

    function entryMatches(entry, query) {
        if (!query) return true;
        const values = [entry.label, entry.desc, entry.group, entry.subgroup,
            ...(Array.isArray(entry.legacyLabels) ? entry.legacyLabels : []), ...legacyPageLabels()];
        return normalize(values.filter(Boolean).join(' ')).includes(query);
    }

    // Ordered groups → subgroups → top-level entries, each with its children.
    function layout(entries, { groups: order = groupOrder(), subgroups = subgroupOrder() } = {}) {
        const groups = [...order];
        entries.forEach(entry => { if (entry.group && !groups.includes(entry.group)) groups.push(entry.group); });
        const ids = new Set(entries.map(entry => entry.id));
        return groups.map(name => {
            const inGroup = entries.filter(entry => entry.group === name);
            const names = [...subgroups.filter(sub => inGroup.some(entry => entry.subgroup === sub))];
            inGroup.forEach(entry => { if (entry.subgroup && !names.includes(entry.subgroup)) names.push(entry.subgroup); });
            const sections = [...names, null].map(sub => {
                const list = inGroup.filter(entry => (entry.subgroup || null) === sub || (sub === null && entry.subgroup && !names.includes(entry.subgroup)));
                const items = list
                    .filter(entry => !(PARENT_BY_CHILD[entry.id] && ids.has(PARENT_BY_CHILD[entry.id])
                        && list.some(other => other.id === PARENT_BY_CHILD[entry.id])))
                    .map(entry => ({ entry, children: list.filter(child => PARENT_BY_CHILD[child.id] === entry.id) }));
                return { name: sub, items };
            }).filter(section => section.items.length);
            return { name, icon: GROUP_ICONS[name] || 'widgets', entries: inGroup, sections };
        }).filter(group => group.entries.length);
    }

    // id → 'match' | 'context'; missing ids are filtered out. A child that matches keeps its parent visible as context.
    function visibility(entries, disabled, { query = '', filter = 'all' } = {}) {
        const q = normalize(query);
        const result = new Map();
        const passesFilter = entry => filter === 'all'
            || (filter === 'hidden') === (!entry.locked && disabled.has(entry.id));
        entries.forEach(entry => { if (passesFilter(entry) && entryMatches(entry, q)) result.set(entry.id, 'match'); });
        entries.forEach(entry => {
            const parent = PARENT_BY_CHILD[entry.id];
            if (result.get(entry.id) === 'match' && parent && !result.has(parent) && entries.some(other => other.id === parent)) {
                result.set(parent, 'context');
            }
        });
        return result;
    }

    function summarize(entries, disabled) {
        const hidden = entries.filter(entry => !entry.locked && disabled.has(entry.id)).length;
        const groups = new Set(entries.map(entry => entry.group).filter(Boolean)).size;
        return { total: entries.length, hidden, shown: entries.length - hidden, groups };
    }

    function previewHtml(entry) {
        const html = entry.preview?.kind === 'html' ? String(entry.preview.html || '') : '';
        if (!html.includes('{{MAGIC_ICON}}')) return html;
        let url = 'icons/magic.png';
        try { url = root.chrome?.runtime?.getURL?.('icons/magic.png') || url; } catch (_) {}
        return html.split('{{MAGIC_ICON}}').join(url);
    }

    function node(tag, className, content) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content !== undefined) el.textContent = content;
        return el;
    }
    function icon(name) {
        const el = node('span', 'material-symbols-rounded', name);
        el.setAttribute('aria-hidden', 'true');
        return el;
    }
    function button(label, className = '', iconName) {
        const el = node('button', `fpt-qr-button ${className}`.trim());
        el.type = 'button';
        if (iconName) el.append(icon(iconName));
        if (label) el.append(node('span', '', label));
        return el;
    }
    function makeSwitch(label) {
        const wrap = node('label', 'switch fpt-qr-switch');
        const input = node('input', '');
        input.type = 'checkbox';
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', label);
        wrap.append(input, node('span', 'fpt-qr-switch-track'));
        return { element: wrap, input };
    }
    function metric(iconName, label) {
        const element = node('div', 'fpt-qr-metric');
        const badge = node('span', 'fpt-qr-metric-icon');
        badge.append(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        copy.append(node('span', 'fpt-qr-metric-label', label), value);
        element.append(badge, copy);
        return { element, value };
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptInterfaceElementsMount) return page?._fptInterfaceElementsMount;
        const ui = root.FPTPopupUI;
        if (!ui || !root.fptPopupActions) throw new Error('Shared popup components are unavailable.');
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const entries = registry();
        const byId = new Map(entries.map(entry => [entry.id, entry]));
        const groups = layout(entries);
        const state = {
            disabled: new Set(), loaded: false, query: '', filter: 'all', pending: 0,
            suggestions: [], aiBusy: false, activeDialog: null
        };
        const rows = new Map();
        const groupViews = [];
        const toast = (message, kind = 'success') => ui.showToast?.(popup, message, kind);

        // --- Header and help ---------------------------------------------------------------------
        const helpPanel = node('aside', 'fpt-qr-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-ie-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по элементам интерфейса');
        helpPanel.append(node('h2', '', 'Элементы интерфейса'));
        const helpList = node('ul', '');
        [
            'Здесь собраны кнопки, поля и пункты меню, которые FunPay Funcy добавляет на страницы FunPay.',
            'Выключенный элемент сразу пропадает со страницы — без перезагрузки. Сама функция и её настройки не удаляются.',
            'Значок глаза показывает, как элемент выглядит на сайте, чтобы его было проще узнать.',
            'Кнопка «Клавиатура» живёт внутри блока шрифта: если скрыть блок, пропадёт и она.',
            'Опишите словами, что мешает, — ИИ подберёт элементы, а скрыты будут только те, что вы отметите.'
        ].forEach(item => helpList.append(node('li', '', item)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Элементы интерфейса', {
            onHelp: event => {
                helpPanel.hidden = !helpPanel.hidden;
                event.currentTarget.setAttribute('aria-expanded', String(!helpPanel.hidden));
            }
        });
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        header.helpButton.setAttribute('aria-controls', helpPanel.id);
        header.helpButton.before(helpAnchor);
        helpAnchor.append(header.helpButton, helpPanel);
        const closeHelp = () => {
            helpPanel.hidden = true;
            header.helpButton.setAttribute('aria-expanded', 'false');
        };
        const onHelpOutside = event => { if (!helpAnchor.contains(event.target)) closeHelp(); };
        document.addEventListener('pointerdown', onHelpOutside);
        page.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !helpPanel.hidden) { closeHelp(); header.helpButton.focus(); }
        });

        const screen = node('div', 'fpt-interface-elements');
        page.append(screen);

        // --- Hero --------------------------------------------------------------------------------
        const hero = node('section', 'fpt-qr-hero fpt-ie-hero');
        hero.setAttribute('aria-labelledby', 'fpt-ie-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.append(icon('dashboard_customize'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Только нужное на FunPay');
        heroTitle.id = 'fpt-ie-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Funcy добавляет на страницы FunPay кнопки, поля и пункты меню. Скройте лишние — сайт обновится сразу.'));
        heroMain.append(heroIcon, heroCopy);
        const metricShown = metric('visibility', 'Показано');
        const metricHidden = metric('visibility_off', 'Скрыто');
        const metricGroups = metric('dashboard', 'Где появляются');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricShown.element, metricHidden.element, metricGroups.element);
        // Element map: one tick per element, grouped by section of the site.
        const map = node('div', 'fpt-ie-map');
        map.setAttribute('aria-hidden', 'true');
        const ticks = new Map();
        groups.forEach(group => {
            const segment = node('div', 'fpt-ie-map-group');
            segment.style.flexGrow = String(group.entries.length);
            segment.title = group.name;
            group.entries.forEach(entry => {
                const tick = node('span', 'fpt-ie-map-tick');
                tick.title = entry.label;
                ticks.set(entry.id, tick);
                segment.append(tick);
            });
            map.append(segment);
        });
        hero.append(heroMain, metrics, map);

        const banner = node('div', 'fpt-qr-banner');
        banner.setAttribute('role', 'alert');
        banner.hidden = true;
        const bannerText = node('span', 'fpt-qr-banner-text');
        const retry = button('Повторить', 'fpt-qr-banner-action', 'refresh');
        banner.append(icon('error'), bannerText, retry);
        retry.addEventListener('click', () => load());

        // --- AI assistant ------------------------------------------------------------------------
        const aiCard = node('section', 'fpt-qr-card fpt-ie-ai');
        aiCard.setAttribute('aria-labelledby', 'fpt-ie-ai-title');
        const aiHead = node('div', 'fpt-qr-card-head');
        const aiEmblem = node('span', 'fpt-qr-emblem fpt-ie-ai-emblem');
        aiEmblem.append(icon('auto_awesome'));
        const aiCopy = node('div', 'fpt-qr-card-copy');
        const aiTitle = node('h3', '', 'Скрыть с помощью ИИ');
        aiTitle.id = 'fpt-ie-ai-title';
        aiCopy.append(aiTitle, node('p', '', 'Опишите словами, что мешает, — ИИ найдёт подходящие элементы, а вы решите, что скрыть.'));
        aiHead.append(aiEmblem, aiCopy);
        const aiBody = node('div', 'fpt-ie-ai-body');
        const aiLabel = node('label', 'fpt-ie-visually-hidden', 'Что хотите скрыть');
        aiLabel.htmlFor = 'fptNeedsInput';
        const aiInput = node('textarea', 'fpt-qr-textarea fpt-control-field fpt-ie-ai-input');
        aiInput.id = 'fptNeedsInput';
        aiInput.rows = 2;
        aiInput.placeholder = 'Например: «не пользуюсь переводом и экспортом чатов»';
        const aiControls = node('div', 'fpt-ie-ai-controls');
        const examples = node('div', 'fpt-ie-ai-examples');
        examples.setAttribute('role', 'group');
        examples.setAttribute('aria-label', 'Примеры запросов');
        AI_EXAMPLES.forEach(example => {
            const chip = button(example, 'fpt-qr-chip');
            chip.addEventListener('click', () => {
                aiInput.value = example;
                aiInput.focus();
                syncAiButton();
            });
            examples.append(chip);
        });
        const askButton = button('Подобрать', 'fpt-qr-primary fpt-ie-ai-ask', 'auto_awesome');
        askButton.id = 'fptNeedsAskBtn';
        aiControls.append(examples, askButton);
        const aiResult = node('div', 'fpt-ie-ai-result');
        aiResult.setAttribute('aria-live', 'polite');
        aiResult.hidden = true;
        aiBody.append(aiLabel, aiInput, aiControls, aiResult);
        aiCard.append(aiHead, aiBody);

        function syncAiButton() { askButton.disabled = state.aiBusy || !state.loaded || !aiInput.value.trim(); }
        aiInput.addEventListener('input', syncAiButton);
        aiInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !askButton.disabled) { event.preventDefault(); ask(); }
        });
        askButton.addEventListener('click', () => ask());

        function aiMessage(kind, iconName, message) {
            aiResult.replaceChildren();
            aiResult.hidden = false;
            aiResult.dataset.kind = kind;
            const line = node('p', 'fpt-ie-ai-message');
            const glyph = icon(iconName);
            if (kind === 'loading') glyph.classList.add('fpt-ie-spin');
            line.append(glyph, node('span', '', message));
            aiResult.append(line);
            return line;
        }
        async function ask() {
            const text = aiInput.value.trim();
            if (!text || state.aiBusy) return;
            state.aiBusy = true;
            syncAiButton();
            aiMessage('loading', 'progress_activity', 'ИИ подбирает элементы…');
            try {
                const matches = await run('fptNeedsAskBtn', { text });
                state.suggestions = matches.map(match => ({
                    id: match.id,
                    reason: typeof match.reason === 'string' && match.reason.trim() ? match.reason.trim() : byId.get(match.id)?.desc || '',
                    confidence: Number.isFinite(Number(match.confidence)) ? Math.max(0, Math.min(1, Number(match.confidence))) : null
                })).filter((item, index, list) => byId.has(item.id) && list.findIndex(other => other.id === item.id) === index);
                renderSuggestions();
            } catch (error) {
                state.suggestions = [];
                aiMessage('error', 'error', error.message || 'Не удалось подобрать элементы.');
            } finally {
                state.aiBusy = false;
                syncAiButton();
            }
        }
        function renderSuggestions() {
            if (!state.suggestions.length) {
                aiMessage('empty', 'search_off', 'Подходящих элементов не нашлось. Переформулируйте запрос или выберите элементы в списке ниже.');
                return;
            }
            aiResult.replaceChildren();
            aiResult.hidden = false;
            aiResult.dataset.kind = 'results';
            const head = node('p', 'fpt-ie-ai-message');
            head.append(icon('auto_awesome'), node('span', '', 'ИИ предлагает скрыть. Снимите галочки с того, что оставить:'));
            const list = node('div', 'fpt-ie-suggestions');
            list.setAttribute('role', 'group');
            list.setAttribute('aria-label', 'Предложения ИИ');
            const picks = [];
            state.suggestions.forEach(suggestion => {
                const entry = byId.get(suggestion.id);
                const hidden = state.disabled.has(entry.id);
                const item = node('label', 'fpt-ie-suggestion');
                item.dataset.id = entry.id;
                const input = node('input', 'fpt-ie-suggestion-pick');
                input.type = 'checkbox';
                input.checked = !hidden;
                input.disabled = hidden;
                input.dataset.id = entry.id;
                const copy = node('span', 'fpt-ie-suggestion-copy');
                const title = node('span', 'fpt-ie-suggestion-title');
                title.append(node('strong', '', entry.label));
                if (hidden) title.append(node('span', 'fpt-qr-badge fpt-qr-badge--muted', 'Уже скрыт'));
                copy.append(title, node('span', 'fpt-ie-suggestion-reason', suggestion.reason));
                item.append(input, copy);
                if (suggestion.confidence !== null) {
                    const confidence = node('span', 'fpt-ie-confidence', `${Math.round(suggestion.confidence * 100)}%`);
                    confidence.title = 'Уверенность ИИ';
                    confidence.style.setProperty('--ie-confidence', String(suggestion.confidence));
                    item.append(confidence);
                }
                list.append(item);
                if (!hidden) picks.push(input);
            });
            const footer = node('div', 'fpt-ie-ai-footer');
            const cancel = button('Отмена', 'fpt-qr-ghost');
            const confirm = button('', 'fpt-qr-primary', 'visibility_off');
            confirm.id = 'fptNeedsAiConfirm';
            const confirmLabel = node('span', '');
            confirm.append(confirmLabel);
            const syncConfirm = () => {
                const count = picks.filter(input => input.checked).length;
                confirmLabel.textContent = count ? `Скрыть ${count} ${pluralize(count, ['элемент', 'элемента', 'элементов'])}` : 'Ничего не выбрано';
                confirm.disabled = !count;
            };
            picks.forEach(input => input.addEventListener('change', syncConfirm));
            syncConfirm();
            cancel.addEventListener('click', () => { state.suggestions = []; aiResult.hidden = true; aiResult.replaceChildren(); aiInput.focus(); });
            confirm.addEventListener('click', async () => {
                const ids = picks.filter(input => input.checked).map(input => input.dataset.id);
                if (!ids.length) return;
                confirm.disabled = true;
                cancel.disabled = true;
                const ok = await write(Object.fromEntries(ids.map(id => [id, false])),
                    `Скрыто ${ids.length} ${pluralize(ids.length, ['элемент', 'элемента', 'элементов'])}`, 'fptNeedsAiConfirm', { ids });
                if (ok) {
                    state.suggestions = [];
                    aiInput.value = '';
                    syncAiButton();
                    aiMessage('success', 'check_circle', 'Готово. Вернуть элементы можно переключателями в списке ниже.');
                } else {
                    cancel.disabled = false;
                    syncConfirm();
                }
            });
            footer.append(cancel, confirm);
            aiResult.append(head, list, footer);
        }

        // --- Toolbar -----------------------------------------------------------------------------
        const catalog = node('section', 'fpt-ie-catalog');
        catalog.setAttribute('aria-labelledby', 'fpt-ie-catalog-title');
        const catalogHead = node('div', 'fpt-ie-catalog-head');
        const catalogTitle = node('h3', 'fpt-qr-list-title', 'Все элементы');
        catalogTitle.id = 'fpt-ie-catalog-title';
        const catalogCount = node('span', 'fpt-qr-pill', String(entries.length));
        const showAll = button('Показать всё', 'fpt-qr-ghost fpt-ie-show-all', 'select_check_box');
        catalogHead.append(catalogTitle, catalogCount, showAll);
        const toolbar = node('div', 'fpt-ie-toolbar');
        const searchWrap = node('div', 'fpt-ie-search');
        searchWrap.append(icon('search'));
        const search = node('input', 'fpt-ie-search-input');
        search.type = 'search';
        search.id = 'fptNeedsFilter';
        search.placeholder = 'Найти: «перевод», «копировать», «цена»…';
        search.setAttribute('aria-label', 'Найти элемент');
        search.autocomplete = 'off';
        searchWrap.append(search);
        const filter = node('div', 'fpt-qr-seg fpt-ie-filter');
        filter.setAttribute('role', 'radiogroup');
        filter.setAttribute('aria-label', 'Показать элементы');
        filter.style.setProperty('--qr-seg-count', String(FILTERS.length));
        filter.append(node('span', 'fpt-qr-seg-pill'));
        const filterButtons = FILTERS.map((option, index) => {
            const el = button(option.label, 'fpt-qr-seg-button');
            el.setAttribute('role', 'radio');
            el.dataset.value = option.value;
            const count = node('span', 'fpt-ie-filter-count', '0');
            el.append(count);
            el._count = count;
            el.addEventListener('click', () => setFilter(option.value, true));
            el.addEventListener('keydown', event => {
                let next = -1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % FILTERS.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + FILTERS.length) % FILTERS.length;
                if (next < 0) return;
                event.preventDefault();
                filterButtons[next].focus();
                setFilter(FILTERS[next].value, true);
            });
            filter.append(el);
            return el;
        });
        toolbar.append(searchWrap, filter);
        function setFilter(value) {
            const index = Math.max(0, FILTERS.findIndex(option => option.value === value));
            state.filter = FILTERS[index].value;
            filter.style.setProperty('--qr-seg-index', String(index));
            filterButtons.forEach((el, i) => {
                el.setAttribute('aria-checked', String(i === index));
                el.tabIndex = i === index ? 0 : -1;
            });
            applyVisibility();
        }
        search.addEventListener('input', () => { state.query = search.value; applyVisibility(); });
        search.addEventListener('keydown', event => {
            if (event.key === 'Escape' && search.value) { event.stopPropagation(); search.value = ''; state.query = ''; applyVisibility(); }
        });

        // --- Catalog -----------------------------------------------------------------------------
        const layoutEl = node('div', 'fpt-ie-layout');
        const nav = node('nav', 'fpt-ie-nav');
        nav.setAttribute('aria-label', 'Разделы сайта');
        nav.append(node('span', 'fpt-ie-nav-title', 'Разделы'));
        const groupsEl = node('div', 'fpt-ie-groups');
        const empty = node('div', 'fpt-qr-empty fpt-ie-empty');
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        const resetFilters = button('Сбросить поиск', 'fpt-qr-ghost', 'filter_alt_off');
        const emptyTitle = node('strong', '', 'Ничего не найдено');
        const emptyHint = node('span', '', 'Попробуйте другое слово — поиск смотрит в названия, описания и разделы.');
        empty.append(icon('search_off'), emptyTitle, emptyHint, resetFilters);
        resetFilters.addEventListener('click', () => {
            search.value = '';
            state.query = '';
            setFilter('all');
            search.focus();
        });
        groupsEl.append(empty);
        layoutEl.append(nav, groupsEl);
        catalog.append(catalogHead, toolbar, layoutEl);

        function itemRow(entry, { child = false } = {}) {
            const row = node('div', `fpt-ie-row${child ? ' fpt-ie-row--child' : ''}`);
            row.dataset.id = entry.id;
            row.setAttribute('role', 'listitem');
            const main = node('div', 'fpt-ie-row-main');
            const title = node('div', 'fpt-ie-row-title');
            if (child) title.append(icon('subdirectory_arrow_right'));
            const name = node('strong', 'fpt-ie-row-name', entry.label);
            name.id = `fpt-ie-name-${entry.id}`;
            const hiddenBadge = node('span', 'fpt-qr-badge fpt-qr-badge--muted fpt-ie-hidden-badge');
            hiddenBadge.append(icon('visibility_off'), node('span', '', 'Скрыт'));
            const contextBadge = node('span', 'fpt-qr-badge fpt-ie-context-badge', 'Содержит найденное');
            title.append(name, hiddenBadge, contextBadge);
            const desc = node('p', 'fpt-ie-row-desc', entry.desc || '');
            main.append(title, desc);
            let note = null;
            const parentId = PARENT_BY_CHILD[entry.id];
            if (parentId && byId.has(parentId)) {
                note = node('p', 'fpt-ie-row-note');
                note.append(icon('info'), node('span', '', `Не видна, пока скрыт «${byId.get(parentId).label}».`));
            }
            if (note) main.append(note);
            const actions = node('div', 'fpt-ie-row-actions');
            const previewButton = node('button', 'fpt-qr-button fpt-qr-icon-button fpt-ie-preview-button');
            previewButton.type = 'button';
            previewButton.append(icon('visibility'));
            previewButton.setAttribute('aria-label', `Как выглядит «${entry.label}»`);
            previewButton.title = 'Как выглядит на FunPay';
            previewButton.setAttribute('aria-expanded', 'false');
            previewButton.setAttribute('aria-controls', `fpt-ie-preview-${entry.id}`);
            previewButton.dataset.id = entry.id;
            actions.append(previewButton);
            let toggle = null;
            if (entry.locked) {
                const lock = node('span', 'fpt-ie-lock');
                lock.title = 'Этот элемент нельзя скрыть';
                lock.append(icon('lock'));
                actions.append(lock);
            } else {
                toggle = makeSwitch(`Показывать «${entry.label}»`);
                toggle.input.dataset.id = entry.id;
                toggle.input.addEventListener('change', () => {
                    const enabled = toggle.input.checked;
                    write({ [entry.id]: enabled }, enabled ? `«${entry.label}» снова на месте` : `«${entry.label}» скрыт`);
                });
                actions.append(toggle.element);
            }
            const preview = node('div', 'fpt-ie-preview');
            preview.id = `fpt-ie-preview-${entry.id}`;
            preview.hidden = true;
            previewButton.addEventListener('click', () => {
                const open = preview.hidden;
                if (open && !preview.childElementCount) {
                    const caption = node('span', 'fpt-ie-preview-caption');
                    caption.append(icon('preview'), node('span', '', 'Так выглядит на FunPay'));
                    const stage = node('div', 'fpt-pv-stage fpt-ie-stage');
                    const html = previewHtml(entry);
                    // Registry previews are static markup shipped with the extension, never user input.
                    if (html) stage.innerHTML = html;
                    else { stage.classList.add('fpt-pv-none'); stage.textContent = 'Нет предпросмотра'; }
                    preview.append(caption, stage);
                }
                preview.hidden = !open;
                previewButton.setAttribute('aria-expanded', String(open));
            });
            row.append(main, actions, preview);
            const view = { entry, row, toggle, hiddenBadge, contextBadge, note, tick: ticks.get(entry.id) };
            rows.set(entry.id, view);
            return row;
        }

        groups.forEach((group, groupIndex) => {
            const card = node('section', 'fpt-qr-card fpt-ie-group');
            card.dataset.group = group.name;
            const headingId = `fpt-ie-group-${groupIndex}`;
            card.setAttribute('aria-labelledby', headingId);
            const head = node('div', 'fpt-qr-card-head fpt-ie-group-head');
            const emblem = node('span', 'fpt-qr-emblem');
            emblem.append(icon(group.icon));
            const copy = node('div', 'fpt-qr-card-copy');
            const heading = node('h3', '', group.name);
            heading.id = headingId;
            const status = node('p', '', '');
            copy.append(heading, status);
            const unlocked = group.entries.filter(entry => !entry.locked);
            const groupToggle = makeSwitch(`Показывать все элементы раздела «${group.name}»`);
            groupToggle.element.classList.add('fpt-ie-group-switch');
            groupToggle.input.addEventListener('change', () => {
                const enabled = groupToggle.input.checked;
                const changes = Object.fromEntries(unlocked.map(entry => [entry.id, enabled]));
                write(changes, enabled ? `Раздел «${group.name}» показан полностью` : `Раздел «${group.name}» скрыт`);
            });
            head.append(emblem, copy);
            if (unlocked.length) head.append(groupToggle.element);
            const body = node('div', 'fpt-ie-group-body');
            const sections = group.sections.map(section => {
                const wrap = node('div', 'fpt-ie-section');
                if (section.name) {
                    const subtitle = node('h4', 'fpt-ie-subgroup-title');
                    subtitle.append(icon(SUBGROUP_ICONS[section.name] || 'label'), node('span', '', section.name));
                    wrap.append(subtitle);
                }
                const list = node('div', 'fpt-ie-rows');
                list.setAttribute('role', 'list');
                const items = section.items.map(({ entry, children }) => {
                    if (!children.length) {
                        const row = itemRow(entry);
                        list.append(row);
                        return { element: row, ids: [entry.id] };
                    }
                    const branch = node('div', 'fpt-ie-branch');
                    branch.setAttribute('role', 'listitem');
                    const parentRow = itemRow(entry);
                    parentRow.removeAttribute('role');
                    const nested = node('div', 'fpt-ie-children');
                    nested.setAttribute('role', 'list');
                    children.forEach(childEntry => nested.append(itemRow(childEntry, { child: true })));
                    branch.append(parentRow, nested);
                    list.append(branch);
                    return { element: branch, ids: [entry.id, ...children.map(childEntry => childEntry.id)] };
                });
                wrap.append(list);
                body.append(wrap);
                return { element: wrap, ids: items.flatMap(item => item.ids), items };
            });
            card.append(head, body);
            groupsEl.insertBefore(card, empty);
            const navButton = node('button', 'fpt-ie-nav-item');
            navButton.type = 'button';
            navButton.dataset.group = group.name;
            const navCount = node('span', 'fpt-ie-nav-count', '');
            navButton.append(icon(group.icon), node('span', 'fpt-ie-nav-label', group.name), navCount);
            navButton.addEventListener('click', () => {
                try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { card.scrollIntoView(); }
                card.classList.remove('fpt-ie-flash');
                void card.offsetWidth;
                card.classList.add('fpt-ie-flash');
            });
            nav.append(navButton);
            groupViews.push({ group, card, status, toggle: unlocked.length ? groupToggle : null, unlocked, sections, navButton, navCount });
        });

        screen.append(hero, banner, aiCard, catalog);

        // --- State → DOM -------------------------------------------------------------------------
        function sync() {
            const summary = summarize(entries, state.disabled);
            heroPill.textContent = !state.loaded ? (state.loadError ? 'Нет данных' : 'Загрузка…')
                : summary.hidden ? `Скрыто ${summary.hidden}` : 'Всё на месте';
            heroPill.dataset.kind = state.loaded && !summary.hidden ? 'success' : '';
            hero.dataset.state = state.loaded && !summary.hidden ? 'on' : 'off';
            metricShown.value.textContent = state.loaded ? `${summary.shown} из ${summary.total}` : '—';
            metricHidden.value.textContent = state.loaded
                ? summary.hidden ? `${summary.hidden} ${pluralize(summary.hidden, ['элемент', 'элемента', 'элементов'])}` : 'Ничего'
                : '—';
            metricGroups.value.textContent = `${summary.groups} ${pluralize(summary.groups, ['раздел', 'раздела', 'разделов'])} сайта`;
            showAll.disabled = !state.loaded || !summary.hidden;
            filterButtons.forEach(el => {
                const value = el.dataset.value;
                el._count.textContent = String(value === 'all' ? summary.total : value === 'hidden' ? summary.hidden : summary.shown);
            });
            rows.forEach(view => {
                const off = !view.entry.locked && state.disabled.has(view.entry.id);
                view.row.dataset.state = off ? 'off' : 'on';
                if (view.toggle) {
                    view.toggle.input.checked = !off;
                    view.toggle.input.disabled = !state.loaded || view.row.dataset.context === 'true';
                }
                if (view.tick) view.tick.dataset.state = off ? 'off' : 'on';
                const parentId = PARENT_BY_CHILD[view.entry.id];
                const blocked = Boolean(parentId && state.disabled.has(parentId));
                view.row.dataset.blocked = String(blocked);
                if (view.note) view.note.hidden = !blocked;
            });
            groupViews.forEach(view => {
                const hidden = view.unlocked.filter(entry => state.disabled.has(entry.id)).length;
                const total = view.group.entries.length;
                view.status.textContent = !hidden ? `${total} ${pluralize(total, ['элемент', 'элемента', 'элементов'])} · все показаны`
                    : hidden === total ? 'Все элементы скрыты' : `Показано ${total - hidden} из ${total}`;
                view.card.dataset.state = !hidden ? 'on' : hidden === total ? 'off' : 'partial';
                view.navCount.textContent = `${total - hidden}/${total}`;
                view.navButton.dataset.state = view.card.dataset.state;
                if (view.toggle) {
                    view.toggle.input.checked = hidden === 0;
                    view.toggle.input.disabled = !state.loaded;
                    view.toggle.element.dataset.partial = String(hidden > 0 && hidden < view.unlocked.length);
                }
            });
        }

        function applyVisibility() {
            const visible = visibility(entries, state.disabled, { query: state.query, filter: state.filter });
            rows.forEach((view, id) => {
                const mode = visible.get(id);
                view.row.hidden = !mode;
                view.row.dataset.context = String(mode === 'context');
                view.contextBadge.hidden = mode !== 'context';
                if (view.toggle) view.toggle.input.disabled = !state.loaded || mode === 'context';
            });
            let shown = 0;
            groupViews.forEach(view => {
                let groupVisible = 0;
                view.sections.forEach(section => {
                    section.items.forEach(item => {
                        const any = item.ids.some(id => visible.has(id));
                        if (item.element.classList.contains('fpt-ie-branch')) item.element.hidden = !any;
                    });
                    const count = section.ids.filter(id => visible.get(id) === 'match').length;
                    section.element.hidden = !section.ids.some(id => visible.has(id));
                    groupVisible += count;
                });
                view.card.hidden = !view.sections.some(section => !section.element.hidden);
                view.navButton.hidden = view.card.hidden;
                shown += groupVisible;
            });
            const filtering = Boolean(normalize(state.query)) || state.filter !== 'all';
            catalogCount.textContent = filtering ? `${shown} из ${entries.length}` : String(entries.length);
            empty.hidden = shown > 0;
            if (!shown) {
                const onlyFilter = !normalize(state.query) && state.filter !== 'all';
                emptyTitle.textContent = onlyFilter
                    ? state.filter === 'hidden' ? 'Скрытых элементов нет' : 'Все элементы скрыты'
                    : 'Ничего не найдено';
                emptyHint.textContent = onlyFilter
                    ? state.filter === 'hidden' ? 'Всё, что добавляет Funcy, сейчас видно на FunPay.' : 'Включите нужные элементы на вкладке «Все».'
                    : 'Попробуйте другое слово — поиск смотрит в названия, описания и разделы.';
                resetFilters.lastChild.textContent = onlyFilter ? 'Показать все' : 'Сбросить поиск';
            }
            layoutEl.dataset.empty = String(!shown);
        }

        function renderAll() {
            applyVisibility();
            sync();
            syncAiButton();
        }

        // --- Writes ------------------------------------------------------------------------------
        async function write(changes, message, action = 'fptApplyNeedsSelection', payload = { enabled: changes }) {
            const previous = new Map(Object.keys(changes).map(id => [id, state.disabled.has(id)]));
            for (const [id, enabled] of Object.entries(changes)) {
                if (enabled) state.disabled.delete(id); else state.disabled.add(id);
            }
            state.pending += 1;
            sync();
            let ok = true;
            try {
                const ids = await run(action, payload);
                if (state.pending === 1 && Array.isArray(ids)) state.disabled = new Set(ids);
                if (message) toast(message, 'success');
            } catch (error) {
                ok = false;
                previous.forEach((wasDisabled, id) => { if (wasDisabled) state.disabled.add(id); else state.disabled.delete(id); });
                toast(error.message || 'Не удалось сохранить. Попробуйте ещё раз.', 'error');
            } finally {
                state.pending -= 1;
                sync();
                if (state.filter !== 'all') applyVisibility();
            }
            return ok;
        }

        showAll.addEventListener('click', () => {
            const hidden = entries.filter(entry => !entry.locked && state.disabled.has(entry.id));
            if (!hidden.length) return;
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, 'Показать все элементы?', {
                description: `Сейчас скрыто ${hidden.length} ${pluralize(hidden.length, ['элемент', 'элемента', 'элементов'])}. Они снова появятся на страницах FunPay.`
            });
            state.activeDialog = dialog;
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Показать всё', 'fpt-qr-primary', 'visibility');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                const ok = await write(Object.fromEntries(hidden.map(entry => [entry.id, true])), 'Все элементы снова на месте');
                dialog.setBusy(false);
                if (ok) dialog.close();
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        });

        // --- Loading and sync --------------------------------------------------------------------
        async function load() {
            retry.disabled = true;
            try {
                const stored = await run('getSettings', { keys: [STORAGE_KEY] });
                const ids = Array.isArray(stored?.[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
                state.disabled = new Set(ids.filter(id => byId.has(id)));
                state.loaded = true;
                state.loadError = '';
                banner.hidden = true;
            } catch (error) {
                state.loadError = error.message || 'Не удалось загрузить настройки элементов.';
                bannerText.textContent = state.loadError;
                banner.hidden = false;
            } finally {
                retry.disabled = false;
                renderAll();
            }
        }
        const onStorage = (changes, area) => {
            if (!page.isConnected) { dispose(); return; }
            if (area !== 'local' || !changes[STORAGE_KEY] || !state.loaded || state.pending) return;
            const ids = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
            state.disabled = new Set(ids.filter(id => byId.has(id)));
            sync();
            if (state.filter !== 'all') applyVisibility();
        };
        function dispose() {
            document.removeEventListener('pointerdown', onHelpOutside);
            root.chrome?.storage?.onChanged?.removeListener(onStorage);
            state.activeDialog?.close({ force: true });
            disposal.disconnect();
        }
        root.chrome?.storage?.onChanged?.addListener(onStorage);
        const disposal = new MutationObserver(() => { if (!page.isConnected) dispose(); });
        disposal.observe(document.body, { childList: true, subtree: true });
        setFilter('all');
        renderAll();
        const loading = load();
        page._fptInterfaceElementsMount = loading;
        return loading;
    }

    root.FPTInterfaceElementsPage = Object.freeze({ mount, layout, visibility, summarize, entryMatches, previewHtml });
})(typeof window !== 'undefined' ? window : globalThis);
