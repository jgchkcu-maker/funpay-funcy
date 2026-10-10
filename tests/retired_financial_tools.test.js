const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.v1.json'), 'utf8'));
const cleanupModule = import('../background/retired_financial_tools.mjs').catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
});

function memoryStorage(initial) {
    const values = structuredClone(initial);
    return {
        values,
        async get(keys) {
            return Object.fromEntries(keys.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]));
        },
        async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        },
        async set(patch) { Object.assign(values, structuredClone(patch)); }
    };
}

test('extension and remote config no longer enable removed financial tools', () => {
    const contentScripts = manifest.content_scripts.flatMap(script => script.js || []);
    assert.equal(contentScripts.includes('content/features/piggy_bank.js'), false);
    assert.equal(contentScripts.includes('content/features/currency_calculator.js'), false);
    for (const key of ['piggyBank', 'calculator', 'currency']) assert.equal(Object.hasOwn(config.features, key), false);
});

test('update cleanup deletes piggy data and stale routes while install leaves storage unchanged', async () => {
    const cleanupRetiredFinancialToolData = (await cleanupModule)?.cleanupRetiredFinancialToolData;
    assert.equal(typeof cleanupRetiredFinancialToolData, 'function', 'the update migration is available');
    const storage = memoryStorage({
        fpToolsPiggyBanks: [{ id: 7, name: 'Trip', goalAmount: 1000 }],
        fpToolsLastPage: 'currency_calc',
        fpToolsLastPageMode: 'currency',
        fpToolsPageModes: { calculator: 'currency', currency_calc: 'currency', piggy_banks: null, finance_hub: 'sales' },
        hideBalance: true
    });
    const beforeInstall = structuredClone(storage.values);

    await cleanupRetiredFinancialToolData('install', storage);
    assert.deepEqual(storage.values, beforeInstall, 'a fresh installation keeps its initial storage behavior');

    await cleanupRetiredFinancialToolData('update', storage);
    assert.equal(Object.hasOwn(storage.values, 'fpToolsPiggyBanks'), false);
    assert.equal(storage.values.fpToolsLastPage, 'lot_io');
    assert.equal(storage.values.fpToolsLastPageMode, null);
    assert.deepEqual(storage.values.fpToolsPageModes, { finance_hub: 'sales' });
    assert.equal(storage.values.hideBalance, true);
});

test('update cleanup retains the active route and removes only retired saved modes', async () => {
    const cleanupRetiredFinancialToolData = (await cleanupModule)?.cleanupRetiredFinancialToolData;
    assert.equal(typeof cleanupRetiredFinancialToolData, 'function', 'the update migration is available');
    const storage = memoryStorage({
        fpToolsLastPage: 'finance_hub',
        fpToolsLastPageMode: 'profit',
        fpToolsPageModes: { calculator: 'time', currency_calc: 'currency', piggy_banks: null, finance_hub: 'profit' }
    });

    await cleanupRetiredFinancialToolData('update', storage);
    assert.equal(storage.values.fpToolsLastPage, 'finance_hub');
    assert.equal(storage.values.fpToolsLastPageMode, 'profit');
    assert.deepEqual(storage.values.fpToolsPageModes, { finance_hub: 'profit' });
});
