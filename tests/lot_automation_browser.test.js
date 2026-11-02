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

// The schedule and pricing dialogs were replaced by the schedule pane of the bulk lot editor;
// pricing now runs through the editor's price modes (tests/lot_io_browser.test.js).
async function mountPane(page) {
    await page.evaluate(() => {
        const host = document.createElement('div');
        host.className = 'fpt-qa-schedule';
        document.querySelector('[data-page="lot_io"]').appendChild(host);
        window.qaPane = window.FPTLotAutomationPage.mountSchedulePane(host, {
            getSelectedLots: () => [{ offerId: '501', nodeId: '42', title: 'Аккаунт Premium' }]
        });
        return window.qaPane.ready;
    });
}

test('schedule pane saves a draft rule with the chosen zone and shows a preview', async () => {
    const { browser, page } = await createPage();
    try {
        await mountPane(page);
        const pane = page.locator('.fpt-qa-schedule');
        await pane.locator('input[maxlength="60"]').fill('Вечер');
        await page.evaluate(() => {
            const zone = document.querySelector('.fpt-sched-zone select');
            if (![...zone.options].some(option => option.value === 'Asia/Krasnoyarsk')) zone.add(new Option('Asia/Krasnoyarsk', 'Asia/Krasnoyarsk'));
            zone.value = 'Asia/Krasnoyarsk';
            zone.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await pane.getByRole('button', { name: 'Каждый вечер 18–02' }).click();
        await pane.getByRole('button', { name: 'Сохранить черновик' }).click();
        await page.waitForFunction(() => window.qaCalls.some(call => call.command === 'saveRule'));
        const saved = await page.evaluate(() => window.qaCalls.find(call => call.command === 'saveRule').rule);
        assert.equal(saved.name, 'Вечер');
        assert.equal(saved.timezone, 'Asia/Krasnoyarsk');
        assert.deepEqual(saved.windows[0], { day: 'mon', start: '18:00', end: '02:00' });
        assert.equal(saved.windows.length, 7);
        await pane.locator('.fpt-sched-editor').getByRole('button', { name: 'Предпросмотр' }).click();
        await pane.locator('.fpt-sched-preview:not([hidden])').waitFor();
        assert.match(await pane.locator('.fpt-sched-preview').innerText(), /UTC\+7/);
        const overflow = await page.evaluate(() => { const el = document.querySelector('.fpt-qa-schedule'); return el.scrollWidth - el.clientWidth; });
        assert.ok(overflow <= 1, 'the pane does not scroll sideways');
        if (process.env.FPT_SHOTS) await page.screenshot({ path: path.join(process.env.FPT_SHOTS, 'schedule.png'), fullPage: true });
    } finally {
        await browser.close();
    }
});

test('the old standalone schedule and pricing dialogs are gone', async () => {
    const { browser, page } = await createPage();
    try {
        assert.deepEqual(await page.evaluate(() => Object.keys(window.FPTLotAutomationPage)), ['mountSchedulePane']);
    } finally {
        await browser.close();
    }
});
