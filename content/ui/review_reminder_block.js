// «Напоминание после продажи» — третий независимый блок «Отзывов и бонусов» и карточка
// «Заказы без отзыва». Настройки сохраняются проверяемым патчем (expected values), как
// у соседних блоков; задачи живут в фоновом журнале — здесь они только показываются,
// отменяются и создаются вручную для выбранных завершённых заказов без отзыва.
(function (root) {
    'use strict';

    const PAGE_ID = 'auto_review';
    const KEYS = ['reviewReminderEnabled', 'reviewReminderText', 'reviewReminderDelayHours', 'reviewReminderExpiryDays',
        'reviewReminderChatCapDays', 'reviewReminderExcludedBuyers', 'reviewReminderExcludedLots'];
    const DEFAULT_TEXT = 'Здравствуйте! Если всё в порядке с заказом, будем благодарны за отзыв: {orderlink}';
    const VARIABLES = [
        ['{buyername}', 'Имя покупателя'], ['{lotname}', 'Название лота'],
        ['{orderid}', 'Номер заказа'], ['{orderlink}', 'Ссылка на заказ']
    ];
    const DEMO = { buyername: 'Алексей', lotname: 'Игровой аккаунт', orderid: 'DEMO123', orderlink: 'https://funpay.com/orders/DEMO123/' };
    const LIMITS = {
        reviewReminderDelayHours: [1, 336, 24, 'Задержка — от 1 до 336 часов.'],
        reviewReminderExpiryDays: [1, 60, 7, 'Актуальность — от 1 до 60 дней.'],
        reviewReminderChatCapDays: [1, 90, 7, 'Лимит на чат — от 1 до 90 дней.']
    };
    const MAX_MANUAL = 10;
    const STATE_LABELS = {
        scheduled: ['Запланировано', 'accent', 'schedule'], deferred: ['Отложено', 'warning', 'pending'],
        sending: ['Отправляется', 'accent', 'send'], sent: ['Отправлено', 'success', 'mark_chat_read'],
        uncertain: ['Исход неясен', 'danger', 'help'], failed: ['Не отправлено', 'danger', 'error'],
        cancelled: ['Отменено', '', 'block'], expired: ['Истекло', '', 'timer_off']
    };
    const RESENDABLE = ['cancelled', 'expired', 'failed'];

    function normalize(source = {}) {
        const list = value => (Array.isArray(value) ? value.map(String) : []);
        const number = (key, value) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : LIMITS[key][2]);
        return {
            reviewReminderEnabled: source.reviewReminderEnabled === true,
            reviewReminderText: typeof source.reviewReminderText === 'string' ? source.reviewReminderText : DEFAULT_TEXT,
            reviewReminderDelayHours: number('reviewReminderDelayHours', source.reviewReminderDelayHours),
            reviewReminderExpiryDays: number('reviewReminderExpiryDays', source.reviewReminderExpiryDays),
            reviewReminderChatCapDays: number('reviewReminderChatCapDays', source.reviewReminderChatCapDays),
            reviewReminderExcludedBuyers: list(source.reviewReminderExcludedBuyers),
            reviewReminderExcludedLots: list(source.reviewReminderExcludedLots)
        };
    }

    function renderTemplate(text) {
        return String(text || '').replace(/\{(orderlink|orderid|buyername|lotname)\}/gi, (_, key) => DEMO[key.toLowerCase()]).trim();
    }

    async function mount(grid, popup, kit = {}) {
        const A = root.FPTAutomationUI;
        const ui = root.FPTPopupUI;
        const { button, icon, iconButton, variables, field } = kit;
        if (!A || !ui || !button || !variables || !field) throw new Error('Shared review components are unavailable.');
        const { node, pill, formatDateTime, formatMoney } = A;
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const toast = (message, kind = 'success') => { if (typeof ui.showToast === 'function') ui.showToast(popup, message, kind); };

        function makeCard(kind, title, description, iconName) {
            const card = node('section', `fpt-rv-card fpt-rv-card--${kind}`);
            card.setAttribute('aria-labelledby', `fpt-rv-${kind}-title`);
            const controls = node('fieldset', 'fpt-rv-controls');
            const head = node('div', 'fpt-rv-head');
            const emblem = node('span', 'fpt-rv-emblem');
            emblem.append(icon(iconName));
            const copy = node('div', 'fpt-rv-head-copy');
            const heading = node('h3', '', title);
            heading.id = `fpt-rv-${kind}-title`;
            copy.append(heading, node('p', '', description));
            const side = node('div', 'fpt-rv-switch-line');
            head.append(emblem, copy, side);
            const content = node('div', 'fpt-rv-content');
            const footer = node('div', 'fpt-rv-footer');
            const status = node('p', 'fpt-rv-status');
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            const actions = node('div', 'fpt-rv-actions');
            footer.append(status, actions);
            controls.append(head, content, footer);
            card.append(controls);
            grid.append(card);
            return { card, controls, side, content, status, actions };
        }
        function setStatus(target, message, kind = '') {
            target.textContent = message || '';
            target.dataset.kind = kind;
        }
        function hint(iconName, text, className = '') {
            const element = node('p', `fpt-rv-hint fpt-rv-skip-hint ${className}`.trim());
            element.append(icon(iconName), node('span', '', text));
            return element;
        }
        function sectionHead(iconName, title, description) {
            const head = node('div', 'fpt-rm-section-head');
            const titleRow = node('h4', 'fpt-rm-section-title');
            titleRow.append(icon(iconName), node('span', '', title));
            head.append(titleRow);
            if (description) head.append(node('p', 'fpt-rm-section-hint', description));
            return head;
        }
        function empty(iconName, title, text) {
            const element = node('div', 'fpt-rv-empty fpt-rm-empty');
            element.setAttribute('role', 'status');
            const emblem = node('span', 'fpt-rv-empty-emblem');
            emblem.append(icon(iconName));
            element.append(emblem, node('p', 'fpt-rv-label', title));
            if (text) element.append(node('p', 'fpt-rv-hint', text));
            return element;
        }
        function confirmDialog(title, description, confirmLabel, confirmIcon = 'check') {
            return new Promise(resolve => {
                const dialog = ui.createDialog(popup, title, { description });
                let answered = false;
                const finish = value => { if (answered) return; answered = true; resolve(value); };
                const watcher = new MutationObserver(() => {
                    if (dialog.backdrop.isConnected) return;
                    watcher.disconnect();
                    finish(false);
                });
                watcher.observe(popup, { childList: true });
                const cancel = button('Отмена');
                cancel.addEventListener('click', () => dialog.close());
                const confirm = button(confirmLabel, 'fpt-rv-primary', confirmIcon);
                confirm.addEventListener('click', () => { finish(true); dialog.close(); });
                dialog.footer.append(cancel, confirm);
                dialog.focusInitial();
            });
        }

        // --- Карточка настроек ------------------------------------------------------
        const settingsCard = makeCard('reminders', 'Напоминание после продажи',
            'Одна нейтральная просьба оставить отзыв после выполненного и подтверждённого заказа', 'notifications_active');
        settingsCard.controls.disabled = true;
        const toggle = node('label', 'switch fpt-rv-switch');
        const enabled = node('input');
        enabled.type = 'checkbox';
        enabled.setAttribute('role', 'switch');
        enabled.setAttribute('aria-label', 'Напоминание после продажи');
        toggle.append(enabled, node('span', 'fpt-rv-switch-track'));
        settingsCard.side.append(toggle);

        const editor = field('Текст напоминания', 'fpt-rm-text', 4, 'Здравствуйте! Будем благодарны за отзыв: {orderlink}');
        const text = editor.input;
        text.maxLength = 500;
        const counter = node('span', 'fpt-rv-muted fpt-rm-counter');
        counter.setAttribute('aria-hidden', 'true');
        editor.caption.append(counter);
        const chips = variables(text, () => changed(), VARIABLES);
        const textHint = hint('info', 'Нужна ссылка {orderlink} или номер {orderid}. Без условий вроде «только за 5★».');
        const editorPane = node('div', 'fpt-rm-editor');
        editorPane.append(editor.wrap, chips, textHint);
        const preview = node('aside', 'fpt-qr-preview fpt-rm-preview');
        const previewHead = node('div', 'fpt-qr-preview-head');
        previewHead.append(icon('visibility'), node('span', '', 'Так увидит покупатель'));
        const previewBody = node('div', 'fpt-qr-preview-body');
        previewBody.setAttribute('aria-live', 'polite');
        preview.append(previewHead, previewBody);
        const compose = node('div', 'fpt-rm-compose');
        compose.append(editorPane, preview);

        function timing(key, iconName, label, unit, title) {
            const [min, max] = LIMITS[key];
            const wrap = node('div', 'fpt-rv-delay fpt-rm-timing');
            wrap.title = title;
            const copy = node('div', 'fpt-rv-delay-copy');
            const caption = node('label', 'fpt-rv-label', label);
            caption.htmlFor = `fpt-rm-${key}`;
            copy.append(icon(iconName), caption);
            const control = node('div', 'fpt-rv-delay-control');
            const input = node('input', 'fpt-rv-number fpt-control-field');
            input.id = `fpt-rm-${key}`;
            input.type = 'number';
            input.min = String(min);
            input.max = String(max);
            input.step = '1';
            input.inputMode = 'numeric';
            control.append(input, node('span', 'fpt-rv-muted', unit));
            wrap.append(copy, control);
            return input;
        }
        const delay = timing('reviewReminderDelayHours', 'schedule', 'Задержка', 'ч', 'Сколько часов ждать после того, как покупатель подтвердил заказ');
        const expiry = timing('reviewReminderExpiryDays', 'event_available', 'Актуально', 'дн', 'Если за это время отправить не удалось — напоминание истекает');
        const cap = timing('reviewReminderChatCapDays', 'forum', 'Лимит на чат', 'дн', 'Один покупатель не получит больше одного напоминания за этот срок');
        const timings = node('div', 'fpt-rm-section');
        const timingRow = node('div', 'fpt-rm-timings');
        timingRow.append(delay.closest('.fpt-rm-timing'), expiry.closest('.fpt-rm-timing'), cap.closest('.fpt-rm-timing'));
        timings.append(sectionHead('timer', 'Когда отправлять', 'Задержка считается от подтверждения заказа покупателем. Лимит — не больше одного напоминания в один чат за указанный срок.'), timingRow);

        const lotTitles = new Map();
        function tagField({ key, label, emptyText, iconName, format }) {
            const wrap = node('div', 'fpt-rm-tags-field');
            const caption = node('span', 'fpt-rv-label', label);
            caption.id = `fpt-rm-${key}-label`;
            const box = node('div', 'fpt-rm-tags');
            const list = node('div', 'fpt-rm-tags-list');
            list.setAttribute('role', 'list');
            list.setAttribute('aria-labelledby', caption.id);
            const add = button('Выбрать', 'fpt-rm-tag-add', 'add');
            add.setAttribute('aria-label', `${label}: выбрать`);
            box.append(list, add);
            wrap.append(caption, box);
            let values = [];
            const render = () => {
                list.replaceChildren();
                if (!values.length) list.append(node('span', 'fpt-rm-tags-empty', emptyText));
                values.forEach((value, index) => {
                    const tag = node('span', 'fpt-rm-tag');
                    tag.setAttribute('role', 'listitem');
                    tag.title = value;
                    const name = format(value);
                    const badge = icon(iconName);
                    const remove = iconButton(`Убрать ${name}`, 'close');
                    remove.classList.add('fpt-rm-tag-remove');
                    remove.addEventListener('click', () => {
                        values = values.filter((_, i) => i !== index);
                        render();
                        changed();
                        (list.querySelector('.fpt-rm-tag-remove') || add).focus({ preventScroll: true });
                    });
                    tag.append(badge, node('span', 'fpt-rm-tag-text', name), remove);
                    list.append(tag);
                });
            };
            render();
            return { wrap, add, render, get: () => [...values], set: next => { values = [...next]; render(); } };
        }
        const lotTags = tagField({ key: 'lots', label: 'Не писать по лотам', emptyText: 'Все лоты', iconName: 'sell',
            format: id => lotTitles.get(String(id)) || `Лот #${id}` });
        const buyerTags = tagField({ key: 'buyers', label: 'Не писать покупателям', emptyText: 'Все покупатели', iconName: 'person', format: name => name });
        const excludes = node('div', 'fpt-rm-section');
        const excludeGrid = node('div', 'fpt-rm-excludes');
        excludeGrid.append(lotTags.wrap, buyerTags.wrap);
        excludes.append(sectionHead('block', 'Исключения', 'Выбор — из завершённых заказов без отзыва; ID лота или ник можно добавить вручную.'), excludeGrid);

        const rules = hint('verified_user', 'Автоматически — только новые заказы после включения: выдачу выполнило расширение, FunPay подтвердил доставку, покупатель подтвердил заказ. Любой отзыв, возврат или проблема отменяют напоминание. Старым заказам и ручным выдачам можно напомнить в карточке «Заказы без отзыва».', 'fpt-rm-rules');
        settingsCard.content.append(compose, timings, excludes, rules);

        const cancelEdits = button('Отменить изменения', 'fpt-rv-cancel');
        const save = button('Сохранить напоминание', 'fpt-rv-primary', 'check');
        settingsCard.actions.append(cancelEdits, save);

        let base = normalize();
        let raw = {};
        let saving = false;
        const numberValue = input => (input.value.trim() === '' ? NaN : Number(input.value));
        const draft = () => ({
            reviewReminderEnabled: enabled.checked,
            reviewReminderText: text.value,
            reviewReminderDelayHours: numberValue(delay),
            reviewReminderExpiryDays: numberValue(expiry),
            reviewReminderChatCapDays: numberValue(cap),
            reviewReminderExcludedBuyers: buyerTags.get(),
            reviewReminderExcludedLots: lotTags.get()
        });
        const pickBase = () => Object.fromEntries(KEYS.map(key => [key, base[key]]));
        const dirty = () => JSON.stringify(draft()) !== JSON.stringify(pickBase());
        function renderSwitch() {
            settingsCard.card.dataset.state = enabled.checked ? 'on' : 'off';
        }
        function renderPreview() {
            counter.textContent = `${text.value.length} / 500`;
            const label = node('div', 'fpt-qr-preview-label');
            label.append(icon('forum'), node('span', '', `${DEMO.buyername} · ${DEMO.lotname}`));
            const message = node('div', 'fpt-qr-message');
            const avatar = node('span', 'fpt-qr-avatar', 'В');
            avatar.setAttribute('aria-hidden', 'true');
            const body = node('div', 'fpt-qr-message-body');
            const meta = node('div', 'fpt-qr-message-meta');
            const hours = Number(delay.value) || LIMITS.reviewReminderDelayHours[2];
            meta.append(node('strong', '', 'Вы'), node('span', '', `через ${hours} ч после подтверждения`));
            const content = renderTemplate(text.value);
            const bubble = node('div', 'fpt-qr-bubble', content || 'Сообщение пустое');
            if (!content) bubble.dataset.empty = 'true';
            body.append(meta, bubble);
            message.append(avatar, body);
            previewBody.replaceChildren(label, message);
        }
        function changed() {
            renderSwitch();
            renderPreview();
            const isDirty = dirty();
            if (settingsCard.status.dataset.kind !== 'error' || !isDirty) {
                setStatus(settingsCard.status, isDirty ? 'Есть несохранённые изменения' : '', isDirty ? 'dirty' : '');
            }
            save.disabled = saving || !isDirty;
            cancelEdits.disabled = saving || !isDirty;
        }
        function fill(settings) {
            enabled.checked = settings.reviewReminderEnabled;
            text.value = settings.reviewReminderText;
            delay.value = String(settings.reviewReminderDelayHours);
            expiry.value = String(settings.reviewReminderExpiryDays);
            cap.value = String(settings.reviewReminderChatCapDays);
            buyerTags.set(settings.reviewReminderExcludedBuyers);
            lotTags.set(settings.reviewReminderExcludedLots);
        }
        enabled.addEventListener('change', changed);
        [text, delay, expiry, cap].forEach(control => control.addEventListener('input', () => {
            if (settingsCard.status.dataset.kind === 'error') setStatus(settingsCard.status, '');
            changed();
        }));
        cancelEdits.addEventListener('click', () => { fill(base); setStatus(settingsCard.status, ''); changed(); });

        async function loadSettings() {
            const { fpToolsAutoReplies = {} } = await run('getSettings', { keys: ['fpToolsAutoReplies'] });
            raw = Object.fromEntries(KEYS.map(key => [key, fpToolsAutoReplies[key]]));
            base = normalize(fpToolsAutoReplies);
            fill(base);
        }

        function validate(next) {
            if (next.reviewReminderEnabled && !next.reviewReminderText.trim()) return ['Введите текст напоминания.', text];
            if (next.reviewReminderEnabled && !/{orderlink}|{orderid}/i.test(next.reviewReminderText)) return ['Добавьте в текст ссылку на заказ: {orderlink}.', text];
            for (const [key, input] of [['reviewReminderDelayHours', delay], ['reviewReminderExpiryDays', expiry], ['reviewReminderChatCapDays', cap]]) {
                const [min, max, , message] = LIMITS[key];
                const value = next[key];
                if (!Number.isInteger(value) || value < min || value > max) return [message, input];
            }
            return null;
        }

        save.addEventListener('click', async () => {
            if (saving || !dirty()) return;
            const next = draft();
            const problem = validate(next);
            if (problem) {
                setStatus(settingsCard.status, problem[0], 'error');
                problem[1].focus();
                return;
            }
            if (next.reviewReminderEnabled && !base.reviewReminderEnabled
                && !(await confirmDialog('Включить напоминания?', 'Они начнутся только для новых заказов — старые продажи рассылкой не станут. Старым заказам можно напомнить вручную в карточке «Заказы без отзыва».', 'Включить'))) return;
            const values = {};
            const absent = [];
            for (const key of KEYS) {
                if (raw[key] === undefined) absent.push(key);
                else values[key] = raw[key];
            }
            saving = true;
            changed();
            setStatus(settingsCard.status, 'Сохранение…', 'loading');
            try {
                await run('saveSettings', { patch: { set: next, expected: { values, absent } } });
                await loadSettings();
                setStatus(settingsCard.status, '');
                toast('Напоминание сохранено');
                loadTasks();
            } catch (error) {
                setStatus(settingsCard.status, error.code === 'STALE_AUTO_REPLY_EDIT'
                    ? 'Настройки изменились в другом окне — перечитайте страницу.' : (error.message || 'Не удалось сохранить.'), 'error');
            } finally {
                saving = false;
                changed();
            }
        });

        // --- Выбор исключений из заказов без отзыва -------------------------------
        function openPicker({ title, description, items, selected, fallbackTitle, manualLabel, manualPlaceholder, normalizeManual }) {
            return new Promise(resolve => {
                const dialog = ui.createDialog(popup, title, { description });
                const chosen = new Set(selected);
                const entries = [...items];
                for (const value of selected) {
                    if (!entries.some(entry => entry.value === value)) entries.push({ value, title: fallbackTitle(value), meta: 'нет среди заказов без отзыва' });
                }
                let answered = false;
                const finish = value => { if (answered) return; answered = true; resolve(value); };
                const watcher = new MutationObserver(() => {
                    if (dialog.backdrop.isConnected) return;
                    watcher.disconnect();
                    finish(null);
                });
                watcher.observe(popup, { childList: true });

                const search = A.input('search', '', { placeholder: 'Поиск', 'aria-label': 'Поиск' });
                const list = node('div', 'fpt-auto-lot-list fpt-rm-picker-list');
                list.setAttribute('role', 'group');
                list.setAttribute('aria-label', title);
                const renderList = () => {
                    const query = search.value.trim().toLocaleLowerCase('ru');
                    list.replaceChildren();
                    const visible = entries.filter(entry => !query || `${entry.title} ${entry.value}`.toLocaleLowerCase('ru').includes(query));
                    if (!entries.length) list.append(node('p', 'fpt-auto-empty', 'Завершённых заказов без отзыва пока нет — добавьте вручную.'));
                    else if (!visible.length) list.append(node('p', 'fpt-auto-empty', 'Ничего не найдено.'));
                    for (const entry of visible) {
                        const row = node('label', 'fpt-bulk-lot-row fpt-auto-lot-row');
                        const check = node('input');
                        check.type = 'checkbox';
                        check.value = entry.value;
                        check.checked = chosen.has(entry.value);
                        check.addEventListener('change', () => { if (check.checked) chosen.add(entry.value); else chosen.delete(entry.value); renderCount(); });
                        row.append(check, node('span', 'fpt-bulk-lot-name', entry.title), node('span', 'fpt-bulk-lot-category', entry.meta || ''));
                        row.title = entry.value;
                        list.append(row);
                    }
                };
                search.addEventListener('input', renderList);

                const manual = node('div', 'fpt-rm-picker-manual');
                const manualInput = A.input('text', '', { placeholder: manualPlaceholder, 'aria-label': manualLabel });
                const manualAdd = button('Добавить', '', 'add');
                const manualError = node('p', 'fpt-rv-status');
                manualError.dataset.kind = 'error';
                manualError.setAttribute('role', 'alert');
                const addManual = () => {
                    const value = normalizeManual(manualInput.value);
                    if (!value) { manualError.textContent = `Проверьте: ${manualLabel.toLowerCase()}.`; manualInput.focus(); return; }
                    manualError.textContent = '';
                    if (!entries.some(entry => entry.value === value)) entries.unshift({ value, title: fallbackTitle(value), meta: 'добавлено вручную' });
                    chosen.add(value);
                    manualInput.value = '';
                    search.value = '';
                    renderList();
                    renderCount();
                };
                manualAdd.addEventListener('click', addManual);
                manualInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addManual(); } });
                manual.append(manualInput, manualAdd);

                const count = node('span', 'fpt-rv-muted fpt-rm-picker-count');
                const renderCount = () => { count.textContent = `Выбрано: ${chosen.size}`; };
                dialog.body.append(search, list, node('span', 'fpt-rv-label fpt-rm-picker-manual-label', manualLabel), manual, manualError);
                const cancel = button('Отмена');
                cancel.addEventListener('click', () => dialog.close());
                const apply = button('Применить', 'fpt-rv-primary', 'check');
                apply.addEventListener('click', () => {
                    finish(entries.map(entry => entry.value).filter(value => chosen.has(value)));
                    dialog.close();
                });
                dialog.footer.append(count, cancel, apply);
                renderList();
                renderCount();
                dialog.focusInitial();
            });
        }
        async function pickInto(tags, kind) {
            tags.add.disabled = true;
            let data = null;
            try { data = await ensureCandidates(); } catch (_) { data = null; } finally { tags.add.disabled = false; }
            const isLots = kind === 'lots';
            const items = isLots
                ? (data?.lots || []).map(lot => ({ value: String(lot.offerId), title: lot.title, meta: `${lot.count} ${ui.pluralize(lot.count, ['заказ', 'заказа', 'заказов'])} без отзыва · #${lot.offerId}` }))
                : (data?.buyers || []).map(buyer => ({ value: buyer.name, title: buyer.name, meta: `${buyer.count} ${ui.pluralize(buyer.count, ['заказ', 'заказа', 'заказов'])} без отзыва` }));
            const result = await openPicker({
                title: isLots ? 'Не писать по лотам' : 'Не писать покупателям',
                description: data ? (isLots ? 'Лоты из завершённых заказов без отзыва.' : 'Покупатели из завершённых заказов без отзыва.') : 'Не удалось загрузить заказы — можно добавить вручную.',
                items, selected: tags.get(),
                fallbackTitle: isLots ? id => lotTitles.get(id) || `Лот #${id}` : name => name,
                manualLabel: isLots ? 'ID лота' : 'Ник покупателя',
                manualPlaceholder: isLots ? 'Например, 12345678' : 'Ник на FunPay',
                normalizeManual: isLots
                    ? value => { const match = String(value).trim().match(/(?:offer=|^)(\d{3,})\s*$/); return match ? match[1] : ''; }
                    : value => String(value).trim().replace(/^@/, '').slice(0, 64)
            });
            if (!result) return;
            tags.set(result);
            changed();
        }
        lotTags.add.addEventListener('click', () => pickInto(lotTags, 'lots'));
        buyerTags.add.addEventListener('click', () => pickInto(buyerTags, 'buyers'));

        // --- Карточка «Заказы без отзыва» -------------------------------------------
        const activity = makeCard('reminder-orders', 'Заказы без отзыва',
            'Завершённые продажи, где покупатель ещё не оставил отзыв. Им можно напомнить вручную — по одному разу.', 'mark_chat_unread');
        const refresh = iconButton('Перепроверить заказы', 'refresh');
        refresh.classList.add('fpt-rm-refresh');
        activity.side.append(refresh);
        const tabs = node('div', 'fpt-rv-modes fpt-rm-tabs');
        tabs.setAttribute('role', 'radiogroup');
        tabs.setAttribute('aria-label', 'Раздел');
        tabs.append(node('span', 'fpt-seg-thumb'));
        let tab = 'orders';
        const tabButtons = [['orders', 'Без отзыва'], ['tasks', 'Задачи']].map(([id, label], index, all) => {
            const element = button(label, 'fpt-rv-mode');
            element.dataset.tab = id;
            element.setAttribute('role', 'radio');
            element.addEventListener('click', () => selectTab(id));
            element.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const other = all[1 - index][0];
                selectTab(other);
                tabButtons[1 - index].focus();
            });
            tabs.append(element);
            return element;
        });
        const ordersPane = node('div', 'fpt-rm-pane');
        const tasksPane = node('div', 'fpt-rm-pane');
        activity.content.append(tabs, ordersPane, tasksPane);
        const send = button('Напомнить выбранным', 'fpt-rv-primary', 'send');
        send.disabled = true;
        activity.actions.append(send);

        const selected = new Set();
        const candidates = { data: null, error: null, loading: false, promise: null };
        let tasksData = null;
        let sending = false;

        function setTabLabel(element, label, count) {
            const span = element.querySelector('span:not(.material-symbols-rounded)');
            span.textContent = count ? `${label} · ${count}` : label;
        }
        function selectTab(id) {
            tab = id;
            tabs.style.setProperty('--fpt-seg-index', id === 'orders' ? '0' : '1');
            tabButtons.forEach(element => {
                const active = element.dataset.tab === id;
                element.setAttribute('aria-checked', String(active));
                element.tabIndex = active ? 0 : -1;
            });
            ordersPane.hidden = id !== 'orders';
            tasksPane.hidden = id !== 'tasks';
            send.hidden = id !== 'orders';
            renderSelection();
        }
        function renderSelection() {
            send.disabled = sending || !selected.size;
            send.querySelector('span:not(.material-symbols-rounded)').textContent = selected.size ? `Напомнить выбранным (${selected.size})` : 'Напомнить выбранным';
            if (sending) return;
            if (tab !== 'orders' || !candidates.data?.orders.length) { if (activity.status.dataset.kind !== 'error') setStatus(activity.status, ''); return; }
            if (activity.status.dataset.kind === 'error') return;
            setStatus(activity.status, selected.size ? `Выбрано ${selected.size} из ${MAX_MANUAL} возможных за раз` : `Отметьте заказы — не больше ${MAX_MANUAL} за раз`);
            ordersPane.querySelectorAll('.fpt-rm-order input[type="checkbox"]').forEach(check => {
                if (check.dataset.locked === 'true') return;
                check.disabled = !check.checked && selected.size >= MAX_MANUAL;
                check.closest('.fpt-rm-order').dataset.disabled = String(check.disabled);
            });
        }

        function renderOrders() {
            ordersPane.replaceChildren();
            const data = candidates.data;
            if (candidates.loading && !data) {
                ordersPane.append(empty('hourglass_top', 'Проверяем заказы…', 'Открываем последние завершённые заказы и ищем отзыв. Первый раз это займёт немного времени.'));
                return;
            }
            if (candidates.error && !data) {
                const box = empty('cloud_off', 'Не удалось загрузить заказы', candidates.error);
                const retry = button('Повторить', 'fpt-rv-add', 'refresh');
                retry.addEventListener('click', () => loadCandidates({ refresh: true }).catch(() => {}));
                box.append(retry);
                ordersPane.append(box);
                return;
            }
            if (!data) return;
            for (const id of [...selected]) if (!data.orders.some(order => order.orderId === id)) selected.delete(id);
            setTabLabel(tabButtons[0], 'Без отзыва', data.orders.length);
            if (!data.orders.length) {
                ordersPane.append(empty('task_alt', 'Заказов без отзыва нет', 'По всем проверенным завершённым заказам отзыв уже есть.'));
            } else {
                const list = node('div', 'fpt-rm-orders');
                list.setAttribute('role', 'group');
                list.setAttribute('aria-label', 'Завершённые заказы без отзыва');
                for (const order of data.orders) {
                    const reminderState = order.reminder?.state || null;
                    const selectable = order.eligible && (!reminderState || RESENDABLE.includes(reminderState));
                    const row = node('label', 'fpt-rv-bonus-row fpt-rm-order');
                    const check = node('input');
                    check.type = 'checkbox';
                    check.value = order.orderId;
                    check.checked = selected.has(order.orderId);
                    check.disabled = !selectable;
                    check.dataset.locked = String(!selectable);
                    check.setAttribute('aria-label', `Заказ #${order.orderId}`);
                    check.addEventListener('change', () => {
                        if (check.checked) selected.add(order.orderId); else selected.delete(order.orderId);
                        row.dataset.selected = String(check.checked);
                        renderSelection();
                    });
                    row.dataset.selected = String(check.checked);
                    row.dataset.disabled = String(!selectable);
                    const main = node('span', 'fpt-rm-order-main');
                    const title = node('span', 'fpt-rm-order-title');
                    title.append(node('strong', '', `#${order.orderId}`), node('span', '', order.lotName || 'Заказ'));
                    const meta = node('span', 'fpt-rm-order-meta', [
                        order.buyerName, Number.isFinite(order.orderDate) ? formatDateTime(order.orderDate) : '',
                        order.price ? formatMoney(order.price, order.currency) : ''
                    ].filter(Boolean).join(' · '));
                    main.append(title, meta);
                    row.append(check, main);
                    if (reminderState) {
                        const [label, tone] = STATE_LABELS[reminderState] || [reminderState, ''];
                        const badge = pill(order.reminder.manual ? `${label} вручную` : label, tone);
                        if (order.reminder.reason) badge.title = order.reminder.reason;
                        row.append(badge);
                    } else if (!order.eligible) {
                        const badge = pill('Не подходит', 'warning');
                        badge.title = order.problem || 'Заказ не прошёл проверку';
                        row.append(badge);
                    }
                    list.append(row);
                }
                ordersPane.append(list);
            }
            const notes = node('div', 'fpt-rm-notes');
            if (data.pending > 0) {
                const more = button(`Проверить ещё ${data.pending} ${ui.pluralize(data.pending, ['заказ', 'заказа', 'заказов'])}`, 'fpt-rv-add', 'manage_search');
                more.disabled = candidates.loading;
                more.addEventListener('click', () => loadCandidates().catch(() => {}));
                notes.append(more);
            }
            if (data.unknown > 0) notes.append(hint('help', `По ${data.unknown} ${ui.pluralize(data.unknown, ['заказу', 'заказам', 'заказам'])} не удалось понять, есть ли отзыв, — они не показаны.`));
            if (data.salesError) notes.append(hint('warning', `Страница продаж не загрузилась: ${data.salesError}. Показаны заказы из журнала.`));
            if (candidates.loading) notes.append(hint('hourglass_top', 'Обновляем список…'));
            if (notes.childNodes.length) ordersPane.append(notes);
            renderSelection();
        }

        function renderTasks() {
            tasksPane.replaceChildren();
            if (!tasksData) return;
            const data = tasksData;
            const active = (data.counts?.scheduled || 0) + (data.counts?.deferred || 0);
            setTabLabel(tabButtons[1], 'Задачи', active || data.tasks.length);
            const counts = node('div', 'fpt-rm-counts');
            for (const [state, [label, tone]] of Object.entries(STATE_LABELS)) {
                if (data.counts?.[state]) counts.append(pill(`${label}: ${data.counts[state]}`, tone));
            }
            if (counts.childNodes.length) tasksPane.append(counts);
            if (!data.tasks.length) {
                tasksPane.append(empty('event_available', 'Задач пока нет', 'Напоминание появится после новой продажи, когда покупатель подтвердит заказ.'));
            } else {
                const list = node('div', 'fpt-rm-tasks');
                for (const task of data.tasks.slice(0, 30)) {
                    const [label, tone, iconName] = STATE_LABELS[task.state] || [task.state, '', 'help'];
                    const row = node('div', 'fpt-rv-bonus-row fpt-rm-task');
                    const badge = node('span', 'fpt-rv-row-number fpt-rm-task-icon');
                    badge.dataset.tone = tone;
                    badge.append(icon(iconName));
                    const main = node('span', 'fpt-rm-order-main');
                    const title = node('span', 'fpt-rm-order-title');
                    title.append(node('strong', '', `#${task.orderId}`), node('span', '', task.lotName || 'Заказ'));
                    const waiting = ['scheduled', 'deferred'].includes(task.state);
                    main.append(title, node('span', 'fpt-rm-order-meta', [
                        task.buyerName, task.manual ? 'вручную' : '',
                        waiting ? `проверка ${formatDateTime(task.nextCheckAt ?? task.dueAt)}` : '', task.reason || ''
                    ].filter(Boolean).join(' · ')));
                    row.append(badge, main, pill(label, tone));
                    if (waiting) {
                        const cancel = iconButton(`Отменить напоминание по заказу #${task.orderId}`, 'close');
                        cancel.dataset.action = 'remove';
                        cancel.addEventListener('click', async () => {
                            cancel.disabled = true;
                            try { await run('reminders', { command: 'cancel', key: task.key }); toast('Напоминание отменено'); await loadTasks(); }
                            catch (error) { cancel.disabled = false; toast(error.message, 'error'); }
                        });
                        row.append(cancel);
                    }
                    list.append(row);
                }
                tasksPane.append(list);
            }
            if (data.recent?.length) {
                const why = node('details', 'fpt-rm-why');
                const summary = node('summary', '');
                summary.append(icon('help'), node('span', '', 'Почему по недавним заказам нет напоминания'));
                const ul = node('ul', 'fpt-rm-why-list');
                data.recent.forEach(item => {
                    const li = node('li', '');
                    li.append(node('strong', '', `#${item.orderId}`), node('span', '', item.reason));
                    ul.append(li);
                });
                why.append(summary, ul);
                tasksPane.append(why);
            }
        }

        async function loadTasks() {
            try {
                tasksData = await run('reminders', { command: 'list' });
                renderTasks();
            } catch (error) {
                tasksPane.replaceChildren(empty('cloud_off', 'Задачи не загрузились', error.message));
            }
        }

        function loadCandidates({ refresh: recheck = false } = {}) {
            if (candidates.promise) return candidates.promise;
            candidates.loading = true;
            candidates.error = null;
            refresh.disabled = true;
            renderOrders();
            candidates.promise = run('reminders', { command: 'candidates', refresh: recheck })
                .then(data => {
                    candidates.data = data;
                    for (const lot of data.lots || []) lotTitles.set(String(lot.offerId), lot.title);
                    lotTags.render();
                    return data;
                })
                .catch(error => { candidates.error = error.message || 'Ошибка загрузки.'; throw error; })
                .finally(() => {
                    candidates.loading = false;
                    candidates.promise = null;
                    refresh.disabled = false;
                    renderOrders();
                });
            return candidates.promise;
        }
        function ensureCandidates() {
            return candidates.data ? Promise.resolve(candidates.data) : loadCandidates();
        }
        refresh.addEventListener('click', () => { loadCandidates({ refresh: true }).catch(() => {}); loadTasks(); });

        send.addEventListener('click', async () => {
            const ids = [...selected];
            if (!ids.length || sending) return;
            const noun = ui.pluralize(ids.length, ['покупателю', 'покупателям', 'покупателям']);
            if (!(await confirmDialog('Отправить напоминание?', `Сообщение уйдёт в чат ${ids.length} ${noun}. Перед отправкой каждый заказ проверяется ещё раз; повторно одному заказу не отправляется.`, 'Отправить', 'send'))) return;
            sending = true;
            refresh.disabled = true;
            renderSelection();
            setStatus(activity.status, 'Отправляем…', 'loading');
            try {
                const { results = [] } = await run('reminders', { command: 'sendManual', orderIds: ids });
                const sent = results.filter(item => item.state === 'sent').length;
                const problems = results.filter(item => item.state !== 'sent');
                ids.forEach(id => selected.delete(id));
                if (sent) toast(`Отправлено: ${sent}`);
                setStatus(activity.status, problems.length
                    ? `Не отправлено: ${problems.map(item => `#${item.orderId} — ${item.reason || STATE_LABELS[item.state]?.[0] || item.state}`).join('; ')}`
                    : '', problems.length ? 'error' : '');
            } catch (error) {
                setStatus(activity.status, error.message || 'Не удалось отправить.', 'error');
            } finally {
                sending = false;
                refresh.disabled = false;
                await Promise.all([loadCandidates().catch(() => {}), loadTasks()]);
                renderSelection();
            }
        });
        // Статус ошибки отправки сбрасывается при новом выборе.
        ordersPane.addEventListener('change', () => { if (activity.status.dataset.kind === 'error') { setStatus(activity.status, ''); renderSelection(); } });

        selectTab('orders');
        renderPreview();
        try {
            await loadSettings();
            settingsCard.controls.disabled = false;
            changed();
        } catch (error) {
            setStatus(settingsCard.status, error.message || 'Не удалось загрузить настройки напоминаний.', 'error');
        }
        loadTasks();
        // Проверка заказов открывает их страницы — запускаем, когда карточку видно.
        if (typeof IntersectionObserver === 'function') {
            const seen = new IntersectionObserver(entries => {
                if (!entries.some(entry => entry.isIntersecting)) return;
                seen.disconnect();
                ensureCandidates().catch(() => {});
            });
            seen.observe(activity.card);
        } else {
            ensureCandidates().catch(() => {});
        }
        return settingsCard.card;
    }

    root.FPTReviewReminderBlock = Object.freeze({ mount, normalize, renderTemplate });
})(window);
