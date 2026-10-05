// The autobump category is an empty shell in the static popup and is filled in at runtime by FPTAutoBumpPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('autobump: static markup stays empty and search metadata remains', () => assertEmptyCategory('autobump'));

test('autobump: the category view is mounted into the existing popup shell', () => {
    assert.ok(read('content/content_script.js').includes('FPTAutoBumpPage'), 'the popup boot path mounts the autobump view');
    const manifest = JSON.parse(read('manifest.json'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    const scripts = content.js;
    assert.ok(scripts.includes('content/ui/auto_bump_page.js'), 'manifest loads the autobump page module');
    assert.ok(scripts.indexOf('content/ui/auto_bump_page.js') < scripts.indexOf('content/content_script.js'),
        'the module loads before the content script that mounts it');
});

test('autobump: the page uses the shared category frame and preserves existing storage keys', () => {
    const source = read('content/ui/auto_bump_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Автоподнятие'/);
    for (const key of ['autoBumpEnabled', 'fpToolsSelectiveBumpEnabled', 'fpToolsSelectedBumpCategories',
        'fpToolsBumpOnlyAutoDelivery', 'fpToolsAutoBumpLogs']) {
        assert.ok(source.includes(key), `${key} is still used`);
    }
    for (const action of ["'getBumpStatus'", "'raiseNow'", "'configureSelectiveBumpBtn'", "'autobump-select-all'", "'autobump-category-save'"]) {
        assert.ok(source.includes(action), `${action} is routed through fptPopupActions`);
    }
    assert.ok(!/innerHTML/.test(source), 'the page builds DOM nodes instead of injecting HTML');
});

test('autobump: styles are responsive and the toast region covers the page', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-auto-bump\s*\{/);
    assert.match(css, /@container fpt-auto-bump \(max-width: 640px\)/);
    assert.match(css, /fpt-ab-hero\[data-state="on"\]/);
    assert.ok(read('content/ui/popup_components.js').includes('.fp-tools-page-content.active'), 'toasts render on the active page, including autobump');
});

test('autobump: popup actions and background expose the status and raise-now routes', () => {
    assert.match(read('content/features/misc.js'), /register\('autobump', 'getBumpStatus'/);
    assert.match(read('content/features/misc.js'), /register\('autobump', 'raiseNow'/);
    assert.match(read('background/background.js'), /request\.action === 'getAutoBumpStatus'/);
});

test('autobump: log entries are classified for display', () => {
    const window = {};
    new Function('window', fs.readFileSync(path.join(__dirname, '../content/ui/auto_bump_page.js'), 'utf8'))(window);
    const { parseLogEntry, formatDuration } = window.FPTAutoBumpPage;
    assert.deepEqual(parseLogEntry('[12:00:01] Поднято: Аккаунты'), { time: '12:00:01', message: 'Поднято: Аккаунты', kind: 'success' });
    assert.equal(parseLogEntry('[12:00:02] Лимит: Ключи. Следующая попытка через 2 ч.').kind, 'warning');
    assert.equal(parseLogEntry('[12:00:03] Не поднято: [Системная ошибка]. fetch failed').kind, 'error');
    assert.equal(parseLogEntry('[12:00:04] Автоподнятие включено.').kind, 'info');
    assert.equal(parseLogEntry('без метки времени').time, '');
    assert.equal(formatDuration(3 * 3600000 + 12 * 60000), '3 ч 12 мин');
    assert.equal(formatDuration(45 * 60000), '45 мин');
    assert.equal(formatDuration(10000), 'меньше минуты');
});
