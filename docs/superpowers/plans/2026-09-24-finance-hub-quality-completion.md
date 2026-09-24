# Finance Hub quality completion plan

## Goal

Complete Finance Hub repair tasks T18–T24 under the approved design in `docs/superpowers/specs/2026-09-24-finance-hub-quality-design.md`.

## Constraints

- Work on branch `codex/finance-hub-quality`.
- Follow the repository's required order: T18 → T19 → T20 → T21 → T22 → T23 → T24.
- Write a focused regression test first for each behavior change, verify it fails for the expected reason, then make the smallest implementation change and run the focused test.
- Preserve Finance data, period, currency, status, refresh, lifecycle, export, and public API contracts through T01–T17.
- Do not change aggregation, parsing, database, cost-basis, or FX semantics in `finance_data.js`, `finance_potential.js`, or `profit_engine.js` unless a task explicitly requires it (none do).
- Keep `FPTFinanceHub` as the source of filter state and preserve the existing status and profit filter paths.
- Run `node --check` on changed JavaScript, `git diff --check`, the directly affected tests after each stage, and the complete repository test set at completion.
- Manual live screenshots are unavailable because the in-app browser has no FunPay tab; report this limitation rather than claiming visual verification.

## Files and ownership

- `content/ui/main_popup.js`: static filter wrappers and labels; Profit and Potential empty/onboarding blocks.
- `content/features/finance_hub.js`: filter binding/visibility, localization strings, export theme propagation, inventory/profit rendering, table visibility, then T24 orchestrator/router.
- `css/content_styles.css`: labeled filter layout, shared-theme export modal, Profit state block, empty-state and donut overflow rules.
- `content/features/finance_hub/*.js`: T24 responsibility modules loaded before the orchestrator.
- `manifest.json`: ordered module loading.
- `tests/t18_labeled_contextual_filters.test.js` through `tests/t24_finance_hub_modularization.test.js`: focused contracts; update old T17 expectations where they assert runtime-created filters.
- `tests/t12_previous_period_kpi_comparison.test.js`: preserve localized comparison text expectations.

## Tasks

### 1. T18 — Static, labeled contextual filters

1. Add `t18_labeled_contextual_filters.test.js` for one static wrapper and visible label per preserved control ID, no duplicate controls, status-label switching, and wrapper visibility on Potential/Operations.
2. Run it and confirm it fails because the wrappers are absent.
3. Mount period/currency/status/category wrappers and labels in `main_popup.js`; retain custom-range markup and IDs.
4. Bind existing controls in `setupHeaderFilters`; retain a defensive missing-markup fallback only for harnesses. Update status text and aria-label together. Hide complete wrappers in `updateHeaderFiltersVisibility`.
5. Update the T17 static hierarchy test so it asserts static filter ownership rather than runtime append behavior.
6. Run T18, T17, T16, T04, T05, and `finance_filters` tests.

### 2. T19 — Russian Finance UI strings

1. Add `t19_finance_ui_localization.test.js` for the listed custom-period labels and validation copy.
2. Run it red.
3. Localize custom period, range labels/buttons, aria label, and validation message. Preserve internal keys and date logic. Keep the already-localized `к пред. периоду` output and its math.
4. Update any stale T12 assertions only if they still expect the old English UI text.
5. Run T19, T11, T12, `finance_time`, and `finance_currency`.

### 3. T20 — Theme-aware export modal

1. Add `t20_export_modal_theme_integration.test.js` for stylesheet ownership, token usage, absence of runtime style injection/hardcoded surface palette, and theme-variable propagation.
2. Run it red.
3. Move `.fpt-fin-export-*` styles into the Finance CSS section, remove `ensureExportModalStyles()`, copy the active popup theme variables to the body-level overlay before display, and replace hardcoded presentation colors with theme classes/tokens.
4. Preserve delegated export behavior, CSV/JSON actions, Escape, overlay-click, and close-button handling.
5. Run T20, T10, `finance_operations_modal_theme`, and relevant export tests.

### 4. T21 — Truthful Potential stock semantics

1. Add `t21_potential_stock_semantics.test.js` for finite zero, positive finite, unknown, and unlimited stock in Potential and Overview.
2. Run it red.
3. Use `totalActiveOffers` as the card value and render a breakdown for known finite, unknown, and unlimited stock in Potential and Overview. Keep finite zero distinguishable from positive availability where the UI claims stock is available.
4. Add an accessible explanation for unknown stock in the table; retain `∞` for unlimited.
5. Run T21, T05, `finance_overview_visual_contract`, and existing Potential/Overview tests.

### 5. T22 — Profit cost-coverage states

1. Add `t22_profit_missing_cost_onboarding.test.js` for loading, zero eligible orders, eligible orders with zero known costs, partial coverage, and full coverage; assert the CTA reuses the existing `without-cost` path.
2. Run it red.
3. Render distinct state notices without changing profit-engine values. Reuse the existing filter chip handler/path for the CTA. Keep null metrics rendered as unknown.
4. Run T22, `finance_profit_missing_cost_ui`, T12, and all Profit-related tests.

### 6. T23 — Empty tables and scroll cleanup

1. Add `t23_scroll_and_empty_state_cleanup.test.js` for the standalone Potential empty block, empty/populated wrapper visibility, donut `overflow-x:hidden`, and shrinkable flex children.
2. Run it red.
3. Move Potential's empty state outside the `<table>`, toggle the table wrapper and empty block together, and update donut layout rules without suppressing populated table columns.
4. Run T23, T21, `finance_overview_layout_cleanup`, and existing grid/table tests.

### 7. T24 — Behavior-preserving modularization

1. Add `t24_finance_hub_modularization.test.js` for module presence/order, public API preservation, and domain-file ownership.
2. Run it red.
3. Extract filters, export glue, shared UI helpers, and the six subtab renderers into ordered classic scripts under `FPTFinanceHubModules`, passing explicit context objects.
4. Leave state, lifecycle, routing, cache invalidation, refresh orchestration, and public API in a materially thinner `finance_hub.js`.
5. Update `manifest.json` so modules follow the domain engines and precede the orchestrator.
6. Run T24 red/green, the complete Finance suite, all repository tests, syntax checks, and `git diff --check`.
7. Use one `gpt-6-luna` subagent for the T24 extraction after T18–T23 are verified, with no concurrent edits to shared Finance files; inspect its complete diff before accepting it.

## Completion checks

- All focused T18–T24 tests pass.
- All 47 baseline tests and any new repository tests pass.
- `FPTFinanceHub` public API is unchanged; the Finance domain engines remain the source of calculations.
- No live visual verification claim is made without a loaded FunPay extension tab.
- Final `git status` and diff clearly show the completed Finance Hub work.
