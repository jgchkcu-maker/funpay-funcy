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
            if (!error.retryAt) {
                error.retryAt = now() + 30000;
                await setCooldown(account, error.retryAt, 'Ошибка чтения или формата ответа.');
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
    function batch(account, auth, ids) {
        return serial(account, async () => {
            if (!ids.length || ids.length > batchSize || ids.some(id => !messageId(id))) throw new Error('Некорректный пакет чатов.');
            const json = await runner(account, auth, ids.map(id => ({ type: 'chat_node', id, tag: tag(), data: { node: id, last_message: -1, content: '' } })));
            if (!Array.isArray(json?.objects)) throw new Error('Не распознан пакет сообщений.');
            const result = {};
            for (const id of ids) {
                const nodes = json.objects.filter(o => o.type === 'chat_node' && (String(o.data?.node?.id ?? o.id) === id));
                if (nodes.length !== 1 || !Array.isArray(nodes[0].data?.messages)) {
                    result[id] = { ok: false, error: 'Чат отсутствует в ответе или формат не распознан.' }; continue;
                }
                result[id] = await parseMessages(nodes[0].data.messages, id);
            }
            return result;
        });
    }
    function history(account, chatId, beforeId) {
        return serial(account, async () => {
            if (!messageId(chatId) || !messageId(beforeId)) throw new Error('Некорректный курсор истории.');
            const url = `https://funpay.com/chat/history?${new URLSearchParams({ node: chatId, last_message: beforeId })}`;
            const json = await request(account, url, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
            if (String(json?.chat?.node?.id) !== chatId || !Array.isArray(json.chat.messages)) return { ok: false, error: 'История чата не распознана.' };
            return parseMessages(json.chat.messages, chatId);
        });
    }
    return Object.freeze({ bookmarks, batch, history, batchSize });
}
