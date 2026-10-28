// Contract checked against FunPay /547/js/app.bundle.js on 2026-10-28:
// multipart file -> {fileId}; runner chat_message -> response.error / response.url.
// One file per message. No automatic POST replay after an ambiguous response.
export const CHAT_IMAGE_MAX_BYTES = 7 * 1024 * 1024;

function failure(message, status = 'rejected') {
    return Object.assign(new Error(message), { status });
}

export function createChatAttachmentSender({ fetchImpl = (...args) => fetch(...args), timeoutMs = 25000 } = {}) {
    async function post(url, options, sendingMessage) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const ambiguous = sendingMessage ? 'uncertain' : 'rejected';
        try {
            const response = await fetchImpl(url, { ...options, credentials: 'include', signal: controller.signal });
            if (!response.ok) {
                throw failure(`FunPay: HTTP ${response.status}.`, response.status >= 500 ? ambiguous : 'rejected');
            }
            let json;
            try { json = await response.json(); }
            catch (_) { throw failure('FunPay вернул нечитаемый ответ. Проверьте вход на сайт.', ambiguous); }
            if (!json || typeof json !== 'object' || Array.isArray(json)) throw failure('FunPay вернул пустой ответ.', ambiguous);
            const error = json.error || json.response?.error;
            if (error) throw failure(typeof error === 'string' ? error : 'FunPay отклонил отправку.');
            if (json.url || json.response?.url) throw failure('FunPay требует открыть сайт и проверить вход в аккаунт.');
            return json;
        } catch (error) {
            if (error.status) throw error;
            throw failure(error.name === 'AbortError' ? 'FunPay не ответил вовремя.' : (error.message || 'Ошибка сети.'), ambiguous);
        } finally {
            clearTimeout(timer);
        }
    }

    function validate(chatId, auth) {
        if (!/^(?:\d+|users-\d+-\d+)$/.test(String(chatId || ''))) throw failure('Не удалось определить чат.');
        if (!auth?.csrf_token) throw failure('Нет авторизации для отправки. Обновите страницу FunPay.');
    }

    async function sendMessage(chatId, content, imageId, auth, beforeSend) {
        await beforeSend();
        const data = { node: String(chatId), last_message: -1, content };
        if (imageId) data.image_id = imageId;
        const json = await post('https://funpay.com/runner/', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' },
            body: new URLSearchParams({
                objects: JSON.stringify([{ type: 'chat_node', id: String(chatId), tag: '00000000', data: { node: String(chatId), last_message: -1, content: '' } }]),
                request: JSON.stringify({ action: 'chat_message', data }),
                csrf_token: auth.csrf_token
            })
        }, true);
        if (!Array.isArray(json.objects) && !Object.hasOwn(json, 'response')) throw failure('FunPay не подтвердил принятие сообщения. Проверьте чат.', 'uncertain');
        return { status: 'accepted' };
    }

    async function sendImage({ chatId, dataUrl, fileName, auth, beforeSend = async () => {} }) {
        validate(chatId, auth);
        if (typeof dataUrl !== 'string' || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)) throw failure('Некорректное изображение.');
        if (dataUrl.length > Math.ceil(CHAT_IMAGE_MAX_BYTES / 3) * 4 + 128) throw failure('Изображение больше 7 МБ.');
        const blob = await (await fetchImpl(dataUrl)).blob();
        if (!blob.size || blob.size > CHAT_IMAGE_MAX_BYTES) throw failure('Изображение пустое или больше 7 МБ.');
        await beforeSend();
        const form = new FormData();
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[blob.type] || 'png';
        form.append('file', blob, fileName || `image.${extension}`);
        const upload = await post('https://funpay.com/file/addChatImage', {
            method: 'POST', headers: { 'x-requested-with': 'XMLHttpRequest' }, body: form
        }, false);
        if (!['number', 'string'].includes(typeof upload.fileId) || !String(upload.fileId || '').trim()) throw failure('FunPay не вернул ID загруженного изображения.');
        const result = await sendMessage(chatId, '', upload.fileId, auth, beforeSend);
        return { ...result, fileId: upload.fileId };
    }

    async function sendText({ chatId, text, auth, beforeSend = async () => {} }) {
        validate(chatId, auth);
        if (!String(text || '').trim()) throw failure('Пустое сообщение.');
        return sendMessage(chatId, String(text), null, auth, beforeSend);
    }
    return Object.freeze({ sendImage, sendText });
}
