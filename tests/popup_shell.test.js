const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function popupContext() {
    const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout,
        MutationObserver: class { observe() {} },
        document: { getElementById() { return null; }, querySelector() { return null; },
            head: { appendChild() {} }, documentElement: {},
            createElement() { return { style: {}, dataset: {}, querySelectorAll() { return []; }, addEventListener() {} }; } }
    });
    for (const file of ['content/ui/popup_metadata.js', 'content/ui/main_popup.js']) {
        const absolute = path.join(__dirname, '..', file);
        if (fs.existsSync(absolute)) vm.runInContext(fs.readFileSync(absolute, 'utf8'), context, { filename: file });
    }
    vm.runInContext('fptInjectMenuThemeCSS = () => {}; fptApplyMenuTheme = () => {};', context);
    return context;
}

test('popup creation leaves every category empty, retains navigation, and omits the close control', () => {
    const context = popupContext();
    const popup = context.createMainPopup();
    const main = popup.innerHTML.match(/<main class="fp-tools-content">([\s\S]*?)<\/main>/)[1];
    const pages = [...main.matchAll(/<div class="fp-tools-page-content[^>]*data-page="([^"]+)"[^>]*>\s*<\/div>/g)];
    assert.equal(pages.length, 18, 'only active routes need an empty container');
    for (const pageId of ['piggy_banks', 'calculator']) {
        assert.equal(pages.some(([, id]) => id === pageId), false, `${pageId} has been removed`);
        assert.equal(popup.innerHTML.includes(`data-page="${pageId}"`), false, `${pageId} has no navigation entry`);
    }
    assert.equal(main.replace(/<div class="fp-tools-page-content[^>]*data-page="[^"]+"[^>]*>\s*<\/div>/g, '').trim(), '');
    assert.ok(popup.innerHTML.includes('id="fptNavSearch"'));
    assert.ok(popup.innerHTML.includes('id="fptNavCollapse"'));
    assert.ok(!popup.innerHTML.includes('aria-label="Закрыть"'));
    assert.ok(!popup.innerHTML.includes('id="saveSettings"'));
});

test('feature search metadata remains available after removing category headings', () => {
    const context = popupContext();
    const features = context.window.FPTPopupMetadata;
    assert.ok(features, 'search must not depend on removed DOM');
    assert.ok(features.pages.auto_reply.features.some(entry => entry.text.includes('Приветствие')));
    assert.ok(features.pages.theme.features.some(entry => entry.text.includes('Цвет')));
    assert.equal(Object.hasOwn(features.pages, 'piggy_banks'), false);
    assert.equal(Object.hasOwn(features.pages, 'calculator'), false);
    assert.deepEqual(Array.from(features.pages.finance_hub.modes), ['overview', 'sales', 'purchases', 'profit', 'potential', 'operations']);
});

test('deleted popup components have no remaining styles while page integrations stay styled', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css/content_styles.css'), 'utf8');
    for (const selector of ['#fp-bulk-editor-overlay', '.fp-tools-template-preview', '#fp-tools-import-modal-overlay',
        '.auto-review-mode-selector', '.review-templates-grid', '.support-promo', '.fp-tools-radio-group',
        '.fp-tools-page-content[data-page="finance_hub"]', '.fp-tools-page-content[data-page="global_chat"]',
        '.fp-tools-page-content[data-page="calculator"]']) {
        assert.equal(css.includes(selector), false, `${selector} belongs to a removed popup view`);
    }
    assert.equal(css.includes('.fp-tools-piggy-bank-dropdown'), false);
    assert.equal(css.includes('.piggy-banks-list-container'), false);
    for (const selector of ['.fpt-tpl-popover', '.fp-tools-empty-template-overlay', '#fpt-cost-basis-group']) {
        assert.ok(css.includes(selector), `${selector} belongs to a retained page integration`);
    }
});
