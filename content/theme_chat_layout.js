// content/theme_chat_layout.js
// «Модульный чат»: список диалогов, переписка и инфо-панель на /chat/ - отдельными карточками
// с отступом, своими закруглениями и шириной колонок. Грузится на document_start: theme_flash_fix.js
// ставит раннюю копию правил (в обоих стилях темы), чтобы склеенная раскладка не мелькала.
// theme.js добавляет те же правила в стиль темы, chat_column_resize.js тянет ширину мышкой.
(function (root) {
    'use strict';

    const PREHIDE_STYLE_ID = 'fp-tools-chat-layout-prehide';
    // [min, max, default] - те же диапазоны, что в FPTSafe.themeSettings.
    const LIMITS = {
        chatModuleGap: [0, 40, 12],
        chatContactsWidth: [220, 480, 280],
        chatDetailWidth: [200, 420, 280]
    };
    // Переписке всегда остаётся хотя бы столько места - ручки и CSS не дают её сжать сильнее.
    const CHAT_MIN_WIDTH = 360;
    // FunPay на ≤767px переключает чат в мобильный вид (одна колонка), там модули не нужны.
    const DESKTOP_MEDIA = '(min-width: 768px)';
    // Рамка колонок FunPay в оригинальном виде (.chat-contacts, .chat-detail, .chat-header).
    const ORIGINAL_BORDER = '1px solid #eaeaea';

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
    }

    function fptChatLayoutValue(settings, key) {
        const [min, max, fallback] = LIMITS[key];
        return clampNumber(settings && settings[key], min, max, fallback);
    }

    function fptThemeChatLayoutCss(settings) {
        if (!settings || settings.chatModular !== true) return '';
        const gap = fptChatLayoutValue(settings, 'chatModuleGap');
        const contacts = fptChatLayoutValue(settings, 'chatContactsWidth');
        const detail = fptChatLayoutValue(settings, 'chatDetailWidth');
        const radius = clampNumber(settings.borderRadius, 0, 100, 16);
        // Без baseStyle (старые темы) - 'custom', как в fptResolveThemeBaseStyle.
        const original = settings.baseStyle === 'original';
        // Между .chat-contacts и .chat у FunPay лежит пустой .js-chat-top, поэтому отступ - margin
        // у крайних колонок, а не gap контейнера (иначе слева он удвоился бы).
        let css = ` :root { --fpt-chat-gap: ${gap}px; --fpt-chat-contacts-w: ${contacts}px; --fpt-chat-detail-w: ${detail}px; }
        @media ${DESKTOP_MEDIA} {
            .chat-full > .chat-contacts, .chat-full > .chat, .chat-full > .chat-detail { border-radius: ${radius}px !important; }
            .chat-full > .chat-contacts { flex: 0 1 var(--fpt-chat-contacts-w); width: auto; min-width: ${LIMITS.chatContactsWidth[0]}px; max-width: none; margin-right: var(--fpt-chat-gap); }
            .chat-full > .chat { flex: 1 1 0; width: auto; min-width: ${CHAT_MIN_WIDTH}px; max-width: none; }
            .chat-full > .chat-detail { flex: 0 1 var(--fpt-chat-detail-w); width: auto; min-width: ${LIMITS.chatDetailWidth[0]}px; max-width: none; margin-left: var(--fpt-chat-gap); }
            .chat-full > .chat .chat-header { border-radius: ${radius}px ${radius}px 0 0; }
            .chat-full > .chat .chat-form { border-radius: 0 0 ${radius}px ${radius}px; }`;
        // FunPay снимает рамку на стыках (border-right у списка, border-left у панели) - у
        // отдельных карточек она нужна со всех сторон. В «Своей» теме рамки задаёт сама тема.
        if (original) {
            css += `
            .chat-full > .chat-contacts { border-right: ${ORIGINAL_BORDER}; }
            .chat-full > .chat-detail { border-left: ${ORIGINAL_BORDER}; }`;
        }
        css += `
        }`;
        if (settings.chatHideDetail === true) css += ' .chat-full > .chat-detail { display: none !important; }';
        return css;
    }

    // Ранняя копия правил. theme.js убирает её, когда пишет полный стиль темы; ручки ширины
    // ставят её заново после перетаскивания, чтобы не пересобирать всю тему.
    function fptInjectChatLayoutPrehide(settings) {
        const css = fptThemeChatLayoutCss(settings);
        let style = document.getElementById(PREHIDE_STYLE_ID);
        if (!css) { if (style) style.remove(); return; }
        if (!style) {
            style = document.createElement('style');
            style.id = PREHIDE_STYLE_ID;
            document.documentElement.appendChild(style);
        }
        style.textContent = css;
    }

    function fptRemoveChatLayoutPrehide() {
        const style = document.getElementById(PREHIDE_STYLE_ID);
        if (style) style.remove();
    }

    root.fptThemeChatLayoutCss = fptThemeChatLayoutCss;
    root.fptInjectChatLayoutPrehide = fptInjectChatLayoutPrehide;
    root.fptRemoveChatLayoutPrehide = fptRemoveChatLayoutPrehide;
    root.FPTChatLayout = { LIMITS, CHAT_MIN_WIDTH, DESKTOP_MEDIA, value: fptChatLayoutValue };
})(typeof globalThis !== 'undefined' ? globalThis : this);
