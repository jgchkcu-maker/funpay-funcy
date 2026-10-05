const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../content/ui/finance_hub_model.js');

const at = iso => Date.parse(`${iso}T12:00:00+03:00`);

test('money and percent formatting keeps a non-breaking symbol and never prints NaN', () => {
    assert.equal(model.formatMoney(1234.5, 'RUB'), '1 234,50 ₽');
    assert.equal(model.formatMoney(2, 'USD'), '2 $');
    assert.equal(model.formatMoney(NaN, 'RUB'), '—');
    assert.equal(model.formatPercent(45), '45,0%');
    assert.equal(model.formatSigned(-12470, 'RUB'), '−12 470 ₽');
    assert.equal(model.formatCompact(173177), '173,2 тыс.');
});

test('delta is explicit when there is no baseline and never divides by zero', () => {
    assert.equal(model.delta(10, 0).state, 'na');
    assert.equal(model.delta(10, null).state, 'na');
    assert.equal(model.delta(110, 100).text, '+10,0%');
    assert.equal(model.delta(90, 100).state, 'down');
    assert.equal(model.delta(100, 100).state, 'flat');
});

test('sales series fills empty days and sums only closed/paid orders in the chosen currency', () => {
    const orders = [
        { orderId: 1, orderDate: at('2026-09-01'), orderStatus: 'closed', price: 100, currency: 'RUB' },
        { orderId: 2, orderDate: at('2026-09-01'), orderStatus: 'paid', price: 50, currency: 'RUB' },
        { orderId: 3, orderDate: at('2026-09-01'), orderStatus: 'refunded', price: 999, currency: 'RUB' },
        { orderId: 4, orderDate: at('2026-09-01'), orderStatus: 'closed', price: 5, currency: 'USD' },
        { orderId: 5, orderDate: at('2026-09-04'), orderStatus: 'closed', price: 10, currency: 'RUB',
            profitInfo: { hasCost: true, netProfit: 4, isRefunded: false } }
    ];
    const series = model.buildSalesSeries(orders, { step: 'day', currency: 'RUB' });
    assert.deepEqual(series.map(b => b.key), ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
    assert.equal(series[0].revenue, 150);
    assert.equal(series[0].count, 2);
    assert.equal(series[0].refunded, 1);
    assert.equal(series[1].revenue, 0);
    assert.equal(series[3].profit, 4);
});

test('month and week steps bucket by the MSK calendar', () => {
    const lateNight = Date.parse('2026-08-31T22:30:00Z'); // 01:30 MSK on 1 September
    const [bucket] = model.buildSalesSeries([{ orderDate: lateNight, orderStatus: 'closed', price: 1, currency: 'RUB' }], { step: 'month' });
    assert.equal(bucket.key, '2026-09');
    assert.equal(model.weekKey(at('2026-09-03')), '2026-08-31'); // Monday
});

test('step selection follows the period and falls back to the data span', () => {
    assert.equal(model.chooseStep('7d', []), 'day');
    assert.equal(model.chooseStep('90d', []), 'week');
    assert.equal(model.chooseStep('365d', []), 'month');
    const wide = [{ orderDate: at('2026-01-01') }, { orderDate: at('2026-09-01') }];
    assert.equal(model.chooseStep('all', wide), 'month');
});

test('rankings group by name, skip refunds and fold the tail into "Прочее"', () => {
    const orders = [];
    for (let i = 0; i < 8; i++) orders.push({ orderStatus: 'closed', price: 100 - i * 10, currency: 'RUB', subcategoryName: `Cat ${i}` });
    orders.push({ orderStatus: 'refunded', price: 5000, currency: 'RUB', subcategoryName: 'Cat 0' });
    const ranked = model.rankByCategory(orders, 'RUB');
    assert.equal(ranked[0].name, 'Cat 0');
    assert.equal(ranked[0].revenue, 100);
    const folded = model.foldTail(ranked, 5);
    assert.equal(folded.rows.length, 6);
    assert.equal(folded.rows[5].name, 'Прочее');
    assert.equal(folded.rows[5].folded, 3);
    assert.ok(Math.abs(folded.rows.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-9);
});

test('currency choice never mixes currencies', () => {
    assert.equal(model.pickCurrency('USD', { RUB: 5, USD: 1 }), 'USD');
    assert.equal(model.pickCurrency('all', { RUB: 5, USD: 90 }), 'USD');
    assert.equal(model.pickCurrency('all', {}, ['EUR', 'RUB']), 'RUB');
    assert.equal(model.formatCurrencyMap({ USD: 3, RUB: 10, EUR: 0 }), '10 ₽ · 3 $');
});

test('nice scale returns ascending ticks covering the maximum', () => {
    const { max, ticks } = model.niceScale(173177, 4);
    assert.ok(max >= 173177);
    assert.equal(ticks[0], 0);
    assert.equal(ticks[ticks.length - 1], max);
    assert.ok(ticks.every((tick, i) => i === 0 || tick > ticks[i - 1]));
});
