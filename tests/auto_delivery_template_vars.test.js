const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../background/autoresponder.js'), 'utf8');
const variablesStart = source.indexOf('function applyVariables(template, vars = {}) {');
const variablesEnd = source.indexOf('\nasync function atomicUpdate', variablesStart);
// From the order-journal helpers (orderIdOf, getOrderDetails, delivery ops) through handleAutoDelivery.
const deliveryStart = source.indexOf('// --- Журнал заказов (этап 0)');
const deliveryEnd = source.indexOf('\nasync function notifyDearVendors', deliveryStart);
const testedSource = [
    source.slice(variablesStart, variablesEnd),
    source.slice(deliveryStart, deliveryEnd).replace(/^export /gm, ''),
    'globalThis.runDelivery = handleAutoDelivery;'
].join('\n');

test('auto-delivery templates receive the parsed lot name', async () => {
    assert.ok(deliveryStart > 0, 'order journal helpers must precede handleAutoDelivery');
    const { createOrderDetailsLoader } = await import(require('node:url').pathToFileURL(path.join(__dirname, '../background/order_details.js')).href);
    const sent = [];
    const sandbox = {
        createOrderDetailsLoader,
        RX: { ORDER_ID: /#([A-Z0-9]{8})/ },
        getMessageType: () => 'ORDER_PURCHASED',
        isBlacklisted: async () => false,
        fetchWithRetry: async () => ({ ok: true, text: async () => 'order-page' }),
        parseViaOffscreen: async () => ({
            secrets: 'fallback secret', lotId: '501', nodeId: '42', buyerChatId: '55', lotName: 'Аккаунт Deluxe'
        }),
        chrome: {
            storage: { local: { get: async () => ({ fpToolsAutoDeliveryLots: {
                '501': { enabled: true, mode: 'template', text: '{buyername}: {lotname} / {orderid}' }
            } }) } }
        },
        isAutoDeliveryLotEnabled: () => true,
        sendChatMessage: async (_chatId, text) => sent.push(text),
        atomicUpdate: async update => update({}),
        refreshAutoDeliveryLotStock: async () => {}
    };
    vm.createContext(sandbox);
    vm.runInContext(testedSource, sandbox);

    await sandbox.runDelivery({
        messageText: 'Покупатель оплатил заказ #ABCD1234', buyerName: 'Иван', chatId: '55'
    }, {}, { autoDeliveryEnabled: true });

    assert.deepEqual(sent, ['Иван: Аккаунт Deluxe / ABCD1234']);
});
