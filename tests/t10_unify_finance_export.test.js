const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFinanceHub } = require('./helpers/finance_hub_loader');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubExportSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'exports.js'), 'utf8').replace(/\r\n/g, '\n');
const exportStudioSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'export_studio.js'), 'utf8').replace(/\r\n/g, '\n');
const financeEngineSource = exportStudioSource.slice(exportStudioSource.indexOf('//  FP Tools — Finance Hub Verified Export Engine'));

function createHubEnv(sharedStudio) {
    const calls = [];
    const sales = [{ orderId: 's1', price: 100, currency: 'RUB', orderDate: 1700000000000 }];
    const purchases = [{ orderId: 'p1', price: 50, currency: 'RUB', orderDate: 1700000000000 }];
    const operations = [{ id: 'o1', amount: 10, signed: 10, currency: 'RUB', date: 1700000000000 }];
    const profitOrders = [{ orderId: 'pr1', price: 100, currency: 'RUB', orderDate: 1700000000000 }];
    const lots = [{ offerId: 'l1', sellerPrice: 100, buyerPrice: 120, currency: 'RUB', stockKind: 'unknown' }];

    const financeData = {
        getSales: async () => sales,
        getPurchases: async () => purchases,
        getOperations: async () => operations,
        aggregateSales: () => ({ count: 1, total: 100, byCurrency: { RUB: 100 } }),
        aggregatePurchases: () => ({ count: 1, total: 50, byCurrency: { RUB: 50 } }),
        aggregateOperations: () => ({ count: 1, inByCur: { RUB: 10 }, outByCur: {} }),
        getMeta: async () => ({ lastUpdate: 1700000000000 })
    };
    const profitEngine = {
        getRealisedProfit: async () => ({ orders: profitOrders, byCurrency: { RUB: { currency: 'RUB', realisedNetProfit: null } } }),
        calculateProfitAggregates: () => ({ currency: 'RUB', realisedNetProfit: null, knownCostOrdersCount: 0 })
    };
    const potential = {
        getInventory: async () => lots,
        calculatePotentialAggregates: () => ({ RUB: { finiteOffers: 0, knownPotentialProfit: null } }),
        calculateCurrencyTotals: () => ({ currency: 'RUB', finiteOffers: 0, knownPotentialProfit: null })
    };

    const sandbox = {
        window: {},
        document: {
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: () => null,
            createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
            addEventListener() {},
            removeEventListener() {}
        },
        sessionStorage: { getItem: () => null, setItem() {} },
        FPTFinanceData: financeData,
        FPTProfitEngine: profitEngine,
        FPTPotential: potential,
        FPTExportStudio: sharedStudio,
        console: { log() {}, warn() {}, error() {} },
        Date, Map, Set, String, Object, Array, Math, Error, Promise
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    loadFinanceHub(vm, sandbox);
    const hub = sandbox.FPTFinanceHub || sandbox.fptFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');
    return { hub, calls, sales, purchases, operations, profitOrders, lots };
}

function createSharedEngineContext() {
    const sandbox = {
        window: { FPTExportStudio: {} },
        console: { log() {}, warn() {}, error() {} },
        Date, String, Object, Array, Math, Number, Boolean, JSON, isNaN
    };
    vm.createContext(sandbox);
    vm.runInContext(financeEngineSource, sandbox, { filename: 'export_studio.finance_engine.js' });
    return sandbox.window.FPTExportStudio.financeExport;
}

async function testFinanceHubDelegatesToExportStudioEngine() {
    const calls = [];
    const sharedStudio = {
        financeExport: {
            download: (...args) => {
                calls.push(args);
                return { delegated: true, args };
            }
        }
    };
    const env = createHubEnv(sharedStudio);
    for (const dataset of ['sales', 'purchases', 'operations', 'profit', 'potential']) {
        await env.hub.exportFinanceData(dataset, 'json');
    }

    assert.deepEqual(calls.map(([dataset]) => dataset), ['sales', 'purchases', 'operations', 'profit', 'potential']);
    assert.ok(calls.every(([, format]) => format === 'json'));
    assert.equal(calls[0][2], env.sales, 'sales items pass through unchanged');
    assert.equal(calls[1][2], env.purchases, 'purchases items pass through unchanged');
    assert.equal(calls[2][2], env.operations, 'operations items pass through unchanged');
    assert.equal(calls[3][2], env.profitOrders, 'profit items pass through unchanged');
    assert.equal(calls[4][2], env.lots, 'potential items pass through unchanged');
}

function testFinanceHubHasNoCompetingSerializer() {
    assert.doesNotMatch(financeHubSource, /function\s+buildCSV\s*\(/, 'Finance Hub must not define buildCSV');
    assert.doesNotMatch(financeHubSource, /function\s+buildJSON\s*\(/, 'Finance Hub must not define buildJSON');
    assert.doesNotMatch(financeHubSource, /JSON\.stringify\s*\(/, 'Finance Hub must not serialize JSON');
    assert.match(financeHubExportSource, /FPTExportStudio[\s\S]*?financeExport/, 'Finance Hub export module must reference Export Studio finance facade');
}

function testUnknownCostAndProfitRemainNull() {
    const engine = createSharedEngineContext();
    const raw = [{ orderId: 'x1', price: 100, currency: 'RUB', profitInfo: { hasCost: false } }];
    const totals = { currency: 'RUB', realisedCost: null, realisedNetProfit: null, margin: null, roi: null };
    const json = JSON.parse(engine.buildJSON('profit', raw, totals, { currency: 'RUB' }));
    assert.equal(json.items[0].costBasis, null, 'unknown cost is null in JSON');
    assert.equal(json.items[0].profit, null, 'unknown profit is null in JSON');
    const csv = engine.buildCSV('profit', raw, totals, { currency: 'RUB' });
    assert.match(csv, /null/, 'unknown cost/profit are literal null in CSV');

    const potential = engine.buildJSON('potential', [{ offerId: 'l1', sellerPrice: 100, currency: 'RUB', stockKind: 'unknown' }], {
        currency: 'RUB', knownInventoryCost: null, knownPotentialProfit: null, knownMargin: null, knownRoi: null
    }, { currency: 'RUB' });
    const potentialJson = JSON.parse(potential);
    assert.equal(potentialJson.items[0].costBasis, null, 'potential unknown cost is null');
    assert.equal(potentialJson.items[0].profit, null, 'potential unknown profit is null');
}

async function runAll() {
    await testFinanceHubDelegatesToExportStudioEngine();
    testFinanceHubHasNoCompetingSerializer();
    testUnknownCostAndProfitRemainNull();
    console.log('T10_UNIFY_FINANCE_EXPORT_PASS');
}

runAll().catch(error => {
    console.error('T10_UNIFY_FINANCE_EXPORT_FAIL:', error);
    process.exit(1);
});
