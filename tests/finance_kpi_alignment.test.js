const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');

const kpiCards = popup.match(/class="fpt-fin-card fpt-fin-kpi-card(?: fpt-fin-overview-kpi)?"/g) || [];
assert.equal(kpiCards.length, 28, 'All six Finance metric groups must keep the shared KPI card contract');

assert.match(
    css,
    /\.fpt-fin-kpi-card > \.fpt-fin-card-header\s*\{[\s\S]*?min-height:\s*29px;[\s\S]*?align-items:\s*flex-start;/,
    'Desktop/tablet KPI headers must reserve the same two-line heading track'
);

assert.match(
    css,
    /\.fpt-fin-kpi-card > \.fpt-fin-card-header > \.fpt-fin-card-title\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;/,
    'KPI titles must shrink inside the header without pushing the icon outside the card'
);

assert.match(
    css,
    /\.fpt-fin-kpi-card > \.fpt-fin-card-header > \.material-symbols-rounded\s*\{[\s\S]*?flex:\s*0 0 auto;/,
    'KPI header icons must keep a stable width'
);

assert.match(
    css,
    /\.fpt-fin-kpi-card > \.fpt-fin-skeleton-text:last-child\s*\{[\s\S]*?margin-top:\s*auto;/,
    'Loading KPI footers must align to the same bottom row as loaded cards'
);

assert.match(
    css,
    /@container \(max-width: 480px\)[\s\S]*?\.fpt-fin-kpi-card > \.fpt-fin-card-header\s*\{[\s\S]*?min-height:\s*auto;[\s\S]*?align-items:\s*center;/,
    'Single-column mobile KPI cards must return to intrinsic header height'
);

assert.doesNotMatch(
    css,
    /\.fpt-fin-col-(?:3|4|6|8|12)\s*\{[^}]*display:\s*flex;/,
    'Finance grid columns must not become broad flex containers'
);

assert.match(
    hub,
    /return \`\$\{formatted\}\\u00A0\$\{sym\}\`;/,
    'Money labels must keep the amount and currency symbol together instead of orphaning the symbol'
);

new Function(hub);
console.log('FINANCE_KPI_ALIGNMENT_PASS');
