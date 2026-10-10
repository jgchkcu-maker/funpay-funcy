// The finance category is an empty shell in the static popup and is filled in at runtime by FPTFinanceHubPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('finance_hub: static markup stays empty and search metadata remains', () => assertEmptyCategory('finance_hub'));

test('finance_hub: model, chart and page modules load in order before the readiness marker that permits mounting them', () => {
    assert.ok(read('content/content_script.js').includes('FPTFinanceHubPage'), 'the popup boot path mounts the finance view');
    const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(read('manifest.json')));
    const scripts = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js')).js;
    const mount = scripts.indexOf('content/ui/popup_bundle_ready.js');
    const order = ['content/ui/finance_hub_model.js', 'content/ui/finance_charts.js', 'content/ui/finance_hub_page.js'];
    order.forEach((file, index) => {
        assert.ok(scripts.includes(file), `${file} is in the manifest plus popup bundle`);
        assert.ok(scripts.indexOf(file) < mount, `${file} loads before the bundle readiness marker`);
        if (index) assert.ok(scripts.indexOf(order[index - 1]) < scripts.indexOf(file), `${file} loads after ${order[index - 1]}`);
    });
});

test('finance_hub: the page uses the shared category frame, builds DOM nodes and talks only to popup actions', () => {
    const page = read('content/ui/finance_hub_page.js');
    assert.match(page, /ensureCategoryHeader\(page, 'Обзор и аналитика'/);
    assert.ok(!/innerHTML/.test(page), 'no innerHTML in the page');
    assert.ok(!/innerHTML/.test(read('content/ui/finance_charts.js')), 'no innerHTML in the charts');
    for (const action of ['getFinanceData', 'fptFinRefreshBtn', 'fptFinExportDownloadCsv', 'fptFinExportDownloadJson',
        'fptFinCustomApplyBtn', 'fptFinCustomResetBtn']) {
        assert.ok(page.includes(`'${action}'`), `${action} is routed through fptPopupActions`);
    }
    for (const key of ['fpt_fin_last_period', 'fpt_fin_active_subtab']) assert.ok(page.includes(key), `${key} is kept`);
    assert.match(page, /fpt-fin-tab-pane/, 'panes stay discoverable by the in-popup search');
});

test('finance_hub: every metadata mode has a tab button and a mode action registered by the popup shell', () => {
    const page = read('content/ui/finance_hub_page.js');
    const popup = read('content/ui/main_popup.js');
    const modes = { overview: 'fptFinTabOverview', sales: 'fptFinTabSales', purchases: 'fptFinTabPurchases',
        profit: 'fptFinTabProfit', potential: 'fptFinTabPotential', operations: 'fptFinTabOperations' };
    for (const [mode, action] of Object.entries(modes)) {
        assert.ok(page.includes(`id: '${mode}'`) && page.includes(`'${action}'`), `${mode} tab`);
        assert.ok(popup.includes(action), `${action} is registered by the popup shell`);
    }
});

test('finance_hub: styles are scoped, responsive and themed through the popup tokens', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-finance\s*\{/);
    assert.match(css, /container-name: fpt-finance/);
    assert.match(css, /@container fpt-finance \(max-width: 560px\)/);
    assert.match(css, /:root\.fpt-theme-dark \.fp-tools-popup\.fptm-themed \.fpt-finance\s*\{/);
    assert.ok(read('content/ui/popup_components.js').includes('.fp-tools-page-content.active'), 'toasts render on the active page, including finance');
});

test('finance_hub: the overview data action also returns profit and the previous period for KPI deltas', () => {
    const source = read('content/features/finance_hub.js');
    assert.match(source, /resolvePreviousPeriodRange\(options\.period\)/);
    assert.match(source, /previous: previousOptions/);
});
