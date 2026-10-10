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
    // Когда на этом устройстве делали копию и импорт — история только этого браузера.
    'fpToolsSettingsIOHistory',
    // Retired feature data must not return through old backups.
    'fpToolsPiggyBanks',
]);

const DEVICE_ONLY_PATTERNS = [
    /^fptProfileSession/, /^fptPendingVerifyLots$/, /^fptLastVerifyAt$/,
    /^fptProfileDescrCache/, /^fpToolsAutoResponderTag$/, /^fpToolsStockManagementReleased/
];
function isExportable(key) {
    return !EXCLUDE_KEYS.has(key) && !DEVICE_ONLY_PATTERNS.some(pattern => pattern.test(key));
}

function normalizeImportedSettings(settings) {
    const safe = globalThis.FPTSafe;
    const text = value => typeof value === 'string' ? value : '';
    const id = value => /^\d+$/.test(String(value ?? '')) ? String(value) : '';
    if (Object.hasOwn(settings, 'fpToolsQuickGames')) {
        settings.fpToolsQuickGames = (Array.isArray(settings.fpToolsQuickGames) ? settings.fpToolsQuickGames : [])
            .filter(game => game && safe.funpayUrl(game.url)).map(game => ({ title: text(game.title), url: safe.funpayUrl(game.url) }));
    }
    for (const key of ['fpToolsPinnedLots', 'fpToolsCtxPinnedLots']) {
        if (!Object.hasOwn(settings, key)) continue;
        settings[key] = (Array.isArray(settings[key]) ? settings[key] : []).flatMap(lot => {
            if (!lot || !id(lot.offerId)) return [];
            // Convert old backups through an inert parser; never retain HTML or stored URLs.
            let title = text(lot.title), price = text(lot.price);
            if (key === 'fpToolsPinnedLots' && typeof lot.html === 'string') {
                const doc = new DOMParser().parseFromString(lot.html, 'text/html');
                title = doc.querySelector('.tc-desc-text, .tc-desc')?.textContent || '';
                price = doc.querySelector('.tc-price')?.textContent || '';
            }
            if (key === 'fpToolsPinnedLots' && !id(lot.nodeId)) return [];
            return [{ offerId: id(lot.offerId), nodeId: id(lot.nodeId), title, price, gameName: text(lot.gameName),
                ...(key === 'fpToolsCtxPinnedLots' ? { sellerId: id(lot.sellerId), sellerName: text(lot.sellerName) } : {}) }];
        });
    }
    if (Object.hasOwn(settings, 'fpToolsHeaderButtonStyles')) {
        const value = settings.fpToolsHeaderButtonStyles || {};
        settings.fpToolsHeaderButtonStyles = { size: safe.cssNumber(value.size, 12, 24, 14), opacity: safe.cssNumber(value.opacity, 10, 100, 100) };
    }
    if (Object.hasOwn(settings, 'fpToolsTheme')) {
        const value = settings.fpToolsTheme;
        if (!value || typeof value !== 'object' || Array.isArray(value)) delete settings.fpToolsTheme;
        else {
            settings.fpToolsTheme = safe.themeSettings(value);
            if (Object.hasOwn(value, 'font')) settings.fpToolsTheme.font = safe.fontName(value.font) || 'Helvetica Neue';
            if (Object.hasOwn(value, 'bgImage')) settings.fpToolsTheme.bgImage = safe.cssImageUrl(value.bgImage) ? value.bgImage : '';
        }
    }
    if (Object.hasOwn(settings, 'fpToolsLiveStyles')) {
        const clean = {};
        const value = settings.fpToolsLiveStyles;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [selector, declarations] of Object.entries(value)) {
                if (!declarations || typeof declarations !== 'object' || Array.isArray(declarations)) continue;
                const props = {};
                for (const [prop, v] of Object.entries(declarations)) {
                    if (safe.cssDeclarations({ [selector]: { [prop]: v } })) props[prop] = v;
                }
                if (Object.keys(props).length) clean[selector] = props;
            }
        }
        settings.fpToolsLiveStyles = clean;
    }
    return settings;
}

async function getPopupSettingsExport() {
    const all = globalThis.FPTRetiredIntegrations.sanitizeSettings(await chrome.storage.local.get(null));
    return { _magic: FP_CONFIG_MAGIC, _version: FP_CONFIG_VERSION, _date: new Date().toISOString(),
        _extVer: chrome.runtime.getManifest().version,
        settings: Object.fromEntries(Object.entries(all).filter(([key]) => isExportable(key))) };
}
// p.keys (необязательно) — импортировать только эти ключи: выбор разделов в предпросмотре.
async function importPopupSettings(p) {
    if (p.file && p.file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ.');
    const data = p.data || JSON.parse(await p.file.text());
    if (data?._magic !== FP_CONFIG_MAGIC || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Неверный формат .fpconfig.');
    const only = Array.isArray(p.keys) ? new Set(p.keys) : null;
    const picked = key => !only || only.has(key);
    const safe = Object.fromEntries(Object.entries(globalThis.FPTRetiredIntegrations.sanitizeSettings(data.settings)).filter(([key]) => isExportable(key) && key !== 'fpToolsAutoReplies' && picked(key)));
    if (safe.fpToolsPageModes && typeof safe.fpToolsPageModes === 'object' && !Array.isArray(safe.fpToolsPageModes)) {
        const pageModes = { ...safe.fpToolsPageModes };
        delete pageModes.piggy_banks;
        delete pageModes.calculator;
        delete pageModes.currency_calc;
        safe.fpToolsPageModes = pageModes;
    }
    normalizeImportedSettings(safe);
    await chrome.storage.local.set(safe);
    const withReplies = Object.hasOwn(data.settings, 'fpToolsAutoReplies') && picked('fpToolsAutoReplies');
    if (withReplies) await window.fptImportAutoReplies(data.settings.fpToolsAutoReplies);
    return { count: Object.keys(safe).length + Number(withReplies) };
}
// Ключи файла, которые импорт действительно запишет: предпросмотр не показывает то, что будет отброшено.
function getImportableKeys(p = {}) {
    const settings = p.data?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
    return Object.keys(globalThis.FPTRetiredIntegrations.sanitizeSettings(settings)).filter(key => isExportable(key));
}
// Сводка для экрана «Перенос настроек»: что войдёт в файл, история копий и счётчики для сброса.
async function getSettingsIOSummary() {
    const backup = await getPopupSettingsExport();
    const stored = await chrome.storage.local.get(['fpToolsAutoReplies', 'fpToolsPinnedLots', 'fpToolsCtxPinnedLots', 'fpToolsSettingsIOHistory']);
    const length = value => Array.isArray(value) ? value.length : 0;
    const history = stored.fpToolsSettingsIOHistory;
    return {
        backup,
        history: history && typeof history === 'object' && !Array.isArray(history) ? history : {},
        counts: {
            processed: length(stored.fpToolsAutoReplies?.processedMessageIds),
            greeted: length(stored.fpToolsAutoReplies?.greetedUsers),
            pinned: length(stored.fpToolsPinnedLots) + length(stored.fpToolsCtxPinnedLots)
        }
    };
}
function markSettingsIO(p = {}) {
    const patch = {};
    if (Number.isFinite(p.exportedAt)) patch.lastExportAt = p.exportedAt;
    if (Number.isFinite(p.importedAt)) {
        patch.lastImportAt = p.importedAt;
        patch.lastImportName = String(p.name || '').slice(0, 200);
    }
    return window.fptPopupActions.updateSettings(['fpToolsSettingsIOHistory'], current => ({
        fpToolsSettingsIOHistory: { ...(current.fpToolsSettingsIOHistory || {}), ...patch }
    })).then(next => next.fpToolsSettingsIOHistory);
}
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const register = (id, fn) => window.fptPopupActions.register('settings_io', id, fn);
    register('fp-settings-export-btn', getPopupSettingsExport);
    register('fp-settings-import-btn', importPopupSettings);
    register('settings-io-summary', getSettingsIOSummary);
    register('settings-io-importable', getImportableKeys);
    register('settings-io-mark', markSettingsIO);
    register('fp-reset-autoresponder-btn', async () => {
        await chrome.storage.local.remove('fpToolsAutoResponderTag');
        return window.fptPatchAutoReplies({ set: { processedMessageIds: [] } });
    });
    register('fp-reset-pinned-btn', () => chrome.storage.local.remove(['fpToolsPinnedLots', 'fpToolsCtxPinnedLots']));
    register('fp-reset-greeted-btn', () => window.fptPatchAutoReplies({ set: { greetedUsers: [] } }));
    register('fp-reset-april-btn', async () => {
        const year = new Date().getFullYear();
        for (const key of [`fpApril_${year}_done`, `fpApril_${year-1}_done`]) localStorage.removeItem(key);
        for (const key of ['fpAprilReloads', 'fpAprilActive']) sessionStorage.removeItem(key);
        return chrome.storage.local.remove([`fpApril_${year}_done`, `fpApril_${year-1}_done`, `fpApril_${year+1}_done`, 'fpAprilReloads', 'fpAprilActive']);
    });
}
