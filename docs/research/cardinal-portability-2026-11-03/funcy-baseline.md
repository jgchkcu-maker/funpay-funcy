# Сопоставление с текущим Funcy

Проверено по рабочей копии 0.9.13 на 2026-11-03, HEAD `c4c40825a853bb3ef6f4a3cf568908463f8f4510`. Это статическое сопоставление возможностей; существование модуля не доказывает live-приёмку его работы.

| Код | Точка проверки | Вывод |
|---|---|---|
| [manifest.json](../../../manifest.json) | "version", строка 5 | MV3 0.9.13; storage/cookies/alarms/offscreen; внешних поставщиков/Telegram/AI в текущих host_permissions нет. |
| [background/fpt_engine.js](../../../background/fpt_engine.js) | ENGINE_HEARTBEAT_ALARM, строка 2 | Единый фоновый запуск и продолжение автоматизации; точка расширения будущих задач. |
| [background/job_scheduler.js](../../../background/job_scheduler.js) | createJobScheduler, строка 12 | Долговечные задачи/alarms; не отдельный бесконечный поток. |
| [background/account_guard.js](../../../background/account_guard.js) | createAccountGuard, строка 30 | Проверка текущего аккаунта и epoch. |
| [background/account_profiles.js](../../../background/account_profiles.js) | createProfileManager, строка 77 | Профили; автоматизация текущего подтверждённого аккаунта, не произвольная серверная многопоточность. |
| [background/ops_db.js](../../../background/ops_db.js) | createOpsJournal, строка 281 | Журнал операций/состояний. |
| [background/fulfillment_dispatcher.js](../../../background/fulfillment_dispatcher.js) | createFulfillmentDispatcher, строка 63 | Проверенная выдача и части результата; не готовый локальный FIFO склад. |
| [background/order_commands.js](../../../background/order_commands.js) | createOrderCommands, строка 77 | Карточка проблемного заказа, действия и проверка возможностей. |
| [background/lot_writer.js](../../../background/lot_writer.js) | createLotWriteQueue, строка 10 | Общая запись свежих форм и terminal deleted guard. |
| [background/lot_availability.js](../../../background/lot_availability.js) | createLotActivityService, строка 4 | Причины активности/блокировки; не взаимное перетирание автоматизаций. |
| [background/lot_schedule_service.js](../../../background/lot_schedule_service.js) | createLotScheduleService, строка 27 | Расписания уже реализованы; искать недостающие сценарии, не второй модуль. |
| [background/pricing_service.js](../../../background/pricing_service.js) | createPricingService, строка 36 | Цена на основе себестоимости/маржи и preview; это не конкурентный демпинг. |
| [background/review_reminders.js](../../../background/review_reminders.js) | createReviewReminders, строка 116 | Напоминание об отзыве после проверенной выдачи и подтверждения; не общий confirm reminder. |
| [content/features/auto_review.js](../../../content/features/auto_review.js) | review, строка 2 | Ответы продавца/бонусы за отзыв; не создание рейтинга покупателю. |
| [content/features/market_analytics.js](../../../content/features/market_analytics.js) | market, строка 66 | Сбор рыночной информации; не полный непрерывный CompetitorWatch. |
| [content/features/buyer_history.js](../../../content/features/buyer_history.js) | buyer, строка 1 | История покупателя; дополнения RegularsDetector/BuyerGuard оценены отдельно. |
| [content/features/lot_cloning.js](../../../content/features/lot_cloning.js) | clone, строка 4 | Клонирование лотов. |
| [content/features/bulk_lot_editor.js](../../../content/features/bulk_lot_editor.js) | bulk, строка 2 | Массовое редактирование/операции. |
| [content/features/section_commission.js](../../../content/features/section_commission.js) | commission, строка 1 | Комиссия раздела; основа PriceCalc уже есть. |
| [content/features/profit_engine.js](../../../content/features/profit_engine.js) | profit, строка 2 | Прибыль и себестоимость; не приравнивать её к выручке. |
| [content/features/export_studio.js](../../../content/features/export_studio.js) | export, строка 1 | Экспорт данных/отчётов. |
| [background/retired_integrations.js](../../../background/retired_integrations.js) | RETIRED_PAGES, строка 4 | Telegram, Discord, suppliers и связанные настройки удалены; нельзя считать их действующими интеграциями. |
