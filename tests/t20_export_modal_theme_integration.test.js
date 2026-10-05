// Former t20_export_modal_theme_integration view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t20_export_modal_theme_integration markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
