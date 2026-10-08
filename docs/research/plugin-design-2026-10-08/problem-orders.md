# Проблемные заказы, замены и сверка

Дата: 2026-10-08. Архитектурное исследование текущего checkout; runtime, реальные закупки и сообщения не изменялись. Прочитаны общие контракты и отчёты поставщиков, цен и склада. Рекомендуется общий журнал «Заказы и выдачи» внутри существующей Автовыдачи и один исполнитель исполнения заказов.

## Подтверждённая основа и ограничения

`background/ops_db.js:23` хранит orders по глобальному orderId, `:119` открывает транзакцию одного store; `:228/:246` содержит изменяемый счётчик attempts, а не историю попыток. Восстановление `:266` уже переводит прерванную отправку в uncertain, но `autoresponder.js:593` разрешает выдачу без журнала. Этот fallback недопустим для нового исполнителя.

`autoresponder.js:445` проверяет продавца с разрешением при ошибке; `:632–660` не требует paid. `order_details.js:57` заменяет неизвестное количество единицей; `:24` принимает текущее совпадение названия. `autoresponder.js:150` отправляет расходный по последствиям POST через общий retry, `:162` допускает нечитаемый 2xx как успех. `:773/:785–790` сверяет первую страницу и пропускает известные невыданные заказы. Эти места исправляются до автозакупок.

## Проверка заказа и единый исполнитель

В предлагаемой схеме чат `autoresponder.js:938` и сверка `:813` только регистрируют наблюдение и вызывают новый `fulfillment_dispatcher.js`. Сам dispatcher перечитывает `https://funpay.com/orders/{orderId}/`; offscreen возвращает структурированные факты с evidence, без решений и побочных действий. Объединить `parseOrderParticipants` (`offscreen.js:1063`) и `parseOrderPageForDelivery` (`:1138`) в проверяемый DTO: orderId страницы, currentAccountId, sellerId, buyerId, chatId, статус, offer/category, quantity/unit, SKU fields, observedAt. Несовпадение чата из события и заказа блокирует выдачу.

Первая закупка требует seller=currentAccount, paid, точного offer binding и количества по контракту категории. Неизвестное поле блокирует; название даёт кандидата для ручной привязки конкретного заказа, а не разрешение расходов. MVP ограничить целыми voucher units; денежные/дробные категории потребуют отдельного quantity-контракта. Перед эффектом проверить sessionEpoch, mappingRevision, orderRevision и hold. В MVP один активный аккаунт; смена сессии инвалидирует кэши и останавливает новые эффекты. `background.js:1164` меняет общую cookie; его очередь изолирует только снимки, поэтому живые снимки других аккаунтов при автоматизации выключить.

## Хранилища и состояния

Расширить ops_db версией схемы: orders — текущая проекция по `[accountId,orderId]`; attempts — неизменяемые входные снимки; events — append-only результаты/решения; results и deliveryParts — закреплённые результаты и части; reservations/budget — резервы; purchaseTombstones — дедупликация. Полный event sourcing приложения не нужен: история исполнения плюс атомарно обновляемая проекция достаточно.

Проекция раздельно содержит procurementState, resultCoverage, deliveryState, fpStatus и problemState. accepted закупки не означает готовый результат, готовый результат не означает выдачу, closed FunPay не доказывает автоматическую выдачу. Для каждой попытки сохранить attemptId, fulfillmentGeneration, reference, bodyHash, source/mapping snapshot, quantity, account/epoch, timestamps и evidenceRefs. Секретный payload хранить в extension-origin vault; обычная история и UI получают маску/hash, не raw response.

В одной multi-store транзакции фиксируются orderRevision, резерв применимого ресурса и начало попытки: localpool резервирует конкретные units, supplier — бюджет общего provider wallet. Сеть начинается после commit. Один claim на order/generation защищает chat/reconcile/UI от конкуренции. Lease после рестарта не разрешает повторить внешний эффект: старый sending становится uncertain. Закреплённый source не меняется автоматически при partial/uncertain.

## Результаты и восстановление

`offscreen.js:1143` читает `.order-secrets-box` как товар данного заказа. Это `funpay_secrets`, уже закреплённый удалённым FunPay товар; его нельзя считать свободным localpool или закупать заново. По умолчанию сохранять evidence платформенной выдачи; копию в чат включать отдельной настройкой после проверки реального buyer-visible контракта. Наличие текста само не доказывает полноту количества или получение покупателем.

Покупка, получение результата и отправка выполняются независимо. До POST сохраняются reference/bodyHash; после ответа — providerOrderId, actual charge и результаты даже при hold/refund, пришедшем во время запроса. Расходные POST не повторяются общим retry. Adapter capabilities описывают idempotency scope/TTL, lookup, partial/result retrieval и refund/replacement support; lookup возвращает found/proven_absent/inconclusive/unsupported. Таймаут, пустая первая страница и delayed visibility не являются proven_absent. Повтор закупки разрешается только доказательством отсутствия либо проверенным серверным replay того же reference/body.

Например, официальный [AppRoute Orders SDK](https://raw.githubusercontent.com/AppRoute-FZCO/AppRoute-Public-API-SDK/main/javascript/src/resources/orders.ts) предоставляет POST `/orders`, GET `/orders` с referenceId/orderId и limit/offset. Но наличие этих параметров не доказывает полноту отрицательного lookup. [Transport SDK](https://raw.githubusercontent.com/AppRoute-FZCO/AppRoute-Public-API-SDK/main/javascript/src/transport/http-transport.ts) повторяет методы при 429/5xx; его политику нельзя перенести на закупки без отдельного контракта.

Разбить выдачу на persisted parts `{partId,resultRefs,bodyHash,state,receipt}`. Успех требует проверенного acknowledgement или точного подтверждения сообщения по chat/sender/messageId и содержимому. Текущий site contract таких receipts не устанавливает: пока подтверждение не реализовано и не проверено, исход остаётся uncertain для ручной сверки. Общий BOT_MARKER и отсутствие текста в загруженном фрагменте истории недостаточны. Сохранять подтверждённые части сразу; uncertain часть не пересылать автоматически. Повторная выдача использует прежние resultRefs и никогда не вызывает purchase. Для direct fulfillment поставщика completion подтверждается его проверенным терминальным результатом, а не отправкой шаблона.

## Сверка и действия продавца

Сверка сначала обрабатывает persisted очередь known-unfulfilled/uncertain с nextCheckAt, затем страницы продаж. `offscreen.js:177` уже возвращает nextOrderId; `background.js:119–120` содержит чтение продолжения через POST `continue`. Переиспользовать этот read-протокол с проверкой cursor cycles, лимитом страниц, сохранением прогресса и повторным overlap. Известный orderId обновляется и остаётся кандидатом по состоянию; watermark не заменяет очередь обязательств. После сна выполнять актуальную сверку, не проигрывать старые команды. Важные alarms проверять при старте: [Chrome документирует задержки и особенности сохранения](https://developer.chrome.com/docs/extensions/reference/api/alarms). Старые seed/legacy записи без account/evidence импортировать наблюдением; исполнение только после явного adoption.

В `auto_delivery_page.js:581–588` нынешние «Проблемы» — фильтр лотов; `:745/:769` выбирает пустой склад/ошибки. Добавить верхнюю вкладку «Заказы и выдачи», фильтры «Требуют решения», «Закупка», «Выдача», «Завершены», карточку с количеством, этапами, частями и историей. Финансовые «Операции» оставить денежными; «Поставщики» ведёт в эту же карточку.

| Evidence в карточке | Допустимое действие |
| --- | --- |
| Нет точного offer/quantity/seller | «Проверить заказ», ручное подтверждение привязки; эффект заблокирован |
| Purchase uncertain | «Сверить с поставщиком»; никакой универсальной «Повторить» |
| Куплено, отправки ещё не было | «Выдать купленное», с проверкой актуального заказа |
| Подтверждены отдельные части | Показать части; отправить только доказанно неотправленные |
| Send uncertain | Сверка чата; явная повторная отправка прежнего результата с предупреждением о возможной копии |
| Дефектный товар | «Создать замену» с причиной, количеством и лимитом нового расхода |
| Возврат FunPay | Остановить новые эффекты, сохранить закупку/стоимость; отдельная сверка supplier refund |

Background рассчитывает capabilities и принимает команды с expectedRevision; устаревшая карточка получает conflict. Зарегистрировать узкие actions в `popup_actions.js`, обработчики в background; не давать UI произвольный transition состояния. Ручная отметка «выдано» требует evidence/причины и сохраняется отдельно от серверного подтверждения.

## Замены, деньги и соседние модули

Замена создаёт новую fulfillmentGeneration со ссылкой на исходные results и отдельным authorizationId; двойной клик не создаёт две закупки. Это новый расход, а не retry. Partial сохраняет каждую приобретённую единицу и deficit; компенсация/дозакупка разрешается отдельно. Раскрытые либо uncertain коды не возвращаются в free по TTL или возврату FunPay.

Фактические costs/allocations и corrections неизменяемы; replacementCost добавляется, providerRefund корректирует отдельным событием, buyerRefund не обнуляет расходы. `content/features/profit_engine.js:120` сейчас исключает refunded — будущая модель должна показывать retained cost/убыток. Очистка `ops_db.js:288` и `background.js:902` через 180 дней не удаляет purchase tombstones при сохранении возможности replay.

Order hold имеет owner/revision/evidence; модуль снимает только свой hold. ScheduleClosed запрещает новые продажи, но не уже paid procurement. Problem/refund/replacement/uncertain отменяет текущую reminder campaign; исправление не возобновляет её. Напоминание требует verifiedFulfillmentCompletedAt и свежего fpConfirmedAt, отдельных от общей updatedAt. Отправленный сетевой запрос отозвать нельзя: поздний результат сохраняется, последующая выдача проверяет текущий hold.

## Реализация и проверки

MVP: strict verifier/account migration → projection/attempts/events и очередь known-unfulfilled → карточка/read-only сверка → части/ручное восстановление → supplier recovery и ручные замены в пределах подтверждённых capabilities. Кнопка возврата в MVP открывает заказ/инструкцию и регистрирует наблюдение; автоматический refund POST не предполагается. Позднее: проверенные provider replacements/refunds, дополнительные категории и unattended политики.

Проверены 11/11 текущих tests: ops_journal, order_details, auto_delivery_parser, order_page_parser_browser. Они подтверждают основу; один тест прямо закрепляет небезопасный fallback quantity=1. Новые обязательные сценарии: два входа на один заказ; известный невыданный заказ за первой страницей; crash после charge/после первой части; malformed 2xx; delayed/unsupported lookup; partial и late result после refund; смена аккаунта во время чтения; отсутствующие поля; замена двойным кликом; две причины hold; очистка tombstones; повтор выдачи без новой закупки. Live HTML, receipts и реальные контракты поставщиков остаются непроверенными.
