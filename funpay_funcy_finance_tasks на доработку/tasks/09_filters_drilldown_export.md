# TASK-09 — Фильтры, детализация и экспорт

## Цель
Сделать Finance Hub рабочим инструментом, а не только красивым dashboard.

## Зависимости
TASK-08.

## Сделать

### Глобальные фильтры
- period;
- statuses;
- currency;
- category where meaningful.

### Drill-down
Клик по KPI / segment / table row открывает список заказов или лотов.

### Profit tab
Tables:
- profit by product;
- profit by category;
- low margin;
- unknown cost.

### Export
CSV/JSON:
- sales;
- purchases;
- operations;
- realised profit;
- potential inventory.

Каждый export должен содержать явные поля:
- knownCost boolean;
- profit null, если неизвестен;
- currency.

## Acceptance criteria
- фильтр влияет на KPI и charts одинаково;
- exported totals совпадают с UI;
- null profit не превращается в 0.

## Commit
`feat(finance): add filters drilldowns and exports`
