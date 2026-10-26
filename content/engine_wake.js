// Optional debounced page accelerator. No polling; heartbeat covers missing nodes.
(function () {
    let timer = null;
    let stopped = false;
    let observer;
    const selectors = '.contact-item, .chat-msg-item, .tc-item, .counter-list';
    function stop() {
        stopped = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        observer?.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    function available() {
        if (stopped) return false;
        try {
            if (globalThis.chrome?.runtime?.id) return true;
        } catch (_) {}
        stop();
        return false;
    }
    function onVisibilityChange() {
        if (!document.hidden) signal();
    }
    function signal() {
        if (!available() || timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            if (!available()) return;
            // Reloading/updating the extension invalidates old content scripts.
            // sendMessage can throw before returning a Promise, so .catch alone
            // cannot handle that lifecycle transition.
            try {
                Promise.resolve(chrome.runtime.sendMessage({ action: 'fptEngineWake' })).catch(error => {
                    if (/extension context invalidated/i.test(String(error?.message || error))) stop();
                });
            } catch (_) { stop(); }
        }, 1000);
    }
    observer = new MutationObserver(records => {
        if (records.some(record => {
            const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (element?.closest(selectors)) return true;
            return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches(selectors) || node.querySelector(selectors)));
        })) signal();
    });
    if (!available()) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['data-node-msg', 'data-user-msg', 'data-id', 'class'] });
    document.addEventListener('visibilitychange', onVisibilityChange);
})();
