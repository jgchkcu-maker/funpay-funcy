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
    let resolveFirstUpdate = null;
    let updateCalls = 0;

    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => {
            updateCalls++;
            new Promise((resolve) => {
                resolveFirstUpdate = () => {
                    cb({ success: true, updatedAt: 1700000001000, count: 5 });
                    resolve();
                };
            });
        }
    });

    const { hub, mockContainer } = env;
    hub.onSubtabChange('sales');
    const state = hub.getState();
    assert.equal(state.isRefreshing, false, 'initially not refreshing');
    assert.equal(mockContainer.refreshBtn.disabled, false, 'initially button enabled');

    // Запускаем первое обновление
    const firstRefreshPromise = hub.refresh();

    // Во время выполнения: флаг взведён, кнопка заблокирована со спиннером
    const runningState = hub.getState();
    assert.equal(runningState.isRefreshing, true, 'isRefreshing is true during refresh');
    assert.equal(mockContainer.refreshBtn.disabled, true, 'button is disabled during refresh');
    assert.ok(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), 'spinner class is added');

    // Пытаемся запустить второе конкурентное обновление
    const secondRefreshPromise = hub.refresh();
    await secondRefreshPromise;

    // Второе обновление должно было быть проигнорировано
    assert.equal(updateCalls, 1, 'concurrent call must not send a second message');

    // Завершаем первое обновление
    resolveFirstUpdate();
    await firstRefreshPromise;

    // После завершения: кнопка разблокирована, спиннер убран, флаг сброшен
    const finalState = hub.getState();
    assert.equal(finalState.isRefreshing, false, 'isRefreshing reset to false');
    assert.equal(mockContainer.refreshBtn.disabled, false, 'button restored to enabled in finally');
    assert.equal(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), false, 'spinner class removed');
}

async function testButtonLifecycleOnError() {
    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => {
            cb({ success: false, error: 'simulated failure' });
        }
    });

    const { hub, mockContainer, notifications } = env;
    hub.onSubtabChange('sales');
    await hub.refresh();

    const state = hub.getState();
    assert.equal(state.isRefreshing, false, 'isRefreshing reset after error');
    assert.equal(mockContainer.refreshBtn.disabled, false, 'button enabled after error');
    assert.equal(mockContainer.refreshBtn.classList.contains('fpt-fin-btn-spin'), false, 'spinner removed after error');
    assert.ok(notifications.some(n => n.isError && n.msg.includes('simulated failure')), 'error notification shown');
}

async function testSubtabRefreshMatrix() {
    let inventoryRefreshes = 0;
    const env = setupHubEnv({
        getInventoryHandler: async (opts) => {
            if (opts && opts.forceRefresh) inventoryRefreshes++;
            return [{ lotId: '10', price: 100 }];
        }
    });

    const { hub, sentMessages } = env;

    // 1. Sales
    hub.onSubtabChange('sales');
    sentMessages.length = 0;
    await hub.refresh();
    assert.equal(sentMessages.length, 1, 'sales triggers 1 message');
    assert.equal(sentMessages[0].action, 'updateSales', 'sales triggers updateSales');

    // 2. Purchases
    hub.onSubtabChange('purchases');
    sentMessages.length = 0;
    await hub.refresh();
    assert.equal(sentMessages.length, 1, 'purchases triggers 1 message');
    assert.equal(sentMessages[0].action, 'updatePurchases', 'purchases triggers updatePurchases');

    // 3. Operations
    hub.onSubtabChange('operations');
    sentMessages.length = 0;
    await hub.refresh();
    assert.equal(sentMessages.length, 1, 'operations triggers 1 message');
    assert.equal(sentMessages[0].action, 'updateFinance', 'operations triggers updateFinance');

    // 4. Profit
    hub.onSubtabChange('profit');
    sentMessages.length = 0;
    await hub.refresh();
    assert.equal(sentMessages.length, 1, 'profit triggers 1 message');
    assert.equal(sentMessages[0].action, 'updateSales', 'profit triggers updateSales before recalculating');

    // 5. Potential
    hub.onSubtabChange('potential');
    sentMessages.length = 0;
    inventoryRefreshes = 0;
    await hub.refresh();
    assert.equal(sentMessages.length, 0, 'potential does not send background message');
    assert.equal(inventoryRefreshes, 1, 'potential triggers inventory forceRefresh:true');

    // 6. Overview
    hub.onSubtabChange('overview');
    sentMessages.length = 0;
    inventoryRefreshes = 0;
    await hub.refresh();
    const actions = sentMessages.map(m => m.action).sort();
    assert.deepEqual(actions, ['updateFinance', 'updateSales'], 'overview triggers updateSales and updateFinance');
    assert.equal(inventoryRefreshes, 1, 'overview triggers inventory forceRefresh:true');
}

async function testSelectiveCacheInvalidation() {
    const env = setupHubEnv();
    const { hub, ctx } = env;

    async function populateAllCaches() {
        await hub.renderSalesSubtab(true);
        await hub.renderPurchasesSubtab(true);
        await hub.renderOperationsSubtab(true);
        await hub.renderPotentialSubtab(true);
    }

    // Обновляем покупки (purchases) — кэши продаж, операций и инвентаря должны остаться нетронутыми
    await populateAllCaches();
    hub.onSubtabChange('purchases');
    await hub.refresh();

    let state = hub.getState();
    assert.notEqual(state.cachedPurchasesOrders, null, 'purchases rendered fresh');
    assert.notEqual(state.cachedOrders, null, 'sales cache preserved when refreshing purchases');
    assert.notEqual(state.cachedOperations, null, 'operations cache preserved when refreshing purchases');
    assert.notEqual(state.cachedPotentialLots, null, 'potential cache preserved when refreshing purchases');

    // Обновляем операции (operations) — кэши покупок, продаж и инвентаря должны остаться нетронутыми
    await populateAllCaches();
    hub.onSubtabChange('operations');
    await hub.refresh();

    state = hub.getState();
    assert.notEqual(state.cachedOperations, null, 'operations rendered fresh');
    assert.notEqual(state.cachedOrders, null, 'sales cache preserved when refreshing operations');
    assert.notEqual(state.cachedPurchasesOrders, null, 'purchases cache preserved when refreshing operations');
    assert.notEqual(state.cachedPotentialLots, null, 'potential cache preserved when refreshing operations');

    // Обновляем продажи (sales) — кэши покупок, операций и инвентаря должны остаться нетронутыми
    await populateAllCaches();
    hub.onSubtabChange('sales');
    await hub.refresh();

    state = hub.getState();
    assert.notEqual(state.cachedOrders, null, 'sales rendered fresh');
    assert.notEqual(state.cachedPurchasesOrders, null, 'purchases cache preserved when refreshing sales');
    assert.notEqual(state.cachedOperations, null, 'operations cache preserved when refreshing sales');
    assert.notEqual(state.cachedPotentialLots, null, 'potential cache preserved when refreshing sales');

    // Обновляем потенциал (potential) — кэши покупок, операций и продаж должны остаться нетронутыми
    await populateAllCaches();
    hub.onSubtabChange('potential');
    await hub.refresh();

    state = hub.getState();
    assert.notEqual(state.cachedPotentialLots, null, 'potential rendered fresh');
    assert.notEqual(state.cachedPurchasesOrders, null, 'purchases cache preserved when refreshing potential');
    assert.notEqual(state.cachedOperations, null, 'operations cache preserved when refreshing potential');
    assert.notEqual(state.cachedOrders, null, 'sales cache preserved when refreshing potential');
}

async function testOverviewTruthfulPartialFailure() {
    // 1. Частичный сбой: продажи упали, операции и инвентарь успешны
    const env = setupHubEnv({
        sendMessageHandler: (req, cb) => {
            if (req.action === 'updateSales') {
                cb({ success: false, error: 'Sales network down' });
            } else {
                cb({ success: true, updatedAt: 1700000002000, count: 5 });
            }
        },
        getInventoryHandler: async () => [{ lotId: '1', price: 100 }]
    });

    const { hub, notifications } = env;
    hub.onSubtabChange('overview');
    await hub.renderOverviewSubtab(false);

    const stateBefore = hub.getState();
    const initialOverviewUpdate = stateBefore.overviewLastUpdate;

    await hub.refresh();

    const stateAfter = hub.getState();
    assert.equal(stateAfter.overviewLastUpdate, initialOverviewUpdate, 'overviewLastUpdate NOT updated on partial failure');

    const partialNotif = notifications.find(n => n.msg.includes('Обновлено частично'));
    assert.ok(partialNotif, 'partial failure notification must be emitted');
    assert.equal(partialNotif.isError, true, 'partial failure must have isError: true');
    assert.ok(partialNotif.msg.includes('продажи'), 'partial failure specifies failed source');

    const genericSuccess = notifications.find(n => n.msg === 'Данные обзора обновлены');
    assert.equal(genericSuccess, undefined, 'must NOT emit generic overview success on partial failure');
}

async function testOverviewCompleteSuccess() {
    const env = setupHubEnv({
        sendMessageHandler: (_req, cb) => {
            cb({ success: true, updatedAt: 1700000003000, count: 5 });
        },
        getInventoryHandler: async () => [{ lotId: '1', price: 100 }]
    });

    const { hub, notifications } = env;
    hub.onSubtabChange('overview');

    await hub.refresh();

    const state = hub.getState();
    assert.ok(Number.isFinite(state.overviewLastUpdate), 'overviewLastUpdate set on full success');

    const successNotif = notifications.find(n => n.msg === 'Данные обзора обновлены');
    assert.ok(successNotif, 'full success notification emitted');
    assert.equal(successNotif.isError, false, 'full success has isError: false');
}

async function testProfitRequiresSalesRefresh() {
    const env = setupHubEnv({
        sendMessageHandler: (req, cb) => {
            if (req.action === 'updateSales') {
                cb({ success: false, error: 'Sales failed for profit' });
            } else {
                cb({ success: true });
            }
        }
    });

    const { hub, notifications } = env;
    hub.onSubtabChange('profit');
    await hub.renderProfitSubtab(false);

    const stateBefore = hub.getState();
    const initialProfitUpdate = stateBefore.profitLastUpdate;

    await hub.refresh();

    const stateAfter = hub.getState();
    assert.equal(stateAfter.profitLastUpdate, initialProfitUpdate, 'profitLastUpdate NOT updated when sales fails');

    const errNotif = notifications.find(n => n.isError && n.msg.includes('Sales failed for profit'));
    assert.ok(errNotif, 'profit surfaces sales refresh failure');

    const profitSuccess = notifications.find(n => n.msg === 'Данные о прибыли обновлены');
    assert.equal(profitSuccess, undefined, 'profit must not claim success if sales refresh failed');
}

async function main() {
    runStaticContractChecks();
    await testConcurrencyAndButtonLifecycle();
    await testButtonLifecycleOnError();
    await testSubtabRefreshMatrix();
    await testSelectiveCacheInvalidation();
    await testOverviewTruthfulPartialFailure();
    await testOverviewCompleteSuccess();
    await testProfitRequiresSalesRefresh();
    console.log('T03_REFRESH_ORCHESTRATION_PASS');
}

main().catch((error) => {
    console.error(`T03_REFRESH_ORCHESTRATION_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
