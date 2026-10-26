/*
 * FunPay Funcy — свой конфиг у каждого аккаунта FunPay.
 *
 * Все функции продолжают читать прежние ключи chrome.storage.local («живые» ключи).
 * Они принадлежат одному аккаунту — владельцу (PROFILE_OWNER_KEY). При смене аккаунта
 * конфиг владельца сохраняется в закрытое хранилище (account_vault.js), а на его место
 * загружается конфиг нового аккаунта; новый аккаунт получает стандартные настройки.
 *
 * Расписания, цены и политики лотов (fpToolsLotSchedules, fpToolsPricing, fpToolsLotPolicies)
 * сюда не входят: они уже хранят accountId в каждом правиле и сами работают только для
 * текущего аккаунта. Статистика и финансы живут в IndexedDB и тоже не переключаются.
 */

// Конфиг: переключается вместе с аккаунтом и переносится синхронизацией.
export const ACCOUNT_CONFIG_KEYS = Object.freeze([
    'fpToolsAutoReplies',
    'autoBumpEnabled',
    'autoBumpCooldown',
    'fpToolsSelectiveBumpEnabled',
    'fpToolsSelectedBumpCategories',
    'fpToolsBumpOnlyAutoDelivery',
    'fpToolsSupportAutoTicket',
    'fpToolsLegacyADModeEnabled',
    'fpToolsTemplateSettings',
    'fpToolsSlashCommands',
    'fpToolsBlacklist',
    'fpToolsCustomLabels',
    'fpToolsUserStatuses',
    'fpToolsDearVendors'
]);

// Данные аккаунта: переключаются, но не синхронизируются — в них ID лотов и чатов,
// которые у другого аккаунта ничего не значат.
export const ACCOUNT_DATA_KEYS = Object.freeze([
    'fpToolsAutoDeliveryLots',
    'fpToolsAutoDeliveryLotsCache',
    'fpToolsDeactivatedLots',
    'fpToolsPinnedLots',
    'fpToolsCtxPinnedLots',
    'fpToolsCostBasis',
    'fpToolsPinnedChats',
    'fpToolsChatDrafts',
    'fpToolsSmartBumpState',
    'fpToolsAutoBumpLogs',
    'fptPendingVerifyLots',
    'fptLastVerifyAt'
]);

export const ACCOUNT_PROFILE_KEYS = Object.freeze([...ACCOUNT_CONFIG_KEYS, ...ACCOUNT_DATA_KEYS]);
export const PROFILE_OWNER_KEY = 'fpToolsProfileOwner';
export const PROFILE_NOTICE_KEY = 'fpToolsProfileNotice';
const RUNNER_TAG_KEY = 'fpToolsAutoResponderTag';
const SYNC_BACKUP = 'syncBackup';

// Новый аккаунт: автоматизация выключена, остальное — значения функций по умолчанию.
export const PROFILE_DEFAULTS = Object.freeze({ fpToolsAutoReplies: {}, autoBumpEnabled: false, autoBumpCooldown: 245 });

// Что автоответчик помнит о прочитанных чатах. При загрузке конфига сбрасывается, чтобы
// чаты, пришедшие, пока аккаунт был неактивен, запомнились заново, а не получили ответы пачкой.
const CHAT_SEEN_FIELDS = Object.freeze(['lastSeenMsgIds', 'lastHandledText', 'autoResponderSeeded']);

const AUTO_REPLY_SWITCHES = Object.freeze(['greetingEnabled', 'keywordsEnabled', 'autoReviewEnabled', 'bonusForReviewEnabled',
    'newOrderReplyEnabled', 'orderConfirmReplyEnabled', 'autoDeliveryEnabled', 'reviewReminderEnabled']);

// Включено ли в наборе настроек что-то, что действует от имени аккаунта без продавца.
export function automationEnabledIn(values = {}) {
    const replies = values.fpToolsAutoReplies || {};
    return AUTO_REPLY_SWITCHES.some(flag => Boolean(replies[flag])) || Boolean(values.autoBumpEnabled);
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => (value === undefined ? undefined : structuredClone(value));
const pick = (source, keys) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, clone(source[key])]));
const accountIdOf = value => (value != null && /^\d+$/.test(String(value)) ? String(value) : null);

// storage — chrome.storage.local-подобный объект; vault — createAccountVault();
// replaceAutoReplies(value, extra) — запись fpToolsAutoReplies через общую очередь автоответчика;
// runtimeFields — служебные поля автоответчика, которые не переносятся синхронизацией.
export function createProfileManager({ storage, vault, replaceAutoReplies = null, runtimeFields = [], now = () => Date.now() } = {}) {
    if (!storage || !vault) throw new Error('Конфиги аккаунтов не настроены.');
    const runtime = new Set([...runtimeFields, ...CHAT_SEEN_FIELDS]);
    let chain = Promise.resolve();
    function serialize(task) {
        const run = chain.then(task, task);
        chain = run.catch(() => {});
        return run;
    }

    async function readOwner() {
        const { [PROFILE_OWNER_KEY]: owner } = await storage.get(PROFILE_OWNER_KEY);
        return isRecord(owner) ? { accountId: accountIdOf(owner.accountId), at: Number(owner.at) || 0 } : null;
    }
    async function readLive(keys = ACCOUNT_PROFILE_KEYS) {
        return pick(await storage.get([...keys]), keys);
    }

    // Записывает набор значений в живые ключи. Ключи из `keys`, которых нет в values, удаляются.
    // fpToolsAutoReplies и маркер владельца уходят одной записью: фон по маркеру понимает,
    // что это смена конфига, а не правка продавца.
    async function writeLive(values, keys, marker) {
        const absent = keys.filter(key => values[key] === undefined && key !== 'fpToolsAutoReplies');
        if (absent.length) await storage.remove(absent);
        const rest = pick(values, keys.filter(key => key !== 'fpToolsAutoReplies'));
        const extra = marker ? { ...rest, [PROFILE_OWNER_KEY]: marker } : rest;
        if (keys.includes('fpToolsAutoReplies')) {
            const replies = isRecord(values.fpToolsAutoReplies) ? values.fpToolsAutoReplies : {};
            if (replaceAutoReplies) await replaceAutoReplies(replies, extra);
            else await storage.set({ ...extra, fpToolsAutoReplies: clone(replies) });
        } else if (Object.keys(extra).length) {
            await storage.set(extra);
        }
    }

    function withoutChatSeen(values) {
        const next = clone(values);
        if (isRecord(next.fpToolsAutoReplies)) CHAT_SEEN_FIELDS.forEach(field => delete next.fpToolsAutoReplies[field]);
        return next;
    }

    async function suspendInside() {
        const owner = await readOwner();
        const values = await readLive();
        if (owner?.accountId) await vault.putProfile(owner.accountId, { values, savedAt: now() });
        await writeLive({ ...PROFILE_DEFAULTS }, ACCOUNT_PROFILE_KEYS, { accountId: null, previous: owner?.accountId || null, at: now() });
        return { previous: owner?.accountId || null };
    }

    async function activateInside(accountId) {
        const id = accountIdOf(accountId);
        if (!id) throw new Error('Аккаунт FunPay не определён.');
        const profile = await vault.getProfile(id);
        const values = withoutChatSeen({ ...PROFILE_DEFAULTS, ...(isRecord(profile?.values) ? profile.values : {}) });
        await storage.remove(RUNNER_TAG_KEY);
        await writeLive(values, ACCOUNT_PROFILE_KEYS, { accountId: id, at: now() });
        if (!profile) await storage.set({ [PROFILE_NOTICE_KEY]: { accountId: id, at: now() } });
        return { accountId: id, created: !profile };
    }

    // Конфиг аккаунта для чтения: живые ключи у владельца, сохранённый профиль у остальных.
    async function configOf(accountId, owner) {
        if (owner?.accountId === accountId) return { values: await readLive(), live: true, exists: true };
        const profile = await vault.getProfile(accountId);
        return { values: isRecord(profile?.values) ? profile.values : {}, live: false, exists: Boolean(profile) };
    }

    // Настройки автоответов из конфига, но служебные поля (кому уже ответили, что выдали) —
    // текущие у получателя, иначе возможны повторные ответы и выдачи.
    function withTargetRuntime(config, targetValues) {
        const next = clone(config);
        const source = isRecord(next.fpToolsAutoReplies) ? next.fpToolsAutoReplies : {};
        const target = isRecord(targetValues.fpToolsAutoReplies) ? targetValues.fpToolsAutoReplies : {};
        const replies = Object.fromEntries(Object.entries(source).filter(([field]) => !runtime.has(field)));
        for (const field of runtime) if (target[field] !== undefined) replies[field] = clone(target[field]);
        next.fpToolsAutoReplies = replies;
        return next;
    }

    async function writeConfig(accountId, config, owner) {
        if (owner?.accountId === accountId) {
            await writeLive(config, ACCOUNT_CONFIG_KEYS, null);
            return true;
        }
        const profile = await vault.getProfile(accountId);
        const values = { ...pick(isRecord(profile?.values) ? profile.values : {}, ACCOUNT_DATA_KEYS), ...config };
        await vault.putProfile(accountId, { values, savedAt: now() });
        return false;
    }

    return Object.freeze({
        owner: readOwner,

        // Сохраняет конфиг владельца и выключает его автоматизацию. Владельца больше нет.
        suspend: () => serialize(suspendInside),

        // Загружает конфиг аккаунта (или стандартный) и делает его владельцем.
        activate: accountId => serialize(() => activateInside(accountId)),

        // Сверяет владельца с аккаунтом, в который сейчас выполнен вход.
        // Первый запуск: живые ключи уже принадлежат текущему аккаунту, они только помечаются.
        reconcile: accountId => serialize(async () => {
            const id = accountIdOf(accountId);
            if (!id) return { changed: false };
            const owner = await readOwner();
            if (!owner) {
                await storage.set({ [PROFILE_OWNER_KEY]: { accountId: id, at: now() } });
                return { changed: false, migrated: true, accountId: id };
            }
            if (owner.accountId === id) return { changed: false, accountId: id };
            const from = owner.accountId;
            if (from) await suspendInside();
            const result = await activateInside(id);
            return { changed: true, from, ...result };
        }),

        // { exists, automation } для текстов подтверждений.
        summary: accountId => serialize(async () => {
            const id = accountIdOf(accountId);
            if (!id) return { exists: false, automation: false };
            const config = await configOf(id, await readOwner());
            return { exists: config.exists, automation: automationEnabledIn(config.values), live: config.live };
        }),

        // Переносит конфиг fromId → toId. Данные аккаунта и служебные поля автоответчика
        // остаются у получателя. Предыдущий конфиг получателя сохраняется для отмены.
        sync: (fromId, toId) => serialize(async () => {
            const from = accountIdOf(fromId);
            const to = accountIdOf(toId);
            if (!from || !to) throw new Error('Аккаунт не определён — обновите его данные.');
            if (from === to) throw new Error('Выберите разные аккаунты.');
            const owner = await readOwner();
            const source = await configOf(from, owner);
            if (!source.exists) throw new Error('У аккаунта-источника ещё нет своих настроек.');
            const target = await configOf(to, owner);
            const previous = pick(target.values, ACCOUNT_CONFIG_KEYS);
            const config = withTargetRuntime(pick(source.values, ACCOUNT_CONFIG_KEYS), target.values);
            await vault.putMeta(SYNC_BACKUP, { accountId: to, from, values: previous, at: now() });
            const live = await writeConfig(to, config, owner);
            const { [PROFILE_NOTICE_KEY]: notice } = await storage.get(PROFILE_NOTICE_KEY);
            if (notice?.accountId === to) await storage.remove(PROFILE_NOTICE_KEY);
            return { from, to, live, automation: automationEnabledIn(config) };
        }),

        lastSync: () => vault.getMeta(SYNC_BACKUP),

        // Возвращает получателю последней синхронизации прежний конфиг.
        undoSync: () => serialize(async () => {
            const backup = await vault.getMeta(SYNC_BACKUP);
            if (!backup?.accountId) throw new Error('Нечего отменять.');
            const owner = await readOwner();
            const current = await configOf(backup.accountId, owner);
            const values = withTargetRuntime(isRecord(backup.values) ? backup.values : {}, current.values);
            const live = await writeConfig(backup.accountId, values, owner);
            await vault.deleteMeta(SYNC_BACKUP);
            return { accountId: backup.accountId, live };
        })
    });
}
