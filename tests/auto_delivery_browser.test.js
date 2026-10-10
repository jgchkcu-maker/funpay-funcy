const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

test('auto-delivery page loads stock states, saves per-lot changes, and fits the full popup', async () => {
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
                    fpToolsAutoDeliveryLots: {
                    '501': { enabled: true, mode: 'secrets', productCount: 2 },
                    '502': { enabled: false, mode: 'secrets', productCount: 4 },
                    '504': { enabled: true, mode: 'template', text: 'Спасибо за покупку', productCount: null }
                },
                // A fresh cache: the page shows it and does not reload lots on its own.
                fpToolsAutoDeliveryLotsCache: { updatedAt: Date.now(), lots: [
                    { id: '501', title: 'Кристаллы Генезиса — расширенный сезонный набор с длинным названием для проверки сетки', nodeId: '42', categoryName: 'Аккаунты', imageUrl: 'https://funpay.com/icon-501.png' },
                    { id: '502', title: 'Игровая валюта', nodeId: '43', categoryName: 'Игровая валюта' },
                    { id: '504', title: '', nodeId: '45', categoryName: 'Подарочные карты' }
                ] }
            };
            window.qaState = state;
            window.qaMessages = [];
            window.qaFailures = {};
            window.qaStockError = true;
            window.qaUseUpdatedTitles = false;
            window.qaHoldSave = false;
            const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
            window.chrome = {
                storage: { local: {
                    get(keys, callback) { const value = get(keys); callback?.(value); return Promise.resolve(value); },
                    set(patch, callback) { Object.assign(state, structuredClone(patch)); callback?.(); return Promise.resolve(); },
                    remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
                }, onChanged: { addListener() {} } },
                runtime: {
                    getURL: file => `https://funpay.com/${file}`,
                    getManifest: () => ({ version: 'test' }),
                    id: 'qa',
                    sendMessage(message, callback) {
                        qaMessages.push(structuredClone(message));
                        if (message.action === 'saveAutoDeliveryLot' && qaHoldSave) {
                            return new Promise(resolve => {
                                window.qaReleaseSave = () => {
                                    state.fpToolsAutoDeliveryLots[message.lotId] = {
                                        ...state.fpToolsAutoDeliveryLots[message.lotId],
                                        ...structuredClone(message.settings)
                                    };
                                    const result = { success: true, data: state.fpToolsAutoDeliveryLots[message.lotId] };
                                    callback?.(result);
                                    resolve(result);
                                };
                            });
                        }
                        let result;
                        if (qaFailures[message.action]) {
                            result = { success: false, error: 'Тестовая ошибка загрузки.' };
                        } else if (message.action === 'getUserLotsList') {
                            const lots = [
                                { id: '501', title: 'Кристаллы Генезиса — расширенный сезонный набор с длинным названием для проверки сетки', nodeId: '42', categoryName: 'Аккаунты', imageUrl: 'https://funpay.com/icon-501.png' },
                                { id: '502', title: 'Игровая валюта', nodeId: '43', categoryName: 'Игровая валюта' },
                                { id: '503', title: 'Ключ доступа', nodeId: '44', categoryName: 'Ключи' },
                                { id: '504', title: '', nodeId: '45', categoryName: 'Подарочные карты' },
                                ...Array.from({ length: 36 }, (_, index) => ({
                                    id: String(505 + index), title: `Тестовый лот ${index + 5}`, nodeId: '46', categoryName: 'Тесты'
                                }))
                            ];
                            result = window.qaUseUpdatedTitles
                                ? lots.map(lot => lot.id === '501' ? { ...lot, title: 'Обновлённое название лота' } : lot)
                                : lots;
                        } else if (message.action === 'syncAutoDeliveryStockCounts') {
                            result = {
                                success: true,
                                counts: window.qaStockError
                                    ? { '501': 6, '503': 0, '504': null }
                                    : { '501': 6, '502': 5, '503': 0, '504': null },
                                errors: window.qaStockError ? [{ lotId: '502', error: 'Склад FunPay временно недоступен.' }] : []
                            };
                        } else if (message.action === 'saveAutoDeliveryLot') {
                            state.fpToolsAutoDeliveryLots[message.lotId] = {
                                ...state.fpToolsAutoDeliveryLots[message.lotId],
                                ...structuredClone(message.settings)
                            };
                            result = { success: true, data: state.fpToolsAutoDeliveryLots[message.lotId] };
                        } else {
                            result = { success: true, data: [], ok: true };
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
        for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(root, js) });
        await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        await page.evaluate(() => window.fptOpenPopupPage('auto_delivery'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'auto_delivery');
        await page.locator('.fpt-ad-lot-row[data-lot-id="504"]').waitFor();
        assert.equal(await page.locator('.fpt-ad-lot-row').count(), 3, 'cached settings should render as soon as the page opens');
        assert.equal(await page.locator('.fpt-ad-cache-status').textContent(), 'Показаны сохранённые настройки. Обновите список, чтобы проверить остатки.');
        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-ad-lot-row').length === 40);
        assert.equal(await page.locator('.fpt-ad-lot-row').count(), 40, 'refresh should replace cached rows with the current lot list');

        const cachedSearch = page.locator('.fpt-ad-search');
        await cachedSearch.fill('игровая валюта');
        assert.deepEqual(await page.locator('.fpt-ad-lot-row:not([hidden])').evaluateAll(rows => rows.map(row => row.dataset.lotId)), ['502']);
        await cachedSearch.fill('');
        const problemsFilter = page.locator('.fpt-ad-summary-chip[data-filter="problems"]');
        assert.match(await problemsFilter.textContent(), /Проблемы\s*\d+/);
        await problemsFilter.click();
        const problemRows = await page.locator('.fpt-ad-lot-row:not([hidden])').evaluateAll(rows => rows.map(row => row.dataset.stock));
        assert.ok(problemRows.length && problemRows.every(kind => kind === 'empty' || kind === 'error'));
        await page.locator('.fpt-ad-summary-chip[data-filter="all"]').click();

        // Lot row controls share one baseline: the «Автовыдача» label, the source label and the save slot sit at the same top,
        // and the switch, source select and save button share the same top and height.
        const rowAlignment = await page.locator('.fpt-ad-lot-row:not([hidden])').first().evaluate(row => {
            const rect = selector => row.querySelector(selector).getBoundingClientRect();
            return {
                deliveryLabel: rect('.fpt-ad-lot-delivery .fpt-ad-field-label').top,
                sourceLabel: rect('.fpt-ad-lot-source .fpt-ad-field-label').top,
                saveSlot: rect('.fpt-ad-lot-save-slot').top,
                switchLine: rect('.fpt-ad-lot-delivery .fpt-ad-switch-line').top,
                select: rect('.fpt-ad-source-select').top,
                save: rect('.fpt-ad-save-button').top,
                selectHeight: rect('.fpt-ad-source-select').height,
                saveHeight: rect('.fpt-ad-save-button').height
            };
        });
        const near = (a, b) => Math.abs(a - b) <= 1;
        assert.ok(near(rowAlignment.deliveryLabel, rowAlignment.sourceLabel) && near(rowAlignment.sourceLabel, rowAlignment.saveSlot),
            `row labels should share one top: ${JSON.stringify(rowAlignment)}`);
        assert.ok(near(rowAlignment.switchLine, rowAlignment.select) && near(rowAlignment.select, rowAlignment.save),
            `switch, source select and save button should share one top: ${JSON.stringify(rowAlignment)}`);
        assert.ok(near(rowAlignment.selectHeight, rowAlignment.saveHeight), `select and save button should have the same height: ${JSON.stringify(rowAlignment)}`);

        const inventoryLabels =await page.locator('.fpt-ad-lot-stock').evaluateAll(nodes => nodes.map(element => ({
            state: element.dataset.stockState, text: element.textContent
        })));
        assert.deepEqual(inventoryLabels.slice(0, 4), [
            { state: 'stocked', text: 'На складе: 6 шт.' },
            { state: 'error', text: 'Не удалось проверить остаток' },
            { state: 'empty', text: 'Склад пуст' },
            { state: 'unknown', text: 'Остаток не отслеживается' }
        ]);
        assert.equal(inventoryLabels.length, 40);
        assert.equal(inventoryLabels.slice(4).every(item => item.state === 'unknown'), true);

        const stockSnapshotRow = page.locator('.fpt-ad-lot-row[data-lot-id="501"]');
        await stockSnapshotRow.locator('.fpt-ad-source-select').selectOption('template');
        await stockSnapshotRow.locator('.fpt-ad-template-input').fill('');
        assert.equal(await stockSnapshotRow.locator('.fpt-ad-save-button').isDisabled(), true,
            'an empty template must not be saved');
        assert.equal(await stockSnapshotRow.locator('.fpt-ad-template-error').isVisible(), true,
            'an empty template must explain why Save is disabled');
        await stockSnapshotRow.locator('.fpt-ad-source-select').selectOption('secrets');
        assert.equal(await stockSnapshotRow.locator('.fpt-ad-lot-stock').textContent(), 'На складе: 6 шт.',
            'switching back to secrets must restore the last known stock');

        assert.equal(await page.locator('#fpToolsAutoRestoreEnabled, #fpToolsAutoDisableEnabled, .fpt-ad-rules').count(), 0,
            'stock automation toggles are gone: the page only shows the stock');
        const disabledRow = page.locator('.fpt-ad-lot-row[data-lot-id="502"]');
        assert.equal(await page.locator('.fpt-ad-disabled-badge, .fpt-ad-switch-state').count(), 0,
            'the toggle alone shows the state: no «Вкл/Выкл» caption');
        const disabledTrackStyle = await disabledRow.locator('.fpt-ad-switch-track').evaluate(element => {
            const style = getComputedStyle(element);
            return { borderColor: style.borderColor, backgroundColor: style.backgroundColor };
        });
        assert.notEqual(disabledTrackStyle.borderColor, 'rgba(0, 0, 0, 0)', 'off switch should keep a visible border');
        assert.notEqual(disabledTrackStyle.backgroundColor, 'rgba(0, 0, 0, 0)', 'off switch should keep a visible track');
        const offKnobCenterOffset = await disabledRow.locator('.fpt-ad-switch-track').evaluate(track => {
            const bounds = track.getBoundingClientRect();
            const knob = getComputedStyle(track, '::after');
            const knobCenterY = bounds.top + track.clientTop + Number.parseFloat(knob.top) + Number.parseFloat(knob.height) / 2;
            const trackCenterY = bounds.top + track.clientTop + track.clientHeight / 2;
            return knobCenterY - trackCenterY;
        });
        assert.ok(Math.abs(offKnobCenterOffset) <= 0.5, `off toggle knob should be vertically centered in the track: ${offKnobCenterOffset}px`);
        assert.equal(await disabledRow.locator('.fpt-ad-template').isVisible(), false);
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="504"] .fpt-ad-template').isVisible(), true);
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="504"] .fpt-ad-lot-title').textContent(), 'Лот #504');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="504"] .fpt-ad-lot-category').textContent(), 'Подарочные карты');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="502"] .fpt-ad-lot-stock').getAttribute('title'), 'Склад FunPay временно недоступен.');
        assert.equal(await page.locator('.fpt-ad-load-status').textContent(), '');
        assert.equal(await page.locator('.fpt-ad-load-status .material-symbols-rounded').textContent(), 'warning');
        assert.equal(await page.locator('#fp-load-delivery-lots-btn .fpt-ad-load-label').textContent(), 'Обновить');
        assert.equal(await page.locator('#fp-load-delivery-lots-btn .material-symbols-rounded').textContent(), 'refresh');
        assert.equal(await page.locator('#fp-load-delivery-lots-btn').evaluate(element => element.getBoundingClientRect().height), 40);

        const helpButton = page.locator('.fp-tools-page-content.active .fpt-category-help');
        await helpButton.click();
        await page.locator('#fpt-ad-help').evaluate(panel => Promise.all(panel.getAnimations().map(animation => animation.finished.catch(() => undefined))));
        const helpGeometry = await page.locator('#fpt-ad-help').evaluate(panel => {
            const button = document.querySelector('.fp-tools-page-content.active .fpt-category-help').getBoundingClientRect();
            const bounds = panel.getBoundingClientRect();
            return { top: bounds.top, buttonBottom: button.bottom, right: bounds.right, buttonRight: button.right, left: bounds.left, width: bounds.width };
        });
        assert.ok(helpGeometry.top >= helpGeometry.buttonBottom, `help should open below its button: ${JSON.stringify(helpGeometry)}`);
        assert.ok(Math.abs(helpGeometry.right - helpGeometry.buttonRight) <= 1, `help should align to the right edge of its button: ${JSON.stringify(helpGeometry)}`);
        assert.ok(helpGeometry.left >= 0 && helpGeometry.width >= 220 && helpGeometry.width <= 340, `help should remain readable inside the viewport: ${JSON.stringify(helpGeometry)}`);
        await page.locator('#fpt-ad-hero-title').click();

        await page.locator('.fpt-auto-delivery .fpt-ad-rule-row .fpt-ad-global-switch').first().evaluate(input => input.click());
        await page.locator('.fpt-popup-toast[data-kind="success"]').waitFor();
        assert.equal(await page.locator('.fpt-auto-delivery .fpt-ad-rules-status').textContent(), '');
        assert.equal(await page.locator('.fpt-ad-load-status').textContent(), '');

        const desktopGrid = await page.locator('.fpt-ad-lot-row').evaluateAll(rows => rows.map(row => {
            const rowBounds = row.getBoundingClientRect();
            const cells = ['.fpt-ad-lot-summary', '.fpt-ad-lot-delivery', '.fpt-ad-lot-source', '.fpt-ad-lot-save-area'];
            const template = row.querySelector('.fpt-ad-template');
            const templateInput = row.querySelector('.fpt-ad-template-input');
            return {
                height: rowBounds.height,
                templateVisible: !template.hidden,
                templateWidth: template.getBoundingClientRect().width,
                templateInputHeight: templateInput.getBoundingClientRect().height,
                columns: cells.map(selector => Math.round((row.querySelector(selector).getBoundingClientRect().left - rowBounds.left) * 10) / 10),
                width: row.clientWidth,
                scrollWidth: row.scrollWidth
            };
        }));
        assert.ok(desktopGrid.filter(row => !row.templateVisible).every(row => row.height <= 96), `lot rows should be compact at 1204 × 789: ${JSON.stringify(desktopGrid)}`);
        assert.ok(desktopGrid.every(row => row.scrollWidth <= row.width + 1), `lot rows should not overflow at 1204 × 789: ${JSON.stringify(desktopGrid)}`);
        assert.ok(desktopGrid.every(row => JSON.stringify(row.columns) === JSON.stringify(desktopGrid[0].columns)), `four columns should align across lots: ${JSON.stringify(desktopGrid)}`);
        assert.ok(desktopGrid.find(row => row.templateVisible).templateWidth <= desktopGrid.find(row => row.templateVisible).width + 1, `template editor should span only its lot row: ${JSON.stringify(desktopGrid)}`);
        const longTitle = await page.locator('.fpt-ad-lot-row').first().locator('.fpt-ad-lot-title').evaluate(element => ({
            lineClamp: getComputedStyle(element).webkitLineClamp,
            height: element.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight)
        }));
        assert.equal(longTitle.lineClamp, '2', `long title should clamp to two lines: ${JSON.stringify(longTitle)}`);
        assert.ok(longTitle.height <= longTitle.lineHeight * 2 + 1, `long title should stay within two lines: ${JSON.stringify(longTitle)}`);
        const disabledSaveStyle = await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-save-button').evaluate(element => {
            const style = getComputedStyle(element);
            return { opacity: style.opacity, backgroundColor: style.backgroundColor, borderStyle: style.borderStyle };
        });
        assert.equal(disabledSaveStyle.opacity, '0.6');
        assert.notEqual(disabledSaveStyle.backgroundColor, 'rgba(0, 0, 0, 0)', 'disabled save should remain visibly filled');
        assert.equal(disabledSaveStyle.borderStyle, 'solid');

        await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            let branch = popup;
            while (branch?.parentElement && branch.parentElement !== document.body) {
                for (const sibling of branch.parentElement.children) {
                    if (sibling !== branch) sibling.style.visibility = 'hidden';
                }
                branch = branch.parentElement;
            }
            for (const sibling of document.body.children) {
                if (sibling !== branch && !sibling.classList.contains('fpt-popup-toast-region')) sibling.style.visibility = 'hidden';
            }
            document.body.style.backgroundColor = '#fff';
        });
        const screenshotDirectory = path.join(require('node:os').tmpdir(), 'funpay-auto-delivery-reference');
        fs.mkdirSync(screenshotDirectory, { recursive: true });
        const setScreenshotTheme = async dark => page.evaluate(isDark => {
            const popup = document.querySelector('.fp-tools-popup');
            const values = isDark ? {
                '--fptm-bg': '#1e1f24', '--fptm-head': '#191a1e', '--fptm-nav': '#1b1c21',
                '--fptm-text': '#e7e8ec', '--fptm-muted': 'rgba(231,232,236,.76)', '--fptm-faint': 'rgba(231,232,236,.56)',
                '--fptm-border': 'rgba(255,255,255,.10)', '--fptm-surface': '#26272d', '--fptm-surface-2': '#2c2e35',
                '--fptm-hover': 'rgba(255,255,255,.07)', '--fptm-field': '#26272d', '--fptm-accent': '#7663f6',
                '--fptm-accent-soft': 'rgba(118,99,246,.22)', '--fptm-accent-border': 'rgba(118,99,246,.5)',
                '--fptm-on-accent': '#fff', '--fptm-shadow': 'rgba(0,0,0,.55)', '--fptm-nav-border': 'rgba(255,255,255,.10)',
                '--fptm-nav-field': '#2a2e37', '--fptm-nav-field-focus': '#313640', '--fptm-success': '#80d9ad',
                '--fptm-danger': '#ff9aa3', '--fptm-warning': '#ffd27a'
            } : {
                '--fptm-bg': '#fff', '--fptm-head': '#f7f8fb', '--fptm-nav': '#fbfcfe',
                '--fptm-text': '#16181d', '--fptm-muted': 'rgba(22,24,29,.74)', '--fptm-faint': 'rgba(22,24,29,.56)',
                '--fptm-border': 'rgba(22,24,29,.10)', '--fptm-surface': '#f5f7fa', '--fptm-surface-2': '#eef1f6',
                '--fptm-hover': 'rgba(22,24,29,.05)', '--fptm-field': '#fff', '--fptm-accent': '#7663f6',
                '--fptm-accent-soft': 'rgba(118,99,246,.12)', '--fptm-accent-border': 'rgba(118,99,246,.35)',
                '--fptm-on-accent': '#fff', '--fptm-shadow': 'rgba(22,24,29,.16)', '--fptm-nav-border': 'rgba(119,99,246,.16)',
                '--fptm-nav-field': '#f4f3ff', '--fptm-nav-field-focus': '#fff', '--fptm-success': '#267a58',
                '--fptm-danger': '#b83e4a', '--fptm-warning': '#8b5d10'
            };
            popup.classList.toggle('fptm-dark', isDark);
            popup.classList.toggle('fptm-light', !isDark);
            document.documentElement.classList.toggle('fpt-theme-dark', isDark);
            for (const [name, value] of Object.entries(values)) popup.style.setProperty(name, value);
            document.body.style.backgroundColor = isDark ? '#15161a' : '#fff';
        }, dark);
        for (const dark of [false, true]) {
            await setScreenshotTheme(dark);
            for (const width of [1204, 680, 420]) {
                await page.setViewportSize({ width, height: 789 });
                await page.waitForTimeout(360);
                const layout = await page.evaluate(() => {
                    const popup = document.querySelector('.fp-tools-popup');
                    const content = document.querySelector('.fp-tools-content');
                    const row = document.querySelector('.fpt-ad-lot-row[data-lot-id="501"]');
                    const bounds = popup.getBoundingClientRect();
                    return {
                        viewport: window.innerWidth,
                        documentWidth: document.documentElement.scrollWidth,
                        popupLeft: bounds.left, popupRight: bounds.right,
                        contentWidth: content.clientWidth, contentScrollWidth: content.scrollWidth,
                        rowWidth: row.clientWidth, rowScrollWidth: row.scrollWidth
                    };
                });
                assert.ok(layout.popupLeft >= 0 && layout.popupRight <= width + 1, `auto-delivery popup should fit at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.documentWidth <= width + 1, `auto-delivery page should not scroll horizontally at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.contentWidth > 0 && layout.contentScrollWidth <= layout.contentWidth + 1, `auto-delivery content should fit at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.rowScrollWidth <= layout.rowWidth + 1, `auto-delivery lot should fit at ${width}px: ${JSON.stringify(layout)}`);
                const screenshot = path.join(screenshotDirectory, `auto-delivery-${dark ? 'dark' : 'light'}-${width}x789.png`);
                await page.screenshot({ path: screenshot });
            }
        }
        await setScreenshotTheme(false);
        await page.setViewportSize({ width: 1204, height: 789 });

        await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-source-select').selectOption('template');
        await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-template-input').fill('Ваш заказ: готово');
        assert.match(await page.locator('.fpt-ad-save-all').textContent(), /Сохранить все \(1\)/);
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-unsaved-badge').textContent(), 'Не сохранено');
        const dirtySaveStyle = await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-save-button').evaluate(element => ({
            disabled: element.disabled,
            backgroundColor: getComputedStyle(element).backgroundColor
        }));
        assert.equal(dirtySaveStyle.disabled, false);
        assert.notEqual(dirtySaveStyle.backgroundColor, 'rgba(0, 0, 0, 0)', 'dirty save should be filled with the accent color');
        await page.evaluate(() => { window.qaHoldSave = true; });
        const pendingSave = page.locator('.fpt-ad-save-all').click();
        await page.waitForFunction(() => {
            const row = document.querySelector('.fpt-ad-lot-row[data-lot-id="501"]');
            return row?.querySelector('.fpt-ad-source-select')?.disabled
                && row?.querySelector('.fpt-ad-template-input')?.disabled;
        });
        await page.evaluate(() => { window.qaHoldSave = false; window.qaReleaseSave(); });
        await page.locator('.fpt-popup-toast').getByText('Сохранено', { exact: true }).waitFor();
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-lot-save-status').textContent(), '');
        await pendingSave;
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-template-input').isDisabled(), false);
        assert.equal(await windowState(page, '501', 'mode'), 'template');
        assert.equal(await page.locator('.fpt-ad-save-all').textContent(), 'Сохранить все (0)');
        assert.equal(await page.locator('.fpt-ad-save-all').isDisabled(), true, 'save-all should disable when every draft is saved');

        await page.evaluate(() => { window.qaFailures.saveAutoDeliveryLot = true; });
        await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-template-input').fill('Ошибка сохранения');
        await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-save-button').click();
        await page.locator('.fpt-popup-toast[data-kind="error"]').getByText('Тестовая ошибка загрузки.', { exact: true }).waitFor();
        assert.equal(await windowState(page, '501', 'text'), 'Ваш заказ: готово');
        await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-template-input').fill('Ваш заказ: готово');
        assert.equal(await page.locator('.fpt-ad-save-all').isDisabled(), true, 'restoring the saved value should clear the dirty state');
        const errorGrid = await page.locator('.fpt-ad-lot-row').evaluateAll(rows => rows.map(row => {
            const rowBounds = row.getBoundingClientRect();
            const saveArea = row.querySelector('.fpt-ad-lot-save-area');
            const status = row.querySelector('.fpt-ad-lot-save-status');
            return {
                columns: ['.fpt-ad-lot-summary', '.fpt-ad-lot-delivery', '.fpt-ad-lot-source', '.fpt-ad-lot-save-area']
                    .map(selector => Math.round((row.querySelector(selector).getBoundingClientRect().left - rowBounds.left) * 10) / 10),
                width: row.clientWidth,
                scrollWidth: row.scrollWidth,
                statusWidth: status.getBoundingClientRect().width,
                saveWidth: saveArea.getBoundingClientRect().width
            };
        }));
        assert.ok(errorGrid.every(row => row.scrollWidth <= row.width + 1), `save errors should stay inside the lot row: ${JSON.stringify(errorGrid)}`);
        assert.ok(errorGrid.every(row => JSON.stringify(row.columns) === JSON.stringify(errorGrid[0].columns)), `save errors should not shift grid columns: ${JSON.stringify(errorGrid)}`);
        assert.ok(errorGrid[0].statusWidth <= errorGrid[0].saveWidth + 1, `save status should fit its column: ${JSON.stringify(errorGrid[0])}`);

        await page.evaluate(() => { window.qaFailures.getUserLotsList = true; });
        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.locator('.fpt-ad-load-status[data-kind="error"]').waitFor();
        assert.match(await page.locator('.fpt-ad-load-status').textContent(), /Тестовая ошибка загрузки/);
        assert.equal(await page.locator('.fpt-ad-lot-row').count(), 40, 'a refresh failure should keep the last rendered list');
        assert.equal(await page.locator('#fp-load-delivery-lots-btn .fpt-ad-load-label').textContent(), 'Обновить');

        await page.evaluate(() => { window.qaFailures = {}; window.qaStockError = false; });
        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-ad-lot-row').length === 40);
        assert.equal(await page.locator('.fpt-ad-load-status').textContent(), '');
        assert.equal(await page.locator('.fpt-ad-load-status .material-symbols-rounded').textContent(), 'check_circle');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="502"] .fpt-ad-lot-stock').textContent(), 'На складе: 5 шт.');
        assert.equal(await page.locator('#fp-load-delivery-lots-btn .fpt-ad-load-label').textContent(), 'Обновить');

        await page.evaluate(() => { window.qaStockError = true; });
        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-ad-lot-row').length === 40);
        assert.equal(await page.locator('.fpt-ad-load-status').textContent(), '');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="502"] .fpt-ad-lot-stock').textContent(), 'Не удалось проверить остаток');

        await page.evaluate(() => {
            window.qaStockError = false;
            window.qaUseUpdatedTitles = true;
            window.qaState.fpToolsAutoDeliveryLots['501'] = {
                enabled: false, mode: 'template', text: 'Настройка с сервера', productCount: null
            };
        });
        await page.locator('.fpt-ad-lot-row[data-lot-id="502"] [data-lot-control="enabled"]').check();
        await page.locator('#fp-load-delivery-lots-btn').click();
        await page.getByText('Обновлённое название лота', { exact: true }).waitFor();
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="501"] .fpt-ad-template-input').inputValue(), 'Настройка с сервера',
            'a clean row should adopt the newest saved settings');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="502"] [data-lot-control="enabled"]').isChecked(), true,
            'a refresh should preserve the user’s unsaved change');
        assert.equal(await page.locator('.fpt-ad-lot-row[data-lot-id="502"] .fpt-ad-unsaved-badge').isVisible(), true);

        const rowLayout = await page.locator('.fpt-ad-lot-row[data-lot-id="501"]').evaluate(row => ({
            width: row.clientWidth,
            scrollWidth: row.scrollWidth
        }));
        assert.ok(rowLayout.scrollWidth <= rowLayout.width + 1, `lot row overflows at 1204 × 789: ${JSON.stringify(rowLayout)}`);

        await page.setViewportSize({ width: 680, height: 789 });
        const narrowRowLayout = await page.locator('.fpt-ad-lot-row[data-lot-id="501"]').evaluate(row => ({
            width: row.clientWidth,
            scrollWidth: row.scrollWidth,
            columns: getComputedStyle(row).gridTemplateColumns,
            viewport: window.innerWidth,
            popupWidth: document.querySelector('.fp-tools-popup').getBoundingClientRect().width,
            contentWidth: document.querySelector('.fp-tools-content').getBoundingClientRect().width,
            deliveryContainer: row.parentElement.getBoundingClientRect().width
        }));
        assert.ok(narrowRowLayout.scrollWidth <= narrowRowLayout.width + 1, `lot row overflows at 680px: ${JSON.stringify(narrowRowLayout)}`);
        assert.equal(narrowRowLayout.columns.split(' ').length, 1, `lot controls should stack on narrow content: ${JSON.stringify(narrowRowLayout)}`);
        const narrowSaveLayout = await page.locator('.fpt-ad-lot-row[data-lot-id="501"]').evaluate(row => {
            const bounds = row.getBoundingClientRect();
            const save = row.querySelector('.fpt-ad-save-button').getBoundingClientRect();
            return { rowRight: bounds.right, saveRight: save.right, saveWidth: save.width };
        });
        assert.ok(narrowSaveLayout.saveRight <= narrowSaveLayout.rowRight + 1, `save button should remain inside its row at 680px: ${JSON.stringify(narrowSaveLayout)}`);
        assert.ok(Math.abs(narrowSaveLayout.rowRight - narrowSaveLayout.saveRight - 14) <= 2, `save button should align to the padded right edge on narrow cards: ${JSON.stringify(narrowSaveLayout)}`);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

function windowState(page, lotId, key) {
    return page.evaluate(({ lotId, key }) => window.qaState.fpToolsAutoDeliveryLots[lotId]?.[key], { lotId, key });
}
