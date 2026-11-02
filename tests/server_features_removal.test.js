const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { context: actionsContext } = require('./helpers/popup_actions_harness');
const { cleanup, sanitizeSettings } = require('../background/retired_integrations.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function context(extra = {}) { return vm.createContext({ console, ...extra }); }

test('removed service files and runtime wiring are absent', () => {
    const removed = ['background/ai.js', 'background/feature_availability.js', 'content/features/ai_chat.js',
        'content/features/ai_lot_creator.js', 'content/features/rmthub_search.js', 'content/features/profile_descriptions.js',
        'content/features/new_chat_starter.js', 'css/ai_creator.css', 'icons/magic.png'];
    for (const file of removed) assert.equal(fs.existsSync(path.join(__dirname, '..', file)), false, file);
    const manifest = JSON.parse(read('manifest.json'));
    const source = read('background/background.js');
    assert.doesNotMatch(source, /fetchAI|getAIProcessedText|generateAILot|getAIImageSettings|rmthubFetch|FPTFeatureAvailability/);
    const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
    assert.ok(scripts.includes('content/features/lot_translation.js'));
    for (const file of removed) assert.ok(!JSON.stringify(manifest).includes(file));
    for (const host of ['fptools.onrender.com', 'fptools-ai-server.vercel.app', 'fpt-descs.starobinskiy01.workers.dev', 'funpay.tools']) {
        assert.ok(!manifest.host_permissions.some(url => url.includes(host)));
    }
    assert.ok(manifest.host_permissions.includes('https://translate.googleapis.com/*'));
});

test('worker dispatcher keeps ordinary Google translation after AI removal', async () => {
    const urls = [];
    let listener;
    const ctx = context({
        AbortController, setTimeout, clearTimeout,
        fetch: async url => {
            urls.push(String(url));
            const text = new URL(url).searchParams.get('q');
            return { ok: true, json: async () => [[[`EN:${text}`]]] };
        },
        // The user has allowed Google Translate (content/features/translate_consent.js).
        chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } },
            storage: { local: { get: async () => ({ fpToolsTranslateConsentAt: 1 }) } } }
    });
    vm.runInContext(read('background/translate.js').replace(/^export /gm, ''), ctx);
    const source = read('background/background.js');
    vm.runInContext(source.slice(source.indexOf('chrome.runtime.onMessage.addListener('), source.indexOf('    // AUTOBUMP HANDLERS')) + '\n});', ctx);
    const translated = await new Promise(resolve => {
        assert.equal(listener({ action: 'translateLotText', data: { title: 'Название', description: 'Строка 1\n\nСтрока 2', buyerMessage: 'Спасибо' } }, {}, resolve), true);
    });
    assert.deepEqual(plain(translated), { success: true, data: { title: 'EN:Название', description: 'EN:Строка 1\n\nEN:Строка 2', buyerMessage: 'EN:Спасибо' } });
    assert.equal(urls.length, 4);
    assert.ok(urls.every(url => new URL(url).hostname === 'translate.googleapis.com'));
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
        assert.ok(notices.every(message => message.includes('Удалите вставку {ai:…} перед отправкой')));
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


test('startup cleanup removes legacy service settings and IDs without touching templates or FunPay accounts', async () => {
    const saved = {
        aiModeActive: true, FPTFeatureAvailability: { ai: true }, fpToolsProfanityWarning: true,
        fptProfileSession: { token: 'legacy' }, fptProfileSession_2: { token: 'legacy2' },
        fptProfileDescrCache: { '1': { description: 'saved' } }, fptProfileDescrCache_2: {},
        fptPendingVerifyLots: { '123': 1 }, fptLastVerifyAt: 1,
        fpToolsDisabledFeatures: ['chat_ai_rewrite_btn', 'rmthub_seller_search', 'profanity_warning', 'lot_ai_gen_btn', 'chat_reply'],
        fpToolsAccounts: [{ id: 'keep' }], fpToolsTemplateSettings: { custom: [{ text: '{ai:old}', images: ['keep'] }] }
    };
    const safe = sanitizeSettings(saved);
    const writes = [];
    const storage = {
        async get() { return structuredClone(saved); },
        async remove(keys) { keys.forEach(key => delete saved[key]); },
        async set(patch) { writes.push(patch); Object.assign(saved, structuredClone(patch)); }
    };
    await cleanup(storage, { async clear() {} });
    assert.deepEqual(saved, safe);
    assert.deepEqual(saved.fpToolsDisabledFeatures, ['chat_reply']);
    assert.deepEqual(saved.fpToolsAccounts, [{ id: 'keep' }]);
    assert.equal(saved.fpToolsTemplateSettings.custom[0].text, '{ai:old}');
    await cleanup(storage, { async clear() {} });
    assert.equal(writes.length, 1);
});

test('old backups cannot reimport removed service settings, but templates remain editable', async () => {
    const h = actionsContext();
    h.load('content/features/settings_io.js');
    await h.api.run('settings_io', 'fp-settings-import-btn', { data: { _magic: 'FPTCONFIG', settings: {
        aiModeActive: true, FPTFeatureAvailability: { ai: true, rmthub: true, profileDescriptions: true },
        fptProfileSession: { token: 'old' }, fptProfileDescrCache: { '1': {} }, fptPendingVerifyLots: {}, fptLastVerifyAt: 1,
        fpToolsDisabledFeatures: ['chat_ai_rewrite_btn', 'chat_reply'], fpToolsTemplateSettings: { custom: [{ text: '{ai:old}' }] }
    } } });
    for (const key of ['aiModeActive', 'FPTFeatureAvailability', 'fptProfileSession', 'fptProfileDescrCache', 'fptPendingVerifyLots', 'fptLastVerifyAt']) {
        assert.equal(Object.hasOwn(h.saved, key), false, key);
    }
    assert.deepEqual(h.saved.fpToolsDisabledFeatures, ['chat_reply']);
    assert.equal(h.saved.fpToolsTemplateSettings.custom[0].text, '{ai:old}');
    assert.deepEqual(h.messages, []);
});
