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
        await page.setContent(`<body data-app-data='{"userId":100}'><div class="fp-tools-popup fptm-themed active"><div class="fp-tools-page-content active" data-page="auto_orders" id="host"></div></div></body>`);
        for (const file of ['css/content_styles.css', 'css/popup_categories.css', 'css/automation.css']) await page.addStyleTag({ path: path.join(root, file) });
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
                if (message.command === 'list') return { success: true, data: { counts: { attention: 1, delivery: 1, done: 0, all: 1 }, items: message.filter === 'done' ? [] : [order] } };
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
        await page.addScriptTag({ path: path.join(root, 'content/ui/auto_orders_page.js') });
        await page.evaluate(() => window.FPTAutoOrdersPage.mount(document.querySelector('.fp-tools-popup')));
        assert.equal(await page.locator('#host > .fpt-category-header .fpt-category-title').textContent(), 'Заказы и выдачи');
        await page.locator('.fpt-auto-card').waitFor();
        assert.match(await page.locator('.fpt-auto-card').innerText(), /Исход неясен/);
        // Header, hero and filters follow the «Быстрые ответы» layout and motion.
        assert.equal(await page.locator('#host > .fpt-category-header .fpt-category-help').count(), 1, 'the header has the shared help button');
        await page.locator('#host .fpt-category-help').click();
        assert.equal(await page.locator('#fpt-ord-help').isVisible(), true);
        assert.equal(await page.locator('#fpt-ord-help').evaluate(el => getComputedStyle(el).animationName), 'fpt-ad-panel-in');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#fpt-ord-help').isHidden(), true);
        const layout = await page.locator('#host > .fpt-auto-orders').evaluate(view => {
            const css = getComputedStyle(view);
            return { marginTop: css.marginTop, gap: css.rowGap, display: css.display, first: view.firstElementChild.className };
        });
        assert.deepEqual(layout, { marginTop: '8px', gap: '18px', display: 'grid', first: 'fpt-qr-hero fpt-ord-hero' }, 'same rhythm as .fpt-quick-replies');
        assert.equal(await page.locator('.fpt-ord-hero').getAttribute('data-state'), 'on');
        assert.equal(await page.locator('.fpt-ord-hero-pill').textContent(), 'Нужно ваше решение');
        assert.deepEqual(await page.locator('.fpt-ord-metrics .fpt-qr-metric-value').allTextContents(), ['1', '1', '0']);
        assert.equal(await page.locator('.fpt-ord-metric').first().getAttribute('data-tone'), 'warning');
        assert.equal(await page.locator('.fpt-ord-tabs .fpt-qr-tab').count(), 4);
        assert.equal(await page.locator('.fpt-ord-tabs .fpt-qr-tabs-pill').evaluate(el => getComputedStyle(el).transitionProperty), 'transform');
        assert.equal(await page.locator('.fpt-ord-list').evaluate(el => getComputedStyle(el).animationName), 'fpt-ad-panel-in', 'the list enters like a quick replies pane');
        assert.equal(await page.locator('.fpt-ord-list .fpt-auto-card').evaluate(el => getComputedStyle(el).animationName), 'fpt-fin-pane-in');
        const pillBefore = await page.locator('.fpt-ord-tabs .fpt-qr-tabs-pill').boundingBox();
        await page.locator('#fpt-ord-tab-done').click();
        await page.waitForFunction(() => document.querySelector('.fpt-ord-list .fpt-ord-empty'));
        assert.equal(await page.locator('#fpt-ord-tab-done').getAttribute('aria-selected'), 'true');
        await page.waitForTimeout(450);
        assert.deepEqual(await page.locator('.fpt-ord-empty > .material-symbols-rounded').evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return [Math.round(bounds.width), Math.round(bounds.height)];
        }), [48, 48], 'the empty-state check stays circular despite page icon styles');
        const pillAfter = await page.locator('.fpt-ord-tabs .fpt-qr-tabs-pill').boundingBox();
        assert.ok(pillAfter.x > pillBefore.x + 100, 'the thumb slides to the selected filter');
        await page.locator('#fpt-ord-tab-attention').click();
        await page.locator('.fpt-auto-card').waitFor();
        assert.deepEqual(await page.locator('.fpt-ord-toolbar .fpt-toolbar-button').evaluate(el => {
            const css = getComputedStyle(el);
            return [Math.round(el.getBoundingClientRect().height), css.borderTopLeftRadius, css.fontSize];
        }), [40, '12px', '14px'], '«Обновить» uses the shared toolbar button');
        assert.equal(await page.locator('.fpt-ord-tabs').evaluate(element =>
            Math.round(element.getBoundingClientRect().height)), 40, 'filters match the refresh height');
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'orders.png') });
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
        await page.keyboard.press('Escape');
        await page.locator('.fpt-lot-dialog-backdrop').evaluate(el => el.remove()).catch(() => {});
        await page.locator('#host').evaluate(el => { el.style.setProperty('width', '400px', 'important'); });
        await page.waitForTimeout(450);
        const narrow = await page.locator('#host').evaluate(host => {
            const tabs = host.querySelector('.fpt-ord-tabs');
            const pill = tabs.querySelector('.fpt-qr-tabs-pill').getBoundingClientRect();
            const selected = tabs.querySelector('[aria-selected="true"]').getBoundingClientRect();
            return {
                overflow: host.scrollWidth - host.clientWidth,
                metricsColumns: getComputedStyle(host.querySelector('.fpt-ord-metrics')).gridTemplateColumns.split(' ').length,
                pillOnSelected: Math.abs(pill.left - selected.left) < 2 && Math.abs(pill.top - selected.top) < 2
            };
        });
        assert.deepEqual(narrow, { overflow: 0, metricsColumns: 1, pillOnSelected: true }, 'narrow layout stacks metrics and keeps the thumb on the selected filter');
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'orders-narrow.png') });
    } finally {
        await browser.close();
    }
});
