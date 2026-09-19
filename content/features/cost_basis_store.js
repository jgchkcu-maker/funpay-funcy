/**
 * FunPay Tools — Cost Basis Store (T04)
 *
 * Локальное CRUD-хранилище себестоимости:
 * - Постоянные записи: chrome.storage.local['fpToolsCostBasis']
 * - Черновики создания лотов: sessionStorage['fptCostBasisDraft:<ctx>']
 *
 * Инварианты и правила:
 * - amount > 0 only;
 * - empty/0 => no entry;
 * - currency обязателен;
 * - nodeId и offerId валидируются;
 * - версионированное хранилище (version: 1);
 * - tab-scoped sessionStorage draft с TTL 2 часа;
 * - две вкладки не разделяют один глобальный черновик (гарантия sessionStorage);
 * - черновик удаляется только после успешного bind к offerId;
 * - строго локально: данные никогда не отправляются на FunPay;
 * - никакого UI и расчета прибыли до последующих задач.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'fpToolsCostBasis';
    const STORAGE_VERSION = 1;
    const DRAFT_KEY_PREFIX = 'fptCostBasisDraft:';
    const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

    // In-memory fallbacks for non-browser / Node.js test environments
    const memoryStorage = {};
    let sessionDriverOverride = null;
    const memorySession = {
        _items: {},
        getItem(key) { return Object.prototype.hasOwnProperty.call(this._items, key) ? this._items[key] : null; },
        setItem(key, val) { this._items[key] = String(val); },
        removeItem(key) { delete this._items[key]; },
        clear() { this._items = {}; }
    };

    /**
     * Получить драйвер sessionStorage.
     * @returns {Storage|Object}
     */
    function getSessionDriver() {
        if (sessionDriverOverride) return sessionDriverOverride;
        if (typeof window !== 'undefined' && window.sessionStorage) {
            return window.sessionStorage;
        }
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage;
        }
        return memorySession;
    }

    /**
     * Чтение ключа из chrome.storage.local или fallback.
     * @param {string} key
     * @returns {Promise<Object>}
     */
    async function rawStorageGet(key) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                const res = chrome.storage.local.get(key);
                if (res && typeof res.then === 'function') {
                    return await res;
                }
            } catch (_) {}
            return new Promise((resolve) => {
                try {
                    chrome.storage.local.get([key], (data) => resolve(data || {}));
                } catch (e) {
                    resolve({});
                }
            });
        }
        return { [key]: memoryStorage[key] };
    }

    /**
     * Запись объекта в chrome.storage.local или fallback.
     * @param {Object} items
     * @returns {Promise<void>}
     */
    async function rawStorageSet(items) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                const res = chrome.storage.local.set(items);
                if (res && typeof res.then === 'function') {
                    return await res;
                }
            } catch (_) {}
            return new Promise((resolve) => {
                try {
                    chrome.storage.local.set(items, () => resolve());
                } catch (e) {
                    resolve();
                }
            });
        }
        Object.assign(memoryStorage, items);
    }

    /**
     * Загрузка структуры хранилища себестоимости.
     * @returns {Promise<{version: number, offers: Object}>}
     */
    async function loadStorage() {
        const raw = await rawStorageGet(STORAGE_KEY);
        const data = raw && raw[STORAGE_KEY];
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const version = typeof data.version === 'number' ? data.version : STORAGE_VERSION;
            const offers = data.offers && typeof data.offers === 'object' && !Array.isArray(data.offers)
                ? { ...data.offers }
                : {};
            return { version, offers };
        }
        return {
            version: STORAGE_VERSION,
            offers: {}
        };
    }

    /**
     * Сохранение структуры хранилища себестоимости.
     * @param {{version: number, offers: Object}} store
     * @returns {Promise<void>}
     */
    async function saveStorage(store) {
        await rawStorageSet({ [STORAGE_KEY]: store });
    }

    /**
     * Нормализация offerId (строка или число -> непустая строка).
     * @param {*} val
     * @returns {string|null}
     */
    function normalizeOfferId(val) {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        return s.length > 0 ? s : null;
    }

    /**
     * Нормализация nodeId категории (строка или число -> строка или null).
     * @param {*} val
     * @returns {string|null}
     */
    function normalizeNodeId(val) {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        return s.length > 0 ? s : null;
    }

    /**
     * Нормализация валюты (RUB, USD, EUR и т.д.).
     * @param {*} curr
     * @returns {string|null}
     */
    function normalizeCurrency(curr) {
        if (!curr || typeof curr !== 'string') return null;
        const c = curr.trim().toUpperCase();
        if (!c) return null;
        if (c === '₽' || c === 'РУБ' || c === 'RUB') return 'RUB';
        if (c === '$' || c === 'USD') return 'USD';
        if (c === '€' || c === 'EUR') return 'EUR';
        if (/^[A-Z0-9]{2,10}$/.test(c)) return c;
        return null;
    }

    /**
     * Нормализация amount: конечное число > 0, округление до 2 знаков.
     * Пусто, null, 0 или отрицательное -> 0 (индикатор отсутствия).
     * @param {*} val
     * @returns {number|null} число > 0, либо 0 если <= 0, либо null если некорректный ввод.
     */
    function normalizeAmount(val) {
        if (val === null || val === undefined || val === '') return 0;
        let n;
        if (typeof val === 'number') {
            n = val;
        } else if (typeof val === 'string') {
            const cleaned = val.replace(/\s/g, '').replace(',', '.');
            n = parseFloat(cleaned);
        } else {
            return null;
        }
        if (!Number.isFinite(n) || isNaN(n)) return null;
        n = Math.round(n * 100) / 100;
        if (n <= 0) return 0;
        return n;
    }

    /**
     * Разрешение контекста черновика (строка, число или свойство объекта).
     * @param {*} ctx
     * @param {*} data
     * @returns {string|null}
     */
    function resolveDraftContext(ctx, data) {
        if (typeof ctx === 'string' || typeof ctx === 'number') {
            const s = String(ctx).trim();
            if (s) return s;
        }
        if (ctx && typeof ctx === 'object') {
            const fromObj = ctx.context || ctx.ctx || ctx.nodeId;
            if (fromObj !== null && fromObj !== undefined) {
                const s = String(fromObj).trim();
                if (s) return s;
            }
        }
        if (data && typeof data === 'object') {
            const fromData = data.context || data.ctx || data.nodeId;
            if (fromData !== null && fromData !== undefined) {
                const s = String(fromData).trim();
                if (s) return s;
            }
        }
        return null;
    }

    // =========================================================================
    // Публичное API
    // =========================================================================

    /**
     * Получить себестоимость по ID оффера.
     * @param {string|number} offerId
     * @returns {Promise<Object|null>}
     */
    async function get(offerId) {
        const id = normalizeOfferId(offerId);
        if (!id) return null;

        const store = await loadStorage();
        const entry = store.offers && store.offers[id];
        if (!entry) return null;

        const amount = normalizeAmount(entry.amount);
        const currency = normalizeCurrency(entry.currency);
        if (!amount || amount <= 0 || !currency) {
            return null;
        }

        return {
            offerId: id,
            nodeId: normalizeNodeId(entry.nodeId),
            amount: amount,
            currency: currency,
            updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : null,
            source: entry.source || 'manual'
        };
    }

    /**
     * Установить себестоимость оффера.
     * Если amount равен 0 или пустой — запись удаляется из хранилища.
     * @param {string|number} offerId
     * @param {Object|number|string} data { amount, currency, nodeId?, source? }
     * @returns {Promise<Object|null>}
     */
    async function set(offerId, data) {
        const id = normalizeOfferId(offerId);
        if (!id) {
            throw new Error('FPTCostBasis.set: valid offerId is required');
        }

        // Если передано просто число/строка вместо объекта
        const inputData = (data && typeof data === 'object') ? data : { amount: data };
        const amount = normalizeAmount(inputData.amount);

        // empty/0 => no entry (удалить из хранилища)
        if (amount === 0 || amount === null) {
            await remove(id);
            return null;
        }

        const currency = normalizeCurrency(inputData.currency);
        if (!currency) {
            throw new Error('FPTCostBasis.set: currency is required and must be valid');
        }

        const nodeId = normalizeNodeId(inputData.nodeId);
        const source = (typeof inputData.source === 'string' && inputData.source.trim())
            ? inputData.source.trim()
            : 'manual';

        const record = {
            offerId: id,
            nodeId: nodeId,
            amount: amount,
            currency: currency,
            updatedAt: Date.now(),
            source: source
        };

        const store = await loadStorage();
        store.offers[id] = record;
        await saveStorage(store);

        return { ...record };
    }

    /**
     * Удалить запись себестоимости по offerId.
     * @param {string|number} offerId
     * @returns {Promise<boolean>}
     */
    async function remove(offerId) {
        const id = normalizeOfferId(offerId);
        if (!id) return false;

        const store = await loadStorage();
        if (store.offers && Object.prototype.hasOwnProperty.call(store.offers, id)) {
            delete store.offers[id];
            await saveStorage(store);
            return true;
        }
        return false;
    }

    /**
     * Получить все сохранённые офферы.
     * @returns {Promise<Object>}
     */
    async function getAll() {
        const store = await loadStorage();
        const result = {};
        if (store.offers && typeof store.offers === 'object') {
            for (const [key, entry] of Object.entries(store.offers)) {
                if (!entry || typeof entry !== 'object') continue;
                const id = normalizeOfferId(entry.offerId) || normalizeOfferId(key);
                if (!id) continue;
                const amount = normalizeAmount(entry.amount);
                const currency = normalizeCurrency(entry.currency);
                if (!amount || amount <= 0 || !currency) continue;

                result[id] = {
                    offerId: id,
                    nodeId: normalizeNodeId(entry.nodeId),
                    amount: amount,
                    currency: currency,
                    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : null,
                    source: entry.source || 'manual'
                };
            }
        }
        return result;
    }

    /**
     * Экспорт всего хранилища.
     * @returns {Promise<{version: number, offers: Object}>}
     */
    async function exportData() {
        const offers = await getAll();
        return {
            version: STORAGE_VERSION,
            offers: offers
        };
    }

    /**
     * Импорт данных в хранилище.
     * @param {Object} payload { version?, offers: Object }
     * @param {{merge?: boolean}} [options]
     * @returns {Promise<{success: boolean, imported: number, total: number}>}
     */
    async function importData(payload, { merge = true } = {}) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('FPTCostBasis.importData: payload must be an object');
        }
        const incomingOffers = payload.offers;
        if (!incomingOffers || typeof incomingOffers !== 'object' || Array.isArray(incomingOffers)) {
            throw new Error('FPTCostBasis.importData: offers map is required');
        }

        const store = merge ? await loadStorage() : { version: STORAGE_VERSION, offers: {} };
        let count = 0;

        for (const [key, raw] of Object.entries(incomingOffers)) {
            if (!raw || typeof raw !== 'object') continue;
            const id = normalizeOfferId(raw.offerId) || normalizeOfferId(key);
            if (!id) continue;

            const amount = normalizeAmount(raw.amount);
            const currency = normalizeCurrency(raw.currency);
            if (!amount || amount <= 0 || !currency) continue;

            store.offers[id] = {
                offerId: id,
                nodeId: normalizeNodeId(raw.nodeId),
                amount: amount,
                currency: currency,
                updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
                source: raw.source || 'import'
            };
            count++;
        }

        store.version = STORAGE_VERSION;
        await saveStorage(store);

        return {
            success: true,
            imported: count,
            total: Object.keys(store.offers).length
        };
    }

    /**
     * Сохранить черновик себестоимости в sessionStorage.
     * @param {string|number|Object} ctxOrData
     * @param {Object} [maybeData]
     * @returns {Object|null}
     */
    function saveDraft(ctxOrData, maybeData) {
        let ctx = null;
        let data = null;
        if (maybeData !== undefined) {
            ctx = resolveDraftContext(ctxOrData, maybeData);
            data = maybeData;
        } else if (ctxOrData && typeof ctxOrData === 'object') {
            ctx = resolveDraftContext(ctxOrData, null);
            data = ctxOrData;
        } else {
            ctx = resolveDraftContext(ctxOrData, null);
        }

        if (!ctx) {
            throw new Error('FPTCostBasis.saveDraft: context identifier is required');
        }

        if (!data || typeof data !== 'object') {
            clearDraft(ctx);
            return null;
        }

        const amount = normalizeAmount(data.amount);
        if (!amount || amount <= 0) {
            clearDraft(ctx);
            return null;
        }

        const currency = normalizeCurrency(data.currency);
        if (!currency) {
            throw new Error('FPTCostBasis.saveDraft: currency is required and must be valid');
        }

        const nodeId = normalizeNodeId(data.nodeId) || (normalizeNodeId(ctx) ? String(ctx).trim() : null);
        const draftKey = DRAFT_KEY_PREFIX + ctx;
        const draft = {
            context: ctx,
            nodeId: nodeId,
            amount: amount,
            currency: currency,
            createdAt: Date.now()
        };

        const session = getSessionDriver();
        try {
            session.setItem(draftKey, JSON.stringify(draft));
        } catch (e) {
            console.warn('[FPTCostBasis] Failed to save draft to sessionStorage:', e);
        }

        return { ...draft };
    }

    /**
     * Получить черновик себестоимости из sessionStorage с проверкой TTL (2ч).
     * @param {string|number|Object} ctx
     * @returns {Object|null}
     */
    function getDraft(ctx) {
        const resolvedCtx = resolveDraftContext(ctx, null);
        if (!resolvedCtx) return null;

        const draftKey = DRAFT_KEY_PREFIX + resolvedCtx;
        const session = getSessionDriver();
        let raw = null;
        try {
            raw = session.getItem(draftKey);
        } catch (e) {
            return null;
        }
        if (!raw) return null;

        try {
            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== 'object') {
                clearDraft(resolvedCtx);
                return null;
            }

            const now = Date.now();
            const createdAt = typeof draft.createdAt === 'number' ? draft.createdAt : 0;
            if (now - createdAt > DRAFT_TTL_MS || createdAt <= 0) {
                // Draft expired
                clearDraft(resolvedCtx);
                return null;
            }

            const amount = normalizeAmount(draft.amount);
            const currency = normalizeCurrency(draft.currency);
            if (!amount || amount <= 0 || !currency) {
                clearDraft(resolvedCtx);
                return null;
            }

            return {
                context: resolvedCtx,
                nodeId: normalizeNodeId(draft.nodeId),
                amount: amount,
                currency: currency,
                createdAt: createdAt
            };
        } catch (e) {
            clearDraft(resolvedCtx);
            return null;
        }
    }

    /**
     * Удалить черновик себестоимости из sessionStorage.
     * @param {string|number|Object} ctx
     * @returns {boolean}
     */
    function clearDraft(ctx) {
        const resolvedCtx = resolveDraftContext(ctx, null);
        if (!resolvedCtx) return false;

        const draftKey = DRAFT_KEY_PREFIX + resolvedCtx;
        const session = getSessionDriver();
        try {
            session.removeItem(draftKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Привязать черновик к фактическому offerId и удалить черновик.
     * Черновик удаляется ТОЛЬКО после успешной записи в постоянное хранилище.
     * @param {string|number|Object} ctx
     * @param {string|number} offerId
     * @returns {Promise<Object|null>}
     */
    async function bindDraftToOffer(ctx, offerId) {
        const id = normalizeOfferId(offerId);
        if (!id) {
            throw new Error('FPTCostBasis.bindDraftToOffer: valid offerId is required');
        }

        const draft = getDraft(ctx);
        if (!draft) {
            return null;
        }

        // Сохранение в постоянное хранилище
        const saved = await set(id, {
            amount: draft.amount,
            currency: draft.currency,
            nodeId: draft.nodeId,
            source: 'draft'
        });

        // Удаление черновика только после успешного сохранения
        clearDraft(ctx);

        return saved;
    }

    // Вспомогательный метод для тестов изоляции (не используется в проде)
    function _setSessionDriver(driver) {
        sessionDriverOverride = driver;
    }

    const api = {
        get,
        set,
        remove,
        getAll,
        exportData,
        importData,
        saveDraft,
        getDraft,
        clearDraft,
        bindDraftToOffer,
        _setSessionDriver
    };

    root.FPTCostBasis = api;
    if (typeof window !== 'undefined') {
        window.FPTCostBasis = api;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.FPTCostBasis = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
