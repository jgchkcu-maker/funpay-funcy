const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

// The delivery path now lives in fulfillment_dispatcher.js; the old handleAutoDelivery
// (no paid check, quantity defaulting to 1, delivery without a journal) is gone.
async function deliver({ config, sendStatus = 'confirmed' }) {
    const ops = await load('ops_db.js');
    const facts = await load('order_facts.js');
    const { createFulfillmentDispatcher } = await load('fulfillment_dispatcher.js');
    const source = require('node:fs').readFileSync(path.join(__dirname, '../background/autoresponder.js'), 'utf8');
    const start = source.indexOf('export function applyVariables(template, vars = {}) {');
    const end = source.indexOf('\nasync function atomicUpdate', start);
    // eslint-disable-next-line no-new-func
    const applyVariables = new Function(`${source.slice(start, end).replace(/^export /, '')}\nreturn applyVariables;`)();
    const sent = [];
    const refreshed = [];
    const journal = ops.createOpsJournal({ backend: ops.createMemoryBackend() });
    const dispatcher = createFulfillmentDispatcher({
        journal,
        guard: { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => ({}) },
        loadFacts: async orderId => ({ ...facts.normalizeOrderFacts({
            recognized: true, pageOrderId: orderId, currentUserId: '100', sellerId: '100', buyerId: '5', buyerUsername: 'Иван',
            buyerChatId: '55', statusText: 'Оплачен', quantityText: '1', lotId: '501', nodeId: '42', lotName: 'Аккаунт Deluxe', secrets: ['qa-secret']
        }, { requestedOrderId: orderId }), lotCandidate: null }),
        sender: { send: async ({ text }) => { sent.push(text); return { status: sendStatus }; } },
        getAuth: async () => ({ csrf_token: 'c' }),
        getAutoReplies: async () => ({ autoDeliveryEnabled: true }),
        getDeliveryConfigs: async () => ({ 501: config }),
        isLotEnabled: cfg => Boolean(cfg && cfg.enabled !== false),
        render: applyVariables,
        sleep: async () => {},
        hash: async () => 'h',
        onDelivered: async ({ offerId, nodeId, source }) => { if (source === 'funpay_secrets') refreshed.push([offerId, nodeId]); },
        log: { error() {}, warn() {} }
    });
    await dispatcher.observe({ orderId: 'ABCD1234', source: 'chat', eventChatId: '55' });
    return { sent, refreshed };
}

test('auto-delivery templates receive the parsed lot name', async () => {
    const { sent } = await deliver({ config: { enabled: true, mode: 'template', text: '{buyername}: {lotname} / {orderid}' } });
    assert.deepEqual(sent, ['Иван: Аккаунт Deluxe / ABCD1234']);
});

test('secret stock refresh follows a successful delivery and respects explicit lot disablement', async () => {
    const success = await deliver({ config: { enabled: true, mode: 'secrets' } });
    assert.deepEqual(success.refreshed, [['501', '42']]);
    assert.deepEqual(success.sent, ['qa-secret']);

    const disabled = await deliver({ config: { enabled: false, mode: 'secrets' } });
    assert.deepEqual(disabled.sent, [], 'a disabled lot sends nothing');
    assert.deepEqual(disabled.refreshed, []);

    const legacy = await deliver({ config: { mode: 'secrets' } });
    assert.deepEqual(legacy.refreshed, [['501', '42']], 'missing enabled stays compatible with prior settings');

    const failed = await deliver({ config: { enabled: true, mode: 'secrets' }, sendStatus: 'rejected' });
    assert.deepEqual(failed.refreshed, [], 'a failed delivery does not refresh stock');
});
