const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.resolve(__dirname, '..');
const shotDir = process.env.FPT_CHAT_SHOTS;
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

async function openChat(browser, { dark = true, marked = false, readDelay = 0 } = {}) {
    const page = await browser.newPage({ viewport: { width: 760, height: 420 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
        const file = new URL(route.request().url()).pathname.slice(1);
        if (file.startsWith('fonts/') && fs.existsSync(path.join(root, file))) return route.fulfill({ path: path.join(root, file) });
        return route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' });
    });
    await page.goto('https://funpay.com/chat/');
    await page.setContent(`<html><head></head><body style="margin:0;background:${dark ? '#192d36' : '#fff'};color:${dark ? '#f4f6f8' : '#222'};font:14px Arial,sans-serif">
        <section class="chat-contacts" style="width:278px"><div class="chat-full-header" style="padding:20px;box-sizing:border-box"><h1 style="font-family:Arial,sans-serif;font-weight:800">Сообщения<span class="badge" style="display:none">0</span></h1></div>
        <div class="contact-list"><a class="contact-item" data-id="101">Первый диалог<span class="fp-tools-user-status" data-fp-tooltip="Пометка"></span></a><a class="contact-item" data-id="102">Второй диалог</a></div></section></body></html>`);
    await page.evaluate(({ marked, readDelay }) => {
        const state = { fpToolsIsMarkedFilterActive: marked };
        window.qaState = state;
        window.qaMessages = [];
        window.qaRequests = [];
        window.qaFailures = [];
        window.qaPending = [];
        window.chrome = { runtime: { id: 'qa', getURL: file => `https://funpay.com/${file}` }, storage: { local: {
            async get(key) { if (key === 'fpToolsIsMarkedFilterActive' && readDelay) await new Promise(resolve => setTimeout(resolve, readDelay)); return { ...state }; },
            async set(patch) { Object.assign(state, patch); }
        } } };
        window.fptExtAlive = () => true;
        window.fptSafe = (fn, fallback) => Promise.resolve().then(fn).catch(() => fallback);
        window.createElement = (tag, attrs = {}) => {
            const element = document.createElement(tag);
            for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
            return element;
        };
        window.showNotification = (...args) => qaMessages.push(args);
        window.fetch = async url => {
            qaRequests.push(url);
            if (window.qaHoldRequests) await new Promise(resolve => qaPending.push(resolve));
            return { ok: !qaFailures.includes(url), status: qaFailures.includes(url) ? 503 : 200 };
        };
    }, { marked, readDelay });
    for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css']) await page.addStyleTag({ path: path.join(root, file) });
    for (const file of ['content/safe_values.js', 'content/features/theme.js', 'content/features/misc.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(async () => { initializeMarkAllAsRead(); await document.fonts.ready; });
    return { page, errors };
}

async function shot(page, name) {
    if (!shotDir) return;
    fs.mkdirSync(shotDir, { recursive: true });
    await page.mouse.move(700, 400);
    await page.evaluate(() => document.activeElement?.blur());
    await page.locator('.chat-full-header').screenshot({ path: path.join(shotDir, `${name}.png`) });
}

test('chat buttons: one row, theme radius including zero, light/dark, hover and keyboard filter', async () => {
    const browser = await launch();
    try {
        for (const dark of [true, false]) {
            const { page, errors } = await openChat(browser, { dark });
            for (const width of [278, 240, 340]) {
                await page.locator('.chat-contacts').evaluate((el, w) => { el.style.width = `${w}px`; }, width);
                const geometry = await page.locator('.chat-full-header').evaluate(header => {
                    const title = header.querySelector('h1').getBoundingClientRect();
                    const buttons = [...header.querySelectorAll('button')].map(b => b.getBoundingClientRect());
                    return { fits: buttons.at(-1).right <= header.getBoundingClientRect().right - 20, titleRight: title.right, buttonLeft: buttons[0].left,
                        sizes: buttons.map(b => [b.width, b.height]), centers: [title, ...buttons].map(b => b.y + b.height / 2) };
                });
                assert.equal(geometry.fits, true, `width ${width}`);
                assert.ok(geometry.titleRight <= geometry.buttonLeft);
                assert.deepEqual(geometry.sizes, [[30, 30], [30, 30]]);
                assert.ok(Math.max(...geometry.centers) - Math.min(...geometry.centers) < 1);
            }
            await page.locator('.chat-contacts').evaluate(el => { el.style.width = '278px'; });
            for (const baseStyle of ['original', 'custom']) {
                for (const borderRadius of [0, 6, 12, 30]) {
                    await page.evaluate(({ baseStyle, borderRadius }) => {
                        let style = document.getElementById('qa-theme');
                        if (!style) { style = document.createElement('style'); style.id = 'qa-theme'; document.head.append(style); }
                        style.textContent = getCustomThemeCss({ ...DEFAULT_THEME, baseStyle, borderRadius });
                    }, { baseStyle, borderRadius });
                    assert.deepEqual(await page.locator('.fpt-chat-actions button').evaluateAll(buttons => buttons.map(b => getComputedStyle(b).borderRadius)), [`${borderRadius}px`, `${borderRadius}px`]);
                }
            }
            await page.evaluate(() => document.getElementById('qa-theme').remove());
            await shot(page, dark ? 'dark-idle' : 'light-idle');
            const filter = page.getByRole('button', { name: 'Только помеченные', exact: true });
            await filter.focus();
            assert.equal(await filter.evaluate(el => el.matches(':focus-visible')), true);
            await filter.press('Space');
            assert.equal(await filter.getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('.contact-item[data-id="102"]').isVisible(), false);
            assert.equal(await page.evaluate(() => qaState.fpToolsIsMarkedFilterActive), true);
            await shot(page, dark ? 'dark-filter-on' : 'light-filter-on');
            await filter.press('Enter');
            assert.equal(await filter.getAttribute('aria-pressed'), 'false');
            assert.equal(await page.locator('.contact-item[data-id="102"]').isVisible(), true);
            const read = page.locator('#fp-tools-read-all-btn');
            const before = await read.evaluate(el => getComputedStyle(el).backgroundColor);
            await read.hover();
            await page.waitForTimeout(200);
            assert.notEqual(await read.evaluate(el => getComputedStyle(el).backgroundColor), before);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await read.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('filter restores saved state, applies to added contacts and does not overwrite a click with a late read', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openChat(browser, { marked: true });
        const filter = page.locator('#fp-tools-filter-marked-btn');
        assert.equal(await filter.getAttribute('aria-pressed'), 'true');
        await page.evaluate(() => { const item = document.createElement('a'); item.className = 'contact-item'; item.dataset.id = '103'; item.textContent = 'Новый диалог'; document.querySelector('.contact-list').append(item); });
        await page.waitForFunction(() => document.querySelector('[data-id="103"]').style.display === 'none');
        assert.deepEqual(errors, []);
        await page.close();
        const late = await openChat(browser, { readDelay: 500 });
        await late.page.locator('#fp-tools-filter-marked-btn').click();
        await late.page.waitForTimeout(600);
        assert.equal(await late.page.locator('#fp-tools-filter-marked-btn').getAttribute('aria-pressed'), 'true');
        assert.deepEqual(late.errors, []);
    } finally { await browser.close(); }
});

test('read-all waits for network completion, prevents repeat requests, reports errors and resets feedback', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openChat(browser);
        const read = page.locator('#fp-tools-read-all-btn');
        await read.click();
        assert.equal(await read.getAttribute('data-state'), 'empty');
        await shot(page, 'dark-already-read');
        await page.evaluate(() => { document.querySelector('[data-id="101"]').classList.add('unread'); window.qaHoldRequests = true; });
        await read.click();
        assert.equal(await read.getAttribute('data-state'), 'loading');
        assert.equal(await read.isDisabled(), true);
        assert.equal(await read.getAttribute('aria-busy'), 'true');
        await page.waitForFunction(() => qaPending.length === 1);
        await shot(page, 'dark-loading');
        await page.evaluate(() => document.querySelector('#fp-tools-read-all-btn').click());
        assert.equal(await page.evaluate(() => qaRequests.length), 1);
        await page.waitForTimeout(900);
        assert.equal(await read.getAttribute('data-state'), 'loading');
        await page.evaluate(() => { window.qaHoldRequests = false; qaPending.shift()(); });
        await page.waitForFunction(() => document.querySelector('#fp-tools-read-all-btn').dataset.state === 'success');
        await shot(page, 'dark-success');
        assert.equal(await read.isDisabled(), false);
        await page.evaluate(() => { document.querySelector('[data-id="102"]').classList.add('unread'); qaFailures.push('https://funpay.com/chat/?node=102'); });
        await read.click();
        await page.waitForFunction(() => document.querySelector('#fp-tools-read-all-btn').dataset.state === 'error');
        assert.equal(await page.locator('[data-id="102"]').evaluate(el => el.classList.contains('unread')), true);
        await shot(page, 'dark-error');
        await page.waitForFunction(() => document.querySelector('#fp-tools-read-all-btn').dataset.state === 'idle');
        assert.equal(await read.getAttribute('aria-label'), 'Прочитать все');
        await page.evaluate(() => { qaFailures.length = 0; });
        await read.click();
        await page.waitForFunction(() => document.querySelector('#fp-tools-read-all-btn').dataset.state === 'success');
        assert.equal(await page.locator('.contact-item.unread').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('popup reveal releases its clip after opening, covers the outer shadow and survives resize/reopen/reduced motion', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openChat(browser);
        await page.addScriptTag({ path: path.join(root, 'content/ui/main_popup.js') });
        await page.evaluate(() => {
            const trigger = document.createElement('button'); trigger.id = 'fpToolsButton'; trigger.style.cssText = 'position:fixed;top:10px;right:10px;width:40px;height:40px'; document.body.append(trigger);
            const popup = document.createElement('div'); popup.className = 'fp-tools-popup'; popup.style.cssText = 'box-shadow:0 24px 70px rgba(0,0,0,.55);background:#23262e'; document.body.append(popup);
            openFptToolsPopup(popup);
        });
        const settled = () => page.waitForFunction(() => getComputedStyle(document.querySelector('.fp-tools-popup')).clipPath === 'none');
        await settled();
        assert.equal(await page.locator('.fp-tools-popup').evaluate(el => getComputedStyle(el).animationFillMode), 'backwards');
        const coverage = await page.locator('.fp-tools-popup').evaluate(el => {
            const s = getComputedStyle(el), r = el.getBoundingClientRect();
            const x = parseFloat(s.getPropertyValue('--fpt-reveal-x')), y = parseFloat(s.getPropertyValue('--fpt-reveal-y')), radius = parseFloat(s.getPropertyValue('--fpt-reveal-r'));
            return [[-160, -160], [r.width + 160, -160], [-160, r.height + 160], [r.width + 160, r.height + 160]].every(([px, py]) => Math.hypot(px - x, py - y) <= radius);
        });
        assert.equal(coverage, true);
        await page.setViewportSize({ width: 1100, height: 800 });
        assert.equal(await page.locator('.fp-tools-popup').evaluate(el => getComputedStyle(el).clipPath), 'none');
        await page.evaluate(() => { const p = document.querySelector('.fp-tools-popup'); closeFptToolsPopup(p); openFptToolsPopup(p); });
        await settled();
        assert.equal(await page.locator('.fp-tools-popup.active').count(), 1);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => { const p = document.querySelector('.fp-tools-popup'); closeFptToolsPopup(p); });
        await page.waitForFunction(() => !document.querySelector('.fp-tools-popup').classList.contains('active'));
        await page.evaluate(() => openFptToolsPopup(document.querySelector('.fp-tools-popup')));
        await settled();
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'popup-shadow.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
