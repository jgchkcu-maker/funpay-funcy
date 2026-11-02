const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const writerUrl = pathToFileURL(path.join(__dirname, '../background/chip_writer.js')).href;

const tradeForm = () => [
    ['csrf_token', 't'], ['game', '9'], ['chip', '42'],
    ['offers[7][1][amount]', '111'], ['offers[7][1][price]', '135.64'], ['offers[7][1][active]', 'on'],
    ['offers[8][1][amount]', '5'], ['offers[8][1][price]', '10']
];

function guard(accountId = '100') {
    return { current: async () => ({ accountId, epoch: 1 }), assertCurrent: async () => {} };
}

test('chip offer id maps to its trade form row', async () => {
    const { parseChipOfferId } = await import(writerUrl);
    assert.deepEqual(parseChipOfferId('100-9-42-7-1'), { accountId: '100', nodeId: '42', key: 'offers[7][1]' });
    assert.equal(parseChipOfferId('101'), null);
    assert.equal(parseChipOfferId('100-9-x-7'), null);
});

test('deactivating a chip removes only its active flag and keeps other servers', async () => {
    const { createChipWriter } = await import(writerUrl);
    const saves = [];
    const writer = createChipWriter({ guard: guard(), readTrade: async () => tradeForm(), saveTrade: async f => { saves.push(f); } });
    const result = await writer.write({ offerId: '100-9-42-7-1', op: { type: 'setActive', active: false }, expectedAccountId: '100' });
    assert.equal(result.active, false);
    const sent = new Map(saves[0]);
    assert.equal(sent.has('offers[7][1][active]'), false);
    assert.equal(sent.get('offers[8][1][price]'), '10');
    assert.equal(sent.get('offers[7][1][amount]'), '111');
});

test('chip price adjusts from the fresh form and enabling adds the flag', async () => {
    const { createChipWriter } = await import(writerUrl);
    const saves = [];
    const writer = createChipWriter({ guard: guard(), readTrade: async () => tradeForm(), saveTrade: async f => { saves.push(f); } });
    const priced = await writer.write({ offerId: '100-9-42-7-1', op: { type: 'adjustPrice', mode: 'percent_up', value: '10' } });
    assert.equal(priced.price, '149.2');
    assert.equal(new Map(saves[0]).get('offers[7][1][price]'), '149.2');
    await writer.write({ offerId: '100-9-42-8-1', op: { type: 'setActive', active: true } });
    assert.equal(new Map(saves[1]).get('offers[8][1][active]'), 'on');
});

test('chip writes refuse foreign accounts, missing rows and delete', async () => {
    const { createChipWriter } = await import(writerUrl);
    const writer = createChipWriter({ guard: guard(), readTrade: async () => tradeForm(), saveTrade: async () => {} });
    await assert.rejects(writer.write({ offerId: '200-9-42-7-1', op: { type: 'setActive', active: true } }), /другим аккаунтом/);
    await assert.rejects(writer.write({ offerId: '100-9-42-7-1', op: { type: 'setActive', active: true }, expectedAccountId: '200' }), /другим аккаунтом/);
    await assert.rejects(writer.write({ offerId: '100-9-42-9-1', op: { type: 'setActive', active: true } }), /не найдено/);
    await assert.rejects(writer.write({ offerId: '100-9-42-7-1', op: { type: 'delete' } }), /только цена/);
});
