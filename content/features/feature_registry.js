// content/features/feature_registry.js
// =============================================================================
// FPT FEATURE REGISTRY - каталог ФОРС-ЭЛЕМЕНТОВ, которые расширение само внедряет
// на страницы FunPay. Каждый selector и каждый preview сверены с реальным кодом
// модулей в content/features/* и их CSS в css/*.
//
// ПРАВИЛА:
//   1. Только то, что расширение реально вставляет в DOM и что иначе никак не
//      отключить. Никаких выдуманных функций.
//   2. НЕ включаем то, у чего уже есть свой переключатель в других вкладках
//      (тема, авто-поднятие, копилки, авто-ответы, эффекты курсора, метка рядом
//      с ником, значки заказов и т.п.).
//   3. preview - ЧЕСТНАЯ мини-копия реального элемента: тот же текст, та же
//      иконка, те же цвета/форма, что и в живом элементе.
//
// preview.html может содержать токен {{MAGIC_ICON}} - он будет заменён на
// реальный путь к иконке icons/magic.png (как в живой кнопке ИИ в чате).
//
// Отключённые элементы хранятся в fpToolsDisabledFeatures: string[].
// =============================================================================

const FPT_NEEDS_GROUP_ORDER = [
    'Верхняя панель',
    'Чат',
    'Создание и оформление лота',
    'Копирование и импорт лотов',
    'Цены и аналитика',
    'Список лотов и профиль'
];

const FPT_NEEDS_CHAT_SUBGROUP_ORDER = [
    'Поле ввода',
    'Шапка диалога',
    'Действия в диалоге'
];

const FPT_NEEDS_LEGACY_PAGE_LABELS = ['Функции'];

const FPT_FEATURE_REGISTRY = [
    // ───────────── Шапка сайта ─────────────
    {
        id: 'rmthub_seller_search',
        label: 'Поиск продавца на RMTHub',
        desc: 'Поле в верхней панели сайта (плейсхолдер «Продавец») с кнопкой-иконкой пользователя - ищет профиль продавца по точному нику на RMTHub.',
        group: 'Верхняя панель',
        selector: '#fp-rmthub-form',
        preview: { kind: 'html', html: '<div class="fpt-pv-rmthub"><span>Продавец</span> <span class="fpt-pv-rmthub-ico">👤</span></div>' }
    },

    // ───────────── Чат: поле ввода ─────────────
    {
        id: 'chat_custom_attach',
        label: 'Своя кнопка прикрепления фото',
        desc: 'Заменяет нативную скрепку FunPay в чате на кнопку с Material-иконкой. Позволяет выбрать сразу несколько фото и показывает альбом-превью по центру экрана с полем «Сообщение...» (фото отправляются первыми, текст - после).',
        group: 'Чат',
        subgroup: 'Поле ввода',
        selector: '.fpt-attach-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-aibtn"><span class="material-symbols-rounded" style="font-size:22px;color:#4a9fd4">attach_file</span></div>' }
    },
    {
        id: 'chat_ai_rewrite_btn',
        label: 'Кнопка ИИ-режима в чате',
        desc: 'Круглая кнопка с фиолетовой иконкой-«волшебством» рядом с кнопкой отправки в чате - включает ИИ-режим (переписывает/генерирует ответ по Enter).',
        group: 'Чат',
        subgroup: 'Поле ввода',
        selector: '#aiModeToggleBtn',
        preview: { kind: 'html', html: '<div class="fpt-pv-aibtn"><img src="{{MAGIC_ICON}}" alt="AI"></div>' }
    },
    {
        id: 'chat_reply',
        label: 'Ответы на сообщения',
        desc: 'При наведении на сообщение появляются иконки «перевести» и «ответить». Ответ показывается над полем ввода (как в Telegram), а у пользователей с расширением цитата отображается красивой кликабельной плашкой с переходом к исходному сообщению.',
        group: 'Чат',
        subgroup: 'Поле ввода',
        selector: '.fpt-msg-tools, .fpt-reply-bar, .fpt-reply-card',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a>↩ Ответить · 🌐 Перевести</a></div>' }
    },
    {
        id: 'chat_char_counter',
        label: 'Счётчик символов в чате',
        desc: 'Маленькое число в углу поля ввода сообщения - показывает количество введённых символов (становится оранжевым/красным при больших значениях).',
        group: 'Чат',
        subgroup: 'Поле ввода',
        selector: '#fp-chat-char-count',
        preview: { kind: 'html', html: '<div class="fpt-pv-charcount-field"><span>сообщение…</span><span class="fpt-pv-charcount">128</span></div>' }
    },
    {
        id: 'profanity_warning',
        label: 'Предупреждение о грубости',
        desc: 'Красная полоса над полем ввода в чате: «Обнаружена грубость! Хотите это исправить с помощью AI?…». Появляется при наличии мата.',
        group: 'Чат',
        subgroup: 'Поле ввода',
        selector: '#fpToolsProfanityWarning',
        preview: { kind: 'html', html: '<div class="fpt-pv-profanity">Обнаружена грубость! Хотите это исправить с помощью AI? Нажмите сюда, чтобы включить AI-режим.</div>' }
    },

    // ───────────── Чат: шапка диалога ─────────────
    {
        id: 'chat_read_all_btn',
        label: 'Кнопка «Прочитать все»',
        desc: 'Круглая кнопка-иконка (галочки) в шапке открытого диалога - помечает все непрочитанные чаты как прочитанные.',
        group: 'Чат',
        subgroup: 'Шапка диалога',
        selector: '#fp-tools-read-all-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-readall" title="Прочитать все"><span class="material-icons">done_all</span></div>' }
    },
    {
        id: 'chat_filter_marked_btn',
        label: 'Переключатель «Только помеченные»',
        desc: 'Тумблер-ползунок в шапке открытого диалога (иконка-ярлык) - оставляет в списке только помеченные чаты. Зелёный во включённом состоянии.',
        group: 'Чат',
        subgroup: 'Шапка диалога',
        selector: '#fp-tools-filter-marked-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-toggle"><span class="fpt-pv-toggle-track"><span class="material-icons">label</span></span></div>' }
    },

    // ───────────── Чат: выпадающее меню «⋮» ─────────────
    {
        id: 'chat_menu_buyer_history',
        label: 'Пункт меню «История покупок»',
        desc: 'Пункт в выпадающем меню диалога (⋮) - открывает историю заказов этого покупателя.',
        group: 'Чат',
        subgroup: 'Действия в диалоге',
        selector: '#fp-buyer-hist-menu-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a>📦 История покупок</a></div>' }
    },
    {
        id: 'chat_menu_translate',
        label: 'Пункт меню «Включить перевод»',
        desc: 'Пункт в выпадающем меню диалога (⋮) - включает перевод сообщений в реальном времени.',
        group: 'Чат',
        subgroup: 'Действия в диалоге',
        selector: '#fp-translate-menu-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a>🌐 Включить перевод</a></div>' }
    },
    {
        id: 'chat_menu_export',
        label: 'Пункт меню «Экспортировать чат»',
        desc: 'Пункт в выпадающем меню диалога (⋮) - выгружает переписку в текстовый файл.',
        group: 'Чат',
        subgroup: 'Действия в диалоге',
        selector: '#fp-export-chat-menu-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a>💾 Экспортировать чат</a></div>' }
    },
    {
        id: 'chat_menu_blacklist',
        label: 'Пункт меню «Добавить в ЧС»',
        desc: 'Красный пункт в выпадающем меню диалога (⋮) - добавляет собеседника в чёрный список.',
        group: 'Чат',
        subgroup: 'Действия в диалоге',
        selector: '#fp-blacklist-menu-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a class="fpt-pv-menu-danger">🚫 Добавить в ЧС</a></div>' }
    },

    // ───────────── Редактор лота ─────────────
    {
        id: 'chat_image_generator_btn',
        label: 'Кнопка «Сгенерировать» картинку лота',
        desc: 'Серая кнопка «Сгенерировать» возле поля картинок на странице добавления/редактирования лота - открывает генератор изображения-превью для лота.',
        group: 'Создание и оформление лота',
        selector: '#fpToolsGenerateImageBtn, .generate-btn-container',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Сгенерировать</div>' }
    },
    {
        id: 'lot_ai_gen_btn',
        label: 'Кнопка «ИИ-генерация» лота',
        desc: 'Кнопка с иконкой-блёстками «ИИ-генерация» рядом с заголовком страницы редактирования лота - открывает ИИ-генератор описания лота.',
        group: 'Создание и оформление лота',
        selector: '#fp-tools-ai-gen-btn-wrapper',
        preview: { kind: 'html', html: '<div class="fpt-pv-aigen"><svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="m176-120-56-56 301-302-181-45 198-123-17-234 179 151 216-88-87 217 151 178-234-16-124 198-45-181-301 301Zm24-520-80-80 80-80 80 80-80 80Zm520 743-80-80 80-80 80 80-80 80Z"/></svg><span>ИИ-генерация</span></div>' }
    },
    {
        id: 'lot_font_controls',
        label: 'Блок шрифта и спецсимволов',
        desc: 'Блок «Шрифт» с выпадающим списком стилизованных шрифтов и кнопкой «Клавиатура» на странице редактирования лота.',
        legacyLabels: ['Шрифты и спецсимволы в лоте'],
        group: 'Создание и оформление лота',
        selector: '.fp-tools-font-controls, .fp-tools-symbols-panel',
        preview: { kind: 'html', html: '<div class="fpt-pv-fontblock"><label>Шрифт</label><select class="fpt-pv-fpselect"><option>Стандартный</option></select><span class="fpt-pv-fpbtn"><i class="fa fa-keyboard-o"></i> Клавиатура</span></div>' }
    },
    {
        id: 'lot_keyboard_btn',
        label: 'Кнопка „Клавиатура“',
        desc: 'Отдельная кнопка «Клавиатура» (иконка клавиатуры) в блоке шрифтов редактора лота - открывает панель спецсимволов.',
        legacyLabels: ['Кнопка «Клавиатура» спецсимволов'],
        group: 'Создание и оформление лота',
        selector: '#fpToolsKeyboardToggleBtn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn"><i class="fa fa-keyboard-o"></i> Клавиатура</div>' }
    },
    {
        id: 'lot_translate_btn',
        label: 'Кнопка «Перевод» в лоте',
        desc: 'Кнопка «Перевод» рядом с вкладкой английского языка в мультиязычном редакторе лота - переводит текст лота через ИИ.',
        group: 'Создание и оформление лота',
        selector: '#fp-tools-translate-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-translatebtn">Перевод</div>' }
    },
    {
        id: 'lot_exact_price_btn',
        label: 'Точный расчёт цены',
        desc: 'Серая ссылка с пунктирным подчёркиванием «Рассчитать, чтобы получить эту сумму» под полем цены - считает цену так, чтобы получить нужную сумму на руки.',
        group: 'Цены и аналитика',
        selector: '.set-exact-price',
        preview: { kind: 'html', html: '<div class="fpt-pv-exactprice">Рассчитать, чтобы получить эту сумму</div>' }
    },
    {
        id: 'lot_paste_bar',
        label: 'Панель «Вставить данные лота»',
        desc: 'Полоса под заголовком редактора лота: «Найдены скопированные данные лота. Вставить их в форму?» с кнопками «Вставить» и «×». Появляется после копирования лота.',
        group: 'Копирование и импорт лотов',
        selector: '#fp-tools-paste-bar',
        preview: { kind: 'html', html: '<div class="fpt-pv-pastebar"><span>📋</span><span class="fpt-pv-pastebar-text">Найдены скопированные данные лота. Вставить их в форму?</span><span class="fpt-pv-fpbtn fpt-pv-fpbtn-primary">Вставить</span></div>' }
    },
    {
        id: 'lot_clone_btn',
        label: 'Кнопка «Копировать» (свой лот)',
        desc: 'Серая кнопка «Копировать» вверху страницы редактирования вашего лота - клонирует лот (полностью или со сменой категории).',
        group: 'Копирование и импорт лотов',
        selector: '.fp-tools-clone-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Копировать</div>' }
    },
    {
        id: 'lot_import_btn',
        label: 'Кнопка «Импорт» (свой лот)',
        desc: 'Серая кнопка «Импорт» вверху страницы редактирования вашего лота - импортирует данные лота из файла/другого лота.',
        group: 'Копирование и импорт лотов',
        selector: '.fp-tools-import-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Импорт</div>' }
    },
    {
        id: 'lot_category_peek',
        label: 'Кнопка «Свежее в категории»',
        desc: 'Серая кнопка «Свежее в категории» вверху страницы создания/редактирования лота - открывает боковую панель с 10 свежими лотами из той же категории (видно 4, остальное скроллом) и сообщениями из чата категории (если он есть).',
        group: 'Цены и аналитика',
        selector: '#fpt-peek-toggle, .fpt-peek-panel',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Свежее в категории</div>' }
    },

    // ───────────── Чужие лоты ─────────────
    {
        id: 'lot_public_clone_btn',
        label: 'Кнопка «Копировать лот» (чужой лот)',
        desc: 'Серая кнопка «Копировать лот» рядом с кнопкой «Купить» на публичной странице чужого лота. Открывает мастер серверного копирования: читает лот, подбирает параметры категории на вашем аккаунте, даёт отредактировать тексты/цену и заменить текст, после чего создаёт лот на сервере одним нажатием.',
        group: 'Копирование и импорт лотов',
        selector: '#fp-tools-public-clone-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-buyrow"><span class="fpt-pv-fpbtn">Копировать лот</span><span class="fpt-pv-buybtn">Купить</span></div>' }
    },
    {
        id: 'multi_clone_foreign',
        label: 'Копирование лотов на чужом профиле',
        desc: 'На странице чужого профиля появляется кнопка «Выбрать» (как на своём): отмечаешь несколько лотов галочками и жмёшь «Копировать» — массовое серверное клонирование выбранных лотов к себе.',
        group: 'Копирование и импорт лотов',
        selector: '.actions .clone-lots',
        preview: { kind: 'html', html: '<div class="fpt-pv-buyrow"><span class="fpt-pv-fpbtn" style="background:#7c5cff;color:#fff;">Копировать</span></div>' }
    },

    // ───────────── Свои лоты ─────────────
    {
        id: 'lot_delete_btn',
        label: 'Красная кнопка удаления лота',
        desc: 'На странице своего лота кнопка «Редактировать предложение» становится компактной, а рядом появляется маленькая красная кнопка с мусоркой для быстрого удаления лота.',
        group: 'Список лотов и профиль',
        selector: '.fpt-lot-del-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-buyrow"><span class="fpt-pv-fpbtn">Редактировать</span><span class="fpt-pv-buybtn" style="background:#ef4444;">🗑</span></div>' }
    },


    // ───────────── Список лотов / профиль ─────────────
    {
        id: 'lot_search_bar',
        label: 'Строка поиска по лотам',
        desc: 'Белое поле «Поиск по лотам…» над списком ваших лотов на странице предложений - фильтрует лоты без перезагрузки.',
        group: 'Список лотов и профиль',
        selector: '#fp-lot-search-bar',
        preview: { kind: 'html', html: '<div class="fpt-pv-lotsearch"><input type="text" class="fpt-pv-fpinput" placeholder="Поиск по лотам…" readonly></div>' }
    },
    {
        id: 'lot_select_btn',
        label: 'Кнопка «Выбрать» лоты',
        desc: 'Кнопка «Выбрать» возле списка лотов - включает режим выделения нескольких лотов (для массовых действий).',
        group: 'Список лотов и профиль',
        selector: '#fp-tools-select-lots-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Выбрать</div>' }
    },
    {
        id: 'lot_reactivate_btn',
        label: 'Кнопка «Включить лоты»',
        desc: 'Кнопка «Включить лоты» возле списка лотов - массово активирует выбранные/деактивированные лоты.',
        group: 'Список лотов и профиль',
        selector: '#fp-tools-reactivate-lots-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Включить лоты</div>' }
    },
    {
        id: 'open_lot_buttons',
        label: 'Кнопки «Открыть лот»',
        desc: 'Кнопка перехода на лот: иконка-ссылка возле каждого лота и рядом с заголовком на странице редактирования, которая открывает (перейти, переход, ссылка на) сам лот, а не его редактирование.',
        group: 'Список лотов и профиль',
        selector: '.fpt-open-lot',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn" style="width:28px;text-align:center;">↗</div>' }
    },
    {
        id: 'raise_all_lots_btn',
        label: 'Кнопка «Поднять все лоты»',
        desc: 'Кнопка на своём профиле рядом с «Выбрать» - поднимает все лоты во всех разделах по очереди.',
        group: 'Список лотов и профиль',
        selector: '#fpt-raise-all-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Поднять все лоты</div>' }
    },
    {
        id: 'buyer_price_field',
        label: 'Поле «Цена покупателю»',
        desc: 'Живое поле на странице создания/редактирования лота: показывает цену для покупателя и может пересчитать цену продавца обратно.',
        group: 'Цены и аналитика',
        selector: '#fpt-buyer-price-group',
        preview: { kind: 'html', html: '<div class="fpt-pv-lotsearch"><input type="text" class="fpt-pv-fpinput" placeholder="Цена покупателю" readonly></div>' }
    },
    {
        id: 'cost_basis_field',
        label: 'Поле «Себестоимость»',
        desc: 'Поле себестоимости и предпросмотр чистой прибыли на странице редактирования своего лота. Данные сохраняются строго локально и не отправляются на FunPay.',
        group: 'Цены и аналитика',
        selector: '#fpt-cost-basis-group',
        preview: { kind: 'html', html: '<div class="fpt-pv-lotsearch"><input type="text" class="fpt-pv-fpinput" placeholder="Себестоимость" readonly></div>' }
    },
    {
        id: 'lot_pinned_container',
        label: 'Блок «Закрепленные лоты»',
        desc: 'Дополнительный блок «Закрепленные лоты» на странице профиля/продаж (с кнопкой ✏️ для выбора закреплённых).',
        group: 'Список лотов и профиль',
        selector: '#fp-tools-pinned-lots-container',
        preview: { kind: 'html', html: '<div class="fpt-pv-pinned"><span class="fpt-pv-pinned-title">Закрепленные лоты</span><span class="fpt-pv-fpbtn fpt-pv-fpbtn-xs">✏️</span></div>' }
    },
    {
        id: 'market_analytics_btn',
        label: 'Кнопка «Аналитика рынка»',
        desc: 'Серая кнопка «Аналитика рынка» на странице категории - открывает аналитику цен и продавцов.',
        group: 'Цены и аналитика',
        selector: '#fpTools-market-analytics-btn-wrapper',
        preview: { kind: 'html', html: '<div class="fpt-pv-fpbtn">Аналитика рынка</div>' }
    },
    {
        id: 'sales_stats_expand',
        label: 'Кнопка «Показать ещё» в статистике',
        desc: 'Строка «Показать ещё ▾» в блоке статистики FunPay Funcy на странице продаж - разворачивает дополнительную статистику.',
        group: 'Цены и аналитика',
        selector: '#fpTools-stats-extra, #fpTools-stats-expand-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-expandrow"><span>Показать ещё</span><span>▾</span></div>' }
    },

    // ───────────── Меню профиля ─────────────
    {
        id: 'notes_add_status_btn',
        label: 'Пункт «Добавить новую метку»',
        desc: 'Пункт «+ Добавить новую метку» в меню статусов и меток собеседника.',
        group: 'Список лотов и профиль',
        selector: '#fp-tools-add-status-btn',
        preview: { kind: 'html', html: '<div class="fpt-pv-menu"><a>+ Добавить новую метку</a></div>' }
    }
];

// expose globally for non-module content scripts
if (typeof window !== 'undefined') {
    window.FPT_FEATURE_REGISTRY = FPT_FEATURE_REGISTRY;
}
