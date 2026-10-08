/*
 * FunPay Funcy — факты страницы заказа.
 *
 * Offscreen-парсер (parseOrderFacts) только снимает сырые строки со страницы
 * /orders/<id>/. Здесь они превращаются в проверяемые факты: номер заказа со
 * страницы, роли, статус, количество с единицей, привязка к лоту, состояние
 * отзыва. Решений «выдавать или нет» модуль не принимает — это order_verifier.
 *
 * Неизвестное остаётся неизвестным: нераспознанное количество не превращается в 1,
 * отсутствие разметки отзыва не означает «отзыва нет».
 */

export const ORDER_FACTS_VERSION = 2;
export const ORDER_ID_RE = /^[A-Z0-9]{8}$/;

// Единицы целого количества, которые понимает MVP. Категория может расширить
// список своим контрактом (unitContract.units).
export const DEFAULT_INTEGER_UNITS = Object.freeze(['', 'шт', 'pcs', 'pc', 'piece', 'pieces']);

const GROUP_SPACE_RE = /[    ]/;

function normalizeUnit(unit) {
    return String(unit || '').trim().toLowerCase().replace(/\.$/, '');
}

// Разбирает исходную строку количества целиком.
// { kind: 'integer', value, unit, raw } | { kind: 'unknown', raw, reason }
export function parseOrderQuantity(raw, { units = DEFAULT_INTEGER_UNITS } = {}) {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return { kind: 'unknown', raw: text, reason: 'missing' };
    const match = /^(\d{1,3}(?:[    ]\d{3})+|\d+)(.*)$/.exec(text);
    if (!match) return { kind: 'unknown', raw: text, reason: 'not-a-number' };
    const rest = match[2];
    if (/^[.,]\d/.test(rest)) return { kind: 'unknown', raw: text, reason: 'fractional' };
    // Единица отделяется пробелом: «2abc» — не количество 2.
    if (rest && !/^\s/.test(rest)) return { kind: 'unknown', raw: text, reason: 'unit' };
    const unit = normalizeUnit(rest);
    const allowed = new Set((units || []).map(normalizeUnit));
    if (!allowed.has(unit)) return { kind: 'unknown', raw: text, reason: 'unit', unit };
    const digits = match[1].split(GROUP_SPACE_RE).join('');
    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value <= 0) return { kind: 'unknown', raw: text, reason: 'range' };
    return { kind: 'integer', value, unit, raw: text };
}

export function parseOrderStatus(text) {
    const value = String(text || '').trim().toLowerCase();
    if (!value) return 'unknown';
    if (/возврат|refund/.test(value)) return 'refunded';
    if (/закрыт|closed|complete|выполнен/.test(value)) return 'closed';
    if (/оплачен|paid/.test(value)) return 'paid';
    return 'unknown';
}

function cleanId(value) {
    const text = String(value ?? '').trim();
    return /^\d+$/.test(text) ? text : null;
}

function reviewPresence(review, recognized) {
    if (!review || typeof review !== 'object') return { presence: 'unknown' };
    const rating = Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 ? review.rating : null;
    if (rating !== null || review.hasReviewText) {
        return { presence: 'present', rating, authorId: cleanId(review.authorId) };
    }
    // «Отзыва нет» — только на распознанной странице с узнаваемым блоком отзыва.
    if (recognized && review.sectionFound) return { presence: 'absent' };
    return { presence: 'unknown' };
}

// raw — результат offscreen parseOrderFacts, requestedOrderId — что запрашивали.
export function normalizeOrderFacts(raw, { requestedOrderId = null, observedAt = Date.now(), unitContract = null } = {}) {
    const requested = String(requestedOrderId || '').replace(/^#/, '').toUpperCase() || null;
    if (!raw || typeof raw !== 'object') {
        return { recognized: false, orderId: null, requestedOrderId: requested, observedAt, version: ORDER_FACTS_VERSION, problems: ['unparsed'] };
    }
    const pageOrderId = String(raw.pageOrderId || '').replace(/^#/, '').toUpperCase();
    const orderId = ORDER_ID_RE.test(pageOrderId) ? pageOrderId : null;
    const recognized = Boolean(raw.recognized && orderId);
    const quantity = parseOrderQuantity(raw.quantityText, unitContract || undefined);
    const status = parseOrderStatus(raw.statusText);
    const problems = [];
    if (!recognized) problems.push('unrecognized-page');
    if (requested && orderId && requested !== orderId) problems.push('order-mismatch');
    return {
        version: ORDER_FACTS_VERSION,
        recognized,
        observedAt,
        requestedOrderId: requested,
        orderId,
        currentUserId: cleanId(raw.currentUserId),
        sellerId: cleanId(raw.sellerId),
        buyerId: cleanId(raw.buyerId),
        buyerUsername: raw.buyerUsername ? String(raw.buyerUsername).trim() : null,
        buyerChatId: cleanId(raw.buyerChatId),
        status,
        statusText: String(raw.statusText || '').trim(),
        quantity,
        lotId: cleanId(raw.lotId),
        nodeId: cleanId(raw.nodeId),
        nodeType: raw.nodeType === 'chips' || raw.nodeType === 'lots' ? raw.nodeType : null,
        lotName: raw.lotName ? String(raw.lotName).replace(/\s+/g, ' ').trim() : '',
        category: raw.category ? String(raw.category).trim() : '',
        secrets: Array.isArray(raw.secrets) ? raw.secrets.map(String).filter(Boolean) : [],
        review: reviewPresence(raw.review, recognized),
        problems
    };
}

// Роль текущего аккаунта: 'seller' | 'buyer' | 'unknown'. Ошибка — всегда unknown.
export function orderRole(facts, accountId) {
    const me = cleanId(accountId) || facts?.currentUserId || null;
    if (!facts?.recognized || !me) return 'unknown';
    if (facts.currentUserId && facts.currentUserId !== me) return 'unknown';
    if (facts.sellerId) return facts.sellerId === me ? 'seller' : (facts.buyerId === me ? 'buyer' : 'unknown');
    if (facts.buyerId === me) return 'buyer';
    return 'unknown';
}

// Компактный отпечаток для журнала: меняется, если сменились существенные факты.
export function orderFactsFingerprint(facts) {
    if (!facts) return null;
    return [facts.orderId, facts.sellerId, facts.buyerId, facts.buyerChatId, facts.status,
        facts.quantity?.kind === 'integer' ? `${facts.quantity.value}${facts.quantity.unit}` : 'q?',
        facts.lotId || '-', facts.nodeId || '-', facts.review?.presence || '?'].join('|');
}
