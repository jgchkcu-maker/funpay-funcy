# T14 — Final integration audit

> Read `../AGENT_CONTRACT.md` before executing this task.

## Goal
No new feature work. Audit the completed Finance Hub end-to-end.

## Verify data flows
Sales:
Refresh → fetch → DB → filter → aggregate → cards/chart/table

Purchases:
Refresh → fetch → DB → filter → aggregate → UI

Profit:
Refresh Sales → read Sales → cost snapshots → aggregate → UI

Operations:
Refresh → complete fetch → atomic replace → aggregate → UI

Potential:
Inventory fetch → stock/cost → potential → UI

Overview:
Fresh Sales + Operations + Inventory → derived Profit → dashboard

## Verify UI
- period
- custom period
- currency
- statuses
- categories
- refresh
- export
- drilldown
- subtabs
- open/close/reopen
- loading
- empty state
- error state
- partial refresh failure

## Final report table
| Feature | Working | Tested | Source of truth | Known limitation |
|---|---|---|---|---|

Do not mark “Working: yes” based only on successful rendering.

Distinguish:
- logically verified;
- unit tested;
- manually verified;
- requires live FunPay verification.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
