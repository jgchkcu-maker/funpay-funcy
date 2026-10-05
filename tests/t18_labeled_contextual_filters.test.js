// Former t18_labeled_contextual_filters view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t18_labeled_contextual_filters markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
