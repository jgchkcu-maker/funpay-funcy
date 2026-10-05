// Popup actions accept explicit values; no legacy view is mounted.
async function initializeAutoReview() {
    // This function is no longer needed as all logic is in background.js
}

// Replacement views submit explicit values through the existing serialized store.
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (page, id, fn) => window.fptPopupActions.register(page, id, fn);
    register('auto_review', 'addBonusBtn', p => {
        const text = String(p.text || '').trim();
        if (!text) throw new Error('Текст бонуса не может быть пустым.');
        return window.fptPatchAutoReplies({ arrayOps: { randomBonuses: [{ op: 'append', value: text }] } });
    });
    register('auto_reply', 'addKeywordBtn', p => {
        const keyword = String(p.keyword || '').trim();
        const response = String(p.response || '').trim();
        if (!keyword || (!response && !p.images?.length)) throw new Error('Укажите ключевое слово и ответ или изображение.');
        const rule = { keyword, response, matchMode: p.matchMode || 'exact' };
        if (Array.isArray(p.images) && p.images.length) {
            rule.images = p.images;
            rule.sendOrder = p.sendOrder || 'text_first';
        }
        return window.fptPatchAutoReplies({ arrayOps: { keywords: [{ op: 'append', value: rule }] } });
    });
    for (const [page, field] of [['auto_reply', 'keywords'], ['auto_review', 'randomBonuses']]) {
        register(page, 'removeListItem', p => window.fptPatchAutoReplies({ arrayOps: {
            [field]: [{ op: 'remove', index: p.index, expected: p.expected }]
        } }));
        register(page, 'updateListItem', p => window.fptPatchAutoReplies({ arrayOps: {
            [field]: [{ op: 'upsert', index: p.index, expected: p.expected, value: p.value }]
        } }));
    }
}
