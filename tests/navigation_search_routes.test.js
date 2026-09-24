const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const popupSource = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r/g, '\n');
const searchStart = popupSource.indexOf('function setupNavSearch(toolsPopup)');
const searchEnd = popupSource.indexOf('async function loadLastActivePage()', searchStart);
assert.ok(searchStart >= 0 && searchEnd > searchStart, 'setupNavSearch source block exists');

const sections = [
    { id: 'sales', label: 'Лоты и продажи', pages: ['lot_io', 'auto_delivery', 'autobump', 'ai_audit'] },
    { id: 'customers', label: 'Покупатели', pages: ['auto_reply', 'auto_review', 'templates', 'blacklist'] },
    { id: 'finance', label: 'Финансы', pages: ['finance_hub', 'piggy_banks', 'calculator'] },
    { id: 'interface', label: 'Интерфейс', pages: ['theme', 'effects', 'epic_nicks', 'needs'] },
    { id: 'settings', label: 'Настройки', pages: ['accounts', 'general', 'telegram', 'settings_io'] },
    { id: 'help', label: 'Справка', pages: ['overview', 'tickets', 'global_chat'] }
];
const labels = {
    lot_io: 'Управление лотами', auto_delivery: 'Автовыдача', autobump: 'Автоподнятие', ai_audit: 'Аудит магазина',
    auto_reply: 'Автоответчик', auto_review: 'Отзывы и бонусы', templates: 'Быстрые ответы', blacklist: 'Чёрный список',
    finance_hub: 'Обзор и аналитика', piggy_banks: 'Копилки', calculator: 'Калькуляторы', theme: 'Темы', effects: 'Эффекты',
    epic_nicks: 'Оформление ника', needs: 'Элементы интерфейса', accounts: 'Аккаунты', general: 'Отображение FunPay',
    telegram: 'Уведомления и интеграции', settings_io: 'Перенос настроек', overview: 'Справочник функций',
    tickets: 'Поддержка FunPay', global_chat: 'Чат сообщества', support: 'Оценить расширение'
};

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const enabled = force === undefined ? !this.values.has(name) : !!force;
        if (enabled) this.values.add(name);
        else this.values.delete(name);
        return enabled;
    }
}

class FakeElement {
    constructor({ text = '', pageId = '', sectionId = '', dataset = {}, label = null } = {}) {
        this.textContent = text;
        this.dataset = { ...dataset };
        if (pageId) this.dataset.page = pageId;
        if (sectionId) this.dataset.section = sectionId;
        this.label = label;
        this.classList = new FakeClassList();
        this.attributes = Object.create(null);
        this.listeners = Object.create(null);
        this.children = [];
        this.style = { display: '', setProperty(name, value) { this[name] = value; } };
        this.hidden = false;
        this.value = '';
        this.parentElement = null;
        this._html = '';
    }
    set className(value) { this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classList.values].join(' '); }
    set innerHTML(value) {
        this._html = String(value);
        this.children = [];
        if (this.classList.contains('fpt-nav-search-result')) {
            this._searchText = new FakeElement();
            this._searchPage = new FakeElement();
        }
    }
    get innerHTML() { return this._html; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    async dispatch(type, event = {}) {
        for (const handler of this.listeners[type] || []) {
            await handler({ preventDefault() {}, stopPropagation() {}, target: this, key: '', ...event });
        }
    }
    click() { return this.dispatch('click'); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(child) {
        if (child?.isFragment) {
            for (const nested of [...child.children]) this.appendChild(nested);
            child.children = [];
            return child;
        }
        child.parentElement = this;
        this.children.push(child);
        return child;
    }
    querySelector(selector) {
        if (selector === 'span:last-child' || selector === 'a > span:last-child') return this.label;
        if (selector === '.fpt-nsr-text') return this._searchText || null;
        if (selector === '.fpt-nsr-page') return this._searchPage || null;
        if (selector === '.fpt-nav-search-result') return this.children.find(child => child.classList.contains('fpt-nav-search-result')) || null;
        return null;
    }
    querySelectorAll(selector) {
        if (selector === 'h3, h4, h5, label > span, .feature-title, .setting-group > h4') return this.headings || [];
        if (selector === '[data-quick-replies-pane], .fpt-fin-tab-pane[data-subtab], [data-calc-pane], [data-notification-pane], [data-route-mode]') return this.panes || [];
        if (selector === '.fpt-nav-search-result') return this.children.filter(child => child.classList.contains('fpt-nav-search-result'));
        if (selector === '.fpt-search-flash') return [];
        return [];
    }
    focus() { this.focused = true; }
    select() { this.selected = true; }
    blur() { this.focused = false; }
    scrollIntoView() { this.scrolled = true; this.scrollOrder?.push(`scroll:${this.textContent}`); }
    closest() { return null; }
}

function createHarness() {
    const routeCalls = [];
    const order = [];
    const storageWrites = [];
    let globalChatVisible = true;
    const pageIds = sections.flatMap(section => section.pages).concat(['support']);
    const pageToSection = new Map(sections.flatMap(section => section.pages.map(pageId => [pageId, section.id])));
    const navItems = pageIds.map(pageId => {
        const li = new FakeElement({ pageId, label: new FakeElement({ text: pageId === 'tickets' ? 'Поддержка FunPay' : labels[pageId] }) });
        li.dataset.navSection = pageToSection.get(pageId) || '';
        li.classList.add(pageToSection.has(pageId) ? 'fpt-nav-child' : 'fpt-nav-quick-action');
        return li;
    });
    const groupToggles = sections.map(section => new FakeElement({ text: section.label, sectionId: section.id }));
    const allHeadings = [];
    const pages = pageIds.map(pageId => {
        const page = new FakeElement({ pageId });
        page.headings = [];
        page.panes = [];
        if (pageId === 'global_chat') page.headings.push(new FakeElement({ text: 'Секретная функция сообщества' }));
        if (pageId === 'templates') {
            const templates = new FakeElement({ dataset: { quickRepliesPane: 'templates' }, text: 'Шаблоны ответов' });
            const commands = new FakeElement({ dataset: { quickRepliesPane: 'commands' }, text: 'Слэш-команды' });
            commands.hidden = true;
            templates.headings = [new FakeElement({ text: 'Готовые шаблоны' })];
            commands.headings = [new FakeElement({ text: 'Настройки команды приветствия' })];
            page.panes.push(templates, commands);
        }
        if (pageId === 'calculator') {
            const currency = new FakeElement({ dataset: { calcPane: 'currency' } });
            currency.hidden = true;
            const exactTarget = new FakeElement({ text: 'Скрытый прогноз валютного рынка' });
            exactTarget.scrollOrder = order;
            currency.headings = [exactTarget];
            page.panes.push(currency);
        }
        allHeadings.push(...page.headings, ...page.panes.flatMap(pane => pane.headings || []));
        return page;
    });
    const input = new FakeElement();
    const clearButton = new FakeElement();
    const searchToggle = new FakeElement();
    const results = new FakeElement();
    const nav = new FakeElement();
    const body = new FakeElement();
    body.appendChild(results);
    const popup = new FakeElement();
    popup.dataset = {};
    popup.classList.add('fp-tools-popup', 'active');
    popup.querySelector = selector => ({
        '#fptNavSearch': input,
        '#fptNavSearchClear': clearButton,
        '#fptNavSearchToggle': searchToggle,
        '#fptNavSearchResults': results,
        '.fp-tools-nav': nav,
        '.fp-tools-body': body
    })[selector] || null;
    popup.querySelectorAll = selector => {
        if (selector === '.fp-tools-page-content') return pages;
        if (selector === '.fp-tools-nav li[data-page]') return navItems;
        if (selector === '.fp-tools-nav li.fp-nav-divider') return [];
        if (selector === '.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]') return navItems;
        if (selector === '.fpt-nav-group-toggle') return groupToggles;
        if (selector === '.fpt-search-flash') return [];
        return [];
    };
    popup.addEventListener = FakeElement.prototype.addEventListener;
    popup.listeners = Object.create(null);
    const initialSnapshot = { collapsed: true, expandedSections: ['settings'] };
    const navState = {
        restored: [], revealed: [], collapsed: true,
        isNavCollapsed() { return this.collapsed; },
        getNavStateSnapshot() { return { collapsed: this.collapsed, expandedSections: ['settings'] }; },
        restoreNavStateSnapshot(snapshot) { this.restored.push(snapshot); this.collapsed = snapshot.collapsed; },
        setNavCollapsed(collapsed, persist = true) {
            this.collapsed = collapsed;
            if (persist) storageWrites.push({ fpToolsNavCollapsed: collapsed });
        },
        revealAllForSearch(ids) { this.revealed.push([...ids]); },
        refresh() {}
    };
    popup._fptNavSections = navState;

    const context = vm.createContext({
        FPT_NAV_SECTIONS: sections,
        document: {
            createElement() { return new FakeElement(); },
            createDocumentFragment() { const fragment = new FakeElement(); fragment.isFragment = true; return fragment; }
        },
        setTimeout, clearTimeout,
        isPopupPageSearchable(_popup, pageId) { return pageId !== 'global_chat' || globalChatVisible; },
        getPopupNavigationActions() { return navItems; },
        openPopupPage(pageId, options = {}) {
            routeCalls.push([pageId, options.mode]);
            order.push(`route:${pageId}:${options.mode || ''}`);
            return new Promise(resolve => setTimeout(() => {
                const page = pages.find(item => item.dataset.page === pageId);
                const modeAttr = { templates: 'quickRepliesPane', calculator: 'calcPane' }[pageId];
                if (modeAttr) (page.panes || []).forEach(pane => { pane.hidden = pane.dataset[modeAttr] !== options.mode; });
                resolve(true);
            }, 20));
        },
        Array, Set, Map, Object, String, Math, Promise
    });
    for (const heading of allHeadings) heading.scrollOrder = order;
    vm.runInContext(popupSource.slice(searchStart, searchEnd) + '\nglobalThis.__setupNavSearch = setupNavSearch;', context);
    context.__setupNavSearch(popup);
    return {
        context, popup, input, clearButton, searchToggle, results, navItems, pages, groupToggles,
        navState, routeCalls, order, storageWrites, initialSnapshot,
        setGlobalChatVisible(value) { globalChatVisible = value; },
        getIndex() { return popup._fptNavSearch.buildFeatureIndex(); },
        refresh() { popup._fptNavSearch.refreshVisibility(); }
    };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function search(harness, query) {
    harness.input.value = query;
    await harness.input.dispatch('input');
    await wait(120);
    return harness.results.querySelectorAll('.fpt-nav-search-result');
}

function testIndexContractAndAliases() {
    const h = createHarness();
    const index = h.getIndex();
    assert.ok(index.length > 0);
    assert.deepEqual(Object.keys(index[0]).sort(), ['aliases', 'element', 'groupId', 'mode', 'pageId', 'text'],
        'every search item carries the stable group/page/mode/alias/element contract');
    const find = (pageId, mode, alias) => index.find(item => item.pageId === pageId && item.mode === mode && item.aliases.includes(alias));
    assert.ok(index.some(item => item.groupId === 'sales' && item.pageId == null && item.text === 'Лоты и продажи'), 'group headings have group-only entries');
    for (const [pageId, mode, alias] of [
        ['templates', 'commands', 'Слэш-команды'], ['templates', 'templates', 'Шаблоны'], ['calculator', 'currency', 'Валюты'],
        ['theme', null, 'Кастомизация'], ['ai_audit', null, 'ИИ-аудит'], ['tickets', null, 'Тикеты'],
        ['overview', null, 'Функции'], ['overview', null, 'Видео-обзор'], ['lot_io', null, 'Импорт / экспорт'],
        ['settings_io', null, 'Импорт / экспорт']
    ]) assert.ok(find(pageId, mode, alias), `${alias} targets ${pageId}${mode ? `/${mode}` : ''}`);
    assert.ok(index.some(item => item.pageId === 'support' && item.text === 'Оценить расширение'), 'footer rating action is indexed with its human label');
    assert.ok(index.some(item => item.pageId === 'calculator' && item.mode === 'currency' && item.element.textContent === 'Скрытый прогноз валютного рынка'),
        'headings inside hidden route-mode panes are indexed');
}

async function testGroupMatchRevealsWithoutNavigation() {
    const h = createHarness();
    const rows = await search(h, 'Лоты и продажи');
    assert.equal(rows.length, 1, 'the exact group match is a distinct result, not a page match');
    assert.ok(rows[0].classList.contains('fpt-nav-search-result'));
    assert.deepEqual(h.navState.revealed.at(-1), ['sales']);
    for (const item of h.navItems.filter(li => li.dataset.navSection === 'sales')) assert.equal(item.classList.contains('fpt-nav-hidden'), false);
    assert.ok(h.navItems.filter(li => li.dataset.navSection !== 'sales').every(item => item.classList.contains('fpt-nav-hidden')),
        'only children of the matching group are revealed');
    await rows[0].dispatch('click');
    assert.deepEqual(h.routeCalls, [], 'clicking a group result must not navigate to a page');
}

async function testSupportAndQuickActionRoutesStayDistinct() {
    const h = createHarness();
    const supportRows = await search(h, 'Поддержка');
    assert.equal(supportRows.length, 1);
    assert.match(supportRows[0].querySelector('.fpt-nsr-page').textContent, /FunPay/);
    await supportRows[0].dispatch('click');
    assert.deepEqual(h.routeCalls.at(-1), ['tickets', undefined], 'FunPay support search routes to tickets');

    const ratingRows = await search(h, 'оценить расширение');
    assert.ok(ratingRows.length > 0);
    const rating = ratingRows.find(row => row.querySelector('.fpt-nsr-page').textContent === 'Оценить расширение');
    assert.ok(rating, 'rating quick action is separate from the FunPay help page');
    await rating.dispatch('click');
    assert.deepEqual(h.routeCalls.at(-1), ['support', undefined]);

    const importRows = await search(h, 'Импорт / экспорт');
    const labelsFound = new Set(importRows.map(row => row.querySelector('.fpt-nsr-page').textContent));
    assert.ok(labelsFound.has('Управление лотами'));
    assert.ok(labelsFound.has('Перенос настроек'));
}

async function testEveryGroupHeadingRevealsOnlyItsChildren() {
    for (const section of sections) {
        const h = createHarness();
        const rows = await search(h, section.label);
        const groupRows = rows.filter(row => row.querySelector('.fpt-nsr-page').textContent === 'Группа');
        assert.equal(groupRows.length, 1, `${section.label} is represented by a distinct group result`);
        assert.deepEqual(h.navState.revealed.at(-1), [section.id]);
        const visibleGroupPages = h.navItems.filter(item => item.dataset.navSection && !item.classList.contains('fpt-nav-hidden'));
        assert.deepEqual(visibleGroupPages.map(item => item.dataset.page).sort(), [...section.pages].sort(),
            `${section.label} reveals all and only its child pages`);
        await groupRows[0].dispatch('click');
        assert.equal(h.routeCalls.length, 0, `${section.label} search result does not navigate`);
    }
}

async function testLegacyAliasesActivateCanonicalPageAndMode() {
    const cases = [
        ['Слэш-команды', 'templates', 'commands'], ['Шаблоны', 'templates', 'templates'],
        ['Валюты', 'calculator', 'currency'], ['Кастомизация', 'theme', undefined],
        ['ИИ-аудит', 'ai_audit', undefined], ['Тикеты', 'tickets', undefined],
        ['Функции', 'overview', undefined], ['Видео-обзор', 'overview', undefined]
    ];
    for (const [query, pageId, mode] of cases) {
        const h = createHarness();
        const rows = await search(h, query);
        assert.ok(rows.length > 0, `legacy name ${query} has a search result`);
        if (mode) {
            assert.equal(rows.filter(row => row.querySelector('.fpt-nsr-text').textContent === query).length, 1,
                `${query} appears as one explicit mode alias result`);
        }
        assert.ok(rows.every(row => row.querySelector('.fpt-nsr-page').textContent === labels[pageId]),
            `${query} results stay on the same canonical page`);
        await rows[0].dispatch('click');
        await wait(60);
        assert.deepEqual(h.routeCalls.at(-1), [pageId, mode], `${query} routes to its canonical page/mode`);
    }
}

async function testHiddenModeRoutesBeforeScrollingExactElement() {
    const h = createHarness();
    const rows = await search(h, 'Скрытый прогноз валютного рынка');
    assert.equal(rows.length, 1);
    await rows[0].dispatch('click');
    await wait(180);
    const target = h.pages.find(page => page.dataset.page === 'calculator').panes[0].headings[0];
    assert.deepEqual(h.routeCalls.at(-1), ['calculator', 'currency']);
    assert.equal(target.hidden, false, 'the hidden pane is active before its result is scrolled');
    assert.equal(target.scrolled, true, 'the exact matched element is scrolled');
    assert.ok(h.order.indexOf('route:calculator:currency') < h.order.indexOf(`scroll:${target.textContent}`),
        'routing completes before the matched content scrolls');
}

async function testLateGlobalChatHideInvalidatesCurrentAndBuiltResults() {
    const h = createHarness();
    assert.equal((await search(h, 'Секретная функция сообщества')).length, 1);
    assert.ok(h.getIndex().some(item => item.pageId === 'global_chat'));
    h.setGlobalChatVisible(false);
    h.navItems.find(item => item.dataset.page === 'global_chat').style.display = 'none';
    h.refresh();
    assert.equal(h.results.querySelectorAll('.fpt-nav-search-result').length, 0, 'stale rows are invalidated immediately');
    assert.equal(h.getIndex().some(item => item.pageId === 'global_chat'), false, 'both menu and inner page records are excluded after remote hide');
}

async function testClearRestoresCompactNavWithoutPreferenceWrites() {
    const h = createHarness();
    await h.searchToggle.dispatch('click');
    await search(h, 'Лоты и продажи');
    await h.clearButton.dispatch('click');
    assert.deepEqual(h.navState.restored, [h.initialSnapshot]);
    assert.equal(h.navState.collapsed, true);
    assert.deepEqual(h.storageWrites, [], 'search expand/clear does not write saved navigation preferences');
}

async function testImmediateClearCancelsPendingSearchRender() {
    const h = createHarness();
    h.input.value = 'Лоты и продажи';
    await h.input.dispatch('input');
    await h.clearButton.dispatch('click');
    await wait(125);
    assert.equal(h.input.value, '');
    assert.equal(h.navState.restored.length, 1);
    assert.equal(h.results.querySelectorAll('.fpt-nav-search-result').length, 0,
        'a pending debounced query must not repopulate results after clearing');
}

async function testEnterIgnoresRowsFromPreviousQuery() {
    const h = createHarness();
    assert.equal((await search(h, 'Аудит магазина')).length, 1);
    h.input.value = 'ничего не найдено';
    await h.input.dispatch('input');
    await h.input.dispatch('keydown', { key: 'Enter' });
    assert.deepEqual(h.routeCalls, [], 'Enter cannot activate a row rendered for the previous query');
}

async function testEnterIgnoresRowsAfterClearDuringFade() {
    const h = createHarness();
    assert.equal((await search(h, 'Аудит магазина')).length, 1);
    await h.clearButton.dispatch('click');
    await h.input.dispatch('keydown', { key: 'Enter' });
    assert.deepEqual(h.routeCalls, [], 'Enter cannot activate a row left in the results DOM after Clear');
}

async function run() {
    testIndexContractAndAliases();
    await testGroupMatchRevealsWithoutNavigation();
    await testEveryGroupHeadingRevealsOnlyItsChildren();
    await testSupportAndQuickActionRoutesStayDistinct();
    await testLegacyAliasesActivateCanonicalPageAndMode();
    await testHiddenModeRoutesBeforeScrollingExactElement();
    await testLateGlobalChatHideInvalidatesCurrentAndBuiltResults();
    await testClearRestoresCompactNavWithoutPreferenceWrites();
    await testImmediateClearCancelsPendingSearchRender();
    await testEnterIgnoresRowsAfterClearDuringFade();
    await testEnterIgnoresRowsFromPreviousQuery();
    console.log('NAVIGATION_SEARCH_ROUTES_PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
