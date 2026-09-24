# Interface Elements Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать каталог 37 включаемых элементов понятным по месту и задаче, сохранив каждый переключатель и его эффект.

**Architecture:** `content/features/feature_registry.js` остаётся единственным реестром `id`, `selector`, `preview`, подписи, описания и локальных `legacyLabels`. Метаданные `group`/`subgroup` задают шесть верхних групп и три подгруппы чата. `content/features/needs_tab.js` рендерит их в явном порядке и ищет по названию элемента, описанию, группе, подгруппе и старым подписям. Старые подписи не передаются ИИ. `feature_disabler.js` и значения в `fpToolsDisabledFeatures` не меняются.

**Tech Stack:** Chrome extension content scripts, JavaScript, CSS, `chrome.storage.local`, Node.js `assert` tests.

**Spec:** `docs/superpowers/specs/2026-09-24-seller-navigation-taxonomy-design.md`

## Global Constraints

- Ровно 37 прежних ID и 37 прежних селекторов остаются уникальными и связаны теми же парами `id → selector`.
- Шесть верхних групп в порядке: «Верхняя панель» (1), «Чат» (12), «Создание и оформление лота» (5), «Копирование и импорт лотов» (5), «Цены и аналитика» (6), «Список лотов и профиль» (8).
- Внутри «Чат»: «Поле ввода» (5), «Шапка диалога» (2), «Действия в диалоге» (5).
- `fpToolsDisabledFeatures` хранит прежние ID. ИИ-сопоставление использует прежний контракт ID/label/desc и не теряет возможность выбрать все не заблокированные элементы.
- Пункт бокового меню (`FPT_NAV_LABEL_OVERRIDES.needs`) и заголовок страницы называются «Элементы интерфейса» согласно общей спецификации. Этот план можно выполнить отдельно от объединения других страниц, если тесты маршрута `needs` сохраняются.

## Review Focus

1. Старый список `fpToolsDisabledFeatures` содержит ID из бывшей одиночной группы «Заметки»: этот элемент остаётся выключен после изменения группы (Task 1, 3).
2. Поиск «Шапка диалога» или «Копирование и импорт» показывает соответствующие элементы, хотя эти слова отсутствуют в их старых подписях. Поиск дочерней «Клавиатуры» сохраняет родителя «Блок шрифта и спецсимволов» рядом как контекст (Task 2).
3. Фильтр дал совпадение только в одной подгруппе «Чат»: пустые подгруппы не показываются, заголовок «Чат» остаётся видимым (Task 2).
4. Выключен родительский `lot_font_controls`, но `lot_keyboard_btn` включён: дочерняя строка визуально приглушена немедленно, без изменения её сохранённого ID/значения; то же обновление происходит после подтверждения действия ИИ (Task 2, 3).
5. ИИ вернул прежний ID после переименования группы: карточка подтверждения и отключение работают по ID, не по тексту группы (Task 3).

---

### Task 1: Задать точную таксономию в реестре и закрепить её тестом

**Files:**
- Modify: `content/features/feature_registry.js:22-339`
- Test: create `tests/needs_registry_taxonomy.test.js`

**Interfaces:** Each `FPT_FEATURE_REGISTRY` entry retains its `id`, `selector`, `preview`, `locked` and behavior fields. It gains one of six `group` values; the 12 chat entries also gain a `subgroup` value.

```js
const FPT_NEEDS_GROUP_ORDER = [
  'Верхняя панель', 'Чат', 'Создание и оформление лота',
  'Копирование и импорт лотов', 'Цены и аналитика',
  'Список лотов и профиль'
];
const FPT_NEEDS_CHAT_SUBGROUP_ORDER = [
  'Поле ввода', 'Шапка диалога', 'Действия в диалоге'
];
```

- [x] Снять до правок таблицу всех 37 пар `id → selector` из реестра и положить её в тест как исходный контракт. Тест должен также проверять уникальность ID и селекторов, если один селектор не разделяется намеренно в нынешнем реестре.
- [x] Добавить в тест точные шесть наборов ID и счётчики `1/12/5/5/6/8`, три набора чата `5/2/5`, а также отсутствие ID без группы или с неизвестной группой. Точные наборы перечислены в спецификации; не выводить ожидание из нового реестра, иначе тест повторит ошибку реализации.
- [x] Запустить `node tests/needs_registry_taxonomy.test.js` и получить падение на старых девяти группах.
- [x] Проставить группы/подгруппы всем 37 записям. Для `lot_font_controls` уточнить подпись «Блок шрифта и спецсимволов», для `lot_keyboard_btn` — «Кнопка „Клавиатура“»; прежние ID и селекторы оставить.
- [x] Запустить целевой тест и `node --check content/features/feature_registry.js`. Проверить diff: поля `selector`, `preview`, `locked` и ID не изменились.
- [x] Commit only task-owned files after review: `refactor: classify interface elements by seller task`.

### Task 2: Отрисовать шесть групп, подгруппы чата и поиск по ним

**Files:**
- Modify: `content/features/needs_tab.js:45-95,156-207,259-290` (render, filter context, dependent states)
- Modify: `css/content_styles.css` for group/subgroup hierarchy and dependent-row/context styling
- Modify: `content/features/feature_registry.js` to retain legacy labels on renamed entries
- Modify: `content/ui/main_popup.js:328-351,2960-2962` for page title/copy and visible nav label
- Test: create `tests/needs_group_render_search.test.js`

**Interfaces:** `fptRenderNeedsList(filterText)` uses `FPT_NEEDS_GROUP_ORDER` and `FPT_NEEDS_CHAT_SUBGROUP_ORDER` from Task 1. Search text for an entry is `label + desc + group + subgroup + legacyLabels`; AI payload remains `{ id, label, desc }`. When only `lot_keyboard_btn` matches, render its `lot_font_controls` row as a labeled context row without changing either checkbox value or persisted ID.

- [x] Тестами проверить порядок групп независимо от порядка записей в `FPT_FEATURE_REGISTRY`, вложение 12 элементов чата под три подзаголовка, сохранение предпросмотра и `data-id` каждого переключателя.
- [x] Тестами проверить запрос по названию группы, подгруппы, старому названию функции и обычному описанию; пустые группы/подгруппы не выводить. Проверить точные прежние названия `Функции` и `Шрифты и спецсимволы в лоте`, а также поиск только `Клавиатура`, где родительская строка видна как контекст, но её checkbox не меняется от фильтра. Отдельно проверить пустой результат.
- [x] Запустить целевой тест до правок и зафиксировать отсутствие подгрупп/поиска по названиям групп.
- [x] Изменить рендер на явный порядок. Подписи групп и подгрупп вывести семантическими заголовками; у каждого checkbox оставить прежний `data-id`, preview button и autosave. Обновить также `FPT_NAV_LABEL_OVERRIDES.needs` и заголовок/пояснение страницы на «Элементы интерфейса».
- [x] Хранить старые формулировки переименованных элементов в `legacyLabels`, включая «Шрифты и спецсимволы в лоте» для `lot_font_controls`; использовать их только в поиске, не менять текст AI payload.
- [x] Показать `lot_keyboard_btn` как дочернюю строку под `lot_font_controls`; фильтр по одной клавиатуре оставляет видимым родителя как контекстную строку. Когда родитель выключен, приглушать ребёнка и объяснять недоступность кнопки, не записывать новое значение и не блокировать переключение с клавиатуры. Пересчитывать это визуальное состояние сразу после обоих пользовательских переключений и после подтверждённого ответа ИИ.
- [x] Запустить тест, `node --check content/features/needs_tab.js`; ручная проверка поиска/предпросмотра в попапе не проведена из-за отсутствия окна Chrome/Edge в CUA (см. B2 report). Старый AI payload `{id,label,desc}` сохранён, поиск по заголовкам локальный.
- [ ] Commit `feat: render grouped interface elements` — отложен: B2 изменения смешаны с незакоммиченными правками общего `main_popup.js` и CSS; отдельный commit сделал бы состояние частичным.

### Task 3: Регрессия сохранённых выключений и визуальная проверка

**Files:**
- Modify only defects found in `content/features/feature_registry.js`, `content/features/needs_tab.js`, `css/content_styles.css`, `tests/needs_registry_taxonomy.test.js`, `tests/needs_group_render_search.test.js`
- Read: `content/features/feature_disabler.js`, `content/theme_flash_fix.js`, the navigation spec

**Interfaces:** Produces verified grouping; no new storage key.

- [x] Подготовить набор сохранённых `fpToolsDisabledFeatures` с ID из каждой из шести групп, включая `lot_notes_chat_btn`, `notes_add_status_btn`, `rmthub_seller_search`, `lot_font_controls` и `lot_keyboard_btn`. Проверить после повторного открытия, что ровно эти элементы остаются отключены и `fptApplyDisabledCss` использует прежние селекторы.
- [x] Ручной обход групп/тем/узкой панели заблокирован отсутствием окна Chrome/Edge в CUA. Автоматически проверены группы, подгруппы, поиск и очистка, preview toggle, ответ ИИ по старому ID, клавиатура и состояния родителя; визуальное прохождение не заявляется.
- [x] Запустить taxonomy tests, `node --check` изменённых JS, смежные тесты навигации и `git diff --check`. Сверить 37 ID, 37 старых пар `id → selector`, шесть счётчиков и отсутствие потерянных элементов.
- [x] Проверить итоговые изменения B2/B3 на посторонние правки и записать CUA-блокер в отчётах.
- [ ] Commit `test: verify interface element taxonomy` — не создавался: B2 production-изменения остаются в смешанном рабочем дереве, а B3 добавляет проверки поверх них.

## Execution Boundary

Этот план завершает только каталог «Элементы интерфейса». Полный выпуск требует также `docs/superpowers/plans/2026-09-24-seller-navigation-pages.md`. Начать реализацию из актуального рабочего дерева с сохранением его незакоммиченных правок; чистый worktree от `HEAD` без этих правок не подходит.
