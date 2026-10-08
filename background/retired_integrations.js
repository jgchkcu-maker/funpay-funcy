// Shared retirement policy for the worker and settings backups.
(function (root) {
    'use strict';
    const RETIRED_PAGES = new Set(['telegram', 'support', 'global_chat']);
    const RETIRED_KEYS = new Set(['logToDiscord', 'discordWebhookUrl']);
    const RETIRED_ALARMS = ['fpToolsTelegramPoll', 'fpToolsDiscordCheck'];
    const isRetiredKey = key => RETIRED_KEYS.has(key)
        || /^(?:fpToolsTelegram|fpToolsDiscord|fpToolsProcessedDiscord|fpToolsGC|discordSent_)/.test(key);

    function sanitizeSettings(settings) {
        const result = Object.fromEntries(Object.entries(settings).filter(([key]) => !isRetiredKey(key)));
        if (RETIRED_PAGES.has(result.fpToolsLastPage)) {
            result.fpToolsLastPage = 'lot_io';
            result.fpToolsLastPageMode = null;
        }
        if (result.fpToolsPageModes && typeof result.fpToolsPageModes === 'object' && !Array.isArray(result.fpToolsPageModes)) {
            result.fpToolsPageModes = Object.fromEntries(Object.entries(result.fpToolsPageModes)
                .filter(([page]) => !RETIRED_PAGES.has(page)));
        }
        if (Array.isArray(result.fpToolsBlacklist)) {
            result.fpToolsBlacklist = result.fpToolsBlacklist.map(entry => {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
                const { blockNotification, ...retained } = entry;
                return retained;
            });
        }
        return result;
    }

    async function cleanup(storage, alarms) {
        await Promise.all(RETIRED_ALARMS.map(name => alarms.clear(name)));
        const saved = await storage.get(null);
        const sanitized = sanitizeSettings(saved);
        const removed = Object.keys(saved).filter(isRetiredKey);
        if (removed.length) await storage.remove(removed);
        const changes = {};
        for (const key of ['fpToolsLastPage', 'fpToolsLastPageMode', 'fpToolsPageModes', 'fpToolsBlacklist']) {
            if (Object.hasOwn(sanitized, key) && JSON.stringify(saved[key]) !== JSON.stringify(sanitized[key])) {
                changes[key] = sanitized[key];
            }
        }
        if (Object.keys(changes).length) await storage.set(changes);
    }

    const api = Object.freeze({ isRetiredKey, sanitizeSettings, cleanup });
    root.FPTRetiredIntegrations = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
