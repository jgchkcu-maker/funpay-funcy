/*
 * FunPay Funcy — проверка заказа перед эффектом (выдача, закупка, напоминание).
 *
 * Чат — только сигнал перечитать заказ. Эффект разрешается по свежим фактам
 * страницы заказа: номер со страницы, текущий аккаунт — продавец, статус,
 * покупатель и его чат, точное количество и прямая привязка к лоту.
 * Любое неизвестное поле блокирует эффект, а не получает значение по умолчанию.
 */

import { orderRole } from './order_facts.js';

export const VERIFY_REASONS = Object.freeze({
    'unrecognized-page': 'Страница заказа не распознана',
    'order-mismatch': 'Номер заказа на странице не совпадает с запрошенным',
    'stale-facts': 'Сведения о заказе устарели — нужно перечитать страницу',
    'account-unknown': 'Не удалось определить текущий аккаунт',
    'account-mismatch': 'Страница открыта под другим аккаунтом',
    'role-unknown': 'Не удалось подтвердить, что вы продавец в этом заказе',
    'role-buyer': 'Это ваша покупка, а не продажа',
    'status-unknown': 'Статус заказа не распознан',
    'status-refunded': 'По заказу оформлен возврат',
    'status-not-paid': 'Заказ не в статусе «Оплачен»',
    'buyer-unknown': 'Покупатель не определён',
    'chat-unknown': 'Чат с покупателем не найден',
    'chat-mismatch': 'Чат события не совпадает с чатом покупателя заказа',
    'quantity-unknown': 'Количество не распознано целиком',
    'binding-missing': 'Лот заказа не подтверждён: нет прямой ссылки и ручной привязки',
    'binding-mismatch': 'Ссылка на лот в заказе не совпадает с подтверждённой привязкой'
});

const EFFECT_STATUSES = Object.freeze({
    purchase: ['paid'],
    delivery: ['paid', 'closed'],
    reminder: ['closed'],
    observe: ['paid', 'closed', 'refunded']
});

export function describeReasons(reasons) {
    return (reasons || []).map(code => VERIFY_REASONS[code] || code);
}

// ctx: { accountId, effect, eventChatId, binding: { offerId } | null, maxAgeMs, now }
export function verifyOrderForEffect(facts, ctx = {}) {
    const effect = ctx.effect || 'delivery';
    const reasons = [];
    const now = typeof ctx.now === 'number' ? ctx.now : Date.now();
    if (!facts?.recognized) reasons.push('unrecognized-page');
    if (facts?.problems?.includes('order-mismatch')) reasons.push('order-mismatch');
    if (ctx.expectedOrderId && facts?.orderId && String(ctx.expectedOrderId).toUpperCase() !== facts.orderId) {
        if (!reasons.includes('order-mismatch')) reasons.push('order-mismatch');
    }
    if (ctx.maxAgeMs && (!facts?.observedAt || now - facts.observedAt > ctx.maxAgeMs)) reasons.push('stale-facts');

    const accountId = ctx.accountId ? String(ctx.accountId) : null;
    if (!accountId) reasons.push('account-unknown');
    else if (facts?.currentUserId && facts.currentUserId !== accountId) reasons.push('account-mismatch');

    const role = accountId ? orderRole(facts, accountId) : 'unknown';
    if (role === 'buyer') reasons.push('role-buyer');
    else if (role !== 'seller' && accountId) reasons.push('role-unknown');

    const allowed = EFFECT_STATUSES[effect] || EFFECT_STATUSES.delivery;
    const status = facts?.status || 'unknown';
    if (status === 'unknown') reasons.push('status-unknown');
    else if (!allowed.includes(status)) reasons.push(status === 'refunded' ? 'status-refunded' : 'status-not-paid');

    if (effect !== 'observe') {
        if (!facts?.buyerId) reasons.push('buyer-unknown');
        if (!facts?.buyerChatId) reasons.push('chat-unknown');
        else if (ctx.eventChatId && String(ctx.eventChatId) !== facts.buyerChatId) reasons.push('chat-mismatch');
    }

    const quantity = facts?.quantity?.kind === 'integer' ? facts.quantity : null;
    if ((effect === 'delivery' || effect === 'purchase') && !quantity) reasons.push('quantity-unknown');

    let offerId = null;
    let bindingSource = null;
    const confirmed = ctx.binding?.offerId ? String(ctx.binding.offerId) : null;
    if (facts?.lotId) {
        offerId = facts.lotId;
        bindingSource = 'link';
        if (confirmed && confirmed !== facts.lotId) reasons.push('binding-mismatch');
    } else if (confirmed) {
        offerId = confirmed;
        bindingSource = 'confirmed';
    } else if (effect === 'delivery' || effect === 'purchase') {
        reasons.push('binding-missing');
    }

    return {
        ok: reasons.length === 0,
        effect,
        reasons,
        role,
        status,
        quantity,
        offerId,
        bindingSource,
        orderId: facts?.orderId || null,
        buyerId: facts?.buyerId || null,
        chatId: facts?.buyerChatId || null
    };
}
