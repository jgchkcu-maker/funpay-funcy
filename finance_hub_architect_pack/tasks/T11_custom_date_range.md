# T11 — Custom date range

> Read `../AGENT_CONTRACT.md` before executing this task.

## Prerequisite
T01–T10 complete.

## Existing capability
`resolvePeriodRange()` already supports object ranges such as `{ start, end }`.

## Required UI
Add `Custom range…` to period selection.

Provide:
- From
- To
- Apply
- Reset

Store selection in Finance Hub state/sessionStorage.

## Time semantics
Interpret calendar dates using the unified MSK model, not browser timezone.

Apply to:
- Sales
- Purchases
- Profit
- Operations
- Overview time-based data

Do not apply to Potential snapshot.

## Validation
- from <= to;
- end date includes the user's full selected MSK day;
- no rows in a valid range = empty state, not error.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
