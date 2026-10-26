const test = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('./helpers/popup_actions_harness');
const catalog = require('./fixtures/funcy-assets-index.json');
const BASE = 'https://raw.githubusercontent.com/jgchkcu-maker/funcy-assets/main/';

function assets(initial = {}) {
    const h = context(initial);
    h.ctx.AbortController = AbortController;
    h.ctx.FileReader = class {
        readAsDataURL(blob) {
            blob.arrayBuffer().then(bytes => {
                this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
                this.onload();
            });
        }
    };
    h.load('content/features/theme_assets.js');
    return h;
}

test('unreviewed catalog entries remain hidden, including new entries and offline cache', async () => {
    const h = assets();
    const updated = structuredClone(catalog);
    updated.themes.push({ ...updated.themes[0], id: 'third-theme', name: 'Third Theme', wallpaper: 'wallpapers/third-theme.webp' });
    let requests = 0;
    h.ctx.fetch = async () => { requests++; return new Response(JSON.stringify(updated)); };
    const result = await h.api.run('theme', 'getThemeCatalog');
    assert.equal(result.themes.length, 0);

    assert.equal(h.saved.fpToolsThemeCatalogCache.catalog.themes.length, 3);
    assert.equal(h.saved.fpToolsTheme, undefined);
    await h.api.run('theme', 'getThemeCatalog');
    assert.equal(requests, 1, 'fresh catalogue avoids another request');
    h.ctx.fetch = async () => { requests++; throw Error('offline'); };
    assert.equal((await h.api.run('theme', 'getThemeCatalog', { refresh: true })).stale, true);
    assert.equal(requests, 2, 'manual refresh bypasses the TTL');
    h.saved.fpToolsThemeCatalogCache.savedAt = 0;
    assert.equal((await h.api.run('theme', 'getThemeCatalog')).themes.length, 0, 'expired catalogue still works offline');
    const empty = assets();
    empty.ctx.fetch = async () => { throw Error('offline'); };
    await assert.rejects(empty.api.run('theme', 'getThemeCatalog'), /каталог/);
});

test('unreviewed wallpapers cannot be fetched directly or through popup actions', async () => {
    const h = assets();
    h.ctx.fetch = () => assert.fail('unreviewed asset was fetched');
    await assert.rejects(h.api.run('theme', 'getThemeWallpaper', { path: catalog.themes[0].wallpaper }), /проверку прав/);
    for (const path of ['https://example.com/a.webp', 'wallpapers/../a.webp', 'wallpapers/x.webp?token=x', 'wallpapers/x.svg']) {
        await assert.rejects(h.api.run('theme', 'getThemeWallpaper', { path }), /адрес/);
    }
    assert.deepEqual(h.saved, {});
});

test('invalid remote catalogue does not replace the last successful catalogue', async () => {
    const cached = { source: BASE, catalog, savedAt: 0 };
    const h = assets({ fpToolsThemeCatalogCache: cached });
    h.ctx.fetch = async () => new Response(JSON.stringify({ version: 1, themes: [{ ...catalog.themes[0], wallpaper: '../private.webp' }] }));
    const result = await h.api.run('theme', 'getThemeCatalog');
    assert.equal(result.stale, true);
    assert.equal(result.themes.length, 0);
    assert.deepEqual(h.saved.fpToolsThemeCatalogCache, cached);
});
