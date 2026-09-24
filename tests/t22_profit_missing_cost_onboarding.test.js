const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(root, 'content', 'features', 'finance_hub', 'profit.js'), 'utf8').replace(/\r\n/g, '\n');
const popup = fs.readFileSync(path.join(root, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');

const noticeMatch = hub.match(/function getProfitCostCoverageNotice\(totals, isLoading(?:,\s*isError)?\)\s*\{[\s\S]*?\n\s{12}\}/);
assert.ok(noticeMatch, 'profit cost coverage states must have a focused classifier');
const getNotice = new Function(`${noticeMatch[0]}; return getProfitCostCoverageNotice;`)();
const stateFor = (totals, isLoading = false) => getNotice(totals, isLoading).type;
assert.equal(stateFor(null, true), 'loading', 'loading must have its own visible state');
assert.equal(stateFor({ eligibleOrdersCount: 0, knownCostOrdersCount: 0 }), 'empty', 'zero eligible orders must be explained separately');
assert.equal(stateFor({ eligibleOrdersCount: 3, knownCostOrdersCount: 0 }), 'missing', 'eligible orders without known costs must get an onboarding state');
assert.equal(stateFor({ eligibleOrdersCount: 4, knownCostOrdersCount: 2 }), 'partial', 'partial cost coverage must be distinguishable');
assert.equal(stateFor({ eligibleOrdersCount: 2, knownCostOrdersCount: 2 }), 'complete', 'full cost coverage must have a completion state');

assert.match(popup, /id="fptFinProfitCostWarningAction"/, 'warning slot must contain an accessible CTA');
assert.match(hub, /withoutCostChip\.click\(\)/, 'CTA must dispatch the existing without-cost chip handler');
assert.match(hub, /renderProfitMissingCostWarning\(pane,\s*null,\s*[^,]+,\s*true\)/, 'profit loading view must render the loading coverage state');
assert.match(hub, /totals\.realisedNetProfit !== null[\s\S]*?else\s*\{\s*netEl\.textContent = '—'/, 'unknown profit must stay unknown instead of rendering as zero');

function makeNode() {
    const classes = new Set();
    return {
        textContent: '',
        innerHTML: '',
        hidden: false,
        attributes: {},
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
        setAttribute(name, value) { this.attributes[name] = value; }
    };
}

async function testRejectedProfitLoadLeavesAnErrorCoverageState() {
    const sandbox = { console: { error() {} } };
    sandbox.window = sandbox;
    sandbox.FPTProfitEngine = {
        async getRealisedProfit() { throw new Error('simulated finance load failure'); }
    };
    vm.createContext(sandbox);
    vm.runInContext(hub, sandbox, { filename: 'finance_hub/profit.js' });

    const panel = makeNode();
    const icon = makeNode();
    const title = makeNode();
    const description = makeNode();
    const action = makeNode();
    const warning = makeNode();
    const tbody = makeNode();
    const nodes = new Map([
        ['.fpt-fin-profit-cost-warning', panel],
        ['.fpt-fin-profit-cost-warning-icon', icon],
        ['.fpt-fin-profit-cost-warning-copy strong', title],
        ['.fpt-fin-profit-cost-warning-copy span', description],
        ['#fptFinProfitCostWarningAction', action]
    ]);
    warning.querySelector = selector => nodes.get(selector) || null;
    const paneNodes = new Map([
        ['#fptFinProfitCostWarning', warning],
        ['#fptFinProfitTableBody', tbody]
    ]);
    const pane = { querySelector: selector => paneNodes.get(selector) || makeNode() };
    const state = {
        container: { querySelector: () => pane },
        profitRenderToken: 0,
        profitCurrency: 'RUB',
        period: '7d',
        currency: 'all',
        category: 'all',
        orderStatus: 'all',
        cachedProfitPeriod: null,
        cachedProfitOrders: null
    };
    const moduleContext = {
        state,
        root: sandbox,
        esc: String,
        formatMoney: String,
        formatDate: String,
        periodLabel: String,
        updateCategorySelectOptions() {},
        openDrilldown() {},
        async updateLastUpdatedText() {}
    };
    const profit = sandbox.FPTFinanceHubModules.createProfit(moduleContext);

    await profit.renderProfitSubtab(true);

    assert.equal(state.isProfitLoading, false, 'rejected load must clear the loading flag');
    assert.equal(panel.classList.contains('is-error'), true, 'rejected load must transition the coverage panel into an error state');
    assert.equal(panel.classList.contains('is-loading'), false, 'rejected load must remove the stale loading state');
    assert.equal(icon.classList.contains('fpt-fin-profit-cost-warning-icon--spin'), false, 'error coverage must stop the loading spinner');
    assert.match(title.textContent, /не удалось загрузить/i, 'coverage panel must explain the failed load');
    assert.match(tbody.innerHTML, /Не удалось загрузить данные о прибыли/, 'the table must retain its existing load error');
}

async function main() {
    await testRejectedProfitLoadLeavesAnErrorCoverageState();
    console.log('T22_PROFIT_MISSING_COST_ONBOARDING_PASS');
}

main().catch(error => {
    console.error(`T22_PROFIT_MISSING_COST_ONBOARDING_FAIL ${error.stack || error.message}`);
    process.exitCode = 1;
});
