# Остатки и доступность товаров — архитектурное решение

Дата: 2026-10-08. Анализ текущего незакоммиченного дерева; runtime не изменялся. Применимых AGENTS.md в рабочем каталоге и его родителях не найдено. Прочитаны исследование поставщиков и дорожная карта Cardinal. Ниже предложения, а не уже реализованные гарантии.

## Что есть сейчас

**Локального склада пока нет.** [ops_db.js:22](C:/Users/Usser/Desktop/funpay-funcy/background/ops_db.js:22) создаёт пустой `stock` с ключом `id`, индексом `poolId` и универсальными операциями. [createIndexedDbBackend:119](C:/Users/Usser/Desktop/funpay-funcy/background/ops_db.js:119) открывает транзакцию одного store; `update:157` атомарен для одной записи. API резервирования нескольких единиц вместе с заказом/операцией отсутствует. Очередь [createAutoDeliveryStore:18](C:/Users/Usser/Desktop/funpay-funcy/background/auto_delivery_store.js:18) сериализует запись настроек внутри экземпляра, не является складской транзакцией.

Текущий `productCount` — **снимок удалённого склада FunPay**. [syncLots:80](C:/Users/Usser/Desktop/funpay-funcy/background/auto_delivery_store.js:80) читает форму лота и считает непустые строки `secrets`; фон подключает [readAutoDeliveryLotForm:834](C:/Users/Usser/Desktop/funpay-funcy/background/background.js:834). При ошибке старое число сохраняется без времени наблюдения/TTL; шаблон имеет `null`. [initializeAutoDeliveryManager:3](C:/Users/Usser/Desktop/funpay-funcy/content/features/auto_delivery.js:3) редактирует textarea FunPay; `applyItems:136` меняет `secrets` и `amount`, требуя отдельно сохранить лот. Это редактор удалённых товаров.

[handleAutoDelivery:613](C:/Users/Usser/Desktop/funpay-funcy/background/autoresponder.js:613) пересылает `secrets` со страницы **заказа**, либо шаблон; `amount` записывает, но локальные единицы не выбирает. [beginDeliveryOp:592](C:/Users/Usser/Desktop/funpay-funcy/background/autoresponder.js:592) защищает от повторного события, восстановление [recoverInterruptedOps:266](C:/Users/Usser/Desktop/funpay-funcy/background/ops_db.js:266) переводит чужое `sending` в `uncertain`. Отсутствующий журнал допускает отправку — для новых складских режимов это недопустимо.

**Фоновое восстановление реально перенесено.** [background.js:926](C:/Users/Usser/Desktop/funpay-funcy/background/background.js:926) подключает sweep к alarm; [auto_restore_alarm.js:8](C:/Users/Usser/Desktop/funpay-funcy/background/auto_restore_alarm.js:8) задаёт пять минут. [auto_restore_lots.js:12](C:/Users/Usser/Desktop/funpay-funcy/content/features/auto_restore_lots.js:12) только уведомляет. Но [decideLotAvailability:18](C:/Users/Usser/Desktop/funpay-funcy/background/lot_availability.js:18) использует сохранённый `productCount`: ноль выключает, положительное включает любой неактивный лот. Неизвестный остаток пропускается; `enabled:false`, свежесть, ручное выключение, расписание и бюджет не проверяются. [sweepOnce:30](C:/Users/Usser/Desktop/funpay-funcy/background/lot_availability.js:30) перечитывает форму, **не пересчитывает её остаток**, использует конфигурацию начала прохода.

## Разделение состояния

Нужны независимые сущности:

| Сущность | Смысл и владелец |
|---|---|
| `LocalPool` | Принадлежащие продавцу единицы: available, reserved, delivered, quarantined; authoritative IDB |
| `FunPayStockSnapshot` | Наблюдаемые строки удалённого склада; резервирует сама площадка, расширение не списывает их повторно |
| `SupplierSnapshot` | Предложение магазина; наличие в каталоге не резерв и не собственный актив |
| `LotPolicy/Decision` | Намерение продавца, ограничения и рассчитанное право продажи |

Привязка лота имеет ровно один источник исполнения: `funpay_secrets|template|local_pool|supplier`, `unitsPerSale`, ревизию сопоставления. Смешанный fallback добавлять позднее явно, с доказанной эквивалентностью. Два лота одного пула разделяют остаток; финансы не суммируют один пул дважды.

Все сущности продавца адресуются `[funpayAccountId, entityId]`, заказ — `[funpayAccountId, orderId]`, операции — `[accountId, orderId, kind, attempt]`. Сейчас [orders:23](C:/Users/Usser/Desktop/funpay-funcy/background/ops_db.js:23), `delivery:orderId`, настройки и кэши не имеют account scope. Нельзя присвоить старые данные текущему аккаунту молча: нужна явная миграция/карантин. Перед внешним действием повторно сверять активную сессию. Общий кошелёк поставщика резервируется по `[providerAccountId,currency]` даже для нескольких аккаунтов FunPay.

## Резерв и неизвестная выдача

До резерва нужен строгий `OrderSnapshot`: подтверждённый продавец, `paid`, покупатель/чат, однозначная привязка и положительное безопасное целое quantity. [order_details.js:57](C:/Users/Usser/Desktop/funpay-funcy/background/order_details.js:57) подставляет `1` вместо неизвестного количества; [parser:1148](C:/Users/Usser/Desktop/funpay-funcy/offscreen/offscreen.js:1148) ищет offer-ссылку по всей странице; [verifyIAmSeller:445](C:/Users/Usser/Desktop/funpay-funcy/background/autoresponder.js:445) пропускает ошибки. Эти правила нельзя наследовать для списания товаров.

`reserve(accountId,poolId,orderSnapshot)` в одной readwrite-транзакции проверяет существующую резервацию, выбирает **все** `quantity × unitsPerSale` доступных единиц по FIFO партии и записывает stock, reservation и pending-op. При нехватке откатывается всё; повтор возвращает те же ID, несовпадающий fingerprint заказа блокируется. Для закупки аналогично атомарны применимые бюджетные лимиты/резерв/попытка: два `beginOp` не защищают общий остаток денег. Внешний кошелёк всё равно может измениться вне расширения. Сеть выполняется после commit. Такие атомарные изменения нескольких записей поддерживаются [IndexedDB, §2.7](https://www.w3.org/TR/IndexedDB/#transaction-concept); текущий backend необходимо расширить и одинаково моделировать в memory-тестах.

Переходы исполнения: `reserved → sending → delivered|uncertain`; достоверный отказ до раскрытия товара допускает release, остальные случаи удерживают резерв/карантин. Таймаут, рестарт, частичная выдача и ошибка записи результата не освобождают товары по TTL. Возврат денег покупателю также не делает раскрытый код пригодным для повторной продажи. Нужны отдельные подтверждения отсутствия отправки/отзыва кода и журнал ручного решения.

Хранить идентификаторы частей, подтверждения сообщений и снимок выделенных единиц. Общий BOT_MARKER не доказывает выдачу конкретному заказу; отсутствие сообщения в доступной истории тоже не доказывает неотправку. Дополнительный риск: [sendChatMessage:150](C:/Users/Usser/Desktop/funpay-funcy/background/autoresponder.js:150) применяет `fetchWithRetry:25` к POST, повторяя неоднозначный запрос; `json:null` считается успехом. Для записи требуется отдельная политика без слепого retry и строгая проверка квитанции. [reconcile:785](C:/Users/Usser/Desktop/funpay-funcy/background/autoresponder.js:785) пропускает уже известные заказы независимо от незавершённого исполнения; восстановление должно идти по состоянию операции. Удаление старых `done` в [prune:287](C:/Users/Usser/Desktop/funpay-funcy/background/ops_db.js:287) не должно уничтожать tombstone выделения/покупки и позволять повторную выдачу.

## Кто вправе включать лот

**Только общий resolver**, вызывающий `lot_writer`; склад, расписание, бюджет и pricing публикуют факты/запреты. Контракт:

`LotPolicy {accountId,offerId,revision,manageActive,manualIntent:auto|on|off,sourceBinding,scheduleId}`;
`Decision {revision,desiredActive,blockers[],sourceRevision,evaluatedAt,validUntil,lastConfirmedWrite}`.

`manualIntent=off` — безусловный запрет. `on` выражает желание продавать, но не отменяет отсутствие товара, закрытое расписание, лимит расходов, недостаточный свободный бюджет, неизвестную конвертацию или недопустимую цену. Разрешение — логическое AND всех применимых условий; отсутствующий модуль нейтрален только если не требуется выбранным источником. Включение требует `manageActive` и свежих доказательств. Локальный остаток учитывает уже зарезервированное; supplier-проверка бюджета не заменяет атомарный резерв на конкретный заказ.

При подключении неактивный лот считается выключенным продавцом до явного согласия на управление. Автовосстановление допустимо после подтверждённого выключения самим resolver и снятия **всех** причин. Расхождение фактической активности с последней подтверждённой записью ставит external/manual hold. Булевый `active` не позволяет определить повторное ручное выключение уже выключенного лота: для надёжного запрета нужна отдельная сохранённая кнопка «Не включать автоматически» и, где доступно, фиксация ручного submit.

[patchLot:72](C:/Users/Usser/Desktop/funpay-funcy/background/lot_writer.js:72) проверяет `expect` перед сохранением и перечитывает результат, но не сериализует писателей и не предотвращает внешнюю правку после чтения. Нужны общая очередь `[account,offer]` для цены/активности, повторная проверка revision/сессии/сроков перед отправкой, durable intent и сверка неопределённого save. `expect` не является серверным compare-and-swap. Полную защиту от одновременного редактирования FunPay обещать нельзя.

## Свежесть, секреты и себестоимость

Snapshot хранит `sourceKind,kind:finite|unbounded|unknown|unsupported,quantity,observedAt,validUntil,error`, для supplier также provider/account/SKU/variant, валюту, quote и mapping revision. Ошибка не превращается в ноль; отсутствие API количества не означает бесконечность. Старое число показывается с возрастом, но не разрешает новое автоматическое включение. Для supplier без inventory API нужен явный режим «наличие проверяется при закупке» с ограниченным опубликованным объёмом; quote/balance всё равно проверяются. Состояние already-active при просрочке задаётся политикой риска: безопасный default для автозакупки — приостановить новые продажи через resolver.

Поллинг общий по providerAccount/SKU, пакетный где API разрешает, с дедупликацией, квотой запросов, jitter, backoff и `Retry-After`; приоритет имеют принятые заказы. Сохранять `nextPollAt`, восстанавливаться после сна без лавины запросов. Точные лимиты задаёт контракт адаптера. Текущие три параллельных чтения FunPay и пятиминутный alarm не являются универсальными квотами поставщиков.

Значения stock — секреты. Хранить их в extension-origin IDB под фоновым сервисом; UI получает redacted DTO, раскрытие — отдельная операция, без секретов в логах/кэше/обычном экспорте. [EXCLUDE_KEYS:34](C:/Users/Usser/Desktop/funpay-funcy/content/features/settings_io.js:34) исключает `fpToolsSecrets` из экспорта, но [getSettings:68](C:/Users/Usser/Desktop/funpay-funcy/content/ui/popup_actions.js:68) допускает чтение всех local-настроек. Chrome [по умолчанию открывает storage.local content scripts](https://developer.chrome.com/docs/extensions/reference/api/storage#property-local), тогда как [IDB принадлежит origin расширения](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies). Это граница доступа, не шифрование от владельца компьютера.

Партия хранит неизменяемые quantity, закупочный total, валюту, комиссии/конвертацию и происхождение. Деньги — decimal-string с валютой и явно заданной точностью назначения. Распределение стоимости по единицам детерминировано, сумма allocations равна total; корректировки отдельными событиями. [createSnapshot:258](C:/Users/Usser/Desktop/funpay-funcy/content/features/cost_basis_store.js:258) копирует оценку одного лота без quantity, [profit_engine:149](C:/Users/Usser/Desktop/funpay-funcy/content/features/profit_engine.js:149) вычитает её из выручки заказа. Это требует quantity-aware order total: фактический cost ledger добавляется отдельно, исторические snapshots не перезаписываются текущей ценой партии/поставщика. [finance_potential:178](C:/Users/Usser/Desktop/funpay-funcy/content/features/finance_potential.js:178) читает публичный `.tc-amount`, [finance_stock:2](C:/Users/Usser/Desktop/funpay-funcy/content/features/finance_stock.js:2) только агрегирует; добавить отдельную оценку принадлежащих товаров, включая inactive/reserved, не считать каталог поставщика активом.

## Интерфейс и этапы

Расширять существующую `auto_delivery`: [createLotDraft:209](C:/Users/Usser/Desktop/funpay-funcy/content/ui/auto_delivery_page.js:209), источник строки, [правила:544](C:/Users/Usser/Desktop/funpay-funcy/content/ui/auto_delivery_page.js:544), вкладку «Проблемы» и загрузчик [auto_delivery_ui:47](C:/Users/Usser/Desktop/funpay-funcy/content/features/auto_delivery_ui.js:47). Добавить источник/возраст, «свободно/резерв/карантин», причины выключения, manual hold; внутри раздела — пулы, партии и очередь uncertain. Отдельная дублирующая stock-страница из старого плана сейчас не нужна. Менеджер FunPay сохранить с явной подписью удалённого склада; финансы расширять существующими вкладками.

Порядок: (1) строгий заказ, account migration, транзакции и resolver в preview; (2) один local_pool с резервом и ручным восстановлением; (3) защищённая выдача/part receipts и связь себестоимости; (4) supplier snapshots, бюджет и разрешённые изменения активности. Опасные старые советы: «failed всегда возвращает товар», «productCount объединяет все остатки», «расписание включает при наличии», «нет по reference — повторить» без доказанного исхода и «сначала закоммитить пользовательские изменения».

Проверка текущей базы: 18/18 тестов `auto_delivery_stock`, `lot_writer`, `ops_journal`, `auto_restore_alarm` прошли. Новые значимые проверки: реальный IDB, два заказа на последние единицы и rollback; replay и изменённое quantity; crash до/после commit/отправки; частичная выдача, отмена и uncertain без release; переключение аккаунта; общий wallet; manual-off плюс stock refill/расписание/бюджет; stale/unsupported/429; конкурентные price/active saves; сумма allocations и отсутствие секретов в DTO/экспорте. Зелёная текущая база этих гарантий не подтверждает.
