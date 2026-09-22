const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'fpt_icons_theme.css'), 'utf8').replace(/\r\n/g, '\n');

function testReferenceAssetsExist() {
    const expected = [
        'funcy-logo.png',
        'nav-home-collapsed.png',
        'nav-home-expanded.png',
        'nav-store-collapsed.png',
        'nav-store-expanded.png',
        'nav-chat-collapsed.png',
        'nav-chat-expanded.png',
        'nav-analytics-collapsed.png',
        'nav-analytics-expanded.png',
        'nav-settings-collapsed.png',
        'nav-settings-expanded.png',
        'nav-apps-collapsed.png',
        'nav-apps-expanded.png'
    ];
    for (const filename of expected) {
        assert.ok(fs.existsSync(path.join(ROOT, 'icons', filename)), 'missing menu asset: ' + filename);
    }
}

function testHeaderAndSearchMatchReference() {
    assert.match(
        source,
        /<img class="fp-tools-brand-logo"[^>]+data-icon="funcy-logo"/,
        'menu header must use the supplied FunPay Funcy logo'
    );
    assert.match(
        source,
        /<span class="fpt-nav-search-ico"[^>]*><svg[\s\S]*?<circle[\s\S]*?<line[\s\S]*?<\/svg><\/span>/,
        'menu search must expose a real vector search icon'
    );
    assert.match(source, /placeholder="Поиск функций…"/, 'reference search copy must remain exact');
}

function testNavigationUsesSpriteImages() {
    const navStart = source.indexOf('function setupNavigationSections(toolsPopup)');
    const navEnd = source.indexOf('function setupPopupNavigation()', navStart);
    const navBlock = source.slice(navStart, navEnd);

    assert.match(source, /const FPT_NAV_ICON_ASSETS\s*=\s*Object\.freeze\(/);
    for (const key of ['core', 'store', 'messages', 'finance', 'settings', 'more']) {
        assert.match(source, new RegExp(`${key}:\\s*Object\\.freeze\\(\\{`), 'missing sprite mapping for ' + key);
    }
    assert.match(navBlock, /createElement\(['"]img['"]\)/, 'section icons must use real image assets');
    assert.match(navBlock, /navIcon\.dataset\.icon\s*=\s*section\.id/);
    assert.match(navBlock, /navIcon\.className\s*=\s*['"]fpt-nav-group-icon['"]/);
}

function testMenuHasIndependentReferenceSurface() {
    for (const selector of [
        '.fp-tools-nav .fpt-nav-group-toggle',
        '.fp-tools-nav .fpt-nav-group-icon',
        '.fp-tools-nav .fpt-nav-group.is-expanded',
        '.fp-tools-nav .fpt-nav-group-items'
    ]) {
        assert.ok(css.includes(selector), 'missing selected-menu style: ' + selector);
    }

    const navStart = css.indexOf('.fp-tools-nav {');
    const navEnd = css.indexOf('\n}', navStart);
    const navBlock = css.slice(navStart, navEnd + 2);
    assert.match(navBlock, /background:\s*var\(--fptm-nav-surface/);
    assert.match(navBlock, /border-radius:\s*20px/);

    const toggleStart = css.indexOf('.fp-tools-nav .fpt-nav-group-toggle {');
    const toggleEnd = css.indexOf('\n}', toggleStart);
    const toggleBlock = css.slice(toggleStart, toggleEnd + 2);
    assert.match(toggleBlock, /min-height:\s*58px/);
    assert.match(toggleBlock, /border-radius:\s*18px/);

    const iconStart = css.indexOf('.fp-tools-nav .fpt-nav-group-icon {');
    const iconEnd = css.indexOf('\n}', iconStart);
    const iconBlock = css.slice(iconStart, iconEnd + 2);
    assert.match(iconBlock, /width:\s*34px/);
    assert.match(iconBlock, /height:\s*34px/);
    assert.match(iconBlock, /object-fit:\s*contain/);

    const itemsStart = css.indexOf('.fp-tools-nav .fpt-nav-group-items {');
    const itemsEnd = css.indexOf('\n}', itemsStart);
    const itemsBlock = css.slice(itemsStart, itemsEnd + 2);
    assert.match(itemsBlock, /border-radius:\s*16px/);
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group\.is-expanded \.fpt-nav-group-items\s*\{[\s\S]*?padding:\s*8px 6px 10px/);
}

function runAll() {
    testReferenceAssetsExist();
    testHeaderAndSearchMatchReference();
    testNavigationUsesSpriteImages();
    testMenuHasIndependentReferenceSurface();
    console.log('MENU_REFERENCE_CONTRACT_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('MENU_REFERENCE_CONTRACT_FAIL:', error);
    process.exit(1);
}
