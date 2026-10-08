/*
 * FunPay Funcy — журнал «Заказы и выдачи»: карточки и команды продавца.
 *
 * Фон считает допустимые действия по фактам заказа (capabilities) и принимает
 * только эти команды с expectedRevision: устаревшая карточка получает конфликт.
 * Универсальной кнопки «Повторить» нет — у каждого действия свой смысл:
 *   - «Проверить заказ» перечитывает страницу (без эффектов, кроме разрешённых правилами);
 *   - «Отправить ещё раз» — только часть с неясным исходом, тем же текстом;
 *   - «Отправить оставшееся» — только части, которые точно не отправлены;
 *   - ручная отметка «выдано» хранится отдельно и помечается как ручная;
 *   - возврат FunPay останавливает новые эффекты.
 * Тексты выданного товара в списке маскируются; полный текст — отдельной командой.
 */

import { orderKeyOf } from './ops_db.js';
import { describeReasons } from './order_verifier.js';
import { deliveryOpKey } from './fulfillment_dispatcher.js';

export const ORDER_FILTERS = Object.freeze(['attention', 'delivery', 'done', 'all']);

export function maskSecret(text) {
    const value = String(text || '');
    if (value.length <= 6) return '•'.repeat(value.length);
    return `${value.slice(0, 3)}${'•'.repeat(Math.min(12, value.length - 5))}${value.slice(-2)}`;
}

export function orderNeedsAttention(order) {
    return ['blocked', 'uncertain', 'partial', 'failed'].includes(order.deliveryState)
        || order.problemState === 'attention' || order.problemState === 'open'
        || Boolean(order.holds?.length);
}

export function orderMatchesFilter(order, filter) {
    switch (filter) {
        case 'attention': return orderNeedsAttention(order);
        case 'delivery': return ['pending', 'sending', 'blocked', 'uncertain', 'partial', 'failed', 'sent-unconfirmed'].includes(order.deliveryState);
        case 'done': return ['done', 'legacy', 'manual'].includes(order.deliveryState) && !orderNeedsAttention(order);
        default: return true;
    }
}

// Допустимые действия для карточки по текущим фактам.
export function orderCapabilities(order, { parts = [], deliveryOp = null } = {}) {
    const caps = [];
    const add = (id, label, extra = {}) => caps.push({ id, label, ...extra });
    const refunded = order.fpStatus === 'refunded';
    add('verify', 'Проверить заказ');
    if (order.adopted !== true && !refunded && ['none', 'blocked'].includes(order.deliveryState)) add('adopt', 'Выполнять автоматически');
    if (!order.lotId && !refunded) add('confirmBinding', order.lotCandidate?.offerId ? `Подтвердить лот #${order.lotCandidate.offerId}` : 'Указать лот', { needs: ['offerId'] });
    const uncertainParts = parts.filter(part => part.state === 'uncertain');
    for (const part of uncertainParts) {
        add('resendPart', `Отправить часть ${part.index + 1} ещё раз`, { partId: part.partId, warning: 'Сообщение могло уже дойти — покупатель может получить копию.' });
    }
    const unsent = parts.filter(part => ['pending', 'rejected'].includes(part.state));
    if (unsent.length && !uncertainParts.length && !refunded && !order.holds?.length && deliveryOp && deliveryOp.state === 'failed') {
        add('deliverRemaining', `Отправить оставшиеся части (${unsent.length})`);
    }
    if (parts.length) add('revealDelivery', 'Показать выданный текст');
    if (!['done', 'manual'].includes(order.deliveryState)) add('markDelivered', 'Отметить «выдано вручную»', { needs: ['note'] });
    if (order.holds?.some(hold => hold.owner === 'seller')) add('releaseHold', 'Снять удержание');
    else if (!refunded) add('hold', 'Удержать: не выполнять эффекты', { needs: ['reason'] });
    if (refunded) add('openOrder', 'Открыть заказ на FunPay');
    return caps;
}

function summarize(order) {
    return {
        key: order.key, orderId: order.orderId, revision: order.revision, buyerName: order.buyerName || null,
        lotName: order.lotName || '', quantity: order.quantity ?? null, quantityRaw: order.quantityRaw ?? null,
        fpStatus: order.fpStatus, deliveryState: order.deliveryState,
        resultCoverage: order.resultCoverage, problemState: order.problemState, attention: orderNeedsAttention(order),
        holds: order.holds || [], blockReasons: describeReasons(order.blockReasons || []), adopted: order.adopted === true,
        source: order.fulfillmentSource || null, updatedAt: order.updatedAt, firstSeenAt: order.firstSeenAt
    };
}

export function createOrderCommands({ journal, guard, dispatcher, now = () => Date.now() } = {}) {
    if (!journal || !guard || !dispatcher) throw new Error('Команды заказов не настроены.');

    async function account() {
        const state = await guard.current({ fresh: true });
        if (!state.accountId) throw new Error('Аккаунт FunPay не определён.');
        return state;
    }

    async function load(orderKey, accountId) {
        const order = await journal.getRecord('accountOrders', orderKey);
        if (!order || order.accountId !== accountId) throw new Error('Заказ не найден для текущего аккаунта.');
        return order;
    }

    async function context(order) {
        const generation = order.fulfillmentGeneration || 1;
        const deliveryOp = await journal.getOp(deliveryOpKey(order.key, generation));
        const parts = deliveryOp ? await journal.listParts(deliveryOp.key) : [];
        return { deliveryOp, parts };
    }

    async function list({ filter = 'attention', limit = 200 } = {}) {
        const { accountId } = await account();
        const orders = await journal.listAccountOrders({ accountId });
        const counts = Object.fromEntries(ORDER_FILTERS.map(name => [name, orders.filter(order => orderMatchesFilter(order, name)).length]));
        const items = orders.filter(order => orderMatchesFilter(order, ORDER_FILTERS.includes(filter) ? filter : 'all'))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, limit).map(summarize);
        return { counts, items };
    }

    async function card({ orderKey }) {
        const { accountId } = await account();
        const order = await load(orderKey, accountId);
        const ctx = await context(order);
        const events = await journal.listEvents(order.key);
        return {
            order: { ...summarize(order), lotId: order.lotId || null, offerId: order.offerId || order.lotId || null, lotCandidate: order.lotCandidate || null,
                chatId: order.chatId || null, fpConfirmedAt: order.fpConfirmedAt || null, verifiedFulfillmentCompletedAt: order.verifiedFulfillmentCompletedAt || null,
                manualDelivery: order.manualDelivery || null, generation: order.fulfillmentGeneration || 1 },
            parts: ctx.parts.map(part => ({ partId: part.partId, index: part.index, state: part.state, preview: maskSecret(part.text), receipt: part.receipt || null, error: part.error || null })),
            events: events.slice(-50).map(event => ({ type: event.type, at: event.at, data: event.data })),
            capabilities: orderCapabilities(order, ctx)
        };
    }

    async function command(input) {
        const state = await account();
        const order = await load(input.orderKey, state.accountId);
        if (input.expectedRevision != null && order.revision !== input.expectedRevision) {
            throw Object.assign(new Error('Заказ изменился — карточка обновлена, повторите действие.'), { code: 'conflict' });
        }
        const ctx = await context(order);
        const allowed = orderCapabilities(order, ctx);
        const cap = allowed.find(item => item.id === input.command && (!item.partId || item.partId === input.partId));
        if (!cap) throw Object.assign(new Error('Это действие сейчас недоступно для заказа.'), { code: 'not-allowed' });
        await journal.appendEvent(order.key, `seller.${input.command}`, { partId: input.partId || null, note: input.note || input.reason || null });

        switch (input.command) {
            case 'verify':
                return dispatcher.observe({ orderId: order.orderId, source: 'seller', adopt: false });
            case 'adopt':
                await journal.updateAccountOrder(order.key, () => ({ adopted: true, nextCheckAt: null }));
                return dispatcher.observe({ orderId: order.orderId, source: 'seller', adopt: true });
            case 'confirmBinding': {
                const offerId = String(input.offerId || '');
                if (!/^\d+$/.test(offerId)) throw new Error('Укажите номер лота.');
                await journal.updateAccountOrder(order.key, () => ({ confirmedBinding: { offerId, at: now(), by: 'seller' } }));
                return dispatcher.observe({ orderId: order.orderId, source: 'seller', adopt: order.adopted === true });
            }
            case 'resendPart':
                return dispatcher.resendUncertainPart({ orderKey: order.key, partId: input.partId });
            case 'deliverRemaining':
                return dispatcher.deliverRemaining({ orderKey: order.key });
            case 'revealDelivery':
                return { parts: ctx.parts.map(part => ({ index: part.index, state: part.state, text: part.text })) };
            case 'markDelivered': {
                const note = String(input.note || '').trim();
                if (!note) throw new Error('Опишите, как и что выдано — отметка хранится как ручная.');
                return journal.updateAccountOrder(order.key, () => ({
                    deliveryState: 'manual', problemState: 'resolved', blockReasons: [],
                    manualDelivery: { note: note.slice(0, 500), at: now(), by: 'seller' }
                }));
            }
            case 'hold': {
                const reason = String(input.reason || '').trim() || 'Удержание продавцом';
                return journal.updateAccountOrder(order.key, current => ({
                    holds: [...(current.holds || []).filter(hold => hold.owner !== 'seller'), { owner: 'seller', reason: reason.slice(0, 200), at: now() }],
                    problemState: 'open'
                }));
            }
            case 'releaseHold':
                // Снимается только удержание продавца; удержание возврата остаётся.
                return journal.updateAccountOrder(order.key, current => ({ holds: (current.holds || []).filter(hold => hold.owner !== 'seller') }));
            case 'openOrder':
                return { url: `https://funpay.com/orders/${order.orderId}/` };
            default:
                throw new Error('Неизвестная команда.');
        }
    }

    return Object.freeze({ list, card, command, orderKeyOf });
}
