/*
 * FunPay Funcy — сведения о заказе для фоновых функций.
 *
 * Страница заказа не всегда содержит ссылку на сам лот. Если ссылки нет, лот
 * определяется по краткому описанию и категории среди собственных лотов
 * продавца — и только при единственном совпадении. Иначе lotId = null:
 * лучше не выдать, чем выдать чужой товар.
 */

export function normalizeLotTitle(value) {
    return String(value || '')
        .replace(/[​-‍⁠-⁤﻿]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function resolveOrderLotId(info, ownLots) {
    if (!info) return { lotId: null, source: null };
    if (/^\d+$/.test(String(info.lotId || ''))) return { lotId: String(info.lotId), source: 'link' };

    const title = normalizeLotTitle(info.lotName);
    if (!title || !Array.isArray(ownLots)) return { lotId: null, source: null };
    const matches = ownLots.filter(lot => normalizeLotTitle(lot?.title) === title
        && (!info.nodeId || String(lot.nodeId) === String(info.nodeId)));
    return matches.length === 1
        ? { lotId: String(matches[0].id), source: 'title' }
        : { lotId: null, source: matches.length ? 'ambiguous' : null };
}

// fetchOrderInfo(orderId) -> разобранная страница заказа;
// listOwnLots() -> [{ id, nodeId, title }] собственных лотов.
export function createOrderDetailsLoader({ fetchOrderInfo, listOwnLots, now = () => Date.now(), orderTtlMs = 60000, lotsTtlMs = 600000 } = {}) {
    if (typeof fetchOrderInfo !== 'function') throw new Error('Не задано чтение страницы заказа.');
    const orders = new Map();
    let lotsCache = null;

    async function ownLots() {
        if (typeof listOwnLots !== 'function') return [];
        if (lotsCache && now() - lotsCache.at < lotsTtlMs) return lotsCache.promise;
        const promise = Promise.resolve().then(listOwnLots).then(lots => (Array.isArray(lots) ? lots : []));
        lotsCache = { at: now(), promise };
        promise.catch(() => { if (lotsCache?.promise === promise) lotsCache = null; });
        return promise;
    }

    async function loadFresh(orderId) {
        const info = await fetchOrderInfo(orderId);
        if (!info) return null;
        let resolved = resolveOrderLotId(info, null);
        if (!resolved.lotId) resolved = resolveOrderLotId(info, await ownLots().catch(() => []));
        return {
            ...info,
            orderId,
            lotId: resolved.lotId,
            lotIdSource: resolved.source,
            amount: Number.isInteger(info.amount) && info.amount > 0 ? info.amount : 1
        };
    }

    // Один заказ в течение orderTtlMs читается один раз, даже если его спрашивают
    // и автовыдача, и журнал, и сверка.
    function load(orderId) {
        const id = String(orderId || '').toUpperCase();
        const cached = orders.get(id);
        if (cached && now() - cached.at < orderTtlMs) return cached.promise;
        const promise = loadFresh(id);
        orders.set(id, { at: now(), promise });
        promise.then(value => { if (!value) orders.delete(id); }, () => orders.delete(id));
        if (orders.size > 100) orders.delete(orders.keys().next().value);
        return promise;
    }

    return Object.freeze({ load });
}
