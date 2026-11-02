const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../background/translate.js'), 'utf8').replace(/^export /gm, '');

// Execute the production module with a deterministic clock, not a copy of its logic.
function service(fetch, { consent = true } = {}) {
    let now = Date.UTC(2026, 10, 1), sequence = 0;
    const timers = new Map();
    const ctx = vm.createContext({
        AbortController, console,
        Date: class extends Date { static now() { return now; } },
        setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { at: now + delay, fn }); return id; },
        clearTimeout(id) { timers.delete(id); },
        fetch: (...args) => fetch(...args, now),
        chrome: { storage: { local: { get: async () => (consent ? { fpToolsTranslateConsentAt: 1 } : {}) } } }
    });
    vm.runInContext(source, ctx);
    return {
        api: ctx,
        async run(promise) {
            let done = false, value, error;
            promise.then(result => { done = true; value = result; }, e => { done = true; error = e; });
            for (let turn = 0; turn < 1000; turn++) {
                for (let tick = 0; tick < 30; tick++) await Promise.resolve();
                if (done) { if (error) throw error; return JSON.parse(JSON.stringify(value)); }
                const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
                assert.ok(next, 'translation must finish or schedule a timer');
                timers.delete(next[0]); now = Math.max(now, next[1].at); next[1].fn();
            }
            throw new Error('Translation did not settle');
        },
        advance(ms) { now += ms; }
    };
}
const translated = text => ({ ok: true, status: 200, json: async () => [[[text]]] });
const httpError = (status, retryAfter) => ({ ok: false, status, headers: { get: () => retryAfter } });

test('translation queue serializes different requests, deduplicates and preserves chat/lot contracts', async () => {
    const calls = [];
    let active = 0, peak = 0;
    const s = service(async (url, options, now) => {
        calls.push({ url, now }); peak = Math.max(peak, ++active);
        const response = translated('T:' + new URL(url).searchParams.get('q'));
        const json = response.json;
        response.json = async () => { await Promise.resolve(); active--; return json(); };
        return response;
    });
    const results = await s.run(Promise.all([
        s.api.translateChatText('Hello'), s.api.translateChatText('Hello'),
        s.api.translateChatText('World'), s.api.translateChatText('Hello', 'en')
    ]));
    assert.equal(peak, 1); assert.equal(calls.length, 3);
    assert.deepEqual(results.map(r => r.text), ['T:Hello', 'T:Hello', 'T:World', 'T:Hello']);
    for (let i = 1; i < calls.length; i++) assert.ok(calls[i].now - calls[i - 1].now >= 300);
    assert.deepEqual(await s.run(s.api.translateChatText('   ')), { success: true, text: '   ' });
    assert.deepEqual(await s.run(s.api.translateLotFields({ title: 'Title', description: 'One\n\nTwo', buyerMessage: 'Thanks' })), {
        success: true, data: { title: 'T:Title', description: 'T:One\n\nT:Two', buyerMessage: 'T:Thanks' }
    });
});

test('429 and network retries use bounded attempts and backoff; HTTP 400 is not retried', async () => {
    for (const kind of ['429', 'network', '400']) {
        const calls = [];
        const s = service(async (url, options, now) => {
            calls.push(now);
            if (kind === '400') return httpError(400);
            if (calls.length < 3) {
                if (kind === 'network') throw new TypeError('fetch failed');
                return httpError(429, '0');
            }
            return translated('Recovered');
        });
        const result = await s.run(s.api.translateChatText('Hello'));
        assert.equal(calls.length, kind === '400' ? 1 : 3);
        assert.equal(result.success, kind !== '400');
        if (calls.length === 3) {
            assert.ok(calls[1] - calls[0] >= 1000);
            assert.ok(calls[2] - calls[1] >= 3000);
        }
    }
});

test('long Retry-After seconds and HTTP dates pause the entire queue without early network calls', async () => {
    for (const dateHeader of [false, true]) {
        const calls = [];
        const s = service(async (url, options, now) => {
            calls.push(now);
            return calls.length === 1
                ? httpError(429, dateHeader ? new Date(now + 60000).toUTCString() : '60')
                : translated('Recovered');
        });
        const result = await s.run(Promise.all([s.api.translateChatText('One'), s.api.translateChatText('Two')]));
        assert.equal(calls.length, 1, 'queued messages must not bypass a server cooldown');
        assert.ok(result.every(r => r.success === false));
        s.advance(60000);
        assert.equal((await s.run(s.api.translateChatText('Three'))).text, 'Recovered');
        assert.ok(calls[1] - calls[0] >= 60000);
    }
});

test('a terminal 429 also delays the next queued request', async () => {
    const calls = [];
    const s = service(async (url, options, now) => {
        calls.push(now);
        return calls.length <= 3 ? httpError(429, '0') : translated('Next');
    });
    const [failed, next] = await s.run(Promise.all([s.api.translateChatText('One'), s.api.translateChatText('Two')]));
    assert.equal(failed.success, false); assert.equal(next.text, 'Next');
    assert.ok(calls[3] - calls[2] >= 3000);
});

test('timeout covers response bodies, clears attempts and releases the queue', async () => {
    let calls = 0;
    const s = service(async (url, { signal }) => {
        calls++;
        if (calls > 3) return translated('Next');
        return { ok: true, status: 200, json: () => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }) };
    });
    const [failed, next] = await s.run(Promise.all([s.api.translateChatText('One'), s.api.translateChatText('Two')]));
    assert.equal(calls, 4); assert.equal(failed.success, false);
    assert.match(failed.error, /15 с/); assert.equal(next.text, 'Next');
});

test('invalid responses and failed lot fields are errors, not unchanged successful translations', async () => {
    const invalid = service(async () => ({ ok: true, status: 200, json: async () => ({ error: 'bad payload' }) }));
    assert.equal((await invalid.run(invalid.api.translateChatText('Hello'))).success, false);
    let calls = 0;
    const failed = service(async () => { calls++; return httpError(403); });
    const result = await failed.run(failed.api.translateLotFields({ title: 'Name', description: 'Description', buyerMessage: 'Thanks' }));
    assert.equal(result.success, false); assert.equal(calls, 1);
    assert.equal(result.data, undefined, 'callers must not overwrite existing translated fields on failure');
});

test('nothing is sent to Google Translate until the user has allowed it', async () => {
    const calls = [];
    const s = service(async url => { calls.push(url); return translated('T'); }, { consent: false });
    const chat = await s.run(s.api.translateChatText('Hello'));
    const lot = await s.run(s.api.translateLotFields({ title: 'Title', description: 'Text', buyerMessage: '' }));
    assert.equal(calls.length, 0);
    assert.equal(chat.success, false); assert.equal(chat.consentRequired, true);
    assert.equal(lot.success, false); assert.equal(lot.consentRequired, true);
});
