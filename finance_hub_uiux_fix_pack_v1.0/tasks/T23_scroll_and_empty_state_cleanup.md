# T23 — Scroll and empty-state cleanup

## Problem / root cause

Current UI can show nested/unnecessary scrollbars:
- donut legend can produce horizontal overflow
- empty wide tables can still show a horizontal scrollbar
- `renderPotentialTable()` currently applies `.fpt-fin-empty-state` directly to a `<td>`, while that class is a flex container

This makes empty/compact areas look like embedded pages.

## Relevant current code

Files:
- `content/features/finance_hub.js`
- `content/ui/main_popup.js`
- `css/content_styles.css`

Anchors:
- `renderCategoryDonut()`
- `.fpt-fin-donut-wrap`
- `.fpt-fin-donut-legend`
- `.fpt-fin-legend-row`
- `.fpt-fin-table-wrap`
- `renderPotentialTable()`
- Potential table markup

## Required change

Donut:
- vertical scroll is allowed if required
- explicitly prevent horizontal scroll
- ensure flex children use `min-width:0`
- retain ellipsis for long labels

Empty table:
- use a standalone empty-state block outside `<table>`
- when no rows match, hide table-wrap and show the empty state
- when rows exist, restore table-wrap and hide empty state

Apply the same pattern to another Finance table only if it has the exact same structural defect; otherwise record it as out of scope.

## Constraints

- Real populated tables may still use horizontal scrolling when genuinely wider than the viewport.
- Do not suppress needed data columns to eliminate scrolling.
- Do not alter table data semantics.

## Verification

Add `tests/t23_scroll_and_empty_state_cleanup.test.js`:
- donut CSS has `overflow-x:hidden`
- required flex elements have `min-width:0`
- Potential empty renderer does not create `<td class="fpt-fin-empty-state">`
- dedicated empty block/table wrap visibility contract exists

Manual check empty and populated Potential plus category donuts.

## Acceptance

No horizontal scrollbars appear on empty tables or donut legends; real wide populated tables remain usable.
