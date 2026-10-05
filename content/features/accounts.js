let _fptAccAutoRefreshing = false;
async function saveAccountsList() {
    await chrome.storage.local.set({ fpToolsAccounts: fpToolsAccounts });

}

const _fptAccSnapCache = {}; // key -> { ts, snapshot }

async function fptFetchAccountSnapshot(key) {
    try {
        const res = await chrome.runtime.sendMessage({ action: 'getAccountSnapshot', key });
        if (res && res.ok) {
            _fptAccSnapCache[key] = { ts: Date.now(), snapshot: res.snapshot || {} };
            return res.snapshot || {};
        }
    } catch (_) {}
    return null;
}

async function maybeAutoRefreshAccounts() {
    if (_fptAccAutoRefreshing) return;
    const STALE = 55 * 60 * 1000;
    const now = Date.now();
    const needsUpdate = fpToolsAccounts.some(a => a.key && (!a._snapTs || (now - a._snapTs) > STALE));
    if (!needsUpdate) return;
    _fptAccAutoRefreshing = true;
    try {
        let changed = false;
        for (const account of fpToolsAccounts) {
            if (!account.key) continue;
            if (account._snapTs && (now - account._snapTs) <= STALE) continue;
            const snap = await fptFetchAccountSnapshot(account.key);
            if (snap) {
                account.avatar = snap.avatar || account.avatar || '';
                account.balance = snap.balance || account.balance || '';
                account.unread = typeof snap.unread === 'number' ? snap.unread : (account.unread || 0);
                account._snapTs = Date.now();
                changed = true;
            }
        }
        if (changed) await chrome.storage.local.set({ fpToolsAccounts });
    } finally {
        _fptAccAutoRefreshing = false;
    }
}

// Кнопка ручного обновления данных всех аккаунтов (аватар/баланс/непрочитанные).
async function fptRefreshAllAccounts() {
    showNotification('Обновляю данные аккаунтов…');
    for (const account of fpToolsAccounts) {
        if (!account.key) continue;
        const snap = await fptFetchAccountSnapshot(account.key);
        if (snap) {
            account.avatar = snap.avatar || account.avatar || '';
            account.balance = snap.balance || account.balance || '';
            account.unread = typeof snap.unread === 'number' ? snap.unread : (account.unread || 0);
            account._snapTs = Date.now();
        }
    }
    await chrome.storage.local.set({ fpToolsAccounts });

    showNotification('Данные аккаунтов обновлены.');
}

async function fptPopupAccountAction(action, p = {}) {
    if (action === 'switch') {
        const accounts = (await chrome.storage.local.get('fpToolsAccounts')).fpToolsAccounts || [];
        const account = accounts.find(item => item.key === p.key);
        if (!account) throw new Error('Аккаунт не найден.');
        return chrome.runtime.sendMessage({ action: 'setGoldenKey', key: account.key });
    }
    const result = await window.fptPopupActions.updateSettings('fpToolsAccounts', async current => {
    fpToolsAccounts = current.fpToolsAccounts || [];
    if (action === 'add') {
        const name = p.name || document.querySelector('.user-link-name')?.textContent.trim();
        if (!name) throw new Error('Не удалось определить имя текущего пользователя.');
        if (fpToolsAccounts.some(account => account.name === name)) throw new Error('Аккаунт уже добавлен.');
        const response = await chrome.runtime.sendMessage({ action: 'getGoldenKey' });
        if (!response?.success) throw new Error(response?.error || 'Не удалось получить ключ сессии.');
        fpToolsAccounts.push({ name, key: response.key });
    } else if (action === 'refresh') {
        for (const account of fpToolsAccounts) {
            const snapshot = await fptFetchAccountSnapshot(account.key);
            if (snapshot) Object.assign(account, { avatar: snapshot.avatar || account.avatar || '',
                balance: snapshot.balance || account.balance || '',
                unread: typeof snapshot.unread === 'number' ? snapshot.unread : account.unread || 0, _snapTs: Date.now() });
        }
    } else {
        const account = fpToolsAccounts.find(item => item.key === p.key);
        if (!account) throw new Error('Аккаунт не найден.');
        if (action === 'rename') {
            const name = String(p.name || '').trim();
            if (!name) throw new Error('Название не может быть пустым.');
            account.name = name;
        } else if (action === 'delete') fpToolsAccounts = fpToolsAccounts.filter(item => item !== account);
    }
    return { fpToolsAccounts };
    });
    return result.fpToolsAccounts;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    Object.entries({ addCurrentAccountBtn: 'add', fptRefreshAccountsBtn: 'refresh',
        switchAccount: 'switch', renameAccount: 'rename', deleteAccount: 'delete' }).forEach(([id, action]) => {
        window.fptPopupActions.register('accounts', id, p => fptPopupAccountAction(action, p));
    });
}

