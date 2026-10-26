// content/features/chat_column_resize.js
// Ручки ширины колонок «Модульного чата» на /chat/. Правила раскладки - content/theme_chat_layout.js:
// ширины идут через CSS-переменные, поэтому во время перетаскивания меняется только inline-переменная
// на <html>, а в fpToolsTheme значение пишется один раз, когда кнопку мыши отпустили.
// Двойной клик по ручке - ширина по умолчанию, стрелки на сфокусированной ручке - шаг 8px.

(function (root) {
    'use strict';

    const HANDLE_CLASS = 'fpt-chat-resizer';
    const CONTAINER_CLASS = 'fpt-chat-resizable';
    const KEY_STEP = 8;
    const SIDES = {
        contacts: { key: 'chatContactsWidth', column: '.chat-contacts', variable: '--fpt-chat-contacts-w', label: 'Ширина списка диалогов' },
        detail: { key: 'chatDetailWidth', column: '.chat-detail', variable: '--fpt-chat-detail-w', label: 'Ширина инфо-панели' }
    };

    let container = null;
    let state = { enabled: false, theme: {} };
    let media = null;
    let frame = 0;
    const handles = {};

    function layout() { return root.FPTChatLayout; }

    function resolvedTheme(theme) {
        const baseStyle = typeof fptResolveThemeBaseStyle === 'function' ? fptResolveThemeBaseStyle(theme) : theme.baseStyle;
        return { ...theme, baseStyle };
    }

    function isActive() {
        return !!(container && container.isConnected && layout() && state.enabled
            && state.theme.chatModular === true && media && media.matches);
    }

    function column(side) {
        return container && container.querySelector(`:scope > ${SIDES[side].column}`);
    }

    function visible(element) {
        return !!element && element.getClientRects().length > 0;
    }

    function createHandle(side) {
        const handle = document.createElement('div');
        handle.className = HANDLE_CLASS;
        handle.dataset.side = side;
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', SIDES[side].label);
        handle.title = 'Потяните, чтобы изменить ширину. Двойной клик - сброс';
        bindDrag(handle, side);
        return handle;
    }

    // Ручка лежит в зазоре между колонками. position:absolute, поэтому во flex-раскладке FunPay
    // она не участвует и порядок/отступы колонок не меняет.
    function position() {
        frame = 0;
        if (!isActive()) { removeHandles(); return; }
        container.classList.add(CONTAINER_CLASS);
        const box = container.getBoundingClientRect();
        const chat = container.querySelector(':scope > .chat');
        for (const side of Object.keys(SIDES)) {
            const col = column(side);
            if (!visible(col) || !visible(chat)) {
                if (handles[side]) { handles[side].remove(); delete handles[side]; }
                continue;
            }
            const handle = handles[side] || (handles[side] = createHandle(side));
            if (handle.parentNode !== container) container.appendChild(handle);
            const colRect = col.getBoundingClientRect();
            const chatRect = chat.getBoundingClientRect();
            const x = side === 'contacts' ? (colRect.right + chatRect.left) / 2 : (chatRect.right + colRect.left) / 2;
            handle.style.left = `${x - box.left}px`;
            const width = Math.round(colRect.width);
            handle.setAttribute('aria-valuenow', String(width));
            const [min, max] = layout().LIMITS[SIDES[side].key];
            handle.setAttribute('aria-valuemin', String(min));
            handle.setAttribute('aria-valuemax', String(max));
        }
    }

    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(position);
    }

    function removeHandles() {
        for (const side of Object.keys(handles)) {
            handles[side].remove();
            delete handles[side];
        }
        if (container) container.classList.remove(CONTAINER_CLASS);
    }

    // Колонка не шире своего диапазона и не съедает переписку меньше CHAT_MIN_WIDTH.
    function clampWidth(side, width, base) {
        const { LIMITS, CHAT_MIN_WIDTH } = layout();
        const [min, max] = LIMITS[SIDES[side].key];
        const chat = container.querySelector(':scope > .chat');
        const room = chat ? base.colWidth + chat.getBoundingClientRect().width - CHAT_MIN_WIDTH : max;
        return Math.round(Math.max(min, Math.min(max, room, width)));
    }

    function preview(side, width) {
        document.documentElement.style.setProperty(SIDES[side].variable, `${width}px`);
        schedule();
    }

    async function commit(side, width) {
        const key = SIDES[side].key;
        try {
            const { fpToolsTheme = {} } = await chrome.storage.local.get('fpToolsTheme');
            const theme = { ...fpToolsTheme, [key]: width };
            await chrome.storage.local.set({ fpToolsTheme: theme });
            state.theme = theme;
            // Ранняя копия правил стоит после стиля темы и перекрывает его переменные - пересобирать
            // всю тему ради одной ширины не нужно. theme.js уберёт её при следующем применении темы.
            if (typeof fptInjectChatLayoutPrehide === 'function') fptInjectChatLayoutPrehide(resolvedTheme(theme));
            // Открытая страница темы (theme_page.js) держит черновик - пусть знает новую ширину.
            document.dispatchEvent(new CustomEvent('fpt:chat-column-width', { detail: { key, value: width } }));
        } catch (error) {
            console.warn('Funcy: не удалось сохранить ширину колонки чата', error);
        } finally {
            document.documentElement.style.removeProperty(SIDES[side].variable);
            schedule();
        }
    }

    function bindDrag(handle, side) {
        let drag = null;
        let keyTimer = 0;
        let keyWidth = 0;
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !isActive()) return;
            const col = column(side);
            if (!col) return;
            drag = { startX: event.clientX, colWidth: col.getBoundingClientRect().width, width: null };
            handle.setPointerCapture(event.pointerId);
            handle.dataset.dragging = 'true';
            document.documentElement.classList.add('fpt-chat-resizing');
            event.preventDefault();
        });
        handle.addEventListener('pointermove', event => {
            if (!drag) return;
            const delta = event.clientX - drag.startX;
            // Инфо-панель справа: тянем ручку влево - панель шире.
            const raw = drag.colWidth + (side === 'contacts' ? delta : -delta);
            drag.width = clampWidth(side, raw, drag);
            preview(side, drag.width);
        });
        const endDrag = () => {
            if (!drag) return;
            const { width } = drag;
            drag = null;
            delete handle.dataset.dragging;
            document.documentElement.classList.remove('fpt-chat-resizing');
            if (width != null) commit(side, width);
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
        handle.addEventListener('dblclick', () => {
            if (!isActive()) return;
            const fallback = layout().LIMITS[SIDES[side].key][2];
            preview(side, fallback);
            commit(side, fallback);
        });
        handle.addEventListener('keydown', event => {
            if (!isActive() || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
            const col = column(side);
            if (!col) return;
            event.preventDefault();
            const grow = (event.key === 'ArrowRight') === (side === 'contacts');
            const base = keyTimer ? keyWidth : col.getBoundingClientRect().width;
            keyWidth = clampWidth(side, base + (grow ? KEY_STEP : -KEY_STEP), { colWidth: col.getBoundingClientRect().width });
            preview(side, keyWidth);
            clearTimeout(keyTimer);
            keyTimer = setTimeout(() => { keyTimer = 0; commit(side, keyWidth); }, 400);
        });
    }

    async function loadState() {
        try {
            const { enableCustomTheme = false, fpToolsTheme = {} } = await chrome.storage.local.get(['enableCustomTheme', 'fpToolsTheme']);
            state = { enabled: enableCustomTheme === true, theme: fpToolsTheme || {} };
        } catch (_) { /* контекст расширения обновлён - ручки просто не появятся */ }
        schedule();
    }

    function init() {
        container = document.querySelector('.chat-full');
        if (!container || !layout()) return;
        media = window.matchMedia(layout().DESKTOP_MEDIA);
        media.addEventListener('change', schedule);
        // Ширина колонок меняется и без смены размера контейнера (применили тему, скрыли панель),
        // поэтому следим за каждой колонкой.
        const sizes = new ResizeObserver(schedule);
        const observeColumns = () => {
            sizes.disconnect();
            sizes.observe(container);
            container.querySelectorAll(':scope > .chat-contacts, :scope > .chat, :scope > .chat-detail').forEach(el => sizes.observe(el));
        };
        observeColumns();
        // FunPay перерисовывает колонки при смене диалога - переподписываемся и двигаем ручки.
        new MutationObserver(mutations => {
            if (!mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(n => !n.classList?.contains(HANDLE_CLASS)))) return;
            observeColumns();
            schedule();
        }).observe(container, { childList: true });
        window.addEventListener('resize', schedule);
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.fpToolsTheme || changes.enableCustomTheme)) loadState();
        });
        loadState();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
