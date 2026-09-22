const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const overviewStart = popup.indexOf('<div class="fpt-fin-tab-pane active" data-subtab="overview">');
const overviewEnd = popup.indexOf('<!-- Subtab: Продажи -->', overviewStart);
assert.ok(overviewStart >= 0 && overviewEnd > overviewStart, 'Finance overview markup must exist');
const overview = popup.slice(overviewStart, overviewEnd);

const expectedTargets = [
    'sales', 'profit', 'sales', 'sales',
    'potential', 'potential', 'potential', 'potential'
];
const interactiveCards = overview.match(/class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi"[^>]*data-finance-overview-target="[^"]+"/g) || [];
assert.equal(interactiveCards.length, 8, 'All eight overview KPI cards must expose the shared interactive-card contract');
assert.deepEqual(
    interactiveCards.map(card => card.match(/data-finance-overview-target="([^"]+)"/)[1]),
    expectedTargets,
    'Overview KPI cards must route each metric to its relevant Finance subtab'
);
assert.equal((overview.match(/fpt-fin-kpi-arrow/g) || []).length, 8, 'Each interactive overview KPI must visually signal navigation');
assert.equal((overview.match(/role="button" tabindex="0"/g) || []).length, 8, 'Each interactive overview KPI must be keyboard reachable');

const bindStart = hub.indexOf('function bindOverviewKpiActions(pane)');
const bindEnd = hub.indexOf('async function renderOverviewSubtab', bindStart);
assert.ok(bindStart >= 0 && bindEnd > bindStart, 'Overview KPI action binder must exist');
const bindBlock = hub.slice(bindStart, bindEnd);
assert.match(bindBlock, /addEventListener\('click'/, 'Overview KPIs must open their target subtab on click');
assert.match(bindBlock, /addEventListener\('keydown'/, 'Overview KPIs must support keyboard activation');
assert.match(bindBlock, /onSubtabChange\(target,\s*state\.activeSubtab\)/, 'Overview KPI activation must reuse the normal subtab transition');
assert.match(hub, /bindOverviewKpiActions\(pane\)/, 'Overview KPI actions must bind after rendering');

assert.match(css, /\.fpt-fin-overview-kpi:hover\s*\{[\s\S]*?transform:/, 'Interactive KPI hover must provide a clear visual response');
assert.match(css, /\.fpt-fin-overview-kpi:focus-visible\s*\{[\s\S]*?outline:/, 'Interactive KPIs must expose keyboard focus');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fpt-fin-overview-kpi/, 'Interactive KPI motion must respect reduced-motion preferences');

console.log('FINANCE_OVERVIEW_KPI_CARDS_PASS');
