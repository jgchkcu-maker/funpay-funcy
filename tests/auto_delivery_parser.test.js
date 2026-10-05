const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../offscreen/offscreen.js'), 'utf8');
const parserStart = source.indexOf('function parseUserLotsList(html) {');
const parserEnd = source.indexOf('\nfunction parseGameSearchResults(html) {', parserStart);
const parserSource = `${source.slice(parserStart, parserEnd)}\nglobalThis.parseUserLotsList = parseUserLotsList;`;

function textNode(text) {
    return text == null ? null : { textContent: text };
}

function lotRow({ id, category, nodeId, description, container, server, side }) {
    const selectors = {
        '.tc-desc-text': textNode(description),
        '.tc-desc': textNode(container),
        '.tc-server': textNode(server),
        '.tc-side': textNode(side),
        '.tc-icon img, img': null
    };
    return {
        closest: selector => selector === '.offer' ? {
            querySelector: () => ({
                textContent: category,
                getAttribute: () => `/lots/${nodeId}`
            })
        } : null,
        getAttribute: () => `/lots/offer?id=${id}`,
        querySelector: selector => selectors[selector] || null
    };
}

function parseLots(rows) {
    const sandbox = { window: { __fptParseHTML: () => ({ querySelectorAll: () => rows }) } };
    vm.createContext(sandbox);
    vm.runInContext(parserSource, sandbox);
    return sandbox.parseUserLotsList('fixture');
}

test('lot parser falls back from description text to category and lot ID', () => {
    const result = parseLots([
        lotRow({ id: '501', category: 'ExitLag 12 месяцев', nodeId: '42', server: 'Tier 1', side: '🌏 Global' }),
        lotRow({ id: '502', category: 'Кристаллы', nodeId: '43', container: '  Большой набор  ' }),
        lotRow({ id: '503', category: '', nodeId: '44' })
    ]);

    assert.deepEqual(JSON.parse(JSON.stringify(result)), [
        { id: '501', title: 'ExitLag 12 месяцев — Tier 1 · 🌏 Global', nodeId: '42', categoryName: 'ExitLag 12 месяцев', imageUrl: null },
        { id: '502', title: 'Большой набор', nodeId: '43', categoryName: 'Кристаллы', imageUrl: null },
        { id: '503', title: 'Лот #503', nodeId: '44', categoryName: 'Без категории', imageUrl: null }
    ]);
});
