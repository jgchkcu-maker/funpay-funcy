/*
 * FunPay Funcy — именованные фоновые задания поверх chrome.alarms.
 *
 * Service worker в MV3 может быть остановлен в любой момент, поэтому задания
 * живут в alarms (их Chrome хранит сам), а незавершённые операции поднимаются
 * проходом восстановления при запуске и на heartbeat.
 */

export const JOB_DEADLINES_KEY = 'fpToolsJobDeadlines';

// storage (необязательно) — chrome.storage.local-подобный объект для сроков заданий.
export function createJobScheduler({ alarms, storage = null, log = console, recoveryGapMs = 30000, now = () => Date.now() } = {}) {
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

    // Возвращает Promise создания alarm: ошибку настройки видит вызывающий.
    function scheduleAt(name, when) {
        return Promise.resolve(alarms.create(name, { when: Math.max(Number(when) || 0, now() + 1000) }));
    }

    function clear(name) {
        return alarms.clear(name);
    }

    // --- Сроки, которые переживают перезапуск -----------------------------------
    // Alarm — только сигнал проверить сохранённый срок. Сначала срок записывается,
    // потом создаётся alarm; при запуске worker просроченные задания выполняются
    // один раз (без проигрывания пропущенных интервалов), будущие — переустанавливаются.
    let deadlineChain = Promise.resolve();
    function withDeadlines(mutate) {
        if (!storage) return Promise.reject(new Error('Хранилище сроков заданий не настроено.'));
        const run = deadlineChain.then(async () => {
            const { [JOB_DEADLINES_KEY]: stored } = await storage.get(JOB_DEADLINES_KEY);
            const deadlines = stored && typeof stored === 'object' ? { ...stored } : {};
            const result = mutate(deadlines);
            await storage.set({ [JOB_DEADLINES_KEY]: deadlines });
            return result;
        });
        deadlineChain = run.catch(() => {});
        return run;
    }

    async function scheduleDue(name, dueAt) {
        if (!handlers.has(name)) throw new Error(`Задание ${name} не зарегистрировано.`);
        const when = Number(dueAt);
        if (!Number.isFinite(when)) throw new Error('Некорректный срок задания.');
        await withDeadlines(deadlines => { deadlines[name] = when; });
        await scheduleAt(name, when);
        return when;
    }

    async function clearDue(name) {
        await withDeadlines(deadlines => { delete deadlines[name]; });
        await clear(name);
    }

    async function getDeadlines() {
        if (!storage) return {};
        const { [JOB_DEADLINES_KEY]: stored } = await storage.get(JOB_DEADLINES_KEY);
        return stored && typeof stored === 'object' ? { ...stored } : {};
    }

    async function recoverDeadlines() {
        const deadlines = await getDeadlines();
        const results = [];
        for (const [name, dueAt] of Object.entries(deadlines)) {
            if (!handlers.has(name)) continue;
            if (dueAt <= now()) {
                // Обработчик сам вычисляет состояние «сейчас» и назначает следующий срок.
                await withDeadlines(current => { if (current[name] === dueAt) delete current[name]; });
                results.push({ name, ran: await handleAlarm({ name, scheduledTime: dueAt, recovered: true }) });
                continue;
            }
            const existing = typeof alarms.get === 'function' ? await alarms.get(name) : null;
            if (!existing || Math.abs((existing.scheduledTime || 0) - dueAt) > 1000) await scheduleAt(name, dueAt);
            results.push({ name, ran: false });
        }
        return results;
    }

    // true — alarm принадлежит планировщику и обработан.
    async function handleAlarm(alarm) {
        const handler = handlers.get(alarm?.name);
        if (!handler) return false;
        if (storage && !alarm.recovered) {
            await withDeadlines(deadlines => {
                if (deadlines[alarm.name] !== undefined && deadlines[alarm.name] <= now() + 1000) delete deadlines[alarm.name];
            }).catch(() => {});
        }
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

    return Object.freeze({
        register, schedulePeriodic, ensurePeriodic, scheduleAt, clear, handleAlarm, registerRecovery, runRecovery,
        scheduleDue, clearDue, getDeadlines, recoverDeadlines
    });
}
