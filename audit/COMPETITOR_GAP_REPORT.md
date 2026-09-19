# FP Tools — аудит функций конкурентов и функционального разрыва

Дата среза: 2026-09-19  
Объект: `C:\FunPayDev`  
Режим проверки: учитываются только функции, у которых есть активная точка запуска через `manifest.json`, service worker или вызываемый runtime-маршрут.

## 1. Откуда взят сигнал спроса

| Продукт | Публичный сигнал | Роль в сравнении |
|---|---:|---|
| FunPay Lite Bot | 60 000 пользователей, 4,9/5, около 4 000 оценок | главный массовый ориентир |
| Funpay extension | 10 000 пользователей, 4,9/5, 592 оценки | второй массовый ориентир |
| FunPay Helper | 940 пользователей, 4,5/5, 40 оценок | новые нишевые функции и UX |
| FunPay Plus | открытая страница функций без публичного счётчика установок | свежий benchmark по аналитике и группам |
| FunPay Automation Tool | открытый README без счётчика пользователей | benchmark архитектуры multiposting/диагностики |

Источник чисел и публичных описаний: карточки Chrome Web Store и официальная страница FunPay Plus. Заявления из описаний считаются заявленной функцией продукта; наличие в FP Tools подтверждалось по активному коду, а не по README.

## 2. Полный каталог внешних функций и статус FP Tools

Легенда: `✅` есть активная реализация; `◐` есть близкая часть, но не весь сценарий; `❌` активной реализации не найдено.

### Продажи, лоты, цены

| Функция из других расширений | Где повторяется | FP Tools | Что проверено |
|---|---|---:|---|
| Автоподнятие с чтением cooldown FunPay | Lite Bot, Plus, Automation, Funpay extension | ✅ | `background/autobump.js`, `background/smart_bump.js`, popup-настройки |
| Поднять все/выбранные категории вручную | Lite Bot, Automation | ✅ | `profile_raise_all.js`, `lot_management.js` |
| Точная цена продавца и цена для покупателя | Lite Bot, Automation | ✅ | `exact_price.js`, `buyer_price_field.js` |
| Комиссия раздела и реальная цена лота | Lite Bot | ✅ | `section_commission.js` |
| Массовое удаление/включение/выключение/изменение цены | Lite Bot, Helper, Automation | ✅ | `lot_management.js`, `bulk_lot_editor.js` |
| Копирование своих, чужих и заказных лотов | Helper, Automation | ✅ | `lot_cloning.js`, `lot_management.js`, `order_lot_copy.js`, background clone handlers |
| Перенос чужих лотов пачкой | Helper, FunPay Tools | ✅ | активный `.clone-lots` в `lot_management.js`; старый `multi_clone.js` не считается |
| Авто-выдача, остаток товара, отключение при нуле, восстановление | Helper, FunPay Tools | ✅ | `auto_delivery.js`, `auto_delivery_ui.js`, `auto_restore_lots.js` |
| Экспорт/импорт лотов и резервные копии | Lite Bot, Funpay extension, Automation | ✅ | `lot_io.js`, `settings_io.js` |
| Сохранённые именованные группы лотов | Plus | ❌ | есть только закреплённые лоты и выбор категорий; CRUD групп не найден |
| Пресеты публикации категорий | Automation | ❌ | отдельного хранилища/загрузчика пресетов нет |
| Отдельный черновик для каждой копии: текст, цена, сообщение | Automation | ❌ | текущий clone-flow не даёт независимые draft-данные по каждой копии |
| Адаптивный multiposting по схеме каждой категории + очередь с остановкой при ошибке | Automation | ◐ | поля категории подбираются в clone-flow, но нет полноценного preset/draft/queue-сценария |
| Автоколичество по правилам min/max/источнику пополнения | Helper | ◐ | есть `productCount` и автоматические on/off, но нет rule engine пополнения |
| Просмотр всех промо-лотов отдельным режимом | Lite Bot | ◐ | есть иконки промо-лотов (`ui_enhancements.js`), отдельного списка/режима всех промо-лотов нет |
| Себестоимость лота и чистая прибыль по лоту | Lite Bot | ❌ | в активном коде нет полей/расчётов `cost`, себестоимости или net profit |
| Единый net profit после покупок, выводов, возвратов и расходов | Plus | ❌ | есть отдельная финансовая статистика и net cash-flow, но не profit-модель с себестоимостью |
| Мониторинг конкурентов и автоматический repricing/dumper | смежные FunPay-инструменты | ❌ | `market_analytics.js` даёт срез рынка, наблюдателя цен и изменения цены по конкурентам нет |

### Чаты и автоматизация

| Функция из других расширений | Где повторяется | FP Tools | Что проверено |
|---|---|---:|---|
| Быстрые шаблоны и переменные | Lite Bot, Helper, Automation, Funpay extension | ✅ | `templates.js`, `slash_commands.js` |
| AI-переменные внутри шаблонов | Helper/FunPay Tools | ✅ | `{ai:...}` в `templates.js` |
| Автоприветствие с пользовательским cooldown | Lite Bot, Helper, Automation | ✅ | `background/autoresponder.js` |
| Автоответ по ключевым словам: exact/contains | Lite Bot, Helper | ✅ | `auto_review.js`, `background/autoresponder.js` |
| Ответ после оплаты и после подтверждения | Helper, Automation | ✅ | `handleOrderPurchased`, `handleOrderConfirmed` |
| Автоответ на отзыв по оценке | Lite Bot, Automation | ✅ | `handleReview`, пять шаблонов рейтинга |
| AI-ответ на отзыв вручную | FunPay Tools | ✅ | `content_script.js`, кнопка AI на странице отзыва |
| AI-ответ на отзыв полностью автоматически | Helper/AI-oriented tools | ❌ | автоматический review-path использует только сохранённые шаблоны; AI-вызова в нём нет |
| Имитация набора, антиспам, игнор системных сообщений и ЧС | Helper, Automation | ✅ | `autoresponder.js`, `blacklist.js` |
| Быстрые ответы, закреплённые ответы и сохранённые сценарии | Automation | ◐ | шаблоны и сценарии есть, отдельного pin/favorites-слоя для ответов нет |
| Рассылка одного сообщения по нескольким чатам | Helper | ❌ | массового chat-target queue не найдено |
| Live-перевод входящих сообщений | FunPay Tools/Helper | ✅ | `chat_reply.js` — перевод сообщения/группы в чате |
| Ответ на конкретное сообщение и выделенный фрагмент | FunPay Tools | ✅ | `chat_reply.js` |
| Мультифото, подпись, редактор, альбомы, lightbox | FunPay Tools | ✅ | `chat_image_attach.js`, `chat_image_album.js` |
| Поиск по чату, черновики, экспорт переписки | FunPay Tools | ✅ | `chat_search.js`, `chat_enhancements.js`, `buyer_history.js` |
| Command palette по `Ctrl+K` | Helper | ❌ | есть поиск разделов popup, отдельного глобального Ctrl+K palette нет |
| Quick copy / навигация по большим спискам | Helper | ◐ | локальные copy-кнопки есть; отдельного scroll-pilot нет |
| Конфетти после продажи | Helper | ❌ | активного sale-confetti обработчика нет |
| Встроенный TOTP/Google Authenticator | Helper | ❌ | TOTP-хранилища и генератора кодов нет |

### Аналитика и уведомления

| Функция из других расширений | Где повторяется | FP Tools | Что проверено |
|---|---|---:|---|
| Продажи, покупки, финансы | Lite Bot, Plus, FunPay Tools | ✅ | `sales_modes.js`, `purchases.js`, `finance.js` |
| Графики, диаграммы, фильтры, поиск, drill-down | FunPay Tools | ✅ | `sales_modes.js`, `stats_drilldown.js` |
| Excel/DOCX/PDF/CSV/JSON экспорт | FunPay Tools | ✅ | `export_studio.js` |
| Средний чек и возвраты | Plus, FunPay Tools | ✅ | `ui_enhancements.js`, `sales_modes.js` |
| Доход/выводы/покупки/возвраты в одном profit-dashboard | Plus | ◐ | показатели находятся на разных страницах/БД; общего profit-dashboard нет |
| Календарь активности по дням, лучшие дни, active days, категории дня | Plus | ❌ | есть дневной график, calendar-card/heatmap режима нет |
| Zoom/pan графика и открытие операции кликом | Plus | ◐ | клик/drill-down есть; wheel zoom и pan нет |
| Экспорт неподтверждённых продаж/ID | Lite Bot | ❌ | сумма и список для тикета есть, отдельной выгрузки pending sales нет |
| Ограничения рейтинга, рейтинг покупателя, отзывы покупателя | Lite Bot | ❌ | buyer history показывает покупки/сумму, rating/review-блоков нет |
| Отдельный звук для нового заказа | Lite Bot | ◐ | есть общий notification sound + volume/custom clip; event-specific sound routing нет |
| Тихие часы/quiet hours | Automation | ❌ | настройки quiet-hours отсутствуют |
| Telegram/Discord уведомления и команды | FunPay Tools | ✅ | `background/telegram.js`, Discord handlers в `background/background.js` |
| Диагностика, health/status, очистка кэшей | Automation | ◐ | есть точечные reset/import/export, отдельной диагностики и cache cleanup нет |

### Профиль, внешний вид, технический UX

| Функция из других расширений | Где повторяется | FP Tools | Что проверено |
|---|---|---:|---|
| Тёмная тема, фон/GIF, цвета, прозрачность, курсор, анимации | Lite Bot, Helper, Funpay extension, Plus | ✅ | `theme.js`, `main_popup.js`, `cursor_fx.js`, `magicstick.js` |
| Public nickname: цвет/градиент/шрифт/анимации | Lite Bot, FunPay Tools | ◐ | эффекты/epic nickname есть, полноценного пользовательского конструктора Lite Bot нет |
| Публичное описание профиля | Lite Bot, FunPay Tools | ✅ | `profile_descriptions.js` |
| Публичный статус-бейдж | Lite Bot | ❌ | активного редактора/рендера такого статуса нет |
| GIF-аватар, профильный фон/cover и скрытие стандартной обложки | Helper | ❌ | banner editor в `profile_descriptions.js` отключён; avatar/profile cover-модуля нет |
| Spotify current track + live progress | Helper | ❌ | Spotify OAuth/PKCE и widget отсутствуют |
| Glassmorphism: отдельные Blur/Transparency toggles | Helper | ◐ | прозрачность темы есть, независимого blur-контроля нет |
| Shadow DOM для панели | Helper, Automation | ❌ | `shadowRoot`/`attachShadow` в активном коде не найден |
| Встроенный единый seller-center `/plus` | Plus, Automation | ◐ | popup и отдельные страницы есть, объединённого seller-center нет |

## 3. Что уже не считается работающей функцией

В корне `content/features` найдены файлы, которые не подключены напрямую через `manifest.json`: `discord.js`, `homepage_redesign.js`, `multi_clone.js`, `order_timer.js`, `theme_gallery.js`. Они не засчитывались как активные. При этом рабочие аналоги обнаружены в других местах: Discord — в background, массовое копирование чужих лотов — в `lot_management.js`, каталог обоев — в `content/ui/main_popup.js`. Таймер подтверждения из `order_timer.js` активным не считается.

## 4. Приоритеты gap backlog

### P0 — самое сильное пересечение спроса и бизнес-ценности

1. **Себестоимость + net profit**: модель затрат на лот, прибыль после комиссии, возвратов, покупок и выводов.
2. **Named lot groups**: группы, CRUD состава, активация/деактивация/цена по группе.
3. **Multiposting 2.0**: пресеты категорий, индивидуальные draft-поля каждой копии, адаптер схемы формы, последовательная очередь и rollback при ошибке.
4. **Buyer intelligence**: rating restrictions, рейтинг/отзывы покупателя, экспорт pending sales.
5. **Unified seller dashboard**: profit, withdrawals, purchases, refunds, calendar и lots в одном экране.

### P1 — заметный пользовательский разрыв

6. Автоматические AI-ответы на отзывы.
7. Автоколичество с правилами min/max и источником пополнения.
8. Quiet hours и event-specific notification sounds.
9. Command palette `Ctrl+K`.
10. Диагностика, health/status и очистка локальных кэшей.
11. Zoom/pan и calendar-view в аналитике.

### P2 — нишевые differentiators

12. Broadcast по нескольким чатам.
13. TOTP.
14. Spotify-status, GIF-аватары и profile cover.
15. Sale-confetti, scroll-pilot, публичный status badge.
16. Shadow DOM/isolation для панели.
17. Competitor price watcher/repricer — отдельный стратегический модуль, не быстрый UX-gap.

## 5. Итог

FP Tools уже закрывает основное ядро массового спроса: bump, цены/комиссию, лоты, автоответы, статистику, экспорт, кастомизацию и расширенный чат. Главный разрыв не в количестве мелких кнопок, а в пяти бизнес-сценариях: **прибыль**, **группы**, **профессиональный multiposting**, **данные о покупателе** и **единая панель продавца**. Именно они дадут больший эффект, чем Spotify, TOTP или декоративные эффекты.

