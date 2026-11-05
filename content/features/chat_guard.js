(function (root) {
    'use strict';
    let settings = {}, scope = {}, accountId = null, owner = null, loadError = '', revision = 0;
    let button, filterActive = false, busy = false, lastAttempt = 0, toast, toastAccount, toastEntries = [];
    const el = (tag, className, text) => {
        const node = document.createElement(tag); node.className = className || '';
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const icon = name => { const node = el('span', 'material-icons', name); node.setAttribute('aria-hidden', 'true'); return node; };
    const pageAccount = () => root.fptPageUserId?.() || null;
    const available = () => Boolean(accountId && accountId === owner && accountId === pageAccount() && settings.chatGuardEnabled);
    const visible = () => document.visibilityState === 'visible' && document.hasFocus();
    const waiting = () => Object.values(scope.waiting || {}).filter(entry => /^\d+$/.test(entry.chatId) && !(entry.snoozedUntil > Date.now())).sort((a, b) => a.since - b.since);
    const minutes = entry => Math.max(0, Math.floor((Date.now() - entry.since) / 60000));
    const duration = entry => minutes(entry) < 1 ? '< 1 мин' : minutes(entry) < 60 ? `${minutes(entry)} мин` : `${Math.floor(minutes(entry) / 60)} ч${minutes(entry) % 60 ? ` ${minutes(entry) % 60} мин` : ''}`;
    const overdue = entry => minutes(entry) >= (settings.chatGuardThresholdMinutes || 30);
    const chatUrl = id => `https://funpay.com/chat/?node=${encodeURIComponent(id)}`;
    function openChat(id) {
        const contact = document.querySelector(`.contact-list .contact-item[data-id="${id}"]`);
        if (contact) contact.click(); else location.assign(chatUrl(id));
    }
    async function command(payload, expectedAccountId = accountId) {
        const response = await chrome.runtime.sendMessage({ action: 'fptChatGuard', expectedAccountId, ...payload });
        if (!response?.ok) throw new Error(response?.error || 'Не удалось обновить очередь.');
        return response;
    }
    function open() {
        if (!available()) return;
        if (!location.pathname.includes('/chat/')) { location.assign('https://funpay.com/chat/#fpt-waiting'); return; }
        const marked = document.querySelector('#fp-tools-filter-marked-btn[aria-pressed="true"]');
        marked?.click();
        filterActive = true;
        render();
    }
    function mount() {
        const actions = document.querySelector('.chat-full-header .fpt-chat-actions');
        if (!actions || button?.isConnected || !available()) return;
        button = el('button', 'fp-tooltip-host fpt-chat-action'); button.id = 'fp-tools-chat-guard-btn'; button.type = 'button';
        button.setAttribute('aria-label', 'Ждут ответа'); button.setAttribute('aria-pressed', String(filterActive));
        button.dataset.fpTooltip = 'Ждут ответа'; button.append(icon('schedule'));
        button.addEventListener('click', () => {
            if (!filterActive) document.querySelector('#fp-tools-filter-marked-btn[aria-pressed="true"]')?.click();
            filterActive = !filterActive;
            render();
        });
        actions.append(button);

    }
    function render() {
        mount();
        if (!available()) {
            filterActive = false; button?.remove();
            document.querySelectorAll('.contact-list .contact-item').forEach(item => { delete item.dataset.fptWaitingHidden; item.style.display = item.dataset.fptMarkedHidden === 'true' ? 'none' : ''; });
            document.querySelector('#fpt-chat-guard-empty')?.remove();
            document.querySelector('#fpt-chat-guard-dismiss')?.parentElement?.remove();
            document.querySelectorAll('.fpt-cg-contact-time').forEach(node => node.remove());
            toast?.close(); toast = null; return;
        }
        if (toast && (toastAccount !== accountId || !toastEntries.some(item => scope.waiting?.[item.chatId]?.firstMessageId === item.firstMessageId))) { toast.close(); toast = null; }
        const rows = waiting();
        if (button?.isConnected) {
            button.dataset.overdue = String(rows.some(overdue));
            button.setAttribute('aria-label', rows.length ? `Ждут ответа: ${rows.length}` : 'Ждут ответа');
            button.setAttribute('aria-pressed', String(filterActive));
            const error = loadError || scope.error || Object.values(scope.chats || {}).find(chat => chat.error)?.error;
            button.dataset.fpTooltip = error ? 'Не удалось обновить очередь' : filterActive ? 'Показать все диалоги' : 'Только ждут ответа';
        }
        const byId = new Map(rows.map(entry => [entry.chatId, entry]));
        document.querySelectorAll('.contact-list .contact-item[data-id]').forEach(contact => {
            const entry = byId.get(contact.dataset.id);
            contact.dataset.fptWaitingHidden = String(filterActive && !entry);
            contact.style.display = contact.dataset.fptMarkedHidden === 'true' || contact.dataset.fptWaitingHidden === 'true' ? 'none' : '';
            let marker = contact.querySelector('.fpt-cg-contact-time');
            if (!entry) { marker?.remove(); return; }
            if (!marker) marker = el('span', 'fpt-cg-contact-time');
            // The native preview is replaced on every incoming message and
            // clips long text. Keep the wait outside that disposable content.
            if (marker.parentElement !== contact) contact.append(marker);
            const text = duration(entry); if (marker.textContent !== text) marker.textContent = text;
            marker.dataset.overdue = String(overdue(entry)); marker.title = 'Ожидает вашего ответа · время с обнаружения сообщения';
        });
        const list = document.querySelector('.contact-list');
        let empty = document.querySelector('#fpt-chat-guard-empty');
        if (filterActive && list && ![...list.querySelectorAll('.contact-item')].some(item => item.style.display !== 'none')) {
            if (!empty) { empty = el('div', 'fpt-cg-filter-empty'); empty.id = 'fpt-chat-guard-empty'; list.after(empty); }
            const missing = rows.length > 0;
            empty.textContent = missing ? 'Ожидающие диалоги не найдены в текущем списке' : 'Нет диалогов, ожидающих ответа';
        } else empty?.remove();
        const menu = document.querySelector('.chat-header .dropdown-menu');
        const activeId = document.querySelector('.contact-item.active[data-id]')?.dataset.id;
        const entry = byId.get(activeId);
        let action = document.querySelector('#fpt-chat-guard-dismiss');
        if (menu && entry) {
            if (!action || !action.isConnected || action.parentElement?.parentElement !== menu) {
                action?.parentElement?.remove();
                const li = el('li'); action = el('a', '', 'Ответ не нужен'); action.id = 'fpt-chat-guard-dismiss'; action.href = '#'; li.append(action); menu.append(li);
                action.addEventListener('click', async event => {
                    event.preventDefault();
                    const id = document.querySelector('.contact-item.active[data-id]')?.dataset.id;
                    const current = waiting().find(item => item.chatId === id);
                    if (!current) return;
                    const expected = accountId;
                    try {
                        const result = await command({ operation: 'dismiss', chatId: id, lastBuyerMessageId: current.lastBuyerMessageId }, expected);
                        await load();
                        if (accountId !== expected) return;
                        root.showNotification('Диалог убран из очереди', false, { duration: 6000, action: 'Отменить', onAction: async () => {
                            try { await command({ operation: 'undoDismiss', token: result.undoToken }, expected); await load(); }
                            catch (error) { root.showNotification(error.message, true); }
                        } });
                    } catch (error) { root.showNotification(error.message, true); }
                });
            }
        } else action?.parentElement?.remove();
    }
    async function load() {
        const version = ++revision;
        try {
            const value = await chrome.storage.local.get(['fpToolsAutoReplies', 'fpToolsProfileOwner']);
            if (version !== revision) return;
            accountId = pageAccount(); owner = value.fpToolsProfileOwner?.accountId || null;
            settings = owner === accountId ? value.fpToolsAutoReplies || {} : {};
            scope = settings.chatGuardState?.[accountId] || {}; loadError = '';
        } catch (error) { loadError = error.message; }
        render();
    }
    async function notify() {
        if (busy || !available() || !visible() || loadError || Date.now() - lastAttempt < 10000) return;
        // Avoid runtime/storage writes when nothing is due.
        const active = document.querySelector('.contact-item.active[data-id]')?.dataset.id || new URL(location.href).searchParams.get('node');
        if (!waiting().some(entry => !entry.notifiedAt && overdue(entry) && entry.chatId !== active)) return;
        busy = true; lastAttempt = Date.now(); const expected = accountId;
        let notification;
        try {
            ({ notification } = await command({ operation: 'claimNotification', excludeChatId: active }, expected));
            if (!notification) return;
            await load();
            if (!available() || accountId !== expected || !visible()) return;
            const entries = notification.entries.filter(entry => scope.waiting?.[entry.chatId]?.firstMessageId === entry.firstMessageId);
            if (!entries.length) return;
            toast?.close(); toastAccount = expected; toastEntries = entries;
            const single = entries.length === 1;
            toast = root.showNotification(single ? `${entries[0].name || 'Покупатель'} ждёт ответа · ${duration(entries[0])}` : `Ждут вашего ответа: ${entries.length}`, false, {
                duration: 8000, action: single ? 'Открыть диалог' : 'Посмотреть', onAction: () => {
                    if (expected !== pageAccount()) return;
                    if (single) openChat(entries[0].chatId); else open();
                }
            });
            await command({ operation: 'ackNotification', token: notification.token }, expected);
            notification = null;
        } catch (_) { /* Queue remains visible; the next poll can retry the lease. */ }
        finally {
            if (notification) await command({ operation: 'releaseNotification', token: notification.token }, expected).catch(() => {});
            busy = false;
        }
    }
    document.addEventListener('visibilitychange', () => { if (visible()) load().then(notify); });
    document.addEventListener('fptChatFilterChanged', render);
    document.addEventListener('fptChatMarkedFilterEnabled', () => { if (filterActive) { filterActive = false; render(); } });
    root.addEventListener('focus', () => load().then(notify));
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.fpToolsAutoReplies || changes.fpToolsProfileOwner)) load();
    });
    // DOM work is coalesced and ignores our own mutations, including timestamps.
    let scheduled = false;
    new MutationObserver(records => {
        if (!records.some(record => {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            return (record.type === 'attributes' && target?.matches('.contact-item'))
                || (record.type !== 'attributes' && target?.closest('.contact-list') && !target.closest('.fpt-cg-contact-time'))
                || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('.chat-full-header, .chat-header, .fpt-chat-actions, .contact-item, .contact-list, .dropdown-menu') || node.querySelector?.('.chat-full-header, .chat-header, .contact-list')));
        })) return;
        if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); }
    }).observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ['class'], subtree: true });
    setInterval(() => { render(); notify(); }, 15000);
    root.FPTChatGuard = Object.freeze({ load, notify, open, command });
    load().then(() => { if (location.hash === '#fpt-waiting') { open(); history.replaceState(null, '', location.pathname + location.search); } notify(); });
})(window);
