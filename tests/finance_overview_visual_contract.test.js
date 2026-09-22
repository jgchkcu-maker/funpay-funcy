const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');

const overviewStart = popup.indexOf('<!-- Subtab: Обзор -->');
const overviewEnd = popup.indexOf('<!-- Subtab: Продажи -->', overviewStart);
assert.ok(overviewStart >= 0 && overviewEnd > overviewStart, 'overview pane markup must be present');
const overview = popup.slice(overviewStart, overviewEnd);

const overviewCards = overview.match(/class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi[^"]*"/g) || [];
assert.equal(overviewCards.length, 8, 'overview must expose eight redesigned KPI cards');
assert.equal((overview.match(/fpt-fin-kpi-icon(?:\s|"|$)/g) || []).length, 8, 'each overview KPI needs an icon tile');
assert.equal((overview.match(/fpt-fin-kpi-more/g) || []).length, 8, 'each overview KPI needs a compact menu affordance');
assert.equal((overview.match(/fpt-fin-kpi-chevron/g) || []).length, 8, 'each overview KPI needs a navigation chevron');
assert.equal((overview.match(/fpt-fin-kpi-sparkline(?:\s|"|$)/g) || []).length, 8, 'each overview KPI needs a lightweight trend affordance');
assert.match(overview, /role="button" tabindex="0"/, 'overview KPI cards must be keyboard reachable');

assert.match(css, /\.fpt-fin-overview-kpi\s*\{[\s\S]*?border-radius:\s*15px;[\s\S]*?overflow:\s*hidden;/, 'overview cards need the soft rounded surface treatment');
assert.match(css, /\.fpt-fin-overview-kpi\s*\.fpt-fin-kpi-icon\s*\{[\s\S]*?width:\s*35px;[\s\S]*?height:\s*35px;/, 'overview icon tiles need a stable 35px footprint');
assert.match(css, /\.fpt-fin-overview-kpi:hover\s*\{[\s\S]*?transform:\s*translateY\(-2px\);/, 'overview cards need a visible hover state');
assert.match(css, /\.fpt-fin-overview-kpi:focus-visible\s*\{[\s\S]*?outline:/, 'overview cards need a visible keyboard focus state');
assert.match(css, /\.fpt-fin-overview-kpi\s+\.fpt-fin-kpi-sparkline\s*\{[\s\S]*?pointer-events:\s*none;/, 'trend affordances must stay decorative and non-interactive');
assert.match(css, /@container \(max-width: 720px\)[\s\S]*?\.fpt-fin-overview-kpi\s+\.fpt-fin-card-header/, 'overview card rhythm must adapt at the tablet breakpoint');

assert.match(hub, /function bindOverviewKpiKeyboard\(pane\)/, 'overview cards need keyboard activation wiring');
assert.match(hub, /bindOverviewKpiKeyboard\(pane\);/, 'overview keyboard wiring must run after rendering');

new Function(hub);
console.log('FINANCE_OVERVIEW_VISUAL_CONTRACT_PASS');
