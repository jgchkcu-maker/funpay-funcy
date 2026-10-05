// Former auto_reply_pages view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('auto_reply: auto_reply_pages markup is removed and search metadata remains', () => assertEmptyCategory('auto_reply'));
