const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const url = file => pathToFileURL(path.join(__dirname, '../background', file)).href;
const load = file => import(url(file));

const SCHEMA = { present: true, fields: [{ id: 'type', label: null, conditions: [] }, { id: 'time', label: 'Количество месяцев', conditions: [] }] };

function row(offerId, price, extra = {}) {
    return { offerId, sellerId: `9${offerId}`, sellerName: `s${offerId}`, online: true, auto: false, rating: 5, title: `Лот ${offerId}`, priceData: price, priceText: price, priceUnit: '₽', fields: {}, ...extra };
}

function rawMarket(rows, extra = {}) {
    return { ok: true, kind: 'lots', lang: 'ru', userId: '100', nodeId: '1217', counter: rows.length, schema: SCHEMA, priceHeader: 'Цена', emptyShown: false, rows, ...extra };
}

const ownSpotify = (type = 'Individual', time = '1 месяц') => ({
    kind: 'lots', offerId: '500', nodeId: '1217',
    fields: { type: { value: type.toLowerCase(), label: type }, time: { value: time, label: time } }
});

const rule = (competitors = {}) => ({ competitors: { mode: 'schema', ...competitors } });

test('offer refs keep composite chip ids whole and reject mismatched nodes', async () => {
    const { parseOfferRef, offerKey } = await load('dumper_market.js');
    assert.deepEqual(parseOfferRef({ accountId: '100', kind: 'chips', offerId: '100-24-26-191-11' }),
        { accountId: '100', kind: 'chips', nodeId: '26', offerId: '100-24-26-191-11', gameId: '24', server: '191', side: '11' });
    assert.equal(parseOfferRef({ accountId: '100', kind: 'chips', nodeId: '27', offerId: '100-24-26-191-11' }), null);
    assert.equal(parseOfferRef({ accountId: '100', kind: 'chips', offerId: '200-24-26-191' }), null, 'foreign seller id');
    assert.equal(parseOfferRef({ accountId: '100', kind: 'lots', offerId: '5', nodeId: '' }), null, 'lots need node');
    assert.equal(offerKey(parseOfferRef({ accountId: '100', kind: 'lots', offerId: '5', nodeId: '7' })), '100:lots:7:5');
});

test('chips price ignores data-s sort value; lots use the numeric listing price', async () => {
    const { normalizeMarket } = await load('dumper_market.js');
    const chips = normalizeMarket({ ...rawMarket([row('1-24-26-191-11', null, { priceData: '0', priceText: '0.63', server: '191', side: '11' })]), kind: 'chips', nodeId: '26' }, { kind: 'chips', nodeId: '26' });
    assert.equal(chips.rows[0].price, '0.63');
    const lots = normalizeMarket(rawMarket([row('1', null, { priceData: '162.24776', priceText: '162.25' })]), { kind: 'lots', nodeId: '1217' });
    assert.equal(lots.rows[0].price, '162.24776');
    assert.equal(lots.rows[0].currency, 'RUB');
});

test('incomplete, foreign-locale and unconfirmed-empty listings are never an empty market', async () => {
    const { normalizeMarket } = await load('dumper_market.js');
    const dup = [row('1', '10'), row('1', '10', { promo: true }), row('2', '11')];
    const market = normalizeMarket({ ...rawMarket(dup), counter: 3 }, { kind: 'lots', nodeId: '1217' });
    assert.equal(market.rows.length, 2, 'promoted duplicate collapsed');
    assert.equal(market.complete, false, '2 of 3 published rows');
    assert.throws(() => normalizeMarket({ ...rawMarket([]), counter: null }, { kind: 'lots', nodeId: '1217' }), /не подтвердил/);
    assert.equal(normalizeMarket({ ...rawMarket([]), counter: 0, emptyShown: true }, { kind: 'lots', nodeId: '1217' }).rows.length, 0);
    assert.throws(() => normalizeMarket({ ...rawMarket([row('1', '1')]), lang: 'en' }, { kind: 'lots', nodeId: '1217' }), /не на русском/);
    assert.throws(() => normalizeMarket({ ok: false, error: { code: 'guard', message: 'проверка браузера' } }, { kind: 'lots', nodeId: '1217' }), err => err.code === 'guard');
    assert.throws(() => normalizeMarket(rawMarket([row('1', '1')], { nodeId: '999' }), { kind: 'lots', nodeId: '1217' }), err => err.code === 'node');
});

test('Spotify Individual 1 month excludes Duo, 12 months and rows without the field', async () => {
    const { normalizeMarket, selectCompetitors } = await load('dumper_market.js');
    const market = normalizeMarket(rawMarket([
        row('1', '150', { fields: { type: 'individual', time: '1 месяц' } }),
        row('2', '120', { fields: { type: 'duo', time: '1 месяц' } }),
        row('3', '100', { fields: { type: 'individual', time: '12 месяцев' } }),
        row('4', '90', { fields: { type: 'individual' } }),
        row('5', '140', { fields: { type: 'INDIVIDUAL', time: '1  месяц' } }),
        row('500', '130', { fields: { type: 'individual', time: '1 месяц' } }),
        row('6', '80', { sellerId: '100', fields: { type: 'individual', time: '1 месяц' } })
    ]), { kind: 'lots', nodeId: '1217' });
    const result = selectCompetitors({ own: ownSpotify(), market, rule: rule(), accountId: '100' });
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.included.map(item => item.row.offerId), ['5', '1'], 'case/space-normalized match, sorted by price');
    const why = Object.fromEntries(result.excluded.map(item => [item.row.offerId, item.reasons.join('; ')]));
    assert.match(why['2'], /Другое значение «type»: duo/);
    assert.match(why['3'], /«Количество месяцев»: 12 месяцев/);
    assert.match(why['4'], /Нет обязательного поля «Количество месяцев»/);
    assert.equal(why['500'], 'Собственное предложение');
    assert.equal(why['6'], 'Собственное предложение', 'another own offer by seller id');
});

test('dependent fields take part only when their conditions hold', async () => {
    const { normalizeMarket, selectCompetitors, applicableFields } = await load('dumper_market.js');
    const schema = { present: true, fields: [{ id: 'subscription', conditions: [] }, { id: 'type', conditions: [{ id: 'subscription', list: ['с подпиской'] }] }] };
    const values = { subscription: ['без подписки'] };
    assert.deepEqual(applicableFields(schema, id => values[id] || []).map(f => f.id), ['subscription']);
    const market = normalizeMarket(rawMarket([
        row('1', '10', { fields: { subscription: 'без подписки' } }),
        row('2', '9', { fields: { subscription: 'с подпиской', type: 'plus' } })
    ], { schema }), { kind: 'lots', nodeId: '1217' });
    const noSub = selectCompetitors({ own: { kind: 'lots', offerId: '500', fields: { subscription: { value: 'без подписки', label: 'Без подписки' } } }, market, rule: rule(), accountId: '100' });
    assert.deepEqual(noSub.included.map(i => i.row.offerId), ['1'], 'hidden type field is not required');
    const plus = selectCompetitors({ own: { kind: 'lots', offerId: '500', fields: { subscription: { value: 'с подпиской' }, type: { value: '', label: null } } }, market, rule: rule(), accountId: '100' });
    assert.match(plus.blockers.join(' '), /не заполнено поле «type»/, 'own missing applicable value stops the rule');
});

test('sections without a schema allow automation only on explicitly selected offers', async () => {
    const { normalizeMarket, selectCompetitors, competitorFingerprint } = await load('dumper_market.js');
    const market = normalizeMarket(rawMarket([row('1', '10'), row('2', '12')], { schema: { present: false, fields: [] } }), { kind: 'lots', nodeId: '1217' });
    const own = { kind: 'lots', offerId: '500', fields: {} };
    assert.match(selectCompetitors({ own, market, rule: rule(), accountId: '100' }).blockers.join(' '), /нет товарной схемы/);
    const pick = { offerId: '2', title: 'Лот 2', fingerprint: competitorFingerprint(market.rows[1], { params: [] }) };
    const cards = new Map([['2', { ok: true, nodeId: '1217', sellerId: '92', params: [] }]]);
    const selected = selectCompetitors({ own, market, rule: rule({ mode: 'selected', selected: [pick] }), accountId: '100', cards });
    assert.deepEqual(selected.blockers, []);
    assert.deepEqual(selected.included.map(i => i.row.offerId), ['2']);
    assert.equal(selected.excluded.length, 0, 'unselected rows stay out of the explanation list');
});

test('a selected competitor that changed its title or moved section is suspended', async () => {
    const { normalizeMarket, selectCompetitors, competitorFingerprint } = await load('dumper_market.js');
    const original = row('2', '12', { title: 'Аккаунт EU' });
    const pick = { offerId: '2', fingerprint: competitorFingerprint(original, { params: [] }) };
    const changed = normalizeMarket(rawMarket([{ ...original, title: 'Аккаунт US' }], { schema: { present: false, fields: [] } }), { kind: 'lots', nodeId: '1217' });
    const own = { kind: 'lots', offerId: '500', fields: {} };
    const cards = new Map([['2', { ok: true, nodeId: '1217', sellerId: '92', params: [] }]]);
    const result = selectCompetitors({ own, market: changed, rule: rule({ mode: 'selected', selected: [pick] }), accountId: '100', cards });
    assert.equal(result.included.length, 0);
    assert.match(result.excluded[0].reasons.join(), /подтвердите предложение заново/);
    const moved = selectCompetitors({ own, market: normalizeMarket(rawMarket([original], { schema: { present: false, fields: [] } }), { kind: 'lots', nodeId: '1217' }),
        rule: rule({ mode: 'selected', selected: [pick] }), accountId: '100', cards: new Map([['2', { ok: true, nodeId: '777', sellerId: '92', params: [] }]]) });
    assert.match(moved.excluded[0].reasons.join(), /другому разделу/);
    const missing = selectCompetitors({ own, market: normalizeMarket(rawMarket([row('3', '1')], { schema: { present: false, fields: [] } }), { kind: 'lots', nodeId: '1217' }),
        rule: rule({ mode: 'selected', selected: [pick] }), accountId: '100' });
    assert.match(missing.excluded[0].reasons.join(), /не найдено в выдаче/);
});

test('text, seller, rating, online and auto-delivery conditions only narrow the selection', async () => {
    const { normalizeMarket, selectCompetitors } = await load('dumper_market.js');
    const fields = { type: 'individual', time: '1 месяц' };
    const market = normalizeMarket(rawMarket([
        row('1', '10', { fields, title: '𝐏𝐑𝐄𝐌𝐈𝐔𝐌 любой регион' }),
        row('2', '11', { fields, title: 'Premium только Турция' }),
        row('3', '12', { fields, rating: 3 }),
        row('4', '13', { fields, online: false }),
        row('5', '14', { fields, auto: false }),
        row('6', '15', { fields, sellerId: '66' })
    ]), { kind: 'lots', nodeId: '1217' });
    const cards = new Map(['1', '2', '3', '4', '5', '6'].map(id => [id, { ok: true, nodeId: '1217', params: [], description: id === '2' ? 'Регион: Турция' : 'Любой регион' }]));
    const result = selectCompetitors({ own: ownSpotify(), market, accountId: '100', cards, rule: rule({
        requiredWords: 'premium', excludedWords: ['турция'], minRating: 4, onlineOnly: true, excludedSellers: [{ id: '66' }]
    }) });
    const why = Object.fromEntries(result.excluded.map(item => [item.row.offerId, item.reasons.join('; ')]));
    assert.deepEqual(result.included.map(i => i.row.offerId), ['1'], 'stylised letters normalized');
    assert.match(why['2'], /Содержит «турция»/);
    assert.match(why['3'], /Рейтинг ниже 4/);
    assert.match(why['4'], /не в сети/);
    assert.match(why['5'], /Нет слова «premium»/);
    assert.match(why['6'], /Продавец исключён/);
    const only = selectCompetitors({ own: ownSpotify(), market, accountId: '100', rule: rule({ onlySellers: true, sellers: [{ id: '93' }], autoOnly: false }) });
    assert.deepEqual(only.included.map(i => i.row.offerId), ['3']);
    const pending = selectCompetitors({ own: ownSpotify(), market, accountId: '100', rule: rule({ excludedWords: 'турция' }) });
    assert.equal(pending.included.length, 0, 'excluded words require reading the card first');
    assert.equal(pending.pendingCards.length, 6);
});

test('currency offers match server and side strictly', async () => {
    const { normalizeMarket, selectCompetitors } = await load('dumper_market.js');
    const market = normalizeMarket({ ...rawMarket([
        row('7-24-26-191-11', null, { priceText: '0.63', server: '191', side: '11' }),
        row('8-24-26-191-12', null, { priceText: '0.50', server: '191', side: '12', sideName: 'Элийцы' }),
        row('9-24-26-194-11', null, { priceText: '0.40', server: '194', side: '11', serverName: '(DE) Odin' })
    ]), kind: 'chips', nodeId: '26', schema: { present: false, fields: [] } }, { kind: 'chips', nodeId: '26' });
    const own = { kind: 'chips', offerId: '100-24-26-191-11', nodeId: '26', server: '191', side: '11', fields: {} };
    const result = selectCompetitors({ own, market, rule: rule(), accountId: '100' });
    assert.deepEqual(result.blockers, [], 'chips have no product schema but server/side are their schema');
    assert.deepEqual(result.included.map(i => i.row.offerId), ['7-24-26-191-11']);
    const why = result.excluded.map(item => item.reasons.join());
    assert.ok(why.some(r => /Другая сторона: Элийцы/.test(r)));
    assert.ok(why.some(r => /Другой сервер: \(DE\) Odin/.test(r)));
});

// --- Цена -----------------------------------------------------------------------

const priceRule = over => ({ strategy: 'undercut', position: 1, step: { mode: 'amount', value: '1' }, quantum: '0.01', allowRaise: false, ceiling: null, limits: { writeIntervalMin: 5, maxChangePercent: '50', maxHourlyDropPercent: '50' }, ...over });

test('undercut converts buyer prices through the FunPay coefficient and stays strictly cheaper', async () => {
    const { decide } = await load('dumper_price.js');
    const d = decide({ prices: ['115', '130'], currentPrice: '110', coefficient: '1.15', rule: priceRule(), floor: '50', now: 0 });
    assert.equal(d.action, 'lower');
    assert.equal(d.reference, '115');
    // (115 − 1) / 1.15 = 99.13 → покупатель 113.9995 < 115
    assert.equal(d.target, '99.13');
    assert.equal(d.targetPlace.from, 1);
});

test('N-th place, ties as ranges and fewer than N competitors keep the price', async () => {
    const { decide, placeRange, formatPlace } = await load('dumper_price.js');
    assert.equal(formatPlace(placeRange(['10', '12', '12', '12', '15'], '12')), '2–5', 'one cheaper and three equal: we can be 2nd to 5th');
    const fewer = decide({ prices: ['10', '11'], currentPrice: '20', coefficient: '1', rule: priceRule({ strategy: 'position', position: 3 }), floor: '1', now: 0 });
    assert.equal(fewer.action, 'keep');
    assert.match(fewer.reasons.join(), /нужно место 3/);
    const third = decide({ prices: ['10', '12', '12', '15'], currentPrice: '20', coefficient: '1', rule: priceRule({ strategy: 'position', position: 3, step: { mode: 'percent', value: '10' } }), floor: '1', now: 0 });
    assert.equal(third.reference, '12');
    assert.equal(third.target, '10.8');
    assert.equal(formatPlace(third.targetPlace), '2');
});

test('floor, ceiling and incompatible limits explain skips instead of breaking one limit', async () => {
    const { decide, floorPrice } = await load('dumper_price.js');
    assert.equal(floorPrice({ minPrice: '80', cost: '70', minProfit: '15' }), '85', 'larger of manual and cost + profit');
    assert.equal(floorPrice({ minPrice: '90', cost: '70', minProfit: '15' }), '90');
    const cannot = decide({ prices: ['50'], currentPrice: '100', coefficient: '1', rule: priceRule(), floor: '60', now: 0 });
    assert.equal(cannot.action, 'cannot-beat');
    assert.match(cannot.reasons[0], /ниже минимума 60/);
    const incompatible = decide({ prices: ['50'], currentPrice: '100', coefficient: '1', rule: priceRule({ ceiling: '40' }), floor: '60', now: 0 });
    assert.equal(incompatible.action, 'skip');
    assert.match(incompatible.reasons[0], /несовместимы/);
    const none = decide({ prices: ['50'], currentPrice: '100', coefficient: null, rule: priceRule(), floor: '1', now: 0 });
    assert.equal(none.action, 'skip', 'unknown commission forbids a target');
});

test('per-pass and rolling-hour limits clamp drops; write interval waits', async () => {
    const { decide } = await load('dumper_price.js');
    const limited = { limits: { writeIntervalMin: 5, maxChangePercent: '5', maxHourlyDropPercent: '10' } };
    const pass = decide({ prices: ['50'], currentPrice: '100', coefficient: '1', rule: priceRule(limited), floor: '1', now: 0 });
    assert.equal(pass.target, '95');
    const hour = decide({ prices: ['50'], currentPrice: '91', coefficient: '1', rule: priceRule(limited), floor: '1', now: 0, history: { hourAgoPrice: '100' } });
    assert.equal(hour.target, '90', 'cumulative drop stops at 10% of the price an hour ago');
    const exhausted = decide({ prices: ['50'], currentPrice: '90', coefficient: '1', rule: priceRule(limited), floor: '1', now: 0, history: { hourAgoPrice: '100' } });
    assert.equal(exhausted.action, 'wait');
    const recent = decide({ prices: ['50'], currentPrice: '100', coefficient: '1', rule: priceRule(limited), floor: '1', now: 120000, history: { lastWriteAt: 1000 } });
    assert.equal(recent.action, 'wait');
    assert.match(recent.reasons.join(), /не чаще раза в 5 мин/);
});

test('raising is off by default, needs a ceiling and two consecutive confirmations', async () => {
    const { decide, validateDumperRule } = await load('dumper_price.js');
    const off = decide({ prices: ['150'], currentPrice: '100', coefficient: '1', rule: priceRule(), floor: '1', now: 0 });
    assert.equal(off.action, 'keep');
    assert.match(off.reasons.join(), /автоповышение выключено/);
    const raise = priceRule({ allowRaise: true, ceiling: '200' });
    const first = decide({ prices: ['150'], currentPrice: '140', coefficient: '1', rule: raise, floor: '1', now: 0 });
    assert.equal(first.action, 'raise-pending');
    const second = decide({ prices: ['150'], currentPrice: '140', coefficient: '1', rule: raise, floor: '1', now: 0, history: { raiseConfirm: first.raiseConfirm } });
    assert.equal(second.action, 'raise');
    assert.equal(second.target, '149');
    const moved = decide({ prices: ['160'], currentPrice: '140', coefficient: '1', rule: raise, floor: '1', now: 0, history: { raiseConfirm: first.raiseConfirm } });
    assert.equal(moved.action, 'raise-pending', 'a different market restarts confirmation');
    assert.ok(validateDumperRule({ ...raise, ceiling: '', intervalMin: 5, minPrice: '1' }).some(e => /потолка/.test(e)));
});

test('fractional currency prices keep their precision and commission comes from the calculator', async () => {
    const { decide, coefficientFromCalc, matchesShown, validateDumperRule } = await load('dumper_price.js');
    const calc = coefficientFromCalc({ methods: [{ price: '0.6325', unit: '₽' }, { price: '0.007', unit: '$' }, { price: '0.65', unit: '₽' }] }, { price: '0.55', currencySymbol: '₽' });
    assert.equal(calc.coefficient, '1.15');
    assert.equal(coefficientFromCalc({ methods: [{ price: '1', unit: '€' }] }, { price: '1', currencySymbol: '₽' }), null, 'no method in the listing currency');
    assert.equal(matchesShown({ shown: '0.63', sellerPrice: '0.55', coefficient: calc.coefficient }), true);
    assert.equal(matchesShown({ shown: '0.70', sellerPrice: '0.55', coefficient: calc.coefficient }), false);
    const d = decide({ prices: ['0.6312'], currentPrice: '0.55', coefficient: '1.15', rule: priceRule({ step: { mode: 'amount', value: '0.0001' }, quantum: '0.0001' }), floor: '0.3', now: 0 });
    assert.equal(d.target, '0.5487', 'four decimals, not rounded to cents');
    assert.ok(validateDumperRule({ ...priceRule(), quantum: '', intervalMin: 5, minPrice: '0.1' }, { kind: 'chips' }).some(e => /точность/i.test(e)));
});
