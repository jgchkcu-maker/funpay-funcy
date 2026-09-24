# FunPay Navigation Width and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing FunPay Funcy accordion menu to be narrower, preserve the current vertical rhythm, show blue category icons while expanded, and stop the category row and popup from appearing to shrink.

**Architecture:** Keep the existing six-section navigation and its sprite-state mapping. Update both the static navigation stylesheet and the runtime `FPT_MENU_THEME_CSS` together, then remove scale from the popup entrance and remove expanded-wrapper padding that contracts the category row. Reuse the sprite pairs already in the project and ZIP; add no icon assets unless an audit finds a missing or incorrectly mapped file.

**Tech Stack:** Existing browser-extension JavaScript and CSS; Node.js source-contract tests.

**Spec:** `docs/superpowers/specs/2026-09-22-navigation-accordion-design.md`

## Global Constraints

- Preserve the six section IDs (`core`, `store`, `messages`, `finance`, `settings`, `more`) and all existing page IDs, search behavior, navigation handlers, and storage behavior.
- Narrow only the sidebar horizontally: target `256px` width and flex basis, down from `292px`.
- Preserve vertical measurements: `16px` outer top/bottom margin, `18px` vertical panel padding, `56px` search field, `58px` category hit area, `10px` group gap, `44px` child hit area, `34px` category icon, and `20px` chevron.
- Use horizontal panel padding of `12px` and horizontal category padding of `12px`; keep the existing vertical padding values.
- Keep the existing font stack `Inter, 'Segoe UI', system-ui, sans-serif`. Use `16px/700` for category labels and `15px` for search and child labels. The project bundles no Inter font file, so rely on the existing system fallback and do not add a font dependency.
- Preserve the current `20px` navigation-panel radius, `18px` top-level row radius, `14px` child-row radius, and light/dark surface tokens.
- Every expanded category icon must resolve to its supplied blue `*-expanded.png` asset; every collapsed category icon must resolve to its dark `*-collapsed.png` asset.
- Category expansion may animate the child list and rotate its chevron. It must not scale the popup or reduce the category row's dimensions.
- Preserve light/dark/custom-theme tokens and reduced-motion behavior.

## Existing Asset Inventory

The supplied `funpay_funcy_ui_sprites.zip` and project `icons/` folder both contain all six collapsed/expanded icon pairs. The archive README is treated as asset metadata; it describes the filename convention and transparent backgrounds.

| Navigation section | Sprite pair |
| --- | --- |
| Основное | `home-collapsed` / `home-expanded` |
| Магазин | `store-collapsed` / `store-expanded` |
| Сообщения | `chat-collapsed` / `chat-expanded` |
| Финансы | `analytics-collapsed` / `analytics-expanded` |
| Настройки | `settings-collapsed` / `settings-expanded` |
| Ещё | `apps-collapsed` / `apps-expanded` |

The files are already mapped in `FPT_NAV_ICON_ASSETS` and the renderer switches the `<img>` source from the current expanded state. Keep the existing project filenames under `icons/nav-…`; no sprite-generation task is needed.

## Review Focus

- At `256px`, long Russian category labels and the search clear button must not overlap the icon or chevron; keep labels on one line and ellipsize only when the available text slot is exceeded.
- Each of the six expanded sprite sources must be blue and each collapsed source must remain dark; expanded state must still work when the menu uses dark/custom themes.
- Opening a category must leave its `58px` toggle geometry intact while child rows appear below it; no wrapper padding may visually inset or contract the toggle.
- Popup entrance must preserve centering and opacity while using translation only; opening it must not scale the full interface.
- Reduced-motion users must receive the same final state with transitions reduced by the existing media query.

---

### Task 1: Pin down width, motion, typography, and sprite contracts

**Files:**
- Modify: `tests/menu_reference_contract.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:**
- Consumes: existing static CSS, runtime `FPT_MENU_THEME_CSS`, `FPT_NAV_ICON_ASSETS`, and `renderExpandedSections()`.
- Produces: source-contract coverage for the agreed horizontal width, unchanged vertical dimensions, expanded/collapsed asset mapping, and non-scaling interaction states.

- [ ] Update the navigation style assertions to expect a `256px` sidebar and `12px` horizontal panel padding while retaining the vertical dimensions in Global Constraints.
- [ ] Assert both static CSS and runtime theme CSS keep the `58px` category toggle and `44px` child links, and use the existing `16px` category and `15px` child/search type sizes.
- [ ] Assert that all six sections map both collapsed and expanded sprite filenames, and that `renderExpandedSections()` chooses the expanded filename when `expanded` is true.
- [ ] Replace assertions that require `8px` padding on the expanded section wrapper with assertions that expansion does not add wrapper padding or remove the toggle's border/surface.
- [ ] Add a contract that the popup entrance animation and category-toggle styles do not apply a scale transform.

### Task 2: Narrow the sidebar horizontally in both style layers

**Files:**
- Modify: `css/fpt_icons_theme.css`
- Modify: `content/ui/main_popup.js` (`FPT_MENU_THEME_CSS`)

**Interfaces:**
- Consumes: existing light/dark theme variables and the six accordion groups.
- Produces: matching static and runtime navigation geometry at a `256px` sidebar width.

- [ ] Change the sidebar width and flex basis from `292px` to `256px` in both style layers.
- [ ] Change only horizontal panel padding from `14px` to `12px`; preserve `18px` vertical padding and `16px` vertical margins.
- [ ] Set horizontal category-toggle padding to `12px` while preserving its `58px` minimum height, `34px` icon, `20px` chevron, `16px` bold title, and `10px` group gap.
- [ ] Preserve the `56px` search height and existing vertical input padding; adjust only horizontal search inset as needed to keep the search icon, placeholder, and clear control from colliding at the narrower width.
- [ ] Preserve child-link height and vertical padding. Keep labels on one line; apply `min-width:0`, `overflow:hidden`, and ellipsis to the text span if the narrower slot requires it.
- [ ] Keep the existing `Inter, 'Segoe UI', system-ui, sans-serif` stack without loading a font. Verify the actual fallback in the preview because Inter is not bundled locally. Keep search/child labels at `15px` and category labels at `16px/700`.

### Task 3: Keep category rows stable and show their blue expanded icons

**Files:**
- Modify: `css/fpt_icons_theme.css`
- Modify: `content/ui/main_popup.js` (`FPT_MENU_THEME_CSS`; update the sprite map only if the asset audit identifies a mismatch)
- Modify: `css/content_styles.css`

**Interfaces:**
- Consumes: `.fpt-nav-group.is-expanded`, `aria-expanded`, `FPT_NAV_ICON_ASSETS`, and existing reduced-motion rules.
- Produces: stable category-row dimensions, blue expanded-category icons, and a popup entrance without scale.

- [ ] Remove the `8px` padding from `.fpt-nav-group.is-expanded` in both CSS layers; do not make the expanded toggle transparent or remove its visible border/shadow.
- [ ] Give the expanded toggle a subtle existing-token blue tint while keeping its width, `58px` hit area, padding, and alignment identical to its collapsed state.
- [ ] Retain the six supplied expanded PNGs and verify every section selects its matching blue image through the existing state renderer; do not approximate the blue state with a CSS filter.
- [ ] Keep the current chevron rotation and `grid-template-rows` child reveal. Remove padding transitions that only animate the wrapper inset; use the existing reduced-motion query for the remaining transitions.
- [ ] Change `@keyframes popIn` in `css/content_styles.css` to opacity plus a small vertical translation, removing `scale(0.97)` while preserving the popup's centered final transform.
- [ ] Disable the inherited global radial `button::before` hover flare for `.fpt-nav-group-toggle`, and prevent the generic hover rule from animating its shadow; retain a simple color/background response.
- [ ] Keep the category interaction free of transforms on the popup, group, toggle, icon, and label; the chevron's directional rotation is the sole permitted transform in that interaction.

### Task 4: Verify the visual result and navigation regressions

**Files:**
- Review: `css/fpt_icons_theme.css`
- Review: `content/ui/main_popup.js`
- Review: `css/content_styles.css`
- Review: `tests/menu_reference_contract.test.js`
- Review: `tests/t18_navigation_ia.test.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: verified narrow-menu styling with working search, section expansion, page navigation, and icon states.

- [ ] Run `node tests/menu_reference_contract.test.js` and `node tests/t18_navigation_ia.test.js`.
- [ ] Run `node --check content/ui/main_popup.js` and the repository's available JavaScript test suite.
- [ ] Compare the menu before/after expansion at the same viewport: confirm the panel is narrower, its height and vertical rhythm are unchanged, the selected category row does not contract, and all six expanded category icons are blue.
- [ ] Check light, dark, and custom-accent themes; search results and keyboard navigation; popup minimum width and resized layout; and `prefers-reduced-motion`.
- [ ] Inspect the final diff for unintended changes to page markup, initialization behavior, or asset files.

## Self-Review

- Spec coverage: the existing six-section accordion behavior remains owned by the referenced spec; this plan covers only its visual refinement, motion, and sprite-state presentation.
- Asset coverage: all twelve navigation state images are present in the provided archive and project; no generated or downloaded icon asset is required.
- Placeholder scan: no TBD/TODO implementation steps remain.
- Scope: one cohesive menu refinement across its static CSS, runtime theme CSS, popup entrance CSS, and contract tests.
