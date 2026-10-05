// Former quick_replies_navigation view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('templates: quick_replies_navigation markup is removed and search metadata remains', () => assertEmptyCategory('templates'));
