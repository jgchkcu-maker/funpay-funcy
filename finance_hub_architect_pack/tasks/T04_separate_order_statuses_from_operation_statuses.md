# T04 — Separate order statuses from operation statuses

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Order statuses and finance-operation statuses are different domains but currently share one state path.

## Real domains
Orders:
- `closed`
- `paid`
- `refunded`

Finance operations:
- `complete`
- `cancel`
- `waiting`

## Required state
Use separate state, e.g.:
- `orderStatus`
- `operationStatus`

Equivalent naming is fine if domains remain isolated.

## UI
Sales/Purchases/Profit:
- All
- Closed
- Paid
- Refunded

Operations:
- All
- Complete
- Cancelled
- Waiting

Potential:
- no status control.

Overview:
- order-status may filter Sales/Profit;
- do not pass order-status into operations.

## Acceptance
Switching tabs cannot carry an incompatible status value into another data domain.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
