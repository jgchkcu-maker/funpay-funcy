/*
 * FunPay Funcy — единый исполнитель заказов.
 *
 * Чат, сверка и кнопки карточки заказа вызывают только observe(): исполнитель сам
 * перечитывает страницу заказа, сверяет аккаунт, роль, статус, покупателя, чат,
 * количество и привязку к лоту, закрепляет за заказом один источник товара и
 * выдаёт товар частями. Каждая часть сохраняется до отправки и получает свой
 * исход (confirmed / accepted / rejected / uncertain).
 *
 *  - повторное событие видит попытку в журнале и ничего не отправляет второй раз;
 *  - неясный исход части не повторяется автоматически — решение за продавцом;
 *  - повтор после однозначного отказа отправляет только не отправленные части.
 */

import { orderKeyOf } from './ops_db.js';
import { verifyOrderForEffect, describeReasons } from './order_verifier.js';
import { orderFactsFingerprint } from './order_facts.js';
import { sha256Short } from './account_guard.js';

export const DELIVERY_RETRY_LIMIT = 3;
const OPEN_DELIVERY_STATES = new Set(['none', 'blocked', 'pending', 'failed']);

export function splitDeliveryText(text) {
    const parts = [];
    let delayMs = 0;
    String(text || '').split(/\$sleep=(\d+\.?\d*)/i).forEach((piece, index) => {
        if (index % 2 === 1) {
            delayMs += Math.round(Number.parseFloat(piece) * 1000) || 0;
            return;
        }
        const body = piece.trim();
        if (!body) return;
        parts.push({ text: body, delayMs: parts.length ? Math.max(delayMs, 500) : delayMs });
        delayMs = 0;
    });
    return parts;
}

export function deliveryOpKey(orderKey, generation = 1) {
    return `delivery:${orderKey}:g${generation}`;
}

export function summarizeParts(parts) {
    const states = parts.map(part => part.state);
    if (!states.length) return 'none';
    if (states.every(state => state === 'confirmed' || state === 'manual')) return 'done';
    if (states.some(state => state === 'uncertain' || state === 'sending')) return 'uncertain';
    if (states.every(state => ['confirmed', 'accepted', 'manual'].includes(state))) return 'sent-unconfirmed';
    if (states.some(state => ['confirmed', 'accepted', 'manual'].includes(state))) return 'partial';
    if (states.some(state => state === 'rejected')) return 'failed';
    return 'pending';
}

export function createFulfillmentDispatcher({
    journal, guard, loadFacts, sender, getAuth, getAutoReplies, getDeliveryConfigs,
    isBlacklisted = async () => false, render = text => text, sleep = ms => new Promise(r => setTimeout(r, ms)),
    onDelivered = async () => {}, onObserved = async () => {}, isLotEnabled = config => Boolean(config && config.enabled !== false),
    now = () => Date.now(), log = console, hash = sha256Short
} = {}) {
    if (!journal || !guard || typeof loadFacts !== 'function' || !sender) throw new Error('Исполнитель заказов не настроен.');
    const inFlight = new Map();

    async function recordFacts(account, facts, { source, buyerName, adopt }) {
        const fields = {
            accountId: account.accountId,
            orderId: facts.orderId,
            source,
            fpStatus: facts.status,
            chatId: facts.buyerChatId,
            buyerId: facts.buyerId,
            buyerName: facts.buyerUsername || buyerName || null,
            lotId: facts.lotId,
            nodeId: facts.nodeId,
            lotName: facts.lotName,
            quantity: facts.quantity?.kind === 'integer' ? facts.quantity.value : null,
            quantityRaw: facts.quantity?.raw ?? null,
            quantityState: facts.quantity?.kind || 'unknown',
            lotCandidate: facts.lotCandidate || null,
            reviewPresence: facts.review?.presence || 'unknown',
            reviewRating: facts.review?.rating ?? null,
            factsFingerprint: orderFactsFingerprint(facts),
            factsObservedAt: facts.observedAt,
            epoch: account.epoch
        };
        if (facts.status === 'paid' || facts.status === 'closed') fields.firstPaidSeenAt = facts.observedAt;
        if (facts.status === 'closed') fields.fpConfirmedAt = facts.observedAt;
        if (adopt) fields.adopted = true;
        const { order, created } = await journal.recordAccountOrder(fields);
        if (created) await journal.appendEvent(order.key, 'order.observed', { source, status: facts.status });
        if (facts.status === 'refunded' && !order.refundObservedAt) {
            await journal.updateAccountOrder(order.key, current => ({
                refundObservedAt: now(),
                problemState: current.problemState === 'none' ? 'attention' : current.problemState,
                holds: addHold(current.holds, { owner: 'refund', reason: 'Возврат FunPay: новые эффекты остановлены.' })
            }));
            await journal.appendEvent(order.key, 'order.refund_observed', {});
        }
        return journal.getAccountOrder(account.accountId, facts.orderId);
    }

    function addHold(holds, hold) {
        const list = Array.isArray(holds) ? holds.filter(item => item.owner !== hold.owner) : [];
        return [...list, { ...hold, at: now() }];
    }

    async function block(order, reasons, extra = {}) {
        const updated = await journal.updateAccountOrder(order.key, current => {
            const same = current.deliveryState === 'blocked' && JSON.stringify(current.blockReasons || []) === JSON.stringify(reasons);
            if (same && !extra.force) return undefined;
            return { deliveryState: OPEN_DELIVERY_STATES.has(current.deliveryState) ? 'blocked' : current.deliveryState, blockReasons: reasons };
        });
        await journal.appendEvent(order.key, 'delivery.blocked', { reasons });
        return { status: 'blocked', reasons, messages: describeReasons(reasons), order: updated };
    }

    // Возвращает { status, reasons?, order?, facts? }.
    async function observeOnce({ orderId, source = 'chat', eventChatId = null, buyerName = null, adopt = source === 'chat' }) {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) return { status: 'skipped', reasons: ['account-unknown'] };
        const facts = await loadFacts(orderId, { accountId: account.accountId, epoch: account.epoch, fresh: true });
        if (!facts) return { status: 'skipped', reasons: ['unparsed'] };
        if (!facts.recognized || !facts.orderId) return { status: 'skipped', reasons: facts.problems || ['unrecognized-page'], facts };

        const observeCheck = verifyOrderForEffect(facts, { accountId: account.accountId, effect: 'observe', expectedOrderId: orderId });
        if (observeCheck.reasons.some(reason => ['order-mismatch', 'account-mismatch', 'role-buyer', 'role-unknown', 'account-unknown'].includes(reason))) {
            return { status: 'skipped', reasons: observeCheck.reasons, facts, role: observeCheck.role };
        }

        let order = await recordFacts(account, facts, { source, buyerName, adopt });
        await onObserved({ order, facts, account }).catch(error => log.warn?.('FunPay Funcy: обработчик наблюдения заказа:', error?.message || error));

        const settings = (await getAutoReplies()) || {};
        if (!settings.autoDeliveryEnabled) return { status: 'observed', order, facts, role: 'seller' };
        if (order.adopted !== true) return { status: 'observed', reasons: ['not-adopted'], order, facts, role: 'seller' };
        if (!OPEN_DELIVERY_STATES.has(order.deliveryState)) return { status: 'already', order, facts, role: 'seller' };

        // Заказ, который уже выдавала прежняя версия расширения, не выдаётся снова.
        const legacy = (settings.deliveredOrderIds || []).includes(facts.orderId) || await journal.getOp(`delivery:${facts.orderId}`);
        if (legacy) {
            order = await journal.updateAccountOrder(order.key, () => ({ deliveryState: 'legacy', blockReasons: [] }));
            return { status: 'already', order, facts, role: 'seller' };
        }

        const verdict = verifyOrderForEffect(facts, {
            accountId: account.accountId,
            effect: 'delivery',
            eventChatId,
            expectedOrderId: orderId,
            binding: order.confirmedBinding || null
        });
        if (!verdict.ok) return { ...(await block(order, verdict.reasons)), facts, role: verdict.role };
        if (order.holds?.length) return { ...(await block(order, ['hold'])), facts, role: 'seller' };
        if (await isBlacklisted(facts.buyerUsername || buyerName, 'delivery')) {
            return { ...(await block(order, ['blacklist'])), facts, role: 'seller' };
        }

        const configs = (await getDeliveryConfigs()) || {};
        const config = configs[String(verdict.offerId)];
        if (!isLotEnabled(config)) return { status: 'observed', reasons: ['lot-disabled'], order, facts, role: 'seller' };

        // Источник закрепляется при первом решении и сам не меняется.
        const wantedSource = config.mode === 'template' ? 'template' : 'funpay_secrets';
        const pinned = order.fulfillmentSource || wantedSource;
        if (!order.fulfillmentSource) {
            order = await journal.updateAccountOrder(order.key, () => ({ fulfillmentSource: pinned, offerId: verdict.offerId }));
        }

        // Заказы, закреплённые за удалённым источником, автоматически не выдаются.
        if (pinned !== 'template' && pinned !== 'funpay_secrets') return block(order, ['source-unavailable']);

        let text = '';
        let coverage = 'full';
        if (pinned === 'template') {
            if (!config.text?.trim()) return block(order, ['template-empty']);
            text = render(config.text, { buyerName: facts.buyerUsername || buyerName, orderId: facts.orderId, lotName: facts.lotName });
        } else {
            if (!facts.secrets.length) return block(order, ['secrets-missing']);
            text = facts.secrets.join('\n');
            if (facts.secrets.length < verdict.quantity.value) coverage = 'partial';
        }
        return deliver({ account, order, verdict, texts: splitDeliveryText(text), coverage, source: pinned, facts });
    }

    async function deliver({ account, order, verdict, texts, coverage, source, facts }) {
        if (!texts.length) return block(order, ['nothing-to-send']);
        const generation = order.fulfillmentGeneration || 1;
        const opKey = deliveryOpKey(order.key, generation);
        let { op, created } = await journal.beginAttempt({
            opKey, kind: 'delivery', orderKey: order.key,
            payload: { offerId: verdict.offerId, chatId: verdict.chatId, source, generation, accountId: account.accountId, epoch: account.epoch }
        });
        if (created) {
            const parts = [];
            for (const [index, part] of texts.entries()) {
                parts.push({ partId: `${opKey}#${index}`, opKey, orderKey: order.key, index, text: part.text, delayMs: part.delayMs, bodyHash: await hash(`${verdict.chatId}\n${part.text}`), state: 'pending' });
            }
            await journal.putParts(parts);
        } else if (op.state === 'failed') {
            if ((op.attempts || 0) >= DELIVERY_RETRY_LIMIT) return { status: 'failed', order };
        } else if (op.state !== 'pending') {
            return { status: 'already', order, op };
        }

        await journal.updateAccountOrder(order.key, () => ({
            deliveryState: 'sending', resultCoverage: coverage, blockReasons: [],
            problemState: coverage === 'partial' ? 'attention' : undefined
        }));
        op = await journal.transitionOp(opKey, 'sending', { lastError: null });
        const outcome = await sendParts({ account, opKey, chatId: verdict.chatId, orderKey: order.key });

        const parts = await journal.listParts(opKey);
        const summary = summarizeParts(parts);
        const opState = summary === 'done' || summary === 'sent-unconfirmed' ? 'done'
            : summary === 'uncertain' ? 'uncertain'
                : 'failed';
        await journal.transitionOp(opKey, opState, { lastError: outcome.error || null });
        const verified = summary === 'done' && coverage === 'full';
        const updated = await journal.updateAccountOrder(order.key, current => ({
            deliveryState: summary,
            problemState: summary === 'uncertain' || summary === 'partial' || coverage === 'partial' ? 'attention' : current.problemState,
            verifiedFulfillmentCompletedAt: verified ? now() : undefined,
            deliveredAt: ['done', 'sent-unconfirmed'].includes(summary) ? now() : undefined
        }));
        await journal.appendEvent(order.key, 'delivery.result', { opKey, summary, coverage, error: outcome.error || null });
        if (['done', 'sent-unconfirmed'].includes(summary)) {
            await onDelivered({ order: updated, offerId: verdict.offerId, nodeId: facts?.nodeId || order.nodeId, source }).catch(() => {});
        }
        return { status: summary, order: updated };
    }

    // Отправляет pending/rejected части по порядку. Перед каждой — сверка аккаунта и задержек.
    async function sendParts({ account, opKey, chatId, orderKey, includeUncertain = [] }) {
        const auth = await getAuth();
        let anySent = false;
        let error = null;
        const parts = await journal.listParts(opKey);
        for (const part of parts) {
            if (part.state === 'confirmed' || part.state === 'accepted' || part.state === 'manual') { anySent = true; continue; }
            if (part.state === 'uncertain' && !includeUncertain.includes(part.partId)) { error = error || 'Есть часть с неясным исходом.'; break; }
            if (part.delayMs && anySent) await sleep(part.delayMs);
            try {
                await guard.assertCurrent(account);
                const order = await journal.getRecord('accountOrders', orderKey);
                if (order?.holds?.length) { error = 'Заказ поставлен на удержание.'; break; }
            } catch (stop) {
                error = stop.message;
                break;
            }
            await journal.updatePart(part.partId, { state: 'sending', attemptAt: now() });
            const result = await sender.send({ chatId, text: part.text, auth, accountId: account.accountId });
            await journal.updatePart(part.partId, {
                state: result.status, receipt: { messageId: result.messageId || null, httpStatus: result.httpStatus || null, at: now() }, error: result.error || null
            });
            if (result.status === 'confirmed' || result.status === 'accepted') { anySent = true; continue; }
            error = result.error || `Исход отправки: ${result.status}`;
            break;
        }
        return { anySent, error };
    }

    // Явное решение продавца: повторить отправку части с неясным исходом прежним текстом.
    async function resendUncertainPart({ orderKey, partId, expectedRevision }) {
        const account = await guard.current({ fresh: true });
        const order = await journal.getRecord('accountOrders', orderKey);
        if (!order || order.accountId !== account.accountId) throw new Error('Заказ относится к другому аккаунту.');
        if (expectedRevision != null && order.revision !== expectedRevision) throw Object.assign(new Error('Карточка устарела — обновите её.'), { code: 'conflict' });
        const opKey = partId.split('#')[0];
        const op = await journal.getOp(opKey);
        if (!op) throw new Error('Попытка выдачи не найдена.');
        const part = (await journal.listParts(opKey)).find(item => item.partId === partId);
        if (!part || part.state !== 'uncertain') throw new Error('Повторить можно только часть с неясным исходом.');
        if (op.state === 'uncertain') await journal.transitionOp(opKey, 'pending', { lastError: null });
        if (op.state !== 'sending') await journal.transitionOp(opKey, 'sending', { lastError: null });
        await journal.appendEvent(orderKey, 'delivery.manual_resend', { partId });
        const outcome = await sendParts({ account, opKey, chatId: op.payload.chatId, orderKey, includeUncertain: [partId] });
        const summary = summarizeParts(await journal.listParts(opKey));
        await journal.transitionOp(opKey, summary === 'done' || summary === 'sent-unconfirmed' ? 'done' : summary === 'uncertain' ? 'uncertain' : 'failed', { lastError: outcome.error || null });
        return journal.updateAccountOrder(orderKey, () => ({ deliveryState: summary }));
    }

    // Явное решение продавца после частичной выдачи: отправить только части,
    // которые точно не отправлены (pending/rejected). Части с неясным исходом не трогаются.
    async function deliverRemaining({ orderKey }) {
        const account = await guard.current({ fresh: true });
        const order = await journal.getRecord('accountOrders', orderKey);
        if (!order || order.accountId !== account.accountId) throw new Error('Заказ относится к другому аккаунту.');
        if (order.holds?.length) throw new Error('Заказ на удержании.');
        const opKey = deliveryOpKey(orderKey, order.fulfillmentGeneration || 1);
        const op = await journal.getOp(opKey);
        if (!op || op.state !== 'failed') throw new Error('Нет прерванной выдачи для продолжения.');
        const facts = await loadFacts(order.orderId, { accountId: account.accountId, epoch: account.epoch, fresh: true });
        const verdict = verifyOrderForEffect(facts, { accountId: account.accountId, effect: 'delivery', expectedOrderId: order.orderId, binding: order.confirmedBinding || null });
        if (!verdict.ok) return block(order, verdict.reasons, { force: true });
        await journal.transitionOp(opKey, 'sending', { lastError: null });
        const outcome = await sendParts({ account, opKey, chatId: op.payload.chatId, orderKey });
        const summary = summarizeParts(await journal.listParts(opKey));
        await journal.transitionOp(opKey, summary === 'done' || summary === 'sent-unconfirmed' ? 'done' : summary === 'uncertain' ? 'uncertain' : 'failed', { lastError: outcome.error || null });
        return journal.updateAccountOrder(orderKey, () => ({ deliveryState: summary }));
    }

    // Один заказ обрабатывается одним вызовом одновременно: чат, сверка и UI ждут общий итог.
    function observe(input) {
        const id = String(input?.orderId || '').replace(/^#/, '').toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(id)) return Promise.resolve({ status: 'skipped', reasons: ['order-id'] });
        if (inFlight.has(id)) return inFlight.get(id);
        const run = observeOnce({ ...input, orderId: id })
            .catch(error => {
                log.error?.(`FunPay Funcy: заказ #${id} не обработан:`, error?.message || error);
                return { status: 'error', error: error?.message || String(error) };
            })
            .finally(() => inFlight.delete(id));
        inFlight.set(id, run);
        return run;
    }

    return Object.freeze({ observe, resendUncertainPart, deliverRemaining, orderKeyOf });
}
