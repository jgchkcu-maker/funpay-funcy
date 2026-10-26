// Real unpacked MV3 worker, only local synthetic data. No FunPay account or purchase.
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8')).version;
const stage = path.resolve(process.argv[2] || `dist/funcy-${version}-staging`);

(async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'funcy-store-smoke-'));
    const options = {
        executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true, args: ['--enable-unsafe-extension-debugging'], ignoreDefaultArgs: ['--disable-extensions']
    };
    let context = await chromium.launchPersistentContext(profile, options);
    try {
        const cdp = await context.browser().newBrowserCDPSession();
        const workerReady = context.waitForEvent('serviceworker', { timeout: 15000 });
        const { id } = await cdp.send('Extensions.loadUnpacked', { path: stage });
        const worker = await workerReady;
        await worker.evaluate(() => chrome.runtime.getManifest());
        await context.route('https://**/*', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('h1');
        assert.equal(await page.locator('h1').textContent(), 'Funcy');
        const result = await page.evaluate(async () => {
            const orders = await chrome.runtime.sendMessage({ action: 'fptOrders', command: 'list' });
            const html = '<a class="tc-item info"><span class="tc-order">#SYNTH001</span><span class="tc-date-time">26 октября 2026, 12:34</span></a>';
            const parsed = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'parseSalesPage', html });
            const malformed = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'parseSalesPage', html: html.replace('26 октября 2026, 12:34', 'сегодня, xx:00') });
            const messages = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'parseChatMessages', chatId: '77', messages: [
                { id: '9007199254740993', author: 200, html: '<div class="chat-msg-text">Synthetic buyer</div>' },
                { id: '9007199254740994', author: 100, html: '<div class="chat-msg-text">Synthetic own</div>' },
                { id: '9007199254740995', author: 0, html: '<div role="alert">Synthetic system</div>' }
            ] });
            return { orders, parsed, malformed, messages, alarms: await chrome.alarms.getAll(), contexts: await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }) };
        });
        assert.equal(result.orders.success, false);
        assert.match(result.orders.error, /аккаунт|авториз|вход/i);
        assert.equal(result.parsed.orders[0].orderDateStrict, Date.UTC(2026, 9, 26, 9, 34));
        assert.equal(result.malformed.orders.length, 1);
        assert.equal(result.malformed.orders[0].orderDateStrict, null);
        assert.equal(result.messages.ok, true);
        assert.deepEqual(result.messages.messages.map(m => m.authorId), ['200', '100', '0']);
        assert.equal(result.messages.messages[0].id, '9007199254740993');
        assert.ok(!result.alarms.some(a => ['fpToolsEngineHeartbeat', 'fpToolsAutoResponder', 'fpToolsAccountKeepalive'].includes(a.name)));
        // CloseDocument follows delivery of the parse response; allow its promise to settle.
        await page.waitForFunction(async () => !(await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length);
        await page.evaluate(async () => {
            await chrome.storage.local.set({ notificationSound: 'tg', fpToolsCustomSoundData: 'local-test-clip',
                fpToolsTheme: { bgImage: 'https://i.ibb.co/ZpS0d56R/PH6-UEvp-Kn-KI.jpg', bgColor1: '#123456' },
                fpToolsAutoReplies: {} });
        });
        await context.close();
        context = await chromium.launchPersistentContext(profile, options);
        const restarted = context.serviceWorkers()[0] || context.waitForEvent('serviceworker', { timeout: 15000 });
        const restartCdp = await context.browser().newBrowserCDPSession();
        await restartCdp.send('Extensions.loadUnpacked', { path: stage });
        const newWorker = await restarted;
        await newWorker.evaluate(() => chrome.runtime.getManifest());
        await context.route('https://**/*', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
        const probe = await context.newPage();
        await probe.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
        await probe.waitForFunction(async () => (await chrome.storage.local.get('notificationSound')).notificationSound === 'default');
        const migrated = await probe.evaluate(() => chrome.storage.local.get(['notificationSound', 'fpToolsCustomSoundData', 'fpToolsTheme']));
        assert.equal(migrated.fpToolsCustomSoundData, 'local-test-clip');
        assert.equal(migrated.fpToolsTheme.bgImage, null);
        assert.equal(migrated.fpToolsTheme.bgColor1, '#123456');
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ version, stagedWorker: true, popup: true, offscreenStrictDate: true, offscreenMessageParser: true, offscreenClosed: true,
            disabledAlarms: true, coldRestartMigration: true, customDataPreserved: true, browser: context.browser().version() }));
    } finally {
        await context.close();
        const resolved = fs.realpathSync(profile);
        if (!resolved.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('funcy-store-smoke-')) throw Error('Unsafe test profile path');
        fs.rmSync(resolved, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
