const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const root = path.join(__dirname, '..');

async function openEditor(browser, { methods = [{ unit: '₽', price: '110000' }], disabled = [], fail = false } = {}) {
    const page = await browser.newPage();
    await page.setContent(`<h1 class="page-header">Редактирование предложения</h1>
        <form class="form-offer-editor"><input name="node_id" value="42">
        <div class="form-group"><input name="price" value="100"></div></form>`);
    await page.evaluate(({ methods, disabled, fail }) => {
        window.chrome = { storage: {
            local: { get: async () => ({ fpToolsDisabledFeatures: disabled }) },
            onChanged: { addListener() {} }
        } };
        window.fetch = async () => ({ ok: !fail, json: async () => ({ methods }) });
        window.createElement = (tag, attrs, styles, text) => {
            const el = document.createElement(tag);
            for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
            Object.assign(el.style, styles); el.textContent = text; return el;
        };
    }, { methods, disabled, fail });
    for (const file of ['feature_registry', 'feature_disabler', 'exact_price']) {
        await page.addScriptTag({ path: path.join(root, `content/features/${file}.js`) });
    }
    return page;
}

for (const buyerFirst of [false, true]) {
    test(`pricing: real scripts preserve conversions and fallback, buyerFirst=${buyerFirst}`, async () => {
        const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
        try {
            const page = await openEditor(browser);
            if (!buyerFirst) await page.evaluate(() => initializeExactPrice());
            await page.addScriptTag({ path: path.join(root, 'content/features/buyer_price_field.js') });
            await page.waitForFunction(() => window.FPTBuyerPriceActive === true);
            if (buyerFirst) await page.evaluate(() => initializeExactPrice());
            assert.equal(await page.locator('.set-exact-price').isVisible(), false);
            await page.locator('input[name="price"]').fill('200,50');
            assert.equal(await page.inputValue('#fpt-buyer-price-input'), '220,55');
            await page.evaluate(() => {
                document.activeElement.blur(); // Commit the seller edit before observing buyer conversion.
                window.inputEvents = [];
                for (const type of ['input', 'change']) document.querySelector('input[name="price"]').addEventListener(type, () => inputEvents.push(type));
            });
            await page.locator('#fpt-buyer-price-input').fill('110,00');
            assert.equal(await page.inputValue('input[name="price"]'), '100');
            assert.deepEqual(await page.evaluate(() => inputEvents), ['input', 'change']);
            await page.evaluate(() => fptApplyDisabledCss(['buyer_price_field']));
            assert.equal(await page.locator('#fpt-buyer-price-group').isVisible(), false);
            assert.equal(await page.locator('.set-exact-price').isVisible(), true);
            await page.evaluate(() => fptApplyDisabledCss([]));
            assert.equal(await page.locator('#fpt-buyer-price-group').isVisible(), true);
            assert.equal(await page.locator('.set-exact-price').isVisible(), false);
            await page.evaluate(() => { document.getElementById('fpt-buyer-price-group').hidden = true; });
            await page.waitForFunction(() => window.FPTBuyerPriceActive === false);
            assert.equal(await page.locator('.set-exact-price').isVisible(), true);
        } finally { await browser.close(); }
    });
}

test('pricing: initially disabled field and unavailable ruble fees preserve seller input and fallback', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        for (const options of [
            { disabled: ['buyer_price_field'] },
            { methods: [{ unit: '$', price: '1200' }, { unit: '€', price: '1100' }] },
            { fail: true }
        ]) {
            const page = await openEditor(browser, options);
            await page.evaluate(() => initializeExactPrice());
            await page.addScriptTag({ path: path.join(root, 'content/features/buyer_price_field.js') });
            await page.waitForFunction(() => window.FPTBuyerPriceActive === false);
            assert.equal(await page.inputValue('input[name="price"]'), '100');
            assert.equal(await page.locator('.set-exact-price').isVisible(), true);
            if (options.disabled) {
                await page.evaluate(() => fptApplyDisabledCss([]));
                await page.waitForFunction(() => window.FPTBuyerPriceActive === true);
                assert.equal(await page.locator('.set-exact-price').isVisible(), false);
            }
            await page.close();
        }
    } finally { await browser.close(); }
});
