// Search terms and routes retained independently of replacement views.
window.FPTPopupMetadata = Object.freeze({
  "pages": {
    "accounts": {
      "features": [
        {
          "text": "Управление аккаунтами"
        },
        {
          "text": "Сохраненные аккаунты:"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "addCurrentAccountBtn",
        "fptRefreshAccountsBtn"
      ]
    },
    "needs": {
      "features": [
        {
          "text": "Элементы интерфейса"
        },
        {
          "text": "Элементы, которые можно отключить"
        },
        {
          "text": "Скрыть элементы с помощью ИИ"
        },
        {
          "text": "Предпросмотр элемента на FunPay"
        },
        {
          "text": "Показать все скрытые элементы"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fptNeedsAskBtn"
      ]
    },
    "templates": {
      "features": [
        {
          "text": "Быстрые ответы"
        },
        {
          "text": "Шаблоны у скрепки",
          "mode": "templates"
        },
        {
          "text": "Включить шаблоны Показывать кнопку меню шаблонов рядом со скрепкой.",
          "mode": "templates"
        },
        {
          "text": "Отправлять сразу по клику Если выключено, текст сначала подставляется в поле ввода.",
          "mode": "templates"
        },
        {
          "text": "Редактор шаблонов",
          "mode": "templates"
        },
        {
          "text": "Слэш-команды Введите в чате /команду , чтобы быстро развернуть сохранённый ответ.",
          "mode": "commands"
        },
        {
          "text": "Подсказка при вводе Показывать подходящие команды после символа /.",
          "mode": "commands"
        },
        {
          "text": "Tab или Enter",
          "mode": "commands"
        },
        {
          "text": "Только Tab",
          "mode": "commands"
        },
        {
          "text": "Только Enter",
          "mode": "commands"
        },
        {
          "text": "Мои команды",
          "mode": "commands"
        }
      ],
      "modes": [
        "templates",
        "commands"
      ],
      "defaultMode": "templates",
      "buttons": [
        "fptQuickRepliesTemplatesTab",
        "fptQuickRepliesCommandsTab",
        "addCustomTemplateBtn",
        "fptSlashAddBtn"
      ]
    },
    "auto_review": {
      "features": [
        {
          "text": "Отзывы и бонусы"
        },
        {
          "text": "Ответы на отзывы Ответ не отправляется автоматически, если вы уже ответили покупателю вручную."
        },
        {
          "text": "Текст ответа"
        },
        {
          "text": "Бонус за отзыв 5★ После пятизвёздочного отзыва отправить покупателю сообщение с бонусом."
        },
        {
          "text": "Один бонус"
        },
        {
          "text": "Случайный из списка"
        },
        {
          "text": "Сообщение с бонусом"
        },
        {
          "text": "Новый вариант бонуса"
        },
        {
          "text": "Задержка перед бонусом Пауза после ответа на отзыв. Рекомендуется 3–5 секунд."
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "addBonusBtn"
      ]
    },
    "auto_reply": {
      "features": [
        {
          "text": "Автоответчик"
        },
        {
          "text": "Приветствие новых покупателей Отправляется при первом подходящем сообщении покупателя."
        },
        {
          "text": "Текст приветствия"
        },
        {
          "text": "Только совсем новые чаты Не отправлять приветствие в уже существующем диалоге."
        },
        {
          "text": "Игнорировать системные события Не приветствовать из-за уведомлений о заказах и отзывах."
        },
        {
          "text": "Повторное приветствие Через сколько дней можно поприветствовать покупателя снова. 0 — без кулдауна."
        },
        {
          "text": "Ответ на новый заказ Сообщение после оплаты нового заказа."
        },
        {
          "text": "Сообщение покупателю"
        },
        {
          "text": "Ответ при подтверждении заказа Сообщение после подтверждения заказа покупателем."
        },
        {
          "text": "Ответы по ключевым словам Отвечать, когда сообщение точно совпадает с фразой или содержит её."
        },
        {
          "text": "Ключевое слово или фраза"
        },
        {
          "text": "Точное"
        },
        {
          "text": "Содержит"
        },
        {
          "text": "Ответ"
        },
        {
          "text": "Прикрепить изображение К ответу можно добавить картинки PNG, JPEG, GIF или WebP до 1 МБ."
        },
        {
          "text": "Порядок отправки Сначала текст или сначала картинка."
        },
        {
          "text": "Добавить правило"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "addKeywordBtn"
      ]
    },
    "lot_io": {
      "features": [
        {
          "text": "Управление лотами"
        },
        {
          "text": "Перенос лотов"
        },
        {
          "text": "Массовое редактирование"
        },
        {
          "text": "Незавершённые импорты"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "lot-io-export-btn",
        "lot-io-import-btn",
        "fp-bulk-edit-btn"
      ]
    },
    "finance_hub": {
      "features": [
        {
          "text": "Обзор и аналитика"
        },
        {
          "text": "Период"
        },
        {
          "text": "Валюта"
        },
        {
          "text": "Статус заказа"
        },
        {
          "text": "Категория"
        },
        {
          "text": "По"
        },
        {
          "text": "Выручка chevron_right"
        },
        {
          "text": "Чистая прибыль chevron_right"
        },
        {
          "text": "Заказы chevron_right"
        },
        {
          "text": "Средний чек chevron_right"
        },
        {
          "text": "Потенциальная выручка chevron_right"
        },
        {
          "text": "Потенциал прибыли chevron_right"
        },
        {
          "text": "Стоимость склада chevron_right"
        },
        {
          "text": "Активные лоты chevron_right"
        },
        {
          "text": "Динамика"
        },
        {
          "text": "Структура по категориям"
        },
        {
          "text": "Топ товаров"
        },
        {
          "text": "Топ категорий"
        },
        {
          "text": "Последние события"
        },
        {
          "text": "Выручка от продаж"
        },
        {
          "text": "Оплачено заказов"
        },
        {
          "text": "Средний чек продажи"
        },
        {
          "text": "Возвраты и споры"
        },
        {
          "text": "Динамика продаж"
        },
        {
          "text": "Продажи по категориям"
        },
        {
          "text": "Детализация продаж"
        },
        {
          "text": "Расходы на покупки"
        },
        {
          "text": "Куплено товаров"
        },
        {
          "text": "Средний чек покупки"
        },
        {
          "text": "Завершено покупок"
        },
        {
          "text": "Динамика расходов на покупки"
        },
        {
          "text": "Топ продавцов"
        },
        {
          "text": "История покупок"
        },
        {
          "text": "Реализованная прибыль"
        },
        {
          "text": "Себестоимость продаж"
        },
        {
          "text": "Маржинальность"
        },
        {
          "text": "ROI инвестиций"
        },
        {
          "text": "Выручка vs Прибыль"
        },
        {
          "text": "Покрытие себестоимости"
        },
        {
          "text": "Заказы и чистая прибыль"
        },
        {
          "text": "Потенциал выручки"
        },
        {
          "text": "Потенциал прибыли"
        },
        {
          "text": "Стоимость склада"
        },
        {
          "text": "Лоты в продаже"
        },
        {
          "text": "Таблица активных предложений"
        },
        {
          "text": "Всего пополнений"
        },
        {
          "text": "Всего выводов"
        },
        {
          "text": "Операций за период"
        },
        {
          "text": "Чистый поток (нетто)"
        },
        {
          "text": "Динамика баланса"
        },
        {
          "text": "Структура движения"
        },
        {
          "text": "История операций баланса"
        },
        {
          "text": "Статистика покупок и продаж Показывать прежние отчёты на вкладках покупок и продаж."
        },
        {
          "text": "Статистика на странице «Финансы» Оставить старый финансовый блок FunPay вместе с Finance Hub."
        }
      ],
      "modes": [
        "overview",
        "sales",
        "purchases",
        "profit",
        "potential",
        "operations"
      ],
      "defaultMode": "overview",
      "buttons": [
        "fptFinRefreshBtn",
        "fptFinExportBtn",
        "fptFinTabOverview",
        "fptFinTabSales",
        "fptFinTabPurchases",
        "fptFinTabProfit",
        "fptFinTabPotential",
        "fptFinTabOperations",
        "fptFinCustomApplyBtn",
        "fptFinCustomResetBtn",
        "fptFinProfitCostWarningAction"
      ]
    },
    "theme": {
      "features": [
        {
          "text": "Своя тема FunPay"
        },
        {
          "text": "Включить кастомную тему"
        },
        {
          "text": "Готовые темы"
        },
        {
          "text": "Оригинальный вид FunPay"
        },
        {
          "text": "Вернуть оригинальную тему"
        },
        {
          "text": "Чёрная тема"
        },
        {
          "text": "Случайная тема"
        },
        {
          "text": "Фон"
        },
        {
          "text": "Фоновое изображение"
        },
        {
          "text": "Размытие фона"
        },
        {
          "text": "Яркость фона"
        },
        {
          "text": "Подобрать цвета по картинке"
        },
        {
          "text": "Цвета"
        },
        {
          "text": "Основной цвет"
        },
        {
          "text": "Акцентный цвет"
        },
        {
          "text": "Фон блоков"
        },
        {
          "text": "Цвет текста"
        },
        {
          "text": "Цвет ссылок"
        },
        {
          "text": "Шрифт и форма"
        },
        {
          "text": "Шрифт"
        },
        {
          "text": "Закругление углов"
        },
        {
          "text": "Верхняя панель сверху или снизу"
        },
        {
          "text": "Блоки"
        },
        {
          "text": "Прозрачность блоков"
        },
        {
          "text": "Эффект матового стекла"
        },
        {
          "text": "Размытие стекла"
        },
        {
          "text": "Детали"
        },
        {
          "text": "Свой скроллбар"
        },
        {
          "text": "Цвет ползунка"
        },
        {
          "text": "Цвет дорожки"
        },
        {
          "text": "Ширина скроллбара"
        },
        {
          "text": "Декоративные круги Кругляшки"
        },
        {
          "text": "Мягкие разделители"
        },
        {
          "text": "Предпросмотр темы"
        },
        {
          "text": "Инструменты"
        },
        {
          "text": "Редактор элементов"
        },
        {
          "text": "Экспорт темы"
        },
        {
          "text": "Импорт темы"
        },
        {
          "text": "Поделиться темой"
        },
        {
          "text": "Сбросить тему"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fp-apply-dark-preset",
        "fp-wp-prev",
        "fp-wp-next",
        "fp-wp-apply-cur",
        "uploadBgImageBtn",
        "removeBgImageBtn",
        "enableMagicStickBtn",
        "generatePaletteBtn",
        "randomizeThemeBtn",
        "shareThemeBtn",
        "exportThemeBtn",
        "importThemeBtn",
        "resetThemeBtn"
      ]
    },
    "autobump": {
      "features": [
        {
          "text": "Автоподнятие лотов"
        },
        {
          "text": "Автоматическое поднятие"
        },
        {
          "text": "Только выбранные категории Ограничить поднятие заранее выбранным набором категорий."
        },
        {
          "text": "Журнал"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "configureSelectiveBumpBtn",
        "autoBumpLogToggle"
      ]
    },
    "effects": {
      "features": [
        {
          "text": "Предпросмотр"
        },
        {
          "text": "Частицы за курсором"
        },
        {
          "text": "Включить эффекты частиц"
        },
        {
          "text": "Тип эффекта: искры, след, снег, кровь"
        },
        {
          "text": "Цвета частиц"
        },
        {
          "text": "Радужный (RGB)"
        },
        {
          "text": "Интенсивность"
        },
        {
          "text": "Сбросить частицы"
        },
        {
          "text": "Свой курсор"
        },
        {
          "text": "Включить свой курсор"
        },
        {
          "text": "Изображение курсора"
        },
        {
          "text": "Скрыть системный курсор"
        },
        {
          "text": "Размер курсора"
        },
        {
          "text": "Непрозрачность курсора"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "resetCursorFxBtn",
        "uploadCursorImageBtn",
        "removeCursorImageBtn"
      ]
    },
    "sounds": {
      "features": [
        { "text": "Звук уведомлений" },
        { "text": "Звук нового сообщения" },
        { "text": "Мелодия уведомления" },
        { "text": "Стандартный звук FunPay" },
        { "text": "ВКонтакте" },
        { "text": "Telegram" },
        { "text": "iPhone" },
        { "text": "Discord" },
        { "text": "WhatsApp" },
        { "text": "Громкость уведомлений" },
        { "text": "Своя мелодия" },
        { "text": "Обрезать мелодию" }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "previewNotificationBtn",
        "fptCustomSoundUploadBtn",
        "fptClipSecUp",
        "fptClipSecDown",
        "fptCustomSoundPreviewBtn",
        "fptCustomSoundSaveBtn",
        "fptCustomSoundRemoveBtn"
      ]
    },
    "settings_io": {
      "features": [
        {
          "text": "Перенос настроек"
        },
        { "text": "Скачать .fpconfig" },
        { "text": "Импорт настроек из файла" },
        { "text": "Выбор разделов при импорте" },
        {
          "text": "Сброс данных"
        },
        { "text": "Обработанные сообщения" },
        { "text": "Поприветствованные покупатели" },
        { "text": "Закреплённые лоты" }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fp-settings-export-btn",
        "fp-settings-import-btn",
        "fp-reset-autoresponder-btn",
        "fp-reset-pinned-btn",
        "fp-reset-greeted-btn",
        "fp-reset-april-btn"
      ]
    },
    "blacklist": {
      "features": [
        {
          "text": "Чёрный список покупателей"
        },
        {
          "text": "Добавить покупателя"
        },
        {
          "text": "Пользователь"
        },
        {
          "text": "Причина"
        },
        {
          "text": "Покупатели в списке"
        },
        {
          "text": "Отключить автовыдачу"
        },
        {
          "text": "Отключить автоответы"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fp-bl-add-btn"
      ]
    },
    "auto_delivery": {
      "features": [
        {
          "text": "Автовыдача товаров"
        },
        {
          "text": "Автовыдача по лотам"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fp-load-delivery-lots-btn"
      ]
    },
    "auto_orders": {
      "features": [
        {
          "text": "Заказы и выдачи"
        },
        {
          "text": "Заказы, требующие решения"
        },
        {
          "text": "Статус и история выдачи"
        },
        {
          "text": "Карточка заказа и повторная отправка части"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": []
    },
    "tickets": {
      "features": [
        {
          "text": "Заявки в техподдержку FunPay"
        },
        {
          "text": "Новая заявка в поддержку"
        },
        {
          "text": "Подтверждение заказов: возраст заказа и заказов в заявке"
        },
        {
          "text": "Ваши заявки: поиск, статус, сортировка"
        },
        {
          "text": "Переписка с поддержкой и ответ в заявке"
        },
        {
          "text": "Закрыть заявку"
        }
      ],
      "modes": [],
      "defaultMode": null,
      "buttons": [
        "fp-ticket-refresh-btn",
        "fp-send-auto-ticket-btn",
        "fp-create-ticket-btn",
        "fp-ticket-detail-back",
        "fp-ticket-reply-btn",
        "fp-ticket-confirm-yes",
        "fp-ticket-confirm-no",
        "fp-new-ticket-close",
        "fp-new-ticket-submit"
      ]
    }
  }
});
