const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;
const CURSOR_PNG = path.join(root, 'icons/nav-analytics-expanded.png');

async function openEffectsPage(browser, { dark = false, viewport = { width: 1204, height: 789 }, seed = {} } = {}) {
    const page = await browser.newPage({ viewport });
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
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>`);
    await page.evaluate(initial => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { fpToolsNavCollapsed: false, ...initial };
        window.qaState = state;
        window.qaFailSave = false;
        const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = structuredClone(get(keys)); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) {
                    if (window.qaFailSave) return Promise.reject(new Error('Тестовая ошибка сохранения.'));
                    Object.assign(state, structuredClone(patch)); callback?.(); return Promise.resolve();
                },
                remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) { const result = { success: true, ok: true, data: [] }; callback?.(result); return Promise.resolve(result); },
                onMessage: { addListener() {} }
            }
        };
    }, seed);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
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
    await page.evaluate(() => window.fptOpenPopupPage('effects'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'effects');
    await page.locator('.fpt-fx .fpt-fx-preview').waitFor();
    return { page, errors };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // The popup itself animates its size after a viewport change, so wait for every finite animation.
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
});
const setInput = (page, selector, value) => page.evaluate(([target, next]) => {
    const input = document.querySelector(target);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}, [selector, value]);
const fx = page => page.evaluate(() => window.qaState.fpToolsCursorFx);
const cursor = page => page.evaluate(() => window.qaState.fpToolsCustomCursor);
const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

test('effects page: preview draws, particle settings save at once and reset', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openEffectsPage(browser, {
            seed: { fpToolsCursorFx: { enabled: false, type: 'sparkle', color1: '#FF6B6B', color2: '#1b75bb', rgb: false, count: 50 } }
        });
        const [fxCard, cursorCard] = await page.locator('.fpt-fx-card').all();

        assert.equal(await fxCard.getAttribute('data-state'), 'off');
        assert.equal((await fxCard.locator('.fpt-fx-pill').textContent()).trim(), 'Выключено');
        assert.deepEqual(await page.locator('.fpt-fx-badge').allTextContents(), ['Частицы выключены', 'Обычный курсор']);
        assert.equal(await page.locator('.fpt-fx-type[aria-checked="true"]').getAttribute('data-type'), 'sparkle');
        assert.equal(await page.locator('#fpt-fx-count').inputValue(), '50');

        // The preview demo draws particles even before the effect is switched on.
        await page.waitForFunction(() => {
            const canvas = document.querySelector('.fpt-fx-stage-canvas');
            const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
            return false;
        });
        await page.locator('.fpt-fx-stage').hover();
        assert.equal(await page.locator('.fpt-fx-stage').getAttribute('data-pointer'), 'inside');
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'effects-light.png') }); }

        // Master switch writes the full settings object.
        await fxCard.locator('.fpt-fx-master-switch .fpt-ad-switch').evaluate(input => input.click());
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.enabled === true);
        assert.deepEqual(await fx(page), { enabled: true, type: 'sparkle', color1: '#ff6b6b', color2: '#1b75bb', rgb: false, count: 50 });
        assert.equal(await fxCard.getAttribute('data-state'), 'on');
        assert.match(await page.locator('.fpt-fx-badge').first().textContent(), /Частицы: искры/);

        // Type tiles behave as a radio group, including arrow keys.
        await page.locator('.fpt-fx-type[data-type="snow"]').click();
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.type === 'snow');
        assert.equal(await page.locator('.fpt-fx-note').first().isVisible(), true, 'snow explains that it is always white');
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.type === 'blood');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.type), 'blood');
        assert.equal(await page.locator('.fpt-fx-note').first().isHidden(), true);

        // Colours, rainbow and intensity.
        await setInput(page, '.fpt-fx-swatch-input', '#22CC88');
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.color1 === '#22cc88');
        assert.equal(await page.locator('.fpt-fx-swatch-hex').first().textContent(), '#22CC88');
        await page.locator('.fpt-fx-switch-row .fpt-ad-switch').first().evaluate(input => input.click());
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.rgb === true);
        assert.equal(await page.locator('.fpt-fx-colors').getAttribute('data-muted'), 'true');
        await setInput(page, '#fpt-fx-count', 80);
        assert.equal(await page.locator('.fpt-fx-slider-value').first().textContent(), '80%');
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.count === 80);

        // A failed save rolls the control back and reports the error.
        await page.evaluate(() => { window.qaFailSave = true; });
        await page.locator('.fpt-fx-switch-row .fpt-ad-switch').first().evaluate(input => input.click());
        await page.locator('.fpt-popup-toast[data-kind="error"]').waitFor();
        assert.equal(await page.locator('.fpt-fx-switch-row .fpt-ad-switch').first().isChecked(), true, 'the rainbow switch rolls back');
        await page.evaluate(() => { window.qaFailSave = false; });

        // Reset goes through the existing popup action.
        await page.locator('#resetCursorFxBtn').click();
        await page.waitForFunction(() => window.qaState.fpToolsCursorFx.count === 50 && window.qaState.fpToolsCursorFx.enabled === false);
        await page.waitForFunction(() => document.querySelector('.fpt-fx-card').dataset.state === 'off');
        assert.equal(await page.locator('.fpt-fx-type[aria-checked="true"]').getAttribute('data-type'), 'sparkle');
        assert.equal(await page.locator('#fpt-fx-count').inputValue(), '50');
        assert.equal(await cursorCard.getAttribute('data-state'), 'off');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('effects page: custom cursor uploads, adjusts, validates and removes the image', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openEffectsPage(browser);
        const cursorCard = page.locator('.fpt-fx-card').nth(1);
        assert.equal(await page.locator('#removeCursorImageBtn').isDisabled(), true);

        // Turning the cursor on without an image asks for one.
        const chooser = page.waitForEvent('filechooser');
        await cursorCard.locator('.fpt-fx-master-switch .fpt-ad-switch').evaluate(input => input.click());
        await page.waitForFunction(() => window.qaState.fpToolsCustomCursor?.enabled === true);
        assert.equal((await cursorCard.locator('.fpt-fx-pill').textContent()).trim(), 'Нет картинки');
        assert.equal(await page.locator('.fpt-fx-note--warning').isVisible(), true);
        await (await chooser).setFiles(CURSOR_PNG);
        await page.waitForFunction(() => /^data:image\/png/.test(window.qaState.fpToolsCustomCursor?.image || ''));
        const saved = await cursor(page);
        assert.deepEqual({ ...saved, image: 'png' }, { enabled: true, image: 'png', hideSystem: true, size: 32, opacity: 100 });
        await page.waitForFunction(() => document.querySelectorAll('.fpt-fx-card')[1].dataset.state === 'on');
        assert.equal(await page.locator('.fpt-fx-note--warning').isHidden(), true);
        assert.equal((await page.locator('#uploadCursorImageBtn').textContent()).trim().endsWith('Заменить'), true);
        assert.equal(await page.locator('#removeCursorImageBtn').isDisabled(), false);

        // Sliders and the system cursor switch.
        await setInput(page, '#fpt-fx-cursor-size', 64);
        await setInput(page, '#fpt-fx-cursor-opacity', 70);
        await page.waitForFunction(() => window.qaState.fpToolsCustomCursor.size === 64 && window.qaState.fpToolsCustomCursor.opacity === 70);
        await cursorCard.locator('.fpt-fx-switch-row .fpt-ad-switch').evaluate(input => input.click());
        await page.waitForFunction(() => window.qaState.fpToolsCustomCursor.hideSystem === false);

        // The preview ghost shows the uploaded image at the chosen size.
        await page.mouse.move(0, 0);
        await page.waitForFunction(() => {
            const ghost = document.querySelector('.fpt-fx-stage-cursor');
            return ghost.dataset.kind === 'image' && ghost.style.width === '64px' && !ghost.hidden;
        });
        if (shotDir) { await settle(page); await cursorCard.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, 'effects-cursor.png') }); }

        // Files that are too large are rejected without touching the saved image.
        const before = (await cursor(page)).image;
        await page.locator('.fpt-fx-drop input[type="file"]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
        await page.waitForFunction(() => /больше 2 МБ/.test(document.querySelector('.fpt-popup-toast[data-kind="error"]')?.textContent || ''));
        assert.equal((await cursor(page)).image, before);

        await page.locator('#removeCursorImageBtn').click();
        await page.waitForFunction(() => window.qaState.fpToolsCustomCursor.image === null);
        await page.waitForFunction(() => document.querySelectorAll('.fpt-fx-card')[1].dataset.state === 'off');
        assert.equal(await page.locator('.fpt-fx-note--warning').isVisible(), true);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('effects page: dark popup and narrow widths stay inside the frame', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openEffectsPage(browser, {
            dark: true,
            seed: { fpToolsCursorFx: { enabled: true, type: 'trail', color1: '#7c6cff', color2: '#4fc3f7', rgb: false, count: 70 } }
        });
        await settle(page);
        if (shotDir) {
            await page.screenshot({ path: path.join(shotDir, 'effects-dark.png') });
            await page.locator('.fpt-fx-card').first().screenshot({ path: path.join(shotDir, 'effects-dark-particles.png') });
        }
        for (const width of [860, 560]) {
            await page.setViewportSize({ width, height: 800 });
            await settle(page);
            if (shotDir) await page.screenshot({ path: path.join(shotDir, `effects-dark-${width}.png`) });
            const overflow = await page.evaluate(() => {
                const view = document.querySelector('.fpt-fx');
                const limit = view.getBoundingClientRect().right + 1;
                const wide = Array.from(view.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > limit)
                    .slice(0, 5).map(el => `${el.className} ${Math.round(el.getBoundingClientRect().right - limit)}`);
                return { ok: view.scrollWidth <= view.clientWidth + 1, sw: view.scrollWidth, cw: view.clientWidth, wide };
            });
            assert.equal(overflow.ok, true, `the screen must not overflow horizontally at ${width}px: ${JSON.stringify(overflow)}`);
        }
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
