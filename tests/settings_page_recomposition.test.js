// Former settings_page_recomposition view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('general: settings_page_recomposition markup is removed and search metadata remains', () => assertEmptyCategory('general'));
