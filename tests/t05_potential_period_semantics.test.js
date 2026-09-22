const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const cssSource = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ КОНТРАКТА (T05)
// ─────────────────────────────────────────────────────────────────────────────

function runStaticContractChecks() {
    // 1. CSS styling
    assert.match(cssSource, /\.fpt-fin-snapshot-badge/, 'CSS must style .fpt-fin-snapshot-badge');

    // 2. Snapshot badge creation in setupHeaderFilters
    assert.match(financeHubSource, /fptFinPeriodSnapshotBadge/, 'setupHeaderFilters must handle fptFinPeriodSnapshotBadge');
    assert.match(financeHubSource, /Текущий снимок/, 'setupHeaderFilters must define neutral snapshot label');

    // 3. Visibility toggling in updateHeaderFiltersVisibility
    assert.match(financeHubSource, /setFinanceControlVisible\(periodSelect,\s*!isPotential\)/, 'potential subtab must hide period selector through the shared visibility contract');
    assert.match(financeHubSource, /setFinanceControlVisible\(snapshotBadge,\s*isPotential,\s*['"]inline-flex['"]\)/, 'potential subtab must show snapshot badge through the shared visibility contract');
    assert.match(financeHubSource, /periodSelect\.value\s*=\s*state\.period/, 'returning from potential must restore user period selection');

    // 4. Export metadata snapshot semantics
    assert.match(financeHubSource, /period:\s*dataset\s*===\s*['"]potential['"]\s*\?\s*['"]snapshot['"]\s*:\s*state\.period/, 'export meta must mark potential as snapshot period');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ДИНАМИЧЕСКИЕ ТЕСТЫ В VM
// ─────────────────────────────────────────────────────────────────────────────

function createMockElement(id = '', classes = []) {
    const classSet = new Set(classes);
    const attributes = {};
    const styleObj = {
        _props: {},
        display: '',
        setProperty: function(prop, val, priority) {
            this._props[prop] = { val, priority };
            if (prop === 'display') this.display = val;
        },
        removeProperty: function(prop) {
            delete this._props[prop];
            if (prop === 'display') this.display = '';
        },
        getPropertyValue: function(prop) {
            return this._props[prop] ? this._props[prop].val : '';
        }
    };

    const el = {
        id,
        disabled: false,
        textContent: '',
        innerHTML: '',
        value: '',
        dataset: {},
        options: [],
        style: styleObj,
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
        parentNode: {
            insertBefore: (newNode, refNode) => {},
            appendChild: (child) => {}
        },
        appendChild: (child) => {},
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
        inventory: [],
        sales: [],
        purchases: [],
        operations: [],
        profit: []
    };

    const finDataMock = {
        getSales: async (opts) => {
            calls.sales.push(opts);
            return [{ id: 's1', price: 100, currency: 'RUB', status: 'closed' }];
        },
        aggregateSales: () => ({ totalRevenue: 100, byCurrency: { RUB: 100 } }),
        getPurchases: async (opts) => {
            calls.purchases.push(opts);
            return [{ id: 'p1', price: 50, currency: 'RUB', status: 'closed' }];
        },
        aggregatePurchases: () => ({ totalSpend: 50, byCurrency: { RUB: 50 } }),
        getOperations: async (opts) => {
            calls.operations.push(opts);
            return [{ id: 'op1', signed: 100, currency: 'RUB', status: 'complete' }];
        },
        aggregateOperations: () => ({ list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 }),
        getMeta: async () => ({ lastUpdate: 1700000000000 })
    };

    const potentialMock = {
        getInventory: async (opts) => {
            calls.inventory.push(opts);
            return [{ lotId: '1', price: 100, category: 'TestCat' }];
        },
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

    const periodWrap = createMockElement('', ['fpt-fin-period-wrap']);
    const periodSelect = createMockElement('fptFinPeriodSelect', ['fpt-fin-period-select']);
    periodSelect.parentNode.insertBefore = (newNode) => {
        if (newNode.id === 'fptFinPeriodSnapshotBadge') snapshotBadge = newNode;
    };
    periodSelect.value = '7d';
    const statusSelect = createMockElement('fptFinStatusSelect', ['fpt-fin-period-select']);
    const curSelect = createMockElement('fptFinCurrencySelect', ['fpt-fin-period-select']);
    const catSelect = createMockElement('fptFinCategorySelect', ['fpt-fin-period-select']);
    const exportBtn = createMockElement('fptFinExportBtn', ['fpt-fin-btn']);
    const refreshBtn = createMockElement('fptFinRefreshBtn', ['fpt-fin-btn']);
    const lastUpdatedText = createMockElement('fptFinLastUpdatedText');
    const activePane = createMockElement('activePane', ['fpt-fin-tab-pane', 'active']);

    let snapshotBadge = null;

    const elementsMap = {
        '#fptFinPeriodSelect': periodSelect,
        '#fptFinStatusSelect': statusSelect,
        '#fptFinCurrencySelect': curSelect,
        '#fptFinCategorySelect': catSelect,
        '#fptFinExportBtn': exportBtn,
        '#fptFinRefreshBtn': refreshBtn,
        '#fptFinLastUpdatedText': lastUpdatedText,
        '.fpt-fin-period-wrap': periodWrap
    };

    const containerEl = {
        querySelector: (sel) => {
            if (sel === '#fptFinPeriodSnapshotBadge') return snapshotBadge;
            if (elementsMap[sel]) return elementsMap[sel];
            if (sel.includes('.fpt-fin-tab-pane')) return activePane;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('.fpt-fin-tab-pane')) return [activePane];
            if (sel.includes('.fpt-fin-tab')) return [];
            return [];
        }
    };

    const sandbox = {
        root,
        window: root,
        document: {
            querySelector: (sel) => containerEl.querySelector(sel),
            querySelectorAll: (sel) => containerEl.querySelectorAll(sel),
            getElementById: (id) => containerEl.querySelector('#' + id),
            createElement: (tag) => createMockElement('', [tag]),
            body: { appendChild: () => {} },
            head: { appendChild: () => {} },
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        chrome: {
            runtime: {
                id: 'mock-id',
                sendMessage: (_msg, cb) => cb && cb({ success: true, count: 5 })
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
    vm.runInContext(financeHubSource, ctx, { filename: 'finance_hub.js' });
    const hub = ctx.root.fptFinanceHub || ctx.root.FPTFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');

    hub.init(containerEl);

    return {
        hub,
        periodSelect,
        getSnapshotBadge: () => snapshotBadge,
        statusSelect,
        calls,
        ctx,
        root
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ТЕСТОВЫЕ СЦЕНАРИИ
// ─────────────────────────────────────────────────────────────────────────────

async function testPeriodBehaviorOnPotentialAndRestoration() {
    const env = setupHubEnv();

    const periodSelect = env.periodSelect;
    const badge = env.getSnapshotBadge();
    assert.ok(badge, 'Snapshot badge must be created');

    // 1. Initial State: overview (time-based)
    assert.equal(periodSelect.style.display, '', 'periodSelect visible initially');
    assert.equal(badge.style.display, 'none', 'snapshot badge hidden on overview');

    // 2. User selects historical period '30d'
    env.hub.onPeriodChange('30d');
    assert.equal(env.hub.getState().period, '30d', 'state.period updated to 30d');

    // 3. Switch to Potential subtab
    env.hub.onSubtabChange('potential');

    // Period selector must be hidden
    assert.equal(periodSelect.style.display, 'none', 'periodSelect must be hidden on potential');
    // Snapshot badge must be visible
    assert.equal(badge.style.display, 'inline-flex', 'snapshot badge must be visible on potential');
    assert.ok(badge.innerHTML.includes('Текущий снимок'), 'snapshot badge text must be Текущий снимок');

    // Crucial: state.period is preserved and NOT corrupted by potential
    assert.equal(env.hub.getState().period, '30d', 'state.period remains intact as 30d');

    // Status select must also be hidden
    assert.equal(env.statusSelect.style.display, 'none', 'status select hidden on potential');

    // 4. Return to Sales subtab: period selector must be restored
    env.hub.onSubtabChange('sales');

    assert.equal(periodSelect.style.display, '', 'periodSelect unhidden when leaving potential');
    assert.equal(periodSelect.value, '30d', 'periodSelect value restored to previous selection 30d');
    assert.equal(badge.style.display, 'none', 'snapshot badge hidden on sales');

    // 5. Check sales query uses restored period
    const lastSalesCall = env.calls.sales[env.calls.sales.length - 1];
    assert.ok(lastSalesCall);
    assert.equal(lastSalesCall.period, '30d', 'sales query uses preserved 30d period');

    // 6. Switch to Purchases subtab: also retains restored 30d
    env.hub.onSubtabChange('purchases');
    assert.equal(periodSelect.style.display, '');
    assert.equal(periodSelect.value, '30d');
    const lastPurchasesCall = env.calls.purchases[env.calls.purchases.length - 1];
    assert.ok(lastPurchasesCall);
    assert.equal(lastPurchasesCall.period, '30d');

    // 7. Switch to Profit subtab: also retains restored 30d
    env.hub.onSubtabChange('profit');
    assert.equal(periodSelect.style.display, '');
    assert.equal(periodSelect.value, '30d');
    const lastProfitCall = env.calls.profit[env.calls.profit.length - 1];
    assert.ok(lastProfitCall);
    assert.equal(lastProfitCall.period, '30d');

    // 8. Switch to Operations subtab: also retains restored 30d
    env.hub.onSubtabChange('operations');
    assert.equal(periodSelect.style.display, '');
    assert.equal(periodSelect.value, '30d');
    const lastOpsCall = env.calls.operations[env.calls.operations.length - 1];
    assert.ok(lastOpsCall);
    assert.equal(lastOpsCall.period, '30d');
}

async function testPotentialRefreshInvokesInventoryOnly() {
    const env = setupHubEnv();

    env.hub.onSubtabChange('potential');
    env.calls.inventory.length = 0;
    env.calls.sales.length = 0;

    await env.hub.refresh();

    assert.equal(env.calls.inventory.length, 1, 'potential refresh must invoke getInventory');
    assert.equal(env.calls.inventory[0].forceRefresh, true, 'forceRefresh must be true');
    assert.equal(env.calls.inventory[0].enrichPotential, true, 'enrichPotential must be true');
    assert.equal(env.calls.sales.length, 0, 'potential refresh must NOT query historical sales');
}

async function testExportSemanticsForPotential() {
    const env = setupHubEnv();

    env.hub.onPeriodChange('365d');

    // Potential export
    const potExport = await env.hub.getDatasetForExport('potential');
    assert.equal(potExport.dataset, 'potential');
    assert.equal(potExport.meta.period, 'snapshot', 'potential export period must be snapshot');

    // Sales export
    const salesExport = await env.hub.getDatasetForExport('sales');
    assert.equal(salesExport.dataset, 'sales');
    assert.equal(salesExport.meta.period, '365d', 'sales export period reflects user selection 365d');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ТОЧКА ВХОДА ТЕСТА
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    runStaticContractChecks();
    await testPeriodBehaviorOnPotentialAndRestoration();
    await testPotentialRefreshInvokesInventoryOnly();
    await testExportSemanticsForPotential();
    console.log('T05_POTENTIAL_PERIOD_SEMANTICS_PASS');
}

main().catch((err) => {
    console.error('T05 TEST FAILURE:', err);
    process.exit(1);
});
