/*
 * FunPay Funcy — изменение лота из фона.
 *
 * patchLot читает текущую форму лота, сверяет её с ожиданием вызывающего (expect)
 * и только потом сохраняет. Если продавец успел вручную поменять цену или
 * активность между нашим чтением и записью, изменение отменяется (status: 'conflict'),
 * а не перетирает его правку. После сохранения форма перечитывается и
 * проверяется, что FunPay действительно принял изменённые поля.
 *
 * Модуль не знает про fetch и offscreen: чтение и сохранение формы передаются снаружи.
 */

const IGNORED_FIELDS = new Set(['csrf_token', 'location']);

export function isLotFormActive(form) {
    const value = form?.active;
    return value !== undefined && value !== null && value !== '' && value !== false && value !== '0';
}

function normalizePrice(value) {
    const number = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(number) ? number.toFixed(2) : String(value ?? '');
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
    return payload;
}

export function createLotWriter({ readForm, saveForm } = {}) {
    if (typeof readForm !== 'function' || typeof saveForm !== 'function') {
        throw new Error('Для изменения лота нужны readForm и saveForm.');
    }

    async function patchLot({ offerId, nodeId, mutate, expect = null, verify = true }) {
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
        const next = draft && typeof draft === 'object' ? draft : before;
        const changed = changedLotFields(before, next);
        if (!changed.length) return { status: 'unchanged', before };

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
