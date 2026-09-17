// Keeps the resizable FP Tools window usable after viewport/zoom/monitor changes.
(function (root) {
    'use strict';

    const DEFAULT_MARGIN = 12;
    const DEFAULT_MIN_WIDTH = 760;
    const DEFAULT_MIN_HEIGHT = 520;
    const PREFERRED_WIDTH = 1180;
    const PREFERRED_HEIGHT = 780;

    function finiteOr(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function cssPixels(value) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return NaN;
        return Number.parseFloat(value);
    }

    function shouldResetLegacySize(savedSize) {
        if (!savedSize) return false;
        const width = cssPixels(savedSize.width);
        const height = cssPixels(savedSize.height);
        if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
        return width < DEFAULT_MIN_WIDTH || height < DEFAULT_MIN_HEIGHT;
    }

    function clampPopupRect(rect, viewport, options = {}) {
        const margin = Math.max(0, finiteOr(options.margin, DEFAULT_MARGIN));
        const viewportWidth = Math.max(0, finiteOr(viewport && viewport.width, 0));
        const viewportHeight = Math.max(0, finiteOr(viewport && viewport.height, 0));
        const availableWidth = Math.max(0, viewportWidth - margin * 2);
        const availableHeight = Math.max(0, viewportHeight - margin * 2);

        const requestedMinWidth = Math.max(0, finiteOr(options.minWidth, DEFAULT_MIN_WIDTH));
        const requestedMinHeight = Math.max(0, finiteOr(options.minHeight, DEFAULT_MIN_HEIGHT));
        const minWidth = Math.min(requestedMinWidth, availableWidth);
        const minHeight = Math.min(requestedMinHeight, availableHeight);

        const rawWidth = Math.max(0, finiteOr(rect && rect.width, minWidth));
        const rawHeight = Math.max(0, finiteOr(rect && rect.height, minHeight));
        const width = Math.min(Math.max(rawWidth, minWidth), availableWidth);
        const height = Math.min(Math.max(rawHeight, minHeight), availableHeight);

        const maxLeft = Math.max(margin, viewportWidth - margin - width);
        const maxTop = Math.max(margin, viewportHeight - margin - height);
        const rawLeft = finiteOr(rect && rect.left, margin);
        const rawTop = finiteOr(rect && rect.top, margin);
        const left = Math.min(Math.max(rawLeft, margin), maxLeft);
        const top = Math.min(Math.max(rawTop, margin), maxTop);

        return { left, top, width, height };
    }

    function nearlyEqual(a, b) {
        return Math.abs(a - b) < 0.75;
    }

    function persistClampedState(popup, next) {
        if (!root.chrome || !root.chrome.storage || !root.chrome.storage.local) return;
        const payload = {
            fpToolsPopupSize: {
                width: `${Math.round(next.width)}px`,
                height: `${Math.round(next.height)}px`
            }
        };
        if (popup.classList.contains('no-transform')) {
            payload.fpToolsPopupPosition = {
                left: `${Math.round(next.left)}px`,
                top: `${Math.round(next.top)}px`
            };
        }
        root.chrome.storage.local.set(payload);
    }

    function clampPopupElement(popup, persist = true) {
        if (!popup || !root.innerWidth || !root.innerHeight) return null;
        const rect = popup.getBoundingClientRect();
        const next = clampPopupRect(rect, { width: root.innerWidth, height: root.innerHeight });
        let changed = false;

        if (!nearlyEqual(rect.width, next.width)) {
            popup.style.width = `${Math.round(next.width)}px`;
            changed = true;
        }
        if (!nearlyEqual(rect.height, next.height)) {
            popup.style.height = `${Math.round(next.height)}px`;
            changed = true;
        }

        // Only set absolute coordinates after the user has dragged the window.
        // Centered windows still use translate(-50%, -50%) from the base stylesheet.
        if (popup.classList.contains('no-transform')) {
            if (!nearlyEqual(rect.left, next.left)) {
                popup.style.left = `${Math.round(next.left)}px`;
                changed = true;
            }
            if (!nearlyEqual(rect.top, next.top)) {
                popup.style.top = `${Math.round(next.top)}px`;
                changed = true;
            }
        }

        if (changed && persist) persistClampedState(popup, next);
        return next;
    }

    function resetLegacySizeToPreferred(popup) {
        if (!popup || !root.innerWidth || !root.innerHeight) return;
        const rect = popup.getBoundingClientRect();
        const next = clampPopupRect(
            { left: rect.left, top: rect.top, width: PREFERRED_WIDTH, height: PREFERRED_HEIGHT },
            { width: root.innerWidth, height: root.innerHeight }
        );
        popup.style.width = `${Math.round(next.width)}px`;
        popup.style.height = `${Math.round(next.height)}px`;
        if (popup.classList.contains('no-transform')) {
            popup.style.left = `${Math.round(next.left)}px`;
            popup.style.top = `${Math.round(next.top)}px`;
        }
        persistClampedState(popup, next);
    }

    function installPopupViewportGuard(popup) {
        if (!popup || popup.dataset.fptViewportGuard === '1') return;
        popup.dataset.fptViewportGuard = '1';

        let frame = 0;
        const schedule = () => {
            if (frame) root.cancelAnimationFrame(frame);
            frame = root.requestAnimationFrame(() => {
                frame = 0;
                clampPopupElement(popup, true);
            });
        };

        schedule();
        root.addEventListener('resize', schedule, { passive: true });

        if (typeof root.ResizeObserver === 'function') {
            const resizeObserver = new root.ResizeObserver(schedule);
            resizeObserver.observe(popup);
        }

        const mutationObserver = new MutationObserver(schedule);
        mutationObserver.observe(popup, { attributes: true, attributeFilter: ['style', 'class'] });

        // Older versions allowed the window to be saved at unusably tiny dimensions.
        // Migrate those values once by replacing them with the new preferred desktop size.
        if (root.chrome && root.chrome.storage && root.chrome.storage.local) {
            root.chrome.storage.local.get('fpToolsPopupSize', ({ fpToolsPopupSize }) => {
                if (!shouldResetLegacySize(fpToolsPopupSize)) return;
                resetLegacySizeToPreferred(popup);
                root.setTimeout(() => resetLegacySizeToPreferred(popup), 150);
            });
        }
    }

    function findAndInstall() {
        const popup = document.querySelector('.fp-tools-popup');
        if (popup) installPopupViewportGuard(popup);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { clampPopupRect, shouldResetLegacySize };
    }

    if (typeof document !== 'undefined' && root.addEventListener) {
        findAndInstall();
        const bodyObserver = new MutationObserver(findAndInstall);
        bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
})(typeof window !== 'undefined' ? window : globalThis);
