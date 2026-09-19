# TASK-08 — Финальный экран «Обзор»

## Цель
Собрать все готовые показатели в один понятный dashboard.

## Зависимости
TASK-07.

## Затрагиваемые файлы
- `content/features/finance_hub.js`
- `content/features/sales_modes.js`
- `content/features/sales_chart.js`
- `css/content_styles.css`

## Реализовать сетку

### KPI row
- Выручка
- Чистая прибыль
- Заказы
- Средний чек

### Potential row
- Потенциальная выручка
- Потенциальная прибыль
- Стоимость склада
- Активные лоты/остаток

### Main chart
Metric tabs:
- Выручка
- Прибыль
- Заказы

### Side donut
По умолчанию:
- прибыль по категориям;
fallback:
- выручка по категориям.

### Tables
- топ товаров;
- топ категорий.

## UX
Карточка прибыли всегда показывает coverage.

Если coverage < 100:
`Прибыль рассчитана по 72% оборота`.

## Acceptance criteria
- все карточки используют единый period;
- refresh обновляет все блоки;
- resize не ломает сетку;
- отсутствие potential data не ломает historical sections.

## Commit
`feat(finance): build finance overview dashboard`
