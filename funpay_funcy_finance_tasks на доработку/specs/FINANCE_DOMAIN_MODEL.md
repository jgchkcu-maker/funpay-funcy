# FINANCE DOMAIN MODEL

## 1. Термины

### Native seller price
Текущее значение нативного `input[name="price"]` FunPay.

В текущем Funcy:
`buyer_price_field.js` использует его как базовую цену продавца и рассчитывает цену покупателя через multiplier.

### Buyer price
Сколько заплатит покупатель.
Определяется через:
- `/lots/calc`
- либо `FPTCommission.getMultiplier(nodeId)`.

### Cost basis
Себестоимость одной единицы, введённая пользователем.

### Stock
Количество доступных единиц.
Не делать предположение `missing stock = 1`.

---

## 2. Storage schema

MVP можно хранить в `chrome.storage.local`, поскольку объём значительно меньше истории заказов.

Key:
`fpToolsCostBasis`

Value:

```js
{
  version: 1,
  offers: {
    "<offerId>": {
      offerId: "123456",
      nodeId: "789",
      amount: 600.00,
      currency: "RUB",
      updatedAt: 1780000000000,
      source: "manual"
    }
  }
}
```

Не хранить `0` как реальную себестоимость.
Удаление значения = удалить запись.

---

## 3. Pending draft для нового лота

Новый лот не имеет offerId до сохранения.

Использовать `sessionStorage`, например:

`fptCostBasisDraft`

```js
{
  nodeId: "789",
  amount: 600,
  currency: "RUB",
  createdAt: Date.now()
}
```

После redirect на страницу редактирования с новым `offer_id`:
- проверить draft;
- убедиться, что nodeId соответствует;
- привязать к offerId;
- удалить draft.

Добавить TTL, например 2 часа.

Не использовать один global pending key в `chrome.storage.local`, иначе две вкладки создания лотов будут конфликтовать.

---

## 4. Profit formulas

### Potential buyer GMV
`buyerPrice * stock`

### Potential seller revenue
`nativeSellerPrice * stock`

### Inventory cost
`costBasis * stock`

### Potential net profit
`(nativeSellerPrice - costBasis - extraUnitExpense) * stock`

В MVP:
`extraUnitExpense = 0`.

### Margin
`profit / nativeSellerPrice * 100`

### ROI
`profit / costBasis * 100`

Если denominator <= 0 — `—`.

---

## 5. Historical realised profit

Правило:
**не применять сегодняшнюю себестоимость задним числом автоматически.**

Правильная архитектура:
при появлении нового заказа/продажи фиксировать snapshot:

```js
{
  ...
  offerId: "123456",             // только если точно получен
  costBasisSnapshot: 600,
  costBasisCurrency: "RUB",
  costBasisCapturedAt: 178...
}
```

Если старый заказ не имеет snapshot:
- profit = unknown;
- не включать в aggregate net profit;
- можно показать `Себестоимость не определена`.

Допустим fallback только если пользователь явно согласился применить текущую себестоимость к старой истории. В MVP такого fallback лучше не делать.

---

## 6. Coverage

Обязательно считать:

- orders with known cost / eligible orders;
- revenue with known cost / total revenue.

Показывать:
`Покрытие себестоимостью: 73% оборота`.

Это защищает от ложной «чистой прибыли».

---

## 7. Валюты

Не смешивать RUB / USD / EUR без явного преобразования.

MVP:
- агрегировать по валютам отдельно;
- в общем KPI основной валюты использовать только данные этой валюты;
- остальные выводить secondary chips.

Если в будущем нужна конвертация:
- фиксировать использованный FX rate и timestamp;
- не применять примерные константы для бухгалтерского показателя чистой прибыли.

---

## 8. Unlimited / unknown stock

Такие лоты:
- показывать в таблице;
- `Потенциальная выручка = —`;
- `Потенциальная прибыль = —`;
- не включать в totals;
- учитывать отдельным count badge.

---

## 9. Refunds

Возвращённые заказы:
- не формируют realised revenue;
- cost handling зависит от того, вернулся ли товар;
- в MVP исключить из realised profit и показывать отдельно.

Не вычитать себестоимость повторно без достоверной бизнес-логики.
