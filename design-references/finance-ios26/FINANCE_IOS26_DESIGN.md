# Finance Hub — iOS 26 redesign

## Direction

The Finance Hub is redesigned as a calm desktop analytics workspace inside FunPay Funcy:

- Liquid Glass is reserved for navigation, segmented controls, filters, and transient actions.
- Charts, tables, and KPI data use standard high-contrast surfaces instead of glass-on-glass cards.
- The primary reading order is `identity → subtab → contextual filters → decision metrics → detail`.
- Light mode is the reference state; the same tokens should support a dark adaptive variant.
- Blue is the product accent, green means positive/incoming, red means cost/outflow/refund, amber means unknown data.

## Source contracts preserved

The source has six Finance Hub subtabs:

1. Обзор
2. Продажи
3. Покупки
4. Прибыль
5. Потенциал
6. Операции

The redesign keeps the current business meaning:

- Потенциал is a live inventory snapshot, not a historical period.
- Потенциал hides period and order-status filters; only snapshot context, currency, and category remain.
- Операции uses operation statuses and does not show a category filter.
- Sales, Purchases, Profit, and Overview use order statuses.
- Profit never invents cost basis. Unknown cost/profit/margin/ROI values render as `—`, not zero.
- Multiple currencies remain explicit; no guessed FX conversion is introduced.
- Unknown inventory stock is not treated as zero stock. It is displayed as `Неизвестно`.

## Screen references

- [01 — Overview](01-overview.png)
- [02 — Sales](02-sales.png)
- [03 — Purchases](03-purchases.png)
- [04 — Profit](04-profit.png)
- [05 — Potential](05-potential.png)
- [06 — Operations](06-operations.png)

## Screen-by-screen intent

### Overview

Hero KPIs: revenue, net profit, orders, average check. Follow with one dominant trend chart, category structure, top products, and recent finance events.

### Sales

Prioritize sales trend, category mix, and order detail. The table is the main work surface with order, lot, buyer, date, amount, and status.

### Purchases

Prioritize spend, purchased units, average purchase, and completed purchases. Show expense trend, top sellers, and purchase history with supplier context.

### Profit

Make cost coverage a first-class concept. Show realized profit, cost, margin, ROI, coverage percentage, and a table that preserves unknown values as `—`.

### Potential

Replace historical filters with a snapshot badge and timestamp. Show potential revenue/profit, inventory value, active lots, stock-quality states, and active-offer detail.

### Operations

Use a ledger mental model: deposits, withdrawals, fees, net flow, balance movement, movement structure, and an operation history table. No product thumbnails or category filter.

## States to implement after visual approval

- Loading: compact skeletons inside the same layout, never a blank page.
- Empty: standalone empty-state block outside the table element; no nested horizontal scrollbar.
- Partial data: source freshness and coverage message remain visible.
- Profit without cost basis: inline guidance plus `—` values, never fabricated zeros.
- Potential unknown stock: `Неизвестно` state with an explanatory tooltip/side panel.
- Custom range: localized Russian labels `С`, `По`, `Применить`, `Сбросить`.
- Export: modal uses the same standard surface system, with dataset tabs and CSV/JSON actions.
- Dark mode: same hierarchy and contrast, with Liquid Glass tint derived from the background rather than a fixed white overlay.

## Implementation handoff

Keep the existing controller selectors and data contracts in `content/features/finance_hub.js`. The preferred implementation order is:

1. Rebuild static Finance Hub shell and contextual filter wrappers.
2. Replace the current dense card grid with the screen-specific hierarchy shown in the references.
3. Preserve existing chart/table renderers where semantics are correct; restyle their containers and empty states.
4. Add visible status/coverage labels rather than relying on ARIA-only context.
5. Verify light and dark themes, narrow popup widths, keyboard focus, custom range, empty tables, and multi-currency states.

## Evidence note

The current live extension could not be opened in the Codex in-app browser during this pass because no browser tab or loaded extension instance was available. The redesign is grounded in the inspected source markup, Finance Hub controller, CSS, existing UI/UX fix pack, and the existing FunPay Funcy navigation reference.
