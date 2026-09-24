const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'exports.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.doesNotMatch(hub, /ensureExportModalStyles/, 'export modal styles must not be injected at runtime');
assert.match(css, /\.fpt-fin-export-overlay\s*\{/, 'export overlay rules must live in the shared stylesheet');
assert.match(css, /\.fpt-fin-export-dialog\s*\{/, 'export dialog rules must live in the shared stylesheet');

const requiredTokens = [
    '--fptm-surface',
    '--fptm-surface-2',
    '--fptm-field',
    '--fptm-border',
    '--fptm-text',
    '--fptm-muted',
    '--fptm-accent',
    '--fptm-accent-soft',
    '--fptm-on-accent'
];
for (const token of requiredTokens) {
    assert.ok(css.includes(`var(${token}`), `export styles must use ${token}`);
}

assert.doesNotMatch(hub, /#1a1c23|#21242d|#14161d|#2e3342|#282c37|#242834|#33394a/, 'export implementation must not retain the old hardcoded dark surface palette');
const jsonButtonRule = css.match(/\.fpt-fin-export-btn-json\s*\{([^}]+)\}/);
assert.ok(jsonButtonRule, 'JSON export button must have a dedicated theme-aware rule');
assert.match(jsonButtonRule[1], /color:\s*var\(--fptm-on-accent,\s*#fff\)/, 'JSON export button text must use the theme contrast color for its accent background');

const themeHelper = hub.match(/function applyFinanceThemeToExportOverlay\(overlay\)[\s\S]*?\n\s{12}\}/);
assert.ok(themeHelper, 'body-level export overlay must receive computed Finance theme variables');
for (const token of requiredTokens) {
    assert.ok(themeHelper[0].includes(token), `theme propagation must copy ${token}`);
}

const openStart = hub.indexOf('function openExportModal()');
const openEnd = hub.indexOf('\n        return {', openStart);
assert.ok(openStart >= 0 && openEnd > openStart, 'export modal lifecycle functions must exist');
const openModal = hub.slice(openStart, openEnd);
const propagateAt = openModal.indexOf('applyFinanceThemeToExportOverlay(overlay)');
const appendAt = openModal.indexOf('document.body.appendChild(overlay)');
assert.ok(propagateAt >= 0 && appendAt > propagateAt, 'theme variables must be copied before the overlay is shown');

console.log('T20_EXPORT_MODAL_THEME_INTEGRATION_PASS');
