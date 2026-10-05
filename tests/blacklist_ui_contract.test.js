// Former blacklist_ui_contract view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('blacklist: blacklist_ui_contract markup is removed and search metadata remains', () => assertEmptyCategory('blacklist'));
