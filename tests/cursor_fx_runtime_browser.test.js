const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openSite } = require('./helpers/perf_browser_harness');

test('cursor runtime stays absent while disabled and initializes once on either mode', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSite(browser);
        assert.equal(await page.locator('#fp-tools-cursor-fx, #fp-tools-custom-cursor, #fp-tools-cursor-hide-style').count(), 0);
        await page.evaluate(() => qaExternal({ fpToolsCustomCursor: { enabled: true, image: 'javascript:alert(1)' } }));
        assert.equal(await page.locator('#fp-tools-cursor-fx, #fp-tools-custom-cursor').count(), 0);
        await page.evaluate(() => qaExternal({ fpToolsCursorFx: { enabled: true, type: 'trail', count: 100, color1: '#fff', color2: '#fff' } }));
        assert.equal(await page.locator('#fp-tools-cursor-fx').count(), 1);
        await page.mouse.move(100, 100); await page.mouse.move(150, 130);
        await page.evaluate(() => qaExternal({ fpToolsCursorFx: { enabled: false } }));
        await page.waitForTimeout(250);
        assert.equal(await page.locator('#fp-tools-cursor-fx').isVisible(), false);
        await page.evaluate(() => qaExternal({ fpToolsCustomCursor: { enabled: true, image: 'data:image/png;base64,iVBORw0KGgo=', hideSystem: true } }));
        assert.equal(await page.locator('#fp-tools-custom-cursor').isVisible(), true);
        await page.evaluate(() => {
            qaExternal({ fpToolsCursorFx: { enabled: true } });
            qaExternal({ fpToolsCustomCursor: { enabled: false } });
            qaExternal({ fpToolsCursorFx: { enabled: false } });
        });
        assert.equal(await page.locator('#fp-tools-cursor-fx').count(), 1);
        assert.equal(await page.locator('#fp-tools-custom-cursor').count(), 1);
        assert.equal(await page.locator('#fp-tools-cursor-hide-style').textContent(), '');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('closed popup skips rendering and restores finance and effects on reopening', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSite(browser);
        await page.locator('#fpToolsButton').click();
        for (const id of ['finance_hub', 'effects']) {
            await page.evaluate(id => fptOpenPopupPage(id), id);
            await page.waitForTimeout(100);
            await page.evaluate(() => document.querySelector('.fp-tools-popup')._fptClose());
            await page.waitForTimeout(350);
            assert.equal(await page.locator('.fp-tools-popup').evaluate(el => getComputedStyle(el).contentVisibility), 'hidden');
            await page.locator('#fpToolsButton').click();
            assert.equal(await page.locator('.fp-tools-popup').evaluate(el => getComputedStyle(el).contentVisibility), 'visible');
            await page.evaluate(id => fptOpenPopupPage(id), id);
            assert.ok(await page.locator(`.fp-tools-page-content[data-page="${id}"]`).evaluate(el => el.getBoundingClientRect().width > 0));
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
