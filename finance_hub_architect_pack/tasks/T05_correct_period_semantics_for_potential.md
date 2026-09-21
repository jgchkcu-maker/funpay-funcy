# T05 — Correct period semantics for Potential

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Potential represents current inventory state, not historical time-series data. Showing “Today / 7 days / Year” is misleading.

## Required behavior
On Potential:
- hide historical period selector;
- optionally show a neutral label such as `Current snapshot`;
- Refresh must refresh inventory.

When returning to a time-based tab, restore the user's previous period selection.

## Acceptance
The UI cannot imply “inventory potential for last year” when no historical inventory is stored.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
