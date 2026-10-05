// Former finance_overview_layout_cleanup view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: finance_overview_layout_cleanup markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
