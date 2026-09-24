const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const mainPopupSource = fs.readFileSync(path.join(repoRoot, 'content/ui/main_popup.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(repoRoot, 'content/features/templates.js'), 'utf8');
const slashSource = fs.readFileSync(path.join(repoRoot, 'content/features/slash_telegram_ui.js'), 'utf8');

class FakeElement {
    constructor(dataset = {}) {
        this.dataset = { ...dataset };
        this.attributes = Object.create(null);
        this.style = {};
        this.children = [];
        this.listeners = Object.create(null);
        this.hidden = false;
        this.tabIndex = 0;
        this.classList = {
            values: new Set(),
            add: name => this.classList.values.add(name),
            contains: name => this.classList.values.has(name),
            toggle: (name, force) => {
                const shouldAdd = force === undefined ? !this.classList.values.has(name) : !!force;
                if (shouldAdd) this.classList.values.add(name);
                else this.classList.values.delete(name);
                return shouldAdd;
            }
        };
    }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') this.id = String(value);
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    querySelectorAll(selector) {
        if (selector === '[data-quick-replies-mode]') return this.tabs || [];
        if (selector === '[data-quick-replies-pane]') return this.panes || [];
        return [];
    }
    querySelector(selector) {
        if (selector === '.fp-tools-page-content[data-page="templates"]') return this.pages?.find(page => page.dataset.page === 'templates') || null;
        return null;
    }
    focus() { this.focused = true; }
    async dispatch(type, event = {}) {
        for (const listener of this.listeners[type] || []) {
            await listener({ preventDefault() {}, stopPropagation() {}, target: this, ...event });
        }
    }
}

function createHarness(storageSeed = {}) {
    const storage = { ...storageSeed };
    const templates = new FakeElement({ page: 'templates' });
    const lotIo = new FakeElement({ page: 'lot_io' });
    const pages = [templates, lotIo];
    const tabs = ['templates', 'commands'].map(mode => {
        const tab = new FakeElement({ quickRepliesMode: mode });
        tab.setAttribute('id', `fptQuickReplies${mode === 'templates' ? 'Templates' : 'Commands'}Tab`);
        return tab;
    });
    const panes = ['templates', 'commands'].map(mode => {
        const pane = new FakeElement({ quickRepliesPane: mode });
        pane.setAttribute('id', `fptQuickReplies${mode === 'templates' ? 'Templates' : 'Commands'}Pane`);
        return pane;
    });
    templates.tabs = tabs;
    templates.panes = panes;
    const navItems = [templates, lotIo].map(page => new FakeElement({ page: page.dataset.page }));
    const popup = new FakeElement();
    popup.classList.add('fp-tools-popup');
    popup.dataset = {};
    popup.querySelectorAll = selector => {
        if (selector === '.fp-tools-page-content') return pages;
        if (selector === '.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]') return navItems;
        return [];
    };
    popup.querySelector = selector => selector.includes('data-page="templates"') ? templates : null;

    const document = {
        querySelector: selector => selector === '.fp-tools-popup' ? popup : null,
        getElementById: () => null
    };
    const chrome = {
        storage: {
            local: {
                async get(keys) {
                    if (typeof keys === 'string') return Object.hasOwn(storage, keys) ? { [keys]: storage[keys] } : {};
                    if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => Object.hasOwn(storage, key)).map(key => [key, storage[key]]));
                    return { ...storage };
                },
                async set(values) { Object.assign(storage, values); }
            }
        }
    };
    const window = { addEventListener() {} };
    const context = vm.createContext({
        window, document, chrome,
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: callback => setTimeout(callback, 0),
        Object, Array, Set, Map, Math, String, Number, Boolean, RegExp, Error, Promise
    });
    vm.runInContext(mainPopupSource, context, { filename: 'content/ui/main_popup.js' });
    return { context, window, popup, pages, tabs, panes, navItems, storage };
}

async function run() {
    const settingsLoaderSource = fs.readFileSync(path.join(repoRoot, 'content/ui/settings_loader.js'), 'utf8');
    const h = createHarness({
        fpToolsTemplateSettings: { standard: { greeting: { text: 'Здравствуйте' } } },
        fpToolsSlashCommands: { commands: [{ trigger: '/привет', response: 'Привет' }] }
    });
    assert.equal(typeof h.context.setupQuickRepliesUI, 'function', 'quick replies tabs register with the central popup router');
    h.context.setupQuickRepliesUI(h.popup);

    assert.match(mainPopupSource, /data-quick-replies-mode="templates"/);
    assert.match(mainPopupSource, /data-quick-replies-mode="commands"/);
    assert.match(mainPopupSource, /role="tablist"/);
    assert.match(mainPopupSource, /data-quick-replies-pane="templates"/);
    assert.match(mainPopupSource, /data-quick-replies-pane="commands"/);
    assert.doesNotMatch(mainPopupSource, /<li data-page="slash_commands"/);
    assert.doesNotMatch(mainPopupSource, /<div class="fp-tools-page-content" data-page="slash_commands"/);
    assert.match(templateSource, /fptOpenPopupPage\('templates',\s*\{\s*mode:\s*'templates'/, 'chat template settings link opens the template mode explicitly');
    assert.match(templateSource, /fpToolsTemplateSettings/);
    assert.match(slashSource, /fpToolsSlashCommands/);
    assert.match(settingsLoaderSource, /data-quick-replies-pane="templates"/);

    let templateInitCount = 0;
    let slashInitCount = 0;
    h.window.setupTemplateSettingsHandlers = () => { templateInitCount += 1; };
    h.window.initializeSlashCommandsUI = () => { slashInitCount += 1; };

    assert.equal(h.tabs[0].getAttribute('role'), 'tab');
    assert.equal(h.tabs[0].getAttribute('aria-controls'), h.panes[0].getAttribute('id'));
    assert.equal(h.panes[0].getAttribute('aria-labelledby'), h.tabs[0].getAttribute('id'));
    assert.equal(h.tabs[1].getAttribute('aria-controls'), h.panes[1].getAttribute('id'));
    assert.equal(h.tabs[0].getAttribute('aria-selected'), 'true');
    assert.equal(h.panes[0].hidden, false);
    assert.equal(h.panes[1].hidden, true);

    await h.window.fptOpenPopupPage('slash_commands');
    assert.equal(h.storage.fpToolsLastPage, 'templates', 'legacy slash route persists the canonical page');
    assert.equal(h.storage.fpToolsPageModes.templates, 'commands');
    assert.equal(h.storage.fpToolsTemplateSettings.standard.greeting.text, 'Здравствуйте');
    assert.equal(h.storage.fpToolsSlashCommands.commands[0].trigger, '/привет');
    assert.equal(templateInitCount, 1);
    assert.equal(slashInitCount, 1);
    await h.window.fptOpenPopupPage('templates', { mode: 'templates' });
    assert.equal(templateInitCount, 1, 'switching modes does not reinitialize template controls');
    assert.equal(slashInitCount, 1, 'switching modes does not bind command controls again');
    await h.window.fptOpenPopupPage('slash_commands');

    await h.window.fptOpenPopupPage('lot_io');
    await h.window.fptOpenPopupPage('templates');
    assert.equal(h.tabs[1].getAttribute('aria-selected'), 'true', 'the command mode returns after visiting another page');
    assert.equal(h.panes[1].hidden, false);
    assert.equal(h.panes[0].hidden, true);

    await h.tabs[1].dispatch('keydown', { key: 'Home' });
    assert.equal(h.tabs[0].getAttribute('aria-selected'), 'true');
    assert.equal(h.tabs[0].focused, true);
    await h.tabs[0].dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(h.tabs[1].getAttribute('aria-selected'), 'true', 'ArrowLeft wraps between the two tabs');
    await h.tabs[1].dispatch('keydown', { key: 'End' });
    assert.equal(h.tabs[1].getAttribute('aria-selected'), 'true');
    await h.tabs[1].dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(h.tabs[0].getAttribute('aria-selected'), 'true', 'ArrowRight wraps between the two tabs');
    await h.popup._fptNavigationWriteQueue;
    assert.equal(h.storage.fpToolsLastPageMode, 'templates');
    assert.equal(h.storage.fpToolsPageModes.templates, 'templates');

    const commandClickListeners = h.tabs[1].listeners.click?.length || 0;
    h.context.setupQuickRepliesUI(h.popup);
    assert.equal(h.tabs[1].listeners.click?.length || 0, commandClickListeners, 'reinitialization does not bind tab handlers twice');

    const fresh = createHarness();
    fresh.context.setupQuickRepliesUI(fresh.popup);
    await fresh.window.fptOpenPopupPage('templates');
    assert.equal(fresh.tabs[0].getAttribute('aria-selected'), 'true', 'a first visit opens the template pane');
    assert.equal(fresh.storage.fpToolsLastPageMode, 'templates');
}

run().then(() => console.log('quick_replies_navigation: passed')).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
