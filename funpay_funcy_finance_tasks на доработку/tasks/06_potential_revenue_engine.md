# TASK-06 — Потенциальная выручка активных лотов

## Цель
Собрать список активных предложений и рассчитать стоимость текущего продаваемого запаса.

## Зависимости
TASK-05.

## Затрагиваемые файлы
- новый: `content/features/finance_potential.js`
- `content/features/lot_management.js`
- `background/background.js`
- `content/features/section_commission.js`
- `content/features/finance_hub.js`

## Требуемая модель строки

```js
{
  offerId,
  nodeId,
  title,
  category,
  active,
  stock,
  stockKind, // finite | unknown | unlimited
  sellerPrice,
  buyerPrice,
  currency,
  costBasis
}
```

## Расчёты

Для finite stock:
- buyer GMV;
- seller revenue;
- inventory cost;
- potential profit;
- margin.

Для unknown/unlimited:
- monetary potential = null;
- строка остаётся видимой.

## UI tab «Потенциал»

Summary:
- потенциальная выручка продавца;
- потенциальный оборот покупателей;
- стоимость известного склада;
- потенциальная прибыль;
- число active offers;
- число лотов без finite stock;
- cost coverage.

Таблица — по UI spec.

## Важно
Не открывать десятки страниц последовательно без необходимости.
Сначала переиспользовать уже доступные данные профиля / lot management.

## Acceptance criteria
- суммы совпадают с ручным расчётом тестовых лотов;
- unknown stock не считается как 1;
- cost missing не считается как 0;
- inactive lots исключены из totals.

## Commit
`feat(finance): add active inventory potential calculations`
