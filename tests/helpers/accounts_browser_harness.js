const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

// Opens the popup on the accounts page. The fake background holds one session cookie (qaSession),
// answers snapshots from qaSnapshots and records every message in qaMessages.
async function openAccounts(browser, initial = {}, {
    dark = true, width = 1480, height = 930, failFirstRead = false,
    session = '', userName = '', snapshots = {}, switchReply = { success: true }
} = {}) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname.slice(1);
        if (/^(icons|fonts)\/[\w.-]+$/.test(pathname) && fs.existsSync(path.join(root, pathname))) return route.fulfill({ path: path.join(root, pathname) });
        return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html${dark ? ' class="fpt-theme-dark"' : ''}><head></head><body style="background:${dark ? '#18191d' : '#f2f3f5'}"></body></html>`);
    await page.evaluate(({ initial, failFirstRead, session, userName, snapshots, switchReply }) => {
        if (userName) {
            const link = document.createElement('a');
            link.className = 'user-link-name';
            link.textContent = userName;
            link.hidden = true;
            document.body.append(link);
        }
        let stored = structuredClone(initial);
        let failRead = failFirstRead;
        const listeners = [];
        const pick = keys => {
            if (keys == null) return structuredClone(stored);
            const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
            return Object.fromEntries(list.filter(key => Object.hasOwn(stored, key)).map(key => [key, structuredClone(stored[key])]));
        };
        const emit = changes => listeners.slice().forEach(fn => fn(changes, 'local'));
        window.qaSession = session;
        window.qaSnapshots = snapshots;
        window.qaSwitchReply = switchReply;
        window.qaMessages = [];
        window.qaStorage = {
            read: () => structuredClone(stored),
            listeners: () => listeners.length,
            external(patch) {
                const changes = {};
                for (const [key, value] of Object.entries(patch)) {
                    changes[key] = { oldValue: stored[key], newValue: structuredClone(value) };
                    stored[key] = structuredClone(value);
                }
                emit(changes);
            }
        };
        window.chrome = {
            storage: {
                local: {
                    async get(keys) {
                        if (failRead && Array.isArray(keys) && keys.includes('fpToolsAccounts')) { failRead = false; throw new Error('Хранилище недоступно'); }
                        return pick(keys);
                    },
                    async set(values) {
                        const changes = {};
                        for (const [key, value] of Object.entries(values)) {
                            changes[key] = { oldValue: stored[key], newValue: structuredClone(value) };
                            stored[key] = structuredClone(value);
                        }
                        emit(changes);
                    },
                    async remove(keys) { [].concat(keys).forEach(key => delete stored[key]); }
                },
                onChanged: {
                    addListener(fn) { listeners.push(fn); },
                    removeListener(fn) { const index = listeners.indexOf(fn); if (index >= 0) listeners.splice(index, 1); }
                }
            },
            runtime: {
                id: 'qa', getURL: file => `https://funpay.com/${file}`,
                async sendMessage(message) {
                    window.qaMessages.push(message);
                    if (message.action === 'getGoldenKey') return window.qaSession ? { success: true, key: window.qaSession } : { success: false };
                    if (message.action === 'setGoldenKey') {
                        if (window.qaSwitchReply?.success) window.qaSession = message.key;
                        return window.qaSwitchReply;
                    }
                    if (message.action === 'getAccountSnapshot') {
                        const snapshot = window.qaSnapshots[message.key];
                        if (window.qaSnapshotDelay) await new Promise(resolve => setTimeout(resolve, window.qaSnapshotDelay));
                        return snapshot ? { ok: true, snapshot } : { ok: false, error: 'no snapshot' };
                    }
                    return { success: true };
                }
            }
        };
    }, { initial, failFirstRead, session, userName, snapshots, switchReply });
    for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css', 'css/popup_categories.css']) await page.addStyleTag({ path: path.join(root, file) });
    for (const file of ['content/ui/popup_metadata.js', 'content/ui/popup_actions.js', 'content/ui/popup_attachments.js',
        'content/ui/popup_components.js', 'content/ui/main_popup.js', 'content/features/accounts.js', 'content/ui/accounts_page.js']) {
        await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(async () => {
        const popup = createMainPopup(); document.body.append(popup);
        window.FPTPopupUI.observePopupControls(popup);
        popup.classList.add('active'); popup.style.width = `${Math.min(1440, innerWidth - 24)}px`; popup.style.height = `${innerHeight - 28}px`;
        setupNavigationSections(popup);
        setupPopupPageModes(popup);
        await window.FPTAccountsPage.mount(popup);
        await window.fptOpenPopupPage('accounts');
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
            .map(animation => animation.finished.catch(() => {})));
    });
    return {
        page, errors,
        state: () => page.evaluate(() => window.qaStorage.read()),
        messages: () => page.evaluate(() => window.qaMessages),
        external: patch => page.evaluate(value => window.qaStorage.external(value), patch)
    };
}
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
module.exports = { openAccounts, launch };
