const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(hub, /function syncFinancePortalTheme\(portal\)/, 'portal theme synchronizer must exist');
assert.match(hub, /state\.container\.closest\('\.fp-tools-popup'\)/, 'modal must inherit active popup theme');
assert.match(hub, /syncFinancePortalTheme\(overlay\);\s*document\.body\.appendChild\(overlay\);/, 'theme must be applied before mounting the body portal');
assert.match(hub, /role="dialog" aria-modal="true"/, 'operations modal must expose dialog semantics');
assert.match(hub, /material-symbols-rounded" aria-hidden="true">close</, 'close button must use the standard icon');
assert.match(hub, /event\.key === 'Escape'/, 'Escape must close the modal');
assert.match(hub, /previouslyFocused\.focus/, 'closing must restore focus');

assert.match(css, /\.fpt-fin-operations-dialog\s*\{[\s\S]*?background:\s*var\(--fptm-bg, #fff\)/, 'dialog must use theme background');
assert.match(css, /\.fpt-fin-operations-close\s*\{[\s\S]*?all:\s*unset[\s\S]*?border-radius:\s*9px/, 'close control must reset host button styles');
assert.match(css, /\.fpt-fin-operations-tools select\s*\{[\s\S]*?color-scheme:\s*inherit/, 'native sort menu must follow current light/dark theme');
assert.doesNotMatch(css, /\.fpt-fin-operations-tools select\s*\{[^}]*color-scheme:\s*dark/, 'operations sort must not force dark mode');

console.log('FINANCE_OPERATIONS_MODAL_THEME_PASS');
