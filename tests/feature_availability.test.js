const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context: actionsContext } = require('./helpers/popup_actions_harness');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function context(extra = {}) {
    const ctx = vm.createContext({ console, ...extra });
    vm.runInContext(read('background/feature_availability.js'), ctx);
    return ctx;
}
function ai(ctx) {
    vm.runInContext(read('background/translate.js').replace(/^export /gm, ''), ctx);
    vm.runInContext(read('background/ai.js').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), ctx);
}

test('release policy is frozen, rejects all suspended actions and permits translation', () => {
    const ctx = context();
    const policy = ctx.FPTFeatureAvailability;
    assert.ok(Object.isFrozen(policy));
    for (const feature of ['ai', 'rmthub', 'profileDescriptions', 'unknown']) assert.equal(policy.isAvailable(feature), false);
    for (const action of ['getAIProcessedText', 'generateAILot', 'getAIImageSettings', 'rmthubFetch']) {
        const result = policy.unavailableResponse(action);
        assert.equal(result.code, 'FEATURE_UNAVAILABLE');
        assert.equal(action === 'rmthubFetch' ? result.ok : result.success, false);
    }
    assert.equal(policy.unavailableResponse('translateLotText'), null);
    const manifest = JSON.parse(read('manifest.json'));
    const scripts = manifest.content_scripts.find(entry => entry.js?.includes('content/content_script.js')).js;
    assert.equal(scripts[0], 'background/feature_availability.js');
    for (const host of ['fptools.onrender.com', 'fptools-ai-server.vercel.app', 'fpt-descs.starobinskiy01.workers.dev', 'funpay.tools']) {
        assert.ok(!manifest.host_permissions.some(url => url.includes(host)));
    }
    assert.ok(manifest.host_permissions.includes('https://translate.googleapis.com/*'));
});

test('actual worker dispatcher rejects legacy actions without network and still dispatches translation', async () => {
    const urls = [];
    let listener;
    const ctx = context({
        fetch: async url => {
            urls.push(String(url));
            const text = new URL(url).searchParams.get('q');
            return { ok: true, json: async () => [[[`EN:${text}`]]] };
        },
        chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } } }
    });
    ai(ctx);
    const source = read('background/background.js');
    vm.runInContext(source.slice(source.indexOf('chrome.runtime.onMessage.addListener('), source.indexOf('    // AUTOBUMP HANDLERS')) + '\n});', ctx);
    for (const action of ['getAIProcessedText', 'generateAILot', 'getAIImageSettings', 'rmthubFetch']) {
        let response;
        assert.equal(listener({ action, text: 'private text', prompt: 'private text', data: {}, username: 'seller' }, {}, value => { response = value; }), false);
        assert.equal(response.code, 'FEATURE_UNAVAILABLE');
    }
    assert.deepEqual(urls, []);
    const translated = await new Promise(resolve => {
        assert.equal(listener({ action: 'translateLotText', data: { title: 'Название', description: 'Строка 1\n\nСтрока 2', buyerMessage: 'Спасибо' } }, {}, resolve), true);
    });
    assert.deepEqual(plain(translated), { success: true, data: { title: 'EN:Название', description: 'EN:Строка 1\n\nEN:Строка 2', buyerMessage: 'EN:Спасибо' } });
    assert.equal(urls.length, 4);
    assert.ok(urls.every(url => new URL(url).hostname === 'translate.googleapis.com'));
});

test('direct AI transport calls are blocked before fetch or timeout setup', async () => {
    const forbidden = () => { throw Error('Disabled AI touched network or timers'); };
    const ctx = context({ fetch: forbidden, setTimeout: forbidden });
    ai(ctx);
    for (const result of await Promise.all([
        ctx.fetchAIResponse('text', '', 'seller'), ctx.fetchAILotGeneration({}), ctx.fetchAIImageGeneration('image')
    ])) assert.equal(result.code, 'FEATURE_UNAVAILABLE');
});

test('server features install no DOM, storage, verification or timer work on either profile', () => {
    const forbidden = new Proxy({}, { get() { throw Error('Disabled server feature touched the environment'); } });
    for (const pathname of ['/users/1/', '/users/2/']) {
        const ctx = context({ location: { pathname }, document: forbidden, chrome: forbidden,
            fetch: () => assert.fail('network'), setTimeout: () => assert.fail('timer'), setInterval: () => assert.fail('interval') });
        vm.runInContext(read('content/features/profile_descriptions.js'), ctx);
        vm.runInContext(read('content/features/rmthub_search.js'), ctx);
    }
});

test('old templates are blocked atomically before editing drafts or sending either part', async () => {
    for (const sendOrder of ['text_first', 'image_first']) for (const images of [[], ['data:image/png;base64,AA==']])
    for (const token of ['{ai:поблагодари}', '{AI:поблагодари}']) for (const immediate of [true, false]) {
        const messages = [], notices = [];
        const input = { value: 'existing draft', closest: () => ({ querySelector: () => ({ click: () => assert.fail('submitted old draft') }) }) };
        const template = { text: `Hello ${token}`, images, sendOrder };
        const saved = { fpToolsTemplateSettings: { sendTemplatesImmediately: immediate, custom: [template] } };
        const original = structuredClone(saved);
        const ctx = context({ window: {}, document: { querySelector: () => input },
            showNotification: message => notices.push(message),
            chrome: { storage: { local: { get: async () => saved } }, runtime: { sendMessage: message => messages.push(message) } } });
        vm.runInContext(read('content/features/templates.js'), ctx);
        assert.equal((await ctx.applyTemplateToInput(input, template.text, images, sendOrder)).blocked, true);
        await ctx.useTemplate(template);
        assert.equal(input.value, 'existing draft');
        assert.deepEqual(messages, []);
        assert.deepEqual(saved, original);
        assert.equal(notices.length, 2);
        assert.ok(notices.every(message => message.includes('Отредактируйте его перед отправкой')));
    }
});

test('ordinary templates keep substitutions and submit exactly once', async () => {
    let submitted = 0;
    const input = { value: '', disabled: false, focus() {}, dispatchEvent() {},
        closest: () => ({ querySelector: () => ({ disabled: false, click: () => submitted++ }) }) };
    const ctx = context({ window: {}, Event,
        document: { querySelector: selector => selector === '.chat-form-input .form-control' ? input : null },
        chrome: { storage: { local: { get: async () => ({}) } } }, waitForElementToBeEnabled: async () => {} });
    vm.runInContext(read('content/features/templates.js'), ctx);
    await ctx.useTemplate({ text: 'Спасибо, {buyername}! {да|конечно}', images: [] });
    assert.match(input.value, /^Спасибо, покупатель! (да|конечно)$/);
    assert.equal(submitted, 1);
});

test('settings import preserves dormant data and cannot activate the release flags', async () => {
    const original = { fptProfileSession: { token: 'local-session' }, fptProfileDescrCache: { '1': { description: 'saved' } } };
    const h = actionsContext(original);
    h.load('content/features/settings_io.js');
    await h.api.run('settings_io', 'fp-settings-import-btn', { data: { _magic: 'FPTCONFIG', settings: {
        aiModeActive: true, FPTFeatureAvailability: { ai: true, rmthub: true, profileDescriptions: true },
        fpToolsDisabledFeatures: ['chat_ai_rewrite_btn'], fpToolsTemplateSettings: { custom: [{ text: '{ai:old}' }] }
    } } });
    h.load('content/ui/settings_loader.js');
    h.ctx.document.querySelector = () => null;
    await h.ctx.loadSavedSettings();
    assert.equal(vm.runInContext('aiModeActive', h.ctx), false);
    assert.equal(h.saved.aiModeActive, true);
    assert.deepEqual(h.saved.fptProfileSession, original.fptProfileSession);
    assert.deepEqual(h.saved.fptProfileDescrCache, original.fptProfileDescrCache);
    assert.equal(h.saved.fpToolsTemplateSettings.custom[0].text, '{ai:old}');
    assert.equal(h.ctx.FPTFeatureAvailability.isAvailable('ai'), false);
    assert.deepEqual(h.messages, []);
});
