/*
 * FunPay Funcy — именованные фоновые задания поверх chrome.alarms.
 *
 * Service worker в MV3 может быть остановлен в любой момент, поэтому задания
 * живут в alarms (их Chrome хранит сам), а незавершённые операции поднимаются
 * проходом восстановления при запуске и на heartbeat.
 */

export function createJobScheduler({ alarms, log = console, recoveryGapMs = 30000, now = () => Date.now() } = {}) {
    if (!alarms || typeof alarms.create !== 'function' || typeof alarms.clear !== 'function') {
        throw new Error('chrome.alarms недоступен.');
    }
    const handlers = new Map();
    const recoveries = [];
    let recovery = null;
    let lastRecoveryAt = 0;

    function register(name, handler) {
        if (!name || typeof handler !== 'function') throw new Error('Для задания нужны имя и обработчик.');
        handlers.set(name, handler);
    }

    function schedulePeriodic(name, periodInMinutes, { delayInMinutes = periodInMinutes } = {}) {
        alarms.create(name, { delayInMinutes, periodInMinutes });
    }

    // Не пересоздаёт уже идущий alarm: иначе частые вызовы (например, на каждое
    // изменение настроек) сдвигали бы срабатывание бесконечно.
    async function ensurePeriodic(name, periodInMinutes, options = {}) {
        const existing = typeof alarms.get === 'function' ? await alarms.get(name) : null;
        if (existing && existing.periodInMinutes === periodInMinutes) return false;
        schedulePeriodic(name, periodInMinutes, options);
        return true;
    }

    function scheduleAt(name, when) {
        alarms.create(name, { when: Math.max(Number(when) || 0, now() + 1000) });
    }

    function clear(name) {
        return alarms.clear(name);
    }

    // true — alarm принадлежит планировщику и обработан.
    async function handleAlarm(alarm) {
        const handler = handlers.get(alarm?.name);
        if (!handler) return false;
        try {
            await handler(alarm);
        } catch (error) {
            log.error?.(`FunPay Funcy: задание ${alarm.name} завершилось ошибкой:`, error?.message || error);
        }
        return true;
    }

    function registerRecovery(name, fn) {
        if (typeof fn !== 'function') throw new Error('Обработчик восстановления должен быть функцией.');
        recoveries.push({ name, fn });
    }

    // Последовательно и не чаще recoveryGapMs (heartbeat приходит раз в минуту).
    function runRecovery({ force = false } = {}) {
        if (recovery) return recovery;
        if (!force && now() - lastRecoveryAt < recoveryGapMs) return Promise.resolve([]);
        lastRecoveryAt = now();
        recovery = (async () => {
            const results = [];
            for (const { name, fn } of recoveries) {
                try {
                    results.push({ name, ok: true, value: await fn() });
                } catch (error) {
                    results.push({ name, ok: false, error: error?.message || String(error) });
                    log.error?.(`FunPay Funcy: восстановление «${name}» не удалось:`, error?.message || error);
                }
            }
            return results;
        })().finally(() => { recovery = null; });
        return recovery;
    }

    return Object.freeze({ register, schedulePeriodic, ensurePeriodic, scheduleAt, clear, handleAlarm, registerRecovery, runRecovery });
}
