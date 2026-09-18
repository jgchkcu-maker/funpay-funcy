(() => {
    'use strict';

    const q = (root, selector) => root?.querySelector(selector) || null;
    const qa = (root, selector) => Array.from(root?.querySelectorAll(selector) || []);
    const h = (tag, cls, html) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    };

    function stashOriginal(page) {
        if (!page || page.querySelector(':scope > .fpf-exact-legacy')) return q(page, ':scope > .fpf-exact-legacy');
        const legacy = h('div', 'fpf-exact-legacy');
        while (page.firstChild) legacy.appendChild(page.firstChild);
        page.appendChild(legacy);
        return legacy;
    }

    function ensurePage(root, id) {
        let page = q(root, `.fp-tools-page-content[data-page="${id}"]`);
        if (page) return page;
        page = h('div', 'fp-tools-page-content');
        page.dataset.page = id;
        page.style.display = 'none';
        q(root, '.fp-tools-content')?.appendChild(page);
        return page;
    }

    function icon(name, tone = '') {
        return `<span class="fpf-x-icon ${tone} material-symbols-rounded">${name}</span>`;
    }

    function spark(points, tone = 'blue') {
        return `<svg class="fpf-spark fpf-tone-${tone}" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    function lineChart() {
        return `<svg class="fpf-line-chart" viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="fpfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#278cf6" stop-opacity=".22"/><stop offset="100%" stop-color="#278cf6" stop-opacity="0"/></linearGradient></defs>
            <g class="grid"><line x1="0" y1="32" x2="640" y2="32"/><line x1="0" y1="76" x2="640" y2="76"/><line x1="0" y1="120" x2="640" y2="120"/><line x1="0" y1="164" x2="640" y2="164"/><line x1="64" y1="0" x2="64" y2="200"/><line x1="160" y1="0" x2="160" y2="200"/><line x1="256" y1="0" x2="256" y2="200"/><line x1="352" y1="0" x2="352" y2="200"/><line x1="448" y1="0" x2="448" y2="200"/><line x1="544" y1="0" x2="544" y2="200"/></g>
            <path d="M0 147 C45 135,75 151,112 139 S180 103,224 111 S286 150,328 123 S394 78,432 93 S505 60,548 82 S612 97,640 75 L640 200 L0 200 Z" fill="url(#fpfArea)"/>
            <path d="M0 147 C45 135,75 151,112 139 S180 103,224 111 S286 150,328 123 S394 78,432 93 S505 60,548 82 S612 97,640 75" class="main"/>
            <g class="dots"><circle cx="0" cy="147" r="5"/><circle cx="112" cy="139" r="5"/><circle cx="224" cy="111" r="5"/><circle cx="328" cy="123" r="5"/><circle cx="432" cy="93" r="6"/><circle cx="548" cy="82" r="5"/></g>
        </svg>`;
    }

    function financeChart() {
        return `<svg class="fpf-finance-chart" viewBox="0 0 670 220" preserveAspectRatio="none" aria-hidden="true">
            <g class="grid"><line x1="0" y1="35" x2="670" y2="35"/><line x1="0" y1="80" x2="670" y2="80"/><line x1="0" y1="125" x2="670" y2="125"/><line x1="0" y1="170" x2="670" y2="170"/><line x1="86" y1="0" x2="86" y2="200"/><line x1="190" y1="0" x2="190" y2="200"/><line x1="294" y1="0" x2="294" y2="200"/><line x1="398" y1="0" x2="398" y2="200"/><line x1="502" y1="0" x2="502" y2="200"/><line x1="606" y1="0" x2="606" y2="200"/></g>
            <path d="M0 107 C46 94,70 106,104 88 S177 98,216 79 S281 51,318 61 S386 70,424 56 S487 60,532 53 S611 63,670 44" class="income"/>
            <path d="M0 170 C55 160,94 168,130 158 S200 165,244 157 S314 166,350 150 S420 154,461 151 S529 154,568 146 S628 151,670 144" class="expense"/>
            <path d="M0 143 C44 129,82 147,120 126 S184 137,224 119 S290 95,334 101 S399 112,444 96 S515 104,550 94 S615 106,670 82" class="profit"/>
        </svg>`;
    }

    function bindCheckbox(visible, source) {
        if (!visible || !source) return;
        visible.checked = !!source.checked;
        visible.addEventListener('change', () => {
            source.checked = visible.checked;
            source.dispatchEvent(new Event('change', { bubbles: true }));
        });
        source.addEventListener('change', () => { visible.checked = !!source.checked; });
    }

    function bindValue(visible, source, eventName = 'input') {
        if (!visible || !source) return;
        visible.value = source.value;
        visible.addEventListener(eventName, () => {
            source.value = visible.value;
            source.dispatchEvent(new Event(eventName, { bubbles: true }));
            if (eventName !== 'change') source.dispatchEvent(new Event('change', { bubbles: true }));
        });
        source.addEventListener(eventName, () => { visible.value = source.value; });
    }

    function navButton(label, iconName, page, primary = false) {
        return `<button class="fpf-action ${primary ? 'primary' : ''}" type="button" data-fpf-page="${page}">${icon(iconName)}<span>${label}</span></button>`;
    }

    function wireNav(page) {
        qa(page, '[data-fpf-page]').forEach(btn => btn.addEventListener('click', () => {
            if (typeof window.openPage === 'function') window.openPage(btn.dataset.fpfPage);
        }));
    }

    function composeDashboard(root) {
        const page = q(root, '.fp-tools-page-content[data-page="dashboard"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');

        const view = h('div', 'fpf-exact-view fpf-exact-dashboard', `
            <section class="fpf-card fpf-status-section">
                <div class="fpf-card-head"><div class="fpf-card-title">${icon('widgets')}<span>Статус модулей</span></div><button class="fpf-text-link" data-fpf-page="general">Все системы →</button></div>
                <div class="fpf-status-grid">
                    <button class="fpf-status-tile" data-fpf-page="autobump">${icon('rocket_launch')}<div><b>Авто-поднятие</b><span class="fpf-ok">● Работает</span><small>Следующий запуск<br><strong>через 12 мин</strong></small></div><span class="material-symbols-rounded fpf-chevron">chevron_right</span></button>
                    <button class="fpf-status-tile" data-fpf-page="auto_delivery">${icon('inventory_2')}<div><b>Авто-выдача</b><span class="fpf-ok">● Работает</span><small>Обработано сегодня<br><strong>48 заказов</strong></small></div><span class="material-symbols-rounded fpf-chevron">chevron_right</span></button>
                    <button class="fpf-status-tile" data-fpf-page="templates">${icon('chat')}<div><b>Чат и клиенты</b><span class="fpf-ok">● Работает</span><small>Новых сообщений<br><strong>7</strong></small></div><span class="material-symbols-rounded fpf-chevron">chevron_right</span></button>
                    <button class="fpf-status-tile" data-fpf-page="finance_overview">${icon('bar_chart')}<div><b>Финансы</b><span class="fpf-ok">● Работает</span><small>Синхронизировано<br><strong>2 мин назад</strong></small></div><span class="material-symbols-rounded fpf-chevron">chevron_right</span></button>
                </div>
            </section>

            <div class="fpf-kpi-grid">
                <article class="fpf-kpi">${icon('shopping_cart','blue')}<div><span>Всего заказов</span><strong>128</strong><small class="up">↑ +12%</small><em>За последние 24 часа</em></div>${spark('0,31 12,25 20,28 29,18 37,23 46,9 54,18 63,5 72,14 80,2 89,12 100,5','blue')}</article>
                <article class="fpf-kpi">${icon('paid','green')}<div><span>Выручка</span><strong>47 320 ₽</strong><small class="up">↑ +18%</small><em>За последние 24 часа</em></div>${spark('0,29 10,22 20,26 30,14 39,21 48,10 56,18 65,4 75,12 84,6 92,14 100,2','green')}</article>
                <article class="fpf-kpi">${icon('group','purple')}<div><span>Новых клиентов</span><strong>32</strong><small class="up">↑ +6%</small><em>За последние 24 часа</em></div>${spark('0,29 12,25 20,18 30,24 40,12 50,19 60,8 70,15 80,4 90,11 100,5','purple')}</article>
                <article class="fpf-kpi">${icon('star','yellow')}<div><span>Рейтинг магазина</span><strong>4.9</strong><small class="up">↑ +0.1</small><em>На основе 342 отзывов</em></div>${spark('0,31 11,24 21,27 31,15 41,23 52,10 61,17 70,7 80,13 90,2 100,9','yellow')}</article>
            </div>

            <section class="fpf-card fpf-quick-section">
                <div class="fpf-card-head"><div class="fpf-card-title">${icon('bolt')}<span>Быстрые действия</span></div></div>
                <div class="fpf-quick-grid">
                    ${navButton('Запустить авто-поднятие','rocket_launch','autobump')}
                    ${navButton('Запустить авто-выдачу','play_circle','auto_delivery')}
                    ${navButton('Открыть чат с клиентами','chat','templates')}
                    ${navButton('Открыть финансы','bar_chart','finance_overview')}
                    ${navButton('Создать товар','add','lot_manage')}
                    ${navButton('Открыть настройки','settings','general')}
                </div>
            </section>

            <div class="fpf-dashboard-lower">
                <section class="fpf-card fpf-sales-card">
                    <div class="fpf-card-head"><div class="fpf-card-title">${icon('bar_chart')}<span>Статистика продаж</span></div><div class="fpf-segment"><button>Сегодня</button><button class="active">7 дней</button><button>30 дней</button><button>Все время</button></div><button class="fpf-select-mini">Выручка⌄</button></div>
                    <div class="fpf-chart-wrap">${lineChart()}<div class="fpf-chart-tip"><span>14 мар</span><b>6 280 ₽</b></div><div class="fpf-axis x"><span>10 мар</span><span>11 мар</span><span>12 мар</span><span>13 мар</span><span>14 мар</span><span>15 мар</span><span>16 мар</span></div><div class="fpf-axis y"><span>8K</span><span>6K</span><span>4K</span><span>2K</span><span>0</span></div></div>
                    <div class="fpf-chart-summary"><div><b class="up">↗ +28%</b><span>Рост выручки<br>за 7 дней</span></div><div>${icon('shopping_cart')}<b>892</b><span>Всего заказов</span></div><div>${icon('paid')}<b>5 260 ₽</b><span>Средний чек</span></div></div>
                    <div class="fpf-products"><div class="fpf-products-head">${icon('star')}<b>Топ товаров</b><button class="fpf-select-mini">За 7 дней⌄</button></div>
                        <div class="fpf-product-row"><span>1</span><span class="fpf-game steam">S</span><b>CS2 Prime | Аккаунт</b><i><u style="width:82%"></u></i><small>64 заказа</small><strong>28 800 ₽</strong></div>
                        <div class="fpf-product-row"><span>2</span><span class="fpf-game val">V</span><b>Valorant Points</b><i><u style="width:56%"></u></i><small>38 заказов</small><strong>11 400 ₽</strong></div>
                        <div class="fpf-product-row"><span>3</span><span class="fpf-game gta">G</span><b>GTA V | Аккаунт</b><i><u style="width:31%"></u></i><small>21 заказ</small><strong>6 930 ₽</strong></div>
                    </div>
                </section>

                <section class="fpf-card fpf-activity-card">
                    <div class="fpf-card-head"><div class="fpf-card-title">${icon('schedule')}<span>Последняя активность</span></div><button class="fpf-text-link">Все события →</button></div>
                    <div class="fpf-activity-list">
                        <div>${icon('inventory_2','green')}<p><b>Новый заказ</b><span>Покупатель: AlexGame</span></p><time>12:24</time></div>
                        <div>${icon('shopping_bag','purple')}<p><b>Выдача товара</b><span>Заказ #FP-784923</span></p><time>12:18</time></div>
                        <div>${icon('chat','purple')}<p><b>Новое сообщение</b><span>Покупатель: DarkSoul</span></p><time>12:11</time></div>
                        <div>${icon('star','yellow')}<p><b>Положительный отзыв</b><span>Покупатель: PlayerOne</span></p><time>11:57</time></div>
                        <div>${icon('rocket_launch','blue')}<p><b>Товар поднят</b><span>CS2 Prime | Аккаунт</span></p><time>11:42</time></div>
                    </div>
                </section>
            </div>
        `);
        page.insertBefore(view, legacy);
        wireNav(page);
    }

    function composeAutomation(root) {
        const page = q(root, '.fp-tools-page-content[data-page="autobump"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const view = h('div', 'fpf-exact-view fpf-auto-view', `
            <section class="fpf-card fpf-auto-master">
                <div class="fpf-auto-master-head">
                    <div class="fpf-auto-title">${icon('rocket_launch','blue')}<div><b>Авто-поднятие объявлений</b><span>Автоматически поднимает ваши объявления в списке FunPay<br>по заданному расписанию, чтобы они оставались в топе.</span></div></div>
                    <div class="fpf-auto-state"><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#autoBumpEnabled"><span></span></label><b>Включено</b><em>● Работает</em><button class="fpf-more">•••</button></div>
                </div>
                <div class="fpf-auto-schedule">
                    <div class="fpf-setting-block">${icon('calendar_month')}<div><b>Расписание</b><select><option>Ежедневно</option><option>По будням</option></select></div></div>
                    <div class="fpf-setting-block fpf-time-range">${icon('schedule')}<div><b>Временной диапазон</b><strong>с 09:00&nbsp;&nbsp; до 23:00</strong><div class="fpf-range-visual"><i style="left:18%"></i><i style="left:88%"></i></div><small><span>09:00</span><span>23:00</span></small></div></div>
                </div>
                <div class="fpf-auto-settings"><div class="fpf-auto-settings-title">${icon('settings')}<b>Настройки</b></div><label><span>Интервал между поднятиями</span><select><option>30 минут</option></select></label><label><span>Лимит поднятий в день</span><input type="number" value="20"></label><label><span>Товары для поднятия</span><select><option>Все активные товары</option></select></label><label><span>При ошибке</span><select><option>Повторить через 10 минут</option></select></label></div>
            </section>
            <div class="fpf-auto-columns">
                <div>
                    <section class="fpf-card fpf-rules"><div class="fpf-card-head"><div class="fpf-card-title">${icon('format_list_bulleted')}<span>Правила автоматизации</span></div><button class="fpf-primary-mini">＋ Добавить правило</button></div>
                        <div class="fpf-rule-row"><span class="drag">⠿</span><p><b>Основные товары</b><span>Все активные товары · Каждые 30 минут</span></p><label class="fpf-switch-ui"><input type="checkbox" checked><span></span></label><button>•••</button></div>
                        <div class="fpf-rule-row"><span class="drag">⠿</span><p><b>Вечерний буст</b><span>Топовые товары · Каждые 15 минут · 18:00 – 23:00</span></p><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#selectiveBumpEnabled"><span></span></label><button>•••</button></div>
                        <div class="fpf-rule-row"><span class="drag">⠿</span><p><b>Новые товары</b><span>Только новые · Каждый час</span></p><label class="fpf-switch-ui"><input type="checkbox"><span></span></label><button>•••</button></div>
                        <div class="fpf-rule-row"><span class="drag">⠿</span><p><b>Популярные категории</b><span>CS2, Dota 2, Steam · Каждые 20 минут</span></p><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#bumpOnlyAutoDelivery"><span></span></label><button>•••</button></div>
                    </section>
                    <div class="fpf-tip-card">${icon('lightbulb')}<div><b>Совет</b><span>Используйте разные правила для разных категорий товаров,<br>чтобы добиться максимального охвата аудитории.</span></div><button>×</button></div>
                </div>
                <div>
                    <section class="fpf-card fpf-auto-stats"><div class="fpf-card-head"><div class="fpf-card-title">${icon('bar_chart')}<span>Статистика за сегодня</span></div><button class="fpf-text-link">Открыть аналитику →</button></div>
                        <div class="fpf-auto-stat-grid">
                            <div><span>Поднятий выполнено</span><b>18</b><em class="up">▲ +12%</em>${spark('0,31 18,26 34,14 52,21 70,5 83,11 100,1','blue')}</div>
                            <div><span>Просмотров +</span><b>1 240</b><em class="up">▲ +28%</em>${spark('0,31 18,24 34,12 50,20 67,6 82,13 100,2','purple')}</div>
                            <div><span>Переходов в товар</span><b>96</b><em class="up">▲ +34%</em>${spark('0,31 18,25 34,17 52,20 68,8 84,12 100,2','green')}</div>
                            <div><span>Продаж</span><b>7</b><em class="up">▲ +75%</em>${spark('0,31 20,27 36,18 53,22 70,10 86,13 100,2','yellow')}</div>
                        </div>
                    </section>
                    <section class="fpf-card fpf-run-log"><div class="fpf-card-head"><div class="fpf-card-title">${icon('schedule')}<span>Журнал выполнения</span></div><button class="fpf-text-link">Все события →</button></div>
                        <div class="fpf-log-row ok"><i></i><time>12:32</time><span>Объявление успешно поднято</span><b>CS2 – Аккаунты Prime</b></div>
                        <div class="fpf-log-row ok"><i></i><time>12:02</time><span>Объявление успешно поднято</span><b>Dota 2 – Предметы</b></div>
                        <div class="fpf-log-row warn"><i></i><time>11:30</time><span>Пропущено (лимит на сегодня)</span><b>Steam – Подарочные карты</b></div>
                        <div class="fpf-log-row ok"><i></i><time>11:00</time><span>Объявление успешно поднято</span><b>Valorant – Аккаунты</b></div>
                        <div class="fpf-log-row error"><i></i><time>10:30</time><span>Ошибка сети. Повтор через 10 минут</span><b>LoL – Аккаунты</b></div>
                    </section>
                </div>
            </div>
        `);
        page.insertBefore(view, legacy);
        qa(view, '[data-sync-check]').forEach(input => bindCheckbox(input, q(legacy, input.dataset.syncCheck)));
    }

    function composeFinance(root) {
        const page = ensurePage(root, 'finance_overview');
        if (page.dataset.fpfExact === '1') return;
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        page.innerHTML = `<div class="fpf-exact-view">
            <div class="fpf-kpi-grid fpf-finance-kpis">
                <article class="fpf-kpi">${icon('settings','green')}<div><span>Доходы</span><strong>₽ 128 450</strong><small class="up">↑ +12.5%</small><em>по сравнению с прошлым месяцем</em></div>${spark('0,31 13,25 23,28 34,18 46,22 57,9 68,16 80,4 90,12 100,2','green')}</article>
                <article class="fpf-kpi">${icon('settings','red')}<div><span>Расходы</span><strong>₽ 46 230</strong><small class="danger">↑ +8.3%</small><em>по сравнению с прошлым месяцем</em></div>${spark('0,31 12,26 22,16 33,23 44,12 55,18 66,7 78,14 90,5 100,12','red')}</article>
                <article class="fpf-kpi">${icon('palette','blue')}<div><span>Прибыль</span><strong>₽ 82 220</strong><small class="up">↑ +18.7%</small><em>по сравнению с прошлым месяцем</em></div>${spark('0,31 14,24 26,13 38,20 51,8 63,18 76,4 88,12 100,3','blue')}</article>
                <article class="fpf-kpi">${icon('settings','purple')}<div><span>Рентабельность</span><strong>64%</strong><small class="up">↑ +4.2%</small><em>по сравнению с прошлым месяцем</em></div>${spark('0,31 15,26 26,17 38,22 50,11 63,15 76,6 88,12 100,2','purple')}</article>
            </div>
            <div class="fpf-finance-main">
                <section class="fpf-card"><div class="fpf-card-head"><div class="fpf-card-title">${icon('bar_chart')}<span>Динамика финансов</span></div><div class="fpf-segment"><button>7 дней</button><button class="active">30 дней</button><button>3 месяца</button><button>Год</button></div></div><div class="fpf-legend"><span class="green">● Доходы</span><span class="red">● Расходы</span><span class="blue">● Прибыль</span></div><div class="fpf-chart-wrap fpf-finance-chart-wrap">${financeChart()}<div class="fpf-chart-tip fpf-finance-tip"><span>17 мар 2024</span><small class="green">● Доходы: ₽ 162 400</small><small class="red">● Расходы: ₽ 58 200</small><small class="blue">● Прибыль: ₽ 104 200</small></div><div class="fpf-axis x"><span>1 мар</span><span>5 мар</span><span>9 мар</span><span>13 мар</span><span>17 мар</span><span>21 мар</span><span>25 мар</span><span>29 мар</span></div></div></section>
                <section class="fpf-card fpf-expenses"><div class="fpf-card-head"><div class="fpf-card-title">${icon('pie_chart')}<span>Расходы по категориям</span></div></div><div class="fpf-donut-row"><div class="fpf-donut"><div><b>₽ 46 230</b><span>всего</span></div></div><div class="fpf-expense-list"><p><i class="blue"></i><span>Закупки товаров</span><small>42%</small><b>₽ 19 420</b></p><p><i class="yellow"></i><span>Комиссии</span><small>18%</small><b>₽ 8 320</b></p><p><i class="red"></i><span>Реклама</span><small>14%</small><b>₽ 6 480</b></p><p><i class="purple"></i><span>Сервисы</span><small>10%</small><b>₽ 4 620</b></p><p><i class="gray"></i><span>Прочее</span><small>16%</small><b>₽ 7 390</b></p></div></div></section>
            </div>
            <div class="fpf-finance-bottom">
                <section class="fpf-card fpf-profit-calc"><div class="fpf-card-head"><div class="fpf-card-title">${icon('calculate')}<span>Калькулятор прибыли</span></div><div class="fpf-segment"><button class="active">По товару</button><button>По заказу</button></div></div><div class="fpf-form-grid"><label>Цена продажи<div><input type="number" value="1000"><span>₽</span></div></label><label>Себестоимость<div><input type="number" value="650"><span>₽</span></div></label><label>Комиссия FunPay<div><input type="number" value="5"><span>%</span></div></label><label>Доп. расходы<div><input type="number" value="50"><span>₽</span></div></label></div><div class="fpf-profit-result"><div><span>Чистая прибыль</span><b>₽ 300</b></div><div><span>Рентабельность</span><b>30%</b></div><div><span>Маржа</span><b>35.7%</b></div></div></section>
                <section class="fpf-card fpf-currency-card"><div class="fpf-card-head"><div class="fpf-card-title">${icon('currency_exchange')}<span>Конвертер валют</span></div><small>↻ &nbsp; Обновлено 29.03.2024 16:42</small></div><div class="fpf-currency-grid"><div><label>Из валюты</label><select><option>🇺🇸 USD - Доллар США</option></select><input value="100"></div><button class="fpf-swap">⇄</button><div><label>В валюту</label><select><option>🇷🇺 RUB - Российский рубль</option></select><input value="9 240,50"></div></div><div class="fpf-rate">1 USD = 92,405 RUB</div><div class="fpf-info-strip">ⓘ &nbsp; Курсы обновляются автоматически</div></section>
            </div>
            <div class="fpf-finance-actions"><button>⇩ &nbsp; Экспорт данных</button><button>↥ &nbsp; Импорт данных</button><button>▤ &nbsp; Сформировать отчёт</button><button class="primary">⚙ &nbsp; Настроить категории</button></div>
        </div>`;
    }

    function composeChat(root) {
        const page = q(root, '.fp-tools-page-content[data-page="templates"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const view = h('div', 'fpf-exact-view fpf-chat-view', `
            <div class="fpf-chat-upper">
                <section class="fpf-card fpf-template-library"><div class="fpf-card-head"><div class="fpf-card-title">${icon('chat')}<span>Шаблоны сообщений</span></div></div><p class="fpf-subline">Создавайте и используйте готовые шаблоны для быстрой коммуникации</p><nav class="fpf-template-cats"><button class="active">${icon('folder')}<span>Все шаблоны</span><b>12</b></button><button>${icon('favorite')}<span>Приветствие</span><b>3</b></button><button>${icon('info')}<span>Информация</span><b>4</b></button><button>${icon('payments')}<span>Оплата</span><b>2</b></button><button>${icon('local_shipping')}<span>Доставка</span><b>2</b></button><button>${icon('check_circle')}<span>Завершение</span><b>1</b></button><button>${icon('info')}<span>Другое</span><b>0</b></button></nav></section>
                <section class="fpf-card fpf-template-center"><div class="fpf-template-toolbar"><div class="fpf-search">${icon('search')}<input placeholder="Поиск по шаблонам..."></div><select><option>Сначала новые</option></select></div><div class="fpf-template-list"><div>${icon('description')}<p><b>Приветствие (стандарт)</b><span>Здравствуйте! 👋 Спасибо за интерес к товару...</span></p><em class="blue">Приветствие</em><button>•••</button></div><div>${icon('description')}<p><b>Подтверждение оплаты</b><span>Оплату получил ✅ Начинаю выполнение...</span></p><em class="green">Оплата</em><button>•••</button></div><div>${icon('description')}<p><b>Инструкция после покупки</b><span>Вот что нужно сделать после покупки: 1. Перей...</span></p><em class="purple">Информация</em><button>•••</button></div><div>${icon('description')}<p><b>Завершение сделки</b><span>Спасибо за покупку! Если остались вопросы — ...</span></p><em class="yellow">Завершение</em><button>•••</button></div><div>${icon('description')}<p><b>Задержка / ожидание</b><span>Извините за ожидание, сейчас занят, вернусь в ...</span></p><em>Другое</em><button>•••</button></div></div><button class="fpf-add-template">＋ &nbsp; Добавить шаблон</button></section>
                <div class="fpf-chat-side"><section class="fpf-card fpf-recent"><div class="fpf-card-head"><div class="fpf-card-title">${icon('schedule')}<span>Недавние шаблоны</span></div></div><div>${icon('description','green')}<p><b>Подтверждение оплаты</b><span>Использован 12 мин. назад</span></p><button>⋮</button></div><div>${icon('description','purple')}<p><b>Инструкция после покупки</b><span>Использован 1 ч. назад</span></p><button>⋮</button></div><div>${icon('description')}<p><b>Приветствие (стандарт)</b><span>Использован 3 ч. назад</span></p><button>⋮</button></div><div>${icon('description')}<p><b>Задержка / ожидание</b><span>Использован 5 ч. назад</span></p><button>⋮</button></div><div>${icon('description','yellow')}<p><b>Завершение сделки</b><span>Использован 1 д. назад</span></p><button>⋮</button></div></section><section class="fpf-card fpf-chat-actions"><div class="fpf-card-head"><div class="fpf-card-title">${icon('bolt')}<span>Быстрые действия</span></div></div><div>${navButton('Вставить шаблон','description','templates')}${navButton('Ответить клиенту','reply','templates')}${navButton('Добавить заметку','note_add','notes')}${navButton('Открыть профиль','person','chat_search')}</div></section></div>
            </div>
            <div class="fpf-chat-bottom">
                <section class="fpf-card fpf-chat-improvements"><div class="fpf-card-head"><div class="fpf-card-title">${icon('settings')}<span>Улучшения чата</span></div></div><p class="fpf-subline">Дополнительные возможности для удобного общения</p><div class="fpf-improve-row">${icon('contact_support')}<p><b>Автоподстановка шаблонов</b><span>Показывать подходящие шаблоны при вводе</span></p><label class="fpf-switch-ui"><input type="checkbox" checked><span></span></label></div><div class="fpf-improve-row">${icon('link')}<p><b>Сокращённые ссылки</b><span>Автоматически сокращать длинные ссылки</span></p><label class="fpf-switch-ui"><input type="checkbox" checked><span></span></label></div><div class="fpf-improve-row">${icon('notifications')}<p><b>Уведомления о новых сообщениях</b><span>Звуковые и визуальные уведомления</span></p><label class="fpf-switch-ui"><input type="checkbox" checked><span></span></label></div><div class="fpf-improve-row">${icon('lightbulb')}<p><b>Показывать подсказки</b><span>Отображать полезные подсказки в чате</span></p><label class="fpf-switch-ui"><input type="checkbox"><span></span></label></div></section>
                <section class="fpf-card fpf-clients"><div class="fpf-card-head"><div class="fpf-card-title">${icon('group')}<span>Клиенты и заметки</span></div></div><p class="fpf-subline">Управляйте клиентами и сохраняйте важную информацию</p><div class="fpf-client-toolbar"><div class="fpf-search">${icon('search')}<input placeholder="Поиск по клиентам..."></div><button class="fpf-primary-mini">＋ Добавить заметку</button></div><div class="fpf-client-row"><i>I</i><p><b>ivan_2003 <em class="blue">Постоянный клиент</em><small>5 заказов</small></b><span>Надёжный, всегда на связи. Предпочитает быстрые ответы.</span></p><time>2 д. назад</time><button>•••</button></div><div class="fpf-client-row"><i>S</i><p><b>sweetgirl <em class="green">Новый</em><small>1 заказ</small></b><span>Уточнить детали перед началом. Интересуется скидками.</span></p><time>3 д. назад</time><button>•••</button></div><div class="fpf-client-row"><i>S</i><p><b>shadow_play <em class="blue">Постоянный клиент</em><small>12 заказов</small></b><span>Проверенный, проблем не было. Любит точные инструкции.</span></p><time>5 д. назад</time><button>•••</button></div><div class="fpf-client-row danger"><i>M</i><p><b>markus <em class="red">В чёрном списке</em><small>0 заказов</small></b><span>Пытается торговаться после оплаты. Жалобы.</span></p><time>1 нед. назад</time><button>•••</button></div></section>
            </div>
        `);
        page.insertBefore(view, legacy);
        wireNav(page);
        const sources = qa(legacy, '.checkbox-label-inline input[type="checkbox"]');
        const visible = qa(view, '.fpf-chat-improvements input[type="checkbox"]');
        if (sources[0] && visible[0]) bindCheckbox(visible[0], sources[0]);
        if (sources[1] && visible[1]) bindCheckbox(visible[1], sources[1]);
    }

    function composeLots(root) {
        const page = ensurePage(root, 'lot_manage');
        if (page.dataset.fpfExact === '1') return;
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const cats = [['Steam','28.4%','86%'],['CS2','18.7%','67%'],['Valorant','12.3%','47%'],['Dota 2','9.1%','38%'],['Genshin Impact','8.6%','35%'],['Roblox','7.2%','29%'],['Minecraft','5.9%','24%'],['Fortnite','4.8%','19%']];
        const products = [['Steam Wallet 1000 RUB','Steam','1 150 ₽','12','1 284','Активен','green','S'],['Valorant Points 1750','Valorant','1 490 ₽','6','892','Активен','green','V'],['Genshin Impact 980 кристаллов','Genshin Impact','1 390 ₽','0','654','На паузе','yellow','G'],['Minecraft Premium (Полный доступ)','Minecraft','2 190 ₽','4','421','Активен','green','M'],['Fortnite 2800 V-Bucks','Fortnite','2 490 ₽','1','367','Нет в наличии','red','F']];
        page.innerHTML = `<div class="fpf-exact-view">
            <div class="fpf-market-actions"><article class="fpf-card">${icon('bar_chart')}<div><b>Аналитика рынка</b><span>Цены, спрос, конкуренты<br>и тренды в реальном времени</span></div><button class="primary" data-fpf-page="pricing">Открыть аналитику →</button></article><article class="fpf-card">${icon('layers')}<div><b>Массовые операции</b><span>Обновление цен, статусов,<br>описаний и других параметров</span></div><button>Выбрать действие →</button></article><article class="fpf-card">${icon('content_copy')}<div><b>Клонирование лотов</b><span>Быстрое создание новых лотов<br>на основе существующих</span></div><button data-fpf-page="lot_clone">Создать копию →</button></article><article class="fpf-card">${icon('swap_vert')}<div><b>Импорт / экспорт</b><span>Загрузка и выгрузка товаров<br>в CSV или Excel</span></div><button data-fpf-page="lot_io">Перейти →</button></article></div>
            <section class="fpf-card fpf-product-search"><div class="fpf-card-title">${icon('search')}<span>Быстрый поиск товара</span></div><div class="fpf-search-row"><div class="fpf-search">${icon('search')}<input placeholder="Название товара, игры или категории..."></div><select><option>Все категории</option></select><button class="fpf-primary-mini">⌕ &nbsp; Найти</button></div><div class="fpf-popular"><span>Популярные запросы:</span><button>Valorant</button><button>CS2</button><button>Genshin Impact</button><button>Steam</button><button>Roblox</button><button>Minecraft</button><button>Fortnite</button></div></section>
            <div class="fpf-market-grid"><section class="fpf-card"><div class="fpf-card-head"><div class="fpf-card-title">${icon('trending_up')}<span>Динамика рынка</span></div><div class="fpf-segment"><button class="active">7 дней</button><button>30 дней</button><button>90 дней</button></div></div><div class="fpf-market-legend"><span class="blue">● Средняя цена</span><span>● Количество лотов</span></div><div class="fpf-chart-wrap">${lineChart()}<div class="fpf-chart-tip"><span>25 апр</span><small class="blue">● Средняя цена: <b>1 320 ₽</b></small><small>● Лотов: 342</small></div><div class="fpf-axis x"><span>22 апр</span><span>23 апр</span><span>24 апр</span><span>25 апр</span><span>26 апр</span><span>27 апр</span><span>28 апр</span></div></div></section><section class="fpf-card fpf-top-categories"><div class="fpf-card-head"><div class="fpf-card-title">${icon('pie_chart')}<span>Топ категорий</span></div><button class="fpf-text-link">Смотреть все</button></div>${cats.map((x,i)=>`<div><span>${i+1}</span><i class="fpf-cat c${i}"></i><b>${x[0]}</b><em><u style="width:${x[2]}"></u></em><small>${x[1]}</small></div>`).join('')}</section></div>
            <section class="fpf-card fpf-products-table"><div class="fpf-products-table-head"><div class="fpf-card-title">${icon('inventory_2')}<span>Мои товары (лоты)</span></div><div class="fpf-search small">${icon('search')}<input placeholder="Поиск по моим товарам..."></div><select><option>Все статусы</option></select><button class="fpf-primary-mini">＋ Добавить лот</button></div><div class="fpf-table-head"><span>□</span><span>Название ↓</span><span>Категория ↑</span><span>Цена ↓</span><span>Остаток ↑</span><span>Просмотры ↑</span><span>Статус ↑</span><span>Действия</span></div>${products.map(x=>`<div class="fpf-table-row"><span>□</span><span><i class="fpf-game">${x[7]}</i><b>${x[0]}</b></span><span>${x[1]}</span><span>${x[2]}</span><span>${x[3]}</span><span>${x[4]}</span><span><em class="${x[6]}">● ${x[5]}</em></span><span><button>✎</button><button>▣</button><button>•••</button></span></div>`).join('')}</section>
        </div>`;
        wireNav(page);
    }

    function composeTheme(root) {
        const page = q(root, '.fp-tools-page-content[data-page="theme"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const view = h('div', 'fpf-exact-view fpf-theme-view', `
            <section class="fpf-card fpf-theme-master"><div class="fpf-card-head"><div class="fpf-card-title">${icon('palette')}<div><b>Кастомизация темы</b><span>Включите, чтобы использовать собственную тему оформления</span></div></div><div class="fpf-master-actions"><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#enableCustomThemeCheckbox"><span></span></label><span>Включить кастомную тему</span><button class="fpf-primary-mini">Применить</button></div></div><div class="fpf-ready-label">Готовые темы</div><div class="fpf-theme-tiles"><button class="active"><i class="firewatch"></i><span>Firewatch Blue</span><em>✓</em></button><button><i class="cyber"></i><span>Cyber Purple</span></button><button><i class="midnight"></i><span>Midnight</span></button><button><i class="ocean"></i><span>Ocean</span></button><button><i class="forest"></i><span>Forest</span></button><button><i class="sunset"></i><span>Sunset</span></button><button class="upload"><i>＋</i><span>Загрузить тему</span></button></div><small class="fpf-theme-note">Тема из игры Firewatch, сделанная в синих оттенках</small></section>
            <div class="fpf-theme-row"><section class="fpf-card fpf-bg-card"><div class="fpf-card-title">${icon('image')}<span>Фоновое изображение</span></div><div class="fpf-bg-preview"><button>×</button><span></span></div><div class="fpf-bg-buttons"><button class="primary" data-click-source="#uploadBgImageBtn">↥ &nbsp; Загрузить</button><button data-click-source="#removeBgImageBtn">▱ &nbsp; Удалить</button></div><a>Откуда брать анимации? ⓘ</a></section><section class="fpf-card fpf-colors-card"><div class="fpf-card-title">${icon('palette')}<span>Цвета интерфейса</span></div><div class="fpf-color-grid"><label>Основной цвет<input type="color" value="#ffa567" data-sync-value="#themeColor1"></label><label>Акцентный цвет<input type="color" value="#ffe49a" data-sync-value="#themeColor2"></label><label>Фон блоков<input type="color" value="#9aa8ba" data-sync-value="#themeContainerBgColor"></label><label>Цвет текста<input type="color" value="#f0f1f2" data-sync-value="#themeTextColor"></label><label>Цвет ссылок<input type="color" value="#59aef1" data-sync-value="#themeLinkColor"></label></div></section></div>
            <div class="fpf-theme-controls three"><section class="fpf-card"><div class="fpf-card-title">${icon('text_fields')}<span>Шрифт</span></div><select data-sync-value="#themeFontSelect"><option>Системный (Helvetica Neue)</option></select></section><section class="fpf-card"><div class="fpf-card-title">${icon('water_drop')}<span>Размытие фона</span></div><div class="fpf-range-row"><input type="range" min="0" max="20" value="0" data-sync-value="#themeBgBlur"><span>0px</span></div></section><section class="fpf-card"><div class="fpf-card-title">${icon('light_mode')}<span>Яркость фона</span></div><div class="fpf-range-row"><input type="range" min="20" max="150" value="100" data-sync-value="#themeBgBrightness"><span>100%</span></div></section></div>
            <div class="fpf-theme-controls three"><section class="fpf-card"><div class="fpf-card-title">${icon('rounded_corner')}<span>Закругление углов</span></div><div class="fpf-range-row"><input type="range" min="0" max="30" value="8" data-sync-value="#themeBorderRadius"><span>8px</span></div></section><section class="fpf-card fpf-toggle-card"><div class="fpf-card-title">${icon('blur_on')}<span>Эффект "матового стекла"</span></div><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#enableGlassmorphism"><span></span></label></section><section class="fpf-card fpf-toggle-card"><div class="fpf-card-title">${icon('scrollable_header')}<span>Кастомный скроллбар</span></div><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#enableCustomScrollbar"><span></span></label></section></div>
            <div class="fpf-theme-bottom"><section class="fpf-card fpf-circles-card"><div class="fpf-card-title">${icon('sentiment_satisfied')}<span>Кругляшки</span></div><div class="fpf-circle-preview"><span>Предпросмотр:</span><i></i><label><input type="checkbox" data-sync-check="#enableCircleCustomization"> Включить кастомизацию</label></div></section><section class="fpf-card fpf-separators-card"><div class="fpf-card-title">${icon('format_list_bulleted')}<span>Разделители</span></div><label><input type="checkbox" data-sync-check="#enableImprovedSeparators"> Включить улучшенные</label></section><section class="fpf-card fpf-theme-actions-card"><div class="fpf-card-title">${icon('share')}<span>Действия с темой</span></div><button data-click-source="#shareThemeBtn">↗ &nbsp; Поделиться темой</button><div><button data-click-source="#exportThemeBtn">⇩ &nbsp; Экспорт</button><button data-click-source="#importThemeBtn">↥ &nbsp; Импорт</button></div><button class="danger" data-click-source="#resetThemeBtn">↶ &nbsp; СБРОСИТЬ ТЕМУ</button></section></div>
        `);
        page.insertBefore(view, legacy);
        qa(view, '[data-sync-check]').forEach(input => bindCheckbox(input, q(legacy, input.dataset.syncCheck)));
        qa(view, '[data-sync-value]').forEach(input => bindValue(input, q(legacy, input.dataset.syncValue), input.tagName === 'SELECT' || input.type === 'color' ? 'change' : 'input'));
        qa(view, '[data-click-source]').forEach(btn => btn.addEventListener('click', () => q(legacy, btn.dataset.clickSource)?.click()));
    }

    function composeCustomization(root) {
        const page = q(root, '.fp-tools-page-content[data-page="needs"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const groups = [
            ['Чат и коммуникации','chat',[['Кнопка «Заметка» в чате','Показывает кнопку заметок под панелью «Покупатель смотрит» в чате.'],['Блок быстрых действий в чате','Дополнительные инструменты и кнопки для работы с клиентами.']]],
            ['Редактор и создание лотов','edit',[['Кнопки «Открыть лот»','Переход к лоту и его редактированию со страницы категории.'],['Кнопка «Поднять все лоты»','Массово поднимает все лоты на вашем профиле.']]],
            ['Лоты и профиль','inventory_2',[['Кнопка «Копировать лот»','Кнопка под блоком товара на странице заказа для быстрого создания копии лота.'],['Копирование номера заказа','Кликабельный номер заказа в заголовке страницы.'],['Кнопка «Выбрать» лоты','Режим выделения нескольких лотов для массовых действий.'],['Кнопка «Включить лоты»','Массовое включение/выключение выбранных лотов.']]],
            ['Заказы и покупки','shopping_cart',[['Кнопка «Показать ещё» в статистике','Разворачивает дополнительную статистику на странице продаж.']]],
            ['Меню профиля','person',[['Пункт «Добавить новую метку»','Добавляет пункт в меню статусов собеседника.']]]
        ];
        const view = h('div', 'fpf-exact-view fpf-custom-view', `
            <section class="fpf-card fpf-ai-card"><div class="fpf-ai-title">${icon('auto_awesome','purple')}<div><b>Создайте идеальный интерфейс с помощью AI</b><span>Опишите, какие элементы вам нужны на сайте, и мы подберём оптимальные настройки</span></div></div><div class="fpf-ai-input"><input placeholder="Например: «Скрыть аналитику, оставить только чат и создание лотов»"><button>✧ &nbsp; Подобрать настройки</button></div><div class="fpf-ai-presets"><span>Быстрые пресеты:</span><button data-preset-click="buyer">👤 &nbsp; Для новичков</button><button data-preset-click="seller">🛒 &nbsp; Только продажи</button><button data-preset-click="minimal">🍃 &nbsp; Минимализм</button><button data-preset-click="default">⭐ &nbsp; Полный функционал</button></div></section>
            <section class="fpf-card fpf-custom-filter"><div class="fpf-filter-top"><div class="fpf-search">${icon('search')}<input placeholder="Поиск по элементам..."></div><div class="fpf-filter-pills"><button class="active">Все</button><button>▢ Чат</button><button>▣ Лоты</button><button>✎ Редактор</button><button>🛒 Заказы</button><button>♙ Профиль</button></div><b>АКТИВНО: 14 из 18</b></div><div class="fpf-selection-bar"><span>□ &nbsp; Выбрано: 0 элементов</span><div><button>✓ &nbsp; Включить выбранные</button><button>× &nbsp; Отключить выбранные</button><button>↻ &nbsp; Сбросить настройки</button></div></div></section>
            <div class="fpf-custom-groups">
                <div class="fpf-custom-column">${[groups[0],groups[2]].map(([title,ico,rows])=>`<section class="fpf-card"><div class="fpf-custom-group-head">${icon(ico)}<b>${title}</b><span>${Math.min(rows.length,2)} из ${rows.length}</span><i>⌃</i></div>${rows.map(([t,d])=>`<div class="fpf-custom-row"><label><input type="checkbox" checked></label><p><b>${t}</b><span>${d}</span></p><button>◉</button></div>`).join('')}</section>`).join('')}</div>
                <div class="fpf-custom-column">${[groups[1],groups[3],groups[4]].map(([title,ico,rows])=>`<section class="fpf-card"><div class="fpf-custom-group-head">${icon(ico)}<b>${title}</b><span>${Math.min(rows.length,2)} из ${rows.length}</span><i>⌃</i></div>${rows.map(([t,d])=>`<div class="fpf-custom-row"><label><input type="checkbox" checked></label><p><b>${t}</b><span>${d}</span></p><button>◉</button></div>`).join('')}</section>`).join('')}</div>
            </div>
        `);
        page.insertBefore(view, legacy);
        const prompt = q(view, '.fpf-ai-input input');
        q(view, '.fpf-ai-input button')?.addEventListener('click', () => {
            const src = q(legacy, '#fptNeedsInput');
            if (src) src.value = prompt?.value || '';
            q(legacy, '#fptNeedsAskBtn')?.click();
        });
        qa(view, '[data-preset-click]').forEach(btn => btn.addEventListener('click', () => q(legacy, `.fpt-preset-btn[data-preset="${btn.dataset.presetClick}"]`)?.click()));
    }

    function composeSystem(root) {
        const page = q(root, '.fp-tools-page-content[data-page="general"]');
        if (!page || page.dataset.fpfExact === '1') return;
        const legacy = stashOriginal(page);
        page.dataset.fpfExact = '1';
        page.classList.add('fpf-exact-page');
        const sounds = [['Стандартный','default'],['VK','vk'],['Telegram','tg'],['iPhone','iphone'],['Discord','discord'],['WhatsApp','whatsapp'],['Своя мелодия','custom']];
        const view = h('div', 'fpf-exact-view fpf-system-view', `
            <section class="fpf-card fpf-sound-card"><div class="fpf-card-title">${icon('notifications')}<div><b>Звук уведомления</b><span>Выберите звук, который будет воспроизводиться при новых сообщениях и событиях.</span></div></div><div class="fpf-sound-options">${sounds.map((x,i)=>`<label class="${i===0?'active':''}"><input type="radio" name="fpfSound" value="${x[1]}" ${i===0?'checked':''}><i></i><span>${x[0]}</span></label>`).join('')}</div><div class="fpf-volume"><b>Громкость уведомлений:</b><input type="range" min="0" max="100" value="100" data-sync-value="#notificationVolume"><span>100%</span><button data-click-source="#previewNotificationBtn">▷ &nbsp; Прослушать</button></div></section>
            <section class="fpf-card fpf-webhook-card"><div class="fpf-card-title">${icon('link')}<div><b>Webhook</b><span>Получайте HTTP-уведомления о новых сообщениях и событиях.</span></div></div><div class="fpf-webhook-input"><input value="https://example.com/webhook" data-sync-value="#discordWebhookUrl"><button class="primary">Сохранить</button></div><div class="fpf-info-strip">ⓘ &nbsp; На указанный URL будут отправляться JSON-данные о новых сообщениях, сделках и других событиях.<br><a>Документация по формату данных ↗</a></div></section>
            <section class="fpf-card fpf-discord-card"><div class="fpf-card-title">${icon('sports_esports')}<div><b>Discord</b><span>Отправлять мгновенные оповещения о новых сообщениях и событиях в ваш Discord-канал.</span></div></div><div class="fpf-integration-row"><div><b>Уведомления в Discord <em>ИНТЕГРАЦИЯ</em></b><span>Получайте уведомления о важных событиях прямо в ваш Discord-сервер.</span></div><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#discordLogEnabled"><span></span></label></div></section>
            <section class="fpf-card fpf-identifier-card"><div class="fpf-card-title">${icon('text_fields')}<div><b>Идентификатор FunPay Funcy</b><span>Метка FunPay Funcy у собеседника. Показывает пометку рядом с ником пользователя в чате.</span></div></div><div class="fpf-integration-row"><div><b>Показывать метку «FunPay Funcy» <em>ЧАТ</em></b><span>При включении к исходящим сообщениям добавляется невидимый символ. Не виден обычным пользователям.</span></div><label class="fpf-switch-ui"><input type="checkbox" data-sync-check="#fptIdentifierEnabled"><span></span></label></div></section>
            <div class="fpf-system-ok">${icon('check_circle','green')}<div><b>Система работает стабильно</b><span>Все сервисы функционируют в штатном режиме.</span></div><p><b>● Все системы в порядке</b><span>Обновлено сегодня в 15:42</span></p><button>↻</button></div>
        `);
        page.insertBefore(view, legacy);
        qa(view, '[data-sync-check]').forEach(input => bindCheckbox(input, q(legacy, input.dataset.syncCheck)));
        qa(view, '[data-sync-value]').forEach(input => bindValue(input, q(legacy, input.dataset.syncValue), input.type === 'range' ? 'input' : 'input'));
        qa(view, '[data-click-source]').forEach(btn => btn.addEventListener('click', () => q(legacy, btn.dataset.clickSource)?.click()));
        qa(view, '.fpf-sound-options input').forEach(input => input.addEventListener('change', () => {
            qa(view, '.fpf-sound-options label').forEach(l => l.classList.toggle('active', q(l, 'input')?.checked));
            const src = q(legacy, `input[name="notificationSound"][value="${input.value}"]`);
            if (src) { src.checked = true; src.dispatchEvent(new Event('change', { bubbles: true })); }
        }));
    }

    function composeGenericPages(root) {
        const scenarios = ensurePage(root, 'scenarios');
        if (scenarios.dataset.fpfExact !== '1') {
            scenarios.dataset.fpfExact = '1';
            scenarios.classList.add('fpf-exact-page');
            scenarios.innerHTML = `<div class="fpf-exact-view"><section class="fpf-card fpf-generic-page"><div class="fpf-card-head"><div class="fpf-card-title">${icon('account_tree')}<span>Сценарии автоматизации</span></div><button class="fpf-primary-mini">＋ Создать сценарий</button></div><div class="fpf-generic-grid"><article>${icon('schedule')}<b>Вечерний буст</b><span>18:00–23:00 · популярные товары</span></article><article>${icon('shopping_bag')}<b>Новый заказ</b><span>Ответ → выдача → уведомление</span></article><article>${icon('reviews')}<b>После сделки</b><span>Отзыв → заметка о клиенте</span></article></div></section></div>`;
        }
        const search = ensurePage(root, 'chat_search');
        if (search.dataset.fpfExact !== '1') {
            search.dataset.fpfExact = '1';
            search.classList.add('fpf-exact-page');
            search.innerHTML = `<div class="fpf-exact-view"><section class="fpf-card fpf-generic-page"><div class="fpf-card-title">${icon('search')}<span>Поиск по клиентам и перепискам</span></div><div class="fpf-search giant">${icon('search')}<input placeholder="Ник, номер заказа, текст сообщения..."></div><div class="fpf-generic-empty">${icon('manage_search')}<b>Начните вводить запрос</b><span>Мы найдём совпадения в клиентах, заметках и истории чатов.</span></div></section></div>`;
        }
        const clone = ensurePage(root, 'lot_clone');
        if (clone.dataset.fpfExact !== '1') {
            clone.dataset.fpfExact = '1';
            clone.classList.add('fpf-exact-page');
            clone.innerHTML = `<div class="fpf-exact-view"><section class="fpf-card fpf-generic-page"><div class="fpf-card-head"><div class="fpf-card-title">${icon('content_copy')}<span>Клонирование лотов</span></div><button class="fpf-primary-mini">＋ Создать копию</button></div><div class="fpf-generic-grid"><article>${icon('inventory_2')}<b>Выберите исходный лот</b><span>Найдите товар, который хотите клонировать</span></article><article>${icon('tune')}<b>Измените параметры</b><span>Категория, цена, описание и количество</span></article><article>${icon('done_all')}<b>Создайте копии</b><span>Один или несколько новых лотов</span></article></div></section></div>`;
        }
    }

    function installChrome(root) {
        if (root.dataset.fpfExactChrome === '1') return;
        root.dataset.fpfExactChrome = '1';
        root.classList.add('fpf-exact-ui');
        const titleWrap = q(root, '.fp-tools-title-wrap');
        if (titleWrap && !q(titleWrap, '.fpf-version')) {
            let version = '2.9.9';
            try { version = chrome.runtime.getManifest?.().version || version; } catch (_) {}
            const badge = h('span', 'fpf-version', `v${version}`);
            const accent = q(titleWrap, '#fptAccentBtn');
            titleWrap.insertBefore(badge, accent || null);
        }
        const header = q(root, '.fp-tools-header');
        if (header && !q(header, '.fpf-minimize')) {
            const close = q(header, '.close-btn');
            const mini = h('button', 'fpf-minimize', '−');
            mini.type = 'button';
            mini.title = 'Свернуть';
            mini.addEventListener('click', () => root.classList.toggle('fpf-collapsed'));
            header.insertBefore(mini, close || null);
        }
        const forceLight = () => {
            // IMPORTANT: this callback is observed on the same class attribute.
            // Only mutate when the state actually needs changing; an unconditional
            // classList.add() can continuously retrigger MutationObserver and lock
            // the FunPay tab when the settings panel is opened.
            if (root.classList.contains('fptm-dark')) root.classList.remove('fptm-dark');
            if (!root.classList.contains('fptm-light')) root.classList.add('fptm-light');
        };
        forceLight();
        const lightModeObserver = new MutationObserver(() => {
            if (root.classList.contains('fptm-dark') || !root.classList.contains('fptm-light')) {
                forceLight();
            }
        });
        lightModeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    function compose(root) {
        installChrome(root);
        composeDashboard(root);
        composeAutomation(root);
        composeFinance(root);
        composeChat(root);
        composeLots(root);
        composeTheme(root);
        composeCustomization(root);
        composeSystem(root);
        composeGenericPages(root);
    }

    function scan(node = document) {
        if (node instanceof HTMLElement && node.matches('.fp-tools-popup')) compose(node);
        node.querySelectorAll?.('.fp-tools-popup').forEach(compose);
    }

    scan();
    const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
    });
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
})();
