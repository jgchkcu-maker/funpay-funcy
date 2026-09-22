const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

assert.match(popup, /id="fptFinProfitCostWarning"[\s\S]*?fpt-fin-profit-cost-warning/, 'profit pane must include the missing-cost warning slot');
assert.match(hub, /function renderProfitMissingCostWarning\(pane, totals, currency\)/, 'missing-cost warning renderer must exist');
assert.match(hub, /const shouldShow = eligible > 0 && known === 0;/, 'warning must appear only when there are eligible orders but zero usable cost bases');
assert.match(hub, /Нет заказов с указанной себестоимостью/, 'warning must explain the missing cost basis');
assert.match(hub, /прибыль, маржинальность и ROI/i, 'warning must explain which metrics cannot be calculated');
assert.match(hub, /currencyMismatchCount/, 'warning must distinguish currency mismatch from truly missing cost basis');

const chartStart = hub.indexOf('function renderProfitChart');
const chartEnd = hub.indexOf('function renderProfitTable', chartStart);
const chart = hub.slice(chartStart, chartEnd);
assert.doesNotMatch(chart, /color:\s*#fff/, 'profit summary must not hardcode white text');
assert.match(chart, /fpt-fin-profit-summary-value/, 'profit summary must use semantic theme-aware classes');

assert.match(css, /\.fpt-fin-profit-summary-value\s*\{[\s\S]*?color:\s*var\(--fptm-text/, 'profit summary values must follow the active theme text color');
assert.match(css, /\.fpt-fin-profit-summary-row\.is-total\s*\{[\s\S]*?border-top:\s*1px solid var\(--fptm-border/, 'profit total separator must follow theme borders');
assert.match(css, /\.fpt-fin-profit-cost-warning\s*\{[\s\S]*?color:\s*var\(--fptm-text/, 'warning text must follow the active theme');

new Function(hub);
new Function(popup);
console.log('FINANCE_PROFIT_MISSING_COST_UI_PASS');
