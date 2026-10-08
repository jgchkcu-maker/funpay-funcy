const LOT_STORAGE_KEY = 'fpToolsAutoDeliveryLots';
const STOCK_SYNC_CONCURRENCY = 3;

export function countAutoDeliverySecrets(secrets) {
    if (typeof secrets !== 'string') return null;
    return secrets.split(/\r?\n/).filter(secret => secret.trim().length > 0).length;
}

export function isAutoDeliveryLotEnabled(config) {
    return config?.enabled !== false;
}

export function createAutoDeliveryStore(storage, readLotForm) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('Auto-delivery storage is unavailable.');
    }

    let writeQueue = Promise.resolve();

    function serializeWrite(operation) {
        const write = writeQueue.catch(() => {}).then(operation);
        writeQueue = write.catch(() => {});
        return write;
    }

    async function readLots() {
        const { [LOT_STORAGE_KEY]: lots = {} } = await storage.get(LOT_STORAGE_KEY);
        return lots && typeof lots === 'object' && !Array.isArray(lots) ? lots : {};
    }

    async function patchLot(lotId, patch, { preserveCurrentStock = false } = {}) {
        const id = String(lotId || '').trim();
        if (!/^\d+$/.test(id)) throw new Error('Некорректный ID лота.');
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Некорректные настройки лота.');

        return serializeWrite(async () => {
            const lots = await readLots();
            const currentLot = lots[id] && typeof lots[id] === 'object' ? lots[id] : null;
            const nextLot = { ...(currentLot || {}), ...patch };
            if (preserveCurrentStock && ['secrets', 'template'].includes(patch.mode)) {
                const currentCount = Number.isInteger(currentLot?.productCount) && currentLot.productCount >= 0
                    ? currentLot.productCount
                    : currentLot?.stockSnapshot;
                if (patch.mode === 'template') {
                    nextLot.productCount = null;
                    if (Number.isInteger(currentCount) && currentCount >= 0) nextLot.stockSnapshot = currentCount;
                } else {
                nextLot.productCount = Number.isInteger(currentCount) && currentCount >= 0
                    ? currentCount
                    : currentLot ? null : patch.productCount;
                    if (Number.isInteger(nextLot.productCount) && nextLot.productCount >= 0) nextLot.stockSnapshot = nextLot.productCount;
                }
            }
            await storage.set({ [LOT_STORAGE_KEY]: { ...lots, [id]: nextLot } });
            return { ...nextLot };
        });
    }

    // nodeIds запоминаются, чтобы фоновое автовосстановление могло открыть форму
    // лота, которого уже нет в публичном профиле (выключенного).
    // Остаток склада FunPay — снимок с временем проверки: старый положительный
    // остаток после ошибки чтения не считается подтверждённым (stockError).
    async function writeStockCounts(counts, nodeIds = {}, errors = []) {
        return serializeWrite(async () => {
            const lots = await readLots();
            const nextLots = { ...lots };
            const checkedAt = Date.now();
            for (const [id, count] of Object.entries(counts)) {
                const current = nextLots[id];
                if (!current || typeof current !== 'object') continue;
                nextLots[id] = {
                    ...current,
                    ...(nodeIds[id] ? { nodeId: nodeIds[id] } : {}),
                    productCount: current.mode === 'template' ? null : count,
                    stockSnapshot: current.mode === 'template' ? current.stockSnapshot : count,
                    stockCheckedAt: checkedAt,
                    stockError: null
                };
            }
            for (const { lotId, error } of errors) {
                const current = nextLots[lotId];
                if (!current || typeof current !== 'object') continue;
                nextLots[lotId] = { ...current, stockError: error, stockErrorAt: checkedAt };
            }
            await storage.set({ [LOT_STORAGE_KEY]: nextLots });
            return counts;
        });
    }

    async function syncLots(lots) {
        if (!Array.isArray(lots)) throw new Error('Список лотов не найден.');
        const configs = await readLots();
        const counts = {};
        const errors = [];
        const work = [];
        const nodeIds = {};

        for (const lot of lots) {
            const id = String(lot?.id || '').trim();
            const nodeId = String(lot?.nodeId || '').trim();
            if (!/^\d+$/.test(id) || !/^\d+$/.test(nodeId)) continue;
            nodeIds[id] = nodeId;
            if (configs[id]?.mode === 'template') {
                counts[id] = null;
                continue;
            }
            work.push({ id, nodeId, title: lot.title || '' });
        }

        let index = 0;
        const worker = async () => {
            while (index < work.length) {
                const lot = work[index++];
                try {
                    if (typeof readLotForm !== 'function') throw new Error('Загрузка формы лота недоступна.');
                    const form = await readLotForm(lot);
                    const count = countAutoDeliverySecrets(form?.secrets);
                    // A parsed form without the warehouse field means FunPay auto-delivery is off for the lot.
                    const autoDeliveryOff = Object.keys(form || {}).length > 0
                        && !form.auto_delivery && !form['fields[auto_delivery]'];
                    if (count === null && autoDeliveryOff) {
                        counts[lot.id] = 0;
                    } else if (count === null) {
                        errors.push({ lotId: lot.id, error: 'В форме лота не найдено содержимое склада.' });
                    } else {
                        counts[lot.id] = count;
                    }
                } catch (error) {
                    errors.push({ lotId: lot.id, error: error?.message || 'Не удалось обновить остаток.' });
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(STOCK_SYNC_CONCURRENCY, work.length) }, worker));
        await writeStockCounts(counts, nodeIds, errors);
        return { counts, errors };
    }

    return Object.freeze({ patchLot, syncLots });
}

let configuredStore;

export function configureAutoDeliveryStore(storage, readLotForm) {
    configuredStore = createAutoDeliveryStore(storage, readLotForm);
    return configuredStore;
}

function getConfiguredStore() {
    if (!configuredStore) throw new Error('Auto-delivery storage is not configured.');
    return configuredStore;
}

export async function saveAutoDeliveryLot(lotId, settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('Некорректные настройки лота.');
    }
    if (typeof settings.enabled !== 'boolean') throw new Error('Не задан статус автовыдачи.');
    if (!['secrets', 'template'].includes(settings.mode)) throw new Error('Неизвестный источник товаров.');
    if (settings.mode === 'template' && (typeof settings.text !== 'string' || !settings.text.trim())) {
        throw new Error('Введите текст выдачи для собственного шаблона.');
    }

    const productCount = Number.isInteger(settings.productCount) && settings.productCount >= 0
        ? settings.productCount
        : null;
    return getConfiguredStore().patchLot(lotId, {
        enabled: settings.enabled,
        mode: settings.mode,
        text: typeof settings.text === 'string' ? settings.text : '',
        productCount: settings.mode === 'secrets' ? productCount : null,
        updatedAt: Date.now()
    }, { preserveCurrentStock: true });
}

export async function syncAutoDeliveryStockCounts(lots) {
    return getConfiguredStore().syncLots(lots);
}

export async function refreshAutoDeliveryLotStock(lotId, nodeId) {
    const result = await getConfiguredStore().syncLots([{ id: String(lotId), nodeId: String(nodeId) }]);
    return result.counts[String(lotId)];
}
