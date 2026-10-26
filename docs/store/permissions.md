# Разрешения Funcy 0.9.11

| Разрешение | Назначение |
| --- | --- |
| storage | Локальные настройки, конфиги аккаунтов, отметки обработки и сроки заданий |
| cookies | Работа с действующей сессией FunPay, ручное добавление, проверка и переключение аккаунтов |
| alarms | Фоновые проверки и сохранённые сроки автоматики |
| offscreen | Разбор HTML через DOM_PARSER; документ закрывается после завершения текущих разборов |

Разрешения `tabs` и `background` удалены. Секция `manifest.background` с service worker сохранена. Используются tabs.query/create/update/reload/sendMessage; специальных возможностей tabs, требующих этого разрешения, не применяется. Доступ к адресам вкладок FunPay покрывает host permission.

| Host | Использование |
| --- | --- |
| funpay.com и *.funpay.com | Страницы, чат, лоты, заказы, финансы, cookies с разными доменными областями, поддержка |
| sfunpay.com и *.sfunpay.com | Совместимость доменов cookies и ресурсов FunPay; wildcard оставлен до живой проверки областей cookies |
| support.funpay.com | Оформление и работа с поддержкой FunPay |
| translate.googleapis.com | Перевод выбранных полей |
| raw.githubusercontent.com | Данные каталога тем; content script использует обычный CORS-запрос с credentials: omit |
| fonts.googleapis.com и fonts.gstatic.com | Выбранные пользователем шрифты |

CDN jsDelivr исключён. Каталог не перенесён в background. Реальный CORS-запрос из FunPay в этой задаче не выполнялся; его необходимо проверить по ручной инструкции. Внешние картинки, CSS и JSON не являются удалённым JS/WASM. Статическая проверка пакета ищет конкретные отключённые endpoints и исполняемые импорты; совпадение домена в миграции само по себе не блокирует сборку.

Основания для MV3: [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms), [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen). Сверено 26 октября 2026 года. Не используются параметры, появившиеся после Chrome 120, например persistAcrossSessions.
