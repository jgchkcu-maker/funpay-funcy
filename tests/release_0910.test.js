const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const load = file => import(pathToFileURL(path.join(root, 'background', file)).href);

test('strict date parsing validates ru/en/uk calendar, MSK day and year rollover', () => {
    const ctx = vm.createContext({});
    vm.runInContext(read('offscreen/order_date.js'), ctx);
    const parse = ctx.FPTOrderDate.parse;
    const now = Date.UTC(2026, 9, 25, 22, 10);
    const expected = Date.UTC(2026, 9, 26, 9, 34);
    for (const date of ['26 октября 2026, 12:34', '26 October 2026, 12:34', 'October 26, 2026, 12:34', '26 жовтня 2026, 12:34', 'сьогодні, 12:34', 'today, 12:34']) {
        assert.equal(parse(date, now), expected, date);
    }
    assert.equal(parse('вчера, 23:59', now), Date.UTC(2026, 9, 25, 20, 59));
    for (const date of ['', 'tomorrow', '31 февраля 2026, 10:00', '29 February 2025, 10:00', '26 октября 2026, 24:00', 'сегодня, xx:00', '26 октября 2026, 12:60', '26 nope, 12:00']) assert.equal(parse(date, now), null, date);
    assert.equal(parse('31 декабря, 23:59', Date.UTC(2027, 0, 1, 1)), Date.UTC(2026, 11, 31, 20, 59));
});

test('send receipts require a new numeric ID, our author and the complete normalized body', async () => {
    const { findSentMessage } = await load('chat_sender.js');
    const make = message => ({ objects: [{ type: 'chat_node', id: '77', data: { messages: [message] } }] });
    const opts = { chatId: '77', accountId: '100', text: 'Key K-1', afterMessageId: '900' };
    assert.equal(findSentMessage(make({ id: '901', author: '100', text: 'Key K-1' }), opts).messageId, '901');
    for (const message of [{ id: 900, author: 100, text: 'Key K-1' }, { id: 901, text: 'Key K-1' }, { author: 100, text: 'Key K-1' }, { id: 901, author: 555, text: 'Key K-1' }, { id: 901, author: 100, text: 'prefix Key K-1 extra' }]) assert.equal(findSentMessage(make(message), opts), null);
    assert.equal(findSentMessage(make({ id: 901, author: 100, text: 'Key K-1' }), { ...opts, afterMessageId: null }), null);
});

test('reconcile checkpoints span budget exhaustion and worker recreation without moving completed border', async () => {
    const { createOpsJournal, createMemoryBackend } = await load('ops_db.js');
    const { createOrderReconcile } = await load('order_reconcile.js');
    const backend = createMemoryBackend();
    let now = 10_000_000;
    let pages = { first: { orders: [] } };
    const observed = [];
    const make = () => {
        const journal = createOpsJournal({ backend, now: () => now });
        const reconcile = createOrderReconcile({ journal, guard: { current: async () => ({ accountId: '1', epoch: 1 }) }, now: () => now, maxPages: 1, maxObserves: 2,
            dispatcher: { observe: async ({ orderId }) => { observed.push(orderId); await journal.updateAccountOrder(`1:${orderId}`, () => ({ deliveryState: 'done' })); } },
            fetchSalesPage: async token => pages[token || 'first'] });
        return { journal, reconcile };
    };
    const a = make(); await a.reconcile.run(); now += 100000;
    const row = (id, at = now) => ({ orderId: id, orderStatus: 'paid', orderDateStrict: at, orderDatePrecisionMs: 60000 });
    pages = { first: { orders: [row('AAAA0001'), row('AAAA0002'), row('AAAA0003')], nextOrderId: 'P2' }, P2: { orders: [row('AAAA0004'), row('OLD00001', 1)] } };
    const before = (await a.journal.getMeta('reconcileBaseline:1')).scannedAt;
    assert.equal((await a.reconcile.run()).incomplete, true);
    assert.equal((await a.journal.getMeta('reconcileBaseline:1')).scannedAt, before);
    const b = make();
    for (let i = 0; i < 4; i++) await b.reconcile.run();
    assert.deepEqual(observed, ['AAAA0001', 'AAAA0002', 'AAAA0003', 'AAAA0004']);
    assert.equal((await b.journal.getMeta('reconcileBaseline:1')).scan, null);
});

test('unknown and minute-boundary dates stay visible without automatic adoption', async () => {
    const { createOpsJournal, createMemoryBackend } = await load('ops_db.js');
    const { createOrderReconcile } = await load('order_reconcile.js');
    const journal = createOpsJournal({ backend: createMemoryBackend() });
    let now = 123456789;
    let orders = [];
    const reconcile = createOrderReconcile({ journal, guard: { current: async () => ({ accountId: '1' }) }, now: () => now,
        dispatcher: { observe: () => assert.fail('ambiguous date adopted') }, fetchSalesPage: async () => ({ orders }) });
    await reconcile.run();
    orders = [{ orderId: 'UNKNOWN1', orderDate: now + 100000, orderDateStrict: null, orderStatus: 'paid' }, { orderId: 'BOUNDARY', orderDateStrict: now - 1000, orderStatus: 'paid' }];
    now += 100000; await reconcile.run();
    for (const id of ['UNKNOWN1', 'BOUNDARY']) {
        const order = await journal.getAccountOrder('1', id);
        assert.notEqual(order.adopted, true); assert.equal(order.problemState, 'attention');
    }
});

test('offscreen parser shares creation and waits for every concurrent parser before closing', async () => {
    const { createOffscreenParser } = await load('offscreen_parser.js');
    let creates = 0, closes = 0;
    const pending = [];
    const parser = createOffscreenParser({ runtime: { getURL: x => x, getContexts: async () => [], sendMessage: () => new Promise(resolve => pending.push(resolve)) },
        offscreen: { createDocument: async () => { creates++; }, closeDocument: async () => { closes++; } } });
    const a = parser.parse('a', 'parseA'), b = parser.parse('b', 'parseB');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(creates, 1);
    pending[0]('A'); assert.equal(await a, 'A'); assert.equal(closes, 0);
    pending[1]('B'); assert.equal(await b, 'B'); assert.equal(closes, 1);
});

test('engine coalesces a signal during a pass and disabled automation clears its alarms', async () => {
    let enabled = true, cycles = 0, active = 0, maxActive = 0, release;
    const alarmMap = new Map();
    const ctx = vm.createContext({ Math, Date, Promise, chrome: { storage: { local: { get: async () => ({ fpToolsAutoReplies: { autoDeliveryEnabled: enabled } }) } },
        alarms: { get: async n => alarmMap.get(n), create: async (n, a) => alarmMap.set(n, a), clear: async n => alarmMap.delete(n) } },
        runAutoResponderCycle: async () => { active++; maxActive = Math.max(maxActive, active); cycles++; if (cycles === 1) await new Promise(r => { release = r; }); active--; } });
    vm.runInContext(read('background/fpt_engine.js').replace(/^import .*\r?\n/gm, '').replace(/^export /gm, ''), ctx);
    ctx.configureEngine({ runDue: async () => {} });
    const first = ctx.startEngine(); await new Promise(r => setImmediate(r));
    const second = ctx.runAutomationPass(); release(); await Promise.all([first, second]);
    assert.equal(maxActive, 1); assert.equal(cycles, 2);
    assert.equal(alarmMap.get('fpToolsEngineHeartbeat').periodInMinutes, 0.5);
    enabled = false; await ctx.startEngine(); assert.equal(alarmMap.size, 0);
});

test('catalog route validation rejects arbitrary parameters, userinfo and external redirects before another request', async () => {
    const { catalogUrl, fetchCatalogPage } = await load('catalog_fetch.js');
    assert.equal(catalogUrl('https://funpay.com/lots/123/', 'getLotList'), 'https://funpay.com/lots/123/');
    assert.equal(catalogUrl('/en/lots/123/', 'getLotList'), 'https://funpay.com/en/lots/123/');
    for (const url of ['https://evil.test/lots/123/', 'https://x@funpay.com/lots/123/', 'https://funpay.com/lots/123/?x=y', 'https://funpay.com/orders/trade', 'http://funpay.com/lots/123/']) assert.throws(() => catalogUrl(url, 'getLotList'));
    let calls = 0;
    await assert.rejects(fetchCatalogPage('https://funpay.com/lots/123/', 'getLotList', async () => { calls++; return { status: 302, headers: new Headers({ location: 'https://evil.test/lots/123/' }) }; }), /Неподдерживаемый/);
    assert.equal(calls, 1);
});

test('release migration changes only exact retired defaults, preserving sessions and custom assets', async () => {
    const { migrateRelease, OLD_DEFAULT_BACKGROUND } = await load('release_migrations.js');
    const data = { notificationSound: 'tg', fpToolsTheme: { bgImage: OLD_DEFAULT_BACKGROUND, bgColor1: '#123456' }, fpToolsCustomSoundData: 'custom bytes', fpToolsAccounts: [{ key: 'local' }] };
    const storage = { get: async () => structuredClone(data), set: async patch => Object.assign(data, patch) };
    await migrateRelease(storage, { clear: async () => {} });
    assert.equal(data.notificationSound, 'default'); assert.equal(data.fpToolsTheme.bgImage, null);
    assert.equal(data.fpToolsCustomSoundData, 'custom bytes'); assert.deepEqual(data.fpToolsAccounts, [{ key: 'local' }]);
    data.fpToolsTheme.bgImage = 'https://example.com/custom.png'; data.notificationSound = 'custom';
    assert.deepEqual(await migrateRelease(storage, { clear: async () => {} }), {});
});

test('a failure while preparing parts rolls back the entire attempt and its event', async () => {
    const { createOpsJournal, createMemoryBackend } = await load('ops_db.js');
    const journal = createOpsJournal({ backend: createMemoryBackend() });
    const opKey = 'delivery:1:ATOMIC01:g1', orderKey = '1:ATOMIC01';
    await assert.rejects(journal.beginAttempt({ opKey, orderKey, kind: 'delivery', parts: [
        { partId: opKey + '#0', opKey, orderKey, index: 0, text: 'A', state: 'pending' },
        { partId: opKey + '#1', opKey, orderKey: 'wrong', index: 1, text: 'B', state: 'pending' }
    ] }), /подготовленная часть/);
    assert.equal(await journal.getOp(opKey), null);
    assert.deepEqual(await journal.listParts(opKey), []);
    assert.deepEqual(await journal.listRecords('events'), []);
});

test('one continuation alarm keeps the earliest persisted deadline across concurrent orders', async () => {
    const { createJobScheduler } = await load('job_scheduler.js');
    const data = {}, created = [];
    const scheduler = createJobScheduler({ alarms: { create: async (_, options) => { created.push(options.when); }, clear: async () => {} },
        storage: { get: async key => ({ [key]: structuredClone(data[key]) }), set: async patch => Object.assign(data, patch) }, now: () => 1000 });
    scheduler.register('delivery', async () => {});
    await Promise.all([scheduler.scheduleDue('delivery', 90000, { earliest: true }), scheduler.scheduleDue('delivery', 30000, { earliest: true }), scheduler.scheduleDue('delivery', 60000, { earliest: true })]);
    assert.equal((await scheduler.getDeadlines()).delivery, 30000);
    assert.equal(created.at(-1), 30000);
});
