# T09 — Idempotent lifecycle and event ownership

> Read `../AGENT_CONTRACT.md` before executing this task.

## Problem
Finance Hub business events are bound across both the Finance Hub controller and popup code. Multiple init/open paths raise duplicate-handler risk.

## Desired ownership
`FPTFinanceHub` owns Finance internal controls and business actions.

`main_popup.js` owns:
- navigation;
- page visibility;
- mount/open call.

## Required changes
Make `init(container)` idempotent.

Repeated init/open must not:
- bind duplicate listeners;
- trigger parallel duplicate fetches;
- reset user state;
- create duplicate modals/tooltips.

Remove or neutralize generic Finance-internal handlers in `main_popup.js` where the controller already owns the event.

## Acceptance
After opening/closing Finance Hub 10 times:
- one click → one handler;
- Refresh → one refresh sequence;
- one metric toggle → one render.

## Required task report
Use `../templates/TASK_REPORT_TEMPLATE.md`.

## Scope rule
Do not implement later tasks. Record unrelated findings under `Out-of-scope findings`.
