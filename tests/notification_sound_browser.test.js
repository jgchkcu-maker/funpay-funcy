const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;

// A mono 16-bit sine sweep, long enough to trim.
function sineWav(seconds = 8, rate = 22050) {
    const samples = Math.round(seconds * rate);
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVE', 8);
    buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
        const t = i / rate;
        const envelope = 0.25 + 0.75 * Math.abs(Math.sin(Math.PI * t / 2));
        buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * (220 + 40 * t) * t) * envelope * 0x5fff), 44 + i * 2);
    }
    return buffer;
}

async function openSoundsPage(browser, { dark = false, viewport = { width: 1204, height: 789 }, seed = {} } = {}) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2|sounds\/[\w-]+\.mp3)$/.test(pathname)) {
            const asset = path.join(root, pathname);
            if (fs.existsSync(asset)) return route.fulfill({ path: asset });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main><audio class="loud"><source src="/audio/chat_loud.mp3" type="audio/mpeg"></audio></body></html>`);
    await page.evaluate(initial => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { fpToolsNavCollapsed: false, ...initial };
        const listeners = [];
        window.qaState = state;
        window.qaPreviews = [];
        const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
        const notify = changes => listeners.forEach(listener => listener(changes, 'local'));
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = structuredClone(get(keys)); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) {
                    const changes = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { oldValue: state[key], newValue: structuredClone(value) }]));
                    Object.assign(state, structuredClone(patch));
                    notify(changes); callback?.(); return Promise.resolve();
                },
                remove(keys, callback) {
                    const changes = {};
                    (Array.isArray(keys) ? keys : [keys]).forEach(key => { changes[key] = { oldValue: state[key] }; delete state[key]; });
                    notify(changes); callback?.(); return Promise.resolve();
                }
            }, onChanged: { addListener(listener) { listeners.push(listener); } } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) { const result = { success: true, ok: true, data: [] }; callback?.(result); return Promise.resolve(result); },
                onMessage: { addListener() {} }
            }
        };
    }, seed);

    const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')));
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
    await page.evaluate(() => window.fptOpenPopupPage('sounds'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'sounds');
    await page.locator('.fpt-ns .fpt-ns-trigger').waitFor();
    return { page, errors };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
    await new Promise(resolve => setTimeout(resolve, 420));
});
const setInput = (page, selector, value) => page.evaluate(([target, next]) => {
    const input = document.querySelector(target);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}, [selector, value]);
const launch = () => chromium.launch({
    executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
});
const visibleGroups = page => page.evaluate(() => [...document.querySelectorAll('.fpt-ns-group-label')].filter(node => !node.hidden).map(node => node.textContent));
const option = (page, id) => page.locator(`.fpt-ns-option[data-sound="${id}"]`);
// Picking a preset closes the list after a short pause; reopen only once it has closed.
async function openPicker(page) {
    await page.waitForFunction(() => document.querySelector('.fpt-ns-picker').dataset.open === 'false');
    await page.locator('.fpt-ns-trigger').click();
    await page.waitForFunction(() => document.querySelector('.fpt-ns-picker').dataset.open === 'true');
    await settle(page);
}

test('sounds page: the preset list slides out, saves the choice and swaps the site sound', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSoundsPage(browser, { seed: { notificationVolume: 0.8 } });
        const picker = page.locator('.fpt-ns-picker');
        assert.equal(await picker.getAttribute('data-open'), 'false');
        assert.equal((await page.locator('.fpt-ns-trigger-name').textContent()).trim(), 'Стандартный');
        assert.equal(await page.locator('.fpt-ns-collapse').evaluate(node => node.hasAttribute('inert')), true);
        assert.equal(await page.locator('.fpt-ns-collapse').evaluate(node => node.getBoundingClientRect().height), 0, 'the closed list takes no space');
        assert.equal(await page.locator('#notificationVolume').inputValue(), '80');
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'sounds-closed.png') }); }

        await openPicker(page);
        assert.equal(await picker.getAttribute('data-open'), 'true');
        assert.equal(await page.locator('.fpt-ns-trigger').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.fpt-ns-option:visible').count(), 6);
        assert.deepEqual(await visibleGroups(page), ['FunPay', 'Мессенджеры'], 'no Funcy presets, and "Своя" waits for a saved melody');
        assert.equal(await option(page, 'custom').isHidden(), true);
        assert.ok(await page.locator('.fpt-ns-collapse').evaluate(node => node.getBoundingClientRect().height) > 200);
        assert.equal(await option(page, 'default').locator('[role="radio"]').getAttribute('aria-checked'), 'true');
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'sounds-open.png') });

        await option(page, 'whatsapp').locator('[role="radio"]').click();
        await page.waitForFunction(() => window.qaState.notificationSound === 'whatsapp');
        await page.waitForFunction(() => document.querySelector('.fpt-ns-picker').dataset.open === 'false');
        assert.equal((await page.locator('.fpt-ns-trigger-name').textContent()).trim(), 'WhatsApp');
        await page.waitForFunction(() => document.querySelector('audio.loud').src.endsWith('/sounds/whatsapp.mp3'));
        assert.equal(await page.evaluate(() => document.querySelector('audio.loud').volume), 0.8);

        // Back to the FunPay sound and on to another preset: the player must still be found.
        await openPicker(page);
        await option(page, 'default').locator('[role="radio"]').click();
        await page.waitForFunction(() => document.querySelector('audio.loud').src === 'https://funpay.com/audio/chat_loud.mp3');
        await openPicker(page);
        await option(page, 'tg').locator('[role="radio"]').click();
        await page.waitForFunction(() => document.querySelector('audio.loud').src.endsWith('/sounds/telegram.mp3'));

        // Keyboard: arrows open the list and move between radios, Escape closes it.
        await page.locator('.fpt-ns-trigger').focus();
        await page.keyboard.press('ArrowDown');
        await settle(page);
        assert.equal(await page.evaluate(() => document.activeElement.closest('.fpt-ns-option')?.dataset.sound), 'tg');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.closest('.fpt-ns-option')?.dataset.sound), 'iphone');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.fpt-ns-picker').dataset.open === 'false');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'fptNsTrigger');

        // Preview turns the play button into an equalizer until the sound ends.
        await openPicker(page);
        await option(page, 'discord').locator('.fpt-ns-play').click();
        await page.waitForFunction(() => document.querySelector('.fpt-ns-option[data-sound="discord"] .fpt-ns-play').dataset.playing === 'true');
        await page.waitForFunction(() => document.querySelector('.fpt-ns-option[data-sound="discord"] .fpt-ns-play').dataset.playing === 'false', null, { timeout: 4000 });
        assert.equal(await page.evaluate(() => window.qaState.notificationSound), 'tg', 'previewing never changes the choice');

        // The test button keeps its width while it shows the stop state.
        const idleWidth = await page.locator('#previewNotificationBtn').evaluate(node => node.getBoundingClientRect().width);
        await page.locator('#previewNotificationBtn').click();
        await page.waitForFunction(() => document.querySelector('#previewNotificationBtn').dataset.playing === 'true');
        assert.equal(await page.locator('#previewNotificationBtn').evaluate(node => node.getBoundingClientRect().width), idleWidth);
        await page.waitForFunction(() => document.querySelector('#previewNotificationBtn').dataset.playing === 'false', null, { timeout: 4000 });

        // Volume
        await setInput(page, '#notificationVolume', 0);
        await page.waitForFunction(() => window.qaState.notificationVolume === 0);
        assert.equal(await page.locator('.fpt-ns-mute-note').isVisible(), true, 'zero volume is called out');
        await setInput(page, '#notificationVolume', 35);
        await page.waitForFunction(() => window.qaState.notificationVolume === 0.35);
        await page.waitForFunction(() => document.querySelector('audio.loud').volume === 0.35);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('sounds page: a custom melody is loaded, trimmed on the waveform, saved and removed', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSoundsPage(browser, { seed: { notificationSound: 'vk' } });
        assert.equal(await page.locator('.fpt-ns-saved').isHidden(), true);
        assert.equal(await page.locator('.fpt-ns-editor').isHidden(), true);

        await page.locator('.fpt-ns-file-input').setInputFiles({ name: 'track.wav', mimeType: 'audio/wav', buffer: sineWav(8) });
        await page.locator('.fpt-ns-editor').waitFor();
        await settle(page);
        assert.equal((await page.locator('.fpt-ns-spin-value').textContent()).trim(), '5 сек');
        assert.equal((await page.locator('.fpt-ns-range').textContent()).trim(), '0:00.0 – 0:05.0');
        assert.ok(await page.evaluate(() => {
            const canvas = document.querySelector('.fpt-ns-wave-canvas');
            const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
            return false;
        }), 'the waveform is drawn');

        await page.locator('#fptClipSecDown').click();
        await page.locator('#fptClipSecDown').click();
        await page.waitForFunction(() => document.querySelector('.fpt-ns-spin-value').textContent.trim() === '3 сек');

        // Dragging the window moves the start; it cannot leave the track.
        const box = await page.locator('.fpt-ns-wave').boundingBox();
        await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
        const start = await page.locator('.fpt-ns-wave-sel').getAttribute('aria-valuenow');
        assert.ok(Number(start) > 3 && Number(start) <= 5, `start moved to ${start}`);
        await page.locator('.fpt-ns-wave-sel').focus();
        await page.keyboard.press('End');
        assert.equal(await page.locator('.fpt-ns-wave-sel').getAttribute('aria-valuenow'), '5.0');
        assert.equal((await page.locator('.fpt-ns-range').textContent()).trim(), '0:05.0 – 0:08.0');
        if (shotDir) { await settle(page); await page.locator('#fptNsCustomCard').screenshot({ path: path.join(shotDir, 'sounds-editor.png') }); }

        await page.locator('#fptCustomSoundSaveBtn').click();
        await page.waitForFunction(() => window.qaState.notificationSound === 'custom');
        const saved = await page.evaluate(() => ({ data: window.qaState.fpToolsCustomSoundData.slice(0, 22), meta: window.qaState.fpToolsCustomSoundMeta }));
        assert.equal(saved.data, 'data:audio/wav;base64,');
        assert.deepEqual(saved.meta, { length: 3, name: 'track.wav' });
        await page.locator('.fpt-ns-saved').waitFor();
        assert.equal((await page.locator('.fpt-ns-trigger-name').textContent()).trim(), 'Своя мелодия');
        assert.equal(await page.locator('#fptNsCustomCard').getAttribute('data-state'), 'on');
        await page.waitForFunction(() => document.querySelector('audio.loud').src.startsWith('blob:'));
        await openPicker(page);
        assert.deepEqual(await visibleGroups(page), ['FunPay', 'Мессенджеры', 'Своя'], 'a saved melody adds the "Своя" group');
        assert.equal(await option(page, 'custom').locator('[role="radio"]').getAttribute('aria-checked'), 'true');
        await page.keyboard.press('Escape');

        await page.locator('#fptCustomSoundRemoveBtn').click();
        await page.waitForFunction(() => window.qaState.notificationSound === 'default' && !window.qaState.fpToolsCustomSoundData);
        assert.equal(await page.locator('.fpt-ns-saved').isHidden(), true);
        assert.equal((await page.locator('.fpt-ns-trigger-name').textContent()).trim(), 'Стандартный');
        assert.equal(await option(page, 'custom').isHidden(), true, 'removing the melody hides "Своя" again');
        assert.deepEqual(await visibleGroups(page), ['FunPay', 'Мессенджеры']);

        await page.locator('.fpt-ns-file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') });
        await page.locator('.fpt-popup-toast[data-kind="error"]').waitFor();
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('sounds page: dark theme and a narrow popup keep the layout inside the frame', async () => {
    const browser = await launch();
    try {
        for (const { dark, viewport, name } of [
            { dark: true, viewport: { width: 1204, height: 789 }, name: 'sounds-dark.png' },
            { dark: false, viewport: { width: 760, height: 900 }, name: 'sounds-narrow.png' }
        ]) {
            const { page, errors } = await openSoundsPage(browser, { dark, viewport, seed: { notificationSound: 'iphone' } });
            await page.locator('.fpt-ns-trigger').click();
            await settle(page);
            const overflow = await page.evaluate(() => {
                const view = document.querySelector('.fpt-ns');
                const frame = view.getBoundingClientRect();
                return [...view.querySelectorAll('*')].filter(node => {
                    const rect = node.getBoundingClientRect();
                    return rect.width && (rect.right > frame.right + 1 || rect.left < frame.left - 1);
                }).map(node => node.className).slice(0, 5);
            });
            assert.deepEqual(overflow, [], `${name}: nothing sticks out of the page`);
            if (dark) {
                const colors = await page.locator('.fpt-ns-trigger').evaluate(node => getComputedStyle(node).backgroundColor);
                assert.equal(colors, 'rgb(118, 99, 246)', 'the open trigger uses the accent like the sidebar');
            }
            if (shotDir) await page.screenshot({ path: path.join(shotDir, name) });
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
    }
});
