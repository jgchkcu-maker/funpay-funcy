const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const feature = fs.readFileSync(path.join(ROOT, 'content', 'features', 'blacklist.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="blacklist">');
const end = popup.indexOf('<div class="fp-tools-page-content" data-page="auto_delivery">', start);
assert.ok(start >= 0 && end > start, 'blacklist page must exist');
const page = popup.slice(start, end);

assert.match(page, /class="fpt-ui-page-header fp-bl-page-header"/, 'blacklist uses shared page header');
assert.match(page, /class="fpt-ui-surface fp-bl-section fp-bl-composer-section"/, 'composer is grouped in a surface');
assert.match(page, /class="fpt-ui-surface fp-bl-section fp-bl-list-section"/, 'list has its own visual container');
assert.match(page, /id="fp-bl-name-input" class="fpt-ui-control fp-bl-input"/, 'username uses shared control geometry');
assert.match(page, /id="fp-bl-note-input" class="fpt-ui-control fp-bl-input"/, 'reason uses shared control geometry');
assert.match(page, /id="fp-bl-add-btn" class="fpt-ui-button fpt-ui-button--primary fp-bl-add-btn"/, 'add action is compact primary CTA');
assert.match(page, /id="fp-bl-search-input" class="fpt-ui-control fp-bl-search-input"/, 'list has optional search');
assert.match(page, /id="fp-bl-list" class="fp-bl-list" aria-live="polite"/, 'list is a stable live region');
assert.doesNotMatch(page, /style="/, 'TASK 07 page layout has no inline styles');

assert.match(feature, /const escapeHtml = value =>/, 'dynamic blacklist content is escaped');
assert.match(feature, /class="fpt-ui-state fp-bl-empty-state"/, 'empty blacklist uses shared empty state');
assert.match(feature, /class="fpt-ui-state fp-bl-empty-state fp-bl-search-empty"/, 'search-empty state is intentional');
assert.match(feature, /class="fp-bl-row"/, 'rendered entries use structured rows');
assert.match(feature, /fpt-ui-button fpt-ui-button--danger fpt-ui-icon-button fp-bl-remove/, 'delete is an explicit danger action');
assert.match(feature, /searchInput\?\.addEventListener\('input', render\)/, 'search rerenders list');
assert.match(feature, /const idx = parseInt\(btn\.dataset\.idx, 10\)/, 'delete preserves storage index');
assert.match(feature, /blockDelivery: true/, 'existing default delivery block stays enabled');
assert.match(feature, /blockResponse: true/, 'existing default response block stays enabled');
assert.match(feature, /blockNotification: false/, 'existing notification default stays disabled');
assert.match(feature, /fpToolsBlacklist/, 'storage key remains unchanged');
const renderStart = feature.indexOf('async function render()');
const addStart = feature.indexOf("addBtn.addEventListener('click'", renderStart);
assert.ok(renderStart >= 0 && addStart > renderStart, 'render function exists');
assert.doesNotMatch(feature.slice(renderStart, addStart), /style="/, 'rendered blacklist UI has no inline styles');

assert.match(css, /BLACKLIST UI — TASK 07/, 'TASK 07 CSS exists');
assert.match(css, /\.fp-bl-composer-grid[\s\S]*?grid-template-columns:\s*minmax\(180px, \.95fr\) minmax\(220px, 1\.25fr\) auto/, 'composer keeps equal-height fields with compact CTA');
assert.match(css, /\.fp-bl-list[\s\S]*?min-height:\s*148px/, 'empty state is centered inside list area');
assert.match(css, /\.fp-bl-remove[\s\S]*?color:\s*var\(--fpt-danger/, 'delete uses danger semantics');
assert.match(css, /@container fpt-content \(max-width: 520px\)/, 'blacklist has narrow responsive layout');

new Function(feature);
console.log('BLACKLIST_UI_CONTRACT_PASS');
