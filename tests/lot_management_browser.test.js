const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

async function openProfile() {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
            <h5 class="mb10 text-bold">Предложения</h5>
            <div class="profile-data-container"><div class="offer" id="category">
                <div class="offer-list-title"><h3><a href="/lots/42/">Категория</a></h3></div>
                <div class="tc"><div class="tc-header"></div>
                    <a class="tc-item" id="lot-101" href="/lots/offer?id=101"><div class="tc-desc"><div class="tc-desc-text">Первый</div></div><div class="tc-price">100 ₽</div></a>
                    <a class="tc-item" id="lot-102" href="/lots/offer?id=102"><div class="tc-desc"><div class="tc-desc-text">Второй</div></div><div class="tc-price">200 ₽</div></a>
                </div>
            </div></div>` }));
        await page.goto('https://funpay.com/users/100/');
        await page.addStyleTag({ path: path.join(root, 'css/page_windows.css') });
        await page.evaluate(() => {
            document.body.dataset.appData = JSON.stringify({ userId: '100', 'csrf-token': 'test' });
            window.qaStore = { fpToolsPinnedLots: [] };
            window.qaWrites = [];
            window.qaNotifications = [];
            window.chrome = { storage: { local: {
                async get(keys) {
                    return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(window.qaStore[key])]));
                },
                async set(data) { Object.assign(window.qaStore, structuredClone(data)); }
            } } };
            window.showNotification = message => window.qaNotifications.push(message);
            window.fptLotWrite = async message => { window.qaWrites.push(message); return {}; };
        });
        for (const file of ['content/scripts/jquery.js', 'content/ui/page_windows.js', 'content/features/lot_management.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        await page.evaluate(() => initializeLotManagement());
        await page.locator('#fp-tools-select-lots-btn').click();
        return { browser, page, errors };
    } catch (error) { await browser.close(); throw error; }
}

const buttonState = page => page.evaluate(() => ({
    pin: $('.action-lot.pin-lot').css('display') !== 'none',
    unpin: $('.action-lot.unpin-lot').css('display') !== 'none'
}));

test('category and select-all checkboxes preserve pin button states without promise errors', async () => {
    const { browser, page, errors } = await openProfile();
    try {
        await page.evaluate(() => $('#category .fp-tools-category-selector input').prop('checked', true).trigger('change'));
        assert.equal(await page.locator('.tc-item input:checked').count(), 2);
        await page.evaluate(() => updatePinButtonsState());
        assert.deepEqual(await buttonState(page), { pin: true, unpin: false });

        await page.evaluate(async () => {
            qaStore.fpToolsPinnedLots = [{ offerId: '101' }];
            await updatePinButtonsState();
        });
        assert.deepEqual(await buttonState(page), { pin: true, unpin: true });

        await page.evaluate(async () => {
            qaStore.fpToolsPinnedLots.push({ offerId: '102' });
            await updatePinButtonsState();
        });
        assert.deepEqual(await buttonState(page), { pin: false, unpin: true });

        await page.locator('#fp-tools-select-all-lots').uncheck();
        await page.evaluate(() => updatePinButtonsState());
        assert.equal(await page.locator('.tc-item input:checked').count(), 0);
        assert.deepEqual(await buttonState(page), { pin: false, unpin: false });
        await page.locator('#fp-tools-select-all-lots').check();
        await page.evaluate(() => updatePinButtonsState());
        assert.equal(await page.locator('.tc-item input:checked').count(), 2);
        assert.deepEqual(await buttonState(page), { pin: false, unpin: true });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('pin and unpin skip a row without href and still process a valid selected lot', async () => {
    const { browser, page, errors } = await openProfile();
    try {
        await page.evaluate(() => {
            $('#lot-102').removeAttr('href');
            $('#fp-tools-select-all-lots').prop('checked', true).trigger('change');
        });
        await page.evaluate(() => updatePinButtonsState());
        await page.locator('.action-lot.pin-lot').click();
        await page.waitForFunction(() => qaStore.fpToolsPinnedLots.length === 1 && !document.querySelector('.pin-lot').disabled);
        assert.equal(await page.evaluate(() => qaStore.fpToolsPinnedLots[0].offerId), '101');
        assert.equal(await page.locator('#fp-tools-pinned-lots-container .tc-item').count(), 1);
        await page.evaluate(() => $('#lot-101 input').prop('checked', true).trigger('change'));
        await page.evaluate(() => updatePinButtonsState());
        await page.locator('.action-lot.unpin-lot').click();
        await page.waitForFunction(() => qaStore.fpToolsPinnedLots.length === 0 && !document.querySelector('.unpin-lot').disabled);
        assert.equal(await page.locator('#fp-tools-pinned-lots-container').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('missing category href does not crash pinning, activation or price editing', async () => {
    const { browser, page, errors } = await openProfile();
    try {
        await page.evaluate(() => {
            $('#category .offer-list-title a').removeAttr('href');
            $('#lot-101 input').prop('checked', true).trigger('change');
        });
        await page.evaluate(() => updatePinButtonsState());
        await page.locator('.action-lot.pin-lot').click();
        await page.waitForFunction(() => !document.querySelector('.pin-lot').disabled && !document.querySelector('#lot-101 input').checked);
        assert.equal(await page.evaluate(() => qaStore.fpToolsPinnedLots.length), 0);

        await page.evaluate(() => $('#lot-101 input').prop('checked', true).trigger('change'));
        await page.locator('.action-lot.deactivate-lot').click();
        await page.waitForFunction(() => !document.querySelector('.deactivate-lot').disabled);
        assert.match(await page.evaluate(() => qaNotifications.at(-1)), /ошибки: 1/);

        await page.locator('.action-lot.price-editor').click();
        await page.locator('#fp-price-change-input').fill('150');
        await page.locator('#fp-price-editor-apply').click();
        await page.waitForFunction(() => !document.querySelector('.price-editor').disabled);
        assert.match(await page.locator('.actions .log').textContent(), /ошибки: 1/);
        assert.deepEqual(await page.evaluate(() => qaWrites), []);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
