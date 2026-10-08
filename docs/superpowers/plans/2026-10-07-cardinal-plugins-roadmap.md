# Дорожная карта: перенос идей плагинов FunPay Cardinal в FunPay Funcy

## Context

Отчёт по 24 репозиториям плагинов Cardinal выделил функции, которые стоит добавить в Funcy (MV3-расширение). Сейчас нужна **дорожная карта всех этапов**, а не реализация одной функции. Цель — встроить функции в существующий фоновый движок так, чтобы они работали **при открытом Chrome и закрытой вкладке FunPay**: переживали остановку service worker, перезапуск Chrome и сон компьютера.

**Лицензии (решение пользователя):**
- **MIT-источники можно адаптировать близко к оригиналу**, с указанием авторства. Это Sales Manager (CriDos), Steam Guard Delivery (MeccCZ), FPC-AutoSMM (W1bbex) и AutoStars (tzn6).
- **Всё остальное пишем с нуля по описанию поведения.** Это источники без лицензии, «сливы» и SMMWay AutoSync (GPL-3.0).

### Что уже есть в коде (опираемся на это)
- **Движок опроса** `background/fpt_engine.js`:
  - цикл каждые 5 с;
  - keepalive из offscreen каждые 20 с;
  - heartbeat-alarm `fpToolsEngineHeartbeat` и сторож на 90 с.
- **Автоответчик** `background/autoresponder.js`:
  - опрос `/runner/` (`chat_bookmarks`), события заказа определяются регэкспами `RX` по системным сообщениям;
  - отправка: `sendChatMessage`, `sendReplyContent`, `applyVariables`;
  - дедуп через `fpToolsAutoReplies.*`, сериализованная запись `updateAutoReplies`.
- **Известные пробелы движка:**
  - виден только последний превью-текст чата, поэтому системное сообщение о покупке можно пропустить;
  - `parseOrderPageForDelivery` (`offscreen/offscreen.js:1118`) ищет lotId хрупким селектором `a[href*="id="]`, а `nodeId` почти всегда `null`.
- **Чтение и запись лота:**
  - чтение формы: `readAutoDeliveryLotForm` / `parseLotEditPage` (`offscreen.js:228`);
  - сохранение: `saveSingleLot` (`background/background.js:1780`, слияние полной формы с патчем и `lots/offerSave`).
- **Автовыключение и включение лотов** (`content/features/auto_restore_lots.js`) работает только при открытой вкладке, потому что переключение идёт из content script.
- **Образцы для хранилищ:**
  - IndexedDB: `background/sales_db.js` (`fpt-sales-db`);
  - фабрика с внедряемыми зависимостями для тестов: `createAutoReplyStore` в `background/auto_reply_store.js`;
  - настройки лотов автовыдачи: `background/auto_delivery_store.js` (`fpToolsAutoDeliveryLots`).
- **UI:** страницы по образцу `content/ui/blacklist_page.js`, чек-лист из 9 шагов (main_popup, popup_metadata, popup_actions Set, content_script mount, порядок в manifest, CSS-контейнер, тесты навигации).
- **Тесты:** `node --test tests/`, `node:test` + `vm`, браузерные — Playwright (`*_browser.test.js`).

---

## Сквозные принципы (для всех этапов)
1. **Журнал до действия.** Любая внешняя операция (сообщение с товаром, заказ у поставщика, смена цены) сначала записывается в IndexedDB в состоянии `pending`/`sending`, потом выполняется. После неясного результата ставится статус `uncertain` без автоповтора.
2. **Восстановление.** На `onStartup`, `onInstalled` и heartbeat выполняется проход по журналу:
   - `sending` превращается в `uncertain` с последующей проверкой (например, через историю чата);
   - `pending` продолжается.
3. **Код только локальный.** Никакой загрузки модулей из GitHub, никакой телеметрии и регистрации установок, никаких внешних allowlist'ов. Telegram-интерфейсы не переносим: интеграции выведены, см. `background/retired_integrations.js`.
4. **Секреты** (shared_secret, API-ключи поставщиков, мнемоники):
   - лежат в отдельном ключе `fpToolsSecrets`;
   - добавлены в `EXCLUDE_KEYS` в `content/features/settings_io.js`;
   - в UI маскируются.
5. **Доступ к поставщикам.** В `manifest.json` добавляется `optional_host_permissions: ["https://*/*"]`. Конкретный origin запрашивается через `chrome.permissions.request` при настройке адаптера, без новых обязательных прав.
6. **Деньги** считаются целыми числами в минимальных единицах (копейки), с явным режимом округления.
7. **Авторство.** Новый `THIRD_PARTY_NOTICES.md` с MIT-уведомлениями четырёх источников. В адаптированных файлах — заголовочный комментарий со ссылкой на источник и коммит.
8. **Тестируемость.** Каждый новый фоновый модуль — ESM-фабрика с внедряемыми `storage`/`fetch`/`now`/`db`, как `createAutoReplyStore`. Чистая логика (расписание, расчёт цены, TOTP, автомат состояний) — отдельные чистые функции.

---

## Этап 0 — Фундамент (обязателен для этапов 1–4)

> **Статус (2026-10-07):** 0.1–0.5 реализованы — `background/ops_db.js`, `order_details.js`,
> `lot_writer.js`, `lot_availability.js`, `job_scheduler.js`, новый `parseOrderPageForDelivery`,
> журнал выдачи и сверка `/orders/trade` в `autoresponder.js`. Тесты: `ops_journal`, `lot_writer`,
> `order_details`, `order_page_parser_browser`, `auto_delivery_stock`.
> 0.6 (каркас UI) перенесён в 1.1 — секция появится вместе с первой страницей.
> Фикстура `tests/fixtures/order_page_paid.html` синтетическая — заменить реальной страницей заказа.

**0.1 Надёжный разбор заказа.** Переписать `parseOrderPageForDelivery`:
- lotId — из ссылки `lots/offer?id=` внутри блока заказа;
- nodeId — из ссылки категории `/lots/{node}/`;
- добавить `amount` (количество), `status`, `buyerId`.

Сохранить реальный HTML страницы заказа как фикстуру в `tests/fixtures/` и покрыть парсер тестом. Заодно это починит обновление остатков после выдачи (`refreshAutoDeliveryLotStock`).

**0.2 Журнал операций** — `background/ops_db.js`, IndexedDB `fpt-ops-db`.

| Хранилище | Содержимое |
|---|---|
| `orders` | key `orderId`: buyer, chatId, lotId, nodeId, amount, purchasedAt, fpStatus, featureState |
| `ops` | журнал попыток: id, orderId, kind, state, idempotencyKey, attempts, lastError, timestamps |
| `stock` | для этапа 2 |
| `meta` | служебные значения |

API строится на фабрике с бэкендом-адаптером: реальный IDB или in-memory для node-тестов.

**0.3 Захват заказов без пропусков.**
- На `ORDER_PURCHASED` в автоответчике вызывать `journal.recordOrder`.
- Плюс alarm `fpToolsOrderReconcile` (раз в 5 мин): разбирает `/orders/trade` (переиспользовать парсер продаж из offscreen), находит оплаченные заказы, которых нет в журнале, и запускает для них те же обработчики.

**0.4 Фоновый редактор лотов** — `background/lot_writer.js`.
- `patchLot(offerId, mutate, {expect})`:
  - читает форму;
  - проверяет `expect` (цена, active, отпечаток полей) и отменяет запись при расхождении;
  - сохраняет через `offerSave`;
  - перечитывает лот и проверяет результат.
- Перевести `saveSingleLot` на этот модуль.
- Перенести переключение `active` из `auto_restore_lots.js` в фон, чтобы оно работало при закрытой вкладке. Content-скрипт оставить только как UI.

**0.5 Планировщик заданий** — `background/job_scheduler.js`.
- Именованные alarms с `when` = ближайшее событие плюс проход восстановления (принцип 2).
- Подключается к `setupInitialAlarms()` и обработчику `chrome.alarms.onAlarm` в `background.js`.

**0.6 Каркас UI.**
- Новая секция навигации «Автоматизация» в `FPT_NAV_SECTIONS`.
- Страницы: `lot_schedule`, `steam_guard`, позже `stock`, `suppliers`, `pricing`.
- Каждая страница — по чек-листу из 9 шагов, общие компоненты `FPTPopupUI`.

---

## Этап 1 — Быстрые функции

**1.1 Расписание лотов** (идея TradeManager, пишем с нуля).
- Данные: `fpToolsLotSchedules = {[offerId]: {enabled, tz, rules:[{days:[1..7], from:'HH:MM', to:'HH:MM'}], exceptions:[{from, to, state:'on'|'off'}]}}`.
- Чистая функция `desiredState(schedule, date)`:
  - интервалы через полночь относятся к дню начала;
  - часовой пояс считается через `Intl.DateTimeFormat`;
  - исключения важнее правил.
- `nextTransition(schedule, date)` ставит alarm на ближайшую смену. При срабатывании идёт сверка «нужно/фактически» через `lot_writer`, без слепого переключения.
- Приоритет над автовыключением: «нет товара» выключает всегда, расписание включает только при наличии товара.
- Тесты:
  - полночь, смена дня недели, часовой пояс;
  - переход на летнее время (на случай поясов с DST);
  - исключение поверх правила.

**1.2 Ответы по лоту** (идея AutoRecognizeLot, пишем с нуля, с исправлением бага).
- Определять лот, который смотрит покупатель, со страницы чата: ссылка «покупатель смотрит лот», аналог `looking_link` в FunPayAPI. Новый парсер — offscreen `parseChatLookingLot`, проверка на фикстуре.
- **При неудаче возвращать `null`, а не ID чата.**
- Данные в `fpToolsAutoReplies`: `lotRepliesEnabled`, `lotReplies:[{offerIds[], text, images[], sendOrder}]`, `lotReplyFallback`, `lotReplyCooldownHours`; рабочее поле `lotReplyCooldowns["chatId:offerId"]`, добавить в `AUTO_REPLY_RUNTIME_FIELDS`.
- Встраивание в ветку приветствия `handleGreeting`: если лот распознан и есть правило, отправляется ответ по лоту. Режим «вместо приветствия» или «после него» — настройка.
- UI: новая карточка на `content/ui/auto_reply_page.js`.

**1.3 Steam Guard** (MeccCZ, MIT — адаптация).
- `background/steam_guard.js`:
  - `generateSteamCode(sharedSecretB64, unixSec)` на `crypto.subtle` (HMAC-SHA1, шаг 30 с, алфавит `23456789BCDFGHJKMNPQRTVWXY`);
  - `secondsLeft()`.
- Аккаунты: `{id, label}` в настройках, `shared_secret` — в `fpToolsSecrets`.
- Привязки: `{offerId → accountId, accessHours, maxCodes}`.
- Поток:
  1. Покупатель пишет команду (настраиваемую, по умолчанию `!код`).
  2. Ищем в журнале заказ этого покупателя и чата на привязанный лот. Заказ должен быть в пределах `accessHours`, без возврата и не исчерпать лимит кодов.
  3. Отправляем код и оставшееся время. Если до смены кода меньше 5 с, ждём следующий.
- Каждую выдачу пишем в `ops`.
- Тесты: эталонные векторы (секрет + время → код) и отказ для чужого или просроченного заказа.

---

## Этап 2 — Склад и надёжная выдача (Sales Manager, MIT — адаптация)
- **Склад в `fpt-ops-db.stock`:**
  - запись: `{id, poolId, value, state: available|reserved|delivered, orderId}`;
  - пулы привязаны к лотам;
  - новый режим `mode:'stock'` в `fpToolsAutoDeliveryLots`.
- **Состояния заказа:** `new → reserved → sending → delivered | uncertain | failed`.
  - `failed` возвращает товар в `available`.
  - Резервирование `amount` единиц — одна readwrite-транзакция IDB (два заказа на последний товар разводятся транзакцией). Ключ идемпотентности — orderId.
- **Неясный результат.** Сообщение ушло, но запись не сохранилась, или таймаут — ставится `uncertain`. Автопроверка читает историю чата и ищет маркер `⁡` и товар. Если не найдено, нужно ручное решение в UI.
- **Остаток пула** обновляет `productCount` и тем самым автовыключение (0.4).
- **UI — страница `stock`:**
  - пулы и импорт строк;
  - счётчики;
  - журнал выдач с фильтром `uncertain` и кнопками «выдано» / «вернуть на склад».

---

## Этап 3 — SMM и цены
**3.1 SMM-адаптер** (W1bbex, MIT — адаптация; идеи klaymov и ThisTakou пишем с нуля).
- Стандартный API панелей v2: `services`, `add`, `status`, `multiple status`, `refill`, `cancel`.
- Конфигурация:
  - поставщики `{id, url}`, ключ — в `fpToolsSecrets`;
  - привязка лота `{offerId → providerId, serviceId, qtyPerUnit, linkSource}`.
- Поток:
  1. Заказ переходит в `awaiting_link`: ссылка берётся из полей заказа или запрашивается в чате.
  2. Ссылка проверяется регэкспом по типу услуги.
  3. Заказ переходит в `submitting`. Запись сохраняется до `add`; при таймауте ставится `uncertain`, потому что у панелей нет ключа идемпотентности.
  4. Пакетный опрос статусов alarm'ом раз в 5 мин.
  5. `completed`: сообщение покупателю. `partial`/`canceled`: уведомление продавцу.
- Телеметрию оригинала не переносим.

**3.2 Пересчёт цен по тарифам поставщика** (поведение AutoSync, пишем с нуля — GPL).
- Формула: `price = round_up_to_step((rate × qtyPerUnit / 1000) × (1 + markup%) + fixed)`.
- Порог изменения в %.
- Экран предпросмотра «было → станет».
- Применение через `lot_writer` с `expect={price: увиденная при предпросмотре}`. Лот, изменённый вручную, пропускается.

**3.3 Демпинг конкурентов** (поведение PriceDumper, пишем с нуля, с исправлениями).
- Список предложений берётся со страницы категории.
- **Свои предложения исключаются** (по userId).
- Цель = минимальная цена конкурента − шаг, ограниченная коридором `[floor, ceiling]`.
- **Цена повышается только при явном `allowRaise`.**
- Сначала режим «только показать», минимальный интервал прохода, запись через `expect`.
- Включается только после 3.2.

---

## Этап 4 — HTTP-поставщики: NS.Gifts, Robux (пишем с нуля)
- Общий интерфейс `supplier_adapter`: `createOrder(customId, …)`, `getStatus(customId)`.
- **`customId = fpt-{orderId}-{n}` генерируется и сохраняется в `ops` до первого запроса.**
- При восстановлении сначала вызывается `getStatus(customId)`, и только если заказа у поставщика нет — повтор `createOrder`.
- Адаптеры: `ns_gifts`, затем Robux.
- Steam Points (harrrdie) не берём из-за внешнего списка разрешённых пользователей.

## Этап 5 — Исследование, отдельные решения (не планируем к реализации сейчас)
- **Telegram Stars (tzn6, MIT).** Нужна локально поставляемая TON-библиотека и мнемоника в хранилище — высокий риск. Взять подход: попытка записывается до отправки, восстановление по хешу, блок повторной оплаты при неясном результате. Решение — после этапа 4.
- **Аренда Steam-аккаунтов.** Сценарий с Playwright в расширении невозможен; рассматривать только через API поставщика (как MUVSellRent, но запись «обработано» — после операции).
- **GPT-консультант.** Оценить переиспользование существующего `background/ai.js` вместо внешнего кода.

---

## Файлы (ключевые)
- **Новые:**
  - `background/ops_db.js`, `background/lot_writer.js`, `background/job_scheduler.js`;
  - `background/lot_schedule.js`, `background/steam_guard.js`, `background/stock.js`;
  - `background/suppliers/{smm_panel,ns_gifts}.js`, `background/pricing.js`;
  - `content/ui/{lot_schedule,steam_guard,stock,suppliers,pricing}_page.js`;
  - `THIRD_PARTY_NOTICES.md`.
- **Изменяемые:**
  - `background/background.js` (alarms, роутер сообщений, восстановление);
  - `background/autoresponder.js` (журнал, ответы по лоту, команда Steam Guard, режим `stock`);
  - `offscreen/offscreen.js` (парсеры заказа, чата, категории);
  - `background/auto_delivery_store.js`;
  - `content/features/auto_restore_lots.js`, `content/features/settings_io.js`;
  - `content/ui/main_popup.js`, `popup_metadata.js`, `popup_actions.js`, `content/content_script.js`;
  - `manifest.json`, `css/popup_categories.css`.

## Порядок выполнения
1. Перед стартом закоммитить текущие незакоммиченные изменения (удаление Telegram/Discord, страницы blacklist и sounds), чтобы этапы шли отдельными коммитами.
2. Сохранить эту карту в `docs/superpowers/plans/2026-10-07-cardinal-plugins-roadmap.md`.
3. Для каждого этапа писать отдельный детальный план в том же формате, затем реализовывать. Порядок: 0 → 1.1 → 1.2 → 1.3 → 2 → 3.1 → 3.2 → 3.3 → 4.

## Проверка
- **Модульные тесты:** `node --test tests/` после каждого этапа. Новые тесты:
  - парсеры на фикстурах;
  - `desiredState`/`nextTransition`;
  - векторы Steam Guard;
  - автомат состояний выдачи на in-memory бэкенде (повтор события, два заказа на последний товар, `sending` после рестарта);
  - `lot_writer` с `expect` (ручная правка между чтением и записью);
  - расчёт цены, исключение своих предложений, запрет повышения.
- **Браузерные:**
  - Playwright-тесты новых страниц по образцу `tests/blacklist_browser.test.js`;
  - реальный IndexedDB в странице для теста конкурентного резервирования.
- **Вручную на живом FunPay:**
  - закрытая вкладка FunPay;
  - остановка service worker в `chrome://serviceworker-internals`;
  - перезапуск Chrome;
  - сон ноутбука во время окна расписания;
  - тестовый заказ на дешёвый лот: выдача, повтор, `uncertain`;
  - Steam Guard: граница смены кода и просроченный доступ.
