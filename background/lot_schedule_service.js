/*
 * FunPay Funcy — расписания лотов: хранение правил, привязок и применение.
 *
 * Правило принадлежит аккаунту, имеет ревизию и выключено, пока продавец явно его
 * не включит (opt-in). Привязка лота к правилу хранит nodeId. При каждом пробуждении
 * (alarm, запуск worker, изменение правил) сервис вычисляет состояние «сейчас»,
 * ставит или снимает только блокировку schedule и просит единый сервис
 * активности применить решение — не больше одного изменения на лот. Пропущенные
 * за время сна переходы не проигрываются. Срок следующей проверки сохраняется,
 * затем ставится один alarm на ближайший срок всех правил.
 *
 * Расписание ограничивает новые продажи (публикацию лота), но не отменяет уже
 * оплаченные заказы: их исполнение идёт отдельно.
 */

import { validateScheduleRule, isScheduleOpen, nextScheduleCheck, scheduleTransitions, isValidTimeZone } from './lot_schedule_rules.js';
import { decideLotActivity } from './lot_policy.js';

export const LOT_SCHEDULES_KEY = 'fpToolsLotSchedules';
export const LOT_SCHEDULES_ALARM = 'fpToolsLotSchedules';
const MAX_RULES = 20;

function emptyState() {
    return { rules: {}, bindings: {}, status: {} };
}

export function createLotScheduleService({ storage, guard, policies, activity, scheduler, now = () => Date.now(), log = console } = {}) {
    if (!storage || !guard || !policies || !activity) throw new Error('Сервис расписаний не настроен.');
    let chain = Promise.resolve();
    let running = null;

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function read() {
        const { [LOT_SCHEDULES_KEY]: stored } = await storage.get(LOT_SCHEDULES_KEY);
        return stored && typeof stored === 'object' ? { ...emptyState(), ...stored } : emptyState();
    }

    async function write(state) {
        await storage.set({ [LOT_SCHEDULES_KEY]: state });
        await storage.set({ fpToolsLotSchedulesEnabled: Object.values(state.rules).some(rule => rule.enabled) });
    }

    async function requireAccount() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        return account;
    }

    function mutate(fn) {
        return serialize(async () => {
            const state = await read();
            const result = await fn(state);
            await write(state);
            return result;
        });
    }

    async function saveRule({ rule, expectedRevision = null }) {
        const account = await requireAccount();
        const errors = validateScheduleRule(rule);
        if (errors.length) throw Object.assign(new Error(errors.join(' ')), { code: 'invalid' });
        const saved = await mutate(state => {
            const ruleId = rule.ruleId || `r${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const current = state.rules[ruleId];
            if (current && current.accountId !== account.accountId) throw new Error('Правило принадлежит другому аккаунту.');
            if (current && expectedRevision !== null && current.revision !== expectedRevision) {
                throw Object.assign(new Error('Правило изменилось — обновите страницу.'), { code: 'conflict' });
            }
            if (!current && Object.values(state.rules).filter(item => item.accountId === account.accountId).length >= MAX_RULES) {
                throw new Error(`Можно создать не больше ${MAX_RULES} правил.`);
            }
            state.rules[ruleId] = {
                ruleId,
                schemaVersion: 1,
                accountId: account.accountId,
                name: String(rule.name || 'Расписание').slice(0, 60),
                timezone: rule.timezone,
                windows: rule.windows.map(window => ({ day: window.day, start: window.start, end: window.end })),
                // Сохранение черновика не включает управление.
                enabled: current ? current.enabled : false,
                revision: (current?.revision || 0) + 1,
                updatedAt: now()
            };
            return state.rules[ruleId];
        });
        if (saved.enabled) await evaluate();
        return saved;
    }

    async function setRuleEnabled({ ruleId, enabled, expectedRevision = null }) {
        const account = await requireAccount();
        await mutate(state => {
            const rule = state.rules[ruleId];
            if (!rule || rule.accountId !== account.accountId) throw new Error('Правило не найдено.');
            if (expectedRevision !== null && rule.revision !== expectedRevision) throw Object.assign(new Error('Правило изменилось — обновите страницу.'), { code: 'conflict' });
            state.rules[ruleId] = { ...rule, enabled: Boolean(enabled), revision: rule.revision + 1, updatedAt: now() };
        });
        return evaluate();
    }

    async function deleteRule({ ruleId }) {
        const account = await requireAccount();
        await mutate(state => {
            const rule = state.rules[ruleId];
            if (!rule || rule.accountId !== account.accountId) throw new Error('Правило не найдено.');
            delete state.rules[ruleId];
            for (const [key, binding] of Object.entries(state.bindings)) if (binding.ruleId === ruleId) binding.ruleId = null;
        });
        return evaluate();
    }

    async function bindLots({ ruleId, lots }) {
        const account = await requireAccount();
        if (!Array.isArray(lots) || !lots.length) throw new Error('Выберите лоты.');
        await mutate(state => {
            if (ruleId && state.rules[ruleId]?.accountId !== account.accountId) throw new Error('Правило не найдено.');
            for (const lot of lots) {
                const offerId = String(lot.offerId || lot.id || '');
                if (!/^\d+$/.test(offerId)) continue;
                state.bindings[`${account.accountId}:${offerId}`] = {
                    accountId: account.accountId, offerId, nodeId: lot.nodeId ? String(lot.nodeId) : null,
                    title: lot.title ? String(lot.title).slice(0, 120) : null, ruleId: ruleId || null, boundAt: now()
                };
            }
        });
        return evaluate();
    }

    // Предпросмотр без записи: ближайшие переходы правила и что произойдёт с лотами сейчас.
    async function preview({ rule, ruleId = null }) {
        const account = await requireAccount();
        const state = await read();
        const target = rule || state.rules[ruleId];
        if (!target) throw new Error('Правило не найдено.');
        const errors = validateScheduleRule(target);
        if (errors.length) return { errors };
        const at = now();
        const openNow = isScheduleOpen(target, at);
        const transitions = scheduleTransitions(target, at, { horizonMinutes: 7 * 24 * 60, limit: 6 })
            .map(item => ({ at: item.at, open: item.open, local: `${item.local.date} ${item.local.time}`, offset: item.local.offset }));
        const lots = [];
        for (const binding of Object.values(state.bindings)) {
            if (binding.accountId !== account.accountId || (ruleId && binding.ruleId !== ruleId)) continue;
            const policy = (await policies.get(account.accountId, binding.offerId)) || { manageActive: true, manualIntent: 'auto', blockers: {} };
            const hypothetical = { ...policy, manageActive: true, blockers: { ...(policy.blockers || {}) } };
            if (openNow) delete hypothetical.blockers.schedule;
            else hypothetical.blockers.schedule = { reason: 'Вне окна расписания' };
            const lastActive = policy.lastWrite?.observedActive ?? null;
            lots.push({
                offerId: binding.offerId, title: binding.title,
                decision: lastActive === null ? (openNow ? 'open' : 'close') : decideLotActivity(hypothetical, lastActive)
            });
        }
        return { errors: [], openNow, transitions, lots };
    }

    async function evaluateOnce() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) return { skipped: 'account' };
        const state = await read();
        const rules = Object.values(state.rules).filter(rule => rule.accountId === account.accountId);
        const enabledRules = rules.filter(rule => rule.enabled && isValidTimeZone(rule.timezone));
        const results = [];
        const at = now();
        for (const binding of Object.values(state.bindings)) {
            if (binding.accountId !== account.accountId) continue;
            const rule = state.rules[binding.ruleId];
            const active = Boolean(rule?.enabled);
            const open = active ? isScheduleOpen(rule, at) : true;
            const before = await policies.get(account.accountId, binding.offerId);
            const hadBlocker = Boolean(before?.blockers?.schedule);
            if (!active && !hadBlocker) continue;
            await policies.setBlocker(account.accountId, binding.offerId, 'schedule', !open, { reason: open ? null : `Вне окна «${rule?.name || 'расписание'}»`, nodeId: binding.nodeId });
            if (active) {
                await policies.update(account.accountId, binding.offerId, policy => (policy.manageActive ? undefined : { ...policy, manageActive: true }), { nodeId: binding.nodeId });
            }
            let outcome;
            try {
                outcome = await activity.apply({ accountId: account.accountId, offerId: binding.offerId, nodeId: binding.nodeId, source: 'schedule' });
            } catch (error) {
                outcome = { status: 'error', error: error?.message || String(error) };
            }
            results.push({ offerId: binding.offerId, open, ...outcome, policy: undefined });
        }
        const next = enabledRules.length ? nextScheduleCheck(enabledRules, at) : null;
        await mutate(current => {
            for (const result of results) {
                current.status[`${account.accountId}:${result.offerId}`] = {
                    at, open: result.open, status: result.status, decision: result.decision || null, error: result.error || null
                };
            }
            current.nextDueAt = next;
            current.evaluatedAt = at;
        });
        if (scheduler) {
            if (next) await scheduler.scheduleDue(LOT_SCHEDULES_ALARM, next);
            else await scheduler.clearDue(LOT_SCHEDULES_ALARM).catch(() => {});
        }
        return { results, nextDueAt: next };
    }

    function evaluate() {
        if (!running) {
            running = evaluateOnce()
                .catch(error => { log.warn?.('FunPay Funcy: расписания не применены:', error?.message || error); throw error; })
                .finally(() => { running = null; });
        }
        return running;
    }

    async function list() {
        const account = await requireAccount();
        const state = await read();
        const rules = Object.values(state.rules).filter(rule => rule.accountId === account.accountId);
        const bindings = Object.values(state.bindings).filter(binding => binding.accountId === account.accountId);
        return {
            accountId: account.accountId,
            rules,
            bindings,
            status: Object.fromEntries(Object.entries(state.status).filter(([key]) => key.startsWith(`${account.accountId}:`))),
            nextDueAt: state.nextDueAt || null,
            evaluatedAt: state.evaluatedAt || null
        };
    }

    return Object.freeze({ saveRule, setRuleEnabled, deleteRule, bindLots, preview, evaluate, list });
}
