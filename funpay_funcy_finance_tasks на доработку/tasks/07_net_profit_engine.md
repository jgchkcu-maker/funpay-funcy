# TASK-07 — Чистая прибыль

## Цель
Добавить realised profit и корректную profit coverage.

## Зависимости
TASK-06.

## Затрагиваемые файлы
- `background/background.js`
- `background/sales_db.js`
- `content/sales_db.js`
- `content/features/finance_data.js`
- новый: `content/features/profit_engine.js`
- `content/features/finance_hub.js`

## Часть A — новые продажи

При обработке нового заказа попытаться получить достоверный offerId.

Если offerId найден:
- прочитать cost basis;
- записать snapshot в order record.

Если offerId НЕ найден:
- не угадывать по title;
- оставить cost unknown.

## Часть B — исторические записи

Не применять текущую себестоимость автоматически ко всей истории.

Legacy order:
- profit = unknown;
- excluded from net profit;
- included in revenue.

## Metrics
- realised seller revenue;
- realised cost;
- realised net profit;
- margin;
- ROI;
- cost coverage by order count;
- cost coverage by revenue.

## Refunds
В MVP исключить из realised profit.

## Acceptance criteria
На тестовом наборе:
- 10 продаж, cost известен у 6;
- profit суммирует только эти 6;
- UI показывает coverage;
- unknown cost не даёт завышенной прибыли.

## Commit
`feat(finance): add realised net profit engine`
