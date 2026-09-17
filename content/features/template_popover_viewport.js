(function initTemplatePopoverViewportController() {
    const layoutApi = globalThis.FPTTemplatePopoverLayout;
    if (!layoutApi || typeof layoutApi.calculateTemplatePopoverLayout !== 'function') return;

    const tracked = new WeakMap();
    let frame = 0;

    function getTrigger() {
        return document.getElementById('fpt-tpl-popover-btn');
    }

    function applyPosition(pop) {
        if (!pop || !pop.isConnected) return;
        const trigger = getTrigger();
        if (!trigger || !trigger.isConnected) return;

        const triggerRect = trigger.getBoundingClientRect();
        const popRect = pop.getBoundingClientRect();
        const naturalHeight = Math.max(popRect.height, pop.scrollHeight || 0);

        const layout = layoutApi.calculateTemplatePopoverLayout({
            triggerRect,
            popoverWidth: popRect.width,
            popoverHeight: naturalHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            margin: 10,
            gap: 10
        });

        pop.dataset.fptPlacement = layout.placement;
        pop.style.left = `${layout.left}px`;
        pop.style.right = 'auto';
        pop.style.maxHeight = `${Math.max(0, layout.maxHeight)}px`;

        if (layout.placement === 'top') {
            pop.style.top = 'auto';
            pop.style.bottom = `${layout.bottom}px`;
        } else {
            pop.style.bottom = 'auto';
            pop.style.top = `${layout.top}px`;
        }
    }

    function schedulePosition(pop) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            frame = 0;
            applyPosition(pop || document.getElementById('fpt-tpl-popover'));
        });
    }

    function track(pop) {
        if (!pop || tracked.has(pop)) return;

        const resizeObserver = typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => schedulePosition(pop))
            : null;

        if (resizeObserver) resizeObserver.observe(pop);
        tracked.set(pop, resizeObserver);
        schedulePosition(pop);
    }

    function untrack(pop) {
        const resizeObserver = tracked.get(pop);
        if (resizeObserver) resizeObserver.disconnect();
        tracked.delete(pop);
    }

    const domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.id === 'fpt-tpl-popover') track(node);
                const nested = node.querySelector?.('#fpt-tpl-popover');
                if (nested) track(nested);
            }
            for (const node of mutation.removedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.id === 'fpt-tpl-popover') untrack(node);
                const nested = node.querySelector?.('#fpt-tpl-popover');
                if (nested) untrack(nested);
            }
        }
    });

    domObserver.observe(document.documentElement, { childList: true, subtree: true });

    const repositionCurrent = () => schedulePosition(document.getElementById('fpt-tpl-popover'));
    window.addEventListener('resize', repositionCurrent, { passive: true });
    window.addEventListener('scroll', repositionCurrent, { passive: true, capture: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', repositionCurrent, { passive: true });
        window.visualViewport.addEventListener('scroll', repositionCurrent, { passive: true });
    }

    track(document.getElementById('fpt-tpl-popover'));
})();
