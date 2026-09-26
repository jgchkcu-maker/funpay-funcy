const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const ui = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_delivery_ui.js'), 'utf8').replace(/\r\n/g, '\n');
const restore = fs.readFileSync(path.join(ROOT, 'content', 'features', 'auto_restore_lots.js'), 'utf8').replace(/\r\n/g, '\n');
const settings = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'settings_loader.js'), 'utf8').replace(/\r\n/g, '\n');
const misc = fs.readFileSync(path.join(ROOT, 'content', 'features', 'misc.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_delivery">');
const end = popup.indexOf('<div class="fp-tools-page-content" data-page="tickets"', start);
assert.ok(start >= 0 && end > start, 'auto_delivery page must exist');
const page = popup.slice(start, end);
const stockCounterStart = ui.indexOf('async function initStockCounterDisplay()');
assert.ok(stockCounterStart > 0, 'stock counter boundary must remain available');
const popupUi = ui.slice(0, stockCounterStart);

assert.match(page, /class="fpt-ui-page-header fp-ad-page-header"/, 'page uses TASK 00 page header');
assert.equal((page.match(/class="fpt-ui-surface fp-ad-section/g) || []).length, 2, 'page is split into automation and per-lot surfaces');
assert.match(page, /id="fpAutoRestoreEnabled" class="fp-ad-setting-checkbox"/, 'auto-restore id remains stable');
assert.match(page, /id="fpAutoDisableEnabled" class="fp-ad-setting-checkbox"/, 'auto-disable id remains stable');
assert.match(page, /<details class="fp-ad-variables">/, 'variables are progressive disclosure, not a permanent callout');
assert.doesNotMatch(page, /vertical-align:\s*-3px/, 'page no longer uses manual icon baseline nudging');
assert.doesNotMatch(page, /support-promo/, 'legacy promo/callout is removed from auto-delivery');
assert.match(page, /data-state="idle"/, 'initial lots state is explicit');
assert.match(page, /id="fp-load-delivery-lots-btn" class="fpt-ui-button fpt-ui-button--secondary fp-ad-load-btn"/, 'load action uses shared button primitive');

for (const state of ['loading', 'empty', 'error']) {
    assert.ok(popupUi.includes("renderDeliveryState(listEl, '" + state + "'"), 'UI must explicitly render ' + state + ' state');
}
assert.match(popupUi, /container\.dataset\.state = 'loaded'/, 'loaded state must be explicit');
assert.match(popupUi, /settings\.hidden = !lotConfig\.enabled/, 'disabled lot keeps settings collapsed');
assert.match(popupUi, /templateArea\.hidden = currentMode !== 'template'/, 'template editor is progressively disclosed');
assert.match(popupUi, /title\.title = lot\.title/, 'long lot title remains available as native tooltip');
assert.match(popupUi, /textContent = .*lot\.title|fpAdCreateElement\('div', 'fp-ad-lot-title', lot\.title/, 'lot titles are assigned as text rather than raw HTML');
assert.doesNotMatch(popupUi, /style\.cssText/, 'popup-side lot list must not be built from inline cssText');
assert.doesNotMatch(popupUi, /💾|📦|📭/, 'popup controls and stock copy must not rely on emoji affordances');

assert.match(settings, /'fpToolsAutoRestoreEnabled'/, 'saved auto-restore key stays loaded');
assert.match(settings, /'fpToolsAutoDisableEnabled'/, 'saved auto-disable key stays loaded');
assert.match(misc, /fpToolsAutoRestoreEnabled:\s*document\.getElementById\('fpAutoRestoreEnabled'\)/, 'autosave preserves the auto-restore storage key');
assert.match(misc, /fpToolsAutoDisableEnabled:\s*document\.getElementById\('fpAutoDisableEnabled'\)/, 'autosave preserves the auto-disable storage key');
assert.match(restore, /fpToolsAutoDeliveryLots/, 'runtime stock automation still reads per-lot delivery config');

assert.match(css, /AUTO DELIVERY UI — TASK 02/, 'TASK 02 stylesheet block exists');
assert.match(css, /\.fp-ad-setting-checkbox\s*\{[\s\S]*?width:\s*16px;[\s\S]*?margin:\s*0\s*!important;/, 'setting checkbox has stable alignment without legacy margin');
assert.match(css, /\.fp-ad-settings\[hidden\],[\s\S]*?display:\s*none\s*!important;/, 'collapsed per-lot settings cannot reserve layout space');
assert.match(css, /@container fpt-content \(max-width: 680px\)/, 'auto-delivery page has a compact responsive layout');

new Function(ui);
new Function(restore);
console.log('AUTO_DELIVERY_UI_CONTRACT_PASS');
