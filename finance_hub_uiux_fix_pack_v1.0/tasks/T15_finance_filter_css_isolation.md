# T15 — Finance filter CSS isolation

## Problem / root cause

The generic popup rule in `css/content_styles.css` applies to every `<select>` under `.fp-tools-popup` and includes `width:100%` and `margin-bottom:15px`.

Finance Hub later styles `.fpt-fin-period-select`, but its override does not fully neutralize those old layout properties. Result: period/currency/status/category selects stretch into full-width rows and push Refresh/Export into awkward positions.

## Relevant current code

Files:
- `css/content_styles.css`

Anchors:
- generic `.fp-tools-popup select` rule near the old popup form styles
- Finance Hub section `Finance Hub — Styles & 12-Column Responsive Grid Primitives`
- `.fp-tools-popup select.fpt-fin-period-select, .fp-tools-popup .fpt-fin-period-select`

## Required change

Isolate Finance selects locally. The Finance-specific rule must explicitly neutralize old layout values, e.g.:
- `width:auto !important`
- `margin:0 !important` / `margin-bottom:0 !important`
- sensible `min-width`
- bounded `max-width`
- `box-sizing:border-box`
- flex behavior that permits wrapping without full-width stretching

Do **not** change the generic `.fp-tools-popup select` contract because other pages may rely on it.

Category may be slightly wider than other filters.

## Constraints

- CSS-only task unless a very small markup class is strictly required.
- Do not alter Finance state, filter values, refresh behavior, or controller logic.
- Avoid JS-set widths.

## Verification

Add `tests/t15_finance_filter_css_isolation.test.js` that:
- confirms the generic popup select rule still exists
- confirms Finance-specific select rules override width/margins
- guards against reverting Finance controls to `width:100%`

Manual:
- Overview/Sales/Purchases/Profit/Potential/Operations
- wide/medium/narrow popup
- verify compact filters and normal wrapping

Run affected existing Finance tests plus `git diff --check`.

## Acceptance

- Finance filters no longer occupy one full row each.
- No legacy 15px bottom margin remains on Finance selects.
- Other popup forms are unaffected.
