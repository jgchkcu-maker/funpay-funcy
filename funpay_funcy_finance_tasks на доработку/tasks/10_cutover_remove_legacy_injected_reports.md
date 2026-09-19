# TASK-10 — Переключение со старых отчётов на Finance Hub

## Цель
После того как новый Finance Hub стабилен, убрать дублирование UI.

## Зависимости
TASK-09.

## Затрагиваемые файлы
- `content/ui/main_popup.js`
- `content/features/sales_modes.js`
- `content/features/purchases.js`
- `content/features/finance.js`
- `content/features/ui_enhancements.js`
- settings storage handling

## Сделать

1. Старые injected blocks на:
   - `/orders/trade`
   - `/orders/`
   - `/account/balance`
   перестать показывать по умолчанию.

2. Удалить/переосмыслить старые настройки:
   - `Показывать статистику покупок и продаж на их вкладках`
   - `Показывать статистику финансов в «Финансы»`

3. На переходный релиз можно оставить advanced toggle:
   `Показывать старые отчёты на страницах FunPay`.

4. Данные и background sync НЕ удалять.

## Важно
Это UI cutover, а не удаление DB.

## Acceptance criteria
- Finance Hub работает при выключенных legacy blocks;
- updateSales/updatePurchases/updateFinance продолжают заполнять DB;
- нет двойной отрисовки;
- настройки мигрируют без ошибок.

## Commit
`refactor(finance): move analytics UX fully into finance hub`
