// Former auto_review_ui_contract view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('auto_review: auto_review_ui_contract markup is removed and search metadata remains', () => assertEmptyCategory('auto_review'));
