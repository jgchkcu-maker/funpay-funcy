const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

test('compact auto-delivery supports editing, retry, filters and narrow layouts', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const file = new URL(route.request().url()).pathname;
            if (file === '/fonts/material-symbols-rounded.woff2') return route.fulfill({ path: path.join(root, file) });
            return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
        });
        await page.goto('https://funpay.com/');
        await page.setContent('<div class="fp-tools-popup fptm-themed fptm-dark active"><main class="fp-tools-content"><div class="fp-tools-page-content active" data-page="auto_delivery"></div></main></div>');
        for (const file of ['css/content_styles.css', 'css/popup_categories.css', 'css/automation.css', 'css/fpt_icons_theme.css']) {
            await page.addStyleTag({ path: path.join(root, file) });
        }
        await page.addStyleTag({ content: `
            body { margin: 0; padding: 8px; background: #1e1f24; font-family: Arial, sans-serif; }
            .fp-tools-popup { position: relative !important; inset: auto !important; width: 100% !important; height: auto !important; min-height: 700px; max-height: none !important; transform: none !important; opacity: 1 !important; display: block !important; }
            .fp-tools-content { width: 100%; overflow: visible !important; }
            .fp-tools-popup.fptm-themed {
                --fptm-bg: #24252b; --fptm-head: #24252b; --fptm-text: #e7e8ec;
                --fptm-muted: #afb0b8; --fptm-faint: #888993; --fptm-border: #3b3d46;
                --fptm-surface: #292b32; --fptm-surface-2: #2d2f37; --fptm-hover: #32353f;
                --fptm-field: #272a32; --fptm-accent: #7663f6; --fptm-accent-soft: #373254;
                --fptm-accent-border: #665bb0; --fptm-on-accent: #fff;
                --fptm-shadow: #17181c; --fptm-nav-border: #3b3d46; --fptm-nav-field: #292c34;
                --fptm-success: #80d9ad; --fptm-danger: #ff9aa3; --fptm-warning: #ffd27a;
                --fptm-warning-soft: #3c372d; --fptm-warning-border: #756445;
            }
        ` });
        await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
        await page.evaluate(() => {
            const lots = [
                { id: '501', title: 'Вирты GTA 5 RP, SAMP — 7HillsRP.ru', categoryName: 'Вирты GTA 5 RP, SAMP' },
                { id: '502', title: 'Игровая валюта', categoryName: 'Валюта' },
                { id: '503', title: 'Длинное название лота для проверки переноса текста и расположения кнопок на узком экране', categoryName: 'Аккаунты' }
            ];
            const config = {
                '501': { enabled: true, mode: 'secrets', productCount: null },
                '502': { enabled: false, mode: 'secrets', productCount: 4 },
                '503': { enabled: true, mode: 'template', text: 'Спасибо за покупку!' }
            };
            window.qaSaved = [];
            window.qaFailSave = false;
            window.fptPopupActions = { async run(_page, action, payload = {}) {
                if (action === 'getSettings') return {
                    fpToolsAutoDeliveryLots: config,
                    fpToolsAutoDeliveryLotsCache: { updatedAt: Date.now(), lots: lots.slice(0, 1), stockErrors: [{ lotId: '501', error: 'Склад временно недоступен.' }] }
                };
                if (action === 'fp-load-delivery-lots-btn') return { lots, config, stockCounts: { '501': 6, '502': 4 }, stockErrors: [] };
                if (action === 'autoSaveDeliveryLot') {
                    if (window.qaFailSave) return { success: false, error: 'Не удалось сохранить: попробуйте снова.' };
                    qaSaved.push(structuredClone(payload));
                    config[payload.lotId] = structuredClone(payload.settings);
                    return { success: true };
                }
                return { success: true };
            } };
            window.FPTPopupUI.observePopupControls(document.querySelector('.fp-tools-popup'));
        });
        await page.addScriptTag({ path: path.join(root, 'content/ui/auto_delivery_page.js') });
        await page.evaluate(() => window.FPTAutoDeliveryPage.mount(document.querySelector('.fp-tools-popup')));
        assert.equal(await page.getByRole('heading', { name: 'Лоты', exact: true }).count(), 0,
            'filters replace the redundant lot heading');
        assert.equal(await page.locator('.fpt-ad-lots-heading > .fpt-ad-filter-tabs').count(), 1);
        assert.deepEqual(await page.locator('.fpt-ad-lots-heading').evaluate(element =>
            ['.fpt-ad-filter-tabs', '.fpt-ad-load-button'].map(selector =>
                Math.round(element.querySelector(selector).getBoundingClientRect().height))), [40, 40],
            'the filter track and refresh button have the same height');
        assert.equal(await page.locator('.fpt-ad-lots-heading').evaluate(element => {
            const filters = element.querySelector('.fpt-ad-filter-tabs').getBoundingClientRect();
            const refresh = element.querySelector('.fpt-ad-load-button').getBoundingClientRect();
            return Math.abs(filters.top - refresh.top) < 1 && filters.right < refresh.left;
        }), true, 'filters and refresh occupy the same header row');
        assert.equal(await page.locator('.fpt-ad-view-tabs').count(), 0,
            'orders are navigated through their own category, not an in-page switcher');
        const filterTrackWidth = await page.locator('.fpt-ad-filter-tabs').evaluate(element => element.getBoundingClientRect().width);
        const toolbarWidth = await page.locator('.fpt-ad-toolbar').evaluate(element => element.getBoundingClientRect().width);
        assert.ok(filterTrackWidth < toolbarWidth / 2, 'lot filter background should fit its labels instead of spanning the toolbar');
        const first = page.locator('.fpt-ad-lot-row[data-lot-id="501"]');
        assert.equal(await first.locator('.fpt-ad-save-button').isVisible(), false);
        assert.equal(await page.locator('.fpt-ad-search').isVisible(), false);
        assert.equal(await page.locator('.fpt-ad-sort-control').isVisible(), false);
        assert.equal(await first.locator('.fpt-ad-lot-stock').textContent(), 'Не удалось проверить остаток');
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all(document.getAnimations()
            .filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined))));
        const screenshots = process.env.FPT_AD_SCREENSHOT_DIR || path.join(os.tmpdir(), 'funpay-auto-delivery-minimal');
        fs.mkdirSync(screenshots, { recursive: true });
        await page.screenshot({ path: path.join(screenshots, 'auto-delivery-dark-desktop.png') });

        // The real custom source menu changes the draft and reveals the editor and Save.
        await first.locator('.fpt-ad-lot-source .fpt-select-trigger').click();
        await first.getByRole('option', { name: 'Свой шаблон', exact: true }).click();
        assert.equal(await first.locator('.fpt-ad-template').isVisible(), true);
        assert.equal(await first.locator('.fpt-ad-save-button').isVisible(), true);
        assert.equal(await first.locator('.fpt-ad-save-button').isDisabled(), true);
        await first.locator('.fpt-ad-template-input').fill('Заказ {orderid} готов. $sleep=5 Спасибо, {buyername}!');
        const controlGaps = await first.locator('.fpt-ad-lot-controls').evaluate(element => {
            const bounds = selector => element.querySelector(selector).getBoundingClientRect();
            const toggle = bounds('.fpt-ad-switch-line');
            const source = bounds('.fpt-ad-lot-source .fpt-select-trigger');
            const save = bounds('.fpt-ad-save-button');
            return { toggleToSource: source.left - toggle.right, sourceToSave: save.left - source.right };
        });
        assert.ok(controlGaps.toggleToSource <= 12 && controlGaps.sourceToSave <= 12, `lot controls should stay grouped: ${JSON.stringify(controlGaps)}`);
        await page.evaluate(() => { window.qaFailSave = true; });
        await first.locator('.fpt-ad-save-button').click();
        await page.locator('.fpt-popup-toast[data-kind="error"]').waitFor();
        assert.equal(await first.locator('.fpt-ad-save-button').isVisible(), true, 'a failed save must keep the draft and retry available');
        await page.evaluate(() => { window.qaFailSave = false; });
        await first.locator('.fpt-ad-save-button').click();
        await page.waitForFunction(() => window.qaSaved.length === 1);
        assert.equal(await first.locator('.fpt-ad-save-button').isVisible(), false);
        assert.equal(await page.locator('.fpt-ad-savebar').isVisible(), false);
        assert.equal(await page.evaluate(() => qaSaved[0].settings.mode), 'template');

        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-ad-lot-row').length === 3);
        assert.equal(await page.locator('.fpt-ad-search').isVisible(), true);
        assert.equal(await page.locator('.fpt-ad-sort-control').isVisible(), true);
        await page.locator('.fpt-ad-summary-chip[data-filter="active"]').click();
        assert.equal(await page.locator('.fpt-ad-lot-row:not([hidden])').count(), 2);
        await page.locator('.fpt-ad-summary-chip[data-filter="all"]').click();
        await page.locator('.fpt-ad-search').fill('Игровая валюта');
        assert.equal(await page.locator('.fpt-ad-lot-row:not([hidden])').count(), 1);
        await page.locator('.fpt-ad-search').fill('');
        const second = page.locator('.fpt-ad-lot-row[data-lot-id="502"]');
        await second.locator('[data-lot-control="enabled"]').check();
        await page.locator('.fpt-ad-save-all').click();
        await page.waitForFunction(() => window.qaSaved.length === 2);
        assert.equal(await second.locator('.fpt-ad-save-button').isVisible(), false);

        // Both clean and edited rows must fit, including a template editor with a long title.
        await first.locator('.fpt-ad-template-input').fill('Черновик');
        for (const width of [1000, 680, 420]) {
            await page.setViewportSize({ width, height: 760 });
            const overflow = await page.locator('.fpt-ad-lot-row').evaluateAll(rows => rows.some(row => row.scrollWidth > row.clientWidth + 1));
            assert.equal(overflow, false, `lot controls overflow at ${width}px`);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflows at ${width}px`);
            assert.equal(await first.locator('.fpt-ad-save-button').isVisible(), true);
            assert.equal(await page.locator('.fpt-ad-filter-tabs .fpt-fin-tab-label').evaluateAll(labels => labels.every(label => getComputedStyle(label).display !== 'none')), true,
                'every filter must retain its name on narrow screens');
            if (width === 420) await page.screenshot({ path: path.join(screenshots, 'auto-delivery-dark-mobile.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        console.info(`Auto-delivery previews: ${screenshots}`);
    } finally {
        await browser.close();
    }
});
