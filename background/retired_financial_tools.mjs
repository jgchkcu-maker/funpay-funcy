const RETIRED_PAGE_IDS = ['piggy_banks', 'calculator', 'currency_calc'];

export async function cleanupRetiredFinancialToolData(reason, storage) {
    if (reason !== 'update') return;

    const saved = await storage.get(['fpToolsLastPage', 'fpToolsPageModes']);
    const changes = {};
    if (RETIRED_PAGE_IDS.includes(saved.fpToolsLastPage)) {
        changes.fpToolsLastPage = 'lot_io';
        changes.fpToolsLastPageMode = null;
    }

    const savedModes = saved.fpToolsPageModes;
    if (savedModes && typeof savedModes === 'object' && !Array.isArray(savedModes)) {
        const pageModes = { ...savedModes };
        let changed = false;
        for (const pageId of RETIRED_PAGE_IDS) {
            if (Object.hasOwn(pageModes, pageId)) {
                delete pageModes[pageId];
                changed = true;
            }
        }
        if (changed) changes.fpToolsPageModes = pageModes;
    }

    await storage.remove('fpToolsPiggyBanks');
    if (Object.keys(changes).length) await storage.set(changes);
}
