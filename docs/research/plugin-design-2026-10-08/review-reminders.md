# Напоминания об отзывах после реальных продаж

Дата: 2026-10-08. Отдельное архитектурное исследование текущей копии, с учётом integration-contracts и первых трёх отчётов. Runtime, реальные продажи и сообщения не изменялись. Рекомендация MVP: одно отложенное напоминание на новый подтверждённый заказ, только после доказанного исполнения и свежей проверки отсутствия отзыва. Автоматизация включается явно для одного активного аккаунта.

## Что уже существует

`content/ui/auto_review_page.js:272` создаёт «Ответы на отзывы» и «Бонус за 5★». Независимые черновики и проверка конфликтов при сохранении (`:596–637`) подходят для третьего блока «Напоминание после продажи». `content/features/auto_review.js:2` содержит пустой initializeAutoReview и регистрацию действий через fptPatchAutoReplies; фоновой логики напоминаний здесь нет. `background/auto_reply_store.js:133–185` сериализует настройки и исключает runtime-маркеры при импорте. Это полезная очередь настроек, но не account-scoped журнал отправок.

`background/autoresponder.js:374–435` реагирует на NEW_FEEDBACK/FEEDBACK_CHANGED, читает заказ, публикует ответ и отправляет бонус. handleReview не проверяет blacklist, хотя isBlacklisted существует (`:282`) и учитывает blockResponse по username. repliedOrderIds ограничен 500 записями (`:383–405`), относится к ответам, обновляется только после успешного ответа; отдельной дедупликации бонуса нет. FEEDBACK_CHANGED проходит уже существующий маркер. Следовательно, эти массивы нельзя использовать для новых напоминаний или считать достаточной защитой бонусов.

`offscreen/offscreen.js:962–1007` parseOrderPageForReview возвращает `{stars,lotName}` либо null. Null означает отсутствие звёзд, собственный отзыв или ошибку разбора: это не доказательство отсутствия отзыва. Нужен отдельный snapshot `reviewPresence:present|absent|unknown` с authorId/rating/observedAt/parserVersion и проверкой узнаваемой страницы заказа. Любой существующий отзыв отменяет напоминание независимо от оценки; unknown запрещает отправку.

## Проверяемые данные и точки подключения

Существующие URLs в autoresponder: GET `https://funpay.com/orders/{orderId}/` (`:387`, `:489`), GET `/orders/trade` (`:773`), GET `/users/{userId}/` для собственных лотов (`:496`); чат отправляется POST `/runner/` с action=chat_message (`:136–158`), ответ на отзыв — отдельным POST `/orders/review` (`:235–245`). Использовать текущую браузерную сессию через credentials, не переносить cookie из content UI и не переключать общий golden_key. Эти адреса подтверждены кодом, действующая HTML-разметка в аккаунте пока не проверена.

Общий fresh verifier должен объединять parseOrderParticipants (`offscreen:1063`) и parseOrderPageForDelivery (`:1138`) с новым review snapshot. Требуются совпадающие currentAccountId=sellerId, точный orderId, buyerId/chatId, историческое доказательство paid, свежий fpStatus=closed/confirmed, отсутствие refund/reopen/problem и verifiedFulfillmentCompletedAt с evidenceRefs. Подтверждённое исполнение и подтверждение FunPay — разные факты. Отправленный приветственный шаблон, наличие secrets или старый delivery-op=done сами по себе не доказывают исполнение.

MVP охватывает только новые цифровые товары, полностью выданные управляемым dispatcher: доказаны binding, quantity/resultCoverage и receipt каждой части правильному покупателю. Ручные выдачи, услуги и исторические продажи автоматически не включаются; нажатие продавцом «Выполнено» не заменяет доказательства. Поддержка ручных заказов — отдельный этап с привязанными к orderId доказательствами состава и полноты выдачи, проверкой покупателя и явным решением продавца; до него UI честно показывает «Нет проверенного исполнения».

Текущий verifyIAmSeller (`autoresponder:445–459`) пропускает ошибки и кэширует только orderId. Loader (`order_details.js:33–74`) кэширует минуту без account/epoch и превращает неизвестное quantity в 1. Для эффектов нужны explicit fresh/bypassCache, accountId+epoch и строгая роль без fallback. Неизвестная quantity блокирует подтверждение полного исполнения; отсутствие offer-link требует ранее подтверждённого binding, не совпадения названия. Reconcile/чат (`autoresponder:938–945`) только инициируют обновление evidence, без прямого планирования по тексту.

## Одна задача и ограничение сообщений

Предлагаемый `background/review_reminders.js`: `observeOrder`, `cancelForOrder`, `runDue`, `recover`; DTO команд содержит accountId/orderId/expectedRevision. В расширенном account-scoped ops journal хранить уникальный ключ `review-reminder:{accountId}:{orderId}`, campaignRevision, fulfillmentGeneration, policyRevision, buyerId/chatId, dueAt, expiresAt, state, cancellationReason, attemptId/bodyHash и receipt. Текущий ops_db.js:23 имеет orders-key=orderId, OP_STATES (`:29`) не содержат cancelled: потребуется явная миграция и бизнес-проекция reminder, а не неподдерживаемый transitionOp.

Первое соблюдение всех условий фиксирует `dueAt=max(verifiedFulfillmentCompletedAt,confirmationEvidenceAt)+delay`. Если серверное confirmedAt недоступно, confirmationEvidenceAt — время первого достоверного наблюдения, подписанное именно так. Повторное событие не сдвигает dueAt. Настройка MVP: один нейтральный текст со ссылкой `{orderlink}`, задержка, срок актуальности, исключения лотов/покупателей; никаких повторных серий и условий «только 5★». Бонус остаётся отдельной функцией с собственным ключом дедупликации.

Сохранить enabledFrom и baseline известных заказов. Заказы до включения, legacy с неизвестным аккаунтом/временем оплаты, исторический импорт и первый reconcile не создают задач. Отключение отменяет pending; повторное включение не оживляет их. История не становится рассылкой после переустановки: сначала новый baseline. Потеря базы отключает автоматическую отправку до восстановления baseline, вместо fallback без журнала.

Перед отправкой повторно проверяются свежие настройки, blacklist blockResponse/исключения, account epoch, order revision и общий hold. Согласовано с problem_orders_v2: issue_opened, replacement_authorized, refund_observed и uncertain немедленно отменяют campaign; resolution и удаление отзыва не возобновляют её автоматически. Review unknown временно блокирует проверку до expiresAt; uncertain закупки/выдачи/отправки отменяет автоматический эффект. С lot_schedules_v2 согласовано: scheduleClosed ограничивает новые продажи, не уже выполненный заказ.

Лимит чата действует между заказами: предложенный default — одно напоминание за семь дней. Резерв chat slot и отправочной попытки атомарен; иначе два заказа обходят cap. Deferred проверка имеет nextCheckAt, неизменный dueAt и expiresAt. Sent и uncertain расходуют лимит; освобождение возможно только после доказанного отказа до отправки. Tombstones отменённых/отправленных задач сохраняются вместе с baseline и не исчезают при обычном prune180days.

## Отправка и восстановление

sendChatMessage сейчас использует fetchWithRetry, который повторяет POST при network/429/5xx (`autoresponder:25–53`); malformed 2xx JSON превращается в null и считается успехом (`:162–164`). До включения reminder нужен общий strict sender: durable attempt перед единственным POST, затем подтверждённый acknowledgment с привязкой к чату/сообщению либо проверяемый read-back. Формат acknowledgment требуется установить fixtures, не выдумывать. Timeout, malformed response и прерванный sending дают uncertain без автоматического повторного POST; отсутствие сообщения в неполной истории не доказывает неотправку.

Непосредственно перед POST сверять epoch/holds/revision внутри локальной очереди. Это уменьшает гонку, но не исключает отзыв или refund, появившийся на сервере после последнего GET: server-side условной отправки здесь не подтверждено. UI показывает это ограничение наблюдаемости без обещания абсолютной синхронности.

Через job_scheduler.js register/scheduleAt/registerRecovery подключить один alarm ближайшей проверки, хранить dueAt в базе. В background.js:938–942 уже есть регистрация jobs/recovery, startup/heartbeat — `:2602`, `:2640`. При пробуждении перечитать состояние, восстановить будущие задания и пропустить просроченные; допустимые отправлять ограниченной очередью с cap, без пачки пропущенных интервалов. Закрытый браузер не обеспечивает 24/7. Смена аккаунта останавливает эффекты; при возвращении нужен fresh verifier, не replay legacy.

## UI, проверка и внешний пример

В «Отзывы и бонусы» добавить третий независимый блок, preview, счётчики ожидающих/отменённых/неясных, причину и «Отменить». Список открывает существующий заказ и журнал «Заказы и выдачи». Сохранение использует нынешний checked patch, runtime-команды — background API с revision; импортирует настройки без pending/sent.

Публичный [ago106/review_reminder.py](https://github.com/ago106/fpc-plugins/blob/main/review_reminder.py) перепроверен по первичному коду: Settings задаёт порог 4; last_sent=None разрешает первую отправку сразу; CLOSED делает append без проверки дубля; отзыв ниже порога не останавливает сообщения; Order не содержит accountId. В просмотренном дереве репозитория LICENSE не найден, право переноса не установлено. Это пример требований и дефектов, не код для переноса.

Этапы: строгие fixtures order/review/role + sender → account journal/holds/дедупликация бонусов → preview без отправки → opt-in одного аккаунта. Выполнены 27/27 существующих tests auto_review_page/ui_contract, auto_reply_storage, ops_journal, order_details, auto_restore_alarm. Новые необходимые сценарии: отзыв любой оценки/удаление/unknown HTML; duplicate CLOSED; confirmed до delivery; partial/uncertain; hold между GET и POST; два заказа одного чата; switch epoch; crash до/после POST; malformed2xx; blacklist после dueAt; disable/re-enable; stale baseline и prune. Это будущие гарантии, текущие тесты их не доказывают.
