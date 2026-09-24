const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFinanceHub } = require('./helpers/finance_hub_loader');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubFiltersSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'filters.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubExportsSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'exports.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubOverviewSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'overview.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubRendererSource = ['sales', 'purchases', 'operations', 'potential', 'profit']
    .map(name => fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', `${name}.js`), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ КОНТРАКТА В ИСХОДНОМ КОДЕ (T04)
// ─────────────────────────────────────────────────────────────────────────────

function runStaticContractChecks() {
    // 1. Separate state declarations
    assert.match(financeHubSource, /orderStatus:\s*['"]all['"]/, 'state must declare orderStatus');
    assert.match(financeHubSource, /operationStatus:\s*['"]all['"]/, 'state must declare operationStatus');
    assert.match(financeHubSource, /status:\s*['"]all['"]/, 'state must keep status for backward compatibility');

    // 2. updateStatusSelectOptions presence and logic
    assert.match(financeHubFiltersSource, /function updateStatusSelectOptions\(subtab\)/, 'updateStatusSelectOptions must exist');
    assert.match(financeHubFiltersSource, /setFinanceControlVisible\(statusControl,\s*!isPotential\)/, 'potential tab must hide the complete status wrapper through the shared visibility contract');
    assert.match(financeHubFiltersSource, /value=["']complete["']/, 'operations options must include complete');
    assert.match(financeHubFiltersSource, /value=["']cancel["']/, 'operations options must include cancel');
    assert.match(financeHubFiltersSource, /value=["']waiting["']/, 'operations options must include waiting');
    assert.match(financeHubFiltersSource, /value=["']closed["']/, 'order options must include closed');
    assert.match(financeHubFiltersSource, /value=["']paid["']/, 'order options must include paid');
    assert.match(financeHubFiltersSource, /value=["']refunded["']/, 'order options must include refunded');

    // 3. Subtab rendering logic
    assert.match(financeHubRendererSource, /filterOpts\.statuses\s*=\s*state\.orderStatus/, 'sales/purchases/profit must use state.orderStatus');
    assert.match(financeHubRendererSource, /filterOpts\.statuses\s*=\s*state\.operationStatus/, 'operations must use state.operationStatus');

    // 4. Overview domain isolation
    assert.match(financeHubOverviewSource, /async\s+function\s+renderOverviewSubtab\(/, 'renderOverviewSubtab function found');
    const overviewCode = financeHubOverviewSource;
    assert.ok(!overviewCode.includes('opsFilter.statuses = state.orderStatus'), 'overview must NOT pass orderStatus to operations filter');
    assert.ok(!overviewCode.includes('opsFilter.statuses = state.status'), 'overview must NOT pass status to operations filter');

    // 5. Export domain isolation
    assert.match(financeHubExportsSource, /orderStatus:\s*state\.orderStatus/, 'export meta must include orderStatus');
    assert.match(financeHubExportsSource, /operationStatus:\s*state\.operationStatus/, 'export meta must include operationStatus');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ДИНАМИЧЕСКИЕ ТЕСТЫ В VM
// ─────────────────────────────────────────────────────────────────────────────

function createMockElement(id = '', classes = []) {
    const classSet = new Set(classes);
    const attributes = {};
    const style = {};
    const el = {
        id,
        disabled: false,
        textContent: '',
        innerHTML: '',
        value: '',
        dataset: {},
        options: [],
        style,
        classList: {
            add: (c) => classSet.add(c),
            remove: (c) => classSet.delete(c),
            toggle: (c, force) => {
                const shouldAdd = force === undefined ? !classSet.has(c) : Boolean(force);
                if (shouldAdd) classSet.add(c);
                else classSet.delete(c);
                return shouldAdd;
            },
            contains: (c) => classSet.has(c)
        },
        querySelectorAll: () => [],
        querySelector: () => createMockElement(),
        closest: () => el,
        removeAttribute: (name) => { delete attributes[name]; },
        setAttribute: (name, val) => { attributes[name] = String(val); },
        getAttribute: (name) => attributes[name],
        addEventListener: () => {},
        removeEventListener: () => {},
        contains: () => false,
        remove: () => {},
        replaceWith: () => {}
    };
    return el;
}

function setupHubEnv(customHandlers = {}) {
    const calls = {
        sales: [],
        purchases: [],
        operations: [],
        profit: []
    };

    const finDataMock = {
        getSales: async (opts) => {
            calls.sales.push(opts);
            return [{ id: 's1', price: 100, currency: 'RUB', status: opts && opts.statuses ? opts.statuses : 'closed' }];
        },
        aggregateSales: () => ({ totalRevenue: 100, byCurrency: { RUB: 100 } }),
        getPurchases: async (opts) => {
            calls.purchases.push(opts);
            return [{ id: 'p1', price: 50, currency: 'RUB', status: opts && opts.statuses ? opts.statuses : 'closed' }];
        },
        aggregatePurchases: () => ({ totalSpend: 50, byCurrency: { RUB: 50 } }),
        getOperations: async (opts) => {
            calls.operations.push(opts);
            return [{ id: 'op1', signed: 100, currency: 'RUB', status: opts && opts.statuses ? opts.statuses : 'complete' }];
        },
        aggregateOperations: () => ({ list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 }),
        getMeta: async () => ({ lastUpdate: 1700000000000 })
    };

    const potentialMock = {
        getInventory: async () => [{ lotId: '1', price: 100, category: 'test' }],
        calculatePotentialAggregates: () => ({ RUB: { totalPotential: 500 } }),
        calculateRowPotential: () => ({ profit: 10 }),
        calculateCurrencyTotals: () => ({ currency: 'RUB', knownPotentialProfit: 100 })
    };

    const profitMock = {
        getRealisedProfit: async (opts) => {
            calls.profit.push(opts);
            return { orders: [{ orderId: '1', price: 100 }], byCurrency: { RUB: { profit: 50, currency: 'RUB' } } };
        },
        calculateProfitAggregates: () => ({ totals: { currency: 'RUB', realisedNetProfit: 50 } })
    };

    const root = {
        showNotification: () => {},
        FPTFinanceData: Object.assign(finDataMock, customHandlers.finData),
        FPTPotential: Object.assign(potentialMock, customHandlers.potential),
        FPTProfitEngine: Object.assign(profitMock, customHandlers.profit),
        FPTPurchasesConfig: { updateAction: 'updatePurchases' },
        FPTFinanceExport: {
            download: (ds, format, items, totals, meta) => ({ ds, format, items, totals, meta })
        }
    };

    // Container DOM elements
    const periodWrap = createMockElement('', ['fpt-fin-period-wrap']);
    const periodSelect = createMockElement('fptFinPeriodSelect', ['fpt-fin-period-select']);
    periodWrap.appendChild = (child) => {};

    const statusSelect = createMockElement('fptFinStatusSelect', ['fpt-fin-period-select']);
    const curSelect = createMockElement('fptFinCurrencySelect', ['fpt-fin-period-select']);
    const catSelect = createMockElement('fptFinCategorySelect', ['fpt-fin-period-select']);
    const exportBtn = createMockElement('fptFinExportBtn', ['fpt-fin-btn']);
    const refreshBtn = createMockElement('fptFinRefreshBtn', ['fpt-fin-btn']);
    const lastUpdatedText = createMockElement('fptFinLastUpdatedText');
    const activePane = createMockElement('activePane', ['fpt-fin-tab-pane', 'active']);

    const containerEl = {
        querySelector: (sel) => {
            if (sel === '#fptFinStatusSelect') return statusSelect;
            if (sel === '#fptFinCurrencySelect') return curSelect;
            if (sel === '#fptFinCategorySelect') return catSelect;
            if (sel === '#fptFinExportBtn') return exportBtn;
            if (sel === '#fptFinRefreshBtn') return refreshBtn;
            if (sel === '#fptFinLastUpdatedText') return lastUpdatedText;
            if (sel === '.fpt-fin-period-wrap') return periodWrap;
            if (sel.includes('.fpt-fin-tab-pane')) return activePane;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('.fpt-fin-tab-pane')) return [activePane];
            if (sel.includes('.fpt-fin-tab')) return [];
            return [];
        }
    };

    const domNodes = {
        statusSelect,
        curSelect,
        catSelect,
        exportBtn,
        refreshBtn,
        activePane,
        container: containerEl
    };

    const sandbox = {
        root,
        window: root,
        document: {
            querySelector: (sel) => containerEl.querySelector(sel),
            querySelectorAll: (sel) => containerEl.querySelectorAll(sel),
            getElementById: (id) => {
                if (id === 'fptFinStatusSelect') return statusSelect;
                return null;
            },
            createElement: (tag) => createMockElement('', [tag]),
            body: { appendChild: () => {} },
            head: { appendChild: () => {} },
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        chrome: {
            runtime: {
                id: 'mock-id',
                sendMessage: (_msg, cb) => cb && cb({ success: true })
            }
        },
        URLSearchParams,
        Date,
        Map,
        Set,
        String,
        Object,
        Array,
        Math,
        Error,
        Promise,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn) => { fn(); return 0; },
        clearTimeout: () => {},
        sessionStorage: { getItem: () => null, setItem: () => {} }
    };

    const ctx = vm.createContext(sandbox);
    loadFinanceHub(vm, ctx);
    const hub = ctx.root.fptFinanceHub || ctx.root.FPTFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');

    hub.init(containerEl);

    return {
        hub,
        domNodes,
        calls,
        ctx,
        root
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ТЕСТОВЫЕ СЦЕНАРИИ
// ─────────────────────────────────────────────────────────────────────────────

async function testInitialStateAndOptions() {
    const env = setupHubEnv();
    const state = env.hub.getState();

    assert.equal(state.orderStatus, 'all', 'initial orderStatus must be "all"');
    assert.equal(state.operationStatus, 'all', 'initial operationStatus must be "all"');
    assert.equal(state.status, 'all', 'initial status must be "all"');

    // Overview subtab options
    const statusSelect = env.domNodes.statusSelect;
    assert.equal(statusSelect.getAttribute('aria-label'), 'Статус заказов', 'overview status aria-label must be Статус заказов');
    assert.ok(statusSelect.innerHTML.includes('value="closed"'), 'overview status must include closed');
    assert.ok(statusSelect.innerHTML.includes('value="paid"'), 'overview status must include paid');
    assert.ok(statusSelect.innerHTML.includes('value="refunded"'), 'overview status must include refunded');
    assert.ok(!statusSelect.innerHTML.includes('value="complete"'), 'overview status must NOT include complete');
}

async function testStatusDecouplingAcrossSubtabs() {
    const env = setupHubEnv();

    // 1. Switch to Sales, set orderStatus = 'closed'
    env.hub.onSubtabChange('sales');
    assert.equal(env.domNodes.statusSelect.getAttribute('aria-label'), 'Статус заказов');
    env.hub.onStatusChange('closed');

    let state = env.hub.getState();
    assert.equal(state.orderStatus, 'closed', 'state.orderStatus updated to closed');
    assert.equal(state.operationStatus, 'all', 'state.operationStatus must stay "all"');
    assert.equal(state.status, 'closed', 'state.status alias matches active subtab');
    assert.equal(env.domNodes.statusSelect.value, 'closed');

    // Check sales filter option passed to backend
    const lastSalesCall = env.calls.sales[env.calls.sales.length - 1];
    assert.ok(lastSalesCall, 'sales getSales was called');
    assert.equal(lastSalesCall.statuses, 'closed', 'getSales received statuses: closed');

    // 2. Switch to Operations: options must switch to operations domain
    env.hub.onSubtabChange('operations');
    assert.equal(env.domNodes.statusSelect.getAttribute('aria-label'), 'Статус операций');
    assert.ok(env.domNodes.statusSelect.innerHTML.includes('value="complete"'));
    assert.ok(env.domNodes.statusSelect.innerHTML.includes('value="waiting"'));
    assert.ok(env.domNodes.statusSelect.innerHTML.includes('value="cancel"'));
    assert.ok(!env.domNodes.statusSelect.innerHTML.includes('value="closed"'));
    // Crucial: value must be operationStatus ('all'), NOT 'closed'
    assert.equal(env.domNodes.statusSelect.value, 'all', 'operations select must NOT carry over "closed"');

    const lastOpsCall = env.calls.operations[env.calls.operations.length - 1];
    assert.ok(lastOpsCall, 'operations getOperations was called');
    assert.notEqual(lastOpsCall.statuses, 'closed', 'operations query must NOT have statuses: closed');

    // 3. Change operationStatus to 'waiting'
    env.hub.onStatusChange('waiting');
    state = env.hub.getState();
    assert.equal(state.operationStatus, 'waiting', 'operationStatus updated to waiting');
    assert.equal(state.orderStatus, 'closed', 'orderStatus strictly preserved as closed');
    assert.equal(state.status, 'waiting', 'status alias updated to waiting in operations');

    const waitingOpsCall = env.calls.operations[env.calls.operations.length - 1];
    assert.equal(waitingOpsCall.statuses, 'waiting', 'operations query received statuses: waiting');

    // 4. Switch back to Sales: must restore orderStatus ('closed') and order options
    env.hub.onSubtabChange('sales');
    assert.equal(env.domNodes.statusSelect.getAttribute('aria-label'), 'Статус заказов');
    assert.equal(env.domNodes.statusSelect.value, 'closed', 'sales select restored to closed');
    state = env.hub.getState();
    assert.equal(state.orderStatus, 'closed');
    assert.equal(state.operationStatus, 'waiting', 'operationStatus preserved across tab changes');

    // 5. Switch to Purchases: must use orderStatus ('closed')
    env.hub.onSubtabChange('purchases');
    assert.equal(env.domNodes.statusSelect.value, 'closed');
    const lastPurchasesCall = env.calls.purchases[env.calls.purchases.length - 1];
    assert.ok(lastPurchasesCall);
    assert.equal(lastPurchasesCall.statuses, 'closed');

    // 6. Switch to Profit: must use orderStatus ('closed')
    env.hub.onSubtabChange('profit');
    assert.equal(env.domNodes.statusSelect.value, 'closed');
    const lastProfitCall = env.calls.profit[env.calls.profit.length - 1];
    assert.ok(lastProfitCall);
    assert.equal(lastProfitCall.statuses, 'closed');

    // 7. Switch to Potential: status select must be hidden
    env.hub.onSubtabChange('potential');
    assert.equal(env.domNodes.statusSelect.style.display, 'none', 'potential tab must hide status select');
}

async function testOverviewSubtabDomainIsolation() {
    const env = setupHubEnv();

    // Set orderStatus = 'closed', operationStatus = 'complete'
    env.hub.onSubtabChange('sales');
    env.hub.onStatusChange('closed');
    env.hub.onSubtabChange('operations');
    env.hub.onStatusChange('complete');

    // Clear call history
    env.calls.sales.length = 0;
    env.calls.profit.length = 0;
    env.calls.operations.length = 0;

    // Switch to overview
    env.hub.onSubtabChange('overview');

    assert.equal(env.domNodes.statusSelect.style.display, '', 'overview tab unhides status select');
    assert.equal(env.domNodes.statusSelect.value, 'closed', 'overview shows orderStatus');

    // Overview must query sales and profit with orderStatus
    assert.ok(env.calls.sales.length > 0, 'sales queried in overview');
    assert.equal(env.calls.sales[env.calls.sales.length - 1].statuses, 'closed', 'sales filtered by orderStatus');

    assert.ok(env.calls.profit.length > 0, 'profit queried in overview');
    assert.equal(env.calls.profit[env.calls.profit.length - 1].statuses, 'closed', 'profit filtered by orderStatus');

    // Overview must NOT pass orderStatus to operations!
    assert.ok(env.calls.operations.length > 0, 'operations queried in overview');
    const opsCall = env.calls.operations[env.calls.operations.length - 1];
    assert.equal(opsCall.statuses, undefined, 'overview operations query must NOT have orderStatus');
}

async function testExportDatasetDomainIsolation() {
    const env = setupHubEnv();

    // Set orderStatus = 'paid', operationStatus = 'cancel'
    env.hub.onSubtabChange('sales');
    env.hub.onStatusChange('paid');
    env.hub.onSubtabChange('operations');
    env.hub.onStatusChange('cancel');

    // Test sales export
    const salesExport = await env.hub.getDatasetForExport('sales');
    assert.equal(salesExport.dataset, 'sales');
    assert.equal(salesExport.meta.orderStatus, 'paid');
    assert.equal(salesExport.meta.operationStatus, 'cancel');
    assert.equal(salesExport.meta.status, 'paid');

    // Test operations export
    const opsExport = await env.hub.getDatasetForExport('operations');
    assert.equal(opsExport.dataset, 'operations');
    assert.equal(opsExport.meta.orderStatus, 'paid');
    assert.equal(opsExport.meta.operationStatus, 'cancel');
    assert.equal(opsExport.meta.status, 'cancel');

    // Test profit export
    const profitExport = await env.hub.getDatasetForExport('profit');
    assert.equal(profitExport.dataset, 'profit');
    assert.equal(profitExport.meta.status, 'paid');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ТОЧКА ВХОДА ТЕСТА
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    runStaticContractChecks();
    await testInitialStateAndOptions();
    await testStatusDecouplingAcrossSubtabs();
    await testOverviewSubtabDomainIsolation();
    await testExportDatasetDomainIsolation();
    console.log('T04_SEPARATE_STATUSES_PASS');
}

main().catch((err) => {
    console.error('T04 TEST FAILURE:', err);
    process.exit(1);
});
