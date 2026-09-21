# Proposed focused tests

The implementation agent should add these tests to the repository as tasks are completed:

- `tests/t15_finance_filter_css_isolation.test.js`
- `tests/t16_contextual_filter_visibility.test.js`
- `tests/t17_finance_header_information_architecture.test.js`
- `tests/t18_labeled_contextual_filters.test.js`
- `tests/t19_finance_ui_localization.test.js`
- `tests/t20_export_modal_theme_integration.test.js`
- `tests/t21_potential_stock_semantics.test.js`
- `tests/t22_profit_missing_cost_onboarding.test.js`
- `tests/t23_scroll_and_empty_state_cleanup.test.js`
- `tests/t24_finance_hub_modularization.test.js`

Keep tests focused on contracts. Do not overfit to exact line numbers or whitespace.

Prefer:
- source-contract assertions for static ownership/layout requirements
- small VM/fake-DOM tests for visibility/state behavior
- existing domain tests for calculation truth

T24 must run the full Finance regression set.
