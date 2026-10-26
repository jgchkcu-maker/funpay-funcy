# Chat header actions and popup shadow — 2026-10-27

Scope: implement the user's selected second direction inside the existing extension, follow the theme's corner setting, add interaction feedback, and fix the diagonal popup-shadow cut. Existing unrelated working-tree changes are retained.

## Visual evidence

- Selected reference: `C:/Users/Usser/.codex/generated_images/01a1792b-8ddd-7a71-ae0f-c8f57a565d03/exec-48db8945-dcad-4819-8198-5ba6fc969469.png` (1774 × 887).
- Original header: user attachment `codex-clipboard-c786cb81-3298-4ba3-a735-fb1cbf49a996.png`.
- Reported shadow defect: user attachment `codex-clipboard-4851a00a-4295-406d-be93-3f95102a9f95.png`.
- `design-comparison.png`: source component crop normalized without changing its aspect ratio, then dark and light implementation captures enlarged from 278 × 70 to 556 × 140. The generated source has presentation whitespace; its outer canvas is not a product viewport.
- Browser captures: `dark-idle.png`, `light-idle.png`, `dark-filter-on.png`, `light-filter-on.png`, `dark-loading.png`, `dark-success.png`, `dark-already-read.png`, `dark-error.png`, `popup-shadow.png`.
- Implementation: repository browser fixture in Chrome, viewport 760 × 420, DPR 1; popup resize check 1100 × 800. The local interactive fixture was also opened and exercised in the Codex in-app browser.

## Findings and fixes

- Fixed: legacy CSS allowed the two controls to wrap and applied incompatible circle/slider styling. Controls now share one unwrapped group and the same 30 × 30 geometry.
- Fixed after the first visual comparison: the old `label` glyph looked like a horizontal arrow, while the chosen reference used a diagonal tag with a hole. Replaced it with the bundled Material Symbols `sell` glyph in both the real button and its settings preview. The revised source/implementation comparison was opened and reviewed.
- Fixed: `animation-fill-mode: both` retained the final circular clip on the popup. This was confirmed in the live FunPay DOM, where the opened panel retained `circle(1877px at 1580px -232px)`. Opening now releases the clip, and the animated radius includes a 160px shadow outset.

No remaining P0/P1/P2 findings in the scoped local implementation.

## Required fidelity surfaces

- Fonts/typography: preserve the site's heading family. At a 278px column width, the heading scales to 23.8px so both actions fit without wrapping. The fixture uses Arial; live FunPay currently uses Graphik Bold for its heading, which the implementation leaves in place. This family difference is an explicit fixture limitation.
- Spacing/layout: one row, 8px title-to-actions gap, 4px between buttons, centered icons. Verified at column widths 240, 278 and 340px. Source direction is preserved; smaller type is necessary at the real column width.
- Colors/tokens: quiet current-color surfaces; active filter and loading use the theme accent. Success/empty and error have distinct colors and icons, as well as updated accessible labels. Light and dark captures were inspected. Corner radii follow the applied theme, including zero; disabled theme falls back to 8px.
- Asset fidelity: use the existing bundled Material Symbols font, with `done_all` and `sell`. No generated raster artwork or custom icon drawings are added to production.
- Copy/content: retain the two existing functions and their storage key. Contextual feedback distinguishes processing, success, already read and retryable error. Registry descriptions and previews match the new controls.

## Verification

- New browser tests: 4/4 passed, covering layout, both theme bases and radii 0/6/12/30, light/dark, hover, focus, keyboard activation, filter persistence and late-read race, new contacts, delayed/failed requests, duplicate-click suppression, feedback reset, popup resize, rapid close/reopen and reduced motion.
- Existing targeted tests: 40/40 passed across interface-elements unit/browser checks, registry taxonomy, theme unit/browser checks, contrast utilities and popup eager loading.
- Changed JavaScript parses; scoped `git diff --check` passes.
- Separate existing failure in `tests/safe_values.test.js`: the malformed-radius test expects fallback 8, while the already-modified `content/safe_values.js` returns 16. Neither file was changed for this request. Its other 5 tests passed.
- Packaging was not performed. A trial invocation of the package-only validator against the repository root was inapplicable because that root intentionally contains `.git`, tests, docs and artifacts.

## Remaining live gap

The loaded extension in Chrome still serves the old content scripts after a page reload. The extension management page cannot be claimed by the browser tool, so reloading Funcy remains a manual step. New read-all network behavior was tested with controlled responses; no real conversations were marked read during verification. The new shadow behavior passed in the fixture, but needs a live check after extension reload.

final result: passed
