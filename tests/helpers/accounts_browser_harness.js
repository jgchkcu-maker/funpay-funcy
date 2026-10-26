const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

// Opens the popup on the accounts page with the real background service (background/accounts_service.js)
// running in the page: chrome.runtime.sendMessage goes straight to it. FunPay is faked by qaUsers
// (session key -> { id, name }; a missing key is an expired session), qaSession (the golden_key cookie)
// and qaSnapshots (key -> snapshot). Every message is recorded in qaMessages.
async function openAccounts(browser, initial = {}, {
    dark = true, width = 1480, height = 930, failFirstRead = false,
    session = '', userName = '', users = null, snapshots = {}, automation = false, profiles = {}
} = {}) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname.slice(1);
        if (/^(icons|fonts)\/[\w.-]+$/.test(pathname) && fs.existsSync(path.join(root, pathname))) return route.fulfill({ path: path.join(root, pathname) });
        if (/^background\/[\w.-]+\.js$/.test(pathname) && fs.existsSync(path.join(root, pathname))) {
            return route.fulfill({ path: path.join(root, pathname), contentType: 'text/javascript' });
        }
        return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html${dark ? ' class="fpt-theme-dark"' : ''}><head></head><body style="background:${dark ? '#18191d' : '#f2f3f5'}"></body></html>`);
    const qaUsers = users || (session && userName ? { [session]: { id: '1', name: userName } } : {});
    await page.evaluate(({ initial, failFirstRead, session, userName, qaUsers, snapshots, automation, profiles }) => {
        if (userName) {
            const link = document.createElement('a');
            link.className = 'user-link-name';
            link.textContent = userName;
            link.hidden = true;
            document.body.append(link);
        }
        let stored = structuredClone(initial);
        const listeners = [];
        const pick = keys => {
            if (keys == null) return structuredClone(stored);
            const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
            return Object.fromEntries(list.filter(key => Object.hasOwn(stored, key)).map(key => [key, structuredClone(stored[key])]));
        };
        const emit = changes => { if (Object.keys(changes).length) listeners.slice().forEach(fn => fn(changes, 'local')); };
        window.qaSession = session;
        window.qaUsers = qaUsers;
        window.qaSnapshots = snapshots;
        window.qaAutomation = automation;
        window.qaProfiles = profiles;
        window.qaMessages = [];
        window.qaFailList = failFirstRead;
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
                    async get(keys) { return pick(keys); },
                    async set(values) {
                        const changes = {};
                        for (const [key, value] of Object.entries(values)) {
                            changes[key] = { oldValue: stored[key], newValue: structuredClone(value) };
                            stored[key] = structuredClone(value);
                        }
                        emit(changes);
                    },
                    async remove(keys) {
                        const changes = {};
                        [].concat(keys).forEach(key => {
                            if (Object.hasOwn(stored, key)) changes[key] = { oldValue: stored[key] };
                            delete stored[key];
                        });
                        emit(changes);
                    }
                },
                onChanged: {
                    addListener(fn) { listeners.push(fn); },
                    removeListener(fn) { const index = listeners.indexOf(fn); if (index >= 0) listeners.splice(index, 1); }
                }
            },
            runtime: {
                id: 'qa', getURL: file => `https://funpay.com/${file}`,
                async sendMessage(message) {
                    window.qaMessages.push(structuredClone(message));
                    await window.qaBackgroundReady;
                    if (message.action === 'accountsList' && window.qaFailList) {
                        window.qaFailList = false;
                        return { ok: false, error: 'Хранилище недоступно' };
                    }
                    const handler = window.qaBackground[message.action];
                    if (!handler) return { ok: false, error: `unknown action ${message.action}` };
                    try { return { ok: true, result: await handler(message) }; }
                    catch (error) { return { ok: false, error: error.message, code: error.code }; }
                }
            }
        };
    }, { initial, failFirstRead, session, userName, qaUsers, snapshots, automation, profiles });
    await page.addScriptTag({ type: 'module', content: `
        window.qaBackgroundReady = (async () => {
            const { createAccountsService } = await import('/background/accounts_service.js');
            const { createProfileManager } = await import('/background/account_profiles.js');
            const { createAccountVault, createMemoryVaultBackend } = await import('/background/account_vault.js');
            const storage = chrome.storage.local;
            const vault = createAccountVault(createMemoryVaultBackend());
            const profiles = createProfileManager({ storage, vault });
            for (const [id, values] of Object.entries(window.qaProfiles)) await vault.putProfile(id, { values, savedAt: 1 });
            const service = createAccountsService({
                storage, vault, profiles,
                guard: {
                    invalidate() {},
                    async current() {
                        const user = window.qaUsers[window.qaSession];
                        return user ? { accountId: user.id, username: user.name } : { accountId: null };
                    }
                },
                cookies: {
                    get: async () => (window.qaSession ? { value: window.qaSession } : null),
                    capture: async () => ({ value: window.qaSession }),
                    write: async value => { window.qaSession = value; },
                    restore: async original => { window.qaSession = original?.value || ''; }
                },
                snapshot: async key => {
                    if (window.qaSnapshotDelay) await new Promise(resolve => setTimeout(resolve, window.qaSnapshotDelay));
                    window.qaSnapshotCalls = (window.qaSnapshotCalls || 0) + 1;
                    return window.qaSnapshots[key] ? structuredClone(window.qaSnapshots[key]) : null;
                },
                isAutomationActive: async () => Boolean(window.qaAutomation),
                hash: async value => 'h:' + value,
                reloadFunPayTabs: async () => { window.qaReloads = (window.qaReloads || 0) + 1; },
                log: { warn() {}, error() {} }
            });
            await service.migrate();
            await service.reconcile();
            window.qaService = service;
            window.qaVault = vault;
            window.qaBackground = {
                accountsList: () => service.list(),
                accountsAddCurrent: request => service.addCurrent(request),
                accountsSwitch: request => service.switchTo(request),
                accountsRefresh: request => service.refresh(request),
                accountsRename: request => service.rename(request),
                accountsSetNote: request => service.setNote(request),
                accountsDelete: request => service.remove(request),
                accountsSync: request => service.sync(request),
                accountsUndoSync: () => service.undoSync(),
                accountsDismissNotice: () => service.dismissNotice()
            };
        })();
    ` });
    await page.waitForFunction(() => window.qaBackground);
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
        snapshotCalls: () => page.evaluate(() => window.qaSnapshotCalls || 0),
        external: patch => page.evaluate(value => window.qaStorage.external(value), patch)
    };
}
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
module.exports = { openAccounts, launch };
