// Former t19_finance_ui_localization view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t19_finance_ui_localization markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
