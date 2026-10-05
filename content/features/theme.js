let bottomBarObserver = null;
const BOTTOM_BAR_STYLE_ID = 'fp-tools-bottom-bar-style';
const THEME_OVERRIDE_STYLE_ID = 'fp-tools-theme-override';

function applyDropupClassForBottomBar() {
    const dropdowns = document.querySelectorAll('#header .navbar-nav > li.dropdown');
    dropdowns.forEach(dd => {
        dd.classList.add('dropup');
    });
    const mobileDropdowns = document.querySelectorAll('#navbar li.dropdown');
     mobileDropdowns.forEach(dd => {
        dd.classList.add('dropup');
    });
}

function enableBottomBar() {
    if (document.getElementById(BOTTOM_BAR_STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = BOTTOM_BAR_STYLE_ID;
    styleEl.textContent = `
        body { padding-bottom: 65px !important; padding-top: 0 !important; }
        #header { top: auto !important; bottom: 0 !important; border-top: 1px solid #e4e4e4; border-bottom: none !important; position: fixed; width: 100%; z-index: 1040; }
        .navbar-default { border-color: rgba(0,0,0,0) !important; }
        #header .navbar-default { border-top: 1px solid #e4e4e466; border-bottom: none !important; }
        #header .dropup .dropdown-menu { top: auto !important; bottom: calc(100% - 1px); margin-top: 0; margin-bottom: 7px; box-shadow: 0 -4px 12px rgba(0,0,0,.175); border-radius: 4px; }
        .navbar-form .dropdown-autocomplete { top: auto !important; bottom: 100% !important; border-bottom: none !important; border-top: 1px solid #e4e4e4 !important; box-shadow: 0 -4px 12px rgba(0,0,0,.175); border-radius: 4px 4px 0 0; }
        @media (max-width: 991px) {
            #navbar.in, #navbar.collapsing { top: auto; bottom: 100%; position: absolute; right: 1px; left: auto; width: 240px; margin-bottom: 12px; border-radius: 4px; }
            .navbar-collapse { max-height: calc(100vh - 80px); }
        }
    `;
    document.head.appendChild(styleEl);

    applyDropupClassForBottomBar();

    bottomBarObserver = new MutationObserver((mutationsList) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList' && document.querySelector('#header li.dropdown:not(.dropup)')) {
                applyDropupClassForBottomBar();
            }
        }
    });

    const ensureHeaderExists = setInterval(() => {
        const header = document.getElementById('header');
        if (header) {
            clearInterval(ensureHeaderExists);
            applyDropupClassForBottomBar();
            bottomBarObserver.observe(header, { childList: true, subtree: true });
        }
    }, 100);
}

function disableBottomBar() {
    const styleEl = document.getElementById(BOTTOM_BAR_STYLE_ID);
    if (styleEl) styleEl.remove();

    document.body.style.paddingBottom = '';

    if (bottomBarObserver) {
        bottomBarObserver.disconnect();
        bottomBarObserver = null;
    }

    const dropdowns = document.querySelectorAll('#header .dropup');
    dropdowns.forEach(dd => dd.classList.remove('dropup'));
}

async function applyHeaderPosition() {
    const { fpToolsTheme = {} } = await chrome.storage.local.get(['fpToolsTheme']);
    const position = fpToolsTheme.headerPosition || 'top';

    if (position === 'bottom') {
        enableBottomBar();
    } else {
        disableBottomBar();
    }
}

const GOOGLE_FONTS = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro'];
const DEFAULT_THEME = {
    // 'custom' - полное оформление темы, 'original' - родной вид FunPay (без обоев и перекраски),
    // но с формой, шрифтом, скроллбаром и прочими деталями.
    baseStyle: 'custom',
    bgColor1: '#ff6d15',
    bgColor2: '#f4cf78',
    containerBgColor: '#0b0b0b',
    containerBgOpacity: 1,
    textColor: '#f0f0f0',
    linkColor: '#2d6bb3',
    bgImage: null,
    font: 'Helvetica Neue',
    bgBlur: 0,
    bgBrightness: 100,
    borderRadius: 8,
    enableCircleCustomization: false,
    showCircles: true,
    circleSize: 100,
    circleOpacity: 100,
    circleBlur: 0,
    enableImprovedSeparators: false,
    headerPosition: 'top',
    enableGlassmorphism: false,
    glassmorphismBlur: 10,
    enableCustomScrollbar: false,
    scrollbarThumbColor: '#555555',
    scrollbarTrackColor: '#222222',
    scrollbarWidth: 8,
    // Прозрачное меню FunPay Funcy
    menuTransparent: false,
    menuTintColor: '#2a1033',   // тёмно-пурпурный
    menuOpacity: 3,             // %
    menuBlurEnabled: true,
    menuBlur: 8,                // px
    // Контур тексту
    textOutlineEnabled: false,
    textOutlineColor: '#000000',
    textOutlineWidth: 1         // px
};

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
    } else if (hex.length == 7) {
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
    }
    return `rgba(${+r},${+g},${+b},${alpha})`;
}

function manageFontImports(settings) {
    const fontStyleId = 'fp-tools-google-fonts';
    let styleEl = document.getElementById(fontStyleId);
    const font = settings.font;
    const isGoogleFont = GOOGLE_FONTS.includes(font);
    const newContent = isGoogleFont ? `@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;700&display=swap');` : '';

    if (!styleEl) {
        styleEl = createElement('style', { id: fontStyleId });
        document.head.appendChild(styleEl);
    }

    if (styleEl.textContent !== newContent) {
        styleEl.textContent = newContent;
    }
}

function fptHexToRgb(hex) {
    if (!hex) return [200, 200, 200];
    hex = String(hex).trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 8) hex = hex.slice(0, 6);
    const num = parseInt(hex, 16);
    if (isNaN(num)) return [200, 200, 200];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function fptRgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function fptHslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(Math.min(255, Math.max(0, x * 255))).toString(16).padStart(2, '0');
    return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

function fptRelLuminance([r, g, b]) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function fptContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// Автокоррекция контраста: сохраняет авторский оттенок (Hue) и насыщенность,
// но подтягивает яркость (Lightness), чтобы текст и ссылки не сливались с фоном
function fptEnsureReadableColor(hex, opts = {}) {
    const minContrast = opts.minContrast || 4.5;
    const targetLightness = opts.targetLightness || 72;
    const rgb = fptHexToRgb(hex);
    const lum = fptRelLuminance(rgb);
    const bgLum = 0.012; // базовый темный фон wrapper-content funpay
    const cr = fptContrastRatio(lum, bgLum);
    if (cr >= minContrast) return hex;

    const [r, g, b] = rgb;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if ((maxC - minC <= 16) || maxC <= 25) {
        return fptHslToHex(0, 0, Math.max(targetLightness, 88));
    }

    const [h, s, l] = fptRgbToHsl(r, g, b);
    const newS = Math.min(Math.max(s, 50), 85);
    let newL = Math.max(l, targetLightness);
    let result = fptHslToHex(h, newS, newL);
    let newLum = fptRelLuminance(fptHexToRgb(result));
    while (fptContrastRatio(newLum, bgLum) < minContrast && newL < 92) {
        newL += 3;
        result = fptHslToHex(h, newS, newL);
        newLum = fptRelLuminance(fptHexToRgb(result));
    }
    return result;
}

function fptEnsureButtonColor(hex) {
    const rgb = fptHexToRgb(hex);
    const lum = fptRelLuminance(rgb);
    if (lum >= 0.08) return hex;
    const [r, g, b] = rgb;
    const [h, s, l] = fptRgbToHsl(r, g, b);
    if (Math.max(r, g, b) <= 25 || Math.max(r, g, b) - Math.min(r, g, b) <= 16) {
        return '#3a3a46';
    }
    return fptHslToHex(h, Math.min(Math.max(s, 55), 85), Math.max(l, 38));
}

function fptSanitizeThemeColors(theme) {
    if (!theme) return theme;
    const res = { ...theme };
    if (res.bgColor2) res.bgColor2 = fptEnsureReadableColor(res.bgColor2, { minContrast: 5.0, targetLightness: 76 });
    if (res.linkColor) res.linkColor = fptEnsureReadableColor(res.linkColor, { minContrast: 4.5, targetLightness: 68 });
    if (res.textColor) res.textColor = fptEnsureReadableColor(res.textColor, { minContrast: 5.0, targetLightness: 90 });
    if (res.bgColor1) res.bgColor1 = fptEnsureButtonColor(res.bgColor1);
    return res;
}

// Сохранённой темы нет вовсе (первый запуск или сброс) - это родной вид FunPay.
// Старые темы без поля baseStyle остаются полным оформлением.
function fptResolveThemeBaseStyle(saved) {
    if (saved && (saved.baseStyle === 'original' || saved.baseStyle === 'custom')) return saved.baseStyle;
    return saved && Object.keys(saved).length ? 'custom' : 'original';
}

// Правила темы написаны для страницы FunPay и задевают голые теги (header, p, a, h5, label...).
// Без защиты они красят и наше меню: серая «подложка» под заголовком, тени у ссылок, белый текст
// в абзацах. :where() не добавляет специфичности, так что остальные правила работают как раньше.
const FPT_THEME_POPUP_GUARD = ':not(:where(.fp-tools-popup, .fp-tools-popup *))';
function fptScopeOutsidePopup(css) {
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, selectors, body) => {
        const scoped = selectors.split(',').map(selector => {
            const s = selector.trim();
            if (!s) return s;
            const pseudo = s.search(/::|:(?:before|after|first-line|first-letter)\b/);
            return pseudo === -1 ? s + FPT_THEME_POPUP_GUARD : s.slice(0, pseudo) + FPT_THEME_POPUP_GUARD + s.slice(pseudo);
        }).join(', ');
        return `${scoped} {${body}}`;
    });
}

function getOriginalThemeCss(settings) {
    const radius = `${settings.borderRadius}px`;
    let css = `
        body { font-family: '${settings.font}', Helvetica Neue, Helvetica, Arial, sans-serif; }
        .offer, .tc, .modal-content, .chat, .chat-contacts, .chat-detail, .dropdown-menu, .panel, .payment-card, .details, .form-narrow, .counter-item, .content-with-cd-wide, .btn, .form-control, .alert, .ajax-alert { border-radius: ${radius}; }
    `;
    if (settings.enableCircleCustomization) {
        css += `.cd-container .cd, .corner-cd, .profile-cover-img {
            transition: transform 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
            transform: scale(${settings.circleSize / 100});
            filter: blur(${settings.circleBlur}px);
            opacity: ${settings.circleOpacity / 100};
        }`;
        if (!settings.showCircles) css += ` .cd-container { display: none !important; }`;
    }
    if (settings.enableImprovedSeparators) {
        css += `
            .tc:not(.tc-selling):not(.tc-finance) .tc-item > div { position: relative; border-top: none !important; }
            .tc:not(.tc-selling):not(.tc-finance) .tc-item > div::before {
                content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 1px;
                background: rgba(0, 0, 0, 0.14); filter: blur(2px); pointer-events: none;
            }
        `;
    }
    if (settings.enableCustomScrollbar) {
        css += `
            ::-webkit-scrollbar { width: ${settings.scrollbarWidth}px; }
            ::-webkit-scrollbar-track { background: ${settings.scrollbarTrackColor}; }
            ::-webkit-scrollbar-thumb { background: ${settings.scrollbarThumbColor}; border-radius: ${settings.scrollbarWidth}px; }
            ::-webkit-scrollbar-thumb:hover { background: ${settings.scrollbarThumbColor}CC; }
        `;
    }
    return css;
}

function getCustomThemeCss(settings) {
    if (settings.baseStyle === 'original') return getOriginalThemeCss(settings);
    const bgImageUrl = settings.bgImage ? `url(${settings.bgImage})` : 'url(https://i.ibb.co/ZpS0d56R/PH6-UEvp-Kn-KI.jpg)';
    const containerBgRgba = hexToRgba(settings.containerBgColor, settings.containerBgOpacity);

    // Адаптивная цветокоррекция для читаемости и красоты
    const safeBgColor1 = fptEnsureButtonColor(settings.bgColor1 || DEFAULT_THEME.bgColor1);
    const safeBgColor2 = fptEnsureReadableColor(settings.bgColor2 || DEFAULT_THEME.bgColor2, { minContrast: 5.0, targetLightness: 76 });
    const safeLinkColor = fptEnsureReadableColor(settings.linkColor || DEFAULT_THEME.linkColor, { minContrast: 4.5, targetLightness: 68 });
    const safeTextColor = fptEnsureReadableColor(settings.textColor || DEFAULT_THEME.textColor, { minContrast: 5.0, targetLightness: 90 });

    const accentRgb = fptHexToRgb(safeBgColor2);
    const accentGlow = `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.35)`;
    const [accH, accS, accL] = fptRgbToHsl(accentRgb[0], accentRgb[1], accentRgb[2]);
    const accentHover = fptHslToHex(accH, accS, Math.min(accL + 10, 96));

    let baseCss = `
        body::before {
            content: ''; position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
            background: ${bgImageUrl} no-repeat center center fixed;
            background-size: cover;
            filter: blur(${settings.bgBlur}px) brightness(${settings.bgBrightness}%);
            z-index: -1;
            will-change: transform; /* Оптимизация для скролла */
            transform: translateZ(0); /* Форсируем GPU-слой */
        }
        .wrapper-content, .wrapper-footer, body, .wrapper, .content-orders, .bg-light-color #header, .bg-light-color #footer, .wrapper-footer { background: transparent !important; }
        .wrapper-content, .wrapper-footer { background-color: rgba(0,0,0,0.4) !important; }
        body { font-family: '${settings.font}', Helvetica Neue, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.428571429; color: #TEXT_COLOR# }
        .profile-cover-img { background-clip: border-box; background: url(https://funpay.com/img/layout/profile-header.jpg) no-repeat center bottom; background-size: 100% auto } .profile-cover { overflow: unset } .media-user-name { color: #TEXT_COLOR# } .media-user-name a { color: #fff } .bg-light-color { background-color: #fff0 } header { background: rgba(0,0,0,0.08) !important } .game-title a { color: #ACCENT_COLOR#; text-decoration: none; font-weight: 600; letter-spacing: 0.2px; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 10px rgba(0, 0, 0, 0.5); transition: color 0.15s ease, text-shadow 0.15s ease } .game-title a:hover { color: #ACCENT_HOVER#; text-decoration: none; text-shadow: 0 0 14px #ACCENT_GLOW#, 0 2px 4px rgba(0, 0, 0, 0.9) } .navbar-right.logged .dropdown-menu { border-radius: 8px } .user-link-name { color: #ACCENT_COLOR#; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7) } .product-page .page-content { background-color: #0009; border-radius: 10px; margin-top: 12px; margin-bottom: 20px; padding: 20px } .chat-btn-image { background-color: #ff6d1500; border: 0px; color: #fff } .chat-btn-image:hover { background-color: transparent; border: 0px; color: #fff } .chat-btn-image:focus { background-color: transparent; border: 0px; color: #fff } .btn-default:active:hover, .btn-default:active:focus, .btn-default:active.focus, .btn-default.active:hover, .btn-default.active:focus, .btn-default.active.focus { color: #fff; background-color: #ff6d1500; border: 0px } .fa-info-circle:before { filter: brightness(0) invert(1) } .chat-form-input .form-group { transform: translate(-10px); width: 103% } .tc.table-hover .tc-item.transaction-status-waiting { background-color: #b17f2e94 } .tc.table-hover .tc-item.transaction-status-waiting:hover { background-color: #b37f2abf } .tc-finance .tc-header>div, .tc-finance .tc-item>div { border-bottom: #505050 1px solid; border-top: #505050 0px solid } .tc.table-hover .tc-item.info { background-color: #1f508994 } .tc.table-hover .tc-item.info:hover { background-color: #1f5089bf } .tc.table-hover .tc-item:hover { background-color: ${containerBgRgba} } .navbar-default .navbar-nav>.active>a, .navbar-default .navbar-nav>.active>a:hover, .navbar-default .navbar-nav>.active>a:focus { color: #LINK_COLOR#; font-weight: 700; background-color: #0000 } .counter-list .counter-item { background: #14141480; border: 0px solid #feff00; border-radius: 20px; outline: 0 } .content-with-cd-wide { background: ${containerBgRgba}; border-radius: 10px } a.tc-item { color: #TEXT_COLOR#; text-decoration: none } .cd { position: relative; z-index: 100; border-radius: 50%; width: 700px; height: 700px; filter: brightness(.8); border: 0px } a.cd-satellite { transform: translate(-25px) } .offer { background: ${containerBgRgba}; padding: 20px; border-radius: 10px } .tc { background-color: ${containerBgRgba}; border-radius: 10px } .tc-finance { border-top: 0px solid #322f34; border-bottom: #322f34 0px solid; border-left: #322f34 0px solid; border-right: #322f34 0px solid; border-radius: 10px } .modal-content { background-color: ${containerBgRgba}; border: 0px solid #999; border-radius: 10px; -webkit-box-shadow: 0 3px 9px rgba(0, 0, 0, .5); box-shadow: 0 3px 9px #00000080; background-clip: padding-box; outline: 0 } label.control-label { color: #ffba4cc4 } .counter-item { background: #0b0b0b90; color: #TEXT_COLOR# } .counter-item:hover, .counter-item:focus, .counter-item:active, .counter-item:active:hover { background: #0b0b0bad; color: #TEXT_COLOR# } .counter-item.active { background: ${containerBgRgba}; color: #fff } .counter-item.active:hover, .counter-item.active:focus, .counter-item.active:active, .counter-item.active:active:hover { background: #101010; color: #fff } .form-control-box { background: transparent; border: 1px solid #fff; border-radius: 10px } h5, .h5, .form-group>label { color: #fff } .bootstrap-select .dropdown-menu.inner { background-color: #0f0f0f } .lot-field .lot-field-radio-box button { background-color: #161617; color: #fbfbfb } .lot-field .lot-field-radio-box button:hover { color: #fff; background-color: #1b1b1b } .btn-dark { background-color: #222; border-radius: 10px; border-color: #fff } .btn-gray:hover { background-color: #2a5590; color: #fff; border-radius: 10px; border-color: #2a5590 } .chat-promo { border-radius: 10px; border: 0px; background: #00000073; transform: translate(-10px) } .dropdown-menu { background-color: #0f0f0f; border-radius: 8px } .navbar-default { border-color: #e4e4e466 } .chat-form-btn .btn-round { background-color: #cbcbcb1f; color: #fff; border-radius: 100px; border: 0px } .chat-form-btn .btn-round:hover { background-color: #3466a1; color: #fff } .chat-img { border-radius: 8px } .btn-danger { border: 0px; border-radius: 8px } .btn-gray { background-color: #3466a1; border-radius: 8px; color: #fff; border: 0px } .btn-primary { border: 0px solid #fff; border-radius: 8px; background-color: #PRIMARY_COLOR#; color: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); transition: filter 0.15s ease, box-shadow 0.15s ease } .btn-primary:hover, .btn-primary:focus, .btn-primary:active, .btn-primary:active:hover, .btn-primary:active:focus, .btn-primary[disabled]:hover, .btn-primary[disabled]:focus, .btn-primary[disabled]:active, .btn-primary[disabled]:active:hover, .btn-primary[disabled]:active:focus { filter: brightness(1.18); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); color: #fff } .btn-default { border: 0px solid #fff; border-radius: 8px; background-color: #PRIMARY_COLOR#60; color: #fff } .btn-default:hover, .btn-default:focus, .btn-default:active, .btn-default:active:hover, .btn-default:active:focus, .btn-default[disabled]:hover, .btn-default[disabled]:focus, .btn-default[disabled]:active, .btn-default[disabled]:active:hover, .btn-default[disabled]:active:focus { border: 0px solid #1e4f8700; background-color: #PRIMARY_COLOR#; color: #fff } .bg-light-style .btn-default { background-color: transparent; border: 0px; color: #fff } .block-info { color: #ffffffd9 } .navbar-form .form-control { background-color: transparent } .logo-color, .footer-block-als { filter: brightness(0) invert(1) } .nav-abc .nav>li>a { color: rgba(255, 255, 255, 0.65) !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7); transition: color 0.15s ease } .nav-abc ul .active a, .nav-abc ul .active a:hover, .nav-abc ul .active a:focus, .nav-abc .nav>li>a:hover, .nav-abc .nav>li>a:focus, .nav-abc .nav>li.active>a { text-decoration: none; cursor: default; color: #ACCENT_COLOR# !important; font-weight: 700; text-shadow: 0 0 10px #ACCENT_GLOW# } a:focus { text-decoration: none; cursor: default; color: #fff } .list-inline>li>a { color: #LINK_COLOR#; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7); transition: color 0.15s ease, opacity 0.15s ease } .list-inline>li>a:hover { color: #ACCENT_COLOR#; text-decoration: underline; text-underline-offset: 2px } .list-inline>li:after { content: " ·"; color: rgba(255, 255, 255, 0.35); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) } .media-user.style-circle .avatar-photo:after { background: #a6a6a6; border: 3px solid ${containerBgRgba} } .counter-list-wide { padding-bottom: 20px; padding-top: 20px } .dropdown-menu>li+li, .dropdown-menu .dropdown-menu>li { border-top: #6a6a6a70 1px solid; border: 0px } .dropdown-menu>li:first-child>a { border-radius: 8px 8px 0 0 } .dropdown-menu>li:last-child>a { border-radius: 0 0 8px 8px } .navbar-nav>li>.dropdown-menu, .dropdown-menu, .nav-tabs .dropdown-menu { border-radius: 8px } .navbar-default .navbar-nav>li>a { color: #TEXT_COLOR# } .navbar-default .navbar-nav>li>a:hover, .navbar-default .navbar-nav>li>a:focus { color: #ddd } .ajax-alert { border-radius: 10px } .navbar-default { background-color: transparent } .offer-tc-container { border-top: #ff0000 0px solid } .tc:not(.tc-selling):not(.tc-finance) .tc-item>div { border-top: #505050 1px solid } .review-container { border-top: #505050 1px solid } a:hover { color: #ACCENT_COLOR#; text-decoration: underline; } a.tc-item:hover, a.tc-item:hover div, a.tc-item:hover .tc-desc-text, a.tc-item:hover .tc-server { color: #TEXT_COLOR#; text-decoration: none; } .panel { background-color: #423e3e } .contact-item:hover { background: #4040956b } a { color: #LINK_COLOR#; text-decoration: none; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) } .page-header, .nav-header, .lead, h5, .h5, .nav-abc-header { text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85) } a.tc-item, .tc-desc-text, .tc-server, .tc-price { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6) } .panel-default>.panel-heading { background-color: #292929; border-color: #2d2d2d61 } .tc.table-hover .tc-item.warning { background-color: #b17f2e94 } .tc.table-hover .tc-item.warning:hover { background-color: #b37f2abf } .tc.table-hover .tc-item { background-color: ${containerBgRgba} } .tc.table-hover a.tc-item:hover { background-color: #1b1b1b } .chat-not-selected .chat-message-container { border-top: 0px solid #fff } .chat-not-selected .chat-message-container { border-bottom: 0px solid #fff } .chat-message-container { border-left: 0px solid #fff; border-right: 0px solid #fff } .dropdown-menu>li>a:hover, .dropdown-menu>li>a:focus { color: #fff; background-color: #292828 } .navbar-nav>li>.dropdown-menu>.active>a { background: #LINK_COLOR#85; color: #fff } .navbar-nav>li>.dropdown-menu>.active>a:hover { background: #LINK_COLOR#b5 } .navbar-default .navbar-nav>.open>a, .navbar-default .navbar-nav>.open>a:hover, .navbar-default .navbar-nav>.open>a:focus { color: #LINK_COLOR# } .btn-default:active, .btn-default.active, .open>.btn-default.dropdown-toggle { color: #4384d0; background-color: #ff6c1130; border-color: red } .contact-item-message { color: #ffffff73 } .contact-item.active { background: #6f6dff90; color: #ffffffd4 } .contact-item.active:hover, .contact-item.active:focus { background: #6f6dffb5 } .contact-item.unread { background: #ff9d00a1 } .contact-item.unread, .contact-item.unread .contact-item-message { color: #ffffffd4 } .chat-form { border: #8924b100 0px solid } .chat-form-input .form-control, .chat-form-input .hiddendiv { padding: 11px 10px 10px; background-color: ${containerBgRgba}; border-radius: 10px } .badge { display: inline-block; min-width: 20px; padding: 3px 5px 5px; font-size: 12px; font-weight: 500; color: #fff; line-height: 12px; vertical-align: middle; white-space: nowrap; text-align: center; background-color: #0b0b0b55; border-radius: 10px } .payment-card { background: #0009; padding: 20px; border-radius: 10px; margin: 12px 0 } .form-control { border: 0px solid #fff; background-color: #060606; color: #TEXT_COLOR#; border-radius: 10px } .panel-default>.panel-heading { color: #ddd } .review-item-answer { display: inline-block; padding: 15px; background: #0f0f0f; border-radius: 10px; position: relative; color: #fff } .setting-item .btn-gray { background-color: #LINK_COLOR#; color: #fff; border-radius: 8px } .setting-item .btn-gray:hover, .setting-item .btn-gray:focus, .setting-item .btn-gray:active { background-color: #244f81; color: #fff } p { color: #ffffffd9 } .btn-success { border-radius: 8px; border: 0px } .drop-area { background-color: #1e1e1e; border-radius: 8px; color: #d3d3d3; border: 1px solid #0f0f0f } .drop-area.hover { background-color: #323232 } .drop-area.error { background: #ff3434c7; border: #f00; color: #TEXT_COLOR# } .btn-info { border-radius: 8px; background-color: #11a8d5; border: 0px; margin-right: 5px } .btn-warning { border-radius: 8px; background-color: #ffa002; border: 0px } .details, .form-narrow { background-color: #0009; padding: 20px; margin-bottom: 20px; border-radius: 10px } .form-narrow .btn-block, .form-narrow .form-control, .form-narrow .input-group { background-color: #0f0f0f; border-radius: 8px } .nav-tabs>li.active>a, .nav-tabs>li.active>a:hover, .nav-tabs>li.active>a:focus { color: #fff; background-color: #0000 } .lot-fields-multilingual .nav-tabs a { color: #b5b5b5 } table.table-clickable tbody tr a { color: #14e6a4; text-decoration: none } table.table-clickable tbody tr a:hover { color: #fff; text-decoration: underline } .caret { color: #888; } .sort::after { color: #555 !important; } .bootstrap-select .dropdown-toggle .filter-option { background: #65a91a; height: 100%; width: 100%; border: 0px #fff solid; border-radius: 8px; color: #fff } .bootstrap-select .dropdown-toggle .filter-option:hover { background: #65a91a; border-radius: 8px } .bootstrap-select .dropdown-toggle .filter-option:focus { background: #65a91a; border-radius: 8px } .has-feedback .form-control { border-radius: 8px } .withdraw-box .slave { background-color: #303030; border-radius: 8px } .withdraw-box .slave:hover { background-color: #3e3e3e; border-radius: 8px } .input-group .form-control:first-child, .input-group-addon:first-child, .input-group-btn:first-child>.btn, .input-group-btn:first-child>.btn-group>.btn, .input-group-btn:first-child>.dropdown-toggle, .input-group-btn:last-child>.btn:not(:last-child):not(.dropdown-toggle), .input-group-btn:last-child>.btn-group:not(:last-child)>.btn { border-radius: 10px 0 0 10px } .bootstrap-select.input-lg .btn, .input-group-lg>.bootstrap-select.form-control .btn, .input-group-lg>.bootstrap-select.input-group-addon .btn, .input-group-lg>.input-group-btn>.bootstrap-select.btn .btn, .bootstrap-select.input-lg .dropdown-menu>li>a, .input-group-lg>.bootstrap-select.form-control .dropdown-menu>li>a, .input-group-lg>.bootstrap-select.input-group-addon .dropdown-menu>li>a, .input-group-lg>.input-group-btn>.bootstrap-select.btn .dropdown-menu>li>a, .input-group-lg>.input-group-btn>.bootstrap-select.btn .dropdown-menu>li>a:hover, .input-group-lg>.input-group-btn>.bootstrap-select.btn .dropdown-menu>li>a:focus { background: transparent; border-radius: 8px } :not(.input-group)>.bootstrap-select.form-control:not([class*=col-]) { background: transparent; border-radius: 8px } .btn-default.dropdown-toggle { color: #fff; border: 0px; background-color: #PRIMARY_COLOR# } .btn-default.dropdown-toggle:hover, .btn-default.dropdown-toggle:focus, .btn-default.dropdown-toggle:active, .btn-default.dropdown-toggle:active:hover, .open>.btn-default.dropdown-toggle, .open>.btn-default.dropdown-toggle:hover, .open>.btn-default.dropdown-toggle:focus, .open>.btn-default.dropdown-toggle:active { color: #fff; border: 0px; background-color: #1a3d6e } .form-control[disabled], .form-control[readonly], fieldset[disabled] .form-control { background-color: #484343 } .payment-title { color: #fff; font-weight: old } .bootstrap-select .dropdown-menu>li>a { color: #b0b0b0 } .bootstrap-select .dropdown-menu>.active>a, .bootstrap-select .dropdown-menu>.active>a:hover, .bootstrap-select .dropdown-menu>.active>a:focus { background-color: #1b1b1b; color: #82dd1e } .chat-header { border: #bd59be00 0px solid } .form-inline .form-control { background-color: #0f0f0f; border-radius: 8px } .chat-contacts, .chat-detail { background: #0009; border: #fff 0px solid } .chat-contacts { border-radius: 10px 0 0 10px } .chat-detail { border-radius: 0 10px 10px 0 } .chat { background: #0009; border-radius: 10px } .contact-item { border-bottom: #fff 0px } .chat-full-header { border-bottom: #fff 0px solid } .chat-full .chat { border-bottom: 0px solid #fff; background-color: #0009; border-radius: 0 } .chat { border-top: 0px solid #fff } .alert-info { background-color: #709fdc3b; border-color: #709fdc; color: #fff !important; border-radius: 8px } .alert-info, .alert-info .chat-msg-text, .alert-info .chat-msg-text * { color: #fff !important; } .alert-info a, .alert-info .chat-msg-text a { color: #LINK_COLOR# !important; } .fa-exclamation-circle:before { filter: brightness(0) invert(1) } .chat-message-list-date .inside { background-color: #0f0f0f; color: #fff; border-radius: 8px } .custom-scroll::-webkit-scrollbar, .chat-message-list::-webkit-scrollbar, .chat-empty::-webkit-scrollbar, .chat-form-input .form-control::-webkit-scrollbar, .chat-form-input .hiddendiv::-webkit-scrollbar { background: #e600ff00; width: 5px; height: 10px } .custom-scroll::-webkit-scrollbar-thumb, .chat-message-list::-webkit-scrollbar-thumb, .chat-empty::-webkit-scrollbar-thumb, .chat-form-input .form-control::-webkit-scrollbar-thumb, .chat-form-input .hiddendiv::-webkit-scrollbar-thumb { background: #1f1f2090 } .chat { border-bottom: 0px solid #90f; background: #0009; border-radius: 10px } .chat-form-input .form-control, .chat-form-input .hiddendiv { transform: translate(-10px) } .form-inline .form-control { background-color: #171718; border-radius: 10px } .theme-select { color: #d3cfc9; background-color: #181a1b; background-image: none; border-color: #383c3f; box-shadow: #00000012 0 1px 1px inset }
    `;

    let themedCss = baseCss
        .replace(/#ff6d15/gi, safeBgColor1)
        .replace(/#PRIMARY_COLOR#/gi, safeBgColor1)
        .replace(/#f4cf78/gi, safeBgColor2)
        .replace(/#ACCENT_COLOR#/gi, safeBgColor2)
        .replace(/#ACCENT_HOVER#/gi, accentHover)
        .replace(/#ACCENT_GLOW#/gi, accentGlow)
        .replace(/#f0f0f0/gi, safeTextColor)
        .replace(/#TEXT_COLOR#/gi, safeTextColor)
        .replace(/#2d6bb3/gi, safeLinkColor)
        .replace(/#LINK_COLOR#/gi, safeLinkColor);

    themedCss = themedCss.replace(/border-radius: \d+px/g, `border-radius: ${settings.borderRadius}px`);
    themedCss = fptScopeOutsidePopup(themedCss);

    if (settings.enableCircleCustomization) {
        let circleCss = `.cd-container .cd, .corner-cd, .profile-cover-img {
            transition: transform 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
            transform: scale(${settings.circleSize / 100});
            filter: blur(${settings.circleBlur}px);
            opacity: ${settings.circleOpacity / 100};
        }`;
        if (!settings.showCircles) {
            circleCss += ` .cd-container { display: none !important; }`;
        }
        themedCss += circleCss;
    }

    if (settings.enableImprovedSeparators) {
        themedCss += `
            .tc:not(.tc-selling):not(.tc-finance) .tc-item > div {
                position: relative;
                border-top: none !important;
            }
            .tc:not(.tc-selling):not(.tc-finance) .tc-item > div::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 1px;
                background: rgba(255, 255, 255, 0.2);
                filter: blur(2px);
                pointer-events: none;
            }
        `;
    }

    if (settings.enableGlassmorphism) {
        const glassBg = hexToRgba(settings.containerBgColor, settings.containerBgOpacity);
        themedCss += `
            .offer, .tc, .modal-content, .chat-contacts, .chat-detail, .chat, .dropdown-menu, .panel, .content-with-cd-wide, .payment-card, .details, .form-narrow {
                background: ${glassBg} !important;
                backdrop-filter: blur(${settings.glassmorphismBlur}px);
                -webkit-backdrop-filter: blur(${settings.glassmorphismBlur}px);
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
        `;
    }

    if (settings.enableCustomScrollbar) {
        themedCss += `
            ::-webkit-scrollbar {
                width: ${settings.scrollbarWidth}px;
            }
            ::-webkit-scrollbar-track {
                background: ${settings.scrollbarTrackColor};
            }
            ::-webkit-scrollbar-thumb {
                background: ${settings.scrollbarThumbColor};
                border-radius: ${settings.scrollbarWidth}px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: ${settings.scrollbarThumbColor}CC; 
            }
        `;
    }

    return themedCss;
}

async function applyCustomTheme() {
    const { enableCustomTheme = false, fpToolsTheme = {} } = await chrome.storage.local.get(['enableCustomTheme', 'fpToolsTheme']);
    let styleEl = document.getElementById('fp-tools-custom-theme');
    let overrideStyleEl = document.getElementById(THEME_OVERRIDE_STYLE_ID);
    const flashFixStyle = document.getElementById('fp-tools-flash-fix');

    // Контур тексту работает независимо от кастомной темы.
    applyFptTextOutline({ ...DEFAULT_THEME, ...fpToolsTheme });

    if (!enableCustomTheme) {
        delete document.documentElement.dataset.fptThemeBg;
        document.documentElement.classList.remove('fpt-custom-theme-on');
        document.documentElement.classList.add('fpt-custom-theme-off');
        if (styleEl) styleEl.remove();
        manageFontImports({font: 'Helvetica Neue'});
        if (!overrideStyleEl) {
            overrideStyleEl = document.createElement('style');
            overrideStyleEl.id = THEME_OVERRIDE_STYLE_ID;
            document.head.appendChild(overrideStyleEl);
        }
        overrideStyleEl.textContent = `
            .fp-stats-header h1, .stat-card-value, .detail-value { color: #111 !important; }
            .stat-card-label, .detail-label { color: #555 !important; }
        `;
        if (flashFixStyle) flashFixStyle.remove();
        // Палитра --fpt-* зависит от фактического фона страницы. После выключения
        // темы фон становится светлым НЕ мгновенно, поэтому пересчитываем переменные
        // на следующих кадрах - иначе панели (статистика и пр.) останутся тёмными
        // на белой странице («чёрное окно статистики»).
        if (typeof fptApplyThemeVars === 'function') {
            requestAnimationFrame(() => { try { fptApplyThemeVars(); } catch (_) {} });
            setTimeout(() => { try { fptApplyThemeVars(); } catch (_) {} }, 120);
            setTimeout(() => { try { fptApplyThemeVars(); } catch (_) {} }, 400);
        }
        return;
    }
    
    const settings = { ...DEFAULT_THEME, ...fpToolsTheme, baseStyle: fptResolveThemeBaseStyle(fpToolsTheme) };
    const original = settings.baseStyle === 'original';

    // Обои лежат на body::before, поэтому реального «фона страницы» в DOM нет. Палитре меню и
    // фич (fptResolveBg) нужен цвет блоков темы, чтобы понять, тёмная страница или светлая.
    if (original) delete document.documentElement.dataset.fptThemeBg;
    else document.documentElement.dataset.fptThemeBg = settings.containerBgColor || DEFAULT_THEME.containerBgColor;

    if (original) {
        // Родной вид FunPay: страница светлая, поэтому остаёмся в состоянии «тема выключена».
        document.documentElement.classList.remove('fpt-custom-theme-on');
        document.documentElement.classList.add('fpt-custom-theme-off');
    } else {
        if (overrideStyleEl) overrideStyleEl.remove();
        document.documentElement.classList.add('fpt-custom-theme-on');
        document.documentElement.classList.remove('fpt-custom-theme-off');
    }

    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'fp-tools-custom-theme';
        document.head.appendChild(styleEl);
    }

    manageFontImports(settings);
    let themeCss = getCustomThemeCss(settings);
    if (!original) themeCss += ` body { visibility: visible !important; } `;
    styleEl.textContent = themeCss;
    // фон становится тёмным не мгновенно - пересчитываем палитру на след. кадрах
    if (typeof fptApplyThemeVars === 'function') {
        requestAnimationFrame(() => { try { fptApplyThemeVars(); } catch (_) {} });
        setTimeout(() => { try { fptApplyThemeVars(); } catch (_) {} }, 120);
        setTimeout(() => { try { fptApplyThemeVars(); } catch (_) {} }, 400);
    }
}

async function randomizeTheme(payload = {}) {
    const randomHex = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const fontsWithDefault = ['Helvetica Neue', ...GOOGLE_FONTS];

    const randomTheme = {
        baseStyle: 'custom',
        bgColor1: randomHex(),
        bgColor2: randomHex(),
        containerBgColor: randomHex(),
        containerBgOpacity: Math.random() * 0.8 + 0.2, 
        textColor: randomHex(),
        linkColor: randomHex(),
        font: fontsWithDefault[randomInt(0, fontsWithDefault.length - 1)],
        bgBlur: randomInt(0, 15),
        bgBrightness: randomInt(50, 120),
        borderRadius: randomInt(0, 25),
        enableCircleCustomization: Math.random() > 0.5,
        showCircles: Math.random() > 0.3,
        circleSize: randomInt(70, 130),
        circleOpacity: randomInt(20, 100),
        circleBlur: randomInt(0, 30),
        enableImprovedSeparators: Math.random() > 0.5,
        headerPosition: Math.random() > 0.5 ? 'top' : 'bottom',
        enableGlassmorphism: Math.random() > 0.5,
        glassmorphismBlur: randomInt(5, 20),
        enableCustomScrollbar: Math.random() > 0.5,
        scrollbarThumbColor: randomHex(),
        scrollbarTrackColor: randomHex(),
        scrollbarWidth: randomInt(4, 12)
    };

    // draftOnly: the replacement view keeps unapplied edits itself, so it only needs the values.
    if (payload && payload.draftOnly) return randomTheme;
    return setPopupTheme(randomTheme);
}

async function generatePaletteFromImage(payload = {}) {
    const draftOnly = !!(payload && payload.draftOnly);
    let bgImage = payload && typeof payload.dataUrl === 'string' ? payload.dataUrl : null;
    if (!bgImage) {
        const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
        bgImage = fpToolsTheme.bgImage;
    }
    if (!bgImage) {
        throw new Error('Сначала загрузите фоновое изображение.');
    }

    try {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const promise = new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                const size = 100;
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);
                
                const imageData = ctx.getImageData(0, 0, size, size).data;
                const colorMap = {};
                for (let i = 0; i < imageData.length; i += 4) {
                    if (imageData[i+3] < 128) continue; 
                    const r = Math.round(imageData[i] / 32) * 32;
                    const g = Math.round(imageData[i+1] / 32) * 32;
                    const b = Math.round(imageData[i+2] / 32) * 32;
                    const key = `${r},${g},${b}`;
                    colorMap[key] = (colorMap[key] || 0) + 1;
                }

                const sortedColors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
                
                const toHex = (rgbStr) => {
                    const [r, g, b] = rgbStr.split(',').map(Number);
                    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0')}`;
                };
                
                const getContrastColor = (hex) => {
                    const [r,g,b] = hex.match(/\w\w/g).map(x => parseInt(x,16));
                    return (r*0.299 + g*0.587 + b*0.114) > 128 ? '#111111' : '#FFFFFF';
                };

                const newPalette = {};
                if (sortedColors.length > 0) newPalette.containerBgColor = toHex(sortedColors[0][0]);
                if (sortedColors.length > 1) newPalette.bgColor1 = toHex(sortedColors[1][0]);
                if (sortedColors.length > 2) newPalette.bgColor2 = toHex(sortedColors[2][0]);
                if (sortedColors.length > 3) newPalette.linkColor = toHex(sortedColors[3][0]);
                
                if (newPalette.containerBgColor) newPalette.textColor = getContrastColor(newPalette.containerBgColor);
                
                resolve(draftOnly ? newPalette : await setPopupTheme(newPalette));
                } catch (error) { reject(error); }
            };
            img.onerror = () => { reject(new Error('Не удалось загрузить изображение для анализа.')); };
        });
        
        img.src = bgImage;
        return await promise;

    } catch (error) {
        throw error;
    }
}

async function applyFptMenuTransparency(override) {
    const popup = document.querySelector('.fp-tools-popup');
    if (!popup) return;

    let s;
    if (override) {
        s = override;
    } else {
        const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
        s = { ...DEFAULT_THEME, ...fpToolsTheme };
    }

    // Прозрачный режим отключён полностью — всегда сплошное авто-тема-меню.
    s = { ...s, menuTransparent: false };

    if (s.menuTransparent) {
        const alpha = Math.max(0, Math.min(100, parseFloat(s.menuOpacity))) / 100;
        const tintC = s.menuTintColor || DEFAULT_THEME.menuTintColor;
        popup.style.setProperty('--fpt-menu-bg', hexToRgba(tintC, alpha));
        // кнопки боковой панели - на 2% плотнее самого меню (как просил пользователь)
        popup.style.setProperty('--fpt-menu-navbtn', hexToRgba(tintC, Math.min(1, alpha + 0.02)));
        // активный пункт - заметнее, на 8% плотнее
        popup.style.setProperty('--fpt-menu-navactive', hexToRgba(tintC, Math.min(1, alpha + 0.08)));
        popup.classList.add('fpt-menu-transparent');

        // ЧИТАЕМОСТЬ: при 3% прозрачности на СВЕТЛОМ фоне (белая/выключенная тема)
        // светлый текст меню сливается. Определяем яркость фона за меню и:
        //   - на светлом фоне → тёмный текст меню + светлый скрим;
        //   - на тёмном фоне → светлый текст + тёмный скрим.
        // Скрим (var --fpt-menu-scrim) - тонкая контрастная подложка поверх блюра,
        // чтобы текст читался при любой теме, не делая меню непрозрачным.
        let lightBg = false;
        try {
            if (typeof fptResolveBg === 'function' && typeof fptLuma === 'function') {
                lightBg = fptLuma(fptResolveBg()) >= 0.5;
            }
        } catch (_) {}
        popup.classList.toggle('fpt-menu-on-light', lightBg);
        popup.classList.toggle('fpt-menu-on-dark', !lightBg);
        // скрим: на светлом - белесый, на тёмном - чёрный; даёт контраст тексту
        popup.style.setProperty('--fpt-menu-scrim', lightBg ? 'rgba(245,245,250,0.80)' : 'rgba(15,16,22,0.45)');

        if (s.menuBlurEnabled) {
            popup.style.setProperty('--fpt-menu-blur', `${parseInt(s.menuBlur, 10) || 0}px`);
            popup.classList.add('fpt-menu-blur');
        } else {
            popup.classList.remove('fpt-menu-blur');
        }
    } else {
        popup.classList.remove('fpt-menu-transparent', 'fpt-menu-blur', 'fpt-menu-on-light', 'fpt-menu-on-dark');
        popup.style.removeProperty('--fpt-menu-bg');
        popup.style.removeProperty('--fpt-menu-navbtn');
        popup.style.removeProperty('--fpt-menu-navactive');
        popup.style.removeProperty('--fpt-menu-scrim');
        popup.style.removeProperty('--fpt-menu-blur');
    }
}

// Загружает значения в контролы и навешивает обработчики.
// Из UI настраивается только ЦВЕТ; прозрачность и размытие фиксированы (дефолты).
async function applyFptTextOutline(override) {
    let s = override;
    if (!s) {
        const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
        s = { ...DEFAULT_THEME, ...fpToolsTheme };
    }
    const STYLE_ID = 'fpt-text-outline-style';
    let styleEl = document.getElementById(STYLE_ID);

    const menuTransparent = !!s.menuTransparent;

    // Контур работает ТОЛЬКО в меню FunPay Funcy и ТОЛЬКО когда включено прозрачное меню.
    if (!s.textOutlineEnabled || !menuTransparent) {
        if (styleEl) styleEl.remove();
        return;
    }
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        document.head.appendChild(styleEl);
    }
    const w = Math.max(0, parseFloat(s.textOutlineWidth) || 0);
    const c = s.textOutlineColor || '#000000';
    if (w <= 0) { if (styleEl) styleEl.textContent = ''; return; }
    // Надёжный контур через text-shadow в 8 направлений - рендерится всегда,
    // в отличие от -webkit-text-stroke (который местами не виден). Шаг = ширина.
    const o = w.toFixed(2);
    const shadow = [
        `${o}px 0 0 ${c}`, `-${o}px 0 0 ${c}`, `0 ${o}px 0 ${c}`, `0 -${o}px 0 ${c}`,
        `${o}px ${o}px 0 ${c}`, `-${o}px -${o}px 0 ${c}`, `${o}px -${o}px 0 ${c}`, `-${o}px ${o}px 0 ${c}`
    ].join(', ');
    styleEl.textContent = `
        .fp-tools-popup h1, .fp-tools-popup h2, .fp-tools-popup h3, .fp-tools-popup h4,
        .fp-tools-popup h5, .fp-tools-popup p, .fp-tools-popup span:not(.material-symbols-rounded):not(.material-icons):not(.nav-icon),
        .fp-tools-popup label, .fp-tools-popup a, .fp-tools-popup li, .fp-tools-popup small,
        .fp-tools-popup .range-label, .fp-tools-popup b, .fp-tools-popup strong, .fp-tools-popup code {
            text-shadow: ${shadow} !important;
        }
        /* у инпутов/иконок контур не нужен */
        .fp-tools-popup input, .fp-tools-popup textarea, .fp-tools-popup select,
        .fp-tools-popup .material-symbols-rounded, .fp-tools-popup .material-icons,
        .fp-tools-popup .nav-icon {
            text-shadow: none !important;
        }
    `;
}

async function setPopupTheme(patch, additionalSettings = {}) {
    const result = await window.fptPopupActions.updateSettings(['fpToolsTheme', ...Object.keys(additionalSettings)], ({ fpToolsTheme = {} }) => ({
        fpToolsTheme: { ...fpToolsTheme, ...patch }, ...additionalSettings
    }), async () => { await applyCustomTheme(); await applyHeaderPosition(); });
    return result.fpToolsTheme;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('theme', id, fn);
    register('uploadBgImageBtn', p => setPopupTheme({ bgImage: p.dataUrl }));
    register('removeBgImageBtn', async () => {
        const result = await window.fptPopupActions.updateSettings('fpToolsTheme', ({ fpToolsTheme = {} }) => {
        delete fpToolsTheme.bgImage;
        return { fpToolsTheme };
        }, applyCustomTheme);
        return result.fpToolsTheme;
    });
    const savedTheme = async () => {
        const saved = (await chrome.storage.local.get('fpToolsTheme')).fpToolsTheme;
        return { ...DEFAULT_THEME, ...saved, baseStyle: fptResolveThemeBaseStyle(saved) };
    };
    register('getThemeDefaults', () => ({ ...DEFAULT_THEME, baseStyle: 'original' }));
    register('randomizeThemeBtn', randomizeTheme);
    register('generatePaletteBtn', generatePaletteFromImage);
    register('exportThemeBtn', savedTheme);
    register('shareThemeBtn', savedTheme);
    register('importThemeBtn', async p => {
        const theme = p.theme || JSON.parse(await p.file.text());
        if (!theme?.bgColor1 || !theme.font) throw new Error('Неверный формат файла темы.');
        const sanitized = fptSanitizeThemeColors(theme);
        sanitized.baseStyle = theme.baseStyle === 'original' ? 'original' : 'custom';
        if (p.draftOnly) return sanitized;
        await window.fptPopupActions.updateSettings('fpToolsTheme', () => ({ fpToolsTheme: sanitized }),
            async () => { await applyCustomTheme(); await applyHeaderPosition(); });
        return sanitized;
    });
    register('resetThemeBtn', async () => {
        await window.fptPopupActions.removeSettings('fpToolsTheme',
            async () => { await applyCustomTheme(); await applyHeaderPosition(); });
        return { ...DEFAULT_THEME, baseStyle: 'original' };
    });
    register('enableMagicStickBtn', () => {
        initializeMagicStickStyler();
        window.fpToolsMagicStickInstance.toggle();
    });
    register('fp-apply-dark-preset', async (p = {}) => {
        const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
        const context = canvas.getContext('2d'); context.fillStyle = '#1a1a1a'; context.fillRect(0, 0, 2, 2);
        const preset = { baseStyle: 'custom', bgImage: canvas.toDataURL('image/png'),
            bgColor1: '#0a0a0a', bgColor2: '#222222', containerBgColor: '#111111', textColor: '#cccccc', linkColor: '#888888' };
        if (p.draftOnly) return preset;
        return setPopupTheme(preset, { enableCustomTheme: true });
    });
}

