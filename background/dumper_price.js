/*
 * FunPay Funcy — автодемпер: расчёт целевой цены.
 *
 * Сравниваются цены покупателя (выдача FunPay) в одной валюте и за одну единицу.
 * Сначала отбор (dumper_market.js), затем сортировка и позиция. Цель — цена
 * первого (стратегия «Дешевле аналогов») или N-го конкурента минус шаг. Место в
 * фактической выдаче FunPay не обещается: при равных ценах показывается диапазон мест.
 *
 * Перевод цены покупателя в цену продавца — только через коэффициент
 * калькулятора FunPay (buyer = seller · coefficient). Нет коэффициента — нет записи.
 *
 * Минимум задаётся вручную и/или от себестоимости и прибыли (берётся больший).
 * Продавец получает свою цену целиком (комиссия покупателя сверху), поэтому
 * прибыль = цена продавца − себестоимость, без повторного вычета комиссии.
 * Несовместимые ограничения (минимум выше потолка) — пропуск, а не выбор одного из лимитов.
 *
 * Все суммы — десятичные строки (money.js).
 */

import { parseDecimal, formatDecimal, compareDecimal, addDecimal, subDecimal, mulDecimal, divDecimal, roundToQuantum } from './money.js';

const RATIO_QUANTUM = '0.0000000001';

export const DEFAULT_LIMITS = Object.freeze({ writeIntervalMin: 5, maxChangePercent: '5', maxHourlyDropPercent: '10' });
export const DEFAULT_INTERVAL_MIN = 5;
export const MIN_INTERVAL_MIN = 1;

function dec(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseDecimal(value, { allowComma: true });
    return parsed ? formatDecimal(parsed) : null;
}

function percentOf(base, percent) {
    return mulDecimal(base, divDecimal(percent, '100', { quantum: RATIO_QUANTUM }));
}

function maxOf(...values) {
    return values.filter(v => v !== null).reduce((a, b) => (a === null || compareDecimal(b, a) > 0 ? b : a), null);
}

export function validateDumperRule(rule, { kind } = {}) {
    const errors = [];
    if (!['undercut', 'position'].includes(rule?.strategy)) errors.push('Выберите стратегию.');
    const position = Number(rule?.position);
    if (rule?.strategy === 'position' && (!Number.isInteger(position) || position < 1 || position > 50)) errors.push('Место — целое число от 1 до 50.');
    const step = dec(rule?.step?.value);
    if (!['amount', 'percent'].includes(rule?.step?.mode)) errors.push('Выберите, в чём задан шаг.');
    if (step === null || compareDecimal(step, '0') <= 0) errors.push('Шаг должен быть больше нуля.');
    if (rule?.step?.mode === 'percent' && step !== null && compareDecimal(step, '50') > 0) errors.push('Шаг в процентах — не больше 50%.');
    for (const [field, label] of [['minPrice', 'Минимум'], ['cost', 'Себестоимость'], ['minProfit', 'Прибыль'], ['ceiling', 'Потолок'], ['quantum', 'Точность цены']]) {
        const raw = rule?.[field];
        if (raw !== null && raw !== undefined && raw !== '' && (dec(raw) === null || compareDecimal(dec(raw), '0') < 0)) errors.push(`${label}: некорректное число.`);
    }
    const quantum = dec(rule?.quantum);
    if (quantum !== null && compareDecimal(quantum, '0') <= 0) errors.push('Точность цены должна быть больше нуля.');
    if (dec(rule?.minPrice) === null && dec(rule?.cost) === null && !rule?.useCostBasis) errors.push('Задайте минимальную цену или себестоимость — без нижней границы демпер не работает.');
    if (rule?.allowRaise && dec(rule?.ceiling) === null) errors.push('Автоповышение требует потолка цены.');
    const interval = Number(rule?.intervalMin);
    if (!Number.isFinite(interval) || interval < MIN_INTERVAL_MIN || interval > 24 * 60) errors.push(`Интервал проверки — от ${MIN_INTERVAL_MIN} минуты до суток.`);
    const limits = rule?.limits || {};
    const writeInterval = Number(limits.writeIntervalMin);
    if (!Number.isFinite(writeInterval) || writeInterval < 1) errors.push('Интервал записи — не меньше минуты.');
    for (const [field, label] of [['maxChangePercent', 'Изменение за проход'], ['maxHourlyDropPercent', 'Снижение за час']]) {
        const value = dec(limits[field]);
        if (value === null || compareDecimal(value, '0') <= 0 || compareDecimal(value, '100') >= 0) errors.push(`${label}: от 0 до 100%.`);
    }
    if (kind === 'chips' && quantum === null) errors.push('Для валюты укажите точность цены явно.');
    return errors;
}

// Нижняя граница цены продавца: больший из ручного минимума и себестоимости + прибыли.
export function floorPrice({ minPrice = null, cost = null, minProfit = null }) {
    const manual = dec(minPrice);
    const c = dec(cost);
    const byCost = c !== null ? addDecimal(c, dec(minProfit) || '0') : null;
    return maxOf(manual, byCost);
}

// Диапазон мест среди отобранных при цене покупателя price: равные цены — диапазон.
export function placeRange(prices, price) {
    let lower = 0;
    let equal = 0;
    for (const p of prices) {
        const cmp = compareDecimal(p, price);
        if (cmp < 0) lower += 1;
        else if (cmp === 0) equal += 1;
    }
    return { from: lower + 1, to: lower + equal + 1 };
}

export function formatPlace(range) {
    if (!range) return '—';
    return range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`;
}

export function toBuyer(seller, coefficient) {
    return mulDecimal(seller, coefficient);
}

export function toSeller(buyer, coefficient, quantum, mode = 'floor') {
    return divDecimal(buyer, coefficient, { quantum, mode });
}

/*
 * Решение по одному проходу.
 *   prices         — цены покупателя отобранных конкурентов, по возрастанию
 *   currentPrice   — текущая цена продавца
 *   coefficient    — цена покупателя / цена продавца по калькулятору FunPay
 *   rule           — правило; floor/ceiling уже в цене продавца
 *   history        — { lastWriteAt, hourAgoPrice, raiseConfirm }
 * action: keep | lower | raise | raise-pending | wait | cannot-beat | skip
 */
export function decide({ prices, currentPrice, coefficient, rule, floor, now, history = {} }) {
    const reasons = [];
    const current = dec(currentPrice);
    const quantum = dec(rule.quantum) || '0.01';
    const ceiling = dec(rule.ceiling);
    const position = rule.strategy === 'position' ? Number(rule.position) : 1;
    const out = { action: 'keep', reasons, position, competitors: prices.length, currentPrice: current, floor, ceiling };

    if (current === null) { out.action = 'skip'; reasons.push('Текущая цена лота неизвестна.'); return out; }
    if (!coefficient) { out.action = 'skip'; reasons.push('Комиссия FunPay не подтверждена — цена покупателя не вычисляется.'); return out; }
    out.currentBuyer = toBuyer(current, coefficient);
    out.currentPlace = placeRange(prices, out.currentBuyer);
    if (floor === null) { out.action = 'skip'; reasons.push('Нет нижней границы цены.'); return out; }
    if (ceiling !== null && compareDecimal(floor, ceiling) > 0) {
        out.action = 'skip';
        reasons.push(`Минимум ${floor} выше потолка ${ceiling} — ограничения несовместимы, правило пропущено.`);
        return out;
    }
    if (prices.length < position) {
        reasons.push(prices.length ? `Подходящих конкурентов ${prices.length}, а нужно место ${position} — цена оставлена.` : 'Подходящих конкурентов нет — цена оставлена.');
        return out;
    }

    const reference = prices[position - 1];
    out.reference = reference;
    const stepValue = dec(rule.step.value);
    const step = rule.step.mode === 'percent' ? percentOf(reference, stepValue) : stepValue;
    const targetBuyer = subDecimal(reference, step);
    out.targetBuyer = targetBuyer;
    if (compareDecimal(targetBuyer, '0') <= 0) { out.action = 'skip'; reasons.push('Шаг больше цены конкурента.'); return out; }
    // Цена продавца округляется вниз; итог обязан остаться строго дешевле опорного конкурента.
    let target = toSeller(targetBuyer, coefficient, quantum, 'floor');
    for (let guard = 0; compareDecimal(target, '0') > 0 && compareDecimal(toBuyer(target, coefficient), reference) >= 0; guard += 1) {
        if (guard > 100) { out.action = 'skip'; reasons.push('Не удалось подобрать цену дешевле конкурента с такой точностью.'); return out; }
        target = subDecimal(target, quantum);
    }
    const ideal = target;
    out.ideal = ideal;

    if (compareDecimal(ideal, floor) < 0) {
        out.action = 'cannot-beat';
        reasons.push(`Чтобы обойти конкурента (${reference}), нужна цена ${ideal} — ниже минимума ${floor}. Цена не меняется.`);
        return out;
    }
    if (ceiling !== null && compareDecimal(target, ceiling) > 0) {
        target = roundToQuantum(ceiling, quantum, 'floor');
        reasons.push(`Цель ограничена потолком ${ceiling}.`);
    }

    const cmp = compareDecimal(target, current);
    if (cmp === 0) { reasons.push('Цена уже на целевом уровне.'); out.target = target; return out; }

    if (cmp > 0) {
        if (!rule.allowRaise) {
            reasons.push(`Можно было бы поднять до ${target}, но автоповышение выключено.`);
            out.target = current;
            return out;
        }
        if (ceiling === null) { reasons.push('Автоповышение без потолка запрещено.'); out.target = current; return out; }
    }

    // Пределы: изменение за проход и суммарное снижение за скользящий час.
    const limits = { ...DEFAULT_LIMITS, ...(rule.limits || {}) };
    const stepLimit = percentOf(current, dec(limits.maxChangePercent));
    if (cmp < 0) {
        const lowest = roundToQuantum(subDecimal(current, stepLimit), quantum, 'ceil');
        if (compareDecimal(target, lowest) < 0) { target = lowest; reasons.push(`Снижение ограничено ${limits.maxChangePercent}% за проход.`); }
        const base = dec(history.hourAgoPrice) || current;
        const hourFloor = roundToQuantum(subDecimal(base, percentOf(base, dec(limits.maxHourlyDropPercent))), quantum, 'ceil');
        if (compareDecimal(target, hourFloor) < 0) {
            target = hourFloor;
            reasons.push(`Снижение за час ограничено ${limits.maxHourlyDropPercent}% (от ${base}).`);
        }
        if (compareDecimal(target, floor) < 0) target = roundToQuantum(floor, quantum, 'ceil');
        if (compareDecimal(target, current) >= 0) {
            out.action = 'wait';
            reasons.push('Лимит снижения за час исчерпан — ждём.');
            out.target = current;
            return out;
        }
    } else {
        const highest = roundToQuantum(addDecimal(current, stepLimit), quantum, 'floor');
        if (compareDecimal(target, highest) > 0) { target = highest; reasons.push(`Повышение ограничено ${limits.maxChangePercent}% за проход.`); }
    }
    out.target = target;
    out.targetPlace = placeRange(prices, toBuyer(target, coefficient));

    const writeIntervalMs = Math.max(1, Number(limits.writeIntervalMin) || 5) * 60000;
    if (history.lastWriteAt && now - history.lastWriteAt < writeIntervalMs) {
        out.action = 'wait';
        reasons.push(`Запись не чаще раза в ${limits.writeIntervalMin} мин — следующая после ${new Date(history.lastWriteAt + writeIntervalMs).toLocaleTimeString('ru-RU')}.`);
        return out;
    }

    if (cmp > 0) {
        // Повышение — только после двух последовательных проходов с тем же выводом.
        const confirm = history.raiseConfirm;
        const confirmed = confirm && confirm.reference === reference && confirm.count >= 1;
        if (!confirmed) {
            out.action = 'raise-pending';
            out.raiseConfirm = { reference, target, count: (confirm?.reference === reference ? confirm.count : 0) + 1 };
            reasons.push(`Рынок позволяет поднять цену до ${target}; ждём второго подтверждения.`);
            return out;
        }
        out.action = 'raise';
        reasons.push(`Рынок подтверждён дважды — повышаем до ${target}.`);
        return out;
    }
    out.action = 'lower';
    reasons.push(`Конкурент на месте ${position}: ${reference}. Новая цена ${target}${compareDecimal(target, ideal) !== 0 ? ` (цель ${ideal})` : ''}.`);
    return out;
}

// Коэффициент калькулятора: минимальная цена покупателя в нужной валюте / цена продавца.
export function coefficientFromCalc(response, { price, currencySymbol }) {
    const base = dec(price);
    if (!response || response.error || base === null || compareDecimal(base, '0') <= 0) return null;
    const methods = Array.isArray(response.methods) ? response.methods : [];
    let best = null;
    for (const method of methods) {
        const unit = String(method?.unit ?? '').trim();
        if (!currencySymbol || unit !== currencySymbol) continue;
        const value = dec(String(method?.price ?? '').replace(/[\s  ]/g, ''));
        if (value === null || compareDecimal(value, '0') <= 0) continue;
        if (best === null || compareDecimal(value, best) < 0) best = value;
    }
    if (best === null) return null;
    return { coefficient: divDecimal(best, base, { quantum: RATIO_QUANTUM, mode: 'half-up' }), buyerAtBase: best };
}

// Совпадает ли цена своей строки в выдаче с расчётом калькулятора (в пределах округления показа).
export function matchesShown({ shown, sellerPrice, coefficient, displayQuantum = '0.01' }) {
    const expected = toBuyer(sellerPrice, coefficient);
    const diff = subDecimal(expected, shown);
    const abs = compareDecimal(diff, '0') < 0 ? subDecimal('0', diff) : diff;
    // Допуск: половина шага показа плюс 0.2% (FunPay округляет расчёт по своим правилам).
    const tolerance = addDecimal(divDecimal(displayQuantum, '2', { quantum: RATIO_QUANTUM }), percentOf(shown, '0.2'));
    return compareDecimal(abs, tolerance) <= 0;
}

export function decimalsOf(value) {
    const parsed = parseDecimal(value, { allowComma: true });
    return parsed ? parsed.scale : 0;
}
