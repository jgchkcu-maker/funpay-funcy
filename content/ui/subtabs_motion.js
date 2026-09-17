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
        if (!active || typeof active.scrollIntoView !== 'function') return;

        const barRect = bar.getBoundingClientRect();
        const tabRect = active.getBoundingClientRect();
        const isClipped = tabRect.left < barRect.left + 6 || tabRect.right > barRect.right - 6;
        if (isClipped) {
            active.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: prefersReducedMotion() ? 'auto' : 'smooth'
            });
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

    function runLocalTransition(bar, tab, serial) {
        const popup = bar.closest('.fp-tools-popup');
        const content = bar.closest('.fp-tools-content') || (popup && popup.querySelector('.fp-tools-content'));

        if (!popup || !content) {
            dispatchLegacyClick(tab);
            return;
        }

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            content.classList.remove(TRANSITIONING_CLASS);
        };

        content.classList.add(TRANSITIONING_CLASS);
        activeLocalCleanup = cleanup;

        // Keep the switch synchronous so there is never a blank frame. Only the
        // newly-active real DOM page is animated, inside the popup's paint clip.
        dispatchLegacyClick(tab);
        if (serial !== switchSerial) {
            cleanup();
            return;
        }

        const newPage = popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!newPage || typeof newPage.animate !== 'function') {
            cleanup();
            if (serial === switchSerial) activeLocalCleanup = null;
            return;
        }

        const animation = newPage.animate([
            { opacity: 0.98, transform: 'translate3d(0, 3px, 0) scale(.999)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ], {
            duration: 170,
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
