// Settings transfer screen: a .fpconfig backup of every Funcy setting, import with a per-section preview,
// and resets of service lists. Data work stays behind the settings_io actions (content/features/settings_io.js).
(function (root) {
    'use strict';
    const PAGE_ID = 'settings_io';
    const CONFIG_MAGIC = 'FPTCONFIG';
    const STALE_DAYS = 30;
    const MAX_FILE_BYTES = 20 * 1024 * 1024;
    const DAY = 86400000;

    // Backup keys grouped the way the sidebar groups the screens. A key matches by exact name or prefix;
    // everything else (new features included — the export takes all keys) lands in «Прочее».
    const SECTIONS = Object.freeze([
        { id: 'theme', label: 'Тема и оформление', icon: 'palette',
            keys: ['fpToolsTheme', 'enableCustomTheme', 'fpToolsHeaderButtonStyles', 'fpToolsLiveStyles', 'fpToolsCursorFx', 'fpToolsCustomCursor', 'fpToolsCustomLabels'] },
        { id: 'replies', label: 'Автоответчик и отзывы', icon: 'smart_toy',
            keys: ['fpToolsAutoReplies', 'fpToolsAutoResponder', 'fpToolsReviewReminders', 'reviewReminders'], prefixes: ['reviewReminder'] },
        { id: 'templates', label: 'Быстрые ответы', icon: 'bolt', keys: ['fpToolsTemplateSettings', 'fpToolsSlashCommands'] },
        { id: 'delivery', label: 'Автовыдача', icon: 'local_shipping',
            keys: ['fpToolsLegacyADModeEnabled', 'fpToolsAutoDisableEnabled'], prefixes: ['fpToolsAutoDelivery', 'fpToolsAutoRestore'] },
        { id: 'bump', label: 'Автоподнятие', icon: 'rocket_launch',
            keys: ['fpToolsSelectiveBumpEnabled', 'fpToolsSelectedBumpCategories', 'fpToolsBumpOnlyAutoDelivery'], prefixes: ['autoBump', 'fpToolsAutoBump', 'fpToolsSmartBump'] },
        { id: 'blacklist', label: 'Чёрный список', icon: 'block', keys: ['fpToolsBlacklist'] },
        { id: 'sounds', label: 'Звуки', icon: 'notifications', keys: ['notificationSound', 'notificationVolume'] },
        { id: 'finance', label: 'Финансы и статистика', icon: 'analytics',
            keys: ['fpToolsCostBasis', 'fpToolsSalesChartPeriod', 'fpToolsPurchasesFilters', 'fpToolsShowUnconfirmed', 'showFinanceStats'],
            prefixes: ['fpToolsStats', 'fptFinance', 'fptLegacyFinance'] },
        { id: 'interface', label: 'Интерфейс и навигация', icon: 'apps',
            keys: ['fpToolsDisabledFeatures', 'showSalesStats', 'hideBalance', 'viewSellersPromo', 'fpToolsPageModes', 'fpToolsPinnedChats', 'fpToolsPinnedLots', 'fpToolsCtxPinnedLots', 'fpToolsQuickGames', 'fpToolsIdentifierEnabled'],
            prefixes: ['fpToolsNav'] },
        { id: 'support', label: 'Поддержка', icon: 'confirmation_number', keys: ['fpToolsSupportAutoTicket'] },
        { id: 'other', label: 'Прочее', icon: 'more_horiz' }
    ]);

    const PRIVATE_DATA = Object.freeze([
        { icon: 'account_circle', label: 'Аккаунты и сессии' },
        { icon: 'key', label: 'Ключи и секреты' },
        { icon: 'event_repeat', label: 'Расписания и цены лотов' },
        { icon: 'cached', label: 'Кэши, мелодии и история покупателей' }
    ]);

    const RESETS = Object.freeze([
        { action: 'fp-reset-autoresponder-btn', count: 'processed', icon: 'mark_chat_read', title: 'Обработанные сообщения',
            hint: 'Автоответчик забудет, на какие сообщения уже ответил, и сможет ответить на них снова.',
            forms: ['сообщение', 'сообщения', 'сообщений'] },
        { action: 'fp-reset-greeted-btn', count: 'greeted', icon: 'waving_hand', title: 'Поприветствованные покупатели',
            hint: 'Приветствие снова уйдёт покупателям, которые его уже получали.',
            forms: ['покупатель', 'покупателя', 'покупателей'] },
        { action: 'fp-reset-pinned-btn', count: 'pinned', icon: 'keep_off', title: 'Закреплённые лоты',
            hint: 'Блок закреплённых лотов в профиле очистится. Сами лоты не изменятся.',
            forms: ['лот', 'лота', 'лотов'] }
    ]);

    function pluralize(count, forms) {
        if (root.FPTPopupUI?.pluralize) return root.FPTPopupUI.pluralize(count, forms);
        const n = Math.abs(Math.trunc(Number(count) || 0));
        if (n % 100 >= 11 && n % 100 <= 14) return forms[2];
        return n % 10 === 1 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 ? forms[1] : forms[2];
    }
    const settingsWord = count => pluralize(count, ['настройка', 'настройки', 'настроек']);

    function sectionOf(key) {
        return SECTIONS.find(section => section.keys?.includes(key) || section.prefixes?.some(prefix => key.startsWith(prefix)))
            || SECTIONS[SECTIONS.length - 1];
    }

    // Non-empty sections in sidebar order: [{ id, label, icon, keys }].
    function classifySettings(settings) {
        const groups = new Map();
        Object.keys(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}).forEach(key => {
            const section = sectionOf(key);
            if (!groups.has(section.id)) groups.set(section.id, []);
            groups.get(section.id).push(key);
        });
        return SECTIONS.filter(section => groups.has(section.id))
            .map(({ id, label, icon }) => ({ id, label, icon, keys: groups.get(id) }));
    }

    function formatBytes(bytes) {
        const value = Math.max(0, Number(bytes) || 0);
        const format = number => number.toLocaleString('ru-RU', { maximumFractionDigits: number < 10 ? 1 : 0 });
        if (value < 1024) return `${Math.round(value)} Б`;
        if (value < 1024 * 1024) return `${format(value / 1024)} КБ`;
        return `${format(value / 1024 / 1024)} МБ`;
    }

    // «сегодня», «вчера», «3 дня назад», then the date itself. Calendar days, not 24-hour spans.
    function formatAgo(timestamp, now = Date.now()) {
        const ts = Number(timestamp) || 0;
        if (!ts) return '';
        const startOf = value => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date.getTime(); };
        const days = Math.round((startOf(now) - startOf(ts)) / DAY);
        if (days <= 0) return 'сегодня';
        if (days === 1) return 'вчера';
        if (days < 30) return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`;
        return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function parseConfigFile(text) {
        let data;
        try {
            data = JSON.parse(String(text ?? ''));
        } catch (_) {
            throw new Error('Файл повреждён или это не файл .fpconfig.');
        }
        if (!data || typeof data !== 'object' || data._magic !== CONFIG_MAGIC) throw new Error('Это не файл настроек FunPay Funcy (.fpconfig).');
        if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('В файле нет настроек.');
        return data;
    }

    function configFileName(date = new Date(), suffix = '') {
        const pad = value => String(value).padStart(2, '0');
        return `funcy-settings${suffix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.fpconfig`;
    }

    function downloadConfig(contents, fileName) {
        const blob = new Blob([JSON.stringify(contents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function node(tag, className, content) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content !== undefined) el.textContent = String(content);
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
    function setButtonLabel(el, label) {
        const span = el.querySelector(':scope > span:not(.material-symbols-rounded)');
        if (span) span.textContent = label;
    }
    function metric(iconName, label) {
        const element = node('div', 'fpt-qr-metric fpt-sio-metric');
        const badge = node('span', 'fpt-qr-metric-icon');
        badge.append(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        copy.append(node('span', 'fpt-qr-metric-label', label), value);
        element.append(badge, copy);
        return { element, value };
    }
    function cardHead(iconName, title, description, titleId) {
        const head = node('div', 'fpt-qr-card-head');
        const emblem = node('span', 'fpt-qr-emblem');
        emblem.append(icon(iconName));
        const copy = node('div', 'fpt-qr-card-copy');
        const heading = node('h3', '', title);
        if (titleId) heading.id = titleId;
        copy.append(heading, node('p', '', description));
        head.append(emblem, copy);
        return head;
    }
    function sectionChip(section, index) {
        const chip = node('span', 'fpt-sio-chip');
        chip.setAttribute('role', 'listitem');
        chip.style.setProperty('--fpt-sio-delay', `${Math.min(index, 12) * 30}ms`);
        chip.title = section.keys.join(', ');
        chip.append(icon(section.icon), node('span', 'fpt-sio-chip-label', section.label), node('span', 'fpt-sio-chip-count', section.keys.length));
        return chip;
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptSettingsIoMount) return page?._fptSettingsIoMount;
        const ui = root.FPTPopupUI;
        if (!ui || typeof ui.ensureCategoryHeader !== 'function' || !root.fptPopupActions) {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const toast = (message, kind = 'success') => ui.showToast?.(popup, message, kind);
        const state = { summary: null, loading: false, loadError: '', imported: null, refreshVersion: 0 };

        // --- Header and help ---------------------------------------------------------------------
        const helpPanel = node('aside', 'fpt-qr-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-sio-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по переносу настроек');
        helpPanel.append(node('h2', '', 'Перенос настроек'));
        const helpList = node('ul');
        [
            'Файл .fpconfig хранит все настройки Funcy: тему, автоответчик, автовыдачу, чёрный список, звуки и остальное.',
            'Аккаунты, ключи, расписания и цены лотов, кэши и своя мелодия в файл не попадают и остаются в этом браузере.',
            'При импорте можно выбрать разделы. Их текущие значения заменятся значениями из файла.',
            'Перед импортом Funcy может сам скачать копию текущих настроек — на случай, если захочется вернуть всё как было.',
            'Большинство настроек применяется после перезагрузки страницы FunPay.'
        ].forEach(text => helpList.append(node('li', '', text)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Перенос настроек', {
            onHelp: event => {
                helpPanel.hidden = !helpPanel.hidden;
                event.currentTarget.setAttribute('aria-expanded', String(!helpPanel.hidden));
            }
        });
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        const closeHelp = () => {
            helpPanel.hidden = true;
            header.helpButton?.setAttribute('aria-expanded', 'false');
        };
        if (header.helpButton) {
            header.helpButton.setAttribute('aria-controls', helpPanel.id);
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
            popup.addEventListener('pointerdown', event => { if (!helpAnchor.contains(event.target)) closeHelp(); });
            page.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !helpPanel.hidden) { closeHelp(); header.helpButton.focus(); }
            });
        }

        const screen = node('div', 'fpt-sio');
        page.append(screen);

        // --- Hero --------------------------------------------------------------------------------
        const hero = node('section', 'fpt-qr-hero fpt-sio-hero');
        hero.setAttribute('aria-labelledby', 'fpt-sio-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.append(icon('sync_alt'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Резервная копия настроек');
        heroTitle.id = 'fpt-sio-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroPill.setAttribute('role', 'status');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Все настройки Funcy в одном файле .fpconfig: сохраните копию или перенесите их на другой компьютер за пару кликов.'));
        heroMain.append(heroIcon, heroCopy);
        const metricCount = metric('tune', 'Настроек в копии');
        const metricSize = metric('save', 'Размер файла');
        const metricLast = metric('history', 'Последняя копия');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricCount.element, metricSize.element, metricLast.element);
        hero.append(heroMain, metrics);

        const banner = node('div', 'fpt-qr-banner');
        banner.setAttribute('role', 'alert');
        banner.hidden = true;
        const bannerText = node('span', 'fpt-qr-banner-text');
        const retry = button('Повторить', 'fpt-qr-banner-action', 'refresh');
        banner.append(icon('error'), bannerText, retry);
        retry.addEventListener('click', () => refresh());

        // --- Import result -----------------------------------------------------------------------
        const result = node('section', 'fpt-sio-result');
        result.setAttribute('role', 'status');
        result.hidden = true;
        const resultIcon = node('span', 'fpt-sio-result-icon');
        resultIcon.append(icon('task_alt'));
        const resultCopy = node('div', 'fpt-sio-result-copy');
        const resultTitle = node('strong', '', '');
        const resultText = node('p', '', '');
        resultCopy.append(resultTitle, resultText);
        const reloadButton = button('Перезагрузить страницу', 'fpt-qr-primary fpt-sio-reload', 'refresh');
        reloadButton.addEventListener('click', () => root.location.reload());
        const resultClose = button('', 'fpt-qr-icon-button fpt-sio-result-close', 'close');
        resultClose.setAttribute('aria-label', 'Скрыть');
        resultClose.title = 'Скрыть';
        resultClose.addEventListener('click', () => { state.imported = null; renderResult(); });
        result.append(resultIcon, resultCopy, reloadButton, resultClose);

        // --- Export and import -------------------------------------------------------------------
        const actions = node('section', 'fpt-sio-actions');
        actions.setAttribute('aria-label', 'Экспорт и импорт настроек');

        const exportCard = node('article', 'fpt-sio-tool fpt-sio-tool--export');
        exportCard.setAttribute('aria-labelledby', 'fpt-sio-export-title');
        const chipsHead = node('div', 'fpt-sio-chips-head');
        chipsHead.append(node('span', '', 'Что войдёт в файл'));
        const chips = node('div', 'fpt-sio-chips');
        chips.setAttribute('role', 'list');
        chips.setAttribute('aria-label', 'Разделы в файле');
        const exportButton = button('Скачать .fpconfig', 'fpt-qr-primary fpt-sio-main-button', 'download');
        exportButton.id = 'fp-settings-export-btn';
        exportCard.append(cardHead('cloud_download', 'Сохранить в файл', 'Скачает копию всех настроек — её можно хранить или открыть на другом компьютере.', 'fpt-sio-export-title'),
            chipsHead, chips, exportButton);

        const importCard = node('article', 'fpt-sio-tool fpt-sio-tool--import');
        importCard.setAttribute('aria-labelledby', 'fpt-sio-import-title');
        const dropZone = node('div', 'fpt-sio-drop');
        dropZone.setAttribute('aria-hidden', 'true');
        const dropIcon = node('span', 'fpt-sio-drop-icon');
        dropIcon.append(icon('upload_file'));
        dropZone.append(dropIcon, node('strong', '', 'Перетащите файл сюда'), node('span', '', 'или выберите его на компьютере'));
        const importButton = button('Выбрать файл', 'fpt-qr-ghost fpt-sio-main-button', 'folder_open');
        importButton.id = 'fp-settings-import-btn';
        importButton.setAttribute('aria-describedby', 'fpt-sio-import-status');
        const importStatus = node('div', 'fpt-sio-import-status');
        importStatus.id = 'fpt-sio-import-status';
        importStatus.setAttribute('aria-live', 'polite');
        const lastImport = node('p', 'fpt-sio-last-import');
        lastImport.hidden = true;
        const dropHint = node('div', 'fpt-sio-drop-hint');
        dropHint.setAttribute('aria-hidden', 'true');
        dropHint.append(icon('file_download'), node('span', '', 'Отпустите, чтобы открыть файл'));
        const fileInput = node('input', 'fpt-sio-file-input');
        fileInput.type = 'file';
        fileInput.accept = '.fpconfig,.json,application/json';
        fileInput.hidden = true;
        fileInput.setAttribute('aria-label', 'Файл настроек .fpconfig');
        importCard.append(cardHead('settings_backup_restore', 'Загрузить из файла', 'Перед загрузкой покажем, что внутри, и дадим выбрать разделы.', 'fpt-sio-import-title'),
            dropZone, importButton, importStatus, lastImport, dropHint, fileInput);
        actions.append(exportCard, importCard);

        // --- What stays in this browser ----------------------------------------------------------
        const privateCard = node('section', 'fpt-qr-card fpt-sio-private');
        privateCard.setAttribute('aria-labelledby', 'fpt-sio-private-title');
        const privateList = node('ul', 'fpt-sio-private-list');
        PRIVATE_DATA.forEach(item => {
            const row = node('li', 'fpt-sio-private-item');
            row.append(icon(item.icon), node('span', '', item.label));
            privateList.append(row);
        });
        privateCard.append(cardHead('shield_lock', 'Не попадает в файл', 'Это остаётся только в этом браузере, даже если файлом поделиться.', 'fpt-sio-private-title'), privateList);

        // --- Danger zone -------------------------------------------------------------------------
        const danger = node('section', 'fpt-qr-card fpt-sio-danger');
        danger.setAttribute('aria-labelledby', 'fpt-sio-danger-title');
        const dangerList = node('div', 'fpt-sio-reset-list');
        dangerList.setAttribute('role', 'list');
        const resetRows = RESETS.map(reset => {
            const row = node('div', 'fpt-sio-reset-row');
            row.setAttribute('role', 'listitem');
            const tile = node('span', 'fpt-sio-reset-icon');
            tile.append(icon(reset.icon));
            const copy = node('div', 'fpt-sio-reset-copy');
            copy.append(node('h4', '', reset.title), node('p', '', reset.hint));
            const count = node('span', 'fpt-qr-pill fpt-sio-reset-count', '—');
            const action = button('Сбросить', 'fpt-qr-ghost fpt-sio-reset-button', 'restart_alt');
            action.id = reset.action;
            action.setAttribute('aria-label', `Сбросить: ${reset.title}`);
            action.addEventListener('click', () => confirmReset(reset));
            row.append(tile, copy, count, action);
            dangerList.append(row);
            return { reset, row, count, action };
        });
        danger.append(cardHead('restart_alt', 'Сброс данных', 'Очищает служебные списки Funcy. Настройки и файлы копий это не затрагивает.', 'fpt-sio-danger-title'), dangerList);

        screen.append(hero, banner, result, actions, privateCard, danger);

        // --- Rendering ---------------------------------------------------------------------------
        const settingsOf = summary => summary?.backup?.settings || {};
        const capitalize = text => text ? text[0].toUpperCase() + text.slice(1) : text;

        function renderHero() {
            const summary = state.summary;
            const history = summary?.history || {};
            const lastExportAt = Number(history.lastExportAt) || 0;
            const fresh = lastExportAt && Date.now() - lastExportAt <= STALE_DAYS * DAY;
            hero.dataset.state = summary && fresh ? 'on' : 'off';
            if (!summary) {
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                heroPill.textContent = state.loadError ? 'Ошибка загрузки' : 'Загрузка…';
                [metricCount, metricSize, metricLast].forEach(item => { item.value.textContent = '—'; item.value.title = ''; });
                return;
            }
            if (state.imported) {
                heroPill.dataset.kind = 'success';
                heroPill.textContent = 'Импорт выполнен';
            } else if (!lastExportAt) {
                heroPill.dataset.kind = 'warning';
                heroPill.textContent = 'Копий ещё не было';
            } else {
                heroPill.dataset.kind = fresh ? 'success' : 'warning';
                heroPill.textContent = fresh ? 'Копия актуальна' : 'Пора обновить копию';
            }
            const settings = settingsOf(summary);
            const total = Object.keys(settings).length;
            const sections = classifySettings(settings).length;
            metricCount.value.textContent = String(total);
            metricCount.value.title = `${total} ${settingsWord(total)} в ${sections} ${pluralize(sections, ['разделе', 'разделах', 'разделах'])}`;
            const bytes = new Blob([JSON.stringify(summary.backup, null, 2)]).size;
            metricSize.value.textContent = formatBytes(bytes);
            metricSize.value.title = `${bytes.toLocaleString('ru-RU')} байт`;
            metricLast.value.textContent = lastExportAt ? capitalize(formatAgo(lastExportAt)) : 'Не было';
            metricLast.value.title = lastExportAt ? new Date(lastExportAt).toLocaleString('ru-RU') : '';
        }

        function renderChips() {
            chips.replaceChildren();
            if (!state.summary) {
                chips.setAttribute('aria-busy', 'true');
                for (let index = 0; index < 4; index += 1) chips.append(node('span', 'fpt-sio-chip fpt-sio-chip--skeleton'));
                return;
            }
            chips.removeAttribute('aria-busy');
            const sections = classifySettings(settingsOf(state.summary));
            if (!sections.length) {
                chips.append(node('p', 'fpt-sio-chips-empty', 'Пока всё по умолчанию — в файл попадут только служебные данные.'));
                return;
            }
            sections.forEach((section, index) => chips.append(sectionChip(section, index)));
        }

        function renderLastImport() {
            const history = state.summary?.history || {};
            const at = Number(history.lastImportAt) || 0;
            lastImport.hidden = !at;
            if (!at) return;
            lastImport.replaceChildren(icon('history'),
                node('span', '', `Последний импорт: ${formatAgo(at)}${history.lastImportName ? ` · ${history.lastImportName}` : ''}`));
            lastImport.title = new Date(at).toLocaleString('ru-RU');
        }

        function renderResets() {
            const counts = state.summary?.counts;
            resetRows.forEach(({ reset, row, count, action }) => {
                const value = counts ? Number(counts[reset.count]) || 0 : null;
                row.dataset.empty = String(value === 0);
                count.textContent = value === null ? '—' : value ? `${value} ${pluralize(value, reset.forms)}` : 'Пусто';
                action.disabled = value === 0;
                action.title = value === 0 ? 'Сбрасывать нечего' : '';
            });
        }

        function renderResult() {
            result.hidden = !state.imported;
            if (!state.imported) return;
            const { count, name } = state.imported;
            resultTitle.textContent = `Загружено ${count} ${settingsWord(count)}`;
            resultText.textContent = `${name ? `Из файла «${name}». ` : ''}Перезагрузите страницу, чтобы все функции подхватили новые настройки.`;
        }

        function renderAll() {
            banner.hidden = !state.loadError;
            bannerText.textContent = state.loadError;
            renderHero();
            renderChips();
            renderLastImport();
            renderResets();
            renderResult();
        }

        function setImportStatus(message = '', kind = 'error') {
            importStatus.replaceChildren();
            importCard.dataset.state = message ? kind : '';
            if (message) importStatus.append(ui.statusPill(kind, message));
        }

        async function refresh() {
            const version = ++state.refreshVersion;
            retry.disabled = true;
            try {
                const summary = await run('settings-io-summary');
                if (version !== state.refreshVersion) return;
                state.summary = summary;
                state.loadError = '';
            } catch (failure) {
                if (version !== state.refreshVersion) return;
                state.loadError = failure.message || 'Не удалось прочитать настройки.';
            } finally {
                if (version === state.refreshVersion) {
                    retry.disabled = false;
                    renderAll();
                }
            }
        }

        // --- Export ------------------------------------------------------------------------------
        async function exportCurrent(suffix = '') {
            const backup = await run('fp-settings-export-btn');
            downloadConfig(backup, configFileName(new Date(), suffix));
            await run('settings-io-mark', { exportedAt: Date.now() });
            return Object.keys(backup.settings || {}).length;
        }

        exportButton.addEventListener('click', async () => {
            exportButton.disabled = true;
            exportButton.setAttribute('aria-busy', 'true');
            try {
                const count = await exportCurrent();
                toast(`Файл сохранён: ${count} ${settingsWord(count)}`);
                await refresh();
            } catch (failure) {
                toast(failure.message || 'Не удалось сохранить настройки.', 'error');
            } finally {
                exportButton.disabled = false;
                exportButton.removeAttribute('aria-busy');
            }
        });

        // --- Import ------------------------------------------------------------------------------
        async function openFile(file) {
            if (!file) return;
            setImportStatus('');
            try {
                if (file.size > MAX_FILE_BYTES) throw new Error('Файл слишком большой для файла настроек.');
                const data = parseConfigFile(await file.text());
                const keys = await run('settings-io-importable', { data });
                if (!Array.isArray(keys) || !keys.length) throw new Error('В файле нет настроек, которые можно загрузить.');
                openImportDialog(data, file.name || 'settings.fpconfig', keys);
            } catch (failure) {
                setImportStatus(failure.message || 'Не удалось прочитать файл.');
            }
        }

        function fileMeta(data, total) {
            const parts = [];
            const date = new Date(data._date);
            if (data._date && !Number.isNaN(date.getTime())) {
                parts.push(date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
            }
            if (data._extVer) parts.push(`Funcy ${data._extVer}`);
            parts.push(`${total} ${settingsWord(total)}`);
            return parts.join(' · ');
        }

        // keys: what the import will actually write (see settings-io-importable); the rest of the file is skipped.
        function openImportDialog(data, fileName, keys) {
            const sections = classifySettings(Object.fromEntries(keys.map(key => [key, true])));
            const skipped = Object.keys(data.settings).length - keys.length;
            const dialog = ui.createDialog(popup, 'Импорт настроек', {
                description: 'Отметьте разделы, которые нужно загрузить. Их текущие значения заменятся значениями из файла.'
            });
            dialog.dialog.classList.add('fpt-sio-dialog');

            const file = node('div', 'fpt-sio-file');
            const fileTile = node('span', 'fpt-sio-file-icon');
            fileTile.append(icon('description'));
            const fileCopy = node('div', 'fpt-sio-file-copy');
            const name = node('strong', 'fpt-sio-file-name', fileName);
            name.title = fileName;
            fileCopy.append(name, node('span', 'fpt-sio-file-meta', fileMeta(data, keys.length)));
            file.append(fileTile, fileCopy);
            const installed = root.chrome?.runtime?.getManifest?.().version;
            if (data._extVer && installed && String(data._extVer) !== String(installed)) {
                const tag = node('span', 'fpt-sio-file-tag');
                tag.append(icon('info'), node('span', '', 'Другая версия'));
                tag.title = `Файл создан в Funcy ${data._extVer}, у вас ${installed}. Обычно это не мешает.`;
                file.append(tag);
            }
            dialog.body.append(file);
            if (skipped > 0) {
                const note = node('p', 'fpt-sio-skip-note');
                note.append(icon('shield_lock'), node('span', '',
                    `Аккаунты и служебные данные из файла не загружаются (${skipped} ${pluralize(skipped, ['ключ', 'ключа', 'ключей'])}).`));
                dialog.body.append(note);
            }

            const pickHead = node('div', 'fpt-sio-pick-head');
            const pickTitle = node('span', 'fpt-sio-pick-title', 'Разделы');
            const toggleAll = button('Снять все', 'fpt-qr-ghost fpt-sio-pick-all');
            pickHead.append(pickTitle, toggleAll);
            const list = node('div', 'fpt-sio-pick-list');
            list.setAttribute('role', 'group');
            list.setAttribute('aria-label', 'Разделы для импорта');
            const picks = sections.map((section, index) => {
                const control = ui.createCheckboxControl(section.label, { checked: section.id !== 'other', value: section.id, onChange: update });
                const row = control.element;
                row.classList.add('fpt-sio-pick-row');
                row.style.setProperty('--fpt-sio-delay', `${Math.min(index, 12) * 30}ms`);
                row.title = section.keys.join(', ');
                const tile = node('span', 'fpt-sio-pick-icon');
                tile.append(icon(section.icon));
                row.querySelector('.fpt-checkbox-caption')?.before(tile);
                row.append(node('span', 'fpt-sio-pick-count', section.keys.length));
                list.append(row);
                if (section.id === 'other') {
                    const note = node('div', 'fpt-sio-skip-note');
                    note.append(node('p', '', 'Служебные данные, переносите только из своего файла'), node('p', '', section.keys.join(', ')));
                    list.append(note);
                }
                return { section, input: control.input, row };
            });
            const summary = node('p', 'fpt-sio-pick-summary');
            summary.setAttribute('role', 'status');
            const safety = ui.createCheckboxControl('Сначала скачать копию текущих настроек', { checked: true });
            safety.element.classList.add('fpt-sio-safety');
            dialog.body.append(pickHead, list, summary, safety.element);

            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Импортировать', 'fpt-qr-primary', 'upload');
            dialog.footer.append(cancel, confirm);

            const total = keys.length;
            const selected = () => picks.filter(pick => pick.input.checked);
            function update() {
                const chosen = selected();
                const count = chosen.reduce((sum, pick) => sum + pick.section.keys.length, 0);
                picks.forEach(pick => { pick.row.dataset.checked = String(pick.input.checked); });
                summary.textContent = count
                    ? `Будет загружено ${count} из ${total} ${pluralize(total, ['настройки', 'настроек', 'настроек'])}`
                    : 'Ничего не выбрано';
                summary.dataset.empty = String(!count);
                confirm.disabled = !count;
                setButtonLabel(toggleAll, chosen.length === picks.length ? 'Снять все' : 'Выбрать все');
            }
            toggleAll.addEventListener('click', () => {
                const check = selected().length !== picks.length;
                picks.forEach(pick => { pick.input.checked = check; });
                update();
            });
            update();

            confirm.addEventListener('click', async () => {
                const keys = selected().flatMap(pick => pick.section.keys);
                if (!keys.length) return;
                dialog.setBusy(true);
                setButtonLabel(confirm, 'Загружаем…');
                try {
                    if (safety.input.checked) await exportCurrent('-before-import');
                    const response = await run('fp-settings-import-btn', { data, keys });
                    await run('settings-io-mark', { importedAt: Date.now(), name: fileName });
                    dialog.setBusy(false);
                    dialog.close();
                    const count = Number(response?.count) || 0;
                    state.imported = { count, name: fileName };
                    setImportStatus('');
                    toast(`Настройки загружены: ${count} ${settingsWord(count)}`);
                    await refresh();
                    result.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
                    reloadButton.focus({ preventScroll: true });
                } catch (failure) {
                    dialog.setBusy(false);
                    setButtonLabel(confirm, 'Импортировать');
                    toast(failure.message || 'Не удалось загрузить настройки.', 'error');
                }
            });
            dialog.focusInitial();
        }

        importButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            openFile(file);
        });
        let dragDepth = 0;
        const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
        const setDragOver = active => importCard.classList.toggle('is-dragover', active);
        importCard.addEventListener('dragenter', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepth += 1;
            setDragOver(true);
        });
        importCard.addEventListener('dragover', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        });
        importCard.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (!dragDepth) setDragOver(false);
        });
        importCard.addEventListener('drop', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepth = 0;
            setDragOver(false);
            openFile(event.dataTransfer.files?.[0]);
        });

        // --- Resets ------------------------------------------------------------------------------
        function confirmReset(reset) {
            const dialog = ui.createDialog(popup, `Сбросить «${reset.title}»?`, {
                description: `${reset.hint} Отменить сброс нельзя.`
            });
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Сбросить', 'fpt-qr-danger', 'restart_alt');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    await run(reset.action);
                    dialog.setBusy(false);
                    dialog.close();
                    toast(`Сброшено: ${reset.title.toLowerCase()}`);
                    await refresh();
                } catch (failure) {
                    dialog.setBusy(false);
                    toast(failure.message || 'Не удалось выполнить сброс.', 'error');
                }
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        }

        // --- Loading -----------------------------------------------------------------------------
        // The summary reads the whole storage, so it loads when the screen is opened, not with the popup.
        renderAll();
        ui.onPageActivated?.(page, () => { refresh(); });
        const loading = page.classList.contains('active') ? refresh() : Promise.resolve();
        page._fptSettingsIoMount = loading;
        return loading;
    }

    root.FPTSettingsIOPage = Object.freeze({ mount, classifySettings, formatBytes, formatAgo, parseConfigFile, configFileName });
})(typeof window !== 'undefined' ? window : globalThis);
