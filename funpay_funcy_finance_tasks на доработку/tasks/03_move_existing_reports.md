# TASK-03 — Перенести существующие отчёты в Finance Hub

## Цель
Показать текущую статистику внутри новых subtabs без удаления старых блоков.

## Зависимости
TASK-02.

## Затрагиваемые файлы
- `content/ui/main_popup.js`
- `content/features/sales_modes.js`
- `content/features/sales_chart.js`
- `content/features/stats_drilldown.js`
- `content/features/finance.js`
- новый: `content/features/finance_hub.js`
- `css/content_styles.css`

## Сделать

### Продажи
Перенести/переиспользовать:
- cards;
- line chart;
- donut charts;
- top buyers/products/categories;
- drill-down.

### Покупки
Те же display modes, но с purchase semantics.

### Операции
Перенести текущие:
- приход;
- расход;
- нетто;
- разбивку по типам;
- помесячную динамику;
- список операций.

## Важное
Старые отчёты на `/orders/trade`, `/orders/`, `/account/balance` пока остаются.

## UX
Все subtabs используют общий period selector Finance Hub.

## Acceptance criteria

Для одинакового периода значения в старом и новом UI совпадают.

Графики не создаются повторно при каждом переключении tab без cleanup.

## Commit
`feat(finance): render existing reports inside finance hub`
