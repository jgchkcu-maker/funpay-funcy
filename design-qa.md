# Funcy header button QA

Scope: existing extension header launcher. Final user instruction supersedes the initial lavender tile reference: compact width, transparent background, vertical alignment with navigation labels.

- Source visual truth: `C:/Users/Usser/AppData/Local/Temp/codex-clipboard-7bd279e9-70fe-44a0-a281-d40321b05b6c.png` (734 x 163).
- Implementation screenshots: `artifacts/funcy-header-dark.png`, `artifacts/funcy-header-light.png` (734 x 163).
- Combined comparison: `artifacts/funcy-header-comparison.png` (734 x 326, source above implementation).
- Browser: repository Playwright fixture in Chrome, viewport 734 x 789, deviceScaleFactor 1; unscaled 734 x 163 header crop.
- States: light, dark, hover, keyboard activation, right-click settings, saved font size, reduced motion, 390 px viewport, early insertion.
- In-app preview connection was unavailable; verification uses the repository browser fixture, not a live authenticated FunPay page.

## Findings

No actionable P0/P1/P2 findings in the scoped launcher.

- Typography: Funcy remains legible at 14 px, weight 700, single line; existing Inter/Segoe UI fallback preserved.
- Spacing: measured width 74.48 px, icon 22 px, gap 6 px. Both button center and neighboring navigation label center are y=40. The 60 px interaction height matches the existing navigation row; the visible content remains compact.
- Colors: background transparent and border 0 px in normal and hover states; dark-theme text is light lavender. Removal of the original tile is intentional per the final instruction.
- Asset: existing 48 px raster brand icon loads correctly at 22 px. No replacement artwork was generated.
- Content: visible label Funcy; accessible label remains Open FunPay Funcy in Russian. Storage identifiers and menu opening behavior are preserved.

## Comparison history

The first request produced a 112 x 36 px lavender tile. The user then supplied a live screenshot and requested removal of the tile, a smaller control and vertical alignment. Revised screenshots show transparent styling and aligned text. Fixture navigation order, profile placeholder and page background differ from the supplied live page; these are outside the scoped component and do not establish live site fidelity.

Full-view comparison: combined source/implementation image reviewed. The component is readable at 1x, so no additional magnified crop is necessary.

## Validation

- Browser fixture passed in light and dark themes: geometry, loaded icon, transparent hover, keyboard menu opening, right-click settings, saved size, reduced motion, narrow visibility and early insertion.
- No page errors in either fixture.
- Existing popup eager-load tests passed 3/3.
- Existing branding tests passed 4/4 after updating their expected visible label.
- JavaScript syntax checks passed for all three modified scripts.

Residual gap: the final revision has not been checked in an authenticated live FunPay tab. Narrow visibility was checked in the fixture; the site's mobile navigation is outside this verification.

final result: passed

## 2026-10-27 — Messages header and popup shadow

Implemented the selected second button direction, theme-controlled corners, action feedback and release of the popup's circular clip after opening. Scoped comparison, findings, screenshots and verification limits are recorded in [the chat-header QA report](artifacts/chat-header-2026-10-27/design-qa.md). The earlier launcher report above is preserved.

Scoped local design QA: passed. New browser checks: 4/4; existing targeted checks: 40/40. The loaded Chrome extension still requires a reload before checking these changes live.

final result: passed
