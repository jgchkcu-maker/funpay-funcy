const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(ROOT, 'background', 'background.js'), 'utf8');
const financeDbSource = fs.readFileSync(path.join(ROOT, 'background', 'finance_db.js'), 'utf8');

function extractFinanceCycle() {
    const start = backgroundSource.indexOf('async function runFinanceUpdateCycle() {');
    const end = backgroundSource.indexOf('\nasync function runPurchasesUpdateCycle()', start);
    assert.ok(start >= 0 && end > start, 'runFinanceUpdateCycle source is present');
    return backgroundSource.slice(start, end);
}

function makeRows(count, start = 1) {
    return Array.from({ length: count }, (_, i) => ({
        id: String(start + i),
        date: Date.UTC(2026, 0, 1) + i * 1000,
        type: 'order',
        status: 'complete',
        signed: 1,
        currency: 'RUB'
    }));
}

function makePages(rows, pageSize = 100) {
    const pages = [];
    for (let i = 0; i < rows.length; i += pageSize) {
        const chunk = rows.slice(i, i + pageSize);
        const isLast = i + pageSize >= rows.length;
        pages.push({ txns: chunk, nextId: isLast ? null : `token-${pages.length + 1}` });
    }
    if (rows.length === 0) pages.push({ txns: [], nextId: null });
    return pages;
}

function createFakeIndexedDB(initialRows, initialMeta, { throwOnId = null } = {}) {
    const state = {
        orders: new Map(initialRows.map(row => [row.id, structuredClone(row)])),
        meta: new Map(Object.entries(initialMeta || {}))
    };

    const db = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction(_stores, mode) {
            let aborted = false;
            const write = mode === 'readwrite';
            const stagedOrders = write ? new Map(state.orders) : state.orders;
            const stagedMeta = write ? new Map(state.meta) : state.meta;

            const tx = {
                error: null,
                oncomplete: null,
                onabort: null,
                onerror: null,
                objectStore(name) {
                    const map = name === 'orders' ? stagedOrders : stagedMeta;
                    return {
                        clear() {
                            map.clear();
                        },
                        put(value) {
                            if (name === 'orders') {
                                if (throwOnId !== null && String(value?.id) === String(throwOnId)) {
                                    throw new Error('simulated put failure');
                                }
                                map.set(value.id, structuredClone(value));
                            } else {
                                map.set(value.k, structuredClone(value.v));
                            }
                        },
                        getAll() {
                            const req = { result: null, error: null, onsuccess: null, onerror: null };
                            setImmediate(() => {
                                req.result = Array.from(map.values()).map(value => structuredClone(value));
                                if (req.onsuccess) req.onsuccess();
                            });
                            return req;
                        },
                        get(key) {
                            const req = { result: null, error: null, onsuccess: null, onerror: null };
                            setImmediate(() => {
                                req.result = map.has(key) ? { k: key, v: structuredClone(map.get(key)) } : undefined;
                                if (req.onsuccess) req.onsuccess();
                            });
                            return req;
                        },
                        count() {
                            const req = { result: null, error: null, onsuccess: null, onerror: null };
                            setImmediate(() => {
                                req.result = map.size;
                                if (req.onsuccess) req.onsuccess();
                            });
                            return req;
                        }
                    };
                },
                abort() {
                    if (aborted) return;
                    aborted = true;
                    setImmediate(() => {
                        if (tx.onabort) tx.onabort();
                    });
                }
            };

            if (write) {
                setImmediate(() => {
                    if (aborted) return;
                    state.orders = new Map(stagedOrders);
                    state.meta = new Map(stagedMeta);
                    if (tx.oncomplete) tx.oncomplete();
                });
            }

            return tx;
        }
    };

    const indexedDB = {
        open() {
            const req = {
                result: null,
                error: null,
                onsuccess: null,
                onerror: null,
                onblocked: null,
                onupgradeneeded: null
            };
            setImmediate(() => {
                req.result = db;
                if (req.onsuccess) req.onsuccess();
            });
            return req;
        }
    };

    return { indexedDB, state };
}

async function runReplaceAllPrimitiveCases() {
    const fake = createFakeIndexedDB(
        [{ id: 'old-1', value: 1 }, { id: 'old-2', value: 2 }],
        { lastUpdate: 111 }
    );
    const context = vm.createContext({
        indexedDB: fake.indexedDB,
        self: {},
        module: { exports: {} },
        exports: {},
        console,
        setImmediate,
        structuredClone
    });
    vm.runInContext(financeDbSource, context, { filename: 'finance_db.js' });
    const api = context.module.exports;

    await api.replaceAll(
        [{ id: 'new-1', value: 10 }, { id: 'new-2', value: 20 }],
        { lastUpdate: 222 }
    );
    assert.deepEqual(
        Array.from(fake.state.orders.keys()).sort(),
        ['new-1', 'new-2'],
        'replaceAll replaces the complete operation set'
    );
    assert.equal(fake.state.meta.get('lastUpdate'), 222, 'replaceAll commits metadata in the same transaction');

    const failing = createFakeIndexedDB(
        [{ id: 'stable-1', value: 1 }, { id: 'stable-2', value: 2 }],
        { lastUpdate: 333 },
        { throwOnId: 'boom' }
    );
    const failingContext = vm.createContext({
        indexedDB: failing.indexedDB,
        self: {},
        module: { exports: {} },
        exports: {},
        console,
        setImmediate,
        structuredClone
    });
    vm.runInContext(financeDbSource, failingContext, { filename: 'finance_db.js' });

    await assert.rejects(
        () => failingContext.module.exports.replaceAll(
            [{ id: 'new-ok' }, { id: 'boom' }],
            { lastUpdate: 444 }
        ),
        /simulated put failure/,
        'replaceAll surfaces a transaction build failure'
    );
    assert.deepEqual(
        Array.from(failing.state.orders.keys()).sort(),
        ['stable-1', 'stable-2'],
        'replaceAll abort keeps old rows intact'
    );
    assert.equal(failing.state.meta.get('lastUpdate'), 333, 'replaceAll abort keeps old metadata intact');
}

async function runFinanceCycleScenario({
    pages,
    failAtPage = null,
    initialCount = 500,
    replaceFails = false
}) {
    const cycleSource = extractFinanceCycle();
    assert.doesNotMatch(cycleSource, /FPTFinanceDB\.clearAll\(/, 'finance cycle never clears durable data before collection');
    assert.match(cycleSource, /FPTFinanceDB\.replaceAll\(/, 'finance cycle uses atomic replacement');

    const initialRows = makeRows(initialCount, 100000);
    const dbState = {
        rows: initialRows.map(row => structuredClone(row)),
        lastUpdate: 123
    };
    const storageState = {
        fpToolsFinanceCount: initialCount,
        fpToolsFinanceLastUpdate: 123,
        fpToolsFinanceCollecting: false
    };

    let fetchCalls = 0;
    let replaceCalls = 0;

    const context = vm.createContext({
        _financeCycleRunning: false,
        FPTFinanceDB: {
            async replaceAll(rows, metadata) {
                replaceCalls++;
                if (replaceFails) throw new Error('simulated db commit failure');
                dbState.rows = rows.map(row => structuredClone(row));
                dbState.lastUpdate = metadata.lastUpdate;
            }
        },
        chrome: {
            storage: {
                local: {
                    async set(values) {
                        Object.assign(storageState, values);
                    }
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
            if (failAtPage !== null && fetchCalls === failAtPage) {
                throw new Error(`simulated network failure page ${failAtPage}`);
            }
            const page = pages[fetchCalls - 1] || { txns: [], nextId: null };
            return {
                status: 200,
                ok: true,
                async text() {
                    return JSON.stringify(page);
                }
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
        setTimeout(callback) {
            callback();
            return 0;
        },
        structuredClone
    });

    vm.runInContext(
        `${cycleSource}\nthis.__runFinanceUpdateCycle = runFinanceUpdateCycle;`,
        context,
        { filename: 'runFinanceUpdateCycle.js' }
    );

    let error = null;
    try {
        await context.__runFinanceUpdateCycle();
    } catch (caught) {
        error = caught;
    }

    return { dbState, storageState, fetchCalls, replaceCalls, error };
}

async function runRefreshRegressionCases() {
    const caseA = await runFinanceCycleScenario({
        pages: [],
        failAtPage: 1,
        initialCount: 500
    });
    assert.ok(caseA.error, 'A: page 1 failure is reported');
    assert.equal(caseA.dbState.rows.length, 500, 'A: page 1 failure keeps all 500 old rows');
    assert.equal(caseA.storageState.fpToolsFinanceCount, 500, 'A: page 1 failure keeps old count');
    assert.equal(caseA.storageState.fpToolsFinanceLastUpdate, 123, 'A: page 1 failure keeps old lastUpdate');
    assert.equal(caseA.replaceCalls, 0, 'A: page 1 failure never starts replacement');

    const firstSixPages = makePages(makeRows(600), 100).map((page, index) => ({
        txns: page.txns,
        nextId: `page-${index + 2}`
    }));
    const caseB = await runFinanceCycleScenario({
        pages: firstSixPages,
        failAtPage: 7,
        initialCount: 500
    });
    assert.ok(caseB.error, 'B: page 7 failure is reported');
    assert.equal(caseB.dbState.rows.length, 500, 'B: page 7 failure keeps all 500 old rows');
    assert.equal(caseB.storageState.fpToolsFinanceCount, 500, 'B: page 7 failure keeps old count');
    assert.equal(caseB.storageState.fpToolsFinanceLastUpdate, 123, 'B: page 7 failure keeps old lastUpdate');
    assert.equal(caseB.replaceCalls, 0, 'B: page 7 failure never starts replacement');

    const caseC = await runFinanceCycleScenario({
        pages: makePages(makeRows(720), 100),
        initialCount: 500
    });
    assert.equal(caseC.error, null, 'C: full refresh succeeds');
    assert.equal(caseC.dbState.rows.length, 720, 'C: full success replaces DB with exactly 720 rows');
    assert.equal(caseC.storageState.fpToolsFinanceCount, 720, 'C: count updates after commit');
    assert.ok(caseC.storageState.fpToolsFinanceLastUpdate > 123, 'C: freshness advances after commit');
    assert.equal(caseC.replaceCalls, 1, 'C: durable replacement happens once');

    const duplicatePages = [
        { txns: makeRows(3, 1), nextId: 'dup-next' },
        {
            txns: [
                makeRows(1, 3)[0],
                makeRows(1, 4)[0],
                { ...makeRows(1, 4)[0], title: 'duplicate copy' }
            ],
            nextId: null
        }
    ];
    const caseD = await runFinanceCycleScenario({
        pages: duplicatePages,
        initialCount: 500
    });
    assert.equal(caseD.error, null, 'D: duplicate ids do not fail a valid refresh');
    assert.equal(caseD.dbState.rows.length, 4, 'D: duplicate ids produce one record per id');
    assert.deepEqual(
        Array.from(new Set(caseD.dbState.rows.map(row => String(row.id)))).sort(),
        ['1', '2', '3', '4'],
        'D: unique operation ids are retained'
    );

    const parserFailure = await runFinanceCycleScenario({
        pages: [{ txns: [], nextId: null, error: 'simulated parser failure' }],
        initialCount: 500
    });
    assert.ok(parserFailure.error, 'Parser failure is reported');
    assert.equal(parserFailure.dbState.rows.length, 500, 'Parser failure preserves old rows');
    assert.equal(parserFailure.storageState.fpToolsFinanceCount, 500, 'Parser failure preserves old count');
    assert.equal(parserFailure.storageState.fpToolsFinanceLastUpdate, 123, 'Parser failure preserves old lastUpdate');
    assert.equal(parserFailure.replaceCalls, 0, 'Parser failure never starts replacement');

    const dbFailure = await runFinanceCycleScenario({
        pages: makePages(makeRows(10), 10),
        initialCount: 500,
        replaceFails: true
    });
    assert.ok(dbFailure.error, 'DB failure is reported');
    assert.equal(dbFailure.dbState.rows.length, 500, 'DB failure preserves old rows');
    assert.equal(dbFailure.storageState.fpToolsFinanceCount, 500, 'DB failure preserves old count');
    assert.equal(dbFailure.storageState.fpToolsFinanceLastUpdate, 123, 'DB failure preserves old lastUpdate');
}

async function main() {
    await runReplaceAllPrimitiveCases();
    await runRefreshRegressionCases();
    console.log('T01_FINANCE_ATOMIC_REFRESH_PASS');
}

main().catch((error) => {
    console.error(`T01_FINANCE_ATOMIC_REFRESH_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
