// Effects screen: live preview, cursor particles and a custom cursor image.
// Every change is saved at once through fptPopupActions; cursor_fx.js picks it up from storage.
(function (root) {
    'use strict';

    const PAGE_ID = 'effects';
    const KEYS = Object.freeze({ fx: 'fpToolsCursorFx', cursor: 'fpToolsCustomCursor' });
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    const SAVE_DELAY_MS = 250;
    const FX_TYPES = Object.freeze([
        { value: 'sparkle', label: 'Искры', icon: 'auto_awesome', hint: 'Разлетаются во все стороны' },
        { value: 'trail', label: 'След', icon: 'timeline', hint: 'Тянется за курсором' },
        { value: 'snow', label: 'Снег', icon: 'ac_unit', hint: 'Медленно падает вниз' },
        { value: 'blood', label: 'Кровь', icon: 'water_drop', hint: 'Брызги, которые падают' }
    ]);
    const DEFAULT_FX = Object.freeze({ enabled: false, type: 'sparkle', color1: '#ff6b6b', color2: '#1b75bb', rgb: false, count: 50 });
    const DEFAULT_CURSOR = Object.freeze({ enabled: false, image: null, hideSystem: true, size: 32, opacity: 100 });
    const CURSOR_SIZE = Object.freeze({ min: 16, max: 128 });
    const CURSOR_OPACITY = Object.freeze({ min: 10, max: 100 });

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

    function clamp(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, Math.round(number)));
    }

    function toHex(value, fallback) {
        const raw = String(value ?? '').trim();
        let match = raw.match(/^#?([0-9a-f]{3})$/i);
        if (match) return '#' + match[1].split('').map(char => char + char).join('').toLowerCase();
        match = raw.match(/^#?([0-9a-f]{6})$/i);
        return match ? '#' + match[1].toLowerCase() : fallback;
    }

    function normalizeFx(raw) {
        const value = raw && typeof raw === 'object' ? raw : {};
        return {
            enabled: value.enabled === true,
            type: FX_TYPES.some(type => type.value === value.type) ? value.type : DEFAULT_FX.type,
            color1: toHex(value.color1, DEFAULT_FX.color1),
            color2: toHex(value.color2, DEFAULT_FX.color2),
            rgb: value.rgb === true,
            count: clamp(value.count, 0, 100, DEFAULT_FX.count)
        };
    }

    function normalizeCursor(raw) {
        const value = raw && typeof raw === 'object' ? raw : {};
        const image = typeof value.image === 'string' && /^data:image\//i.test(value.image) ? value.image : null;
        return {
            enabled: value.enabled === true,
            image,
            hideSystem: value.hideSystem !== false,
            size: clamp(value.size, CURSOR_SIZE.min, CURSOR_SIZE.max, DEFAULT_CURSOR.size),
            opacity: clamp(value.opacity, CURSOR_OPACITY.min, CURSOR_OPACITY.max, DEFAULT_CURSOR.opacity)
        };
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
            reader.readAsDataURL(file);
        });
    }

    function makeSwitch(labelText, checked, { master = false } = {}) {
        const label = node('label', 'fpt-ad-switch-control');
        const input = node('input', 'fpt-ad-switch');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', labelText);
        label.append(input, node('span', 'fpt-ad-switch-track'));
        const element = node('div', 'fpt-ad-switch-line');
        if (master) element.classList.add('fpt-fx-master-switch');
        element.appendChild(label);
        const stateLabel = master ? node('span', 'fpt-ad-switch-state', checked ? 'Вкл' : 'Выкл') : null;
        if (stateLabel) element.appendChild(stateLabel);
        return {
            element,
            input,
            setChecked(value) {
                input.checked = !!value;
                if (stateLabel) stateLabel.textContent = input.checked ? 'Вкл' : 'Выкл';
            }
        };
    }

    function createButton(className, iconName, label) {
        const button = node('button', className);
        button.type = 'button';
        if (iconName) button.appendChild(icon(iconName));
        if (label) button.appendChild(node('span', 'fpt-fx-button-label', label));
        return button;
    }

    // A div head on purpose: the site theme styles bare `header` elements with a dark background.
    function createCard({ iconName, title, description, control }) {
        const card = node('section', 'fpt-fx-card');
        const head = node('div', 'fpt-fx-card-head');
        const iconWrap = node('span', 'fpt-fx-card-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-fx-card-copy');
        const titleRow = node('div', 'fpt-fx-card-title-row');
        const heading = node('h2', 'fpt-fx-card-title', title);
        const pill = node('span', 'fpt-fx-pill');
        titleRow.append(heading, pill);
        copy.append(titleRow, node('p', 'fpt-fx-card-description', description));
        head.append(iconWrap, copy);
        if (control) head.appendChild(control.element);
        const body = node('div', 'fpt-fx-card-body');
        card.append(head, body);
        return { card, body, pill };
    }

    function createField(title, hint) {
        const field = node('div', 'fpt-fx-field');
        const head = node('div', 'fpt-fx-field-head');
        head.appendChild(node('h3', 'fpt-fx-field-title', title));
        if (hint) head.appendChild(node('p', 'fpt-fx-field-hint', hint));
        field.appendChild(head);
        return field;
    }

    function createSlider({ id, label, min, max, unit }) {
        const element = node('div', 'fpt-fx-slider');
        const head = node('label', 'fpt-fx-slider-head');
        head.htmlFor = id;
        const value = node('output', 'fpt-fx-slider-value');
        value.htmlFor = id;
        head.append(node('span', 'fpt-fx-slider-label', label), value);
        const input = node('input', 'fpt-fx-range');
        input.type = 'range';
        input.id = id;
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        element.append(head, input);
        return {
            element,
            input,
            sync(raw) {
                const shown = clamp(raw, min, max, min);
                const text = `${shown}${unit === '%' ? '%' : ' ' + unit}`;
                if (Number(input.value) !== shown) input.value = String(shown);
                value.textContent = text;
                input.setAttribute('aria-valuetext', text);
                input.style.setProperty('--fpt-fx-fill', `${((shown - min) / (max - min)) * 100}%`);
            }
        };
    }

    function createSwatch(label) {
        const element = node('label', 'fpt-fx-swatch');
        const input = node('input', 'fpt-fx-swatch-input');
        input.type = 'color';
        input.setAttribute('aria-label', label);
        const dot = node('span', 'fpt-fx-swatch-dot');
        const copy = node('span', 'fpt-fx-swatch-copy');
        const hex = node('code', 'fpt-fx-swatch-hex');
        copy.append(node('strong', 'fpt-fx-swatch-name', label), hex);
        element.append(input, dot, copy);
        return {
            element,
            input,
            sync(color) {
                if (input.value !== color) input.value = color;
                dot.style.background = color;
                hex.textContent = color.toUpperCase();
            }
        };
    }

    function createSwitchRow({ iconName, title, description, control }) {
        const row = node('div', 'fpt-fx-switch-row');
        const iconWrap = node('span', 'fpt-fx-switch-row-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-fx-switch-row-copy');
        copy.append(node('strong', '', title), node('span', '', description));
        row.append(iconWrap, copy, control.element);
        return row;
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-fx-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по эффектам');
        panel.appendChild(node('h2', '', 'Эффекты'));
        const list = node('ul');
        [
            'Частицы и свой курсор работают на всех страницах FunPay и не мешают кликам.',
            'Настройки сохраняются сразу — перезагружать страницу не нужно.',
            'Центр картинки курсора совпадает с точкой клика. Подойдут PNG, GIF, WebP или SVG до 2 МБ.',
            'Если страница подтормаживает на слабом компьютере, уменьшите интенсивность частиц.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    // --- Preview stage ------------------------------------------------------------------------
    // Draws the effect inside the popup with the same physics as the page (FPTCursorFxParticles).
    function createPreview(stage, getState) {
        const canvas = node('canvas', 'fpt-fx-stage-canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const ghost = node('span', 'fpt-fx-stage-cursor');
        ghost.setAttribute('aria-hidden', 'true');
        stage.append(canvas, ghost);
        const ctx = canvas.getContext('2d');
        const particles = [];
        const pointer = { inside: false, x: 0, y: 0 };
        const reduceMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)');
        let frame = null;
        let visible = false;
        let width = 0;
        let height = 0;
        let hue = 0;
        let t = 0;

        function resize() {
            const rect = stage.getBoundingClientRect();
            const ratio = Math.min(2, root.devicePixelRatio || 1);
            width = rect.width;
            height = rect.height;
            canvas.width = Math.max(1, Math.round(width * ratio));
            canvas.height = Math.max(1, Math.round(height * ratio));
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }

        function canRun() {
            return visible && stage.isConnected && root.document.visibilityState !== 'hidden'
                && !!stage.closest('.fp-tools-page-content.active');
        }

        function spawn(config, x, y) {
            const helpers = root.FPTCursorFxParticles;
            if (!helpers) return;
            const amount = helpers.spawnCount(config.count);
            for (let i = 0; i < amount && particles.length < 160; i++) particles.push(helpers.spawn(config, x, y, hue));
        }

        function placeGhost(x, y, cursor) {
            const showImage = cursor.enabled && cursor.image;
            // The page-level custom cursor already follows the real pointer.
            ghost.hidden = pointer.inside;
            ghost.dataset.kind = showImage ? 'image' : 'arrow';
            ghost.style.backgroundImage = showImage ? `url("${cursor.image}")` : '';
            const size = showImage ? cursor.size : 22;
            ghost.style.width = `${size}px`;
            ghost.style.height = `${size}px`;
            ghost.style.opacity = showImage ? String(cursor.opacity / 100) : '';
            ghost.style.transform = showImage
                ? `translate(${x - size / 2}px, ${y - size / 2}px)`
                : `translate(${x - 4}px, ${y - 3}px)`;
        }

        function tick() {
            frame = null;
            if (!canRun()) return;
            const { fx, cursor } = getState();
            hue = (hue + 1) % 360;
            let x = pointer.x;
            let y = pointer.y;
            if (!pointer.inside) {
                // A lazy figure-eight through the middle of the stage.
                t += 0.012;
                x = width / 2 + Math.sin(t) * width * 0.32;
                y = height / 2 + Math.sin(t * 2) * height * 0.24;
            }
            const animate = pointer.inside || !reduceMotion?.matches;
            // When the real effect is on, the page layer already draws particles under the real pointer.
            if (animate && !(pointer.inside && fx.enabled)) spawn(fx, x, y);
            placeGhost(x, y, cursor);

            ctx.clearRect(0, 0, width, height);
            const helpers = root.FPTCursorFxParticles;
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                if (!helpers || !helpers.step(particle)) {
                    particles.splice(i, 1);
                    continue;
                }
                helpers.draw(ctx, particle);
            }
            ctx.globalAlpha = 1;
            if (animate || particles.length) frame = root.requestAnimationFrame(tick);
        }

        function start() {
            if (frame === null && canRun()) frame = root.requestAnimationFrame(tick);
        }

        stage.addEventListener('pointermove', event => {
            const rect = stage.getBoundingClientRect();
            pointer.inside = true;
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            stage.dataset.pointer = 'inside';
            start();
        });
        stage.addEventListener('pointerleave', () => {
            pointer.inside = false;
            delete stage.dataset.pointer;
            start();
        });

        if (typeof ResizeObserver === 'function') new ResizeObserver(() => { resize(); start(); }).observe(stage);
        if (typeof IntersectionObserver === 'function') {
            new IntersectionObserver(entries => {
                visible = entries.some(entry => entry.isIntersecting);
                if (visible) { resize(); start(); }
            }).observe(stage);
        } else {
            visible = true;
        }
        resize();
        return { start };
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptEffectsMounted === 'true') return;
        page.dataset.fptEffectsMounted = 'true';

        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const toast = (text, kind = 'success') => root.FPTPopupUI.showToast(popup, text, kind);
        const state = { fx: normalizeFx(null), cursor: normalizeCursor(null) };
        try {
            const stored = await run('getSettings', { keys: Object.values(KEYS) });
            state.fx = normalizeFx(stored[KEYS.fx]);
            state.cursor = normalizeCursor(stored[KEYS.cursor]);
        } catch (_) {}
        const saved = { fx: { ...state.fx }, cursor: { ...state.cursor } };

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Эффекты', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-fx');
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }

        // --- Preview -------------------------------------------------------------------------
        const previewCard = node('section', 'fpt-fx-preview');
        previewCard.setAttribute('aria-labelledby', 'fpt-fx-preview-title');
        const previewHead = node('div', 'fpt-fx-preview-head');
        const previewCopy = node('div', 'fpt-fx-preview-copy');
        const previewTitle = node('h2', 'fpt-fx-preview-title', 'Предпросмотр');
        previewTitle.id = 'fpt-fx-preview-title';
        previewCopy.append(previewTitle, node('p', 'fpt-fx-preview-description', 'Наведите курсор на область — так эффект будет выглядеть на FunPay.'));
        const previewBadges = node('div', 'fpt-fx-preview-badges');
        const fxBadge = node('span', 'fpt-fx-badge');
        const cursorBadge = node('span', 'fpt-fx-badge');
        previewBadges.append(fxBadge, cursorBadge);
        previewHead.append(previewCopy, previewBadges);
        const stage = node('div', 'fpt-fx-stage');
        const stageHint = node('span', 'fpt-fx-stage-hint');
        stageHint.append(icon('touch_app'), node('span', '', 'Наведите курсор, чтобы попробовать'));
        stage.appendChild(stageHint);
        previewCard.append(previewHead, stage);

        // --- Particles -----------------------------------------------------------------------
        const fxSwitch = makeSwitch('Включить эффекты частиц', state.fx.enabled, { master: true });
        const fxCard = createCard({
            iconName: 'auto_awesome', title: 'Частицы за курсором',
            description: 'Лёгкий шлейф из частиц следует за мышью по всем страницам FunPay.',
            control: fxSwitch
        });

        const typeField = createField('Тип эффекта');
        const typeGroup = node('div', 'fpt-fx-types');
        typeGroup.setAttribute('role', 'radiogroup');
        typeGroup.setAttribute('aria-label', 'Тип эффекта');
        const typeButtons = FX_TYPES.map(type => {
            const button = node('button', 'fpt-fx-type');
            button.type = 'button';
            button.dataset.type = type.value;
            button.setAttribute('role', 'radio');
            const iconWrap = node('span', 'fpt-fx-type-icon');
            iconWrap.appendChild(icon(type.icon));
            const copy = node('span', 'fpt-fx-type-copy');
            copy.append(node('strong', 'fpt-fx-type-label', type.label), node('span', 'fpt-fx-type-hint', type.hint));
            button.append(iconWrap, copy);
            typeGroup.appendChild(button);
            return button;
        });
        typeField.appendChild(typeGroup);

        const colorField = createField('Цвета', 'Частицы смешивают два цвета в случайной пропорции.');
        const colorRow = node('div', 'fpt-fx-colors');
        const swatch1 = createSwatch('Цвет 1');
        const swatch2 = createSwatch('Цвет 2');
        const gradient = node('span', 'fpt-fx-gradient');
        gradient.setAttribute('aria-hidden', 'true');
        colorRow.append(swatch1.element, gradient, swatch2.element);
        const rgbSwitch = makeSwitch('Радужный (RGB)', state.fx.rgb);
        const rgbRow = createSwitchRow({
            iconName: 'looks', title: 'Радужный (RGB)',
            description: 'Цвет частиц плавно переливается по кругу вместо двух выбранных.',
            control: rgbSwitch
        });
        const snowNote = node('p', 'fpt-fx-note');
        snowNote.append(icon('info'), node('span', '', 'Снег всегда белый — выбранные цвета действуют на другие эффекты или в радужном режиме.'));
        colorField.append(colorRow, rgbRow, snowNote);

        const countSlider = createSlider({ id: 'fpt-fx-count', label: 'Интенсивность', min: 0, max: 100, unit: '%' });
        const countField = createField('Количество частиц', 'Меньше частиц — легче для слабого компьютера.');
        countField.appendChild(countSlider.element);

        const fxFooter = node('div', 'fpt-fx-card-footer');
        const resetButton = createButton('fpt-fx-ghost-button', 'restart_alt', 'Сбросить частицы');
        resetButton.id = 'resetCursorFxBtn';
        fxFooter.appendChild(resetButton);
        fxCard.body.append(typeField, colorField, countField, fxFooter);

        // --- Custom cursor -------------------------------------------------------------------
        const cursorSwitch = makeSwitch('Включить свой курсор', state.cursor.enabled, { master: true });
        const cursorCard = createCard({
            iconName: 'arrow_selector_tool', title: 'Свой курсор',
            description: 'Замените стрелку мыши на любую картинку — на всех страницах FunPay.',
            control: cursorSwitch
        });
        const imageField = createField('Изображение курсора');
        const drop = node('div', 'fpt-fx-drop');
        const imagePreview = node('span', 'fpt-fx-drop-preview');
        const imageEmpty = icon('add_photo_alternate');
        imagePreview.appendChild(imageEmpty);
        const dropCopy = node('div', 'fpt-fx-drop-copy');
        const dropTitle = node('strong', 'fpt-fx-drop-title');
        dropCopy.append(dropTitle, node('span', 'fpt-fx-drop-hint', 'PNG, GIF, WebP или SVG · до 2 МБ. Можно перетащить файл сюда.'));
        const dropActions = node('div', 'fpt-fx-drop-actions');
        const uploadButton = createButton('fpt-fx-button fpt-fx-button--primary', 'upload', 'Загрузить');
        uploadButton.id = 'uploadCursorImageBtn';
        const removeButton = createButton('fpt-fx-button', 'delete', 'Удалить');
        removeButton.id = 'removeCursorImageBtn';
        const fileInput = node('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/gif,image/webp,image/svg+xml,image/jpeg';
        fileInput.hidden = true;
        fileInput.className = 'fpt-fx-file-input';
        dropActions.append(uploadButton, removeButton, fileInput);
        drop.append(imagePreview, dropCopy, dropActions);
        imageField.appendChild(drop);

        const hideSwitch = makeSwitch('Скрыть системный курсор', state.cursor.hideSystem);
        const hideRow = createSwitchRow({
            iconName: 'visibility_off', title: 'Скрыть системный курсор',
            description: 'Показывать только вашу картинку без стрелки под ней.',
            control: hideSwitch
        });
        const sizeSlider = createSlider({ id: 'fpt-fx-cursor-size', label: 'Размер', min: CURSOR_SIZE.min, max: CURSOR_SIZE.max, unit: 'px' });
        const opacitySlider = createSlider({ id: 'fpt-fx-cursor-opacity', label: 'Непрозрачность', min: CURSOR_OPACITY.min, max: CURSOR_OPACITY.max, unit: '%' });
        const sliders = node('div', 'fpt-fx-sliders');
        sliders.append(sizeSlider.element, opacitySlider.element);
        const cursorWarning = node('p', 'fpt-fx-note fpt-fx-note--warning');
        cursorWarning.append(icon('warning'), node('span', '', 'Курсор включён, но картинка не выбрана — загрузите изображение.'));
        cursorCard.body.append(imageField, hideRow, sliders, cursorWarning);

        view.append(previewCard, fxCard.card, cursorCard.card);
        page.appendChild(view);
        const preview = createPreview(stage, () => state);

        // --- Rendering -----------------------------------------------------------------------
        function renderBadge(badge, on, onText, offText) {
            badge.dataset.kind = on ? 'success' : 'neutral';
            badge.replaceChildren(node('i', 'fpt-fx-badge-dot'), node('span', '', on ? onText : offText));
        }

        function render() {
            const { fx, cursor } = state;
            const type = FX_TYPES.find(item => item.value === fx.type) || FX_TYPES[0];
            view.style.setProperty('--fpt-fx-c1', fx.color1);
            view.style.setProperty('--fpt-fx-c2', fx.color2);
            view.dataset.rgb = fx.rgb ? 'true' : 'false';
            renderBadge(fxBadge, fx.enabled, `Частицы: ${type.label.toLowerCase()}`, 'Частицы выключены');
            const cursorReady = cursor.enabled && !!cursor.image;
            renderBadge(cursorBadge, cursorReady, 'Свой курсор включён', cursor.enabled ? 'Курсор без картинки' : 'Обычный курсор');
            if (cursor.enabled && !cursor.image) cursorBadge.dataset.kind = 'warning';

            fxCard.card.dataset.state = fx.enabled ? 'on' : 'off';
            fxCard.pill.textContent = fx.enabled ? 'Работает' : 'Выключено';
            fxCard.pill.dataset.kind = fx.enabled ? 'success' : 'neutral';
            fxSwitch.setChecked(fx.enabled);
            typeButtons.forEach(button => {
                const selected = button.dataset.type === fx.type;
                button.setAttribute('aria-checked', selected ? 'true' : 'false');
                button.tabIndex = selected ? 0 : -1;
            });
            swatch1.sync(fx.color1);
            swatch2.sync(fx.color2);
            colorRow.dataset.muted = fx.rgb ? 'true' : 'false';
            rgbSwitch.setChecked(fx.rgb);
            snowNote.hidden = !(fx.type === 'snow' && !fx.rgb);
            countSlider.sync(fx.count);

            cursorCard.card.dataset.state = cursorReady ? 'on' : 'off';
            cursorCard.pill.textContent = cursorReady ? 'Работает' : cursor.enabled ? 'Нет картинки' : 'Выключено';
            cursorCard.pill.dataset.kind = cursorReady ? 'success' : cursor.enabled ? 'warning' : 'neutral';
            cursorSwitch.setChecked(cursor.enabled);
            if (cursor.image) imagePreview.style.setProperty('--fpt-fx-image', `url("${cursor.image}")`);
            else imagePreview.style.removeProperty('--fpt-fx-image');
            imagePreview.dataset.empty = cursor.image ? 'false' : 'true';
            imageEmpty.hidden = !!cursor.image;
            dropTitle.textContent = cursor.image ? 'Картинка загружена' : 'Картинка не выбрана';
            uploadButton.querySelector('.fpt-fx-button-label').textContent = cursor.image ? 'Заменить' : 'Загрузить';
            removeButton.disabled = !cursor.image;
            hideSwitch.setChecked(cursor.hideSystem);
            sizeSlider.sync(cursor.size);
            opacitySlider.sync(cursor.opacity);
            cursorWarning.hidden = !(cursor.enabled && !cursor.image);
            preview.start();
        }

        // --- Saving --------------------------------------------------------------------------
        const timers = { fx: null, cursor: null };
        const queues = { fx: Promise.resolve(), cursor: Promise.resolve() };
        const inflight = { fx: 0, cursor: 0 };

        function persist(kind, successText) {
            clearTimeout(timers[kind]);
            timers[kind] = null;
            const next = { ...state[kind] };
            inflight[kind] += 1;
            const write = queues[kind].then(async () => {
                try {
                    await run('saveSettings', { settings: { [KEYS[kind]]: next } });
                    saved[kind] = next;
                    if (successText) toast(successText);
                } catch (error) {
                    state[kind] = { ...saved[kind] };
                    render();
                    toast(error.message || 'Не удалось сохранить настройку.', 'error');
                } finally {
                    inflight[kind] -= 1;
                }
            });
            queues[kind] = write;
            return write;
        }

        function edit(kind, patch, { delay = 0, successText = '' } = {}) {
            const normalize = kind === 'fx' ? normalizeFx : normalizeCursor;
            state[kind] = normalize({ ...state[kind], ...patch });
            render();
            if (delay) {
                clearTimeout(timers[kind]);
                timers[kind] = setTimeout(() => persist(kind), delay);
                return queues[kind];
            }
            return persist(kind, successText);
        }

        async function busy(button, task) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            try {
                await task();
            } catch (error) {
                toast(error.message || 'Не удалось выполнить действие.', 'error');
            } finally {
                button.removeAttribute('aria-busy');
                button.disabled = false;
                render();
            }
        }

        // --- Interactions --------------------------------------------------------------------
        fxSwitch.input.addEventListener('change', () => edit('fx', { enabled: fxSwitch.input.checked }, {
            successText: fxSwitch.input.checked ? 'Эффекты частиц включены.' : 'Эффекты частиц выключены.'
        }));
        typeButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                if (button.dataset.type !== state.fx.type) edit('fx', { type: button.dataset.type });
            });
            button.addEventListener('keydown', event => {
                const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
                if (!step) return;
                event.preventDefault();
                const target = typeButtons[(index + step + typeButtons.length) % typeButtons.length];
                target.focus();
                target.click();
            });
        });
        swatch1.input.addEventListener('input', () => edit('fx', { color1: swatch1.input.value }, { delay: SAVE_DELAY_MS }));
        swatch2.input.addEventListener('input', () => edit('fx', { color2: swatch2.input.value }, { delay: SAVE_DELAY_MS }));
        rgbSwitch.input.addEventListener('change', () => edit('fx', { rgb: rgbSwitch.input.checked }));
        countSlider.input.addEventListener('input', () => edit('fx', { count: Number(countSlider.input.value) }, { delay: SAVE_DELAY_MS }));
        resetButton.addEventListener('click', () => busy(resetButton, async () => {
            clearTimeout(timers.fx);
            await queues.fx;
            await run('resetCursorFxBtn');
            const stored = await run('getSettings', { keys: [KEYS.fx] });
            state.fx = normalizeFx(stored[KEYS.fx]);
            saved.fx = { ...state.fx };
            toast('Настройки частиц сброшены.');
        }));

        cursorSwitch.input.addEventListener('change', () => {
            const enabled = cursorSwitch.input.checked;
            edit('cursor', { enabled }, {
                successText: !enabled ? 'Свой курсор выключен.' : state.cursor.image ? 'Свой курсор включён.' : ''
            });
            if (enabled && !state.cursor.image) fileInput.click();
        });
        hideSwitch.input.addEventListener('change', () => edit('cursor', { hideSystem: hideSwitch.input.checked }));
        sizeSlider.input.addEventListener('input', () => edit('cursor', { size: Number(sizeSlider.input.value) }, { delay: SAVE_DELAY_MS }));
        opacitySlider.input.addEventListener('input', () => edit('cursor', { opacity: Number(opacitySlider.input.value) }, { delay: SAVE_DELAY_MS }));

        async function useFile(file) {
            if (!file) return;
            if (!/^image\//i.test(file.type)) throw new Error('Это не изображение. Выберите PNG, GIF, WebP или SVG.');
            if (file.size > MAX_IMAGE_BYTES) throw new Error('Файл больше 2 МБ. Выберите картинку поменьше.');
            const dataUrl = await readFileAsDataUrl(file);
            clearTimeout(timers.cursor);
            await queues.cursor;
            // Save the full settings first so the page never sees a cursor without size or opacity.
            await run('saveSettings', { settings: { [KEYS.cursor]: { ...state.cursor } } });
            await run('uploadCursorImageBtn', { dataUrl });
            state.cursor = normalizeCursor({ ...state.cursor, image: dataUrl });
            saved.cursor = { ...state.cursor };
            toast(state.cursor.enabled ? 'Картинка курсора загружена.' : 'Картинка загружена. Включите свой курсор, чтобы увидеть её.');
        }

        uploadButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (file) busy(uploadButton, () => useFile(file));
        });
        removeButton.addEventListener('click', () => busy(removeButton, async () => {
            clearTimeout(timers.cursor);
            await queues.cursor;
            await run('removeCursorImageBtn');
            state.cursor = normalizeCursor({ ...state.cursor, image: null });
            saved.cursor = { ...state.cursor };
            toast('Картинка курсора удалена.');
        }));
        ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            drop.dataset.dragover = 'true';
        }));
        ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            if (name === 'dragleave' && drop.contains(event.relatedTarget)) return;
            delete drop.dataset.dragover;
        }));
        drop.addEventListener('drop', event => {
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) busy(uploadButton, () => useFile(file));
        });

        // Changes made elsewhere (another tab, settings import) show up without reopening the panel.
        root.chrome?.storage?.onChanged?.addListener((changes, area) => {
            if (area !== 'local' || !page.isConnected) return;
            let changed = false;
            [['fx', normalizeFx], ['cursor', normalizeCursor]].forEach(([kind, normalize]) => {
                if (!changes[KEYS[kind]] || timers[kind] || inflight[kind]) return;
                const next = normalize(changes[KEYS[kind]].newValue);
                if (JSON.stringify(next) === JSON.stringify(state[kind])) return;
                state[kind] = next;
                saved[kind] = { ...next };
                changed = true;
            });
            if (changed) render();
        });
        root.FPTPopupUI.onPageActivated(page, () => preview.start());

        render();
    }

    root.FPTEffectsPage = Object.freeze({ mount, normalizeFx, normalizeCursor, FX_TYPES, DEFAULT_FX, DEFAULT_CURSOR });
})(window);
