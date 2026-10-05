// Former t14_final_integration_audit view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t14_final_integration_audit markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
