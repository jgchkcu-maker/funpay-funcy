// Lot operations for replacement popup views. No modal or progress-bar markup.
const IMPORT_PROCESS_KEY = 'fpToolsLotImportProcess';

function lotOperationAbortError() {
    const error = new Error('Операция остановлена.');
    error.name = 'AbortError';
    return error;
}

function throwIfLotOperationAborted(signal) {
    if (signal?.aborted) throw lotOperationAbortError();
}

function waitForLotOperationDelay(delayMs, signal) {
    throwIfLotOperationAborted(signal);
    const delay = Math.max(0, Number(delayMs) || 0);
    if (!delay) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let timer;
        const finish = callback => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            callback();
        };
        const onAbort = () => finish(() => reject(lotOperationAbortError()));
        timer = setTimeout(() => finish(resolve), delay);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

async function importPopupLots(payload) {
    const lots = payload.lots || JSON.parse(await payload.file.text());
    if (!Array.isArray(lots) || !lots.length) throw new Error('Файл пуст или имеет неверный формат.');
    return chrome.runtime.sendMessage({ action: 'startLotImport', lots, fileName: payload.fileName || payload.file?.name });
}

function initializeLotIO() {
    if (window.__fptLotIOListener) return;
    window.__fptLotIOListener = true;
    chrome.runtime.onMessage.addListener(request => {
        if (request.action === 'lotImportProgressUpdate') {
            window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: request.data }));
        }
    });
}

async function startExportProcess(allCategories, selectedCategoryIds, options = {}) {
    if (!Array.isArray(allCategories) || !Array.isArray(selectedCategoryIds)) throw new Error('Передайте категории и выбранные идентификаторы.');
    const lotsToExport = [];
    allCategories.forEach(cat => {
        if (selectedCategoryIds.includes(cat.id)) {
            lotsToExport.push(...cat.lots);
        }
    });
    
    if (lotsToExport.length === 0) {
        throw new Error('В выбранных категориях нет лотов для экспорта.');
    }



    const exportedData = [], errors = [];
    let processedCount = 0;
    const totalLots = lotsToExport.length;

    try {
        for (const lot of lotsToExport) {
            throwIfLotOperationAborted(options.signal);
            processedCount++;
            options.onProgress?.({ current: processedCount, total: totalLots, title: lot.title });
            throwIfLotOperationAborted(options.signal);

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getLotForExport',
                    offerId: lot.id,
                    nodeId: lot.nodeId
                });
                throwIfLotOperationAborted(options.signal);
                if (response.success) {
                    exportedData.push({
                        sourceTitle: lot.title,
                        sourceCategory: lot.categoryName,
                        data: response.data
                    });
                } else {
                    throw new Error(response.error);
                }
            } catch (e) {
                if (options.signal?.aborted || e.name === 'AbortError') throw lotOperationAbortError();
                const error = { offerId: lot.id, title: lot.title, error: e.message };
                errors.push(error);
                options.onError?.(error);
            }
            await waitForLotOperationDelay(options.delayMs ?? 300, options.signal);
        }

        if (!exportedData.length && errors.length) throw new Error(errors.map(item => `${item.title}: ${item.error}`).join('; '));
        return exportedData;
    } finally {
        options.onComplete?.(exportedData);
    }
}


if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('lot_io', id, fn);
    register('lot-io-export-btn', async () => {
        const response = await chrome.runtime.sendMessage({ action: 'getUserCategories' });
        if (!response?.success) throw new Error(response?.error || 'Не удалось загрузить категории.');
        return response.data;
    });
    register('lot-io-export-confirm', p => startExportProcess(p.categories, p.selectedCategoryIds, p));
    register('lot-io-select-all', p => window.fptPopupActions.toggleCategorySelection(p));
    register('lot-io-import-btn', importPopupLots);
    register('handleFileImport', importPopupLots);
    register('renderPendingImports', async () => (await chrome.storage.local.get(IMPORT_PROCESS_KEY))[IMPORT_PROCESS_KEY] || null);
    Object.entries({ 'lot-io-continue-btn': 'resumeLotImport', 'lot-io-cancel-btn': 'cancelLotImport',
        'lot-io-postpone-btn': 'postponeLotImport', skipLotImportItem: 'skipLotImportItem' }).forEach(([id, action]) => {
        register(id, p => chrome.runtime.sendMessage({ ...p, action }));
    });
    register('convert-cardinal-lots-btn', () => chrome.runtime.getURL('background/remake.html'));
}
