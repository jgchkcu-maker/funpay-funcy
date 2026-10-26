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

function lotRow({ id, category, nodeId, description, container, server, side, href, categoryHref }) {
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
                getAttribute: () => categoryHref || `/lots/${nodeId}`
            })
        } : null,
        getAttribute: () => href || `/lots/offer?id=${id}`,
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

test('lot parser keeps the whole composite id of currency (chips) offers and marks them', () => {
    const result = parseLots([
        lotRow({
            category: 'Вирты GTA 5 RP, SAMP', server: '7HillsRP.ru',
            href: 'https://funpay.com/chips/offer?id=7492947-63-51-12099-0',
            categoryHref: 'https://funpay.com/chips/51/'
        }),
        lotRow({ category: 'Вирты', href: 'https://funpay.com/lots/offer?id=7492947-63-51-12099-0', categoryHref: 'https://funpay.com/lots/52/' }),
        lotRow({ id: '601', category: 'Аккаунты', nodeId: '45', description: 'Аккаунт', href: 'https://funpay.com/lots/offer?id=601' })
    ]);

    assert.deepEqual(JSON.parse(JSON.stringify(result)), [
        {
            id: '7492947-63-51-12099-0', title: 'Вирты GTA 5 RP, SAMP — 7HillsRP.ru', nodeId: '51',
            categoryName: 'Вирты GTA 5 RP, SAMP', imageUrl: null, kind: 'chips'
        },
        { id: '601', title: 'Аккаунт', nodeId: '45', categoryName: 'Аккаунты', imageUrl: null }
    ]);
});

test('category parser counts currency (chips) offers and marks the category as not raisable', () => {
    const start = source.indexOf('function parseUserCategories(html) {');
    const end = source.indexOf('\n// --- КОНЕЦ ИСПРАВЛЕНИЯ ---', start);
    const item = href => ({ getAttribute: () => href, querySelector: () => null });
    const block = (trade, pub, hrefs) => ({
        querySelector: selector => selector === 'a.btn-plus' ? { href: trade }
            : selector === '.offer-list-title h3 a' ? { href: pub, textContent: pub.includes('chips') ? 'Вирты' : 'Аккаунты' } : null,
        querySelectorAll: () => hrefs.map(item)
    });
    const sandbox = {
        URL,
        console,
        window: { __fptParseHTML: () => ({ querySelectorAll: () => [
            block('https://funpay.com/chips/51/trade', 'https://funpay.com/chips/51/', ['https://funpay.com/chips/offer?id=7492947-63-51-12099-0']),
            block('https://funpay.com/lots/45/trade', 'https://funpay.com/lots/45/', ['https://funpay.com/lots/offer?id=601'])
        ] }) }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${source.slice(start, end)}\nglobalThis.parseUserCategories = parseUserCategories;`, sandbox);
    const [chips, lots] = JSON.parse(JSON.stringify(sandbox.parseUserCategories('fixture')));

    assert.equal(chips.id, '/chips/51/trade');
    assert.equal(chips.kind, 'chips');
    assert.equal(chips.raisable, false);
    assert.deepEqual(chips.lots.map(lot => lot.id), ['7492947-63-51-12099-0']);
    assert.equal(lots.raisable, undefined);
    assert.deepEqual(lots.lots.map(lot => lot.id), ['601']);
});
