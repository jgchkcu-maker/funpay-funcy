const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openSite, root } = require('./helpers/perf_browser_harness');
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'background/popup_bundle.json'), 'utf8'));
async function inject(page, partial = false) {
    for (const file of bundle.css) await page.addStyleTag({ path: path.join(root, file) });
    for (const file of partial ? bundle.js.slice(0, 2) : bundle.js) await page.addScriptTag({ path: path.join(root, file) });
}
async function fixture(browser, handler, shortTimeout = false, seed = {}) {
    const { page } = await openSite(browser, { eager: false, url: 'https://funpay.com/chat/', seed });
    await page.exposeBinding('qaLoadPopup', async (_, request) => handler(page, request));
    await page.evaluate(short => {
        const original = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = (request, callback) => {
            if (request.action !== 'fptLoadPopupBundle') return original(request, callback);
            qaMessages.push(request);
            return qaLoadPopup(request);
        };
        if (short) {
            const timer = window.setTimeout;
            window.setTimeout = (fn, ms, ...args) => timer(fn, ms === 15000 ? 60 : ms, ...args);
        }
    }, shortTimeout);
    return page;
}
const success = request => ({ requestId: request.requestId, ok: true, status: 'ready' });
test('first click loads once, concurrent clicks open once and reopening never reloads', async () => {
    const browser = await launch();
    try {
        let release;
        const gate = new Promise(resolve => release = resolve);
        const page = await fixture(browser, async (page, request) => { await gate; await inject(page); return success(request); });
        assert.deepEqual(await page.evaluate(() => ({ popup: typeof createMainPopup, window: typeof fptWindow, templates: typeof addChatTemplateButtons, theme: typeof fptApplyMenuTheme, sound: typeof applyNotificationSound === 'function' })),
            { popup: 'undefined', window: 'object', templates: 'function', theme: 'function', sound: true });
        await page.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('#fpToolsButton').click(); });
        assert.equal(await page.locator('#fpToolsButton').getAttribute('aria-busy'), 'true');
        release();
        await page.waitForSelector('.fp-tools-popup.active');
        assert.equal(await page.evaluate(() => qaMessages.filter(m => m.action === 'fptLoadPopupBundle').length), 1);
        await page.evaluate(() => document.querySelector('#fpToolsButton').click());
        await page.waitForFunction(() => !document.querySelector('.fp-tools-popup').classList.contains('is-closing'));
        await page.evaluate(() => document.querySelector('#fpToolsButton').click());
        await page.waitForSelector('.fp-tools-popup.active');
        assert.equal(await page.locator('.fp-tools-popup').count(), 1);
        assert.equal(await page.locator('#fpToolsButton').getAttribute('aria-busy'), null);
        assert.equal(await page.evaluate(() => qaMessages.filter(m => m.action === 'fptLoadPopupBundle').length), 1);
    } finally { await browser.close(); }
});
test('terminal failure before injection permits only the next explicit retry', async () => {
    const browser = await launch();
    try {
        let requests = 0;
        const page = await fixture(browser, async (page, request) => {
            if (!requests++) return { requestId: request.requestId, ok: false, status: 'failed-not-started' };
            await inject(page); return success(request);
        });
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('#fpt-popup-load-error');
        assert.equal(requests, 1);
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('.fp-tools-popup.active');
        assert.equal(requests, 2);
    } finally { await browser.close(); }
});
test('partial execution is never replayed; reload is offered without automatic navigation', async () => {
    const browser = await launch();
    try {
        let requests = 0;
        const page = await fixture(browser, async (page, request) => {
            requests++; await inject(page, true); return { requestId: request.requestId, ok: false, status: 'failed-partial' };
        });
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('#fpt-popup-load-error');
        await page.locator('#fpToolsButton').click();
        assert.equal(requests, 1);
        assert.equal(await page.locator('.fp-tools-popup').count(), 0);
        assert.equal(await page.locator('#fpt-popup-load-error button', { hasText: 'Перезагрузить' }).count(), 1);
        assert.equal(page.url(), 'https://funpay.com/chat/');
    } finally { await browser.close(); }
});
test('UI timeout retains the original request; late success waits for an explicit new click', async () => {
    const browser = await launch();
    try {
        let release, requests = 0;
        const gate = new Promise(resolve => release = resolve);
        const page = await fixture(browser, async (page, request) => { requests++; await gate; await inject(page); return success(request); }, true);
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('#fpt-popup-load-error');
        assert.equal(await page.evaluate(() => fptPopupBundleState.status), 'unknown');
        await page.locator('#fpToolsButton').click();
        assert.equal(requests, 1);
        release();
        await page.waitForFunction(() => fptPopupBundleState.status === 'ready');
        assert.equal(await page.locator('.fp-tools-popup').count(), 0);
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('.fp-tools-popup.active');
        assert.equal(requests, 1);
    } finally { await browser.close(); }
});
test('lost response never retries injection and may recover existing validated readiness', async () => {
    const browser = await launch();
    try {
        let requests = 0;
        const page = await fixture(browser, async (page) => { requests++; await inject(page); throw new Error('Response lost'); });
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('#fpt-popup-load-error');
        assert.equal(await page.evaluate(() => fptPopupBundleState.status), 'unknown');
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('.fp-tools-popup.active');
        assert.equal(requests, 1);
    } finally { await browser.close(); }
});
test('assembly failure removes partial DOM and forbids remounting views without full disposal', async () => {
    const browser = await launch();
    try {
        let requests = 0;
        const page = await fixture(browser, async (page, request) => {
            requests++; await inject(page);
            await page.evaluate(() => {
                window.qaMounts = 0;
                window.FPTLotIOPage = { mount() { qaMounts++; throw new Error('Assembly interrupted'); } };
            });
            return success(request);
        });
        await page.locator('#fpToolsButton').click(); await page.waitForSelector('#fpt-popup-load-error');
        assert.equal(await page.locator('.fp-tools-popup').count(), 0);
        assert.equal(await page.evaluate(() => __fptPopupBundleLoaded), true);
        await page.locator('#fpToolsButton').click();
        assert.equal(await page.evaluate(() => qaMounts), 1);
        assert.equal(requests, 1);
    } finally { await browser.close(); }
});
test('saved custom theme and page window palette work before the UI package and survive its load', async () => {
    const browser = await launch();
    try {
        const page = await fixture(browser, async (page, request) => { await inject(page); return success(request); }, false, {
            enableCustomTheme: true, fpToolsTheme: { bgColor1: '#304050', bgColor2: '#9bd0ff', containerBgColor: '#14161c', textColor: '#e8edf5', font: 'Arial', baseStyle: 'custom' }
        });
        const before = await page.evaluate(async () => {
            await applyCustomTheme();
            window.qaWindow = fptWindow.create({ title: 'Тема окна' }); qaWindow.open();
            return { css: document.getElementById('fp-tools-custom-theme')?.textContent,
                color: getComputedStyle(qaWindow.dialog).color, background: getComputedStyle(qaWindow.dialog).backgroundColor };
        });
        assert.ok(before.css?.length > 1000);
        assert.equal(await page.evaluate(() => typeof createMainPopup), 'undefined');
        await page.evaluate(() => qaWindow.close()); await page.waitForTimeout(200);
        await page.locator('#fpToolsButton').click(); await page.waitForSelector('.fp-tools-popup.active');
        const after = await page.evaluate(() => ({ css: document.getElementById('fp-tools-custom-theme')?.textContent,
            color: getComputedStyle(qaWindow.dialog).color, background: getComputedStyle(qaWindow.dialog).backgroundColor }));
        assert.deepEqual(after, before);
    } finally { await browser.close(); }
});
