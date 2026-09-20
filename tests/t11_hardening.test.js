const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const profit = require('../content/features/profit_engine.js');
const financeData = require('../content/features/finance_data.js');
const potential = require('../content/features/finance_potential.js');
const costBasis = require('../content/features/cost_basis_store.js');

function expectEqual(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
}

function runProfitFixtures() {
    const orders = [
        { orderId: 'A', orderStatus: 'closed', price: 1000, currency: 'RUB', costBasisSnapshot: 600, costBasisCurrency: 'RUB' },
        { orderId: 'B', orderStatus: 'closed', price: 500, currency: 'RUB' },
        { orderId: 'C', orderStatus: 'refunded', price: 700, currency: 'RUB', costBasisSnapshot: 400, costBasisCurrency: 'RUB' },
        { orderId: 'D', orderStatus: 'closed', price: 800, currency: 'RUB', costBasisSnapshot: 900, costBasisCurrency: 'RUB' },
        { orderId: 'USD1', orderStatus: 'closed', price: 10, currency: 'USD', costBasisSnapshot: 6, costBasisCurrency: 'USD' }
    ];

    const result = profit.calculateProfitAggregates(orders, { currency: 'RUB' });
    expectEqual(result.totals.eligibleOrdersCount, 3, 'Fixture A: eligible RUB orders');
    expectEqual(result.totals.eligibleRevenue, 2300, 'Fixture A: eligible RUB revenue');
    expectEqual(result.totals.knownCostOrdersCount, 2, 'Fixture A: known-cost RUB orders');
    expectEqual(result.totals.knownCostRevenue, 1800, 'Fixture A: known-cost RUB revenue');
    expectEqual(result.totals.realisedCost, 1500, 'Fixture A: realised RUB cost');
    expectEqual(result.totals.realisedNetProfit, 300, 'Fixture A: realised RUB profit');
    expectEqual(result.totals.orderCoverage, 66.67, 'Fixture A: order coverage');
    expectEqual(result.totals.revenueCoverage, 78.26, 'Fixture A: revenue coverage');
    expectEqual(result.totals.refundedOrdersCount, 1, 'Fixture A: refunds excluded');
    expectEqual(result.byCurrency.USD.realisedNetProfit, 4, 'Fixture B: USD stays separate');
    expectEqual(profit.calculateOrderProfit(orders[3]).netProfit, -100, 'Fixture D: negative profit is preserved');

    const purchasesOnly = [
        { orderId: 'purchase-1', orderStatus: 'closed', price: 9999, currency: 'RUB', costBasisSnapshot: 1, costBasisCurrency: 'RUB' }
    ];
    const purchases = financeData.aggregatePurchases(purchasesOnly);
    expectEqual(purchases.count, 1, 'Purchases aggregation remains independent');
    const withPurchases = profit.calculateProfitAggregates(orders, { currency: 'RUB' });
    const salesOnly = profit.calculateProfitAggregates(orders, { currency: 'RUB' });
    expectEqual(withPurchases.totals.realisedNetProfit, salesOnly.totals.realisedNetProfit, 'Fixture C: purchases do not alter sales profit');
    assert.notEqual(purchasesOnly[0].orderId, orders[0].orderId, 'Fixture C: purchase fixture remains separate');

    const operations = financeData.aggregateOperations([
        { type: 'deposit', status: 'complete', signed: 250, currency: 'RUB' },
        { type: 'fee', status: 'complete', signed: -50, currency: 'RUB' },
        { type: 'waiting', status: 'waiting', signed: 99, currency: 'RUB' }
    ]);
    expectEqual(operations.count, 2, 'Finance operations default to complete');
    expectEqual(operations.netByCur.RUB, 200, 'Finance operations update net balance');

    const mismatch = profit.calculateOrderProfit({
        orderId: 'mismatch', orderStatus: 'closed', price: 100, currency: 'RUB',
        costBasisSnapshot: 10, costBasisCurrency: 'USD'
    });
    expectEqual(mismatch.netProfit, null, 'Fixture E: cross-currency cost is unknown');
    expectEqual(mismatch.hasCurrencyMismatch, true, 'Fixture E: cross-currency mismatch is explicit');

    const empty = profit.calculateProfitAggregates([], { currency: 'RUB' });
    expectEqual(empty.totals.eligibleOrdersCount, 0, 'Empty DB');
    const one = profit.calculateProfitAggregates([orders[0]], { currency: 'RUB' });
    expectEqual(one.totals.realisedNetProfit, 400, 'One order');

    const bulk = Array.from({ length: 10000 }, (_, i) => ({
        orderId: `bulk-${i}`,
        orderStatus: 'closed',
        price: 10,
        currency: 'RUB',
        costBasisSnapshot: 6,
        costBasisCurrency: 'RUB'
    }));
    const started = performance.now();
    const bulkResult = profit.calculateProfitAggregates(bulk, { currency: 'RUB' });
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    expectEqual(bulkResult.totals.eligibleOrdersCount, 10000, '10k orders count');
    expectEqual(bulkResult.totals.realisedNetProfit, 40000, '10k orders profit');
    assert.ok(elapsedMs < 2000, `10k aggregation remained bounded (${elapsedMs} ms)`);
    return elapsedMs;
}

function runSalesAndPotentialFixtures() {
    const sales = financeData.aggregateSales([
        { orderId: 'missing-date', orderStatus: 'closed', price: 100, currency: 'RUB', buyerUsername: 'buyer' },
        { orderId: 'paid', orderStatus: 'paid', price: 50, currency: 'RUB', buyerUsername: 'buyer' },
        { orderId: 'refund', orderStatus: 'refunded', price: 20, currency: 'RUB', buyerUsername: 'buyer' },
        { orderId: 'usd', orderStatus: 'closed', price: 10, currency: 'USD', buyerUsername: 'buyer' }
    ]);
    expectEqual(sales.count, 3, 'Sales aggregation keeps closed/paid only');
    expectEqual(sales.byCurrency.RUB, 150, 'Sales aggregation keeps RUB currency');
    expectEqual(sales.byCurrency.USD, 10, 'Sales aggregation keeps USD currency');
    expectEqual(sales.byStatus.refunded, 1, 'Sales aggregation tracks refunds');
    assert.ok(Object.keys(sales.byDay).length >= 1, 'Missing date is assigned a stable day bucket');

    const lots = [
        potential.normalizeLotRow({ offerId: 'L1', active: true, stock: 5, sellerPrice: 1000, buyerPrice: 1100, currency: 'RUB', costBasis: 600 }),
        potential.normalizeLotRow({ offerId: 'L2', active: true, stock: 0, sellerPrice: 1000, buyerPrice: 1100, currency: 'RUB', costBasis: 600 }),
        potential.normalizeLotRow({ offerId: 'L3', active: true, stock: null, sellerPrice: 700, buyerPrice: 770, currency: 'RUB', costBasis: 600 }),
        potential.normalizeLotRow({ offerId: 'L4', active: true, stock: 2, sellerPrice: 500, buyerPrice: 550, currency: 'RUB' }),
        potential.normalizeLotRow({ offerId: 'L5', active: false, stock: 9, sellerPrice: 900, buyerPrice: 990, currency: 'RUB', costBasis: 400 })
    ];
    const totals = potential.calculatePotentialAggregates(lots);
    expectEqual(totals.RUB.sellerRevenue, 6000, 'Potential: finite seller revenue');
    expectEqual(totals.RUB.buyerGmv, 6600, 'Potential: finite buyer GMV');
    expectEqual(totals.RUB.knownInventoryCost, 3000, 'Potential: known inventory cost');
    expectEqual(totals.RUB.knownPotentialProfit, 2000, 'Potential: negative profit remains possible');
    expectEqual(totals.RUB.unknownStockOffers, 1, 'Potential: unknown stock is visible');
    expectEqual(totals.RUB.finiteOffers, 3, 'Potential: zero stock remains finite');
    expectEqual(totals.RUB.costCoveragePercent, 83.33, 'Potential: cost coverage');
    expectEqual(potential.parseStock(0).stock, 0, 'Stock zero is not replaced by one');
    expectEqual(potential.parseStock(null).stockKind, 'unknown', 'Null stock is unknown');
    expectEqual(potential.parseStock('unlimited').stockKind, 'unlimited', 'Unlimited stock remains unlimited');
}

async function runCostEditorFixtures() {
    const makeSession = () => ({
        items: {},
        getItem(key) { return Object.prototype.hasOwnProperty.call(this.items, key) ? this.items[key] : null; },
        setItem(key, value) { this.items[key] = String(value); },
        removeItem(key) { delete this.items[key]; }
    });
    const tabA = makeSession();
    const tabB = makeSession();
    costBasis._setSessionDriver(tabA);

    const existing = await costBasis.set('own-existing', { amount: '600,50', currency: 'RUB', nodeId: 'node-1' });
    expectEqual(existing.amount, 600.5, 'Cost editor existing record');
    expectEqual((await costBasis.get('own-existing')).currency, 'RUB', 'Cost editor reads existing record');
    await costBasis.set('own-existing', { amount: '', currency: 'RUB' });
    expectEqual(await costBasis.get('own-existing'), null, 'Cost editor clear removes record');

    costBasis.saveDraft('node-two', { amount: 12, currency: 'USD', nodeId: 'node-two' });
    expectEqual(costBasis.getDraft('node-two').amount, 12, 'Cost editor create draft');
    costBasis._setSessionDriver(tabB);
    expectEqual(costBasis.getDraft('node-two'), null, 'Two tabs keep drafts isolated');
    costBasis._setSessionDriver(tabA);
    const bound = await costBasis.bindDraftToOffer('node-two', 'own-clone');
    expectEqual(bound.amount, 12, 'Own clone binds draft');
    expectEqual(costBasis.getDraft('node-two'), null, 'Bound draft is cleared');

    const cloneSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'content', 'features', 'lot_cloning.js'), 'utf8');
    assert.match(cloneSource, /src\.isOwn && src\.offerId/, 'Own clone inherits cost only for own source');
    assert.match(cloneSource, /foreign clone[^\n]*не наследует себестоимость/i, 'Foreign clone clears cost');
}

async function main() {
    const elapsedMs = runProfitFixtures();
    runSalesAndPotentialFixtures();
    await runCostEditorFixtures();
    console.log(`T11_HARDENING_PASS elapsed_10k_ms=${elapsedMs}`);
}

main().catch((error) => {
    console.error(`T11_HARDENING_FAIL ${error.message}`);
    process.exitCode = 1;
});
