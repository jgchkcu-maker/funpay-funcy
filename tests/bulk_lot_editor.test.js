const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEditor(messages = {}) {
    const sent = [];
    const context = vm.createContext({
        window: {}, console, setTimeout, clearTimeout,
        chrome: { runtime: { sendMessage: async message => { sent.push(message); return messages[message.action]?.(message); } } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../content/features/bulk_lot_editor.js'), 'utf8'), context);
    return { context, sent, editor: context.window.FPTBulkLotEditor };
}

test('bulk find/replace matches whole Cyrillic words and keeps alternation inside the word boundary', () => {
    const { editor } = loadEditor();
    assert.equal('Кот, котик и кот.'.replace(editor.buildFindRegex({ find: 'кот', wholeWord: true }), 'пёс'), 'пёс, котик и пёс.');
    assert.equal('a ab b'.replace(editor.buildFindRegex({ find: 'a|b', regex: true, wholeWord: true }), 'X'), 'X ab X');
    assert.equal('Цена (1+1)'.replace(editor.buildFindRegex({ find: '(1+1)' }), '2'), 'Цена 2');
    assert.equal(editor.buildFindRegex({ find: '' }), null);
});

test('bulk price rules share one calculation with minimum and rounding', () => {
    const { editor } = loadEditor();
    assert.equal(editor.computePrice(99.9, { mode: 'pct_up', value: 10 }), 109.89);
    assert.equal(editor.computePrice(100, { mode: 'pct_down', value: 20, minimum: 90 }), 90);
    assert.equal(editor.computePrice(1234, { mode: 'round_flat', step: 50 }), 1250);
    assert.equal(editor.computePrice(10, { mode: 'sub', value: 25 }), 0);
    assert.equal(editor.computePrice(10.4, { mode: 'add', value: 0, round: true }), 10);
});

test('bulk apply saves {current} after find/replace, returns the new title and rejects drops over 100%', async () => {
    const { context, sent } = loadEditor({
        getLotForExport: () => ({ success: true, data: { 'fields[summary][ru]': 'Ключ Steam', 'fields[desc][ru]': 'Описание', price: '200' } }),
        saveSingleLot: () => ({ success: true })
    });
    const result = await context.applyPopupBulkLots({
        delayMs: 0,
        lots: [{ offerId: '1', nodeId: '5' }],
        changes: { name: '{current} — VIP', findReplace: { find: 'steam', replace: 'Epic', fields: { name: true } }, price: { mode: 'pct_up', value: 5 } }
    });
    assert.equal(result.successCount, 1);
    assert.equal(result.results[0].title, 'Ключ Epic — VIP');
    const saved = sent.find(message => message.action === 'saveSingleLot').data;
    assert.equal(saved['fields[summary][ru]'], 'Ключ Epic — VIP');
    assert.equal(saved.price, '210');
    await assert.rejects(context.applyPopupBulkLots({ lots: [{ offerId: '1', nodeId: '5' }], changes: { price: { mode: 'pct_down', value: 150 } } }), /100%/);
});
