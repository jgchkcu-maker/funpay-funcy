/*
 * FunPay Funcy — автодемпер: правила лотов, проверка, фоновая работа и запись цены.
 *
 * Правило принадлежит одному предложению { accountId, kind, nodeId, offerId } и
 * создаётся выключенным. Включить его можно только после успешной проверки
 * именно этой конфигурации; любое изменение условий выключает работающее
 * правило до новой проверки. Копии правил на другие лоты тоже выключены.
 *
 * Проход: свежая форма своего лота → выдача раздела (одна на раздел за проход) →
 * строгий отбор → коэффициент калькулятора FunPay → решение. Перед записью
 * повторно сверяются аккаунт, ревизия правила, владелец управления ценой и
 * возраст снимка рынка (старше 60 секунд — перечитывается). Намерение записи
 * сохраняется до отправки: после обрыва сначала сверяется фактическая цена,
 * неизвестный результат вслепую не повторяется.
 *
 * Правило приостанавливается, если цену изменили не мы, если изменилась схема
 * раздела или характеристики своего лота, если FunPay не подтвердил запись или
 * цену начала вести другая автоматизация. Ошибка, защитная страница или отсутствие
 * авторизации — это ошибка прохода, а не пустой рынок. На 429 соблюдается Retry-After,
 * иначе пауза растёт от 5 до 60 минут.
 */

import { compareDecimal, formatDecimal, parseDecimal } from './money.js';
import {
    parseOfferRef, offerKey, normalizeMarket, selectCompetitors, schemaFingerprint, ownFingerprint,
    competitorFingerprint, needsCard, wordList, rowBuyerPrice
} from './dumper_market.js';
import {
    validateDumperRule, floorPrice, decide, coefficientFromCalc, matchesShown, placeRange, formatPlace, toBuyer,
    DEFAULT_LIMITS, DEFAULT_INTERVAL_MIN, MIN_INTERVAL_MIN
} from './dumper_price.js';

export const DUMPER_KEY = 'fpToolsDumper';
export const DUMPER_ALARM = 'fpToolsDumperRun';
const CHECK_TTL_MS = 15 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 60 * 1000;
const CARD_TTL_MS = 30 * 60 * 1000;
const CARD_BUDGET = 12;
const BACKOFF_MIN_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;
const EXCLUDED_SHOWN = 300;

const CONFIG_FIELDS = ['strategy', 'position', 'step', 'minPrice', 'cost', 'useCostBasis', 'minProfit', 'ceiling', 'quantum', 'allowRaise', 'intervalMin', 'limits', 'competitors'];

const PAUSE_TEXT = Object.freeze({
    'manual-edit': 'Цену изменили вне демпера — правило приостановлено.',
    'schema-changed': 'Изменилась схема параметров раздела — нужна новая проверка.',
    'own-changed': 'Изменились характеристики вашего лота — нужна новая проверка.',
    'rule-changed': 'Условия правила изменены — проверьте и включите заново.',
    'unverified': 'FunPay не подтвердил новую цену — правило приостановлено.',
    'conflict': 'Ценой этого лота управляет другое правило (наценка/маржа).',
    'unknown-result': 'Результат записи неизвестен — сверяем фактическую цену.',
    'moved': 'Лот перенесён в другой раздел — нужна новая проверка.'
});

export function defaultDumperRule(ref, title = null) {
    return {
        key: offerKey(ref), accountId: ref.accountId, kind: ref.kind, nodeId: ref.nodeId, offerId: ref.offerId,
        title: title ? String(title).slice(0, 200) : null,
        revision: 0, enabled: false, approvedHash: null, updatedAt: null,
        strategy: 'undercut', position: 1,
        step: { mode: 'amount', value: ref.kind === 'chips' ? '0.0001' : '1' },
        minPrice: '', cost: '', useCostBasis: false, minProfit: '', ceiling: '',
        quantum: ref.kind === 'chips' ? '' : '0.01',
        allowRaise: false,
        intervalMin: DEFAULT_INTERVAL_MIN,
        limits: { ...DEFAULT_LIMITS },
        competitors: {
            mode: 'schema', ignoreFields: [], selected: [], requiredWords: [], excludedWords: [],
            minRating: 0, onlineOnly: false, autoOnly: false, excludedSellers: [], onlySellers: false, sellers: []
        }
    };
}

function clean(value) {
    if (value === null || value === undefined) return '';
    const parsed = parseDecimal(String(value).trim(), { allowComma: true });
    return parsed ? formatDecimal(parsed) : String(value).trim();
}

function sellerList(list) {
    const out = new Map();
    for (const item of Array.isArray(list) ? list : []) {
        const id = String(item?.id ?? item ?? '').trim();
        if (/^\d+$/.test(id)) out.set(id, { id, name: item?.name ? String(item.name).slice(0, 60) : null });
    }
    return [...out.values()].slice(0, 200);
}

// Только известные поля правила; всё прочее из сообщения отбрасывается.
export function sanitizeRule(input, base) {
    const c = input?.competitors || {};
    return {
        ...base,
        strategy: input?.strategy === 'position' ? 'position' : 'undercut',
        position: input?.strategy === 'position' ? Math.trunc(Number(input?.position) || 0) : 1,
        step: { mode: input?.step?.mode === 'percent' ? 'percent' : 'amount', value: clean(input?.step?.value) },
        minPrice: clean(input?.minPrice), cost: clean(input?.cost), useCostBasis: Boolean(input?.useCostBasis),
        minProfit: clean(input?.minProfit), ceiling: clean(input?.ceiling), quantum: clean(input?.quantum),
        allowRaise: Boolean(input?.allowRaise),
        intervalMin: Number(input?.intervalMin) || DEFAULT_INTERVAL_MIN,
        limits: {
            writeIntervalMin: Number(input?.limits?.writeIntervalMin) || DEFAULT_LIMITS.writeIntervalMin,
            maxChangePercent: clean(input?.limits?.maxChangePercent || DEFAULT_LIMITS.maxChangePercent),
            maxHourlyDropPercent: clean(input?.limits?.maxHourlyDropPercent || DEFAULT_LIMITS.maxHourlyDropPercent)
        },
        competitors: {
            mode: c.mode === 'selected' ? 'selected' : 'schema',
            ignoreFields: [...new Set((Array.isArray(c.ignoreFields) ? c.ignoreFields : []).map(String).filter(Boolean))].slice(0, 30),
            selected: (Array.isArray(c.selected) ? c.selected : []).filter(item => item && String(item.offerId || '').length).slice(0, 100).map(item => ({
                offerId: String(item.offerId), sellerId: item.sellerId ? String(item.sellerId) : null,
                sellerName: item.sellerName ? String(item.sellerName).slice(0, 60) : null,
                title: item.title ? String(item.title).slice(0, 300) : null,
                fingerprint: item.fingerprint ? String(item.fingerprint) : null,
                confirmedAt: Number(item.confirmedAt) || null
            })),
            requiredWords: wordList(c.requiredWords), excludedWords: wordList(c.excludedWords),
            minRating: Math.min(5, Math.max(0, Math.trunc(Number(c.minRating) || 0))),
            onlineOnly: Boolean(c.onlineOnly), autoOnly: Boolean(c.autoOnly),
            excludedSellers: sellerList(c.excludedSellers), onlySellers: Boolean(c.onlySellers), sellers: sellerList(c.sellers)
        }
    };
}

export function configHash(rule) {
    return JSON.stringify(CONFIG_FIELDS.map(field => rule?.[field] ?? null));
}

// Общий выключатель — аварийный стоп для всех правил аккаунта. Сами правила
// создаются выключенными и включаются по одному после проверки.
function emptyAccount() {
    return { enabled: true, rules: {}, runtime: {}, backoff: null };
}

function rateLimitDelay(error, level) {
    const retry = Number(error?.retryAfterMs);
    if (Number.isFinite(retry) && retry > 0) return Math.min(Math.max(retry, 60 * 1000), 6 * BACKOFF_MAX_MS);
    return Math.min(BACKOFF_MIN_MS * 2 ** Math.max(0, level), BACKOFF_MAX_MS);
}

export function createDumperService({
    storage, guard, scheduler = null, history, market, own, calc, writers, priceOwner = null,
    costOf = null, now = () => Date.now(), log = console
} = {}) {
    if (!storage || !guard || !history || !market || !own || typeof calc !== 'function' || !writers) throw new Error('Автодемпер не настроен.');
    let chain = Promise.resolve();
    let pass = null;
    const cards = new Map();
    const checks = new Map();

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function readAll() {
        const { [DUMPER_KEY]: stored } = await storage.get(DUMPER_KEY);
        return stored && typeof stored === 'object' && stored.accounts ? stored : { accounts: {} };
    }

    function mutate(accountId, fn) {
        return serialize(async () => {
            const all = await readAll();
            const account = { ...emptyAccount(), ...(all.accounts[accountId] || {}) };
            const result = await fn(account);
            all.accounts[accountId] = account;
            await storage.set({ [DUMPER_KEY]: all });
            return result;
        });
    }

    async function readAccount(accountId) {
        const all = await readAll();
        return { ...emptyAccount(), ...(all.accounts[accountId] || {}) };
    }

    async function requireAccount() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw Object.assign(new Error('Аккаунт FunPay не определён.'), { code: 'auth' });
        return account;
    }

    function requireRef(account, input) {
        const ref = parseOfferRef({ ...input, accountId: account.accountId });
        if (!ref) throw Object.assign(new Error('Некорректное предложение.'), { code: 'invalid' });
        return ref;
    }

    function record(accountId, key, type, text, data = null) {
        return history.add({ accountId, key, type, text, data });
    }

    // --- Чтение рынка -------------------------------------------------------------------

    async function loadMarket(ref, cache) {
        const cacheKey = `${ref.kind}:${ref.nodeId}`;
        const cached = cache?.get(cacheKey);
        if (cached && now() - cached.at <= SNAPSHOT_MAX_AGE_MS) return cached;
        const raw = await market.fetchSection({ kind: ref.kind, nodeId: ref.nodeId });
        const snapshot = { ...normalizeMarket(raw, { kind: ref.kind, nodeId: ref.nodeId }), at: now() };
        cache?.set(cacheKey, snapshot);
        return snapshot;
    }

    async function loadCard(kind, offerId) {
        const cached = cards.get(offerId);
        if (cached && now() - cached.at < CARD_TTL_MS) return cached.value;
        let value;
        try {
            const raw = await market.fetchCard({ kind, offerId });
            value = raw?.ok ? raw : { error: raw?.error?.message || 'карточка не разобрана' };
        } catch (error) {
            if (error?.code === 'rate-limit') throw error;
            value = { error: error?.message || 'ошибка загрузки' };
        }
        cards.set(offerId, { at: now(), value });
        if (cards.size > 2000) cards.delete(cards.keys().next().value);
        return value;
    }

    async function readOwn(ref) {
        if (ref.kind === 'lots') {
            const lot = await own.readLot({ offerId: ref.offerId, nodeId: ref.nodeId });
            if (!lot?.ok) throw Object.assign(new Error(lot?.error?.message || 'Форма лота не прочитана.'), { code: lot?.error?.code || 'own' });
            return { kind: 'lots', offerId: ref.offerId, nodeId: String(lot.nodeId || ''), price: lot.price ? clean(lot.price) : null, title: lot.title, fields: lot.fields || {}, active: lot.active };
        }
        const chip = await own.readChip(ref);
        return { kind: 'chips', offerId: ref.offerId, nodeId: ref.nodeId, price: chip?.price ? clean(chip.price) : null, amount: chip?.amount ?? null, active: Boolean(chip?.active), server: ref.server, side: ref.side, fields: {} };
    }

    async function cost(rule, accountId) {
        if (rule.cost) return rule.cost;
        if (rule.useCostBasis && typeof costOf === 'function') {
            const basis = await costOf(accountId, rule.offerId);
            return basis?.amount || null;
        }
        return null;
    }

    // --- Оценка одного правила ------------------------------------------------------------

    async function evaluate(account, rule, { cache = new Map(), runtime = {} } = {}) {
        const ref = parseOfferRef(rule);
        const result = { at: now(), key: rule.key, configHash: configHash(rule), blockers: [], notes: [], incomplete: false };
        result.validation = validateDumperRule(rule, { kind: rule.kind });
        if (result.validation.length) result.blockers.push(...result.validation);

        const ownLot = await readOwn(ref);
        result.own = { price: ownLot.price, title: ownLot.title || rule.title, active: ownLot.active, fields: ownLot.fields, amount: ownLot.amount ?? null };
        if (ref.kind === 'lots' && ownLot.nodeId !== ref.nodeId) {
            result.blockers.push(`Лот находится в разделе ${ownLot.nodeId || '?'}, а правило — для раздела ${ref.nodeId}.`);
            result.moved = true;
        }
        result.ownHash = ownFingerprint({ ...ownLot, nodeId: ref.nodeId });

        const snapshot = await loadMarket(ref, cache);
        result.snapshotAt = snapshot.at;
        if (!snapshot.userId || snapshot.userId !== account.accountId) {
            throw Object.assign(new Error(snapshot.userId && snapshot.userId !== '0'
                ? 'Выдача открыта под другим аккаунтом FunPay.'
                : 'FunPay показал выдачу без авторизации — сравнение не выполняется.'), { code: 'auth' });
        }
        result.schemaHash = schemaFingerprint(snapshot.schema);
        result.market = { counter: snapshot.counter, rows: snapshot.rows.length, complete: snapshot.complete, priceHeader: snapshot.priceHeader, schema: snapshot.schema };

        const ownRow = snapshot.rows.find(row => row.offerId === ref.offerId) || null;
        result.ownRow = ownRow ? { price: ownRow.price, unit: ownRow.priceUnit } : null;

        let selection;
        const cardMap = new Map();
        const position = rule.strategy === 'position' ? Math.max(1, Number(rule.position) || 1) : 1;
        let budget = CARD_BUDGET;
        for (;;) {
            selection = selectCompetitors({ own: ownLot, market: snapshot, rule, accountId: account.accountId, cards: cardMap });
            if (!selection.pendingCards.length) break;
            const ref_ = selection.included[position - 1]?.row.price || null;
            // Карточки нужны только тем, кто может оказаться в первых N.
            const relevant = selection.pendingCards
                .filter(row => row.price && (!ref_ || compareDecimal(row.price, ref_) <= 0))
                .sort((a, b) => compareDecimal(a.price, b.price));
            if (!relevant.length) break;
            if (budget <= 0) { result.incomplete = true; result.notes.push('Не все нужные карточки конкурентов проверены за проход — место не подтверждено.'); break; }
            const batch = relevant.slice(0, Math.min(budget, 4));
            for (const row of batch) {
                cardMap.set(row.offerId, await loadCard(ref.kind, row.offerId));
                budget -= 1;
            }
        }
        result.blockers.push(...selection.blockers);

        // Одна валюта и одна единица: опорная — единица своей строки, иначе преобладающая.
        const units = new Map();
        for (const item of selection.included) units.set(item.row.priceUnit, (units.get(item.row.priceUnit) || 0) + 1);
        const unit = ownRow?.priceUnit || [...units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const sameUnit = [];
        for (const item of selection.included) {
            if (item.row.priceUnit !== unit) selection.excluded.push({ row: item.row, reasons: [`Другая валюта цены: ${item.row.priceUnit || '?'}`] });
            else sameUnit.push(item);
        }
        selection.included = sameUnit;
        result.currencyUnit = unit;

        if (!snapshot.complete) {
            const needAll = selection.mode === 'selected' && !selection.excluded.some(e => e.reasons.includes('Выбранное предложение не найдено в выдаче раздела'));
            if (!needAll) {
                result.incomplete = true;
                result.notes.push(snapshot.counter
                    ? `FunPay показал ${snapshot.rows.length} из ${snapshot.counter} предложений раздела — место не подтверждено.`
                    : 'Не удалось подтвердить, что выдача раздела получена полностью.');
            }
        }

        // Коэффициент калькулятора FunPay и сверка со своей строкой выдачи.
        result.conversion = { coefficient: null, verified: false, note: null };
        if (ownLot.price && unit) {
            try {
                const calcResult = coefficientFromCalc(await calc({ kind: ref.kind, nodeId: ref.nodeId, gameId: ref.gameId, price: ownLot.price }), { price: ownLot.price, currencySymbol: unit });
                if (!calcResult) {
                    result.conversion.note = `Калькулятор FunPay не вернул цену в валюте выдачи (${unit}).`;
                } else if (ownRow?.price) {
                    const displayQuantum = ref.kind === 'lots' && ownRow.priceData ? '0.0001' : '0.01';
                    if (matchesShown({ shown: ownRow.price, sellerPrice: ownLot.price, coefficient: calcResult.coefficient, displayQuantum })) {
                        result.conversion = { coefficient: calcResult.coefficient, verified: true, note: 'Комиссия сверена с вашей строкой в выдаче.' };
                    } else {
                        result.conversion.note = `Калькулятор даёт ${toBuyer(ownLot.price, calcResult.coefficient)}, а в выдаче ваша цена ${ownRow.price} — комиссия не подтверждена.`;
                    }
                } else if (ref.kind === 'lots') {
                    result.conversion = { coefficient: calcResult.coefficient, verified: true, note: 'Вашего лота нет в выдаче — комиссия взята из калькулятора FunPay.' };
                } else {
                    result.conversion.note = 'Вашего предложения нет в выдаче — комиссия и единица продажи валюты не подтверждены.';
                }
            } catch (error) {
                if (error?.code === 'rate-limit') throw error;
                result.conversion.note = `Калькулятор FunPay недоступен: ${error?.message || error}`;
            }
        } else if (!unit) {
            result.conversion.note = 'Валюта цен в выдаче не определена.';
        }

        const floorCost = await cost(rule, account.accountId);
        const floor = floorPrice({ minPrice: rule.minPrice || null, cost: floorCost, minProfit: rule.minProfit || null });
        result.floor = floor;
        const prices = selection.included.map(item => item.row.price);
        result.decision = decide({
            prices, currentPrice: ownLot.price, coefficient: result.conversion.verified ? result.conversion.coefficient : null,
            rule, floor, now: now(), history: historyFor(runtime)
        });
        if (!result.conversion.verified) result.blockers.push(result.conversion.note || 'Комиссия FunPay не подтверждена — запись запрещена.');
        if (result.incomplete && ['lower', 'raise', 'raise-pending'].includes(result.decision.action)) {
            result.decision = { ...result.decision, action: 'skip', reasons: [...result.decision.reasons, 'Выдача собрана не полностью — цена не меняется.'] };
        }
        if (result.blockers.length && result.decision.action !== 'skip') {
            result.decision = { ...result.decision, action: 'skip', reasons: [...result.blockers] };
        }

        const reasonCounts = {};
        for (const item of selection.excluded) for (const reason of item.reasons) reasonCounts[reason.split(':')[0]] = (reasonCounts[reason.split(':')[0]] || 0) + 1;
        const view = item => ({
            offerId: item.row.offerId, title: item.row.title, sellerId: item.row.sellerId || null, sellerName: item.row.sellerName,
            price: item.row.price || null, unit: item.row.priceUnit || null, rating: item.row.rating ?? null, online: item.row.online ?? null,
            auto: item.row.auto ?? null, fields: item.row.fields || {}, server: item.row.serverName || null, side: item.row.sideName || null,
            reasons: item.reasons, fingerprint: item.row.fields ? competitorFingerprint(item.row) : null
        });
        const includedView = selection.included.map(item => ({ ...view(item), place: placeRange(prices, item.row.price) }));
        const excludedSorted = selection.excluded
            .slice()
            .sort((a, b) => (a.row.price && b.row.price ? compareDecimal(a.row.price, b.row.price) : a.row.price ? -1 : 1));
        result.selection = {
            mode: selection.mode, fields: selection.fields, included: includedView,
            excluded: excludedSorted.slice(0, EXCLUDED_SHOWN).map(view), excludedTotal: excludedSorted.length, reasonCounts
        };
        result.ok = !result.blockers.length;
        return result;
    }

    // Пределы и подтверждения из состояния правила.
    function historyFor(rt) {
        const hour = now() - 60 * 60 * 1000;
        const writes = (rt.writes || []).filter(w => w.at >= hour);
        return {
            lastWriteAt: rt.lastWrite?.at || null,
            hourAgoPrice: writes.length ? writes.reduce((first, w) => (w.at < first.at ? w : first)).from : null,
            raiseConfirm: rt.raiseConfirm || null
        };
    }

    function summary(result) {
        const d = result.decision || {};
        return {
            at: result.at, configHash: result.configHash, ok: result.ok, action: d.action, reasons: d.reasons || [],
            blockers: result.blockers, notes: result.notes, incomplete: result.incomplete,
            price: result.own?.price ?? null, target: d.target ?? null, reference: d.reference ?? null,
            place: d.currentPlace ? formatPlace(d.currentPlace) : null, targetPlace: d.targetPlace ? formatPlace(d.targetPlace) : null,
            competitors: result.selection?.included.length ?? 0, excluded: result.selection?.excludedTotal ?? 0,
            coefficient: result.conversion?.verified ? result.conversion.coefficient : null, conversionNote: result.conversion?.note || null,
            floor: result.floor, schemaHash: result.schemaHash, ownHash: result.ownHash
        };
    }

    // --- Команды --------------------------------------------------------------------------

    async function list() {
        const account = await requireAccount();
        const state = await readAccount(account.accountId);
        return {
            accountId: account.accountId, enabled: state.enabled, backoff: state.backoff,
            rules: Object.values(state.rules).map(rule => ({ ...rule, runtime: state.runtime[rule.key] || {} }))
        };
    }

    async function get(input) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const state = await readAccount(account.accountId);
        const key = offerKey(ref);
        const rule = state.rules[key] || defaultDumperRule(ref, input.title);
        return { rule, runtime: state.runtime[key] || {}, accountEnabled: state.enabled, lastCheck: checks.get(key)?.result || null };
    }

    async function save({ ref: input, rule: draft, expectedRevision = null }) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const key = offerKey(ref);
        return mutate(account.accountId, async state => {
            const current = state.rules[key];
            if (current && expectedRevision !== null && current.revision !== expectedRevision) {
                throw Object.assign(new Error('Правило изменилось в другом окне — откройте его заново.'), { code: 'conflict' });
            }
            const base = current || defaultDumperRule(ref, input.title);
            const next = sanitizeRule(draft, base);
            const errors = validateDumperRule(next, { kind: ref.kind });
            if (errors.length) throw Object.assign(new Error(errors.join(' ')), { code: 'invalid', errors });
            const changed = !current || configHash(current) !== configHash(next);
            next.title = input.title ? String(input.title).slice(0, 200) : base.title;
            next.revision = (current?.revision || 0) + (changed || !current ? 1 : 0);
            next.updatedAt = now();
            if (current?.enabled && changed) {
                next.enabled = false;
                next.approvedHash = null;
                state.runtime[key] = { ...(state.runtime[key] || {}), status: 'paused', pauseReason: 'rule-changed', pausedAt: now() };
                await record(account.accountId, key, 'pause', PAUSE_TEXT['rule-changed']);
            }
            state.rules[key] = next;
            return next;
        });
    }

    async function check({ ref: input, rule: draft = null }) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const key = offerKey(ref);
        const state = await readAccount(account.accountId);
        const stored = state.rules[key] || defaultDumperRule(ref, input.title);
        const rule = draft ? sanitizeRule(draft, stored) : stored;
        let result;
        try {
            result = await evaluate(account, rule, { runtime: state.runtime[key] || {} });
        } catch (error) {
            await noteFailure(account.accountId, key, error);
            throw error;
        }
        result.ruleRevision = stored.revision;
        checks.set(key, { at: now(), accountId: account.accountId, epoch: account.epoch, result });
        for (const [id, item] of checks) if (now() - item.at > CHECK_TTL_MS) checks.delete(id);
        await record(account.accountId, key, 'observation', `Проверка: ${result.selection.included.length} подходящих, ${result.selection.excludedTotal} исключено.`, summary(result));
        await mutate(account.accountId, s => {
            s.runtime[key] = { ...(s.runtime[key] || {}), lastCheck: summary(result), lastObservedPrice: result.own.price, lastCheckAt: now() };
        });
        return result;
    }

    async function enable({ ref: input, expectedRevision = null }) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const key = offerKey(ref);
        const checked = checks.get(key);
        return mutate(account.accountId, async state => {
            const rule = state.rules[key];
            if (!rule) throw Object.assign(new Error('Сначала сохраните настройки лота.'), { code: 'invalid' });
            if (expectedRevision !== null && rule.revision !== expectedRevision) throw Object.assign(new Error('Правило изменилось — проверьте заново.'), { code: 'conflict' });
            if (!checked || now() - checked.at > CHECK_TTL_MS || checked.accountId !== account.accountId || checked.epoch !== account.epoch) {
                throw Object.assign(new Error('Нужна свежая проверка (не старше 15 минут).'), { code: 'check-required' });
            }
            const result = checked.result;
            const pausedAt = state.runtime[key]?.pausedAt || state.runtime[key]?.disabledAt || 0;
            if (checked.at < pausedAt) throw Object.assign(new Error('После паузы нужна новая проверка.'), { code: 'check-required' });
            if (result.configHash !== configHash(rule)) throw Object.assign(new Error('Проверка выполнялась для других настроек — сохраните и проверьте заново.'), { code: 'check-required' });
            if (!result.ok) throw Object.assign(new Error(`Проверка не пройдена: ${result.blockers[0] || 'есть ошибки'}`), { code: 'check-failed' });
            const owner = typeof priceOwner === 'function' ? await priceOwner(account.accountId, rule) : null;
            if (owner) throw Object.assign(new Error(`${PAUSE_TEXT.conflict} ${owner}`), { code: 'conflict' });
            rule.enabled = true;
            rule.approvedHash = configHash(rule);
            state.runtime[key] = {
                ...(state.runtime[key] || {}), status: 'active', pauseReason: null, pausedAt: null, intent: null, raiseConfirm: null,
                baseline: { schemaHash: result.schemaHash, ownHash: result.ownHash }, expectedPrice: result.own.price,
                nextCheckAt: now() + 60 * 1000, errors: 0, lastError: null
            };
            await record(account.accountId, key, 'resume', 'Автоматизация включена после проверки.', summary(result));
            return rule;
        }).then(async rule => { await reschedule(account.accountId); return rule; });
    }

    async function disable({ ref: input }) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const key = offerKey(ref);
        const rule = await mutate(account.accountId, async state => {
            const rule = state.rules[key];
            if (!rule) return null;
            rule.enabled = false;
            rule.approvedHash = null;
            state.runtime[key] = { ...(state.runtime[key] || {}), status: 'off', pauseReason: null, disabledAt: now() };
            await record(account.accountId, key, 'pause', 'Автоматизация выключена вручную.');
            return rule;
        });
        await reschedule(account.accountId);
        return rule;
    }

    async function setGlobal({ enabled }) {
        const account = await requireAccount();
        await mutate(account.accountId, async state => {
            state.enabled = Boolean(enabled);
            await record(account.accountId, null, enabled ? 'resume' : 'pause', enabled ? 'Автодемпер включён.' : 'Автодемпер остановлен: все правила аккаунта не выполняются.');
        });
        await reschedule(account.accountId);
        return { enabled: Boolean(enabled) };
    }

    async function remove({ ref: input }) {
        const account = await requireAccount();
        const ref = requireRef(account, input);
        const key = offerKey(ref);
        await mutate(account.accountId, state => { delete state.rules[key]; delete state.runtime[key]; });
        checks.delete(key);
        await reschedule(account.accountId);
        return true;
    }

    // Копия настроек на другие лоты: новые правила выключены и требуют своей проверки.
    async function copy({ from: input, to: targets }) {
        const account = await requireAccount();
        const source = requireRef(account, input);
        const state = await readAccount(account.accountId);
        const rule = state.rules[offerKey(source)];
        if (!rule) throw Object.assign(new Error('Сначала сохраните настройки исходного лота.'), { code: 'invalid' });
        const created = [];
        await mutate(account.accountId, async next => {
            for (const target of Array.isArray(targets) ? targets : []) {
                const ref = parseOfferRef({ ...target, accountId: account.accountId });
                if (!ref || offerKey(ref) === rule.key || ref.kind !== source.kind) continue;
                const key = offerKey(ref);
                const base = next.rules[key] || defaultDumperRule(ref, target.title);
                const copyRule = sanitizeRule(rule, base);
                // Выбранные предложения относятся к разделу исходного лота.
                if (ref.nodeId !== source.nodeId) copyRule.competitors.selected = [];
                copyRule.enabled = false;
                copyRule.approvedHash = null;
                copyRule.revision = (next.rules[key]?.revision || 0) + 1;
                copyRule.updatedAt = now();
                copyRule.title = target.title ? String(target.title).slice(0, 200) : base.title;
                next.rules[key] = copyRule;
                next.runtime[key] = { ...(next.runtime[key] || {}), status: 'off', pauseReason: null };
                created.push(key);
                await record(account.accountId, key, 'decision', `Настройки скопированы с лота ${source.offerId}; правило выключено до проверки.`);
            }
        });
        return { created };
    }

    async function getHistory({ ref: input = null, limit = 200 }) {
        const account = await requireAccount();
        const key = input ? offerKey(requireRef(account, input)) : null;
        return history.list({ accountId: account.accountId, key, limit });
    }

    // --- Фоновый проход -------------------------------------------------------------------

    async function noteFailure(accountId, key, error) {
        if (error?.code === 'rate-limit') {
            await mutate(accountId, async state => {
                const level = state.backoff?.level || 0;
                const delay = rateLimitDelay(error, level);
                state.backoff = { until: now() + delay, level: level + 1, reason: error.message || 'HTTP 429' };
                await record(accountId, key, 'error', `FunPay ограничил частоту запросов. Пауза ${Math.round(delay / 60000)} мин.`);
            });
            return;
        }
        if (!key) return;
        await mutate(accountId, async state => {
            const rt = state.runtime[key] || {};
            state.runtime[key] = { ...rt, lastError: { at: now(), message: error?.message || String(error), code: error?.code || null }, errors: (rt.errors || 0) + 1 };
        });
        await record(accountId, key, 'error', error?.message || String(error), { code: error?.code || null });
    }

    async function pauseRule(accountId, key, reason, extra = {}) {
        await mutate(accountId, async state => {
            state.runtime[key] = { ...(state.runtime[key] || {}), status: 'paused', pauseReason: reason, pausedAt: now(), ...extra };
            if (state.rules[key]) { state.rules[key].enabled = false; state.rules[key].approvedHash = null; }
        });
        await record(accountId, key, 'pause', PAUSE_TEXT[reason] || reason, extra);
    }

    // Сверка незавершённой записи по фактической цене.
    async function reconcileIntent(account, rule, rt) {
        const intent = rt.intent;
        let current;
        try {
            current = (await readOwn(parseOfferRef(rule))).price;
        } catch (error) {
            await record(account.accountId, rule.key, 'error', `Результат записи ${intent.from} → ${intent.to} пока неизвестен: ${error?.message || error}`);
            return false;
        }
        if (current && compareDecimal(current, intent.to) === 0) {
            await mutate(account.accountId, s => {
                const r = s.runtime[rule.key] || {};
                s.runtime[rule.key] = { ...r, intent: null, expectedPrice: current, lastWrite: { at: intent.at, from: intent.from, to: intent.to }, writes: [...(r.writes || []), { at: intent.at, from: intent.from, to: intent.to }].slice(-50) };
            });
            await record(account.accountId, rule.key, 'write', `Цена ${intent.from} → ${intent.to} подтверждена после перезапуска.`, intent);
            return true;
        }
        if (current && compareDecimal(current, intent.from) === 0) {
            await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), intent: null }; });
            await record(account.accountId, rule.key, 'error', `Запись ${intent.from} → ${intent.to} не применилась; цена прежняя.`, intent);
            return true;
        }
        await pauseRule(account.accountId, rule.key, 'manual-edit', { observedPrice: current, intent });
        return false;
    }

    async function writePrice(account, rule, result) {
        const ref = parseOfferRef(rule);
        const from = result.own.price;
        const to = result.decision.target;
        const intent = { id: `w${now().toString(36)}`, from, to, at: now(), reference: result.decision.reference };
        await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), intent }; });
        await record(account.accountId, rule.key, 'intent', `Намерение: ${from} → ${to}.`, intent);
        let outcome;
        try {
            // Непосредственно перед POST: аккаунт и ревизия правила.
            await guard.assertCurrent(account);
            const fresh = (await readAccount(account.accountId)).rules[rule.key];
            if (!fresh?.enabled || fresh.revision !== rule.revision || fresh.approvedHash !== configHash(fresh)) {
                throw Object.assign(new Error('Правило изменилось перед записью.'), { code: 'rule-changed' });
            }
            outcome = ref.kind === 'lots'
                ? await writers.lots.enqueue({ offerId: ref.offerId, nodeId: ref.nodeId, source: 'dumper', expectedAccountId: account.accountId, op: { type: 'setPrice', price: to, expect: { price: from } } })
                : await writers.chips.write({ offerId: ref.offerId, expectedAccountId: account.accountId, op: { type: 'setPrice', price: to, expect: { price: from } } });
        } catch (error) {
            if (['account-changed', 'rule-changed'].includes(error?.code)) {
                // До отправки — записи не было.
                await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), intent: null }; });
                await record(account.accountId, rule.key, 'error', `Запись отменена: ${error.message}`);
                return { status: 'cancelled' };
            }
            await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), intent: { ...intent, status: 'unknown' } }; });
            await record(account.accountId, rule.key, 'error', `Результат записи неизвестен: ${error?.message || error}. Повтор только после сверки цены.`);
            return { status: 'unknown' };
        }
        const saved = outcome?.status === 'saved' && (outcome.price === undefined || outcome.price === null || compareDecimal(clean(outcome.price), to) === 0);
        if (saved) {
            await mutate(account.accountId, s => {
                const r = s.runtime[rule.key] || {};
                s.runtime[rule.key] = { ...r, intent: null, expectedPrice: to, raiseConfirm: null, lastWrite: { at: now(), from, to }, writes: [...(r.writes || []), { at: now(), from, to }].slice(-50) };
            });
            await record(account.accountId, rule.key, 'write', `Цена ${from} → ${to} подтверждена FunPay.`, { from, to, reference: result.decision.reference, place: result.decision.targetPlace ? formatPlace(result.decision.targetPlace) : null });
            return { status: 'saved' };
        }
        await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), intent: null }; });
        if (outcome?.status === 'conflict') { await pauseRule(account.accountId, rule.key, 'manual-edit', { observedPrice: outcome.conflicts?.[0]?.actual ?? null }); return { status: 'conflict' }; }
        await pauseRule(account.accountId, rule.key, 'unverified', { outcome: outcome?.status || null });
        return { status: outcome?.status || 'unverified' };
    }

    async function runRule(account, rule, rt, cache) {
        if (rt.intent) {
            const settled = await reconcileIntent(account, rule, rt);
            if (!settled) return { key: rule.key, status: 'intent-pending' };
            rt = (await readAccount(account.accountId)).runtime[rule.key] || {};
            if (rt.status === 'paused') return { key: rule.key, status: 'paused' };
        }
        const intervalMs = Math.max(MIN_INTERVAL_MIN, Number(rule.intervalMin) || DEFAULT_INTERVAL_MIN) * 60000;
        if (rt.lastCheckAt && now() - rt.lastCheckAt > intervalMs * 3 + 2 * 60000) {
            await record(account.accountId, rule.key, 'gap', `Пробел наблюдения: ${new Date(rt.lastCheckAt).toLocaleString('ru-RU')} — ${new Date(now()).toLocaleString('ru-RU')} (браузер был закрыт или FunPay недоступен).`, { from: rt.lastCheckAt, to: now() });
        }
        let result = await evaluate(account, rule, { cache, runtime: rt });
        await mutate(account.accountId, s => {
            s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), lastCheck: summary(result), lastCheckAt: now(), lastObservedPrice: result.own.price, nextCheckAt: now() + intervalMs, errors: 0, lastError: null };
        });

        if (result.moved) { await pauseRule(account.accountId, rule.key, 'moved'); return { key: rule.key, status: 'paused' }; }
        if (rt.baseline?.schemaHash && result.schemaHash !== rt.baseline.schemaHash) { await pauseRule(account.accountId, rule.key, 'schema-changed'); return { key: rule.key, status: 'paused' }; }
        if (rt.baseline?.ownHash && result.ownHash !== rt.baseline.ownHash) { await pauseRule(account.accountId, rule.key, 'own-changed'); return { key: rule.key, status: 'paused' }; }
        if (rt.expectedPrice && result.own.price && compareDecimal(rt.expectedPrice, result.own.price) !== 0) {
            await pauseRule(account.accountId, rule.key, 'manual-edit', { observedPrice: result.own.price, expectedPrice: rt.expectedPrice });
            return { key: rule.key, status: 'paused' };
        }
        const owner = typeof priceOwner === 'function' ? await priceOwner(account.accountId, rule) : null;
        if (owner) { await pauseRule(account.accountId, rule.key, 'conflict', { owner }); return { key: rule.key, status: 'paused' }; }

        const action = result.decision.action;
        await record(account.accountId, rule.key, 'decision', result.decision.reasons.join(' ') || action, summary(result));
        if (action === 'raise-pending') {
            await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), raiseConfirm: result.decision.raiseConfirm }; });
            return { key: rule.key, status: action };
        }
        if (rt.raiseConfirm) await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), raiseConfirm: null }; });
        if (!['lower', 'raise'].includes(action)) return { key: rule.key, status: action };

        // Снимок рынка старше 60 секунд перед записью — перечитываем и решаем заново.
        if (now() - result.snapshotAt > SNAPSHOT_MAX_AGE_MS) {
            cache.delete(`${rule.kind}:${rule.nodeId}`);
            result = await evaluate(account, rule, { cache, runtime: rt });
            if (!['lower', 'raise'].includes(result.decision.action)) return { key: rule.key, status: result.decision.action };
        }
        // Калькулятор подтверждает, что итоговая цена покупателя дешевле опорного конкурента.
        if (result.decision.reference) {
            const ref = parseOfferRef(rule);
            const check = coefficientFromCalc(await calc({ kind: ref.kind, nodeId: ref.nodeId, gameId: ref.gameId, price: result.decision.target }), { price: result.decision.target, currencySymbol: result.currencyUnit });
            if (!check || compareDecimal(check.buyerAtBase, result.decision.reference) >= 0) {
                await record(account.accountId, rule.key, 'decision', `Калькулятор FunPay не подтвердил, что цена ${result.decision.target} дешевле ${result.decision.reference} — запись пропущена.`);
                return { key: rule.key, status: 'skip' };
            }
        }
        const written = await writePrice(account, rule, result);
        return { key: rule.key, status: written.status };
    }

    async function reschedule(accountId) {
        if (!scheduler) return;
        const state = await readAccount(accountId);
        const due = state.enabled
            ? Object.values(state.rules).filter(rule => rule.enabled).map(rule => state.runtime[rule.key]?.nextCheckAt || now() + 60000)
            : [];
        if (!due.length) { await scheduler.clearDue(DUMPER_ALARM).catch(() => {}); return; }
        let when = Math.max(Math.min(...due), now() + 30000);
        if (state.backoff?.until > when) when = state.backoff.until;
        await scheduler.scheduleDue(DUMPER_ALARM, when);
    }

    function run() {
        if (pass) return pass;
        pass = (async () => {
            const account = await guard.current({ fresh: true });
            if (!account.accountId) return { skipped: 'account' };
            const state = await readAccount(account.accountId);
            if (!state.enabled) { await reschedule(account.accountId); return { skipped: 'disabled' }; }
            if (state.backoff?.until > now()) { await reschedule(account.accountId); return { skipped: 'backoff', until: state.backoff.until }; }
            const cache = new Map();
            const results = [];
            const due = Object.values(state.rules)
                .filter(rule => rule.enabled && rule.approvedHash === configHash(rule))
                .filter(rule => { const rt = state.runtime[rule.key] || {}; return rt.status !== 'paused' && (!rt.nextCheckAt || rt.nextCheckAt <= now() + 5000 || rt.intent); })
                // Правила одного раздела подряд: выдача читается один раз.
                .sort((a, b) => `${a.kind}:${a.nodeId}`.localeCompare(`${b.kind}:${b.nodeId}`));
            let anyFetched = false;
            for (const rule of due) {
                if ((await readAccount(account.accountId)).enabled !== true) break;
                const rt = (await readAccount(account.accountId)).runtime[rule.key] || {};
                try {
                    results.push(await runRule(account, rule, rt, cache));
                    anyFetched = true;
                } catch (error) {
                    await noteFailure(account.accountId, rule.key, error);
                    const intervalMs = Math.max(MIN_INTERVAL_MIN, Number(rule.intervalMin) || DEFAULT_INTERVAL_MIN) * 60000;
                    await mutate(account.accountId, s => { s.runtime[rule.key] = { ...(s.runtime[rule.key] || {}), nextCheckAt: now() + intervalMs, lastCheckAt: now() }; });
                    results.push({ key: rule.key, status: 'error', error: error?.message || String(error) });
                    if (error?.code === 'rate-limit' || error?.code === 'account-changed') break;
                }
            }
            if (anyFetched) await mutate(account.accountId, s => { if (s.backoff && !(s.backoff.until > now())) s.backoff = null; });
            await reschedule(account.accountId);
            return { results };
        })().finally(() => { pass = null; });
        return pass;
    }

    // После перезапуска: незавершённые намерения сверяются до любого нового решения.
    async function recover() {
        const account = await guard.current();
        if (!account.accountId) return { skipped: 'account' };
        const state = await readAccount(account.accountId);
        const pending = Object.values(state.rules).filter(rule => state.runtime[rule.key]?.intent);
        for (const rule of pending) await reconcileIntent(account, rule, state.runtime[rule.key]).catch(() => {});
        await reschedule(account.accountId);
        return { reconciled: pending.length };
    }

    // Лот ведёт демпер — другая автоматизация цены его не трогает.
    async function owns(accountId, offerId) {
        const state = await readAccount(String(accountId));
        return Object.values(state.rules).some(rule => rule.enabled && rule.kind === 'lots' && rule.offerId === String(offerId));
    }

    return Object.freeze({ list, get, save, check, enable, resume: enable, disable, setGlobal, remove, copy, history: getHistory, run, recover, owns, reschedule });
}

export { rowBuyerPrice, needsCard };
