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

function runAll() {
    testEveryExistingPageBelongsToExactlyOneSection();
    testSixIndependentAccordionSections();
    testAccordionRendererMovesExistingNodes();
    testPageClickContractAndRestore();
    testSearchRestoresAccordionState();
    testGlobalChatAndShortcutContracts();
    testAccordionStyles();
    console.log('T18_NAVIGATION_IA_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('T18_NAVIGATION_IA_FAIL:', error);
    process.exit(1);
}
