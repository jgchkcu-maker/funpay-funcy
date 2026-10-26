const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../content/engine_wake.js'), 'utf8');

function setup(send = () => Promise.resolve()) {
    const timers = new Map(), listeners = new Map();
    let callback, calls = 0, disconnected = 0, counter = 0;
    const runtime = { id: 'test-extension', sendMessage: msg => { calls++; assert.equal(msg.action, 'fptEngineWake'); return send(); } };
    const document = { hidden: false, body: {},
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
    vm.runInNewContext(source, { chrome: { runtime }, document,
        MutationObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected++; } },
        setTimeout: fn => { const id = ++counter; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
    return { runtime, timers, listeners, calls: () => calls, disconnected: () => disconnected,
        mutate: () => callback([{ target: { nodeType: 1, closest: () => true } }]),
        tick: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

test('page mutations debounce into one wake and allow the next independent signal', () => {
    const h = setup(); h.mutate(); h.mutate(); h.listeners.get('visibilitychange')();
    assert.equal(h.timers.size, 1); h.tick(); assert.equal(h.calls(), 1);
    h.mutate(); h.tick(); assert.equal(h.calls(), 2);
});

test('synchronous context invalidation is contained and detaches stale page listeners', () => {
    const h = setup(() => { throw new Error('Extension context invalidated.'); });
    h.mutate(); assert.doesNotThrow(h.tick);
    assert.equal(h.disconnected(), 1); assert.equal(h.listeners.size, 0);
    h.mutate(); h.tick(); assert.equal(h.calls(), 1); assert.equal(h.timers.size, 0);
});

test('context lost during debounce cancels the send and detaches the observer', () => {
    const h = setup(); h.mutate(); delete h.runtime.id; h.tick();
    assert.equal(h.calls(), 0); assert.equal(h.disconnected(), 1); assert.equal(h.listeners.size, 0);
});

test('asynchronous context invalidation detaches the observer without an unhandled rejection', async () => {
    const h = setup(() => Promise.reject(new Error('Extension context invalidated.')));
    h.mutate(); h.tick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.disconnected(), 1); assert.equal(h.listeners.size, 0);
});

test('transient worker rejection does not disable future page signals', async () => {
    const h = setup(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
    h.mutate(); h.tick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.disconnected(), 0); h.mutate(); h.tick();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls(), 2);
});
