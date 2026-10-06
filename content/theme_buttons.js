// content/theme_buttons.js
// Colours of FunPay's own buttons under the custom theme: regular ones (.btn-gray - chat search,
// the "..." menu, settings buttons) and "on"/success ones (.btn-success - "Включены оповещения").
// Loaded at document_start so both theme_flash_fix.js and theme.js append the same rules.
// An empty colour means "auto": it is derived from the theme palette, so every existing theme set
// (catalogue themes, presets, random themes - none of them have these fields) gets matching buttons.
(function (root) {
    'use strict';

    function hexToRgb(hex) {
        let value = String(hex || '').trim().replace('#', '');
        if (value.length === 3) value = value.split('').map(c => c + c).join('');
        if (value.length === 8) value = value.slice(0, 6);
        const num = parseInt(value, 16);
        if (value.length !== 6 || Number.isNaN(num)) return null;
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    function rgbToHex(rgb) {
        return '#' + rgb.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
    }
    function mix(a, b, t) { return a.map((c, i) => c + (b[i] - c) * t); }
    function luminance(rgb) {
        const [r, g, b] = rgb.map(c => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function contrast(a, b) {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    }
    const WHITE = [255, 255, 255];
    const BLACK = [0, 0, 0];

    // A button colour must stay visible on the theme's dark blocks: too dark ones are lifted.
    function visible(rgb, minLum) {
        let out = rgb;
        for (let i = 0; i < 12 && luminance(out) < minLum; i++) out = mix(out, WHITE, 0.08);
        return out;
    }
    function variant(rgb) {
        // White text like the theme's primary buttons; dark only on light colours where white would fade.
        const text = contrast(WHITE, rgb) >= 2.6 ? WHITE : [22, 24, 29];
        const hover = luminance(rgb) > 0.5 ? mix(rgb, BLACK, 0.1) : mix(rgb, WHITE, 0.12);
        return { bg: rgbToHex(rgb), hover: rgbToHex(hover), text: rgbToHex(text) };
    }

    function fptResolveButtonColors(settings = {}) {
        const primary = hexToRgb(settings.bgColor1) || [255, 109, 21];
        const block = hexToRgb(settings.containerBgColor) || [11, 11, 11];
        const custom = hexToRgb(settings.buttonColor);
        const customActive = hexToRgb(settings.buttonActiveColor);
        // Auto regular: the block colour tinted with the main colour - secondary, but in the theme.
        const regular = custom || visible(mix(block, primary, 0.38), 0.045);
        // Auto active: the main colour of the theme (what primary buttons already use).
        const active = customActive || visible(primary, 0.08);
        return {
            regular: variant(regular),
            active: variant(active),
            customRegular: !!custom,
            customActive: !!customActive
        };
    }

    // `onlyCustom` - for the "original FunPay" base style: native colours stay unless set explicitly.
    function fptThemeButtonsCss(settings = {}, { onlyCustom = false } = {}) {
        const c = fptResolveButtonColors(settings);
        let css = '';
        if (!onlyCustom || c.customRegular) {
            const { bg, hover, text } = c.regular;
            css += `
            .btn-gray, .setting-item .btn-gray, .chat-header-controls .btn-gray, .chat-header-controls .dropdown-toggle,
            html body.funpay-redesigned .chat-header .chat-header-controls .chat-control {
                background-color: ${bg} !important; border-color: ${bg} !important; color: ${text} !important;
            }
            .btn-gray:hover, .btn-gray:focus, .btn-gray:active, .btn-gray.active, .open > .btn-gray.dropdown-toggle,
            .setting-item .btn-gray:hover, .setting-item .btn-gray:focus, .setting-item .btn-gray:active,
            .chat-header-controls .btn-gray:hover, .chat-header-controls .dropdown-toggle:hover,
            .chat-header-controls .open > .dropdown-toggle, .chat-form-btn .btn-round:hover,
            html body.funpay-redesigned .chat-header .chat-header-controls .chat-control:hover {
                background-color: ${hover} !important; border-color: ${hover} !important; color: ${text} !important;
            }
            .btn-gray .material-symbols-rounded, .chat-header-controls .btn-gray .fa { color: inherit !important; }
            `;
        }
        if (!onlyCustom || c.customActive) {
            const { bg, hover, text } = c.active;
            css += `
            .btn-success, .chat-header-controls .btn-success {
                background-color: ${bg} !important; border-color: ${bg} !important; color: ${text} !important;
            }
            .btn-success:hover, .btn-success:focus, .btn-success:active, .btn-success.active,
            .btn-success:active:hover, .btn-success:active:focus, .open > .btn-success.dropdown-toggle {
                background-color: ${hover} !important; border-color: ${hover} !important; color: ${text} !important;
            }
            `;
        }
        return css;
    }

    root.fptResolveButtonColors = fptResolveButtonColors;
    root.fptThemeButtonsCss = fptThemeButtonsCss;
})(typeof window !== 'undefined' ? window : globalThis);
