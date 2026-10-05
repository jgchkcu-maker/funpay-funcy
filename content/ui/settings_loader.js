// content/ui/settings_loader.js

let fpToolsAccounts = [];
let aiModeActive = false;

function getPopupViewportLimits() {
    const winW = Math.max(1, window.innerWidth || 1);
    const winH = Math.max(1, window.innerHeight || 1);

    const maxWidth = Math.max(1, Math.min(1320, Math.floor(winW * 0.94)));
    const maxHeight = Math.max(1, Math.min(780, Math.floor(winH * 0.90)));

    const minWidth = Math.min(760, maxWidth);
    const minHeight = Math.min(560, maxHeight);

    return {
        winW,
        winH,
        maxWidth,
        maxHeight,
        minWidth,
        minHeight,
        defaultWidth: maxWidth,
        defaultHeight: maxHeight
    };
}

function applyResponsivePopupGeometry(toolsPopup) {
    if (!toolsPopup) return;
    const limits = getPopupViewportLimits();
    toolsPopup.style.width = `${limits.defaultWidth}px`;
    toolsPopup.style.height = `${limits.defaultHeight}px`;
    toolsPopup.style.left = '';
    toolsPopup.style.top = '';
    toolsPopup.classList.remove('no-transform');
}

// Internal geometry helpers are exposed to the popup runtime and browser tests.
window.getPopupViewportLimits = getPopupViewportLimits;
window.applyResponsivePopupGeometry = applyResponsivePopupGeometry;


async function loadSavedSettings() {
    window.__fptAutoReplySettingsReady = false;
    const settings = await chrome.storage.local.get(null);
    fpToolsAccounts = settings.fpToolsAccounts || [];
    aiModeActive = settings.aiModeActive === true;
    if (typeof loadTemplateSettings === 'function') await loadTemplateSettings();
    const logoutLink = document.querySelector('.menu-item-logout');
    if(logoutLink && !document.querySelector('.fp-tools-logout-clean')) {
        const cleanLogoutItem = document.createElement('li');
        cleanLogoutItem.innerHTML = `<a href="#" class="fp-tools-logout-clean" style="color: #ff6b6b !important;">Выйти (очистить куки)</a>`;
        logoutLink.parentElement.insertAdjacentElement('afterend', cleanLogoutItem);
        cleanLogoutItem.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({ action: 'deleteCookiesAndReload' });
        });
    }

    const popup = document.querySelector('.fp-tools-popup');
    if (popup) applyResponsivePopupGeometry(popup);
    window.__fptPopupSettings = settings;
    window.__fptAutoReplySettingsReady = true;
    return settings;
}
