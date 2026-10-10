const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

// Opens the popup on the quick replies page with an in-page chrome.storage mock.
async function openQuickReplies(browser, initial = {}, { dark = true, width = 1480, height = 930, mode, failFirstRead = false } = {}) {
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
    await page.evaluate(({ initial, failFirstRead }) => {
        let stored = structuredClone(initial);
        let failRead = failFirstRead;
        const listeners = [];
        const pick = keys => {
            if (keys == null) return structuredClone(stored);
            const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
            return Object.fromEntries(list.filter(key => Object.hasOwn(stored, key)).map(key => [key, structuredClone(stored[key])]));
        };
        const emit = changes => listeners.slice().forEach(fn => fn(changes, 'local'));
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
                        if (failRead && Array.isArray(keys) && keys.includes('fpToolsTemplateSettings')) { failRead = false; throw new Error('Хранилище недоступно'); }
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
            runtime: { id: 'qa', getURL: file => `https://funpay.com/${file}`, async sendMessage() { return {}; } }
        };
    }, { initial, failFirstRead });
    for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css', 'css/popup_shared.css', 'css/popup_categories.css']) await page.addStyleTag({ path: path.join(root, file) });
    for (const file of ['content/ui/popup_metadata.js', 'content/ui/popup_actions.js', 'content/ui/popup_attachments.js',
        'content/ui/popup_components.js', 'content/ui/menu_theme.js', 'content/ui/main_popup.js', 'content/features/templates.js',
        'content/features/slash_commands_ui.js', 'content/ui/quick_replies_page.js']) {
        await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(async ({ mode }) => {
        const popup = createMainPopup(); document.body.append(popup);
        window.FPTPopupUI.observePopupControls(popup);
        popup.classList.add('active'); popup.style.width = `${Math.min(1440, innerWidth - 24)}px`; popup.style.height = `${innerHeight - 28}px`;
        setupNavigationSections(popup);
        setupPopupPageModes(popup);
        await window.FPTQuickRepliesPage.mount(popup);
        await window.fptOpenPopupPage('templates', mode ? { mode } : {});
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
            .map(animation => animation.finished.catch(() => {})));
    }, { mode });
    return {
        page, errors,
        state: () => page.evaluate(() => window.qaStorage.read()),
        external: patch => page.evaluate(value => window.qaStorage.external(value), patch)
    };
}
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
module.exports = { openQuickReplies, launch };
