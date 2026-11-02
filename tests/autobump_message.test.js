const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

test('raise-all message uses the imported bump cycle and returns a summary for currency lots and auth failure', async () => {
    const root = path.join(__dirname, '..');
    const source = fs.readFileSync(path.join(root, 'background/background.js'), 'utf8');
    const autobump = await import(pathToFileURL(path.join(root, 'background/autobump.js')).href);
    const importedNames = source.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/autobump\.js['"]/)[1]
        .split(',').map(name => name.trim());
    // Only expose names actually imported by the worker: a missing binding must fail here.
    const bindings = Object.fromEntries(importedNames.map(name => [name, autobump[name]]));
    const savedChrome = globalThis.chrome;
    const savedFetch = globalThis.fetch;
    const requests = [], alarms = [];
    let authenticated = true;
    const stored = {};
    let listener;
    const api = {
        cookies: { get: async () => authenticated ? { value: 'synthetic-cookie' } : null },
        storage: { local: {
            get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, stored[key]])),
            set: async data => Object.assign(stored, data)
        } },
        tabs: {
            query: async () => [{ id: 1 }],
            sendMessage: async (id, message) => message.action === 'getAppData'
                ? { success: true, data: { userId: '100', 'csrf-token': 'synthetic-csrf' } } : undefined
        },
        runtime: {
            onMessage: { addListener: callback => { listener = callback; } },
            getURL: file => `chrome-extension://test/${file}`,
            getContexts: async () => [{}],
            sendMessage: async message => {
                assert.equal(message.action, 'parseUserCategories');
                return [{ id: '/chips/42/trade', name: 'Валюта', raisable: false }];
            }
        },
        offscreen: { closeDocument: async () => {} },
        alarms: {
            create: async (...args) => alarms.push(args),
            clear: async (...args) => alarms.push(args)
        }
    };
    try {
        globalThis.chrome = api;
        globalThis.fetch = async (url, options) => {
            requests.push({ url: String(url), method: options?.method || 'GET' });
            assert.equal(String(url), 'https://funpay.com/users/100/');
            return { ok: true, text: async () => '<synthetic-profile>' };
        };
        const ctx = vm.createContext({ ...bindings, chrome: api });
        vm.runInContext(source.slice(source.indexOf('chrome.runtime.onMessage.addListener('), source.indexOf('    // AUTOBUMP HANDLERS')) + '\n});', ctx);
        const raise = () => new Promise(resolve => {
            assert.equal(listener({ action: 'fptRaiseAllNow' }, {}, resolve), true, 'keep the response channel open');
        });
        const result = await raise();
        assert.equal(result.ok, true);
        assert.equal(result.summary.raised, 0);
        assert.equal(result.summary.skipped, 1, 'currency categories are skipped by the real cycle');
        assert.equal(result.summary.errors, 0);
        assert.equal(requests.length, 1);

        authenticated = false;
        const failed = await raise();
        assert.equal(failed.ok, true, 'the cycle reports an auth failure through its summary');
        assert.equal(failed.summary.errors, 1);
        assert.equal(requests.length, 1, 'no network write without auth');
        assert.deepEqual(alarms, [], 'manual raising does not enable or reschedule autobump');
    } finally {
        globalThis.fetch = savedFetch;
        if (savedChrome === undefined) delete globalThis.chrome;
        else globalThis.chrome = savedChrome;
    }
});
