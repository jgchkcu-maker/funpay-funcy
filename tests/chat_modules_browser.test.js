const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.resolve(__dirname, '..');
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

// FunPay /chat/ as captured from the live page: .chat-full is a flex row of the contact list, an empty
// .js-chat-top, the chat and the info panel; the side columns are percentage-wide with no seam border.
const FUNPAY_CSS = `
    body { margin: 0; font: 14px Arial, sans-serif; background: #f0f3f7; }
    .container { width: 1125px; margin: 0 auto; }
    .chat-full { display: flex; width: 100%; height: 600px; }
    .chat { display: flex; flex-direction: column; border-radius: 4px; background: #fff; }
    .chat-full .chat { margin-bottom: 0; width: 50.2222%; height: auto; }
    .chat-header { border: 1px solid #eaeaea; padding: 15px; }
    .chat-full .chat-header, .chat-full .chat-form { border-radius: 0; }
    .chat-message-container { flex: 1 1 auto; border-left: 1px solid #eaeaea; border-right: 1px solid #eaeaea; }
    .chat-form { border: 1px solid #eaeaea; padding: 10px; }
    .chat-contacts, .chat-detail { width: 24.8889%; background: #fff; border: 1px solid #eaeaea; display: flex; flex-direction: column; }
    .chat-contacts { border-radius: 4px 0 0 4px; border-right: none; }
    .chat-detail { border-radius: 0 4px 4px 0; border-left: none; }
    @media (max-width: 991px) { .chat-detail { display: none; } .chat-contacts { width: 35%; } .chat-full .chat { width: 65%; } }`;

async function openChat(browser, theme, { width = 1300 } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' }));
    await page.goto('https://funpay.com/chat/');
    await page.setContent(`<html><head><style>${FUNPAY_CSS}</style></head><body><div class="container"><div class="chat-full">
        <div class="chat-contacts"><div class="contact-list">Диалоги</div></div><div class="js-chat-top"></div>
        <div class="chat chat-float"><div class="chat-header">Собеседник</div><div class="chat-message-container">Сообщения</div><div class="chat-form">Написать…</div></div>
        <div class="chat-detail">Дата регистрации</div></div></div></body></html>`);
    await page.evaluate(theme => {
        const state = { enableCustomTheme: true, fpToolsTheme: theme };
        const listeners = [];
        window.qaState = state;
        window.qaEvents = [];
        document.addEventListener('fpt:chat-column-width', event => qaEvents.push(event.detail));
        window.chrome = { runtime: { id: 'qa' }, storage: {
            local: {
                async get(keys) { return JSON.parse(JSON.stringify(Object.fromEntries([].concat(keys).map(k => [k, state[k]])))); },
                async set(patch) {
                    const changes = {};
                    for (const [key, value] of Object.entries(patch)) { changes[key] = { oldValue: state[key], newValue: value }; state[key] = value; }
                    listeners.forEach(fn => fn(changes, 'local'));
                }
            },
            onChanged: { addListener(fn) { listeners.push(fn); } }
        } };
        // The popup applies a theme by rewriting the theme style; tests do the same through this helper.
        window.qaApplyTheme = async patch => {
            await chrome.storage.local.set({ fpToolsTheme: { ...state.fpToolsTheme, ...patch } });
            let style = document.getElementById('fp-tools-custom-theme');
            if (!style) { style = document.createElement('style'); style.id = 'fp-tools-custom-theme'; document.head.append(style); }
            style.textContent = getCustomThemeCss({ ...DEFAULT_THEME, ...state.fpToolsTheme });
            fptRemoveChatLayoutPrehide();
        };
    }, theme);
    await page.addStyleTag({ path: path.join(root, 'css/content_styles.css') });
    for (const file of ['content/safe_values.js', 'content/theme_chat_layout.js', 'content/features/theme.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(() => qaApplyTheme({}));
    await page.addScriptTag({ path: path.join(root, 'content/features/chat_column_resize.js') });
    await page.waitForFunction(() => document.querySelectorAll('.fpt-chat-resizer').length > 0 || !qaState.fpToolsTheme.chatModular);
    return { page, errors };
}

function geometry(page) {
    return page.evaluate(() => {
        const rect = sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, visible: el.getClientRects().length > 0 }; };
        const corners = sel => { const s = getComputedStyle(document.querySelector(sel)); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]; };
        return {
            contacts: rect('.chat-contacts'), chat: rect('.chat-full > .chat'), detail: rect('.chat-detail'),
            radii: ['.chat-contacts', '.chat-full > .chat', '.chat-detail'].map(corners),
            contactsSeam: getComputedStyle(document.querySelector('.chat-contacts')).borderRightWidth,
            handles: [...document.querySelectorAll('.fpt-chat-resizer')].map(h => { const r = h.getBoundingClientRect(); return { side: h.dataset.side, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
        };
    });
}

async function drag(page, handle, dx) {
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + dx / 2, handle.y, { steps: 3 });
    await page.mouse.move(handle.x + dx, handle.y, { steps: 3 });
    await page.mouse.up();
    await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--fpt-chat-contacts-w') && !document.documentElement.style.getPropertyValue('--fpt-chat-detail-w'));
}

test('modular chat: separate rounded modules, drag handles save widths, reset, clamp and hide the panel', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openChat(browser, { baseStyle: 'custom', chatModular: true, chatModuleGap: 12, borderRadius: 12 });
        let g = await geometry(page);
        assert.equal(Math.round(g.contacts.width), 280);
        assert.equal(Math.round(g.detail.width), 280);
        assert.equal(Math.round(g.chat.left - g.contacts.right), 12, 'gap after the list, not doubled by .js-chat-top');
        assert.equal(Math.round(g.detail.left - g.chat.right), 12);
        g.radii.forEach(r => assert.deepEqual(r, ['12px', '12px', '12px', '12px']));
        assert.deepEqual(g.handles.map(h => h.side), ['contacts', 'detail']);
        assert.ok(Math.abs(g.handles[0].x - (g.contacts.right + 6)) <= 1, 'handle sits in the gap');

        await drag(page, g.handles[0], 60);
        g = await geometry(page);
        assert.equal(Math.round(g.contacts.width), 340);
        assert.equal(await page.evaluate(() => qaState.fpToolsTheme.chatContactsWidth), 340);
        assert.deepEqual(await page.evaluate(() => qaEvents.at(-1)), { key: 'chatContactsWidth', value: 340 });
        assert.ok(Math.abs(g.handles[0].x - (g.contacts.right + 6)) <= 1, 'handle follows the new edge');

        await drag(page, g.handles[1], -40);
        g = await geometry(page);
        assert.equal(Math.round(g.detail.width), 320, 'dragging the panel edge left widens the panel');
        assert.equal(await page.evaluate(() => qaState.fpToolsTheme.chatDetailWidth), 320);

        await drag(page, g.handles[0], 500);
        g = await geometry(page);
        assert.ok(g.chat.width >= 359.5, `chat keeps its minimum width (${g.chat.width})`);
        assert.ok(g.contacts.width <= 480);

        await page.mouse.dblclick(g.handles[0].x, g.handles[0].y);
        await page.waitForFunction(() => qaState.fpToolsTheme.chatContactsWidth === 280);
        g = await geometry(page);
        assert.equal(Math.round(g.contacts.width), 280);

        await page.focus('.fpt-chat-resizer[data-side="contacts"]');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => qaState.fpToolsTheme.chatContactsWidth === 296);

        await page.evaluate(() => qaApplyTheme({ chatHideDetail: true }));
        await page.waitForFunction(() => document.querySelectorAll('.fpt-chat-resizer').length === 1);
        g = await geometry(page);
        assert.equal(g.detail.visible, false);
        assert.ok(Math.abs(g.chat.right - 1125 - (1300 - 1125) / 2) <= 1, 'the chat takes the panel space');

        await page.evaluate(() => qaApplyTheme({ chatModular: false, chatHideDetail: false }));
        await page.waitForFunction(() => document.querySelectorAll('.fpt-chat-resizer').length === 0);
        g = await geometry(page);
        assert.equal(Math.round(g.chat.left - g.contacts.right), 0, 'the joined FunPay layout is back');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('modular chat: original look restores seam borders, mobile width keeps FunPay layout', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openChat(browser, { baseStyle: 'original', chatModular: true, borderRadius: 8 });
        let g = await geometry(page);
        assert.equal(g.contactsSeam, '1px');
        g.radii.forEach(r => assert.deepEqual(r, ['8px', '8px', '8px', '8px']));
        await page.setViewportSize({ width: 700, height: 700 });
        await page.waitForFunction(() => document.querySelectorAll('.fpt-chat-resizer').length === 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
