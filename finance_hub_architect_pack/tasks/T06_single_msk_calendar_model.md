# T06 — Single MSK calendar model

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Period filtering uses MSK semantics while chart grouping can use the machine's local timezone.

## Required design
Create reusable pure MSK calendar helpers, e.g.:
- `getMskParts(timestamp)`
- `getMskDayKey(timestamp)`
- `getMskMonthKey(timestamp)`
- `getMskWeekKey(timestamp)`

Exact names are flexible.

Use the same model for:
- period boundaries;
- sales daily grouping;
- weekly grouping;
- Overview revenue graph;
- Overview profit graph;
- operations byDay;
- operations byMonth.

MSK = fixed UTC+3, no DST.

## Mandatory fixtures
`2026-09-20T20:59:59Z` → 20.09.2026 23:59:59 MSK  
`2026-09-20T21:00:00Z` → 21.09.2026 00:00:00 MSK

Tests must pass regardless of OS timezone.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
