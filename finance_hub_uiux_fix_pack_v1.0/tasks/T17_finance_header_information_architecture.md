# T17 — Finance header information architecture

## Problem / root cause

Current static markup puts `.fpt-fin-period-wrap` inside `.fpt-fin-header-right` together with Refresh/Export, while subtabs come later.

This mixes page actions and filters and makes users choose filters before the context (subtab) that defines what those filters mean.

## Relevant current code

Files:
- `content/ui/main_popup.js`
- `css/content_styles.css`
- controller selectors in `content/features/finance_hub.js` must remain valid

Anchors:
- `data-page="finance_hub"`
- `.fpt-fin-header`
- `.fpt-fin-header-right`
- `.fpt-fin-period-wrap`
- `.fpt-fin-subtabs-wrap`

## Required change

Restructure static Finance markup to this hierarchy:

1. Finance title + Hub badge + freshness
2. header action group containing only Refresh and Export
3. subtabs
4. dedicated filter bar
5. active pane content

Keep existing control IDs so controller/test contracts survive.

Suggested conceptual DOM:
- `.fpt-fin-header`
  - `.fpt-fin-header-left`
  - `.fpt-fin-header-actions`
- `.fpt-fin-subtabs-wrap`
- `.fpt-fin-filterbar`
  - `.fpt-fin-period-wrap`
- pane containers

Custom range may occupy a second line inside the filter bar.

Avoid stacking redundant visual dividers between header/subtabs/filterbar.

## Constraints

- Do not change data/filter logic in this task.
- Do not rename existing IDs referenced by `finance_hub.js`.
- Refresh/Export stay page-level actions.

## Verification

Add `tests/t17_finance_header_information_architecture.test.js` that reads `main_popup.js` and asserts DOM-order/source-order contracts:
header < subtabs < filterbar < first pane.

Assert Refresh/Export belong to header actions while period select belongs to filterbar.

Manual verification at wide/medium/narrow popup.

## Acceptance

Visual reading order becomes: page identity → subtab → contextual filters → data.
