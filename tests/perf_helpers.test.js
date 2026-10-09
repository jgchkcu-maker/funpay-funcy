const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../content/utils.js'), 'utf8').split('// DOM scheduling helpers:')[1].split('// End DOM scheduling helpers.')[0];
function events() {
    const listeners = new Map();
    return {
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        emit(type) { for (const fn of [...(listeners.get(type) || [])]) fn(); },
        size(type) { return listeners.get(type)?.size || 0; }
    };
}
function harness({ navigation = true } = {}) {
    let next = 0;
    const frames = new Map(), timers = new Map(), intervals = new Map(), errors = [];
    const document = { hidden: false, ...events() };
    const window = { ...events(), location: { href: 'https://funpay.com/chat/' },
        navigation: navigation ? events() : undefined,
        requestAnimationFrame: fn => { const id = next++; frames.set(id, fn); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout: fn => { const id = next++; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
        setInterval: fn => { const id = next++; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id)
    };
    vm.runInNewContext(source.slice(source.indexOf('\n')), { window, document, console: { error: (...args) => errors.push(args) }, Promise });
    const run = map => { const work = [...map.values()]; map.clear(); work.forEach(fn => fn()); };
    return { window, document, frames, timers, intervals, errors, frame: () => run(frames), timer: () => run(timers) };
}
test('coalescing preserves every mutation batch in order and accepts frame id zero', () => {
    const h = harness(), seen = [], observer = {};
    const schedule = h.window.fptCoalesce((records, source) => { seen.push([...records]); assert.equal(source, observer); }, { records: true });
    schedule([1, 2], observer); schedule([3], observer); schedule([4, 5], observer);
    assert.equal(h.frames.size, 1); h.frame();
    assert.deepEqual(seen, [[1, 2, 3, 4, 5]]);
    schedule([6], observer); h.frame(); assert.deepEqual(seen[1], [6]);
});
test('pending work migrates in both visibility directions without duplicate execution', () => {
    const h = harness(); let runs = 0;
    const schedule = h.window.fptCoalesce(() => runs++);
    schedule(); h.document.hidden = true; h.document.emit('visibilitychange');
    assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 1);
    h.document.hidden = false; h.document.emit('visibilitychange');
    assert.equal(h.timers.size, 0); assert.equal(h.frames.size, 1);
    h.frame(); assert.equal(runs, 1);
    h.document.hidden = true; schedule(); h.timer(); assert.equal(runs, 2);
});
test('callback failures do not block later work and disposal cancels pending batches', async () => {
    const h = harness(); let calls = 0;
    const schedule = h.window.fptCoalesce(() => {
        calls++;
        if (calls === 1) throw new Error('sync');
        if (calls === 2) return Promise.reject(new Error('async'));
    });
    schedule(); h.frame(); schedule(); h.frame(); await Promise.resolve();
    schedule(); h.frame(); assert.equal(calls, 3); assert.equal(h.errors.length, 2);
    schedule(); schedule.cancel(); h.frame(); assert.equal(calls, 3);
    schedule(); schedule.dispose(); schedule(); h.frame(); assert.equal(calls, 3);
    assert.equal(h.document.size('visibilitychange'), 0);
});
test('URL subscribers share detection, deduplicate events and dispose their sources', async () => {
    const h = harness(); const seen = [];
    const stop1 = h.window.fptOnUrlChange((next, old) => seen.push([next, old]));
    const stop2 = h.window.fptOnUrlChange(() => { throw new Error('subscriber'); });
    h.window.location.href += '?node=123'; h.window.navigation.emit('currententrychange'); h.window.emit('popstate');
    assert.equal(seen.length, 1); assert.equal(h.errors.length, 1);
    stop2(); h.window.location.href += '#message'; h.window.emit('hashchange');
    assert.equal(seen.length, 2); stop1(); assert.equal(h.window.size('popstate'), 0);
    assert.equal(h.window.navigation.size('currententrychange'), 0);
});
test('without Navigation API all URL subscribers use one polling timer', () => {
    const h = harness({ navigation: false }); let calls = 0;
    const stop1 = h.window.fptOnUrlChange(() => calls++), stop2 = h.window.fptOnUrlChange(() => calls++);
    assert.equal(h.intervals.size, 1);
    h.window.location.href = 'https://funpay.com/users/123/'; [...h.intervals.values()][0]();
    assert.equal(calls, 2); stop1(); assert.equal(h.intervals.size, 1); stop2(); assert.equal(h.intervals.size, 0);
});
