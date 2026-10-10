const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '../..');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

async function openReviews(browser, initial = {}, { dark = true, width = 1480, height = 930, initialReadFailure = false, reminders = null } = {}) {
    const { createAutoReplyStore } = await import(pathToFileURL(path.join(root, 'background/auto_reply_store.js')).href);
    let stored = structuredClone(initial);
    let failNext = false;
    let failRead = initialReadFailure;
    const patches = [];
    const reminderCalls = [];
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const store = createAutoReplyStore({
        async get() { return { fpToolsAutoReplies: structuredClone(stored) }; },
        async set(value) { stored = structuredClone(value.fpToolsAutoReplies); }
    });
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname.slice(1);
        if (/^(icons|fonts)\/[\w.-]+$/.test(pathname) && fs.existsSync(path.join(root, pathname))) return route.fulfill({ path: path.join(root, pathname) });
        return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('https://funpay.com/');
    await page.exposeFunction('qaRead', () => {
        if (failRead) throw new Error('Ошибка загрузки');
        return structuredClone(stored);
    });
    await page.exposeFunction('qaReminders', async message => {
        reminderCalls.push(structuredClone(message));
        const handler = reminders?.[message.command];
        if (!handler) return { success: false, error: 'Нет данных' };
        try { return { success: true, data: await handler(message) }; }
        catch (e) { return { success: false, error: e.message }; }
    });
    await page.exposeFunction('qaSave', async patch => {
        patches.push(patch);
        if (failNext) { failNext = false; return { ok: false, error: 'Ошибка сохранения' }; }
        try { return { ok: true, autoReplies: await store.patchAutoReplies(patch) }; }
        catch (e) { return { ok: false, error: e.message, code: e.code }; }
    });
    await page.setContent(`<html${dark ? ' class="fpt-theme-dark"' : ''}><head></head><body style="background:${dark ? '#18191d' : '#f2f3f5'}"></body></html>`);
    await page.evaluate(() => {
        window.qaListeners = [];
        window.chrome = {
            storage: { local: {
                async get() { return { fpToolsAutoReplies: await window.qaRead() }; },
                async set() { throw new Error('Direct writes are forbidden'); }
            }, onChanged: {
                addListener(fn) { window.qaListeners.push(fn); },
                removeListener(fn) { window.qaListeners = window.qaListeners.filter(value => value !== fn); }
            } },
            runtime: { id: 'qa', getURL: file => `https://funpay.com/${file}`,
                async sendMessage(message) { return message.action === 'fptReviewReminders' ? window.qaReminders(message) : window.qaSave(message.patch); } }
        };
    });
    for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css', 'css/popup_shared.css', 'css/popup_categories.css', ...(reminders ? ['css/automation.css'] : [])]) await page.addStyleTag({ path: path.join(root, file) });
    // Reproduce the host rule responsible for the original heading underlay.
    await page.addStyleTag({ content: 'header { background: rgba(0,0,0,.08) !important; }' });
    for (const file of ['content/features/auto_reply_store.js', 'content/ui/popup_metadata.js', 'content/ui/popup_actions.js',
        'content/ui/popup_attachments.js', 'content/ui/popup_components.js', 'content/ui/menu_theme.js', 'content/ui/main_popup.js',
        ...(reminders ? ['content/ui/automation_ui.js', 'content/ui/review_reminder_block.js'] : []), 'content/ui/auto_review_page.js']) {
        await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(async () => {
        const popup = createMainPopup(); document.body.append(popup);
        window.FPTPopupUI.observePopupControls(popup);
        popup.classList.add('active'); popup.style.width = `${Math.min(1440, innerWidth - 24)}px`; popup.style.height = `${innerHeight - 28}px`;
        popup.querySelectorAll('.fp-tools-nav li[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === 'auto_review'));
        setupNavigationSections(popup);
        popup.querySelectorAll('.fp-tools-page-content').forEach(page => page.classList.toggle('active', page.dataset.page === 'auto_review'));
        await window.FPTAutoReviewPage.mount(popup);
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
            .map(animation => animation.finished.catch(() => {})));
    });
    async function external(patch) {
        const previous = structuredClone(stored);
        await store.patchAutoReplies(patch);
        await page.evaluate(({ oldValue, newValue }) => window.qaListeners.forEach(fn => fn({ fpToolsAutoReplies: { oldValue, newValue } }, 'local')), { oldValue: previous, newValue: stored });
    }
    return { page, errors, patches, reminderCalls, state: () => structuredClone(stored), external,
        failSave: () => { failNext = true; }, failReads: next => { failRead = next; } };
}
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
module.exports = { openReviews, launch };
