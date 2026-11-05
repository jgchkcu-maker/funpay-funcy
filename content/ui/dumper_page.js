// «Автодемпер»: список своих предложений и настройки каждого лота в стандартном окне Funcy.
// Окно лота: вкладки «Цена», «Конкуренты», «История»; внизу «Проверить», «Сохранить» и
// отдельное включение автоматизации, доступное только после успешной проверки этих настроек.
(function (root) {
    'use strict';

    const PAGE_ID = 'dumper';
    const UI = () => root.FPTAutomationUI;

    const STRATEGIES = [['undercut', 'Дешевле аналогов'], ['position', 'N-е место по цене']];
    const PAUSE_TEXT = {
        'manual-edit': 'цену изменили вне демпера',
        'schema-changed': 'изменилась схема раздела',
        'own-changed': 'изменились характеристики лота',
        'rule-changed': 'условия изменены',
        'unverified': 'FunPay не подтвердил цену',
        'conflict': 'цену ведёт правило наценки',
        'moved': 'лот в другом разделе'
    };
    const ACTION_TEXT = {
        lower: 'Снизить цену', raise: 'Поднять цену', 'raise-pending': 'Ждём подтверждения повышения',
        keep: 'Оставить цену', wait: 'Ждём лимита', 'cannot-beat': 'Нельзя обойти безопасно', skip: 'Пропуск'
    };
    const HISTORY_TYPES = {
        observation: 'Наблюдение', decision: 'Решение', write: 'Запись цены', error: 'Ошибка',
        pause: 'Пауза', resume: 'Включение', gap: 'Пробел', intent: 'Намерение'
    };

    function appUserId() {
        try {
            const data = JSON.parse(document.body?.dataset.appData || '{}');
            const user = Array.isArray(data) ? data[0] : data;
            return user?.userId ? String(user.userId) : null;
        } catch (_) {
            return null;
        }
    }

    function call(command, payload = {}) {
        return UI().request({ action: 'fptDumper', command, ...payload });
    }

    function refOf(lot) {
        return { kind: lot.kind, nodeId: lot.nodeId, offerId: lot.offerId, title: lot.title };
    }

    function keyOf(accountId, lot) {
        return `${accountId}:${lot.kind}:${lot.nodeId}:${lot.offerId}`;
    }

    function statusOf(rule, accountEnabled) {
        const rt = rule?.runtime || {};
        if (!rule?.revision) return { group: 'off', tone: '', text: 'Не настроен', detail: 'Задайте условия цены' };
        if (rt.status === 'paused') return { group: 'attention', tone: 'warning', text: 'Пауза', detail: PAUSE_TEXT[rt.pauseReason] || rt.pauseReason || 'См. историю' };
        if (rt.lastError && rule.enabled) return { group: 'attention', tone: 'danger', text: 'Ошибка', detail: rt.lastError.message };
        if (!rule.enabled) return { group: 'off', tone: '', text: 'Выключен', detail: '' };
        if (!accountEnabled) return { group: 'stopped', tone: 'warning', text: 'Остановлен', detail: 'Общий выключатель' };
        return { group: 'active', tone: 'success', text: 'Работает', detail: '' };
    }

    function textList(value) {
        return String(value || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
    }

    function makeSwitch(label, checked) {
        const wrap = UI().node('label', 'fpt-ad-switch-control fpt-dumper-switch');
        const input = UI().node('input', 'fpt-ad-switch');
        input.type = 'checkbox';
        input.checked = Boolean(checked);
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-label', label);
        wrap.append(input, UI().node('span', 'fpt-ad-switch-track'));
        return { element: wrap, input };
    }

    function check(label, checked, hint = '') {
        const wrap = UI().node('label', 'fpt-auto-check');
        const input = UI().node('input');
        input.type = 'checkbox';
        input.checked = Boolean(checked);
        wrap.append(input, UI().node('span', '', label));
        if (hint) wrap.title = hint;
        return { element: wrap, input };
    }

    // --- Окно настроек лота ---------------------------------------------------------------

    function openLotDialog(popup, ctx, lot) {
        const ui = UI();
        const { node } = ui;
        const dialog = root.FPTPopupUI.createDialog(popup, lot.title || `Лот ${lot.offerId}`, { wide: true });
        dialog.dialog.classList.add('fpt-dumper-dialog');
        const ref = refOf(lot);
        const key = keyOf(ctx.accountId, lot);
        const state = { rule: null, runtime: {}, lastCheck: null, saved: null, dirty: false, busy: false };
        const opener = document.activeElement;
        const focusLot = lot.offerId;
        // Refresh replaces list rows. Restore focus to the replacement when the opener disappears.
        const lifecycle = new MutationObserver(() => {
            if (dialog.dialog.isConnected) return;
            clearInterval(freshnessTimer);
            lifecycle.disconnect();
            if (!opener?.isConnected) {
                [...popup.querySelectorAll('.fpt-dumper-row')].find(row => row.dataset.offerId === focusLot)?.focus();
            }
        });
        lifecycle.observe(popup, { childList: true, subtree: true });
        const freshnessTimer = setInterval(() => {
            if (!dialog.dialog.isConnected) { clearInterval(freshnessTimer); lifecycle.disconnect(); return; }
            if (!state.busy) { renderFooter(); renderSummary(); }
        }, 1000);

        const meta = node('p', 'fpt-dumper-dialog-meta', [lot.categoryName, lot.kind === 'chips' ? 'валюта' : 'лот', `ID ${lot.offerId}`].filter(Boolean).join(' · '));
        const dialogStatus = node('div', 'fpt-dumper-dialog-status');
        const compactResult = node('div', 'fpt-dumper-compact-result');
        compactResult.setAttribute('aria-live', 'polite');
        const summary = node('div', 'fpt-dumper-summary');
        summary.setAttribute('aria-live', 'polite');
        const tabs = node('div', 'fpt-dumper-tabs');
        tabs.setAttribute('role', 'tablist');
        const panels = {};
        const tabButtons = {};
        for (const [id, label] of [['price', 'Цена'], ['competitors', 'Конкуренты'], ['history', 'История']]) {
            const tab = node('button', 'fpt-dumper-tab', label);
            tab.type = 'button';
            tab.setAttribute('role', 'tab');
            tab.dataset.tab = id;
            tab.id = `fpt-dumper-${id}-tab`;
            const panel = node('div', 'fpt-dumper-panel');
            panel.setAttribute('role', 'tabpanel');
            panel.dataset.tab = id;
            panel.id = `fpt-dumper-${id}-panel`;
            tab.setAttribute('aria-controls', panel.id);
            panel.setAttribute('aria-labelledby', tab.id);
            tab.addEventListener('click', () => selectTab(id));
            tabs.appendChild(tab);
            tabButtons[id] = tab;
            panels[id] = panel;
        }
        const contextLine = node('div', 'fpt-dumper-context');
        contextLine.append(meta, dialogStatus);
        dialog.body.append(contextLine, tabs, compactResult, ...Object.values(panels));
        tabs.addEventListener('keydown', event => {
            const ids = Object.keys(tabButtons);
            const index = ids.findIndex(id => tabButtons[id] === event.target);
            if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
            selectTab(ids[next]);
            tabButtons[ids[next]].focus();
        });

        function selectTab(id) {
            state.tab = id;
            compactResult.hidden = id === 'price';
            for (const [tabId, tab] of Object.entries(tabButtons)) {
                const active = tabId === id;
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.tabIndex = active ? 0 : -1;
                panels[tabId].hidden = !active;
            }
            if (id === 'history' && !state.history) loadHistory();
        }

        // --- Вкладка «Цена» --------------------------------------------------------------
        const f = {};
        const pricePanel = panels.price;
        const strategyGrid = node('div', 'fpt-dumper-grid');
        f.strategy = ui.select(STRATEGIES, 'undercut');
        f.position = ui.input('number', '2', { min: '1', max: '50', step: '1' });
        f.stepValue = ui.input('text', '', { inputmode: 'decimal' });
        f.stepMode = ui.select([['amount', 'суммой'], ['percent', 'процентом']], 'amount');
        const positionField = ui.field('Место', f.position, 'Среди отобранных конкурентов');
        strategyGrid.append(ui.field('Стратегия', f.strategy), positionField, ui.field('Шаг', f.stepValue, 'Насколько дешевле опорного конкурента'), ui.field('Шаг задан', f.stepMode));
        f.minPrice = ui.input('text', '', { inputmode: 'decimal' });
        f.cost = ui.input('text', '', { inputmode: 'decimal' });
        f.minProfit = ui.input('text', '', { inputmode: 'decimal' });
        f.ceiling = ui.input('text', '', { inputmode: 'decimal' });
        f.quantum = ui.input('text', '', { inputmode: 'decimal' });
        f.useCostBasis = check('Брать себестоимость из «Финансов», если поле пустое', false);
        f.allowRaise = check('Автоповышение (нужен потолок и два подтверждения рынка)', false);
        const runGrid = node('div', 'fpt-dumper-grid');
        f.intervalMin = ui.input('number', '5', { min: '1', max: '1440', step: '1' });
        f.writeIntervalMin = ui.input('number', '5', { min: '1', step: '1' });
        f.maxChangePercent = ui.input('text', '5', { inputmode: 'decimal' });
        f.maxHourlyDropPercent = ui.input('text', '10', { inputmode: 'decimal' });
        runGrid.append(
            ui.field('Запись не чаще, мин', f.writeIntervalMin),
            ui.field('Изменение за проход, %', f.maxChangePercent),
            ui.field('Снижение за час, %', f.maxHourlyDropPercent, 'Суммарно за скользящий час')
        );
        function disclosure(title) {
            const element = node('details', 'fpt-dumper-disclosure');
            const head = node('summary');
            const value = node('span', 'fpt-dumper-disclosure-value');
            head.append(node('span', 'fpt-dumper-disclosure-title', title), value);
            const body = node('div', 'fpt-dumper-disclosure-body');
            element.append(head, body);
            return { element, body, value };
        }
        const priceSection = ui.section('Правило цены');
        const strategyHint = node('p', 'fpt-dumper-explanation');
        const basics = node('div', 'fpt-dumper-grid');
        basics.append(ui.field('Минимум', f.minPrice, 'Цена продавца, ниже которой не опускаемся'), ui.field('Проверка рынка, мин', f.intervalMin, 'От 1 минуты до суток'));
        priceSection.append(strategyGrid, strategyHint, basics, node('p', 'fpt-dumper-explanation', 'Действующий минимум — больший из указанного минимума и суммы себестоимости с прибылью.'));
        const costs = disclosure('Себестоимость и прибыль');
        const costGrid = node('div', 'fpt-dumper-grid');
        costGrid.append(ui.field('Себестоимость', f.cost), ui.field('Прибыль', f.minProfit, 'Комиссия покупателя не вычитается'));
        costs.body.append(costGrid, f.useCostBasis.element);
        const raising = disclosure('Повышение и точность');
        const raiseGrid = node('div', 'fpt-dumper-grid');
        raiseGrid.append(ui.field('Потолок', f.ceiling, 'Обязателен для автоповышения'), ui.field('Точность цены', f.quantum, lot.kind === 'chips' ? 'Укажите явно, например 0.0001' : 'Шаг округления, например 0.01'));
        raising.body.append(f.allowRaise.element, raiseGrid);
        const limits = disclosure('Частота и защитные лимиты');
        limits.body.append(runGrid);
        const priceForm = node('div', 'fpt-dumper-price-form');
        priceForm.append(priceSection, costs.element, raising.element, limits.element);
        pricePanel.append(priceForm, summary);

        // --- Вкладка «Конкуренты» ------------------------------------------------------
        const compPanel = panels.competitors;
        const compSection = ui.section('Как отбирать', lot.kind === 'chips'
            ? 'Для валюты сравниваются только предложения того же сервера и стороны.'
            : 'По умолчанию нужны совпадения всех опубликованных параметров раздела. Регион и прочее, чего нет в схеме, сравнить можно только словами или выбором предложений.');
        f.mode = ui.select([['schema', 'По параметрам'], ['selected', 'Только выбранные']], 'schema');
        f.requiredWords = node('textarea', 'fpt-auto-input fpt-dumper-words');
        f.requiredWords.rows = 2;
        f.requiredWords.placeholder = 'Через запятую или с новой строки';
        f.excludedWords = node('textarea', 'fpt-auto-input fpt-dumper-words');
        f.excludedWords.rows = 2;
        f.excludedWords.placeholder = 'Достаточно любого';
        f.minRating = ui.select([['0', 'Любой'], ['3', 'От 3'], ['4', 'От 4'], ['5', 'Только 5']], '0');
        const compGrid = node('div', 'fpt-dumper-grid');
        compGrid.append(ui.field('Режим', f.mode), ui.field('Рейтинг продавца', f.minRating));
        const words = disclosure('Словесные фильтры');
        const wordGrid = node('div', 'fpt-dumper-grid');
        wordGrid.append(ui.field('Обязательные слова', f.requiredWords, 'Должны встретиться все'), ui.field('Исключающие слова', f.excludedWords, 'Проверяются по карточке'));
        words.body.append(wordGrid);
        f.onlineOnly = check('Только продавцы онлайн', false);
        f.autoOnly = check('Только с автовыдачей', false);
        f.onlySellers = check('Только выбранные продавцы', false);
        const checksRow = node('div', 'fpt-dumper-checks');
        checksRow.append(f.onlineOnly.element, f.autoOnly.element, f.onlySellers.element);
        compSection.append(compGrid, checksRow);
        const fieldsBox = node('div', 'fpt-dumper-fields');
        const picksBox = node('div', 'fpt-dumper-picks');
        const resultsBox = node('div', 'fpt-dumper-results');
        compPanel.append(compSection, words.element, fieldsBox, picksBox, resultsBox);

        // --- Вкладка «История» -----------------------------------------------------------
        const historyList = node('ol', 'fpt-dumper-history');
        const historyFilters = node('div', 'fpt-dumper-filters');
        state.historyFilter = 'all';
        for (const [id, label] of [['all', 'Все'], ['write', 'Изменения цены'], ['attention', 'Паузы и ошибки']]) {
            const button = ui.button(label);
            button.dataset.filter = id;
            button.setAttribute('aria-pressed', String(id === 'all'));
            button.addEventListener('click', () => {
                state.historyFilter = id;
                [...historyFilters.children].forEach(child => child.setAttribute('aria-pressed', String(child === button)));
                renderHistory();
            });
            historyFilters.append(button);
        }
        panels.history.append(historyFilters, historyList);

        // --- Подвал ------------------------------------------------------------------------
        const footerStatus = node('span', 'fpt-dumper-footer-status');
        footerStatus.setAttribute('aria-live', 'polite');
        const automation = makeSwitch('Автоматизация этого лота', false);
        const automationWrap = node('div', 'fpt-dumper-automation');
        automationWrap.append(node('span', '', 'Автоматизация'), automation.element);
        const copyButton = ui.button('Копировать', { iconName: 'content_copy', title: 'Скопировать настройки на другие лоты (копии выключены)' });
        const checkButton = ui.button('Проверить рынок', { iconName: 'fact_check' });
        const saveButton = ui.button('Сохранить', { kind: 'primary', iconName: 'save' });
        const more = node('details', 'fpt-dumper-more');
        more.append(node('summary', '', 'Ещё'), copyButton);
        const footerActions = node('div', 'fpt-dumper-footer-actions');
        footerActions.append(automationWrap, more, checkButton, saveButton);
        dialog.footer.append(footerStatus, footerActions);

        // Списки конкурентов редактируются кнопками в результатах проверки.
        const lists = { selected: [], excludedSellers: [], sellers: [], ignoreFields: [] };

        function fill(rule) {
            state.filling = true;
            f.strategy.value = rule.strategy;
            f.position.value = String(rule.strategy === 'position' ? rule.position : 2);
            f.stepValue.value = rule.step?.value ?? '';
            f.stepMode.value = rule.step?.mode || 'amount';
            for (const name of ['minPrice', 'cost', 'minProfit', 'ceiling', 'quantum']) f[name].value = rule[name] ?? '';
            f.useCostBasis.input.checked = Boolean(rule.useCostBasis);
            f.allowRaise.input.checked = Boolean(rule.allowRaise);
            f.intervalMin.value = String(rule.intervalMin ?? 5);
            f.writeIntervalMin.value = String(rule.limits?.writeIntervalMin ?? 5);
            f.maxChangePercent.value = rule.limits?.maxChangePercent ?? '5';
            f.maxHourlyDropPercent.value = rule.limits?.maxHourlyDropPercent ?? '10';
            const c = rule.competitors || {};
            f.mode.value = c.mode || 'schema';
            f.requiredWords.value = (c.requiredWords || []).join(', ');
            f.excludedWords.value = (c.excludedWords || []).join(', ');
            f.minRating.value = String(c.minRating || 0);
            f.onlineOnly.input.checked = Boolean(c.onlineOnly);
            f.autoOnly.input.checked = Boolean(c.autoOnly);
            f.onlySellers.input.checked = Boolean(c.onlySellers);
            lists.selected = (c.selected || []).map(item => ({ ...item }));
            lists.excludedSellers = (c.excludedSellers || []).map(item => ({ ...item }));
            lists.sellers = (c.sellers || []).map(item => ({ ...item }));
            lists.ignoreFields = [...(c.ignoreFields || [])];
            for (const select of [f.strategy, f.stepMode, f.mode, f.minRating]) select.dispatchEvent(new Event('change', { bubbles: true }));
            state.filling = false;
            renderStrategy();
            renderPicks();
        }

        function collect() {
            return {
                strategy: f.strategy.value,
                position: Number(f.position.value),
                step: { mode: f.stepMode.value, value: f.stepValue.value.trim() },
                minPrice: f.minPrice.value.trim(), cost: f.cost.value.trim(), minProfit: f.minProfit.value.trim(),
                ceiling: f.ceiling.value.trim(), quantum: f.quantum.value.trim(),
                useCostBasis: f.useCostBasis.input.checked, allowRaise: f.allowRaise.input.checked,
                intervalMin: Number(f.intervalMin.value),
                limits: { writeIntervalMin: Number(f.writeIntervalMin.value), maxChangePercent: f.maxChangePercent.value.trim(), maxHourlyDropPercent: f.maxHourlyDropPercent.value.trim() },
                competitors: {
                    mode: f.mode.value, ignoreFields: lists.ignoreFields.slice(), selected: lists.selected.slice(),
                    requiredWords: textList(f.requiredWords.value), excludedWords: textList(f.excludedWords.value),
                    minRating: Number(f.minRating.value), onlineOnly: f.onlineOnly.input.checked, autoOnly: f.autoOnly.input.checked,
                    excludedSellers: lists.excludedSellers.slice(), onlySellers: f.onlySellers.input.checked, sellers: lists.sellers.slice()
                }
            };
        }

        function markDirty() {
            if (state.filling) return;
            state.dirty = JSON.stringify(collect()) !== state.saved;
            ctx.drafts.set(key, state.dirty ? collect() : null);
            renderStrategy();
            renderFooter();
            renderSummary();
        }

        function renderStrategy() {
            positionField.hidden = f.strategy.value !== 'position';
            strategyHint.textContent = f.strategy.value === 'position'
                ? `Цена конкурента на месте ${f.position.value || 'N'} минус шаг. Место считается среди отобранных конкурентов; если их меньше, цена не меняется.`
                : 'Цена самого дешёвого подходящего конкурента минус шаг. Если подходящих конкурентов нет, цена не меняется.';
            costs.value.textContent = `Себестоимость ${f.cost.value || (f.useCostBasis.input.checked ? 'из «Финансов»' : 'не задана')} · прибыль ${f.minProfit.value || '0'}`;
            raising.value.textContent = `${f.allowRaise.input.checked ? `Повышение до ${f.ceiling.value || '…'}` : 'Повышение выключено'} · точность ${f.quantum.value || 'не задана'}`;
            limits.value.textContent = `Запись от ${f.writeIntervalMin.value || '…'} мин · за проход ${f.maxChangePercent.value || '…'}% · за час ${f.maxHourlyDropPercent.value || '…'}%`;
            const wordCount = textList(f.requiredWords.value).length + textList(f.excludedWords.value).length;
            words.value.textContent = wordCount ? `Задано слов: ${wordCount}` : 'Без ограничений по словам';
        }

        function renderFooter() {
            const rule = state.rule;
            const rt = state.runtime || {};
            automation.input.checked = Boolean(rule?.enabled);
            const checkFresh = state.lastCheck && Date.now() - state.lastCheck.at < 15 * 60 * 1000;
            const matching = state.lastCheckDraft === JSON.stringify(collect());
            const canEnable = !state.dirty && rule?.revision > 0 && checkFresh && state.lastCheck.ok && state.lastCheckSaved && matching;
            automation.input.disabled = state.busy || (!rule?.enabled && !canEnable);
            saveButton.disabled = state.busy || !state.loaded;
            checkButton.disabled = state.busy || !state.loaded;
            let text = '';
            if (!state.loaded) text = state.loadError || 'Загружаем настройки…';
            else if (state.dirty) text = 'Есть несохранённые изменения — сохраните, затем проверьте рынок';
            else if (rule?.enabled) text = ctx.enabled ? 'Автоматизация работает' : 'Правило включено; выполнение остановлено общим выключателем аккаунта';
            else if (rt.status === 'paused') text = `Пауза: ${PAUSE_TEXT[rt.pauseReason] || rt.pauseReason}. Проверьте и включите заново.`;
            else if (!rule?.revision) text = 'Настройки ещё не сохранены';
            else if (!checkFresh) text = 'Для включения нужна свежая проверка';
            else if (!matching || !state.lastCheckSaved) text = 'Проверьте рынок для сохранённых настроек';
            else if (!state.lastCheck.ok) text = 'Проверка не пройдена — включение недоступно';
            else text = 'Проверка пройдена — можно включить';
            footerStatus.textContent = text;
            const status = statusOf({ ...rule, runtime: rt }, ctx.enabled);
            const statusKey = JSON.stringify(status);
            if (state.statusKey !== statusKey) {
                state.statusKey = statusKey;
                dialogStatus.replaceChildren(ui.pill(status.text, status.tone), node('span', '', status.detail || ''));
            }
        }

        function renderSummary(result) {
            if (result !== undefined) state.viewResult = result;
            result = state.viewResult;
            const stale = Boolean(result && state.lastCheckDraft !== JSON.stringify(collect()));
            const expired = Boolean(result && Date.now() - (state.lastCheck?.at || result.at || 0) >= 15 * 60 * 1000);
            const renderKey = JSON.stringify([result, stale, expired, state.draftRestored, state.runtime.lastCheck]);
            if (renderKey === state.summaryKey) return;
            state.summaryKey = renderKey;
            summary.replaceChildren();
            summary.dataset.stale = String(stale || expired);
            compactResult.replaceChildren();
            const heading = node('h3', 'fpt-dumper-summary-title', 'Расчёт цены');
            summary.append(heading);
            if (state.draftRestored) summary.append(ui.notice('Восстановлен несохранённый черновик.', 'info'));
            if (!result) {
                summary.append(node('p', 'fpt-dumper-explanation', 'Проверьте рынок, чтобы увидеть расчётную цену и причины решения. Проверка сама по себе цену не меняет.'));
                const last = state.runtime.lastCheck;
                if (last) summary.append(node('p', 'fpt-dumper-explanation', `Последняя проверка ${ui.formatDateTime(last.at)}: ${ACTION_TEXT[last.action] || last.action || '—'}, подходящих ${last.competitors}.`));
                compactResult.textContent = 'Расчёта для текущих настроек пока нет. Проверка рынка не меняет цену.';
                return;
            }
            const d = result.decision || {};
            const money = value => value === null || value === undefined || value === '' ? '—' : `${value} ${result.currencyUnit || ''}`.trim();
            if (stale || expired) summary.append(ui.notice(stale ? 'Настройки изменились — расчёт неактуален. Проверьте рынок заново.' : 'Проверке больше 15 минут. Для включения проверьте рынок заново.', 'warning'));
            const pricePair = node('div', 'fpt-dumper-price-pair');
            const priceValue = (label, value) => {
                const cell = node('div');
                cell.append(node('span', '', label), node('strong', '', money(value)));
                return cell;
            };
            pricePair.append(priceValue('Текущая цена продавца', result.own?.price), node('span', 'fpt-dumper-price-arrow', '→'), priceValue('Расчётная цена продавца', d.target));
            summary.append(pricePair, node('p', 'fpt-dumper-decision', ACTION_TEXT[d.action] || d.action || 'Нет решения'));
            const blockers = [...new Set(result.blockers || [])];
            blockers.forEach(text => summary.append(ui.notice(text, 'error')));
            const reasons = [...new Set(d.reasons || [])].filter(text => !blockers.includes(text));
            if (reasons.length) summary.append(node('p', 'fpt-dumper-explanation', reasons.join(' ')));
            summary.append(node('p', 'fpt-dumper-summary-note', 'Проверка сама по себе цену не меняет.'));
            const grid = node('dl', 'fpt-dumper-facts');
            const fact = (label, value) => {
                const pair = node('div', 'fpt-dumper-fact');
                pair.append(node('dt', '', label), node('dd', '', value ?? '—'));
                grid.appendChild(pair);
            };
            fact('Конкурентов', `${result.selection?.included.length ?? 0} подходят · ${result.selection?.excludedTotal ?? 0} исключено`);
            fact('Опорная цена в выдаче', money(d.reference));
            fact('Ваше место', d.currentPlace ? `${d.currentPlace.from === d.currentPlace.to ? d.currentPlace.from : `${d.currentPlace.from}–${d.currentPlace.to}`}` : null);
            fact('Действующий минимум', money(result.floor));
            fact('Проверено', ui.formatDateTime(state.lastCheck?.at || result.at));
            fact('Пересчёт цены', result.conversion?.verified ? `Цена продавца ×${Number(result.conversion.coefficient).toFixed(4)} = цена в выдаче` : 'Комиссия не подтверждена');
            summary.appendChild(grid);
            const notes = [...new Set([...(result.notes || []), result.conversion?.note].filter(Boolean))];
            if (notes.length) {
                const details = node('details', 'fpt-dumper-summary-details');
                details.append(node('summary', '', 'Подробности расчёта'));
                notes.forEach(text => details.append(node('p', 'fpt-dumper-explanation', text)));
                summary.append(details);
            }
            compactResult.textContent = `${stale || expired ? 'Неактуальный расчёт · ' : ''}${money(result.own?.price)} → ${money(d.target)} · ${ACTION_TEXT[d.action] || d.action || 'Нет решения'}`;
        }

        function sellerChip(list, item, label) {
            const chip = node('span', 'fpt-dumper-chip');
            chip.append(node('span', '', `${label}: ${item.name || item.sellerName || item.id}`));
            const remove = node('button', 'fpt-dumper-chip-remove', '×');
            remove.type = 'button';
            remove.setAttribute('aria-label', 'Убрать');
            remove.addEventListener('click', () => {
                lists[list] = lists[list].filter(other => list === 'selected' ? other.offerId !== item.offerId : other.id !== item.id);
                renderPicks();
                renderResults(state.viewResult);
                markDirty();
            });
            chip.appendChild(remove);
            return chip;
        }

        function renderPicks() {
            picksBox.replaceChildren();
            const chips = [
                ...lists.selected.map(item => sellerChip('selected', { ...item, name: item.title ? `${item.title.slice(0, 40)} (${item.sellerName || item.offerId})` : item.offerId }, 'Предложение')),
                ...lists.excludedSellers.map(item => sellerChip('excludedSellers', item, 'Исключён')),
                ...lists.sellers.map(item => sellerChip('sellers', item, 'Продавец'))
            ];
            if (!chips.length) return;
            picksBox.appendChild(node('h4', 'fpt-dumper-subtitle', 'Выбранные предложения и продавцы'));
            const row = node('div', 'fpt-dumper-chips');
            row.append(...chips);
            picksBox.appendChild(row);
        }

        function rowActions(item, { excluded = false } = {}) {
            const wrap = node('div', 'fpt-dumper-row-actions');
            const add = (label, handler, title) => {
                const btn = node('button', 'fpt-dumper-link', label);
                btn.type = 'button';
                if (title) btn.title = title;
                btn.addEventListener('click', () => { handler(); renderPicks(); renderResults(state.viewResult); markDirty(); });
                wrap.appendChild(btn);
            };
            const picked = lists.selected.find(p => p.offerId === item.offerId);
            if (item.reasons?.some(r => /подтвердите/.test(r)) && picked) {
                add('Подтвердить', () => { picked.fingerprint = item.fingerprint; picked.title = item.title; picked.confirmedAt = Date.now(); }, 'Принять новое название и характеристики');
            } else if (!picked && item.fingerprint && !item.reasons?.includes('Собственное предложение')) {
                add('Выбрать', () => lists.selected.push({ offerId: item.offerId, sellerId: item.sellerId, sellerName: item.sellerName, title: item.title, fingerprint: item.fingerprint, confirmedAt: Date.now() }), 'Сравнивать с этим предложением');
            }
            if (item.sellerId && !item.reasons?.includes('Собственное предложение')) {
                if (!lists.excludedSellers.some(s => s.id === item.sellerId)) add('Исключить продавца', () => lists.excludedSellers.push({ id: item.sellerId, name: item.sellerName }));
                if (!excluded && !lists.sellers.some(s => s.id === item.sellerId)) add('В свои продавцы', () => lists.sellers.push({ id: item.sellerId, name: item.sellerName }), 'Для режима «только выбранные продавцы»');
            }
            return wrap;
        }

        function describe(item) {
            const wrap = node('div', 'fpt-dumper-offer');
            wrap.title = item.title || `Предложение ${item.offerId}`;
            wrap.appendChild(node('span', 'fpt-dumper-offer-title', item.title || `Предложение ${item.offerId}`));
            const details = [item.sellerName, item.rating !== null && item.rating !== undefined ? `★${item.rating}` : null, item.online ? 'онлайн' : null, item.auto ? 'автовыдача' : null,
                item.server, item.side, ...Object.entries(item.fields || {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(' · ');
            if (details) wrap.appendChild(node('span', 'fpt-dumper-offer-meta', details));
            return wrap;
        }

        function renderResults(result) {
            fieldsBox.replaceChildren();
            resultsBox.replaceChildren();
            if (!result) {
                resultsBox.append(node('p', 'fpt-dumper-explanation', 'После проверки здесь появятся подходящие предложения и причины исключения остальных.'));
                const button = ui.button('Проверить рынок', { iconName: 'fact_check' });
                button.addEventListener('click', () => checkButton.click());
                resultsBox.append(button);
                return;
            }
            const fields = result.selection?.fields || [];
            if (fields.length) {
                fieldsBox.appendChild(node('h4', 'fpt-dumper-subtitle', 'Параметры раздела, которые сравниваются'));
                const row = node('div', 'fpt-dumper-checks');
                for (const field of fields) {
                    const own = field.values ? (field.values.label || field.values.value) : '—';
                    const box = check(`${field.label || field.id}: ${own}`, !lists.ignoreFields.includes(field.id), 'Снятие галочки ослабляет отбор — делайте это осознанно');
                    box.input.addEventListener('change', () => {
                        lists.ignoreFields = box.input.checked ? lists.ignoreFields.filter(id => id !== field.id) : [...new Set([...lists.ignoreFields, field.id])];
                        markDirty();
                    });
                    row.appendChild(box.element);
                }
                fieldsBox.appendChild(row);
            } else if (lot.kind === 'lots' && result.market?.schema && !result.market.schema.present) {
                fieldsBox.appendChild(ui.notice('В этом разделе нет товарной схемы. Автоматический отбор запрещён — выберите конкретные предложения кнопкой «Выбрать».', 'warning'));
            }
            const included = result.selection?.included || [];
            resultsBox.appendChild(node('h4', 'fpt-dumper-subtitle', `Подходят (${included.length})`));
            if (included.length) {
                const table = ui.table(['Место', 'Цена в выдаче', 'Предложение', 'Почему', ''], included.map(item => [
                    item.place.from === item.place.to ? String(item.place.from) : `${item.place.from}–${item.place.to}`,
                    `${item.price} ${item.unit || ''}`.trim(), describe(item), item.reasons.join('; '), rowActions(item)
                ]));
                const position = f.strategy.value === 'position' ? Number(f.position.value) : 1;
                [...table.querySelectorAll('tbody tr')].forEach((row, index) => {
                    const item = included[index];
                    if (item.place.from <= position && item.place.to >= position && item.price === result.decision?.reference) {
                        row.classList.add('fpt-dumper-reference');
                        row.querySelector('.fpt-dumper-offer')?.append(ui.pill('Опорное предложение', 'success'));
                    }
                });
                resultsBox.appendChild(table);
            } else {
                resultsBox.appendChild(node('p', 'fpt-auto-empty', 'Подходящих конкурентов нет — цена не изменится.'));
            }
            const excluded = result.selection?.excluded || [];
            const counts = Object.entries(result.selection?.reasonCounts || {}).sort((a, b) => b[1] - a[1]);
            const head = node('h4', 'fpt-dumper-subtitle', `Исключены (${result.selection?.excludedTotal ?? 0})`);
            resultsBox.appendChild(head);
            if (counts.length) {
                const row = node('div', 'fpt-dumper-chips');
                counts.slice(0, 8).forEach(([reason, count]) => row.appendChild(ui.pill(`${reason} — ${count}`)));
                resultsBox.appendChild(row);
            }
            if (excluded.length) {
                const details = node('details', 'fpt-dumper-excluded');
                details.appendChild(node('summary', '', `Показать ${excluded.length}${result.selection.excludedTotal > excluded.length ? ` из ${result.selection.excludedTotal}` : ''}`));
                details.appendChild(ui.table(['Цена', 'Предложение', 'Причина', ''], excluded.map(item => [
                    item.price ? `${item.price} ${item.unit || ''}`.trim() : '—', describe(item), item.reasons.join('; '), rowActions(item, { excluded: true })
                ])));
                resultsBox.appendChild(details);
            }
        }

        function renderHistory() {
            historyList.replaceChildren();
            const entries = (state.history || []).filter(entry => state.historyFilter === 'all' || (state.historyFilter === 'write' ? entry.type === 'write' : ['pause', 'error'].includes(entry.type)));
            if (!entries.length) { historyList.append(node('li', 'fpt-auto-empty', state.history?.length ? 'В этом фильтре событий нет.' : 'Событий пока нет.')); return; }
            for (const entry of entries) {
                const item = node('li', 'fpt-dumper-history-item');
                item.dataset.type = entry.type;
                const time = node('time', '', ui.formatDateTime(entry.at));
                if (Number.isFinite(entry.at)) {
                    time.dateTime = new Date(entry.at).toISOString();
                    time.title = new Date(entry.at).toLocaleString('ru-RU');
                }
                const text = node(entry.type === 'write' ? 'strong' : 'span', 'fpt-dumper-history-text', entry.text);
                item.append(time, node('span', 'fpt-dumper-history-type', HISTORY_TYPES[entry.type] || entry.type), text);
                historyList.append(item);
            }
        }

        async function loadHistory() {
            if (state.historyLoading) return;
            state.historyLoading = true;
            historyList.replaceChildren(node('li', 'fpt-auto-empty', 'Загружаем…'));
            try {
                state.history = await call('history', { ref, limit: 200 });
                renderHistory();
            } catch (error) {
                historyList.replaceChildren(node('li', 'fpt-auto-empty', error.message));
            } finally { state.historyLoading = false; }
        }

        function toast(text, kind = 'success') {
            root.FPTPopupUI.showToast(popup, text, kind);
        }

        async function busy(task) {
            if (state.busy || !state.loaded) return;
            state.busy = true;
            renderFooter();
            dialog.setBusy(true);
            try { return await task(); }
            finally {
                dialog.setBusy(false);
                state.busy = false;
                renderFooter();
                if (state.errorFocus) {
                    state.errorFocus.focus();
                    state.errorFocus.scrollIntoView({ block: 'nearest' });
                    state.errorFocus = null;
                }
            }
        }

        async function save() {
            const rule = await call('save', { ref, rule: collect(), expectedRevision: state.rule?.revision || null });
            state.rule = rule;
            state.saved = JSON.stringify(collect());
            state.dirty = false;
            state.draftRestored = false;
            ctx.drafts.delete(key);
            state.lastCheckSaved = Boolean(state.lastCheck && state.lastCheckDraft === state.saved);
            ctx.refresh();
            renderSummary();
            return rule;
        }

        const formError = ui.notice('', 'error');
        formError.hidden = true;
        dialog.body.prepend(formError);
        function showError(error) {
            const message = error.message || String(error);
            formError.textContent = message;
            formError.hidden = false;
            formError.tabIndex = -1;
            revealErrorField(message);
            toast(message, 'error');
        }

        function revealErrorField(message) {
            const fields = [
                [/минимальн|нижней границ|минимум/i, f.minPrice], [/себестоим/i, f.cost], [/прибыл/i, f.minProfit],
                [/потол/i, f.ceiling], [/точност/i, f.quantum], [/место/i, f.position], [/шаг/i, f.stepValue],
                [/интервал проверки/i, f.intervalMin], [/интервал записи/i, f.writeIntervalMin],
                [/за проход/i, f.maxChangePercent], [/за час/i, f.maxHourlyDropPercent]
            ];
            const field = fields.filter(([pattern]) => pattern.test(message)).sort((a, b) => message.search(a[0]) - message.search(b[0]))[0]?.[1];
            if (field) {
                selectTab('price');
                field.closest('details')?.setAttribute('open', '');
                field.setAttribute('aria-invalid', 'true');
                state.errorFocus = field;
            } else { state.errorFocus = formError; }
        }

        saveButton.addEventListener('click', () => busy(async () => {
            try {
                const wasEnabled = state.rule?.enabled;
                const rule = await save();
                toast(wasEnabled && !rule.enabled ? 'Сохранено. Условия изменились — автоматизация выключена до новой проверки.' : 'Настройки лота сохранены.');
            } catch (error) {
                showError(error);
            }
        }));

        checkButton.addEventListener('click', () => busy(async () => {
            const draft = collect();
            try {
                const result = await call('check', { ref, rule: draft });
                state.lastCheck = { ...result, at: Date.now() };
                state.lastCheckDraft = JSON.stringify(draft);
                state.lastCheckSaved = state.lastCheckDraft === state.saved;
                state.history = null;
                renderSummary(result);
                renderResults(result);
                if (!result.ok && result.blockers?.length) revealErrorField(result.blockers.join(' '));
                if (lot.kind === 'chips' && !f.quantum.value.trim() && result.own?.price) {
                    const decimals = (String(result.own.price).split('.')[1] || '').length;
                    f.quantum.placeholder = decimals ? `например ${(1 / 10 ** Math.max(decimals, 2)).toFixed(Math.max(decimals, 2))}` : 'например 0.01';
                }
                toast(result.ok ? 'Проверка выполнена. Цена не менялась.' : 'Проверка выполнена, но есть препятствия — см. сводку.', result.ok ? 'success' : 'warning');
            } catch (error) {
                state.lastCheck = null;
                state.lastCheckSaved = false;
                renderSummary(null);
                showError(error);
            }
        }));

        automation.input.addEventListener('change', () => {
            // Значение читается до busy(): перерисовка подвала выставляет переключатель по сохранённому правилу.
            const wanted = automation.input.checked;
            return busy(() => toggleAutomation(wanted));
        });

        async function toggleAutomation(wanted) {
            try {
                if (wanted) {
                    await call('enable', { ref, expectedRevision: state.rule?.revision ?? null });
                    toast('Автоматизация лота включена.');
                } else {
                    await call('disable', { ref });
                    toast('Автоматизация лота выключена.');
                }
                const fresh = await call('get', { ref });
                state.rule = fresh.rule;
                state.runtime = fresh.runtime;
                state.history = null;
                ctx.refresh();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        // Копирование: копии создаются выключенными и требуют своей проверки.
        const copyPanel = node('div', 'fpt-dumper-copy');
        copyPanel.hidden = true;
        dialog.body.appendChild(copyPanel);
        copyButton.addEventListener('click', () => {
            more.open = false;
            if (!copyPanel.hidden) { copyPanel.hidden = true; return; }
            if (!state.rule?.revision || state.dirty) { toast('Сначала сохраните настройки этого лота.', 'warning'); return; }
            copyPanel.replaceChildren();
            const others = ctx.lots.filter(other => other.kind === lot.kind && other.offerId !== lot.offerId);
            const picker = ui.lotPicker(others, { describe: other => other.categoryName });
            const apply = ui.button('Скопировать на выбранные', { kind: 'primary' });
            apply.addEventListener('click', () => busy(async () => {
                const targets = picker.selected().map(refOf);
                if (!targets.length) { toast('Выберите лоты.', 'warning'); return; }
                try {
                    const { created } = await call('copy', { ref, targets });
                    toast(`Создано правил: ${created.length}. Они выключены — проверьте каждое.`);
                    copyPanel.hidden = true;
                    ctx.refresh();
                } catch (error) {
                    toast(error.message, 'error');
                }
            }));
            copyPanel.append(ui.notice('Копии создаются выключенными. Выбранные конкуренты переносятся только в лоты того же раздела.', 'info'), picker.element, apply);
            copyPanel.hidden = false;
            copyPanel.scrollIntoView({ block: 'nearest' });
        });

        dialog.body.addEventListener('input', event => {
            if (copyPanel.contains(event.target)) return;
            event.target.removeAttribute('aria-invalid');
            formError.hidden = true;
            markDirty();
        });
        dialog.body.addEventListener('change', event => { if (!copyPanel.contains(event.target)) markDirty(); renderStrategy(); });

        selectTab('price');
        renderSummary(null);
        renderResults(null);
        renderFooter();
        state.busy = true;
        dialog.setBusy(true);
        (async () => {
            try {
                const data = await call('get', { ref });
                state.rule = data.rule;
                state.runtime = data.runtime || {};
                fill(data.rule);
                state.saved = data.rule.revision ? JSON.stringify(collect()) : null;
                const draft = ctx.drafts.get(key);
                if (draft) {
                    fill(draft);
                    state.draftRestored = true;
                }
                state.loaded = true;
                markDirty();
            } catch (error) {
                state.loadError = error.message;
                summary.replaceChildren(ui.notice(error.message, 'error'));
            } finally {
                dialog.setBusy(false);
                state.busy = false;
                renderFooter();
            }
        })();
        return dialog;
    }

    // --- Страница ---------------------------------------------------------------------------

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page.dataset.fptDumperMounted === 'true' || !UI()) return;
        page.dataset.fptDumperMounted = 'true';
        const ui = UI();
        const { node } = ui;

        const help = node('aside', 'fpt-lot-help-popover fpt-dumper-help');
        help.hidden = true;
        help.appendChild(node('h2', '', 'Автодемпер'));
        const helpList = node('ul');
        [
            'Каждый лот настраивается отдельно: кнопка «Настроить» открывает окно с ценой, конкурентами и историей.',
            'Конкуренты отбираются строго: совпадают все опубликованные параметры раздела, свои предложения исключены. Причину каждого исключения видно в результатах проверки.',
            'Цена меняется только по подтверждённой выборке и проверенной комиссии калькулятора FunPay; ниже минимума — никогда.',
            'Новые правила выключены. Включить можно после проверки; изменение условий выключает правило до новой проверки.',
            'Если цену изменили вручную, демпер этого лота встаёт на паузу. Закрытый браузер — пробел наблюдения в истории.'
        ].forEach(text => helpList.appendChild(node('li', '', text)));
        help.appendChild(helpList);
        const header = root.FPTPopupUI.ensureCategoryHeader(page, 'Автодемпер', {
            onHelp: event => {
                help.hidden = !help.hidden;
                event.currentTarget.setAttribute('aria-expanded', help.hidden ? 'false' : 'true');
            }
        });
        const helpAnchor = node('span', 'fpt-ad-help-anchor');
        if (header?.helpButton) { header.helpButton.before(helpAnchor); helpAnchor.append(header.helpButton, help); }

        const view = node('div', 'fpt-dumper');
        const controls = node('div', 'fpt-dumper-controls');
        const master = makeSwitch('Автодемпер работает', true);
        const masterWrap = node('div', 'fpt-dumper-master');
        masterWrap.append(node('span', '', 'Работа автодемпера'), master.element);
        const search = ui.input('search', '', { placeholder: 'Поиск по лотам', 'aria-label': 'Поиск по лотам' });
        search.classList.add('fpt-dumper-search');
        const category = ui.select([['', 'Все категории']], '');
        category.setAttribute('aria-label', 'Категория');
        const refresh = ui.button('Обновить', { iconName: 'refresh' });
        const topLine = node('div', 'fpt-dumper-topline');
        topLine.append(node('p', 'fpt-dumper-explanation', 'Управляйте ценами своих лотов по условиям рынка'));
        if (header?.element) { header.element.classList.add('fpt-dumper-page-header'); header.element.append(masterWrap); }
        else topLine.append(masterWrap);
        const filters = node('div', 'fpt-dumper-filters');
        filters.setAttribute('role', 'group');
        filters.setAttribute('aria-label', 'Состояние лотов');
        const filterButtons = new Map();
        let activeFilter = 'all';
        for (const [id, label] of [['all', 'Все'], ['active', 'Работают'], ['attention', 'Требуют внимания'], ['off', 'Выключены']]) {
            const button = ui.button(label);
            button.dataset.filter = id;
            button.addEventListener('click', () => { activeFilter = id; render(); });
            filters.append(button);
            filterButtons.set(id, { button, label });
        }
        controls.append(search, category, refresh);
        const banner = node('div', 'fpt-dumper-banner');
        const list = node('div', 'fpt-dumper-list');
        list.setAttribute('role', 'list');
        view.append(topLine, controls, filters, banner, list);
        page.appendChild(view);

        const ctx = { accountId: null, lots: [], rules: new Map(), enabled: true, drafts: new Map(), refresh: () => load() };
        let loading = false;
        let loadError = '';

        function renderCategories() {
            const names = [...new Set(ctx.lots.map(lot => lot.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
            const current = category.value;
            category.replaceChildren(...[['', 'Все категории'], ...names.map(name => [name, name])].map(([value, label]) => {
                const option = node('option', '', label);
                option.value = value;
                option.selected = value === current;
                return option;
            }));
        }

        function render() {
            master.input.checked = ctx.enabled;
            master.input.disabled = loading || !ctx.accountId;
            banner.replaceChildren();
            if (loadError) banner.append(ui.notice(loadError, 'error'));
            if (!ctx.enabled) banner.appendChild(ui.notice('Автодемпер остановлен: ни одно правило этого аккаунта не выполняется. Включённые правила продолжат работу после включения.', 'warning'));
            const query = search.value.trim().toLocaleLowerCase('ru');
            const cat = category.value;
            list.replaceChildren();
            const matching = ctx.lots.filter(lot => (!cat || lot.categoryName === cat)
                && (!query || `${lot.title} ${lot.categoryName} ${lot.offerId}`.toLocaleLowerCase('ru').includes(query)));
            const groupOf = lot => statusOf(ctx.rules.get(keyOf(ctx.accountId, lot)), ctx.enabled).group;
            for (const [id, { button, label }] of filterButtons) {
                const count = id === 'all' ? matching.length : matching.filter(lot => groupOf(lot) === id).length;
                button.textContent = `${label} · ${count}`;
                button.setAttribute('aria-pressed', String(activeFilter === id));
            }
            const visible = matching.filter(lot => activeFilter === 'all' || groupOf(lot) === activeFilter);
            list.setAttribute('aria-busy', String(loading));
            if (!visible.length) {
                list.appendChild(node('p', 'fpt-auto-empty', loading ? 'Загружаем лоты…' : ctx.lots.length ? 'Ничего не найдено. Измените поиск или фильтры.' : loadError ? 'Не удалось получить список. Нажмите «Обновить», чтобы повторить.' : 'Лоты не найдены. Откройте FunPay под своим аккаунтом и нажмите «Обновить».'));
                return;
            }
            for (const lot of visible) {
                const rule = ctx.rules.get(keyOf(ctx.accountId, lot));
                const rt = rule?.runtime || {};
                const status = statusOf(rule, ctx.enabled);
                const item = node('article', 'fpt-dumper-row');
                item.setAttribute('role', 'listitem');
                item.tabIndex = 0;
                item.dataset.offerId = lot.offerId;
                const main = node('div', 'fpt-dumper-row-main');
                main.title = lot.title;
                main.append(node('span', 'fpt-dumper-row-title', lot.title), node('span', 'fpt-dumper-row-meta',
                    [lot.categoryName, lot.kind === 'chips' ? 'валюта' : null, lot.visible === false ? 'не на витрине' : null].filter(Boolean).join(' · ')));
                const last = rt.lastCheck;
                const cell = (label, value) => {
                    const element = node('div', 'fpt-dumper-row-cell');
                    element.append(node('span', 'fpt-dumper-row-label', label), node('span', 'fpt-dumper-row-value', value));
                    return element;
                };
                const price = cell('Последняя цена', last?.price ?? 'Нет проверки');
                const competitors = cell('Подходят', last ? String(last.competitors ?? '—') : 'Нет проверки');
                const checked = cell('Последняя проверка', rt.lastCheckAt || last?.at ? ui.formatDateTime(rt.lastCheckAt || last.at) : 'Нет проверки');
                const pill = ui.pill(status.text, status.tone);
                const statusCell = node('div', 'fpt-dumper-row-state');
                statusCell.append(pill);
                if (status.detail) {
                    const detail = node('span', 'fpt-dumper-row-detail', status.detail);
                    detail.title = status.detail;
                    statusCell.append(detail);
                }
                const configure = ui.button('Настроить', { iconName: 'tune' });
                configure.addEventListener('click', event => { event.stopPropagation(); openLotDialog(popup, ctx, lot); });
                item.addEventListener('click', () => { item.focus(); openLotDialog(popup, ctx, lot); });
                item.addEventListener('keydown', event => {
                    if (['Enter', ' '].includes(event.key) && event.target === item) { event.preventDefault(); openLotDialog(popup, ctx, lot); }
                });
                item.append(main, price, competitors, checked, statusCell, configure);
                list.appendChild(item);
            }
        }

        async function load() {
            if (loading) return;
            loading = true;
            refresh.disabled = true;
            render();
            try {
                const data = await call('list');
                const userId = appUserId();
                const lots = userId ? await chrome.runtime.sendMessage({ action: 'getUserLotsList', userId }) : [];
                if (lots && lots.success === false) throw new Error(lots.error);
                const listed = (Array.isArray(lots) ? lots : []).map(lot => ({
                    kind: lot.kind === 'chips' ? 'chips' : 'lots', offerId: String(lot.id),
                    nodeId: lot.kind === 'chips' ? String(lot.id).split('-')[2] : String(lot.nodeId || ''),
                    title: lot.title || `Лот ${lot.id}`, categoryName: lot.categoryName || '', visible: true
                })).filter(lot => lot.nodeId);
                const seen = new Set(listed.map(lot => `${lot.kind}:${lot.offerId}`));
                // Снятые с витрины лоты с правилами тоже видны — их правила продолжают существовать.
                for (const rule of data.rules) {
                    if (seen.has(`${rule.kind}:${rule.offerId}`)) continue;
                    listed.push({ kind: rule.kind, offerId: rule.offerId, nodeId: rule.nodeId, title: rule.title || `Лот ${rule.offerId}`, categoryName: '', visible: false });
                }
                ctx.accountId = data.accountId;
                ctx.enabled = data.enabled !== false;
                ctx.rules = new Map(data.rules.map(rule => [rule.key, rule]));
                ctx.lots = listed;
                loadError = '';
                renderCategories();
            } catch (error) {
                loadError = error.message || 'Не удалось загрузить автодемпер.';
            } finally {
                loading = false;
                refresh.disabled = false;
            }
            render();
        }

        master.input.addEventListener('change', async () => {
            const enabled = master.input.checked;
            master.input.disabled = true;
            try {
                await call('setGlobal', { enabled });
                ctx.enabled = enabled;
                root.FPTPopupUI.showToast(popup, enabled ? 'Автодемпер включён.' : 'Автодемпер остановлен.', enabled ? 'success' : 'warning');
            } catch (error) {
                master.input.checked = !enabled;
                root.FPTPopupUI.showToast(popup, error.message, 'error');
            } finally {
                master.input.disabled = false;
                render();
            }
        });
        search.addEventListener('input', render);
        category.addEventListener('change', render);
        refresh.addEventListener('click', load);
        root.FPTPopupUI.onPageActivated(page, load);
        if (page.classList.contains('active')) load();
    }

    root.FPTDumperPage = Object.freeze({ mount, openLotDialog });
})(window);
