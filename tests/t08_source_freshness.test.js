// Former t08_source_freshness view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t08_source_freshness markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
