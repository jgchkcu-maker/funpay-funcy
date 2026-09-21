# T15 — Finance filter CSS isolation

## Task

Isolate Finance Hub filter selects from the legacy `.fp-tools-popup select` layout contract.

## Baseline

Repository: `C:\Users\Nikita\Desktop\funpay-funcy`
HEAD: `79ee058`

## Files inspected

- `finance_hub_uiux_fix_pack_v1.0/tasks/T15_finance_filter_css_isolation.md`
- `css/content_styles.css`
- `content/features/finance_hub.js`
- `content/ui/main_popup.js`
- existing Finance regression tests

## Files changed

- `css/content_styles.css`
- `tests/t15_finance_filter_css_isolation.test.js`
- `finance_hub_uiux_fix_pack_v1.0/reports/T15_finance_filter_css_isolation_report.md`

## Root cause

The shared popup select rule sets `width: 100%` and `margin-bottom: 15px`. The existing Finance override changed visual styling but did not reset those layout properties, so the period, currency, status, and category controls expanded into separate full-width rows.

## Behaviour before

Finance selects inherited the generic full-width layout and legacy bottom margin.

## Behaviour after

The Finance-specific selector now explicitly uses automatic width, zero margin, bounded dimensions, border-box sizing, and `flex: 0 1 auto` so controls remain compact and wrap within the header filter row. The category select has a slightly wider upper bound for longer labels. The generic popup select rule is unchanged.

## Tests added/updated

- Added `tests/t15_finance_filter_css_isolation.test.js`.
- The test preserves the generic select contract and guards Finance overrides against `width: 100%`, legacy margin leakage, missing bounds, missing sizing, and missing flex wrapping behavior.

## Verification

Commands and exact results:

- `node tests/t15_finance_filter_css_isolation.test.js` → `T15_FINANCE_FILTER_CSS_ISOLATION_PASS`
- All tests under `tests/*.test.js` → `ALL_TESTS_PASS 20`
- `git diff --check` → no whitespace errors; Git emitted only its normal LF/CRLF conversion warning for `css/content_styles.css`
- `node --check` → not applicable; no JavaScript production file was changed

## Manual verification

Not run in a live extension popup in this environment. The CSS change is scoped to the existing Finance selector and the regression test covers the required selector contracts.

## Regression verification

All existing Finance tests passed, including currency, filtering, refresh, time semantics, lifecycle, export, custom range, KPI comparison, and final integration audit coverage.

## Known limitations

Visual confirmation across all six Finance subtabs and popup widths remains a manual follow-up when the extension is loaded in the browser.

## Out-of-scope findings

The worktree already contains deletions under `finance_hub_architect_pack/` and an untracked `finance_hub_uiux_fix_pack_v1.0/` pack before this task. Those changes were preserved and not modified as part of T15.

## Rollback

Revert the T15 additions in `css/content_styles.css`, remove `tests/t15_finance_filter_css_isolation.test.js`, and remove this report. The generic popup select rule does not need rollback because it was not changed.
