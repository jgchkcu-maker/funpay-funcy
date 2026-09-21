const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(ROOT, 'background', 'background.js'), 'utf8');
const offscreenSource = fs.readFileSync(path.join(ROOT, 'offscreen', 'offscreen.js'), 'utf8');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8');

function extractBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `Source block not found: ${startMarker}`);
    return source.slice(start, end);
}

const salesSource = extractBetween(
    backgroundSource,
    'async function runSalesUpdateCycle() {',
    '\nasync function runFinanceUpdateCycle() {'
);
const financeSource = extractBetween(
    backgroundSource,
    'async function runFinanceUpdateCycle() {',
    '\nasync function runPurchasesUpdateCycle() {'
);
const purchasesSource = extractBetween(
    backgroundSource,
    'async function runPurchasesUpdateCycle() {',
    '\n\n\n\n// --- НИЖЕ ИДЕТ ОСТАЛЬНОЙ КОД ФАЙЛА'
);

function makeOrder(id) {
    return {
        orderId: String(id),
        description: 'fixture',
        price: 100,
        currency: 'RUB',
        orderStatus: 'closed',
        orderDate: Date.UTC(2026, 0, 1)
    };
}

function makeTxn(id) {
    return {
        id: String(id),
        type: 'order',
        status: 'complete',
        signed: 100,
        currency: 'RUB',
        date: Date.UTC(2026, 0, 1)
    };
}

function createOrderDb({ initialLastUpdate = 111, putFails = false, lastUpdateCommitFails = false } = {}) {
    const meta = new Map([['lastUpdate', initialLastUpdate]]);
    const orders = new Map([
        ['old-1', makeOrder('old-1')],
        ['old-2', makeOrder('old-2')]
    ]);

    return {
        meta,
        orders,
        api: {
            async migrateFromLocalStorage() { return 0; },
            async getMeta(key) { return meta.has(key) ? meta.get(key) : null; },
            async setMeta(key, value) {
                if (key === 'lastUpdate' && lastUpdateCommitFails) {
                    throw new Error('simulated lastUpdate DB failure');
                }
                meta.set(key, value);
            },
            async putOrders(rows) {
                if (putFails) throw new Error('simulated order DB commit failure');
                for (const row of rows || []) {
                    if (row && row.orderId != null) orders.set(String(row.orderId), { ...row });
                }
            },
            async getAllAsMap() {
                return Object.fromEntries(Array.from(orders.entries()).map(([id, row]) => [id, { ...row }]));
            },
            async count() { return orders.size; }
        }
    };
}

function createStorage(lastUpdateKey, lastUpdate = 111) {
    const state = {
        [lastUpdateKey]: lastUpdate
    };
    return {
        state,
        chrome: {
            storage: {
                local: {
                    async set(values) {
                        Object.assign(state, values);
                    }
                }
            }
        }
    };
}

function compileCycle(source, functionName, context) {
    const ctx = vm.createContext({
        ...context,
        URLSearchParams,
        Date,
        Map,
        Set,
        String,
        Object,
        Array,
        Math,
        Error,
        console: { log() {}, error() {}, warn() {} },
        setTimeout(callback) {
            callback();
            return 0;
        }
    });

    vm.runInContext(
        `${source}\nthis.__cycle = ${functionName};`,
        ctx,
        { filename: `${functionName}.js` }
    );

    return ctx.__cycle;
}

async function runOrderCycle(kind, failureMode) {
    const isSales = kind === 'sales';
    const source = isSales ? salesSource : purchasesSource;
    const functionName = isSales ? 'runSalesUpdateCycle' : 'runPurchasesUpdateCycle';
    const dbName = isSales ? 'FPTSalesDB' : 'FPTPurchasesDB';
    const lockName = isSales ? '_salesCycleRunning' : '_purchasesCycleRunning';
    const lastUpdateKey = isSales ? 'fpToolsSalesLastUpdate' : 'fpToolsPurchasesLastUpdate';
    const db = createOrderDb({ putFails: failureMode === 'db' });
    const storage = createStorage(lastUpdateKey);

    const cycle = compileCycle(source, functionName, {
        [lockName]: false,
        [dbName]: db.api,
        chrome: storage.chrome,
        async getAuthDetailsForBackground() {
            return { golden_key: 'test-key', userId: 42 };
        },
        async ensureGoldenSeal() {},
        async refreshGoldenSealOnce() {},
        async fetch() {
            if (failureMode === 'network') {
                throw new Error('simulated network failure');
            }
            return {
                status: 200,
                ok: true,
                async text() { return '<fixture>'; }
            };
        },
        async parseHtmlViaOffscreen(_html, action) {
            assert.equal(action, 'parseSalesPage');
            if (failureMode === 'parser') {
                return { nextOrderId: null, orders: [], error: 'simulated parser failure' };
            }
            return {
                nextOrderId: null,
                orders: [makeOrder('new-1'), makeOrder('new-2')]
            };
        }
    });

    let result = null;
    let error = null;
    try {
        result = await cycle();
    } catch (caught) {
        error = caught;
    }

    return { db, storage: storage.state, result, error, lastUpdateKey };
}

async function runFinanceCycle(failureMode) {
    const storage = createStorage('fpToolsFinanceLastUpdate');
    storage.state.fpToolsFinanceCount = 2;

    const dbState = {
        lastUpdate: 111,
        rows: [makeTxn('old-1'), makeTxn('old-2')]
    };

    const cycle = compileCycle(financeSource, 'runFinanceUpdateCycle', {
        _financeCycleRunning: false,
        FPTFinanceDB: {
            async replaceAll(rows, metadata) {
                if (failureMode === 'db') {
                    throw new Error('simulated finance DB commit failure');
                }
                dbState.rows = rows.map(row => ({ ...row }));
                dbState.lastUpdate = metadata.lastUpdate;
            }
        },
        chrome: storage.chrome,
        async getAuthDetailsForBackground() {
            return { golden_key: 'test-key', userId: 42 };
        },
        async ensureGoldenSeal() {},
        async refreshGoldenSealOnce() {},
        async fetch() {
            if (failureMode === 'network') {
                throw new Error('simulated finance network failure');
            }
            return {
                status: 200,
                ok: true,
                async text() { return '<fixture>'; }
            };
        },
        async parseHtmlViaOffscreen(_html, action) {
            assert.equal(action, 'parseFinancePage');
            if (failureMode === 'parser') {
                return { nextId: null, txns: [], error: 'simulated finance parser failure' };
            }
            return {
                nextId: null,
                txns: [makeTxn('new-1'), makeTxn('new-2'), makeTxn('new-3')]
            };
        }
    });

    let result = null;
    let error = null;
    try {
        result = await cycle();
    } catch (caught) {
        error = caught;
    }

    return { dbState, storage: storage.state, result, error };
}

function assertFailurePreservesFreshness(label, run, lastUpdateKey, dbLastUpdate) {
    assert.ok(run.error, `${label}: failure must propagate`);
    assert.equal(run.result, null, `${label}: failure must not return success data`);
    assert.equal(run.storage[lastUpdateKey], 111, `${label}: storage freshness must stay old`);
    assert.equal(dbLastUpdate(), 111, `${label}: DB freshness must stay old`);
}

async function runFailureFixtures() {
    for (const kind of ['sales', 'purchases']) {
        for (const failureMode of ['network', 'parser', 'db']) {
            const run = await runOrderCycle(kind, failureMode);
            assertFailurePreservesFreshness(
                `${kind}/${failureMode}`,
                run,
                run.lastUpdateKey,
                () => run.db.meta.get('lastUpdate')
            );
        }
    }

    for (const failureMode of ['network', 'parser', 'db']) {
        const run = await runFinanceCycle(failureMode);
        assertFailurePreservesFreshness(
            `finance/${failureMode}`,
            run,
            'fpToolsFinanceLastUpdate',
            () => run.dbState.lastUpdate
        );
        assert.equal(run.storage.fpToolsFinanceCount, 2, `finance/${failureMode}: old count preserved`);
    }
}

async function runSuccessFixtures() {
    const sales = await runOrderCycle('sales', 'success');
    assert.equal(sales.error, null, 'sales success');
    assert.equal(sales.result.count, 4, 'sales success count');
    assert.ok(Number.isFinite(sales.result.updatedAt), 'sales updatedAt');
    assert.equal(sales.storage.fpToolsSalesLastUpdate, sales.result.updatedAt, 'sales storage freshness');
    assert.equal(sales.db.meta.get('lastUpdate'), sales.result.updatedAt, 'sales DB freshness');

    const purchases = await runOrderCycle('purchases', 'success');
    assert.equal(purchases.error, null, 'purchases success');
    assert.equal(purchases.result.count, 4, 'purchases success count');
    assert.ok(Number.isFinite(purchases.result.updatedAt), 'purchases updatedAt');
    assert.equal(purchases.storage.fpToolsPurchasesLastUpdate, purchases.result.updatedAt, 'purchases storage freshness');
    assert.equal(purchases.db.meta.get('lastUpdate'), purchases.result.updatedAt, 'purchases DB freshness');

    const finance = await runFinanceCycle('success');
    assert.equal(finance.error, null, 'finance success');
    assert.equal(finance.result.count, 3, 'finance success count');
    assert.ok(Number.isFinite(finance.result.updatedAt), 'finance updatedAt');
    assert.equal(finance.storage.fpToolsFinanceLastUpdate, finance.result.updatedAt, 'finance storage freshness');
    assert.equal(finance.storage.fpToolsFinanceCount, 3, 'finance count mirror');
    assert.equal(finance.dbState.lastUpdate, finance.result.updatedAt, 'finance DB freshness');
}

function runContractSourceChecks() {
    for (const [action, cycle] of [
        ['updateSales', 'runSalesUpdateCycle'],
        ['updatePurchases', 'runPurchasesUpdateCycle'],
        ['updateFinance', 'runFinanceUpdateCycle']
    ]) {
        const actionIndex = backgroundSource.indexOf(`request.action === '${action}'`);
        assert.ok(actionIndex >= 0, `${action}: handler exists`);
        const snippet = backgroundSource.slice(actionIndex, actionIndex + 650);
        assert.match(snippet, new RegExp(`${cycle}\\(\\)[\\s\\S]*updatedAt: result\\.updatedAt[\\s\\S]*count: result\\.count`), `${action}: success result contract`);
        assert.match(snippet, /success:\s*false,\s*error:\s*e\.message/, `${action}: failure result contract`);
    }

    for (const [label, source, freshnessKey] of [
        ['sales', salesSource, 'fpToolsSalesLastUpdate'],
        ['purchases', purchasesSource, 'fpToolsPurchasesLastUpdate'],
        ['finance', financeSource, 'fpToolsFinanceLastUpdate']
    ]) {
        const finallyIndex = source.lastIndexOf('finally {');
        assert.ok(finallyIndex >= 0, `${label}: finally exists`);
        const finallySource = source.slice(finallyIndex);
        assert.doesNotMatch(finallySource, new RegExp(freshnessKey), `${label}: finally must not write freshness`);
        assert.doesNotMatch(finallySource, /setMeta\(['"]lastUpdate['"]/, `${label}: finally must not write DB freshness`);
    }

    const parseSalesSource = extractBetween(
        offscreenSource,
        'function parseSalesPage(html) {',
        '\nfunction '
    );
    assert.match(parseSalesSource, /error:\s*e\s*&&\s*e\.message/, 'sales parser surfaces explicit error');

    assert.match(financeHubSource, /response\.success\s*!==\s*true/, 'Finance Hub rejects unsuccessful update response');
    assert.match(financeHubSource, /Ошибка обновления:/, 'Finance Hub surfaces refresh failure');
    assert.doesNotMatch(
        financeHubSource,
        /chrome\.runtime\.sendMessage\(\{ action: actionName \}, \(\) => \{\s*clearTimeout\(timer\);\s*resolve\(\);/s,
        'Finance Hub no longer ignores update result'
    );
}

async function main() {
    runContractSourceChecks();
    await runFailureFixtures();
    await runSuccessFixtures();
    console.log('T02_UPDATE_CONTRACT_PASS');
}

main().catch((error) => {
    console.error(`T02_UPDATE_CONTRACT_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
