document.addEventListener('DOMContentLoaded', async function () {

    // ─── Version ────────────────────────────────────────────────────
    let version = '3.0';
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
            const manifest = chrome.runtime.getManifest();
            version = manifest?.version || version;
            const versionEl = document.getElementById('version-display');
            const footerVerEl = document.getElementById('footer-version');
            if (versionEl)   versionEl.textContent   = `v${version}`;
            if (footerVerEl) footerVerEl.textContent  = version;
        }
    } catch (_) {}

    // ─── Theme sync ──────────────────────────────────────────────────
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['enableCustomTheme', 'fpToolsTheme'], (data) => {
                const isCustomTheme = data?.enableCustomTheme === true;
                const theme = data?.fpToolsTheme || {};
                let isLight = false;
                if (!isCustomTheme) {
                    isLight = true;
                } else {
                    const bg = theme.containerBgColor || '#0b0b0b';
                    const hex = bg.replace('#', '');
                    if (hex.length === 6) {
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        isLight = (0.2126 * r + 0.7152 * g + 0.0722 * b) >= 127.5;
                    }
                }
                document.body.classList.toggle('light-theme', isLight);
                document.body.classList.toggle('dark-theme', !isLight);
                document.documentElement.classList.toggle('light-theme', isLight);
                document.documentElement.classList.toggle('dark-theme', !isLight);
            });
        }
    } catch (_) {}

    // ─── Status dot: check if FunPay tab is open + user is logged in ─
    const statusDot = document.getElementById('status-dot');
    try {
        if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
            chrome.tabs.query({ url: 'https://funpay.com/*' }, (tabs) => {
                if (tabs.length > 0) {
                    statusDot?.classList.add('online');
                    if (statusDot) statusDot.title = 'FunPay открыт';
                } else {
                    statusDot?.classList.add('offline');
                    if (statusDot) statusDot.title = 'FunPay не открыт';
                }
            });
        }
    } catch (_) {}

    // ─── Quick stats ─────────────────────────────────────────────────
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fpToolsAutoReplies', 'autoBumpEnabled'], (data) => {
                const autoReplies = data?.fpToolsAutoReplies || {};
                const anyAR = autoReplies.greetingEnabled
                    || autoReplies.keywordsEnabled
                    || autoReplies.autoReviewEnabled
                    || autoReplies.bonusForReviewEnabled;

                const statsSection = document.getElementById('quickStats');
                const arEl  = document.getElementById('statAutoReply');
                const abEl  = document.getElementById('statAutoBump');

                if (statsSection) statsSection.style.display = 'flex';

                if (arEl) {
                    arEl.textContent = anyAR ? 'Включены' : 'Выключены';
                    arEl.className   = 'stat-value ' + (anyAR ? 'on' : 'off');
                }
                if (abEl) {
                    abEl.textContent = data?.autoBumpEnabled ? 'Включено' : 'Выключено';
                    abEl.className   = 'stat-value ' + (data?.autoBumpEnabled ? 'on' : 'off');
                }
            });
        }
    } catch (_) {}

    // ─── CTA button ──────────────────────────────────────────────────
    document.getElementById('goToFunPayBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
                chrome.tabs.query({ url: 'https://funpay.com/*' }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.update(tabs[0].id, { active: true });
                        chrome.windows.update(tabs[0].windowId, { focused: true });
                    } else {
                        chrome.tabs.create({ url: 'https://funpay.com/' });
                    }
                    window.close();
                });
            }
        } catch (_) {}
    });

    // ─── Review ──────────────────────────────────────────────────────
    document.getElementById('reviewBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/funpay-tools/pibmnjjfpojnakckilflcboodkndkibb/reviews' });
                window.close();
            }
        } catch (_) {}
    });

    // ─── Changelog toggle ────────────────────────────────────────────
    const changelogPanel = document.getElementById('changelog-panel');
    document.getElementById('changelogBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (changelogPanel) {
            const isVisible = changelogPanel.style.display !== 'none';
            changelogPanel.style.display = isVisible ? 'none' : 'block';
        }
    });

    document.getElementById('changelog-close')?.addEventListener('click', () => {
        if (changelogPanel) changelogPanel.style.display = 'none';
    });

    // Auto-show changelog once for new version
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get('fpToolsLastSeenVersion', ({ fpToolsLastSeenVersion } = {}) => {
                if (fpToolsLastSeenVersion !== version) {
                    if (changelogPanel) changelogPanel.style.display = 'block';
                    chrome.storage.local.set({ fpToolsLastSeenVersion: version });
                }
            });
        }
    } catch (_) {}
});
