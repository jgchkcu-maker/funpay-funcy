const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
const helper = source.slice(source.indexOf('async function parseLotEditPageViaOffscreen('), source.indexOf('\nconfigureAutoDeliveryStore('));
const handlers = source.slice(source.indexOf("    if (request.action === 'getLotForExport')"), source.indexOf('\n    // =====================================================================================', source.indexOf("    if (request.action === 'getOwnLotFull')")));

function harness(result) {
    const calls = [];
    const context = vm.createContext({ URLSearchParams, GOLDEN_SEAL_ERROR: 'expired session',
        getAuthDetailsForBackground: async () => ({ golden_key: 'test' }),
        fptFetchWithSeal: async () => ({ response: { ok: true, text: async () => '<title>Just a moment...</title>' }, seal: { present: false } }),
        parseHtmlViaOffscreen: async (...args) => { calls.push(args); return result; }
    });
    vm.runInContext(helper + '\nfunction handle(request, sendResponse) {\n' + handlers + '\n}', context);
    return { context, calls, invoke: action => new Promise(resolve => context.handle({ action, offerId: '501', nodeId: '42' }, resolve)) };
}

test('export, own-lot import and auto delivery propagate parser errors without successful null data', async () => {
    for (const code of ['browser_check', 'login_required', 'offer_not_found', 'form_missing', 'parse_failed']) {
        const message = `Error: ${code}`;
        const h = harness({ ok: false, error: { code, message } });
        for (const action of ['getLotForExport', 'getOwnLotFull']) {
            const response = await h.invoke(action);
            assert.equal(response.success, false);
            assert.equal(response.error, message);
            assert.equal(response.data, undefined);
        }
        await assert.rejects(h.context.readAutoDeliveryLotForm({ id: '501', nodeId: '42' }), error => error.message === message);
        assert.equal(h.calls.length, 3);
        for (const [, action, extra] of h.calls) {
            assert.equal(action, 'parseLotEditPage');
            assert.equal(extra.detailed, true);
        }
    }
});

test('successful lot fields keep the existing export, import-preview and stock contracts', async () => {
    const data = { node_id: '42', price: '120', amount: '2', auto_delivery: 'on', secrets: 'KEY', 'fields[summary][ru]': 'Lot', 'fields[payment_msg][ru]': 'Buyer message' };
    const h = harness({ ok: true, data });
    const exported = await h.invoke('getLotForExport');
    assert.equal(exported.success, true);
    assert.deepEqual(exported.data, data);
    const imported = await h.invoke('getOwnLotFull');
    assert.equal(imported.success, true);
    assert.equal(imported.source.payment_msg_ru, 'Buyer message');
    assert.equal(imported.source.rawPrice, '120');
    assert.equal(imported.source.autoDelivery, true);
    assert.deepEqual(imported.source.fullData, data);
    assert.deepEqual(await h.context.readAutoDeliveryLotForm({ id: '501', nodeId: '42' }), data);
});

test('missing or malformed offscreen responses fail closed', async () => {
    for (const result of [null, undefined, {}, { ok: true, data: null }]) {
        const h = harness(result);
        const response = await h.invoke('getLotForExport');
        assert.equal(response.success, false);
        assert.equal(response.error, 'Не удалось разобрать форму лота.');
    }
});
