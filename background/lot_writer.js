/*
 * FunPay Funcy — изменение существующего лота из фона.
 *
 * patchLot читает текущую форму лота, сверяет её с ожиданием вызывающего (expect)
 * и только потом сохраняет. Если продавец успел вручную поменять цену или
 * активность между нашим чтением и записью, изменение отменяется (status: 'conflict'),
 * а не перетирает его правку. После сохранения форма перечитывается и
 * проверяется, что FunPay действительно принял изменённые поля.
 *
 * createLotWriteQueue сериализует все изменения одного лота (аккаунт + offerId):
 * вызывающие передают намерение (включить, поставить цену, изменить поля, удалить),
 * а свежая полная форма читается уже внутри очереди. Удалённый лот получает
 * терминальную отметку — следующие изменения из очереди к нему не применяются.
 *
 * expect и перечитывание снижают риск гонки с ручной правкой на сайте, но не
 * являются серверной проверкой версии: FunPay такой не предоставляет.
 *
 * Модуль не знает про fetch и offscreen: чтение и сохранение формы передаются снаружи.
 */

import { parseDecimal, compareDecimal, formatDecimal, addDecimal, subDecimal, mulDecimal, divDecimal, roundToQuantum } from './money.js';

const IGNORED_FIELDS = new Set(['csrf_token', 'location']);

export function isLotFormActive(form) {
    const value = form?.active;
    return value !== undefined && value !== null && value !== '' && value !== false && value !== '0';
}

// Цены сравниваются точно: 0.003 и 0.004 — разные цены, '120' и '120.00' — одна.
function normalizePrice(value) {
    const parsed = parseDecimal(value, { allowComma: true });
    return parsed ? formatDecimal(parsed) : String(value ?? '');
}

function normalizeField(field, value) {
    if (field === 'active') return isLotFormActive({ active: value }) ? 'on' : '';
    if (field === 'price') return normalizePrice(value);
    if (value === undefined || value === null) return '';
    return String(value);
}

export function lotFieldsEqual(field, left, right) {
    return normalizeField(field, left) === normalizeField(field, right);
}

export function changedLotFields(before, after) {
    const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return [...fields].filter(field => !IGNORED_FIELDS.has(field)
        && !lotFieldsEqual(field, before?.[field], after?.[field]));
}

// expect: { price: '120', active: true, ... } — значения, которые вызывающий видел раньше.
export function findLotConflicts(form, expect) {
    if (!expect) return [];
    return Object.entries(expect)
        .filter(([field, expected]) => {
            const actual = field === 'active' ? isLotFormActive(form) : form?.[field];
            const wanted = field === 'active' ? Boolean(expected) : expected;
            return field === 'active' ? actual !== wanted : !lotFieldsEqual(field, actual, wanted);
        })
        .map(([field, expected]) => ({
            field,
            expected,
            actual: field === 'active' ? isLotFormActive(form) : form?.[field]
        }));
}

// FunPay считает лот активным по наличию поля active, поэтому выключенный лот
// отправляется вовсе без него.
export function toOfferSavePayload(form, offerId) {
    const payload = { ...form, offer_id: String(offerId) };
    if (!isLotFormActive(payload)) delete payload.active;
    delete payload.location;
    delete payload.deleted;
    return payload;
}

// Новая цена из текущей по правилу массового изменения. Все вычисления точные;
// результат округляется до quantum (по умолчанию 0.01).
export function computeAdjustedPrice(current, { mode, value, round = false, min = null, max = null, quantum = '0.01' }) {
    const base = parseDecimal(current, { allowComma: true });
    const delta = parseDecimal(value, { allowComma: true });
    if (!base || !delta) return null;
    let next;
    if (mode === 'add') next = addDecimal(base, delta);
    else if (mode === 'sub') next = subDecimal(base, delta);
    else if (mode === 'set') next = formatDecimal(delta);
    else if (mode === 'percent_up') next = mulDecimal(base, addDecimal('1', divDecimal(delta, '100', { quantum: '0.0000001' })));
    else if (mode === 'percent_down') next = mulDecimal(base, subDecimal('1', divDecimal(delta, '100', { quantum: '0.0000001' })));
    else return null;
    next = roundToQuantum(next, round ? '1' : quantum, round ? 'ceil' : 'half-up');
    if (min !== null && parseDecimal(min, { allowComma: true }) && compareDecimal(next, parseDecimal(min, { allowComma: true })) < 0) next = formatDecimal(parseDecimal(min, { allowComma: true }));
    if (max !== null && parseDecimal(max, { allowComma: true }) && compareDecimal(next, parseDecimal(max, { allowComma: true })) > 0) next = formatDecimal(parseDecimal(max, { allowComma: true }));
    return compareDecimal(next, '0') > 0 ? next : null;
}

export function createLotWriter({ readForm, saveForm } = {}) {
    if (typeof readForm !== 'function' || typeof saveForm !== 'function') {
        throw new Error('Для изменения лота нужны readForm и saveForm.');
    }

    async function patchLot({ offerId, nodeId, mutate, expect = null, verify = true, beforeSave = null }) {
        const id = String(offerId || '').trim();
        if (!/^\d+$/.test(id)) throw new Error('Некорректный ID лота.');
        if (typeof mutate !== 'function') throw new Error('Не задано изменение лота.');
        const lot = { id, nodeId: String(nodeId || '') };

        const before = await readForm(lot);
        if (!before || typeof before !== 'object' || !Object.keys(before).length) {
            throw new Error('Не удалось прочитать форму лота.');
        }
        const conflicts = findLotConflicts(before, expect);
        if (conflicts.length) return { status: 'conflict', conflicts, before };

        const draft = mutate({ ...before });
        if (draft && draft.__skip) return { status: 'skipped', reason: draft.reason || null, before };
        const next = draft && typeof draft === 'object' ? draft : before;
        const changed = changedLotFields(before, next);
        if (!changed.length) return { status: 'unchanged', before };

        if (typeof beforeSave === 'function') await beforeSave({ before, next, changed });
        await saveForm(toOfferSavePayload(next, id), lot);
        if (!verify) return { status: 'saved', changed, before };

        const after = await readForm(lot);
        const notApplied = changed.filter(field => !lotFieldsEqual(field, after?.[field], next[field]));
        if (notApplied.length) return { status: 'unverified', changed, notApplied, before, after };
        return { status: 'saved', changed, before, after };
    }

    function setLotActive({ offerId, nodeId, active, expectActive }) {
        return patchLot({
            offerId,
            nodeId,
            expect: typeof expectActive === 'boolean' ? { active: expectActive } : null,
            mutate: form => {
                if (active) form.active = 'on';
                else delete form.active;
                return form;
            }
        });
    }

    return Object.freeze({ patchLot, setLotActive });
}

export const DELETED_OFFERS_KEY = 'fpToolsDeletedOffers';

// writer — createLotWriter; deleteOffer(offerId) — POST удаления; guard — account_guard;
// storage — для терминальных отметок удалённых лотов.
export function createLotWriteQueue({ writer, deleteOffer, guard, storage = null, now = () => Date.now(), log = console } = {}) {
    if (!writer || typeof deleteOffer !== 'function' || !guard) throw new Error('Очередь записи лотов не настроена.');
    const chains = new Map();
    const deleted = new Map();
    let deletedLoaded = null;

    function loadDeleted() {
        if (!storage) return Promise.resolve();
        if (!deletedLoaded) {
            deletedLoaded = Promise.resolve(storage.get(DELETED_OFFERS_KEY)).then(result => {
                const map = result?.[DELETED_OFFERS_KEY] || {};
                for (const [key, at] of Object.entries(map)) deleted.set(key, at);
            }).catch(() => {});
        }
        return deletedLoaded;
    }

    async function markDeleted(key) {
        deleted.set(key, now());
        if (!storage) return;
        const { [DELETED_OFFERS_KEY]: map = {} } = await storage.get(DELETED_OFFERS_KEY);
        const next = { ...map, [key]: now() };
        // Отметки старше 90 дней не нужны: ID лотов FunPay не переиспользует.
        for (const [k, at] of Object.entries(next)) if (now() - at > 90 * 86400000) delete next[k];
        await storage.set({ [DELETED_OFFERS_KEY]: next });
    }

    function mutationFor(op) {
        switch (op.type) {
            case 'setActive':
                return form => {
                    if (op.active) form.active = 'on';
                    else delete form.active;
                    return form;
                };
            case 'setPrice': {
                const price = parseDecimal(op.price, { allowComma: true });
                if (!price || compareDecimal(price, '0') <= 0) throw new Error('Некорректная цена.');
                return form => { form.price = formatDecimal(price); return form; };
            }
            case 'adjustPrice':
                return form => {
                    const next = computeAdjustedPrice(form.price, op);
                    if (!next) throw new Error('Не удалось вычислить новую цену.');
                    form.price = next;
                    return form;
                };
            case 'setFields':
                if (!op.fields || typeof op.fields !== 'object') throw new Error('Не заданы поля лота.');
                return form => {
                    for (const [field, value] of Object.entries(op.fields)) {
                        if (['offer_id', 'node_id', 'csrf_token', 'deleted', 'location'].includes(field)) continue;
                        if (field === 'active') {
                            if (isLotFormActive({ active: value })) form.active = 'on';
                            else delete form.active;
                        } else {
                            form[field] = value === null || value === undefined ? '' : String(value);
                        }
                    }
                    return form;
                };
            case 'policy':
                // Решение принимает вызывающий по свежей форме (resolver активности).
                if (typeof op.decide !== 'function') throw new Error('Не задано решение.');
                return form => {
                    const decision = op.decide(form);
                    if (decision === 'activate') form.active = 'on';
                    else if (decision === 'deactivate') delete form.active;
                    else return { __skip: true, reason: decision || 'no-change' };
                    return form;
                };
            default:
                throw new Error(`Неизвестная операция с лотом: ${op.type}`);
        }
    }

    async function execute(key, account, { offerId, nodeId, op }) {
        await loadDeleted();
        if (deleted.has(key)) return { status: 'deleted', offerId };
        await guard.assertCurrent(account);
        if (op.type === 'delete') {
            await deleteOffer(offerId);
            await markDeleted(key);
            return { status: 'deleted-now', offerId };
        }
        if (!/^\d+$/.test(String(nodeId || ''))) throw new Error('Не указана категория лота (node).');
        const result = await writer.patchLot({
            offerId, nodeId,
            expect: op.expect || null,
            mutate: mutationFor(op),
            // Непосредственно перед POST ещё раз сверяем аккаунт и терминальную отметку.
            beforeSave: async () => {
                if (deleted.has(key)) throw Object.assign(new Error('Лот удалён.'), { code: 'deleted' });
                await guard.assertCurrent(account);
            }
        });
        return { ...result, offerId, price: result.after?.price ?? null, active: result.after ? isLotFormActive(result.after) : null };
    }

    // op: { type: 'setActive'|'setPrice'|'adjustPrice'|'setFields'|'policy'|'delete', ... }
    // expectedAccountId — аккаунт, от имени которого действует вызывающий (страница FunPay).
    async function enqueue({ offerId, nodeId, op, expectedAccountId = null, source = 'unknown' }) {
        const id = String(offerId || '').trim();
        if (!/^\d+$/.test(id) || id === '0') throw new Error('Очередь меняет только существующие лоты.');
        if (!op?.type) throw new Error('Не задана операция с лотом.');
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        if (expectedAccountId && String(expectedAccountId) !== account.accountId) {
            throw Object.assign(new Error('Страница открыта под другим аккаунтом FunPay — обновите её.'), { code: 'account-changed' });
        }
        const key = `${account.accountId}:${id}`;
        const previous = chains.get(key) || Promise.resolve();
        const run = previous.catch(() => {}).then(() => execute(key, account, { offerId: id, nodeId, op }));
        const tail = run.catch(error => { log.warn?.(`FunPay Funcy: изменение лота ${id} (${source}) не выполнено:`, error?.message || error); });
        chains.set(key, tail);
        tail.finally(() => { if (chains.get(key) === tail) chains.delete(key); });
        return run;
    }

    async function isDeleted(accountId, offerId) {
        await loadDeleted();
        return deleted.has(`${accountId}:${offerId}`);
    }

    return Object.freeze({ enqueue, isDeleted });
}
