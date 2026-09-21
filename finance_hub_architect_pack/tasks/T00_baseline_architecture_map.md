# T00 — Baseline architecture map

> Read `../AGENT_CONTRACT.md` before executing this task.

## Goal
Make no source changes. Build a complete map of Finance Hub before any fix.

## Read completely
- `manifest.json`
- `background/background.js`
- `background/finance_db.js`
- `background/sales_db.js`
- `background/purchases_db.js`
- `content/finance_db.js`
- `content/features/finance_data.js`
- `content/features/finance_hub.js`
- `content/features/profit_engine.js`
- `content/features/finance_potential.js`
- `content/features/export_studio.js`
- `content/ui/main_popup.js`
- `tests/t11_hardening.test.js`

Also locate the real implementation handling `parseFinancePage`.

## Deliverables
For each subtab — Overview, Sales, Purchases, Profit, Potential, Operations — document:

`source → storage → adapter → filter → aggregation → render → refresh action`

Create a table with:
- dataset,
- source,
- storage,
- update action,
- last-update source,
- status model,
- period model.

Search and report all usages of:
`RATES`, `USD: 90`, `EUR: 98`, `0.011`, `lastUpdate`, `clearAll`,
`updateSales`, `updatePurchases`, `updateFinance`,
`complete`, `closed`, `paid`, `refunded`, `waiting`, `cancel`.

## Forbidden
No code changes.

## Done when
The architecture map is complete enough to explain every value shown by Finance Hub.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
