# Finance Hub quality completion

## Goal

Complete the existing Finance Hub repair pack from T18 through T24. Preserve the current data and refresh contracts while fixing the identified filter, localization, export-theme, stock-semantics, profit-onboarding, and empty-state issues. Finish with a behavior-preserving split of the Finance Hub controller.

## User and success criteria

The seller can understand every visible filter and every stock/profit state without interpreting hidden labels or misleading counts. The export dialog follows the active popup theme. Empty tables do not render page-like nested scroll areas. The controller is divided by responsibility without changing its public API, data behavior, or appearance.

## Design

### Filters and localization (T18–T19)

- Keep the existing filter IDs and state ownership in `FPTFinanceHub`.
- Mount period, currency, status, and category controls and their visible labels/wrappers statically in `main_popup.js`.
- Switch the visible status label between `Статус заказа` and `Статус операции`; hide whole wrappers according to the existing subtab visibility matrix.
- Keep Potential as a live snapshot, Operations with operation statuses and no category filter, and all other subtabs with order statuses.
- Translate user-facing custom-range labels and validation text to Russian. Preserve internal keys, date boundaries, and comparison mathematics.

### Export theme (T20)

- Move export modal styles to `content_styles.css` and remove runtime style injection.
- Keep the overlay under `document.body`; copy the active popup's required theme variables to the overlay before display.
- Preserve `FPTExportStudio.financeExport`, CSV/JSON output, Escape, overlay-click, and close-button behavior.

### Inventory semantics (T21)

- Use `totalActiveOffers` for the active-lots KPI.
- Show finite known stock, unknown stock, and unlimited stock as separate truthful counts. A finite stock value of zero remains finite and is not described as positive stock.
- In the table, render finite quantities as `N шт.`, unlimited as `∞` with an explanatory accessible label, and unknown as an unknown state with explanatory text or tooltip.
- Apply the same meanings in Overview and Potential. Do not change `finance_potential.js` aggregation.

### Profit states (T22)

- Distinguish loading, no eligible sales, sales without known cost, partial coverage, and full coverage in the Profit UI.
- For sales with no known cost, explain that profit cannot yet be calculated and provide `Показать заказы без себестоимости` wired to the existing `without-cost` filter.
- For partial coverage, show a concise notice while retaining the existing truthful calculations.
- Keep null metrics unknown; do not synthesize costs or profit.

### Empty states and scroll (T23)

- Render the Potential empty state outside the table and hide the table wrapper when there are no matching rows; restore it for populated rows.
- Prevent horizontal overflow in the donut legend and ensure its flex children can shrink. Keep vertical legend scrolling where needed.
- Keep horizontal scrolling available for populated tables where the content needs it.

### Modularization (T24)

- Perform only after T18–T23 are implemented and verified.
- Split Finance UI responsibilities into ordered classic scripts under a `FPTFinanceHubModules` namespace, with explicit context objects; keep `finance_hub.js` as the state/lifecycle/router/refresh/public-API orchestrator.
- Load modules after `finance_data.js`, `finance_potential.js`, and `profit_engine.js`, and before `finance_hub.js`.
- Preserve the existing `FPTFinanceHub` API and all domain aggregation in its current engine files. Do not use ES module imports/exports or add circular ownership.

## Constraints

- Preserve T01–T17 data, period, currency, status, refresh, lifecycle, and export contracts.
- Do not change aggregation formulas, parsing semantics, database behavior, cost-basis truth, or guessed-FX behavior.
- Keep the existing shell and visual hierarchy; this work completes the stated repair pack rather than introducing a new redesign.
- Add focused regression coverage for each T18–T24 task and run directly affected tests after each task. T24 requires the complete Finance test set.

## Verification and limitations

- Verify static markup, state transitions, and source contracts with focused Node tests.
- Run the full repository test set, `node --check` on changed JavaScript, and `git diff --check` before completion.
- Compare all six subtabs, empty states, missing/partial/full cost coverage, and stock variants in light/dark themes and narrow/wide layouts when a live extension page is available. The current in-app browser has no FunPay tab, so that visual checkpoint may remain unavailable in this environment and must be reported honestly.

## Scope boundary

No changes to unrelated seller navigation, settings, or other Finance business engines are included. Any unrelated defect discovered during implementation is reported separately rather than silently folded into this work.
