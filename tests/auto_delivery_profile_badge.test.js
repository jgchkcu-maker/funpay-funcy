const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('profile stock badges use the same default-enabled rule as the settings page', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../content/features/auto_delivery_ui.js'), 'utf8')
        + '\nglobalThis.__initStockCounterDisplay = initStockCounterDisplay;';
    const badges = [];
    const rows = ['501', '502'].map(id => ({
        classList: { add() {} },
        getAttribute: () => `/lots/offer?id=${id}`,
        querySelector: selector => selector === '.tc-price' ? { appendChild: badge => badges.push({ id, badge }) } : null
    }));
    const sandbox = {
        window: { location: { pathname: '/users/123' } },
        document: {
            readyState: 'loading',
            querySelectorAll: () => rows,
            createElement: () => ({ style: {} }),
            body: {},
            addEventListener() {}
        },
        MutationObserver: class { observe() {} },
        chrome: { storage: { local: { get: async () => ({ fpToolsAutoDeliveryLots: {
            '501': { productCount: 4 },
            '502': { enabled: false, productCount: 2 }
        } }) } } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    await sandbox.__initStockCounterDisplay();

    assert.deepEqual(badges.map(({ id, badge }) => [id, badge.textContent]), [['501', '4']]);
});
