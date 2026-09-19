# TASK-11 — Hardening, производительность и финальная проверка

## Цель
Закрыть edge cases перед merge.

## Зависимости
TASK-10.

## Проверки

### Data
- пустая DB;
- 1 заказ;
- 10k+ заказов;
- mixed RUB/USD/EUR;
- refunded;
- paid;
- closed;
- missing dates;
- missing cost;
- removed lot;
- inactive lot;
- unknown stock;
- unlimited stock.

### Cost editor
- create lot;
- edit lot;
- duplicate own;
- foreign clone;
- clear cost;
- 2 tabs create simultaneously.

### Performance
- Finance Hub открывается без зависания;
- heavy aggregation не запускается по каждому MutationObserver tick;
- charts cleanup;
- DB читается минимально необходимое число раз.

### UX
- loading;
- retry;
- empty;
- stale;
- coverage warning;
- mobile/narrow popup;
- keyboard navigation.

### Regression
- auto-bump;
- lot editor;
- buyer price;
- exact price;
- commission display;
- sales/purchases update;
- finance update;
- settings import/export.

## Финальный deliverable

Добавить короткую developer note в README:
- где хранятся cost basis;
- как считается profit;
- почему unknown cost исключается;
- как устроена migration.

## Commit
`test(finance): harden finance hub and profit analytics`
