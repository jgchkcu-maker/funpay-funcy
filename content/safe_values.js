(function (root, factory) {
    const api = factory();
    root.FPTSafe = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, function () {
    'use strict';
    function funpayUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && url.hostname === 'funpay.com' && !url.username && !url.password && !url.port ? url.href : '';
        } catch (_) { return ''; }
    }
    function cssNumber(value, min, max, fallback) {
        const n = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }
    function fontName(value) {
        return typeof value === 'string' && /^[\p{L}\p{N} _-]{1,60}$/u.test(value) ? value : '';
    }
    function cssImageUrl(value) {
        if (typeof value !== 'string' || /[\x00-\x1f\x7f<>]/.test(value)) return '';
        try {
            const u = new URL(value);
            if (u.protocol !== 'https:' && !/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return '';
            return 'url("' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
        } catch (_) { return ''; }
    }
    function cssDeclarations(map) {
        if (!map || typeof map !== 'object' || Array.isArray(map)) return '';
        let css = '';
        for (const [selector, declarations] of Object.entries(map)) {
            if (!selector || /[{}<>\\\x00-\x1f@]/.test(selector) || !declarations || typeof declarations !== 'object' || Array.isArray(declarations)) continue;
            const lines = [];
            for (const [property, value] of Object.entries(declarations)) {
                if (!/^-?[a-z][a-z-]*$/.test(property) || !['string', 'number'].includes(typeof value)) continue;
                const s = String(value);
                // Parse complete URL tokens first, then validate the CSS around them.
                // Rebuild every image token ourselves so quotes cannot end the declaration.
                const urlToken = /^url\s*\(\s*(?:"([^"\\\x00-\x1f]*)"|'([^'\\\x00-\x1f]*)'|([^\s()"'\\\x00-\x1f]*))\s*\)/i;
                let invalid = false;
                let remaining = '', safeValue = '';
                for (let i = 0; i < s.length;) {
                    if (s[i] === '"' || s[i] === "'") {
                        // Literal strings are never URL tokens. Escapes remain forbidden.
                        let end = i + 1;
                        while (end < s.length && s[end] !== s[i]) {
                            if (s[end] === '\\') { invalid = true; break; }
                            end++;
                        }
                        if (invalid || end === s.length) { invalid = true; break; }
                        const literal = s.slice(i, end + 1);
                        remaining += literal; safeValue += literal; i = end + 1;
                        continue;
                    }
                    const token = (i === 0 || !/[\w-]/.test(s[i - 1])) ? s.slice(i).match(urlToken) : null;
                    if (token) {
                        const value = token[1] ?? token[2] ?? token[3];
                        let image = '';
                        try { if (new URL(value).protocol === 'https:') image = cssImageUrl(value); } catch (_) {}
                        if (!image) { invalid = true; break; }
                        remaining += ' '; safeValue += image; i += token[0].length;
                    } else {
                        remaining += s[i]; safeValue += s[i]; i++;
                    }
                }
                if (invalid || /[{};\\<>\x00-\x1f]/.test(remaining) || /url\s*\(|@import|expression\s*\(|\/\*|\*\//i.test(remaining)) continue;
                lines.push(`  ${property}: ${safeValue} !important;\n`);
            }
            if (lines.length) css += `${selector} {\n${lines.join('')}}\n`;
        }
        return css;
    }
    function csvCell(value) {
        let s = String(value == null ? '' : value);
        if (/^[\s]*[=@]/.test(s) || /^[\t\r\n]/.test(s) || (/^[\s]*[+-]/.test(s) && !/^[+-]?\d[\d\s.,]*$/.test(s))) s = "'" + s;
        return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function themeSettings(value) {
        const settings = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
        const numbers = {
            bgBlur: [0, 100, 0], bgBrightness: [0, 200, 100], borderRadius: [0, 100, 8],
            containerBgOpacity: [0, 1, 1], circleSize: [0, 300, 100], circleOpacity: [0, 100, 100],
            circleBlur: [0, 100, 0], glassmorphismBlur: [0, 100, 10], scrollbarWidth: [0, 40, 8],
            menuOpacity: [0, 100, 3], menuBlur: [0, 100, 8], textOutlineWidth: [0, 10, 1]
        };
        const colors = { bgColor1: '#ff6d15', bgColor2: '#f4cf78', containerBgColor: '#0b0b0b',
            textColor: '#f0f0f0', linkColor: '#2d6bb3', scrollbarThumbColor: '#555555',
            scrollbarTrackColor: '#222222', menuTintColor: '#2a1033', textOutlineColor: '#000000', buttonColor: '', buttonActiveColor: '' };
        for (const [key, args] of Object.entries(numbers)) if (Object.hasOwn(settings, key)) settings[key] = cssNumber(settings[key], ...args);
        for (const [key, fallback] of Object.entries(colors)) if (Object.hasOwn(settings, key)) {
            const color = String(settings[key] ?? '').trim();
            settings[key] = /^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? (color.startsWith('#') ? color : '#' + color) : fallback;
        }
        if (Object.hasOwn(settings, 'font')) settings.font = fontName(settings.font) || 'Helvetica Neue';
        if (Object.hasOwn(settings, 'bgImage')) settings.bgImage = cssImageUrl(settings.bgImage) ? settings.bgImage : '';
        return settings;
    }
    return { funpayUrl, cssNumber, fontName, cssImageUrl, cssDeclarations, csvCell, themeSettings };
});
