// Former t15_finance_filter_css_isolation view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t15_finance_filter_css_isolation markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
