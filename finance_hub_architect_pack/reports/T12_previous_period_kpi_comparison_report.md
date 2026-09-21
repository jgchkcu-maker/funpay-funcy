# Task Completion Report

## Task
T12 — Previous-period KPI comparison

## Changed
- `C:\FunPayDev\content\features\finance_data.js`:
  * Added `resolvePreviousPeriodRange(period, options)`: calculates strictly preceding equal-duration MSK boundaries for rolling presets (`7d`, `30d`, `24h`, `90d`, `365d`), calendar days (`today` → `yesterday`, `yesterday` → day before yesterday), and custom date ranges (`{ from, to }` / `{ start, end }`); returns `null` for `all` (unbounded).
  * Added `formatKpiComparison(currVal, prevVal, options)`: safeguards against zero baselines / divide-by-zero (R13 in `RISK_REGISTER.md`) by rendering a neutral unavailable state (`—`) instead of `Infinity` or `NaN`; formats positive deltas with `+`, negative deltas with unicode minus `\u2212`, rounded to 1 decimal place, accompanied by `vs previous period` badge markup.
  * Added `compareKpis(current, previous, options)`: enforces strict currency isolation across Revenue, Orders, Average check, and Realised profit. Does not sum across different currencies or guess exchange rates; if currencies mismatch or no common currency exists, returns neutral unavailable state.
- `C:\FunPayDev\content\features\finance_hub.js`:
  * Queries previous-period sales and profit in `renderOverviewSubtab` and `renderSalesSubtab`.
  * Renders KPI comparison badges in Overview Row 1 cards (Revenue, Realised Net Profit, Paid Orders, Average Check) and subtab cards without breaking existing subtitles or drill-down triggers.
  * Preserves comparison results in `state.cachedOverviewData`, `state.cachedSalesKpiDiffs`, `state.cachedPrevProfitData`.
  * Exports `resolvePreviousPeriodRange`, `formatKpiComparison`, and `compareKpis` on the Finance Hub facade.
- `C:\FunPayDev\css\content_styles.css`:
  * Added badge styles: `.fpt-fin-kpi-diff`, `.fpt-fin-diff-positive`, `.fpt-fin-diff-negative`, `.fpt-fin-diff-neutral`, `.fpt-fin-diff-value`, `.fpt-fin-diff-label`, `.fpt-fin-sub-extra`.
- `C:\FunPayDev\tests\t12_previous_period_kpi_comparison.test.js`:
  * Dedicated test suite covering exact MSK period boundaries, R13 zero-baseline fixtures, percentage math, unicode minus formatting, currency isolation, Finance Hub integration, historical DB filtering, and odd custom date ranges.
- `C:\FunPayDev\MODIFIED_FILE`
- `C:\FunPayDev\DIFF_FILE`
- `C:\FunPayDev\VERIFICATION.txt`
- `C:\FunPayDev\ROLLBACK.sh`

## Root cause
Finance Hub had no mechanism to compute preceding equal-length time ranges or compare current KPIs against previous-period baselines. Previous implementations were prone to divide-by-zero bugs (`Infinity%` or `NaN%`), improper multi-currency mixing, and timezone off-by-one errors when shifting calendar periods.

## Behavior before
Overview and subtab KPI cards showed only static metric totals for the current period with no historical context. There was no comparison badge or indicator showing whether revenue, orders, average check, or profit increased or decreased compared to the immediately preceding equal-length interval.

## Behavior after
- Finance Hub computes the exact immediately preceding equal-duration MSK time window (e.g., current 7d → previous 7d; custom Sep 10–18 → previous Sep 01–09).
- Overview Row 1 cards and subtabs render comparison badges (`+12.4% vs previous period`, `−8.1% vs previous period` using unicode minus `\u2212`, or `0.0% vs previous period`).
- When the previous period baseline is zero, unavailable, or missing, no `Infinity` or `NaN` is emitted; a neutral unavailable badge (`—`) is rendered.
- Currency comparisons strictly isolate currencies; mixed multi-currency datasets without a single selected currency do not sum across currencies and safely display neutral unavailable state.

## Tests
- Baseline T01–T11 suite → all PASS, exit 0.
- `node tests/t12_previous_period_kpi_comparison.test.js` → `T12_PREVIOUS_PERIOD_KPI_COMPARISON_PASS`, exit 0.
- Full regression suite (T01–T12 and T11 hardening) → all 13 suites PASS, exit 0.
- `node --check` across `finance_data.js`, `finance_hub.js`, `main_popup.js`, and `t12_previous_period_kpi_comparison.test.js` → exit 0.
- `git diff --check` → exit 0.
- `C:\FunPayDev\ROLLBACK.sh` on `t12_rollback_fixture/target` → restored BASE hashes, exit 0.

## Manual verification
- Inspected calculation of previous-period boundaries across presets (`7d`, `30d`, `24h`, `today`, `yesterday`) and custom ranges.
- Inspected zero-baseline behavior (R13): verified no `Infinity` or `NaN` is produced in any KPI calculation or DOM markup.
- Verified unicode minus symbol (`\u2212`) is used in negative deltas.
- Verified currency isolation: different currencies (e.g. USD vs EUR) do not combine.
- Verified that Overview Row 1 card subtitles and click drilldown actions remain intact.

## Remaining risks
Live browser verification on FunPay web pages with live IndexedDB storage is still needed to inspect long-term cache memory impact when fetching double datasets for custom ranges.

## Out-of-scope findings
T13 (Regression test harness hardening) and T14 (Performance audit) remain untouched as specified by the task roadmap and scope boundaries.
