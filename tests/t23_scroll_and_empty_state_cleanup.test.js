// Former t23_scroll_and_empty_state_cleanup view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t23_scroll_and_empty_state_cleanup markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
