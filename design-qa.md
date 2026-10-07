# Design QA — Finance overview KPI cards

## Comparison target

- Source visual truth: `C:\Users\Nikita\AppData\Local\Temp\codex-clipboard-0462fe40-4398-4e16-a97d-bf5386c65443.png` (user reference #1, 1326 × 338 px).
- Implementation preview: `http://127.0.0.1:4173/AppData/Local/Temp/funpay-funcy-finance-preview.html`.
- Comparison scope: the eight-card overview KPI grid. The right-side “interactive states” column in the reference is a visual state showcase, not an additional production panel.

## Evidence and comparison status

The implementation was rendered in the Codex in-app browser with representative finance values, the light theme, and the complete 4 × 2 overview grid. The focused region was compared against the source visual for card geometry, hierarchy, icon treatment, spacing, color accents, and decorative chart treatment.

Additional interaction evidence:

- The first KPI card receives keyboard focus through the normal Tab sequence.
- Enter and Space activate the existing card drill-down behavior.
- The existing dynamic finance values and click targets remain owned by `finance_hub.js`.

## Required fidelity surfaces

- Fonts and typography: existing bundled Material Symbols Rounded plus the repository’s inherited UI font; no literal icon-name artifacts remain in the rendered preview.
- Spacing and layout rhythm: 4 × 2 grid, 15px card radius, 35px colored icon tiles, aligned value column, compact footer metadata, and responsive tablet/mobile overrides.
- Colors and visual tokens: pale adaptive card surfaces with per-metric green, blue, amber, violet, red, and cyan accents; hover and focus-visible states use the existing theme variables.
- Image quality and asset fidelity: the source contains no raster artwork in the KPI cards; existing icon-font assets are reused and the sparkline treatment is represented by a low-contrast decorative chart glyph.
- Copy and content: source-aligned KPI labels are preserved, including `Потенциальная выручка`; live values, subtitles, and drill-down destinations remain dynamic.
- States: hover, active, keyboard focus, empty values, and existing loading/skeleton behavior are covered without replacing the finance data controller.

## Findings

- No P0, P1, or P2 visual issues remain in the scoped overview grid.
- [P3] The bundled icon font renders `more_vert` reliably while `more_horiz` produces an unsupported glyph in this extension build. The implementation uses the clean vertical overflow affordance to avoid a visible text/square artifact; this is a minor icon-shape difference from the reference.

## Verification

- `node tests/finance_overview_visual_contract.test.js` → `FINANCE_OVERVIEW_VISUAL_CONTRACT_PASS`
- Full test suite → `TEST_SUMMARY passed=36 failed=0`
- `node --check content/ui/main_popup.js` → passed
- `node --check content/features/finance_hub.js` → passed
- `git diff --check` → passed

## Comparison history

1. Initial implementation: old dense KPI cards replaced with the reference-inspired soft card treatment while preserving finance behavior.
2. Visual QA pass: removed unsupported overflow-icon artifacts, verified the 4 × 2 grid, and confirmed keyboard focus/activation.

final result: passed

---

# Auto-delivery screen — visual QA

## Sources and state

- Current extension shell and sidebar: `C:\Users\Usser\AppData\Local\Temp\codex-clipboard-f0a4ded0-d9ed-49d1-89ec-7e26e6a77f34.png` (1204 × 789).
- Selected content design: `C:\Users\Usser\AppData\Local\Temp\codex-clipboard-ac552a03-290a-40f1-8744-8da28a954556.png` (1153 × 1014).
- Implementation screenshot: `C:\Users\Usser\AppData\Local\Temp\funpay-auto-delivery-reference\auto-delivery-1204x789.png` (1204 × 789).
- State: light theme, both warehouse rules enabled; three lots show stock 6, unknown stock, and empty stock. “Секреты лота” and “Свой шаблон”, explicit save, load/save errors, and a 680 px viewport were checked.

## Comparison

- The existing extension shell, navigation, brand, light palette, and violet accent remain in place.
- The chosen hierarchy is present: category title and help, global warehouse rules, then per-lot settings and the load action.
- Lot controls stack at the available content width. The narrow viewport test confirms the row has no horizontal overflow.
- “На складе: 6 шт.”, “Склад пуст”, and “Остаток не отслеживается” use distinct text and colors. The template editor opens in its lot row.
- Neutral demo lot names are used. The test image URLs are unavailable, so the screenshot uses the built-in stock icons; no secret contents are shown.

## Result

**Passed.** The implementation follows the selected direction, preserves the current sidebar, and adapts to the available width. Load and save errors remain visible, and unknown stock is not presented as zero. No blocking visual issue was found.

---

# Themes screen — visual QA

## Sources and state

- Shell, navigation and palette: the existing extension popup (light and dark popup palettes, violet accent, `--fptm-*` tokens). Layout language follows the auto-bump and auto-delivery screens: hero status card, grouped cards, spring-eased switches.
- Implementation screenshots: rendered from `tests/theme_page_browser.test.js` (set `FPT_SHOT_DIR` to keep them): light top and bottom, dark top, dirty state with the apply dock, gallery selection, expanded details, reset dialog, and dark popup at 1100, 860 and 560 px.
- State: theme enabled and disabled, draft with unapplied changes, gallery catalogue loaded, custom scrollbar, glass, soft separators, decorative circles and header-at-bottom previews.

## Comparison

- Hero shows the master switch, status pill (`Включена`, `Выключена`, `Есть неприменённые изменения`) and collapses to a stacked layout below 620 px.
- Gallery strip uses scroll-snap tiles with skeleton, error with retry, and empty states. The selected tile gets an accent ring and a check badge.
- Colours are five palette tiles. Colours the site corrects for readability are marked `Подправлен`; the text tile reports the contrast ratio against the block colour.
- The live preview uses its own variables and reflects colours, radius, font, background blur and brightness, glass, scrollbar, separators, circles and header position. Settings stay in a draft until `Применить`; `Отменить` restores, `Сбросить` asks through a page dialog, and `Применить и включить` is shown while the theme is off.
- Dark popup palette, 1100 / 860 / 560 px widths and reduced motion keep content inside the frame with no horizontal overflow.

## Result

**Passed.** No blocking visual issue was found. Known limits: preview thumbnails for the community catalogue need network access to GitHub, and the default FunPay wallpaper in the preview is requested only after the page is first opened.

### Themes screen — round 2 (original look, tools card)

- Card header is a `div` (the site theme paints bare `header` elements), native file inputs are hidden with `display: none !important`; verified with an injected `header { background: red !important }` rule.
- New `baseStyle: 'original'` (tile «Оригинальная», also the result of «Сбросить»): no wallpaper or recolouring, font, radius, scrollbar, circles and separators still apply; «Фон», «Цвета», «Блоки» are locked with a note. Preview switches to a light FunPay mock.
- Result: Passed (`fpt-theme-original.png`). Not checked on the live FunPay site.

### Themes screen — round 3 (site theme leaking into the menu)

- The generated site theme CSS is now guarded with `:not(:where(.fp-tools-popup, .fp-tools-popup *))`, so bare `header`/`a`/`p`/`h5` rules no longer paint the menu (grey backdrop under category titles and dialog headers, text shadows on nav links). Specificity of the site rules is unchanged.
- `fptResolveBg` uses the theme block colour (`data-fpt-theme-bg`) while the custom theme is on: the wallpaper lives on `body::before`, so no element had a background and the menu stayed light on a dark themed page. Checked in a real browser with the dark theme applied (`fpt-theme-leak-dark.png`). Not checked on the live site.

---

# Autoresponder screen — visual QA

## Sources and state

- Shell, navigation and palette: the existing extension popup (light and dark popup palettes, violet accent, `--fptm-*` tokens). Layout language follows the auto-bump and auto-delivery screens: summary hero, grouped cards, spring-eased switches. The previous markup (`git show HEAD:content/ui/main_popup.js`, lines 689-838) was used for the field list, copy and the "disabled scenarios stay compact" behaviour.
- Implementation screenshots: rendered with the mocked-`chrome` harness used by `tests/popup_browser.test.js` and driven by `tests/auto_reply_browser.test.js`: empty settings, three scenarios on, rules disabled, seven rules with search, light and dark popup at 1440, 740 and 520 px, rule dialog (new and edit), delete confirmation and help popover.
- State: every scenario on and off, unsaved edits, saved image attachments with both send orders, image-only keyword rule, stale edit reported by the store, store unavailable.

## Comparison

- The hero has no switch because the engine has no master flag. Its pill (`Работает` / `Выключен`) and three metrics (enabled scenarios, rule count, repeat-greeting policy) are derived from the saved settings only. While loading or on error the values show `—`, never zero.
- Scenario cards are collapsed while off and expand with the same spring timing as the theme disclosure rows; the whole card is covered by the reduced-motion block. Enabling a scenario saves at once and rolls the switch back when the store rejects it; text, pictures, send order and the cooldown number save together with `Сохранить`, which stays disabled until something changed. `Не сохранено` and `Отменить` appear with an unsaved draft.
- Variable chips list only what the engine fills for that event (`{buyername} {welcome} {date}` for the greeting and keyword replies; `{orderid}` and `{orderlink}` additionally for the two order replies). `{lotname}` and `$sleep` from the old copy are no longer offered because they resolve to nothing in these replies.
- The send-order control appears only when a reply has both text and at least one picture; the stored values are `text_first` / `image_first`, which are the only ones the engine honours.
- Keyword rules show phrase, match-mode badge, picture count and a two-line preview. Edit and delete are real actions; delete uses a page dialog. Rules stay visible but dimmed, with an explanation, while the block is off. With no rules the empty state carries the single `Добавить первое правило` button.
- 1000 / 740 / 520 px keep the page free of horizontal overflow; below 520 px the card header, footer buttons and rule rows stack.

## Result

**Passed.** No blocking visual issue was found. Known limits: not checked against the live FunPay site or a real service worker (the browser tests emulate the auto-reply store); pictures are capped at five per reply by the screen, which the engine itself does not require.

### Autoresponder screen — class isolation

- All pages share one popup DOM and the neighbouring browser tests look elements up document-wide, so this screen owns its hero, pill, metric, search and segmented-control classes (`fpt-ar-*`) instead of reusing `fpt-ab-*`, `fpt-ad-search` and `fpt-th-seg*`. `tests/auto_reply_ui_contract.test.js` fails if those names come back.

---

# Effects screen — visual QA

## Sources and state

- Shell, navigation and palette: the existing popup (light and dark palettes, violet accent, `--fptm-*` tokens). Layout follows the auto-bump and themes screens: hero card on top, grouped cards with a master switch, spring-eased controls.
- Implementation screenshots: rendered from `tests/effects_browser.test.js` (set `FPT_SCREENSHOT_DIR` to keep them): light top, custom cursor card with an uploaded image, dark top, dark particles card, dark popup at 860 and 560 px.
- State: particles off and on (sparkle, trail, snow, blood), two-colour and rainbow modes, custom cursor without an image, with an image, after removal, a rejected oversize file and a failed save.

## Comparison

- The preview stage stays dark in both themes so white snow and light colours remain visible; it runs a demo path when idle and follows the pointer on hover. The demo stops while the page is hidden and is pointer-only with reduced motion.
- Effect types are a radio group of tiles; the selected tile takes the current colours (or a rainbow) so the choice reads at a glance.
- Saving is immediate, like auto-bump. Sliders and colour pickers are debounced; a failed save rolls the control back and shows a toast.
- At 1204 px the four type tiles sit in one row; below 680 px they wrap to two, below 420 px to one, and card headers stack. No horizontal overflow at 860 or 560 px.

## Result

**Passed.** No blocking visual issue was found.

---

# FunPay support screen — visual QA

## Sources and state

- Shell, navigation and palette: the existing popup (light and dark palettes, violet accent, `--fptm-*` tokens). Layout follows the effects and autoresponder screens: hero card on top, grouped cards, spring-eased controls. The field list, copy and flows come from the pre-refactor tickets markup (`git show f1cc19f^:content/ui/main_popup.js`, lines 2063-2200).
- Implementation screenshots: rendered from `tests/support_browser.test.js` (set `FPT_SCREENSHOT_DIR` to keep them): light top, ticket list, conversation, new-ticket form with a validation error, order-request preview, dark popup at 1204, 860 and 560 px, dark conversation at 560 px.
- State: tickets loading, loaded with all four statuses, load error (not signed in), empty list, no match for a search, conversation with site HTML (links, an image, a script and inline handlers), reply sent, ticket closed, new ticket with a conditional field, failed and repeated send, no unconfirmed orders.

## Comparison

- The hero shows the open-ticket pill and three metrics (all, active, closed) that double as list filters. While loading or on error the metrics show `—`, never zero.
- «Подтверждение заказов» keeps both limits from the old screen. The order age is now applied: the background reads each order's date and skips younger orders, oldest first; the preview lists every order with its age before anything is sent. The limits are remembered.
- The ticket list filters, searches (by subject or `#number`) and sorts locally. Active tickets offer closing, which asks first.
- A ticket opens in place: back, reload, close and open-on-site in the head; the conversation rebuilds site HTML from an allow-list, so scripts, handlers and styles never reach the popup. Enter sends, Shift + Enter adds a line; a closed ticket explains why there is no reply box.
- A new ticket loads its topics and fields from the support site, prefills the nickname, shows conditional fields only when their trigger is chosen, checks required fields, and always ends on a preview with «Назад» back to the filled-in form. A failed send keeps the preview open for another try.
- 1204 / 860 / 560 px keep the screen free of horizontal overflow; below 560 px cards, the toolbar and ticket rows stack.

## Result

**Passed.** No blocking visual issue was found. Known limits: not checked against the live support.funpay.com or a real service worker (the browser tests emulate the background replies); attachments are not offered because the background has no upload path for them.

---

# Windows on FunPay pages — visual QA

## Sources and state

- Reference: the extension menu (light and dark palettes from `fptMenuPalette`, violet accent `#7663f6`, `--fptm-*` tokens, 16–22 px radii, card headers with an accent icon tile). The starting point was the user screenshot of «Копирование лота», which took its surface and blue accent from the page and looked like neither FunPay nor the menu.
- Shared shell: `content/ui/page_windows.js` (`fptWindow.create / open / close`) and `css/page_windows.css`. Every window gets the menu palette through `fptApplyMenuTheme`, closes on Escape, the close button or a backdrop click, keeps Tab inside, returns focus to the opener, and stacks (Escape closes only the top window).
- Windows moved onto the shell: «Копирование лота», «Импорт данных лота», «Клонирование лота», «Копии в других категориях», «Редактор цен», «Включить лоты», «ИИ-генератор лотов», «Генератор изображений», «Шаблон пуст», «Управление метками», «Менеджер товаров» with «Массовое добавление» and «Дублирование товара», «Стойте, это не точные данные?», the operations and orders lists of the legacy statistics, «Отправка изображений» with the image editor, and the MagicStick «Мои стили» and selector windows. The category side panel, the lot context menu with its «Написать» panel and the order price popover take the same palette (`fptWindow.paint`).
- Implementation screenshots: rendered with the scratch harness and `tests/page_windows_browser.test.js` (set `FPT_SCREENSHOT_DIR`): light and dark pages at 1280 px and 420 px, stacked windows, FunPay Bootstrap rules plus the custom site theme injected on top.

## Comparison

- Head: accent icon tile, 18 px title, muted subtitle (for the lot copy it carries the category and seller that used to sit at the bottom), round-cornered close button. Footer: status on the left, quiet secondary and filled primary actions on the right, the same button metrics as the menu dialogs.
- Content is grouped into cards with icon headers; RU / EN, price modes, generator tabs and editor tools are the menu's segmented switcher; checkboxes, inputs, colour swatches and sliders use the menu controls. The category clone picker replaced native multi-selects with checkbox grids and shows the number of copies before anything is sent.
- Bare-tag rules from FunPay Bootstrap and the custom site theme no longer reach windows (`:where()` reset in the stylesheet, the theme guard in `theme.js` now covers `.fpt-win-scrim`); checked in a browser with both injected.
- Below 560 px windows become bottom sheets with 12 px gutters, two-column layouts stack, footers stretch their buttons; no horizontal overflow in any window at 420 px.

## Result

**Passed.** No blocking visual issue was found. Known limits: not checked on the live FunPay site; the image generator preview icon uses Google's Material Icons font, which the offline harness cannot load; in «Менеджер товаров» the close button, Escape and a backdrop click save the items like the old close button did, only «Отмена» discards them.
