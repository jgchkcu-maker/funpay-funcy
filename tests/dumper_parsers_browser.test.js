const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

// Фикстуры — публичные страницы FunPay от 2026-11-04 (гость, без скриптов, выдача урезана).
const root = path.join(__dirname, '..');
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/dumper', name), 'utf8');
const market = () => import(pathToFileURL(path.join(root, 'background/dumper_market.js')).href);

async function parse(action, html, kind) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: 'window.__fptParseHTML = html => new DOMParser().parseFromString(html, "text/html");' });
        await page.addScriptTag({ path: path.join(root, 'offscreen/dumper_parsers.js') });
        return await page.evaluate(([a, h, k]) => window.FPTDumperParsers[a](h, k), [action, html, kind]);
    } finally {
        await browser.close();
    }
}

test('Spotify Premium listing: schema type/time only, exact data-s prices, guest page detected', async () => {
    const raw = await parse('parseDumperMarket', fixture('lots_1217.html'), 'lots');
    assert.equal(raw.ok, true);
    assert.equal(raw.kind, 'lots');
    assert.equal(raw.nodeId, '1217');
    assert.equal(raw.lang, 'ru');
    assert.equal(raw.userId, '0', 'guest view is visible to the service');
    assert.equal(raw.counter, 1539);
    assert.deepEqual(raw.schema.fields.map(f => f.id), ['type', 'time'], 'no region or activation fields exist');
    assert.equal(raw.schema.fields[1].label, 'Количество месяцев');
    assert.ok(raw.schema.fields[0].options.includes('Duo'));
    assert.equal(raw.rows.length, 25);
    const first = raw.rows[0];
    assert.equal(first.priceData, '162.24776');
    assert.equal(first.priceText, '162.25');
    assert.equal(first.priceUnit, '₽');
    assert.deepEqual(first.fields, { type: 'individual', time: '1 месяц' });
    assert.match(first.sellerId, /^\d+$/);
    assert.equal(typeof first.rating, 'number');

    const { normalizeMarket, selectCompetitors } = await market();
    const normalized = normalizeMarket(raw, { kind: 'lots', nodeId: '1217' });
    assert.equal(normalized.complete, false, '25 rows of 1539 published');
    const own = { kind: 'lots', offerId: '1', fields: { type: { value: 'individual', label: 'Individual' }, time: { value: '1 месяц', label: '1 месяц' } } };
    assert.equal(selectCompetitors({ own, market: normalized, rule: { competitors: { mode: 'schema' } }, accountId: '100' }).included.length, 25);
    const duo = { kind: 'lots', offerId: '1', fields: { type: { value: 'Duo', label: 'Duo' }, time: { value: '1 месяц', label: '1 месяц' } } };
    assert.equal(selectCompetitors({ own: duo, market: normalized, rule: { competitors: { mode: 'schema' } }, accountId: '100' }).included.length, 0);
});

test('ChatGPT accounts listing: dependent field, promoted duplicate and auto-delivery flag', async () => {
    const raw = await parse('parseDumperMarket', fixture('lots_1355.html'), 'lots');
    assert.equal(raw.ok, true);
    assert.deepEqual(raw.schema.fields[1].conditions, [{ id: 'subscription', list: ['с подпиской'] }]);
    assert.ok(raw.rows.some(r => r.promo));
    assert.ok(raw.rows.some(r => r.auto));
    const { normalizeMarket, selectCompetitors } = await market();
    const normalized = normalizeMarket(raw, { kind: 'lots', nodeId: '1355' });
    assert.equal(normalized.rows.length, new Set(raw.rows.map(r => r.offerId)).size, 'a promoted offer shown twice counts once');
    const noSub = { kind: 'lots', offerId: '1', fields: { subscription: { value: 'Без подписки', label: 'Без подписки' } } };
    const result = selectCompetitors({ own: noSub, market: normalized, rule: { competitors: { mode: 'schema' } }, accountId: '100' });
    assert.equal(result.included.length, 8);
    assert.ok(result.included.every(i => !i.row.fields.type), 'type is hidden by its condition');
    const plus = { kind: 'lots', offerId: '1', fields: { subscription: { value: 'С подпиской' }, type: { value: 'Plus' } } };
    assert.equal(selectCompetitors({ own: plus, market: normalized, rule: { competitors: { mode: 'schema' } }, accountId: '100' }).included.length, 13);
});

test('currency listing: data-s of price is a sort value, server/side and unit header are kept', async () => {
    const raw = await parse('parseDumperMarket', fixture('chips_26.html'), 'chips');
    assert.equal(raw.ok, true);
    assert.equal(raw.kind, 'chips');
    assert.equal(raw.nodeId, '26');
    assert.equal(raw.priceHeader, 'Цена/1кк');
    const first = raw.rows[0];
    assert.match(first.offerId, /^\d+-\d+-26-\d+-\d+$/, 'composite id kept whole');
    assert.equal(first.priceData, '0');
    assert.equal(first.priceText, '0.63');
    assert.equal(first.server, '191');
    assert.equal(first.side, '11');
    assert.equal(first.amount, '5000', 'stock, not a package size');
    assert.equal(first.amountUnit, 'кк');
    const { normalizeMarket } = await market();
    assert.equal(normalizeMarket(raw, { kind: 'chips', nodeId: '26' }).rows[0].price, '0.63');
    assert.equal((await parse('parseDumperMarket', fixture('chips_26.html'), 'lots')).error.code, 'kind');
});

test('offer card: section, seller, visible parameters and description', async () => {
    const card = await parse('parseDumperCard', fixture('offer_80930707.html'), 'lots');
    assert.equal(card.ok, true);
    assert.equal(card.nodeId, '1355');
    assert.equal(card.sellerId, '6854301');
    assert.deepEqual(card.params, [{ label: 'С подпиской или без', value: 'С подпиской' }, { label: 'Тип подписки', value: 'Business' }]);
    assert.match(card.summary, /CHAT GPT/);
    assert.match(card.description, /общий аккаунт/);
    assert.equal(card.auto, true);
});

test('own lot form keeps node_id, field values and their option labels', async () => {
    const html = `<html><body><form class="form-offer-editor">
        <input name="offer_id" value="500"><input name="node_id" value="1217"><input name="price" value="99.5">
        <input type="checkbox" name="active" checked>
        <input name="fields[summary][ru]" value="Spotify">
        <select name="fields[type]"><option value="">—</option><option value="individual" selected>Individual</option></select>
        <select name="fields[time]"><option value="1 месяц" selected>1 месяц</option></select>
        <textarea name="fields[desc][ru]">long</textarea>
        <div class="lot-fields" data-fields='[{"id":"type","type":4,"conditions":[]}]'></div>
    </form></body></html>`;
    const own = await parse('parseDumperOwnLot', html);
    assert.equal(own.ok, true);
    assert.equal(own.nodeId, '1217');
    assert.equal(own.price, '99.5');
    assert.equal(own.active, true);
    assert.deepEqual(own.fields, { type: { value: 'individual', label: 'Individual' }, time: { value: '1 месяц', label: '1 месяц' } });
    assert.deepEqual(own.schema, [{ id: 'type', conditions: [] }]);
    const login = await parse('parseDumperOwnLot', '<html><body><form action="/account/login"><input name="login"></form></body></html>');
    assert.equal(login.ok, false);
    assert.equal(login.error.code, 'auth');
});
