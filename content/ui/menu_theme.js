// Shared window palette: available before the settings popup is loaded.
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
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group{ width:100%; min-width:0; border-radius:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{
    box-sizing:border-box; width:100%; min-width:0; height:54px; min-height:54px; display:flex; align-items:center; gap:12px; margin-inline:auto; padding:0 12px;
    border:1px solid transparent !important; border-radius:22px; background:transparent !important;
    color:var(--fptm-text) !important; box-shadow:none !important; font:inherit; font-size:16px; font-weight:500;
    text-align:left; cursor:pointer; transition:padding-left .38s cubic-bezier(.4,0,.2,1), gap .38s cubic-bezier(.4,0,.2,1), transform .38s cubic-bezier(.34,1.16,.64,1), background-color .24s cubic-bezier(.22,1,.36,1), color .24s cubic-bezier(.22,1,.36,1), border-color .24s cubic-bezier(.22,1,.36,1), box-shadow .24s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav:not(.is-nav-collapsed):not(.is-nav-opening) .fpt-nav-group-toggle:hover:not(:active){ transform:translateY(-1px) scale(1.012); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:transparent !important; border-color:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active:hover{ background:#6d59ed !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{ width:34px; height:34px; flex:0 0 34px; object-fit:contain; display:block; filter:brightness(0) invert(0) opacity(.82); transition:filter .24s ease; }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-icon,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(1); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-icon{ filter:brightness(0) invert(0) opacity(.82); }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
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
    background:transparent !important; border-radius:10px !important; box-shadow:none !important; border:1px solid transparent !important;
    font-size:15px; font-weight:500; transition:background .15s ease, color .15s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a:hover{ background:var(--fptm-nav-row-hover, rgba(118,99,246,.08)) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a{
    background:transparent !important; color:var(--fptm-text) !important; border-color:transparent !important; font-weight:500 !important;
}
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
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle{ width:100%; height:54px; min-height:54px; justify-content:flex-start; gap:0; padding:0 0 0 23px; border-radius:22px; }
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
