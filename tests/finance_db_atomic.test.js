const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'background', 'finance_db.js'), 'utf8');

function createFakeIndexedDB(initialRows, initialMeta, { throwOnId = null } = {}) {
    const state = {
        orders: new Map(initialRows.map(row => [row.id, structuredClone(row)])),
        meta: new Map(Object.entries(initialMeta || {}))
    };

    const db = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction(_stores, mode) {
            const write = mode === 'readwrite';
            let aborted = false;
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
                        clear() { map.clear(); },
                        put(value) {
                            if (name === 'orders' && throwOnId !== null && String(value.id) === String(throwOnId)) {
                                throw new Error('simulated transaction write failure');
                            }
                            map.set(name === 'orders' ? value.id : value.k, structuredClone(name === 'orders' ? value : value.v));
                        },
                        getAll() {
                            const request = { result: null, onsuccess: null, onerror: null };
                            setImmediate(() => {
                                request.result = Array.from(map.values()).map(value => structuredClone(value));
                                if (request.onsuccess) request.onsuccess();
                            });
                            return request;
                        },
                        get(key) {
                            const request = { result: null, onsuccess: null, onerror: null };
                            setImmediate(() => {
                                request.result = map.has(key) ? { k: key, v: structuredClone(map.get(key)) } : undefined;
                                if (request.onsuccess) request.onsuccess();
                            });
                            return request;
                        }
                    };
                },
                abort() {
                    if (aborted) return;
                    aborted = true;
                    setImmediate(() => tx.onabort && tx.onabort());
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
            const request = { result: null, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
            setImmediate(() => {
                request.result = db;
                if (request.onsuccess) request.onsuccess();
            });
            return request;
        }
    };

    return { indexedDB, state };
}

function loadApi(fake) {
    const context = vm.createContext({
        indexedDB: fake.indexedDB,
        self: {},
        module: { exports: {} },
        exports: {},
        console,
        setImmediate,
        structuredClone
    });
    vm.runInContext(source, context, { filename: 'finance_db.js' });
    return context.module.exports;
}

async function testSuccessfulReplacementIsAtomic() {
    const fake = createFakeIndexedDB(
        [{ id: 'old-1', amount: 10 }, { id: 'old-2', amount: 20 }],
        { lastUpdate: 100 }
    );
    const api = loadApi(fake);

    await api.replaceAll(
        [{ id: 'new-1', amount: 30 }, { id: 'new-2', amount: 40 }],
        { lastUpdate: 200 }
    );

    assert.deepEqual(Array.from(fake.state.orders.keys()).sort(), ['new-1', 'new-2']);
    assert.equal(fake.state.meta.get('lastUpdate'), 200);
}

async function testFailedReplacementPreservesRowsAndMetadata() {
    const fake = createFakeIndexedDB(
        [{ id: 'stable-1', amount: 10 }, { id: 'stable-2', amount: 20 }],
        { lastUpdate: 300 },
        { throwOnId: 'boom' }
    );
    const api = loadApi(fake);

    await assert.rejects(
        () => api.replaceAll([{ id: 'new-ok' }, { id: 'boom' }], { lastUpdate: 400 }),
        /simulated transaction write failure/
    );

    assert.deepEqual(Array.from(fake.state.orders.keys()).sort(), ['stable-1', 'stable-2']);
    assert.equal(fake.state.meta.get('lastUpdate'), 300);
}

async function main() {
    await testSuccessfulReplacementIsAtomic();
    await testFailedReplacementPreservesRowsAndMetadata();
    console.log('FINANCE_DB_ATOMIC_PASS');
}

main().catch(error => {
    console.error(`FINANCE_DB_ATOMIC_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
