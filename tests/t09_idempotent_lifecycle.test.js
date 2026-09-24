const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFinanceHub } = require('./helpers/finance_hub_loader');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const mainPopupSource = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');

function createTrackedElement(name, { classes = [], value = '' } = {}) {
    const classSet = new Set(classes);
    const counters = { addEventListenerCalls: 0, onchangeAssignments: 0, onclickAssignments: 0 };
    const el = {
        name,
        id: name,
        title: '',
        disabled: false,
        textContent: '',
        innerHTML: '',
        value,
        dataset: {},
        parentNode: null,
        style: {
            display: '',
            setProperty() {},
            removeProperty() {}
        },
        classList: {
            add: (token) => classSet.add(token),
            remove: (token) => classSet.delete(token),
            toggle: (token, force) => {
                if (force === false) classSet.delete(token);
                else if (force === true || !classSet.has(token)) classSet.add(token);
            },
            contains: (token) => classSet.has(token)
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild(child) { child.parentNode = this; return child; },
        insertBefore(child) { child.parentNode = this; return child; },
        addEventListener() { counters.addEventListenerCalls++; },
        removeEventListener() {},
        setAttribute() {},
        removeAttribute() {},
        closest: () => null,
        contains: () => false,
        remove() {}
    };
    Object.defineProperty(el, 'onclick', {
        configurable: true,
        get() { return el.__onclick; },
        set(value) { counters.onclickAssignments++; el.__onclick = value; }
    });
    Object.defineProperty(el, 'onchange', {
        configurable: true,
        get() { return el.__onchange; },
        set(value) { counters.onchangeAssignments++; el.__onchange = value; }
    });
    el.counters = counters;
    return el;
}

function createContainer(label) {
    const controls = {
        period: createTrackedElement(`${label}-period`, { value: '7d' }),
        currency: createTrackedElement(`${label}-currency`, { value: 'all' }),
        status: createTrackedElement(`${label}-status`, { value: 'all' }),
        category: createTrackedElement(`${label}-category`, { value: 'all' }),
        refresh: createTrackedElement(`${label}-refresh`),
        export: createTrackedElement(`${label}-export`),
        lastUpdated: createTrackedElement(`${label}-lastUpdated`),
        periodWrap: createTrackedElement(`${label}-periodWrap`),
        snapshot: createTrackedElement(`${label}-snapshot`),
        overviewPane: createTrackedElement(`${label}-overviewPane`)
    };
    controls.period.parentNode = controls.periodWrap;
    controls.lastUpdated.textContent = 'Не обновлялось';
    controls.overviewPane.querySelector = () => null;

    const selectorMap = new Map([
        ['.fpt-fin-period-wrap', controls.periodWrap],
        ['#fptFinPeriodSelect', controls.period],
        ['#fptFinCurrencySelect', controls.currency],
        ['#fptFinStatusSelect', controls.status],
        ['#fptFinCategorySelect', controls.category],
        ['#fptFinRefreshBtn', controls.refresh],
        ['#fptFinExportBtn', controls.export],
        ['#fptFinLastUpdatedText', controls.lastUpdated],
        ['#fptFinPeriodSnapshotBadge', controls.snapshot],
        ['.fpt-fin-tab-pane[data-subtab="overview"]', controls.overviewPane]
    ]);
    const container = createTrackedElement(label);
    container.querySelector = (selector) => selectorMap.get(selector) || null;
    container.querySelectorAll = () => [];
    return { container, controls };
}

function createHubEnvironment() {
    const firstSales = {};
    firstSales.promise = new Promise(resolve => { firstSales.resolve = resolve; });
    let salesCalls = 0;
    const first = createContainer('first');
    const created = [];

    const financeData = {
        getSales: async () => {
            salesCalls++;
            if (salesCalls === 1) return firstSales.promise;
            return [];
        },
        getOperations: async () => [],
        getPurchases: async () => [],
        getMeta: async () => ({ lastUpdate: null }),
        aggregateSales: () => ({ byCurrency: {}, byStatus: {}, count: 0, total: 0 }),
        aggregateOperations: () => ({ list: [], byCurrency: {}, byStatus: {}, byType: {}, byDay: {}, byMonth: {} })
    };
    const profitEngine = {
        getRealisedProfit: async () => ({ orders: [], byCurrency: {} }),
        calculateProfitAggregates: () => ({ totals: {}, byCurrency: {} })
    };
    const potential = {
        getInventory: async () => [],
        calculatePotentialAggregates: () => ({})
    };

    const sandbox = {
        window: {},
        document: {
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: () => null,
            createElement: (tag) => createTrackedElement(`created-${tag}`),
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        sessionStorage: {
            getItem: (key) => key === 'fpt_fin_last_period' ? '30d' : null,
            setItem: () => {}
        },
        chrome: { runtime: { id: 'test', sendMessage: () => {} } },
        FPTFinanceData: financeData,
        FPTProfitEngine: profitEngine,
        FPTPotential: potential,
        console: { log() {}, warn() {}, error() {} },
        URLSearchParams,
        Date, Map, Set, String, Object, Array, Math, Error, Promise
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    loadFinanceHub(vm, sandbox);

    const hub = sandbox.FPTFinanceHub || sandbox.fptFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');
    created.push(first);
    return {
        hub,
        container: first.container,
        controls: first.controls,
        firstSales,
        get salesCalls() { return salesCalls; },
        createContainer(label) {
            const next = createContainer(label);
            created.push(next);
            return next;
        },
        sandbox
    };
}

async function testRepeatedInitAndOpenIsIdempotent() {
    const env = createHubEnvironment();
    env.hub.init(env.container);
    for (let i = 0; i < 10; i++) {
        env.hub.init(env.container);
        env.hub.onOpen();
        env.hub.onPageLeave();
    }

    assert.equal(env.salesCalls, 1, 'ten init/open cycles keep one initial data fetch');
    assert.equal(env.controls.period.counters.onchangeAssignments, 1, 'period handler is assigned once');
    assert.equal(env.controls.currency.counters.onchangeAssignments, 1, 'currency handler is assigned once');
    assert.equal(env.controls.status.counters.onchangeAssignments, 1, 'status handler is assigned once');
    assert.equal(env.controls.category.counters.onchangeAssignments, 1, 'category handler is assigned once');
    assert.equal(env.controls.refresh.counters.onclickAssignments, 1, 'refresh handler is assigned once');
    assert.equal(env.controls.export.counters.onclickAssignments, 1, 'export handler is assigned once');
    assert.equal(env.hub.getState().period, '30d', 'repeated open preserves period');

    env.firstSales.resolve([]);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(env.hub.getState().cachedOverviewData, 'the single initial render completes after close/open cycles');
}

function testNewContainerGetsOneBinding() {
    const env = createHubEnvironment();
    env.hub.init(env.container);
    const next = env.createContainer('second');
    env.hub.init(next.container);
    env.hub.init(next.container);

    assert.equal(next.controls.period.counters.onchangeAssignments, 1, 'new container gets one period handler');
    assert.equal(next.controls.export.counters.onclickAssignments, 1, 'new container gets one export handler');
}

function testMainPopupOnlyMountsAndNavigatesFinanceHub() {
    assert.doesNotMatch(mainPopupSource, /chartToggles\.forEach/, 'main_popup must not own Finance chart toggles');
    assert.doesNotMatch(mainPopupSource, /filterChips\.forEach/, 'main_popup must not own Finance filter chips');
    assert.doesNotMatch(mainPopupSource, /refreshBtn\.addEventListener/, 'main_popup must not own Finance refresh');
    assert.doesNotMatch(mainPopupSource, /periodSelect\.addEventListener/, 'main_popup must not own Finance period changes');
    assert.match(mainPopupSource, /window\.fptFinanceHub\.init\(finPage\)/, 'main_popup mounts the controller');
    assert.match(mainPopupSource, /window\.fptFinanceHub\.onOpen\(\)/, 'main_popup opens the controller');
}

async function runAll() {
    await testRepeatedInitAndOpenIsIdempotent();
    testNewContainerGetsOneBinding();
    testMainPopupOnlyMountsAndNavigatesFinanceHub();
    console.log('T09_IDEMPOTENT_LIFECYCLE_PASS');
}

runAll().catch(error => {
    console.error('T09_IDEMPOTENT_LIFECYCLE_FAIL:', error);
    process.exit(1);
});


