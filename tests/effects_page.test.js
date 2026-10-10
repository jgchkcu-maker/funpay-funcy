// The effects category is an empty shell in the static popup and is filled in at runtime by FPTEffectsPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function loadPage() {
    const window = {};
    new Function('window', read('content/ui/effects_page.js'))(window);
    return window.FPTEffectsPage;
}

test('effects: static markup stays empty and search metadata remains', () => assertEmptyCategory('effects'));

test('effects: the category view is mounted into the existing popup shell', () => {
    assert.ok(read('content/content_script.js').includes('FPTEffectsPage.mount(toolsPopup)'), 'the popup boot path mounts the effects view');
    const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(read('manifest.json')));
    const scripts = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js')).js;
    assert.ok(scripts.includes('content/ui/effects_page.js'), 'manifest loads the effects page module');
    assert.ok(scripts.indexOf('content/ui/effects_page.js') < scripts.indexOf('content/ui/popup_bundle_ready.js'),
        'the module loads before the readiness marker that permits mounting it');
    assert.ok(scripts.indexOf('content/features/cursor_fx.js') < scripts.indexOf('content/ui/effects_page.js'),
        'the shared particle helpers load before the preview uses them');
});

test('effects: the page uses the shared frame, existing storage keys and popup actions', () => {
    const source = read('content/ui/effects_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Эффекты'/);
    for (const key of ['fpToolsCursorFx', 'fpToolsCustomCursor']) assert.ok(source.includes(key), `${key} is still used`);
    for (const action of ["'resetCursorFxBtn'", "'uploadCursorImageBtn'", "'removeCursorImageBtn'", "'saveSettings'", "'getSettings'"]) {
        assert.ok(source.includes(action), `${action} is routed through fptPopupActions`);
    }
    assert.ok(!/innerHTML/.test(source), 'the page builds DOM nodes instead of injecting HTML');
    assert.ok(!/chrome\.storage\.local\.(get|set)/.test(source), 'storage access goes through popup actions');
});

test('effects: styles are scoped, responsive and respect reduced motion', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-fx\s*\{[^}]*container-name: fpt-effects/);
    assert.match(css, /@container fpt-effects \(max-width: 560px\)/);
    assert.match(css, /\.fpt-fx-type\[aria-checked="true"\]/);
    assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.fp-tools-popup\.fptm-themed \.fpt-fx \*/);
});

test('effects: settings are normalized with safe defaults', () => {
    const { normalizeFx, normalizeCursor, DEFAULT_FX, DEFAULT_CURSOR } = loadPage();
    assert.deepEqual(normalizeFx(undefined), { ...DEFAULT_FX });
    assert.deepEqual(normalizeFx({ enabled: true, type: 'snow', color1: '#ABC', color2: 'nope', rgb: true, count: 140 }),
        { enabled: true, type: 'snow', color1: '#aabbcc', color2: '#1b75bb', rgb: true, count: 100 });
    assert.equal(normalizeFx({ type: 'lasers' }).type, 'sparkle');
    assert.equal(normalizeFx({ count: '-5' }).count, 0);
    // The reset action writes upper-case colours; they read back the same.
    assert.equal(normalizeFx({ color1: '#FF6B6B' }).color1, '#ff6b6b');

    assert.deepEqual(normalizeCursor(null), { ...DEFAULT_CURSOR });
    assert.deepEqual(normalizeCursor({ enabled: true, image: 'data:image/png;base64,AA==', hideSystem: false, size: 500, opacity: 0 }),
        { enabled: true, image: 'data:image/png;base64,AA==', hideSystem: false, size: 128, opacity: 10 });
    assert.equal(normalizeCursor({ image: 'javascript:alert(1)' }).image, null, 'only image data URLs are accepted');
    assert.equal(normalizeCursor({ size: 'big' }).size, 32);
});

test('effects: the page and the site effect share one particle model', () => {
    const fx = read('content/features/cursor_fx.js');
    assert.match(fx, /window\.FPTCursorFxParticles = FPTCursorFxParticles/);
    assert.match(fx, /FPTCursorFxParticles\.spawn\(this\.config/);
    assert.match(read('content/ui/effects_page.js'), /root\.FPTCursorFxParticles/);

    const window = {};
    const source = fx.slice(0, fx.indexOf('class CursorFX'));
    new Function('window', source)(window);
    const { spawn, step, spawnCount } = window.FPTCursorFxParticles;
    const particle = spawn({ type: 'blood', color1: '#ff0000', color2: '#ff0000', rgb: false }, 10, 20, 0);
    assert.equal(particle.color, 'rgb(255,0,0)');
    assert.equal(particle.gravity, 0.15);
    assert.equal(spawn({ type: 'snow', rgb: false }, 0, 0, 0).color.startsWith('rgba(255,255,255,'), true);
    assert.equal(spawn({}, 0, 0, 0).color, 'rgb(255,255,255)', 'a partial config does not throw');
    particle.life = 1;
    assert.equal(step(particle), false, 'a faded particle is dropped');
    assert.equal(spawnCount(0), 0);
    assert.equal(spawnCount(100), 5);
    assert.ok(spawnCount(undefined) >= 2, 'a missing intensity falls back to the default');
});
