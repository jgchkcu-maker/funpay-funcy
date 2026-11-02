// content/features/buyer_history.js

function bhEsc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let _bhCache = {};

async function loadBuyerHistory(buyerUsername) {
    if (!buyerUsername) return [];
    const cached = _bhCache[buyerUsername];
    if (cached && Date.now() - cached.t < 5 * 60 * 1000) return cached.orders;

    try {
        const allOrders = await FPTSalesDB.getAllAsArray();
        const localOrders = allOrders
            .filter(o => o.buyerUsername && o.buyerUsername.toLowerCase() === buyerUsername.toLowerCase())
            .sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0))
            .slice(0, 30)
            .map(o => ({
                orderId: o.orderId,
                desc: o.description || o.subcategoryName || '',
                price: o.price ? `${o.price} ${o.currency || '₽'}` : '',
                date: o.orderDateText || o.orderDate || ''
            }));
        if (localOrders.length > 0) {
            _bhCache[buyerUsername] = { orders: localOrders, t: Date.now() };
            return localOrders;
        }
    } catch (_) {}

    try {
        const url = `https://funpay.com/orders/trade?buyer=${encodeURIComponent(buyerUsername)}`;
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        if (!res.ok) return [];
        const html = await res.text();

        const orders = await Promise.race([
            new Promise(r => chrome.runtime.sendMessage(
                { target: 'offscreen', action: 'parseBuyerHistory', html, buyerUserId: buyerUsername },
                d => r(d || [])
            )),
            new Promise(r => setTimeout(() => r([]), 8000))
        ]);

        if (orders.length > 0) {
            _bhCache[buyerUsername] = { orders, t: Date.now() };
        }
        return orders;
    } catch (_) { return []; }
}

function renderHistoryPanel(orders, name, anchor) {
    document.getElementById('fp-buyer-hist-panel')?.remove();

    const total = orders.reduce((s, o) => {
        const num = parseFloat((o.price || '').replace(/[^\d.]/g, ''));
        return s + (isNaN(num) ? 0 : num);
    }, 0);

    const panel = document.createElement('div');
    panel.id = 'fp-buyer-hist-panel';
    panel.className = 'fp-buyer-hist-panel';

    panel.innerHTML = `
        <div class="fp-bh-header">
            <div class="fp-bh-title">
                <span class="fp-bh-icon">📦</span>
                <span>История покупок <strong>${bhEsc(name)}</strong></span>
            </div>
            <button class="fp-bh-close" title="Закрыть">✕</button>
        </div>
        <div class="fp-bh-meta">${orders.length} заказ${orders.length === 1 ? '' : (orders.length < 5 ? 'а' : 'ов')} · ~${Math.round(total).toLocaleString('ru')} ₽</div>
        <div class="fp-bh-list">
            ${orders.filter(o => /^[A-Z0-9]{8}$/.test(String(o.orderId))).slice(0, 20).map(o => `
                <a href="https://funpay.com/orders/${o.orderId}/" target="_blank" class="fp-bh-item">
                    <div class="fp-bh-item-desc">${bhEsc(o.desc || o.orderId)}</div>
                    <div class="fp-bh-item-meta">
                        <span class="fp-bh-price">${bhEsc(o.price)}</span>
                        <span class="fp-bh-dot">·</span>
                        <span class="fp-bh-date">${bhEsc(o.date)}</span>
                    </div>
                </a>`).join('')}
        </div>`;

    panel.querySelector('.fp-bh-close').addEventListener('click', () => panel.remove());
    anchor.style.position = 'relative';
    anchor.appendChild(panel);

    setTimeout(() => {
        const handler = (e) => {
            if (!panel.contains(e.target) && !e.target.closest('#fp-buyer-hist-menu-btn')) {
                panel.remove();
                document.removeEventListener('click', handler);
            }
        };
        document.addEventListener('click', handler);
    }, 0);
}

// ─── Translation engine (Unified background service worker transport) ───────

let _chatEpoch = 1;
const _translationRequests = new WeakMap();

// explicit: the user clicked a translate button. Background translation (dialog mode)
// does not re-open the consent window after the user declined it.
async function checkTranslateConsent({ explicit = true } = {}) {
    return !!(await window.FPTTranslateConsent?.ensure({ explicit }));
}

function bumpChatEpoch() {
    _chatEpoch++;
    document.querySelectorAll('[data-fp-trans-state="pending"]').forEach(clearMessageTranslation);
}

function extractCleanMessageText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    // .fpt-reply-rest contains the actual reply, not translation UI.
    clone.querySelectorAll('.fp-trans-wrap, .fpt-reply-card').forEach(n => n.remove());
    return clone.textContent.trim();
}

function renderTranslationBlock(textEl, translatedText) {
    textEl.querySelectorAll('.fp-trans-wrap').forEach(w => w.remove());
    if (!translatedText || !translatedText.trim()) return;

    const wrap = document.createElement('div');
    wrap.className = 'fp-trans-wrap';
    const divider = document.createElement('div');
    divider.className = 'fp-trans-divider';
    const textDiv = document.createElement('div');
    textDiv.className = 'fp-trans-text';
    textDiv.textContent = translatedText;
    wrap.appendChild(divider);
    wrap.appendChild(textDiv);
    textEl.appendChild(wrap);
}

function renderTranslationError(textEl, message) {
    textEl.querySelectorAll('.fp-trans-wrap').forEach(w => w.remove());
    const wrap = document.createElement('div');
    wrap.className = 'fp-trans-wrap fp-trans-error';
    const divider = document.createElement('div');
    divider.className = 'fp-trans-divider';
    const textDiv = document.createElement('div');
    textDiv.className = 'fp-trans-text fp-trans-error-text';
    textDiv.textContent = `(Перевод: ${message})`;
    wrap.appendChild(divider);
    wrap.appendChild(textDiv);
    textEl.appendChild(wrap);
}

function clearMessageTranslation(textEl) {
    _translationRequests.delete(textEl);
    textEl.querySelectorAll('.fp-trans-wrap').forEach(w => w.remove());
    delete textEl.dataset.fpTransState;
}

async function translateMessageElement(textEl, { force = false } = {}) {
    if (!textEl) return false;
    const currentState = textEl.dataset.fpTransState;
    if (currentState === 'pending' || (!force && currentState === 'done')) {
        return false;
    }

    const orig = extractCleanMessageText(textEl);
    if (!orig || orig.length < 2) return false;

    const epoch = _chatEpoch;
    const request = {};
    _translationRequests.set(textEl, request);
    textEl.dataset.fpTransState = 'pending';
    const isCurrent = () => epoch === _chatEpoch
        && _translationRequests.get(textEl) === request
        && textEl.isConnected
        && extractCleanMessageText(textEl) === orig;

    try {
        const allowed = await checkTranslateConsent({ explicit: force });
        if (!isCurrent()) return false;
        if (!allowed) {
            clearMessageTranslation(textEl);
            return false;
        }
        const response = await chrome.runtime.sendMessage({
            action: 'translateChatText',
            text: orig,
            target: 'ru'
        });

        if (!isCurrent()) {
            return false;
        }

        if (response && response.success) {
            const translated = response.text ? response.text.trim() : '';
            textEl.dataset.fpTransState = 'done';
            if (translated && translated !== orig) {
                renderTranslationBlock(textEl, translated);
            } else {
                textEl.querySelectorAll('.fp-trans-wrap').forEach(w => w.remove());
            }
            return true;
        } else {
            textEl.dataset.fpTransState = 'error';
            renderTranslationError(textEl, response?.error || 'Не удалось перевести');
            return false;
        }
    } catch (err) {
        if (!isCurrent()) return false;
        textEl.dataset.fpTransState = 'error';
        renderTranslationError(textEl, err.message || 'Ошибка сети при переводе');
        return false;
    }
}

// Backward-compatible translateText wrapper
async function translateText(text) {
    if (!text || !text.trim()) return null;
    try {
        if (!(await checkTranslateConsent())) return null;
        const res = await chrome.runtime.sendMessage({
            action: 'translateChatText',
            text: text.trim(),
            target: 'ru'
        });
        if (res && res.success && res.text) {
            return res.text === text ? null : res.text;
        }
        return null;
    } catch (_) {
        return null;
    }
}

window.FPTChatTranslate = Object.freeze({
    translateMessageElement,
    clearMessageTranslation,
    extractCleanMessageText,
    bumpChatEpoch,
    checkTranslateConsent,
    renderTranslationBlock,
    renderTranslationError
});

async function appendTranslation(msgTextEl) {
    return translateMessageElement(msgTextEl);
}

function removeAllTranslations() {
    document.querySelectorAll('.fp-trans-wrap').forEach(el => el.remove());
    document.querySelectorAll('[data-fp-trans-state]').forEach(clearMessageTranslation);
    document.querySelectorAll('[data-fp-trans-done]').forEach(el => delete el.dataset.fpTransDone);
}

let _translateMode = false;
let _chatObserver  = null;

function startRealtimeTranslation() {
    const list = document.querySelector('.chat-message-list');
    if (!list) return;

    if (_chatObserver) {
        _chatObserver.disconnect();
        _chatObserver = null;
    }

    list.querySelectorAll('.chat-msg-text').forEach(el => {
        translateMessageElement(el);
    });

    _chatObserver = new MutationObserver((muts) => {
        if (!_translateMode) return;
        for (const mut of muts) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                const els = node.matches?.('.chat-msg-text')
                    ? [node]
                    : [...(node.querySelectorAll?.('.chat-msg-text') || [])];
                els.forEach(el => translateMessageElement(el));
            }
        }
    });
    _chatObserver.observe(list, { childList: true, subtree: true });
}

function stopRealtimeTranslation() {
    bumpChatEpoch();
    _chatObserver?.disconnect();
    _chatObserver = null;
    removeAllTranslations();
}

// Reset and invalidate on contact/chat click
document.addEventListener('click', (e) => {
    if (e.target.closest('.contact-item')) {
        bumpChatEpoch();
        if (_translateMode) {
            removeAllTranslations();
            _chatObserver?.disconnect();
            _chatObserver = null;
            setTimeout(() => {
                if (_translateMode) startRealtimeTranslation();
            }, 350);
        }
    }
});

(function injectTranslateStyles() {
    if (document.getElementById('fp-trans-styles')) return;
    const s = document.createElement('style');
    s.id = 'fp-trans-styles';
    s.textContent = `
        .fp-trans-divider {
            margin: 5px 0 4px;
            border-top: 1px solid rgba(255,255,255,0.08);
        }
        .fp-trans-text {
            color: rgba(200,202,220,0.65);
            font-size: 0.92em;
            line-height: 1.4;
            word-break: break-word;
        }
        .fp-trans-error-text {
            color: rgba(255,120,120,0.85);
            font-style: italic;
        }
    `;
    document.head.appendChild(s);
})();

// ─── Внедрение кнопок в НАСТОЯЩЕЕ ТРОЕТОЧИЕ FunPay ────────────────────────────

function attachChatMenuItems(chatHeader) {
    if (!chatHeader || chatHeader.dataset.fpHistAttached) return;

    const chatEl = chatHeader.closest(".chat") || chatHeader.parentElement?.closest(".chat");
    const buyerName = chatHeader.dataset?.fptBuyer
        || chatHeader.dataset?.userName
        || chatEl?.dataset?.fptBuyer
        || chatHeader.querySelector('.media-user-name a')?.textContent.trim()
        || '';

    const tryInject = () => {
        const menu = chatHeader.querySelector('.dropdown-menu');
        if (!menu) { setTimeout(tryInject, 200); return; }
        if (menu.querySelector('#fp-buyer-hist-menu-btn')) return;

        chatHeader.dataset.fpHistAttached = 'true';

        menu.insertAdjacentHTML('beforeend', '<li class="divider" style="margin:4px 0;"></li>');

        // 1. История покупок
        const histLi = document.createElement('li');
        histLi.innerHTML = '<a href="#" id="fp-buyer-hist-menu-btn">📦 История покупок</a>';
        histLi.querySelector('a').addEventListener('click', async (e) => {
            e.preventDefault();
            const a = e.currentTarget;
            const _ulink = chatHeader.querySelector('.media-user-name a[href*="/users/"]');
            const _name = _ulink ? _ulink.textContent.trim() : '';
            if (!_name) { if (typeof showNotification === 'function') showNotification('Не удалось определить покупателя'); return; }
            document.getElementById('fp-buyer-hist-panel')?.remove();
            a.textContent = '⏳ Загрузка...';
            const orders = await loadBuyerHistory(_name);
            a.textContent = '📦 История покупок';
            if (!orders || !orders.length) {
                if (typeof showNotification === 'function') showNotification('Покупок у этого покупателя не найдено');
                return;
            }
            renderHistoryPanel(orders, _name, chatHeader);
        });
        menu.appendChild(histLi);

        // 2. Режим перевода
        const transLi = document.createElement('li');
        transLi.innerHTML = '<a href="#" id="fp-translate-menu-btn">🌐 Включить перевод</a>';
        transLi.querySelector('a').addEventListener('click', async (e) => {
            e.preventDefault();
            const a = e.currentTarget;
            // Ask before the mode starts, so declining leaves the chat untouched.
            if (!_translateMode && !(await checkTranslateConsent())) return;
            _translateMode = !_translateMode;
            if (_translateMode) {
                a.textContent = '🌐 Выключить перевод';
                startRealtimeTranslation();
            } else {
                a.textContent = '🌐 Включить перевод';
                stopRealtimeTranslation();
            }
        });
        menu.appendChild(transLi);

        // 3. Экспорт чата
        const exportLi = document.createElement('li');
        exportLi.innerHTML = '<a href="#" id="fp-export-chat-menu-btn">💾 Экспортировать чат</a>';
        exportLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            const msgs = [];
            let lastAuthor = '';
            document.querySelectorAll('.chat-msg-item').forEach(item => {
                const authorEl = item.querySelector('.chat-msg-author-link');
                if (authorEl) lastAuthor = authorEl.textContent.trim();
                const author = lastAuthor || 'Собеседник';
                const textEl = item.querySelector('.chat-msg-text');
                const text = extractCleanMessageText(textEl);
                const dateEl = item.querySelector('.chat-msg-date');
                const date = dateEl ? (dateEl.textContent.trim() || dateEl.getAttribute('title')?.trim() || '') : '';
                if (text) msgs.push(date ? `[${date}] ${author}: ${text}` : `${author}: ${text}`);
            });
            if (!msgs.length) { if (typeof showNotification === 'function') showNotification('Нет сообщений для экспорта', true); return; }
            const partner = chatHeader.querySelector('.media-user-name a')?.textContent.trim() || 'chat';
            const dateStr = new Date().toISOString().slice(0, 10);
            const blob = new Blob([msgs.join('\n')], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `funpay_chat_${partner}_${dateStr}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
            if (typeof showNotification === 'function') showNotification('Чат экспортирован ✓');
        });
        menu.appendChild(exportLi);

        // 4. Добавить / удалить из ЧС
        const blLi = document.createElement('li');
        const blA = document.createElement('a');
        blA.href = '#';
        blA.id = 'fp-blacklist-menu-btn';
        blA.style.color = '#ff5c5c';
        blLi.appendChild(blA);

        const syncBlText = async () => {
            const inList = (typeof isInBlacklist === 'function') ? await isInBlacklist(buyerName) : false;
            blA.textContent = inList ? '✅ Удалить из ЧС' : '🚫 Добавить в ЧС';
            blA.style.color = inList ? '#5cff8f' : '#ff5c5c';
        };
        syncBlText();

        blA.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof isInBlacklist !== 'function' || typeof addToBlacklistFromChat !== 'function') {
                if (typeof showNotification === 'function') showNotification('Модуль чёрного списка загружается...', true);
                return;
            }
            const inList = await isInBlacklist(buyerName);
            if (inList) {
                await removeFromBlacklistByName(buyerName);
            } else {
                await addToBlacklistFromChat(buyerName);
            }
            await syncBlText();
        });

        // Обновляем подпись при каждом открытии меню (чат меняется, состояние ЧС тоже).
        const blToggleBtn = chatHeader.querySelector('[data-toggle="dropdown"]');
        if (blToggleBtn && !blToggleBtn.dataset.fpBlSyncBound) {
            blToggleBtn.dataset.fpBlSyncBound = '1';
            blToggleBtn.addEventListener('click', () => setTimeout(syncBlText, 0));
        }
        document.addEventListener('fpToolsBlacklistUpdated', syncBlText);

        menu.appendChild(blLi);
    };

    tryInject();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let _bhObsActive = false;
function initBuyerHistoryObserver() {
    if (_bhObsActive) return;
    _bhObsActive = true;

    document.querySelectorAll('#fp-buyer-hist-btn').forEach(el => el.remove());
    document.querySelectorAll('.chat-header, .chat-full-header').forEach(attachChatMenuItems);

    const root = document.getElementById('content') || document.body;
    const attachAddedHeaders = (muts) => {
        for (const mut of muts) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                const headers = node.matches?.('.chat-header, .chat-full-header')
                    ? [node]
                    : [...(node.querySelectorAll?.('.chat-header, .chat-full-header') || [])];
                headers.forEach(attachChatMenuItems);
            }
        }
    };
    new MutationObserver(window.fptCoalesce?.(attachAddedHeaders, { records: true, name: 'buyer history' }) || attachAddedHeaders)
        .observe(root, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBuyerHistoryObserver);
} else {
    initBuyerHistoryObserver();
}
