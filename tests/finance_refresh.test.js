const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(ROOT, 'background', 'background.js'), 'utf8');

function extractFinanceCycle() {
    const start = backgroundSource.indexOf('async function runFinanceUpdateCycle() {');
    const end = backgroundSource.indexOf('\nasync function runPurchasesUpdateCycle()', start);
    assert.ok(start >= 0 && end > start, 'finance update cycle exists');
    return backgroundSource.slice(start, end);
}

function rows(ids) {
    return ids.map((id, index) => ({
        id: String(id),
        date: Date.UTC(2026, 8, 20, 12, index),
        type: 'deposit',
        status: 'complete',
        signed: 100 + index,
        currency: 'RUB'
    }));
}

async function runScenario({ pages, failAtPage = null, replaceFails = false }) {
    const db = {
        rows: rows(['old-1', 'old-2']),
        lastUpdate: 111,
        replaceCalls: 0
    };
    const storage = {
        fpToolsFinanceCount: db.rows.length,
        fpToolsFinanceLastUpdate: db.lastUpdate,
        fpToolsFinanceCollecting: false
    };
    let fetchCalls = 0;

    const context = vm.createContext({
        _financeCycleRunning: false,
        FPTFinanceDB: {
            async replaceAll(nextRows, metadata) {
                db.replaceCalls++;
                if (replaceFails) throw new Error('simulated durable commit failure');
                db.rows = nextRows.map(row => structuredClone(row));
                db.lastUpdate = metadata.lastUpdate;
            }
        },
        chrome: {
            storage: {
                local: {
                    async set(values) { Object.assign(storage, values); }
                }
            }
        },
        async getAuthDetailsForBackground() {
            return { golden_key: 'test-key', userId: 42 };
        },
        async ensureGoldenSeal() {},
        async refreshGoldenSealOnce() {},
        async fetch() {
            fetchCalls++;
            if (fetchCalls === failAtPage) throw new Error(`simulated page failure ${fetchCalls}`);
            const page = pages[fetchCalls - 1] || { txns: [], nextId: null };
            return {
                status: 200,
                ok: true,
                async text() { return JSON.stringify(page); }
            };
        },
        async parseHtmlViaOffscreen(html, action) {
            assert.equal(action, 'parseFinancePage');
            return JSON.parse(html);
        },
        URLSearchParams,
        Date,
        Map,
        Set,
        String,
        Math,
        Error,
        console: { log() {}, error() {} },
        setTimeout(callback) { callback(); return 0; },
        structuredClone
    });

    vm.runInContext(
        `${extractFinanceCycle()}\nthis.__runFinanceUpdateCycle = runFinanceUpdateCycle;`,
        context,
        { filename: 'runFinanceUpdateCycle.js' }
    );

    let error = null;
    try {
        await context.__runFinanceUpdateCycle();
    } catch (caught) {
        error = caught;
    }
    return { db, storage, fetchCalls, error };
}

function ids(rowsList) {
    return Array.from(rowsList, row => String(row.id));
}

async function testFailureBeforeFirstPagePreservesDurableState() {
    const result = await runScenario({
        pages: [],
        failAtPage: 1
    });
    assert.ok(result.error);
    assert.deepEqual(ids(result.db.rows), ['old-1', 'old-2']);
    assert.equal(result.db.lastUpdate, 111);
    assert.equal(result.storage.fpToolsFinanceCount, 2);
    assert.equal(result.storage.fpToolsFinanceLastUpdate, 111);
    assert.equal(result.db.replaceCalls, 0);
}

async function testFailureMidPaginationPreservesDurableState() {
    const pageOne = { txns: rows(['new-1', 'new-2']), nextId: 'page-2' };
    const pageTwo = { txns: rows(['new-3', 'new-4']), nextId: 'page-3' };
    const result = await runScenario({
        pages: [pageOne, pageTwo],
        failAtPage: 3
    });
    assert.ok(result.error);
    assert.deepEqual(ids(result.db.rows), ['old-1', 'old-2']);
    assert.equal(result.db.lastUpdate, 111);
    assert.equal(result.storage.fpToolsFinanceLastUpdate, 111);
    assert.equal(result.db.replaceCalls, 0);
}

async function testSuccessfulRefreshReplacesRowsAndAdvancesMetadata() {
    const result = await runScenario({
        pages: [
            { txns: rows(['new-1', 'new-2']), nextId: 'page-2' },
            { txns: rows(['new-3']), nextId: null }
        ]
    });
    assert.equal(result.error, null);
    assert.deepEqual(ids(result.db.rows), ['new-1', 'new-2', 'new-3']);
    assert.ok(result.db.lastUpdate > 111);
    assert.equal(result.storage.fpToolsFinanceCount, 3);
    assert.equal(result.storage.fpToolsFinanceLastUpdate, result.db.lastUpdate);
    assert.equal(result.storage.fpToolsFinanceCollecting, false);
    assert.equal(result.db.replaceCalls, 1);
}

async function testDurableCommitFailureDoesNotAdvanceLastUpdate() {
    const result = await runScenario({
        pages: [{ txns: rows(['new-1']), nextId: null }],
        replaceFails: true
    });
    assert.ok(result.error);
    assert.deepEqual(ids(result.db.rows), ['old-1', 'old-2']);
    assert.equal(result.db.lastUpdate, 111);
    assert.equal(result.storage.fpToolsFinanceLastUpdate, 111);
    assert.equal(result.storage.fpToolsFinanceCount, 2);
}

function createHubElement() {
    const classes = new Set();
    return {
        disabled: false,
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        querySelectorAll() { return []; },
        querySelector() { return null; },
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {},
        removeEventListener() {}
    };
}

function createHubRefreshEnv({ sendMessageHandler, getInventoryHandler } = {}) {
    const hubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8');
    const refreshButton = createHubElement();
    const activePane = createHubElement();
    const sentMessages = [];
    const notifications = [];
    let inventoryCalls = 0;

    const container = {
        querySelector(selector) {
            if (selector === '#fptFinRefreshBtn') return refreshButton;
            if (selector === '#fptFinLastUpdatedText') return createHubElement();
            if (selector.includes('.fpt-fin-tab-pane')) return activePane;
            return null;
        },
        querySelectorAll() { return []; }
    };
    const root = {
        showNotification(message, isError) { notifications.push({ message, isError: Boolean(isError) }); },
        FPTFinanceData: {
            async getSales() { return []; },
            async getPurchases() { return []; },
            async getOperations() { return []; },
            aggregateSales() { return { count: 0, byCurrency: {}, byStatus: {}, averageCheck: {}, byDay: {}, byCategory: {} }; },
            aggregatePurchases() { return { count: 0, byCurrency: {}, byStatus: {}, averageCheck: {}, byDay: {}, byCategory: {} }; },
            aggregateOperations() { return { list: [], byDay: {}, byMonth: {}, byType: {}, byStatus: {}, inByCur: {}, outByCur: {}, count: 0 }; },
            async getMeta() { return { lastUpdate: 1700000000000 }; },
            resolvePreviousPeriodRange() { return null; }
        },
        FPTPotential: {
            async getInventory(options) {
                if (options && options.forceRefresh) inventoryCalls++;
                return getInventoryHandler ? getInventoryHandler(options) : [];
            },
            calculatePotentialAggregates() { return {}; }
        },
        FPTProfitEngine: {
            async getRealisedProfit() { return { orders: [], byCurrency: {} }; }
        },
        FPTPurchasesConfig: { updateAction: 'updatePurchases' }
    };

    const context = vm.createContext({
        root,
        window: root,
        document: { querySelector() { return null; }, querySelectorAll() { return []; } },
        chrome: {
            runtime: {
                id: 'test-extension',
                lastError: null,
                sendMessage(request, callback) {
                    sentMessages.push(request);
                    if (sendMessageHandler) sendMessageHandler(request, callback);
                    else callback({ success: true, updatedAt: 1700000000000, count: 1 });
                }
            }
        },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
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
        setTimeout(fn, ms) {
            if (typeof ms === 'number' && ms >= 1000) return 999;
            fn();
            return 0;
        },
        clearTimeout() {}
    });
    vm.runInContext(hubSource, context, { filename: 'finance_hub.js' });
    const hub = context.root.fptFinanceHub;
    hub.init(container);
    return { hub, sentMessages, notifications, inventoryCalls: () => inventoryCalls };
}

async function testFailureReachesUiAsFailure() {
    const env = createHubRefreshEnv({
        sendMessageHandler: (_request, callback) => callback({ success: false, error: 'network down' })
    });
    env.hub.onSubtabChange('sales');
    await env.hub.refresh();
    assert.ok(env.notifications.some(item => item.isError && item.message.includes('network down')));
    assert.equal(env.notifications.some(item => item.message === 'Данные о продажах обновлены'), false);
}

async function testProfitRefreshInvokesSalesRefresh() {
    const env = createHubRefreshEnv();
    env.hub.onSubtabChange('profit');
    await env.hub.refresh();
    assert.deepEqual(env.sentMessages.map(item => item.action), ['updateSales']);
}

async function testOverviewRefreshInvokesAllSources() {
    const env = createHubRefreshEnv({
        getInventoryHandler: async () => []
    });
    env.hub.onSubtabChange('overview');
    await env.hub.refresh();
    assert.deepEqual(env.sentMessages.map(item => item.action).sort(), ['updateFinance', 'updateSales']);
    assert.equal(env.inventoryCalls(), 1);
}

async function main() {
    assert.doesNotMatch(extractFinanceCycle(), /FPTFinanceDB\.clearAll\(/);
    await testFailureBeforeFirstPagePreservesDurableState();
    await testFailureMidPaginationPreservesDurableState();
    await testSuccessfulRefreshReplacesRowsAndAdvancesMetadata();
    await testDurableCommitFailureDoesNotAdvanceLastUpdate();
    await testFailureReachesUiAsFailure();
    await testProfitRefreshInvokesSalesRefresh();
    await testOverviewRefreshInvokesAllSources();
    console.log('FINANCE_REFRESH_PASS');
}

main().catch(error => {
    console.error(`FINANCE_REFRESH_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
