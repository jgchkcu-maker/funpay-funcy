const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const root = path.join(__dirname, '..');

test('browser: translations, buyer history, pinned migration, and imported CSS stay inert', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><head></head><body><div class="profile-data-container"><div class="offer"><div class="tc"></div></div></div><div id="anchor"></div><div id="message">hello</div></body></html>' }));
        await page.goto('https://funpay.com/users/1/');
        await page.evaluate(() => {
            window.pwned = 0;
            const malicious = '<img src=x onerror="window.pwned=1">';
            window.store = { fpToolsPinnedLots: [{ offerId: '123', nodeId: '2', gameName: malicious,
                html: '<a class="tc-item" href="javascript:window.pwned=2"><div class="tc-desc-text">&lt;img src=x onerror=alert(1)&gt;<img src=x onerror="window.pwned=3"></div><div class="tc-price">10</div></a>' },
                { offerId: '321', title: malicious, sellerName: malicious, sellerId: '2', lotUrl: 'javascript:window.pwned=9' }],
                fpToolsCtxPinnedLots: [{ offerId: '999', nodeId: '2', title: malicious, lotUrl: 'javascript:window.pwned=10' }] };
            window.chrome = { storage: { local: {
                async get(keys, callback) { const data = keys == null ? structuredClone(window.store) : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, window.store[k]])); callback?.(data); return data; },
                async set(data) { Object.assign(window.store, data); }
            } }, runtime: { getManifest: () => ({ version: 'test' }) } };
            window.fetch = async () => ({ json: async () => [[['<b>x</b><img src=x onerror="window.pwned=4">']]] });
        });
        for (const file of ['content/safe_values.js', 'background/retired_integrations.js', 'content/scripts/jquery.js', 'content/features/lot_management.js', 'content/features/buyer_history.js', 'content/features/settings_io.js']) await page.addScriptTag({ path: path.join(root, file) });
        await page.evaluate(async () => {
            await displayPinnedLotsOnLoad();
            await appendTranslation(document.getElementById('message'));
            renderHistoryPanel([{ orderId: 'ABCD1234', desc: '<img src=x onerror="window.pwned=5">', price: '<b>1</b>', date: '<i>now</i>' }, { orderId: '" onclick="window.pwned=6', desc: 'bad' }], '<img src=x onerror="window.pwned=7">', document.getElementById('anchor'));
            await importPopupSettings({ data: { _magic: 'FPTCONFIG', settings: { fpToolsLiveStyles: { body: { color: 'red', width: '1px;}body{display:none', background: 'url(javascript:alert(1))',
                'background-image': 'url(https://example.com/background.png)' } }, fpToolsHeaderButtonStyles: { size: '1px}body{display:none', opacity: 100 } } } });
        });
        await page.addScriptTag({ path: path.join(root, 'content/early_custom_styles.js') });
        await page.addScriptTag({ path: path.join(root, 'content/ui/header_button_styler.js') });
        await page.evaluate(() => loadAndApplyButtonStyles());
        const result = await page.evaluate(() => ({
            pwned, images: document.querySelectorAll('#fp-tools-pinned-lots-container img, #fp-buyer-hist-panel img, .fp-trans-wrap img').length,
            pinned: store.fpToolsPinnedLots[0], href: document.querySelector('#fp-tools-pinned-lots-container a.tc-item').href,
            translation: document.querySelector('.fp-trans-text').textContent, orders: document.querySelectorAll('.fp-bh-item').length,
            display: getComputedStyle(document.body).display, styles: document.getElementById('fp-tools-magic-stick-persistent-styles').textContent
        }));
        assert.equal(result.pwned, 0); assert.equal(result.images, 0); assert.equal(result.orders, 1);
        assert.equal(result.pinned.html, undefined); assert.equal(result.href, 'https://funpay.com/lots/offer?id=123');
        assert.ok(result.translation.startsWith('<b>x</b>')); assert.notEqual(result.display, 'none');
        assert.equal(result.styles, 'body {\n  color: red !important;\n  background-image: url("https://example.com/background.png") !important;\n}\n');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), 'url("https://example.com/background.png")');
        // Quoted HTTPS URLs containing a closing parenthesis cannot escape a CSS declaration.
        const escaped = await page.evaluate(() => {
            const sheet = document.createElement('style');
            sheet.textContent = 'body { background-image: ' + FPTSafe.cssImageUrl('https://example.com/x");}body{display:none}/*') + '; }';
            document.head.appendChild(sheet); return { rules: sheet.sheet.cssRules.length, display: getComputedStyle(document.body).display };
        });
        assert.equal(escaped.rules, 1); assert.notEqual(escaped.display, 'none');
        const nested = await page.evaluate(() => {
            const css = FPTSafe.cssDeclarations({ '.target': { content: `"url('https://example.test/a; } body { display:none; /*')"` } });
            const sheet = document.createElement('style'); sheet.textContent = css; document.head.appendChild(sheet);
            return { css, rules: sheet.sheet.cssRules.length, display: getComputedStyle(document.body).display };
        });
        assert.equal(nested.css, ''); assert.equal(nested.rules, 0); assert.notEqual(nested.display, 'none');
        await page.evaluate(() => {
            const title = '<img src=x onerror="window.pwned=8">';
            window.showNotification = () => {};
            document.querySelector('.profile-data-container').insertAdjacentHTML('beforeend', '<div class="offer" id="context-offer"><div class="offer-list-title"><a href="/lots/2/">Category</a></div><div class="tc"><a class="tc-item" href="/lots/offer?id=321"><div class="tc-desc-text"></div><div class="media-user-name"><span data-href="/users/2/"></span></div></a></div></div>');
            document.querySelector('#context-offer .tc-desc-text').textContent = title;
            document.querySelector('#context-offer .media-user-name span').textContent = title;
        });
        await page.addScriptTag({ path: path.join(root, 'content/features/lot_context_menu.js') });
        await page.waitForSelector('[data-pinned-id="999"]');
        const lot = page.locator('#context-offer a.tc-item:not(.fp-pinned-row)').first();
        await lot.click({ button: 'right' });
        await page.locator('#fp-lot-ctx-menu').getByText('Написать', { exact: false }).click();
        assert.ok((await page.locator('#fp-lot-ctx-chat').textContent()).includes('<img src=x onerror="window.pwned=8">'));
        assert.equal(await page.locator('#fp-lot-ctx-chat img, #fp-lot-ctx-menu img, [data-pinned-id="999"] img').count(), 0);
        assert.equal(await page.locator('[data-pinned-id="999"]').getAttribute('href'), 'https://funpay.com/lots/offer?id=999');
        assert.equal(await page.evaluate(() => pwned), 0);
        const ctxLots = await page.evaluate(() => store.fpToolsCtxPinnedLots);
        assert.ok(ctxLots.some(lot => lot.offerId === '321')); assert.ok(ctxLots.every(lot => !lot.lotUrl));
    } finally { await browser.close(); }
});
