const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'fpt_icons_theme.css'), 'utf8').replace(/\r\n/g, '\n');
const popupCss = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

function extractRule(stylesheet, selector) {
    const expected = selector.trim().replace(/\s*\{$/, '').trim();
    let searchFrom = stylesheet.length;
    while (searchFrom > 0) {
        const selectorStart = stylesheet.lastIndexOf(expected, searchFrom);
        if (selectorStart < 0) break;
        const ruleStart = Math.max(stylesheet.lastIndexOf('{', selectorStart), stylesheet.lastIndexOf('}', selectorStart)) + 1;
        const openBrace = stylesheet.indexOf('{', selectorStart + expected.length);
        if (stylesheet.slice(ruleStart, selectorStart).replace(/\/\*[\s\S]*?\*\//g, '').trim() === '' && openBrace >= 0 && stylesheet.slice(selectorStart, openBrace).trim() === expected) {
            const closeBrace = stylesheet.indexOf('}', openBrace);
            assert.ok(closeBrace > openBrace, 'invalid CSS rule: ' + selector);
            return stylesheet.slice(openBrace + 1, closeBrace);
        }
        searchFrom = selectorStart - 1;
    }
    assert.fail('missing exact CSS rule: ' + selector);
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
        'nav-apps-expanded.png',
        'nav-help-collapsed.png',
        'nav-help-expanded.png'
    ];
    for (const filename of expected) {
        assert.ok(fs.existsSync(path.join(ROOT, 'icons', filename)), 'missing menu asset: ' + filename);
    }

    const reference = fs.readFileSync(path.join(ROOT, 'icons', 'nav-home-expanded.png'));
    const referenceSize = [reference.readUInt32BE(16), reference.readUInt32BE(20)];
    for (const filename of ['nav-help-collapsed.png', 'nav-help-expanded.png']) {
        const icon = fs.readFileSync(path.join(ROOT, 'icons', filename));
        assert.deepEqual([icon.readUInt32BE(16), icon.readUInt32BE(20)], referenceSize,
            filename + ' must match the existing navigation sprite dimensions');
    }
}

function testHeaderAndSearchMatchReference() {
    const navStart = source.indexOf('<nav class="fp-tools-nav">');
    const navEnd = source.indexOf('</nav>', navStart);
    const navMarkup = source.slice(navStart, navEnd);
    assert.match(navMarkup, /<div class="fpt-nav-brand">[\s\S]*?<img class="fp-tools-brand-logo"[^>]+data-icon="funcy-logo"[\s\S]*?<span class="fpt-nav-brand-title">FunPay Funcy<\/span>[\s\S]*?<button[^>]+id="fptNavCollapse"/, 'brand, title, and collapse control must live in the reference sidebar header');
    assert.match(navMarkup, /<div class="fpt-nav-footer">[\s\S]*?<ul class="fpt-nav-quick-actions"[^>]*>[\s\S]*?<button[^>]+id="fptAccentBtn"[\s\S]*?id="fptAccentInput"/, 'footer routes and the existing accent picker must live in the sidebar footer');
    assert.match(source, /const FPT_NAV_QUICK_ACTIONS = Object\.freeze\(\['support'\]\)/,
        'support must be the footer route action');
    assert.match(source, /class="close-btn" aria-label="Закрыть"/, 'the existing popup close control must remain available');
    assert.match(
        source,
        /<button[^>]+id="fptNavSearchToggle"[^>]*class="fpt-nav-search-ico"[^>]*>[\s\S]*?<svg[\s\S]*?<circle[\s\S]*?<line[\s\S]*?<\/svg>[\s\S]*?<\/button>/,
        'menu search must expose an accessible vector button in the compact rail'
    );
    assert.match(source, /placeholder="Поиск функций…"/, 'reference search copy must remain exact');
    assert.doesNotMatch(navMarkup, /РАСКРЫТО|СВЁРНУТО|Помощь|Выйти/, 'reference board labels and extra items must not be added to the app');
}

function testNavigationUsesSpriteImages() {
    const navStart = source.indexOf('function setupNavigationSections(toolsPopup)');
    const navEnd = source.indexOf('function setupPopupNavigation()', navStart);
    const navBlock = source.slice(navStart, navEnd);

    assert.match(source, /const FPT_NAV_ICON_ASSETS\s*=\s*Object\.freeze\(/);
    for (const key of ['sales', 'customers', 'finance', 'interface', 'settings', 'help']) {
        assert.match(source, new RegExp(`${key}:\\s*Object\\.freeze\\(\\{`), 'missing sprite mapping for ' + key);
    }
    const mappings = {
        sales: 'store',
        customers: 'chat',
        finance: 'analytics',
        interface: 'apps',
        settings: 'settings',
        help: 'help'
    };
    const mapStart = source.indexOf('const FPT_NAV_ICON_ASSETS = Object.freeze(');
    const mapEnd = source.indexOf('\n});', mapStart);
    const map = source.slice(mapStart, mapEnd);
    for (const [section, sprite] of Object.entries(mappings)) {
        assert.match(map,
            new RegExp(`${section}:\\s*Object\\.freeze\\(\\{\\s*collapsed:\\s*['"]nav-${sprite}-collapsed\\.png['"],\\s*expanded:\\s*['"]nav-${sprite}-expanded\\.png['"]\\s*\\}\\)`),
            section + ' must use the approved collapsed/expanded sprite pair');
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
        assert.match(groups, /gap:\s*6px/, layer.name + ' must keep reference category spacing');

        const search = extractRule(layer.css, layer.search);
        assert.match(search, /min-height:\s*44px/, layer.name + ' must use the compact search hit area');
        assert.match(search, /padding:\s*8px\s+[^;]+/, layer.name + ' must use the compact search field padding');
        assert.match(search, /font-size:\s*15px/, layer.name + ' search text must remain 15px');

        const toggle = extractRule(layer.css, layer.toggle);
        assert.match(toggle, /min-height:\s*54px/, layer.name + ' must use compact category hit areas');
        assert.match(toggle, /padding:\s*0\s+12px/, layer.name + ' must use 12px horizontal category padding');
        assert.match(toggle, /border-radius:\s*22px/, layer.name + ' must use the rounded reference row radius');
        assert.match(toggle, /font-size:\s*16px/, layer.name + ' category labels must remain 16px');
        assert.match(toggle, /font-weight:\s*500/, layer.name + ' category labels must use medium weight');
        assert.match(toggle, /border:\s*1px solid transparent/, layer.name + ' inactive sections must not look like separate cards');
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
        sales: 'store',
        customers: 'chat',
        finance: 'analytics',
        interface: 'apps',
        settings: 'settings',
        help: 'help'
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
    assert.doesNotMatch(renderer, /icon\.src\s*=/, 'expansion must not swap silhouettes with different internal bounds');

    const runtimeCss = getRuntimeThemeCss();
    const activeRules = [
        [css, '.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle {'],
        [runtimeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{']
    ];
    for (const [stylesheet, selector] of activeRules) {
        const active = extractRule(stylesheet, selector);
        assert.match(active, /background:\s*#7663f6/i, 'expanded category must use the reference violet pill');
        assert.match(active, /color:\s*#fff/i, 'expanded category label and icon must be white');
        assert.match(active, /border-color:\s*transparent/i, 'the expanded pill must not add a second border');
        assert.doesNotMatch(active, /transform\s*:/, 'expanded category row must not scale');
    }

    const collapsedRules = [
        [css, '.fp-tools-nav.is-nav-collapsed {'],
        [runtimeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav.is-nav-collapsed{']
    ];
    for (const [stylesheet, selector] of collapsedRules) {
        const collapsed = extractRule(stylesheet, selector);
        assert.match(collapsed, /width:\s*104px/, 'compact rail must fit the logo and collapse control on one row');
        assert.match(collapsed, /flex:\s*0\s+0\s+104px/, 'compact rail flex basis must match its width');
    }
}

function testCollapseSearchAndMotionContract() {
    assert.match(source, /const FPT_NAV_COLLAPSED_STORAGE_KEY\s*=\s*['"]fpToolsNavCollapsed['"]/, 'collapsed preference must have its own storage key');
    assert.match(source, /function setNavCollapsed\(collapsed, persist = true\)/, 'sidebar state must have one persistent setter');
    assert.match(source, /if \(typeof collapsed !== ['"]boolean['"]\) return/, 'missing saved preference must leave the existing expanded default');
    assert.match(source, /typeof collapsed === ['\"]boolean['\"] && !collapsedUserChanged/, 'late storage restore must honor the toggle-change guard');
    assert.match(source, /if \(isNavCollapsed\(\)\)[\s\S]*?setNavCollapsed\(false, true\)[\s\S]*?setExpandedSections\(\[sectionId\], true\)/, 'a compact section click must expand the menu and show only that section');
    assert.match(source, /searchToggle\.addEventListener\(['"]click['"][\s\S]*?setNavCollapsed\(false, false\)[\s\S]*?input\.focus\(\)/, 'compact search must expand the sidebar and focus its field');
    assert.match(source, /searchNavStateSnapshot[\s\S]*?restoreNavStateSnapshot/, 'clearing search must restore collapsed and accordion state');
    assert.match(source, /aria-expanded/, 'collapse and group controls must expose their current state');

    const runtimeCss = getRuntimeThemeCss();
    for (const [name, stylesheet, selector] of [
        ['static stylesheet', css, '.fp-tools-nav {'],
        ['runtime theme', runtimeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav{']
    ]) {
        const nav = extractRule(stylesheet, selector);
        assert.match(nav, /transition:[^;]*width\s+\.32s/, name + ' sidebar width must animate for about 320ms');
        assert.match(nav, /cubic-bezier\([^)]*1\.[0-9]+/, name + ' sidebar must finish with a subtle spring');
    }
    assert.match(css, /prefers-reduced-motion/, 'sidebar motion must respect reduced motion');
    assert.match(runtimeCss, /prefers-reduced-motion/, 'runtime theme must also respect reduced motion');
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

    const toggleBlock = extractRule(css, '.fp-tools-nav .fpt-nav-group-toggle {');
    assert.match(toggleBlock, /min-height:\s*54px/);
    assert.match(toggleBlock, /border-radius:\s*22px/);

    const iconBlock = extractRule(css, '.fp-tools-nav .fpt-nav-group-icon {');
    assert.match(iconBlock, /width:\s*34px/);
    assert.match(iconBlock, /height:\s*34px/);
    assert.match(iconBlock, /object-fit:\s*contain/);

    const itemsBlock = extractRule(css, '.fp-tools-nav .fpt-nav-group-items {');
    assert.match(itemsBlock, /border-radius:\s*0/);
    assert.match(itemsBlock, /padding:\s*0\s*;/, 'the clipping viewport must stay unpadded');
    assert.doesNotMatch(css, /\.fp-tools-nav \.fpt-nav-group\.is-expanded \.fpt-nav-group-items\s*\{[^}]*padding\s*:/, 'expansion must not change the grid item padding');
    const listBlock = extractRule(css, '.fp-tools-nav .fpt-nav-group-list {');
    assert.match(listBlock, /padding:\s*6px 0 8px 0/, 'the child list must use the full section width');
}

function testFooterActionsMatchExpandedAndCompactNavigation() {
    const runtimeCss = getRuntimeThemeCss();
    for (const [name, stylesheet, selectors] of [
        ['static stylesheet', css, ['.fp-tools-nav .fpt-nav-quick-actions', '.fp-tools-nav li.fpt-nav-quick-action']],
        ['runtime theme', runtimeCss, ['.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-quick-actions', '.fp-tools-popup.fptm-themed .fp-tools-nav li.fpt-nav-quick-action']],
        ['scoped popup stylesheet', popupCss, ['.fp-tools-popup .fp-tools-nav .fpt-nav-quick-actions', '.fp-tools-popup .fp-tools-nav li.fpt-nav-quick-action']]
    ]) {
        for (const selector of selectors) {
            assert.ok(stylesheet.includes(selector), name + ' must style footer route action selector ' + selector);
        }
        assert.match(stylesheet, /fpt-nav-quick-actions[\s\S]*fpt-nav-quick-action/,
            name + ' must provide footer action styling in both sidebar states');
    }
    assert.match(css, /prefers-reduced-motion/);
    assert.match(runtimeCss, /prefers-reduced-motion/);
    assert.match(popupCss, /prefers-reduced-motion/);
}

function runAll() {
    testReferenceAssetsExist();
    testHeaderAndSearchMatchReference();
    testNavigationUsesSpriteImages();
    testNavigationGeometryAndTypographyContract();
    testExpandedSpriteStateAndStableCategorySurface();
    testCollapseSearchAndMotionContract();
    testPopupEntranceDoesNotScale();
    testMenuHasIndependentReferenceSurface();
    testFooterActionsMatchExpandedAndCompactNavigation();
    console.log('MENU_REFERENCE_CONTRACT_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('MENU_REFERENCE_CONTRACT_FAIL:', error);
    process.exit(1);
}
