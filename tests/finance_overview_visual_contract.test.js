// Former finance_overview_visual_contract view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: finance_overview_visual_contract markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
