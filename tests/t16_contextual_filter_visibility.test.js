// Former t16_contextual_filter_visibility view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t16_contextual_filter_visibility markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
