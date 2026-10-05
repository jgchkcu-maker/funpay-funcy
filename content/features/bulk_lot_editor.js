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
    const pMode = price.mode || 'none', pVal = Number(price.value), pRound = price.round === true;
    const pMin = price.minimum === undefined ? NaN : Number(price.minimum), pFlatStep = Number(price.step ?? 1);
    const priceWanted = pMode !== 'none', frActive = Boolean(fr.find), frFields = { name: true, desc: true, msg: false, ...fr.fields };
    if (!['none', 'set', 'buyer_set', 'round_flat', 'add', 'sub', 'pct_up', 'pct_down'].includes(pMode)) throw new Error('Некорректный режим цены.');
    if (priceWanted && pMode !== 'round_flat' && (!Number.isFinite(pVal) || pVal < 0)) throw new Error('Укажите корректную цену.');
    if (pMode === 'round_flat' && (!Number.isFinite(pFlatStep) || pFlatStep <= 0)) throw new Error('Некорректный шаг округления.');
    if (!activate && !nameWanted && !descWanted && !msgWanted && !priceWanted && !frActive) throw new Error('Укажите хотя бы одно изменение.');
    let pattern = fr.regex ? fr.find : String(fr.find || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (fr.wholeWord) pattern = `\\b${pattern}\\b`;
    const re = frActive ? new RegExp(pattern, (fr.all !== false ? 'g' : '') + (fr.caseSensitive ? '' : 'i')) : null;
    const applyFindReplace = text => re ? String(text).replace(re, fr.replace ?? '') : text;
    const getField = (data, base) => data[`fields[${base}][ru]`] ?? data[`fields[${base}]`] ?? '';
    const setField = (data, base, value) => {
        const key = `fields[${base}][ru]` in data ? `fields[${base}][ru]` : `fields[${base}]` in data ? `fields[${base}]` : `fields[${base}][ru]`;
        data[key] = value;
    };
    const applyTemplate = (tpl, current, lotName) => String(tpl).replace(/{current}/gi, () => current || '').replace(/{lotname}/gi, () => lotName || '');
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
                    switch (pMode) {
                        case 'set':        np = pVal; break;
                        case 'add':        np = cur + pVal; break;
                        case 'sub':        np = cur - pVal; break;
                        case 'pct_up':     np = cur * (1 + pVal / 100); break;
                        case 'pct_down':   np = cur * (1 - pVal / 100); break;
                        case 'round_flat': np = Math.round(cur / pFlatStep) * pFlatStep; break;
                        case 'buyer_set': {
                            let net = null;
                            if (window.FPTCommission && nodeId) {
                                try { net = await window.FPTCommission.sellerNet(nodeId, pVal); } catch (_) {}
                            }
                            if (net == null) throw new Error('не удалось получить комиссию раздела');
                            np = net;
                            break;
                        }
                    }
                    np = Math.max(0, np);
                    if (!isNaN(pMin)) np = Math.max(pMin, np);
                    np = pRound ? Math.round(np) : Math.round(np * 100) / 100;
                    formData.price = String(np);

                    if (window.FPTCommission && nodeId) {
                        try {
                            const bp = await window.FPTCommission.buyerPrice(nodeId, np);
                            if (bp != null) lastBuyerInfo = ` (продавец ${np} ₽ → покупатель ≈ ${bp.toFixed(2).replace('.', ',')} ₽)`;
                        } catch (_) {}
                    }
                }


            throwIfBulkLotAborted(p.signal);
            const saved = await chrome.runtime.sendMessage({ action: 'saveSingleLot', data: formData });
            if (!saved?.success) throw new Error(saved?.error || 'Ошибка сохранения.');
            results.push({ offerId, success: true });
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
if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('lot_io', 'fp-bulk-edit-btn', openBulkEditor);
    window.fptPopupActions.register('lot_io', 'openBulkEditor', openBulkEditor);
    window.fptPopupActions.register('lot_io', 'fp-bulk-apply-btn', p => applyPopupBulkLots(p));
    window.fptPopupActions.register('lot_io', 'fp-bulk-activate-btn', p => applyPopupBulkLots(p, true));
    window.fptPopupActions.register('lot_io', 'fp-bulk-select-all', p => window.fptPopupActions.toggleCategorySelection({
        categories: (p.lots || []).map(lot => ({ id: lot.offerId ?? lot.id })), selectedCategoryIds: p.selectedLotIds
    }));
}
