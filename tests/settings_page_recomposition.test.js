// The «general» settings page was retired completely: no shell, no search metadata, no actions.
const test = require('node:test');
const { assertRetiredCategory } = require('./helpers/empty_category_contract');
test('general: settings_page_recomposition page is retired from the menu, search and actions', () => assertRetiredCategory('general'));
