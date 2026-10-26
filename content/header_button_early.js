// content/header_button_early.js
// Кнопка «Funcy» в шапке появляется сразу, пока страница ещё разбирается: раньше её
// вставлял content_script.js на document_idle, и пункты шапки заметно сдвигались после
// отрисовки. Здесь только разметка и сохранённый размер/прозрачность; обработчики кликов
// навешивает content_script.js (addFpToolsButton) на уже готовую кнопку.
(function () {
    'use strict';

    const BUTTON_ID = 'fpToolsButton';
    const STYLE_ID = 'fp-tools-header-button-styles';
    const ANCHOR_SELECTOR = '.nav.navbar-nav.navbar-right.logged .user-link[data-toggle="dropdown"]';

    function insertButton() {
        if (document.getElementById(BUTTON_ID)) return true;
        const anchor = document.querySelector(ANCHOR_SELECTOR)?.parentElement;
        if (!anchor) return false;
        const item = document.createElement('li');
        const button = document.createElement('a');
        button.id = BUTTON_ID;
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.setAttribute('aria-label', 'Открыть Funcy');
        button.setAttribute('aria-expanded', 'false');
        button.title = 'Funcy';
        const logo = document.createElement('span');
        logo.className = 'fpt-logo-btn';
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icons/icon128.png');
        icon.alt = '';
        icon.width = 34;
        icon.height = 34;
        icon.draggable = false;
        logo.appendChild(icon);
        button.appendChild(logo);
        item.appendChild(button);
        anchor.insertAdjacentElement('afterend', item);
        return true;
    }

    if (!insertButton()) {
        const observer = new MutationObserver(() => { if (insertButton()) observer.disconnect(); });
        observer.observe(document.documentElement || document, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', () => { insertButton(); observer.disconnect(); }, { once: true });
    }

    // Тот же стиль, что пишет header_button_styler.js (applyButtonStyles) - он потом перезапишет его по id.
    try {
        chrome.storage.local.get('fpToolsHeaderButtonStyles').then(data => {
            const saved = (data && data.fpToolsHeaderButtonStyles) || {};
            const number = (value, min, max, fallback) => {
                const n = Number(value);
                return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
            };
            const size = number(saved.size, 12, 24, 14);
            const opacity = number(saved.opacity, 10, 100, 100);
            if (size === 14 && opacity === 100) return;
            if (document.getElementById(STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = `#${BUTTON_ID} { font-size: ${size}px !important; opacity: ${opacity / 100} !important; }`;
            document.documentElement.appendChild(style);
        }).catch(() => {});
    } catch (_) { /* storage недоступен - стиль применит header_button_styler.js */ }
})();
