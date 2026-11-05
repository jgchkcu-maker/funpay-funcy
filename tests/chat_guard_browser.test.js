const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts/chat-guard-inline-2026-11-04');
const launch = () => chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
async function open(browser, { dark = true, enabled = true, notify = false } = {}) {
    const page = await browser.newPage({ viewport: { width: 850, height: 600 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const name = new URL(route.request().url()).pathname.slice(1);
        if (name.startsWith('fonts/') && fs.existsSync(path.join(root, name))) return route.fulfill({ path: path.join(root, name) });
        return route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' });
    });
    await page.goto('https://funpay.com/chat/');
    await page.setContent(`<html><head></head><body style="margin:24px;font:14px Arial;color:${dark ? '#eef1f6' : '#242a32'};background:${dark ? '#151c21' : '#f5f6f8'};--fpt-surface-2:${dark ? '#202a30' : '#fff'};--fpt-text:${dark ? '#eef1f6' : '#242a32'};--fpt-border:${dark ? '#ffffff18' : '#dde1e5'};--fpt-accent:#8d7bdd;--fpt-chat-action-radius:18px">
    <section class="chat-contacts" style="width:300px;background:${dark ? '#202a30' : '#fff'};border-radius:18px"><div class="chat-full-header" style="padding:20px;box-sizing:border-box"><h1 style="font-weight:800">Сообщения</h1></div>
    <div class="contact-list"><a class="contact-item" data-id="77"><strong>Alex</strong><span class="fp-tools-user-status" data-fp-tooltip="Пометка"></span><div class="contact-item-message">Подскажите, когда будет готово?</div></a><a class="contact-item" data-id="88"><strong>Второй покупатель</strong><div class="contact-item-message">Фото</div></a><a class="contact-item" data-id="99"><strong>Нет ожидания</strong></a></div></section><div class="chat-header"><ul class="dropdown-menu"></ul></div>
    <style>.contact-item{display:block;padding:16px 20px;color:inherit;text-decoration:none}.contact-item-message{font-size:12px;margin-top:6px;opacity:.7}</style></body></html>`);
    await page.evaluate(({ enabled, notify }) => {
        window.qaAccount = '100'; window.fptPageUserId = () => qaAccount;
        window.qaCommands = []; window.qaClicks = [];
        document.querySelectorAll('.contact-item').forEach(item => item.addEventListener('click', () => qaClicks.push(item.dataset.id)));
        const state = window.qaState = { fpToolsProfileOwner: { accountId: '100' }, fpToolsAutoReplies: { chatGuardEnabled: enabled, chatGuardThresholdMinutes: 30, chatGuardState: { 100: {
            lastSnapshotAt: Date.now(), lastCheckedAt: Date.now(), chats: {}, waiting: {
                77: { chatId: '77', name: 'Alex <script>', text: 'Подскажите, когда будет готово?', since: Date.now() - 3600000, firstMessageId: '11', lastBuyerMessageId: '11', notifiedAt: notify ? null : Date.now() },
                88: { chatId: '88', name: 'Второй покупатель', text: 'Фото', since: Date.now() - 60000, firstMessageId: '12', lastBuyerMessageId: '12' }
            }
        } } } };
        const listeners = [];
        window.qaChange = patch => { Object.assign(state, patch); listeners.forEach(fn => fn(Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { newValue: value }])), 'local')); };
        window.chrome = { storage: { local: { async get() { return structuredClone(state); }, async set(patch) { qaChange(patch); } }, onChanged: { addListener(fn) { listeners.push(fn); } } },
            runtime: { id: 'qa', getURL: file => `https://funpay.com/${file}`, async sendMessage(message) {
                qaCommands.push(message); const scope = state.fpToolsAutoReplies.chatGuardState[100];
                if (message.expectedAccountId !== qaAccount) return { ok: false, error: 'Аккаунт изменился' };
                if (message.operation === 'dismiss') { window.qaRemoved = scope.waiting[message.chatId]; delete scope.waiting[message.chatId]; qaChange(state); return { ok: true, undoToken: 'undo' }; }
                if (message.operation === 'undoDismiss') { scope.waiting[qaRemoved.chatId] = qaRemoved; qaChange(state); }
                if (message.operation === 'claimNotification') {
                    const entries = Object.values(scope.waiting).filter(entry => !entry.notifiedAt && Date.now() - entry.since >= 1800000 && entry.chatId !== message.excludeChatId);
                    return { ok: true, notification: entries.length ? { token: 'lease', entries } : null };
                }
                if (message.operation === 'ackNotification') { Object.values(scope.waiting).forEach(entry => entry.notifiedAt = Date.now()); qaChange(state); }
                return { ok: true };
            } } };
        window.fptExtAlive = () => true; window.fptSafe = (fn, fallback) => Promise.resolve().then(fn).catch(() => fallback);
        window.createElement = (tag, attrs = {}) => { const el = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; };
    }, { enabled, notify });
    for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css', 'css/chat_guard.css']) await page.addStyleTag({ path: path.join(root, file) });
    // Load only the real notification helper; utils also contains unrelated page bootstraps.
    const utils = fs.readFileSync(path.join(root, 'content/utils.js'), 'utf8');
    await page.addScriptTag({ content: utils.slice(utils.indexOf('function showNotification('), utils.indexOf('// === ВЛОЖЕНИЯ')) });
    await page.addScriptTag({ path: path.join(root, 'content/features/misc.js') });
    await page.evaluate(() => initializeMarkAllAsRead());
    await page.addScriptTag({ path: path.join(root, 'content/features/chat_guard.js') });
    await page.evaluate(() => document.fonts.ready);
    if (enabled) await page.locator('#fp-tools-chat-guard-btn').waitFor();
    return { page, errors };
}

test('waiting filter: third button geometry, themes, exclusive filters and account isolation', async () => {
    const browser = await launch(); fs.mkdirSync(artifacts, { recursive: true });
    try {
        for (const dark of [true, false]) {
            const { page, errors } = await open(browser, { dark });
            for (const width of [240, 278, 300, 340]) {
                await page.locator('.chat-contacts').evaluate((node, width) => node.style.width = `${width}px`, width);
                const geometry = await page.locator('.chat-full-header').evaluate(header => {
                    const title = header.querySelector('h1').getBoundingClientRect();
                    const buttons = [...header.querySelectorAll('button')].map(node => node.getBoundingClientRect());
                    return { sizes: buttons.map(rect => [rect.width, rect.height]), fits: buttons.at(-1).right <= header.getBoundingClientRect().right - 20, overlap: title.right > buttons[0].left };
                });
                assert.deepEqual(geometry.sizes, [[30, 30], [30, 30], [30, 30]]);
                assert.equal(geometry.fits, true, `width ${width}`); assert.equal(geometry.overlap, false);
            }
            await page.locator('.chat-contacts').evaluate(node => node.style.width = '300px');
            const trigger = page.locator('#fp-tools-chat-guard-btn');
            assert.equal(await trigger.locator('.fpt-cg-button-count').count(), 0, 'no duplicate visible counter');
            await trigger.focus(); await trigger.press('Enter');
            assert.equal(await trigger.getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('.contact-item:visible').count(), 2);
            assert.equal(await page.locator('.fpt-cg-panel').count(), 0);
            await page.screenshot({ path: path.join(artifacts, dark ? 'dark-filter.png' : 'light-filter.png') });
            const marked = page.locator('#fp-tools-filter-marked-btn');
            await marked.click();
            assert.equal(await trigger.getAttribute('aria-pressed'), 'false');
            assert.equal(await marked.getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('.contact-item:visible').count(), 1);
            assert.equal(await page.locator('.contact-item[data-id="77"]').isVisible(), true);
            await trigger.click();
            assert.equal(await marked.getAttribute('aria-pressed'), 'false');
            assert.equal(await trigger.getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('.contact-item:visible').count(), 2, 'waiting filter replaces marked filter');
            await trigger.click();
            assert.equal(await page.locator('.contact-item:visible').count(), 3);
            await trigger.click();
            await page.locator('.contact-item[data-id="77"]').evaluate(node => node.classList.add('active'));
            await page.locator('#fpt-chat-guard-dismiss').waitFor();
            await page.locator('#fpt-chat-guard-dismiss').evaluate(node => node.click());
            await page.waitForFunction(() => !qaState.fpToolsAutoReplies.chatGuardState[100].waiting[77]);
            await page.getByRole('button', { name: 'Отменить', exact: true }).click();
            await page.waitForFunction(() => Boolean(qaState.fpToolsAutoReplies.chatGuardState[100].waiting[77]));
            await page.evaluate(() => { qaAccount = '200'; qaChange({ fpToolsProfileOwner: { accountId: '100' } }); });
            await page.waitForFunction(() => !document.getElementById('fp-tools-chat-guard-btn'));
            assert.equal(await page.locator('.fpt-cg-contact-time').count(), 0);
            assert.equal(await page.locator('.contact-item:visible').count(), 3);
            assert.deepEqual(errors, []); await page.close();
        }
    } finally { await browser.close(); }
});

test('inline reminders: existing toast style, actionable notification, no repeated alert and live enable/disable', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await open(browser, { enabled: false, notify: true });
        assert.equal(await page.locator('#fp-tools-chat-guard-btn').count(), 0);
        await page.evaluate(() => { qaState.fpToolsAutoReplies.chatGuardEnabled = true; qaChange({ fpToolsAutoReplies: qaState.fpToolsAutoReplies }); });
        await page.locator('#fp-tools-chat-guard-btn').waitFor();
        await page.bringToFront(); await page.evaluate(() => FPTChatGuard.notify());
        await page.locator('.fpt-global-notification--action').waitFor();
        assert.equal(await page.locator('.fpt-global-notification--action').count(), 1);
        await page.screenshot({ path: path.join(artifacts, 'notification.png') });
        await page.evaluate(() => FPTChatGuard.notify());
        assert.equal(await page.locator('.fpt-global-notification--action').count(), 1);
        await page.getByRole('button', { name: 'Открыть диалог', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => qaClicks), ['77']);
        await page.evaluate(() => { qaState.fpToolsAutoReplies.chatGuardEnabled = false; qaChange({ fpToolsAutoReplies: qaState.fpToolsAutoReplies }); });
        await page.waitForFunction(() => !document.getElementById('fp-tools-chat-guard-btn'));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('waiting time survives a second incoming preview, text-node edits and full contact replacement', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await open(browser);
        const marker = page.locator('.contact-item[data-id="77"] > .fpt-cg-contact-time');
        await marker.waitFor();
        const since = await page.evaluate(() => qaState.fpToolsAutoReplies.chatGuardState[100].waiting[77].since);
        assert.deepEqual(await page.evaluate(() => qaClicks), [], 'initialization does not open/read a chat');
        await page.evaluate(() => {
            const preview = document.querySelector('.contact-item[data-id="77"] .contact-item-message');
            preview.style.cssText = 'height:14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
            preview.textContent = 'Второе сообщение покупателя '.repeat(50);
            const waiting = qaState.fpToolsAutoReplies.chatGuardState[100].waiting[77];
            waiting.lastBuyerMessageId = '13'; waiting.text = preview.textContent;
            qaChange({ fpToolsAutoReplies: qaState.fpToolsAutoReplies });
        });
        await page.waitForFunction(() => document.querySelector('.contact-item[data-id="77"] > .fpt-cg-contact-time')?.textContent === '1 ч');
        assert.equal(await marker.isVisible(), true);
        const geometry = await marker.evaluate(node => {
            const bounds = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
            return { contained: bounds.left >= parent.left && bounds.right <= parent.right && bounds.bottom <= parent.bottom, previewChild: Boolean(node.closest('.contact-item-message')) };
        });
        assert.equal(geometry.contained, true); assert.equal(geometry.previewChild, false);
        await page.evaluate(() => {
            const old = document.querySelector('.contact-item[data-id="77"]');
            const replacement = old.cloneNode(true);
            replacement.querySelector('.fpt-cg-contact-time').remove();
            replacement.querySelector('.contact-item-message').firstChild.data = 'Третье сообщение';
            old.replaceWith(replacement);
        });
        await marker.waitFor();
        assert.equal(await marker.textContent(), '1 ч');
        assert.equal(await page.evaluate(() => qaState.fpToolsAutoReplies.chatGuardState[100].waiting[77].since), since);
        assert.deepEqual(await page.evaluate(() => qaClicks), []);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
