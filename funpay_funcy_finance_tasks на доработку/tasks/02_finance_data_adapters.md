# TASK-02 — Data adapters для продаж, покупок и операций

## Цель
Отделить получение/агрегацию данных от DOM страниц FunPay.

## Зависимости
TASK-01.

## Почему
Сейчас `sales_modes.js` и `finance.js` ориентированы на конкретные страницы FunPay и DOM anchors. Finance Hub должен читать те же данные независимо от текущей страницы.

## Затрагиваемые файлы
- `content/features/sales_modes.js`
- `content/features/finance.js`
- `content/features/purchases.js`
- `content/features/stats_drilldown.js`
- `background/sales_db.js`
- `background/purchases_db.js`
- `background/finance_db.js`
- новый: `content/features/finance_data.js`

## Сделать

Создать read-only API:

```js
window.FPTFinanceData = {
  getSales({period, statuses}),
  getPurchases({period, statuses}),
  getOperations({period, types}),
  aggregateSales(...),
  aggregatePurchases(...),
  aggregateOperations(...),
  getMeta()
}
```

Переиспользовать текущие DB и существующую логику агрегации.

## Требования

- один source of truth;
- никаких DOM queries в adapter;
- данные возвращаются plain objects;
- период и статусы передаются аргументами;
- возвраты явно различаются;
- операции баланса не смешиваются с покупками.

## НЕ делать
Не менять визуализацию.

## Acceptance criteria

В console вручную можно вызвать adapter и получить:
- sales array;
- purchases array;
- operations array;
- агрегаты.

Результаты по текущим периодам совпадают со старыми отчётами.

## Commit
`refactor(finance): extract reusable finance data adapters`
