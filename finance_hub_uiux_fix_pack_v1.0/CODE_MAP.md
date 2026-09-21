# CODE_MAP.md

## Files inspected

### `content/features/finance_hub.js`
Current size at inspection: ~5491 lines.

Important areas/functions:
- controller state: top of file (`state`)
- Sales UI: `renderSalesSubtab`, `renderDetailsContent`, `renderCategoryDonut`
- Purchases UI: `renderPurchasesSubtab`, `renderPurchasesDetailsContent`, `renderPurchasesTopSellersCard`
- Operations UI: `renderOperationsSubtab`
- Potential UI: `renderPotentialCards`, `renderPotentialTable`, `renderPotentialSubtab`
- Profit UI: `renderProfitCards`, `renderProfitCoverage`, `renderProfitChart`, `renderProfitTable`, `renderProfitSubtab`
- Overview UI: `renderOverviewRow1`, `renderOverviewRow2`, `renderOverviewCharts`, `renderOverviewSubtab`
- custom range: `onCustomRangeApply`, `onCustomRangeReset`, `onPeriodChange`
- header filters: `setupHeaderFilters`, `updateHeaderFiltersVisibility`, `updateStatusSelectOptions`
- export: `ensureExportModalStyles`, `getDatasetForExport`, `openExportModal`, `closeExportModal`
- lifecycle/public API: bottom of file

### `content/ui/main_popup.js`
Finance Hub markup starts around the `data-page="finance_hub"` section.
Important IDs:
- `fptFinLastUpdated`
- `fptFinPeriodSelect`
- `fptFinCustomRange`
- `fptFinRefreshBtn`
- `fptFinExportBtn`
- `fptFinSubtabs`
- Finance pane DOM IDs referenced by controller

Current Finance custom-range labels are still English:
- `Custom range…`
- `From`
- `To`
- `Apply`
- `Reset`

### `css/content_styles.css`
Important current conflict:
- generic popup controls around the old popup form styles:
  `.fp-tools-popup select { width: 100%; padding: 12px; margin-bottom: 15px; ... }`
- Finance Hub CSS begins around the `Finance Hub — Styles & 12-Column Responsive Grid Primitives` section.
- Finance select override:
  `.fp-tools-popup select.fpt-fin-period-select, .fp-tools-popup .fpt-fin-period-select`
  currently sets `display:inline-block !important` but does not fully neutralize old `width:100%` / margins.
- `fpt-fin-donut-legend` uses vertical overflow and needs explicit horizontal overflow handling.

### `content/features/finance_data.js`
Important for T19:
- `formatKpiComparison()` currently produces user-facing `vs previous period`.

Do not move aggregation/business truth out of this file during UI tasks.

### `content/features/finance_potential.js`
Stock model is explicit:
- `stockKind: 'finite' | 'unknown' | 'unlimited'`
- aggregation returns:
  - `unknownStockOffers`
  - `unlimitedStockOffers`
  - `finiteOffers`
  - `totalActiveOffers`

Important: `unknownStockOffers` means unknown stock, **not zero stock**.
`finiteOffers` can include finite stock equal to 0.

### `content/features/profit_engine.js`
Profit truth stays here. UI tasks must not synthesize cost/profit when cost basis is unknown.

### `manifest.json`
Relevant current script order includes:
- `content/finance_db.js`
- `content/features/finance_data.js`
- `content/features/finance_potential.js`
- `content/features/profit_engine.js`
- `content/features/finance_hub.js`
- `content/ui/main_popup.js`
- later legacy `content/features/finance.js`
- `content/features/export_studio.js`

Before T24, re-check actual order and any load-order assumptions.

## Existing tests to protect

At minimum:
- `tests/t01_finance_atomic_refresh.test.js`
- `tests/t02_update_contract.test.js`
- `tests/t03_refresh_orchestration.test.js`
- `tests/t04_separate_statuses.test.js`
- `tests/t05_potential_period_semantics.test.js`
- `tests/t06_msk_calendar_model.test.js`
- `tests/t07_remove_guessed_fx.test.js`
- `tests/t08_source_freshness.test.js`
- `tests/t09_idempotent_lifecycle.test.js`
- `tests/t10_unify_finance_export.test.js`
- `tests/t11_custom_date_range.test.js`
- `tests/t12_previous_period_kpi_comparison.test.js`
- `tests/t14_final_integration_audit.test.js`
- `tests/finance_currency.test.js`
- `tests/finance_db_atomic.test.js`
- `tests/finance_filters.test.js`
- `tests/finance_refresh.test.js`
- `tests/finance_time.test.js`

## Existing architecture contracts that must survive

- Potential period selector hidden because Potential is a live snapshot.
- Operations status filter is separate from order status filter.
- Profit derives from Sales + cost basis, never from guessed costs.
- Overview combines Sales + Profit + Operations + Potential and preserves partial source semantics.
- Header freshness reflects source freshness, not render time.
- Export delegates to `FPTExportStudio.financeExport`.
