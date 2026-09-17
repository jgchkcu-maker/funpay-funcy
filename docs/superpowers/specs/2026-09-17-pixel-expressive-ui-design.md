# FP Tools Pixel Expressive UI Design

## Goal

Redesign the complete FP Tools settings window to match the approved Google Pixel / Material 3 Expressive inspired mockups while preserving all existing extension behavior and settings controls.

## Approved visual direction

The redesign uses the user-approved mockups from the 2026-09-17 conversation as the visual source of truth. The target is a light, clean, premium desktop settings application with soft blue tonal surfaces, expressive rounded shapes, strong hierarchy, compact information density, and consistent spacing.

The redesign must preserve the current information architecture:

- Главная: Дашборд
- Управление: Автоматизация, Чат и клиенты, Товары и рынок, Финансы
- Настройки: Внешний вид, Система
- Existing hub subtabs and feature controls continue to work.

## Architecture

Implement the redesign as a final CSS design-system layer loaded after the current legacy, Material 3, subtab, and responsive-guard styles. Existing JavaScript behavior, IDs, storage keys, event handlers, and feature markup remain unchanged unless a behavioral bug requires a focused fix.

This approach intentionally avoids rewriting `content/ui/main_popup.js`, which is large and behavior-heavy. The new stylesheet normalizes existing legacy markup (`setting-group`, `template-container`, `fpt-setting-card`, radio groups, buttons, tables, lists, modals, forms, and theme controls) into one coherent component system.

## Core design tokens

### Light mode

- Window background: soft neutral blue-white.
- Navigation background: slightly cooler tonal surface.
- Primary surface: white with subtle blue tint.
- Secondary surface: pale blue-gray.
- Accent: current FP Tools accent variable, defaulting to bright Pixel blue.
- Text: near-black navy.
- Muted text: cool gray-blue.
- Borders: low-contrast blue-gray.
- Success/error/warning colors remain semantically distinct.

### Dark mode

Dark mode remains supported through the same component system using dark tonal surfaces and the current user accent. The redesign must not force light mode when the rest of FP Tools is dark.

## Window shell

- Preferred desktop size increases to approximately 1360 × 900 while still clamping to the viewport.
- Border radius increases to a soft expressive shell radius.
- Header remains fixed-height and visually separated from body.
- Sidebar remains vertical at desktop widths.
- Content scrolls independently without horizontal overflow.
- Existing viewport guard remains authoritative for clamping and saved geometry.

## Sidebar

- Search becomes a persistent full-width search field instead of an icon-only control.
- Navigation uses larger rounded selected states, expressive icon containers, and clearer section labels.
- Selected navigation item uses accent-soft fill and accent-colored icon/text.
- Sidebar gains a decorative/promo footer card via CSS only; it must never block or overlap navigation.
- Compact-width rules preserve readable labels and switch to a narrower rail only when required by the existing responsive guard.

## Header

- FP Tools title remains the primary brand.
- Existing Telegram, Discord, and close controls remain functional.
- Header receives the same tonal surface, typography, spacing, icon-button treatment, and border system as the approved mockups.

## Content hierarchy

Each active hub uses the same hierarchy:

1. Page title and description.
2. Hub subtabs as a rounded segmented navigation surface.
3. Compact cards/sections with strong titles and concise descriptions.
4. Secondary actions grouped instead of scattered.

The redesign removes giant empty blocks, unnecessarily tall single-control cards, inconsistent nested panels, and excessive vertical spacing.

## Components

The final design layer must normalize:

- `.fpt-setting-card`
- `.setting-group`
- `.template-container`
- `.fpt-subpanel`
- `.support-promo`
- radio option groups
- checkboxes and switches
- buttons and icon buttons
- text inputs, textareas, selects
- range sliders
- theme color controls
- theme/action grids
- needs/customization lists
- account rows
- finance widgets
- tables/lists
- modal surfaces

Controls must use consistent heights, border radii, focus treatment, and spacing.

## Appearance page

The approved appearance mockup is the strongest visual anchor. The redesign must:

- Keep theme carousel/previews bounded and compact.
- Present background image preview and upload/delete actions as one coherent card.
- Display color controls as compact swatches/cards.
- Place font, blur, brightness, and corner radius controls in dense responsive grids.
- Convert glassmorphism, custom scrollbar, separators, and related one-control sections into compact cards.
- Keep circle/avatar preview visually bounded.
- Group share/export/import/reset actions cleanly.

## Site customization page

The existing feature list remains functionally unchanged but gains:

- dense scannable rows,
- consistent checkbox/toggle alignment,
- preview-eye buttons,
- compact section headers,
- clear search/filter controls,
- stable two-column layout when space permits,
- single-column fallback at compact widths.

## Other hubs

Dashboard, Automation, Chat, Lots/Market, Finance, and System receive the same tokens and component styling so they visually match the approved mockups without replacing their existing live data/logic with fake dashboard content.

## Responsiveness and bug fixes

- No horizontal content overflow inside the popup.
- Inline fixed heights from legacy markup are visually bounded by final overrides where needed.
- Dense grids collapse based on popup/container width.
- Subtabs remain horizontally scrollable when necessary.
- Theme previews and image previews use explicit maximum heights and `object-fit: cover`.
- Flex/grid children get `min-width: 0` where required.
- Content remains usable on short laptop viewports.

## Accessibility

- Preserve visible focus states.
- Keep semantic inputs and existing labels.
- Do not remove text labels in desktop mode.
- Maintain readable contrast in both light and dark modes.
- Respect `prefers-reduced-motion`.

## Compatibility constraints

- Manifest V3 only; no new runtime dependency.
- No framework migration.
- No renaming existing IDs or storage keys.
- No removal of existing features.
- New CSS file is loaded last among settings styles.
- Existing responsive viewport guard remains enabled.

## Verification

Regression tests must confirm:

- the new stylesheet is loaded last,
- the preferred window size is widened,
- persistent search styling exists,
- cards and form controls are covered by the expressive design layer,
- appearance previews are bounded,
- responsive/container fallbacks exist,
- dark mode and reduced-motion rules remain present,
- existing test suite remains green.
