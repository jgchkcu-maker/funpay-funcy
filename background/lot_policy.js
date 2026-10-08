/*
 * FunPay Funcy — одно решение об активности лота.
 *
 * Активность лота определяется ручным намерением продавца и блокировками модулей:
 *   schedule  — лот вне окна расписания;
 *   price     — нет безопасной цены (потолок ниже минимальной);
 *   config    — неполная настройка.
 * Каждый модуль ставит и снимает только свою блокировку. Ручное «Не включать
 * автоматически» (manualIntent = 'off') автоматизация не снимает; ручное «Включён»
 * не обходит блокировки безопасности.
 *
 * Включать лот автоматизация может только если выключение принадлежит ей:
 * лот выключили мы (disabledBy) или продавец явно разрешил включение
 * (adoptInactive). Лот, уже выключенный при подключении по неизвестной причине,
 * остаётся выключенным.
 * По булевому active нельзя увидеть ручное выключение уже выключенного лота —
 * для этого и есть явная команда «Не включать автоматически».
 */

export const LOT_POLICIES_KEY = 'fpToolsLotPolicies';
export const BLOCKER_OWNERS = Object.freeze(['schedule', 'price', 'config']);
export const MANUAL_INTENTS = Object.freeze(['auto', 'on', 'off']);

export function policyKey(accountId, offerId) {
    return `${accountId}:${offerId}`;
}

export function emptyPolicy(accountId, offerId, nodeId = null) {
    return {
        accountId: String(accountId), offerId: String(offerId), nodeId: nodeId ? String(nodeId) : null,
        revision: 0, manageActive: false, manualIntent: 'auto', blockers: {}, disabledBy: [],
        adoptInactive: false, inactiveEvidence: null, lastApplied: null, paused: null
    };
}

export function activeBlockers(policy) {
    return Object.entries(policy?.blockers || {}).filter(([owner, blocker]) => BLOCKER_OWNERS.includes(owner) && blocker).map(([owner]) => owner);
}

// Решение по свежему состоянию формы: 'activate' | 'deactivate' | причина бездействия.
export function decideLotActivity(policy, currentActive) {
    if (!policy?.manageActive) return 'not-managed';
    if (policy.paused) return 'paused';
    const blockers = activeBlockers(policy);
    const wantActive = policy.manualIntent !== 'off' && blockers.length === 0;
    if (!wantActive) return currentActive ? 'deactivate' : 'already-inactive';
    if (currentActive) return 'already-active';
    const owned = policy.disabledBy?.length > 0 || policy.adoptInactive === true;
    // 'unknown' — лот был выключен не нами: включает только продавец.
    return owned ? 'activate' : 'not-owned';
}

// Учёт результата применения: кто владеет выключением и какое состояние мы оставили.
export function afterApply(policy, { decision, observedActive, status, now }) {
    const next = { ...policy, lastApplied: { decision, status, at: now } };
    if (status !== 'saved') return next;
    next.lastWrite = { decision, observedActive, at: now };
    if (decision === 'deactivate') next.disabledBy = activeBlockers(policy).length ? activeBlockers(policy) : ['manual-intent'];
    if (decision === 'activate') { next.disabledBy = []; next.inactiveEvidence = null; }
    return next;
}

// Наблюдение свежей формы до решения. Если лот теперь не в том состоянии, в котором
// мы его оставили, его изменил продавец — управление приостанавливается до
// подтверждения.
export function observeExternalChange(policy, { currentActive, now }) {
    const next = { ...policy };
    const last = policy.lastWrite;
    if (!policy.paused && last && typeof last.observedActive === 'boolean' && last.observedActive !== currentActive) {
        next.paused = { reason: 'external-change', observedActive: currentActive, at: now };
        next.disabledBy = [];
        next.inactiveEvidence = null;
        return next;
    }
    // Первое наблюдение выключенного лота: выключили не мы.
    if (!currentActive && !policy.disabledBy?.length && !policy.inactiveEvidence) next.inactiveEvidence = 'unknown';
    if (currentActive && policy.inactiveEvidence) next.inactiveEvidence = null;
    return next;
}

// Прежний проход по складу ставил блокировку stock и считал выключение «нашим».
// Его больше нет: старые следы не должны ни держать лот выключенным, ни давать
// право включить его, когда склад пуст.
export function withoutRetiredStockState(policy) {
    const stockOwned = Boolean(policy.disabledBy?.includes('stock')) || policy.inactiveEvidence === 'stock-empty';
    if (!policy.blockers?.stock && !stockOwned) return policy;
    const { stock, ...blockers } = policy.blockers || {};
    const disabledBy = (policy.disabledBy || []).filter(owner => owner !== 'stock');
    let inactiveEvidence = policy.inactiveEvidence === 'stock-empty' ? null : policy.inactiveEvidence;
    if (stockOwned && !disabledBy.length) inactiveEvidence = 'unknown';
    return { ...policy, blockers, disabledBy, inactiveEvidence };
}

// storage — chrome.storage.local-подобный. Все изменения сериализованы.
export function createLotPolicyStore({ storage, now = () => Date.now() } = {}) {
    if (!storage) throw new Error('Хранилище политик лотов не задано.');
    let chain = Promise.resolve();

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function readAll() {
        const { [LOT_POLICIES_KEY]: stored } = await storage.get(LOT_POLICIES_KEY);
        if (!stored || typeof stored !== 'object') return {};
        return Object.fromEntries(Object.entries(stored).map(([key, policy]) => [key, withoutRetiredStockState(policy)]));
    }

    function update(accountId, offerId, mutate, { nodeId = null, expectedRevision = null } = {}) {
        return serialize(async () => {
            const all = await readAll();
            const key = policyKey(accountId, offerId);
            const current = all[key] || emptyPolicy(accountId, offerId, nodeId);
            if (expectedRevision !== null && current.revision !== expectedRevision) {
                throw Object.assign(new Error('Настройки лота изменились — обновите страницу.'), { code: 'conflict' });
            }
            const patched = mutate(structuredClone(current));
            if (patched === undefined) return current;
            const next = { ...patched, accountId: current.accountId, offerId: current.offerId, nodeId: patched.nodeId || nodeId || current.nodeId, revision: current.revision + 1, updatedAt: now() };
            await storage.set({ [LOT_POLICIES_KEY]: { ...all, [key]: next } });
            return next;
        });
    }

    // Модуль меняет только свою блокировку.
    function setBlocker(accountId, offerId, owner, blocked, { reason = null, nodeId = null } = {}) {
        if (!BLOCKER_OWNERS.includes(owner)) throw new Error(`Неизвестная причина блокировки: ${owner}`);
        return update(accountId, offerId, policy => {
            const current = policy.blockers?.[owner] || null;
            if (Boolean(current) === Boolean(blocked) && (!blocked || current.reason === reason)) return undefined;
            const blockers = { ...(policy.blockers || {}) };
            if (blocked) blockers[owner] = { reason, at: now() };
            else delete blockers[owner];
            return { ...policy, blockers };
        }, { nodeId });
    }

    async function get(accountId, offerId) {
        return (await readAll())[policyKey(accountId, offerId)] || null;
    }

    async function list(accountId) {
        return Object.values(await readAll()).filter(policy => !accountId || policy.accountId === String(accountId));
    }

    return Object.freeze({ update, setBlocker, get, list });
}

// v2: повторный проход для тех, у кого v1 уже прошёл, — команды управления
// («Не включать автоматически» и т. п.) убраны из интерфейса.
export const STOCK_MANAGEMENT_RELEASED_KEY = 'fpToolsStockManagementReleasedV2';

// Прежний проход по складу сам помечал лоты «под управлением». Один раз снимаем
// эту пометку и ручную команду с лотов, которые не привязаны ни к расписанию,
// ни к ценам: иначе строка лота хранила бы управление, которого нет, а снять
// команду из интерфейса уже нельзя. bindingKeys — ключи хранилищ с привязками `аккаунт:лот`.
export async function releaseStockManagedLots({ storage, policies, bindingKeys = [] }) {
    const saved = await storage.get([STOCK_MANAGEMENT_RELEASED_KEY, ...bindingKeys]);
    if (saved[STOCK_MANAGEMENT_RELEASED_KEY]) return 0;
    const bound = new Set();
    for (const key of bindingKeys) {
        for (const [binding, value] of Object.entries(saved[key]?.bindings || {})) {
            if (value?.ruleId) bound.add(binding);
        }
    }
    let released = 0;
    for (const policy of await policies.list()) {
        if ((!policy.manageActive && policy.manualIntent === 'auto') || bound.has(policyKey(policy.accountId, policy.offerId))) continue;
        await policies.update(policy.accountId, policy.offerId, current => ({ ...current, manageActive: false, manualIntent: 'auto' }));
        released++;
    }
    await storage.set({ [STOCK_MANAGEMENT_RELEASED_KEY]: true });
    return released;
}
