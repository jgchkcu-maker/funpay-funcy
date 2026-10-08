const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { context } = require('./helpers/popup_actions_harness');

test('actions persist only explicit settings and never read deleted controls', async () => {
    const h = context({ hideBalance: true, showSalesStats: false, fpToolsTheme: { enabled: true, accent: 'saved' } });
    assert.ok(h.api, 'headless action interface must be available');
    await h.api.run('general', 'saveSettings', { settings: { hideBalance: false } });
    assert.deepEqual(h.saved, { hideBalance: false, showSalesStats: false, fpToolsTheme: { enabled: true, accent: 'saved' } });
    assert.deepEqual(h.messages, []);
});

test('auto-reply changes use the existing atomic store and propagate storage failures', async () => {
    const h = context();
    assert.ok(h.api);
    let patch;
    h.ctx.window.fptPatchAutoReplies = async value => { patch = value; return { greetingEnabled: true }; };
    const result = await h.api.run('auto_reply', 'saveSettings', { patch: { set: { greetingEnabled: true } } });
    assert.equal(result.greetingEnabled, true);
    assert.equal(patch.set.greetingEnabled, true);
    h.ctx.window.fptPatchAutoReplies = async () => { throw Error('storage unavailable'); };
    await assert.rejects(h.api.run('auto_review', 'saveSettings', { patch: { set: { autoReviewEnabled: false } } }), /storage unavailable/);
});

test('partial nested settings updates retain saved theme fields', async () => {
    const h = context({ fpToolsTheme: { accent: 'existing', enabled: false, name: 'Custom' } });
    assert.ok(h.api);
    await h.api.run('theme', 'saveSettings', { settings: { fpToolsTheme: { enabled: true } } });
    assert.deepEqual(h.saved.fpToolsTheme, { accent: 'existing', enabled: true, name: 'Custom' });
});

test('opening data actions never writes settings and invalid actions reject', async () => {
    const h = context({ hideBalance: true });
    assert.ok(h.api);
    assert.equal((await h.api.run('general', 'getSettings')).hideBalance, true);
    assert.deepEqual(h.saved, { hideBalance: true });
    await assert.rejects(h.api.run('general', 'not-an-action'), /Unknown popup action/);
    await assert.rejects(h.api.run('general', 'saveSettings', { settings: { fpToolsAutoReplies: {} } }), /fptPatchAutoReplies/);
});

test('account mutations retain session keys and target stable keys without popup elements', async () => {
    const h = context({ fpToolsAccounts: [{ name: 'one', key: 'key-one' }, { name: 'two', key: 'key-two' }] });
    assert.ok(h.api);
    h.ctx.fpToolsAccounts = [];
    h.load('content/features/accounts.js');
    await h.api.run('accounts', 'renameAccount', { key: 'key-two', name: 'renamed' });
    assert.deepEqual(h.saved.fpToolsAccounts, [{ name: 'one', key: 'key-one' }, { name: 'renamed', key: 'key-two' }]);
    await h.api.run('accounts', 'deleteAccount', { key: 'key-one' });
    assert.deepEqual(h.saved.fpToolsAccounts, [{ name: 'renamed', key: 'key-two' }]);
});

test('account actions detect the session, refuse duplicates by key and merge snapshots', async () => {
    const h = context({ fpToolsAccounts: [{ name: 'Main', key: 'session' }, { name: 'Alt', key: 'key-alt' }] });
    h.load('content/features/accounts.js');
    assert.deepEqual({ ...await h.api.run('accounts', 'getCurrentAccount') }, { name: '', key: 'session' });
    await assert.rejects(h.api.run('accounts', 'addCurrentAccountBtn', { name: 'Other' }), /уже сохранён как «Main»/);
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        return message.key === 'key-alt'
            ? { ok: true, snapshot: { username: 'AltSeller', avatar: 'a.png', balance: '50 ₽', unread: 2, loggedIn: false } }
            : { ok: false };
    };
    const accounts = await h.api.run('accounts', 'fptRefreshAccountsBtn', { key: 'key-alt' });
    assert.equal(accounts[1].balance, '50 ₽');
    assert.equal(h.saved.fpToolsAccounts[1].loggedIn, false);
    assert.equal(h.saved.fpToolsAccounts[1].username, 'AltSeller');
    assert.equal(h.saved.fpToolsAccounts[0].balance, undefined);
    await assert.rejects(h.api.run('accounts', 'fptRefreshAccountsBtn', { key: 'session' }), /Не удалось получить данные/);
});

test('lot exports return data without constructing progress bars or modal controls', async () => {
    const h = context();
    assert.ok(h.api);
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        return { success: true, data: { title: 'exported lot' } };
    };
    h.load('content/features/lot_io.js');
    const result = await h.api.run('lot_io', 'lot-io-export-confirm', {
        categories: [{ id: 'category', lots: [{ id: 'lot', nodeId: 'node', title: 'original', categoryName: 'Game' }] }],
        selectedCategoryIds: ['category'], delayMs: 0
    });
    assert.equal(result[0].sourceTitle, 'original');
    assert.equal(result[0].data.title, 'exported lot');
    assert.equal(h.messages[0].action, 'getLotForExport');
});

test('bonus and keyword additions preserve existing atomic-store arrays', async () => {
    const h = context({ fpToolsAutoReplies: { randomBonuses: ['saved'], keywords: [{ keyword: 'old', response: 'old reply' }] } });
    h.ctx.window.fptPatchAutoReplies = async patch => {
        for (const [key, value] of Object.entries(patch.set || {})) h.saved.fpToolsAutoReplies[key] = value;
        for (const [field, operations] of Object.entries(patch.arrayOps || {})) {
            for (const operation of operations) if (operation.op === 'append') h.saved.fpToolsAutoReplies[field].push(operation.value);
        }
        return h.saved.fpToolsAutoReplies;
    };
    h.load('content/features/auto_review.js');
    await h.api.run('auto_review', 'addBonusBtn', { text: 'new gift' });
    await h.api.run('auto_reply', 'addKeywordBtn', { keyword: 'new', response: 'new reply', matchMode: 'exact' });
    assert.deepEqual(h.saved.fpToolsAutoReplies.randomBonuses, ['saved', 'new gift']);
    assert.equal(h.saved.fpToolsAutoReplies.keywords[0].keyword, 'old');
    assert.equal(h.saved.fpToolsAutoReplies.keywords[1].response, 'new reply');
});

test('retired financial pages reject popup action registrations', async () => {
    const h = context();
    for (const pageId of ['piggy_banks', 'calculator']) {
        assert.throws(() => h.api.register(pageId, 'legacyAction', () => true), /Invalid popup action registration/);
    }
    h.load('content/features/misc.js');
    await assert.rejects(h.api.run('calculator', 'calculate', { first: 1, second: 2, operator: 'add' }), /Unknown popup action/);
});

test('delivery updates preserve other lots and saved fields', async () => {
    const h = context({ fpToolsAutoDeliveryLots: { first: { enabled: true, template: 'saved' }, second: { productCount: 7 } } });
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        if (message.action === 'saveAutoDeliveryLot') {
            h.saved.fpToolsAutoDeliveryLots[message.lotId] = {
                ...h.saved.fpToolsAutoDeliveryLots[message.lotId], ...message.settings
            };
        }
        return { success: true };
    };
    h.load('content/features/auto_delivery_ui.js');
    await h.api.run('auto_delivery', 'autoSaveDeliveryLot', { lotId: 'first', settings: { mode: 'secrets' } });
    assert.deepEqual(h.messages.map(message => message.action), ['saveAutoDeliveryLot']);
    assert.deepEqual(h.saved.fpToolsAutoDeliveryLots, { first: { enabled: true, template: 'saved', mode: 'secrets' }, second: { productCount: 7 } });
});

test('manual lot loading asks the background to sync stock and returns counts without secret contents', async () => {
    const lots = [
        { id: '501', nodeId: '42', title: 'Кристаллы Генезиса' },
        { id: '502', nodeId: '43', title: 'Игровая валюта' }
    ];
    const h = context({ fpToolsAutoDeliveryLots: { '501': { mode: 'secrets' }, '502': { mode: 'template' } } });
    h.ctx.document.body = { dataset: { appData: JSON.stringify([{ userId: 'qa-user' }]) } };
    h.ctx.chrome.runtime.sendMessage = async message => {
        h.messages.push(message);
        if (message.action === 'getUserLotsList') return lots;
        if (message.action === 'syncAutoDeliveryStockCounts') {
            return { success: true, counts: { '501': 6, '502': null }, errors: [] };
        }
        return { success: true };
    };
    h.load('content/features/auto_delivery_ui.js');

    const result = await h.api.run('auto_delivery', 'fp-load-delivery-lots-btn', {});

    assert.deepEqual(h.messages.map(message => message.action), ['getUserLotsList', 'syncAutoDeliveryStockCounts']);
    assert.deepEqual(result.lots, lots);
    assert.deepEqual(result.stockCounts, { '501': 6, '502': null });
    assert.equal(JSON.stringify(result).includes('raw-token'), false);
});

test('theme actions preserve other theme settings and never hydrate removed previews', async () => {
    const h = context({ fpToolsTheme: { bgImage: 'saved-image', font: 'Inter', textColor: '#111111' }, enableCustomTheme: true });
    h.load('content/features/theme.js');
    h.ctx.applyCustomTheme = async () => {};
    h.ctx.applyHeaderPosition = async () => {};
    await h.api.run('theme', 'uploadBgImageBtn', { dataUrl: 'new-image' });
    assert.equal(h.saved.fpToolsTheme.bgImage, 'new-image');
    assert.equal(h.saved.fpToolsTheme.font, 'Inter');
    await h.api.run('theme', 'removeBgImageBtn');
    assert.ok(!h.saved.fpToolsTheme.bgImage);
    assert.equal(h.saved.fpToolsTheme.textColor, '#111111');
});
