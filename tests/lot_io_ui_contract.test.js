const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const lot = fs.readFileSync(path.join(ROOT, 'content', 'features', 'lot_io.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const pageStart = popup.indexOf('<div class="fp-tools-page-content active" data-page="lot_io">');
const pageEnd = popup.indexOf('<div class="fp-tools-page-content" data-page="finance_hub">', pageStart);
assert.ok(pageStart >= 0 && pageEnd > pageStart, 'lot_io page must exist before finance_hub');
const page = popup.slice(pageStart, pageEnd);

assert.match(page, /class="fpt-ui-page-header lot-io-header"/, 'lot_io must use TASK 00 page-header primitive');
assert.match(page, /class="fpt-ui-surface lot-io-card lot-io-export-card"/, 'transfer card must use the shared surface primitive');
assert.match(page, /class="fpt-ui-button fpt-ui-button--primary lot-io-action-btn"/, 'export must use shared primary button');
assert.match(page, /class="fpt-ui-button fpt-ui-button--secondary lot-io-action-btn"/, 'import must use shared secondary button');
assert.doesNotMatch(page, />\s*file_upload\s*</, 'export must not depend on a Material ligature');
assert.doesNotMatch(page, />\s*file_download\s*</, 'import must not depend on a Material ligature');
assert.match(page, /id="lot-io-export-btn"[\s\S]*?<svg class="lot-io-action-icon"/, 'export needs an inline vector icon');
assert.match(page, /id="lot-io-import-btn"[\s\S]*?<svg class="lot-io-action-icon"/, 'import needs an inline vector icon');

assert.match(page, /id="convert-cardinal-lots-btn" class="lot-io-tertiary-link"/, 'Cardinal converter stays available as a tertiary transfer action');
assert.doesNotMatch(page, /lot-io-info-card/, 'oversized introductory info card must be removed');

assert.match(page, /id="lot-io-pending-section"[\s\S]*?hidden/, 'pending imports section is hidden before storage resolves');
assert.match(page, /id="lot-io-pending-imports-list" aria-live="polite"><\/div>/, 'pending list starts empty instead of rendering a permanent placeholder');
assert.doesNotMatch(page, /Здесь будут отображаться отложенные процессы импорта/, 'empty pending copy must not consume page space');

assert.match(lot, /if \(!process \|\| process\.state !== 'postponed'\) \{[\s\S]*?return;/, 'empty/non-postponed state must keep the section hidden');
assert.match(lot, /setSectionVisible\(true\);[\s\S]*?pending-import-item/, 'a postponed import must reveal the section');
assert.match(lot, /nameEl\.textContent = process\.name \|\| 'Отложенный импорт'/, 'pending import names must be rendered as text, not injected HTML');
assert.match(lot, /await chrome\.runtime\.sendMessage\(\{ action: 'cancelLotImport' \}\);[\s\S]*?await renderPendingImports\(\);/, 'deleting a postponed import must refresh visibility after cancellation');

const lotCssStart = css.indexOf('/* Lot management page — TASK 01');
const foundationStart = css.indexOf('/* ═══ FPT UI FOUNDATION v1 — TASK 00 ═══ */', lotCssStart);
assert.ok(lotCssStart >= 0 && foundationStart > lotCssStart, 'TASK 01 CSS block must stay scoped before TASK 00 foundation');
const lotCss = css.slice(lotCssStart, foundationStart);
assert.match(lotCss, /grid-template-columns:\s*40px minmax\(0, 1fr\)/, 'desktop icon tile column must be compact');
assert.match(lotCss, /width:\s*40px;[\s\S]*?height:\s*40px;/, 'desktop icon tile must be 40x40');
assert.match(lotCss, /height:\s*var\(--fpt-ui-control-h\)/, 'lot action buttons must use the shared control height');
assert.match(lotCss, /text-transform:\s*none\s*!important/, 'page title must not inherit the old uppercase treatment');
assert.match(lotCss, /#lot-io-pending-section\[hidden\][\s\S]*?display:\s*none\s*!important/, 'hidden pending section must not reserve layout space');

new Function(lot);
console.log('LOT_IO_UI_CONTRACT_PASS');
