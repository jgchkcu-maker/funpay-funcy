// Schedules and price rules inside «Управление лотами». Both open as dialogs over the
// lot management page and reuse its lot selection; the background owns every write.
(function (root) {
    'use strict';

    const PAGE_ID = 'lot_io';
    const DAY_OPTIONS = [['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'], ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс']];
    const COMMON_ZONES = ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk',
        'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Europe/Kyiv', 'Europe/Minsk', 'Asia/Almaty', 'UTC'];

    const ui = () => root.FPTAutomationUI;
    const run = (actionId, payload) => root.fptPopupActions.run(PAGE_ID, actionId, payload);

    function browserZone() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'; } catch (_) { return 'Europe/Moscow'; }
    }

    // ---------------------------------------------------------------- Schedules
    async function openScheduleDialog(popup) {
        const { node, button, pill, field, input, select, section, notice, table, formatDateTime } = ui();
        const dialog = root.FPTPopupUI.createDialog(popup, 'Расписание лотов', {
            wide: true,
            description: 'Недельные окна, в которые лоты открыты для новых продаж. Вне окна расписание выключает лот; уже оплаченные заказы выполняются как обычно.'
        });
        dialog.dialog.classList.add('fpt-auto-dialog');
        const status = node('div', 'fpt-auto-status');
        status.setAttribute('aria-live', 'polite');
        const rulesSection = section('Правила', 'Сохранённое правило — черновик. Управлять лотами оно начнёт после включения.');
        const rulesList = node('div', 'fpt-auto-cards');
        rulesSection.appendChild(rulesList);
        const editorSection = section('Правило', 'Часовой пояс сохраняется в правиле и не меняется вслед за настройками компьютера.');
        const lotsSection = section('Лоты', 'Отметьте лоты и привяжите их к правилу. Лот может быть привязан только к одному правилу.');
        const previewSection = section('Предпросмотр');
        previewSection.hidden = true;
        dialog.body.append(status, rulesSection, editorSection, lotsSection, previewSection,
            notice('Расписание работает, пока открыт Chrome. Если компьютер спит или браузер закрыт, переключение произойдёт при следующем запуске — пропущенные переходы не проигрываются.', 'info'));

        let state = { rules: [], bindings: [], status: {} };
        let editing = null;
        let picker = null;

        const setStatus = (text, tone = '') => {
            status.replaceChildren();
            if (text) status.appendChild(notice(text, tone || 'info'));
        };

        // Rule editor.
        const nameInput = input('text', '', { maxlength: '60', placeholder: 'Например, «Вечерние продажи»' });
        const zoneInput = input('text', browserZone(), { list: 'fpt-auto-zones', spellcheck: 'false' });
        const zoneList = node('datalist');
        zoneList.id = 'fpt-auto-zones';
        COMMON_ZONES.forEach(zone => { const option = node('option'); option.value = zone; zoneList.appendChild(option); });
        const windowsWrap = node('div', 'fpt-auto-windows');
        const addWindow = (window = { day: 'mon', start: '09:00', end: '18:00' }) => {
            const row = node('div', 'fpt-auto-window-row');
            const day = select(DAY_OPTIONS, window.day);
            day.dataset.part = 'day';
            const start = input('time', window.start, { step: '60' });
            start.dataset.part = 'start';
            const end = input('text', window.end, { pattern: '\\d{2}:\\d{2}', placeholder: 'ЧЧ:ММ', inputmode: 'numeric', 'aria-label': 'Конец окна' });
            end.dataset.part = 'end';
            const remove = button('Убрать', { iconName: 'close' });
            remove.addEventListener('click', () => row.remove());
            row.append(day, start, node('span', 'fpt-auto-window-dash', '—'), end, remove);
            windowsWrap.appendChild(row);
        };
        const presets = node('div', 'fpt-auto-presets');
        const presetButton = (label, windows) => {
            const element = button(label);
            element.addEventListener('click', () => { windowsWrap.replaceChildren(); windows.forEach(addWindow); });
            presets.appendChild(element);
        };
        presetButton('Будни 09–18', ['mon', 'tue', 'wed', 'thu', 'fri'].map(day => ({ day, start: '09:00', end: '18:00' })));
        presetButton('Каждый вечер 18–02', DAY_OPTIONS.map(([day]) => ({ day, start: '18:00', end: '02:00' })));
        presetButton('Выходные целиком', ['sat', 'sun'].map(day => ({ day, start: '00:00', end: '24:00' })));
        const addButton = button('Добавить окно', { iconName: 'add' });
        addButton.addEventListener('click', () => addWindow());
        const editorActions = node('div', 'fpt-auto-actions');
        const saveButton = button('Сохранить черновик', { kind: 'primary', iconName: 'save' });
        const previewButton = button('Предпросмотр', { iconName: 'visibility' });
        const newButton = button('Новое правило', { iconName: 'add_circle' });
        editorActions.append(saveButton, previewButton, newButton);
        editorSection.append(
            field('Название', nameInput),
            field('Часовой пояс (IANA)', zoneInput, 'Например, Asia/Krasnoyarsk. Окна задаются по времени этого пояса.'),
            zoneList, presets, windowsWrap, addButton,
            node('p', 'fpt-auto-field-hint', 'Окно 22:00–02:00 продолжается после полуночи на следующий день. Круглые сутки — 00:00–24:00.'),
            editorActions
        );

        const collectRule = () => ({
            ruleId: editing?.ruleId,
            name: nameInput.value.trim() || 'Расписание',
            timezone: zoneInput.value.trim(),
            windows: Array.from(windowsWrap.querySelectorAll('.fpt-auto-window-row')).map(row => ({
                day: row.querySelector('[data-part="day"]').value,
                start: row.querySelector('[data-part="start"]').value,
                end: row.querySelector('[data-part="end"]').value.trim()
            }))
        });
        const loadEditor = rule => {
            editing = rule || null;
            nameInput.value = rule?.name || '';
            zoneInput.value = rule?.timezone || browserZone();
            windowsWrap.replaceChildren();
            (rule?.windows?.length ? rule.windows : [{ day: 'mon', start: '09:00', end: '18:00' }]).forEach(addWindow);
            saveButton.querySelector('span:last-child').textContent = rule ? 'Сохранить изменения' : 'Сохранить черновик';
        };

        const renderPreview = (preview, title) => {
            previewSection.hidden = false;
            previewSection.replaceChildren(node('h3', '', title || 'Предпросмотр'));
            if (preview.errors?.length) { previewSection.appendChild(notice(preview.errors.join(' '), 'error')); return; }
            previewSection.appendChild(node('p', 'fpt-auto-lead', preview.openNow ? 'Сейчас окно открыто: лоты могут продаваться.' : 'Сейчас окно закрыто: включённое правило выключит лоты.'));
            previewSection.appendChild(table(['Когда (по поясу правила)', 'Смещение', 'Переход'],
                preview.transitions.map(item => [item.local, item.offset, item.open ? 'Открытие' : 'Закрытие'])));
            if (preview.lots?.length) {
                const label = { activate: 'Будет включён', deactivate: 'Будет выключен', 'not-owned': 'Не включится: выключен не автоматизацией', 'already-active': 'Без изменений', 'already-inactive': 'Без изменений', open: 'Будет открыт', close: 'Будет закрыт', paused: 'Управление приостановлено' };
                previewSection.appendChild(table(['Лот', 'Сейчас при включении'], preview.lots.map(lot => [lot.title || `Лот #${lot.offerId}`, label[lot.decision] || lot.decision])));
            }
        };

        const renderRules = () => {
            rulesList.replaceChildren();
            if (!state.rules.length) { rulesList.appendChild(node('p', 'fpt-auto-empty', 'Правил пока нет. Создайте первое ниже.')); return; }
            for (const rule of state.rules) {
                const card = node('article', 'fpt-auto-card');
                const head = node('div', 'fpt-auto-card-head');
                head.append(node('strong', '', rule.name), pill(rule.enabled ? 'Включено' : 'Черновик', rule.enabled ? 'success' : ''));
                const bound = state.bindings.filter(binding => binding.ruleId === rule.ruleId).length;
                const windows = rule.windows.map(window => `${DAY_OPTIONS.find(([d]) => d === window.day)?.[1] || window.day} ${window.start}–${window.end}`).join(', ');
                card.append(head, node('p', 'fpt-auto-card-meta', `${rule.timezone} · ${windows || 'нет окон — всегда закрыто'}`), node('p', 'fpt-auto-card-meta', `Лотов: ${bound}`));
                const actions = node('div', 'fpt-auto-actions');
                const edit = button('Изменить', { iconName: 'edit' });
                edit.addEventListener('click', () => { loadEditor(rule); nameInput.focus(); });
                const preview = button('Предпросмотр', { iconName: 'visibility' });
                preview.addEventListener('click', async () => {
                    try { renderPreview(await run('lotSchedules', { command: 'preview', ruleId: rule.ruleId }), `Предпросмотр: ${rule.name}`); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                const toggle = button(rule.enabled ? 'Выключить' : 'Включить', { kind: rule.enabled ? '' : 'primary', iconName: rule.enabled ? 'pause' : 'play_arrow' });
                toggle.addEventListener('click', async () => {
                    try {
                        const preview = await run('lotSchedules', { command: 'preview', ruleId: rule.ruleId });
                        renderPreview(preview, rule.enabled ? 'После выключения правила' : 'После включения правила');
                        const changes = (preview.lots || []).filter(lot => ['activate', 'deactivate', 'close', 'open'].includes(lot.decision)).length;
                        const question = rule.enabled
                            ? 'Выключить правило? Снятие блокировки расписания может включить лоты, которые выключало это правило.'
                            : `Включить правило? Сейчас окно ${preview.openNow ? 'открыто' : 'закрыто'}; изменений лотов: ${changes}.`;
                        if (!window.confirm(question)) return;
                        dialog.setBusy(true);
                        await run('lotSchedules', { command: 'setRuleEnabled', ruleId: rule.ruleId, enabled: !rule.enabled, expectedRevision: rule.revision });
                        await reload();
                        setStatus(rule.enabled ? 'Правило выключено.' : 'Правило включено и применено.', 'success');
                    } catch (error) {
                        setStatus(error.message, 'error');
                    } finally {
                        dialog.setBusy(false);
                    }
                });
                const remove = button('Удалить', { kind: 'danger', iconName: 'delete' });
                remove.addEventListener('click', async () => {
                    if (!window.confirm(`Удалить правило «${rule.name}»? Лоты отвяжутся от него.`)) return;
                    try { await run('lotSchedules', { command: 'deleteRule', ruleId: rule.ruleId }); await reload(); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                actions.append(edit, preview, toggle, remove);
                card.appendChild(actions);
                rulesList.appendChild(card);
            }
        };

        const renderLots = async () => {
            lotsSection.querySelector('.fpt-auto-lot-picker')?.remove();
            lotsSection.querySelector('.fpt-auto-actions')?.remove();
            const lots = await ui().listLots(state.bindings);
            const ruleName = id => state.rules.find(rule => rule.ruleId === id)?.name;
            picker = ui().lotPicker(lots, {
                describe: lot => {
                    const binding = state.bindings.find(item => item.offerId === lot.offerId);
                    const lotStatus = state.status[`${state.accountId}:${lot.offerId}`];
                    return [binding?.ruleId ? `правило «${ruleName(binding.ruleId)}»` : '', lotStatus?.error ? `ошибка: ${lotStatus.error}` : ''].filter(Boolean).join(' · ');
                }
            });
            const ruleSelect = select([['', 'Без расписания'], ...state.rules.map(rule => [rule.ruleId, rule.name])], editing?.ruleId || '');
            const bind = button('Привязать отмеченные', { kind: 'primary', iconName: 'link' });
            bind.addEventListener('click', async () => {
                const lots = picker.selected();
                if (!lots.length) { setStatus('Отметьте хотя бы один лот.', 'warning'); return; }
                try {
                    dialog.setBusy(true);
                    await run('lotSchedules', { command: 'bindLots', ruleId: ruleSelect.value || null, lots });
                    await reload();
                    setStatus(ruleSelect.value ? 'Лоты привязаны.' : 'Лоты отвязаны от расписания.', 'success');
                } catch (error) {
                    setStatus(error.message, 'error');
                } finally {
                    dialog.setBusy(false);
                }
            });
            const actions = node('div', 'fpt-auto-actions');
            actions.append(ruleSelect, bind);
            lotsSection.append(picker.element, actions);
        };

        async function reload() {
            state = await run('lotSchedules', { command: 'list' });
            renderRules();
            await renderLots();
            const next = state.nextDueAt ? `Следующая проверка: ${formatDateTime(state.nextDueAt)}.` : '';
            if (next) setStatus(next);
        }

        saveButton.addEventListener('click', async () => {
            try {
                const rule = await run('lotSchedules', { command: 'saveRule', rule: collectRule(), expectedRevision: editing?.revision ?? null });
                editing = rule;
                await reload();
                loadEditor(rule);
                setStatus(rule.enabled ? 'Правило сохранено и применено.' : 'Черновик сохранён. Включите правило, когда проверите предпросмотр.', 'success');
            } catch (error) {
                setStatus(error.message, 'error');
            }
        });
        previewButton.addEventListener('click', async () => {
            try { renderPreview(await run('lotSchedules', { command: 'preview', rule: collectRule() }), 'Предпросмотр черновика'); }
            catch (error) { setStatus(error.message, 'error'); }
        });
        newButton.addEventListener('click', () => loadEditor(null));

        const close = node('button', 'fpt-lot-dialog-button', 'Закрыть');
        close.type = 'button';
        close.addEventListener('click', () => dialog.close());
        dialog.footer.appendChild(close);

        loadEditor(null);
        try { await reload(); } catch (error) { setStatus(error.message, 'error'); }
    }

    // ---------------------------------------------------------------- Prices
    async function openPricingDialog(popup) {
        const { node, button, pill, field, input, select, section, notice, table, formatMoney } = ui();
        const dialog = root.FPTPopupUI.createDialog(popup, 'Цены от себестоимости', {
            wide: true,
            description: 'Правило считает минимальную безопасную цену и целевую цену от вашей себестоимости. Ничего не меняется без предпросмотра и вашего подтверждения.'
        });
        dialog.dialog.classList.add('fpt-auto-dialog');
        const status = node('div', 'fpt-auto-status');
        status.setAttribute('aria-live', 'polite');
        const setStatus = (text, tone = 'info') => { status.replaceChildren(); if (text) status.appendChild(notice(text, tone)); };

        const ruleSection = section('Правило', 'Себестоимость берётся из поля «Себестоимость» лота. Неизвестная себестоимость не считается нулём — такой лот пропускается.');
        const mode = select([['markup', 'Наценка к себестоимости'], ['margin', 'Маржа от цены']], 'markup');
        const value = input('text', '25', { inputmode: 'decimal' });
        const minProfit = input('text', '0', { inputmode: 'decimal' });
        const minMargin = input('text', '0', { inputmode: 'decimal' });
        const feePercent = input('text', '0', { inputmode: 'decimal' });
        const fixedFee = input('text', '0', { inputmode: 'decimal' });
        const step = input('text', '1', { inputmode: 'decimal' });
        const ceiling = input('text', '', { inputmode: 'decimal', placeholder: 'без потолка' });
        const currency = select([['RUB', '₽ RUB'], ['USD', '$ USD'], ['EUR', '€ EUR']], 'RUB');
        const allowRaise = node('input');
        allowRaise.type = 'checkbox';
        const allowRaiseLabel = node('label', 'fpt-auto-check');
        allowRaiseLabel.append(allowRaise, node('span', '', 'Разрешить повышать цену'));
        const explanation = node('p', 'fpt-auto-lead', '');
        const grid = node('div', 'fpt-auto-grid');
        grid.append(
            field('Способ', mode), field('Размер, %', value),
            field('Мин. прибыль с продажи', minProfit), field('Мин. маржа, %', minMargin),
            field('Ваши расходы, % от цены', feePercent, 'Например, комиссия вывода. Комиссия покупателя FunPay сюда не входит.'),
            field('Фикс. расход на продажу', fixedFee),
            field('Шаг цены', step, 'Цена округляется вверх до шага.'), field('Потолок цены', ceiling),
            field('Валюта лотов', currency)
        );
        ruleSection.append(grid, allowRaiseLabel, explanation);
        const updateExplanation = () => {
            const v = Number(String(value.value).replace(',', '.'));
            if (!Number.isFinite(v) || v < 0) { explanation.textContent = ''; return; }
            explanation.textContent = mode.value === 'markup'
                ? `Наценка ${v}% даёт маржу ${(v / (100 + v) * 100).toFixed(2).replace('.', ',')}%.`
                : v < 100 ? `Маржа ${v}% — это наценка ${(v / (100 - v) * 100).toFixed(2).replace('.', ',')}%.` : 'Маржа должна быть меньше 100%.';
        };
        [mode, value].forEach(control => control.addEventListener('input', updateExplanation));
        mode.addEventListener('change', updateExplanation);
        updateExplanation();

        const lotsSection = section('Лоты');
        const previewSection = section('Предпросмотр');
        previewSection.hidden = true;
        const rulesSection = section('Сохранённые правила и автопересчёт', 'Автопересчёт меняет цену привязанных лотов раз в 6 часов, не больше чем на 10% за раз, и останавливается, если вы сами изменили цену.');
        dialog.body.append(status, ruleSection, lotsSection, previewSection, rulesSection);

        const collectRule = () => ({
            mode: mode.value, value: value.value.trim().replace(',', '.'), minProfit: minProfit.value.trim().replace(',', '.'),
            minMarginPercent: minMargin.value.trim().replace(',', '.'), feePercent: feePercent.value.trim().replace(',', '.'),
            fixedFee: fixedFee.value.trim().replace(',', '.'), step: step.value.trim().replace(',', '.'),
            ceiling: ceiling.value.trim().replace(',', '.') || null, currency: currency.value, allowRaise: allowRaise.checked
        });

        let picker = null;
        let state = { rules: [], bindings: [], autoState: {} };
        const loadLots = async () => {
            lotsSection.querySelector('.fpt-auto-lot-picker')?.remove();
            picker = ui().lotPicker(await ui().listLots(state.bindings));
            lotsSection.insertBefore(picker.element, lotsSection.querySelector('.fpt-auto-actions'));
        };

        let currentPreview = null;
        const renderPreview = preview => {
            currentPreview = preview;
            previewSection.hidden = false;
            previewSection.replaceChildren(node('h3', '', 'Предпросмотр'));
            if (preview.explanation) previewSection.appendChild(node('p', 'fpt-auto-lead', preview.explanation));
            const actionLabel = { raise: 'Повысить', lower: 'Снизить', keep: 'Без изменений', set: 'Установить', block: 'Нет безопасной цены', skip: 'Пропущен' };
            const checks = [];
            const rows = preview.rows.map(row => {
                let first = node('span', '', row.title);
                if (['raise', 'lower', 'set'].includes(row.action)) {
                    const label = node('label', 'fpt-auto-check');
                    const check = node('input');
                    check.type = 'checkbox';
                    check.checked = true;
                    check.value = row.offerId;
                    checks.push(check);
                    label.append(check, node('span', '', row.title));
                    first = label;
                }
                const tone = row.action === 'block' ? 'danger' : row.action === 'skip' ? '' : row.action === 'keep' ? '' : 'accent';
                return [first, formatMoney(row.currentPrice, preview.currency), row.cost ? formatMoney(row.cost.amount, row.cost.currency) : '—',
                    formatMoney(row.floor, preview.currency), formatMoney(row.target, preview.currency), pill(actionLabel[row.action] || row.action, tone), (row.reasons || []).join(' ')];
            });
            previewSection.appendChild(table(['Лот', 'Сейчас', 'Себестоимость', 'Минимум', 'Цель', 'Действие', 'Пояснение'], rows));
            const apply = button(`Применить отмеченные`, { kind: 'primary', iconName: 'price_check' });
            apply.disabled = !checks.length;
            apply.addEventListener('click', async () => {
                const offerIds = checks.filter(check => check.checked).map(check => check.value);
                if (!offerIds.length) return;
                if (!window.confirm(`Изменить цену у ${offerIds.length} лотов? Если цена на FunPay изменилась после предпросмотра, лот не будет изменён.`)) return;
                try {
                    dialog.setBusy(true);
                    const result = await run('lotPricing', { command: 'apply', previewId: preview.previewId, offerIds });
                    const saved = result.results.filter(item => item.status === 'saved').length;
                    const problems = result.results.filter(item => !['saved', 'unchanged'].includes(item.status));
                    setStatus(`Изменено: ${saved}.${problems.length ? ` Не изменено: ${problems.length} — ${problems.map(item => item.reason || item.status).join('; ')}` : ''}`, problems.length ? 'warning' : 'success');
                    currentPreview = null;
                    apply.disabled = true;
                } catch (error) {
                    setStatus(error.message, 'error');
                } finally {
                    dialog.setBusy(false);
                }
            });
            const applyRow = node('div', 'fpt-auto-actions');
            applyRow.appendChild(apply);
            previewSection.appendChild(applyRow);
        };

        const renderRules = () => {
            rulesSection.querySelector('.fpt-auto-cards')?.remove();
            const list = node('div', 'fpt-auto-cards');
            if (!state.rules.length) list.appendChild(node('p', 'fpt-auto-empty', 'Сохранённых правил нет.'));
            for (const rule of state.rules) {
                const card = node('article', 'fpt-auto-card');
                const head = node('div', 'fpt-auto-card-head');
                head.append(node('strong', '', rule.name), pill(rule.auto ? 'Автопересчёт' : 'Вручную', rule.auto ? 'success' : ''));
                const bound = state.bindings.filter(binding => binding.ruleId === rule.ruleId);
                const paused = bound.filter(binding => state.autoState[`${binding.accountId}:${binding.offerId}`]?.paused);
                card.append(head, node('p', 'fpt-auto-card-meta', `${rule.explanation} · мин. прибыль ${rule.minProfit} · шаг ${rule.step}${rule.ceiling ? ` · потолок ${rule.ceiling}` : ''}`),
                    node('p', 'fpt-auto-card-meta', `Лотов: ${bound.length}${paused.length ? ` · на паузе после ручной правки: ${paused.length}` : ''}`));
                const actions = node('div', 'fpt-auto-actions');
                const previewRule = button('Предпросмотр привязанных', { iconName: 'visibility' });
                previewRule.disabled = !bound.length;
                previewRule.addEventListener('click', async () => {
                    try { renderPreview({ ...(await run('lotPricing', { command: 'preview', ruleId: rule.ruleId, lots: bound })), currency: rule.currency }); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                const bind = button('Привязать отмеченные', { iconName: 'link' });
                bind.addEventListener('click', async () => {
                    const lots = picker?.selected() || [];
                    if (!lots.length) { setStatus('Отметьте лоты в списке.', 'warning'); return; }
                    try { await run('lotPricing', { command: 'bindLots', ruleId: rule.ruleId, lots }); await reload(); setStatus('Лоты привязаны к правилу.', 'success'); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                const auto = button(rule.auto ? 'Выключить автопересчёт' : 'Включить автопересчёт', { kind: rule.auto ? '' : 'primary', iconName: rule.auto ? 'pause' : 'autorenew' });
                auto.addEventListener('click', async () => {
                    if (!rule.auto && !window.confirm('Включить автопересчёт? Цены привязанных лотов будут меняться без подтверждения, в пределах правила и не больше 10% за раз.')) return;
                    try { await run('lotPricing', { command: 'setAuto', ruleId: rule.ruleId, auto: !rule.auto, expectedRevision: rule.revision }); await reload(); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                const resume = button('Снять паузу', { iconName: 'play_arrow' });
                resume.hidden = !paused.length;
                resume.addEventListener('click', async () => {
                    try { for (const binding of paused) await run('lotPricing', { command: 'resumeAuto', offerId: binding.offerId }); await reload(); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                const remove = button('Удалить', { kind: 'danger', iconName: 'delete' });
                remove.addEventListener('click', async () => {
                    if (!window.confirm(`Удалить правило «${rule.name}»?`)) return;
                    try { await run('lotPricing', { command: 'deleteRule', ruleId: rule.ruleId }); await reload(); }
                    catch (error) { setStatus(error.message, 'error'); }
                });
                actions.append(previewRule, bind, auto, resume, remove);
                card.appendChild(actions);
                list.appendChild(card);
            }
            rulesSection.appendChild(list);
        };

        async function reload() {
            state = await run('lotPricing', { command: 'list' });
            renderRules();
        }

        const actions = node('div', 'fpt-auto-actions');
        const previewButton = button('Предпросмотр отмеченных', { kind: 'primary', iconName: 'visibility' });
        previewButton.addEventListener('click', async () => {
            const lots = picker?.selected() || [];
            if (!lots.length) { setStatus('Отметьте лоты для предпросмотра.', 'warning'); return; }
            try {
                dialog.setBusy(true);
                const rule = collectRule();
                renderPreview({ ...(await run('lotPricing', { command: 'preview', rule, lots })), currency: rule.currency });
                setStatus('');
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                dialog.setBusy(false);
            }
        });
        const saveButton = button('Сохранить правило', { iconName: 'save' });
        saveButton.addEventListener('click', async () => {
            const name = window.prompt('Название правила', 'Правило цены');
            if (name === null) return;
            try { await run('lotPricing', { command: 'saveRule', rule: { ...collectRule(), name } }); await reload(); setStatus('Правило сохранено.', 'success'); }
            catch (error) { setStatus(error.message, 'error'); }
        });
        actions.append(previewButton, saveButton);
        lotsSection.appendChild(actions);

        const close = node('button', 'fpt-lot-dialog-button', 'Закрыть');
        close.type = 'button';
        close.addEventListener('click', () => dialog.close());
        dialog.footer.appendChild(close);

        try { await reload(); await loadLots(); }
        catch (error) { setStatus(error.message, 'error'); }
    }

    root.FPTLotAutomationPage = Object.freeze({ openScheduleDialog, openPricingDialog });
})(window);
