const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeDataSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const mainPopupSource = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');

function createFinanceData() {
    const databases = {
        FPTSalesDB: {
            getAllAsArray: async () => [
                { orderId: 'before', orderDate: '2026-09-19T20:59:59Z', orderStatus: 'closed', price: 1, currency: 'RUB' },
                { orderId: 'inside', orderDate: '2026-09-20T20:59:59Z', orderStatus: 'closed', price: 2, currency: 'RUB' },
                { orderId: 'after', orderDate: '2026-09-20T21:00:00Z', orderStatus: 'closed', price: 3, currency: 'RUB' }
            ]
        },
        FPTPurchasesDB: {
            getAllAsArray: async () => [
                { orderId: 'purchase-inside', orderDate: '2026-09-20T20:59:59Z', orderStatus: 'closed', price: 4, currency: 'RUB' },
                { orderId: 'purchase-after', orderDate: '2026-09-20T21:00:00Z', orderStatus: 'closed', price: 5, currency: 'RUB' }
            ]
        },
        FPTFinanceDB: {
            getAllAsArray: async () => [
                { id: 'operation-inside', date: '2026-09-20T20:59:59Z', status: 'complete', signed: 6, currency: 'RUB' },
                { id: 'operation-after', date: '2026-09-20T21:00:00Z', status: 'complete', signed: 7, currency: 'RUB' }
            ]
        }
    };
    const sandbox = {
        Date,
        Math,
        String,
        Number,
        Array,
        Object,
        Set,
        Map,
        Promise,
        Boolean,
        parseFloat,
        isNaN,
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}) },
        ...databases
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(financeDataSource, ctx, { filename: 'finance_data.js' });
    return ctx.FPTFinanceData;
}

function createFinanceHub() {
    const stored = new Map();
    const sandbox = {
        Date,
        Math,
        String,
        Number,
        Array,
        Object,
        Set,
        Map,
        Promise,
        Error,
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
        sessionStorage: {
            getItem: key => stored.has(key) ? stored.get(key) : null,
            setItem: (key, value) => stored.set(key, String(value)),
            removeItem: key => stored.delete(key)
        },
        FPTFinanceData: {
            getSales: async () => [],
            aggregateSales: () => ({ byCurrency: {}, byStatus: {}, count: 0, total: 0 })
        },
        FPTProfitEngine: { getRealisedProfit: async () => ({ orders: [], byCurrency: {} }) },
        FPTPotential: { getInventory: async () => [] }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(financeHubSource, ctx, { filename: 'finance_hub.js' });
    return {
        hub: ctx.FPTFinanceHub || ctx.fptFinanceHub,
        getStored: key => stored.get(key)
    };
}

async function testMskInclusiveCustomRangeFiltersAllHistoricalDatasets() {
    const finData = createFinanceData();
    const range = finData.resolvePeriodRange({ from: '2026-09-20', to: '2026-09-20' }, { useMsk: true });
    assert.equal(range.start, Date.parse('2026-09-19T21:00:00.000Z'), 'custom start is MSK midnight');
    assert.equal(range.end, Date.parse('2026-09-20T20:59:59.999Z'), 'custom end includes the complete MSK day');

    const options = { period: { from: '2026-09-20', to: '2026-09-20' }, useMsk: true };
    assert.deepEqual((await finData.getSales(options)).map(row => row.orderId), ['inside']);
    assert.deepEqual((await finData.getPurchases(options)).map(row => row.orderId), ['purchase-inside']);
    assert.deepEqual((await finData.getOperations(options)).map(row => row.id), ['operation-inside']);
}

function testHubPersistsCustomRangeAndReset() {
    const env = createFinanceHub();
    assert.equal(typeof env.hub.onCustomRangeApply, 'function', 'Finance Hub exposes custom range apply');
    assert.equal(typeof env.hub.onCustomRangeReset, 'function', 'Finance Hub exposes custom range reset');

    assert.equal(env.hub.onCustomRangeApply('2026-09-20', '2026-09-21'), true, 'valid custom range applies');
    assert.deepEqual(JSON.parse(JSON.stringify(env.hub.getState().period)), {
        period: 'custom',
        from: '2026-09-20',
        to: '2026-09-21',
        label: '20.09.2026 — 21.09.2026'
    });
    assert.deepEqual(JSON.parse(env.getStored('fpt_fin_last_period')), JSON.parse(JSON.stringify(env.hub.getState().period)), 'custom range is persisted as JSON');
    assert.equal(env.hub.onCustomRangeApply('2026-09-22', '2026-09-21'), false, 'reversed range is rejected');
    assert.equal(env.hub.onCustomRangeReset(), true, 'reset returns to the previous preset');
    assert.equal(env.hub.getState().period, '7d');
}

function testCustomRangeControlsExistInFinanceHubMarkup() {
    assert.match(mainPopupSource, /<option value="custom">Custom range…<\/option>/, 'period selector has Custom range option');
    for (const id of ['fptFinCustomFrom', 'fptFinCustomTo', 'fptFinCustomApplyBtn', 'fptFinCustomResetBtn']) {
        assert.match(mainPopupSource, new RegExp('id="' + id + '"'), id + ' exists in Finance Hub markup');
    }
    assert.match(financeHubSource, /PERIOD_STORAGE_KEY/, 'Finance Hub persists period state');
    assert.match(financeHubSource, /FPTPotential[\s\S]*getInventory\(\{ enrichPotential: true/, 'Potential remains snapshot-only');
}

async function runAll() {
    await testMskInclusiveCustomRangeFiltersAllHistoricalDatasets();
    testHubPersistsCustomRangeAndReset();
    testCustomRangeControlsExistInFinanceHubMarkup();
    console.log('T11_CUSTOM_DATE_RANGE_PASS');
}

runAll().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
