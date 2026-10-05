// Theme catalogue data and application. Replacement views own the presentation.
(function () {
    const base = 'https://raw.githubusercontent.com/XaviersDev/fpt-themes/main/';
    let catalogue = null, index = 0;
    const resolve = value => !value ? '' : /^https?:\/\//i.test(value) ? value : base + String(value).replace(/^\/+/, '');
    async function load() {
        if (catalogue) return catalogue;
        const response = await fetch(base + 'index.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Не удалось загрузить каталог тем.');
        const data = await response.json();
        catalogue = (Array.isArray(data) ? data : data.themes || []).map(theme => ({ ...theme,
            fileUrl: resolve(theme.file), previewUrl: resolve(theme.preview) }));
        return catalogue;
    }
    async function apply(p, enable = false) {
        const themes = await load();
        const theme = p.theme || themes[p.index ?? index];
        if (!theme?.fileUrl) throw new Error('Выберите тему.');
        const response = await fetch(theme.fileUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Не удалось загрузить тему.');
        const data = await response.json();
        if (!data?.bgColor1 || !data.font) throw new Error('Неверный формат темы.');
        const settings = fptSanitizeThemeColors(data);
        if (p.draftOnly) return settings;
        const patch = enable ? { fpToolsTheme: { ...settings, enableCustomTheme: true }, enableCustomTheme: true } : { fpToolsTheme: settings };
        await window.fptPopupActions.updateSettings(Object.keys(patch), () => patch,
            async () => { await applyCustomTheme(); await applyHeaderPosition(); });
        return settings;
    }
    if (!window.fptPopupActions) return;
    window.fptPopupActions.register('theme', 'getThemeCatalog', load);
    window.fptPopupActions.register('theme', 'loadCatalog', load);
    const onLoadOrApply = p => catalogue ? apply(p) : load();
    window.fptPopupActions.register('theme', 'fptg-load', onLoadOrApply);
    window.fptPopupActions.register('theme', 'onLoadOrApply', onLoadOrApply);
    window.fptPopupActions.register('theme', 'applyCurrent', apply);
    window.fptPopupActions.register('theme', 'fp-wp-apply-cur', p => apply(p, true));
    async function move(delta) {
        const themes = await load();
        if (!themes.length) return null;
        index = (index + delta + themes.length) % themes.length;
        return { theme: themes[index], index, total: themes.length };
    }
    window.fptPopupActions.register('theme', 'move', p => move(Number(p.direction) || 0));
    for (const [id, delta] of [['fp-wp-prev', -1], ['fp-wp-next', 1], ['fptg-prev', -1], ['fptg-next', 1]]) {
        window.fptPopupActions.register('theme', id, () => move(delta));
    }
})();
