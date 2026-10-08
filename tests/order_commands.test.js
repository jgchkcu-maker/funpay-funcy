const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

async function setup() {
    const ops = await load('ops_db.js');
    const { createOrderCommands } = await load('order_commands.js');
    const journal = ops.createOpsJournal({ backend: ops.createMemoryBackend() });
    const calls = [];
    const dispatcher = {
        observe: async input => { calls.push(['observe', input]); return { status: 'observed' }; },
        resendUncertainPart: async input => { calls.push(['resend', input]); return { status: 'done' }; },
        deliverRemaining: async input => { calls.push(['remaining', input]); return { status: 'done' }; }
    };
    const commands = createOrderCommands({ journal, guard: { current: async () => ({ accountId: '100', epoch: 1 }) }, dispatcher });
    return { journal, commands, calls };
}

test('the card offers actions that match the evidence, never a generic retry', async () => {
    const { orderCapabilities } = await load('order_commands.js');
    const ids = (order, ctx) => orderCapabilities(order, ctx).map(cap => cap.id);
    assert.deepEqual(ids({ deliveryState: 'blocked', adopted: false, lotCandidate: { offerId: '5' } }, {}), ['verify', 'adopt', 'confirmBinding', 'markDelivered', 'hold']);
    const uncertain = ids({ deliveryState: 'uncertain', adopted: true, lotId: '5' }, { parts: [{ partId: 'p#0', index: 0, state: 'confirmed' }, { partId: 'p#1', index: 1, state: 'uncertain' }], deliveryOp: { state: 'uncertain' } });
    assert.ok(uncertain.includes('resendPart'));
    assert.ok(!uncertain.includes('deliverRemaining'), 'nothing is sent past an uncertain part');
    const partial = ids({ deliveryState: 'partial', adopted: true, lotId: '5' }, { parts: [{ partId: 'p#0', index: 0, state: 'confirmed' }, { partId: 'p#1', index: 1, state: 'rejected' }], deliveryOp: { state: 'failed' } });
    assert.ok(partial.includes('deliverRemaining'));
    const refunded = ids({ deliveryState: 'done', fpStatus: 'refunded', lotId: '5' }, {});
    assert.ok(refunded.includes('openOrder'));
    assert.ok(!refunded.includes('hold'));
});

test('commands check the revision and the capability list', async () => {
    const { journal, commands, calls } = await setup();
    const { order } = await journal.recordAccountOrder({ accountId: '100', orderId: 'ABCD1234', source: 'chat', deliveryState: 'blocked', lotCandidate: { offerId: '77' } });
    await assert.rejects(() => commands.command({ orderKey: order.key, command: 'verify', expectedRevision: 99 }), /изменился/);
    await assert.rejects(() => commands.command({ orderKey: order.key, command: 'resendPart', partId: 'x' }), /недоступно/);
    await commands.command({ orderKey: order.key, command: 'confirmBinding', offerId: '77', expectedRevision: order.revision });
    assert.equal((await journal.getAccountOrder('100', 'ABCD1234')).confirmedBinding.offerId, '77');
    assert.deepEqual(calls.at(-1)[0], 'observe');

    await commands.command({ orderKey: order.key, command: 'hold', reason: 'Покупатель просит подождать' });
    let current = await journal.getAccountOrder('100', 'ABCD1234');
    assert.equal(current.holds[0].owner, 'seller');
    await commands.command({ orderKey: order.key, command: 'releaseHold' });
    current = await journal.getAccountOrder('100', 'ABCD1234');
    assert.equal(current.holds.length, 0);

    await assert.rejects(() => commands.command({ orderKey: order.key, command: 'markDelivered', note: '' }), /Опишите/);
    await commands.command({ orderKey: order.key, command: 'markDelivered', note: 'Выдал вручную в чате' });
    current = await journal.getAccountOrder('100', 'ABCD1234');
    assert.equal(current.deliveryState, 'manual');
    assert.equal(current.manualDelivery.by, 'seller');
    assert.equal(current.verifiedFulfillmentCompletedAt, undefined, 'a manual mark is not verified fulfillment');

    const events = (await commands.card({ orderKey: order.key })).events.map(event => event.type);
    assert.ok(events.includes('seller.markDelivered'));
    const other = await journal.recordAccountOrder({ accountId: '200', orderId: 'ABCD1234', source: 'chat' });
    await assert.rejects(() => commands.card({ orderKey: other.order.key }), /текущего аккаунта/);
});

test('the list filters orders that need a decision and masks delivered goods', async () => {
    const { journal, commands } = await setup();
    await journal.recordAccountOrder({ accountId: '100', orderId: 'AAAA0001', source: 'chat', deliveryState: 'uncertain' });
    await journal.recordAccountOrder({ accountId: '100', orderId: 'AAAA0002', source: 'chat', deliveryState: 'done' });
    const result = await commands.list({ filter: 'attention' });
    assert.deepEqual(result.items.map(item => item.orderId), ['AAAA0001']);
    assert.equal(result.counts.done, 1);
    const { maskSecret } = await load('order_commands.js');
    assert.equal(maskSecret('KEY-ABCDEF-123'), 'KEY•••••••••23');
    assert.equal(maskSecret('abc'), '•••');
});
