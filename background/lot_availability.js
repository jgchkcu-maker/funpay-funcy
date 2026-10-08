/*
 * FunPay Funcy — автовыключение и автовосстановление лотов по остатку.
 *
 * Раньше переключение шло из content script и работало только при открытой
 * вкладке FunPay. Теперь проход выполняется в service worker по alarm
 * `fpToolsAutoRestore` и пишет лот через lot_writer (с перечитыванием формы).
 */

import { isLotFormActive } from './lot_writer.js';

function knownCount(config) {
    if (!config || typeof config !== 'object' || config.mode === 'template') return null;
    return Number.isInteger(config.productCount) && config.productCount >= 0 ? config.productCount : null;
}

// Возвращает 'activate', 'deactivate' или null. Неизвестный остаток никогда не
// приводит к переключению.
export function decideLotAvailability({ config, active, restoreEnabled, disableEnabled }) {
    const count = knownCount(config);
    if (count === null) return null;
    if (disableEnabled && count === 0 && active && config.autoDisableEnabled !== false) return 'deactivate';
    if (restoreEnabled && count > 0 && !active && config.autoRestoreEnabled !== false) return 'activate';
    return null;
}

export function createLotAvailabilitySweep({ getSettings, listOwnLots, writer, notify = () => {}, log = console } = {}) {
    if (typeof getSettings !== 'function' || !writer) throw new Error('Проход по лотам не настроен.');
    let running = null;

    async function sweepOnce() {
        const settings = await getSettings();
        const restoreEnabled = Boolean(settings.fpToolsAutoRestoreEnabled);
        const disableEnabled = Boolean(settings.fpToolsAutoDisableEnabled);
        const result = { changed: [], conflicts: [], errors: [], skipped: [] };
        if (!restoreEnabled && !disableEnabled) return result;

        const configs = settings.fpToolsAutoDeliveryLots || {};
        const candidates = Object.entries(configs).filter(([, config]) => knownCount(config) !== null);
        if (!candidates.length) return result;

        let lotsById = null;
        const nodeFor = async (id, config) => {
            if (/^\d+$/.test(String(config.nodeId || ''))) return String(config.nodeId);
            if (!lotsById && typeof listOwnLots === 'function') {
                const lots = await listOwnLots().catch(() => []);
                lotsById = new Map((Array.isArray(lots) ? lots : []).map(lot => [String(lot.id), lot]));
            }
            return lotsById?.get(id)?.nodeId ? String(lotsById.get(id).nodeId) : null;
        };

        for (const [id, config] of candidates) {
            try {
                const nodeId = await nodeFor(id, config);
                if (!nodeId) { result.skipped.push(id); continue; }
                let decision = null;
                const outcome = await writer.patchLot({
                    offerId: id,
                    nodeId,
                    mutate: form => {
                        decision = decideLotAvailability({ config, active: isLotFormActive(form), restoreEnabled, disableEnabled });
                        if (decision === 'activate') form.active = 'on';
                        if (decision === 'deactivate') delete form.active;
                        return form;
                    }
                });
                if (outcome.status === 'saved') {
                    const title = outcome.before?.['fields[summary][ru]'] || lotsById?.get(id)?.title || `Лот #${id}`;
                    result.changed.push({ id, decision });
                    notify({ offerId: id, title, active: decision === 'activate' });
                } else if (outcome.status !== 'unchanged') {
                    result.conflicts.push({ id, status: outcome.status });
                }
            } catch (error) {
                result.errors.push({ id, error: error?.message || String(error) });
                log.warn?.(`FunPay Funcy AutoRestore: лот ${id} не обработан:`, error?.message || error);
            }
        }
        return result;
    }

    // Повторный alarm во время идущего прохода не запускает второй параллельный.
    function sweep() {
        if (!running) running = sweepOnce().finally(() => { running = null; });
        return running;
    }

    return Object.freeze({ sweep });
}
