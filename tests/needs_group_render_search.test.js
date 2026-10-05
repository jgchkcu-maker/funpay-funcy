const test = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('./helpers/popup_actions_harness');
function needs(initial = {}) {
    const h = context(initial);
    h.load('content/features/feature_registry.js');
    h.ctx.window.fptApplyDisabledFeatures = async () => {};
    h.load('content/features/needs_tab.js');
    return h;
}
test('catalog reads preserve all feature data and never write settings or create previews', async () => {
    const h = needs({ fpToolsDisabledFeatures: ['chat_reply'] });
    const registry = await h.api.run('needs', 'getFeatureRegistry');
    assert.equal(registry.length, 36);
    assert.deepEqual(h.saved.fpToolsDisabledFeatures, ['chat_reply']);
    assert.equal(h.messages.length, 0);
});
test('search continues to match descriptions, groups and prior feature labels without rendering rows', async () => {
    const h = needs();
    const registry = await h.api.run('needs', 'getFeatureRegistry');
    for (const entry of registry) {
        assert.equal(h.ctx.fptNeedsEntryMatches(entry, h.ctx.fptNeedsNormalizeSearchText(entry.label)), true);
        for (const label of entry.legacyLabels || []) assert.equal(h.ctx.fptNeedsEntryMatches(entry, label.toLowerCase()), true);
    }
});
test('AI receives established data fields and returned IDs are validated against the registry', async () => {
    const h = needs(); const registry = await h.api.run('needs', 'getFeatureRegistry');
    const id = registry.find(e => !e.locked).id;
    h.ctx.chrome.runtime.sendMessage = async message => { h.messages.push(message); return { success: true, data: JSON.stringify([{ id }, { id: 'unknown' }]) }; };
    const result = await h.api.run('needs', 'fptNeedsAskBtn', { text: 'убрать элемент' });
    assert.equal(result.length, 1); assert.equal(result[0].id, id);
    const sent = JSON.parse(h.messages[0].context);
    assert.deepEqual(Object.keys(sent[0]).sort(), ['desc', 'id', 'label']);
});
test('explicit toggles preserve unrelated feature IDs and AI confirmation retains stable IDs', async () => {
    const h = needs({ fpToolsDisabledFeatures: ['chat_reply'] });
    const registry = await h.api.run('needs', 'getFeatureRegistry');
    const id = registry.find(e => !e.locked && e.id !== 'chat_reply').id;
    await h.api.run('needs', 'fptApplyNeedsSelection', { enabled: { [id]: false } });
    assert.ok(h.saved.fpToolsDisabledFeatures.includes(id)); assert.ok(h.saved.fpToolsDisabledFeatures.includes('chat_reply'));
    await h.api.run('needs', 'fptApplyNeedsSelection', { enabled: { [id]: true } });
    assert.deepEqual(h.saved.fpToolsDisabledFeatures, ['chat_reply']);
    await h.api.run('needs', 'fptNeedsAiConfirm', { ids: [id, 'unknown'] });
    assert.ok(h.saved.fpToolsDisabledFeatures.includes(id)); assert.ok(!h.saved.fpToolsDisabledFeatures.includes('unknown'));
});
