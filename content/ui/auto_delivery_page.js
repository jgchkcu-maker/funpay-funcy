// Warehouse and per-lot auto-delivery controls for the popup category.
(function (root) {
    'use strict';

    const PAGE_ID = 'auto_delivery';
    const GLOBAL_SETTINGS = Object.freeze({
        restore: 'fpToolsAutoRestoreEnabled',
        disable: 'fpToolsAutoDisableEnabled'
    });

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

    function formatStock(count, mode) {
        if (mode === 'template' || !Number.isInteger(count) || count < 0) {
            return { text: 'Остаток не отслеживается', kind: 'unknown' };
        }
        if (count === 0) return { text: 'Склад пуст', kind: 'empty' };
        return { text: `На складе: ${count} шт.`, kind: 'stocked' };
    }

    function formatLotStock(draft) {
        if (draft.stockError) {
            return { text: 'Не удалось проверить остаток', kind: 'error', title: draft.stockError };
        }
        return formatStock(draft.productCount, draft.mode);
    }

    function pluralLots(count) {
        return root.FPTPopupUI.pluralize(count, ['лот', 'лота', 'лотов']);
    }

    const PREVIEW_DEMO = Object.freeze({ buyername: 'Алексей', orderid: 'AB12CD34' });

    function greeting(date = new Date()) {
        const hour = date.getHours();
        return hour >= 5 && hour < 12 ? 'Доброе утро!' : hour >= 12 && hour < 18 ? 'Добрый день!' : 'Добрый вечер!';
    }

    function formatDateTime(date) {
        const pad = value => String(value).padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    // Mirrors applyVariables and the $sleep split in background/autoresponder.js.
    function previewDeliveryParts(text, lotName, now = new Date()) {
        const values = {
            buyername: PREVIEW_DEMO.buyername,
            lotname: lotName,
            orderid: PREVIEW_DEMO.orderid,
            orderlink: `https://funpay.com/orders/${PREVIEW_DEMO.orderid}/`,
            welcome: greeting(now),
            date: formatDateTime(now)
        };
        const parts = [];
        String(text || '').split(/\$sleep=(\d+\.?\d*)/i).forEach((part, index) => {
            if (index % 2 === 1) {
                parts.push({ type: 'pause', seconds: Number.parseFloat(part) });
                return;
            }
            const message = part.replace(/\{(buyername|lotname|orderid|orderlink|welcome|date)\}/gi, (_, key) => values[key.toLowerCase()]).trim();
            if (message) parts.push({ type: 'message', text: message });
        });
        while (parts.length && parts[parts.length - 1].type === 'pause') parts.pop();
        while (parts.length && parts[0].type === 'pause') parts.shift();
        return parts;
    }

    function formatCheckedAt(timestamp, now = Date.now()) {
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Ещё не проверялись';
        const date = new Date(timestamp);
        const today = new Date(now);
        const pad = value => String(value).padStart(2, '0');
        const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        if (date.toDateString() === today.toDateString()) return `Сегодня, ${time}`;
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}, ${time}`;
    }

    function metric(iconName, label, tone = '') {
        const element = node('div', 'fpt-qr-metric fpt-ad-metric');
        if (tone) element.dataset.tone = tone;
        const badge = node('span', 'fpt-qr-metric-icon');
        badge.appendChild(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        copy.append(node('span', 'fpt-qr-metric-label', label), value);
        element.append(badge, copy);
        return { element, value };
    }

    function setStatus(element, text, kind) {
        element.replaceChildren();
        delete element.dataset.kind;
        if (text && ['success', 'error', 'warning'].includes(kind) && !element.classList.contains('fpt-ad-load-status')) {
            root.FPTPopupUI.showToast(element.closest('.fp-tools-popup'), text, kind);
            return;
        }
        if (!text) {
            delete element.dataset.kind;
            return;
        }
        if (kind) element.dataset.kind = kind;
        const statusIcons = { success: 'check_circle', warning: 'warning', error: 'error', loading: 'progress_activity' };
        if (statusIcons[kind]) element.appendChild(icon(statusIcons[kind]));
        element.appendChild(node('span', 'fpt-ad-status-text', text));
    }

    function makeSwitch(id, labelText, checked, className = '') {
        const label = node('label', 'fpt-ad-switch-control');
        const input = node('input', `fpt-ad-switch ${className}`.trim());
        input.type = 'checkbox';
        input.id = id;
        input.checked = !!checked;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', labelText);
        label.append(input, node('span', 'fpt-ad-switch-track'));
        return { label, input };
    }

    function makeSwitchLine(control, checked) {
        const line = node('div', 'fpt-ad-switch-line');
        const state = node('span', 'fpt-ad-switch-state', checked ? 'Вкл' : 'Выкл');
        control.input.addEventListener('change', () => {
            state.textContent = control.input.checked ? 'Вкл' : 'Выкл';
        });
        line.append(control.label, state);
        return { element: line, state };
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-ad-help fpt-lot-help-popover');
        panel.id = 'fpt-ad-help';
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по автовыдаче');
        panel.appendChild(node('h2', '', 'Автовыдача'));
        const list = node('ul');
        [
            'После оплаты расширение отправляет покупателю в чат товар со склада FunPay или ваш шаблон.',
            'В шаблоне работают переменные {buyername}, {lotname}, {orderid}, {orderlink}, {welcome}, {date}; $sleep=5 делит текст на сообщения с паузой.',
            'Остатки обновляются кнопкой «Обновить лоты» и после каждой успешной выдачи.',
            'Правила склада учитывают только лоты с включённой автовыдачей и сохранёнными настройками.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    function createRule({ id, iconName, title, description, settingKey, checked }) {
        const row = node('article', 'fpt-ad-rule-row');
        const iconWrap = node('span', `fpt-ad-rule-icon fpt-ad-rule-icon--${settingKey}`);
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ad-rule-copy');
        copy.append(node('h3', '', title), node('p', '', description));
        const control = makeSwitch(id, title, checked, 'fpt-ad-global-switch');
        control.input.dataset.settingKey = settingKey;
        row.append(iconWrap, copy, makeSwitchLine(control, checked).element);
        return row;
    }

    function createEmptyState(kind = 'empty') {
        const state = node('div', `fpt-ad-list-state fpt-ad-list-state--${kind}`);
        state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        state.appendChild(icon(kind === 'loading' ? 'progress_activity' : kind === 'error' ? 'error' : 'inventory_2'));
        const copy = node('div', 'fpt-ad-list-state-copy');
        const title = kind === 'loading' ? 'Загружаем лоты…'
            : kind === 'error' ? 'Не удалось загрузить лоты'
                : 'Загрузите свои лоты';
        const description = kind === 'loading' ? 'Получаем список лотов и проверяем остатки на складе.'
            : kind === 'error' ? 'Проверьте подключение к FunPay и повторите загрузку.'
                : 'Здесь появятся остатки и настройки автовыдачи для каждого лота.';
        copy.append(node('strong', '', title), node('span', '', description));
        state.appendChild(copy);
        return state;
    }

    function createLoadingSkeletons() {
        const list = node('div', 'fpt-ad-skeleton-list');
        list.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 4; index += 1) {
            const row = node('article', 'fpt-ad-skeleton-row');
            const summary = node('div', 'fpt-ad-skeleton-summary');
            summary.appendChild(node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-thumb'));
            const copy = node('span', 'fpt-ad-skeleton-copy');
            copy.append(node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-title'), node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-meta'));
            summary.appendChild(copy);
            row.append(
                summary,
                node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-toggle'),
                node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-source'),
                node('span', 'fpt-ad-skeleton-block fpt-ad-skeleton-save')
            );
            list.appendChild(row);
        }
        return list;
    }

    function createLotDraft(config = {}) {
        const settings = {
            enabled: config.enabled !== false,
            mode: config.mode === 'template' ? 'template' : 'secrets',
            text: typeof config.text === 'string' ? config.text : '',
            productCount: Number.isInteger(config.productCount) && config.productCount >= 0
                ? config.productCount
                : null
        };
        const stockSnapshot = Number.isInteger(settings.productCount) && settings.productCount >= 0
            ? settings.productCount
            : Number.isInteger(config.stockSnapshot) && config.stockSnapshot >= 0 ? config.stockSnapshot : null;
        return { ...settings, stockSnapshot, saved: { ...settings }, dirty: false };
    }

    function settingsChanged(draft) {
        return draft.enabled !== draft.saved.enabled
            || draft.mode !== draft.saved.mode
            || draft.text !== draft.saved.text;
    }

    function renderLotRow(lot, draft, actions) {
        const id = String(lot.id);
        const row = node('article', 'fpt-ad-lot-row');
        row.dataset.lotId = id;

        const summary = node('div', 'fpt-ad-lot-summary');
        const imageWrap = node('span', 'fpt-ad-lot-image');
        const imageFallback = icon('inventory_2');
        imageWrap.appendChild(imageFallback);
        if (typeof lot.imageUrl === 'string' && /^https?:\/\//i.test(lot.imageUrl)) {
            const image = node('img', 'fpt-ad-lot-image-real');
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('error', () => image.remove(), { once: true });
            image.addEventListener('load', () => imageFallback.remove(), { once: true });
            image.src = lot.imageUrl;
            imageWrap.appendChild(image);
        }

        const copy = node('div', 'fpt-ad-lot-copy');
        const titleText = typeof lot.title === 'string' && lot.title.trim() ? lot.title.trim() : `Лот #${id}`;
        const title = node('a', 'fpt-ad-lot-title', titleText);
        title.href = `https://funpay.com/lots/offer?id=${encodeURIComponent(id)}`;
        title.target = '_blank';
        title.rel = 'noopener noreferrer';
        const categoryName = typeof lot.categoryName === 'string' && lot.categoryName.trim()
            ? lot.categoryName.trim()
            : 'Без категории';
        const category = node('span', 'fpt-ad-lot-category', categoryName);
        category.title = categoryName;
        const stockState = formatLotStock(draft);
        const stock = node('span', `fpt-ad-lot-stock fpt-ad-lot-stock--${stockState.kind}`, stockState.text);
        stock.dataset.stockState = stockState.kind;
        if (stockState.title) stock.title = stockState.title;
        const meta = node('div', 'fpt-ad-lot-meta');
        meta.append(category, stock);
        copy.append(title, meta);
        summary.append(imageWrap, copy);

        const delivery = node('div', 'fpt-ad-lot-delivery');
        delivery.appendChild(node('span', 'fpt-ad-field-label', 'Автовыдача'));
        const enabled = makeSwitch(`fpt-ad-enabled-${id}`, `Автовыдача для лота ${lot.title || id}`, draft.enabled);
        enabled.input.dataset.lotControl = 'enabled';
        enabled.input.dataset.lotId = id;
        const enabledLine = makeSwitchLine(enabled, draft.enabled);
        if (!draft.enabled) {
            enabledLine.state.remove();
            enabledLine.element.appendChild(node('span', 'fpt-ad-disabled-badge', 'Выкл'));
        }
        delivery.appendChild(enabledLine.element);

        const source = node('div', 'fpt-ad-lot-source');
        const sourceLabel = node('label', 'fpt-ad-field-label', 'Источник товаров');
        sourceLabel.htmlFor = `fpt-ad-source-${id}`;
        const select = node('select', 'fpt-ad-source-select');
        select.id = `fpt-ad-source-${id}`;
        select.dataset.lotControl = 'mode';
        select.dataset.lotId = id;
        for (const [value, label] of [['secrets', 'Склад FunPay'], ['template', 'Свой шаблон']]) {
            const option = node('option', '', label);
            option.value = value;
            option.selected = draft.mode === value;
            select.appendChild(option);
        }
        select.title = 'Секреты берутся из склада этого лота; добавляйте и удаляйте их в разделе «Управление лотами».';
        source.append(sourceLabel, select);

        const template = node('div', 'fpt-ad-template');
        template.hidden = draft.mode !== 'template';
        const templateLabel = node('label', 'fpt-ad-field-label', 'Текст выдачи');
        templateLabel.htmlFor = `fpt-ad-template-${id}`;
        const textarea = node('textarea', 'fpt-ad-template-input');
        textarea.id = `fpt-ad-template-${id}`;
        textarea.dataset.lotControl = 'text';
        textarea.dataset.lotId = id;
        textarea.rows = 3;
        textarea.value = draft.text;
        textarea.placeholder = 'Сообщение, которое расширение отправит покупателю после оплаты.';
        const templateError = node('p', 'fpt-ad-template-error', 'Введите текст выдачи, чтобы покупатель получил сообщение.');
        templateError.id = `fpt-ad-template-error-${id}`;
        templateError.setAttribute('role', 'alert');
        templateError.hidden = true;
        const variableHelp = node('p', 'fpt-ad-template-help', 'Нажмите на переменную, чтобы вставить её в текст. $sleep=5 отправит следующую часть отдельным сообщением через 5 секунд.');
        variableHelp.id = `fpt-ad-template-help-${id}`;
        const variableChips = node('div', 'fpt-ad-variable-chips');
        variableChips.setAttribute('role', 'group');
        variableChips.setAttribute('aria-label', 'Переменные шаблона');
        for (const [token, label] of [
            ['{buyername}', 'Имя покупателя'], ['{lotname}', 'Название лота'],
            ['{orderid}', 'Номер заказа'], ['{orderlink}', 'Ссылка на заказ'],
            ['{welcome}', 'Приветствие'], ['{date}', 'Дата и время'], ['$sleep=5', 'Пауза 5 сек']
        ]) {
            const chip = node('button', 'fpt-ad-variable-chip');
            chip.type = 'button';
            chip.append(icon(token === '$sleep=5' ? 'timer' : 'add'), node('span', '', label));
            chip.dataset.templateToken = token;
            chip.title = token === '$sleep=5' ? 'Пауза перед отправкой следующей части сообщения ($sleep=5)' : token;
            chip.addEventListener('click', () => {
                const start = textarea.selectionStart ?? textarea.value.length;
                const end = textarea.selectionEnd ?? start;
                textarea.setRangeText(token, start, end, 'end');
                textarea.focus();
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            variableChips.appendChild(chip);
        }
        const characterCount = node('span', 'fpt-ad-template-count', `${textarea.value.length} символов`);
        characterCount.setAttribute('aria-live', 'polite');
        textarea.setAttribute('aria-describedby', variableHelp.id);
        const editor = node('div', 'fpt-ad-template-editor');
        const editorHead = node('div', 'fpt-ad-template-head');
        editorHead.append(templateLabel, characterCount);
        editor.append(editorHead, textarea, templateError, variableChips, variableHelp);

        const preview = node('div', 'fpt-ad-preview');
        preview.setAttribute('aria-label', `Предпросмотр выдачи для ${titleText}`);
        const previewHead = node('div', 'fpt-ad-template-head');
        previewHead.append(node('span', 'fpt-ad-field-label', 'Так увидит покупатель'), node('span', 'fpt-ad-preview-count'));
        const previewChat = node('div', 'fpt-ad-preview-chat');
        preview.append(previewHead, previewChat);
        const renderPreview = () => {
            const parts = previewDeliveryParts(textarea.value, titleText);
            const messages = parts.filter(part => part.type === 'message').length;
            previewHead.querySelector('.fpt-ad-preview-count').textContent = messages > 1
                ? `${messages} ${root.FPTPopupUI.pluralize(messages, ['сообщение', 'сообщения', 'сообщений'])}`
                : '';
            previewChat.replaceChildren();
            if (!messages) {
                const empty = node('p', 'fpt-ad-preview-empty');
                empty.append(icon('chat_bubble'), node('span', '', 'Напишите текст — здесь появится сообщение покупателю.'));
                previewChat.appendChild(empty);
                return;
            }
            for (const part of parts) {
                if (part.type === 'pause') {
                    const pause = node('span', 'fpt-ad-preview-pause');
                    pause.append(icon('schedule'), node('span', '', `пауза ${String(part.seconds).replace('.', ',')} с`));
                    previewChat.appendChild(pause);
                } else {
                    previewChat.appendChild(node('div', 'fpt-ad-preview-bubble', part.text));
                }
            }
        };
        textarea.addEventListener('input', () => {
            characterCount.textContent = `${textarea.value.length} символов`;
            renderPreview();
        });
        renderPreview();
        template.append(editor, preview);

        const saveArea = node('div', 'fpt-ad-lot-save-area');
        const unsavedBadge = node('span', 'fpt-ad-unsaved-badge', 'Не сохранено');
        const saveStatus = node('span', 'fpt-ad-lot-save-status');
        saveStatus.setAttribute('aria-live', 'polite');
        const save = node('button', 'fpt-ad-save-button', 'Сохранить');
        save.type = 'button';
        save.dataset.lotSave = id;
        save.disabled = !draft.dirty;
        // The slot takes the place of a field label so the button lines up with the source select.
        const saveSlot = node('div', 'fpt-ad-lot-save-slot');
        saveSlot.append(unsavedBadge, saveStatus);
        saveArea.append(saveSlot, save);

        row.append(summary, delivery, source, saveArea, template);
        row.addEventListener('change', event => {
            const control = event.target.closest('[data-lot-control]');
            if (!control || control.dataset.lotId !== id) return;
            if (control.dataset.lotControl === 'enabled') draft.enabled = control.checked;
            if (control.dataset.lotControl === 'mode') {
                draft.mode = control.value;
                if (draft.mode === 'template') {
                    if (Number.isInteger(draft.productCount) && draft.productCount >= 0) {
                        draft.stockSnapshot = draft.productCount;
                    }
                    draft.productCount = null;
                } else {
                    draft.productCount = Number.isInteger(draft.stockSnapshot) && draft.stockSnapshot >= 0
                        ? draft.stockSnapshot
                        : null;
                }
            }
            updateRowState(row, draft);
            actions.onChange?.();
        });
        row.addEventListener('input', event => {
            const control = event.target.closest('[data-lot-control="text"]');
            if (!control || control.dataset.lotId !== id) return;
            draft.text = control.value;
            updateRowState(row, draft);
            actions.onChange?.();
        });
        save.addEventListener('click', () => actions.save?.(row, draft));
        actions.updateRowState(row, draft);
        actions.onChange?.();
        return row;
    }

    function updateRowState(row, draft) {
        draft.dirty = settingsChanged(draft);
        const source = row.querySelector('.fpt-ad-source-select');
        const template = row.querySelector('.fpt-ad-template');
        const stock = row.querySelector('.fpt-ad-lot-stock');
        const save = row.querySelector('.fpt-ad-save-button');
        const templateInput = row.querySelector('[data-lot-control="text"]');
        const templateError = row.querySelector('.fpt-ad-template-error');
        const delivery = row.querySelector('.fpt-ad-lot-delivery');
        const unsavedBadge = row.querySelector('.fpt-ad-unsaved-badge');
        const invalidTemplate = draft.mode === 'template' && !draft.text.trim();
        row.dataset.enabled = String(draft.enabled);
        if (source && source.value !== draft.mode) source.value = draft.mode;
        if (template) template.hidden = draft.mode !== 'template';
        if (templateInput) {
            templateInput.setAttribute('aria-invalid', invalidTemplate ? 'true' : 'false');
            if (templateError) {
                const helpId = templateInput.id.replace('fpt-ad-template-', 'fpt-ad-template-help-');
                templateInput.setAttribute('aria-describedby', invalidTemplate ? `${helpId} ${templateError.id}` : helpId);
            }
        }
        if (templateError) templateError.hidden = !invalidTemplate;
        if (stock) {
            const state = formatLotStock(draft);
            row.dataset.stock = state.kind;
            stock.className = `fpt-ad-lot-stock fpt-ad-lot-stock--${state.kind}`;
            stock.dataset.stockState = state.kind;
            stock.textContent = state.text;
            if (state.title) stock.title = state.title;
            else stock.removeAttribute('title');
        }
        if (delivery) {
            const enabled = delivery.querySelector('[data-lot-control="enabled"]');
            if (enabled) enabled.checked = draft.enabled;
            const state = delivery.querySelector('.fpt-ad-switch-state');
            const line = delivery.querySelector('.fpt-ad-switch-line');
            const badge = line?.querySelector('.fpt-ad-disabled-badge');
            if (draft.enabled) {
                if (badge) badge.remove();
                const enabledState = state || node('span', 'fpt-ad-switch-state', 'Вкл');
                enabledState.textContent = 'Вкл';
                if (line && !state) line.appendChild(enabledState);
            } else {
                if (state) state.remove();
                if (line && !badge) line.appendChild(node('span', 'fpt-ad-disabled-badge', 'Выкл'));
            }
        }
        if (unsavedBadge) unsavedBadge.hidden = !draft.dirty;
        if (save) save.disabled = !draft.dirty || invalidTemplate;
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptAutoDeliveryMounted === 'true') return;
        page.dataset.fptAutoDeliveryMounted = 'true';

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Автовыдача', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-auto-delivery');
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }

        // Hero: overall state and the numbers a seller checks first.
        const hero = node('section', 'fpt-qr-hero fpt-ad-hero');
        hero.setAttribute('aria-labelledby', 'fpt-ad-hero-title');
        hero.dataset.state = 'off';
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.appendChild(icon('bolt'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Выдача сразу после оплаты');
        heroTitle.id = 'fpt-ad-hero-title';
        const heroPill = node('span', 'fpt-qr-pill fpt-ad-hero-pill', 'Лоты не загружены');
        heroPill.setAttribute('role', 'status');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Покупатель получает товар со склада FunPay или ваш шаблон в чате, даже когда вас нет онлайн.'));
        heroMain.append(heroIcon, heroCopy);
        const metricActive = metric('bolt', 'С автовыдачей');
        const metricStock = metric('inventory_2', 'Товаров на складе');
        const metricAttention = metric('error', 'Требуют внимания');
        const metricChecked = metric('schedule', 'Остатки проверены');
        const metrics = node('div', 'fpt-qr-metrics fpt-ad-metrics');
        metrics.append(metricActive.element, metricStock.element, metricAttention.element, metricChecked.element);
        hero.append(heroMain, metrics);

        const rules = node('section', 'fpt-ad-rules fpt-qr-card fpt-ad-rules-card');
        rules.setAttribute('aria-labelledby', 'fpt-ad-rules-title');
        const rulesHead = node('div', 'fpt-qr-card-head');
        const rulesEmblem = node('span', 'fpt-qr-emblem');
        rulesEmblem.appendChild(icon('warehouse'));
        const rulesCopy = node('div', 'fpt-qr-card-copy');
        const rulesHeading = node('h3', '', 'Правила склада');
        rulesHeading.id = 'fpt-ad-rules-title';
        rulesCopy.append(rulesHeading, node('p', '', 'Применяются к сохранённым лотам с включённой автовыдачей.'));
        rulesHead.append(rulesEmblem, rulesCopy);
        rules.appendChild(rulesHead);
        const storageKeys = [GLOBAL_SETTINGS.restore, GLOBAL_SETTINGS.disable, 'fpToolsAutoDeliveryLots', 'fpToolsAutoDeliveryLotsCache'];
        let initialSettings = {};
        try {
            initialSettings = await root.fptPopupActions.run(PAGE_ID, 'getSettings', { keys: storageKeys });
        } catch (_) {}
        const rulePanel = node('div', 'fpt-ad-rule-panel');
        rulePanel.append(
            createRule({
                id: 'fpToolsAutoRestoreEnabled', iconName: 'sync', title: 'Автовосстановление лотов',
                description: 'Снова активировать лот, когда на складе появились товары.',
                settingKey: 'restore', checked: initialSettings[GLOBAL_SETTINGS.restore] === true
            }),
            createRule({
                id: 'fpToolsAutoDisableEnabled', iconName: 'visibility_off', title: 'Деактивация при пустом складе',
                description: 'Скрывать лот, когда товары на складе закончились.',
                settingKey: 'disable', checked: initialSettings[GLOBAL_SETTINGS.disable] === true
            })
        );
        rules.appendChild(rulePanel);
        const rulesStatus = node('p', 'fpt-ad-rules-status');
        rulesStatus.setAttribute('aria-live', 'polite');
        rules.appendChild(rulesStatus);

        const lotsSection = node('section', 'fpt-ad-lots');
        lotsSection.setAttribute('aria-labelledby', 'fpt-ad-lots-title');
        const lotsHeading = node('div', 'fpt-ad-lots-heading');
        const lotsCopy = node('div', 'fpt-ad-lots-heading-copy');
        const lotsTitleRow = node('div', 'fpt-ad-lots-title-row');
        const lotsTitle = node('h2', 'fpt-ad-section-title', 'Настройки по лотам');
        lotsTitle.id = 'fpt-ad-lots-title';
        const lotsCount = node('span', 'fpt-qr-pill fpt-ad-lots-count', '0');
        lotsCount.setAttribute('aria-label', 'Количество лотов');
        lotsTitleRow.append(lotsTitle, lotsCount);
        lotsCopy.append(lotsTitleRow);
        // Toolbar reuses the finance header pieces: segmented tabs with a sliding thumb, fin buttons and selects.
        const loadButton = node('button', 'fpt-fin-btn fpt-ad-load-button');
        loadButton.type = 'button';
        loadButton.id = 'fp-load-delivery-lots-btn';
        loadButton.title = 'Обновить лоты и остатки';
        loadButton.append(icon('refresh'), node('span', 'fpt-ad-load-label', 'Обновить'));
        lotsHeading.append(lotsCopy, loadButton);

        const summary = node('div', 'fpt-fin-tabs fpt-ad-filter-tabs');
        summary.setAttribute('role', 'group');
        summary.setAttribute('aria-label', 'Фильтр лотов');
        const summaryPill = node('span', 'fpt-fin-tab-pill');
        summaryPill.setAttribute('aria-hidden', 'true');
        summary.appendChild(summaryPill);
        const summaryChips = new Map();
        for (const [filter, label] of [['all', 'Все'], ['active', 'Активные'], ['problems', 'Проблемы']]) {
            const chip = node('button', 'fpt-fin-tab fpt-ad-summary-chip', '');
            chip.type = 'button';
            chip.dataset.filter = filter;
            chip.append(node('span', 'fpt-fin-tab-label', label), node('strong', 'fpt-ad-tab-count', '0'));
            chip.setAttribute('aria-pressed', filter === 'all' ? 'true' : 'false');
            summary.appendChild(chip);
            summaryChips.set(filter, chip);
        }
        let summaryPillFrame = null;
        const scheduleSummaryPill = () => {
            if (summaryPillFrame !== null) return;
            summaryPillFrame = requestAnimationFrame(() => {
                summaryPillFrame = null;
                const active = summaryChips.get(currentFilter);
                summaryPill.style.opacity = active ? '1' : '0';
                if (!active || !active.offsetWidth) return;
                summaryPill.style.width = `${active.offsetWidth}px`;
                summaryPill.style.height = `${active.offsetHeight}px`;
                summaryPill.style.transform = `translateX(${active.offsetLeft}px)`;
                if (!summary.classList.contains('is-ready')) {
                    summaryPill.getBoundingClientRect();
                    summary.classList.add('is-ready');
                }
            });
        };
        if (typeof ResizeObserver === 'function') {
            const summaryResize = new ResizeObserver(scheduleSummaryPill);
            summaryResize.observe(summary);
            summaryChips.forEach(chip => summaryResize.observe(chip));
        }

        const toolbar = node('div', 'fpt-ad-toolbar');
        const searchWrap = node('label', 'fpt-ad-search-wrap');
        searchWrap.appendChild(icon('search'));
        const search = node('input', 'fpt-ad-search');
        search.type = 'search';
        search.placeholder = 'Поиск по лотам';
        search.setAttribute('aria-label', 'Поиск по лотам');
        searchWrap.appendChild(search);
        const sortLabel = node('span', 'fpt-fin-select fpt-ad-sort-control');
        const sort = node('select', 'fpt-fin-select-input fpt-ad-sort');
        sort.setAttribute('aria-label', 'Сортировка лотов');
        for (const [value, label] of [['default', 'По порядку'], ['problematic', 'Проблемные сверху'], ['title', 'По названию']]) {
            const option = node('option', '', label);
            option.value = value;
            sort.appendChild(option);
        }
        sortLabel.appendChild(sort);
        if (typeof root.FPTPopupUI.enhanceSelect === 'function') root.FPTPopupUI.enhanceSelect(sort, sortLabel);
        toolbar.append(summary, searchWrap, sortLabel);

        const cacheStatus = node('p', 'fpt-ad-cache-status');
        cacheStatus.setAttribute('role', 'status');
        const progressWrap = node('div', 'fpt-ad-load-progress');
        progressWrap.hidden = true;
        const progress = document.createElement('progress');
        progress.max = 1;
        progress.value = 0;
        progress.setAttribute('aria-label', 'Загрузка списка лотов');
        const progressLabel = node('span', '', 'Загружаем список лотов…');
        progressWrap.append(progress, progressLabel);

        const loadStatus = node('p', 'fpt-ad-load-status');
        loadStatus.setAttribute('aria-live', 'polite');
        const list = node('div', 'fpt-ad-lot-list');
        list.setAttribute('aria-label', 'Настройки автовыдачи по лотам');
        list.appendChild(createEmptyState());

        // Appears only while drafts are unsaved and stays in reach while the list scrolls.
        const saveBar = node('div', 'fpt-ad-savebar');
        saveBar.hidden = true;
        saveBar.setAttribute('role', 'region');
        saveBar.setAttribute('aria-label', 'Несохранённые изменения');
        const saveBarIcon = node('span', 'fpt-ad-savebar-icon');
        saveBarIcon.appendChild(icon('edit_note'));
        const saveBarText = node('span', 'fpt-ad-savebar-text', '');
        const saveBarShow = node('button', 'fpt-ad-savebar-show', 'Показать');
        saveBarShow.type = 'button';
        const saveAll = node('button', 'fpt-ad-save-all', 'Сохранить все (0)');
        saveAll.type = 'button';
        saveAll.disabled = true;
        saveBar.append(saveBarIcon, saveBarText, saveBarShow, saveAll);

        const lotsHeader = node('div', 'fpt-finance fpt-ad-lots-header');
        lotsHeader.append(lotsHeading, toolbar);
        lotsSection.append(lotsHeader, cacheStatus, progressWrap, loadStatus, list, saveBar);
        view.append(hero, rules, lotsSection);

        page.appendChild(view);

        const drafts = new Map();
        let currentLots = [];
        let rowsById = new Map();
        let currentFilter = 'all';
        let currentSearch = '';
        let currentSort = 'default';
        let savingAll = false;
        let hasLoadedLots = false;
        let checkedAt = null;
        const updateLoadButton = loading => {
            loadButton.querySelector('.fpt-ad-load-label').textContent = loading
                ? 'Загружаем…'
                : 'Обновить лоты';
            loadButton.querySelector('.material-symbols-rounded').textContent = loading
                ? 'progress_activity'
                : 'refresh';
        };

        const stockKind = draft => formatLotStock(draft).kind;
        const updateHero = counts => {
            let stockTotal = 0;
            let tracked = 0;
            for (const lot of currentLots) {
                const draft = drafts.get(String(lot.id));
                if (!draft?.enabled || draft.mode === 'template' || !Number.isInteger(draft.productCount)) continue;
                stockTotal += draft.productCount;
                tracked += 1;
            }
            const attention = counts.empty + counts.errors;
            metricActive.value.textContent = counts.all ? `${counts.active} из ${counts.all}` : '—';
            metricStock.value.textContent = tracked ? `${stockTotal} шт.` : '—';
            metricAttention.value.textContent = counts.all ? String(attention) : '—';
            metricAttention.element.dataset.tone = attention ? 'warning' : '';
            metricChecked.value.textContent = formatCheckedAt(checkedAt);
            hero.dataset.state = counts.active ? 'on' : 'off';
            if (!counts.all) {
                heroPill.textContent = 'Лоты не загружены';
                delete heroPill.dataset.kind;
            } else if (!counts.active) {
                heroPill.textContent = 'Выключена';
                delete heroPill.dataset.kind;
            } else if (attention) {
                heroPill.textContent = `Требуют внимания: ${attention}`;
                heroPill.dataset.kind = 'warning';
            } else {
                heroPill.textContent = `Работает на ${counts.active} ${pluralLots(counts.active)}`;
                heroPill.dataset.kind = 'success';
            }
        };
        const updateListView = () => {
            const counts = {
                all: currentLots.length,
                active: 0,
                empty: 0,
                errors: 0,
                problems: 0,
                unsaved: 0
            };
            for (const lot of currentLots) {
                const draft = drafts.get(String(lot.id));
                if (!draft) continue;
                if (draft.enabled) counts.active += 1;
                if (stockKind(draft) === 'empty') counts.empty += 1;
                if (stockKind(draft) === 'error') counts.errors += 1;
                if (draft.dirty) counts.unsaved += 1;
            }
            counts.problems = counts.empty + counts.errors;
            for (const [filter, chip] of summaryChips) {
                chip.querySelector('strong').textContent = String(counts[filter] || 0);
                chip.setAttribute('aria-pressed', String(currentFilter === filter));
                chip.classList.toggle('is-active', currentFilter === filter);
            }
            summaryChips.get('problems').dataset.tone = counts.problems ? 'warning' : '';
            scheduleSummaryPill();
            saveAll.textContent = savingAll ? 'Сохраняем…' : `Сохранить все (${counts.unsaved})`;
            saveAll.disabled = savingAll || counts.unsaved === 0;
            saveAll.setAttribute('aria-busy', String(savingAll));
            saveBar.hidden = !savingAll && counts.unsaved === 0;
            saveBarText.textContent = savingAll
                ? 'Сохраняем изменения…'
                : `${counts.unsaved} ${root.FPTPopupUI.pluralize(counts.unsaved, ['лот не сохранён', 'лота не сохранено', 'лотов не сохранено'])}`;
            saveBarShow.hidden = savingAll || currentFilter === 'unsaved';
            lotsCount.textContent = String(counts.all);
            updateHero(counts);

            const search = currentSearch.trim().toLocaleLowerCase('ru');
            for (const [id, row] of rowsById) {
                const draft = drafts.get(id);
                const matchesFilter = currentFilter === 'all'
                    || currentFilter === 'active' && draft?.enabled
                    || currentFilter === 'problems' && ['empty', 'error'].includes(stockKind(draft))
                    || currentFilter === 'unsaved' && draft?.dirty;
                row.hidden = !matchesFilter || (search && !row.dataset.search.includes(search));
            }

            const ordered = Array.from(rowsById.entries());
            if (currentSort === 'title') {
                ordered.sort((a, b) => a[1].dataset.sortTitle.localeCompare(b[1].dataset.sortTitle, 'ru'));
            } else if (currentSort === 'problematic') {
                const rank = id => {
                    const draft = drafts.get(id);
                    if (stockKind(draft) === 'error') return 0;
                    if (stockKind(draft) === 'empty') return 1;
                    if (draft?.dirty) return 2;
                    if (!draft?.enabled) return 3;
                    return 4;
                };
                ordered.sort((a, b) => rank(a[0]) - rank(b[0])
                    || a[1].dataset.sortTitle.localeCompare(b[1].dataset.sortTitle, 'ru'));
            }
            ordered.forEach(([, row]) => list.appendChild(row));

            list.querySelector('.fpt-ad-filter-empty')?.remove();
            const visibleRows = Array.from(rowsById.values()).filter(row => !row.hidden);
            if (currentLots.length && !visibleRows.length) {
                const emptyState = createEmptyState('empty');
                emptyState.classList.add('fpt-ad-filter-empty');
                emptyState.querySelector('strong').textContent = 'Ничего не найдено';
                emptyState.querySelector('.fpt-ad-list-state-copy span').textContent = 'Измените запрос или выберите другой фильтр.';
                list.appendChild(emptyState);
            }
        };

        saveBarShow.addEventListener('click', () => {
            currentFilter = 'unsaved';
            updateListView();
            list.querySelector('.fpt-ad-lot-row:not([hidden])')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        summary.addEventListener('click', event => {
            const chip = event.target.closest('.fpt-ad-summary-chip');
            if (!chip) return;
            currentFilter = chip.dataset.filter || 'all';
            updateListView();
        });
        search.addEventListener('input', () => {
            currentSearch = search.value;
            updateListView();
        });
        sort.addEventListener('change', () => {
            currentSort = sort.value;
            updateListView();
        });

        const saveDraftRow = async (row, draft) => {
            const id = row.dataset.lotId;
            if (!draft.dirty || (draft.mode === 'template' && !draft.text.trim())) return false;
            const submitted = {
                enabled: draft.enabled,
                mode: draft.mode,
                text: draft.text,
                productCount: draft.mode === 'template' ? null : draft.productCount
            };
            const controls = Array.from(row.querySelectorAll('[data-lot-control]'));
            const save = row.querySelector('.fpt-ad-save-button');
            const saveStatus = row.querySelector('.fpt-ad-lot-save-status');
            controls.forEach(control => { control.disabled = true; });
            save.disabled = true;
            setStatus(saveStatus, 'Сохраняем…', 'loading');
            updateListView();
            try {
                const response = await root.fptPopupActions.run(PAGE_ID, 'autoSaveDeliveryLot', { lotId: id, settings: submitted });
                if (response?.success === false) throw new Error(response.error || 'Не удалось сохранить настройки.');
                if (submitted.mode === 'template') {
                    draft.productCount = null;
                } else if (response && Object.prototype.hasOwnProperty.call(response, 'productCount')) {
                    draft.productCount = Number.isInteger(response.productCount) && response.productCount >= 0
                        ? response.productCount
                        : null;
                    draft.stockSnapshot = draft.productCount;
                }
                draft.saved = { ...submitted, productCount: draft.productCount };
                draft.dirty = settingsChanged(draft);
                setStatus(saveStatus, 'Сохранено', 'success');
                updateRowState(row, draft);
                window.setTimeout(() => {
                    if (saveStatus.dataset.kind === 'success') setStatus(saveStatus, '', '');
                }, 1800);
                return true;
            } catch (error) {
                setStatus(saveStatus, error.message || 'Ошибка сохранения', 'error');
                return false;
            } finally {
                controls.forEach(control => { control.disabled = false; });
                updateRowState(row, draft);
                updateListView();
            }
        };
        saveAll.addEventListener('click', async () => {
            if (savingAll) return;
            const unsaved = Array.from(rowsById.values()).filter(row => drafts.get(row.dataset.lotId)?.dirty);
            if (!unsaved.length) return;
            savingAll = true;
            updateListView();
            for (const row of unsaved) {
                const draft = drafts.get(row.dataset.lotId);
                if (draft?.dirty) await saveDraftRow(row, draft);
            }
            savingAll = false;
            updateListView();
        });

        let rulesStatusTimer = null;
        const setRulesStatus = (text, kind) => {
            if (rulesStatusTimer !== null) window.clearTimeout(rulesStatusTimer);
            setStatus(rulesStatus, text, kind);
            if (kind === 'success') {
                rulesStatusTimer = window.setTimeout(() => setStatus(rulesStatus, '', ''), 2600);
            }
        };
        const saveGlobalSetting = async input => {
            const previous = input.checked;
            const key = input.dataset.settingKey === 'restore' ? GLOBAL_SETTINGS.restore : GLOBAL_SETTINGS.disable;
            input.disabled = true;
            try {
                await root.fptPopupActions.run(PAGE_ID, 'saveSettings', { settings: { [key]: input.checked } });
                setRulesStatus(`${input.getAttribute('aria-label')}: настройка сохранена.`, 'success');
            } catch (error) {
                input.checked = !previous;
                setRulesStatus(error.message || 'Не удалось сохранить правило склада.', 'error');
            } finally {
                input.disabled = false;
            }
        };
        rulePanel.addEventListener('change', event => {
            const input = event.target.closest('.fpt-ad-global-switch');
            if (input) saveGlobalSetting(input);
        });

        const renderLots = ({ lots, config = {}, stockCounts = {}, stockErrors = [] }, { cached = false } = {}) => {
            list.replaceChildren();
            currentLots = Array.isArray(lots) ? lots.filter(lot => lot && lot.id != null) : [];
            rowsById = new Map();
            if (!currentLots.length) {
                list.appendChild(createEmptyState('empty'));
                list.querySelector('.fpt-ad-list-state strong').textContent = 'Лоты не найдены';
                list.querySelector('.fpt-ad-list-state-copy span').textContent = 'На аккаунте нет доступных лотов для настройки автовыдачи.';
                setStatus(loadStatus, '', '');
                updateListView();
                return;
            }
            const stockErrorByLot = new Map(stockErrors.map(item => [
                String(item?.lotId || ''),
                typeof item?.error === 'string' && item.error.trim() ? item.error : 'Не удалось обновить остаток.'
            ]));
            for (const lot of currentLots) {
                const id = String(lot.id);
                let draft = drafts.get(id);
                if (!draft) {
                    draft = createLotDraft(config[id] || {});
                    drafts.set(id, draft);
                } else if (!draft.dirty && config[id]) {
                    const previousDraft = draft;
                    draft = createLotDraft(config[id]);
                    if (draft.mode === 'template') draft.stockSnapshot = previousDraft.stockSnapshot;
                    drafts.set(id, draft);
                }
                if (Object.prototype.hasOwnProperty.call(stockCounts, id) && draft.mode !== 'template') {
                    draft.productCount = stockCounts[id];
                    draft.stockSnapshot = draft.productCount;
                }
                draft.stockError = stockErrorByLot.get(id) || '';
                const row = renderLotRow(lot, draft, { run: root.fptPopupActions.run, updateRowState, save: saveDraftRow, onChange: updateListView });
                row.dataset.sortTitle = row.querySelector('.fpt-ad-lot-title').textContent.toLocaleLowerCase('ru');
                row.dataset.search = `${row.dataset.sortTitle} ${row.querySelector('.fpt-ad-lot-category').textContent.toLocaleLowerCase('ru')} ${id}`;
                rowsById.set(id, row);
                list.appendChild(row);
            }
            updateListView();
            if (cached) {
                cacheStatus.textContent = '';
                setStatus(loadStatus, '', '');
                return;
            }
            cacheStatus.textContent = '';
            // Per-lot stock errors are already shown on the rows and in the «Проблемы» tab.
            setStatus(loadStatus, '', '');
        };

        const cachedConfig = initialSettings.fpToolsAutoDeliveryLots || {};
        const cachedValue = initialSettings.fpToolsAutoDeliveryLotsCache;
        const cachedRecord = Array.isArray(cachedValue) ? { lots: cachedValue }
            : cachedValue && typeof cachedValue === 'object' ? cachedValue : {};
        const cachedLots = Array.isArray(cachedRecord.lots) ? cachedRecord.lots : [];
        checkedAt = Number.isFinite(cachedRecord.updatedAt) ? cachedRecord.updatedAt : null;
        const initialLots = cachedLots.length ? cachedLots : Object.keys(cachedConfig).map(id => ({ id, title: `Лот #${id}` }));
        if (initialLots.length) {
            renderLots({
                lots: initialLots,
                config: cachedConfig,
                stockCounts: cachedRecord.stockCounts || {},
                stockErrors: cachedRecord.stockErrors || []
            }, { cached: true });
            hasLoadedLots = cachedLots.length > 0;
            updateLoadButton(false);
        } else {
            updateListView();
        }

        loadButton.addEventListener('click', async () => {
            loadButton.disabled = true;
            loadButton.setAttribute('aria-busy', 'true');
            updateLoadButton(true);
            progressWrap.hidden = false;
            progress.removeAttribute('value');
            progressLabel.textContent = 'Загружаем список лотов…';
            setStatus(loadStatus, 'Обновляем список лотов…', 'loading');
            if (!currentLots.length) list.replaceChildren(createLoadingSkeletons());
            try {
                const result = await root.fptPopupActions.run(PAGE_ID, 'fp-load-delivery-lots-btn', {
                    onProgress: detail => {
                        const total = Math.max(0, Number(detail?.total) || 0);
                        const current = Math.max(0, Number(detail?.current) || 0);
                        progress.max = Math.max(1, total);
                        progress.value = Math.min(current, progress.max);
                        if (detail?.stage === 'stock') {
                            progressLabel.textContent = `Проверяем остатки: ${current} из ${total}…`;
                        } else if (detail?.stage === 'done') {
                            progressLabel.textContent = `Проверено: ${current} из ${total}`;
                        }
                    }
                });
                if (result?.success === false) throw new Error(result.error || 'Не удалось загрузить лоты.');
                if (!Array.isArray(result?.lots)) throw new Error('FunPay не вернул список лотов.');
                checkedAt = Date.now();
                renderLots(result);
                hasLoadedLots = true;
                try {
                    await root.fptPopupActions.run(PAGE_ID, 'saveSettings', {
                        settings: {
                            fpToolsAutoDeliveryLotsCache: {
                                lots: result.lots,
                                stockCounts: result.stockCounts || {},
                                stockErrors: result.stockErrors || [],
                                updatedAt: checkedAt
                            }
                        }
                    });
                } catch (_) {}
            } catch (error) {
                if (!currentLots.length) {
                    list.replaceChildren(createEmptyState('error'));
                    list.querySelector('.fpt-ad-list-state-copy span').textContent = error.message || 'Проверьте подключение к FunPay и повторите загрузку.';
                }
                setStatus(loadStatus, `Не удалось обновить список: ${error.message || 'Проверьте подключение к FunPay.'}`, 'error');
            } finally {
                progressWrap.hidden = true;
                loadButton.disabled = false;
                loadButton.removeAttribute('aria-busy');
                updateLoadButton(false);
            }
        });

        page.addEventListener('pointerdown', event => {
            if (event.target.closest('.fpt-category-header') || event.target.closest('.fpt-ad-help')) return;
            if (!helpPanel.hidden) {
                helpPanel.hidden = true;
                header.helpButton?.setAttribute('aria-expanded', 'false');
            }
        });
    }

    root.FPTAutoDeliveryPage = Object.freeze({ mount, formatStock, previewDeliveryParts });
})(window);
