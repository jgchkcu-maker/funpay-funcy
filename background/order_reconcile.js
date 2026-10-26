/* Bounded, account-scoped sales scan. Checkpoints never advance the completed border. */
const BASELINE_PREFIX = 'reconcileBaseline:';
const OVERLAP_MS = 30 * 60 * 1000;

export function createOrderReconcile({
    journal, guard, fetchSalesPage, dispatcher, now = () => Date.now(),
    maxPages = 4, maxObserves = 10, maxRunMs = 20000,
    retryDelayMs = 10 * 60 * 1000, log = console
} = {}) {
    if (!journal || !guard || typeof fetchSalesPage !== 'function' || !dispatcher) throw new Error('Сверка заказов не настроена.');
    let running = null;
    async function runOnce() {
        const account = await guard.current({ fresh: true });
        if (!account.accountId) return { skipped: 'account' };
        const checkAccount = async () => {
            const current = await guard.current({ fresh: true });
            if (current.accountId !== account.accountId || current.epoch !== account.epoch) throw new Error('Аккаунт сменился во время сверки.');
        };
        const key = `${BASELINE_PREFIX}${account.accountId}`;
        let baseline = await journal.getMeta(key);
        const started = now();
        const result = { seeded: 0, queued: 0, pages: 0, found: 0, incomplete: false };
        if (!baseline) {
            const { orders = [], error } = await fetchSalesPage(null);
            if (error) throw new Error(error);
            await checkAccount();
            for (const row of orders) {
                if (!row?.orderId) continue;
                await journal.recordAccountOrder({ accountId: account.accountId, orderId: row.orderId, source: 'seed', fpStatus: row.orderStatus,
                    buyerName: row.buyerUsername, lotName: row.description, purchasedAt: row.orderDateStrict ?? undefined });
                result.seeded++;
            }
            await journal.setMeta(key, { at: started, scannedAt: started, accountId: account.accountId });
            return result;
        }
        let budget = maxObserves;
        const observe = async orderId => {
            await checkAccount();
            budget--;
            await dispatcher.observe({ orderId, source: 'reconcile', adopt: true });
        };
        const scan = baseline.scan || { accountId: account.accountId, startedAt: started,
            border: (baseline.scannedAt || baseline.at) - OVERLAP_MS, nextOrderId: null, offset: 0, seen: [] };
        if (scan.accountId !== account.accountId) throw new Error('Неверная область курсора сверки.');
        const save = async () => {
            await checkAccount();
            await journal.setMeta(key, { ...baseline, scan });
            result.incomplete = true;
            return result;
        };
        // Reserve at least half the budget for new pages so the retry queue cannot starve scanning.
        const open = (await journal.listAccountOrders({ accountId: account.accountId }))
            .filter(o => o.adopted === true && o.fpStatus === 'paid' && ['none', 'blocked', 'pending', 'failed'].includes(o.deliveryState)
                && (!o.nextCheckAt || o.nextCheckAt <= now()))
            .sort((a, b) => (a.nextCheckAt || 0) - (b.nextCheckAt || 0));
        for (const order of open.slice(0, Math.floor(maxObserves / 2))) {
            if (now() - started >= maxRunMs) return save();
            await journal.updateAccountOrder(order.key, () => ({ nextCheckAt: now() + retryDelayMs }));
            await observe(order.orderId); result.queued++;
        }
        for (let page = 0; page < maxPages; page++) {
            if (now() - started >= maxRunMs || budget <= 0) return save();
            const { orders = [], nextOrderId = null, error } = await fetchSalesPage(scan.nextOrderId);
            if (error) throw new Error(error);
            await checkAccount(); result.pages++;
            let reachedBorder = !orders.length;
            // Offset is safe only for a stable continuation page. The first page can gain rows;
            // re-read it and let the journal deduplicate rather than skipping by numeric offset.
            const offset = scan.nextOrderId ? scan.offset : 0;
            for (let index = offset; index < orders.length; index++) {
                if (budget <= 0 || now() - started >= maxRunMs) { scan.offset = index; return save(); }
                const row = orders[index];
                if (!row?.orderId) continue;
                const at = typeof row.orderDateStrict === 'number' && Number.isFinite(row.orderDateStrict) ? row.orderDateStrict : null;
                const precision = Number(row.orderDatePrecisionMs) || 60000;
                if (at !== null && at + precision <= scan.border) reachedBorder = true;
                const known = await journal.getAccountOrder(account.accountId, row.orderId);
                const fresh = at !== null && at > baseline.at && row.orderStatus === 'paid';
                if (!known) {
                    const ambiguous = row.orderStatus === 'paid' && (at === null || (at <= baseline.at && at + precision > baseline.at));
                    await journal.recordAccountOrder({ accountId: account.accountId, orderId: row.orderId, source: 'reconcile', fpStatus: row.orderStatus,
                        buyerName: row.buyerUsername, lotName: row.description, purchasedAt: at ?? undefined,
                        adopted: fresh ? true : undefined, problemState: ambiguous ? 'attention' : undefined,
                        blockReasons: ambiguous ? [at === null ? 'order-date-unknown' : 'order-date-boundary'] : [] });
                    if (fresh) { await observe(row.orderId); result.found++; }
                } else if (row.orderStatus && known.fpStatus !== 'refunded' && known.fpStatus !== row.orderStatus) {
                    await journal.recordAccountOrder({ accountId: account.accountId, orderId: row.orderId, source: 'reconcile', fpStatus: row.orderStatus });
                }
                scan.offset = index + 1;
            }
            if (reachedBorder || !nextOrderId) {
                await checkAccount();
                await journal.setMeta(key, { ...baseline, scannedAt: scan.startedAt, scan: null, lastError: null });
                result.incomplete = false;
                return result;
            }
            if (String(nextOrderId) === String(scan.nextOrderId) || scan.seen.includes(String(nextOrderId))) {
                // Retain the completed border; restart from the front on a later pass.
                await journal.setMeta(key, { ...baseline, scan: null, lastError: 'Повтор курсора продаж', failedAt: now() });
                throw new Error('Повтор курсора продаж: обход не завершён.');
            }
            scan.seen.push(String(nextOrderId)); scan.nextOrderId = nextOrderId; scan.offset = 0;
            await save();
        }
        return save();
    }
    function run() {
        if (!running) running = runOnce().catch(error => { log.warn?.('Funcy: сверка заказов:', error?.message || error); throw error; }).finally(() => { running = null; });
        return running;
    }
    return Object.freeze({ run });
}
