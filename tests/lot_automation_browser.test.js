const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

async function createPage(width = 1204) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<body data-app-data='{"userId":100}'><div class="fp-tools-popup fptm-themed active"><main class="fp-tools-content"><div class="fp-tools-page-content active" data-page="lot_io"></div></main></div></body>`);
    for (const file of ['css/content_styles.css', 'css/popup_categories.css', 'css/fpt_icons_theme.css', 'css/automation.css']) {
        await page.addStyleTag({ path: path.join(root, file) });
    }
    const iconFont = fs.readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
    await page.addStyleTag({ content: `@font-face { font-family: 'Material Symbols Rounded'; src: url(data:font/woff2;base64,${iconFont}) format('woff2'); }
        body { margin: 0; font-family: Arial, sans-serif; }
        .fp-tools-popup { position: relative; width: min(100vw, 1204px); height: 900px; overflow: hidden; }
        .fp-tools-popup.fptm-themed { --fptm-bg: #fff; --fptm-surface: #f7f9f8; --fptm-text: #18201d; --fptm-muted: #59645f; --fptm-border: #d7e0db;
            --fptm-accent: #247653; --fptm-accent-soft: #e5f2ec; --fptm-accent-border: #8cb6a2; --fptm-nav-border: #d7e0db; --fptm-nav-field: #f4f7f5; --fptm-hover: #e9efeb; }` });
    await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
    await page.evaluate(() => {
        window.qaCalls = [];
        const state = { rules: [], bindings: [], status: {}, accountId: '100' };
        window.chrome = { runtime: { sendMessage: async message => {
            window.qaCalls.push(message);
            if (message.action === 'getUserLotsList') return [{ id: '501', nodeId: '42', title: 'Аккаунт Premium', categoryName: 'Аккаунты' }, { id: '502', nodeId: '43', title: 'Ключ', categoryName: 'Ключи' }];
            if (message.action === 'fptLotSchedules') {
                if (message.command === 'list') return { success: true, data: state };
                if (message.command === 'saveRule') { const rule = { ...message.rule, ruleId: 'r1', enabled: false, revision: 1 }; state.rules = [rule]; return { success: true, data: rule }; }
                if (message.command === 'preview') return { success: true, data: { errors: [], openNow: false, transitions: [{ local: '2026-10-09 18:00', offset: 'UTC+7', open: true }], lots: [] } };
            }
            if (message.action === 'fptPricing') {
                if (message.command === 'list') return { success: true, data: { rules: [], bindings: [], autoState: {} } };
                if (message.command === 'preview') return { success: true, data: { previewId: 'pv1', explanation: 'Наценка 25% = маржа 20%', rows: [
                    { offerId: '501', title: 'Аккаунт Premium', currentPrice: '100', cost: { amount: '100', currency: 'RUB' }, floor: '110', target: '125', action: 'raise', reasons: [] },
                    { offerId: '502', title: 'Ключ', currentPrice: '50', cost: null, action: 'skip', reasons: ['Себестоимость не указана.'] }
                ] } };
                if (message.command === 'apply') return { success: true, data: { results: [{ offerId: '501', status: 'saved' }] } };
            }
            return { success: true, data: null };
        } } };
    });
    await page.addScriptTag({ path: path.join(root, 'content/ui/popup_actions.js') });
    await page.addScriptTag({ path: path.join(root, 'content/ui/automation_ui.js') });
    await page.addScriptTag({ path: path.join(root, 'content/ui/lot_automation_page.js') });
    return { browser, page };
}

test('schedule dialog saves a draft rule with the saved zone and shows a preview', async () => {
    const { browser, page } = await createPage();
    try {
        await page.evaluate(() => window.FPTLotAutomationPage.openScheduleDialog(document.querySelector('.fp-tools-popup')));
        await page.locator('.fpt-auto-lot-row').first().waitFor();
        await page.locator('.fpt-auto-section input[maxlength="60"]').fill('Вечер');
        await page.locator('input[list="fpt-auto-zones"]').fill('Asia/Krasnoyarsk');
        await page.getByRole('button', { name: 'Каждый вечер 18–02' }).click();
        assert.equal(await page.locator('.fpt-auto-window-row').count(), 7);
        await page.getByRole('button', { name: 'Сохранить черновик' }).click();
        await page.locator('.fpt-auto-card').waitFor();
        const saved = await page.evaluate(() => window.qaCalls.find(call => call.command === 'saveRule').rule);
        assert.equal(saved.timezone, 'Asia/Krasnoyarsk');
        assert.deepEqual(saved.windows[0], { day: 'mon', start: '18:00', end: '02:00' });
        assert.match(await page.locator('.fpt-auto-card').innerText(), /Черновик/);
        await page.locator('.fpt-auto-card').getByRole('button', { name: 'Предпросмотр' }).click();
        await page.locator('.fpt-auto-table').first().waitFor();
        assert.match(await page.locator('.fpt-auto-table').first().innerText(), /UTC\+7/);
        const overflow = await page.evaluate(() => document.querySelector('.fpt-lot-dialog').scrollWidth - document.querySelector('.fpt-lot-dialog').clientWidth);
        assert.ok(overflow <= 1, 'the dialog does not scroll sideways');
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'schedule.png'), fullPage: true });
    } finally {
        await browser.close();
    }
});

test('pricing dialog previews selected lots and applies only checked rows', async () => {
    const { browser, page } = await createPage();
    try {
        await page.evaluate(() => window.FPTLotAutomationPage.openPricingDialog(document.querySelector('.fp-tools-popup')));
        await page.locator('.fpt-auto-lot-row').first().waitFor();
        assert.match(await page.locator('.fpt-auto-lead').first().innerText(), /маржу 20/);
        await page.locator('.fpt-auto-lot-row input').first().check();
        await page.getByRole('button', { name: 'Предпросмотр отмеченных' }).click();
        await page.locator('.fpt-auto-table').waitFor();
        assert.match(await page.locator('.fpt-auto-table').innerText(), /Повысить/);
        assert.equal(await page.locator('.fpt-auto-table input[type="checkbox"]').count(), 1, 'only actionable rows can be applied');
        page.on('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Применить отмеченные' }).click();
        await page.locator('.fpt-auto-notice[data-tone="success"]').waitFor();
        const apply = await page.evaluate(() => window.qaCalls.find(call => call.command === 'apply'));
        assert.deepEqual(apply.offerIds, ['501']);
        assert.equal(apply.previewId, 'pv1');
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'pricing.png'), fullPage: true });
    } finally {
        await browser.close();
    }
});
