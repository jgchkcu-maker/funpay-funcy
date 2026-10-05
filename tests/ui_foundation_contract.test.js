// Former ui_foundation_contract view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('general: ui_foundation_contract markup is removed and search metadata remains', () => assertEmptyCategory('general'));
