function initializeBlacklist() {}

async function addToBlacklistFromChat(username) {
    if (!username) return;
    try { await mutatePopupBlacklist('add', { username, note: 'Добавлен из чата' }); }
    catch (error) { showNotification(error.message, true); return; }
    showNotification(`${username} добавлен в чёрный список`);
}
async function isInBlacklist(username) {
    if (!username) return false;
    const { fpToolsBlacklist = [] } = await chrome.storage.local.get('fpToolsBlacklist');
    return fpToolsBlacklist.some(e => e.username.toLowerCase() === username.toLowerCase());
}

async function removeFromBlacklistByName(username) {
    if (!username) return;
    await mutatePopupBlacklist('remove', { username });
    showNotification(`${username} удалён из чёрного списка`);
}

async function mutatePopupBlacklist(action, p) {
    const result = await window.fptPopupActions.updateSettings('fpToolsBlacklist', ({ fpToolsBlacklist = [] }) => {
    const username = String(p.username || '').trim();
    if (!username) throw new Error('Укажите имя пользователя.');
    const index = fpToolsBlacklist.findIndex(item => item.username.toLowerCase() === username.toLowerCase());
    if (action === 'add') {
        if (index >= 0) throw new Error('Уже в списке');
        fpToolsBlacklist.push({ username, note: p.note || '', blockDelivery: true, blockResponse: true,
            addedAt: Date.now() });
    } else {
        if (index < 0) throw new Error('Пользователь не найден.');
        if (action === 'remove') fpToolsBlacklist.splice(index, 1);
        else Object.assign(fpToolsBlacklist[index], p.settings);
    }
    return { fpToolsBlacklist };
    });
    document.dispatchEvent?.(new Event('fpToolsBlacklistUpdated'));
    return result.fpToolsBlacklist;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('blacklist', 'fp-bl-add-btn', p => mutatePopupBlacklist('add', p));
    window.fptPopupActions.register('blacklist', 'removeFromBlacklistByName', p => mutatePopupBlacklist('remove', p));
    window.fptPopupActions.register('blacklist', 'updateBlacklistEntry', p => mutatePopupBlacklist('update', p));
}
