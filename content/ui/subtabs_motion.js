// Shared motion/accessibility layer for the settings hub subtabs.
(function () {
    'use strict';

    const BAR_SELECTOR = '#fptTopSubtabsBar';
    const TAB_SELECTOR = '.fpt-subtab';
    const ACTIVE_PAGE_SELECTOR = '.fp-tools-page-content.active';

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

    function animateActivePage(bar) {
        const popup = bar.closest('.fp-tools-popup');
        const page = popup && popup.querySelector(ACTIVE_PAGE_SELECTOR);
        if (!page) return;

        page.classList.remove('fpt-page-enter');
        if (prefersReducedMotion()) return;

        // Restart the entrance animation when the selected page changes.
        page.getBoundingClientRect();
        page.classList.add('fpt-page-enter');
        page.addEventListener('animationend', () => {
            page.classList.remove('fpt-page-enter');
        }, { once: true });
    }

    function sync(bar, animatePage = false) {
        setTabA11y(bar);
        syncIndicator(bar);
        keepActiveTabVisible(bar);
        if (animatePage) animateActivePage(bar);
    }

    function install(bar) {
        if (!bar || bar.dataset.fptMotionInstalled === '1') return;
        bar.dataset.fptMotionInstalled = '1';

        let frame = 0;
        let animateOnNextSync = false;
        const scheduleSync = (animatePage = false) => {
            animateOnNextSync = animateOnNextSync || animatePage;
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                const shouldAnimatePage = animateOnNextSync;
                animateOnNextSync = false;
                sync(bar, shouldAnimatePage);
            });
        };

        bar.addEventListener('click', (event) => {
            if (event.target.closest(TAB_SELECTOR)) scheduleSync(true);
        });

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

        bar.addEventListener('scroll', () => scheduleSync(false), { passive: true });

        const observer = new MutationObserver((records) => {
            const changed = records.some((record) =>
                record.type === 'childList' ||
                (record.type === 'attributes' && record.attributeName === 'class')
            );
            if (changed) scheduleSync(true);
        });
        observer.observe(bar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        if (typeof ResizeObserver === 'function') {
            const resizeObserver = new ResizeObserver(() => scheduleSync(false));
            resizeObserver.observe(bar);
        }

        window.addEventListener('resize', () => scheduleSync(false), { passive: true });
        scheduleSync(false);
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
