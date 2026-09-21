# T19 — Finance Hub Russian localization

## Problem / root cause

User-facing Finance UI still mixes Russian and English.

Known current strings:
- `Custom range…`
- `From`
- `To`
- `Apply`
- `Reset`
- `vs previous period`
- validation text using `From` / `To`

`finance_data.js::formatKpiComparison()` currently generates English suffixes in both HTML and formatted text, and T12 tests currently assert those English strings.

## Relevant current code

Files:
- `content/ui/main_popup.js`
- `content/features/finance_hub.js`
- `content/features/finance_data.js`
- `tests/t12_previous_period_kpi_comparison.test.js`

## Required change

User-facing translations:
- `Custom range…` → `Произвольный период…`
- `From` → `С`
- `To` → `По`
- `Apply` → `Применить`
- `Reset` → `Сбросить`
- `vs previous period` → `к пред. периоду`

Prefer validation wording `Начальная дата не может быть позже конечной.`

Keep internal keys (`custom`, `from`, `to`, etc.) unchanged.

Update T12 expected strings without changing any comparison mathematics.

`Hub` badge may remain as a product label.

## Constraints

- No formula changes.
- No period boundary changes.
- No renaming internal APIs/storage keys.

## Verification

Add `tests/t19_finance_ui_localization.test.js` that checks known Finance user-facing source fragments no longer contain the English labels.

Update T12 expected text and run T11/T12 plus focused T19.

## Acceptance

Finance Hub user-facing UI is consistently Russian while internal identifiers remain stable.
