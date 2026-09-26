const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'overview.js'), 'utf8').replace(/\r\n/g, '\n');

const overviewStart = popup.indexOf('<!-- Subtab: Обзор -->');
const overviewEnd = popup.indexOf('<!-- Subtab: Продажи -->', overviewStart);
assert.ok(overviewStart >= 0 && overviewEnd > overviewStart, 'overview pane markup must be present');
const overview = popup.slice(overviewStart, overviewEnd);

const overviewCards = overview.match(/class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi[^"]*"/g) || [];
assert.equal(overviewCards.length, 8, 'overview must expose eight KPI cards');
assert.equal((overview.match(/fpt-fin-kpi-icon(?:\s|"|$)/g) || []).length, 8, 'each overview KPI keeps one meaningful icon tile');
assert.equal((overview.match(/fpt-fin-kpi-chevron/g) || []).length, 8, 'each clickable overview KPI keeps a navigation chevron');
assert.equal((overview.match(/fpt-fin-kpi-more/g) || []).length, 0, 'overview must not advertise fake per-card menus');
assert.equal((overview.match(/fpt-fin-kpi-sparkline/g) || []).length, 0, 'overview must not render decorative fake sparklines');
assert.doesNotMatch(overview, />show_chart</, 'overview must not use static show_chart glyphs as data visualization');
assert.doesNotMatch(overview, />more_vert</, 'overview must not use non-functional overflow-menu glyphs');
assert.match(overview, /role="button" tabindex="0"/, 'overview KPI cards must remain keyboard reachable');

const taskCssStart = css.indexOf('FINANCE HUB UI — TASK 08');
assert.ok(taskCssStart >= 0, 'TASK 08 Finance CSS must exist');
const taskCss = css.slice(taskCssStart);
assert.match(taskCss, /\.fpt-fin-overview-kpi \.fpt-fin-card-header\s*\{[\s\S]*?grid-template-columns:\s*35px minmax\(0, 1fr\);/, 'overview header uses icon + title only');
assert.match(taskCss, /\.fpt-fin-overview-kpi \.fpt-fin-card-value\s*\{[\s\S]*?padding-left:\s*0 !important;/, 'overview values share the card content axis');
assert.match(taskCss, /\.fpt-fin-kpi-card \.fpt-fin-card-title\s*\{[\s\S]*?white-space:\s*normal !important;[\s\S]*?overflow-wrap:\s*anywhere;/, 'long KPI titles may wrap without ellipsis');
assert.match(taskCss, /\.fpt-fin-kpi-sparkline,[\s\S]*?\.fpt-fin-kpi-more\s*\{[\s\S]*?display:\s*none !important;/, 'legacy fake affordances are defensively hidden');

assert.match(hub, /function bindOverviewKpiKeyboard\(pane\)/, 'overview cards need keyboard activation wiring');
assert.match(hub, /bindOverviewKpiKeyboard\(pane\);/, 'overview keyboard wiring must run after rendering');

new Function(hub);
console.log('FINANCE_OVERVIEW_VISUAL_CONTRACT_PASS');
