# T16 — Contextual filter visibility

## Problem / root cause

`finance_hub.js` hides some controls with ordinary `element.style.display = 'none'`, while Finance CSS forces `.fpt-fin-period-select { display:inline-block !important; }`.

This creates real UI logic errors:
- Potential can still show order status
- Operations can still show category

The period selector already uses an `!important` inline workaround in one branch, proving the conflict exists.

## Relevant current code

Files:
- `content/features/finance_hub.js`
- `css/content_styles.css`

Anchors:
- `updateStatusSelectOptions(subtab)`
- `updateHeaderFiltersVisibility(subtab)`
- `setupHeaderFilters(container)`
- `.fpt-fin-period-select`

## Required change

Create one visibility contract instead of scattered style mutations.

Preferred:
- CSS utility `.fpt-fin-control-hidden { display:none !important; }`
- small helper such as `setFinanceControlVisible(el, visible)` that toggles the class and appropriate ARIA state

Responsibility split:
- `updateStatusSelectOptions()` only changes status options/value/label semantics
- `updateHeaderFiltersVisibility()` only decides which filter wrappers/controls are visible

Required matrix:
- Overview: period, currency, order status, category
- Sales: period, currency, order status, category
- Purchases: period, currency, order status, category
- Profit: period, currency, order status, category
- Potential: snapshot, currency, category; no period/status
- Operations: period, currency, operation status; no category

Custom range must disappear on Potential and restore when leaving Potential without changing the stored period.

## Constraints

- Do not merge orderStatus and operationStatus.
- Do not reset filter values when merely hiding controls.
- Potential remains snapshot semantics.

## Verification

Add `tests/t16_contextual_filter_visibility.test.js` with a lightweight DOM mock and assert the matrix across subtab changes.

Static guards should prevent reintroducing direct `statusSelect.style.display = ...` / `catSelect.style.display = ...` behavior if the helper becomes the contract.

Run at least T04, T05, finance_filters and focused T16.

## Acceptance

The visible filter set exactly matches the matrix on all six subtabs and survives subtab round-trips.
