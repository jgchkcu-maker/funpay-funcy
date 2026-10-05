const fs = require('node:fs');
const path = require('node:path');
function loadFinanceHub(vm, context) {
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../content/features/finance_hub.js'), 'utf8'), context);
return context.FPTFinanceHub || context.window?.FPTFinanceHub;
}
module.exports = { loadFinanceHub };
