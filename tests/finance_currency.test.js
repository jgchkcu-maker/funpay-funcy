const assert = require('node:assert/strict');

const financeData = require('../content/features/finance_data.js');
const profitEngine = require('../content/features/profit_engine.js');

function testMultiCurrencyAllStaysSeparated() {
    const date = Date.UTC(2026, 8, 20, 12);
    const sales = financeData.aggregateSales([
        { orderId: 'rub-order', orderStatus: 'closed', price: 100, currency: 'RUB', orderDate: date },
        { orderId: 'usd-order', orderStatus: 'closed', price: 10, currency: 'USD', orderDate: date }
    ], { currency: 'all' });

    assert.equal(sales.isMultiCurrency, true);
    assert.equal(sales.currency, null);
    assert.deepEqual(sales.byCurrency, { RUB: 100, USD: 10 });
    assert.equal(sales.byDay['2026-09-20'].revenue, null, 'all-currency chart value is unavailable, not guessed');
    assert.deepEqual(sales.byDay['2026-09-20'].revenueByCurrency, { RUB: 100, USD: 10 });

    const operations = financeData.aggregateOperations([
        { id: 'rub-op', type: 'deposit', status: 'complete', signed: 100, currency: 'RUB', date },
        { id: 'usd-op', type: 'deposit', status: 'complete', signed: 10, currency: 'USD', date }
    ], { currency: 'all' });
    assert.equal(operations.isMultiCurrency, true);
    assert.equal(operations.byDay['2026-09-20'].in, null);
    assert.deepEqual(operations.netByCur, { RUB: 100, USD: 10 });
}

function testMissingCostRemainsUnknown() {
    const result = profitEngine.calculateOrderProfit({
        orderId: 'without-cost',
        orderStatus: 'closed',
        price: 100,
        currency: 'RUB'
    });

    assert.equal(result.hasCost, false);
    assert.equal(result.costBasis, null);
    assert.equal(result.netProfit, null);
    assert.equal(result.margin, null);
    assert.equal(result.roi, null);
    assert.doesNotMatch(JSON.stringify(result), /Infinity|NaN/);
}

function main() {
    testMultiCurrencyAllStaysSeparated();
    testMissingCostRemainsUnknown();
    console.log('FINANCE_CURRENCY_PASS');
}

try {
    main();
} catch (error) {
    console.error(`FINANCE_CURRENCY_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
}
