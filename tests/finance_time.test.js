const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeData = require('../content/features/finance_data.js');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8');

function testMskBoundaryIsDeterministic() {
    const beforeMidnight = Date.UTC(2026, 8, 20, 20, 59, 59, 999);
    const atMidnight = Date.UTC(2026, 8, 20, 21, 0, 0, 0);
    const expectedStart = Date.UTC(2026, 8, 20, 21, 0, 0, 0);

    assert.equal(financeData.resolvePeriodRange('today', { now: beforeMidnight, useMsk: true }).start, expectedStart - 86400000);
    assert.equal(financeData.resolvePeriodRange('today', { now: atMidnight, useMsk: true }).start, expectedStart);
    assert.equal(financeData.getMskDayKey(beforeMidnight), '2026-09-20');
    assert.equal(financeData.getMskDayKey(atMidnight), '2026-09-21');
}

function element(id = '') {
    const classSet = new Set();
    return {
        id,
        value: '',
        innerHTML: '',
        textContent: '',
        disabled: false,
        style: {
            display: '',
            setProperty(name, value) { this[name] = value; },
            removeProperty(name) { delete this[name]; }
        },
        classList: {
            add(name) { classSet.add(name); },
            remove(name) { classSet.delete(name); },
            contains(name) { return classSet.has(name); },
            toggle(name, enabled) { if (enabled) classSet.add(name); else classSet.delete(name); }
        },
        dataset: {},
        onclick: null,
        parentNode: null,
        querySelector() { return element(); },
        querySelectorAll() { return []; },
        closest() { return element(); },
        addEventListener() {},
        removeEventListener() {},
        setAttribute() {},
        removeAttribute() {},
        appendChild() {},
        insertBefore() {},
        contains() { return false; },
        remove() {}
    };
}

function setupHubForLifecycleTest() {
    const periodSelect = element('fptFinPeriodSelect');
    const periodWrap = element('period-wrap');
    const snapshotBadge = element('fptFinPeriodSnapshotBadge');
    const customApply = element('fptFinCustomApplyBtn');
    const customReset = element('fptFinCustomResetBtn');
    const currencySelect = element('fptFinCurrencySelect');
    const statusSelect = element('fptFinStatusSelect');
    const categorySelect = element('fptFinCategorySelect');
    const refreshButton = element('fptFinRefreshBtn');
    const exportButton = element('fptFinExportBtn');
    const lastUpdated = element('fptFinLastUpdatedText');
    const salesPane = element('sales-pane');
    const potentialPane = element('potential-pane');
    const container = {
        querySelector(selector) {
            const map = {
                '#fptFinPeriodSelect': periodSelect,
                '.fpt-fin-period-wrap': periodWrap,
                '#fptFinPeriodSnapshotBadge': snapshotBadge,
                '#fptFinCustomApplyBtn': customApply,
                '#fptFinCustomResetBtn': customReset,
                '#fptFinCurrencySelect': currencySelect,
                '#fptFinStatusSelect': statusSelect,
                '#fptFinCategorySelect': categorySelect,
                '#fptFinRefreshBtn': refreshButton,
                '#fptFinExportBtn': exportButton,
                '#fptFinLastUpdatedText': lastUpdated,
                '.fpt-fin-tab-pane[data-subtab="sales"]': salesPane,
                '.fpt-fin-tab-pane[data-subtab="potential"]': potentialPane
            };
            return map[selector] || null;
        },
        querySelectorAll() { return []; }
    };
    periodSelect.parentNode = periodWrap;

    let salesCalls = 0;
    const root = {
        FPTFinanceData: {
            async getSales() { salesCalls++; return []; },
            aggregateSales() {
                return {
                    count: 0,
                    total: 0,
                    byStatus: { closed: 0, paid: 0, refunded: 0 },
                    byCurrency: {},
                    averageCheck: {},
                    refundedRevenue: {},
                    byDay: {},
                    byCategory: {}
                };
            },
            resolvePreviousPeriodRange() { return null; },
            async getMeta() { return { lastUpdate: null }; }
        },
        FPTPotential: {
            async getInventory() { return []; },
            calculatePotentialAggregates() { return {}; },
            calculateCurrencyTotals() { return {}; }
        },
        FPTPurchasesConfig: { updateAction: 'updatePurchases' },
        showNotification() {}
    };
    const session = {
        getItem(key) { return key === 'fpt_fin_active_subtab' ? 'sales' : null; },
        setItem() {},
        removeItem() {}
    };
    const context = vm.createContext({
        root,
        window: root,
        document: {
            querySelector() { return null; },
            querySelectorAll() { return []; },
            createElement: () => element(),
            getElementById() { return null; },
            addEventListener() {},
            removeEventListener() {}
        },
        chrome: { runtime: { sendMessage(_request, callback) { callback({ success: true }); } } },
        sessionStorage: session,
        URLSearchParams,
        Date,
        Map,
        Set,
        String,
        Number,
        Object,
        Array,
        Math,
        Error,
        Promise,
        console: { log() {}, warn() {}, error() {} },
        setTimeout(fn) { fn(); return 0; },
        clearTimeout() {}
    });
    vm.runInContext(financeHubSource, context, { filename: 'finance_hub.js' });
    return {
        hub: context.root.fptFinanceHub,
        container,
        periodSelect,
        snapshotBadge,
        getSalesCalls: () => salesCalls
    };
}

async function testRepeatedInitAndPotentialPeriodSemantics() {
    const env = setupHubForLifecycleTest();
    const first = env.hub.init(env.container);
    const second = env.hub.init(env.container);

    assert.strictEqual(first, second, 'repeated init reuses the active render promise');
    await Promise.all([first, second]);
    assert.equal(env.getSalesCalls(), 1, 'repeated init performs one sales load');

    env.hub.onSubtabChange('potential');
    assert.equal(env.periodSelect.style.display, 'none', 'potential hides historical period selector');
    assert.equal(env.snapshotBadge.style.display, 'inline-flex', 'potential shows current snapshot badge');
}

async function main() {
    testMskBoundaryIsDeterministic();
    assert.match(financeHubSource, /subtab === ['"]potential['"][\s\S]*?periodSelect[\s\S]*?display\s*=\s*['"]none['"]/);
    await testRepeatedInitAndPotentialPeriodSemantics();
    console.log('FINANCE_TIME_PASS');
}

main().catch(error => {
    console.error(`FINANCE_TIME_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
