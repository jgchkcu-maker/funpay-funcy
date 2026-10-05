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
        if (popup.contains(event.target) || event.target?.closest?.('#fpToolsButton')) return;
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
        .dropdown-menu .info-text { padding: 8px 15px; font-size: 12px; color: #999; white-space: normal; }
        .dropdown-menu .input-container { padding: 5px 15px; }
        #quickGameUrlInput { width: 100%; padding: 5px 8px; border: 1px solid #555; background-color: #333; color: #fff; border-radius: 4px; box-sizing: border-box; }
        #quickGamesListContainer a { color: #c3c3c3 !important; font-size: 13px !important; padding: 6px 15px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        #quickGamesListContainer a:hover { color: #fff !important; }
        #quickGamesListContainer .divider { height: 1px; margin: 4px 0 !important; overflow: hidden; background-color: #444 !important; }
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
                const gameLi = createElement('li');
                const gameLink = createElement('a', { href: game.url, target: '_blank', title: game.title });
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
    const observer = new MutationObserver(async (mutationsList, obs) => {
        const header = document.querySelector('.chat-full-header');
        if (!header || document.getElementById('fp-tools-read-all-btn')) {
            return;
        }

        const readAllBtn = createElement('button', {
            id: 'fp-tools-read-all-btn',
            class: 'fp-tooltip-host',
            'data-fp-tooltip': 'Прочитать все'
        });
        readAllBtn.innerHTML = '<span class="material-icons">done_all</span>';
        
        const filterMarkedBtn = createElement('label', {
            id: 'fp-tools-filter-marked-btn',
            class: 'fp-tooltip-host fp-tools-chat-toggle',
            'data-fp-tooltip': 'Только помеченные'
        });
        filterMarkedBtn.innerHTML = `
            <input type="checkbox" id="filter-marked-checkbox">
            <span class="fp-tools-chat-toggle-slider">
                 <span class="material-icons">label</span>
            </span>
        `;
        
        header.appendChild(readAllBtn);
        header.appendChild(filterMarkedBtn);

        readAllBtn.addEventListener('click', async () => {
            const unreadItems = Array.from(document.querySelectorAll('.contact-item.unread'));
            if (unreadItems.length === 0) {
                showNotification('Нет непрочитанных сообщений.', false);
                return;
            }

            // --- Start: Immediate visual update ---
            readAllBtn.classList.add('loading');
            readAllBtn.disabled = true;

            const nodeIdsToRead = [];
            unreadItems.forEach(item => {
                const nodeId = item.dataset.id;
                if (nodeId) {
                    nodeIdsToRead.push(nodeId);
                }
                item.classList.remove('unread'); // Visually mark as read immediately
            });

            const counter = document.querySelector('.chat-full-header .badge');
            if (counter) {
                counter.textContent = '0';
                counter.style.display = 'none';
            }
            
            showNotification(`Начинаю отмечать ${unreadItems.length} диалогов как прочитанные...`, false);
            // --- End: Immediate visual update ---

            let processedCount = 0;
            const intervalId = setInterval(async () => {
                // If the list of IDs is empty, we're done.
                if (nodeIdsToRead.length === 0) {
                    clearInterval(intervalId);
                    readAllBtn.classList.remove('loading');
                    readAllBtn.disabled = false;
                    showNotification(`Завершено: ${processedCount} диалогов отмечены прочитанными.`, false);
                    return;
                }

                const nodeId = nodeIdsToRead.shift();
                const chatUrl = `https://funpay.com/chat/?node=${nodeId}`;

                try {
                    // Just making the GET request is enough to mark it as read on the server
                    await fetch(chatUrl);
                    processedCount++;
                } catch (error) {
                    console.error(`FunPay Funcy: Ошибка при "посещении" чата ${nodeId} для прочтения`, error);
                    // We don't re-add the nodeId to the list to avoid getting stuck on a failing one.
                }

            }, 800); // 0.8 second interval
        });
        
        const filterCheckbox = document.getElementById('filter-marked-checkbox');

        const applyMarkedFilter = () => {
            const isFilterActive = filterCheckbox.checked;
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

        filterCheckbox.addEventListener('change', async () => {
            if (!fptExtAlive()) return;
            await fptSafe(() => chrome.storage.local.set({ fpToolsIsMarkedFilterActive: filterCheckbox.checked }));
            applyMarkedFilter();
        });

        if (fptExtAlive()) {
            fptSafe(() => chrome.storage.local.get('fpToolsIsMarkedFilterActive'), {}).then(data => {
                if (data && data.fpToolsIsMarkedFilterActive) {
                    filterCheckbox.checked = true;
                    applyMarkedFilter();
                }
            });
        }
        
        const contactList = document.querySelector('.contact-list');
        if (contactList) {
            const filterObserver = new MutationObserver(() => {
                setTimeout(applyMarkedFilter, 100); 
            });
            filterObserver.observe(contactList, { childList: true, subtree: true });
        }

        // 3.0: stop the outer observer once our controls exist - it observed the whole body
        // subtree forever, which was a constant performance drain on the chat page.
        obs.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
