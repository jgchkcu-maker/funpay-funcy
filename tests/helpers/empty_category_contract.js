const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function popupContext() {
    const root = path.join(__dirname, '../..');
    const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout,
        MutationObserver: class { observe() {} }, document: {
            getElementById() { return null; }, querySelector() { return null; }, head: { appendChild() {} }, documentElement: {},
            createElement() { return { style: {}, dataset: {}, querySelectorAll() { return []; }, addEventListener() {} }; }
        } });
    for (const file of ['content/ui/popup_metadata.js', 'content/ui/main_popup.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    vm.runInContext('fptInjectMenuThemeCSS = () => {}; fptApplyMenuTheme = () => {};', context);
    return context;
}
function assertEmptyCategory(pageId) {
    const context = popupContext();
    const markup = context.createMainPopup().innerHTML;
    assert.match(markup, new RegExp(`<div class="fp-tools-page-content(?: active)?" data-page="${pageId}">\\s*</div>`));
    assert.ok(context.window.FPTPopupMetadata.pages[pageId], 'Search metadata is retained');
    assert.doesNotMatch(markup, /fp-tools-start-screen|id="saveSettings"|fp-tools-footer/);
}
function assertRetiredCategory(pageId) {
    const context = popupContext();
    const markup = context.createMainPopup().innerHTML;
    assert.doesNotMatch(markup, new RegExp(`data-page="${pageId}"`));
    assert.equal(context.window.FPTPopupMetadata.pages[pageId], undefined, 'Search metadata is removed');
}
module.exports = { assertEmptyCategory, assertRetiredCategory };
