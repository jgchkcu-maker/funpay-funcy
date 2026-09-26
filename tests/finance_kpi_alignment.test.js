const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'shared_ui.js'), 'utf8').replace(/\r\n/g, '\n');

const kpiCards = popup.match(/class="[^"]*\bfpt-fin-kpi-card\b[^"]*"/g) || [];
assert.equal(kpiCards.length, 28, 'All Finance metric groups must keep the shared KPI card contract');

const taskStart = css.indexOf('FINANCE HUB UI — TASK 08');
assert.ok(taskStart >= 0, 'TASK 08 Finance CSS must exist');
const taskCss = css.slice(taskStart);

assert.match(
    taskCss,
    /\.fpt-fin-kpi-card > \.fpt-fin-card-header\s*\{[\s\S]*?min-height:\s*36px;[\s\S]*?align-items:\s*flex-start;/,
    'Finance KPI headers reserve one common two-line heading track'
);

assert.match(
    taskCss,
    /\.fpt-fin-kpi-card \.fpt-fin-card-title\s*\{[\s\S]*?max-height:\s*2\.6em;[\s\S]*?white-space:\s*normal !important;[\s\S]*?text-overflow:\s*clip !important;/,
    'KPI titles wrap to two lines instead of ellipsizing'
);

assert.match(
    taskCss,
    /\.fpt-fin-overview-kpi \.fpt-fin-card-header\s*\{[\s\S]*?grid-template-columns:\s*35px minmax\(0, 1fr\);/,
    'Overview KPIs no longer reserve a third fake-menu column'
);

assert.match(
    taskCss,
    /\.fpt-fin-overview-kpi \.fpt-fin-card-value\s*\{[\s\S]*?padding-left:\s*0 !important;/,
    'Overview KPI values align to the same left axis as their content'
);

assert.match(
    taskCss,
    /@container fpt-content \(max-width: 520px\)[\s\S]*?\.fpt-fin-kpi-card > \.fpt-fin-card-header\s*\{[\s\S]*?min-height:\s*auto;[\s\S]*?align-items:\s*flex-start;/,
    'Stacked mobile KPI cards return to intrinsic height without changing the top alignment model'
);

assert.doesNotMatch(
    css,
    /\.fpt-fin-col-(?:3|4|6|8|12)\s*\{[^}]*display:\s*flex;/,
    'Finance grid columns must not become broad flex containers'
);

assert.match(
    hub,
    /return `\$\{formatted\}\\u00A0\$\{sym\}`;/,
    'Money labels must keep the amount and currency symbol together instead of orphaning the symbol'
);

new Function(hub);
console.log('FINANCE_KPI_ALIGNMENT_PASS');
