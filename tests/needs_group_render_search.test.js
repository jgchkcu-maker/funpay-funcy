const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const GROUP_ORDER = [
    'Верхняя панель',
    'Чат',
    'Создание и оформление лота',
    'Копирование и импорт лотов',
    'Цены и аналитика',
    'Список лотов и профиль'
];
const CHAT_SUBGROUP_IDS = {
    'Поле ввода': ['chat_custom_attach', 'chat_ai_rewrite_btn', 'chat_reply', 'chat_char_counter', 'profanity_warning'],
    'Шапка диалога': ['chat_read_all_btn', 'chat_filter_marked_btn'],
    'Действия в диалоге': ['chat_menu_buyer_history', 'chat_menu_translate', 'chat_menu_export', 'chat_menu_blacklist']
};

function loadRegistry() {
    const source = fs.readFileSync(path.join(ROOT, 'content/features/feature_registry.js'), 'utf8');
    const data = vm.runInNewContext(
        `${source}\n({ registry: FPT_FEATURE_REGISTRY, groupOrder: FPT_NEEDS_GROUP_ORDER, subgroupOrder: FPT_NEEDS_CHAT_SUBGROUP_ORDER, legacyPageLabels: FPT_NEEDS_LEGACY_PAGE_LABELS })`,
        { window: {} }
    );
    return JSON.parse(JSON.stringify(data));
}

function createHarness({ filter = '', disabled = [], registry, withPage = false } = {}) {
    const list = { innerHTML: '', querySelectorAll: () => [] };
    const handlers = {};
    const writes = [];
    let storedDisabled = [...disabled];
    const page = {
        addEventListener(type, handler) { handlers[type] = handler; },
        querySelector() { return null; }
    };
    const input = {
        value: filter,
        addEventListener(type, handler) { handlers[`filter:${type}`] = handler; }
    };
    const askButton = { disabled: false, classList: { add() {}, remove() {} }, addEventListener() {} };
    const resultBox = {
        style: {},
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null
    };
    const document = {
        getElementById(id) {
            return ({
                fptNeedsList: list,
                fptNeedsFilter: input,
                fptNeedsAskBtn: askButton,
                fptNeedsAiResult: resultBox
            })[id] || null;
        },
        querySelector(selector) {
            return withPage && selector === '.fp-tools-page-content[data-page="needs"]' ? page : null;
        },
        querySelectorAll: () => []
    };
    const storage = {
        async get() { return { fpToolsDisabledFeatures: [...storedDisabled] }; },
        async set(values) {
            writes.push(values);
            storedDisabled = [...values.fpToolsDisabledFeatures];
        }
    };
    const context = vm.createContext({
        FPT_FEATURE_REGISTRY: registry || loadRegistry().registry,
        FPT_NEEDS_GROUP_ORDER: loadRegistry().groupOrder,
        FPT_NEEDS_CHAT_SUBGROUP_ORDER: loadRegistry().subgroupOrder,
        FPT_NEEDS_LEGACY_PAGE_LABELS: loadRegistry().legacyPageLabels,
        document,
        chrome: {
            storage: { local: storage },
            runtime: {
                getURL: path => `chrome-extension://test/${path}`,
                sendMessage: async () => ({ success: true, data: '[]' })
            }
        },
        CSS: { escape: value => value },
        window: { fptApplyDisabledFeatures: async () => {} },
        console,
        setTimeout,
        clearTimeout
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content/features/needs_tab.js'), 'utf8'), context);
    return { context, list, page, handlers, document, input, askButton, resultBox, writes, getStoredDisabled: () => storedDisabled };
}

function idsInItemRows(html) {
    return [...html.matchAll(/class="fpt-needs-item[^\"]*" data-id="([^\"]+)"/g)].map((match) => match[1]);
}

async function render(filter = '', options = {}) {
    const harness = createHarness({ ...options, filter });
    harness.context.filterText = filter;
    await vm.runInContext('fptRenderNeedsList(filterText)', harness.context);
    return { ...harness, html: harness.list.innerHTML };
}

test('renders six groups and three chat subgroups in taxonomy order with every original control and preview', async () => {
    const { registry, subgroupOrder } = loadRegistry();
    const { html } = await render('', { registry: [...registry].reverse() });

    const renderedGroups = [...html.matchAll(/<section class="fpt-needs-group" data-group="([^\"]+)">/g)]
        .map((match) => match[1]);
    assert.deepEqual(renderedGroups, GROUP_ORDER);

    const renderedSubgroups = [...html.matchAll(/<section class="fpt-needs-subgroup" data-subgroup="([^\"]+)">([\s\S]*?)<\/section>/g)];
    assert.deepEqual(renderedSubgroups.map((match) => match[1]), subgroupOrder);
    for (const [subgroup, expectedIds] of Object.entries(CHAT_SUBGROUP_IDS)) {
        const block = renderedSubgroups.find((match) => match[1] === subgroup)?.[2] || '';
        assert.deepEqual(idsInItemRows(block).sort(), [...expectedIds].sort(), `${subgroup} contains its assigned entries`);
    }

    assert.equal(idsInItemRows(html).length, 36);
    for (const entry of registry) {
        assert.match(html, new RegExp(`class="fpt-needs-item[^\"]*" data-id="${entry.id}"`));
        assert.match(html, new RegExp(`class="fpt-needs-cb" data-id="${entry.id}" checked`));
        assert.match(html, new RegExp(`class="fpt-needs-preview-btn" data-id="${entry.id}"`));
        assert.match(html, new RegExp(`class="fpt-needs-preview-row" data-id="${entry.id}"`));
    }
    assert.equal((html.match(/class="fpt-pv-stage/g) || []).length, 36, 'each entry renders its preview stage');
    assert.match(html, /<div class="fpt-needs-entry-branch" data-parent-id="lot_font_controls">[\s\S]*?<div class="fpt-needs-child-items" data-parent-id="lot_font_controls">[\s\S]*?class="fpt-needs-item[^\"]*" data-id="lot_keyboard_btn"/);
});

test('local search covers groups, subgroups, legacy labels and descriptions while omitting empty headings', async () => {
    const byGroup = await render('Копирование и импорт лотов');
    assert.deepEqual(idsInItemRows(byGroup.html).sort(), [
        'lot_paste_bar', 'lot_clone_btn', 'lot_import_btn', 'lot_public_clone_btn', 'multi_clone_foreign'
    ].sort());
    assert.equal((byGroup.html.match(/class="fpt-needs-group-title"/g) || []).length, 1);

    const bySubgroup = await render('Шапка диалога');
    assert.deepEqual(idsInItemRows(bySubgroup.html).sort(), ['chat_read_all_btn', 'chat_filter_marked_btn'].sort());
    assert.match(bySubgroup.html, /<h5[^>]*class="fpt-needs-subgroup-title"[^>]*>Шапка диалога<\/h5>/);
    assert.equal((bySubgroup.html.match(/class="fpt-needs-subgroup-title"/g) || []).length, 1);

    const byOldFeatureName = await render('Шрифты и спецсимволы в лоте');
    assert.deepEqual(idsInItemRows(byOldFeatureName.html), ['lot_font_controls']);

    const byOldPageName = await render('Функции');
    assert.equal(idsInItemRows(byOldPageName.html).length, 36, 'the former page label remains a local search alias');

    const noResults = await render('несуществующий элемент');
    assert.match(noResults.html, /Ничего не найдено/);
    assert.equal(idsInItemRows(noResults.html).length, 0);
    assert.equal((noResults.html.match(/fpt-needs-(?:group|subgroup)-title/g) || []).length, 0);
});

test('keyboard-only search shows a disabled parent context row and preserves stored checkbox values', async () => {
    const harness = await render('Кнопка „Клавиатура“', { disabled: ['lot_font_controls'] });
    const { html } = harness;
    assert.match(html, /class="fpt-needs-item[^\"]*fpt-needs-context[^\"]*" data-id="lot_font_controls"/);
    assert.match(html, /class="fpt-needs-cb" data-id="lot_font_controls"\s+disabled/);
    assert.match(html, /class="fpt-needs-item[^\"]*" data-id="lot_keyboard_btn"/);
    assert.match(html, /class="fpt-needs-cb" data-id="lot_keyboard_btn" checked/);
    assert.doesNotMatch(html, /class="fpt-needs-cb" data-id="lot_font_controls"\s+checked/);
    assert.match(html, /class="fpt-needs-dependent-note"[^>]*>Включите блок шрифта и спецсимволов/);
    assert.equal(idsInItemRows(html).length, 2, 'the parent is context and the child is the only search match');
    assert.equal(harness.writes.length, 0, 'filtering does not write either checkbox value');
});

test('reopening restores only the stored disabled IDs from all six groups', async () => {
    const disabledIds = [
        'rmthub_seller_search',
        'lot_font_controls',
        'lot_keyboard_btn',
        'lot_clone_btn',
        'market_analytics_btn',
        'notes_add_status_btn'
    ];
    const { html } = await render('', { disabled: disabledIds });
    const states = [...html.matchAll(/<input type="checkbox" class="fpt-needs-cb" data-id="([^"]+)"([^>]*)>/g)];
    const renderedDisabledIds = states.filter(([, , attributes]) => !/\bchecked\b/.test(attributes))
        .map(([, id]) => id)
        .sort();

    assert.equal(states.length, 37);
    assert.deepEqual(renderedDisabledIds, [...disabledIds].sort());
});

test('search can be cleared and restores the complete catalog without changing storage', async () => {
    const harness = createHarness({ withPage: true });
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    harness.input.value = 'Копирование и импорт лотов';
    await harness.handlers['filter:input']();
    assert.equal(idsInItemRows(harness.list.innerHTML).length, 5);

    harness.input.value = '';
    await harness.handlers['filter:input']();
    assert.equal(idsInItemRows(harness.list.innerHTML).length, 36);
    assert.equal((harness.list.innerHTML.match(/class="fpt-needs-group-title"/g) || []).length, 6);
    assert.equal(harness.writes.length, 0);
});

function makeClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        contains(value) { return values.has(value); },
        toggle(value, force) {
            const next = force === undefined ? !values.has(value) : !!force;
            if (next) values.add(value);
            else values.delete(value);
            return next;
        }
    };
}

function createInteractiveHarness({ aiDisableParent = false, aiPickId = null, visibleIds = null, initialDisabled = [] } = {}) {
    const checkboxes = [
        { dataset: { id: 'lot_font_controls' }, checked: true, classList: makeClassList(['fpt-needs-cb']) },
        { dataset: { id: 'lot_keyboard_btn' }, checked: true, classList: makeClassList(['fpt-needs-cb']) }
    ];
    const visibleCheckboxes = visibleIds
        ? checkboxes.filter(checkbox => visibleIds.includes(checkbox.dataset.id))
        : checkboxes;
    const note = { hidden: true };
    const rows = checkboxes.map((checkbox, index) => ({
        dataset: checkbox.dataset,
        classList: makeClassList(),
        attrs: {},
        setAttribute(name, value) { this.attrs[name] = value; },
        querySelector(selector) {
            if (selector === '.fpt-needs-cb') return checkbox;
            return index === 1 && selector === '.fpt-needs-dependent-note' ? note : null;
        }
    }));
    const list = {
        innerHTML: '',
        querySelectorAll(selector) {
            if (selector === '.fpt-needs-cb') return visibleCheckboxes;
            if (selector === '.fpt-needs-item') return rows.filter(row => visibleIds ? visibleIds.includes(row.dataset.id) : true);
            return [];
        }
    };
    const handlers = {};
    const writes = [];
    let storedDisabled = [...initialDisabled];
    const page = { addEventListener(type, handler) { handlers[type] = handler; } };
    const filter = { value: '', addEventListener() {} };
    const askButton = { disabled: false, classList: makeClassList(), addEventListener() {} };
    const aiPick = { dataset: { id: aiPickId || (aiDisableParent ? 'lot_font_controls' : 'lot_keyboard_btn') }, checked: true };
    const confirmButton = { textContent: 'Отключить выбранное' };
    const resultBox = {
        style: {},
        innerHTML: '',
        querySelectorAll(selector) { return selector === '.fpt-needs-ai-pick' ? [aiPick] : []; },
        querySelector(selector) { return selector === '#fptNeedsAiConfirm' ? confirmButton : null; }
    };
    const document = {
        getElementById(id) {
            return ({ fptNeedsList: list, fptNeedsFilter: filter, fptNeedsAskBtn: askButton, fptNeedsAiResult: resultBox })[id] || null;
        },
        querySelector(selector) {
            return selector === '.fp-tools-page-content[data-page="needs"]' ? page : null;
        },
        querySelectorAll(selector) { return selector === '.fpt-needs-cb' ? visibleCheckboxes : []; }
    };
    const chrome = {
        storage: {
            local: {
                async get() { return { fpToolsDisabledFeatures: [...storedDisabled] }; },
                async set(values) {
                    writes.push(values);
                    storedDisabled = [...values.fpToolsDisabledFeatures];
                }
            }
        },
        runtime: { sendMessage: async () => ({ success: true, data: '[]' }) }
    };
    const context = vm.createContext({
        FPT_FEATURE_REGISTRY: loadRegistry().registry,
        FPT_NEEDS_GROUP_ORDER: loadRegistry().groupOrder,
        FPT_NEEDS_CHAT_SUBGROUP_ORDER: loadRegistry().subgroupOrder,
        FPT_NEEDS_LEGACY_PAGE_LABELS: loadRegistry().legacyPageLabels,
        document,
        chrome,
        window: { fptApplyDisabledFeatures: async () => {} },
        console,
        setTimeout,
        clearTimeout
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content/features/needs_tab.js'), 'utf8'), context);
    return { context, handlers, checkboxes, rows, note, writes, resultBox, aiPick, confirmButton, getStoredDisabled: () => storedDisabled };
}

test('parent toggle dims keyboard immediately without changing the child checkbox or its saved ID', async () => {
    const harness = createInteractiveHarness();
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    harness.checkboxes[0].checked = false;
    await harness.handlers.change({ target: harness.checkboxes[0] });

    assert.equal(harness.checkboxes[1].checked, true);
    assert.equal(harness.rows[1].classList.contains('fpt-needs-dependent-disabled'), true);
    assert.equal(harness.note.hidden, false);
    assert.deepEqual(harness.getStoredDisabled(), ['lot_font_controls']);

    harness.checkboxes[0].checked = true;
    await harness.handlers.change({ target: harness.checkboxes[0] });
    assert.equal(harness.rows[1].classList.contains('fpt-needs-dependent-disabled'), false);
    assert.equal(harness.note.hidden, true);
    assert.deepEqual(harness.getStoredDisabled(), []);
});

test('confirmed AI action recomputes the keyboard dependency using the stable feature ID', async () => {
    const harness = createInteractiveHarness({ aiDisableParent: true });
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    await harness.handlers.click({ target: { closest: (selector) => selector === '#fptNeedsAiConfirm' } });

    assert.equal(harness.checkboxes[0].checked, false);
    assert.equal(harness.checkboxes[1].checked, true);
    assert.equal(harness.rows[1].classList.contains('fpt-needs-dependent-disabled'), true);
    assert.equal(harness.note.hidden, false);
    assert.deepEqual(harness.getStoredDisabled(), ['lot_font_controls']);
});

test('confirmed AI action saves a selected feature even when search hides its checkbox', async () => {
    const harness = createInteractiveHarness({
        aiPickId: 'lot_keyboard_btn',
        visibleIds: ['lot_font_controls'],
        initialDisabled: ['lot_public_clone_btn']
    });
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    await harness.handlers.click({ target: { closest: (selector) => selector === '#fptNeedsAiConfirm' } });

    assert.equal(harness.checkboxes[0].checked, true, 'the visible, unselected parent keeps its saved state');
    assert.equal(harness.checkboxes[1].checked, true, 'the filtered-out keyboard checkbox is not changed in the DOM');
    assert.deepEqual(harness.getStoredDisabled(), ['lot_public_clone_btn', 'lot_keyboard_btn']);
});

test('AI applies a returned feature by its stable ID', async () => {
    const harness = createHarness({ withPage: true });
    const pick = { dataset: { id: 'lot_keyboard_btn' }, checked: true };
    const confirmButton = { textContent: 'Отключить выбранное' };
    const originalGetElementById = harness.document.getElementById.bind(harness.document);
    harness.document.getElementById = id => id === 'fptNeedsInput'
        ? { value: 'убрать кнопку клавиатуры' }
        : originalGetElementById(id);
    harness.resultBox.querySelectorAll = selector => selector === '.fpt-needs-ai-pick' ? [pick] : [];
    harness.resultBox.querySelector = selector => selector === '#fptNeedsAiConfirm' ? confirmButton : null;
    harness.context.chrome.runtime.sendMessage = async () => ({
        success: true,
        data: JSON.stringify([{ id: 'lot_keyboard_btn', confidence: 0.94, reason: 'Найдена кнопка клавиатуры' }])
    });
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    await vm.runInContext('fptNeedsAskAI()', harness.context);
    assert.match(harness.resultBox.innerHTML, /data-id="lot_keyboard_btn" checked/);
    assert.match(harness.resultBox.innerHTML, /Кнопка „Клавиатура“/);

    await harness.handlers.click({ target: { closest: selector => selector === '#fptNeedsAiConfirm' ? confirmButton : null } });
    assert.deepEqual(harness.getStoredDisabled(), ['lot_keyboard_btn']);
});

test('preview toggle opens the nested row and resolves the image preview asset', async () => {
    const harness = createHarness({ withPage: true });
    const previewButton = { dataset: { id: 'chat_ai_rewrite_btn' }, classList: makeClassList() };
    const previewRow = { style: { display: 'none' } };
    harness.page.querySelector = selector => selector === '.fpt-needs-preview-row[data-id="chat_ai_rewrite_btn"]'
        ? previewRow
        : null;
    vm.runInContext('initializeNeedsTab()', harness.context);
    await new Promise((resolve) => setImmediate(resolve));

    assert.match(harness.list.innerHTML, /chrome-extension:\/\/test\/icons\/magic\.png/);
    await harness.handlers.click({
        target: { closest: selector => selector === '.fpt-needs-preview-btn' ? previewButton : null },
        preventDefault() {}
    });

    assert.equal(previewRow.style.display, 'flex');
    assert.equal(previewButton.classList.contains('fpt-needs-preview-open'), true);
});

test('AI still receives only the established ID, label and description payload', async () => {
    const harness = createHarness();
    let sentMessage;
    harness.context.document.getElementById = (id) => {
        if (id === 'fptNeedsInput') return { value: 'клавиатура' };
        if (id === 'fptNeedsList') return harness.list;
        if (id === 'fptNeedsAskBtn') return harness.askButton;
        if (id === 'fptNeedsAiResult') return harness.resultBox;
        return null;
    };
    harness.context.chrome.runtime.sendMessage = async (message) => {
        sentMessage = message;
        return { success: true, data: '[]' };
    };

    await vm.runInContext('fptNeedsAskAI()', harness.context);

    const payload = JSON.parse(sentMessage.context);
    assert.equal(payload.length, 37);
    for (const entry of payload) assert.deepEqual(Object.keys(entry).sort(), ['desc', 'id', 'label']);
});
