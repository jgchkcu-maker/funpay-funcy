const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

async function openSite(browser, { sourceRoot = root, dark = false, url = 'https://funpay.com/users/123/', seed = {}, eager = true, width = 1204 } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 789 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const file = new URL(route.request().url()).pathname.slice(1);
        if (/^(icons|fonts)\/[\w.-]+$/.test(file) && fs.existsSync(path.join(sourceRoot, file))) return route.fulfill({ path: path.join(sourceRoot, file) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(url);
    await page.setContent(`<html${dark ? ' class="fpt-theme-dark"' : ' class="bg-light-color"'}><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'};color:${dark ? '#eee' : '#333'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"><h1 class="page-header">QA</h1><div class="tc-selling"><a class="tc-item info" href="/lots/offer?id=501"><div class="tc-date"><span class="tc-date-time">сегодня, 12:00</span></div><div class="tc-title">Тестовый лот</div><div class="tc-price" data-s="100">100 ₽</div></a></div><div class="js-main-chat"><div class="chat-header"><ul class="dropdown-menu"></ul></div><div class="chat-message-list"></div><form class="chat-form"><div class="chat-form-input"><textarea></textarea></div><button type="button" class="chat-btn-image">Фото</button></form></div></main></body></html>`);
    await page.evaluate(initial => {
        document.body.dataset.appData = JSON.stringify([{ userId: '123' }]);
        const state = { showSalesStats: false, viewSellersPromo: false, hideBalance: false, fpToolsNavCollapsed: false, ...initial };
        const listeners = new Set();
        const read = keys => keys == null ? structuredClone(state) : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys]).map(k => [k, structuredClone(state[k])]));
        const write = patch => {
            const changes = {};
            for (const [key, value] of Object.entries(patch)) { changes[key] = { oldValue: state[key], newValue: value }; state[key] = structuredClone(value); }
            for (const fn of listeners) fn(changes, 'local');
        };
        window.qaState = state;
        window.qaExternal = write;
        window.qaMessages = [];
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const result = read(keys); callback?.(result); return Promise.resolve(result); },
                set(patch, callback) { write(patch); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { [].concat(keys).forEach(k => delete state[k]); callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } },
            runtime: {
                id: 'qa', getURL: file => `https://funpay.com/${file}`, getManifest: () => ({ version: 'test' }),
                onMessage: { addListener() {}, removeListener() {} },
                sendMessage(message, callback) {
                    window.qaMessages.push(message);
                    const result = ['getUserLotsList', 'getUserCategories', 'getBlacklist', 'getSales'].includes(message?.action) ? [] : { ok: true, success: true, data: [], tickets: [], accounts: [] };
                    callback?.(result); return Promise.resolve(result);
                }
            }
        };
    }, seed);
    const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(s => s.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(sourceRoot, css) });
    for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(sourceRoot, js) });
    if (eager && fs.existsSync(path.join(sourceRoot, 'background/popup_bundle.json'))) {
        const bundle = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'background/popup_bundle.json'), 'utf8'));
        for (const css of bundle.css) await page.addStyleTag({ path: path.join(sourceRoot, css) });
        for (const js of bundle.js) await page.addScriptTag({ path: path.join(sourceRoot, js) });
    }
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    return { page, errors };
}
module.exports = { launch, openSite, root };
