# Карточки и доказательства

Каждая карточка отделяет наблюдение в исходнике от инженерного вывода. Полный код чужих плагинов не включён в отчёт; доступны ссылки с commit/blob и строками.

<a id="p001"></a>
## P001 — ADSync (FunPay Auto-Delivery Sync)

- **Сценарий:** Группы лотов с общим содержимым встроенной автовыдачи, распространение пополнений и списаний.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p001). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Чтение/запись форм FunPay и сравнение списков переносимы; обязательны общий журнал резерва, последовательная запись и сверка продаж.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует как общий пул нескольких лотов
- **Сложность:** высокая; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `b1dcc8f7b09c256219709eb62b5a4ab9ee211478`, blob `c93f89bf507ee41b503dacd9ba538274f2ba47cd`.
- **Точки проверки кода:** [sync_group:242](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L242), [_sync_all:304](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L304), [_sync_group_thread:325](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L325), [new_order_handler:353](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L353), [_sync_loop:373](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L373), [sync_now:595](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L595), [BIND_TO_PRE_INIT:793](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L793), [BIND_TO_NEW_ORDER:794](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L794), [BIND_TO_DELETE:795](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py#L795).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ADSync (FunPay Auto-Delivery Sync) 1.0.0](https://github.com/yungspiderq/FPC-ADSync/blob/b1dcc8f7b09c256219709eb62b5a4ab9ee211478/ad_sync.py), blob `c93f89bf507e`, мест 1.

<a id="p002"></a>
## P002 — BalanceGuard (Balance Watchdog & Alerts)

- **Сценарий:** Контроль доступного/общего баланса по валютам, суточная разница, низкий баланс и неожиданные списания.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p002). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** полный перенос. Данные финансов уже читаются Funcy; снимки, пороги и журнал долговечны. Telegram-алерты можно сохранить отдельным Bot API вызовом.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: финансы есть; пороговые алерты отсутствуют
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, configparser, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `fb9c3d91ccc99482aa618303cdfb76800dc7dfe1`, blob `d0b66bf59c4751474a6760b9d8c71f6ea7be678b`.
- **Точки проверки кода:** [balance_to_dict:213](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L213), [format_balance:237](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L237), [fetch_balance:249](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L249), [process_balance:270](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L270), [check_loop:341](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L341), [send_balance:373](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L373), [BIND_TO_PRE_INIT:471](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L471), [BIND_TO_POST_START:472](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L472), [BIND_TO_DELETE:473](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py#L473).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [BalanceGuard (Balance Watchdog & Alerts) 1.1.0](https://github.com/yungspiderq/FPC-BalanceGuard/blob/fb9c3d91ccc99482aa618303cdfb76800dc7dfe1/balance_guard.py), blob `d0b66bf59c47`, мест 1.

<a id="p003"></a>
## P003 — ChatGuard (Unanswered Chats)

- **Сценарий:** Просроченный ответ покупателю, порог ожидания, повторные оповещения, сброс после ответа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p003). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. События чата и сохранённые timestamps; alerts в интерфейсе и через Bot API доступны при открытом браузере.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует как контроль времени ответа
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `5a67f4ab168f4af0120a4ed12a176dd062e39f6c`, blob `6c2173793863939df5c1aa5601e900f3696e4de6`.
- **Точки проверки кода:** [new_message_handler:154](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py#L154), [_guard_tick:207](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py#L207), [BIND_TO_PRE_INIT:451](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py#L451), [BIND_TO_NEW_MESSAGE:452](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py#L452), [BIND_TO_DELETE:453](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py#L453).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ChatGuard (Unanswered Chats) 1.0.1](https://github.com/yungspiderq/FPC-ChatGuard/blob/5a67f4ab168f4af0120a4ed12a176dd062e39f6c/chat_guard.py), blob `6c2173793863`, мест 1.

<a id="p004"></a>
## P004 — CompetitorWatch (Price & Position Intel)

- **Сценарий:** Отслеживание цены и позиции по разделам, новые продавцы и оповещения об изменении.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p004). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. HTTP-чтение публичных предложений и сравнение снимков; отделить наблюдение от автоматического изменения цен.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: аналитика рынка; постоянного мониторинга нет
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-CompetitorWatch/blob/c40640e3c42b4e05149bcf97498f38e67557d07d/competitor_watch.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `c40640e3c42b4e05149bcf97498f38e67557d07d`, blob `03bc5f023fc04d36ef5d581e777a965acb1cf87d`.
- **Точки проверки кода:** [_watch_tick:328](https://github.com/yungspiderq/FPC-CompetitorWatch/blob/c40640e3c42b4e05149bcf97498f38e67557d07d/competitor_watch.py#L328), [BIND_TO_PRE_INIT:680](https://github.com/yungspiderq/FPC-CompetitorWatch/blob/c40640e3c42b4e05149bcf97498f38e67557d07d/competitor_watch.py#L680), [BIND_TO_DELETE:681](https://github.com/yungspiderq/FPC-CompetitorWatch/blob/c40640e3c42b4e05149bcf97498f38e67557d07d/competitor_watch.py#L681).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [CompetitorWatch (Price & Position Intel) 1.0.0](https://github.com/yungspiderq/FPC-CompetitorWatch/blob/c40640e3c42b4e05149bcf97498f38e67557d07d/competitor_watch.py), blob `03bc5f023fc0`, мест 1.

<a id="p005"></a>
## P005 — PriceDumper

- **Сценарий:** Конкуренты, белый список продавцов, минимальная цена, снижение без повышения, журнал и ручной запуск.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p005). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Сканирование публичных лотов и изменение своей формы выполняются HTTP; правила и журнал сохраняются в IndexedDB. Нужны свежая форма и общий lot writer.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: расчёт цен есть; сравнения с конкурентами нет
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/price_dumper_fpc.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `ad57eef865a7a9696481ad74f71deb9be927d1b3`.
- **Точки проверки кода:** [_process_rule:690](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/price_dumper_fpc.py#L690), [BIND_TO_PRE_INIT:1220](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/price_dumper_fpc.py#L1220), [BIND_TO_DELETE:1221](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/price_dumper_fpc.py#L1221).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [PriceDumper 1.0.1](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/price_dumper_fpc.py), blob `ad57eef865a7`, мест 1.

<a id="p006"></a>
## P006 — ProductDoctor (Product Files Doctor)

- **Сценарий:** Поиск дублей, пустых строк и пробелов в товарных списках; preview, очистка, резервная копия.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p006). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Обработка текста и локальные резервные копии полностью доступны. Рабочее хранилище расширения заменяет служебные product-файлы.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует как инструмент проверки пула
- **Сложность:** средняя; приоритет 1; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Utils, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `aa737680158253ba01c8826c374daa0f17715290`, blob `ab40c4ba8872d85dab1153225292d4d99480cea7`.
- **Точки проверки кода:** [_auto_check_tick:310](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py#L310), [_auto_check_loop:342](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py#L342), [toggle_autocheck:576](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py#L576), [BIND_TO_PRE_INIT:653](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py#L653), [BIND_TO_DELETE:654](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py#L654).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ProductDoctor (Product Files Doctor) 1.0.1](https://github.com/yungspiderq/FPC-ProductDoctor/blob/aa737680158253ba01c8826c374daa0f17715290/product_doctor.py), blob `ab40c4ba8872`, мест 1.

<a id="p007"></a>
## P007 — Sales Manager

- **Сценарий:** Локальный склад, резерв, выдача, замены/возвраты, шаблоны, команды и почта через Microsoft Graph.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p007). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Основные бизнес-сценарии состоят из HTTP и локальных структур. Служебные JSON-файлы заменяются IndexedDB, Graph/OAuth — HTTP; установка Python/Docker заменяется выпуском расширения.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: журнал и выдача есть; локальный пул и замены неполны
- **Сложность:** высокая; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** sm_parts. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `81be4e29cba480f521a4c5da00db6f8e07e2d690`, blob `ab49cbf18ec1a29409147dfa9052b4d8d7ef994c`.
- **Точки проверки кода:** [BIND_TO_DELETE:17](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py#L17), [BIND_TO_PRE_INIT:20](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py#L20), [BIND_TO_POST_INIT:21](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py#L21), [BIND_TO_NEW_ORDER:22](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py#L22).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [graph](compatibility.md#graph).
- **Версии и копии:** [Sales Manager 1.0.0](https://github.com/CriDos/sales_manager_plugin/blob/81be4e29cba480f521a4c5da00db6f8e07e2d690/sales_manager/sales_manager.py), blob `ab49cbf18ec1`, мест 1.

<a id="p008"></a>
## P008 — SalesFunnel (Chat-to-Sale Conversion)

- **Сценарий:** Учёт новых чатов и заказов, конверсия по периодам, выручка и сброс статистики.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p008). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Журнал событий и агрегирование на стороне расширения. Исторические чаты до включения не восстанавливаются произвольно — это ограничение исходника тоже.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует как воронка чат → покупка
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `3a16c561164e36d0de6ec4bdda4346efd4fa9db5`, blob `a287f2ac67f2fb67c2dcb18ce999a042011efb15`.
- **Точки проверки кода:** [new_message_handler:166](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L166), [new_order_handler:194](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L194), [BIND_TO_PRE_INIT:376](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L376), [BIND_TO_NEW_MESSAGE:377](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L377), [BIND_TO_NEW_ORDER:378](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L378), [BIND_TO_DELETE:379](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py#L379).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SalesFunnel (Chat-to-Sale Conversion) 1.0.0](https://github.com/yungspiderq/FPC-SalesFunnel/blob/3a16c561164e36d0de6ec4bdda4346efd4fa9db5/sales_funnel.py), blob `a287f2ac67f2`, мест 1.

<a id="p009"></a>
## P009 — StockMonitor (Product Stock Monitor)

- **Сценарий:** Порог остатка по товару, критический ноль и сводка заканчивающихся товаров.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p009). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Локальные пулы/снимки склада и сохранённые пороги; при переносе файловые списки становятся управляемым складом в IndexedDB.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: остатки показываются; пороговых алертов нет
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Utils, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `2e4e57fc7ab67b158be3959df83da17419543552`, blob `0ab4944a7fece1a1637cac34f184b4c451208a61`.
- **Точки проверки кода:** [_monitor_tick:241](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py#L241), [check_now:515](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py#L515), [BIND_TO_PRE_INIT:703](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py#L703), [BIND_TO_DELETE:704](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py#L704).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [StockMonitor (Product Stock Monitor) 1.0.1](https://github.com/yungspiderq/FPC-StockMonitor/blob/2e4e57fc7ab67b158be3959df83da17419543552/stock_monitor.py), blob `0ab4944a7fec`, мест 1.

<a id="p010"></a>
## P010 — StockSync (Auto-Delivery Lot Sync)

- **Сценарий:** Синхронизация наличия лотов с локальным товарным списком, после выдачи и по таймеру; диагностика привязок.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p010). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Управляемый склад и общий lot writer заменяют файлы и запись формы; необходимо сохранить принадлежность блокировок, а не включать любой неактивный лот.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: чтение остатков есть; управление общим пулом отсутствует
- **Сложность:** высокая; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Utils, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5`, blob `a4f7138ff262d479e33dcff40163106982d736ce`.
- **Точки проверки кода:** [_lots_to_sync:195](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L195), [sync_lot:220](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L220), [full_sync:260](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L260), [post_delivery_handler:330](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L330), [_delivery_sync_worker:353](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L353), [_sync_loop:362](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L362), [sync_now:518](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L518), [toggle_delivery:535](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L535), [BIND_TO_PRE_INIT:617](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L617), [BIND_TO_POST_DELIVERY:618](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L618), [BIND_TO_DELETE:619](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py#L619).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [StockSync (Auto-Delivery Lot Sync) 1.0.1](https://github.com/yungspiderq/FPC-StockSync/blob/438e9001915ccdd2c0c8b48078e4d6bb7d1a34b5/stock_sync.py), blob `a4f7138ff262`, мест 1.

<a id="p011"></a>
## P011 — UnansweredReminder

- **Сценарий:** Напоминание продавцу о чатах без ответа, пороги и повторные сигналы.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p011). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Проверка входящего/ручного исходящего сообщения и долговечные timestamps; алерты сохраняются через UI или Bot API.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** plugins, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `08265d377f1d2d7e59f41e83f48180201fb5ddc5`, blob `a503c935085ff136d2967f060122d69bf7d4dcd6`.
- **Точки проверки кода:** [_classify_sender:485](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L485), [_dialog_last_sender:513](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L513), [_last_sender:537](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L537), [_check_loop:579](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L579), [_check_dialogs:595](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L595), [_process_buyer_chat:657](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L657), [_check_notify:682](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L682), [_send_notification:704](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L704), [BIND_TO_PRE_INIT:1765](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L1765), [BIND_TO_POST_INIT:1766](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L1766), [BIND_TO_NEW_ORDER:1767](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L1767), [BIND_TO_NEW_MESSAGE:1768](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py#L1768).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [UnansweredReminder 1.0.1](https://github.com/zap90a/UnansweredReminder/blob/08265d377f1d2d7e59f41e83f48180201fb5ddc5/UnansweredReminder.py), blob `a503c935085f`, мест 1.

<a id="p012"></a>
## P012 — VOLT Watch

- **Сценарий:** Наблюдение за пропавшими/неактивными лотами, список ID, журнал и оповещение.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p012). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Проверка профиля/формы HTTP, снимок и сохранённое состояние. Не требуется восстанавливать лоты автоматически.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: лоты читаются; сторожа с алертами нет
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** t.me.
- **Версия доказательства:** commit `3391114cfab77f440ebd33e8e9001e8ae2f22b6b`, blob `a089302e3a4b7d32bf1143c0b7482da442c28765`.
- **Точки проверки кода:** [check:48](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py#L48), [BIND_TO_PRE_INIT:117](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py#L117), [BIND_TO_POST_INIT:118](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py#L118), [BIND_TO_DELETE:119](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py#L119).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [VOLT Watch 1.0.0](https://github.com/Mamrokii/volt-watch-funpay-cardinal/blob/3391114cfab77f440ebd33e8e9001e8ae2f22b6b/volt_watch.py), blob `a089302e3a4b`, мест 1.

<a id="p013"></a>
## P013 — Монитор позиций

- **Сценарий:** Позиции лотов, падение цены, исчезновение предложения, журнал и утренняя сводка.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p013). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** полный перенос. Публичные страницы FunPay и локальные снимки; сравнение и уведомления доступны без серверного процесса.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: аналитика рынка есть; наблюдение с оповещениями отсутствует
- **Сложность:** средняя; приоритет 1; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, lxml, requests. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `0089df6e3dca20f66315ed271915a477ad490d13`, blob `4ce581c5aba8061e9727dc293944bbbea51640bc`.
- **Точки проверки кода:** [_send_tg:482](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L482), [_process_lot:529](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L529), [_run_check_cycle:677](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L677), [BIND_TO_DELETE:48](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L48), [BIND_TO_PRE_INIT:906](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L906), [BIND_TO_POST_START:907](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L907), [BIND_TO_PRE_STOP:908](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py#L908).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Монитор позиций 1.1.0](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/position-monitor/monitor_positions.py), blob `4ce581c5aba8`, мест 1.

<a id="p014"></a>
## P014 — AI Auto Reply (OpenRouter)

- **Сценарий:** OpenRouter-автоответчик, передача диалога продавцу, пауза после ручного сообщения.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p014). Вердикт относится к выбранной версии 1.1.1.
- **Вердикт:** полный перенос. Документированный HTTP, локальный контекст и состояние handoff/паузы; ключ остаётся в фоне.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: обычный автоответчик, без AI
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py), версия 1.1.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, github.com, openrouter.ai.
- **Версия доказательства:** commit `8c509f8db062637ff10a290d156423d7b8af277e`, blob `3eea91a044088bf2bf52b759382eca7ace87340b`.
- **Точки проверки кода:** [_send_funpay:165](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L165), [_generate_answer:289](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L289), [_process_message:324](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L324), [new_message_handler:355](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L355), [initial_chat_handler:399](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L399), [BIND_TO_DELETE:26](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L26), [BIND_TO_PRE_INIT:559](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L559), [BIND_TO_INIT_MESSAGE:560](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L560), [BIND_TO_NEW_MESSAGE:561](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py#L561).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AI Auto Reply (OpenRouter) 1.1.1](https://github.com/weekendft/FunPayCardinal/blob/8c509f8db062637ff10a290d156423d7b8af277e/plugins/ai_autoreply.py), blob `3eea91a04408`, мест 1.

<a id="p015"></a>
## P015 — AI Chat Plugin

- **Сценарий:** AI-консультант по товарам, контекст диалога, правила, исключения и остановка при ручном ответе.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p015). Вердикт относится к выбранной версии 2.1.0.
- **Вердикт:** полный перенос. Документированный OpenRouter HTTP и состояние чатов; сохранить всю конфигурацию и границы ручного вмешательства.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: автоответы и история, без AI
- **Сложность:** высокая; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py), версия 2.1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, configparser, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.anthropic.com, api.deepseek.com, api.openai.com, api.together.xyz, generativelanguage.googleapis.com, openrouter.ai, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `15856f8cfe845a659ad474cd5f5dbb14cb13e7df`.
- **Точки проверки кода:** [_send_startup_welcome:288](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L288), [_load_buyer_context:1462](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1462), [_save_buyer_context:1474](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1474), [_update_buyer_context:1484](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1484), [_get_buyer_context_text:1499](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1499), [_claim_message_for_processing:1595](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1595), [_check_spam:1736](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1736), [_check_stop_words:1810](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L1810), [BIND_TO_DELETE:31](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L31), [BIND_TO_NEW_MESSAGE:3938](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L3938), [BIND_TO_LAST_CHAT_MESSAGE_CHANGED:3939](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L3939), [BIND_TO_PRE_INIT:6772](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py#L6772).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AI Chat Plugin 2.1.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_chat_plugin.py), blob `15856f8cfe84`, мест 1.

<a id="p016"></a>
## P016 — AIReviews

- **Сценарий:** Генерация ответов на отзывы, фильтр оценок, основной и резервный AI-провайдеры, кулдауны, сообщение в чат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p016). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. OpenRouter/OpenAI-совместимый HTTP и Gemini REST доступны из worker с разрешениями; сохраняются промпт, fallback и ручное вмешательство.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: шаблонные ответы и бонусы уже есть; AI-провайдеры отсутствуют
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, configparser, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.openai.com, generativelanguage.googleapis.com, openrouter.ai, proxy6.net, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `d77ffa39208b2f08f9c6b8ed8df4d2af36abd1ab`.
- **Точки проверки кода:** [_buyer_key:840](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L840), [_send_buyer:862](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L862), [_generate_reply:873](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L873), [_send_review_with_retries:893](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L893), [_process_feedback:913](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L913), [_maybe_send_chat_thanks:1004](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L1004), [BIND_TO_PRE_INIT:1427](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L1427), [BIND_TO_NEW_MESSAGE:1428](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L1428), [BIND_TO_DELETE:1429](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py#L1429).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AIReviews 1.0.1](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ai_reviews_fpc.py), blob `d77ffa39208b`, мест 1.

<a id="p017"></a>
## P017 — Auto Confirm Reminder

- **Сценарий:** Отложенное напоминание подтвердить заказ, исключения и проверка статуса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p017). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Сохранённый dueAt и свежая проверка заказа; эта задача отличается от просьбы об отзыве.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: напоминания об отзыве, нет полного аналога подтверждения
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae`, blob `72b4ae29af645bac9b654770928939f3d6ab7f1a`.
- **Точки проверки кода:** [_build_replacements:140](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L140), [process_text:175](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L175), [_send_reminder:188](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L188), [BIND_TO_PRE_INIT:609](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L609), [BIND_TO_POST_INIT:610](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L610), [BIND_TO_NEW_MESSAGE:611](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L611), [BIND_TO_ORDER_STATUS_CHANGED:612](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py#L612).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Confirm Reminder 1.0.0](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Confirm-Reminder/blob/96c9514c03b36ba8cdaedc0085870d2ae2c4f6ae/auto_confirm_reminder.py), blob `72b4ae29af64`, мест 1.

<a id="p018"></a>
## P018 — BuyerGuard (Buyer Risk & Blacklist)

- **Сценарий:** Риск покупателя, blacklist, история возвратов, предупреждения и опциональный возврат заказа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p018). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Доступные факты FunPay и локальные правила; нельзя выдавать локальную эвристику за общую репутационную базу всех продавцов.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: blacklist и история; правила риска отсутствуют
- **Сложность:** высокая; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `4748a5a73a51381ad5e5a8666d28ecad95cf78b8`, blob `377dd6682fc9afdb4e483ffc03bebf4cb843974b`.
- **Точки проверки кода:** [_is_refunded:198](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L198), [new_order_handler:218](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L218), [_check_banned:249](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L249), [_guard_tick:321](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L321), [_refund_scan:376](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L376), [manual_check:409](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L409), [act_check:575](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L575), [BIND_TO_PRE_INIT:703](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L703), [BIND_TO_NEW_ORDER:704](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L704), [BIND_TO_DELETE:705](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py#L705).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [BuyerGuard (Buyer Risk & Blacklist) 1.0.0](https://github.com/yungspiderq/FPC-BuyerGuard/blob/4748a5a73a51381ad5e5a8666d28ecad95cf78b8/buyer_guard.py), blob `377dd6682fc9`, мест 1.

<a id="p019"></a>
## P019 — ChatGPT Accounts Auto Delivery

- **Сценарий:** Загрузка аккаунтов текстом/файлом, очередь, привязка лота и выдача после оплаты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p019). Вердикт относится к выбранной версии 1.3.0.
- **Вердикт:** полный перенос. Не требует автоматизации ChatGPT: выдаются подготовленные строки. Файловый импорт заменяется выбором файла, пул — IndexedDB.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: автовыдача; общего локального пула нет
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/chatgpt_accounts.py), версия 1.3.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `983deb72a270c02a31ca3ad3baa5865718fd445f`, blob `621d59d58f827e7e7b0ea3a389b760ea934838d7`.
- **Точки проверки кода:** [_send_accounts:312](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/chatgpt_accounts.py#L312), [BIND_TO_INIT:598](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/chatgpt_accounts.py#L598), [BIND_TO_NEW_ORDER:599](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/chatgpt_accounts.py#L599).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ChatGPT Accounts Auto Delivery 1.3.0](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/chatgpt_accounts.py), blob `621d59d58f82`, мест 1.

<a id="p020"></a>
## P020 — Claude Accounts Auto Delivery

- **Сценарий:** Пул строк аккаунтов Claude, выдача после оплаты и один ручной бонус за отзыв.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p020). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Это учёт и отправка готовых данных, без входа в Claude; очередь и отметки выдачи доступны в IndexedDB.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: обычная выдача есть; независимого FIFO пула нет
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `983deb72a270c02a31ca3ad3baa5865718fd445f`, blob `96715cb307d19ab694e7343c60ff52dc6a9f4162`.
- **Точки проверки кода:** [_default:29](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L29), [_load:43](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L43), [_save:58](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L58), [_keyboard:65](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L65), [BIND_TO_INIT:311](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L311), [BIND_TO_NEW_ORDER:312](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L312), [BIND_TO_NEW_MESSAGE:313](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py#L313).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Claude Accounts Auto Delivery 1.0.0](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/claude_accounts.py), blob `96715cb307d1`, мест 1.

<a id="p021"></a>
## P021 — DailyDigest (Morning Shop Digest)

- **Сценарий:** Утренняя сводка: вчерашние продажи, сравнение периодов, активные заказы, остатки и баланс.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p021). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Агрегирование имеющихся данных, сохранённая задача и UI/Telegram доставка; при пробуждении выполнить пропущенную сводку один раз.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: все основные данные есть, единой сводки нет
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `668819e426f3a3291e434db7fd361d6e7b100944`, blob `fc0bcdd997152afee519d34cc6f5ca5ee87dbf88`.
- **Точки проверки кода:** [_send_digest_now:355](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py#L355), [send_now:459](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py#L459), [BIND_TO_PRE_INIT:558](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py#L558), [BIND_TO_DELETE:559](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py#L559).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [DailyDigest (Morning Shop Digest) 1.0.1](https://github.com/yungspiderq/FPC-DailyDigest/blob/668819e426f3a3291e434db7fd361d6e7b100944/daily_digest.py), blob `fc0bcdd99715`, мест 1.

<a id="p022"></a>
## P022 — List Old Orders Plugin

- **Сценарий:** Поиск открытых продаж старше 24 часов, список и ссылки на заказы.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p022). Вердикт относится к выбранной версии 0.0.5.
- **Вердикт:** полный перенос. Постраничное чтение заказов и сравнение времени; возобновляемое чтение вместо длинного потока.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: список и проблемные заказы есть; отдельный возрастной фильтр проверить
- **Сложность:** низкая; приоритет 2; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/list_old_orders.py), версия 0.0.5; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `df1b0ce7bd7e8f9d5352b856087d18158f047f84`.
- **Точки проверки кода:** [send_orders:85](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/list_old_orders.py#L85), [BIND_TO_PRE_INIT:115](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/list_old_orders.py#L115), [BIND_TO_DELETE:116](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/list_old_orders.py#L116).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [List Old Orders Plugin 0.0.5](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/list_old_orders.py), blob `df1b0ce7bd7e`, мест 1; [List Old Orders Plugin 0.0.4](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/list_old_orders.py), blob `a3507f6fdde5`, мест 1; [List Old Orders Plugin 0.0.4](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/list_old_orders.py), blob `785c5ae1bb66`, мест 1; [List Old Orders Plugin 0.0.3](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/list_old_orders.py), blob `a646266ce22b`, мест 4; [List Old Orders Plugin 0.0.3](https://github.com/neclown-byte/fpc/blob/0ead1bb3a4e75fc07f9b85c6797505a3f499f4fc/plugins/list_old_orders.py), blob `63d11924edf4`, мест 1; [List Old Orders Plugin 0.0.2](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/list_old_orders.py), blob `38cf072cb651`, мест 6; [List Old Orders Plugin 0.0.1](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/list_old_orders.py), blob `18c10cd14867`, мест 1.
- **Telegram-публикации:** [list_old_orders.py](https://t.me/cloudecode/24), [list_old_orders.py](https://t.me/fpc_plugins/56), [list_old_orders.py](https://t.me/fpc_plugins/108), [list_old_orders.py](https://t.me/fpc_plugins/135), [list_old_orders.py](https://t.me/fpc_plugins/150). Байты вложений не сравнивались.

<a id="p023"></a>
## P023 — LotCopier (Bulk Lot Settings Copy)

- **Сценарий:** Копирование полей, встроенной выдачи и настроек эталонного лота в выбранные лоты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p023). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Свежие формы и общий writer сохраняют все поля; для товаров нельзя создавать независимые копии общего остатка без отдельной политики.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: массовый редактор и клонирование
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-LotCopier/blob/ab5e2a8a1223a912c26d2e1786454af63169d2ae/lot_copier.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `ab5e2a8a1223a912c26d2e1786454af63169d2ae`, blob `53d00296c365c0da78e5c3db0f804cf2cff701a7`.
- **Точки проверки кода:** [copy_tick:217](https://github.com/yungspiderq/FPC-LotCopier/blob/ab5e2a8a1223a912c26d2e1786454af63169d2ae/lot_copier.py#L217), [BIND_TO_PRE_INIT:512](https://github.com/yungspiderq/FPC-LotCopier/blob/ab5e2a8a1223a912c26d2e1786454af63169d2ae/lot_copier.py#L512), [BIND_TO_DELETE:513](https://github.com/yungspiderq/FPC-LotCopier/blob/ab5e2a8a1223a912c26d2e1786454af63169d2ae/lot_copier.py#L513).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [LotCopier (Bulk Lot Settings Copy) 1.0.0](https://github.com/yungspiderq/FPC-LotCopier/blob/ab5e2a8a1223a912c26d2e1786454af63169d2ae/lot_copier.py), blob `53d00296c365`, мест 1.

<a id="p024"></a>
## P024 — Lots by Time (LCOT)

- **Сценарий:** Создание копий лота на разные длительности с пересчётом цены.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p024). Вердикт относится к выбранной версии 0.2.0.
- **Вердикт:** полный перенос. Шаблон полей, десятичный расчёт и последовательное создание форм; сохраняется связь длительности и количества.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: клонирование и массовая цена; мастера длительностей нет
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/vadim556/FPC-Plugins/blob/b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d/lcot.py), версия 0.2.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d`, blob `43eb44a95c38beeaea5e360d012bfc567f2e57e4`.
- **Точки проверки кода:** [_replace_hours_in_title:165](https://github.com/vadim556/FPC-Plugins/blob/b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d/lcot.py#L165), [BIND_TO_PRE_INIT:563](https://github.com/vadim556/FPC-Plugins/blob/b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d/lcot.py#L563), [BIND_TO_DELETE:564](https://github.com/vadim556/FPC-Plugins/blob/b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d/lcot.py#L564).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Lots by Time (LCOT) 0.2.0](https://github.com/vadim556/FPC-Plugins/blob/b2f7ee9a8bd84dd6002d2b401c19edf52a1de72d/lcot.py), blob `43eb44a95c38`, мест 1.

<a id="p025"></a>
## P025 — Lots Manager Plugin

- **Сценарий:** Список лотов, ручной порядок и сортировка через перепубликацию.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p025). Вердикт относится к выбранной версии 0.3.0.
- **Вердикт:** полный перенос. Работа с формами доступна; очередь создания должна сверять неопределённый результат, чтобы не плодить дубли.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: управление лотами есть; ручной порядок — дополнение
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/lots_manager_plugin.py), версия 0.3.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `8abd2bd3eae6201a67d1aad30c8c28789d11454e`, blob `e5a3992dae3716deddc31edd25a292e058342561`.
- **Точки проверки кода:** [_send_compact:153](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/lots_manager_plugin.py#L153), [BIND_TO_PRE_INIT:381](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/lots_manager_plugin.py#L381), [BIND_TO_DELETE:382](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/lots_manager_plugin.py#L382).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Lots Manager Plugin 0.3.0](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/lots_manager_plugin.py), blob `e5a3992dae37`, мест 1.

<a id="p026"></a>
## P026 — LotsOff (Deactivate Lots by Categories)

- **Сценарий:** Массовое включение/выключение категорий, избранное и удержание выключенного состояния.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p026). Вердикт относится к выбранной версии 1.2.1.
- **Вердикт:** полный перенос. Общий resolver Funcy может хранить пользовательский blocker категории, сохраняя остальные причины выключения.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: массовая активность и resolver; закрепление категории — дополнение
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-LotsOff/blob/5ed73d904cf0f20324aa0d458705a93fa651026f/lots_off_by_category.py), версия 1.2.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, handlers, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `5ed73d904cf0f20324aa0d458705a93fa651026f`, blob `1c3cc660660b2754d922d06611948479e1f4aa1a`.
- **Точки проверки кода:** [_send_completion:212](https://github.com/yungspiderq/FPC-LotsOff/blob/5ed73d904cf0f20324aa0d458705a93fa651026f/lots_off_by_category.py#L212), [BIND_TO_PRE_INIT:804](https://github.com/yungspiderq/FPC-LotsOff/blob/5ed73d904cf0f20324aa0d458705a93fa651026f/lots_off_by_category.py#L804), [BIND_TO_DELETE:805](https://github.com/yungspiderq/FPC-LotsOff/blob/5ed73d904cf0f20324aa0d458705a93fa651026f/lots_off_by_category.py#L805).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [LotsOff (Deactivate Lots by Categories) 1.2.1](https://github.com/yungspiderq/FPC-LotsOff/blob/5ed73d904cf0f20324aa0d458705a93fa651026f/lots_off_by_category.py), blob `1c3cc660660b`, мест 1.

<a id="p027"></a>
## P027 — NightMode (Night Auto-Responder)

- **Сценарий:** Ночной автоответ в окне времени, username и один ответ за ночь на чат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p027). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Время, шаблон и сохранённый cooldown; не требует строгого срабатывания в конкретную секунду.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: автоответы; отдельного ночного окна нет
- **Сложность:** низкая; приоритет 2; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `10bab4af9af563c7b21331822cf7f86a1dc283ab`, blob `a3c525745248e8ee768717e40e0b1b1fbfbe3576`.
- **Точки проверки кода:** [new_message_handler:207](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py#L207), [BIND_TO_PRE_INIT:460](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py#L460), [BIND_TO_NEW_MESSAGE:461](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py#L461), [BIND_TO_DELETE:462](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py#L462).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [NightMode (Night Auto-Responder) 1.0.0](https://github.com/yungspiderq/FPC-NightMode/blob/10bab4af9af563c7b21331822cf7f86a1dc283ab/night_mode.py), blob `a3c525745248`, мест 1.

<a id="p028"></a>
## P028 — Order Confirmation Reminder

- **Сценарий:** Одно напоминание о подтверждении после задержки с проверкой текущего статуса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p028). Вердикт относится к выбранной версии 2.3.0.
- **Вердикт:** полный перенос. Долговечная задача и сверка заказа; пропущенная при остановке задача возобновляется без повтора.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: напоминания об отзыве, подтверждение отдельно
- **Сложность:** низкая; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py), версия 2.3.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `b45639fc062a16ce546276158479cc094d49f0d8`, blob `18f0ef71abbc8d006237cd52aeda17ab639a1534`.
- **Точки проверки кода:** [safe_send_message:142](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L142), [register_telegram_handlers:260](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L260), [BIND_TO_PRE_INIT:400](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L400), [BIND_TO_NEW_ORDER:401](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L401), [BIND_TO_ORDER_STATUS_CHANGED:402](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L402), [BIND_TO_NEW_MESSAGE:403](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py#L403).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Order Confirmation Reminder 2.3.0](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/confirm_reminder%20%282%29.py), blob `18f0ef71abbc`, мест 1.

<a id="p029"></a>
## P029 — OrdersDashboard (Orders & Confirm Reminders)

- **Сценарий:** Возраст активных заказов, карточка, напоминание о подтверждении, возврат, исключения и лимит напоминаний.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p029). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Доступные формы/HTTP и долговечные задачи; возможность напоминания о подтверждении отличать от существующего напоминания об отзыве.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: карточки и проблемные заказы есть; подтверждение — отдельный сценарий
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `e80337194ed6ac23e41e04361be5cf532e991dc7`, blob `9ff5b2f741b4654618ec642b7cc3d4f775775a5d`.
- **Точки проверки кода:** [_send_reminder_to_order:281](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L281), [_auto_remind_tick:309](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L309), [delivery_recorder:386](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L386), [ask_refund:612](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L612), [do_refund:630](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L630), [BIND_TO_PRE_INIT:805](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L805), [BIND_TO_POST_DELIVERY:806](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L806), [BIND_TO_DELETE:807](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py#L807).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [OrdersDashboard (Orders & Confirm Reminders) 1.0.1](https://github.com/yungspiderq/FPC-OrdersDashboard/blob/e80337194ed6ac23e41e04361be5cf532e991dc7/orders_dashboard.py), blob `9ff5b2f741b4`, мест 1.

<a id="p030"></a>
## P030 — RegularsDetector (Repeat Customers)

- **Сценарий:** Распознавание повторного покупателя, топ клиентов и восстановление базы из истории продаж.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p030). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. История продаж, buyer ID и локальные агрегаты; не требует внешнего сервиса.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: история покупателя есть; счётчик покупок и топ не полностью совпадают
- **Сложность:** низкая; приоритет 2; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51`, blob `41aae8f2447f1b71b704a438f6c08752f5e166fc`.
- **Точки проверки кода:** [new_order_handler:219](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py#L219), [BIND_TO_PRE_INIT:499](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py#L499), [BIND_TO_NEW_ORDER:500](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py#L500), [BIND_TO_DELETE:501](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py#L501).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [RegularsDetector (Repeat Customers) 1.0.1](https://github.com/yungspiderq/FPC-RegularsDetector/blob/1dc86e1ef73ff4f39393232e2a395b8c0c3bcf51/regulars_detector.py), blob `41aae8f2447f`, мест 1.

<a id="p031"></a>
## P031 — Steam Guard Delivery

- **Сценарий:** Импорт shared_secret, привязка аккаунта и покупателя, выдача Guard-кода по команде, срок доступа и очистка истёкших доступов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p031). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Алгоритм HMAC-SHA1 реализуется Web Crypto; срок проверяется в момент запроса. Нужен импорт файла через UI и хранение секрета в фоне.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `136cbe51920492d25b1d99c0691ef238c6a81bb0`, blob `b184f97eb8a0099707a3f72d1c8e02ff9463c505`.
- **Точки проверки кода:** [generate_steam_code:66](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L66), [load_buyers:154](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L154), [save_buyers:159](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L159), [add_buyer_access:164](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L164), [check_buyer_access:186](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L186), [get_steam_code_for_buyer:213](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L213), [new_order_handler:423](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L423), [new_message_handler:455](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L455), [BIND_TO_PRE_INIT:495](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L495), [BIND_TO_NEW_ORDER:496](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L496), [BIND_TO_NEW_MESSAGE:497](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L497), [BIND_TO_DELETE:498](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py#L498).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [rfc6238](compatibility.md#rfc6238), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Steam Guard Delivery 1.0.0](https://github.com/MeccCZ/steam-guard-delivery-plugin/blob/136cbe51920492d25b1d99c0691ef238c6a81bb0/steam_guard_delivery.py), blob `b184f97eb8a0`, мест 1.

<a id="p032"></a>
## P032 — TradeManager

- **Сценарий:** Временные окна активности лотов, дни недели, пресеты, разовые переопределения, журнал и уведомления.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p032). Вердикт относится к выбранной версии 1.3.0.
- **Вердикт:** полный перенос. Чтение/запись FunPay и вычисление текущего окна; правила и overrides сохраняются в IndexedDB и применяются через общий resolver.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: расписания есть; разовые overrides не полностью совпадают
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py), версия 1.3.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, lot_activation_common, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `2c8b5e6f8acd45ff6fc5a436ba4b1adf39f5bfd0`.
- **Точки проверки кода:** [_send_notification:976](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py#L976), [BIND_TO_PRE_INIT:2253](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py#L2253), [BIND_TO_DELETE:2293](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py#L2293), [BIND_TO_SETTINGS_PAGE:2315](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py#L2315).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [TradeManager 1.3.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/trade_manager.py), blob `2c8b5e6f8acd`, мест 1.

<a id="p033"></a>
## P033 — ViewTracker

- **Сценарий:** Запоминание того, что смотрел покупатель, история доступных просмотров и отчёт.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p033). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Снимки доступной информации чата и локальная история; не требуется непрерывное внешнее соединение.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: история покупателя, без такого журнала просмотров
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `83e5e464855aa36148dd1245f262625bbb2f3f09`, blob `5146d7dd8f4352f98f709e7b17e2410404e3daf4`.
- **Точки проверки кода:** [_send_notification:81](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py#L81), [BIND_TO_DELETE:23](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py#L23), [BIND_TO_NEW_MESSAGE:158](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py#L158), [BIND_TO_PRE_INIT:703](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py#L703), [BIND_TO_POST_INIT:704](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py#L704).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ViewTracker 1.0.0](https://github.com/zap90a/ViewTracker/blob/83e5e464855aa36148dd1245f262625bbb2f3f09/ViewTracker.py), blob `5146d7dd8f43`, мест 1.

<a id="p034"></a>
## P034 — ИИ-автоответчик

- **Сценарий:** OpenAI-совместимый AI-автоответчик, настройка модели/промпта и ручные команды включения.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p034). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** полный перенос. Внешний API по HTTPS и локальный контекст; локальный HTTP-шлюз не является обязательным, используются поддержанные внешние провайдеры.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: обычный автоответчик
- **Сложность:** средняя; приоритет 2; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, requests. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.openai.com.
- **Версия доказательства:** commit `0089df6e3dca20f66315ed271915a477ad490d13`, blob `8a48572039359bda44ee974c1915210ad088e786`.
- **Точки проверки кода:** [new_message_handler:431](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py#L431), [BIND_TO_DELETE:66](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py#L66), [BIND_TO_PRE_INIT:720](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py#L720), [BIND_TO_NEW_MESSAGE:721](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py#L721), [BIND_TO_PRE_STOP:722](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py#L722).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ИИ-автоответчик 1.1.0](https://github.com/kingegoat/funpay-factory/blob/0089df6e3dca20f66315ed271915a477ad490d13/ai-autoresponder/ai_responder.py), blob `8a4857203935`, мест 1.

<a id="p035"></a>
## P035 — Auto Back

- **Сценарий:** Условия автоматического возврата после отзыва, фильтры и реакция на заказ.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p035). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Статусы и HTTP возврата переносимы; журнал должен исключать повторный refund и возврат после выданного товара без явного правила.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: чёрный список и отзывы, возвратной политики нет
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `3fd01453a8a9566464c593f13b319e2d3c4accd1`, blob `620cbbcc4ddede6bcf7b8a025df3826bdc8a3164`.
- **Точки проверки кода:** [_send_notification:203](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py#L203), [BIND_TO_PRE_INIT:679](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py#L679), [BIND_TO_DELETE:680](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py#L680), [BIND_TO_NEW_MESSAGE:681](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py#L681), [BIND_TO_NEW_ORDER:682](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py#L682).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Back 1.0.0](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Back/blob/3fd01453a8a9566464c593f13b319e2d3c4accd1/auto_back.py), blob `620cbbcc4dde`, мест 1.

<a id="p036"></a>
## P036 — Auto Refund

- **Сценарий:** Правила возврата/блокировки по отзыву и цене, исключения автовыдачи, сообщения покупателю.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p036). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** полный перенос. Чтение отзыва и HTTP refund/blacklist; сохраняются отдельные правила по оценкам и журнал действий.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: blacklist и ответы на отзывы
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, pip, pydantic, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `31cda49fdcff4ca37fe861eb1e0b0d240ea71997`, blob `154bb0f7081f4a65a12c15410f27c4cb559fe7c6`.
- **Точки проверки кода:** [_send_state:197](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py#L197), [BIND_TO_DELETE:367](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py#L367), [BIND_TO_PRE_INIT:368](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py#L368), [BIND_TO_NEW_ORDER:369](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py#L369), [BIND_TO_NEW_MESSAGE:370](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py#L370).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Refund 0.0.1](https://github.com/fiksey/FPC-AutoBack/blob/31cda49fdcff4ca37fe861eb1e0b0d240ea71997/autoback.py), blob `154bb0f7081f`, мест 1; [Auto Refund 0.0.1](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/autoback.py), blob `749da31c9cfc`, мест 1; [Auto Refund 0.0.1](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/autoback.py), blob `bb69e6b6c4f2`, мест 1.

<a id="p037"></a>
## P037 — Auto Refund

- **Сценарий:** Возвраты по оценке/удалению отзыва, blacklist, предел суммы и уведомления.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p037). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Факты заказа/отзыва и HTTP refund; константы и entrypoint — один модуль, а не два отдельных плагина.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: blacklist и отзывы
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/princeofscale/FPC-auto_refund/blob/cd0df2fc0576ef2c7e300553253849f562459bf4/auto_refund/utils/constants.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** Apache-2.0. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `cd0df2fc0576ef2c7e300553253849f562459bf4`, blob `185b4cfeb39b6b2fe5fbbcc1043fba60d3847a3d`.
- **Точки проверки кода:** [metadata / entrypoint:1](https://github.com/princeofscale/FPC-auto_refund/blob/cd0df2fc0576ef2c7e300553253849f562459bf4/auto_refund/utils/constants.py#L1).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life).
- **Версии и копии:** [Auto Refund 1.0.0](https://github.com/princeofscale/FPC-auto_refund/blob/cd0df2fc0576ef2c7e300553253849f562459bf4/auto_refund/utils/constants.py), blob `185b4cfeb39b`, мест 1.

<a id="p038"></a>
## P038 — Auto Refund & Protection

- **Сценарий:** Возвраты по настроенным оценкам/суммам, защита от повторов и чёрный список.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p038). Вердикт относится к выбранной версии 2.0.0.
- **Вердикт:** полный перенос. Методы FunPay по HTTP и сохранённая политика; результат refund подтверждать свежим чтением.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: чёрный список, отзывы и проблемные заказы
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py), версия 2.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `05f0ce1c03ba030dcf0d02905befcea908b71d1a`, blob `b06b76638e30bda49fbb97251895f6df6975c26e`.
- **Точки проверки кода:** [_send_buyer:497](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py#L497), [BIND_TO_PRE_INIT:690](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py#L690), [BIND_TO_NEW_MESSAGE:691](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py#L691), [BIND_TO_LAST_CHAT_MESSAGE_CHANGED:692](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py#L692), [BIND_TO_DELETE:693](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py#L693).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Refund & Protection 2.0.0](https://github.com/kepler-reed/funpay-cardinal-auto-refund/blob/05f0ce1c03ba030dcf0d02905befcea908b71d1a/plugin/auto_refund_protection.py), blob `b06b76638e30`, мест 1.

<a id="p039"></a>
## P039 — Auto Send Chat

- **Сценарий:** Рассылки в заданные чаты, интервалы, число отправок, случайные тексты, уведомления и остановка.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p039). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** полный перенос. Долговечные задачи и очередь сообщений заменяют потоки; завершённые отправки и остаток счётчика сохраняются. Точность до секунды не обещается.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: шаблоны и отправитель; планировщика рассылок нет
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Utils, cardinal, pip, pydantic, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, t.me.
- **Версия доказательства:** commit `4954dc05bad62a374b5e49bc701bfd85c433de89`, blob `3060af234a0153a2395edb4cb69fb9e590ec0485`.
- **Точки проверки кода:** [try_send:393](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L393), [_send_state:210](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L210), [act_acc_chat_send_chat_id:251](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L251), [act_acc_chat_send_text:255](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L255), [send_:299](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L299), [BIND_TO_PRE_INIT:442](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L442), [BIND_TO_DELETE:443](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py#L443).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Send Chat 0.0.1](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/auto_send.py), blob `3060af234a01`, мест 1; [Auto Send Chat 0.0.1](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_send.py), blob `922af9aa96b6`, мест 1.

<a id="p040"></a>
## P040 — BuyerSpy (Buyer Viewing Spy)

- **Сценарий:** Снимок того, какой доступный лот сейчас смотрит собеседник; запуск на заказ, сообщение или вручную.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p040). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Используется информация, которую отдаёт чат FunPay; сохраняется снимок, не обещается отслеживание любых действий пользователя вне доступных данных.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: сведения чата и покупателя
- **Сложность:** низкая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `547de2d499df4637224290f9db0357f756c3bb23`, blob `9e703541650a4f204e200a11f2d2a253ce7f9577`.
- **Точки проверки кода:** [spy_buyer:166](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L166), [new_order_handler:210](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L210), [new_message_handler:230](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L230), [BIND_TO_PRE_INIT:432](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L432), [BIND_TO_NEW_ORDER:433](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L433), [BIND_TO_NEW_MESSAGE:434](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L434), [BIND_TO_DELETE:435](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py#L435).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [BuyerSpy (Buyer Viewing Spy) 1.0.1](https://github.com/yungspiderq/FPC-BuyerSpy/blob/547de2d499df4637224290f9db0357f756c3bb23/buyer_spy.py), blob `9e703541650a`, мест 1.

<a id="p041"></a>
## P041 — Chat Sync Plugin

- **Сценарий:** Двусторонний мост FunPay ↔ темы Telegram, история, картинки, шаблоны, упоминания и фильтры уведомлений.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p041). Вердикт относится к выбранной версии 0.1.26.
- **Вердикт:** полный перенос. Telegram Bot API — HTTPS; getUpdates с коротким polling, сохранённый offset и соответствия тем позволяют сохранить удалённое общение при открытом браузере.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует: Telegram ранее удалён; реализация потребует отдельного решения продукта
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py), версия 0.1.26; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, PIL, Utils, cardinal, handlers, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, t.me.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `b92162d2e9199de190480066b5a8cd0772a15c6d`.
- **Точки проверки кода:** [new_act_send_funpay_message:1394](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L1394), [new_synced_chat:371](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L371), [replace_handler:429](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L429), [bind_tg_handlers:440](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L440), [ingoing_message_handler:730](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L730), [new_order_handler:738](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L738), [sync_chat_on_start:746](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L746), [sync_chat_on_start_handler:757](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L757), [BIND_TO_PRE_INIT:1416](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L1416), [BIND_TO_DELETE:1417](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py#L1417).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-offscreen](compatibility.md#chrome-offscreen), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Chat Sync Plugin 0.1.26](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/chat_sync_plugin.py), blob `b92162d2e919`, мест 1; [Chat Sync Plugin 0.1.23](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/chat_sync_plugin.py), blob `50c336c0d4d1`, мест 1; [Chat Sync Plugin 0.1.21](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/chat_sync_plugin.py), blob `467b65be11c6`, мест 1; [Chat Sync Plugin 0.0.9](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/chat_sync_plugin.py), blob `0ef9647dfb44`, мест 1.
- **Telegram-публикации:** [chat_sync_plugin 3.py](https://t.me/cloudecode/7), [chat_sync_plugin 2.py](https://t.me/cloudecode/13), [chat_sync_plugin.py](https://t.me/fpc_plugins/10), [chat_sync_plugin.py](https://t.me/fpc_plugins/11), [chat_sync_plugin.py](https://t.me/fpc_plugins/40), [chat_sync_plugin.py](https://t.me/fpc_plugins/43), [chat_sync_plugin.py](https://t.me/fpc_plugins/46), [chat_sync_plugin.py](https://t.me/fpc_plugins/57), [chat_sync_plugin.py](https://t.me/fpc_plugins/58), [chat_sync_plugin.py](https://t.me/fpc_plugins/64), [chat_sync_plugin.py](https://t.me/fpc_plugins/65), [chat_sync_plugin.py](https://t.me/fpc_plugins/66), [chat_sync_plugin.py](https://t.me/fpc_plugins/68), [chat_sync_plugin.py](https://t.me/fpc_plugins/70), [chat_sync_plugin.py](https://t.me/fpc_plugins/71), [chat_sync_plugin.py](https://t.me/fpc_plugins/72), [chat_sync_plugin.py](https://t.me/fpc_plugins/73), [chat_sync_plugin.py](https://t.me/fpc_plugins/74), [chat_sync_plugin.py](https://t.me/fpc_plugins/77), [chat_sync_plugin.py](https://t.me/fpc_plugins/91), [chat_sync_plugin.py](https://t.me/fpc_plugins/95), [chat_sync_plugin.py](https://t.me/fpc_plugins/99), [chat_sync_plugin.py](https://t.me/fpc_plugins/106), [chat_sync_plugin.py](https://t.me/fpc_plugins/109), [chat_sync_plugin.py](https://t.me/fpc_plugins/112), [chat_sync_plugin.py](https://t.me/fpc_plugins/113), [chat_sync_plugin.py](https://t.me/fpc_plugins/116), [chat_sync_plugin.py](https://t.me/fpc_plugins/119), [chat_sync_plugin.py](https://t.me/fpc_plugins/121), [chat_sync_plugin.py](https://t.me/fpc_plugins/122), [chat_sync_plugin.py](https://t.me/fpc_plugins/123), [chat_sync_plugin.py](https://t.me/fpc_plugins/124), [chat_sync_plugin.py](https://t.me/fpc_plugins/125), [chat_sync_plugin.py](https://t.me/fpc_plugins/127), [chat_sync_plugin.py](https://t.me/fpc_plugins/129), [chat_sync_plugin.py](https://t.me/fpc_plugins/131), [chat_sync_plugin.py](https://t.me/fpc_plugins/132). Байты вложений не сравнивались.

<a id="p042"></a>
## P042 — DailyReport (AI Analyzer)

- **Сценарий:** Ежедневный AI-разбор заказов и текстовый отчёт с настройкой периода/модели.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p042). Вердикт относится к выбранной версии 2.0.0.
- **Вердикт:** полный перенос. История заказов плюс документированный AI HTTP; можно сохранить задания и отчёт локально.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: аналитика есть; AI-разбора нет
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py), версия 2.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, openrouter.ai.
- **Версия доказательства:** commit `78f9978f840fcec1823113103278d3ed8cd2af37`, blob `a0c3c35be4fe4c8824513754be3ec24da73cd242`.
- **Точки проверки кода:** [_analyze_mood_sync:232](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L232), [_generate_and_send_report:271](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L271), [input_handler:484](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L484), [new_order_handler:542](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L542), [new_message_handler:546](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L546), [order_status_changed_handler:550](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L550), [BIND_TO_DELETE:22](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L22), [BIND_TO_PRE_INIT:554](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L554), [BIND_TO_NEW_ORDER:555](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L555), [BIND_TO_ORDER_STATUS_CHANGED:556](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py#L556).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [DailyReport (AI Analyzer) 2.0.0](https://github.com/JIMER228/AI-Order-Analyzer-FunPay-Cardinal/blob/78f9978f840fcec1823113103278d3ed8cd2af37/AI_Analyzer.py), blob `a0c3c35be4fe`, мест 1.

<a id="p043"></a>
## P043 — ExternalNotifier (Discord / Slack Webhook Alerts)

- **Сценарий:** Очередь уведомлений о заказах, сообщениях и выдаче в Discord/Slack webhook, retry и тест.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p043). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Webhooks — исходящий HTTPS; сервер для приёма не нужен. Сохранить payload, задержки, лимиты и журнал неопределённой отправки.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует: Discord-интеграция ранее удалена
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `10f751fe9a39d441352fd394497cb6d416349ddf`, blob `9d32bad7312aca474f44e43c4b7d5c15b2fbec4a`.
- **Точки проверки кода:** [_fmt_delivery:205](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L205), [new_order_handler:256](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L256), [new_message_handler:264](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L264), [post_delivery_handler:279](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L279), [queue_tick:289](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L289), [_send_loop:340](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L340), [send_test:474](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L474), [BIND_TO_PRE_INIT:540](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L540), [BIND_TO_NEW_ORDER:541](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L541), [BIND_TO_NEW_MESSAGE:542](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L542), [BIND_TO_POST_DELIVERY:543](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py#L543).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [discord](compatibility.md#discord), [slack](compatibility.md#slack), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ExternalNotifier (Discord / Slack Webhook Alerts) 1.0.0](https://github.com/yungspiderq/FPC-ExternalNotifier/blob/10f751fe9a39d441352fd394497cb6d416349ddf/external_notifier.py), blob `9d32bad7312a`, мест 1.

<a id="p044"></a>
## P044 — GPTAutoSells

- **Сценарий:** Продажа лимита AI-запросов, баланс покупателя, обработка вопроса и списание запроса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p044). Вердикт относится к выбранной версии 0.1.
- **Вердикт:** полный перенос. Учёт баланса локален, OpenAI-совместимый провайдер вызывается по HTTP. Баланс и попытку ответа хранить до отправки, чтобы рестарт не списывал запрос повторно.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует как отдельный продаваемый сервис
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py), версия 0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, httpx, openai, subprocess, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `73e385c8d4f7884cd91251cae73c9e9d09978602`, blob `c09dbbe37f9882fe7c9c1b5d1145409e4c6d3c04`.
- **Точки проверки кода:** [send_long_message:95](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py#L95), [BIND_TO_PRE_INIT:276](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py#L276), [BIND_TO_NEW_ORDER:277](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py#L277), [BIND_TO_NEW_MESSAGE:278](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py#L278), [BIND_TO_DELETE:279](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py#L279).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [GPTAutoSells 0.1](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/gpt-auto-sells/gpt.py), blob `c09dbbe37f98`, мест 1.

<a id="p045"></a>
## P045 — PostDeliveryBonus (Follow-up After Delivery)

- **Сценарий:** Отложенное сообщение после выдачи, шаблон, очередь, возможный текст бонуса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p045). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Сохранённая задача после проверенной выдачи и отправитель Funcy; бонус в этом плагине — настраиваемое содержимое сообщения.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: отзывы, бонусы и напоминания
- **Сложность:** низкая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `41305ccfa10665c20c137f4696e5a54a8355dc85`, blob `295de0302adb4b6a07de4baa066745466b0e988e`.
- **Точки проверки кода:** [post_delivery_handler:166](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L166), [_bonus_tick:196](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L196), [send_test:353](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L353), [BIND_TO_PRE_INIT:428](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L428), [BIND_TO_POST_DELIVERY:429](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L429), [BIND_TO_DELETE:430](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py#L430).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [PostDeliveryBonus (Follow-up After Delivery) 1.0.0](https://github.com/yungspiderq/FPC-PostDeliveryBonus/blob/41305ccfa10665c20c137f4696e5a54a8355dc85/post_delivery_bonus.py), blob `295de0302adb`, мест 1.

<a id="p046"></a>
## P046 — Review Reminder

- **Сценарий:** Напоминания об отзыве, задержки, ограничения и исключения; детали различаются между версиями.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p047). Вердикт относится к выбранной версии 0.0.7.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p046). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Состояние заказа, проверка наличия отзыва и долговечная задача. Funcy уже имеет безопасную основу; многократные/случайные шаблоны — отдельные дополнения.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: одно напоминание об отзыве уже реализовано
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** bot, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `983deb72a270c02a31ca3ad3baa5865718fd445f`, blob `8761ff0329f320a7548a0a2a20151a134045a84b`.
- **Точки проверки кода:** [_default:38](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L38), [_load:51](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L51), [_save:71](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L71), [_menu:78](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L78), [BIND_TO_INIT:379](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L379), [BIND_TO_NEW_ORDER:380](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L380), [BIND_TO_NEW_MESSAGE:381](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L381), [BIND_TO_EXIT:382](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py#L382).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Review Reminder 1.0.0](https://github.com/Levako098/moneybot/blob/983deb72a270c02a31ca3ad3baa5865718fd445f/plugins/review_reminder.py), blob `8761ff0329f3`, мест 1.

<a id="p047"></a>
## P047 — Review Reminder

- **Сценарий:** Напоминания об отзыве, задержки, ограничения и исключения; детали различаются между версиями.
- **Вердикт:** полный перенос. Состояние заказа, проверка наличия отзыва и долговечная задача. Funcy уже имеет безопасную основу; многократные/случайные шаблоны — отдельные дополнения.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: одно напоминание об отзыве уже реализовано
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py), версия 0.0.7; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, pip, pydantic, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, raw.githubusercontent.com.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `e43a1a66d01e23c34a1cb09532df346e536a1ddd`.
- **Точки проверки кода:** [start_checker_loop:457](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L457), [_send_state:279](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L279), [BIND_TO_PRE_INIT:531](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L531), [BIND_TO_NEW_MESSAGE:532](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L532), [BIND_TO_ORDER_STATUS_CHANGED:533](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L533), [BIND_TO_DELETE:534](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py#L534).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Review Reminder 0.0.7](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/review_reminder.py), blob `e43a1a66d01e`, мест 1; [Review Reminder 0.0.7](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/review_reminder.py), blob `8923b7085393`, мест 1.

<a id="p048"></a>
## P048 — SalesAnalytics (Sales Statistics & Daily Digest)

- **Сценарий:** Статистика по валютам, лотам и возвратам, средний чек, отзывы и ежедневная сводка.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p048). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** полный перенос. Чтение продаж и детерминированные агрегаты; задачи сводки сохраняются между запусками worker.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть основная аналитика; ежедневная сводка — дополнение
- **Сложность:** низкая; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, configparser, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `226617ec8354546541e4fae47c45289c14149135`, blob `96ab0ef79ac9fc61b2883a0991c6683a54a98be5`.
- **Точки проверки кода:** [on_post_delivery:485](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L485), [send_stats:545](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L545), [BIND_TO_PRE_INIT:664](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L664), [BIND_TO_POST_START:665](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L665), [BIND_TO_NEW_ORDER:666](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L666), [BIND_TO_ORDER_STATUS_CHANGED:667](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py#L667).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SalesAnalytics (Sales Statistics & Daily Digest) 1.1.0](https://github.com/yungspiderq/FPC-SalesAnalytics/blob/226617ec8354546541e4fae47c45289c14149135/sales_analytics.py), blob `96ab0ef79ac9`, мест 1.

<a id="p049"></a>
## P049 — SRAS Info Plugin

- **Сценарий:** Проверка изменений рейтинговых ограничений FunPay и уведомление о новой информации.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p049). Вердикт относится к выбранной версии 0.0.4.
- **Вердикт:** полный перенос. Чтение страницы /sras/info, сравнение снимка и уведомление через UI/Bot API.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует отдельный монитор изменений
- **Сложность:** низкая; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py), версия 0.0.4; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `07e6d88f0ba146c370fea42c3d376cac62bed64f`, blob `e5d1645f0c153c8ef46863ab77dc7d5d6412c4bd`.
- **Точки проверки кода:** [send_sras_changes:111](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py#L111), [msg_handler:150](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py#L150), [sras_info_handler:169](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py#L169), [BIND_TO_PRE_INIT:197](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py#L197), [BIND_TO_DELETE:198](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py#L198).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SRAS Info Plugin 0.0.4](https://github.com/sarto4ever/plugins_build/blob/07e6d88f0ba146c370fea42c3d376cac62bed64f/sras_info_plugin.py), blob `e5d1645f0c15`, мест 1; [SRAS Info Plugin 0.0.4](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/sras_info_plugin.py), blob `04be1be0c1a1`, мест 1.
- **Telegram-публикации:** [sras_info_plugin.py](https://t.me/fpc_plugins/88), [sras_info_plugin.py](https://t.me/fpc_plugins/89), [sras_info_plugin.py](https://t.me/fpc_plugins/100), [sras_info_plugin.py](https://t.me/fpc_plugins/120). Байты вложений не сравнивались.

<a id="p050"></a>
## P050 — Status Plugin

- **Сценарий:** Статус продавца, ответ на #status, время последнего ручного действия и настройка текста.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p050). Вердикт относится к выбранной версии 0.0.11.
- **Вердикт:** полный перенос. События сообщений плюс сохранённый timestamp; постоянный Python-процесс не нужен.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: автоответы и приветствия
- **Сложность:** низкая; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py), версия 0.0.11; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `cefaa63bab2ec024df361b91650d86f10bf1d936`.
- **Точки проверки кода:** [generate_status_text:79](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L79), [greetings_handler:88](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L88), [reg_tg_handlers:219](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L219), [reg_handlers:237](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L237), [BIND_TO_PRE_INIT:272](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L272), [BIND_TO_DELETE:273](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py#L273).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Status Plugin 0.0.11](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/status_plugin.py), blob `cefaa63bab2e`, мест 1; [Status Plugin 0.0.6](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/status_plugin.py), blob `7a6f5a454468`, мест 1.
- **Telegram-публикации:** [status_plugin.py](https://t.me/cloudecode/20), [status_plugin.py](https://t.me/fpc_plugins/67), [status_plugin.py](https://t.me/fpc_plugins/69), [status_plugin.py](https://t.me/fpc_plugins/101), [status_plugin.py](https://t.me/fpc_plugins/114), [status_plugin.py](https://t.me/fpc_plugins/115), [status_plugin.py](https://t.me/fpc_plugins/130), [status_plugin.py](https://t.me/fpc_plugins/133), [status_plugin.py](https://t.me/fpc_plugins/136), [status_plugin.py](https://t.me/fpc_plugins/137). Байты вложений не сравнивались.

<a id="p051"></a>
## P051 — SteamGift (DesslyHub Auto Gift Delivery)

- **Сценарий:** Каталог игр DesslyHub, ссылка друга, покупка гифта, опрос статуса, dry-run, лимиты и маржа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p051). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Официальный DesslyHub Gift/status API использует HTTPS; очередь, reference и transaction ID сохраняются до продолжения. Неопределённая покупка требует сверки, не повторного POST.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует: поставщики удалены
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `62af9bc8048895eb6d941f36d00b6670d06c5272`, blob `d94f70afb0b22b1028da70bbd8948228f7a45416`.
- **Точки проверки кода:** [send_buyer_message:667](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L667), [check_transaction:947](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L947), [check_low_balance:1015](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1015), [do_balance:1280](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1280), [do_check_now:1408](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1408), [balance:390](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L390), [send_gift:411](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L411), [BIND_TO_PRE_INIT:1757](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1757), [BIND_TO_POST_START:1758](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1758), [BIND_TO_NEW_ORDER:1759](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1759), [BIND_TO_NEW_MESSAGE:1760](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py#L1760).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [dessly-auth](compatibility.md#dessly-auth), [dessly-gift](compatibility.md#dessly-gift), [dessly-status](compatibility.md#dessly-status), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SteamGift (DesslyHub Auto Gift Delivery) 1.0.0](https://github.com/yungspiderq/FPC-SteamGift/blob/62af9bc8048895eb6d941f36d00b6670d06c5272/steam_gift.py), blob `d94f70afb0b2`, мест 1.

<a id="p052"></a>
## P052 — Auto Ticket

- **Сценарий:** Отбор просроченных заказов и тикеты поддержки через веб-сайт.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p052). Вердикт относится к выбранной версии 1.0.9.
- **Вердикт:** недостаточно данных. Веб-путь потенциально переносим; проверить актуальные cookies/CSRF и форматы поддержки. SMTP-версии под тем же названием являются отдельными реализациями.
- **Потери/неизвестное:** Веб-путь потенциально переносим; проверить актуальные cookies/CSRF и форматы поддержки. SMTP-версии под тем же названием являются отдельными реализациями.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py), версия 1.0.9; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, support.funpay.com.
- **Версия доказательства:** commit `960d95ca5ba250de3e4e06e239a0b38eb7b8b548`, blob `e09b3f350d47408bea7ddf3834b76e320158574e`.
- **Точки проверки кода:** [_send_tickets:378](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L378), [_send_notification:484](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L484), [_run_ticket_cycle:496](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L496), [add_tickets_used:146](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L146), [_get_ticket_token:286](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L286), [create_ticket:300](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L300), [act_send:675](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L675), [handler:710](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L710), [BIND_TO_PRE_INIT:844](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L844), [BIND_TO_DELETE:845](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py#L845).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Ticket 1.0.9](https://github.com/MrRabbitson/AutoTicket-funpay-cardinal/blob/960d95ca5ba250de3e4e06e239a0b38eb7b8b548/AutoTicket.py), blob `e09b3f350d47`, мест 1.

<a id="p053"></a>
## P053 — autorobuxdrake

- **Сценарий:** RBXCrate и встроенный GamePass, очередь аккаунтов, остаток, подтверждение и возврат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p053). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Часть реализации вложена в строковые модули, API и Roblox cookie-сценарии не проверены целиком. HTTP-доступность не равна доказанному полному переносу.
- **Потери/неизвестное:** Часть реализации вложена в строковые модули, API и Roblox cookie-сценарии не проверены целиком. HTTP-доступность не равна доказанному полному переносу.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, httpx, importlib, subprocess, telebot, tg_bot, types. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** apis.roblox.com, economy.roblox.com, funpay.com, rbxcrate.com, t.me, telegra.ph, users.roblox.com, www.roblox.com.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `3c3754d065b204d03d9dde90aaa3ae23689a4a3b`.
- **Точки проверки кода:** [_load_buyer_lang:570](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L570), [_save_buyer_lang:575](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L575), [_set_buyer_lang:579](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L579), [_get_buyer_lang:585](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L585), [_find_last_order_for_buyer:659](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L659), [_buyer_error_message:754](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L754), [_rbxcrate_resend_order:1110](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L1110), [_send_buyer:1148](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L1148), [BIND_TO_PRE_INIT:3240](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L3240), [BIND_TO_NEW_ORDER:3241](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L3241), [BIND_TO_NEW_MESSAGE:3242](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L3242), [BIND_TO_DELETE:3243](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py#L3243).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [autorobuxdrake 1.0.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autorobuxdrake_fpc.py), blob `3c3754d065b2`, мест 1.

<a id="p054"></a>
## P054 — AutoSMM

- **Сценарий:** SMM SocPanel v2, несколько услуг/заказов, статусы, отмена после возврата, шаблоны и журнал.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p054). Вердикт относится к выбранной версии 0.0.9.
- **Вердикт:** недостаточно данных. Исходник подробный, но публичный контракт панели недоступен; действие add в этой версии использует GET. Без сверки схем статусов и отмен полный перенос не подтверждён.
- **Потери/неизвестное:** Исходник подробный, но публичный контракт панели недоступен; действие add в этой версии использует GET. Без сверки схем статусов и отмен полный перенос не подтверждён.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py), версия 0.0.9; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, requests, subprocess, telebot, types, unicodedata. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.autooffline.ru, funpay.com, kuzya-boost.ru, smmway.ru, t.me, telegra.ph, teletype.in.
- **Версия доказательства:** commit `c16ac57c0af69e3f15041eb5ee024a942f270072`, blob `6b39ec4affd60dd83753154efcf41279bfb3c119`.
- **Точки проверки кода:** [_is_refunded_funpay_status:1167](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L1167), [_is_order_refundedish:1182](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L1182), [mark_order_refunded:1568](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L1568), [update_order_refunded_status:1610](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L1610), [send_order_to_service:1858](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L1858), [_seconds_since_checked_at:2288](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L2288), [_sync_funpay_status_from_message:2308](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L2308), [_apply_refund_gate:2466](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L2466), [BIND_TO_PRE_INIT:9417](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L9417), [BIND_TO_NEW_MESSAGE:9418](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L9418), [BIND_TO_NEW_ORDER:9419](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L9419), [BIND_TO_DELETE:9420](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py#L9420).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoSMM 0.0.9](https://github.com/W1bbex/FPC-AutoSMM/blob/c16ac57c0af69e3f15041eb5ee024a942f270072/AutoSMM.py), blob `6b39ec4affd6`, мест 1.

<a id="p055"></a>
## P055 — AutoSMM

- **Сценарий:** Несколько SMM-панелей, привязки, подтверждение, add/status/refill, частичные исходы и возврат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p055). Вердикт относится к выбранной версии 1.2.1.
- **Вердикт:** недостаточно данных. Для полного паритета требуется проверить все поддержанные панели и типы услуг. Открытая SMMWay /api сейчас 404; перенос не сводится к единственному запросу add.
- **Потери/неизвестное:** Для полного паритета требуется проверить все поддержанные панели и типы услуг. Открытая SMMWay /api сейчас 404; перенос не сводится к единственному запросу add.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py), версия 1.2.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, proxy6.net, t.me, twiboost.com, vexboost.ru.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `31ef1d1fe67896caa69664298c95616a6400cd70`.
- **Точки проверки кода:** [set_buyer_active_order:659](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L659), [get_buyer_active_order:666](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L666), [remove_buyer_active_order:670](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L670), [_send_buyer:934](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L934), [_do_refund:980](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L980), [_buyer_chat_id:1102](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L1102), [_cmd_check:1205](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L1205), [balance:728](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L728), [BIND_TO_PRE_INIT:2195](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L2195), [BIND_TO_NEW_ORDER:2196](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L2196), [BIND_TO_NEW_MESSAGE:2197](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L2197), [BIND_TO_DELETE:2230](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py#L2230).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoSMM 1.2.1](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/autosmm_fpc.py), blob `31ef1d1fe678`, мест 1.

<a id="p056"></a>
## P056 — AUTOSMM

- **Сценарий:** SMM-автоматизация с API поставщика, привязками и обработкой заказов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p056). Вердикт относится к выбранной версии 1.5.0.
- **Вердикт:** недостаточно данных. Разные версии/форки имеют разные поддержанные панели. Актуальные контракты услуг, статусов и восстановления не подтверждены для всего семейства.
- **Потери/неизвестное:** Разные версии/форки имеют разные поддержанные панели. Актуальные контракты услуг, статусов и восстановления не подтверждены для всего семейства.
- **В Funcy:** отсутствует: поставщики удалены
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py), версия 1.5.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.coingate.com, funpay.com.
- **Версия доказательства:** commit `1a5c0955d03862ef090ef53a89cf8d5e5828784c`, blob `f3302bf837c6790229a928f9c3b1746d5fb092f0`.
- **Точки проверки кода:** [find_order_by_buyer:366](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L366), [order_handler:603](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L603), [send_order_info:930](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L930), [send_order_error_info:1015](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1015), [send_smm_balance_info:1048](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1048), [send_smm_start_info:1096](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1096), [process_orders:1137](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1137), [get_balance:494](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L494), [BIND_TO_PRE_INIT:1649](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1649), [BIND_TO_POST_INIT:1650](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1650), [BIND_TO_NEW_ORDER:1651](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1651), [BIND_TO_NEW_MESSAGE:1652](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py#L1652).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AUTOSMM 1.5.0](https://github.com/svod011929/FPC-AutoSmm/blob/1a5c0955d03862ef090ef53a89cf8d5e5828784c/AutoSmm.py), blob `f3302bf837c6`, мест 1; [AUTOSMM 1.0.0](https://github.com/klaymov/FPC-AutoSmm/blob/cfc5f52df1d0b0007e2f52f403b7aaaf7351c292/auto_smm_v2.py), blob `7790663beee8`, мест 1; [AUTOSMM 0.0.13](https://github.com/drondev-hub/Autosmm-Funpay-Cardinal/blob/615afa9ef830e1cc760a4d46c9d7889de8057278/AutoSmm.py), blob `9de0014727ad`, мест 1; [AUTOSMM 0.0.13](https://github.com/deniska12022/FPC-AutoSmm/blob/c08479c47f7ebdc62973c5ac5698bf109769c623/AutoSmm.py), blob `83d066a18f53`, мест 1; [AutoSmm 0.0.12](https://github.com/Zempaiofficial/FPC-AutoSmm/blob/e320d5ff7f879b6a6e12e93f4a5db6338ee72bc5/AutoSmm.py), blob `a4361b60e9cf`, мест 1.

<a id="p057"></a>
## P057 — AutoStars

- **Сценарий:** Автоматическая продажа Stars через сторонний Fragment-путь и настройки очереди.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p057). Вердикт относится к выбранной версии 4.3.
- **Вердикт:** недостаточно данных. Не подтверждены все методы конкретной версии внешнего API, авторизация и состояние покупки после таймаута; чужую библиотеку не запускали.
- **Потери/неизвестное:** Не подтверждены все методы конкретной версии внешнего API, авторизация и состояние покупки после таймаута; чужую библиотеку не запускали.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py), версия 4.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, atexit, cardinal, httpx, matplotlib, pymysql, requests, subprocess, telebot, tonutils. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** fragment.com, funpay.com, preview.toncenter.com, tonviewer.com.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `803be3b4b3b18e878dc65dddd321f704ed4c4e03`.
- **Точки проверки кода:** [generate_order_graph:205](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L205), [send_error_with_inline_url:259](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L259), [check_wallet_balance:313](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L313), [send_ton_transaction:325](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L325), [main_async:356](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L356), [get_wallet_balance:1306](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L1306), [send_transaction_task:334](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L334), [process_payment:536](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L536), [BIND_TO_PRE_INIT:1839](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L1839), [BIND_TO_NEW_MESSAGE:1840](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L1840), [BIND_TO_NEW_ORDER:1841](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L1841), [BIND_TO_DELETE:1842](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py#L1842).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoStars 4.3](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/auto_stars.py), blob `803be3b4b3b1`, мест 1.

<a id="p058"></a>
## P058 — AutoStars

- **Сценарий:** Прямая покупка Fragment, локальная подпись W5, отправка BOC через TonAPI, проверка hash/seqno и recovery.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p058). Вердикт относится к выбранной версии 0.3.1.
- **Вердикт:** недостаточно данных. HTTP-отправка BOC документирована и raw TCP не обязателен. Полный Fragment/cookie/подписывающий цикл в JS не проверен; есть путь к переносу, но готового доказательства паритета нет.
- **Потери/неизвестное:** HTTP-отправка BOC документирована и raw TCP не обязателен. Полный Fragment/cookie/подписывающий цикл в JS не проверен; есть путь к переносу, но готового доказательства паритета нет.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py), версия 0.3.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, pytoniq, pytoniq_core, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** fragment.com, tonapi.io.
- **Версия доказательства:** commit `3f31711df0ec397af0e70867f4c5cd137a4a7c4e`, blob `82e645675547f5771d072011a6dab510929617af`.
- **Точки проверки кода:** [init_buy_stars_request:229](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L229), [get_buy_stars_link:242](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L242), [send_boc:311](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L311), [get_balance:411](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L411), [find_by_buyer:513](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L513), [find_by_buyer_name:520](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L520), [get_unchecked_orders:548](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L548), [_send:737](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L737), [BIND_TO_PRE_INIT:1771](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L1771), [BIND_TO_POST_INIT:1772](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L1772), [BIND_TO_NEW_ORDER:1773](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L1773), [BIND_TO_NEW_MESSAGE:1774](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py#L1774).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoStars 0.3.1](https://github.com/tzn6/fpc-autostars/blob/3f31711df0ec397af0e70867f4c5cd137a4a7c4e/autostars.py), blob `82e645675547`, мест 1.

<a id="p059"></a>
## P059 — DesslyDash (DesslyHub Merchant Dashboard)

- **Сценарий:** Баланс и каталог DesslyHub, проверка подключения, ручной просмотр транзакций.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p059). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **Потери/неизвестное:** Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **В Funcy:** отсутствует
- **Сложность:** средняя; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa`, blob `404e97e627aeaa4e2a0cd3fca4a2bff8d4ba2f38`.
- **Точки проверки кода:** [send_buyer_message:1024](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L1024), [check_low_balance:1187](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L1187), [ask_buyer_data:1379](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L1379), [do_balance:1523](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L1523), [do_check_now:1665](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L1665), [balance:506](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L506), [_legacy_purchase:621](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L621), [check_steam_login:632](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L632), [BIND_TO_PRE_INIT:2121](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L2121), [BIND_TO_POST_START:2122](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L2122), [BIND_TO_DELETE:2123](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py#L2123).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [DesslyDash (DesslyHub Merchant Dashboard) 1.0.0](https://github.com/yungspiderq/FPC-DesslyDash/blob/116a57cc9f9603888e7e5e3a92e9c4f7ab4fa3fa/dessly_dash.py), blob `404e97e627ae`, мест 1.

<a id="p060"></a>
## P060 — eSIMShop (DesslyHub Auto eSIM Delivery)

- **Сценарий:** Каталог eSIM DesslyHub v2, привязки и покупка, выдача QR/LPA, ICCID и инструкции.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p060). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **Потери/неизвестное:** Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `52b33b9120efa69258c53ca61c4ba6fd93ef299d`, blob `45eeef1f3c7149ba0fceeab9b239fbe5047f5c1c`.
- **Точки проверки кода:** [send_buyer_message:1046](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L1046), [check_low_balance:1209](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L1209), [ask_buyer_data:1401](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L1401), [do_balance:1545](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L1545), [do_check_now:1687](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L1687), [balance:528](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L528), [_legacy_purchase:643](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L643), [check_steam_login:654](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L654), [BIND_TO_PRE_INIT:2281](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L2281), [BIND_TO_POST_START:2282](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L2282), [BIND_TO_NEW_ORDER:2283](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L2283), [BIND_TO_NEW_MESSAGE:2284](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py#L2284).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [eSIMShop (DesslyHub Auto eSIM Delivery) 1.0.0](https://github.com/yungspiderq/FPC-eSIM/blob/52b33b9120efa69258c53ca61c4ba6fd93ef299d/esim_shop.py), blob `45eeef1f3c71`, мест 1.

<a id="p061"></a>
## P061 — Fragment Stars

- **Сценарий:** Продажа Stars через pyfragment, кошелёк TON, очередь, статусы, проблемные заказы и возвраты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p061). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** недостаточно данных. Pyfragment скрывает часть транспорта и платёжного протокола; документация статьи не доказывает все ветви библиотеки. Нужен разбор её версии и авторизованный пилот.
- **Потери/неизвестное:** Pyfragment скрывает часть транспорта и платёжного протокола; документация статьи не доказывает все ветви библиотеки. Нужен разбор её версии и авторизованный пилот.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** asyncio, importlib, pyfragment, sqlite3, subprocess. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `9916ae6583dc98f4e279694b08f0b3d1f713b504`, blob `59051f966034aca75a8691714000257116cc53eb`.
- **Точки проверки кода:** [_safe_send:378](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L378), [_purchase:626](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L626), [_process_order:721](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L721), [_telegram_check_worker:1070](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1070), [_telegram_check:1095](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1095), [BIND_TO_PRE_INIT:1258](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1258), [BIND_TO_POST_INIT:1259](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1259), [BIND_TO_POST_START:1260](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1260), [BIND_TO_INIT_ORDER:1261](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py#L1261).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Fragment Stars 1.1.0](https://github.com/hrabiapolski/funpay-cardinal-fragment-stars/blob/9916ae6583dc98f4e279694b08f0b3d1f713b504/fragment_stars.py), blob `59051f966034`, мест 1.

<a id="p062"></a>
## P062 — FTS-Plugin

- **Сценарий:** Продажа Stars через Fragment API, проверка username, очередь, баланс, деактивация и возврат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p062). Вердикт относится к выбранной версии 1.6.0.
- **Вердикт:** недостаточно данных. Документация и доступный код есть, но Fragment API страница не даёт проверяемый полный контракт авторизации/очередей. Не подтверждён весь цикл без авторизованного пилота.
- **Потери/неизвестное:** Документация и доступный код есть, но Fragment API страница не даёт проверяемый полный контракт авторизации/очередей. Не подтверждён весь цикл без авторизованного пилота.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py), версия 1.6.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.fragment-api.com, fragment-api.com, funpay.com, github.com, t.me, teletype.in.
- **Версия доказательства:** commit `74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c`, blob `0a54ce7fd5353216cc1e1f612aa25f7fb13b85bb`.
- **Точки проверки кода:** [_auto_send_without_plus:257](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L257), [_skip_username_check:354](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L354), [_is_sending:532](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L532), [_set_sending:535](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L535), [_check_username_exists:636](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L636), [_check_username_exists_throttled:676](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L676), [_check_fragment_wallet:719](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L719), [_classify_send_failure:1156](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L1156), [BIND_TO_PRE_INIT:4278](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L4278), [BIND_TO_NEW_MESSAGE:4279](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L4279), [BIND_TO_DELETE:4284](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L4284), [BIND_TO_NEW_ORDER:4281](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py#L4281).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [FTS-Plugin 1.6.0](https://github.com/JIMER228/FPC-Plugin-Telegram-Stars/blob/74f4bb3bd24e3f3ac5a0386053aebf2cda3c5f3c/FTS-Plugin/FTS-Plugin.py), blob `0a54ce7fd535`, мест 1.

<a id="p063"></a>
## P063 — HealthMonitor (Diagnostics & Watchdog)

- **Сценарий:** Проверка сессии, давности событий, работоспособности бота, памяти/CPU/диска сервера.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p063). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** перенос с потерями. Проверки сессии и очередей переносимы; psutil и показатели всего серверного процесса/ОС не имеют равного доступа в расширении. Диагностика Funcy будет другой.
- **Потери/неизвестное:** Проверки сессии и очередей переносимы; psutil и показатели всего серверного процесса/ОС не имеют равного доступа в расширении. Диагностика Funcy будет другой.
- **В Funcy:** частично: журнал и контроль сессии
- **Сложность:** средняя; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, configparser, locales, psutil, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `50b1c090ecc7600d2c58862106d63bc68c96aad9`, blob `bf15219b6b2efe9ef2a4dc08f457e42d5c711715`.
- **Точки проверки кода:** [check_mark:208](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L208), [send_alert:337](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L337), [check_session:365](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L365), [check_events:395](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L395), [check_resources:409](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L409), [send_heartbeat:433](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L433), [send_health:497](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L497), [BIND_TO_PRE_INIT:574](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L574), [BIND_TO_POST_START:575](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L575), [BIND_TO_INIT_MESSAGE:578](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L578), [BIND_TO_MESSAGES_LIST_CHANGED:579](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py#L579).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [HealthMonitor (Diagnostics & Watchdog) 1.1.0](https://github.com/yungspiderq/FPC-HealthMonitor/blob/50b1c090ecc7600d2c58862106d63bc68c96aad9/health_monitor.py), blob `bf15219b6b2e`, мест 1.

<a id="p064"></a>
## P064 — KOSell Rent

- **Сценарий:** Перепродажа аренды KoSell: каталог, выдача, Guard, продление, цены, наличие и автолоты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p064). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Основа HTTP, однако API/лицензионные и дополнительные методы поставщика не подтверждены полностью; обновляющий Python-код переносить напрямую нельзя.
- **Потери/неизвестное:** Основа HTTP, однако API/лицензионные и дополнительные методы поставщика не подтверждены полностью; обновляющий Python-код переносить напрямую нельзя.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, bs4, cardinal, difflib, requests, subprocess, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, kosell.store, ru.kosell.store, www.kosell.store.
- **Версия доказательства:** commit `45e89d31a694ae73fdf05e71e4ee9ec99e00ee94`, blob `1b0973e83cca520e662ff53a4edb1a7301167072`.
- **Точки проверки кода:** [_send:665](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L665), [notify_buyer_problem:673](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L673), [_buyer_key:1039](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1039), [_maybe_refund:1095](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1095), [_stat_mark_refund:1187](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1187), [_process_order:1442](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1442), [_parse_buyer_cmd:1642](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1642), [_handle_buyer_text:1657](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L1657), [BIND_TO_PRE_INIT:5959](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L5959), [BIND_TO_DELETE:5960](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py#L5960).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [KOSell Rent 1.0.0](https://github.com/dzhantdeveloper/KOSellRent-Dzhanto-FunPayCardinal/blob/45e89d31a694ae73fdf05e71e4ee9ec99e00ee94/KOSellRent-1_0_0.py), blob `1b0973e83cca`, мест 1.

<a id="p065"></a>
## P065 — LZT to FunPay Resale

- **Сценарий:** Поиск LZT, пресеты, публикация FunPay-лотов, закупка, выдача, письма/Guard, подтверждения и возвраты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p065). Вердикт относится к выбранной версии 0.20.3.
- **Вердикт:** недостаточно данных. Основная схема HTTP переносима и LZT fast-buy документирован. Для полного вердикта не подтверждены все дополнительные методы почты/SDA, категории и восстановление каждой закупки.
- **Потери/неизвестное:** Основная схема HTTP переносима и LZT fast-buy документирован. Для полного вердикта не подтверждены все дополнительные методы почты/SDA, категории и восстановление каждой закупки.
- **В Funcy:** отсутствует: поставщики удалены
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py), версия 0.20.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.lzt.market, api.steampowered.com, valorant-api.com.
- **Версия доказательства:** commit `b9992c3b69e087843764f68544f3986acf427f0a`, blob `0c580b0fcf7594e9c9b19949c950c8952d8447c3`.
- **Точки проверки кода:** [_purchases_path:566](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L566), [_load_purchases:1016](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1016), [_save_purchases:1023](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1023), [_store_purchased_credentials:1550](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1550), [_purchase_error_details:1731](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1731), [_record_purchase:1745](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1745), [_mark_account_purchased:1764](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1764), [_send_order_message:1795](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L1795), [BIND_TO_DELETE:42](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L42), [BIND_TO_PRE_INIT:6105](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L6105), [BIND_TO_POST_INIT:6106](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L6106), [BIND_TO_NEW_ORDER:6107](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py#L6107).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [LZT to FunPay Resale 0.20.3](https://github.com/no3mpathyyyy/lzt_to_funpay/blob/b9992c3b69e087843764f68544f3986acf427f0a/plugins/lzt_to_fp_resale.py), blob `0c580b0fcf75`, мест 1.

<a id="p066"></a>
## P066 — Manual Actions

- **Сценарий:** Ручные заказы/возвраты, Chat Sync, шаблоны, прибыль, TOTP, Gemini-доступ, Gist и управление лотами.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p066). Вердикт относится к выбранной версии 1.6.22.
- **Вердикт:** недостаточно данных. Ручные заказы, TOTP, HTTP-мост и шаблоны переносимы. Но пакет включает также вывод средств и дополнительные провайдеры; их полный текущий контракт не подтверждён. Нельзя переносимость основной панели выдавать за паритет всего пакета.
- **Потери/неизвестное:** Ручные заказы, TOTP, HTTP-мост и шаблоны переносимы. Но пакет включает также вывод средств и дополнительные провайдеры; их полный текущий контракт не подтверждён. Нельзя переносимость основной панели выдавать за паритет всего пакета.
- **В Funcy:** частично: многие локальные действия есть; мост и дополнительные сервисы удалены/отсутствуют
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/darkydtm/ManualActions/blob/677b79816fc0caff1064ef7f545fa4965e961101/core/config/constants.py), версия 1.6.22; дата 2026-11-03.
- **Лицензия:** GPL-3.0. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `677b79816fc0caff1064ef7f545fa4965e961101`, blob `e6049a66c1641bc1a202f7d6a0cc9545c277ea2e`.
- **Точки проверки кода:** [metadata / entrypoint:1](https://github.com/darkydtm/ManualActions/blob/677b79816fc0caff1064ef7f545fa4965e961101/core/config/constants.py#L1).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life).
- **Версии и копии:** [Manual Actions 1.6.22](https://github.com/darkydtm/ManualActions/blob/677b79816fc0caff1064ef7f545fa4965e961101/core/config/constants.py), blob `e6049a66c164`, мест 1.

<a id="p067"></a>
## P067 — MobileTopUp (DesslyHub Mobile Game Auto Refill)

- **Сценарий:** Каталог мобильных пополнений DesslyHub, поля игрока/сервера, покупка, статус, маржа и dry-run.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p067). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **Потери/неизвестное:** Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `f87e5c81af951c9b18908d9251adaaed55d82dbf`, blob `2d8d3f8fc1f9ec8e7f292c5805de07a34b541120`.
- **Точки проверки кода:** [send_buyer_message:1051](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L1051), [check_low_balance:1214](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L1214), [ask_buyer_data:1406](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L1406), [do_balance:1550](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L1550), [do_check_now:1692](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L1692), [balance:533](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L533), [_legacy_purchase:648](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L648), [check_steam_login:659](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L659), [BIND_TO_PRE_INIT:2380](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L2380), [BIND_TO_POST_START:2381](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L2381), [BIND_TO_NEW_ORDER:2382](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L2382), [BIND_TO_NEW_MESSAGE:2383](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py#L2383).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [MobileTopUp (DesslyHub Mobile Game Auto Refill) 1.0.0](https://github.com/yungspiderq/FPC-MobileTopUp/blob/f87e5c81af951c9b18908d9251adaaed55d82dbf/mobile_topup.py), blob `2d8d3f8fc1f9`, мест 1.

<a id="p068"></a>
## P068 — MUVSell Rent

- **Сценарий:** API-перепродажа Steam-аренды MUVSell: выдача, Guard, продление, наличие, цены и создание лотов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p068). Вердикт относится к выбранной версии 1.2.10.
- **Вердикт:** недостаточно данных. Это клиент внешнего API, не собственная Steam-автоматизация. Но полный действующий контракт MUVSell и все операции продления/восстановления не подтверждены.
- **Потери/неизвестное:** Это клиент внешнего API, не собственная Steam-автоматизация. Но полный действующий контракт MUVSell и все операции продления/восстановления не подтверждены.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py), версия 1.2.10; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, bs4, cardinal, requests, telebot, tg_bot, types, urllib3. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** cold-band-9582.manimanimanimani4444.workers.dev, funpay.com, muvsell.store.
- **Версия доказательства:** commit `dbb1634a28b9c959b1704470b5ec0f6cf1c49543`, blob `6e931325f4b95c570f9cc2e026c7330cd153c06e`.
- **Точки проверки кода:** [_balance:718](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L718), [_low_balance:738](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L738), [_send:838](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L838), [_replace_lot:953](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L953), [_process:1223](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L1223), [_end_refunded:1316](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L1316), [_sync_lots:1735](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L1735), [_sync_lots_now:1749](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L1749), [BIND_TO_PRE_INIT:4275](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L4275), [BIND_TO_INIT_ORDER:4276](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L4276), [BIND_TO_NEW_ORDER:4277](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L4277), [BIND_TO_NEW_MESSAGE:4278](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py#L4278).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [MUVSell Rent 1.2.10](https://github.com/Q-Coldik/MUVSellRent/blob/dbb1634a28b9c959b1704470b5ec0f6cf1c49543/MUVSellRent.py), blob `6e931325f4b9`, мест 1.

<a id="p069"></a>
## P069 — Notion Accounts Auto

- **Сценарий:** Продажа Notion-аккаунтов, привязка пула, выдача и команды управления.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p069). Вердикт относится к выбранной версии 1.0.
- **Вердикт:** недостаточно данных. Основной поток выглядит HTTP/локальным, но надо проверить связанные модули Notion и полный жизненный цикл аккаунта, а не только отправку строки.
- **Потери/неизвестное:** Основной поток выглядит HTTP/локальным, но надо проверить связанные модули Notion и полный жизненный цикл аккаунта, а не только отправку строки.
- **В Funcy:** частично: обычная автовыдача
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py), версия 1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, subprocess, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** app.sonjj.com, www.notion.so.
- **Версия доказательства:** commit `3d620ba871cad7f496f829f08924828f6e8c6eef`, blob `c102c03e3fdb0fc36322e9d2159fc0a5d501e77e`.
- **Точки проверки кода:** [run_async:657](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L657), [reserve:146](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L146), [process_order:393](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L393), [_delivery_message:428](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L428), [process_message:442](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L442), [check_replenish:530](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L530), [send_message:584](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L584), [_send_message_sync:590](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L590), [BIND_TO_PRE_INIT:970](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L970), [BIND_TO_NEW_MESSAGE:971](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L971), [BIND_TO_NEW_ORDER:972](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L972), [BIND_TO_DELETE:973](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py#L973).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Notion Accounts Auto 1.0](https://github.com/IMP4R/notion-funpay/blob/3d620ba871cad7f496f829f08924828f6e8c6eef/NotionAccountPlugim.py), blob `c102c03e3fdb`, мест 1.

<a id="p070"></a>
## P070 — NS.Gifts AutoDelivery

- **Сценарий:** NS.Gifts: коды и Steam-пополнение, цены/маржа, подтверждение, статусы, баланс и рабочие часы.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p070). Вердикт относится к выбранной версии 0.5.1.
- **Вердикт:** недостаточно данных. Публичные /docs и /openapi.json NS.Gifts вернули 410. Код клиента есть, но актуальный контракт всех операций не подтверждён.
- **Потери/неизвестное:** Публичные /docs и /openapi.json NS.Gifts вернули 410. Код клиента есть, но актуальный контракт всех операций не подтверждён.
- **В Funcy:** отсутствует: поставщики удалены
- **Сложность:** высокая; приоритет 3; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py), версия 0.5.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, lot_activation_common, requests, sqlite3, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.ns.gifts, t.me, wholesale.ns.gifts.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `ac6f3a70044d1732c92afbc949f212636cfea0a7`.
- **Точки проверки кода:** [_log_delivery:618](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L618), [_db_get_delivery:666](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L666), [_db_upsert_delivery:676](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L676), [_perform_delivery:940](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L940), [_poll_and_deliver_async:1146](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L1146), [deliver_order_handler:1182](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L1182), [_report_delivery:1315](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L1315), [_persist_delivery_stats:1338](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L1338), [BIND_TO_DELETE:226](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L226), [BIND_TO_DELETE:3458](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L3458), [BIND_TO_PRE_INIT:3460](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L3460), [BIND_TO_POST_INIT:3461](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py#L3461).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [NS.Gifts AutoDelivery 0.5.1](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/ns_gifts_fpc.py), blob `ac6f3a70044d`, мест 1.

<a id="p071"></a>
## P071 — SMM Manager

- **Сценарий:** Управление несколькими SMM-сервисами, каталог, выдача, опрос статусов и меню.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p071). Вердикт относится к выбранной версии Дata слuBa 26.01.2026.
- **Вердикт:** недостаточно данных. Нужно проверить все сервисные API и поведение partial/refill/cancel; факт наличия исходника не подтверждает их актуальность.
- **Потери/неизвестное:** Нужно проверить все сервисные API и поведение partial/refill/cancel; факт наличия исходника не подтверждает их актуальность.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py), версия Дata слuBa 26.01.2026; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, pymysql, requests, subprocess, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, looksmm.ru, service1.com, telegra.ph, twiboost.com, vexboost.ru.
- **Версия доказательства:** commit `baa5342bdaddd32a84b8077b53a0da49c7a89728`, blob `707ea2ba372486fd76c720ec132177ec2ee4c8b2`.
- **Точки проверки кода:** [update_order_refunded_status:356](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L356), [refund_order:372](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L372), [check_order_status:469](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L469), [start_order_checking:627](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L627), [auto_smm_handler:696](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L696), [process_add_subcategories:1006](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L1006), [process_delete_subcategories:1028](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L1028), [generate_lots_keyboard:1242](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L1242), [BIND_TO_PRE_INIT:2453](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L2453), [BIND_TO_NEW_MESSAGE:2454](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L2454), [BIND_TO_NEW_ORDER:2455](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L2455), [BIND_TO_DELETE:2456](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py#L2456).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SMM Manager Дata слuBa 26.01.2026](https://github.com/kokasikhorik-bot/-AutoSmm-veemp/blob/baa5342bdaddd32a84b8077b53a0da49c7a89728/smm_manager.py), blob `707ea2ba3724`, мест 2.

<a id="p072"></a>
## P072 — SMMFlow

- **Сценарий:** Несколько SMM-панелей, услуги, типы заказов, ссылки, комментарии, статусы, refill/cancel где поддержаны.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p072). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** недостаточно данных. Для полной совместимости нужны официальные контракты каждой панели и всех типов услуг; перенос только простого add/status урежет исходник.
- **Потери/неизвестное:** Для полной совместимости нужны официальные контракты каждой панели и всех типов услуг; перенос только простого add/status урежет исходник.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, cryptography, difflib, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, optsmm.ru, twiboost.com.
- **Версия доказательства:** commit `0b19a3d16db1781cc542b9a408c2f0d408830e22`, blob `18afa115414d0a12616b9a679dc7169fc5aaa593`.
- **Точки проверки кода:** [find_pending_by_buyer:667](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L667), [format_balance_rub:954](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L954), [_cmd_status_buyer:1711](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L1711), [_send_status:1764](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L1764), [_cmd_refill_buyer:1787](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L1787), [_order_checker:1983](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L1983), [_service_watch_checker:4124](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4124), [_balance_checker:4249](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4249), [BIND_TO_PRE_INIT:4351](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4351), [BIND_TO_POST_INIT:4352](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4352), [BIND_TO_NEW_ORDER:4353](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4353), [BIND_TO_ORDER_STATUS_CHANGED:4354](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py#L4354).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SMMFlow 1.1.0](https://github.com/dzhantdeveloper/SMM-FLOW-AutoSmm-FunPayCardinal/blob/0b19a3d16db1781cc542b9a408c2f0d408830e22/SmmFlow.py), blob `18afa115414d`, мест 1.

<a id="p073"></a>
## P073 — SMMWay Price AutoSync

- **Сценарий:** Синхронизация цен панели SMMWay с лотами, preview, минимальная цена и диагностика ID.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p073). Вердикт относится к выбранной версии 2.1.0.
- **Вердикт:** недостаточно данных. Построение JS-клиента возможно, но публичный контракт текущей панели сейчас не проверен. Это синхронизация с поставщиком, не конкурентный демпинг.
- **Потери/неизвестное:** Построение JS-клиента возможно, но публичный контракт текущей панели сейчас не проверен. Это синхронизация с поставщиком, не конкурентный демпинг.
- **В Funcy:** частично: расчёт цены есть; supplier sync отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py), версия 2.1.0; дата 2026-11-03.
- **Лицензия:** GPL-3.0. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, decimal, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, smmway.ru.
- **Версия доказательства:** commit `b08153f87936e1fafe7ea8db64e60d882eb66122`, blob `6fd81bedd135b6827c21bfce75ccbc57f718b883`.
- **Точки проверки кода:** [calculate_new_price:372](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L372), [process_lot:511](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L511), [send:758](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L758), [BIND_TO_PRE_INIT:988](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L988), [BIND_TO_INIT:989](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L989), [BIND_TO_DELETE:990](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py#L990).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SMMWay Price AutoSync 2.1.0](https://github.com/speedyticket/smmway-autosync-cardinal/blob/b08153f87936e1fafe7ea8db64e60d882eb66122/autosync.py), blob `6fd81bedd135`, мест 1.

<a id="p074"></a>
## P074 — Steam Points Delivery

- **Сценарий:** Выдача Steam Points, проверка ссылки, привязки лотов, доступные в конкретном варианте промокоды.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p074). Вердикт относится к выбранной версии 0.0.41.
- **Вердикт:** недостаточно данных. Код доступен, но часть поставщиков и механизм доступа требуют актуального подтверждения API; наличие HTTP само по себе не доказывает сохранение всех операций.
- **Потери/неизвестное:** Код доступен, но часть поставщиков и механизм доступа требуют актуального подтверждения API; наличие HTTP само по себе не доказывает сохранение всех операций.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py), версия 0.0.41; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, fcntl, requests, telebot, tg_bot, xml. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.buysteampoints.com, funpay.com, raw.githubusercontent.com, steamcommunity.com.
- **Версия доказательства:** commit `bc86b40116676f54ee827c0dd7319808b86f2404`, blob `192e15c3758568a635605be0d3645caa6bfd59e7`.
- **Точки проверки кода:** [new_order_handler:1776](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1776), [new_message_handler:1786](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1786), [generate_promocode:216](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L216), [send_message:299](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L299), [send_promocode_request:361](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L361), [calculate_points:399](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L399), [send_link_request:410](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L410), [send_confirmation_request:590](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L590), [BIND_TO_PRE_INIT:1801](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1801), [BIND_TO_NEW_ORDER:1802](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1802), [BIND_TO_NEW_MESSAGE:1803](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1803), [BIND_TO_DELETE:1804](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py#L1804).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Steam Points Delivery 0.0.41](https://github.com/harrrdie/fpc-autosteampoints-plugin/blob/bc86b40116676f54ee827c0dd7319808b86f2404/auto_steam_points.py), blob `192e15c37585`, мест 1.

<a id="p075"></a>
## P075 — Steam SMM

- **Сценарий:** Steam SMM: разные услуги, поставщики, баланс, контроль прибыли, статусы и возврат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p075). Вердикт относится к выбранной версии 1.1.0.
- **Вердикт:** недостаточно данных. HTTP-перенос вероятен, но все нестандартные услуги и провайдеры не подтверждены официальными контрактами; простой SMM-клиент не обеспечивает паритет.
- **Потери/неизвестное:** HTTP-перенос вероятен, но все нестандартные услуги и провайдеры не подтверждены официальными контрактами; простой SMM-клиент не обеспечивает паритет.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py), версия 1.1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, steamcommunity.com, steamsmm.ru, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `9cd69e23a23908f59062a1060ed12fb7bc5ed97d`.
- **Точки проверки кода:** [get_buyer_active_orders:885](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L885), [set_buyer_active_order:889](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L889), [get_buyer_active_order:903](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L903), [remove_buyer_active_order:908](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L908), [_account_purchase_mapping:1459](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L1459), [_provider_balance:2240](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L2240), [_waiting_for_buyer:2499](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L2499), [_send_buyer:2807](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L2807), [BIND_TO_PRE_INIT:9512](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L9512), [BIND_TO_NEW_ORDER:9513](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L9513), [BIND_TO_NEW_MESSAGE:9514](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L9514), [BIND_TO_DELETE:9515](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py#L9515).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Steam SMM 1.1.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_smm_fpc.py), blob `9cd69e23a239`, мест 1.

<a id="p076"></a>
## P076 — SteamTopUp (DesslyHub Auto Steam Wallet Top-Up)

- **Сценарий:** Пополнение Steam через DesslyHub, проверка логина, валюты, legacy/v2 HMAC, опрос статуса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p076). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **Потери/неизвестное:** Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `31e1c4509907d3bfe910cf0d3a7ac0289140b16f`, blob `980439331670008cede8b3cc05a435161090f812`.
- **Точки проверки кода:** [send_buyer_message:1051](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L1051), [check_low_balance:1214](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L1214), [ask_buyer_data:1406](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L1406), [do_balance:1550](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L1550), [do_check_now:1692](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L1692), [balance:533](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L533), [_legacy_purchase:648](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L648), [check_steam_login:659](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L659), [BIND_TO_PRE_INIT:2276](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L2276), [BIND_TO_POST_START:2277](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L2277), [BIND_TO_NEW_ORDER:2278](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L2278), [BIND_TO_NEW_MESSAGE:2279](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py#L2279).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SteamTopUp (DesslyHub Auto Steam Wallet Top-Up) 1.0.0](https://github.com/yungspiderq/FPC-SteamTopUp/blob/31e1c4509907d3bfe910cf0d3a7ac0289140b16f/steam_topup.py), blob `980439331670`, мест 1.

<a id="p077"></a>
## P077 — TelegramAccounts

- **Сценарий:** Подбор и покупка Telegram-аккаунтов через LZT, выдача данных и кодов, прибыль и настройка фильтров.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p077). Вердикт относится к выбранной версии 1.7.2.
- **Вердикт:** недостаточно данных. Вызовы LZT идут по HTTP, импорт pymysql не используется как подключение. Полный перенос требует проверки всех покупок и выдачи кодов через актуальные методы LZT и восстановления неопределённых результатов.
- **Потери/неизвестное:** Вызовы LZT идут по HTTP, импорт pymysql не используется как подключение. Полный перенос требует проверки всех покупок и выдачи кодов через актуальные методы LZT и восстановления неопределённых результатов.
- **В Funcy:** отсутствует: поставщики удалены
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py), версия 1.7.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, concurrent, pymysql, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.lzt.market, funpay.com, prod-api.lzt.market.
- **Версия доказательства:** commit `ef6d2dc83258f5e7fc04a19ee68993368ba92c42`, blob `21b7d9cebeab5ea843c39d38e3bc553a135d2e56`.
- **Точки проверки кода:** [background_check_lolz_api:90](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L90), [process_country_name_edit:1582](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1582), [process_country_min_edit:1610](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1610), [process_country_max_edit:1647](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1647), [send_message_to_buyer:1698](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1698), [try_purchase_accounts:1775](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1775), [purchase_account:1842](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L1842), [process_order_queue:2124](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L2124), [BIND_TO_PRE_INIT:2432](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L2432), [BIND_TO_NEW_MESSAGE:2433](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L2433), [BIND_TO_NEW_ORDER:2434](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L2434), [BIND_TO_EXIT:2435](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py#L2435).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [TelegramAccounts 1.7.2](https://github.com/pica105/auto-tg/blob/ef6d2dc83258f5e7fc04a19ee68993368ba92c42/AutoTG%20SY.py), blob `21b7d9cebeab`, мест 1.

<a id="p078"></a>
## P078 — VipRoblox

- **Сценарий:** VIP-серверы Roblox: пул, очередь, сроки, продление, бонусы, проверка сервера и смена ссылки.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p078). Вердикт относится к выбранной версии 1.3.0.
- **Вердикт:** недостаточно данных. Большая часть логики локальна/HTTP, но не проверены все legacy Roblox endpoints, смена ссылок и несколько cookie-сессий. Полная аренда без потери управления доступом не доказана.
- **Потери/неизвестное:** Большая часть логики локальна/HTTP, но не проверены все legacy Roblox endpoints, смена ссылок и несколько cookie-сессий. Полная аренда без потери управления доступом не доказана.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py), версия 1.3.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, lot_activation_common, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** auth.roblox.com, funpay.com, games.roblox.com, t.me, users.roblox.com, www.roblox.com.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `488b6c831352b0aeb91186619f1a9b9d253056ae`.
- **Точки проверки кода:** [roblox_regenerate_link:618](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L618), [_load_buyer_lang:1224](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1224), [_save_buyer_lang:1229](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1229), [_lang_for_buyer:1257](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1257), [_buyer_active_count:1362](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1362), [_run_liveness_check:1481](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1481), [_send_buyer:1659](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1659), [_process_queue:1755](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L1755), [BIND_TO_SETTINGS_PAGE:3470](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L3470), [BIND_TO_PRE_INIT:3471](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L3471), [BIND_TO_NEW_ORDER:3504](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L3504), [BIND_TO_NEW_MESSAGE:3505](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py#L3505).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [VipRoblox 1.3.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/vip_roblox.py), blob `488b6c831352`, мест 1.

<a id="p079"></a>
## P079 — VoucherShop (DesslyHub Auto Voucher Delivery)

- **Сценарий:** Каталог ваучеров DesslyHub, привязки, закупка кодов, выдача, цена и dry-run.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p079). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **Потери/неизвестное:** Legacy DesslyHub v1 документирован. Однако этот исходник также поддерживает v2 HMAC (/orders, /catalog), а проверяемая официальная спецификация v2 в этом проходе недоступна. Только legacy-перенос урежет набор режимов.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 3; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** desslyhub.com, desslyhub.readme.io, t.me.
- **Версия доказательства:** commit `8d88851752af10c32c0ff72fbeef17bdc350ef4f`, blob `d7b89ed3b12f960dcbdd829cdf4276dc63b060ab`.
- **Точки проверки кода:** [send_buyer_message:1044](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L1044), [check_low_balance:1207](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L1207), [ask_buyer_data:1399](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L1399), [do_balance:1543](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L1543), [do_check_now:1685](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L1685), [balance:526](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L526), [_legacy_purchase:641](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L641), [check_steam_login:652](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L652), [BIND_TO_PRE_INIT:2292](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L2292), [BIND_TO_POST_START:2293](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L2293), [BIND_TO_NEW_ORDER:2294](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L2294), [BIND_TO_NEW_MESSAGE:2295](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py#L2295).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [VoucherShop (DesslyHub Auto Voucher Delivery) 1.0.0](https://github.com/yungspiderq/FPC-VoucherShop/blob/8d88851752af10c32c0ff72fbeef17bdc350ef4f/voucher_shop.py), blob `d7b89ed3b12f`, мест 1.

<a id="p080"></a>
## P080 — Advanced Profile Stat

- **Сценарий:** Продажи, возвраты, доступный баланс и расширенная статистика профиля.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p080). Вердикт относится к выбранной версии 0.0.12.
- **Вердикт:** полный перенос. Чтение истории и агрегирование; нет зависимости от серверного Python. Telegram-вывод заменяется экраном, сводки можно сохранить через Bot API.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: финансы и аналитика, проверить состав метрик
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py), версия 0.0.12; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `144583c7d8029d969dc3fdf715431a1b694dc4b8`, blob `c10ab83304c4b49a27c7bd27bf068290b1052082`.
- **Точки проверки кода:** [generate_adv_profile:30](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py#L30), [BIND_TO_PRE_INIT:271](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py#L271), [BIND_TO_NEW_MESSAGE:272](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py#L272), [BIND_TO_DELETE:273](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py#L273).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Advanced Profile Stat 0.0.12](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/adv_profile_stat.py), blob `c10ab83304c4`, мест 1; [Advanced Profile Stat 0.0.11](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/adv_profile_stat.py), blob `323dff66a5f5`, мест 2; [Advanced Profile Stat 0.0.4](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/adv_profile_stat.py), blob `5f11d1323aaf`, мест 1.
- **Telegram-публикации:** [adv_profile_stat.py](https://t.me/cloudecode/8), [adv_profile_stat.py](https://t.me/fpc_plugins/4), [adv_profile_stat.py](https://t.me/fpc_plugins/6), [adv_profile_stat.py](https://t.me/fpc_plugins/7), [adv_profile_stat.py](https://t.me/fpc_plugins/41), [adv_profile_stat.py](https://t.me/fpc_plugins/80), [adv_profile_stat.py](https://t.me/fpc_plugins/85), [adv_profile_stat.py](https://t.me/fpc_plugins/97), [adv_profile_stat.py](https://t.me/fpc_plugins/102), [adv_profile_stat.py](https://t.me/fpc_plugins/104), [adv_profile_stat.py](https://t.me/fpc_plugins/118), [adv_profile_stat.py](https://t.me/fpc_plugins/126). Байты вложений не сравнивались.

<a id="p081"></a>
## P081 — Auto Response Order

- **Сценарий:** Сообщения после оплаты/смены состояния заказа и шаблоны.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p081). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. События заказа и существующий отправитель; очередь и обработанные ID сохраняются.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: автоответы после оплаты и подтверждения
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `325c12ba026dbc21e11dd4e0c8fddee233601895`, blob `af73224b36387132a9807690dfdcbd3b0ce5a917`.
- **Точки проверки кода:** [_build_replacements:96](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py#L96), [process_text:130](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py#L130), [BIND_TO_PRE_INIT:387](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py#L387), [BIND_TO_NEW_MESSAGE:388](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py#L388), [BIND_TO_DELETE:389](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py#L389).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Response Order 1.0.0](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Response-Order/blob/325c12ba026dbc21e11dd4e0c8fddee233601895/auto_response_order.py), blob `af73224b3638`, мест 1.

<a id="p082"></a>
## P082 — AutoRecognizeLot

- **Сценарий:** Распознавание купленного лота и связи с настройками выдачи, диагностика несовпадений.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p082). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Разбор фактов заказа и устойчивые offer ID; тот же класс задач уже решает verifier Funcy. Не переносить угадывание по одному названию как гарантию.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: order facts и проверка лота
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `e8a3c66ef9113b227be0804b23b6abe3e19b8047`, blob `f53cabfa975bafc1e089dd0dc6b0f85e79863584`.
- **Точки проверки кода:** [_load:34](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L34), [_save:49](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L49), [_detect_lot_id:58](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L58), [_on_new_message:69](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L69), [BIND_TO_DELETE:24](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L24), [BIND_TO_NEW_MESSAGE:122](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L122), [BIND_TO_NEW_ORDER:140](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L140), [BIND_TO_PRE_INIT:430](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py#L430).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoRecognizeLot 1.0.1](https://github.com/zap90a/AutoRecognizeLot/blob/e8a3c66ef9113b227be0804b23b6abe3e19b8047/AutoRecognizeLot.py), blob `f53cabfa975b`, мест 1.

<a id="p083"></a>
## P083 — Category Stats

- **Сценарий:** Суммы и количество продаж по игре/категории и периодам.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p083). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Постраничная история и локальная агрегация; нет особых протоколов.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: аналитика и детализация по категориям
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `fb14b18468938c5a260b2fb37ca59385b2f33ffb`, blob `f674de97e710e4b36de63580d81f195e585bd4dc`.
- **Точки проверки кода:** [_fmt:43](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L43), [_fmt_price:57](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L57), [_detect_periods:66](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L66), [_collect_sales:94](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L94), [BIND_TO_PRE_INIT:445](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L445), [BIND_TO_NEW_MESSAGE:446](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L446), [BIND_TO_DELETE:447](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py#L447).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Category Stats 1.0.0](https://github.com/Kewanmov/FunPay-Cardinal-Category-Stats/blob/fb14b18468938c5a260b2fb37ca59385b2f33ffb/category_stats.py), blob `f674de97e710`, мест 1.

<a id="p084"></a>
## P084 — Cookie Changer Plugin

- **Сценарий:** Смена golden_key и повторная инициализация аккаунта.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p084). Вердикт относится к выбранной версии 0.0.2.
- **Вердикт:** полный перенос. Funcy уже имеет cookies API, хранилище аккаунтов и смену профиля; перенос не требует передачи ключа в Telegram.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: аккаунты и vault
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `c8b4b52827d6e76a785f39b1296192b14fb958ce`, blob `6b04de8798f47e39f71397b1ff9382b94c6787e5`.
- **Точки проверки кода:** [init_commands:17](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py#L17), [change_cookie:24](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py#L24), [BIND_TO_PRE_INIT:39](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py#L39), [BIND_TO_DELETE:40](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py#L40).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Cookie Changer Plugin 0.0.2](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/cookie_changer.py), blob `6b04de8798f4`, мест 1.
- **Telegram-публикации:** [cookie_changer.py](https://t.me/fpc_plugins/3). Байты вложений не сравнивались.

<a id="p085"></a>
## P085 — Copy Offer Plugin

- **Сценарий:** Копирование предложения с редактированием полей, картинки, автоответа и автовыдачи перед созданием.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p085). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Формы FunPay и существующий clone/import поток; сохраняется preview и выбор подкатегории.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть основа: клонирование и редактор
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, requests, shlex, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, translate.googleapis.com.
- **Версия доказательства:** commit `8abd2bd3eae6201a67d1aad30c8c28789d11454e`, blob `233420ea91feecc487e0a2b46478d46ab96dbfad`.
- **Точки проверки кода:** [parse_buy_page:284](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py#L284), [_sync_fields_images:736](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py#L736), [BIND_TO_PRE_INIT:1375](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py#L1375), [BIND_TO_DELETE:1376](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py#L1376).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Copy Offer Plugin 1.0.0](https://github.com/gdhfufhfhhhchfhf-wq/svc-task-runner/blob/8abd2bd3eae6201a67d1aad30c8c28789d11454e/plugins/copy_offer_plugin.py), blob `233420ea91fe`, мест 1.

<a id="p086"></a>
## P086 — Delete Lots

- **Сценарий:** Пакетное удаление лотов по категориям, выбор, прогресс и остановка.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p086). Вердикт относится к выбранной версии 0.0.2.
- **Вердикт:** полный перенос. HTTP-операции уже доступны; deleted guard и общая очередь не дают отложенной записи воскресить лот.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: массовое удаление
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** bs4, cardinal, pip, pydantic, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `3236bef54659585484eb5f6096f88866158e24ab`.
- **Точки проверки кода:** [log:31](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L31), [_get_path:54](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L54), [_load:59](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L59), [_save:66](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L66), [BIND_TO_DELETE:411](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L411), [BIND_TO_PRE_INIT:412](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py#L412).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Delete Lots 0.0.2](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/delete_lots.py), blob `3236bef54659`, мест 1; [Delete Lots 0.0.2](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/delete_lots.py), blob `a5a98f18926d`, мест 1.

<a id="p087"></a>
## P087 — FunPay User-Agent Rotator

- **Сценарий:** Генерация/импорт User-Agent, проверка через внешний сервис, выбор значения для FunPay.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p087). Вердикт относится к выбранной версии 0.1.0.
- **Вердикт:** полный перенос. Генерация и импорт строк UA локальны. Установка User-Agent для исходящих запросов расширения реализуется через DNR с ограничением initiator/domain; это проверено на синтетическом MV3. Плагин не изменяет TLS/browser fingerprint и не обещает этого.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** отсутствует
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py), версия 0.1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** whatmyuseragent.com.
- **Версия доказательства:** commit `bc85aaaaded01da7043cb36ff61619f854ab6237`, blob `e7dcb439272f163f144fdf534e82989c4cd5f6d4`.
- **Точки проверки кода:** [_build_generated_user_agent:688](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L688), [_generate_from_pool:747](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L747), [_tg_send:929](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L929), [_register_tg_handlers:1479](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L1479), [BIND_TO_DELETE:34](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L34), [BIND_TO_PRE_INIT:1517](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L1517), [BIND_TO_POST_INIT:1518](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L1518), [BIND_TO_NEW_MESSAGE:1519](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py#L1519).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [FunPay User-Agent Rotator 0.1.0](https://github.com/ThisTakou/FPC-UserAgentAuto-Rotate-Generate/blob/bc85aaaaded01da7043cb36ff61619f854ab6237/funpay_useragent_rotator.py), blob `e7dcb439272f`, мест 1.

<a id="p088"></a>
## P088 — Graphs Plugin

- **Сценарий:** Графики продаж и баланса за периоды, изображение отчёта.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p088). Вердикт относится к выбранной версии 0.0.6.
- **Вердикт:** полный перенос. Вычисления локальны; matplotlib заменяется Canvas/SVG, результат можно экспортировать и отправить через HTTP.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: графики и экспорт аналитики
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py), версия 0.0.6; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, matplotlib, mplcyberpunk, numpy, pandas, pip, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `c306d329272aee6b64715e095c7c3e5aebf52bf9`.
- **Точки проверки кода:** [init_commands:71](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L71), [switch:84](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L84), [edit:112](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L112), [save_config:121](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L121), [BIND_TO_PRE_INIT:620](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L620), [BIND_TO_DELETE:621](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py#L621).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-offscreen](compatibility.md#chrome-offscreen), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Graphs Plugin 0.0.6](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/graphs_plugin.py), blob `c306d329272a`, мест 1.
- **Telegram-публикации:** [graphs_plugin.py](https://t.me/fpc_plugins/47), [graphs_plugin.py](https://t.me/fpc_plugins/48), [graphs_plugin.py](https://t.me/fpc_plugins/49), [graphs_plugin.py](https://t.me/fpc_plugins/86), [graphs_plugin.py](https://t.me/fpc_plugins/107), [graphs_plugin.py](https://t.me/fpc_plugins/110). Байты вложений не сравнивались.

<a id="p089"></a>
## P089 — LotPlugin

- **Сценарий:** Ручные действия над лотами, выбор категории и массовое удаление.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p089). Вердикт относится к выбранной версии 0.0.2.
- **Вердикт:** полный перенос. Всё сводится к чтению/записи лотов FunPay; команды заменяются существующей страницей управления.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: массовое редактирование и удаление
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, colorama, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, t.me.
- **Версия доказательства:** commit `103561501ea7feaef3a36ca3861f1dbdc80af6f7`, blob `f36ee4d7c0cfd18b720aec5f32e7c794cece5a44`.
- **Точки проверки кода:** [init_commands:48](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L48), [modified_settings_sections:56](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L56), [create_categories_keyboard:70](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L70), [lots_page:105](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L105), [BIND_TO_PRE_INIT:223](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L223), [BIND_TO_DELETE:225](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py#L225).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [LotPlugin 0.0.2](https://github.com/Gashan56/AutoLotsPlugin/blob/103561501ea7feaef3a36ca3861f1dbdc80af6f7/lots_plugin.py), blob `f36ee4d7c0cf`, мест 1.

<a id="p090"></a>
## P090 — Lots Copy Plugin

- **Сценарий:** Копирование лотов между аккаунтами, сохранение полей и пакетная обработка.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p090). Вердикт относится к выбранной версии 0.0.5.
- **Вердикт:** полный перенос. HTTP-формы и экспорт данных; перенос между аккаунтами выполняется последовательно через подтверждённые профили Funcy.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: клонирование, импорт и экспорт; проверить полный набор полей
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py), версия 0.0.5; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `144583c7d8029d969dc3fdf715431a1b694dc4b8`, blob `82ebbcdda4059509f3004bc884bab27600aa9f47`.
- **Точки проверки кода:** [download_file:51](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L51), [init_commands:74](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L74), [get_current_account:80](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L80), [get_second_account:102](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L102), [BIND_TO_PRE_INIT:386](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L386), [BIND_TO_DELETE:387](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py#L387).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Lots Copy Plugin 0.0.5](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/copy_lots_plugin.py), blob `82ebbcdda405`, мест 1; [Lots Copy Plugin 0.0.4](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/copy_lots_plugin.py), blob `6309df9dfb7c`, мест 1; [Lots Copy Plugin 0.0.4](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/copy_lots_plugin.py), blob `e093b7d9ddc9`, мест 1; [Lots Copy Plugin 0.0.3](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/copy_lots_plugin.py), blob `3df81e335ad6`, мест 3; [Lots Copy Plugin 0.0.3](https://github.com/neclown-byte/fpc/blob/0ead1bb3a4e75fc07f9b85c6797505a3f499f4fc/plugins/copy_lots_plugin.py), blob `c6eb8b408c73`, мест 1; [Lots Copy Plugin 0.0.2](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/copy_lots_plugin.py), blob `5cf1432e2a43`, мест 6.
- **Telegram-публикации:** [copy_lots_plugin.py](https://t.me/fpc_plugins/31), [copy_lots_plugin.py](https://t.me/fpc_plugins/82). Байты вложений не сравнивались.

<a id="p091"></a>
## P091 — LotsScheduler (Lot Schedule / Night Mode)

- **Сценарий:** Правила по дням, времени и категориям; удержание выключенных лотов и восстановление состояния после рестарта.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p091). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Модель blockers/расписаний Funcy уже подходит; временные окна вычисляются по текущему времени и восстанавливаются на startup.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: расписания и resolver активности
- **Сложность:** средняя; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-LotsSchedule/blob/dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf/lots_schedule.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, handlers, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf`, blob `eedfda04123d75ba026fab621008e62bd530e3be`.
- **Точки проверки кода:** [_scheduler_tick:410](https://github.com/yungspiderq/FPC-LotsSchedule/blob/dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf/lots_schedule.py#L410), [BIND_TO_PRE_INIT:1094](https://github.com/yungspiderq/FPC-LotsSchedule/blob/dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf/lots_schedule.py#L1094), [BIND_TO_DELETE:1095](https://github.com/yungspiderq/FPC-LotsSchedule/blob/dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf/lots_schedule.py#L1095).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [LotsScheduler (Lot Schedule / Night Mode) 1.0.1](https://github.com/yungspiderq/FPC-LotsSchedule/blob/dc4be3fa1f493e0a79f0bf97b7ecb7a5aa12cfcf/lots_schedule.py), blob `eedfda04123d`, мест 1.

<a id="p092"></a>
## P092 — Money Generator Plugin

- **Сценарий:** Шуточная обработка аватара: изображение денег и изменение фото профиля.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p092). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** полный перенос. Реальная функция — графический эффект, а не увеличение баланса. PIL заменяется Canvas, загрузка аватара — HTTP.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: генератор изображений; реальной денежной функции нет
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, PIL, announcements, cardinal, requests, requests_toolbelt, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, www.freeiconspng.com.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `c550b362fbee56bc6963605133a9768143732362`.
- **Точки проверки кода:** [generate:115](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py#L115), [money_generate_click:170](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py#L170), [reg_tg_handlers:260](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py#L260), [BIND_TO_PRE_INIT:272](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py#L272), [BIND_TO_DELETE:273](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py#L273).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-offscreen](compatibility.md#chrome-offscreen), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Money Generator Plugin 0.0.1](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/money_generator_plugin.py), blob `c550b362fbee`, мест 1.
- **Telegram-публикации:** [money_generator_plugin.py](https://t.me/fpc_plugins/145). Байты вложений не сравнивались.

<a id="p093"></a>
## P093 — Newbie Greetings Plugin

- **Сценарий:** Приветствие первого сообщения, отметка обработанного чата и уведомление продавца.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p093). Вердикт относится к выбранной версии 0.0.3.
- **Вердикт:** полный перенос. Событие чата и долговечная отметка; можно сохранить уведомление Bot API при необходимости.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: приветствия и кулдаун
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py), версия 0.0.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `ebc119cba1745e5ab3f5ef93189d1c524906fb88`, blob `a52e9447c57457c68ec6693a0b5d349fe1062418`.
- **Точки проверки кода:** [send_newbie_notification:104](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L104), [send_newbie_message:113](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L113), [generate_settings_keyboard:137](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L137), [BIND_TO_PRE_INIT:224](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L224), [BIND_TO_NEW_MESSAGE:225](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L225), [BIND_TO_INIT_MESSAGE:226](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L226), [BIND_TO_DELETE:227](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py#L227).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Newbie Greetings Plugin 0.0.3](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/newbie_greetings_plugin.py), blob `a52e9447c574`, мест 1.

<a id="p094"></a>
## P094 — Old Keyboard Plugin

- **Сценарий:** Восстановление старой раскладки Telegram-клавиатуры Cardinal.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p094). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** полный перенос. По согласованию управление заменяется Funcy; отдельной бизнес-функции нет. При сохранении Telegram раскладка Bot API тоже воспроизводима.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** не требуется в интерфейсе расширения
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `8511ce63895ab266d01f8c5b0a98e4bc56626a44`, blob `e007abd1ff5ee62181ccedbd671c4e8b1925818f`.
- **Точки проверки кода:** [main:23](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py#L23), [close_keyboard:32](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py#L32), [BIND_TO_PRE_INIT:49](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py#L49), [BIND_TO_DELETE:50](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py#L50).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Old Keyboard Plugin 0.0.1](https://github.com/Fru1sik/FunpayCardinalBot/blob/8511ce63895ab266d01f8c5b0a98e4bc56626a44/plugins/old_keyboard_plugin.py), blob `e007abd1ff5e`, мест 11; [Old Keyboard Plugin 0.0.1](https://github.com/neclown-byte/fpc/blob/0ead1bb3a4e75fc07f9b85c6797505a3f499f4fc/plugins/old_keyboard_plugin.py), blob `a99c0cc02101`, мест 1.
- **Telegram-публикации:** [old_keyboard_plugin.py](https://t.me/fpc_plugins/55). Байты вложений не сравнивались.

<a id="p095"></a>
## P095 — Order Confirm Plugin

- **Сценарий:** Ответ покупателю и уведомление продавца после подтверждения заказа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p095). Вердикт относится к выбранной версии 0.0.3.
- **Вердикт:** полный перенос. Смена статуса заказа и сохранённая дедупликация; оба канала отправки технически доступны.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: сообщение после подтверждения
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py), версия 0.0.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `ebc119cba1745e5ab3f5ef93189d1c524906fb88`, blob `fb533bc8cc405ffe7eed82872b4ffea57a4f56e6`.
- **Точки проверки кода:** [send_thank_u_message_handler:68](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L68), [send_notification_handler:89](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L89), [generate_settings_keyboard:106](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L106), [BIND_TO_PRE_INIT:197](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L197), [BIND_TO_ORDER_STATUS_CHANGED:198](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L198), [BIND_TO_DELETE:199](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py#L199).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Order Confirm Plugin 0.0.3](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/order_confirm_reply_plugin.py), blob `fb533bc8cc40`, мест 1.

<a id="p096"></a>
## P096 — PriceCalc (Commission & Net Price Calculator)

- **Сценарий:** Прямая/обратная цена с комиссией, способы оплаты, минимальная цена категории и тестовый расчёт.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p096). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Штатный FunPay calc уже используется в расширении; операции чтения и расчёта полностью доступны.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть основа: цена покупателя и комиссия
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c`, blob `215d710bda2711ecf0e86c25abeb0bc8d154f602`.
- **Точки проверки кода:** [_do_calc:202](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py#L202), [forward_calc:222](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py#L222), [reverse_calc:252](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py#L252), [BIND_TO_PRE_INIT:567](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py#L567), [BIND_TO_DELETE:568](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py#L568).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [PriceCalc (Commission & Net Price Calculator) 1.0.0](https://github.com/yungspiderq/FPC-PriceCalc/blob/13d61ebcf7bfb1fb5bf160619cb6c19e5c60443c/price_calc.py), blob `215d710bda27`, мест 1.

<a id="p097"></a>
## P097 — Profile Reviews Count

- **Сценарий:** Подсчёт отзывов и дополнение статистики профиля.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p097). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** полный перенос. Парсинг данных профиля и локальный подсчёт; все пользовательские операции воспроизводимы.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: отзывы и аналитика
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Code-Wizard-Wilson/Funpay_Reviews_Count/blob/b003d440a762c774968227447c72b04194388d71/profile_reviews_count.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `b003d440a762c774968227447c72b04194388d71`, blob `af456a0e600707811073a42f5e066a4deb970fcc`.
- **Точки проверки кода:** [generate_profile_text_with_reviews:85](https://github.com/Code-Wizard-Wilson/Funpay_Reviews_Count/blob/b003d440a762c774968227447c72b04194388d71/profile_reviews_count.py#L85), [BIND_TO_PRE_INIT:119](https://github.com/Code-Wizard-Wilson/Funpay_Reviews_Count/blob/b003d440a762c774968227447c72b04194388d71/profile_reviews_count.py#L119), [BIND_TO_DELETE:120](https://github.com/Code-Wizard-Wilson/Funpay_Reviews_Count/blob/b003d440a762c774968227447c72b04194388d71/profile_reviews_count.py#L120).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life).
- **Версии и копии:** [Profile Reviews Count 0.0.1](https://github.com/Code-Wizard-Wilson/Funpay_Reviews_Count/blob/b003d440a762c774968227447c72b04194388d71/profile_reviews_count.py), blob `af456a0e6007`, мест 1.

<a id="p098"></a>
## P098 — QuickReplies (Fast Answer Templates)

- **Сценарий:** Именованные быстрые ответы, username, preview и отправка в выбранный чат.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p098). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Шаблоны и отправитель воспроизводимы; Telegram-меню заменяется UI Funcy по согласованному условию.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: быстрые ответы и шаблоны
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `9ef3b669f73e2f17f0b9d83c61983c2f393fff55`, blob `a6467b1e9f93931fa54a99fb62f2f86cce59876c`.
- **Точки проверки кода:** [send_template:213](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py#L213), [act_send:461](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py#L461), [confirm_send:513](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py#L513), [BIND_TO_PRE_INIT:572](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py#L572), [BIND_TO_DELETE:573](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py#L573).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [QuickReplies (Fast Answer Templates) 1.0.0](https://github.com/yungspiderq/FPC-QuickReplies/blob/9ef3b669f73e2f17f0b9d83c61983c2f393fff55/quick_replies.py), blob `a6467b1e9f93`, мест 1.

<a id="p099"></a>
## P099 — Review Bonus

- **Сценарий:** Однократный бонус после отзыва с оценкой, шаблоны и журнал обработанных заказов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p099). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Состояние заказа и отправка сообщения/товара через доступные HTTP-пути; сохранить атомарную отметку выдачи и неопределённый исход.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: бонусы за отзыв
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, t.me.
- **Версия доказательства:** commit `fb37f5b0d52f32a466839819bb9821a816314aef`, blob `d697a6291dead9c1a6849d7767564837a6cd2774`.
- **Точки проверки кода:** [message_handler:117](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L117), [process_new_message:345](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L345), [process_new_bonus:357](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L357), [process_min_stars:372](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L372), [BIND_TO_NEW_MESSAGE:444](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L444), [BIND_TO_PRE_INIT:445](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L445), [BIND_TO_DELETE:446](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py#L446).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Review Bonus 1.0.0](https://github.com/nullcaste/funpay-cardinal-auto-bonus-plugin-fpc-plugin/blob/fb37f5b0d52f32a466839819bb9821a816314aef/review_bonus.py), blob `d697a6291dea`, мест 1.

<a id="p100"></a>
## P100 — Review Chat Reply

- **Сценарий:** Сообщение покупателю после отзыва, фильтры оценки и скрытого отзыва, шаблоны.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p100). Вердикт относится к выбранной версии 0.0.10.
- **Вердикт:** полный перенос. События/сверка заказов и чатовый HTTP; ограничения и дедупликация можно сохранить в журнале Funcy.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: отзывы, бонусы и ответы в чат
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py), версия 0.0.10; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, Utils, cardinal, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `005dc09850cba7025754d3386699882de2d4ef0c`.
- **Точки проверки кода:** [init:73](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L73), [message_hook:173](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L173), [edit:82](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L82), [edited:96](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L96), [BIND_TO_PRE_INIT:211](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L211), [BIND_TO_NEW_MESSAGE:212](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L212), [BIND_TO_LAST_CHAT_MESSAGE_CHANGED:213](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L213), [BIND_TO_DELETE:214](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py#L214).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Review Chat Reply 0.0.10](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/review_chat_reply.py), blob `005dc09850cb`, мест 1; [Review Chat Reply 0.0.10](https://github.com/timur20121988/funpay-cardinal/blob/144583c7d8029d969dc3fdf715431a1b694dc4b8/plugins/review_chat_reply.py), blob `750f772be086`, мест 1; [Review Chat Reply 0.0.8](https://github.com/ItzVXR7/Neflexxbottt/blob/b45639fc062a16ce546276158479cc094d49f0d8/plugins/review_chat_reply.py), blob `84bd3fa90d62`, мест 1.
- **Telegram-публикации:** [review_chat_reply.py](https://t.me/fpc_plugins/50), [review_chat_reply.py](https://t.me/fpc_plugins/63), [review_chat_reply.py](https://t.me/fpc_plugins/87), [review_chat_reply.py](https://t.me/fpc_plugins/96), [review_chat_reply.py](https://t.me/fpc_plugins/103), [review_chat_reply.py](https://t.me/fpc_plugins/117), [review_chat_reply.py](https://t.me/fpc_plugins/138), [review_chat_reply.py](https://t.me/fpc_plugins/139). Байты вложений не сравнивались.

<a id="p101"></a>
## P101 — SalesExport (Sales CSV Export)

- **Сценарий:** CSV истории продаж за выбранный период, валютные итоги и скачивание файла.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p101). Вердикт относится к выбранной версии 1.0.1.
- **Вердикт:** полный перенос. Чтение страниц, CSV и Blob/скачивание; файловый сервер не требуется.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: экспорт и аналитика
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py), версия 1.0.1; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `a6491974901582b566080b3c11bf5312bea50fc0`, blob `da67d2549f15e75570b881ed5867f883ad2c2fd6`.
- **Точки проверки кода:** [_short:85](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L85), [_plugin_enabled:96](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L96), [_sign:103](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L103), [_csv_cell:110](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L110), [BIND_TO_PRE_INIT:326](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L326), [BIND_TO_DELETE:327](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py#L327).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SalesExport (Sales CSV Export) 1.0.1](https://github.com/yungspiderq/FPC-SalesExport/blob/a6491974901582b566080b3c11bf5312bea50fc0/sales_export.py), blob `da67d2549f15`, мест 1.

<a id="p102"></a>
## P102 — Send My Messages Plugin

- **Сценарий:** Уведомления о сообщениях продавца, которые обычные фильтры Cardinal не показывают.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p102). Вердикт относится к выбранной версии 0.0.2.
- **Вердикт:** полный перенос. События сообщений и Bot API/интерфейс; нужно различать ручной ответ и сообщение автоматизации.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** частично: чат и ручные/автоматические сообщения различаются
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `ebc119cba1745e5ab3f5ef93189d1c524906fb88`, blob `f1755fdaf890981cf5c388cafc8978f6515b90ab`.
- **Точки проверки кода:** [send_my_message_notification_handler:60](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py#L60), [BIND_TO_NEW_MESSAGE:108](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py#L108), [BIND_TO_PRE_INIT:109](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py#L109), [BIND_TO_DELETE:110](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py#L110).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Send My Messages Plugin 0.0.2](https://github.com/4erdenko/FunPayCardinal/blob/ebc119cba1745e5ab3f5ef93189d1c524906fb88/plugins/send_my_messages_plugin.py), blob `f1755fdaf890`, мест 1.

<a id="p103"></a>
## P103 — Stats

- **Сценарий:** Количество и сумма продаж за период.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p103). Вердикт относится к выбранной версии 0.1.0.
- **Вердикт:** полный перенос. Агрегаты истории; не нужны особые сервисы.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: аналитика
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py), версия 0.1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `102782e7888a9fda07ad365a8c8ae222297d4076`, blob `55eb9dae3d18abff1b233f6742cade5cde1fc916`.
- **Точки проверки кода:** [parse_window:45](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L45), [_money:62](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L62), [compute_stats:74](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L74), [format_report:122](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L122), [BIND_TO_PRE_INIT:170](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L170), [BIND_TO_DELETE:171](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py#L171).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Stats 0.1.0](https://github.com/tzn6/fpc-stats/blob/102782e7888a9fda07ad365a8c8ae222297d4076/fpc_stats.py), blob `55eb9dae3d18`, мест 1.

<a id="p104"></a>
## P104 — Калькулятор прибыли

- **Сценарий:** Подсчёт прибыли по заданным данным и периодам продаж.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p104). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** полный перенос. Локальные вычисления и история FunPay; не считать выручку прибылью без подтверждённой себестоимости.
- **Потери/неизвестное:** Существенных потерь в согласованном режиме не выявлено; это статическая оценка, не live-приёмка.
- **В Funcy:** уже есть: себестоимость и прибыль
- **Сложность:** низкая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `01533034ab1b6478b1abefe3659ad8947adfb4ce`, blob `0cd123e95de1bfb57cc25f610dbd9aaa9b791fb4`.
- **Точки проверки кода:** [calculate_product:135](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L135), [cmd_profit_calc:313](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L313), [cb_calc:319](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L319), [send_step_message:468](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L468), [cb_save_calc:478](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L478), [process_state_message:494](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L494), [is_pcalc_state_message:602](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L602), [BIND_TO_DELETE:35](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L35), [BIND_TO_PRE_INIT:631](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py#L631).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Калькулятор прибыли 1.0.0](https://github.com/Hyper-Ground/Profit-Calculaqtor-for-Cardinal/blob/01533034ab1b6478b1abefe3659ad8947adfb4ce/ProfitCalculator.py), blob `0cd123e95de1`, мест 1.

<a id="p105"></a>
## P105 — ASR+

- **Сценарий:** Почасовая аренда Steam, выдача, продление, Guard, смена пароля и завершение доступа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p105). Вердикт относится к выбранной версии 1.2.0.
- **Вердикт:** недостаточно данных. Есть Playwright и изолированные browser contexts, но часть операций HTTPS. Не доказана замена всех контекстов/сессий без потерь и актуальность смены пароля; выдачи логина недостаточно.
- **Потери/неизвестное:** Есть Playwright и изолированные browser contexts, но часть операций HTTPS. Не доказана замена всех контекстов/сессий без потерь и актуальность смены пароля; выдачи логина недостаточно.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py), версия 1.2.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, aiohttp, asyncio, cardinal, cryptography, importlib, playwright, pydantic, pysteamauth, pytz, requests, rsa, subprocess, telebot, tg_bot, urllib3, yarl. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.steampowered.com, funpay.com, help.steampowered.com, steamcommunity.com, store.steampowered.com, t.me.
- **Версия доказательства:** commit `563d327be188dcfaca252bdcce82df11799cd904`, blob `ce23fa800531c56f9b4391d3709a762ebad345cc`.
- **Точки проверки кода:** [_generate_confirmation_key:807](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L807), [change_password_async:1433](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L1433), [change_password_sync:1436](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L1436), [_cleanup_processed:2210](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L2210), [_send_fp:2736](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L2736), [_do_refund:2742](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L2742), [_get_buyer_active_targets:3173](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L3173), [process_new_order:3353](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L3353), [BIND_TO_PRE_INIT:7626](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L7626), [BIND_TO_NEW_ORDER:7627](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L7627), [BIND_TO_NEW_MESSAGE:7628](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L7628), [BIND_TO_ORDER_STATUS_CHANGED:7629](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py#L7629).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [ASR+ 1.2.0](https://github.com/dzhantdeveloper/ASRplus-FunPayCardinal-Auto-Steam-Rent/blob/563d327be188dcfaca252bdcce82df11799cd904/asrv1_2_0.py), blob `ce23fa800531`, мест 1; [Auto Steam Rent 1.1.0](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Steam-Rent/blob/e3bc8f585f90e285ab2d368d93a1b439f84f7063/auto_steam_rent.py), blob `d054df38fa8d`, мест 1.

<a id="p106"></a>
## P106 — Auto Gifts

- **Сценарий:** Отправка Telegram-подарков от пользовательского аккаунта, баланс Stars, настройки и обработка заказов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p106). Вердикт относится к выбранной версии 3.0.8.
- **Вердикт:** недостаточно данных. MTProto по WSS технически допустим. Полный перенос конкретного Pyrogram/Kurigram сценария и форматов сессии не проверен; это не автоматический TCP-блокер.
- **Потери/неизвестное:** MTProto по WSS технически допустим. Полный перенос конкретного Pyrogram/Kurigram сценария и форматов сессии не проверен; это не автоматический TCP-блокер.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py), версия 3.0.8; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, cardinal, pyrogram, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `67b93c7738d5245153c27d0729b44dec957e83f0`, blob `488c0b101a39d53609d93a50bfb6cbf675ba2a1e`.
- **Точки проверки кода:** [check_username:280](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L280), [buy_gifts:318](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L318), [get_balance:376](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L376), [generate_lots_keyboard:421](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L421), [notify_low_balance:179](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L179), [check_all_sessions:190](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L190), [process_lot_change:689](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L689), [process_new_lot:710](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L710), [BIND_TO_PRE_INIT:1591](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L1591), [BIND_TO_NEW_MESSAGE:1592](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L1592), [BIND_TO_NEW_ORDER:1593](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L1593), [BIND_TO_DELETE:1594](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py#L1594).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot), [telegram-mtproto](compatibility.md#telegram-mtproto), [telegram-stars](compatibility.md#telegram-stars).
- **Версии и копии:** [Auto Gifts 3.0.8](https://github.com/HexLynch/fpctelegramautogifts/blob/67b93c7738d5245153c27d0729b44dec957e83f0/auto_gifts.py), blob `488c0b101a39`, мест 1.

<a id="p107"></a>
## P107 — Auto Rental

- **Сценарий:** Выдача Steam-аккаунта, таймер, смена пароля и отзыв активных сессий.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p107). Вердикт относится к выбранной версии 1.4.8.8.
- **Вердикт:** недостаточно данных. В исходнике аккаунт освобождается до доказательства отзыва сессий, а endpoint RevokeAuthSessions не подтверждён. Это нельзя принять за проверенную полноценную аренду.
- **Потери/неизвестное:** В исходнике аккаунт освобождается до доказательства отзыва сессий, а endpoint RevokeAuthSessions не подтверждён. Это нельзя принять за проверенную полноценную аренду.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py), версия 1.4.8.8; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Crypto, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.steampowered.com, partner.steamgames.com, steamcommunity.com.
- **Версия доказательства:** commit `d582ab79d53ca4ab856b88376f5592f6f75da5b6`, blob `21e9bf86f50655cb3bc9bd4434e5cd7151ebb53c`.
- **Точки проверки кода:** [generate_strong_password:385](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L385), [check_rentals_thread:1185](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1185), [check_rentals:1598](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1598), [message_handler:1634](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1634), [order_handler:1659](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1659), [check_expired_rentals:647](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L647), [BIND_TO_PRE_INIT:1844](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1844), [BIND_TO_NEW_MESSAGE:1845](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1845), [BIND_TO_NEW_ORDER:1846](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1846), [BIND_TO_DELETE:1847](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py#L1847).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Rental 1.4.8.8](https://github.com/kokasikhorik-bot/Steamrent-FunPay-plugin/blob/d582ab79d53ca4ab856b88376f5592f6f75da5b6/SteamRent.py), blob `21e9bf86f506`, мест 1.

<a id="p108"></a>
## P108 — Auto Steam Rent

- **Сценарий:** Аренда Steam с выдачей, Guard, продлением, сменой пароля и ограничением доступа.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p108). Вердикт относится к выбранной версии 0.2.0.
- **Вердикт:** недостаточно данных. Не проверены полная замена Playwright/browser sessions и рабочие Steam endpoints. Нельзя объявлять полный перенос по одной выдаче учётных данных.
- **Потери/неизвестное:** Не проверены полная замена Playwright/browser sessions и рабочие Steam endpoints. Нельзя объявлять полный перенос по одной выдаче учётных данных.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py), версия 0.2.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, aiohttp, asyncio, cardinal, importlib, lxml, playwright, pydantic, pysteamauth, pytz, requests, rsa, steamlib, subprocess, telebot, tg_bot, urllib3, yarl. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.steampowered.com, help.steampowered.com, steamcommunity.com, store.steampowered.com.
- **Версия доказательства:** commit `b240f378d13e80d9fcb8177ba09ea4e8958e121c`, blob `824ca1b5819278a69e190cdfd80ee5bac2b49663`.
- **Точки проверки кода:** [_generate_confirmation_key:243](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L243), [change_password_async:582](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L582), [change_password_sync:585](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L585), [_send_fp:1058](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L1058), [_do_refund:1064](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L1064), [process_new_order:1115](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L1115), [_process_single_order:1163](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L1163), [_process_multi_order:1184](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L1184), [BIND_TO_PRE_INIT:2114](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L2114), [BIND_TO_NEW_ORDER:2115](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L2115), [BIND_TO_NEW_MESSAGE:2116](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L2116), [BIND_TO_ORDER_STATUS_CHANGED:2117](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py#L2117).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Steam Rent 0.2.0](https://github.com/JIMER228/FunPay-Cardinal-Auto-Steam-Rent/blob/b240f378d13e80d9fcb8177ba09ea4e8958e121c/auto_steam_rent.py), blob `824ca1b58192`, мест 1.

<a id="p109"></a>
## P109 — Auto Withdraw

- **Сценарий:** Настройка способа и суммы вывода, ручной/автоматический вывод доступного баланса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p109). Вердикт относится к выбранной версии 0.0.4.
- **Вердикт:** недостаточно данных. Код делает HTTP-запросы, но текущий контракт авторизации и подтверждений вывода не проверен. Полный паритет денежных действий до такого подтверждения не объявляется.
- **Потери/неизвестное:** Код делает HTTP-запросы, но текущий контракт авторизации и подтверждений вывода не проверен. Полный паритет денежных действий до такого подтверждения не объявляется.
- **В Funcy:** отсутствует; финансовые инструменты вывода ранее удалены
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py), версия 0.0.4; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, bs4, cardinal, locales, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com.
- **Версия доказательства:** commit `c8b4b52827d6e76a785f39b1296192b14fb958ce`, blob `52fcaead6b58719c98cc8a08090cd320bd310f6b`.
- **Точки проверки кода:** [calc:75](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py#L75), [get_balance:122](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py#L122), [BIND_TO_PRE_INIT:318](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py#L318), [BIND_TO_NEW_MESSAGE:319](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py#L319), [BIND_TO_DELETE:320](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py#L320).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Auto Withdraw 0.0.4](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/auto_withdraw.py), blob `52fcaead6b58`, мест 1.
- **Telegram-публикации:** [auto_withdraw.py](https://t.me/fpc_plugins/5), [auto_withdraw.py](https://t.me/fpc_plugins/8), [auto_withdraw.py](https://t.me/fpc_plugins/9), [auto_withdraw.py](https://t.me/fpc_plugins/21), [auto_withdraw.py](https://t.me/fpc_plugins/79), [auto_withdraw.py](https://t.me/fpc_plugins/81), [auto_withdraw.py](https://t.me/fpc_plugins/84), [auto_withdraw.py](https://t.me/fpc_plugins/93), [auto_withdraw.py](https://t.me/fpc_plugins/94), [auto_withdraw.py](https://t.me/fpc_plugins/98), [auto_withdraw.py](https://t.me/fpc_plugins/105). Байты вложений не сравнивались.

<a id="p110"></a>
## P110 — AutoConfirmSup

- **Сценарий:** Письма в поддержку с группами неподтверждённых заказов, SMTP-авторизация и расписание.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p110). Вердикт относится к выбранной версии 1.0.
- **Вердикт:** нужен помощник/сервер. Прямой SMTP/TLS недоступен в обычном MV3. Почтовый HTTP API был бы заменой транспорта и не сохранил поддержку произвольного SMTP-сервера.
- **Потери/неизвестное:** Прямой SMTP/TLS недоступен в обычном MV3. Почтовый HTTP API был бы заменой транспорта и не сохранил поддержку произвольного SMTP-сервера.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py), версия 1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, aiosmtplib, asyncio, bs4, cardinal, email, pip, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `498b053021da257545b01a90e669aa92d41af6ec`, blob `b623a980d1444581391578701effbc79839df2c0`.
- **Точки проверки кода:** [send_email:157](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L157), [ticket_settings:211](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L211), [send_mail:253](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L253), [process_smtp_change:278](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L278), [process_mail_change:293](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L293), [process_password_change:304](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L304), [process_mail_support_change:315](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L315), [BIND_TO_PRE_INIT:369](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L369), [BIND_TO_DELETE:370](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py#L370).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoConfirmSup 1.0](https://github.com/NightKamado/FPC-AutoTicket/blob/498b053021da257545b01a90e669aa92d41af6ec/AutoTicketNightFPP.py), blob `b623a980d144`, мест 1; [AutoConfirmSup 1.0](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/AutoTicket.py), blob `077e492cd82f`, мест 1.

<a id="p111"></a>
## P111 — AutoRentSteam

- **Сценарий:** Собственный пул аренды Steam, выдача, расширение времени, Guard, смена пароля и освобождение.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p111). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Код в основном HTTP/локальная криптография, но завершение сессий и смена пароля на реальном Steam не подтверждены. Нативный помощник не следует только из наличия pip.
- **Потери/неизвестное:** Код в основном HTTP/локальная криптография, но завершение сессий и смена пароля на реальном Steam не подтверждены. Нативный помощник не следует только из наличия pip.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, binascii, cardinal, importlib, requests, subprocess, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.steampowered.com, funpay.com, login.steampowered.com, steamcommunity.com, store.steampowered.com.
- **Версия доказательства:** commit `48631fb59806e7589c996a5b12d99961fe7e3a35`, blob `c7185dab284127d7b03f8a34edd125f4f664da34`.
- **Точки проверки кода:** [_calc_price:536](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L536), [send:1951](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L1951), [checker:2860](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L2860), [BIND_TO_PRE_INIT:3197](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L3197), [BIND_TO_NEW_MESSAGE:3198](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L3198), [BIND_TO_NEW_ORDER:3199](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L3199), [BIND_TO_DELETE:3200](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py#L3200).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoRentSteam 1.0.0](https://github.com/ByZoroKod/AutoRentSteam/blob/48631fb59806e7589c996a5b12d99961fe7e3a35/AutoRentsteam.py), blob `c7185dab2841`, мест 1.

<a id="p112"></a>
## P112 — AutoReview (Automatic Buyer Reviews)

- **Сценарий:** Заявлены автоматические отзывы покупателям с оценкой после выдачи.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p112). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Исходник вызывает send_review, который в FunPayAPI также отвечает на отзыв продавца. Направление и допустимость оценки покупателя не подтверждены; обещание взаимных отзывов не принимается как функция.
- **Потери/неизвестное:** Исходник вызывает send_review, который в FunPayAPI также отвечает на отзыв продавца. Направление и допустимость оценки покупателя не подтверждены; обещание взаимных отзывов не принимается как функция.
- **В Funcy:** частично: ответы продавца на отзывы уже есть
- **Сложность:** средняя; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** MIT. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `f23764db18671517133d5d1a3d52fd6a817b73ce`, blob `a5cfc1ebe08766d985929c89a127fe9cc8d8ccf5`.
- **Точки проверки кода:** [post_delivery_handler:191](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L191), [_review_tick:226](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L226), [send_test:419](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L419), [BIND_TO_PRE_INIT:536](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L536), [BIND_TO_POST_DELIVERY:537](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L537), [BIND_TO_DELETE:538](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py#L538).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoReview (Automatic Buyer Reviews) 1.0.0](https://github.com/yungspiderq/FPC-AutoReview/blob/f23764db18671517133d5d1a3d52fd6a817b73ce/auto_review.py), blob `a5cfc1ebe087`, мест 1.

<a id="p113"></a>
## P113 — AutoRobux

- **Сценарий:** Roblox GamePass: поиск пользователя/пропуска, проверка цены, покупка и выдача статуса.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p113). Вердикт относится к выбранной версии 1.2.
- **Вердикт:** недостаточно данных. Архивный исходник содержит частные Roblox-пути; актуальная покупка, CSRF, cookies и все ошибки без авторизации не подтверждены.
- **Потери/неизвестное:** Архивный исходник содержит частные Roblox-пути; актуальная покупка, CSRF, cookies и все ошибки без авторизации не подтверждены.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py), версия 1.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, httpx, subprocess, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** apis.roblox.com, economy.roblox.com, t.me, telegra.ph, users.roblox.com.
- **Версия доказательства:** commit `73e385c8d4f7884cd91251cae73c9e9d09978602`, blob `d45a8507180536abcbb3219f7500b7985aed2d54`.
- **Точки проверки кода:** [_send_confirmation:122](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L122), [get_robux_balance:199](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L199), [get_robux_balance:232](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L232), [get_username_sync:263](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L263), [purchase_gamepass:285](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L285), [_send_success_purchase:609](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L609), [_get_max_balance:874](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L874), [_panel_handler:1014](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L1014), [BIND_TO_PRE_INIT:1218](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L1218), [BIND_TO_NEW_ORDER:1219](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L1219), [BIND_TO_NEW_MESSAGE:1220](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L1220), [BIND_TO_DELETE:1221](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py#L1221).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoRobux 1.2](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/auto-robux/autorobux_complete.py), blob `d45a85071805`, мест 1.

<a id="p114"></a>
## P114 — AutoSteamPoints

- **Сценарий:** Продажа Steam Points через веб-кабинет поставщика, вход, баланс и покупка через Selenium.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p114). Вердикт относится к выбранной версии 0.2.0.
- **Вердикт:** недостаточно данных. Автоматизация вкладки возможна, поэтому Selenium не доказывает обязательность помощника. Но не проверены актуальный DOM кабинета и изоляция сессии: полный сценарий без потерь не подтверждён.
- **Потери/неизвестное:** Автоматизация вкладки возможна, поэтому Selenium не доказывает обязательность помощника. Но не проверены актуальный DOM кабинета и изоляция сессии: полный сценарий без потерь не подтверждён.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py), версия 0.2.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, pickle, pip, pydantic, requests, selenium, telebot, tg_bot, webdriver_manager. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.buysteampoints.com, funpay.com, t.me, yuanyoumao.com.
- **Версия доказательства:** commit `2110ef0363fa4504bb3d1bc7c8250393df8e236b`, blob `235863b4afd72e3cbe84ce8a05885510f91c8b22`.
- **Точки проверки кода:** [check_activation:937](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L937), [buy:81](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L81), [get_balance:150](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L150), [get_balance:306](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L306), [toggle_auto_refund:379](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L379), [send:393](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L393), [_process:396](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L396), [_send:409](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L409), [BIND_TO_NEW_MESSAGE:1236](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L1236), [BIND_TO_NEW_ORDER:1237](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L1237), [BIND_TO_PRE_INIT:1238](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L1238), [BIND_TO_ORDER_STATUS_CHANGED:1239](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py#L1239).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [AutoSteamPoints 0.2.0](https://github.com/alse11/AutoSteamPoints/blob/2110ef0363fa4504bb3d1bc7c8250393df8e236b/auto_steam_points_orig.py), blob `235863b4afd7`, мест 1.

<a id="p115"></a>
## P115 — DurakFunpayTransfer

- **Сценарий:** Перелив кредитов через игровые комнаты, ставки и действия покупателя в Дурак Онлайн.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p115). Вердикт относится к выбранной версии 1.0.
- **Вердикт:** нужен помощник/сервер. Зависимость durakonline.py использует socket.AF_INET/SOCK_STREAM и собственный игровой протокол. HTTP-посредник означал бы внешний сервис, которого в этой реализации нет.
- **Потери/неизвестное:** Зависимость durakonline.py использует socket.AF_INET/SOCK_STREAM и собственный игровой протокол. HTTP-посредник означал бы внешний сервис, которого в этой реализации нет.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py), версия 1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, durakonline, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `73e385c8d4f7884cd91251cae73c9e9d09978602`, blob `2b4bea3a830ca59e5629c596d3a968397f004093`.
- **Точки проверки кода:** [calc_transfer_steps:35](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L35), [get_balance:393](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L393), [send_msg:285](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L285), [BIND_TO_NEW_ORDER:474](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L474), [BIND_TO_NEW_MESSAGE:475](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L475), [BIND_TO_PRE_INIT:476](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L476), [BIND_TO_DELETE:477](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py#L477).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [DurakFunpayTransfer 1.0](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/durak-funpay-transfer/durakplugin.py), blob `2b4bea3a830c`, мест 1.

<a id="p116"></a>
## P116 — Email Code Fetcher

- **Сценарий:** Коды из нескольких почтовых ящиков, IMAP/POP3, OAuth для Gmail, фильтры и разрешённые чаты.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p116). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** нужен помощник/сервер. Прямые IMAP/POP3 требуют TCP/TLS, которых нет в MV3. Gmail OAuth в исходнике не заменяет протокол на Gmail REST. Gmail REST был бы отдельным суженным вариантом.
- **Потери/неизвестное:** Прямые IMAP/POP3 требуют TCP/TLS, которых нет в MV3. Gmail OAuth в исходнике не заменяет протокол на Gmail REST. Gmail REST был бы отдельным суженным вариантом.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, email, imaplib, poplib, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** developers.google.com, mail.google.com, oauth2.googleapis.com, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `bf9505b64d34286a7596bdab467a4dd23395996a`.
- **Точки проверки кода:** [_ensure_dir:465](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L465), [_load_config:469](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L469), [_save_config:488](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L488), [_log:494](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L494), [BIND_TO_PRE_INIT:1580](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L1580), [BIND_TO_SETTINGS_PAGE:1629](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L1629), [BIND_TO_NEW_MESSAGE:1723](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L1723), [BIND_TO_DELETE:1731](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py#L1731).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Email Code Fetcher 1.0.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/email_code_fetcher.py), blob `bf9505b64d34`, мест 1.

<a id="p117"></a>
## P117 — Exec Plugin

- **Сценарий:** Выполнение произвольного Python-кода по команде оператора с доступом к Cardinal/ОС.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p117). Вердикт относится к выбранной версии 0.0.2.
- **Вердикт:** нужен помощник/сервер. Браузер не предоставляет исходную Python/ОС-среду. Ограниченный JS-консольный инструмент был бы другой функцией.
- **Потери/неизвестное:** Браузер не предоставляет исходную Python/ОС-среду. Ограниченный JS-консольный инструмент был бы другой функцией.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `c8b4b52827d6e76a785f39b1296192b14fb958ce`, blob `777015f8894f61a29c79d91a232dc5b6652d7e70`.
- **Точки проверки кода:** [main:21](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py#L21), [on_delete:49](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py#L49), [run:32](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py#L32), [BIND_TO_PRE_INIT:53](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py#L53), [BIND_TO_DELETE:54](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py#L54).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Exec Plugin 0.0.2](https://github.com/OratrisX/FPC/blob/c8b4b52827d6e76a785f39b1296192b14fb958ce/plugins/exec_plugin.py), blob `777015f8894f`, мест 1.

<a id="p118"></a>
## P118 — FunPay Proxy Rotator

- **Сценарий:** Пул и проверка PX6-прокси, выбор/ротация прокси для запросов Cardinal.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p118). Вердикт относится к выбранной версии 0.1.1.
- **Вердикт:** перенос с потерями. PAC/Chrome proxy имеет другую область действия; независимые одновременные прокси requests-сессий без влияния на браузер не сохраняются.
- **Потери/неизвестное:** PAC/Chrome proxy имеет другую область действия; независимые одновременные прокси requests-сессий без влияния на браузер не сохраняются.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py), версия 0.1.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** Utils, cardinal, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** px6.link, px6.me.
- **Версия доказательства:** commit `78ce029eaeba4b34ba83c686da8acb35befffb66`, blob `5070f62a24f0b5fc0cd062bfe418d69e52b792ed`.
- **Точки проверки кода:** [_px6_check:330](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L330), [_tg_send:534](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L534), [_check_entry:578](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L578), [_check_all_worker:678](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L678), [_register_tg_handlers:978](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L978), [BIND_TO_DELETE:36](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L36), [BIND_TO_PRE_INIT:1014](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L1014), [BIND_TO_POST_INIT:1015](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L1015), [BIND_TO_NEW_MESSAGE:1016](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py#L1016).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [FunPay Proxy Rotator 0.1.1](https://github.com/ThisTakou/FPC-ProxyAutoRotator/blob/78ce029eaeba4b34ba83c686da8acb35befffb66/funpay_proxy_rotator.py), blob `5070f62a24f0`, мест 1.

<a id="p119"></a>
## P119 — GPT Info

- **Сценарий:** Ответ на #info с генерацией описания/совета через g4f.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p119). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** недостаточно данных. Не подтверждён контракт g4f-провайдеров; замена API должна быть отдельным решением и не считаться полным паритетом бесплатно/без ключа.
- **Потери/неизвестное:** Не подтверждён контракт g4f-провайдеров; замена API должна быть отдельным решением и не считаться полным паритетом бесплатно/без ключа.
- **В Funcy:** частично: автоответы
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, g4f. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `362815c5b79f3715427c9220829c406ce04b03ab`.
- **Точки проверки кода:** [gpt_info_handler:26](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py#L26), [BIND_TO_NEW_MESSAGE:116](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py#L116), [BIND_TO_INIT:117](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py#L117), [BIND_TO_DELETE:118](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py#L118).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [GPT Info 0.0.1](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/g4f_info_lots.py), blob `362815c5b79f`, мест 1; [GPT Info 0.0.1](https://github.com/zlexdev/fpc-plugins/blob/4954dc05bad62a374b5e49bc701bfd85c433de89/g4f_info_lots.py), blob `299d37e6b587`, мест 1.

<a id="p120"></a>
## P120 — GPT отзывы

- **Сценарий:** AI-ответы на отзывы через g4f и Telegram-настройки.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p120). Вердикт относится к выбранной версии 0.3.
- **Вердикт:** недостаточно данных. g4f скрывает неофициальные провайдеры/прокси и их требования. Замена на платный BYOK сохраняет идею, но не обещанную бесплатную доступность.
- **Потери/неизвестное:** g4f скрывает неофициальные провайдеры/прокси и их требования. Замена на платный BYOK сохраняет идею, но не обещанную бесплатную доступность.
- **В Funcy:** частично: шаблонные ответы
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py), версия 0.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, g4f, pip, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** www.blackbox.ai.
- **Версия доказательства:** commit `b220aaf82361e655707c6622ba78d694915405bd`, blob `d6850cda64d9fe90301484bb44f79198a63f11f5`.
- **Точки проверки кода:** [replace_items:188](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L188), [need_regenerate:209](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L209), [generate:231](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L231), [g4f_generate_response:243](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L243), [message_handler:271](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L271), [process_new_prompt:439](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L439), [BIND_TO_NEW_MESSAGE:542](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L542), [BIND_TO_PRE_INIT:543](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L543), [BIND_TO_DELETE:544](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py#L544).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [gemini](compatibility.md#gemini), [openrouter](compatibility.md#openrouter), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [GPT отзывы 0.3](https://github.com/ago106/fpc-plugins/blob/b220aaf82361e655707c6622ba78d694915405bd/chat_gpt%20%281%29.py), blob `d6850cda64d9`, мест 1.

<a id="p121"></a>
## P121 — MinecraftDonate

- **Сценарий:** Minecraft-доноры, подключение к серверам, команды /pay, клановые переводы, CAPTCHA, вход игрока и пруфы.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p121). Вердикт относится к выбранной версии 1.3.1.
- **Вердикт:** нужен помощник/сервер. Quarry/Twisted работают с нативным Minecraft TCP; готового HTTP/WSS шлюза в реализации нет. Без него полную игровую часть расширение не выполнит.
- **Потери/неизвестное:** Quarry/Twisted работают с нативным Minecraft TCP; готового HTTP/WSS шлюза в реализации нет. Без него полную игровую часть расширение не выполнит.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py), версия 1.3.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, PIL, cardinal, importlib, lot_activation_common, quarry, subprocess, telebot, twisted. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `a04fa5f0f5b5a9df5ea59139575f80370132773d`.
- **Точки проверки кода:** [_parse_clan_balance:976](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L976), [_send_captcha_photo_default:1812](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L1812), [_run_delivery:2751](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L2751), [_total_balance_for:3074](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L3074), [send_chat:1686](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L1686), [ask_test_delivery:3387](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L3387), [on_test_delivery:3408](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L3408), [_send:1691](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L1691), [BIND_TO_SETTINGS_PAGE:4483](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L4483), [BIND_TO_PRE_INIT:4484](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L4484), [BIND_TO_NEW_ORDER:4485](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L4485), [BIND_TO_NEW_MESSAGE:4486](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py#L4486).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-offscreen](compatibility.md#chrome-offscreen), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [MinecraftDonate 1.3.1](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/minecraft_donate.py), blob `a04fa5f0f5b5`, мест 1.

<a id="p122"></a>
## P122 — PluginLoader

- **Сценарий:** Загрузка лицензированных зашифрованных Python-плагинов и исполнение их на стороне Cardinal.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p122). Вердикт относится к выбранной версии 4.0.0.
- **Вердикт:** нужен помощник/сервер. Загружать и исполнять произвольные Python-модули с доступом к ОС обычное расширение не может; удалённый исполняемый JS также не подходит для MV3/CWS.
- **Потери/неизвестное:** Загружать и исполнять произвольные Python-модули с доступом к ОС обычное расширение не может; удалённый исполняемый JS также не подходит для MV3/CWS.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py), версия 4.0.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** configparser, cryptography, ctypes, requests, subprocess, types. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Версия доказательства:** commit `7fb24a4f8b1456ad884320151f3074e94798464a`, blob `efebf59b91d29faea4a3144f601f750d9ab24a10`.
- **Точки проверки кода:** [_update_check_loop:426](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py#L426), [_handler:160](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py#L160), [_send_to_admins:334](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py#L334), [BIND_TO_DELETE:24](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py#L24), [BIND_TO_POST_INIT:515](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py#L515).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [PluginLoader 4.0.0](https://github.com/Hackep1551/fpc-loader/blob/7fb24a4f8b1456ad884320151f3074e94798464a/PluginLoader.py), blob `efebf59b91d2`, мест 1.

<a id="p123"></a>
## P123 — RentSteam

- **Сценарий:** Пул Steam, аренда, продления, Guard, смена пароля через локальную библиотеку steampassword.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p123). Вердикт относится к выбранной версии 0.4.4.
- **Вердикт:** недостаточно данных. Библиотека и HTTP-операции доступны для анализа, но их полная замена в cookie-среде браузера не проверена; обновление Python-файлов должно стать выпуском расширения.
- **Потери/неизвестное:** Библиотека и HTTP-операции доступны для анализа, но их полная замена в cookie-среде браузера не проверена; обновление Python-файлов должно стать выпуском расширения.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py), версия 0.4.4; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, cardinal, helpers, steampassword, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, raw.githubusercontent.com.
- **Версия доказательства:** commit `7ec58898cbfee172e8335f04e28133b0b3beec92`, blob `16f33f7795b53e509e182a52bca8e51a3c145e9d`.
- **Точки проверки кода:** [active_rentals_for_buyer:617](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L617), [find_active_rental_for_buyer_lot:629](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L629), [find_active_rental_for_buyer_game:635](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L635), [order_already_processed:642](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L642), [_run_update_check:2906](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2906), [manual_check_updates:2507](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2507), [BIND_TO_PRE_INIT:2938](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2938), [BIND_TO_POST_START:2939](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2939), [BIND_TO_NEW_ORDER:2940](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2940), [BIND_TO_ORDER_STATUS_CHANGED:2941](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py#L2941).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [RentSteam 0.4.4](https://github.com/r3zanya/RentSteam-v0.4.4-Free/blob/7ec58898cbfee172e8335f04e28133b0b3beec92/plugins/steam_rent.py), blob `16f33f7795b5`, мест 1.

<a id="p124"></a>
## P124 — SMMWay Price AutoSync

- **Сценарий:** Старый пересчёт цен SMMWay и запись цен лотов.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p124). Вердикт относится к выбранной версии 1.0.0.
- **Вердикт:** недостаточно данных. Архивный алгоритм округляет вниз; это отдельная версия с иными гарантиями. Нельзя считать её эквивалентом нового AutoSync; актуальный API не подтверждён.
- **Потери/неизвестное:** Архивный алгоритм округляет вниз; это отдельная версия с иными гарантиями. Нельзя считать её эквивалентом нового AutoSync; актуальный API не подтверждён.
- **В Funcy:** частично: цены
- **Сложность:** средняя; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py), версия 1.0.0; дата 2026-11-03.
- **Лицензия:** GPL-3.0. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** github.com, smmway.ru.
- **Версия доказательства:** commit `a5ca2d5c8c18d1ec093978cb96eee8b616934a78`, blob `a5bff63cfcead8c849f5668014dbab58e41c39d3`.
- **Точки проверки кода:** [calculate_new_price:142](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L142), [send_alert:156](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L156), [sync_once:184](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L184), [send_settings_menu:296](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L296), [process_multiplier:305](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L305), [process_api_key:325](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L325), [process_threshold:343](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L343), [BIND_TO_PRE_INIT:437](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L437), [BIND_TO_INIT:438](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L438), [BIND_TO_DELETE:439](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py#L439).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SMMWay Price AutoSync 1.0.0](https://github.com/uNoless/smmway_autosync/blob/a5ca2d5c8c18d1ec093978cb96eee8b616934a78/autosync.py), blob `a5bff63cfcea`, мест 1.

<a id="p125"></a>
## P125 — Steam Region Ranger

- **Сценарий:** Смена региона Steam через покупку игры, карты, несколько региональных прокси и диалог Guard.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p125). Вердикт относится к выбранной версии 1.11.0.
- **Вердикт:** перенос с потерями. Обычные HTTPS-шаги переносимы, но независимые proxies/cookie-jars на каждую покупку и связанные браузерные проверки не сохраняются напрямую. Урезанный последовательный поток не равен исходнику.
- **Потери/неизвестное:** Обычные HTTPS-шаги переносимы, но независимые proxies/cookie-jars на каждую покупку и связанные браузерные проверки не сохраняются напрямую. Урезанный последовательный поток не равен исходнику.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py), версия 1.11.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, cryptography, importlib, pickle, requests, subprocess, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** ip-api.com, store.steampowered.com, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `0ddc9882fab74e02d7fe181141bf7a69caf6507b`.
- **Точки проверки кода:** [_buyer_map_add:572](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L572), [_buyer_map_remove:586](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L586), [_buyer_menu_text:592](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L592), [_check_proxy:1094](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L1094), [_log_purchase:1628](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L1628), [_purchase_with_session:2446](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L2446), [_run_one_cycle_sync:2500](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L2500), [_buyer_send:4999](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L4999), [BIND_TO_PRE_INIT:4926](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L4926), [BIND_TO_DELETE:4927](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L4927), [BIND_TO_SETTINGS_PAGE:4960](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L4960), [BIND_TO_NEW_ORDER:5392](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py#L5392).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Steam Region Ranger 1.11.0](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_ranger.py), blob `0ddc9882fab7`, мест 1.

<a id="p126"></a>
## P126 — Steam Rental

- **Сценарий:** Steam-аренда, Guard, продления, Remote Play PIN, пул, отзывы, AI-функции, прокси и встроенная веб-панель.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p126). Вердикт относится к выбранной версии 2.23.8.
- **Вердикт:** нужен помощник/сервер. Есть ThreadingHTTPServer и отдельный серверный/сессионный контур. Полный перенос вместе с входящей веб-панелью и исходной изоляцией требует помощника; обычную аренду можно исследовать как отдельный урезанный модуль.
- **Потери/неизвестное:** Есть ThreadingHTTPServer и отдельный серверный/сессионный контур. Полный перенос вместе с входящей веб-панелью и исходной изоляцией требует помощника; обычную аренду можно исследовать как отдельный урезанный модуль.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py), версия 2.23.8; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, cardinal, http, importlib, lot_activation_common, requests, rsa, steam_rental, steam_sqlite, steampy, subprocess, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.anthropic.com, api.ipify.org, api.openai.com, api.steampowered.com, funpay.com, generativelanguage.googleapis.com, help.steampowered.com, login.steampowered.com, openrouter.ai, steamcommunity.com, store.steampowered.com, t.me.
- **Версия доказательства:** commit `e5c2b934afb3cd0eb71556d3ca88f235527419dd`, blob `dd23e672755fa5998ad7a3796c6e013fb36e3dd8`.
- **Точки проверки кода:** [_find_reservation_for_buyer:1365](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L1365), [_release_reservation_after_delivery:1487](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L1487), [_club_find_request_by_buyer:1907](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L1907), [_mr_find_active_by_buyer:2024](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L2024), [_load_buyer_lang:3202](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L3202), [_save_buyer_lang:3212](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L3212), [_get_buyer_lang:3219](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L3219), [_set_buyer_lang:3229](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L3229), [BIND_TO_DELETE:292](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L292), [BIND_TO_SETTINGS_PAGE:19728](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L19728), [BIND_TO_PRE_INIT:19729](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L19729), [BIND_TO_POST_START:19730](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py#L19730).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [Steam Rental 2.23.8](https://github.com/drakezakuru/Funpay-plugins/blob/e5c2b934afb3cd0eb71556d3ca88f235527419dd/steam_rental.py), blob `dd23e672755f`, мест 1.

<a id="p127"></a>
## P127 — SteamAutoPoints

- **Сценарий:** Сбор Steam-ссылки и вызов API поставщика для покупки очков.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p127). Вердикт относится к выбранной версии 0.3.
- **Вердикт:** недостаточно данных. В очищенном архиве API-адрес заменён на example.com. Реальный поставщик и контракт недоступны; пустой адаптер нельзя считать рабочим исходником.
- **Потери/неизвестное:** В очищенном архиве API-адрес заменён на example.com. Реальный поставщик и контракт недоступны; пустой адаптер нельзя считать рабочим исходником.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py), версия 0.3; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, requests, telebot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, steamcommunity.com, t.me.
- **Версия доказательства:** commit `73e385c8d4f7884cd91251cae73c9e9d09978602`, blob `44e93ba9509d7613696e2970bb8cbc025e5f6cf2`.
- **Точки проверки кода:** [process_link_without_confirmation:380](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L380), [purchase_points:46](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L46), [BIND_TO_PRE_INIT:438](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L438), [BIND_TO_NEW_ORDER:439](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L439), [BIND_TO_NEW_MESSAGE:440](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L440), [BIND_TO_DELETE:441](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py#L441).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [SteamAutoPoints 0.3](https://github.com/Seno47/funpay-cardinal-plugins-archive/blob/73e385c8d4f7884cd91251cae73c9e9d09978602/plugins/steam-auto-points/autopoints.py), blob `44e93ba9509d`, мест 1.

<a id="p128"></a>
## P128 — Telegram Stars Gifts (Kurigram)

- **Сценарий:** Подарки Telegram от пользовательской сессии Kurigram, каталог и оплата Stars.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p128). Вердикт относится к выбранной версии 1.2.0.
- **Вердикт:** недостаточно данных. WSS транспорт есть, но для полного переноса надо воспроизвести конкретный TL layer, вход, сессии и подтверждение платежа. Не заменять это вызовом Bot API sendGift без сравнения возможностей.
- **Потери/неизвестное:** WSS транспорт есть, но для полного переноса надо воспроизвести конкретный TL layer, вход, сессии и подтверждение платежа. Не заменять это вызовом Bot API sendGift без сравнения возможностей.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py), версия 1.2.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, cardinal, curl_cffi, pyrogram, requests, sqlite3, subprocess, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, t.me.
- **Версия доказательства:** commit `ae86db9da6bfc3967f4c8be1282b83d71f0c04d1`, blob `887077c6a12f0a2020f4c77d9a655d80182ac34f`.
- **Точки проверки кода:** [run_async_in_thread:1743](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L1743), [_check_session_valid:154](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L154), [_get_balance:229](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L229), [_send_star:274](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L274), [get_balance:391](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L391), [send_star:414](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L414), [a_send_star:433](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L433), [a_get_balance:446](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L446), [BIND_TO_PRE_INIT:2792](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L2792), [BIND_TO_NEW_MESSAGE:2793](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L2793), [BIND_TO_NEW_ORDER:2794](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L2794), [BIND_TO_DELETE:2795](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py#L2795).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [telegram-bot](compatibility.md#telegram-bot), [telegram-mtproto](compatibility.md#telegram-mtproto), [telegram-stars](compatibility.md#telegram-stars).
- **Версии и копии:** [Telegram Stars Gifts (Kurigram) 1.2.0](https://github.com/IMP4R/telegram-stars-gifts/blob/ae86db9da6bfc3967f4c8be1282b83d71f0c04d1/StarGiftCardinalPlugim.py), blob `887077c6a12f`, мест 1.

<a id="p129"></a>
## P129 — TG Gift Sender

- **Сценарий:** Пользовательские Telegram-подарки с выбором, анонимностью, подписью и параллельной отправкой.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p129). Вердикт относится к выбранной версии 11.1.0.
- **Вердикт:** недостаточно данных. Для WSS-реализации нужно подтвердить все методы и форматы Kurigram-сессии; замена на подарки от бота меняет существенные возможности.
- **Потери/неизвестное:** Для WSS-реализации нужно подтвердить все методы и форматы Kurigram-сессии; замена на подарки от бота меняет существенные возможности.
- **В Funcy:** отсутствует
- **Сложность:** высокая; приоритет 4; уверенность средняя.
- **Источник:** [проверенная ссылка](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py), версия 11.1.0; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** FunPayAPI, asyncio, cardinal, importlib, pyrogram, subprocess, telebot, tg_bot, tgcrypto. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** funpay.com, t.me.
- **Версия доказательства:** commit `6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17`, blob `d9b8a73cfae56231a57b9ee7a82043d36775bca5`.
- **Точки проверки кода:** [_fetch_balance:563](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L563), [_refresh_balance:582](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L582), [_get_cached_balance:594](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L594), [_mark_processed:614](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L614), [_send_one:936](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L936), [_send_gifts:996](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L996), [_send_gift_thread:1051](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L1051), [_check:1264](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L1264), [BIND_TO_DELETE:199](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L199), [BIND_TO_PRE_INIT:2288](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L2288), [BIND_TO_NEW_MESSAGE:2289](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py#L2289).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-rhc](compatibility.md#chrome-rhc), [telegram-bot](compatibility.md#telegram-bot), [telegram-mtproto](compatibility.md#telegram-mtproto), [telegram-stars](compatibility.md#telegram-stars).
- **Версии и копии:** [TG Gift Sender 11.1.0](https://github.com/noddling/AutoGiftsFunPay/blob/6f66aa4a3995ad267e5b8fcc5051bbab2e7ced17/autogifts.py), blob `d9b8a73cfae5`, мест 1.

<a id="p130"></a>
## P130 — TG Proxy Plugin

- **Сценарий:** Настройка прокси именно для Telegram-процесса Cardinal.
- **Подробности сценария:** [настройки, обработчики, запись состояния, ошибки и варианты](scenario-details.md#p130). Вердикт относится к выбранной версии 0.0.1.
- **Вердикт:** перенос с потерями. chrome.proxy управляет браузером/PAC, а не отдельной requests-сессией. Равную изоляцию и локальное изменение Python-конфига не сохраняем; возможна настройка PAC только для доменов.
- **Потери/неизвестное:** chrome.proxy управляет браузером/PAC, а не отдельной requests-сессией. Равную изоляцию и локальное изменение Python-конфига не сохраняем; возможна настройка PAC только для доменов.
- **В Funcy:** отсутствует
- **Сложность:** средняя; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py), версия 0.0.1; дата 2026-11-03.
- **Лицензия:** явная лицензия не установлена. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** Только пока браузер работает; во сне задания откладываются. Строгий срок/непрерывность не гарантированы.
- **Зависимости исходника:** cardinal, locales, requests, telebot, tg_bot. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** api.ipify.org.
- **Версия доказательства:** commit `404f8d643a73cce2bc75cc9cbded2f1403cac84a`, blob `c8eb9105f79fdb68e860165a7641316bcc34bb35`.
- **Точки проверки кода:** [check_proxy:34](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py#L34), [reg_tg_handlers:135](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py#L135), [BIND_TO_PRE_INIT:146](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py#L146), [BIND_TO_DELETE:147](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py#L147).
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [cardinal-source](compatibility.md#cardinal-source), [chrome-alarms](compatibility.md#chrome-alarms), [chrome-http](compatibility.md#chrome-http), [chrome-life](compatibility.md#chrome-life), [chrome-proxy](compatibility.md#chrome-proxy), [telegram-bot](compatibility.md#telegram-bot).
- **Версии и копии:** [TG Proxy Plugin 0.0.1](https://github.com/Secret-XYZ/FunPayCardinalPlugins/blob/404f8d643a73cce2bc75cc9cbded2f1403cac84a/tg_proxy_plugin.py), blob `c8eb9105f79f`, мест 1.
- **Telegram-публикации:** [tg_proxy_plugin.py](https://t.me/fpc_plugins/143). Байты вложений не сравнивались.

<a id="u001"></a>
## U001 — AutoCodeGifts для FunPay [coxerhub.com]

- **Сценарий:** Заявлена выдача или аренда подарков; происхождение и транспорт конкретного кода неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autocodegifts), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u002"></a>
## U002 — AutoDemping для FunPay [coxerhub.com]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autodemping), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u003"></a>
## U003 — AutoGiftStars для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Telegram Stars; протокол кошелька, подтверждение и recovery неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autogiftstars), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u004"></a>
## U004 — AutoGiftSteam для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autogiftsteam), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u005"></a>
## U005 — AutoLolz — Instagram и TikTok для FunPay [coxerhub.com]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autololz), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u006"></a>
## U006 — AutoNFT для FunPay [coxerhub.com]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autonft), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u007"></a>
## U007 — AutoOffLotser для FunPay [coxerhub.com]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autoofflotser), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u008"></a>
## U008 — AutoRobux для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Robux; способы закупки и ограничения аккаунтов неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autorobux), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u009"></a>
## U009 — AutoSMM для FunPay [coxerhub.com]

- **Сценарий:** Заявлена обработка SMM-заказов; поставщики и все виды услуг не подтверждены.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autosmm), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u010"></a>
## U010 — AutoStars Plugin для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Telegram Stars; протокол кошелька, подтверждение и recovery неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autostars), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u011"></a>
## U011 — AutoSteam для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autosteam), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u012"></a>
## U012 — AutoTP — работа с обращениями по категориям для FunPay [coxerhub.com]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/autotp), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u013"></a>
## U013 — Fazer Cards для FunPay [coxerhub.com]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/fazer-cards), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u014"></a>
## U014 — LolzSteam для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/lolzsteam), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u015"></a>
## U015 — LotCopier для FunPay [coxerhub.com]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/lotcopier), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u016"></a>
## U016 — RobloxVip для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Roblox; полный жизненный цикл доступа не подтверждён.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/robloxvip), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u017"></a>
## U017 — RobuxDelivery для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Robux; способы закупки и ограничения аккаунтов неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/robuxdelivery), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u018"></a>
## U018 — SteamRent для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/steamrent), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u019"></a>
## U019 — WinStars для FunPay [coxerhub.com]

- **Сценарий:** Заявлена автоматизация Telegram Stars; протокол кошелька, подтверждение и recovery неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://coxerhub.com/ru/plugins/funpay/winstars), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u020"></a>
## U020 — Access Authority (ADDON) [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/access-authority-hub), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u021"></a>
## U021 — Addon Hub [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/addon-control-hub), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u022"></a>
## U022 — AppRoute Resell [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/approute-resell), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u023"></a>
## U023 — File Editor [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/cardinal-file-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u024"></a>
## U024 — Chat Bridge Sync [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/chat-bridge-hub), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u025"></a>
## U025 — Golden Key Switch [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/cookie-switch-console), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u026"></a>
## U026 — RabbitBoost Auto Delivery [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/discord-boost-flow), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u027"></a>
## U027 — Duplicate Lot Cleaner [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/duplicate-lot-cleaner), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u028"></a>
## U028 — Feedback Reply Studio [fxaoc.shop]

- **Сценарий:** Заявлена работа с отзывами; направление ответа и условия отправки требуют проверки.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/feedback-reply-studio), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u029"></a>
## U029 — Auto Gemini Access [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/gemini-access-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u030"></a>
## U030 — Auto Gift Rental [fxaoc.shop]

- **Сценарий:** Заявлена выдача или аренда подарков; происхождение и транспорт конкретного кода неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/gift-rental-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u031"></a>
## U031 — Graphs Plugin [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/graph-insight-studio), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u032"></a>
## U032 — Keyword Response Desk [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/keyword-response-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u033"></a>
## U033 — KoSell Reseller [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/kosell-reseller), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u034"></a>
## U034 — Lot Active Watchdog [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-active-watchdog), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u035"></a>
## U035 — Lot Cleaner [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-cleanup-console), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u036"></a>
## U036 — Lot Clone Desk [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-clone-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u037"></a>
## U037 — Lot Control Panel [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-control-panel), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u038"></a>
## U038 — Lot Deleter [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-deletion-center), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u039"></a>
## U039 — Lot Import Engine [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-import-engine), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u040"></a>
## U040 — Lot Keeper Desk [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-keeper-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u041"></a>
## U041 — Lot Timekeeper [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-timekeeper), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u042"></a>
## U042 — Lot Transfer Desk [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lot-transfer-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u043"></a>
## U043 — Auto Lolz Reseller [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/lzt-reseller-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u044"></a>
## U044 — List Old Orders [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/order-age-reporter), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u045"></a>
## U045 — Order Confirmation Reminder [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/order-reminder-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u046"></a>
## U046 — Paid Stats Desk [fxaoc.shop]

- **Сценарий:** Заявлена AI-автоматизация; реальные провайдеры, модели и ограничения не подтверждены.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/paid-stats-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u047"></a>
## U047 — Auto Demping [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/price-guard-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u048"></a>
## U048 — Profile Insight (ADDON) [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/profile-insight-addon), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u049"></a>
## U049 — Profile Insight Panel [fxaoc.shop]

- **Сценарий:** Заявлена работа с балансом/выводом; денежный контракт и подтверждение неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/profile-insight-panel), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u050"></a>
## U050 — Review Mass Reply Desk [fxaoc.shop]

- **Сценарий:** Заявлена работа с отзывами; направление ответа и условия отправки требуют проверки.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/review-mass-reply-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u051"></a>
## U051 — Review Reply Studio [fxaoc.shop]

- **Сценарий:** Заявлена работа с отзывами; направление ответа и условия отправки требуют проверки.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/review-reply-studio), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u052"></a>
## U052 — Auto VIP Roblox [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Roblox; полный жизненный цикл доступа не подтверждён.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/roblox-vip-rent-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u053"></a>
## U053 — Robux Delivery [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Robux; способы закупки и ограничения аккаунтов неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/robux-delivery-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u054"></a>
## U054 — Auto Robux [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Robux; способы закупки и ограничения аккаунтов неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/robux-gamepass-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u055"></a>
## U055 — Auto Robux Swizzyer [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Robux; способы закупки и ограничения аккаунтов неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/robux-microsoft-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u056"></a>
## U056 — Rublevki Control Desk [fxaoc.shop]

- **Сценарий:** Заявлена работа с лотами; полный набор полей, действия и восстановление требуют кода.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/rublevki-control-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u057"></a>
## U057 — Auto GPT consultant [fxaoc.shop]

- **Сценарий:** Заявлена AI-автоматизация; реальные провайдеры, модели и ограничения не подтверждены.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/shop-ai-advisor), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u058"></a>
## U058 — AutoSMM [fxaoc.shop]

- **Сценарий:** Заявлена обработка SMM-заказов; поставщики и все виды услуг не подтверждены.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/smm-flow-manager), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u059"></a>
## U059 — Sras Info [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/sras-watcher), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u060"></a>
## U060 — Auto Stars [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Telegram Stars; протокол кошелька, подтверждение и recovery неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/stars-fragment-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u061"></a>
## U061 — Status Plugin [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/status-beacon), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u062"></a>
## U062 — Auto Steam Gift [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/steam-gift-dispatcher), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u063"></a>
## U063 — Auto Steam Points [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/steam-points-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u064"></a>
## U064 — Auto Steam Rent [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/steam-rent-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u065"></a>
## U065 — Auto Steam SMM [fxaoc.shop]

- **Сценарий:** Заявлена автоматизация Steam; состав выдачи, аренды, статусов и ошибок требуется подтвердить по исходнику.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/steam-smm-flow-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u066"></a>
## U066 — Telegram Proxy Pilot [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/telegram-proxy-pilot), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u067"></a>
## U067 — Auto Ticket [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/ticket-dispatch-console), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u068"></a>
## U068 — Welcome Reset Keeper [fxaoc.shop]

- **Сценарий:** Коммерческая карточка инструмента Cardinal; функции и ограничения описаны продавцом, исходный код не предоставлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/welcome-reset-keeper), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u069"></a>
## U069 — AutoWithdraw [fxaoc.shop]

- **Сценарий:** Заявлена работа с балансом/выводом; денежный контракт и подтверждение неизвестны.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://fxaoc.shop/plugin/withdraw-control-desk), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u070"></a>
## U070 — ai_chat_plugin_1788278351360.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/80), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [ai_chat_plugin_1788278351360.py](https://t.me/cloudecode/80). Байты вложений не сравнивались.

<a id="u071"></a>
## U071 — ai_reviews_fpc_1788271734330 (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/75), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [ai_reviews_fpc_1788271734330 (1).py](https://t.me/cloudecode/75). Байты вложений не сравнивались.

<a id="u072"></a>
## U072 — auto_repricer19_(1)_1787563726858.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/68), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [auto_repricer19_(1)_1787563726858.py](https://t.me/cloudecode/68). Байты вложений не сравнивались.

<a id="u073"></a>
## U073 — auto_send.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/16), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [auto_send.py](https://t.me/cloudecode/16). Байты вложений не сравнивались.

<a id="u074"></a>
## U074 — auto_steam_points (2).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/34), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [auto_steam_points (2).py](https://t.me/cloudecode/34). Байты вложений не сравнивались.

<a id="u075"></a>
## U075 — autoback.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/44), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [autoback.py](https://t.me/cloudecode/19), [autoback.py](https://t.me/FPC_pluginss/44). Байты вложений не сравнивались.

<a id="u076"></a>
## U076 — AutoConfirmSup.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/6), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [AutoConfirmSup.py](https://t.me/cloudecode/6). Байты вложений не сравнивались.

<a id="u077"></a>
## U077 — autodispatch_plugin_xvimp (4) (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/48), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [autodispatch_plugin_xvimp (3).py](https://t.me/cloudecode/47), [autodispatch_plugin_xvimp (4) (1).py](https://t.me/cloudecode/48). Байты вложений не сравнивались.

<a id="u078"></a>
## U078 — AutoOffline_(1)_1787486867010 (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/67), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [AutoOffline_(1)_1787486867010 (1).py](https://t.me/cloudecode/67). Байты вложений не сравнивались.

<a id="u079"></a>
## U079 — AutoRobux.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/63), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [AutoRobux.py](https://t.me/cloudecode/63). Байты вложений не сравнивались.

<a id="u080"></a>
## U080 — AutoSmm (10) (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/32), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [AutoSmm (10) (1).py](https://t.me/cloudecode/32). Байты вложений не сравнивались.

<a id="u081"></a>
## U081 — autosmm_fpc_1788273235042.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/76), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [autosmm_fpc_1788273235042.py](https://t.me/cloudecode/76). Байты вложений не сравнивались.

<a id="u082"></a>
## U082 — AutoTicket_1787061274841.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/66), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [autoticket.py](https://t.me/cloudecode/9), [AutoTicket (5).py](https://t.me/cloudecode/56), [AutoTicket_1787061274841.py](https://t.me/cloudecode/66). Байты вложений не сравнивались.

<a id="u083"></a>
## U083 — banwords_bypass.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/85), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [banwords_bypass.py](https://t.me/FPC_pluginss/85). Байты вложений не сравнивались.

<a id="u084"></a>
## U084 — del_old_users.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_plugins/60), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [del_old_users.py](https://t.me/fpc_plugins/60). Байты вложений не сравнивались.

<a id="u085"></a>
## U085 — delete_lots.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/112), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [delete_lots.py](https://t.me/cloudecode/12), [delete_lots.py](https://t.me/FPC_pluginss/27), [delete_lots.py](https://t.me/FPC_pluginss/112). Байты вложений не сравнивались.

<a id="u086"></a>
## U086 — email_code_fetcher_1788274693896.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/77), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [email_code_fetcher_1788274693896.py](https://t.me/cloudecode/77). Байты вложений не сравнивались.

<a id="u087"></a>
## U087 — FTG-Plugin-fixed (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/53), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [FTG-Plugin-fixed (1).py](https://t.me/cloudecode/53). Байты вложений не сравнивались.

<a id="u088"></a>
## U088 — FTG-Plugin-fixed_(2)_(1)_1787560565753 (3).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/64), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [FTG-Plugin-fixed_(2)_(1)_1787560565753 (3).py](https://t.me/cloudecode/64). Байты вложений не сравнивались.

<a id="u089"></a>
## U089 — FTG-Plugin-patched.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/57), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [FTG-Plugin-patched.py](https://t.me/cloudecode/57). Байты вложений не сравнивались.

<a id="u090"></a>
## U090 — FTS-Plugin (15) (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/55), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [FTS-Plugin.py](https://t.me/cloudecode/14), [FTS-Plugin (2).py](https://t.me/cloudecode/31), [FTS-Plugin (3).py](https://t.me/cloudecode/33), [FTS-Plugin (15) (1).py](https://t.me/cloudecode/55). Байты вложений не сравнивались.

<a id="u091"></a>
## U091 — FTS-Plugin_fixed.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/51), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [FTS-Plugin_fixed.py](https://t.me/cloudecode/51). Байты вложений не сравнивались.

<a id="u092"></a>
## U092 — funpay-gift-bot.zip [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/42), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [funpay-gift-bot.zip](https://t.me/cloudecode/42). Байты вложений не сравнивались.

<a id="u093"></a>
## U093 — funpay_chat_broadcast_xvimp (2) (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/49), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [funpay_chat_broadcast_xvimp (1).py](https://t.me/cloudecode/46), [funpay_chat_broadcast_xvimp (2) (1).py](https://t.me/cloudecode/49). Байты вложений не сравнивались.

<a id="u094"></a>
## U094 — Gorgona_(2)_1787566265136 (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/69), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [Gorgona_(2)_1787566265136 (1).py](https://t.me/cloudecode/69). Байты вложений не сравнивались.

<a id="u095"></a>
## U095 — GPT Feedback.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/29), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [GPT Feedback.py](https://t.me/cloudecode/29). Байты вложений не сравнивались.

<a id="u096"></a>
## U096 — gpt.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/93), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [gpt.py](https://t.me/cloudecode/11), [gpt.py](https://t.me/FPC_pluginss/93). Байты вложений не сравнивались.

<a id="u097"></a>
## U097 — GPT_Consultant_1786981638015.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/65), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [GPT_Consultant_1786981638015.py](https://t.me/cloudecode/65). Байты вложений не сравнивались.

<a id="u098"></a>
## U098 — GPT_Feedback_fixed (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/52), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [GPT_Feedback_fixed (1).py](https://t.me/cloudecode/52). Байты вложений не сравнивались.

<a id="u099"></a>
## U099 — GPT_Feedback_xvimp.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/50), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [GPT_Feedback_xvimp.py](https://t.me/cloudecode/50). Байты вложений не сравнивались.

<a id="u100"></a>
## U100 — keywords_responder.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/35), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [keywords_responder.py](https://t.me/FPC_pluginss/35). Байты вложений не сравнивались.

<a id="u101"></a>
## U101 — keywords_responder_plugin.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/50), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [keywords_responder_plugin.py](https://t.me/FPC_pluginss/50). Байты вложений не сравнивались.

<a id="u102"></a>
## U102 — KOSellRent-1.1.29b (2).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/54), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [KOSellRent-1.1.29b (2).py](https://t.me/cloudecode/54). Байты вложений не сравнивались.

<a id="u103"></a>
## U103 — logs_manager.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/114), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [logs_manager.py](https://t.me/cloudecode/10), [logs_manager.py](https://t.me/FPC_pluginss/114). Байты вложений не сравнивались.

<a id="u104"></a>
## U104 — Lot Cleaner Pro .py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/4), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [Lot Cleaner Pro .py](https://t.me/cloudecode/4). Байты вложений не сравнивались.

<a id="u105"></a>
## U105 — minecraft_donate_1787946722908.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/72), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [minecraft_donate_1787946722908.py](https://t.me/cloudecode/72). Байты вложений не сравнивались.

<a id="u106"></a>
## U106 — ns_gifts_fpc_1788276479310.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/78), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [ns_gifts_fpc_1788276479310.py](https://t.me/cloudecode/78). Байты вложений не сравнивались.

<a id="u107"></a>
## U107 — plugin_from_zip.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/131), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [plugin_from_zip.py](https://t.me/FPC_pluginss/131). Байты вложений не сравнивались.

<a id="u108"></a>
## U108 — price_dumper_fpc_1787946654717.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/71), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [price_dumper_fpc_1787946654717.py](https://t.me/cloudecode/71). Байты вложений не сравнивались.

<a id="u109"></a>
## U109 — Rate_plugin 2.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/26), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [Rate_plugin 2.py](https://t.me/cloudecode/26). Байты вложений не сравнивались.

<a id="u110"></a>
## U110 — replace_word_plugin.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/37), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [replace_word_plugin.py](https://t.me/FPC_pluginss/37). Байты вложений не сравнивались.

<a id="u111"></a>
## U111 — review_reminder.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/21), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [review_reminder.py](https://t.me/cloudecode/21). Байты вложений не сравнивались.

<a id="u112"></a>
## U112 — search_lots_inline_plugin.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/FPC_pluginss/40), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [search_lots_inline_plugin.py](https://t.me/FPC_pluginss/40). Байты вложений не сравнивались.

<a id="u113"></a>
## U113 — Steam-Guard-Email.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/41), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [Steam-Guard-Email.py](https://t.me/cloudecode/41). Байты вложений не сравнивались.

<a id="u114"></a>
## U114 — Steam_Rental_Complete 2.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/23), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [Steam_Rental_Complete 2.py](https://t.me/cloudecode/23). Байты вложений не сравнивались.

<a id="u115"></a>
## U115 — steam_smm_fpc_1788269484822 (1).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/73), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [steam_smm_fpc_1788269484822 (1).py](https://t.me/cloudecode/73). Байты вложений не сравнивались.

<a id="u116"></a>
## U116 — SteamRanger.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/61), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [SteamRanger.py](https://t.me/cloudecode/61). Байты вложений не сравнивались.

<a id="u117"></a>
## U117 — SteamRentXvimp (2) (4).py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/70), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [SteamRentXvimp (2) (4).py](https://t.me/cloudecode/70). Байты вложений не сравнивались.

<a id="u118"></a>
## U118 — trade_manager_1788277653135.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/79), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [trade_manager_1788277653135.py](https://t.me/cloudecode/79). Байты вложений не сравнивались.

<a id="u119"></a>
## U119 — vip_roblox_1788271093087.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/cloudecode/74), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [vip_roblox_1788271093087.py](https://t.me/cloudecode/74). Байты вложений не сравнивались.

<a id="u120"></a>
## U120 — VOLT_Watch.zip [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/VOLT_PLUGINS/3), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [VOLT_Watch.zip](https://t.me/VOLT_PLUGINS/3). Байты вложений не сравнивались.

<a id="u121"></a>
## U121 — wallets_plugin.py [Telegram]

- **Сценарий:** Опубликовано вложение/описание плагина. Байты файла не получены из публичного web-preview; функциональность конкретного вложения не считается проверенной.
- **Вердикт:** недостаточно данных. Файл виден в ленте, но web-preview не отдаёт его исходник. Совпадение названия с GitHub не подтверждает идентичность; версии/патчи сохраняются как неподтверждённые.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_plugins/147), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).
- **Telegram-публикации:** [wallets_plugin.py](https://t.me/fpc_plugins/146), [wallets_plugin.py](https://t.me/fpc_plugins/147). Байты вложений не сравнивались.

<a id="u122"></a>
## U122 — AutoGW [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/6), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u123"></a>
## U123 — Auto Steam Rent [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/7), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u124"></a>
## U124 — Smart Greeting [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/8), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u125"></a>
## U125 — Auto Refund [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/9), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u126"></a>
## U126 — Auto Demping Lots [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/13), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u127"></a>
## U127 — Auto Ticket [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/17), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u128"></a>
## U128 — Auto Lot Tracker [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/23), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u129"></a>
## U129 — Auto Steam Gift [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/31), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u130"></a>
## U130 — Auto Steam Wallet [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/34), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u131"></a>
## U131 — Auto Telegram Stars [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/35), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u132"></a>
## U132 — Auto NS [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/38), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u133"></a>
## U133 — Auto DH [dd_plugins]

- **Сценарий:** Объявлен отдельный плагин Cardinal; настройки и результаты представлены продавцом, полный исходник отсутствует.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/dd_plugins/14), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u134"></a>
## U134 — AppRoute Reseller 0.1.0 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 0.1.0; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u135"></a>
## U135 — Auto AI Accounts 0.1.4 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 0.1.4; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u136"></a>
## U136 — AutoRobux by Jonny 1.4.5 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.4.5; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u137"></a>
## U137 — AUTOSMM 1.0.4 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.0.4; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u138"></a>
## U138 — Auto TT 1.0.21 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.0.21; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u139"></a>
## U139 — Stars by Jonny 1.4.15 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.4.15; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u140"></a>
## U140 — AutoSteamNS 3.17 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 3.17; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u141"></a>
## U141 — Gmail Code Fetcher 1.0.4 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.0.4; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u142"></a>
## U142 — Offline Activite 1.3.7 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.3.7; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u143"></a>
## U143 — RentSteamDante 0.9.21 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 0.9.21; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u144"></a>
## U144 — Trade Manager 0.0.2 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u145"></a>
## U145 — AutoRentVipRoblox 1.0.7 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.0.7; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u146"></a>
## U146 — GPT Consultant & Lot Info 1.1.11 [Jonny Cashout]

- **Сценарий:** Опубликована инструкция с командами и настройками конкретного коммерческого плагина; реализация не опубликована.
- **Вердикт:** недостаточно данных. В публичном plugin-data.js доступна документация, а не исходник плагина. Транспорт, дополнительные зависимости и полнота обработки ошибок требуют кода.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://wiki.jonnycashout.com/), версия 1.1.11; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u147"></a>
## U147 — Veemp auto-gift

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=auto-gift), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u148"></a>
## U148 — Veemp auto-robux

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=auto-robux), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u149"></a>
## U149 — Veemp auto-smm

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=auto-smm), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u150"></a>
## U150 — Veemp autostars

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=autostars), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u151"></a>
## U151 — Veemp consultant

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=consultant), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u152"></a>
## U152 — Veemp dumper

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=dumper), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u153"></a>
## U153 — Veemp gpt

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=gpt), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u154"></a>
## U154 — Veemp lot-cloner

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=lot-cloner), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u155"></a>
## U155 — Veemp nft-gifts

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=nft-gifts), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u156"></a>
## U156 — Veemp nft-rent

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=nft-rent), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u157"></a>
## U157 — Veemp steam-balance

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=steam-balance), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u158"></a>
## U158 — Veemp steam-smm

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=steam-smm), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u159"></a>
## U159 — Veemp steamrent

- **Сценарий:** В каталоге есть ссылка на продукт, но отдельная страница отдала только JS-оболочку; сценарий конкретного релиза не установлен.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://shop.veemp.net/shop/plugin.html?p=steamrent), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u160"></a>
## U160 — auro-robux [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auro-robux), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u161"></a>
## U161 — auto-chips [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-chips), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u162"></a>
## U162 — auto-demping [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-demping), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u163"></a>
## U163 — auto-gifts-steam-dh [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-gifts-steam-dh), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u164"></a>
## U164 — auto-mobile-dh [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-mobile-dh), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u165"></a>
## U165 — auto-rent-steam [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-rent-steam), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u166"></a>
## U166 — auto-stars-plugin [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-stars-plugin), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u167"></a>
## U167 — auto-steam [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-steam), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u168"></a>
## U168 — auto-steam-gifts-ns [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-steam-gifts-ns), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u169"></a>
## U169 — auto-tg-gifts [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-tg-gifts), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u170"></a>
## U170 — auto-vouchers-dh [fpc_chqcode_bot]

- **Сценарий:** Объявлена отдельная позиция каталога бота. Публичная ссылка не раскрывает код или полный контракт плагина.
- **Вердикт:** недостаточно данных. Исходник этой конкретной реализации недоступен. Описание фиксирует заявленные функции, но не транспорт, обработку ошибок и полный паритет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://t.me/fpc_chqcode_bot?start=plugin_auto-vouchers-dh), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u171"></a>
## U171 — Auto Robux [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_robux/windows.x86_64/download), версия 1.4.5; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u172"></a>
## U172 — Auto SMM [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_smm/windows.x86_64/download), версия 1.3.0; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u173"></a>
## U173 — AutoAI Account [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_ai/windows.x86_64/download), версия 0.1.4; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u174"></a>
## U174 — AutoStars [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_stars/windows.x86_64/download), версия 1.4.19; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u175"></a>
## U175 — AutoSteamNS [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_steamns/windows.x86_64/download), версия 3.18; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u176"></a>
## U176 — AutoTikTok [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_tt/windows.x86_64/download), версия 1.0.21; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u177"></a>
## U177 — Discord Boost [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/discord_boost/windows.x86_64/download), версия 0.3.1; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u178"></a>
## U178 — GPT SELLER [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/gpt_seller/windows.x86_64/download), версия 1.1.11; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u179"></a>
## U179 — GmailCodeFetcher [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/code_fetcher/windows.x86_64/download), версия 1.0.4; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u180"></a>
## U180 — Offline Activate [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/offline_activate/windows.x86_64/download), версия 1.3.7; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u181"></a>
## U181 — VipRoblox [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_viproblox/windows.x86_64/download), версия 1.0.7; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u182"></a>
## U182 — auto_back [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_back/windows.x86_64/download), версия 0.0.2; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u183"></a>
## U183 — auto_ticket [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_ticket/windows.x86_64/download), версия 1.3.1; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u184"></a>
## U184 — auto_withdraw [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/auto_withdraw/windows.x86_64/download), версия 0.0.11; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u185"></a>
## U185 — chat_sync [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/chat_sync/windows.x86_64/download), версия 0.1.21; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u186"></a>
## U186 — confirm_reminder [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/confirm_reminder/windows.x86_64/download), версия 2.3.1; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u187"></a>
## U187 — cookie_changer [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/cookie_changer/windows.x86_64/download), версия 0.0.3; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u188"></a>
## U188 — copy_lots [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/copy_lots/windows.x86_64/download), версия 0.0.6; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u189"></a>
## U189 — delete_lots [Carvinage protected release]

- **Сценарий:** Публичный релиз Cardinal: состав ZIP и хеш проверены; ядро поставляется в PyArmor-пакете с нативным runtime.
- **Вердикт:** недостаточно данных. Архив доступен, но основная реализация защищена PyArmor и зависит от CPython runtime. Загрузчик не раскрывает все функции. Исходник не восстановлен; код, .pyd и установщики не выполнялись.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://carvinage.ru/license/api/v1/releases/delete_lots/windows.x86_64/download), версия 0.0.6; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u190"></a>
## U190 — FunPay HexAuto

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Все файлы реализации состоят из одного байта; это структура-заглушка, а не работающее API.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/322323kek209239-hue/FunPay-HexAuto), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u191"></a>
## U191 — AutoSteamGift

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Python-файл доступен, но не разбирается: unexpected indent в строке 2. Нельзя принимать его за проверенную реализацию.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/romanovboris/AutoSteamGift), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u192"></a>
## U192 — Auto Steam Points advertised

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. В репозитории только README, исполняемого плагина нет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/akkovowo/FunpayCardinal-AutoPoints-Steam-Delivery), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u193"></a>
## U193 — Plugin catalog / gated delivery

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Доступна витрина, сам код предлагается через бота и в репозитории отсутствует.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/SellPay1/FunPayCardinalPlugins), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u194"></a>
## U194 — OnTPlugin

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Только README с описанием; исходника плагина нет.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/G3tHx/OnTPlugin), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u195"></a>
## U195 — Steam/GTA rental advertised

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Только описание и контакт, реализация недоступна.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/andreyzayaz0504-wq/funpay-cardinal-gta-5-plugin-avtoarenda), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u196"></a>
## U196 — Auto Ticket advertised

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. README и вспомогательные файлы не дают исходника конкретной реализации.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/Kewanmov/FunPay-Cardinal-Auto-Ticket), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u197"></a>
## U197 — AutoJar Back

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. В репозитории только README.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/fiksey/FPC-AutoJar-Back), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u198"></a>
## U198 — AutoSmm advertised

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. В репозитории только README.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/ThisTakou/AutoSmm), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Проверено:** доступность и содержание публикации. Исходник конкретного релиза не прочитан; все обещания продавца остаются заявлениями.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u199"></a>
## U199 — NitroFlow (standalone)

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Смежный самостоятельный бот, не Cardinal-плагин. Каталог и HTTP-движок прочитаны; полный поставщик/выдача не подтверждены.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/skyredy/FPC-NitroFlow), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u200"></a>
## U200 — Telegram Gift Bot (standalone)

- **Сценарий:** См. конкретную причину в карточке.
- **Вердикт:** недостаточно данных. Самостоятельный бот, не Cardinal-плагин. Код есть; пользовательская MTProto-сессия и точный платёжный поток требуют отдельного браузерного пилота.
- **Потери/неизвестное:** Не установлены: без исходника нельзя достоверно перечислить все сценарии и потери.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** не оценена; приоритет 4; уверенность низкая.
- **Источник:** [проверенная ссылка](https://github.com/tgwyoxn/Funpay-Telegram-Gifts-), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

<a id="u201"></a>
## U201 — Steam FunPay Auto Rental — Seno47 (standalone)

- **Сценарий:** Аренда, импорт Steam Guard, контроль Dota presence, выдача, продление и kick.
- **Вердикт:** нужен помощник/сервер. sg_service.py запускает sg.exe; steam_presence_service.js использует steam-user и игровой presence. В обычном MV3 нет равного ОС-процесса/Steam-клиента.
- **Потери/неизвестное:** Без помощника теряются sg.exe setup/import и native Steam presence; одна выдача логина не сохраняет полный инструмент.
- **В Funcy:** сравнение возможно только на уровне заявленной функции
- **Сложность:** высокая; приоритет 4; уверенность высокая.
- **Источник:** [проверенная ссылка](https://github.com/Seno47/steam-funpay-auto-rental), версия не установлена; дата 2026-11-03.
- **Лицензия:** не установлена; доступ к публикации не лицензия. Техническая переносимость не является разрешением копировать исходник.
- **Работа во времени:** 24/7 и точность расписаний не подтверждены; браузер должен работать.
- **Зависимости исходника:** см. исходник / отдельная запись доказательств. Python-зависимость не автоматически блокирует независимую JS-реализацию.
- **Внешние хосты в коде:** FunPay/зависимости; см. evidence.json.
- **Проверено:** статический разбор импортов, обработчиков и сетевых/временных зависимостей. Чужой код не импортировался и не запускался.
- **Документация:** [chrome-life](compatibility.md#chrome-life), [chrome-http](compatibility.md#chrome-http).

