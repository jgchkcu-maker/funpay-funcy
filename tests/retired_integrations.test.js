const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanup, sanitizeSettings, isRetiredKey } = require('../background/retired_integrations.js');
const { context } = require('./helpers/popup_actions_harness');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function legacySettings(page = 'telegram') {
    return {
        fpToolsTelegram: { enabled: true, token: 'old-token', chatId: '42' },
        fpToolsTelegramProcessedIds: ['1'], fpToolsTelegramOrdersSeeded: true,
        fpToolsDiscord: { enabled: true, webhookUrl: 'old-webhook' },
        fpToolsProcessedDiscordIds: ['2'], discordSent_123: true,
        logToDiscord: true, discordWebhookUrl: 'legacy-webhook',
        fpToolsAutoRestoreEnabled: true, fpToolsAutoDisableEnabled: true,
        notificationSound: 'custom', notificationVolume: 0.5,
        fpToolsCustomSoundData: 'data:audio/wav;base64,old', fpToolsCustomSoundMeta: { length: 4 },
        fpToolsGCToken: 'community-token', fpToolsGCConfig: { active: true, display: true }, fpToolsGCConfigTs: 123,
        fpToolsLastPage: page, fpToolsLastPageMode: 'discord',
        fpToolsPageModes: { telegram: 'discord', support: null, global_chat: null, templates: 'commands' },
        fpToolsBlacklist: [{ username: 'Buyer', blockNotification: true, blockResponse: true, note: 'Keep' }],
        fpToolsAccounts: [{ key: 'session' }], fpToolsSlashCommands: { enabled: true, commands: [] },
        fpToolsTheme: { accent: '#7663f6' }, fpToolsAutoReplies: { greetingEnabled: true },
        fpToolsSalesCache: ['keep']
    };
}

test('worker cleanup cancels only retired alarms, removes secrets and keeps unrelated data', async () => {
    const saved = legacySettings('global_chat');
    const alarms = new Set(['fpToolsTelegramPoll', 'fpToolsDiscordCheck', 'fpToolsAutoResponder', 'fpToolsAutoRestore']);
    const writes = [];
    const storage = {
        async get() { return structuredClone(saved); },
        async remove(keys) { keys.forEach(key => delete saved[key]); },
        async set(patch) { writes.push(patch); Object.assign(saved, structuredClone(patch)); }
    };
    await cleanup(storage, { async clear(name) { alarms.delete(name); } });
    assert.ok(Object.keys(saved).every(key => !isRetiredKey(key)));
    assert.deepEqual([...alarms], ['fpToolsAutoResponder'], 'the stock sweep alarm is cancelled with the retired integrations');
    assert.equal(saved.fpToolsLastPage, 'lot_io');
    assert.equal(saved.fpToolsLastPageMode, null);
    assert.deepEqual(saved.fpToolsPageModes, { templates: 'commands' });
    assert.deepEqual(saved.fpToolsBlacklist, [{ username: 'Buyer', blockResponse: true, note: 'Keep' }]);
    for (const key of ['fpToolsAccounts', 'fpToolsSlashCommands', 'fpToolsTheme', 'fpToolsAutoReplies', 'fpToolsSalesCache',
        'notificationSound', 'notificationVolume', 'fpToolsCustomSoundData', 'fpToolsCustomSoundMeta']) {
        assert.deepEqual(saved[key], legacySettings()[key]);
    }
    await cleanup(storage, { async clear(name) { alarms.delete(name); } });
    assert.equal(writes.length, 1, 'repeated worker starts do not rewrite clean settings');
});

test('retired rating route resets, active routes and malformed legacy values remain safe', () => {
    assert.equal(sanitizeSettings(legacySettings('telegram')).fpToolsLastPage, 'lot_io');
    assert.equal(sanitizeSettings(legacySettings('support')).fpToolsLastPage, 'lot_io');
    assert.equal(sanitizeSettings(legacySettings('global_chat')).fpToolsLastPage, 'lot_io');
    const active = legacySettings('tickets');
    active.fpToolsPageModes = null;
    active.fpToolsBlacklist = [null, 'old', { username: 'Buyer', blockDelivery: false }];
    assert.equal(sanitizeSettings(active).fpToolsLastPage, 'tickets');
    assert.deepEqual(sanitizeSettings(active).fpToolsBlacklist, active.fpToolsBlacklist);
    assert.equal(active.fpToolsTelegram.token, 'old-token', 'sanitization never mutates its input');
});

test('old backups cannot export or restore integrations or retired route state; sound choice survives without the heavy clip', async () => {
    const h = context(legacySettings('support'));
    h.load('content/features/settings_io.js');
    const backup = await h.api.run('settings_io', 'fp-settings-export-btn');
    assert.ok(Object.keys(backup.settings).every(key => !isRetiredKey(key)));
    assert.equal(backup.settings.fpToolsLastPage, undefined, 'device navigation is excluded from export');
    assert.deepEqual(JSON.parse(JSON.stringify(backup.settings.fpToolsPageModes)), { templates: 'commands' });
    assert.equal(backup.settings.fpToolsBlacklist[0].blockNotification, undefined);
    assert.equal(backup.settings.notificationSound, 'custom');
    assert.equal(backup.settings.notificationVolume, 0.5);
    assert.equal(backup.settings.fpToolsCustomSoundData, undefined, 'the recorded clip is too heavy for backups');
    assert.equal(backup.settings.fpToolsCustomSoundMeta, undefined, 'clip metadata never outlives the clip');
    const target = context();
    target.ctx.window.fptImportAutoReplies = async value => { target.saved.fpToolsAutoReplies = structuredClone(value); };
    target.load('content/features/settings_io.js');
    await target.api.run('settings_io', 'fp-settings-import-btn', {
        data: { _magic: 'FPTCONFIG', _version: 2, settings: legacySettings() }
    });
    assert.ok(Object.keys(target.saved).every(key => !isRetiredKey(key)));
    assert.deepEqual(target.saved.fpToolsPageModes, { templates: 'commands' });
    assert.equal(target.saved.fpToolsBlacklist[0].blockNotification, undefined);
    assert.deepEqual(target.saved.fpToolsTheme, legacySettings().fpToolsTheme);
    assert.deepEqual(target.saved.fpToolsSlashCommands, legacySettings().fpToolsSlashCommands);
    assert.deepEqual(target.saved.fpToolsAutoReplies, { greetingEnabled: true });
    assert.equal(target.saved.notificationVolume, 0.5);
    assert.equal(target.saved.fpToolsCustomSoundData, undefined);
});

test('retired popup pages reject actions and registrations', async () => {
    const h = context();
    for (const page of ['telegram', 'support', 'global_chat']) {
        assert.deepEqual(Array.from(h.api.list(page)), []);
        assert.throws(() => h.api.register(page, 'test', () => {}), /Invalid popup action registration/);
        await assert.rejects(h.api.run(page, 'saveSettings', { settings: {} }), /Unknown popup action/);
    }
});

test('manifest resources exist, notification permissions are removed and bundled sounds are reachable', () => {
    const manifest = JSON.parse(read('manifest.json'));
    assert.ok(!manifest.permissions.includes('notifications'));
    assert.ok(!manifest.host_permissions.some(host => host.includes('api.telegram.org')));
    assert.ok(!manifest.host_permissions.some(host => host.includes('fpt-chat.starobinskiy01.workers.dev')));
    for (const group of manifest.content_scripts) {
        for (const file of [...(group.js || []), ...(group.css || [])]) assert.ok(fs.existsSync(path.join(root, file)), file);
    }
    const scripts = manifest.content_scripts.find(group => group.js?.includes('content/features/settings_io.js')).js;
    assert.ok(scripts.indexOf('background/retired_integrations.js') < scripts.indexOf('content/features/settings_io.js'));
    assert.ok(scripts.includes('content/features/slash_commands_ui.js'));
    assert.ok(!scripts.includes('content/features/global_chat.js'));
    assert.ok(!fs.existsSync(path.join(root, 'content/features/global_chat.js')));
    assert.ok(!fs.existsSync(path.join(root, 'public-chat.json')));
    const resources = manifest.web_accessible_resources.flatMap(group => group.resources);
    assert.ok(resources.includes('sounds/*.mp3'), 'preset sounds can be played on FunPay');
    const config = JSON.parse(read('config.v1.json'));
    assert.equal(config.features.integrations, undefined);
    assert.equal(config.notifySound, undefined);
    assert.equal(config.features.globalChat, undefined);
    assert.equal(config.globalChat, undefined);
});

test('worker retirement runs on load and install, while shared parsing and support stay available', () => {
    const worker = read('background/background.js');
    assert.match(worker, /const retiredIntegrationCleanup = globalThis\.FPTRetiredIntegrations\.cleanup/);
    assert.match(worker, /onInstalled\.addListener\(async[^]*?await retiredIntegrationCleanup;[^]*?FPTRetiredIntegrations\.cleanup/);
    assert.doesNotMatch(worker, /telegramValidate|telegramTest|runTelegramCheckCycle|runDiscordCheckCycle|api\.telegram\.org/);
    const offscreen = read('offscreen/offscreen.js');
    assert.doesNotMatch(offscreen, /parseOrdersDetailed|parseProfileInfo/);
    for (const parser of ['parseChatList', 'parseUserLotsList', 'parseOrdersPage']) assert.ok(offscreen.includes(`function ${parser}(`));
    assert.ok(worker.includes("request.action === 'supportGetTickets'"));
    assert.doesNotMatch(read('popup/popup.html'), /reviewBtn|Оценить/);
    assert.doesNotMatch(read('popup/popup.js'), /reviewBtn|chromewebstore\.google\.com/);
    assert.doesNotMatch(read('content/content_script.js'), /initializeCustomSound|applyNotificationSound/);
    for (const file of ['content/content_script.js', 'content/ui/main_popup.js', 'content/ui/popup_metadata.js']) {
        assert.doesNotMatch(read(file), /fptGc|global_chat|public-chat\.json|fpt:global-chat-visibility/);
    }
    assert.ok(read('content/utils.js').includes('function showNotification('));
});

test('removed supplier module leaves no settings or page behind', () => {
    assert.ok(isRetiredKey('fpToolsSupplierMappings'));
    assert.ok(isRetiredKey('fpToolsSupplierPilot'));
    const result = sanitizeSettings({ fpToolsLastPage: 'suppliers', fpToolsPageModes: { suppliers: 'x', lot_io: null } });
    assert.equal(result.fpToolsLastPage, 'lot_io');
    assert.deepEqual(result.fpToolsPageModes, { lot_io: null });
});
