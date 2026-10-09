const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openSite, root } = require('./helpers/perf_browser_harness');
const helpers = fs.readFileSync(path.join(root, 'content/utils.js'), 'utf8').split('// DOM scheduling helpers:')[1].split('// End DOM scheduling helpers.')[0];

test('chat attachment disabling restores the native button without replacing either node', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSite(browser, { url: 'https://funpay.com/chat/' });
        await page.locator('.fpt-attach-btn').waitFor();
        const result = await page.evaluate(async () => {
            const own = document.querySelector('.fpt-attach-btn'), native = document.querySelector('.chat-form .chat-btn-image:not(.fpt-attach-btn)');
            qaExternal({ fpToolsDisabledFeatures: ['chat_custom_attach'] });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const disabled = [getComputedStyle(own).display, native.classList.contains('fpt-native-attach-hidden')];
            qaExternal({ fpToolsDisabledFeatures: [] });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return { disabled, enabled: [getComputedStyle(own).display, native.classList.contains('fpt-native-attach-hidden')], same: own === document.querySelector('.fpt-attach-btn') };
        });
        assert.deepEqual(result.disabled, ['none', false]);
        assert.notEqual(result.enabled[0], 'none'); assert.equal(result.enabled[1], true); assert.equal(result.same, true);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('order timers share one interval, avoid duplicates and clean removed rows', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.fulfill({ body: '<html><body><main id="content"></main></body></html>', contentType: 'text/html' }));
        await page.goto('https://funpay.com/orders/trade');
        await page.evaluate(() => {
            const nativeSet = window.setInterval, nativeClear = window.clearInterval;
            window.qaIntervals = new Map();
            window.setInterval = (fn, ms) => { const id = nativeSet(fn, ms); if (ms === 60000) qaIntervals.set(id, fn); return id; };
            window.clearInterval = id => { qaIntervals.delete(id); nativeClear(id); };
        });
        await page.addScriptTag({ content: helpers.slice(helpers.indexOf('\n')) });
        await page.addScriptTag({ path: path.join(root, 'content/features/order_timer.js') });
        await page.evaluate(() => {
            for (let i = 0; i < 50; i++) document.querySelector('#content').insertAdjacentHTML('beforeend', '<a class="tc-item info"><div class="tc-date"><span class="tc-date-time">сегодня, 12:00</span></div></a>');
        });
        await page.waitForFunction(() => document.querySelectorAll('.fp-order-timer').length === 50);
        assert.equal(await page.evaluate(() => qaIntervals.size), 1);
        await page.evaluate(() => document.querySelector('#content').append(document.createElement('span')));
        await page.waitForTimeout(50); assert.equal(await page.locator('.fp-order-timer').count(), 50);
        await page.evaluate(() => { document.querySelector('#content').replaceChildren(); [...qaIntervals.values()][0](); });
        assert.equal(await page.evaluate(() => qaIntervals.size), 0);
    } finally { await browser.close(); }
});

test('stock cache keeps a newer storage event when the initial read resolves late', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.fulfill({ body: '<html><body><a class="tc-item" href="/lots/offer?id=501"><div class="tc-price">100</div></a></body></html>', contentType: 'text/html' }));
        await page.goto('https://funpay.com/users/123/');
        await page.evaluate(() => {
            window.qaListeners = []; window.qaReadCount = 0;
            window.chrome = { storage: { local: { get() { qaReadCount++; return new Promise(resolve => { window.qaResolve = resolve; }); } }, onChanged: { addListener: fn => qaListeners.push(fn) } } };
        });
        await page.addScriptTag({ content: helpers.slice(helpers.indexOf('\n')) });
        await page.addScriptTag({ path: path.join(root, 'content/features/auto_delivery_ui.js') });
        await page.evaluate(() => {
            qaListeners.forEach(fn => fn({ fpToolsAutoDeliveryLots: { newValue: { '501': { enabled: true, productCount: 7 } } } }, 'local'));
            qaResolve({ fpToolsAutoDeliveryLots: { '501': { enabled: true, productCount: 3 } } });
        });
        await page.waitForFunction(() => document.querySelector('.tc-price span')?.textContent === '7');
        await page.evaluate(() => document.body.append(document.createElement('div'))); await page.waitForTimeout(50);
        assert.equal(await page.evaluate(() => qaReadCount), 1);
    } finally { await browser.close(); }
});
