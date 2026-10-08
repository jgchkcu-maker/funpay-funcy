const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'offscreen/offscreen.js'), 'utf8');
const start = source.indexOf('function fptOrderParamItems(doc) {');
const end = source.indexOf('\nfunction parseSupportTickets(html) {');
const parserSource = source.slice(start, end);
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/order_page_paid.html'), 'utf8');

async function parse(browser, html) {
    const page = await browser.newPage();
    try {
        await page.setContent('<html><body></body></html>');
        return await page.evaluate(({ code, html }) => {
            window.__fptParseHTML = markup => new DOMParser().parseFromString(markup, 'text/html');
            // eslint-disable-next-line no-new-func
            new Function(`${code}\nwindow.__parse = parseOrderPageForDelivery;`)();
            return window.__parse(html);
        }, { code: parserSource, html });
    } finally {
        await page.close();
    }
}

test('order page parser reads lot, category, quantity, status and buyer from real DOM', async () => {
    assert.ok(start > 0 && end > start, 'parser block must be found in offscreen.js');
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const info = await parse(browser, fixture);
        assert.deepEqual(info, {
            secrets: 'KEY-1111\nKEY-2222',
            lotId: '987654',
            nodeId: '42',
            nodeType: 'lots',
            amount: 2,
            status: 'paid',
            buyerChatId: '31337',
            buyerId: '555',
            buyerUsername: 'QA Buyer',
            lotName: 'Steam ключ Elden Ring',
            category: 'Ключи'
        });

        // Without the offer link the parser must not pick up any other "id=" link.
        const noLink = await parse(browser, fixture
            .replace('<div class="order-desc"><a href="https://funpay.com/lots/offer?id=987654">Открыть лот</a></div>', '')
            .replace('<h5>Статус</h5><div class="text-warning">Оплачен</div>', '<h5>Статус</h5><div class="text-success">Закрыт</div>')
            .replace('2 шт.', ''));
        assert.equal(noLink.lotId, null, 'balance?id= or offerEdit?id= must never be taken for the lot');
        assert.equal(noLink.nodeId, '42');
        assert.equal(noLink.status, 'closed');
        assert.equal(noLink.amount, null);
    } finally {
        await browser.close();
    }
});
