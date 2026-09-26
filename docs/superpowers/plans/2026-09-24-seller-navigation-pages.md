# Seller Navigation and Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить меню FunPay Funcy вокруг задач продавца, объединить пересекающиеся страницы, разделить скрытые сценарии и сохранить все настройки и старые маршруты.

**Architecture:** `content/ui/main_popup.js` остаётся хозяином разметки и схемы меню. Единый `openPopupPage(pageId, options)` управляет переходом независимо от того, пришёл он из меню, нижней кнопки, поиска, внутренней ссылки или хранилища. Вложенные режимы объединённых страниц сохраняют собственные контролы и ключи данных; настройки автоответов всех контекстов проходят через очередь service worker.

**Tech Stack:** Chrome extension content scripts, JavaScript, CSS, `chrome.storage.local`, существующие Node.js тесты на `assert`.

**Spec:** `docs/superpowers/specs/2026-09-24-seller-navigation-taxonomy-design.md`

## Global Constraints

- Целевое меню: 6 групп, 22 пункта в группах, `notes` и `support` как два нижних действия, 24 канонические страницы.
- Сохранять прежние ключи данных, ID полей, `fpToolsLastPage`, `fpToolsNavCollapsed` и существующую логику функций. Новые значения режимов: `fpToolsLastPageMode` для текущей страницы и карта `fpToolsPageModes`; новое значение раскрытых групп: `fpToolsNavExpandedSectionsV2`.
- `slash_commands` открывает `templates/commands`; `currency_calc` открывает `calculator/currency`; все остальные старые page ID остаются достижимыми.
- `global_chat` остаётся реальным `li[data-page="global_chat"]` для удалённого скрытия.
- Не перезаписывать незакоммиченные пользовательские правки и существующие PNG. Текущее рабочее дерево, включая правки меню/иконок/тестов, является базой реализации.
- Статический CSS и встроенный `FPT_MENU_THEME_CSS` обновлять вместе. Сохранять свёрнутую панель, клавиатурный поиск, reduced motion, светлую и тёмную темы.

## Review Focus

1. В хранилище остался `fpToolsLastPage=slash_commands` или `currency_calc`: открывается нужная каноническая страница и соответствующий режим, после чего сохраняется новый маршрут (Task 2, 4, 6).
2. Продавец быстро редактирует приветствие, шаблон отзыва с изображением и бонус: `fpToolsAutoReplies` не теряет поля из-за конкурирующих UI-записей (Task 3, 5).
3. Поиск нашёл заголовок внутри скрытой вкладки или страницы `notes`: сначала открываются правильная страница и режим, затем выполняется прокрутка (Task 8).
4. Свёрнутое меню показывает доступные `notes` и `support`, а удалённый конфиг по-прежнему скрывает `global_chat` (Task 7, 9).
5. Импорт старых настроек содержит ID прежних раскрытых групп или неизвестный режим: попап запускается и раскрывает группу текущей страницы без ошибки (Task 2, 9).

---

### Task 1: Зафиксировать базу и привести навигационные тесты к актуальному рабочему дереву

**Files:**
- Modify: `tests/t18_navigation_ia.test.js`
- Modify: `tests/menu_reference_contract.test.js`
- Modify: `css/fpt_icons_theme.css`, `content/ui/main_popup.js` (synchronize the existing sidebar motion contract)
- Read: `design-qa-navigation.md`

**Interfaces:** Consumes нынешние 25 page ID и 6 групп. Produces тестовую базу, которая проверяет семантические контракты и текущую геометрию без ложных падений.

- [x] Сохранить исходный `git status --short` и запустить оба теста до правок. Исходные падения на `58px` высоты группы и `56px` высоты поиска воспроизведены 2026-09-24; они не являются регрессией этой работы.
- [x] По текущему CSS и актуальному визуальному эталону обновить устаревшие геометрические ожидания тестов. Проверки реальных кнопок, ARIA, существующих DOM-узлов, иконок и анимации сохранены; статический/runtime CSS синхронизирован с контрактом перехода ширины 320ms spring, размеры не менялись ради тестов.
- [x] Заменить жёсткие `25` и список старых ID групп проверкой соответствия схемы реальным пунктам плюс отдельными целевыми ожиданиями Task 7.
- [x] Запустить `node tests/t18_navigation_ia.test.js` и `node tests/menu_reference_contract.test.js`; записать точные результаты.
- [ ] Commit only task-owned files after review: `test: align navigation contracts with current menu`.

### Task 2: Единый переход по страницам и восстановление маршрутов

**Files:**
- Modify: `content/ui/main_popup.js:2951-3853`
- Modify: `content/features/templates.js:652-662`
- Modify: `content/features/piggy_bank.js:84-87`
- Modify: `content/features/global_chat.js:34-85` (visibility change handoff)
- Test: create `tests/navigation_routes.test.js`
- Modify: `tests/t18_navigation_ia.test.js` (replace direct-click/restore assumptions with the router contract)

**Interfaces:** Produces `openPopupPage(pageId, { mode, persist = true, focusTarget } = {})` in popup scope and a guarded `window.fptOpenPopupPage` entry point for existing feature scripts. Mode selection is delegated to page-specific tab functions when present; unsupported mode falls back to that page's default.

- [x] Написать тесты для обычной страницы, `notes`, `support`, неизвестного ID, повторного открытия, сохранения `fpToolsLastPage`, новых `fpToolsLastPageMode` и `fpToolsPageModes`, возврата к выбранному режиму после посещения другой страницы и переноса валидного `sessionStorage.fpt_fin_active_subtab`. Проверить отложенный remote config для `global_chat`, одноразовую инициализацию и вызов `onPageLeave`.
- [x] Запустить `node tests/navigation_routes.test.js` до реализации и подтвердить отсутствие нового контракта.
- [x] Вынести переход в `openPopupPage`, включить нижние действия в активное состояние, добавить нормализацию legacy aliases, сохранять/восстанавливать page modes и безопасно использовать `lot_io` для неизвестной страницы или скрытого `global_chat`.
- [x] Перевести ссылки из чата, копилок и promo support на центральный router; сохранить `__fpEnsurePopup()` и обработчик global-chat visibility.
- [x] Изменить `loadLastActivePage()` на вызов router и запустить новый тест вместе с обоими навигационными тестами.
- [ ] Commit only task-owned files after review: `refactor: centralize popup page navigation`.

### Task 3: Одна очередь записи `fpToolsAutoReplies` для всех контекстов

**Files:**
- Create: `background/auto_reply_store.js` (общая очередь обновления)
- Create: `content/features/auto_reply_store.js` (сообщения в service worker)
- Modify: `background/autoresponder.js:271-275,788-796` (внутренние изменения и сбросы используют очередь)
- Modify: `background/background.js:8,1421-...` (обработчик команды обновления)
- Modify: `content/content_script.js:618-636` (кнопки сброса используют очередь)
- Modify: `content/features/settings_io.js:58-116` (импорт `.fpconfig` для auto-reply ключа)
- Modify: `manifest.json` (загрузить content helper раньше `auto_review.js` и `misc.js`)
- Modify: `content/features/auto_review.js`
- Modify: `content/features/misc.js:259-414`
- Modify: `content/ui/settings_loader.js:462-478,530-684` (загрузить auto-reply объект и дождаться инициализации до включения autosave)
- Test: create `tests/auto_reply_storage.test.js`

**Interfaces:** Content scripts call `fptPatchAutoReplies({ set, merge, arrayOps, unset })`, which sends a runtime message and resolves only after background storage succeeds; settings import uses `fptImportAutoReplies(imported)`. `set` replaces specified scalar fields; `merge` sets keys in nested object maps such as `reviewTemplates` and `reviewTemplateImages`; `unset` accepts top-level fields and individual keys inside those maps; `arrayOps` applies append/upsert/remove operations to the latest array inside the queue and rejects stale index-based edits rather than silently dropping another update. `fptImportAutoReplies` applies imported user preference fields to the latest object, ignores imported per-device runtime markers, and preserves current marker values and unknown fields absent from an older backup. Background-internal read/modify/write operations use `updateAutoReplies(mutator)` in the same serialized queue, so runtime markers, UI patches, content-script resets, list edits and imported settings never write stale whole objects over one another. On a stale list edit the caller reloads the latest value and refreshes the list. All writers found by the repository audit use one of these paths; direct writes to `fpToolsAutoReplies` are prohibited outside the store module.

```js
// Contract exercised by the test; unrelated stored fields remain intact.
await fptPatchAutoReplies({ set: { greetingText: 'Первый текст' } });
await fptPatchAutoReplies({ merge: { reviewTemplates: { '5': 'Спасибо' } } });
await fptPatchAutoReplies({ arrayOps: { randomBonuses: [{ op: 'append', value: 'Бонус' }] } });
// Existing ratings 1–4, images, runtime markers and unknown fields remain intact.
```

- [x] Тестом с mock `chrome.storage.local` перемежать patch от UI, сброс из `content_script.js`, импорт `.fpconfig` и фоновый runtime update; проверить неизвестные поля, все ключи `reviewTemplates` (редактирование 5★ сохраняет 1–4★), изображения, бонусы и маркеры фонового цикла. Импорт старого файла без нового user-pref поля сохраняет текущее значение этого поля, а импортированные `processedMessageIds`/`lastSeenMsgIds` не заменяют локальные runtime markers. Добавить параллельные add/edit/remove списочных элементов и проверить, что stale update не молча удаляет другой элемент.
- [x] Добавить статическую проверку, падающую при прямой записи `fpToolsAutoReplies` вне нового store; она должна охватывать все перечисленные источники.
- [x] Ввести общий сериализованный store в service worker и message API с операциями `set`, `merge`, `arrayOps`, `unset`, `import`; обработчик ждёт запись, отвечает `{ok:true}` после сохранения и возвращает понятную ошибку при отказе storage. В `settings_io.js` убрать `fpToolsAutoReplies` из общего `safe` объекта и передавать его в `fptImportAutoReplies`, которая сливает импортированные user preferences с актуальным объектом и игнорирует per-device markers из файла. Перевести на очередь все content-side writers, а `atomicUpdate` и reset-функцию в `autoresponder.js` — на внутренний updater. Изменить редакторы ключевых слов и бонусов так, чтобы они присылали append/upsert/remove-операции и обновляли список из актуального storage после завершения; глобальный autosave должен отправлять только изменённые поля, не пересобирать и не записывать весь объект. Для изображений отзывов поддержать слияние и удаление ключей карты по оценке. `await` ответа перед сообщением об успешном сохранении. Не менять ключи и смысл существующих данных.
- [x] Включить `fpToolsAutoReplies` в `chrome.storage.local.get(...)` внутри `loadSavedSettings()` и передать `settings.fpToolsAutoReplies` в `initializeAutoReviewUI(savedAutoReplies)`. Исправить инициализатор так, чтобы он заполнял контролы из полного переданного объекта, включая `onlyNewChats`, `ignoreSystemMessages`, `greetingCooldownDays`, `newOrderReply*`, `orderConfirmReply*`, а не собирал неполную копию и не перезаписывал сохранённые значения. Вызов инициализатора должен быть awaited; добавить promise guard до первого `await`, чтобы autosave не запускался до загрузки и не устанавливал дублирующие handlers.
- [x] Убедиться, что глобальный saver не зависит от лениво смонтированных полей: нужные DOM-контролы остаются в попапе.
- [x] Запустить `node tests/auto_reply_storage.test.js` и связанные тесты. Ручная проверка двух быстрых сохранений остаётся в Task 9, если в окружении удастся открыть live popup.
- [x] Commit only task-owned files after review: `fix: serialize auto reply settings writes`.

### Task 4: Объединить шаблоны и слэш-команды в «Быстрые ответы»

**Files:**
- Modify: `content/ui/main_popup.js:354-569,2951-2957,3280-3330`
- Modify: `content/features/slash_telegram_ui.js:55-131`
- Modify: `content/ui/settings_loader.js:59-100`
- Modify: `content/features/templates.js:652-662`
- Test: create `tests/quick_replies_navigation.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:** `templates` is the canonical page with modes `templates` and `commands`; legacy `slash_commands` normalizes to `templates/commands`. `selectQuickRepliesMode(mode)` changes only the visible pane, updates `fpToolsLastPageMode` and `fpToolsPageModes.templates`, and preserves both storage objects. Tabs use the ARIA and keyboard contract from the spec.

- [x] Тестами описать одну страницу `templates`, два режима, legacy alias `slash_commands`, сохранение `fpToolsTemplateSettings`/`fpToolsSlashCommands`, переход из чата и возврат к ранее выбранному режиму, ARIA и клавиши Arrow/Home/End.
- [x] Запустить целевой тест до реализации и подтвердить, что обе старые страницы ещё раздельные.
- [x] Переместить контролы команд в `templates`, удалить отдельный nav/page route `slash_commands` и добавить alias совместимости без переименования ID.
- [x] Обновить инициализаторы команд и шаблонов для собственных панелей; повторный вход не связывает обработчики заново, обычный переход восстанавливает режим.
- [x] Запустить `quick_replies_navigation`, `navigation_routes` и T18; проверка возврата после перезапуска выполнена в тестовом harness.
- [ ] Commit only task-owned files after review: `feat: combine quick reply tools`.

### Task 5: Разделить автоответчик и отзывы

**Files:**
- Modify: `content/ui/main_popup.js:570-691,2951-2957,3280-3330`
- Modify: `content/features/auto_review.js`
- Modify: `content/features/misc.js`
- Modify: `content/ui/settings_loader.js`
- Test: create `tests/auto_reply_pages.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:** New `auto_reply` page holds greeting, order-paid, order-confirmed and keyword rules. Existing `auto_review` page holds review replies and bonuses. Both consume `fptPatchAutoReplies` from Task 3 and keep their original field IDs and data keys.

- [x] Тестами зафиксировать принадлежность заголовков и контролов двум страницам, покрытие прежних полей и отсутствие дублирующихся DOM ID.
- [x] Проверить загрузку старого `fpToolsAutoReplies`, оба инициализатора, изменения приветствия и шаблона 5★ с изображением, повторный запуск, быстрый ввод при загрузке, переключение страниц и фиксированный порядок отправки.
- [x] Запустить тесты до правок и увидеть отсутствие `auto_reply`.
- [x] Разнести разметку и UI-binding по страницам с idempotent promise guard; инициализатор отзывов использует полный объект и ожидается до включения autosave.
- [x] Добавить `auto_reply`, сохранить `auto_review` как прежний canonical route, обновить поиск по заголовкам и прогнать страницу, storage и T18 тесты.
- [ ] Commit only task-owned files after review: `feat: separate autoresponder and review settings`.

### Task 6: Объединить калькуляторы и разобрать «Общие»

**Files:**
- Modify: `content/ui/main_popup.js:167-289,391-447,727-778,1593-1613,2951-2957,3400-3529`
- Modify: `content/features/currency_calculator.js:133-155`
- Modify: `content/features/misc.js:182-245,259-367`
- Modify: `content/features/slash_telegram_ui.js:160-260`
- Modify: `content/ui/settings_loader.js:461-527,593-719`
- Read: `content/features/ui_enhancements.js:3-47`
- Test: create `tests/settings_page_recomposition.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:** `calculator` modes are `math`, `time`, `currency`; `currency_calc` aliases to `calculator/currency`. `general` retains display settings. `telegram` becomes browser/Telegram/Discord notification center; its default mode is `telegram` when no mode was saved. `finance_hub` exposes old-report switches in additional finance settings. Tab roles, relationships, selected states and keyboard behavior match the spec.

- [x] Тестами зафиксировать 3 режима калькулятора, alias `currency_calc`, режимы по умолчанию и восстановление, ID-контролы, lazy currency request, ARIA и клавиатуру.
- [x] Тестами проверить распределение контролов из `general`, ключи звука/громкости, Discord, Telegram, display, `showSalesStats`, `showFinanceStats`, `fptLegacyFinanceReports`, и сохранение Finance Hub режима.
- [x] Запустить целевые тесты до реализации.
- [x] Перенести валютный DOM в `calculator`, оставить прежние math/time handlers, добавить alias и сохранять canonical mode state.
- [x] Перенести звук/Discord в `telegram`, финансовые legacy switches в `finance_hub`, остальные display settings оставить в `general`; сохранить DOM IDs, storage keys, sessionStorage и режимы.
- [x] Запустить автоматические целевые тесты, `navigation_routes` и финансовые тесты; все перечисленные проверки прошли.
- [ ] Вручную проверить звук, Discord, Telegram и обычный/временный/валютный калькуляторы после перезапуска. Заблокировано: CUA не обнаружил браузера или окна приложения; ограничение зафиксировано в A6/A9 reports.
- [ ] Commit only task-owned files after review: `feat: consolidate calculators and notification settings`.

### Task 7: Новые группы, нижние действия и иконки

**Files:**
- Modify: `content/ui/main_popup.js:58-65,120-165,2951-3277`
- Modify: `css/fpt_icons_theme.css`
- Modify: `css/content_styles.css` for footer, hover, compact-panel, reduced-motion and long-label states
- Create: `icons/nav-help-collapsed.png`, `icons/nav-help-expanded.png`
- Modify: `tests/t18_navigation_ia.test.js`
- Modify: `tests/menu_reference_contract.test.js`

**Interfaces:** `FPT_NAV_SECTIONS` contains exactly the following IDs in order: `sales`, `customers`, `finance`, `interface`, `settings`, `help`. It owns exactly 22 page IDs. `notes`/`support` are separate quick-action routes. Expansion uses `fpToolsNavExpandedSectionsV2`.

```js
const targetSections = {
  sales: ['lot_io', 'auto_delivery', 'autobump'],
  customers: ['auto_reply', 'auto_review', 'templates', 'blacklist'],
  finance: ['finance_hub', 'piggy_banks', 'calculator'],
  interface: ['theme', 'effects', 'epic_nicks', 'needs'],
  settings: ['accounts', 'general', 'telegram', 'settings_io'],
  help: ['overview', 'tickets', 'global_chat']
};
```

- [x] Обновить тесты на точный порядок/состав 22 пунктов, наличие двух нижних действий, уникальность всех 24 канонических страниц, правильные иконки и сохранение удалённой видимости `global_chat`.
- [x] Запустить их до новой схемы; подтвердить несовпадение.
- [x] Обновить видимые названия по таблице спеки и `FPT_NAV_SECTIONS`. Перенести `notes` и `support` в футер, оставив реальные страницы. Установить `lot_io` начальной страницей. Убрать fallback на старый `more`. Обновить промо-текст и все внутренние подсказки/ссылки, называющие прежние вкладки или страницы, включая видео-подписи в справке; проверить, что ссылка на оценку расширения маршрутизирует в `support`.
- [x] Добавить новый help sprite в том же размере/манере, что нынешние иконки, и обновить `FPT_NAV_ICON_ASSETS`. Старые PNG этой задачей не изменялись. Обновить статический и runtime CSS для футера, раскрытого/свёрнутого состояния и длинных подписей.
- [x] Читать новые expanded IDs только из `fpToolsNavExpandedSectionsV2`; если значения отсутствуют или недопустимы, раскрыть группу активной страницы. Прежний `fpToolsNavCollapsed` читать как раньше.
- [x] Запустить `t18`, `menu_reference_contract`, `navigation_routes`; все три теста прошли и в самостоятельном повторном прогоне.
- [ ] Проверить кликами все шесть групп, две нижние кнопки и компактный режим. Заблокировано: CUA не видит доступный браузер или открытый попап; точное ограничение фиксируется в A9.
- [ ] Commit only task-owned files after review: `feat: organize seller navigation by task`. Коммит отложен: общие файлы содержат незакоммиченные пользовательские/предыдущие изменения, поэтому узкий staging нельзя подтвердить без риска захватить их.

### Task 8: Поиск по новым и прежним названиям, включая скрытые вкладки

**Files:**
- Modify: `content/ui/main_popup.js:3644-3808`
- Test: create `tests/navigation_search_routes.test.js`
- Modify: `tests/t18_navigation_ia.test.js`

**Interfaces:** Search index entries include `{ groupId, pageId, mode, text, aliases, element }`. Navigation and result activation call `openPopupPage` before scrolling. Quick actions have human labels even without a nav `li`. A query matching a group heading reveals that group's child page entries and expands the group; it does not navigate automatically.

- [x] Тестами проверить старые названия «Слэш-команды», «Валюты», «Функции», «Тикеты», новые названия, `notes`, `support`, каждый заголовок группы (по совпадению раскрыты все страницы только этой группы), заголовок внутри неактивного режима и позднее скрытие `global_chat` после построения индекса (пункт и внутренние элементы исключены, stale results убраны).
- [x] Проверить отдельным тестом, что «поддержка» выводит `tickets` с пометкой FunPay, а «оценить расширение» — нижнее действие `support`; поиск по импорту показывает и лоты, и перенос настроек.
- [x] Запустить тест до обновления индекса.
- [x] Добавить явный словарь синонимов, названия `FPT_NAV_SECTIONS` в индекс и индексы внутренних панелей режимов. Совпадение с группой раскрывает только её дочерние пункты; совпадение пункта или старого термина фильтрует меню по соответствующей подписи. Полный индекс исключает страницы, у которых nav `li` скрыт remote config; при изменении display индекс и результаты перестраиваются. Результат вызывает `openPopupPage(pageId, { mode })`, ждёт появления нужной панели, затем подсвечивает точный элемент.
- [x] Автоматически проверить, что очистка общего меню-поиска возвращает прежнее раскрытие/свёрнутость и не перезаписывает сохранённые предпочтения. Отдельный поиск внутри `needs` покрывается планом `2026-09-24-interface-elements-taxonomy.md`. Целевой тест, `t18`, маршруты, синтаксис и `git diff --check` прошли.
- [ ] Вручную проверить `Ctrl/Cmd+K`. Заблокировано: CUA не обнаружил доступного браузера или открытого попапа; автоматические тесты покрывают активацию поиска.
- [ ] Commit only task-owned files after review: `feat: route navigation search across merged pages`. Коммит отложен из-за смешанных незакоммиченных изменений в общих файлах; A8 report содержит ограничение.

### Task 9: Сквозная проверка, тексты и готовность к выпуску

**Files:**
- Modify only defects discovered in Task 9 in task-owned product/tests files
- Create: `docs/navigation-tree-test-2026-09-24.md` with the five seller scenarios from the spec
- Read: `docs/superpowers/specs/2026-09-24-seller-navigation-taxonomy-design.md`

**Interfaces:** Produces a validated navigation handoff; does not create new feature behavior.

- [x] Сверить все 25 старых page ID с 24 каноническими страницами и 2 aliases; проверить 22 пункта меню + 2 нижних действия, уникальность 377 ID в статическом шаблоне попапа (повторов нет), все 6 групп и пользовательские настройки по тестам.
- [x] Проверить старые значения `fpToolsLastPage`, `fpToolsNavExpandedSections`, `fpToolsNavCollapsed`, импорт старого `.fpconfig` и неизвестный режим. Тесты подтвердили alias/canonical fallback и безопасный неизвестный режим; runtime harness `LEGACY_FPCONFIG_IMPORT_PASS` импортировал v1 файл, сохранил пользовательские настройки и исключил аккаунты/состояние текущего окна. Старый/частично заполненный storage не сбрасывает настройки функций.
- [x] Составить `docs/navigation-tree-test-2026-09-24.md` с пятью сценариями продавца и автоматическими доказательствами. Реальные шаги в попапе и матрица expanded/compact, light/dark, клавиатуры и reduced motion заблокированы: CUA не обнаружил браузера или окна приложения; это отмечено в документе. Скриншотов нет.
- [x] Проверить навигационные подписи, «Где найти» и промо-текст по Task 7 и тестам; устаревших ссылок на перемещённые страницы не найдено.
- [x] Запустить `node --check` для 22 изменённых JS, оба навигационных теста, целевые тесты и полный набор `tests/*.test.js`: 47 passed, 0 failed. Для полного запуска в PowerShell использовать:

```powershell
$failed = @()
Get-ChildItem tests -Filter *.test.js | ForEach-Object {
    node $_.FullName
    if ($LASTEXITCODE -ne 0) { $failed += $_.Name }
}
if ($failed.Count) { throw ($failed -join ', ') }
```

- [x] Запустить `git diff --check` (exit 0, только autocrlf advisories), проверить diff на посторонние изменения и сохранить pre-existing user edits. Тестовых ошибок нет. Продавцов для tree test нет; измеренный рост находимости не заявляется.
- [ ] Commit only verification-driven fixes after review: `test: verify seller navigation migration`. В A9 не понадобились исходные исправления; общий набор включает несколько задач и заранее изменённые пользователем файлы, поэтому коммит отложен.

## Execution Boundary

После Tasks 1–9 этот план завершает боковое меню и страницы. Каталог 37 переключателей выполняется по `docs/superpowers/plans/2026-09-24-interface-elements-taxonomy.md`; итоговый выпуск требует прохождения обоих планов. Перед реализацией нужно сохранить текущее незакоммиченное рабочее состояние и работать с ним как с исходной версией — чистый worktree от `HEAD` без переноса этих правок не представляет текущий интерфейс.
