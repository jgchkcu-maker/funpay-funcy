// Auto-bump screen: master switch, scope rules, category picker and event log.
(function (root) {
    'use strict';

    const PAGE_ID = 'autobump';
    const KEYS = Object.freeze({
        enabled: 'autoBumpEnabled',
        selective: 'fpToolsSelectiveBumpEnabled',
        selected: 'fpToolsSelectedBumpCategories',
        onlyAutoDelivery: 'fpToolsBumpOnlyAutoDelivery',
        logs: 'fpToolsAutoBumpLogs'
    });
    const STATUS_REFRESH_MS = 30000;

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

    function setStatus(element, text, kind) {
        element.replaceChildren();
        delete element.dataset.kind;
        if (text && ['success', 'error', 'warning'].includes(kind)) {
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

    function pluralCategories(count) {
        return root.FPTPopupUI.pluralize(count, ['категория', 'категории', 'категорий']);
    }

    function formatDuration(ms) {
        const totalMinutes = Math.max(0, Math.round(ms / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
        if (totalMinutes > 0) return `${totalMinutes} мин`;
        return 'меньше минуты';
    }

    function parseLogEntry(entry) {
        const text = String(entry ?? '');
        const match = text.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
        const time = match ? match[1] : '';
        const message = match ? match[2] : text;
        let kind = 'info';
        if (/^Поднято/i.test(message)) kind = 'success';
        else if (/Системная ошибка|Ошибка/i.test(message)) kind = 'error';
        else if (/^(Не поднято|Лимит)/i.test(message)) kind = 'warning';
        return { time, message, kind };
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
        line.append(label);
        return {
            element: line,
            input,
            setChecked(value) {
                input.checked = !!value;
            }
        };
    }

    function createRule({ iconName, title, description, settingKey, control }) {
        const row = node('article', 'fpt-ad-rule-row fpt-ab-rule-row');
        const iconWrap = node('span', `fpt-ad-rule-icon fpt-ad-rule-icon--${settingKey}`);
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ad-rule-copy');
        copy.append(node('h3', '', title), node('p', '', description));
        row.append(iconWrap, copy, control.element);
        return row;
    }

    function makeHelpPanel() {
        const panel = node('aside', 'fpt-ab-help fpt-lot-help-popover');
        panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Справка по автоподнятию');
        panel.appendChild(node('h2', '', 'Автоподнятие'));
        const list = node('ul');
        [
            'Расширение само поднимает ваши категории на FunPay и планирует следующую попытку.',
            'FunPay разрешает поднимать категорию примерно раз в 4 часа — раньше сайт не даст.',
            'Если выбрать категории вручную, остальные подниматься не будут. Пустой выбор — поднятия не будет.',
            'Кнопка «Поднять сейчас» запускает один цикл вне расписания.'
        ].forEach(text => list.appendChild(node('li', '', text)));
        panel.appendChild(list);
        return panel;
    }

    function createListState(kind, title, description) {
        const state = node('div', `fpt-ad-list-state fpt-ad-list-state--${kind}`);
        state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        const iconName = kind === 'loading' ? 'progress_activity' : kind === 'error' ? 'error' : 'inbox';
        state.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ad-list-state-copy');
        copy.append(node('strong', '', title), node('span', '', description));
        state.appendChild(copy);
        return state;
    }

    function createMetric(iconName, label) {
        const metric = node('div', 'fpt-ab-metric');
        const iconWrap = node('span', 'fpt-ab-metric-icon');
        iconWrap.appendChild(icon(iconName));
        const copy = node('div', 'fpt-ab-metric-copy');
        const value = node('strong', 'fpt-ab-metric-value', '—');
        copy.append(node('span', 'fpt-ab-metric-label', label), value);
        metric.append(iconWrap, copy);
        return { element: metric, value };
    }

    function createButton(className, iconName, label) {
        const button = node('button', className);
        button.type = 'button';
        button.append(icon(iconName), node('span', 'fpt-ab-button-label', label));
        return button;
    }

    async function mount(popup) {
        if (!popup || !root.FPTPopupUI || typeof root.FPTPopupUI.ensureCategoryHeader !== 'function') {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const page = popup.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptAutoBumpMounted === 'true') return;
        page.dataset.fptAutoBumpMounted = 'true';

        const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);
        const state = {
            enabled: false,
            selective: false,
            onlyAutoDelivery: false,
            selectedIds: [],
            logs: [],
            nextRunAt: null
        };
        try {
            const stored = await run('getSettings', { keys: Object.values(KEYS) });
            state.enabled = stored[KEYS.enabled] === true;
            state.selective = stored[KEYS.selective] === true;
            state.onlyAutoDelivery = stored[KEYS.onlyAutoDelivery] === true;
            state.selectedIds = Array.isArray(stored[KEYS.selected]) ? stored[KEYS.selected].slice() : [];
            state.logs = Array.isArray(stored[KEYS.logs]) ? stored[KEYS.logs].slice() : [];
        } catch (_) {}

        const helpPanel = makeHelpPanel();
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Автоподнятие', {
            onHelp: event => {
                const open = helpPanel.hidden;
                helpPanel.hidden = !open;
                event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        const view = node('div', 'fpt-auto-bump');
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header.helpButton) {
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
        } else {
            view.appendChild(helpPanel);
        }

        // --- Hero: master switch, schedule, quick action -------------------------------------
        const hero = node('section', 'fpt-ab-hero');
        hero.setAttribute('aria-labelledby', 'fpt-ab-hero-title');
        const heroMain = node('div', 'fpt-ab-hero-main');
        const heroIcon = node('span', 'fpt-ab-hero-icon');
        heroIcon.appendChild(icon('rocket_launch'));
        const heroCopy = node('div', 'fpt-ab-hero-copy');
        const heroTitleRow = node('div', 'fpt-ab-hero-title-row');
        const heroTitle = node('h2', 'fpt-ab-hero-title', 'Автоподнятие лотов');
        heroTitle.id = 'fpt-ab-hero-title';
        const heroPill = node('span', 'fpt-ab-pill', 'Выключено');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(
            heroTitleRow,
            node('p', 'fpt-ab-hero-description', 'Расширение само поднимает подходящие категории и планирует следующую попытку.')
        );
        const masterSwitch = makeSwitch('autoBumpEnabled', 'Включить автоподнятие', state.enabled);
        masterSwitch.element.classList.add('fpt-ab-master-switch');
        heroMain.append(heroIcon, heroCopy, masterSwitch.element);

        const metricNext = createMetric('schedule', 'Следующее поднятие');
        const metricScope = createMetric('filter_alt', 'Что поднимаем');
        const metricLast = createMetric('history', 'Последнее событие');
        const metrics = node('div', 'fpt-ab-metrics');
        metrics.append(metricNext.element, metricScope.element, metricLast.element);

        const heroActions = node('div', 'fpt-ab-hero-actions');
        const raiseButton = createButton('fpt-ad-load-button fpt-ab-raise-button', 'bolt', 'Поднять сейчас');
        raiseButton.id = 'fpt-ab-raise-now';
        const heroStatus = node('p', 'fpt-ad-rules-status fpt-ab-hero-status');
        heroStatus.setAttribute('aria-live', 'polite');
        heroActions.append(raiseButton, heroStatus);
        hero.append(heroMain, metrics, heroActions);

        // --- Scope rules ---------------------------------------------------------------------
        const rules = node('section', 'fpt-ad-rules fpt-ab-rules');
        rules.setAttribute('aria-labelledby', 'fpt-ab-rules-title');
        const rulesTitle = node('h2', 'fpt-ad-section-title', 'Что поднимать');
        rulesTitle.id = 'fpt-ab-rules-title';
        rules.append(rulesTitle, node('p', 'fpt-ad-section-description', 'Ограничьте поднятие нужными категориями или оставьте все.'));

        const selectiveSwitch = makeSwitch('fpToolsSelectiveBumpEnabled', 'Только выбранные категории', state.selective);
        const onlyAutoDeliverySwitch = makeSwitch('fpToolsBumpOnlyAutoDelivery', 'Только категории с автовыдачей', state.onlyAutoDelivery);
        const rulePanel = node('div', 'fpt-ad-rule-panel');
        const selectiveRule = createRule({
            iconName: 'checklist', title: 'Только выбранные категории',
            description: 'Ограничить поднятие заранее выбранным набором категорий.',
            settingKey: 'selective', control: selectiveSwitch
        });
        const selection = node('div', 'fpt-ab-selection');
        selection.hidden = true;
        const selectionSummary = node('p', 'fpt-ab-selection-summary');
        selectionSummary.setAttribute('aria-live', 'polite');
        const configureButton = createButton('fpt-ab-configure-button', 'tune', 'Выбрать категории');
        configureButton.id = 'configureSelectiveBumpBtn';
        selection.append(selectionSummary, configureButton);
        const autoDeliveryRule = createRule({
            iconName: 'bolt', title: 'Только категории с автовыдачей',
            description: 'Оставить только категории, где хотя бы один лот использует автовыдачу.',
            settingKey: 'onlyAutoDelivery', control: onlyAutoDeliverySwitch
        });
        rulePanel.append(selectiveRule, selection, autoDeliveryRule);
        const rulesStatus = node('p', 'fpt-ad-rules-status');
        rulesStatus.setAttribute('aria-live', 'polite');
        rules.append(rulePanel, rulesStatus);

        // --- Log -----------------------------------------------------------------------------
        const logSection = node('section', 'fpt-ab-log-section');
        logSection.setAttribute('aria-labelledby', 'fpt-ab-log-title');
        const logHeading = node('div', 'fpt-ad-lots-heading fpt-ab-log-heading');
        const logCopy = node('div', 'fpt-ad-lots-heading-copy');
        const logTitle = node('h2', 'fpt-ad-section-title', 'Журнал');
        logTitle.id = 'fpt-ab-log-title';
        logCopy.append(logTitle, node('p', 'fpt-ad-section-description', 'Последние события автоподнятия сохраняются между открытиями панели.'));
        const logTools = node('div', 'fpt-ab-log-tools');
        const refreshLogButton = createButton('fpt-toolbar-button', 'refresh', 'Обновить');
        refreshLogButton.id = 'autoBumpLogToggle';
        const clearLogButton = createButton('fpt-toolbar-button', 'delete_sweep', 'Очистить');
        logTools.append(refreshLogButton, clearLogButton);
        logHeading.append(logCopy, logTools);
        const logList = node('ol', 'fpt-ab-log');
        logList.setAttribute('aria-label', 'Журнал автоподнятия');
        logSection.append(logHeading, logList);

        view.append(hero, rules, logSection);
        page.appendChild(view);

        // --- Rendering -----------------------------------------------------------------------
        function scopeText() {
            const count = state.selectedIds.length;
            if (state.selective && state.onlyAutoDelivery) return `Выбранные с автовыдачей (${count})`;
            if (state.selective) return count ? `Выбранные: ${count} ${pluralCategories(count)}` : 'Ничего не выбрано';
            if (state.onlyAutoDelivery) return 'Только с автовыдачей';
            return 'Все категории';
        }

        function renderMetrics() {
            if (!state.enabled) {
                metricNext.value.textContent = 'Выключено';
            } else if (state.nextRunAt) {
                const remaining = state.nextRunAt - Date.now();
                metricNext.value.textContent = remaining > 0 ? `через ${formatDuration(remaining)}` : 'совсем скоро';
            } else {
                metricNext.value.textContent = 'Планируем…';
            }
            metricScope.value.textContent = scopeText();
            const last = state.logs.length ? parseLogEntry(state.logs[0]) : null;
            metricLast.value.textContent = last ? last.message : 'Событий пока нет';
            metricLast.value.title = last ? `${last.time} ${last.message}`.trim() : '';
        }

        function renderHero() {
            hero.dataset.state = state.enabled ? 'on' : 'off';
            heroPill.textContent = state.enabled ? 'Работает' : 'Выключено';
            heroPill.dataset.kind = state.enabled ? 'success' : 'neutral';
            renderMetrics();
        }

        function renderSelection() {
            selection.hidden = !state.selective;
            const count = state.selectedIds.length;
            selectionSummary.dataset.empty = count ? 'false' : 'true';
            selectionSummary.replaceChildren(
                icon(count ? 'check_circle' : 'info'),
                node('span', '', count
                    ? `Выбрано: ${count} ${pluralCategories(count)}`
                    : 'Ничего не выбрано — поднятие не будет выполняться')
            );
        }

        function renderLogs() {
            logList.replaceChildren();
            if (!state.logs.length) {
                const empty = node('li', 'fpt-ab-log-empty');
                empty.append(icon('receipt_long'), node('span', '', 'Событий пока нет. Они появятся после первого поднятия.'));
                logList.appendChild(empty);
                clearLogButton.disabled = true;
                return;
            }
            clearLogButton.disabled = false;
            state.logs.forEach(entry => {
                const parsed = parseLogEntry(entry);
                const item = node('li', 'fpt-ab-log-item');
                item.dataset.kind = parsed.kind;
                item.append(node('time', 'fpt-ab-log-time', parsed.time), node('span', 'fpt-ab-log-message', parsed.message));
                logList.appendChild(item);
            });
        }

        function renderAll() {
            renderHero();
            renderSelection();
            renderLogs();
        }

        async function refreshLogs() {
            try {
                const stored = await run('getSettings', { keys: [KEYS.logs] });
                state.logs = Array.isArray(stored[KEYS.logs]) ? stored[KEYS.logs].slice() : [];
            } catch (_) {}
            renderLogs();
            renderMetrics();
        }

        async function refreshStatus() {
            try {
                const response = await run('getBumpStatus');
                state.nextRunAt = response && Number.isFinite(response.nextRunAt) ? response.nextRunAt : null;
            } catch (_) {
                state.nextRunAt = null;
            }
            renderMetrics();
        }

        // --- Interactions --------------------------------------------------------------------
        masterSwitch.input.addEventListener('change', async () => {
            const next = masterSwitch.input.checked;
            const previous = state.enabled;
            masterSwitch.input.disabled = true;
            hero.setAttribute('aria-busy', 'true');
            setStatus(heroStatus, next ? 'Запускаем автоподнятие…' : 'Останавливаем автоподнятие…', 'loading');
            try {
                await run('saveSettings', { settings: { [KEYS.enabled]: next } });
                state.enabled = next;
                setStatus(heroStatus, next ? 'Автоподнятие включено.' : 'Автоподнятие выключено.', 'success');
            } catch (error) {
                masterSwitch.setChecked(previous);
                setStatus(heroStatus, error.message || 'Не удалось изменить автоподнятие.', 'error');
            } finally {
                masterSwitch.input.disabled = false;
                hero.removeAttribute('aria-busy');
                renderHero();
                await Promise.all([refreshStatus(), refreshLogs()]);
            }
        });

        function bindRule(control, stateKey, settingKey, okText) {
            control.input.addEventListener('change', async () => {
                const next = control.input.checked;
                const previous = state[stateKey];
                control.input.disabled = true;
                state[stateKey] = next;
                renderHero();
                renderSelection();
                try {
                    await run('saveSettings', { settings: { [settingKey]: next } });
                    setStatus(rulesStatus, okText(next), 'success');
                } catch (error) {
                    state[stateKey] = previous;
                    control.setChecked(previous);
                    setStatus(rulesStatus, error.message || 'Не удалось сохранить настройку.', 'error');
                    renderHero();
                    renderSelection();
                } finally {
                    control.input.disabled = false;
                }
            });
        }
        bindRule(selectiveSwitch, 'selective', KEYS.selective,
            next => next ? 'Будут подниматься только выбранные категории.' : 'Будут подниматься все категории.');
        bindRule(onlyAutoDeliverySwitch, 'onlyAutoDelivery', KEYS.onlyAutoDelivery,
            next => next ? 'Будут подниматься только категории с автовыдачей.' : 'Автовыдача больше не ограничивает поднятие.');

        raiseButton.addEventListener('click', async () => {
            if (raiseButton.disabled) return;
            raiseButton.disabled = true;
            raiseButton.setAttribute('aria-busy', 'true');
            raiseButton.querySelector('.fpt-ab-button-label').textContent = 'Поднимаем…';
            raiseButton.querySelector('.material-symbols-rounded').textContent = 'progress_activity';
            setStatus(heroStatus, 'Поднимаем лоты…', 'loading');
            try {
                const response = await run('raiseNow');
                if (!response || response.ok === false) throw new Error((response && response.error) || 'Не удалось поднять лоты.');
                const summary = response.summary || {};
                const raised = Number(summary.raised) || 0;
                if (raised > 0) {
                    setStatus(heroStatus, `Поднято: ${raised} ${pluralCategories(raised)}.`, 'success');
                } else if (Number(summary.errors) > 0) {
                    setStatus(heroStatus, 'Не удалось поднять лоты. Подробности — в журнале.', 'error');
                } else {
                    setStatus(heroStatus, 'Сейчас нечего поднимать. Подробности — в журнале.', 'warning');
                }
            } catch (error) {
                setStatus(heroStatus, error.message || 'Не удалось поднять лоты.', 'error');
            } finally {
                raiseButton.disabled = false;
                raiseButton.removeAttribute('aria-busy');
                raiseButton.querySelector('.fpt-ab-button-label').textContent = 'Поднять сейчас';
                raiseButton.querySelector('.material-symbols-rounded').textContent = 'bolt';
                await refreshLogs();
            }
        });

        refreshLogButton.addEventListener('click', refreshLogs);
        clearLogButton.addEventListener('click', async () => {
            clearLogButton.disabled = true;
            try {
                await run('saveSettings', { settings: { [KEYS.logs]: [] } });
                state.logs = [];
            } catch (_) {}
            renderLogs();
            renderMetrics();
        });

        configureButton.addEventListener('click', () => openCategoryDialog());

        function openCategoryDialog() {
            const dialog = root.FPTPopupUI.createDialog(popup, 'Выбор категорий', {
                wide: true,
                description: 'Отметьте категории, которые нужно поднимать. Остальные будут пропущены.'
            });
            const selected = new Set(state.selectedIds);
            let categories = [];
            let visible = [];
            const inputs = new Map();

            const tools = node('div', 'fpt-ab-dialog-tools');
            const search = node('input', 'fpt-ad-search');
            search.type = 'search';
            search.placeholder = 'Поиск по названию категории';
            search.setAttribute('aria-label', 'Поиск по категориям');
            search.disabled = true;
            const selectAll = node('button', 'fpt-lot-dialog-button', 'Выбрать / снять все');
            selectAll.type = 'button';
            selectAll.disabled = true;
            tools.append(search, selectAll);
            const list = node('div', 'fpt-lot-category-list fpt-ab-category-list');
            list.appendChild(createListState('loading', 'Загружаем категории…', 'Получаем список ваших категорий с FunPay.'));
            dialog.body.append(tools, list);

            const counter = node('span', 'fpt-ab-dialog-counter');
            counter.setAttribute('aria-live', 'polite');
            const cancel = node('button', 'fpt-lot-dialog-button', 'Отмена');
            cancel.type = 'button';
            const save = node('button', 'fpt-lot-dialog-button fpt-lot-dialog-button--primary', 'Сохранить');
            save.type = 'button';
            save.disabled = true;
            dialog.footer.append(counter, cancel, save);

            const updateCounter = () => {
                const knownSelected = categories.filter(category => selected.has(category.id)).length;
                counter.textContent = categories.length ? `Выбрано: ${knownSelected} из ${categories.length}` : '';
            };

            function renderList() {
                const query = search.value.trim().toLowerCase();
                visible = categories.filter(category => !query || category.name.toLowerCase().includes(query));
                inputs.clear();
                list.replaceChildren();
                if (!visible.length) {
                    list.appendChild(createListState('empty', 'Ничего не найдено', 'Измените запрос или сбросьте поиск.'));
                    return;
                }
                visible.forEach(category => {
                    const control = root.FPTPopupUI.createCheckboxControl(category.name, {
                        value: category.id,
                        checked: selected.has(category.id),
                        onChange: event => {
                            if (event.target.checked) selected.add(category.id);
                            else selected.delete(category.id);
                            updateCounter();
                        }
                    });
                    control.element.classList.add('fpt-lot-category-row', 'fpt-ab-category-row');
                    control.element.querySelector('.fpt-checkbox-caption')?.classList.add('fpt-lot-category-name');
                    const lotCount = Array.isArray(category.lots) ? category.lots.length : 0;
                    const meta = node('span', 'fpt-lot-category-count',
                        `${lotCount} ${root.FPTPopupUI.pluralize(lotCount, ['лот', 'лота', 'лотов'])}`);
                    control.element.appendChild(meta);
                    if (category.hasAutoDelivery) {
                        const badge = node('span', 'fpt-ab-badge', 'Автовыдача');
                        control.element.appendChild(badge);
                    }
                    inputs.set(category.id, control.input);
                    list.appendChild(control.element);
                });
            }

            search.addEventListener('input', renderList);
            selectAll.addEventListener('click', async () => {
                try {
                    const next = await run('autobump-select-all', {
                        categories: visible,
                        selectedCategoryIds: Array.from(selected)
                    });
                    selected.clear();
                    next.forEach(id => selected.add(id));
                    inputs.forEach((input, id) => { input.checked = selected.has(id); });
                    updateCounter();
                } catch (_) {}
            });
            cancel.addEventListener('click', () => dialog.close());
            save.addEventListener('click', async () => {
                const knownIds = new Set(categories.map(category => category.id));
                const selectedCategoryIds = Array.from(selected).filter(id => knownIds.has(id));
                dialog.setBusy(true);
                try {
                    await run('autobump-category-save', { selectedCategoryIds });
                    state.selectedIds = selectedCategoryIds;
                    dialog.setBusy(false);
                    dialog.close();
                    renderSelection();
                    renderMetrics();
                    setStatus(rulesStatus, `Сохранено: ${selectedCategoryIds.length} ${pluralCategories(selectedCategoryIds.length)}.`, 'success');
                } catch (error) {
                    dialog.setBusy(false);
                    root.FPTPopupUI.showToast(popup, error.message || 'Не удалось сохранить выбор.', 'error');
                }
            });

            (async () => {
                try {
                    const response = await run('configureSelectiveBumpBtn');
                    if (!response || response.success === false) throw new Error((response && response.error) || 'Не удалось загрузить категории.');
                    categories = Array.isArray(response.data) ? response.data : [];
                    if (!categories.length) {
                        list.replaceChildren(createListState('empty', 'Категорий нет', 'На вашем профиле FunPay пока нет лотов.'));
                        return;
                    }
                    search.disabled = false;
                    selectAll.disabled = false;
                    save.disabled = false;
                    renderList();
                    updateCounter();
                } catch (error) {
                    list.replaceChildren(createListState('error', 'Не удалось загрузить категории', error.message || 'Проверьте подключение к FunPay и повторите.'));
                }
            })();
        }

        // --- Live updates --------------------------------------------------------------------
        const onLog = () => {
            if (!page.isConnected) {
                window.removeEventListener('fpt:autobump-log', onLog);
                return;
            }
            refreshLogs();
        };
        window.addEventListener('fpt:autobump-log', onLog);
        const timer = setInterval(() => {
            if (!page.isConnected) {
                clearInterval(timer);
                return;
            }
            if (page.classList.contains('active')) refreshStatus();
        }, STATUS_REFRESH_MS);

        renderAll();
        refreshStatus();
    }

    root.FPTAutoBumpPage = Object.freeze({ mount, parseLogEntry, formatDuration });
})(window);
