# T10 Unify Finance Export with Export Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Finance Hub's dataset selection and compact preview while making Export Studio's shared Finance export engine the only CSV/JSON serializer and downloader for Sales, Purchases, Operations, Profit, and Potential.

**Architecture:** `FPTFinanceHub` will prepare the selected dataset and metadata, then resolve the canonical shared facade at `FPTExportStudio.financeExport`. The compact Finance Hub modal remains presentation-only and will not build CSV/JSON or calculate export totals independently; the shared `FPTFinanceExport` implementation exposed by Export Studio remains the single generation/download engine.

**Tech Stack:** Browser JavaScript, Node.js built-in `assert`, `vm`, source-level and engine-equivalence regression tests.

**Spec:** `finance_hub_architect_pack/tasks/T10_unify_finance_export_with_export_studio.md`

## Global Constraints

- Work on one task only; do not solve T11+.
- Read and map `window.FPTExportStudio`, `window.FPTFinanceExport`, and Finance Hub export code before editing.
- Unknown cost/profit remains `null`, never silently `0`.
- Finance Hub must not maintain a competing CSV/JSON totals or serialization implementation.
- Run `node tests/t11_hardening.test.js` after the task.

## Review Focus

- Finance Hub resolves the shared engine through `FPTExportStudio.financeExport`; regression test: `testFinanceHubDelegatesToExportStudioEngine`.
- All five datasets reach the shared downloader with unchanged items, totals, and metadata; regression test: `testAllFinanceDatasetsDelegateWithoutSerialization`.
- Missing cost/profit stays `null` in shared CSV/JSON output; regression test: `testUnknownCostAndProfitRemainNull`.
- The Finance Hub source contains no competing `buildCSV`, `buildJSON`, or serializer implementation; regression test: `testFinanceHubHasNoCompetingSerializer`.
- Existing Finance Hub metadata semantics for potential snapshot and separate statuses remain intact; regression test: existing T04/T05 tests plus T10 delegation assertions.

---

### Task 1: Add failing shared-export delegation regression coverage

**Files:**
- Create: `tests/t10_unify_finance_export.test.js`
- Read: `content/features/finance_hub.js`
- Read: `content/features/export_studio.js`

**Interfaces:**
- Consumes: `FPTFinanceHub.getDatasetForExport`, `FPTFinanceHub.exportFinanceData`, `FPTExportStudio.financeExport`, and `FPTFinanceExport.buildCSV/buildJSON`.
- Produces: executable proof that Finance Hub delegates all export generation and preserves null semantics.

- [x] **Step 1: Write the failing test**

Load `finance_hub.js` and `export_studio.js` in isolated VM contexts. The Finance Hub test context exposes only `FPTExportStudio.financeExport.download`, not a legacy root `FPTFinanceExport`, then calls `hub.exportFinanceData` for all five datasets. Assert that the shared engine receives the dataset, format, raw items, totals, and metadata unchanged.

```js
async function testFinanceHubDelegatesToExportStudioEngine() {
    const calls = [];
    const env = createHubEnv({
        FPTExportStudio: { financeExport: {
            download: (...args) => { calls.push(args); return { delegated: true, args }; }
        } }
    });
    for (const dataset of ['sales', 'purchases', 'operations', 'profit', 'potential']) {
        await env.hub.exportFinanceData(dataset, 'json');
    }
    assert.deepEqual(calls.map(([dataset]) => dataset), ['sales', 'purchases', 'operations', 'profit', 'potential']);
    assert.ok(calls.every(([, format]) => format === 'json'));
}
```

- [x] **Step 2: Run the focused test to verify the current implementation fails**

Run: `node tests/t10_unify_finance_export.test.js`

Expected: FAIL because current Finance Hub resolves `window.FPTFinanceExport` directly instead of the canonical `window.FPTExportStudio.financeExport` facade.

- [x] **Step 3: Add source and null-semantic assertions**

Assert that `finance_hub.js` contains no `function buildCSV`, `function buildJSON`, or local `JSON.stringify` export serializer, and execute the shared engine's `buildCSV`/`buildJSON` with missing cost/profit values to require literal `null` output.

- [x] **Step 4: Run the focused test again**

Run: `node tests/t10_unify_finance_export.test.js`

Expected: FAIL only on the missing canonical delegation, not on the test harness or fixture setup.

### Task 2: Delegate Finance Hub export through Export Studio

**Files:**
- Modify: `content/features/finance_hub.js:4559-4565`
- Test: `tests/t10_unify_finance_export.test.js`

**Interfaces:**
- Consumes: `window.FPTExportStudio.financeExport.download(dataset, format, items, totals, meta)`.
- Produces: unchanged `FPTFinanceHub.exportFinanceData` API with shared-engine ownership.

- [x] **Step 1: Resolve the canonical shared facade**

Change `exportFinanceData` to read `window.FPTExportStudio.financeExport` (or the equivalent root object) and require its `download` function. Keep `getDatasetForExport` as the data/metadata adapter only. Do not add CSV/JSON serialization to Finance Hub.

- [x] **Step 2: Preserve the five-dataset contract and null values**

Keep the existing Sales, Purchases, Operations, Profit, and Potential data preparation intact. The shared engine remains responsible for `formatItem`, CSV/JSON serialization, totals summaries, MIME, and download behavior; unknown cost/profit fields continue to flow as `null`.

- [x] **Step 3: Run the focused test to verify it passes**

Run: `node tests/t10_unify_finance_export.test.js`

Expected: `T10_UNIFY_FINANCE_EXPORT_PASS` with delegation calls for all five datasets and null-preserving CSV/JSON output.

- [x] **Step 4: Run the hardening and regression suite**

Run: `node tests/t11_hardening.test.js`

Expected: `T11_HARDENING_PASS`.

Run: `node tests/t01_finance_atomic_refresh.test.js; node tests/t02_update_contract.test.js; node tests/t03_refresh_orchestration.test.js; node tests/t04_separate_statuses.test.js; node tests/t05_potential_period_semantics.test.js; node tests/t06_msk_calendar_model.test.js; node tests/t07_remove_guessed_fx.test.js; node tests/t08_source_freshness.test.js; node tests/t09_idempotent_lifecycle.test.js; node tests/t10_unify_finance_export.test.js; node tests/t11_hardening.test.js`

Expected: every command exits `0`.

### Task 3: Produce the T10 report and verification artifacts

**Files:**
- Create: `finance_hub_architect_pack/reports/T10_unify_finance_export_report.md`
- Create: `t10_artifacts/MODIFIED_FILE`
- Create: `t10_artifacts/DIFF_FILE`
- Create: `t10_artifacts/VERIFICATION.txt`
- Create: `t10_artifacts/ROLLBACK.sh`

- [x] **Step 1: Capture baseline hashes and diff**

Capture the BASE hashes of `content/features/finance_hub.js` and the new T10 test, then create `t10_artifacts/MODIFIED_FILE` as the changed Finance Hub copy and `t10_artifacts/DIFF_FILE` with the complete source/test diff.

- [x] **Step 2: Create and execute rollback on a separate copy**

Create `t10_rollback_fixture/baseline`, `modified`, and `target`; make `t10_artifacts/ROLLBACK.sh` restore the baseline source to `target`, run syntax checks, verify the baseline hash, and leave `t10_artifacts/MODIFIED_FILE` changed.

- [x] **Step 3: Record exact BASELINE/MODIFIED/ROLLBACK commands and outputs**

Write the changed branch/fields, four artifact paths, exact command input, literal output/result, exit status, and restored behavior/status to `t10_artifacts/VERIFICATION.txt`.

- [x] **Step 4: Fill the required report template**

Complete `finance_hub_architect_pack/reports/T10_unify_finance_export_report.md` with Changed, Root cause, Behavior before/after, Tests, Manual verification, Remaining risks, and Out-of-scope findings.

- [x] **Step 5: Reopen every artifact**

Read all four T10 artifacts and the task report after creation, then report completion without implementing T11+.
