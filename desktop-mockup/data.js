// Фейковые данные макета. Ничего не уходит в сеть.
window.DATA = {
    accounts: [
        { id: 'a1', name: 'nakazan', initials: 'NK', balance: 12480, available: 9320, pending: 3160, pendingOrders: 4, unread: 3, current: true, automation: true, note: 'Основной магазин' },
        { id: 'a2', name: 'nk_keys', initials: 'NK', balance: 3105, available: 3105, pending: 0, pendingOrders: 0, unread: 0, current: false, automation: false, note: 'Ключи Steam' },
        { id: 'a3', name: 'nk_reserve', initials: 'NR', balance: 0, available: 0, pending: 0, pendingOrders: 0, unread: 1, current: false, automation: false, expired: true, note: '' }
    ],

    categories: [
        { id: 'c1', name: 'Steam · Ключи', game: 'Steam', commission: 8.5 },
        { id: 'c2', name: 'Genshin Impact · Аккаунты', game: 'Genshin Impact', commission: 6 },
        { id: 'c3', name: 'Brawl Stars · Гемы', game: 'Brawl Stars', commission: 5 },
        { id: 'c4', name: 'Discord · Nitro', game: 'Discord', commission: 7 },
        { id: 'c5', name: 'Telegram · Stars', game: 'Telegram', commission: 4.5 },
        { id: 'c6', name: 'CS2 · Прайм', game: 'CS2', commission: 8 },
        { id: 'c7', name: 'Roblox · Robux', game: 'Roblox', commission: 6.5, currency: true }
    ],

    lots: [
        { id: 4810231, title: 'Cyberpunk 2077 — ключ Steam (RU/CIS)', cat: 'c1', price: 1290, cost: 890, stock: 14, auto: true, active: true, pinned: true, schedule: 'Вечерние продажи' },
        { id: 4810232, title: 'Elden Ring — ключ Steam, моментально', cat: 'c1', price: 2190, cost: 1650, stock: 6, auto: true, active: true, pinned: true },
        { id: 4810240, title: 'Baldur\'s Gate 3 — ключ Steam', cat: 'c1', price: 2490, cost: 1990, stock: 0, auto: true, active: false },
        { id: 4810251, title: 'AR 58 · 5★ Райден + Нахида · Европа', cat: 'c2', price: 3400, cost: null, stock: 1, auto: false, active: true },
        { id: 4810252, title: 'AR 45 · стартовый аккаунт с 12 гарантами', cat: 'c2', price: 690, cost: 300, stock: 3, auto: true, active: true },
        { id: 4810260, title: '170 гемов Brawl Stars · по ID', cat: 'c3', price: 179, cost: 140, stock: 99, auto: false, active: true },
        { id: 4810261, title: '2000 гемов Brawl Stars · по ID, 5 минут', cat: 'c3', price: 1690, cost: 1410, stock: 99, auto: false, active: true },
        { id: 4810270, title: 'Discord Nitro Full · 1 месяц, на ваш аккаунт', cat: 'c4', price: 449, cost: 310, stock: 22, auto: true, active: true, schedule: 'Круглосуточно' },
        { id: 4810271, title: 'Discord Nitro Basic · 1 год', cat: 'c4', price: 1990, cost: null, stock: 4, auto: true, active: true },
        { id: 4810280, title: '100 Telegram Stars · подарком', cat: 'c5', price: 179, cost: 150, stock: 50, auto: false, active: true },
        { id: 4810290, title: 'CS2 Prime Status · аккаунт с почтой', cat: 'c6', price: 1350, cost: 1020, stock: 2, auto: true, active: true },
        { id: 4810300, title: '1000 Robux · через геймпасс', cat: 'c7', price: 899, cost: 760, stock: 0, auto: false, active: false }
    ],

    labels: [
        { id: 'l1', name: 'Постоянный', color: '#1baf7a' },
        { id: 'l2', name: 'Мошенник', color: '#e5484d' },
        { id: 'l3', name: 'Опт', color: '#2a78d6' }
    ],

    chats: [
        { id: 'ch1', name: 'kirill_dev', initials: 'KD', online: true, time: '14:32', unread: 2, labels: ['l1'], pinned: true, order: 'paid', last: 'Здравствуйте, ключ пришёл, спасибо! А есть Elden Ring?',
          messages: [
            { from: 'sys', text: 'Покупатель kirill_dev оплатил заказ #KX8F2Q1M: Cyberpunk 2077 — ключ Steam (RU/CIS), 1 шт., 1 290 ₽.', time: '14:20' },
            { from: 'bot', text: 'Здравствуйте, kirill_dev! Спасибо за покупку 🙌\nВаш ключ: XXXXX-XXXXX-XXXXX\nАктивация: Steam → Игры → Активировать в Steam.', time: '14:20', tag: 'Автовыдача' },
            { from: 'them', text: 'Здравствуйте, ключ пришёл, спасибо!', time: '14:31' },
            { from: 'them', text: 'А есть Elden Ring? Хочу взять ещё другу', time: '14:32', translated: null }
          ] },
        { id: 'ch2', name: 'Shadow_Wolf', initials: 'SW', online: true, time: '14:05', unread: 1, labels: [], order: 'paid', last: 'Когда будут гемы? Жду уже 10 минут',
          messages: [
            { from: 'sys', text: 'Покупатель Shadow_Wolf оплатил заказ #P2LM7Z0A: 2000 гемов Brawl Stars, 1 шт., 1 690 ₽.', time: '13:55' },
            { from: 'bot', text: 'Привет! Заказ принят ✅ Пришлите, пожалуйста, ваш игровой ID.', time: '13:55', tag: 'Ответ на заказ' },
            { from: 'them', text: '#2QLV8YJ0', time: '13:57' },
            { from: 'them', text: 'Когда будут гемы? Жду уже 10 минут', time: '14:05' }
          ] },
        { id: 'ch3', name: 'mila.games', initials: 'MG', online: false, time: '12:41', unread: 0, labels: ['l3'], order: 'confirmed', last: 'Вы: Спасибо за отзыв! Держите промокод -10% 🎁',
          messages: [
            { from: 'them', text: 'Hello! Do you have Nitro for 3 months?', time: '12:30', translated: 'Привет! У вас есть Nitro на 3 месяца?' },
            { from: 'me', text: 'Добрый день! Есть на 1 месяц и на год, на 3 месяца могу сделать тремя заказами по 1 месяцу.', time: '12:32' },
            { from: 'album', time: '12:33' },
            { from: 'sys', text: 'Покупатель mila.games подтвердил выполнение заказа #NM3K1Q8R и оставил отзыв ★★★★★', time: '12:40' },
            { from: 'bot', text: 'Спасибо за отзыв! Держите промокод -10% 🎁', time: '12:41', tag: 'Бонус за 5★' }
          ] },
        { id: 'ch4', name: 'denis_777', initials: 'D7', online: false, time: 'Вчера', unread: 0, labels: ['l2'], order: 'refund', last: 'Верните деньги, ключ не работает',
          messages: [
            { from: 'them', text: 'Верните деньги, ключ не работает', time: 'Вчера 22:10' },
            { from: 'me', text: 'Пришлите, пожалуйста, скриншот ошибки активации.', time: 'Вчера 22:14' },
            { from: 'sys', text: 'Продавец вернул деньги покупателю denis_777 по заказу #RT5U0P2C.', time: 'Вчера 23:02' }
          ] },
        { id: 'ch5', name: 'arina_shop', initials: 'AS', online: true, time: 'Вчера', unread: 0, labels: [], order: null, last: 'Ок, тогда завтра напишу',
          messages: [
            { from: 'them', text: 'Будут ещё аккаунты AR 58?', time: 'Вчера 18:40' },
            { from: 'me', text: 'Ожидаю поставку завтра к вечеру.', time: 'Вчера 18:45' },
            { from: 'them', text: 'Ок, тогда завтра напишу', time: 'Вчера 18:46' }
          ] },
        { id: 'ch6', name: 'FunPay Поддержка', initials: 'FP', online: false, time: 'Пн', unread: 0, labels: [], order: null, last: 'Ваша заявка #482113 закрыта',
          messages: [{ from: 'sys', text: 'Ваша заявка #482113 закрыта.', time: 'Пн 11:20' }] }
    ],

    orders: [
        { id: 'P2LM7Z0A', buyer: 'Shadow_Wolf', lot: '2000 гемов Brawl Stars · по ID, 5 минут', amount: 1690, qty: 1, status: 'paid', state: 'decide', reason: 'Ручная выдача: покупатель ждёт 10 мин', time: '13:55', timer: '23:51:12' },
        { id: 'H7QW0L2B', buyer: 'night_owl', lot: 'Discord Nitro Full · 1 месяц', amount: 449, qty: 1, status: 'paid', state: 'decide', reason: 'Часть 2 из 2: результат отправки неясен', time: '11:02', timer: '21:10:44' },
        { id: 'KX8F2Q1M', buyer: 'kirill_dev', lot: 'Cyberpunk 2077 — ключ Steam (RU/CIS)', amount: 1290, qty: 1, status: 'paid', state: 'delivery', reason: 'Выдано автоматически', time: '14:20', timer: '23:58:01' },
        { id: 'Z1C9VB7E', buyer: 'gamer_pro', lot: 'Elden Ring — ключ Steam', amount: 4380, qty: 2, status: 'paid', state: 'delivery', reason: 'Выдано 2 из 2', time: '10:44', timer: '20:52:30' },
        { id: 'NM3K1Q8R', buyer: 'mila.games', lot: 'Discord Nitro Full · 1 месяц', amount: 449, qty: 1, status: 'closed', state: 'done', reason: 'Подтверждён покупателем', time: '12:40' },
        { id: 'QW8E7R6T', buyer: 'stepan', lot: '170 гемов Brawl Stars', amount: 179, qty: 1, status: 'closed', state: 'done', reason: 'Подтверждён, отзыва нет', time: 'Вчера' },
        { id: 'RT5U0P2C', buyer: 'denis_777', lot: 'Baldur\'s Gate 3 — ключ Steam', amount: 2490, qty: 1, status: 'refund', state: 'done', reason: 'Возврат продавцом', time: 'Вчера' }
    ],

    templates: [
        { id: 't1', name: 'Приветствие', text: 'Здравствуйте, {buyername}! Чем могу помочь?', visible: true },
        { id: 't2', name: 'Заказ выполнен', text: 'Заказ выполнен ✅ Подтвердите, пожалуйста, получение: {orderlink}', visible: true },
        { id: 't3', name: 'Попросить отзыв', text: 'Буду благодарен за отзыв ⭐ Это очень помогает магазину!', visible: true },
        { id: 't4', name: 'Спасибо за заказ', text: 'Спасибо за заказ, {buyername}! Заходите ещё 🙌', visible: false }
    ],
    commands: [
        { trigger: '/привет', text: '{welcome}, {buyername}! Чем помочь?' },
        { trigger: '/id', text: 'Пришлите, пожалуйста, ваш игровой ID — выдам в течение 5 минут.' },
        { trigger: '/скоро', text: 'Уже выдаю, буквально {2|3|5} минут 🙏' },
        { trigger: '/баланс', text: 'Баланс: {bal}, активных продаж: {activesells}' }
    ],
    keywordRules: [
        { kw: 'есть в наличии', match: 'Содержит', reply: 'Да, всё в наличии — оформляйте заказ, выдача моментальная ⚡', images: 0 },
        { kw: 'как активировать', match: 'Содержит', reply: 'Инструкция по активации на картинке 👇', images: 1 },
        { kw: 'скидка', match: 'Содержит', reply: 'При заказе от 3 штук — скидка 5%, напишите, сделаю отдельный лот.', images: 0 }
    ],
    blacklist: [
        { user: 'denis_777', reason: 'Возврат после активации ключа', noAuto: true, noReply: true },
        { user: 'scam_buyer01', reason: 'Чарджбек', noAuto: true, noReply: false }
    ],

    plugins: [
        { id: 'chat-guard', name: 'Сторож чатов без ответа', version: '1.2.0', author: '@nakazan163', uuid: '6f1c2a90-7b44-4e8b-9d2a-1c0e5f3a7b11', icon: 'mark_chat_unread', color: '#7663f6', enabled: true,
          desc: 'Список покупателей, которые ждут ответа. Порог ожидания, повторный сигнал, сброс при ручном ответе.', hooks: ['NEW_MESSAGE', 'LAST_CHAT_MESSAGE_CHANGED', 'POST_START'], runs: 312, errors: 0, perms: ['Чтение чатов', 'Уведомления'] },
        { id: 'competitor-watch', name: 'Наблюдение за конкурентами', version: '0.9.4', author: '@nakazan163', uuid: '0aa92c1d-3f6e-4b2a-8c55-9e1b7d2c4f08', icon: 'monitoring', color: '#2a78d6', enabled: true,
          desc: 'История цен и позиций ваших лотов и конкурентов в выбранных категориях. Только наблюдение — ничего не меняет.', hooks: ['POST_START', 'TIMER 10 мин'], runs: 96, errors: 1, perms: ['Чтение категорий'] },
        { id: 'night-mode', name: 'Ночной автоответ', version: '1.0.1', author: 'community/ilya', uuid: 'b3d0e7f2-91c4-4d0a-a1e8-5f2c9b8d6a43', icon: 'bedtime', color: '#1baf7a', enabled: false,
          desc: 'С 01:00 до 09:00 отвечает покупателям, что вы спите, и подсказывает, когда будете онлайн.', hooks: ['NEW_MESSAGE'], runs: 0, errors: 0, perms: ['Отправка сообщений'] },
        { id: 'balance-guard', name: 'Алерты баланса', version: '1.1.0', author: '@nakazan163', uuid: 'e8c47b21-0d5f-4a93-b6e2-7c1a9f0d3e55', icon: 'account_balance_wallet', color: '#eda100', enabled: true,
          desc: 'Уведомляет, когда баланс выше порога для вывода или ниже минимума. Отдельно по каждой валюте.', hooks: ['ORDER_STATUS_CHANGED', 'POST_START'], runs: 41, errors: 0, perms: ['Чтение баланса', 'Уведомления'] },
        { id: 'stock-doctor', name: 'Контроль остатков', version: '0.4.0', author: 'community/vlad', uuid: '4c2f9a7e-6b18-4d3c-8e05-a7b1c9d2e6f0', icon: 'inventory_2', color: '#e5484d', enabled: true, error: 'TypeError: lot.secrets is undefined (stock_doctor.js:88)',
          desc: 'Предупреждает о низком остатке товаров автовыдачи, находит дубли и пустые строки.', hooks: ['POST_DELIVERY', 'NEW_ORDER'], runs: 58, errors: 3, perms: ['Чтение лотов', 'Уведомления'] }
    ],

    catalog: [
        { id: 'chat-guard', name: 'Сторож чатов без ответа', cat: 'Чаты', icon: 'mark_chat_unread', color: '#7663f6', author: '@nakazan163', installs: '2,4 тыс.', rating: 4.9, desc: 'Кто ждёт вашего ответа и сколько. Порог, повторный сигнал, сброс при ручном ответе.', installed: true, official: true },
        { id: 'competitor-watch', name: 'Наблюдение за конкурентами', cat: 'Лоты', icon: 'monitoring', color: '#2a78d6', author: '@nakazan163', installs: '1,8 тыс.', rating: 4.7, desc: 'История цен и позиций, сторож пропавших лотов.', installed: true, official: true },
        { id: 'price-dumper', name: 'Автоцена ниже конкурента', cat: 'Лоты', icon: 'trending_down', color: '#d95926', author: 'community/max', installs: '940', rating: 4.3, desc: 'Держит цену на N ₽ ниже лучшего предложения. Минимальная цена, белый список, «не повышать».' },
        { id: 'stock-doctor', name: 'Контроль остатков', cat: 'Склад', icon: 'inventory_2', color: '#e5484d', author: 'community/vlad', installs: '1,1 тыс.', rating: 4.5, desc: 'Низкий остаток, дубли и пустые строки в товарах автовыдачи.', installed: true },
        { id: 'shared-pool', name: 'Общий склад для лотов', cat: 'Склад', icon: 'hub', color: '#1baf7a', author: '@nakazan163', installs: '620', rating: 4.6, desc: 'Один пул товаров на несколько лотов: резерв, выдача, замены, возвраты, история.', official: true },
        { id: 'balance-guard', name: 'Алерты баланса', cat: 'Финансы', icon: 'account_balance_wallet', color: '#eda100', author: '@nakazan163', installs: '1,3 тыс.', rating: 4.8, desc: 'Пороги по валютам: пора выводить / баланс ниже минимума.', installed: true, official: true },
        { id: 'daily-digest', name: 'Утренняя сводка', cat: 'Финансы', icon: 'wb_sunny', color: '#e87ba4', author: '@nakazan163', installs: '2,0 тыс.', rating: 4.8, desc: 'Одна сводка за ночь: продажи, ожидание, новые отзывы, проблемные заказы.', official: true },
        { id: 'sales-funnel', name: 'Конверсия чат → покупка', cat: 'Аналитика', icon: 'filter_alt', color: '#7663f6', author: 'community/oleg', installs: '410', rating: 4.2, desc: 'Сколько диалогов заканчиваются покупкой — по лотам и по дням.' },
        { id: 'regulars', name: 'Постоянные покупатели', cat: 'Аналитика', icon: 'loyalty', color: '#1baf7a', author: 'community/oleg', installs: '530', rating: 4.4, desc: 'Находит повторных покупателей, ставит метку и предлагает бонус.' },
        { id: 'night-mode', name: 'Ночной автоответ', cat: 'Чаты', icon: 'bedtime', color: '#1baf7a', author: 'community/ilya', installs: '1,6 тыс.', rating: 4.6, desc: 'Ответ в нерабочие часы с указанием, когда вы будете онлайн.', installed: true },
        { id: 'confirm-reminder', name: 'Напомнить подтвердить заказ', cat: 'Заказы', icon: 'task_alt', color: '#2a78d6', author: '@nakazan163', installs: '880', rating: 4.5, desc: 'Через N часов после выдачи вежливо просит подтвердить заказ. Отдельно от просьбы об отзыве.', official: true },
        { id: 'ai-consultant', name: 'AI-консультант (свой ключ)', cat: 'Чаты', icon: 'smart_toy', color: '#8473f2', author: 'community/neo', installs: '1,2 тыс.', rating: 4.1, desc: 'Отвечает на вопросы о лотах по вашему описанию. Ключ API — ваш, хранится локально, бюджет в месяц.' },
        { id: 'steam-guard', name: 'Коды Steam Guard', cat: 'Заказы', icon: 'shield_lock', color: '#3987e5', author: 'community/kostya', installs: '760', rating: 4.4, desc: 'Генерация кодов для аренды аккаунтов с ограничением срока доступа по заказу.' },
        { id: 'webhooks', name: 'Вебхук-уведомления', cat: 'Интеграции', icon: 'webhook', color: '#98a0ad', author: 'community/dima', installs: '350', rating: 4.0, desc: 'Отправляет события (заказ, сообщение, отзыв) на ваш URL: Discord, Slack, свой сервер.' }
    ],

    pluginLog: [
        { time: '14:32:07', event: 'NEW_MESSAGE', plugin: 'Сторож чатов без ответа', result: 'ok', ms: 4, detail: 'kirill_dev → ожидание ответа 0:00, порог 5 мин' },
        { time: '14:20:15', event: 'POST_DELIVERY', plugin: 'Контроль остатков', result: 'error', ms: 12, detail: 'TypeError: lot.secrets is undefined\n    at checkStock (stock_doctor.js:88:21)\n    at onPostDelivery (stock_doctor.js:41:5)' },
        { time: '14:20:14', event: 'NEW_ORDER', plugin: 'Контроль остатков', result: 'ok', ms: 6, detail: 'Лот 4810231: остаток 14 → 13' },
        { time: '14:20:14', event: 'NEW_ORDER', plugin: 'Алерты баланса', result: 'skip', ms: 1, detail: 'Порог 15 000 ₽ не достигнут' },
        { time: '14:10:00', event: 'TIMER', plugin: 'Наблюдение за конкурентами', result: 'ok', ms: 1840, detail: 'Steam · Ключи: 3 конкурента дешевле на Cyberpunk 2077' },
        { time: '14:05:41', event: 'NEW_MESSAGE', plugin: 'Сторож чатов без ответа', result: 'ok', ms: 3, detail: 'Shadow_Wolf ждёт ответа 10 мин → уведомление' },
        { time: '13:55:02', event: 'NEW_ORDER', plugin: 'Контроль остатков', result: 'warn', ms: 5, detail: '2000 гемов Brawl Stars: автовыдача выключена, остаток не проверен' },
        { time: '13:50:00', event: 'TIMER', plugin: 'Наблюдение за конкурентами', result: 'error', ms: 30000, detail: 'Таймаут запроса /lots/1000/ (30 с). Повтор через 10 мин.' },
        { time: '12:40:11', event: 'ORDER_STATUS_CHANGED', plugin: 'Алерты баланса', result: 'ok', ms: 2, detail: 'Заказ NM3K1Q8R закрыт, баланс 12 480 ₽' },
        { time: '09:00:00', event: 'POST_START', plugin: 'Сторож чатов без ответа', result: 'ok', ms: 22, detail: 'Загружено 6 чатов, 0 ожидают' }
    ],

    feed: [
        { icon: 'shopping_bag', tone: 'accent', t: 'Новый заказ #KX8F2Q1M', d: 'kirill_dev · Cyberpunk 2077 · 1 290 ₽ · выдано автоматически', time: '14:20' },
        { icon: 'warning', tone: 'warning', t: 'Нужно решение по заказу #P2LM7Z0A', d: 'Shadow_Wolf · 2000 гемов · ручная выдача', time: '13:55' },
        { icon: 'star', tone: 'success', t: 'Отзыв ★★★★★ от mila.games', d: 'Отправлен ответ и бонус за 5★', time: '12:41' },
        { icon: 'arrow_upward', tone: 'accent', t: 'Лоты подняты: 5 категорий', d: 'Следующее поднятие через 3 ч 12 мин', time: '12:00' },
        { icon: 'extension', tone: 'danger', t: 'Плагин «Контроль остатков» упал', d: 'TypeError: lot.secrets is undefined', time: '14:20' },
        { icon: 'undo', tone: 'danger', t: 'Возврат по заказу #RT5U0P2C', d: 'denis_777 · Baldur\'s Gate 3 · 2 490 ₽', time: 'Вчера' }
    ],

    bumpLog: [
        { time: '12:00:04', text: 'Steam · Ключи — поднято', ok: true },
        { time: '12:00:03', text: 'Discord · Nitro — поднято', ok: true },
        { time: '12:00:02', text: 'Genshin Impact · Аккаунты — поднято', ok: true },
        { time: '12:00:02', text: 'CS2 · Прайм — поднято', ok: true },
        { time: '12:00:01', text: 'Brawl Stars · Гемы — подождите 1 ч 40 мин (FunPay)', ok: false },
        { time: '08:00:02', text: 'Telegram · Stars — поднято', ok: true }
    ],

    tickets: [
        { id: '482377', subject: 'Подтверждение заказов (12 шт.)', status: 'open', updated: 'Сегодня 13:10', last: 'Поддержка: Заявка принята в работу' },
        { id: '482113', subject: 'Проблема с выводом средств', status: 'closed', updated: 'Пн 11:20', last: 'Заявка закрыта' },
        { id: '480902', subject: 'Вопрос по комиссии раздела', status: 'closed', updated: '28 окт', last: 'Поддержка: Комиссия рассчитывается…' }
    ],

    market: [
        { seller: 'KeyStore', reviews: 12840, online: true, price: 1199, stock: 120, me: false },
        { seller: 'nakazan', reviews: 3120, online: true, price: 1290, stock: 14, me: true },
        { seller: 'SteamPlus', reviews: 8710, online: false, price: 1249, stock: 40, me: false },
        { seller: 'DigiWorld', reviews: 520, online: true, price: 1150, stock: 5, me: false },
        { seller: 'gamekeys_ru', reviews: 2210, online: true, price: 1310, stock: 22, me: false },
        { seller: 'newbie_seller', reviews: 3, online: false, price: 990, stock: 1, me: false }
    ]
};
