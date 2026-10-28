const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const scope = { accountId: '100', epoch: 1 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const files = ['one.png', 'two.png', 'three.png'].map(name => ({ name, mimeType: 'image/png', buffer: png }));

async function fixture(t, replies = [], dark = false) {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
    await page.goto('https://funpay.com/chat/?node=77');
    await page.setContent(`<html><body style="background:${dark ? '#18191d' : '#edf0f4'};font:14px Arial"><div class="js-main-chat chat" data-id="77"><h2>Тестовый чат</h2><div class="chat-message-list"></div><form class="chat-form"><input name="node" value="77" type="hidden"><div class="chat-form-input"><textarea name="content"></textarea></div><button type="button" class="chat-btn-image" data-size-max="7340032"></button></form></div></body></html>`);
    await page.evaluate(({ replies, dark, scope }) => {
        window.qaCalls = []; window.qaNotices = [];
        window.showNotification = (text, error) => qaNotices.push({ text, error });
        window.fptParseMenuColors = () => ({ isLight: !dark });
        window.chrome = { runtime: { sendMessage(message, callback) {
            qaCalls.push(message);
            const reply = replies.length ? replies.shift() : { ok: true, result: { accountScope: scope } };
            setTimeout(() => callback(reply), 5);
        } } };
    }, { replies, dark, scope });
    for (const file of ['css/page_windows.css', 'css/content_styles.css']) await page.addStyleTag({ path: path.join(root, file) });
    const font = fs.readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
    await page.addStyleTag({ content: `@font-face{font-family:'Material Symbols Rounded';src:url(data:font/woff2;base64,${font})}.material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;font-feature-settings:'liga'}` });
    const popupSource = fs.readFileSync(path.join(root, 'content/ui/main_popup.js'), 'utf8');
    await page.addScriptTag({ content: popupSource.slice(popupSource.indexOf('function fptMenuPalette('), popupSource.indexOf('const FP_WALLPAPER_PRESETS')) });
    for (const file of ['content/ui/page_windows.js', 'content/features/chat_image_attach.js']) await page.addScriptTag({ path: path.join(root, file) });
    return { page, errors };
}

async function selectFiles(page, chosen = files) {
    const picker = page.waitForEvent('filechooser');
    await page.locator('.fpt-attach-btn').click();
    const input = await picker;
    assert.equal(input.isMultiple(), true);
    const images = await page.evaluate(names => names.map((name, i) => {
        const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 320;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = ['#a9b9ef', '#a6d9c5', '#f3c5a6'][i % 3]; ctx.fillRect(0, 0, 480, 320);
        ctx.fillStyle = '#243043'; ctx.font = '36px sans-serif'; ctx.fillText('Фото ' + (i + 1), 40, 100);
        return canvas.toDataURL().split(',')[1];
    }), chosen.map(f => f.name));
    await input.setFiles(chosen.map((f, i) => ({ ...f, buffer: Buffer.from(images[i], 'base64') })));
    await page.waitForFunction(n => document.querySelectorAll('.is-open:not(.is-closing) .fpt-tg-cell').length === n, chosen.length);
}

test('multi-select keeps all photos and posts three images before the caption', async t => {
    const { page, errors } = await fixture(t);
    await page.locator('textarea[name=content]').fill('Моя подпись');
    await selectFiles(page);
    assert.equal(await page.locator('.is-open #fptTgMsg').inputValue(), 'Моя подпись');
    assert.equal(await page.locator('textarea[name=content]').inputValue(), '');
    await page.locator('.is-open .fpt-tg-send').click();
    await page.waitForFunction(() => qaCalls.length === 4);
    const calls = await page.evaluate(() => qaCalls);
    assert.deepEqual(calls.map(c => c.action), ['fptSendImage', 'fptSendImage', 'fptSendImage', 'fptSendChatText']);
    assert.deepEqual(calls.slice(0, 3).map(c => c.fileName), ['one.png', 'two.png', 'three.png']);
    assert.equal(new Set(calls.slice(0, 3).map(c => c.sendId)).size, 3);
    assert.deepEqual(calls[1].accountScope, scope);
    assert.deepEqual(calls[3].accountScope, scope);
    assert.equal(calls[3].text, 'Моя подпись');
    assert.deepEqual(errors, []);
});

test('partial rejection restores only unsent photos with caption and does not send caption early', async t => {
    const { page, errors } = await fixture(t, [{ ok: true }, { ok: false, status: 'rejected', error: 'flood' }]);
    await selectFiles(page);
    await page.locator('.is-open #fptTgMsg').fill('Подпись');
    await page.locator('.is-open .fpt-tg-send').click();
    await page.waitForFunction(() => document.querySelectorAll('.is-open:not(.is-closing) .fpt-tg-cell').length === 2);
    assert.equal(await page.locator('.is-open:not(.is-closing) #fptTgMsg').inputValue(), 'Подпись');
    assert.equal(await page.evaluate(() => qaCalls.length), 2);
    await page.locator('.is-open:not(.is-closing) .fpt-tg-send').click();
    await page.waitForFunction(() => qaCalls.length === 5);
    const calls = await page.evaluate(() => qaCalls);
    assert.deepEqual(calls.map(c => c.fileName || c.text), ['one.png', 'two.png', 'two.png', 'three.png', 'Подпись']);
    assert.deepEqual(errors, []);
});

test('ambiguous response stops the album without retrying the possibly delivered image', async t => {
    const { page, errors } = await fixture(t, [{ ok: false, status: 'uncertain', error: 'timeout' }]);
    await selectFiles(page);
    await page.locator('.is-open .fpt-tg-send').click();
    await page.waitForFunction(() => document.querySelectorAll('.is-open:not(.is-closing) .fpt-tg-cell').length === 2);
    assert.equal(await page.evaluate(() => qaCalls.length), 1);
    assert.ok((await page.evaluate(() => qaNotices)).some(n => n.text.includes('Проверьте чат')));
    await page.locator('.is-open:not(.is-closing) .fpt-tg-send').click();
    await page.waitForFunction(() => qaCalls.length === 3);
    assert.deepEqual(await page.evaluate(() => qaCalls.map(c => c.fileName)), ['one.png', 'two.png', 'three.png']);
    assert.deepEqual(errors, []);
});

test('switching chat after selecting files blocks sending', async t => {
    const { page } = await fixture(t);
    await selectFiles(page);
    await page.evaluate(() => { document.querySelector('[name=node]').value = '88'; });
    await page.locator('.is-open .fpt-tg-send').click();
    assert.equal(await page.evaluate(() => qaCalls.length), 0);
    assert.equal(await page.locator('.is-open .fpt-tg-cell').count(), 3);
});

test('caption rejection preserves a caption-only draft; cancellation keeps newly typed text', async t => {
    const { page } = await fixture(t, [{ ok: true }, { ok: false, status: 'rejected', error: 'caption refused' }]);
    await selectFiles(page, files.slice(0, 1));
    await page.locator('.is-open #fptTgMsg').fill('Сохранить подпись');
    await page.locator('.is-open .fpt-tg-send').click();
    await page.waitForFunction(() => document.querySelector('.is-open:not(.is-closing) .fpt-win-title')?.textContent === 'Неотправленная подпись');
    await page.locator('textarea[name=content]').evaluate(el => { el.value = 'Новый текст'; });
    await page.locator('.is-open:not(.is-closing) .fpt-tg-cancel').click();
    assert.equal(await page.locator('textarea[name=content]').inputValue(), 'Новый текст\nСохранить подпись');
    assert.equal(await page.evaluate(() => qaCalls.length), 2);
});

test('album window renders in light and dark themes', async t => {
    for (const dark of [false, true]) {
        const { page, errors } = await fixture(t, [], dark);
        await selectFiles(page);
        await page.locator('.is-open #fptTgMsg').fill('Три фото — затем подпись');
        await page.waitForFunction(() => [...document.querySelectorAll('.is-open, .is-open .fpt-win')].every(el => getComputedStyle(el).opacity === '1'));
        await page.evaluate(() => document.fonts.ready);
        const colors = await page.locator('.is-open .fpt-tg-msg').evaluate(el => ({ text: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
        assert.equal(colors.bg, dark ? 'rgb(49, 54, 64)' : 'rgb(255, 255, 255)');
        assert.notEqual(colors.text, colors.bg);
        const output = path.join(root, 'scratchpad/chat-image-repair');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, dark ? 'album-dark.png' : 'album-light.png') });
        assert.deepEqual(errors, []);
    }
});
