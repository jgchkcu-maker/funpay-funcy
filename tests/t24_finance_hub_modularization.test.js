const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const featureDir = path.join(root, 'content', 'features');
const moduleDir = path.join(featureDir, 'finance_hub');
const moduleFiles = [
    'shared_ui.js',
    'filters.js',
    'exports.js',
    'overview.js',
    'sales.js',
    'purchases.js',
    'operations.js',
    'potential.js',
    'profit.js'
];
const modulePaths = moduleFiles.map(file => path.join(moduleDir, file));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const financeScripts = manifest.content_scripts.find(script => script.js.includes('content/features/finance_hub.js')).js;
const manifestModulePaths = modulePaths.map(file => path.relative(root, file).replace(/\\/g, '/'));

for (const file of modulePaths) {
    assert.ok(fs.existsSync(file), `Finance Hub module must exist: ${path.relative(root, file)}`);
}

const indexOf = file => financeScripts.indexOf(file);
const engines = [
    'content/features/finance_data.js',
    'content/features/finance_potential.js',
    'content/features/profit_engine.js'
];
for (const engine of engines) {
    assert.ok(indexOf(engine) >= 0, `${engine} must remain in the Finance content script`);
    for (const modulePath of manifestModulePaths) {
        assert.ok(indexOf(engine) < indexOf(modulePath), `${engine} must load before ${modulePath}`);
    }
}
for (let i = 0; i < manifestModulePaths.length; i += 1) {
    assert.ok(indexOf(manifestModulePaths[i]) >= 0, `${manifestModulePaths[i]} must load from manifest.json`);
    if (i > 0) {
        assert.ok(indexOf(manifestModulePaths[i - 1]) < indexOf(manifestModulePaths[i]), 'Finance Hub modules must keep their declared order');
    }
}
assert.ok(indexOf(manifestModulePaths.at(-1)) < indexOf('content/features/finance_hub.js'), 'the Finance Hub orchestrator must load after its modules');

const moduleSources = modulePaths.map(file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
for (let i = 0; i < moduleSources.length; i += 1) {
    assert.match(moduleSources[i], /FPTFinanceHubModules/, `${moduleFiles[i]} must register in FPTFinanceHubModules`);
    assert.match(moduleSources[i], /function\s+create[A-Za-z0-9_$]*\s*\(context\)/, `${moduleFiles[i]} must receive an explicit context object`);
}

const hubSource = fs.readFileSync(path.join(featureDir, 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
assert.match(hubSource, /FPTFinanceHubModules/, 'the orchestrator must compose registered Finance Hub modules');
assert.doesNotMatch(hubSource, /async\s+function\s+render(?:Overview|Sales|Purchases|Operations|Potential|Profit)Subtab\s*\(/, 'subtab rendering must live in responsibility modules');
assert.doesNotMatch(hubSource, /function\s+(?:setupHeaderFilters|openExportModal)\s*\(/, 'filter and export UI glue must live in responsibility modules');

const sandbox = { console, setTimeout, clearTimeout, Date, Math, Promise, Number, String, Object, Array, Map, Set, Error, JSON, Intl };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (let i = 0; i < modulePaths.length; i += 1) {
    vm.runInContext(moduleSources[i], sandbox, { filename: moduleFiles[i] });
}
vm.runInContext(hubSource, sandbox, { filename: 'finance_hub.js' });

const publicApi = sandbox.FPTFinanceHub;
assert.ok(publicApi, 'FPTFinanceHub must remain globally registered');
for (const method of [
    'init', 'onOpen', 'onSubtabChange', 'onPeriodChange', 'onCustomRangeApply', 'onCustomRangeReset',
    'onCurrencyChange', 'onStatusChange', 'onCategoryChange', 'onPageLeave', 'refresh', 'openExportModal',
    'closeExportModal', 'getDatasetForExport', 'exportFinanceData', 'renderOverviewSubtab', 'renderSalesSubtab',
    'renderPurchasesSubtab', 'renderOperationsSubtab', 'renderPotentialSubtab', 'renderProfitSubtab',
    'cleanupOverview', 'cleanupSales', 'cleanupPurchases', 'cleanupOperations', 'cleanupPotential', 'cleanupProfit',
    'getState', 'getMskParts', 'getMskDayKey', 'getMskMonthKey', 'getMskWeekKey', 'formatMskDateTime',
    'groupOrdersByStep', 'renderDynamicChart', 'operationFlowChart', 'renderOverviewDynamicChart',
    'formatLastUpdatedText', 'updateLastUpdatedText', 'resolvePreviousPeriodRange', 'formatKpiComparison', 'compareKpis'
]) {
    assert.equal(typeof publicApi[method], 'function', `FPTFinanceHub.${method} must remain available`);
}

for (const [file, symbol] of [
    ['finance_data.js', 'aggregateSales'],
    ['finance_potential.js', 'calculatePotentialAggregates'],
    ['profit_engine.js', 'calculateProfitAggregates']
]) {
    const engineSource = fs.readFileSync(path.join(featureDir, file), 'utf8');
    assert.match(engineSource, new RegExp(`\\b${symbol}\\b`), `${file} must retain ownership of ${symbol}`);
    for (let i = 0; i < moduleSources.length; i += 1) {
        assert.doesNotMatch(moduleSources[i], new RegExp(`function\\s+${symbol}\\s*\\(`), `${moduleFiles[i]} must not own ${symbol}`);
    }
}

console.log('T24_FINANCE_HUB_MODULARIZATION_PASS');
