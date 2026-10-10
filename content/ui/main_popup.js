// content/ui/main_popup.js

const FPT_MENU_ASSET_PATHS = Object.freeze({
    'funcy-logo': 'icons/funcy-logo.png',
    cloud: 'icons/cloud.png'
});

const FPT_NAV_ICON_ASSETS = Object.freeze({
    sales: Object.freeze({ collapsed: 'nav-store-collapsed.png', expanded: 'nav-store-expanded.png' }),
    customers: Object.freeze({ collapsed: 'nav-chat-collapsed.png', expanded: 'nav-chat-expanded.png' }),
    finance: Object.freeze({ collapsed: 'nav-analytics-collapsed.png', expanded: 'nav-analytics-expanded.png' }),
    interface: Object.freeze({ collapsed: 'nav-apps-collapsed.png', expanded: 'nav-apps-expanded.png' }),
    settings: Object.freeze({ collapsed: 'nav-settings-collapsed.png', expanded: 'nav-settings-expanded.png' }),
    help: Object.freeze({ collapsed: 'nav-help-collapsed.png', expanded: 'nav-help-expanded.png' })
});

function fptGetMenuAssetUrl(assetPath) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            return chrome.runtime.getURL(assetPath);
        }
    } catch (_) {}
    return assetPath;
}

const FPT_POPUP_CLOSE_DURATION_MS = 250;

function openFptToolsPopup(popup) {
    if (!popup) return;
    if (popup._fptCloseTimer) clearTimeout(popup._fptCloseTimer);
    popup._fptCloseTimer = null;
    popup.classList.remove('is-closing');
    popup.classList.add('active');
}

function closeFptToolsPopup(popup) {
    if (!popup || !popup.classList.contains('active') || popup.classList.contains('is-closing')) return;
    popup.classList.add('is-closing');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    popup._fptCloseTimer = setTimeout(() => {
        popup.classList.remove('active', 'is-closing');
        popup._fptCloseTimer = null;
    }, reducedMotion ? 0 : FPT_POPUP_CLOSE_DURATION_MS);
}

function mountPopupCategoryHeaders(toolsPopup) {
    const ensureHeader = window.FPTPopupUI?.ensureCategoryHeader;
    if (!toolsPopup || typeof ensureHeader !== 'function') return;

    toolsPopup.querySelectorAll('.fp-tools-nav li[data-page]').forEach(navItem => {
        const page = findPopupPage(toolsPopup, navItem.dataset.page);
        const title = navItem.querySelector('a span:last-child')?.textContent?.trim();
        if (page && title) ensureHeader(page, title);
    });
}

function createMainPopup() {
    const toolsPopup = document.createElement('div');
    toolsPopup.className = 'fp-tools-popup fpt-menu-shell';
    toolsPopup.dataset.fptEmptyShell = 'true';
    toolsPopup._fptOpen = () => openFptToolsPopup(toolsPopup);
    toolsPopup._fptClose = () => closeFptToolsPopup(toolsPopup);
    // Consume wheel gestures at the popup boundary, while allowing its own scroll areas.
    toolsPopup.addEventListener('wheel', event => {
        if (event.ctrlKey) return;
        event.stopPropagation();
        const delta = event.deltaY || event.deltaX;
        const horizontal = !event.deltaY;
        for (let area = event.target; area && area !== toolsPopup; area = area.parentElement) {
            const style = getComputedStyle(area);
            const overflow = horizontal ? style.overflowX : style.overflowY;
            const position = horizontal ? area.scrollLeft : area.scrollTop;
            const limit = horizontal ? area.scrollWidth - area.clientWidth : area.scrollHeight - area.clientHeight;
            if (/(auto|scroll)/.test(overflow) && (delta < 0 ? position > 0 : position < limit - 1)) return;
        }
        event.preventDefault();
    }, { passive: false });
    toolsPopup.innerHTML = `
        <div class="fp-tools-body">
            <nav class="fp-tools-nav">
                <div class="fpt-nav-brand">
                    <img class="fp-tools-brand-logo" data-icon="funcy-logo" width="44" height="44" alt="" draggable="false">
                    <span class="fpt-nav-brand-title">FunPay Funcy</span>
                    <button type="button" id="fptNavCollapse" class="fpt-nav-collapse" aria-label="Свернуть меню" title="Свернуть меню" aria-expanded="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m14.5 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
                <div class="fpt-nav-search">
                    <button type="button" id="fptNavSearchToggle" class="fpt-nav-search-ico" aria-label="Поиск функций" title="Поиск функций"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.7" stroke="currentColor" stroke-width="1.8"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
                    <input type="text" id="fptNavSearch" class="fpt-nav-search-input" placeholder="Поиск функций…" autocomplete="off" spellcheck="false">
                    <button type="button" id="fptNavSearchClear" class="fpt-nav-search-clear" aria-label="Очистить" title="Очистить">✕</button>
                    <div id="fptNavSearchResults" class="fpt-nav-search-results"></div>
                </div>
                <ul>
                    <li class="fp-nav-divider">Основное</li>
                    <li data-page="accounts"><a><span class="nav-icon material-symbols-rounded">group</span><span>Аккаунты</span></a></li>
                    <li data-page="needs"><a><span class="nav-icon material-symbols-rounded">tune</span><span>Элементы интерфейса</span></a></li>
                    <li class="fp-nav-divider">Интерфейс</li>
                    <li data-page="theme"><a><span class="nav-icon material-symbols-rounded">palette</span><span>Темы</span></a></li>
                    <li data-page="effects"><a><span class="nav-icon material-symbols-rounded">auto_awesome</span><span>Эффекты</span></a></li>
                    <li class="fp-nav-divider">Чат и продажи</li>
                    <li data-page="templates"><a><span class="nav-icon material-symbols-rounded">description</span><span>Быстрые ответы</span></a></li>
                    <li data-page="auto_reply"><a><span class="nav-icon material-symbols-rounded">mark_chat_unread</span><span>Автоответчик</span></a></li>
                    <li data-page="auto_review"><a><span class="nav-icon material-symbols-rounded">reviews</span><span>Отзывы и бонусы</span></a></li>
                    <li data-page="auto_delivery"><a><span class="nav-icon material-symbols-rounded">bolt</span><span>Автовыдача</span></a></li>
                    <li data-page="auto_orders"><a><span class="nav-icon material-symbols-rounded">local_shipping</span><span>Заказы и выдачи</span></a></li>
                    <li data-page="sounds"><a><span class="nav-icon material-symbols-rounded">notifications_active</span><span>Звук уведомлений</span></a></li>
                    <li class="fp-nav-divider">Торговля</li>
                    <li data-page="lot_io" class="active"><a><span class="nav-icon material-symbols-rounded">inventory_2</span><span>Управление лотами</span></a></li>
                    <li data-page="autobump"><a><span class="nav-icon material-symbols-rounded">rocket_launch</span><span>Автоподнятие</span></a></li>
                    <li data-page="blacklist"><a><span class="nav-icon material-symbols-rounded">block</span><span>Чёрный список</span></a></li>
                    <li class="fp-nav-divider">Финансы</li>
                    <li data-page="finance_hub"><a><span class="nav-icon material-symbols-rounded">payments</span><span>Обзор и аналитика</span></a></li>
                    <li class="fp-nav-divider">Прочее</li>

                    <li data-page="settings_io"><a><span class="nav-icon material-symbols-rounded">database</span><span>Перенос настроек</span></a></li>
                    <li data-page="tickets"><a><span class="nav-icon material-symbols-rounded">confirmation_number</span><span>Поддержка FunPay</span></a></li>
                </ul>
                <div class="fp-tools-nav-cloud"><img class="fp-tools-nav-cloud-img" data-icon="cloud" alt=""></div>
            </nav>
            <main class="fp-tools-content">
                <div class="fp-tools-page-content" data-page="accounts"></div>
                <div class="fp-tools-page-content" data-page="needs"></div>
                <div class="fp-tools-page-content" data-page="templates"></div>
                <div class="fp-tools-page-content" data-page="auto_review"></div>
                <div class="fp-tools-page-content" data-page="auto_reply"></div>
                <div class="fp-tools-page-content active" data-page="lot_io"></div>
                <div class="fp-tools-page-content" data-page="finance_hub"></div>
                <div class="fp-tools-page-content" data-page="theme"></div>
                <div class="fp-tools-page-content" data-page="autobump"></div>
                <div class="fp-tools-page-content" data-page="effects"></div>
                <div class="fp-tools-page-content" data-page="settings_io"></div>
                <div class="fp-tools-page-content" data-page="blacklist"></div>
                <div class="fp-tools-page-content" data-page="auto_delivery"></div>
                <div class="fp-tools-page-content" data-page="auto_orders"></div>
                <div class="fp-tools-page-content" data-page="tickets"></div>
                <div class="fp-tools-page-content" data-page="sounds"></div>
            </main>
        </div>
    `;

    mountPopupCategoryHeaders(toolsPopup);

    // Картинки внутри панели — элементы интерфейса, а не переносимые файлы.
    toolsPopup.querySelectorAll('img').forEach(img => { img.draggable = false; });
    toolsPopup.addEventListener('dragstart', (event) => {
        const target = event.target;
        if (target && typeof target.closest === 'function' && target.closest('img')) {
            event.preventDefault();
        }
    }, true);

    // Подставляем локальные иконки бренда из папки icons.
    try {
        toolsPopup.querySelectorAll('img[data-icon]').forEach(img => {
            const key = img.getAttribute('data-icon');
            const assetPath = FPT_MENU_ASSET_PATHS[key] || `icons/${key}.png`;
            if (key) img.src = fptGetMenuAssetUrl(assetPath);
        });
    } catch (_) {}

    // Тема меню «под сайт» — как в окнах импорта/копирования лотов.
    fptInjectMenuThemeCSS();
    fptApplyMenuTheme(toolsPopup);
    // Перекрашиваем при смене темы FunPay/кастомной темы, пока меню на странице.
    if (!window.__fptMenuThemeObserver) {
        try {
            const mo = new MutationObserver(() => {
                clearTimeout(window.__fptMenuThemeT);
                window.__fptMenuThemeT = setTimeout(() => {
                    const p = document.querySelector('.fp-tools-popup');
                    if (p) fptApplyMenuTheme(p);
                }, 90);
            });
            mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-fpt-theme-bg'] });
            if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
            window.__fptMenuThemeObserver = mo;
        } catch (_) {}
    }

    return toolsPopup;
}

// ── Тема меню FunPay Funcy «под сайт» (парсинговые цвета) ─────────────────────
// Логика та же, что в окнах копирования/импорта лота: читаем живые цвета сайта
// (фон, текст, акцент) и раскрашиваем меню под них. Акцент — фирменный голубой
// FunPay (#1b75bb, тот же, что fallback в cloneSurfaceColors/ui_enhancements),
// а не прежний фиолетовый. Светлая база FunPay → чистое светло-голубое меню
// как на макете; на тёмной теме сайта меню тоже подстраивается и остаётся
// читаемым.
const FPT_MENU_THEME_CSS = `
/* ─── контейнер ─────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed{
    background:var(--fptm-bg) !important;
    border:1px solid var(--fptm-border) !important;
    color:var(--fptm-text) !important;
    border-radius:24px !important;
    box-shadow:0 24px 70px var(--fptm-shadow) !important;
}
.fp-tools-popup .fp-tools-nav.fptm-themed h1,
.fp-tools-popup .fp-tools-nav.fptm-themed h2,
.fp-tools-popup .fp-tools-nav.fptm-themed h3,
.fp-tools-popup .fp-tools-nav.fptm-themed h4,
.fp-tools-popup .fp-tools-nav.fptm-themed h5,
.fp-tools-popup .fp-tools-nav.fptm-themed span,
.fp-tools-popup .fp-tools-nav.fptm-themed div,
.fp-tools-popup .fp-tools-nav.fptm-themed li,
.fp-tools-popup .fp-tools-nav.fptm-themed strong,
.fp-tools-popup .fp-tools-nav.fptm-themed b { color:var(--fptm-text); }
.fp-tools-popup .fp-tools-nav.fptm-themed p,
.fp-tools-popup .fp-tools-nav.fptm-themed label,
.fp-tools-popup .fp-tools-nav.fptm-themed small { color:var(--fptm-muted) !important; }
.fp-tools-popup .fp-tools-nav.fptm-themed code,
.fp-tools-popup .fp-tools-nav.fptm-themed kbd {
    background:var(--fptm-surface-2) !important; color:var(--fptm-text) !important;
    border:1px solid var(--fptm-border) !important; border-radius:5px; padding:1px 5px;
}
.fp-tools-popup .fp-tools-nav.fptm-themed a { color:var(--fptm-accent); }

/* ─── навигация ──────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-nav{
    width:280px; flex:0 0 280px; margin:16px 0 16px 16px; padding:18px 12px;
    background:var(--fptm-nav-surface) !important; border:1px solid var(--fptm-nav-border) !important;
    border-radius:24px; box-shadow:0 14px 34px var(--fptm-nav-row-shadow) !important;
    position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:0;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search{ padding:0; margin:0 0 18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico{
    left:18px; width:22px; height:22px; margin-top:0; font-size:22px; opacity:.72; color:var(--fptm-muted) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico svg{ width:22px; height:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input{
    min-height:56px; padding:12px 42px 12px 52px; border-radius:24px;
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field) !important;
    color:var(--fptm-text) !important; font-size:15px;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input:focus{
    border-color:var(--fptm-accent-border) !important; background:var(--fptm-nav-field-focus) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav ul{ list-style:none; margin:0; padding:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-scroll{ flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; margin:-10px -12px 0; padding:12px 12px 20px; scrollbar-width:none; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-scroll::-webkit-scrollbar{ display:none; width:0; height:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-groups{ display:flex; flex-direction:column; gap:6px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group{ min-width:0; border-radius:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{
    width:100%; min-width:0; height:54px; min-height:54px; display:flex; align-items:center; gap:12px;
    padding:0 12px; border:1px solid var(--fptm-nav-border) !important; border-radius:22px;
    background:var(--fptm-nav-row) !important; color:var(--fptm-text) !important;
    box-shadow:0 8px 20px var(--fptm-nav-row-shadow) !important; font:inherit; font-size:16px; font-weight:500; text-align:left; cursor:pointer;
    transition:background-color .24s cubic-bezier(.22,1,.36,1), color .24s cubic-bezier(.22,1,.36,1), border-color .24s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:hover{
    background:var(--fptm-nav-row-hover, var(--fptm-hover)) !important; color:var(--fptm-text) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{
    background:transparent !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover:not(:active){
    background:#7663f6 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{ width:34px; height:34px; flex:0 0 34px; object-fit:contain; display:block; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; color:inherit !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron svg{ width:20px; height:20px; display:block; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    flex:0 0 auto; margin-left:auto; transition:transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-chevron{ transform:rotate(90deg); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse{
    display:grid; grid-template-rows:0fr; min-height:0; transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-collapse{ grid-template-rows:1fr; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{ min-height:0; overflow:hidden; padding:0; border-radius:16px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{ background:var(--fptm-nav-child-surface); }
.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{ list-style:none; margin:0; padding:8px 6px 10px; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a{
    display:flex; align-items:center; min-height:44px; padding:8px 12px 8px 14px;
    gap:10px; color:var(--fptm-text) !important; background:transparent !important; border-radius:14px !important;
    box-shadow:none !important; border:1px solid transparent !important; font-size:15px; font-weight:500; transition:background .15s ease, color .15s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a:hover{ background:var(--fptm-hover) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a{
    background:var(--fptm-accent-soft) !important; color:var(--fptm-text) !important;
    border:1px solid transparent !important; font-weight:500;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a{
    background:transparent !important; color:var(--fptm-text) !important;
    border-color:transparent !important; font-weight:500 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li[data-page] a > span:last-child{
    min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a .nav-icon{ color:inherit !important; opacity:.92; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a{
    font-weight:500; padding-left:14px !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a .nav-icon{
    display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; flex:0 0 24px;
    font-size:22px; line-height:1; color:var(--fptm-muted) !important; opacity:.92;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav::-webkit-scrollbar-thumb{ background:var(--fptm-border) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav-cloud{ display:none !important; }

/* ─── reference menu and compact rail ────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-nav{
    box-sizing:border-box; width:280px; flex:0 0 280px; margin:16px 0 16px 16px; padding:18px 12px;
    border-radius:24px; background:var(--fptm-nav-surface) !important; border:1px solid var(--fptm-nav-border) !important;
    box-shadow:0 14px 34px var(--fptm-nav-row-shadow) !important; position:relative; display:flex; flex-direction:column;
    overflow:hidden; min-height:0; transition:width .32s cubic-bezier(.34,1.16,.64,1), flex-basis .32s cubic-bezier(.34,1.16,.64,1), padding-left .32s cubic-bezier(.34,1.16,.64,1), padding-right .32s cubic-bezier(.34,1.16,.64,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand{
    position:relative; display:flex; align-items:center; gap:12px; min-width:0; min-height:44px; margin:0 0 22px; transition:gap .38s cubic-bezier(.4,0,.2,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fp-tools-brand-logo{ margin:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand-title{
    min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--fptm-text) !important;
    font-size:18px; line-height:1.2; font-weight:650; letter-spacing:-.02em; max-width:160px; opacity:1;
    transition:max-width .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse{
    width:36px; height:36px; flex:0 0 36px; display:inline-flex; align-items:center; justify-content:center;
    margin-left:auto; padding:0; border:1px solid var(--fptm-nav-border) !important; border-radius:50%;
    background:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important; cursor:pointer;
    transition:width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1), flex-basis .38s cubic-bezier(.4,0,.2,1), background-color .16s ease, color .16s ease, border-color .16s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse svg{ width:18px; height:18px; display:block; transition:transform .38s cubic-bezier(.4,0,.2,1); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse:hover{ background:var(--fptm-nav-field) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse:focus-visible,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico:focus-visible{ outline:2px solid #7663f6; outline-offset:2px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search{
    position:relative; width:100%; height:44px; flex:0 0 auto; margin:0 0 18px; padding:0;
    transition:width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico{
    position:absolute; z-index:1; top:50%; left:2px; width:44px; height:44px; display:inline-flex;
    align-items:center; justify-content:center; margin:0 !important; padding:0 !important; border:1px solid transparent !important; border-radius:50% !important;
    min-width:44px; min-height:44px; overflow:visible !important; pointer-events:auto; appearance:none; -webkit-appearance:none;
    background:transparent !important; color:var(--fptm-muted) !important; box-shadow:none !important;
    font-size:0; line-height:0; letter-spacing:0; text-transform:none; cursor:pointer; transform:translateY(-50%);
    transition:left .38s cubic-bezier(.4,0,.2,1), top .38s cubic-bezier(.4,0,.2,1),
        width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1),
        transform .38s cubic-bezier(.4,0,.2,1), background-color .24s ease, border-color .24s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico svg{ width:22px; height:22px; display:block; transform:translate(-.5px,-.5px); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input{
    box-sizing:border-box; width:100%; height:44px; min-height:44px; margin:0 !important; padding:8px 42px 8px 48px; border-radius:999px !important;
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field) !important;
    color:var(--fptm-text) !important; font-family:inherit; font-size:15px;
    opacity:1; visibility:visible; transition:opacity .16s ease, visibility .16s linear;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input:focus{
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field-focus) !important;
    outline:none !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-groups{ display:flex; flex-direction:column; align-items:stretch; gap:6px; min-width:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group{ width:100%; min-width:0; border-radius:18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{
    box-sizing:border-box; width:100%; min-width:0; height:54px; min-height:54px; display:flex; align-items:center; gap:12px; margin-inline:auto; padding:0 12px;
    border:1px solid transparent !important; border-radius:18px; background:transparent !important;
    color:var(--fptm-text) !important; box-shadow:none !important; font:inherit; font-size:16px; font-weight:500;
    text-align:left; cursor:pointer; transition:padding-left .38s cubic-bezier(.4,0,.2,1), gap .38s cubic-bezier(.4,0,.2,1), transform .38s cubic-bezier(.34,1.16,.64,1), background-color .24s cubic-bezier(.22,1,.36,1), color .24s cubic-bezier(.22,1,.36,1), border-color .24s cubic-bezier(.22,1,.36,1), box-shadow .24s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav:not(.is-nav-collapsed):not(.is-nav-opening) .fpt-nav-group-toggle:hover:not(:active){ transform:translateY(-1px) scale(1.012); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:transparent !important; border-color:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active{ background:var(--fptm-accent-soft, rgba(118,99,246,.12)) !important; border-color:transparent !important; box-shadow:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{ width:34px; height:34px; flex:0 0 34px; object-fit:contain; display:block; filter:brightness(0) invert(0) opacity(.82); transition:filter .24s ease; }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title{
    min-width:0; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:inherit !important; opacity:1;
    transition:max-width .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    flex:0 0 20px; margin-left:auto; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; overflow:hidden; opacity:1;
    transition:width .38s cubic-bezier(.4,0,.2,1), flex-basis .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s, transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse{ display:grid; grid-template-rows:0fr; min-height:0; transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-collapse{ grid-template-rows:1fr; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{ min-height:0; overflow:hidden; padding:0; border-radius:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{ background:transparent; }
.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{ list-style:none; margin:0; padding:6px 0 8px 0; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a{
    display:flex; align-items:center; min-height:44px; padding:8px 10px 8px 0; gap:10px; color:var(--fptm-text) !important;
    background:transparent !important; border-radius:14px !important; box-shadow:none !important; border:1px solid transparent !important;
    font-size:15px; font-weight:500; transition:background .15s ease, color .15s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a:hover{ background:var(--fptm-nav-row-hover, rgba(118,99,246,.08)) !important; color:var(--fptm-text) !important; }
/* The selected page carries the accent; its category stays neutral. */
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a,
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a:hover,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a{
    background:rgba(118,99,246,.86) !important; color:#fff !important; border-color:transparent !important;
    box-shadow:0 6px 12px rgba(118,99,246,.18) !important; font-weight:500 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a .nav-icon{ color:#fff !important; opacity:1; }
.fp-tools-popup.fptm-themed .fp-tools-nav li[data-page] a > span:last-child{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a .nav-icon{ color:inherit !important; opacity:.92; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a .nav-icon{
    display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; flex:0 0 24px;
    font-size:22px; line-height:1; color:var(--fptm-muted) !important; opacity:.92;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child{
    max-height:80px; opacity:0; transform:translateY(4px);
    transition:max-height .18s ease, opacity .32s cubic-bezier(.22,1,.36,1), transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-child:not(.fpt-nav-hidden):not(.fpt-nav-section-hidden){
    opacity:1; transform:translateY(0);
    transition-delay:0s, var(--fpt-nav-child-delay, 0ms), var(--fpt-nav-child-delay, 0ms);
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed{ width:104px; flex:0 0 104px; padding-right:10px; padding-left:10px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-brand{ gap:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-brand-title,
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-title{ max-width:0; overflow:hidden; opacity:0; visibility:hidden; white-space:nowrap; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-chevron{ width:0; flex-basis:0; margin-left:0; opacity:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-collapse{ width:28px; height:28px; flex-basis:28px; border-radius:50%; background:var(--fptm-nav-field) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-collapse svg{ transform:rotate(180deg); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search{ width:44px; height:44px; align-self:center; margin-bottom:18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-ico{
    top:0; left:0; width:44px; height:44px; border-color:var(--fptm-nav-border) !important;
    background:var(--fptm-nav-field) !important; transform:none;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-input{ opacity:0; visibility:hidden; pointer-events:none; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-clear{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-groups{ gap:6px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle{ width:100%; height:54px; min-height:54px; justify-content:flex-start; gap:0; padding:0 0 0 23px; border-radius:18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active,
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active:hover{ background:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(0) opacity(.82); }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-icon{ width:34px; height:34px; flex-basis:34px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-child a{ width:44px; min-height:44px; justify-content:center; gap:0; margin:0 auto; padding:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-child a .nav-icon{ width:22px; flex:0 0 22px; margin:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-child a > span:last-child{ width:0; max-width:0; flex:0 0 0; overflow:hidden; opacity:0; visibility:hidden; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
@media (prefers-reduced-motion: reduce){
    .fp-tools-popup.fptm-themed .fp-tools-nav,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand-title,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse svg{ transition-duration:.01ms !important; }
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child{ transition-delay:0ms !important; }
}

/* Each category gets its own page surface inside the shared content viewport. */
.fp-tools-popup.fptm-themed .fp-tools-content{ background:var(--fptm-bg) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-content .fp-tools-page-content{
    box-sizing:border-box; min-height:calc(100% - 32px); margin:16px;
    border:1px solid var(--fptm-nav-border) !important; border-radius:24px;
    background:var(--fptm-nav-surface) !important;
    box-shadow:0 14px 34px var(--fptm-nav-row-shadow) !important;
}
`;

function fptParseMenuColors() {
    let isLight = true;
    try {
        // Используем тот же детектор, что задаёт общую палитру поверхностей.
        // Локальные карточки вроде .content-account могут быть тёмными и при
        // светлой теме страницы, поэтому не определяем режим по первому блоку.
        if (typeof fptComputePalette === 'function') {
            isLight = !fptComputePalette().dark;
        } else if (typeof fptResolveBg === 'function' && typeof fptLuma === 'function') {
            isLight = fptLuma(fptResolveBg()) >= 0.5;
        } else {
            const bodyColor = getComputedStyle(document.body).backgroundColor;
            const rgb = (bodyColor.match(/\d+/g) || [255, 255, 255]).map(Number);
            isLight = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) >= 127.5;
        }
    } catch (_) {}

    return { isLight };
}

function fptInjectMenuThemeCSS() {
    if (document.getElementById('fpt-menu-theme-css')) return;
    const s = document.createElement('style');
    s.id = 'fpt-menu-theme-css';
    s.textContent = FPT_MENU_THEME_CSS;
    document.head.appendChild(s);
}

// Surface palette of the extension's own windows (light/dark). Shared with page-level windows
// such as the export studio (content/features/export_studio.js) so they look like the menu.
function fptMenuPalette(isLight) {
    if (isLight) {
        return {
            bg:'#ffffff', head:'#f7f8fb', nav:'#fbfcfe', text:'#16181d',
            muted:'rgba(22,24,29,0.74)', faint:'rgba(22,24,29,0.56)', border:'rgba(22,24,29,0.10)',
            surface:'#f5f7fa', surface2:'#eef1f6', hover:'rgba(22,24,29,0.05)', field:'#ffffff',
            shadow:'rgba(22,24,29,0.16)', navFade:'rgba(22,24,29,0.12)',
            navSurface:'#fbfaff', navRow:'transparent', navExpanded:'transparent', navChildSurface:'transparent',
            navField:'#f4f3ff', navFieldFocus:'#ffffff', navBorder:'rgba(119,99,246,0.16)',
            navRowShadow:'rgba(94,84,170,0.10)', navDot:'#b4c8e8'
        };
    } else {
        return {
            bg:'#1e1f24', head:'#191a1e', nav:'#1b1c21', text:'#e7e8ec',
            muted:'rgba(231,232,236,0.76)', faint:'rgba(231,232,236,0.56)', border:'rgba(255,255,255,0.10)',
            surface:'#26272d', surface2:'#2c2e35', hover:'rgba(255,255,255,0.07)', field:'#26272d',
            shadow:'rgba(0,0,0,0.55)', navFade:'rgba(0,0,0,0.30)',
            navSurface:'#24262d', navRow:'#2b2e36', navExpanded:'rgba(118,99,246,0.22)', navChildSurface:'rgba(19,22,28,0.72)',
            navField:'#2a2e37', navFieldFocus:'#313640', navBorder:'rgba(255,255,255,0.10)',
            navRowShadow:'rgba(0,0,0,0.20)', navDot:'rgba(231,232,236,0.40)'
        };
    }
}

function fptApplyMenuTheme(root) {
    if (!root) return;
    try {
        const parsed = fptParseMenuColors();
        const isLight = parsed.isLight;
        const accent = '#7663f6';
        const vars = fptMenuPalette(isLight);
        let rgb;
        const hx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);
        if (hx) {
            rgb = [parseInt(hx[1], 16), parseInt(hx[2], 16), parseInt(hx[3], 16)];
        } else {
            rgb = (accent.match(/\d+/g) || [27,117,187]).slice(0,3).map(Number);
        }
        const accentSoft = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${isLight ? 0.12 : 0.22})`;
        const accentBorder = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${isLight ? 0.35 : 0.5})`;

        const onAccent = '#ffffff';

        const st = root.style;
        st.setProperty('--fptm-color-scheme', isLight ? 'light' : 'dark');
        st.setProperty('--fptm-bg', vars.bg);
        st.setProperty('--fptm-head', vars.head);
        st.setProperty('--fptm-nav', vars.nav);
        st.setProperty('--fptm-text', vars.text);
        st.setProperty('--fptm-muted', vars.muted);
        st.setProperty('--fptm-faint', vars.faint);
        st.setProperty('--fptm-border', vars.border);
        st.setProperty('--fptm-surface', vars.surface);
        st.setProperty('--fptm-surface-2', vars.surface2);
        st.setProperty('--fptm-hover', vars.hover);
        st.setProperty('--fptm-field', vars.field);
        st.setProperty('--fptm-accent', accent);
        st.setProperty('--fptm-accent-soft', accentSoft);
        st.setProperty('--fptm-accent-border', accentBorder);
        st.setProperty('--fptm-on-accent', onAccent);
        st.setProperty('--fptm-shadow', vars.shadow);
        st.setProperty('--fptm-nav-fade', vars.navFade);
        st.setProperty('--fptm-nav-surface', vars.navSurface);
        st.setProperty('--fptm-nav-row', vars.navRow);
        st.setProperty('--fptm-nav-expanded', vars.navExpanded);
        st.setProperty('--fptm-nav-child-surface', vars.navChildSurface);
        st.setProperty('--fptm-nav-field', vars.navField);
        st.setProperty('--fptm-nav-field-focus', vars.navFieldFocus);
        st.setProperty('--fptm-nav-border', vars.navBorder);
        st.setProperty('--fptm-nav-row-shadow', vars.navRowShadow);
        st.setProperty('--fptm-nav-dot', vars.navDot);

        // Множество старых правил используют эти переменные; фиксируем единый
        // лавандовый акцент, сохраняя тематические цвета поверхностей и текста.
        st.setProperty('--fpt-accent', accent);
        st.setProperty('--fpt-accent-soft', accentSoft);
        st.setProperty('--fpt-accent-border', accentBorder);
        st.setProperty('--fpt-on-accent', onAccent);
        st.setProperty('--fpt-accent-2', accent);
        st.setProperty('--fpt-text', vars.text);
        st.setProperty('--fpt-text-muted', vars.muted);
        st.setProperty('--fpt-border', vars.border);
        st.setProperty('--fpt-surface', vars.surface);
        st.setProperty('--fpt-surface-2', vars.surface2);
        st.setProperty('--fpt-bg', vars.bg);
        st.setProperty('--fpt-shadow', vars.shadow);

        root.classList.remove('fpt-menu-transparent', 'fpt-menu-blur', 'fpt-menu-on-light', 'fpt-menu-on-dark');
        root.classList.add('fptm-themed');
        root.classList.toggle('fptm-dark', !isLight);
        root.classList.toggle('fptm-light', isLight);
    } catch (_) {}
}

const FP_WALLPAPER_PRESETS = [
    { name: 'Горы и озеро', emoji: '🏔️', url: 'https://isorepublic.com/wp-content/uploads/2023/03/iso-republic-mountain-winter-lake.jpg', palette: { bgColor1: '#1a3050', bgColor2: '#4a7aaa', containerBgColor: '#0d1828', textColor: '#dde8f4', linkColor: '#7aaad8' } },
    { name: 'Туманные горы', emoji: '🌫️', url: 'https://isorepublic.com/wp-content/uploads/2023/02/iso-republic-napa-hill-fog.jpg', palette: { bgColor1: '#1e2830', bgColor2: '#5a7888', containerBgColor: '#101820', textColor: '#d8e4ec', linkColor: '#7aaac0' } },
    { name: 'Каньон', emoji: '🪨', url: 'https://isorepublic.com/wp-content/uploads/2023/03/iso-republic-rough-rocky-landscape.jpg', palette: { bgColor1: '#2a1808', bgColor2: '#a85030', containerBgColor: '#180e04', textColor: '#f0ddd0', linkColor: '#e08060' } },
    { name: 'Горный туман', emoji: '☁️', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-mist-mountains-clouds.jpg', palette: { bgColor1: '#151e2a', bgColor2: '#3a6090', containerBgColor: '#0a1018', textColor: '#dce8f8', linkColor: '#6090c8' } },
    { name: 'Закат', emoji: '🌅', url: 'https://isorepublic.com/wp-content/uploads/2022/11/iso-republic-clouds-sky-trees.jpg', palette: { bgColor1: '#280a18', bgColor2: '#c84810', containerBgColor: '#180508', textColor: '#f8ddd0', linkColor: '#f08060' } },
    { name: 'Пустыня', emoji: '🏜️', url: 'https://isorepublic.com/wp-content/uploads/2023/06/iso-republic-desert-barren-sky.jpg', palette: { bgColor1: '#201808', bgColor2: '#c89840', containerBgColor: '#100c04', textColor: '#f8ead8', linkColor: '#e0b860' } },
    { name: 'Побережье', emoji: '🌊', url: 'https://isorepublic.com/wp-content/uploads/2023/05/iso-republic-scenic-coast-beach-03.jpg', palette: { bgColor1: '#082028', bgColor2: '#2888a0', containerBgColor: '#041018', textColor: '#d8eef8', linkColor: '#50a8c8' } },
    { name: 'Млечный путь', emoji: '🌌', url: 'https://isorepublic.com/wp-content/uploads/2025/02/isorepublic-milky-way.jpg', palette: { bgColor1: '#080618', bgColor2: '#4030a0', containerBgColor: '#04030e', textColor: '#e0d8f8', linkColor: '#8070e0' } },
    { name: 'Звёзды', emoji: '⭐', url: 'https://isorepublic.com/wp-content/uploads/2022/12/iso-republic-mikly-way-trees-sky.jpg', palette: { bgColor1: '#040a18', bgColor2: '#103868', containerBgColor: '#020508', textColor: '#d8e8f8', linkColor: '#4080b8' } },
    { name: 'Синий дуотон', emoji: '🔵', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-abstract-wallpaper-duotone.jpg', palette: { bgColor1: '#080e28', bgColor2: '#1840c0', containerBgColor: '#040818', textColor: '#d8e0f8', linkColor: '#4868e8' } },
    { name: 'Тёмно-синий', emoji: '💙', url: 'https://isorepublic.com/wp-content/uploads/2024/05/iso-republic-abstract-wallpaper-dark-blues.jpg', palette: { bgColor1: '#030610', bgColor2: '#0c2890', containerBgColor: '#020408', textColor: '#d0d8f0', linkColor: '#3060c8' } },
    { name: 'Мягкий боке', emoji: '🎨', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-abstract-wallpaper-soft-blur.jpg', palette: { bgColor1: '#0e0618', bgColor2: '#6030b0', containerBgColor: '#06030c', textColor: '#e8d8f8', linkColor: '#9060e0' } }
];

const FP_WP_CACHE_KEY = 'fpToolsWallpaperCache';
const FP_WP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const _fpWpImgCache = new Map();

// --- Каталог готовых ТЕМ (.fptheme) с GitHub ------------------------------
// Ленивая загрузка: index.json тянется ОДИН раз при первом открытии вкладки,
// превью каждой темы грузится по одному (только текущий слайд карусели),
// сам .fptheme качается только в момент нажатия «Применить». Ничего не
// предзагружается — трафик не жрётся.
const FP_THEME_GH_USER   = 'XaviersDev';
const FP_THEME_GH_REPO   = 'fpt-themes';
const FP_THEME_GH_BRANCH = 'main';
const FP_THEME_RAW_BASE  = `https://raw.githubusercontent.com/${FP_THEME_GH_USER}/${FP_THEME_GH_REPO}/${FP_THEME_GH_BRANCH}/`;
const FP_THEME_INDEX_URL = FP_THEME_RAW_BASE + 'index.json';

let _fpThemeCatalog = null;   // массив тем после загрузки index.json
let _fpThemeCatalogLoaded = false;

const FPT_NAV_SECTIONS = Object.freeze([
    { id: 'sales', label: 'Лоты и продажи', icon: 'storefront', pages: Object.freeze(['lot_io', 'auto_delivery', 'auto_orders', 'autobump']) },
    { id: 'customers', label: 'Покупатели', icon: 'chat', pages: Object.freeze(['auto_reply', 'auto_review', 'templates', 'blacklist', 'sounds']) },
    { id: 'finance', label: 'Финансы', icon: 'analytics', pages: Object.freeze(['finance_hub']) },
    { id: 'interface', label: 'Интерфейс', icon: 'apps', pages: Object.freeze(['theme', 'effects', 'needs']) },
    { id: 'settings', label: 'Настройки', icon: 'settings', pages: Object.freeze(['accounts', 'settings_io']) },
    { id: 'help', label: 'Справка', icon: 'help', pages: Object.freeze(['tickets']) }
]);

const FPT_NAV_LABEL_OVERRIDES = Object.freeze({
    lot_io: 'Управление лотами',
    auto_delivery: 'Автовыдача',
    auto_orders: 'Заказы и выдачи',
    autobump: 'Автоподнятие',
    auto_reply: 'Автоответчик',
    auto_review: 'Отзывы и бонусы',
    templates: 'Быстрые ответы',
    blacklist: 'Чёрный список',
    sounds: 'Звук уведомлений',
    finance_hub: 'Обзор и аналитика',
    theme: 'Темы',
    effects: 'Эффекты',
    needs: 'Элементы интерфейса',
    accounts: 'Аккаунты',
    settings_io: 'Перенос настроек',
    tickets: 'Поддержка FunPay',
});

const FPT_NAV_EXPANDED_STORAGE_KEY = 'fpToolsNavExpandedSectionsV2';
const FPT_NAV_COLLAPSED_STORAGE_KEY = 'fpToolsNavCollapsed';
const FPT_NAV_AUTO_COLLAPSE_MAX_WIDTH = 740;

function setupNavigationSections(toolsPopup) {
    if (!toolsPopup) return null;
    if (toolsPopup._fptNavSections) return toolsPopup._fptNavSections;

    const nav = toolsPopup.querySelector('.fp-tools-nav');
    const legacyList = nav && nav.querySelector('ul');
    if (!nav || !legacyList) return null;
    const collapseButton = nav.querySelector('#fptNavCollapse');

    const sectionById = new Map(FPT_NAV_SECTIONS.map(section => [section.id, section]));
    const pageToSection = new Map();
    FPT_NAV_SECTIONS.forEach(section => {
        section.pages.forEach(pageId => pageToSection.set(pageId, section.id));
    });

    const pageItems = Array.from(legacyList.querySelectorAll('li[data-page]'));
    pageItems.forEach(item => {
        const pageId = item.dataset.page;
        const sectionId = pageToSection.get(pageId);
        if (sectionId) {
            item.dataset.navSection = sectionId;
            item.classList.add('fpt-nav-child');
        } else {
            item.hidden = true;
            item.setAttribute('aria-hidden', 'true');
            return;
        }
        item.classList.remove('fpt-nav-hidden', 'fpt-nav-section-hidden');
        item.setAttribute('aria-hidden', 'false');

        const override = FPT_NAV_LABEL_OVERRIDES[pageId];
        const label = item.querySelector('a > span:last-child');
        if (override && label) label.textContent = override;
        const accessibleLabel = override || label?.textContent?.trim() || pageId;
        const anchor = item.querySelector('a');
        if (anchor) {
            anchor.title = accessibleLabel;
            anchor.setAttribute('aria-label', accessibleLabel);
        }
    });

    const scroll = document.createElement('div');
    scroll.className = 'fpt-nav-scroll';
    scroll.setAttribute('aria-label', 'Разделы FunPay Funcy');
    const groups = document.createElement('div');
    groups.className = 'fpt-nav-groups';
    scroll.appendChild(groups);
    nav.insertBefore(scroll, legacyList);
    legacyList.remove();

    const cloud = nav.querySelector('.fp-tools-nav-cloud');
    if (cloud) {
        cloud.hidden = true;
        cloud.setAttribute('aria-hidden', 'true');
    }

    const groupRefs = new Map();
    FPT_NAV_SECTIONS.forEach(section => {
        const group = document.createElement('section');
        group.className = 'fpt-nav-group';
        group.dataset.section = section.id;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'fpt-nav-group-toggle';
        toggle.dataset.section = section.id;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', section.label);
        toggle.title = section.label;

        const navIcon = document.createElement('img');
        navIcon.className = 'fpt-nav-group-icon';
        navIcon.dataset.icon = section.id;
        navIcon.src = fptGetMenuAssetUrl(`icons/${FPT_NAV_ICON_ASSETS[section.id].expanded}`);
        navIcon.alt = '';
        navIcon.decoding = 'async';
        navIcon.setAttribute('aria-hidden', 'true');
        const title = document.createElement('span');
        title.className = 'fpt-nav-group-title';
        title.textContent = section.label;
        const chevron = document.createElement('span');
        chevron.className = 'fpt-nav-group-chevron';
        chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        chevron.setAttribute('aria-hidden', 'true');
        toggle.append(navIcon, title, chevron);

        const collapse = document.createElement('div');
        collapse.className = 'fpt-nav-group-collapse';
        const itemsViewport = document.createElement('div');
        itemsViewport.className = 'fpt-nav-group-items';
        const items = document.createElement('ul');
        items.className = 'fpt-nav-group-list';
        const collapseId = 'fpt-nav-group-' + section.id + '-items';
        collapse.id = collapseId;
        toggle.setAttribute('aria-controls', collapseId);
        let childIndex = 0;
        section.pages.forEach(pageId => {
            const item = pageItems.find(entry => entry.dataset.page === pageId);
            if (item) {
                item.style.setProperty('--fpt-nav-child-delay', `${Math.min(childIndex++, 9) * 14}ms`);
                items.appendChild(item);
            }
        });
        itemsViewport.appendChild(items);
        collapse.appendChild(itemsViewport);
        group.append(toggle, collapse);
        groups.appendChild(group);
        groupRefs.set(section.id, { group, toggle, collapse, items, icon: navIcon });
    });

    const activePage = pageItems.find(item => item.classList.contains('active'));
    let activeSection = activePage?.dataset.navSection || pageToSection.get('lot_io') || FPT_NAV_SECTIONS[0].id;
    let focusedSection = null;
    let expandedSections = new Set([activeSection]);
    let navCollapsed = false;
    let preferredNavCollapsed = typeof window.__fptPopupSettings?.[FPT_NAV_COLLAPSED_STORAGE_KEY] === 'boolean'
        ? window.__fptPopupSettings[FPT_NAV_COLLAPSED_STORAGE_KEY]
        : false;
    let collapsedUserChanged = false;
    let autoCollapsedForViewport = false;
    let expandedSectionsUserChanged = false;
    let pendingCompactSection = null;
    let pendingCompactTimer = null;
    let navRevealTimer = null;

    function normalizeSectionIds(value) {
        const ids = Array.isArray(value) || value instanceof Set ? Array.from(value) : [];
        return ids.filter(id => sectionById.has(id));
    }

    function persistExpandedSections() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ [FPT_NAV_EXPANDED_STORAGE_KEY]: Array.from(expandedSections) });
            }
        } catch (_) {}
    }

    function isNavCollapsed() {
        return navCollapsed;
    }

    function setNavCollapsed(collapsed, persist = true) {
        if (typeof collapsed !== 'boolean') return;
        cancelNavReveal();
        if (pendingCompactSection && collapsed) cancelPendingCompactSection();
        navCollapsed = collapsed;
        nav.classList.toggle('is-nav-collapsed', navCollapsed);
        if (collapseButton) {
            collapseButton.setAttribute('aria-expanded', navCollapsed ? 'false' : 'true');
            collapseButton.setAttribute('aria-label', navCollapsed ? 'Развернуть меню' : 'Свернуть меню');
            collapseButton.title = navCollapsed ? 'Развернуть меню' : 'Свернуть меню';
        }
        if (persist) {
            preferredNavCollapsed = navCollapsed;
            collapsedUserChanged = true;
            try {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({ [FPT_NAV_COLLAPSED_STORAGE_KEY]: navCollapsed });
                }
            } catch (_) {}
        }
    }

    function syncResponsiveNavCollapse() {
        const shouldAutoCollapse = window.innerWidth <= FPT_NAV_AUTO_COLLAPSE_MAX_WIDTH;
        if (shouldAutoCollapse === autoCollapsedForViewport) return;
        autoCollapsedForViewport = shouldAutoCollapse;
        setNavCollapsed(shouldAutoCollapse ? true : preferredNavCollapsed, false);
    }

    function renderExpandedSections() {
        nav.dataset.expandedSections = Array.from(expandedSections).join(',');
        groupRefs.forEach(({ group, toggle, collapse, icon }, sectionId) => {
            const expanded = expandedSections.has(sectionId);
            group.classList.toggle('is-expanded', expanded);
            group.classList.toggle('is-active-section', !focusedSection && sectionId === activeSection);
            group.classList.toggle('is-focused-section', !!focusedSection && sectionId === focusedSection);
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            collapse.setAttribute('aria-hidden', expanded ? 'false' : 'true');
            collapse.toggleAttribute('inert', !expanded);
            if (icon) icon.dataset.state = expanded ? 'expanded' : 'collapsed';
        });
    }

    function cancelNavReveal() {
        if (navRevealTimer !== null) window.clearTimeout(navRevealTimer);
        navRevealTimer = null;
    }

    // A delayed route reveal must yield when the user interacts with the sidebar.
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
        nav.addEventListener(type, cancelNavReveal, { capture: true, passive: true });
    }
    scroll.addEventListener('scroll', cancelNavReveal, { passive: true });

    function revealNavElement(element) {
        if (!element || !scroll) return;
        cancelNavReveal();
        const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 350;
        navRevealTimer = window.setTimeout(() => {
            navRevealTimer = null;
            if (!element.isConnected || !toolsPopup.classList.contains('active')) return;
            const viewport = scroll.getBoundingClientRect();
            const bounds = element.getBoundingClientRect();
            const margin = 12;
            let delta = 0;
            if (bounds.bottom > viewport.bottom - margin) delta = bounds.bottom - viewport.bottom + margin;
            else if (bounds.top < viewport.top + margin) delta = bounds.top - viewport.top - margin;
            if (delta) scroll.scrollTop = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + delta));
        }, delay);
    }

    function setExpandedSections(next, persist = true) {
        cancelNavReveal();
        expandedSections = new Set(normalizeSectionIds(next));
        renderExpandedSections();
        if (persist) {
            expandedSectionsUserChanged = true;
            persistExpandedSections();
        }
        return Array.from(expandedSections);
    }

    function cancelPendingCompactSection() {
        pendingCompactSection = null;
        nav.classList.remove('is-nav-opening');
        nav.removeEventListener('transitionend', onCompactNavExpanded);
        if (pendingCompactTimer !== null) {
            clearTimeout(pendingCompactTimer);
            pendingCompactTimer = null;
        }
    }

    function onCompactNavExpanded(event) {
        if (event.target === nav && event.propertyName === 'flex-basis') cancelPendingCompactSection();
    }

    function expandSection(sectionId, persist = true) {
        if (!sectionById.has(sectionId)) return;
        expandedSections.add(sectionId);
        renderExpandedSections();
        if (persist) {
            expandedSectionsUserChanged = true;
            persistExpandedSections();
        }
    }

    function toggleSection(sectionId) {
        if (!sectionById.has(sectionId)) return;
        cancelNavReveal();
        focusedSection = null;
        if (expandedSections.has(sectionId)) expandedSections.delete(sectionId);
        else expandedSections.add(sectionId);
        renderExpandedSections();
        expandedSectionsUserChanged = true;
        persistExpandedSections();
    }

    function showSectionForPage(pageId) {
        const item = pageItems.find(entry => entry.dataset.page === pageId);
        const sectionId = item?.dataset.navSection || pageToSection.get(pageId);
        if (!sectionId || !sectionById.has(sectionId)) return;
        activeSection = sectionId;
        focusedSection = null;
        expandSection(sectionId);
        renderExpandedSections();
        revealNavElement(item);
    }

    function revealAllForSearch(sectionIds) {
        const ids = sectionIds == null ? FPT_NAV_SECTIONS.map(section => section.id) : normalizeSectionIds(sectionIds);
        setExpandedSections(ids, false);
        pageItems.forEach(item => {
            if (!isPopupPageAvailable(toolsPopup, item.dataset.page)) {
                item.classList.add('fpt-nav-hidden');
                item.setAttribute('aria-hidden', 'true');
                return;
            }
            item.classList.remove('fpt-nav-section-hidden');
            item.setAttribute('aria-hidden', 'false');
        });
    }

    const api = {
        get activeSection() { return activeSection; },
        showSectionForPage,
        expandSection,
        toggleSection,
        getExpandedSections: () => Array.from(expandedSections),
        setExpandedSections,
        refresh: renderExpandedSections,
        revealAllForSearch,
        isNavCollapsed,
        setNavCollapsed,
        getNavStateSnapshot: () => ({
            collapsed: navCollapsed,
            expandedSections: Array.from(expandedSections),
            focusedSection
        }),
        restoreNavStateSnapshot(snapshot) {
            if (!snapshot || typeof snapshot !== 'object') return;
            cancelNavReveal();
            setNavCollapsed(snapshot.collapsed === true, false);
            expandedSections = new Set(normalizeSectionIds(snapshot.expandedSections));
            focusedSection = sectionById.has(snapshot.focusedSection) ? snapshot.focusedSection : null;
            renderExpandedSections();
        },
        resetForInitialOpen() {
            cancelPendingCompactSection();
            cancelNavReveal();
            scroll.scrollTop = 0;
            collapsedUserChanged = true;
            expandedSectionsUserChanged = true;
            activeSection = null;
            focusedSection = null;
            setNavCollapsed(autoCollapsedForViewport || preferredNavCollapsed, false);
            setExpandedSections([], false);
        }
    };
    toolsPopup._fptNavSections = api;

    groupRefs.forEach(({ toggle }, sectionId) => {
        toggle.addEventListener('click', () => {
            if (pendingCompactSection) {
                focusedSection = sectionId;
                pendingCompactSection = sectionId;
                setExpandedSections([sectionId], true);
                return;
            }
            if (isNavCollapsed()) {
                focusedSection = sectionId;
                pendingCompactSection = sectionId;
                nav.classList.add('is-nav-opening');
                nav.addEventListener('transitionend', onCompactNavExpanded);
                setNavCollapsed(false, true);
                setExpandedSections([sectionId], true);
                if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                    cancelPendingCompactSection();
                } else {
                    pendingCompactTimer = setTimeout(cancelPendingCompactSection, 460);
                }
                return;
            }
            toggleSection(sectionId);
        });
    });

    if (collapseButton) {
        collapseButton.addEventListener('click', () => {
            cancelPendingCompactSection();
            if (isNavCollapsed()) {
                focusedSection = null;
                setNavCollapsed(false, true);
                setExpandedSections([], true);
            } else {
                setExpandedSections([], true);
                setNavCollapsed(true, true);
            }
        });
    }

    window.addEventListener('resize', syncResponsiveNavCollapse, { passive: true });
    syncResponsiveNavCollapse();
    renderExpandedSections();
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            Promise.resolve(chrome.storage.local.get([FPT_NAV_EXPANDED_STORAGE_KEY, FPT_NAV_COLLAPSED_STORAGE_KEY])).then(result => {
                const collapsed = result?.[FPT_NAV_COLLAPSED_STORAGE_KEY];
                if (typeof collapsed === 'boolean' && !collapsedUserChanged) {
                    preferredNavCollapsed = collapsed;
                    setNavCollapsed(autoCollapsedForViewport ? true : collapsed, false);
                }

                const savedExpandedSections = result?.[FPT_NAV_EXPANDED_STORAGE_KEY];
                const validSavedExpandedSections = Array.isArray(savedExpandedSections)
                    && savedExpandedSections.every(sectionId => typeof sectionId === 'string' && sectionById.has(sectionId));
                if (validSavedExpandedSections && !expandedSectionsUserChanged) {
                    const restored = new Set(savedExpandedSections);
                    if (collapsed !== true && activeSection && restored.size) restored.add(activeSection);
                    setExpandedSections(restored, false);
                } else if (!expandedSectionsUserChanged) {
                    setExpandedSections(activeSection ? [activeSection] : [], false);
                }
            }).catch(() => {});
        }
    } catch (_) {}
    return api;
}

const FPT_POPUP_ROUTE_ALIASES = Object.create(null);
const FPT_POPUP_PAGE_MODE_HANDLERS = Object.create(null);

function registerPopupRouteAlias(alias, route) {
    const aliasId = String(alias || '').trim();
    const routeId = typeof route === 'string' ? route : route?.pageId;
    if (!aliasId || !routeId || aliasId === routeId) return false;
    FPT_POPUP_ROUTE_ALIASES[aliasId] = typeof route === 'string'
        ? { pageId: routeId }
        : { pageId: routeId, mode: route.mode };
    return true;
}

function registerPopupPageModeHandler(pageId, handler, targetPopup) {
    const id = String(pageId || '').trim();
    if (!id || !handler || typeof handler !== 'object') return false;
    FPT_POPUP_PAGE_MODE_HANDLERS[id] = handler;
    const popup = targetPopup || document.querySelector('.fp-tools-popup');
    if (popup) {
        popup._fptPageModeHandlers ||= Object.create(null);
        popup._fptPageModeHandlers[id] = handler;
    }
    return true;
}

function getPopupPageModeHandler(toolsPopup, pageId) {
    return toolsPopup?._fptPageModeHandlers?.[pageId]
        || FPT_POPUP_PAGE_MODE_HANDLERS[pageId]
        || window.__fptPopupPageModeHandlers?.[pageId]
        || null;
}

function popupPageModeDefault(handler) {
    return handler && Object.prototype.hasOwnProperty.call(handler, 'defaultMode')
        ? handler.defaultMode
        : null;
}

function isPopupPageModeSupported(handler, mode) {
    if (mode == null) return mode === popupPageModeDefault(handler);
    if (typeof handler?.isModeSupported === 'function') return !!handler.isModeSupported(mode);
    if (Array.isArray(handler?.modes)) return handler.modes.includes(mode);
    return mode === popupPageModeDefault(handler);
}

function normalizePopupRoute(pageId) {
    let normalizedId = typeof pageId === 'string' ? pageId : '';
    let aliasMode;
    const visited = new Set();
    while (normalizedId && FPT_POPUP_ROUTE_ALIASES[normalizedId] && !visited.has(normalizedId)) {
        visited.add(normalizedId);
        const alias = FPT_POPUP_ROUTE_ALIASES[normalizedId];
        if (alias.mode !== undefined && aliasMode === undefined) aliasMode = alias.mode;
        normalizedId = alias.pageId;
    }
    return { pageId: normalizedId, mode: aliasMode };
}

function findPopupPage(toolsPopup, pageId) {
    return Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content'))
        .find(page => page.dataset.page === pageId) || null;
}

function getPopupNavigationActions(toolsPopup) {
    return Array.from(toolsPopup.querySelectorAll('.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]'));
}

function isPopupPageAvailable(toolsPopup, pageId) {
    return Boolean(findPopupPage(toolsPopup, pageId));
}

function isPopupPageSearchable(toolsPopup, pageId) {
    return isPopupPageAvailable(toolsPopup, pageId);
}

function enqueuePopupNavigationWrite(toolsPopup, write) {
    const previous = toolsPopup._fptNavigationWriteQueue || Promise.resolve();
    const current = previous.catch(() => {}).then(write);
    toolsPopup._fptNavigationWriteQueue = current.catch(() => {});
    return current;
}

function persistPopupRouteState(toolsPopup, pageId, mode) {
    return enqueuePopupNavigationWrite(toolsPopup, async () => {
        const stored = await chrome.storage.local.get('fpToolsPageModes');
        const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
            ? stored.fpToolsPageModes
            : {};
        await chrome.storage.local.set({
            fpToolsLastPage: pageId,
            fpToolsLastPageMode: mode,
            fpToolsPageModes: { ...savedModes, [pageId]: mode }
        });
    });
}

function persistPopupPageMode(pageId, mode) {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return Promise.resolve(false);
    const handler = getPopupPageModeHandler(toolsPopup, pageId);
    if (!handler || !isPopupPageModeSupported(handler, mode)) return Promise.resolve(false);
    return enqueuePopupNavigationWrite(toolsPopup, async () => {
        const stored = await chrome.storage.local.get(['fpToolsPageModes', 'fpToolsLastPage']);
        const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
            ? stored.fpToolsPageModes
            : {};
        const currentPageId = toolsPopup._fptCurrentPageId || stored?.fpToolsLastPage;
        const nextState = { fpToolsPageModes: { ...savedModes, [pageId]: mode } };
        if (currentPageId === pageId) nextState.fpToolsLastPageMode = mode;
        await chrome.storage.local.set(nextState);
        return true;
    });
}

async function openPopupPage(pageId, options = {}) {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return false;
    mountPopupCategoryHeaders(toolsPopup);
    const opts = options && typeof options === 'object' ? options : {};
    const persist = opts.persist !== false;
    const initialRoute = normalizePopupRoute(pageId);
    let targetPageId = initialRoute.pageId;
    let requestedMode = opts.mode === undefined ? initialRoute.mode : opts.mode;
    const routeVersion = (toolsPopup._fptRouteVersion || 0) + 1;
    toolsPopup._fptRouteVersion = routeVersion;

    let pageNode = findPopupPage(toolsPopup, targetPageId);
    if (!pageNode || !isPopupPageAvailable(toolsPopup, targetPageId)) {
        targetPageId = 'lot_io';
        requestedMode = undefined;
        pageNode = findPopupPage(toolsPopup, targetPageId);
    }
    if (!pageNode) return false;

    const previousPageId = toolsPopup._fptCurrentPageId
        || Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content')).find(page => page.classList.contains('active'))?.dataset.page
        || null;
    if (previousPageId === 'finance_hub' && targetPageId !== 'finance_hub'
        && window.fptFinanceHub && typeof window.fptFinanceHub.onPageLeave === 'function') {
        window.fptFinanceHub.onPageLeave();
    }

    const actions = getPopupNavigationActions(toolsPopup);
    const navItem = actions.find(item => item.dataset.page === targetPageId) || null;
    const navSections = toolsPopup._fptNavSections;
    if (navSections && typeof navSections.showSectionForPage === 'function') navSections.showSectionForPage(targetPageId);
    actions.forEach(item => item.classList.toggle('active', item.dataset.page === targetPageId));
    toolsPopup.querySelectorAll('.fp-tools-page-content').forEach(page => {
        page.classList.toggle('active', page === pageNode);
    });
    const content = toolsPopup.querySelector('.fp-tools-content');
    content?.classList.remove('fpt-start-state-active');
    toolsPopup._fptCurrentPageId = targetPageId;

    let stored = {};
    try {
        stored = await chrome.storage.local.get(['fpToolsLastPage', 'fpToolsLastPageMode', 'fpToolsPageModes']);
    } catch (_) {}
    if (routeVersion !== toolsPopup._fptRouteVersion) return false;

    const handler = getPopupPageModeHandler(toolsPopup, targetPageId);
    const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
        ? stored.fpToolsPageModes
        : {};
    const hasSavedPageMode = Object.prototype.hasOwnProperty.call(savedModes, targetPageId);
    let targetMode = popupPageModeDefault(handler);

    if (requestedMode !== undefined) {
        targetMode = isPopupPageModeSupported(handler, requestedMode) ? requestedMode : popupPageModeDefault(handler);
    } else if (hasSavedPageMode) {
        targetMode = isPopupPageModeSupported(handler, savedModes[targetPageId])
            ? savedModes[targetPageId]
            : popupPageModeDefault(handler);
    } else if (targetPageId === 'finance_hub' && handler) {
        try {
            const sessionMode = sessionStorage.getItem('fpt_fin_active_subtab');
            if (isPopupPageModeSupported(handler, sessionMode)) targetMode = sessionMode;
        } catch (_) {}
    }

    if (handler && typeof handler.select === 'function') {
        toolsPopup._fptApplyingRouteMode = true;
        try {
            const selection = await handler.select(targetMode, { persist: false, pageId: targetPageId });
            if (selection === false && targetMode !== popupPageModeDefault(handler)) {
                targetMode = popupPageModeDefault(handler);
                await handler.select(targetMode, { persist: false, pageId: targetPageId });
            }
        } catch (_) {
            targetMode = popupPageModeDefault(handler);
            try { await handler.select(targetMode, { persist: false, pageId: targetPageId }); } catch (_) {}
        } finally {
            toolsPopup._fptApplyingRouteMode = false;
        }
    }
    if (routeVersion !== toolsPopup._fptRouteVersion) return false;

    if (typeof opts.focusTarget === 'string') {
        const target = pageNode.querySelector(opts.focusTarget);
        if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    } else if (opts.focusTarget && typeof opts.focusTarget.focus === 'function') {
        opts.focusTarget.focus({ preventScroll: true });
    } else if (opts.focusTarget === true && navItem && typeof navItem.focus === 'function') {
        navItem.focus({ preventScroll: true });
    }

    if (persist) {
        try { await persistPopupRouteState(toolsPopup, targetPageId, targetMode); } catch (_) {}
    }
    return true;
}

if (typeof window !== 'undefined') {
    window.__fptPopupRouteAliases ||= FPT_POPUP_ROUTE_ALIASES;
    window.__fptPopupPageModeHandlers ||= FPT_POPUP_PAGE_MODE_HANDLERS;
    if (typeof window.fptRegisterPopupRouteAlias !== 'function') {
        window.fptRegisterPopupRouteAlias = registerPopupRouteAlias;
    }
    if (typeof window.fptRegisterPopupPageModeHandler !== 'function') {
        window.fptRegisterPopupPageModeHandler = registerPopupPageModeHandler;
    }
    if (typeof window.fptSetPopupPageMode !== 'function') {
        window.fptSetPopupPageMode = persistPopupPageMode;
    }
    if (typeof window.fptOpenPopupPage !== 'function') {
        window.fptOpenPopupPage = (pageId, options) => openPopupPage(pageId, options);
    }
}

function setupPopupNavigation() {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return;
    const navSections = setupNavigationSections(toolsPopup);
    const navItems = getPopupNavigationActions(toolsPopup);

    navItems.forEach(item => {
        if (!item.dataset.page) return;
        item.addEventListener('click', event => {
            event.preventDefault();
            openPopupPage(item.dataset.page);
        });
    });

    setupNavSearch(toolsPopup);
    setupPopupPageModes(toolsPopup);


}

function setupPopupPageModes(toolsPopup) {
    const metadata = window.FPTPopupMetadata;
    if (!metadata) return;
    registerPopupRouteAlias('slash_commands', { pageId: 'templates', mode: 'commands' });
    Object.entries(metadata.pages).forEach(([pageId, entry]) => {
        if (!entry.modes.length) return;
        let selectedMode = entry.defaultMode;
        registerPopupPageModeHandler(pageId, {
            defaultMode: entry.defaultMode, modes: entry.modes,
            getMode() { return selectedMode; },
            select(mode) {
                if (!entry.modes.includes(mode)) return false;
                selectedMode = mode;
                const page = findPopupPage(toolsPopup, pageId);
                if (page) page.dataset.fptPageMode = mode;
                if (pageId === 'finance_hub') {
                    try { sessionStorage.setItem('fpt_fin_active_subtab', mode); } catch (_) {}
                }
                return true;
            }
        }, toolsPopup);
    });
}

function setupNavSearch(toolsPopup) {
    const input = toolsPopup.querySelector('#fptNavSearch');
    const clearBtn = toolsPopup.querySelector('#fptNavSearchClear');
    const searchToggle = toolsPopup.querySelector('#fptNavSearchToggle');
    const resultsBox = toolsPopup.querySelector('#fptNavSearchResults');
    const nav = toolsPopup.querySelector('.fp-tools-nav');
    const body = toolsPopup.querySelector('.fp-tools-body');
    const navSections = toolsPopup._fptNavSections || null;
    if (!input || !nav || !resultsBox) return;
    let searchNavStateSnapshot = null;

    function restoreNavStateSnapshot() {
        if (!searchNavStateSnapshot || !navSections) return false;
        navSections.restoreNavStateSnapshot(searchNavStateSnapshot);
        searchNavStateSnapshot = null;
        return true;
    }

    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            if (navSections?.isNavCollapsed()) {
                if (!searchNavStateSnapshot) searchNavStateSnapshot = navSections.getNavStateSnapshot();
                navSections.setNavCollapsed(false, false);
            }
            input.focus();
        });
    }

    // Выносим выпадашку результатов из левой панели (у неё overflow:auto, который
    // обрезал бы список) в общий контейнер тела попапа — так список может свободно
    // раскрываться поверх правой панели с функциями и показывать строки целиком.
    if (body && resultsBox.parentElement !== body) {
        body.appendChild(resultsBox);
    }

    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
    let currentSearchQuery = '';

    // Плавное скрытие: сначала снимаем active (запускается transition), затем, когда
    // анимация закончилась, чистим содержимое. Это убирает резкое мигание.
    let hideTimer = null;
    function showResults() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        resultsBox.classList.add('active');
    }
    function hideResults(clear) {
        resultsBox.classList.remove('active');
        if (clear) {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { resultsBox.innerHTML = ''; hideTimer = null; }, 180);
        }
    }

    const searchableFeatureSelector = 'h3, h4, h5, label > span, .setting-group > h4';
    const searchableModePaneSelector = '[data-quick-replies-pane], .fpt-fin-tab-pane[data-subtab], [data-route-mode]';
    const legacySearchAliases = Object.freeze({
        lot_io: [{ mode: null, aliases: ['Импорт / экспорт'] }],
        templates: [
            { mode: 'templates', aliases: ['Шаблоны'] },
            { mode: 'commands', aliases: ['Слэш-команды'] }
        ],
        theme: [{ mode: null, aliases: ['Кастомизация'] }],
        tickets: [{ mode: null, aliases: ['Тикеты'] }],
        settings_io: [{ mode: null, aliases: ['Импорт / экспорт'] }],
    });

    function getSearchableModePanes(page) {
        return Array.from(page?.querySelectorAll(searchableModePaneSelector) || []);
    }

    function getSearchMode(pane) {
        const data = pane?.dataset || {};
        return data.routeMode || data.quickRepliesPane || data.subtab || null;
    }

    function getLegacyAliases(pageId, mode) {
        return (legacySearchAliases[pageId] || [])
            .filter(entry => entry.mode === (mode || null))
            .flatMap(entry => entry.aliases);
    }

    function getPageGroupId(pageId, navItem) {
        if (navItem?.dataset?.navSection) return navItem.dataset.navSection;
        return FPT_NAV_SECTIONS.find(section => section.pages.includes(pageId))?.id || null;
    }

    function buildFeatureIndex() {
        const index = [];
        const pages = Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content'));
        const actions = getPopupNavigationActions(toolsPopup);
        const pageById = new Map(pages.map(page => [page.dataset.page, page]));
        const actionById = new Map(actions.filter(item => item.dataset.page).map(item => [item.dataset.page, item]));
        const groupToggles = Array.from(toolsPopup.querySelectorAll('.fpt-nav-group-toggle'));
        const groupToggleById = new Map(groupToggles.map(item => [item.dataset.section, item]));
        const seen = new Set();
        const addEntry = (groupId, pageId, mode, text, aliases, element) => {
            const normalizedText = (text || '').replace(/\s+/g, ' ').trim();
            if (!normalizedText || normalizedText.length < 2 || normalizedText.length > 100) return;
            const key = [groupId || '', pageId || '', mode || '', normalizedText.toLowerCase()].join('::');
            if (seen.has(key)) return;
            seen.add(key);
            index.push({ groupId: groupId || null, pageId: pageId || null, mode: mode || null, text: normalizedText, aliases: aliases || [], element: element || null });
        };

        FPT_NAV_SECTIONS.forEach(section => {
            addEntry(section.id, null, null, section.label, [], groupToggleById.get(section.id));
        });

        actions.forEach(navItem => {
            const pageId = navItem.dataset.page;
            if (!pageId || !isPopupPageSearchable(toolsPopup, pageId)) return;
            const page = pageById.get(pageId);
            const label = (navItem.querySelector('span:last-child')?.textContent || pageId).trim();
            const groupId = getPageGroupId(pageId, navItem);
            const pageHeading = page?.querySelector(searchableFeatureSelector.split(',')[0]) || page;
            addEntry(groupId, pageId, null, label, getLegacyAliases(pageId, null), pageHeading || navItem);

            (legacySearchAliases[pageId] || []).filter(aliasRoute => aliasRoute.mode).forEach(aliasRoute => {
                const modePane = aliasRoute.mode && page
                    ? getSearchableModePanes(page).find(pane => getSearchMode(pane) === aliasRoute.mode)
                    : null;
                const modeHeading = modePane?.querySelector(searchableFeatureSelector.split(',')[0]);
                aliasRoute.aliases.forEach(alias => {
                    addEntry(groupId, pageId, aliasRoute.mode, alias, [alias], modeHeading || modePane || pageHeading || navItem);
                });
            });
        });

        pages.forEach(page => {
            const pageId = page.dataset.page;
            if (!isPopupPageSearchable(toolsPopup, pageId)) return;
            const metadata = typeof window !== 'undefined' ? window.FPTPopupMetadata?.pages?.[pageId] : null;
            if (metadata) {
                const navItem = actionById.get(pageId);
                const groupId = getPageGroupId(pageId, navItem);
                metadata.features.forEach(feature => addEntry(groupId, pageId, feature.mode || null, feature.text, [], navItem));
                if (pageId === 'needs') {
                    (window.FPT_FEATURE_REGISTRY || []).forEach(feature => addEntry(groupId, pageId, null,
                        feature.label, [feature.desc, feature.group, feature.subgroup, ...(feature.legacyLabels || []),
                            ...(feature.searchAliases || [])].filter(Boolean), navItem));
                }
            }
            const navItem = actionById.get(pageId);
            const groupId = getPageGroupId(pageId, navItem);
            const addFeature = (container, mode) => {
                const headings = Array.from(container.querySelectorAll(searchableFeatureSelector));
                if (!headings.length && mode) {
                    const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
                    addEntry(groupId, pageId, mode, text, [], container);
                    return;
                }
                headings.forEach(element => {
                    if (element.closest('.fpt-nav-search')) return;
                    if (!mode && element.closest(searchableModePaneSelector)) return;
                    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
                    addEntry(groupId, pageId, mode, text, [], element);
                });
            };

            addFeature(page, null);
            getSearchableModePanes(page).forEach(pane => {
                const mode = getSearchMode(pane);
                if (mode) addFeature(pane, mode);
            });
        });
        return index;
    }

    function searchItemMatches(item, query) {
        return norm(item.text).includes(query) || (item.aliases || []).some(alias => norm(alias).includes(query));
    }

    function getMatchingGroupIds(index, query) {
        return new Set(index
            .filter(item => !item.pageId && item.groupId && searchItemMatches(item, query))
            .map(item => item.groupId));
    }

    function clearHighlights() {
        toolsPopup.querySelectorAll('.fpt-search-flash').forEach(el => el.classList.remove('fpt-search-flash'));
    }

    function waitForSearchMode(item, attempts = 30) {
        return new Promise(resolve => {
            const page = Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content')).find(node => node.dataset.page === item.pageId);
            const pane = item.mode && page
                ? getSearchableModePanes(page).find(node => getSearchMode(node) === item.mode)
                : null;
            if (!pane) { resolve(); return; }
            const check = remaining => {
                if ((!pane.hidden && pane.getAttribute('aria-hidden') !== 'true') || remaining <= 0) { resolve(); return; }
                setTimeout(() => check(remaining - 1), 35);
            };
            check(attempts);
        });
    }

    function jumpToFeature(item) {
        const routeOptions = item.mode ? { mode: item.mode } : {};
        openPopupPage(item.pageId, routeOptions).then(routed => {
            if (routed === false) return;
            return waitForSearchMode(item).then(() => {
                const target = item.element;
                if (!target) return;
                clearHighlights();
                try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { target.scrollIntoView(); }
                target.classList.add('fpt-search-flash');
                setTimeout(() => target.classList.remove('fpt-search-flash'), 2200);
            });
        }).catch(() => {});
    }

    // Обновляем список результатов «на месте», не пересоздавая с нуля, чтобы не было
    // мигания: existing rows fade in, а не пропадают/появляются рывком.
    let lastKeys = '';
    function clearResultsImmediately() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        resultsBox.classList.remove('active');
        resultsBox.innerHTML = '';
        lastKeys = '';
    }

    function renderResults(query, invalidateImmediately = false) {
        const q = norm(query);
        if (!q) {
            if (invalidateImmediately) clearResultsImmediately();
            else { hideResults(true); lastKeys = ''; }
            return;
        }
        const index = buildFeatureIndex();
        const matchingGroups = getMatchingGroupIds(index, q);
        const hits = index
            .filter(it => searchItemMatches(it, q))
            .filter(it => !it.pageId || !matchingGroups.size || matchingGroups.has(it.groupId))
            .slice(0, 20);
        if (!hits.length) {
            if (invalidateImmediately) clearResultsImmediately();
            else { hideResults(true); lastKeys = ''; }
            return;
        }

        const keys = hits.map(h => [h.groupId || '', h.pageId || '', h.mode || '', h.text].join('::')).join('|');
        if (keys === lastKeys) {
            resultsBox.querySelectorAll('.fpt-nav-search-result').forEach(row => { row._fptSearchQuery = q; });
            showResults();
            return;
        } // содержимое не изменилось
        lastKeys = keys;

        resultsBox.innerHTML = '';
        const frag = document.createDocumentFragment();
        hits.forEach((it, i) => {
            const row = document.createElement('div');
            row.className = 'fpt-nav-search-result';
            row._fptSearchQuery = q;
            row.style.animationDelay = Math.min(i * 18, 180) + 'ms';
            row.innerHTML = `<span class="fpt-nsr-text"></span><span class="fpt-nsr-page"></span>`;
            row.querySelector('.fpt-nsr-text').textContent = it.text;
            const navItem = it.pageId ? getPopupNavigationActions(toolsPopup).find(item => item.dataset.page === it.pageId) : null;
            row.querySelector('.fpt-nsr-page').textContent = it.pageId
                ? (navItem?.querySelector('span:last-child')?.textContent || it.pageId).trim()
                : 'Группа';
            row.addEventListener('click', () => {
                if (!currentSearchQuery || row._fptSearchQuery !== currentSearchQuery) return;
                if (!it.pageId && it.groupId) {
                    navSections?.revealAllForSearch(new Set([it.groupId]));
                    return;
                }
                cancelPendingSearchRender();
                input.value = '';
                currentSearchQuery = '';
                applyFilter('');
                hideResults(true);
                jumpToFeature(it);
            });
            frag.appendChild(row);
        });
        resultsBox.appendChild(frag);
        showResults();
    }

    function applyFilter(query) {
        const q = norm(query);
        const items = toolsPopup.querySelectorAll('.fp-tools-nav li[data-page]');
        const dividers = toolsPopup.querySelectorAll('.fp-tools-nav li.fp-nav-divider');
        nav.classList.toggle('fpt-search-active', !!q);
        clearBtn.style.display = q ? 'block' : 'none';

        if (!q) {
            items.forEach(li => {
                const searchable = isPopupPageSearchable(toolsPopup, li.dataset.page);
                li.classList.toggle('fpt-nav-hidden', !searchable);
                li.classList.remove('fpt-nav-match');
                li.setAttribute('aria-hidden', searchable ? 'false' : 'true');
            });
            dividers.forEach(d => d.classList.remove('fpt-nav-hidden'));
            if (navSections) {
                if (!restoreNavStateSnapshot()) navSections.refresh();
            }
            return;
        }

        if (!searchNavStateSnapshot && navSections) {
            searchNavStateSnapshot = navSections.getNavStateSnapshot();
        }

        const searchIndex = buildFeatureIndex();
        const matchingGroups = getMatchingGroupIds(searchIndex, q);
        const matchingPages = new Set(searchIndex
            .filter(item => item.pageId && searchItemMatches(item, q)
                && (!matchingGroups.size || matchingGroups.has(item.groupId)))
            .map(item => item.pageId));
        const matchingSections = new Set(matchingGroups);

        items.forEach(li => {
            const label = norm(li.querySelector('span:last-child')?.textContent || '');
            const match = isPopupPageSearchable(toolsPopup, li.dataset.page)
                && (label.includes(q) || matchingPages.has(li.dataset.page) || matchingGroups.has(li.dataset.navSection));
            li.classList.toggle('fpt-nav-hidden', !match);
            li.classList.toggle('fpt-nav-match', match);
            li.setAttribute('aria-hidden', match ? 'false' : 'true');
            if (match && li.dataset.navSection) matchingSections.add(li.dataset.navSection);
        });

        dividers.forEach(d => d.classList.add('fpt-nav-hidden'));
        if (navSections) navSections.revealAllForSearch(matchingSections);
    }

    let t = null;
    function cancelPendingSearchRender() {
        if (t) clearTimeout(t);
        t = null;
    }

    input.addEventListener('input', () => {
        const v = input.value;
        currentSearchQuery = norm(v);
        applyFilter(v);
        cancelPendingSearchRender();
        t = setTimeout(() => { t = null; renderResults(v); }, 90);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { cancelPendingSearchRender(); input.value = ''; currentSearchQuery = ''; applyFilter(''); hideResults(true); input.blur(); }
        if (e.key === 'Enter') {
            const first = resultsBox.querySelector('.fpt-nav-search-result');
            if (first && currentSearchQuery && first._fptSearchQuery === currentSearchQuery) first.click();
        }
    });
    clearBtn.addEventListener('click', () => {
        cancelPendingSearchRender();
        input.value = '';
        currentSearchQuery = '';
        applyFilter('');
        hideResults(true);
        input.focus();
    });
    toolsPopup.addEventListener('click', (e) => {
        if (!e.target.closest('.fpt-nav-search') && !e.target.closest('.fpt-nav-search-results')) hideResults(false);
    });
    clearBtn.style.display = 'none';

    if (!toolsPopup.dataset.fptNavShortcutBound) {
        toolsPopup.dataset.fptNavShortcutBound = '1';
        toolsPopup.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 'k') return;
            if (!toolsPopup.classList.contains('active')) return;
            e.preventDefault();
            if (navSections?.isNavCollapsed() && searchToggle) searchToggle.click();
            input.focus();
            input.select();
        });
    }

    toolsPopup._fptNavSearch = {
        buildFeatureIndex,
        resetForPopupStart() {
            cancelPendingSearchRender();
            input.value = '';
            currentSearchQuery = '';
            searchNavStateSnapshot = null;
            applyFilter('');
            clearResultsImmediately();
            input.blur();
        },
        refreshVisibility() {
            currentSearchQuery = norm(input.value);
            applyFilter(input.value);
            renderResults(input.value, true);
        }
    };
}


function resetPopupStartState() {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return false;

    toolsPopup._fptRouteVersion = (toolsPopup._fptRouteVersion || 0) + 1;
    if (toolsPopup._fptCurrentPageId === 'finance_hub'
        && window.fptFinanceHub && typeof window.fptFinanceHub.onPageLeave === 'function') {
        window.fptFinanceHub.onPageLeave();
    }

    if (toolsPopup._fptNavSearch?.resetForPopupStart) toolsPopup._fptNavSearch.resetForPopupStart();
    getPopupNavigationActions(toolsPopup).forEach(item => item.classList.remove('active'));
    toolsPopup.querySelectorAll('.fp-tools-page-content').forEach(page => page.classList.remove('active'));
    toolsPopup._fptCurrentPageId = null;

    const content = toolsPopup.querySelector('.fp-tools-content');
    if (content) content.scrollTop = 0;

    if (toolsPopup._fptNavSections?.resetForInitialOpen) toolsPopup._fptNavSections.resetForInitialOpen();
    return true;
}

async function loadLastActivePage() {
    let fpToolsLastPage = null;
    try {
        ({ fpToolsLastPage } = await chrome.storage.local.get('fpToolsLastPage'));
    } catch (_) {}
    const popup = document.querySelector('.fp-tools-popup');
    const activePage = popup && Array.from(popup.querySelectorAll('.fp-tools-page-content'))
        .find(page => page.classList.contains('active'))?.dataset.page;
    const pageId = typeof fpToolsLastPage === 'string' && fpToolsLastPage ? fpToolsLastPage : activePage || 'lot_io';
    return openPopupPage(pageId);
}

function makePopupResponsive(popupEl) {
    if (!popupEl || popupEl._fptViewportResizeHandler) return;

    let resizeFrame = 0;
    const updateGeometry = () => {
        resizeFrame = 0;
        if (!document.body.contains(popupEl)) return;
        if (typeof applyResponsivePopupGeometry === 'function') applyResponsivePopupGeometry(popupEl);
    };
    const onViewportResize = () => {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(updateGeometry);
    };

    popupEl._fptViewportResizeHandler = onViewportResize;
    window.addEventListener('resize', onViewportResize, { passive: true });
    updateGeometry();
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    const modeActions = {
        templates: { fptQuickRepliesTemplatesTab: 'templates', fptQuickRepliesCommandsTab: 'commands' },
        finance_hub: { fptFinTabOverview: 'overview', fptFinTabSales: 'sales', fptFinTabPurchases: 'purchases',
            fptFinTabProfit: 'profit', fptFinTabPotential: 'potential', fptFinTabOperations: 'operations' }
    };
    Object.entries(modeActions).forEach(([pageId, actions]) => {
        Object.entries(actions).forEach(([id, mode]) => window.fptPopupActions.register(pageId, id, async () => {
            if (window.__fpEnsurePopup) await window.__fpEnsurePopup();
            return window.fptOpenPopupPage(pageId, { mode });
        }));
    });
}
