export function messageId(value, { zero = false } = {}) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
    const id = String(value ?? '');
    return /^(0|[1-9]\d*)$/.test(id) && (zero || id !== '0') ? id : null;
}
export const compareIds = (a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
export function orderedMessages(messages) {
    const byId = new Map();
    for (const raw of messages) {
        const id = messageId(raw?.id);
        if (!id) throw new Error('Сообщение без корректного ID.');
        const message = { ...raw, id };
        const previous = byId.get(message.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(message)) throw new Error('Противоречивый повтор ID сообщения.');
        byId.set(message.id, message);
    }
    return [...byId.values()].sort((a, b) => compareIds(a.id, b.id));
}
export function readDelay(response, now = Date.now()) {
    const value = response.headers?.get?.('Retry-After');
    const seconds = value && /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : null;
    const date = value && seconds === null ? Date.parse(value) : NaN;
    const delay = seconds ?? (Number.isFinite(date) ? date - now : 0);
    const requested = Number.isFinite(delay) ? Math.min(delay, 24 * 60 * 60_000) : 0;
    return Math.max(response.status === 403 ? 15 * 60_000 : 60_000, requested);
}
