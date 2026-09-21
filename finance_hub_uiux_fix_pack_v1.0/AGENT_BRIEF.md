# AGENT_BRIEF.md

You are implementing the Finance Hub UI/UX repair pack in `jgchkcu-maker/funpay-funcy`.

Read in this order:
1. `README.md`
2. `CODE_MAP.md`
3. `EXECUTION_ORDER.md`
4. the current task file
5. current production source files referenced by that task

Do one task at a time. Do not implement future tasks early.

Treat function/class/ID names as anchors; do not trust stale line numbers.

For every task:
- inspect current source before editing
- implement only the required scope
- add/update focused regression coverage
- run directly affected old tests
- run `node --check` on modified JS
- run `git diff --check`
- write a report in `reports/`

If a task discovers an unrelated defect, record it under `Out-of-scope findings` and continue without expanding scope.

T24 is strictly behavior-preserving and must run only after T15–T23 are complete and verified.
