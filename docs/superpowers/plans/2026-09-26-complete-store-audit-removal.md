# Complete Store Audit Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AI store-audit feature, its runtime/UI integrations, and its current and historical project references while preserving unrelated FunPay Funcy features and the user's existing work.

**Architecture:** Delete the dedicated content module and its manifest entry; remove the page, navigation/search entries, CSS, and AI prompt modes. Then clean existing navigation expectations and the dated documentation/UI-review frame that describe the page. Keep the existing unknown-page fallback to `lot_io` for saved routes.

**Tech Stack:** JavaScript content scripts, Chrome extension manifest, CSS, Markdown, HTML, CSV, Node test fixtures (edited only; not run).

**Spec:** `docs/superpowers/specs/2026-09-26-complete-store-audit-removal-design.md`

## Global Constraints

- Remove the page, menu entry, search results, page styles, loader, AI requests, and feature description.
- Preserve other features, shared AI behavior, and all unrelated uncommitted user changes.
- Do not add or run tests; update existing test fixtures/assertions only to remove expectations for the deleted feature.
- Remove feature references from dated project specs, plans, navigation QA material, and the current 51-frame UI-audit pack; retain unrelated sections and findings.
- The existing unknown-page route fallback opens `lot_io`; do not add a separate route migration.

## Review Focus

- The legacy saved route `ai_audit` must fall back to `lot_io` through the existing router; verify the fallback implementation remains untouched.
- Removing the popup page must leave the neighboring pages and their markup intact; inspect the boundary immediately before/after the removed page.
- Removing the AI prompt branches must preserve all neighboring prompt types and the default rewrite prompt.
- Removing the CSS block must preserve adjacent selectors and the current uncommitted style changes.
- Removing frame F04 must leave a consistent 50-frame index, report navigation, frame references, screenshots, and evidence matrix.

---

### Task 1: Remove runtime, UI, and AI integration

**Files:**
- Modify: `manifest.json`
- Modify: `content/ui/main_popup.js`
- Modify: `css/content_styles.css`
- Modify: `background/ai.js`
- Modify: `README.md`
- Delete: `content/features/ai_lot_audit.js`
- Delete: `tests/ai_lot_audit_ui_contract.test.js`
- Modify: `tests/navigation_search_routes.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:**
- Consumes: the existing `openPopupPage` route behavior, which opens `lot_io` for missing pages.
- Produces: no `ai_audit` page, loader, CSS, or `lot_audit_raw`/`lot_audit` prompt handling; other AI request types remain unchanged.

- [ ] Remove the script entry from `manifest.json`, the audit module file, and its feature-specific UI contract file.
- [ ] Remove the audit navigation item and page markup from `content/ui/main_popup.js`; remove its page ID from `FPT_NAV_SECTIONS`, `FPT_NAV_LABEL_OVERRIDES`, and `legacySearchAliases`.
- [ ] Remove only the store-audit CSS block from `css/content_styles.css`, preserving surrounding rules and the existing unrelated working-tree changes.
- [ ] Remove the two audit-only prompt branches from `background/ai.js`, preserving adjacent translation and default prompt behavior.
- [ ] Remove the README feature row and remove the page from existing navigation test fixtures and audit-specific search assertions; do not add test cases.
- [ ] Inspect the diff for the listed files and confirm that unrelated current changes in `main_popup.js`, CSS, and other modified files remain present.
- [ ] Run a scoped text search over runtime code for `ai_audit`, `ai_lot_audit`, `lot_audit`, `fp-audit`, and the Russian feature label; expected: no feature implementation references remain.

### Task 2: Remove historical references and the F04 material

**Files:**
- Modify: `docs/navigation-tree-test-2026-09-24.md`
- Modify: `docs/superpowers/specs/2026-09-24-seller-navigation-taxonomy-design.md`
- Modify: `docs/superpowers/specs/2026-09-25-unified-funpay-funcy-ui-design.md`
- Modify: `docs/superpowers/plans/2026-09-24-seller-navigation-pages.md`
- Modify: `funpay_funcy_ui_audit_spec_v4/README.md`
- Modify: `funpay_funcy_ui_audit_spec_v4/01_FRAME_BY_FRAME_AUDIT.md`
- Modify: `funpay_funcy_ui_audit_spec_v4/02_UPDATED_UI_SPEC.md`
- Modify: `funpay_funcy_ui_audit_spec_v4/04_ACCEPTANCE_AND_REGRESSION.md`
- Modify: `funpay_funcy_ui_audit_spec_v4/05_EVIDENCE_MATRIX.csv`
- Modify: `funpay_funcy_ui_audit_spec_v4/06_FRAME_INDEX.csv`
- Rename and modify: `funpay_funcy_ui_audit_spec_v4/07_51_FRAME_VISUAL_AUDIT_WITH_SCREENSHOTS.md` to `07_50_FRAME_VISUAL_AUDIT_WITH_SCREENSHOTS.md`
- Rename and modify: `funpay_funcy_ui_audit_spec_v4/07_51_FRAME_VISUAL_AUDIT_WITH_SCREENSHOTS.html` to `07_50_FRAME_VISUAL_AUDIT_WITH_SCREENSHOTS.html`
- Modify: `funpay_funcy_ui_audit_spec_v4/08_EXECUTION_TASKS_BY_SUBCATEGORY.md`
- Rename and modify: `funpay_funcy_ui_audit_spec_v4/09_ALIGNMENT_MICRO_LAYOUT_AUDIT_51.md` to `09_ALIGNMENT_MICRO_LAYOUT_AUDIT_50.md`
- Rename and modify: `funpay_funcy_ui_audit_spec_v4/09_ALIGNMENT_MICRO_LAYOUT_AUDIT_51.html` to `09_ALIGNMENT_MICRO_LAYOUT_AUDIT_50.html`
- Delete: `текущее состояние/1. Лоты и продажи/4. Аудит магазина/4. Аудит магазина.png`

**Interfaces:**
- Consumes: the runtime page removal from Task 1.
- Produces: historical docs and current UI-audit materials that describe the remaining navigation and 50 frames, with no F04 page section or page screenshot.

- [ ] Remove the page ID, label, and route from the dated navigation tree test, navigation taxonomy spec, UI design spec, and navigation plan; correct affected page counts and lists.
- [ ] Remove F04 from the frame-by-frame report, frame index, visual report (Markdown and HTML), alignment report (Markdown and HTML), and execution tasks; renumber subsequent frame IDs and their cross-references consistently.
- [ ] Remove F04 from the evidence matrix references while preserving each remaining finding and its other frame IDs.
- [ ] Change the UI-audit pack's stated total from 51 to 50, rename the two 51-frame reports to 50-frame names, and update every internal link to those files.
- [ ] Remove the page image and all direct links to it; preserve the other screenshot assets and review findings.
- [ ] Search historical/current docs and the QA pack for the feature IDs and user-facing label; expected: no feature references remain outside the newly approved removal spec and plan.

### Task 3: Final scoped review

**Files:**
- Review: all files listed in Tasks 1 and 2.

**Interfaces:**
- Consumes: the completed removal and updated documentation.
- Produces: a diff limited to the feature removal, related route/test fixture updates, and direct reference cleanup.

- [ ] Inspect the complete diff, including the user's pre-existing uncommitted changes, and keep unrelated hunks intact.
- [ ] Check modified files for whitespace errors and inspect any reported lines against the pre-existing diff before correcting them.
- [ ] Confirm the old route still falls back to `lot_io`, every remaining frame index resolves to a report section, and no links point to the deleted screenshot or renamed files.
- [ ] Do not run tests or claim test results; report that tests were not run.
