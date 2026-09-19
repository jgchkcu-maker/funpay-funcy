# TASK-05 — Плашка «Себестоимость» в редакторе лота

## Цель
Добавить пользователю удобный ввод закупочной стоимости прямо на странице FunPay.

## Зависимости
TASK-04.

## Затрагиваемые файлы
- новый: `content/features/cost_basis_editor.js`
- `content/features/buyer_price_field.js`
- `content/features/section_commission.js`
- `content/features/exact_price.js`
- `content/features/feature_registry.js`
- `css/content_styles.css`
- `manifest.json` / loader only if required by current loading pattern

## UI
Смотри `specs/UI_UX_SPEC.md`.

## Сделать

1. Detect create/edit page.
2. Existing offer:
   - получить offerId;
   - загрузить cost basis.
3. New offer:
   - сохранять draft в `sessionStorage`.
4. После успешной навигации на edit page:
   - bind draft -> offerId.
5. Live preview:
   - native seller price;
   - cost;
   - profit per unit;
   - margin.
6. Если доступен buyer price:
   - также показать buyer price, но profit считать от seller revenue.
7. Добавить пояснение:
   `Видно только вам. На FunPay не отправляется.`

## Critical
Поле не должно иметь `name`, которое попадёт в native form submit.

## Acceptance criteria
- создание нового лота;
- редактирование существующего;
- reload;
- 2 вкладки одновременно;
- очистка значения;
- FunPay save работает без изменений payload.

## Commit
`feat(finance): add cost basis field to lot editor`
