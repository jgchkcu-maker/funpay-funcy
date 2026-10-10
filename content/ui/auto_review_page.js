// Reviews and bonuses share the serialized autoresponder store, but keep independent drafts.
(function (root) {
    'use strict';
    const PAGE_ID = 'auto_review';
    const STORE_KEY = 'fpToolsAutoReplies';
    const RATINGS = [5, 4, 3, 2, 1];
    const VARIABLES = [
        ['{buyername}', 'Имя покупателя'], ['{lotname}', 'Название лота'],
        ['{orderid}', 'Номер заказа'], ['{orderlink}', 'Ссылка на заказ'],
        ['{welcome}', 'Приветствие'], ['{date}', 'Дата и время']
    ];
    const REVIEW_KEYS = ['autoReviewEnabled', 'reviewTemplates', 'reviewTemplateImages'];
    const BONUS_KEYS = ['bonusForReviewEnabled', 'bonusMode', 'singleBonusText', 'randomBonuses', 'bonusForReviewDelaySec'];
    const clone = value => JSON.parse(JSON.stringify(value));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, source[key]]));

    function normalizeSettings(saved = {}) {
        const source = saved && typeof saved === 'object' ? saved : {};
        const delay = source.bonusForReviewDelaySec;
        const result = {
            autoReviewEnabled: source.autoReviewEnabled === true,
            bonusForReviewEnabled: source.bonusForReviewEnabled === true,
            reviewTemplates: {}, reviewTemplateImages: {},
            bonusMode: source.bonusMode === 'random' ? 'random' : 'single',
            singleBonusText: typeof source.singleBonusText === 'string' ? source.singleBonusText : '',
            randomBonuses: Array.isArray(source.randomBonuses) ? clone(source.randomBonuses) : [],
            bonusForReviewDelaySec: delay === undefined || delay === null ? 4 : delay
        };
        for (const rating of RATINGS) {
            result.reviewTemplates[rating] = typeof source.reviewTemplates?.[rating] === 'string' ? source.reviewTemplates[rating] : '';
            result.reviewTemplateImages[rating] = Array.isArray(source.reviewTemplateImages?.[rating])
                ? source.reviewTemplateImages[rating].filter(image => typeof image === 'string' && image) : [];
        }
        return result;
    }

    function buildReviewPatch(base, draft) {
        const patch = { set: {}, merge: {} };
        if (base.autoReviewEnabled !== draft.autoReviewEnabled) patch.set.autoReviewEnabled = draft.autoReviewEnabled;
        for (const field of ['reviewTemplates', 'reviewTemplateImages']) {
            const changes = {};
            for (const rating of RATINGS) {
                if (!same(base[field][rating], draft[field][rating])) changes[rating] = clone(draft[field][rating]);
            }
            if (Object.keys(changes).length) patch.merge[field] = changes;
        }
        return patch;
    }

    function buildBonusOperations(base, rows) {
        const ops = [];
        const indexes = new Set(rows.filter(row => row.originalIndex !== null).map(row => row.originalIndex));
        // Remove backwards, then update using indexes in the resulting list.
        for (let i = base.length - 1; i >= 0; i--) {
            if (!indexes.has(i)) ops.push({ op: 'remove', index: i, expected: base[i] });
        }
        let index = 0;
        for (const row of rows.filter(row => row.originalIndex !== null)) {
            if (!same(row.text, base[row.originalIndex])) {
                ops.push({ op: 'upsert', index, expected: base[row.originalIndex], value: row.text });
            }
            index++;
        }
        for (const row of rows.filter(row => row.originalIndex === null)) ops.push({ op: 'append', value: row.text });
        return ops;
    }

    function validateReviews(settings) {
        return settings.autoReviewEnabled && !RATINGS.some(rating => settings.reviewTemplates[rating].trim())
            ? 'Добавьте текст хотя бы для одной оценки. Изображения без текста не запускают ответ.' : '';
    }

    function validateBonuses(settings, rows) {
        const value = settings.bonusForReviewDelaySec;
        if (String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
            return 'Укажите задержку — число секунд от 0.';
        }
        if (rows.some(row => typeof row.text !== 'string' || !row.text.trim())) return 'Заполните или удалите пустые варианты бонуса.';
        if (settings.bonusForReviewEnabled) {
            if (settings.bonusMode === 'single' && !settings.singleBonusText.trim()) return 'Введите сообщение с бонусом.';
            if (settings.bonusMode === 'random' && !rows.length) return 'Добавьте хотя бы один вариант бонуса.';
        }
        return '';
    }

    function previewText(text) {
        const values = { buyername: 'Алексей', lotname: 'Игровой аккаунт', orderid: 'DEMO123',
            orderlink: 'https://funpay.com/orders/DEMO123/', welcome: 'Добрый день!', date: '06.10.2026 14:30' };
        return String(text || '').replace(/\{(buyername|lotname|orderid|orderlink|welcome|date)\}/gi, (_, key) => values[key.toLowerCase()]);
    }

    function node(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function icon(name) {
        const el = node('span', 'material-symbols-rounded', name);
        el.setAttribute('aria-hidden', 'true');
        return el;
    }
    function button(label, className = '', iconName) {
        const el = node('button', `fpt-rv-button ${className}`.trim());
        el.type = 'button';
        if (iconName) el.append(icon(iconName));
        el.append(node('span', '', label));
        return el;
    }
    function iconButton(label, name) {
        const el = button('', 'fpt-rv-icon-button', name);
        el.setAttribute('aria-label', label);
        el.title = label;
        return el;
    }
    function variables(textarea, changed, list = VARIABLES) {
        const wrap = node('div', 'fpt-rv-variables');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', 'Вставить переменную');
        for (const [token, label] of list) {
            const chip = button(label, 'fpt-rv-variable', 'add');
            chip.title = token;
            chip.addEventListener('click', () => {
                const start = textarea.selectionStart;
                textarea.setRangeText(token, start, textarea.selectionEnd, 'end');
                textarea.focus();
                changed();
            });
            wrap.append(chip);
        }
        return wrap;
    }
    function metric(iconName, label) {
        const element = node('div', 'fpt-qr-metric fpt-rv-metric');
        const badge = node('span', 'fpt-qr-metric-icon'); badge.append(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        copy.append(node('span', 'fpt-qr-metric-label', label), value);
        element.append(badge, copy);
        return { element, value };
    }
    function field(label, id, rows, placeholder) {
        const wrap = node('div', 'fpt-rv-field');
        const caption = node('label', 'fpt-rv-label', label);
        caption.htmlFor = id;
        const input = node('textarea', 'fpt-rv-textarea fpt-control-field');
        input.id = id;
        input.rows = rows;
        input.placeholder = placeholder;
        wrap.append(caption, input);
        return { wrap, input, caption };
    }
    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptReviewMount) return page?._fptReviewMount;
        const ui = root.FPTPopupUI;
        if (!ui || !root.fptPopupActions) throw new Error('Shared popup components are unavailable.');
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const keysFor = kind => kind === 'reviews' ? REVIEW_KEYS : BONUS_KEYS;
        const state = { base: normalizeSettings(), draft: normalizeSettings(), rows: [], rating: 5,
            loaded: false, saving: null, uploading: false, bonusEditor: null, activeDialog: null,
            latest: null, storageVersion: 0,
            conflict: { reviews: false, bonuses: false } };
        const screen = node('div', 'fpt-reviews');
        const hero = node('section', 'fpt-qr-hero fpt-rv-hero');
        hero.setAttribute('aria-labelledby', 'fpt-rv-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon'); heroIcon.append(icon('reviews'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Благодарность за каждый отзыв'); heroTitle.id = 'fpt-rv-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        const intro = node('p', 'fpt-qr-hero-description fpt-rv-intro', 'Отвечайте на отзывы своим тоном и благодарите покупателей за высокую оценку.');
        heroCopy.append(heroTitleRow, intro);
        heroMain.append(heroIcon, heroCopy);
        const metricAnswers = metric('rate_review', 'Ответов настроено');
        const metricImages = metric('image', 'Изображений в ответах');
        const metricBonus = metric('redeem', 'Бонус за 5★');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricAnswers.element, metricImages.element, metricBonus.element);
        hero.append(heroMain, metrics);
        const grid = node('div', 'fpt-rv-grid');
        screen.append(hero, grid);
        const helpPanel = node('aside', 'fpt-rv-help fpt-ad-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-rv-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по отзывам и бонусам');
        helpPanel.append(node('h2', '', 'Отзывы и бонусы'));
        const helpList = node('ul', '');
        [
            'Для каждой оценки можно сохранить отдельный ответ. Пустой текст — пропустить эту оценку.',
            'К ответу можно прикрепить до 5 изображений, каждое до 1 МБ.',
            'Текст ответа публикуется под отзывом, изображения отправляются покупателю в чат.',
            'Бонус отправляется в чат после отзыва на 5★ с указанной задержкой. В режиме «Случайный из списка» выбирается один вариант.',
            'Ответы и бонусы включаются и сохраняются отдельно.',
            'Напоминание после продажи — одна просьба об отзыве по новому заказу, который расширение выдало и покупатель подтвердил. Любой отзыв отменяет его. Старым завершённым заказам без отзыва можно напомнить вручную.'
        ].forEach(text => helpList.append(node('li', '', text)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Отзывы и бонусы', {
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
        const onHelpOutside = event => {
            if (!helpAnchor.contains(event.target)) closeHelp();
        };
        document.addEventListener('pointerdown', onHelpOutside);
        page.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !helpPanel.hidden) {
                closeHelp(); header.helpButton.focus();
            }
        });
        page.append(screen);
        const blocks = {};

        function current(kind) {
            const settings = clone(state.draft);
            if (kind === 'bonuses') settings.randomBonuses = state.rows.map(row => row.text);
            return pick(settings, keysFor(kind));
        }
        function dirty(kind) { return !same(pick(state.base, keysFor(kind)), current(kind)); }
        function makeBlock(kind, title, description, iconName, enabledKey) {
            const card = node('section', `fpt-rv-card fpt-rv-card--${kind}`);
            card.setAttribute('aria-labelledby', `fpt-rv-${kind}-title`);
            const controls = node('fieldset', 'fpt-rv-controls');
            controls.disabled = true;
            const head = node('div', 'fpt-rv-head');
            const emblem = node('span', 'fpt-rv-emblem'); emblem.append(icon(iconName));
            const copy = node('div', 'fpt-rv-head-copy');
            const heading = node('h3', '', title); heading.id = `fpt-rv-${kind}-title`;
            copy.append(heading, node('p', '', description));
            const toggle = node('label', 'switch fpt-rv-switch');
            const input = node('input', ''); input.type = 'checkbox'; input.setAttribute('role', 'switch');
            input.setAttribute('aria-label', title);
            toggle.append(input, node('span', 'fpt-rv-switch-track'));
            const switchLine = node('div', 'fpt-rv-switch-line');
            switchLine.append(toggle);
            input.addEventListener('change', () => { state.draft[enabledKey] = input.checked; changed(kind); });
            head.append(emblem, copy, switchLine);
            const content = node('div', 'fpt-rv-content');
            const conflict = node('div', 'fpt-rv-conflict'); conflict.hidden = true;
            conflict.append(icon('sync_problem'), node('span', '', 'Настройки изменились в другом окне. Черновик сохранён здесь.'));
            const reload = button('Перечитать', 'fpt-rv-link');
            reload.addEventListener('click', () => confirmReload(kind));
            conflict.append(reload);
            const footer = node('div', 'fpt-rv-footer');
            const status = node('p', 'fpt-rv-status', 'Загрузка настроек…');
            status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
            const actions = node('div', 'fpt-rv-actions');
            const save = button(kind === 'reviews' ? 'Сохранить ответы' : 'Сохранить бонусы', 'fpt-rv-primary', 'check');
            const cancel = button('Отменить изменения', 'fpt-rv-cancel');
            save.addEventListener('click', () => saveBlock(kind));
            cancel.addEventListener('click', () => { if (state.conflict[kind]) confirmReload(kind); else reset(kind); });
            actions.append(cancel, save); footer.append(status, actions);
            controls.append(head, content, conflict, footer); card.append(controls); grid.append(card);
            blocks[kind] = { card, controls, content, input, status, save, cancel, conflict, enabledKey };
            return blocks[kind];
        }
        const reviews = makeBlock('reviews', 'Ответы на отзывы', 'Отдельный ответ для каждой оценки', 'reviews', 'autoReviewEnabled');
        const bonuses = makeBlock('bonuses', 'Бонус за 5★', 'Сообщение покупателю после пятизвёздочного отзыва', 'redeem', 'bonusForReviewEnabled');
        // Третий независимый блок: напоминание об отзыве (review_reminder_block.js).
        if (root.FPTReviewReminderBlock && root.FPTAutomationUI) {
            root.FPTReviewReminderBlock.mount(grid, popup, { button, icon, iconButton, variables, field }).catch(error => console.warn('FunPay Funcy: блок напоминаний не загружен:', error?.message || error));
        }

        const ratings = node('div', 'fpt-rv-ratings');
        ratings.setAttribute('role', 'radiogroup'); ratings.setAttribute('aria-label', 'Оценка покупателя');
        ratings.style.setProperty('--fpt-seg-count', String(RATINGS.length));
        ratings.append(node('span', 'fpt-seg-thumb'));
        const ratingButtons = RATINGS.map((rating, index) => {
            const el = button(`${rating}`, 'fpt-rv-rating');
            const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            star.setAttribute('viewBox', '0 0 24 24');
            star.setAttribute('aria-hidden', 'true');
            star.classList.add('fpt-rv-star');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7Z');
            star.append(path); el.prepend(star);
            el.lastChild.className = 'fpt-rv-rating-num';
            const scale = node('span', 'fpt-rv-rating-stars');
            scale.setAttribute('aria-hidden', 'true');
            scale.textContent = '★'.repeat(rating);
            scale.append(node('span', 'fpt-rv-rating-stars-off', '★'.repeat(5 - rating)));
            const meta = node('span', 'fpt-rv-rating-meta');
            meta.setAttribute('aria-hidden', 'true');
            el.append(scale, meta);
            el.dataset.rating = rating; el.setAttribute('role', 'radio');
            el.addEventListener('click', () => selectRating(rating));
            el.addEventListener('keydown', event => {
                let next = index;
                if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % 5;
                else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + 4) % 5;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = 4;
                else return;
                event.preventDefault(); ratingButtons[next].focus(); selectRating(RATINGS[next]);
            });
            ratings.append(el); return el;
        });
        const reviewEditor = field('Текст ответа на отзыв 5★', 'fpt-rv-review-text', 7, 'Напишите ответ покупателю…');
        const reviewChanged = () => { state.draft.reviewTemplates[state.rating] = reviewEditor.input.value; changed('reviews'); renderRatings(); };
        reviewEditor.input.addEventListener('input', reviewChanged);
        const chips = variables(reviewEditor.input, reviewChanged);
        const attachmentHead = node('div', 'fpt-rv-attachment-head');
        const attach = button('Прикрепить изображение', 'fpt-rv-attach', 'attach_file');
        const file = node('input', ''); file.type = 'file'; file.hidden = true; file.accept = 'image/png,image/jpeg,image/gif,image/webp';
        attach.addEventListener('click', () => file.click());
        const count = node('span', 'fpt-rv-muted');
        attachmentHead.append(attach, count, file);
        const images = node('div', 'fpt-rv-images');
        const skipHint = node('p', 'fpt-rv-hint fpt-rv-skip-hint');
        skipHint.append(icon('info'), node('span', '', 'Пустой текст — пропустить эту оценку.'));
        const editorPane = node('div', 'fpt-rv-editor');
        editorPane.append(reviewEditor.wrap, skipHint, chips, attachmentHead, images);
        reviews.content.append(ratings, editorPane);
        file.addEventListener('change', async () => {
            const selected = file.files[0]; file.value = '';
            if (!selected || state.uploading) return;
            const rating = state.rating;
            if (state.draft.reviewTemplateImages[rating].length >= 5) { status('reviews', 'Можно прикрепить не больше 5 изображений.', 'error'); return; }
            state.uploading = true; update('reviews'); update('bonuses');
            let uploadError = '';
            try {
                const next = await run('handleImageAddClick', { file: selected, images: state.draft.reviewTemplateImages[rating] });
                state.draft.reviewTemplateImages[rating] = next;
                changed('reviews'); renderImages();
            } catch (error) { uploadError = error.message; }
            finally {
                state.uploading = false;
                if (state.latest) sync(state.latest);
                if (uploadError) status('reviews', uploadError, 'error');
                update('reviews'); update('bonuses');
            }
        });

        const modes = node('div', 'fpt-rv-modes'); modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', 'Режим бонуса');
        modes.append(node('span', 'fpt-seg-thumb'));
        const modeButtons = ['single', 'random'].map((mode, index) => {
            const el = button(mode === 'single' ? 'Один бонус' : 'Случайный из списка', 'fpt-rv-mode');
            el.dataset.mode = mode; el.setAttribute('role', 'radio');
            const select = () => { state.draft.bonusMode = mode; renderMode(); changed('bonuses'); };
            el.addEventListener('click', select);
            el.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault(); modeButtons[1 - index].focus(); modeButtons[1 - index].click();
            });
            modes.append(el); return el;
        });
        const single = field('Сообщение с бонусом', 'fpt-rv-single-text', 6, 'Напишите, какой бонус получит покупатель…');
        const singleChanged = () => { state.draft.singleBonusText = single.input.value; changed('bonuses'); };
        single.input.addEventListener('input', singleChanged);
        const singleWrap = node('div', 'fpt-rv-single'); singleWrap.append(single.wrap, variables(single.input, singleChanged));
        const randomWrap = node('div', 'fpt-rv-random');
        const list = node('div', 'fpt-rv-bonus-list');
        const addBonus = button('Добавить вариант', 'fpt-rv-add', 'add');
        addBonus.addEventListener('click', () => editBonus(null));
        randomWrap.append(list, addBonus);
        const delayWrap = node('div', 'fpt-rv-delay');
        const delayCopy = node('div', 'fpt-rv-delay-copy');
        const delayLabel = node('label', 'fpt-rv-label', 'Задержка перед бонусом'); delayLabel.htmlFor = 'fpt-rv-delay';
        delayCopy.append(icon('schedule'), delayLabel);
        delayWrap.title = 'Пауза перед сообщением в чат';
        const delayControl = node('div', 'fpt-rv-delay-control');
        const delay = node('input', 'fpt-rv-number fpt-control-field'); delay.id = 'fpt-rv-delay'; delay.type = 'number'; delay.min = '0'; delay.step = 'any';
        delay.addEventListener('input', () => { state.draft.bonusForReviewDelaySec = delay.value === '' ? '' : Number(delay.value); changed('bonuses'); });
        delayControl.append(ui.createNumberStepper(delay), node('span', 'fpt-rv-muted', 'сек')); delayWrap.append(delayCopy, delayControl);
        const bonusToolbar = node('div', 'fpt-rv-bonus-toolbar');
        bonusToolbar.append(modes, delayWrap);
        bonuses.content.append(bonusToolbar, singleWrap, randomWrap);

        function status(kind, message, type = '') {
            // Success goes to the shared toast; errors and draft state stay next to the save button.
            if (message && type === 'success' && typeof ui.showToast === 'function') {
                ui.showToast(popup, message, type);
                message = dirty(kind) ? 'Есть несохранённые изменения' : '';
                type = message ? 'dirty' : '';
            }
            blocks[kind].status.textContent = message; blocks[kind].status.dataset.kind = type;
        }
        function update(kind) {
            const block = blocks[kind];
            const busy = state.saving === kind || (kind === 'reviews' && state.uploading);
            block.controls.disabled = !state.loaded || busy;
            block.save.disabled = !dirty(kind) || state.conflict[kind] || !!state.saving || state.uploading;
            block.cancel.disabled = !dirty(kind) || busy;
            block.conflict.hidden = !state.conflict[kind];
            block.card.dataset.state = state.draft[block.enabledKey] ? 'on' : 'off';
            attach.disabled = state.uploading || state.draft.reviewTemplateImages[state.rating].length >= 5;
        }
        function renderHero(error) {
            const base = state.base;
            const answers = RATINGS.filter(rating => base.reviewTemplates[rating].trim()).length;
            const photos = RATINGS.reduce((sum, rating) => sum + base.reviewTemplateImages[rating].length, 0);
            const on = base.autoReviewEnabled || base.bonusForReviewEnabled;
            metricAnswers.value.textContent = state.loaded ? `${answers} из 5` : '—';
            metricImages.value.textContent = state.loaded ? String(photos) : '—';
            if (!state.loaded) metricBonus.value.textContent = '—';
            else if (!base.bonusForReviewEnabled) metricBonus.value.textContent = 'Выключен';
            else {
                const variants = base.bonusMode === 'random' ? ` · ${base.randomBonuses.length} ${ui.pluralize(base.randomBonuses.length, ['вариант', 'варианта', 'вариантов'])}` : '';
                metricBonus.value.textContent = `Через ${Number(base.bonusForReviewDelaySec) || 0} сек${variants}`;
            }
            hero.dataset.state = state.loaded && on ? 'on' : 'off';
            if (!state.loaded) {
                heroPill.dataset.kind = error ? 'error' : 'neutral';
                heroPill.textContent = error ? 'Ошибка загрузки' : 'Загрузка…';
            } else {
                heroPill.dataset.kind = on ? 'success' : 'neutral';
                heroPill.textContent = on ? 'Работает' : 'Выключено';
            }
        }
        function changed(kind) {
            status(kind, dirty(kind) ? 'Есть несохранённые изменения' : '', dirty(kind) ? 'dirty' : '');
            update(kind);
        }
        function renderRatings() {
            ratingButtons.forEach((el, index) => {
                const rating = RATINGS[index]; const selected = rating === state.rating;
                if (selected) ratings.style.setProperty('--fpt-seg-index', String(index));
                el.setAttribute('aria-checked', String(selected)); el.tabIndex = selected ? 0 : -1;
                const saved = !!state.base.reviewTemplates[rating].trim();
                el.dataset.saved = String(saved);
                el.setAttribute('aria-label', `${rating} звёзд${saved ? ', ответ задан' : ', без ответа'}`);
                el.title = saved ? 'Ответ задан' : 'Ответ не задан';
                const text = state.draft.reviewTemplates[rating].trim().replace(/\s+/g, ' ');
                const photos = state.draft.reviewTemplateImages[rating].length;
                const meta = el.querySelector('.fpt-rv-rating-meta');
                meta.textContent = (text ? (text.length > 48 ? `${text.slice(0, 47)}…` : text) : 'Без ответа')
                    + (photos ? ` · ${photos} фото` : '');
                meta.dataset.empty = String(!text);
            });
        }
        function renderImages() {
            images.replaceChildren();
            const urls = state.draft.reviewTemplateImages[state.rating];
            count.textContent = `${urls.length} / 5`;
            urls.forEach((url, index) => {
                const item = node('div', 'fpt-rv-image');
                const img = node('img', ''); img.src = url; img.alt = `Изображение ${index + 1}`;
                const remove = iconButton(`Удалить изображение ${index + 1}`, 'close');
                remove.addEventListener('click', () => {
                    state.draft.reviewTemplateImages[state.rating].splice(index, 1);
                    renderImages(); changed('reviews');
                });
                item.append(img, remove); images.append(item);
            });
            renderRatings();
            update('reviews');
        }
        function selectRating(rating) {
            state.rating = rating; renderRatings();
            reviewEditor.caption.textContent = `Текст ответа на отзыв ${rating}★`;
            reviewEditor.input.value = state.draft.reviewTemplates[rating];
            renderImages();
        }
        // Mode labels differ in length, so the thumb follows the selected button's measured box.
        function placeModeThumb() {
            const active = modeButtons.find(el => el.dataset.mode === state.draft.bonusMode);
            if (!active?.offsetWidth) return;
            modes.style.setProperty('--fpt-seg-thumb-x', `${active.offsetLeft - (parseFloat(getComputedStyle(modes).paddingLeft) || 0)}px`);
            modes.style.setProperty('--fpt-seg-thumb-w', `${active.offsetWidth}px`);
        }
        if (typeof ResizeObserver === 'function') new ResizeObserver(placeModeThumb).observe(modes);
        function renderMode() {
            const mode = state.draft.bonusMode;
            placeModeThumb();
            modeButtons.forEach(el => { const selected = el.dataset.mode === mode; el.setAttribute('aria-checked', String(selected)); el.tabIndex = selected ? 0 : -1; });
            singleWrap.hidden = mode !== 'single'; randomWrap.hidden = mode !== 'random';
        }
        function renderList() {
            const active = document.activeElement;
            const activeRow = active?.closest('.fpt-rv-bonus-row');
            const focus = activeRow && list.contains(activeRow)
                ? { index: Number(activeRow.dataset.index), action: active.dataset.action } : null;
            list.replaceChildren();
            if (!state.rows.length) {
                const empty = node('div', 'fpt-rv-empty');
                const emblem = node('span', 'fpt-rv-empty-emblem'); emblem.append(icon('redeem'));
                empty.append(emblem, node('p', 'fpt-rv-label', 'Пока нет вариантов'), node('p', 'fpt-rv-hint', 'Добавьте сообщения — для каждого отзыва будет выбран один случайный бонус.'));
                list.append(empty);
            }
            state.rows.forEach((row, index) => {
                const item = node('div', 'fpt-rv-bonus-row'); item.dataset.index = index;
                const choose = button(row.text || 'Пустой вариант — отредактируйте', 'fpt-rv-bonus-text');
                choose.dataset.action = 'edit-text';
                choose.setAttribute('aria-label', `Редактировать текст варианта ${index + 1}: ${row.text}`);
                choose.addEventListener('click', () => editBonus(index));
                const edit = iconButton(`Редактировать вариант ${index + 1}`, 'edit'); edit.addEventListener('click', () => editBonus(index));
                edit.dataset.action = 'edit';
                const remove = iconButton(`Удалить вариант ${index + 1}`, 'delete');
                remove.dataset.action = 'remove';
                remove.addEventListener('click', () => { state.rows.splice(index, 1); renderList(); changed('bonuses'); });
                item.append(node('span', 'fpt-rv-row-number', String(index + 1).padStart(2, '0')), choose, edit, remove);
                list.append(item);
            });
            if (focus) {
                const target = list.querySelector(`[data-index="${Math.min(focus.index, state.rows.length - 1)}"] [data-action="${focus.action}"]`);
                (target || addBonus).focus({ preventScroll: true });
            }
        }
        function editBonus(index) {
            const dialog = ui.createDialog(popup, index === null ? 'Новый вариант бонуса' : 'Редактировать бонус');
            state.activeDialog = dialog;
            const original = index === null ? null : state.rows[index];
            const editorState = { original };
            state.bonusEditor = editorState;
            const closed = new MutationObserver(() => {
                if (dialog.backdrop.isConnected) return;
                closed.disconnect();
                if (state.bonusEditor === editorState) {
                    state.bonusEditor = null;
                    if (state.latest) sync(state.latest);
                }
            });
            closed.observe(popup, { childList: true });
            const editor = field('Сообщение покупателю', 'fpt-rv-bonus-dialog-text', 6, 'Введите текст бонуса…');
            editor.input.value = index === null ? '' : state.rows[index].text;
            const error = node('p', 'fpt-rv-status'); error.setAttribute('role', 'alert'); error.dataset.kind = 'error';
            dialog.body.append(editor.wrap, variables(editor.input, () => { error.textContent = ''; }), error);
            const cancel = button('Отмена'); cancel.addEventListener('click', () => dialog.close());
            const save = button(index === null ? 'Добавить' : 'Применить', 'fpt-rv-primary');
            save.addEventListener('click', () => {
                if (!editor.input.value.trim()) { error.textContent = 'Введите текст бонуса.'; editor.input.focus(); return; }
                if (index !== null && state.rows[index] !== original) {
                    error.textContent = 'Этот вариант изменился. Закройте редактор и перечитайте настройки.'; return;
                }
                if (index === null) { state.rows.push({ originalIndex: null, text: editor.input.value }); }
                else state.rows[index].text = editor.input.value;
                dialog.close(); renderList(); changed('bonuses');
            });
            dialog.footer.append(cancel, save); dialog.focusInitial();
        }

        function render(kind) {
            blocks[kind].input.checked = state.draft[blocks[kind].enabledKey];
            if (kind === 'reviews') selectRating(state.rating);
            else {
                single.input.value = state.draft.singleBonusText;
                delay.value = state.draft.bonusForReviewDelaySec;
                renderMode(); renderList();
            }
            update(kind);
        }
        function assign(kind, settings) {
            for (const key of keysFor(kind)) state.base[key] = clone(settings[key]);
            for (const key of keysFor(kind)) state.draft[key] = clone(settings[key]);
            if (kind === 'bonuses') state.rows = settings.randomBonuses.map((text, originalIndex) => ({ originalIndex, text: typeof text === 'string' ? text : '' }));
            state.conflict[kind] = false;
            render(kind);
            renderHero();
        }
        function reset(kind) {
            assign(kind, clone(state.base)); changed(kind);
        }
        async function read() {
            const version = state.storageVersion;
            const stored = await run('getSettings', { keys: [STORE_KEY] });
            return state.storageVersion > version ? state.latest : normalizeSettings(stored[STORE_KEY]);
        }
        function sync(settings, exclude) {
            state.latest = settings;
            for (const kind of ['reviews', 'bonuses']) {
                if (kind === exclude || state.saving === kind || (kind === 'reviews' && state.uploading)) continue;
                if (dirty(kind) || (kind === 'bonuses' && state.bonusEditor)) {
                    state.conflict[kind] = state.conflict[kind] || !same(pick(state.base, keysFor(kind)), pick(settings, keysFor(kind)));
                    update(kind);
                } else if (!same(pick(state.base, keysFor(kind)), pick(settings, keysFor(kind)))) {
                    assign(kind, settings); status(kind, '');
                } else update(kind);
            }
        }
        async function reload(kind) {
            try { const settings = await read(); assign(kind, settings); sync(settings, kind); changed(kind); }
            catch (error) { status(kind, error.message || 'Не удалось загрузить настройки.', 'error'); }
        }
        function confirmReload(kind) {
            const dialog = ui.createDialog(popup, 'Перечитать настройки?', { description: 'Несохранённые изменения этого блока будут заменены актуальными настройками.' });
            state.activeDialog = dialog;
            const cancel = button('Оставить черновик'); cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Перечитать', 'fpt-rv-primary');
            confirm.addEventListener('click', async () => { dialog.setBusy(true); await reload(kind); dialog.setBusy(false); dialog.close(); });
            dialog.footer.append(cancel, confirm); dialog.focusInitial();
        }
        async function saveBlock(kind) {
            if (!state.loaded || state.saving || state.uploading || state.conflict[kind] || !dirty(kind)) return;
            const error = kind === 'reviews' ? validateReviews(state.draft) : validateBonuses(state.draft, state.rows);
            if (error) {
                status(kind, error, 'error');
                (kind === 'reviews' ? reviewEditor.input : (String(state.draft.bonusForReviewDelaySec).trim() === '' || Number(state.draft.bonusForReviewDelaySec) < 0 ? delay : single.input)).focus();
                return;
            }
            state.saving = kind; update('reviews'); update('bonuses'); status(kind, 'Сохранение…', 'loading');
            try {
                const preflightVersion = state.storageVersion;
                const stored = await run('getSettings', { keys: [STORE_KEY] });
                const raw = stored[STORE_KEY] || {};
                const latest = normalizeSettings(raw);
                if (state.storageVersion === preflightVersion) state.latest = latest;
                if (!same(pick(state.base, keysFor(kind)), pick(latest, keysFor(kind)))) {
                    state.conflict[kind] = true;
                    status(kind, 'Настройки изменились. Перечитайте их перед сохранением.', 'error');
                    sync(state.latest || latest, kind); return;
                }
                let patch;
                if (kind === 'reviews') patch = buildReviewPatch(state.base, state.draft);
                else {
                    patch = { set: {} };
                    for (const key of BONUS_KEYS.filter(key => key !== 'randomBonuses')) {
                        const value = key === 'bonusForReviewDelaySec' ? Number(state.draft[key]) : state.draft[key];
                        // The engine requires an explicit mode even when the UI default was never stored.
                        if (!same(state.base[key], value) || (key === 'bonusMode' && raw.bonusMode !== value)) patch.set[key] = value;
                    }
                    const operations = buildBonusOperations(state.base.randomBonuses, state.rows);
                    if (operations.length) patch.arrayOps = { randomBonuses: operations };
                }
                patch.expected = {
                    values: Object.fromEntries(keysFor(kind).filter(key => Object.hasOwn(raw, key)).map(key => [key, raw[key]])),
                    absent: keysFor(kind).filter(key => !Object.hasOwn(raw, key))
                };
                const submittedVersion = state.storageVersion;
                const response = await run('saveSettings', { patch });
                const saved = normalizeSettings(response);
                const newest = state.storageVersion > submittedVersion ? state.latest : saved;
                assign(kind, saved); sync(newest, kind); status(kind, 'Изменения сохранены', 'success');
            } catch (failure) {
                if (failure.code === 'STALE_AUTO_REPLY_EDIT') state.conflict[kind] = true;
                status(kind, failure.code === 'STALE_AUTO_REPLY_EDIT' ? 'Настройки изменились. Перечитайте их перед сохранением.' : failure.message || 'Не удалось сохранить. Попробуйте ещё раз.', 'error');
            } finally {
                state.saving = null;
                if (state.latest) sync(state.latest);
                update('reviews'); update('bonuses');
            }
        }
        const onStorage = (changes, area) => {
            if (!page.isConnected) { root.chrome?.storage.onChanged.removeListener(onStorage); return; }
            if (area === 'local' && changes[STORE_KEY]) {
                state.storageVersion++;
                const settings = normalizeSettings(changes[STORE_KEY].newValue);
                if (state.loaded) sync(settings);
                else state.latest = settings;
            }
        };
        const loading = (async () => {
            try {
                const readVersion = state.storageVersion;
                const loaded = await read();
                const settings = state.storageVersion > readVersion ? state.latest : loaded;
                state.loaded = true; state.latest = settings;
                assign('reviews', settings); assign('bonuses', settings);
                status('reviews', ''); status('bonuses', '');
            } catch (error) {
                for (const kind of ['reviews', 'bonuses']) status(kind, error.message || 'Не удалось загрузить настройки.', 'error');
                renderHero(true);
                const retry = button('Повторить загрузку', 'fpt-rv-primary', 'refresh');
                retry.addEventListener('click', async () => {
                    retry.disabled = true;
                    try {
                        const settings = await read(); state.loaded = true; state.latest = settings;
                        assign('reviews', settings); assign('bonuses', settings);
                        changed('reviews'); changed('bonuses'); retry.remove();
                    } catch (failure) { status('reviews', failure.message, 'error'); retry.disabled = false; }
                });
                screen.prepend(retry);
            }
        })();
        page._fptReviewMount = loading;
        root.chrome?.storage.onChanged.addListener(onStorage);
        const disposal = new MutationObserver(() => {
            if (page.isConnected) return;
            document.removeEventListener('pointerdown', onHelpOutside);
            root.chrome?.storage.onChanged.removeListener(onStorage);
            state.activeDialog?.close({ force: true });
            disposal.disconnect();
        });
        disposal.observe(document.body, { childList: true, subtree: true });
        return loading;
    }

    root.FPTAutoReviewPage = Object.freeze({ mount, normalizeSettings, buildReviewPatch, buildBonusOperations,
        validateReviews, validateBonuses, previewText });
})(window);
