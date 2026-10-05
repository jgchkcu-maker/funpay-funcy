// Autoresponder screen: status summary, three scenario cards and keyword rules.
(function (root) {
    'use strict';

    const PAGE_ID = 'auto_reply';
    const STORE_KEY = 'fpToolsAutoReplies';
    const MAX_IMAGES = 5;
    const MAX_COOLDOWN_DAYS = 365;
    const ORDER_TEXT_FIRST = 'text_first';
    const ORDER_IMAGE_FIRST = 'image_first';
    const STALE_CODE = 'STALE_AUTO_REPLY_EDIT';
    const KEYWORD_SEARCH_THRESHOLD = 5;

    const DEFAULTS = Object.freeze({
        greetingEnabled: false,
        greetingText: 'Здравствуйте! Чем могу помочь?',
        greetingImages: [],
        greetingSendOrder: ORDER_TEXT_FIRST,
        onlyNewChats: false,
        ignoreSystemMessages: false,
        greetingCooldownDays: 0,
        newOrderReplyEnabled: false,
        newOrderReplyText: '',
        newOrderReplyImages: [],
        newOrderReplySendOrder: ORDER_TEXT_FIRST,
        orderConfirmReplyEnabled: false,
        orderConfirmReplyText: '',
        orderConfirmReplyImages: [],
        orderConfirmReplySendOrder: ORDER_TEXT_FIRST,
        keywordsEnabled: false,
        keywords: []
    });

    // Variables the background engine really fills in for each scenario (applyVariables callers).
    const SCENARIOS = Object.freeze([
        {
            id: 'greeting',
            iconName: 'waving_hand',
            title: 'Приветствие новых покупателей',
            description: 'Отправляется при первом подходящем сообщении покупателя.',
            label: 'Текст приветствия',
            placeholder: 'Здравствуйте, {buyername}! Чем могу помочь?',
            keys: { enabled: 'greetingEnabled', text: 'greetingText', images: 'greetingImages', order: 'greetingSendOrder' },
            variables: ['{buyername}', '{welcome}', '{date}'],
            emptyHint: 'Введите текст приветствия, иначе сообщение не отправится.'
        },
        {
            id: 'newOrder',
            iconName: 'shopping_bag',
            title: 'Ответ на новый заказ',
            description: 'Сообщение покупателю сразу после оплаты нового заказа.',
            label: 'Сообщение покупателю',
            placeholder: 'Спасибо за заказ, {buyername}! Ваш заказ: {orderlink}',
            keys: { enabled: 'newOrderReplyEnabled', text: 'newOrderReplyText', images: 'newOrderReplyImages', order: 'newOrderReplySendOrder' },
            variables: ['{buyername}', '{orderid}', '{orderlink}', '{welcome}', '{date}'],
            emptyHint: 'Введите текст ответа, иначе сообщение не отправится.'
        },
        {
            id: 'orderConfirm',
            iconName: 'task_alt',
            title: 'Ответ при подтверждении заказа',
            description: 'Сообщение после того, как покупатель подтвердил выполнение заказа.',
            label: 'Сообщение покупателю',
            placeholder: '{buyername}, спасибо, что подтвердили заказ {orderid}!',
            keys: { enabled: 'orderConfirmReplyEnabled', text: 'orderConfirmReplyText', images: 'orderConfirmReplyImages', order: 'orderConfirmReplySendOrder' },
            variables: ['{buyername}', '{orderid}', '{orderlink}', '{welcome}', '{date}'],
            emptyHint: 'Введите текст ответа, иначе сообщение не отправится.'
        }
    ]);
    const KEYWORD_VARIABLES = Object.freeze(['{buyername}', '{welcome}', '{date}']);
    const VARIABLE_HINTS = Object.freeze({
        '{buyername}': 'Имя покупателя',
        '{orderid}': 'Номер заказа',
        '{orderlink}': 'Ссылка на заказ',
        '{welcome}': 'Приветствие',
        '{date}': 'Дата и время'
    });
    const MATCH_MODES = Object.freeze([
        { value: 'exact', label: 'Точное', icon: 'rule' },
        { value: 'contains', label: 'Содержит', icon: 'search' }
    ]);
    const SEND_ORDERS = Object.freeze([
        { value: ORDER_TEXT_FIRST, label: 'Сначала текст', icon: 'chat_bubble' },
        { value: ORDER_IMAGE_FIRST, label: 'Сначала картинка', icon: 'image' }
    ]);

    // --- Pure helpers (no DOM; covered by tests) -------------------------------------------------

    const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const cleanImages = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string' && item) : []);
    const cleanOrder = value => (value === ORDER_IMAGE_FIRST ? ORDER_IMAGE_FIRST : ORDER_TEXT_FIRST);

    function cleanDays(value) {
        const number = Math.floor(Number(value));
        if (!Number.isFinite(number) || number < 0) return 0;
        return Math.min(number, MAX_COOLDOWN_DAYS);
    }

    function normalizeSettings(saved) {
        const source = isRecord(saved) ? saved : {};
        const result = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS)) {
            if (source[key] === undefined || source[key] === null) continue;
            const base = DEFAULTS[key];
            if (typeof base === 'boolean') result[key] = source[key] === true;
            else if (typeof base === 'string') result[key] = typeof source[key] === 'string' ? source[key] : base;
            else if (typeof base === 'number') result[key] = cleanDays(source[key]);
        }
        for (const scenario of SCENARIOS) {
            result[scenario.keys.images] = cleanImages(source[scenario.keys.images]);
            result[scenario.keys.order] = cleanOrder(source[scenario.keys.order]);
        }
        // Indexes must match the stored list, so malformed entries are kept in place and skipped when drawing.
        result.keywords = Array.isArray(source.keywords) ? source.keywords : [];
        return result;
    }

    function countActiveScenarios(settings) {
        const flags = [...SCENARIOS.map(scenario => scenario.keys.enabled), 'keywordsEnabled'];
        return flags.filter(key => settings[key] === true).length;
    }

    function ruleCount(settings) {
        return settings.keywords.filter(isRecord).length;
    }

    function cooldownText(days) {
        const value = cleanDays(days);
        if (!value) return 'Один раз на чат';
        return `Через ${value} ${root.FPTPopupUI.pluralize(value, ['день', 'дня', 'дней'])}`;
    }

    // A rule as the background engine expects it. Unknown fields of an edited rule are preserved.
    function buildKeywordRule(input, original) {
        const keyword = String(input?.keyword ?? '').trim();
        const response = String(input?.response ?? '').trim();
        const images = cleanImages(input?.images);
        if (!keyword) throw new Error('Укажите ключевое слово или фразу.');
        if (!response && !images.length) throw new Error('Добавьте текст ответа или изображение.');
        const rule = { ...(isRecord(original) ? original : {}), keyword, response,
            matchMode: input?.matchMode === 'contains' ? 'contains' : 'exact' };
        if (images.length) {
            rule.images = images;
            rule.sendOrder = cleanOrder(input?.sendOrder);
        } else {
            delete rule.images;
            delete rule.sendOrder;
        }
        return rule;
    }

    function normalizePhrase(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    const modeOf = rule => (rule && rule.matchMode === 'contains' ? 'contains' : 'exact');

    function findDuplicateRule(keywords, candidate, skipIndex) {
        const phrase = normalizePhrase(candidate.keyword);
        if (!phrase) return -1;
        return keywords.findIndex((rule, index) => index !== skipIndex
            && isRecord(rule)
            && normalizePhrase(rule.keyword) === phrase
            && modeOf(rule) === modeOf(candidate));
    }

    function filterKeywords(keywords, query) {
        const needle = normalizePhrase(query);
        return keywords.map((rule, index) => ({ rule, index }))
            .filter(({ rule }) => isRecord(rule) && (!needle
                || normalizePhrase(rule.keyword).includes(needle)
                || normalizePhrase(rule.response).includes(needle)));
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
        button.appendChild(node('span', 'fpt-ar-button-label', label));
        return button;
    }

    function setButtonLabel(button, label, iconName) {
        const labelNode = button.querySelector('.fpt-ar-button-label');
        if (labelNode) labelNode.textContent = label;
        const iconNode = button.querySelector('.material-symbols-rounded');
        if (iconNode && iconName) iconNode.textContent = iconName;
    }

    function setStatus(element, text, kind) {
        element.replaceChildren();
        delete element.dataset.kind;
        if (!text) return;
        if (['success', 'error', 'warning'].includes(kind) && element.closest('.fp-tools-popup')) {
            root.FPTPopupUI.showToast(element.closest('.fp-tools-popup'), text, kind);
            return;
        }
        if (kind) element.dataset.kind = kind;
        const statusIcons = { success: 'check_circle', warning: 'warning', error: 'error', loading: 'progress_activity' };
        if (statusIcons[kind]) element.appendChild(icon(statusIcons[kind]));
        element.appendChild(node('span', 'fpt-ad-status-text', text));
    }

    function makeSwitch(id, labelText, checked) {
        const label = node('label', 'fpt-ad-switch-control');
        const input = node('input', 'fpt-ad-switch fpt-ad-global-switch');
        input.type = 'checkbox';
        input.id = id;
        input.checked = !!checked;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', labelText);
        label.append(input, node('span', 'fpt-ad-switch-track'));

        const line = node('div', 'fpt-ad-switch-line');
        const stateLabel = node('span', 'fpt-ad-switch-state', checked ? 'Вкл' : 'Выкл');
        input.addEventListener('change', () => { stateLabel.textContent = input.checked ? 'Вкл' : 'Выкл'; });
        line.append(label, stateLabel);
        return {
            element: line,
            input,
            setChecked(value) {
                input.checked = !!value;
                stateLabel.textContent = input.checked ? 'Вкл' : 'Выкл';
            }
        };
    }

    function createListState(kind, title, description, action) {
        const state = node('div', `fpt-ad-list-state fpt-ad-list-state--${kind}`);
        state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        const iconName = kind === 'loading' ? 'progress_activity' : kind === 'error' ? 'error' : 'inbox';
        state.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ad-list-state-copy');
        copy.append(node('strong', '', title), node('span', '', description));
        state.appendChild(copy);
        if (action) state.appendChild(action);
        return state;
    }

    function createSegmented(label, options, onChange) {
        const element = node('div', 'fpt-ar-seg');
        element.setAttribute('role', 'radiogroup');
        element.setAttribute('aria-label', label);
        element.appendChild(node('span', 'fpt-ar-seg-pill'));
        let value = options[0].value;
        const buttons = options.map((option, index) => {
            const button = createButton('fpt-ar-seg-button', option.icon, option.label);
            button.setAttribute('role', 'radio');
            button.dataset.value = option.value;
            button.addEventListener('click', () => select(index, true));
            button.addEventListener('keydown', event => {
                let next = -1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
                if (next < 0) return;
                event.preventDefault();
                buttons[next].focus();
                select(next, true);
            });
            element.appendChild(button);
            return button;
        });
        function select(index, notify) {
            value = options[index].value;
            element.dataset.index = String(index);
            buttons.forEach((button, buttonIndex) => {
                button.setAttribute('aria-checked', buttonIndex === index ? 'true' : 'false');
                button.tabIndex = buttonIndex === index ? 0 : -1;
            });
            if (notify) onChange(value);
        }
        select(0, false);
        return {
            element,
            get value() { return value; },
            setValue(next) {
                const index = options.findIndex(option => option.value === next);
                select(index < 0 ? 0 : index, false);
            }
        };
    }

    function createVariableChips(textarea, tokens) {
        const wrap = node('div', 'fpt-ad-variable-chips fpt-ar-chips');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', 'Переменные: нажмите, чтобы вставить в текст');
        tokens.forEach(token => {
            const chip = node('button', 'fpt-ad-variable-chip', VARIABLE_HINTS[token] || token);
            chip.type = 'button';
            chip.dataset.templateToken = token;
            chip.title = token;
            chip.addEventListener('click', () => {
                const start = textarea.selectionStart ?? textarea.value.length;
                const end = textarea.selectionEnd ?? start;
                textarea.setRangeText(token, start, end, 'end');
                textarea.focus();
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            wrap.appendChild(chip);
        });
        return wrap;
    }

    // Reply editor shared by the scenario cards and the keyword dialog: text, variables, images, order.
    function createReplyEditor({ idPrefix, label, placeholder, variables, run, onChange }) {
        const element = node('div', 'fpt-ar-editor');
        const textLabel = node('label', 'fpt-ad-field-label fpt-ar-field-label', label);
        const textarea = node('textarea', 'fpt-ar-textarea');
        textarea.id = `${idPrefix}-text`;
        textLabel.htmlFor = textarea.id;
        textarea.rows = 4;
        textarea.placeholder = placeholder;
        textarea.spellcheck = true;
        const error = node('p', 'fpt-ar-field-error');
        error.id = `${idPrefix}-error`;
        error.setAttribute('role', 'alert');
        error.hidden = true;
        textarea.setAttribute('aria-describedby', error.id);
        const meta = node('div', 'fpt-ar-editor-meta');
        const hint = node('p', 'fpt-ad-template-help fpt-ar-chips-hint', 'Нажмите на переменную, чтобы вставить её в текст.');
        const count = node('span', 'fpt-ad-template-count fpt-ar-count');
        count.setAttribute('aria-live', 'polite');
        meta.append(hint, count);
        const chips = createVariableChips(textarea, variables);

        const images = node('div', 'fpt-ar-images');
        const thumbs = node('ul', 'fpt-ar-thumbs');
        thumbs.setAttribute('aria-label', 'Прикреплённые изображения');
        const file = node('input', 'fpt-ar-file');
        file.type = 'file';
        file.accept = 'image/png,image/jpeg,image/gif,image/webp';
        file.hidden = true;
        file.id = `${idPrefix}-file`;
        file.setAttribute('aria-label', 'Выбрать изображение');
        const attach = createButton('fpt-ab-ghost-button fpt-ar-attach', 'add_photo_alternate', 'Прикрепить изображение');
        const attachNote = node('span', 'fpt-ar-attach-note', `PNG, JPEG, GIF или WebP до 1 МБ, не больше ${MAX_IMAGES} шт.`);
        const imageStatus = node('p', 'fpt-ad-rules-status fpt-ar-image-status');
        imageStatus.setAttribute('aria-live', 'polite');
        const attachRow = node('div', 'fpt-ar-attach-row');
        attachRow.append(attach, attachNote);
        const order = createSegmented('Порядок отправки', SEND_ORDERS, () => onChange());
        const orderRow = node('div', 'fpt-ar-order-row');
        orderRow.append(node('span', 'fpt-ad-field-label', 'Порядок отправки'), order.element);
        images.append(thumbs, attachRow, file, imageStatus, orderRow);

        element.append(textLabel, textarea, error, meta, chips, images);

        let attached = [];

        function refreshCount() {
            const length = textarea.value.length;
            count.textContent = `${length} ${root.FPTPopupUI.pluralize(length, ['символ', 'символа', 'символов'])}`;
        }

        // Send order only matters when there is both text and at least one picture.
        function syncOrderRow() {
            orderRow.hidden = !(attached.length && textarea.value.trim());
        }

        function renderImages() {
            thumbs.replaceChildren();
            thumbs.hidden = !attached.length;
            attached.forEach((source, index) => {
                const item = node('li', 'fpt-ar-thumb');
                const picture = node('img', 'fpt-ar-thumb-image');
                picture.alt = `Изображение ${index + 1}`;
                picture.src = source;
                const remove = node('button', 'fpt-ar-thumb-remove');
                remove.type = 'button';
                remove.setAttribute('aria-label', `Убрать изображение ${index + 1}`);
                remove.title = 'Убрать изображение';
                remove.appendChild(icon('close'));
                remove.addEventListener('click', () => {
                    attached = attached.filter((_, position) => position !== index);
                    renderImages();
                    onChange();
                });
                item.append(picture, remove);
                thumbs.appendChild(item);
            });
            attach.disabled = attached.length >= MAX_IMAGES;
            syncOrderRow();
            if (!attached.length) setStatus(imageStatus, '');
        }

        attach.addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
            const chosen = file.files && file.files[0];
            file.value = '';
            if (!chosen) return;
            if (attached.length >= MAX_IMAGES) {
                setStatus(imageStatus, `Можно прикрепить не больше ${MAX_IMAGES} изображений.`, 'warning');
                return;
            }
            attach.disabled = true;
            setStatus(imageStatus, 'Загружаем изображение…', 'loading');
            try {
                attached = cleanImages(await run('handleImageAddClick', { file: chosen, images: attached }));
                setStatus(imageStatus, '');
                renderImages();
                onChange();
            } catch (failure) {
                setStatus(imageStatus, failure.message || 'Не удалось добавить изображение.', 'error');
                renderImages();
            }
        });
        textarea.addEventListener('input', () => {
            refreshCount();
            syncOrderRow();
            onChange();
        });

        return {
            element,
            textarea,
            get text() { return textarea.value; },
            get images() { return attached.slice(); },
            get sendOrder() { return order.value; },
            set(values) {
                textarea.value = values.text ?? '';
                attached = cleanImages(values.images);
                order.setValue(values.sendOrder);
                refreshCount();
                renderImages();
            },
            setError(message) {
                error.hidden = !message;
                error.textContent = message || '';
                if (message) textarea.setAttribute('aria-invalid', 'true');
                else textarea.removeAttribute('aria-invalid');
            }
        };
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-ar-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по автоответчику');
        panel.appendChild(node('h2', '', 'Автоответчик'));
        const list = node('ul');
        [
            'Каждый сценарий включается отдельно. Выключенный сценарий ничего не отправляет.',
            'Приветствие уходит на первое подходящее сообщение покупателя, повтор — по настройке.',
            'Ответы на заказы отправляются один раз на каждый заказ.',
            'Правила по ключевым словам проверяются сверху вниз: сработает первое подходящее. «Точное» — сообщение целиком совпадает с фразой, «Содержит» — фраза есть в тексте.',
            'Покупателям из чёрного списка с запретом ответов автоответчик не пишет.',
            'Если выключить все сценарии, при следующем включении автоответчик пропустит сообщения в уже существующих чатах.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    function createMetric(iconName, label) {
        const metric = node('div', 'fpt-ar-metric');
        const iconWrap = node('span', 'fpt-ar-metric-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ar-metric-copy');
        const value = node('strong', 'fpt-ar-metric-value', '—');
        copy.append(node('span', 'fpt-ar-metric-label', label), value);
        metric.append(iconWrap, copy);
        return { element: metric, value };
    }

    // --- Mount ---------------------------------------------------------------------------------

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptAutoReplyMounted === 'true') return;
        page.dataset.fptAutoReplyMounted = 'true';

        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const state = { settings: normalizeSettings(null), loaded: false, loadError: null, query: '' };

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Автоответчик', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-auto-reply');
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }

        // --- Hero --------------------------------------------------------------------------
        const hero = node('section', 'fpt-ar-hero');
        hero.setAttribute('aria-labelledby', 'fpt-ar-hero-title');
        const heroMain = node('div', 'fpt-ar-hero-main');
        const heroIcon = node('span', 'fpt-ar-hero-icon');
        heroIcon.appendChild(icon('mark_chat_unread'));
        const heroCopy = node('div', 'fpt-ar-hero-copy');
        const heroTitleRow = node('div', 'fpt-ar-hero-title-row');
        const heroTitle = node('h2', 'fpt-ar-hero-title', 'Ответы покупателям');
        heroTitle.id = 'fpt-ar-hero-title';
        const heroPill = node('span', 'fpt-ar-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        const heroDescription = node('p', 'fpt-ar-hero-description',
            'Расширение само отвечает в чатах FunPay: приветствует, подтверждает заказы и реагирует на ключевые слова.');
        heroCopy.append(heroTitleRow, heroDescription);
        heroMain.append(heroIcon, heroCopy);
        const metricActive = createMetric('bolt', 'Включено сценариев');
        const metricRules = createMetric('rule', 'Правил по словам');
        const metricGreeting = createMetric('waving_hand', 'Повторное приветствие');
        const metrics = node('div', 'fpt-ar-metrics');
        metrics.append(metricActive.element, metricRules.element, metricGreeting.element);
        hero.append(heroMain, metrics);

        // --- Scenario cards ------------------------------------------------------------------
        const scenariosSection = node('section', 'fpt-ar-section');
        scenariosSection.setAttribute('aria-labelledby', 'fpt-ar-scenarios-title');
        const scenariosTitle = node('h2', 'fpt-ad-section-title', 'Сценарии');
        scenariosTitle.id = 'fpt-ar-scenarios-title';
        scenariosSection.append(scenariosTitle,
            node('p', 'fpt-ad-section-description', 'Включите нужные сообщения и настройте текст. Выключенные сценарии остаются свёрнутыми.'));
        const cardList = node('div', 'fpt-ar-card-list');
        scenariosSection.appendChild(cardList);

        const cards = SCENARIOS.map(scenario => createScenarioCard(scenario));
        cards.forEach(card => cardList.appendChild(card.element));

        function createScenarioCard(scenario) {
            const keys = scenario.keys;
            const isGreeting = scenario.id === 'greeting';
            const element = node('article', 'fpt-ar-card');
            element.dataset.scenario = scenario.id;
            element.dataset.state = 'off';

            const head = node('div', 'fpt-ar-card-head');
            const iconWrap = node('span', 'fpt-ar-card-icon');
            iconWrap.appendChild(icon(scenario.iconName));
            const copy = node('div', 'fpt-ar-card-copy');
            copy.append(node('h3', '', scenario.title), node('p', '', scenario.description));
            const toggle = makeSwitch(`fpt-ar-${scenario.id}-enabled`, scenario.title, false);
            toggle.element.classList.add('fpt-ar-card-switch');
            head.append(iconWrap, copy, toggle.element);

            const collapse = node('div', 'fpt-ar-collapse');
            const collapseBody = node('div', 'fpt-ar-collapse-body');
            const body = node('div', 'fpt-ar-card-body');
            collapseBody.appendChild(body);
            collapse.appendChild(collapseBody);

            const editor = createReplyEditor({
                idPrefix: `fpt-ar-${scenario.id}`,
                label: scenario.label,
                placeholder: scenario.placeholder,
                variables: scenario.variables,
                run,
                onChange: () => syncDirty()
            });
            body.appendChild(editor.element);

            let sub = null;
            if (isGreeting) {
                sub = {
                    onlyNew: makeSubSwitch('onlyNewChats', 'Только совсем новые чаты',
                        'Не отправлять приветствие в уже существующем диалоге.'),
                    ignoreSystem: makeSubSwitch('ignoreSystemMessages', 'Игнорировать системные события',
                        'Не приветствовать из-за уведомлений о заказах и отзывах.')
                };
                const cooldownRow = node('div', 'fpt-ar-sub-row fpt-ar-cooldown-row');
                const cooldownCopy = node('label', 'fpt-ar-sub-copy');
                cooldownCopy.htmlFor = 'fpt-ar-greeting-cooldown';
                cooldownCopy.append(node('span', 'fpt-ar-sub-title', 'Повторное приветствие'),
                    node('span', 'fpt-ar-sub-hint', 'Через сколько дней можно поприветствовать покупателя снова. 0 — приветствовать один раз.'));
                const cooldownField = node('div', 'fpt-ar-number-field');
                const cooldown = node('input', 'fpt-ar-number');
                cooldown.type = 'number';
                cooldown.id = 'fpt-ar-greeting-cooldown';
                cooldown.min = '0';
                cooldown.max = String(MAX_COOLDOWN_DAYS);
                cooldown.step = '1';
                cooldown.inputMode = 'numeric';
                cooldown.addEventListener('input', () => syncDirty());
                cooldownField.append(cooldown, node('span', 'fpt-ar-number-unit', 'дн.'));
                cooldownRow.append(cooldownCopy, cooldownField);
                const subList = node('div', 'fpt-ar-sub-list');
                subList.append(sub.onlyNew.element, sub.ignoreSystem.element, cooldownRow);
                body.appendChild(subList);
                sub.cooldown = cooldown;
            }

            const footer = node('div', 'fpt-ar-card-footer');
            const unsaved = node('span', 'fpt-ad-unsaved-badge fpt-ar-unsaved', 'Не сохранено');
            unsaved.hidden = true;
            const status = node('p', 'fpt-ad-rules-status fpt-ar-status');
            status.setAttribute('aria-live', 'polite');
            const revert = createButton('fpt-ab-ghost-button fpt-ar-revert', 'undo', 'Отменить');
            const save = createButton('fpt-ar-save', 'check', 'Сохранить');
            footer.append(unsaved, status, revert, save);
            body.appendChild(footer);

            element.append(head, collapse);

            function makeSubSwitch(key, title, hint) {
                const row = node('div', 'fpt-ar-sub-row');
                const label = node('label', 'fpt-ar-sub-copy');
                const control = makeSwitch(`fpt-ar-${key}`, title, false);
                label.htmlFor = control.input.id;
                label.append(node('span', 'fpt-ar-sub-title', title), node('span', 'fpt-ar-sub-hint', hint));
                row.append(label, control.element);
                control.input.addEventListener('change', async () => {
                    const next = control.input.checked;
                    const previous = state.settings[key];
                    control.input.disabled = true;
                    try {
                        await commit({ set: { [key]: next } });
                        setStatus(status, next ? 'Настройка включена.' : 'Настройка выключена.', 'success');
                    } catch (failure) {
                        control.setChecked(previous);
                        reportFailure(failure, status);
                    } finally {
                        control.input.disabled = false;
                    }
                });
                return { element: row, input: control.input, setChecked: control.setChecked };
            }

            function savedValues() {
                const settings = state.settings;
                return {
                    text: settings[keys.text],
                    images: settings[keys.images],
                    sendOrder: settings[keys.order],
                    days: settings.greetingCooldownDays
                };
            }

            function draftDays() {
                return sub ? cleanDays(sub.cooldown.value) : 0;
            }

            function isDirty() {
                const saved = savedValues();
                if (editor.text !== saved.text) return true;
                if (editor.sendOrder !== saved.sendOrder && (editor.images.length || saved.images.length)) return true;
                if (editor.images.length !== saved.images.length
                    || editor.images.some((image, index) => image !== saved.images[index])) return true;
                return isGreeting && draftDays() !== saved.days;
            }

            function validate(showErrors) {
                const empty = !editor.text.trim();
                editor.setError(showErrors && empty ? scenario.emptyHint : '');
                return !empty;
            }

            function syncDirty() {
                const dirty = isDirty();
                unsaved.hidden = !dirty;
                revert.disabled = !dirty;
                save.disabled = !dirty;
                if (dirty && status.dataset.kind !== 'loading') setStatus(status, '');
                if (editor.text.trim()) editor.setError('');
            }

            function fill() {
                const saved = savedValues();
                editor.set({ text: saved.text, images: saved.images, sendOrder: saved.sendOrder });
                if (sub) {
                    sub.cooldown.value = String(saved.days);
                    sub.onlyNew.setChecked(state.settings.onlyNewChats);
                    sub.ignoreSystem.setChecked(state.settings.ignoreSystemMessages);
                }
                syncDirty();
            }

            // The first render after the data arrives fills the editor; later ones keep unsaved edits.
            let hydrated = false;
            function render() {
                const ready = state.loaded;
                const enabled = ready && state.settings[keys.enabled] === true;
                element.dataset.state = enabled ? 'on' : 'off';
                toggle.setChecked(enabled);
                toggle.input.disabled = !ready;
                collapse.inert = !enabled;
                if (!ready) return;
                if (!hydrated || !isDirty()) {
                    fill();
                    hydrated = true;
                } else if (sub) {
                    sub.onlyNew.setChecked(state.settings.onlyNewChats);
                    sub.ignoreSystem.setChecked(state.settings.ignoreSystemMessages);
                }
            }

            toggle.input.addEventListener('change', async () => {
                const next = toggle.input.checked;
                const previous = state.settings[keys.enabled];
                toggle.input.disabled = true;
                element.setAttribute('aria-busy', 'true');
                element.dataset.state = next ? 'on' : 'off';
                collapse.inert = !next;
                try {
                    await commit({ set: { [keys.enabled]: next } });
                    if (next && !state.settings[keys.text].trim()) {
                        setStatus(status, 'Добавьте текст — без него сообщение не отправится.', 'warning');
                        editor.textarea.focus({ preventScroll: false });
                    } else {
                        setStatus(status, next ? 'Сценарий включён.' : 'Сценарий выключен.', 'success');
                    }
                } catch (failure) {
                    toggle.setChecked(previous);
                    element.dataset.state = previous ? 'on' : 'off';
                    collapse.inert = !previous;
                    reportFailure(failure, status);
                } finally {
                    toggle.input.disabled = false;
                    element.removeAttribute('aria-busy');
                }
            });

            revert.addEventListener('click', () => {
                fill();
                editor.setError('');
                setStatus(status, '');
            });

            save.addEventListener('click', async () => {
                if (save.disabled) return;
                if (!validate(true)) {
                    editor.textarea.focus();
                    return;
                }
                const fields = {
                    [keys.text]: editor.text.trim(),
                    [keys.images]: editor.images,
                    [keys.order]: editor.sendOrder
                };
                if (isGreeting) fields.greetingCooldownDays = draftDays();
                save.disabled = true;
                revert.disabled = true;
                save.setAttribute('aria-busy', 'true');
                setButtonLabel(save, 'Сохраняем…', 'progress_activity');
                setStatus(status, 'Сохраняем…', 'loading');
                try {
                    await commit({ set: fields });
                    fill();
                    setStatus(status, 'Изменения сохранены.', 'success');
                } catch (failure) {
                    reportFailure(failure, status);
                    syncDirty();
                } finally {
                    save.removeAttribute('aria-busy');
                    setButtonLabel(save, 'Сохранить', 'check');
                }
            });

            return { element, render, isDirty };
        }

        // --- Keyword rules ---------------------------------------------------------------------
        const keywordsSection = node('section', 'fpt-ar-section');
        keywordsSection.setAttribute('aria-labelledby', 'fpt-ar-keywords-title');
        const keywordsTitle = node('h2', 'fpt-ad-section-title', 'Ответы по ключевым словам');
        keywordsTitle.id = 'fpt-ar-keywords-title';
        keywordsSection.append(keywordsTitle,
            node('p', 'fpt-ad-section-description', 'Отвечать, когда сообщение совпадает с фразой или содержит её.'));

        const keywordsCard = node('article', 'fpt-ar-card fpt-ar-keywords-card');
        keywordsCard.dataset.state = 'off';
        const keywordsHead = node('div', 'fpt-ar-card-head');
        const keywordsIcon = node('span', 'fpt-ar-card-icon');
        keywordsIcon.appendChild(icon('forum'));
        const keywordsCopy = node('div', 'fpt-ar-card-copy');
        const keywordsHeading = node('h3', '', 'Правила по ключевым словам');
        const keywordsSummary = node('p', '', '');
        keywordsCopy.append(keywordsHeading, keywordsSummary);
        const keywordsToggle = makeSwitch('fpt-ar-keywords-enabled', 'Ответы по ключевым словам', false);
        keywordsToggle.element.classList.add('fpt-ar-card-switch');
        keywordsHead.append(keywordsIcon, keywordsCopy, keywordsToggle.element);

        const keywordsBody = node('div', 'fpt-ar-card-body fpt-ar-keywords-body');
        const keywordsToolbar = node('div', 'fpt-ar-keywords-toolbar');
        const search = node('input', 'fpt-ar-search');
        search.type = 'search';
        search.placeholder = 'Поиск по правилам';
        search.setAttribute('aria-label', 'Поиск по правилам');
        const addButton = createButton('fpt-ar-add', 'add', 'Добавить правило');
        keywordsToolbar.append(search, addButton);
        const keywordsNote = node('p', 'fpt-ar-disabled-note');
        keywordsNote.append(icon('info'), node('span', '', 'Ответы по словам выключены: правила сохранены, но сейчас не срабатывают.'));
        const keywordsList = node('div', 'fpt-ar-rule-list');
        const keywordsStatus = node('p', 'fpt-ad-rules-status fpt-ar-status');
        keywordsStatus.setAttribute('aria-live', 'polite');
        keywordsBody.append(keywordsToolbar, keywordsNote, keywordsList, keywordsStatus);
        keywordsCard.append(keywordsHead, keywordsBody);
        keywordsSection.appendChild(keywordsCard);

        // Shown instead of the cards' contents when the stored settings cannot be read.
        const loadBanner = node('div', 'fpt-ar-banner');
        loadBanner.hidden = true;

        view.append(hero, loadBanner, scenariosSection, keywordsSection);
        page.appendChild(view);

        // --- Rendering ---------------------------------------------------------------------------
        function renderHero() {
            const settings = state.settings;
            const active = countActiveScenarios(settings);
            const on = active > 0;
            hero.dataset.state = state.loaded && on ? 'on' : 'off';
            if (!state.loaded) {
                heroPill.textContent = state.loadError ? 'Нет данных' : 'Загрузка…';
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                metricActive.value.textContent = '—';
                metricRules.value.textContent = '—';
                metricGreeting.value.textContent = '—';
                return;
            }
            heroPill.textContent = on ? 'Работает' : 'Выключен';
            heroPill.dataset.kind = on ? 'success' : 'neutral';
            metricActive.value.textContent = `${active} из ${SCENARIOS.length + 1}`;
            const rules = ruleCount(settings);
            metricRules.value.textContent = `${rules} ${root.FPTPopupUI.pluralize(rules, ['правило', 'правила', 'правил'])}`;
            metricGreeting.value.textContent = settings.greetingEnabled ? cooldownText(settings.greetingCooldownDays) : 'Приветствие выключено';
        }

        function ruleRow(rule, index) {
            const row = node('article', 'fpt-ar-rule');
            row.dataset.index = String(index);
            const main = node('div', 'fpt-ar-rule-main');
            const titleRow = node('div', 'fpt-ar-rule-title-row');
            titleRow.append(node('strong', 'fpt-ar-rule-keyword', rule.keyword || '—'),
                node('span', 'fpt-ar-badge', rule.matchMode === 'contains' ? 'Содержит' : 'Точное'));
            const pictures = cleanImages(rule.images).length;
            if (pictures) {
                const badge = node('span', 'fpt-ar-badge fpt-ar-badge--image');
                badge.append(icon('image'), node('span', '', String(pictures)));
                badge.title = `${pictures} ${root.FPTPopupUI.pluralize(pictures, ['изображение', 'изображения', 'изображений'])}`;
                titleRow.appendChild(badge);
            }
            const preview = node('p', 'fpt-ar-rule-preview', rule.response ? rule.response : 'Только изображение без текста');
            if (!rule.response) preview.dataset.empty = 'true';
            main.append(titleRow, preview);

            const actions = node('div', 'fpt-ar-rule-actions');
            const edit = node('button', 'fpt-ar-icon-button');
            edit.type = 'button';
            edit.title = 'Изменить правило';
            edit.setAttribute('aria-label', `Изменить правило «${rule.keyword}»`);
            edit.appendChild(icon('edit'));
            edit.addEventListener('click', () => openRuleDialog(index));
            const remove = node('button', 'fpt-ar-icon-button fpt-ar-icon-button--danger');
            remove.type = 'button';
            remove.title = 'Удалить правило';
            remove.setAttribute('aria-label', `Удалить правило «${rule.keyword}»`);
            remove.appendChild(icon('delete'));
            remove.addEventListener('click', () => openDeleteDialog(index));
            actions.append(edit, remove);
            row.append(main, actions);
            return row;
        }

        function renderKeywords() {
            const settings = state.settings;
            const enabled = state.loaded && settings.keywordsEnabled === true;
            const count = ruleCount(settings);
            keywordsCard.dataset.state = enabled ? 'on' : 'off';
            keywordsToggle.setChecked(enabled);
            keywordsToggle.input.disabled = !state.loaded;
            keywordsNote.hidden = !state.loaded || enabled || !count;
            keywordsSummary.textContent = !state.loaded ? (state.loadError ? 'Правила недоступны' : 'Загружаем правила…')
                : count ? `${count} ${root.FPTPopupUI.pluralize(count, ['правило', 'правила', 'правил'])}`
                    : 'Правил пока нет';
            search.hidden = count <= KEYWORD_SEARCH_THRESHOLD;
            // With no rules the empty state carries its own "add" call to action.
            keywordsToolbar.hidden = !state.loaded || count === 0;
            keywordsList.replaceChildren();
            if (!state.loaded) {
                keywordsList.appendChild(state.loadError
                    ? createListState('error', 'Правила недоступны', 'Настройки автоответчика не удалось прочитать.')
                    : createListState('loading', 'Загружаем правила…', 'Читаем сохранённые настройки автоответчика.'));
                return;
            }
            if (!count) {
                const first = createButton('fpt-ar-add', 'add', 'Добавить первое правило');
                first.addEventListener('click', () => openRuleDialog(-1));
                keywordsList.appendChild(createListState('empty', 'Правил пока нет',
                    'Например, на «когда доставка?» автоответчик может сам прислать срок и инструкцию.', first));
                return;
            }
            const rows = filterKeywords(settings.keywords, state.query);
            if (!rows.length) {
                keywordsList.appendChild(createListState('empty', 'Ничего не найдено', 'Измените запрос или очистите поиск.'));
                return;
            }
            rows.forEach(({ rule, index }) => keywordsList.appendChild(ruleRow(rule, index)));
        }

        function renderBanner() {
            loadBanner.replaceChildren();
            loadBanner.hidden = !state.loadError;
            if (!state.loadError) return;
            const retry = createButton('fpt-ab-ghost-button', 'refresh', 'Повторить');
            retry.addEventListener('click', () => load());
            loadBanner.appendChild(createListState('error', 'Не удалось загрузить настройки автоответчика', state.loadError, retry));
        }

        function renderAll() {
            renderHero();
            renderBanner();
            cards.forEach(card => card.render());
            renderKeywords();
        }

        function applyStored(autoReplies) {
            state.settings = normalizeSettings(autoReplies);
            state.loaded = true;
            state.loadError = null;
        }

        // --- Data -----------------------------------------------------------------------------
        // The store answers every patch with the full settings object; fall back to a re-read otherwise.
        async function adopt(response) {
            if (isRecord(response) && Object.keys(response).length) applyStored(response);
            else applyStored((await run('getSettings', { keys: [STORE_KEY] }))[STORE_KEY]);
        }

        async function commit(patch) {
            const response = await run('saveSettings', { patch });
            if (isRecord(response) && Object.keys(response).length) applyStored(response);
            else applyStored({ ...state.settings, ...(patch.set || {}) });
            renderAll();
            return response;
        }

        async function load() {
            state.loaded = false;
            state.loadError = null;
            renderAll();
            try {
                await adopt(null);
            } catch (failure) {
                state.loadError = (failure && failure.message) || 'Проверьте подключение и повторите.';
            }
            renderAll();
        }

        async function reload() {
            try {
                await adopt(null);
            } catch (_) {}
            renderAll();
        }

        function reportFailure(failure, statusElement) {
            if (failure && failure.code === STALE_CODE) {
                setStatus(statusElement, 'Список правил изменился. Мы его обновили — повторите действие.', 'warning');
                reload();
                return;
            }
            setStatus(statusElement, (failure && failure.message) || 'Не удалось сохранить изменения.', 'error');
        }

        // --- Keyword interactions -------------------------------------------------------------
        keywordsToggle.input.addEventListener('change', async () => {
            const next = keywordsToggle.input.checked;
            const previous = state.settings.keywordsEnabled;
            keywordsToggle.input.disabled = true;
            keywordsCard.dataset.state = next ? 'on' : 'off';
            try {
                await commit({ set: { keywordsEnabled: next } });
                setStatus(keywordsStatus, next ? 'Ответы по словам включены.' : 'Ответы по словам выключены.', 'success');
            } catch (failure) {
                keywordsToggle.setChecked(previous);
                keywordsCard.dataset.state = previous ? 'on' : 'off';
                reportFailure(failure, keywordsStatus);
            } finally {
                keywordsToggle.input.disabled = false;
            }
        });
        search.addEventListener('input', () => {
            state.query = search.value;
            renderKeywords();
        });
        addButton.addEventListener('click', () => openRuleDialog(-1));

        function openRuleDialog(index) {
            const editing = index >= 0;
            const original = editing ? state.settings.keywords[index] : null;
            if (editing && !original) return;
            const dialog = root.FPTPopupUI.createDialog(popup, editing ? 'Изменить правило' : 'Новое правило', {
                wide: true,
                description: 'Когда сообщение покупателя подойдёт под фразу, автоответчик отправит этот ответ.'
            });
            const form = node('div', 'fpt-ar-dialog-form');

            const phraseField = node('div', 'fpt-ar-field');
            const phraseLabel = node('label', 'fpt-ad-field-label fpt-ar-field-label', 'Ключевое слово или фраза');
            const phrase = node('input', 'fpt-ar-input');
            phrase.type = 'text';
            phrase.id = 'fpt-ar-rule-phrase';
            phraseLabel.htmlFor = phrase.id;
            phrase.placeholder = 'Например: когда доставка?';
            phrase.value = original ? original.keyword || '' : '';
            phrase.maxLength = 200;
            const phraseError = node('p', 'fpt-ar-field-error');
            phraseError.id = 'fpt-ar-rule-phrase-error';
            phraseError.setAttribute('role', 'alert');
            phraseError.hidden = true;
            phrase.setAttribute('aria-describedby', phraseError.id);
            phraseField.append(phraseLabel, phrase, phraseError);

            const modeField = node('div', 'fpt-ar-field');
            modeField.appendChild(node('span', 'fpt-ad-field-label fpt-ar-field-label', 'Совпадение'));
            const modeHint = node('p', 'fpt-ad-template-help fpt-ar-mode-hint', '');
            const mode = createSegmented('Тип совпадения', MATCH_MODES, () => {
                updateModeHint();
                validate(false);
            });
            function updateModeHint() {
                modeHint.textContent = mode.value === 'contains'
                    ? 'Сработает, если фраза есть в сообщении покупателя в любом месте.'
                    : 'Сработает, только если сообщение целиком совпадает с фразой.';
            }
            mode.setValue(modeOf(original));
            updateModeHint();
            modeField.append(mode.element, modeHint);

            const editor = createReplyEditor({
                idPrefix: 'fpt-ar-rule',
                label: 'Ответ',
                placeholder: 'Текст ответа. Можно использовать {buyername}.',
                variables: KEYWORD_VARIABLES,
                run,
                onChange: () => validate(false)
            });
            editor.set({
                text: original ? original.response || '' : '',
                images: original ? original.images : [],
                sendOrder: original ? original.sendOrder : ORDER_TEXT_FIRST
            });

            const duplicate = node('p', 'fpt-ar-duplicate');
            duplicate.hidden = true;
            duplicate.append(icon('warning'), node('span', ''));
            form.append(phraseField, modeField, editor.element, duplicate);
            dialog.body.appendChild(form);

            const cancel = node('button', 'fpt-lot-dialog-button', 'Отмена');
            cancel.type = 'button';
            const submit = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--primary', editing ? 'Сохранить' : 'Добавить');
            submit.type = 'button';
            dialog.footer.append(cancel, submit);

            function candidate() {
                return { keyword: phrase.value, response: editor.text, images: editor.images,
                    matchMode: mode.value, sendOrder: editor.sendOrder };
            }

            function validate(showErrors) {
                let message = '';
                let ok = true;
                if (!phrase.value.trim()) {
                    ok = false;
                    message = 'Укажите ключевое слово или фразу.';
                }
                phraseError.hidden = !(showErrors && message);
                phraseError.textContent = showErrors ? message : '';
                if (showErrors && message) phrase.setAttribute('aria-invalid', 'true');
                else phrase.removeAttribute('aria-invalid');
                const hasReply = !!editor.text.trim() || editor.images.length > 0;
                editor.setError(showErrors && !hasReply ? 'Добавьте текст ответа или изображение.' : '');
                if (!hasReply) ok = false;
                const dup = findDuplicateRule(state.settings.keywords, candidate(), editing ? index : -1);
                duplicate.hidden = dup < 0;
                if (dup >= 0) duplicate.querySelector('span:last-child').textContent =
                    'Такое правило уже есть. Сработает то, что выше в списке.';
                return ok;
            }

            phrase.addEventListener('input', () => validate(false));
            phrase.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                submit.click();
            });
            cancel.addEventListener('click', () => dialog.close());
            submit.addEventListener('click', async () => {
                if (!validate(true)) {
                    (phrase.value.trim() ? editor.textarea : phrase).focus();
                    return;
                }
                let rule;
                try {
                    rule = buildKeywordRule(candidate(), original);
                } catch (failure) {
                    root.FPTPopupUI.showToast(popup, failure.message, 'error');
                    return;
                }
                dialog.setBusy(true);
                try {
                    const response = editing
                        ? await run('updateListItem', { index, expected: original, value: rule })
                        : await run('addKeywordBtn', rule);
                    await adopt(response);
                    dialog.setBusy(false);
                    dialog.close();
                    renderAll();
                    setStatus(keywordsStatus, editing ? 'Правило обновлено.' : 'Правило добавлено.', 'success');
                } catch (failure) {
                    dialog.setBusy(false);
                    if (failure && failure.code === STALE_CODE) {
                        dialog.close();
                        reportFailure(failure, keywordsStatus);
                        return;
                    }
                    root.FPTPopupUI.showToast(popup, (failure && failure.message) || 'Не удалось сохранить правило.', 'error');
                }
            });
            validate(false);
        }

        function openDeleteDialog(index) {
            const original = state.settings.keywords[index];
            if (!original) return;
            const dialog = root.FPTPopupUI.createDialog(popup, 'Удалить правило?', {
                description: `Правило «${original.keyword}» будет удалено. Это действие нельзя отменить.`
            });
            const cancel = node('button', 'fpt-lot-dialog-button', 'Отмена');
            cancel.type = 'button';
            const confirmRemove = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--danger', 'Удалить');
            confirmRemove.type = 'button';
            dialog.footer.append(cancel, confirmRemove);
            cancel.addEventListener('click', () => dialog.close());
            confirmRemove.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    await adopt(await run('removeListItem', { index, expected: original }));
                    dialog.setBusy(false);
                    dialog.close();
                    renderAll();
                    setStatus(keywordsStatus, 'Правило удалено.', 'success');
                } catch (failure) {
                    dialog.setBusy(false);
                    dialog.close();
                    reportFailure(failure, keywordsStatus);
                }
            });
        }

        // Settings changed elsewhere (import, another tab) refresh the screen unless a card is being edited.
        const onStorage = (changes, area) => {
            if (!page.isConnected) {
                try { chrome.storage.onChanged.removeListener(onStorage); } catch (_) {}
                return;
            }
            if (area !== 'local' || !changes || !changes[STORE_KEY]) return;
            if (cards.some(card => card.isDirty())) return;
            reload();
        };
        try { chrome.storage.onChanged.addListener(onStorage); } catch (_) {}

        await load();
    }

    root.FPTAutoReplyPage = Object.freeze({
        mount,
        normalizeSettings,
        countActiveScenarios,
        buildKeywordRule,
        findDuplicateRule,
        filterKeywords,
        cooldownText,
        SCENARIOS,
        KEYWORD_VARIABLES
    });
})(window);
