# T03 — Refresh orchestration by subtab

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
The current Refresh button does not refresh every source required by the active view.

## Primary file
- `content/features/finance_hub.js`

## Required refresh matrix
| Subtab | Required refresh |
|---|---|
| Sales | `updateSales` |
| Purchases | `updatePurchases` |
| Operations | `updateFinance` |
| Profit | `updateSales`, then recalculate profit |
| Potential | inventory `forceRefresh:true` |
| Overview | `updateSales` + `updateFinance` + inventory `forceRefresh:true` |

Profit is derived from sales and must never claim to refresh without refreshing sales.

## Overview
Run independent source refreshes and retain individual results. `Promise.allSettled` is acceptable.

If only some sources succeed, show partial failure. Do not show a generic “overview updated” success.

## UI behavior
- disable Refresh while running;
- prevent concurrent duplicate refreshes;
- show spinner;
- restore button in finally;
- invalidate only relevant caches.

## Acceptance
One click causes exactly the expected source refresh sequence for the active tab.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
