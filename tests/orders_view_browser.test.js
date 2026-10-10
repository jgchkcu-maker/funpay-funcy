const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

test('orders journal lists orders by decision and the card only offers allowed actions', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        await page.setContent(`<body data-app-data='{"userId":100}'><div class="fp-tools-popup fptm-themed active"><div id="host"></div></div></body>`);
        for (const file of ['css/content_styles.css', 'css/popup_shared.css', 'css/popup_categories.css', 'css/automation.css']) await page.addStyleTag({ path: path.join(root, file) });
        const iconFont = fs.readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
        await page.addStyleTag({ content: `@font-face { font-family: 'Material Symbols Rounded'; src: url(data:font/woff2;base64,${iconFont}) format('woff2'); }
            body { margin: 0; font-family: Arial, sans-serif; } .fp-tools-popup { position: relative; width: 1100px; height: 900px; padding: 16px; box-sizing: border-box; overflow: auto; }
            .fp-tools-popup.fptm-themed { --fptm-bg: #fff; --fptm-surface: #f7f9f8; --fptm-text: #18201d; --fptm-muted: #59645f; --fptm-border: #d7e0db;
            --fptm-accent: #247653; --fptm-accent-soft: #e5f2ec; --fptm-accent-border: #8cb6a2; --fptm-nav-border: #d7e0db; --fptm-nav-field: #f4f7f5; }` });
        await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
        await page.evaluate(() => {
            window.qaCalls = [];
            const order = { key: '100:ABCD1234', orderId: 'ABCD1234', revision: 4, buyerName: 'QA', lotName: 'Ключ Steam', quantity: 2, fpStatus: 'paid',
                deliveryState: 'uncertain', resultCoverage: 'full', holds: [], blockReasons: [], adopted: true, source: 'funpay_secrets', updatedAt: Date.now() };
            window.chrome = { runtime: { sendMessage: async message => {
                window.qaCalls.push(message);
                if (message.action !== 'fptOrders') return { success: true };
                if (message.command === 'list') return { success: true, data: { counts: { attention: 1, delivery: 1, done: 0, all: 1 }, items: [order] } };
                if (message.command === 'card') return { success: true, data: {
                    order: { ...order, offerId: '987' },
                    parts: [{ partId: 'p#0', index: 0, state: 'confirmed', preview: 'KEY•••••11' }, { partId: 'p#1', index: 1, state: 'uncertain', preview: 'KEY•••••22', error: 'FunPay не ответил вовремя.' }],
                    events: [{ type: 'delivery.result', at: Date.now(), data: { summary: 'uncertain' } }],
                    capabilities: [{ id: 'verify', label: 'Проверить заказ' }, { id: 'resendPart', label: 'Отправить часть 2 ещё раз', partId: 'p#1', warning: 'Сообщение могло уже дойти.' }]
                } };
                return { success: true, data: { status: 'done' } };
            } } };
        });
        await page.addScriptTag({ path: path.join(root, 'content/ui/popup_actions.js') });
        await page.addScriptTag({ path: path.join(root, 'content/ui/automation_ui.js') });
        await page.addScriptTag({ path: path.join(root, 'content/ui/orders_view.js') });
        await page.evaluate(() => window.FPTOrdersView.mount(document.getElementById('host'), document.querySelector('.fp-tools-popup')).load());
        await page.locator('.fpt-auto-card').waitFor();
        assert.match(await page.locator('.fpt-auto-card').innerText(), /Исход неясен/);
        await page.getByRole('button', { name: 'Открыть карточку' }).click();
        await page.locator('.fpt-lot-dialog .fpt-auto-table').waitFor();
        assert.match(await page.locator('.fpt-lot-dialog').innerText(), /KEY•••••22/);
        assert.doesNotMatch(await page.locator('.fpt-lot-dialog').innerText(), /Повторить\b/, 'there is no generic retry');
        page.on('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Отправить часть 2 ещё раз' }).click();
        await page.waitForFunction(() => window.qaCalls.some(call => call.orderCommand === 'resendPart'));
        const call = await page.evaluate(() => window.qaCalls.find(item => item.orderCommand === 'resendPart'));
        assert.equal(call.partId, 'p#1');
        assert.equal(call.expectedRevision, 4);
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'orders.png') });
    } finally {
        await browser.close();
    }
});
