// Accounts: saved FunPay sessions with one-click switching, balance and unread counters.
// Session keys stay in memory and storage only; rows never carry them in the DOM.
(function (root) {
    'use strict';
    const PAGE_ID = 'accounts';
    const STORAGE_KEY = 'fpToolsAccounts';
    const STALE_MS = 15 * 60 * 1000;
    const SEARCH_FROM = 4;

    const normalize = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
    function pluralize(count, forms) {
        if (root.FPTPopupUI?.pluralize) return root.FPTPopupUI.pluralize(count, forms);
        const n = Math.abs(Math.trunc(Number(count) || 0));
        if (n % 100 >= 11 && n % 100 <= 14) return forms[2];
        return n % 10 === 1 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 ? forms[1] : forms[2];
    }

    // "1 234,50 ₽" → { amount: 1234.5, currency: '₽' }; null when there is no number.
    function parseBalance(text) {
        const value = String(text ?? '').replace(/[  ]/g, ' ').trim();
        const match = value.match(/-?\d[\d ]*(?:[.,]\d+)?/);
        if (!match) return null;
        const amount = Number(match[0].replace(/ /g, '').replace(',', '.'));
        if (!Number.isFinite(amount)) return null;
        const currency = (value.slice(0, match.index) + value.slice(match.index + match[0].length)).replace(/\s+/g, ' ').trim();
        return { amount, currency };
    }

    function formatAmount(amount, currency) {
        const digits = Number.isInteger(amount) ? 0 : 2;
        const number = amount.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
        return currency ? `${number} ${currency}` : number;
    }

    // Money in paid but unconfirmed orders, per currency sign: { '₽': 3200, '$': 4 } → "3 200 ₽ + 4 $".
    function formatPending(totals) {
        const entries = Object.entries(totals || {}).map(([sign, value]) => [sign, Math.round((Number(value) || 0) * 100) / 100]);
        const nonZero = entries.filter(([, value]) => value > 0);
        if (!nonZero.length) return formatAmount(0, entries[0]?.[0] || '₽');
        return nonZero.map(([sign, value]) => formatAmount(value, sign)).join(' + ');
    }

    // Totals for the hero. The balance is summed only when every known balance uses one currency.
    function summarize(accounts) {
        const list = Array.isArray(accounts) ? accounts : [];
        const balances = list.map(account => parseBalance(account.balance)).filter(Boolean);
        const currencies = new Set(balances.map(balance => balance.currency));
        let balance = '';
        if (balances.length && currencies.size === 1) {
            balance = formatAmount(balances.reduce((sum, item) => sum + item.amount, 0), balances[0].currency);
        } else if (balances.length) balance = 'разные валюты';
        const stamps = list.map(account => Number(account._snapTs) || 0).filter(Boolean);
        const withPending = list.filter(account => account.pending && typeof account.pending === 'object');
        const pendingTotals = {};
        withPending.forEach(account => Object.entries(account.pending.totals || {}).forEach(([sign, value]) => {
            pendingTotals[sign] = (pendingTotals[sign] || 0) + (Number(value) || 0);
        }));
        return {
            pending: withPending.length ? formatPending(pendingTotals) : '',
            pendingCount: withPending.reduce((sum, account) => sum + (Number(account.pending.count) || 0), 0),
            total: list.length,
            unread: list.reduce((sum, account) => sum + (Math.max(0, Number(account.unread) || 0)), 0),
            balance,
            expired: list.filter(account => account.loggedIn === false).length,
            updatedAt: stamps.length ? Math.min(...stamps) : 0
        };
    }

    function initials(name) {
        const words = String(name ?? '').trim().split(/[\s_\-.]+/).filter(Boolean);
        if (!words.length) return '?';
        const letters = words.length > 1 ? Array.from(words[0])[0] + Array.from(words[1])[0] : Array.from(words[0])[0];
        return letters.toUpperCase();
    }

    function formatAgo(timestamp, now = Date.now()) {
        const ts = Number(timestamp) || 0;
        if (!ts) return '';
        const minutes = Math.max(0, Math.floor((now - ts) / 60000));
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин назад`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ч назад`;
        const days = Math.floor(hours / 24);
        return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`;
    }

    // FunPay's placeholder avatar carries no information, so initials are shown instead.
    function avatarUrl(value) {
        const raw = String(value ?? '').trim();
        if (!raw || /\/img\/layout\/avatar/i.test(raw)) return '';
        try {
            const url = new URL(raw, 'https://funpay.com/');
            return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
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
    function metric(iconName, label) {
        const element = node('div', 'fpt-qr-metric');
        const badge = node('span', 'fpt-qr-metric-icon');
        badge.append(icon(iconName));
        const copy = node('div', 'fpt-qr-metric-copy');
        const value = node('strong', 'fpt-qr-metric-value', '—');
        const sub = node('span', 'fpt-am-metric-sub');
        sub.hidden = true;
        copy.append(node('span', 'fpt-qr-metric-label', label), value, sub);
        element.append(badge, copy);
        return { element, value, sub };
    }
    function avatar(account, className = '') {
        const wrap = node('span', `fpt-am-avatar ${className}`.trim());
        wrap.setAttribute('aria-hidden', 'true');
        const letters = node('span', 'fpt-am-initials', initials(account.name || account.username));
        wrap.append(letters);
        const src = avatarUrl(account.avatar);
        if (src) {
            const img = node('img', 'fpt-am-photo');
            img.alt = '';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('load', () => wrap.classList.add('has-photo'));
            img.addEventListener('error', () => img.remove());
            img.src = src;
            wrap.append(img);
        }
        return wrap;
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptAccountsMount) return page?._fptAccountsMount;
        const ui = root.FPTPopupUI;
        if (!ui || !root.fptPopupActions) throw new Error('Shared popup components are unavailable.');
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const toast = (message, kind = 'success') => ui.showToast?.(popup, message, kind);
        const state = {
            accounts: [], current: { name: '', key: '' }, loaded: false, loadError: '', query: '',
            editing: null, draft: '', busy: new Map(), refreshing: null, activeDialog: null
        };

        // --- Header and help ---------------------------------------------------------------------
        const helpPanel = node('aside', 'fpt-qr-help fpt-lot-help-popover');
        helpPanel.hidden = true;
        helpPanel.id = 'fpt-am-help';
        helpPanel.setAttribute('role', 'region');
        helpPanel.setAttribute('aria-label', 'Справка по аккаунтам');
        helpPanel.append(node('h2', '', 'Аккаунты'));
        const helpList = node('ul', '');
        [
            'Войдите в аккаунт FunPay и нажмите «Добавить» — Funcy запомнит его сессию.',
            'Чтобы добавить ещё один, выйдите, войдите в другой аккаунт и добавьте его тоже.',
            '«Войти» переключает сессию и перезагружает страницу — пароль вводить не нужно.',
            '«Баланс» — сумма из шапки FunPay. «Доступно» — часть, которую можно потратить или вывести (видна, только если отличается от баланса). «В ожидании» — оплаченные заказы, которые покупатель ещё не подтвердил.',
            'Данные обновляются сами при входе в раздел, если им больше 15 минут, или по кнопке «Обновить».',
            'Ключи сессий хранятся только в этом браузере и не попадают в резервные копии настроек.'
        ].forEach(item => helpList.append(node('li', '', item)));
        helpPanel.append(helpList);
        const header = ui.ensureCategoryHeader(page, 'Аккаунты', {
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
        const onHelpOutside = event => { if (!helpAnchor.contains(event.target)) closeHelp(); };
        document.addEventListener('pointerdown', onHelpOutside);
        page.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !helpPanel.hidden) { closeHelp(); header.helpButton.focus(); }
        });

        const screen = node('div', 'fpt-accounts');
        page.append(screen);

        // --- Hero --------------------------------------------------------------------------------
        const hero = node('section', 'fpt-qr-hero fpt-am-hero');
        hero.setAttribute('aria-labelledby', 'fpt-am-hero-title');
        const heroMain = node('div', 'fpt-qr-hero-main');
        const heroIcon = node('span', 'fpt-qr-hero-icon');
        heroIcon.append(icon('switch_account'));
        const heroCopy = node('div', 'fpt-qr-hero-copy');
        const heroTitleRow = node('div', 'fpt-qr-hero-title-row');
        const heroTitle = node('h2', 'fpt-qr-hero-title', 'Управление аккаунтами');
        heroTitle.id = 'fpt-am-hero-title';
        const heroPill = node('span', 'fpt-qr-pill', 'Загрузка…');
        heroTitleRow.append(heroTitle, heroPill);
        heroCopy.append(heroTitleRow, node('p', 'fpt-qr-hero-description',
            'Сохраните свои аккаунты FunPay и переключайтесь между ними в один клик — без пароля и повторного входа.'));
        heroMain.append(heroIcon, heroCopy);
        const metricTotal = metric('group', 'Сохранено');
        const metricBalance = metric('account_balance_wallet', 'Общий баланс');
        const metricUnread = metric('mark_chat_unread', 'Непрочитанные');
        const metrics = node('div', 'fpt-qr-metrics');
        metrics.append(metricTotal.element, metricBalance.element, metricUnread.element);
        hero.append(heroMain, metrics);

        const banner = node('div', 'fpt-qr-banner');
        banner.setAttribute('role', 'alert');
        banner.hidden = true;
        const bannerText = node('span', 'fpt-qr-banner-text');
        const retry = button('Повторить', 'fpt-qr-banner-action', 'refresh');
        banner.append(icon('error'), bannerText, retry);
        retry.addEventListener('click', () => load());

        // --- Current session ---------------------------------------------------------------------
        const currentCard = node('section', 'fpt-qr-card fpt-am-current');
        currentCard.setAttribute('aria-labelledby', 'fpt-am-current-title');
        currentCard.hidden = true;
        const currentHead = node('div', 'fpt-am-current-head');
        const currentAvatarSlot = node('span', 'fpt-am-current-avatar');
        const currentCopy = node('div', 'fpt-qr-card-copy');
        const currentTitle = node('h3', '', 'Добавить текущий аккаунт');
        currentTitle.id = 'fpt-am-current-title';
        const currentText = node('p', '');
        currentCopy.append(currentTitle, currentText);
        const addButton = button('Добавить', 'fpt-qr-primary fpt-am-add', 'person_add');
        addButton.id = 'addCurrentAccountBtn';
        currentHead.append(currentAvatarSlot, currentCopy, addButton);
        currentCard.append(currentHead);
        addButton.addEventListener('click', () => addCurrent());

        // --- Saved accounts ----------------------------------------------------------------------
        const listSection = node('section', 'fpt-qr-list-section fpt-am-list-section');
        listSection.setAttribute('aria-labelledby', 'fpt-am-list-title');
        const listHead = node('div', 'fpt-qr-list-head fpt-am-list-head');
        const listTitle = node('h3', 'fpt-qr-list-title', 'Сохраненные аккаунты');
        listTitle.id = 'fpt-am-list-title';
        const countPill = node('span', 'fpt-qr-pill', '0');
        const updated = node('span', 'fpt-am-updated');
        const search = node('input', 'fpt-qr-search fpt-am-search');
        search.type = 'search';
        search.placeholder = 'Найти аккаунт';
        search.setAttribute('aria-label', 'Найти аккаунт');
        search.hidden = true;
        const refreshButton = button('Обновить', '', 'refresh');
        refreshButton.className = 'fpt-toolbar-button fpt-am-refresh';
        refreshButton.id = 'fptRefreshAccountsBtn';
        refreshButton.title = 'Обновить баланс, аватары и непрочитанные';
        listHead.append(listTitle, countPill, updated, search, refreshButton);
        const list = node('div', 'fpt-am-list');
        list.setAttribute('role', 'list');
        list.setAttribute('aria-labelledby', listTitle.id);
        const empty = node('div', 'fpt-qr-empty fpt-am-empty');
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        listSection.append(listHead, list, empty);
        search.addEventListener('input', () => { state.query = normalize(search.value); renderList(); });
        refreshButton.addEventListener('click', () => refreshAll());

        screen.append(hero, banner, currentCard, listSection);

        // --- Derived state -----------------------------------------------------------------------
        const isActive = account => state.current.key
            ? account.key === state.current.key
            : Boolean(state.current.name) && account.name === state.current.name;
        const activeAccount = () => state.accounts.find(isActive) || null;
        const ordered = () => {
            const active = activeAccount();
            return active ? [active, ...state.accounts.filter(account => account !== active)] : state.accounts.slice();
        };
        const matches = account => !state.query
            || normalize(`${account.name} ${account.username || ''}`).includes(state.query);

        function renderHero() {
            const summary = summarize(state.accounts);
            const active = activeAccount();
            metricTotal.value.textContent = state.loaded ? String(summary.total) : '—';
            metricBalance.value.textContent = state.loaded && summary.balance ? summary.balance : '—';
            metricBalance.value.title = summary.balance === 'разные валюты' ? 'Балансы в разных валютах не складываются' : '';
            metricBalance.sub.hidden = !state.loaded || !summary.pending;
            metricBalance.sub.textContent = summary.pending ? `+${summary.pending} в ожидании` : '';
            metricBalance.sub.title = summary.pendingCount
                ? `Оплачено, но не подтверждено: ${summary.pendingCount} ${pluralize(summary.pendingCount, ['заказ', 'заказа', 'заказов'])}` : '';
            metricUnread.value.textContent = state.loaded ? String(summary.unread) : '—';
            hero.dataset.state = active ? 'on' : 'off';
            if (!state.loaded) {
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                heroPill.textContent = state.loadError ? 'Ошибка загрузки' : 'Загрузка…';
            } else if (active) {
                heroPill.dataset.kind = 'success';
                heroPill.textContent = `Вы в аккаунте ${active.name}`;
            } else if (state.current.name) {
                heroPill.dataset.kind = 'neutral';
                heroPill.textContent = `${state.current.name} не сохранён`;
            } else {
                heroPill.dataset.kind = 'neutral';
                heroPill.textContent = 'Вход не выполнен';
            }
            heroPill.title = heroPill.textContent;
        }

        function renderCurrent() {
            const show = state.loaded && !activeAccount();
            currentCard.hidden = !show;
            if (!show) return;
            const name = state.current.name;
            currentCard.dataset.state = name ? 'ready' : 'signed-out';
            const photo = document.querySelector('.user-link-photo');
            const style = photo?.getAttribute('style') || '';
            const pageAvatar = style.match(/url\((['"]?)(.*?)\1\)/)?.[2] || photo?.querySelector('img')?.getAttribute('src') || '';
            currentAvatarSlot.replaceChildren(name ? avatar({ name, avatar: pageAvatar }) : node('span', 'fpt-am-avatar fpt-am-avatar--ghost'));
            if (!name) currentAvatarSlot.firstChild.append(icon('person_off'));
            currentTitle.textContent = name ? 'Добавить текущий аккаунт' : 'Вы не вошли в FunPay';
            currentText.textContent = name
                ? `Вы вошли как ${name}. Сохраните этот аккаунт, чтобы потом возвращаться в него в один клик.`
                : 'Войдите в аккаунт FunPay на сайте, затем добавьте его сюда.';
            addButton.hidden = !name;
        }

        function renderEmpty(visible) {
            empty.hidden = !visible;
            if (!visible) return;
            empty.replaceChildren();
            if (!state.accounts.length) {
                empty.append(icon('group_add'), node('strong', '', 'Нет сохраненных аккаунтов'),
                    node('span', '', 'Добавьте текущий аккаунт, затем войдите в другой и добавьте его тоже — переключаться можно будет в один клик.'));
            } else {
                const reset = button('Сбросить поиск', 'fpt-qr-ghost', 'close');
                reset.addEventListener('click', () => { search.value = ''; state.query = ''; renderList(); search.focus(); });
                empty.append(icon('search_off'), node('strong', '', 'Ничего не найдено'),
                    node('span', '', 'Ни одно название аккаунта не совпадает с запросом.'), reset);
            }
        }

        function renderList() {
            const focusedEditor = state.editing && list.contains(document.activeElement) && document.activeElement.matches('.fpt-am-rename-input');
            list.replaceChildren();
            const visible = ordered().filter(matches);
            visible.forEach(account => list.append(row(account)));
            list.hidden = !visible.length;
            renderEmpty(state.loaded && !visible.length);
            const total = state.accounts.length;
            countPill.textContent = String(total);
            countPill.title = `${total} ${pluralize(total, ['аккаунт', 'аккаунта', 'аккаунтов'])}`;
            search.hidden = total < SEARCH_FROM;
            const summary = summarize(state.accounts);
            updated.textContent = summary.updatedAt ? `Данные: ${formatAgo(summary.updatedAt)}` : '';
            updated.hidden = !summary.updatedAt;
            refreshButton.hidden = !total;
            refreshButton.disabled = !state.loaded || Boolean(state.refreshing);
            refreshButton.classList.toggle('is-busy', Boolean(state.refreshing));
            if (focusedEditor) {
                const input = list.querySelector('.fpt-am-rename-input');
                input?.focus({ preventScroll: true });
                input?.setSelectionRange(input.value.length, input.value.length);
            }
        }

        function row(account) {
            const active = isActive(account);
            const busy = state.busy.get(account.key) || '';
            const item = node('article', 'fpt-am-row');
            item.setAttribute('role', 'listitem');
            item.dataset.active = String(active);
            item.dataset.expired = String(account.loggedIn === false);
            if (busy) item.dataset.busy = busy;
            item.setAttribute('aria-label', active ? `${account.name}, текущий аккаунт` : account.name);

            const face = avatar(account);
            const unread = Math.max(0, Number(account.unread) || 0);
            if (unread) {
                const badge = node('span', 'fpt-am-unread', unread > 99 ? '99+' : String(unread));
                badge.title = `Непрочитанных сообщений: ${unread}`;
                face.append(badge);
            }
            if (busy === 'refresh') face.append(node('span', 'fpt-am-avatar-spinner'));

            const main = node('div', 'fpt-am-main');
            if (state.editing === account.key) {
                main.append(renameForm(account));
            } else {
                const titleLine = node('div', 'fpt-am-title');
                titleLine.append(node('strong', 'fpt-am-name', account.name));
                if (active) {
                    const badge = node('span', 'fpt-am-tag fpt-am-tag--active');
                    badge.append(icon('radio_button_checked'), node('span', '', 'Вы здесь'));
                    titleLine.append(badge);
                }
                if (account.loggedIn === false) {
                    const badge = node('span', 'fpt-am-tag fpt-am-tag--expired');
                    badge.append(icon('link_off'), node('span', '', 'Сессия истекла'));
                    badge.title = 'Войдите в этот аккаунт заново и добавьте его ещё раз';
                    titleLine.append(badge);
                }
                main.append(titleLine);
            }
            const meta = node('div', 'fpt-am-meta');
            // Older snapshots could store menu text («Финансы») instead of an amount; only amounts are shown.
            const hasBalance = Boolean(parseBalance(account.balance));
            const balance = node('span', 'fpt-am-balance');
            balance.append(icon('account_balance_wallet'), node('span', '', hasBalance ? `Баланс ${account.balance}` : 'Баланс неизвестен'));
            balance.dataset.empty = String(!hasBalance);
            balance.title = 'Общий баланс из шапки FunPay, вместе с замороженными средствами';
            meta.append(balance);
            // The lot page also tells how much of it is spendable; shown only when it differs from the total.
            const parsed = parseBalance(account.balance);
            const sign = parsed?.currency || '₽';
            const spendable = Number(account.funds?.available?.[sign]);
            if (parsed && Number.isFinite(spendable) && account.funds.available[sign] !== null && Math.abs(spendable - parsed.amount) > 0.004) {
                const available = node('span', 'fpt-am-available');
                available.append(icon('lock_open'), node('span', '', `Доступно ${formatAmount(spendable, sign)}`));
                available.title = 'Можно потратить или вывести прямо сейчас';
                meta.append(available);
            }
            if (account.pending && typeof account.pending === 'object') {
                const count = Number(account.pending.count) || 0;
                const pending = node('span', 'fpt-am-pending');
                const text = `В ожидании ${formatPending(account.pending.totals)}${count ? ` · ${count} ${pluralize(count, ['заказ', 'заказа', 'заказов'])}` : ''}`;
                pending.append(icon('hourglass_top'), node('span', '', text));
                pending.dataset.empty = String(!count);
                pending.title = 'Оплаченные заказы, которые покупатель ещё не подтвердил';
                meta.append(pending);
            }
            if (account.username && account.username !== account.name) {
                const nick = node('span', 'fpt-am-nick');
                nick.append(icon('alternate_email'), node('span', '', account.username));
                nick.title = 'Имя на FunPay';
                meta.append(nick);
            }
            const ago = formatAgo(account._snapTs);
            meta.append(node('span', 'fpt-am-ago', ago ? `обновлено ${ago}` : 'ещё не обновлялся'));
            main.append(meta);

            const actions = node('div', 'fpt-am-actions');
            const login = active
                ? button('Активен', 'fpt-am-login fpt-am-login--active', 'check_circle')
                : button(busy === 'switch' ? 'Вход…' : 'Войти', 'fpt-qr-primary fpt-am-login', busy === 'switch' ? 'progress_activity' : 'login');
            login.disabled = active || Boolean(busy) || state.editing === account.key;
            if (!active) login.setAttribute('aria-label', `Войти в ${account.name}`);
            login.addEventListener('click', () => switchTo(account));
            const refresh = iconButton('sync', `Обновить данные ${account.name}`, 'fpt-am-row-refresh');
            refresh.disabled = Boolean(busy) || Boolean(state.refreshing);
            refresh.addEventListener('click', () => refreshOne(account));
            const rename = iconButton('edit', `Переименовать ${account.name}`, 'fpt-am-rename');
            rename.disabled = Boolean(busy) || state.editing === account.key;
            rename.addEventListener('click', () => startRename(account));
            const remove = iconButton('delete', `Удалить ${account.name}`, 'fpt-qr-icon-button--danger fpt-am-delete');
            remove.disabled = Boolean(busy);
            remove.addEventListener('click', () => confirmDelete(account));
            actions.append(login, refresh, rename, remove);

            item.append(face, main, actions);
            return item;
        }

        function renameForm(account) {
            const form = node('form', 'fpt-am-rename-form');
            const input = node('input', 'fpt-qr-input fpt-am-rename-input');
            input.type = 'text';
            input.maxLength = 60;
            input.value = state.draft;
            input.setAttribute('aria-label', 'Новое название аккаунта');
            input.addEventListener('input', () => { state.draft = input.value; save.disabled = !input.value.trim(); });
            input.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelRename(); }
            });
            const save = iconButton('check', 'Сохранить название', 'fpt-am-rename-save');
            save.type = 'submit';
            save.disabled = !state.draft.trim();
            const cancel = iconButton('close', 'Отменить', 'fpt-am-rename-cancel');
            cancel.addEventListener('click', () => cancelRename());
            form.addEventListener('submit', event => { event.preventDefault(); commitRename(account); });
            form.append(input, save, cancel);
            return form;
        }

        function renderAll() {
            renderHero();
            renderCurrent();
            renderList();
        }

        // --- Actions -----------------------------------------------------------------------------
        function setBusy(key, kind) {
            if (kind) state.busy.set(key, kind); else state.busy.delete(key);
            renderList();
        }

        async function addCurrent() {
            addButton.disabled = true;
            try {
                const accounts = await run('addCurrentAccountBtn', { name: state.current.name || undefined });
                if (Array.isArray(accounts)) state.accounts = accounts;
                await detectCurrent();
                renderAll();
                toast(`Аккаунт «${state.current.name || accounts.at(-1)?.name}» сохранён`);
            } catch (error) {
                toast(error.message || 'Не удалось добавить аккаунт.', 'error');
            } finally {
                addButton.disabled = false;
            }
        }

        async function switchTo(account) {
            if (isActive(account) || state.busy.has(account.key)) return;
            setBusy(account.key, 'switch');
            try {
                // A refresh swaps the session cookie temporarily; switching mid-refresh could be undone by it.
                if (state.refreshing) await state.refreshing.catch(() => {});
                const response = await run('switchAccount', { key: account.key });
                if (!response?.success) throw new Error(response?.error || 'FunPay не принял сессию.');
                toast(`Переключаюсь на «${account.name}», страница перезагрузится…`);
                state.current = { name: account.username || account.name, key: account.key };
                state.busy.delete(account.key);
                renderAll();
            } catch (error) {
                setBusy(account.key, null);
                toast(`Не удалось войти в «${account.name}»: ${error.message || 'неизвестная ошибка'}`, 'error');
            }
        }

        async function refreshOne(account) {
            if (state.busy.has(account.key) || state.refreshing) return;
            setBusy(account.key, 'refresh');
            try {
                const accounts = await run('fptRefreshAccountsBtn', { key: account.key });
                if (Array.isArray(accounts)) state.accounts = accounts;
                toast(`Данные «${account.name}» обновлены`);
            } catch (error) {
                toast(error.message || 'Не удалось обновить данные аккаунта.', 'error');
            } finally {
                state.busy.delete(account.key);
                renderAll();
            }
        }

        function refreshAll({ silent = false } = {}) {
            if (state.refreshing || !state.accounts.length) return state.refreshing;
            const keys = state.accounts.map(account => account.key).filter(Boolean);
            state.refreshing = (async () => {
                let failed = 0;
                for (const key of keys) {
                    if (!page.isConnected) break;
                    if (!state.accounts.some(account => account.key === key)) continue;
                    state.busy.set(key, 'refresh');
                    renderList();
                    try {
                        const accounts = await run('fptRefreshAccountsBtn', { key });
                        if (Array.isArray(accounts)) state.accounts = accounts;
                    } catch (_) {
                        failed += 1;
                    } finally {
                        state.busy.delete(key);
                        renderHero();
                        renderList();
                    }
                }
                return failed;
            })();
            renderList();
            const done = state.refreshing.then(failed => {
                if (silent) return;
                if (!failed) toast('Данные аккаунтов обновлены');
                else toast(`Не удалось обновить ${failed} ${pluralize(failed, ['аккаунт', 'аккаунта', 'аккаунтов'])} из ${keys.length}`, 'warning');
            }).finally(() => {
                state.refreshing = null;
                renderAll();
            });
            return done;
        }

        function startRename(account) {
            state.editing = account.key;
            state.draft = account.name;
            renderList();
            const input = list.querySelector('.fpt-am-rename-input');
            input?.focus();
            input?.select();
        }
        function cancelRename() {
            const key = state.editing;
            state.editing = null;
            state.draft = '';
            renderList();
            const index = ordered().filter(matches).findIndex(account => account.key === key);
            list.querySelectorAll('.fpt-am-rename')[index]?.focus();
        }
        async function commitRename(account) {
            const name = state.draft.trim();
            if (!name) return;
            if (name === account.name) { cancelRename(); return; }
            try {
                const accounts = await run('renameAccount', { key: account.key, name });
                if (Array.isArray(accounts)) state.accounts = accounts;
                state.editing = null;
                state.draft = '';
                renderAll();
                toast('Название сохранено');
            } catch (error) {
                toast(error.message || 'Не удалось переименовать аккаунт.', 'error');
            }
        }

        function confirmDelete(account) {
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, 'Удалить аккаунт?', {
                description: `«${account.name}» пропадёт из списка. Сам аккаунт FunPay не затрагивается — чтобы вернуть его, войдите в него и добавьте снова.`
            });
            state.activeDialog = dialog;
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Удалить', 'fpt-qr-danger', 'delete');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    const accounts = await run('deleteAccount', { key: account.key });
                    if (Array.isArray(accounts)) state.accounts = accounts;
                    if (state.editing === account.key) state.editing = null;
                    dialog.setBusy(false);
                    dialog.close();
                    renderAll();
                    toast(`Аккаунт «${account.name}» удалён`);
                } catch (error) {
                    dialog.setBusy(false);
                    toast(error.message || 'Не удалось удалить аккаунт.', 'error');
                }
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        }

        // --- Loading and sync --------------------------------------------------------------------
        async function detectCurrent() {
            try {
                const current = await run('getCurrentAccount');
                state.current = { name: String(current?.name || ''), key: String(current?.key || '') };
            } catch (_) {
                state.current = { name: '', key: '' };
            }
        }
        async function load() {
            retry.disabled = true;
            try {
                const [stored] = await Promise.all([run('getSettings', { keys: [STORAGE_KEY] }), detectCurrent()]);
                state.accounts = Array.isArray(stored?.[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
                state.loaded = true;
                state.loadError = '';
                banner.hidden = true;
            } catch (error) {
                state.loadError = error.message || 'Не удалось загрузить сохранённые аккаунты.';
                bannerText.textContent = state.loadError;
                banner.hidden = false;
            } finally {
                retry.disabled = false;
                renderAll();
                maybeAutoRefresh();
            }
        }
        // Each time the page is opened, snapshots older than STALE_MS are refreshed quietly.
        function maybeAutoRefresh() {
            if (!state.loaded || state.refreshing || !page.classList.contains('active')) return;
            const now = Date.now();
            if (!state.accounts.some(account => account.key && (!account._snapTs || now - account._snapTs > STALE_MS))) return;
            refreshAll({ silent: true });
        }
        const onStorage = (changes, area) => {
            if (!page.isConnected) { dispose(); return; }
            if (area !== 'local' || !changes[STORAGE_KEY] || !state.loaded) return;
            const next = changes[STORAGE_KEY].newValue;
            state.accounts = Array.isArray(next) ? next : [];
            if (state.editing && !state.accounts.some(account => account.key === state.editing)) state.editing = null;
            renderAll();
        };
        const stopActivation = ui.onPageActivated(page, () => maybeAutoRefresh());
        function dispose() {
            document.removeEventListener('pointerdown', onHelpOutside);
            root.chrome?.storage?.onChanged?.removeListener?.(onStorage);
            state.activeDialog?.close({ force: true });
            stopActivation();
            disposal.disconnect();
        }
        root.chrome?.storage?.onChanged?.addListener(onStorage);
        const disposal = new MutationObserver(() => { if (!page.isConnected) dispose(); });
        disposal.observe(document.body, { childList: true, subtree: true });
        renderAll();
        const loading = load();
        page._fptAccountsMount = loading;
        return loading;
    }

    root.FPTAccountsPage = Object.freeze({ mount, summarize, parseBalance, formatPending, initials, formatAgo, avatarUrl });
})(typeof window !== 'undefined' ? window : globalThis);
