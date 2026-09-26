const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const misc = fs.readFileSync(path.join(ROOT, 'content', 'features', 'misc.js'), 'utf8').replace(/\r\n/g, '\n');
const autobump = fs.readFileSync(path.join(ROOT, 'background', 'autobump.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const start = popup.indexOf('<div class="fp-tools-page-content" data-page="autobump">');
const end = popup.indexOf('<div class="fp-tools-page-content" data-page="global_chat">', start);
assert.ok(start >= 0 && end > start, 'autobump page must exist');
const page = popup.slice(start, end);

assert.match(page, /class="fpt-ui-page-header fp-autobump-page-header"/);
assert.equal((page.match(/class="fpt-ui-surface fp-autobump-section/g) || []).length, 2);
assert.match(page, /id="autoBumpEnabled" class="fp-autobump-setting-checkbox"/);
assert.match(page, /id="selectiveBumpEnabled" class="fp-autobump-setting-checkbox"/);
assert.match(page, /id="bumpOnlyAutoDelivery" class="fp-autobump-setting-checkbox"/);
assert.match(page, /id="autoBumpSelectedCategoriesRow"[\s\S]*?hidden/);
assert.match(page, /id="autoBumpConsole" class="fp-autobump-log-list" hidden/);
assert.doesNotMatch(page, /margin-top:\s*-10px|margin-left:\s*30px/);

assert.match(misc, /function syncAutoBumpUIState\(\)/);
assert.match(misc, /selective\.disabled = !enabled/);
assert.match(misc, /onlyAutoDelivery\.disabled = !enabled/);
assert.match(misc, /selectedRow\.hidden = !selective\.checked/);
assert.match(misc, /configure\.disabled = !enabled \|\| !selective\.checked/);
assert.match(misc, /text\.textContent = String\(\(category && category\.name\)/);
assert.match(misc, /item\.hidden = !name\.includes\(query\)/);
assert.match(misc, /updateAutoBumpCategorySummary\(selectedIds\)/);
assert.match(misc, /appendAutoBumpLog\(message\)/);
assert.match(misc, /if \(isError\)[\s\S]*?consoleEl\.hidden = false/);

assert.match(autobump, /const AUTOBUMP_LOG_KEY = 'fpToolsAutoBumpLogs'/);
assert.match(autobump, /AUTOBUMP_LOG_LIMIT = 50/);
assert.match(autobump, /\[AUTOBUMP_LOG_KEY\]: \[logMessage, \.\.\.previous\]\.slice\(0, AUTOBUMP_LOG_LIMIT\)/);
assert.match(autobump, /action: 'logToAutoBumpConsole'/);
assert.match(autobump, /fpToolsSelectiveBumpEnabled[\s\S]*?fpToolsBumpOnlyAutoDelivery/);

assert.match(css, /AUTOBUMP UI — TASK 03/);
assert.match(css, /\.fp-autobump-setting-checkbox \{[\s\S]*?width:16px;[\s\S]*?margin:0 !important;/);
assert.match(css, /\.fp-autobump-selected-row\[hidden\] \{ display:none !important; \}/);
assert.match(css, /\.fp-autobump-log-list\[hidden\] \{ display:none !important; \}/);

new Function(misc);
console.log('AUTOBUMP_UI_CONTRACT_PASS');
