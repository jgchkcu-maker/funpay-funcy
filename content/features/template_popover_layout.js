(function attachTemplatePopoverLayout(root) {
    function clamp(value, min, max) {
        if (max < min) return min;
        return Math.max(min, Math.min(value, max));
    }

    function calculateTemplatePopoverLayout({
        triggerRect,
        popoverWidth,
        popoverHeight,
        viewportWidth,
        viewportHeight,
        margin = 10,
        gap = 10
    }) {
        const width = Math.max(0, Number(popoverWidth) || 0);
        const height = Math.max(0, Number(popoverHeight) || 0);
        const vw = Math.max(0, Number(viewportWidth) || 0);
        const vh = Math.max(0, Number(viewportHeight) || 0);

        const availableAbove = Math.max(0, triggerRect.top - gap - margin);
        const availableBelow = Math.max(0, vh - triggerRect.bottom - gap - margin);

        let placement;
        if (height <= availableAbove) {
            placement = 'top';
        } else if (height <= availableBelow) {
            placement = 'bottom';
        } else {
            placement = availableAbove >= availableBelow ? 'top' : 'bottom';
        }

        const maxHeight = Math.floor(placement === 'top' ? availableAbove : availableBelow);
        const centeredLeft = triggerRect.left + triggerRect.width / 2 - width / 2;
        const maxLeft = vw - width - margin;
        const left = Math.round(clamp(centeredLeft, margin, maxLeft));

        if (placement === 'top') {
            return {
                placement,
                left,
                top: null,
                bottom: Math.round(vh - triggerRect.top + gap),
                maxHeight
            };
        }

        return {
            placement,
            left,
            top: Math.round(triggerRect.bottom + gap),
            bottom: null,
            maxHeight
        };
    }

    const api = { calculateTemplatePopoverLayout };

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.FPTTemplatePopoverLayout = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
