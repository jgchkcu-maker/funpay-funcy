/*
 * FunPay Funcy — напоминание об отзыве после выполненной продажи.
 *
 * Одно нейтральное сообщение на заказ, только если:
 *   - заказ новый (после включения функции, не исторический и не из первой сверки);
 *   - выдачу выполнил единый исполнитель и FunPay подтвердил доставку каждой части
 *     (verifiedFulfillmentCompletedAt), а покупатель подтвердил заказ (fpConfirmedAt);
 *   - свежая страница заказа распознана и на ней точно нет отзыва — любой отзыв
 *     любой оценки отменяет задачу, «неизвестно» откладывает проверку;
 *   - нет возврата, проблемы, удержания, неясной выдачи, чёрного списка и
 *     исключений; в этот чат ещё не отправляли напоминание в пределах лимита.
 * Срок dueAt = max(выполнение, подтверждение) + задержка — повторные события его
 * не сдвигают. Резерв лимита чата и начало отправки — одна транзакция. Неясный
 * исход отправки не повторяется и расходует лимит. После сна отправляются только
 * актуальные задачи, не больше нескольких за проход; просроченные — истекают.
 * Ручные выдачи и услуги автоматически не покрываются: для них нет проверенного
 * исполнения, карточка честно показывает это.
 */

import { verifyOrderForEffect, describeReasons } from './order_verifier.js';
import { sha256Short } from './account_guard.js';

export const REMINDER_ALARM = 'fpToolsReviewReminders';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_SENDS_PER_RUN = 3;
const MAX_MANUAL_PER_CALL = 10;
const MANUAL_TTL = HOUR;
const CHECK_TTL = 6 * HOUR;
const CHECK_TTL_REFRESH = 10 * 60 * 1000;
const SALES_PAGES = 2;
const MAX_CANDIDATES = 60;
export const REMINDER_DEFAULT_TEXT = 'Здравствуйте! Если всё в порядке с заказом, будем благодарны за отзыв: {orderlink}';

export function reminderSettings(settings = {}) {
    const number = (value, fallback, min, max) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    };
    const list = value => (Array.isArray(value) ? value.map(item => String(item).trim().toLowerCase()).filter(Boolean) : []);
    return {
        enabled: settings.reviewReminderEnabled === true,
        text: typeof settings.reviewReminderText === 'string' && settings.reviewReminderText.trim() ? settings.reviewReminderText : REMINDER_DEFAULT_TEXT,
        delayMs: number(settings.reviewReminderDelayHours, 24, 1, 24 * 14) * HOUR,
        expiryMs: number(settings.reviewReminderExpiryDays, 7, 1, 60) * DAY,
        chatCapMs: number(settings.reviewReminderChatCapDays, 7, 1, 90) * DAY,
        excludedLots: list(settings.reviewReminderExcludedLots),
        excludedBuyers: list(settings.reviewReminderExcludedBuyers)
    };
}

export function renderReminder(template, { orderId, buyerName, lotName }) {
    const link = `https://funpay.com/orders/${orderId}/`;
    return String(template)
        .replace(/{orderlink}/gi, link)
        .replace(/{orderid}/gi, orderId)
        .replace(/{buyername}/gi, buyerName || '')
        .replace(/{lotname}/gi, lotName || '')
        .trim();
}

// Почему по заказу нельзя запланировать напоминание (null — можно).
export function reminderBlocker(order, settings, baseline) {
    if (!baseline?.enabledFrom) return 'no-baseline';
    if (!order.firstSeenAt || order.firstSeenAt < baseline.enabledFrom) return 'before-enable';
    if (order.adopted !== true) return 'not-adopted';
    if (order.fpStatus === 'refunded' || order.refundObservedAt) return 'refund';
    if (order.holds?.length || ['open', 'attention'].includes(order.problemState)) return 'problem';
    if (['uncertain', 'partial', 'failed'].includes(order.deliveryState)) return 'delivery-uncertain';
    if (!order.verifiedFulfillmentCompletedAt) return 'no-verified-fulfillment';
    if (!order.fpConfirmedAt) return 'not-confirmed';
    if (order.reviewPresence === 'present') return 'review';
    if (settings.excludedLots.includes(String(order.offerId || order.lotId || ''))) return 'excluded-lot';
    if (order.buyerName && settings.excludedBuyers.includes(String(order.buyerName).toLowerCase())) return 'excluded-buyer';
    return null;
}

export const REMINDER_REASON_TEXT = Object.freeze({
    'no-baseline': 'Функция ещё не включалась',
    'before-enable': 'Заказ сделан до включения напоминаний',
    'not-adopted': 'Заказ только наблюдается',
    refund: 'Возврат',
    problem: 'Проблема или удержание заказа',
    'delivery-uncertain': 'Выдача не подтверждена',
    'no-verified-fulfillment': 'Нет проверенного исполнения',
    'not-confirmed': 'Покупатель ещё не подтвердил заказ',
    review: 'Отзыв уже есть',
    'excluded-lot': 'Лот в исключениях',
    'excluded-buyer': 'Покупатель в исключениях',
    disabled: 'Напоминания выключены',
    blacklist: 'Покупатель в чёрном списке',
    'chat-cap': 'В этот чат недавно уже отправляли напоминание',
    expired: 'Срок актуальности истёк',
    'verify-failed': 'Свежая проверка заказа не пройдена',
    'account-changed': 'Аккаунт сменился',
    'review-unknown': 'Не удалось определить, есть ли отзыв',
    seller: 'Отменено продавцом'
});

// Ручное напоминание продавец выбрал явно: исключения и «только новые заказы»
// не действуют, но возврат, проблема и отзыв по-прежнему его отменяют.
export function manualReminderBlocker(order) {
    if (!order) return null;
    if (order.fpStatus === 'refunded' || order.refundObservedAt) return 'refund';
    if (order.holds?.length || ['open', 'attention'].includes(order.problemState)) return 'problem';
    if (order.reviewPresence === 'present') return 'review';
    return null;
}

function toTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    const time = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(time) ? time : null;
}

export function createReviewReminders({
    journal, guard, loadFacts, sender, getAuth, getSettings, isBlacklisted = async () => false,
    fetchSalesPage = null, scheduler = null, now = () => Date.now(), hash = sha256Short, log = console
} = {}) {
    if (!journal || !guard || typeof loadFacts !== 'function' || !sender || typeof getSettings !== 'function') throw new Error('Напоминания не настроены.');
    let running = null;
    // Автоматический проход и ручная отправка не пересекаются: у них общий лимит чата.
    let queue = Promise.resolve();
    const exclusive = body => {
        const next = queue.then(body, body);
        queue = next.catch(() => {});
        return next;
    };

    const taskKey = (accountId, orderId) => `review-reminder:${accountId}:${orderId}`;
    const capKey = (accountId, chatId) => `chat-cap:${accountId}:${chatId}`;
    const baselineKey = accountId => `reminderBaseline:${accountId}`;
    const checkKey = (accountId, orderId) => `review-check:${accountId}:${orderId}`;

    async function baselineFor(accountId) {
        return (await journal.getMeta(baselineKey(accountId))) || null;
    }

    // Включение задаёт новую границу: всё, что было раньше, рассылкой не становится.
    async function onSettingsChanged() {
        const account = await guard.current();
        if (!account.accountId) return null;
        const settings = reminderSettings(await getSettings());
        const baseline = await baselineFor(account.accountId);
        if (settings.enabled && !baseline?.active) {
            await journal.setMeta(baselineKey(account.accountId), { enabledFrom: now(), active: true });
        } else if (!settings.enabled && baseline?.active) {
            await journal.setMeta(baselineKey(account.accountId), { ...baseline, active: false, disabledAt: now() });
            await cancelAll(account.accountId, 'disabled');
        }
        return scheduleNext();
    }

    async function cancelAll(accountId, reason) {
        for (const task of await journal.listRecords('reminders')) {
            if (task.accountId !== accountId || !['scheduled', 'deferred'].includes(task.state)) continue;
            await journal.updateRecord('reminders', task.key, current => (current && ['scheduled', 'deferred'].includes(current.state)
                ? { ...current, state: 'cancelled', cancellationReason: reason, updatedAt: now() } : undefined));
        }
    }

    async function cancelForOrder(accountId, orderId, reason) {
        const key = taskKey(accountId, orderId);
        const updated = await journal.updateRecord('reminders', key, current => (current && ['scheduled', 'deferred'].includes(current.state)
            ? { ...current, state: 'cancelled', cancellationReason: reason, updatedAt: now() } : undefined));
        if (updated?.state === 'cancelled' && updated.cancellationReason === reason) {
            await journal.appendEvent(updated.orderKey, 'reminder.cancelled', { reason });
        }
        return updated;
    }

    // Вызывается исполнителем после каждого чтения заказа.
    async function observeOrder({ order }) {
        if (!order?.accountId) return null;
        const settings = reminderSettings(await getSettings());
        const existing = await journal.getRecord('reminders', taskKey(order.accountId, order.orderId));
        const baseline = await baselineFor(order.accountId);
        const blocker = reminderBlocker(order, settings, baseline?.active ? baseline : null);
        if (existing) {
            // Отзыв, возврат, проблема или неясная выдача отменяют задачу; исправление её не возобновляет.
            if (['review', 'refund', 'problem', 'delivery-uncertain'].includes(blocker)) await cancelForOrder(order.accountId, order.orderId, blocker);
            return existing;
        }
        if (!settings.enabled || blocker) return null;
        const dueAt = Math.max(order.verifiedFulfillmentCompletedAt, order.fpConfirmedAt) + settings.delayMs;
        const task = {
            key: taskKey(order.accountId, order.orderId), accountId: order.accountId, orderId: order.orderId, orderKey: order.key,
            chatId: order.chatId, buyerName: order.buyerName || null, lotName: order.lotName || '', offerId: order.offerId || order.lotId || null,
            state: 'scheduled', dueAt, expiresAt: dueAt + settings.expiryMs, nextCheckAt: dueAt, createdAt: now(), updatedAt: now()
        };
        // Повторные события не создают вторую задачу и не сдвигают dueAt.
        const saved = await journal.updateRecord('reminders', task.key, current => current || task);
        await scheduleNext();
        return saved;
    }

    async function defer(task, until, reason) {
        // Ручное напоминание отправляется сейчас или не отправляется вовсе — без висящих задач.
        if (task.manual) return finish(task, 'cancelled', reason);
        if (until >= task.expiresAt) return finish(task, 'cancelled', reason === 'review-unknown' ? 'expired' : reason);
        return journal.updateRecord('reminders', task.key, current => ({ ...current, state: 'deferred', nextCheckAt: until, deferReason: reason, updatedAt: now() }));
    }

    function finish(task, state, reason = null) {
        return journal.updateRecord('reminders', task.key, current => ({ ...current, state, cancellationReason: reason, updatedAt: now() }));
    }

    // Атомарно: проверка и резерв лимита чата + перевод задачи в sending.
    async function reserve(task, settings) {
        return journal.transact(['reminders'], async tx => {
            const current = await tx.get('reminders', task.key);
            if (!current || !['scheduled', 'deferred'].includes(current.state)) return { ok: false, reason: 'state' };
            const cap = await tx.get('reminders', capKey(task.accountId, task.chatId));
            if (cap && now() - cap.reservedAt < settings.chatCapMs && cap.orderId !== task.orderId) {
                return { ok: false, reason: 'chat-cap', until: cap.reservedAt + settings.chatCapMs };
            }
            const attemptId = `ra-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            await tx.put('reminders', { key: capKey(task.accountId, task.chatId), accountId: task.accountId, chatId: task.chatId, orderId: task.orderId, reservedAt: now(), attemptId, state: 'reserved' });
            await tx.put('reminders', { ...current, state: 'sending', attemptId, owner: journal.owner, attemptAt: now(), updatedAt: now() });
            return { ok: true, attemptId };
        });
    }

    async function processTask(task, account, settings) {
        if (now() >= task.expiresAt) return finish(task, 'cancelled', 'expired');
        if (task.accountId !== account.accountId) return null; // другой аккаунт — ждёт своего входа
        const order = task.orderKey ? await journal.getRecord('accountOrders', task.orderKey) : null;
        const blocker = task.manual ? manualReminderBlocker(order)
            : (order ? reminderBlocker(order, settings, { enabledFrom: 1 }) : 'verify-failed');
        if (blocker && blocker !== 'before-enable') return finish(task, 'cancelled', blocker);
        const facts = await loadFacts(task.orderId, { accountId: account.accountId, epoch: account.epoch, fresh: true });
        const verdict = verifyOrderForEffect(facts, { accountId: account.accountId, effect: 'reminder', expectedOrderId: task.orderId });
        if (!verdict.ok) {
            if (verdict.reasons.includes('status-refunded')) return finish(task, 'cancelled', 'refund');
            return defer(task, now() + 3 * HOUR, 'verify-failed');
        }
        if (verdict.chatId !== String(task.chatId)) return finish(task, 'cancelled', 'verify-failed');
        if (facts.review.presence === 'present') return finish(task, 'cancelled', 'review');
        if (facts.review.presence !== 'absent') return defer(task, now() + HOUR, 'review-unknown');
        if (await isBlacklisted(facts.buyerUsername || task.buyerName, 'response')) return finish(task, 'cancelled', 'blacklist');

        const reserved = await reserve(task, settings);
        if (!reserved.ok) {
            if (reserved.reason === 'chat-cap') return defer(task, reserved.until, 'chat-cap');
            return null;
        }
        const text = renderReminder(settings.text, { orderId: task.orderId, buyerName: facts.buyerUsername || task.buyerName, lotName: task.lotName });
        try {
            await guard.assertCurrent(account);
        } catch (_) {
            await journal.updateRecord('reminders', capKey(task.accountId, task.chatId), current => (current?.attemptId === reserved.attemptId ? null : undefined));
            if (task.manual) return finish(task, 'cancelled', 'account-changed');
            return journal.updateRecord('reminders', task.key, current => ({ ...current, state: 'deferred', nextCheckAt: now() + HOUR, deferReason: 'account-changed' }));
        }
        const bodyHash = await hash(`${task.chatId}\n${text}`);
        await journal.updateRecord('reminders', task.key, current => ({ ...current, bodyHash }));
        const result = await sender.send({ chatId: task.chatId, text, auth: await getAuth(), accountId: account.accountId });
        const state = result.status === 'confirmed' || result.status === 'accepted' ? 'sent' : result.status === 'rejected' ? 'failed' : 'uncertain';
        if (state === 'failed') {
            // Доказанный отказ до отправки — лимит чата освобождается.
            await journal.updateRecord('reminders', capKey(task.accountId, task.chatId), current => (current?.attemptId === reserved.attemptId ? null : undefined));
        }
        if (task.orderKey) await journal.appendEvent(task.orderKey, 'reminder.result', { summary: state, receipt: result.status, manual: task.manual === true });
        return journal.updateRecord('reminders', task.key, current => ({
            ...current, state, receipt: { status: result.status, messageId: result.messageId || null, at: now() }, error: result.error || null, updatedAt: now()
        }));
    }

    async function runOnce() {
        const settings = reminderSettings(await getSettings());
        const account = await guard.current({ fresh: true });
        if (!settings.enabled || !account.accountId) return { skipped: true };
        const due = (await journal.listRecords('reminders'))
            .filter(task => task.key.startsWith('review-reminder:') && !task.manual && ['scheduled', 'deferred'].includes(task.state) && (task.nextCheckAt ?? task.dueAt) <= now())
            .sort((a, b) => a.dueAt - b.dueAt);
        let sends = 0;
        const results = [];
        for (const task of due) {
            if (sends >= MAX_SENDS_PER_RUN) break;
            try {
                const outcome = await processTask(task, account, settings);
                if (outcome?.state && ['sent', 'failed', 'uncertain'].includes(outcome.state)) sends += 1;
                results.push({ orderId: task.orderId, state: outcome?.state || task.state });
            } catch (error) {
                log.warn?.(`FunPay Funcy: напоминание по заказу #${task.orderId} не обработано:`, error?.message || error);
                results.push({ orderId: task.orderId, error: error?.message || String(error) });
            }
        }
        await scheduleNext();
        return { results };
    }

    function run() {
        if (!running) running = exclusive(runOnce).finally(() => { running = null; });
        return running;
    }

    async function scheduleNext() {
        if (!scheduler) return null;
        const pending = (await journal.listRecords('reminders'))
            .filter(task => task.key.startsWith('review-reminder:') && !task.manual && ['scheduled', 'deferred'].includes(task.state));
        if (!pending.length) { await scheduler.clearDue(REMINDER_ALARM).catch(() => {}); return null; }
        const next = Math.max(now() + 60 * 1000, Math.min(...pending.map(task => task.nextCheckAt ?? task.dueAt)));
        await scheduler.scheduleDue(REMINDER_ALARM, next);
        return next;
    }

    // Отправки, прерванные остановкой worker, — неясный исход без повтора.
    async function recover() {
        for (const task of await journal.listRecords('reminders')) {
            if (task.state !== 'sending' || task.owner === journal.owner) continue;
            await journal.updateRecord('reminders', task.key, current => (current?.state === 'sending' && current.owner !== journal.owner
                ? { ...current, state: 'uncertain', error: 'Отправка прервана остановкой расширения.', updatedAt: now() } : undefined));
        }
    }

    async function list() {
        const account = await guard.current();
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        const tasks = (await journal.listRecords('reminders'))
            .filter(task => task.key.startsWith('review-reminder:') && task.accountId === account.accountId)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const counts = {};
        for (const task of tasks) counts[task.state] = (counts[task.state] || 0) + 1;
        const baseline = await baselineFor(account.accountId);
        // Предпросмотр: почему недавние заказы не получат напоминание.
        const settings = reminderSettings(await getSettings());
        const recent = (await journal.listAccountOrders({ accountId: account.accountId }))
            .filter(order => !tasks.some(task => task.orderId === order.orderId))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 15)
            .map(order => ({ orderId: order.orderId, lotName: order.lotName || '', reason: REMINDER_REASON_TEXT[reminderBlocker(order, settings, baseline?.active ? baseline : null)] || 'Будет запланировано при следующей проверке' }));
        return {
            baseline, counts,
            tasks: tasks.slice(0, 100).map(task => ({
                key: task.key, orderId: task.orderId, lotName: task.lotName, buyerName: task.buyerName, state: task.state, dueAt: task.dueAt, manual: task.manual === true,
                expiresAt: task.expiresAt, nextCheckAt: task.nextCheckAt, reason: REMINDER_REASON_TEXT[task.cancellationReason || task.deferReason] || task.cancellationReason || task.deferReason || null
            })),
            recent
        };
    }

    async function cancel({ key }) {
        const account = await guard.current();
        const task = await journal.getRecord('reminders', key);
        if (!task || task.accountId !== account.accountId) throw new Error('Задача не найдена.');
        const updated = await journal.updateRecord('reminders', key, current => (['scheduled', 'deferred'].includes(current?.state)
            ? { ...current, state: 'cancelled', cancellationReason: 'seller', updatedAt: now() } : undefined));
        await scheduleNext();
        return updated;
    }

    // Завершённые заказы, по которым точно нет отзыва: журнал + первые страницы продаж.
    // Отзыв проверяется по свежей странице заказа и кешируется отдельной записью —
    // проекция заказа (accountOrders) не меняется, выдача и сверка этого не видят.
    async function candidates({ refresh = false, limit = 20 } = {}) {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        const accountId = account.accountId;
        const rows = new Map();
        for (const order of await journal.listAccountOrders({ accountId })) {
            if (order.fpStatus !== 'closed') continue;
            rows.set(order.orderId, {
                orderId: order.orderId, lotName: order.lotName || '', buyerName: order.buyerName || null,
                offerId: order.offerId || order.lotId || null, orderDate: order.purchasedAt || order.firstSeenAt || null, price: null, currency: ''
            });
        }
        let salesError = null;
        if (typeof fetchSalesPage === 'function') {
            let token = null;
            for (let page = 0; page < SALES_PAGES; page += 1) {
                let result;
                try { result = await fetchSalesPage(token); } catch (error) { salesError = error?.message || String(error); break; }
                for (const row of result?.orders || []) {
                    if (!row?.orderId) continue;
                    const orderId = String(row.orderId).toUpperCase();
                    if (row.orderStatus !== 'closed') { rows.delete(orderId); continue; }
                    const known = rows.get(orderId) || {};
                    rows.set(orderId, {
                        ...known, orderId, lotName: row.description || known.lotName || '', buyerName: row.buyerUsername || known.buyerName || null,
                        offerId: known.offerId || null, orderDate: toTimestamp(row.orderDate) ?? known.orderDate ?? null,
                        price: Number(row.price) > 0 ? Number(row.price) : null, currency: row.currency && row.currency !== 'UNKNOWN' ? row.currency : ''
                    });
                }
                const next = result?.nextOrderId || null;
                if (!next || next === token) break;
                token = next;
            }
        }

        const recent = [...rows.values()].sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0)).slice(0, MAX_CANDIDATES);
        const ttl = refresh ? CHECK_TTL_REFRESH : CHECK_TTL;
        const checks = new Map();
        for (const row of recent) checks.set(row.orderId, await journal.getRecord('reminders', checkKey(accountId, row.orderId)));
        const stale = check => check.presence !== 'present' && check.status !== 'refunded' && now() - (check.checkedAt || 0) > ttl;
        // Сначала ни разу не проверенные, потом устаревшие — от новых к старым.
        const toCheck = [
            ...recent.filter(row => !checks.get(row.orderId)),
            ...recent.filter(row => checks.get(row.orderId) && stale(checks.get(row.orderId)))
        ];
        let checked = 0;
        let failed = 0;
        for (const row of toCheck) {
            if (checked >= limit) break;
            checked += 1;
            let facts;
            try { facts = await loadFacts(row.orderId, { accountId, epoch: account.epoch, fresh: true }); }
            catch (_) { failed += 1; continue; }
            const verdict = verifyOrderForEffect(facts, { accountId, effect: 'reminder', expectedOrderId: row.orderId });
            const record = {
                key: checkKey(accountId, row.orderId), accountId, orderId: row.orderId,
                presence: facts?.review?.presence || 'unknown', status: facts?.status || 'unknown',
                offerId: facts?.lotId || row.offerId || null, lotName: facts?.lotName || row.lotName || '',
                buyerName: facts?.buyerUsername || row.buyerName || null, chatId: facts?.buyerChatId || null,
                eligible: verdict.ok, problem: verdict.ok ? null : describeReasons(verdict.reasons)[0] || null, checkedAt: now()
            };
            await journal.putRecord('reminders', record);
            checks.set(row.orderId, record);
        }

        const tasks = new Map((await journal.listRecords('reminders'))
            .filter(task => task.key.startsWith(`review-reminder:${accountId}:`)).map(task => [task.orderId, task]));
        const orders = [];
        let unknown = 0;
        for (const row of recent) {
            const check = checks.get(row.orderId);
            if (!check || check.status === 'refunded' || check.presence === 'present') continue;
            if (check.presence !== 'absent') { unknown += 1; continue; }
            const task = tasks.get(row.orderId);
            orders.push({
                orderId: row.orderId, lotName: check.lotName || row.lotName, offerId: check.offerId || row.offerId || null,
                buyerName: check.buyerName || row.buyerName, orderDate: row.orderDate, price: row.price, currency: row.currency,
                eligible: check.eligible === true, problem: check.problem || null, checkedAt: check.checkedAt,
                reminder: task ? { state: task.state, manual: task.manual === true, reason: REMINDER_REASON_TEXT[task.cancellationReason] || null } : null
            });
        }
        const lots = new Map();
        const buyers = new Map();
        for (const order of orders) {
            if (order.offerId) {
                const id = String(order.offerId);
                const lot = lots.get(id) || { offerId: id, title: order.lotName || `Лот #${id}`, count: 0 };
                lot.count += 1;
                lots.set(id, lot);
            }
            if (order.buyerName) {
                const buyer = buyers.get(order.buyerName) || { name: order.buyerName, count: 0 };
                buyer.count += 1;
                buyers.set(order.buyerName, buyer);
            }
        }
        const byCount = key => (a, b) => b.count - a.count || String(a[key]).localeCompare(String(b[key]), 'ru');
        return {
            orders,
            lots: [...lots.values()].sort(byCount('title')),
            buyers: [...buyers.values()].sort(byCount('name')),
            pending: toCheck.length - checked, unknown, failed, salesError, checkedAt: now()
        };
    }

    async function sendManualOnce(orderIds) {
        const settings = reminderSettings(await getSettings());
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        const results = [];
        for (const orderId of orderIds) {
            const key = taskKey(account.accountId, orderId);
            const check = await journal.getRecord('reminders', checkKey(account.accountId, orderId));
            if (!check || check.presence !== 'absent' || !check.chatId) {
                results.push({ orderId, state: 'skipped', reason: 'Заказ не проверен — обновите список' });
                continue;
            }
            const order = await journal.getAccountOrder(account.accountId, orderId);
            const at = now();
            const task = {
                key, accountId: account.accountId, orderId, orderKey: order?.key || null, chatId: check.chatId,
                buyerName: check.buyerName || null, lotName: check.lotName || '', offerId: check.offerId || null, manual: true,
                state: 'scheduled', dueAt: at, expiresAt: at + MANUAL_TTL, nextCheckAt: at, createdAt: at, updatedAt: at
            };
            // Отправленное или с неясным исходом не повторяем; отменённое можно отправить вручную.
            let created = false;
            const saved = await journal.updateRecord('reminders', key, current => {
                if (current && !['cancelled', 'expired', 'failed'].includes(current.state)) return undefined;
                created = true;
                return task;
            });
            if (!created) {
                const current = saved || await journal.getRecord('reminders', key);
                results.push({ orderId, state: 'skipped', reason: current?.state === 'sent' ? 'Напоминание уже отправлено' : 'По заказу уже есть напоминание' });
                continue;
            }
            try {
                const outcome = await processTask(task, account, settings);
                const code = outcome?.cancellationReason || outcome?.deferReason || null;
                results.push({ orderId, state: outcome?.state || 'skipped', reason: REMINDER_REASON_TEXT[code] || code });
            } catch (error) {
                await journal.updateRecord('reminders', key, current => (current && ['scheduled', 'deferred'].includes(current.state)
                    ? { ...current, state: 'cancelled', cancellationReason: 'verify-failed', updatedAt: now() } : undefined));
                results.push({ orderId, state: 'failed', reason: error?.message || String(error) });
            }
        }
        return { results };
    }

    function sendManual({ orderIds } = {}) {
        const ids = [...new Set((Array.isArray(orderIds) ? orderIds : []).map(id => String(id).trim().toUpperCase()).filter(id => /^[A-Z0-9]+$/.test(id)))];
        if (!ids.length) return Promise.reject(new Error('Не выбраны заказы.'));
        if (ids.length > MAX_MANUAL_PER_CALL) return Promise.reject(new Error(`За раз можно напомнить не больше чем по ${MAX_MANUAL_PER_CALL} заказам.`));
        return exclusive(() => sendManualOnce(ids));
    }

    return Object.freeze({ observeOrder, onSettingsChanged, run, recover, list, cancel, scheduleNext, candidates, sendManual });
}
