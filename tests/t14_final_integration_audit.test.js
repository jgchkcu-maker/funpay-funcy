const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const expectMatch = (source, pattern, message) => assert.match(source, pattern, message);

const background = read('background/background.js');
const financeData = read('content/features/finance_data.js');
const financeHub = read('content/features/finance_hub.js');
const profitEngine = read('content/features/profit_engine.js');
const potential = read('content/features/finance_potential.js');
const popup = read('content/ui/main_popup.js');
const exportStudio = read('content/features/export_studio.js');

// T14 audit: the source graph must retain the completed end-to-end contracts.
expectMatch(background, /request\.action === 'updateSales'/, 'sales refresh handler is present');
expectMatch(background, /request\.action === 'updatePurchases'/, 'purchases refresh handler is present');
expectMatch(background, /request\.action === 'updateFinance'/, 'operations refresh handler is present');
expectMatch(background, /await FPTFinanceDB\.replaceAll\(collected, \{ lastUpdate: now \}\)/, 'operations use atomic replacement');

for (const name of ['getSales', 'getPurchases', 'getOperations', 'aggregateSales', 'aggregatePurchases', 'aggregateOperations']) {
    expectMatch(financeData, new RegExp(`function ${name}\\(`), `Finance Data exposes ${name}`);
}
expectMatch(financeData, /const MSK_OFFSET_MS = 3 \* 3600 \* 1000/, 'Finance Data uses the MSK calendar model');
expectMatch(financeData, /function filterOrders\(/, 'order filtering is centralized');
expectMatch(financeData, /function filterOperations\(/, 'operation filtering is centralized');

expectMatch(profitEngine, /orders = await financeData\.getSales\(options\)/, 'profit reads Sales as its source');
expectMatch(profitEngine, /function calculateProfitAggregates\(/, 'profit aggregation is centralized');
expectMatch(potential, /async function getInventory\(options = \{\}\)/, 'Potential reads inventory');
expectMatch(potential, /calculateRowPotential/, 'Potential enriches stock and cost data');

expectMatch(financeHub, /runBackgroundUpdate\('updateSales'\)/, 'Hub refreshes Sales');
expectMatch(financeHub, /runBackgroundUpdate\('updateFinance'\)/, 'Hub refreshes Operations');
expectMatch(financeHub, /getInventory\(\{ enrichPotential: true, forceRefresh: true \}\)/, 'Hub refreshes Inventory');
expectMatch(financeHub, /Promise\.allSettled\(\[/, 'Overview handles independent partial refreshes');
expectMatch(financeHub, /Обновлено частично/, 'Overview reports partial refresh failure');
expectMatch(financeHub, /FPTExportStudio\.financeExport|studio\.financeExport/, 'Hub delegates export to Export Studio');
expectMatch(financeHub, /fptFinCustomRange/, 'Hub wires custom periods');
expectMatch(financeHub, /function openDrilldown\(/, 'Hub wires drill-down');
expectMatch(financeHub, /function onOpen\(\)/, 'Hub owns reopen behavior');
expectMatch(financeHub, /fpt-fin-skeleton/, 'Hub renders loading states');
expectMatch(financeHub, /fpt-fin-empty-state/, 'Hub renders empty and error states');

expectMatch(popup, /window\.fptFinanceHub\.init\(finPage\)/, 'Popup mounts the Hub');
expectMatch(popup, /window\.fptFinanceHub\.onOpen\(\)/, 'Popup reopens the Hub');
expectMatch(exportStudio, /financeExport/, 'Export Studio exposes the Finance export facade');

console.log('T14_FINAL_INTEGRATION_AUDIT_PASS');
