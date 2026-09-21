# T20 — Export modal theme integration

## Problem / root cause

`finance_hub.js::ensureExportModalStyles()` injects a separate hardcoded dark theme with colors such as `#1a1c23`, `#21242d`, `#14161d`, etc.

Therefore Export can visually detach from the light Finance Hub theme.

## Relevant current code

Files:
- `content/features/finance_hub.js`
- `css/content_styles.css`

Anchors:
- `ensureExportModalStyles()`
- `openExportModal()`
- `.fpt-fin-export-*`

Important architectural detail:
`openExportModal()` appends the overlay to `document.body`. Theme variables may live on `.fp-tools-popup`, and moving a fixed overlay inside a transformed popup can change fixed-position behavior.

## Required change

Move Export modal CSS into the Finance section of `content_styles.css`.

Remove runtime style injection / `ensureExportModalStyles()` usage.

Use shared theme variables for surface/text/border/accent:
- `--fptm-surface`
- `--fptm-surface-2`
- `--fptm-field`
- `--fptm-border`
- `--fptm-text`
- `--fptm-muted`
- `--fptm-accent`
- `--fptm-accent-soft`

Because the overlay remains under `body`, copy the required computed theme variables from the active `.fp-tools-popup` onto the overlay (or use another equally safe mechanism) before display.

Replace export-specific inline hardcoded presentation colors with classes where practical.

Keep semantic success/error colors only where they communicate actual state.

## Constraints

- Do not change export dataset semantics.
- Keep delegation to `FPTExportStudio.financeExport`.
- Preserve CSV/JSON behavior, Escape close, overlay click close, close button.
- Do not move the fixed modal under a transformed ancestor without proving it is safe.

## Verification

Add `tests/t20_export_modal_theme_integration.test.js`:
- runtime `ensureExportModalStyles` no longer exists/is called
- export dialog CSS uses theme vars
- old hardcoded modal surface palette is absent from Export implementation
- theme propagation helper exists if overlay remains under body

Run T10 export tests and T20.

Manual: open Export in light and dark themes.

## Acceptance

Export visually follows the same active theme as Finance Hub without changing exported data.
