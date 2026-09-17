# Responsive Settings Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the FP Tools settings window and every settings screen usable at any supported browser/popup size without content escaping, giant previews, or viewport-dependent responsive mistakes.

**Architecture:** Keep popup geometry centralized in `popup_viewport_guard.js`, and make the settings shell a CSS containment boundary. Responsive behavior must react to the popup/content width through container queries rather than browser viewport media queries. Heavy visual controls such as the theme preview receive explicit bounded sizes, while reusable grids collapse based on the popup container.

**Tech Stack:** Manifest V3 extension, vanilla JavaScript, CSS container queries, Node `node:test` regression tests.

**Spec:** User-provided screenshots and the 2026-09-17 request to fully fix settings overflow/responsiveness without introducing regressions.

## Global Constraints

- Preserve the current desktop sidebar information architecture and Material-style visuals.
- Keep the popup within the browser viewport with a safe margin after open, resize, zoom, monitor/viewport changes, and restored saved geometry.
- Responsive changes must depend on popup/container width, not only `window.innerWidth`.
- Do not hide settings or rely on clipping as the primary fix.
- Preserve existing drag/resize persistence behavior and legacy saved-size migration.
- Add regression tests before production changes.

---

### Task 1: Responsive regression contract

**Files:**
- Modify: `tests/settings_sidebar_material3.test.js`

**Interfaces:**
- Consumes: current settings CSS and viewport guard exports.
- Produces: regression checks for container-query breakpoints, bounded theme preview, compact grids, and geometry invariants.

- [ ] Add failing tests for popup-container responsiveness and bounded theme preview.
- [ ] Verify the new tests fail against the current branch.
- [ ] Commit the red tests separately.

### Task 2: Container-driven settings shell

**Files:**
- Modify: `css/settings_sidebar_material3.css`
- Modify: `css/subtabs_material3.css`

**Interfaces:**
- Consumes: `.fp-tools-popup`, `.fp-tools-body`, `.fp-tools-content`, sidebar and subtab classes.
- Produces: `container-type` boundaries and compact/rail layouts keyed to popup width.

- [ ] Replace popup-layout viewport breakpoints with container queries.
- [ ] Add compact sidebar/rail behavior that preserves navigation access.
- [ ] Make subtabs respond to content width and remain horizontally scrollable as a fallback.
- [ ] Run regression tests and keep them green.

### Task 3: Theme and shared content overflow fixes

**Files:**
- Modify: `css/settings_sidebar_material3.css`

**Interfaces:**
- Consumes: theme carousel, color/action grids, cards/forms already rendered by `main_popup.js`.
- Produces: bounded theme preview and responsive one-column fallbacks for dense controls.

- [ ] Bound the theme carousel height while preserving 16:9 media cropping.
- [ ] Collapse theme/color/action/dashboard/needs grids at container breakpoints.
- [ ] Add safe flex wrapping/min-width rules for settings rows and modal-like content.
- [ ] Run regression tests.

### Task 4: Popup geometry hardening

**Files:**
- Modify: `content/ui/popup_viewport_guard.js`
- Modify: `tests/settings_sidebar_material3.test.js`

**Interfaces:**
- Consumes: saved size/position and current viewport.
- Produces: normalized rectangle application that remains inside the viewport and does not write unstable transient geometry.

- [ ] Add failing geometry tests for oversized/offscreen restored rectangles and small viewports.
- [ ] Centralize element geometry application and clamp persisted values.
- [ ] Run focused and full Node tests.

### Task 5: Final regression audit

**Files:**
- Modify only files required by failures found in the audit.

**Interfaces:**
- Consumes: all settings hubs and shared navigation.
- Produces: a clean diff with no new horizontal overflow patterns.

- [ ] Inspect Dashboard, Automation, Chat, Lots, Finance, Appearance, and System markup/styles for fixed-width/flex overflow risks.
- [ ] Add a regression test for every newly fixed shared pattern.
- [ ] Run the complete repository test suite available under `tests/`.
- [ ] Review the final diff before merge/PR.