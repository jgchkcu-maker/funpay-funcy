const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(hub, /function enhanceFinanceCustomSelect\(select\)/, 'Finance filters must use a custom select enhancer');
assert.match(hub, /className = 'fpt-fin-select-dropdown'/, 'custom select must render its own dropdown panel');
assert.match(hub, /className = 'fpt-fin-select-option'/, 'custom dropdown must render accessible option buttons');
assert.match(hub, /select\.dispatchEvent\(changeEvent\)/, 'custom option selection must preserve native select change logic');
assert.match(hub, /MutationObserver/, 'dynamic status/category options must resync into the custom list');
assert.match(hub, /opens-up/, 'custom popup should avoid clipping near the bottom edge');
assert.match(hub, /ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End/, 'custom dropdown must support keyboard navigation');

assert.match(css, /\.fpt-fin-select-dropdown\s*\{[\s\S]*?border-radius:\s*14px/, 'dropdown panel must be a rounded rectangle');
assert.match(css, /\.fpt-fin-select-list::-webkit-scrollbar-thumb\s*\{[\s\S]*?border-radius:\s*999px/, 'scroll thumb must be oval');
assert.match(css, /\.fpt-fin-select-list\s*\{[\s\S]*?max-height:\s*264px/, 'dropdown must scroll instead of growing indefinitely');
assert.match(css, /\.fpt-fin-select-shell > select\.fpt-fin-native-select/, 'native select stays hidden as the data source');
assert.match(css, /\.fpt-fin-select-option\.is-selected/, 'selected option needs a dedicated state');

new Function(hub);
console.log('FINANCE_CUSTOM_SELECT_DROPDOWN_PASS');
