# Finance Hub UI/UX Fix Pack v1.0

Repository: `jgchkcu-maker/funpay-funcy`  
Baseline inspected: `79ee0585c3d8e92f78b8baf828c4c57800a3e4bd`  
Scope: Finance Hub UI/UX only.  
Production code must **not** be changed by this pack itself; these files are implementation specifications for an agent.

## Goal

Fix the current Finance Hub UI/UX problems without breaking the already-implemented Finance contracts T00–T14:
- Sales/Purchases/Operations data sources and refresh flow
- Profit cost-basis semantics
- Potential snapshot semantics
- MSK period handling
- per-currency truth without guessed FX
- source freshness
- idempotent lifecycle
- export facade
- custom range
- previous-period KPI comparison

## Execution order

`T15 → T16 → T17 → T18 → T19 → T20 → T21 → T22 → T23 → T24`

T24 is a behavior-preserving refactor and must be done last.

## General rules

1. Before editing, re-open the current version of every target file. Line numbers in this pack are anchors only; function/class names are authoritative.
2. Do not change Finance formulas, parser semantics, DB semantics, refresh orchestration, currency truth, or status truth unless a task explicitly says so.
3. `FPTFinanceHub` owns Finance internal behavior. `main_popup.js` owns static popup markup/navigation and mounts the controller.
4. Do not reintroduce guessed currency conversion.
5. `potential` remains a current inventory snapshot, not a historical period.
6. `operations` uses operation statuses; Sales/Purchases/Profit/Overview use order statuses.
7. Prefer static markup + CSS layout + controller state/visibility. Avoid new inline layout styles.
8. Do not globally change generic `.fp-tools-popup select` behavior to fix Finance Hub.
9. Add a focused regression test per task.
10. After every task run `node --check` on changed JS and `git diff --check`.
11. Record unrelated discoveries under `Out-of-scope findings`; do not silently expand scope.

## Task file format

Each task contains only:
- Problem / root cause
- Relevant current code
- Required change
- Constraints
- Verification
- Acceptance criteria

This is intentionally compact so a capable coding agent can reason from the code instead of mechanically following dozens of micro-steps.
