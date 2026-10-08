// content/features/settings_io.js - FunPay Funcy 2.9
// Экспорт и импорт ВСЕХ настроек FunPay Funcy в файл .fpconfig
// Принцип: выгружаем всё из chrome.storage.local, КРОМЕ списка исключений
// (аккаунты, токены, кэши и временное рантайм-состояние). Так новые фичи
// попадают в бэкап автоматически, без правки списка.

const FP_CONFIG_VERSION  = 2;
const FP_CONFIG_MAGIC    = 'FPTCONFIG';

// Ключи, которые НЕ экспортируем.
// 1) Аккаунты и авторизация — по требованию исключаем.
// 2) Токены/секреты сторонних сервисов.
// 3) Большие кэши и временное состояние, которое только навредит на другом
//    устройстве (heartbeat, «seeded/processed/collecting», позиции окна и т.п.).
const EXCLUDE_KEYS = new Set([
    // --- Аккаунты (НИКОГДА не экспортируем) ---
    'fpToolsAccounts',
    'fpToolsAccountsList',
    // --- Токены/секреты ---
    // --- Рантайм/служебное состояние движков (per-device) ---
    'fpToolsEngineHeartbeat',
    'fpToolsSalesCollecting',
    'fpToolsPurchasesCollecting',
    'fpToolsFinanceCollecting',
    'fpToolsSalesLastUpdate',
    'fpToolsPurchasesLastUpdate',
    'fpToolsFinanceLastUpdate',
    'fpToolsFinanceCount',
    'fpToolsFirstOrderId',
    'fpToolsLastOrderId',
    'fpToolsLotImportProcess',
    'fpToolsCheckRestoreLots',
    // Секреты (shared_secret) не покидают этот браузер.
    'fpToolsSecrets',
    // Автоматизация привязана к аккаунту и состоянию лотов этого устройства:
    // политики, расписания, цены и сроки заданий не переносятся
    // автоматически (импорт включил бы управление без нового предпросмотра).
    'fpToolsAccountEpoch',
    'fpToolsJobDeadlines',
    'fpToolsDeletedOffers',
    'fpToolsLotPolicies',
    'fpToolsLotSchedules',
    'fpToolsLotSchedulesEnabled',
    'fpToolsPricing',
    'fpToolsBlacklistUpdated',
    'fpToolsUnreadCount',
    // --- Кэши (большие, легко перезапросятся) ---
    'fpToolsWallpaperCache',
    'fpToolsImageStore',
    'fpToolsImageCanvas',
    // Своя мелодия весит до ~1 МБ; без самого звука мета не нужна.
    'fpToolsCustomSoundData',
    'fpToolsCustomSoundMeta',
    'fpToolsBuyerHistory',
    'fpToolsBuyerViewing',
    // --- Чисто UI-состояние текущей вкладки/окна (per-device) ---
    'fpToolsLastPage',
    'fpToolsLastPageMode',
    'fpToolsPopupDragged',
    // Retired feature data must not return through old backups.
    'fpToolsPiggyBanks',
]);

async function getPopupSettingsExport() {
    const all = globalThis.FPTRetiredIntegrations.sanitizeSettings(await chrome.storage.local.get(null));
    return { _magic: FP_CONFIG_MAGIC, _version: FP_CONFIG_VERSION, _date: new Date().toISOString(),
        _extVer: chrome.runtime.getManifest().version,
        settings: Object.fromEntries(Object.entries(all).filter(([key]) => !EXCLUDE_KEYS.has(key))) };
}
async function importPopupSettings(p) {
    const data = p.data || JSON.parse(await p.file.text());
    if (data?._magic !== FP_CONFIG_MAGIC || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Неверный формат .fpconfig.');
    const safe = Object.fromEntries(Object.entries(globalThis.FPTRetiredIntegrations.sanitizeSettings(data.settings)).filter(([key]) => !EXCLUDE_KEYS.has(key) && key !== 'fpToolsAutoReplies'));
    if (safe.fpToolsPageModes && typeof safe.fpToolsPageModes === 'object' && !Array.isArray(safe.fpToolsPageModes)) {
        const pageModes = { ...safe.fpToolsPageModes };
        delete pageModes.piggy_banks;
        delete pageModes.calculator;
        delete pageModes.currency_calc;
        safe.fpToolsPageModes = pageModes;
    }
    await chrome.storage.local.set(safe);
    if (Object.hasOwn(data.settings, 'fpToolsAutoReplies')) await window.fptImportAutoReplies(data.settings.fpToolsAutoReplies);
    return { count: Object.keys(safe).length + Number(Object.hasOwn(data.settings, 'fpToolsAutoReplies')) };
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('settings_io', id, fn);
    register('fp-settings-export-btn', getPopupSettingsExport);
    register('fp-settings-import-btn', importPopupSettings);
    register('fp-reset-autoresponder-btn', async () => {
        await chrome.storage.local.remove('fpToolsAutoResponderTag');
        return window.fptPatchAutoReplies({ set: { processedMessageIds: [] } });
    });
    register('fp-reset-pinned-btn', () => chrome.storage.local.remove('fpToolsPinnedLots'));
    register('fp-reset-greeted-btn', () => window.fptPatchAutoReplies({ set: { greetedUsers: [] } }));
    register('fp-reset-april-btn', async () => {
        const year = new Date().getFullYear();
        for (const key of [`fpApril_${year}_done`, `fpApril_${year-1}_done`]) localStorage.removeItem(key);
        for (const key of ['fpAprilReloads', 'fpAprilActive']) sessionStorage.removeItem(key);
        return chrome.storage.local.remove([`fpApril_${year}_done`, `fpApril_${year-1}_done`, `fpApril_${year+1}_done`, 'fpAprilReloads', 'fpAprilActive']);
    });
}
