/*
 * FunPay Funcy — строгая отправка сообщения в чат FunPay.
 *
 * Один POST /runner/ без повторов. Исход:
 *   confirmed — в ответе runner найдено наше сообщение (id, автор, текст);
 *   accepted  — FunPay ответил корректным JSON без ошибки, но сообщение в ответе
 *               не найдено: запрос принят, доставка не подтверждена;
 *   rejected  — однозначный отказ (4xx, 429 или error в ответе): сообщение не отправлено;
 *   uncertain — таймаут, сетевая ошибка, 5xx или нечитаемый ответ: сообщение
 *               могло дойти. Такой исход нельзя повторять автоматически.
 *
 * Формат подтверждения runner не закреплён реальными фикстурами, поэтому
 * отсутствие сообщения в ответе даёт accepted, а не rejected.
 */

export const CHAT_SEND_STATES = Object.freeze(['confirmed', 'accepted', 'rejected', 'uncertain']);

function stripMarkup(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&');
}

export function normalizeChatText(text) {
    return String(text || '')
        .replace(/[​-‍⁠-⁤﻿]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Ищет наше сообщение в ответе runner: objects[].type === 'chat_node' с messages.
export function findSentMessage(json, { chatId, text, accountId }) {
    const wanted = normalizeChatText(text);
    if (!wanted || !Array.isArray(json?.objects)) return null;
    for (const object of json.objects) {
        if (object?.type !== 'chat_node' || String(object.id) !== String(chatId)) continue;
        const messages = Array.isArray(object.data?.messages) ? object.data.messages : [];
        for (const message of messages) {
            const author = message?.author != null ? String(message.author) : null;
            if (accountId && author && author !== String(accountId)) continue;
            const body = normalizeChatText(stripMarkup(message?.html ?? message?.text ?? ''));
            if (body.includes(wanted)) return { messageId: message.id != null ? String(message.id) : null, author };
        }
    }
    return null;
}

export function buildRunnerMessageBody({ chatId, content, csrfToken }) {
    return new URLSearchParams({
        objects: JSON.stringify([{ type: 'chat_node', id: chatId, tag: '00000000', data: { node: chatId, last_message: -1, content: '' } }]),
        request: JSON.stringify({ action: 'chat_message', data: { node: chatId, last_message: -1, content } }),
        csrf_token: csrfToken
    });
}

export function createStrictChatSender({ fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 20000, mark = text => text } = {}) {
    async function send({ chatId, text, auth, accountId = null }) {
        if (!/^\d+$/.test(String(chatId || ''))) return { status: 'rejected', error: 'Некорректный чат.' };
        if (!auth?.csrf_token) return { status: 'rejected', error: 'Нет CSRF-токена FunPay.' };
        const content = mark(String(text || ''));
        if (!content.trim()) return { status: 'rejected', error: 'Пустое сообщение.' };

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        let response;
        try {
            response = await fetchImpl('https://funpay.com/runner/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'x-requested-with': 'XMLHttpRequest'
                },
                body: buildRunnerMessageBody({ chatId: String(chatId), content, csrfToken: auth.csrf_token }),
                signal: controller?.signal
            });
        } catch (error) {
            return { status: 'uncertain', error: error?.name === 'AbortError' ? 'FunPay не ответил вовремя.' : (error?.message || 'Сетевая ошибка.') };
        } finally {
            if (timer) clearTimeout(timer);
        }

        if (response.status >= 500) return { status: 'uncertain', httpStatus: response.status, error: `FunPay ответил HTTP ${response.status}.` };
        if (!response.ok) return { status: 'rejected', httpStatus: response.status, error: `FunPay отклонил сообщение: HTTP ${response.status}.` };

        let json;
        try {
            json = JSON.parse(await response.text());
        } catch (_) {
            return { status: 'uncertain', httpStatus: response.status, error: 'FunPay вернул нечитаемый ответ.' };
        }
        if (!json || typeof json !== 'object') return { status: 'uncertain', httpStatus: response.status, error: 'FunPay вернул пустой ответ.' };
        if (json.error) return { status: 'rejected', httpStatus: response.status, error: `FunPay: ${typeof json.error === 'string' ? json.error : 'ошибка отправки'}.` };

        const found = findSentMessage(json, { chatId, text: content, accountId });
        if (found) return { status: 'confirmed', httpStatus: response.status, messageId: found.messageId };
        return { status: 'accepted', httpStatus: response.status };
    }

    return Object.freeze({ send });
}
