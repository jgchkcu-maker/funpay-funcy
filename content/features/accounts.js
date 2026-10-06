// Saved FunPay accounts: switching between them swaps the golden_key session cookie.
// Account records: { name, key, avatar?, balance?, unread?, username?, loggedIn?, _snapTs? }. The key never leaves storage.
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

function fptMergeAccountSnapshot(account, snapshot) {
    Object.assign(account, {
        avatar: snapshot.avatar || account.avatar || '',
        balance: snapshot.balance || account.balance || '',
        unread: typeof snapshot.unread === 'number' ? snapshot.unread : account.unread || 0,
        _snapTs: Date.now()
    });
    if (typeof snapshot.loggedIn === 'boolean') account.loggedIn = snapshot.loggedIn;
    if (snapshot.username) account.username = snapshot.username;
    if (snapshot.funds && typeof snapshot.funds === 'object') account.funds = snapshot.funds;
    if (snapshot.pending && typeof snapshot.pending === 'object') {
        account.pending = { totals: { ...(snapshot.pending.totals || {}) }, count: Number(snapshot.pending.count) || 0 };
    }
}

function fptCurrentFunPayUser() {
    const name = document.querySelector('.user-link-name')?.textContent.trim();
    if (name) return name;
    try {
        const data = JSON.parse(document.body?.dataset?.appData || 'null');
        const user = Array.isArray(data) ? data[0] : data;
        return String(user?.userName || '').trim();
    } catch (_) {
        return '';
    }
}

async function fptPopupAccountAction(action, p = {}) {
    if (action === 'current') {
        const name = fptCurrentFunPayUser();
        let key = '';
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getGoldenKey' });
            if (response?.success && response.key) key = response.key;
        } catch (_) {}
        return { name, key };
    }
    if (action === 'switch') {
        const accounts = (await chrome.storage.local.get('fpToolsAccounts')).fpToolsAccounts || [];
        const account = accounts.find(item => item.key === p.key);
        if (!account) throw new Error('Аккаунт не найден.');
        return chrome.runtime.sendMessage({ action: 'setGoldenKey', key: account.key });
    }
    if (action === 'refresh') {
        // Snapshots swap the session cookie one account at a time, so they are fetched before the write queue is taken.
        const stored = (await chrome.storage.local.get('fpToolsAccounts')).fpToolsAccounts || [];
        const keys = p.key ? [p.key] : stored.map(account => account.key).filter(Boolean);
        const snapshots = new Map();
        for (const key of keys) {
            const snapshot = await fptFetchAccountSnapshot(key);
            if (snapshot) snapshots.set(key, snapshot);
        }
        if (p.key && !snapshots.size) throw new Error('Не удалось получить данные аккаунта.');
        const result = await window.fptPopupActions.updateSettings('fpToolsAccounts', current => {
            const accounts = current.fpToolsAccounts || [];
            accounts.forEach(account => { if (snapshots.has(account.key)) fptMergeAccountSnapshot(account, snapshots.get(account.key)); });
            return { fpToolsAccounts: accounts };
        });
        return result.fpToolsAccounts;
    }
    const result = await window.fptPopupActions.updateSettings('fpToolsAccounts', async current => {
        let accounts = current.fpToolsAccounts || [];
        if (action === 'add') {
            const name = String(p.name || fptCurrentFunPayUser() || '').trim();
            if (!name) throw new Error('Не удалось определить имя текущего пользователя. Войдите в аккаунт FunPay.');
            const response = await chrome.runtime.sendMessage({ action: 'getGoldenKey' });
            if (!response?.success || !response.key) throw new Error(response?.error || 'Не удалось получить ключ сессии. Вы вошли в аккаунт?');
            const sameKey = accounts.find(account => account.key === response.key);
            if (sameKey) throw new Error(`Этот аккаунт уже сохранён как «${sameKey.name}».`);
            if (accounts.some(account => account.name === name)) throw new Error(`Аккаунт «${name}» уже добавлен.`);
            accounts.push({ name, key: response.key, username: name, loggedIn: true });
        } else {
            const account = accounts.find(item => item.key === p.key);
            if (!account) throw new Error('Аккаунт не найден.');
            if (action === 'rename') {
                const name = String(p.name || '').trim();
                if (!name) throw new Error('Название не может быть пустым.');
                account.name = name;
            } else if (action === 'delete') accounts = accounts.filter(item => item !== account);
        }
        return { fpToolsAccounts: accounts };
    });
    return result.fpToolsAccounts;
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    Object.entries({ addCurrentAccountBtn: 'add', fptRefreshAccountsBtn: 'refresh', getCurrentAccount: 'current',
        switchAccount: 'switch', renameAccount: 'rename', deleteAccount: 'delete' }).forEach(([id, action]) => {
        window.fptPopupActions.register('accounts', id, p => fptPopupAccountAction(action, p));
    });
}
