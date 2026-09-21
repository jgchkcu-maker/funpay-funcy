# T24 — Finance Hub modularization (behavior-preserving)

## Problem / root cause

`content/features/finance_hub.js` is ~5.5k lines and owns state, filters, charts, every subtab, export, modals, refresh, tooltip, drilldown, and lifecycle. This broad ownership is the architectural reason CSS/UI responsibilities keep colliding.

T24 is not a redesign. It runs only after T15–T23 are complete.

## Relevant current code

Files:
- `content/features/finance_hub.js`
- `manifest.json`
- all Finance regression tests
- domain truth remains in:
  - `finance_data.js`
  - `finance_potential.js`
  - `profit_engine.js`

## Required change

Split UI/controller modules without ES module syntax because these are ordered content scripts.

Suggested namespace files:

- `content/features/finance_hub/finance_hub_shared.js`
- `finance_hub_filters.js`
- `finance_hub_sales.js`
- `finance_hub_purchases.js`
- `finance_hub_operations.js`
- `finance_hub_profit.js`
- `finance_hub_potential.js`
- `finance_hub_overview.js`
- `finance_hub_export.js`
- keep `content/features/finance_hub.js` as thin lifecycle/state/router/refresh/public API layer

Use a namespace such as `FPTFinanceHubModules` and explicit context objects rather than new hidden globals.

Ownership:
- controller: state, init/open/leave, subtab routing, cache invalidation, refresh orchestration, public API
- filters: header/filter/custom-range UI
- subtab modules: rendering/bindings only for their subtab
- export: modal/dataset UI glue
- shared: formatting/tooltips/common UI adapters

Do not move business aggregation out of domain files.

Update `manifest.json` order so module scripts load before `finance_hub.js`, while their domain dependencies load first.

Preserve current `FPTFinanceHub` public API and any methods used by tests.

## Constraints

- Behavior and appearance must match post-T23.
- No ES `import`/`export`.
- No new cross-module circular ownership.
- Do not combine this refactor with unrelated cleanup.
- Perform extraction in logical phases and run tests between phases.

## Verification

Add `tests/t24_finance_hub_modularization.test.js`:
- expected module files exist
- manifest order is correct
- public API remains present
- domain business files remain the source of aggregation truth

Run the **full Finance suite**, including T15–T23 and T01–T14 applicable tests.

Manual compare all six subtabs against the verified post-T23 UI.

## Acceptance

`finance_hub.js` becomes a materially thinner orchestrator, responsibilities are separated, all Finance tests pass, and no visible/behavioral change is introduced by T24.
