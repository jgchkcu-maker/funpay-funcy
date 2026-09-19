# FunPay Funcy — пакет задач по категории «Финансы»

Этот пакет предназначен для последовательного выполнения агентом. НЕ выполнять все задачи сразу.

## Строгий порядок работы

1. Открыть `MASTER_PLAN.md`.
2. Открыть `specs/UI_UX_SPEC.md` и `specs/FINANCE_DOMAIN_MODEL.md`.
3. Выполнять задачи строго по номеру из папки `tasks/`.
4. После каждой задачи:
   - запустить локальные/доступные проверки;
   - проверить отсутствие ошибок в console;
   - проверить старый функционал, который затронут;
   - сделать отдельный commit;
   - записать краткий итог выполненного;
   - только после этого переходить к следующей задаче.
5. Не объединять две соседние задачи в один большой рефакторинг.
6. Не удалять старые отчёты со страниц FunPay до TASK-10.
7. Не менять формулы прибыли без сверки с `FINANCE_DOMAIN_MODEL.md`.
8. Не считать неизвестную себестоимость равной нулю.

## Репозиторий

`jgchkcu-maker/funpay-funcy`, ветка `main` на момент планирования.

Ключевые существующие файлы, на которых основан план:

- `content/ui/main_popup.js`
- `content/features/sales_modes.js`
- `content/features/purchases.js`
- `content/features/finance.js`
- `content/features/sales_chart.js`
- `content/features/stats_drilldown.js`
- `content/features/buyer_price_field.js`
- `content/features/exact_price.js`
- `content/features/section_commission.js`
- `content/features/lot_management.js`
- `background/sales_db.js`
- `background/purchases_db.js`
- `background/finance_db.js`
- `background/background.js`
- `config.v1.json`
- `css/content_styles.css`

## Главный результат

После выполнения пакета у FunPay Funcy должна быть отдельная полноценная категория «Финансы», в которой находятся:

- единый финансовый обзор;
- существующая статистика продаж;
- существующая статистика покупок;
- существующая статистика финансовых операций;
- диаграммы и drill-down;
- новая система себестоимости;
- реализованная чистая прибыль;
- потенциальная выручка активных лотов;
- потенциальная чистая прибыль текущего склада;
- детализация по лотам / категориям / товарам;
- экспорт;
- корректные empty/error/loading states.

Старые отчёты, внедряемые непосредственно на страницы `/orders/trade`, `/orders/` и `/account/balance`, удаляются из основного UX только на финальном этапе миграции.
