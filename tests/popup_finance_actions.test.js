const test = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('./helpers/popup_actions_harness');
function finance() {
    const h = context(), calls = [];
    const items = [{ id: 'one', price: 12, currency: 'RUB' }];
    h.ctx.window.FPTFinanceData = {};
    for (const name of ['Sales', 'Purchases', 'Operations']) {
        h.ctx.window.FPTFinanceData['get'+name] = async options => { calls.push({ name, options }); return items; };
        h.ctx.window.FPTFinanceData['aggregate'+name] = rows => ({ count: rows.length });
    }
    h.ctx.window.FPTPotential = { async getInventory(options) { calls.push({ name: 'inventory', options }); return [{ id: 'lot' }]; },
        calculatePotentialAggregates: rows => ({ RUB: { count: rows.length } }), calculateCurrencyTotals: rows => ({ count: rows.length }) };
    h.load('content/features/finance_hub.js');
    return { ...h, calls, items };
}
test('sales and operation filters are explicit and do not leak between requests', async () => {
    const h = finance();
    await h.api.run('finance_hub', 'getFinanceData', { mode: 'sales', filters: { statuses: 'closed', period: '7d' } });
    await h.api.run('finance_hub', 'getFinanceData', { mode: 'operations', filters: { statuses: 'waiting', period: '30d' } });
    assert.equal(h.calls[0].options.statuses, 'closed'); assert.equal(h.calls[1].options.statuses, 'waiting');
    assert.equal(h.calls[0].options.period, '7d'); assert.equal(h.calls[1].options.period, '30d');
    assert.deepEqual(h.saved, {});
});
test('potential is a current snapshot and never applies a historical period to inventory', async () => {
    const h = finance();
    const result = await h.api.run('finance_hub', 'fptFinExportBtn', { mode: 'potential', filters: { period: '365d' } });
    assert.equal(result.meta.period, 'snapshot'); assert.equal(result.items.length, 1);
    assert.equal(h.calls[0].options.period, undefined);
});
test('refresh coalesces concurrent calls, exposes partial failures and allows retry', async () => {
    const h = finance();
    h.ctx.chrome.runtime.sendMessage = async message => { h.messages.push(message); return { success: message.action !== 'updatePurchases', error: 'offline' }; };
    const [a, b] = await Promise.all([h.api.run('finance_hub', 'fptFinRefreshBtn'), h.api.run('finance_hub', 'fptFinRefreshBtn')]);
    assert.equal(a, b); assert.deepEqual(h.messages.map(m => m.action).sort(), ['updateFinance','updatePurchases','updateSales']);
    assert.equal(a.sources.purchases.status, 'rejected'); assert.equal(a.sources.sales.status, 'fulfilled');
    assert.equal(h.calls.length, 1);
    await h.api.run('finance_hub', 'fptFinRefreshBtn'); assert.equal(h.messages.length, 6);
});
test('custom date range rejects invalid dates and passes inclusive MSK dates to the engine', async () => {
    const h = finance();
    await assert.rejects(h.api.run('finance_hub', 'fptFinCustomApplyBtn', { from: '2026-02-30', to: '2026-03-01' }), /диапазон/);
    await h.api.run('finance_hub', 'fptFinCustomApplyBtn', { mode: 'sales', from: '2026-09-20', to: '2026-09-21' });
    assert.equal(h.calls[0].options.period.from, '2026-09-20'); assert.equal(h.calls[0].options.period.to, '2026-09-21');
    await h.api.run('finance_hub', 'fptFinCustomResetBtn', { mode: 'sales' });
    assert.equal(h.calls[1].options.period, '7d');
});
test('finance export uses the existing serializer and returns a file result without a dialog', async () => {
    const h = finance(); let args;
    h.ctx.window.FPTExportStudio = { financeExport: { buildJSON(...values) { args = values; return 'exported'; } } };
    const result = await h.api.run('finance_hub', 'fptFinExportBtn', { mode: 'sales', format: 'json' });
    assert.equal(result.content, 'exported'); assert.equal(args[0], 'sales'); assert.equal(args[1], h.items);
    assert.equal(result.mimeType, 'application/json');
});

test('profit filters return the aggregate totals and preserve unknown costs for export', async () => {
    const h = finance(); let serialized;
    const unknown = { id: 'unknown', profitInfo: { hasCost: false } };
    h.ctx.window.FPTFinanceData.aggregateProfit = async () => ({ orders: [unknown], totals: { old: true } });
    h.ctx.window.FPTProfitEngine = { calculateProfitAggregates: rows => ({ totals: {
        eligibleOrdersCount: rows.length, realisedCost: null, realisedNetProfit: null
    }, byCurrency: { RUB: { realisedCost: null } }, currency: 'RUB' }) };
    h.ctx.window.FPTExportStudio = { financeExport: { buildJSON(dataset, items, totals) { serialized = totals; return '{}'; } } };
    const result = await h.api.run('finance_hub', 'fptFinExportBtn', { mode: 'profit', filter: 'without-cost', format: 'json' });
    assert.equal(result.items.length, 1); assert.equal(result.totals.eligibleOrdersCount, 1);
    assert.equal(serialized.realisedCost, null); assert.equal(result.byCurrency.RUB.realisedCost, null);
});

test('real finance engines export positive profit and potential totals in the existing file schema', async () => {
    const h = finance();
    h.load('content/features/profit_engine.js'); h.load('content/features/finance_potential.js');
    const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
    const source = fs.readFileSync(path.join(__dirname, '../content/features/export_studio.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('//  FP Tools — Finance Hub Verified Export Engine')), h.ctx);
    h.ctx.window.FPTFinanceData.aggregateProfit = options => h.ctx.window.FPTProfitEngine.getRealisedProfit({ ...options,
        orders: [{ orderId: 'sale', status: 'closed', price: 100, currency: 'RUB', costBasisSnapshot: 40 }]
    });
    h.ctx.window.FPTPotential.getInventory = async () => [{ offerId: 'lot', active: true, stock: 2, stockKind: 'finite',
        sellerPrice: 100, buyerPrice: 120, currency: 'RUB', costBasis: 40 }];
    const profit = await h.api.run('finance_hub', 'fptFinExportDownloadCsv', { mode: 'profit', filters: { currency: 'all' } });
    assert.equal(profit.totals.realisedNetProfit, 60); assert.match(profit.content, /Закрытых заказов;1/);
    const potential = await h.api.run('finance_hub', 'fptFinExportBtn', { mode: 'potential', format: 'json' });
    const file = JSON.parse(potential.content);
    assert.equal(file.totals.sellerRevenue, 200); assert.equal(file.totals.knownPotentialProfit, 120);
    assert.equal(file.totals.finiteOffers, 1); assert.equal(file.meta.period, 'snapshot');
});
