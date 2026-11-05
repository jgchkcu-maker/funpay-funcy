const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(path.join(__dirname, '../background', file)).href);

const SCHEMA = { present: true, fields: [{ id: 'type', conditions: [] }, { id: 'time', conditions: [] }] };
const OWN_FIELDS = { type: { value: 'individual', label: 'Individual' }, time: { value: '1 месяц', label: '1 месяц' } };
const REF = { kind: 'lots', nodeId: '1217', offerId: '500', title: 'Spotify Individual' };
const RULE = { strategy: 'undercut', step: { mode: 'amount', value: '1' }, minPrice: '50', quantum: '0.01', intervalMin: 5,
    limits: { writeIntervalMin: 5, maxChangePercent: '50', maxHourlyDropPercent: '50' } };

function memoryStorage() {
    const data = {};
    return { data, get: async key => (key in data ? { [key]: structuredClone(data[key]) } : {}), set: async patch => { Object.assign(data, structuredClone(patch)); } };
}

function lotRow(offerId, price, extra = {}) {
    return { offerId, sellerId: `9${offerId}`, sellerName: `s${offerId}`, online: true, auto: true, rating: 5, title: `Spotify ${offerId}`,
        priceData: price, priceText: price, priceUnit: '₽', fields: { type: 'individual', time: '1 месяц' }, ...extra };
}

async function harness({ competitors = ['115'], own = {}, marketExtra = {} } = {}) {
    const { createDumperService } = await load('dumper_service.js');
    const { createDumperHistory, createMemoryHistoryBackend } = await load('dumper_history.js');
    const { multiplyForTest } = { multiplyForTest: null };
    const clock = { t: 1_000_000 };
    const state = {
        account: { accountId: '100', epoch: 1 },
        ownPrice: '100', ownFields: OWN_FIELDS, ownNode: '1217',
        competitors, marketExtra, sections: 0, cards: 0, writes: [], calcs: 0,
        writeImpl: null, calcHook: null, priceOwner: null, sectionError: null
    };
    const backend = createMemoryHistoryBackend();
    const scheduled = [];
    const guard = {
        current: async () => ({ ...state.account }),
        assertCurrent: async expected => {
            if (expected.accountId !== state.account.accountId || expected.epoch !== state.account.epoch) throw Object.assign(new Error('Аккаунт FunPay сменился'), { code: 'account-changed' });
            return state.account;
        }
    };
    const toBuyer = price => (Math.round(Number(price) * 1.15 * 10000) / 10000).toString();
    const service = createDumperService({
        storage: memoryStorage(), guard,
        scheduler: { scheduleDue: async (name, when) => { scheduled.push({ name, when }); }, clearDue: async name => { scheduled.push({ name, cleared: true }); } },
        history: createDumperHistory({ backend, now: () => clock.t }),
        market: {
            fetchSection: async () => {
                state.sections += 1;
                if (state.sectionError) throw state.sectionError;
                const rows = [...state.competitors.map((price, i) => lotRow(String(i + 1), price)), lotRow('500', toBuyer(state.ownPrice), { sellerId: '100' })];
                return { ok: true, kind: 'lots', lang: 'ru', userId: state.account.accountId, nodeId: '1217', counter: rows.length, schema: SCHEMA, emptyShown: false, rows, ...state.marketExtra };
            },
            fetchCard: async () => { state.cards += 1; return { ok: true, nodeId: '1217', params: [] }; }
        },
        own: {
            readLot: async () => ({ ok: true, nodeId: state.ownNode, price: state.ownPrice, fields: state.ownFields, title: 'Spotify', ...own }),
            readChip: async () => { throw new Error('not chips'); }
        },
        calc: async ({ price }) => {
            state.calcs += 1;
            state.calcHook?.();
            return { methods: [{ price: toBuyer(price), unit: '₽' }, { price: '1', unit: '$' }] };
        },
        writers: {
            lots: { enqueue: async request => {
                state.writes.push(request);
                if (state.writeImpl) return state.writeImpl(request);
                if (request.op.expect.price !== state.ownPrice) return { status: 'conflict', conflicts: [{ field: 'price', actual: state.ownPrice }] };
                state.ownPrice = request.op.price;
                return { status: 'saved', price: request.op.price };
            } },
            chips: { write: async () => { throw new Error('not chips'); } }
        },
        priceOwner: async () => state.priceOwner,
        now: () => clock.t,
        log: { warn() {}, error() {} }
    });
    async function arm(rule = RULE) {
        await service.save({ ref: REF, rule });
        const result = await service.check({ ref: REF });
        await service.enable({ ref: REF });
        return result;
    }
    const advance = minutes => { clock.t += minutes * 60000; };
    return { service, state, clock, backend, scheduled, arm, advance };
}

test('check explains the selection and enabling requires a fresh successful check of the saved rule', async () => {
    const h = await harness({ competitors: ['115', '120'] });
    await h.service.save({ ref: REF, rule: RULE });
    await assert.rejects(h.service.enable({ ref: REF }), err => err.code === 'check-required');
    const result = await h.service.check({ ref: REF });
    assert.equal(result.ok, true, result.blockers.join());
    assert.equal(result.conversion.verified, true, 'commission cross-checked with own row');
    assert.equal(result.decision.action, 'lower');
    assert.equal(result.decision.target, '99.13');
    assert.deepEqual(result.selection.included.map(i => i.offerId), ['1', '2']);
    assert.equal(result.selection.excluded[0].reasons[0], 'Собственное предложение');
    assert.equal(h.state.writes.length, 0, 'check never writes');
    await h.service.check({ ref: REF, rule: { ...RULE, minPrice: '60' } });
    await assert.rejects(h.service.enable({ ref: REF }), /других настроек/);
    await h.service.check({ ref: REF });
    h.advance(16);
    await assert.rejects(h.service.enable({ ref: REF }), /свежая проверка/);
});

test('an enabled rule lowers the price through the lot queue with the expected price and records it', async () => {
    const h = await harness();
    await h.arm();
    h.advance(2);
    const pass = await h.service.run();
    assert.equal(pass.results[0].status, 'saved');
    assert.equal(h.state.writes.length, 1);
    assert.deepEqual(h.state.writes[0].op, { type: 'setPrice', price: '99.13', expect: { price: '100' } });
    assert.equal(h.state.writes[0].source, 'dumper');
    const types = h.backend.rows.map(r => r.type);
    assert.ok(types.includes('intent') && types.includes('write'));
    const { rules } = await h.service.list();
    assert.equal(rules[0].runtime.intent, null);
    assert.equal(rules[0].runtime.expectedPrice, '99.13');
    h.advance(2);
    const again = await h.service.run();
    assert.deepEqual(again.results, [], 'not due again before the interval');
});

test('an external price edit pauses the rule instead of fighting it', async () => {
    const h = await harness();
    await h.arm();
    h.state.ownPrice = '120';
    h.advance(2);
    const pass = await h.service.run();
    assert.equal(pass.results[0].status, 'paused');
    assert.equal(h.state.writes.length, 0);
    const { rules } = await h.service.list();
    assert.equal(rules[0].enabled, false);
    assert.equal(rules[0].runtime.pauseReason, 'manual-edit');
    await assert.rejects(h.service.resume({ ref: REF }), /новая проверка/, 'resuming needs a check made after the pause');
    h.advance(1);
    await h.service.check({ ref: REF });
    await h.service.resume({ ref: REF });
    assert.equal((await h.service.list()).rules[0].runtime.expectedPrice, '120');
});

test('one price manager per offer: an active markup rule blocks enabling and pauses a running dumper', async () => {
    const h = await harness();
    await h.service.save({ ref: REF, rule: RULE });
    await h.service.check({ ref: REF });
    h.state.priceOwner = 'Правило «Наценка» с автопересчётом.';
    await assert.rejects(h.service.enable({ ref: REF }), err => err.code === 'conflict');
    h.state.priceOwner = null;
    await h.service.enable({ ref: REF });
    assert.equal(await h.service.owns('100', '500'), true);
    h.state.priceOwner = 'Правило «Наценка» с автопересчётом.';
    h.advance(2);
    await h.service.run();
    assert.equal((await h.service.list()).rules[0].runtime.pauseReason, 'conflict');
    assert.equal(h.state.writes.length, 0);
});

test('changing a running rule turns it off until a new check and enable', async () => {
    const h = await harness();
    await h.arm();
    const saved = await h.service.save({ ref: REF, rule: { ...RULE, minPrice: '70' } });
    assert.equal(saved.enabled, false);
    assert.equal((await h.service.list()).rules[0].runtime.pauseReason, 'rule-changed');
    const same = await h.service.save({ ref: REF, rule: { ...RULE, minPrice: '70' } });
    assert.equal(same.revision, saved.revision, 'saving identical settings keeps the revision');
});

test('account switch before the POST cancels the write', async () => {
    const h = await harness();
    await h.arm();
    h.state.calcHook = () => { if (h.state.calcs >= 3) h.state.account = { accountId: '100', epoch: 2 }; };
    h.advance(2);
    const pass = await h.service.run();
    assert.equal(pass.results[0].status, 'cancelled');
    assert.equal(h.state.writes.length, 0);
    assert.equal((await h.service.list()).rules[0].runtime.intent, null);
});

test('an interrupted write is reconciled from the real price and never retried blindly', async () => {
    const h = await harness();
    await h.arm();
    h.state.writeImpl = request => { h.state.ownPrice = request.op.price; throw new Error('Failed to fetch'); };
    h.advance(2);
    assert.equal((await h.service.run()).results[0].status, 'unknown');
    assert.equal((await h.service.list()).rules[0].runtime.intent.status, 'unknown');
    h.state.writeImpl = null;
    h.advance(6);
    await h.service.run();
    assert.equal(h.state.writes.length, 1, 'the unknown write is not repeated');
    const runtime = (await h.service.list()).rules[0].runtime;
    assert.equal(runtime.intent, null);
    assert.equal(runtime.expectedPrice, '99.13');
    assert.ok(h.backend.rows.some(r => r.type === 'write' && /подтверждена после перезапуска/.test(r.text)));
});

test('recover() settles a write that did not reach FunPay and keeps the old price', async () => {
    const h = await harness();
    await h.arm();
    h.state.writeImpl = () => { throw new Error('Service worker stopped'); };
    h.advance(2);
    await h.service.run();
    await h.service.recover();
    const runtime = (await h.service.list()).rules[0].runtime;
    assert.equal(runtime.intent, null);
    assert.equal(h.state.ownPrice, '100');
    assert.ok(h.backend.rows.some(r => /не применилась/.test(r.text)));
});

test('an unconfirmed save pauses the rule', async () => {
    const h = await harness();
    await h.arm();
    h.state.writeImpl = () => ({ status: 'unverified', notApplied: ['price'] });
    h.advance(2);
    await h.service.run();
    assert.equal((await h.service.list()).rules[0].runtime.pauseReason, 'unverified');
});

test('429 honours Retry-After; errors and guest pages are errors, not an empty market', async () => {
    const h = await harness();
    await h.arm();
    h.state.sectionError = Object.assign(new Error('FunPay ограничил частоту запросов'), { code: 'rate-limit', retryAfterMs: 20 * 60000 });
    h.advance(2);
    await h.service.run();
    const list = await h.service.list();
    assert.ok(list.backoff.until >= h.clock.t + 19 * 60000);
    h.state.sectionError = null;
    h.advance(5);
    assert.equal((await h.service.run()).skipped, 'backoff');
    assert.equal(h.state.writes.length, 0);
    h.advance(20);
    h.state.marketExtra = { userId: '0' };
    await h.service.run();
    const runtime = (await h.service.list()).rules[0].runtime;
    assert.match(runtime.lastError.message, /без авторизации/);
    assert.equal(h.state.writes.length, 0);
});

test('without Retry-After the pause grows from 5 to 60 minutes', async () => {
    const h = await harness();
    await h.arm();
    const delays = [];
    for (let i = 0; i < 6; i += 1) {
        h.state.sectionError = Object.assign(new Error('429'), { code: 'rate-limit' });
        h.advance(61);
        await h.service.run();
        const { backoff } = await h.service.list();
        delays.push(Math.round((backoff.until - h.clock.t) / 60000));
    }
    assert.deepEqual(delays, [5, 10, 20, 40, 60, 60]);
});

test('a snapshot older than 60 seconds is re-read before writing', async () => {
    const h = await harness();
    await h.arm();
    h.advance(2);
    const before = h.state.sections;
    h.state.calcHook = () => { h.clock.t += 61000; };
    await h.service.run();
    assert.equal(h.state.sections - before, 2);
});

test('schema or own-lot changes pause the rule; the general stop halts everything', async () => {
    const h = await harness();
    await h.arm();
    h.state.ownFields = { ...OWN_FIELDS, time: { value: '12 месяцев', label: '12 месяцев' } };
    h.advance(2);
    await h.service.run();
    assert.equal((await h.service.list()).rules[0].runtime.pauseReason, 'own-changed');

    const g = await harness();
    await g.arm();
    await g.service.setGlobal({ enabled: false });
    g.advance(2);
    assert.equal((await g.service.run()).skipped, 'disabled');
    await g.service.setGlobal({ enabled: true });
    g.advance(1);
    assert.equal((await g.service.run()).results.length, 1);
});

test('copies are created disabled and need their own check', async () => {
    const h = await harness();
    await h.arm();
    const { created } = await h.service.copy({ from: REF, to: [{ kind: 'lots', nodeId: '1217', offerId: '501', title: 'Копия' }, { kind: 'chips', offerId: '100-1-2-3' }] });
    assert.deepEqual(created, ['100:lots:1217:501']);
    const copy = (await h.service.list()).rules.find(r => r.offerId === '501');
    assert.equal(copy.enabled, false);
    assert.equal(copy.minPrice, '50');
});

test('incomplete listings never confirm a place and never write', async () => {
    const h = await harness({ marketExtra: { counter: 99 } });
    await h.service.save({ ref: REF, rule: RULE });
    const result = await h.service.check({ ref: REF });
    assert.equal(result.incomplete, true);
    assert.equal(result.decision.action, 'skip');
    assert.match(result.notes.join(), /из 99/);
});

test('chip writer checks the expected price, re-reads the row and keeps neighbouring rows', async () => {
    const { createChipWriter } = await load('chip_writer.js');
    let form = [['csrf_token', 't'], ['offers[191][11][amount]', '5000'], ['offers[191][11][price]', '0.55'], ['offers[191][11][active]', 'on'],
        ['offers[191][12][amount]', '10'], ['offers[191][12][price]', '0.61']];
    const saves = [];
    const writer = createChipWriter({
        guard: { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => {} },
        readTrade: async () => form.map(pair => [...pair]),
        saveTrade: async fields => { saves.push(fields); form = fields; }
    });
    const [a, b] = await Promise.all([
        writer.write({ offerId: '100-24-26-191-11', op: { type: 'setPrice', price: '0.5487', expect: { price: '0.55' } } }),
        writer.write({ offerId: '100-24-26-191-12', op: { type: 'setPrice', price: '0.6', expect: { price: '0.61' } } })
    ]);
    assert.equal(a.status, 'saved');
    assert.equal(b.status, 'saved');
    const sent = new Map(form);
    assert.equal(sent.get('offers[191][11][price]'), '0.5487', 'precision kept');
    assert.equal(sent.get('offers[191][12][price]'), '0.6', 'second row written on the fresh form, first row kept');
    assert.equal(sent.get('offers[191][11][amount]'), '5000');
    const conflict = await writer.write({ offerId: '100-24-26-191-11', op: { type: 'setPrice', price: '0.5', expect: { price: '0.55' } } });
    assert.equal(conflict.status, 'conflict');
    assert.equal(saves.length, 2);
    const lying = createChipWriter({
        guard: { current: async () => ({ accountId: '100', epoch: 1 }), assertCurrent: async () => {} },
        readTrade: async () => [['offers[1][1][price]', '1']], saveTrade: async () => {}
    });
    assert.equal((await lying.write({ offerId: '100-2-3-1-1', op: { type: 'setPrice', price: '0.9', expect: { price: '1' } } })).status, 'unverified');
});

test('history is capped per account by age and count', async () => {
    const { createDumperHistory, createMemoryHistoryBackend, HISTORY_MAX_AGE_MS } = await load('dumper_history.js');
    const backend = createMemoryHistoryBackend();
    let t = 10 * HISTORY_MAX_AGE_MS;
    const historyStore = createDumperHistory({ backend, now: () => t });
    await backend.add({ accountId: '1', at: t - HISTORY_MAX_AGE_MS - 1, type: 'observation' });
    await backend.add({ accountId: '2', at: t - HISTORY_MAX_AGE_MS - 1, type: 'observation' });
    await historyStore.add({ accountId: '1', type: 'write', text: 'x' });
    assert.equal(backend.rows.filter(r => r.accountId === '1').length, 1);
    assert.equal(backend.rows.filter(r => r.accountId === '2').length, 1, 'other accounts untouched');
    await backend.prune({ accountId: '1', olderThan: 0, maxCount: 0 });
    assert.equal(backend.rows.filter(r => r.accountId === '1').length, 0);
});
