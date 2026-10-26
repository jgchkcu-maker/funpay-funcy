// Saved FunPay accounts. Everything runs in the background service (background/accounts_service.js):
// session keys never reach this page, rows are addressed by record id.
async function fptAccountsRequest(action, payload = {}) {
    let response;
    try {
        response = await chrome.runtime.sendMessage({ ...payload, action });
    } catch (error) {
        throw new Error('Фон расширения не отвечает. Обновите страницу и попробуйте снова.');
    }
    if (!response?.ok) {
        const error = new Error(response?.error || 'Действие с аккаунтом не выполнено.');
        if (response?.code) error.code = response.code;
        throw error;
    }
    return response.result;
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    Object.entries({
        list: 'accountsList',
        add: 'accountsAddCurrent',
        addCurrentAccountBtn: 'accountsAddCurrent',
        switch: 'accountsSwitch',
        refresh: 'accountsRefresh',
        fptRefreshAccountsBtn: 'accountsRefresh',
        rename: 'accountsRename',
        note: 'accountsSetNote',
        delete: 'accountsDelete',
        sync: 'accountsSync',
        undoSync: 'accountsUndoSync',
        dismissNotice: 'accountsDismissNotice'
    }).forEach(([id, action]) => {
        window.fptPopupActions.register('accounts', id, payload => fptAccountsRequest(action, payload || {}));
    });
}
