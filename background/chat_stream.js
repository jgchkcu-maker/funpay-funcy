import { messageId, compareIds, orderedMessages } from './chat_protocol.js';

// Cursors are durable, account-scoped and independent from outgoing sends.
// A reserved incoming message is never automatically replayed after interruption.
export function createChatStream({ readSettings, updateSettings, guard, reader, processMessage,
    now = () => Date.now(), maxChats = 8, maxMessages = 50, historyPages = 3, budgetMs = 20000 } = {}) {
    let busy = false;
    const read = async account => (await readSettings()).chatStreams?.[account.accountId];
    async function change(account, mutate) {
        await guard.assertCurrent(account);
        return updateSettings(async settings => {
            await guard.assertCurrent(account);
            const scope = settings.chatStreams?.[account.accountId];
            if (!scope || scope.epoch !== account.epoch) throw new Error('Область чатов сменилась.');
            mutate(scope);
        });
    }
    async function cooldown(account) { return (await read(account))?.retryAt || 0; }
    async function setCooldown(account, retryAt, error) {
        await change(account, scope => { scope.retryAt = retryAt; scope.error = error; });
    }
    async function poll(account, auth) {
        if (busy) return { skipped: 'busy' };
        busy = true;
        const started = now();
        let handled = 0, visited = 0, pages = 0;
        try {
            await guard.assertCurrent(account);
            await updateSettings(async settings => {
                await guard.assertCurrent(account);
                settings.chatStreams ||= {};
                const scope = settings.chatStreams[account.accountId] ||= { version: 1, chats: {}, pending: [] };
                scope.epoch = account.epoch;
                for (const chat of Object.values(scope.chats)) {
                    if (chat.handling) chat.error = 'Результат обработки неизвестен; автоматический повтор остановлен.';
                }
            });
            if (await cooldown(account) > now()) return { skipped: 'cooldown' };
            const snapshot = await reader.bookmarks(account, auth);
            await change(account, scope => {
                scope.error = null;
                for (const chat of snapshot.chats) {
                    const id = messageId(chat.chatId), target = messageId(chat.msgId);
                    if (!id || !target) continue;
                    if (!scope.chats[id] && Object.keys(scope.chats).length >= 1000) {
                        scope.error = 'Достигнут локальный лимит 1000 чатов; новые чаты пока не обрабатываются.';
                        continue;
                    }
                    // Bootstrap establishes a global message-ID boundary. A chat
                    // discovered later must backfill to that boundary or its beginning.
                    // Sales reconciliation covers pre-boundary orders.
                    const state = scope.chats[id] ||= { cursor: scope.seeded ? (scope.watermark || '0') : target,
                        target, name: chat.chatName || '', newChat: Boolean(scope.seeded) };
                    state.name = chat.chatName || state.name;
                    if (compareIds(target, state.target) > 0) state.target = target;
                    if (compareIds(state.target, state.cursor) > 0 && !scope.pending.includes(id)) scope.pending.push(id);
                }
                if (!scope.seeded) scope.watermark = snapshot.chats.reduce((max, chat) => {
                    const id = messageId(chat.msgId);
                    return id && compareIds(id, max) > 0 ? id : max;
                }, '0');
                scope.seeded = true;
            });
            const queue = [...(await read(account)).pending];
            while (queue.length && visited < maxChats && now() - started < budgetMs && handled < maxMessages) {
                const scope = await read(account);
                const ids = queue.splice(0, Math.min(reader.batchSize || 4, maxChats - visited))
                    .filter(id => !scope.chats[id].handling && !(scope.chats[id].retryAt > now()));
                if (!ids.length) continue;
                visited += ids.length;
                const batch = await reader.batch(account, auth, ids);
                for (const id of ids) {
                    if (now() - started >= budgetMs || handled >= maxMessages) break;
                    let state = (await read(account)).chats[id];
                    try {
                        if (!batch[id]?.ok) throw new Error(batch[id]?.error || 'Сообщения не распознаны.');
                        let messages = orderedMessages([...(state.backfill || []), ...batch[id].messages]);
                        if (!messages.length) throw new Error('Пустое окно сообщений при новом ID.');
                        let startReached = false;
                        while (compareIds(messages[0].id, state.cursor) > 0 && pages < historyPages && now() - started < budgetMs) {
                            const oldest = messages[0].id;
                            const history = await reader.history(account, id, oldest);
                            pages++;
                            if (!history?.ok) throw new Error(history?.error || 'История не распознана.');
                            if (state.newChat && history.messages.length === 0) { startReached = true; break; }
                            messages = orderedMessages([...history.messages, ...messages]);
                            if (messages[0].id === oldest) throw new Error('История не закрывает пропуск.');
                            if (messages.length > 1000) throw new Error('Пропуск превышает локальный лимит истории.');
                        }
                        if (!startReached && compareIds(messages[0].id, state.cursor) > 0) {
                            await change(account, s => {
                                s.chats[id].backfill = messages;
                                s.chats[id].error = 'Дочитывается пропуск истории.';
                                s.pending = [...s.pending.filter(value => value !== id), id];
                            });
                            continue;
                        }
                        if (compareIds(messages.at(-1).id, state.target) < 0) throw new Error('Окно не достигло нового ID из списка чатов.');
                        await change(account, s => { delete s.chats[id].backfill; delete s.chats[id].error; });
                        for (const message of messages.filter(m => compareIds(m.id, state.cursor) > 0)) {
                            if (handled >= maxMessages || now() - started >= budgetMs) break;
                            const author = messageId(message.authorId, { zero: true });
                            if (author === null || message.invalidReason) throw new Error('Автор или тело сообщения не распознаны.');
                            await guard.assertCurrent(account);
                            const own = author === account.accountId;
                            if (!own) {
                                await change(account, s => { s.chats[id].handling = { id: message.id, at: now() }; });
                                await processMessage({ ...message, chatId: id, buyerName: state.name, system: author === '0' }, account, auth);
                            }
                            await change(account, s => {
                                s.chats[id].cursor = message.id;
                                delete s.chats[id].newChat;
                                delete s.chats[id].handling;
                            });
                            state.cursor = message.id;
                            handled++;
                        }
                        await change(account, s => {
                            if (compareIds(s.chats[id].cursor, s.chats[id].target) >= 0) s.pending = s.pending.filter(value => value !== id);
                            else s.pending = [...s.pending.filter(value => value !== id), id];
                        });
                    } catch (error) {
                        await change(account, s => {
                            s.chats[id].error = s.chats[id].handling ? 'Результат обработки неизвестен; автоматический повтор остановлен.' : String(error.message);
                            s.chats[id].retryAt = now() + 60000;
                        });
                    }
                }
            }
            return { handled, visited, pages, pending: (await read(account)).pending.length };
        } finally { busy = false; }
    }
    return Object.freeze({ poll, cooldown, setCooldown });
}
