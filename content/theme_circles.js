// content/theme_circles.js
// Декоративные круги FunPay: большой круг на главной (.cd-container) и круг-обложка в шапке
// профиля (.profile-cover-container). Грузится на document_start, чтобы theme_flash_fix.js
// применил настройки до первой отрисовки - иначе при переходе главная ⇄ профиль круг успевал
// мелькнуть (theme.js приходит только на document_idle). theme.js добавляет те же правила.
(function (root) {
    'use strict';

    const PREHIDE_STYLE_ID = 'fp-tools-circles-prehide';

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    function fptThemeCirclesCss(settings) {
        if (!settings) return '';
        if (settings.showCircles !== true) {
            return ' .cd-container, .profile-cover-container { display: none !important; }';
        }
        if (!settings.enableCircleCustomization) return '';
        const size = clampNumber(settings.circleSize, 50, 150, 100);
        const opacity = clampNumber(settings.circleOpacity, 0, 100, 100);
        const blur = clampNumber(settings.circleBlur, 0, 50, 0);
        return ` .cd-container .cd, .corner-cd, .profile-cover-img {
            transition: transform 0.3s ease, filter 0.3s ease, opacity 0.3s ease;
            transform: scale(${size / 100});
            filter: blur(${blur}px);
            opacity: ${opacity / 100};
        }`;
    }

    // Ранняя копия правил кругов. theme.js убирает её, когда пишет полный стиль темы.
    function fptInjectCirclesPrehide(settings) {
        const css = fptThemeCirclesCss(settings);
        let style = document.getElementById(PREHIDE_STYLE_ID);
        if (!css) { if (style) style.remove(); return; }
        if (!style) {
            style = document.createElement('style');
            style.id = PREHIDE_STYLE_ID;
            document.documentElement.appendChild(style);
        }
        style.textContent = css;
    }

    function fptRemoveCirclesPrehide() {
        const style = document.getElementById(PREHIDE_STYLE_ID);
        if (style) style.remove();
    }

    root.fptThemeCirclesCss = fptThemeCirclesCss;
    root.fptInjectCirclesPrehide = fptInjectCirclesPrehide;
    root.fptRemoveCirclesPrehide = fptRemoveCirclesPrehide;
})(typeof globalThis !== 'undefined' ? globalThis : this);
