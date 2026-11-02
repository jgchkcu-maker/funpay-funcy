// background/translate.js
// Единая очередь и транспорт перевода лотов и чатов.

const MIN_INTERVAL_MS = 300;
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];
const MAX_AUTO_WAIT_MS = 10000;

let queue = [];
let active = false;
let lastRequestFinishedAt = 0;
let nextRequestAt = 0;
const inFlight = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfter(headerValue) {
    if (!headerValue) return null;
    const trimmed = headerValue.trim();
    const seconds = Number(trimmed);
    if (!Number.isNaN(seconds) && seconds >= 0) {
        return Number.isFinite(seconds) ? seconds * 1000 : null;
    }
    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        return Math.max(0, diff);
    }
    return null;
}

async function fetchTranslateRequest(text, target) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='
        + encodeURIComponent(target || 'ru') + '&dt=t&q=' + encodeURIComponent(text);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // A server cooldown applies to every queued item. Long cooldowns fail
        // visibly instead of holding a runtime message open or retrying early.
        const waitMs = nextRequestAt - Date.now();
        if (waitMs > MAX_AUTO_WAIT_MS) {
            throw new Error(`Сервис перевода временно недоступен. Повторите через ${Math.ceil(waitMs / 1000)} с.`);
        }
        if (waitMs > 0) await sleep(waitMs);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        nextRequestAt = Date.now() + MIN_INTERVAL_MS;

        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) {
                const error = new Error(res.status === 429
                    ? 'Слишком много запросов к переводчику (429). Повторите позже.'
                    : `Ошибка сервиса перевода (HTTP ${res.status}).`);
                error.retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
                if (error.retryable) {
                    const serverDelay = parseRetryAfter(res.headers?.get('retry-after'));
                    nextRequestAt = Math.max(nextRequestAt, Date.now()
                        + Math.max(serverDelay || 0, RETRY_DELAYS[attempt] || 3000));
                }
                throw error;
            }

            const json = await res.json();
            if (!Array.isArray(json?.[0]) || !json[0].length
                || !json[0].every(s => Array.isArray(s) && typeof s[0] === 'string')) {
                throw new Error('Сервис перевода вернул неверный ответ.');
            }
            return json[0].map(s => s[0]).join('');
        } catch (err) {
            const timedOut = err.name === 'AbortError';
            const networkError = err.name === 'TypeError';
            const retryable = err.retryable === true || timedOut || networkError;
            if (!retryable || attempt >= MAX_RETRIES) {
                if (timedOut) throw new Error('Превышено время ожидания ответа переводчика (15 с).');
                if (networkError) throw new Error('Ошибка сети при обращении к сервису перевода.');
                throw err;
            }
            nextRequestAt = Math.max(nextRequestAt, Date.now() + RETRY_DELAYS[attempt]);
        } finally {
            clearTimeout(timer);
        }
    }
}

async function processQueue() {
    if (active || queue.length === 0) return;
    active = true;

    const item = queue.shift();
    try {
        const elapsed = Date.now() - lastRequestFinishedAt;
        if (elapsed < MIN_INTERVAL_MS) {
            await sleep(MIN_INTERVAL_MS - elapsed);
        }

        const translated = await fetchTranslateRequest(item.text, item.target);
        lastRequestFinishedAt = Date.now();
        item.resolve({ success: true, text: translated });
    } catch (err) {
        lastRequestFinishedAt = Date.now();
        item.resolve({ success: false, error: err.message || 'Ошибка перевода' });
    } finally {
        active = false;
        processQueue();
    }
}

export function enqueueTranslation(text, target = 'ru') {
    const raw = String(text ?? '');
    if (!raw.trim()) {
        return Promise.resolve({ success: true, text: raw });
    }

    const key = `${target}:${raw}`;
    if (inFlight.has(key)) {
        return inFlight.get(key);
    }

    const promise = new Promise((resolve) => {
        queue.push({ key, text: raw, target, resolve });
        processQueue();
    }).finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
}

// Set by content/features/translate_consent.js when the user presses «Разрешить».
const CONSENT_KEY = 'fpToolsTranslateConsentAt';
const CONSENT_ERROR = 'Перевод не разрешён: подтвердите передачу текста Google Translate.';

async function hasConsent() {
    try {
        const stored = await chrome.storage.local.get(CONSENT_KEY);
        return Number(stored?.[CONSENT_KEY]) > 0;
    } catch (_) {
        return false;
    }
}

export async function translateChatText(text, target = 'ru') {
    if (!(await hasConsent())) return { success: false, consentRequired: true, error: CONSENT_ERROR };
    try {
        const result = await enqueueTranslation(text, target);
        return result;
    } catch (err) {
        return { success: false, error: err.message || 'Ошибка перевода' };
    }
}

async function translatePreserveLines(text, target = 'en') {
    if (typeof text !== 'string' || !text.trim()) return text || '';
    const lines = text.split('\n');
    const out = [];
    for (const line of lines) {
        if (!line.trim()) {
            out.push(line);
            continue;
        }
        const res = await enqueueTranslation(line, target);
        if (res.success && res.text != null) {
            out.push(res.text);
        } else {
            throw new Error(res.error || 'Не удалось перевести поле лота.');
        }
    }
    return out.join('\n');
}

export async function translateLotFields(data) {
    const { title, description, buyerMessage } = data || {};
    if (!(await hasConsent())) return { success: false, consentRequired: true, error: CONSENT_ERROR };
    try {
        const tTitle = await translatePreserveLines(title || '', 'en');
        const tDesc = await translatePreserveLines(description || '', 'en');
        const tBuyer = await translatePreserveLines(buyerMessage || '', 'en');
        return {
            success: true,
            data: {
                title: tTitle,
                description: tDesc,
                buyerMessage: tBuyer,
            },
        };
    } catch (e) {
        return { success: false, error: 'Ошибка перевода: ' + (e.message || String(e)) };
    }
}
