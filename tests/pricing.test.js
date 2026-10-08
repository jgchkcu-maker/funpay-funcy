const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '../background/pricing.js')).href);

test('floor satisfies both the minimum profit and the minimum margin', async () => {
    const p = await load();
    assert.equal(p.computeFloor({ cost: '100', minProfit: '10' }), '110');
    assert.equal(p.computeFloor({ cost: '100', minMarginPercent: '20' }), '125');
    assert.equal(p.computeFloor({ cost: '100', minProfit: '30', minMarginPercent: '20' }), '130');
    assert.equal(p.computeFloor({ cost: '100', minProfit: '0', feePercent: '50', minMarginPercent: '50' }), null, 'incompatible constraints');
    assert.equal(p.computeFloor({ cost: null }), null, 'unknown cost is not zero');
    assert.equal(p.netProfit({ price: '125', cost: '100' }), '25');
});

test('markup and margin are different and named correctly', async () => {
    const p = await load();
    assert.equal(p.describeMarkupMargin({ mode: 'markup', value: '25' }), 'Наценка 25% = маржа 20%');
    assert.equal(p.describeMarkupMargin({ mode: 'margin', value: '20' }), 'Маржа 20% = наценка 25%');
    const markup = p.priceForLot({ cost: '100', currentPrice: '100', rule: { mode: 'markup', value: '25', allowRaise: true } });
    const margin = p.priceForLot({ cost: '100', currentPrice: '100', rule: { mode: 'margin', value: '25', allowRaise: true } });
    assert.equal(markup.target, '125');
    assert.equal(margin.target, '133.34');
});

test('rounding up to the step is re-checked; tiny prices keep their precision', async () => {
    const p = await load();
    const stepped = p.priceForLot({ cost: '101', currentPrice: '200', rule: { mode: 'markup', value: '10', step: '5', allowRaise: true } });
    assert.equal(stepped.target, '115');
    assert.equal(stepped.action, 'lower');
    const tiny = p.priceForLot({ cost: '0.003', currentPrice: '0.003', rule: { mode: 'markup', value: '30', step: '0.001', allowRaise: true } }, );
    assert.equal(tiny.target, '0.004');
    assert.equal(tiny.action, 'raise');
});

test('a ceiling below the floor blocks new sales; no raise without permission', async () => {
    const p = await load();
    const blocked = p.priceForLot({ cost: '100', currentPrice: '90', rule: { mode: 'markup', value: '10', minProfit: '5', ceiling: '100', allowRaise: true } });
    assert.equal(blocked.action, 'block');
    const capped = p.priceForLot({ cost: '100', currentPrice: '150', rule: { mode: 'markup', value: '50', minProfit: '5', ceiling: '120', allowRaise: true } });
    assert.equal(capped.target, '120');
    assert.equal(capped.action, 'lower');
    const noRaiseOk = p.priceForLot({ cost: '100', currentPrice: '115', rule: { mode: 'markup', value: '30', minProfit: '10', allowRaise: false } });
    assert.equal(noRaiseOk.action, 'keep');
    const noRaiseBad = p.priceForLot({ cost: '100', currentPrice: '105', rule: { mode: 'markup', value: '30', minProfit: '10', allowRaise: false } });
    assert.equal(noRaiseBad.action, 'block');
    assert.equal(p.priceForLot({ cost: null, currentPrice: '1', rule: { mode: 'markup', value: '1' } }).action, 'skip');
});

test('fees reduce the net: the floor accounts for them', async () => {
    const p = await load();
    const result = p.priceForLot({ cost: '100', currentPrice: '100', rule: { mode: 'markup', value: '0', minProfit: '10', feePercent: '10', fixedFee: '5', allowRaise: true } });
    // S ≥ (100 + 5 + 10) / 0.9 = 127.78
    assert.equal(result.target, '127.78');
    const money = await import(pathToFileURL(path.join(__dirname, '../background/money.js')).href);
    assert.ok(money.compareDecimal(p.netProfit({ price: result.target, cost: '100', feePercent: '10', fixedFee: '5' }), '10') >= 0);
    assert.deepEqual(p.validatePricingRule({ mode: 'margin', value: '100' }), ['Маржа должна быть меньше 100%.']);
});
