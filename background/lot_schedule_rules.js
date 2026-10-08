/*
 * FunPay Funcy — недельные окна расписания лотов (чистые функции).
 *
 * Правило: одна IANA-зона (сохраняется явно и не меняется вслед за компьютером) и
 * недельные окна [начало, конец) с точностью до минуты. Окно через полночь
 * (пятница 22:00–02:00) раскладывается на пятницу 22:00–24:00 и субботу 00:00–02:00.
 * Равные границы не означают «круглые сутки» — сутки задаются явно 00:00–24:00.
 * Нет окон — закрыто всегда.
 *
 * Принадлежность моменту считается по местным полям времени (Intl, григорианский
 * календарь). Политика перехода на летнее/зимнее время — «по настенным часам»:
 * пропущенных минут нет, повторённый час проверяется оба раза, поэтому возможны
 * повторные переходы. Пропущенные открытия после сна не проигрываются.
 */

export const DAYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const DAY_NAMES = Object.freeze(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
const WEEK_MINUTES = 7 * 24 * 60;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export function isValidTimeZone(zone) {
    if (typeof zone !== 'string' || !zone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch (_) {
        return false;
    }
}

function parseTime(value, { allowEndOfDay = false } = {}) {
    const match = TIME_RE.exec(String(value || ''));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes > 59) return null;
    if (hours === 24 && minutes === 0 && allowEndOfDay) return 1440;
    if (hours > 23) return null;
    return hours * 60 + minutes;
}

// Проверяет правило и возвращает список ошибок (пустой — правило корректно).
export function validateScheduleRule(rule) {
    const errors = [];
    if (!isValidTimeZone(rule?.timezone)) errors.push('Не указан или не распознан часовой пояс.');
    if (!Array.isArray(rule?.windows)) errors.push('Не заданы окна расписания.');
    for (const [index, window] of (rule?.windows || []).entries()) {
        const day = DAYS.indexOf(window?.day);
        const start = parseTime(window?.start);
        const end = parseTime(window?.end, { allowEndOfDay: true });
        if (day < 0) errors.push(`Окно ${index + 1}: неизвестный день недели.`);
        if (start === null || end === null) errors.push(`Окно ${index + 1}: время должно быть в формате ЧЧ:ММ.`);
        else if (start === end) errors.push(`Окно ${index + 1}: начало совпадает с концом. Для круглых суток укажите 00:00–24:00.`);
    }
    return errors;
}

// Недельные отрезки в минутах от понедельника 00:00, объединённые и отсортированные.
export function normalizeWindows(windows) {
    const segments = [];
    for (const window of windows || []) {
        const day = DAYS.indexOf(window?.day);
        const start = parseTime(window?.start);
        const end = parseTime(window?.end, { allowEndOfDay: true });
        if (day < 0 || start === null || end === null || start === end) continue;
        const base = day * 1440;
        if (end > start) {
            segments.push([base + start, base + end]);
        } else {
            // Через полночь: хвост переходит на следующий день (с воскресенья — на понедельник).
            segments.push([base + start, base + 1440]);
            const nextBase = ((day + 1) % 7) * 1440;
            if (end > 0) segments.push([nextBase, nextBase + end]);
        }
    }
    segments.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const segment of segments) {
        const last = merged[merged.length - 1];
        if (last && segment[0] <= last[1]) last[1] = Math.max(last[1], segment[1]);
        else merged.push([...segment]);
    }
    return merged;
}

const formatterCache = new Map();
function formatterFor(timeZone) {
    if (!formatterCache.has(timeZone)) {
        formatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
            timeZone, calendar: 'gregory', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit', timeZoneName: 'shortOffset'
        }));
    }
    return formatterCache.get(timeZone);
}

const WEEKDAY_INDEX = Object.freeze({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 });

// Местные поля момента в зоне: { weekMinute, date, time, offset }.
export function localParts(instant, timeZone) {
    const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const hour = Number(parts.hour) % 24;
    const minute = Number(parts.minute);
    const day = WEEKDAY_INDEX[parts.weekday];
    return {
        weekMinute: day * 1440 + hour * 60 + minute,
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        day: DAYS[day],
        offset: (parts.timeZoneName || '').replace('GMT', 'UTC') || 'UTC'
    };
}

export function isOpenAtWeekMinute(segments, weekMinute) {
    const minute = ((weekMinute % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;
    return segments.some(([start, end]) => minute >= start && minute < end);
}

export function isScheduleOpen(rule, instant) {
    const segments = normalizeWindows(rule?.windows);
    return isOpenAtWeekMinute(segments, localParts(instant, rule.timezone).weekMinute);
}

// Ближайшие переходы по UTC-минутам: { at, open, local } (не больше limit) в пределах horizonMinutes.
export function scheduleTransitions(rule, from, { horizonMinutes = 24 * 60, limit = 5 } = {}) {
    const segments = normalizeWindows(rule?.windows);
    const start = Math.floor(from / 60000) * 60000;
    let previous = isOpenAtWeekMinute(segments, localParts(start, rule.timezone).weekMinute);
    const transitions = [];
    for (let step = 1; step <= horizonMinutes && transitions.length < limit; step += 1) {
        const at = start + step * 60000;
        const local = localParts(at, rule.timezone);
        const open = isOpenAtWeekMinute(segments, local.weekMinute);
        if (open !== previous) {
            transitions.push({ at, open, local });
            previous = open;
        }
    }
    return transitions;
}

// Срок следующей проверки: ближайший переход за сутки, иначе контрольная проверка через сутки.
export function nextScheduleCheck(rules, from) {
    let next = from + 24 * 60 * 60000;
    for (const rule of rules) {
        const [first] = scheduleTransitions(rule, from, { limit: 1 });
        if (first && first.at < next) next = first.at;
    }
    return next;
}

// Текст окна для интерфейса: «Пт 22:00–02:00».
export function describeWindow(window) {
    const index = DAYS.indexOf(window?.day);
    return `${DAY_NAMES[index] || '?'} ${window?.start}–${window?.end}`;
}
