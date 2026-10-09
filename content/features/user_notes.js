// content/features/user_notes.js
// Метки пользователей + закрепление чатов.
// Переработано: редактирование меток вынесено в отдельное окно,
// добавлено наведённое меню (троеточие) и закрепление чатов наверх списка.

let userStatuses = {};               // { userId: { name, color } }
let pinnedChats = {};                // { userId: timestampWhenPinned }
let fpToolsCustomLabels = [
    { id: 'default-1', name: 'Мошенник',  color: '#f44336' },
    { id: 'default-2', name: 'Постоянный', color: '#4caf50' }
];

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

function getContrastColor(hexColor) {
    if (!hexColor) return '#FFFFFF';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

// Фон/текст окон - как у самой страницы (FunPay, кастомная или светлая тема),
// но всегда плотный, чтобы список чатов не просвечивал сквозь меню.
function fptApplyThemeSurface(el) {
    if (!el) return;
    const { bg, color } = fptSolidSurface(['.chat-contacts', '.chat', '.content-with-cd-wide', document.body]);
    el.style.backgroundColor = bg;
    el.style.color = color;
}

async function saveUserStatuses() {
    await chrome.storage.local.set({ fpToolsUserStatuses: userStatuses });
}
async function savePinnedChats() {
    await chrome.storage.local.set({ fpToolsPinnedChats: pinnedChats });
}
async function saveLabels() {
    await chrome.storage.local.set({ fpToolsCustomLabels });
}

/* ------------------------------------------------------------------ */
/* Применение / снятие метки                                           */
/* ------------------------------------------------------------------ */

function paintStatusElement(statusElement, statusObject) {
    if (statusObject && statusObject.color) {
        const contrastColor = getContrastColor(statusObject.color);
        statusElement.style.backgroundColor = statusObject.color;
        statusElement.style.setProperty('--tooltip-bg-color', statusObject.color);
        statusElement.style.setProperty('--tooltip-text-color', contrastColor);
        statusElement.setAttribute('data-fp-tooltip', statusObject.name);
        statusElement.classList.add('fp-tooltip-host');
    } else {
        statusElement.style.backgroundColor = 'transparent';
        statusElement.removeAttribute('data-fp-tooltip');
        statusElement.classList.remove('fp-tooltip-host');
        statusElement.style.removeProperty('--tooltip-bg-color');
        statusElement.style.removeProperty('--tooltip-text-color');
    }
}

function setUserStatus(userId, statusObject) {
    if (!userId) return;
    document.querySelectorAll(`.contact-item[data-id="${userId}"]`).forEach(contactItem => {
        let statusElement = contactItem.querySelector('.fp-tools-user-status');
        if (!statusElement) {
            statusElement = createElement('span', { class: 'fp-tools-user-status' });
            const userNameElement = contactItem.querySelector('.media-user-name');
            if (userNameElement) userNameElement.prepend(statusElement);
        }
        paintStatusElement(statusElement, statusObject);
    });

    if (statusObject && statusObject.color) userStatuses[userId] = statusObject;
    else delete userStatuses[userId];

    saveUserStatuses();
}

function applyAllUserStatuses() {
    document.querySelectorAll('a.contact-item').forEach(item => {
        const userId = item.dataset.id;
        const status = userStatuses[userId];
        if (!userId || !status) return;
        let statusElement = item.querySelector('.fp-tools-user-status');
        if (!statusElement) {
            statusElement = createElement('span', { class: 'fp-tools-user-status' });
            const userNameElement = item.querySelector('.media-user-name');
            if (userNameElement) userNameElement.prepend(statusElement);
        }
        paintStatusElement(statusElement, status);
    });
}

/* ------------------------------------------------------------------ */
/* Закрепление чатов                                                   */
/* ------------------------------------------------------------------ */

function isPinned(userId) {
    return Object.prototype.hasOwnProperty.call(pinnedChats, userId);
}

async function togglePin(userId) {
    if (!userId) return;
    if (isPinned(userId)) delete pinnedChats[userId];
    else pinnedChats[userId] = Date.now();
    await savePinnedChats();
    applyPinnedChats();
}

// Помечает закреплённые чаты иконкой и поднимает их наверх списка.
function applyPinnedChats() {
    const list = document.querySelector('.contact-list');
    if (!list) return;

    const items = Array.from(list.querySelectorAll('a.contact-item'));
    items.forEach(item => {
        const userId = item.dataset.id;
        const pinned = isPinned(userId);
        item.classList.toggle('fp-tools-pinned', pinned);

        let pinIcon = item.querySelector('.fp-tools-pin-icon');
        if (pinned) {
            if (!pinIcon) {
                pinIcon = createElement('span', {
                    class: 'fp-tools-pin-icon material-icons',
                    title: 'Закреплено'
                });
                pinIcon.textContent = 'push_pin';
                item.appendChild(pinIcon);
            }
        } else if (pinIcon) {
            pinIcon.remove();
        }
    });

    // Закреплённые - наверх, по времени закрепа (раньше закреплённые выше).
    const pinnedItems = items
        .filter(i => isPinned(i.dataset.id))
        .sort((a, b) => (pinnedChats[a.dataset.id] || 0) - (pinnedChats[b.dataset.id] || 0));

    // Поднимаем закреплённые наверх, сохраняя их относительный порядок.
    pinnedItems.reverse().forEach(item => {
        if (list.firstElementChild !== item) list.prepend(item);
    });
}

/* ------------------------------------------------------------------ */
/* Наведённое меню (троеточие) на каждом чате                          */
/* ------------------------------------------------------------------ */

let activePopover = null;

function closePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
    }
    document.removeEventListener('click', onDocClickClosePopover, true);
    window.removeEventListener('scroll', closePopover, true);
}

function onDocClickClosePopover(e) {
    if (activePopover && !activePopover.contains(e.target) &&
        !e.target.classList.contains('fp-tools-chat-dots')) {
        closePopover();
    }
}

function openChatPopover(contactItem, anchorBtn) {
    closePopover();
    const userId = contactItem.dataset.id;
    if (!userId) return;

    const pop = createElement('div', { class: 'fp-tools-chat-popover' });

    // --- Раздел: метки ---
    const labelsHeader = createElement('div', { class: 'fp-tools-pop-header' });
    labelsHeader.textContent = 'Метка';
    pop.appendChild(labelsHeader);

    fpToolsCustomLabels.forEach(label => {
        const row = createElement('div', { class: 'fp-tools-pop-item' });
        const dot = createElement('span', { class: 'fp-tools-pop-dot' });
        dot.style.backgroundColor = label.color;
        const txt = createElement('span', { class: 'fp-tools-pop-text' });
        txt.textContent = label.name;
        row.appendChild(dot);
        row.appendChild(txt);
        const cur = userStatuses[userId];
        if (cur && cur.name === label.name && cur.color === label.color) {
            const check = createElement('span', { class: 'fp-tools-pop-check material-icons' });
            check.textContent = 'check';
            row.appendChild(check);
        }
        row.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setUserStatus(userId, { name: label.name, color: label.color });
            closePopover();
        });
        pop.appendChild(row);
    });

    if (userStatuses[userId]) {
        const removeRow = createElement('div', { class: 'fp-tools-pop-item fp-tools-pop-muted' });
        const ic = createElement('span', { class: 'fp-tools-pop-icon material-icons' });
        ic.textContent = 'label_off';
        const t = createElement('span', { class: 'fp-tools-pop-text' });
        t.textContent = 'Убрать метку';
        removeRow.appendChild(ic);
        removeRow.appendChild(t);
        removeRow.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            setUserStatus(userId, null);
            closePopover();
        });
        pop.appendChild(removeRow);
    }

    // Управление метками
    const manageRow = createElement('div', { class: 'fp-tools-pop-item fp-tools-pop-muted' });
    const mIc = createElement('span', { class: 'fp-tools-pop-icon material-icons' });
    mIc.textContent = 'settings';
    const mT = createElement('span', { class: 'fp-tools-pop-text' });
    mT.textContent = 'Управление метками';
    manageRow.appendChild(mIc);
    manageRow.appendChild(mT);
    manageRow.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        closePopover();
        openLabelManager();
    });
    pop.appendChild(manageRow);

    pop.appendChild(createElement('div', { class: 'fp-tools-pop-divider' }));

    // --- Раздел: закрепление ---
    const pinRow = createElement('div', { class: 'fp-tools-pop-item' });
    const pIc = createElement('span', { class: 'fp-tools-pop-icon material-icons' });
    pIc.textContent = 'push_pin';
    const pT = createElement('span', { class: 'fp-tools-pop-text' });
    pT.textContent = isPinned(userId) ? 'Открепить чат' : 'Закрепить чат';
    pinRow.appendChild(pIc);
    pinRow.appendChild(pT);
    pinRow.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        togglePin(userId);
        closePopover();
    });
    pop.appendChild(pinRow);

    document.body.appendChild(pop);
    fptApplyThemeSurface(pop);
    activePopover = pop;

    // Позиционирование возле кнопки
    const rect = anchorBtn.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.right - popRect.width;
    if (left < 8) left = 8;
    if (top + popRect.height > window.innerHeight - 8) {
        top = rect.top - popRect.height - 4;
    }
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;

    setTimeout(() => {
        document.addEventListener('click', onDocClickClosePopover, true);
        window.addEventListener('scroll', closePopover, true);
    }, 0);
}

// Вешает кнопку-троеточие на контакт.
function ensureDotsButton(contactItem) {
    if (contactItem.querySelector('.fp-tools-chat-dots')) return;
    const btn = createElement('button', {
        class: 'fp-tools-chat-dots material-icons',
        type: 'button',
        title: 'Действия'
    });
    btn.textContent = 'more_vert';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activePopover) { closePopover(); return; }
        openChatPopover(contactItem, btn);
    });
    contactItem.appendChild(btn);
}

function applyDotsButtons() {
    document.querySelectorAll('a.contact-item').forEach(ensureDotsButton);
}

/* ------------------------------------------------------------------ */
/* Отдельное окно управления метками                                   */
/* ------------------------------------------------------------------ */

function openLabelManager() {
    document.getElementById('fp-tools-label-manager')?.remove();

    const win = fptWindow.create({
        id: 'fp-tools-label-manager',
        title: 'Управление метками',
        subtitle: 'Чтобы повесить метку на чат, наведите на него в списке и нажмите ⋮.',
        icon: 'label',
        size: 'sm',
        removeOnClose: true
    });
    const listWrap = createElement('div', { class: 'fpt-win-list fp-tools-label-list' });
    win.body.appendChild(listWrap);

    const addBtn = fptWindow.button('Добавить метку', { iconName: 'add', size: 'sm' });
    addBtn.classList.add('fp-tools-label-add');
    win.foot.appendChild(addBtn);
    const doneBtn = fptWindow.button('Готово', { kind: 'primary', size: 'sm' });
    doneBtn.addEventListener('click', () => win.close());
    const actions = createElement('div', { class: 'fpt-win-actions' });
    actions.appendChild(doneBtn);
    win.foot.appendChild(actions);

    const renderRows = () => {
        listWrap.innerHTML = '';
        if (!fpToolsCustomLabels.length) {
            listWrap.innerHTML = '<div class="fpt-win-empty fp-tools-label-empty"><span class="material-symbols-rounded" aria-hidden="true">label_off</span>Меток пока нет. Добавьте первую.</div>';
        }
        fpToolsCustomLabels.forEach(label => {
            const row = createElement('div', { class: 'fp-tools-label-row' });

            const color = createElement('input', {
                type: 'color', value: label.color, class: 'fpt-win-color fp-tools-label-color', 'aria-label': 'Цвет метки'
            });
            color.addEventListener('input', () => {
                label.color = color.value;
                saveLabels();
                applyAllUserStatuses();
            });

            const name = createElement('input', {
                type: 'text', value: label.name, class: 'fpt-win-input fp-tools-label-name',
                placeholder: 'Название метки', 'aria-label': 'Название метки'
            });
            const commitName = () => {
                const newName = name.value.trim() || 'Без названия';
                name.value = newName;
                label.name = newName;
                saveLabels();
                applyAllUserStatuses();
            };
            name.addEventListener('blur', commitName);
            name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

            const del = fptWindow.button('', { kind: 'quiet', iconName: 'delete', title: 'Удалить' });
            del.classList.add('fpt-win-btn--icon', 'fp-tools-label-del');
            del.setAttribute('aria-label', 'Удалить метку');
            del.addEventListener('click', () => {
                fpToolsCustomLabels = fpToolsCustomLabels.filter(l => l.id !== label.id);
                saveLabels();
                renderRows();
            });

            row.appendChild(color);
            row.appendChild(name);
            row.appendChild(del);
            listWrap.appendChild(row);
        });
    };

    addBtn.addEventListener('click', () => {
        fpToolsCustomLabels.push({ id: Date.now().toString(), name: 'Новая метка', color: '#ff9800' });
        saveLabels();
        renderRows();
        const inputs = listWrap.querySelectorAll('.fp-tools-label-name');
        const last = inputs[inputs.length - 1];
        if (last) { last.focus(); last.select(); }
    });

    renderRows();
    document.body.appendChild(win.scrim);
    fptWindow.open(win.scrim);
}

/* ------------------------------------------------------------------ */
/* Пункты в выпадающем меню заголовка чата                             */
/* (компактные: один клик = действие, без встроенного редактора)       */
/* ------------------------------------------------------------------ */

function buildChatHeaderMenu() {
    const refreshHeaderMenu = () => {
        const chatMenu = document.querySelector('.chat-header .dropdown-menu');
        if (chatMenu && !chatMenu.dataset.fpToolsStatusMenu) {
            chatMenu.dataset.fpToolsStatusMenu = 'true';
            renderHeaderMenu(chatMenu);
        }
    };
    const observer = new MutationObserver(window.fptCoalesce?.(refreshHeaderMenu) || refreshHeaderMenu);
    observer.observe(document.body, { childList: true, subtree: true });
}

function renderHeaderMenu(chatMenu) {
    chatMenu.querySelectorAll('.fp-tools-status-item, .divider.fp-tools-divider').forEach(el => el.remove());

    const getUserId = () => document.querySelector('.contact-item.active')?.dataset.id;

    chatMenu.insertAdjacentHTML('beforeend', '<li class="divider fp-tools-divider"></li>');

    fpToolsCustomLabels.forEach(label => {
        const li = createElement('li', { class: 'fp-tools-status-item' });
        const a = createElement('a', { href: '#' });
        const dot = createElement('span', { class: 'fp-tools-status-circle' });
        dot.style.backgroundColor = label.color;
        const span = createElement('span', { class: 'fp-tools-status-name' });
        span.textContent = label.name;
        a.appendChild(dot);
        a.appendChild(span);
        a.addEventListener('click', (e) => {
            e.preventDefault();
            setUserStatus(getUserId(), { name: label.name, color: label.color });
        });
        li.appendChild(a);
        chatMenu.appendChild(li);
    });

    const removeLi = createElement('li', { class: 'fp-tools-status-item' });
    const removeA = createElement('a', { href: '#' });
    removeA.textContent = 'Убрать метку';
    removeA.addEventListener('click', (e) => {
        e.preventDefault();
        setUserStatus(getUserId(), null);
        removeLi.style.display = 'none';
    });
    removeLi.appendChild(removeA);
    chatMenu.appendChild(removeLi);

    const pinLi = createElement('li', { class: 'fp-tools-status-item' });
    const pinA = createElement('a', { href: '#' });
    const syncPinText = () => { pinA.textContent = isPinned(getUserId()) ? '📌 Открепить чат' : '📌 Закрепить чат'; };
    syncPinText();
    pinA.addEventListener('click', (e) => {
        e.preventDefault();
        togglePin(getUserId());
        syncPinText();
    });
    pinLi.appendChild(pinA);
    chatMenu.appendChild(pinLi);

    // Меню в шапке кэшируется, а активный чат меняется - поэтому
    // пересинхронизируем «Убрать метку» и текст закрепа при каждом открытии.
    const syncDynamicItems = () => {
        const uid = getUserId();
        removeLi.style.display = (uid && userStatuses[uid]) ? '' : 'none';
        syncPinText();
    };
    syncDynamicItems();

    const toggleBtn = chatMenu.closest('.dropdown')?.querySelector('[data-toggle="dropdown"]');
    if (toggleBtn && !toggleBtn.dataset.fptSyncBound) {
        toggleBtn.dataset.fptSyncBound = '1';
        toggleBtn.addEventListener('click', () => setTimeout(syncDynamicItems, 0));
    }

    const manageLi = createElement('li', { class: 'fp-tools-status-item' });
    const manageA = createElement('a', { href: '#' });
    manageA.textContent = '⚙️ Управление метками';
    manageA.addEventListener('click', (e) => {
        e.preventDefault();
        openLabelManager();
    });
    manageLi.appendChild(manageA);
    chatMenu.appendChild(manageLi);
}

/* ------------------------------------------------------------------ */
/* Инициализация                                                       */
/* ------------------------------------------------------------------ */

async function initializeUserNotes() {
    const data = await chrome.storage.local.get([
        'fpToolsUserStatuses', 'fpToolsPinnedChats', 'fpToolsCustomLabels'
    ]);
    userStatuses = data.fpToolsUserStatuses || {};
    pinnedChats  = data.fpToolsPinnedChats || {};
    if (Array.isArray(data.fpToolsCustomLabels)) fpToolsCustomLabels = data.fpToolsCustomLabels;

    applyAllUserStatuses();
    applyDotsButtons();
    applyPinnedChats();
    buildChatHeaderMenu();

    // Следим за обновлением списка контактов (поиск, новые сообщения, подгрузка).
    const contactsNode = document.querySelector('.chat-contacts') || document.body;
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            applyAllUserStatuses();
            applyDotsButtons();
            applyPinnedChats();
        });
    });
    observer.observe(contactsNode, { childList: true, subtree: true });
}
