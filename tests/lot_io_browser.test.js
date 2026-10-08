const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

async function createLotIoPage(options = {}) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: options.width || 1204, height: 789 } });
    await page.setContent(`
        <div class="fp-tools-popup fptm-themed active">
            <div class="fp-tools-body">
                <nav class="fp-tools-nav"></nav>
                <main class="fp-tools-content">
                    <div class="fp-tools-page-content active" data-page="lot_io"></div>
                </main>
            </div>
        </div>
    `);
    await page.addStyleTag({ path: path.join(root, 'css/content_styles.css') });
    await page.addStyleTag({ path: path.join(root, 'css/popup_categories.css') });
    await page.addStyleTag({ path: path.join(root, 'css/fpt_icons_theme.css') });
    await page.addStyleTag({ content: `
        .fp-tools-popup { position: relative; box-sizing: border-box; width: min(100vw, 1204px); height: 789px; }
        .fp-tools-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); height: 100%; }
        .fp-tools-nav { min-width: 0; }
        .fp-tools-content { position: relative; min-width: 0; overflow: auto; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .fp-tools-popup { background: var(--fptm-bg); color: var(--fptm-text); overflow: hidden; }
        .fp-tools-content { background: var(--fptm-bg); color: var(--fptm-text); }
        @media (max-width: 740px) { .fp-tools-body { grid-template-columns: 104px minmax(0, 1fr); } }
        .fp-tools-popup.fptm-themed {
            --fptm-bg: #fff; --fptm-text: #18201d; --fptm-muted: #59645f;
            --fptm-accent: #247653; --fptm-on-accent: #fff; --fptm-accent-soft: #e5f2ec;
            --fptm-accent-border: #8cb6a2; --fptm-nav-border: #d7e0db;
            --fptm-nav-field: #f4f7f5; --fptm-hover: #e9efeb; --fptm-shadow: #0002;
        }
    ` });
    const iconFont = require('node:fs').readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
    await page.addStyleTag({ content: `@font-face { font-family: 'Material Symbols Rounded'; font-style: normal; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,${iconFont}) format('woff2'); }` });
    await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
    await page.evaluate(configuration => {
        window.qaPendingTask = configuration.task || null;
        window.qaHoldPendingImport = configuration.holdPendingImport;
        window.qaLotActions = [];
        window.qaBulkLots = [
            { offerId: '501', nodeId: '42', title: 'Аккаунт Premium', categoryName: 'Аккаунты', price: '100' },
            { offerId: '502', nodeId: '43', title: 'Ключ доступа', categoryName: 'Ключи', price: '50' }
        ];
        window.qaExportCategories = [];
        window.qaHoldExport = false;
        window.fptPopupActions = Object.freeze({
            register() {},
            async run(pageId, actionId, payload = {}) {
                window.qaLotActions.push({ pageId, actionId });
                if (actionId === 'renderPendingImports') {
                    if (window.qaHoldPendingImport) return new Promise(resolve => {
                        window.qaReleasePendingImport = () => resolve(window.qaPendingTask);
                    });
                    return window.qaPendingTask;
                }
                if (actionId === 'lot-io-export-btn') return window.qaExportCategories;
                if (actionId === 'lot-io-export-confirm') {
                    const selected = new Set(payload.selectedCategoryIds || []);
                    const exported = payload.categories.filter(category => selected.has(category.id)).flatMap(category => category.lots || []);
                    payload.onProgress?.({ current: Math.min(1, exported.length), total: exported.length });
                    if (window.qaHoldExport) return new Promise((resolve, reject) => {
                        window.qaReleaseExport = () => resolve(exported);
                        payload.signal?.addEventListener('abort', () => {
                            const error = new Error('Export stopped');
                            error.name = 'AbortError';
                            reject(error);
                        }, { once: true });
                    });
                    return exported;
                }
                if (actionId === 'fp-bulk-edit-btn') return window.qaBulkLots;
                if (['fp-bulk-apply-btn', 'fp-bulk-activate-btn'].includes(actionId)) {
                    const results = payload.lots.map(lot => lot.offerId === window.qaFailOffer
                        ? { offerId: lot.offerId, success: false, error: 'FunPay отклонил сохранение.' }
                        : { offerId: lot.offerId, success: true, title: `${lot.title} ✓` });
                    payload.onProgress?.({ processed: results.length, total: results.length, result: results.at(-1) });
                    window.qaLastBulkPayload = { lots: payload.lots, changes: payload.changes };
                    return { results, successCount: results.filter(result => result.success).length };
                }
                return { success: true };
            },
            toggleCategorySelection() { return []; }
        });
    }, { task: options.pendingTask, holdPendingImport: options.holdPendingImport === true });
    await page.addScriptTag({ path: path.join(root, 'content/features/bulk_lot_editor.js') });
    await page.addScriptTag({ path: path.join(root, 'content/ui/lot_io_page.js') });
    await page.evaluate(() => { window.qaMountPromise = window.FPTLotIOPage.mount(document.querySelector('.fp-tools-popup')); });
    await page.locator('.fpt-lot-action-band').waitFor();
    if (!options.holdPendingImport) await page.evaluate(() => window.qaMountPromise);
    return { browser, page };
}

test('lot management keeps its help button after the page mounts', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        const helpButton = page.locator('.fp-tools-page-content[data-page="lot_io"] .fpt-category-help');
        assert.equal(await helpButton.count(), 1);
        await helpButton.click();
        assert.equal(await page.locator('.fpt-lot-help-popover').isVisible(), true);
        assert.equal(await helpButton.getAttribute('aria-expanded'), 'true');
        assert.equal(await helpButton.getAttribute('aria-controls'), 'fpt-lot-help');
        for (const width of [1204, 760, 420]) {
            await page.setViewportSize({ width, height: 789 });
            const buttonBox = await helpButton.boundingBox();
            const panelBox = await page.locator('.fpt-lot-help-popover').boundingBox();
            assert.ok(Math.abs(panelBox.x + panelBox.width - buttonBox.x - buttonBox.width) <= 1,
                `help should align with the button's right edge at ${width}px`);
            assert.ok(Math.abs(panelBox.y - buttonBox.y - buttonBox.height - 8) <= 1,
                `help should open 8px below the button at ${width}px`);
            assert.ok(panelBox.x >= 0 && panelBox.x + panelBox.width <= width,
                `help should stay within the viewport at ${width}px`);
        }
    } finally {
        await browser.close();
    }
});

test('lot management uses a task-card skeleton while checking pending imports', async () => {
    const { browser, page } = await createLotIoPage({ holdPendingImport: true });
    try {
        const skeleton = page.locator('.fpt-lot-task-skeleton');
        await skeleton.waitFor({ timeout: 3000 });
        assert.equal(await skeleton.getAttribute('aria-hidden'), 'true');
        assert.equal(await page.locator('.fpt-lot-empty').count(), 0);
        await page.setViewportSize({ width: 420, height: 789 });
        const skeletonLayout = await skeleton.evaluate(element => ({
            width: element.clientWidth, scrollWidth: element.scrollWidth,
            pageWidth: element.parentElement.clientWidth, pageScrollWidth: element.parentElement.scrollWidth
        }));
        assert.ok(skeletonLayout.scrollWidth <= skeletonLayout.width + 1 && skeletonLayout.pageScrollWidth <= skeletonLayout.pageWidth + 1,
            `import skeleton should fit the narrow page: ${JSON.stringify(skeletonLayout)}`);
        await page.evaluate(() => window.qaReleasePendingImport());
        await page.locator('.fpt-lot-empty').waitFor();
        assert.equal(await skeleton.count(), 0, 'the skeleton should disappear when the pending-import check completes');
    } finally {
        await browser.close();
    }
});

test('lot management fits 1204, 680, and 420 pixel viewports in light and dark themes', async () => {
    const { browser, page } = await createLotIoPage({
        pendingTask: {
            name: 'backup-2026-10-05.json', state: 'running', currentIndex: 2,
            lots: [
                { title: 'Аккаунт Premium', status: 'success' },
                { title: 'Ключ доступа', status: 'success' },
                { title: 'Подарочная карта', status: 'pending' }
            ]
        }
    });
    try {
        const outputDirectory = path.join(require('node:os').tmpdir(), 'funpay-lot-io-reference');
        const applyTheme = dark => page.evaluate(isDark => {
            const popup = document.querySelector('.fp-tools-popup');
            const values = isDark ? {
                '--fptm-bg': '#1e1f24', '--fptm-text': '#e7e8ec', '--fptm-muted': 'rgba(231,232,236,.76)',
                '--fptm-accent': '#7663f6', '--fptm-on-accent': '#fff', '--fptm-accent-soft': 'rgba(118,99,246,.22)',
                '--fptm-accent-border': 'rgba(118,99,246,.5)', '--fptm-nav-border': 'rgba(255,255,255,.10)',
                '--fptm-nav-field': '#2a2e37', '--fptm-hover': 'rgba(255,255,255,.07)', '--fptm-shadow': 'rgba(0,0,0,.55)',
                '--fptm-success': '#80d9ad', '--fptm-danger': '#ff9aa3', '--fptm-warning': '#ffd27a'
            } : {
                '--fptm-bg': '#fff', '--fptm-text': '#18201d', '--fptm-muted': '#59645f',
                '--fptm-accent': '#247653', '--fptm-on-accent': '#fff', '--fptm-accent-soft': '#e5f2ec',
                '--fptm-accent-border': '#8cb6a2', '--fptm-nav-border': '#d7e0db',
                '--fptm-nav-field': '#f4f7f5', '--fptm-hover': '#e9efeb', '--fptm-shadow': '#0002',
                '--fptm-success': '#267a58', '--fptm-danger': '#b83e4a', '--fptm-warning': '#8b5d10'
            };
            popup.classList.toggle('fptm-dark', isDark);
            popup.classList.toggle('fptm-light', !isDark);
            document.documentElement.classList.toggle('fpt-theme-dark', isDark);
            for (const [name, value] of Object.entries(values)) popup.style.setProperty(name, value);
            document.body.style.backgroundColor = isDark ? '#15161a' : '#fff';
        }, dark);
        require('node:fs').mkdirSync(outputDirectory, { recursive: true });
        await page.locator('.fp-tools-page-content.active').evaluate(element =>
            Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))));
        for (const dark of [false, true]) {
            await applyTheme(dark);
            for (const width of [1204, 680, 420]) {
                await page.setViewportSize({ width, height: 789 });
                const layout = await page.evaluate(() => {
                    const popup = document.querySelector('.fp-tools-popup');
                    const content = document.querySelector('.fp-tools-content');
                    const pageContent = document.querySelector('.fp-tools-page-content.active');
                    const bounds = popup.getBoundingClientRect();
                    return {
                        viewport: innerWidth,
                        documentWidth: document.documentElement.scrollWidth,
                        popupLeft: bounds.left, popupRight: bounds.right,
                        contentWidth: content.clientWidth, contentScrollWidth: content.scrollWidth,
                        pageWidth: pageContent.clientWidth, pageScrollWidth: pageContent.scrollWidth
                    };
                });
                assert.ok(layout.popupLeft >= 0 && layout.popupRight <= width + 1, `lot management popup should fit at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.documentWidth <= width + 1, `lot management page should not scroll horizontally at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.contentWidth > 0 && layout.contentScrollWidth <= layout.contentWidth + 1, `lot management content should fit at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.pageScrollWidth <= layout.pageWidth + 1, `lot management screen should fit at ${width}px: ${JSON.stringify(layout)}`);
                await page.screenshot({ path: path.join(outputDirectory, `lot-management-${dark ? 'dark' : 'light'}-${width}x789.png`) });
            }
        }
    } finally {
        await browser.close();
    }
});

test('bulk editor guides lot selection, changes, and review with live validation', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        await page.locator('#fp-bulk-edit-btn').click();
        await page.locator('.fpt-bulk-form').waitFor();
        assert.deepEqual(await page.locator('.fpt-bulk-step > h3').allTextContents(), [
            '1. Выберите лоты', '2. Что изменить', '3. Проверьте изменения'
        ]);
        const activate = page.locator('[data-activate-selected]');
        assert.equal(await activate.evaluate(button => button.closest('.fpt-bulk-lot-tools') !== null), true);
        assert.equal(await page.locator('.fpt-lot-dialog-footer .fpt-bulk-activate').count(), 0);
        assert.equal(await activate.isDisabled(), true);

        const filter = page.locator('.fpt-bulk-lot-filter');
        await filter.fill('нет такого лота');
        assert.equal(await page.locator('.fpt-bulk-filter-empty').isVisible(), true);
        await filter.fill('');

        await page.locator('.fpt-bulk-lot-check').first().check();
        assert.equal(await activate.isDisabled(), false);
        await page.locator('#fptBulkName').fill('VIP {current}');
        assert.match(await page.locator('.fpt-bulk-review-summary').textContent(), /Будет изменено 1 лот · название/);
        assert.equal(await page.locator('.fpt-bulk-preview-after').textContent(), 'После: VIP Аккаунт Premium');

        await page.locator('#fptBulkFind').fill('[');
        await page.locator('#fptBulkRegex').check();
        assert.equal(await page.locator('.fpt-bulk-validation-error').isVisible(), true);
        assert.equal(await page.locator('.fpt-bulk-apply').isDisabled(), true);
        await page.locator('#fptBulkRegex').uncheck();
        await page.locator('#fptBulkFind').fill('');

        await activate.click();
        await page.waitForFunction(() => window.qaLotActions.some(action => action.actionId === 'fp-bulk-activate-btn'));
    } finally {
        await browser.close();
    }
});

test('bulk editor selects by category, previews Cyrillic whole-word replacement and offers a retry for failed lots', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        await page.evaluate(() => {
            window.qaBulkLots.push({ offerId: '503', nodeId: '42', title: 'Аккаунт Premium котик', categoryName: 'Аккаунты', price: '70' });
            window.qaFailOffer = '503';
        });
        await page.locator('#fp-bulk-edit-btn').click();
        await page.locator('.fpt-bulk-form').waitFor();
        const accounts = page.locator('.fpt-bulk-category-chip[data-category="Аккаунты"]');
        assert.match(await accounts.textContent(), /Аккаунты\s*2/);
        await accounts.click();
        assert.equal(await accounts.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-lot-selected]').textContent(), '2');

        await page.locator('#fptBulkFind').fill('premium');
        await page.locator('#fptBulkReplace').fill('VIP');
        await page.locator('#fptBulkWholeWord').check();
        assert.deepEqual(await page.locator('.fpt-bulk-preview-after').allTextContents(), ['После: Аккаунт VIP', 'После: Аккаунт VIP котик']);
        await page.locator('#fptBulkFind').fill('кот');
        assert.deepEqual(await page.locator('.fpt-bulk-preview-item').evaluateAll(items => items.map(item => item.dataset.changed)), ['false', 'false'],
            'whole-word search must not match «кот» inside «котик»');
        await page.locator('#fptBulkFind').fill('premium');

        await page.locator('#fptBulkPriceMode').selectOption('pct_up');
        await page.locator('#fptBulkPriceValue').fill('10');
        assert.equal(await page.locator('.fpt-bulk-price-unit').textContent(), '%');
        assert.match(await page.locator('.fpt-bulk-price-hint').textContent(), /1\s000 ₽ → 1\s100 ₽/);

        await page.locator('.fpt-bulk-apply').click();
        await page.locator('.fpt-bulk-retry').waitFor();
        const payload = await page.evaluate(() => window.qaLastBulkPayload);
        assert.deepEqual(payload.changes.findReplace.wholeWord, true);
        assert.deepEqual(payload.changes.price, { mode: 'pct_up', value: 10 });
        assert.equal(await page.locator('.fpt-bulk-lot-row[data-result="success"] .fpt-bulk-lot-name').textContent(), 'Аккаунт Premium ✓');
        assert.equal(await page.locator('.fpt-bulk-lot-row[data-result="error"] .fpt-bulk-lot-status').getAttribute('title'), 'FunPay отклонил сохранение.');
        assert.match(await page.locator('.fpt-bulk-log').textContent(), /Аккаунт Premium котик: FunPay отклонил сохранение\./);
        await page.locator('.fpt-bulk-retry').click();
        assert.equal(await page.locator('[data-lot-selected]').textContent(), '1');
        assert.equal(await page.locator('.fpt-bulk-lot-row[data-result="error"] .fpt-bulk-lot-check').isChecked(), true);

        await page.locator('.fpt-bulk-reset').click();
        assert.equal(await page.locator('#fptBulkFind').inputValue(), '');
        assert.equal(await page.locator('#fptBulkPriceMode').inputValue(), 'none');
        assert.equal(await page.locator('.fpt-bulk-apply').isDisabled(), true);
    } finally {
        await browser.close();
    }
});

test('export shows category and lot totals, disables empty export, and uses a visible progress indicator', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        let downloadCount = 0;
        page.on('download', () => { downloadCount += 1; });
        await page.evaluate(() => {
            window.qaExportCategories = [
                { id: 'games', name: 'Игры', lots: [{ id: '1' }, { id: '2' }] },
                { id: 'empty', name: 'Пустая категория', lots: [] }
            ];
        });
        await page.locator('#lot-io-export-btn').click();
        await page.locator('.fpt-lot-dialog').waitFor();
        const confirm = page.locator('.fpt-lot-dialog .fpt-lot-dialog-button--primary');
        assert.equal(await confirm.isDisabled(), true);
        assert.equal(await page.locator('.fpt-lot-category-empty').textContent(), 'Пустая');
        assert.equal(await page.locator('.fpt-lot-category-row input').nth(1).isDisabled(), true);
        await page.locator('.fpt-lot-category-row input').first().check();
        assert.equal(await confirm.isDisabled(), false);
        assert.equal(await page.locator('.fpt-lot-export-summary').textContent(), 'Выбрано 1 категория · 2 лота');
        assert.equal(await page.locator('.fpt-lot-export-progress').isHidden(), true);

        await page.evaluate(() => { window.qaHoldExport = true; });
        const pendingExport = confirm.click();
        await page.locator('.fpt-lot-dialog-stop').waitFor();
        assert.equal(await page.locator('.fpt-lot-export-progress').isVisible(), true);
        assert.equal(await page.locator('.fpt-lot-export-progress progress').evaluate(element => element.value), 1);
        await page.locator('.fpt-lot-dialog-stop').click();
        await pendingExport;
        await page.getByText('Экспорт остановлен. Файл не сохранён.').waitFor();
        assert.equal(await page.locator('.fpt-lot-dialog').count(), 1, 'an aborted export should return to its still-open dialog');
        assert.equal(await confirm.textContent(), 'Повторить экспорт');
        assert.equal(downloadCount, 0, 'stopping an export should not download a partial file');
        await page.locator('.fpt-lot-dialog-close').click();
        assert.equal(await page.locator('.fpt-lot-dialog').count(), 0);
    } finally {
        await browser.close();
    }
});

test('import error reason stays visible and a completion report retains errors and skipped lots', async () => {
    const { browser, page } = await createLotIoPage({
        pendingTask: {
            name: 'очень-длинное-имя-резервной-копии-категорий-2026-10-05.json', state: 'running', currentIndex: 0,
            lots: [{ title: 'Ошибка синхронизации', status: 'error', error: 'FunPay отклонил запрос: 503.' }, { status: 'pending' }]
        }
    });
    try {
        await page.locator('.fpt-lot-task-error').waitFor();
        assert.equal(await page.locator('.fpt-lot-task-error').textContent(), 'FunPay отклонил запрос: 503.');
        const fileName = page.locator('.fpt-lot-file-name');
        assert.ok((await fileName.textContent()).startsWith('очень-длинное-'));
        assert.ok((await fileName.textContent()).endsWith('2026-10-05.json'));
        assert.equal(await page.locator('.fpt-lot-file-name').getAttribute('title'), 'очень-длинное-имя-резервной-копии-категорий-2026-10-05.json');

        await page.evaluate(() => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: {
            finished: true,
            lots: [
                { title: 'Создан', status: 'success' },
                { title: 'Ошибка', status: 'error', error: 'Плохие данные.' },
                { title: 'Пропущен', status: 'skipped' }
            ]
        } })));
        await page.locator('.fpt-lot-import-report').waitFor();
        assert.match(await page.locator('.fpt-lot-import-report').textContent(), /Импорт завершён: 1 лот добавлен/);
        assert.match(await page.locator('.fpt-lot-import-report').textContent(), /Ошибок: 1 · пропущено: 1/);
        await page.locator('.fpt-lot-import-report summary').click();
        assert.match(await page.locator('.fpt-lot-import-report ul').textContent(), /Ошибка: Ошибка — Плохие данные\./);
        assert.match(await page.locator('.fpt-lot-import-report ul').textContent(), /Пропущен: Пропущен/);
    } finally {
        await browser.close();
    }
});

test('lot import actions use a supported icon glyph', async () => {
    const { browser, page } = await createLotIoPage({
        pendingTask: { name: 'backup.json', state: 'postponed', currentIndex: 0, lots: [{ status: 'pending' }] }
    });
    try {
        const glyph = await page.locator('.fpt-lot-task-menu-trigger .material-symbols-rounded').textContent();
        assert.equal(glyph, 'more_vert');
    } finally {
        await browser.close();
    }
});

test('an active import is announced and prevents starting a second import', async () => {
    const { browser, page } = await createLotIoPage({
        pendingTask: {
            name: 'active-backup.json', state: 'running', currentIndex: 2,
            lots: [{ status: 'success' }, { status: 'success' }, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }]
        }
    });
    try {
        assert.equal(await page.locator('#lot-io-import-btn').isDisabled(), true);
        assert.match(await page.locator('.fpt-lot-import-status').textContent(), /Выполняется · 2 из 5/);
        const statusHeight = (await page.locator('.fpt-lot-import-status').boundingBox()).height;
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', {
            detail: { finished: true, lots: [] }
        })));
        await page.waitForFunction(() => document.querySelector('.fpt-lot-import-status').textContent === '');
        assert.equal((await page.locator('.fpt-lot-import-status').boundingBox()).height, statusHeight,
            'finishing an import retains the reserved status space');
    } finally {
        await browser.close();
    }
});

test('primary dialog buttons keep readable contrast while hovered', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        await page.evaluate(() => {
            const primary = document.createElement('button');
            primary.className = 'fpt-lot-dialog-button fpt-lot-dialog-button--primary';
            primary.textContent = 'Применить изменения';
            document.querySelector('.fpt-lot-io').appendChild(primary);
        });
        const primary = page.locator('.fpt-lot-dialog-button--primary');
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const { root: documentNode } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', {
            nodeId: documentNode.nodeId,
            selector: '.fpt-lot-dialog-button--primary'
        });
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
        const contrast = await primary.evaluate(button => {
            const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
                const normalized = channel / 255;
                return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            const luminance = color => {
                const [red, green, blue] = rgb(color);
                return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
            };
            const style = getComputedStyle(button);
            const background = luminance(style.backgroundColor);
            const foreground = luminance(style.color);
            return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        });
        assert.ok(contrast >= 4.5, `primary button hover contrast was ${contrast.toFixed(2)}:1`);
    } finally {
        await browser.close();
    }
});

test('shared popup utilities format russian plurals and create accessible status pills', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        const result = await page.evaluate(() => {
            const pill = window.FPTPopupUI.statusPill('success', 'Сохранено');
            return {
                plurals: [1, 2, 5, 21, 11].map(count => window.FPTPopupUI.pluralize(count, ['лот', 'лота', 'лотов'])),
                className: pill.className,
                kind: pill.dataset.kind,
                role: pill.getAttribute('role'),
                text: pill.textContent
            };
        });
        assert.deepEqual(result.plurals, ['лот', 'лота', 'лотов', 'лот', 'лотов']);
        assert.equal(result.className, 'fpt-status-pill');
        assert.equal(result.kind, 'success');
        assert.equal(result.role, 'status');
        assert.equal(result.text, 'Сохранено');
    } finally {
        await browser.close();
    }
});

test('shared dialog traps and restores focus and blocks close paths while busy', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        await page.evaluate(() => {
            const returnFocus = document.createElement('button');
            returnFocus.id = 'return-focus';
            document.body.appendChild(returnFocus);
            returnFocus.focus();

            const popup = document.querySelector('.fp-tools-popup');
            const dialog = window.FPTPopupUI.createDialog(popup, 'Тестовый диалог');
            const input = document.createElement('input');
            input.id = 'dialog-input';
            const cancel = document.createElement('button');
            cancel.id = 'dialog-cancel';
            cancel.textContent = 'Отмена';
            dialog.body.appendChild(input);
            dialog.footer.appendChild(cancel);
            dialog.focusInitial();
            window.qaDialog = dialog;
        });
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dialog-input');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.closest('[role="dialog"]') !== null), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.closest('[role="dialog"]') !== null), true);

        await page.evaluate(() => {
            window.qaStopped = false;
            window.qaDialog.setBusy(true, { onStop: () => { window.qaStopped = true; } });
        });
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
            const backdrop = window.qaDialog.backdrop;
            backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            window.qaDialog.dialog.querySelector('.fpt-lot-dialog-close').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            window.qaDialogCloseBlocked = window.qaDialog.close() === false;
        });
        assert.equal(await page.locator('.fpt-lot-dialog').count(), 1);
        assert.equal(await page.evaluate(() => window.qaDialogCloseBlocked), true);
        await page.locator('[data-fpt-dialog-stop]').click();
        assert.equal(await page.evaluate(() => window.qaStopped), true);
        await page.evaluate(() => {
            window.qaDialog.setBusy(false);
            window.qaDialog.close();
        });
        assert.equal(await page.evaluate(() => document.activeElement.id), 'return-focus');
    } finally {
        await browser.close();
    }
});

test('shared toast queue pauses on hover and stays inside an open dialog', async () => {
    const { browser, page } = await createLotIoPage();
    try {
        await page.evaluate(() => {
            const dialog = window.FPTPopupUI.createDialog(document.querySelector('.fp-tools-popup'), 'Тосты');
            dialog.footer.appendChild(document.createElement('button'));
            window.FPTPopupUI.showToast(document.querySelector('.fp-tools-popup'), 'Первое сообщение', 'success', { durationMs: 30 });
            window.FPTPopupUI.showToast(document.querySelector('.fp-tools-popup'), 'Второе сообщение', 'warning', { durationMs: 30 });
        });
        const toast = page.locator('.fpt-popup-toast-text');
        await toast.waitFor();
        assert.equal(await toast.textContent(), 'Первое сообщение');
        assert.equal(await toast.evaluate(element => Boolean(element.closest('.fp-tools-popup'))), false);
        await toast.dispatchEvent('mouseenter');
        await page.waitForTimeout(50);
        assert.equal(await toast.textContent(), 'Первое сообщение');
        await toast.dispatchEvent('mouseleave');
        await page.getByText('Второе сообщение').waitFor({ timeout: 500 });
    } finally {
        await browser.close();
    }
});
