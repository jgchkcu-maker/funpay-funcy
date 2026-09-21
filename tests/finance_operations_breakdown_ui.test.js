const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(hub, /Math\.round\(\(value \+ Number\.EPSILON\) \* 100\) \/ 100/, 'money formatter must preserve cents');
assert.match(hub, /maximumFractionDigits:\s*2/, 'money formatter must render up to two decimals');
assert.match(hub, /function renderOperationsNetBadges\(/, 'multi-currency operation values must render as separate badges');
assert.match(hub, /fpt-fin-operation-breakdown-card/, 'breakdown card must use dedicated layout class');
assert.match(hub, /fpt-fin-operation-type-chevron/, 'rows must expose a clear drill-down affordance');

assert.match(css, /\.fpt-fin-operation-types\s*\{[\s\S]*?margin:\s*0 -16px -16px/, 'operation list must extend to the full card width');
assert.match(css, /\.fpt-fin-operation-type-row[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto 20px/, 'row layout must reserve stable columns for value and chevron');
assert.match(css, /background:\s*transparent !important/, 'row must reset generic button background');
assert.match(css, /\.fpt-fin-operation-amount-badge\.is-negative/, 'negative currency badge styling must exist');
assert.match(css, /\.fpt-fin-operation-amount-badge\.is-positive/, 'positive currency badge styling must exist');

new Function(hub);
console.log('FINANCE_OPERATIONS_BREAKDOWN_UI_PASS');
