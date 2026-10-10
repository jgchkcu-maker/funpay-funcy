// Quick replies: chat templates (button next to the paperclip) and slash commands share one screen.
(function (root) {
    'use strict';
    const PAGE_ID = 'templates';
    const TEMPLATE_KEY = 'fpToolsTemplateSettings';
    const COMMAND_KEY = 'fpToolsSlashCommands';
    const MODES = ['templates', 'commands'];
    const MAX_IMAGES = 5;
    const SEARCH_THRESHOLD = 5;
    const RANDOM_TOKEN = '{вариант 1|вариант 2}';
    const TEMPLATE_VARIABLES = [
        ['{welcome}', 'Приветствие'], ['{buyername}', 'Имя покупателя'], ['{lotname}', 'Название лота'],
        ['{date}', 'Дата и время'], ['{bal}', 'Баланс'], ['{activesells}', 'Активные продажи'],
        [RANDOM_TOKEN, 'Случайный вариант']
    ];
    const COMMAND_VARIABLES = [
        ['{buyername}', 'Имя собеседника'], ['{date}', 'Дата'], ['{time}', 'Время'], [RANDOM_TOKEN, 'Случайный вариант']
    ];
    const EXPAND_KEYS = [
        { value: 'both', label: 'Tab или Enter' }, { value: 'tab', label: 'Только Tab' }, { value: 'enter', label: 'Только Enter' }
    ];
    // Mirrors DEFAULT_STANDARD_TEMPLATES from templates.js for isolated contexts (tests).
    const FALLBACK_STANDARD = {
        greeting: { enabled: true, label: 'Приветствие', text: '{welcome}, {buyername}! Чем могу помочь?' },
        completed: { enabled: true, label: 'Заказ выполнен', text: 'Заказ выполнен. Пожалуйста, зайдите в раздел «Покупки», выберите его в списке и нажмите кнопку «Подтвердить выполнение заказа».' },
        review: { enabled: true, label: 'Попросить отзыв', text: 'Спасибо за покупку! Буду очень благодарен, если вы оставите отзыв о сделке.' },
        thanks: { enabled: true, label: 'Спасибо за заказ', text: 'Спасибо за заказ, {buyername}! Обращайтесь еще. {date}' }
    };
    const DEMO = {
        welcome: 'Добрый день!', buyername: 'Алексей', username: 'Алексей', lotname: 'Игровой аккаунт',
        date: '06.10.2026 14:30', bal: '1 250 ₽', activesells: '3'
    };
    const COMMAND_DEMO = { buyername: 'Алексей', username: 'Алексей', date: '06.10.2026', time: '14:30' };

    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const text = value => typeof value === 'string' ? value : '';
    const images = value => Array.isArray(value) ? value.filter(image => typeof image === 'string' && image) : [];
    const order = value => value === 'image_first' ? 'image_first' : 'text_first';

    function standardDefaults() {
        // templates.js declares the defaults as a top-level const shared by all content scripts.
        return typeof DEFAULT_STANDARD_TEMPLATES !== 'undefined' && object(DEFAULT_STANDARD_TEMPLATES)
            ? DEFAULT_STANDARD_TEMPLATES : FALLBACK_STANDARD;
    }

    function normalizeTemplates(saved, defaults = standardDefaults()) {
        const source = object(saved) ? saved : {};
        const items = Object.entries(defaults).map(([key, base]) => {
            const stored = object(source.standard?.[key]) ? source.standard[key] : {};
            const item = {
                key, custom: false,
                enabled: stored.enabled === undefined ? base.enabled !== false : stored.enabled !== false,
                label: typeof stored.label === 'string' ? stored.label : base.label,
                text: typeof stored.text === 'string' ? stored.text : base.text,
                images: images(stored.images), sendOrder: order(stored.sendOrder)
            };
            item.modified = item.label !== base.label || item.text !== base.text || item.images.length > 0;
            return item;
        });
        (Array.isArray(source.custom) ? source.custom : []).forEach(stored => {
            if (!object(stored) || stored.id === undefined || stored.id === null || stored.id === '') return;
            items.push({
                key: String(stored.id), custom: true, enabled: stored.enabled !== false,
                label: text(stored.label) || 'Без названия', text: text(stored.text),
                images: images(stored.images), sendOrder: order(stored.sendOrder), modified: false
            });
        });
        return {
            enabled: source.enabled !== false,
            sendTemplatesImmediately: source.sendTemplatesImmediately !== false,
            items
        };
    }

    function normalizeCommands(saved) {
        const source = object(saved) ? saved : {};
        return {
            enabled: source.enabled !== false,
            autocomplete: source.autocomplete !== false,
            expandKey: EXPAND_KEYS.some(option => option.value === source.expandKey) ? source.expandKey : 'both',
            commands: (Array.isArray(source.commands) ? source.commands : []).filter(object).map(command => ({
                id: command.id === undefined || command.id === null ? '' : String(command.id),
                trigger: text(command.trigger), response: text(command.response)
            }))
        };
    }

    function previewText(value, kind = 'template') {
        let result = String(value ?? '');
        if (kind === 'command') {
            result = result.replace(/\{(buyername|username|date|time)\}/gi, (_, key) => COMMAND_DEMO[key.toLowerCase()]);
        } else {
            result = result.replace(/\{(welcome|date|buyername|bal|activesells|lotname)\}/g, (_, key) => DEMO[key]);
        }
        result = result.replace(/\{([^{}|]*\|[^{}]*)\}/g, (full, inner) => /^ai:/i.test(inner) ? full : inner.split('|')[0]);
        if (kind !== 'command') result = result.replace(/\{ai:([^}]+)\}/gi, (_, prompt) => `[ИИ: ${prompt.trim()}]`);
        return result;
    }

    // Returns the trigger as the slash-commands runtime will match it, or an error message.
    function validateCommand(value, commands = [], excludeId = null) {
        const raw = String(value ?? '').trim();
        if (/\s/.test(raw)) return { trigger: '', error: 'Триггер должен быть одним словом, без пробелов.' };
        const body = raw.replace(/^\/+/, '');
        if (!body) return { trigger: '', error: 'Введите триггер команды.' };
        if (body.includes('/')) return { trigger: '', error: 'Символ «/» можно использовать только в начале.' };
        const trigger = `/${body}`;
        const duplicate = commands.find(command => command.id !== excludeId
            && String(command.trigger || '').trim().toLowerCase() === trigger.toLowerCase());
        if (duplicate) return { trigger, error: `Команда ${trigger} уже есть.` };
        return { trigger, error: '' };
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
    function iconButton(label, name, className = '') {
        const el = button('', `fpt-qr-icon-button ${className}`.trim(), name);
        el.setAttribute('aria-label', label);
        el.title = label;
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
    function variables(textarea, list, changed) {
        const wrap = node('div', 'fpt-qr-variables');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', 'Вставить переменную');
        for (const [token, label] of list) {
            const chip = button(label, 'fpt-qr-chip', token === RANDOM_TOKEN ? 'shuffle' : 'add');
            chip.title = token;
            chip.addEventListener('click', () => {
                const start = textarea.selectionStart ?? textarea.value.length;
                textarea.setRangeText(token, start, textarea.selectionEnd ?? start, 'end');
                // Select the sample variants so the seller can type over them.
                if (token === RANDOM_TOKEN) textarea.setSelectionRange(start + 1, start + token.length - 1);
                textarea.focus();
                changed();
            });
            wrap.append(chip);
        }
        return wrap;
    }
    function segmented(label, options, onChange) {
        const element = node('div', 'fpt-qr-seg');
        element.setAttribute('role', 'radiogroup');
        element.setAttribute('aria-label', label);
        element.style.setProperty('--qr-seg-count', String(options.length));
        element.append(node('span', 'fpt-qr-seg-pill'));
        let value = options[0].value;
        const buttons = options.map((option, index) => {
            const el = button(option.label, 'fpt-qr-seg-button', option.icon);
            el.setAttribute('role', 'radio');
            el.dataset.value = option.value;
            el.addEventListener('click', () => select(index, true));
            el.addEventListener('keydown', event => {
                let next = -1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
                if (next < 0) return;
                event.preventDefault();
                buttons[next].focus();
                select(next, true);
            });
            element.append(el);
            return el;
        });
        function select(index, notify) {
            value = options[index].value;
            element.style.setProperty('--qr-seg-index', String(index));
            buttons.forEach((el, i) => {
                el.setAttribute('aria-checked', String(i === index));
                el.tabIndex = i === index ? 0 : -1;
            });
            if (notify) onChange(value);
        }
        select(0, false);
        return {
            element, buttons,
            get value() { return value; },
            setValue(next) { const index = options.findIndex(option => option.value === next); select(index < 0 ? 0 : index, false); },
            setDisabled(disabled) { buttons.forEach(el => { el.disabled = disabled; }); }
        };
    }
    function settingRow(title, hint, control) {
        const row = node('div', 'fpt-qr-setting');
        const copy = node('div', 'fpt-qr-setting-copy');
        copy.append(node('h4', 'fpt-qr-setting-title', title), node('p', 'fpt-qr-setting-hint', hint));
        row.append(copy, control);
        return row;
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
    function emptyState(iconName, title, hint) {
        const el = node('div', 'fpt-qr-empty');
        el.setAttribute('role', 'status');
        el.append(icon(iconName), node('strong', '', title), node('span', '', hint));
        return el;
    }
    function bubble(content, { empty = 'Сообщение пустое' } = {}) {
        const el = node('div', 'fpt-qr-bubble');
        el.textContent = content || empty;
        if (!content) el.dataset.empty = 'true';
        return el;
    }
    function previewMessage(parts) {
        // Chat-like preview: the seller's avatar, name, time and the outgoing messages.
        const wrap = node('div', 'fpt-qr-message');
        const avatar = node('span', 'fpt-qr-avatar', 'В');
        avatar.setAttribute('aria-hidden', 'true');
        const body = node('div', 'fpt-qr-message-body');
        const meta = node('div', 'fpt-qr-message-meta');
        meta.append(node('strong', '', 'Вы'), node('span', '', '14:30'));
        body.append(meta, ...parts);
        wrap.append(avatar, body);
        return wrap;
    }
    function filterBy(query, values) {
        const q = query.trim().toLowerCase().replace(/ё/g, 'е');
        return !q || values.some(value => String(value).toLowerCase().replace(/ё/g, 'е').includes(q));
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptQuickRepliesMount) return page?._fptQuickRepliesMount;
        const ui = root.FPTPopupUI;
        if (!ui || !root.fptPopupActions) throw new Error('Shared popup components are unavailable.');
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const state = {
            templates: normalizeTemplates(), commands: normalizeCommands(), loaded: false, loadError: '',
            mode: 'templates', templateQuery: '', commandQuery: '', busy: new Set(),
            activeDialog: null, pendingRender: false
        };

        // --- Header and help ---------------------------------------------------------------------
        const helpPanel = node('aside', 'fpt-qr-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-qr-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по быстрым ответам');
        helpPanel.append(node('h2', '', 'Быстрые ответы'));
        const helpList = node('ul', '');
        [
            'Шаблоны открываются кнопкой слева от скрепки в чате FunPay. Клик по шаблону подставляет текст в поле ввода или сразу отправляет его.',
            'Слэш-команды: напечатайте «/» и начало триггера, затем Tab или Enter — триггер превратится в готовый ответ.',
            'Переменные подставляются при отправке: {welcome}, {buyername}, {lotname}, {date}, {bal}, {activesells}. В командах — {buyername}, {date}, {time}.',
            '{вариант1|вариант2} — при каждой отправке выбирается один случайный вариант.',
            '{ai:запрос} в шаблоне — текст, который ИИ сгенерирует по вашему запросу.',
            'К шаблону можно прикрепить до 5 изображений до 1 МБ: они отправятся до или после текста.'
        ].forEach(item => helpList.append(node('li', '', item)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Быстрые ответы', {
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

        const screen = node('div', 'fpt-quick-replies');
        page.append(screen);

        // --- Hero --------------------------------------------------------------------------------
        const hero = node('section', 'fpt-qr-hero');
        hero.setAttribute('aria-labelledby', 'fpt-qr-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.append(icon('bolt'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Ответы в один клик');
        heroTitle.id = 'fpt-qr-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Готовые сообщения у скрепки и слэш-команды, которые разворачиваются прямо в поле ввода.'));
        heroMain.append(heroIcon, heroCopy);
        const metricTemplates = metric('description', 'Активных шаблонов');
        const metricCommands = metric('terminal', 'Слэш-команд');
        const metricSend = metric('send', 'Отправка шаблона');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricTemplates.element, metricCommands.element, metricSend.element);
        hero.append(heroMain, metrics);

        const banner = node('div', 'fpt-qr-banner');
        banner.setAttribute('role', 'alert');
        banner.hidden = true;
        const bannerText = node('span', 'fpt-qr-banner-text');
        const retry = button('Повторить', 'fpt-qr-banner-action', 'refresh');
        banner.append(icon('error'), bannerText, retry);
        retry.addEventListener('click', () => load());

        // --- Tabs ----------------------------------------------------------------------------------
        const tabs = node('div', 'fpt-qr-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Быстрые ответы');
        tabs.append(node('span', 'fpt-qr-tabs-pill'));
        const panes = {};
        const tabButtons = MODES.map((mode, index) => {
            const tab = node('button', 'fpt-qr-tab');
            tab.type = 'button';
            tab.id = mode === 'templates' ? 'fptQuickRepliesTemplatesTab' : 'fptQuickRepliesCommandsTab';
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', `fpt-qr-${mode}-pane`);
            tab.dataset.mode = mode;
            const count = node('span', 'fpt-qr-tab-count', '0');
            tab.append(icon(mode === 'templates' ? 'description' : 'terminal'),
                node('span', '', mode === 'templates' ? 'Шаблоны' : 'Команды'), count);
            tab._count = count;
            tab.addEventListener('click', () => {
                setMode(mode);
                if (typeof root.fptSetPopupPageMode === 'function') Promise.resolve(root.fptSetPopupPageMode(PAGE_ID, mode)).catch(() => {});
            });
            tab.addEventListener('keydown', event => {
                let next = -1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = (index + 1) % MODES.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = MODES.length - 1;
                if (next < 0) return;
                event.preventDefault();
                tabButtons[next].focus();
                tabButtons[next].click();
            });
            tabs.append(tab);
            return tab;
        });
        for (const mode of MODES) {
            const pane = node('div', 'fpt-qr-pane');
            pane.id = `fpt-qr-${mode}-pane`;
            pane.dataset.quickRepliesPane = mode;
            pane.setAttribute('role', 'tabpanel');
            pane.setAttribute('aria-labelledby', mode === 'templates' ? 'fptQuickRepliesTemplatesTab' : 'fptQuickRepliesCommandsTab');
            panes[mode] = pane;
        }
        screen.append(hero, banner, tabs, panes.templates, panes.commands);

        function setMode(mode) {
            if (!MODES.includes(mode)) return false;
            state.mode = mode;
            page.dataset.fptPageMode = mode;
            tabs.style.setProperty('--qr-tab-index', String(MODES.indexOf(mode)));
            tabButtons.forEach(tab => {
                const selected = tab.dataset.mode === mode;
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            for (const key of MODES) panes[key].hidden = key !== mode;
            return true;
        }
        const handler = {
            defaultMode: 'templates', modes: MODES.slice(),
            getMode() { return state.mode; },
            select(mode) { return setMode(mode); }
        };
        if (typeof root.fptRegisterPopupPageModeHandler === 'function') root.fptRegisterPopupPageModeHandler(PAGE_ID, handler, popup);
        else { popup._fptPageModeHandlers ||= Object.create(null); popup._fptPageModeHandlers[PAGE_ID] = handler; }
        // A generic mode handler registered later only writes the attribute; keep the tabs in step with it.
        const modeObserver = new MutationObserver(() => {
            const mode = page.dataset.fptPageMode;
            if (mode && mode !== state.mode) setMode(mode);
        });
        modeObserver.observe(page, { attributes: true, attributeFilter: ['data-fpt-page-mode'] });
        setMode(MODES.includes(page.dataset.fptPageMode) ? page.dataset.fptPageMode : 'templates');

        // --- Settings cards ------------------------------------------------------------------------
        function settingsCard(kind, iconName, title, description) {
            const card = node('section', `fpt-qr-card fpt-qr-card--${kind}`);
            card.setAttribute('aria-labelledby', `fpt-qr-${kind}-settings-title`);
            const head = node('div', 'fpt-qr-card-head');
            const emblem = node('span', 'fpt-qr-emblem');
            emblem.append(icon(iconName));
            const copy = node('div', 'fpt-qr-card-copy');
            const heading = node('h3', '', title);
            heading.id = `fpt-qr-${kind}-settings-title`;
            copy.append(heading, node('p', '', description));
            head.append(emblem, copy);
            const grid = node('div', 'fpt-qr-settings');
            card.append(head, grid);
            return { card, grid };
        }
        async function saveSetting(key, patch, control, rollback) {
            state.busy.add(control);
            control.disabled = true;
            try {
                await run('saveSettings', { settings: { [key]: patch } });
                if (key === TEMPLATE_KEY && Object.hasOwn(patch, 'enabled') && typeof root.addChatTemplateButtons === 'function') {
                    try { await root.addChatTemplateButtons(); } catch (_) {}
                }
                await refresh();
                ui.showToast?.(popup, 'Настройка сохранена', 'success');
            } catch (error) {
                rollback();
                ui.showToast?.(popup, error.message || 'Не удалось сохранить настройку.', 'error');
            } finally {
                state.busy.delete(control);
                control.disabled = !state.loaded;
            }
        }
        function bindSwitch(toggle, key, field, source) {
            toggle.input.addEventListener('change', () => {
                const value = toggle.input.checked;
                const previous = source()[field];
                source()[field] = value;
                renderSummary();
                saveSetting(key, { [field]: value }, toggle.input, () => {
                    source()[field] = previous;
                    toggle.input.checked = previous;
                    renderAll();
                });
            });
        }

        const tplSettings = settingsCard('templates', 'chat_paste_go', 'Шаблоны в чате', 'Кнопка с шаблонами появляется слева от скрепки в каждом диалоге.');
        const tplEnabled = makeSwitch('Включить шаблоны');
        const tplImmediate = makeSwitch('Отправлять сразу по клику');
        tplSettings.grid.append(
            settingRow('Включить шаблоны', 'Показывать кнопку шаблонов рядом со скрепкой.', tplEnabled.element),
            settingRow('Отправлять сразу по клику', 'Иначе текст только подставится в поле ввода, и его можно поправить.', tplImmediate.element));
        bindSwitch(tplEnabled, TEMPLATE_KEY, 'enabled', () => state.templates);
        bindSwitch(tplImmediate, TEMPLATE_KEY, 'sendTemplatesImmediately', () => state.templates);

        const cmdSettings = settingsCard('commands', 'keyboard_command_key', 'Слэш-команды', 'Напечатайте «/» и триггер — команда развернётся в готовый ответ.');
        const cmdEnabled = makeSwitch('Включить слэш-команды');
        const cmdAutocomplete = makeSwitch('Подсказка при вводе');
        const expandKey = segmented('Чем разворачивать команду', EXPAND_KEYS, value => {
            const previous = state.commands.expandKey;
            state.commands.expandKey = value;
            const control = { set disabled(v) { expandKey.setDisabled(v); } };
            saveSetting(COMMAND_KEY, { expandKey: value }, control, () => {
                state.commands.expandKey = previous;
                expandKey.setValue(previous);
            });
        });
        const expandRow = settingRow('Чем разворачивать', 'Клавиша, которая превращает триггер в текст ответа.', expandKey.element);
        expandRow.classList.add('fpt-qr-setting--wide');
        cmdSettings.grid.append(
            settingRow('Включить слэш-команды', 'Разворачивать триггеры в поле ввода чата.', cmdEnabled.element),
            settingRow('Подсказка при вводе', 'Показывать список подходящих команд после «/».', cmdAutocomplete.element),
            expandRow);
        bindSwitch(cmdEnabled, COMMAND_KEY, 'enabled', () => state.commands);
        bindSwitch(cmdAutocomplete, COMMAND_KEY, 'autocomplete', () => state.commands);

        // --- Lists ---------------------------------------------------------------------------------
        function listSection(kind, title, placeholder, addLabel) {
            const section = node('section', 'fpt-qr-list-section');
            section.setAttribute('aria-labelledby', `fpt-qr-${kind}-list-title`);
            const head = node('div', 'fpt-qr-list-head');
            const heading = node('h3', 'fpt-qr-list-title', title);
            heading.id = `fpt-qr-${kind}-list-title`;
            const count = node('span', 'fpt-qr-pill', '0');
            const search = node('input', 'fpt-qr-search fpt-control-field');
            search.type = 'search';
            search.placeholder = placeholder;
            search.setAttribute('aria-label', placeholder);
            search.hidden = true;
            head.append(heading, count, search);
            const note = node('p', 'fpt-qr-note');
            note.hidden = true;
            const list = node('div', 'fpt-qr-list');
            list.setAttribute('role', 'list');
            const add = button(addLabel, 'fpt-qr-add', 'add');
            section.append(head, note, list, add);
            return { section, count, search, note, list, add };
        }
        const tplList = listSection('templates', 'Мои шаблоны', 'Найти шаблон', 'Новый шаблон');
        tplList.note.append(icon('visibility_off'), node('span', '', 'Шаблоны выключены — кнопка у скрепки скрыта. Список можно редактировать.'));
        const cmdList = listSection('commands', 'Мои команды', 'Найти команду', 'Новая команда');
        cmdList.note.append(icon('keyboard_off'), node('span', '', 'Слэш-команды выключены — триггеры в чате не разворачиваются.'));
        tplList.search.addEventListener('input', () => { state.templateQuery = tplList.search.value; renderTemplates(); });
        cmdList.search.addEventListener('input', () => { state.commandQuery = cmdList.search.value; renderCommands(); });
        tplList.add.addEventListener('click', () => editTemplate(null));
        cmdList.add.addEventListener('click', () => editCommand(null));
        panes.templates.append(tplSettings.card, tplList.section);
        panes.commands.append(cmdSettings.card, cmdList.section);

        function keepFocus(list, renderRows) {
            const active = document.activeElement;
            const row = active?.closest?.('.fpt-qr-row');
            const focus = row && list.contains(row) ? { key: row.dataset.key, action: active.dataset.action } : null;
            renderRows();
            if (!focus) return;
            const target = Array.from(list.querySelectorAll('.fpt-qr-row')).find(item => item.dataset.key === focus.key)
                ?.querySelector(`[data-action="${focus.action}"]`);
            target?.focus({ preventScroll: true });
        }
        function renderTemplates() {
            const all = state.templates.items;
            tplList.count.textContent = String(all.length);
            tplList.search.hidden = all.length <= SEARCH_THRESHOLD && !state.templateQuery;
            tplList.note.hidden = !state.loaded || state.templates.enabled;
            tplList.section.dataset.state = state.templates.enabled ? 'on' : 'off';
            tplList.add.disabled = !state.loaded;
            keepFocus(tplList.list, () => {
                tplList.list.replaceChildren();
                if (!state.loaded) {
                    tplList.list.append(emptyState(state.loadError ? 'cloud_off' : 'progress_activity',
                        state.loadError ? 'Шаблоны не загружены' : 'Загрузка…', state.loadError ? 'Нажмите «Повторить» выше.' : 'Читаем сохранённые шаблоны.'));
                    return;
                }
                const items = all.filter(item => filterBy(state.templateQuery, [item.label, item.text]));
                if (!items.length) {
                    tplList.list.append(emptyState('search_off', 'Ничего не найдено', 'Попробуйте другое слово или очистите поиск.'));
                    return;
                }
                items.forEach(item => tplList.list.append(templateRow(item)));
            });
        }
        function templateRow(item) {
            const row = node('article', 'fpt-qr-row fpt-qr-row--template');
            row.setAttribute('role', 'listitem');
            row.dataset.key = item.key;
            row.dataset.state = item.enabled ? 'on' : 'off';
            const toggle = makeSwitch(`Показывать шаблон «${item.label}»`);
            toggle.input.checked = item.enabled;
            toggle.input.dataset.action = 'toggle';
            toggle.input.disabled = !state.loaded;
            toggle.input.addEventListener('change', () => toggleTemplate(item, toggle.input));
            const main = node('button', 'fpt-qr-row-main');
            main.type = 'button';
            main.dataset.action = 'open';
            main.setAttribute('aria-label', `Редактировать шаблон «${item.label}»`);
            const titleRow = node('span', 'fpt-qr-row-title');
            titleRow.append(node('span', 'fpt-qr-row-name', item.label));
            if (!item.custom) titleRow.append(node('span', 'fpt-qr-badge fpt-qr-badge--muted', 'Стандартный'));
            if (item.images.length) {
                const badge = node('span', 'fpt-qr-badge');
                badge.append(icon('attach_file'), node('span', '', String(item.images.length)));
                badge.title = `Изображений: ${item.images.length}`;
                titleRow.append(badge);
            }
            const preview = node('span', 'fpt-qr-row-preview', previewText(item.text) || 'Только изображения');
            if (!item.text.trim()) preview.dataset.empty = 'true';
            main.append(titleRow, preview);
            const actions = node('div', 'fpt-qr-row-actions');
            const edit = iconButton('Редактировать', 'edit');
            edit.dataset.action = 'edit';
            edit.addEventListener('click', () => editTemplate(item));
            main.addEventListener('click', () => editTemplate(item));
            actions.append(edit);
            if (item.custom) {
                const remove = iconButton('Удалить', 'delete', 'fpt-qr-icon-button--danger');
                remove.dataset.action = 'remove';
                remove.addEventListener('click', () => confirmAction({
                    title: 'Удалить шаблон?', description: `Шаблон «${item.label}» исчезнет из чата. Это действие нельзя отменить.`,
                    confirmLabel: 'Удалить', danger: true,
                    action: () => run('saveTemplate', { key: item.key, custom: true, remove: true }), success: 'Шаблон удалён'
                }));
                actions.append(remove);
            } else if (item.modified) {
                const reset = iconButton('Сбросить к исходному', 'restart_alt');
                reset.dataset.action = 'reset';
                reset.addEventListener('click', () => {
                    const base = standardDefaults()[item.key];
                    confirmAction({
                        title: 'Сбросить шаблон?', description: `Название и текст «${item.label}» вернутся к стандартным, изображения будут откреплены.`,
                        confirmLabel: 'Сбросить',
                        action: () => run('saveTemplate', { key: item.key, custom: false,
                            settings: { label: base.label, text: base.text, images: [], sendOrder: 'text_first' } }),
                        success: 'Шаблон сброшен'
                    });
                });
                actions.append(reset);
            }
            [main, ...actions.children].forEach(control => { control.disabled = !state.loaded; });
            row.append(toggle.element, main, actions);
            return row;
        }
        async function toggleTemplate(item, input) {
            const value = input.checked;
            input.disabled = true;
            item.enabled = value;
            input.closest('.fpt-qr-row').dataset.state = value ? 'on' : 'off';
            renderSummary();
            try {
                await run('saveTemplate', { key: item.key, custom: item.custom, settings: { enabled: value } });
                await refresh();
            } catch (error) {
                item.enabled = !value;
                renderAll();
                ui.showToast?.(popup, error.message || 'Не удалось сохранить шаблон.', 'error');
            } finally { if (input.isConnected) input.disabled = !state.loaded; }
        }
        function renderCommands() {
            const all = state.commands.commands;
            cmdList.count.textContent = String(all.length);
            cmdList.search.hidden = all.length <= SEARCH_THRESHOLD && !state.commandQuery;
            cmdList.note.hidden = !state.loaded || state.commands.enabled;
            cmdList.section.dataset.state = state.commands.enabled ? 'on' : 'off';
            cmdList.add.disabled = !state.loaded;
            keepFocus(cmdList.list, () => {
                cmdList.list.replaceChildren();
                if (!all.length) {
                    cmdList.list.append(state.loaded
                        ? emptyState('terminal', 'Пока нет команд', 'Например, /привет → «Здравствуйте! Чем могу помочь?». Добавьте первую команду.')
                        : emptyState(state.loadError ? 'cloud_off' : 'progress_activity', state.loadError ? 'Команды не загружены' : 'Загрузка…',
                            state.loadError ? 'Нажмите «Повторить» выше.' : 'Читаем сохранённые команды.'));
                    return;
                }
                const items = all.map((command, index) => ({ command, index }))
                    .filter(({ command }) => filterBy(state.commandQuery, [command.trigger, command.response]));
                if (!items.length) {
                    cmdList.list.append(emptyState('search_off', 'Ничего не найдено', 'Попробуйте другое слово или очистите поиск.'));
                    return;
                }
                items.forEach(({ command, index }) => cmdList.list.append(commandRow(command, index)));
            });
        }
        function commandRow(command, index) {
            const row = node('article', 'fpt-qr-row fpt-qr-row--command');
            row.setAttribute('role', 'listitem');
            row.dataset.key = command.id || `index-${index}`;
            const main = node('button', 'fpt-qr-row-main');
            main.type = 'button';
            main.dataset.action = 'open';
            main.setAttribute('aria-label', `Редактировать команду ${command.trigger}`);
            const arrow = icon('arrow_right_alt');
            arrow.classList.add('fpt-qr-row-arrow');
            const preview = node('span', 'fpt-qr-row-preview', previewText(command.response, 'command') || 'Пустой ответ — отредактируйте');
            if (!command.response.trim()) preview.dataset.empty = 'true';
            main.append(node('code', 'fpt-qr-trigger', command.trigger || '/'), arrow, preview);
            main.addEventListener('click', () => editCommand(index));
            const actions = node('div', 'fpt-qr-row-actions');
            const edit = iconButton('Редактировать', 'edit');
            edit.dataset.action = 'edit';
            edit.addEventListener('click', () => editCommand(index));
            const remove = iconButton('Удалить', 'delete', 'fpt-qr-icon-button--danger');
            remove.dataset.action = 'remove';
            remove.addEventListener('click', () => confirmAction({
                title: 'Удалить команду?', description: `Команда ${command.trigger} перестанет разворачиваться в чате.`,
                confirmLabel: 'Удалить', danger: true,
                action: async () => run('saveSlashCommand', { id: await commandId(index), remove: true }), success: 'Команда удалена'
            }));
            [main, edit, remove].forEach(control => { control.disabled = !state.loaded; });
            actions.append(edit, remove);
            row.append(main, actions);
            return row;
        }
        // Commands stored without ids (older versions) get them before the first edit.
        async function commandId(index) {
            const id = state.commands.commands[index]?.id;
            if (id) return id;
            const stored = (await run('getSettings', { keys: [COMMAND_KEY] }))[COMMAND_KEY] || {};
            const list = Array.isArray(stored.commands) ? stored.commands : [];
            const used = new Set(list.map(command => command?.id).filter(Boolean).map(String));
            let next = Date.now();
            const commands = list.map(command => {
                if (!object(command) || command.id) return command;
                while (used.has(String(next))) next++;
                used.add(String(next));
                return { ...command, id: String(next) };
            });
            await run('saveSettings', { settings: { [COMMAND_KEY]: { commands } } });
            const repaired = normalizeCommands({ ...stored, commands });
            const target = repaired.commands[index];
            if (!target?.id) throw new Error('Команда не найдена.');
            return target.id;
        }
        function renderSummary() {
            const active = state.templates.items.filter(item => item.enabled).length;
            const on = state.loaded && (state.templates.enabled || state.commands.enabled);
            hero.dataset.state = on ? 'on' : 'off';
            if (!state.loaded) {
                heroPill.textContent = state.loadError ? 'Нет данных' : 'Загрузка…';
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                [metricTemplates, metricCommands, metricSend].forEach(item => { item.value.textContent = '—'; });
                return;
            }
            heroPill.textContent = on ? 'Работает' : 'Выключено';
            heroPill.dataset.kind = on ? 'success' : 'neutral';
            metricTemplates.value.textContent = state.templates.enabled
                ? `${active} из ${state.templates.items.length}` : 'Выключены';
            metricCommands.value.textContent = state.commands.enabled ? String(state.commands.commands.length) : 'Выключены';
            metricSend.value.textContent = state.templates.sendTemplatesImmediately ? 'Сразу' : 'В поле ввода';
            tabButtons[0]._count.textContent = String(active);
            tabButtons[1]._count.textContent = String(state.commands.commands.length);
        }
        function renderAll() {
            tplEnabled.input.checked = state.templates.enabled;
            tplImmediate.input.checked = state.templates.sendTemplatesImmediately;
            cmdEnabled.input.checked = state.commands.enabled;
            cmdAutocomplete.input.checked = state.commands.autocomplete;
            expandKey.setValue(state.commands.expandKey);
            for (const control of [tplEnabled.input, tplImmediate.input, cmdEnabled.input, cmdAutocomplete.input]) {
                if (!state.busy.has(control)) control.disabled = !state.loaded;
            }
            expandKey.setDisabled(!state.loaded);
            renderSummary();
            renderTemplates();
            renderCommands();
        }

        // --- Dialogs -------------------------------------------------------------------------------
        function openDialog(title, options) {
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, title, options);
            state.activeDialog = dialog;
            const closed = new MutationObserver(() => {
                if (dialog.backdrop.isConnected) return;
                closed.disconnect();
                if (state.activeDialog === dialog) state.activeDialog = null;
                if (state.pendingRender && !state.activeDialog) { state.pendingRender = false; renderAll(); }
            });
            closed.observe(popup, { childList: true });
            return dialog;
        }
        function confirmAction({ title, description, confirmLabel, danger, action, success }) {
            const dialog = openDialog(title, { description });
            const error = node('p', 'fpt-qr-error');
            error.setAttribute('role', 'alert');
            error.hidden = true;
            dialog.body.append(error);
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button(confirmLabel, danger ? 'fpt-qr-danger' : 'fpt-qr-primary');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    await action();
                    await refresh();
                    dialog.setBusy(false);
                    dialog.close();
                    ui.showToast?.(popup, success, 'success');
                } catch (failure) {
                    dialog.setBusy(false);
                    error.hidden = false;
                    error.textContent = failure.message || 'Не удалось выполнить действие.';
                }
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
            return dialog;
        }
        function editorLayout(dialog) {
            const editor = node('div', 'fpt-qr-editor');
            const grid = node('div', 'fpt-qr-editor-grid');
            const form = node('div', 'fpt-qr-editor-form');
            const aside = node('aside', 'fpt-qr-preview');
            aside.setAttribute('aria-label', 'Предпросмотр');
            const previewHead = node('div', 'fpt-qr-preview-head');
            previewHead.append(icon('visibility'), node('span', '', 'Так увидит покупатель'));
            const previewBody = node('div', 'fpt-qr-preview-body');
            previewBody.setAttribute('aria-live', 'polite');
            aside.append(previewHead, previewBody);
            grid.append(form, aside);
            editor.append(grid);
            dialog.body.append(editor);
            return { form, previewBody };
        }
        function textField(label, id, { multiline = false, placeholder = '', prefix = '' } = {}) {
            const wrap = node('div', 'fpt-qr-field');
            const caption = node('label', 'fpt-qr-label', label);
            caption.htmlFor = id;
            const input = node(multiline ? 'textarea' : 'input', `${multiline ? 'fpt-qr-textarea' : 'fpt-qr-input'} fpt-control-field`);
            input.id = id;
            input.placeholder = placeholder;
            if (multiline) input.rows = 6;
            else { input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; }
            const error = node('p', 'fpt-qr-error');
            error.id = `${id}-error`;
            error.hidden = true;
            if (prefix) {
                const box = node('div', 'fpt-qr-prefixed');
                box.append(node('span', 'fpt-qr-prefix', prefix), input);
                wrap.append(caption, box, error);
            } else wrap.append(caption, input, error);
            return {
                wrap, input,
                setError(message) {
                    error.hidden = !message;
                    error.textContent = message || '';
                    if (message) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); }
                    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
                }
            };
        }
        function editTemplate(item) {
            const draft = item
                ? { label: item.label, text: item.text, images: item.images.slice(), sendOrder: item.sendOrder }
                : { label: '', text: '', images: [], sendOrder: 'text_first' };
            const dialog = openDialog(item ? 'Редактировать шаблон' : 'Новый шаблон', { wide: true });
            const { form, previewBody } = editorLayout(dialog);
            const label = textField('Название', 'fpt-qr-label-input', { placeholder: 'Например, «Как получить товар»' });
            label.input.maxLength = 60;
            label.input.value = draft.label;
            const body = textField('Текст сообщения', 'fpt-qr-text-input', { multiline: true, placeholder: 'Напишите ответ покупателю…' });
            body.input.value = draft.text;
            const changed = () => { draft.label = label.input.value; draft.text = body.input.value; body.setError(''); renderPreview(); };
            label.input.addEventListener('input', () => { label.setError(''); changed(); });
            body.input.addEventListener('input', changed);
            const chips = variables(body.input, TEMPLATE_VARIABLES, changed);

            const attachments = node('div', 'fpt-qr-attachments');
            const attachRow = node('div', 'fpt-qr-attach-row');
            const attach = button('Прикрепить изображение', 'fpt-qr-ghost', 'add_photo_alternate');
            const file = node('input', '');
            file.type = 'file';
            file.hidden = true;
            file.accept = 'image/png,image/jpeg,image/gif,image/webp';
            const count = node('span', 'fpt-qr-muted');
            attachRow.append(attach, count, file);
            const thumbs = node('div', 'fpt-qr-thumbs');
            const imageError = node('p', 'fpt-qr-error');
            imageError.setAttribute('role', 'alert');
            imageError.hidden = true;
            const orderRow = node('div', 'fpt-qr-order');
            const orderLabel = node('span', 'fpt-qr-label', 'Порядок отправки');
            const sendOrder = segmented('Порядок отправки', [
                { value: 'text_first', label: 'Сначала текст', icon: 'notes' },
                { value: 'image_first', label: 'Сначала картинка', icon: 'image' }
            ], value => { draft.sendOrder = value; renderPreview(); });
            sendOrder.setValue(draft.sendOrder);
            orderRow.append(orderLabel, sendOrder.element);
            attachments.append(attachRow, thumbs, imageError, orderRow);
            attach.addEventListener('click', () => file.click());
            file.addEventListener('change', async () => {
                const selected = file.files[0];
                file.value = '';
                if (!selected) return;
                imageError.hidden = true;
                attach.disabled = true;
                try {
                    draft.images = await run('handleImageAddClick', { file: selected, images: draft.images });
                    body.setError('');
                } catch (failure) {
                    imageError.hidden = false;
                    imageError.textContent = failure.message || 'Не удалось прикрепить изображение.';
                } finally { renderImages(); }
            });
            const formError = node('p', 'fpt-qr-error');
            formError.setAttribute('role', 'alert');
            formError.hidden = true;
            form.append(label.wrap, body.wrap, chips, attachments, formError);

            function renderImages() {
                thumbs.replaceChildren();
                count.textContent = `${draft.images.length} / ${MAX_IMAGES}`;
                attach.disabled = draft.images.length >= MAX_IMAGES;
                thumbs.hidden = !draft.images.length;
                orderRow.hidden = !draft.images.length;
                draft.images.forEach((url, index) => {
                    const thumb = node('div', 'fpt-qr-thumb');
                    const img = node('img', '');
                    img.src = url;
                    img.alt = `Изображение ${index + 1}`;
                    const remove = iconButton(`Удалить изображение ${index + 1}`, 'close', 'fpt-qr-thumb-remove');
                    remove.addEventListener('click', () => {
                        draft.images.splice(index, 1);
                        renderImages();
                        (thumbs.querySelector('.fpt-qr-thumb-remove') || attach).focus({ preventScroll: true });
                    });
                    thumb.append(img, remove);
                    thumbs.append(thumb);
                });
                renderPreview();
            }
            function renderPreview() {
                const messages = [];
                const content = previewText(draft.text);
                if (content.trim() || !draft.images.length) messages.push(bubble(content, { empty: 'Текст сообщения появится здесь' }));
                if (draft.images.length) {
                    const gallery = node('div', 'fpt-qr-bubble fpt-qr-bubble--images');
                    draft.images.forEach((url, index) => {
                        const img = node('img', '');
                        img.src = url;
                        img.alt = `Изображение ${index + 1}`;
                        gallery.append(img);
                    });
                    if (draft.sendOrder === 'image_first') messages.unshift(gallery); else messages.push(gallery);
                }
                const name = node('div', 'fpt-qr-preview-label');
                name.append(icon('description'), node('span', '', draft.label.trim() || 'Без названия'));
                previewBody.replaceChildren(name, previewMessage(messages),
                    node('p', 'fpt-qr-preview-hint', 'Переменные показаны на примере. {ai:…} заполнит ИИ при отправке.'));
            }
            renderImages();

            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const save = button(item ? 'Сохранить' : 'Добавить шаблон', 'fpt-qr-primary', 'check');
            save.addEventListener('click', async () => {
                formError.hidden = true;
                const name = draft.label.trim();
                if (!name) { label.setError('Введите название шаблона.'); label.input.focus(); return; }
                if (!draft.text.trim() && !draft.images.length) { body.setError('Добавьте текст или изображение.'); body.input.focus(); return; }
                const settings = { label: name, text: draft.text, images: draft.images.slice(), sendOrder: draft.sendOrder };
                dialog.setBusy(true);
                try {
                    if (item) await run('saveTemplate', { key: item.key, custom: item.custom, settings });
                    else await run('addCustomTemplateBtn', settings);
                    await refresh();
                    dialog.setBusy(false);
                    dialog.close();
                    ui.showToast?.(popup, item ? 'Шаблон сохранён' : 'Шаблон добавлен', 'success');
                } catch (failure) {
                    dialog.setBusy(false);
                    formError.hidden = false;
                    formError.textContent = failure.message || 'Не удалось сохранить шаблон.';
                }
            });
            dialog.footer.append(cancel, save);
            dialog.focusInitial();
            return dialog;
        }
        function editCommand(index) {
            const original = index === null ? null : state.commands.commands[index];
            const draft = { trigger: original ? original.trigger.replace(/^\/+/, '') : '', response: original ? original.response : '' };
            const dialog = openDialog(original ? 'Редактировать команду' : 'Новая команда', { wide: true });
            const { form, previewBody } = editorLayout(dialog);
            const trigger = textField('Триггер', 'fpt-qr-trigger-input', { placeholder: 'привет', prefix: '/' });
            trigger.input.maxLength = 32;
            trigger.input.value = draft.trigger;
            const hint = node('p', 'fpt-qr-hint', 'Одно слово без пробелов. Регистр не важен.');
            trigger.wrap.append(hint);
            const response = textField('Текст ответа', 'fpt-qr-response-input', { multiline: true, placeholder: 'Что подставить вместо команды…' });
            response.input.value = draft.response;
            const changed = () => { draft.response = response.input.value; response.setError(''); renderPreview(); };
            trigger.input.addEventListener('input', () => {
                // Pasting "/привет" should not produce a double slash.
                if (trigger.input.value.startsWith('/')) trigger.input.value = trigger.input.value.replace(/^\/+/, '');
                draft.trigger = trigger.input.value;
                const check = validateCommand(draft.trigger, state.commands.commands, original?.id ?? null);
                trigger.setError(draft.trigger && check.error ? check.error : '');
                renderPreview();
            });
            response.input.addEventListener('input', changed);
            const formError = node('p', 'fpt-qr-error');
            formError.setAttribute('role', 'alert');
            formError.hidden = true;
            form.append(trigger.wrap, response.wrap, variables(response.input, COMMAND_VARIABLES, changed), formError);
            function renderPreview() {
                const typed = node('div', 'fpt-qr-typed');
                const keyName = state.commands.expandKey === 'enter' ? 'Enter' : 'Tab';
                typed.append(node('code', 'fpt-qr-trigger', `/${draft.trigger || 'команда'}`), node('kbd', 'fpt-qr-kbd', keyName));
                const arrow = node('div', 'fpt-qr-preview-arrow');
                arrow.append(icon('south'));
                previewBody.replaceChildren(typed, arrow,
                    previewMessage([bubble(previewText(draft.response, 'command'), { empty: 'Текст ответа появится здесь' })]),
                    node('p', 'fpt-qr-preview-hint', 'Команда развернётся в поле ввода — сообщение можно поправить перед отправкой.'));
            }
            renderPreview();

            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const save = button(original ? 'Сохранить' : 'Добавить команду', 'fpt-qr-primary', 'check');
            save.addEventListener('click', async () => {
                formError.hidden = true;
                const check = validateCommand(draft.trigger, state.commands.commands, original?.id ?? null);
                if (check.error) { trigger.setError(check.error); trigger.input.focus(); return; }
                if (!draft.response.trim()) { response.setError('Введите текст ответа.'); response.input.focus(); return; }
                if (original && state.commands.commands[index] !== original) {
                    formError.hidden = false;
                    formError.textContent = 'Команда изменилась в другом окне. Закройте редактор и откройте его снова.';
                    return;
                }
                dialog.setBusy(true);
                try {
                    if (original) {
                        const id = await commandId(index);
                        await run('saveSlashCommand', { id, settings: { trigger: check.trigger, response: draft.response } });
                    } else await run('fptSlashAddBtn', { trigger: check.trigger, response: draft.response });
                    await refresh();
                    dialog.setBusy(false);
                    dialog.close();
                    ui.showToast?.(popup, original ? 'Команда сохранена' : 'Команда добавлена', 'success');
                } catch (failure) {
                    dialog.setBusy(false);
                    formError.hidden = false;
                    formError.textContent = failure.message || 'Не удалось сохранить команду.';
                }
            });
            dialog.footer.append(cancel, save);
            dialog.focusInitial();
            return dialog;
        }

        // --- Storage -------------------------------------------------------------------------------
        function apply(stored) {
            if (Object.hasOwn(stored, TEMPLATE_KEY)) state.templates = normalizeTemplates(stored[TEMPLATE_KEY]);
            if (Object.hasOwn(stored, COMMAND_KEY)) state.commands = normalizeCommands(stored[COMMAND_KEY]);
            // Lists stay put under an open editor so its row indexes keep pointing at the same items.
            if (state.activeDialog) state.pendingRender = true;
            else renderAll();
        }
        async function refresh() {
            const stored = await run('getSettings', { keys: [TEMPLATE_KEY, COMMAND_KEY] });
            apply({ [TEMPLATE_KEY]: stored?.[TEMPLATE_KEY], [COMMAND_KEY]: stored?.[COMMAND_KEY] });
        }
        async function load() {
            retry.disabled = true;
            try {
                await refresh();
                state.loaded = true;
                state.loadError = '';
                banner.hidden = true;
            } catch (error) {
                state.loadError = error.message || 'Не удалось загрузить быстрые ответы.';
                bannerText.textContent = state.loadError;
                banner.hidden = false;
            } finally {
                retry.disabled = false;
                if (state.activeDialog) state.pendingRender = true; else renderAll();
            }
        }
        const onStorage = (changes, area) => {
            if (!page.isConnected) { dispose(); return; }
            if (area !== 'local' || !state.loaded) return;
            const next = {};
            if (changes[TEMPLATE_KEY]) next[TEMPLATE_KEY] = changes[TEMPLATE_KEY].newValue;
            if (changes[COMMAND_KEY]) next[COMMAND_KEY] = changes[COMMAND_KEY].newValue;
            if (Object.keys(next).length) apply(next);
        };
        function dispose() {
            document.removeEventListener('pointerdown', onHelpOutside);
            root.chrome?.storage?.onChanged?.removeListener(onStorage);
            state.activeDialog?.close({ force: true });
            modeObserver.disconnect();
            disposal.disconnect();
        }
        root.chrome?.storage?.onChanged?.addListener(onStorage);
        const disposal = new MutationObserver(() => { if (!page.isConnected) dispose(); });
        disposal.observe(document.body, { childList: true, subtree: true });
        renderAll();
        const loading = load();
        page._fptQuickRepliesMount = loading;
        return loading;
    }

    root.FPTQuickRepliesPage = Object.freeze({ mount, normalizeTemplates, normalizeCommands, previewText, validateCommand });
})(window);
