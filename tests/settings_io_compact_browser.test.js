const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

test('settings transfer keeps backup age, export and load recovery next to the actions', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 620, height: 900 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<div class="fp-tools-popup fptm-themed active"><main class="fp-tools-content"><div class="fp-tools-page-content active" data-page="settings_io"></div></main></div>');
        for (const file of ['css/content_styles.css', 'css/popup_categories.css', 'css/fpt_icons_theme.css']) {
            await page.addStyleTag({ path: path.join(root, file) });
        }
        await page.addStyleTag({ content: '.fp-tools-popup { position: relative; width: 100%; height: auto; opacity: 1; transform: none; } .fp-tools-content { overflow: visible; }' });
        await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
        await page.evaluate(() => {
            window.qaFailRead = true;
            window.qaLastExport = Date.now() - 60 * 86400000;
            window.qaExported = 0;
            const backup = { _magic: 'FPTCONFIG', settings: { enableCustomTheme: true } };
            window.URL.createObjectURL = () => 'blob:qa';
            window.URL.revokeObjectURL = () => {};
            HTMLAnchorElement.prototype.click = function () { window.qaExported += 1; };
            window.fptPopupActions = { async run(_page, action, payload = {}) {
                if (action === 'settings-io-summary') {
                    if (window.qaFailRead) { window.qaFailRead = false; throw new Error('Хранилище недоступно'); }
                    return { backup, history: { lastExportAt: window.qaLastExport }, counts: {} };
                }
                if (action === 'fp-settings-export-btn') return backup;
                if (action === 'settings-io-mark') window.qaLastExport = payload.exportedAt;
                return {};
            } };
        });
        await page.addScriptTag({ path: path.join(root, 'content/ui/settings_io_page.js') });
        await page.evaluate(() => window.FPTSettingsIOPage.mount(document.querySelector('.fp-tools-popup')));
        assert.equal(await page.locator('.fpt-sio-hero').count(), 0);
        assert.match(await page.locator('.fpt-sio .fpt-qr-banner').textContent(), /Хранилище недоступно/);
        await page.locator('.fpt-sio .fpt-qr-banner').getByRole('button', { name: 'Повторить' }).click();
        await page.locator('.fpt-sio-last-export[data-kind="warning"]').waitFor();
        assert.match(await page.locator('.fpt-sio-last-export').textContent(), /Последняя копия:.*пора обновить/);
        await page.locator('#fp-settings-export-btn').click();
        await page.locator('.fpt-sio-last-export[data-kind="success"]').waitFor();
        assert.match(await page.locator('.fpt-sio-last-export').textContent(), /Последняя копия: сегодня/);
        assert.equal(await page.evaluate(() => window.qaExported), 1);
        assert.equal(await page.locator('#fp-settings-import-btn').isVisible(), true);
        assert.equal(await page.locator('.fpt-sio').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
