# T07 — Remove guessed FX from Finance Hub truth

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Multiple inconsistent hard-coded rates are used to normalize currencies for charts.

## Principle
No precise Finance Hub monetary KPI or chart may combine currencies without an explicit FX source/date.

## Required behavior
- currency=RUB → monetary graph uses RUB only;
- currency=USD → USD only;
- currency=EUR → EUR only;
- currency=all with multiple currencies → do not create one guessed monetary axis.

Safe UX:
`Select a currency to view the monetary chart`

Counts can still aggregate across currencies.

If a dataset contains only one currency, auto-graphing it is acceptable.

## Inspect
- `finance_hub.js` RATES
- `finance_data.js` rates
- operations charts
- Overview revenue chart
- legacy normalized fields

## Compatibility
If deprecated legacy fields are required by older UI, preserve them only after finding consumers. Finance Hub must not use guessed normalization as financial truth.

## Regression fixture
`1000 RUB + 10 USD` must never appear as one converted monetary total in Finance Hub without explicit FX mode.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
