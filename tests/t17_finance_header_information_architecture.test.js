// Former t17_finance_header_information_architecture view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t17_finance_header_information_architecture markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
