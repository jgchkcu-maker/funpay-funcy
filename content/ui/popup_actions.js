// Internal actions for replacement popup views. Never reads the settings DOM.
// register(pageId, actionId, handler); run(pageId, actionId, payload) -> Promise.
(function (root) {
    'use strict';
    const pages = new Set(['general', 'accounts', 'needs', 'templates', 'auto_review',
        'auto_reply', 'lot_io', 'finance_hub', 'theme', 'autobump',
        'effects', 'settings_io', 'blacklist', 'auto_delivery', 'tickets', 'sounds']);
    const actions = new Map();
    let writeQueue = Promise.resolve();
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    function merge(current, patch) {
        const result = { ...(object(current) ? current : {}) };
        for (const [key, value] of Object.entries(patch)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid settings key');
            result[key] = object(value) ? merge(result[key], value) : value;
        }
        return result;
    }
    function updateSettings(keys, updater, afterWrite) {
        const write = writeQueue.catch(() => {}).then(async () => {
            const current = await chrome.storage.local.get(keys);
            const next = await updater(current);
            if (!object(next)) throw new Error('Settings update must return an object');
            if (Object.hasOwn(next, 'fpToolsAutoReplies')) throw new Error('Use fptPatchAutoReplies for auto-reply settings');
            await chrome.storage.local.set(next);
            await afterWrite?.(next);
            return next;
        });
        writeQueue = write.catch(() => {});
        return write;
    }
    function removeSettings(keys, afterWrite) {
        const write = writeQueue.catch(() => {}).then(async () => {
            await chrome.storage.local.remove(keys);
            await afterWrite?.();
        });
        writeQueue = write.catch(() => {});
        return write;
    }
    async function saveSettings(payload = {}) {
        if (payload.patch) {
            if (typeof root.fptPatchAutoReplies !== 'function') throw new Error('fptPatchAutoReplies is unavailable');
            return root.fptPatchAutoReplies(payload.patch);
        }
        const patch = payload.settings;
        if (!object(patch)) throw new Error('settings must be an object');
        if (Object.hasOwn(patch, 'fpToolsAutoReplies')) throw new Error('Use fptPatchAutoReplies for auto-reply settings');
        const keys = Object.keys(patch);
        if (!keys.length) return {};
        return updateSettings(keys, current => merge(current, patch), async () => {
            if (keys.some(key => ['fpToolsTheme', 'enableCustomTheme'].includes(key))) {
                if (typeof root.applyCustomTheme === 'function') await root.applyCustomTheme();
                if (typeof root.applyHeaderPosition === 'function') await root.applyHeaderPosition();
                if (typeof root.applyFptMenuTransparency === 'function') await root.applyFptMenuTransparency();
            }
            if (Object.hasOwn(patch, 'autoBumpEnabled')) {
                await chrome.runtime.sendMessage({ action: patch.autoBumpEnabled ? 'startAutoBump' : 'stopAutoBump' });
            }
        });
    }
    function register(pageId, actionId, handler) {
        if (!pages.has(pageId) || !actionId || typeof handler !== 'function') throw new Error('Invalid popup action registration');
        const key = `${pageId}:${actionId}`;
        if (actions.has(key)) throw new Error(`Duplicate popup action: ${key}`);
        actions.set(key, handler);
    }
    pages.forEach(pageId => {
        register(pageId, 'getSettings', payload => chrome.storage.local.get(payload?.keys ?? null));
        register(pageId, 'saveSettings', saveSettings);
    });
    root.fptPopupActions = Object.freeze({
        register,
        updateSettings,
        removeSettings,
        toggleCategorySelection(payload = {}) {
            if (!Array.isArray(payload.categories)) throw new Error('categories must be an array');
            const selected = new Set(payload.selectedCategoryIds || []);
            const ids = payload.categories.map(category => category.id);
            const select = ids.some(id => !selected.has(id));
            ids.forEach(id => select ? selected.add(id) : selected.delete(id));
            return Array.from(selected);
        },
        async run(pageId, actionId, payload = {}) {
            const handler = actions.get(`${pageId}:${actionId}`);
            if (!handler) throw new Error(`Unknown popup action: ${pageId}:${actionId}`);
            return handler(payload);
        },
        list(pageId) {
            return Array.from(actions.keys()).filter(key => key.startsWith(`${pageId}:`)).map(key => key.slice(pageId.length + 1));
        }
    });
})(window);
