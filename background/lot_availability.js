/*
 * FunPay Funcy — активность лотов: единое применение решения.
 *
 * createLotActivityService применяет одно решение resolver'а (lot_policy.js) к
 * свежей форме лота внутри очереди записи: сначала проверяет, не изменил ли лот
 * продавец, затем решает, затем записывает итог и владельца выключения.
 * Расписание, цены и ручные команды меняют только свою блокировку или намерение
 * и просят сервис применить решение. Автовыключения и автовосстановления по
 * остатку склада нет: остаток только показывается в «Автовыдаче».
 */

import { isLotFormActive } from './lot_writer.js';
import { decideLotActivity, observeExternalChange, afterApply, activeBlockers } from './lot_policy.js';

export function createLotActivityService({ queue, policies, now = () => Date.now() } = {}) {
    if (!queue || !policies) throw new Error('Сервис активности лотов не настроен.');

    async function apply({ accountId, offerId, nodeId, source = 'policy' }) {
        const snapshot = await policies.get(accountId, offerId);
        if (!snapshot?.manageActive) return { status: 'not-managed', decision: 'not-managed' };
        let observed = null;
        const result = await queue.enqueue({
            offerId, nodeId: nodeId || snapshot.nodeId, source,
            op: {
                type: 'policy',
                decide: form => {
                    const active = isLotFormActive(form);
                    const policy = observeExternalChange({ ...snapshot }, { currentActive: active, now: now() });
                    const decision = decideLotActivity(policy, active);
                    observed = { policy, decision, active };
                    return decision;
                }
            }
        });
        if (!observed) return { status: result.status, decision: null };
        const saved = result.status === 'saved';
        const observedActive = saved ? (result.active ?? observed.decision === 'activate') : observed.active;
        const updated = await policies.update(accountId, offerId, current => afterApply({
            ...current,
            paused: observed.policy.paused,
            inactiveEvidence: observed.policy.inactiveEvidence,
            disabledBy: observed.policy.disabledBy,
            lastWrite: observed.policy.lastWrite
        }, { decision: observed.decision, observedActive, status: result.status, now: now() }));
        return { status: result.status, decision: observed.decision, active: observedActive, policy: updated, blockers: activeBlockers(updated) };
    }

    return Object.freeze({ apply });
}
