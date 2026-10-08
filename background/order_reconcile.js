/*
 * FunPay Funcy — сверка заказов.
 *
 * Автоответчик видит только последнее сообщение чата: событие об оплате может
 * потеряться. Сверка:
 *   1) сначала проходит сохранённую очередь известных, но не выданных оплаченных
 *      заказов (они могут уйти далеко за первую страницу продаж);
 *   2) затем читает страницы продаж с продолжением (continue), пока не встретит
 *      заказы старше границы прошлого прохода, с ограничением числа страниц
 *      и защитой от зацикленного курсора.
 *
 * Первый проход для аккаунта только запоминает границу (baseline): заказы до неё
 * наблюдаются, но автоматически не исполняются (adopted = false).
 */

const BASELINE_PREFIX = 'reconcileBaseline:';
const OVERLAP_MS = 30 * 60 * 1000;

function toTimestamp(value) {
    const time = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(time) ? time : null;
}

export function createOrderReconcile({
    journal, guard, fetchSalesPage, dispatcher, now = () => Date.now(),
    maxPages = 4, maxObserves = 5, retryDelayMs = 10 * 60 * 1000, log = console
} = {}) {
    if (!journal || !guard || typeof fetchSalesPage !== 'function' || !dispatcher) throw new Error('Сверка заказов не настроена.');
    let running = null;

    async function observe(orderId, budget, extra = {}) {
        if (budget.left <= 0) return null;
        budget.left -= 1;
        return dispatcher.observe({ orderId, source: 'reconcile', ...extra });
    }

    async function runOnce() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) return { skipped: 'account' };
        const baselineKey = `${BASELINE_PREFIX}${account.accountId}`;
        const baseline = await journal.getMeta(baselineKey);
        const budget = { left: maxObserves };
        const result = { seeded: 0, queued: 0, pages: 0, found: 0 };

        if (!baseline) {
            const { orders = [] } = await fetchSalesPage(null);
            for (const row of orders) {
                if (!row?.orderId) continue;
                await journal.recordAccountOrder({
                    accountId: account.accountId, orderId: row.orderId, source: 'seed', fpStatus: row.orderStatus,
                    buyerName: row.buyerUsername, lotName: row.description, purchasedAt: toTimestamp(row.orderDate)
                });
                result.seeded += 1;
            }
            await journal.setMeta(baselineKey, { at: now(), scannedAt: now() });
            return result;
        }

        // 1. Очередь известных невыданных заказов — независимо от первой страницы.
        const open = (await journal.listAccountOrders({ accountId: account.accountId }))
            .filter(order => order.adopted === true && order.fpStatus === 'paid'
                && ['none', 'blocked', 'pending', 'failed'].includes(order.deliveryState)
                && (!order.nextCheckAt || order.nextCheckAt <= now()))
            .sort((a, b) => (a.nextCheckAt || 0) - (b.nextCheckAt || 0));
        for (const order of open) {
            if (budget.left <= 0) break;
            await journal.updateAccountOrder(order.key, () => ({ nextCheckAt: now() + retryDelayMs }));
            await observe(order.orderId, budget);
            result.queued += 1;
        }

        // 2. Страницы продаж до границы прошлого прохода.
        const border = (baseline.scannedAt || baseline.at) - OVERLAP_MS;
        const seenTokens = new Set();
        let token = null;
        for (let page = 0; page < maxPages; page += 1) {
            const { orders = [], nextOrderId = null } = await fetchSalesPage(token);
            result.pages += 1;
            let reachedBorder = !orders.length;
            for (const row of orders) {
                if (!row?.orderId) continue;
                const at = toTimestamp(row.orderDate);
                if (at !== null && at < border) reachedBorder = true;
                const known = await journal.getAccountOrder(account.accountId, row.orderId);
                if (known) {
                    if (row.orderStatus && known.fpStatus !== row.orderStatus && known.fpStatus !== 'refunded') {
                        await journal.recordAccountOrder({ accountId: account.accountId, orderId: row.orderId, source: 'reconcile', fpStatus: row.orderStatus });
                    }
                    continue;
                }
                // Новый для журнала заказ после границы baseline — пропущенное событие.
                const fresh = at !== null && at >= baseline.at && row.orderStatus === 'paid';
                await journal.recordAccountOrder({
                    accountId: account.accountId, orderId: row.orderId, source: 'reconcile', fpStatus: row.orderStatus,
                    buyerName: row.buyerUsername, lotName: row.description, purchasedAt: at, adopted: fresh ? true : undefined
                });
                if (fresh) {
                    result.found += 1;
                    await observe(row.orderId, budget, { adopt: true });
                }
            }
            if (reachedBorder || !nextOrderId || seenTokens.has(nextOrderId) || nextOrderId === token) break;
            seenTokens.add(nextOrderId);
            token = nextOrderId;
        }
        await journal.setMeta(baselineKey, { ...baseline, scannedAt: now() });
        return result;
    }

    function run() {
        if (!running) {
            running = runOnce()
                .catch(error => { log.warn?.('FunPay Funcy: сверка заказов не удалась:', error?.message || error); throw error; })
                .finally(() => { running = null; });
        }
        return running;
    }

    return Object.freeze({ run });
}
