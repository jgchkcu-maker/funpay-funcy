const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, openSite, root } = require('./helpers/perf_browser_harness');

test('manifest eagerly loads each menu dependency once and every resource exists', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    assert.ok(!manifest.permissions.includes('scripting'));
    assert.equal(manifest.minimum_chrome_version, undefined);
    for (const group of manifest.content_scripts) {
        for (const type of ['js', 'css']) {
            const files = group[type] || [];
            assert.equal(new Set(files).size, files.length);
            for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), file);
        }
    }
    const content = manifest.content_scripts.find(group => group.js?.includes('content/content_script.js'));
    for (const file of ['content/ui/main_popup.js', 'content/ui/settings_io_page.js', 'content/ui/popup_metadata.js', 'content/features/theme_gallery.js']) {
        assert.ok(content.js.indexOf(file) < content.js.indexOf('content/content_script.js'), file);
        assert.ok(content.js.includes(file), file);
    }
    for (const file of ['css/popup_categories.css', 'css/automation.css']) assert.ok(content.css.includes(file));
});

test('one, two and five rapid clicks build once; closing, reopening and template settings reuse the menu', async () => {
    const browser = await launch();
    try {
        for (const clicks of [1, 2, 5]) {
            const { page, errors } = await openSite(browser, { url: 'https://funpay.com/chat/' });
            assert.deepEqual(await page.evaluate(() => ({ popup: typeof createMainPopup, count: document.querySelectorAll('.fp-tools-popup').length })), { popup: 'function', count: 0 });
            await page.evaluate(count => {
                window.qaBuilds = 0;
                const original = createMainPopup;
                createMainPopup = (...args) => { qaBuilds++; return original(...args); };
                for (let i = 0; i < count; i++) document.querySelector('#fpToolsButton').click();
            }, clicks);
            await page.waitForSelector('.fp-tools-popup.active');
            assert.equal(await page.evaluate(() => qaBuilds), 1);
            assert.equal(await page.locator('.fp-tools-page-content').count(), 15);
            await page.evaluate(() => document.querySelector('#fpToolsButton').click());
            await page.waitForFunction(() => !document.querySelector('.fp-tools-popup').classList.contains('is-closing'));
            assert.equal(await page.locator('.fp-tools-popup.active').count(), 0);
            await page.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('#fpToolsButton').click(); });
            await page.waitForSelector('.fp-tools-popup.active');
            await page.evaluate(() => document.querySelector('.fp-tools-popup')._fptClose());
            await page.waitForTimeout(300);
            await page.evaluate(() => openTemplateSettings());
            await page.waitForSelector('.fp-tools-popup.active');
            assert.equal(await page.locator('.fp-tools-page-content.active').getAttribute('data-page'), 'templates');
            assert.equal(await page.locator('.fp-tools-popup').count(), 1);
            assert.equal(await page.evaluate(() => qaBuilds), 1);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('saved custom theme, page windows and enhanced selects work before opening and preserve their palette', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSite(browser, { seed: {
            enableCustomTheme: true,
            fpToolsTheme: { bgColor1: '#304050', bgColor2: '#9bd0ff', containerBgColor: '#14161c', textColor: '#e8edf5', font: 'Arial', baseStyle: 'custom' }
        } });
        const before = await page.evaluate(async () => {
            await applyCustomTheme();
            window.qaWindow = fptWindow.create({ title: 'Тема окна' });
            qaWindow.open();
            const select = document.createElement('select');
            select.innerHTML = '<option>Выбор</option><option>Другое</option>';
            qaWindow.dialog.append(select);
            FPTPopupUI.enhanceSelect(select);
            return { css: document.getElementById('fp-tools-custom-theme')?.textContent,
                color: getComputedStyle(qaWindow.dialog).color, background: getComputedStyle(qaWindow.dialog).backgroundColor,
                enhanced: !!select.parentElement.querySelector('.fpt-select-trigger') };
        });
        assert.ok(before.css?.length > 1000);
        assert.equal(before.enhanced, true);
        await page.evaluate(() => qaWindow.close());
        await page.waitForTimeout(250);
        await page.locator('#fpToolsButton').click();
        await page.waitForSelector('.fp-tools-popup.active');
        const after = await page.evaluate(() => ({ css: document.getElementById('fp-tools-custom-theme')?.textContent,
            color: getComputedStyle(qaWindow.dialog).color, background: getComputedStyle(qaWindow.dialog).backgroundColor }));
        assert.deepEqual(after, { css: before.css, color: before.color, background: before.background });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
