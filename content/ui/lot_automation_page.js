// Lot schedules: the «Расписание» tab of the bulk lot editor («Управление лотами»).
// It works on the lots selected in the editor's shared list; the background owns every write.
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

    function normalizeTime(value, allowEnd = false) {
        const text = String(value).trim();
        const match = /^(\d{1,2}):(\d{2})$/.exec(text);
        let hour, minute;
        if (match) [, hour, minute] = match;
        else if (/^\d{1,4}$/.test(text)) {
            hour = text.length <= 2 ? text : text.slice(0, -2);
            minute = text.length <= 2 ? '00' : text.slice(-2);
        } else return null;
        hour = Number(hour); minute = Number(minute);
        if (minute > 59 || hour > 23 && !(allowEnd && hour === 24 && minute === 0)) return null;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const clockTime = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

    // Content scripts cannot import the background ES module. Keep its weekly union semantics.
    function normalizeWindows(windows) {
        const segments = [];
        for (const window of windows) {
            const day = DAY_OPTIONS.findIndex(([key]) => key === window.day);
            const startText = normalizeTime(window.start), endText = normalizeTime(window.end, true);
            if (day < 0 || !startText || !endText) continue;
            const start = minutes(startText), end = minutes(endText), base = day * 1440;
            if (start === end) continue;
            if (end > start) segments.push([base + start, base + end]);
            else {
                segments.push([base + start, base + 1440]);
                if (end > 0) segments.push([((day + 1) % 7) * 1440, ((day + 1) % 7) * 1440 + end]);
            }
        }
        segments.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const segment of segments) {
            const last = merged.at(-1);
            if (last && segment[0] <= last[1]) last[1] = Math.max(last[1], segment[1]);
            else merged.push([...segment]);
        }
        return merged;
    }
    // Weekday and minute in the rule's zone; day -1 when the zone is unknown to this browser.
    function zoneNow(timezone) {
        let parts;
        try {
            parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
                timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }).formatToParts(new Date()).map(part => [part.type, part.value]));
        } catch (_) {
            return { day: -1, minute: 0 };
        }
        const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
        return { day, minute: Number(parts.hour) * 60 + Number(parts.minute) };
    }
    function groupWindows(windows) {
        const groups = new Map();
        for (const { day, start, end } of windows) {
            const key = `${start}-${end}`;
            if (!groups.has(key)) groups.set(key, { days: [], start, end });
            if (!groups.get(key).days.includes(day)) groups.get(key).days.push(day);
        }
        return [...groups.values()];
    }
    function expandRows(rows) {
        return rows.flatMap(row => row.days.map(day => ({ day, start: row.start, end: row.end })));
    }

    // Renders the schedule tab into `host`.
    //   getSelectedLots() → [{ offerId, nodeId, title }] checked in the editor's list;
    //   onState(state)    → called after every reload so the list can show bindings;
    //   dialog            → the editor dialog (setBusy while a write runs).
    function mountSchedulePane(host, { dialog = null, getSelectedLots = () => [], onState = () => {} } = {}) {
        const { node, icon, button, pill, field, input, select, section, notice, table, formatDateTime } = ui();
        const setBusy = busy => dialog?.setBusy?.(busy);
        const status = node('div', 'fpt-auto-status');
        status.setAttribute('aria-live', 'polite');

        let state = { rules: [], bindings: [], status: {} };
        let editing = null;
        let firstLoad = true;

        const setStatus = (text, tone = '') => {
            status.replaceChildren();
            if (text) status.appendChild(notice(text, tone || 'info'));
        };

        const ruleStrip = node('div', 'fpt-sched-rules');
        ruleStrip.setAttribute('role', 'radiogroup');
        ruleStrip.setAttribute('aria-label', 'Правила расписания');
        // Status bar of the chosen rule: one compact line, so the editor keeps the height.
        const bar = node('section', 'fpt-sched-bar');
        bar.setAttribute('aria-label', 'Состояние правила');
        const barDot = node('span', 'fpt-sched-dot fpt-sched-bar-dot');
        const barMain = node('div', 'fpt-sched-bar-main');
        const barLine = node('div', 'fpt-sched-bar-line');
        const rulePill = pill('Новое');
        const ruleMeta = node('span', 'fpt-sched-bar-state');
        barLine.append(rulePill, ruleMeta);
        const barDetails = node('p', 'fpt-sched-bar-details');
        const infoIcon = icon('info');
        infoIcon.classList.add('fpt-sched-info');
        infoIcon.removeAttribute('aria-hidden');
        infoIcon.setAttribute('role', 'img');
        const footnoteText = 'Расписание работает, пока открыт Chrome. Если компьютер спит или браузер закрыт, переключение произойдёт при следующем запуске — пропущенные переходы не проигрываются.';
        infoIcon.title = footnoteText;
        infoIcon.setAttribute('aria-label', footnoteText);
        barMain.append(barLine, barDetails);
        const heroActions = node('div', 'fpt-sched-bar-actions');
        const toggleButton = button('Включить', { kind: 'primary', iconName: 'play_arrow' });
        const iconButton = (label, name) => {
            const control = button('', { iconName: name, title: label });
            control.classList.add('fpt-sched-icon-button');
            control.setAttribute('aria-label', label);
            return control;
        };
        const deleteButton = iconButton('Удалить правило', 'delete');
        heroActions.append(toggleButton, deleteButton);
        const confirmation = node('div', 'fpt-sched-confirm');
        confirmation.hidden = true;
        bar.append(barDot, barMain, infoIcon, heroActions, confirmation);
        let confirmationVersion = 0;
        const cancelConfirmation = () => {
            confirmationVersion++;
            confirmation.hidden = true;
            confirmation.replaceChildren();
        };
        // The week chart sits next to the editor on a wide dialog and above it on a narrow one.
        const weekCard = node('aside', 'fpt-sched-week-card');
        weekCard.setAttribute('aria-label', 'Неделя продаж');
        const weekHead = node('div', 'fpt-sched-week-head');
        const weekLegend = node('span', 'fpt-sched-legend');
        weekLegend.append(node('span', 'fpt-sched-legend-swatch'), node('span', '', 'продажи открыты'));
        weekHead.append(node('strong', '', 'Неделя'), weekLegend);
        const week = node('div', 'fpt-sched-week');
        weekCard.append(weekHead, week);
        const ruleSection = section('Окна продаж');
        ruleSection.classList.add('fpt-sched-editor');
        const nameInput = input('text', '', { maxlength: '60', placeholder: 'Например, «Вечерние продажи»' });
        const zoneHost = node('div', 'fpt-sched-zone');
        let zoneSelect = null;
        const renderZones = value => {
            const zones = [...new Set([value, browserZone(), ...COMMON_ZONES].filter(Boolean))];
            zoneSelect = select(zones.map(zone => [zone, zone]), value);
            zoneSelect.setAttribute('aria-label', 'Часовой пояс');
            zoneSelect.addEventListener('change', updateEditor);
            zoneHost.replaceChildren(zoneSelect);
            root.FPTPopupUI?.enhanceSelect?.(zoneSelect, zoneHost);
        };
        const windowsWrap = node('div', 'fpt-sched-windows');
        const readRows = () => Array.from(windowsWrap.children).map(row => ({
            days: row._days,
            start: normalizeTime(row.querySelector('[data-part="start"]').value) || row.querySelector('[data-part="start"]').value.trim(),
            end: normalizeTime(row.querySelector('[data-part="end"]').value, true) || row.querySelector('[data-part="end"]').value.trim()
        }));
        const addWindow = (window = { days: ['mon'], start: '09:00', end: '18:00' }) => {
            const row = node('div', 'fpt-sched-window-row');
            row._days = [...window.days];
            const days = node('div', 'fpt-sched-days');
            days.setAttribute('role', 'group');
            days.setAttribute('aria-label', 'Дни окна');
            for (const [key, label] of DAY_OPTIONS) {
                const day = button(label);
                day.classList.add('fpt-sched-day');
                day.setAttribute('aria-pressed', String(row._days.includes(key)));
                day.addEventListener('click', () => {
                    row._days = row._days.includes(key) ? row._days.filter(value => value !== key)
                        : DAY_OPTIONS.map(([value]) => value).filter(value => value === key || row._days.includes(value));
                    day.setAttribute('aria-pressed', String(row._days.includes(key)));
                    updateEditor();
                });
                days.appendChild(day);
            }
            const times = node('div', 'fpt-sched-times');
            const overnight = pill('+1 день');
            overnight.classList.add('fpt-sched-overnight');
            const controls = ['start', 'end'].map(part => {
                const control = input('text', window[part], {
                    placeholder: 'ЧЧ:ММ', inputmode: 'numeric', maxlength: '5',
                    'aria-label': part === 'start' ? 'Начало окна' : 'Конец окна'
                });
                control.dataset.part = part;
                control.addEventListener('input', updateEditor);
                control.addEventListener('blur', () => {
                    const normalized = normalizeTime(control.value, part === 'end');
                    if (normalized) control.value = normalized;
                    updateEditor();
                });
                return control;
            });
            times.append(field('с', controls[0]), node('span', 'fpt-sched-dash', '—'), field('до', controls[1]), overnight);
            const remove = iconButton('Удалить окно', 'close');
            remove.addEventListener('click', () => { row.remove(); updateEditor(); });
            row.append(days, times, remove);
            windowsWrap.appendChild(row);
        };
        const presets = node('div', 'fpt-auto-presets fpt-sched-presets');
        const presetButton = (label, iconName, days, start, end) => {
            const element = button(label, { iconName });
            element.addEventListener('click', () => {
                windowsWrap.replaceChildren();
                addWindow({ days, start, end });
                updateEditor();
            });
            presets.appendChild(element);
        };
        const allDays = DAY_OPTIONS.map(([day]) => day);
        presetButton('Будни 09–18', 'work', allDays.slice(0, 5), '09:00', '18:00');
        presetButton('Каждый вечер 18–02', 'dark_mode', allDays, '18:00', '02:00');
        presetButton('Выходные целиком', 'weekend', allDays.slice(5), '00:00', '24:00');
        presetButton('Круглосуточно', 'all_inclusive', allDays, '00:00', '24:00');
        const addButton = button('Добавить окно', { iconName: 'add' });
        addButton.classList.add('fpt-sched-add');
        addButton.addEventListener('click', () => { addWindow(); updateEditor(); });
        const editorActions = node('div', 'fpt-auto-actions');
        const saveButton = button('Сохранить черновик', { kind: 'primary', iconName: 'save' });
        const previewButton = button('Предпросмотр', { iconName: 'visibility' });
        const dirtyLabel = node('span', 'fpt-sched-dirty', 'Есть несохранённые изменения');
        dirtyLabel.setAttribute('role', 'status');
        editorActions.append(saveButton, previewButton, dirtyLabel);
        const fields = node('div', 'fpt-sched-fields');
        const zoneField = node('div', 'fpt-auto-field');
        zoneField.append(node('span', 'fpt-auto-field-label', 'Часовой пояс'), zoneHost,
            node('span', 'fpt-auto-field-hint', 'Окна задаются по времени этого пояса.'));
        fields.append(field('Название', nameInput), zoneField);
        const addRow = node('div', 'fpt-sched-add-row');
        addRow.append(addButton, node('span', 'fpt-auto-field-hint', 'Через полночь: 22:00–02:00. Круглые сутки: 00:00–24:00.'));
        ruleSection.append(fields, presets, windowsWrap, addRow, editorActions);
        const layout = node('div', 'fpt-sched-layout');
        layout.append(ruleSection, weekCard);
        // Binding: one row under the editor; the lots are picked in the shared list above the tabs.
        const lotsSection = node('section', 'fpt-sched-lots');
        lotsSection.setAttribute('aria-label', 'Лоты правила');
        const lotsHead = node('div', 'fpt-sched-lots-head');
        const selectedCount = node('span', 'fpt-sched-lots-count');
        lotsHead.append(icon('link'), node('strong', '', 'Лоты'), selectedCount);
        lotsHead.title = 'Отметьте лоты в списке выше. Лот может быть привязан только к одному правилу.';
        const boundChips = node('div', 'fpt-sched-bound');
        const bindActions = node('div', 'fpt-auto-actions');
        const bindButton = button('Привязать выбранные', { kind: 'primary', iconName: 'link' });
        const unbindButton = button('Отвязать выбранные', { iconName: 'link_off' });
        bindActions.append(bindButton, unbindButton);
        lotsSection.append(lotsHead, bindActions, boundChips);
        const previewSection = section('Предпросмотр');
        previewSection.classList.add('fpt-sched-preview');
        previewSection.hidden = true;
        host.classList.add('fpt-sched-pane');
        host.replaceChildren(status, ruleStrip, bar, layout, lotsSection, previewSection);
        const ruleById = id => state.rules.find(rule => rule.ruleId === id);
        const refreshSelection = () => {
            const count = getSelectedLots().length;
            const label = text => `${text}${count ? ` (${count})` : ''}`;
            selectedCount.textContent = count ? `отмечено в списке: ${count}` : 'отметьте лоты в списке выше';
            bindButton.querySelector('span:last-child').textContent = label('Привязать выбранные');
            unbindButton.querySelector('span:last-child').textContent = label('Отвязать выбранные');
            bindButton.disabled = !count || !editing?.ruleId;
            bindButton.title = editing?.ruleId ? '' : 'Сначала сохраните правило.';
            unbindButton.disabled = !count;
        };
        const renderRuleSelect = () => {
            ruleStrip.replaceChildren();
            for (const rule of [...state.rules, null]) {
                const active = (rule?.ruleId || '') === (editing?.ruleId || '');
                const chip = button(rule?.name || 'Новое правило', { iconName: rule ? '' : 'add' });
                chip.classList.add('fpt-sched-rule-chip');
                if (!rule) chip.classList.add('fpt-sched-rule-new');
                else {
                    const dot = node('span', 'fpt-sched-dot');
                    dot.dataset.enabled = String(Boolean(rule.enabled));
                    chip.prepend(dot);
                }
                chip.setAttribute('role', 'radio');
                chip.setAttribute('aria-checked', String(active));
                chip.tabIndex = active ? 0 : -1;
                chip.addEventListener('click', () => loadEditor(rule));
                chip.addEventListener('keydown', event => {
                    const items = [...ruleStrip.children];
                    let index = items.indexOf(chip);
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index++;
                    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index--;
                    else if (event.key === 'Home') index = 0;
                    else if (event.key === 'End') index = items.length - 1;
                    else return;
                    event.preventDefault();
                    index = (index + items.length) % items.length;
                    loadEditor(state.rules[index] || null);
                    ruleStrip.children[index].focus();
                });
                ruleStrip.appendChild(chip);
            }
        };
        const collectRule = () => ({
            ruleId: editing?.ruleId,
            name: nameInput.value.trim() || 'Расписание',
            timezone: zoneSelect?.value || browserZone(),
            windows: expandRows(readRows())
        });
        // Compare semantic windows, so grouping, ordering and time shorthand are not false edits.
        const fingerprint = rule => JSON.stringify({
            name: rule.name, timezone: rule.timezone,
            windows: [...rule.windows].sort((a, b) => DAY_OPTIONS.findIndex(([d]) => d === a.day) - DAY_OPTIONS.findIndex(([d]) => d === b.day)
                || a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
        });
        let baseline = '';
        function updateEditor() {
            cancelConfirmation();
            const rule = collectRule();
            dirtyLabel.hidden = fingerprint(rule) === baseline;
            previewSection.hidden = true;
            let valid = true;
            for (const row of windowsWrap.children) {
                const start = row.querySelector('[data-part="start"]'), end = row.querySelector('[data-part="end"]');
                const startTime = normalizeTime(start.value), endTime = normalizeTime(end.value, true);
                const equal = startTime && endTime && startTime === endTime;
                start.setAttribute('aria-invalid', String(!startTime || Boolean(equal)));
                end.setAttribute('aria-invalid', String(!endTime || Boolean(equal)));
                row.querySelector('.fpt-sched-days').setAttribute('aria-invalid', String(!row._days.length));
                row.querySelector('.fpt-sched-overnight').hidden = !(startTime && endTime && minutes(endTime) < minutes(startTime));
                if (!startTime || !endTime || equal || !row._days.length) valid = false;
            }
            saveButton.disabled = !valid;
            previewButton.disabled = !valid;
            renderWeek(rule);
        }
        function renderWeek(rule) {
            const segments = normalizeWindows(rule.windows);
            const now = zoneNow(rule.timezone);
            if (now.day < 0) {
                ruleMeta.textContent = 'Часовой пояс не распознан';
                bar.dataset.open = 'unknown';
            } else {
                const point = now.day * 1440 + now.minute;
                const isOpen = minute => segments.some(([start, end]) => minute >= start && minute < end);
                const open = isOpen(point);
                const boundaries = [...new Set(segments.flat())].filter(value =>
                    isOpen(value % 10080) !== isOpen((value + 10079) % 10080));
                const next = boundaries.sort((a, b) => ((a - point + 10080) % 10080) - ((b - point + 10080) % 10080))
                    .find(value => (value - point + 10080) % 10080 > 0);
                let nextText = '';
                if (next !== undefined) {
                    const day = Math.floor(next / 1440) % 7, minute = next % 1440;
                    nextText = ` · ${open ? 'закроется' : 'откроется'} ${DAY_OPTIONS[day][1].toLowerCase()} ${clockTime(minute)}`;
                }
                ruleMeta.textContent = `Сейчас ${open ? 'открыто' : 'закрыто'}${nextText}`;
                bar.dataset.open = String(open);
            }
            renderDetails(rule.timezone);
            week.replaceChildren();
            const axis = node('div', 'fpt-sched-axis');
            for (const hour of [0, 6, 12, 18, 24]) axis.appendChild(node('span', '', hour));
            week.append(node('span'), axis);
            DAY_OPTIONS.forEach(([, label], day) => {
                const caption = node('span', 'fpt-sched-weekday', label);
                const track = node('div', 'fpt-sched-track');
                track.setAttribute('aria-label', label);
                for (const [start, end] of segments) {
                    const left = Math.max(start, day * 1440), right = Math.min(end, (day + 1) * 1440);
                    if (right <= left) continue;
                    const segment = node('span', 'fpt-sched-segment');
                    segment.style.left = `${(left - day * 1440) / 14.4}%`;
                    segment.style.width = `${(right - left) / 14.4}%`;
                    segment.title = `${label} ${clockTime(left - day * 1440)}–${clockTime(right - day * 1440)}`;
                    segment.setAttribute('aria-label', segment.title);
                    track.appendChild(segment);
                }
                if (day === now.day) {
                    caption.dataset.today = 'true';
                    const marker = node('span', 'fpt-sched-now');
                    marker.style.left = `${now.minute / 14.4}%`;
                    marker.title = `Сейчас ${clockTime(now.minute)}`;
                    marker.setAttribute('aria-label', marker.title);
                    track.appendChild(marker);
                }
                week.append(caption, track);
            });
        }
        // Second line of the status bar: zone, bound lots (saved rules only) and the next background check.
        let boundCount = null;
        let nextCheck = '';
        function renderDetails(timezone) {
            const lots = boundCount === null ? '' : `лотов: ${boundCount}`;
            barDetails.textContent = [timezone, lots, nextCheck].filter(Boolean).join(' · ');
        }
        const loadEditor = rule => {
            editing = rule || null;
            cancelConfirmation();
            nameInput.value = rule?.name || '';
            renderZones(rule?.timezone || browserZone());
            windowsWrap.replaceChildren();
            groupWindows(rule ? rule.windows : [{ day: 'mon', start: '09:00', end: '18:00' }]).forEach(addWindow);
            saveButton.querySelector('span:last-child').textContent = rule ? 'Сохранить изменения' : 'Сохранить черновик';
            const saved = Boolean(rule?.ruleId);
            rulePill.textContent = !saved ? 'Новое' : rule.enabled ? 'Включено' : 'Черновик';
            rulePill.dataset.tone = saved && rule.enabled ? 'success' : '';
            toggleButton.hidden = !saved;
            deleteButton.hidden = !saved;
            toggleButton.className = `fpt-lot-dialog-button${rule?.enabled ? '' : ' fpt-lot-dialog-button--primary'}`;
            toggleButton.querySelector('.material-symbols-rounded').textContent = rule?.enabled ? 'pause' : 'play_arrow';
            toggleButton.querySelector('span:last-child').textContent = rule?.enabled ? 'Выключить' : 'Включить';
            bar.dataset.enabled = String(Boolean(saved && rule.enabled));
            const bound = saved ? state.bindings.filter(binding => binding.ruleId === rule.ruleId) : [];
            boundCount = saved ? bound.length : null;
            boundChips.replaceChildren();
            bound.slice(0, 6).forEach(lot => boundChips.appendChild(pill(lot.title || `Лот #${lot.offerId}`)));
            if (bound.length > 6) boundChips.appendChild(pill(`ещё ${bound.length - 6}`));
            baseline = fingerprint(collectRule());
            renderRuleSelect();
            updateEditor();
            refreshSelection();
        };
        nameInput.addEventListener('input', updateEditor);
        // Stop the clock when the dialog removes the pane.
        const clock = root.setInterval(() => {
            if (!host.isConnected) { root.clearInterval(clock); return; }
            renderWeek(collectRule());
        }, 30000);

        const renderPreview = (preview, title) => {
            previewSection.hidden = false;
            previewSection.replaceChildren(node('h3', '', title || 'Предпросмотр'));
            if (preview.errors?.length) { previewSection.appendChild(notice(preview.errors.join(' '), 'error')); return; }
            previewSection.appendChild(node('p', 'fpt-auto-lead', preview.openNow ? 'Сейчас окно открыто: лоты могут продаваться.' : 'Сейчас окно закрыто: включённое правило выключит лоты.'));
            const timeline = node('ol', 'fpt-sched-timeline');
            for (const item of preview.transitions || []) {
                const entry = node('li');
                const badge = node('span', 'fpt-sched-transition-icon');
                badge.dataset.open = String(item.open);
                badge.appendChild(icon(item.open ? 'lock_open' : 'lock'));
                const copy = node('div');
                copy.append(node('time', '', `${item.local} · ${item.offset}`),
                    node('span', 'fpt-sched-transition-label', item.open ? 'Открытие' : 'Закрытие'));
                entry.append(badge, copy);
                timeline.appendChild(entry);
            }
            if (!timeline.children.length) timeline.appendChild(node('li', 'fpt-sched-meta', 'В ближайшее время переходов нет.'));
            previewSection.appendChild(timeline);
            if (preview.lots?.length) {
                const label = { activate: 'Будет включён', deactivate: 'Будет выключен', 'not-owned': 'Не включится: выключен не автоматизацией', 'already-active': 'Без изменений', 'already-inactive': 'Без изменений', open: 'Будет открыт', close: 'Будет закрыт', paused: 'Управление приостановлено' };
                previewSection.appendChild(table(['Лот', 'Сейчас при включении'], preview.lots.map(lot => [lot.title || `Лот #${lot.offerId}`, pill(label[lot.decision] || lot.decision, ['activate', 'open'].includes(lot.decision) ? 'success' : ['deactivate', 'close', 'not-owned'].includes(lot.decision) ? 'warning' : '')])));
            }
            // Scroll only the tab's own scroller; scrollIntoView would move the whole popup too.
            const scroller = host.closest('.fpt-bulk-panes') || host;
            scroller.scrollTop += previewSection.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
        };

        async function reload() {
            const data = await run('lotSchedules', { command: 'list' });
            state = {
                ...data,
                rules: Array.isArray(data?.rules) ? data.rules : [],
                bindings: Array.isArray(data?.bindings) ? data.bindings : [],
                status: data?.status || {}
            };
            if (editing?.ruleId) editing = ruleById(editing.ruleId) || null;
            // The tab opens on the first saved rule; «Новое правило» stays one click away.
            else if (firstLoad && state.rules.length) editing = state.rules[0];
            firstLoad = false;
            nextCheck = state.nextDueAt ? `проверка ${formatDateTime(state.nextDueAt)}` : '';
            renderRuleSelect();
            loadEditor(editing);
            onState({ ...state, ruleName: id => ruleById(id)?.name || '' });
        }

        saveButton.addEventListener('click', async () => {
            try {
                const rule = await run('lotSchedules', { command: 'saveRule', rule: collectRule(), expectedRevision: editing?.revision ?? null });
                editing = rule;
                await reload();
                setStatus(rule.enabled ? 'Правило сохранено и применено.' : 'Черновик сохранён. Включите правило, когда проверите предпросмотр.', 'success');
            } catch (error) {
                setStatus(error.message, 'error');
            }
        });
        previewButton.addEventListener('click', async () => {
            try { renderPreview(await run('lotSchedules', { command: 'preview', rule: collectRule() }), editing ? `Предпросмотр: ${editing.name}` : 'Предпросмотр черновика'); }
            catch (error) { setStatus(error.message, 'error'); }
        });
        const requestConfirmation = async deleting => {
            const rule = editing;
            if (!rule?.ruleId) return;
            cancelConfirmation();
            const version = confirmationVersion;
            try {
                const preview = await run('lotSchedules', { command: 'preview', ruleId: rule.ruleId });
                if (version !== confirmationVersion || editing !== rule || !host.isConnected) return;
                if (preview.errors?.length) { setStatus(preview.errors.join(' '), 'error'); return; }
                const changes = (preview.lots || []).filter(lot => ['activate', 'deactivate', 'close', 'open'].includes(lot.decision)).length;
                const question = deleting
                    ? `Удалить правило «${rule.name}»? Лоты отвяжутся от него. Снятие блокировки расписания может включить лоты, которые выключало это правило.`
                    : rule.enabled
                        ? 'Выключить правило? Снятие блокировки расписания может включить лоты, которые выключало это правило.'
                        : `Включить правило? Сейчас окно ${preview.openNow ? 'открыто' : 'закрыто'}; изменений лотов: ${changes}.`;
                const confirm = button('Подтвердить', { kind: deleting ? 'danger' : 'primary' });
                const cancel = button('Отмена');
                const actions = node('div', 'fpt-auto-actions');
                actions.append(confirm, cancel);
                confirmation.replaceChildren(node('p', '', question), actions);
                confirmation.hidden = false;
                cancel.addEventListener('click', () => { cancelConfirmation(); (deleting ? deleteButton : toggleButton).focus(); });
                confirm.addEventListener('click', async () => {
                    if (version !== confirmationVersion || confirm.disabled) return;
                    confirm.disabled = true;
                    cancel.disabled = true;
                    setBusy(true);
                    try {
                        if (deleting) {
                            await run('lotSchedules', { command: 'deleteRule', ruleId: rule.ruleId });
                            editing = null;
                        } else {
                            await run('lotSchedules', { command: 'setRuleEnabled', ruleId: rule.ruleId, enabled: !rule.enabled, expectedRevision: rule.revision });
                        }
                        setBusy(false);
                        await reload();
                        setStatus(deleting ? 'Правило удалено.' : rule.enabled ? 'Правило выключено.' : 'Правило включено и применено.', 'success');
                    } catch (error) {
                        setStatus(error.message, 'error');
                        confirm.disabled = false;
                        cancel.disabled = false;
                    } finally { setBusy(false); }
                });
                confirm.focus();
            } catch (error) { setStatus(error.message, 'error'); }
        };
        toggleButton.addEventListener('click', () => requestConfirmation(false));
        deleteButton.addEventListener('click', () => requestConfirmation(true));
        const bind = async ruleId => {
            const lots = getSelectedLots();
            if (!lots.length) { setStatus('Отметьте хотя бы один лот.', 'warning'); return; }
            try {
                setBusy(true);
                await run('lotSchedules', { command: 'bindLots', ruleId, lots });
                setBusy(false);
                await reload();
                setStatus(ruleId ? `Лоты привязаны к правилу «${ruleById(ruleId)?.name || ''}».` : 'Лоты отвязаны от расписания.', 'success');
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                setBusy(false);
            }
        };
        bindButton.addEventListener('click', () => { if (editing?.ruleId) bind(editing.ruleId); });
        unbindButton.addEventListener('click', () => bind(null));

        loadEditor(null);
        const ready = reload().catch(error => setStatus(error.message, 'error'));
        return { ready, reload, refreshSelection };
    }

    root.FPTLotAutomationPage = Object.freeze({ mountSchedulePane });
})(window);
