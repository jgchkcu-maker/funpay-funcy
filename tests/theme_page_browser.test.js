const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.join(__dirname, '..');
const shots = process.env.FPT_SHOT_DIR || os.tmpdir();

const CATALOG = [
    { id: 'aurora', name: 'Аврора', author: 'Мира', file: 'aurora.fptheme', preview: 'aurora.jpg' },
    { id: 'graphite', name: 'Графит', desc: 'Тёмная и строгая', file: 'graphite.fptheme', preview: 'graphite.jpg' }
];
const GRAPHITE = {
    bgColor1: '#3b82f6', bgColor2: '#9bd0ff', containerBgColor: '#14161c', containerBgOpacity: 0.82,
    textColor: '#e8edf5', linkColor: '#7db4ff', font: 'Montserrat', bgBlur: 4, bgBrightness: 80, borderRadius: 14,
    enableGlassmorphism: true, glassmorphismBlur: 14, headerPosition: 'bottom', unknownKey: 'must be dropped'
};

async function openThemePage(browser, { dark = false, viewport = { width: 1440, height: 1000 }, initial = {}, scale = 1 } = {}) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
            const file = path.join(root, pathname);
            if (fs.existsSync(file)) return route.fulfill({ path: file });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>`);
    await page.evaluate(({ catalog, graphite, seed }) => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const store = { fpToolsNavCollapsed: false, ...seed };
        window.qaStore = store; window.qaWrites = [];
        const get = keys => keys == null ? { ...store } : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys]).map(k => [k, store[k]]));
        window.chrome = { storage: { local: {
            get(keys, cb) { const value = get(keys); cb?.(value); return Promise.resolve(value); },
            set(values, cb) { window.qaWrites.push(structuredClone(values)); Object.assign(store, values); cb?.(); return Promise.resolve(); },
            remove(keys, cb) { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete store[k]); cb?.(); return Promise.resolve(); }
        }, onChanged: { addListener() {} } }, runtime: {
            getURL: p => 'https://funpay.com/' + p, getManifest: () => ({ version: 'test' }), id: 'qa',
            sendMessage(message, cb) { const result = { success: true, data: [], ok: true }; cb?.(result); return Promise.resolve(result); },
            onMessage: { addListener() {} }
        } };
        window.fetch = async url => {
            const href = String(url);
            if (href.endsWith('/index.json')) return { ok: true, json: async () => catalog };
            if (href.endsWith('.fptheme')) return { ok: true, json: async () => graphite };
            return { ok: true, json: async () => ({}), text: async () => '' };
        };
    }, { catalog: CATALOG, graphite: GRAPHITE, seed: initial });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const content = manifest.content_scripts.find(s => s.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    // Theme button colours load at document_start in the extension; the page shares that world.
    await page.addScriptTag({ path: path.join(root, 'content/theme_buttons.js') });
    for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(root, js) });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    await page.locator('#fpToolsButton').click();
    await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
    if (dark) {
        await page.evaluate(() => {
            window.fptComputePalette = () => ({ dark: true });
            fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
        });
    }
    await page.evaluate(() => window.fptOpenPopupPage('theme'));
    await page.waitForSelector('.fp-tools-page-content[data-page="theme"].active .fpt-th[data-ready="true"]');
    await page.waitForFunction(() => document.querySelectorAll('.fpt-th-preset[data-preset-id^="catalog:"]').length > 0);
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.getAnimations().every(a => a.playState === 'finished'));
    return { page, errors };
}

const setRange = (page, id, value) => page.evaluate(([key, next]) => {
    const input = document.getElementById(key);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, value]);
const setColor = (page, index, value) => page.evaluate(([i, next]) => {
    const input = document.querySelectorAll('.fpt-th-swatches .fpt-th-swatch-input')[i];
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}, [index, value]);
const nextFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
// Headless Chrome hides scrollbars by default, which would also hide the preview's custom scrollbar.
const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });

test('real browser: theme page builds every section from stored settings and keeps the dock closed', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { bgColor1: '#7663f6', borderRadius: 16 } } });
        const summary = await page.evaluate(() => ({
            cards: [...document.querySelectorAll('.fpt-th-card .fpt-th-card-title')].map(el => el.textContent),
            swatches: document.querySelectorAll('.fpt-th-swatches .fpt-th-swatch').length,
            sliders: document.querySelectorAll('.fpt-th-range').length,
            presets: [...document.querySelectorAll('.fpt-th-preset-name')].map(el => el.textContent),
            masterOn: document.querySelector('.fpt-th-hero .fpt-th-switch').checked,
            heroState: document.querySelector('.fpt-th-hero').dataset.state,
            dock: { open: document.querySelector('.fpt-th-dock').dataset.open, inert: document.querySelector('.fpt-th-dock').inert },
            radius: document.getElementById('fpt-th-borderRadius').value,
            primary: document.querySelectorAll('.fpt-th-swatches .fpt-th-swatch-input')[0].value,
            stagePrimary: document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-primary'),
            stageRadius: document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-radius'),
            emptyContainers: [...document.querySelectorAll('.fp-tools-page-content')].filter(el => !el.children.length).length
        }));
        assert.deepEqual(summary.cards, ['Готовые темы', 'Фон', 'Цвета', 'Кнопки', 'Шрифт и форма', 'Блоки', 'Детали', 'Инструменты']);
        assert.equal(summary.swatches, 5);
        assert.equal(summary.sliders, 9);
        assert.deepEqual(summary.presets, ['Оригинальная', 'Чёрная', 'Случайная', 'Аврора', 'Графит']);
        assert.equal(summary.masterOn, true);
        assert.equal(summary.heroState, 'on');
        assert.deepEqual(summary.dock, { open: 'false', inert: true });
        assert.equal(summary.radius, '16');
        assert.equal(summary.primary, '#7663f6');
        assert.equal(summary.stagePrimary, '#7663f6');
        assert.equal(summary.stageRadius, '16px');
        await nextFrames(page);
        const help = page.locator('.fp-tools-page-content[data-page="theme"] .fpt-category-help');
        await help.click();
        assert.equal(await page.locator('.fpt-th-help').isVisible(), true, 'the help button opens the explanation');
        assert.equal(await help.getAttribute('aria-expanded'), 'true');
        await help.click();
        assert.equal(await page.locator('.fpt-th-help').isVisible(), false);
        await page.screenshot({ path: path.join(shots, 'fpt-theme-light-top.png') });
        await page.locator('.fp-tools-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.screenshot({ path: path.join(shots, 'fpt-theme-light-bottom.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: buttons card follows the theme in auto mode and takes an explicit colour', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom', bgColor1: '#8b5cf6', containerBgColor: '#1a1033' } } });
        const card = page.locator('.fpt-th-card', { has: page.locator('.fpt-th-card-title', { hasText: 'Кнопки' }) });
        await card.scrollIntoViewIfNeeded();
        const read = () => page.evaluate(() => {
            const stage = document.querySelector('.fpt-th-stage').style;
            return {
                auto: [...document.querySelectorAll('.fpt-th-btn-swatch')].map(el => el.dataset.auto),
                hex: [...document.querySelectorAll('.fpt-th-btn-swatch .fpt-th-swatch-hex')].map(el => el.textContent),
                btn: stage.getPropertyValue('--fpt-th-btn'),
                active: stage.getPropertyValue('--fpt-th-btn-active'),
                chatButtons: document.querySelectorAll('.fpt-th-site-chatbar .fpt-th-site-btn').length
            };
        });
        const auto = await read();
        assert.deepEqual(auto.auto, ['true', 'true'], 'themes without button colours start in auto mode');
        assert.match(auto.hex[0], /^Авто · #[0-9A-F]{6}$/);
        assert.equal(auto.active, '#8b5cf6', 'auto active buttons use the main colour of the theme');
        assert.equal(auto.chatButtons, 3, 'the preview shows search, notifications and the menu button');
        if (shots) await card.screenshot({ path: path.join(shots, 'fpt-theme-buttons-auto.png') });

        await card.locator('.fpt-th-btn-swatch').first().locator('.fpt-th-swatch-input').evaluate(input => {
            input.value = '#14532d';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await nextFrames(page);
        const custom = await read();
        assert.deepEqual(custom.auto, ['false', 'true']);
        assert.equal(custom.btn, '#14532d');
        await card.locator('.fpt-th-btn-auto input').first().click();
        await nextFrames(page);
        assert.deepEqual((await read()).auto, ['true', 'true'], 'switching auto back clears the explicit colour');
        if (shots) await page.locator('.fpt-th-stage').screenshot({ path: path.join(shots, 'fpt-theme-buttons-stage.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: edits stay in the draft until Apply, Cancel restores, Apply enables a disabled theme', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { fpToolsTheme: { baseStyle: 'custom' } } });
        await setRange(page, 'fpt-th-borderRadius', 22);
        await setColor(page, 0, '#2255ee');
        await nextFrames(page);
        let state = await page.evaluate(() => ({
            dock: document.querySelector('.fpt-th-dock').dataset.open, inert: document.querySelector('.fpt-th-dock').inert,
            pill: document.querySelector('.fpt-th-hero .fpt-th-pill').textContent,
            badge: document.querySelector('.fpt-th-preview-head .fpt-th-pill').textContent,
            label: document.querySelector('.fpt-th-apply .fpt-th-button-label').textContent,
            stageRadius: document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-radius'),
            chip: document.querySelector('#fpt-th-borderRadius').closest('.fpt-th-slider').querySelector('output').textContent,
            writes: window.qaWrites.filter(w => 'fpToolsTheme' in w || 'enableCustomTheme' in w).length
        }));
        assert.equal(state.dock, 'true');
        assert.equal(state.inert, false);
        assert.equal(state.pill, 'Есть неприменённые изменения');
        assert.equal(state.badge, 'Черновик');
        assert.equal(state.label, 'Применить и включить');
        assert.equal(state.stageRadius, '22px');
        assert.equal(state.chip, '22 px');
        assert.equal(state.writes, 0, 'moving controls must not touch storage');
        await page.screenshot({ path: path.join(shots, 'fpt-theme-dirty.png') });

        await page.locator('.fpt-th-dock .fpt-th-button', { hasText: 'Отменить' }).click();
        await nextFrames(page);
        state = await page.evaluate(() => ({ dock: document.querySelector('.fpt-th-dock').dataset.open, radius: document.getElementById('fpt-th-borderRadius').value, writes: window.qaWrites.filter(w => 'fpToolsTheme' in w || 'enableCustomTheme' in w).length }));
        assert.deepEqual(state, { dock: 'false', radius: '8', writes: 0 });

        await setRange(page, 'fpt-th-borderRadius', 18);
        await page.locator('.fpt-th-apply').click();
        await page.waitForFunction(() => document.querySelector('.fpt-th-dock').dataset.open === 'false');
        const saved = await page.evaluate(() => ({ writes: window.qaWrites, store: window.qaStore, state: document.querySelector('.fpt-th-hero').dataset.state, master: document.querySelector('.fpt-th-hero .fpt-th-switch').checked }));
        assert.equal(saved.store.fpToolsTheme.borderRadius, 18);
        assert.equal(saved.store.enableCustomTheme, true, 'applying a disabled theme turns it on');
        assert.equal(saved.state, 'on');
        assert.equal(saved.master, true);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: gallery theme, random and dark presets load into the draft only', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom' } } });
        await page.locator('.fpt-th-preset', { hasText: 'Графит' }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-th-preset[data-preset-id="catalog:graphite"]').getAttribute('aria-pressed') === 'true');
        let state = await page.evaluate(() => ({
            font: document.getElementById('fpt-th-font').value, radius: document.getElementById('fpt-th-borderRadius').value,
            position: document.querySelector('.fpt-th-seg').dataset.index, glass: document.querySelector('.fpt-th-stage').dataset.glass,
            header: document.querySelector('.fpt-th-stage').dataset.header, dock: document.querySelector('.fpt-th-dock').dataset.open,
            fontLabel: document.querySelector('.fpt-th-select-host .fpt-select-value').textContent, writes: window.qaWrites.filter(w => 'fpToolsTheme' in w || 'enableCustomTheme' in w).length,
            glassRow: document.querySelector('.fpt-th-detail[data-open="true"] h3')?.textContent
        }));
        assert.deepEqual(state, { font: 'Montserrat', radius: '14', position: '1', glass: 'on', header: 'bottom', dock: 'true', fontLabel: 'Montserrat', writes: 0, glassRow: 'Эффект матового стекла' });
        await page.screenshot({ path: path.join(shots, 'fpt-theme-graphite.png') });

        await page.locator('.fpt-th-preset', { hasText: 'Случайная' }).click();
        await nextFrames(page);
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-preset[aria-pressed="true"]')?.dataset.presetId ?? null), null);
        await page.locator('.fpt-th-preset', { hasText: 'Чёрная' }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-th-preset[data-preset-id="builtin:dark"]').getAttribute('aria-pressed') === 'true');
        state = await page.evaluate(() => ({ primary: document.querySelectorAll('.fpt-th-swatch-input')[0].value, writes: window.qaWrites.filter(w => 'fpToolsTheme' in w || 'enableCustomTheme' in w).length, custom: document.querySelector('.fpt-th-bg-drop').dataset.custom }));
        assert.equal(state.writes, 0);
        assert.equal(state.custom, 'true');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: reset, export and share use page dialogs instead of native prompts', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { borderRadius: 24, bgColor1: '#119977' } } });
        page.on('dialog', dialog => { throw new Error(`native dialog opened: ${dialog.message()}`); });
        await page.locator('.fpt-th-button', { hasText: 'Сбросить тему' }).click();
        await page.waitForSelector('.fpt-lot-dialog[role="dialog"]');
        assert.match(await page.locator('.fpt-lot-dialog').innerText(), /Сбросить тему\?/);
        await page.screenshot({ path: path.join(shots, 'fpt-theme-reset-dialog.png') });
        await page.locator('.fpt-lot-dialog-button', { hasText: 'Отмена' }).click();
        assert.equal(await page.evaluate(() => document.getElementById('fpt-th-borderRadius').value), '24');
        await page.locator('.fpt-th-button', { hasText: 'Сбросить тему' }).click();
        await page.locator('.fpt-lot-dialog-button--danger', { hasText: 'Сбросить' }).click();
        await page.waitForFunction(() => !document.querySelector('.fpt-lot-dialog'));
        const afterReset = await page.evaluate(() => ({ radius: document.getElementById('fpt-th-borderRadius').value, stored: window.qaStore.fpToolsTheme ?? null, enabled: window.qaStore.enableCustomTheme }));
        assert.deepEqual(afterReset, { radius: '8', stored: null, enabled: true });
        const original = await page.evaluate(() => ({
            pressed: document.querySelector('.fpt-th-preset[aria-pressed="true"]')?.dataset.presetId,
            locked: [...document.querySelectorAll('.fpt-th-card[data-locked="true"]')].length,
            base: document.querySelector('.fpt-th-stage').dataset.base
        }));
        assert.deepEqual(original, { pressed: 'builtin:original', locked: 3, base: 'original' }, 'reset lands on the original FunPay look');

        await page.locator('.fpt-th-button', { hasText: 'Экспорт' }).click();
        await page.waitForSelector('#fpt-th-export-name');
        const download = page.waitForEvent('download');
        await page.fill('#fpt-th-export-name', 'Тёплый закат!');
        await page.locator('.fpt-lot-dialog-button--primary', { hasText: 'Скачать файл' }).click();
        assert.equal((await download).suggestedFilename(), 'Тёплый_закат.fptheme');
        assert.equal(await page.evaluate(() => document.querySelector('.fp-tools-popup').classList.contains('active')), true, 'exporting must not close the panel');

        await page.locator('.fpt-th-button', { hasText: 'Поделиться' }).click();
        const link = page.locator('.fpt-th-link-button');
        assert.equal(await link.getAttribute('href'), 'https://t.me/FunPayThemesBot');
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: swatches flag corrected colours and low contrast, previews follow every toggle', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom' } } });
        await setColor(page, 3, '#222222');
        await nextFrames(page);
        const readNote = index => page.evaluate(i => { const el = document.querySelectorAll('.fpt-th-swatches .fpt-th-swatch-note')[i]; return { hidden: el.hidden, kind: el.dataset.kind || null, text: el.textContent }; }, index);
        const dark = await readNote(3);
        assert.equal(dark.hidden, false);
        assert.equal(dark.kind, 'success', 'dark text is lifted by the site and stays readable on dark blocks');
        await setColor(page, 2, '#f5f5f5');
        await nextFrames(page);
        assert.equal((await readNote(3)).kind, 'danger', 'light blocks make the lifted text unreadable and the swatch says so');
        await setColor(page, 1, '#101010');
        await nextFrames(page);
        const corrected = await page.evaluate(() => { const el = document.querySelectorAll('.fpt-th-swatches .fpt-th-swatch-note')[1]; return { hidden: el.hidden, kind: el.dataset.kind, text: el.textContent }; });
        assert.deepEqual(corrected, { hidden: false, kind: 'warning', text: 'Подправлен' });

        const toggles = [['Свой скроллбар', 'scrollbar', 'on'], ['Мягкие разделители', 'separators', 'improved'], ['Эффект матового стекла', 'glass', 'on']];
        for (const [title, attr, expected] of toggles) {
            await page.locator('.fpt-th-detail', { hasText: title }).locator('.fpt-th-switch-control').click();
            await nextFrames(page);
            assert.equal(await page.evaluate(name => document.querySelector('.fpt-th-stage').dataset[name], attr), expected, title);
        }
        await page.locator('.fpt-th-detail', { hasText: 'Декоративные круги' }).locator('.fpt-th-detail-row .fpt-th-switch-control').click();
        await setRange(page, 'fpt-th-circleSize', 140);
        await nextFrames(page);
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-circle-scale')), '1.4');
        await page.locator('.fpt-th-seg-button', { hasText: 'Снизу' }).click();
        await nextFrames(page);
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-stage').dataset.header), 'bottom');
        await page.locator('.fp-tools-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(shots, 'fpt-theme-details-open.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: dark popup, narrow layouts and reduced motion keep the page inside its frame', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { dark: true, initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom' } } });
        await page.screenshot({ path: path.join(shots, 'fpt-theme-dark-top.png') });
        await setRange(page, 'fpt-th-bgBlur', 9);
        await nextFrames(page);
        for (const viewport of [{ width: 1100, height: 760 }, { width: 860, height: 700 }, { width: 560, height: 700 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(420);
            const geometry = await page.evaluate(() => {
                const view = document.querySelector('.fpt-th');
                const page = view.closest('.fp-tools-page-content');
                const wide = [...view.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > page.getBoundingClientRect().right + 1 && !el.closest('.fpt-th-strip') && !el.closest('.fpt-th-stage') && el.getClientRects().length);
                return { overflow: view.scrollWidth > view.clientWidth + 1, offenders: wide.slice(0, 5).map(el => el.className), columns: getComputedStyle(view.querySelector('.fpt-th-layout')).gridTemplateColumns.split(' ').length };
            });
            assert.equal(geometry.overflow, false, `${viewport.width}px horizontal overflow`);
            assert.deepEqual(geometry.offenders, [], `${viewport.width}px offenders`);
            if (viewport.width <= 860) assert.equal(geometry.columns, 1, 'single column when narrow');
            await page.screenshot({ path: path.join(shots, `fpt-theme-dark-${viewport.width}.png`) });
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const motion = await page.evaluate(() => getComputedStyle(document.querySelector('.fpt-th-dock')).transitionDuration);
        assert.match(motion, /^0\.00\d*s|1e-05s|0s/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: background upload, palette from image, size limit and theme import stay in the draft', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom' } } });
        const themeWrites = () => page.evaluate(() => window.qaWrites.filter(w => 'fpToolsTheme' in w || 'enableCustomTheme' in w).length);
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff3d71"/><stop offset=".5" stop-color="#3366ff"/><stop offset="1" stop-color="#00d68f"/></linearGradient></defs><rect width="200" height="120" fill="url(#g)"/></svg>';
        const input = page.locator('.fpt-th-bg-drop').locator('xpath=ancestor::section[contains(@class,"fpt-th-card")]').locator('input[type="file"]');
        assert.equal(await page.locator('.fpt-th-button', { hasText: 'Подобрать цвета по картинке' }).isDisabled(), true, 'palette needs an uploaded picture');

        await input.setInputFiles({ name: 'bg.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
        await page.waitForFunction(() => document.querySelector('.fpt-th-bg-drop').dataset.custom === 'true');
        assert.equal(await page.locator('.fpt-th-button', { hasText: 'Подобрать цвета по картинке' }).isDisabled(), false);
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-bg-image').startsWith('url("data:image/svg+xml')), true);
        const before = await page.evaluate(() => [...document.querySelectorAll('.fpt-th-swatch-input')].map(el => el.value));

        await page.locator('.fpt-th-button', { hasText: 'Подобрать цвета по картинке' }).click();
        await page.waitForFunction(old => [...document.querySelectorAll('.fpt-th-swatch-input')].map(el => el.value).join() !== old, before.join());
        assert.equal(await themeWrites(), 0, 'the palette is a draft until Apply');
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-dock').dataset.open), 'true');

        await input.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 16) });
        await page.waitForFunction(() => /слишком большой/.test(document.querySelector('.fpt-popup-toast')?.textContent || ''));
        assert.equal(await page.evaluate(() => document.querySelector('.fpt-th-stage').style.getPropertyValue('--fpt-th-bg-image').startsWith('url("data:image/svg+xml')), true, 'an oversized file leaves the current picture alone');

        await page.locator('.fpt-th-button', { hasText: 'Убрать' }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-th-bg-drop').dataset.custom === 'false');

        const importInput = page.locator('input[type="file"][accept*=".fptheme"]');
        await importInput.setInputFiles({ name: 'sunset.fptheme', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ bgColor1: '#c2410c', font: 'Lato', borderRadius: 4, headerPosition: 'bottom', stray: 1 })) });
        await page.waitForFunction(() => document.getElementById('fpt-th-font').value === 'Lato');
        assert.deepEqual(await page.evaluate(() => ({ radius: document.getElementById('fpt-th-borderRadius').value, header: document.querySelector('.fpt-th-stage').dataset.header })), { radius: '4', header: 'bottom' });
        await importInput.setInputFiles({ name: 'broken.fptheme', mimeType: 'application/json', buffer: Buffer.from('{not json') });
        await page.waitForFunction(() => /повреждён/.test(document.querySelector('.fpt-popup-toast')?.textContent || ''));
        assert.equal(await themeWrites(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: tools card has no stray backdrop or native file input, original look keeps shape settings', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom', borderRadius: 12 } } });
        await page.addStyleTag({ content: 'header { background: rgb(255, 0, 0) !important; }' });
        const probe = await page.evaluate(() => ({
            heads: [...document.querySelectorAll('.fpt-th-card-head')].map(el => el.tagName + ':' + getComputedStyle(el).backgroundColor),
            files: [...document.querySelectorAll('.fpt-th input[type="file"]')].map(el => getComputedStyle(el).display)
        }));
        probe.heads.forEach(head => assert.match(head, /^DIV:rgba\(0, 0, 0, 0\)$/));
        assert.deepEqual(probe.files, ['none', 'none']);

        await page.locator('.fpt-th-preset', { hasText: 'Оригинальная' }).click();
        await nextFrames(page);
        const locked = await page.evaluate(() => ({
            cards: [...document.querySelectorAll('.fpt-th-card[data-locked="true"] .fpt-th-card-title')].map(el => el.textContent),
            radiusInert: !!document.getElementById('fpt-th-borderRadius').closest('[inert]'),
            glassVisible: !!document.querySelector('.fpt-th-detail')
        }));
        assert.deepEqual(locked.cards, ['Фон', 'Цвета', 'Блоки']);
        assert.equal(locked.radiusInert, false, 'shape settings stay editable');
        await setRange(page, 'fpt-th-borderRadius', 20);
        await page.locator('.fpt-th-apply').click();
        await page.waitForFunction(() => document.querySelector('.fpt-th-dock').dataset.open === 'false');
        const stored = await page.evaluate(() => window.qaStore.fpToolsTheme);
        assert.equal(stored.baseStyle, 'original');
        assert.equal(stored.borderRadius, 20);
        assert.equal(stored.bgImage ?? null, null, 'no wallpaper in the original look');
        await page.screenshot({ path: path.join(shots, 'fpt-theme-original.png') });

        await page.locator('.fpt-th-preset', { hasText: 'Чёрная' }).click();
        await nextFrames(page);
        assert.equal(await page.evaluate(() => document.querySelectorAll('.fpt-th-card[data-locked="true"]').length), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('real browser: the site theme does not leak into the popup and turns it dark', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openThemePage(browser, { initial: { enableCustomTheme: true, fpToolsTheme: { baseStyle: 'custom', containerBgColor: '#0b0b0b' } } });
        await page.evaluate(() => applyCustomTheme());
        await page.waitForFunction(() => document.getElementById('fp-tools-custom-theme') && document.querySelector('.fp-tools-popup').style.getPropertyValue('--fptm-color-scheme') === 'dark', null, { timeout: 5000 });
        const probe = await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            const css = document.getElementById('fp-tools-custom-theme').textContent;
            const style = selector => getComputedStyle(popup.querySelector(selector));
            return {
                scheme: popup.style.getPropertyValue('--fptm-color-scheme'),
                headerBg: style('.fpt-category-header').backgroundColor,
                navShadow: style('.fp-tools-nav a').textShadow,
                guarded: /header:not\(:where\(\.fp-tools-popup, \.fp-tools-popup \*\)\)/.test(css),
                siteHeaderStillThemed: /header:not\(/.test(css) && /background: rgba\(0,0,0,0\.08\)/.test(css)
            };
        });
        assert.equal(probe.scheme, 'dark', 'the menu follows the dark theme even though the wallpaper is not an element background');
        assert.equal(probe.headerBg, 'rgba(0, 0, 0, 0)');
        assert.equal(probe.navShadow, 'none');
        assert.equal(probe.guarded, true);
        assert.equal(probe.siteHeaderStillThemed, true);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(shots, 'fpt-theme-leak-dark.png') });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
