import { computeAdjustedPrice } from './lot_writer.js';

// Валютные предложения (chips) не имеют формы offerEdit: все серверы раздела
// сохраняются одной формой chips/<node>/trade → chips/saveOffers.
// ID предложения: <аккаунт>-<игра>-<раздел>-<сервер>[-<сторона>...],
// поля строки в форме — offers[<сервер>][<сторона>...][price|amount|active].
export function parseChipOfferId(offerId) {
    const parts = String(offerId || '').trim().split('-');
    if (parts.length < 4 || !parts.every(p => /^\d+$/.test(p))) return null;
    return {
        accountId: parts[0],
        nodeId: parts[2],
        key: 'offers' + parts.slice(3).map(p => `[${p}]`).join('')
    };
}

// fields — пары [name, value] формы. Возвращает новые пары и итоговую цену.
export function applyChipOp(fields, key, op) {
    const priceName = `${key}[price]`, activeName = `${key}[active]`;
    const priceEntry = fields.find(([name]) => name === priceName);
    if (!priceEntry) throw new Error('Предложение не найдено в форме валюты — обновите список лотов.');
    let next = fields.map(([name, value]) => [name, value]);
    let price = priceEntry[1];
    if (op?.type === 'setActive') {
        next = next.filter(([name]) => name !== activeName);
        if (op.active) next.push([activeName, 'on']);
    } else if (op?.type === 'setPrice' || op?.type === 'adjustPrice') {
        price = op.type === 'setPrice'
            ? String(op.price ?? '')
            : computeAdjustedPrice(priceEntry[1], { mode: op.mode, value: op.value, round: op.round, min: op.min ?? null, max: op.max ?? null });
        if (!price || !(Number(price) > 0)) throw new Error('Не удалось вычислить новую цену.');
        next = next.map(([name, value]) => [name, name === priceName ? price : value]);
    } else {
        throw new Error('Для валютных предложений доступны только цена и включение/отключение.');
    }
    return { fields: next, price, active: next.some(([name]) => name === activeName) };
}

export function createChipWriter({ guard, readTrade, saveTrade }) {
    // Форма раздела сохраняется целиком, поэтому записи в один раздел строго по очереди.
    const chains = new Map();

    async function write({ offerId, op, expectedAccountId = null }) {
        const chip = parseChipOfferId(offerId);
        if (!chip) throw new Error('Некорректный ID валютного предложения.');
        const account = await guard.current({ fresh: true });
        if (!account.accountId) throw new Error('Аккаунт FunPay не определён.');
        if ((expectedAccountId && String(expectedAccountId) !== account.accountId) || chip.accountId !== account.accountId) {
            throw Object.assign(new Error('Страница открыта под другим аккаунтом FunPay — обновите её.'), { code: 'account-changed' });
        }
        const chainKey = `${account.accountId}:${chip.nodeId}`;
        const run = (chains.get(chainKey) || Promise.resolve()).catch(() => {}).then(async () => {
            const fields = await readTrade(chip.nodeId);
            const result = applyChipOp(fields, chip.key, op);
            await guard.assertCurrent(account);
            await saveTrade(result.fields);
            return { status: 'saved', price: result.price, active: result.active };
        });
        chains.set(chainKey, run);
        try { return await run; }
        finally { if (chains.get(chainKey) === run) chains.delete(chainKey); }
    }

    return Object.freeze({ write });
}
