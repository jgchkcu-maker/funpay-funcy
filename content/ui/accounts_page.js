// Accounts: saved FunPay sessions with one-click switching, own settings per account, notes,
// balance and unread counters. Session keys stay in the background; rows are addressed by record id.
(function (root) {
    'use strict';
    const PAGE_ID = 'accounts';
    const STORAGE_KEY = 'fpToolsAccounts';
    const NOTICE_KEY = 'fpToolsProfileNotice';
    const STALE_MS = 15 * 60 * 1000;
    const SYNC_BANNER_MS = 30 * 60 * 1000;
    const SEARCH_FROM = 4;
    const NOTE_MAX = 500;

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

    // The last refresh failed or was skipped after the last good snapshot.
    function refreshProblem(account) {
        const refresh = account?.refresh;
        if (!refresh || !['failed', 'locked'].includes(refresh.status)) return null;
        if ((Number(refresh.at) || 0) < (Number(account._snapTs) || 0)) return null;
        return { status: refresh.status, error: String(refresh.error || '') };
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
    function tag(className, iconName, label, title = '') {
        const el = node('span', `fpt-am-tag ${className}`.trim());
        el.append(icon(iconName), node('span', '', label));
        if (title) el.title = title;
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
    function pageUserName() {
        const name = document.querySelector('.user-link-name')?.textContent.trim();
        if (name) return name;
        try {
            const data = JSON.parse(document.body?.dataset?.appData || 'null');
            const user = Array.isArray(data) ? data[0] : data;
            return String(user?.userName || '').trim();
        } catch (_) {
            return '';
        }
    }
    function pageAvatar() {
        const photo = document.querySelector('.user-link-photo');
        const style = photo?.getAttribute('style') || '';
        return style.match(/url\((['"]?)(.*?)\1\)/)?.[2] || photo?.querySelector('img')?.getAttribute('src') || '';
    }

    async function mount(popup) {
        const page = popup?.querySelector(`.fp-tools-page-content[data-page="${PAGE_ID}"]`);
        if (!page || page._fptAccountsMount) return page?._fptAccountsMount;
        const ui = root.FPTPopupUI;
        if (!ui || !root.fptPopupActions) throw new Error('Shared popup components are unavailable.');
        const run = (action, payload) => root.fptPopupActions.run(PAGE_ID, action, payload);
        const toast = (message, kind = 'success') => ui.showToast?.(popup, message, kind);
        const state = {
            accounts: [], activeId: '', sessionStale: false, current: { userId: '', username: '', loggedIn: false },
            profiles: {}, notice: null, lastSync: null, automationActive: false,
            loaded: false, loadError: '', query: '', editing: null, draft: '',
            busy: new Map(), refreshing: null, activeDialog: null, hiddenSyncAt: 0
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
            '«Войти» переключает сессию и перезагружает вкладки FunPay — пароль вводить не нужно.',
            'У каждого аккаунта свои настройки: автоответы, автоподнятие, автовыдача, шаблоны, чёрный список и лоты. При переключении настройки прошлого аккаунта сохраняются и выключаются, а при возвращении — включаются снова.',
            'Новый аккаунт начинает со стандартных настроек. «Синхронизировать» переносит настройки с одного аккаунта на другой; привязки к конкретным лотам и статистика не переносятся.',
            'Если сессия истекла, войдите в этот аккаунт на FunPay и нажмите «Обновить сессию».',
            '«Баланс» — сумма из шапки FunPay. «Доступно» — часть, которую можно потратить или вывести (видна, только если отличается от баланса). «В ожидании» — оплаченные заказы, которые покупатель ещё не подтвердил.',
            'Пока работает автоматизация, данные других аккаунтов не обновляются: для этого Funcy пришлось бы на время подменить сессию.',
            'Ключи сессий хранятся только в фоне расширения в этом браузере и не попадают в резервные копии настроек.'
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
            'Сохраните свои аккаунты FunPay и переключайтесь между ними в один клик. У каждого аккаунта свои настройки Funcy.'));
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

        // --- Undo for the last sync --------------------------------------------------------------
        const syncBanner = node('div', 'fpt-qr-banner fpt-am-sync-banner');
        syncBanner.setAttribute('role', 'status');
        syncBanner.hidden = true;
        const syncBannerText = node('span', 'fpt-qr-banner-text');
        const undoButton = button('Вернуть как было', 'fpt-qr-ghost fpt-am-undo', 'undo');
        const hideSync = iconButton('close', 'Скрыть', 'fpt-am-sync-hide');
        syncBanner.append(icon('sync_saved_locally'), syncBannerText, undoButton, hideSync);
        undoButton.addEventListener('click', () => undoSync());
        hideSync.addEventListener('click', () => { state.hiddenSyncAt = state.lastSync?.at || Date.now(); renderSyncBanner(); });

        // --- Fresh account notice ----------------------------------------------------------------
        const noticeCard = node('section', 'fpt-qr-card fpt-am-notice');
        noticeCard.setAttribute('aria-labelledby', 'fpt-am-notice-title');
        noticeCard.hidden = true;
        const noticeHead = node('div', 'fpt-qr-card-head fpt-am-notice-head');
        const noticeEmblem = node('span', 'fpt-qr-emblem');
        noticeEmblem.append(icon('tune'));
        const noticeCopy = node('div', 'fpt-qr-card-copy');
        const noticeTitle = node('h3', '');
        noticeTitle.id = 'fpt-am-notice-title';
        const noticeText = node('p', '', 'Funcy впервые работает с этим аккаунтом: автоматизация выключена, шаблоны и списки пустые. Настройки можно перенести с другого аккаунта.');
        noticeCopy.append(noticeTitle, noticeText);
        const noticeActions = node('div', 'fpt-am-notice-actions');
        const noticeSync = button('Скопировать с другого аккаунта', 'fpt-qr-primary', 'sync_alt');
        const noticeHide = button('Скрыть', 'fpt-qr-ghost');
        noticeActions.append(noticeSync, noticeHide);
        noticeHead.append(noticeEmblem, noticeCopy, noticeActions);
        noticeCard.append(noticeHead);
        noticeSync.addEventListener('click', () => openSync({ toId: noticeAccount()?.id }));
        noticeHide.addEventListener('click', async () => {
            noticeCard.hidden = true;
            try { await run('dismissNotice'); } catch (_) {}
            await refreshState();
        });

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
        const syncButton = button('Синхронизировать', 'fpt-am-sync', 'sync_alt');
        syncButton.className = 'fpt-toolbar-button fpt-am-sync';
        syncButton.title = 'Перенести настройки Funcy с одного аккаунта на другой';
        const refreshButton = button('Обновить', '', 'refresh');
        refreshButton.className = 'fpt-toolbar-button fpt-am-refresh';
        refreshButton.id = 'fptRefreshAccountsBtn';
        refreshButton.title = 'Обновить баланс, аватары и непрочитанные';
        listHead.append(listTitle, countPill, updated, search, syncButton, refreshButton);
        const list = node('div', 'fpt-am-list');
        list.setAttribute('role', 'list');
        list.setAttribute('aria-labelledby', listTitle.id);
        const empty = node('div', 'fpt-qr-empty fpt-am-empty');
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        listSection.append(listHead, list, empty);
        search.addEventListener('input', () => { state.query = normalize(search.value); renderList(); });
        syncButton.addEventListener('click', () => openSync());
        refreshButton.addEventListener('click', () => refreshAll());

        screen.append(hero, banner, syncBanner, noticeCard, currentCard, listSection);

        // --- Derived state -----------------------------------------------------------------------
        const isActive = account => Boolean(state.activeId) && account.id === state.activeId;
        const activeAccount = () => state.accounts.find(isActive) || null;
        const byId = id => state.accounts.find(account => account.id === id) || null;
        const byUserId = userId => (userId ? state.accounts.find(account => account.userId === userId) || null : null);
        const profileOf = account => (account?.userId ? state.profiles[account.userId] || null : null);
        const noticeAccount = () => byUserId(state.notice?.accountId);
        const syncable = () => state.accounts.filter(account => account.userId);
        const currentName = () => state.current.username || pageUserName();
        const ordered = () => {
            const active = activeAccount();
            return active ? [active, ...state.accounts.filter(account => account !== active)] : state.accounts.slice();
        };
        const matches = account => !state.query
            || normalize(`${account.name} ${account.username || ''} ${account.note || ''}`).includes(state.query);
        const label = account => account?.name || account?.username || 'аккаунт';

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
            const name = currentName();
            if (!state.loaded) {
                heroPill.dataset.kind = state.loadError ? 'error' : 'neutral';
                heroPill.textContent = state.loadError ? 'Ошибка загрузки' : 'Загрузка…';
            } else if (active) {
                heroPill.dataset.kind = 'success';
                heroPill.textContent = `Вы в аккаунте ${active.name}`;
            } else if (state.current.loggedIn && name) {
                heroPill.dataset.kind = 'neutral';
                heroPill.textContent = `${name} не сохранён`;
            } else {
                heroPill.dataset.kind = 'neutral';
                heroPill.textContent = 'Вход не выполнен';
            }
            heroPill.title = heroPill.textContent;
        }

        function renderSyncBanner() {
            const last = state.lastSync;
            const show = state.loaded && last && Date.now() - last.at < SYNC_BANNER_MS && state.hiddenSyncAt !== last.at;
            syncBanner.hidden = !show;
            if (!show) return;
            const to = byUserId(last.accountId);
            const from = byUserId(last.from);
            syncBannerText.textContent = `Настройки «${label(to)}» заменены настройками «${label(from)}».`;
        }

        function renderNotice() {
            const account = noticeAccount();
            const show = state.loaded && Boolean(state.notice) && Boolean(account);
            noticeCard.hidden = !show;
            if (!show) return;
            noticeTitle.textContent = `У аккаунта «${account.name}» стандартные настройки`;
            noticeSync.hidden = !syncable().some(item => item.id !== account.id);
        }

        function renderCurrent() {
            const active = activeAccount();
            const stale = Boolean(active && state.sessionStale);
            const show = state.loaded && (!active || stale);
            currentCard.hidden = !show;
            if (!show) return;
            const name = state.current.loggedIn ? currentName() : '';
            currentCard.dataset.state = stale ? 'stale' : name ? 'ready' : 'signed-out';
            currentAvatarSlot.replaceChildren(name ? avatar({ name: active?.name || name, avatar: active?.avatar || pageAvatar() })
                : node('span', 'fpt-am-avatar fpt-am-avatar--ghost'));
            if (!name) currentAvatarSlot.firstChild.append(icon('person_off'));
            addButton.hidden = !name;
            addButton.replaceChildren(icon(stale ? 'key' : 'person_add'), node('span', '', stale ? 'Обновить сессию' : 'Добавить'));
            if (stale) {
                currentTitle.textContent = `Обновите сессию «${active.name}»`;
                currentText.textContent = 'Вы сейчас вошли в этот аккаунт, но Funcy хранит для него устаревший ключ. Нажмите «Обновить сессию», чтобы переключение снова работало.';
            } else if (name) {
                currentTitle.textContent = 'Добавить текущий аккаунт';
                currentText.textContent = `Вы вошли как ${name}. Сохраните этот аккаунт, чтобы потом возвращаться в него в один клик.`;
            } else {
                currentTitle.textContent = 'Вы не вошли в FunPay';
                currentText.textContent = 'Войдите в аккаунт FunPay на сайте, затем добавьте его сюда.';
            }
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
                    node('span', '', 'Ни одно название или заметка не совпадает с запросом.'), reset);
            }
        }

        function renderList() {
            const focusedEditor = state.editing && list.contains(document.activeElement)
                && document.activeElement.matches('.fpt-am-rename-input, .fpt-am-note-input');
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
            syncButton.hidden = total < 2;
            syncButton.disabled = !state.loaded || Boolean(state.refreshing);
            if (focusedEditor) {
                const input = list.querySelector('.fpt-am-rename-input, .fpt-am-note-input');
                input?.focus({ preventScroll: true });
                input?.setSelectionRange(input.value.length, input.value.length);
            }
        }

        function row(account) {
            const active = isActive(account);
            const busy = state.busy.get(account.id) || '';
            const editingName = state.editing?.id === account.id && state.editing.field === 'name';
            const editingNote = state.editing?.id === account.id && state.editing.field === 'note';
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
            if (editingName) {
                main.append(renameForm(account));
            } else {
                const titleLine = node('div', 'fpt-am-title');
                titleLine.append(node('strong', 'fpt-am-name', account.name));
                if (active) titleLine.append(tag('fpt-am-tag--active', 'radio_button_checked', 'Вы здесь'));
                if (account.loggedIn === false) {
                    titleLine.append(tag('fpt-am-tag--expired', 'link_off', 'Сессия истекла',
                        'Войдите в этот аккаунт на FunPay и нажмите «Обновить сессию»'));
                }
                if (profileOf(account)?.automation) {
                    titleLine.append(tag('fpt-am-tag--auto', 'bolt', 'Автоматизация',
                        'В настройках этого аккаунта включена автоматизация. Она работает, только пока вы в нём.'));
                }
                const problem = refreshProblem(account);
                if (problem?.status === 'locked') titleLine.append(tag('fpt-am-tag--locked', 'lock_clock', 'Не обновлялся', problem.error));
                if (problem?.status === 'failed') titleLine.append(tag('fpt-am-tag--failed', 'sync_problem', 'Ошибка обновления', problem.error));
                main.append(titleLine);
            }
            if (editingNote) main.append(noteForm(account));
            else if (account.note) {
                const note = node('p', 'fpt-am-note');
                note.append(icon('sticky_note_2'), node('span', '', account.note));
                main.append(note);
            }
            const meta = node('div', 'fpt-am-meta');
            // Older snapshots could store menu text («Финансы») instead of an amount; only amounts are shown.
            const parsed = parseBalance(account.balance);
            const balance = node('span', 'fpt-am-balance');
            balance.append(icon('account_balance_wallet'), node('span', '', parsed ? `Баланс ${account.balance}` : 'Баланс неизвестен'));
            balance.dataset.empty = String(!parsed);
            balance.title = 'Общий баланс из шапки FunPay, вместе с замороженными средствами';
            meta.append(balance);
            // The lot page also tells how much of it is spendable; shown only when it differs from the total.
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
            login.disabled = active || Boolean(busy) || Boolean(state.editing);
            if (!active) login.setAttribute('aria-label', `Войти в ${account.name}`);
            login.addEventListener('click', () => confirmSwitch(account));
            const refresh = iconButton('sync', `Обновить данные ${account.name}`, 'fpt-am-row-refresh');
            refresh.disabled = Boolean(busy) || Boolean(state.refreshing);
            refresh.addEventListener('click', () => refreshOne(account));
            const noteButton = iconButton('sticky_note_2', `Заметка к ${account.name}`, 'fpt-am-note-edit');
            noteButton.disabled = Boolean(busy) || editingNote;
            noteButton.addEventListener('click', () => startEdit(account, 'note'));
            const rename = iconButton('edit', `Переименовать ${account.name}`, 'fpt-am-rename');
            rename.disabled = Boolean(busy) || editingName;
            rename.addEventListener('click', () => startEdit(account, 'name'));
            const remove = iconButton('delete', `Удалить ${account.name}`, 'fpt-qr-icon-button--danger fpt-am-delete');
            remove.disabled = Boolean(busy);
            remove.addEventListener('click', () => confirmDelete(account));
            actions.append(login, refresh, noteButton, rename, remove);

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
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelEdit(); }
            });
            const save = iconButton('check', 'Сохранить название', 'fpt-am-rename-save');
            save.type = 'submit';
            save.disabled = !state.draft.trim();
            const cancel = iconButton('close', 'Отменить', 'fpt-am-rename-cancel');
            cancel.addEventListener('click', () => cancelEdit());
            form.addEventListener('submit', event => { event.preventDefault(); commitEdit(account); });
            form.append(input, save, cancel);
            return form;
        }

        function noteForm(account) {
            const form = node('form', 'fpt-am-note-form');
            const input = node('textarea', 'fpt-qr-textarea fpt-am-note-input');
            input.rows = 3;
            input.maxLength = NOTE_MAX;
            input.value = state.draft;
            input.placeholder = 'Например: основной, для ключей Steam, вывод по пятницам';
            input.setAttribute('aria-label', 'Заметка к аккаунту');
            const counter = node('span', 'fpt-am-note-counter', `${input.value.length}/${NOTE_MAX}`);
            input.addEventListener('input', () => { state.draft = input.value; counter.textContent = `${input.value.length}/${NOTE_MAX}`; });
            input.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelEdit(); }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commitEdit(account); }
            });
            const actions = node('div', 'fpt-am-note-actions');
            const save = button('Сохранить', 'fpt-qr-primary fpt-am-note-save', 'check');
            save.type = 'submit';
            const cancel = button('Отмена', 'fpt-qr-ghost fpt-am-note-cancel');
            cancel.addEventListener('click', () => cancelEdit());
            actions.append(counter, cancel, save);
            form.addEventListener('submit', event => { event.preventDefault(); commitEdit(account); });
            form.append(input, actions);
            return form;
        }

        function renderAll() {
            renderHero();
            renderSyncBanner();
            renderNotice();
            renderCurrent();
            renderList();
        }

        // --- Actions -----------------------------------------------------------------------------
        function setBusy(id, kind) {
            if (kind) state.busy.set(id, kind); else state.busy.delete(id);
            renderList();
        }

        async function addCurrent() {
            const stale = Boolean(activeAccount() && state.sessionStale);
            addButton.disabled = true;
            try {
                const result = await run('add', { name: currentName() || undefined });
                await refreshState();
                const name = result?.account?.name || currentName();
                toast(result?.updated ? `Сессия «${name}» обновлена` : `Аккаунт «${name}» сохранён`);
            } catch (error) {
                toast(error.message || (stale ? 'Не удалось обновить сессию.' : 'Не удалось добавить аккаунт.'), 'error');
            } finally {
                addButton.disabled = false;
            }
        }

        // Switching moves automation between accounts, so it is confirmed whenever automation or a fresh
        // config is involved. A plain switch between configured accounts stays one click.
        function confirmSwitch(account) {
            if (isActive(account) || state.busy.has(account.id)) return;
            const target = profileOf(account);
            const active = activeAccount();
            const lines = [];
            if (state.automationActive) {
                lines.push(`Автоматизация ${active ? `«${active.name}»` : 'текущего аккаунта'} остановится. Её настройки сохранятся и включатся снова, когда вы вернётесь.`);
            }
            if (account.userId && target && !target.exists) {
                lines.push(`У «${account.name}» ещё нет своих настроек: будут стандартные, автоматизация выключена. Перенести настройки можно после входа.`);
            } else if (target?.automation) {
                lines.push(`У «${account.name}» включена автоматизация — она начнёт работать сразу после входа.`);
            }
            if (!lines.length) { switchTo(account); return; }
            lines.push('Все открытые вкладки FunPay перезагрузятся.');
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, `Войти в «${account.name}»?`, { description: lines.join(' ') });
            state.activeDialog = dialog;
            dialog.dialog.classList.add('fpt-am-switch-dialog');
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Войти', 'fpt-qr-primary', 'login');
            confirm.addEventListener('click', () => { dialog.close({ force: true }); switchTo(account); });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        }

        async function switchTo(account) {
            if (isActive(account) || state.busy.has(account.id)) return;
            setBusy(account.id, 'switch');
            try {
                // A refresh swaps the session cookie temporarily; switching mid-refresh could be undone by it.
                if (state.refreshing) await state.refreshing.catch(() => {});
                const result = await run('switch', { id: account.id });
                toast(result?.created
                    ? `Вход в «${account.name}»: стандартные настройки, вкладки перезагрузятся…`
                    : `Переключаюсь на «${account.name}», вкладки перезагрузятся…`);
                state.activeId = account.id;
                state.busy.delete(account.id);
                renderAll();
            } catch (error) {
                setBusy(account.id, null);
                await refreshState();
                toast(`Не удалось войти в «${account.name}»: ${error.message || 'неизвестная ошибка'}`, 'error');
            }
        }

        function refreshMessage(result, account) {
            if (result?.status === 'ok') return [`Данные «${account.name}» обновлены`, 'success'];
            if (result?.status === 'locked') return [`«${account.name}» не обновлялся: пока работает автоматизация, другие аккаунты не обновляются`, 'warning'];
            return [result?.error || 'Не удалось обновить данные аккаунта.', 'error'];
        }

        async function refreshOne(account) {
            if (state.busy.has(account.id) || state.refreshing) return;
            setBusy(account.id, 'refresh');
            try {
                const result = await run('refresh', { id: account.id });
                const [message, kind] = refreshMessage(result, account);
                toast(message, kind);
            } catch (error) {
                toast(error.message || 'Не удалось обновить данные аккаунта.', 'error');
            } finally {
                state.busy.delete(account.id);
                await refreshState();
            }
        }

        function refreshAll({ silent = false, only = null } = {}) {
            if (state.refreshing || !state.accounts.length) return state.refreshing;
            const ids = (only || state.accounts).map(account => account.id).filter(Boolean);
            const counts = { ok: 0, failed: 0, locked: 0 };
            state.refreshing = (async () => {
                for (const id of ids) {
                    if (!page.isConnected) break;
                    if (!byId(id)) continue;
                    state.busy.set(id, 'refresh');
                    renderList();
                    try {
                        const result = await run('refresh', { id });
                        counts[result?.status === 'ok' ? 'ok' : result?.status === 'locked' ? 'locked' : 'failed'] += 1;
                        if (result?.account) state.accounts = state.accounts.map(item => (item.id === id ? result.account : item));
                    } catch (_) {
                        counts.failed += 1;
                    } finally {
                        state.busy.delete(id);
                        renderHero();
                        renderList();
                    }
                }
                return counts;
            })();
            renderList();
            const done = state.refreshing.then(result => {
                if (silent) return;
                const total = ids.length;
                if (result.failed) {
                    toast(`Не удалось обновить ${result.failed} ${pluralize(result.failed, ['аккаунт', 'аккаунта', 'аккаунтов'])} из ${total}`, 'warning');
                } else if (result.locked) {
                    toast(`Обновлено ${result.ok} из ${total}. Остальные не обновлялись, пока работает автоматизация, — у них показаны прошлые данные`, 'warning');
                } else toast('Данные аккаунтов обновлены');
            }).finally(async () => {
                state.refreshing = null;
                await refreshState();
            });
            return done;
        }

        function startEdit(account, field) {
            state.editing = { id: account.id, field };
            state.draft = field === 'note' ? account.note || '' : account.name;
            renderList();
            const input = list.querySelector(field === 'note' ? '.fpt-am-note-input' : '.fpt-am-rename-input');
            input?.focus();
            if (field === 'name') input?.select();
        }
        function cancelEdit() {
            const editing = state.editing;
            state.editing = null;
            state.draft = '';
            renderList();
            if (!editing) return;
            const index = ordered().filter(matches).findIndex(account => account.id === editing.id);
            list.querySelectorAll(editing.field === 'note' ? '.fpt-am-note-edit' : '.fpt-am-rename')[index]?.focus();
        }
        async function commitEdit(account) {
            const editing = state.editing;
            if (!editing || editing.id !== account.id) return;
            const value = state.draft.trim();
            if (editing.field === 'name') {
                if (!value) return;
                if (value === account.name) { cancelEdit(); return; }
            } else if (value === (account.note || '')) { cancelEdit(); return; }
            try {
                await run(editing.field === 'name' ? 'rename' : 'note', editing.field === 'name'
                    ? { id: account.id, name: value } : { id: account.id, note: value });
                state.editing = null;
                state.draft = '';
                await refreshState();
                toast(editing.field === 'name' ? 'Название сохранено' : value ? 'Заметка сохранена' : 'Заметка удалена');
            } catch (error) {
                toast(error.message || 'Не удалось сохранить.', 'error');
            }
        }

        function confirmDelete(account) {
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, 'Удалить аккаунт?', {
                description: `«${account.name}» пропадёт из списка. Сам аккаунт FunPay не затрагивается, а его настройки Funcy сохранятся — если добавить аккаунт снова, они вернутся.`
            });
            state.activeDialog = dialog;
            const cancel = button('Отмена', 'fpt-qr-ghost');
            cancel.addEventListener('click', () => dialog.close());
            const confirm = button('Удалить', 'fpt-qr-danger', 'delete');
            confirm.addEventListener('click', async () => {
                dialog.setBusy(true);
                try {
                    await run('delete', { id: account.id });
                    if (state.editing?.id === account.id) state.editing = null;
                    dialog.setBusy(false);
                    dialog.close();
                    await refreshState();
                    toast(`Аккаунт «${account.name}» удалён`);
                } catch (error) {
                    dialog.setBusy(false);
                    toast(error.message || 'Не удалось удалить аккаунт.', 'error');
                }
            });
            dialog.footer.append(cancel, confirm);
            dialog.focusInitial();
        }

        // --- Sync --------------------------------------------------------------------------------
        // Step 1 picks the source and the target, step 2 states what will be replaced and asks to confirm.
        function openSync({ toId } = {}) {
            const candidates = syncable();
            if (candidates.length < 2) {
                toast('Для синхронизации нужны два аккаунта с данными FunPay. Нажмите «Обновить» и попробуйте снова.', 'warning');
                return;
            }
            const active = activeAccount();
            let to = byId(toId) && byId(toId).userId ? byId(toId) : null;
            let from = active?.userId && active.id !== to?.id ? active : candidates.find(account => account.id !== to?.id);
            if (!to) to = candidates.find(account => account.id !== from.id);
            state.activeDialog?.close({ force: true });
            const dialog = ui.createDialog(popup, 'Синхронизация настроек');
            state.activeDialog = dialog;
            dialog.dialog.classList.add('fpt-am-sync-dialog');

            function choose() {
                dialog.body.replaceChildren(node('p', 'fpt-lot-dialog-copy',
                    'Настройки Funcy аккаунта-источника заменят настройки получателя: автоответы, автоподнятие, автовыдачу, шаблоны, чёрный список и метки покупателей.'));
                const fields = node('div', 'fpt-am-sync-fields');
                const field = (labelText, selected) => {
                    const wrap = node('label', 'fpt-qr-field');
                    wrap.append(node('span', 'fpt-qr-label', labelText));
                    const select = node('select', 'fpt-am-sync-select');
                    select.setAttribute('aria-label', labelText);
                    candidates.forEach(account => {
                        const option = node('option', '', `${account.name}${isActive(account) ? ' (вы здесь)' : ''}`);
                        option.value = account.id;
                        option.selected = account.id === selected.id;
                        select.append(option);
                    });
                    wrap.append(select);
                    fields.append(wrap);
                    return select;
                };
                const fromSelect = field('С аккаунта', from);
                const arrow = icon('arrow_downward');
                arrow.classList.add('fpt-am-sync-arrow');
                fields.append(arrow);
                const toSelect = field('На аккаунт', to);
                const hint = node('p', 'fpt-am-sync-hint');
                hint.setAttribute('role', 'status');
                dialog.body.append(fields, hint);
                const next = button('Далее', 'fpt-qr-primary', 'arrow_forward');
                const cancel = button('Отмена', 'fpt-qr-ghost');
                cancel.addEventListener('click', () => dialog.close());
                const validate = () => {
                    from = byId(fromSelect.value) || from;
                    to = byId(toSelect.value) || to;
                    let problem = '';
                    if (from.id === to.id) problem = 'Выберите разные аккаунты.';
                    else if (profileOf(from) && !profileOf(from).exists) problem = `У «${from.name}» ещё нет своих настроек — переносить нечего.`;
                    hint.textContent = problem;
                    hint.dataset.kind = problem ? 'error' : '';
                    next.disabled = Boolean(problem);
                };
                fromSelect.addEventListener('change', validate);
                toSelect.addEventListener('change', validate);
                next.addEventListener('click', () => { if (!next.disabled) confirmStep(); });
                dialog.footer.replaceChildren(cancel, next);
                validate();
                dialog.focusInitial();
            }

            function confirmStep() {
                const toActive = isActive(to);
                const lines = [
                    `Настройки «${to.name}» будут заменены настройками «${from.name}».`,
                    'Привязки к конкретным лотам, закреплённые чаты и статистика не переносятся — у другого аккаунта свои лоты.'
                ];
                if (toActive && profileOf(from)?.automation) lines.push(`Вы сейчас в «${to.name}»: перенесённая автоматизация начнёт работать сразу.`);
                lines.push('Отменить можно кнопкой «Вернуть как было» сразу после переноса.');
                dialog.body.replaceChildren(...lines.map(line => node('p', 'fpt-lot-dialog-copy', line)));
                const back = button('Назад', 'fpt-qr-ghost', 'arrow_back');
                back.addEventListener('click', () => choose());
                const confirm = button('Заменить настройки', 'fpt-qr-primary', 'sync_alt');
                confirm.addEventListener('click', async () => {
                    dialog.setBusy(true);
                    try {
                        await run('sync', { fromId: from.id, toId: to.id });
                        dialog.setBusy(false);
                        dialog.close();
                        state.hiddenSyncAt = 0;
                        await refreshState();
                        toast(`Настройки «${from.name}» перенесены на «${to.name}»`);
                    } catch (error) {
                        dialog.setBusy(false);
                        toast(error.message || 'Не удалось перенести настройки.', 'error');
                    }
                });
                dialog.footer.replaceChildren(back, confirm);
                confirm.focus({ preventScroll: true });
            }

            choose();
        }

        async function undoSync() {
            undoButton.disabled = true;
            try {
                const result = await run('undoSync');
                await refreshState();
                toast(`Прежние настройки «${label(byUserId(result?.accountId))}» возвращены`);
            } catch (error) {
                toast(error.message || 'Не удалось вернуть настройки.', 'error');
            } finally {
                undoButton.disabled = false;
            }
        }

        // --- Loading and sync --------------------------------------------------------------------
        function apply(result) {
            const data = result && typeof result === 'object' ? result : {};
            state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
            state.activeId = String(data.activeId || '');
            state.sessionStale = Boolean(data.sessionStale);
            state.current = { userId: String(data.current?.userId || ''), username: String(data.current?.username || ''), loggedIn: Boolean(data.current?.loggedIn) };
            state.profiles = data.profiles && typeof data.profiles === 'object' ? data.profiles : {};
            state.notice = data.notice || null;
            state.lastSync = data.lastSync || null;
            state.automationActive = Boolean(data.automationActive);
            if (state.editing && !byId(state.editing.id)) state.editing = null;
        }
        // Reloads derived state (active account, configs) after an action; keeps the last state on failure.
        async function refreshState() {
            try {
                apply(await run('list'));
            } catch (_) {}
            renderAll();
        }
        async function load() {
            retry.disabled = true;
            try {
                apply(await run('list'));
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
        // Each time the page is opened, snapshots older than STALE_MS are refreshed quietly. While automation
        // runs only the current account can be refreshed, so the others are left alone.
        function maybeAutoRefresh() {
            if (!state.loaded || state.refreshing || !page.classList.contains('active')) return;
            const now = Date.now();
            const pool = state.automationActive ? state.accounts.filter(isActive) : state.accounts;
            const stale = pool.filter(account => !account._snapTs || now - account._snapTs > STALE_MS);
            if (!stale.length) return;
            refreshAll({ silent: true, only: stale });
        }
        let reloadTimer = null;
        const onStorage = (changes, area) => {
            if (!page.isConnected) { dispose(); return; }
            if (area !== 'local' || !state.loaded || (!changes[STORAGE_KEY] && !changes[NOTICE_KEY])) return;
            if (changes[STORAGE_KEY]) {
                const next = changes[STORAGE_KEY].newValue;
                state.accounts = Array.isArray(next) ? next : [];
                if (state.editing && !byId(state.editing.id)) state.editing = null;
                renderAll();
            }
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => { if (!state.refreshing) refreshState(); }, 150);
        };
        const stopActivation = ui.onPageActivated(page, () => maybeAutoRefresh());
        function dispose() {
            clearTimeout(reloadTimer);
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

    root.FPTAccountsPage = Object.freeze({ mount, summarize, parseBalance, formatPending, initials, formatAgo, avatarUrl, refreshProblem });
})(typeof window !== 'undefined' ? window : globalThis);
