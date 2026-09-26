const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

const popup = read('content/ui/main_popup.js');
const css = read('css/content_styles.css');
const filters = read('content/features/finance_hub/filters.js');
const profit = read('content/features/finance_hub/profit.js');
const operations = read('content/features/finance_hub/operations.js');
const sales = read('content/features/finance_hub/sales.js');
const purchases = read('content/features/finance_hub/purchases.js');

const pageStart = popup.indexOf('<div class="fp-tools-page-content" data-page="finance_hub">');
const pageEnd = popup.indexOf('<div class="fp-tools-page-content" data-page="piggy_banks">', pageStart);
assert.ok(pageStart >= 0 && pageEnd > pageStart, 'Finance Hub page must exist');
const page = popup.slice(pageStart, pageEnd);

assert.match(page, /<header class="fpt-ui-page-header fpt-fin-header">/, 'Finance Hub uses the shared page header');
assert.doesNotMatch(page, /class="fpt-fin-badge"/, 'redundant Hub badge is removed');
assert.match(page, /id="fptFinRefreshBtn" class="fpt-ui-button fpt-ui-button--secondary fpt-ui-icon-button fpt-fin-refresh-btn"/, 'refresh is a compact icon action');
assert.match(page, /id="fptFinExportBtn" class="fpt-ui-button fpt-ui-button--tertiary fpt-fin-export-btn"/, 'export is a tertiary action');
assert.match(page, /class="fpt-ui-segmented fpt-fin-subtabs"/, 'Finance subtabs use the shared segmented family');
assert.doesNotMatch(page, />show_chart</, 'Finance Hub contains no fake static chart glyphs');
assert.doesNotMatch(page, />more_vert</, 'Finance Hub contains no fake overflow-menu glyphs');

assert.match(page, /data-fin-control="snapshot"/, 'Potential has a static snapshot control');
assert.match(page, /id="fptFinPeriodSnapshotBadge"/, 'Potential snapshot keeps the expected hook');
assert.match(page, /<span class="fpt-fin-filter-label">Период<\/span>[\s\S]*?Текущий снимок/, 'snapshot follows label + control grammar');

assert.match(page, /<details class="fpt-ui-surface fpt-fin-additional-settings">/, 'legacy Finance settings are collapsed away from analytics');
assert.match(page, /<strong>Настройки финансов<\/strong>/, 'legacy settings have a clear boundary title');
for (const id of ['showSalesStatsCheckbox', 'showFinanceStatsCheckbox']) {
    assert.match(page, new RegExp('id="' + id + '"'), 'legacy setting ID remains: ' + id);
}

assert.match(popup, /finance[^\n]*pages:\s*Object\.freeze\(\['finance_hub', 'piggy_banks', 'calculator'\]\)/, 'all Finance routes belong to the Finance nav section');
assert.match(popup, /function switchSubtab\(target, persistMode = true\)[\s\S]*?showSectionForPage\('finance_hub'\)/, 'Finance subtab changes resynchronise the active sidebar section');
assert.match(popup, /if \(navSections && typeof navSections\.showSectionForPage === 'function'\) navSections\.showSectionForPage\(targetPageId\);/, 'central routing synchronises sidebar before page activation');

assert.match(filters, /const snapshotControl = container\.querySelector\('\[data-fin-control="snapshot"\]'\) \|\| snapshotBadge;/, 'filters address the snapshot through its normal control wrapper');
assert.match(filters, /setFinanceControlVisible\(snapshotControl, isPotential, 'flex'\);/, 'Potential toggles the snapshot control instead of creating a special tile');
assert.doesNotMatch(filters, /snapshotBadge\.innerHTML[\s\S]*?material-symbols-rounded/, 'filters no longer build a styled snapshot tile at runtime');

assert.match(profit, /<tr class="fpt-fin-empty-row"><td colspan="8"><div class="fpt-ui-state fpt-fin-table-empty"/, 'Profit empty state spans the complete eight-column table');
assert.doesNotMatch(profit, /<td colspan="8" class="fpt-fin-empty-state"/, 'Profit does not turn one table cell into a flex empty-state container');
assert.match(profit, /class="fpt-fin-status-badge fpt-fin-status-success">Закрыт/, 'Profit status uses the shared status badge');

assert.match(operations, /fpt-ui-state fpt-fin-visual-empty/, 'Operations zero states use compact visualization states');
assert.doesNotMatch(operations, /fpt-fin-empty-state" style="padding:28px 16px/, 'Operations zero states do not hard-code giant padding');
assert.match(operations, /fpt-ui-button fpt-ui-button--secondary fpt-fin-cur-select-btn/, 'Operations currency choices use shared buttons');

assert.match(sales, /classList\.toggle\('fpt-fin-primary-full', !hasCategoryBreakdown\)/, 'Sales expands the main chart when side analytics is empty');
assert.match(sales, /classList\.toggle\('fpt-fin-secondary-empty', !hasCategoryBreakdown\)/, 'Sales hides an empty side breakdown');
assert.match(purchases, /setSideAnalyticsVisible\(false\)/, 'Purchases hides an empty seller breakdown');
assert.match(purchases, /fpt-fin-primary-full/, 'Purchases expands the main chart when side analytics is empty');
assert.match(purchases, /fpt-ui-segmented fpt-fin-chart-toggles/, 'dynamic Purchases local modes use the segmented family');

const taskStart = css.indexOf('FINANCE HUB UI — TASK 08');
assert.ok(taskStart >= 0, 'TASK 08 CSS exists');
const taskCss = css.slice(taskStart);
assert.match(taskCss, /\.fpt-fin-subtabs-indicator\s*\{[\s\S]*?display:\s*none !important;/, 'old liquid indicator is retired');
assert.match(taskCss, /\.fpt-fin-snapshot-badge\s*\{[\s\S]*?height:\s*var\(--fpt-ui-control-h\)/, 'snapshot matches neighbouring control height');
assert.match(taskCss, /\.fpt-fin-empty-state,[\s\S]*?border:\s*0;/, 'empty visualization states do not nest dashed cards');
assert.match(taskCss, /#fptFinProfitTable\s*\{[\s\S]*?min-width:\s*860px;/, 'Profit table keeps enough width for Status');
assert.match(taskCss, /\.fpt-fin-col-8\.fpt-fin-primary-full\s*\{[\s\S]*?grid-column:\s*span 12;/, 'primary chart can reclaim full row');
assert.match(taskCss, /\.fpt-fin-col-4\.fpt-fin-secondary-empty\s*\{[\s\S]*?display:\s*none;/, 'empty secondary chart is removed from layout');

new Function(popup);
new Function(filters);
new Function(profit);
new Function(operations);
new Function(sales);
new Function(purchases);
console.log('FINANCE_TASK08_UI_CONTRACT_PASS');
