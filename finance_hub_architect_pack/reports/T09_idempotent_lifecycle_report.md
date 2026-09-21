# Task Completion Report

## Task
T09 — Idempotent lifecycle and event ownership

## Changed
- `C:\FunPayDev\content\features\finance_hub.js`
- `C:\FunPayDev\content\ui\main_popup.js`
- `C:\FunPayDev\tests\t09_idempotent_lifecycle.test.js`
- `C:\FunPayDev\MODIFIED_FILE`
- `C:\FunPayDev\DIFF_FILE`
- `C:\FunPayDev\VERIFICATION.txt`
- `C:\FunPayDev\ROLLBACK.sh`

## Root cause
`init()` restored state, rebound controller handlers, and started a render on every call. `onOpen()` repeated the same setup/render path, while `main_popup.js` also attached generic Finance handlers for chart toggles, filters, refresh, and period changes.

## Behavior before
Repeated init/open cycles started duplicate renders/fetches and reassigned Finance handlers. Finance actions were split between the controller and popup code.

## Behavior after
The controller mounts each container once, reuses the pending initial render promise, preserves state across repeated open/close cycles, and owns period/refresh controls. Popup code retains navigation, visibility, mount, and open responsibilities only.

## Tests
- `node tests/t09_idempotent_lifecycle.test.js` → `T09_IDEMPOTENT_LIFECYCLE_PASS`
- `node tests/t01_finance_atomic_refresh.test.js` → `T01_FINANCE_ATOMIC_REFRESH_PASS`
- `node tests/t02_update_contract.test.js` → `T02_UPDATE_CONTRACT_PASS`
- `node tests/t03_refresh_orchestration.test.js` → `T03_REFRESH_ORCHESTRATION_PASS`
- `node tests/t04_separate_statuses.test.js` → `T04_SEPARATE_STATUSES_PASS`
- `node tests/t05_potential_period_semantics.test.js` → `T05_POTENTIAL_PERIOD_SEMANTICS_PASS`
- `node tests/t06_msk_calendar_model.test.js` → `T06_SINGLE_MSK_CALENDAR_MODEL_PASS`
- `node tests/t07_remove_guessed_fx.test.js` → `T07_REMOVE_GUESSED_FX_PASS`
- `node tests/t08_source_freshness.test.js` → `T08_SOURCE_FRESHNESS_PASS`
- `node tests/t11_hardening.test.js` → `T11_HARDENING_PASS elapsed_10k_ms=3.95`

## Manual verification
`node --check` passed for both changed JavaScript files and the new regression test. The T09 harness exercised ten init/open/close cycles, verified one initial fetch and one binding per controller control, preserved the `30d` period, and verified that a new container receives one binding. `ROLLBACK.sh` restored a separate target copy to the BASE hashes and left `MODIFIED_FILE` changed.

## Remaining risks
Live FunPay popup verification is still required for browser-specific DOM/event behavior. No later task was implemented.

## Out-of-scope findings
- The existing repository has no package-level test runner; the architect-pack Node test commands were run individually.
- New-container remounts invalidate the prior render tokens; T09 does not change cross-container data-source orchestration.

