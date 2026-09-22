# Design QA — FP Tools navigation, selected reference 1

## Comparison target

- Source visual truth: `C:\Users\Nikita\.codex\generated_images\01a0c771-e526-7e71-91a0-e09a3c35f4f2\exec-393229d8-484c-4c5a-910f-3baea375b394.png`
- Intended implementation state: light adaptive theme, `Основное` expanded, `Функции` active, at the source viewport of 273 × 698 CSS px.
- Implementation screenshot: unavailable.

## Evidence and comparison status

The available browser inventory contains only an empty Codex in-app Browser. It has no loaded FP Tools extension or browser tab that can render the unpacked extension, so no browser-rendered screenshot exists to compare with the source visual.

Static evidence from the implementation:

- `node tests/t18_navigation_ia.test.js` → `T18_NAVIGATION_IA_PASS`
- `node --check content/ui/main_popup.js` → passed
- `git diff --check` → passed

These checks cover the new 44px section hit areas, 36px nested-page hit areas, neutral active-category state, soft-blue selected-page surface, theme parity, internal scrolling, and the existing accordion/navigation contracts. They do not replace a browser screenshot comparison.

## Required fidelity surfaces

- Fonts and typography: Material Symbols Rounded remains the icon system; section labels are raised to 13px in both static and runtime theme CSS. Browser-rendered weight, antialiasing, and wrapping remain unverified.
- Spacing and layout rhythm: the selected-reference rhythm is encoded as 44px section rows, 36px nested rows, 5px group gaps, and 10px scroll-bottom padding. Visual comparison remains blocked.
- Colors and visual tokens: active categories stay transparent and borderless; selected nested pages use existing `--fptm-accent-soft` and `--fptm-accent-border` tokens in both style layers. Actual light/dark token output remains unverified.
- Image quality and asset fidelity: this navigation contains no raster assets; it keeps the existing bundled Material Symbols Rounded icon font rather than adding substitute artwork.
- Copy and content: the real six-section labels and existing nested-page labels are preserved. The target state is reached through the existing accordion and page-click contracts.

## Findings

- [P1] Browser-rendered design comparison is blocked.
  Location: live FP Tools extension popup.
  Evidence: the source visual is available, but no browser profile/window has FP Tools loaded and the in-app Browser has no extension tab.
  Impact: actual layout, clipping, wrapping, theme-token output, focus styles, and expand/collapse motion cannot be judged from a screenshot.
  Fix: load the unpacked extension in a browser profile, open the popup on FunPay at 273 × 698, capture the `Основное` / `Функции` state, then compare that capture with the source visual.

## Comparison history

1. Initial pass: blocked before visual comparison because an implementation screenshot is unavailable. No P0/P1/P2 design differences could be evaluated from visible evidence.

## Implementation checklist

1. Load FP Tools in a browser and open the selected navigation state.
2. Capture the popup at 273 × 698.
3. Compare source and implementation in one visual review, resolve any P0/P1/P2 differences, and update this report.

## Follow-up polish

- Inspect the hover and keyboard-focus states in the loaded extension; they were preserved but are not visually captured here.

final result: blocked
