const test = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('./helpers/popup_actions_harness');

test('deleted selection dialogs retain explicit selection and save actions', async () => {
    const h = context({ fpToolsSelectedBumpCategories: ['saved'], hideBalance: true });
    h.load('content/features/misc.js'); h.load('content/features/lot_io.js');
    const categories = [{ id: 'a' }, { id: 'b' }];
    assert.deepEqual(Array.from(await h.api.run('autobump', 'autobump-select-all', { categories, selectedCategoryIds: ['a'] })), ['a', 'b']);
    assert.deepEqual(Array.from(await h.api.run('lot_io', 'lot-io-select-all', { categories, selectedCategoryIds: ['a', 'b'] })), []);
    assert.deepEqual(h.saved.fpToolsSelectedBumpCategories, ['saved']);
    await h.api.run('autobump', 'autobump-category-save', { selectedCategoryIds: ['a'] });
    assert.deepEqual(h.saved, { fpToolsSelectedBumpCategories: ['a'], hideBalance: true });
    await assert.rejects(h.api.run('autobump', 'autobump-category-save', {}), /selectedCategoryIds/);
});

test('bulk lot edits preserve native fields and accept literal replacements and explicit empty fields', async () => {
    const h = context(); let submitted;
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        if (message.action === 'getLotForExport') return { success: true, data: {
            price: '100', 'fields[summary][ru]': 'a.b aXb', 'fields[desc]': 'old',
            'fields[payment_msg]': 'message', secrets: 'retained', active: 'on'
        } };
        submitted = message.data; return { success: true };
    };
    h.load('content/features/bulk_lot_editor.js');
    const result = await h.api.run('lot_io', 'fp-bulk-apply-btn', { lots: [{ id: 'lot', nodeId: 'node' }], changes: {
        findReplace: { find: 'a.b', replace: 'new' }, description: '', price: { mode: 'pct_up', value: 10 }
    } });
    assert.equal(result.successCount, 1);
    assert.equal(submitted['fields[summary][ru]'], 'new aXb');
    assert.equal(submitted['fields[desc]'], ''); assert.equal(submitted['fields[payment_msg]'], 'message');
    assert.equal(submitted.price, '110'); assert.equal(submitted.secrets, 'retained');
    assert.equal(submitted.offer_id, 'lot');
});

test('lot export reports failed items and rejects when nothing could be exported', async () => {
    const h = context(); const errors = [];
    h.ctx.console = { error() {} };
    h.ctx.chrome.runtime.sendMessage = async () => ({ success: false, error: 'offline' });
    h.load('content/features/lot_io.js');
    await assert.rejects(h.api.run('lot_io', 'lot-io-export-confirm', {
        categories: [{ id: 'a', lots: [{ id: 'x', title: 'X', nodeId: 'n' }] }], selectedCategoryIds: ['a'],
        delayMs: 0, onError: error => errors.push(error)
    }), /offline/);
    assert.equal(errors[0].offerId, 'x');
});

test('lot export stops before requesting another lot when its abort signal is set', async () => {
    const h = context();
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        return { success: true, data: { title: 'exported lot' } };
    };
    h.load('content/features/lot_io.js');
    const controller = new AbortController();
    await assert.rejects(h.api.run('lot_io', 'lot-io-export-confirm', {
        categories: [{ id: 'a', lots: [
            { id: 'first', title: 'First', nodeId: 'n' },
            { id: 'second', title: 'Second', nodeId: 'n' }
        ] }],
        selectedCategoryIds: ['a'],
        delayMs: 0,
        signal: controller.signal,
        onProgress: progress => { if (progress.current === 1) controller.abort(); }
    }), error => error.name === 'AbortError');
    assert.deepEqual(h.messages, []);
});

test('bulk lot updates stop before writing the next selected lot when cancelled', async () => {
    const h = context();
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        if (message.action === 'getLotForExport') {
            return { success: true, data: { 'fields[summary][ru]': 'Original', price: '100' } };
        }
        return { success: true };
    };
    h.load('content/features/bulk_lot_editor.js');
    const controller = new AbortController();
    await assert.rejects(h.api.run('lot_io', 'fp-bulk-apply-btn', {
        lots: [
            { id: 'first', nodeId: 'n' },
            { id: 'second', nodeId: 'n' }
        ],
        changes: { name: 'Updated' },
        delayMs: 0,
        signal: controller.signal,
        onProgress: progress => { if (progress.processed === 1) controller.abort(); }
    }), error => error.name === 'AbortError');
    assert.deepEqual(h.messages.map(message => message.action), ['getLotForExport', 'saveSingleLot']);
});

test('gallery button IDs load data, cycle and apply without mounting a card', async () => {
    const h = context(); const theme = { bgColor1: '#ffffff', font: 'Inter' };
    h.ctx.fetch = async url => ({ ok: true, json: async () => url.endsWith('index.json')
        ? [{ name: 'one', file: 'one.fptheme' }, { name: 'two', file: 'two.fptheme' }] : theme });
    h.ctx.fptSanitizeThemeColors = value => value;
    h.ctx.applyCustomTheme = h.ctx.applyHeaderPosition = async () => {};
    h.load('content/features/theme_gallery.js');
    const catalog = await h.api.run('theme', 'fptg-load'); assert.equal(catalog.length, 2);
    assert.deepEqual(h.saved, {});
    const selected = await h.api.run('theme', 'fptg-next'); assert.equal(selected.theme.name, 'two');
    assert.equal((await h.api.run('theme', 'fptg-prev')).theme.name, 'one');
    await h.api.run('theme', 'applyCurrent'); assert.deepEqual(h.saved.fpToolsTheme, theme);
    assert.equal(h.saved.enableCustomTheme, undefined);
    await h.api.run('theme', 'fp-wp-apply-cur'); assert.equal(h.saved.enableCustomTheme, true);
});

test('settings backup retains its format, exclusions and atomic auto-reply import', async () => {
    const h = context({ hideBalance: true, fpToolsAccounts: [{ key: 'private' }], fpToolsGCToken: 'private',
        fpToolsAutoReplies: { greetingText: 'saved' } });
    let imported;
    h.ctx.window.fptImportAutoReplies = async config => { imported = config; };
    h.load('content/features/settings_io.js');
    const backup = await h.api.run('settings_io', 'fp-settings-export-btn');
    assert.equal(backup._magic, 'FPTCONFIG'); assert.equal(backup._version, 2);
    assert.equal(backup.settings.hideBalance, true); assert.equal(backup.settings.fpToolsAccounts, undefined);
    assert.equal(backup.settings.fpToolsGCToken, undefined);
    await h.api.run('settings_io', 'fp-settings-import-btn', { data: { _magic: 'FPTCONFIG', settings: {
        hideBalance: false, fpToolsAccounts: [], fpToolsAutoReplies: { greetingText: 'new' }
    } } });
    assert.equal(h.saved.hideBalance, false); assert.equal(h.saved.fpToolsAccounts[0].key, 'private');
    assert.equal(imported.greetingText, 'new'); assert.equal(h.saved.fpToolsAutoReplies.greetingText, 'saved');
});

test('settings backups cannot export or restore retired piggy-bank data', async () => {
    const h = context({ hideBalance: true });
    h.load('content/features/settings_io.js');
    const backup = await h.api.run('settings_io', 'fp-settings-export-btn');
    assert.equal(Object.hasOwn(backup.settings, 'fpToolsPiggyBanks'), false);
    await h.api.run('settings_io', 'fp-settings-import-btn', { data: {
        _magic: 'FPTCONFIG', settings: {
            fpToolsPiggyBanks: [{ id: 9, name: 'Old goal' }],
            fpToolsPageModes: { calculator: 'time', currency_calc: 'currency', finance_hub: 'profit' }
        }
    } });
    assert.equal(Object.hasOwn(h.saved, 'fpToolsPiggyBanks'), false);
    assert.deepEqual(h.saved.fpToolsPageModes, { finance_hub: 'profit' });
});

test('concurrent feature mutations and partial settings writes retain both explicit changes', async () => {
    const h = context({ fpToolsAccounts: [{ name: 'one', key: '1' }, { name: 'two', key: '2' }],
        fpToolsSlashCommands: { enabled: true, commands: [{ id: 'one', response: 'old1' }, { id: 'two', response: 'old2' }] },
        fpToolsTheme: { font: 'Inter', textColor: '#111111' } });
    h.ctx.fpToolsAccounts = []; h.load('content/features/accounts.js'); h.load('content/features/blacklist.js');
    h.load('content/features/slash_commands_ui.js'); h.load('content/features/theme.js');
    h.ctx.applyCustomTheme = h.ctx.applyHeaderPosition = async () => {};
    await Promise.all([
        h.api.run('accounts', 'renameAccount', { key: '1', name: 'new1' }),
        h.api.run('accounts', 'renameAccount', { key: '2', name: 'new2' }),
        h.api.run('blacklist', 'fp-bl-add-btn', { username: 'one' }),
        h.api.run('blacklist', 'fp-bl-add-btn', { username: 'two' }),
        h.api.run('templates', 'saveSlashCommand', { id: 'one', settings: { response: 'new1' } }),
        h.api.run('templates', 'saveSlashCommand', { id: 'two', settings: { response: 'new2' } }),
        h.api.run('theme', 'uploadBgImageBtn', { dataUrl: 'new-image' }),
        h.api.run('theme', 'saveSettings', { settings: { fpToolsTheme: { font: 'Arial' } } })
    ]);
    assert.deepEqual(h.saved.fpToolsAccounts.map(a => a.name), ['new1', 'new2']);
    assert.deepEqual(h.saved.fpToolsBlacklist.map(a => a.username), ['one', 'two']);
    assert.deepEqual(h.saved.fpToolsSlashCommands.commands.map(a => a.response), ['new1', 'new2']);
    assert.equal(h.saved.fpToolsTheme.bgImage, 'new-image'); assert.equal(h.saved.fpToolsTheme.font, 'Arial');
});

test('keyword attachments use the real atomic store and support an image-only response', async () => {
    const { createAutoReplyStore } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../background/auto_reply_store.js')).href);
    const h = context({ fpToolsAutoReplies: { keywords: [{ keyword: 'old', response: 'saved' }] } });
    const store = createAutoReplyStore(h.ctx.chrome.storage.local);
    h.ctx.window.fptPatchAutoReplies = patch => store.patchAutoReplies(patch);
    h.load('content/features/auto_review.js');
    await h.api.run('auto_reply', 'addKeywordBtn', { keyword: 'delivery', images: ['data:image/png;base64,AQ=='], sendOrder: 'images_first' });
    const rule = h.saved.fpToolsAutoReplies.keywords[1];
    assert.equal(rule.response, ''); assert.equal(rule.images.length, 1); assert.equal(rule.sendOrder, 'images_first');
    assert.equal(h.saved.fpToolsAutoReplies.keywords[0].response, 'saved');
});

test('ticket submit returns a validated draft and only confirmation sends it', async () => {
    const h = context(); h.load('content/features/support.js');
    await assert.rejects(h.api.run('tickets', 'fp-new-ticket-submit', { categoryId: '1' }), /сообщение/);
    const draft = await h.api.run('tickets', 'fp-new-ticket-submit', { categoryId: '1', message: 'Please confirm', fieldValues: { field: 'value' } });
    assert.equal(h.messages.length, 0); assert.equal(draft.message, 'Please confirm');
    await h.api.run('tickets', 'fp-ticket-confirm-yes', draft);
    assert.equal(h.messages.length, 1); assert.equal(h.messages[0].action, 'supportCreateTicket');
    assert.equal(h.messages[0].fieldValues.field, 'value');
});
