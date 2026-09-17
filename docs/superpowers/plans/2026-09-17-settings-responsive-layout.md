# Settings Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the FP Tools settings window and every settings screen inside the visible viewport at all saved sizes, while making internal layout respond to the actual popup width instead of the browser width.

**Architecture:** Keep `popup_viewport_guard.js` as the single geometry authority and extend its pure clamping API so every viewport/zoom/resize path uses the same margins and size limits. Make `.fp-tools-popup` a named CSS containment context and move popup-specific responsive rules from viewport media queries to container queries. Add conservative shared overflow/min-width guards and targeted compact rules for the theme gallery/actions and other multi-column settings surfaces.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, CSS container queries, Node `node:test` static/pure-function regression tests.

**Spec:** User screenshots and the UI audit in this conversation: popup must never escape the viewport; theme preview must not consume the full page height; responsive changes must depend on popup width; other settings hubs must not overflow at compact popup sizes.

## Global Constraints

- Preserve the existing vertical left navigation and Material 3 visual language.
- Do not remove user resize/drag persistence.
- Do not hide settings functionality to make layouts fit.
- Keep existing subtab animation containment behavior intact.
- Prefer CSS overrides in the already-last-loaded `settings_sidebar_material3.css` over invasive markup rewrites.
- Add regression tests before production changes and verify the failure reason.

---

### Task 1: Lock popup geometry to the visible viewport

**Files:**
- Modify: `tests/settings_sidebar_material3.test.js`
- Modify: `content/ui/popup_viewport_guard.js`

**Interfaces:**
- Consumes: saved/DOM rectangles `{left, top, width, height}` and viewport `{width, height}`.
- Produces: `clampPopupRect(rect, viewport, options)` that always returns a fully visible rectangle with a uniform safe margin, including tiny viewports and off-screen saved positions.

- [ ] **Step 1: Write failing geometry tests** covering right/bottom overflow, tiny viewports, stale negative positions, and large saved dimensions.
- [ ] **Step 2: Run the focused Node test and confirm it fails because the new geometry behavior is missing.**
- [ ] **Step 3: Implement the smallest guard changes needed, keeping the current storage keys and centered/no-transform behavior compatible.**
- [ ] **Step 4: Run the focused test and the existing settings tests until green.**
- [ ] **Step 5: Commit the geometry fix.**

### Task 2: Make settings responsive to popup width, not browser width

**Files:**
- Modify: `tests/settings_sidebar_material3.test.js`
- Modify: `css/settings_sidebar_material3.css`
- Modify: `css/subtabs_material3.css`

**Interfaces:**
- Consumes: named container `fpt-popup` on `.fp-tools-popup`.
- Produces: compact breakpoints for sidebar, content padding, subtabs and internal grids based on the popup's inline size.

- [ ] **Step 1: Add failing static tests** requiring `container-type`, named `@container fpt-popup` rules, and removal/replacement of popup-width viewport media queries.
- [ ] **Step 2: Run the focused Node test and confirm the assertions fail on current CSS.**
- [ ] **Step 3: Add the named containment context and container-query breakpoints; keep only true viewport-height media queries where height, not width, is the trigger.**
- [ ] **Step 4: Add shared `min-width:0/max-width:100%/box-sizing` protections for popup pages/cards/form controls and compact grid/flex behavior at narrow popup widths.**
- [ ] **Step 5: Run the focused tests until green and commit.**

### Task 3: Fix the oversized theme page and audit other settings surfaces

**Files:**
- Modify: `tests/settings_sidebar_material3.test.js`
- Modify: `css/settings_sidebar_material3.css`

**Interfaces:**
- Consumes: existing IDs/classes (`#fp-wallpaper-carousel`, `.theme-actions-grid`, `.color-input-grid`, `.fpt-status-hub`, `.fpt-presets-grid`, `.fpt-needs-presets-grid`, common settings cards).
- Produces: bounded theme preview height and one-column/flow-safe compact layouts without changing markup or feature behavior.

- [ ] **Step 1: Add failing tests** for a bounded wallpaper carousel and compact action/grid rules.
- [ ] **Step 2: Run the focused test and confirm failure before CSS changes.**
- [ ] **Step 3: Override the inline 16:9-only sizing with a bounded responsive height and `object-fit:cover` behavior, then add compact one-column rules where fixed grids would squeeze/overflow.**
- [ ] **Step 4: Run all repository Node tests available in `tests/*.test.js`; inspect the branch diff for accidental unrelated changes.**
- [ ] **Step 5: Create a PR with the regression matrix and verification results.**
