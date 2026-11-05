import { messageId, readDelay } from './chat_protocol.js';

// Read-only runner/history transport. A single queue per account, no immediate
// retries. Persistent cooldown is shared with bookmark reads and backfill.
export function createChatReader({ fetchImpl = (...args) => fetch(...args), parseMessages, parseChatList,
    getCooldown = async () => 0, setCooldown = async () => {}, assertCurrent = async () => {},
    now = () => Date.now(), timeoutMs = 15000, batchSize = 4 } = {}) {
    const queues = new Map();
    async function request(account, url, options) {
        await assertCurrent(account);
        const retryAt = await getCooldown(account);
        if (retryAt > now()) throw Object.assign(new Error('Чтение чатов отложено.'), { retryAt });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetchImpl(url, { credentials: 'include', ...options, signal: controller.signal, redirect: 'error' });
            if (!response.ok) {
                const delay = [403, 429].includes(response.status) ? readDelay(response, now()) : 30000;
                const until = now() + delay;
                await setCooldown(account, until, `HTTP ${response.status}`);
                throw Object.assign(new Error(`Чтение чатов: HTTP ${response.status}.`), { retryAt: until, httpStatus: response.status });
            }
            const json = await response.json();
            if (json?.error) throw new Error('FunPay вернул ошибку чтения.');
            await assertCurrent(account);
            return json;
        } catch (error) {
            if (controller.signal.aborted && error?.name === 'AbortError') {
                error = Object.assign(new Error('FunPay не ответил вовремя. Чтение чатов будет повторено позже.'), { code: 'CHAT_READ_TIMEOUT' });
            }
            if (!error.retryAt) {
                error.retryAt = now() + 30000;
                await setCooldown(account, error.retryAt, error.code === 'CHAT_READ_TIMEOUT' ? error.message : 'Ошибка чтения или формата ответа.');
            }
            throw error;
        } finally { clearTimeout(timer); }
    }
    function serial(account, work) {
        const previous = queues.get(account.accountId) || Promise.resolve();
        const run = previous.catch(() => {}).then(async () => {
            try { return await work(); }
            catch (error) {
                if (!error.retryAt) {
                    error.retryAt = now() + 30000;
                    await setCooldown(account, error.retryAt, 'Формат ответа чата не распознан.');
                }
                throw error;
            }
        });
        queues.set(account.accountId, run);
        run.finally(() => { if (queues.get(account.accountId) === run) queues.delete(account.accountId); }).catch(() => {});
        return run;
    }
    function runner(account, auth, objects) {
        return request(account, 'https://funpay.com/runner/', { method: 'POST', headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest'
        }, body: new URLSearchParams({ objects: JSON.stringify(objects), request: 'false', csrf_token: auth.csrf_token }) });
    }
    function tag() { return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'); }
    function bookmarks(account, auth) {
        return serial(account, async () => {
            const json = await runner(account, auth, [{ type: 'chat_bookmarks', id: account.accountId, tag: tag(), data: false },
                { type: 'orders_counters', id: account.accountId, tag: tag(), data: false }]);
            if (!Array.isArray(json?.objects)) throw new Error('Не распознан ответ runner.');
            const object = json.objects.find(o => o.type === 'chat_bookmarks');
            if (typeof object?.data?.html !== 'string') throw new Error('Список чатов отсутствует в ответе.');
            return { chats: await parseChatList(object.data.html),
                ordersCounters: json.objects.find(o => o.type === 'orders_counters')?.data ?? null };
        });
    }
    function batch(account, _auth, ids) {
        return serial(account, async () => {
            if (!ids.length || ids.length > batchSize || ids.some(id => !messageId(id))) throw new Error('Некорректный пакет чатов.');
            const result = {};
            // Subscribing to chat_node declares the chat viewed and can clear
            // unread on FunPay. Background observation must only fetch history.
            // Keep the per-account queue/cooldown and bounded group of IDs.
            for (const id of ids) {
                result[id] = await readHistory(account, id, '99999999999999999999999');
            }
            return result;
        });
    }
    async function readHistory(account, chatId, beforeId) {
        const url = `https://funpay.com/chat/history?${new URLSearchParams({ node: chatId, last_message: beforeId })}`;
        const json = await request(account, url, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
        if (String(json?.chat?.node?.id) !== chatId || !Array.isArray(json.chat.messages)) return { ok: false, error: 'История чата не распознана.' };
        return parseMessages(json.chat.messages, chatId);
    }
    function history(account, chatId, beforeId) {
        return serial(account, async () => {
            if (!messageId(chatId) || !messageId(beforeId)) throw new Error('Некорректный курсор истории.');
            return readHistory(account, chatId, beforeId);
        });
    }
    return Object.freeze({ bookmarks, batch, history, batchSize });
}
