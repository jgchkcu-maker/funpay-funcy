# Sidebar Accordion Navigation Implementation Plan

> For agentic workers: execute this plan task-by-task with the TDD and verification workflows.

Goal: Replace the popup's contextual navigation with an independent six-section accordion while preserving all existing page contracts.

Architecture: FPT_NAV_SECTIONS remains the source of truth. setupNavigationSections() will move the existing page list nodes into six group containers, track expanded section ids independently, and expose page/search helpers used by existing navigation code. Static and runtime theme CSS will style the new flex/accordion layout.

Tech Stack: Existing browser-extension JavaScript, CSS custom properties, Node.js assert-based source tests.

Spec: docs/superpowers/specs/2026-09-22-navigation-accordion-design.md

## Global Constraints

- Preserve all 25 existing data-page values exactly once.
- Category toggles only change expanded state; they never click a child page.
- Preserve setupPopupNavigation(), fpToolsLastPage, global_chat visibility, internal links, and page initializers.
- Use existing theme variables and runtime FPT_MENU_THEME_CSS cascade.
- Do not modify unrelated business logic or Finance Hub subtabs.
- Account footer is out of scope because no authoritative account-tier source exists.

## Review Focus

- Restoring a page in a previously closed section must expand that section before the normal click path; test in Task 2.
- Search must not overwrite the user's expanded state after clearing; test in Task 3.
- Moving existing nodes must keep selectors used by global_chat and internal links valid; test in Task 2.
- Runtime theme rules must not reintroduce the removed two-column layout; test in Task 3.
- Narrow/resized popups need a scrollable group area and non-overlapping footer/cloud behavior; test CSS invariants in Task 3.

### Task 1: Replace navigation IA contract tests

Files:
- Modify: tests/t18_navigation_ia.test.js

Interfaces:
- Consumes: current popup markup, FPT_NAV_SECTIONS, setupNavigationSections(), setupPopupNavigation(), setupNavSearch(), loadLastActivePage(), navigation CSS.
- Produces: executable static contract tests for six groups, unique page ownership, existing-node movement, accordion-only category toggles, restore/search behavior, global_chat, reduced motion, and Ctrl/Cmd+K.

- [ ] Write failing assertions for exactly six non-primary groups, group classes/ARIA, no old contextual renderer classes, no child click from group toggles, independent state persistence, search snapshot/restore, and scroll layout.
- [ ] Run node tests/t18_navigation_ia.test.js; verify it fails because the current contextual renderer violates the new contract.
- [ ] Keep the test source-based and resilient to line layout; assert semantic code fragments rather than fixed character windows.
- [ ] Run the test again after implementation in later tasks.
- [ ] Commit the test changes with test: define accordion navigation contract.

### Task 2: Implement six independent accordion groups

Files:
- Modify: content/ui/main_popup.js

Interfaces:
- Consumes: FPT_NAV_SECTIONS and existing li[data-page] nodes.
- Produces: setupNavigationSections() API with showSectionForPage(pageId), expandSection(sectionId), refresh(), revealAllForSearch(), getExpandedSections(), and setExpandedSections().

- [ ] Add/adjust failing contract coverage for moving the original page nodes and preserving the existing page click handler.
- [ ] Run the targeted test and observe failure on the old renderer.
- [ ] Rewrite setupNavigationSections() to build six .fpt-nav-group containers, move existing page nodes into .fpt-nav-group-items, and initialize defaults from active page/core.
- [ ] Add independent toggle handlers with aria-expanded/aria-controls, best-effort fpToolsNavExpandedSections storage, and automatic owner expansion from showSectionForPage().
- [ ] Ensure category toggle does not call child .click() and remove openSection()'s first-child navigation behavior.
- [ ] Keep setupPopupNavigation() initializers/storage unchanged except for the owning-section expansion call.
- [ ] Make loadLastActivePage() use the existing item click path after owner expansion is available.
- [ ] Run node tests/t18_navigation_ia.test.js and verify the renderer contract passes.
- [ ] Commit with feat: render popup navigation as independent accordion.

### Task 3: Adapt search, shortcut, and theme/layout CSS

Files:
- Modify: content/ui/main_popup.js
- Modify: css/fpt_icons_theme.css
- Modify: css/content_styles.css only where existing nav overflow rules conflict

Interfaces:
- Consumes: accordion API from Task 2 and existing page-content feature index.
- Produces: search filtering with expanded-state snapshot/restore, scoped Ctrl/Cmd+K handling, flex scroll layout, collapse animation, reduced-motion support, and theme-compatible runtime styles.

- [ ] Add failing assertions for search state snapshot/restore, matching section expansion, Ctrl/Cmd+K handler, absence of compact grid selectors, and reduced-motion rules.
- [ ] Run the targeted test and verify failure against the old search/CSS.
- [ ] Update setupNavSearch() to snapshot expanded groups on first query, reveal matching sections/items, and restore on clear/result selection.
- [ ] Add scoped keydown handling that focuses/selects #fptNavSearch only when the popup exists.
- [ ] Replace contextual/grid CSS with .fpt-nav-scroll, .fpt-nav-group*, child item styles, chevron rotation, and prefers-reduced-motion.
- [ ] Update FPT_MENU_THEME_CSS navigation selectors and hide the decorative cloud from layout.
- [ ] Remove compactNav() calls/behavior after checking all call sites; retain a documented no-op only if another call site requires it.
- [ ] Run node tests/t18_navigation_ia.test.js and syntax checks.
- [ ] Commit with feat: style accordion navigation and preserve search state.

### Task 4: Full regression and integration preparation

Files:
- No new product files; inspect all changed files and test outputs.

Interfaces:
- Consumes: completed tasks 1-3.
- Produces: verified branch ready to merge into main.

- [ ] Run the navigation test and every available repository test command discovered from the repository.
- [ ] Run JavaScript syntax checks on changed JS files.
- [ ] Verify all 25 schema/page ids, no duplicate DOM ids in source, global_chat selector, internal links, and page initializer references.
- [ ] Inspect git diff main...HEAD for unrelated changes and check light/dark/custom variable usage.
- [ ] Record browser visual verification limitation if the extension cannot be loaded in this environment.
- [ ] Commit only any verification-driven fixes, then merge the feature branch into main and rerun the suite on the merged result.
