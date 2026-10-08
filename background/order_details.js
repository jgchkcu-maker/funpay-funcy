/*
 * FunPay Funcy — сведения о заказе для фоновых функций.
 *
 * Загрузчик читает страницу заказа и возвращает нормализованные факты
 * (order_facts.js). Кэш короткий и привязан к аккаунту и эпохе сессии: после
 * смены аккаунта старые сведения не используются. Для эффектов вызывающий
 * просит fresh: true — тогда страница перечитывается в любом случае.
 *
 * Если ссылки на лот нет, совпадение краткого описания с собственным лотом даёт
 * только кандидата (lotCandidate) для ручного подтверждения. Разрешением на
 * выдачу или закупку оно не является.
 */

import { normalizeOrderFacts } from './order_facts.js';

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

// fetchOrderFacts(orderId) -> сырые факты offscreen parseOrderFacts (или null);
// listOwnLots() -> [{ id, nodeId, title }] собственных лотов.
export function createOrderDetailsLoader({ fetchOrderFacts, listOwnLots, now = () => Date.now(), orderTtlMs = 60000, lotsTtlMs = 600000 } = {}) {
    if (typeof fetchOrderFacts !== 'function') throw new Error('Не задано чтение страницы заказа.');
    const orders = new Map();
    let lotsCache = null;

    async function ownLots(scope) {
        if (typeof listOwnLots !== 'function') return [];
        if (lotsCache && lotsCache.scope === scope && now() - lotsCache.at < lotsTtlMs) return lotsCache.promise;
        const promise = Promise.resolve().then(listOwnLots).then(lots => (Array.isArray(lots) ? lots : []));
        lotsCache = { at: now(), scope, promise };
        promise.catch(() => { if (lotsCache?.promise === promise) lotsCache = null; });
        return promise;
    }

    async function loadFresh(orderId, scope) {
        const raw = await fetchOrderFacts(orderId);
        if (!raw) return null;
        const facts = normalizeOrderFacts(raw, { requestedOrderId: orderId, observedAt: now() });
        let lotCandidate = null;
        if (!facts.lotId && facts.lotName) {
            const resolved = resolveOrderLotId(facts, await ownLots(scope).catch(() => []));
            lotCandidate = resolved.lotId ? { offerId: resolved.lotId, source: 'title' } : (resolved.source === 'ambiguous' ? { offerId: null, source: 'ambiguous' } : null);
        }
        return { ...facts, lotCandidate };
    }

    // Один заказ в пределах orderTtlMs читается один раз для одного аккаунта и эпохи,
    // если вызывающий не потребовал свежего чтения.
    function load(orderId, { accountId = null, epoch = null, fresh = false } = {}) {
        const id = String(orderId || '').replace(/^#/, '').toUpperCase();
        const scope = `${accountId || '?'}:${epoch ?? '?'}`;
        const key = `${scope}:${id}`;
        const cached = orders.get(key);
        if (!fresh && cached && now() - cached.at < orderTtlMs) return cached.promise;
        const promise = loadFresh(id, scope);
        orders.set(key, { at: now(), promise });
        promise.then(value => { if (!value) orders.delete(key); }, () => orders.delete(key));
        if (orders.size > 100) orders.delete(orders.keys().next().value);
        return promise;
    }

    function invalidate() {
        orders.clear();
        lotsCache = null;
    }

    return Object.freeze({ load, invalidate });
}
