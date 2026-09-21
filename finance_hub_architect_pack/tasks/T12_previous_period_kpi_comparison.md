# T12 — Previous-period KPI comparison

> Read `../AGENT_CONTRACT.md` before executing this task.

## Prerequisite
Custom date range complete.

## Goal
Compare current period to the immediately previous equal-length period.

Examples:
- 7 days → previous 7 days;
- 30 days → previous 30 days;
- custom Sep 10–18 → previous equal-duration range.

## Initial KPIs
- Revenue
- Orders
- Average check
- Realised profit

## Display
Examples:
- `+12.4% vs previous period`
- `−8.1%`

If previous value = 0, do not emit Infinity/NaN. Show a neutral unavailable state.

Currency comparisons must stay within the same currency.

## Acceptance
Comparison uses exact period boundaries and cannot mix currencies.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
