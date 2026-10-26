export const OLD_DEFAULT_BACKGROUND = 'https://i.ibb.co/ZpS0d56R/PH6-UEvp-Kn-KI.jpg';
const retiredSounds = new Set(['vk', 'tg', 'iphone', 'discord', 'whatsapp']);
function migrateConfig(config) {
    if (!config || typeof config !== 'object') return config;
    const next = { ...config };
    if (retiredSounds.has(next.notificationSound)) next.notificationSound = 'default';
    if (next.fpToolsTheme?.bgImage === OLD_DEFAULT_BACKGROUND) {
        next.fpToolsTheme = { ...next.fpToolsTheme, bgImage: null };
    }
    return next;
}
export async function migrateRelease(storage, alarms) {
    await alarms.clear('fpToolsAccountKeepalive');
    const data = await storage.get(null);
    const next = migrateConfig(data);
    const patch = {};
    for (const key of ['notificationSound', 'fpToolsTheme']) {
        if (JSON.stringify(data[key]) !== JSON.stringify(next[key])) patch[key] = next[key];
    }
    // Account profiles use the same config keys; session vault and credentials are untouched.
    if (Object.keys(patch).length) await storage.set(patch);
    return patch;
}
