// Refresh orchestration and status isolation now run without a view.
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
assertEmptyCategory('finance_hub');
// Behavioral coverage: popup_finance_actions.test.js, finance_refresh.test.js, t02_update_contract.test.js.
