const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { context } = require('./helpers/popup_actions_harness');
const classification = require('./settings_io_key_classification.json');
const root = path.join(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test('every prefixed literal has an explicit backup decision, including dynamic key prefixes', () => {
    const h = context(); h.load('content/features/settings_io.js');
    const exported = new Set(classification.exported), device = new Set(classification.deviceOnly);
    for (const key of exported) { assert.ok(!device.has(key), key); assert.equal(h.ctx.isExportable(key), true, key); }
    for (const key of device) assert.equal(h.ctx.isExportable(key), false, key);
    // Deliberately conservative: prefixed DOM IDs and message names also require a decision.
    // This avoids missing storage keys passed indirectly through constants or helper calls.
    for (const file of [...walk(path.join(root, 'content')), ...walk(path.join(root, 'background'))].filter(f => /\.(?:js|mjs)$/.test(f))) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/['"`]((?:fpTools|fpt[A-Z])[A-Za-z0-9_]*)['"`]/g)) {
            assert.ok(exported.has(match[1]) || device.has(match[1]), `Classify new key ${match[1]} in ${path.relative(root, file)}`);
        }
    }
});

test('device sessions and verification queues never leave or enter settings backups', async () => {
    const secret = { fptPendingVerifyLots: { 123: Date.now() }, fptProfileSession_1: 'session', fptLastVerifyAt: 1,
        fptProfileDescrCache_1: 'cached', fpToolsAutoResponderTag: 'runner', fpToolsStockManagementReleasedV2: true, fpToolsQuickGames: [] };
    const h = context(secret); h.load('content/features/settings_io.js');
    const backup = await h.api.run('settings_io', 'fp-settings-export-btn');
    assert.deepEqual(Object.keys(backup.settings), ['fpToolsQuickGames']);
    const target = context(); target.load('content/features/settings_io.js');
    await target.api.run('settings_io', 'fp-settings-import-btn', { data: { _magic: 'FPTCONFIG', settings: secret } });
    assert.deepEqual(Object.keys(target.saved), ['fpToolsQuickGames']);
    assert.deepEqual(Array.from(target.ctx.getImportableKeys({ data: { settings: secret } })), ['fpToolsQuickGames']);
});

test('import normalizes known settings before writing and rejects oversized files before reading', async () => {
    const h = context(); h.load('content/features/settings_io.js');
    await h.api.run('settings_io', 'fp-settings-import-btn', { data: { _magic: 'FPTCONFIG', settings: {
        fpToolsQuickGames: [{ title: '<img>', url: 'javascript:alert(1)' }, { title: 'Game', url: 'https://funpay.com/lots/1/' }],
        fpToolsPinnedLots: [{ offerId: '1', nodeId: '2', title: '<img>', price: '10', lotUrl: 'javascript:1' }, { offerId: 'bad', nodeId: '2' }],
        fpToolsCtxPinnedLots: [{ offerId: '3', title: '<b>x</b>', lotUrl: 'javascript:1' }],
        fpToolsHeaderButtonStyles: { size: '1px}body{display:none', opacity: -50 },
        fpToolsTheme: { font: "x');}", bgImage: 'javascript:1' },
        fpToolsLiveStyles: { body: { color: 'red', width: '1px;}body{display:none', background: 'url(javascript:alert(1))',
            'background-image': 'url(https://example.com/background.png)' } }
    } } });
    assert.equal(h.saved.fpToolsQuickGames.length, 1);
    assert.equal(h.saved.fpToolsPinnedLots.length, 1); assert.equal(h.saved.fpToolsPinnedLots[0].lotUrl, undefined);
    assert.equal(h.saved.fpToolsCtxPinnedLots[0].lotUrl, undefined);
    assert.deepEqual(h.saved.fpToolsHeaderButtonStyles, { size: 14, opacity: 10 });
    assert.equal(h.saved.fpToolsTheme.font, 'Helvetica Neue'); assert.equal(h.saved.fpToolsTheme.bgImage, '');
    assert.deepEqual(h.saved.fpToolsLiveStyles, { body: { color: 'red', 'background-image': 'url(https://example.com/background.png)' } });
    await assert.rejects(h.api.run('settings_io', 'fp-settings-import-btn', { file: { size: 20 * 1024 * 1024 + 1, text() { throw Error('must not read'); } } }), /20 МБ/);
});
