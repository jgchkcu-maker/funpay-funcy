# Design QA — FunPay Funcy navigation

## Comparison target

- Source visual truth: `C:\Users\Nikita\Downloads\Изображение Codex 23 сент. 2026 г., 16_35_38.png` (1536 × 1024 px).
- Implementation preview: `http://127.0.0.1:4177/`. The page compares the expanded navigation crop beside a rendered component using the current static stylesheet and runtime theme CSS.
- Browser viewport screenshot: 542 × 802 px. The reference crop (390 × 780 px) is normalized to 260 × 520 CSS px, then shown at 0.85 scale (221 × 442 px) beside the same-sized implementation frame.
- State: light theme, `Основное` expanded, `Общие` current. The active page keeps a blue icon without a filled row.

## Evidence

- Full-view comparison: the source crop and implementation render are shown together in the same in-app browser page.
- Focused comparison: search field, expanded category row, child icon and label alignment, and the collapsed category rows.
- The local preview’s `Основное` toggle was collapsed and reopened. The displayed state was restored before handoff.
- The preview frame is shorter than the source board, so lower categories still scroll in the fixture.

## Required fidelity surfaces

- Fonts and typography: the existing `Inter, Segoe UI, system-ui` stack remains in use; category labels stay bold while child labels use a lighter weight.
- Spacing and layout rhythm: existing sidebar width, search height, category hit area, and child hit area remain in place. The child rows now align their bundled icons and labels like the reference.
- Colors and visual tokens: existing light and dark theme tokens remain intact. The expanded category retains the soft blue surface; the current child is identified by its blue icon without a second filled highlight.
- Image quality and asset fidelity: the six supplied navigation sprite pairs and bundled Material Symbols Rounded font are reused.
- Copy and content: Russian section and child labels remain unchanged.

## Findings

- The free scrolling could stop between category boundaries, leaving the expanded section title partly outside the viewport.
- Added proximity snapping to section boundaries in both the bundled stylesheet and runtime theme CSS. The navigation remains scrollable while its section cards settle with the full header visible.

## Verification

- Reproduced the clipping in the local preview with a 41 px scroll offset: the expanded header was clipped by 33 px.
- After the change, the same scroll input snapped back to the section start (`scrollTop` ≈ 1 px), and the entire header remained visible.
- `node --check content/ui/main_popup.js` — passed.
- `git diff --check` — passed; Git emitted only the existing LF-to-CRLF conversion notices.
- No automated tests were added or run.

final result: passed
