// content/ui/page_windows.js
// Shell for the windows the extension opens on FunPay pages: lot copy and import, the price
// editor, generators, the label manager and so on. Every window gets the extension menu's
// palette (fptApplyMenuTheme from content/ui/menu_theme.js) and the shared look from
// css/page_windows.css, closes on Escape, the close button or a backdrop click, keeps Tab
// inside itself and returns focus to where it was opened from.
(function (root) {
    'use strict';
    if (root.fptWindow) return;

    const CLOSE_MS = 170;
    const stack = [];
    let idSeq = 0;
    const FOCUSABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function node(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = String(text);
        return el;
    }

    function icon(name, className = '') {
        const el = node('span', `material-symbols-rounded${className ? ` ${className}` : ''}`, name);
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    function state(scrim) {
        if (!scrim._fptWin) scrim._fptWin = { onClose: null, dismissible: true, removeOnClose: false, timer: null, previousFocus: null };
        return scrim._fptWin;
    }

    // Paints the scrim with the menu palette: light or dark like the extension menu, violet accent.
    function theme(scrim) {
        if (!scrim) return scrim;
        scrim.classList.add('fpt-win-scrim');
        try {
            if (typeof root.fptApplyMenuTheme === 'function') root.fptApplyMenuTheme(scrim);
            else scrim.classList.add('fptm-themed', 'fptm-light');
        } catch (_) { /* fallback tokens live in css/page_windows.css */ }
        return scrim;
    }

    // Palette only, for floating panels and menus that are not windows (side panels, context menus).
    function paint(el) {
        if (!el) return el;
        try { if (typeof root.fptApplyMenuTheme === 'function') root.fptApplyMenuTheme(el); } catch (_) {}
        return el;
    }

    function dialogOf(scrim) {
        return scrim.querySelector('.fpt-win') || scrim.firstElementChild || scrim;
    }

    function focusable(scrim) {
        return Array.from(dialogOf(scrim).querySelectorAll(FOCUSABLE))
            .filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
    }

    // Windows removed from the page while open (a list reopened with fresh data) leave the stack.
    function top() {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (!stack[i].isConnected) stack.splice(i, 1);
        }
        if (!stack.length) document.removeEventListener('keydown', onKeyDown, true);
        return stack[stack.length - 1] || null;
    }

    function onKeyDown(event) {
        const scrim = top();
        if (!scrim) return;
        if (event.key === 'Escape') {
            if (event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            if (state(scrim).dismissible) close(scrim);
            return;
        }
        if (event.key !== 'Tab') return;
        const items = focusable(scrim);
        const dialog = dialogOf(scrim);
        if (!items.length) {
            event.preventDefault();
            dialog.focus({ preventScroll: true });
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !dialog.contains(active))) {
            event.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
            event.preventDefault();
            first.focus({ preventScroll: true });
        }
    }

    // Closes on a click that both starts and ends on the backdrop, so selecting text in a
    // field and releasing the mouse outside the window does not throw the work away.
    function wireBackdrop(scrim) {
        if (scrim._fptWinBackdrop) return;
        scrim._fptWinBackdrop = true;
        let downOnScrim = false;
        scrim.addEventListener('pointerdown', event => { downOnScrim = event.target === scrim; });
        scrim.addEventListener('click', event => {
            const fromScrim = downOnScrim && event.target === scrim;
            downOnScrim = false;
            if (fromScrim && state(scrim).dismissible) close(scrim);
        });
    }

    function open(scrim, options = {}) {
        if (!scrim) return scrim;
        const st = state(scrim);
        if (options.onClose !== undefined) st.onClose = options.onClose;
        if (options.dismissible !== undefined) st.dismissible = options.dismissible !== false;
        if (options.removeOnClose !== undefined) st.removeOnClose = !!options.removeOnClose;
        clearTimeout(st.timer);
        theme(scrim);
        wireBackdrop(scrim);
        if (!scrim.isConnected) document.body.appendChild(scrim);
        scrim.style.removeProperty('display');
        scrim.classList.remove('is-closing');
        const wasOpen = scrim.classList.contains('is-open') && stack.includes(scrim);
        scrim.classList.add('is-open');
        if (!wasOpen) {
            st.previousFocus = document.activeElement;
            const at = stack.indexOf(scrim);
            if (at >= 0) stack.splice(at, 1);
            stack.push(scrim);
            document.addEventListener('keydown', onKeyDown, true);
            const target = options.focus || dialogOf(scrim);
            const focus = () => { if (scrim.classList.contains('is-open')) target?.focus?.({ preventScroll: true }); };
            if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(focus);
            else setTimeout(focus, 0);
        }
        return scrim;
    }

    function close(scrim, options = {}) {
        if (!scrim || !scrim.classList.contains('is-open') || scrim.classList.contains('is-closing')) return false;
        const st = state(scrim);
        const at = stack.indexOf(scrim);
        if (at >= 0) stack.splice(at, 1);
        if (!stack.length) document.removeEventListener('keydown', onKeyDown, true);
        const remove = options.remove ?? st.removeOnClose;
        const finish = () => {
            scrim.classList.remove('is-open', 'is-closing');
            if (remove) scrim.remove();
        };
        const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (options.immediate || reduced) finish();
        else {
            scrim.classList.add('is-closing');
            st.timer = setTimeout(finish, CLOSE_MS);
        }
        const previous = st.previousFocus;
        st.previousFocus = null;
        if (previous && typeof previous.focus === 'function' && previous.isConnected) {
            try { previous.focus({ preventScroll: true }); } catch (_) {}
        }
        const onClose = st.onClose;
        if (typeof onClose === 'function') {
            try { onClose(); } catch (error) { console.error('FunPay Funcy: window onClose failed', error); }
        }
        return true;
    }

    function isOpen(scrim) {
        return !!scrim && scrim.classList.contains('is-open') && !scrim.classList.contains('is-closing');
    }

    // Builds a window: scrim > .fpt-win > head (emblem, title, subtitle, close) + body + foot.
    // Ids keep the selectors existing feature code relies on.
    function create(options = {}) {
        const {
            id, dialogId, bodyId, footId, title = '', subtitle = '', icon: iconName = '',
            size = 'md', tall = false, footer = true, flushBody = false,
            onClose = null, dismissible = true, removeOnClose = false, closeId = ''
        } = options;
        const scrim = node('div', 'fpt-win-scrim');
        if (id) scrim.id = id;
        const dialog = node('section', `fpt-win fpt-win--${size}${tall ? ' fpt-win--tall' : ''}`);
        if (dialogId) dialog.id = dialogId;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.tabIndex = -1;

        const head = node('div', 'fpt-win-head');
        if (iconName) {
            const emblem = node('span', 'fpt-win-emblem');
            emblem.appendChild(icon(iconName));
            head.appendChild(emblem);
        }
        const heading = node('div', 'fpt-win-heading');
        const titleEl = node('h2', 'fpt-win-title', title);
        titleEl.id = `fpt-win-title-${++idSeq}`;
        dialog.setAttribute('aria-labelledby', titleEl.id);
        heading.appendChild(titleEl);
        const subtitleEl = node('p', 'fpt-win-sub', subtitle);
        subtitleEl.hidden = !subtitle;
        heading.appendChild(subtitleEl);
        head.appendChild(heading);

        const closeButton = node('button', 'fpt-win-close');
        closeButton.type = 'button';
        if (closeId) closeButton.id = closeId;
        closeButton.setAttribute('aria-label', 'Закрыть');
        closeButton.title = 'Закрыть';
        closeButton.appendChild(icon('close'));
        head.appendChild(closeButton);

        const body = node('div', `fpt-win-body${flushBody ? ' fpt-win-body--flush' : ''}`);
        if (bodyId) body.id = bodyId;
        dialog.append(head, body);
        let foot = null;
        if (footer) {
            foot = node('div', 'fpt-win-foot');
            if (footId) foot.id = footId;
            dialog.appendChild(foot);
        }
        scrim.appendChild(dialog);

        const st = state(scrim);
        st.onClose = onClose;
        st.dismissible = dismissible !== false;
        st.removeOnClose = !!removeOnClose;
        closeButton.addEventListener('click', () => close(scrim));
        theme(scrim);
        wireBackdrop(scrim);

        return {
            scrim, dialog, head, body, foot, closeButton, titleEl, subtitleEl,
            open: (opts) => open(scrim, opts),
            close: (opts) => close(scrim, opts),
            isOpen: () => isOpen(scrim),
            setTitle(text) { titleEl.textContent = String(text ?? ''); },
            setSubtitle(text) { subtitleEl.textContent = String(text ?? ''); subtitleEl.hidden = !text; }
        };
    }

    // Small builders so feature code does not repeat the markup of shared controls.
    function button(label, { kind = '', size = '', iconName = '', id = '', type = 'button', title = '' } = {}) {
        const el = node('button', ['fpt-win-btn', kind && `fpt-win-btn--${kind}`, size && `fpt-win-btn--${size}`].filter(Boolean).join(' '));
        el.type = type;
        if (id) el.id = id;
        if (title) el.title = title;
        if (iconName) el.appendChild(icon(iconName));
        if (label) el.appendChild(document.createTextNode(String(label)));
        return el;
    }

    function checkbox(label, { id = '', checked = false, className = '' } = {}) {
        const wrap = node('label', `fpt-win-check${className ? ` ${className}` : ''}`);
        const input = node('input');
        input.type = 'checkbox';
        if (id) input.id = id;
        input.checked = !!checked;
        const box = node('span', 'fpt-win-check-box');
        box.setAttribute('aria-hidden', 'true');
        wrap.append(input, box, node('span', 'fpt-win-check-text', label));
        return { element: wrap, input };
    }

    // The same checkbox as an HTML string, for windows rendered with template literals.
    function checkboxHtml(label, { id = '', checked = false, extra = '' } = {}) {
        const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        return `<label class="fpt-win-check"><input type="checkbox"${id ? ` id="${esc(id)}"` : ''}${checked ? ' checked' : ''}${extra ? ` ${extra}` : ''}><span class="fpt-win-check-box" aria-hidden="true"></span><span class="fpt-win-check-text">${esc(label)}</span></label>`;
    }

    // Segmented tabs: buttons carry data-tab, panes carry data-pane.
    function wireTabs(container, { tabSelector = '[data-tab]', paneSelector = '[data-pane]', onChange } = {}) {
        if (!container) return;
        const tabs = Array.from(container.querySelectorAll(tabSelector));
        const select = tab => {
            const which = tab.dataset.tab;
            tabs.forEach(t => {
                const on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            container.querySelectorAll(paneSelector).forEach(pane => { pane.hidden = pane.dataset.pane !== which; });
            if (typeof onChange === 'function') onChange(which);
        };
        tabs.forEach(tab => {
            tab.setAttribute('role', 'tab');
            tab.addEventListener('click', () => select(tab));
        });
        return { select: which => { const tab = tabs.find(t => t.dataset.tab === which); if (tab) select(tab); } };
    }

    root.fptWindow = { create, open, close, isOpen, theme, paint, button, checkbox, checkboxHtml, wireTabs, icon };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.fptWindow;
})(typeof window !== 'undefined' ? window : globalThis);
