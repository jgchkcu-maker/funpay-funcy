# T09 Idempotent Finance Hub Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make Finance Hub initialization/opening idempotent, keep Finance business events in `FPTFinanceHub`, and keep `main_popup.js` limited to navigation, visibility, and mount/open calls.

**Architecture:** `FPTFinanceHub.init(container)` will bind controller-owned header controls once per container and render only when a first mount or a changed container requires it. `onOpen()` will reuse the mounted controller without resetting state or starting another render while the same render is pending. `main_popup.js` will keep navigation/subtab presentation and call controller lifecycle methods, while removing generic chart/filter/refresh/period handlers that duplicate controller ownership.

**Tech Stack:** Browser JavaScript, Node.js built-in `assert`, `vm`, source-level regression tests.

**Spec:** `finance_hub_architect_pack/tasks/T09_idempotent_lifecycle_and_event_ownership.md`

## Global Constraints

- Work on one task only; do not implement later tasks.
- `FPTFinanceHub` owns Finance internal controls and business actions.
- `main_popup.js` owns navigation, page visibility, and mount/open calls.
- Repeated init/open must not bind duplicate listeners, trigger parallel duplicate fetches, reset user state, or create duplicate modals/tooltips.
- Run `node tests/t11_hardening.test.js` after the task.

## Review Focus

- Ten open/close cycles must leave exactly one controller binding per Finance control and one render/fetch sequence per meaningful action; regression test: `testRepeatedInitAndOpenIsIdempotent`.
- A second open while the initial render is pending must not start a parallel render; regression test: `testOpenDuringInitialRenderDoesNotDuplicateFetch`.
- User-selected `period`, `activeSubtab`, and filters survive repeated init/open; regression test: `testRepeatedInitPreservesControllerState`.
- `main_popup.js` must not own Finance business handlers; regression test: `testMainPopupOnlyMountsAndNavigatesFinanceHub`.
- Reinitializing with a genuinely new container must bind the new container exactly once; regression test: `testNewContainerGetsOneBinding`.

---

### Task 1: Add a failing T09 lifecycle/ownership regression test

**Files:**
- Create: `tests/t09_idempotent_lifecycle.test.js`
- Read: `content/features/finance_hub.js`
- Read: `content/ui/main_popup.js`

**Interfaces:**
- Consumes: `FPTFinanceHub.init`, `FPTFinanceHub.onOpen`, `FPTFinanceHub.getState`, controller-owned `setupHeaderFilters`, and Finance source text.
- Produces: executable regression coverage for init/open idempotence and ownership boundaries.

- [x] **Step 1: Write the failing test**

Create a Node test that loads `finance_hub.js` in a VM with a fake DOM whose elements count `addEventListener` and `onclick` assignments. Exercise ten `init(container)` plus `onOpen()` cycles, keep the initial `getSales` promise pending, and assert one pending render/fetch, one binding per control, preserved state, and no duplicate Finance-specific handlers in `main_popup.js`.

```js
async function testRepeatedInitAndOpenIsIdempotent() {
    const env = createHubEnvironment();
    const firstRender = env.pendingSales;
    env.hub.init(env.container);
    for (let i = 0; i < 10; i++) {
        env.hub.init(env.container);
        env.hub.onOpen();
    }
    assert.equal(env.salesCalls, 1);
    assert.equal(env.controls.refresh.addEventListenerCalls, 0);
    assert.equal(env.controls.period.onchangeAssignments, 1);
    assert.equal(env.controls.export.onclickAssignments, 1);
    assert.equal(env.hub.getState().period, '30d');
    firstRender.resolve([]);
}
```

- [x] **Step 2: Run the test to verify it fails for the current lifecycle**

Run: `node tests/t09_idempotent_lifecycle.test.js`

Expected: FAIL because repeated `init`/`onOpen` starts duplicate renders and controller header assignments are re-run; the failure must identify the observed duplicate count rather than a test harness error.

- [x] **Step 3: Add the remaining red assertions**

Add assertions for the new-container path, state preservation, and ownership source contract:

```js
assert.equal(env.newControls.period.onchangeAssignments, 1);
assert.doesNotMatch(mainPopupSource, /chartToggles\.forEach|filterChips\.forEach/);
assert.doesNotMatch(mainPopupSource, /refreshBtn\.addEventListener|periodSelect\.addEventListener/);
```

- [x] **Step 4: Run the focused test again**

Run: `node tests/t09_idempotent_lifecycle.test.js`

Expected: FAIL only on the behavior required by T09, with the current source still binding Finance-internal handlers from `main_popup.js` and starting duplicate init/open renders.

### Task 2: Implement idempotent controller lifecycle and event ownership

**Files:**
- Modify: `content/features/finance_hub.js:33-94,4116-4191,5000-5055`
- Modify: `content/ui/main_popup.js:2672-2821`
- Test: `tests/t09_idempotent_lifecycle.test.js`

**Interfaces:**
- Consumes: the failing T09 tests and existing controller render functions.
- Produces: `FPTFinanceHub.init(container)` that mounts once per container, `onOpen()` that reuses the mount without duplicate work, and controller-owned Finance control handlers.

- [x] **Step 1: Add controller binding state and idempotent mount guards**

Track the container that has already been mounted and the active initial render promise/token. `init(container)` must return immediately for the same container after ensuring the controller remains mounted; it must not restore storage or call a render again. A different container must replace the mount, bind it once, and render the active subtab once.

- [x] **Step 2: Make header filter/event binding controller-owned and repeat-safe**

Keep `onchange`/`onclick` assignment in `setupHeaderFilters` because assignment replaces a previous handler. Add an explicit per-container binding marker for any `addEventListener` path and ensure generated snapshot/currency/status/category controls are reused rather than appended. Preserve `state.period`, `state.activeSubtab`, status, category, and currency across same-container init/open calls.

- [x] **Step 3: Make `onOpen()` reuse the mounted controller without parallel initial render**

If the current container is mounted and its active subtab is already rendering, return the existing render promise/token rather than dispatching a second render. Re-read only the persisted subtab when it differs from the current controller state and render only after a real subtab change.

- [x] **Step 4: Remove duplicate generic Finance-internal handlers from `main_popup.js`**

Retain navigation/subtab visibility and the calls to `onSubtabChange`, `init`, and `onOpen`. Remove generic chart-toggle, filter-chip, refresh-button, and period-selector business handlers from `setupFinanceHubUI`; Finance controller render/bind functions remain the sole owners of these actions.

- [x] **Step 5: Run focused T09 and existing regression tests**

Run: `node tests/t09_idempotent_lifecycle.test.js`

Expected: PASS with the exact marker `T09_IDEMPOTENT_LIFECYCLE_PASS`.

Run: `node tests/t01_finance_atomic_refresh.test.js; node tests/t02_update_contract.test.js; node tests/t03_refresh_orchestration.test.js; node tests/t04_separate_statuses.test.js; node tests/t05_potential_period_semantics.test.js; node tests/t06_msk_calendar_model.test.js; node tests/t07_remove_guessed_fx.test.js; node tests/t08_source_freshness.test.js; node tests/t11_hardening.test.js`

Expected: every command exits `0`; any pre-existing or introduced failure is recorded in the task report.

### Task 3: Produce the required task report and verification artifacts

**Files:**
- Create: `finance_hub_architect_pack/reports/T09_idempotent_lifecycle_report.md`
- Create: `MODIFIED_FILE`
- Create: `DIFF_FILE`
- Create: `VERIFICATION.txt`
- Create: `ROLLBACK.sh`

- [x] **Step 1: Capture the original hashes and changed-file diff**

Use `git hash-object` before modification for the source files and `git diff -- content/features/finance_hub.js content/ui/main_popup.js tests/t09_idempotent_lifecycle.test.js`; write the changed branch/fields and exact paths into `VERIFICATION.txt`.

- [x] **Step 2: Create a changed copy and an executable rollback script**

`MODIFIED_FILE` will contain the changed Finance controller copy. `DIFF_FILE` will contain the source diff. `ROLLBACK.sh` will restore a separate verification copy from the captured baseline, then run the rollback test against that copy. Keep the real source files changed.

- [x] **Step 3: Run baseline, modified, and rollback commands**

Record exact command, literal result, and exit status for each phase. Baseline runs the full existing suite before the code edit; modified runs T09 plus the full regression suite; rollback runs on a separate copy and must restore the baseline hash/behavior.

- [x] **Step 4: Fill the required report template**

Complete every section of `finance_hub_architect_pack/templates/TASK_REPORT_TEMPLATE.md`, including `Out-of-scope findings`, and do not implement T10+.

- [x] **Step 5: Reopen every claimed artifact and verify contents**

Read `MODIFIED_FILE`, `DIFF_FILE`, `VERIFICATION.txt`, `ROLLBACK.sh`, and the task report after creation; only then report completion.

