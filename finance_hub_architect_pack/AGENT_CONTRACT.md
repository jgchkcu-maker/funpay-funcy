# Gemini Flash Execution Contract

Repository: `jgchkcu-maker/funpay-funcy`

These rules apply to every task in this package.

## Operating model

Work on **one task only**. Do not solve later tasks pre-emptively.

Before editing:
1. Read every file listed in the task.
2. Search the repository for all consumers of functions/APIs you will touch.
3. Describe the current data flow briefly.
4. Only then modify code.

## Hard constraints

- One task = one problem domain.
- No opportunistic refactors.
- No visual redesign unless the task explicitly requires UI changes.
- Do not rename public APIs without a demonstrated need.
- Do not create duplicate sources of truth.
- Do not invent FunPay APIs, statuses, fields, response shapes, or parser semantics.
- If a structure is unknown, locate the real parser/consumer first.
- Never delete valid user data before a complete replacement dataset has been fetched and validated.
- Never write `lastUpdate` after a failed update.
- Never swallow an error and still return success.
- Never sum different currencies as if they were the same monetary unit.
- Never use fake FX rates as financial truth.
- Use one calendar model for finance day/week/month boundaries: **MSK (UTC+3)**.
- Loading, empty, partial-success, stale-data, and error states must be distinct.
- `forceReload` means refreshing the real source where applicable, not merely bypassing a UI cache.
- Do not add fallbacks that hide broken logic.
- Existing working sales/purchases behavior must not regress.
- Run the existing hardening test after every task:
  `node tests/t11_hardening.test.js`
- Add a regression test for any fixed bug whenever practical.

## Required completion report

Every task must end with:

### Changed
Exact files modified.

### Root cause
Why the bug existed.

### Behavior before
Observed/derived old behavior.

### Behavior after
New behavior.

### Tests
Exact commands and result.

### Remaining risks
Anything requiring live FunPay verification or intentionally left for a later task.

Do not proceed to the next task automatically.
