const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'filters.js'), 'utf8').replace(/\r\n/g, '\n');

const financeStart = popup.indexOf('<div class="fp-tools-page-content" data-page="finance_hub">');
const paneStart = popup.indexOf('<!-- Subtab: Обзор -->', financeStart);
assert.ok(financeStart >= 0 && paneStart > financeStart, 'Finance filter markup must be present before the panes');
const filterMarkup = popup.slice(financeStart, paneStart);

const controls = [
    ['period', 'fptFinPeriodSelect', 'Период'],
    ['currency', 'fptFinCurrencySelect', 'Валюта'],
    ['status', 'fptFinStatusSelect', 'Статус заказа'],
    ['category', 'fptFinCategorySelect', 'Категория']
];

for (const [control, id, label] of controls) {
    const wrapper = filterMarkup.match(new RegExp(`<div[^>]*data-fin-control="${control}"[^>]*>([\\s\\S]*?)<\\/div>`));
    assert.ok(wrapper, `${control} filter wrapper must be mounted statically`);
    assert.match(wrapper[1], new RegExp(`<label[^>]*for="${id}"[^>]*>${label}<\\/label>`), `${control} filter must have a visible label`);
    assert.match(wrapper[1], new RegExp(`<select[^>]*id="${id}"`), `${id} must be mounted inside its wrapper`);
    assert.equal((filterMarkup.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} must not be duplicated`);
}

const statusOptions = hub.match(/function updateStatusSelectOptions\(subtab\)[\s\S]*?\n\s*}\n\s*\n\s*function setupHeaderFilters/);
assert.ok(statusOptions, 'status options updater must exist');
assert.match(statusOptions[0], /fptFinStatusLabel/, 'status updater must find the visible status label');
assert.match(statusOptions[0], /Статус заказа/, 'order context must be shown in the visible status label');
assert.match(statusOptions[0], /Статус операции/, 'operation context must be shown in the visible status label');

const visibilityStart = hub.indexOf('function updateHeaderFiltersVisibility(subtab)');
const visibilityEnd = hub.indexOf('\n        return {', visibilityStart);
assert.ok(visibilityStart >= 0 && visibilityEnd > visibilityStart, 'filter visibility updater must exist');
const visibility = hub.slice(visibilityStart, visibilityEnd);
assert.match(visibility, /periodControl/);
assert.match(visibility, /currencyControl/);
assert.match(visibility, /statusControl/);
assert.match(visibility, /categoryControl/);
assert.match(visibility, /setFinanceControlVisible\(statusControl,\s*!isPotential\)/, 'Potential must hide the entire status wrapper');
assert.match(visibility, /setFinanceControlVisible\(categoryControl,\s*subtab\s*!==\s*'operations'\)/, 'Operations must hide the entire category wrapper');

function makeNode() {
    const attributes = {};
    const classes = new Set();
    return {
        disabled: false,
        hidden: false,
        textContent: '',
        scrollHeight: 0,
        clientHeight: 0,
        style: { removeProperty() {} },
        attributes,
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); },
            toggle(name, force) {
                const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
                if (shouldAdd) classes.add(name);
                else classes.delete(name);
                return shouldAdd;
            }
        },
        setAttribute(name, value) { attributes[name] = String(value); },
        getAttribute(name) { return attributes[name] ?? null; },
        querySelectorAll() { return []; }
    };
}

function testCustomStatusTriggerTracksTheOperationsLabel() {
    const sandbox = { setTimeout(callback) { callback(); return 0; } };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(hub, sandbox, { filename: 'finance_hub/filters.js' });

    const trigger = makeNode();
    trigger.setAttribute('aria-label', 'Статус заказов');
    const label = makeNode();
    const dropdown = makeNode();
    const list = makeNode();
    const scrollbar = makeNode();
    const thumb = makeNode();
    const shell = makeNode();
    shell.classList.add('fpt-fin-select-shell');
    shell.querySelector = selector => ({
        '.fpt-fin-select-trigger': trigger,
        '.fpt-fin-select-label': label,
        '.fpt-fin-select-dropdown': dropdown,
        '.fpt-fin-select-list': list,
        '.fpt-fin-select-scrollbar': scrollbar,
        '.fpt-fin-select-scrollbar-thumb': thumb
    })[selector] || null;
    const select = makeNode();
    select.parentElement = shell;
    select.setAttribute('aria-label', 'Статус операций');
    select.value = 'all';
    select.selectedIndex = 0;
    select.options = [{ value: 'all', textContent: 'Все статусы' }];
    const filterApi = sandbox.FPTFinanceHubModules.createFilters({ state: {} });

    filterApi.syncFinanceCustomSelect(select, false);

    assert.equal(trigger.getAttribute('aria-label'), 'Статус операций', 'focusable custom trigger must reflect the current native-select accessible name');
}

testCustomStatusTriggerTracksTheOperationsLabel();

console.log('T18_LABELED_CONTEXTUAL_FILTERS_PASS');
