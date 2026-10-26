// Public wallpaper catalogue. Only data and images are fetched; no remote code is executed.
(function (root) {
    'use strict';
    const BASE = 'https://raw.githubusercontent.com/jgchkcu-maker/funcy-assets/main/';
    const CACHE_KEY = 'fpToolsThemeCatalogCache';
    const CACHE_TTL = 5 * 60 * 1000;
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    let catalogRequest = null;
    const images = new Map();
    const APPROVED_WALLPAPERS = new Set([]); // See docs/store/assets.md.


    function assetUrl(path) {
        return typeof path === 'string' && /^wallpapers\/[\w/-]+\.(?:webp|png|jpe?g|gif)$/i.test(path)
            ? BASE + path : '';
    }
    function videoUrl(path) {
        return typeof path === 'string' ? globalThis.FPTSafe.wallpaperVideoUrl(BASE + path) : '';
    }

    function parseCatalog(value) {
        if (value?.version !== 1 || !Array.isArray(value.themes) || value.themes.length > 200) {
            throw new Error('Неверный формат каталога тем.');
        }
        const ids = new Set();
        return value.themes.map(item => {
            if (!item || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(item.id) || ids.has(item.id)
                || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
                || !assetUrl(item.wallpaper) || (item.video != null && !videoUrl(item.video))
                || !item.theme || typeof item.theme !== 'object' || Array.isArray(item.theme)) {
                throw new Error('Неверная запись в каталоге тем.');
            }
            ids.add(item.id);
            const theme = globalThis.FPTSafe.themeSettings(item.theme);
            delete theme.bgImage;
            delete theme.bgVideo;
            return { id: item.id, name: item.name, meta: String(item.meta || '').slice(0, 200),
                wallpaper: item.wallpaper, video: item.video || null, theme };
        }).filter(item => APPROVED_WALLPAPERS.has(item.wallpaper));
    }

    async function fetchWithTimeout(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-cache' });
            if (!response.ok) throw new Error(`GitHub вернул ошибку ${response.status}.`);
            // Keep the timeout active until the response body has arrived as well.
            const blob = await response.blob();
            return blob;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('GitHub не ответил вовремя. Попробуйте ещё раз.');
            if (error instanceof TypeError) throw new Error('Не удалось связаться с GitHub. Проверьте интернет и попробуйте снова.');
            throw error;
        } finally { clearTimeout(timer); }
    }

    async function loadCatalog({ refresh = false } = {}) {
        let cached;
        try { cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]; } catch (_) {}
        let cachedThemes = null;
        try { if (cached?.source === BASE) cachedThemes = parseCatalog(cached.catalog); } catch (_) {}
        if (!refresh && cachedThemes && Date.now() - cached.savedAt < CACHE_TTL) return { themes: cachedThemes, stale: false };
        try {
            const blob = await fetchWithTimeout(BASE + 'index.json');
            if (blob.size > 512 * 1024) throw new Error('Каталог тем слишком большой.');
            const catalog = JSON.parse(await blob.text());
            const themes = parseCatalog(catalog);
            try { await chrome.storage.local.set({ [CACHE_KEY]: { source: BASE, catalog, savedAt: Date.now() } }); } catch (_) {}
            return { themes, stale: false };
        } catch (error) {
            if (cachedThemes) return { themes: cachedThemes, stale: true };
            throw new Error('Не удалось загрузить каталог тем. Проверьте интернет и попробуйте снова.');
        }
    }

    async function getCatalog(options) {
        if (!catalogRequest) catalogRequest = loadCatalog(options).finally(() => { catalogRequest = null; });
        return catalogRequest;
    }

    async function getWallpaper({ path } = {}) {
        const url = assetUrl(path);
        if (!url) throw new Error('Неверный адрес обоев.');
        if (!APPROVED_WALLPAPERS.has(path)) throw new Error('Обои не прошли проверку прав для этого выпуска.');
        if (images.has(url)) return images.get(url);
        const blob = await fetchWithTimeout(url);
        if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Обои должны быть не больше 5 МБ.');
        if (!/^image\/(?:webp|png|jpeg|gif)$/.test(blob.type)) throw new Error('GitHub вернул файл неподдерживаемого формата.');
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Не удалось прочитать обои.'));
            reader.readAsDataURL(blob);
        });
        if (!globalThis.FPTSafe.cssImageUrl(dataUrl)) throw new Error('Не удалось загрузить изображение.');
        // The applied image persists in fpToolsTheme.bgImage. Bound the transient draft cache.
        if (images.size >= 3) images.delete(images.keys().next().value);
        images.set(url, dataUrl);
        return dataUrl;
    }

    root.FPTThemeAssets = Object.freeze({ assetUrl, videoUrl, parseCatalog, getCatalog, getWallpaper });
    if (root.fptPopupActions) {
        root.fptPopupActions.register('theme', 'getThemeCatalog', getCatalog);
        root.fptPopupActions.register('theme', 'getThemeWallpaper', getWallpaper);
    }
})(window);
