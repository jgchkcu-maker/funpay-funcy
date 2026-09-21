# T08 — Source freshness instead of render freshness

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Opening or rendering a tab can produce “updated just now” even when source data is old.

## Required sources
Sales → `fpToolsSalesLastUpdate`  
Purchases → `fpToolsPurchasesLastUpdate`  
Operations → `fpToolsFinanceLastUpdate`  
Profit → sales freshness  
Potential → time of real inventory fetch  
Overview → expose component freshness or use the oldest required source timestamp.

Never use the newest Overview source timestamp as overall freshness because it hides stale dependencies.

## Acceptance
Reopening a tab does not make stale data appear freshly updated.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
