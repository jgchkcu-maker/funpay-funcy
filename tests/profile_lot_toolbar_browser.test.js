const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.join(__dirname, '..');

async function profile({ width = 1280, dark = true, searchFirst = false, foreign = false } = {}) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width, height: 780 } });
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://funpay.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head></head><body>
            <div id="content"><a class="user-link-dropdown" href="/users/100/"></a>
            ${foreign ? '<div class="chat-profile-container"></div>' : ''}
            <main class="profile-data-container"><h5 class="mb10 text-bold">Предложения</h5>
            <div class="offer"><div class="offer-list-title"><h3><a href="/lots/42/">Steam</a></h3></div>
            <div class="tc"><div class="tc-header"></div>
            <a class="tc-item" href="/lots/offer?id=101"><div class="tc-desc-text">Пополнение Steam · Россия</div><div class="tc-price">100 ₽</div><i class="auto-dlv-icon"></i></a>
            <a class="tc-item warning" href="/lots/offer?id=102"><div class="tc-desc-text">Подарочная карта Steam</div><div class="tc-price">200 ₽</div></a></div></div>
            <div class="offer"><div class="offer-list-title"><h3><a href="/lots/43/">Discord</a></h3></div><div class="tc">
            <a class="tc-item" href="/lots/offer?id=103"><div class="tc-desc-text">Discord Nitro · 1 месяц</div><div class="tc-price">350 ₽</div></a></div></div>
            </main></div></body></html>` }));
        await page.goto(`https://funpay.com/users/${foreign ? '200' : '100'}/`);
        for (const file of ['css/content_styles.css', 'css/fpt_icons_theme.css', 'css/page_windows.css']) {
            await page.addStyleTag({ path: path.join(root, file) });
        }
        const font = fs.readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
        await page.addStyleTag({ content: `@font-face {font-family:'Material Symbols Rounded';src:url(data:font/woff2;base64,${font})}
            body:not(.funpay-redesigned) #content{visibility:visible} *{box-sizing:border-box} body{margin:0;background:${dark ? '#121416' : '#f6f7f9'};color:${dark ? '#eef0f2' : '#292c33'};font:14px 'Segoe UI',sans-serif}
            :root{--fpt-surface:${dark ? '#202326' : '#ffffff'};--fpt-text:${dark ? '#eef0f2' : '#292c33'};--fpt-border:${dark ? '#3a3e43' : '#dce0e5'};--fpt-text-muted:${dark ? '#a6acb5' : '#626975'}}
            .profile-data-container{max-width:850px;margin:80px auto;padding:0 24px}.offer{margin-bottom:24px}.offer-list-title h3{font-size:17px;margin:0 0 12px}.offer-list-title a{color:inherit;text-decoration:none}
            .tc-item{display:flex;align-items:center;gap:12px;min-height:54px;border-bottom:1px solid var(--fpt-border);text-decoration:none;color:inherit}.tc-desc-text{flex:1}.tc-price{white-space:nowrap}.warning{opacity:.6}.btn{cursor:pointer}` });
        await page.evaluate(() => {
            document.body.dataset.appData = JSON.stringify({ userId: '100' });
            window.chrome = { storage: { local: {
                async get() { return { fpToolsPinnedLots: [] }; }, async set() {}
            }, onChanged: { addListener() {} } }, runtime: { onMessage: { addListener() {} }, sendMessage(message, callback) { callback?.({ ok: true, summary: { raised: 2 } }); } } };
            window.showNotification = () => {};
        });
        for (const file of ['content/scripts/jquery.js', 'content/ui/page_windows.js', 'content/features/lot_management.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        if (!searchFirst) await page.evaluate(() => initializeLotManagement());
        for (const file of ['content/features/quick_lot_search.js', 'content/features/order_page_enhancements.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        if (searchFirst) await page.evaluate(() => initializeLotManagement());
        await page.addScriptTag({ path: path.join(root, 'content/features/profile_raise_all.js') });
        await page.evaluate(() => document.fonts.ready);
        return { browser, page, errors };
    } catch (error) { await browser.close(); throw error; }
}

test('profile toolbar survives both initialization orders, search, filters and selection cancellation', async () => {
    for (const searchFirst of [false, true]) {
        const { browser, page, errors } = await profile({ searchFirst });
        try {
            assert.equal(await page.locator('.fpt-offers-toolbar').count(), 1);
            await page.locator('#fp-lot-search-input').fill('Discord');
            assert.equal(await page.locator('.tc-item:visible').count(), 1);
            assert.equal(await page.locator('#fp-lot-search-count').textContent(), '1 из 3');
            await page.locator('#fp-lot-search-clear').click();
            assert.equal(await page.locator('.tc-item:visible').count(), 3);
            await page.getByRole('button', { name: 'Автовыдача', exact: true }).click();
            assert.equal(await page.locator('.tc-item:visible').count(), 2);
            await page.getByRole('button', { name: 'Все', exact: true }).click();
            await page.locator('#fpt-raise-all-btn').click();
            assert.match(await page.locator('#fpt-raise-all-btn').textContent(), /Поднять все лоты/);
            assert.equal(await page.locator('#fpt-raise-all-btn .material-symbols-rounded').count(), 1);
            await page.locator('#fp-tools-select-lots-btn').click();
            const selectionIcon = () => page.evaluate(() => ({
                check: getComputedStyle(document.querySelector('.fpt-select-all-check')).display,
                partial: getComputedStyle(document.querySelector('.fpt-select-all-partial')).display,
                width: document.querySelector('.fpt-select-all-icon').getBoundingClientRect().width
            }));
            assert.deepEqual(await selectionIcon(), { check: 'none', partial: 'none', width: 17 });
            await page.locator('.tc-item').first().click();
            assert.deepEqual(await selectionIcon(), { check: 'none', partial: 'block', width: 17 });
            await page.locator('#fp-tools-select-all-lots').press('Space');
            assert.deepEqual(await selectionIcon(), { check: 'block', partial: 'none', width: 17 });
            await page.locator('#fp-tools-select-all-lots').check();
            assert.equal(await page.locator('.fpt-lot-selection-count').textContent(), '3');
            if (process.env.FPT_TOOLBAR_SCREENSHOTS && !searchFirst) {
                const dir = path.join(root, 'output/profile-toolbar-redesign');
                fs.mkdirSync(dir, { recursive: true });
                await page.locator('#fp-tools-select-all-lots').blur();
                await page.locator('.fpt-offers-toolbar-actions').screenshot({ path: path.join(dir, 'select-all-controls.png') });
            }
            assert.equal(await page.locator('.fpt-lot-selection-label').textContent(), 'лота выбрано');
            assert.equal(await page.locator('.deactivate-lot').getAttribute('aria-label'), 'Отключить: 2');
            assert.equal(await page.locator('.activate-lot').getAttribute('aria-label'), 'Включить: 1');
            assert.equal(await page.locator('.deactivate-lot .fpt-lot-action-badge').textContent(), '2');
            assert.equal(await page.locator('.deactivate-lot .material-symbols-rounded').count(), 1);
            await page.locator('#fp-tools-cancel-selection').click();
            assert.equal(await page.locator('.actions:visible').count(), 0);
            assert.equal(await page.locator('.tc-item input').count(), 0);
            assert.equal(await page.locator('#fp-tools-select-lots-btn:visible').count(), 1);
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    }
});

test('toolbar and selected actions fit narrow and desktop viewports in both palettes', async () => {
    for (const width of [360, 768, 1280]) for (const dark of [true, false]) {
        const { browser, page, errors } = await profile({ width, dark });
        try {
            await page.locator('#fp-tools-select-lots-btn').click();
            await page.locator('#fp-tools-select-all-lots').check();
            const layout = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
                return { overflow: document.documentElement.scrollWidth > innerWidth, toolbar: rect('.fpt-offers-toolbar'), actions: rect('.actions') };
            });
            assert.equal(layout.overflow, false, `${width}/${dark}: horizontal page overflow`);
            for (const part of ['toolbar', 'actions']) {
                assert.ok(layout[part].left >= 0 && layout[part].right <= width, `${width}/${dark}: ${part} clipped`);
            }
            assert.ok(layout.actions.bottom <= 780 && layout.actions.top > 0);
            if (process.env.FPT_TOOLBAR_SCREENSHOTS) {
                const dir = path.join(root, 'output/profile-toolbar-redesign');
                fs.mkdirSync(dir, { recursive: true });
                await page.screenshot({ path: path.join(dir, `${dark ? 'dark' : 'light'}-${width}.png`) });
            }
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    }
});

test('foreign profile keeps its copy action and does not mount raise-all', async () => {
    const { browser, page, errors } = await profile({ foreign: true });
    try {
        assert.equal(await page.locator('#fpt-raise-all-btn').count(), 0);
        await page.locator('#fp-tools-select-lots-btn').click();
        await page.locator('.tc-item').first().click();
        assert.equal(await page.locator('.clone-lots:visible').count(), 1);
        assert.equal(await page.locator('.price-editor:visible, .delete-lot:visible, .deactivate-lot:visible').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('long write errors and currency warnings stay inside the panel without covering actions', async () => {
    for (const width of [360, 1280]) for (const dark of [true, false]) {
        const { browser, page, errors } = await profile({ width, dark });
        try {
            await page.evaluate(() => {
                document.documentElement.style.setProperty('--fpt-chat-action-radius', '24px');
                document.body.dataset.appData = JSON.stringify({ userId: '100', 'csrf-token': 'test' });
                document.querySelector('.offer-list-title a').href = '/chips/42/';
                const row = document.querySelector('.tc-item');
                row.href = '/chips/offer?id=101';
                row.querySelector('.tc-desc-text').className = 'tc-server';
                row.querySelector('.tc-server').textContent = '7HillsRP.ru';
                window.fptLotWrite = async () => { throw new Error('FunPay вернул страницу без формы редактирования. Проверьте, что лот доступен и принадлежит текущему аккаунту, затем обновите список лотов.'); };
            });
            await page.locator('#fp-tools-select-lots-btn').click();
            await page.locator('.tc-item').first().click();
            const before = await page.locator('.actions').boundingBox();
            await page.locator('.deactivate-lot').click();
            await page.waitForFunction(() => !document.querySelector('.deactivate-lot').disabled);
            assert.match(await page.locator('.log .fpt-lot-feedback-title').textContent(), /ошибки: 1/);
            assert.match(await page.locator('.log .fpt-lot-feedback-message').textContent(), /7HillsRP.ru.*без формы редактирования/);
            assert.equal(await page.locator('.log').getAttribute('data-state'), 'error');
            assert.equal(await page.locator('.actions #fp-chip-delete-warning').count(), 1);
            const after = await page.locator('.actions').boundingBox();
            assert.equal(after.width, before.width, 'error text must not widen the panel');
            const geometry = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
                return { bar: rect('.actions'), buttons: rect('.fpt-lot-action-buttons'), warning: rect('#fp-chip-delete-warning'), feedback: rect('.log'), overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.equal(geometry.overflow, false);
            assert.ok(geometry.warning.top >= geometry.buttons.bottom);
            assert.ok(geometry.feedback.top >= geometry.warning.bottom);
            assert.ok(geometry.feedback.bottom <= geometry.bar.bottom);
            assert.ok(geometry.bar.top >= 0 && geometry.bar.bottom <= 780);
            if (process.env.FPT_TOOLBAR_SCREENSHOTS) {
                const dir = path.join(root, 'output/profile-toolbar-redesign');
                fs.mkdirSync(dir, { recursive: true });
                await page.screenshot({ path: path.join(dir, `error-${dark ? 'dark' : 'light'}-${width}.png`) });
            }
            await page.getByRole('button', { name: 'Закрыть сообщение' }).click();
            assert.equal(await page.locator('.log:visible').count(), 0);
            assert.equal(await page.locator('#fp-chip-delete-warning:visible').count(), 1);
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    }
});

test('real original and custom theme styles update every lot control radius including zero', async () => {
    const { browser, page, errors } = await profile();
    try {
        for (const file of ['content/safe_values.js', 'content/features/theme.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        await page.locator('#fp-tools-select-lots-btn').click();
        await page.locator('.tc-item').first().click();
        await page.evaluate(() => {
            document.querySelector('.offer-list-title a').href = '/chips/42/';
            updateChipDeleteWarning();
        });
        for (const baseStyle of ['original', 'custom']) for (const radius of [0, 28]) {
            const radii = await page.evaluate(({ baseStyle, radius }) => {
                let style = document.getElementById('qa-radius-theme');
                if (!style) { style = document.createElement('style'); style.id = 'qa-radius-theme'; document.head.append(style); }
                style.textContent = getCustomThemeCss({ ...DEFAULT_THEME, baseStyle, borderRadius: radius });
                return ['.actions', '.action-lot', '#fpt-raise-all-btn', '#fp-tools-select-lots-btn', '#fp-tools-selection-controls label', '#fp-tools-cancel-selection', '#fp-lot-search-input', '#fp-lot-search-clear', '#fp-offer-filter', '#fp-offer-filter button', '.log', '#fp-chip-delete-warning'].map(selector => [selector, getComputedStyle(document.querySelector(selector)).borderTopLeftRadius]);
            }, { baseStyle, radius });
            for (const [selector, actual] of radii) assert.equal(actual, `${radius}px`, `${baseStyle}: ${selector}`);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('final feedback stays readable after the last selected lot succeeds and can be dismissed', async () => {
    const { browser, page, errors } = await profile();
    try {
        await page.evaluate(() => {
            document.body.dataset.appData = JSON.stringify({ userId: '100', 'csrf-token': 'test' });
            window.fptLotWrite = async () => ({});
        });
        await page.locator('#fp-tools-select-lots-btn').click();
        await page.locator('.tc-item').first().click();
        await page.locator('.deactivate-lot').click();
        await page.waitForFunction(() => !document.querySelector('.deactivate-lot').disabled);
        assert.equal(await page.locator('.tc-item input:checked').count(), 0);
        assert.equal(await page.locator('.log:visible').count(), 1);
        assert.equal(await page.locator('.log').getAttribute('data-state'), 'success');
        assert.match(await page.locator('.fpt-lot-feedback-title').textContent(), /Отключено: 1, ошибки: 0/);
        await page.getByRole('button', { name: 'Закрыть сообщение' }).click();
        assert.equal(await page.locator('.actions:visible').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('native profile tables keep heading gaps, checkbox columns and cell alignment consistent', async () => {
    for (const width of [360, 1280]) {
        const { browser, page, errors } = await profile({ width });
        try {
            // FunPay table geometry, rather than the flex rows used by the toolbar fixture.
            await page.addStyleTag({ content: `
                .profile-data-container{max-width:700px;padding:0 24px}
                .profile-data-container .offer{padding:20px;border:1px solid #383b40;border-radius:16px;background:#1c1f22}
                .tc{display:table;width:100%;border-collapse:separate;border-spacing:0;border:1px solid #383b40;border-radius:14px;overflow:hidden}
                .tc-header,.tc-item{display:table-row;min-height:0}
                .tc-header>div,.tc-item>div{display:table-cell;vertical-align:top;padding:12px 8px}
                .showcase-table .tc-header>div,.showcase-table .tc-item>div{padding-left:5px;padding-right:5px}
                .tc-amount,.tc-price{text-align:right;white-space:nowrap}
                .tc-item .tc-price{font-weight:bold}.tc-item>div.tc-amount,.tc-item>div.tc-price{padding-top:10px}
                .tc-header>div{border-bottom:1px solid #383b40}.tc-item>div{border-bottom:0}
                .offer-list-title-button button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:50%;color:inherit;background:#292c31}
                .offer-list-title-button .material-symbols-rounded{font-size:20px}
            ` });
            await page.evaluate(() => {
                const offer = document.querySelector('.offer');
                document.documentElement.classList.add('fpt-custom-theme-on');
                offer.innerHTML = `<div class="offer-list-title-container"><div class="offer-list-title"><h3><a href="/chips/42/">Вирты GTA 5 RP, SAMP</a></h3></div><div class="offer-list-title-button"><button type="button" aria-label="Редактировать категорию"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button></div></div>
                    <div class="tc showcase-table"><div class="tc-header"><div class="tc-server">Сервер</div><div class="tc-amount">Наличие</div><div class="tc-price">Цена/1кк</div></div>
                    <a class="tc-item" href="/chips/offer?id=101"><div class="tc-server">7HillsRP.ru</div><div class="tc-amount">111 кк</div><div class="tc-price">135.64 ₽</div></a></div>`;
                document.querySelectorAll('.offer')[1].remove();
            });
            for (const selection of [false, true]) {
                if (selection) await page.locator('#fp-tools-select-lots-btn').click();
                const layout = await page.evaluate(() => {
                    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, height: r.height }; };
                    const cells = Array.from(document.querySelectorAll('.offer .tc-item > div')).map(el => getComputedStyle(el));
                    return {
                        gap: rect('.offer .tc').top - rect('.offer-list-title-container').bottom,
                        topPads: cells.map(cell => cell.paddingTop), bottomPads: cells.map(cell => cell.paddingBottom),
                        alignment: cells.map(cell => cell.verticalAlign),
                        header: rect('.tc-header'), row: rect('.tc-item'), table: rect('.offer .tc'), card: rect('.offer'),
                        checkbox: document.querySelector('.action-lots-checkbox-cell') ? rect('.action-lots-checkbox-cell') : null,
                        checkboxHeader: document.querySelector('.action-lots-header-cell') ? rect('.action-lots-header-cell') : null,
                        box: document.querySelector('.action-lots-checkbox-cell .lot-box') ? rect('.action-lots-checkbox-cell .lot-box') : null,
                        overflow: document.documentElement.scrollWidth > innerWidth
                    };
                });
                assert.equal(layout.gap, width <= 640 ? 12 : 16);
                assert.ok(layout.topPads.every(value => value === '12px'));
                assert.ok(layout.bottomPads.every(value => value === '12px'));
                assert.ok(layout.alignment.every(value => value === 'middle'));
                assert.ok(layout.row.height >= 52);
                if (selection) {
                    const expected = width <= 640 ? 40 : 52;
                    assert.equal(layout.checkbox.right - layout.checkbox.left, expected);
                    assert.equal(layout.checkboxHeader.right - layout.checkboxHeader.left, expected);
                    assert.ok(Math.abs((layout.box.top + layout.box.bottom) / 2 - (layout.row.top + layout.row.bottom) / 2) <= 1);
                }
                assert.equal(layout.overflow, false, `${width}/${selection}: page overflow`);
                assert.ok(layout.table.right <= layout.card.right - (width <= 640 ? 16 : 20), `${width}/${selection}: table overflows card padding`);
                if (process.env.FPT_TOOLBAR_SCREENSHOTS) {
                    const dir = path.join(root, 'output/profile-toolbar-redesign');
                    fs.mkdirSync(dir, { recursive: true });
                    await page.locator('.offer').screenshot({ path: path.join(dir, `offer-spacing-${width}-${selection ? 'selection' : 'normal'}.png`) });
                }
            }
            await page.locator('#fp-tools-cancel-selection').click();
            assert.equal(await page.locator('.action-lots-checkbox-cell').count(), 0);
            assert.deepEqual(errors, []);
        } finally { await browser.close(); }
    }
});
