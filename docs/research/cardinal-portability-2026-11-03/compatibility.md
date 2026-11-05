# Совместимость и границы выводов

## Режим оценки

- Chrome запущен, компьютер бодрствует для своевременной работы. Вкладку FunPay можно закрыть. После сна/остановки worker требуется восстановление; при закрытом браузере работа не обещается.
- Отдельный собственный сервер и локальная программа не допускаются. Существующие сторонние API допустимы.
- Настройки/операции админ-панели Telegram разрешено перенести в Funcy. Двусторонняя переписка и удалённые уведомления считаются самостоятельными функциями: они не вычеркнуты из сравнения.
- «Полный перенос» — инженерная возможность сохранить существенное бизнес-поведение выбранной читаемой реализации. Это не исполнившийся порт и не live-гарантия API. Уверенность описывает качество доказательств, а не вероятность успешной покупки.
- Служебные JSON/product-файлы заменяются управляемым хранилищем расширения; импорт/экспорт доступен через выбор файла. Произвольный доступ к папкам ОС и метрики сервера не подразумеваются.
- Установка/обновление своего Python-плагина заменяется обычным выпуском расширения. Произвольный Python executor/удалённый loader, для которого это основная функция, оценён как требующий помощника.

## Интерпретация вердиктов

| Вердикт | Требование |
|---|---|
| полный перенос | Прочитан исходник, определён сценарий, нет выявленного обязательного недоступного транспорта/возможности; первичные контракты критических доступных API проверены. Для FunPay используются upstream source и текущая основа Funcy, а не вымышленный официальный seller API. |
| перенос с потерями | Назван конкретный потерянный сценарий/изоляция/системная информация; доступный урезанный вариант не называется полным. |
| нужен помощник/сервер | Названа фактическая зависимость от TCP-сервера, игрового клиента, произвольного Python/ОС или запуска .exe; готового равного HTTPS/WSS пути в реализации нет. |
| недостаточно данных | Нет байтов исходника, контракт внешнего провайдера недоступен, код-заглушка/неразбираемый файл либо не подтверждён весь цикл. Это не утверждение о принципиальной невозможности. |

## Что нужно сохранить при последующей реализации

- Единый fpt_engine/job_scheduler, аккаунт/epoch guard и IndexedDB-журнал; не создавать второй независимый polling loop.
- Для покупок и выдач: reserve → persisted attempt → request → known/unknown result → verify/reconcile. Таймаут после расходного запроса не разрешает слепую повторную покупку.
- Для лотов: намерение, свежая форма, проверка ожидаемых полей, общий writer и blocker resolver; ручная правка, расписание, остатки и цена не должны отменять друг друга.
- Для событий/напоминаний: дедупликация, ручные сообщения, текущий отзыв/статус, исключения, отмена задачи и восстановление после worker restart.
- Для общего склада: резерв FIFO и атомарность между заказами; stock FunPay, локальный pool и данные поставщика — разные источники.
- Для host permissions: сейчас разрешены FunPay, support, sfunpay и переводчик. Telegram/AI/поставщики потребуют новых разрешений, а OAuth — отдельной регистрации приложения и identity flow. Никакие разрешения этим исследованием не добавлены.

## Первичные источники ограничений и API

<a id="chrome-life"></a>
### MV3 service worker lifecycle

[MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). Статус: checked. Остановка worker, долговечное состояние, ограничения длительности событий.

<a id="chrome-alarms"></a>
### Chrome alarms

[Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms). Статус: checked. Задержки, сон устройства, восстановление alarm; minimum_chrome_version Funcy = 120, новый persistAcrossSessions нельзя считать доступным на всей базе.

<a id="chrome-http"></a>
### Cross-origin network requests

[Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests). Статус: checked. Исходящий HTTP из extension origin при host permissions; content scripts имеют другой контекст.

<a id="chrome-offscreen"></a>
### Offscreen documents

[Offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen). Статус: checked. DOM/Canvas в документе расширения; offscreen не даёт TCP/ОС.

<a id="chrome-proxy"></a>
### Chrome proxy

[Chrome proxy](https://developer.chrome.com/docs/extensions/reference/api/proxy). Статус: checked. Профиль браузера/PAC, не произвольный requests proxy на отдельную сессию.

<a id="chrome-dnr"></a>
### Declarative Net Request

[Declarative Net Request](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). Статус: checked. Модификация заголовков требует отдельного API/permissions; ручной Cookie в fetch не работает.

<a id="chrome-rhc"></a>
### Remote hosted code in MV3

[Remote hosted code in MV3](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code). Статус: checked. Код и WASM включаются в пакет; сетевые данные не исполняются.

<a id="chrome-identity"></a>
### Chrome identity

[Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity). Статус: checked. OAuth, отдельное разрешение identity; его сейчас нет в Funcy.

<a id="telegram-bot"></a>
### Telegram Bot API

[Telegram Bot API](https://core.telegram.org/bots/api). Статус: checked. HTTPS, getUpdates, offset и методы тем/медиа. Удалённое управление можно сохранить пока браузер работает.

<a id="telegram-mtproto"></a>
### MTProto transports

[MTProto transports](https://core.telegram.org/mtproto/transports). Статус: checked. Официально есть WSS/HTTPS; Pyrogram не означает обязательный сервер.

<a id="telegram-stars"></a>
### payments.sendStarsForm

[payments.sendStarsForm](https://core.telegram.org/method/payments.sendStarsForm). Статус: checked. Пользовательский платёж не эквивалентен отправке подарка от бота.

<a id="rfc6238"></a>
### RFC 6238 TOTP

[RFC 6238 TOTP](https://www.rfc-editor.org/rfc/rfc6238). Статус: checked. Проверен HMAC-SHA1 тестовый вектор; Steam-алфавит и бизнес-доступ отдельно.

<a id="openrouter"></a>
### OpenRouter HTTP API

[OpenRouter HTTP API](https://openrouter.ai/docs/api/reference/overview). Статус: checked. Chat Completions, messages и выбор модели.

<a id="gemini"></a>
### Gemini OpenAI compatibility

[Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai). Статус: checked. Gemini REST / OpenAI-совместимый HTTP; API-ключ пользователя.

<a id="slack"></a>
### Slack incoming webhooks

[Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/). Статус: checked. Исходящий JSON POST к webhook URL.

<a id="discord"></a>
### Discord webhook resource

[Discord webhook resource](https://docs.discord.com/developers/resources/webhook). Статус: checked. Execute webhook, исходящий HTTP; сервер-получатель от разработчика Funcy не нужен.

<a id="graph"></a>
### Microsoft Graph mail

[Microsoft Graph mail](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0). Статус: checked. Чтение сообщений по HTTPS с делегированным доступом; OAuth не равен универсальному IMAP.

<a id="dessly-auth"></a>
### DesslyHub Introduction

[DesslyHub Introduction](https://desslyhub.readme.io/reference/introduction). Статус: checked. apikey для legacy; после отправки нужно отдельно проверять статус.

<a id="dessly-gift"></a>
### DesslyHub Steam Gift

[DesslyHub Steam Gift](https://desslyhub.readme.io/reference/post_apiv1steamgift). Статус: checked. POST /api/v1/service/steamgift/sendgames, invite_url/package_id/region/reference.

<a id="dessly-status"></a>
### DesslyHub transaction status

[DesslyHub transaction status](https://desslyhub.readme.io/reference/get_apiv1statustransaction_id). Статус: checked. GET /api/v1/merchants/transaction/{transaction_id}/status.

<a id="dessly-mobile"></a>
### DesslyHub mobile catalog

[DesslyHub mobile catalog](https://desslyhub.readme.io/reference/get_apiv1servicemobilevariantvariantgamesid). Статус: checked. Каталог/поля legacy доступны; это не доказательство нового HMAC v2.

<a id="dessly-v2"></a>
### DesslyHub v2 specification

[DesslyHub v2 specification](https://desslyhub.readme.io/llms.txt). Статус: unavailable. Индекс недоступен; попытки /api/v2/openapi.json, /docs и /swagger.json завершились TLS timeout. Никакой платёжный endpoint не вызывался.

<a id="tonapi"></a>
### TonAPI blockchain REST

[TonAPI blockchain REST](https://docs.tonapi.io/tonapi/rest-api/blockchain). Статус: checked. sendBlockchainMessage и поиск транзакции по hash; OpenAPI tonapi.io/v2/openapi.json прочитан.

<a id="lzt"></a>
### LZT Fast Buy

[LZT Fast Buy](https://lzt-market.readme.io/reference/purchasingfastbuy). Статус: checked. POST /{item_id}/fast-buy, price, balance_id; подтверждение дополнительных методов остаётся отдельной задачей.

<a id="lzt-limits"></a>
### LZT API information

[LZT API information](https://lzt-market.readme.io/reference/information). Статус: checked. Лимиты и схемы HTTP, дополнительные методы писем имеют отдельные ограничения.

<a id="ns-docs"></a>
### NS.Gifts docs

[NS.Gifts docs](https://api.ns.gifts/docs). Статус: unavailable. HTTP 410; /openapi.json также 410. Текущий полный контракт не установлен.

<a id="smmway-docs"></a>
### SMMWay API docs

[SMMWay API docs](https://smmway.ru/api). Статус: unavailable. HTTP 404; действующий контракт панели нельзя восстановить по одной рекламной странице.

<a id="fragment-api"></a>
### Fragment API docs

[Fragment API docs](https://fragment-api.com/docs). Статус: unavailable. Получена оболочка сайта, не полная спецификация авторизации и покупок.

<a id="license"></a>
### GitHub licensing documentation

[GitHub licensing documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository). Статус: checked. Публичность репозитория не означает разрешения переносить код без лицензии.

<a id="cardinal-source"></a>
### Upstream Cardinal/FunPayAPI

[Upstream Cardinal/FunPayAPI](https://github.com/sidor0912/FunPayCardinal/blob/main/FunPayAPI/account.py). Статус: checked. Первичный исходник send_review/refund/forms; это не официальный API-контракт FunPay.

<a id="durak-source"></a>
### Durak transport implementation

[Durak transport implementation](https://github.com/Zakovskiy/durakonline.py/blob/main/durakonline/socket_listener.py). Статус: checked. Прямые socket.AF_INET/SOCK_STREAM, не WebSocket.

## Лицензии

Лицензия проверяется отдельно от технического вердикта. MIT-материал можно использовать с выполнением условий лицензии; GPL/AGPL требуют отдельного решения о соблюдении их условий при распространении производного кода. Публичный файл без установленной лицензии не считается разрешением на копирование. Приоритетный путь для неясных лицензий — самостоятельная реализация описанного поведения. Этот отчёт не переносит чужие модули в runtime Funcy.
