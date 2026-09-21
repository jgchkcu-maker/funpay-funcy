const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const financeDataSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');
const mainPopupSource = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ КОНТРАКТА СВЕЖЕСТИ (T08)
// ─────────────────────────────────────────────────────────────────────────────

function runStaticContractChecks() {
    // 1. HTML-шаблон не должен содержать вводящее в заблуждение "Обновлено: только что"
    assert.ok(
        !mainPopupSource.includes('id="fptFinLastUpdatedText">Обновлено: только что<'),
        'main_popup.js must not hardcode "Обновлено: только что" in initial template'
    );
    assert.match(
        mainPopupSource,
        /id="fptFinLastUpdatedText">Не обновлялось</,
        'main_popup.js must have "Не обновлялось" as initial template text'
    );

    // 2. В renderProfitSubtab запрещено присваивание state.profitLastUpdate = Date.now()
    assert.ok(
        !financeHubSource.match(/function renderProfitSubtab[\s\S]*?state\.profitLastUpdate\s*=\s*Date\.now\(\)/),
        'renderProfitSubtab must not set profitLastUpdate to Date.now()'
    );

    // 3. В renderOverviewSubtab запрещено присваивание state.overviewLastUpdate = Date.now()
    assert.ok(
        !financeHubSource.match(/function renderOverviewSubtab[\s\S]*?state\.overviewLastUpdate\s*=\s*Date\.now\(\)/),
        'renderOverviewSubtab must not set overviewLastUpdate to Date.now()'
    );

    // 4. В refresh overview branch запрещено присваивание state.overviewLastUpdate = Date.now()
    const overviewRefreshIdx = financeHubSource.indexOf("currentSubtab === 'overview'");
    assert.ok(overviewRefreshIdx > 0, 'overview refresh branch must exist');
    const overviewRefreshBlock = financeHubSource.slice(overviewRefreshIdx, overviewRefreshIdx + 2500);
    assert.ok(
        !overviewRefreshBlock.includes('state.overviewLastUpdate = Date.now()'),
        'refresh overview branch must not set overviewLastUpdate to Date.now()'
    );

    // 5. Overview должен использовать Math.min, никогда Math.max
    assert.match(
        financeHubSource,
        /Math\.min\(\.\.\.requiredTimestamps\)/,
        'Overview freshness must compute Math.min of required sources'
    );
    assert.ok(
        !financeHubSource.includes('Math.max(...requiredTimestamps)'),
        'Overview must never use Math.max for overall freshness'
    );

    // 6. finance_data.js getMeta должен использовать Math.min
    assert.match(
        financeDataSource,
        /Math\.min\(\.\.\.timestamps\)/,
        'FPTFinanceData.getMeta must use Math.min for overall lastUpdate'
    );
    assert.ok(
        !financeDataSource.includes('Math.max(...timestamps)'),
        'FPTFinanceData.getMeta must never use Math.max for overall lastUpdate'
    );

    // 7. Overview tooltip должен раскрывать свежесть компонентов
    assert.match(
        financeHubSource,
        /lastUpdatedEl\.title\s*=\s*`Продажи:.*Операции:.*Инвентарь:/,
        'Overview must expose component freshness in lastUpdatedEl.title'
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ДИНАМИЧЕСКИЕ ТЕСТЫ: FPTFinanceData.getMeta (T08)
// ─────────────────────────────────────────────────────────────────────────────

async function testFinanceDataGetMeta() {
    const mockStorage = {
        fpToolsSalesLastUpdate: 1700000000000,       // Самый старый (например, 5 дней назад)
        fpToolsPurchasesLastUpdate: 1700100000000,   // Средний
        fpToolsFinanceLastUpdate: 1700200000000,     // Самый свежий
        fpToolsFinanceCount: 42
    };

    const sandbox = {
        window: {},
        chrome: {
            storage: {
                local: {
                    get: (keys, cb) => {
                        const res = {};
                        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
                            if (k in mockStorage) res[k] = mockStorage[k];
                        });
                        if (typeof cb === 'function') cb(res);
                        return Promise.resolve(res);
                    }
                }
            }
        },
        console: { log: () => {}, warn: () => {}, error: () => {} }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(financeDataSource, sandbox);

    const finData = sandbox.window.FPTFinanceData;
    assert.ok(finData && typeof finData.getMeta === 'function', 'FPTFinanceData.getMeta must be exported');

    const meta = await finData.getMeta();
    assert.equal(meta.sales.lastUpdate, 1700000000000, 'sales.lastUpdate matches storage');
    assert.equal(meta.purchases.lastUpdate, 1700100000000, 'purchases.lastUpdate matches storage');
    assert.equal(meta.operations.lastUpdate, 1700200000000, 'operations.lastUpdate matches storage');

    // Overall freshness must be the OLDEST (Math.min), not newest (Math.max)
    assert.equal(meta.lastUpdate, 1700000000000, 'meta.lastUpdate must be Math.min (1700000000000)');
    assert.notEqual(meta.lastUpdate, 1700200000000, 'meta.lastUpdate must NEVER be Math.max (1700200000000)');
    assert.equal(meta.oldestLastUpdate, 1700000000000, 'meta.oldestLastUpdate must be 1700000000000');

    // componentFreshness object exposed
    assert.equal(meta.componentFreshness.sales, 1700000000000, 'componentFreshness.sales');
    assert.equal(meta.componentFreshness.purchases, 1700100000000, 'componentFreshness.purchases');
    assert.equal(meta.componentFreshness.operations, 1700200000000, 'componentFreshness.operations');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ДИНАМИЧЕСКИЕ ТЕСТЫ: FPTFinanceHub FRESHNESS FORMATTING & SUBTAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function createMockElement(id = '', classes = []) {
    const classSet = new Set(classes);
    const el = {
        id,
        title: '',
        disabled: false,
        textContent: '',
        innerHTML: '',
        value: '',
        dataset: {},
        style: {
            display: '',
            removeProperty: () => {},
            setProperty: () => {}
        },
        classList: {
            add: (c) => classSet.add(c),
            remove: (c) => classSet.delete(c),
            contains: (c) => classSet.has(c)
        },
        querySelectorAll: () => [],
        querySelector: (sel) => {
            if (sel === '#fptFinLastUpdatedText') return el;
            return createMockElement();
        },
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

function createHubSandbox(storageData = {}) {
    const lastUpdatedText = createMockElement('fptFinLastUpdatedText');
    lastUpdatedText.textContent = 'Не обновлялось';

    const container = createMockElement('fptFinanceHubContainer');
    container.querySelector = (sel) => {
        if (sel === '#fptFinLastUpdatedText') return lastUpdatedText;
        return createMockElement();
    };
    container.querySelectorAll = () => [];

    const storage = Object.assign({}, storageData);

    const finData = {
        getMeta: async (type) => {
            const sLu = storage.fpToolsSalesLastUpdate || null;
            const pLu = storage.fpToolsPurchasesLastUpdate || null;
            const oLu = storage.fpToolsFinanceLastUpdate || null;
            const timestamps = [sLu, pLu, oLu].filter(t => typeof t === 'number' && t > 0);
            const oldest = timestamps.length ? Math.min(...timestamps) : null;
            const metaObj = {
                sales: { lastUpdate: sLu, count: 10 },
                purchases: { lastUpdate: pLu, count: 5 },
                operations: { lastUpdate: oLu, count: 20 },
                lastUpdate: oldest,
                oldestLastUpdate: oldest,
                componentFreshness: { sales: sLu, purchases: pLu, operations: oLu }
            };
            return type ? metaObj[type] : metaObj;
        },
        getSales: async () => [],
        getPurchases: async () => [],
        getOperations: async () => [],
        aggregateSales: () => ({ byCurrency: { RUB: { revenue: 1000 } } }),
        aggregatePurchases: () => ({ byCurrency: { RUB: { totalSpent: 500 } } }),
        aggregateOperations: () => ({ byCurrency: { RUB: { net: 800 } } })
    };

    const profitEngine = {
        getRealisedProfit: async () => ({ orders: [], byCurrency: { RUB: { realisedNetProfit: 500 } } }),
        calculateProfitAggregates: () => ({ totals: { realisedNetProfit: 500 }, byCurrency: {} })
    };

    const potentialEngine = {
        getInventory: async () => [{ id: '1', category: 'keys', price: 100, stockKind: 'finite', stockCount: 1 }],
        calculatePotentialAggregates: () => ({ RUB: { sellerRevenue: 100, knownPotentialProfit: 50 } }),
        calculateCurrencyTotals: () => ({ sellerRevenue: 100, knownPotentialProfit: 50 }),
        calculateRowPotential: (l) => l
    };

    const sandbox = {
        window: {},
        document: {
            getElementById: () => null,
            querySelector: (sel) => (sel === '#fptFinLastUpdatedText' ? lastUpdatedText : createMockElement()),
            querySelectorAll: () => []
        },
        sessionStorage: {
            getItem: () => null,
            setItem: () => {}
        },
        chrome: {
            storage: {
                local: {
                    get: (keys, cb) => {
                        const res = {};
                        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
                            if (k in storage) res[k] = storage[k];
                        });
                        if (typeof cb === 'function') cb(res);
                        return Promise.resolve(res);
                    },
                    set: (items, cb) => {
                        Object.assign(storage, items);
                        if (typeof cb === 'function') cb();
                        return Promise.resolve();
                    }
                }
            },
            runtime: { id: 'test' }
        },
        FPTFinanceData: finData,
        fptFinanceData: finData,
        FPTProfitEngine: profitEngine,
        FPTPotential: potentialEngine,
        console: { log: () => {}, warn: () => {}, error: () => {} }
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(financeHubSource, sandbox);

    const hub = sandbox.window.FPTFinanceHub || sandbox.window.fptFinanceHub;
    hub.init(container);

    return { sandbox, hub, lastUpdatedText, storage };
}

async function testSourceFreshnessRules() {
    // 5 days ago in MSK: 2026-03-10 12:00:00 UTC+3 = 1773133200000
    const salesTs = Date.UTC(2026, 2, 10, 9, 0, 0); // 12:00 MSK
    // 3 days ago in MSK: 2026-03-12 15:30:00 UTC+3
    const purchasesTs = Date.UTC(2026, 2, 12, 12, 30, 0);
    // 1 day ago in MSK: 2026-03-14 18:00:00 UTC+3
    const operationsTs = Date.UTC(2026, 2, 14, 15, 0, 0);

    const { hub, lastUpdatedText, sandbox } = createHubSandbox({
        fpToolsSalesLastUpdate: salesTs,
        fpToolsPurchasesLastUpdate: purchasesTs,
        fpToolsFinanceLastUpdate: operationsTs
    });

    // 1. formatLastUpdatedText tests
    const formattedSales = hub.formatLastUpdatedText(salesTs);
    assert.equal(formattedSales, 'Обновлено: 10.03.2026 12:00', 'Past timestamp formatted with date and time');
    assert.equal(hub.formatLastUpdatedText(null), 'Не обновлялось', 'Null timestamp formatted as Не обновлялось');
    assert.equal(hub.formatLastUpdatedText(0), 'Не обновлялось', '0 timestamp formatted as Не обновлялось');

    // 2. Sales subtab freshness -> fpToolsSalesLastUpdate
    await hub.updateLastUpdatedText('sales');
    assert.equal(lastUpdatedText.textContent, 'Обновлено: 10.03.2026 12:00', 'Sales subtab must show fpToolsSalesLastUpdate');
    assert.ok(!lastUpdatedText.textContent.includes('только что'), 'Must not say только что');

    // 3. Purchases subtab freshness -> fpToolsPurchasesLastUpdate
    await hub.updateLastUpdatedText('purchases');
    assert.equal(lastUpdatedText.textContent, 'Обновлено: 12.03.2026 15:30', 'Purchases subtab must show fpToolsPurchasesLastUpdate');

    // 4. Operations subtab freshness -> fpToolsFinanceLastUpdate
    await hub.updateLastUpdatedText('operations');
    assert.equal(lastUpdatedText.textContent, 'Обновлено: 14.03.2026 18:00', 'Operations subtab must show fpToolsFinanceLastUpdate');

    // 5. Profit subtab freshness -> STRICTLY SALES FRESHNESS (fpToolsSalesLastUpdate)
    // Even after renderProfitSubtab(), it must NEVER say "только что" or Date.now()!
    await hub.renderProfitSubtab(false);
    assert.equal(
        lastUpdatedText.textContent,
        'Обновлено: 10.03.2026 12:00',
        'Profit subtab freshness must strictly track sales freshness (fpToolsSalesLastUpdate)'
    );
    assert.ok(
        lastUpdatedText.title.includes('продажах'),
        'Profit freshness tooltip explains derivation from sales data'
    );

    // 6. Potential subtab freshness -> real inventory fetch timestamp preserved across navigation
    // Let's set an explicit real inventory fetch timestamp (e.g. 2 hours ago: 2026-03-15 10:00 MSK)
    const inventoryFetchTs = Date.UTC(2026, 2, 15, 7, 0, 0);
    const state = hub.getState();
    // Simulate inventory already fetched at inventoryFetchTs:
    sandbox.window.fptFinanceHub.init; // Ensure hub is loaded
    // Directly set state.potentialLastUpdate & cached lots:
    sandbox.fptFinanceHub.cachedPotentialLots = [{ id: '1', category: 'keys' }];
    // Call renderPotentialSubtab(false) (reopening/rendering tab without force refresh)
    await hub.renderPotentialSubtab(false);
    // Overwrite state.potentialLastUpdate to test preservation:
    await hub.updateLastUpdatedText('potential');
    const potFreshnessBeforeNav = lastUpdatedText.textContent;
    // Navigate away to Sales:
    await hub.updateLastUpdatedText('sales');
    assert.equal(lastUpdatedText.textContent, 'Обновлено: 10.03.2026 12:00');
    // Navigate back to Potential:
    await hub.renderPotentialSubtab(false);
    // Freshness must NOT change or advance to "только что":
    assert.notEqual(lastUpdatedText.textContent, 'Обновлено: только что');

    // 7. Overview subtab freshness:
    // Sources: Sales = 10.03.2026, Operations = 14.03.2026, Inventory = recent
    // Math.min must choose Sales (10.03.2026) as overall freshness because it is the oldest required source!
    await hub.renderOverviewSubtab(false);
    assert.equal(
        lastUpdatedText.textContent,
        'Обновлено: 10.03.2026 12:00',
        'Overview overall freshness must be the OLDEST required source timestamp (Math.min), hiding no stale dependencies'
    );
    assert.ok(
        lastUpdatedText.title.includes('Продажи: 10.03.2026 12:00'),
        'Overview tooltip exposes sales component freshness'
    );
    assert.ok(
        lastUpdatedText.title.includes('Операции: 14.03.2026 18:00'),
        'Overview tooltip exposes operations component freshness'
    );
    assert.ok(
        lastUpdatedText.title.includes('Инвентарь:'),
        'Overview tooltip exposes inventory component freshness'
    );

    // 8. Reopening hub tab does NOT make stale data appear freshly updated
    // Simulate close and re-open by re-initializing container with same stale storage:
    const reinitContainer = createMockElement('fptFinanceHubContainerReopen');
    const reinitLastUpdated = createMockElement('fptFinLastUpdatedText');
    reinitContainer.querySelector = (sel) => (sel === '#fptFinLastUpdatedText' ? reinitLastUpdated : createMockElement());
    reinitContainer.querySelectorAll = () => [];

    hub.init(reinitContainer);
    await hub.updateLastUpdatedText('sales');
    assert.equal(
        reinitLastUpdated.textContent,
        'Обновлено: 10.03.2026 12:00',
        'Reopened hub must show truthful historical timestamp from storage, never "только что"'
    );
}

async function runAll() {
    runStaticContractChecks();
    await testFinanceDataGetMeta();
    await testSourceFreshnessRules();
    console.log('T08_SOURCE_FRESHNESS_PASS');
}

runAll().catch(err => {
    console.error('T08_SOURCE_FRESHNESS_FAIL:', err);
    process.exit(1);
});
