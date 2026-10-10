// The blacklist category is an empty shell in the static popup and is filled in at runtime by FPTBlacklistPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadPage() {
    const window = {};
    new Function('window', read('content/ui/blacklist_page.js'))(window);
    return window.FPTBlacklistPage;
}

test('blacklist: static markup stays empty and search metadata remains', () => assertEmptyCategory('blacklist'));

test('blacklist: the page is loaded by the manifest and mounted by the popup', () => {
    assert.ok(read('content/content_script.js').includes('FPTBlacklistPage.mount(toolsPopup)'));
    const manifest = JSON.parse(read('manifest.json'));
    const scripts = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js')).js;
    const at = file => scripts.indexOf(file);
    assert.ok(at('content/ui/popup_components.js') < at('content/ui/blacklist_page.js'));
    assert.ok(at('content/features/blacklist.js') < at('content/ui/blacklist_page.js'), 'the actions register before the page');
    assert.ok(at('content/ui/blacklist_page.js') < at('content/content_script.js'));
});

test('blacklist: the page uses the shared frame and blacklist popup actions only', () => {
    const source = read('content/ui/blacklist_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Чёрный список'/);
    for (const action of ['getSettings', 'fp-bl-add-btn', 'updateBlacklistEntry', 'removeFromBlacklistByName']) {
        assert.ok(source.includes(`'${action}'`), `${action} is routed through fptPopupActions`);
    }
    for (const flag of ['blockDelivery', 'blockResponse']) assert.ok(source.includes(flag), flag);
    assert.ok(!/innerHTML/.test(source), 'the page builds DOM nodes instead of injecting HTML');
    assert.ok(!/chrome\.storage\.local\.(get|set|remove)/.test(source), 'storage access goes through popup actions');
    assert.match(source, /setAttribute\('aria-pressed'/, 'flag chips expose their state');
});

test('blacklist: styles are scoped, responsive and respect reduced motion', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-bl\s*\{[^}]*container-name: fpt-blacklist/);
    assert.match(css, /@container fpt-blacklist \(max-width: 560px\)/);
    assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.fp-tools-popup\.fptm-themed \.fpt-bl \*/);
    const block = css.slice(css.indexOf('/* Blacklist screen'), css.indexOf('/* FunPay support screen'));
    assert.ok(block.length > 0);
    for (const line of block.split('\n').filter(item => /^\.[\w-]/.test(item.trim()) && item.includes('{'))) {
        assert.ok(line.trim().startsWith('.fp-tools-popup.fptm-themed '), `scoped selector: ${line.trim()}`);
    }
});

test('blacklist: stored entries are normalized with safe defaults', () => {
    const { normalizeEntries, formatAdded, initials } = loadPage();
    assert.deepEqual(normalizeEntries(null), []);
    assert.deepEqual(normalizeEntries([
        null, 'x', [], { username: '  ' },
        { username: ' Buyer ', note: 7, blockDelivery: false, addedAt: 'nope' },
        { username: 'buyer', note: 'dup' }
    ]), [{ username: 'Buyer', note: '', blockDelivery: false, blockResponse: true, addedAt: 0 }]);
    assert.equal(initials('buyer_123'), 'BU');
    assert.equal(initials('—'), '?');
    const now = Date.UTC(2026, 9, 7, 12);
    assert.equal(formatAdded(0, now), 'Добавлен давно');
    assert.equal(formatAdded(now - 20 * 1000, now), 'Добавлен только что');
    assert.equal(formatAdded(now - 5 * 60000, now), 'Добавлен 5 мин назад');
    assert.equal(formatAdded(now - 26 * 3600000, now), 'Добавлен вчера');
    assert.equal(formatAdded(now - 3 * 86400000, now), 'Добавлен 3 дня назад');
});
