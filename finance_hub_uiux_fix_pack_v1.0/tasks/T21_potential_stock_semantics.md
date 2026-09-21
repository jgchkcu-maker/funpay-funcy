# T21 — Potential stock semantics

## Problem / root cause

`finance_potential.js` explicitly distinguishes:
- finite
- unknown
- unlimited

and aggregates:
- `finiteOffers`
- `unknownStockOffers`
- `unlimitedStockOffers`
- `totalActiveOffers`

But Finance UI currently renders `unknownStockOffers` as `без остатка`, which is false: unknown means the stock could not be determined.

Also `finiteOffers` means a finite/known numeric stock and can include `stock === 0`, so `N с остатком` is also semantically unsafe.

## Relevant current code

Files:
- `content/features/finance_hub.js`
- read-only business reference: `content/features/finance_potential.js`

Anchors:
- `renderPotentialCards()`
- `renderOverviewRow2()`
- `renderPotentialTable()`
- fields listed above

## Required change

Use one truthful contract in both Overview and Potential.

Preferred KPI:
- title/value concept: `Лоты в продаже` = `totalActiveOffers`
- subtitle breakdown:
  - `N с известным остатком`
  - `N остаток неизвестен`
  - `N без лимита`

If layout requires shortening, abbreviate wording but preserve semantics.

Do not label `unknownStockOffers` as zero stock.

Potential table:
- finite numeric → `N шт.`
- unlimited → `∞` with understandable title
- unknown → `Не указан` or `Неизвестен` with tooltip explaining the stock could not be determined

Overview and Potential must use the same meaning.

## Constraints

- Do not change parsing or aggregation semantics in `finance_potential.js`.
- Do not convert unknown to zero.
- Do not exclude finite stock 0 from finite semantics unless the business engine itself changes in another task.

## Verification

Add `tests/t21_potential_stock_semantics.test.js` covering:
- finite stock 0
- finite stock > 0
- unknown
- unlimited

Static test must forbid user-facing `unknownStockOffers` → `без остатка` mapping.

Run T05 plus focused T21.

## Acceptance

Every stock label accurately reflects the domain value behind it.
