// content/ui/main_popup.js

function getModalOverlaysHTML() {
    return `
        <div class="fp-tools-modal-overlay" id="autobump-category-modal-overlay" style="display: none;"><div class="fp-tools-modal-content"><div class="fp-tools-modal-header"><h3>Выберите категории для поднятия</h3><button class="fp-tools-modal-close">&times;</button></div><div class="fp-tools-modal-body"><div class="autobump-modal-controls"><input type="text" id="autobump-category-search" placeholder="Поиск по категориям..."><button id="autobump-select-all" class="btn btn-default" style="padding: 6px 12px; font-size: 13px;">Выбрать всё</button></div><div id="autobump-category-list" class="autobump-category-list"></div></div><div class="fp-tools-modal-footer"><button id="autobump-category-save" class="btn">Сохранить</button></div></div></div>

        <div class="fp-tools-modal-overlay" id="lot-io-export-modal" style="display: none;">
            <div class="fp-tools-modal-content">
                <div class="fp-tools-modal-header">
                    <h3>Экспорт лотов</h3>
                    <button class="fp-tools-modal-close">&times;</button>
                </div>
                <div class="fp-tools-modal-body">
                    <p class="template-info">Выберите категории, лоты из которых вы хотите экспортировать в файл.</p>
                    <div class="autobump-modal-controls">
                        <button id="lot-io-select-all" class="btn btn-default" style="padding: 6px 12px; font-size: 13px; flex-grow:1;">Выбрать/снять все</button>
                    </div>
                    <div class="lot-io-category-list"></div>
                    <div class="lot-io-warning">
                        <svg class="lot-io-warning-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M10.7 4.7 3.2 17.8a1.5 1.5 0 0 0 1.3 2.2h15a1.5 1.5 0 0 0 1.3-2.2L13.3 4.7a1.5 1.5 0 0 0-2.6 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9v4.2M12 16.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                        <span><b>Внимание!</b> Не закрывайте и не перезагружайте эту вкладку до завершения процесса экспорта.</span>
                    </div>
                </div>
                <div class="fp-tools-modal-footer">
                    <button id="lot-io-export-confirm" class="btn">Экспортировать</button>
                </div>
            </div>
        </div>
        <div class="fp-tools-modal-overlay" id="lot-io-import-progress-modal" style="display: none;">
            <div class="fp-tools-modal-content">
                <div class="fp-tools-modal-header">
                    <h3>Прогресс импорта</h3>
                </div>
                <div class="fp-tools-modal-body">
                    <div id="lot-io-progress-summary">Подготовка...</div>
                    <div class="lot-io-progress-list"></div>
                </div>
                <div class="fp-tools-modal-footer">
                    <button id="lot-io-continue-btn" class="btn" style="display:none;">Продолжить</button>
                    <button id="lot-io-cancel-btn" class="btn btn-default">Отменить</button>
                    <div id="lot-io-postpone-controls">
                        <p>Отложите прогресс на завтра, если сейчас не работает.</p>
                        <button id="lot-io-postpone-btn" class="btn btn-default">Отложить</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

const FPT_MENU_ASSET_PATHS = Object.freeze({
    'funcy-logo': 'icons/funcy-logo.png',
    cloud: 'icons/cloud.png',
    discord: 'icons/discord.png',
    telegram: 'icons/telegram.png'
});

const FPT_NAV_ICON_ASSETS = Object.freeze({
    sales: Object.freeze({ collapsed: 'nav-store-collapsed.png', expanded: 'nav-store-expanded.png' }),
    customers: Object.freeze({ collapsed: 'nav-chat-collapsed.png', expanded: 'nav-chat-expanded.png' }),
    finance: Object.freeze({ collapsed: 'nav-analytics-collapsed.png', expanded: 'nav-analytics-expanded.png' }),
    interface: Object.freeze({ collapsed: 'nav-apps-collapsed.png', expanded: 'nav-apps-expanded.png' }),
    settings: Object.freeze({ collapsed: 'nav-settings-collapsed.png', expanded: 'nav-settings-expanded.png' }),
    help: Object.freeze({ collapsed: 'nav-help-collapsed.png', expanded: 'nav-help-expanded.png' })
});

function fptGetMenuAssetUrl(assetPath) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            return chrome.runtime.getURL(assetPath);
        }
    } catch (_) {}
    return assetPath;
}

function createMainPopup() {
    if (!document.getElementById('fp-popup-extra-styles')) {
        const s = document.createElement('style');
        s.id = 'fp-popup-extra-styles';
        s.textContent = `
            .fp-tools-site-link{color:inherit;text-decoration:none;display:inline-block;transition:all .25s ease;position:relative;}
            .fp-tools-site-link::after{content:'';position:absolute;left:0;bottom:-2px;width:0;height:2px;background:linear-gradient(90deg,#1b75bb,#4a9fd4);transition:width .3s ease;border-radius:2px;}
            .fp-tools-site-link:hover{background:linear-gradient(90deg,#1b75bb,#4a9fd4,#1b75bb);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:fp-shimmer 1.2s linear infinite;}
            .fp-tools-site-link:hover::after{width:100%;}
            @keyframes fp-shimmer{0%{background-position:0%}100%{background-position:200%}}
            .fp-wallpaper-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;}
            .fp-wallpaper-card:hover{box-shadow:0 0 0 2px #1b75bb,0 4px 16px rgba(27,117,187,.3);}
            .fp-wallpaper-card img{pointer-events:none;}
            .fp-site-footer-link{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border:1px solid rgba(27,117,187,.35);border-radius:20px;color:#7672ff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.5px;transition:all .2s;}
            .fp-site-footer-link:hover{background:rgba(27,117,187,.12);border-color:#1b75bb;color:#a09af8;transform:translateY(-1px);box-shadow:0 4px 12px rgba(27,117,187,.2);}
            .fp-nav-divider{padding:10px 16px 3px!important;font-size:10px!important;font-weight:700!important;color:var(--fptm-faint, #3a3d52)!important;text-transform:uppercase;letter-spacing:1px;cursor:default!important;pointer-events:none;margin-top:10px!important;}
            .fp-nav-divider:first-child{margin-top:0!important;}
            .fp-nav-divider:hover{background:none!important;}
            .fp-dark-preset-btn{width:100%;margin-bottom:12px;background:rgba(0,0,0,.3)!important;border-color:rgba(255,255,255,.1)!important;display:flex;align-items:center;justify-content:center;gap:8px;}
            .fpt-quick-replies-tabs{display:flex;gap:8px;margin:12px 0 16px;}
            .fpt-quick-replies-tabs [role="tab"]{flex:1;}
        `;
        document.head.appendChild(s);
    }

    const toolsPopup = document.createElement('div');
    toolsPopup.className = 'fp-tools-popup fpt-menu-shell';
    toolsPopup.innerHTML = `
        <div class="fp-tools-header" aria-label="Управление окном">
            <button type="button" class="close-btn" aria-label="Закрыть">
                <span class="close-btn__surface" aria-hidden="true">
                    <svg class="close-btn__icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.25 2.25L9.75 9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M9.75 2.25L2.25 9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </span>
            </button>
        </div>
        <div class="fp-tools-body">
            <nav class="fp-tools-nav">
                <div class="fpt-nav-brand">
                    <img class="fp-tools-brand-logo" data-icon="funcy-logo" width="44" height="44" alt="" draggable="false">
                    <span class="fpt-nav-brand-title">FunPay Funcy</span>
                    <button type="button" id="fptNavCollapse" class="fpt-nav-collapse" aria-label="Свернуть меню" title="Свернуть меню" aria-expanded="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m14.5 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
                <div class="fpt-nav-search">
                    <button type="button" id="fptNavSearchToggle" class="fpt-nav-search-ico" aria-label="Поиск функций" title="Поиск функций"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.7" stroke="currentColor" stroke-width="1.8"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
                    <input type="text" id="fptNavSearch" class="fpt-nav-search-input" placeholder="Поиск функций…" autocomplete="off" spellcheck="false">
                    <button type="button" id="fptNavSearchClear" class="fpt-nav-search-clear" aria-label="Очистить" title="Очистить">✕</button>
                    <div id="fptNavSearchResults" class="fpt-nav-search-results"></div>
                </div>
                <ul>
                    <li class="fp-nav-divider">Основное</li>
                    <li data-page="general"><a><span class="nav-icon material-symbols-rounded">settings</span><span>Отображение FunPay</span></a></li>
                    <li data-page="accounts"><a><span class="nav-icon material-symbols-rounded">group</span><span>Аккаунты</span></a></li>
                    <li data-page="needs"><a><span class="nav-icon material-symbols-rounded">tune</span><span>Элементы интерфейса</span></a></li>
                    <li data-page="telegram"><a><span class="nav-icon material-symbols-rounded">send</span><span>Уведомления и интеграции</span></a></li>
                    <li class="fp-nav-divider">Эксклюзив</li>
                    <li data-page="epic_nicks"><a><span class="nav-icon material-symbols-rounded">diamond</span><span>Оформление ника</span></a></li>
                    <li class="fp-nav-divider">Интерфейс</li>
                    <li data-page="theme"><a><span class="nav-icon material-symbols-rounded">palette</span><span>Темы</span></a></li>
                    <li data-page="effects"><a><span class="nav-icon material-symbols-rounded">auto_awesome</span><span>Эффекты</span></a></li>
                    <li class="fp-nav-divider">Чат и продажи</li>
                    <li data-page="global_chat"><a><span class="nav-icon material-symbols-rounded">forum</span><span>Чат сообщества</span></a></li>
                    <li data-page="templates"><a><span class="nav-icon material-symbols-rounded">description</span><span>Быстрые ответы</span></a></li>
                    <li data-page="auto_reply"><a><span class="nav-icon material-symbols-rounded">mark_chat_unread</span><span>Автоответчик</span></a></li>
                    <li data-page="auto_review"><a><span class="nav-icon material-symbols-rounded">reviews</span><span>Отзывы и бонусы</span></a></li>
                    <li data-page="auto_delivery"><a><span class="nav-icon material-symbols-rounded">bolt</span><span>Автовыдача</span></a></li>
                    <li class="fp-nav-divider">Торговля</li>
                    <li data-page="lot_io" class="active"><a><span class="nav-icon material-symbols-rounded">inventory_2</span><span>Управление лотами</span></a></li>
                    <li data-page="autobump"><a><span class="nav-icon material-symbols-rounded">rocket_launch</span><span>Автоподнятие</span></a></li>
                    <li data-page="blacklist"><a><span class="nav-icon material-symbols-rounded">block</span><span>Чёрный список</span></a></li>
                    <li class="fp-nav-divider">Финансы</li>
                    <li data-page="finance_hub"><a><span class="nav-icon material-symbols-rounded">payments</span><span>Обзор и аналитика</span></a></li>
                    <li data-page="piggy_banks"><a><span class="nav-icon material-symbols-rounded">savings</span><span>Копилки</span></a></li>
                    <li data-page="calculator"><a><span class="nav-icon material-symbols-rounded">calculate</span><span>Калькуляторы</span></a></li>
                    <li class="fp-nav-divider">Прочее</li>
                    <li data-page="overview"><a><span class="nav-icon material-symbols-rounded">movie</span><span>Справочник функций</span></a></li>
                    <li data-page="settings_io"><a><span class="nav-icon material-symbols-rounded">database</span><span>Перенос настроек</span></a></li>
                    <li data-page="tickets"><a><span class="nav-icon material-symbols-rounded">confirmation_number</span><span>Поддержка FunPay</span></a></li>
                    <li data-page="support"><a><span class="nav-icon material-symbols-rounded">favorite</span><span>Оценить расширение</span></a></li>
                </ul>
                <div class="fp-tools-nav-cloud"><img class="fp-tools-nav-cloud-img" data-icon="cloud" alt=""></div>
                <div class="fpt-nav-footer">
                    <ul class="fpt-nav-quick-actions" aria-label="Быстрые действия"></ul>
                    <button type="button" id="fptAccentBtn" class="fpt-accent-btn" title="Цвет акцента" aria-label="Цвет акцента"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.36-.6-.36-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/><circle cx="16.8" cy="12" r="1.1" fill="currentColor"/></svg><input type="color" id="fptAccentInput" class="fpt-accent-input" value="#1b75bb" aria-hidden="true" tabindex="-1"></button>
                </div>
            </nav>
            <main class="fp-tools-content">
                <div class="fp-tools-start-screen" id="fpToolsStartScreen" role="status" aria-live="polite" aria-hidden="true">
                    <span class="fp-tools-start-screen-icon material-symbols-rounded" aria-hidden="true">category</span>
                    <h2>Выберите категорию</h2>
                    <p>Откройте категорию слева, чтобы увидеть доступные инструменты.</p>
                </div>
                <div class="fp-tools-page-content" data-page="general">
                    <h3>Отображение FunPay</h3>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="hideBalanceCheckbox">
                        <label for="hideBalanceCheckbox" style="margin-bottom:0;"><span>Скрыть баланс</span></label>
                    </div>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="viewSellersPromoCheckbox">
                        <label for="viewSellersPromoCheckbox" style="margin-bottom:0;"><span>Отображение иконок промо-лотов</span></label>
                    </div>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fptShowCommissionCheckbox">
                        <label for="fptShowCommissionCheckbox" style="margin-bottom:0;"><span>Показывать комиссию разделов</span></label>
                    </div>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fptShowRealPricesCheckbox">
                        <label for="fptShowRealPricesCheckbox" style="margin-bottom:0;"><span>Показывать реальные цены лотов</span></label>
                    </div>
                    <div class="support-promo">
                        <span class="nav-icon material-symbols-rounded">favorite</span>
                        <span>Понравился FunPay Funcy? <a href="#" data-nav-to="support">Оценить расширение</a> в быстрых действиях меню.</span>
                    </div>
                    
                    <h3 style="margin-top: 30px;">Заказы и статистика</h3>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fpToolsBuyerHistory" checked>
                        <label for="fpToolsBuyerHistory" style="margin-bottom:0;"><span>Показывать историю покупок в чате</span></label>
                    </div>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fpToolsShowUnconfirmed" checked>
                        <label for="fpToolsShowUnconfirmed" style="margin-bottom:0;"><span>Показывать сумму неподтверждённых заказов</span></label>
                    </div>

                    <h3 style="margin-top: 30px;">Метка FunPay Funcy</h3>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fptIdentifierEnabled" checked>
                        <label for="fptIdentifierEnabled" style="margin-bottom:0;"><span>Показывать метку «FunPay Funcy» рядом с ником собеседника</span></label>
                    </div>
                    <p class="template-info">При включении к исходящим сообщениям добавляется невидимый символ. Если собеседник тоже использует FunPay Funcy — рядом с его ником появится пометка. Символ не виден обычным пользователям. Не добавляется в ссылки и скопированный текст.</p>

                    <div class="support-promo" style="background: rgba(255, 152, 0, 0.1); border-color: rgba(255, 152, 0, 0.3); margin-top: 15px;">
                        <span class="nav-icon material-symbols-rounded" style="color: #ff9800;">warning</span>
                        <span>Для корректной работы расширения рекомендуется использовать FunPay на <strong>русском языке</strong>, так как большинство функций не будут работать на других языках.</span>
                    </div>
                </div> <!-- КОНЕЦ ВКЛАДКИ "ОБЩИЕ" -->

                <!-- НАЧАЛО ВКЛАДКИ "ЭПИЧЕСКИЕ НИКИ" -->
                <div class="fp-tools-page-content" data-page="epic_nicks">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Оформление ника <span class="material-symbols-rounded" style="vertical-align:-3px;color:var(--fptm-accent, #4a9fd4);">diamond</span></h3>
                    </div>
                    <p class="template-info" style="font-size: 14px; line-height: 1.5;">
                        Выделитесь среди конкурентов! Ваш никнейм будет светиться, переливаться и излучать частицы <b>у всех пользователей расширения FunPay Funcy</b> (более 15 000 человек).
                    </p>

                    <div style="background: var(--fptm-accent-soft, rgba(27,117,187,0.1)); border: 1px solid var(--fptm-accent-border, rgba(27,117,187,0.3)); border-radius: 12px; padding: 18px; margin-bottom: 25px; box-shadow: 0 4px 15px var(--fptm-shadow, rgba(0,0,0,0.2));">
                        <div style="font-size: 15px; margin-bottom: 12px; color: var(--fptm-text, #16181d);">Приобрести уникальный стиль можно навсегда по очень низкой цене.</div>
                        <div style="font-size: 13px; color: var(--fptm-muted, #a0a0a0); margin-bottom: 15px;">Сервис оформления уникального ника будет доступен после публикации нового официального адреса FunPay Funcy.</div>
                    </div>

                    <h4 style="margin-bottom: 15px;">Вот несколько примеров для того, чтобы вы посмотрели, как это будет выглядеть у всех пользователей расширения:</h4>
                    <div id="fpt-epic-previews-container" style="display: flex; flex-direction: column; gap: 30px; margin-top: 10px; background:var(--fptm-surface-2, #0e0f16); border: 1px solid var(--fptm-border, #1e2030); border-radius: 8px; padding: 20px;">
                        <div style="text-align: center; color: var(--fptm-faint, #5a5f7a); font-size: 12px;">Загрузка движка частиц...</div>
                    </div>
                </div> <!-- КОНЕЦ ВКЛАДКИ "ЭПИЧЕСКИЕ НИКИ" -->

                <!-- НАЧАЛО ВКЛАДКИ "АККАУНТЫ" -->
                <div class="fp-tools-page-content" data-page="accounts">
                    <h3>Управление аккаунтами</h3>
                    <p class="template-info">Добавьте текущий аккаунт в список, чтобы быстро переключаться между профилями без ввода пароля.</p>
                    <div class="support-promo" style="background: rgba(27,117,187,0.08); border-color: rgba(27,117,187,0.25); margin-bottom: 20px;">
                        <span class="nav-icon material-symbols-rounded" style="color: #1b75bb;">info</span>
                        <span>Нажмите «+ Добавить текущий аккаунт» для каждого профиля. Переключение происходит мгновенно без ввода паролей.</span>
                    </div>
                    <button id="addCurrentAccountBtn" class="btn">+ Добавить текущий аккаунт</button>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:22px;margin-bottom:10px;">
                        <h4 style="margin:0;">Сохраненные аккаунты:</h4>
                        <button id="fptRefreshAccountsBtn" class="btn btn-default" style="padding:4px 10px;font-size:12px;" title="Обновить баланс, аватары и непрочитанные">
                            <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;">refresh</span> Обновить
                        </button>
                    </div>
                    <div id="fpToolsAccountsList"></div>
                </div>
                <div class="fp-tools-page-content" data-page="needs">
                    <h3>Элементы интерфейса</h3>
                    <p class="template-info">Здесь можно отключить отдельные кнопки и блоки, которые расширение добавляет на страницы FunPay. Найдите элемент по месту или задаче, посмотрите предпросмотр и снимите галочку. ИИ поможет подобрать элементы по описанию и покажет список для подтверждения. Изменения применяются сразу. Функции со своими переключателями (темы, авто-поднятие, эффекты курсора, метка рядом с ником и другие настройки) отключаются в своих разделах.</p>

                    <div class="fpt-needs-ai-box">
                        <textarea id="fptNeedsInput" placeholder="Например: «убери ИИ-кнопку и счётчик символов в чате, не нужна кнопка Прочитать все и пункт Добавить в ЧС»" rows="3"></textarea>
                        <button id="fptNeedsAskBtn" class="btn"><span class="material-symbols-rounded" style="font-size:18px;vertical-align:-4px;margin-right:6px;">auto_awesome</span>Понять и подобрать</button>
                    </div>

                    <div id="fptNeedsAiResult" class="fpt-needs-ai-result" style="display:none;"></div>

                    <div class="fpt-needs-manual">
                        <div class="fpt-needs-manual-head">
                            <h4 style="margin:0;">Элементы, которые можно отключить</h4>
                            <input type="text" id="fptNeedsFilter" class="fpt-needs-filter" placeholder="Поиск по элементу, месту или задаче…">
                        </div>
                        <p class="template-info" style="margin-top:6px;">Галочка = элемент показывается. Снимите галочку, чтобы убрать его со страниц - сохраняется и применяется сразу, без перезагрузки и без кнопки «применить». Нажмите <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;color:#4a9fd4;">visibility</span>, чтобы увидеть, как элемент выглядит.</p>
                        <div id="fptNeedsList" class="fpt-needs-list"></div>
                        <div class="fpt-needs-footer">
                            <span class="fpt-needs-autosave-note"><span class="material-symbols-rounded">bolt</span>Изменения сохраняются автоматически</span>
                            <span id="fptNeedsStatus" class="fpt-needs-status"></span>
                        </div>
                    </div>
                </div>

                <!-- НАЧАЛО ВКЛАДКИ "TELEGRAM" -->
                <div class="fp-tools-page-content" data-page="telegram">
                    <h3>Уведомления и интеграции</h3>
                    <p class="template-info">Настройте звуковые уведомления в браузере, Telegram-бота и уведомления Discord.</p>
                    <div class="fpt-notification-tabs" role="tablist" aria-label="Каналы уведомлений" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
                        <button type="button" id="fptNotificationBrowserTab" class="btn btn-default" role="tab" aria-selected="false" aria-controls="fptNotificationBrowserPane" tabindex="-1" data-notification-mode="browser">В браузере</button>
                        <button type="button" id="fptNotificationTelegramTab" class="btn btn-default active" role="tab" aria-selected="true" aria-controls="fptNotificationTelegramPane" tabindex="0" data-notification-mode="telegram">Telegram</button>
                        <button type="button" id="fptNotificationDiscordTab" class="btn btn-default" role="tab" aria-selected="false" aria-controls="fptNotificationDiscordPane" tabindex="-1" data-notification-mode="discord">Discord</button>
                    </div>
                    <section id="fptNotificationBrowserPane" data-notification-pane="browser" role="tabpanel" aria-labelledby="fptNotificationBrowserTab" aria-hidden="true" hidden>
                        <h3>Звук уведомления в браузере</h3>
                        <div class="fp-tools-radio-group" id="notificationSoundGroup">
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="default" checked><span>Стандартный</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="vk"><span>VK</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="tg"><span>Telegram</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="iphone"><span>iPhone</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="discord"><span>Discord</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="whatsapp"><span>WhatsApp</span></label>
                            <label class="fp-tools-radio-option"><input type="radio" name="notificationSound" value="custom"><span>Своя мелодия</span></label>
                        </div>

                        <!-- Загрузка своей мелодии + обрезка до 5 секунд -->
                        <div id="fptCustomSoundBlock" style="margin-top:12px;background:var(--fptm-surface-2, #0e0f16);border:1px solid var(--fptm-border, #1e2030);border-radius:10px;padding:14px;display:none;">
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                <button id="fptCustomSoundUploadBtn" class="btn btn-default" style="padding:6px 12px;font-size:13px;">
                                    <span class="material-symbols-rounded" style="font-size:16px;vertical-align:-3px;margin-right:5px;">upload_file</span>Выбрать аудио
                                </button>
                                <input type="file" id="fptCustomSoundInput" accept="audio/*" style="display:none;">
                                <span id="fptCustomSoundFileName" style="font-size:12px;color:var(--fptm-muted, #9099b8);">Файл не выбран</span>
                            </div>
                            <p class="template-info" style="margin-top:10px;">Можно выбрать любые <span class="fpt-sec-spin"><input type="text" id="fptClipSeconds" value="5" inputmode="numeric" maxlength="1"><span class="fpt-sec-spin-btns"><button type="button" id="fptClipSecUp" tabindex="-1">▲</button><button type="button" id="fptClipSecDown" tabindex="-1">▼</button></span></span> сек. из вашего трека: перетащите выделение по дорожке, прослушайте и сохраните. Уведомление будет проигрывать именно этот отрезок.</p>

                            <div id="fptCustomSoundEditor" style="display:none;margin-top:8px;">
                                <div id="fptWaveWrap" style="position:relative;height:64px;background:var(--fptm-surface-2, #070810);border:1px solid var(--fptm-border, #22253a);border-radius:8px;overflow:hidden;user-select:none;cursor:pointer;">
                                    <canvas id="fptWaveCanvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
                                    <div id="fptWaveSel" style="position:absolute;top:0;bottom:0;background:rgba(27,117,187,0.22);border-left:2px solid #1b75bb;border-right:2px solid #1b75bb;box-sizing:border-box;"></div>
                                    <div id="fptWavePlayhead" style="position:absolute;top:0;bottom:0;width:2px;background:#ffd24a;display:none;"></div>
                                    <div id="fptWaveSelHandleL" style="position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;cursor:ew-resize;"></div>
                                    <div id="fptWaveSelHandleR" style="position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;cursor:ew-resize;"></div>
                                </div>
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:10px;flex-wrap:wrap;">
                                    <span id="fptCustomSoundRange" style="font-size:11px;color:var(--fptm-faint, #5a5f7a);">0:00 - 0:05</span>
                                    <div style="display:flex;gap:8px;align-items:center;">
                                        <button id="fptCustomSoundPreviewBtn" class="fpt-icon-play-btn" title="Прослушать отрезок">
                                            <span class="material-symbols-rounded">play_arrow</span>
                                        </button>
                                        <button id="fptCustomSoundSaveBtn" class="btn" style="padding:5px 14px;font-size:12px;">Сохранить мелодию</button>
                                    </div>
                                </div>
                            </div>
                            <div id="fptCustomSoundSaved" style="display:none;margin-top:10px;font-size:12px;color:#4caf82;">
                                <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;">check_circle</span>
                                Сохранена своя мелодия (<span id="fptCustomSoundSavedLen">5.0</span> сек).
                            </div>
                        </div>
                        <div class="template-container" style="margin-top:14px;">
                            <div class="range-label" style="display:flex;align-items:center;justify-content:space-between;">
                                <label for="notificationVolume" style="margin:0;">Громкость уведомлений:</label>
                                <span id="notificationVolumeValue">100%</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
                                <input type="range" id="notificationVolume" min="0" max="100" step="1" value="100" style="flex:1;">
                                <button id="previewNotificationBtn" class="fpt-icon-play-btn" title="Прослушать"><span class="material-symbols-rounded">play_arrow</span></button>
                            </div>
                        </div>
                    </section>

                    <section id="fptNotificationTelegramPane" data-notification-pane="telegram" role="tabpanel" aria-labelledby="fptNotificationTelegramTab" aria-hidden="false">
                    <h3>Уведомления и интеграции</h3>
                    <p class="template-info">Управляйте FunPay Funcy и получайте уведомления (новые заказы и сообщения) прямо в Telegram-боте. Создайте бота, вставьте токен — и всё работает.</p>

                    <div class="support-promo" style="background:rgba(27,117,187,0.08);border-color:rgba(27,117,187,0.25);margin-bottom:16px;">
                        <span class="nav-icon material-symbols-rounded" style="color:#1b75bb;">info</span>
                        <span>Как настроить: 1) создайте бота через <b>@BotFather</b> и скопируйте токен; 2) <b>напишите своему боту любое сообщение</b> в Telegram; 3) вставьте токен ниже и нажмите «Подключить».</span>
                    </div>

                    <div class="support-promo" style="background:rgba(240,160,64,0.08);border-color:rgba(240,160,64,0.3);margin-bottom:16px;">
                        <span class="nav-icon material-symbols-rounded" style="color:#f0a040;">warning</span>
                        <span>Важно: в некоторых странах доступ к Telegram ограничен или блокируется - если вы находитесь в такой стране, не удивляйтесь ошибкам подключения, таймаутам или «вечному ожиданию» сообщений, это связано с ограничениями сети, а не с расширением. Также у части пользователей бот может работать нестабильно (периодические ошибки, задержки, зависание ответов) даже без блокировок Telegram - причины бывают на стороне Telegram или провайдера. Если у вас так - это известное поведение, попробуйте переподключить бота позже.</span>
                    </div>

                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="fptTgEnabled">
                        <label for="fptTgEnabled" style="margin-bottom:0;"><span><b>Включить интеграцию с Telegram</b></span></label>
                    </div>

                    <div id="fptTgConfig" style="margin-top:10px;">
                        <label for="fptTgToken" style="margin-top:6px;">Токен бота:</label>
                        <input type="text" id="fptTgToken" class="template-input" placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false">
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <button id="fptTgConnectBtn" class="btn" style="flex:1;">Подключить</button>
                            <button id="fptTgTestBtn" class="btn btn-default" style="flex:1;">Тест уведомления</button>
                        </div>
                        <div id="fptTgStatus" style="font-size:12px;margin-top:8px;color:var(--fptm-muted, #9099b8);"></div>

                        <label for="fptTgChatId" style="margin-top:14px;">Chat ID (определяется автоматически):</label>
                        <input type="text" id="fptTgChatId" class="template-input" placeholder="Будет заполнено после «Подключить»" autocomplete="off" spellcheck="false">

                        <h4 style="margin-top:22px;">Уведомления</h4>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="fptTgNotifyOrders" checked>
                            <label for="fptTgNotifyOrders" style="margin-bottom:0;"><span>Новые заказы</span></label>
                        </div>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="fptTgNotifyMessages" checked>
                            <label for="fptTgNotifyMessages" style="margin-bottom:0;"><span>Новые сообщения в чатах</span></label>
                        </div>

                        <h4 style="margin-top:22px;">Управление из бота</h4>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="fptTgAllowControl" checked>
                            <label for="fptTgAllowControl" style="margin-bottom:0;"><span>Разрешить команды управления из бота</span></label>
                        </div>

                        <p class="template-info" style="margin-top:12px;margin-bottom:8px;">Команды бота (принимаются только из вашего чата):</p>
                        <ul class="fpt-tg-cmd-list">
                            <li><code>/status</code><span>баланс и статус</span></li>
                            <li><code>/chats</code><span>непрочитанные чаты</span></li>
                            <li><code>/sales</code><span>статистика продаж</span></li>
                            <li><code>/online</code><span>поддержать онлайн</span></li>
                            <li><code>/help</code><span>список команд</span></li>
                        </ul>
                    </div>
                    </section>

                    <section id="fptNotificationDiscordPane" data-notification-pane="discord" role="tabpanel" aria-labelledby="fptNotificationDiscordTab" aria-hidden="true" hidden>
                        <h3>Уведомления в Discord</h3>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="discordLogEnabled">
                            <label for="discordLogEnabled" style="margin-bottom:0;"><span>Включить уведомления о новых сообщениях</span></label>
                        </div>
                        <div id="discordSettingsContainer">
                            <label for="discordWebhookUrl" style="margin-top: 10px;">Webhook URL:</label>
                            <input type="text" id="discordWebhookUrl" class="template-input" placeholder="Вставьте ссылку на вебхук вашего Discord канала">
                            <div class="checkbox-label-inline" style="margin-top:10px;"><input type="checkbox" id="discordPingEveryone"><label for="discordPingEveryone" style="margin-bottom:0;"><span>Пинговать @everyone</span></label></div>
                            <div class="checkbox-label-inline"><input type="checkbox" id="discordPingHere"><label for="discordPingHere" style="margin-bottom:0;"><span>Пинговать @here</span></label></div>
                        </div>
                    </section>
                </div>
                <!-- КОНЕЦ ВКЛАДКИ "TELEGRAM" -->
                <div class="fp-tools-page-content" data-page="templates">
                    <h3>Быстрые ответы</h3>
                    <div class="fpt-quick-replies-tabs" role="tablist" aria-label="Режимы быстрых ответов">
                        <button type="button" id="fptQuickRepliesTemplatesTab" class="btn btn-default" role="tab" aria-selected="true" aria-controls="fptQuickRepliesTemplatesPane" tabindex="0" data-quick-replies-mode="templates">Шаблоны</button>
                        <button type="button" id="fptQuickRepliesCommandsTab" class="btn btn-default" role="tab" aria-selected="false" aria-controls="fptQuickRepliesCommandsPane" tabindex="-1" data-quick-replies-mode="commands">Команды</button>
                    </div>
                    <div id="fptQuickRepliesTemplatesPane" data-quick-replies-pane="templates" role="tabpanel" aria-labelledby="fptQuickRepliesTemplatesTab">
                    <h3>Настройки шаблонов</h3>
                    <div class="checkbox-label-inline"><input type="checkbox" id="templatesEnabled" checked><label for="templatesEnabled" style="margin-bottom:0;"><span><b>Включить шаблоны</b></span></label></div>
                    <div class="checkbox-label-inline" style="margin-top:8px;"><input type="checkbox" id="sendTemplatesImmediately"><label for="sendTemplatesImmediately" style="margin-bottom:0;"><span>Отправлять шаблоны сразу по клику</span></label></div>

                    <div id="fpt-templates-config">
                    <label style="margin-top:10px;display:block;">Расположение кнопок:</label>
                    <div class="fpt-pos-grid">
                        <label class="fpt-pos-card"><input type="radio" name="templatePos" value="above"><span class="fpt-pos-ico"><span class="fpt-pos-row"></span><span class="fpt-pos-field"></span></span><span class="fpt-pos-name">Над полем</span></label>
                        <label class="fpt-pos-card"><input type="radio" name="templatePos" value="bottom" checked><span class="fpt-pos-ico"><span class="fpt-pos-field"></span><span class="fpt-pos-row"></span></span><span class="fpt-pos-name">Под полем</span></label>
                        <label class="fpt-pos-card"><input type="radio" name="templatePos" value="sidebar_top"><span class="fpt-pos-ico fpt-pos-ico-side"><span class="fpt-pos-panel fpt-pos-panel-top"><span class="fpt-pos-srow"></span><span class="fpt-pos-srow"></span></span><span class="fpt-pos-sfield"></span></span><span class="fpt-pos-name">В панели сверху</span></label>
                        <label class="fpt-pos-card"><input type="radio" name="templatePos" value="sidebar_bottom"><span class="fpt-pos-ico fpt-pos-ico-side"><span class="fpt-pos-panel fpt-pos-panel-bottom"><span class="fpt-pos-srow"></span><span class="fpt-pos-srow"></span></span><span class="fpt-pos-sfield"></span></span><span class="fpt-pos-name">В панели снизу</span></label>
                        <label class="fpt-pos-card"><input type="radio" name="templatePos" value="popover"><span class="fpt-pos-ico fpt-pos-ico-pop"><span class="fpt-pos-field"></span><span class="fpt-pos-pop-btn"></span></span><span class="fpt-pos-name">Меню у скрепки</span></label>
                    </div>
                    <p class="template-info" id="fpt-popover-hint" style="margin-top:6px;display:none;">«Меню у скрепки»: слева от кнопки прикрепления файла появится отдельная кнопка с иконкой шаблонов. По клику открывается компактное меню со всеми шаблонами и быстрым переходом в эти настройки.</p>

                    <h3>Внешний вид кнопок</h3>
                    <div class="fpt-appx">
                        <div class="fpt-appx-grid">
                            <div class="fpt-appx-block">
                                <div class="fpt-appx-cap">Форма</div>
                                <div class="fpt-seg" data-fpt-opt="shape">
                                    <button type="button" data-val="rounded" title="Скруглённые"><span class="fpt-shape-prev" style="border-radius:5px;"></span></button>
                                    <button type="button" data-val="pill" title="Капсула"><span class="fpt-shape-prev" style="border-radius:999px;"></span></button>
                                    <button type="button" data-val="square" title="Прямые углы"><span class="fpt-shape-prev" style="border-radius:1px;"></span></button>
                                </div>
                            </div>
                            <div class="fpt-appx-block">
                                <div class="fpt-appx-cap">Размер</div>
                                <div class="fpt-seg" data-fpt-opt="size">
                                    <button type="button" data-val="s" title="Маленький"><span class="fpt-az" style="font-size:11px;">Aa</span></button>
                                    <button type="button" data-val="m" title="Средний"><span class="fpt-az" style="font-size:14px;">Aa</span></button>
                                    <button type="button" data-val="l" title="Большой"><span class="fpt-az" style="font-size:17px;">Aa</span></button>
                                </div>
                            </div>
                        </div>

                        <div class="fpt-appx-block">
                            <div class="fpt-appx-cap">Заливка</div>
                            <div class="fpt-seg fpt-seg-fill" data-fpt-opt="fill">
                                <button type="button" data-val="solid" title="Сплошная"><span class="fpt-fill-prev" style="background:#1b75bb;"></span><span class="fpt-fill-name">Сплошная</span></button>
                                <button type="button" data-val="soft" title="Мягкая"><span class="fpt-fill-prev" style="background:rgba(27,117,187,.28);"></span><span class="fpt-fill-name">Мягкая</span></button>
                                <button type="button" data-val="outline" title="Контур"><span class="fpt-fill-prev" style="background:transparent;border:2px solid #1b75bb;"></span><span class="fpt-fill-name">Контур</span></button>
                                <button type="button" data-val="ghost" title="Призрачная"><span class="fpt-fill-prev" style="background:transparent;border:1px dashed #1b75bb;"></span><span class="fpt-fill-name">Призрак</span></button>
                            </div>
                        </div>

                        <div class="fpt-appx-block fpt-align-block" id="fpt-align-block">
                            <div class="fpt-appx-cap">Выравнивание текста</div>
                            <div class="fpt-seg" data-fpt-opt="align">
                                <button type="button" data-val="left" title="Слева"><span class="material-symbols-rounded">format_align_left</span></button>
                                <button type="button" data-val="center" title="По центру"><span class="material-symbols-rounded">format_align_center</span></button>
                                <button type="button" data-val="right" title="Справа"><span class="material-symbols-rounded">format_align_right</span></button>
                            </div>
                            <div class="fpt-align-hint">Доступно при включённом «На всю ширину»</div>
                        </div>

                        <div class="fpt-appx-block">
                            <div class="fpt-appx-cap">Дополнительно</div>
                            <div class="fpt-appx-toggles">
                                <button type="button" class="fpt-chip-toggle" data-fpt-toggle="fullWidth"><span class="material-symbols-rounded">width_full</span><span>На всю ширину</span></button>
                                <button type="button" class="fpt-chip-toggle" data-fpt-toggle="compact"><span class="material-symbols-rounded">density_small</span><span>Компактно</span></button>
                                <button type="button" class="fpt-chip-toggle" data-fpt-toggle="uppercase"><span class="material-symbols-rounded">text_fields</span><span>ЗАГЛАВНЫЕ</span></button>
                                <button type="button" class="fpt-chip-toggle" data-fpt-toggle="showPreview"><span class="material-symbols-rounded">preview</span><span>Превью при наведении</span></button>
                            </div>
                        </div>

                        <!-- Доп. настройки, видимые только для «в панели» -->
                        <div class="fpt-appx-block fpt-sidebar-only" id="fpt-sidebar-extra">
                            <div class="fpt-appx-cap">Компактность панели</div>
                            <div class="fpt-seg" data-fpt-opt="sidebarDensity">
                                <button type="button" data-val="cozy" title="Просторно">Просторно</button>
                                <button type="button" data-val="normal" title="Обычно">Обычно</button>
                                <button type="button" data-val="dense" title="Плотно">Плотно</button>
                            </div>
                            <div class="fpt-appx-cap" style="margin-top:10px;">Раскладка</div>
                            <div class="fpt-seg" data-fpt-opt="sidebarLayout">
                                <button type="button" data-val="flow" title="Авто-сетка (по ширине)">Авто-сетка</button>
                                <button type="button" data-val="list" title="Список (в столбик)">Список</button>
                            </div>
                            <div class="fpt-align-hint" style="display:block;color:#6b7194;">«Авто-сетка» умно раскладывает кнопки по ширине панели, как на скрине.</div>
                        </div>

                        <div class="fpt-appx-block">
                            <div class="fpt-appx-cap">Живой предпросмотр</div>
                            <div id="fpt-appearance-preview" class="chat-buttons-container" data-fpt-shape="rounded" data-fpt-size="m" data-fpt-fill="solid" data-fpt-align="center" data-fpt-fullwidth="0" data-fpt-uppercase="0" data-fpt-compact="0">
                                <button type="button" class="chat-template-btn" style="background-color:var(--fpt-accent,#1b75bb);--btn-color:var(--fpt-accent,#1b75bb);">Приветствие</button>
                                <button type="button" class="chat-template-btn" style="background-color:#FF6B6B;--btn-color:#FF6B6B;">Спасибо за заказ</button>
                                <button type="button" class="custom-chat-template-btn" style="background-color:var(--fpt-accent,#1b75bb);--btn-color:var(--fpt-accent,#1b75bb);">Свой шаблон</button>
                            </div>
                        </div>
                    </div>
                    </div>

                    <h3>Редактор шаблонов</h3>
                     <p class="template-info">Кликните на название или текст шаблона, чтобы его изменить. Все изменения сохраняются автоматически.</p>
                     
                     <div class="template-variables-guide">
                        <h5>Справка по переменным</h5>
                        <ul class="variables-list">
                            <li><span class="variable-code">{buyername}</span> - Имя покупателя в текущем чате.</li>
                            <li><span class="variable-code">{lotname}</span> - Название товара, который обсуждается в чате.</li>
                            <li><span class="variable-code">{welcome}</span> - "Доброе утро!", "Добрый день!" или "Добрый вечер!" в зависимости от времени.</li>
                            <li><span class="variable-code">{date}</span> - Текущая дата и время (например, 25.12.2025 14:30).</li>
                            <li><span class="variable-code">{bal}</span> - Ваш текущий баланс на FunPay.</li>
                            <li><span class="variable-code">{activesells}</span> - Количество ваших активных продаж.</li>
                            <li><span class="variable-code">{ai: ваш запрос}</span> - Вставляет текст, сгенерированный ИИ на основе вашего запроса. 
                                <br><em>Пример: <code>{ai: вежливо поблагодари за покупку}</code></em>
                            </li>
                        </ul>
                     </div>
                     
                     <div class="template-info image-upload-warning">
                        <span class="nav-icon material-symbols-rounded">image</span>
                        <span><b>Изображения в шаблонах:</b> Нажмите кнопку с иконкой изображения под текстом, чтобы прикрепить картинку. Появится плашка «Прикреплённое изображение» - нажмите на неё, чтобы выбрать порядок отправки (сначала текст, потом картинка - или наоборот). При отправке шаблона всё уйдёт в чат автоматически.</span>
                     </div>

                    <div id="template-settings-container" class="template-settings-list"></div>
                    <button id="addCustomTemplateBtn" class="btn" style="margin-top: 10px;">+ Добавить свой шаблон</button>
                    </div>
                    <div id="fptQuickRepliesCommandsPane" data-quick-replies-pane="commands" role="tabpanel" aria-labelledby="fptQuickRepliesCommandsTab" hidden>
                        <h3>Команды</h3>
                        <p class="template-info">Свои быстрые ответы для поля чата. Вы задаёте команду (например <code>/привет</code>) и её ответ (например «Привет, я тут. Какие вопросы?»). В чате начинаете печатать команду - <code>/при</code> - появляется подсказка; нажимаете Tab или Enter, и команда сразу превращается в полный текст ответа. Удобно для приветствий, реквизитов, частых фраз.</p>

                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="fptSlashEnabled" checked>
                            <label for="fptSlashEnabled" style="margin-bottom:0;"><span><b>Включить слэш-команды</b></span></label>
                        </div>

                        <div id="fptSlashConfig">
                            <div class="checkbox-label-inline" style="margin-top:8px;">
                                <input type="checkbox" id="fptSlashAutocomplete" checked>
                                <label for="fptSlashAutocomplete" style="margin-bottom:0;"><span>Показывать выпадающую подсказку при вводе</span></label>
                            </div>

                            <label style="display:block;margin-top:14px;margin-bottom:6px;font-size:13px;">Чем разворачивать команду:</label>
                            <div class="fp-tools-radio-group" id="fptSlashKeyGroup">
                                <label class="fp-tools-radio-option"><input type="radio" name="fptSlashKey" value="both" checked><span>Tab или Enter</span></label>
                                <label class="fp-tools-radio-option"><input type="radio" name="fptSlashKey" value="tab"><span>Только Tab</span></label>
                                <label class="fp-tools-radio-option"><input type="radio" name="fptSlashKey" value="enter"><span>Только Enter</span></label>
                            </div>

                            <div class="support-promo" style="background:rgba(27,117,187,0.07);border-color:rgba(27,117,187,0.2);margin:16px 0;">
                                <span class="material-symbols-rounded" style="font-size:16px;color:#f4c84a;vertical-align:-3px;">lightbulb</span>
                                <span>Переменные в ответе: <code>{buyername}</code> - имя собеседника, <code>{date}</code>, <code>{time}</code>.</span>
                            </div>

                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                                <h4 style="margin:0;">Мои команды</h4>
                                <button id="fptSlashAddBtn" class="btn btn-default" style="padding:5px 12px;font-size:13px;">+ Добавить команду</button>
                            </div>
                            <div id="fptSlashList"></div>
                        </div>
                    </div>
                </div>

                <div class="fp-tools-page-content" data-page="auto_review">
                    <h3>Ответы на отзывы</h3>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="autoReviewEnabled">
                        <label for="autoReviewEnabled" style="margin-bottom:0;"><span>Включить автоматический ответ на отзывы</span></label>
                    </div>
                    <p class="template-info">Расширение будет автоматически отвечать на новые отзывы, используя заданные шаблоны. Ответ не будет отправлен, если вы уже ответили вручную.</p>
                    <div class="template-variables-guide" style="margin-bottom: 15px;">
                        <h5>Переменные в ответах на отзывы</h5>
                        <ul class="variables-list">
                            <li><span class="variable-code">{buyername}</span> - Имя покупателя.</li>
                            <li><span class="variable-code">{lotname}</span> - Название купленного товара.</li>
                            <li><span class="variable-code">{orderid}</span> - Номер заказа.</li>
                            <li><span class="variable-code">{orderlink}</span> - Ссылка на заказ.</li>
                            <li><span class="variable-code">{date}</span> - Текущая дата.</li>
                            <li><span class="variable-code">{welcome}</span> - Приветствие по времени суток.</li>
                        </ul>
                    </div>
                    <div class="review-templates-grid">
                        <div class="template-container">
                            <label for="fpt-review-5" class="fpt-stars"><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span></label>
                            <textarea id="fpt-review-5" class="template-input" placeholder="Шаблон для 5 звёзд"></textarea>
                        </div>
                        <div class="template-container">
                            <label for="fpt-review-4" class="fpt-stars"><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span></label>
                            <textarea id="fpt-review-4" class="template-input" placeholder="Шаблон для 4 звёзд"></textarea>
                        </div>
                        <div class="template-container">
                            <label for="fpt-review-3" class="fpt-stars"><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span></label>
                            <textarea id="fpt-review-3" class="template-input" placeholder="Шаблон для 3 звёзд"></textarea>
                        </div>
                        <div class="template-container">
                            <label for="fpt-review-2" class="fpt-stars"><span class="material-symbols-rounded">star</span><span class="material-symbols-rounded">star</span></label>
                            <textarea id="fpt-review-2" class="template-input" placeholder="Шаблон для 2 звёзд"></textarea>
                        </div>
                        <div class="template-container">
                            <label for="fpt-review-1" class="fpt-stars"><span class="material-symbols-rounded">star</span></label>
                            <textarea id="fpt-review-1" class="template-input" placeholder="Шаблон для 1 звезды"></textarea>
                        </div>
                    </div>
                    
                    <h3>Бонус за отзыв</h3>
                    <div class="checkbox-label-inline">
                        <input type="checkbox" id="bonusForReviewEnabled">
                        <label for="bonusForReviewEnabled" style="margin-bottom:0;"><span>Отправлять бонус в чат за отзыв 5 <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-2px;color:#f4c84a;">star</span></span></label>
                    </div>
                    <p class="template-info">Если покупатель оставит отзыв 5 звёзд, ему в чат будет автоматически отправлено сообщение с бонусом. Ничего не будет отправлено за оценки ниже 5 звёзд.</p>
                    <div class="fp-tools-radio-group" id="bonusModeSelector">
                        <label class="fp-tools-radio-option"><input type="radio" name="bonusMode" value="single" checked><span>Один бонус</span></label>
                        <label class="fp-tools-radio-option"><input type="radio" name="bonusMode" value="random"><span>Случайный из списка</span></label>
                    </div>
                    <div id="singleBonusContainer" class="template-container">
                        <textarea id="singleBonusText" class="template-input" placeholder="Текст вашего бонуса..."></textarea>
                    </div>
                    <div id="randomBonusContainer" class="template-container" style="display: none;">
                        <div id="bonus-list-container" class="bonus-list"></div>
                        <div class="bonus-add-form">
                            <textarea id="newBonusText" placeholder="Текст нового бонуса для списка..."></textarea>
                            <button id="addBonusBtn" class="btn btn-default">Добавить бонус в список</button>
                        </div>
                    </div>
                    <div class="template-container" style="margin-top:8px;">
                        <label for="bonusForReviewDelaySec" style="display:block;margin-bottom:4px;">Задержка перед отправкой бонуса (сек)</label>
                        <input type="number" id="bonusForReviewDelaySec" class="template-input" min="0" max="60" step="1" value="4" style="max-width:120px;">
                        <p class="template-info">Пауза между ответом на отзыв и сообщением с бонусом. Без паузы ответ на отзыв в некоторых случаях может не отправиться. Рекомендуется 3-5 секунд.</p>
                    </div>

                </div>

                <div class="fp-tools-page-content" data-page="auto_reply">
                    <header class="fpt-ui-page-header fp-ar-page-header">
                        <div class="fp-ar-page-header-copy">
                            <h3 class="fpt-ui-page-title fp-ar-page-title">Автоответчик</h3>
                            <p class="fpt-ui-helper fp-ar-page-description">Настройте сообщения для ключевых событий. Выключенные сценарии остаются компактными и не занимают место настройками.</p>
                        </div>
                    </header>

                    <details class="fp-ar-variables">
                        <summary class="fp-ar-variables-summary">
                            <span>Доступные переменные</span>
                            <span class="fp-ar-variables-chevron" aria-hidden="true"></span>
                        </summary>
                        <div class="fp-ar-variable-grid">
                            <div class="fp-ar-variable"><code>{buyername}</code><span>имя покупателя</span></div>
                            <div class="fp-ar-variable"><code>{orderid}</code><span>ID заказа</span></div>
                            <div class="fp-ar-variable"><code>{orderlink}</code><span>ссылка на заказ</span></div>
                            <div class="fp-ar-variable"><code>{lotname}</code><span>название лота</span></div>
                            <div class="fp-ar-variable"><code>$chat_name</code><span>имя чата, legacy</span></div>
                        </div>
                    </details>

                    <section class="fpt-ui-surface fp-ar-rule" data-fpt-ar-rule="greeting" aria-labelledby="fp-ar-greeting-title">
                        <div class="fp-ar-rule-header">
                            <label class="fp-ar-rule-copy" for="greetingEnabled">
                                <span id="fp-ar-greeting-title" class="fp-ar-rule-title">Приветствие новых покупателей</span>
                                <span class="fpt-ui-helper fp-ar-rule-description">Отправляется при первом подходящем сообщении покупателя.</span>
                            </label>
                            <div class="fp-ar-rule-control">
                                <span id="greetingRuleStatus" class="fp-ar-rule-status">Выключено</span>
                                <input type="checkbox" id="greetingEnabled" class="fp-ar-rule-toggle">
                            </div>
                        </div>
                        <div id="greetingRuleBody" class="fp-ar-rule-body" hidden>
                            <div class="fp-ar-editor-field">
                                <label class="fp-ar-field-label" for="greetingText">Текст приветствия</label>
                                <textarea id="greetingText" class="template-input fp-ar-textarea" placeholder="Здравствуйте, {buyername}! Чем могу помочь?"></textarea>
                                <div class="fp-ar-editor-actions" data-editor-actions-for="greetingText"></div>
                            </div>
                            <div class="fp-ar-subsettings">
                                <div class="fpt-ui-setting-row fp-ar-setting-row">
                                    <label class="fp-ar-setting-copy" for="onlyNewChats">
                                        <span class="fp-ar-setting-title">Только совсем новые чаты</span>
                                        <span class="fpt-ui-helper">Не отправлять приветствие в уже существующем диалоге.</span>
                                    </label>
                                    <input type="checkbox" id="onlyNewChats" class="fp-ar-setting-checkbox">
                                </div>
                                <div class="fpt-ui-setting-row fp-ar-setting-row">
                                    <label class="fp-ar-setting-copy" for="ignoreSystemMessages">
                                        <span class="fp-ar-setting-title">Игнорировать системные события</span>
                                        <span class="fpt-ui-helper">Не приветствовать из-за уведомлений о заказах и отзывах.</span>
                                    </label>
                                    <input type="checkbox" id="ignoreSystemMessages" class="fp-ar-setting-checkbox">
                                </div>
                                <div class="fpt-ui-setting-row fp-ar-setting-row fp-ar-cooldown-row">
                                    <label class="fp-ar-setting-copy" for="greetingCooldownDays">
                                        <span class="fp-ar-setting-title">Повторное приветствие</span>
                                        <span class="fpt-ui-helper">Через сколько дней можно поприветствовать покупателя снова. 0 — без кулдауна.</span>
                                    </label>
                                    <div class="fp-ar-number-field">
                                        <input type="number" id="greetingCooldownDays" min="0" max="365" value="0" class="fpt-ui-control fp-ar-number-input" inputmode="numeric" aria-label="Кулдаун приветствия в днях">
                                        <span>дн.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="fpt-ui-surface fp-ar-rule" data-fpt-ar-rule="new-order" aria-labelledby="fp-ar-new-order-title">
                        <div class="fp-ar-rule-header">
                            <label class="fp-ar-rule-copy" for="newOrderReplyEnabled">
                                <span id="fp-ar-new-order-title" class="fp-ar-rule-title">Ответ на новый заказ</span>
                                <span class="fpt-ui-helper fp-ar-rule-description">Сообщение после оплаты нового заказа.</span>
                            </label>
                            <div class="fp-ar-rule-control">
                                <span id="newOrderRuleStatus" class="fp-ar-rule-status">Выключено</span>
                                <input type="checkbox" id="newOrderReplyEnabled" class="fp-ar-rule-toggle">
                            </div>
                        </div>
                        <div id="newOrderRuleBody" class="fp-ar-rule-body" hidden>
                            <div class="fp-ar-editor-field">
                                <label class="fp-ar-field-label" for="newOrderReplyText">Сообщение покупателю</label>
                                <textarea id="newOrderReplyText" class="template-input fp-ar-textarea" placeholder="Спасибо за заказ, {buyername}! Ваш заказ: {orderlink}"></textarea>
                                <div class="fp-ar-editor-actions" data-editor-actions-for="newOrderReplyText"></div>
                            </div>
                        </div>
                    </section>

                    <section class="fpt-ui-surface fp-ar-rule" data-fpt-ar-rule="order-confirm" aria-labelledby="fp-ar-confirm-title">
                        <div class="fp-ar-rule-header">
                            <label class="fp-ar-rule-copy" for="orderConfirmReplyEnabled">
                                <span id="fp-ar-confirm-title" class="fp-ar-rule-title">Ответ при подтверждении заказа</span>
                                <span class="fpt-ui-helper fp-ar-rule-description">Сообщение после подтверждения заказа покупателем.</span>
                            </label>
                            <div class="fp-ar-rule-control">
                                <span id="orderConfirmRuleStatus" class="fp-ar-rule-status">Выключено</span>
                                <input type="checkbox" id="orderConfirmReplyEnabled" class="fp-ar-rule-toggle">
                            </div>
                        </div>
                        <div id="orderConfirmRuleBody" class="fp-ar-rule-body" hidden>
                            <div class="fp-ar-editor-field">
                                <label class="fp-ar-field-label" for="orderConfirmReplyText">Сообщение покупателю</label>
                                <textarea id="orderConfirmReplyText" class="template-input fp-ar-textarea" placeholder="{buyername}, спасибо за подтверждение заказа {orderid}!"></textarea>
                                <div class="fp-ar-editor-actions" data-editor-actions-for="orderConfirmReplyText"></div>
                            </div>
                        </div>
                    </section>

                    <section class="fpt-ui-surface fp-ar-rule" data-fpt-ar-rule="keywords" aria-labelledby="fp-ar-keywords-title">
                        <div class="fp-ar-rule-header">
                            <label class="fp-ar-rule-copy" for="keywordsEnabled">
                                <span id="fp-ar-keywords-title" class="fp-ar-rule-title">Ответы по ключевым словам</span>
                                <span class="fpt-ui-helper fp-ar-rule-description">Отвечать, когда сообщение точно совпадает с фразой или содержит её.</span>
                            </label>
                            <div class="fp-ar-rule-control">
                                <span id="keywordsRuleStatus" class="fp-ar-rule-status">Выключено</span>
                                <input type="checkbox" id="keywordsEnabled" class="fp-ar-rule-toggle">
                            </div>
                        </div>
                        <div id="keywordsRuleBody" class="fp-ar-rule-body" hidden>
                            <div id="keywords-list-container" class="keywords-list fp-ar-keywords-list"></div>
                            <div class="keyword-add-form fp-ar-keyword-form">
                                <div class="fp-ar-field-grid">
                                    <div class="fp-ar-field">
                                        <label class="fp-ar-field-label" for="newKeyword">Ключевое слово или фраза</label>
                                        <input type="text" id="newKeyword" class="fpt-ui-control fp-ar-keyword-input" placeholder="Например: когда доставка?">
                                    </div>
                                    <div class="fp-ar-field">
                                        <span class="fp-ar-field-label">Совпадение</span>
                                        <div class="fp-tools-radio-group fp-ar-match-modes">
                                            <label class="fp-tools-radio-option"><input type="radio" name="newKeywordMatchMode" value="exact" checked><span>Точное</span></label>
                                            <label class="fp-tools-radio-option"><input type="radio" name="newKeywordMatchMode" value="contains"><span>Содержит</span></label>
                                        </div>
                                    </div>
                                </div>
                                <div class="fp-ar-editor-field">
                                    <label class="fp-ar-field-label" for="newKeywordResponse">Ответ</label>
                                    <textarea id="newKeywordResponse" class="template-input fp-ar-textarea" placeholder="Текст ответа. Можно использовать {buyername}."></textarea>
                                    <div class="fp-ar-editor-actions" data-editor-actions-for="newKeywordResponse"></div>
                                </div>
                                <div class="fp-ar-keyword-form-actions">
                                    <button type="button" id="addKeywordBtn" class="fpt-ui-button fpt-ui-button--primary fp-ar-add-keyword-btn">Добавить правило</button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="fp-tools-page-content active" data-page="lot_io">
                    <header class="fpt-ui-page-header lot-io-header">
                        <div class="lot-io-header-copy">
                            <h3 class="fpt-ui-page-title lot-io-page-title">Управление лотами</h3>
                            <p class="fpt-ui-helper lot-io-page-description">Экспортируйте и восстанавливайте лоты, запускайте массовое редактирование и продолжайте отложенный импорт.</p>
                        </div>
                    </header>

                    <section class="fpt-ui-surface lot-io-card lot-io-export-card" aria-labelledby="lot-io-export-title">
                        <div class="lot-io-card-top">
                            <div class="lot-io-icon-tile" aria-hidden="true">
                                <svg class="lot-io-svg-icon" viewBox="0 0 24 24" fill="none" focusable="false">
                                    <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="lot-io-card-copy">
                                <h4 id="lot-io-export-title">Перенос лотов</h4>
                                <p class="lot-io-description">Создайте резервную копию лотов в JSON или восстановите её на другом аккаунте.</p>
                            </div>
                        </div>
                        <div class="lot-io-buttons">
                            <button type="button" id="lot-io-export-btn" class="fpt-ui-button fpt-ui-button--primary lot-io-action-btn">
                                <svg class="lot-io-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                    <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Экспорт</span>
                            </button>
                            <button type="button" id="lot-io-import-btn" class="fpt-ui-button fpt-ui-button--secondary lot-io-action-btn">
                                <svg class="lot-io-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Импорт</span>
                            </button>
                            <input type="file" id="lot-io-import-file" class="lot-io-hidden-file-input" accept=".json" hidden aria-hidden="true" tabindex="-1">
                        </div>
                        <div class="lot-io-card-footer lot-io-transfer-footer">
                            <a href="#" id="convert-cardinal-lots-btn" class="lot-io-tertiary-link">
                                <span>Конвертер FunPay Cardinal → FunPay Funcy</span>
                                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="M7 5.5 11.5 10 7 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </a>
                        </div>
                    </section>

                    <section class="fpt-ui-surface lot-io-card lot-io-editor-card" aria-labelledby="lot-io-editor-title">
                        <div class="lot-io-card-top">
                            <div class="lot-io-icon-tile" aria-hidden="true">
                                <svg class="lot-io-svg-icon" viewBox="0 0 24 24" fill="none" focusable="false">
                                    <path d="m14.7 5.3 4 4M5 19l3.4-.8 10.1-10.1a1.4 1.4 0 0 0 0-2l-.6-.6a1.4 1.4 0 0 0-2 0L5.8 15.6 5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="lot-io-card-copy">
                                <h4 id="lot-io-editor-title">Массовое редактирование</h4>
                                <p class="lot-io-description">Измените название, описание или сообщение покупателю сразу у нескольких лотов.</p>
                                <button type="button" id="fp-bulk-edit-btn" class="fpt-ui-button fpt-ui-button--secondary lot-io-bulk-edit-btn">
                                    <svg class="lot-io-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                        <path d="m14.7 5.3 4 4M5 19l3.4-.8 10.1-10.1a1.4 1.4 0 0 0 0-2l-.6-.6a1.4 1.4 0 0 0-2 0L5.8 15.6 5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span>Массово изменить лоты</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="lot-io-pending-section" class="fpt-ui-surface lot-io-card lot-io-pending-card" aria-labelledby="lot-io-pending-title" hidden>
                        <div class="lot-io-card-top">
                            <div class="lot-io-icon-tile" aria-hidden="true">
                                <svg class="lot-io-svg-icon" viewBox="0 0 24 24" fill="none" focusable="false">
                                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/>
                                    <path d="M12 7.8v4.7l3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="lot-io-card-copy">
                                <h4 id="lot-io-pending-title">Незавершённые импорты</h4>
                                <div id="lot-io-pending-imports-list" aria-live="polite"></div>
                            </div>
                        </div>
                    </section>
                </div>
                <div class="fp-tools-page-content" data-page="finance_hub">
                    <div class="fpt-fin-header">
                        <div class="fpt-fin-header-left">
                            <div class="fpt-fin-title-row">
                                <h3 class="fpt-fin-title">Обзор и аналитика</h3>
                                <span class="fpt-fin-badge">Hub</span>
                            </div>
                            <div class="fpt-fin-last-updated" id="fptFinLastUpdated">
                                <span class="material-symbols-rounded">schedule</span>
                                <span id="fptFinLastUpdatedText">Не обновлялось</span>
                            </div>
                        </div>
                        <div class="fpt-fin-header-actions">
                            <button type="button" id="fptFinRefreshBtn" class="btn btn-default fpt-fin-btn" title="Обновить финансовые данные" aria-label="Обновить">
                                <span class="material-symbols-rounded">refresh</span>
                                <span>Обновить</span>
                            </button>
                            <button type="button" id="fptFinExportBtn" class="btn btn-default fpt-fin-btn" disabled title="Экспорт станет доступен в следующем обновлении" aria-label="Экспорт (недоступно)">
                                <span class="material-symbols-rounded">download</span>
                                <span>Экспорт</span>
                            </button>
                        </div>
                    </div>

                    <div class="fpt-fin-subtabs-wrap">
                        <div class="fpt-fin-subtabs" id="fptFinSubtabs" role="tablist">
                            <span class="fpt-fin-subtabs-indicator" id="fptFinSubtabsIndicator" aria-hidden="true"></span>
                            <button type="button" class="fpt-fin-subtab active" data-subtab="overview" role="tab" aria-selected="true">
                                <span class="material-symbols-rounded">dashboard</span>
                                <span>Обзор</span>
                            </button>
                            <button type="button" class="fpt-fin-subtab" data-subtab="sales" role="tab" aria-selected="false">
                                <span class="material-symbols-rounded">trending_up</span>
                                <span>Продажи</span>
                            </button>
                            <button type="button" class="fpt-fin-subtab" data-subtab="purchases" role="tab" aria-selected="false">
                                <span class="material-symbols-rounded">shopping_bag</span>
                                <span>Покупки</span>
                            </button>
                            <button type="button" class="fpt-fin-subtab" data-subtab="profit" role="tab" aria-selected="false">
                                <span class="material-symbols-rounded">attach_money</span>
                                <span>Прибыль</span>
                            </button>
                            <button type="button" class="fpt-fin-subtab" data-subtab="potential" role="tab" aria-selected="false">
                                <span class="material-symbols-rounded">insights</span>
                                <span>Потенциал</span>
                            </button>
                            <button type="button" class="fpt-fin-subtab" data-subtab="operations" role="tab" aria-selected="false">
                                <span class="material-symbols-rounded">receipt_long</span>
                                <span>Операции</span>
                            </button>
                        </div>
                    </div>

                    <div class="fpt-fin-filterbar">
                        <div class="fpt-fin-period-wrap">
                            <div class="fpt-fin-filter-control" data-fin-control="period">
                                <label class="fpt-fin-filter-label" for="fptFinPeriodSelect">Период</label>
                                <select id="fptFinPeriodSelect" class="fpt-fin-period-select" aria-label="Период статистики">
                                    <option value="today">Сегодня</option>
                                    <option value="yesterday">Вчера</option>
                                    <option value="24h">24 часа</option>
                                    <option value="7d" selected>7 дней</option>
                                    <option value="30d">30 дней</option>
                                    <option value="365d">Год</option>
                                    <option value="all">Всё время</option>
                                    <option value="custom">Произвольный период…</option>
                                </select>
                            </div>
                            <div class="fpt-fin-filter-control" data-fin-control="currency">
                                <label class="fpt-fin-filter-label" for="fptFinCurrencySelect">Валюта</label>
                                <select id="fptFinCurrencySelect" class="fpt-fin-period-select" aria-label="Валюта статистики">
                                    <option value="all">Все валюты</option>
                                    <option value="RUB">₽ RUB</option>
                                    <option value="USD">$ USD</option>
                                    <option value="EUR">€ EUR</option>
                                </select>
                            </div>
                            <div class="fpt-fin-filter-control" data-fin-control="status">
                                <label class="fpt-fin-filter-label" id="fptFinStatusLabel" for="fptFinStatusSelect">Статус заказа</label>
                                <select id="fptFinStatusSelect" class="fpt-fin-period-select" aria-label="Статус заказов">
                                    <option value="all">Все статусы</option>
                                    <option value="closed">Закрытые</option>
                                    <option value="paid">Оплаченные</option>
                                    <option value="refunded">Возвраты</option>
                                </select>
                            </div>
                            <div class="fpt-fin-filter-control" data-fin-control="category">
                                <label class="fpt-fin-filter-label" for="fptFinCategorySelect">Категория</label>
                                <select id="fptFinCategorySelect" class="fpt-fin-period-select" aria-label="Категория товаров">
                                    <option value="all">Все категории</option>
                                </select>
                            </div>
                            <div id="fptFinCustomRange" class="fpt-fin-custom-range" role="group" aria-label="Произвольный период">
                                <label for="fptFinCustomFrom">С</label>
                                <input id="fptFinCustomFrom" type="date" aria-label="Дата начала">
                                <label for="fptFinCustomTo">По</label>
                                <input id="fptFinCustomTo" type="date" aria-label="Дата окончания">
                                <button type="button" id="fptFinCustomApplyBtn" class="btn btn-default fpt-fin-custom-range-btn">Применить</button>
                                <button type="button" id="fptFinCustomResetBtn" class="btn btn-default fpt-fin-custom-range-btn">Сбросить</button>
                                <span id="fptFinCustomRangeError" class="fpt-fin-custom-range-error" role="alert"></span>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Обзор -->
                    <div class="fpt-fin-tab-pane active" data-subtab="overview">
                        <div class="fpt-fin-grid">
                            <!-- Row 1: KPI (4x col-3) -->
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--revenue" data-finance-overview-target="sales" role="button" tabindex="0" aria-label="Открыть продажи по выручке">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--revenue" aria-hidden="true">payments</span>
                                        <h5 class="fpt-fin-card-title">Выручка <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewRevenue"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewRevenueSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--revenue" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--profit" data-finance-overview-target="profit" role="button" tabindex="0" aria-label="Открыть чистую прибыль">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--profit" aria-hidden="true">account_balance_wallet</span>
                                        <h5 class="fpt-fin-card-title">Чистая прибыль <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewProfit"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewProfitSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--profit" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--orders" data-finance-overview-target="sales" role="button" tabindex="0" aria-label="Открыть продажи по заказам">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--orders" aria-hidden="true">shopping_cart</span>
                                        <h5 class="fpt-fin-card-title">Заказы <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewOrders"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewOrdersSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--orders" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--average" data-finance-overview-target="sales" role="button" tabindex="0" aria-label="Открыть продажи по среднему чеку">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--average" aria-hidden="true">receipt</span>
                                        <h5 class="fpt-fin-card-title">Средний чек <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewAvgCheck"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewAvgCheckSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--average" aria-hidden="true">show_chart</span>
                                </div>
                            </div>

                            <!-- Row 2: Потенциал (4x col-3) -->
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--potential-revenue" data-finance-overview-target="potential" role="button" tabindex="0" aria-label="Открыть потенциал выручки">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--potential-revenue" aria-hidden="true">trending_up</span>
                                        <h5 class="fpt-fin-card-title">Потенциальная выручка <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewPotRevenue"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewPotRevenueSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--potential-revenue" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--potential-profit" data-finance-overview-target="potential" role="button" tabindex="0" aria-label="Открыть потенциал прибыли">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--potential-profit" aria-hidden="true">insights</span>
                                        <h5 class="fpt-fin-card-title">Потенциал прибыли <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewPotProfit"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewPotProfitSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--potential-profit" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--cost" data-finance-overview-target="potential" role="button" tabindex="0" aria-label="Открыть стоимость склада">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--cost" aria-hidden="true">warehouse</span>
                                        <h5 class="fpt-fin-card-title">Стоимость склада <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewPotCost"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewPotCostSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--cost" aria-hidden="true">show_chart</span>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card fpt-fin-overview-kpi fpt-fin-overview-kpi--offers" data-finance-overview-target="potential" role="button" tabindex="0" aria-label="Открыть активные лоты">
                                    <div class="fpt-fin-card-header">
                                        <span class="material-symbols-rounded fpt-fin-kpi-icon fpt-fin-kpi-icon--offers" aria-hidden="true">inventory_2</span>
                                        <h5 class="fpt-fin-card-title">Активные лоты <span class="material-symbols-rounded fpt-fin-kpi-chevron" aria-hidden="true">chevron_right</span></h5>
                                        <span class="material-symbols-rounded fpt-fin-kpi-more" aria-hidden="true">more_vert</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinOverviewPotOffers"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinOverviewPotOffersSub"><span class="fpt-fin-mini-badge">+ 0 без остатка</span></div>
                                    <span class="material-symbols-rounded fpt-fin-kpi-sparkline fpt-fin-kpi-sparkline--offers" aria-hidden="true">show_chart</span>
                                </div>
                            </div>

                            <!-- Row 3: Графики (col-8 + col-4) -->
                            <div class="fpt-fin-col-8">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Динамика</h5>
                                        <div class="fpt-fin-chart-toggles" id="fptFinOverviewChartToggles" role="group" aria-label="Метрика графика">
                                            <button type="button" class="fpt-fin-chart-toggle active" data-metric="revenue">Выручка</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-metric="profit">Прибыль</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-metric="orders">Заказы</button>
                                        </div>
                                    </div>
                                    <div class="fpt-fin-overview-chart-wrap" id="fptFinOverviewChart">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-4">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Структура по категориям</h5>
                                    </div>
                                    <div class="fpt-fin-overview-categories-wrap" id="fptFinOverviewCategoriesChart">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Row 4: Топы (col-6 + col-6) -->
                            <div class="fpt-fin-col-6">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Топ товаров</h5>
                                    </div>
                                    <div class="fpt-fin-overview-top-wrap" id="fptFinOverviewTopProducts">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-6">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Топ категорий</h5>
                                    </div>
                                    <div class="fpt-fin-overview-top-wrap" id="fptFinOverviewTopCategories">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:28px;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Row 5: Операции (col-12) -->
                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Последние события</h5>
                                    </div>
                                    <div class="fpt-fin-overview-events-wrap" id="fptFinOverviewOperations">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:36px;"></div>
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:36px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Продажи -->
                    <div class="fpt-fin-tab-pane" data-subtab="sales">
                        <div class="fpt-fin-grid">
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Выручка от продаж</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">payments</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Оплачено заказов</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:var(--fpt-accent, #1b75bb);">check_circle</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Средний чек продажи</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Возвраты и споры</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#f4c84a;">assignment_return</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-8">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Динамика продаж</h5>
                                        <div class="fpt-fin-chart-toggles" role="group" aria-label="Интервал продаж">
                                            <button type="button" class="fpt-fin-chart-toggle active" data-period-step="day">По дням</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-period-step="week">По неделям</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-period-step="month">По месяцам</button>
                                        </div>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-4">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Продажи по категориям</h5>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Детализация продаж</h5>
                                        <div class="fpt-fin-chart-toggles" role="group" aria-label="Вид детализации">
                                            <button type="button" class="fpt-fin-chart-toggle active" data-sales-view="orders">Заказы</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-sales-view="buyers">Топ покупателей</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-sales-view="products">Топ товаров</button>
                                            <button type="button" class="fpt-fin-chart-toggle" data-sales-view="categories">Топ категорий</button>
                                        </div>
                                        <span class="fpt-fin-empty-badge" id="fptFinSalesCountBadge">Загрузка…</span>
                                    </div>
                                    <div class="fpt-fin-table-wrap" id="fptFinSalesDetailsContent">
                                        <table class="fpt-fin-table">
                                            <thead>
                                                <tr>
                                                    <th>Заказ</th>
                                                    <th>Товар / Описание</th>
                                                    <th>Покупатель</th>
                                                    <th>Дата</th>
                                                    <th>Сумма</th>
                                                    <th>Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Покупки -->
                    <div class="fpt-fin-tab-pane" data-subtab="purchases">
                        <div class="fpt-fin-grid">
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Расходы на покупки</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">shopping_bag</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Куплено товаров</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:var(--fpt-accent, #1b75bb);">inventory_2</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Средний чек покупки</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">receipt_long</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Завершено покупок</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">verified</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-8">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Динамика расходов на покупки</h5>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-4">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Топ продавцов</h5>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">История покупок</h5>
                                        <span class="fpt-fin-empty-badge"><span class="material-symbols-rounded">sync</span> Синхронизация покупок в TASK-03</span>
                                    </div>
                                    <div class="fpt-fin-table-wrap">
                                        <table class="fpt-fin-table">
                                            <thead>
                                                <tr>
                                                    <th>Заказ</th>
                                                    <th>Товар / Описание</th>
                                                    <th>Продавец</th>
                                                    <th>Дата</th>
                                                    <th>Сумма</th>
                                                    <th>Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Прибыль -->
                    <div class="fpt-fin-tab-pane" data-subtab="profit">
                        <div class="fpt-fin-grid">
                            <div class="fpt-fin-col-12 fpt-fin-profit-cost-warning-col fpt-fin-control-hidden" id="fptFinProfitCostWarning" role="status" aria-live="polite" aria-hidden="true">
                                <div class="fpt-fin-profit-cost-warning is-loading">
                                    <span class="material-symbols-rounded fpt-fin-profit-cost-warning-icon" aria-hidden="true">warning_amber</span>
                                    <div class="fpt-fin-profit-cost-warning-copy">
                                        <strong>Загружаем данные о себестоимости</strong>
                                        <span>Проверяем покрытие завершённых заказов за выбранный период.</span>
                                        <button type="button" class="fpt-fin-profit-cost-warning-action" id="fptFinProfitCostWarningAction" hidden></button>
                                    </div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Реализованная прибыль</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">savings</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinProfitNet"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinProfitNetSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Себестоимость продаж</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">money_off</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinProfitCost"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinProfitCostSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Маржинальность</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:var(--fpt-accent, #1b75bb);">percent</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinProfitMargin"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinProfitMarginSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">ROI инвестиций</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#a09af8;">trending_up</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinProfitRoi"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinProfitRoiSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-8">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Выручка vs Прибыль</h5>
                                        <div class="fpt-fin-currency-chips" id="fptFinProfitCurrencyChips"></div>
                                    </div>
                                    <div class="fpt-fin-profit-chart-wrap" id="fptFinProfitChart">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-4">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Покрытие себестоимости</h5>
                                    </div>
                                    <div class="fpt-fin-coverage-wrap" id="fptFinProfitCoverageCard">
                                        <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-filter-group" id="fptFinProfitFilterGroup" role="group" aria-label="Фильтры заказов прибыли">
                                    <button type="button" class="fpt-fin-filter-chip active" data-filter="all">Все заказы</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="with-cost">С себестоимостью</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="without-cost">Без себестоимости</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="refunded">Возвраты</button>
                                </div>
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Заказы и чистая прибыль</h5>
                                        <span class="fpt-fin-empty-badge" id="fptFinProfitCountBadge"><span class="material-symbols-rounded">receipt_long</span> 0 заказов</span>
                                    </div>
                                    <div class="fpt-fin-table-wrap">
                                        <table class="fpt-fin-table" id="fptFinProfitTable">
                                            <thead>
                                                <tr>
                                                    <th>Заказ</th>
                                                    <th>Дата</th>
                                                    <th>Выручка</th>
                                                    <th>Себестоимость</th>
                                                    <th>Чистая прибыль</th>
                                                    <th>Маржа</th>
                                                    <th>ROI</th>
                                                    <th>Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody id="fptFinProfitTableBody">
                                                <tr>
                                                    <td colspan="8"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="8"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="8"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Потенциал -->
                    <div class="fpt-fin-tab-pane" data-subtab="potential">
                        <div class="fpt-fin-grid">
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Потенциал выручки</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">trending_up</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinPotRevenue"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinPotRevenueSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Потенциал прибыли</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:var(--fpt-accent, #1b75bb);">insights</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinPotProfit"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinPotProfitSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Стоимость склада</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">warehouse</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinPotCost"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinPotCostSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Лоты в продаже</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4a9fd4;">inventory</span>
                                    </div>
                                    <div class="fpt-fin-card-value" id="fptFinPotOffers"><div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div></div>
                                    <div class="fpt-fin-card-sub" id="fptFinPotOffersSub"><div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-filter-group" id="fptFinPotFilterGroup" role="group" aria-label="Фильтры лотов">
                                    <button type="button" class="fpt-fin-filter-chip active" data-filter="all">Все</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="with-cost">С себестоимостью</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="without-cost">Без себестоимости</button>
                                    <button type="button" class="fpt-fin-filter-chip" data-filter="finite-stock">Конечный остаток</button>
                                </div>
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Таблица активных предложений</h5>
                                        <span class="fpt-fin-empty-badge" id="fptFinPotCountBadge"><span class="material-symbols-rounded">storefront</span> 0 лотов</span>
                                    </div>
                                    <div class="fpt-fin-table-wrap fpt-fin-pot-table-wrap" id="fptFinPotTableWrap">
                                        <table class="fpt-fin-table" id="fptFinPotTable">
                                            <thead>
                                                <tr>
                                                    <th>Лот</th>
                                                    <th>Категория</th>
                                                    <th>Остаток</th>
                                                    <th>Цена продавца</th>
                                                    <th>Цена покупателю</th>
                                                    <th>Себестоимость</th>
                                                    <th>Потенц. выручка</th>
                                                    <th>Потенц. прибыль</th>
                                                    <th>Маржа</th>
                                                </tr>
                                            </thead>
                                            <tbody id="fptFinPotTableBody">
                                                <tr>
                                                    <td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="9"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="fpt-fin-empty-state fpt-fin-pot-empty fpt-fin-control-hidden" id="fptFinPotEmptyState" role="status" aria-hidden="true">
                                        <span class="material-symbols-rounded fpt-fin-empty-icon" aria-hidden="true">inventory_2</span>
                                        <strong class="fpt-fin-empty-title" id="fptFinPotEmptyTitle">Нет активных предложений</strong>
                                        <span class="fpt-fin-empty-desc" id="fptFinPotEmptyDescription">Добавьте или активируйте лоты, чтобы увидеть их потенциал.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtab: Операции -->
                    <div class="fpt-fin-tab-pane" data-subtab="operations">
                        <div class="fpt-fin-grid">
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Всего пополнений</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#4caf82;">arrow_circle_down</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Всего выводов</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#e57373;">arrow_circle_up</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Комиссии сервиса</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:#f4c84a;">price_check</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-3">
                                <div class="fpt-fin-card fpt-fin-kpi-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Чистый поток (нетто)</h5>
                                        <span class="material-symbols-rounded" style="font-size:18px;color:var(--fpt-accent, #1b75bb);">account_balance</span>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-value"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-8">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Помесячная динамика баланса</h5>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-chart"></div>
                                </div>
                            </div>
                            <div class="fpt-fin-col-4">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">Структура движения</h5>
                                    </div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                    <div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:30px;"></div>
                                </div>
                            </div>

                            <div class="fpt-fin-col-12">
                                <div class="fpt-fin-card">
                                    <div class="fpt-fin-card-header">
                                        <h5 class="fpt-fin-card-title">История операций баланса</h5>
                                        <span class="fpt-fin-empty-badge"><span class="material-symbols-rounded">history</span> Интеграция баланса в TASK-03</span>
                                    </div>
                                    <div class="fpt-fin-table-wrap">
                                        <table class="fpt-fin-table">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Дата</th>
                                                    <th>Тип операции</th>
                                                    <th>Описание / Реквизиты</th>
                                                    <th>Сумма</th>
                                                    <th>Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td colspan="6"><div class="fpt-fin-skeleton fpt-fin-skeleton-text" style="width:100%;height:24px;"></div></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <section class="fpt-fin-additional-settings" aria-labelledby="fptFinAdditionalSettingsHeading">
                        <h4 id="fptFinAdditionalSettingsHeading">Дополнительные настройки финансов</h4>
                        <p class="template-info">Управление прежними отчётами в старом интерфейсе FunPay.</p>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="showSalesStatsCheckbox">
                            <label for="showSalesStatsCheckbox" style="margin-bottom:0;"><span>Статистика покупок и продаж на вкладках</span></label>
                        </div>
                        <div class="checkbox-label-inline">
                            <input type="checkbox" id="showFinanceStatsCheckbox">
                            <label for="showFinanceStatsCheckbox" style="margin-bottom:0;"><span>Статистика финансов на странице «Финансы»</span></label>
                        </div>
                    </section>
                </div>

                <div class="fp-tools-page-content" data-page="piggy_banks">
                    <h3>Управление копилками</h3>
                    <p class="template-info">Создавайте копилки для отслеживания прогресса к вашим финансовым целям. Основная копилка будет отображаться при наведении на баланс в шапке сайта.</p>
                    <button id="create-piggy-bank-btn" class="btn">+ Создать новую копилку</button>
                    <div id="piggy-banks-list-container" class="piggy-banks-list-container"></div>
                </div>
                <div class="fp-tools-page-content" data-page="theme">
                    <h3>Темы FunPay</h3>
                    <div class="checkbox-label-inline" style="margin-bottom:15px;"><input type="checkbox" id="enableCustomThemeCheckbox"><label for="enableCustomThemeCheckbox" style="margin-bottom:0;"><span>Включить кастомную тему</span></label></div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-size:12px;color:var(--fptm-faint, #5a5f7a);flex:1;">Готовые темы:</span>
                        <button id="fp-apply-dark-preset" class="btn btn-default" style="padding:3px 10px;font-size:12px;"><span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:4px;">dark_mode</span>Чёрная</button>
                    </div>
                    <div id="fp-wallpaper-carousel" style="position:relative;width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:var(--fptm-surface-2, #0e0f16);contain:layout style paint;">
                        <div id="fp-wp-img-slot" style="position:absolute;inset:0;"></div>
                        <button id="fp-wp-prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.55);border:none;color:#fff;font-size:18px;width:28px;height:28px;border-radius:50%;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;line-height:1;">&#8249;</button>
                        <button id="fp-wp-next" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.55);border:none;color:#fff;font-size:18px;width:28px;height:28px;border-radius:50%;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;line-height:1;">&#8250;</button>
                        <div id="fp-wp-label" style="position:absolute;bottom:0;left:0;right:0;padding:4px 8px;background:rgba(0,0,0,.6);font-size:11px;color:var(--fptm-text, #ccc);display:flex;align-items:center;justify-content:space-between;">
                            <span id="fp-wp-name"></span>
                            <span id="fp-wp-counter" style="color:var(--fptm-faint, #5a5f7a);font-size:10px;"></span>
                        </div>
                        <div id="fp-wp-loader" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
                            <span id="fp-wp-emoji" style="font-size:24px;"></span>
                            <div style="width:60px;height:3px;background:var(--fptm-surface, #1e2030);border-radius:2px;overflow:hidden;"><div id="fp-wp-bar" style="height:100%;width:0%;background:#1b75bb;transition:width .15s linear;border-radius:2px;"></div></div>
                            <span id="fp-wp-pct" style="font-size:10px;color:#4a4f68;">0%</span>
                        </div>
                        <button id="fp-wp-apply-cur" style="position:absolute;top:6px;right:6px;background:var(--fpt-accent, #1b75bb);border:none;color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:12px;cursor:pointer;z-index:2;display:none;">Применить</button>
                    </div>
                    <div id="fp-wp-desc" style="font-size:12px;color:#9aa0b8;margin:6px 0 2px;line-height:1.4;min-height:16px;"></div>
                    <div style="font-size:11px;color:var(--fptm-faint, #5a5f7a);margin:6px 0 12px;line-height:1.4;">Загрузка собственных тем через внешний сервис временно недоступна; официальный адрес FunPay Funcy будет добавлен после публикации.</div>
                    <div class="template-container">
                        <label>Фоновое изображение:</label>
                        <div id="bg-image-preview" style="width:100%; height:60px; background-color:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:10px; background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; color: var(--fptm-muted, #888); font-size:12px;">Нет изображения</div>
                        <button id="uploadBgImageBtn" class="btn" title="Можно загружать анимированные GIF">Загрузить</button>
                        <button id="removeBgImageBtn" class="btn btn-default" style="margin-left: 10px;">Удалить</button>
                        <input type="file" id="bgImageInput" accept="image/*,image/gif" style="display: none;">
                        <div class="bg-image-info"><span id="bgImageInfoToggle" class="info-toggle">Откуда брать анимации? ⓘ</span><div id="bgImageInfoContent" class="info-content"><p>Вы можете загрузать анимированные GIF. Примеры сайтов, где можно найти подходящие фоны:</p><ul><li><a href="https://www.behance.net/gallery/35096329/Ambient-animations" target="_blank" rel="noopener noreferrer">Behance - Ambient Animations</a></li><li><a href="https://tenor.com/ru/search/looping-gifs-anime-aesthetic-gifs" target="_blank" rel="noopener noreferrer">Tenor - Looping Aesthetic Gifs</a></li><li><a href="https://www.pinterest.com/pin/678565868836311444/" target="_blank" rel="noopener noreferrer">Pinterest - Pixel Art</a></li><li><a href="https://tenor.com/ru/search/anime-rain-wallpaper-gifs" target="_blank" rel="noopener noreferrer">Tenor - Anime Rain Wallpaper</a></li></ul></div></div>
                    </div>
                    <div class="template-container color-input-grid">
                        <div><label for="themeColor1">Основной цвет:</label><input type="color" id="themeColor1" class="theme-color-input" value="#1b75bb"></div>
                        <div><label for="themeColor2">Акцентный цвет:</label><input type="color" id="themeColor2" class="theme-color-input" value="#1b75bb"></div>
                        <div><label for="themeContainerBgColor">Фон блоков:</label><input type="color" id="themeContainerBgColor" class="theme-color-input" value="#1b75bb"></div>
                        <div><label for="themeTextColor">Цвет текста:</label><input type="color" id="themeTextColor" class="theme-color-input" value="#1b75bb"></div>
                        <div><label for="themeLinkColor">Цвет ссылок:</label><input type="color" id="themeLinkColor" class="theme-color-input" value="#1b75bb"></div>
                    </div>
                    <div class="template-container"><div class="range-label"><label for="themeFontSelect">Шрифт:</label></div><select id="themeFontSelect"></select></div>
                    <div class="template-container"><div class="range-label"><label for="themeBgBlur">Размытие фона:</label><span id="themeBgBlurValue">0px</span></div><input type="range" id="themeBgBlur" min="0" max="20" step="1"></div>
                    <div class="template-container"><div class="range-label"><label for="themeBgBrightness">Яркость фона:</label><span id="themeBgBrightnessValue">100%</span></div><input type="range" id="themeBgBrightness" min="20" max="150" step="1"></div>
                    <div class="template-container"><div class="range-label"><label for="themeBorderRadius">Закругление углов:</label><span id="themeBorderRadiusValue">8px</span></div><input type="range" id="themeBorderRadius" min="0" max="30" step="1"></div>
                    <div class="setting-group"><div class="checkbox-label-inline"><input type="checkbox" id="enableGlassmorphism"><label for="enableGlassmorphism">Эффект "матового стекла"</label></div><div id="glassmorphismControls" style="display:none;"><div class="template-container"><div class="range-label"><label for="themeContainerBgOpacity">Прозрачность блоков:</label><span id="themeContainerBgOpacityValue">100%</span></div><input type="range" id="themeContainerBgOpacity" min="0" max="100" step="1"></div><div class="template-container"><div class="range-label"><label for="glassmorphismBlur">Размытие стекла:</label><span id="glassmorphismBlurValue">10px</span></div><input type="range" id="glassmorphismBlur" min="0" max="30" step="1"></div></div></div>
                    <div class="setting-group"><div class="checkbox-label-inline"><input type="checkbox" id="enableCustomScrollbar"><label for="enableCustomScrollbar">Кастомный скроллбар</label></div><div id="customScrollbarControls" style="display:none;"><div class="template-container color-input-grid"><div><label for="scrollbarThumbColor">Цвет ползунка:</label><input type="color" id="scrollbarThumbColor" class="theme-color-input" value="#1b75bb"></div><div><label for="scrollbarTrackColor">Цвет фона:</label><input type="color" id="scrollbarTrackColor" class="theme-color-input" value="#1b75bb"></div></div><div class="template-container"><div class="range-label"><label for="scrollbarWidth">Ширина:</label><span id="scrollbarWidthValue">8px</span></div><input type="range" id="scrollbarWidth" min="2" max="20" step="1"></div></div></div>
                    <div class="setting-group"><h4 style="margin-top: 0;">Кругляшки</h4><div class="template-container"><label>Предпросмотр:</label><div style="display: flex; justify-content: center; align-items: center; height: 150px; background: rgba(0,0,0,0.2); border-radius: 10px; overflow: hidden; margin-bottom: 15px;"><div id="circlePreviewContainer" style="transition: opacity 0.3s ease;"><div id="circlePreview" style="position: relative; width: 140px; height: 140px; transform-origin: center center; transition: transform 0.3s ease, filter 0.3s ease, opacity 0.3s ease;"><img src="https://funpay.com/img/circles/funpay_poke.jpg" alt="" style="width: 100%; height: 100%; border-radius: 50%;"><svg viewBox="0 0 200 200" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"><defs><path id="text_path_preview" d="M 10, 100 a 90,90 0 1,0 180,0 a 90,90 0 1,0 -180,0"></path></defs><g fill="white" font-size="14px"><text text-anchor="end"><textPath xlink:href="#text_path_preview" startOffset="100%">Example</textPath></text></g></svg></div></div></div></div><div class="checkbox-label-inline"><input type="checkbox" id="enableCircleCustomization"><label for="enableCircleCustomization" style="margin-bottom:0;"><span>Включить кастомизацию</span></label></div><div id="circleCustomizationControls" style="display: none;"><div class="checkbox-label-inline"><input type="checkbox" id="showCircles"><label for="showCircles" style="margin-bottom:0;"><span>Отображать</span></label></div><div class="template-container"><div class="range-label"><label for="circleSize">Размер:</label><span id="circleSizeValue">100%</span></div><input type="range" id="circleSize" min="50" max="150" step="1"></div><div class="template-container"><div class="range-label"><label for="circleOpacity">Прозрачность:</label><span id="circleOpacityValue">100%</span></div><input type="range" id="circleOpacity" min="0" max="100" step="1"></div><div class="template-container"><div class="range-label"><label for="circleBlur">Размытие:</label><span id="circleBlurValue">0px</span></div><input type="range" id="circleBlur" min="0" max="50" step="1"></div></div></div>
                    <div class="setting-group"><h4 style="margin-top: 0;">Разделители</h4><div class="checkbox-label-inline"><input type="checkbox" id="enableImprovedSeparators"><label for="enableImprovedSeparators" style="margin-bottom:0;"><span>Включить улучшенные</span></label></div></div>
                    <div class="setting-group"><h4 style="margin-top: 0;">Расположение</h4><div class="template-container"><div class="range-label"><label for="headerPositionSelect">Верхняя панель:</label></div><select id="headerPositionSelect"><option value="top">Вверх (по умолчанию)</option><option value="bottom">Вниз</option></select></div></div>
                    
                    <div class="setting-group" id="fptTextOutlineGroup"><h4 style="margin-top: 0;">Контур тексту</h4><div class="checkbox-label-inline"><input type="checkbox" id="fptTextOutlineEnabled"><label for="fptTextOutlineEnabled" style="margin-bottom:0;"><span>Включить контур буквам</span></label></div><small style="font-size:12px;opacity:0.7;display:block;margin-top:-10px;margin-bottom:8px;">Обводит все буквы в меню контуром для возможного повышения читаемости.</small><div id="fptTextOutlineControls" style="display:none;"><div class="template-container color-input-grid"><div><label for="fptTextOutlineColor">Цвет контура:</label><input type="color" id="fptTextOutlineColor" class="theme-color-input" value="#1b75bb"></div></div><div class="template-container"><div class="range-label"><label for="fptTextOutlineWidth">Толщина:</label><span id="fptTextOutlineWidthValue">1px</span></div><input type="range" id="fptTextOutlineWidth" min="0" max="5" step="0.5"></div></div></div>
                    <div class="theme-actions-grid"><button id="enableMagicStickBtn" class="btn" style="grid-column: 1 / -1;"><span class="material-icons">auto_fix_normal</span><span>Включить режим редактора</span></button><button id="generatePaletteBtn" class="btn btn-default" style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span class="material-icons" style="font-size: 18px;">auto_fix_high</span>цвета фона</button><button id="randomizeThemeBtn" class="btn btn-default" style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span class="material-icons" style="font-size: 18px;">casino</span>рандом</button><button id="shareThemeBtn" class="btn btn-default" style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span class="material-icons" style="font-size: 18px;">share</span>Поделиться темой</button><button id="exportThemeBtn" class="btn btn-default" title="Сохранить текущие настройки темы в файл (.fptheme)">Экспорт</button><button id="importThemeBtn" class="btn btn-default" title="Загрузить настройки темы из файла (.fptheme)">Импорт</button><input type="file" id="importThemeInput" accept=".fptheme" style="display: none;"><button id="resetThemeBtn" class="btn btn-default">СБРОСИТЬ ТЕМУ</button></div>
                </div>

                <div class="fp-tools-page-content" data-page="autobump">
                    <header class="fpt-ui-page-header fp-autobump-page-header">
                        <div class="fp-autobump-page-header-copy">
                            <h3 class="fpt-ui-page-title fp-autobump-page-title">Автоподнятие лотов</h3>
                            <p class="fpt-ui-helper fp-autobump-page-description">Автоматически поднимайте доступные категории через FunPay API и ограничивайте область поднятия при необходимости.</p>
                        </div>
                    </header>

                    <section class="fpt-ui-surface fp-autobump-section fp-autobump-settings-section" aria-labelledby="fp-autobump-settings-title">
                        <div class="fpt-ui-section-header fp-autobump-section-header">
                            <div>
                                <h4 id="fp-autobump-settings-title" class="fpt-ui-section-title">Автоматическое поднятие</h4>
                                <p class="fpt-ui-helper fp-autobump-section-description">Главный переключатель управляет всей автоматизацией. Фильтры ниже применяются одновременно.</p>
                            </div>
                        </div>
                        <div class="fp-autobump-master-row">
                            <label class="fp-autobump-setting-copy" for="autoBumpEnabled">
                                <span class="fp-autobump-setting-title">Включить автоподнятие</span>
                                <span class="fpt-ui-helper fp-autobump-setting-description">Расширение будет поднимать подходящие категории и само планировать следующую попытку.</span>
                            </label>
                            <div class="fp-autobump-master-control">
                                <span id="autoBumpMasterState" class="fp-autobump-state-label">Выключено</span>
                                <input type="checkbox" id="autoBumpEnabled" class="fp-autobump-setting-checkbox">
                            </div>
                        </div>

                        <div id="autoBumpDependentSettings" class="fp-autobump-dependent" aria-disabled="true">
                            <div class="fpt-ui-setting-row fp-autobump-setting-row">
                                <label class="fp-autobump-setting-copy" for="selectiveBumpEnabled">
                                    <span class="fp-autobump-setting-title">Только выбранные категории</span>
                                    <span class="fpt-ui-helper fp-autobump-setting-description">Ограничить поднятие заранее выбранным набором категорий.</span>
                                </label>
                                <input type="checkbox" id="selectiveBumpEnabled" class="fp-autobump-setting-checkbox">
                            </div>
                            <div id="autoBumpSelectedCategoriesRow" class="fp-autobump-selected-row" hidden>
                                <div class="fp-autobump-selected-copy">
                                    <span class="fp-autobump-setting-title">Выбранные категории</span>
                                    <span id="autoBumpSelectedSummary" class="fpt-ui-helper fp-autobump-selected-summary">Категории не выбраны</span>
                                </div>
                                <button type="button" id="configureSelectiveBumpBtn" class="fpt-ui-button fpt-ui-button--secondary fp-autobump-configure-btn">
                                    <span id="autoBumpConfigureLabel">Выбрать</span>
                                </button>
                            </div>
                            <div class="fpt-ui-setting-row fp-autobump-setting-row">
                                <label class="fp-autobump-setting-copy" for="bumpOnlyAutoDelivery">
                                    <span class="fp-autobump-setting-title">Только категории с автовыдачей</span>
                                    <span class="fpt-ui-helper fp-autobump-setting-description">Дополнительно оставить только категории, где хотя бы один лот использует автовыдачу.</span>
                                </label>
                                <input type="checkbox" id="bumpOnlyAutoDelivery" class="fp-autobump-setting-checkbox">
                            </div>
                        </div>
                    </section>

                    <section class="fpt-ui-surface fp-autobump-section fp-autobump-log-section" aria-labelledby="fp-autobump-log-title">
                        <div class="fpt-ui-section-header fp-autobump-log-header">
                            <div>
                                <h4 id="fp-autobump-log-title" class="fpt-ui-section-title">Журнал</h4>
                                <p class="fpt-ui-helper fp-autobump-section-description">Последние события автоподнятия сохраняются между открытиями панели.</p>
                            </div>
                            <button type="button" id="autoBumpLogToggle" class="fpt-ui-button fpt-ui-button--tertiary fp-autobump-log-toggle" aria-expanded="false" aria-controls="autoBumpConsole">
                                <span class="auto-bump-log-toggle-label">Открыть журнал</span>
                            </button>
                        </div>
                        <div id="autoBumpStatus" class="fp-autobump-status" data-status="idle">
                            <span class="fp-autobump-status-dot" aria-hidden="true"></span>
                            <div class="fp-autobump-status-copy">
                                <span class="fp-autobump-status-caption">Последнее действие</span>
                                <span id="autoBumpLastStatus" class="fp-autobump-status-text">Событий пока нет</span>
                            </div>
                        </div>
                        <div id="autoBumpConsole" class="fp-autobump-log-list" hidden aria-live="polite" aria-label="Журнал автоподнятия"></div>
                    </section>
                </div>
                <div class="fp-tools-page-content" data-page="global_chat">
                    <h3>Чат сообщества</h3>
                    <p class="template-info">Чат для пользователей расширения</p>
                    
                    <!-- ПРЕДУПРЕЖДЕНИЕ О ПРАВИЛАХ ЧАТА -->
                    <div class="fpt-gc-disclaimer" style="flex-direction: column; gap: 10px;">
                        <div style="display:flex; align-items:flex-start; gap: 6px;">
                            <span class="material-symbols-rounded" style="color:#e05252;">shield</span>
                            <span>Это чат сообщества FunPay Funcy. Будьте вежливы и уважайте других участников. За нарушения — блокировка в чате.</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.2); border: 1px dashed rgba(224, 82, 82, 0.4); border-radius: 6px; padding: 10px; font-size: 11px;">
                            <b style="color: #ff6b6b; display: block; margin-bottom: 4px;">ЗАПРЕЩЕНО:</b>
                            Спам и флуд, реклама, оскорбления, разжигание, обман. Соблюдайте порядок — чат для общения по FunPay Funcy.
                        </div>
                    </div>

                    <div id="fpt-gc-feed" class="fpt-gc-feed">
                        <div class="fpt-gc-loading">Загрузка сообщений…</div>
                    </div>
                    <div class="fpt-gc-composer">
                        <textarea id="fpt-gc-input" rows="1" placeholder="Сообщение…" maxlength="300"></textarea>
                        <button id="fpt-gc-send" type="button" class="fpt-gc-send-btn" title="Отправить"><span class="material-symbols-rounded">send</span></button>
                    </div>
                    <div id="fpt-gc-status" class="fpt-gc-status"></div>
                </div>
                <div class="fp-tools-page-content" data-page="calculator">
                    <h3>Калькуляторы</h3>
                    <div class="calc-subtabs" role="tablist" aria-label="Режимы калькулятора">
                        <button type="button" id="fptCalculatorMathTab" class="calc-subtab is-active" role="tab" aria-selected="true" aria-controls="fptCalculatorMathPane" tabindex="0" data-calc-mode="math"><span class="material-symbols-rounded">calculate</span><span>Обычный</span></button>
                        <button type="button" id="fptCalculatorTimeTab" class="calc-subtab" role="tab" aria-selected="false" aria-controls="fptCalculatorTimePane" tabindex="-1" data-calc-mode="time"><span class="material-symbols-rounded">schedule</span><span>Время</span></button>
                        <button type="button" id="fptCalculatorCurrencyTab" class="calc-subtab" role="tab" aria-selected="false" aria-controls="fptCalculatorCurrencyPane" tabindex="-1" data-calc-mode="currency"><span class="material-symbols-rounded">currency_exchange</span><span>Валюты</span></button>
                    </div>
                    <div id="fptCalculatorMathPane" class="calc-pane active" data-calc-pane="math" role="tabpanel" aria-labelledby="fptCalculatorMathTab" aria-hidden="false">
                    <div class="calculator-container"><div class="calculator-display"><span id="calcDisplay">0</span></div><div class="calculator-buttons"><button class="calc-btn calc-btn-light" data-action="clear">AC</button><button class="calc-btn calc-btn-light" data-action="toggle-sign">+/-</button><button class="calc-btn calc-btn-light" data-action="percentage">%</button><button class="calc-btn calc-btn-operator" data-action="divide">÷</button><button class="calc-btn" data-key="7">7</button><button class="calc-btn" data-key="8">8</button><button class="calc-btn" data-key="9">9</button><button class="calc-btn calc-btn-operator" data-action="multiply">×</button><button class="calc-btn" data-key="4">4</button><button class="calc-btn" data-key="5">5</button><button class="calc-btn" data-key="6">6</button><button class="calc-btn calc-btn-operator" data-action="subtract">−</button><button class="calc-btn" data-key="1">1</button><button class="calc-btn" data-key="2">2</button><button class="calc-btn" data-key="3">3</button><button class="calc-btn calc-btn-operator" data-action="add">+</button><button class="calc-btn calc-btn-zero" data-key="0">0</button><button class="calc-btn" data-action="decimal">.</button><button class="calc-btn calc-btn-operator" data-action="calculate">=</button></div></div>
                    </div>
                    <div id="fptCalculatorTimePane" class="calc-pane" data-calc-pane="time" role="tabpanel" aria-labelledby="fptCalculatorTimeTab" aria-hidden="true" hidden>
                        <p class="template-info" style="margin-top:0;">Опишите ситуацию обычными словами - калькулятор посчитает время.</p>
                        <textarea id="calcTimeInput" class="template-input" rows="4" placeholder="Напр.: через 60 минут заказ, но на 5 минут отойду через 25 минут, а когда приду - 10-20 минут на дизайн. Сколько останется на подготовку?"></textarea>
                        <button id="calcTimeBtn" class="btn btn-default" style="margin-top:10px;width:100%;"><span class="material-symbols-rounded" style="vertical-align:middle;font-size:18px;">bolt</span> Посчитать</button>
                        <div id="calcTimeResult" class="calc-time-result" hidden></div>
                    </div>
                    <div id="fptCalculatorCurrencyPane" class="calc-pane" data-calc-pane="currency" role="tabpanel" aria-labelledby="fptCalculatorCurrencyTab" aria-hidden="true" hidden>
                        <h3>Калькулятор валют</h3>
                        <p class="template-info">Курсы обновляются раз в день. Используется открытый API.</p>
                        <div class="currency-converter-container"><div class="currency-input-group"><input type="number" id="currencyAmountFrom" class="template-input currency-input" value="100"><select id="currencySelectFrom" class="template-input currency-select"></select></div><div class="currency-swap-container"><button id="currencySwapBtn" class="currency-swap-btn">⇅</button><div id="currencyRateDisplay" class="currency-rate-display"></div></div><div class="currency-input-group"><input type="text" id="currencyAmountTo" class="template-input currency-input" readonly><select id="currencySelectTo" class="template-input currency-select"></select></div></div><div id="currency-error-display" class="currency-error"></div>
                    </div>
                </div>
                <div class="fp-tools-page-content" data-page="effects">
                    <h3>Эффекты частиц</h3>
                    <div class="checkbox-label-inline"><input type="checkbox" id="cursorFxEnabled"><label for="cursorFxEnabled" style="margin-bottom:0;"><span>Включить эффекты частиц</span></label></div>
                    <div class="template-container"><label for="cursorFxType">Тип эффекта:</label><select id="cursorFxType"><option value="sparkle">Искры</option><option value="trail">След</option><option value="snow">Снег</option><option value="blood">Кровь</option></select></div>
                    <div class="template-container color-input-grid"><div><label for="cursorFxColor1">Цвет 1:</label><input type="color" id="cursorFxColor1" class="theme-color-input" value="#FF6B6B"></div><div><label for="cursorFxColor2">Цвет 2 (градиент):</label><input type="color" id="cursorFxColor2" class="theme-color-input" value="#1b75bb"></div></div>
                    <div class="checkbox-label-inline"><input type="checkbox" id="cursorFxRgb"><label for="cursorFxRgb" style="margin-bottom:0;"><span>Радужный (RGB)</span></label></div>
                    <div class="template-container"><div class="range-label"><label for="cursorFxCount">Интенсивность:</label><span id="cursorFxCountValue">50%</span></div><input type="range" id="cursorFxCount" min="0" max="100" step="1"></div>
                    <div style="margin-top: 20px;"><button id="resetCursorFxBtn" class="btn btn-default">Сбросить эффекты</button></div>
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 25px 0;"></div>
                    <h3>Пользовательский курсор</h3>
                    <div class="checkbox-label-inline"><input type="checkbox" id="customCursorEnabled"><label for="customCursorEnabled" style="margin-bottom:0;"><span>Включить свой курсор</span></label></div>
                    <div id="customCursorControls" style="display: none;"><div class="template-container"><label>Изображение курсора:</label><div id="cursor-image-preview" style="width:64px; height:64px; background-color:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:10px; background-size:contain; background-position:center; background-repeat: no-repeat; display:flex; align-items:center; justify-content:center; color: var(--fptm-muted, #888); font-size:12px;">Нет</div><button id="uploadCursorImageBtn" class="btn">Загрузить</button><button id="removeCursorImageBtn" class="btn btn-default" style="margin-left: 10px;">Удалить</button><input type="file" id="cursorImageInput" accept="image/*" style="display: none;"></div><div class="checkbox-label-inline"><input type="checkbox" id="hideSystemCursor" checked><label for="hideSystemCursor" style="margin-bottom:0;"><span>Скрыть системный курсор</span></label></div><div class="template-container"><div class="range-label"><label for="customCursorSize">Размер:</label><span id="customCursorSizeValue">32px</span></div><input type="range" id="customCursorSize" min="16" max="128" step="1" value="32"></div><div class="template-container"><div class="range-label"><label for="customCursorOpacity">Прозрачность:</label><span id="customCursorOpacityValue">100%</span></div><input type="range" id="customCursorOpacity" min="0" max="100" step="1" value="100"></div></div>
                </div>
                <div class="fp-tools-page-content" data-page="overview">
                    <h3>Справочник функций</h3>
                    <div class="overview-container"><h3 style="border:none">Видео-обзор функций</h3><p class="template-info">Посмотрите короткий кинематографический ролик, демонстрирующий все возможности FunPay Funcy в действии. Откройте для себя инструменты, о которых вы могли не знать!</p><div class="overview-promo-art"></div><button id="start-overview-tour-btn" class="btn">▶️ Начать обзор</button></div>
                    <div class="feature-list-container"><h3>Справочник по функциям</h3><div class="feature-item"><div class="feature-title"><span class="material-icons">smart_toy</span>ИИ-Ассистент в чате</div><div class="feature-location"><strong>Где найти:</strong> В любом чате, кнопка "AI" рядом с полем ввода.</div><div class="feature-desc">Улучшает ваш текст, делая его вежливым и профессиональным. Активируйте режим и нажмите Enter для обработки. Также предупреждает о грубости.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">auto_fix_high</span>AI-Генератор лотов</div><div class="feature-location"><strong>Где найти:</strong> На странице создания/редактирования лота.</div><div class="feature-desc">Создает название и описание для лота на основе ваших идей, анализируя и копируя стиль ваших существующих предложений.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">add_photo_alternate</span>AI-Генератор изображений</div><div class="feature-location"><strong>Где найти:</strong> На странице создания/редактирования лота, в разделе "Изображения".</div><div class="feature-desc">Создавайте уникальные и стильные превью для ваших предложений с помощью встроенного генератора, в том числе по текстовому запросу.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">palette</span>Полная кастомизация</div><div class="feature-location"><strong>Где найти:</strong> Страница «Темы».</div><div class="feature-desc">Измените внешний вид FunPay: установите анимированный фон, настройте цвета, шрифты, прозрачность блоков и даже расположение верхней панели.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">auto_fix_normal</span>"Кастомизатор (режим редактора)</div><div class="feature-location"><strong>Где найти:</strong> Страница «Темы».</div><div class="feature-desc">Редактируйте любой элемент сайта в реальном времени. Меняйте цвета, размеры или скрывайте ненужное, сохраняя стили навсегда.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">description</span>Шаблоны и AI-переменные</div><div class="feature-location"><strong>Где найти:</strong> Под полем ввода в чате. Настраиваются на странице «Быстрые ответы», во вкладке «Шаблоны».</div><div class="feature-desc">Быстрая вставка готовых сообщений. Поддерживают переменные {buyername}, {date} и даже генерацию текста через {ai:ваш запрос}.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">checklist</span>Управление лотами и ценами</div><div class="feature-location"><strong>Где найти:</strong> На странице вашего профиля (funpay.com/users/...).</div><div class="feature-desc">Кнопка "Выбрать" позволяет выделить несколько лотов для массового удаления, дублирования, отключения или редактирования цен.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">control_point_duplicate</span>Клонирование лотов</div><div class="feature-location"><strong>Где найти:</strong> На странице редактирования любого вашего лота.</div><div class="feature-desc">Кнопка "Копировать" позволяет создать точную копию лота или массово размножить его по разным категориям (например, по разным серверам).</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">content_copy</span>Копировать лот со страницы заказа</div><div class="feature-location"><strong>Где найти:</strong> На странице купленного заказа (funpay.com/orders/...), кнопка под блоком "Оплаченный товар".</div><div class="feature-desc">Создаёт копию купленного лота через тот же мастер, что и обычное клонирование: подтягивает описание, автоматически переводит его на английский и, если у лота была автовыдача, сразу вставляет выданный товар в поле автовыдачи.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">public</span>Глобальный импорт лотов</div><div class="feature-location"><strong>Где найти:</strong> На странице редактирования лота, кнопка "Импорт".</div><div class="feature-desc">Импортируйте название и описание любого лота с FunPay, чтобы анализировать конкурентов или использовать как основу.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">sort_by_alpha</span>Сортировка по отзывам</div><div class="feature-location"><strong>Где найти:</strong> На любой странице со списком лотов.</div><div class="feature-desc">Кликните на заголовок "Продавец" в таблице, чтобы отсортировать все предложения по количеству отзывов у продавцов.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">label</span>Пометки для пользователей</div><div class="feature-location"><strong>Где найти:</strong> В выпадающем меню в заголовке чата с человеком.</div><div class="feature-desc">Устанавливайте настраиваемые цветные метки для пользователей, которые будут видны в вашем списке контактов.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">rocket_launch</span>Автоподнятие лотов</div><div class="feature-location"><strong>Где найти:</strong> Страница «Автоподнятие».</div><div class="feature-desc">Настройте автоматическое поднятие лотов по таймеру. Можно выбрать для поднятия только определенные категории.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">monitoring</span>Статистика</div><div class="feature-location"><strong>Где найти:</strong> В FunPay: страница «Продажи» для статистики и кнопка «Аналитика рынка» на странице игры.</div><div class="feature-desc">Получайте детальную статистику по своим продажам и анализируйте рыночную ситуацию в любой категории.</div></div><div class="feature-item"><div class="feature-title"><span class="material-icons">savings</span>Финансовые копилки</div><div class="feature-location"><strong>Где найти:</strong> Страница «Копилки» и иконка в шапке сайта.</div><div class="feature-desc">Устанавливайте финансовые цели и отслеживайте их достижение. Копилка синхронизируется с балансом FunPay.</div></div></div>
                </div>
                <div class="fp-tools-page-content" data-page="settings_io">
                    <h3>Перенос настроек</h3>
                    <p class="template-info">Сохраните все настройки FunPay Funcy в файл и восстановите на другом устройстве или аккаунте.</p>
                    <div style="display:flex;gap:12px;margin-bottom:20px;">
                        <button id="fp-settings-export-btn" class="btn" style="flex:1;"><span class="material-symbols-rounded" style="font-size:16px;vertical-align:-3px;margin-right:5px;">upload</span>Экспортировать настройки</button>
                        <button id="fp-settings-import-btn" class="btn btn-default" style="flex:1;"><span class="material-symbols-rounded" style="font-size:16px;vertical-align:-3px;margin-right:5px;">download</span>Импортировать настройки</button>
                        <input type="file" id="fp-settings-import-input" accept=".fpconfig,.json" style="display:none;">
                    </div>
                    <p class="template-info">Файл сохраняется с расширением <code>.fpconfig</code>. Импорт перезагрузит страницу.</p>

                    <h3 style="margin-top:24px;">Сброс данных</h3>
                    <p class="template-info">Удалить только определённые данные, не затрагивая остальные настройки.</p>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <button id="fp-reset-autoresponder-btn" class="btn btn-default" style="width:auto;padding:8px 14px;">Сбросить данные автоответчика (обработанные ID)</button>
                        <button id="fp-reset-pinned-btn" class="btn btn-default" style="width:auto;padding:8px 14px;">Очистить закреплённые лоты</button>
                        <button id="fp-reset-greeted-btn" class="btn btn-default" style="width:auto;padding:8px 14px;">Сбросить список поприветствованных чатов</button>
                        <button id="fp-reset-april-btn" class="btn btn-default" style="width:auto;padding:8px 14px;">Сбросить счётчик даты</button>
                    </div>
                    <div style="margin-top:24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                        <span class="fp-site-footer-link"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:-2px;margin-right:4px;">link</span>FunPay Funcy</span>
                    </div>
                </div>

                <div class="fp-tools-page-content" data-page="blacklist">
                    <h3>Чёрный список покупателей</h3>
                    <p class="template-info">Добавьте ненадёжных покупателей. Вы сможете заблокировать на них автоматизаию и уведомления.</p>
                    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
                        <input type="text" id="fp-bl-name-input" placeholder="Имя пользователя FunPay" style="background:var(--fptm-surface-2, #0e0f16);border:1px solid var(--fptm-border, #22253a);border-radius:6px;padding:8px;color:var(--fptm-text, #d8dae8);font-size:13px;outline:none;">
                        <input type="text" id="fp-bl-note-input" placeholder="Причина (необязательно)" style="background:var(--fptm-surface-2, #0e0f16);border:1px solid var(--fptm-border, #22253a);border-radius:6px;padding:8px;color:var(--fptm-text, #d8dae8);font-size:13px;outline:none;">
                        <button id="fp-bl-add-btn" class="btn btn-default">+ Добавить в ЧС</button>
                    </div>
                    <div id="fp-bl-list"></div>
                </div>

                <div class="fp-tools-page-content" data-page="auto_delivery">
                    <header class="fpt-ui-page-header fp-ad-page-header">
                        <div class="fp-ad-page-header-copy">
                            <h3 class="fpt-ui-page-title fp-ad-page-title">Автовыдача товаров</h3>
                            <p class="fpt-ui-helper fp-ad-page-description">Настройте автоматическую отправку товара покупателю и поведение лотов при изменении остатков.</p>
                        </div>
                    </header>

                    <section class="fpt-ui-surface fp-ad-section fp-ad-automation-section" aria-labelledby="fp-ad-automation-title">
                        <div class="fpt-ui-section-header fp-ad-section-header">
                            <div>
                                <h4 id="fp-ad-automation-title" class="fpt-ui-section-title">Автоматизация склада</h4>
                                <p class="fpt-ui-helper fp-ad-section-description">Глобальные правила для восстановления и деактивации лотов.</p>
                            </div>
                        </div>
                        <div class="fp-ad-settings-list">
                            <div class="fpt-ui-setting-row fp-ad-setting-row">
                                <label class="fp-ad-setting-copy" for="fpAutoRestoreEnabled">
                                    <span class="fp-ad-setting-title">Автовосстановление лотов</span>
                                    <span class="fpt-ui-helper fp-ad-setting-description">Возвращать деактивированный лот, когда товар снова появился на складе.</span>
                                </label>
                                <input type="checkbox" id="fpAutoRestoreEnabled" class="fp-ad-setting-checkbox">
                            </div>
                            <div class="fpt-ui-setting-row fp-ad-setting-row">
                                <label class="fp-ad-setting-copy" for="fpAutoDisableEnabled">
                                    <span class="fp-ad-setting-title">Автодеактивация при пустом складе</span>
                                    <span class="fpt-ui-helper fp-ad-setting-description">Скрывать настроенный лот, когда остаток товара становится равен нулю.</span>
                                </label>
                                <input type="checkbox" id="fpAutoDisableEnabled" class="fp-ad-setting-checkbox">
                            </div>
                        </div>
                    </section>

                    <section class="fpt-ui-surface fp-ad-section fp-ad-lots-section" aria-labelledby="fp-ad-lots-title">
                        <div class="fpt-ui-section-header fp-ad-section-header fp-ad-lots-header">
                            <div class="fp-ad-lots-heading">
                                <h4 id="fp-ad-lots-title" class="fpt-ui-section-title">Автовыдача по лотам</h4>
                                <p class="fpt-ui-helper fp-ad-section-description">Выберите лот и источник выдачи. Без отдельной настройки используется содержимое поля «Секреты» лота.</p>
                            </div>
                            <button type="button" id="fp-load-delivery-lots-btn" class="fpt-ui-button fpt-ui-button--secondary fp-ad-load-btn">
                                <svg class="fp-ad-button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                    <path d="M5 7.5h14M7.5 4.5h9A1.5 1.5 0 0 1 18 6v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V6a1.5 1.5 0 0 1 1.5-1.5ZM9 11h6M9 14.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span class="fp-ad-load-label">Загрузить лоты</span>
                            </button>
                        </div>

                        <details class="fp-ad-variables">
                            <summary class="fp-ad-variables-summary">
                                <span>Доступные переменные</span>
                                <span class="fp-ad-variables-chevron" aria-hidden="true"></span>
                            </summary>
                            <div class="fp-ad-variable-list">
                                <div class="fp-ad-variable"><code>{buyername}</code><span>имя покупателя</span></div>
                                <div class="fp-ad-variable"><code>{orderid}</code><span>ID заказа</span></div>
                                <div class="fp-ad-variable"><code>{orderlink}</code><span>ссылка на заказ</span></div>
                                <div class="fp-ad-variable"><code>$username</code><span>имя покупателя, legacy</span></div>
                                <div class="fp-ad-variable"><code>$order_link</code><span>ссылка на заказ, legacy</span></div>
                                <div class="fp-ad-variable"><code>$order_id</code><span>ID заказа, legacy</span></div>
                                <div class="fp-ad-variable"><code>$sleep=3</code><span>пауза в секундах</span></div>
                            </div>
                        </details>

                        <div id="fp-delivery-lots-list" class="fp-ad-lots-list" aria-live="polite" aria-busy="false">
                            <div class="fpt-ui-state fp-ad-list-state fp-ad-list-state--idle" data-state="idle">
                                <svg class="fp-ad-state-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                    <path d="M5 7.5h14M7.5 4.5h9A1.5 1.5 0 0 1 18 6v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V6a1.5 1.5 0 0 1 1.5-1.5ZM9 11h6M9 14.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <p class="fpt-ui-state-title">Список ещё не загружен</p>
                                <p class="fpt-ui-state-text">Загрузите свои лоты, чтобы включить автовыдачу и настроить источник товара.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div class="fp-tools-page-content" data-page="tickets" style="position:relative;">
                    <style>
                        #fp-tickets-list::-webkit-scrollbar{width:4px}
                        #fp-tickets-list::-webkit-scrollbar-track{background:transparent}
                        #fp-tickets-list::-webkit-scrollbar-thumb{background:var(--fptm-surface, #2a2d44);border-radius:4px}
                        #fp-ticket-confirm-text::-webkit-scrollbar{width:4px}
                        #fp-ticket-confirm-text::-webkit-scrollbar-thumb{background:var(--fptm-surface, #2a2d44);border-radius:4px}
                        #fp-ticket-age-hours::-webkit-inner-spin-button,#fp-ticket-age-hours::-webkit-outer-spin-button,
                        #fp-ticket-max-orders::-webkit-inner-spin-button,#fp-ticket-max-orders::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
                        #fp-ticket-age-hours,#fp-ticket-max-orders{-moz-appearance:textfield}
                        .fp-tkt-card{background:var(--fptm-surface-2, #0d0e18);border:1px solid var(--fptm-border, #1a1c2e);border-radius:8px;padding:10px 12px;cursor:pointer;transition:border-color .15s,background .15s;}
                        .fp-tkt-card:hover{border-color:#1b75bb;background:var(--fptm-surface, #11122a);}
                        .fp-tkt-status{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.3px;}
                        #fp-new-ticket-fields::-webkit-scrollbar{width:4px}
                        #fp-new-ticket-fields::-webkit-scrollbar-track{background:transparent}
                        #fp-new-ticket-fields::-webkit-scrollbar-thumb{background:var(--fptm-surface, #2a2d44);border-radius:4px}
                        .fp-field-input{width:100%;background:var(--fptm-surface-2, #0d0e18);border:1px solid var(--fptm-border, #1a1c2e);border-radius:6px;color:var(--fptm-text, #d8dae8);padding:7px 10px;font-size:13px;box-sizing:border-box;outline:none;transition:border-color .15s;}
                        .fp-field-input:focus{border-color:#1b75bb;}
                        .fp-field-input option{background:var(--fptm-surface-2, #0d0e18);color:var(--fptm-text, #d8dae8);}
                    </style>

                    <!-- Header -->
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <h3 style="margin:0;font-size:15px;">Поддержка FunPay</h3>
                        <button id="fp-ticket-refresh-btn" title="Обновить" style="background:none;border:none;color:var(--fptm-faint, #5a5f7a);cursor:pointer;font-size:16px;padding:2px 6px;transition:color .15s;" onmouseover="this.style.color='#d8dae8'" onmouseout="this.style.color='#5a5f7a'">↻</button>
                    </div>

                    <!-- Auto ticket block -->
                    <div style="background:rgba(27,117,187,0.06);border:1px solid rgba(27,117,187,0.18);border-radius:8px;padding:11px 12px;margin-bottom:12px;">
                        <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:#4a9fd4;"><span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:5px;">mail</span>Подтверждение заказов</div>
                        <p style="font-size:12px;color:var(--fptm-muted, #6a7090);margin:0 0 10px;line-height:1.5;">FunPay не всегда подтверждает заказы автоматически. Кнопка ниже соберёт все ваши неподтверждённые заказы и отправит заявку в ТП с просьбой их подтвердить - вручную делать не надо.</p>
                        <div style="display:flex;gap:10px;margin-bottom:10px;">
                            <label style="font-size:11px;color:var(--fptm-muted, #6a7090);display:flex;flex-direction:column;gap:3px;flex:1;">
                                Возраст заказа (ч)
                                <input type="number" id="fp-ticket-age-hours" min="1" max="168" value="24" class="fp-field-input" style="padding:5px 8px;font-size:12px;">
                            </label>
                            <label style="font-size:11px;color:var(--fptm-muted, #6a7090);display:flex;flex-direction:column;gap:3px;flex:1;">
                                Заказов в заявке (макс)
                                <input type="number" id="fp-ticket-max-orders" min="1" max="20" value="5" class="fp-field-input" style="padding:5px 8px;font-size:12px;">
                            </label>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <button id="fp-send-auto-ticket-btn" class="btn" style="padding:6px 14px;font-size:12px;">Отправить заявку в ТП</button>
                            <span id="fp-auto-ticket-status" style="font-size:11px;color:var(--fptm-faint, #5a5f7a);"></span>
                        </div>
                    </div>

                    <!-- Tickets list header -->
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:11px;font-weight:600;color:var(--fptm-faint, #3a3d52);text-transform:uppercase;letter-spacing:.5px;">Ваши заявки</span>
                        <button id="fp-create-ticket-btn" class="btn btn-default" style="padding:3px 10px;font-size:11px;">+ Создать заявку</button>
                    </div>

                    <!-- Filters (поиск + статус + сортировка) - фильтрация локальная, все заявки грузятся сразу -->
                    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
                        <input type="text" id="fp-tickets-search" placeholder="Поиск по заявкам..." class="fp-field-input" style="padding:6px 8px;font-size:12px;width:100%;box-sizing:border-box;">
                        <div style="display:flex;gap:8px;">
                            <select id="fp-tickets-status-filter" class="fp-field-input" style="padding:5px 8px;font-size:12px;flex:1;">
                                <option value="all" selected>Все</option>
                                <option value="active">Актуальные</option>
                                <option value="solved">Закрытые</option>
                            </select>
                            <select id="fp-tickets-sort" class="fp-field-input" style="padding:5px 8px;font-size:12px;flex:1;">
                                <option value="newest_first" selected>Сначала новые</option>
                                <option value="oldest_first">Сначала старые</option>
                                <option value="last_answered">Последние отвеченные</option>
                            </select>
                        </div>
                        <span id="fp-tickets-count" style="font-size:11px;color:var(--fptm-faint, #3a3d52);"></span>
                    </div>

                    <!-- List -->
                    <div id="fp-tickets-list" style="display:flex;flex-direction:column;gap:5px;max-height:240px;overflow-y:auto;"></div>
                    <div id="fp-tickets-empty" style="display:none;text-align:center;color:var(--fptm-faint, #3a3d52);font-size:13px;padding:18px 0;">Заявок нет</div>
                    <div id="fp-tickets-loading" style="text-align:center;color:var(--fptm-faint, #3a3d52);font-size:12px;padding:14px 0;">Загрузка...</div>

                    <!-- Ticket detail panel -->
                    <div id="fp-ticket-detail-panel" style="display:none;position:absolute;inset:0;background:var(--fptm-surface, #111318);z-index:20;box-sizing:border-box;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                        <style>
                            #fp-tdm::-webkit-scrollbar{width:3px}
                            #fp-tdm::-webkit-scrollbar-thumb{background:var(--fptm-surface, #2a2d3a);border-radius:3px}
                            #fp-tri{outline:none;caret-color:#1b75bb;background:var(--fptm-surface, #23243a) !important;border:none !important;box-shadow:none !important;border-radius:0 !important;padding:0 !important;margin:0 !important;}
                            #fp-tri::-webkit-scrollbar{width:2px}
                            #fp-tri::-webkit-scrollbar-thumb{background:var(--fptm-surface, #2a2d3a);}
                            .fp-msg-img{max-width:100%;border-radius:8px;margin-top:4px;display:block;cursor:pointer;}
                        </style>
                        <!-- Top bar -->
                        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--fptm-surface, #1a1b22);flex-shrink:0;border-bottom:1px solid #0d0e14;">
                            <button id="fp-ticket-detail-back" style="all:unset;position:relative;overflow:hidden;color:#1b75bb;cursor:pointer;font-size:22px;line-height:1;padding:2px 6px 2px 0;flex-shrink:0;">&#8249;</button>
                            <div id="fp-tkt-av" style="width:32px;height:32px;border-radius:50%;background:var(--fptm-surface, #23243a);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#1b75bb;overflow:hidden;"></div>
                            <div style="flex:1;min-width:0;">
                                <div id="fp-ticket-detail-title" style="font-size:14px;font-weight:600;color:var(--fptm-text, #e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;"></div>
                                <div id="fp-ticket-detail-status" style="font-size:11px;margin-top:1px;line-height:1;"></div>
                            </div>
                        </div>
                        <!-- Messages -->
                        <div id="fp-tdm" style="flex:1;overflow-y:auto;padding:10px 10px 6px;display:flex;flex-direction:column;gap:3px;background:var(--fptm-surface, #111318);"></div>
                        <!-- Attach preview -->
                        <div id="fp-tapr" style="display:none;flex-shrink:0;padding:6px 12px 0;background:var(--fptm-surface, #1a1b22);">
                            <div style="position:relative;display:inline-block;">
                                <img id="fp-tath" style="height:48px;border-radius:6px;border:1px solid var(--fptm-border, #2a2d3a);display:block;" src="" alt="">
                                <button id="fp-tarm" style="all:unset;position:absolute;top:-5px;right:-5px;background:var(--fptm-surface, #2a2d3a);border-radius:50%;width:16px;height:16px;color:var(--fptm-muted, #9099b8);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">&#x2715;</button>
                            </div>
                        </div>
                        <!-- Input bar -->
                        <div id="fp-tria" style="display:none;flex-shrink:0;align-items:flex-end;gap:6px;padding:6px 10px 8px;background:var(--fptm-surface, #111318);">
                            <label id="fp-attach-lbl" style="all:unset;display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;color:#4a4f6a;flex-shrink:0;" title="Прикрепить">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                                <input type="file" id="fp-ticket-attach-input" accept="image/*" style="display:none;">
                            </label>
                            <div style="flex:1;background:var(--fptm-surface, #23243a);border-radius:20px;padding:7px 14px;display:flex;align-items:flex-end;min-height:36px;box-sizing:border-box;">
                                <textarea id="fp-tri" placeholder="Сообщение..." style="all:unset;-webkit-appearance:none;appearance:none;width:100%;color:var(--fptm-text, #e8eaf0);font-size:13px;line-height:1.45;height:20px;max-height:90px;overflow-y:hidden;font-family:inherit;display:block;resize:none;background:var(--fptm-surface, #23243a) !important;" rows="1"></textarea>
                            </div>
                            <button id="fp-ticket-reply-btn" style="all:unset;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#1b75bb;cursor:pointer;flex-shrink:0;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" style="margin-left:2px;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            </button>
                        </div>
                    </div>
                    <!-- Confirm overlay -->
                    <div id="fp-ticket-confirm-overlay" style="display:none;position:absolute;inset:0;background:rgba(5,6,12,0.96);z-index:10;border-radius:8px;padding:18px;box-sizing:border-box;flex-direction:column;gap:10px;">
                        <div style="font-weight:600;font-size:14px;">Проверьте заявку перед отправкой</div>
                        <div style="font-size:11px;color:var(--fptm-muted, #6a7090);">Именно это будет отправлено в техподдержку FunPay:</div>
                        <div id="fp-ticket-confirm-text" style="background:var(--fptm-surface-2, #0d0e18);border:1px solid var(--fptm-border, #1a1c2e);border-radius:6px;padding:10px;font-size:12px;color:var(--fptm-text, #c8cadc);white-space:pre-wrap;flex:1;overflow-y:auto;min-height:80px;max-height:180px;line-height:1.5;"></div>
                        <div style="display:flex;gap:8px;margin-top:2px;">
                            <button id="fp-ticket-confirm-yes" class="btn" style="flex:1;font-size:13px;">Отправить</button>
                            <button id="fp-ticket-confirm-no" class="btn btn-default" style="flex:1;font-size:13px;">Отмена</button>
                        </div>
                    </div>

                    <!-- New ticket panel (slides in from bottom) -->
                    <div id="fp-new-ticket-panel" style="display:none;position:absolute;inset:0;background:var(--fptm-surface-2, #0a0b14);z-index:20;border-radius:0;box-sizing:border-box;flex-direction:column;overflow:hidden;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;border-bottom:1px solid #1a1c2e;flex-shrink:0;">
                            <span style="font-weight:600;font-size:14px;">Новая заявка</span>
                            <button id="fp-new-ticket-close" style="background:none;border:none;color:var(--fptm-faint, #5a5f7a);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;" onmouseover="this.style.color='#d8dae8'" onmouseout="this.style.color='#5a5f7a'">✕</button>
                        </div>
                        <div id="fp-new-ticket-fields" style="display:flex;flex-direction:column;gap:6px;flex:1;overflow-y:auto;padding:10px 14px;"></div>
                        <div style="flex-shrink:0;padding:8px 14px 12px;border-top:1px solid #1a1c2e;background:var(--fptm-surface-2, #0a0b14);">
                            <button id="fp-new-ticket-submit" class="btn" style="width:100%;font-size:13px;">Далее →</button>
                        </div>
                    </div>
                </div>

                <div class="fp-tools-page-content" data-page="support">
                    <h3>Оценить расширение <span class="material-symbols-rounded" style="color:#f4c84a;vertical-align:-3px;">star</span></h3>
                    <div class="support-container">
                        <p>Это <strong>самый важный</strong> вклад, который вы можете сделать. Ваш положительный отзыв - это топливо для новых обновлений и лучшая мотивация для разработчика.</p>
                        <p>Хорошие оценки помогают другим пользователям найти FunPay Funcy. Пожалуйста, уделите всего минуту, чтобы поделиться своим мнением. Это действительно имеет огромное значение!</p>
                        <a href="https://chromewebstore.google.com/detail/funpay-tools/pibmnjjfpojnakckilflcboodkndkibb/reviews" target="_blank" class="btn review-btn"><span class="material-icons" style="font-size: 20px; margin-right: 8px;">rate_review</span>Оставить отзыв в Chrome Store</a>
                    </div>
                    <div style="margin-top:24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                        <span class="fp-site-footer-link"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:-2px;margin-right:4px;">link</span>FunPay Funcy</span>
                    </div>
                </div>
            </main>
        </div>
        <div class="fp-tools-footer">
            <button id="saveSettings" class="btn">Сохранить</button>
        </div>
    `;

    // Картинки внутри панели — элементы интерфейса, а не переносимые файлы.
    toolsPopup.querySelectorAll('img').forEach(img => { img.draggable = false; });
    toolsPopup.addEventListener('dragstart', (event) => {
        const target = event.target;
        if (target && typeof target.closest === 'function' && target.closest('img')) {
            event.preventDefault();
        }
    }, true);

    // Подставляем локальные иконки бренда и интеграций из папки icons.
    try {
        toolsPopup.querySelectorAll('img[data-icon]').forEach(img => {
            const key = img.getAttribute('data-icon');
            const assetPath = FPT_MENU_ASSET_PATHS[key] || `icons/${key}.png`;
            if (key) img.src = fptGetMenuAssetUrl(assetPath);
        });
    } catch (_) {}

    // Тема меню «под сайт» — как в окнах импорта/копирования лотов.
    fptInjectMenuThemeCSS();
    fptApplyMenuTheme(toolsPopup);
    // Перекрашиваем при смене темы FunPay/кастомной темы, пока меню на странице.
    if (!window.__fptMenuThemeObserver) {
        try {
            const mo = new MutationObserver(() => {
                clearTimeout(window.__fptMenuThemeT);
                window.__fptMenuThemeT = setTimeout(() => {
                    const p = document.querySelector('.fp-tools-popup');
                    if (p) fptApplyMenuTheme(p);
                }, 90);
            });
            mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
            if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
            window.__fptMenuThemeObserver = mo;
        } catch (_) {}
    }

    return toolsPopup;
}

// ── Тема меню FunPay Funcy «под сайт» (парсинговые цвета) ─────────────────────
// Логика та же, что в окнах копирования/импорта лота: читаем живые цвета сайта
// (фон, текст, акцент) и раскрашиваем меню под них. Акцент — фирменный голубой
// FunPay (#1b75bb, тот же, что fallback в cloneSurfaceColors/ui_enhancements),
// а не прежний фиолетовый. Светлая база FunPay → чистое светло-голубое меню
// как на макете; на тёмной теме сайта меню тоже подстраивается и остаётся
// читаемым.
const FPT_MENU_THEME_CSS = `
/* ─── контейнер ─────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed{
    background:var(--fptm-bg) !important;
    border:1px solid var(--fptm-border) !important;
    color:var(--fptm-text) !important;
    border-radius:16px !important;
    box-shadow:0 24px 70px var(--fptm-shadow) !important;
}
.fp-tools-popup.fptm-themed h1,.fp-tools-popup.fptm-themed h2,.fp-tools-popup.fptm-themed h3,
.fp-tools-popup.fptm-themed h4,.fp-tools-popup.fptm-themed h5,.fp-tools-popup.fptm-themed span,
.fp-tools-popup.fptm-themed div,.fp-tools-popup.fptm-themed li,.fp-tools-popup.fptm-themed td,
.fp-tools-popup.fptm-themed th,.fp-tools-popup.fptm-themed strong,.fp-tools-popup.fptm-themed b{ color:var(--fptm-text); }
.fp-tools-popup.fptm-themed p,.fp-tools-popup.fptm-themed label,.fp-tools-popup.fptm-themed .template-info,
.fp-tools-popup.fptm-themed .range-label,.fp-tools-popup.fptm-themed small{ color:var(--fptm-muted) !important; }
.fp-tools-popup.fptm-themed code,.fp-tools-popup.fptm-themed kbd{
    background:var(--fptm-surface-2) !important; color:var(--fptm-text) !important;
    border:1px solid var(--fptm-border) !important; border-radius:5px; padding:1px 5px;
}
.fp-tools-popup.fptm-themed a{ color:var(--fptm-accent); }
.fp-tools-popup.fptm-themed hr{ border-color:var(--fptm-border) !important; }

/* ─── шапка ──────────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-header{
    position:absolute; z-index:20; top:4px; right:4px; width:44px; height:44px; min-height:0;
    display:flex; align-items:center; justify-content:center; padding:4px; background:transparent !important;
    border:0 !important; border-radius:0;
}
.fp-tools-popup.fptm-themed .fp-tools-header h2{ color:var(--fptm-text) !important; font-weight:800 !important; }
.fp-tools-popup.fptm-themed .fp-tools-brand-logo{
    width:44px; height:44px; flex:0 0 44px; object-fit:contain; border-radius:12px; display:block; margin:0;
}
.fp-tools-popup.fptm-themed .fp-tools-site-link,
.fp-tools-popup.fptm-themed .fp-tools-site-link:hover{
    color:var(--fptm-text) !important; -webkit-text-fill-color:var(--fptm-text) !important;
    background:none !important; -webkit-background-clip:border-box !important; background-clip:border-box !important; animation:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-site-link::after{ background:var(--fptm-accent) !important; box-shadow:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-social{ display:flex; align-items:center; gap:8px; margin-right:auto; padding-left:14px; }
.fp-tools-popup.fptm-themed .fp-tools-social-btn{
    display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px;
    border-radius:9px; transition:transform .16s ease, background .16s ease; text-decoration:none;
}
.fp-tools-popup.fptm-themed .fp-tools-social-btn:hover{ transform:translateY(-2px); background:var(--fptm-accent-soft); }
.fp-tools-popup.fptm-themed .fp-tools-social-ico{ width:22px; height:22px; display:block; object-fit:contain; }
.fp-tools-popup.fptm-themed > .fp-tools-header .close-btn{
    background:transparent !important;
    border:0 !important;
    box-shadow:none !important;
    color:var(--fpt-close-icon) !important;
}
.fp-tools-popup.fptm-themed > .fp-tools-header .close-btn:hover{
    background:transparent !important;
    box-shadow:none !important;
    color:var(--fpt-close-icon-hover) !important;
}
.fp-tools-popup.fptm-themed > .fp-tools-header .close-btn:active{
    background:transparent !important;
    box-shadow:none !important;
}

/* ─── навигация ──────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-nav{
    width:256px; flex:0 0 256px; margin:16px 0 16px 16px; padding:18px 12px;
    background:var(--fptm-nav-surface) !important; border:1px solid var(--fptm-nav-border) !important;
    border-radius:20px; box-shadow:0 14px 34px var(--fptm-nav-row-shadow) !important;
    position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:0;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search{ padding:0; margin:0 0 18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico{
    left:18px; width:22px; height:22px; margin-top:0; font-size:22px; opacity:.72; color:var(--fptm-muted) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico svg{ width:22px; height:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input{
    min-height:56px; padding:12px 42px 12px 52px; border-radius:24px;
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field) !important;
    color:var(--fptm-text) !important; font-size:15px;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input:focus{
    border-color:var(--fptm-accent-border) !important; background:var(--fptm-nav-field-focus) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav ul{ list-style:none; margin:0; padding:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-scroll{ flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; margin:-10px -12px 0; padding:12px 12px 20px; scrollbar-width:none; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-scroll::-webkit-scrollbar{ display:none; width:0; height:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-groups{ display:flex; flex-direction:column; gap:6px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group{ min-width:0; border-radius:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{
    width:100%; min-width:0; height:54px; min-height:54px; display:flex; align-items:center; gap:12px;
    padding:0 12px; border:1px solid var(--fptm-nav-border) !important; border-radius:22px;
    background:var(--fptm-nav-row) !important; color:var(--fptm-text) !important;
    box-shadow:0 8px 20px var(--fptm-nav-row-shadow) !important; font:inherit; font-size:16px; font-weight:500; text-align:left; cursor:pointer;
    transition:background-color .24s cubic-bezier(.22,1,.36,1), color .24s cubic-bezier(.22,1,.36,1), border-color .24s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:hover{
    background:var(--fptm-nav-row-hover, var(--fptm-hover)) !important; color:var(--fptm-text) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{
    background:transparent !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover:not(:active){
    background:#7663f6 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{ width:34px; height:34px; flex:0 0 34px; object-fit:contain; display:block; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; color:inherit !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron svg{ width:20px; height:20px; display:block; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    flex:0 0 auto; margin-left:auto; transition:transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-chevron{ transform:rotate(90deg); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse{
    display:grid; grid-template-rows:0fr; min-height:0; transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-collapse{ grid-template-rows:1fr; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{ min-height:0; overflow:hidden; padding:0; border-radius:16px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{ background:var(--fptm-nav-child-surface); }
.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{ list-style:none; margin:0; padding:8px 6px 10px; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a{
    display:flex; align-items:center; min-height:44px; padding:8px 12px 8px 14px;
    gap:10px; color:var(--fptm-text) !important; background:transparent !important; border-radius:14px !important;
    box-shadow:none !important; border:1px solid transparent !important; font-size:15px; font-weight:500; transition:background .15s ease, color .15s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a:hover{ background:var(--fptm-hover) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a{
    background:var(--fptm-accent-soft) !important; color:var(--fptm-text) !important;
    border:1px solid transparent !important; font-weight:500;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a{
    background:transparent !important; color:var(--fptm-text) !important;
    border-color:transparent !important; font-weight:500 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li[data-page] a > span:last-child{
    min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a .nav-icon{ color:inherit !important; opacity:.92; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a{
    font-weight:500; padding-left:14px !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a .nav-icon{
    display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; flex:0 0 24px;
    font-size:22px; line-height:1; color:var(--fptm-muted) !important; opacity:.92;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav::-webkit-scrollbar-thumb{ background:var(--fptm-border) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav-cloud{ display:none !important; }

/* ─── reference menu and compact rail ────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-header{
    position:absolute; z-index:20; top:4px; right:4px; width:44px; height:44px; min-height:0;
    display:flex; align-items:center; justify-content:center; padding:4px; background:transparent !important;
    border:0 !important; border-radius:0;
}
.fp-tools-popup.fptm-themed .fp-tools-nav{
    box-sizing:border-box; width:256px; flex:0 0 256px; margin:16px 0 16px 16px; padding:18px 12px;
    border-radius:20px; background:var(--fptm-nav-surface) !important; border:1px solid var(--fptm-nav-border) !important;
    box-shadow:0 14px 34px var(--fptm-nav-row-shadow) !important; position:relative; display:flex; flex-direction:column;
    overflow:hidden; min-height:0; transition:width .32s cubic-bezier(.34,1.16,.64,1), flex-basis .32s cubic-bezier(.34,1.16,.64,1), padding-left .32s cubic-bezier(.34,1.16,.64,1), padding-right .32s cubic-bezier(.34,1.16,.64,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand{
    position:relative; display:flex; align-items:center; gap:12px; min-width:0; min-height:44px; margin:0 0 22px; transition:gap .38s cubic-bezier(.4,0,.2,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fp-tools-brand-logo{ margin:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand-title{
    min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--fptm-text) !important;
    font-size:18px; line-height:1.2; font-weight:650; letter-spacing:-.02em; max-width:160px; opacity:1;
    transition:max-width .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse{
    width:36px; height:36px; flex:0 0 36px; display:inline-flex; align-items:center; justify-content:center;
    margin-left:auto; padding:0; border:1px solid var(--fptm-nav-border) !important; border-radius:50%;
    background:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important; cursor:pointer;
    transition:width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1), flex-basis .38s cubic-bezier(.4,0,.2,1), background-color .16s ease, color .16s ease, border-color .16s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse svg{ width:18px; height:18px; display:block; transition:transform .38s cubic-bezier(.4,0,.2,1); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse:hover{ background:var(--fptm-nav-field) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse:focus-visible,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico:focus-visible,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn:focus-visible{ outline:2px solid #7663f6; outline-offset:2px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search{
    position:relative; width:100%; height:44px; flex:0 0 auto; margin:0 0 18px; padding:0;
    transition:width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico{
    position:absolute; z-index:1; top:50%; left:2px; width:44px; height:44px; display:inline-flex;
    align-items:center; justify-content:center; margin:0 !important; padding:0 !important; border:1px solid transparent !important; border-radius:50% !important;
    min-width:44px; min-height:44px; overflow:visible !important; pointer-events:auto; appearance:none; -webkit-appearance:none;
    background:transparent !important; color:var(--fptm-muted) !important; box-shadow:none !important;
    font-size:0; line-height:0; letter-spacing:0; text-transform:none; cursor:pointer; transform:translateY(-50%);
    transition:left .38s cubic-bezier(.4,0,.2,1), top .38s cubic-bezier(.4,0,.2,1),
        width .38s cubic-bezier(.4,0,.2,1), height .38s cubic-bezier(.4,0,.2,1),
        transform .38s cubic-bezier(.4,0,.2,1), background-color .24s ease, border-color .24s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico svg{ width:22px; height:22px; display:block; transform:translate(-.5px,-.5px); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input{
    box-sizing:border-box; width:100%; height:44px; min-height:44px; margin:0 !important; padding:8px 42px 8px 48px; border-radius:999px !important;
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field) !important;
    color:var(--fptm-text) !important; font-family:inherit; font-size:15px;
    opacity:1; visibility:visible; transition:opacity .16s ease, visibility .16s linear;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input:focus{
    border-color:var(--fptm-nav-border) !important; background:var(--fptm-nav-field-focus) !important;
    outline:none !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-groups{ display:flex; flex-direction:column; align-items:stretch; gap:6px; min-width:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group{ width:100%; min-width:0; border-radius:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{
    box-sizing:border-box; width:100%; min-width:0; height:54px; min-height:54px; display:flex; align-items:center; gap:12px; margin-inline:auto; padding:0 12px;
    border:1px solid transparent !important; border-radius:22px; background:transparent !important;
    color:var(--fptm-text) !important; box-shadow:none !important; font:inherit; font-size:16px; font-weight:500;
    text-align:left; cursor:pointer; transition:padding-left .38s cubic-bezier(.4,0,.2,1), gap .38s cubic-bezier(.4,0,.2,1), transform .38s cubic-bezier(.34,1.16,.64,1), background-color .24s cubic-bezier(.22,1,.36,1), color .24s cubic-bezier(.22,1,.36,1), border-color .24s cubic-bezier(.22,1,.36,1), box-shadow .24s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav:not(.is-nav-collapsed):not(.is-nav-opening) .fpt-nav-group-toggle:hover:not(:active){ transform:translateY(-1px) scale(1.012); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-toggle{
    background:transparent !important; border-color:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active{
    background:#7663f6 !important; border-color:transparent !important; color:#fff !important; box-shadow:0 8px 10px rgba(118,99,246,.22) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active:hover{ background:#6d59ed !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{ width:34px; height:34px; flex:0 0 34px; object-fit:contain; display:block; filter:brightness(0) invert(0) opacity(.82); transition:filter .24s ease; }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-icon,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(1); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-icon{ filter:brightness(0) invert(0) opacity(.82); }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav.is-nav-opening .fpt-nav-group.is-expanded .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title{
    min-width:0; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:inherit !important; opacity:1;
    transition:max-width .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{
    flex:0 0 20px; margin-left:auto; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; overflow:hidden; opacity:1;
    transition:width .38s cubic-bezier(.4,0,.2,1), flex-basis .38s cubic-bezier(.4,0,.2,1), opacity .26s ease .06s, transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse{ display:grid; grid-template-rows:0fr; min-height:0; transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1); }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-collapse{ grid-template-rows:1fr; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{ min-height:0; overflow:hidden; padding:0; border-radius:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{ background:transparent; }
.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{ list-style:none; margin:0; padding:6px 0 8px 0; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a{
    display:flex; align-items:center; min-height:44px; padding:8px 10px 8px 0; gap:10px; color:var(--fptm-text) !important;
    background:transparent !important; border-radius:10px !important; box-shadow:none !important; border:1px solid transparent !important;
    font-size:15px; font-weight:500; transition:background .15s ease, color .15s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li a:hover{ background:var(--fptm-nav-row-hover, rgba(118,99,246,.08)) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav li.active a,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child.active a{
    background:transparent !important; color:var(--fptm-text) !important; border-color:transparent !important; font-weight:500 !important;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li[data-page] a > span:last-child{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; }
.fp-tools-popup.fptm-themed .fp-tools-nav li a .nav-icon{ color:inherit !important; opacity:.92; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a::before{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child a .nav-icon{
    display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; flex:0 0 24px;
    font-size:22px; line-height:1; color:var(--fptm-muted) !important; opacity:.92;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child{
    max-height:80px; opacity:0; transform:translateY(4px);
    transition:max-height .18s ease, opacity .32s cubic-bezier(.22,1,.36,1), transform .32s cubic-bezier(.22,1,.36,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-child:not(.fpt-nav-hidden):not(.fpt-nav-section-hidden){
    opacity:1; transform:translateY(0);
    transition-delay:0s, var(--fpt-nav-child-delay, 0ms), var(--fpt-nav-child-delay, 0ms);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-footer{
    flex:0 0 auto; display:flex; flex-direction:column; align-items:stretch; justify-content:flex-start; gap:6px; min-height:62px; margin-top:auto;
    padding-top:14px; padding-left:0; border-top:1px solid var(--fptm-nav-border); transition:padding-left .38s cubic-bezier(.4,0,.2,1);
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-quick-actions{
    flex:0 0 auto; display:flex; flex-direction:column; align-items:stretch; gap:2px; min-width:0; margin:0; padding:0; list-style:none;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action{ flex:0 1 auto; min-width:0; max-width:100%; }
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a{
    box-sizing:border-box; width:100%; min-width:0; min-height:40px; display:flex; align-items:center; gap:8px;
    margin:0; padding:7px 10px; border:1px solid transparent !important; border-radius:12px !important;
    background:transparent !important; color:var(--fptm-text); font-size:13px; font-weight:500; text-decoration:none;
    transition:background-color .18s ease, color .18s ease;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a:hover,
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a:focus-visible{
    background:var(--fptm-nav-field) !important; color:var(--fptm-text); outline:none;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a .nav-icon{
    display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; flex:0 0 22px;
    color:var(--fptm-muted); font-size:20px; line-height:1;
}
.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a > span:last-child{
    min-width:0; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-quick-action.active a{ color:var(--fptm-text) !important; font-weight:600; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn{
    position:relative; width:48px !important; height:48px !important; min-width:48px !important; display:inline-flex !important;
    align-items:center !important; justify-content:center !important; margin:0 !important; padding:0 !important;
    border:0 !important; border-radius:16px !important; background:#7663f6 !important; color:#fff !important;
    box-shadow:0 5px 14px rgba(118,99,246,.20) !important; cursor:pointer;
}
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn svg{ width:20px; height:20px; display:block; pointer-events:none; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn:hover{ background:#6d59ed !important; box-shadow:0 5px 14px rgba(118,99,246,.22) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn::before,
.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-accent-btn::after{ content:none !important; display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed{ width:104px; flex:0 0 104px; padding-right:10px; padding-left:10px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-brand{ gap:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-brand-title,
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-title{ max-width:0; opacity:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-chevron{ width:0; flex-basis:0; margin-left:0; opacity:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-collapse{ width:28px; height:28px; flex-basis:28px; border-radius:50%; background:var(--fptm-nav-field) !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-collapse svg{ transform:rotate(180deg); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search{ width:44px; height:44px; align-self:center; margin-bottom:18px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-ico{
    top:0; left:0; width:44px; height:44px; border-color:var(--fptm-nav-border) !important;
    background:var(--fptm-nav-field) !important; transform:none;
}
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-input{ opacity:0; visibility:hidden; pointer-events:none; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-search-clear{ display:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-groups{ gap:6px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle{ width:100%; height:54px; min-height:54px; justify-content:flex-start; gap:0; padding:0 0 0 23px; border-radius:22px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active,
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active:hover{ background:transparent !important; color:var(--fptm-text) !important; box-shadow:none !important; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(0) opacity(.82); }
.fp-tools-popup.fptm-themed.fptm-dark .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:active .fpt-nav-group-icon{ filter:brightness(0) invert(1) opacity(.85); }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-icon{ width:34px; height:34px; flex-basis:34px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-footer{ align-items:center; padding-left:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-quick-actions{ width:44px; align-items:center; gap:4px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed li.fpt-nav-quick-action{ width:44px; max-width:44px; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed li.fpt-nav-quick-action a{ width:44px; height:44px; min-height:44px; justify-content:center; gap:0; padding:0; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed li.fpt-nav-quick-action a > span:last-child{ width:0; max-width:0; opacity:0; visibility:hidden; }
.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed .fpt-nav-group-toggle:hover:not(:active){ background:transparent !important; }
@media (prefers-reduced-motion: reduce){
    .fp-tools-popup.fptm-themed .fp-tools-nav,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-collapse,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-ico,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-brand-title,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-collapse svg,
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-footer{ transition-duration:.01ms !important; }
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-quick-actions,
    .fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a,
    .fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action a > span:last-child{ transition-duration:.01ms !important; }
    .fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-child{ transition-delay:0ms !important; }
}

/* ─── контент ────────────────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fp-tools-content{ background:var(--fptm-bg) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-content::-webkit-scrollbar-track{ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-content::-webkit-scrollbar-thumb{ background:var(--fptm-border) !important; }
.fp-tools-popup.fptm-themed .fp-tools-content.fpt-start-state-active{ display:flex; align-items:center; justify-content:center; }
.fp-tools-popup.fptm-themed .fp-tools-start-screen{
    box-sizing:border-box; width:100%; min-height:100%; display:none; flex-direction:column; align-items:center; justify-content:center;
    gap:12px; padding:36px; text-align:center; color:var(--fptm-text);
}
.fp-tools-popup.fptm-themed .fp-tools-content.fpt-start-state-active .fp-tools-start-screen{ display:flex; }
.fp-tools-popup.fptm-themed .fp-tools-start-screen-icon{
    width:64px; height:64px; display:inline-flex; align-items:center; justify-content:center; border-radius:22px;
    background:var(--fptm-accent-soft); color:var(--fptm-accent); font-size:32px;
}
.fp-tools-popup.fptm-themed .fp-tools-start-screen h2{ margin:4px 0 0; color:var(--fptm-text); font-size:22px; font-weight:650; }
.fp-tools-popup.fptm-themed .fp-tools-start-screen p{ max-width:360px; margin:0; color:var(--fptm-muted); font-size:14px; line-height:1.55; }
.fp-tools-popup.fptm-themed .setting-group,
.fp-tools-popup.fptm-themed .template-container,
.fp-tools-popup.fptm-themed .fp-tools-console,
.fp-tools-popup.fptm-themed .fpt-smart-bump-card,
.fp-tools-popup.fptm-themed .fpt-needs-ai-box,
.fp-tools-popup.fptm-themed .fpt-needs-ai-result,
.fp-tools-popup.fptm-themed .fpt-needs-list,
.fp-tools-popup.fptm-themed .fp-account-card,
.fp-tools-popup.fptm-themed .fpt-card,
.fp-tools-popup.fptm-themed .piggy-bank-card{
    background:var(--fptm-surface) !important; border:1px solid var(--fptm-border) !important;
    border-radius:14px !important; box-shadow:none !important;
}
/* Минимализм: строки-переключатели БЕЗ фона и рамок — просто чекбокс + текст.
   И БЕЗ ховер-фона: ничего не подсвечивается, чисто. */
.fp-tools-popup.fptm-themed .checkbox-label-inline,
.fp-tools-popup.fptm-themed .checkbox-label-inline:hover{
    background:transparent !important; border:none !important; box-shadow:none !important;
    border-radius:0 !important; padding:9px 2px !important;
}
.fp-tools-popup.fptm-themed .checkbox-label-inline label{ color:var(--fptm-text) !important; }

.fp-tools-popup.fptm-themed input[type="text"],
.fp-tools-popup.fptm-themed input[type="number"],
.fp-tools-popup.fptm-themed input[type="search"],
.fp-tools-popup.fptm-themed input[type="password"],
.fp-tools-popup.fptm-themed input[type="url"],
.fp-tools-popup.fptm-themed select,
.fp-tools-popup.fptm-themed textarea,
.fp-tools-popup.fptm-themed .template-input{
    background:var(--fptm-field) !important; color:var(--fptm-text) !important;
    border:1px solid var(--fptm-border) !important; border-radius:10px !important;
}
.fp-tools-popup.fptm-themed input::placeholder,.fp-tools-popup.fptm-themed textarea::placeholder{ color:var(--fptm-faint) !important; }
.fp-tools-popup.fptm-themed input:focus,.fp-tools-popup.fptm-themed select:focus,.fp-tools-popup.fptm-themed textarea:focus{
    border-color:var(--fptm-accent) !important; outline:none !important; box-shadow:0 0 0 3px var(--fptm-accent-soft) !important;
}
/* Селекты: НАТИВНАЯ стрелка (одна, правильного размера; Chrome красит её в
   color селекта → сама инвертируется под тему). Все кастомные фоновые стрелки
   отключены намертво — дублироваться нечему. */
.fp-tools-popup.fptm-themed select{
    -webkit-appearance:auto !important; -moz-appearance:auto !important; appearance:auto !important;
    background-image:none !important;
    color:var(--fptm-text) !important;
}
/* выпадающий список под тему */
.fp-tools-popup.fptm-themed select option{ background:var(--fptm-field) !important; color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fp-tools-radio-group{ background:transparent !important; }
.fp-tools-popup.fptm-themed .fp-tools-radio-option{
    background:var(--fptm-surface) !important; border:1px solid var(--fptm-border) !important;
    color:var(--fptm-text) !important; border-radius:10px !important;
}
.fp-tools-popup.fptm-themed .fp-tools-radio-option:hover{ background:var(--fptm-hover) !important; }
.fp-tools-popup.fptm-themed .fp-tools-radio-option.active,
.fp-tools-popup.fptm-themed .fp-tools-radio-option.selected{
    border-color:var(--fptm-accent-border) !important; background:var(--fptm-accent-soft) !important; color:var(--fptm-accent) !important;
}
.fp-tools-popup.fptm-themed input[type="checkbox"],.fp-tools-popup.fptm-themed input[type="radio"]{ accent-color:var(--fptm-accent) !important; }
.fp-tools-popup.fptm-themed input[type="range"]{ accent-color:var(--fptm-accent) !important; }

/* промо/инфо-блоки (были фиолетовыми) */
.fp-tools-popup.fptm-themed .support-promo,
.fp-tools-popup.fptm-themed .fpt-info-box,
.fp-tools-popup.fptm-themed .fpt-callout{
    background:var(--fptm-accent-soft) !important; border:1px solid var(--fptm-accent-border) !important;
    color:var(--fptm-text) !important; border-radius:12px !important;
}
.fp-tools-popup.fptm-themed .support-promo *{ color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .support-promo .nav-icon,
.fp-tools-popup.fptm-themed .support-promo .material-symbols-rounded{ color:var(--fptm-accent) !important; }

/* нижняя ссылка (была фиолетовой) */
.fp-tools-popup.fptm-themed .fp-site-footer-link{
    color:var(--fptm-accent) !important; border:1px solid var(--fptm-accent-border) !important;
    background:var(--fptm-accent-soft) !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .fp-site-footer-link:hover{ filter:brightness(1.05); background:var(--fptm-accent-soft) !important; }

/* галерея обоев / пресеты */
.fp-tools-popup.fptm-themed .fp-wallpaper-card{ border:1px solid var(--fptm-border) !important; border-radius:10px; overflow:hidden; }
.fp-tools-popup.fptm-themed .fp-wallpaper-card:hover{ box-shadow:0 0 0 2px var(--fptm-accent), 0 6px 16px var(--fptm-shadow) !important; }
.fp-tools-popup.fptm-themed .fp-dark-preset-btn{ background:var(--fptm-surface) !important; border:1px solid var(--fptm-border) !important; color:var(--fptm-text) !important; }

/* футер + кнопки */
.fp-tools-popup.fptm-themed .fp-tools-footer{
    background:var(--fptm-head) !important; border-top:1px solid var(--fptm-border) !important; border-radius:0 0 16px 16px;
}
.fp-tools-popup.fptm-themed .btn{
    background:var(--fptm-accent) !important; border:1px solid var(--fptm-accent) !important; color:#fff !important;
    border-radius:10px !important; box-shadow:none !important;
}
.fp-tools-popup.fptm-themed .btn *{ color:#fff !important; }
.fp-tools-popup.fptm-themed .btn:hover{ filter:brightness(1.07); }
.fp-tools-popup.fptm-themed .btn.btn-default,
.fp-tools-popup.fptm-themed .btn.btn-secondary{
    background:var(--fptm-surface) !important; color:var(--fptm-text) !important; border:1px solid var(--fptm-border) !important;
}
.fp-tools-popup.fptm-themed .btn.btn-default *,
.fp-tools-popup.fptm-themed .btn.btn-secondary *{ color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .btn.btn-default:hover,
.fp-tools-popup.fptm-themed .btn.btn-secondary:hover{ background:var(--fptm-hover) !important; }
.fp-tools-popup.fptm-themed .btn.btn-danger{ background:#e5484d !important; border-color:#e5484d !important; color:#fff !important; }

.fp-tools-popup.fptm-themed .fp-tools-content .material-symbols-rounded,
.fp-tools-popup.fptm-themed .fp-tools-content .material-icons{ color:var(--fptm-muted); }

/* ─── страница «Шаблоны» ─────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .template-settings-list .template-item{
    background:var(--fptm-surface) !important; border:1px solid var(--fptm-border) !important;
    border-radius:12px !important;
}
.fp-tools-popup.fptm-themed .template-settings-list .template-label{
    color:var(--fptm-text) !important;
}
.fp-tools-popup.fptm-themed .template-settings-list .template-label:focus{
    background:var(--fptm-surface-2) !important; box-shadow:0 0 0 2px var(--fptm-accent-soft) !important;
}
.fp-tools-popup.fptm-themed .template-settings-list .template-label[contenteditable]:hover{
    background:var(--fptm-surface-2) !important;
}
.fp-tools-popup.fptm-themed .template-settings-list .template-color-picker::-webkit-color-swatch{
    border:1px solid var(--fptm-border) !important;
}
.fp-tools-popup.fptm-themed .fpt-pos-card{
    background:var(--fptm-surface) !important; border:1.5px solid var(--fptm-border) !important;
}
.fp-tools-popup.fptm-themed .fpt-pos-card:hover{ border-color:var(--fptm-accent-border) !important; }
.fp-tools-popup.fptm-themed .fpt-pos-card:has(input:checked){
    border-color:var(--fptm-accent) !important; background:var(--fptm-accent-soft) !important;
}
.fp-tools-popup.fptm-themed .fpt-pos-name{ color:var(--fptm-muted) !important; }
.fp-tools-popup.fptm-themed .fpt-pos-card:has(input:checked) .fpt-pos-name{ color:var(--fptm-accent) !important; }
.fp-tools-popup.fptm-themed .fpt-pos-ico,
.fp-tools-popup.fptm-themed .fpt-pos-panel{ background:var(--fptm-surface-2) !important; }
.fp-tools-popup.fptm-themed .fpt-pos-row,
.fp-tools-popup.fptm-themed .fpt-pos-srow,
.fp-tools-popup.fptm-themed .fpt-pos-ico-pop .fpt-pos-pop-btn{ background:var(--fptm-accent) !important; }
.fp-tools-popup.fptm-themed .fpt-pos-field,
.fp-tools-popup.fptm-themed .fpt-pos-sfield{ background:var(--fptm-border) !important; }

/* ─── страница «Аккаунты» ────────────────────────────────────────────────── */
.fp-tools-popup.fptm-themed .fpt-acc-item{
    background:var(--fptm-surface) !important; border:1px solid var(--fptm-border) !important;
}
.fp-tools-popup.fptm-themed .fpt-acc-item.active{
    border-color:var(--fptm-accent-border) !important; background:var(--fptm-accent-soft) !important;
}
.fp-tools-popup.fptm-themed .fpt-acc-name{ color:var(--fptm-text) !important; }
.fp-tools-popup.fptm-themed .fpt-acc-balance{ color:var(--fptm-muted) !important; }
.fp-tools-popup.fptm-themed .fpt-acc-avatar{
    background-color:var(--fptm-surface-2) !important; box-shadow:inset 0 0 0 1px var(--fptm-border) !important;
}
.fp-tools-popup.fptm-themed .fpt-acc-btn{
    background:var(--fptm-surface-2) !important; border:1px solid var(--fptm-border) !important;
    color:var(--fptm-muted) !important;
}
.fp-tools-popup.fptm-themed .fpt-acc-btn:hover{
    color:var(--fptm-accent) !important; border-color:var(--fptm-accent-border) !important;
}
.fp-tools-popup.fptm-themed .fpt-acc-btn-delete:hover{ color:#e5484d !important; border-color:#e5484d !important; }
.fp-tools-popup.fptm-themed .fpt-acc-login-btn{ background:var(--fptm-accent) !important; color:#fff !important; }
.fp-tools-popup.fptm-themed .fpt-acc-login-btn.active{
    background:var(--fptm-surface-2) !important; color:#2f9e5f !important;
}
.fptm-dark .fpt-acc-login-btn.active{ color:#5fd48f !important; }
.fp-tools-popup.fptm-themed .fpt-acc-unread{ box-shadow:0 0 0 2px var(--fptm-surface) !important; }
.fp-tools-popup.fptm-themed .fpt-tg-cmd-list li code{
    background:var(--fptm-surface-2) !important; border:1px solid var(--fptm-border) !important;
    color:var(--fptm-accent) !important;
}
.fp-tools-popup.fptm-themed .fpt-tg-cmd-list li span{ color:var(--fptm-muted) !important; }

/* Кружки радио (звук уведомлений и т.п.): видимая обводка в обеих темах */
.fp-tools-popup.fptm-themed .fp-tools-radio-option input[type="radio"]{
    border:2px solid var(--fptm-faint) !important; background:transparent !important;
}
.fp-tools-popup.fptm-themed .fp-tools-radio-option:hover input[type="radio"]{
    border-color:var(--fptm-muted) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-radio-option input[type="radio"]:checked{
    border-color:var(--fptm-accent) !important;
}
.fp-tools-popup.fptm-themed .fp-tools-radio-option input[type="radio"]:checked::after{
    background:var(--fptm-accent) !important;
}
/* Иконки-кнопки (картинка, редактирование и т.п.): читаемые, акцент при наведении */
.fp-tools-popup.fptm-themed .fpt-img-btn,
.fp-tools-popup.fptm-themed .fpt-img-btn .material-symbols-rounded,
.fp-tools-popup.fptm-themed button.add-image-btn,
.fp-tools-popup.fptm-themed button.add-image-btn .material-symbols-rounded,
.fp-tools-popup.fptm-themed .fpt-autoreply-img-btn,
.fp-tools-popup.fptm-themed .fpt-keyword-img-btn,
.fp-tools-popup.fptm-themed .fpt-edit-keyword-btn,
.fp-tools-popup.fptm-themed .fpt-att-view,
.fp-tools-popup.fptm-themed .fpt-att-remove,
.fp-tools-popup.fptm-themed .delete-keyword-btn,
.fp-tools-popup.fptm-themed .fpt-send-order-btn{
    color:var(--fptm-text) !important; opacity:.82;
}
.fp-tools-popup.fptm-themed .fpt-img-btn:hover,
.fp-tools-popup.fptm-themed button.add-image-btn:hover,
.fp-tools-popup.fptm-themed .fpt-autoreply-img-btn:hover,
.fp-tools-popup.fptm-themed .fpt-keyword-img-btn:hover,
.fp-tools-popup.fptm-themed .fpt-edit-keyword-btn:hover,
.fp-tools-popup.fptm-themed .fpt-att-view:hover,
.fp-tools-popup.fptm-themed .fpt-send-order-btn:hover{
    color:var(--fptm-accent) !important; opacity:1;
}
.fp-tools-popup.fptm-themed .fpt-att-remove:hover,
.fp-tools-popup.fptm-themed .delete-keyword-btn:hover{
    color:#e5484d !important; opacity:1;
}
`;

function fptParseMenuColors() {
    let isLight = true;
    try {
        // Используем тот же детектор, что задаёт общую палитру поверхностей.
        // Локальные карточки вроде .content-account могут быть тёмными и при
        // светлой теме страницы, поэтому не определяем режим по первому блоку.
        if (typeof fptComputePalette === 'function') {
            isLight = !fptComputePalette().dark;
        } else if (typeof fptResolveBg === 'function' && typeof fptLuma === 'function') {
            isLight = fptLuma(fptResolveBg()) >= 0.5;
        } else {
            const bodyColor = getComputedStyle(document.body).backgroundColor;
            const rgb = (bodyColor.match(/\d+/g) || [255, 255, 255]).map(Number);
            isLight = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) >= 127.5;
        }
    } catch (_) {}

    // Акцент: фирменная голубая кнопка FunPay, иначе фирменный голубой #1b75bb.
    let accent = '';
    const btn = document.querySelector('.btn-primary');
    if (btn) {
        const bc = getComputedStyle(btn).backgroundColor;
        if (bc && bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent') {
            const arr = (bc.match(/\d+/g) || []).map(Number);
            // отбрасываем слишком тёмный/серый «акцент»
            if (arr.length >= 3 && (arr[0] + arr[1] + arr[2]) > 90 && !(Math.abs(arr[0]-arr[1])<12 && Math.abs(arr[1]-arr[2])<12)) accent = bc;
        }
    }
    if (!accent) accent = '#1b75bb';
    return { isLight, accent };
}

function fptInjectMenuThemeCSS() {
    if (document.getElementById('fpt-menu-theme-css')) return;
    const s = document.createElement('style');
    s.id = 'fpt-menu-theme-css';
    s.textContent = FPT_MENU_THEME_CSS;
    document.head.appendChild(s);
}

// Белый или почти белый цвет? Принимает hex (#fff/#ffffff) и rgb(...) строки.
function fptIsWhitish(color) {
    if (!color) return false;
    let r, g, b;
    const hx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    const hx3 = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color);
    if (hx) {
        r = parseInt(hx[1], 16); g = parseInt(hx[2], 16); b = parseInt(hx[3], 16);
    } else if (hx3) {
        r = parseInt(hx3[1] + hx3[1], 16); g = parseInt(hx3[2] + hx3[2], 16); b = parseInt(hx3[3] + hx3[3], 16);
    } else {
        const arr = (String(color).match(/\d+/g) || []).map(Number);
        if (arr.length < 3) return false;
        [r, g, b] = arr;
    }
    // «Похож на белый»: все каналы высокие и цвет близок к серому (низкая насыщенность).
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 225 && (maxC - minC) <= 20;
}

function fptApplyMenuTheme(root) {
    if (!root) return;
    try {
        const parsed = fptParseMenuColors();
        const isLight = parsed.isLight;
        let accent = window.__fptUserAccent || parsed.accent;

        // Если кастомная тема ВЫКЛЮЧЕНА, а акцент белый/почти белый — он был бы
        // невидим на светлом меню. Подменяем его мягким синим.
        const SOFT_BLUE = '#4a9fd4';
        const customThemeOff = document.documentElement.classList.contains('fpt-custom-theme-off');
        if (customThemeOff && fptIsWhitish(accent)) {
            accent = SOFT_BLUE;
        }
        let vars;
        if (isLight) {
            vars = {
                bg:'#ffffff', head:'#f7f8fb', nav:'#fbfcfe', text:'#16181d',
                muted:'rgba(22,24,29,0.74)', faint:'rgba(22,24,29,0.56)', border:'rgba(22,24,29,0.10)',
                surface:'#f5f7fa', surface2:'#eef1f6', hover:'rgba(22,24,29,0.05)', field:'#ffffff',
                shadow:'rgba(22,24,29,0.16)', navFade:'rgba(22,24,29,0.12)',
                navSurface:'#fbfaff', navRow:'transparent', navExpanded:'transparent', navChildSurface:'transparent',
                navField:'#f4f3ff', navFieldFocus:'#ffffff', navBorder:'rgba(119,99,246,0.16)',
                navRowShadow:'rgba(94,84,170,0.10)', navDot:'#b4c8e8'
            };
        } else {
            vars = {
                bg:'#1e1f24', head:'#191a1e', nav:'#1b1c21', text:'#e7e8ec',
                muted:'rgba(231,232,236,0.76)', faint:'rgba(231,232,236,0.56)', border:'rgba(255,255,255,0.10)',
                surface:'#26272d', surface2:'#2c2e35', hover:'rgba(255,255,255,0.07)', field:'#26272d',
                shadow:'rgba(0,0,0,0.55)', navFade:'rgba(0,0,0,0.30)',
                navSurface:'#24262d', navRow:'#2b2e36', navExpanded:'rgba(89,146,220,0.22)', navChildSurface:'rgba(19,22,28,0.72)',
                navField:'#2a2e37', navFieldFocus:'#313640', navBorder:'rgba(255,255,255,0.10)',
                navRowShadow:'rgba(0,0,0,0.20)', navDot:'rgba(231,232,236,0.40)'
            };
        }
        let rgb;
        const hx = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent);
        if (hx) {
            rgb = [parseInt(hx[1], 16), parseInt(hx[2], 16), parseInt(hx[3], 16)];
        } else {
            rgb = (accent.match(/\d+/g) || [27,117,187]).slice(0,3).map(Number);
        }
        const accentSoft = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${isLight ? 0.12 : 0.22})`;
        const accentBorder = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${isLight ? 0.35 : 0.5})`;

        // Контрастный текст для элементов, где фон = акцент. Если акцент светлый
        // (например, пользователь выбрал белый), белый текст на нём сливается — тогда
        // делаем текст тёмным. Порог по воспринимаемой яркости.
        const accentLuma = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
        const onAccent = accentLuma > 150 ? '#14161c' : '#ffffff';

        const st = root.style;
        st.setProperty('--fptm-color-scheme', isLight ? 'light' : 'dark');
        st.setProperty('--fptm-bg', vars.bg);
        st.setProperty('--fptm-head', vars.head);
        st.setProperty('--fptm-nav', vars.nav);
        st.setProperty('--fptm-text', vars.text);
        st.setProperty('--fptm-muted', vars.muted);
        st.setProperty('--fptm-faint', vars.faint);
        st.setProperty('--fptm-border', vars.border);
        st.setProperty('--fptm-surface', vars.surface);
        st.setProperty('--fptm-surface-2', vars.surface2);
        st.setProperty('--fptm-hover', vars.hover);
        st.setProperty('--fptm-field', vars.field);
        st.setProperty('--fptm-accent', accent);
        st.setProperty('--fptm-accent-soft', accentSoft);
        st.setProperty('--fptm-accent-border', accentBorder);
        st.setProperty('--fptm-on-accent', onAccent);
        st.setProperty('--fptm-shadow', vars.shadow);
        st.setProperty('--fptm-nav-fade', vars.navFade);
        st.setProperty('--fptm-nav-surface', vars.navSurface);
        st.setProperty('--fptm-nav-row', vars.navRow);
        st.setProperty('--fptm-nav-expanded', vars.navExpanded);
        st.setProperty('--fptm-nav-child-surface', vars.navChildSurface);
        st.setProperty('--fptm-nav-field', vars.navField);
        st.setProperty('--fptm-nav-field-focus', vars.navFieldFocus);
        st.setProperty('--fptm-nav-border', vars.navBorder);
        st.setProperty('--fptm-nav-row-shadow', vars.navRowShadow);
        st.setProperty('--fptm-nav-dot', vars.navDot);

        // Множество старых правил используют var(--fpt-accent, #1b75bb) и прочие
        // фиолетовые фолбэки. Задаём эти переменные прямо на окне — и весь легаси
        // фиолетовый мгновенно становится голубым, а поверхности/текст — тематичными.
        st.setProperty('--fpt-accent', accent);
        st.setProperty('--fpt-accent-soft', accentSoft);
        st.setProperty('--fpt-accent-border', accentBorder);
        st.setProperty('--fpt-on-accent', onAccent);
        st.setProperty('--fpt-accent-2', accent);
        st.setProperty('--fpt-text', vars.text);
        st.setProperty('--fpt-text-muted', vars.muted);
        st.setProperty('--fpt-border', vars.border);
        st.setProperty('--fpt-surface', vars.surface);
        st.setProperty('--fpt-surface-2', vars.surface2);
        st.setProperty('--fpt-bg', vars.bg);
        st.setProperty('--fpt-shadow', vars.shadow);

        root.classList.remove('fpt-menu-transparent', 'fpt-menu-blur', 'fpt-menu-on-light', 'fpt-menu-on-dark');
        root.classList.add('fptm-themed');
        root.classList.toggle('fptm-dark', !isLight);
        root.classList.toggle('fptm-light', isLight);
    } catch (_) {}
}

const FP_WALLPAPER_PRESETS = [
    { name: 'Горы и озеро', emoji: '🏔️', url: 'https://isorepublic.com/wp-content/uploads/2023/03/iso-republic-mountain-winter-lake.jpg', palette: { bgColor1: '#1a3050', bgColor2: '#4a7aaa', containerBgColor: '#0d1828', textColor: '#dde8f4', linkColor: '#7aaad8' } },
    { name: 'Туманные горы', emoji: '🌫️', url: 'https://isorepublic.com/wp-content/uploads/2023/02/iso-republic-napa-hill-fog.jpg', palette: { bgColor1: '#1e2830', bgColor2: '#5a7888', containerBgColor: '#101820', textColor: '#d8e4ec', linkColor: '#7aaac0' } },
    { name: 'Каньон', emoji: '🪨', url: 'https://isorepublic.com/wp-content/uploads/2023/03/iso-republic-rough-rocky-landscape.jpg', palette: { bgColor1: '#2a1808', bgColor2: '#a85030', containerBgColor: '#180e04', textColor: '#f0ddd0', linkColor: '#e08060' } },
    { name: 'Горный туман', emoji: '☁️', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-mist-mountains-clouds.jpg', palette: { bgColor1: '#151e2a', bgColor2: '#3a6090', containerBgColor: '#0a1018', textColor: '#dce8f8', linkColor: '#6090c8' } },
    { name: 'Закат', emoji: '🌅', url: 'https://isorepublic.com/wp-content/uploads/2022/11/iso-republic-clouds-sky-trees.jpg', palette: { bgColor1: '#280a18', bgColor2: '#c84810', containerBgColor: '#180508', textColor: '#f8ddd0', linkColor: '#f08060' } },
    { name: 'Пустыня', emoji: '🏜️', url: 'https://isorepublic.com/wp-content/uploads/2023/06/iso-republic-desert-barren-sky.jpg', palette: { bgColor1: '#201808', bgColor2: '#c89840', containerBgColor: '#100c04', textColor: '#f8ead8', linkColor: '#e0b860' } },
    { name: 'Побережье', emoji: '🌊', url: 'https://isorepublic.com/wp-content/uploads/2023/05/iso-republic-scenic-coast-beach-03.jpg', palette: { bgColor1: '#082028', bgColor2: '#2888a0', containerBgColor: '#041018', textColor: '#d8eef8', linkColor: '#50a8c8' } },
    { name: 'Млечный путь', emoji: '🌌', url: 'https://isorepublic.com/wp-content/uploads/2025/02/isorepublic-milky-way.jpg', palette: { bgColor1: '#080618', bgColor2: '#4030a0', containerBgColor: '#04030e', textColor: '#e0d8f8', linkColor: '#8070e0' } },
    { name: 'Звёзды', emoji: '⭐', url: 'https://isorepublic.com/wp-content/uploads/2022/12/iso-republic-mikly-way-trees-sky.jpg', palette: { bgColor1: '#040a18', bgColor2: '#103868', containerBgColor: '#020508', textColor: '#d8e8f8', linkColor: '#4080b8' } },
    { name: 'Синий дуотон', emoji: '🔵', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-abstract-wallpaper-duotone.jpg', palette: { bgColor1: '#080e28', bgColor2: '#1840c0', containerBgColor: '#040818', textColor: '#d8e0f8', linkColor: '#4868e8' } },
    { name: 'Тёмно-синий', emoji: '💙', url: 'https://isorepublic.com/wp-content/uploads/2024/05/iso-republic-abstract-wallpaper-dark-blues.jpg', palette: { bgColor1: '#030610', bgColor2: '#0c2890', containerBgColor: '#020408', textColor: '#d0d8f0', linkColor: '#3060c8' } },
    { name: 'Мягкий боке', emoji: '🎨', url: 'https://isorepublic.com/wp-content/uploads/2022/10/iso-republic-abstract-wallpaper-soft-blur.jpg', palette: { bgColor1: '#0e0618', bgColor2: '#6030b0', containerBgColor: '#06030c', textColor: '#e8d8f8', linkColor: '#9060e0' } }
];

const FP_WP_CACHE_KEY = 'fpToolsWallpaperCache';
const FP_WP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const _fpWpImgCache = new Map();

// --- Каталог готовых ТЕМ (.fptheme) с GitHub ------------------------------
// Ленивая загрузка: index.json тянется ОДИН раз при первом открытии вкладки,
// превью каждой темы грузится по одному (только текущий слайд карусели),
// сам .fptheme качается только в момент нажатия «Применить». Ничего не
// предзагружается — трафик не жрётся.
const FP_THEME_GH_USER   = 'XaviersDev';
const FP_THEME_GH_REPO   = 'fpt-themes';
const FP_THEME_GH_BRANCH = 'main';
const FP_THEME_RAW_BASE  = `https://raw.githubusercontent.com/${FP_THEME_GH_USER}/${FP_THEME_GH_REPO}/${FP_THEME_GH_BRANCH}/`;
const FP_THEME_INDEX_URL = FP_THEME_RAW_BASE + 'index.json';

let _fpThemeCatalog = null;   // массив тем после загрузки index.json
let _fpThemeCatalogLoaded = false;

function _fpThemeResolveUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return FP_THEME_RAW_BASE + String(u).replace(/^\/+/, '');
}

async function _fpLoadThemeCatalog() {
    if (_fpThemeCatalogLoaded) return _fpThemeCatalog;
    try {
        const resp = await fetch(FP_THEME_INDEX_URL, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data.themes) ? data.themes : []);
        _fpThemeCatalog = list.filter(t => t && t.file).map(t => ({
            name: t.name || 'Без названия',
            desc: t.desc || t.description || '',
            author: t.author || '',
            previewUrl: _fpThemeResolveUrl(t.preview || ''),
            fileUrl: _fpThemeResolveUrl(t.file),
        }));
    } catch (e) {
        console.error('FunPay Funcy: не удалось загрузить каталог тем', e);
        _fpThemeCatalog = null; // отличаем «ошибка» от «пусто»
    }
    _fpThemeCatalogLoaded = true;
    return _fpThemeCatalog;
}

async function _getWpCache() {
    try { const r = await chrome.storage.local.get(FP_WP_CACHE_KEY); return r[FP_WP_CACHE_KEY] || {}; } catch { return {}; }
}
async function _markWpCached(url) {
    try { const c = await _getWpCache(); c[url] = { ts: Date.now() }; await chrome.storage.local.set({ [FP_WP_CACHE_KEY]: c }); } catch {}
}

let _wpIndex = 0;
let _wpLoading = false;

async function _loadCarouselSlide(index) {
    if (_wpLoading) return;
    const catalog = _fpThemeCatalog;
    if (!catalog || !catalog.length) return;
    const theme = catalog[index];
    if (!theme) return;
    _wpLoading = true;

    const slot    = document.getElementById('fp-wp-img-slot');
    const loaderEl= document.getElementById('fp-wp-loader');
    const bar     = document.getElementById('fp-wp-bar');
    const pct     = document.getElementById('fp-wp-pct');
    const emoji   = document.getElementById('fp-wp-emoji');
    const nameEl  = document.getElementById('fp-wp-name');
    const counter = document.getElementById('fp-wp-counter');
    const applyBtn= document.getElementById('fp-wp-apply-cur');
    if (!slot) { _wpLoading = false; return; }

    nameEl.textContent  = theme.name + (theme.author ? `  ·  ${theme.author}` : '');
    counter.textContent = `${index + 1} / ${catalog.length}`;
    emoji.textContent   = '🎨';
    const descEl = document.getElementById('fp-wp-desc');
    if (descEl) descEl.textContent = theme.desc || '';
    if (applyBtn) applyBtn.style.display = 'none';

    // Нет превью у темы — показываем заглушку, но «Применить» доступна.
    if (!theme.previewUrl) {
        slot.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--fptm-faint, #5a5f7a);font-size:12px;">Без превью</div>';
        if (loaderEl) loaderEl.style.display = 'none';
        if (applyBtn) applyBtn.style.display = 'block';
        _wpLoading = false;
        return;
    }

    if (_fpWpImgCache.has(theme.previewUrl)) {
        const img = _fpWpImgCache.get(theme.previewUrl).cloneNode();
        _showCarouselImg(img, slot, loaderEl);
        _wpLoading = false;
        return;
    }

    loaderEl.style.display = 'flex';
    slot.innerHTML = '';
    bar.style.width = '0%'; pct.textContent = '0%';

    const storageCache = await _getWpCache();
    const cached = storageCache[theme.previewUrl] && Date.now() - storageCache[theme.previewUrl].ts < FP_WP_CACHE_TTL;

    if (!cached) {
        let fakeP = 0;
        slot._fakeIv = setInterval(() => {
            fakeP = Math.min(fakeP + Math.random() * 10, 88);
            bar.style.width = Math.round(fakeP) + '%';
            pct.textContent = Math.round(fakeP) + '%';
        }, 150);
    } else {
        bar.style.width = '90%'; pct.textContent = '…';
    }

    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.width = 160;
    img.src = theme.previewUrl;

    try {
        await img.decode();
        if (slot._fakeIv) { clearInterval(slot._fakeIv); delete slot._fakeIv; }
        bar.style.width = '100%'; pct.textContent = '100%';
        _fpWpImgCache.set(theme.previewUrl, img);
        if (!cached) _markWpCached(theme.previewUrl);
        _showCarouselImg(img.cloneNode(), slot, loaderEl);
    } catch {
        // превью не загрузилось — показываем заглушку, но не скипаем тему,
        // чтобы её всё равно можно было применить
        if (slot._fakeIv) { clearInterval(slot._fakeIv); delete slot._fakeIv; }
        slot.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--fptm-faint, #5a5f7a);font-size:12px;">Превью недоступно</div>';
        if (loaderEl) loaderEl.style.display = 'none';
        if (applyBtn) applyBtn.style.display = 'block';
    }
    _wpLoading = false;
}

function _showCarouselImg(img, slot, loaderEl) {
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;opacity:0;transition:opacity .35s ease;pointer-events:none;';
    slot.innerHTML = '';
    slot.appendChild(img);
    const applyBtn = document.getElementById('fp-wp-apply-cur');
    if (applyBtn) applyBtn.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        img.style.opacity = '1';
        if (loaderEl) loaderEl.style.display = 'none';
    }));
}

async function initializeWallpaperPresets() {
    const carousel = document.getElementById('fp-wallpaper-carousel');
    if (!carousel || carousel.dataset.initialized) return;
    carousel.dataset.initialized = '1';

    const loaderEl = document.getElementById('fp-wp-loader');
    const slot     = document.getElementById('fp-wp-img-slot');
    const nameEl   = document.getElementById('fp-wp-name');
    const emoji    = document.getElementById('fp-wp-emoji');
    if (loaderEl) loaderEl.style.display = 'flex';
    if (emoji) emoji.textContent = '⏳';
    if (nameEl) nameEl.textContent = 'Загрузка каталога…';

    // Лениво грузим index.json ровно один раз (вкладка уже открыта).
    await _fpLoadThemeCatalog();

    const _descEl0 = document.getElementById('fp-wp-desc');
    if (_descEl0) _descEl0.textContent = '';

    if (_fpThemeCatalog === null) {
        // ошибка сети/каталога
        if (slot) slot.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--fptm-faint, #5a5f7a);font-size:12px;text-align:center;padding:10px;">Не удалось загрузить каталог тем.<br>Проверьте интернет и переоткройте вкладку.</div>';
        if (loaderEl) loaderEl.style.display = 'none';
        carousel.dataset.initialized = ''; // позволить повторную попытку
        return;
    }
    if (!_fpThemeCatalog.length) {
        if (slot) slot.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--fptm-faint, #5a5f7a);font-size:12px;text-align:center;padding:10px;">Каталог пока пуст.</div>';
        if (loaderEl) loaderEl.style.display = 'none';
        return;
    }

    _wpIndex = 0;
    _loadCarouselSlide(0);

    document.getElementById('fp-wp-prev')?.addEventListener('click', () => {
        if (_wpLoading || !_fpThemeCatalog || !_fpThemeCatalog.length) return;
        _wpIndex = (_wpIndex - 1 + _fpThemeCatalog.length) % _fpThemeCatalog.length;
        _loadCarouselSlide(_wpIndex);
    });
    document.getElementById('fp-wp-next')?.addEventListener('click', () => {
        if (_wpLoading || !_fpThemeCatalog || !_fpThemeCatalog.length) return;
        _wpIndex = (_wpIndex + 1) % _fpThemeCatalog.length;
        _loadCarouselSlide(_wpIndex);
    });
    document.getElementById('fp-wp-apply-cur')?.addEventListener('click', () => {
        const theme = _fpThemeCatalog && _fpThemeCatalog[_wpIndex];
        if (theme) applyThemeFromCatalog(theme);
    });
    document.getElementById('fp-apply-dark-preset')?.addEventListener('click', applyBlackThemePreset);
}

// Скачивает .fptheme выбранной темы и применяет её (тот же путь, что ручной импорт).
async function applyThemeFromCatalog(theme) {
    const applyBtn = document.getElementById('fp-wp-apply-cur');
    if (!theme || !theme.fileUrl) return;
    const oldText = applyBtn ? applyBtn.textContent : '';
    if (applyBtn) { applyBtn.textContent = 'Применяю…'; applyBtn.disabled = true; }
    try {
        const resp = await fetch(theme.fileUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error('файл темы повреждён'); }
        if (!data || typeof data !== 'object' || !data.bgColor1 || !data.font) {
            throw new Error('неверный формат темы');
        }

        // Тот же контракт, что и при ручном импорте .fptheme.
        const newTheme = { ...data, enableCustomTheme: true };
        await chrome.storage.local.set({ fpToolsTheme: newTheme, enableCustomTheme: true });

        if (typeof applyCustomTheme === 'function') await applyCustomTheme();
        if (typeof applyHeaderPosition === 'function') await applyHeaderPosition();
        if (typeof updateThemePreview === 'function') await updateThemePreview();
        // отметить чекбокс «Включить кастомную тему», если он есть
        const chk = document.getElementById('enableCustomThemeCheckbox');
        if (chk) chk.checked = true;

        if (typeof showNotification === 'function') showNotification(`Тема «${theme.name}» применена!`);
    } catch (e) {
        if (typeof showNotification === 'function') showNotification(`Не удалось применить тему: ${e.message}`, true);
        console.error('FunPay Funcy: apply theme from catalog error', e);
    } finally {
        if (applyBtn) { applyBtn.textContent = oldText || 'Применить'; applyBtn.disabled = false; }
    }
}

async function applyWallpaperPreset(preset, cardEl) {
    const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
    const newTheme = { ...fpToolsTheme, bgImage: preset.url, enableCustomTheme: true, ...preset.palette };
    await chrome.storage.local.set({ fpToolsTheme: newTheme, enableCustomTheme: true });

    const previewDiv = document.getElementById('bg-image-preview');
    if (previewDiv) { previewDiv.style.backgroundImage = `url(${preset.url})`; previewDiv.textContent = ''; }

    _updateColorInputs(preset.palette);
    const cb = document.getElementById('enableCustomThemeCheckbox');
    if (cb) cb.checked = true;

    if (typeof applyCustomTheme === 'function') applyCustomTheme();
    if (typeof showNotification === 'function') showNotification(`Обои «${preset.name}» применены ✓`);
}

async function applyBlackThemePreset() {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 2, 2);
    const base64 = canvas.toDataURL('image/png');

    const darkPalette = { bgColor1: '#0a0a0a', bgColor2: '#222222', containerBgColor: '#111111', textColor: '#cccccc', linkColor: '#888888' };
    const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
    const newTheme = { ...fpToolsTheme, bgImage: base64, enableCustomTheme: true, ...darkPalette };
    await chrome.storage.local.set({ fpToolsTheme: newTheme, enableCustomTheme: true });

    const previewDiv = document.getElementById('bg-image-preview');
    if (previewDiv) { previewDiv.style.backgroundImage = `url(${base64})`; previewDiv.style.backgroundColor = '#1a1a1a'; previewDiv.textContent = ''; }

    _updateColorInputs(darkPalette);
    const cb = document.getElementById('enableCustomThemeCheckbox');
    if (cb) cb.checked = true;
    document.querySelectorAll('.fp-wallpaper-card').forEach(c => c.style.borderColor = 'transparent');

    if (typeof applyCustomTheme === 'function') applyCustomTheme();
    if (typeof showNotification === 'function') showNotification('Чёрная тема применена ✓');
}

function _updateColorInputs(palette) {
    const map = { bgColor1: 'themeColor1', bgColor2: 'themeColor2', containerBgColor: 'themeContainerBgColor', textColor: 'themeTextColor', linkColor: 'themeLinkColor' };
    Object.entries(map).forEach(([key, id]) => { if (palette[key]) { const el = document.getElementById(id); if (el) el.value = palette[key]; } });
}




const FPT_NAV_SECTIONS = Object.freeze([
    { id: 'sales', label: 'Лоты и продажи', icon: 'storefront', pages: Object.freeze(['lot_io', 'auto_delivery', 'autobump']) },
    { id: 'customers', label: 'Покупатели', icon: 'chat', pages: Object.freeze(['auto_reply', 'auto_review', 'templates', 'blacklist']) },
    { id: 'finance', label: 'Финансы', icon: 'analytics', pages: Object.freeze(['finance_hub', 'piggy_banks', 'calculator']) },
    { id: 'interface', label: 'Интерфейс', icon: 'apps', pages: Object.freeze(['theme', 'effects', 'epic_nicks', 'needs']) },
    { id: 'settings', label: 'Настройки', icon: 'settings', pages: Object.freeze(['accounts', 'general', 'telegram', 'settings_io']) },
    { id: 'help', label: 'Справка', icon: 'help', pages: Object.freeze(['overview', 'tickets', 'global_chat']) }
]);

const FPT_NAV_LABEL_OVERRIDES = Object.freeze({
    lot_io: 'Управление лотами',
    auto_delivery: 'Автовыдача',
    autobump: 'Автоподнятие',
    auto_reply: 'Автоответчик',
    auto_review: 'Отзывы и бонусы',
    templates: 'Быстрые ответы',
    blacklist: 'Чёрный список',
    finance_hub: 'Обзор и аналитика',
    piggy_banks: 'Копилки',
    calculator: 'Калькуляторы',
    theme: 'Темы',
    effects: 'Эффекты',
    epic_nicks: 'Оформление ника',
    needs: 'Элементы интерфейса',
    accounts: 'Аккаунты',
    general: 'Отображение FunPay',
    telegram: 'Уведомления и интеграции',
    settings_io: 'Перенос настроек',
    overview: 'Справочник функций',
    tickets: 'Поддержка FunPay',
    global_chat: 'Чат сообщества',
    support: 'Оценить расширение'
});

const FPT_NAV_QUICK_ACTIONS = Object.freeze(['support']);
const FPT_NAV_EXPANDED_STORAGE_KEY = 'fpToolsNavExpandedSectionsV2';
const FPT_NAV_COLLAPSED_STORAGE_KEY = 'fpToolsNavCollapsed';

function setupNavigationSections(toolsPopup) {
    if (!toolsPopup) return null;
    if (toolsPopup._fptNavSections) return toolsPopup._fptNavSections;

    const nav = toolsPopup.querySelector('.fp-tools-nav');
    const legacyList = nav && nav.querySelector('ul');
    if (!nav || !legacyList) return null;
    const collapseButton = nav.querySelector('#fptNavCollapse');

    const sectionById = new Map(FPT_NAV_SECTIONS.map(section => [section.id, section]));
    const pageToSection = new Map();
    const quickActionIds = new Set(FPT_NAV_QUICK_ACTIONS);
    FPT_NAV_SECTIONS.forEach(section => {
        section.pages.forEach(pageId => pageToSection.set(pageId, section.id));
    });

    const pageItems = Array.from(legacyList.querySelectorAll('li[data-page]'));
    const quickActionList = nav.querySelector('.fpt-nav-quick-actions');
    pageItems.forEach(item => {
        const pageId = item.dataset.page;
        const sectionId = pageToSection.get(pageId);
        if (sectionId) {
            item.dataset.navSection = sectionId;
            item.classList.add('fpt-nav-child');
        } else if (quickActionIds.has(pageId)) {
            delete item.dataset.navSection;
            item.classList.add('fpt-nav-quick-action');
        } else {
            item.hidden = true;
            item.setAttribute('aria-hidden', 'true');
            return;
        }
        item.classList.remove('fpt-nav-hidden', 'fpt-nav-section-hidden');
        item.setAttribute('aria-hidden', 'false');

        const override = FPT_NAV_LABEL_OVERRIDES[pageId];
        const label = item.querySelector('a > span:last-child');
        if (override && label) label.textContent = override;
        if (quickActionIds.has(pageId)) {
            const accessibleLabel = override || label?.textContent?.trim() || pageId;
            const anchor = item.querySelector('a');
            item.title = accessibleLabel;
            if (anchor) {
                anchor.title = accessibleLabel;
                anchor.setAttribute('aria-label', accessibleLabel);
            }
        }
    });

    const scroll = document.createElement('div');
    scroll.className = 'fpt-nav-scroll';
    scroll.setAttribute('aria-label', 'Разделы FunPay Funcy');
    const groups = document.createElement('div');
    groups.className = 'fpt-nav-groups';
    scroll.appendChild(groups);
    nav.insertBefore(scroll, legacyList);
    legacyList.remove();

    const cloud = nav.querySelector('.fp-tools-nav-cloud');
    if (cloud) {
        cloud.hidden = true;
        cloud.setAttribute('aria-hidden', 'true');
    }

    const groupRefs = new Map();
    FPT_NAV_SECTIONS.forEach(section => {
        const group = document.createElement('section');
        group.className = 'fpt-nav-group';
        group.dataset.section = section.id;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'fpt-nav-group-toggle';
        toggle.dataset.section = section.id;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', section.label);
        toggle.title = section.label;

        const navIcon = document.createElement('img');
        navIcon.className = 'fpt-nav-group-icon';
        navIcon.dataset.icon = section.id;
        navIcon.src = fptGetMenuAssetUrl(`icons/${FPT_NAV_ICON_ASSETS[section.id].expanded}`);
        navIcon.alt = '';
        navIcon.decoding = 'async';
        navIcon.setAttribute('aria-hidden', 'true');
        const title = document.createElement('span');
        title.className = 'fpt-nav-group-title';
        title.textContent = section.label;
        const chevron = document.createElement('span');
        chevron.className = 'fpt-nav-group-chevron';
        chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        chevron.setAttribute('aria-hidden', 'true');
        toggle.append(navIcon, title, chevron);

        const collapse = document.createElement('div');
        collapse.className = 'fpt-nav-group-collapse';
        const itemsViewport = document.createElement('div');
        itemsViewport.className = 'fpt-nav-group-items';
        const items = document.createElement('ul');
        items.className = 'fpt-nav-group-list';
        const collapseId = 'fpt-nav-group-' + section.id + '-items';
        collapse.id = collapseId;
        toggle.setAttribute('aria-controls', collapseId);
        let childIndex = 0;
        section.pages.forEach(pageId => {
            const item = pageItems.find(entry => entry.dataset.page === pageId);
            if (item) {
                item.style.setProperty('--fpt-nav-child-delay', `${Math.min(childIndex++, 9) * 14}ms`);
                items.appendChild(item);
            }
        });
        itemsViewport.appendChild(items);
        collapse.appendChild(itemsViewport);
        group.append(toggle, collapse);
        groups.appendChild(group);
        groupRefs.set(section.id, { group, toggle, collapse, items, icon: navIcon });
    });

    if (quickActionList) {
        FPT_NAV_QUICK_ACTIONS.forEach(pageId => {
            const item = pageItems.find(entry => entry.dataset.page === pageId);
            if (item) quickActionList.appendChild(item);
        });
    }

    const activePage = pageItems.find(item => item.classList.contains('active'));
    let activeSection = activePage?.dataset.navSection || pageToSection.get('lot_io') || FPT_NAV_SECTIONS[0].id;
    let focusedSection = null;
    let expandedSections = new Set([activeSection]);
    let navCollapsed = false;
    let collapsedUserChanged = false;
    let expandedSectionsUserChanged = false;
    let pendingCompactSection = null;
    let pendingCompactTimer = null;

    function normalizeSectionIds(value) {
        const ids = Array.isArray(value) || value instanceof Set ? Array.from(value) : [];
        return ids.filter(id => sectionById.has(id));
    }

    function persistExpandedSections() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ [FPT_NAV_EXPANDED_STORAGE_KEY]: Array.from(expandedSections) });
            }
        } catch (_) {}
    }

    function isNavCollapsed() {
        return navCollapsed;
    }

    function setNavCollapsed(collapsed, persist = true) {
        if (typeof collapsed !== 'boolean') return;
        if (pendingCompactSection && collapsed) cancelPendingCompactSection();
        navCollapsed = collapsed;
        nav.classList.toggle('is-nav-collapsed', navCollapsed);
        if (collapseButton) {
            collapseButton.setAttribute('aria-expanded', navCollapsed ? 'false' : 'true');
            collapseButton.setAttribute('aria-label', navCollapsed ? 'Развернуть меню' : 'Свернуть меню');
            collapseButton.title = navCollapsed ? 'Развернуть меню' : 'Свернуть меню';
        }
        if (persist) {
            collapsedUserChanged = true;
            try {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({ [FPT_NAV_COLLAPSED_STORAGE_KEY]: navCollapsed });
                }
            } catch (_) {}
        }
    }

    function renderExpandedSections() {
        nav.dataset.expandedSections = Array.from(expandedSections).join(',');
        groupRefs.forEach(({ group, toggle, collapse, icon }, sectionId) => {
            const expanded = expandedSections.has(sectionId);
            group.classList.toggle('is-expanded', expanded);
            group.classList.toggle('is-active-section', !focusedSection && sectionId === activeSection);
            group.classList.toggle('is-focused-section', !!focusedSection && sectionId === focusedSection);
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            collapse.setAttribute('aria-hidden', expanded ? 'false' : 'true');
            collapse.toggleAttribute('inert', !expanded);
            if (icon) icon.dataset.state = expanded ? 'expanded' : 'collapsed';
        });
    }

    function setExpandedSections(next, persist = true) {
        expandedSections = new Set(normalizeSectionIds(next));
        renderExpandedSections();
        if (persist) {
            expandedSectionsUserChanged = true;
            persistExpandedSections();
        }
        return Array.from(expandedSections);
    }

    function cancelPendingCompactSection() {
        pendingCompactSection = null;
        nav.classList.remove('is-nav-opening');
        nav.removeEventListener('transitionend', onCompactNavExpanded);
        if (pendingCompactTimer !== null) {
            clearTimeout(pendingCompactTimer);
            pendingCompactTimer = null;
        }
    }

    function onCompactNavExpanded(event) {
        if (event.target === nav && event.propertyName === 'flex-basis') cancelPendingCompactSection();
    }

    function expandSection(sectionId, persist = true) {
        if (!sectionById.has(sectionId)) return;
        expandedSections.add(sectionId);
        renderExpandedSections();
        if (persist) {
            expandedSectionsUserChanged = true;
            persistExpandedSections();
        }
    }

    function toggleSection(sectionId) {
        if (!sectionById.has(sectionId)) return;
        focusedSection = null;
        if (expandedSections.has(sectionId)) expandedSections.delete(sectionId);
        else expandedSections.add(sectionId);
        renderExpandedSections();
        expandedSectionsUserChanged = true;
        persistExpandedSections();
    }

    function showSectionForPage(pageId) {
        const item = pageItems.find(entry => entry.dataset.page === pageId);
        const sectionId = item?.dataset.navSection || pageToSection.get(pageId);
        if (!sectionId || !sectionById.has(sectionId)) return;
        activeSection = sectionId;
        focusedSection = null;
        expandSection(sectionId);
        renderExpandedSections();
    }

    function revealAllForSearch(sectionIds) {
        const ids = sectionIds == null ? FPT_NAV_SECTIONS.map(section => section.id) : normalizeSectionIds(sectionIds);
        setExpandedSections(ids, false);
        pageItems.forEach(item => {
            if (!isPopupPageAvailable(toolsPopup, item.dataset.page)) {
                item.classList.add('fpt-nav-hidden');
                item.setAttribute('aria-hidden', 'true');
                return;
            }
            item.classList.remove('fpt-nav-section-hidden');
            item.setAttribute('aria-hidden', 'false');
        });
    }

    const api = {
        get activeSection() { return activeSection; },
        showSectionForPage,
        expandSection,
        toggleSection,
        getExpandedSections: () => Array.from(expandedSections),
        setExpandedSections,
        refresh: renderExpandedSections,
        revealAllForSearch,
        isNavCollapsed,
        setNavCollapsed,
        getNavStateSnapshot: () => ({
            collapsed: navCollapsed,
            expandedSections: Array.from(expandedSections),
            focusedSection
        }),
        restoreNavStateSnapshot(snapshot) {
            if (!snapshot || typeof snapshot !== 'object') return;
            setNavCollapsed(snapshot.collapsed === true, false);
            expandedSections = new Set(normalizeSectionIds(snapshot.expandedSections));
            focusedSection = sectionById.has(snapshot.focusedSection) ? snapshot.focusedSection : null;
            renderExpandedSections();
        },
        resetForInitialOpen() {
            cancelPendingCompactSection();
            collapsedUserChanged = true;
            expandedSectionsUserChanged = true;
            activeSection = null;
            focusedSection = null;
            setNavCollapsed(false, false);
            setExpandedSections([], false);
        }
    };
    toolsPopup._fptNavSections = api;

    groupRefs.forEach(({ toggle }, sectionId) => {
        toggle.addEventListener('click', () => {
            if (pendingCompactSection) {
                focusedSection = sectionId;
                pendingCompactSection = sectionId;
                setExpandedSections([sectionId], true);
                return;
            }
            if (isNavCollapsed()) {
                focusedSection = sectionId;
                pendingCompactSection = sectionId;
                nav.classList.add('is-nav-opening');
                nav.addEventListener('transitionend', onCompactNavExpanded);
                setNavCollapsed(false, true);
                setExpandedSections([sectionId], true);
                if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                    cancelPendingCompactSection();
                } else {
                    pendingCompactTimer = setTimeout(cancelPendingCompactSection, 460);
                }
                return;
            }
            toggleSection(sectionId);
        });
    });

    if (collapseButton) {
        collapseButton.addEventListener('click', () => {
            cancelPendingCompactSection();
            if (isNavCollapsed()) {
                focusedSection = null;
                setNavCollapsed(false, true);
                setExpandedSections([], true);
            } else {
                setExpandedSections([], true);
                setNavCollapsed(true, true);
            }
        });
    }

    renderExpandedSections();
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            Promise.resolve(chrome.storage.local.get([FPT_NAV_EXPANDED_STORAGE_KEY, FPT_NAV_COLLAPSED_STORAGE_KEY])).then(result => {
                const collapsed = result?.[FPT_NAV_COLLAPSED_STORAGE_KEY];
                if (typeof collapsed === 'boolean' && !collapsedUserChanged) setNavCollapsed(collapsed, false);

                const savedExpandedSections = result?.[FPT_NAV_EXPANDED_STORAGE_KEY];
                const validSavedExpandedSections = Array.isArray(savedExpandedSections)
                    && savedExpandedSections.every(sectionId => typeof sectionId === 'string' && sectionById.has(sectionId));
                if (validSavedExpandedSections && !expandedSectionsUserChanged) {
                    const restored = new Set(savedExpandedSections);
                    if (collapsed !== true && activeSection && restored.size) restored.add(activeSection);
                    setExpandedSections(restored, false);
                } else if (!expandedSectionsUserChanged) {
                    setExpandedSections(activeSection ? [activeSection] : [], false);
                }
            }).catch(() => {});
        }
    } catch (_) {}
    return api;
}

const FPT_POPUP_ROUTE_ALIASES = Object.create(null);
const FPT_POPUP_PAGE_MODE_HANDLERS = Object.create(null);

function registerPopupRouteAlias(alias, route) {
    const aliasId = String(alias || '').trim();
    const routeId = typeof route === 'string' ? route : route?.pageId;
    if (!aliasId || !routeId || aliasId === routeId) return false;
    FPT_POPUP_ROUTE_ALIASES[aliasId] = typeof route === 'string'
        ? { pageId: routeId }
        : { pageId: routeId, mode: route.mode };
    return true;
}

function registerPopupPageModeHandler(pageId, handler, targetPopup) {
    const id = String(pageId || '').trim();
    if (!id || !handler || typeof handler !== 'object') return false;
    FPT_POPUP_PAGE_MODE_HANDLERS[id] = handler;
    const popup = targetPopup || document.querySelector('.fp-tools-popup');
    if (popup) {
        popup._fptPageModeHandlers ||= Object.create(null);
        popup._fptPageModeHandlers[id] = handler;
    }
    return true;
}

function getPopupPageModeHandler(toolsPopup, pageId) {
    return toolsPopup?._fptPageModeHandlers?.[pageId]
        || FPT_POPUP_PAGE_MODE_HANDLERS[pageId]
        || window.__fptPopupPageModeHandlers?.[pageId]
        || null;
}

function popupPageModeDefault(handler) {
    return handler && Object.prototype.hasOwnProperty.call(handler, 'defaultMode')
        ? handler.defaultMode
        : null;
}

function isPopupPageModeSupported(handler, mode) {
    if (mode == null) return mode === popupPageModeDefault(handler);
    if (typeof handler?.isModeSupported === 'function') return !!handler.isModeSupported(mode);
    if (Array.isArray(handler?.modes)) return handler.modes.includes(mode);
    return mode === popupPageModeDefault(handler);
}

function normalizePopupRoute(pageId) {
    let normalizedId = typeof pageId === 'string' ? pageId : '';
    let aliasMode;
    const visited = new Set();
    while (normalizedId && FPT_POPUP_ROUTE_ALIASES[normalizedId] && !visited.has(normalizedId)) {
        visited.add(normalizedId);
        const alias = FPT_POPUP_ROUTE_ALIASES[normalizedId];
        if (alias.mode !== undefined && aliasMode === undefined) aliasMode = alias.mode;
        normalizedId = alias.pageId;
    }
    return { pageId: normalizedId, mode: aliasMode };
}

function findPopupPage(toolsPopup, pageId) {
    return Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content'))
        .find(page => page.dataset.page === pageId) || null;
}

function getPopupNavigationActions(toolsPopup) {
    return Array.from(toolsPopup.querySelectorAll('.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]'));
}

function isPopupPageAvailable(toolsPopup, pageId) {
    if (pageId !== 'global_chat') return true;
    const navItem = getPopupNavigationActions(toolsPopup).find(item => item.dataset.page === pageId);
    return toolsPopup._fptGlobalChatDisplay !== false && !navItem?.hidden && navItem?.style?.display !== 'none';
}

function isPopupPageSearchable(toolsPopup, pageId) {
    if (pageId !== 'global_chat') return true;
    const pageNode = findPopupPage(toolsPopup, pageId);
    return isPopupPageAvailable(toolsPopup, pageId) && pageNode?.dataset?.fptSearchExcluded !== 'true';
}

function enqueuePopupNavigationWrite(toolsPopup, write) {
    const previous = toolsPopup._fptNavigationWriteQueue || Promise.resolve();
    const current = previous.catch(() => {}).then(write);
    toolsPopup._fptNavigationWriteQueue = current.catch(() => {});
    return current;
}

function persistPopupRouteState(toolsPopup, pageId, mode) {
    return enqueuePopupNavigationWrite(toolsPopup, async () => {
        const stored = await chrome.storage.local.get('fpToolsPageModes');
        const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
            ? stored.fpToolsPageModes
            : {};
        await chrome.storage.local.set({
            fpToolsLastPage: pageId,
            fpToolsLastPageMode: mode,
            fpToolsPageModes: { ...savedModes, [pageId]: mode }
        });
    });
}

function persistPopupPageMode(pageId, mode) {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return Promise.resolve(false);
    const handler = getPopupPageModeHandler(toolsPopup, pageId);
    if (!handler || !isPopupPageModeSupported(handler, mode)) return Promise.resolve(false);
    return enqueuePopupNavigationWrite(toolsPopup, async () => {
        const stored = await chrome.storage.local.get(['fpToolsPageModes', 'fpToolsLastPage']);
        const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
            ? stored.fpToolsPageModes
            : {};
        const currentPageId = toolsPopup._fptCurrentPageId || stored?.fpToolsLastPage;
        const nextState = { fpToolsPageModes: { ...savedModes, [pageId]: mode } };
        if (currentPageId === pageId) nextState.fpToolsLastPageMode = mode;
        await chrome.storage.local.set(nextState);
        return true;
    });
}

async function openPopupPage(pageId, options = {}) {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return false;
    const opts = options && typeof options === 'object' ? options : {};
    const persist = opts.persist !== false;
    const initialRoute = normalizePopupRoute(pageId);
    let targetPageId = initialRoute.pageId;
    let requestedMode = opts.mode === undefined ? initialRoute.mode : opts.mode;
    const routeVersion = (toolsPopup._fptRouteVersion || 0) + 1;
    toolsPopup._fptRouteVersion = routeVersion;

    let pageNode = findPopupPage(toolsPopup, targetPageId);
    if (!pageNode || !isPopupPageAvailable(toolsPopup, targetPageId)) {
        targetPageId = 'lot_io';
        requestedMode = undefined;
        pageNode = findPopupPage(toolsPopup, targetPageId);
    }
    if (!pageNode) return false;

    const previousPageId = toolsPopup._fptCurrentPageId
        || Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content')).find(page => page.classList.contains('active'))?.dataset.page
        || null;
    if (previousPageId === 'finance_hub' && targetPageId !== 'finance_hub'
        && window.fptFinanceHub && typeof window.fptFinanceHub.onPageLeave === 'function') {
        window.fptFinanceHub.onPageLeave();
    }

    const actions = getPopupNavigationActions(toolsPopup);
    const navItem = actions.find(item => item.dataset.page === targetPageId) || null;
    const navSections = toolsPopup._fptNavSections;
    if (navSections && typeof navSections.showSectionForPage === 'function') navSections.showSectionForPage(targetPageId);
    actions.forEach(item => item.classList.toggle('active', item.dataset.page === targetPageId));
    toolsPopup.querySelectorAll('.fp-tools-page-content').forEach(page => {
        page.classList.toggle('active', page === pageNode);
    });
    const content = toolsPopup.querySelector('.fp-tools-content');
    content?.classList.remove('fpt-start-state-active');
    toolsPopup.querySelector('#fpToolsStartScreen')?.setAttribute('aria-hidden', 'true');
    toolsPopup._fptCurrentPageId = targetPageId;

    let stored = {};
    try {
        stored = await chrome.storage.local.get(['fpToolsLastPage', 'fpToolsLastPageMode', 'fpToolsPageModes']);
    } catch (_) {}
    if (routeVersion !== toolsPopup._fptRouteVersion) return false;

    const handler = getPopupPageModeHandler(toolsPopup, targetPageId);
    const savedModes = stored?.fpToolsPageModes && typeof stored.fpToolsPageModes === 'object' && !Array.isArray(stored.fpToolsPageModes)
        ? stored.fpToolsPageModes
        : {};
    const hasSavedPageMode = Object.prototype.hasOwnProperty.call(savedModes, targetPageId);
    let targetMode = popupPageModeDefault(handler);

    if (requestedMode !== undefined) {
        targetMode = isPopupPageModeSupported(handler, requestedMode) ? requestedMode : popupPageModeDefault(handler);
    } else if (hasSavedPageMode) {
        targetMode = isPopupPageModeSupported(handler, savedModes[targetPageId])
            ? savedModes[targetPageId]
            : popupPageModeDefault(handler);
    } else if (targetPageId === 'finance_hub' && handler) {
        try {
            const sessionMode = sessionStorage.getItem('fpt_fin_active_subtab');
            if (isPopupPageModeSupported(handler, sessionMode)) targetMode = sessionMode;
        } catch (_) {}
    }

    if (handler && typeof handler.select === 'function') {
        toolsPopup._fptApplyingRouteMode = true;
        try {
            const selection = await handler.select(targetMode, { persist: false, pageId: targetPageId });
            if (selection === false && targetMode !== popupPageModeDefault(handler)) {
                targetMode = popupPageModeDefault(handler);
                await handler.select(targetMode, { persist: false, pageId: targetPageId });
            }
        } catch (_) {
            targetMode = popupPageModeDefault(handler);
            try { await handler.select(targetMode, { persist: false, pageId: targetPageId }); } catch (_) {}
        } finally {
            toolsPopup._fptApplyingRouteMode = false;
        }
    }
    if (routeVersion !== toolsPopup._fptRouteVersion) return false;

    const isNewEntry = previousPageId !== targetPageId;
    if (isNewEntry) {
        const initialize = name => {
            const fn = window[name] || globalThis[name];
            if (typeof fn !== 'function') return;
            try {
                const result = fn();
                if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch (_) {}
        };
        if (targetPageId === 'epic_nicks') initialize('renderEpicPreviews');
        if (targetPageId === 'finance_hub') initialize('initializeFinanceHub');
        if (targetPageId === 'global_chat') initialize('initializeGlobalChat');
        if (targetPageId === 'templates') {
            initialize('setupTemplateSettingsHandlers');
            initialize('initializeSlashCommandsUI');
        }
        if (targetPageId === 'piggy_banks') initialize('renderPiggyBankSettings');
        if (targetPageId === 'lot_io') initialize('initializeLotIO');
        if (targetPageId === 'auto_reply') initialize('initializeAutoReplyUI');
        if (targetPageId === 'auto_review') initialize('initializeAutoReviewUI');
        if (targetPageId === 'needs') initialize('initializeNeedsTab');
        if (targetPageId === 'telegram') initialize('initializeTelegramUI');
        if (targetPageId === 'blacklist') initialize('initializeBlacklist');
        if (targetPageId === 'tickets') initialize('initTicketsTab');
        if (targetPageId === 'theme') initialize('initializeWallpaperPresets');
    }

    const wallpaperCarousel = document.getElementById('fp-wallpaper-carousel');
    if (wallpaperCarousel) wallpaperCarousel.style.display = targetPageId === 'theme' ? 'block' : 'none';
    if (typeof opts.focusTarget === 'string') {
        const target = pageNode.querySelector(opts.focusTarget);
        if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    } else if (opts.focusTarget && typeof opts.focusTarget.focus === 'function') {
        opts.focusTarget.focus({ preventScroll: true });
    } else if (opts.focusTarget === true && navItem && typeof navItem.focus === 'function') {
        navItem.focus({ preventScroll: true });
    }

    if (persist) {
        try { await persistPopupRouteState(toolsPopup, targetPageId, targetMode); } catch (_) {}
    }
    return true;
}

function setupGlobalChatVisibilityHandoff(toolsPopup) {
    if (!toolsPopup || toolsPopup.dataset.fptGlobalChatVisibilityBound) return;
    toolsPopup.dataset.fptGlobalChatVisibilityBound = '1';
    window.addEventListener('fpt:global-chat-visibility', event => {
        const detail = event?.detail || {};
        const display = detail.display !== false;
        const active = detail.active !== false;
        const changed = toolsPopup._fptGlobalChatDisplay !== display || toolsPopup._fptGlobalChatActive !== active;
        toolsPopup._fptGlobalChatDisplay = display;
        toolsPopup._fptGlobalChatActive = active;

        const navItem = getPopupNavigationActions(toolsPopup).find(item => item.dataset.page === 'global_chat');
        const pageNode = findPopupPage(toolsPopup, 'global_chat');
        if (navItem) {
            navItem.hidden = !display;
            navItem.style.display = display ? '' : 'none';
            navItem.setAttribute('aria-hidden', display ? 'false' : 'true');
            navItem.setAttribute('aria-disabled', active ? 'false' : 'true');
            navItem.classList.toggle('fpt-nav-disabled', !active);
        }
        if (pageNode) {
            pageNode.dataset.fptSearchExcluded = display ? 'false' : 'true';
            pageNode.classList.toggle('fpt-page-disabled', !active);
        }
        if (!changed) return;

        if (toolsPopup._fptNavSearch && typeof toolsPopup._fptNavSearch.refreshVisibility === 'function') {
            toolsPopup._fptNavSearch.refreshVisibility();
        }
        if (!display && toolsPopup._fptCurrentPageId === 'global_chat') {
            openPopupPage('lot_io');
        }
    });
}

if (typeof window !== 'undefined') {
    window.__fptPopupRouteAliases ||= FPT_POPUP_ROUTE_ALIASES;
    window.__fptPopupPageModeHandlers ||= FPT_POPUP_PAGE_MODE_HANDLERS;
    if (typeof window.fptRegisterPopupRouteAlias !== 'function') {
        window.fptRegisterPopupRouteAlias = registerPopupRouteAlias;
    }
    if (typeof window.fptRegisterPopupPageModeHandler !== 'function') {
        window.fptRegisterPopupPageModeHandler = registerPopupPageModeHandler;
    }
    if (typeof window.fptSetPopupPageMode !== 'function') {
        window.fptSetPopupPageMode = persistPopupPageMode;
    }
    if (typeof window.fptOpenPopupPage !== 'function') {
        window.fptOpenPopupPage = (pageId, options) => openPopupPage(pageId, options);
    }
}

function setupPopupNavigation() {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return;
    const navSections = setupNavigationSections(toolsPopup);
    const navItems = getPopupNavigationActions(toolsPopup);
    setupGlobalChatVisibilityHandoff(toolsPopup);

    navItems.forEach(item => {
        if (!item.dataset.page) return;
        item.addEventListener('click', event => {
            event.preventDefault();
            openPopupPage(item.dataset.page);
        });
    });

    const promoLink = document.querySelector('a[data-nav-to="support"]');
    if (promoLink) {
        promoLink.addEventListener('click', event => {
            event.preventDefault();
            openPopupPage('support');
        });
    }

    setupNavSearch(toolsPopup);
    setupAccentPicker(toolsPopup);
    setupQuickRepliesUI(toolsPopup);
    setupCalculatorUI(toolsPopup);
    setupNotificationCenterUI(toolsPopup);
    setupFinanceHubUI(toolsPopup);
    attachAutoReplyImageButtons(toolsPopup);

    // Общий чат: подтянуть удалённый конфиг и сразу применить видимость вкладки.
    // Если чат выключен/скрыт на GitHub - юзер увидит это без обновления расширения.
    if (typeof fptGcRefreshConfig === 'function') {
        Promise.resolve(fptGcRefreshConfig(false)).then(() => {
            if (typeof fptGcApplyVisibility === 'function') fptGcApplyVisibility();
        }).catch(() => {});
    }
}

function selectQuickRepliesMode(mode, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const toolsPopup = opts.popup || document.querySelector('.fp-tools-popup');
    const page = toolsPopup?.querySelector('.fp-tools-page-content[data-page="templates"]')
        || document.querySelector('.fp-tools-page-content[data-page="templates"]');
    if (!page || !['templates', 'commands'].includes(mode)) return false;

    const tabs = Array.from(page.querySelectorAll('[data-quick-replies-mode]'));
    const panes = Array.from(page.querySelectorAll('[data-quick-replies-pane]'));
    const tab = tabs.find(item => item.dataset.quickRepliesMode === mode);
    const pane = panes.find(item => item.dataset.quickRepliesPane === mode);
    if (!tab || !pane) return false;

    tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', selected ? 'true' : 'false');
        item.tabIndex = selected ? 0 : -1;
        item.classList.toggle('active', selected);
    });
    panes.forEach(item => {
        const selected = item === pane;
        item.hidden = !selected;
        item.setAttribute('aria-hidden', selected ? 'false' : 'true');
        item.classList.toggle('active', selected);
    });
    page.dataset.fptQuickRepliesMode = mode;

    if (opts.persist !== false && !toolsPopup?._fptApplyingRouteMode
        && typeof window.fptSetPopupPageMode === 'function') {
        Promise.resolve(window.fptSetPopupPageMode('templates', mode)).catch(() => {});
    }
    return true;
}

function setupQuickRepliesUI(targetPopup) {
    const toolsPopup = targetPopup || document.querySelector('.fp-tools-popup');
    const page = toolsPopup?.querySelector('.fp-tools-page-content[data-page="templates"]')
        || document.querySelector('.fp-tools-page-content[data-page="templates"]');
    if (!page) return false;

    registerPopupRouteAlias('slash_commands', { pageId: 'templates', mode: 'commands' });
    const modes = ['templates', 'commands'];
    registerPopupPageModeHandler('templates', {
        defaultMode: 'templates',
        modes,
        getMode() { return page.dataset.fptQuickRepliesMode || 'templates'; },
        select(mode, options = {}) { return selectQuickRepliesMode(mode, { ...options, popup: toolsPopup }); }
    }, toolsPopup);

    if (page.dataset.fptQuickRepliesBound) return true;
    const tabs = Array.from(page.querySelectorAll('[data-quick-replies-mode]'));
    const panes = Array.from(page.querySelectorAll('[data-quick-replies-pane]'));
    if (tabs.length !== modes.length || panes.length !== modes.length) return false;
    page.dataset.fptQuickRepliesBound = '1';

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', event => {
            event.preventDefault();
            selectQuickRepliesMode(tab.dataset.quickRepliesMode, { popup: toolsPopup });
        });
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            const nextTab = tabs[nextIndex];
            if (!nextTab) return;
            selectQuickRepliesMode(nextTab.dataset.quickRepliesMode, { popup: toolsPopup });
            nextTab.focus({ preventScroll: true });
        });
        if (!tab.getAttribute('aria-controls')) {
            tab.setAttribute('aria-controls', panes[index].id);
        }
        panes[index].setAttribute('aria-labelledby', tab.id);
        panes[index].setAttribute('role', 'tabpanel');
    });

    selectQuickRepliesMode(page.dataset.fptQuickRepliesMode || 'templates', { persist: false, popup: toolsPopup });
    return true;
}

function setupPopupPageModeTabs(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const toolsPopup = opts.popup || document.querySelector('.fp-tools-popup');
    const page = toolsPopup?.querySelector(opts.pageSelector) || document.querySelector(opts.pageSelector);
    if (!page) return false;

    const tabs = Array.from(page.querySelectorAll(opts.tabSelector));
    const panes = Array.from(page.querySelectorAll(opts.paneSelector));
    const modes = tabs.map(tab => tab.dataset[opts.tabModeKey]).filter(Boolean);
    if (!tabs.length || tabs.length !== panes.length || !modes.includes(opts.defaultMode)) return false;

    if (opts.alias) registerPopupRouteAlias(opts.alias, { pageId: opts.pageId, mode: opts.aliasMode });

    const select = (mode, selectionOptions = {}) => {
        const tabIndex = tabs.findIndex(tab => tab.dataset[opts.tabModeKey] === mode);
        const pane = panes.find(item => item.dataset[opts.paneModeKey] === mode);
        if (tabIndex === -1 || !pane) return false;
        const tab = tabs[tabIndex];

        tabs.forEach(item => {
            const selected = item === tab;
            item.setAttribute('role', 'tab');
            item.setAttribute('aria-selected', selected ? 'true' : 'false');
            item.tabIndex = selected ? 0 : -1;
            item.classList.toggle(opts.activeClass, selected);
        });
        panes.forEach(item => {
            const selected = item === pane;
            item.setAttribute('role', 'tabpanel');
            item.setAttribute('aria-hidden', selected ? 'false' : 'true');
            item.hidden = !selected;
            item.classList.toggle('active', selected);
        });
        page.dataset[opts.pageModeKey] = mode;

        if (opts.pageId === 'calculator' && mode === 'currency' && page.dataset.fptCurrencyInitRequested !== '1') {
            const initialize = window.initializeCurrencyCalculator
                || (typeof initializeCurrencyCalculator === 'function' ? initializeCurrencyCalculator : null);
            if (typeof initialize === 'function') {
                page.dataset.fptCurrencyInitRequested = '1';
                try {
                    const result = initialize();
                    if (result && typeof result.catch === 'function') result.catch(() => {});
                } catch (_) {}
            }
        }

        if (selectionOptions.persist !== false && !toolsPopup?._fptApplyingRouteMode
            && typeof window.fptSetPopupPageMode === 'function') {
            Promise.resolve(window.fptSetPopupPageMode(opts.pageId, mode)).catch(() => {});
        }
        return true;
    };

    registerPopupPageModeHandler(opts.pageId, {
        defaultMode: opts.defaultMode,
        modes,
        getMode() { return page.dataset[opts.pageModeKey] || opts.defaultMode; },
        select(mode, selectionOptions = {}) { return select(mode, { ...selectionOptions, persist: false }); }
    }, toolsPopup);

    if (!page.dataset[opts.boundKey]) {
        page.dataset[opts.boundKey] = '1';
        tabs.forEach((tab, index) => {
            const pane = panes.find(item => item.dataset[opts.paneModeKey] === tab.dataset[opts.tabModeKey]);
            if (!pane) return;
            const tabId = tab.id || `${opts.idPrefix}${tab.dataset[opts.tabModeKey][0].toUpperCase()}${tab.dataset[opts.tabModeKey].slice(1)}Tab`;
            const paneId = pane.id || `${opts.idPrefix}${tab.dataset[opts.tabModeKey][0].toUpperCase()}${tab.dataset[opts.tabModeKey].slice(1)}Pane`;
            tab.id = tabId;
            pane.id = paneId;
            tab.setAttribute('aria-controls', paneId);
            pane.setAttribute('aria-labelledby', tabId);

            tab.addEventListener('click', event => {
                event.preventDefault();
                select(tab.dataset[opts.tabModeKey]);
            });
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = tabs.indexOf(tab);
                const nextIndex = event.key === 'Home' ? 0
                    : event.key === 'End' ? tabs.length - 1
                        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                const nextTab = tabs[nextIndex];
                if (select(nextTab.dataset[opts.tabModeKey])) nextTab.focus({ preventScroll: true });
            });
        });
    }

    const savedOnPage = page.dataset[opts.pageModeKey];
    select(modes.includes(savedOnPage) ? savedOnPage : opts.defaultMode, { persist: false });
    return true;
}

function setupCalculatorUI(targetPopup) {
    return setupPopupPageModeTabs({
        popup: targetPopup,
        pageId: 'calculator',
        pageSelector: '.fp-tools-page-content[data-page="calculator"]',
        tabSelector: '.calc-subtab',
        paneSelector: '.calc-pane',
        tabModeKey: 'calcMode',
        paneModeKey: 'calcPane',
        pageModeKey: 'fptCalculatorMode',
        boundKey: 'fptCalculatorModesBound',
        idPrefix: 'fptCalculator',
        activeClass: 'is-active',
        defaultMode: 'math',
        alias: 'currency_calc',
        aliasMode: 'currency'
    });
}

function setupNotificationCenterUI(targetPopup) {
    return setupPopupPageModeTabs({
        popup: targetPopup,
        pageId: 'telegram',
        pageSelector: '.fp-tools-page-content[data-page="telegram"]',
        tabSelector: '[data-notification-mode]',
        paneSelector: '[data-notification-pane]',
        tabModeKey: 'notificationMode',
        paneModeKey: 'notificationPane',
        pageModeKey: 'fptNotificationMode',
        boundKey: 'fptNotificationModesBound',
        idPrefix: 'fptNotification',
        activeClass: 'active',
        defaultMode: 'telegram'
    });
}

function setupFinanceHubUI(toolsPopup) {
    const finPage = toolsPopup ? toolsPopup.querySelector('.fp-tools-page-content[data-page="finance_hub"]') : document.querySelector('.fp-tools-page-content[data-page="finance_hub"]');
    if (!finPage || finPage.dataset.fptBound) return;
    finPage.dataset.fptBound = '1';

    // Subtabs: one shared "liquid glass" indicator slides under the active item.
    const subtabsBar = finPage.querySelector('#fptFinSubtabs');
    const indicator = finPage.querySelector('#fptFinSubtabsIndicator');
    const subtabs = Array.from(finPage.querySelectorAll('.fpt-fin-subtab'));
    const panes = Array.from(finPage.querySelectorAll('.fpt-fin-tab-pane'));
    let indicatorMotionTimer = null;
    let paneTransitionTimer = null;
    let paneTransitionToken = 0;

    function positionSubtabIndicator(activeButton, animate) {
        if (!subtabsBar || !indicator) return;
        const active = activeButton || finPage.querySelector('.fpt-fin-subtab.active');
        if (!active) return;

        const left = active.offsetLeft;
        const width = active.offsetWidth;
        if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return;

        indicator.style.setProperty('--fpt-fin-pill-x', `${left}px`);
        indicator.style.setProperty('--fpt-fin-pill-w', `${width}px`);

        if (!indicator.classList.contains('is-ready')) {
            indicator.classList.add('is-ready');
            return;
        }

        if (animate !== false) {
            indicator.classList.remove('is-moving');
            // Force a tiny style flush so repeated fast tab clicks restart the liquid stretch.
            void indicator.offsetWidth;
            indicator.classList.add('is-moving');
            if (indicatorMotionTimer) clearTimeout(indicatorMotionTimer);
            indicatorMotionTimer = setTimeout(() => {
                indicator.classList.remove('is-moving');
                indicatorMotionTimer = null;
            }, 260);
        }
    }

    function switchSubtab(target, persistMode = true) {
        if (!target) return;
        const prevSubtab = finPage.querySelector('.fpt-fin-subtab.active')?.dataset?.subtab;
        const currentPane = finPage.querySelector('.fpt-fin-tab-pane.active');
        const targetPane = finPage.querySelector(`.fpt-fin-tab-pane[data-subtab="${target}"]`);
        let activeButton = null;

        subtabs.forEach(s => {
            const isActive = (s.dataset.subtab === target);
            s.classList.toggle('active', isActive);
            s.setAttribute('aria-selected', isActive ? 'true' : 'false');
            s.tabIndex = isActive ? 0 : -1;
            if (isActive) activeButton = s;
        });

        if (activeButton && subtabsBar) {
            positionSubtabIndicator(activeButton, prevSubtab && prevSubtab !== target);

            const subLeft = activeButton.offsetLeft;
            const subWidth = activeButton.offsetWidth;
            const barWidth = subtabsBar.clientWidth;
            const targetScroll = subLeft - (barWidth - subWidth) / 2;
            subtabsBar.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
        }

        const reducedMotion = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const activateTargetPane = () => {
            panes.forEach(pane => {
                pane.classList.remove('is-leaving', 'is-entering');
                const isTarget = pane === targetPane;
                pane.classList.toggle('active', isTarget);
                pane.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
            });

            if (!targetPane || reducedMotion) return;

            targetPane.classList.add('is-entering');
            const raf = typeof requestAnimationFrame === 'function'
                ? requestAnimationFrame
                : (callback) => setTimeout(callback, 0);

            raf(() => {
                raf(() => {
                    if (targetPane.classList.contains('active')) {
                        targetPane.classList.remove('is-entering');
                    }
                });
            });
        };

        if (paneTransitionTimer) {
            clearTimeout(paneTransitionTimer);
            paneTransitionTimer = null;
        }
        paneTransitionToken += 1;
        const transitionToken = paneTransitionToken;

        if (currentPane && targetPane && currentPane !== targetPane && !reducedMotion) {
            currentPane.classList.remove('is-entering');
            currentPane.classList.add('is-leaving');
            currentPane.setAttribute('aria-hidden', 'true');

            paneTransitionTimer = setTimeout(() => {
                if (transitionToken !== paneTransitionToken) return;
                paneTransitionTimer = null;
                activateTargetPane();
            }, 90);
        } else {
            activateTargetPane();
        }

        try {
            sessionStorage.setItem('fpt_fin_active_subtab', target);
        } catch (_) {}

        // Start loading/rendering the selected Finance section immediately while the
        // outgoing pane is fading, so the motion does not add data-loading latency.
        if (window.fptFinanceHub && typeof window.fptFinanceHub.onSubtabChange === 'function') {
            window.fptFinanceHub.onSubtabChange(target, prevSubtab);
        }

        if (persistMode && !toolsPopup?._fptApplyingRouteMode && typeof window.fptSetPopupPageMode === 'function') {
            window.fptSetPopupPageMode('finance_hub', target).catch(() => {});
        }
    }

    registerPopupPageModeHandler('finance_hub', {
        defaultMode: 'overview',
        modes: subtabs.map(subtab => subtab.dataset.subtab),
        getMode() { return finPage.querySelector('.fpt-fin-subtab.active')?.dataset?.subtab || 'overview'; },
        select(mode) {
            if (!subtabs.some(subtab => subtab.dataset.subtab === mode)) return false;
            switchSubtab(mode, false);
            return true;
        }
    }, toolsPopup);

    subtabs.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            switchSubtab(btn.dataset.subtab);
        });

        btn.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            let nextIndex = index;
            if (e.key === 'ArrowLeft') nextIndex = (index - 1 + subtabs.length) % subtabs.length;
            if (e.key === 'ArrowRight') nextIndex = (index + 1) % subtabs.length;
            if (e.key === 'Home') nextIndex = 0;
            if (e.key === 'End') nextIndex = subtabs.length - 1;
            const next = subtabs[nextIndex];
            if (next) {
                switchSubtab(next.dataset.subtab);
                next.focus({ preventScroll: true });
            }
        });
    });

    // Keep the indicator aligned after popup resize/theme/font changes.
    if (subtabsBar && typeof ResizeObserver !== 'undefined') {
        const subtabResizeObserver = new ResizeObserver(() => {
            positionSubtabIndicator(null, false);
        });
        subtabResizeObserver.observe(subtabsBar);
        subtabs.forEach(btn => subtabResizeObserver.observe(btn));
        finPage.__fptFinanceSubtabResizeObserver = subtabResizeObserver;
    } else if (typeof window !== 'undefined') {
        const onFinanceResize = () => positionSubtabIndicator(null, false);
        window.addEventListener('resize', onFinanceResize, { passive: true });
        finPage.__fptFinanceSubtabResizeFallback = onFinanceResize;
    }

    // Restore saved subtab if any.
    let restored = false;
    try {
        const savedSubtab = sessionStorage.getItem('fpt_fin_active_subtab');
        if (savedSubtab && finPage.querySelector(`.fpt-fin-subtab[data-subtab="${savedSubtab}"]`)) {
            switchSubtab(savedSubtab, false);
            restored = true;
        }
    } catch (_) {}

    if (!restored) {
        const initial = finPage.querySelector('.fpt-fin-subtab.active');
        subtabs.forEach(s => {
            const isActive = s === initial;
            s.tabIndex = isActive ? 0 : -1;
        });
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => positionSubtabIndicator(initial, false));
        } else {
            positionSubtabIndicator(initial, false);
        }
    }

    if (window.fptFinanceHub && typeof window.fptFinanceHub.init === 'function') {
        window.fptFinanceHub.init(finPage);
    }
}

function initializeFinanceHub() {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (toolsPopup) {
        setupFinanceHubUI(toolsPopup);
    }
    if (window.fptFinanceHub && typeof window.fptFinanceHub.onOpen === 'function') {
        window.fptFinanceHub.onOpen();
    }
}

// 3.0: add an image-insert button to every autoreply textarea (greeting, keyword responses,
// review templates, bonus, new-order, order-confirm). Inserts an [image:...] tag at the caret;
// the background sender uploads & sends it in order. This is "картинки во все автоответы".
function attachAutoReplyImageButtons(toolsPopup) {
    const ids = ['greetingText', 'newOrderReplyText', 'orderConfirmReplyText', 'singleBonusText',
                 'newKeywordResponse',
                 'fpt-review-5', 'fpt-review-4', 'fpt-review-3', 'fpt-review-2', 'fpt-review-1'];
    ids.forEach(id => {
        const ta = toolsPopup.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(id) : id));
        if (!ta || ta.dataset.fptImgBtn) return;
        ta.dataset.fptImgBtn = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        const autoReplyPage = typeof ta.closest === 'function'
            ? ta.closest('.fp-tools-page-content[data-page="auto_reply"]')
            : null;
        if (autoReplyPage) {
            btn.className = 'fpt-ui-button fpt-ui-button--secondary fpt-ui-icon-button fp-ar-image-btn fpt-autoreply-img-btn';
            btn.title = 'Добавить изображение';
            btn.setAttribute('aria-label', 'Добавить изображение');
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="m6.5 17 4.2-4.2 2.8 2.8 1.7-1.7L19 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        } else {
            btn.className = 'btn fpt-img-btn fpt-autoreply-img-btn';
            btn.title = 'Вставить изображение';
            btn.innerHTML = '<span class="material-symbols-rounded">image</span>';
        }
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleImageAddClick === 'function') handleImageAddClick(ta);
        });
        if (autoReplyPage) {
            const actionHost = autoReplyPage.querySelector('[data-editor-actions-for="' + id + '"]');
            if (actionHost) actionHost.appendChild(btn);
            else ta.insertAdjacentElement('afterend', btn);
        } else if (ta.parentNode) {
            ta.insertAdjacentElement('afterend', btn);
        }
    });
    // keyword rule responses are dynamic - delegate
    if (!toolsPopup.dataset.fptKwImgDelegated) {
        toolsPopup.dataset.fptKwImgDelegated = '1';
        toolsPopup.addEventListener('click', (e) => {
            const b = e.target.closest('.fpt-keyword-img-btn');
            if (!b) return;
            e.preventDefault();
            const row = b.closest('.keyword-rule, .keyword-item') || b.parentElement;
            const ta = row && row.querySelector('textarea');
            if (ta && typeof handleImageAddClick === 'function') handleImageAddClick(ta);
        });
    }
}

function setupAccentPicker(toolsPopup) {
    const btn = toolsPopup.querySelector('#fptAccentBtn');
    const input = toolsPopup.querySelector('#fptAccentInput');
    if (!btn || !input) return;

    const DEFAULT_ACCENT = '#1b75bb';

    // Применяем акцент через ЕДИНУЮ функцию темизации меню — так обновляются ВСЕ
    // акцентные места (кнопка «Применить», галочки, иконка активной вкладки и т.д.),
    // и повторный запуск fptApplyMenuTheme (наблюдатель при перемещении/смене темы)
    // уже не сбрасывает цвет, т.к. читает window.__fptUserAccent.
    function applyAccent(hex) {
        window.__fptUserAccent = hex;
        try { if (typeof fptApplyMenuTheme === 'function') fptApplyMenuTheme(toolsPopup); } catch (_) {}
    }

    let lastApply = 0;
    let pending = null;
    function throttledApply(hex) {
        const now = Date.now();
        if (now - lastApply >= 120) {
            lastApply = now;
            applyAccent(hex);
        } else {
            if (pending) clearTimeout(pending);
            pending = setTimeout(() => { lastApply = Date.now(); applyAccent(hex); pending = null; }, 120 - (now - lastApply));
        }
    }

    chrome.storage.local.get('fpToolsAccentColor').then(({ fpToolsAccentColor }) => {
        if (fpToolsAccentColor) {
            input.value = fpToolsAccentColor;
            applyAccent(fpToolsAccentColor);
        } else {
            input.value = DEFAULT_ACCENT;
        }
    }).catch(() => {});

    input.addEventListener('input', () => throttledApply(input.value));
    input.addEventListener('change', () => {
        applyAccent(input.value);
        try { chrome.storage.local.set({ fpToolsAccentColor: input.value }); } catch (_) {}
    });
}

function setupNavSearch(toolsPopup) {
    const input = toolsPopup.querySelector('#fptNavSearch');
    const clearBtn = toolsPopup.querySelector('#fptNavSearchClear');
    const searchToggle = toolsPopup.querySelector('#fptNavSearchToggle');
    const resultsBox = toolsPopup.querySelector('#fptNavSearchResults');
    const nav = toolsPopup.querySelector('.fp-tools-nav');
    const body = toolsPopup.querySelector('.fp-tools-body');
    const navSections = toolsPopup._fptNavSections || null;
    if (!input || !nav || !resultsBox) return;
    let searchNavStateSnapshot = null;

    function restoreNavStateSnapshot() {
        if (!searchNavStateSnapshot || !navSections) return false;
        navSections.restoreNavStateSnapshot(searchNavStateSnapshot);
        searchNavStateSnapshot = null;
        return true;
    }

    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            if (navSections?.isNavCollapsed()) {
                if (!searchNavStateSnapshot) searchNavStateSnapshot = navSections.getNavStateSnapshot();
                navSections.setNavCollapsed(false, false);
            }
            input.focus();
        });
    }

    // Выносим выпадашку результатов из левой панели (у неё overflow:auto, который
    // обрезал бы список) в общий контейнер тела попапа — так список может свободно
    // раскрываться поверх правой панели с функциями и показывать строки целиком.
    if (body && resultsBox.parentElement !== body) {
        body.appendChild(resultsBox);
    }

    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
    let currentSearchQuery = '';

    // Плавное скрытие: сначала снимаем active (запускается transition), затем, когда
    // анимация закончилась, чистим содержимое. Это убирает резкое мигание.
    let hideTimer = null;
    function showResults() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        resultsBox.classList.add('active');
    }
    function hideResults(clear) {
        resultsBox.classList.remove('active');
        if (clear) {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { resultsBox.innerHTML = ''; hideTimer = null; }, 180);
        }
    }

    const searchableFeatureSelector = 'h3, h4, h5, label > span, .feature-title, .setting-group > h4';
    const searchableModePaneSelector = '[data-quick-replies-pane], .fpt-fin-tab-pane[data-subtab], [data-calc-pane], [data-notification-pane], [data-route-mode]';
    const legacySearchAliases = Object.freeze({
        lot_io: [{ mode: null, aliases: ['Импорт / экспорт'] }],
        templates: [
            { mode: 'templates', aliases: ['Шаблоны'] },
            { mode: 'commands', aliases: ['Слэш-команды'] }
        ],
        calculator: [{ mode: 'currency', aliases: ['Валюты'] }],
        theme: [{ mode: null, aliases: ['Кастомизация'] }],
        tickets: [{ mode: null, aliases: ['Тикеты'] }],
        overview: [{ mode: null, aliases: ['Функции', 'Видео-обзор'] }],
        settings_io: [{ mode: null, aliases: ['Импорт / экспорт'] }],
        support: [{ mode: null, aliases: ['оценить', 'отзыв о расширении', 'поддержать разработчика'] }]
    });

    function getSearchableModePanes(page) {
        return Array.from(page?.querySelectorAll(searchableModePaneSelector) || []);
    }

    function getSearchMode(pane) {
        const data = pane?.dataset || {};
        return data.routeMode || data.quickRepliesPane || data.subtab || data.calcPane || data.notificationPane || null;
    }

    function getLegacyAliases(pageId, mode) {
        return (legacySearchAliases[pageId] || [])
            .filter(entry => entry.mode === (mode || null))
            .flatMap(entry => entry.aliases);
    }

    function getPageGroupId(pageId, navItem) {
        if (navItem?.dataset?.navSection) return navItem.dataset.navSection;
        return FPT_NAV_SECTIONS.find(section => section.pages.includes(pageId))?.id || null;
    }

    function buildFeatureIndex() {
        const index = [];
        const pages = Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content'));
        const actions = getPopupNavigationActions(toolsPopup);
        const pageById = new Map(pages.map(page => [page.dataset.page, page]));
        const actionById = new Map(actions.filter(item => item.dataset.page).map(item => [item.dataset.page, item]));
        const groupToggles = Array.from(toolsPopup.querySelectorAll('.fpt-nav-group-toggle'));
        const groupToggleById = new Map(groupToggles.map(item => [item.dataset.section, item]));
        const seen = new Set();
        const addEntry = (groupId, pageId, mode, text, aliases, element) => {
            const normalizedText = (text || '').replace(/\s+/g, ' ').trim();
            if (!normalizedText || normalizedText.length < 2 || normalizedText.length > 100) return;
            const key = [groupId || '', pageId || '', mode || '', normalizedText.toLowerCase()].join('::');
            if (seen.has(key)) return;
            seen.add(key);
            index.push({ groupId: groupId || null, pageId: pageId || null, mode: mode || null, text: normalizedText, aliases: aliases || [], element: element || null });
        };

        FPT_NAV_SECTIONS.forEach(section => {
            addEntry(section.id, null, null, section.label, [], groupToggleById.get(section.id));
        });

        actions.forEach(navItem => {
            const pageId = navItem.dataset.page;
            if (!pageId || !isPopupPageSearchable(toolsPopup, pageId)) return;
            const page = pageById.get(pageId);
            const label = (navItem.querySelector('span:last-child')?.textContent || pageId).trim();
            const groupId = getPageGroupId(pageId, navItem);
            const pageHeading = page?.querySelector(searchableFeatureSelector.split(',')[0]) || page;
            addEntry(groupId, pageId, null, label, getLegacyAliases(pageId, null), pageHeading || navItem);

            (legacySearchAliases[pageId] || []).filter(aliasRoute => aliasRoute.mode).forEach(aliasRoute => {
                const modePane = aliasRoute.mode && page
                    ? getSearchableModePanes(page).find(pane => getSearchMode(pane) === aliasRoute.mode)
                    : null;
                const modeHeading = modePane?.querySelector(searchableFeatureSelector.split(',')[0]);
                aliasRoute.aliases.forEach(alias => {
                    addEntry(groupId, pageId, aliasRoute.mode, alias, [alias], modeHeading || modePane || pageHeading || navItem);
                });
            });
        });

        pages.forEach(page => {
            const pageId = page.dataset.page;
            if (!isPopupPageSearchable(toolsPopup, pageId)) return;
            const navItem = actionById.get(pageId);
            const groupId = getPageGroupId(pageId, navItem);
            const addFeature = (container, mode) => {
                const headings = Array.from(container.querySelectorAll(searchableFeatureSelector));
                if (!headings.length && mode) {
                    const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
                    addEntry(groupId, pageId, mode, text, [], container);
                    return;
                }
                headings.forEach(element => {
                    if (element.closest('.fpt-nav-search')) return;
                    if (!mode && element.closest(searchableModePaneSelector)) return;
                    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
                    addEntry(groupId, pageId, mode, text, [], element);
                });
            };

            addFeature(page, null);
            getSearchableModePanes(page).forEach(pane => {
                const mode = getSearchMode(pane);
                if (mode) addFeature(pane, mode);
            });
        });
        return index;
    }

    function searchItemMatches(item, query) {
        return norm(item.text).includes(query) || (item.aliases || []).some(alias => norm(alias).includes(query));
    }

    function getMatchingGroupIds(index, query) {
        return new Set(index
            .filter(item => !item.pageId && item.groupId && searchItemMatches(item, query))
            .map(item => item.groupId));
    }

    function clearHighlights() {
        toolsPopup.querySelectorAll('.fpt-search-flash').forEach(el => el.classList.remove('fpt-search-flash'));
    }

    function waitForSearchMode(item, attempts = 30) {
        return new Promise(resolve => {
            const page = Array.from(toolsPopup.querySelectorAll('.fp-tools-page-content')).find(node => node.dataset.page === item.pageId);
            const pane = item.mode && page
                ? getSearchableModePanes(page).find(node => getSearchMode(node) === item.mode)
                : null;
            if (!pane) { resolve(); return; }
            const check = remaining => {
                if ((!pane.hidden && pane.getAttribute('aria-hidden') !== 'true') || remaining <= 0) { resolve(); return; }
                setTimeout(() => check(remaining - 1), 35);
            };
            check(attempts);
        });
    }

    function jumpToFeature(item) {
        const routeOptions = item.mode ? { mode: item.mode } : {};
        openPopupPage(item.pageId, routeOptions).then(routed => {
            if (routed === false) return;
            return waitForSearchMode(item).then(() => {
                const target = item.element;
                if (!target) return;
                clearHighlights();
                try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { target.scrollIntoView(); }
                target.classList.add('fpt-search-flash');
                setTimeout(() => target.classList.remove('fpt-search-flash'), 2200);
            });
        }).catch(() => {});
    }

    // Обновляем список результатов «на месте», не пересоздавая с нуля, чтобы не было
    // мигания: existing rows fade in, а не пропадают/появляются рывком.
    let lastKeys = '';
    function clearResultsImmediately() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        resultsBox.classList.remove('active');
        resultsBox.innerHTML = '';
        lastKeys = '';
    }

    function renderResults(query, invalidateImmediately = false) {
        const q = norm(query);
        if (!q) {
            if (invalidateImmediately) clearResultsImmediately();
            else { hideResults(true); lastKeys = ''; }
            return;
        }
        const index = buildFeatureIndex();
        const matchingGroups = getMatchingGroupIds(index, q);
        const hits = index
            .filter(it => searchItemMatches(it, q))
            .filter(it => !it.pageId || !matchingGroups.size || matchingGroups.has(it.groupId))
            .slice(0, 20);
        if (!hits.length) {
            if (invalidateImmediately) clearResultsImmediately();
            else { hideResults(true); lastKeys = ''; }
            return;
        }

        const keys = hits.map(h => [h.groupId || '', h.pageId || '', h.mode || '', h.text].join('::')).join('|');
        if (keys === lastKeys) {
            resultsBox.querySelectorAll('.fpt-nav-search-result').forEach(row => { row._fptSearchQuery = q; });
            showResults();
            return;
        } // содержимое не изменилось
        lastKeys = keys;

        resultsBox.innerHTML = '';
        const frag = document.createDocumentFragment();
        hits.forEach((it, i) => {
            const row = document.createElement('div');
            row.className = 'fpt-nav-search-result';
            row._fptSearchQuery = q;
            row.style.animationDelay = Math.min(i * 18, 180) + 'ms';
            row.innerHTML = `<span class="fpt-nsr-text"></span><span class="fpt-nsr-page"></span>`;
            row.querySelector('.fpt-nsr-text').textContent = it.text;
            const navItem = it.pageId ? getPopupNavigationActions(toolsPopup).find(item => item.dataset.page === it.pageId) : null;
            row.querySelector('.fpt-nsr-page').textContent = it.pageId
                ? (navItem?.querySelector('span:last-child')?.textContent || it.pageId).trim()
                : 'Группа';
            row.addEventListener('click', () => {
                if (!currentSearchQuery || row._fptSearchQuery !== currentSearchQuery) return;
                if (!it.pageId && it.groupId) {
                    navSections?.revealAllForSearch(new Set([it.groupId]));
                    return;
                }
                cancelPendingSearchRender();
                input.value = '';
                currentSearchQuery = '';
                applyFilter('');
                hideResults(true);
                jumpToFeature(it);
            });
            frag.appendChild(row);
        });
        resultsBox.appendChild(frag);
        showResults();
    }

    function applyFilter(query) {
        const q = norm(query);
        const items = toolsPopup.querySelectorAll('.fp-tools-nav li[data-page]');
        const dividers = toolsPopup.querySelectorAll('.fp-tools-nav li.fp-nav-divider');
        nav.classList.toggle('fpt-search-active', !!q);
        clearBtn.style.display = q ? 'block' : 'none';

        if (!q) {
            items.forEach(li => {
                const searchable = isPopupPageSearchable(toolsPopup, li.dataset.page);
                li.classList.toggle('fpt-nav-hidden', !searchable);
                li.classList.remove('fpt-nav-match');
                li.setAttribute('aria-hidden', searchable ? 'false' : 'true');
            });
            dividers.forEach(d => d.classList.remove('fpt-nav-hidden'));
            if (navSections) {
                if (!restoreNavStateSnapshot()) navSections.refresh();
            }
            return;
        }

        if (!searchNavStateSnapshot && navSections) {
            searchNavStateSnapshot = navSections.getNavStateSnapshot();
        }

        const searchIndex = buildFeatureIndex();
        const matchingGroups = getMatchingGroupIds(searchIndex, q);
        const matchingPages = new Set(searchIndex
            .filter(item => item.pageId && searchItemMatches(item, q)
                && (!matchingGroups.size || matchingGroups.has(item.groupId)))
            .map(item => item.pageId));
        const matchingSections = new Set(matchingGroups);

        items.forEach(li => {
            const label = norm(li.querySelector('span:last-child')?.textContent || '');
            const match = isPopupPageSearchable(toolsPopup, li.dataset.page)
                && (label.includes(q) || matchingPages.has(li.dataset.page) || matchingGroups.has(li.dataset.navSection));
            li.classList.toggle('fpt-nav-hidden', !match);
            li.classList.toggle('fpt-nav-match', match);
            li.setAttribute('aria-hidden', match ? 'false' : 'true');
            if (match && li.dataset.navSection) matchingSections.add(li.dataset.navSection);
        });

        dividers.forEach(d => d.classList.add('fpt-nav-hidden'));
        if (navSections) navSections.revealAllForSearch(matchingSections);
    }

    let t = null;
    function cancelPendingSearchRender() {
        if (t) clearTimeout(t);
        t = null;
    }

    input.addEventListener('input', () => {
        const v = input.value;
        currentSearchQuery = norm(v);
        applyFilter(v);
        cancelPendingSearchRender();
        t = setTimeout(() => { t = null; renderResults(v); }, 90);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { cancelPendingSearchRender(); input.value = ''; currentSearchQuery = ''; applyFilter(''); hideResults(true); input.blur(); }
        if (e.key === 'Enter') {
            const first = resultsBox.querySelector('.fpt-nav-search-result');
            if (first && currentSearchQuery && first._fptSearchQuery === currentSearchQuery) first.click();
        }
    });
    clearBtn.addEventListener('click', () => {
        cancelPendingSearchRender();
        input.value = '';
        currentSearchQuery = '';
        applyFilter('');
        hideResults(true);
        input.focus();
    });
    toolsPopup.addEventListener('click', (e) => {
        if (!e.target.closest('.fpt-nav-search') && !e.target.closest('.fpt-nav-search-results')) hideResults(false);
    });
    clearBtn.style.display = 'none';

    if (!toolsPopup.dataset.fptNavShortcutBound) {
        toolsPopup.dataset.fptNavShortcutBound = '1';
        toolsPopup.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 'k') return;
            if (!toolsPopup.classList.contains('active')) return;
            e.preventDefault();
            if (navSections?.isNavCollapsed() && searchToggle) searchToggle.click();
            input.focus();
            input.select();
        });
    }

    toolsPopup._fptNavSearch = {
        buildFeatureIndex,
        resetForPopupStart() {
            cancelPendingSearchRender();
            input.value = '';
            currentSearchQuery = '';
            searchNavStateSnapshot = null;
            applyFilter('');
            clearResultsImmediately();
            input.blur();
        },
        refreshVisibility() {
            currentSearchQuery = norm(input.value);
            applyFilter(input.value);
            renderResults(input.value, true);
        }
    };
}


function resetPopupStartState() {
    const toolsPopup = document.querySelector('.fp-tools-popup');
    if (!toolsPopup) return false;

    toolsPopup._fptRouteVersion = (toolsPopup._fptRouteVersion || 0) + 1;
    if (toolsPopup._fptCurrentPageId === 'finance_hub'
        && window.fptFinanceHub && typeof window.fptFinanceHub.onPageLeave === 'function') {
        window.fptFinanceHub.onPageLeave();
    }

    if (toolsPopup._fptNavSearch?.resetForPopupStart) toolsPopup._fptNavSearch.resetForPopupStart();
    getPopupNavigationActions(toolsPopup).forEach(item => item.classList.remove('active'));
    toolsPopup.querySelectorAll('.fp-tools-page-content').forEach(page => page.classList.remove('active'));
    toolsPopup._fptCurrentPageId = null;

    const content = toolsPopup.querySelector('.fp-tools-content');
    content?.classList.add('fpt-start-state-active');
    if (content) content.scrollTop = 0;
    toolsPopup.querySelector('#fpToolsStartScreen')?.setAttribute('aria-hidden', 'false');
    const wallpaperCarousel = toolsPopup.querySelector('#fp-wallpaper-carousel');
    if (wallpaperCarousel) wallpaperCarousel.style.display = 'none';

    if (toolsPopup._fptNavSections?.resetForInitialOpen) toolsPopup._fptNavSections.resetForInitialOpen();
    return true;
}

async function loadLastActivePage() {
    let fpToolsLastPage = null;
    try {
        ({ fpToolsLastPage } = await chrome.storage.local.get('fpToolsLastPage'));
    } catch (_) {}
    const popup = document.querySelector('.fp-tools-popup');
    const activePage = popup && Array.from(popup.querySelectorAll('.fp-tools-page-content'))
        .find(page => page.classList.contains('active'))?.dataset.page;
    const pageId = typeof fpToolsLastPage === 'string' && fpToolsLastPage ? fpToolsLastPage : activePage || 'lot_io';
    return openPopupPage(pageId);
}

function makePopupInteractive(popupEl) {
    const dragHandle = popupEl.querySelector('.fpt-nav-brand');
    if (!dragHandle) return;

    let isDragging = false;
    let offset = { x: 0, y: 0 };
    let hasBeenDragged = popupEl.classList.contains('no-transform');

    dragHandle.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        isDragging = true;
        if (!hasBeenDragged) {
            const rect = popupEl.getBoundingClientRect();
            popupEl.style.left = `${Math.round(rect.left)}px`;
            popupEl.style.top = `${Math.round(rect.top)}px`;
            popupEl.classList.add('no-transform');
            hasBeenDragged = true;
        }
        offset.x = e.clientX - popupEl.offsetLeft;
        offset.y = e.clientY - popupEl.offsetTop;
        popupEl.style.transition = 'none';
        document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const popupWidth = popupEl.offsetWidth;
            const popupHeight = popupEl.offsetHeight;
            const clamped = typeof clampPopupPosition === 'function'
                ? clampPopupPosition(e.clientX - offset.x, e.clientY - offset.y, popupWidth, popupHeight)
                : {
                    left: Math.max(0, Math.min(e.clientX - offset.x, Math.max(0, window.innerWidth - popupWidth))),
                    top: Math.max(0, Math.min(e.clientY - offset.y, Math.max(0, window.innerHeight - popupHeight)))
                };
            popupEl.style.left = `${clamped.left}px`;
            popupEl.style.top = `${clamped.top}px`;
        }
    });

    window.addEventListener('mouseup', async () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            if (chrome.runtime?.id) {
                await chrome.storage.local.set({ 
                    fpToolsPopupPosition: { top: popupEl.style.top, left: popupEl.style.left },
                    fpToolsPopupDragged: true 
                });
            }
        }
    });

    // 3.0.6.2: the observer used to fire chrome.storage.local.set on EVERY inline-style
    // mutation of the popup - including the left/top updates during drag and any transient
    // hover-driven style writes. That produced a storm of async storage writes (lag) and,
    // combined with the close-btn scale transition, a visible flicker when the cursor moved
    // between the ✕ and the title. Now: debounce, and only persist when width/height
    // actually changed.
    let __fptLastW = popupEl.style.width;
    let __fptLastH = popupEl.style.height;
    let __fptSizeSaveTimer = null;
    const resizeObserver = new MutationObserver(() => {
        const newWidth = popupEl.style.width;
        const newHeight = popupEl.style.height;
        if (newWidth === __fptLastW && newHeight === __fptLastH) return; // size unchanged → ignore
        __fptLastW = newWidth;
        __fptLastH = newHeight;
        if (__fptSizeSaveTimer) clearTimeout(__fptSizeSaveTimer);
        __fptSizeSaveTimer = setTimeout(() => {
            if (chrome.runtime?.id) {
                const norm = typeof normalizePopupSize === 'function'
                    ? normalizePopupSize({ width: newWidth, height: newHeight })
                    : { width: parseFloat(newWidth), height: parseFloat(newHeight) };
                const saveW = norm.width ? `${norm.width}px` : newWidth;
                const saveH = norm.height ? `${norm.height}px` : newHeight;
                chrome.storage.local.set({ fpToolsPopupSize: { width: saveW, height: saveH } });
                if (typeof ensurePopupInsideViewport === 'function') {
                    ensurePopupInsideViewport(popupEl);
                }
            }
        }, 300);
    });
    resizeObserver.observe(popupEl, { attributes: true, attributeFilter: ['style'] });

    // Clamp popup safely inside viewport when browser window resizes or changes monitor
    let __fptWinResizeTimer = null;
    window.addEventListener('resize', () => {
        if (__fptWinResizeTimer) clearTimeout(__fptWinResizeTimer);
        __fptWinResizeTimer = setTimeout(() => {
            if (!document.body.contains(popupEl)) return;
            if (typeof ensurePopupInsideViewport === 'function') {
                ensurePopupInsideViewport(popupEl);
            }
        }, 150);
    });
}
