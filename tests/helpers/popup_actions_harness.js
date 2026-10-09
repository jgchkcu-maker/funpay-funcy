const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function context(initial = {}) {
    const saved = structuredClone(initial);
    const messages = [];
    const sandbox = {
        window: { location: { pathname: "/" } }, MutationObserver: class { observe() {} }, console, setTimeout, clearTimeout, Date, URL, Blob,
        document: { getElementById() { throw Error('Old popup DOM must not be read'); },
            querySelector() { return null; } },
        chrome: { storage: { local: {
            async get(keys) {
                if (keys == null) return structuredClone(saved);
                return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, structuredClone(saved[k])]));
            },
            async set(patch) { Object.assign(saved, structuredClone(patch)); },
            async remove(keys) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete saved[key]); }
        }, onChanged: { addListener() {}, removeListener() {} } }, runtime: {
            async sendMessage(message, callback) { messages.push(message); const result = { success: true, data: [], key: 'session' }; callback?.(result); return result; },
            getURL(value) { return value; }, getManifest() { return { version: 'test' }; }
        } }
    };
    const ctx = vm.createContext(sandbox);
    const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), ctx, { filename: file });
    load('background/retired_integrations.js');
    const source = path.join(__dirname, '../..', 'content/ui/popup_actions.js');
    if (fs.existsSync(source)) load('content/ui/popup_actions.js');
    return { ctx, load, saved, messages, api: sandbox.window.fptPopupActions };
}


module.exports = { context };
