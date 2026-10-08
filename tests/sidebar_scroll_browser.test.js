const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openQuickReplies } = require('./helpers/quick_replies_browser_harness');

test('sidebar expansion preserves scroll and pending route reveal yields to manual scrolling', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openQuickReplies(browser, {}, { width: 1200, height: 600 });
        await page.waitForTimeout(450);
        await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            popup._fptNavSections.setExpandedSections(['sales'], false);
        });
        await page.waitForTimeout(400);
        const beforeExpansion = await page.evaluate(() => {
            const scroll = document.querySelector('.fpt-nav-scroll');
            scroll.scrollTop = 0;
            document.querySelector('.fp-tools-popup')._fptNavSections.toggleSection('customers');
            return scroll.scrollTop;
        });
        await page.waitForTimeout(450);
        assert.equal(await page.locator('.fpt-nav-scroll').evaluate(scroll => scroll.scrollTop), beforeExpansion,
            'expanding a group must not move the sidebar to the bottom of the group');

        await page.evaluate(() => {
            document.querySelector('.fp-tools-popup')._fptNavSections.setExpandedSections(
                ['sales', 'customers', 'finance', 'interface', 'settings', 'help'], false);
        });
        await page.waitForTimeout(400);
        const manualPosition = await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            const scroll = document.querySelector('.fpt-nav-scroll');
            popup._fptNavSections.showSectionForPage('settings_io');
            scroll.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
            scroll.scrollTop = 80;
            return scroll.scrollTop;
        });
        await page.waitForTimeout(450);
        assert.equal(await page.locator('.fpt-nav-scroll').evaluate(scroll => scroll.scrollTop), manualPosition,
            'a pending route reveal must not undo the user scrolling');

        await page.evaluate(() => window.fptOpenPopupPage('settings_io'));
        await page.waitForTimeout(450);
        const visible = await page.evaluate(() => {
            const viewport = document.querySelector('.fpt-nav-scroll').getBoundingClientRect();
            const item = document.querySelector('.fpt-nav-child[data-page="settings_io"]').getBoundingClientRect();
            return item.top >= viewport.top - 1 && item.bottom <= viewport.bottom + 1;
        });
        assert.equal(visible, true, 'an explicit route still reveals its selected item when the user has not scrolled');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
