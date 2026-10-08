const FPT_SLASH_KEY = 'fpToolsSlashCommands';
const FPT_SLASH_DEFAULTS = { enabled: true, expandKey: 'both', autocomplete: true, commands: [] };
let _fptSlashCfg = null;
let _fptSlashPanel = null;

async function fptSlashLoad() {
    const r = await chrome.storage.local.get(FPT_SLASH_KEY);
    _fptSlashCfg = Object.assign({}, FPT_SLASH_DEFAULTS, r[FPT_SLASH_KEY] || {});
    if (!Array.isArray(_fptSlashCfg.commands)) _fptSlashCfg.commands = [];
    return _fptSlashCfg;
}
async function fptSlashSave() {
    await chrome.storage.local.set({ [FPT_SLASH_KEY]: _fptSlashCfg });
}

function fptSlashNormalizeTrigger(t) {
    t = (t || '').trim().replace(/\s+/g, '');
    if (!t) return '';
    if (!t.startsWith('/')) t = '/' + t;
    return t;
}

if (typeof window !== 'undefined' && window.fptPopupActions) {
    window.fptPopupActions.register('templates', 'fptSlashAddBtn', async p => {
        const result = await window.fptPopupActions.updateSettings(FPT_SLASH_KEY, current => {
            const config = { ...(current[FPT_SLASH_KEY] || {}), commands: [...(current[FPT_SLASH_KEY]?.commands || [])] };
            let id = Date.now(); while (config.commands.some(command => command.id === String(id))) id++;
            config.commands.push({ id: String(id), trigger: fptSlashNormalizeTrigger(p.trigger) || '/', response: p.response || '' });
            _fptSlashCfg = config;
            return { [FPT_SLASH_KEY]: config };
        });
        return result[FPT_SLASH_KEY];
    });
    window.fptPopupActions.register('templates', 'saveSlashCommand', async p => {
        const result = await window.fptPopupActions.updateSettings(FPT_SLASH_KEY, current => {
        const config = { ...(current[FPT_SLASH_KEY] || {}), commands: [...(current[FPT_SLASH_KEY]?.commands || [])] };
        const index = config.commands.findIndex(command => command.id === p.id);
        if (index < 0) throw new Error('Команда не найдена.');
        if (p.remove) config.commands.splice(index, 1);
        else {
            const settings = { ...p.settings };
            if (Object.hasOwn(settings, 'trigger')) settings.trigger = fptSlashNormalizeTrigger(settings.trigger);
            config.commands[index] = { ...config.commands[index], ...settings };
        }
        _fptSlashCfg = config;
        return { [FPT_SLASH_KEY]: config };
        });
        return result[FPT_SLASH_KEY];
    });
}
