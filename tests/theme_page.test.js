const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context } = require('./helpers/popup_actions_harness');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pageSource = read('content/ui/theme_page.js');
const manifest = JSON.parse(read('manifest.json'));
const contentScripts = manifest.content_scripts.find(entry => entry.js?.includes('content/content_script.js')).js;
const styles = read('css/popup_categories.css');

function themeContext(initial = {}) {
    const h = context(initial);
    h.ctx.document.createElement = () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, set fillStyle(_) {} }), toDataURL: () => 'data:image/png;base64,AAAA' });
    h.load('content/features/theme.js');
    h.ctx.applyCustomTheme = h.ctx.applyHeaderPosition = async () => {};
    h.ctx.fetch = async url => ({ ok: true, json: async () => String(url).endsWith('index.json')
        ? [{ id: 'one', name: 'one', file: 'one.fptheme' }] : { bgColor1: '#336699', font: 'Roboto', borderRadius: 12 } });
    h.load('content/features/theme_gallery.js');
    return h;
}

test('theme draftOnly actions return values without touching storage or the site', async () => {
    const h = themeContext({ fpToolsTheme: { font: 'Lato' }, enableCustomTheme: false });
    let applied = 0;
    h.ctx.applyCustomTheme = async () => { applied += 1; };

    const defaults = await h.api.run('theme', 'getThemeDefaults');
    assert.equal(defaults.font, 'Helvetica Neue');
    assert.equal(defaults.bgImage, null);

    const random = await h.api.run('theme', 'randomizeThemeBtn', { draftOnly: true });
    assert.match(random.bgColor1, /^#[0-9a-f]{6}$/);
    const dark = await h.api.run('theme', 'fp-apply-dark-preset', { draftOnly: true });
    assert.equal(dark.bgImage, 'data:image/png;base64,AAAA');
    const imported = await h.api.run('theme', 'importThemeBtn', { theme: { bgColor1: '#336699', font: 'Roboto' }, draftOnly: true });
    assert.equal(imported.font, 'Roboto');
    const catalog = await h.api.run('theme', 'getThemeCatalog');
    const gallery = await h.api.run('theme', 'applyCurrent', { theme: catalog[0], draftOnly: true });
    assert.equal(gallery.borderRadius, 12);

    assert.deepEqual({ ...h.saved }, { fpToolsTheme: { font: 'Lato' }, enableCustomTheme: false }, 'draft values never reach storage');
    assert.equal(applied, 0, 'the live site theme is not re-applied for a draft');
});

test('theme actions keep their original write-through behaviour without the draft flag', async () => {
    const h = themeContext({ enableCustomTheme: false });
    await h.api.run('theme', 'fp-apply-dark-preset');
    assert.equal(h.saved.enableCustomTheme, true);
    assert.equal(h.saved.fpToolsTheme.bgColor1, '#0a0a0a');
    const random = await h.api.run('theme', 'randomizeThemeBtn');
    assert.deepEqual(h.saved.fpToolsTheme.bgColor1, random.bgColor1);
    const imported = await h.api.run('theme', 'importThemeBtn', { theme: { bgColor1: '#336699', font: 'Roboto' } });
    assert.equal(h.saved.fpToolsTheme.font, imported.font);
    await assert.rejects(h.api.run('theme', 'importThemeBtn', { theme: { nope: true } }), /формат/);
});

test('theme page metadata keeps searchable labels and only registered button ids', async () => {
    const h = themeContext();
    const sandbox = { window: {} };
    vm.runInNewContext(read('content/ui/popup_metadata.js'), sandbox);
    const theme = sandbox.window.FPTPopupMetadata.pages.theme;
    const registered = new Set(h.api.list('theme'));
    theme.buttons.forEach(id => assert.ok(registered.has(id), `${id} must stay registered`));
    const labels = theme.features.map(entry => entry.text).join('|');
    ['Готовые темы', 'Цвета', 'Шрифт', 'Эффект матового стекла', 'Свой скроллбар', 'Экспорт темы', 'Сбросить тему'].forEach(label =>
        assert.ok(labels.includes(label), `search keeps "${label}"`));
    assert.doesNotMatch(labels, /Контур/, 'text outline was removed from the interface');
});

test('theme page module is wired in order, mounts safely and avoids native dialogs', () => {
    const indexOf = file => contentScripts.indexOf(file);
    assert.ok(indexOf('content/ui/theme_page.js') > indexOf('content/features/theme_gallery.js'));
    assert.ok(indexOf('content/ui/theme_page.js') > indexOf('content/ui/popup_components.js'));
    assert.ok(indexOf('content/ui/theme_page.js') > indexOf('content/features/theme.js'));
    assert.match(read('content/content_script.js'), /window\.FPTThemePage\.mount\(toolsPopup\)/);
    assert.match(pageSource, /root\.FPTThemePage = Object\.freeze\(/);
    assert.match(pageSource, /dataset\.fptThemeMounted/);
    assert.doesNotMatch(pageSource, /\b(?:prompt|confirm|alert)\(/, 'dialogs are page components');
    assert.doesNotMatch(pageSource, /getElementById\('(?:bgImageInput|themeColor1|enableCustomTheme)'\)/, 'legacy popup ids are not read');
    assert.doesNotMatch(pageSource, /innerHTML/, 'the view is built from DOM nodes');
    assert.doesNotMatch(read('content/ui/main_popup.js'), /fpt-th-/, 'the shell keeps category containers empty');
});

test('theme page reads and writes only through popup actions and keeps drafts out of storage', () => {
    assert.doesNotMatch(pageSource, /chrome\.storage/);
    assert.match(pageSource, /run\('saveSettings', \{ settings: payload \}\)/);
    ['getThemeDefaults', 'exportThemeBtn', 'getThemeCatalog', 'applyCurrent', 'randomizeThemeBtn', 'generatePaletteBtn',
        'importThemeBtn', 'fp-apply-dark-preset', 'resetThemeBtn', 'enableMagicStickBtn'].forEach(id =>
        assert.ok(pageSource.includes(`'${id}'`), `${id} is used by the page`));
    assert.equal((pageSource.match(/draftOnly: true/g) || []).length, 5, 'every value-producing action asks for a draft');
});

test('theme page styles stay inside the popup, use shared tokens and honour reduced motion', () => {
    const start = styles.indexOf('/* Themes screen:');
    assert.ok(start > 0, 'theme block present');
    const block = styles.slice(start).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...block.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map(match => match[1].trim()).filter(Boolean);
    selectors.forEach(list => list.split(',').map(item => item.trim()).filter(item => /^[.\w]/.test(item) && !/^\d+%$|^from$|^to$/.test(item)).forEach(selector =>
        assert.match(selector, /^\.fp-tools-popup\.fptm-themed /, `selector escaped the popup scope: ${selector}`)));
    assert.doesNotMatch(block.replace(/\.fpt-th-preset-art--random[^}]*\}/, ''), /#7663f6/i, 'accent comes from --fptm-accent (only the decorative random tile is fixed)');
    assert.match(block, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.fpt-th/);
    assert.match(block, /@container fpt-theme \(max-width: 900px\)/);
    assert.match(block, /\.fpt-th-range::-webkit-slider-thumb/);
    assert.match(block, /:focus-visible/);
});

test('original FunPay look: defaults, reset and a light CSS without wallpaper or recolouring', async () => {
    const h = themeContext({ fpToolsTheme: { font: 'Lato' }, enableCustomTheme: true });
    assert.equal((await h.api.run('theme', 'getThemeDefaults')).baseStyle, 'original');
    const reset = await h.api.run('theme', 'resetThemeBtn');
    assert.equal(reset.baseStyle, 'original');
    assert.equal((await h.api.run('theme', 'exportThemeBtn')).baseStyle, 'original', 'no saved theme means the original look');

    const themeSource = read('content/features/theme.js');
    const sandbox = {};
    vm.runInNewContext(`${themeSource.slice(themeSource.indexOf('function fptResolveThemeBaseStyle'), themeSource.indexOf('function getCustomThemeCss'))}; this.resolve = fptResolveThemeBaseStyle; this.css = getOriginalThemeCss;`, sandbox);
    assert.equal(sandbox.resolve({ bgColor1: '#fff' }), 'custom', 'themes saved before the field existed stay custom');
    assert.equal(sandbox.resolve({}), 'original');
    const css = sandbox.css({ font: 'Roboto', borderRadius: 14, enableCustomScrollbar: true, scrollbarWidth: 6, scrollbarThumbColor: '#111111', scrollbarTrackColor: '#eeeeee' });
    assert.match(css, /border-radius: 14px/);
    assert.match(css, /::-webkit-scrollbar \{ width: 6px; \}/);
    assert.doesNotMatch(css, /body::before|i\.ibb\.co|#ff6d15|background: transparent !important/);

    const imported = await h.api.run('theme', 'importThemeBtn', { theme: { bgColor1: '#336699', font: 'Roboto' }, draftOnly: true });
    assert.equal(imported.baseStyle, 'custom');
});

test('theme page cards avoid bare header elements and keep native file inputs out of sight', () => {
    assert.doesNotMatch(pageSource, /node\('header'/);
    assert.match(styles, /\.fpt-th input\[type="file"\] \{ display: none !important; \}/);
});

test('site theme rules are guarded against the popup without changing specificity', () => {
    const themeSource = read('content/features/theme.js');
    const sandbox = {};
    vm.runInNewContext(`${themeSource.slice(themeSource.indexOf('const FPT_THEME_POPUP_GUARD'), themeSource.indexOf('function getOriginalThemeCss'))}; this.scope = fptScopeOutsidePopup;`, sandbox);
    const out = sandbox.scope('body::before { content: ""; }\n header { background: red; } a:hover, .x .y:after { color: #fff; }');
    const guard = ':not(:where(.fp-tools-popup, .fp-tools-popup *))';
    assert.ok(out.includes(`body${guard}::before {`), 'pseudo-elements stay last');
    assert.ok(out.includes(`header${guard} { background: red; }`));
    assert.ok(out.includes(`a:hover${guard}, .x .y${guard}:after {`));
    assert.match(themeSource, /themedCss = fptScopeOutsidePopup\(themedCss\)/);
});
