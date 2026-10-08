/*
 * FunPay Funcy — правила цен лотов: предпросмотр, применение, автопересчёт.
 *
 * Изменение правила само ничего не пишет. Предпросмотр читает свежую форму каждого
 * лота и себестоимость, считает минимальную безопасную и целевую цену и
 * запоминает входные данные. Применение принимает только строки этого
 * предпросмотра и пишет цену через очередь лота с expect = цена из предпросмотра:
 * если цена или себестоимость успели измениться, нужен новый предпросмотр.
 *
 * Автопересчёт (rule.auto) — отдельное согласие: правило пересчитывает
 * привязанные лоты по расписанию, меняет цену не больше чем на maxStepPercent за
 * проход и приостанавливается, если продавец сам поменял цену после нас.
 * Строка «нет безопасной цены» ставит блокировку price — только для лотов, где
 * продавец разрешил управление активностью.
 */

import { priceForLot, validatePricingRule, describeMarkupMargin } from './pricing.js';
import { parseDecimal, formatDecimal, compareDecimal, subDecimal, mulDecimal, divDecimal, addDecimal, roundToQuantum } from './money.js';

export const PRICING_KEY = 'fpToolsPricing';
export const PRICING_ALARM = 'fpToolsPricingAuto';
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;

function emptyState() {
    return { rules: {}, bindings: {}, autoState: {} };
}

function costOf(costBasis, offerId) {
    const entry = costBasis?.offers?.[String(offerId)];
    const amount = entry ? parseDecimal(entry.amount, { allowComma: true }) : null;
    if (!entry || !amount || compareDecimal(amount, '0') <= 0 || !entry.currency) return null;
    return { amount: formatDecimal(amount), currency: String(entry.currency).toUpperCase(), source: 'seller-estimate', updatedAt: entry.updatedAt || null };
}

export function createPricingService({ storage, guard, readForm, queue, policies = null, activity = null, scheduler = null, getCostOverride = null, now = () => Date.now(), log = console } = {}) {
    if (!storage || !guard || typeof readForm !== 'function' || !queue) throw new Error('Сервис цен не настроен.');
    let chain = Promise.resolve();
    const previews = new Map();

    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function read() {
        const { [PRICING_KEY]: stored } = await storage.get(PRICING_KEY);
        return stored && typeof stored === 'object' ? { ...emptyState(), ...stored } : emptyState();
    }

    function mutate(fn) {
        return serialize(async () => {
            const state = await read();
            const result = await fn(state);
            await storage.set({ [PRICING_KEY]: state });
            return result;
        });
    }

    async function requireAccount() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        return account;
    }

    async function costFor(accountId, offerId) {
        if (typeof getCostOverride === 'function') {
            const override = await getCostOverride(accountId, offerId);
            if (override) return override;
        }
        const { fpToolsCostBasis } = await storage.get('fpToolsCostBasis');
        return costOf(fpToolsCostBasis, offerId);
    }

    async function saveRule({ rule, expectedRevision = null }) {
        const account = await requireAccount();
        const errors = validatePricingRule(rule);
        if (errors.length) throw Object.assign(new Error(errors.join(' ')), { code: 'invalid' });
        return mutate(state => {
            const ruleId = rule.ruleId || `p${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const current = state.rules[ruleId];
            if (current && current.accountId !== account.accountId) throw new Error('Правило принадлежит другому аккаунту.');
            if (current && expectedRevision !== null && current.revision !== expectedRevision) throw Object.assign(new Error('Правило изменилось — обновите страницу.'), { code: 'conflict' });
            state.rules[ruleId] = {
                ruleId, accountId: account.accountId, name: String(rule.name || 'Правило цены').slice(0, 60),
                mode: rule.mode, value: String(rule.value), currency: String(rule.currency || 'RUB').toUpperCase(),
                minProfit: rule.minProfit ? String(rule.minProfit) : '0', minMarginPercent: rule.minMarginPercent ? String(rule.minMarginPercent) : '0',
                fixedFee: rule.fixedFee ? String(rule.fixedFee) : '0', feePercent: rule.feePercent ? String(rule.feePercent) : '0',
                step: rule.step ? String(rule.step) : '0.01', ceiling: rule.ceiling ? String(rule.ceiling) : null,
                allowRaise: Boolean(rule.allowRaise),
                // Автопересчёт — отдельное согласие, сохранение черновика его не включает.
                auto: current ? current.auto : false,
                maxStepPercent: rule.maxStepPercent ? String(rule.maxStepPercent) : '10',
                revision: (current?.revision || 0) + 1, updatedAt: now()
            };
            return state.rules[ruleId];
        });
    }

    async function bindLots({ ruleId, lots }) {
        const account = await requireAccount();
        return mutate(state => {
            if (ruleId && state.rules[ruleId]?.accountId !== account.accountId) throw new Error('Правило не найдено.');
            for (const lot of lots || []) {
                const offerId = String(lot.offerId || lot.id || '');
                if (!/^\d+$/.test(offerId)) continue;
                const key = `${account.accountId}:${offerId}`;
                if (!ruleId) { delete state.bindings[key]; continue; }
                state.bindings[key] = { accountId: account.accountId, offerId, nodeId: lot.nodeId ? String(lot.nodeId) : null, title: lot.title || null, ruleId };
            }
            return Object.values(state.bindings).filter(binding => binding.accountId === account.accountId);
        });
    }

    async function evaluateLot(account, rule, lot) {
        const cost = await costFor(account.accountId, lot.offerId);
        let form = null;
        try {
            form = await readForm({ id: String(lot.offerId), nodeId: String(lot.nodeId || '') });
        } catch (error) {
            return { offerId: lot.offerId, title: lot.title, action: 'skip', reasons: [`Форма лота не прочитана: ${error.message}`] };
        }
        const currentPrice = form?.price ?? null;
        const base = { offerId: String(lot.offerId), nodeId: lot.nodeId ? String(lot.nodeId) : null, title: lot.title || form?.['fields[summary][ru]'] || `Лот #${lot.offerId}`, currentPrice, cost };
        if (!cost) return { ...base, action: 'skip', reasons: ['Себестоимость не указана.'] };
        if (cost.currency !== rule.currency) return { ...base, action: 'skip', reasons: [`Себестоимость в ${cost.currency}, а правило — в ${rule.currency}.`] };
        return { ...base, ...priceForLot({ cost: cost.amount, currentPrice, rule }) };
    }

    // Предпросмотр по правилу (ruleId или черновик rule) для выбранных лотов.
    async function preview({ ruleId = null, rule = null, lots }) {
        const account = await requireAccount();
        const state = await read();
        const target = rule || state.rules[ruleId];
        if (!target) throw new Error('Правило не найдено.');
        const errors = validatePricingRule(target);
        if (errors.length) throw Object.assign(new Error(errors.join(' ')), { code: 'invalid' });
        const effective = { ...target, currency: String(target.currency || 'RUB').toUpperCase() };
        const rows = [];
        for (const lot of lots || []) rows.push(await evaluateLot(account, effective, lot));
        const previewId = `pv${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        previews.set(previewId, { accountId: account.accountId, epoch: account.epoch, ruleId: target.ruleId || null, ruleRevision: target.revision || null, createdAt: now(), rows });
        for (const [id, item] of previews) if (now() - item.createdAt > PREVIEW_TTL_MS) previews.delete(id);
        return { previewId, expiresAt: now() + PREVIEW_TTL_MS, explanation: describeMarkupMargin(effective), rows };
    }

    // Применяет выбранные строки предпросмотра. Устаревший предпросмотр не применяется.
    async function apply({ previewId, offerIds }) {
        const account = await requireAccount();
        const stored = previews.get(previewId);
        if (!stored || now() - stored.createdAt > PREVIEW_TTL_MS) throw Object.assign(new Error('Предпросмотр устарел — постройте новый.'), { code: 'expired' });
        if (stored.accountId !== account.accountId || stored.epoch !== account.epoch) throw Object.assign(new Error('Аккаунт сменился — постройте новый предпросмотр.'), { code: 'account-changed' });
        if (stored.ruleId) {
            const current = (await read()).rules[stored.ruleId];
            if (!current || current.revision !== stored.ruleRevision) throw Object.assign(new Error('Правило изменилось — постройте новый предпросмотр.'), { code: 'conflict' });
        }
        const wanted = new Set((offerIds || []).map(String));
        const results = [];
        for (const row of stored.rows) {
            if (!wanted.has(row.offerId)) continue;
            if (!['raise', 'lower', 'set'].includes(row.action)) { results.push({ offerId: row.offerId, status: 'skipped', reason: row.reasons?.[0] || row.action }); continue; }
            const cost = await costFor(account.accountId, row.offerId);
            if (!cost || cost.amount !== row.cost?.amount || cost.currency !== row.cost?.currency) {
                results.push({ offerId: row.offerId, status: 'stale', reason: 'Себестоимость изменилась — нужен новый предпросмотр.' });
                continue;
            }
            try {
                const result = await queue.enqueue({
                    offerId: row.offerId, nodeId: row.nodeId, source: 'pricing',
                    op: { type: 'setPrice', price: row.target, expect: row.currentPrice !== null ? { price: row.currentPrice } : null }
                });
                results.push({ offerId: row.offerId, status: result.status, price: result.price ?? row.target });
                if (result.status === 'saved') await recordApplied(account.accountId, row.offerId, result.price ?? row.target);
            } catch (error) {
                results.push({ offerId: row.offerId, status: 'error', reason: error.message });
            }
        }
        previews.delete(previewId);
        return { results };
    }

    async function recordApplied(accountId, offerId, price) {
        await mutate(state => {
            state.autoState[`${accountId}:${offerId}`] = { ...(state.autoState[`${accountId}:${offerId}`] || {}), lastAppliedPrice: String(price), at: now(), paused: null };
        });
    }

    async function setAuto({ ruleId, auto, expectedRevision = null }) {
        const account = await requireAccount();
        const rule = await mutate(state => {
            const current = state.rules[ruleId];
            if (!current || current.accountId !== account.accountId) throw new Error('Правило не найдено.');
            if (expectedRevision !== null && current.revision !== expectedRevision) throw Object.assign(new Error('Правило изменилось — обновите страницу.'), { code: 'conflict' });
            state.rules[ruleId] = { ...current, auto: Boolean(auto), revision: current.revision + 1, updatedAt: now() };
            return state.rules[ruleId];
        });
        if (scheduler) {
            const anyAuto = Object.values((await read()).rules).some(item => item.auto);
            if (anyAuto) await scheduler.scheduleDue(PRICING_ALARM, now() + 60 * 1000);
            else await scheduler.clearDue(PRICING_ALARM).catch(() => {});
        }
        return rule;
    }

    // Ограничение шага автоматического изменения цены.
    function boundedTarget(current, target, maxStepPercent) {
        const cur = parseDecimal(current, { allowComma: true });
        if (!cur) return target;
        const limit = mulDecimal(formatDecimal(cur), divDecimal(maxStepPercent, '100', { quantum: '0.0000001' }));
        const upper = addDecimal(formatDecimal(cur), limit);
        const lower = subDecimal(formatDecimal(cur), limit);
        if (compareDecimal(target, upper) > 0) return upper;
        if (compareDecimal(target, lower) < 0) return lower;
        return target;
    }

    async function runAuto() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) return { skipped: 'account' };
        const state = await read();
        const results = [];
        for (const binding of Object.values(state.bindings)) {
            if (binding.accountId !== account.accountId) continue;
            const rule = state.rules[binding.ruleId];
            if (!rule?.auto) continue;
            const key = `${account.accountId}:${binding.offerId}`;
            const auto = state.autoState[key] || {};
            if (auto.paused) { results.push({ offerId: binding.offerId, status: 'paused' }); continue; }
            const row = await evaluateLot(account, rule, binding);
            // Продавец сам изменил цену после нашей записи — автопересчёт останавливается.
            if (auto.lastAppliedPrice && row.currentPrice !== null && compareDecimal(auto.lastAppliedPrice, row.currentPrice) !== 0) {
                await mutate(next => { next.autoState[key] = { ...auto, paused: { reason: 'manual-edit', observedPrice: row.currentPrice, at: now() } }; });
                results.push({ offerId: binding.offerId, status: 'paused' });
                continue;
            }
            if (row.action === 'block') {
                if (policies && activity && (await policies.get(account.accountId, binding.offerId))?.manageActive) {
                    await policies.setBlocker(account.accountId, binding.offerId, 'price', true, { reason: row.reasons?.[0] || 'Нет безопасной цены', nodeId: binding.nodeId });
                    await activity.apply({ accountId: account.accountId, offerId: binding.offerId, nodeId: binding.nodeId, source: 'pricing' }).catch(() => {});
                }
                results.push({ offerId: binding.offerId, status: 'blocked' });
                continue;
            }
            if (policies && (await policies.get(account.accountId, binding.offerId))?.blockers?.price) {
                await policies.setBlocker(account.accountId, binding.offerId, 'price', false);
                if (activity) await activity.apply({ accountId: account.accountId, offerId: binding.offerId, nodeId: binding.nodeId, source: 'pricing' }).catch(() => {});
            }
            if (!['raise', 'lower'].includes(row.action)) { results.push({ offerId: binding.offerId, status: row.action }); continue; }
            let price = roundToQuantum(boundedTarget(row.currentPrice, row.target, rule.maxStepPercent || '10'), rule.step || '0.01', 'half-up');
            // Ограничение шага не должно опускать цену ниже минимальной безопасной.
            if (row.floor && compareDecimal(price, row.floor) < 0) price = row.floor;
            try {
                const result = await queue.enqueue({ offerId: binding.offerId, nodeId: binding.nodeId, source: 'pricing-auto', op: { type: 'setPrice', price, expect: { price: row.currentPrice } } });
                if (result.status === 'saved') await recordApplied(account.accountId, binding.offerId, result.price ?? price);
                results.push({ offerId: binding.offerId, status: result.status, price });
            } catch (error) {
                results.push({ offerId: binding.offerId, status: 'error', reason: error.message });
                log.warn?.(`FunPay Funcy: автоцена лота ${binding.offerId} не применена:`, error?.message || error);
            }
        }
        if (scheduler && Object.values(state.rules).some(rule => rule.auto && rule.accountId === account.accountId)) {
            await scheduler.scheduleDue(PRICING_ALARM, now() + AUTO_INTERVAL_MS);
        }
        return { results };
    }

    async function resumeAuto({ offerId }) {
        const account = await requireAccount();
        await mutate(state => {
            const key = `${account.accountId}:${offerId}`;
            state.autoState[key] = { ...(state.autoState[key] || {}), paused: null, lastAppliedPrice: null };
        });
        return true;
    }

    async function list() {
        const account = await requireAccount();
        const state = await read();
        return {
            rules: Object.values(state.rules).filter(rule => rule.accountId === account.accountId).map(rule => ({ ...rule, explanation: describeMarkupMargin(rule) })),
            bindings: Object.values(state.bindings).filter(binding => binding.accountId === account.accountId),
            autoState: Object.fromEntries(Object.entries(state.autoState).filter(([key]) => key.startsWith(`${account.accountId}:`)))
        };
    }

    async function deleteRule({ ruleId }) {
        const account = await requireAccount();
        return mutate(state => {
            if (state.rules[ruleId]?.accountId !== account.accountId) throw new Error('Правило не найдено.');
            delete state.rules[ruleId];
            for (const [key, binding] of Object.entries(state.bindings)) if (binding.ruleId === ruleId) delete state.bindings[key];
            return true;
        });
    }

    return Object.freeze({ saveRule, bindLots, preview, apply, setAuto, runAuto, resumeAuto, list, deleteRule });
}
