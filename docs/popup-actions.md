# Пустые категории и действия окна

Окно создаёт 20 пустых `.fp-tools-page-content[data-page]` контейнеров. Сайдбар, поиск, сворачивание, маршруты, режимы разделов, перемещение и изменение размера окна продолжают работать. Названия функций и режимов для поиска находятся в `content/ui/popup_metadata.js`, поэтому поиск не зависит от элементов категории.

## Вызов действий

`window.fptPopupActions.run(pageId, actionId, payload)` возвращает Promise. Идентификаторы страниц соответствуют `data-page`. Для действий прежних кнопок `actionId` сохраняет их HTML `id`; для действий без прежней кнопки используется имя обработчика.

```js
const settings = await window.fptPopupActions.run('general', 'getSettings', {
  keys: ['hideBalance', 'fpToolsSlashCommands']
});

await window.fptPopupActions.run('general', 'saveSettings', {
  settings: { hideBalance: true }
});

const finance = await window.fptPopupActions.run('finance_hub', 'getFinanceData', {
  mode: 'sales',
  filters: { period: '7d', currency: 'RUB' }
});
```

`getSettings` принимает массив ключей Chrome Storage либо без списка возвращает весь снимок настроек. `saveSettings` принимает явно указанный объект `settings`; вложенные объекты обновляются частично, массивы заменяются целиком, другие сохранённые поля остаются нетронутыми. Одновременные записи через интерфейс действий проходят в общей очереди. Изменения автоответчика передаются отдельно в неизменённый `fptPatchAutoReplies`:

```js
await window.fptPopupActions.run('auto_reply', 'saveSettings', {
  patch: { arrayOps: { keywords: [{ op: 'append', value: {
    keyword: 'ключ', response: '', images: ['data:image/png;base64,…'], sendOrder: 'images_first'
  } }] } }
});
```

Вызов неизвестной пары `pageId` и `actionId`, неверные данные и ошибка существующей операции отклоняют Promise с ошибкой. Действия, которые прежде собирали форму, принимают значения через `payload` либо возвращают данные для будущего компонента. Например, `lot-io-export-confirm` принимает `categories`, `selectedCategoryIds` и параметры выполнения; `fp-new-ticket-submit` возвращает проверенный черновик обращения, а `fp-ticket-confirm-yes` подтверждает его отправку. Экспорт финансов возвращает `items`, агрегаты и `content` для формата `json` или `csv`; скачивание файла остаётся ответственностью нового представления.

## Категории и поиск

Полный набор поддерживаемых страниц и доступных маршрутов задаёт `FPTPopupMetadata.pages`; `fptPopupActions.list(pageId)` возвращает зарегистрированные действия. Псевдонимы и режимы (`slash_commands`, `currency_calc`, вкладки финансов и другие варианты) остаются частью `fptOpenPopupPage`. Компоненты, встраиваемые непосредственно в страницы FunPay, продолжают запускаться отдельно от пустых контейнеров окна.
