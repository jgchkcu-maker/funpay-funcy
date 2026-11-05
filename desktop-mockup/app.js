// Funcy Desktop — ядро макета: компоненты, роутер, оверлеи, главная.
(function () {
    const D = window.DATA;
    const FD = window.FD = { routes: {}, acts: {}, state: {} };

    /* ---------- Хелперы разметки ---------- */
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ic = (name, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;
    const money = (n, cur = '₽') => (n == null ? '—' : `${Math.round(n).toLocaleString('ru-RU')} ${cur}`);
    const sw = (on, attrs = '', cls = '') => `<label class="switch ${cls}"><input type="checkbox" ${on ? 'checked' : ''} ${attrs}><span class="track"></span></label>`;
    const cb = (on, attrs = '') => `<input type="checkbox" class="cb" ${on ? 'checked' : ''} ${attrs}>`;

    function sel(options, value, opts = {}) {
        const list = options.map((o) => (Array.isArray(o) ? o : [o, o]));
        const cur = list.find(([v]) => v === value) || list[0];
        return `<button type="button" class="sel ${opts.block ? 'block' : ''}" ${opts.id ? `id="${opts.id}"` : ''} ${opts.attrs || ''}
            data-sel="${esc(JSON.stringify(list))}" data-value="${esc(cur[0])}">
            ${opts.icon ? ic(opts.icon) : ''}<span class="val">${esc(cur[1])}</span>${ic('expand_more', 'chev')}</button>`;
    }

    function seg(group, items, active, cls = '') {
        return `<div class="seg ${cls}" data-seg="${group}"><span class="seg-thumb"></span>${items.map(([key, label, icon]) =>
            `<button type="button" data-tab="${key}" class="${key === active ? 'active' : ''}">${icon ? ic(icon) : ''}${label}</button>`).join('')}</div>`;
    }
    const panel = (group, key, active, html) => `<div class="seg-panel ${key === active ? 'active' : ''}" data-seg-of="${group}" data-tab="${key}">${html}</div>`;

    const field = (label, control, hint = '') => `<div class="field"><span class="lbl">${label}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const input = (value = '', attrs = '') => `<input class="input" value="${esc(value)}" ${attrs}>`;
    const searchInput = (ph, attrs = '') => `<div class="input-wrap grow">${ic('search')}<input class="input search" placeholder="${esc(ph)}" ${attrs}></div>`;
    const textarea = (value = '', attrs = '') => `<textarea class="textarea" ${attrs}>${esc(value)}</textarea>`;
    const setRow = (title, desc, control) => `<div class="set-row"><div class="titles"><div class="t">${title}</div>${desc ? `<div class="d">${desc}</div>` : ''}</div>${control}</div>`;

    function card({ icon, tone = '', title, sub = '', actions = '', body = '', foot = '', cls = '', bodyCls = '' }) {
        return `<section class="card ${cls}">
            ${title ? `<div class="card-head">${icon ? `<span class="emblem sm ${tone}">${ic(icon)}</span>` : ''}
                <div class="titles"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${actions}</div>` : ''}
            ${body ? `<div class="card-body ${bodyCls}">${body}</div>` : ''}
            ${foot ? `<div class="card-foot">${foot}</div>` : ''}
        </section>`;
    }

    function pageHead({ crumb, title, sub, actions = '' }) {
        return `<div class="page-head"><div class="titles">
            ${crumb ? `<div class="crumb">${crumb}</div>` : ''}
            <h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
            <div class="page-actions">${actions}${title ? `<button class="icon-btn" data-act="help" data-help="${esc(title)}" title="Справка по «${esc(title)}»">${ic('help')}</button>` : ''}</div></div>`;
    }

    const vars = (list) => `<div class="row" style="gap:6px">${list.map(([v, l]) => `<button type="button" class="var-chip" data-var="${v}" title="${esc(v)}">${l}</button>`).join('')}</div>`;

    const kpi = (label, val, delta = '', icon = '') => `<div class="kpi" data-act="drill" data-kpi="${esc(label)}">
        <div class="k-label">${icon ? ic(icon, '') : ''}${label}</div><div class="k-val">${val}</div>${delta ? `<div class="k-delta ${delta.startsWith('−') ? 'down' : 'up'}">${delta}</div>` : ''}</div>`;

    Object.assign(FD, { esc, ic, money, sw, cb, sel, seg, panel, field, input, searchInput, textarea, setRow, card, pageHead, vars, kpi });

    /* ---------- Навигация ---------- */
    FD.NAV = [
        { id: 'home', icon: 'space_dashboard', label: 'Главная' },
        { id: 'chats', icon: 'forum', label: 'Чаты', badge: 3 },
        { group: 'sales', icon: 'sell', label: 'Лоты и продажи', items: [
            { id: 'lots', icon: 'storefront', label: 'Мои лоты' },
            { id: 'orders', icon: 'receipt_long', label: 'Заказы и выдачи', badge: 2 },
            { id: 'delivery', icon: 'bolt', label: 'Автовыдача' },
            { id: 'bump', icon: 'rocket_launch', label: 'Автоподнятие' },
            { id: 'schedules', icon: 'event_repeat', label: 'Расписания' },
            { id: 'lot-io', icon: 'swap_vert', label: 'Импорт и массовая правка' },
            { id: 'market', icon: 'query_stats', label: 'Рынок и категории' }
        ] },
        { group: 'buyers', icon: 'groups', label: 'Покупатели', items: [
            { id: 'autoreply', icon: 'quickreply', label: 'Автоответчик' },
            { id: 'reviews', icon: 'reviews', label: 'Отзывы и бонусы' },
            { id: 'quick', icon: 'chat_bubble', label: 'Быстрые ответы' },
            { id: 'blacklist', icon: 'block', label: 'Чёрный список' }
        ] },
        { group: 'finance', icon: 'payments', label: 'Финансы', items: [
            { id: 'finance', icon: 'insights', label: 'Обзор и аналитика' },
            { id: 'export', icon: 'ios_share', label: 'Студия экспорта' }
        ] },
        { group: 'plugins', icon: 'extension', label: 'Плагины', items: [
            { id: 'plugins', icon: 'widgets', label: 'Установленные', badge: 5 },
            { id: 'catalog', icon: 'apps', label: 'Каталог' },
            { id: 'plugin-log', icon: 'receipt', label: 'Журнал событий' }
        ] },
        { group: 'settings', icon: 'settings', label: 'Настройки', items: [
            { id: 'accounts', icon: 'manage_accounts', label: 'Аккаунты' },
            { id: 'notifications', icon: 'notifications', label: 'Уведомления' },
            { id: 'app', icon: 'desktop_windows', label: 'Приложение' },
            { id: 'settings-io', icon: 'sync_alt', label: 'Перенос настроек' },
            { id: 'appearance', icon: 'palette', label: 'Оформление' },
            { id: 'support', icon: 'support_agent', label: 'Поддержка FunPay' }
        ] }
    ];

    const store = {
        get(k, d) { try { const v = localStorage.getItem('fd.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
        set(k, v) { try { localStorage.setItem('fd.' + k, JSON.stringify(v)); } catch { /* приватный режим */ } }
    };
    FD.store = store;

    function groupOf(id) { return FD.NAV.find((n) => n.items?.some((i) => i.id === id)); }
    function itemOf(id) { for (const n of FD.NAV) { if (n.id === id) return n; const f = n.items?.find((i) => i.id === id); if (f) return f; } return null; }

    function renderNav() {
        const open = store.get('navOpen', ['sales', 'plugins']);
        const cur = FD.current;
        const item = (i) => `<button type="button" class="nav-item ${i.id === cur ? 'active' : ''}" data-go="${i.id}" title="${esc(i.label)}">
            ${ic(i.icon)}<span class="label">${i.label}</span>${i.badge ? `<span class="badge">${i.badge}</span>` : ''}</button>`;
        const html = FD.NAV.map((n) => n.items
            ? `<div class="nav-group ${open.includes(n.group) ? 'open' : ''}" data-group="${n.group}">
                <button type="button" class="nav-group-head" data-toggle-group="${n.group}" title="${esc(n.label)}">${ic(n.icon)}<span class="label">${n.label}</span>${ic('expand_more', 'chev')}</button>
                <div class="nav-group-items"><div>${n.items.map(item).join('')}</div></div></div>`
            : item(n)).join('');
        document.getElementById('nav').innerHTML = `<div class="nav-scroll">${html}</div>
            <div class="nav-foot">
                <button type="button" class="nav-item" data-act="changelog" title="Что нового">${ic('auto_awesome')}<span class="label">Что нового</span></button>
                <button type="button" class="nav-item" data-act="collapse-nav" title="Свернуть меню" style="flex:0 0 40px;justify-content:center;padding:0">${ic('left_panel_close')}</button>
            </div>`;
    }

    function renderStatusbar() {
        const s = FD.state;
        const on = (v) => `<span class="dot ${v ? '' : 'off'}"></span>`;
        document.getElementById('statusbar').innerHTML = `
            <button class="sb-item" data-go="autoreply">${on(s.autoreply)}Автоответы</button>
            <button class="sb-item" data-go="delivery">${on(s.delivery)}Автовыдача</button>
            <button class="sb-item" data-go="bump">${on(s.bump)}Автоподнятие · через 3 ч 12 мин</button>
            <button class="sb-item" data-go="plugins">${ic('extension')}Плагины 4/5 · <span style="color:var(--danger)">1 ошибка</span></button>
            <span class="sb-spacer"></span>
            <button class="sb-item" data-go="orders">${ic('hourglass_top')}+3 160 ₽ ожид.</button>
            <span class="sb-item">${ic('sync')}Опрос FunPay 14:32:09 · очередь 0</span>`;
    }
    FD.state = { autoreply: true, delivery: true, bump: true };
    FD.renderStatusbar = renderStatusbar;

    /* ---------- Роутер ---------- */
    FD.route = (id, def) => { FD.routes[id] = def; };
    FD.go = (id) => { if (location.hash !== '#/' + id) location.hash = '#/' + id; else render(); };

    function render() {
        const id = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
        const r = FD.routes[id] ? id : 'home';
        FD.current = r;
        const g = groupOf(r);
        if (g) { const open = store.get('navOpen', ['sales', 'plugins']); if (!open.includes(g.group)) store.set('navOpen', [...open, g.group]); }
        renderNav();
        closeOverlays();
        const page = document.getElementById('page');
        const def = FD.routes[r];
        page.className = 'page' + (def.full ? ' full' : '');
        page.innerHTML = def.render();
        document.getElementById('mainScroll').scrollTop = 0;
        document.getElementById('mainScroll').style.overflow = def.full ? 'hidden' : '';
        def.mount && def.mount(page);
        layoutSegs(page);
        const it = itemOf(r);
        document.title = `${it ? it.label : 'Funcy'} — Funcy Desktop`;
    }
    FD.rerender = render;

    /* ---------- Сегменты ---------- */
    function layoutSegs(root) {
        root.querySelectorAll('.seg').forEach((s) => {
            const a = s.querySelector('button.active') || s.querySelector('button');
            const t = s.querySelector('.seg-thumb');
            if (!a || !t) return;
            t.style.width = a.offsetWidth + 'px';
            t.style.transform = `translateX(${a.offsetLeft}px)`;
        });
    }
    FD.layoutSegs = layoutSegs;

    /* ---------- Оверлеи ---------- */
    const overlay = () => document.getElementById('overlay');
    function closeOverlays() { overlay().innerHTML = ''; closeMenus(); }
    function closeTop() {
        const o = overlay();
        if (o.lastElementChild) { o.lastElementChild.remove(); if (o.lastElementChild?.classList.contains('drawer-scrim')) { /* drawer остаётся */ } return true; }
        return false;
    }
    FD.closeOverlays = closeOverlays;

    function mountOverlay(html) {
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const nodes = [...wrap.children];
        nodes.forEach((n) => overlay().appendChild(n));
        nodes.forEach((n) => layoutSegs(n));
        return nodes[nodes.length - 1];
    }

    FD.modal = ({ title, icon, body, foot, size = '', onMount }) => {
        const el = mountOverlay(`<div class="scrim" data-scrim><div class="dialog ${size}" role="dialog" aria-label="${esc(title)}">
            <div class="dialog-head">${icon ? `<span class="emblem sm">${ic(icon)}</span>` : ''}<h2>${title}</h2><button class="icon-btn" data-close title="Закрыть">${ic('close')}</button></div>
            <div class="dialog-body">${body}</div>${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</div></div>`);
        requestAnimationFrame(() => layoutSegs(el));
        onMount && onMount(el);
        return el;
    };

    FD.drawer = ({ title, sub = '', icon, body, foot, wide, onMount }) => {
        const host = document.createElement('div');
        host.className = 'drawer-host';
        host.innerHTML = `<div class="drawer-scrim" data-close></div><aside class="drawer ${wide ? 'wide' : ''}">
            <div class="dialog-head">${icon ? `<span class="emblem sm">${ic(icon)}</span>` : ''}<div class="grow"><h2 style="font-size:17px;font-weight:650">${title}</h2>${sub ? `<div class="faint" style="font-size:12px">${sub}</div>` : ''}</div><button class="icon-btn" data-close title="Закрыть">${ic('close')}</button></div>
            <div class="dialog-body" style="flex:1">${body}</div>${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</aside>`;
        overlay().appendChild(host);
        requestAnimationFrame(() => layoutSegs(host));
        onMount && onMount(host);
        return host;
    };

    FD.confirm = (title, text, ok = 'Подтвердить', danger = false, onOk) => {
        FD.modal({ title, size: 'sm', body: `<p class="muted">${text}</p>`,
            foot: `<button class="btn" data-close>Отмена</button><button class="btn ${danger ? 'danger outline' : 'primary'}" data-confirm-ok>${ok}</button>`,
            onMount(el) { el.querySelector('[data-confirm-ok]').onclick = () => { el.remove(); onOk && onOk(); }; } });
    };

    FD.toast = (title, desc = '', { tone = 'accent', icon = 'check_circle', app = false, timeout = 3800 } = {}) => {
        const tones = { accent: 'var(--accent)', success: '#30a46c', danger: '#e5484d', warning: '#f5a524' };
        const el = document.createElement('div');
        el.className = 'toast';
        el.style.setProperty('--tone', tones[tone] || tone);
        el.innerHTML = `<span class="ti">${ic(icon)}</span><div class="grow">${app ? `<div class="app"><img src="../icons/icon32.png" alt="">Funcy · уведомление Windows</div>` : ''}<div class="tt">${title}</div>${desc ? `<div class="td">${desc}</div>` : ''}</div><button class="icon-btn sm" title="Скрыть">${ic('close')}</button>`;
        const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
        el.querySelector('button').onclick = kill;
        document.getElementById('toasts').appendChild(el);
        setTimeout(kill, timeout);
    };
    FD.saved = (what = 'Сохранено') => FD.toast(what, 'Изменения применены (макет)', { tone: 'success' });

    /* Всплывающие меню (⋮, аккаунт, колокольчик) */
    function closeMenus() { document.querySelectorAll('.menu-pop, .sel-menu').forEach((m) => m.remove()); document.querySelectorAll('.sel.open').forEach((s) => s.classList.remove('open')); }
    FD.menu = (anchor, items, { align = 'left', width } = {}) => {
        closeMenus();
        const m = document.createElement('div');
        m.className = 'menu-pop';
        if (width) m.style.width = width + 'px';
        m.innerHTML = items.map((it, i) => it === 'sep' ? '<div class="msep"></div>'
            : it.header ? `<div class="mh">${it.header}</div>`
            : it.html ? it.html
            : `<button class="mi ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? ic(it.icon) : ''}<span class="grow">${it.label}</span>${it.hint ? `<span class="faint" style="font-size:12px">${it.hint}</span>` : ''}</button>`).join('');
        document.body.appendChild(m);
        const r = anchor.getBoundingClientRect();
        const w = m.offsetWidth, h = m.offsetHeight;
        let left = align === 'right' ? r.right - w : r.left;
        left = Math.max(8, Math.min(left, innerWidth - w - 8));
        let top = r.bottom + 6;
        if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
        m.style.left = left + 'px'; m.style.top = top + 'px';
        m.addEventListener('click', (e) => {
            const b = e.target.closest('.mi'); if (!b) return;
            const it = items[+b.dataset.i]; closeMenus();
            it.action ? it.action() : FD.toast(it.label, 'Действие выполнено (макет)');
        });
        return m;
    };

    function openSel(btn) {
        if (btn.classList.contains('open')) { closeMenus(); return; }
        closeMenus();
        const list = JSON.parse(btn.dataset.sel);
        const m = document.createElement('div');
        m.className = 'sel-menu';
        m.innerHTML = list.map(([v, l]) => `<button type="button" class="sel-opt ${v === btn.dataset.value ? 'selected' : ''}" data-v="${esc(v)}">${esc(l)}${v === btn.dataset.value ? ic('check') : ''}</button>`).join('');
        document.body.appendChild(m);
        const r = btn.getBoundingClientRect();
        m.style.minWidth = r.width + 'px';
        let top = r.bottom + 6;
        if (top + m.offsetHeight > innerHeight - 8) top = r.top - m.offsetHeight - 6;
        m.style.top = top + 'px';
        m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px';
        btn.classList.add('open');
        m.addEventListener('click', (e) => {
            const o = e.target.closest('.sel-opt'); if (!o) return;
            btn.dataset.value = o.dataset.v;
            btn.querySelector('.val').textContent = o.textContent;
            closeMenus();
            btn.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: o.dataset.v }));
        });
    }

    /* ---------- Командная палитра ---------- */
    FD.FEATURES = [
        ['Поднять все лоты', 'bump', 'rocket_launch'], ['Поднять сейчас', 'bump', 'arrow_upward'],
        ['Редактор цен', 'lots', 'price_change'], ['Включить лоты', 'lots', 'toggle_on'], ['Закреплённые лоты', 'lots', 'push_pin'],
        ['Экспорт лотов в JSON', 'lot-io', 'download'], ['Импорт лотов из файла', 'lot-io', 'upload'], ['Массовое редактирование лотов', 'lot-io', 'edit_note'],
        ['Найти и заменить в лотах', 'lot-io', 'find_replace'], ['Правила расписания', 'schedules', 'event_repeat'],
        ['Аналитика рынка', 'market', 'query_stats'], ['Комиссия раздела', 'market', 'percent'], ['Свежее в категории', 'market', 'new_releases'],
        ['Копировать чужой лот', 'market', 'content_copy'], ['Сортировка по отзывам', 'market', 'sort'],
        ['Текст выдачи и переменные', 'delivery', 'bolt'], ['Менеджер товаров', 'lots', 'inventory'],
        ['Попросить отзыв', 'orders', 'star'], ['Таймер подтверждения', 'orders', 'timer'],
        ['Приветствие новых покупателей', 'autoreply', 'waving_hand'], ['Ответы по ключевым словам', 'autoreply', 'key'],
        ['Ответы на отзывы', 'reviews', 'reviews'], ['Бонус за 5★', 'reviews', 'redeem'], ['Напоминание после продажи', 'reviews', 'notifications_active'],
        ['Шаблоны в чате', 'quick', 'chat_bubble'], ['Слэш-команды', 'quick', 'terminal'],
        ['Метки чатов', 'chats', 'label'], ['Прочитать все', 'chats', 'mark_chat_read'], ['Экспорт чата', 'chats', 'download'], ['Перевод сообщений', 'chats', 'translate'],
        ['История покупок покупателя', 'chats', 'history'], ['Добавить в ЧС', 'blacklist', 'block'],
        ['Себестоимость и маржа', 'finance', 'calculate'], ['Экспорт CSV / XLSX / PDF', 'export', 'ios_share'],
        ['Звук уведомлений', 'notifications', 'volume_up'], ['Своя мелодия', 'notifications', 'music_note'], ['Скрыть баланс', 'app', 'visibility_off'],
        ['Синхронизация настроек между аккаунтами', 'accounts', 'sync'], ['Скачать .fpconfig', 'settings-io', 'download'], ['Сброс данных', 'settings-io', 'restart_alt'],
        ['Подтверждение заказов через поддержку', 'support', 'support_agent'], ['Установить плагин из файла', 'plugins', 'upload_file'],
        ['Генератор изображений лота', 'lots', 'image'], ['Перевод лота на английский', 'lots', 'translate'], ['Клонирование лота', 'lots', 'content_copy']
    ];

    function openPalette() {
        closeOverlays();
        const navItems = FD.NAV.flatMap((n) => n.items ? n.items.map((i) => [i.label, i.id, i.icon, n.label]) : [[n.label, n.id, n.icon, 'Раздел']]);
        const all = [
            ...navItems.map(([l, id, icn, w]) => ({ l, id, icn, w, g: 'Разделы' })),
            ...FD.FEATURES.map(([l, id, icn]) => ({ l, id, icn, w: itemOf(id)?.label || '', g: 'Функции' })),
            ...D.lots.map((x) => ({ l: x.title, id: 'lots', icn: 'sell', w: money(x.price), g: 'Лоты' })),
            ...D.chats.map((c) => ({ l: c.name, id: 'chats', icn: 'chat', w: c.last.slice(0, 32), g: 'Чаты', chat: c.id }))
        ];
        const el = mountOverlay(`<div class="palette" data-scrim><div class="palette-box">
            <div class="palette-input">${ic('search')}<input placeholder="Поиск функций, лотов, чатов…" autofocus><span class="kbd">Esc</span></div>
            <div class="palette-list"></div></div></div>`);
        const inp = el.querySelector('input'), list = el.querySelector('.palette-list');
        let idx = 0, shown = [];
        const draw = () => {
            const q = inp.value.trim().toLowerCase();
            shown = all.filter((x) => !q || x.l.toLowerCase().includes(q) || x.w.toLowerCase().includes(q)).slice(0, 40);
            if (!q) shown = shown.filter((x) => x.g !== 'Лоты' && x.g !== 'Чаты').slice(0, 16);
            idx = Math.min(idx, Math.max(0, shown.length - 1));
            let g = '';
            list.innerHTML = shown.length ? shown.map((x, i) => (x.g !== g ? `<div class="palette-group">${(g = x.g)}</div>` : '') +
                `<button class="palette-item ${i === idx ? 'active' : ''}" data-i="${i}">${ic(x.icn)}<span>${esc(x.l)}</span><span class="where">${esc(x.w)}</span></button>`).join('')
                : `<div class="faint" style="padding:18px;text-align:center">Ничего не найдено</div>`;
        };
        const pick = (i) => { const x = shown[i]; if (!x) return; if (x.chat) FD.state.chat = x.chat; closeOverlays(); FD.go(x.id); };
        inp.addEventListener('input', () => { idx = 0; draw(); });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, shown.length - 1); draw(); e.preventDefault(); }
            if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
            if (e.key === 'Enter') pick(idx);
        });
        list.addEventListener('click', (e) => { const b = e.target.closest('.palette-item'); if (b) pick(+b.dataset.i); });
        draw();
        inp.focus();
    }
    FD.openPalette = openPalette;

    /* ---------- Тема ---------- */
    function applyTheme(t) {
        if (t === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', t);
        const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        const b = document.querySelector('#themeBtn .ms'); if (b) b.textContent = dark ? 'light_mode' : 'dark_mode';
        store.set('theme', t);
        FD.theme = t;
    }
    FD.applyTheme = applyTheme;

    /* ---------- Общие действия ---------- */
    FD.acts['collapse-nav'] = () => {
        const w = document.getElementById('window');
        w.classList.toggle('nav-collapsed');
        store.set('navCollapsed', w.classList.contains('nav-collapsed'));
    };
    FD.acts.help = (el) => FD.modal({ title: `Справка: ${el.dataset.help}`, icon: 'help', size: 'sm',
        body: `<p class="muted">Здесь будет короткая справка по разделу «${esc(el.dataset.help)}»: что делает, какие запросы к FunPay отправляет и как это отключить.</p>`,
        foot: '<button class="btn primary" data-close>Понятно</button>' });
    FD.acts.changelog = () => FD.modal({ title: 'Что нового', icon: 'auto_awesome', size: 'sm', body: `
        <div class="faint" style="margin-bottom:10px">Funcy Desktop 1.0 · на основе расширения 0.9.13</div>
        <div class="stack" style="gap:8px">
        ${[['new', 'Новое', 'Отдельное приложение Windows: работает без открытого браузера.'], ['new', 'Новое', 'Плагины: установка из файла и каталог, журнал событий.'], ['new', 'Новое', 'Полноценные чаты внутри приложения.'], ['fix', 'Фикс', 'Копия лота берёт цену продавца, без комиссии покупателя.'], ['opt', 'Чище', 'Кастомизация страниц FunPay не переносится — будет своя.']]
            .map(([c, t, x]) => `<div class="row nowrap" style="align-items:flex-start"><span class="tag ${c}">${t}</span><span>${x}</span></div>`).join('')}</div>`,
        foot: '<button class="btn primary" data-close>Отлично</button>' });
    FD.acts.drill = (el) => FD.modal({ title: el.dataset.kpi, icon: 'insights', body: `
        <div class="row" style="margin-bottom:12px">${searchInput('Поиск по заказам…')}${sel(['Сначала новые', 'Сначала дорогие', 'Сначала дешёвые'], 'Сначала новые')}</div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Заказ</th><th>Покупатель</th><th>Лот</th><th class="r">Сумма</th></tr></thead><tbody>
        ${D.orders.map((o) => `<tr><td class="num">#${o.id}</td><td>${o.buyer}</td><td>${esc(o.lot)}</td><td class="r num">${money(o.amount)}</td></tr>`).join('')}</tbody></table></div>`,
        foot: '<button class="btn" data-close>Закрыть</button><button class="btn outline">' + ic('download') + 'Экспорт</button>' });

    function insertVar(btn) {
        const scope = btn.closest('.field, .card-body, .dialog-body, .composer') || document;
        const ta = scope.querySelector('textarea, input.input');
        if (!ta) return;
        const s = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, s) + btn.dataset.var + ta.value.slice(ta.selectionEnd ?? s);
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ---------- Делегирование ---------- */
    function onClick(e) {
        const t = e.target;
        const go = t.closest('[data-go]');
        if (go) { e.preventDefault(); FD.go(go.dataset.go); return; }
        const grp = t.closest('[data-toggle-group]');
        if (grp) {
            const w = document.getElementById('window');
            if (w.classList.contains('nav-collapsed') || innerWidth <= 1000) { const g = FD.NAV.find((n) => n.group === grp.dataset.toggleGroup); FD.menu(grp, g.items.map((i) => ({ icon: i.icon, label: i.label, action: () => FD.go(i.id) })), {}); return; }
            const key = grp.dataset.toggleGroup;
            const open = store.get('navOpen', ['sales', 'plugins']);
            const next = open.includes(key) ? open.filter((x) => x !== key) : [...open, key];
            store.set('navOpen', next);
            grp.parentElement.classList.toggle('open');
            return;
        }
        const segBtn = t.closest('.seg button[data-tab]');
        if (segBtn) {
            const s = segBtn.closest('.seg');
            s.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === segBtn));
            layoutSegs(s.parentElement);
            const root = s.closest('.dialog, .drawer, #page') || document;
            root.querySelectorAll(`.seg-panel[data-seg-of="${s.dataset.seg}"]`).forEach((p) => p.classList.toggle('active', p.dataset.tab === segBtn.dataset.tab));
            requestAnimationFrame(() => layoutSegs(root));
            s.dispatchEvent(new CustomEvent('seg', { bubbles: true, detail: segBtn.dataset.tab }));
            return;
        }
        const selBtn = t.closest('.sel');
        if (selBtn) { openSel(selBtn); return; }
        if (!t.closest('.menu-pop, .sel-menu')) closeMenus();
        const v = t.closest('[data-var]');
        if (v) { insertVar(v); return; }
        if (t.closest('[data-close]')) { const host = t.closest('.drawer-host, .scrim, .palette'); host ? host.remove() : closeTop(); return; }
        if (t.matches('[data-scrim]')) { t.remove(); return; }
        const act = t.closest('[data-act]');
        if (act && FD.acts[act.dataset.act]) { e.preventDefault(); FD.acts[act.dataset.act](act, e); return; }
        const tst = t.closest('[data-toast]');
        if (tst) { FD.toast(tst.dataset.toast, tst.dataset.toastDesc || '', { tone: tst.dataset.tone || 'success', icon: tst.dataset.icon || 'check_circle' }); }
    }

    function onKey(e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'л')) { e.preventDefault(); openPalette(); return; }
        if (e.key === 'Escape') {
            if (document.querySelector('.menu-pop, .sel-menu')) { closeMenus(); return; }
            const o = overlay(); if (o.lastElementChild) o.lastElementChild.remove();
        }
    }

    /* ---------- Главная ---------- */
    FD.route('home', {
        render() {
            const acc = D.accounts[0];
            const decide = D.orders.filter((o) => o.state === 'decide');
            const unread = D.chats.filter((c) => c.unread);
            const auto = [
                ['autoreply', 'quickreply', 'Автоответчик', 'Приветствие, заказ, подтверждение, 3 ключевых слова', FD.state.autoreply],
                ['delivery', 'bolt', 'Автовыдача', '6 лотов · 1 пустой склад', FD.state.delivery],
                ['bump', 'rocket_launch', 'Автоподнятие', 'Следующее через 3 ч 12 мин', FD.state.bump],
                ['reviews', 'reviews', 'Ответы на отзывы и бонус', 'Отвечено на 12 отзывов за неделю', true]
            ];
            return `${pageHead({ crumb: 'Сегодня, 3 ноября', title: 'Добрый день, nakazan', sub: 'Всё, что требует внимания, — сверху. Приложение работает в фоне, даже когда окно свернуто в трей.',
                actions: `<button class="btn outline" data-go="lots">${ic('add')}Новый лот</button><button class="btn primary" data-act="bump-now">${ic('rocket_launch')}Поднять все лоты</button>` })}
            <div class="hero">
                <div class="bal-card">
                    <div class="k-label">Баланс аккаунта</div>
                    <div class="big" data-balance>${money(acc.balance)}</div>
                    <div class="sub-row"><div><span>Доступно</span><b>${money(acc.available)}</b></div><div><span>В ожидании · ${acc.pendingOrders} заказа</span><b>${money(acc.pending)}</b></div><div><span>За сегодня</span><b>+4 880 ₽</b></div></div>
                    <div class="row mt16"><button class="btn sm" data-go="finance">${ic('insights')}Аналитика</button><button class="btn sm" data-go="export">${ic('ios_share')}Выгрузить</button></div>
                </div>
                <div class="grid g2">
                    ${kpi('Продаж сегодня', '7', '+3 к вчера', 'shopping_bag')}
                    ${kpi('Чистая прибыль', '1 640 ₽', '+12%', 'savings')}
                    ${kpi('Активные лоты', '10 / 12', '', 'storefront')}
                    ${kpi('Рейтинг', '4,98 ★', '3 120 отзывов', 'star')}
                </div>
            </div>
            <div class="grid g-side mt16">
                <div class="stack">
                    ${card({ icon: 'priority_high', tone: 'warning', title: 'Требуют решения', sub: 'Заказы, которые автоматика не довела до конца',
                        actions: `<button class="btn sm" data-go="orders">Все заказы ${ic('chevron_right')}</button>`,
                        body: decide.map((o) => `<div class="list-row"><span class="emblem sm warning">${ic('receipt_long')}</span><div class="titles"><div class="t">#${o.id} · ${esc(o.lot)}</div><div class="d">${o.buyer} · ${money(o.amount)} · ${o.reason}</div></div><span class="pill warning num">${ic('timer')}${o.timer}</span><button class="btn sm outline" data-act="open-order" data-id="${o.id}">Открыть</button></div>`).join('') })}
                    ${card({ icon: 'forum', title: 'Непрочитанные чаты', sub: `${unread.length} диалога ждут ответа`, actions: `<button class="btn sm" data-go="chats">Открыть чаты ${ic('chevron_right')}</button>`,
                        body: unread.map((c) => `<div class="list-row" style="cursor:pointer" data-act="open-chat" data-id="${c.id}"><span class="avatar md">${c.initials}</span><div class="titles"><div class="t">${c.name}</div><div class="d">${esc(c.last)}</div></div><span class="faint">${c.time}</span><span class="badge">${c.unread}</span></div>`).join('') })}
                    ${card({ icon: 'bar_chart', title: 'Продажи за 14 дней', actions: seg('home-chart', [['rev', 'Выручка'], ['cnt', 'Заказы']], 'rev', 'sm'), body: FD.chart ? FD.chart.line(14) : '' })}
                </div>
                <div class="stack">
                    ${card({ icon: 'smart_toy', title: 'Автоматизация', body: `<div class="stack" style="gap:8px">${auto.map(([r, i, t, d, on]) => `<div class="auto-tile"><span class="emblem sm ${on ? '' : 'neutral'}">${ic(i)}</span><div class="titles" style="cursor:pointer" data-go="${r}"><div class="t">${t}</div><div class="d">${d}</div></div>${sw(on, `data-auto="${r}"`)}</div>`).join('')}</div>` })}
                    ${card({ icon: 'extension', title: 'Плагины', sub: '4 активны · 1 с ошибкой', actions: `<button class="btn sm" data-go="plugins">Управлять</button>`,
                        body: D.plugins.map((p) => `<div class="row nowrap" style="padding:5px 0"><span class="plugin-icon" style="width:28px;height:28px;border-radius:9px;background:${p.color}">${ic(p.icon)}</span><span class="grow" style="font-weight:600">${p.name}</span>${p.error ? '<span class="pill danger">Ошибка</span>' : p.enabled ? '<span class="pill success dotted">Вкл</span>' : '<span class="pill neutral">Выкл</span>'}</div>`).join('') })}
                    ${card({ icon: 'history', title: 'Лента событий', body: D.feed.map((f) => `<div class="feed-item"><span class="emblem sm ${f.tone === 'accent' ? '' : f.tone}">${ic(f.icon)}</span><div class="titles"><div class="t">${f.t}</div><div class="d">${f.d}</div></div><span class="time">${f.time}</span></div>`).join('') })}
                </div>
            </div>`;
        },
        mount(page) {
            page.addEventListener('change', (e) => {
                const a = e.target.dataset.auto;
                if (!a) return;
                if (a in FD.state) { FD.state[a] = e.target.checked; renderStatusbar(); }
                FD.toast(e.target.checked ? 'Включено' : 'Выключено', itemOf(a)?.label || '', { tone: e.target.checked ? 'success' : 'warning', icon: e.target.checked ? 'toggle_on' : 'toggle_off' });
            });
        }
    });

    FD.acts['bump-now'] = () => {
        FD.toast('Поднимаю лоты…', '5 категорий в очереди', { icon: 'rocket_launch' });
        setTimeout(() => FD.toast('Лоты подняты', '4 категории подняты, Brawl Stars — подождите 1 ч 40 мин', { tone: 'success', icon: 'rocket_launch' }), 1400);
    };
    FD.acts['open-chat'] = (el) => { FD.state.chat = el.dataset.id; FD.go('chats'); };

    /* ---------- Простые графики (SVG) ---------- */
    FD.chart = {
        line(n = 14, { h = 220, series = 2 } = {}) {
            const W = 640, H = h, P = 28;
            const a = Array.from({ length: n }, (_, i) => 2200 + Math.round(Math.sin(i / 2) * 900 + i * 160 + ((i * 37) % 11) * 70));
            const b = a.map((v, i) => Math.round(v * (0.22 + ((i * 13) % 7) / 60)));
            const max = Math.max(...a) * 1.1;
            const x = (i) => P + (i * (W - P * 2)) / (n - 1), y = (v) => H - P - (v / max) * (H - P * 2);
            const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
            const area = (arr) => `${path(arr)} L${x(n - 1)},${H - P} L${x(0)},${H - P} Z`;
            const grid = [0, .25, .5, .75, 1].map((k) => `<line class="gridline" x1="${P}" x2="${W - P}" y1="${y(max * k)}" y2="${y(max * k)}"/><text class="axis" x="0" y="${y(max * k) + 3}">${Math.round(max * k / 1000)}k</text>`).join('');
            const labels = a.map((_, i) => i % 2 ? '' : `<text class="axis" x="${x(i) - 8}" y="${H - 8}">${21 + i > 31 ? i - 10 : 21 + i}.${21 + i > 31 ? '11' : '10'}</text>`).join('');
            return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
                <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--c1)" stop-opacity=".25"/><stop offset="1" stop-color="var(--c1)" stop-opacity="0"/></linearGradient></defs>
                ${grid}${labels}<path d="${area(a)}" fill="url(#ga)"/><path d="${path(a)}" fill="none" stroke="var(--c1)" stroke-width="2.4" stroke-linejoin="round"/>
                ${series > 1 ? `<path d="${path(b)}" fill="none" stroke="var(--c3)" stroke-width="2" stroke-dasharray="0" stroke-linejoin="round"/>` : ''}
                ${a.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--bg)" stroke="var(--c1)" stroke-width="2"><title>${money(v)}</title></circle>`).join('')}
            </svg><div class="legend mt8"><span><i style="background:var(--c1)"></i>Выручка</span>${series > 1 ? '<span><i style="background:var(--c3)"></i>Прибыль</span>' : ''}</div>`;
        },
        bars(items) {
            const max = Math.max(...items.map((i) => i[1]));
            return `<div class="bar-list">${items.map(([l, v, c], k) => `<div class="bl-row"><span>${l}</span><b class="num">${money(v)}</b><div class="progress"><i style="width:${(v / max) * 100}%;background:var(--c${(k % 6) + 1})"></i></div></div>`).join('')}</div>`;
        },
        donut(items) {
            const total = items.reduce((s, i) => s + i[1], 0);
            let acc = 0;
            const R = 54, C = 2 * Math.PI * R;
            const arcs = items.map(([, v], k) => { const len = (v / total) * C; const a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--c${(k % 6) + 1})" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`; acc += len; return a; }).join('');
            return `<div class="row nowrap" style="gap:18px"><svg width="140" height="140" viewBox="0 0 140 140">${arcs}<text x="70" y="66" text-anchor="middle" style="font-size:11px;fill:var(--faint)">Всего</text><text x="70" y="84" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--text)">${Math.round(total / 1000)}k ₽</text></svg>
                <div class="stack" style="gap:6px">${items.map(([l, v], k) => `<div class="legend"><span><i style="background:var(--c${(k % 6) + 1})"></i>${l} · <b>${Math.round((v / total) * 100)}%</b></span></div>`).join('')}</div></div>`;
        }
    };

    /* ---------- Старт ---------- */
    FD.start = () => {
        applyTheme(store.get('theme', 'system'));
        if (store.get('navCollapsed', false)) document.getElementById('window').classList.add('nav-collapsed');
        renderStatusbar();
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
        window.addEventListener('hashchange', render);
        window.addEventListener('resize', () => { closeMenus(); layoutSegs(document); });
        document.getElementById('searchBtn').onclick = openPalette;
        document.getElementById('themeBtn').onclick = (e) => {
            const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (FD.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
            applyTheme(dark ? 'light' : 'dark');
            e.stopPropagation();
        };
        document.getElementById('accountBtn').onclick = (e) => {
            e.stopPropagation();
            FD.menu(e.currentTarget, [{ header: 'Аккаунты FunPay' },
                ...D.accounts.map((a) => ({ html: `<button class="mi" data-go="accounts"><span class="avatar">${a.initials}</span><span class="grow"><b>${a.name}</b><br><span class="faint" style="font-size:12px">${a.expired ? 'Сессия истекла' : money(a.balance)}</span></span>${a.current ? ic('check') : ''}</button>` })),
                'sep', { icon: 'person_add', label: 'Добавить аккаунт', action: () => FD.acts['add-account']?.() }, { icon: 'manage_accounts', label: 'Управление аккаунтами', action: () => FD.go('accounts') }], { width: 260 });
        };
        document.getElementById('bellBtn').onclick = (e) => {
            e.stopPropagation();
            FD.menu(e.currentTarget, [{ header: 'Уведомления' }, ...D.feed.slice(0, 5).map((f) => ({ icon: f.icon, label: f.t, hint: f.time, action: () => FD.go(f.icon === 'extension' ? 'plugins' : f.icon === 'star' ? 'reviews' : 'orders') })), 'sep', { icon: 'settings', label: 'Настроить уведомления', action: () => FD.go('notifications') }], { align: 'right', width: 340 });
        };
        document.querySelectorAll('[data-win]').forEach((b) => b.onclick = () => {
            const w = b.dataset.win;
            if (w === 'max') { document.getElementById('window').classList.toggle('maximized'); document.getElementById('desktop').classList.toggle('maximized'); setTimeout(() => layoutSegs(document), 50); }
            else FD.toast('Funcy работает в трее', 'Автоответы, выдача, поднятие и плагины продолжают работать. Двойной клик по значку — открыть окно.', { app: true, icon: 'minimize', timeout: 5200 });
        });
        render();
        setTimeout(() => FD.toast('Новое сообщение · kirill_dev', 'А есть Elden Ring? Хочу взять ещё другу', { app: true, icon: 'chat', timeout: 6000 }), 2500);
    };
})();
