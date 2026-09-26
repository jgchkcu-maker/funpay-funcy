function initializeBlacklist() {
    const page = document.querySelector('.fp-tools-page-content[data-page="blacklist"]');
    if (!page) return;
    if (page.dataset.initialized) {
        if (typeof page._fpBlRender === 'function') page._fpBlRender();
        return;
    }
    page.dataset.initialized = 'true';

    const listEl = document.getElementById('fp-bl-list');
    const usernameInput = document.getElementById('fp-bl-name-input');
    const noteInput = document.getElementById('fp-bl-note-input');
    const searchInput = document.getElementById('fp-bl-search-input');
    const countEl = document.getElementById('fp-bl-count');
    const addBtn = document.getElementById('fp-bl-add-btn');

    if (!addBtn) return;

    const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

    const matchesSearch = (entry, query) => {
        if (!query) return true;
        const haystack = `${entry?.username || ''} ${entry?.note || ''}`.toLocaleLowerCase();
        return haystack.includes(query);
    };

    async function render() {
        const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');
        if (!listEl) return;

        const query = (searchInput?.value || '').trim().toLocaleLowerCase();
        const visibleEntries = fpToolsBlacklist
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => matchesSearch(entry, query));

        if (countEl) countEl.textContent = String(fpToolsBlacklist.length);

        if (!fpToolsBlacklist.length) {
            listEl.innerHTML = `
                <div class="fpt-ui-state fp-bl-empty-state">
                    <svg class="fp-bl-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path d="M7.5 4.5h9A2.5 2.5 0 0 1 19 7v10a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17V7a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" stroke-width="1.7"/>
                        <path d="M8.5 9.25h7M8.5 12.25h5M9 16l6-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                    </svg>
                    <p class="fpt-ui-state-title">Чёрный список пуст</p>
                    <p class="fpt-ui-state-text">Добавьте покупателя выше, чтобы отключить для него выбранные автоматизации и уведомления.</p>
                </div>
            `;
            return;
        }

        if (!visibleEntries.length) {
            listEl.innerHTML = `
                <div class="fpt-ui-state fp-bl-empty-state fp-bl-search-empty">
                    <svg class="fp-bl-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="1.7"/>
                        <path d="m15 15 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                    </svg>
                    <p class="fpt-ui-state-title">Ничего не найдено</p>
                    <p class="fpt-ui-state-text">Измените запрос или очистите поиск по чёрному списку.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = visibleEntries.map(({ entry, index }) => {
            const username = escapeHtml(entry?.username || '');
            const note = escapeHtml(entry?.note || '');
            return `
                <article class="fp-bl-row" data-idx="${index}">
                    <div class="fp-bl-row-main">
                        <div class="fp-bl-avatar" aria-hidden="true">${username.slice(0, 1).toUpperCase() || '?'}</div>
                        <div class="fp-bl-identity">
                            <div class="fp-bl-username">${username}</div>
                            ${note ? `<div class="fpt-ui-meta fp-bl-note">${note}</div>` : '<div class="fpt-ui-meta fp-bl-note fp-bl-note--empty">Без причины</div>'}
                        </div>
                    </div>
                    <div class="fp-bl-rules" aria-label="Что блокировать">
                        <label class="fp-bl-rule" title="Блокировать автовыдачу">
                            <input type="checkbox" class="fp-bl-delivery" data-idx="${index}" ${entry.blockDelivery ? 'checked' : ''}>
                            <span>Выдача</span>
                        </label>
                        <label class="fp-bl-rule" title="Блокировать автоответы">
                            <input type="checkbox" class="fp-bl-response" data-idx="${index}" ${entry.blockResponse ? 'checked' : ''}>
                            <span>Ответы</span>
                        </label>
                        <label class="fp-bl-rule" title="Блокировать уведомления">
                            <input type="checkbox" class="fp-bl-notif" data-idx="${index}" ${entry.blockNotification ? 'checked' : ''}>
                            <span>Уведомления</span>
                        </label>
                    </div>
                    <button type="button" class="fpt-ui-button fpt-ui-button--danger fpt-ui-icon-button fp-bl-remove" data-idx="${index}" aria-label="Удалить ${username} из чёрного списка" title="Удалить из чёрного списка">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M8 7h8m-7 0 .5 11h5L15 7m-5-2h4l.5 2h-5L10 5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </article>
            `;
        }).join('');

        listEl.querySelectorAll('.fp-bl-delivery, .fp-bl-response, .fp-bl-notif').forEach(cb => {
            cb.addEventListener('change', async () => {
                const { fpToolsBlacklist: bl = [] } = await chrome.storage.local.get('fpToolsBlacklist');
                const idx = parseInt(cb.dataset.idx, 10);
                if (!bl[idx]) return;
                if (cb.classList.contains('fp-bl-delivery')) bl[idx].blockDelivery = cb.checked;
                if (cb.classList.contains('fp-bl-response')) bl[idx].blockResponse = cb.checked;
                if (cb.classList.contains('fp-bl-notif')) bl[idx].blockNotification = cb.checked;
                await chrome.storage.local.set({ fpToolsBlacklist: bl });
            });
        });

        listEl.querySelectorAll('.fp-bl-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const { fpToolsBlacklist: bl = [] } = await chrome.storage.local.get('fpToolsBlacklist');
                const idx = parseInt(btn.dataset.idx, 10);
                if (!bl[idx]) return;
                bl.splice(idx, 1);
                await chrome.storage.local.set({ fpToolsBlacklist: bl });
                await render();
                showNotification('Удалено из чёрного списка');
            });
        });
    }

    addBtn.addEventListener('click', async () => {
        const username = usernameInput?.value.trim();
        const note = noteInput?.value.trim() || '';

        if (!username) {
            showNotification('Введите никнейм', true);
            usernameInput?.focus();
            return;
        }

        const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');

        if (fpToolsBlacklist.some(entry => String(entry.username || '').toLowerCase() === username.toLowerCase())) {
            showNotification('Уже в списке', true);
            return;
        }

        fpToolsBlacklist.push({
            username,
            note,
            blockDelivery: true,
            blockResponse: true,
            blockNotification: false,
            addedAt: Date.now()
        });

        await chrome.storage.local.set({ fpToolsBlacklist });
        if (usernameInput) usernameInput.value = '';
        if (noteInput) noteInput.value = '';
        if (searchInput) searchInput.value = '';
        await render();
        usernameInput?.focus();
        showNotification(`${username} добавлен в чёрный список`);
    });

    usernameInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') addBtn.click();
    });

    noteInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') addBtn.click();
    });

    searchInput?.addEventListener('input', render);

    render();
    page._fpBlRender = render;

    document.addEventListener('fpToolsBlacklistUpdated', () => {
        if (page.classList.contains('active')) render();
    });
}

async function addToBlacklistFromChat(username) {
    if (!username) return;
    const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');
    if (fpToolsBlacklist.some(e => e.username.toLowerCase() === username.toLowerCase())) {
        showNotification(`${username} уже в чёрном списке`, true);
        return;
    }
    fpToolsBlacklist.push({ username, note: 'Добавлен из чата', blockDelivery: true, blockResponse: true, blockNotification: false, addedAt: Date.now() });
    await chrome.storage.local.set({ fpToolsBlacklist });
    showNotification(`${username} добавлен в чёрный список`);
    document.dispatchEvent(new Event('fpToolsBlacklistUpdated'));
}
async function isInBlacklist(username) {
    if (!username) return false;
    const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');
    return fpToolsBlacklist.some(e => e.username.toLowerCase() === username.toLowerCase());
}

async function removeFromBlacklistByName(username) {
    if (!username) return;
    const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');
    const next = fpToolsBlacklist.filter(e => e.username.toLowerCase() !== username.toLowerCase());
    await chrome.storage.local.set({ fpToolsBlacklist: next });
    showNotification(`${username} удалён из чёрного списка`);
    document.dispatchEvent(new Event('fpToolsBlacklistUpdated'));
}
