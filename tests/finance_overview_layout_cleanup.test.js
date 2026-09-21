const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const financeData = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');

assert.match(css, /\.fpt-fin-header\s*\{[\s\S]*?border-bottom:\s*0\s*;/, 'Finance header must not draw a redundant separator');
assert.match(css, /\.fpt-fin-title\s*\{[\s\S]*?padding-bottom:\s*0\s*!important;[\s\S]*?border-bottom:\s*0\s*!important;/, 'Finance title must override the global h3 underline');
assert.match(css, /\.fpt-fin-filterbar \.fpt-fin-period-wrap\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'Overview filters must align to four equal columns');
assert.match(css, /\.fpt-fin-filterbar \.fpt-fin-period-wrap[\s\S]*?gap:\s*12px/, 'Filter gap must match card grid gap');
assert.match(financeData, /badgeHtml:\s*''/, 'Unavailable KPI comparisons must not render gray placeholder strips');
assert.match(financeData, /к пред\. периоду/, 'Available comparison label must be localized');

new Function(financeData);
console.log('FINANCE_OVERVIEW_LAYOUT_CLEANUP_PASS');
