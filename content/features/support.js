function _msg(action, extra = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ ...extra, action }, r => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (r?.success === false) return reject(new Error(r.error || 'Ошибка'));
            resolve(r);
        });
    });
}

function _getUsername() {
    // Primary: DOM element always present when logged in
    const nameEl = document.querySelector('.user-link-name');
    if (nameEl?.textContent.trim()) return nameEl.textContent.trim();
    // Fallback: appData
    try {
        const d = JSON.parse(document.body.dataset.appData || '{}');
        return (Array.isArray(d) ? d[0] : d)?.userName || '';
    } catch (_) { return ''; }
}

function _evaluateCondition(condition, fieldValues) {
    if (!condition) return true;
    try {
        const c = JSON.parse(condition);
        const targetName = `ticket[fields][${c.fieldId}]`;
        const cur = fieldValues[targetName] || '';
        if (c.type === 'equals') return cur === String(c.value) || parseInt(cur) === c.value;
    } catch (_) {}
    return false;
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('tickets', id, fn);
    const messages = { 'fp-ticket-refresh-btn': 'supportGetTickets', 'fp-create-ticket-btn': 'supportGetCategories',
        getTicketFields: 'supportGetFields',
        'fp-ticket-confirm-yes': 'supportCreateTicket', openTicket: 'supportGetTicketDetails',
        'fp-ticket-reply-btn': 'supportAddComment', closeTicket: 'supportCloseTicket' };
    Object.entries(messages).forEach(([id, action]) => register(id, p => _msg(action, p)));
    register('fp-new-ticket-submit', p => {
        const categoryId = String(p.categoryId || '').trim(), message = String(p.message || '').trim();
        if (!categoryId) throw new Error('Выберите категорию.');
        if (!message) throw new Error('Введите сообщение.');
        return { categoryId, message, fieldValues: { ...p.fieldValues }, preview: p.preview || message };
    });
    register('fp-send-auto-ticket-btn', async p => {
        const { orderIds } = await _msg('getUnconfirmedOrders', { ageHours: p.ageHours ?? 24, maxOrders: p.maxOrders ?? 5 });
        const username = p.username || _getUsername();
        const ids = orderIds.join(', ');
        return { categoryId: '1', orderIds, message: `Здравствуйте! Прошу подтвердить заказы: ${ids}. С уважением, ${username}!`,
            fieldValues: { 'ticket[fields][1]': username, 'ticket[fields][2]': ids, 'ticket[fields][3]': '2', 'ticket[fields][5]': '201' } };
    });
    for (const id of ['fp-ticket-detail-back', 'fp-ticket-confirm-no', 'fp-new-ticket-close']) register(id, () => null);
    register('fp-tarm', () => ({ attachment: null }));
}
