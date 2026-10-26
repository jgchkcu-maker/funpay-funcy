const popupAutoBumpLog = [];
function logToAutoBumpConsole(message) {
    const entry = { timestamp: Date.now(), message: String(message) };
    popupAutoBumpLog.push(entry);
    if (popupAutoBumpLog.length > 500) popupAutoBumpLog.shift();
    window.dispatchEvent(new CustomEvent('fpt:autobump-log', { detail: entry }));
}

function initializeToolsPopup() {
    const popup = document.querySelector('.fp-tools-popup');
    if (!popup || popup.dataset.initialized === 'true') return;
    const closeOnOutsideClick = (event) => {
        if (!popup.classList.contains('active') || popup.classList.contains('is-closing')) return;
        if (popup.contains(event.target) || event.target?.closest?.('#fpToolsButton, .fpt-win-scrim')) return;
        popup._fptClose?.();
    };
    document.addEventListener('click', closeOnOutsideClick, true);
    popup._fptOutsideClickHandler = closeOnOutsideClick;
    if (typeof setupPopupNavigation === 'function') setupPopupNavigation();
    popup.dataset.initialized = 'true';
}

async function initializeQuickGamesMenu() {
    const navMenu = document.querySelector('#navbar > .nav.navbar-nav');
    if (!navMenu || document.querySelector('.menu-item-fp-games')) {
        return;
    }

    const gameDropdownItem = createElement('li', { class: 'dropdown menu-item-fp-games' });
    gameDropdownItem.innerHTML = `
        <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
            Игры <span class="caret"></span>
        </a>
        <ul class="dropdown-menu">
            <li class="info-text">Вставьте ссылку на категорию игры, и она добавится в этот список для быстрого доступа.</li>
            <li class="input-container">
                <input type="text" id="quickGameUrlInput" placeholder="https://funpay.com/lots/..."/>
            </li>
            <li role="separator" class="divider"></li>
            <div id="quickGamesListContainer"></div>
        </ul>
    `;

    const style = createElement('style', {}, {}, `
        /* Themed like the page select menus (page_selects.js): extension palette, rounded card. */
        .menu-item-fp-games > .dropdown-menu {
            --qg-bg: var(--fptm-bg, #fff);
            --qg-text: var(--fptm-text, #222);
            --qg-accent: var(--fptm-accent, #1b75bb);
            --qg-border: color-mix(in srgb, var(--qg-text) 14%, transparent);
            --qg-hover: color-mix(in srgb, var(--qg-text) 9%, transparent);
            width: 260px; margin-top: 6px !important; padding: 6px !important;
            border: 1px solid var(--qg-border) !important; border-radius: 14px !important;
            background: var(--qg-bg) !important; color: var(--qg-text) !important;
            box-shadow: 0 14px 34px rgba(0, 0, 0, .35) !important;
            animation: fptQgIn .16s cubic-bezier(.4, 0, .2, 1) both;
        }
        @keyframes fptQgIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .menu-item-fp-games > .dropdown-menu { animation: none; } }
        .menu-item-fp-games .info-text { padding: 6px 10px !important; font-size: 12px; line-height: 1.4; color: var(--qg-text); opacity: .62; white-space: normal; }
        .menu-item-fp-games .input-container { padding: 4px; }
        #quickGameUrlInput { width: 100%; height: 34px; padding: 0 10px; border: 1px solid var(--qg-border); background: var(--qg-hover); color: var(--qg-text); border-radius: 9px; box-sizing: border-box; outline: none; font-size: 13px; transition: border-color .15s, box-shadow .15s; }
        #quickGameUrlInput::placeholder { color: var(--qg-text); opacity: .45; }
        #quickGameUrlInput:focus { border-color: var(--qg-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--qg-accent) 22%, transparent); }
        .menu-item-fp-games .divider { height: 1px !important; margin: 6px 4px !important; background: var(--qg-border) !important; }
        #quickGamesListContainer .divider { display: none; }
        #quickGamesListContainer a { color: var(--qg-text) !important; background: transparent !important; font-size: 13px !important; padding: 8px 10px !important; border-radius: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; transition: background .12s; }
        #quickGamesListContainer a:hover, #quickGamesListContainer a:focus { background: var(--qg-hover) !important; color: var(--qg-accent) !important; }
    `);
    document.head.appendChild(style);

    navMenu.appendChild(gameDropdownItem);

    const listContainer = gameDropdownItem.querySelector('#quickGamesListContainer');
    const inputField = gameDropdownItem.querySelector('#quickGameUrlInput');

    const getSavedGames = async () => {
        const data = await chrome.storage.local.get('fpToolsQuickGames');
        return data.fpToolsQuickGames || [];
    };

    const saveGames = async (games) => {
        await chrome.storage.local.set({ fpToolsQuickGames: games });
    };

    const renderList = (games) => {
        listContainer.innerHTML = '';
        if (games.length === 0) {
            const emptyLi = createElement('li', { class: 'info-text' }, { padding: '8px 15px' }, 'Список пуст');
            listContainer.appendChild(emptyLi);
        } else {
            games.forEach((game, index) => {
                const url = FPTSafe.funpayUrl(game?.url);
                if (!url) return;
                const gameLi = createElement('li');
                const gameLink = createElement('a', { href: url, target: '_blank', title: game.title });
                gameLink.textContent = game.title;

                gameLink.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    if (confirm(`Удалить "${game.title}" из быстрых игр?`)) {
                        const currentGames = await getSavedGames();
                        const updatedGames = currentGames.filter(g => g.url !== game.url);
                        await saveGames(updatedGames);
                        renderList(updatedGames);
                    }
                });
                gameLi.appendChild(gameLink);
                listContainer.appendChild(gameLi);

                if (index < games.length - 1) {
                    const divider = createElement('li', { role: 'separator', class: 'divider' });
                    listContainer.appendChild(divider);
                }
            });
        }
    };

    const addGame = async (url) => {
        const urlRegex = /^https:\/\/funpay\.com\/(lots|chips)\/\d+\/?$/;
        if (!urlRegex.test(url)) {
            showNotification('Неверная ссылка. Пример: https://funpay.com/lots/123/', true);
            return;
        }

        inputField.disabled = true;
        inputField.value = 'Загрузка...';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Сетевая ошибка');
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            
            let title;
            const titleElement = doc.querySelector('.promo-game-item.active .game-title a, .nav-header .inside, h1.page-header .inside');
            
            if (titleElement) {
                title = titleElement.textContent.trim().replace('/ FunPay', '').trim();
            } else {
                const mainTitleElement = doc.querySelector('title');
                if (mainTitleElement) {
                    title = mainTitleElement.textContent.trim().replace('на FunPay', '').trim();
                } else {
                    throw new Error('Не удалось найти заголовок');
                }
            }
            
            const games = await getSavedGames();
            if (games.some(g => g.url === url)) {
                showNotification('Эта игра уже добавлена', true);
            } else {
                games.push({ title, url });
                await saveGames(games);
                renderList(games);
                showNotification(`Игра "${title}" добавлена!`);
            }
        } catch (error) {
            console.error('Ошибка при добавлении быстрой игры:', error);
            showNotification('Не удалось добавить игру. Проверьте ссылку и попробуйте снова.', true);
        } finally {
            inputField.disabled = false;
            inputField.value = '';
        }
    };

    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addGame(inputField.value.trim());
        }
    });

    inputField.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        addGame(pastedText.trim());
    });

    const initialGames = await getSavedGames();
    renderList(initialGames);
} 

function initializeMarkAllAsRead() {
    if (document.getElementById('fp-tools-read-all-btn')) return;
    const mount = () => {
        const header = document.querySelector('.chat-full-header');
        if (!header) return;
        if (document.getElementById('fp-tools-read-all-btn')) {
            observer.disconnect();
            return;
        }

        const actions = createElement('div', { class: 'fpt-chat-actions', role: 'group', 'aria-label': 'Действия со списком сообщений' });
        const readAllBtn = createElement('button', {
            id: 'fp-tools-read-all-btn',
            type: 'button',
            class: 'fp-tooltip-host fpt-chat-action',
            'aria-label': 'Прочитать все',
            'aria-busy': 'false',
            'data-state': 'idle',
            'data-fp-tooltip': 'Прочитать все'
        });
        readAllBtn.innerHTML = '<span class="material-icons" aria-hidden="true">done_all</span>';
        
        const filterMarkedBtn = createElement('button', {
            id: 'fp-tools-filter-marked-btn',
            type: 'button',
            class: 'fp-tooltip-host fpt-chat-action',
            'aria-label': 'Только помеченные',
            'aria-pressed': 'false',
            'data-fp-tooltip': 'Только помеченные'
        });
        filterMarkedBtn.innerHTML = '<span class="material-icons" aria-hidden="true">sell</span>';
        
        actions.append(readAllBtn, filterMarkedBtn);
        header.appendChild(actions);

        let stateTimer;
        const setReadState = (state, label) => {
            clearTimeout(stateTimer);
            readAllBtn.dataset.state = state;
            readAllBtn.disabled = state === 'loading';
            readAllBtn.setAttribute('aria-busy', String(state === 'loading'));
            readAllBtn.setAttribute('aria-label', label);
            readAllBtn.dataset.fpTooltip = label;
            readAllBtn.querySelector('.material-icons').textContent = {
                idle: 'done_all', loading: 'progress_activity', success: 'check', empty: 'done_all', error: 'error_outline'
            }[state];
            if (state !== 'idle' && state !== 'loading') {
                stateTimer = setTimeout(() => setReadState('idle', 'Прочитать все'), 2200);
            }
        };

        const syncUnreadCount = () => {
            const counter = header.querySelector('.badge');
            if (!counter) return;
            const count = document.querySelectorAll('.contact-item.unread').length;
            counter.textContent = String(count);
            counter.style.display = count ? '' : 'none';
        };

        readAllBtn.addEventListener('click', async () => {
            if (readAllBtn.disabled) return;
            const unreadItems = Array.from(document.querySelectorAll('.contact-item.unread'));
            if (unreadItems.length === 0) {
                setReadState('empty', 'Все сообщения уже прочитаны');
                showNotification('Нет непрочитанных сообщений.', false);
                return;
            }

            setReadState('loading', 'Отмечаем сообщения прочитанными…');
            unreadItems.forEach(item => item.classList.remove('unread'));
            syncUnreadCount();
            showNotification(`Начинаю отмечать ${unreadItems.length} диалогов как прочитанные...`, false);

            let processedCount = 0;
            let failedCount = 0;
            // Keep the existing pacing, but finish only after every request has settled.
            // A slow request must not overlap the next one or show a false success state.
            for (const item of unreadItems) {
                await new Promise(resolve => setTimeout(resolve, 800));
                try {
                    const nodeId = item.dataset.id;
                    if (!/^\d+$/.test(nodeId || '')) throw new Error('Нет идентификатора диалога');
                    const response = await fetch(`https://funpay.com/chat/?node=${nodeId}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    processedCount++;
                } catch (error) {
                    failedCount++;
                    item.classList.add('unread');
                    syncUnreadCount();
                }
            }
            if (failedCount) {
                setReadState('error', 'Не всё прочитано — повторить');
                showNotification(`Прочитано: ${processedCount}. Не удалось: ${failedCount}. Можно повторить.`, true);
            } else {
                setReadState('success', 'Все сообщения прочитаны');
                showNotification(`Завершено: ${processedCount} диалогов отмечены прочитанными.`, false);
            }
        });
        
        let isFilterActive = false;
        let filterChanged = false;

        const applyMarkedFilter = () => {
            filterMarkedBtn.setAttribute('aria-pressed', String(isFilterActive));
            filterMarkedBtn.dataset.fpTooltip = isFilterActive ? 'Показать все диалоги' : 'Только помеченные';
            const contactItems = document.querySelectorAll('.contact-list .contact-item');
            
            contactItems.forEach(item => {
                const hasMark = item.querySelector('.fp-tools-user-status[data-fp-tooltip]');
                if (isFilterActive) {
                    item.style.display = hasMark ? '' : 'none';
                } else {
                    item.style.display = '';
                }
            });
        };

        filterMarkedBtn.addEventListener('click', async () => {
            filterChanged = true;
            isFilterActive = !isFilterActive;
            applyMarkedFilter();
            if (!fptExtAlive()) return;
            await fptSafe(() => chrome.storage.local.set({ fpToolsIsMarkedFilterActive: isFilterActive }));
        });

        if (fptExtAlive()) {
            fptSafe(() => chrome.storage.local.get('fpToolsIsMarkedFilterActive'), {}).then(data => {
                if (!filterChanged && data?.fpToolsIsMarkedFilterActive) {
                    isFilterActive = true;
                    applyMarkedFilter();
                }
            });
        }
        
        const contactList = document.querySelector('.contact-list');
        if (contactList) {
            let filterScheduled = false;
            const filterObserver = new MutationObserver(() => {
                if (filterScheduled) return;
                filterScheduled = true;
                setTimeout(() => { filterScheduled = false; applyMarkedFilter(); }, 100);
            });
            filterObserver.observe(contactList, { childList: true, subtree: true });
        }

        // 3.0: stop the outer observer once our controls exist - it observed the whole body
        // subtree forever, which was a constant performance drain on the chat page.
        observer.disconnect();
    };

    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });
    mount();
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('autobump', 'configureSelectiveBumpBtn', () => chrome.runtime.sendMessage({ action: 'getUserCategories' }));
    window.fptPopupActions.register('autobump', 'autobump-select-all', p => window.fptPopupActions.toggleCategorySelection(p));
    window.fptPopupActions.register('autobump', 'autobump-category-save', p => {
        if (!Array.isArray(p.selectedCategoryIds)) throw new Error('selectedCategoryIds must be an array');
        return window.fptPopupActions.run('autobump', 'saveSettings', {
            settings: { fpToolsSelectedBumpCategories: p.selectedCategoryIds }
        });
    });
    window.fptPopupActions.register('autobump', 'autoBumpLogToggle', () => popupAutoBumpLog.slice());
    window.fptPopupActions.register('autobump', 'getBumpStatus', () => chrome.runtime.sendMessage({ action: 'getAutoBumpStatus' }));
    window.fptPopupActions.register('autobump', 'raiseNow', () => chrome.runtime.sendMessage({ action: 'fptRaiseAllNow' }));
    window.fptPopupActions.register('effects', 'resetCursorFxBtn', () => chrome.storage.local.set({ fpToolsCursorFx: {
        enabled: false, type: 'sparkle', color1: '#FF6B6B', color2: '#1b75bb', rgb: false, count: 50 } }));
    window.fptPopupActions.register('effects', 'uploadCursorImageBtn', p => window.fptPopupActions.run('effects', 'saveSettings', {
        settings: { fpToolsCustomCursor: { image: p.dataUrl } } }));
    window.fptPopupActions.register('effects', 'removeCursorImageBtn', () => window.fptPopupActions.run('effects', 'saveSettings', {
        settings: { fpToolsCustomCursor: { image: null } } }));
}
