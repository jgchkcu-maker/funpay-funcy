const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

// Real IndexedDB: the multi-store transaction must stay alive across awaited
// requests of the same transaction and roll back entirely on an error.
test('IndexedDB journal: multi-store transaction is atomic and v1 data survives the upgrade', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        await page.route('http://fpt.test/**', route => {
            const file = path.join(root, new URL(route.request().url()).pathname);
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
            route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html', body: fs.readFileSync(file) });
        });
        await page.goto('http://fpt.test/tests/fixtures/order_page_paid.html');
        const result = await page.evaluate(async () => {
            // A version-1 database written by the previous release.
            await new Promise((resolve, reject) => {
                const req = indexedDB.open('fpt-ops-db-test', 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    db.createObjectStore('orders', { keyPath: 'orderId' });
                    const ops = db.createObjectStore('ops', { keyPath: 'key' });
                    ops.createIndex('state', 'state');
                    ops.createIndex('orderId', 'orderId');
                    db.createObjectStore('stock', { keyPath: 'id' }).createIndex('poolId', 'poolId');
                    db.createObjectStore('meta', { keyPath: 'k' });
                    ops.put({ key: 'delivery:LEGACY01', kind: 'delivery', state: 'done' });
                };
                req.onsuccess = () => { req.result.close(); resolve(); };
                req.onerror = () => reject(req.error);
            });
            const api = await import('/background/ops_db.js');
            const j = api.createOpsJournal({ backend: api.createIndexedDbBackend(indexedDB, 'fpt-ops-db-test'), instanceId: 'b' });
            const legacy = await j.getOp('delivery:LEGACY01');
            const first = await j.beginAttempt({ opKey: 'd:1', kind: 'delivery', orderKey: '100:AAAA0001' });
            let error = null;
            try {
                await j.transact(['ops', 'events'], async tx => {
                    await tx.put('ops', { key: 'd:2', kind: 'delivery', state: 'pending' });
                    await tx.get('events', 'missing');
                    throw new Error('rollback');
                });
            } catch (e) { error = e.message; }
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('fpt-ops-db-test');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            const stores = [...db.objectStoreNames];
            db.close();
            return { legacy: legacy?.state, created: first.created, error, second: await j.getOp('d:2'), stores };
        });
        assert.equal(result.legacy, 'done');
        assert.equal(result.created, true);
        assert.equal(result.error, 'rollback');
        assert.equal(result.second, null);
        for (const retired of ['results', 'budgets', 'reservations', 'tombstones', 'costs']) {
            assert.ok(!result.stores.includes(retired), `${retired} store is dropped`);
        }
    } finally {
        await browser.close();
    }
});
