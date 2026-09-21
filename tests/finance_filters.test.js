const assert = require('node:assert/strict');

const financeData = require('../content/features/finance_data.js');

const sale = {
    orderId: 'sale-1',
    orderStatus: 'closed',
    price: 900,
    currency: 'RUB',
    orderDate: Date.UTC(2026, 8, 20, 12)
};

const operations = [
    { id: 'operation-complete', type: 'deposit', status: 'complete', signed: 100, currency: 'RUB', date: Date.UTC(2026, 8, 20, 12) },
    { id: 'operation-cancel', type: 'withdraw', status: 'cancel', signed: -50, currency: 'RUB', date: Date.UTC(2026, 8, 20, 13) },
    { id: 'operation-waiting', type: 'withdraw', status: 'waiting', signed: -25, currency: 'RUB', date: Date.UTC(2026, 8, 20, 14) }
];

async function testCompleteOperationFilter() {
    const previousFinanceDb = global.FPTFinanceDB;
    const previousSalesDb = global.FPTSalesDB;
    global.FPTFinanceDB = {
        async getAllAsArray() { return operations.map(row => ({ ...row })); }
    };
    global.FPTSalesDB = {
        async getAllAsArray() { return [sale]; }
    };

    try {
        const complete = await financeData.getOperations({ statuses: 'complete', sort: false });
        assert.deepEqual(complete.map(row => row.id), ['operation-complete']);

        const closedOrders = await financeData.getSales({ statuses: 'closed', sort: false });
        assert.deepEqual(closedOrders.map(row => row.orderId), ['sale-1']);

        const operationsWithOrderStatus = await financeData.getOperations({ statuses: 'closed', sort: false });
        assert.deepEqual(operationsWithOrderStatus, [], 'order status must not select finance operations');
        assert.equal(operationsWithOrderStatus.some(row => row.orderId === sale.orderId), false);
    } finally {
        if (previousFinanceDb === undefined) delete global.FPTFinanceDB;
        else global.FPTFinanceDB = previousFinanceDb;
        if (previousSalesDb === undefined) delete global.FPTSalesDB;
        else global.FPTSalesDB = previousSalesDb;
    }
}

async function main() {
    await testCompleteOperationFilter();
    console.log('FINANCE_FILTERS_PASS');
}

main().catch(error => {
    console.error(`FINANCE_FILTERS_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
