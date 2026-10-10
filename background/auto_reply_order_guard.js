import { orderRole } from './order_facts.js';

export function autoReplyOrderStatus(facts, { accountId, orderId, chatId }) {
    if (!facts?.recognized || !accountId || !chatId || !facts.buyerId || !facts.buyerChatId ||
        facts.orderId !== String(orderId || '').toUpperCase() ||
        facts.problems?.includes('order-mismatch') ||
        (facts.currentUserId && facts.currentUserId !== String(accountId)) ||
        orderRole(facts, accountId) !== 'seller' || String(facts.buyerChatId) !== String(chatId)) return 'unknown';
    return facts.status || 'unknown';
}
