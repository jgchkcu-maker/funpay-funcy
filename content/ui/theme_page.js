// Themes screen: master switch, theme gallery, live preview and a draft editor for the FunPay theme.
// Edits stay in a draft until "Применить"; every storage read/write goes through fptPopupActions.
(function (root) {
    'use strict';

    const PAGE_ID = 'theme';
    const DEFAULT_BG = 'https://i.ibb.co/ZpS0d56R/PH6-UEvp-Kn-KI.jpg';
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const SHARE_BOT_URL = 'https://t.me/FunPayThemesBot';
    const PREVIEW_FONTS_ID = 'fpt-th-preview-fonts';
    const FONT_OPTIONS = Object.freeze([
        ['Helvetica Neue', 'Системный (Helvetica Neue)'],
        ['Roboto', 'Roboto'],
        ['Open Sans', 'Open Sans'],
        ['Lato', 'Lato'],
        ['Montserrat', 'Montserrat'],
        ['Source Sans Pro', 'Source Sans Pro']
    ]);
    const GOOGLE_FONTS = Object.freeze(FONT_OPTIONS.slice(1).map(option => option[0]));
    const COLOR_FIELDS = Object.freeze([
        { key: 'bgColor1', label: 'Основной', hint: 'Кнопки' },
        { key: 'bgColor2', label: 'Акцентный', hint: 'Заголовки и меню' },
        { key: 'containerBgColor', label: 'Фон блоков', hint: 'Карточки и списки' },
        { key: 'textColor', label: 'Текст', hint: 'Основной шрифт' },
        { key: 'linkColor', label: 'Ссылки', hint: 'Гиперссылки' }
    ]);

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

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function sameTheme(a, b) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            if ((a[key] ?? null) !== (b[key] ?? null)) return false;
        }
        return true;
    }

    function toHex(value, fallback) {
        const raw = String(value ?? '').trim();
        let match = raw.match(/^#?([0-9a-f]{3})$/i);
        if (match) return '#' + match[1].split('').map(char => char + char).join('').toLowerCase();
        match = raw.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
        if (match) return '#' + match[1].toLowerCase();
        return fallback;
    }

    function hexToRgb(hex) {
        const value = parseInt(hex.slice(1), 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }

    function luminance(hex) {
        const [r, g, b] = hexToRgb(hex).map(channel => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(a, b) {
        const first = luminance(a);
        const second = luminance(b);
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    }

    // Mirrors the colour corrections of getCustomThemeCss() so the preview shows what the site will show.
    function effectiveColors(theme) {
        const call = (name, ...args) => (typeof root[name] === 'function' ? root[name](...args) : args[0]);
        return {
            bgColor1: call('fptEnsureButtonColor', theme.bgColor1),
            bgColor2: call('fptEnsureReadableColor', theme.bgColor2, { minContrast: 5.0, targetLightness: 76 }),
            linkColor: call('fptEnsureReadableColor', theme.linkColor, { minContrast: 4.5, targetLightness: 68 }),
            textColor: call('fptEnsureReadableColor', theme.textColor, { minContrast: 5.0, targetLightness: 90 })
        };
    }

    function ensurePreviewFont(font) {
        if (!GOOGLE_FONTS.includes(font)) return;
        let style = document.getElementById(PREVIEW_FONTS_ID);
        if (!style) {
            style = node('style');
            style.id = PREVIEW_FONTS_ID;
            document.head.appendChild(style);
        }
        const rule = `@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;700&display=swap');`;
        if (!style.textContent.includes(rule)) style.textContent += rule;
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
            reader.readAsDataURL(file);
        });
    }

    // The link lives inside the popup: a click on an element outside it would count as "click away" and close the panel.
    function downloadJson(host, fileName, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.hidden = true;
        host.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    function makeSwitch(labelText, checked, onChange, { master = false } = {}) {
        const label = node('label', 'fpt-th-switch-control');
        const input = node('input', 'fpt-th-switch');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', labelText);
        label.append(input, node('span', 'fpt-th-switch-track'));
        const element = node('div', 'fpt-th-switch-line');
        if (master) element.classList.add('fpt-th-master-switch');
        element.appendChild(label);
        input.addEventListener('change', () => {
            if (onChange) onChange(input.checked, input);
        });
        return {
            element,
            input,
            setChecked(value) {
                input.checked = !!value;
            }
        };
    }

    function createCard({ iconName, title, description }) {
        const card = node('section', 'fpt-th-card');
        // A div on purpose: the site theme styles bare `header` elements with a dark background.
        const head = node('div', 'fpt-th-card-head');
        const iconWrap = node('span', 'fpt-th-card-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-th-card-copy');
        copy.append(node('h2', 'fpt-th-card-title', title));
        if (description) copy.appendChild(node('p', 'fpt-th-card-description', description));
        head.append(iconWrap, copy);
        const body = node('div', 'fpt-th-card-body');
        card.append(head, body);
        return { card, head, body };
    }

    function createButton(className, iconName, label) {
        const button = node('button', className);
        button.type = 'button';
        if (iconName) button.appendChild(icon(iconName));
        if (label) button.appendChild(node('span', 'fpt-th-button-label', label));
        return button;
    }

    function createSlider(spec, ctx) {
        const { key, label, min, max, step = 1, unit = '', scale = 1 } = spec;
        const id = `fpt-th-${key}`;
        const element = node('div', 'fpt-th-slider');
        const head = node('label', 'fpt-th-slider-head');
        head.htmlFor = id;
        const value = node('output', 'fpt-th-slider-value');
        value.htmlFor = id;
        head.append(node('span', 'fpt-th-slider-label', label), value);
        const input = node('input', 'fpt-th-range');
        input.type = 'range';
        input.id = id;
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        element.append(head, input);
        input.addEventListener('input', () => ctx.edit({ [key]: Number(input.value) / scale }));

        function sync() {
            const raw = Number(ctx.draft()[key]);
            const shown = Math.min(max, Math.max(min, Math.round((Number.isFinite(raw) ? raw : min) * scale)));
            const text = `${shown}${unit === '%' ? '%' : unit ? ' ' + unit : ''}`;
            if (Number(input.value) !== shown) input.value = String(shown);
            value.textContent = text;
            input.setAttribute('aria-valuetext', text);
            input.style.setProperty('--fpt-th-fill', `${((shown - min) / (max - min)) * 100}%`);
        }
        return { element, input, sync };
    }

    function createSwatch(spec, ctx) {
        const { key, label, hint } = spec;
        const element = node('label', 'fpt-th-swatch');
        const input = node('input', 'fpt-th-swatch-input');
        input.type = 'color';
        input.setAttribute('aria-label', label);
        const dot = node('span', 'fpt-th-swatch-dot');
        const copy = node('span', 'fpt-th-swatch-copy');
        const hex = node('code', 'fpt-th-swatch-hex');
        const note = node('span', 'fpt-th-swatch-note');
        note.hidden = true;
        copy.append(node('strong', 'fpt-th-swatch-name', label), node('span', 'fpt-th-swatch-hint', hint), note);
        element.append(input, dot, hex, copy);
        input.addEventListener('input', () => ctx.edit({ [key]: input.value }));

        function renderNote(draft, chosen) {
            note.hidden = true;
            note.replaceChildren();
            delete note.dataset.kind;
            if (key === 'textColor') {
                const effective = effectiveColors(draft).textColor;
                const ratio = contrastRatio(toHex(effective, '#ffffff'), toHex(draft.containerBgColor, '#0b0b0b'));
                note.dataset.kind = ratio >= 7 ? 'success' : ratio >= 4.5 ? 'neutral' : 'danger';
                note.title = 'Контраст текста с цветом блоков. Для чтения нужно хотя бы 4,5:1.';
                note.append(icon(ratio >= 4.5 ? 'check_circle' : 'warning'), node('span', '', `Контраст ${ratio.toFixed(1).replace('.', ',')}:1`));
                note.hidden = false;
                return;
            }
            const effective = effectiveColors(draft)[key];
            if (effective && toHex(effective, chosen) !== chosen) {
                note.dataset.kind = 'warning';
                note.title = `Цвет скорректирован для читаемости на FunPay: ${toHex(effective, chosen).toUpperCase()}`;
                const swatch = node('i', 'fpt-th-swatch-fix');
                swatch.style.background = toHex(effective, chosen);
                note.append(swatch, node('span', '', 'Подправлен'));
                note.hidden = false;
            }
        }

        function sync() {
            const draft = ctx.draft();
            const chosen = toHex(draft[key], ctx.defaults()[key] || '#000000');
            if (input.value !== chosen) input.value = chosen;
            dot.style.background = chosen;
            hex.textContent = chosen.toUpperCase();
            renderNote(draft, chosen);
        }
        return { element, input, sync };
    }

    // FunPay button colours (content/theme_buttons.js): an empty value is "auto" - derived from the
    // theme palette, which is how every theme set without these fields gets matching buttons.
    function buttonColors(draft) {
        return typeof root.fptResolveButtonColors === 'function' ? root.fptResolveButtonColors(draft) : null;
    }

    function createButtonSwatch(spec, ctx) {
        const { key, label, hint, variant } = spec;
        const element = node('div', 'fpt-th-btn-swatch');
        const swatch = node('label', 'fpt-th-swatch');
        const input = node('input', 'fpt-th-swatch-input');
        input.type = 'color';
        input.setAttribute('aria-label', label);
        const dot = node('span', 'fpt-th-swatch-dot');
        const hex = node('code', 'fpt-th-swatch-hex');
        const copy = node('span', 'fpt-th-swatch-copy');
        copy.append(node('strong', 'fpt-th-swatch-name', label), node('span', 'fpt-th-swatch-hint', hint));
        swatch.append(input, dot, hex, copy);
        input.addEventListener('input', () => ctx.edit({ [key]: input.value }));
        const auto = makeSwitch(`${label}: авто`, true, checked => {
            if (checked) ctx.edit({ [key]: '' });
            else ctx.edit({ [key]: input.value });
        });
        const autoRow = node('div', 'fpt-th-inline-switch fpt-th-btn-auto');
        autoRow.append(node('span', '', 'Авто из цветов темы'), auto.element);
        element.append(swatch, autoRow);

        function sync() {
            const draft = ctx.draft();
            const custom = toHex(draft[key], '');
            const resolved = buttonColors(draft);
            const shown = custom || toHex(resolved?.[variant]?.bg, '#3a3a46');
            if (input.value !== shown) input.value = shown;
            dot.style.background = shown;
            hex.textContent = custom ? shown.toUpperCase() : `Авто · ${shown.toUpperCase()}`;
            auto.setChecked(!custom);
            element.dataset.auto = custom ? 'false' : 'true';
        }
        return { element, sync };
    }

    function createSegmented(spec, ctx) {
        const { key, label, options } = spec;
        const element = node('div', 'fpt-th-seg');
        element.setAttribute('role', 'radiogroup');
        element.setAttribute('aria-label', label);
        element.appendChild(node('span', 'fpt-th-seg-pill'));
        const buttons = options.map(option => {
            const button = createButton('fpt-th-seg-button', option.icon, option.label);
            button.setAttribute('role', 'radio');
            button.dataset.value = option.value;
            button.addEventListener('click', () => ctx.edit({ [key]: option.value }));
            button.addEventListener('keydown', event => {
                const index = options.findIndex(item => item.value === option.value);
                let next = -1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
                if (next < 0) return;
                event.preventDefault();
                buttons[next].focus();
                ctx.edit({ [key]: options[next].value });
            });
            element.appendChild(button);
            return button;
        });
        function sync() {
            const current = ctx.draft()[key];
            const index = Math.max(0, options.findIndex(option => option.value === current));
            element.dataset.index = String(index);
            buttons.forEach((button, buttonIndex) => {
                const selected = buttonIndex === index;
                button.setAttribute('aria-checked', selected ? 'true' : 'false');
                button.tabIndex = selected ? 0 : -1;
            });
        }
        return { element, sync };
    }

    // A row with an on/off switch whose settings fold out below it.
    function createDisclosure({ iconName, title, description, key, children = [] }, ctx) {
        const element = node('div', 'fpt-th-detail');
        const row = node('div', 'fpt-th-detail-row');
        const iconWrap = node('span', 'fpt-th-detail-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-th-detail-copy');
        copy.append(node('h3', '', title), node('p', '', description));
        const toggle = makeSwitch(title, false, checked => ctx.edit({ [key]: checked }));
        row.append(iconWrap, copy, toggle.element);
        element.appendChild(row);
        let collapse = null;
        if (children.length) {
            collapse = node('div', 'fpt-th-detail-collapse');
            const body = node('div', 'fpt-th-detail-body');
            const inner = node('div', 'fpt-th-detail-inner');
            inner.append(...children);
            body.appendChild(inner);
            collapse.appendChild(body);
            element.appendChild(collapse);
        }
        function sync() {
            const open = !!ctx.draft()[key];
            toggle.setChecked(open);
            element.dataset.open = open ? 'true' : 'false';
            if (collapse) collapse.inert = !open;
        }
        return { element, sync };
    }

    function createPreview() {
        const element = node('aside', 'fpt-th-preview');
        element.setAttribute('aria-label', 'Предпросмотр темы');
        const head = node('div', 'fpt-th-preview-head');
        const badge = node('span', 'fpt-th-pill', 'Как на сайте');
        head.append(node('h2', 'fpt-th-preview-title', 'Предпросмотр'), badge);

        const stage = node('div', 'fpt-th-stage');
        stage.setAttribute('role', 'img');
        stage.setAttribute('aria-label', 'Макет страницы FunPay с выбранными цветами и оформлением');
        const bg = node('div', 'fpt-th-stage-bg');
        const scrim = node('div', 'fpt-th-stage-scrim');
        const circles = node('div', 'fpt-th-stage-circles');
        circles.setAttribute('aria-hidden', 'true');
        [1, 2, 3].forEach(index => circles.appendChild(node('span', `fpt-th-circle fpt-th-circle--${index}`)));

        const site = node('div', 'fpt-th-site');
        const header = node('div', 'fpt-th-site-header');
        const brand = node('span', 'fpt-th-site-brand', 'FunPay');
        const nav = node('span', 'fpt-th-site-nav');
        nav.append(node('span', 'is-active', 'Лоты'), node('span', '', 'Заказы'), node('span', '', 'Чат'));
        header.append(brand, nav, node('span', 'fpt-th-site-button fpt-th-site-button--small', 'Продать'));

        const main = node('div', 'fpt-th-site-main');
        // Chat header controls: the buttons the theme's "Кнопки" card recolours.
        const chatBar = node('div', 'fpt-th-site-chatbar');
        const chatName = node('span', 'fpt-th-site-chatname', 'Покупатель');
        const chatSearch = node('span', 'fpt-th-site-btn fpt-th-site-btn--icon');
        chatSearch.appendChild(icon('search'));
        const chatNotice = node('span', 'fpt-th-site-btn fpt-th-site-btn--active');
        chatNotice.append(icon('check'), node('span', '', 'Включены оповещения'));
        // FunPay's "..." button; the bundled icon font has no horizontal dots glyph.
        const chatMore = node('span', 'fpt-th-site-btn fpt-th-site-btn--icon', '•••');
        chatBar.append(chatName, chatSearch, chatNotice, chatMore);
        main.append(chatBar, node('p', 'fpt-th-site-game', 'Genshin Impact'));
        const list = node('div', 'fpt-th-site-card');
        [
            ['Аккаунт, AR 58, все персонажи', '1 490 ₽'],
            ['Кристаллы Сотворения, 6480 шт.', '5 200 ₽'],
            ['Прохождение Бездны, 36 звёзд', '350 ₽'],
            ['Помощь с событиями и боссами', '220 ₽']
        ].forEach(([title, price]) => {
            const item = node('div', 'fpt-th-site-row');
            item.append(node('span', 'fpt-th-site-row-title', title), node('span', 'fpt-th-site-row-price', price));
            list.appendChild(item);
        });
        const foot = node('div', 'fpt-th-site-foot');
        foot.append(node('span', 'fpt-th-site-text', 'Гарантия сделки'), node('span', 'fpt-th-site-link', 'Подробнее'), node('span', 'fpt-th-site-button', 'Купить'));
        const secondList = node('div', 'fpt-th-site-card');
        [['Золото, 100 000 шт.', '480 ₽'], ['Подписка Brawl Pass', '690 ₽']].forEach(([title, price]) => {
            const item = node('div', 'fpt-th-site-row');
            item.append(node('span', 'fpt-th-site-row-title', title), node('span', 'fpt-th-site-row-price', price));
            secondList.appendChild(item);
        });
        main.append(list, foot, node('p', 'fpt-th-site-game', 'Brawl Stars'), secondList,
            node('p', 'fpt-th-site-text fpt-th-site-text--muted', 'Отзывы покупателей, чат с продавцом и гарантия сделки.'));
        site.append(header, main);
        stage.append(bg, scrim, circles, site);

        const legend = node('p', 'fpt-th-preview-note', 'Макет показывает цвета и форму как они будут на сайте. Фон, шрифт и стекло применятся после кнопки «Применить».');
        element.append(head, stage, legend);

        function update(draft, { active }) {
            const effective = effectiveColors(draft);
            const style = stage.style;
            const original = draft.baseStyle === 'original';
            stage.dataset.base = original ? 'original' : 'custom';
            const image = original ? '' : (draft.bgImage || (active ? DEFAULT_BG : ''));
            style.setProperty('--fpt-th-bg-image', image ? `url("${String(image).replace(/["\\]/g, '\\$&')}")` : 'none');
            style.setProperty('--fpt-th-bg-blur', `${Number(draft.bgBlur) || 0}px`);
            style.setProperty('--fpt-th-bg-brightness', `${Number(draft.bgBrightness) || 100}%`);
            if (original) {
                // Fixed palette of the untouched FunPay page.
                style.setProperty('--fpt-th-primary', '#ff6d15');
                style.setProperty('--fpt-th-accent', '#d9570a');
                style.setProperty('--fpt-th-text', '#2b2b2b');
                style.setProperty('--fpt-th-link', '#2d6bb3');
                style.setProperty('--fpt-th-block', 'rgba(255, 255, 255, 1)');
            } else {
                style.setProperty('--fpt-th-primary', toHex(effective.bgColor1, '#ff6d15'));
                style.setProperty('--fpt-th-accent', toHex(effective.bgColor2, '#f4cf78'));
                style.setProperty('--fpt-th-text', toHex(effective.textColor, '#f0f0f0'));
                style.setProperty('--fpt-th-link', toHex(effective.linkColor, '#2d6bb3'));
                const block = toHex(draft.containerBgColor, '#0b0b0b');
                const [r, g, b] = hexToRgb(block);
                const opacity = Math.min(1, Math.max(0, Number(draft.containerBgOpacity)));
                style.setProperty('--fpt-th-block', `rgba(${r}, ${g}, ${b}, ${Number.isFinite(opacity) ? opacity : 1})`);
            }
            const buttons = buttonColors(draft);
            const regular = !original || buttons?.customRegular ? buttons?.regular : null;
            const activeBtn = !original || buttons?.customActive ? buttons?.active : null;
            // The untouched FunPay page keeps its native grey and green buttons.
            style.setProperty('--fpt-th-btn', regular?.bg || '#e9ecf0');
            style.setProperty('--fpt-th-btn-text', regular?.text || '#2b2b2b');
            style.setProperty('--fpt-th-btn-active', activeBtn?.bg || '#4cae4c');
            style.setProperty('--fpt-th-btn-active-text', activeBtn?.text || '#ffffff');
            style.setProperty('--fpt-th-radius', `${Number(draft.borderRadius) || 0}px`);
            style.setProperty('--fpt-th-font', `'${draft.font}', 'Helvetica Neue', Helvetica, Arial, sans-serif`);
            style.setProperty('--fpt-th-glass-blur', `${Number(draft.glassmorphismBlur) || 0}px`);
            style.setProperty('--fpt-th-scroll-width', `${Number(draft.scrollbarWidth) || 8}px`);
            style.setProperty('--fpt-th-scroll-thumb', toHex(draft.scrollbarThumbColor, '#555555'));
            style.setProperty('--fpt-th-scroll-track', toHex(draft.scrollbarTrackColor, '#222222'));
            const custom = !!draft.enableCircleCustomization;
            style.setProperty('--fpt-th-circle-scale', custom ? String((Number(draft.circleSize) || 100) / 100) : '1');
            style.setProperty('--fpt-th-circle-opacity', custom ? String((Number.isFinite(Number(draft.circleOpacity)) ? Number(draft.circleOpacity) : 100) / 100) : '1');
            style.setProperty('--fpt-th-circle-blur', custom ? `${Number(draft.circleBlur) || 0}px` : '0px');
            stage.dataset.glass = draft.enableGlassmorphism && !original ? 'on' : 'off';
            stage.dataset.scrollbar = draft.enableCustomScrollbar ? 'on' : 'off';
            stage.dataset.separators = draft.enableImprovedSeparators ? 'improved' : 'plain';
            stage.dataset.header = draft.headerPosition === 'bottom' ? 'bottom' : 'top';
            stage.dataset.circles = custom && draft.showCircles === false ? 'hidden' : 'shown';
            ensurePreviewFont(draft.font);
        }

        function setBadge(dirty) {
            badge.textContent = dirty ? 'Черновик' : 'Как на сайте';
            badge.dataset.kind = dirty ? 'warning' : 'neutral';
        }
        return { element, update, setBadge };
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-th-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по темам');
        panel.appendChild(node('h2', '', 'Темы'));
        const list = node('ul');
        [
            'Изменения сначала видны только в предпросмотре. На FunPay они попадают после кнопки «Применить».',
            'Если тема выключена, «Применить» сохранит настройки и включит её.',
            'Цвета текста, ссылок и акцента автоматически подправляются, чтобы их можно было прочитать. Такие цвета помечены.',
            'Экспорт сохраняет текущий черновик в файл .fptheme, импорт загружает файл в черновик.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptThemeMounted === 'true') return;
        page.dataset.fptThemeMounted = 'true';

        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const toast = (message, kind = 'success') => root.FPTPopupUI.showToast(popup, message, kind);

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Темы', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-th');
        const helpAnchor = node('span', 'fpt-th-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }
        page.appendChild(view);

        const state = {
            enabled: false,
            defaults: null,
            committed: null,
            draft: null,
            presetId: null,
            active: false,
            busy: false,
            catalog: { status: 'idle', items: [] }
        };
        try {
            const [defaults, theme, stored] = await Promise.all([
                run('getThemeDefaults'),
                run('exportThemeBtn'),
                run('getSettings', { keys: ['enableCustomTheme'] })
            ]);
            state.defaults = clone(defaults);
            state.committed = { ...clone(defaults), ...clone(theme) };
            state.draft = clone(state.committed);
            state.enabled = stored.enableCustomTheme === true;
        } catch (error) {
            const failure = node('div', 'fpt-th-failure');
            failure.setAttribute('role', 'alert');
            failure.append(icon('error'), node('strong', '', 'Не удалось загрузить настройки темы'),
                node('span', '', 'Закройте панель и откройте её снова. Если ошибка повторится, перезагрузите страницу FunPay.'));
            view.appendChild(failure);
            return;
        }

        const controls = [];
        const ctx = {
            draft: () => state.draft,
            defaults: () => state.defaults,
            edit(patch) {
                Object.assign(state.draft, patch);
                state.presetId = null;
                scheduleRender();
            }
        };
        const track = control => { controls.push(control); return control; };

        // --- Hero ----------------------------------------------------------------------------
        const hero = node('section', 'fpt-th-hero');
        hero.setAttribute('aria-labelledby', 'fpt-th-hero-title');
        const heroIcon = node('span', 'fpt-th-hero-icon');
        heroIcon.appendChild(icon('palette'));
        const heroCopy = node('div', 'fpt-th-hero-copy');
        const heroTitleRow = node('div', 'fpt-th-hero-title-row');
        const heroTitle = node('h2', 'fpt-th-hero-title', 'Своя тема FunPay');
        heroTitle.id = 'fpt-th-hero-title';
        const heroPill = node('span', 'fpt-th-pill', 'Выключена');
        heroTitleRow.append(heroTitle, heroPill);
        const heroDescription = node('p', 'fpt-th-hero-description', '');
        heroCopy.append(heroTitleRow, heroDescription);
        const masterSwitch = makeSwitch('Включить кастомную тему', state.enabled, async (checked, input) => {
            input.disabled = true;
            try {
                await run('saveSettings', { settings: { enableCustomTheme: checked } });
                state.enabled = checked;
                toast(checked ? 'Тема включена.' : 'Тема выключена.', 'success');
            } catch (error) {
                state.enabled = !checked;
                masterSwitch.setChecked(state.enabled);
                toast(error.message || 'Не удалось изменить состояние темы.', 'error');
            } finally {
                input.disabled = false;
                renderHero();
                renderDock();
            }
        }, { master: true });
        const heroMain = node('div', 'fpt-th-hero-main');
        heroMain.append(heroIcon, heroCopy, masterSwitch.element);
        hero.appendChild(heroMain);

        // --- Layout --------------------------------------------------------------------------
        const layout = node('div', 'fpt-th-layout');
        const settings = node('div', 'fpt-th-settings');
        const preview = createPreview();
        const previewColumn = node('div', 'fpt-th-aside');
        previewColumn.appendChild(preview.element);
        layout.append(settings, previewColumn);

        // --- Gallery -------------------------------------------------------------------------
        const gallery = createCard({
            iconName: 'photo_library', title: 'Готовые темы',
            description: 'Выберите основу и доработайте её ниже. Тема попадёт в черновик, на сайт ничего не уйдёт.'
        });
        gallery.card.classList.add('fpt-th-card--gallery');
        const galleryNav = node('div', 'fpt-th-strip-nav');
        const stripPrev = createButton('fpt-th-icon-button', 'chevron_left', '');
        const stripNext = createButton('fpt-th-icon-button', 'chevron_right', '');
        stripPrev.setAttribute('aria-label', 'Прокрутить назад');
        stripNext.setAttribute('aria-label', 'Прокрутить вперёд');
        galleryNav.append(stripPrev, stripNext);
        gallery.head.appendChild(galleryNav);
        const strip = node('div', 'fpt-th-strip');
        strip.setAttribute('role', 'group');
        strip.setAttribute('aria-label', 'Готовые темы');
        gallery.body.appendChild(strip);
        const scrollStrip = direction => strip.scrollBy({ left: direction * Math.max(240, strip.clientWidth * 0.8), behavior: 'smooth' });
        stripPrev.addEventListener('click', () => scrollStrip(-1));
        stripNext.addEventListener('click', () => scrollStrip(1));

        function presetTile({ id, name, meta, art, onPick }) {
            const item = node('div', 'fpt-th-preset-item');
            const button = node('button', 'fpt-th-preset');
            button.type = 'button';
            button.dataset.presetId = id;
            button.setAttribute('aria-pressed', 'false');
            button.appendChild(art);
            const copy = node('span', 'fpt-th-preset-copy');
            copy.append(node('strong', 'fpt-th-preset-name', name), node('span', 'fpt-th-preset-meta', meta));
            button.appendChild(copy);
            button.addEventListener('click', async () => {
                if (button.getAttribute('aria-busy') === 'true') return;
                button.setAttribute('aria-busy', 'true');
                try { await onPick(); } catch (error) { toast(error.message || 'Не удалось загрузить тему.', 'error'); }
                finally { button.removeAttribute('aria-busy'); }
            });
            item.appendChild(button);
            return item;
        }

        function iconArt(iconName, kind) {
            const art = node('span', `fpt-th-preset-art fpt-th-preset-art--${kind}`);
            art.appendChild(icon(iconName));
            return art;
        }

        function imageArt(url) {
            const art = node('span', 'fpt-th-preset-art fpt-th-preset-art--image');
            const fallback = icon('image');
            art.appendChild(fallback);
            if (url) {
                const image = node('img');
                image.alt = '';
                image.loading = 'lazy';
                image.decoding = 'async';
                image.referrerPolicy = 'no-referrer';
                image.addEventListener('load', () => { art.dataset.loaded = 'true'; });
                image.addEventListener('error', () => image.remove());
                image.src = url;
                art.appendChild(image);
            }
            return art;
        }

        function loadIntoDraft(theme, presetId) {
            const known = {};
            Object.keys(state.defaults).forEach(key => { if (theme && theme[key] !== undefined) known[key] = theme[key]; });
            state.draft = { ...clone(state.defaults), ...clone(known) };
            state.presetId = presetId;
            syncAll();
        }

        function renderStrip() {
            strip.replaceChildren();
            strip.appendChild(presetTile({
                id: 'builtin:original', name: 'Оригинальная', meta: 'Как на FunPay',
                art: iconArt('light_mode', 'original'),
                onPick: async () => {
                    state.draft = { ...state.draft, baseStyle: 'original', bgImage: null };
                    state.presetId = 'builtin:original';
                    syncAll();
                }
            }));
            strip.appendChild(presetTile({
                id: 'builtin:dark', name: 'Чёрная', meta: 'Тёмная и спокойная',
                art: iconArt('dark_mode', 'dark'),
                onPick: async () => {
                    const preset = await run('fp-apply-dark-preset', { draftOnly: true });
                    state.draft = { ...state.draft, ...preset };
                    state.presetId = 'builtin:dark';
                    syncAll();
                }
            }));
            strip.appendChild(presetTile({
                id: 'builtin:random', name: 'Случайная', meta: 'Сюрприз из палитры',
                art: iconArt('casino', 'random'),
                onPick: async () => {
                    const random = await run('randomizeThemeBtn', { draftOnly: true });
                    state.draft = { ...state.draft, ...random };
                    state.presetId = null;
                    syncAll();
                }
            }));
            const { status, items } = state.catalog;
            if (status === 'loading' || status === 'idle') {
                for (let index = 0; index < 4; index += 1) {
                    const skeleton = node('div', 'fpt-th-preset-item fpt-th-preset-item--skeleton');
                    skeleton.setAttribute('aria-hidden', 'true');
                    skeleton.append(node('span', 'fpt-th-preset-art'), node('span', 'fpt-th-skeleton-line'), node('span', 'fpt-th-skeleton-line fpt-th-skeleton-line--short'));
                    strip.appendChild(skeleton);
                }
            } else if (status === 'error') {
                const failure = node('div', 'fpt-th-strip-state');
                failure.setAttribute('role', 'alert');
                const retry = createButton('fpt-th-ghost-button', 'refresh', 'Повторить');
                retry.addEventListener('click', loadCatalog);
                failure.append(icon('cloud_off'), node('span', '', 'Каталог тем недоступен. Проверьте подключение.'), retry);
                strip.appendChild(failure);
            } else if (!items.length) {
                const empty = node('div', 'fpt-th-strip-state');
                empty.append(icon('inbox'), node('span', '', 'В каталоге пока нет тем.'));
                strip.appendChild(empty);
            } else {
                items.forEach((theme, index) => {
                    const id = `catalog:${theme.id ?? index}`;
                    strip.appendChild(presetTile({
                        id, name: theme.name || 'Без названия', meta: theme.author ? `Автор: ${theme.author}` : (theme.desc || 'Тема сообщества'),
                        art: imageArt(theme.previewUrl),
                        onPick: async () => {
                            const loaded = await run('applyCurrent', { theme, draftOnly: true });
                            loadIntoDraft({ ...loaded, baseStyle: 'custom' }, id);
                        }
                    }));
                });
            }
            renderPresetSelection();
        }

        function renderPresetSelection() {
            strip.querySelectorAll('.fpt-th-preset').forEach(button => {
                const id = button.dataset.presetId;
                const pressed = id === 'builtin:original' ? state.draft.baseStyle === 'original' : (state.draft.baseStyle !== 'original' && id === state.presetId);
                button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            });
        }

        async function loadCatalog() {
            if (state.catalog.status === 'loading') return;
            state.catalog.status = 'loading';
            renderStrip();
            try {
                const items = await run('getThemeCatalog');
                state.catalog = { status: 'ready', items: Array.isArray(items) ? items : [] };
            } catch (_) {
                state.catalog = { status: 'error', items: [] };
            }
            renderStrip();
        }

        // --- Background ----------------------------------------------------------------------
        const background = createCard({
            iconName: 'wallpaper', title: 'Фон',
            description: 'Картинка за страницей FunPay: PNG, JPG, WebP или GIF до 5 МБ.'
        });
        const bgFile = node('input');
        bgFile.type = 'file';
        bgFile.accept = 'image/*';
        bgFile.hidden = true;
        bgFile.tabIndex = -1;
        bgFile.setAttribute('aria-hidden', 'true');
        const bgDrop = node('div', 'fpt-th-bg-drop');
        bgDrop.tabIndex = 0;
        bgDrop.setAttribute('role', 'button');
        bgDrop.setAttribute('aria-label', 'Загрузить фоновое изображение');
        const bgThumb = node('div', 'fpt-th-bg-thumb');
        const bgOverlay = node('div', 'fpt-th-bg-overlay');
        bgOverlay.append(icon('add_photo_alternate'), node('span', '', 'Перетащите картинку или нажмите'));
        bgDrop.append(bgThumb, bgOverlay);
        const bgStatus = node('p', 'fpt-th-bg-status');
        const bgActions = node('div', 'fpt-th-actions');
        const bgUpload = createButton('fpt-th-button fpt-th-button--primary', 'upload', 'Загрузить');
        const bgRemove = createButton('fpt-th-button', 'delete', 'Убрать');
        const bgPalette = createButton('fpt-th-button', 'auto_fix_high', 'Подобрать цвета по картинке');
        bgActions.append(bgUpload, bgRemove);
        const bgSliders = node('div', 'fpt-th-grid fpt-th-grid--two');
        bgSliders.append(
            track(createSlider({ key: 'bgBlur', label: 'Размытие фона', min: 0, max: 20, unit: 'px' }, ctx)).element,
            track(createSlider({ key: 'bgBrightness', label: 'Яркость фона', min: 20, max: 150, unit: '%' }, ctx)).element
        );
        const bgMain = node('div', 'fpt-th-bg');
        const bgSide = node('div', 'fpt-th-bg-side');
        bgSide.append(bgStatus, bgActions, bgPalette);
        bgMain.append(bgDrop, bgSide);
        background.body.append(bgMain, bgSliders, bgFile);

        async function setBackground(file) {
            if (!file) return;
            if (!/^image\//.test(file.type)) { toast('Выберите файл изображения.', 'error'); return; }
            if (file.size > MAX_IMAGE_BYTES) { toast('Файл слишком большой. Максимум 5 МБ.', 'error'); return; }
            try {
                const dataUrl = await readFileAsDataUrl(file);
                ctx.edit({ bgImage: dataUrl });
            } catch (error) {
                toast(error.message, 'error');
            }
        }
        bgUpload.addEventListener('click', () => bgFile.click());
        bgDrop.addEventListener('click', () => bgFile.click());
        bgDrop.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); bgFile.click(); }
        });
        bgFile.addEventListener('change', async () => {
            await setBackground(bgFile.files && bgFile.files[0]);
            bgFile.value = '';
        });
        ['dragenter', 'dragover'].forEach(name => bgDrop.addEventListener(name, event => {
            event.preventDefault();
            bgDrop.dataset.drag = 'true';
        }));
        ['dragleave', 'drop'].forEach(name => bgDrop.addEventListener(name, event => {
            event.preventDefault();
            delete bgDrop.dataset.drag;
        }));
        bgDrop.addEventListener('drop', event => setBackground(event.dataTransfer && event.dataTransfer.files[0]));
        bgRemove.addEventListener('click', () => ctx.edit({ bgImage: null }));
        bgPalette.addEventListener('click', async () => {
            if (!state.draft.bgImage || bgPalette.getAttribute('aria-busy') === 'true') return;
            bgPalette.setAttribute('aria-busy', 'true');
            bgPalette.disabled = true;
            try {
                const palette = await run('generatePaletteBtn', { draftOnly: true, dataUrl: state.draft.bgImage });
                ctx.edit(palette);
                toast('Цвета подобраны по картинке. Проверьте их в предпросмотре.', 'success');
            } catch (error) {
                toast(error.message || 'Не удалось подобрать цвета по картинке.', 'error');
            } finally {
                bgPalette.removeAttribute('aria-busy');
                renderBackgroundControls();
            }
        });

        function renderBackgroundControls() {
            const custom = !!state.draft.bgImage;
            const image = custom ? state.draft.bgImage : (state.active ? DEFAULT_BG : '');
            bgThumb.style.backgroundImage = image ? `url("${String(image).replace(/["\\]/g, '\\$&')}")` : 'none';
            bgThumb.style.filter = `blur(${Math.min(6, (Number(state.draft.bgBlur) || 0) / 3)}px) brightness(${Number(state.draft.bgBrightness) || 100}%)`;
            bgDrop.dataset.custom = custom ? 'true' : 'false';
            bgStatus.textContent = custom ? 'Используется своя картинка.' : 'Сейчас стоит стандартный фон FunPay Funcy.';
            bgRemove.disabled = !custom;
            bgPalette.disabled = !custom;
            bgPalette.title = custom ? 'Взять цвета темы из загруженной картинки' : 'Сначала загрузите свою картинку';
        }

        // --- Colours -------------------------------------------------------------------------
        const colors = createCard({
            iconName: 'format_color_fill', title: 'Цвета',
            description: 'Нажмите на цвет, чтобы выбрать новый. Нечитаемые цвета сайт подправит сам.'
        });
        const swatches = node('div', 'fpt-th-swatches');
        COLOR_FIELDS.forEach(field => swatches.appendChild(track(createSwatch(field, ctx)).element));
        colors.body.appendChild(swatches);

        // --- Buttons -------------------------------------------------------------------------
        const buttonsCard = createCard({
            iconName: 'smart_button', title: 'Кнопки',
            description: 'Поиск, «Включены оповещения», «…» и другие кнопки FunPay. В режиме «Авто» цвет подбирается под тему.'
        });
        const buttonGrid = node('div', 'fpt-th-grid fpt-th-grid--two');
        [
            { key: 'buttonColor', label: 'Обычные', hint: 'Поиск, меню, серые кнопки', variant: 'regular' },
            { key: 'buttonActiveColor', label: 'Активные', hint: 'Оповещения, успех', variant: 'active' }
        ].forEach(spec => buttonGrid.appendChild(track(createButtonSwatch(spec, ctx)).element));
        buttonsCard.body.appendChild(buttonGrid);

        // --- Shape and font ------------------------------------------------------------------
        const shape = createCard({
            iconName: 'text_fields', title: 'Шрифт и форма',
            description: 'Как выглядят тексты, углы блоков и верхняя панель.'
        });
        const fontField = node('div', 'fpt-th-field');
        const fontLabel = node('label', 'fpt-th-field-label', 'Шрифт');
        fontLabel.htmlFor = 'fpt-th-font';
        const fontSelect = node('select');
        fontSelect.id = 'fpt-th-font';
        fontSelect.setAttribute('aria-label', 'Шрифт');
        FONT_OPTIONS.forEach(([value, text]) => {
            const option = node('option', '', text);
            option.value = value;
            fontSelect.appendChild(option);
        });
        const fontHost = node('div', 'fpt-th-select-host');
        fontHost.appendChild(fontSelect);
        const fontSample = node('p', 'fpt-th-font-sample', 'Aa Быстрый ответ, честная сделка');
        fontField.append(fontLabel, fontHost, fontSample);
        let syncingFont = false;
        fontSelect.addEventListener('change', () => { if (!syncingFont) ctx.edit({ font: fontSelect.value }); });
        track({
            sync() {
                const font = FONT_OPTIONS.some(option => option[0] === state.draft.font) ? state.draft.font : FONT_OPTIONS[0][0];
                if (fontSelect.value !== font) {
                    fontSelect.value = font;
                    // The themed dropdown refreshes its label on "change"; the flag keeps that from editing the draft.
                    syncingFont = true;
                    fontSelect.dispatchEvent(new Event('change'));
                    syncingFont = false;
                }
                fontSample.style.fontFamily = `'${font}', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
                ensurePreviewFont(font);
            }
        });
        const radiusSlider = track(createSlider({ key: 'borderRadius', label: 'Закругление углов', min: 0, max: 30, unit: 'px' }, ctx));
        const positionField = node('div', 'fpt-th-field');
        positionField.append(node('span', 'fpt-th-field-label', 'Верхняя панель'));
        positionField.appendChild(track(createSegmented({
            key: 'headerPosition', label: 'Положение верхней панели',
            options: [
                { value: 'top', label: 'Сверху', icon: 'vertical_align_top' },
                { value: 'bottom', label: 'Снизу', icon: 'vertical_align_bottom' }
            ]
        }, ctx)).element);
        const shapeGrid = node('div', 'fpt-th-grid fpt-th-grid--two');
        shapeGrid.append(fontField, positionField);
        shape.body.append(shapeGrid, radiusSlider.element);
        if (typeof root.FPTPopupUI.enhanceSelect === 'function') root.FPTPopupUI.enhanceSelect(fontSelect, fontHost);

        // --- Blocks --------------------------------------------------------------------------
        const blocks = createCard({
            iconName: 'blur_on', title: 'Блоки',
            description: 'Прозрачность карточек и эффект матового стекла.'
        });
        blocks.body.append(
            track(createSlider({ key: 'containerBgOpacity', label: 'Прозрачность блоков', min: 0, max: 100, unit: '%', scale: 100 }, ctx)).element,
            track(createDisclosure({
                iconName: 'blur_circular', title: 'Эффект матового стекла', key: 'enableGlassmorphism',
                description: 'Блоки размывают всё, что за ними.',
                children: [track(createSlider({ key: 'glassmorphismBlur', label: 'Размытие стекла', min: 0, max: 30, unit: 'px' }, ctx)).element]
            }, ctx)).element
        );

        // --- Details -------------------------------------------------------------------------
        const details = createCard({
            iconName: 'tune', title: 'Детали',
            description: 'Скроллбар, декоративные круги и разделители списков.'
        });
        const scrollColors = node('div', 'fpt-th-grid fpt-th-grid--two');
        const scrollSwatches = [
            { key: 'scrollbarThumbColor', label: 'Ползунок', hint: 'Полоса прокрутки' },
            { key: 'scrollbarTrackColor', label: 'Дорожка', hint: 'Фон полосы' }
        ];
        scrollSwatches.forEach(spec => scrollColors.appendChild(track(createSwatch(spec, ctx)).element));
        const circleVisible = makeSwitch('Показывать круги', true, checked => ctx.edit({ showCircles: checked }));
        const circleVisibleRow = node('div', 'fpt-th-inline-switch');
        circleVisibleRow.append(node('span', '', 'Показывать круги'), circleVisible.element);
        track({ sync() { circleVisible.setChecked(state.draft.showCircles !== false); } });
        const circleGrid = node('div', 'fpt-th-grid fpt-th-grid--three');
        circleGrid.append(
            track(createSlider({ key: 'circleSize', label: 'Размер', min: 50, max: 150, unit: '%' }, ctx)).element,
            track(createSlider({ key: 'circleOpacity', label: 'Прозрачность', min: 0, max: 100, unit: '%' }, ctx)).element,
            track(createSlider({ key: 'circleBlur', label: 'Размытие', min: 0, max: 50, unit: 'px' }, ctx)).element
        );
        details.body.append(
            track(createDisclosure({
                iconName: 'swap_vert', title: 'Свой скроллбар', key: 'enableCustomScrollbar',
                description: 'Цвет и толщина полосы прокрутки на сайте.',
                children: [scrollColors, track(createSlider({ key: 'scrollbarWidth', label: 'Ширина', min: 2, max: 20, unit: 'px' }, ctx)).element]
            }, ctx)).element,
            track(createDisclosure({
                iconName: 'bubble_chart', title: 'Декоративные круги', key: 'enableCircleCustomization',
                description: 'Размер, прозрачность и размытие кругов на главной.',
                children: [circleVisibleRow, circleGrid]
            }, ctx)).element,
            track(createDisclosure({
                iconName: 'horizontal_rule', title: 'Мягкие разделители', key: 'enableImprovedSeparators',
                description: 'Светящиеся линии между строками списков.'
            }, ctx)).element
        );

        // --- Tools ---------------------------------------------------------------------------
        const tools = createCard({
            iconName: 'handyman', title: 'Инструменты',
            description: 'Редактор элементов, обмен темами и сброс.'
        });
        const toolsGrid = node('div', 'fpt-th-actions fpt-th-actions--wrap');
        const editorButton = createButton('fpt-th-button', 'auto_fix_normal', 'Редактор элементов');
        const exportButton = createButton('fpt-th-button', 'download', 'Экспорт');
        const importButton = createButton('fpt-th-button', 'upload_file', 'Импорт');
        const shareButton = createButton('fpt-th-button', 'share', 'Поделиться');
        const resetButton = createButton('fpt-th-button fpt-th-button--danger', 'restart_alt', 'Сбросить тему');
        const importFile = node('input');
        importFile.type = 'file';
        importFile.accept = '.fptheme,.json,application/json';
        importFile.hidden = true;
        importFile.tabIndex = -1;
        importFile.setAttribute('aria-hidden', 'true');
        toolsGrid.append(editorButton, exportButton, importButton, shareButton, resetButton);
        tools.body.append(toolsGrid, importFile);

        editorButton.addEventListener('click', async () => {
            try {
                await run('enableMagicStickBtn');
                popup.classList.remove('active');
            } catch (error) {
                toast(error.message || 'Не удалось запустить редактор.', 'error');
            }
        });
        importButton.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', async () => {
            const file = importFile.files && importFile.files[0];
            importFile.value = '';
            if (!file) return;
            try {
                const theme = await run('importThemeBtn', { file, draftOnly: true });
                loadIntoDraft(theme, null);
                toast('Тема загружена в черновик. Нажмите «Применить», чтобы включить её на сайте.', 'success');
            } catch (error) {
                toast(error instanceof SyntaxError ? 'Файл повреждён или не является темой.' : (error.message || 'Не удалось импортировать тему.'), 'error');
            }
        });

        function dialogButton(label, className) {
            const button = node('button', `fpt-lot-dialog-button ${className || ''}`.trim(), label);
            button.type = 'button';
            return button;
        }

        exportButton.addEventListener('click', () => {
            const dialog = root.FPTPopupUI.createDialog(popup, 'Экспорт темы', {
                description: 'Сохраним текущий черновик в файл .fptheme. Его можно импортировать позже или отправить другому человеку.'
            });
            const label = node('label', 'fpt-th-field-label', 'Название темы');
            label.htmlFor = 'fpt-th-export-name';
            const input = node('input');
            input.id = 'fpt-th-export-name';
            input.type = 'text';
            input.maxLength = 60;
            input.value = 'Моя тема';
            dialog.body.append(label, input);
            const cancel = dialogButton('Отмена');
            const save = dialogButton('Скачать файл', 'fpt-lot-dialog-button--primary');
            dialog.footer.append(cancel, save);
            const submit = () => {
                const name = input.value.trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '_');
                if (!name) { input.focus(); return; }
                downloadJson(popup, `${name}.fptheme`, state.draft);
                dialog.close();
                toast(`Тема «${input.value.trim()}» сохранена в файл.`, 'success');
            };
            cancel.addEventListener('click', () => dialog.close());
            save.addEventListener('click', submit);
            input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
        });

        shareButton.addEventListener('click', () => {
            const dialog = root.FPTPopupUI.createDialog(popup, 'Поделиться темой', {
                description: 'Экспортируйте тему в файл и отправьте его телеграм-боту. Бот даст ссылку на тему или выложит её в общий доступ.'
            });
            const link = node('a', 'fpt-lot-dialog-button fpt-lot-dialog-button--primary fpt-th-link-button', 'Открыть @FunPayThemesBot');
            link.href = SHARE_BOT_URL;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            const close = dialogButton('Закрыть');
            close.addEventListener('click', () => dialog.close());
            dialog.footer.append(close, link);
        });

        resetButton.addEventListener('click', () => {
            const dialog = root.FPTPopupUI.createDialog(popup, 'Сбросить тему?', {
                description: 'Тема вернётся к оригинальному виду FunPay: обои, цвета, шрифт и остальные настройки оформления сбросятся. Включение темы не изменится. Файлы, которые вы экспортировали раньше, останутся у вас.'
            });
            const cancel = dialogButton('Отмена');
            const confirmButton = dialogButton('Сбросить', 'fpt-lot-dialog-button--danger');
            dialog.footer.append(cancel, confirmButton);
            cancel.addEventListener('click', () => dialog.close());
            confirmButton.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    const defaults = await run('resetThemeBtn');
                    state.committed = { ...clone(state.defaults), ...clone(defaults) };
                    state.draft = clone(state.committed);
                    state.presetId = null;
                    dialog.setBusy(false);
                    dialog.close();
                    syncAll();
                    toast('Настройки темы сброшены.', 'success');
                } catch (error) {
                    dialog.setBusy(false);
                    toast(error.message || 'Не удалось сбросить тему.', 'error');
                }
            });
        });

        // --- Action dock ---------------------------------------------------------------------
        const dock = node('div', 'fpt-th-dock');
        dock.dataset.open = 'false';
        dock.setAttribute('role', 'region');
        dock.setAttribute('aria-label', 'Применение изменений темы');
        dock.inert = true;
        const dockText = node('p', 'fpt-th-dock-text');
        dockText.append(icon('edit_note'), node('span', '', 'Есть неприменённые изменения'));
        const dockActions = node('div', 'fpt-th-dock-actions');
        const cancelButton = createButton('fpt-th-button', 'undo', 'Отменить');
        const applyButton = createButton('fpt-th-button fpt-th-button--primary fpt-th-apply', 'check', 'Применить');
        dockActions.append(cancelButton, applyButton);
        dock.append(dockText, dockActions);
        const dockSlot = node('div', 'fpt-th-dock-slot');
        dockSlot.appendChild(dock);

        cancelButton.addEventListener('click', () => {
            if (state.busy) return;
            state.draft = clone(state.committed);
            state.presetId = null;
            syncAll();
        });
        applyButton.addEventListener('click', async () => {
            if (state.busy || sameTheme(state.draft, state.committed)) return;
            state.busy = true;
            renderDock();
            const turningOn = !state.enabled;
            const payload = { fpToolsTheme: clone(state.draft) };
            if (turningOn) payload.enableCustomTheme = true;
            try {
                await run('saveSettings', { settings: payload });
                state.committed = clone(state.draft);
                if (turningOn) {
                    state.enabled = true;
                    masterSwitch.setChecked(true);
                }
                toast(turningOn ? 'Тема применена и включена.' : 'Тема применена.', 'success');
            } catch (error) {
                toast(error.message || 'Не удалось применить тему. Возможно, картинка слишком большая.', 'error');
            } finally {
                state.busy = false;
                syncAll();
            }
        });

        // --- Render --------------------------------------------------------------------------
        settings.append(gallery.card, background.card, colors.card, buttonsCard.card, shape.card, blocks.card, details.card, tools.card);
        view.append(hero, layout, dockSlot);
        view.setAttribute('data-ready', 'true');

        function renderHero() {
            const dirty = !sameTheme(state.draft, state.committed);
            hero.dataset.state = state.enabled ? 'on' : 'off';
            heroPill.textContent = dirty ? 'Есть неприменённые изменения' : state.enabled ? 'Включена' : 'Выключена';
            heroPill.dataset.kind = dirty ? 'warning' : state.enabled ? 'success' : 'neutral';
        }

        function renderDock() {
            const dirty = !sameTheme(state.draft, state.committed);
            const open = dirty || state.busy;
            dock.dataset.open = open ? 'true' : 'false';
            view.dataset.dirty = open ? 'true' : 'false';
            dock.inert = !open;
            applyButton.disabled = state.busy;
            cancelButton.disabled = state.busy;
            applyButton.setAttribute('aria-busy', state.busy ? 'true' : 'false');
            const label = applyButton.querySelector('.fpt-th-button-label');
            label.textContent = state.busy ? 'Применяем…' : state.enabled ? 'Применить' : 'Применить и включить';
            preview.setBadge(dirty);
        }

        let frame = 0;
        function scheduleRender() {
            if (frame) return;
            const tick = () => { frame = 0; syncAll(); };
            frame = typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame(tick) : setTimeout(tick, 16);
        }

        // In the original FunPay look there is no wallpaper or recolouring, so those cards are locked.
        const lockable = [background, colors, blocks].map(card => {
            const note = node('p', 'fpt-th-lock-note');
            note.append(icon('lock'), node('span', '', 'Недоступно в оригинальном виде. Выберите готовую тему, чтобы менять фон и цвета.'));
            card.card.insertBefore(note, card.body);
            return card;
        });
        function renderBase() {
            const original = state.draft.baseStyle === 'original';
            lockable.forEach(({ card, body }) => {
                card.dataset.locked = original ? 'true' : 'false';
                body.inert = original;
                body.setAttribute('aria-hidden', original ? 'true' : 'false');
            });
            heroDescription.textContent = original
                ? 'Оригинальный вид FunPay: свои шрифт, закругления и детали без обоев и перекраски.'
                : 'Цвета, фон, шрифт и форма блоков. Настройте тему в предпросмотре и примените её на сайте одним нажатием.';
        }

        function syncAll() {
            controls.forEach(control => control.sync && control.sync());
            renderBase();
            preview.update(state.draft, { active: state.active });
            renderBackgroundControls();
            renderPresetSelection();
            renderHero();
            renderDock();
        }

        // Network requests (default wallpaper, theme catalogue) wait until the page is actually opened.
        const activate = () => {
            if (state.active) return;
            state.active = true;
            syncAll();
            loadCatalog();
        };
        if (page.classList.contains('active')) {
            activate();
        } else {
            renderStrip();
            const observer = new MutationObserver(() => {
                if (!page.isConnected) { observer.disconnect(); return; }
                if (page.classList.contains('active')) { observer.disconnect(); activate(); }
            });
            observer.observe(page, { attributes: true, attributeFilter: ['class'] });
        }
        syncAll();
    }

    root.FPTThemePage = Object.freeze({ mount, effectiveColors, contrastRatio, toHex, sameTheme });
})(window);
