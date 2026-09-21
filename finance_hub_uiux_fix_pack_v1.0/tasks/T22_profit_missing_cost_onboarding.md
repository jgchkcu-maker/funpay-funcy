# T22 — Profit missing-cost onboarding

## Problem / root cause

When sales exist but no cost basis is known, Profit correctly returns unknown/null metrics, but UI shows a wall of `—` values plus 0% coverage. This resembles a loading/error failure and gives no next action.

## Relevant current code

Files:
- `content/ui/main_popup.js`
- `content/features/finance_hub.js`
- `css/content_styles.css`

Anchors:
- Profit pane markup
- `renderProfitCards()`
- `renderProfitCoverage()`
- `renderProfitTable()`
- `renderProfitSubtab()`
- existing filter chips: `all`, `with-cost`, `without-cost`, `refunded`

## Required change

Introduce an explicit Profit state block that distinguishes:

1. loading
2. no sales in selected period
3. sales exist but `knownCostOrdersCount === 0`
4. partial cost coverage
5. full cost coverage

For case 3 show a clear message:
`Прибыль пока нельзя рассчитать`
with explanation that cost basis is missing, plus CTA:
`Показать заказы без себестоимости`

CTA must reuse the existing `without-cost` filter path, not create a second filtering implementation.

For partial coverage, show a concise partial-calculation notice (e.g. count/coverage) while retaining existing truthful metrics.

Do not fabricate zero cost, 100% margin, or any profit value when cost is unknown.

## Constraints

- Business truth remains in `profit_engine.js`.
- Null stays null.
- Existing Profit table/filter behavior remains the source of truth.

## Verification

Add `tests/t22_profit_missing_cost_onboarding.test.js` with cases:
- 0 orders
- 10 orders / 0 with known cost
- 10 / 4
- 10 / 10

Verify notice visibility and CTA filter behavior.

Run profit-related existing Finance tests and T22.

## Acceptance

A user can distinguish “no sales”, “missing cost basis”, “partial calculation”, and “complete calculation” without guessing.
