const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const popupSource = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const templatesSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'templates.js'), 'utf8').replace(/\r\n/g, '\n');
const piggySource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'piggy_bank.js'), 'utf8').replace(/\r\n/g, '\n');
const globalChatSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'global_chat.js'), 'utf8').replace(/\r\n/g, '\n');

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.values.has(name) : !!force;
        if (shouldAdd) this.values.add(name);
        else this.values.delete(name);
        return shouldAdd;
    }
}

class FakeElement {
    constructor({ pageId, label, text = '', section = '' } = {}) {
        this.dataset = {};
        if (pageId) this.dataset.page = pageId;
        if (section) this.dataset.navSection = section;
        this.label = label || null;
        this.textContent = text;
        this.style = { setProperty(name, value) { this[name] = value; } };
        this.classList = new FakeClassList();
        this.attributes = {};
        this.listeners = Object.create(null);
        this.children = [];
        this.parentElement = null;
        this.value = '';
        this._html = '';
        this._selectorChildren = Object.create(null);
    }
    set className(value) {
        this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classList.values].join(' '); }
    set innerHTML(value) {
        this._html = String(value);
        this.children = [];
        if (this.classList.contains('fpt-nav-search-result')) {
            this._selectorChildren['.fpt-nsr-text'] = new FakeElement();
            this._selectorChildren['.fpt-nsr-page'] = new FakeElement();
        }
    }
    get innerHTML() { return this._html; }
    addEventListener(type, handler) {
        (this.listeners[type] ||= []).push(handler);
    }
    async dispatch(type, event = {}) {
        for (const handler of this.listeners[type] || []) await handler({
            preventDefault() {},
            stopPropagation() {},
            target: this,
            key: '',
            ...event
        });
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(child) {
        if (child && child.children && child.isFragment) {
            for (const nested of [...child.children]) this.appendChild(nested);
            child.children = [];
            return child;
        }
        child.parentElement = this;
        this.children.push(child);
        return child;
    }
    querySelector(selector) {
        if (this._customQuerySelector) {
            const result = this._customQuerySelector(selector);
            if (result !== undefined) return result;
        }
        if (selector === 'span:last-child') return this.label;
        if (this._selectorChildren[selector]) return this._selectorChildren[selector];
        if (selector === '.fpt-nav-search-result') return this.children.find(child => child.classList.contains('fpt-nav-search-result')) || null;
        if (selector === '.fpt-nsr-text' || selector === '.fpt-nsr-page') return this._selectorChildren[selector] || null;
        return null;
    }
    querySelectorAll(selector) {
        if (this._customQuerySelectorAll) {
            const result = this._customQuerySelectorAll(selector);
            if (result !== undefined) return result;
        }
        if (selector === 'h3, h4, h5, label > span, .feature-title, .setting-group > h4') return this.headings || [];
        if (selector === '.fpt-search-flash') return [];
        if (selector === '.fpt-nav-search-result') return this.children.filter(child => child.classList.contains('fpt-nav-search-result'));
        return [];
    }
    focus() { this.focused = true; }
    select() { this.selected = true; }
    blur() { this.focused = false; }
    scrollIntoView() { this.scrolled = true; }
    closest() { return null; }
    contains(node) { return node === this || this.children.includes(node); }
}

function createNodeListLike(items) {
    const collection = {
        length: items.length,
        forEach(callback, thisArg) {
            for (let index = 0; index < this.length; index++) {
                callback.call(thisArg, this[index], index, this);
            }
        },
        [Symbol.iterator]: function* () {
            for (let index = 0; index < this.length; index++) yield this[index];
        }
    };
    items.forEach((item, index) => { collection[index] = item; });
    return collection;
}

function createHarness(storageSeed = {}, financeSubtab = null) {
    const storage = { ...storageSeed };
    const storageWrites = [];
    const navIds = ['general', 'notes', 'support', 'lot_io', 'finance_hub', 'templates', 'global_chat'];
    const navItems = navIds.map(id => {
        const li = new FakeElement({ pageId: id, label: new FakeElement({ text: id === 'global_chat' ? 'Общий чат' : id }) });
        li.classList.add('fp-nav-child');
        return li;
    });
    const pages = navIds.map(id => {
        const page = new FakeElement({ pageId: id });
        if (id === 'global_chat') page.headings = [new FakeElement({ text: 'Секретная функция чата' })];
        return page;
    });
    const financePage = pages.find(page => page.dataset.page === 'finance_hub');
    const financeSubtabs = ['overview', 'sales', 'purchases', 'profit', 'potential', 'operations'].map((subtab, index) => {
        const button = new FakeElement();
        button.dataset.subtab = subtab;
        button.offsetLeft = index * 64;
        button.offsetWidth = 56;
        if (subtab === 'overview') button.classList.add('active');
        return button;
    });
    const financePanes = financeSubtabs.map((button, index) => {
        const pane = new FakeElement();
        pane.dataset.subtab = button.dataset.subtab;
        if (index === 0) pane.classList.add('active');
        return pane;
    });
    const financeSubtabNodes = createNodeListLike(financeSubtabs);
    const financePaneNodes = createNodeListLike(financePanes);
    const financeSubtabsBar = new FakeElement();
    financeSubtabsBar.clientWidth = 420;
    financeSubtabsBar.scrollTo = () => {};
    const financeIndicator = new FakeElement();
    financePage._customQuerySelector = selector => {
        if (selector === '#fptFinSubtabs') return financeSubtabsBar;
        if (selector === '#fptFinSubtabsIndicator') return financeIndicator;
        if (selector === '.fpt-fin-subtab.active') return financeSubtabs.find(button => button.classList.contains('active')) || null;
        if (selector === '.fpt-fin-tab-pane.active') return financePanes.find(pane => pane.classList.contains('active')) || null;
        const subtabMatch = selector.match(/\.fpt-fin-subtab\[data-subtab=["']([^"']+)["']\]/);
        if (subtabMatch) return financeSubtabs.find(button => button.dataset.subtab === subtabMatch[1]) || null;
        const paneMatch = selector.match(/\.fpt-fin-tab-pane\[data-subtab=["']([^"']+)["']\]/);
        if (paneMatch) return financePanes.find(pane => pane.dataset.subtab === paneMatch[1]) || null;
        return undefined;
    };
    financePage._customQuerySelectorAll = selector => {
        if (selector === '.fpt-fin-subtab') return financeSubtabNodes;
        if (selector === '.fpt-fin-tab-pane') return financePaneNodes;
        return undefined;
    };
    pages[0].classList.add('active');
    navItems[0].classList.add('active');

    const input = new FakeElement();
    const clearButton = new FakeElement();
    const searchToggle = new FakeElement();
    const results = new FakeElement();
    const nav = new FakeElement();
    const body = new FakeElement();
    body.appendChild(results);
    const popup = new FakeElement();
    popup.classList.add('fp-tools-popup');
    popup.dataset = {};
    popup._pages = pages;
    popup._navItems = navItems;
    popup._searchElements = { input, clearButton, searchToggle, results, nav, body };
    popup._fptNavSections = {
        selected: [],
        showSectionForPage(id) { this.selected.push(id); },
        refresh() {},
        revealAllForSearch() {},
        isNavCollapsed() { return false; },
        getNavStateSnapshot() { return { collapsed: false, expandedSections: [] }; },
        restoreNavStateSnapshot() {},
        setNavCollapsed() {}
    };
    popup.querySelectorAll = selector => {
        if (selector === '.fp-tools-page-content') return pages;
        if (selector === '.fp-tools-nav li[data-page]') return navItems;
        if (selector === '.fp-tools-nav li.fp-nav-divider') return [];
        if (selector === '.fp-tools-nav li, .fp-tools-header-tab') return navItems;
        if (selector === '.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]') return navItems;
        if (selector === '.fpt-search-flash') return [];
        return [];
    };
    popup.querySelector = selector => {
        if (selector.startsWith('.fp-tools-page-content')) return pages.find(page => selector.includes(`data-page="${page.dataset.page}"`)) || null;
        if (selector.startsWith('.fp-tools-nav') && selector.includes('data-page=')) return navItems.find(item => selector.includes(`data-page="${item.dataset.page}"`)) || null;
        const match = selector.match(/data-page=["']([^"']+)["']/);
        if (match) return navItems.find(item => item.dataset.page === match[1]) || pages.find(page => page.dataset.page === match[1]) || null;
        if (selector === '#fptNavSearch') return input;
        if (selector === '#fptNavSearchClear') return clearButton;
        if (selector === '#fptNavSearchToggle') return searchToggle;
        if (selector === '#fptNavSearchResults') return results;
        if (selector === '.fp-tools-nav') return nav;
        if (selector === '.fp-tools-body') return body;
        return null;
    };
    const feed = new FakeElement();
    const document = {
        querySelector(selector) {
            if (selector === '.fp-tools-popup') return popup;
            if (selector === 'li[data-page="global_chat"]') return navItems.find(item => item.dataset.page === 'global_chat');
            return null;
        },
        getElementById(id) { return id === 'fpt-gc-feed' ? feed : null; },
        createElement() { return new FakeElement(); },
        createDocumentFragment() { const fragment = new FakeElement(); fragment.isFragment = true; return fragment; }
    };
    const windowListeners = Object.create(null);
    const window = {
        fptFinanceHub: { onPageLeave() { window.leaveFinanceCount = (window.leaveFinanceCount || 0) + 1; } },
        addEventListener(type, handler) { (windowListeners[type] ||= []).push(handler); },
        dispatchEvent(event) { (windowListeners[event.type] || []).forEach(handler => handler(event)); }
    };
    const chrome = {
        storage: {
            local: {
                async get(keys) {
                    if (typeof keys === 'string') return Object.prototype.hasOwnProperty.call(storage, keys) ? { [keys]: storage[keys] } : {};
                    if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => Object.prototype.hasOwnProperty.call(storage, key)).map(key => [key, storage[key]]));
                    if (keys && typeof keys === 'object') return { ...keys, ...storage };
                    return { ...storage };
                },
                async set(values) { Object.assign(storage, values); storageWrites.push({ ...values }); }
            }
        }
    };
    const sessionValues = new Map(financeSubtab ? [['fpt_fin_active_subtab', financeSubtab]] : []);
    const sessionStorage = {
        getItem(key) { return sessionValues.has(key) ? sessionValues.get(key) : null; },
        setItem(key, value) { sessionValues.set(key, String(value)); }
    };
    class FakeCustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
    const context = vm.createContext({
        window, document, chrome, sessionStorage, CustomEvent: FakeCustomEvent,
        console: { log() {}, error() {}, warn() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: callback => setTimeout(callback, 0),
        fetch: async () => ({ ok: false }),
        URL, Date, Promise, Object, Array, Set, Map, Math, String, Number, Boolean, RegExp, Error
    });
    vm.runInContext(popupSource, context, { filename: 'content/ui/main_popup.js' });
    vm.runInContext(globalChatSource, context, { filename: 'content/features/global_chat.js' });
    return { context, window, popup, pages, navItems, financeSubtabs, financeSubtabNodes, storage, storageWrites, input, clearButton, results, feed, sessionValues };
}

function assertRouterApi(harness) {
    assert.equal(typeof harness.window.fptOpenPopupPage, 'function', 'popup must expose the guarded central route entry point');
}

async function testRoutesAndModePersistence() {
    const h = createHarness({}, 'sales');
    assertRouterApi(h);
    const initCounts = { notes: 0, support: 0, lot_io: 0 };
    assert.equal(typeof h.financeSubtabNodes.map, 'undefined', 'querySelectorAll must behave like a NodeList without Array.map');
    assert.equal(typeof h.financeSubtabNodes.some, 'undefined', 'querySelectorAll must behave like a NodeList without Array.some');
    h.context.initializeNotes = () => { initCounts.notes += 1; };
    h.context.initializeLotIO = () => { initCounts.lot_io += 1; };
    h.context.setupFinanceHubUI(h.popup);
    h.window.fptRegisterPopupPageModeHandler('templates', {
        defaultMode: 'templates',
        modes: ['templates', 'commands'],
        select(mode) { h.context.selectedTemplatesMode = mode; return true; }
    });
    h.window.fptRegisterPopupRouteAlias('legacy_commands', { pageId: 'templates', mode: 'commands' });
    assert.equal(await h.window.fptOpenPopupPage('notes'), true);
    assert.equal(h.pages.find(page => page.dataset.page === 'notes').classList.contains('active'), true);
    assert.equal(h.navItems.find(item => item.dataset.page === 'notes').classList.contains('active'), true);
    assert.equal(h.storage.fpToolsLastPage, 'notes');
    assert.equal(h.storage.fpToolsLastPageMode, null, 'single-pane pages store a null current mode');
    assert.equal(h.storage.fpToolsPageModes.notes, null);
    assert.equal(initCounts.notes, 1);

    await h.window.fptOpenPopupPage('notes');
    assert.equal(initCounts.notes, 1, 'reopening the active page does not rerun its entry initializer');
    await h.window.fptOpenPopupPage('support');
    assert.equal(h.storage.fpToolsLastPage, 'support');
    assert.equal(initCounts.support || 0, 0);
    await h.window.fptOpenPopupPage('notes');
    assert.equal(initCounts.notes, 2, 'returning after leaving is a new page entry');

    await h.window.fptOpenPopupPage('finance_hub');
    const activeFinanceMode = () => h.financeSubtabs.find(button => button.classList.contains('active'))?.dataset.subtab;
    assert.equal(activeFinanceMode(), 'sales', 'valid Finance Hub session state migrates when its mode map is empty');
    assert.equal(h.storage.fpToolsPageModes.finance_hub, 'sales');
    assert.equal(h.storage.fpToolsLastPageMode, 'sales');
    await h.window.fptOpenPopupPage('lot_io');
    await h.window.fptOpenPopupPage('finance_hub');
    assert.equal(activeFinanceMode(), 'sales', 'a page restores its own last mode after visiting another page');

    await h.window.fptOpenPopupPage('finance_hub', { mode: 'profit' });
    await h.window.fptOpenPopupPage('general');
    await h.window.fptOpenPopupPage('finance_hub');
    assert.equal(activeFinanceMode(), 'profit');
    await h.window.fptOpenPopupPage('finance_hub', { mode: 'not-a-finance-mode' });
    assert.equal(activeFinanceMode(), 'overview', 'unsupported explicit modes fall back to the page default');
    assert.equal(h.storage.fpToolsLastPageMode, 'overview');

    await h.financeSubtabs.find(button => button.dataset.subtab === 'sales').dispatch('click');
    await h.popup._fptNavigationWriteQueue;
    assert.equal(h.storage.fpToolsPageModes.finance_hub, 'sales', 'Finance Hub tab selection updates its page mode map');
    await h.window.fptOpenPopupPage('general');
    await h.window.fptOpenPopupPage('finance_hub');
    assert.equal(activeFinanceMode(), 'sales');

    await h.window.fptOpenPopupPage('legacy_commands');
    assert.equal(h.storage.fpToolsLastPage, 'templates', 'registered aliases persist the canonical page ID');
    assert.equal(h.storage.fpToolsPageModes.templates, 'commands');
    await h.window.fptOpenPopupPage('notes');
    await h.window.fptOpenPopupPage('templates');
    assert.equal(h.context.selectedTemplatesMode, 'commands', 'each page restores its own saved mode');

    await h.window.fptOpenPopupPage('does_not_exist');
    assert.equal(h.storage.fpToolsLastPage, 'lot_io', 'unknown IDs route to and persist the safe page');
    assert.equal(h.pages.find(page => page.dataset.page === 'lot_io').classList.contains('active'), true);
    assert.equal(h.window.leaveFinanceCount, 4, 'leaving Finance Hub invokes the existing cleanup once per exit');
}

async function testDelayedGlobalChatVisibilityAndSearchInvalidation() {
    const h = createHarness({
        fpToolsLastPage: 'global_chat',
        fpToolsGCConfig: { display: true, active: false },
        fpToolsGCConfigTs: Date.now()
    });
    assertRouterApi(h);
    h.context.setupGlobalChatVisibilityHandoff(h.popup);
    h.context.setupNavSearch(h.popup);
    await h.context.loadLastActivePage();
    assert.equal(h.pages.find(page => page.dataset.page === 'global_chat').classList.contains('active'), true, 'the saved chat route may restore before remote config resolves');

    h.input.value = 'секретная функция';
    await h.input.dispatch('input');
    await new Promise(resolve => setTimeout(resolve, 115));
    assert.equal(h.results.querySelectorAll('.fpt-nav-search-result').length, 1, 'the visible page contributes searchable headings');

    let resolveRemote;
    h.context.fetch = () => new Promise(resolve => { resolveRemote = resolve; });
    const pendingConfig = h.context.fptGcRefreshConfig(true);
    await Promise.resolve();
    resolveRemote({ ok: true, async json() { return { display: false, active: true }; } });
    await pendingConfig;
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(h.pages.find(page => page.dataset.page === 'lot_io').classList.contains('active'), true, 'remote display=false immediately replaces the open chat page');
    assert.equal(h.storage.fpToolsLastPage, 'lot_io', 'remote hiding persists the safe route');
    assert.equal(h.navItems.find(item => item.dataset.page === 'global_chat').style.display, 'none');
    assert.equal(h.navItems.find(item => item.dataset.page === 'global_chat').getAttribute('aria-hidden'), 'true');
    assert.equal(h.results.querySelectorAll('.fpt-nav-search-result').length, 0, 'already rendered search rows for hidden content are invalidated immediately');

    const rebuiltIndex = h.popup._fptNavSearch.buildFeatureIndex();
    assert.equal(rebuiltIndex.some(item => item.pageId === 'global_chat'), false, 'hidden page headings are excluded from the full search index');
    h.input.value = 'секретная функция';
    await h.input.dispatch('input');
    await new Promise(resolve => setTimeout(resolve, 115));
    assert.equal(h.results.querySelectorAll('.fpt-nav-search-result').length, 0);

    h.storage.fpToolsGCConfig = { display: true, active: false };
    h.storage.fpToolsGCConfigTs = Date.now();
    await h.context.fptGcRefreshConfig(false);
    assert.equal(h.navItems.find(item => item.dataset.page === 'global_chat').style.display, '');
    assert.equal(h.navItems.find(item => item.dataset.page === 'global_chat').getAttribute('aria-disabled'), 'true');
    assert.equal(await h.window.fptOpenPopupPage('global_chat'), true, 'active=false keeps the chat route available');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.match(h.feed.innerHTML, /fpt-gc-disabled/, 'active=false renders the existing disabled chat state');
}

function testFeatureLinksUseTheRouter() {
    const setupStart = popupSource.indexOf('function setupPopupNavigation()');
    const setupEnd = popupSource.indexOf('function setupFinanceHubUI', setupStart);
    const setup = popupSource.slice(setupStart, setupEnd);
    assert.match(setup, /openPopupPage\(item\.dataset\.page\)/, 'page clicks delegate to the central router');
    assert.match(setup, /openPopupPage\(['"]support['"]/, 'the support promo deep link uses the router');
    assert.doesNotMatch(setup, /supportTabLi\.click\(\)/, 'the promo link must not synthesize a nav click');
    assert.match(templatesSource, /fptOpenPopupPage\(['"]templates['"]/, 'chat template links use the central router');
    assert.doesNotMatch(templatesSource.slice(templatesSource.indexOf('async function openTemplateSettings')), /navItem\.click\(\)/);
    assert.match(piggySource, /await window\.__fpEnsurePopup\(\)[\s\S]*fptOpenPopupPage\(['"]piggy_banks['"]/, 'piggy bank links create the popup before routing');
    assert.doesNotMatch(piggySource, /data-page=\\?["']piggy_banks["'][^\n]*\.click\(\)/, 'piggy bank links do not depend on a nav li click');
    assert.match(globalChatSource, /fpt:global-chat-visibility/, 'remote configuration publishes a visibility handoff');
    const navigationStart = popupSource.indexOf('function setupNavigationSections(');
    const navigationEnd = popupSource.indexOf('function setupPopupNavigation()', navigationStart);
    const navigation = popupSource.slice(navigationStart, navigationEnd);
    assert.match(navigation, /isPopupPageAvailable\(toolsPopup, item\.dataset\.page\)/, 'search expansion keeps remotely hidden page rows inaccessible');
}

async function run() {
    await testRoutesAndModePersistence();
    await testDelayedGlobalChatVisibilityAndSearchInvalidation();
    testFeatureLinksUseTheRouter();
    console.log('NAVIGATION_ROUTES_PASS');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
