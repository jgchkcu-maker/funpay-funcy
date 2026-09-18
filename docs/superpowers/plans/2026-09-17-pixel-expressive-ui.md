# Pixel Expressive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the complete FP Tools settings window to the approved Pixel / Material 3 Expressive design without changing existing feature behavior.

**Architecture:** Add one final design-system stylesheet loaded after all existing settings styles. Keep legacy markup and JavaScript behavior intact; normalize it through CSS tokens and component overrides, while preserving the existing viewport guard and responsive structure.

**Tech Stack:** Manifest V3, vanilla JavaScript/HTML, CSS variables, CSS grid/flex/container queries, Node `node:test` regression tests.

**Spec:** `docs/superpowers/specs/2026-09-17-pixel-expressive-ui-design.md`

## Global Constraints

- No new runtime dependencies.
- Do not rename existing IDs, storage keys, or data-page values.
- Keep existing feature behavior unchanged.
- Load the new design stylesheet last.
- Keep the responsive viewport guard enabled.
- Preserve light and dark theme support.
- Respect `prefers-reduced-motion`.
- Prevent horizontal overflow and oversized theme previews.

---

### Task 1: Red regression contract

**Files:**
- Create: `tests/pixel_expressive_ui.test.js`

**Interfaces:**
- Consumes: `manifest.json`, future `css/pixel_expressive.css`.
- Produces: static regression contract for stylesheet ordering, tokens, shell geometry, common component coverage, bounded previews, responsive rules, dark mode, and reduced motion.

- [ ] **Step 1: Write failing tests** that assert:
  - `manifest.json` references `css/pixel_expressive.css` after `css/settings_responsive_guard.css`.
  - stylesheet defines `--fpt-popup-preferred-width: 1360px` and `--fpt-popup-preferred-height: 900px`.
  - stylesheet keeps `.fpt-nav-search-input` full width in desktop mode.
  - stylesheet contains normalized selectors for `.fpt-setting-card`, `.setting-group`, `.template-container`, inputs/selects/buttons, `.fpt-needs-list`, and modal surfaces.
  - `#fp-wallpaper-carousel` and `#circlePreview` have explicit bounded sizes.
  - compact layout contains a container/media fallback and `min-width: 0` guards.
  - `.fptm-dark` and `prefers-reduced-motion` rules exist.

- [ ] **Step 2: Verify RED in CI** by pushing only the test and opening a PR. Expected result: Node test job fails because `css/pixel_expressive.css` is missing and manifest does not reference it.

---

### Task 2: Expressive design-system stylesheet

**Files:**
- Create: `css/pixel_expressive.css`

**Interfaces:**
- Consumes: existing `--fptm-*` / `--fpt-*` variables and all current popup markup.
- Produces: final visual layer for the popup shell and common components.

- [ ] **Step 1: Add shell/token rules** for 1360×900 preferred geometry, 24px shell radius, tonal backgrounds, shadows, typography, header, body and scroll containment.
- [ ] **Step 2: Add sidebar rules** for persistent full-width search, expressive navigation rows, icon containers, active states, section labels, and non-interactive footer promo decoration.
- [ ] **Step 3: Add content/subtab rules** for page hierarchy, segmented navigation, headings, compact spacing, and shared section surfaces.
- [ ] **Step 4: Normalize common cards** covering `.fpt-setting-card`, `.setting-group`, `.template-container`, `.fpt-subpanel`, `.support-promo`, dashboard/status/finance/account cards, needs/customization rows, lists, and tables.
- [ ] **Step 5: Normalize controls** covering text inputs, textareas, selects, radio pills, checkboxes/switches, range inputs, primary/default/danger buttons, icon buttons, badges, and focus-visible states.
- [ ] **Step 6: Add appearance-specific layout rules** for theme carousel, background preview, color grid, theme action grid, bounded circle preview, compact single-toggle cards, and responsive dense control grids.
- [ ] **Step 7: Add modal and dark-mode rules** so modal surfaces and `.fptm-dark` use the same token system.
- [ ] **Step 8: Add responsive and reduced-motion rules** with container/media fallbacks, compact sidebar sizes, one-column grid fallbacks, and transition suppression.

---

### Task 3: Load the design layer last

**Files:**
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `css/pixel_expressive.css`.
- Produces: deterministic cascade order where expressive overrides win after legacy/responsive styles.

- [ ] **Step 1: Append `css/pixel_expressive.css`** after `css/settings_responsive_guard.css` in the FunPay content script CSS list.
- [ ] **Step 2: Verify GREEN in CI** on the open PR. Expected result: all `node --test tests/*.test.js` tests pass.

---

### Task 4: Final regression audit and main merge

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: CI status and PR diff.
- Produces: tested merge to `main`.

- [ ] **Step 1: Review diff** to confirm the change is presentation-only outside tests/docs/manifest.
- [ ] **Step 2: Confirm CI** has zero failing tests on the PR head.
- [ ] **Step 3: Merge the PR into `main`** only after CI is green.
- [ ] **Step 4: Fetch `main` CI status** for the merge commit and report the exact result.
