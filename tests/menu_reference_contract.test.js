const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'fpt_icons_theme.css'), 'utf8').replace(/\r\n/g, '\n');
const popupCss = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

function extractRule(stylesheet, selector) {
    const selectorStart = stylesheet.indexOf(selector);
    assert.ok(selectorStart >= 0, 'missing CSS rule: ' + selector);
    const openBrace = stylesheet.indexOf('{', selectorStart);
    const closeBrace = stylesheet.indexOf('}', openBrace);
    assert.ok(openBrace > selectorStart && closeBrace > openBrace, 'invalid CSS rule: ' + selector);
    return stylesheet.slice(openBrace + 1, closeBrace);
}

function getRuntimeThemeCss() {
    const start = source.indexOf('const FPT_MENU_THEME_CSS = `');
    const end = source.indexOf('`;', start);
    assert.ok(start >= 0 && end > start, 'runtime navigation theme must exist');
    return source.slice(start, end);
}

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

function testNavigationGeometryAndTypographyContract() {
    const runtimeCss = getRuntimeThemeCss();
    const layers = [
        {
            name: 'static stylesheet',
            css,
            nav: '.fp-tools-nav {',
            groups: '.fp-tools-nav .fpt-nav-groups {',
            search: '.fp-tools-nav .fpt-nav-search-input {',
            toggle: '.fp-tools-nav .fpt-nav-group-toggle {',
            icon: '.fp-tools-nav .fpt-nav-group-icon {',
            title: '.fp-tools-nav .fpt-nav-group-title {',
            chevron: '.fp-tools-nav .fpt-nav-group-chevron {',
            child: '.fp-tools-nav .fpt-nav-child a {',
            childLabel: '.fp-tools-nav li[data-page] a > span:last-child {'
        },
        {
            name: 'runtime theme',
            css: runtimeCss,
            nav: '.fp-tools-popup.fptm-themed .fp-tools-nav{',
            groups: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-groups{',
            search: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-search-input{',
            toggle: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{',
            icon: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-icon{',
            title: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-title{',
            chevron: '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-chevron{',
            child: '.fp-tools-popup.fptm-themed .fp-tools-nav li a{',
            childLabel: '.fp-tools-popup.fptm-themed .fp-tools-nav li[data-page] a > span:last-child{'
        }
    ];

    for (const layer of layers) {
        const nav = extractRule(layer.css, layer.nav);
        assert.match(nav, /width:\s*256px/, layer.name + ' must use the narrower sidebar');
        assert.match(nav, /flex:\s*0\s+0\s+256px/, layer.name + ' flex basis must match sidebar width');
        assert.match(nav, /margin:\s*16px\s+0\s+16px\s+16px/, layer.name + ' must retain vertical outer margins');
        assert.match(nav, /padding:\s*18px\s+12px/, layer.name + ' must narrow only horizontal panel padding');
        assert.match(nav, /border-radius:\s*20px/, layer.name + ' must retain the navigation panel radius');

        const groups = extractRule(layer.css, layer.groups);
        assert.match(groups, /gap:\s*10px/, layer.name + ' must retain vertical category spacing');

        const search = extractRule(layer.css, layer.search);
        assert.match(search, /min-height:\s*56px/, layer.name + ' must retain the search hit area');
        assert.match(search, /padding:\s*12px\s+[^;]+\s+12px\s+[^;]+/, layer.name + ' must retain search vertical padding');
        assert.match(search, /font-size:\s*15px/, layer.name + ' search text must remain 15px');

        const toggle = extractRule(layer.css, layer.toggle);
        assert.match(toggle, /min-height:\s*58px/, layer.name + ' must retain category hit areas');
        assert.match(toggle, /padding:\s*12px\s+12px/, layer.name + ' must use 12px horizontal category padding');
        assert.match(toggle, /border-radius:\s*18px/, layer.name + ' must retain top-level row radius');
        assert.match(toggle, /font-size:\s*16px/, layer.name + ' category labels must remain 16px');
        assert.match(toggle, /font-weight:\s*700/, layer.name + ' category labels must remain bold');
        assert.doesNotMatch(toggle, /transform\s*:/, layer.name + ' category row must not transform');

        const icon = extractRule(layer.css, layer.icon);
        assert.match(icon, /width:\s*34px/, layer.name + ' category icon width must remain 34px');
        assert.match(icon, /height:\s*34px/, layer.name + ' category icon height must remain 34px');
        assert.doesNotMatch(icon, /transform\s*:/, layer.name + ' category icons must not scale during expansion');
        const title = extractRule(layer.css, layer.title);
        assert.doesNotMatch(title, /transform\s*:/, layer.name + ' category labels must not scale during expansion');
        const chevron = extractRule(layer.css, layer.chevron);
        assert.match(chevron, /width:\s*20px/, layer.name + ' chevron width must remain 20px');
        assert.match(chevron, /height:\s*20px/, layer.name + ' chevron height must remain 20px');

        const child = extractRule(layer.css, layer.child);
        assert.match(child, /min-height:\s*44px/, layer.name + ' child hit areas must remain 44px');
        assert.match(child, /font-size:\s*15px/, layer.name + ' child labels must remain 15px');
        const childLabel = extractRule(layer.css, layer.childLabel);
        assert.match(childLabel, /font-size:\s*15px/, layer.name + ' visible child-label spans must remain 15px');
        assert.match(childLabel, /min-width:\s*0/, layer.name + ' visible child labels must be allowed to shrink');
        assert.match(childLabel, /text-overflow:\s*ellipsis/, layer.name + ' long child labels must truncate without overlapping controls');
        assert.match(childLabel, /white-space:\s*nowrap/, layer.name + ' child labels must stay on one line');
    }
}

function testExpandedSpriteStateAndStableCategorySurface() {
    const mappings = {
        core: 'home',
        store: 'store',
        messages: 'chat',
        finance: 'analytics',
        settings: 'settings',
        more: 'apps'
    };
    const mapStart = source.indexOf('const FPT_NAV_ICON_ASSETS = Object.freeze(');
    const mapEnd = source.indexOf('\n});', mapStart);
    assert.ok(mapStart >= 0 && mapEnd > mapStart, 'navigation sprite map must exist');
    const map = source.slice(mapStart, mapEnd);

    for (const [section, sprite] of Object.entries(mappings)) {
        assert.match(
            map,
            new RegExp(`${section}:\\s*Object\\.freeze\\(\\{\\s*collapsed:\\s*['"]nav-${sprite}-collapsed\\.png['"],\\s*expanded:\\s*['"]nav-${sprite}-expanded\\.png['"]\\s*\\}\\)`),
            section + ' must have matching collapsed and expanded sprites'
        );
    }

    const rendererStart = source.indexOf('function renderExpandedSections()');
    const rendererEnd = source.indexOf('function setExpandedSections(', rendererStart);
    const renderer = source.slice(rendererStart, rendererEnd);
    assert.match(renderer, /const state = expanded \? ['"]expanded['"] : ['"]collapsed['"]/, 'expanded state must select the blue sprite variant');
    assert.match(renderer, /assetSet\[state\]/, 'the selected state must drive the rendered icon source');

    const runtimeCss = getRuntimeThemeCss();
    const expandedRules = [
        [css, '.fp-tools-nav .fpt-nav-group.is-expanded {', '.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle {', '.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover {'],
        [runtimeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded{', '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{', '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle:hover{']
    ];
    for (const [stylesheet, groupSelector, toggleSelector, hoverSelector] of expandedRules) {
        const group = extractRule(stylesheet, groupSelector);
        assert.doesNotMatch(group, /\bpadding\s*:/, 'expanded category must not inset or contract its row');
        assert.doesNotMatch(group, /transform\s*:/, 'expanded category container must not scale');
        const toggle = extractRule(stylesheet, toggleSelector);
        assert.match(toggle, /background:\s*var\(--fptm-accent-soft/, 'expanded category must keep a blue-tinted row surface');
        assert.doesNotMatch(toggle, /background:\s*transparent|border-color:\s*transparent|box-shadow:\s*none/, 'expanded category must retain its visible row border and surface');
        assert.doesNotMatch(toggle, /transform\s*:/, 'expanded category row must not scale');
        const hover = extractRule(stylesheet, hoverSelector);
        assert.match(hover, /background:\s*var\(--fptm-nav-row-hover/, 'expanded category must retain a simple hover response');
        assert.doesNotMatch(hover, /transform\s*:/, 'expanded category hover must not transform the row');
    }

    const staticActive = extractRule(css, '.fp-tools-nav .fpt-nav-group.is-active-section .fpt-nav-group-toggle {');
    const runtimeActive = extractRule(runtimeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-active-section .fpt-nav-group-toggle{');
    assert.doesNotMatch(staticActive + runtimeActive, /background:\s*transparent|border-color:\s*transparent/, 'active category must not erase the expanded row surface');
}

function testPopupEntranceDoesNotScale() {
    const popupActive = extractRule(popupCss, '.fp-tools-popup.active {');
    assert.match(popupActive, /animation:\s*fptMenuPopIn/, 'the main popup must use its own entrance animation');
    const start = popupCss.indexOf('@keyframes fptMenuPopIn');
    const end = popupCss.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start, 'menu-specific popup entrance keyframes must exist');
    const keyframes = popupCss.slice(start, end + 2);
    assert.match(keyframes, /translate\(-50%,\s*-48%\)/, 'popup entrance may use a subtle vertical offset');
    assert.match(keyframes, /translate\(-50%,\s*-50%\)/, 'popup must finish centered');
    assert.doesNotMatch(keyframes, /scale\s*\(/, 'popup entrance must not shrink or enlarge the interface');

    const sharedPopInStart = popupCss.indexOf('@keyframes popIn');
    const sharedPopInEnd = popupCss.indexOf('\n}', sharedPopInStart);
    const sharedPopIn = popupCss.slice(sharedPopInStart, sharedPopInEnd + 2);
    assert.match(sharedPopIn, /scale\(0\.97\)/, 'unrelated dialogs must retain their shared legacy entrance');

    assert.match(popupCss, /\.fp-tools-popup \.fpt-nav-group-toggle::before\s*\{[^}]*content:\s*none\s*!important?\s*;/, 'category toggles must suppress the inherited radial hover flare');
    assert.match(popupCss, /\.fp-tools-popup button:not\(\.fpt-nav-group-toggle\):not\(:disabled\):hover/, 'generic hover shadow must exclude category toggles');
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
    assert.match(itemsBlock, /padding:\s*0\s*;/, 'the clipping viewport must stay unpadded');
    assert.doesNotMatch(css, /\.fp-tools-nav \.fpt-nav-group\.is-expanded \.fpt-nav-group-items\s*\{[^}]*padding\s*:/, 'expansion must not change the grid item padding');
    const listStart = css.indexOf('.fp-tools-nav .fpt-nav-group-list {');
    const listEnd = css.indexOf('\n}', listStart);
    const listBlock = css.slice(listStart, listEnd + 2);
    assert.match(listBlock, /padding:\s*8px 6px 10px/, 'constant inner-list padding must preserve child spacing');
}

function runAll() {
    testReferenceAssetsExist();
    testHeaderAndSearchMatchReference();
    testNavigationUsesSpriteImages();
    testNavigationGeometryAndTypographyContract();
    testExpandedSpriteStateAndStableCategorySurface();
    testPopupEntranceDoesNotScale();
    testMenuHasIndependentReferenceSurface();
    console.log('MENU_REFERENCE_CONTRACT_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('MENU_REFERENCE_CONTRACT_FAIL:', error);
    process.exit(1);
}
