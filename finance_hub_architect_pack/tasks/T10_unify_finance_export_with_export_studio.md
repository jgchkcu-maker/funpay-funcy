# T10 — Unify Finance export with Export Studio

> Read `../AGENT_CONTRACT.md` before executing this task.

## Context
The repository already has Export Studio supporting:
- XLSX
- DOCX
- PDF
- CSV
- JSON

Finance Hub also contains its own CSV/JSON flow.

## Goal
Avoid two divergent export engines.

## First step
Read and map:
- `window.FPTExportStudio`
- `window.FPTFinanceExport`
- Finance Hub export code

## Preferred solution
Either:
A. Finance Hub opens Export Studio with the selected Finance dataset; or
B. Finance Hub keeps a compact modal but delegates generation/download to the shared engine.

Choose the least duplicative design.

## Datasets
- Sales
- Purchases
- Operations
- Profit
- Potential

Unknown cost/profit must remain `null`, never silently become `0`.

## Acceptance
Finance Hub does not maintain a competing implementation of CSV/JSON totals/serialization.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
