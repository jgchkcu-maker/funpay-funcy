const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ КОНТРАКТА В ИСХОДНОМ КОДЕ
// ─────────────────────────────────────────────────────────────────────────────

function runStaticContractChecks() {
    assert.match(financeHubSource, /isRefreshing:\s*false/, 'state must declare isRefreshing flag');
    assert.match(financeHubSource, /if\s*\(\s*state\.isRefreshing\s*\)\s*return;/, 'refresh must guard against concurrent duplicate runs');
    assert.match(financeHubSource, /refreshBtn\.disabled\s*=\s*true/, 'refresh must disable refreshBtn during execution');
    assert.match(financeHubSource, /refreshBtn\.disabled\s*=\s*false/, 'refresh must restore refreshBtn.disabled in finally');
    assert.match(financeHubSource, /refreshBtn\.classList\.add\(['"]fpt-fin-btn-spin['"]\)/, 'refresh must add spinner class');
    assert.match(financeHubSource, /refreshBtn\.classList\.remove\(['"]fpt-fin-btn-spin['"]\)/, 'refresh must remove spinner class in finally');

    // Проверка наличия селективных инвалидаторов кэша
    assert.match(financeHubSource, /function invalidateSalesCache\(\)/, 'invalidateSalesCache exists');
    assert.match(financeHubSource, /function invalidatePurchasesCache\(\)/, 'invalidatePurchasesCache exists');
    assert.match(financeHubSource, /function invalidateOperationsCache\(\)/, 'invalidateOperationsCache exists');
    assert.match(financeHubSource, /function invalidateProfitCache\(\)/, 'invalidateProfitCache exists');
    assert.match(financeHubSource, /function invalidatePotentialCache\(\)/, 'invalidatePotentialCache exists');
    assert.match(financeHubSource, /function invalidateOverviewCache\(\)/, 'invalidateOverviewCache exists');

    // Проверка матрицы и оркестрации
    assert.match(financeHubSource, /Promise\.allSettled/, 'overview must use Promise.allSettled for independent sources');
    assert.match(financeHubSource, /Обновлено частично/, 'overview must report partial failure instead of generic success');
    assert.match(financeHubSource, /response\.success\s*!==\s*true/, 'Finance Hub rejects unsuccessful update response');
    assert.match(financeHubSource, /Ошибка обновления:/, 'Finance Hub surfaces refresh failure');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ДИНАМИЧЕСКИЕ ИНТЕГРАЦИОННЫЕ ТЕСТЫ В VM
// ─────────────────────────────────────────────────────────────────────────────

function createMockElement(id = '', classes = []) {
    const classSet = new Set(classes);
    const el = {
        id,
        disabled: false,
        textContent: '',
        innerHTML: '',
        value: '',
        dataset: {},
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
        closest: () => createMockElement(),
        removeAttribute: () => {},
        setAttribute: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        contains: () => false,
        remove: () => {},
        replaceWith: () => {}
    };
    return el;
}

function createMockContainer() {
    const refreshBtn = createMockElement('fptFinRefreshBtn', ['btn', 'fpt-fin-btn']);
    const lastUpdatedText = createMockElement('fptFinLastUpdatedText');
    const activePane = createMockElement('activePane');

    return {
        refreshBtn,
        lastUpdatedText,
        activePane,
        container: {
            querySelector: (sel) => {
                if (sel === '#fptFinRefreshBtn') return refreshBtn;
                if (sel === '#fptFinLastUpdatedText') return lastUpdatedText;
                if (sel.includes('.fpt-fin-tab-pane')) return activePane;
                return null;
            },
            querySelectorAll: () => []
        }
    };
}

function setupHubEnv({
    sendMessageHandler = (_req, cb) => cb({ success: true, updatedAt: 1700000000000, count: 10 }),
    getInventoryHandler = async () => [{ lotId: '1', price: 100, category: 'test' }],
    getSalesHandler = async () => [{ orderId: '1', price: 100 }],
    getPurchasesHandler = async () => [{ orderId: '2', price: 50 }],
    getOperationsHandler = async () => [{ id: '3', signed: 100 }],
    getRealisedProfitHandler = async () => ({ orders: [{ orderId: '1' }], byCurrency: { RUB: { profit: 50 } } })
} = {}) {
    const sentMessages = [];
    const notifications = [];
    const mockContainer = createMockContainer();

    const chromeMock = {
        runtime: {
            id: 'mock-extension-id',
            sendMessage: (req, cb) => {
                sentMessages.push(req);
                sendMessageHandler(req, cb);
            }
        }
    };

    const finDataMock = {
        getSales: getSalesHandler,
        aggregateSales: () => ({ totalRevenue: 100 }),
        getPurchases: getPurchasesHandler,
        aggregatePurchases: () => ({ totalSpend: 50 }),
        getOperations: getOperationsHandler,
        aggregateOperations: () => ({ list: [], inByCur: {}, outByCur: {}, byType: {}, byDay: {}, byMonth: {}, byStatus: {}, count: 0 }),
        getMeta: async (type) => ({ lastUpdate: 1700000000000 })
    };

    const potentialMock = {
        getInventory: getInventoryHandler,
        calculatePotentialAggregates: () => ({ RUB: { totalPotential: 500 } }),
        calculateRowPotential: (row) => ({ profit: 10 })
    };

    const profitMock = {
        getRealisedProfit: getRealisedProfitHandler
    };

    const root = {
        showNotification: (msg, isError) => {
            notifications.push({ msg, isError: Boolean(isError) });
        },
        FPTFinanceData: finDataMock,
        FPTPotential: potentialMock,
        FPTProfitEngine: profitMock,
        FPTPurchasesConfig: {
            updateAction: 'updatePurchases'
        }
    };

    const sandbox = {
        root,
        window: root,
        document: {
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        chrome: chromeMock,
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
        setTimeout: (fn, ms) => {
            if (typeof ms === 'number' && ms >= 1000) {
                return 999;
            }
            fn();
            return 0;
        },
        clearTimeout: () => {},
        sessionStorage: {
            getItem: () => null,
            setItem: () => {}
        }
    };

    const ctx = vm.createContext(sandbox);

    // Выполняем код finance_hub.js внутри песочницы
    vm.runInContext(financeHubSource, ctx, { filename: 'finance_hub.js' });

    const hub = ctx.root.fptFinanceHub || ctx.root.FPTFinanceHub;
    assert.ok(hub, 'FPTFinanceHub must be registered');

    hub.init(mockContainer.container);

    return {
        hub,
        mockContainer,
        sentMessages,
        notifications,
        root,
        ctx
    };
}

async function testConcurrencyAndButtonLifecycle() {
    const pendingCallbacks = [];
    let updateCalls = 0;
    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => {
            updateCalls++;
            pendingCallbacks.push(cb);
        }
    });

    const { hub, mockContainer } = env;
    hub.onSubtabChange('sales');
    const firstRefreshPromise = hub.refresh();

    assert.equal(hub.getState().isRefreshing, true, 'global refresh enters refreshing state');
    assert.equal(mockContainer.refreshBtn.disabled, true, 'button disabled during global refresh');
    assert.ok(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), 'spinner added during global refresh');
    assert.equal(updateCalls, 3, 'one global refresh starts exactly three background collectors');

    await hub.refresh();
    assert.equal(updateCalls, 3, 'concurrent click must not start a second global refresh');

    pendingCallbacks.forEach(cb => cb({ success: true, updatedAt: 1700000001000, count: 5 }));
    await firstRefreshPromise;

    assert.equal(hub.getState().isRefreshing, false, 'refresh flag resets after completion');
    assert.equal(mockContainer.refreshBtn.disabled, false, 'button enabled after completion');
    assert.equal(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), false, 'spinner removed after completion');
}

async function testGlobalRefreshRunsAllSourcesFromAnyTab() {
    let inventoryRefreshes = 0;
    const env = setupHubEnv({
        getInventoryHandler: async (opts) => {
            if (opts && opts.forceRefresh) inventoryRefreshes++;
            return [{ lotId: '10', price: 100 }];
        }
    });
    const { hub, sentMessages } = env;

    for (const tab of ['sales', 'purchases', 'operations', 'profit', 'potential', 'overview']) {
        hub.onSubtabChange(tab);
        sentMessages.length = 0;
        inventoryRefreshes = 0;
        await hub.refresh();
        const actions = sentMessages.map(m => m.action).sort();
        assert.deepEqual(actions, ['updateFinance', 'updatePurchases', 'updateSales'], `${tab}: refresh must update all durable sources`);
        assert.equal(inventoryRefreshes, 1, `${tab}: refresh must force-refresh inventory exactly once`);
    }
}

async function testGlobalCacheInvalidationAndLazyRerender() {
    const env = setupHubEnv();
    const { hub } = env;

    await hub.renderSalesSubtab(true);
    await hub.renderPurchasesSubtab(true);
    await hub.renderOperationsSubtab(true);
    await hub.renderPotentialSubtab(true);
    await hub.renderProfitSubtab(true);

    hub.onSubtabChange('purchases');
    await hub.refresh();

    const state = hub.getState();
    assert.notEqual(state.cachedPurchasesOrders, null, 'active purchases tab is rerendered immediately');
    assert.equal(state.cachedOrders, null, 'inactive sales cache stays invalidated until opened');
    assert.equal(state.cachedOperations, null, 'inactive operations cache stays invalidated until opened');
    assert.equal(state.cachedProfitOrders, null, 'profit cache is invalidated with fresh sales');
    assert.notEqual(state.cachedPotentialLots, null, 'fresh inventory result is retained without a duplicate fetch');
}

async function testPartialFailureIsTruthful() {
    const env = setupHubEnv({
        sendMessageHandler: (req, cb) => {
            if (req.action === 'updateSales') cb({ success: false, error: 'Sales network down' });
            else cb({ success: true, updatedAt: 1700000002000, count: 5 });
        },
        getInventoryHandler: async () => [{ lotId: '1', price: 100 }]
    });

    const { hub, notifications } = env;
    hub.onSubtabChange('profit');
    await hub.renderProfitSubtab(false);
    const before = hub.getState().profitLastUpdate;
    await hub.refresh();

    assert.equal(hub.getState().profitLastUpdate, before, 'profit freshness must not advance when sales refresh fails');
    const partial = notifications.find(n => n.msg.includes('Обновлено частично'));
    assert.ok(partial, 'partial global refresh emits a partial notification');
    assert.equal(partial.isError, true, 'partial global refresh is surfaced as warning/error');
    assert.ok(partial.msg.includes('3 из 4'), 'partial notification reports completed source count');
    assert.ok(partial.msg.includes('продажи'), 'partial notification names failed source');
    assert.equal(notifications.some(n => n.msg === 'Все разделы финансов обновлены'), false, 'partial refresh must not claim full success');
}

async function testCompleteSuccessNotification() {
    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => cb({ success: true, updatedAt: 1700000003000, count: 5 }),
        getInventoryHandler: async () => [{ lotId: '1', price: 100 }]
    });
    const { hub, notifications } = env;
    hub.onSubtabChange('overview');
    await hub.refresh();
    const success = notifications.find(n => n.msg === 'Все разделы финансов обновлены');
    assert.ok(success, 'full global refresh emits one global success message');
    assert.equal(success.isError, false, 'global success is not an error');
}

async function testAllSourcesFailureRestoresButton() {
    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => cb({ success: false, error: 'background failed' }),
        getInventoryHandler: async () => { throw new Error('inventory failed'); }
    });
    const { hub, mockContainer, notifications } = env;
    hub.onSubtabChange('sales');
    await hub.refresh();

    assert.equal(hub.getState().isRefreshing, false, 'refresh flag resets after total failure');
    assert.equal(mockContainer.refreshBtn.disabled, false, 'button restored after total failure');
    assert.equal(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), false, 'spinner removed after total failure');
    const err = notifications.find(n => n.isError && n.msg.includes('Не удалось обновить ни один источник'));
    assert.ok(err, 'total failure reports a clear global refresh error');
}

async function main() {
    runStaticContractChecks();
    await testConcurrencyAndButtonLifecycle();
    await testGlobalRefreshRunsAllSourcesFromAnyTab();
    await testGlobalCacheInvalidationAndLazyRerender();
    await testPartialFailureIsTruthful();
    await testCompleteSuccessNotification();
    await testAllSourcesFailureRestoresButton();
    console.log('T03_REFRESH_ORCHESTRATION_PASS');
}

main().catch((error) => {
    console.error(`T03_REFRESH_ORCHESTRATION_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
