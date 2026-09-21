const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(hub, /function syncFinanceCustomSelectScrollbar\(select\)/, 'custom dropdown must manage its own scrollbar thumb');
assert.match(hub, /fpt-fin-select-scrollbar-thumb/, 'custom scrollbar thumb DOM must exist');
assert.match(hub, /--fpt-fin-dropdown-shift/, 'dropdown must support viewport edge correction');
assert.match(hub, /rect\.right > window\.innerWidth - pad/, 'dropdown must clamp its right edge to the viewport');
assert.match(hub, /rect\.left \+ shift < pad/, 'dropdown must clamp its left edge to the viewport');
assert.match(hub, /pointermove/, 'oval custom thumb must be draggable');

assert.match(css, /\.fpt-fin-select-list\s*\{[\s\S]*?scrollbar-width:\s*none/, 'native list scrollbar must be hidden');
assert.match(css, /\.fpt-fin-select-list::-webkit-scrollbar\s*\{[\s\S]*?width:\s*0/, 'webkit native scrollbar including arrows must be removed');
assert.match(css, /\.fpt-fin-select-scrollbar-thumb\s*\{[\s\S]*?height:\s*36px[\s\S]*?border-radius:\s*999px/, 'custom thumb must be short and oval');
assert.match(css, /\.fpt-fin-select-scrollbar-thumb\s*\{[\s\S]*?--fptm-accent/, 'custom thumb must use the blue Finance accent');
assert.match(css, /max-width:\s*calc\(100vw - 24px\)/, 'dropdown must not exceed viewport width');
assert.match(css, /\.fpt-fin-filterbar[\s\S]*?overflow:\s*visible\s*!important/, 'filter parents must not clip the dropdown');

new Function(hub);
console.log('FINANCE_CUSTOM_SELECT_SCROLLBAR_BOUNDS_PASS');
