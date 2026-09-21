# T02 — Truthful update result and freshness contract

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Update cycles can catch errors internally while outer message handlers still return success. Freshness can also be written in cleanup paths.

## Inspect
- `runSalesUpdateCycle`
- `runPurchasesUpdateCycle`
- `runFinanceUpdateCycle`
- handlers for `updateSales`, `updatePurchases`, `updateFinance`

## Required contract
Normalize all update actions to an explicit result:

Success:
`{ success: true, updatedAt, count }`

Failure:
`{ success: false, error }`

Throwing internally is acceptable if the message handler converts it correctly.

## Freshness invariant
`lastUpdate` is written only after a genuinely successful source update and durable commit.

`finally` may only:
- clear collecting flags,
- release locks,
- perform non-semantic cleanup.

## Acceptance
- network error → success false;
- parser error → success false;
- DB commit error → success false;
- all three preserve old lastUpdate.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
