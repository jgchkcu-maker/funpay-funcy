/*
 * FunPay Funcy — точные денежные суммы.
 *
 * Сумма хранится строкой ('12.345') вместе с валютой; арифметика идёт на BigInt
 * без двоичных дробей. Точность (quantum) задаёт конкретная операция: цена
 * единицы лота и итог платежа могут иметь разные шаги,
 * поэтому универсальных «копеек» здесь нет.
 *
 * Неизвестная сумма — null, а не ноль: подтверждённый ноль и «не знаем» различаются.
 */

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

function pow10(n) {
    return 10n ** BigInt(n);
}

// { units, scale }: значение = units / 10^scale.
export function parseDecimal(value, { allowComma = false } = {}) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'bigint') return { units: value, scale: 0 };
    let text = typeof value === 'number'
        ? (Number.isFinite(value) ? numberToPlain(value) : '')
        : String(value).trim().replace(/[\s ]/g, '');
    if (allowComma) text = text.replace(',', '.');
    const match = DECIMAL_RE.exec(text);
    if (!match) return null;
    const fraction = match[3] || '';
    let units = BigInt(match[2] + fraction);
    if (match[1] === '-') units = -units;
    return { units, scale: fraction.length };
}

function numberToPlain(number) {
    const text = String(number);
    if (!/e/i.test(text)) return text;
    // 1e-7 и подобные: toFixed даёт до 20 знаков без экспоненты.
    return number.toFixed(20).replace(/\.?0+$/, '');
}

export function isDecimal(value, options) {
    return parseDecimal(value, options) !== null;
}

function align(a, b) {
    const scale = Math.max(a.scale, b.scale);
    return [a.units * pow10(scale - a.scale), b.units * pow10(scale - b.scale), scale];
}

function need(value) {
    const parsed = typeof value === 'object' && value && 'units' in value ? value : parseDecimal(value);
    if (!parsed) throw new Error(`Некорректная сумма: ${value}`);
    return parsed;
}

export function formatDecimal(value) {
    const { units, scale } = need(value);
    const negative = units < 0n;
    let digits = (negative ? -units : units).toString();
    if (scale > 0) {
        digits = digits.padStart(scale + 1, '0');
        digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
    }
    return negative && digits !== '0' ? `-${digits}` : digits;
}

export function compareDecimal(a, b) {
    const [x, y] = align(need(a), need(b));
    return x === y ? 0 : x < y ? -1 : 1;
}

export function decimalEquals(a, b) {
    return compareDecimal(a, b) === 0;
}

export function addDecimal(a, b) {
    const [x, y, scale] = align(need(a), need(b));
    return formatDecimal({ units: x + y, scale });
}

export function subDecimal(a, b) {
    const [x, y, scale] = align(need(a), need(b));
    return formatDecimal({ units: x - y, scale });
}

export function mulDecimal(a, b) {
    const x = need(a);
    const y = need(b);
    return formatDecimal({ units: x.units * y.units, scale: x.scale + y.scale });
}

export function sumDecimals(values) {
    return values.reduce((total, value) => addDecimal(total, value), '0');
}

// Деление с округлением до quantum (по умолчанию 0.00000001).
export function divDecimal(a, b, { quantum = '0.00000001', mode = 'half-up' } = {}) {
    const x = need(a);
    const y = need(b);
    if (y.units === 0n) throw new Error('Деление на ноль.');
    const q = need(quantum);
    if (q.units <= 0n) throw new Error('Шаг округления должен быть положительным.');
    // a / b / q в целых шагах: (x.units * 10^(y.scale + q.scale)) / (y.units * q.units * 10^x.scale)
    let numerator = x.units * pow10(y.scale + q.scale);
    let denominator = y.units * q.units * pow10(x.scale);
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    const steps = divideRounded(numerator, denominator, mode);
    return formatDecimal({ units: steps * q.units, scale: q.scale });
}

function divideRounded(numerator, denominator, mode) {
    let quotient = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder === 0n) return quotient;
    const positive = numerator > 0n;
    if (mode === 'down') return quotient; // к нулю
    if (mode === 'floor') return positive ? quotient : quotient - 1n;
    if (mode === 'ceil') return positive ? quotient + 1n : quotient;
    if (mode === 'up') return positive ? quotient + 1n : quotient - 1n;
    // half-up: от нуля при ровно половине.
    const twice = (remainder < 0n ? -remainder : remainder) * 2n;
    if (twice >= denominator) quotient += positive ? 1n : -1n;
    return quotient;
}

// Округление до шага quantum ('0.01', '1', '0.5'). mode: half-up | floor | ceil | down | up.
export function roundToQuantum(value, quantum, mode = 'half-up') {
    const x = need(value);
    const q = need(quantum);
    if (q.units <= 0n) throw new Error('Шаг округления должен быть положительным.');
    const [vx, vq, scale] = align(x, q);
    const steps = divideRounded(vx, vq, mode);
    return formatDecimal({ units: steps * vq, scale });
}

export function isMultipleOfQuantum(value, quantum) {
    return compareDecimal(roundToQuantum(value, quantum, 'down'), value) === 0;
}

// Делит total на части пропорционально weights в шагах quantum. Остаток
// округления детерминированно раздаётся частям с наибольшим дробным остатком
// (при равенстве — первым), сумма частей всегда равна total.
export function allocateDecimal(total, weights, quantum = '0.01') {
    if (!Array.isArray(weights) || !weights.length) throw new Error('Нужны доли распределения.');
    const t = need(total);
    const q = need(quantum);
    const parsedWeights = weights.map(weight => need(weight));
    if (parsedWeights.some(weight => weight.units < 0n)) throw new Error('Доли не могут быть отрицательными.');
    const [tUnits, qUnits, scale] = align(t, q);
    if (tUnits % qUnits !== 0n) throw new Error('Сумма не кратна шагу распределения.');
    const totalSteps = tUnits / qUnits;
    const weightScale = Math.max(...parsedWeights.map(weight => weight.scale));
    const w = parsedWeights.map(weight => weight.units * pow10(weightScale - weight.scale));
    const weightSum = w.reduce((sum, value) => sum + value, 0n);
    if (weightSum === 0n) throw new Error('Сумма долей равна нулю.');
    const sign = totalSteps < 0n ? -1n : 1n;
    const absSteps = totalSteps * sign;
    const base = w.map(value => (absSteps * value) / weightSum);
    const remainders = w.map((value, index) => ({ index, rest: (absSteps * value) % weightSum }));
    let left = absSteps - base.reduce((sum, value) => sum + value, 0n);
    remainders.sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
    for (const { index } of remainders) {
        if (left <= 0n) break;
        base[index] += 1n;
        left -= 1n;
    }
    return base.map(steps => formatDecimal({ units: steps * sign * qUnits, scale }));
}

export const CURRENCY_RE = /^[A-Z]{3,5}$/;

// Денежная величина операции: { amount, currency } либо null (неизвестно).
export function money(amount, currency) {
    if (amount === null || amount === undefined) return null;
    const parsed = parseDecimal(amount);
    if (!parsed) throw new Error(`Некорректная сумма: ${amount}`);
    const code = String(currency || '').toUpperCase();
    if (!CURRENCY_RE.test(code)) throw new Error(`Некорректная валюта: ${currency}`);
    return { amount: formatDecimal(parsed), currency: code };
}

export function sameCurrency(...values) {
    const present = values.filter(Boolean);
    return present.every(value => value.currency === present[0].currency);
}
