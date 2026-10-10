# Выборочный откат ленивой загрузки меню

Выполнен 10.10.2026 в ветке `codex/performance-optimization`. Файлы JavaScript и CSS меню снова подключаются через manifest при загрузке страницы. Большой DOM меню по-прежнему собирается при первом открытии.

## Изменения

- Восстановлены файлы меню, theme_gallery и CSS в прежнем относительном порядке. Исходные записи manifest, включая settings_io_page и safe_values, сохранены.
- Палитра возвращена в main_popup.js, CSS восстановлен целиком по снимку до фазы 3. Это сохраняет пользовательские правила, включая анимации переноса настроек, без повторного объединения селекторов.
- Удалены протокол загрузчика, обработчик background и девять созданных для него файлов: шесть ресурсов реализации, вспомогательный тестовый harness и два набора тестов инъекции. Заменены тремя актуальными проверками обычной загрузки.
- Убраны разрешение scripting и minimum_chrome_version 106. Поиск по текущим content/background/tests/manifest не обнаружил оставшихся обращений к загрузчику.
- Сборка и монтаж разделов возвращены к состоянию до фазы 3. Сохранён guard открытия в обработчике кнопки: повторные клики во время ожидающего открытия игнорируются; finally освобождает guard. Ошибки открытия журналируются без состояний и уведомлений загрузчика.
- Сохранены оптимизации фаз 1–2, автоматическое обновление данных разделов, фоновые движки и форматы настроек. Реальные сообщения, выдача товаров, поднятие и редактирование лотов не выполнялись.

## Эталон и сохранность

Перед изменениями создан `scratchpad/perf-optimization/baseline/pre-lazy-rollback`: 400 файлов, SHA-256, HEAD, ветка, status, рабочий и индексный binary diff, список untracked. Все 398 файлов предыдущего снимка final совпали; два добавления — документы планов.

Эталон — `baseline/phase-3/files`. Из 41 восстановленного файла 39 совпадают с ним побайтно. Два осознанных исключения: guard и журналирование ошибок в content_script.js; удаление уже присутствовавшего в эталоне forward-compatible блока eager-инъекции из perf_browser_harness.js. В untracked каталоге классификации удалено только имя устаревшего сообщения fptLoadPopupBundle; запись URL-события фазы 2 сохранена.

Из 400 исходных файлов 349 не изменились побайтно; 51 изменение ограничено областью отката (41 восстановление, 9 удалений и каталог классификации). Посторонних изменений нет. Исходный untracked settings_io_page.js, все четыре файла фиксов 875afdc и исторический отчёт performance-optimization-results.md сохранены побайтно. Исторические снимки, скриншоты и trace сохранены.

Изолированное дерево коммита сформировано из исходного дерева fc46a9d с обратными изменениями только этого коммита. Сравнение подготовленного дерева с fc46a9d^ допускает ровно пять исключений: content_script.js, perf_browser_harness.js, новые тест и отчёт, сохранённый исторический отчёт. Пользовательские изменения внутри перемещённых файлов не включаются в коммит; исходный untracked settings_io_page.js также остаётся вне него.

## Проверки

Полный набор tests/*.test.js: **454 теста, 434 прошли, 20 исходных падений, новых падений нет; пропусков и отмен нет**. Node 24, Playwright, Google Chrome, параллельность 2. Имена и диагностические признаки всех 20 ошибок сопоставлены с baseline/initial/tests.log; таблица ниже. Протокольные тесты удалены, skip не добавлялся.

Три новые проверки прошли: существование manifest-ресурсов и отсутствие повторов/лишнего разрешения; серии 1/2/5 кликов, одна сборка 15 разделов, закрытие/повторное открытие/шаблоны; ранняя сохранённая тема, палитра окна и enhanced select до открытия. Синтаксис изменённых JS проверен; background также исполнялся в настоящем расширении.

В полном прогоне прошли проверки сохранённых оптимизаций: отсутствие ресурсов выключенного курсора, скрытое содержимое закрытого меню, общий таймер заказов, кеш и гонка storage, видимость вложений, накопление MutationRecord, перенос работы при смене видимости и общий URL-источник. Существующие проверки узких viewport включены в полный прогон. Сценарии применения настроек без перезагрузки входят в существующие браузерные тесты темы, эффектов, звука и интерфейса.

Сняты все 15 разделов в светлой и тёмной теме и две страницы до открытия: 32 изображения. 28 совпали с исходным эталоном пиксель в пиксель; на двух экранах темы различаются только 3 и 17 пикселей на единицу RGB. Таким образом, 30 изображений совпадают при RGB-допуске 4. Два экрана автовыдачи отличаются 242 пикселями (0,0255%) только в текущем времени проверки остатков. Визуально проверены обе версии этого экрана; расположение и оформление совпадают. Ошибок исполнения в capture-фикстурах нет.

Проверено настоящее распакованное расширение в отдельных свежих профилях Chromium 153.0.8010.12 из chromium-1243 на подставленной HTTPS-странице чата. До первого клика доступны createMainPopup, тема, шаблоны, звук, окна и enhanced select; DOM меню отсутствует. Проверены 1/2/5 кликов, 15 разделов, переходы, закрытие/повторное открытие и переход из настроек шаблонов; одно меню, палитра окна сохраняется, исключений isolated world нет. По три прогона до и после отката. HTTPS-запросы подставлены, это не live-проверка аккаунта.

## Сравнение открытия и простоя

Одинаковые фикстура, данные, viewport 1204 × 789, браузер и сценарии; отдельные свежие профили до/после, три последовательных документа в каждом. Замеры повторены после окончания полного набора тестов и capture. Первый прогон с параллельным набором тестов сохранён отдельно и в таблицу не включён. Performance trace не записывался; использованы CDP-метрики. В таблице медиана и диапазон трёх значений.

| Метрика | С ленивой загрузкой | После отката |
|---|---:|---:|
| Первое открытие, мс | 900.2 (886.0–901.7) | 439.4 (424.8–456.5) |
| Повторное открытие, мс | 127.4 (119.7–168.1) | 141.7 (132.6–158.7) |
| Scripting за 10 с простоя страницы, мс | 10.5 (9.0–10.8) | 11.4 (8.7–11.4) |
| Scripting за 10 с закрытого меню эффектов, мс | 1.7 (1.2–3.4) | 1.7 (1.5–1.7) |
| Style recalculation за 10 с закрытого меню, число | 7.0 (6.0–9.0) | 7.0 (7.0–7.0) |
| Layout за 10 с закрытого меню, число | 0.0 (0.0–1.0) | 0.0 (0.0–0.0) |

Замеры описывают эту локальную фикстуру. Они не гарантируют ускорение живого FunPay и не проверяют реальные автоматизации.

## Исходные падения

| Проверка | Диагностический признак до и после | Сопоставление |
|---|---|---|
| auto-delivery page loads stock states, saves per-lot changes, and fits the full popup | Показаны сохранённые настройки. Обновите список, чтобы проверить остатки. | Совпадает |
| finance hub renders every tab with seeded data and responds to filters | 9 !== 6 | Совпадает |
| finance notifications preserve layout and the tab pill tracks responsive tabs | locator('.fpt-finance') resolved to 2 elements | Совпадает |
| finance_hub: styles are scoped, responsive and themed through the popup tokens | toasts render on the active page, including finance | Совпадает |
| schedule dialog saves a draft rule with the saved zone and shows a preview | openScheduleDialog is not a function | Совпадает |
| pricing dialog previews selected lots and applies only checked rows | openPricingDialog is not a function | Совпадает |
| bulk editor guides lot selection, changes, and review with live validation | 1. Выберите лоты | Совпадает |
| bulk editor selects by category, previews Cyrillic whole-word replacement and offers a retry for failed lots | fpt-bulk-category-chip | Совпадает |
| order facts parser returns raw page facts without decisions | null !== 2 | Совпадает |
| actions persist only explicit settings and never read deleted controls | Unknown popup action: general:saveSettings | Совпадает |
| opening data actions never writes settings and invalid actions reject | Unknown popup action: general:getSettings | Совпадает |
| real browser: lot management screen, navigation and shell geometry | 15 !== 17 | Совпадает |
| gallery button IDs load data, cycle and apply without mounting a card | bgImage | Совпадает |
| popup creation leaves every category empty, retains navigation, and omits the close control | 15 !== 16 | Совпадает |
| reminder block: variable chips, preview, lot picker, manual send and no overflow | fpt-qr-bubble | Совпадает |
| tab-like controls use consistent hover and selected-state motion across popup sections | .fpt-fin-tab transitions its visual state | Совпадает |
| general: settings_page_recomposition markup is removed and search metadata remains | data-page="general" | Совпадает |
| tests/t18_navigation_ia.test.js | 15 !== 16 | Совпадает |
| real browser: the site theme does not leak into the popup and turns it dark | false !== true | Совпадает |
| general: ui_foundation_contract markup is removed and search metadata remains | data-page="general" | Совпадает |

## Артефакты

- `baseline/pre-lazy-rollback`: резервная копия перед откатом.
- `rollback-full-tests.log`, `rollback-eager-tests.log`, `baseline/post-lazy-rollback/test-audit.json`: полный прогон, новые проверки и сопоставление причин.
- `baseline/post-lazy-rollback/preservation.json`: SHA-256-проверка области изменений.
- `baseline/post-lazy-rollback/all-pages`: скриншоты, результаты и сравнение.
- `baseline/post-lazy-rollback/native-comparison.json`, `rollback-native-controlled.log`: проверка расширения и окончательные замеры.
- `native-comparison-with-suite.json`: первый прогон при параллельных тестах, сохранён только как дополнительное свидетельство функциональности.
- `rollback-staging/rollback.patch`: точный patch отдельного коммита без пользовательских изменений.
