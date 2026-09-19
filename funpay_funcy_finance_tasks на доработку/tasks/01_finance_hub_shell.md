# TASK-01 — Каркас категории «Финансы»

## Цель
Создать новую страницу Finance Hub и внутреннюю навигацию, не перенося бизнес-логику.

## Зависимости
Нет.

## Затрагиваемые файлы
- `content/ui/main_popup.js`
- `css/content_styles.css`
- возможно `content/ui/settings_loader.js`
- `config.v1.json`

## Сделать

1. Добавить основной nav item `Финансы`.
2. На странице создать subtabs:
   - Обзор
   - Продажи
   - Покупки
   - Прибыль
   - Потенциал
   - Операции
3. Добавить header:
   - title;
   - period selector;
   - last updated;
   - refresh;
   - export placeholder disabled.
4. Реализовать 12-column responsive grid primitives:
   - `.fpt-fin-grid`
   - `.fpt-fin-col-3`
   - `.fpt-fin-col-4`
   - `.fpt-fin-col-6`
   - `.fpt-fin-col-8`
   - `.fpt-fin-col-12`
5. Сделать skeleton / empty state components.
6. Existing `Копилки`, `Калькулятор`, `Валюты` не удалять.

## НЕ делать
- не переносить текущие графики;
- не менять IndexedDB;
- не добавлять себестоимость;
- не убирать статистику со страниц FunPay.

## Acceptance criteria

- Finance Hub открывается из sidebar.
- Переключение subtabs не вызывает reload страницы.
- На маленькой ширине subtabs скроллятся горизонтально.
- Не появляется horizontal overflow всего popup.
- Все существующие пункты меню продолжают работать.
- В console нет ошибок.

## Commit
`feat(finance): add finance hub shell`
