# T13 — Finance regression test suite

> Read `../AGENT_CONTRACT.md` before executing this task.

## Context
`tests/t11_hardening.test.js` already protects portions of profit, aggregation and potential.

## Add dedicated coverage
Suggested files:
- `tests/finance_db_atomic.test.js`
- `tests/finance_refresh.test.js`
- `tests/finance_filters.test.js`
- `tests/finance_time.test.js`
- `tests/finance_currency.test.js`

Using existing `node:assert/strict` style is acceptable.

## Minimum scenarios
- finance failure before first page preserves DB;
- finance failure mid-pagination preserves DB;
- successful finance refresh atomically replaces DB;
- failure preserves lastUpdate;
- failure reaches UI as failure;
- Profit refresh invokes Sales refresh;
- Overview refresh invokes Sales + Operations + Inventory;
- operation `complete` filter works;
- order status cannot reach operations;
- MSK boundary is deterministic;
- multi-currency `all` is not guessed into one monetary value;
- Potential hides period semantics;
- repeated init produces no duplicate handlers;
- missing cost remains unknown/null.

## Required existing test
Keep running:
`node tests/t11_hardening.test.js`

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
