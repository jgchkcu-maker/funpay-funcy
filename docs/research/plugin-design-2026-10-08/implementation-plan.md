# Шесть модулей FunPay Funcy: план реализации

Дата: 2026-10-08. Статус: сводный план после независимого критического ревью. Приняты поправки raw quantity, sync finance facade, очередь намерений/удалений и ограниченный денежный пилот. Это результат архитектурного исследования, runtime-функции в рамках этой задачи не реализованы.

## Что делать и где разместить

Предлагается собственная JS-реализация внутри существующего расширения. Cardinal-плагины служат материалом для сравнения поведения; их Python-код нельзя просто подключить в MV3 service worker. Не нужно создавать шесть самостоятельных страниц или отдельный сервер для начального выпуска.

| Модуль | Поведение | Интерфейс расширения |
| --- | --- | --- |
| Поставщики и автозакупка | Привязка конкретного offer к SKU/варианту, расчёт полного заказа, закупка, проверка результата, выдача | Новая «Поставщики» в группе «Лоты и продажи»: подключения, каталог, привязки. Статус заказа ведёт в общий журнал |
| Автоцены и прибыль | Наценка или маржа, минимальная прибыль, шаг/потолок, preview, затем ограниченная автозапись | «Управление лотами»: правило и preview. «Финансы»: оценка и фактические затраты с происхождением |
| Остатки и доступность | Локальные пулы, резервы, remote FunPay snapshot и внешнее наличие; объединённые причины паузы | «Автовыдача»: источники, пулы/партии, свободно/зарезервировано/карантин, свежесть и причины остановки |
| Напоминания об отзыве | Один нейтральный запрос после выполненной и подтверждённой продажи; любой отзыв отменяет задачу | Третий независимый блок в «Отзывы и бонусы»; переход в карточку заказа |
| Проблемные заказы и замены | Сверка закупки/выдачи, части результата, повторная отправка сохранённого товара, отдельная авторизация замены | Вкладка «Заказы и выдачи» в «Автовыдаче». Нынешний фильтр «Проблемы» продолжает означать проблемы лотов |
| Расписания | Недельные окна в одной зоне аккаунта, preview, восстановление актуального состояния после сна | Режим «Расписание» в «Управлении лотами», с существующим выбором лотов |

## API поставщиков: подтверждённое и ещё неизвестное

**Первый адаптер — AppRoute.** Официальный SDK документирует региональные базы `https://approute.ru/api/v1` / `https://approute.io/api/v1`, заголовок `X-API-Key`, каталог, заказы и балансы. SDK имеет MIT-лицензию; при использовании его кода сохранить лицензионные notices. Для существующего проекта достаточно небольшого адаптера, а не внедрения Node runtime в расширение. [README](https://github.com/AppRoute-FZCO/AppRoute-Public-API-SDK).

Чтение: `GET /services`, `GET /services/{serviceId}/items/{itemId}`, `GET /services/{serviceId}/stock`, batch `POST /services/items/lookup`. Покупка: `POST /orders`; сверка: `GET /orders` с `referenceId` или `orderId`, `limit/offset`. Это доказанные методы SDK; реальный партнёрский ответ и доступность нужного SKU ещё не проверены. [Services](https://raw.githubusercontent.com/AppRoute-FZCO/AppRoute-Public-API-SDK/main/javascript/src/resources/services.ts), [Orders](https://raw.githubusercontent.com/AppRoute-FZCO/AppRoute-Public-API-SDK/main/javascript/src/resources/orders.ts).

SDK повторяет запросы при 429/5xx, включая расходные POST. При закупке такой retry отключить. `IDEMPOTENCY_REPLAY` и reference полезны, но проверенные материалы не устанавливают все гарантии конкурентного повтора, срока хранения и отрицательного поиска. Неподтверждённый исход сохраняется как uncertain, без нового списания. [Transport](https://raw.githubusercontent.com/AppRoute-FZCO/AppRoute-Public-API-SDK/main/javascript/src/transport/http-transport.ts).

Серверный лимит расхода API-ключа ограничивает общий headroom, но не равен фиксации цены конкретного SKU. В проверенных create-параметрах не установлен locked quote/maxPrice. Это неизвестность контракта, а не доказательство отсутствия такой возможности во всём API. До пилота уточнить оба ограничения; свежий GET сам по себе не гарантирует будущую сумму. При отсутствии per-order cap допустим только явно выбранный режим ценового риска с реальным общим пределом расходов, без обещания гарантированной маржи.

**DesslyHub — вторым для проверенной категории.** Подтверждены `apikey`, Steam Gift POST `/api/v1/service/steamgift/sendgames` и обязательная проверка `/api/v1/merchants/transaction/{transaction_id}/status`. Необязательный reference не доказывает дедупликацию; recovery после потери transaction ID не установлен. Gift-контракт не переносится автоматически на ваучеры. [Introduction](https://desslyhub.readme.io/reference/introduction), [Gift](https://desslyhub.readme.io/reference/post_apiv1steamgift), [Status](https://desslyhub.readme.io/reference/get_apiv1statustransaction_id).

**NS.Gifts — исследовательский кандидат.** [Официальный сайт](https://ns.gifts/) подтверждает B2B/API, но docs через исследовательский инструмент возвращают502. Версия/auth/endpoint/recovery не установлены; не планировать готовый адаптер по чужому Cardinal-плагину.

## Какие страницы FunPay использовать

Это адреса, уже используемые текущим кодом, а не обещание публичного стабильного FunPay API:

| Страница/endpoint | Использование |
| --- | --- |
| `/orders/trade` и существующий протокол продолжения | Наблюдение продаж с пагинацией; persisted known-unfulfilled очередь проверяется независимо от первой страницы |
| `/orders/{orderId}/` | Свежие участники, статус, quantity, binding, поля товара, состояние отзыва и результаты конкретного заказа |
| `/users/{sellerId}/` | Собственные лоты и категория; текущие названия помогают найти кандидата, не разрешают закупку |
| `/lots/offerEdit?node=…&offer=…` | Свежая полная форма внутри очереди записи |
| `/lots/offerSave` | Сохранение разрешённых намеренных изменений с последующим чтением |
| `/lots/calc` | Buyer total для конкретных входных параметров; не доказательство фиксированной комиссии для всех сумм |
| `/runner/` | Существующий чат-протокол; acknowledgment и сверку конкретного сообщения нужно подтвердить fixtures |

Реальные обезличенные fixtures целевых категорий необходимы до эффектов: платный/возвращённый/подтверждённый заказ, количество, участники, прямой offer binding, отзыв absent/present/unknown, valid/error runner response. Синтетическая фикстура и зелёный unit-тест не подтверждают действующий сайт.

## Встраивание в код

- `background/order_details.js` + `offscreen/offscreen.js`: strict fresh verifier. Проверять исходное quantity целиком и единицу по контракту категории: текущий parser через /^\d+/ и parseInt превращает `1,5`/`1.5` в1, а `2abc` в2. Проверка integer только в loader уже не обнаружит ошибку. Неизвестное quantity не превращается в1; seller/paid/offer/buyer/chat проверяются. OrderId извлекается и проверяется со страницы, не просто подставляется из запроса loader. Fallback по названию — только ручной кандидат.
- `background/autoresponder.js`: чат и reconcile вызывают один dispatcher; strict sender не повторяет POST вслепую и не считает malformed2xx успехом. Выдача без durable journal для нового пути запрещена.
- `background/ops_db.js`: account-scoped проекции, применимые атомарные резервы, attempts/events, части результата, purchase tombstones. Не требуется полный event sourcing приложения.
- `background/job_scheduler.js` + registration в `background/background.js`: persisted deadlines, один ближайший alarm на класс заданий, recovery при запуске worker, независимо от включённости автоответчика.
- `background/lot_writer.js` + `lot_availability.js`: очередь accountId+offerId и один resolver активности. Все старые writers существующих offers переводятся на намеренные поля/операции; полная форма из UI не считается актуальной.
- `content/features/lot_management.js`, `inline_price_editor.js`, `bulk_lot_editor.js`, background `saveSingleLot`: убрать обход общей очереди и partial save при неудачном чтении. Учесть удаление существующих offers через `background.js:1848/1859` и `profile_descriptions.js:228/233`: сериализация и terminal deleted guard запрещают последующие queued updates. Создание нового offer_id=0 — отдельный поток, не очередь неизвестного existing offer. Import (`background.js:1106/1135–1144`) и cloneCreateLot (`:1795`) могут повторять создание после неопределённого исхода: для этого потока тоже нужны остановка blind retry и сверка возможного дубля. Expect/post-read не являются серверным CAS против ручной записи на сайте.
- Новые небольшие фоновые модули: supplier adapter/registry/orders/vault, fulfillment dispatcher, review reminders, schedule evaluator/service. Названия — предлагаемая структура, не уже существующие файлы.
- `content/features/finance_data.js`, `profit_engine.js`, `cost_basis_store.js`, `background/sales_db.js`: actualCost projection и estimate/actual provenance. Нынешний aggregateProfit — синхронный фасад для массива; enrichment выполнить заранее либо через явный новый async API, не менять контракт незаметно.
- Новые UI actions проходят `popup_actions.js`; новая supplier-страница требует nav/container, metadata, manifest script и mount в content_script. Для keys отдельная доверенная extension-страница, не поле внутри DOM FunPay.

## Общие решения, которые предотвращают конфликт модулей

MVP обслуживает один активный подтверждённый FunPay-аккаунт. При автоматизации живые snapshots других аккаунтов с подменой общей cookie выключены; показывается кэш. Epoch проверяется перед эффектами. Это снижает риск, но один mutex не изолирует произвольные вкладки и ручной login; нельзя обещать полноценный параллельный мультилогин.

Один заказ имеет один закреплённый источник. FunPay secrets — товар уже конкретного заказа, не свободный localpool. Supplier purchase, готовый результат и delivery сохраняются отдельно. После ошибки чата повторно отправляется прежний результат; новая закупка не является retry отправки. Замена создаёт отдельную generation и разрешённый расход. Refund покупателю не отменяет расход поставщика и не делает раскрытый код свободным.

Активность лота определяется manualIntent + blockers schedule/stock/price/budget/configuration. Модуль снимает только собственную причину. Старое inactive не становится автоматически owned; нужен opt-in и «Не включать автоматически». По boolean невозможно обнаружить ручную команду выключения уже выключенного лота. Расписание ограничивает новые продажи, а оплаченные обязательства исполняются отдельно.

Деньги хранятся точными decimal strings с валютой и quantum конкретной операции. По [справке FunPay](https://funpay.freshdesk.com/support/solutions/articles/103000273187-%D0%BA%D0%BE%D0%BC%D0%B8%D1%81%D1%81%D0%B8%D0%B8) продавцу поступает указанная им сумма: buyer fee повторно не вычитается. Фактическая cost заказа включает units/fees/сохранённый FX и corrections; возврат выручки не обнуляет retained cost. Неизвестные затраты и курс остаются неизвестными. Конкурентный демпинг — поздний этап только для доказанных эквивалентов и выше floor.

## Минимальные вертикальные выпуски

1. **Просмотр и расчёт.** Каталог одного поставщика с безопасным подключением ключа, mapping/quote preview; ручной pricing preview; schedule preview; read-only карточки заказов. Не требуется завершать весь journal/fulfillment, чтобы показать расчёт без side effect.
2. **Управление публикацией.** Account guard, очередь намерений всех offer writers, resolver/manual ownership; затем расписание и fresh remote stock. Этот выпуск не зависит от полноценного supplier purchase ledger.
3. **Первый денежный срез.** Один AppRoute voucher SKU, один аккаунт, один заказ одновременно, целые units. Кнопка подтверждения закупки и отдельное ручное раскрытие сохранённого результата. До расхода нужны strict order, account journal, узкая атомарная запись claim/budget reservation/attempt, actualCost, стабильный reference, recovery uncertain и реальный общий cap ключа. Local pools и второй адаптер не являются prerequisites этого среза.
4. **Автоматизация продаж.** Автовыдача после проверенного strict sender/receipts и persisted result parts; unattended закупка после установленных recovery/idempotency capabilities. Отсутствие per-order price cap допускает только отдельно выбранный ценовой риск с подтверждённым общим cap; это не отменяет recovery, verifier и остальные проверки. Reminder после проверяемого исполнения/подтверждения, а не просто chat event. Pricing auto после money fixtures/общего writer. Local pools, второй поставщик, замены по API и competitors — следующие независимые расширения.

Предложенный MVP напоминателя сознательно узок: новые цифровые заказы с доказанным исполнением управляемого dispatcher и свежим подтверждением FunPay. Ручные выдачи/услуги/история автоматически не покрываются. Это выбранная цена узкого продуктового охвата, а не обязательное условие любой архитектуры: отдельный этап может принять привязанные доказательства ручного исполнения. Preview напоминаний не требует всей supplier ledger или исправления несвязанного бонуса. Расписание MVP — одна фиксированная зона аккаунта и weekly windows; date exceptions позднее. Chrome alarms могут задерживаться; закрытый Chrome не гарантирует своевременного выключения лота или24/7 выдачи. Сервер нужен только при принятом требовании постоянно работающего исполнения или конкретном ограничении провайдера.

## Проверка и материалы

На текущей копии координатор повторил `node --test tests/ops_journal.test.js tests/order_details.test.js tests/lot_writer.test.js tests/auto_delivery_stock.test.js`: **19/19**. Агенты дополнительно проверили свои текущие UI/storage/parser/alarm paths. Эти наборы частично пересекаются; их числа не суммируются в независимое покрытие новых функций.

Критические будущие проверки: duplicate chat/reconcile; known-unfulfilled за первой страницей; два заказа на последний item/бюджет; crash до/после charge/send; malformed2xx; delayed/unsupported lookup; partial/late result; account switch; tinyprices; stale bulk form; несколько blockers/manualoff; refunds с невозмещённой cost; reminder anyreview/unknown/blacklist/chatcap/baseline; schedule overnight/DST/recovery без replay; сохранность tombstones.

Подробные отдельные разборы: supplier-autopurchase.md, pricing-profit.md, stock-availability.md, review-reminders.md, problem-orders.md, lot-schedules.md. Независимый итог сохранён в critical-review.md; предметные замечания отражены выше. Планы этапов уточняют ранние отчёты: preview не ждёт всей foundation, AppRoute key cap не равен locked price, finance enrichment сохраняет sync-контракт, существующие удаления входят в writer migration, localpool не нужен supplier-пилоту.
