const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { openQuickReplies } = require('./helpers/quick_replies_browser_harness');
const root = path.join(__dirname, '..');
const launch = () => chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ignoreDefaultArgs: ['--hide-scrollbars'] });

test('real Chrome popup scrollbars stay neutral across blue/red themes; site preview stays editable', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openQuickReplies(browser, {}, { width: 1200, height: 650 });
        await page.addStyleTag({ path: path.join(root, 'css/scrollbars.css') });
        await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            popup.classList.add('fptm-themed');
            popup._fptNavSections.setExpandedSections(['sales', 'customers', 'finance', 'interface', 'settings', 'help'], false);
            const demo = document.createElement('div');
            demo.innerHTML = '<div id="qa-popup-scroll" style="overflow:auto;height:120px;width:260px"><div style="height:600px;width:600px">Прокрутка попапа</div></div><textarea id="qa-popup-textarea" style="height:70px;width:260px"></textarea><div class="fpt-th-stage"><div id="qa-preview-scroll" style="overflow:auto;height:60px;width:260px"><div style="height:200px">Предпросмотр страницы</div></div></div>';
            document.querySelector('.fp-tools-content').append(demo);
            document.querySelector('#qa-popup-textarea').value = Array.from({ length: 50 }, (_, i) => `Строка ${i}`).join('\n');
        });
        await page.addStyleTag({ content: '.fp-tools-popup.fptm-themed .fp-tools-nav::-webkit-scrollbar-thumb{background:var(--fptm-border)!important} #qa-preview-scroll::-webkit-scrollbar-thumb{background:var(--fptm-border)!important}' });
        const inspect = () => page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            const bounds = popup.getBoundingClientRect();
            return { colors: ['.fpt-nav-scroll', '.fp-tools-content', '#qa-popup-scroll', '#qa-popup-textarea'].map(selector => getComputedStyle(document.querySelector(selector), '::-webkit-scrollbar-thumb').backgroundColor),
                preview: getComputedStyle(document.querySelector('#qa-preview-scroll'), '::-webkit-scrollbar-thumb').backgroundColor,
                bounds: [bounds.x, bounds.y, bounds.width, bounds.height] };
        });
        await page.evaluate(() => document.querySelector('.fp-tools-popup').style.setProperty('--fptm-border', '#0088ff'));
        const blue = await inspect();
        await page.evaluate(() => document.querySelector('.fp-tools-popup').style.setProperty('--fptm-border', '#ff2200'));
        const red = await inspect();
        assert.deepEqual(blue.colors, Array(4).fill('rgb(115, 121, 133)'));
        assert.deepEqual(red.colors, blue.colors);
        assert.equal(blue.preview, 'rgb(0, 136, 255)'); assert.equal(red.preview, 'rgb(255, 34, 0)');
        assert.deepEqual(red.bounds, blue.bounds);
        const scroll = await page.evaluate(() => {
            const elements = ['.fpt-nav-scroll', '#qa-popup-scroll', '#qa-popup-textarea'].map(s => document.querySelector(s));
            elements.forEach(el => { el.scrollTop = 50; });
            document.querySelector('#qa-popup-scroll').scrollLeft = 50;
            return { vertical: elements.map(el => el.scrollTop), horizontal: document.querySelector('#qa-popup-scroll').scrollLeft };
        });
        assert.ok(scroll.vertical.every(value => value > 0), JSON.stringify(scroll)); assert.equal(scroll.horizontal, 50);
        const dir = path.join(root, 'artifacts/release-0.9.11-2026-10-26'); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, 'popup-neutral-scrollbars.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('offscreen parses synthetic message IDs/authors/body without preview or author-name inference', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.setContent('<html><body></body></html>');
        await page.evaluate(() => { window.chrome = { runtime: { onMessage: { addListener() {} } } }; });
        await page.addScriptTag({ path: path.join(root, 'offscreen/offscreen.js') });
        const result = await page.evaluate(() => parseChatMessages([
            { id: '9007199254740993', author: 200, html: '<div class="media-user-name">Имя</div><div class="chat-msg-text">ключ<br>A&amp;B</div>' },
            { id: 12, author: 0, html: '<div role="alert">оплатил заказ #ABCDEFGH</div>' },
            { id: 13, html: '<div data-author="100"><div class="chat-msg-text">чужое имя не автор</div></div>' },
            { id: 14, author: 100, html: '<a class="chat-img-link" href="https://example.test/image"></a>' }
        ], '77'));
        assert.equal(result.ok, true);
        assert.equal(result.messages[0].id, '9007199254740993'); assert.equal(result.messages[0].text, 'ключ\nA&B');
        assert.deepEqual(result.messages.map(m => m.authorId), ['200', '0', null, '100']);
        assert.equal(result.messages[3].kind, 'image');
        assert.equal(await page.evaluate(() => parseChatMessages([{ id: 9007199254740992, author: 100, html: '' }], '77').ok), false);
    } finally { await browser.close(); }
});
