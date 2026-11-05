import { messageId, compareIds, orderedMessages } from './chat_protocol.js';
import { normalizeChatText } from './chat_sender.js';

const newer = (a, b) => compareIds(a, b) > 0;
const scopeOf = (settings, account) => {
    settings.chatGuardState ||= {};
    return settings.chatGuardState[account.accountId] ||= { version: 1, chats: {}, waiting: {}, outgoing: [] };
};
export const CHAT_GUARD_SNOOZE_MINUTES = Object.freeze([5, 15, 60, 180]);
export const chatGuardThreshold =value => Math.max(1, Math.min(1440, Math.trunc(Number(value) || 30)));
export function chatGuardSettingsChanged(before, after) {
    if (Boolean(before.chatGuardEnabled) === Boolean(after.chatGuardEnabled)) return;
    for (const scope of Object.values(after.chatGuardState || {})) scope.rebaseline = true;
}
async function fingerprint(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeChatText(value)));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

// A read-only consumer of the shared stream. All writes use the auto-reply store's
// transaction queue; no independent polling, send retries, or copies of delivery text.
export function createChatGuard({ readSettings, updateSettings, guard, now = () => Date.now(), hash = fingerprint } = {}) {
    async function change(account, mutate) {
        await guard.assertCurrent(account);
        return updateSettings(async settings => {
            await guard.assertCurrent(account);
            return mutate(scopeOf(settings, account), settings);
        });
    }
    async function prepare(account, snapshot) {
        let pending = {};
        await change(account, (scope, settings) => {
            if (!settings.chatGuardEnabled) return;
            scope.error = null;
            const baseline = !scope.seeded || scope.rebaseline;
            let watermark = scope.watermark || '0';
            for (const chat of snapshot.chats) {
                const id = messageId(chat.chatId), target = messageId(chat.msgId);
                if (!id || !target) continue;
                if (newer(target, watermark)) watermark = target;
                if (!scope.chats[id] && Object.keys(scope.chats).length >= 1000) {
                    scope.error = 'Достигнут лимит 1000 чатов. Наблюдение за новыми чатами приостановлено.';
                    continue;
                }
                let state = scope.chats[id];
                if (!state || (baseline && !scope.waiting[id])) {
                    state = scope.chats[id] = { cursor: baseline ? target : (scope.watermark || '0'), newChat: !baseline };
                }
                if (!state.target || newer(target, state.target)) state.target = target;
                state.name = chat.chatName || state.name || id;
            }
            scope.watermark = watermark;
            scope.seeded = true;
            delete scope.rebaseline;
            // Saved waiting chats are also reconciled when absent from bookmarks.
            for (const [id, state] of Object.entries(scope.chats)) {
                if (baseline && scope.waiting[id]) state.reconcile = true;
                if (newer(state.target, state.cursor) || state.reconcile) pending[id] = { ...state };
            }
            scope.lastSnapshotAt = now();
            if (!Object.keys(pending).length) scope.lastCheckedAt = now();
        });
        return pending;
    }
    async function observe(account, chatId, raw, name) {
        const messages = orderedMessages(raw);
        const hashes = new Map();
        for (const message of messages) {
            if (messageId(message.authorId, { zero: true }) === null || message.invalidReason) throw new Error('Автор или тело сообщения не распознаны.');
            if (String(message.authorId) === account.accountId && message.kind === 'text') hashes.set(message.id, await hash(message.text));
        }
        await change(account, (scope, settings) => {
            if (!settings.chatGuardEnabled) return;
            const chat = scope.chats[chatId];
            if (!chat) return;
            for (const message of messages.filter(m => newer(m.id, chat.cursor))) {
                const author = String(message.authorId);
                if (author !== '0' && author !== account.accountId) {
                    const entry = scope.waiting[chatId] ||= { chatId, firstMessageId: message.id, since: now() };
                    Object.assign(entry, { buyerId: author, name: name || chat.name || chatId,
                        lastBuyerMessageId: message.id, text: message.kind === 'image' && !message.text ? 'Фото' : String(message.text || '').slice(0, 240), snoozedUntil: 0 });
                } else if (author === account.accountId) {
                    const marked = /^[\u2061\u2064]/.test(message.text || '');
                    const attempts = scope.outgoing.filter(item => item.chatId === chatId && item.status !== 'rejected');
                    const exact = attempts.find(item => item.messageId === message.id);
                    const candidates = attempts.filter(item => !item.messageId && (!item.afterId || newer(message.id, item.afterId)) &&
                        (message.kind === 'text' ? item.kind === 'text' && item.fingerprint === hashes.get(message.id)
                            : item.kind === 'image' && (!message.imageId || item.imageId === message.imageId)));
                    if (exact || marked) {
                        // Known automatic message. It cannot resolve a buyer's wait.
                        if (marked && candidates.length === 1) {
                            candidates[0].messageId = message.id;
                            candidates[0].status = 'observed';
                        }
                    } else if (candidates.length) {
                        // A missing boundary or multiple identical messages cannot establish
                        // a receipt. Keep the wait, never silently call it a manual reply.
                        const candidate = candidates[0];
                        const matching = messages.filter(m => String(m.authorId) === account.accountId && (!candidate.afterId || newer(m.id, candidate.afterId)) &&
                            (m.kind === 'text' ? hashes.get(m.id) === candidate.fingerprint : m.kind === 'image' && m.imageId === candidate.imageId));
                        if (candidates.length === 1 && candidate.afterId && matching.length === 1 && (message.kind === 'text' || message.imageId)) {
                            candidate.messageId = message.id;
                            candidate.status = 'observed';
                        } else if (scope.waiting[chatId]) scope.waiting[chatId].uncertain = 'Не удалось однозначно определить источник ответа. Ожидание сохранено.';
                    } else if (scope.waiting[chatId] && newer(message.id, scope.waiting[chatId].lastBuyerMessageId)) {
                        delete scope.waiting[chatId];
                    }
                }
                chat.cursor = message.id;
            }
            delete chat.newChat;
            delete chat.reconcile;
            delete chat.error;
            chat.checkedAt = now();
            // Receipts behind the observation cursor no longer need to be retained.
            scope.outgoing = scope.outgoing.filter(item => !item.messageId || !scope.chats[item.chatId] || newer(item.messageId, scope.chats[item.chatId].cursor));
            scope.lastCheckedAt = now();
        });
    }
    async function report(account, error, chatId = null) {
        await change(account, scope => {
            if (chatId && scope.chats[chatId]) scope.chats[chatId].error = String(error?.message || error);
            else scope.error = error ? String(error?.message || error) : null;
        });
    }
    async function trackSend({ chatId, text, imageId, accountId, auth, afterMessageId }, send) {
        const account = await guard.current();
        if (!account.accountId || String(accountId || auth?.userId || account.accountId) !== account.accountId) throw new Error('Аккаунт отправки изменился.');
        await guard.assertCurrent(account);
        const settings = await readSettings();
        const scope = settings.chatGuardState?.[account.accountId];
        if (!settings.chatGuardEnabled && !scope?.seeded) return send({ afterMessageId });
        const kind = imageId ? 'image' : 'text';
        const digest = kind === 'text' ? await hash(text) : null;
        const token = crypto.randomUUID();
        let boundary = messageId(afterMessageId);
        await change(account, (state, current) => {
            const stream = current.chatStreams?.[account.accountId]?.chats?.[chatId];
            for (const value of [state.chats[chatId]?.cursor, stream?.cursor, stream?.target]) {
                if (messageId(value) && (!boundary || newer(value, boundary))) boundary = value;
            }
            // Keep unresolved attempts: pruning them could turn a delayed automated
            // message into a manual answer. A full journal fails before the send.
            state.outgoing = state.outgoing.filter(item => item.status !== 'rejected');
            if (state.outgoing.length >= 1000) throw new Error('Журнал источников сообщений ChatGuard заполнен.');
            state.outgoing.push({ token, chatId: String(chatId), kind, fingerprint: digest, imageId: imageId ? String(imageId) : null,
                afterId: boundary, status: 'sending', at: now() });
        });
        let result;
        try {
            await guard.assertCurrent(account);
            result = await send({ afterMessageId: boundary });
            return result;
        } finally {
            await change(account, state => {
                const item = state.outgoing.find(value => value.token === token);
                if (item) Object.assign(item, { status: result?.status || 'uncertain', messageId: result?.messageId || item.messageId || null });
            });
        }
    }
    async function command(request) {
        const account = await guard.current({ fresh: true });
        if (!account.accountId || String(request.expectedAccountId) !== account.accountId) throw new Error('Аккаунт изменился. Обновите страницу.');
        let result = {};
        if (['claimNotification', 'ackNotification', 'releaseNotification'].includes(request.operation)) {
            await change(account, (scope, settings) => {
                const time = now();
                const lease = scope.notificationLease;
                if (request.operation !== 'claimNotification') {
                    if (!lease || lease.token !== request.token || lease.tabId !== request.notificationTabId) return;
                    if (request.operation === 'ackNotification' && lease.until > time && settings.chatGuardEnabled) {
                        for (const item of lease.entries) {
                            const entry = scope.waiting[item.chatId];
                            if (entry?.firstMessageId === item.firstMessageId) entry.notifiedAt = time;
                        }
                    }
                    delete scope.notificationLease;
                    return;
                }
                if (!settings.chatGuardEnabled || scope.rebaseline || scope.error || !scope.lastSnapshotAt || time - scope.lastSnapshotAt > 90000 || lease?.until > time) return;
                const entries = Object.values(scope.waiting || {}).filter(entry => {
                    const chat = scope.chats[entry.chatId];
                    return entry.chatId !== request.excludeChatId && !entry.notifiedAt && !(entry.snoozedUntil > time)
                        && time - entry.since >= chatGuardThreshold(settings.chatGuardThresholdMinutes) * 60000
                        && chat && !chat.error && !chat.reconcile && !newer(chat.target, chat.cursor);
                }).sort((a, b) => a.since - b.since);
                if (!entries.length) return;
                const token = crypto.randomUUID();
                scope.notificationLease = { token, tabId: request.notificationTabId, until: time + 15000,
                    entries: entries.map(entry => ({ chatId: entry.chatId, firstMessageId: entry.firstMessageId })) };
                result = { notification: { token, entries } };
            });
            return { accountId: account.accountId, ...result };
        }
        if (request.operation === 'undoDismiss') {
            await change(account, (scope, settings) => {
                const saved = scope.dismissed;
                if (!settings.chatGuardEnabled || !saved || saved.token !== request.token || saved.until < now()
                    || scope.waiting[saved.entry.chatId] || scope.chats[saved.entry.chatId]?.cursor !== saved.cursor) {
                    throw new Error('Чат уже изменился. Отменить действие нельзя.');
                }
                scope.waiting[saved.entry.chatId] = saved.entry;
                delete scope.dismissed;
            });
            return { accountId: account.accountId };
        }
        if (['snooze', 'resume', 'dismiss'].includes(request.operation)) {
            if (!messageId(request.chatId) || (request.operation === 'snooze' && !CHAT_GUARD_SNOOZE_MINUTES.includes(request.minutes))) throw new Error('Некорректная отсрочка.');
            await change(account, (scope, settings) => {
                if (!settings.chatGuardEnabled) throw new Error('Наблюдение выключено.');
                const entry = scope.waiting[request.chatId];
                if (!entry || entry.lastBuyerMessageId !== request.lastBuyerMessageId) throw new Error('Чат изменился. Обновите список.');
                // «Ответ не нужен» drops only this wait: the cursor is already past the message,
                // so the next buyer message opens a new one.
                if (request.operation === 'dismiss') {
                    const token = crypto.randomUUID();
                    scope.dismissed = { entry, cursor: scope.chats[request.chatId]?.cursor, token, until: now() + 10000 };
                    result.undoToken = token;
                    delete scope.waiting[request.chatId];
                }
                else entry.snoozedUntil = request.operation === 'snooze' ? now() + request.minutes * 60000 : 0;
            });
        } else if (request.operation === 'settings') {
            await change(account, (scope, settings) => {
                const before = { ...settings };
                if (typeof request.enabled === 'boolean') settings.chatGuardEnabled = request.enabled;
                if (request.threshold !== undefined) {
                    if (!Number.isInteger(request.threshold) || request.threshold < 1 || request.threshold > 1440) throw new Error('Укажите порог от 1 до 1440 минут.');
                    settings.chatGuardThresholdMinutes = request.threshold;
                }
                chatGuardSettingsChanged(before, settings);
            });
        } else throw new Error('Неизвестная команда ChatGuard.');
        return { accountId: account.accountId, ...result };
    }
    return Object.freeze({ prepare, observe, report, trackSend, command });
}
