// Shared motion/accessibility layer for the settings hub subtabs.
(function () {
    'use strict';

    const BAR_SELECTOR = '#fptTopSubtabsBar';
    const TAB_SELECTOR = '.fpt-subtab';
    const ACTIVE_PAGE_SELECTOR = '.fp-tools-page-content.active';
    const TRANSITIONING_CLASS = 'fpt-subtab-transitioning';

    const legacyClickBypass = new WeakSet();
    let switchSerial = 0;
    let activeLocalCleanup = null;
    let fallbackAnimations = [];

    function getTabs(bar) {
        return Array.from(bar.querySelectorAll(TAB_SELECTOR));
    }

    function setTabA11y(bar) {
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Разделы настроек');

        getTabs(bar).forEach((tab) => {
            const active = tab.classList.contains('is-active');
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
        });
    }

    function syncIndicator(bar) {
        const active = bar.querySelector(`${TAB_SELECTOR}.is-active`);
        if (!active || active.offsetWidth === 0) {
            bar.removeAttribute('data-fpt-indicator-ready');
            return;
        }

        bar.style.setProperty('--fpt-subtab-indicator-x', `${Math.round(active.offsetLeft)}px`);
        bar.style.setProperty('--fpt-subtab-indicator-width', `${Math.round(active.offsetWidth)}px`);

        if (!bar.hasAttribute('data-fpt-indicator-ready')) {
            // First paint should not travel in from x=0. Subsequent changes animate.
            bar.getBoundingClientRect();
            bar.setAttribute('data-fpt-indicator-ready', '1');
        }
    }

    function prefersReducedMotion() {
        return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function keepActiveTabVisible(bar) {
        const active = bar.querySelector(`${TAB_SELECTOR}.is-active`);
        if (!active) return;

        const viewLeft = bar.scrollLeft + 6;
        const viewRight = bar.scrollLeft + bar.clientWidth - 6;
        const tabLeft = active.offsetLeft;
        const tabRight = tabLeft + active.offsetWidth;
        let targetLeft = null;

        if (tabLeft < viewLeft) {
            targetLeft = Math.max(0, tabLeft - 6);
        } else if (tabRight > viewRight) {
            targetLeft = Math.max(0, tabRight - bar.clientWidth + 6);
        }

        if (targetLeft === null) return;

        if (typeof bar.scrollTo === 'function') {
            bar.scrollTo({
                left: targetLeft,
                behavior: prefersReducedMotion() ? 'auto' : 'smooth'
            });
        } else {
            bar.scrollLeft = targetLeft;
        }
    }

    function sync(bar) {
        setTabA11y(bar);
        syncIndicator(bar);
        keepActiveTabVisible(bar);
    }

    function cancelInFlightTransitions() {
        switchSerial += 1;

        fallbackAnimations.forEach((animation) => {
            try { animation.cancel(); } catch (_) { /* no-op */ }
        });
        fallbackAnimations = [];

        if (activeLocalCleanup) {
            activeLocalCleanup();
            activeLocalCleanup = null;
        }

        return switchSerial;
    }

    function dispatchLegacyClick(tab) {
        legacyClickBypass.add(tab);
        try {
            tab.click();
        } finally {
            legacyClickBypass.delete(tab);
        }
    }

    function getTransitionDirection(bar, tab) {
        const tabs = getTabs(bar);
        const active = bar.querySelector(`${TAB_SELECTOR}.is-active`);
        const fromIndex = tabs.indexOf(active);
        const toIndex = tabs.indexOf(tab);
        if (fromIndex === -1 || toIndex === -1) return 'forward';
        return toIndex < fromIndex ? 'backward' : 'forward';
    }

    function runLocalTransition(bar, tab, serial) {
        const popup = bar.closest('.fp-tools-popup');
        const content = bar.closest('.fp-tools-content') || (popup && popup.querySelector('.fp-tools-content'));
        const oldPage = popup && popup.querySelector(ACTIVE_PAGE_SELECTOR);

        if (!popup || !content || !oldPage) {
            dispatchLegacyClick(tab);
            return;
        }

        const direction = getTransitionDirection(bar, tab);
        const contentRect = content.getBoundingClientRect();
        const oldRect = oldPage.getBoundingClientRect();
        const oldTop = oldRect.top - contentRect.top + content.scrollTop;
        const oldLeft = oldRect.left - contentRect.left + content.scrollLeft;

        const oldPageInline = {
            display: oldPage.style.display,
            position: oldPage.style.position,
            top: oldPage.style.top,
            left: oldPage.style.left,
            width: oldPage.style.width,
            height: oldPage.style.height,
            margin: oldPage.style.margin,
            zIndex: oldPage.style.zIndex,
            pointerEvents: oldPage.style.pointerEvents,
            boxSizing: oldPage.style.boxSizing
        };

        let newPage = null;
        let newPageInline = null;
        let animation = null;
        let cleaned = false;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;

            content.classList.remove(TRANSITIONING_CLASS);

            oldPage.style.position = oldPageInline.position;
            oldPage.style.top = oldPageInline.top;
            oldPage.style.left = oldPageInline.left;
            oldPage.style.width = oldPageInline.width;
            oldPage.style.height = oldPageInline.height;
            oldPage.style.margin = oldPageInline.margin;
            oldPage.style.zIndex = oldPageInline.zIndex;
            oldPage.style.pointerEvents = oldPageInline.pointerEvents;
            oldPage.style.boxSizing = oldPageInline.boxSizing;
            oldPage.style.display = 'none';

            if (newPage && newPageInline) {
                newPage.style.position = newPageInline.position;
                newPage.style.zIndex = newPageInline.zIndex;
                newPage.style.clipPath = newPageInline.clipPath;
                newPage.style.willChange = newPageInline.willChange;
                newPage.style.background = newPageInline.background;
                newPage.style.minHeight = newPageInline.minHeight;
            }
        };

        content.classList.add(TRANSITIONING_CLASS);
        activeLocalCleanup = cleanup;

        // Switch synchronously so layout/state updates happen once. The outgoing
        // page is then restored as a non-interactive underlay, while the incoming
        // page reveals over it using clip-path only (no fade, translate or scale).
        dispatchLegacyClick(tab);
        if (serial !== switchSerial) {
            cleanup();
            return;
        }

        newPage = popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!newPage || newPage === oldPage || typeof newPage.animate !== 'function') {
            cleanup();
            if (serial === switchSerial) activeLocalCleanup = null;
            return;
        }

        newPageInline = {
            position: newPage.style.position,
            zIndex: newPage.style.zIndex,
            clipPath: newPage.style.clipPath,
            willChange: newPage.style.willChange,
            background: newPage.style.background,
            minHeight: newPage.style.minHeight
        };

        const newRect = newPage.getBoundingClientRect();
        const revealBackground = getComputedStyle(content).backgroundColor;
        const popupBackground = getComputedStyle(popup).backgroundColor;
        const stableBackground = revealBackground && revealBackground !== 'rgba(0, 0, 0, 0)'
            ? revealBackground
            : popupBackground;

        oldPage.style.display = 'block';
        oldPage.style.position = 'absolute';
        oldPage.style.top = `${oldTop}px`;
        oldPage.style.left = `${oldLeft}px`;
        oldPage.style.width = `${oldRect.width}px`;
        oldPage.style.height = `${oldRect.height}px`;
        oldPage.style.margin = '0';
        oldPage.style.zIndex = '0';
        oldPage.style.pointerEvents = 'none';
        oldPage.style.boxSizing = 'border-box';

        const startClip = direction === 'backward'
            ? 'inset(0 100% 0 0 round 14px)'
            : 'inset(0 0 0 100% round 14px)';
        const endClip = 'inset(0 0 0 0 round 0px)';

        newPage.style.position = newPageInline.position || 'relative';
        newPage.style.zIndex = '1';
        newPage.style.clipPath = startClip;
        newPage.style.willChange = 'clip-path';
        if (stableBackground && stableBackground !== 'rgba(0, 0, 0, 0)') {
            newPage.style.background = stableBackground;
        }
        newPage.style.minHeight = `${Math.max(oldRect.height, newRect.height)}px`;

        animation = newPage.animate([
            { clipPath: startClip },
            { clipPath: endClip }
        ], {
            duration: 180,
            easing: 'cubic-bezier(.2, 0, 0, 1)',
            fill: 'both'
        });
        fallbackAnimations = [animation];

        Promise.resolve(animation.finished).catch(() => {}).finally(() => {
            if (serial !== switchSerial) return;

            try { animation.cancel(); } catch (_) { /* no-op */ }
            fallbackAnimations = [];
            cleanup();
            activeLocalCleanup = null;
        });
    }

    function runTabTransition(bar, tab) {
        const serial = cancelInFlightTransitions();

        if (prefersReducedMotion()) {
            dispatchLegacyClick(tab);
            return;
        }

        runLocalTransition(bar, tab, serial);
    }

    function install(bar) {
        if (!bar || bar.dataset.fptMotionInstalled === '1') return;
        bar.dataset.fptMotionInstalled = '1';

        let frame = 0;
        const scheduleSync = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                sync(bar);
            });
        };

        // Capture the click before main_popup.js can instantly flip display:none/block.
        // The legacy click is replayed inside our local transition wrapper.
        bar.addEventListener('click', (event) => {
            const tab = event.target.closest(TAB_SELECTOR);
            if (!tab || !bar.contains(tab) || legacyClickBypass.has(tab)) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            if (tab.classList.contains('is-active')) return;

            runTabTransition(bar, tab);
        }, true);

        bar.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = getTabs(bar);
            if (!tabs.length) return;

            const current = event.target.closest(TAB_SELECTOR) || bar.querySelector(`${TAB_SELECTOR}.is-active`);
            let index = Math.max(0, tabs.indexOf(current));
            if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = tabs.length - 1;
            else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
            else index = (index + 1) % tabs.length;

            event.preventDefault();
            tabs[index].focus();
            tabs[index].click();
        });

        bar.addEventListener('scroll', scheduleSync, { passive: true });

        const observer = new MutationObserver((records) => {
            const changed = records.some((record) =>
                record.type === 'childList' ||
                (record.type === 'attributes' && record.attributeName === 'class')
            );
            if (changed) scheduleSync();
        });
        observer.observe(bar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        if (typeof ResizeObserver === 'function') {
            const resizeObserver = new ResizeObserver(scheduleSync);
            resizeObserver.observe(bar);
        }

        window.addEventListener('resize', scheduleSync, { passive: true });
        scheduleSync();
    }

    let documentObserver = null;

    function findAndInstall() {
        const bar = document.querySelector(BAR_SELECTOR);
        if (!bar) return false;
        install(bar);
        if (documentObserver) {
            documentObserver.disconnect();
            documentObserver = null;
        }
        return true;
    }

    const installWhenReady = () => {
        if (findAndInstall()) return;
        documentObserver = new MutationObserver(findAndInstall);
        documentObserver.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installWhenReady, { once: true });
    } else {
        installWhenReady();
    }
})();
