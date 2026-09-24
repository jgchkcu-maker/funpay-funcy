const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const moduleFiles = [
    'shared_ui.js', 'filters.js', 'exports.js', 'overview.js', 'sales.js',
    'purchases.js', 'operations.js', 'potential.js', 'profit.js'
];

function loadFinanceHub(vm, context) {
    const moduleDir = path.join(root, 'content', 'features', 'finance_hub');
    for (const file of moduleFiles) {
        const source = fs.readFileSync(path.join(moduleDir, file), 'utf8');
        vm.runInContext(source, context, { filename: `finance_hub/${file}` });
    }
    const hubSource = fs.readFileSync(path.join(root, 'content', 'features', 'finance_hub.js'), 'utf8');
    vm.runInContext(hubSource, context, { filename: 'finance_hub.js' });
    return context.FPTFinanceHub || (context.window && context.window.FPTFinanceHub);
}

module.exports = { loadFinanceHub };
