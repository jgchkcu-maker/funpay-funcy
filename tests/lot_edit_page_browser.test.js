const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');

test('offscreen lot editor preserves fields and reports pages without an editor through messages', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        await page.evaluate(() => {
            window.chrome = { runtime: {
                onMessage: { addListener(listener) { window.qaMessage = listener; } },
                sendMessage: () => Promise.resolve()
            } };
            window.qaParse = (html, detailed) => new Promise(resolve => window.qaMessage({ target: 'offscreen', action: 'parseLotEditPage', html, detailed }, {}, resolve));
        });
        await page.addScriptTag({ path: path.join(__dirname, '../offscreen/offscreen.js') });
        const valid = `<form class="form-offer-editor">
            <input name="csrf_token" value="csrf"><input name="node_id" value="42">
            <input name="price" value="120" readonly><input name="amount" value="2">
            <input name="location" value="offer"><input type="checkbox" name="active" checked>
            <input type="checkbox" name="auto_delivery" checked>
            <select name="server_id"><option value="5" selected>EU</option></select>
            <textarea name="fields[desc][ru]">  Description\n\n  Line 2  </textarea>
            <textarea name="fields[payment_msg][en]">Buyer message</textarea>
            <textarea name="secrets">KEY-1\nKEY-2</textarea>
        </form>`;
        const parse = (html, detailed = true) => page.evaluate(([markup, flag]) => window.qaParse(markup, flag), [html, detailed]);
        const expected = { csrf_token: 'csrf', node_id: '42', price: '120', amount: '2', active: 'on', auto_delivery: 'on', server_id: '5', 'fields[desc][ru]': 'Description\n\nLine 2', 'fields[payment_msg][en]': 'Buyer message', secrets: 'KEY-1\nKEY-2' };
        assert.deepEqual(await parse(valid), { ok: true, data: expected });
        assert.deepEqual(await parse(valid, false), expected, 'legacy callers still receive a field dictionary');
        const errors = [];
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        for (const [html, code] of [
            ['<title>Just a moment...</title><form id="challenge-form"></form>', 'browser_check'],
            ['<title>Один момент...</title>', 'browser_check'],
            ['<title>FunPay</title><script src="/cdn-cgi/challenge-platform/h/g/orchestrate"></script>', 'browser_check'],
            ["<form action='/account/login'><input name='login'></form>", 'login_required'],
            ['<h1 class="page-header">Предложение не найдено</h1>', 'offer_not_found'],
            ['<h1>Offer not found</h1>', 'offer_not_found'],
            ['<h1>Unexpected page</h1>', 'form_missing'],
            ['', 'form_missing']
        ]) {
            const result = await parse(html);
            assert.equal(result.ok, false);
            assert.equal(result.error.code, code);
            assert.ok(result.error.message.length > 0);
            assert.equal(await parse(html, false), null);
        }
        assert.deepEqual(errors, [], 'expected remote-page failures do not become parser exceptions');
        assert.deepEqual(await parse(valid), { ok: true, data: expected }, 'reused document does not retain a previous error page');
        assert.equal((await parse(valid.replace('name="auto_delivery" checked', 'name="auto_delivery"'))).data.auto_delivery, '');
    } finally {
        await browser.close();
    }
});
