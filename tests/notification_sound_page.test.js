// The notification sound category is an empty shell in the static popup and is filled in at runtime by FPTNotificationSoundPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadCatalog() {
    const window = {};
    const chrome = { runtime: { getURL: file => `chrome-extension://qa/${file}` } };
    const source = read('content/features/custom_sound.js');
    new Function('window', 'chrome', source.slice(0, source.indexOf('async function applyNotificationSound')))(window, chrome);
    return window.FPTNotificationSounds;
}

function loadPage() {
    const window = {};
    new Function('window', read('content/ui/notification_sound_page.js'))(window);
    return window.FPTNotificationSoundPage;
}

test('sounds: static markup stays empty and search metadata remains', () => assertEmptyCategory('sounds'));

test('sounds: the page sits in the customers group and is mounted by the popup', () => {
    assert.match(read('content/ui/main_popup.js'), /id: 'customers'[^\n]*'blacklist', 'sounds'\]/);
    assert.ok(read('content/content_script.js').includes('FPTNotificationSoundPage.mount(toolsPopup)'));
    const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(read('manifest.json')));
    const scripts = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js')).js;
    const at = file => scripts.indexOf(file);
    assert.ok(at('content/ui/popup_actions.js') < at('content/features/custom_sound.js'), 'actions exist before the sound runtime registers');
    assert.ok(at('content/features/custom_sound.js') < at('content/ui/notification_sound_page.js'), 'the catalogue loads before the page');
    assert.ok(at('content/features/custom_sound_editor.js') < at('content/ui/notification_sound_page.js'));
    assert.ok(at('content/ui/notification_sound_page.js') < at('content/ui/popup_bundle_ready.js'));
});

test('sounds: every preset file ships with the extension and is web accessible', () => {
    const catalog = loadCatalog();
    const ids = catalog.presets.map(preset => preset.id);
    assert.deepEqual(ids, ['default', 'vk', 'tg', 'iphone', 'discord', 'whatsapp', 'custom']);
    assert.deepEqual(catalog.groups.map(group => group.id), ['funpay', 'messengers', 'custom']);
    for (const preset of catalog.presets.filter(item => item.file)) {
        assert.ok(fs.existsSync(path.join(root, 'sounds', preset.file)), preset.file);
    }
    assert.ok(catalog.presets.every(preset => catalog.groups.some(group => group.id === preset.group)));
    assert.ok(!fs.existsSync(path.join(root, 'sounds/kenney')), 'the Funcy presets are gone');
    const resources = JSON.parse(read('manifest.json')).web_accessible_resources.flatMap(group => group.resources);
    assert.ok(resources.includes('sounds/*.mp3') && !resources.some(item => item.includes('kenney')));

    assert.equal(catalog.urlFor('default'), 'https://funpay.com/audio/chat_loud.mp3');
    assert.equal(catalog.urlFor('tg'), 'chrome-extension://qa/sounds/telegram.mp3');
    assert.equal(catalog.normalizeId('glass'), 'default', 'a stored Funcy preset falls back to the FunPay sound');
    assert.equal(catalog.urlFor('custom'), null, 'the custom clip lives in storage');
    assert.equal(catalog.normalizeId('lasers'), 'default');
    assert.equal(catalog.normalizeVolume('2'), 1);
    assert.equal(catalog.normalizeVolume(-1), 0);
    assert.equal(catalog.normalizeVolume('nope'), 1);
});

test('sounds: the page uses the shared frame, the stored keys and popup actions only', () => {
    const source = read('content/ui/notification_sound_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Звук уведомлений'/);
    for (const key of ['notificationSound', 'notificationVolume', 'fpToolsCustomSoundMeta']) assert.ok(source.includes(key), key);
    for (const action of ['previewNotificationBtn', 'stopNotificationPreview', 'fptCustomSoundUploadBtn', 'getAudioWaveform',
        'selectAudioClip', 'fptClipSecUp', 'fptClipSecDown', 'fptCustomSoundPreviewBtn', 'fptCustomSoundStopBtn',
        'fptCustomSoundSaveBtn', 'fptCustomSoundRemoveBtn', 'saveSettings', 'getSettings']) {
        assert.ok(source.includes(`'${action}'`), `${action} is routed through fptPopupActions`);
    }
    assert.ok(!/innerHTML/.test(source), 'the page builds DOM nodes instead of injecting HTML');
    assert.ok(!/chrome\.storage\.local\.(get|set|remove)/.test(source), 'storage access goes through popup actions');
    assert.match(source, /collapse\.toggleAttribute\('inert', !open\)/, 'the closed list is out of the tab order');
});

test('sounds: the playback runtime no longer depends on the original source path', () => {
    const source = read('content/features/custom_sound.js');
    assert.doesNotMatch(source, /source\[src='\/audio\/chat_loud\.mp3'\]/, 'switching back to the default sound must keep working');
    assert.match(source, /audioPlayer\.addEventListener\('play'/, 'FunPay calls play() from the page world, so the guard listens for the event');
    assert.doesNotMatch(source, /register\('telegram'/);
    assert.doesNotMatch(read('content/features/custom_sound_editor.js'), /register\('telegram'/);
});

test('sounds: styles are scoped, responsive and respect reduced motion', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-ns\s*\{[^}]*container-name: fpt-sounds/);
    assert.match(css, /@container fpt-sounds \(max-width: 560px\)/);
    assert.match(css, /\.fpt-ns-picker\[data-open="true"\] \.fpt-ns-collapse \{ grid-template-rows: 1fr; \}/);
    assert.match(css, /transition: grid-template-rows \.32s cubic-bezier\(\.22, 1, \.36, 1\)/, 'the list slides like the sidebar groups');
    assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.fp-tools-popup\.fptm-themed \.fpt-ns \*/);
});

test('sounds: stored values are normalized with safe defaults', () => {
    const { normalizeVolume, normalizeMeta, formatTime } = loadPage();
    assert.equal(normalizeVolume(0.42), 42);
    assert.equal(normalizeVolume(undefined), 100);
    assert.equal(normalizeVolume(3), 100);
    assert.equal(normalizeMeta(null), null);
    assert.equal(normalizeMeta({ length: 0 }), null);
    assert.deepEqual(normalizeMeta({ length: 9, name: 'track.mp3' }), { length: 5, name: 'track.mp3' });
    assert.deepEqual(normalizeMeta({ length: '3.5', name: 7 }), { length: 3.5, name: '' });
    assert.equal(formatTime(65.25), '1:05.3');
    assert.equal(formatTime(-1), '0:00.0');
});
