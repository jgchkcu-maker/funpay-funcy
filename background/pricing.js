/*
 * FunPay Funcy — расчёт цен лота от себестоимости.
 *
 * Продавцу FunPay поступает указанная им цена (комиссия покупателя сверху и
 * повторно не вычитается). Для подтверждённой себестоимости C, цены продавца S и
 * явных переменных расходов E(S) = fixed + rate·S чистая прибыль N = S − C − E(S).
 * Минимальная безопасная цена (floor) одновременно даёт N ≥ minProfit и N/S ≥ minMargin:
 *     S ≥ (C + fixed + minProfit) / (1 − rate)
 *     S ≥ (C + fixed) / (1 − rate − minMargin)
 * Наценка и маржа — разные вещи: наценка 25% даёт маржу 20%.
 *
 * Итог округляется вверх до шага и проверяется повторно. Потолок ниже floor —
 * безопасной цены нет: это блокировка новых продаж, а не повод продавать в убыток.
 * Неизвестная себестоимость — не ноль: такой лот пропускается.
 *
 * Все суммы — десятичные строки (money.js) в одной валюте лота.
 */

import { parseDecimal, formatDecimal, compareDecimal, addDecimal, subDecimal, mulDecimal, divDecimal, roundToQuantum } from './money.js';

const PERCENT_QUANTUM = '0.0000000001';

function dec(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseDecimal(value, { allowComma: true });
    return parsed ? formatDecimal(parsed) : fallback;
}

function percent(value) {
    const parsed = dec(value, '0');
    return divDecimal(parsed, '100', { quantum: PERCENT_QUANTUM });
}

function max(a, b) {
    return compareDecimal(a, b) >= 0 ? a : b;
}

export function validatePricingRule(rule) {
    const errors = [];
    if (!['markup', 'margin'].includes(rule?.mode)) errors.push('Выберите наценку или маржу.');
    const value = dec(rule?.value);
    if (value === null || compareDecimal(value, '0') < 0) errors.push('Укажите размер наценки или маржи.');
    if (rule?.mode === 'margin' && value !== null && compareDecimal(value, '100') >= 0) errors.push('Маржа должна быть меньше 100%.');
    for (const [field, label] of [['minProfit', 'Минимальная прибыль'], ['step', 'Шаг цены'], ['ceiling', 'Потолок'], ['fixedFee', 'Фиксированный расход']]) {
        const raw = rule?.[field];
        if (raw !== null && raw !== undefined && raw !== '' && dec(raw) === null) errors.push(`${label}: некорректное число.`);
    }
    if (rule?.step && dec(rule.step) !== null && compareDecimal(dec(rule.step), '0') <= 0) errors.push('Шаг цены должен быть положительным.');
    const rate = dec(rule?.feePercent, '0');
    const margin = dec(rule?.minMarginPercent, '0');
    if (compareDecimal(addDecimal(rate, margin), '100') >= 0) errors.push('Процент расходов и минимальная маржа вместе должны быть меньше 100%.');
    return errors;
}

// Минимальная безопасная цена или null, если ограничения несовместимы.
export function computeFloor({ cost, minProfit = '0', minMarginPercent = '0', fixedFee = '0', feePercent = '0' }) {
    const c = dec(cost);
    if (c === null) return null;
    const fixed = dec(fixedFee, '0');
    const rate = percent(feePercent);
    const margin = percent(minMarginPercent);
    const oneMinusRate = subDecimal('1', rate);
    const oneMinusAll = subDecimal(oneMinusRate, margin);
    if (compareDecimal(oneMinusRate, '0') <= 0 || compareDecimal(oneMinusAll, '0') <= 0) return null;
    const byProfit = divDecimal(addDecimal(addDecimal(c, fixed), dec(minProfit, '0')), oneMinusRate, { quantum: PERCENT_QUANTUM, mode: 'ceil' });
    const byMargin = divDecimal(addDecimal(c, fixed), oneMinusAll, { quantum: PERCENT_QUANTUM, mode: 'ceil' });
    return max(byProfit, byMargin);
}

export function netProfit({ price, cost, fixedFee = '0', feePercent = '0' }) {
    const s = dec(price);
    const c = dec(cost);
    if (s === null || c === null) return null;
    const expenses = addDecimal(dec(fixedFee, '0'), mulDecimal(s, percent(feePercent)));
    return subDecimal(subDecimal(s, c), expenses);
}

function satisfies(price, input) {
    const n = netProfit({ price, ...input });
    if (n === null) return false;
    if (compareDecimal(n, dec(input.minProfit, '0')) < 0) return false;
    const margin = percent(input.minMarginPercent);
    return compareDecimal(n, mulDecimal(price, margin)) >= 0;
}

// Целевая цена по правилу для одного лота. Возвращает решение с причинами.
// rule: { mode, value, minProfit, minMarginPercent, fixedFee, feePercent, step, ceiling, allowRaise }
export function priceForLot({ cost, currentPrice, rule, quantum = '0.01' }) {
    const c = dec(cost);
    const current = dec(currentPrice);
    if (c === null) return { action: 'skip', reasons: ['Себестоимость неизвестна.'] };
    const input = { cost: c, minProfit: rule.minProfit, minMarginPercent: rule.minMarginPercent, fixedFee: rule.fixedFee, feePercent: rule.feePercent };
    const floorRaw = computeFloor(input);
    if (floorRaw === null) return { action: 'block', reasons: ['Ограничения прибыли несовместимы.'] };

    const step = dec(rule.step) || quantum;
    const fixed = dec(rule.fixedFee, '0');
    const rate = percent(rule.feePercent);
    let desired;
    if (rule.mode === 'margin') {
        // N/S = m: S = (C + fixed) / (1 − rate − m)
        const denominator = subDecimal(subDecimal('1', rate), percent(rule.value));
        if (compareDecimal(denominator, '0') <= 0) return { action: 'block', reasons: ['Маржа недостижима при таких расходах.'] };
        desired = divDecimal(addDecimal(c, fixed), denominator, { quantum: PERCENT_QUANTUM, mode: 'ceil' });
    } else {
        desired = mulDecimal(c, addDecimal('1', percent(rule.value)));
    }
    let target = roundToQuantum(max(desired, floorRaw), step, 'ceil');
    // Округление вверх могло только помочь, но проверяем ограничения на итоговой цене.
    for (let guard = 0; !satisfies(target, input); guard += 1) {
        if (guard > 1000) return { action: 'block', reasons: ['Не удалось подобрать цену с таким шагом.'] };
        target = addDecimal(target, step);
    }
    const floor = roundToQuantum(floorRaw, step, 'ceil');

    const ceiling = dec(rule.ceiling);
    const reasons = [];
    if (ceiling !== null && compareDecimal(target, ceiling) > 0) {
        const capped = roundToQuantum(ceiling, step, 'floor');
        if (compareDecimal(capped, floor) < 0 || !satisfies(capped, input)) {
            return { action: 'block', floor, target, reasons: ['Потолок ниже минимальной безопасной цены — новые продажи остановлены.'] };
        }
        target = capped;
        reasons.push('Цена ограничена потолком.');
    }

    if (current === null) return { action: 'set', floor, target, reasons: [...reasons, 'Текущая цена неизвестна.'] };
    const cmp = compareDecimal(target, current);
    if (cmp === 0) return { action: 'keep', floor, target, reasons };
    if (cmp > 0 && !rule.allowRaise) {
        if (compareDecimal(current, floor) >= 0) return { action: 'keep', floor, target: current, reasons: [...reasons, 'Повышение запрещено правилом; текущая цена не ниже минимальной.'] };
        return { action: 'block', floor, target, reasons: [...reasons, 'Текущая цена ниже минимальной, а повышение запрещено правилом.'] };
    }
    return { action: cmp > 0 ? 'raise' : 'lower', floor, target, reasons };
}

export function describeMarkupMargin(rule) {
    const value = dec(rule?.value, '0');
    if (rule?.mode === 'markup') {
        const k = percent(value);
        const margin = divDecimal(mulDecimal(k, '100'), addDecimal('1', k), { quantum: '0.01' });
        return `Наценка ${value}% = маржа ${margin}%`;
    }
    const m = percent(value);
    if (compareDecimal(m, '1') >= 0) return '';
    const markup = divDecimal(mulDecimal(m, '100'), subDecimal('1', m), { quantum: '0.01' });
    return `Маржа ${value}% = наценка ${markup}%`;
}
