// content/features/scroll_guard.js
// Scrolling inside the extension's windows never scrolls the FunPay page behind them.
// A wheel / touch / keyboard scroll that starts inside an extension layer (the menu, modals,
// overlays, popovers, the select menus and the export studio) may only move a scroll container
// inside that layer that can still move in that direction; otherwise it is cancelled instead of
// chaining to the page. overscroll-behavior alone is not enough: it does nothing on parts that do
// not scroll (headers, sidebars, backdrops) or on containers whose content fits.
(function () {
    'use strict';
    if (window.__fptScrollGuard) return;
    window.__fptScrollGuard = true;

    // Extension UI: our class/id prefixes, MagicStick (ms-*) and our custom shadow hosts (fpt-*).
    const NAME = /(?:^|[\s_-])(?:fpt?|fp-tools|fpTools)[-_A-Z]|^fpTools|^ms-/;
    const fixedCache = new WeakMap();

    function isLayer(el) {
        if (!(el instanceof Element)) return false;
        const tag = el.tagName;
        if (tag.startsWith('FPT-')) return true;
        const cls = typeof el.className === 'string' ? el.className : '';
        if (!NAME.test(el.id || '') && !NAME.test(cls)) return false;
        let fixed = fixedCache.get(el);
        if (fixed === undefined || !el.isConnected) {
            fixed = getComputedStyle(el).position === 'fixed';
            fixedCache.set(el, fixed);
        }
        return fixed;
    }

    function canScroll(el, dx, dy) {
        if (!(el instanceof Element)) return false;
        const style = getComputedStyle(el);
        if (dy) {
            const oy = style.overflowY;
            const scrollable = (oy === 'auto' || oy === 'scroll' || oy === 'overlay' || el.tagName === 'TEXTAREA') && el.scrollHeight > el.clientHeight + 1;
            if (scrollable && (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
        }
        if (dx) {
            const ox = style.overflowX;
            const scrollable = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && el.scrollWidth > el.clientWidth + 1;
            const left = Math.abs(el.scrollLeft); // RTL scrolls with negative scrollLeft
            if (scrollable && (dx < 0 ? left > 0 : left + el.clientWidth < el.scrollWidth - 1)) return true;
        }
        return false;
    }

    // Returns true when the scroll must be cancelled: it started in an extension layer and nothing
    // between the target and that layer can take it.
    function blocks(path, dx, dy) {
        const layer = path.findIndex(isLayer);
        if (layer < 0) return false;
        for (let i = 0; i <= layer; i++) {
            if (canScroll(path[i], dx, dy)) return false;
        }
        return true;
    }

    document.addEventListener('wheel', event => {
        if (event.ctrlKey) return; // pinch / ctrl+wheel zoom
        let dx = event.deltaX;
        let dy = event.deltaY;
        if (event.shiftKey && !dx) { dx = dy; dy = 0; }
        if (!dx && !dy) return;
        if (blocks(event.composedPath(), dx, dy)) event.preventDefault();
    }, { capture: true, passive: false });

    let touch = null;
    document.addEventListener('touchstart', event => {
        const t = event.touches[0];
        touch = t && event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', event => {
        const t = event.touches[0];
        if (!touch || !t || event.touches.length !== 1) return;
        const dx = touch.x - t.clientX;
        const dy = touch.y - t.clientY;
        touch = { x: t.clientX, y: t.clientY };
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        if (event.cancelable && blocks(event.composedPath(), Math.abs(dx) > Math.abs(dy) ? dx : 0, Math.abs(dy) >= Math.abs(dx) ? dy : 0)) event.preventDefault();
    }, { capture: true, passive: false });

    // Keyboard page scrolling while focus is inside an extension layer (not in a text field).
    // Bubble phase on window: the layers' own key handlers (segments, lists) run first.
    const KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 1, PageUp: -1, End: 1, Home: -1, ' ': 1 };
    window.addEventListener('keydown', event => {
        const dir = KEYS[event.key];
        if (!dir || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const path = event.composedPath();
        const target = path[0];
        if (target instanceof Element && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        if (event.key === ' ' && target instanceof Element && /^(BUTTON|A|SUMMARY)$/.test(target.tagName)) return;
        if (blocks(path, 0, event.key === ' ' && event.shiftKey ? -1 : dir)) event.preventDefault();
    });
})();
