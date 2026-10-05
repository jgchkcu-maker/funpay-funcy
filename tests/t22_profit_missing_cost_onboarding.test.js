// Former t22_profit_missing_cost_onboarding view was retired for the empty category shell.
const test = require('node:test');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('finance_hub: t22_profit_missing_cost_onboarding markup is removed and search metadata remains', () => assertEmptyCategory('finance_hub'));
