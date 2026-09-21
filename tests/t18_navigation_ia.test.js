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

function extractSchemaPages() {
    const start = source.indexOf('const FPT_NAV_SECTIONS = Object.freeze([');
    const end = source.indexOf('const FPT_NAV_LABEL_OVERRIDES', start);
    assert.ok(start >= 0 && end > start, 'FPT_NAV_SECTIONS must exist before label overrides');
    const schema = source.slice(start, end);
    const pages = [];
    for (const match of schema.matchAll(/pages:\s*Object\.freeze\(\[([^\]]*)\]\)/g)) {
        for (const pageMatch of match[1].matchAll(/'([^']+)'/g)) pages.push(pageMatch[1]);
    }
    return { schema, pages };
}

function testEveryExistingPageBelongsToExactlyOneSection() {
    const navPages = extractNavPages();
    const { pages } = extractSchemaPages();

    assert.equal(new Set(navPages).size, navPages.length, 'flat nav must not contain duplicate data-page ids');
    assert.equal(new Set(pages).size, pages.length, 'navigation schema must not duplicate page ids');
    assert.deepEqual([...pages].sort(), [...navPages].sort(), 'navigation schema must cover every existing data-page exactly once');
}

function testFivePrimarySectionsPlusOverflow() {
    const { schema } = extractSchemaPages();
    assert.equal((schema.match(/primary:\s*true/g) || []).length, 5, 'there must be exactly five primary navigation sections');
    assert.equal((schema.match(/primary:\s*false/g) || []).length, 1, 'there must be one overflow section');
    for (const id of ['core', 'store', 'messages', 'finance', 'settings', 'more']) {
        assert.match(schema, new RegExp("id:\\s*'" + id + "'"), 'schema must include section ' + id);
    }
}

function testNavigationBindingPreservesExistingPageContract() {
    const setupStart = source.indexOf('function setupPopupNavigation()');
    const navItemsPos = source.indexOf("const navItems = toolsPopup.querySelectorAll('.fp-tools-nav li, .fp-tools-header-tab');", setupStart);
    const sectionsPos = source.indexOf('const navSections = setupNavigationSections(toolsPopup);', setupStart);
    assert.ok(sectionsPos > setupStart && sectionsPos < navItemsPos, 'section IA must be initialized before page click handlers');

    const clickWindow = source.slice(navItemsPos, navItemsPos + 1900);
    assert.match(clickWindow, /navSections\.showSectionForPage\(pageId\)/, 'page click must reveal its owning section');
    assert.match(clickWindow, /fpToolsLastPage:\s*pageId/, 'existing fpToolsLastPage persistence must remain');
}

function testSearchCanCrossSectionBoundariesAndRestoreContext() {
    const searchStart = source.indexOf('function setupNavSearch(toolsPopup)');
    const searchEnd = source.indexOf('async function loadLastActivePage()', searchStart);
    const searchBlock = source.slice(searchStart, searchEnd);
    assert.match(searchBlock, /navSections\.revealAllForSearch\(\)/, 'search must reveal pages across all sections');
    assert.match(searchBlock, /navSections\.refresh\(\)/, 'clearing search must restore the active contextual section');
    assert.match(searchBlock, /compactNav\(toolsPopup\)/, 'search must rebalance the two-column grid');
}

function testLastPageRestoreStillUsesNormalClickPath() {
    const start = source.indexOf('async function loadLastActivePage()');
    const block = source.slice(start, start + 650);
    assert.match(block, /fpToolsLastPage/, 'restore must still read the saved page id');
    assert.match(block, /li\[data-page=/, 'restore must still locate the existing data-page item');
    assert.match(block, /itemToActivate\.click\(\)/, 'restore must still enter through the normal page click contract');
}

function testContextualNavStylesExist() {
    for (const selector of [
        '.fpt-nav-primary',
        '.fpt-nav-section-btn',
        '.fpt-nav-context-head',
        '.fpt-nav-context-list',
        '.fpt-nav-section-hidden',
        '.fpt-nav-more-btn'
    ]) {
        assert.ok(css.includes(selector), 'missing contextual navigation style: ' + selector);
    }
}

function runAll() {
    testEveryExistingPageBelongsToExactlyOneSection();
    testFivePrimarySectionsPlusOverflow();
    testNavigationBindingPreservesExistingPageContract();
    testSearchCanCrossSectionBoundariesAndRestoreContext();
    testLastPageRestoreStillUsesNormalClickPath();
    testContextualNavStylesExist();
    console.log('T18_NAVIGATION_IA_PASS');
}

try {
    runAll();
} catch (error) {
    console.error('T18_NAVIGATION_IA_FAIL:', error);
    process.exit(1);
}
