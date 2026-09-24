const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFinanceHub } = require('./helpers/finance_hub_loader');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(
    path.join(ROOT, 'content', 'features', 'finance_hub.js'),
    'utf8'
).replace(/\r\n/g, '\n');
const financeHubFiltersSource = fs.readFileSync(
    path.join(ROOT, 'content', 'features', 'finance_hub', 'filters.js'),
    'utf8'
).replace(/\r\n/g, '\n');
const cssSource = fs.readFileSync(
    path.join(ROOT, 'css', 'content_styles.css'),
    'utf8'
).replace(/\r\n/g, '\n');

function createMockElement(id = '', classes = []) {
    const classSet = new Set(classes);
    const attributes = {};
    const style = {
        _props: {},
        display: '',
        setProperty(prop, value, priority) {
            this._props[prop] = { value, priority };
            if (prop === 'display') this.display = value;
        },
        removeProperty(prop) {
            delete this._props[prop];
            if (prop === 'display') this.display = '';
        }
    };

    const element = {
        id,
        className: classes.join(' '),
        classList: {
            add: (className) => classSet.add(className),
            remove: (className) => classSet.delete(className),
            toggle: (className, force) => {
                const shouldHave = force === undefined ? !classSet.has(className) : Boolean(force);
                if (shouldHave) classSet.add(className);
                else classSet.delete(className);
                return shouldHave;
            },
            contains: (className) => classSet.has(className)
        },
        style,
        disabled: false,
        innerHTML: '',
        textContent: '',
        value: '',
        dataset: {},
        options: [],
        parentNode: {
            insertBefore() {},
            appendChild() {}
        },
        appendChild() {},
        removeAttribute(name) {
            delete attributes[name];
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name];
        },
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll: () => [],
        querySelector: () => null,
        closest: () => element,
        contains: () => false,
        remove() {},
        replaceWith() {}
    };
    return element;
}

function createHubEnvironment() {
    const periodWrap = createMockElement('', ['fpt-fin-period-wrap']);
    const periodSelect = createMockElement('fptFinPeriodSelect', ['fpt-fin-period-select']);
    periodSelect.value = '7d';
    const customRange = createMockElement('fptFinCustomRange', ['fpt-fin-custom-range']);
    const customFrom = createMockElement('fptFinCustomFrom');
    const customTo = createMockElement('fptFinCustomTo');
    const customRangeError = createMockElement('fptFinCustomRangeError');
    const currencySelect = createMockElement('fptFinCurrencySelect', ['fpt-fin-period-select']);
    const statusSelect = createMockElement('fptFinStatusSelect', ['fpt-fin-period-select']);
    const categorySelect = createMockElement('fptFinCategorySelect', ['fpt-fin-period-select']);
    const exportButton = createMockElement('fptFinExportBtn', ['fpt-fin-btn']);
    const refreshButton = createMockElement('fptFinRefreshBtn', ['fpt-fin-btn']);
    const lastUpdatedText = createMockElement('fptFinLastUpdatedText');
    let snapshotBadge = null;

    const elements = new Map([
        ['#fptFinPeriodSelect', periodSelect],
        ['#fptFinCustomRange', customRange],
        ['#fptFinCustomFrom', customFrom],
        ['#fptFinCustomTo', customTo],
        ['#fptFinCustomRangeError', customRangeError],
        ['#fptFinCurrencySelect', currencySelect],
        ['#fptFinStatusSelect', statusSelect],
        ['#fptFinCategorySelect', categorySelect],
        ['#fptFinExportBtn', exportButton],
        ['#fptFinRefreshBtn', refreshButton],
        ['#fptFinLastUpdatedText', lastUpdatedText],
        ['.fpt-fin-period-wrap', periodWrap]
    ]);

    const container = {
        querySelector(selector) {
            if (selector === '#fptFinPeriodSnapshotBadge') return snapshotBadge;
            return elements.get(selector) || null;
        },
        querySelectorAll: () => []
    };

    const root = {
        showNotification() {},
        FPTFinanceData: {
            getMeta: async () => ({}),
            getSales: async () => [],
            getPurchases: async () => [],
            getOperations: async () => [],
            aggregateSales: () => ({ totalRevenue: 0, byCurrency: {} }),
            aggregatePurchases: () => ({ totalSpend: 0, byCurrency: {} }),
            aggregateOperations: () => ({ list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 })
        },
        FPTPotential: {
            getInventory: async () => [],
            calculatePotentialAggregates: () => ({}),
            calculateRowPotential: () => ({}),
            calculateCurrencyTotals: () => ({})
        },
        FPTProfitEngine: {
            getRealisedProfit: async () => ({ orders: [], byCurrency: {} }),
            calculateProfitAggregates: () => ({})
        },
        FPTPurchasesConfig: { updateAction: 'updatePurchases' },
        FPTFinanceExport: { download: () => ({}) }
    };

    const sandbox = {
        root,
        window: root,
        globalThis: root,
        document: {
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: () => null,
            createElement: (tag) => {
                const element = createMockElement('', [tag]);
                if (tag === 'div') snapshotBadge = element;
                return element;
            },
            body: { appendChild() {} },
            head: { appendChild() {} },
            addEventListener() {},
            removeEventListener() {}
        },
        chrome: {
            runtime: {
                id: 't16-test',
                sendMessage: (_message, callback) => callback && callback({ success: true })
            }
        },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
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
        JSON,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn) => { fn(); return 0; },
        clearTimeout() {}
    };

    const context = vm.createContext(sandbox);
    loadFinanceHub(vm, context);
    const hub = context.root.fptFinanceHub || context.root.FPTFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');
    hub.init(container);

    return {
        hub,
        periodSelect,
        customRange,
        currencySelect,
        statusSelect,
        categorySelect,
        getSnapshotBadge: () => snapshotBadge
    };
}

function assertControlVisibility(element, visible, label) {
    assert.equal(
        element.classList.contains('fpt-fin-control-hidden'),
        !visible,
        `${label} hidden class must match visibility`
    );
    assert.equal(
        element.getAttribute('aria-hidden'),
        visible ? 'false' : 'true',
        `${label} aria-hidden must match visibility`
    );
}

function runStaticContractChecks() {
    assert.match(
        cssSource,
        /\.fpt-fin-control-hidden\s*\{[\s\S]*?display:\s*none\s*!important\s*;/,
        'Finance hidden utility must override legacy display rules'
    );
    assert.match(
        financeHubFiltersSource,
        /function\s+setFinanceControlVisible\s*\(\s*el\s*,\s*visible(?:\s*,\s*visibleDisplay)?\s*\)/,
        'Finance controls must share one visibility helper'
    );

    const statusOptionsCode = financeHubFiltersSource.match(
        /function\s+updateStatusSelectOptions\(subtab\)[\s\S]*?\n\s*}\n\s*\n\s*function\s+setupHeaderFilters/
    );
    assert.ok(statusOptionsCode, 'status options function must be present');
    assert.doesNotMatch(statusOptionsCode[0], /\.style\.(?:display|setProperty|removeProperty)/, 'status options must not own visibility');

    const visibilityStart = financeHubFiltersSource.indexOf('function updateHeaderFiltersVisibility(subtab)');
    const visibilityEnd = financeHubFiltersSource.indexOf('\n        return {', visibilityStart);
    assert.ok(visibilityStart >= 0 && visibilityEnd > visibilityStart, 'header visibility function must be present');
    const visibilityCode = financeHubFiltersSource.slice(visibilityStart, visibilityEnd);
    assert.doesNotMatch(visibilityCode, /(?:periodSelect|snapshotBadge|customRangeWrap|catSelect|statusSelect)\.style\./, 'header filters must not mutate visibility through individual styles');
}

function testFilterMatrixAcrossSubtabs() {
    const env = createHubEnvironment();
    const badge = env.getSnapshotBadge();
    assert.ok(badge, 'snapshot badge must be created');

    const expected = {
        overview: { period: true, snapshot: false, currency: true, status: true, category: true },
        sales: { period: true, snapshot: false, currency: true, status: true, category: true },
        purchases: { period: true, snapshot: false, currency: true, status: true, category: true },
        profit: { period: true, snapshot: false, currency: true, status: true, category: true },
        potential: { period: false, snapshot: true, currency: true, status: false, category: true },
        operations: { period: true, snapshot: false, currency: true, status: true, category: false }
    };

    for (const [subtab, matrix] of Object.entries(expected)) {
        env.hub.onSubtabChange(subtab);
        assertControlVisibility(env.periodSelect, matrix.period, `${subtab} period`);
        assertControlVisibility(badge, matrix.snapshot, `${subtab} snapshot`);
        assertControlVisibility(env.currencySelect, matrix.currency, `${subtab} currency`);
        assertControlVisibility(env.statusSelect, matrix.status, `${subtab} status`);
        assertControlVisibility(env.categorySelect, matrix.category, `${subtab} category`);
    }
}

function testCustomRangeHidesAndRestoresWithoutChangingPeriod() {
    const env = createHubEnvironment();
    env.hub.onCustomRangeApply('2026-09-01', '2026-09-05');
    const storedPeriod = env.hub.getState().period;

    assertControlVisibility(env.customRange, true, 'custom range before potential');
    env.hub.onSubtabChange('potential');
    assertControlVisibility(env.customRange, false, 'custom range on potential');
    assert.deepEqual(env.hub.getState().period, storedPeriod, 'potential must not reset the stored period');

    env.hub.onSubtabChange('sales');
    assertControlVisibility(env.customRange, true, 'custom range after leaving potential');
    assert.deepEqual(env.hub.getState().period, storedPeriod, 'leaving potential must preserve the stored period');
    assert.equal(env.periodSelect.value, 'custom', 'custom period selection must be restored');
}

runStaticContractChecks();
testFilterMatrixAcrossSubtabs();
testCustomRangeHidesAndRestoresWithoutChangingPeriod();
console.log('T16_CONTEXTUAL_FILTER_VISIBILITY_PASS');
