const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const popupSource = fs.readFileSync(path.join(ROOT, 'content/ui/main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const miscSource = fs.readFileSync(path.join(ROOT, 'content/features/misc.js'), 'utf8').replace(/\r\n/g, '\n');
const currencySource = fs.readFileSync(path.join(ROOT, 'content/features/currency_calculator.js'), 'utf8').replace(/\r\n/g, '\n');
const telegramSource = fs.readFileSync(path.join(ROOT, 'content/features/slash_telegram_ui.js'), 'utf8').replace(/\r\n/g, '\n');
const loaderSource = fs.readFileSync(path.join(ROOT, 'content/ui/settings_loader.js'), 'utf8').replace(/\r\n/g, '\n');
const enhancementsSource = fs.readFileSync(path.join(ROOT, 'content/features/ui_enhancements.js'), 'utf8').replace(/\r\n/g, '\n');

class FakeElement {
    constructor(dataset = {}) {
        this.dataset = { ...dataset };
        this.attributes = Object.create(null);
        this.style = { setProperty(name, value) { this[name] = value; } };
        this.children = [];
        this.listeners = Object.create(null);
        this.hidden = false;
        this.tabIndex = 0;
        this.value = '';
        this.textContent = '';
        this.classList = {
            values: new Set(),
            add: (...names) => names.forEach(name => this.classList.values.add(name)),
            remove: (...names) => names.forEach(name => this.classList.values.delete(name)),
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
        return this._querySelectorAll?.(selector) ?? [];
    }
    querySelector(selector) {
        return this._querySelector?.(selector) ?? null;
    }
    focus() { this.focused = true; }
    scrollTo() {}
    async dispatch(type, event = {}) {
        for (const listener of this.listeners[type] || []) {
            await listener({ preventDefault() {}, stopPropagation() {}, target: this, key: '', ...event });
        }
    }
}

function createModePage(pageId, tabSelector, paneSelector, tabDataKey, paneDataKey, modes, prefix) {
    const page = new FakeElement({ page: pageId });
    const tabs = modes.map(mode => {
        const tab = new FakeElement({ [tabDataKey]: mode });
        tab.setAttribute('id', `${prefix}${mode[0].toUpperCase()}${mode.slice(1)}Tab`);
        return tab;
    });
    const panes = modes.map(mode => {
        const pane = new FakeElement({ [paneDataKey]: mode });
        pane.setAttribute('id', `${prefix}${mode[0].toUpperCase()}${mode.slice(1)}Pane`);
        return pane;
    });
    page._tabs = tabs;
    page._panes = panes;
    page._querySelectorAll = selector => {
        if (selector === tabSelector) return tabs;
        if (selector === paneSelector) return panes;
        return [];
    };
    return { page, tabs, panes };
}

function createFinancePage() {
    const page = new FakeElement({ page: 'finance_hub' });
    const subtabs = ['overview', 'sales', 'purchases', 'profit', 'potential', 'operations'].map((subtab, index) => {
        const button = new FakeElement({ subtab });
        button.offsetLeft = index * 64;
        button.offsetWidth = 56;
        if (subtab === 'overview') button.classList.add('active');
        return button;
    });
    const panes = subtabs.map((button, index) => {
        const pane = new FakeElement({ subtab: button.dataset.subtab });
        if (index === 0) pane.classList.add('active');
        return pane;
    });
    const bar = new FakeElement();
    bar.clientWidth = 420;
    const indicator = new FakeElement();
    page._querySelector = selector => {
        if (selector === '#fptFinSubtabs') return bar;
        if (selector === '#fptFinSubtabsIndicator') return indicator;
        if (selector === '.fpt-fin-subtab.active') return subtabs.find(tab => tab.classList.contains('active')) || null;
        if (selector === '.fpt-fin-tab-pane.active') return panes.find(pane => pane.classList.contains('active')) || null;
        const tabMatch = selector.match(/\.fpt-fin-subtab\[data-subtab=["']([^"']+)["']\]/);
        if (tabMatch) return subtabs.find(tab => tab.dataset.subtab === tabMatch[1]) || null;
        const paneMatch = selector.match(/\.fpt-fin-tab-pane\[data-subtab=["']([^"']+)["']\]/);
        if (paneMatch) return panes.find(pane => pane.dataset.subtab === paneMatch[1]) || null;
        return null;
    };
    page._querySelectorAll = selector => selector === '.fpt-fin-subtab' ? subtabs : selector === '.fpt-fin-tab-pane' ? panes : [];
    return { page, subtabs, panes };
}

function createHarness(storageSeed = {}, financeSubtab = null, { realCurrency = false } = {}) {
    const storage = { ...storageSeed };
    const calculator = createModePage('calculator', '.calc-subtab', '.calc-pane', 'calcMode', 'calcPane', ['math', 'time', 'currency'], 'fptCalc');
    const notifications = createModePage('telegram', '[data-notification-mode]', '[data-notification-pane]', 'notificationMode', 'notificationPane', ['browser', 'telegram', 'discord'], 'fptNotification');
    const finance = createFinancePage();
    const notes = new FakeElement({ page: 'notes' });
    const lotIo = new FakeElement({ page: 'lot_io' });
    const pages = [calculator.page, notifications.page, finance.page, notes, lotIo];
    const currencyElements = Object.fromEntries([
        'currencyAmountFrom', 'currencyAmountTo', 'currencySelectFrom', 'currencySelectTo',
        'currencySwapBtn', 'currencyRateDisplay', 'currency-error-display', 'discordWebhookUrl'
    ].map(id => [id, new FakeElement()]));
    currencyElements.currencyAmountFrom.value = '100';
    currencyElements.currencySelectFrom.options = [];
    currencyElements.currencySelectTo.options = [];
    const navItems = pages.map(page => new FakeElement({ page: page.dataset.page }));
    const popup = new FakeElement();
    popup.classList.add('fp-tools-popup');
    popup.dataset = {};
    popup.querySelectorAll = selector => {
        if (selector === '.fp-tools-page-content') return pages;
        if (selector === '.fp-tools-nav [data-page], .fp-tools-header-tab[data-page]') return navItems;
        return [];
    };
    popup.querySelector = selector => {
        const match = selector.match(/data-page=["']([^"']+)["']/);
        return match ? pages.find(page => page.dataset.page === match[1]) || null : null;
    };

    const session = new Map(financeSubtab ? [['fpt_fin_active_subtab', financeSubtab]] : []);
    const sessionStorage = {
        getItem(key) { return session.has(key) ? session.get(key) : null; },
        setItem(key, value) { session.set(key, String(value)); }
    };
    const document = {
        querySelector: selector => {
            if (selector === '.fp-tools-popup') return popup;
            const match = selector.match(/data-page=["']([^"']+)["']/);
            return match ? pages.find(page => page.dataset.page === match[1]) || null : null;
        },
        getElementById: id => currencyElements[id] || null
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
    const window = {
        fptFinanceHub: { onSubtabChange() {}, onPageLeave() {} },
        addEventListener() {},
        matchMedia: () => ({ matches: true })
    };
    let currencyInitializations = 0;
    if (!realCurrency) window.initializeCurrencyCalculator = () => { currencyInitializations += 1; };
    const fetchRequests = [];
    const fetch = async url => {
        fetchRequests.push(String(url));
        const data = String(url).endsWith('currencies.min.json')
            ? { rub: 'Russian Ruble', usd: 'US Dollar', eur: 'Euro' }
            : { usd: { rub: 92, eur: 0.92 }, rub: { usd: 1 / 92 }, eur: { rub: 100 } };
        return { ok: true, async json() { return data; } };
    };
    const context = vm.createContext({
        window, document, chrome, sessionStorage, fetch,
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: callback => setTimeout(callback, 0),
        Object, Array, Set, Map, Math, String, Number, Boolean, RegExp, Error, Promise
    });
    vm.runInContext(popupSource, context, { filename: 'content/ui/main_popup.js' });
    if (realCurrency) vm.runInContext(currencySource, context, { filename: 'content/features/currency_calculator.js' });
    return { context, window, popup, pages, navItems, calculator, notifications, finance, storage, session, currencyElements, fetchRequests, currencyInitializations: () => currencyInitializations };
}

function pageMarkup(pageId) {
    const pages = [...popupSource.matchAll(/<div class="fp-tools-page-content[^"]*" data-page="([^"]+)"/g)];
    const index = pages.findIndex(match => match[1] === pageId);
    assert.notEqual(index, -1, `the ${pageId} page exists`);
    return popupSource.slice(pages[index].index, pages[index + 1]?.index);
}

async function testCalculatorAndNotificationModes() {
    const h = createHarness();
    assert.equal(typeof h.context.setupCalculatorUI, 'function', 'calculator modes register with the popup router');
    assert.equal(typeof h.context.setupNotificationCenterUI, 'function', 'notification tabs register with the popup router');
    h.context.setupCalculatorUI(h.popup);
    h.context.setupNotificationCenterUI(h.popup);
    h.context.setupFinanceHubUI(h.popup);

    const calcMarkup = pageMarkup('calculator');
    assert.match(calcMarkup, /data-calc-mode="math"/);
    assert.match(calcMarkup, /data-calc-mode="time"/);
    assert.match(calcMarkup, /data-calc-mode="currency"/);
    assert.doesNotMatch(popupSource, /<li data-page="currency_calc"/);
    assert.doesNotMatch(popupSource, /<div class="fp-tools-page-content" data-page="currency_calc"/);
    const navSchema = popupSource.match(/const FPT_NAV_SECTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
    assert.notEqual(navSchema, '', 'the canonical navigation schema is present');
    assert.doesNotMatch(navSchema, /\bcurrency_calc\b/, 'the legacy currency route is not a navigation schema entry');
    assert.match(popupSource, /alias: 'currency_calc'/, 'the legacy currency route remains a route alias');
    assert.doesNotMatch(popupSource, /targetPageId === 'currency_calc'/, 'the old route has no page initializer');
    assert.match(calcMarkup, /role="tablist"/);

    await h.window.fptOpenPopupPage('calculator');
    assert.equal(h.calculator.page.dataset.fptCalculatorMode, 'math', 'ordinary calculator is the default mode');
    assert.equal(h.currencyInitializations(), 0, 'the FX API is not initialized in math mode');

    h.currencyElements.currencyAmountFrom.value = '123';
    await h.calculator.tabs[1].dispatch('keydown', { key: 'End' });
    await h.popup._fptNavigationWriteQueue;
    assert.equal(h.calculator.tabs[2].getAttribute('aria-selected'), 'true', 'End selects the last calculator tab');
    assert.equal(h.calculator.panes[2].hidden, false);
    assert.equal(h.currencyElements.currencyAmountFrom.value, '123', 'changing modes preserves in-progress currency input');
    assert.equal(h.storage.fpToolsLastPageMode, 'currency');
    assert.equal(h.storage.fpToolsPageModes.calculator, 'currency');
    assert.ok(h.currencyInitializations() > 0, 'the FX API is initialized on entering currency mode');

    await h.window.fptOpenPopupPage('notes');
    await h.window.fptOpenPopupPage('calculator');
    assert.equal(h.calculator.page.dataset.fptCalculatorMode, 'currency', 'calculator mode restores after visiting another page');
    await h.window.fptOpenPopupPage('currency_calc');
    assert.equal(h.storage.fpToolsLastPage, 'calculator', 'the legacy currency route persists the canonical page ID');
    assert.equal(h.storage.fpToolsPageModes.calculator, 'currency', 'the legacy currency route selects and stores currency mode');

    await h.calculator.tabs[2].dispatch('keydown', { key: 'Home' });
    assert.equal(h.calculator.tabs[0].getAttribute('aria-selected'), 'true', 'Home selects the first calculator tab');
    await h.calculator.tabs[0].dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(h.calculator.tabs[2].getAttribute('aria-selected'), 'true', 'ArrowLeft wraps to the last calculator tab');

    const fresh = createHarness();
    fresh.context.setupCalculatorUI(fresh.popup);
    fresh.context.setupNotificationCenterUI(fresh.popup);
    await fresh.window.fptOpenPopupPage('telegram');
    assert.equal(fresh.notifications.page.dataset.fptNotificationMode, 'telegram', 'Telegram is the notification center default');
    assert.equal(fresh.notifications.tabs[1].getAttribute('aria-selected'), 'true');
    assert.equal(fresh.notifications.tabs[1].getAttribute('aria-controls'), fresh.notifications.panes[1].id);
    assert.equal(fresh.notifications.panes[1].getAttribute('aria-labelledby'), fresh.notifications.tabs[1].id);
    fresh.currencyElements.discordWebhookUrl.value = 'https://example.invalid/dirty';
    await fresh.notifications.tabs[1].dispatch('keydown', { key: 'ArrowRight' });
    await fresh.popup._fptNavigationWriteQueue;
    assert.equal(fresh.currencyElements.discordWebhookUrl.value, 'https://example.invalid/dirty', 'notification mode changes preserve unsaved webhook edits');
    assert.equal(fresh.notifications.tabs[2].getAttribute('aria-selected'), 'true', 'ArrowRight advances notification tabs');
    assert.equal(fresh.storage.fpToolsLastPageMode, 'discord');
    assert.equal(fresh.storage.fpToolsPageModes.telegram, 'discord');
    await fresh.notifications.tabs[2].dispatch('keydown', { key: 'Home' });
    assert.equal(fresh.notifications.tabs[0].getAttribute('aria-selected'), 'true', 'Home selects the first notification tab');
    await fresh.notifications.tabs[0].dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(fresh.notifications.tabs[2].getAttribute('aria-selected'), 'true', 'ArrowLeft wraps to the last notification tab');
    await fresh.notifications.tabs[0].dispatch('keydown', { key: 'End' });
    assert.equal(fresh.notifications.tabs[2].getAttribute('aria-selected'), 'true', 'End selects the last notification tab');

    const invalidModes = createHarness({ fpToolsPageModes: { calculator: 'unknown', telegram: 'unknown' } });
    invalidModes.context.setupCalculatorUI(invalidModes.popup);
    invalidModes.context.setupNotificationCenterUI(invalidModes.popup);
    await invalidModes.window.fptOpenPopupPage('calculator');
    assert.equal(invalidModes.calculator.page.dataset.fptCalculatorMode, 'math', 'unknown calculator mode falls back to math');
    await invalidModes.window.fptOpenPopupPage('telegram');
    assert.equal(invalidModes.notifications.page.dataset.fptNotificationMode, 'telegram', 'unknown notification mode falls back to Telegram');
}

function testSettingsRemainOnTheirOwningPages() {
    const general = pageMarkup('general');
    const telegram = pageMarkup('telegram');
    const finance = pageMarkup('finance_hub');
    const generalIds = ['hideBalanceCheckbox', 'viewSellersPromoCheckbox', 'fptShowCommissionCheckbox', 'fptShowRealPricesCheckbox', 'fpToolsBuyerHistory', 'fpToolsShowUnconfirmed', 'fptIdentifierEnabled'];
    for (const id of generalIds) {
        assert.match(general, new RegExp(`id="${id}"`), `${id} stays in the display settings page`);
    }
    const telegramIds = ['notificationSoundGroup', 'fptCustomSoundBlock', 'fptCustomSoundUploadBtn', 'fptCustomSoundInput', 'fptCustomSoundFileName', 'fptClipSeconds', 'fptClipSecUp', 'fptClipSecDown', 'fptCustomSoundEditor', 'fptWaveWrap', 'fptWaveCanvas', 'fptWaveSel', 'fptWavePlayhead', 'fptWaveSelHandleL', 'fptWaveSelHandleR', 'fptCustomSoundRange', 'fptCustomSoundPreviewBtn', 'fptCustomSoundSaveBtn', 'fptCustomSoundSaved', 'fptCustomSoundSavedLen', 'notificationVolumeValue', 'notificationVolume', 'previewNotificationBtn', 'discordLogEnabled', 'discordSettingsContainer', 'discordWebhookUrl', 'discordPingEveryone', 'discordPingHere', 'fptTgEnabled', 'fptTgConfig', 'fptTgToken', 'fptTgConnectBtn', 'fptTgTestBtn', 'fptTgStatus', 'fptTgChatId', 'fptTgNotifyOrders', 'fptTgNotifyMessages', 'fptTgAllowControl'];
    for (const id of telegramIds) {
        assert.match(telegram, new RegExp(`id="${id}"`), `${id} stays in the notification center`);
    }
    const calculatorIds = ['calcDisplay', 'calcTimeInput', 'calcTimeBtn', 'calcTimeResult', 'currencyAmountFrom', 'currencySelectFrom', 'currencySwapBtn', 'currencyRateDisplay', 'currencyAmountTo', 'currencySelectTo', 'currency-error-display'];
    const calculator = pageMarkup('calculator');
    for (const id of calculatorIds) assert.match(calculator, new RegExp(`id="${id}"`), `${id} stays in the calculator page`);
    assert.match(telegram, /role="tablist"/);
    const additionalFinanceSettings = finance.match(/<section[^>]*class="[^"]*fpt-fin-additional-settings[^"]*"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';
    assert.match(additionalFinanceSettings, /id="showSalesStatsCheckbox"/);
    assert.match(additionalFinanceSettings, /id="showFinanceStatsCheckbox"/);
    assert.match(additionalFinanceSettings, /Дополнительные настройки/);

    for (const id of [...generalIds, 'showSalesStatsCheckbox', 'showFinanceStatsCheckbox', ...telegramIds, ...calculatorIds]) {
        assert.equal((popupSource.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} is present once and keeps its original DOM identity`);
    }
    for (const key of ['showSalesStats', 'showFinanceStats', 'hideBalance', 'viewSellersPromo', 'notificationSound', 'notificationVolume', 'fpToolsDiscord', 'fptShowCommission', 'fptShowRealPrices', 'fpToolsBuyerHistory', 'fpToolsShowUnconfirmed', 'fpToolsIdentifierEnabled']) {
        assert.ok(loaderSource.includes(`'${key}'`) || miscSource.includes(`${key}:`), `${key} keeps its storage mapping`);
    }
    assert.match(telegramSource, /const FPT_TG_KEY = 'fpToolsTelegram'/);
    assert.match(enhancementsSource, /fptLegacyFinanceReports/);
    assert.match(currencySource, /currencyAmountFrom/);
    assert.match(loaderSource, /notificationVolume/);
}

async function testFinanceHubSubtabCompatibility() {
    const h = createHarness({}, 'sales');
    h.context.setupFinanceHubUI(h.popup);
    await h.window.fptOpenPopupPage('finance_hub');
    assert.equal(h.storage.fpToolsPageModes.finance_hub, 'sales', 'Finance Hub session state migrates into its mode map');
    assert.equal(h.storage.fpToolsLastPageMode, 'sales');
    assert.equal(h.session.get('fpt_fin_active_subtab'), 'sales', 'the legacy sessionStorage subtab remains synchronized');
    await h.finance.subtabs.find(tab => tab.dataset.subtab === 'purchases').dispatch('click');
    await h.popup._fptNavigationWriteQueue;
    assert.equal(h.storage.fpToolsLastPageMode, 'purchases', 'a manual Finance Hub subtab click updates the current route mode');
    assert.equal(h.storage.fpToolsPageModes.finance_hub, 'purchases', 'a manual Finance Hub subtab click updates the page mode map');
    assert.equal(h.session.get('fpt_fin_active_subtab'), 'purchases', 'a manual Finance Hub subtab click updates the legacy session key');
    await h.finance.subtabs.find(tab => tab.dataset.subtab === 'sales').dispatch('click');
    await h.popup._fptNavigationWriteQueue;
    await h.window.fptOpenPopupPage('notes');
    await h.window.fptOpenPopupPage('finance_hub');
    assert.equal(h.finance.subtabs.find(tab => tab.classList.contains('active')).dataset.subtab, 'sales', 'Finance Hub restores its own subtab');
}

async function testCurrencyApiIsLazy() {
    const h = createHarness({}, null, { realCurrency: true });
    h.context.setupCalculatorUI(h.popup);
    await h.window.fptOpenPopupPage('calculator');
    assert.deepEqual(h.fetchRequests, [], 'opening the ordinary calculator does not request currency data');

    await h.window.fptOpenPopupPage('currency_calc');
    assert.equal(h.fetchRequests.length, 2, 'entering the legacy currency route requests the currency list and conversion rate');
    assert.match(h.fetchRequests[0], /currencies\.min\.json$/);
    assert.match(h.fetchRequests[1], /\/usd\.min\.json$/);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.fetchRequests.length, 2, 'currency initialization makes no duplicate requests');
    assert.equal(h.currencyElements.currencyAmountTo.value, '9200.00');

    await h.window.fptOpenPopupPage('notes');
    await h.window.fptOpenPopupPage('calculator');
    assert.equal(h.fetchRequests.length, 2, 'restoring currency mode reuses the initialized page and session cache');
}

async function run() {
    await testCalculatorAndNotificationModes();
    testSettingsRemainOnTheirOwningPages();
    await testFinanceHubSubtabCompatibility();
    await testCurrencyApiIsLazy();
    console.log('settings_page_recomposition: passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
