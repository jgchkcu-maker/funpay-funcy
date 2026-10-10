(function (root) {
    'use strict';
    const required = {
        FPTLotAutomationPage: 'mountSchedulePane', FPTLotIOPage: 'mount', FPTOrdersView: 'mount',
        FPTAutoDeliveryPage: 'mount', FPTAutoBumpPage: 'mount', FPTAutoReplyPage: 'mount',
        FPTReviewReminderBlock: 'mount', FPTAutoReviewPage: 'mount', FPTQuickRepliesPage: 'mount',
        FPTInterfaceElementsPage: 'mount', FPTAccountsPage: 'mount', FPTFinanceHubPage: 'mount',
        FPTThemePage: 'mount', FPTEffectsPage: 'mount', FPTNotificationSoundPage: 'mount',
        FPTSupportPage: 'mount', FPTSettingsIOPage: 'mount', FPTBlacklistPage: 'mount'
    };
    const actions = {
        templates: ['fptQuickRepliesTemplatesTab', 'fptQuickRepliesCommandsTab'],
        finance_hub: ['fptFinTabOverview', 'fptFinTabSales', 'fptFinTabPurchases', 'fptFinTabProfit', 'fptFinTabPotential', 'fptFinTabOperations'],
        theme: ['getThemeCatalog', 'loadCatalog', 'fptg-load', 'onLoadOrApply', 'applyCurrent', 'fp-wp-apply-cur', 'move', 'fp-wp-prev', 'fp-wp-next', 'fptg-prev', 'fptg-next']
    };
    root.fptPopupBundleIsReady = () => typeof root.createMainPopup === 'function' && typeof root.setupPopupPageModes === 'function' &&
        !!root.FPTPopupMetadata?.pages && !!root.FPTFinanceModel && !!root.FPTFinanceCharts &&
        Object.entries(required).every(([name, method]) => typeof root[name]?.[method] === 'function') &&
        Object.entries(actions).every(([page, ids]) => ids.every(id => root.fptPopupActions?.list(page).includes(id)));
    const state = { status: 'idle', requestId: null, promise: null };
    root.fptPopupBundleState = state;
    const ready = () => root.__fptPopupBundleLoaded === true && root.fptPopupBundleIsReady();
    const failure = status => Object.assign(new Error(status === 'failed-not-started'
        ? 'Не удалось загрузить меню. Попробуйте открыть его ещё раз.'
        : 'Не удалось подтвердить загрузку меню. Перезагрузите страницу.'), { popupStatus: status });
    root.fptShowPopupLoadError = error => {
        document.getElementById('fpt-popup-load-error')?.remove();
        const notice = document.createElement('div');
        notice.id = 'fpt-popup-load-error'; notice.setAttribute('role', 'alert');
        Object.assign(notice.style, { position: 'fixed', zIndex: '2147483647', top: '75px', right: '16px', maxWidth: '360px', padding: '14px', borderRadius: '10px', background: '#27272c', color: '#fff', boxShadow: '0 4px 20px #0006', font: '14px/1.5 sans-serif' });
        const text = document.createElement('span'); text.textContent = error.message; notice.append(text);
        if (error.popupStatus !== 'failed-not-started') {
            const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Перезагрузить';
            reload.style.margin = '8px'; reload.addEventListener('click', () => location.reload()); notice.append(reload);
        }
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Закрыть'; close.style.margin = '8px';
        close.addEventListener('click', () => notice.remove()); notice.append(close); document.body.append(notice);
    };
    root.fptEnsurePopupBundle = async () => {
        if (ready()) { state.status = 'ready'; document.getElementById('fpt-popup-load-error')?.remove(); return; }
        if (state.status === 'failed-partial' || state.status === 'unknown' || state.status === 'ready') throw failure(state.status);
        if (!state.promise || state.status === 'failed-not-started') {
            const requestId = state.requestId = crypto.randomUUID();
            state.status = 'loading';
            state.promise = Promise.resolve().then(() => chrome.runtime.sendMessage({ action: 'fptLoadPopupBundle', requestId })).then(result => {
                state.result = result;
                if (state.requestId !== requestId) throw failure('unknown');
                if (result?.requestId === requestId && result.ok && result.status === 'ready' && ready()) state.status = 'ready';
                else state.status = result?.requestId === requestId && ['failed-not-started', 'failed-partial'].includes(result.status) ? result.status : 'unknown';
                if (state.status !== 'ready') throw failure(state.status);
            }, () => { state.status = 'unknown'; throw failure('unknown'); });
            // Keep observing the original operation even after its UI deadline.
            state.promise.catch(() => {});
        }
        let timer;
        try {
            await Promise.race([state.promise, new Promise((_, reject) => {
                timer = setTimeout(() => { state.status = 'unknown'; reject(failure('unknown')); }, 15000);
            })]);
        } finally { clearTimeout(timer); }
    };
})(window);
