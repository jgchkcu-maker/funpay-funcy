const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const sender = { id: 'qa', tab: { id: 7 }, documentId: 'document-a', url: 'https://funpay.com/chat/' };
const files = { css: ['css/popup_categories.css', 'css/automation.css'], js: ['content/ui/main_popup.js', 'content/ui/popup_bundle_ready.js'] };
async function fixture({ rejectFile, readBundle = async () => files, stall } = {}) {
    const { createPopupBundleLoader } = await import('../background/popup_bundle_loader.mjs');
    const ctx = vm.createContext({ fptPopupBundleIsReady: () => true });
    const calls = [];
    const scripting = {
        async executeScript(options) {
            calls.push(options);
            assert.deepEqual(options.target, { tabId: 7, documentIds: ['document-a'] });
            assert.equal(options.world, 'ISOLATED');
            if (options.func) {
                assert.ok(options.args.every(value => value !== undefined), 'Chrome injection arguments must be JSON serializable');
                ctx.args = options.args;
                const result = vm.runInContext(`(${options.func.toString()})(...args)`, ctx);
                return [{ documentId: sender.documentId, result: JSON.parse(JSON.stringify(result)) }];
            }
            if (stall) await stall(options.files[0]);
            if (options.files[0] === rejectFile) { ctx.partialSideEffect = true; throw new Error('File interrupted'); }
            if (options.files[0].endsWith('popup_bundle_ready.js')) ctx.__fptPopupBundleLoaded = true;
            return [{ documentId: sender.documentId }];
        },
        async insertCSS(options) { calls.push(options); }
    };
    const factory = () => createPopupBundleLoader({ scripting, readBundle, extensionId: 'qa' });
    return { load: factory(), factory, calls, ctx };
}
test('bundle injection preserves CSS/JS order, document target and confirmed readiness', async () => {
    const f = await fixture();
    const result = await f.load({ requestId: 'one' }, sender);
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.started, ['css', ...files.js]);
    assert.deepEqual(result.completed, result.started);
    assert.deepEqual(f.calls.filter(call => call.files).map(call => call.files), [files.css, ...files.js.map(file => [file])]);
    const second = await f.factory()({ requestId: 'two' }, sender);
    assert.equal(second.status, 'ready');
    assert.equal(f.calls.filter(call => call.files).length, 3);
});
test('JSON failure before injection can be retried explicitly and does not poison the cache', async () => {
    let reads = 0;
    const f = await fixture({ readBundle: async () => { if (!reads++) throw new Error('JSON missing'); return files; } });
    const first = await f.load({ requestId: 'one' }, sender);
    assert.equal(first.status, 'failed-not-started');
    assert.equal(first.injectionAttempted, false);
    assert.equal(f.calls.length, 0);
    assert.equal((await f.load({ requestId: 'two' }, sender)).status, 'ready');
});
test('a file can have side effects before rejection: restart must not replay it', async () => {
    const f = await fixture({ rejectFile: files.js[0] });
    const result = await f.load({ requestId: 'one' }, sender);
    assert.equal(result.status, 'failed-partial');
    assert.equal(result.injectionAttempted, true);
    assert.equal(f.ctx.partialSideEffect, true);
    assert.deepEqual(result.completed, ['css']);
    const count = f.calls.filter(call => call.files).length;
    assert.equal((await f.factory()({ requestId: 'two' }, sender)).status, 'failed-partial');
    assert.equal(f.calls.filter(call => call.files).length, count);
});
test('concurrent calls share an operation; a restarted worker sees an occupied document', async () => {
    let release, entered;
    const pending = new Promise(resolve => release = resolve);
    const started = new Promise(resolve => entered = resolve);
    const f = await fixture({ stall: async file => { if (file === files.js[0]) { entered(); await pending; } } });
    const first = f.load({ requestId: 'one' }, sender);
    await started;
    const concurrent = f.load({ requestId: 'one' }, sender);
    const restart = await f.factory()({ requestId: 'other' }, sender);
    assert.equal(restart.status, 'unknown');
    assert.equal(restart.requestId, 'one');
    release();
    assert.equal((await first).status, 'ready');
    assert.equal((await concurrent).status, 'ready');
    assert.equal(f.calls.filter(call => call.files?.[0] === files.js[0]).length, 1);
});
test('missing document id, wrong extension or URL never injects anything', async () => {
    const f = await fixture();
    for (const patch of [{ documentId: undefined }, { id: 'foreign' }, { url: 'https://example.com/' }, { url: 'https://funpay.com.evil.test/' }]) {
        assert.equal((await f.load({ requestId: 'one', files: ['evil.js'] }, { ...sender, ...patch })).status, 'failed-not-started');
    }
    assert.equal(f.calls.length, 0);
});
test('API success does not bypass validation of the expected exports', async () => {
    const f = await fixture();
    const original = f.calls;
    f.ctx.fptPopupBundleIsReady = () => false;
    const result = await f.load({ requestId: 'one' }, sender);
    assert.equal(result.status, 'failed-partial');
    assert.equal(result.ok, false);
    assert.ok(original.every(call => !call.target.frameIds));
});
test('navigation after CSS cannot inject into a new frame and stays unknown', async () => {
    const { createPopupBundleLoader } = await import('../background/popup_bundle_loader.mjs');
    const ctx = vm.createContext({});
    let gone = false, cssCalls = 0, fileCalls = 0;
    const load = createPopupBundleLoader({ extensionId: 'qa', readBundle: async () => files, scripting: {
        async executeScript(options) {
            assert.deepEqual(options.target, { tabId: 7, documentIds: ['document-a'] });
            if (gone) throw new Error('No document with id document-a');
            if (options.files) fileCalls++;
            ctx.args = options.args;
            return [{ documentId: sender.documentId, result: JSON.parse(JSON.stringify(vm.runInContext(`(${options.func.toString()})(...args)`, ctx))) }];
        },
        async insertCSS() { cssCalls++; gone = true; }
    } });
    const result = await load({ requestId: 'one' }, sender);
    assert.equal(result.status, 'unknown');
    assert.equal(result.injectionAttempted, true);
    assert.deepEqual(result.started, ['css']);
    assert.deepEqual(result.completed, []);
    assert.equal(cssCalls, 1); assert.equal(fileCalls, 0);
});
