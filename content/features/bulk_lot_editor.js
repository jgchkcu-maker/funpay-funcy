// Data operations for the replacement lot editor. Full FunPay fields are preserved.
function bulkLotAbortError() {
    const error = new Error('Операция остановлена.');
    error.name = 'AbortError';
    return error;
}

function throwIfBulkLotAborted(signal) {
    if (signal?.aborted) throw bulkLotAbortError();
}

function waitForBulkLotDelay(delayMs, signal) {
    throwIfBulkLotAborted(signal);
    const delay = Math.max(0, Number(delayMs) || 0);
    if (!delay) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let timer;
        const finish = callback => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            callback();
        };
        const onAbort = () => finish(() => reject(bulkLotAbortError()));
        timer = setTimeout(() => finish(resolve), delay);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

// Shared with the popup preview (FPTBulkLotEditor) so the preview and the saved result never disagree.
// JavaScript \b ignores Cyrillic, so whole words are matched with Unicode letter lookarounds.
function buildBulkFindRegex(fr = {}) {
    if (!fr.find) return null;
    const source = fr.regex ? String(fr.find) : String(fr.find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = fr.wholeWord ? `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])` : source;
    return new RegExp(pattern, `${fr.all !== false ? 'g' : ''}${fr.caseSensitive ? '' : 'i'}${fr.wholeWord ? 'u' : ''}`);
}

function applyBulkTemplate(template, current, lotName) {
    return String(template).replace(/{current}/gi, () => current || '').replace(/{lotname}/gi, () => lotName || '');
}

// Returns the new seller price for every mode except buyer_set, which needs the section commission.
// cost_plus needs the lot cost from FPTCostBasis.
function computeBulkPrice(current, price = {}, cost = NaN) {
    const value = Number(price.value), step = Number(price.step ?? 1);
    let next;
    switch (price.mode) {
        case 'set': next = value; break;
        case 'cost_plus': next = Number(cost) + value; break;
        case 'add': next = current + value; break;
        case 'sub': next = current - value; break;
        case 'pct_up': next = current * (1 + value / 100); break;
        case 'pct_down': next = current * (1 - value / 100); break;
        case 'round_flat': next = Math.round(current / step) * step; break;
        default: return current;
    }
    return finalizeBulkPrice(next, price);
}

function finalizeBulkPrice(next, price = {}) {
    const minimum = price.minimum === undefined || price.minimum === '' ? NaN : Number(price.minimum);
    let result = Math.max(0, next);
    if (!Number.isNaN(minimum)) result = Math.max(minimum, result);
    return price.round === true ? Math.round(result) : Math.round(result * 100) / 100;
}

function userIdOfPage() {
    try {
        const app = JSON.parse(document.body?.dataset.appData || '{}');
        const userId = (Array.isArray(app) ? app[0] : app)?.userId;
        return userId != null ? String(userId) : null;
    } catch (_) {
        return null;
    }
}

async function openBulkEditor(p = {}) {
    const app = JSON.parse(document.body?.dataset.appData || '{}');
    const userId = p.userId || (Array.isArray(app) ? app[0] : app).userId;
    if (!userId) throw new Error('Нет userId');
    return chrome.runtime.sendMessage({ action: 'getUserLotsList', userId });
}
async function applyPopupBulkLots(p = {}, activate = false) {
    if (!Array.isArray(p.lots) || !p.lots.length) throw new Error('Выберите хотя бы один лот.');
    const change = activate ? {} : (p.changes || {}), price = change.price || {}, fr = change.findReplace || {};
    const newName = change.name ?? '', newDesc = change.description ?? '', newMsg = change.message ?? '';
    const nameWanted = Object.hasOwn(change, 'name'), descWanted = Object.hasOwn(change, 'description'), msgWanted = Object.hasOwn(change, 'message');
    const pMode = price.mode || 'none', pVal = Number(price.value), pFlatStep = Number(price.step ?? 1);
    const priceWanted = pMode !== 'none', frActive = Boolean(fr.find), frFields = { name: true, desc: true, msg: false, ...fr.fields };
    if (!['none', 'set', 'cost_plus', 'buyer_set', 'round_flat', 'add', 'sub', 'pct_up', 'pct_down'].includes(pMode)) throw new Error('Некорректный режим цены.');
    if (priceWanted && pMode !== 'round_flat' && (!Number.isFinite(pVal) || pVal < 0)) throw new Error('Укажите корректную цену.');
    if (pMode === 'pct_down' && pVal > 100) throw new Error('Снизить цену можно не больше чем на 100%.');
    if (pMode === 'round_flat' && (!Number.isFinite(pFlatStep) || pFlatStep <= 0)) throw new Error('Некорректный шаг округления.');
    if (!activate && !nameWanted && !descWanted && !msgWanted && !priceWanted && !frActive) throw new Error('Укажите хотя бы одно изменение.');
    let re = null;
    try { re = buildBulkFindRegex(fr); }
    catch (error) { throw new Error(`Ошибка в регулярном выражении: ${error.message}`); }
    const applyFindReplace = text => {
        if (!re) return text;
        re.lastIndex = 0;
        return String(text).replace(re, fr.replace ?? '');
    };
    const getField = (data, base) => data[`fields[${base}][ru]`] ?? data[`fields[${base}]`] ?? '';
    const setField = (data, base, value) => {
        const key = `fields[${base}][ru]` in data ? `fields[${base}][ru]` : `fields[${base}]` in data ? `fields[${base}]` : `fields[${base}][ru]`;
        data[key] = value;
    };
    const applyTemplate = applyBulkTemplate;
    const results = [];
    for (const lot of p.lots) {
        throwIfBulkLotAborted(p.signal);
        const offerId = lot.offerId ?? lot.id, nodeId = lot.nodeId;
        let lastBuyerInfo = '';
        try {
            if (!offerId || !nodeId) throw new Error('Не указан лот или раздел.');
            const loaded = await chrome.runtime.sendMessage({ action: 'getLotForExport', nodeId, offerId });
            throwIfBulkLotAborted(p.signal);
            if (!loaded?.success || !loaded.data) throw new Error(loaded?.error || 'Ошибка загрузки лота.');
            const editData = loaded.data;
                const formData = { ...editData, offer_id: offerId };
                if (activate) formData.active = 'on';
                const currentTitle = getField(editData, 'summary');

                // Step 1: find & replace on existing field values (точечно).
                if (frActive) {
                    if (frFields.name) setField(formData, 'summary',     applyFindReplace(getField(editData, 'summary')));
                    if (frFields.desc) setField(formData, 'desc',        applyFindReplace(getField(editData, 'desc')));
                    if (frFields.msg)  setField(formData, 'payment_msg', applyFindReplace(getField(editData, 'payment_msg')));
                }

                // Step 2: full-value overrides (if provided) - applied on top of step 1.
                if (nameWanted) setField(formData, 'summary', applyTemplate(newName, getField(formData, 'summary'), currentTitle));
                if (descWanted) setField(formData, 'desc', applyTemplate(newDesc, getField(formData, 'desc'), currentTitle));
                if (msgWanted) setField(formData, 'payment_msg', applyTemplate(newMsg, getField(formData, 'payment_msg'), currentTitle));

                if (priceWanted) {
                    const cur = parseFloat(editData.price);
                    if (isNaN(cur) && (pMode === 'add' || pMode === 'sub' || pMode === 'pct_up' || pMode === 'pct_down' || pMode === 'round_flat')) {
                        throw new Error('не удалось прочитать текущую цену');
                    }
                    let np;
                    if (pMode === 'buyer_set') {
                        let net = null;
                        if (window.FPTCommission && nodeId) {
                            try { net = await window.FPTCommission.sellerNet(nodeId, pVal); } catch (_) {}
                        }
                        if (net == null) throw new Error('не удалось получить комиссию раздела');
                        np = finalizeBulkPrice(net, price);
                    } else if (pMode === 'cost_plus') {
                        const cost = await window.FPTCostBasis?.get(offerId);
                        if (!cost || !(Number(cost.amount) > 0)) throw new Error('не указана себестоимость');
                        if (cost.currency && cost.currency !== 'RUB') throw new Error(`себестоимость указана в ${cost.currency}, а не в рублях`);
                        np = computeBulkPrice(cur, price, Number(cost.amount));
                    } else {
                        np = computeBulkPrice(cur, price);
                    }
                    formData.price = String(np);

                    if (window.FPTCommission && nodeId) {
                        try {
                            const bp = await window.FPTCommission.buyerPrice(nodeId, np);
                            if (bp != null) lastBuyerInfo = ` (продавец ${np} ₽ → покупатель ≈ ${bp.toFixed(2).replace('.', ',')} ₽)`;
                        } catch (_) {}
                    }
                }


            throwIfBulkLotAborted(p.signal);
            // Фон применяет только отличия от загруженной формы и проверяет, что их
            // исходные значения не изменились (иначе — конфликт, а не перезапись).
            const saved = await chrome.runtime.sendMessage({ action: 'saveSingleLot', nodeId, data: formData, original: editData, expectedAccountId: userIdOfPage() });
            if (!saved?.success) throw new Error(saved?.error || 'Ошибка сохранения.');
            results.push({
                offerId, success: true,
                title: getField(formData, 'summary'),
                ...(priceWanted ? { price: formData.price } : {}),
                ...(lastBuyerInfo ? { note: lastBuyerInfo.trim() } : {})
            });
        } catch (error) {
            if (p.signal?.aborted || error?.name === 'AbortError') throw bulkLotAbortError();
            results.push({ offerId, success: false, error: error.message });
        }
        p.onProgress?.({ processed: results.length, total: p.lots.length, result: results.at(-1) });
        throwIfBulkLotAborted(p.signal);
        if (results.length < p.lots.length) await waitForBulkLotDelay(p.delayMs ?? 1200, p.signal);
    }
    return { results, successCount: results.filter(result => result.success).length };
}
if (typeof window !== 'undefined') {
    window.FPTBulkLotEditor = Object.freeze({ buildFindRegex: buildBulkFindRegex, applyTemplate: applyBulkTemplate, computePrice: computeBulkPrice });
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('lot_io', 'fp-bulk-edit-btn', openBulkEditor);
    window.fptPopupActions.register('lot_io', 'openBulkEditor', openBulkEditor);
    window.fptPopupActions.register('lot_io', 'fp-bulk-apply-btn', p => applyPopupBulkLots(p));
    window.fptPopupActions.register('lot_io', 'fp-bulk-activate-btn', p => applyPopupBulkLots(p, true));
    window.fptPopupActions.register('lot_io', 'fp-bulk-select-all', p => window.fptPopupActions.toggleCategorySelection({
        categories: (p.lots || []).map(lot => ({ id: lot.offerId ?? lot.id })), selectedCategoryIds: p.selectedLotIds
    }));
}
