// Former t24_finance_hub_modularization view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t24_finance_hub_modularization markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
