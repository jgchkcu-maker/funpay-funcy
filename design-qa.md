# Design QA — Finance overview KPI cards

## Comparison target

- Source visual truth: `C:\Users\Nikita\AppData\Local\Temp\codex-clipboard-82591537-ecbc-4d92-b6ec-588150710e32.png`
- Intended implementation state: Finance Hub → `Обзор`, desktop light theme, overview data loaded; also hover, keyboard focus, skeleton loading, and empty values.
- Implementation screenshot: unavailable — no browser profile with the FP Tools extension loaded is available in this environment.
- Source pixels / density: 1326 × 336 px screenshot, CSS viewport and device scale unavailable.
- Implementation pixels / CSS size / density: unavailable.

## Evidence and comparison status

The source reference was supplied in the task. The browser inventory contains only an empty Codex in-app Browser and no FP Tools extension tab, so an implementation screen cannot be opened, captured, normalized, or compared alongside the source.

Automated implementation evidence:

- `node tests/finance_overview_kpi_cards.test.js` verifies all eight overview cards have keyboard-accessible interactive targets and route to Sales, Profit, or Potential through the standard subtab transition.
- Full project test suite passes, including KPI layout and Finance regression checks.
- `node --check content/features/finance_hub.js` and `node --check content/ui/main_popup.js` pass.

## Required fidelity surfaces

- Fonts and typography: Material Symbols Rounded is the project’s existing icon system. Browser-rendered font weight, antialiasing, and wrapping are unverified.
- Spacing and layout rhythm: the four-column, two-row KPI grid and equal card height contracts are covered by automated tests; actual screenshot comparison is blocked.
- Colors and visual tokens: semantic icon colors, card hover, and keyboard focus use Finance theme tokens. Light and dark rendered output is unverified.
- Image quality and asset fidelity: no raster imagery is used by the target cards; all icons use the existing bundled Material Symbols Rounded font.
- Copy and content: the existing eight KPI names and live value/subtitle renderers are retained. Each card now has a specific accessible navigation label.

## Findings

- [P1] Browser-rendered visual comparison is blocked.
  Location: live FP Tools Finance Hub.
  Evidence: no loaded extension/browser tab is available to capture the post-change overview state.
  Impact: precise typography, padding, theme rendering, responsive layout, hover/focus motion, and live click transitions cannot be visually judged against the source.
  Fix: load the unpacked extension in a browser, open Finance Hub → `Обзор` in light theme, and capture the loaded, hover, focus, skeleton, and empty states at a matched desktop viewport.

## Implementation checklist

1. Load the extension in a browser and open the Finance Hub overview.
2. Capture matching loaded and interaction states.
3. Compare them with the source in one visual review, resolve P0/P1/P2 differences, then update this report.

## Follow-up polish

- If live capture shows cramped titles at narrow widths, refine only the KPI header spacing and icon size; preserve the existing grid and data semantics.

final result: blocked
