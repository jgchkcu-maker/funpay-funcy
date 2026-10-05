const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;

test('autobump page renders status, saves rules with rollback, picks categories and shows the log', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1204, height: 789 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
                const asset = path.join(root, pathname);
                if (fs.existsSync(asset)) return route.fulfill({ path: asset });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        await page.goto('https://funpay.com/');
        await page.setContent('<html><head></head><body><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>');
        await page.evaluate(() => {
            document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
            const state = {
                autoBumpEnabled: true,
                fpToolsSelectiveBumpEnabled: false,
                fpToolsSelectedBumpCategories: ['/lots/1/trade'],
                fpToolsBumpOnlyAutoDelivery: false,
                fpToolsAutoBumpLogs: [
                    '[12:04:11] Следующее поднятие примерно через 4 ч 1 мин.',
                    '[12:04:09] Поднято: Аккаунты',
                    '[12:04:07] Лимит: Ключи. Следующая попытка через 1 ч 10 мин.',
                    '[12:04:05] Не поднято: [Системная ошибка]. Не удалось получить данные авторизации.',
                    '[12:04:01] Автоподнятие включено.'
                ]
            };
            window.qaState = state;
            window.qaMessages = [];
            window.qaFailSave = false;
            const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
            window.chrome = {
                storage: { local: {
                    get(keys, callback) { const value = get(keys); callback?.(value); return Promise.resolve(value); },
                    set(patch, callback) {
                        if (window.qaFailSave && 'fpToolsBumpOnlyAutoDelivery' in patch) return Promise.reject(new Error('Тестовая ошибка сохранения.'));
                        Object.assign(state, structuredClone(patch)); callback?.(); return Promise.resolve();
                    },
                    remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
                }, onChanged: { addListener() {} } },
                runtime: {
                    getURL: file => `https://funpay.com/${file}`,
                    getManifest: () => ({ version: 'test' }),
                    id: 'qa',
                    sendMessage(message, callback) {
                        qaMessages.push(structuredClone(message));
                        let result = { success: true, ok: true, data: [] };
                        if (message.action === 'getAutoBumpStatus') result = { success: true, nextRunAt: Date.now() + (3 * 60 + 12) * 60000 };
                        else if (message.action === 'getUserCategories') {
                            result = { success: true, data: [
                                { id: '/lots/1/trade', name: 'Аккаунты Genshin Impact', lots: [{}, {}, {}], hasAutoDelivery: true },
                                { id: '/lots/2/trade', name: 'Игровая валюта', lots: [{}], hasAutoDelivery: false },
                                { id: '/lots/3/trade', name: 'Ключи Steam', lots: [{}, {}], hasAutoDelivery: true }
                            ] };
                        } else if (message.action === 'fptRaiseAllNow') {
                            state.fpToolsAutoBumpLogs = ['[12:10:00] Поднято: Аккаунты', ...state.fpToolsAutoBumpLogs];
                            result = { ok: true, summary: { raised: 2, errors: 0, skipped: 0 } };
                        }
                        callback?.(result);
                        return Promise.resolve(result);
                    },
                    onMessage: { addListener() {} }
                }
            };
        });

        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
        const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
        for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
        for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
        await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        await page.evaluate(() => window.fptOpenPopupPage('autobump'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'autobump');
        await page.locator('.fpt-auto-bump .fpt-ab-hero').waitFor();

        // Hero reflects the saved state and the scheduled alarm.
        assert.equal(await page.locator('.fpt-ab-hero').getAttribute('data-state'), 'on');
        assert.equal(await page.locator('#autoBumpEnabled').isChecked(), true);
        assert.equal((await page.locator('.fpt-ab-hero .fpt-ab-pill').textContent()).trim(), 'Работает');
        await page.waitForFunction(() => /через 3 ч 1\d мин|через 3 ч 12 мин/.test(document.querySelector('.fpt-ab-metric-value')?.textContent || ''));
        const values = await page.locator('.fpt-ab-metric-value').allTextContents();
        assert.equal(values[1], 'Все категории');
        assert.match(values[2], /Следующее поднятие примерно/);

        // Log: newest first with classified rows.
        assert.deepEqual(await page.locator('.fpt-ab-log-item').evaluateAll(items => items.map(item => item.dataset.kind)),
            ['info', 'success', 'warning', 'error', 'info']);
        if (shotDir) { await page.waitForTimeout(900); await page.screenshot({ path: path.join(shotDir, 'autobump-light.png') }); }

        // Rule toggles persist and show the category summary.
        assert.equal(await page.locator('.fpt-ab-selection').isHidden(), true);
        await page.locator('#fpToolsSelectiveBumpEnabled').evaluate(input => input.click());
        await page.waitForFunction(() => window.qaState.fpToolsSelectiveBumpEnabled === true);
        assert.equal(await page.locator('.fpt-ab-selection').isVisible(), true);
        assert.match(await page.locator('.fpt-ab-selection-summary').textContent(), /Выбрано: 1 категория/);

        // A failed save rolls the switch back and reports the error.
        const rulesStatusHeight = (await page.locator('.fpt-ab-rules .fpt-ad-rules-status').boundingBox()).height;
        await page.evaluate(() => { window.qaFailSave = true; });
        await page.locator('#fpToolsBumpOnlyAutoDelivery').evaluate(input => input.click());
        await page.locator('.fpt-popup-toast[data-kind="error"]').waitFor();
        assert.equal(await page.locator('.fpt-ab-rules .fpt-ad-rules-status').textContent(), '');
        assert.equal((await page.locator('.fpt-ab-rules .fpt-ad-rules-status').boundingBox()).height, rulesStatusHeight, 'error feedback retains the reserved status height');
        assert.equal(await page.locator('#fpToolsBumpOnlyAutoDelivery').isChecked(), false, 'the switch rolls back on a failed save');
        await page.evaluate(() => { window.qaFailSave = false; });

        // Category dialog: load, search, select all, save.
        await page.locator('#configureSelectiveBumpBtn').click();
        await page.locator('.fpt-ab-category-row').first().waitFor();
        assert.equal(await page.locator('.fpt-ab-category-row').count(), 3);
        assert.match(await page.locator('.fpt-ab-dialog-counter').textContent(), /Выбрано: 1 из 3/);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'autobump-dialog.png') });
        await page.locator('.fpt-lot-dialog .fpt-ad-search').fill('steam');
        assert.equal(await page.locator('.fpt-ab-category-row').count(), 1);
        await page.locator('.fpt-lot-dialog .fpt-ad-search').fill('');
        await page.getByRole('button', { name: 'Выбрать / снять все' }).click();
        assert.match(await page.locator('.fpt-ab-dialog-counter').textContent(), /Выбрано: 3 из 3/);
        await page.getByRole('button', { name: 'Сохранить' }).click();
        await page.waitForFunction(() => !document.querySelector('.fpt-lot-dialog'));
        assert.deepEqual(await page.evaluate(() => window.qaState.fpToolsSelectedBumpCategories), ['/lots/1/trade', '/lots/2/trade', '/lots/3/trade']);
        assert.match(await page.locator('.fpt-ab-selection-summary').textContent(), /Выбрано: 3 категории/);

        // Raise now writes to the log through the existing background route.
        await page.locator('#fpt-ab-raise-now').click();
        await page.waitForFunction(() => /Поднято: 2 категории/.test(document.querySelector('.fpt-popup-toast-text')?.textContent || ''));
        assert.equal(await page.locator('.fpt-ab-hero-status').textContent(), '');
        assert.equal(await page.locator('.fpt-ab-log-item').count(), 6);
        assert.ok((await page.evaluate(() => window.qaMessages)).some(message => message.action === 'fptRaiseAllNow'));

        // Master switch off stops the background alarm and updates the hero.
        await page.locator('#autoBumpEnabled').evaluate(input => input.click());
        await page.waitForFunction(() => document.querySelector('.fpt-ab-hero')?.dataset.state === 'off');
        assert.ok((await page.evaluate(() => window.qaMessages)).some(message => message.action === 'stopAutoBump'));
        assert.equal((await page.locator('.fpt-ab-hero .fpt-ab-pill').textContent()).trim(), 'Выключено');

        // Clearing the log shows the empty state.
        await page.getByRole('button', { name: 'Очистить' }).click();
        await page.locator('.fpt-ab-log-empty').waitFor();

        // No horizontal overflow at a narrow width.
        await page.setViewportSize({ width: 560, height: 800 });
        await page.evaluate(async () => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(document.querySelector('.fpt-auto-bump').getAnimations({ subtree: true })
                .filter(animation => animation.effect.getTiming().iterations !== Infinity)
                .map(animation => animation.finished.catch(() => undefined)));
        });
        if (shotDir) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(shotDir, 'autobump-narrow.png') }); }
        assert.equal(await page.evaluate(() => {
            const view = document.querySelector('.fpt-auto-bump');
            return view.scrollWidth <= view.clientWidth + 1;
        }), true, 'the screen must not overflow horizontally');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
