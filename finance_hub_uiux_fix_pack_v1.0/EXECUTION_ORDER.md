# EXECUTION_ORDER.md

## Required order

1. T15 — isolate Finance filters from legacy select CSS
2. T16 — fix contextual visibility contract
3. T17 — reorder header / tabs / filters
4. T18 — make filters statically mounted and visibly labeled
5. T19 — remove mixed RU/EN Finance UI strings
6. T20 — move Export modal into the shared theme/design system
7. T21 — fix stock semantics in Potential/Overview
8. T22 — add explicit Profit missing-cost state
9. T23 — remove nested/empty-state scroll artifacts
10. T24 — split `finance_hub.js` without behavior changes

## Checkpoints

After T19:
- inspect all 6 Finance subtabs in light and dark theme
- verify filter visibility/labels and custom range behavior

After T23:
- full UI/UX checkpoint across all subtabs, empty states, multiple currencies, missing cost, stock variants

After T24:
- full Finance regression suite
- compare UI against post-T23 screenshots/state; T24 must not alter behavior or appearance
