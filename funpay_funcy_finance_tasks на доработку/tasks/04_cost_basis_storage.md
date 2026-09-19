# TASK-04 — Модель и хранение себестоимости

## Цель
Добавить надёжную локальную модель себестоимости на offerId.

## Зависимости
TASK-03.

## Затрагиваемые файлы
- новый: `content/features/cost_basis_store.js`
- возможно `background/background.js`
- `config.v1.json`

## Сделать

API:

```js
window.FPTCostBasis = {
  get(offerId),
  set(offerId, data),
  remove(offerId),
  getAll(),
  import(data),
  export()
}
```

Storage schema — из `specs/FINANCE_DOMAIN_MODEL.md`.

## Правила
- пусто != 0;
- amount > 0;
- timestamp;
- currency;
- nodeId;
- source.

## Pending draft
Подготовить helpers для `sessionStorage`:
- saveDraft;
- getDraft;
- clearDraft;
- bindDraftToOffer.

## НЕ делать
Не рисовать поле на странице лота — это TASK-05.

## Acceptance criteria
- CRUD работает;
- reload сохраняет данные;
- две вкладки создания лота не конфликтуют;
- invalid data не попадает в store.

## Commit
`feat(finance): add cost basis storage model`
