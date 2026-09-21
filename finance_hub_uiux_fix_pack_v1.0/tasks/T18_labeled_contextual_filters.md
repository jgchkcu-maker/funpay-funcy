# T18 — Labeled contextual filters

## Problem / root cause

Finance filters currently present bare values like `Все статусы` and are partly created dynamically by `setupHeaderFilters()`. Their meaning changes by subtab, but only ARIA labels explain that.

Dynamic creation also splits layout ownership between HTML and JS.

## Relevant current code

Files:
- `content/ui/main_popup.js`
- `content/features/finance_hub.js`
- `css/content_styles.css`

Anchors:
- Finance filterbar from T17
- `setupHeaderFilters(container)`
- `updateStatusSelectOptions(subtab)`
- IDs `fptFinPeriodSelect`, `fptFinCurrencySelect`, `fptFinStatusSelect`, `fptFinCategorySelect`

## Required change

Mount the base filter controls statically in `main_popup.js` with visible labels/wrappers:
- Период
- Валюта
- Статус заказа / Статус операции
- Категория

Controller should bind/populate existing controls rather than build the normal production layout at runtime.

`updateStatusSelectOptions()` must update both:
- options/value/aria-label
- visible status label: `Статус заказа` vs `Статус операции`

Visibility logic from T16 should hide the **entire wrapper** so no orphan label remains.

A defensive fallback for test harnesses is acceptable, but production markup must be static.

## Constraints

- Preserve all existing filter IDs.
- Do not introduce duplicate filters.
- Do not move filter state ownership out of `FPTFinanceHub`.

## Verification

Add `tests/t18_labeled_contextual_filters.test.js`:
- required static IDs/wrappers exist in `main_popup.js`
- status visible label can switch between order/operation context
- Potential hides status wrapper
- Operations hides category wrapper

## Acceptance

Every visible filter has an understandable label and no production layout depends on runtime-created select elements.
