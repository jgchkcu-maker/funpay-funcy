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

function extractQuickActionIds() {
    const start = source.indexOf('const FPT_NAV_QUICK_ACTIONS = Object.freeze([');
    const end = source.indexOf(']);', start);
    assert.ok(start >= 0 && end > start, 'FPT_NAV_QUICK_ACTIONS must define the footer routes');
    return [...source.slice(start, end).matchAll(/'([^']+)'/g)].map(match => match[1]);
}

function extractStyleRule(stylesheet, selector) {
    const start = stylesheet.lastIndexOf(selector);
    assert.ok(start >= 0, 'missing stylesheet rule: ' + selector);
    const open = stylesheet.indexOf('{', start);
    const close = stylesheet.indexOf('}', open);
    assert.ok(open > start && close > open, 'invalid stylesheet rule: ' + selector);
    return stylesheet.slice(open + 1, close);
}

function testEveryExistingPageBelongsToExactlyOneSection() {
    const navPages = extractNavPages();
    const { pages } = extractSchema();
    assert.ok(navPages.length > 0, 'popup must retain existing page nodes');
    assert.equal(new Set(navPages).size, navPages.length, 'flat nav must not contain duplicate data-page ids');
    assert.equal(new Set(pages).size, pages.length, 'navigation schema must not duplicate page ids');
    const quickActions = extractQuickActionIds();
    assert.equal(pages.length, 22, 'accordion groups must own exactly 22 pages');
    assert.equal(quickActions.length, 2, 'the footer must own exactly two quick routes');
    assert.equal(new Set(quickActions).size, quickActions.length, 'footer routes must not duplicate each other');
    assert.deepEqual([...pages, ...quickActions].sort(), [...navPages].sort(),
        'six groups and footer actions must cover all 24 canonical nav routes exactly once');
    assert.deepEqual(quickActions, ['notes', 'support'], 'notes and support must remain the footer routes');
}

function testSixIndependentAccordionSections() {
    const { schema, sections } = extractSchema();
    const expected = [
        { id: 'sales', pages: ['lot_io', 'auto_delivery', 'autobump', 'ai_audit'] },
        { id: 'customers', pages: ['auto_reply', 'auto_review', 'templates', 'blacklist'] },
        { id: 'finance', pages: ['finance_hub', 'piggy_banks', 'calculator'] },
        { id: 'interface', pages: ['theme', 'effects', 'epic_nicks', 'needs'] },
        { id: 'settings', pages: ['accounts', 'general', 'telegram', 'settings_io'] },
        { id: 'help', pages: ['overview', 'tickets', 'global_chat'] }
    ];
    assert.deepEqual(sections, expected, 'the six navigation groups must use the final order and exact page sets');
    assert.equal(new Set(sections.map(section => section.id)).size, sections.length, 'accordion section IDs must be unique');
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
    assert.match(source, /fpToolsNavExpandedSectionsV2/, 'expanded state must use the versioned section key');
    assert.doesNotMatch(source, /fpToolsNavExpandedSections(?!V2)/, 'legacy ambiguous section IDs must not be read');
    assert.match(block, /FPT_NAV_QUICK_ACTIONS[\s\S]*?appendChild\(item\)/,
        'notes and support must move into the footer without cloning route nodes');
}

function testInitialPageAndExpandedStateFallback() {
    assert.match(source, /<li data-page="lot_io" class="active">[\s\S]*?<\/li>/,
        'the initial navigation route must be lot_io');
    assert.match(source, /<div class="fp-tools-page-content active" data-page="lot_io">/,
        'lot_io must be the initial visible page');
    assert.match(source, /const FPT_NAV_EXPANDED_STORAGE_KEY\s*=\s*['"]fpToolsNavExpandedSectionsV2['"]/,
        'only the versioned expanded section key is supported');
    assert.match(source, /const FPT_NAV_COLLAPSED_STORAGE_KEY\s*=\s*['"]fpToolsNavCollapsed['"]/,
        'the existing collapsed preference key must be preserved');

    const setupStart = source.indexOf('function setupNavigationSections(toolsPopup)');
    const setupEnd = source.indexOf('function setupPopupNavigation()', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /let activeSection = activePage\?\.dataset\.navSection \|\| pageToSection\.get\(['"]lot_io['"]\)/,
        'active-section fallback must resolve to the lot_io group');
    assert.match(setupBlock, /let expandedSections = new Set\(\[activeSection\]\)/,
        'a new installation must open only the active page group');
    assert.match(setupBlock, /validSavedExpandedSections/,
        'restoration must validate saved section IDs before applying them');
    assert.match(setupBlock, /setExpandedSections\(activeSection \? \[activeSection\] : \[\], false\)/,
        'missing or invalid saved IDs must fall back to the active page group');
}

function testFinalLabelsAndRatingRoute() {
    const schemaStart = source.indexOf('const FPT_NAV_SECTIONS = Object.freeze([');
    const labelsStart = source.indexOf('const FPT_NAV_LABEL_OVERRIDES = Object.freeze({', schemaStart);
    const quickActionsStart = source.indexOf('const FPT_NAV_QUICK_ACTIONS', labelsStart);
    const schema = source.slice(schemaStart, labelsStart);
    const labels = source.slice(labelsStart, quickActionsStart);
    const sectionLabels = [
        ['sales', 'Лоты и продажи'],
        ['customers', 'Покупатели'],
        ['finance', 'Финансы'],
        ['interface', 'Интерфейс'],
        ['settings', 'Настройки'],
        ['help', 'Справка']
    ];
    for (const [id, label] of sectionLabels) {
        assert.match(schema, new RegExp(`id:\\s*['"]${id}['"],\\s*label:\\s*['"]${label}['"]`),
            id + ' must use the approved section title');
    }
    const pageLabels = [
        ['lot_io', 'Управление лотами'], ['auto_delivery', 'Автовыдача'], ['autobump', 'Автоподнятие'], ['ai_audit', 'Аудит магазина'],
        ['auto_reply', 'Автоответчик'], ['auto_review', 'Отзывы и бонусы'], ['templates', 'Быстрые ответы'], ['blacklist', 'Чёрный список'],
        ['finance_hub', 'Обзор и аналитика'], ['piggy_banks', 'Копилки'], ['calculator', 'Калькуляторы'],
        ['theme', 'Темы'], ['effects', 'Эффекты'], ['epic_nicks', 'Оформление ника'], ['needs', 'Элементы интерфейса'],
        ['accounts', 'Аккаунты'], ['general', 'Отображение FunPay'], ['telegram', 'Уведомления и интеграции'], ['settings_io', 'Перенос настроек'],
        ['overview', 'Справочник функций'], ['tickets', 'Поддержка FunPay'], ['global_chat', 'Чат сообщества'],
        ['notes', 'Заметки'], ['support', 'Оценить расширение']
    ];
    for (const [id, label] of pageLabels) {
        assert.match(labels, new RegExp(`${id}:\\s*['"]${label}['"]`), id + ' must use its approved visible label');
    }
    assert.match(source, /<h3[^>]*>Поддержка FunPay<\/h3>/,
        'the FunPay ticket page heading must remain distinct from extension ratings');
    assert.match(source, /<h3>Оценить расширение[\s\S]*?star/,
        'the extension rating page must have a matching heading');
    assert.match(source, /<div class="fp-tools-page-content" data-page="overview">\s*<h3>Справочник функций<\/h3>/,
        'the handbook route must have the new page heading');
    const setupStart = source.indexOf('function setupPopupNavigation()');
    const setupEnd = source.indexOf('function selectQuickRepliesMode(', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /promoLink[\s\S]*openPopupPage\(['"]support['"]\)/,
        'the rating promotion must navigate through the central route entry point');
    assert.doesNotMatch(source, /Вкладка "Кастомизация"|Вкладка "Авто-поднятие"/,
        'help copy must not direct users to the superseded page names');
}

function testPageClickContractAndRestore() {
    const setupStart = source.indexOf('function setupPopupNavigation()');
    const setupEnd = source.indexOf('function setupFinanceHubUI', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /const navSections = setupNavigationSections\(toolsPopup\)/);
    assert.match(setupBlock, /openPopupPage\(item\.dataset\.page\)/, 'page clicks must delegate to the central router');

    const routerStart = source.indexOf('async function openPopupPage(');
    const routerEnd = source.indexOf('function setupGlobalChatVisibilityHandoff(', routerStart);
    const routerBlock = source.slice(routerStart, routerEnd);
    assert.match(routerBlock, /normalizePopupRoute\(pageId\)/, 'legacy routes must normalize before page state changes');
    assert.match(routerBlock, /navSections\.showSectionForPage\(targetPageId\)/, 'the router must reveal the active page section');
    assert.match(routerBlock, /actions\.forEach\(item => item\.classList\.toggle\('active', item\.dataset\.page === targetPageId\)\)/, 'the router must update active navigation state');
    assert.match(routerBlock, /page\.classList\.toggle\('active', page === pageNode\)/, 'the router must activate the canonical page content');
    assert.match(routerBlock, /persistPopupRouteState\(toolsPopup, targetPageId, targetMode\)/, 'the router must persist canonical page and mode state');

    const persistStart = source.indexOf('function persistPopupRouteState(');
    const persistEnd = source.indexOf('function persistPopupPageMode(', persistStart);
    const persistBlock = source.slice(persistStart, persistEnd);
    assert.match(persistBlock, /fpToolsLastPage:\s*pageId/, 'existing fpToolsLastPage persistence must remain canonical');
    assert.match(persistBlock, /fpToolsLastPageMode:\s*mode/);
    assert.match(persistBlock, /fpToolsPageModes:/);

    const restoreStart = source.indexOf('async function loadLastActivePage()');
    const restoreBlock = source.slice(restoreStart, restoreStart + 750);
    assert.match(restoreBlock, /fpToolsLastPage/);
    assert.match(restoreBlock, /return openPopupPage\(pageId\)/, 'restore must enter through the central router');
    assert.doesNotMatch(restoreBlock, /\.click\(\)/, 'restore must not synthesize a page click');
    assert.match(source, /restored\.add\(activeSection\)/, 'async expanded-state restore must keep the active page section open');
}

function testQuickRepliesMigrationContract() {
    const { pages } = extractSchema();
    assert.ok(!pages.includes('slash_commands'), 'slash_commands must be a legacy route, not a second navigation page');
    assert.doesNotMatch(source, /<li[^>]*data-page="slash_commands"/, 'the old slash command nav item must be removed');
    assert.doesNotMatch(source, /<div class="fp-tools-page-content" data-page="slash_commands"/, 'command controls must live inside the canonical templates page');
    assert.match(source, /data-quick-replies-mode="templates"[\s\S]*data-quick-replies-mode="commands"/);
    assert.match(source, /registerPopupRouteAlias\('slash_commands',\s*\{\s*pageId:\s*'templates',\s*mode:\s*'commands'\s*\}\)/);
}

function testAutoReplyPagesMigrationContract() {
    const { pages } = extractSchema();
    assert.ok(pages.includes('auto_reply'), 'the new autoresponder page belongs to the navigation schema');
    assert.ok(pages.includes('auto_review'), 'the existing auto_review page remains a canonical route');
    assert.equal(pages.filter(page => page === 'auto_reply').length, 1, 'auto_reply appears once in navigation data');
    assert.equal(pages.filter(page => page === 'auto_review').length, 1, 'auto_review appears once in navigation data');
    assert.match(source, /<li[^>]*data-page="auto_reply"/, 'auto_reply has a visible navigation item');
    assert.match(source, /<li[^>]*data-page="auto_review"/, 'the saved auto_review route stays navigable');
    assert.match(source, /<div class="fp-tools-page-content" data-page="auto_reply">[\s\S]*?<h3>Автоответчик<\/h3>/,
        'the greeting and order responders have their own searchable page heading');
    assert.match(source, /<div class="fp-tools-page-content" data-page="auto_review">[\s\S]*?<h3>Ответы на отзывы<\/h3>/,
        'review replies remain on auto_review');

    const searchStart = source.indexOf('function setupNavSearch(toolsPopup)');
    const searchEnd = source.indexOf('async function loadLastActivePage()', searchStart);
    const searchBlock = source.slice(searchStart, searchEnd);
    assert.match(searchBlock, /querySelectorAll\('\.fp-tools-page-content'\)/,
        'search indexes every page node, including the new auto_reply page');
    const routeStart = source.indexOf('async function openPopupPage(');
    const routeEnd = source.indexOf('function setupPopupNavigation()', routeStart);
    const routeBlock = source.slice(routeStart, routeEnd);
    assert.match(routeBlock, /targetPageId === 'auto_reply'\) initialize\('initializeAutoReplyUI'\)/,
        'the central router initializes auto_reply on entry');
}

function testSearchRestoresAccordionState() {
    const searchStart = source.indexOf('function setupNavSearch(toolsPopup)');
    const searchEnd = source.indexOf('async function loadLastActivePage()', searchStart);
    const searchBlock = source.slice(searchStart, searchEnd);
    assert.match(searchBlock, /searchNavStateSnapshot/, 'search must snapshot both the expanded groups and sidebar width');
    assert.match(searchBlock, /getNavStateSnapshot\(\)/, 'search must read the pre-search navigation state');
    assert.match(searchBlock, /restoreNavStateSnapshot\(/, 'clearing search must restore the pre-search navigation state');
    assert.match(searchBlock, /fptNavSearchToggle/, 'the compact search button must be part of search setup');
    assert.match(searchBlock, /setNavCollapsed\(false, false\)/, 'opening compact search must not overwrite the saved preference');
    assert.match(searchBlock, /revealAllForSearch\(/, 'search must reveal matching sections');
    assert.match(searchBlock, /groupId[\s\S]{0,100}pageId[\s\S]{0,100}mode[\s\S]{0,100}text[\s\S]{0,100}aliases[\s\S]{0,100}element/,
        'search index records carry group, page, mode, text, aliases and exact element context');
    assert.match(searchBlock, /\.fpt-nav-group-toggle/, 'group headings are searchable independently of pages');
    assert.match(searchBlock, /data-quick-replies-pane|data-calc-pane|fpt-fin-tab-pane|data-notification-pane/,
        'hidden mode panes are included in the search index');
    assert.match(searchBlock, /row\.addEventListener\('click'[\s\S]*jumpToFeature\(/,
        'page-result activation delegates to the route-and-scroll helper');
    assert.match(searchBlock, /function jumpToFeature\([\s\S]*openPopupPage\(/,
        'search-result activation routes through the central popup router');
    assert.match(searchBlock, /first\._fptSearchQuery\s*===\s*currentSearchQuery/,
        'Enter cannot activate a result row retained from an earlier query');
    assert.match(searchBlock, /aliases/, 'legacy navigation labels are searchable');
    assert.doesNotMatch(searchBlock, /compactNav\(/, 'search must not rebalance a removed two-column grid');
}

function testGlobalChatAndShortcutContracts() {
    assert.match(source, /<li data-page="global_chat"/, 'global_chat must remain an existing nav item');
    const handoffStart = source.indexOf('function setupGlobalChatVisibilityHandoff(');
    const handoffEnd = source.indexOf('function setupPopupNavigation()', handoffStart);
    const handoff = source.slice(handoffStart, handoffEnd);
    assert.match(handoff, /global_chat/, 'remote visibility handoff must continue to target global_chat');
    assert.match(handoff, /display/, 'remote display state must continue to hide or restore global_chat');
    assert.match(handoff, /openPopupPage\(['"]lot_io['"]\)/,
        'remote hiding must keep the existing fallback route behavior');
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
    assert.match(staticToggle, /min-height:\s*54px/, 'section toggles must keep the selected reference hit area');
    assert.match(staticToggle, /padding:\s*0 12px/, 'section toggles must be narrower without changing their vertical padding');
    assert.match(staticToggle, /font-size:\s*16px/, 'section labels must remain readable in the standalone menu');

    const staticActiveStart = css.indexOf('.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle {');
    const staticActiveEnd = css.indexOf('\n}', staticActiveStart);
    const staticActive = css.slice(staticActiveStart, staticActiveEnd + 2);
    assert.match(staticActive, /background:\s*#7663f6/i, 'an expanded category must use the reference violet surface');
    assert.match(staticActive, /color:\s*#fff/i, 'an expanded category must use white text and icon');

    const staticChildActiveStart = css.indexOf('.fp-tools-nav .fpt-nav-child.active a {');
    const staticChildActiveEnd = css.indexOf('\n}', staticChildActiveStart);
    const staticChildActive = css.slice(staticChildActiveStart, staticChildActiveEnd + 2);
    assert.match(staticChildActive, /background:\s*transparent/, 'the selected page must not create a nested card');

    const staticChildStart = css.indexOf('.fp-tools-nav .fpt-nav-child a {');
    const staticChildEnd = css.indexOf('\n}', staticChildStart);
    const staticChild = css.slice(staticChildStart, staticChildEnd + 2);
    assert.match(staticChild, /min-height:\s*44px/, 'nested pages must keep a comfortable standalone-menu hit area');
    assert.match(staticChild, /padding:\s*8px 10px 8px 0/, 'nested pages must stay aligned with the selected reference hierarchy');

    const themeStart = source.indexOf('const FPT_MENU_THEME_CSS = `');
    const themeEnd = source.indexOf('`;', themeStart);
    const themeCss = source.slice(themeStart, themeEnd);
    const themeToggleStart = themeCss.indexOf('.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-toggle{');
    const themeToggleEnd = themeCss.indexOf('\n}', themeToggleStart);
    const themeToggle = themeCss.slice(themeToggleStart, themeToggleEnd + 2);
    assert.match(themeToggle, /min-height:\s*54px/, 'runtime theme must not shrink the selected section hit area');
    assert.match(themeToggle, /padding:\s*0 12px/, 'runtime theme must narrow horizontal spacing without changing vertical padding');

    const themeActiveStart = themeCss.lastIndexOf('.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-toggle{');
    const themeActiveEnd = themeCss.indexOf('\n}', themeActiveStart);
    const themeActive = themeCss.slice(themeActiveStart, themeActiveEnd + 2);
    assert.match(themeActive, /background:#7663f6/i, 'runtime theme must show violet while a category is expanded');
    assert.match(themeActive, /color:#fff/i, 'runtime theme must use white text while a category is expanded');

    const themeChildStart = themeCss.lastIndexOf('.fp-tools-popup.fptm-themed .fp-tools-nav li a{');
    const themeChildEnd = themeCss.indexOf('\n}', themeChildStart);
    const themeChild = themeCss.slice(themeChildStart, themeChildEnd + 2);
    assert.match(themeChild, /min-height:\s*44px/, 'runtime theme must keep nested-page hit areas spacious');
    assert.match(themeChild, /padding:\s*8px 10px 8px 0/, 'runtime theme must keep nested-page alignment stable');

    const themeChildActiveStart = themeCss.lastIndexOf('.fp-tools-popup.fptm-themed .fp-tools-nav li.active a,');
    const themeChildActiveEnd = themeCss.indexOf('\n}', themeChildActiveStart);
    const themeChildActive = themeCss.slice(themeChildActiveStart, themeChildActiveEnd + 2);
    assert.match(themeChildActive, /background:transparent/, 'runtime theme must keep selected subpages free of nested cards');
}

function testNavigationRegressionGuards() {
    const setupStart = source.indexOf('function setupNavigationSections(toolsPopup)');
    const setupEnd = source.indexOf('function setupPopupNavigation()', setupStart);
    const setupBlock = source.slice(setupStart, setupEnd);
    assert.match(setupBlock, /navIcon\.dataset\.icon\s*=\s*section\.id/, 'section icons must be keyed to their supplied sprite set');
    assert.match(setupBlock, /navIcon\.setAttribute\(['"]aria-hidden['"],\s*['"]true['"]\)/, 'decorative section icons must be hidden from assistive technology');
    assert.match(setupBlock, /collapse\.toggleAttribute\(['"]inert['"],\s*!expanded\)/, 'collapsed sections must be removed from keyboard navigation');

    const staticItems = extractStyleRule(css, '.fp-tools-nav .fpt-nav-group-items {');
    assert.match(staticItems, /padding:\s*0\s*;/, 'closed group content must have no intrinsic padding');
    assert.match(staticItems, /overflow:\s*hidden/, 'the unpadded grid item must clip its inner list during reveal');

    const staticExpanded = extractStyleRule(css, '.fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items {');
    assert.doesNotMatch(staticExpanded, /padding\s*:/, 'expanded grid item must not change size through a padding jump');
    assert.doesNotMatch(staticExpanded, /background:\s*var\(--fptm-nav-child-surface/, 'expanded subpages must sit directly on the menu surface');

    const staticList = extractStyleRule(css, '.fp-tools-nav .fpt-nav-group-list {');
    assert.match(staticList, /padding:\s*6px 0 8px 0\s*;/, 'subpage rows must use the full section width');

    const themeStart = source.indexOf('const FPT_MENU_THEME_CSS = `');
    const themeEnd = source.indexOf('`;', themeStart);
    const themeCss = source.slice(themeStart, themeEnd);
    const themeItems = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group-items{');
    assert.match(themeItems, /padding:0;/, 'runtime theme must not reintroduce closed-group padding');
    const themeExpanded = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav .fpt-nav-group.is-expanded .fpt-nav-group-items{');
    assert.doesNotMatch(themeExpanded, /padding\s*:/, 'runtime grid item must not jump when expanded');
    assert.doesNotMatch(themeExpanded, /background:var\(--fptm-nav-child-surface\)/, 'runtime subpages must sit directly on the menu surface');
    const themeList = extractStyleRule(themeCss, '.fp-tools-popup.fptm-themed .fp-tools-nav ul.fpt-nav-group-list{');
    assert.match(themeList, /padding:6px 0 8px 0;/, 'runtime subpage rows must use the full section width');

    assert.match(css, /\.fp-tools-popup button:not\(\.fpt-nav-group-toggle\)/, 'generic button transitions must not override the accordion motion');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-toggle\s*\{[\s\S]*?transition:[^;]*\.24s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'section toggles must use the shared eased duration');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-chevron\s*\{[\s\S]*?transition:[^;]*transform\s+\.32s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'chevrons must use the shared eased duration');
    assert.match(css, /\.fp-tools-nav \.fpt-nav-group-collapse\s*\{[\s\S]*?transition:\s*grid-template-rows\s+\.32s\s+cubic-bezier\(\.22,1,\.36,1\)/, 'group collapse must use the shared eased duration');
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
    testQuickRepliesMigrationContract();
    testAutoReplyPagesMigrationContract();
    testSixIndependentAccordionSections();
    testAccordionRendererMovesExistingNodes();
    testInitialPageAndExpandedStateFallback();
    testFinalLabelsAndRatingRoute();
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
