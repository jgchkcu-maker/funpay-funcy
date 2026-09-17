// Shared motion/accessibility layer for the settings hub subtabs.
(function () {
    'use strict';

    const BAR_SELECTOR = '#fptTopSubtabsBar';
    const TAB_SELECTOR = '.fpt-subtab';
    const ACTIVE_PAGE_SELECTOR = '.fp-tools-page-content.active';
    const VIEW_TRANSITION_NAME = 'fpt-settings-page';

    const legacyClickBypass = new WeakSet();
    let switchSerial = 0;
    let activeViewTransition = null;
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

        if (activeViewTransition && typeof activeViewTransition.skipTransition === 'function') {
            try { activeViewTransition.skipTransition(); } catch (_) { /* no-op */ }
        }
        activeViewTransition = null;

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

    function runViewTransition(bar, tab, serial) {
        const popup = bar.closest('.fp-tools-popup');
        const oldPage = popup && popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!popup || !oldPage) {
            dispatchLegacyClick(tab);
            return;
        }

        const oldInlineName = oldPage.style.viewTransitionName;
        let newPage = null;
        let newInlineName = '';
        oldPage.style.viewTransitionName = VIEW_TRANSITION_NAME;

        let transition;
        try {
            transition = document.startViewTransition(() => {
                // The old snapshot is captured before this callback. Hand the same
                // transition name to the newly-active page for a local crossfade.
                oldPage.style.viewTransitionName = oldInlineName;
                dispatchLegacyClick(tab);
                newPage = popup.querySelector(ACTIVE_PAGE_SELECTOR);
                if (newPage) {
                    newInlineName = newPage.style.viewTransitionName;
                    newPage.style.viewTransitionName = VIEW_TRANSITION_NAME;
                }
            });
        } catch (_) {
            oldPage.style.viewTransitionName = oldInlineName;
            runFallbackTransition(bar, tab, serial);
            return;
        }

        activeViewTransition = transition;
        Promise.resolve(transition.finished).catch(() => {}).finally(() => {
            oldPage.style.viewTransitionName = oldInlineName;
            if (newPage) newPage.style.viewTransitionName = newInlineName;
            if (serial === switchSerial) activeViewTransition = null;
        });
    }

    async function runFallbackTransition(bar, tab, serial) {
        const popup = bar.closest('.fp-tools-popup');
        const oldPage = popup && popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!popup || !oldPage || typeof oldPage.animate !== 'function') {
            dispatchLegacyClick(tab);
            return;
        }

        const outAnimation = oldPage.animate([
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            { opacity: 0, transform: 'translate3d(0, -3px, 0)' }
        ], {
            duration: 90,
            easing: 'cubic-bezier(.4, 0, 1, 1)',
            fill: 'both'
        });
        fallbackAnimations = [outAnimation];

        try { await outAnimation.finished; } catch (_) { return; }
        if (serial !== switchSerial) return;

        dispatchLegacyClick(tab);
        const newPage = popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!newPage || typeof newPage.animate !== 'function') {
            outAnimation.cancel();
            fallbackAnimations = [];
            return;
        }

        const inAnimation = newPage.animate([
            { opacity: 0, transform: 'translate3d(0, 5px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ], {
            duration: 180,
            easing: 'cubic-bezier(.2, 0, 0, 1)',
            fill: 'both'
        });
        fallbackAnimations = [outAnimation, inAnimation];

        try { await inAnimation.finished; } catch (_) { /* cancelled by a newer switch */ }
        if (serial === switchSerial) {
            outAnimation.cancel();
            inAnimation.cancel();
            fallbackAnimations = [];
        }
    }

    function runTabTransition(bar, tab) {
        const serial = cancelInFlightTransitions();

        if (prefersReducedMotion()) {
            dispatchLegacyClick(tab);
            return;
        }

        if (typeof document.startViewTransition === 'function') {
            runViewTransition(bar, tab, serial);
        } else {
            runFallbackTransition(bar, tab, serial);
        }
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
        // The legacy click is replayed inside our transition callback.
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
