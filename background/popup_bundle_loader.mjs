// The lock lives in the receiving document, so a service-worker restart cannot
// replay scripts which may already have registered listeners or actions.
function documentState(command, requestId, detail) {
    const root = globalThis;
    const ready = root.__fptPopupBundleLoaded === true && root.fptPopupBundleIsReady?.() === true;
    let state = root.__fptPopupInjection;
    if (command === 'claim') {
        if (ready) return { claimed: false, state: { ...state, status: 'ready' } };
        if (state && state.status !== 'failed-not-started') return { claimed: false, state };
        state = root.__fptPopupInjection = { requestId, status: 'loading', stage: 'bootstrap', injectionAttempted: false, started: [], completed: [] };
        return { claimed: true, state };
    }
    if (!state || state.requestId !== requestId) throw new Error('Popup document attempt changed');
    if (command === 'start') { state.stage = detail; state.injectionAttempted = true; state.started.push(detail); }
    if (command === 'advance') {
        state.completed.push(detail.complete);
        state.stage = detail.next;
        state.injectionAttempted = true;
        state.started.push(detail.next);
    }
    if (command === 'finish') {
        if (detail.complete) state.completed.push(detail.complete);
        state.status = ready ? 'ready' : detail.status;
        if (ready) delete state.error;
        else if (detail.error) state.error = detail.error;
    }
    return { state: { ...state, status: ready ? 'ready' : state.status } };
}

export function createPopupBundleLoader({ scripting, readBundle, extensionId }) {
    let bundlePromise;
    const attempts = new Map();
    const reply = (requestId, state = {}) => ({
        requestId: state.requestId || requestId, ok: state.status === 'ready',
        status: state.status === 'loading' ? 'unknown' : state.status || 'unknown',
        stage: state.stage || 'bootstrap', injectionAttempted: !!state.injectionAttempted,
        started: state.started || [], completed: state.completed || [], ...(state.error ? { error: state.error } : {})
    });
    const bundle = () => bundlePromise ||= Promise.resolve().then(readBundle).then(value => {
        if (!value || !Array.isArray(value.js) || !value.js.length || !Array.isArray(value.css) || !value.css.length ||
            value.js.at(-1) !== 'content/ui/popup_bundle_ready.js' ||
            value.js.some(file => typeof file !== 'string' || !/^content\/(ui|features)\/[a-z_]+\.js$/.test(file)) ||
            value.css.some(file => typeof file !== 'string' || !/^css\/[a-z_]+\.css$/.test(file)) ||
            new Set(value.js).size !== value.js.length || new Set(value.css).size !== value.css.length) throw new Error('Invalid popup bundle');
        return value;
    }).catch(error => { bundlePromise = null; throw error; });

    return async function load(request, sender) {
        const requestId = request?.requestId;
        let url;
        try { url = new URL(sender?.url); } catch (_) {}
        if (typeof requestId !== 'string' || !/^[\w-]{1,100}$/.test(requestId) || sender?.id !== extensionId ||
            !Number.isInteger(sender?.tab?.id) || typeof sender.documentId !== 'string' || !sender.documentId ||
            url?.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?funpay\.com$/i.test(url.hostname)) {
            return reply(requestId, { status: 'failed-not-started', stage: 'validation', error: 'Invalid popup sender' });
        }
        const key = `${sender.tab.id}:${sender.documentId}`;
        if (attempts.has(key)) return attempts.get(key);
        const target = { tabId: sender.tab.id, documentIds: [sender.documentId] };
        const stateCall = async (command, detail) => {
            const results = await scripting.executeScript({ target, world: 'ISOLATED', func: documentState, args: [command, requestId, detail ?? null] });
            const result = results.find(item => item.documentId === sender.documentId)?.result;
            if (!result?.state) throw new Error('Popup document did not confirm its state');
            return result;
        };
        const operation = (async () => {
            let files;
            try { files = await bundle(); }
            catch (error) { return reply(requestId, { status: 'failed-not-started', stage: 'bundle', error: error.message }); }
            let state = { requestId, status: 'unknown', stage: 'bootstrap', injectionAttempted: false, started: [], completed: [] };
            try {
                const claim = await stateCall('claim');
                state = claim.state;
                if (!claim.claimed) return reply(requestId, state);
                state = (await stateCall('start', 'css')).state;
                await scripting.insertCSS({ target, files: files.css });
                for (const [index, file] of files.js.entries()) {
                    // Confirm the previous step and start the next atomically.
                    // This halves progress-report round trips without replaying files.
                    state = (await stateCall('advance', { complete: index ? files.js[index - 1] : 'css', next: file })).state;
                    await scripting.executeScript({ target, world: 'ISOLATED', files: [file] });
                }
                state = (await stateCall('finish', { status: 'failed-partial', complete: files.js.at(-1), error: 'Popup bundle readiness check failed' })).state;
                return reply(requestId, state);
            } catch (error) {
                // A rejected injection can have side effects; never replay it.
                const failure = { status: state.injectionAttempted ? 'failed-partial' : 'unknown', error: error.message };
                try { state = (await stateCall('finish', failure)).state; }
                catch (_) { state = { ...state, ...failure, status: 'unknown' }; }
                return reply(requestId, state);
            }
        })();
        attempts.set(key, operation);
        try { return await operation; }
        finally { if (attempts.get(key) === operation) attempts.delete(key); }
    };
}
