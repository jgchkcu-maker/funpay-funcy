const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

test('decimal arithmetic is exact and keeps tiny prices apart', async () => {
    const m = await load('money.js');
    assert.equal(m.addDecimal('0.1', '0.2'), '0.3');
    assert.equal(m.subDecimal('1', '0.003'), '0.997');
    assert.equal(m.mulDecimal('1.25', '3'), '3.75');
    assert.equal(m.compareDecimal('0.003', '0.004'), -1, '0.003 and 0.004 are different prices');
    assert.equal(m.decimalEquals('1.50', '1.5'), true);
    assert.equal(m.formatDecimal('-0.000'), '0');
    assert.equal(m.parseDecimal('1,5'), null, 'a comma is not accepted silently');
    assert.equal(m.formatDecimal(m.parseDecimal('1,5', { allowComma: true })), '1.5');
    assert.equal(m.parseDecimal('2abc'), null);
    assert.equal(m.parseDecimal(''), null);
    assert.equal(m.divDecimal('10', '3', { quantum: '0.01' }), '3.33');
    assert.equal(m.divDecimal('2', '3', { quantum: '0.01' }), '0.67');
    assert.equal(m.divDecimal('1', '3', { quantum: '0.01', mode: 'ceil' }), '0.34');
});

test('rounding follows the quantum of the operation', async () => {
    const m = await load('money.js');
    assert.equal(m.roundToQuantum('12.345', '0.01'), '12.35');
    assert.equal(m.roundToQuantum('12.344', '0.01'), '12.34');
    assert.equal(m.roundToQuantum('12.301', '0.5', 'ceil'), '12.5');
    assert.equal(m.roundToQuantum('12.301', '1', 'floor'), '12');
    assert.equal(m.roundToQuantum('-1.5', '1'), '-2', 'half-up rounds away from zero');
    assert.equal(m.roundToQuantum('0.0034', '0.0001'), '0.0034');
    assert.equal(m.isMultipleOfQuantum('1.20', '0.1'), true);
    assert.equal(m.isMultipleOfQuantum('1.25', '0.1'), false);
});

test('allocation splits a batch cost exactly with a deterministic remainder', async () => {
    const m = await load('money.js');
    const parts = m.allocateDecimal('100', ['1', '1', '1'], '0.01');
    assert.deepEqual(parts, ['33.34', '33.33', '33.33']);
    assert.equal(m.sumDecimals(parts), '100');
    const weighted = m.allocateDecimal('10.00', ['2', '1'], '0.01');
    assert.deepEqual(weighted, ['6.67', '3.33']);
    assert.equal(m.sumDecimals(m.allocateDecimal('-1', ['1', '1', '1'], '0.01')), '-1');
    assert.throws(() => m.allocateDecimal('1.005', ['1'], '0.01'), /не кратна/);
    assert.deepEqual(m.money('5', 'rub'), { amount: '5', currency: 'RUB' });
    assert.equal(m.money(null, 'RUB'), null, 'unknown stays unknown');
});

test('order quantity is parsed from the whole raw value with its unit', async () => {
    const f = await load('order_facts.js');
    assert.deepEqual(f.parseOrderQuantity('2 шт.'), { kind: 'integer', value: 2, unit: 'шт', raw: '2 шт.' });
    assert.equal(f.parseOrderQuantity('1 000 шт.').value, 1000);
    assert.equal(f.parseOrderQuantity('1 000').value, 1000);
    assert.equal(f.parseOrderQuantity('3').value, 3);
    for (const raw of ['1,5', '1.5', '1,5 шт.', '2abc', '2 кк', '', 'шт.', '0', '-1']) {
        assert.equal(f.parseOrderQuantity(raw).kind, 'unknown', `"${raw}" is not a whole number of pieces`);
    }
    assert.equal(f.parseOrderQuantity('1.5').reason, 'fractional');
    assert.equal(f.parseOrderQuantity('2abc').reason, 'unit');
    assert.equal(f.parseOrderQuantity('500 кк', { units: ['кк'] }).value, 500, 'a category contract may add units');
});

test('order facts keep unknown values unknown and take the order id from the page', async () => {
    const f = await load('order_facts.js');
    const raw = {
        recognized: true, pageOrderId: 'ABCD1234', currentUserId: '100', sellerId: '100', buyerId: '555',
        buyerUsername: 'QA', buyerChatId: '31337', statusText: 'Оплачен', quantityText: '2 шт.',
        lotId: '987', nodeId: '42', nodeType: 'lots', lotName: 'Ключ', secrets: ['K1'],
        review: { sectionFound: false, rating: null, hasReviewText: false }
    };
    const facts = f.normalizeOrderFacts(raw, { requestedOrderId: 'abcd1234', observedAt: 5 });
    assert.equal(facts.orderId, 'ABCD1234');
    assert.equal(facts.status, 'paid');
    assert.equal(facts.quantity.value, 2);
    assert.equal(facts.review.presence, 'unknown', 'no review markup is not proof of no review');
    assert.equal(f.orderRole(facts, '100'), 'seller');
    assert.equal(f.orderRole(facts, '555'), 'unknown', 'the page belongs to another account');
    assert.equal(f.orderRole({ ...facts, currentUserId: '555' }, '555'), 'buyer');

    const mismatch = f.normalizeOrderFacts(raw, { requestedOrderId: 'ZZZZ9999' });
    assert.ok(mismatch.problems.includes('order-mismatch'));
    assert.equal(f.normalizeOrderFacts({ ...raw, quantityText: '1,5' }).quantity.kind, 'unknown');
    assert.equal(f.normalizeOrderFacts({ ...raw, review: { sectionFound: true } }).review.presence, 'absent');
    assert.equal(f.normalizeOrderFacts({ ...raw, review: { sectionFound: true, rating: 2 } }).review.presence, 'present', 'any rating is a review');
    assert.equal(f.normalizeOrderFacts({ ...raw, recognized: false, review: { sectionFound: true } }).review.presence, 'unknown');
    assert.equal(f.normalizeOrderFacts(null).recognized, false);
});

test('verifier blocks effects on any unknown or mismatching fact', async () => {
    const f = await load('order_facts.js');
    const v = await load('order_verifier.js');
    const raw = {
        recognized: true, pageOrderId: 'ABCD1234', currentUserId: '100', sellerId: '100', buyerId: '555',
        buyerChatId: '31337', statusText: 'Оплачен', quantityText: '2 шт.', lotId: '987', nodeId: '42'
    };
    const facts = f.normalizeOrderFacts(raw, { requestedOrderId: 'ABCD1234' });
    const ok = v.verifyOrderForEffect(facts, { accountId: '100', effect: 'delivery', eventChatId: '31337' });
    assert.equal(ok.ok, true, ok.reasons.join());
    assert.equal(ok.quantity.value, 2);
    assert.equal(ok.bindingSource, 'link');

    const cases = [
        [{ statusText: 'Возврат' }, 'status-refunded'],
        [{ statusText: '' }, 'status-unknown'],
        [{ quantityText: '1.5' }, 'quantity-unknown'],
        [{ lotId: null }, 'binding-missing'],
        [{ sellerId: '777', buyerId: '100' }, 'role-buyer'],
        [{ sellerId: null, buyerId: '555' }, 'role-unknown'],
        [{ buyerChatId: '1' }, 'chat-mismatch'],
        [{ buyerChatId: null }, 'chat-unknown'],
        [{ currentUserId: '200' }, 'account-mismatch']
    ];
    for (const [patch, reason] of cases) {
        const result = v.verifyOrderForEffect(f.normalizeOrderFacts({ ...raw, ...patch }), { accountId: '100', effect: 'delivery', eventChatId: '31337' });
        assert.equal(result.ok, false);
        assert.ok(result.reasons.includes(reason), `${JSON.stringify(patch)} → ${result.reasons}`);
    }
    assert.ok(v.verifyOrderForEffect(facts, { effect: 'delivery' }).reasons.includes('account-unknown'));
    const confirmed = v.verifyOrderForEffect(f.normalizeOrderFacts({ ...raw, lotId: null }), { accountId: '100', binding: { offerId: '987' } });
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.bindingSource, 'confirmed');
    const purchaseOnClosed = v.verifyOrderForEffect(f.normalizeOrderFacts({ ...raw, statusText: 'Закрыт' }), { accountId: '100', effect: 'purchase' });
    assert.ok(purchaseOnClosed.reasons.includes('status-not-paid'));
    assert.ok(v.verifyOrderForEffect({ ...facts, observedAt: 0 }, { accountId: '100', maxAgeMs: 1000, now: 5000 }).reasons.includes('stale-facts'));
});
