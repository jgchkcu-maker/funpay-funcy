const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'fpt_icons_theme.css'), 'utf8').replace(/\r\n/g, '\n');

function extractNavPages() {
    const navStart = source.indexOf('<nav class="fp-tools-nav">');
    const ulStart = source.indexOf('<ul>', navStart);
    const ulEnd = source.indexOf('</ul>', ulStart);
    assert.ok(navStart >= 0 && ulStart >= 0 && ulEnd > ulStart, 'popup nav markup must exist');
    const navMarkup = source.slice(ulStart, ulEnd);
    return [...navMarkup.matchAll(/<li[^>]*data-page="([^"]+)"/g)].map(match => match[1]);
}

function extractSchema() {
    const start = source.indexOf('const FPT_NAV_SECTIONS = Object.freeze([');
    const end = source.indexOf('const FPT_NAV_LABEL_OVERRIDES', start);
    assert.ok(start >= 0 && end > start, 'FPT_NAV_SECTIONS must exist before label overrides');
    const schema = source.slice(start, end);
    const sections = [...schema.matchAll(/id:\s*'([^']+)'[\s\S]*?pages:\s*Object\.freeze\(\[([^\]]*)\]\)/g)]
        .map(match => ({ id: match[1], pages: [...match[2].matchAll(/'([^']+)'/g)].map(m => m[1]) }));
    return { schema, sections, pages: sections.flatMap(section => section.pages) };
}

function extractStyleRule(stylesheet, selector) {
    const start = stylesheet.indexOf(selector);
    assert.ok(start >= 0, 'missing stylesheet rule: ' + selector);
    const open = stylesheet.indexOf('{', start);
    const close = stylesheet.indexOf('}', open);
    assert.ok(open > start && close > open, 'invalid stylesheet rule: ' + selector);
    return stylesheet.slice(open + 1, close);
}

function testEveryExistingPageBelongsToExactlyOneSection() {
    const navPages = extractNavPages();
    const { pages } = extractSchema();
    assert.equal(navPages.length, 25, 'popup must retain all 25 existing page nodes');
    assert.equal(new Set(navPages).size, navPages.length, 'flat nav must not contain duplicate data-page ids');
    assert.equal(new Set(pages).size, pages.length, 'navigation schema must not duplicate page ids');
    assert.deepEqual([...pages].sort(), [...navPages].sort(), 'navigation schema must cover every existing data-page exactly once');
}

function testSixIndependentAccordionSections() {
    const { schema, sections } = extractSchema();
    assert.deepEqual(sections.map(section => section.id), ['core', 'store', 'messages', 'finance', 'settings', 'more']);
    assert.equal(sections.length, 6, 'there must be exactly six accordion sections');
    assert.doesNotMatch(schema, /\bprimary\s*:/, 'schema must not drive a primary/overflow renderer');
}

function testAccordionRendererMovesExistingNodes() {
    const start = source.indexOf('function setupNavigationSections(toolsPopup)');
    const end = source.indexOf('function setupPopupNavigation()', start);
    assert.ok(start >= 0 && end > start, 'setupNavigationSections must exist before setupPopupNavigation');
    const block = source.slice(start, end);
    assert.match(block, /fpt-nav-group/, 'renderer must create accordion groups');
    assert.match(block, /fpt-nav-group-toggle/, 'renderer must create real group toggle buttons');
    assert.match(block, /fpt-nav-group-collapse/, 'renderer must create collapse wrappers');
    assert.match(block, /fpt-nav-group-items/, 'renderer must create group item lists');
    assert.match(block, /const itemsViewport = document\.createElement\(['"]div['"]\)/, 'child-list padding must sit inside a clipped viewport');
    assert.match(block, /itemsViewport\.className = ['"]fpt-nav-group-items['"]/, 'the unpadded viewport must remain the animated grid item');
    assert.match(block, /const items = document\.createElement\(['"]ul['"]\)/, 'page links must remain in a semantic list');
    assert.match(block, /items\.className = ['"]fpt-nav-group-list['"]/, 'the semantic child list must be nested inside the clipped viewport');
    assert.match(block, /itemsViewport\.appendChild\(items\)/, 'the child list must be clipped by its unpadded viewport');
    assert.match(block, /collapse\.appendChild\(itemsViewport\)/, 'the viewport must remain the grid reveal child');
    assert.match(block, /querySelectorAll\(['"]li\[data-page\]['"]\)/, 'renderer must discover existing page nodes');
    assert.match(block, /\.appendChild\(item\)/, 'renderer must move existing page nodes instead of cloning them');
    assert.match(block, /aria-expanded/, 'group toggles must expose expanded state');
    assert.match(block, /aria-controls/, 'group toggles must identify their collapse region');
    assert.doesNotMatch(block, /\.click\(\)/, 'category toggles must never click a child page');
    assert.match(source, /fpToolsNavExpandedSections/, 'expanded state must be persisted best-effort');
}

function testPageClickContractAndRestore() {
    const setupStart = source.indexOf('function setupPopupNavigation()');
    const setupEnd = source.indexOf('function setupFinanceHubUI', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /const navSections = setupNavigationSections\(toolsPopup\)/);
    assert.match(setupBlock, /navSections\.showSectionForPage\(pageId\)/, 'page click must reveal its owning section');
    assert.match(setupBlock, /fpToolsLastPage:\s*pageId/, 'existing fpToolsLastPage persistence must remain');

    const restoreStart = source.indexOf('async function loadLastActivePage()');
    const restoreBlock = source.slice(restoreStart, restoreStart + 750);
    assert.match(restoreBlock, /fpToolsLastPage/);
    assert.match(restoreBlock, /li\[data-page=/, 'restore must locate the existing data-page item');
    assert.match(restoreBlock, /itemToActivate\.click\(\)/, 'restore must enter through the normal page click contract');
    assert.match(source, /restored\.add\(activeSection\)/, 'async expanded-state restore must keep the active page section open');
}

function testSearchRestoresAccordionState() {
    const searchStart = source.indexOf('function setupNavSearch(toolsPopup)');
    const searchEnd = source.indexOf('async function loadLastActivePage()', searchStart);
    const searchBlock = source.slice(searchStart, searchEnd);
    assert.match(searchBlock, /searchExpandedSnapshot/, 'search must snapshot expanded sections');
    assert.match(searchBlock, /getExpandedSections\(\)/, 'search must read the pre-search accordion state');
    assert.match(searchBlock, /setExpandedSections\(/, 'search must restore the pre-search accordion state');
    assert.match(searchBlock, /revealAllForSearch\(/, 'search must reveal matching sections');
    assert.doesNotMatch(searchBlock, /compactNav\(/, 'search must not rebalance a removed two-column grid');
}

function testGlobalChatAndShortcutContracts() {
    assert.match(source, /<li data-page="global_chat"/, 'global_chat must remain an existing nav item');
    assert.match(source, /e\.ctrlKey \|\| e\.metaKey/, 'shortcut must support Ctrl and Cmd');
    assert.match(source, /String\(e\.key\)\.toLowerCase\(\) !== ['"]k['"]/, 'shortcut must listen for K');
    assert.match(source, /input\.focus\(\)[\s\S]{0,80}input\.select\(\)/, 'shortcut must focus and select the popup search');
}

function testAccordionStyles() {
    for (const selector of [
        '.fpt-nav-groups',
        '.fpt-nav-group',
        '.fpt-nav-group-toggle',
        '.fpt-nav-group-chevron',
        '.fpt-nav-group-collapse',
        '.fpt-nav-group-items',
        '.fpt-nav-scroll'
    ]) {
        assert.ok(css.includes(selector), 'missing accordion style: ' + selector);
    }
    assert.match(css, /prefers-reduced-motion/, 'accordion animation must support reduced motion');
    for (const legacySelector of [
        '.fpt-nav-primary',
        '.fpt-nav-section-btn',
        '.fpt-nav-context-head',
        '.fpt-nav-more-btn',
        '.fpt-nav-wide'
    ]) {
        assert.doesNotMatch(css, new RegExp(legacySelector.replace(/[.-]/g, '\\$&')), 'removed contextual selector remains: ' + legacySelector);
    }
    assert.doesNotMatch(css, /grid-template-columns:\s*1fr\s+1fr/, 'navigation CSS must not depend on a two-column grid');
}

function testSelectedReferenceKeepsSpaciousActiveHierarchy() {
    const staticToggleStart = css.indexOf('.fp-tools-nav .fpt-nav-group-toggle {');
    const staticToggleEnd = css.indexOf('\n}', staticToggleStart);
    const staticToggle = css.slice(staticToggleStart, staticToggleEnd + 2);
    assert.match(staticToggle, /min-height:\s*58px/, 'section toggles must keep the selected reference hit area');
    assert.match(staticToggle, /padding:\s*12px 12px/, 'section toggles must be narrower without changing their vertical padding');
    assert.match(staticToggle, /font-size:\s*16px/, 'section labels must remain readable in the standalone menu');

    const staticActiveStart = css.indexOf('.fp-tools-nav .fpt-nav-group.is-active-section .fpt-nav-group-toggle {');
    const staticActiveEnd = css.indexOf('\n}', staticActiveStart);
    const staticActive = css.slice(staticActiveStart, staticActiveEnd + 2);
    assert.doesNotMatch(staticActive, /background:\s*transparent|border-color:\s*transparent/, 'the active category must retain its visible row surface');

    const staticChildActiveStart = css.indexOf('.fp-tools-nav .fpt-nav-child.active a {');
    const staticChildActiveEnd = css.indexOf('\n}', staticChildActiveStart);
    const staticChildActive = css.slice(staticChildActiveStart, staticChildActiveEnd + 2);
    assert.match(staticChildActive, /background:\s*var\(--fptm-accent-soft/, 'the selected page must keep its soft-blue background');

    const staticChildStart = css.indexOf('.fp-tools-nav .fpt-nav-child a {');
    const staticChildEnd = css.indexOf('\n}', staticChildStart);
    const staticChild = css.slice(staticChildStart, staticChildEnd + 2);
    assert.match(staticChild, /min-height:\s*44px/, 'nested pages must keep a comfortable standalone-menu hit area');
    assert.match(staticChild, /padding:\s*8px 12px 8px 14px/, 'nested pages must stay aligned inside the selected reference hierarchy');

    const themeStart = source.indexOf('const FPT_MENU_THEME_CSS = `');
    const themeEnd = source.indexOf('`;', themeStart);
    const themeCss = source.slice(themeStart, themeEnd);
    const themeToggleStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{');
    const themeToggleEnd = themeCss.indexOf('\n}', themeToggleStart);
    const themeToggle = themeCss.slice(themeToggleStart, themeToggleEnd + 2);
    assert.match(themeToggle, /min-height:\s*58px/, 'runtime theme must not shrink the selected section hit area');
    assert.match(themeToggle, /padding:\s*12px 12px/, 'runtime theme must narrow horizontal spacing without changing vertical padding');

    const themeActiveStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-active-section .fpt-nav-group-toggle{');
    const themeActiveEnd = themeCss.indexOf('\n}', themeActiveStart);
    const themeActive = themeCss.slice(themeActiveStart, themeActiveEnd + 2);
    assert.doesNotMatch(themeActive, /background:transparent|border-color:transparent/, 'runtime theme must retain the active category surface');

    const themeChildStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav li a{');
    const themeChildEnd = themeCss.indexOf('\n}', themeChildStart);
    const themeChild = themeCss.slice(themeChildStart, themeChildEnd + 2);
    assert.match(themeChild, /min-height:\s*44px/, 'runtime theme must keep nested-page hit areas spacious');
    assert.match(themeChild, /padding:\s*8px 12px 8px 14px/, 'runtime theme must keep nested-page alignment stable');

    const themeChildActiveStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav li.active a{');
    const themeChildActiveEnd = themeCss.indexOf('\n}', themeChildActiveStart);
    const themeChildActive = themeCss.slice(themeChildActiveStart, themeChildActiveEnd + 2);
    assert.match(themeChildActive, /background:var\(--fptm-accent-soft\)/, 'runtime theme must preserve the selected page background');
}

function testNavigationRegressionGuards() {
    const setupStart = source.indexOf('function setupNavigationSections(toolsPopup)');
    const setupEnd = source.indexOf('function setupPopupNavigation()', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /navIcon\.dataset\.icon\s*=\s*section\.id/, 'section icons must be keyed to their supplied sprite set');
    assert.match(setupBlock, /navIcon\.setAttribute\(['"]aria-hidden['"],\s*['"]true['"]\)/, 'decorative section icons must be hidden from assistive technology');
    assert.match(setupBlock, /collapse\.toggleAttribute\(['"]inert['"],\s*!expanded\)/, 'collapsed sections must be removed from keyboard navigation');

    const staticItemsStart = css.indexOf('.fp-tools-nav .fpt-nav-group-items {');
    const staticItemsEnd = css.indexOf('\n}', staticItemsStart);
    const staticItems = css.slice(staticItemsStart, staticItemsEnd + 2);
    assert.match(staticItems, /padding:\s*0\s*;/, 'closed group content must have no intrinsic padding');
    assert.match(staticItems, /overflow:\s*hidden/, 'the unpadded grid item must clip its inner list during reveal');

    const staticExpandedStart = css.indexOf('.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items {');
    const staticExpandedEnd = css.indexOf('\n}', staticExpandedStart);
    const staticExpanded = css.slice(staticExpandedStart, staticExpandedEnd + 2);
    assert.doesNotMatch(staticExpanded, /padding\s*:/, 'expanded grid item must not change size through a padding jump');
    assert.match(staticExpanded, /background:\s*var\(--fptm-nav-child-surface/, 'expanded viewport must preserve its child surface');

    const staticListStart = css.indexOf('.fp-tools-nav .fpt-nav-group-list {');
    const staticListEnd = css.indexOf('\n}', staticListStart);
    const staticList = css.slice(staticListStart, staticListEnd + 2);
    assert.match(staticList, /padding:\s*8px 6px 10px\s*;/, 'constant inner-list padding must retain child breathing room');

    const themeStart = source.indexOf('const FPT_MENU_THEME_CSS = `');
    const themeEnd = source.indexOf('`;', themeStart);
    const themeCss = source.slice(themeStart, themeEnd);
    const themeItems = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{');
    assert.match(themeItems, /padding:0;/, 'runtime theme must not reintroduce closed-group padding');
    const themeExpanded = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{');
    assert.doesNotMatch(themeExpanded, /padding\s*:/, 'runtime grid item must not jump when expanded');
    assert.match(themeExpanded, /background:var\(--fptm-nav-child-surface\)/, 'runtime viewport must preserve its child surface');
    const themeList = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{');
    assert.match(themeList, /padding:8px 6px 10px;/, 'runtime inner-list padding must remain constant through expansion');

    assert.match(css, /\.fp-tools-popup button:not\(\.fpt-nav-group-toggle\)/, 'generic button transitions must not override the accordion motion');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-toggle\s*\{[\s\S]*?transition:[^;]*\.24s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'section toggles must use the shared eased duration');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-chevron\s*\{[\s\S]*?transition:\s*transform\s+\.24s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'chevrons must use the shared eased duration');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-collapse\s*\{[\s\S]*?transition:\s*grid-template-rows\s+\.24s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'group collapse must use the shared eased duration');
    const staticAnimatedItemsStart = css.indexOf('.fp-tools-nav .fpt-nav-group-items {');
    const staticAnimatedItemsEnd = css.indexOf('\n}', staticAnimatedItemsStart);
    const staticAnimatedItems = css.slice(staticAnimatedItemsStart, staticAnimatedItemsEnd + 2);
    assert.doesNotMatch(staticAnimatedItems, /transition:[^;]*padding/, 'child reveal must not animate a padding inset');

    const themeAnimatedItemsStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{');
    const themeAnimatedItemsEnd = themeCss.indexOf('\n}', themeAnimatedItemsStart);
    const themeAnimatedItems = themeCss.slice(themeAnimatedItemsStart, themeAnimatedItemsEnd + 2);
    assert.doesNotMatch(themeAnimatedItems, /transition:[^;]*padding/, 'runtime child reveal must not animate a padding inset');
    const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const reducedMotion = css.slice(reducedMotionStart, reducedMotionStart + 500);
    assert.match(reducedMotion, /\.fpt-nav-group-collapse/, 'reduced-motion mode must disable the child reveal animation');
    assert.match(reducedMotion, /\.fpt-nav-group-chevron/, 'reduced-motion mode must disable the chevron rotation animation');
}

function runAll() {
    testEveryExistingPageBelongsToExactlyOneSection();
    testSixIndependentAccordionSections();
    testAccordionRendererMovesExistingNodes();
    testPageClickContractAndRestore();
    testSearchRestoresAccordionState();
    testGlobalChatAndShortcutContracts();
    testAccordionStyles();
    testSelectedReferenceKeepsSpaciousActiveHierarchy();
    testNavigationRegressionGuards();
    console.log('T18_NAVIGATION_IA_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('T18_NAVIGATION_IA_FAIL:', error);
    process.exit(1);
}
