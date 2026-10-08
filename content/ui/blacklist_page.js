// Blacklist screen: buyers the autoresponder never answers and auto-delivery never serves.
// Entries live in fpToolsBlacklist; every write goes through the blacklist popup actions in content/features/blacklist.js.
(function (root) {
    'use strict';
    const PAGE_ID = 'blacklist';
    const STORAGE_KEY = 'fpToolsBlacklist';
    const SEARCH_FROM = 6;
    const FLAGS = Object.freeze([
        { key: 'blockDelivery', label: 'Автовыдача', icon: 'local_shipping', hint: 'Не выдавать товар автоматически' },
        { key: 'blockResponse', label: 'Автоответы', icon: 'smart_toy', hint: 'Не отправлять приветствие и автоответы' }
    ]);

    const normalize = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
    function pluralize(count, forms) {
        if (root.FPTPopupUI?.pluralize) return root.FPTPopupUI.pluralize(count, forms);
        const n = Math.abs(Math.trunc(Number(count) || 0));
        if (n % 100 >= 11 && n % 100 <= 14) return forms[2];
        return n % 10 === 1 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 ? forms[1] : forms[2];
    }

    // Stored entries may come from old versions or a settings import: drop junk, default the flags to "block".
    function normalizeEntries(raw) {
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        const entries = [];
        raw.forEach(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return;
            const username = String(item.username ?? '').trim();
            const key = username.toLowerCase();
            if (!username || seen.has(key)) return;
            seen.add(key);
            const addedAt = Number(item.addedAt);
            entries.push({
                username,
                note: typeof item.note === 'string' ? item.note : '',
                blockDelivery: item.blockDelivery !== false,
                blockResponse: item.blockResponse !== false,
                addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : 0
            });
        });
        return entries;
    }

    function initials(name) {
        const letters = Array.from(String(name ?? '').replace(/[^\p{L}\p{N}]/gu, ''));
        return letters.length ? letters.slice(0, 2).join('').toUpperCase() : '?';
    }

    function formatAdded(timestamp, now = Date.now()) {
        const ts = Number(timestamp) || 0;
        if (!ts) return 'Добавлен давно';
        const minutes = Math.max(0, Math.floor((now - ts) / 60000));
        if (minutes < 1) return 'Добавлен только что';
        if (minutes < 60) return `Добавлен ${minutes} мин назад`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Добавлен ${hours} ч назад`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'Добавлен вчера';
        if (days < 30) return `Добавлен ${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`;
        return `Добавлен ${new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }

    function node(tag, className, content) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content !== undefined) el.textContent = content;
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
    function iconButton(iconName, label, className = '') {
        const el = button('', `fpt-qr-icon-button ${className}`.trim(), iconName);
        el.setAttribute('aria-label', label);
        el.title = label;
        return el;
    }
    function metric(iconName, label, kind) {
        const element = node('div', 'fpt-qr-metric fpt-bl-metric');
        if (kind) element.dataset.kind = kind;
        const badge = node('span', 'fpt-qr-metric-icon');
        badge.append(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        copy.append(node('span', 'fpt-qr-metric-label', label), value);
        element.append(badge, copy);
        return { element, value };
    }
    // Toggle chip: pressed = this automation is blocked for the buyer.
    function flagChip(flag, pressed, compact = false) {
        const chip = node('button', `fpt-bl-chip${compact ? ' fpt-bl-chip--sm' : ''}`);
        chip.type = 'button';
        chip.dataset.flag = flag.key;
        chip.append(icon(flag.icon), node('span', 'fpt-bl-chip-label', flag.label), node('span', 'fpt-bl-chip-state'));
        setChip(chip, flag, pressed);
        return chip;
    }
    function setChip(chip, flag, pressed) {
        chip.setAttribute('aria-pressed', String(pressed));
        chip.querySelector('.fpt-bl-chip-state').textContent = pressed ? 'выкл.' : 'вкл.';
        chip.title = pressed ? `${flag.hint}. Нажмите, чтобы снова разрешить` : `${flag.label} работает для покупателя. Нажмите, чтобы заблокировать`;
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptBlacklistMount) return page?._fptBlacklistMount;
        const ui = root.FPTPopupUI;
        if (!ui || typeof ui.ensureCategoryHeader !== 'function' || !root.fptPopupActions) {
            throw new Error('Не удалось загрузить общий каркас категории.');
        }
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const toast = (message, kind = 'success') => ui.showToast?.(popup, message, kind);
        const state = {
            entries: [], loaded: false, loadError: '', query: '', editing: null, draft: '',
            busy: new Set(), pending: 0, fresh: null, activeDialog: null,
            draftFlags: { blockDelivery: true, blockResponse: true }
        };

        // --- Header and help ---------------------------------------------------------------------
        const helpPanel = node('aside', 'fpt-qr-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-bl-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по чёрному списку');
        helpPanel.append(node('h2', '', 'Чёрный список'));
        const helpList = node('ul', '');
        [
            '«Автовыдача» — покупателю не уйдёт товар автоматически, заказ придётся выдать вручную.',
            '«Автоответы» — бот не пришлёт ему приветствие, ответы на ключевые слова и сообщения после заказа.',
            'Флаги настраиваются для каждого покупателя отдельно. Подсвеченный чип — блокировка включена.',
            'Добавить покупателя можно и прямо из чата — кнопкой в карточке покупателя.',
            'Ник сравнивается без учёта регистра. Список попадает в резервную копию настроек.'
        ].forEach(item => helpList.append(node('li', '', item)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Чёрный список', {
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
        const onHelpOutside = event => { if (!helpAnchor.contains(event.target)) closeHelp(); };
        if (header.helpButton) {
            header.helpButton.setAttribute('aria-controls', helpPanel.id);
            header.helpButton.before(helpAnchor);
            helpAnchor.append(header.helpButton, helpPanel);
            document.addEventListener('pointerdown', onHelpOutside);
            page.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !helpPanel.hidden) { closeHelp(); header.helpButton.focus(); }
            });
        }

        const screen = node('div', 'fpt-bl');
        page.append(screen);

        // --- Hero --------------------------------------------------------------------------------
        const hero = node('section', 'fpt-qr-hero fpt-bl-hero');
        hero.setAttribute('aria-labelledby', 'fpt-bl-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.append(icon('block'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Чёрный список покупателей');
        heroTitle.id = 'fpt-bl-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Покупатели, которым Funcy не выдаёт товар и не отвечает автоматически. Для каждого можно выбрать, что именно отключить.'));
        heroMain.append(heroIcon, heroCopy);
        const metricTotal = metric('person_off', 'В списке');
        const metricDelivery = metric('local_shipping', 'Без автовыдачи', 'danger');
        const metricResponse = metric('smart_toy', 'Без автоответов', 'danger');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricTotal.element, metricDelivery.element, metricResponse.element);
        hero.append(heroMain, metrics);

        const banner = node('div', 'fpt-qr-banner');
        banner.setAttribute('role', 'alert');
        banner.hidden = true;
        const bannerText = node('span', 'fpt-qr-banner-text');
        const retry = button('Повторить', 'fpt-qr-banner-action', 'refresh');
        banner.append(icon('error'), bannerText, retry);
        retry.addEventListener('click', () => load());

        // --- Add form ----------------------------------------------------------------------------
        const addCard = node('section', 'fpt-qr-card fpt-bl-add');
        addCard.setAttribute('aria-labelledby', 'fpt-bl-add-title');
        const addHead = node('div', 'fpt-qr-card-head');
        const addEmblem = node('span', 'fpt-qr-emblem');
        addEmblem.append(icon('person_add'));
        const addCopy = node('div', 'fpt-qr-card-copy');
        const addTitle = node('h3', '', 'Добавить покупателя');
        addTitle.id = 'fpt-bl-add-title';
        addCopy.append(addTitle, node('p', '', 'Ник на FunPay — точно как в чате. Причина нужна только вам.'));
        addHead.append(addEmblem, addCopy);

        const form = node('form', 'fpt-bl-add-form');
        form.noValidate = true;
        const fields = node('div', 'fpt-bl-add-grid');
        const nameField = node('label', 'fpt-qr-field');
        const nameInput = node('input', 'fpt-qr-input fpt-bl-name-input');
        nameInput.type = 'text';
        nameInput.id = 'fptBlUsername';
        nameInput.maxLength = 64;
        nameInput.autocomplete = 'off';
        nameInput.spellcheck = false;
        nameInput.placeholder = 'Например, buyer123';
        nameField.append(node('span', 'fpt-qr-label', 'Пользователь'), nameInput);
        const noteField = node('label', 'fpt-qr-field');
        const noteInput = node('input', 'fpt-qr-input fpt-bl-note-input');
        noteInput.type = 'text';
        noteInput.id = 'fptBlNote';
        noteInput.maxLength = 160;
        noteInput.autocomplete = 'off';
        noteInput.placeholder = 'Необязательно: чарджбэк, грубил, мошенник…';
        noteField.append(node('span', 'fpt-qr-label', 'Причина'), noteInput);
        fields.append(nameField, noteField);
        const error = node('p', 'fpt-bl-error');
        error.id = 'fpt-bl-add-error';
        error.setAttribute('role', 'alert');
        error.hidden = true;
        nameInput.setAttribute('aria-describedby', error.id);

        const addFooter = node('div', 'fpt-bl-add-footer');
        const draftChips = node('div', 'fpt-bl-chips');
        draftChips.setAttribute('role', 'group');
        draftChips.setAttribute('aria-label', 'Что отключить для покупателя');
        draftChips.append(node('span', 'fpt-bl-chips-label', 'Для покупателя:'));
        FLAGS.forEach(flag => {
            const chip = flagChip(flag, state.draftFlags[flag.key]);
            chip.addEventListener('click', () => {
                state.draftFlags[flag.key] = !state.draftFlags[flag.key];
                setChip(chip, flag, state.draftFlags[flag.key]);
            });
            draftChips.append(chip);
        });
        const addButton = button('Добавить', 'fpt-qr-primary fpt-bl-add-button', 'block');
        addButton.id = 'fp-bl-add-btn';
        addButton.type = 'submit';
        addFooter.append(draftChips, addButton);
        form.append(fields, error, addFooter);
        addCard.append(addHead, form);

        const showError = message => {
            error.hidden = !message;
            error.replaceChildren();
            if (message) error.append(icon('error'), node('span', '', message));
            nameInput.setAttribute('aria-invalid', String(Boolean(message)));
        };
        nameInput.addEventListener('input', () => { if (!error.hidden) showError(''); });
        form.addEventListener('submit', event => { event.preventDefault(); addEntry(); });

        // --- List --------------------------------------------------------------------------------
        const listSection = node('section', 'fpt-qr-list-section fpt-bl-list-section');
        listSection.setAttribute('aria-labelledby', 'fpt-bl-list-title');
        const listHead = node('div', 'fpt-qr-list-head');
        const listTitle = node('h3', 'fpt-qr-list-title', 'Покупатели в списке');
        listTitle.id = 'fpt-bl-list-title';
        const countPill = node('span', 'fpt-qr-pill', '0');
        const search = node('input', 'fpt-qr-search fpt-bl-search');
        search.type = 'search';
        search.placeholder = 'Найти по нику или причине';
        search.setAttribute('aria-label', 'Найти по нику или причине');
        search.hidden = true;
        listHead.append(listTitle, countPill, search);
        const list = node('div', 'fpt-bl-list');
        list.setAttribute('role', 'list');
        list.setAttribute('aria-labelledby', listTitle.id);
        const empty = node('div', 'fpt-qr-empty fpt-bl-empty');
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        listSection.append(listHead, list, empty);
        search.addEventListener('input', () => { state.query = normalize(search.value); renderList(); });

        screen.append(hero, banner, addCard, listSection);

        // --- Rendering ---------------------------------------------------------------------------
        const findEntry = username => state.entries.find(entry => entry.username.toLowerCase() === String(username).trim().toLowerCase());
        const ordered = () => state.entries.slice().sort((a, b) => b.addedAt - a.addedAt);
        const matches = entry => !state.query || normalize(`${entry.username} ${entry.note}`).includes(state.query);

        function renderHero() {
            const total = state.entries.length;
            const delivery = state.entries.filter(entry => entry.blockDelivery).length;
            const response = state.entries.filter(entry => entry.blockResponse).length;
            metricTotal.value.textContent = state.loaded ? String(total) : '—';
            metricDelivery.value.textContent = state.loaded ? String(delivery) : '—';
            metricResponse.value.textContent = state.loaded ? String(response) : '—';
            hero.dataset.state = state.loaded && total ? 'on' : 'off';
            if (!state.loaded) {
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                heroPill.textContent = state.loadError ? 'Ошибка загрузки' : 'Загрузка…';
            } else if (total) {
                heroPill.dataset.kind = 'error';
                heroPill.textContent = `${total} ${pluralize(total, ['покупатель', 'покупателя', 'покупателей'])}`;
            } else {
                heroPill.dataset.kind = 'success';
                heroPill.textContent = 'Список пуст';
            }
        }

        function renderEmpty(visible) {
            empty.hidden = !visible;
            if (!visible) return;
            empty.replaceChildren();
            if (!state.entries.length) {
                const focus = button('Добавить первого', 'fpt-qr-ghost', 'person_add');
                focus.addEventListener('click', () => nameInput.focus());
                empty.append(icon('verified_user'), node('strong', '', 'Список пуст'),
                    node('span', '', 'Сюда попадут покупатели, которым не нужно отвечать и выдавать товар автоматически.'), focus);
            } else {
                const reset = button('Сбросить поиск', 'fpt-qr-ghost', 'close');
                reset.addEventListener('click', () => { search.value = ''; state.query = ''; renderList(); search.focus(); });
                empty.append(icon('search_off'), node('strong', '', 'Ничего не найдено'),
                    node('span', '', 'Ни ник, ни причина не совпадают с запросом.'), reset);
            }
        }

        function renderList() {
            const editingFocused = state.editing && list.contains(document.activeElement) && document.activeElement.matches('.fpt-bl-note-edit');
            list.replaceChildren();
            const visible = ordered().filter(matches);
            visible.forEach((entry, index) => list.append(row(entry, index)));
            list.hidden = !visible.length;
            renderEmpty(state.loaded && !visible.length);
            const total = state.entries.length;
            countPill.textContent = String(total);
            countPill.title = `${total} ${pluralize(total, ['покупатель', 'покупателя', 'покупателей'])}`;
            search.hidden = total < SEARCH_FROM && !state.query;
            state.fresh = null;
            if (editingFocused) {
                const input = list.querySelector('.fpt-bl-note-edit');
                input?.focus({ preventScroll: true });
                input?.setSelectionRange(input.value.length, input.value.length);
            }
        }

        function row(entry, index) {
            const key = entry.username.toLowerCase();
            const busy = state.busy.has(key);
            const item = node('article', 'fpt-bl-row');
            item.setAttribute('role', 'listitem');
            item.setAttribute('aria-label', entry.username);
            item.dataset.user = key;
            item.style.setProperty('--fpt-bl-delay', `${Math.min(index, 12) * 28}ms`);
            if (state.fresh === key) item.dataset.fresh = 'true';
            if (busy) item.setAttribute('aria-busy', 'true');
            const idle = !entry.blockDelivery && !entry.blockResponse;
            item.dataset.idle = String(idle);

            const face = node('span', 'fpt-bl-avatar');
            face.setAttribute('aria-hidden', 'true');
            face.append(node('span', 'fpt-bl-initials', initials(entry.username)));
            const badge = node('span', 'fpt-bl-avatar-badge');
            badge.append(icon('block'));
            face.append(badge);

            const main = node('div', 'fpt-bl-main');
            const titleLine = node('div', 'fpt-bl-title');
            titleLine.append(node('strong', 'fpt-bl-name', entry.username));
            if (idle) {
                const tag = node('span', 'fpt-bl-tag fpt-bl-tag--idle');
                tag.append(icon('info'), node('span', '', 'Ничего не блокируется'));
                tag.title = 'Оба флага сняты: автоматика работает для этого покупателя как обычно';
                titleLine.append(tag);
            }
            main.append(titleLine);
            if (state.editing === key) {
                main.append(noteForm(entry));
            } else {
                const note = node('p', 'fpt-bl-note', entry.note || 'Без причины');
                note.dataset.empty = String(!entry.note);
                main.append(note);
            }
            const meta = node('div', 'fpt-bl-meta');
            const added = node('span', 'fpt-bl-added');
            added.append(icon('schedule'), node('span', '', formatAdded(entry.addedAt)));
            if (entry.addedAt) added.title = new Date(entry.addedAt).toLocaleString('ru-RU');
            meta.append(added);
            main.append(meta);

            const chips = node('div', 'fpt-bl-chips fpt-bl-row-chips');
            chips.setAttribute('role', 'group');
            chips.setAttribute('aria-label', `Что отключено для ${entry.username}`);
            FLAGS.forEach(flag => {
                const chip = flagChip(flag, entry[flag.key], true);
                chip.setAttribute('aria-label', `${flag.label} для ${entry.username}`);
                chip.disabled = busy;
                chip.addEventListener('click', () => toggleFlag(entry, flag));
                chips.append(chip);
            });

            const actions = node('div', 'fpt-bl-actions');
            const edit = iconButton('edit_note', `Изменить причину для ${entry.username}`, 'fpt-bl-edit');
            edit.disabled = busy || state.editing === key;
            edit.addEventListener('click', () => startEdit(entry));
            const remove = iconButton('delete', `Убрать ${entry.username} из списка`, 'fpt-qr-icon-button--danger fpt-bl-delete');
            remove.disabled = busy;
            remove.addEventListener('click', () => confirmDelete(entry));
            actions.append(chips, edit, remove);

            item.append(face, main, actions);
            return item;
        }

        function noteForm(entry) {
            const editForm = node('form', 'fpt-bl-note-form');
            const input = node('input', 'fpt-qr-input fpt-bl-note-edit');
            input.type = 'text';
            input.maxLength = 160;
            input.value = state.draft;
            input.placeholder = 'Причина';
            input.setAttribute('aria-label', `Причина для ${entry.username}`);
            input.addEventListener('input', () => { state.draft = input.value; });
            input.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelEdit(); }
            });
            const save = iconButton('check', 'Сохранить причину', 'fpt-bl-note-save');
            save.type = 'submit';
            const cancel = iconButton('close', 'Отменить', 'fpt-bl-note-cancel');
            cancel.addEventListener('click', () => cancelEdit());
            editForm.addEventListener('submit', event => { event.preventDefault(); commitEdit(entry); });
            editForm.append(input, save, cancel);
            return editForm;
        }

        function renderAll() {
            renderHero();
            renderList();
        }

        function flash(username) {
            const target = list.querySelector(`.fpt-bl-row[data-user="${CSS.escape(username.toLowerCase())}"]`);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.dataset.flash = 'true';
            setTimeout(() => { delete target.dataset.flash; }, 1200);
        }

        // --- Actions -----------------------------------------------------------------------------
        async function write(task) {
            state.pending += 1;
            try {
                return await task();
            } finally {
                state.pending -= 1;
            }
        }

        async function addEntry() {
            const username = nameInput.value.trim();
            const note = noteInput.value.trim();
            if (!username) { showError('Укажите ник покупателя.'); nameInput.focus(); return; }
            if (/\s/.test(username)) { showError('В нике FunPay не бывает пробелов.'); nameInput.focus(); return; }
            const existing = findEntry(username);
            if (existing) {
                showError(`${existing.username} уже в списке.`);
                if (state.query && !matches(existing)) { search.value = ''; state.query = ''; renderList(); }
                flash(existing.username);
                return;
            }
            const flags = { ...state.draftFlags };
            addButton.disabled = true;
            try {
                let entries = await write(() => run('fp-bl-add-btn', { username, note }));
                if (!flags.blockDelivery || !flags.blockResponse) {
                    entries = await write(() => run('updateBlacklistEntry', { username, settings: flags }));
                }
                state.entries = normalizeEntries(entries);
                state.fresh = username.toLowerCase();
                nameInput.value = '';
                noteInput.value = '';
                showError('');
                if (state.query && !normalize(`${username} ${note}`).includes(state.query)) { search.value = ''; state.query = ''; }
                renderAll();
                nameInput.focus();
                toast(`${username} добавлен в чёрный список`);
            } catch (failure) {
                showError(failure.message || 'Не удалось добавить покупателя.');
            } finally {
                addButton.disabled = false;
            }
        }

        async function toggleFlag(entry, flag) {
            const key = entry.username.toLowerCase();
            if (state.busy.has(key)) return;
            const next = !entry[flag.key];
            entry[flag.key] = next;
            state.busy.add(key);
            renderAll();
            try {
                const entries = await write(() => run('updateBlacklistEntry', { username: entry.username, settings: { [flag.key]: next } }));
                state.entries = normalizeEntries(entries);
                toast(next ? `${flag.label} отключена для ${entry.username}` : `${flag.label} снова работает для ${entry.username}`);
            } catch (failure) {
                entry[flag.key] = !next;
                toast(failure.message || 'Не удалось сохранить настройку.', 'error');
            } finally {
                state.busy.delete(key);
                renderAll();
                list.querySelector(`.fpt-bl-row[data-user="${CSS.escape(key)}"] .fpt-bl-chip[data-flag="${flag.key}"]`)?.focus({ preventScroll: true });
            }
        }

        function startEdit(entry) {
            state.editing = entry.username.toLowerCase();
            state.draft = entry.note;
            renderList();
            const input = list.querySelector('.fpt-bl-note-edit');
            input?.focus();
            input?.select();
        }
        function cancelEdit() {
            const key = state.editing;
            state.editing = null;
            state.draft = '';
            renderList();
            if (key) list.querySelector(`.fpt-bl-row[data-user="${CSS.escape(key)}"] .fpt-bl-edit`)?.focus();
        }
        async function commitEdit(entry) {
            const note = state.draft.trim();
            if (note === entry.note) { cancelEdit(); return; }
            try {
                const entries = await write(() => run('updateBlacklistEntry', { username: entry.username, settings: { note } }));
                state.entries = normalizeEntries(entries);
                const key = state.editing;
                state.editing = null;
                state.draft = '';
                renderAll();
                if (key) list.querySelector(`.fpt-bl-row[data-user="${CSS.escape(key)}"] .fpt-bl-edit`)?.focus();
                toast(note ? 'Причина сохранена' : 'Причина удалена');
            } catch (failure) {
                toast(failure.message || 'Не удалось сохранить причину.', 'error');
            }
        }

        function confirmDelete(entry) {
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, 'Убрать из чёрного списка?', {
                description: `${entry.username} снова будет получать автовыдачу и автоответы как обычный покупатель.`
            });
            state.activeDialog = dialog;
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Убрать', 'fpt-qr-danger', 'delete');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                const target = list.querySelector(`.fpt-bl-row[data-user="${CSS.escape(entry.username.toLowerCase())}"]`);
                try {
                    const entries = await write(() => run('removeFromBlacklistByName', { username: entry.username }));
                    dialog.setBusy(false);
                    dialog.close();
                    if (target && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                        target.dataset.leaving = 'true';
                        await new Promise(resolve => setTimeout(resolve, 220));
                    }
                    state.entries = normalizeEntries(entries);
                    if (state.editing === entry.username.toLowerCase()) state.editing = null;
                    renderAll();
                    toast(`${entry.username} убран из чёрного списка`);
                } catch (failure) {
                    dialog.setBusy(false);
                    toast(failure.message || 'Не удалось убрать покупателя.', 'error');
                }
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        }

        // --- Loading and sync --------------------------------------------------------------------
        async function load() {
            retry.disabled = true;
            try {
                const stored = await run('getSettings', { keys: [STORAGE_KEY] });
                state.entries = normalizeEntries(stored?.[STORAGE_KEY]);
                state.loaded = true;
                state.loadError = '';
                banner.hidden = true;
            } catch (failure) {
                state.loadError = failure.message || 'Не удалось загрузить чёрный список.';
                bannerText.textContent = state.loadError;
                banner.hidden = false;
            } finally {
                retry.disabled = false;
                renderAll();
            }
        }
        // Additions from a buyer's chat, another tab or a settings import show up without reopening the popup.
        const onStorage = (changes, area) => {
            if (!page.isConnected) { dispose(); return; }
            if (area !== 'local' || !changes[STORAGE_KEY] || !state.loaded || state.pending) return;
            state.entries = normalizeEntries(changes[STORAGE_KEY].newValue);
            if (state.editing && !findEntry(state.editing)) state.editing = null;
            renderAll();
        };
        function dispose() {
            document.removeEventListener('pointerdown', onHelpOutside);
            root.chrome?.storage?.onChanged?.removeListener?.(onStorage);
            state.activeDialog?.close({ force: true });
            disposal.disconnect();
        }
        root.chrome?.storage?.onChanged?.addListener(onStorage);
        const disposal = new MutationObserver(() => { if (!page.isConnected) dispose(); });
        disposal.observe(document.body, { childList: true, subtree: true });
        renderAll();
        const loading = load();
        page._fptBlacklistMount = loading;
        return loading;
    }

    root.FPTBlacklistPage = Object.freeze({ mount, normalizeEntries, formatAdded, initials });
})(typeof window !== 'undefined' ? window : globalThis);
