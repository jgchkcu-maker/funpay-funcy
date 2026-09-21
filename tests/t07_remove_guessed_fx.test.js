const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeDataSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ (T07)
// ─────────────────────────────────────────────────────────────────────────────

function runStaticChecks() {
    // 1. RATES in finance_hub.js must be removed
    assert.doesNotMatch(financeHubSource, /\bconst RATES\b/, 'finance_hub.js must not contain RATES table');

    // 2. Hardcoded guessed rates in finance_data.js must be removed
    assert.doesNotMatch(financeDataSource, /const rates = \{ RUB: 1, USD: 90, EUR: 98/, 'finance_data.js must not contain guessed operations rates');
    assert.doesNotMatch(financeDataSource, /absVal \* \(rates\[cur\] \|\| 0\)/, 'finance_data.js must not convert operations using guessed rates');

    // 3. Safe UX message must be present in finance_hub.js
    assert.match(financeHubSource, /Выберите валюту для отображения денежного графика/, 'finance_hub.js must contain Safe UX message for multi-currency');

    // 4. Old normalization label in operations legend must be removed
    assert.doesNotMatch(financeHubSource, /визуальная ось нормализована к ₽/, 'finance_hub.js must not claim visual axis is normalized to RUB');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ИЗОЛИРОВАННОЕ ОКРУЖЕНИЕ (VM)
// ─────────────────────────────────────────────────────────────────────────────

function createDOMElement(tag = 'div') {
    return {
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {},
        innerHTML: '',
        children: [],
        style: {},
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, force) {
                if (force === undefined) {
                    if (this.classes.has(c)) this.classes.delete(c);
                    else this.classes.add(c);
                } else if (force) {
                    this.classes.add(c);
                } else {
                    this.classes.delete(c);
                }
            }
        },
        querySelector(selector) {
            if (selector.startsWith('#')) {
                const id = selector.slice(1);
                if (this.id === id) return this;
                for (const c of this.children) {
                    const res = c.querySelector(selector);
                    if (res) return res;
                }
            }
            if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                if (this.classList.contains(cls) || (this.className && this.className.includes(cls))) return this;
                for (const c of this.children) {
                    const res = c.querySelector(selector);
                    if (res) return res;
                }
            }
            return null;
        },
        querySelectorAll(selector) {
            const matches = [];
            const check = (node) => {
                if (selector.startsWith('.')) {
                    const cls = selector.slice(1);
                    if (node.classList.contains(cls) || (node.className && node.className.includes(cls))) {
                        matches.push(node);
                    }
                }
                for (const child of node.children) check(child);
            };
            for (const child of this.children) check(child);
            return matches;
        },
        appendChild(child) {
            this.children.push(child);
            child.parentElement = this;
            return child;
        },
        replaceWith(newEl) {
            if (this.parentElement) {
                const idx = this.parentElement.children.indexOf(this);
                if (idx !== -1) this.parentElement.children[idx] = newEl;
                newEl.parentElement = this.parentElement;
            }
        },
        addEventListener() {},
        remove() {}
    };
}

function setupEnvironment() {
    const sandbox = {
        Date,
        Math,
        String,
        Number,
        Array,
        Object,
        Set,
        Map,
        Promise,
        Boolean,
        parseFloat,
        isNaN,
        console: { log() {}, warn() {}, error() {} },
        chrome: {
            storage: {
                local: {
                    get: (_k, cb) => cb({}),
                    set: (_d, cb) => cb && cb()
                }
            }
        },
        document: {
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: (tag) => createDOMElement(tag)
        }
    };
    sandbox.window = sandbox;
    sandbox.root = sandbox;
    sandbox.self = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(financeDataSource, sandbox);
    vm.runInContext(financeHubSource, sandbox);

    return {
        finData: sandbox.FPTFinanceData,
        hub: sandbox.FPTFinanceHub
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ТЕСТЫ REGRESSION FIXTURE (1000 RUB + 10 USD)
// ─────────────────────────────────────────────────────────────────────────────

function testRegressionFixture(finData, hub) {
    const mixedOrders = [
        {
            orderId: 'o-rub',
            orderStatus: 'closed',
            price: 1000,
            currency: 'RUB',
            orderDate: '2026-09-20T12:00:00Z',
            buyerUsername: 'buyer1'
        },
        {
            orderId: 'o-usd',
            orderStatus: 'closed',
            price: 10,
            currency: 'USD',
            orderDate: '2026-09-20T14:00:00Z',
            buyerUsername: 'buyer2'
        }
    ];

    // A. groupOrdersByStep under currency=all (or unspecified)
    const allBuckets = hub.groupOrdersByStep(mixedOrders, 'day');
    assert.equal(allBuckets.isMultiCurrency, true, 'groupOrdersByStep must flag isMultiCurrency=true');
    assert.equal(allBuckets.currency, null, 'groupOrdersByStep must not set a single currency for mixed dataset');
    assert.equal(allBuckets.length, 1, 'Must have 1 day bucket for 2026-09-20');
    assert.equal(allBuckets[0].revenue, null, 'Regression fixture: 1000 RUB + 10 USD must NEVER be combined into a single converted monetary sum');
    assert.equal(allBuckets[0].count, 2, 'Counts must still aggregate across currencies (2 orders)');
    assert.equal(allBuckets[0].revenueByCur.RUB, 1000, 'Exact RUB revenue preserved');
    assert.equal(allBuckets[0].revenueByCur.USD, 10, 'Exact USD revenue preserved');

    // B. groupOrdersByStep under currency=RUB
    const rubBuckets = hub.groupOrdersByStep(mixedOrders, 'day', 'RUB');
    assert.equal(rubBuckets.isMultiCurrency, false, 'Explicit RUB target must not be multi-currency');
    assert.equal(rubBuckets.currency, 'RUB', 'Explicit RUB target must set currency=RUB');
    assert.equal(rubBuckets[0].revenue, 1000, 'currency=RUB must graph RUB only (1000 RUB)');
    assert.equal(rubBuckets[0].count, 2, 'Count remains total valid orders in bucket');

    // C. groupOrdersByStep under currency=USD
    const usdBuckets = hub.groupOrdersByStep(mixedOrders, 'day', 'USD');
    assert.equal(usdBuckets.isMultiCurrency, false, 'Explicit USD target must not be multi-currency');
    assert.equal(usdBuckets.currency, 'USD', 'Explicit USD target must set currency=USD');
    assert.equal(usdBuckets[0].revenue, 10, 'currency=USD must graph USD only (10 USD)');

    // D. groupOrdersByStep under currency=EUR
    const eurBuckets = hub.groupOrdersByStep(mixedOrders, 'day', 'EUR');
    assert.equal(eurBuckets.isMultiCurrency, false);
    assert.equal(eurBuckets[0].revenue, 0, 'currency=EUR must be 0 for dataset without EUR orders');

    // E. calculateSalesAggregation in finance_data.js
    const salesAgg = finData.aggregateSales(mixedOrders);
    assert.equal(salesAgg.isMultiCurrency, true, 'aggregateSales must flag isMultiCurrency');
    const dayKey = '2026-09-20';
    assert.ok(salesAgg.byDay[dayKey], 'byDay bucket exists');
    assert.equal(salesAgg.byDay[dayKey].revenue, null, 'byDay.revenue must not combine mixed currencies');
    assert.equal(salesAgg.byDay[dayKey].revenueByCurrency.RUB, 1000);
    assert.equal(salesAgg.byDay[dayKey].revenueByCurrency.USD, 10);
    assert.equal(salesAgg.count, 2, 'Sales aggregation valid count is 2');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ТЕСТЫ SINGLE CURRENCY AUTO-GRAPHING
// ─────────────────────────────────────────────────────────────────────────────

function testSingleCurrencyAutoGraphing(finData, hub) {
    const usdOnlyOrders = [
        {
            orderId: 'u1',
            orderStatus: 'closed',
            price: 50,
            currency: 'USD',
            orderDate: '2026-09-20T10:00:00Z'
        },
        {
            orderId: 'u2',
            orderStatus: 'paid',
            price: 30,
            currency: 'USD',
            orderDate: '2026-09-20T15:00:00Z'
        }
    ];

    // Under targetCurrency = 'all' or omitted, single currency USD must auto-graph!
    const buckets = hub.groupOrdersByStep(usdOnlyOrders, 'day');
    assert.equal(buckets.isMultiCurrency, false, 'Single currency dataset must not be marked multi-currency');
    assert.equal(buckets.currency, 'USD', 'Single currency must auto-detect USD');
    assert.equal(buckets[0].revenue, 80, 'Single currency USD must auto-graph sum 80 USD without conversion');
    assert.equal(buckets[0].count, 2);

    const salesAgg = finData.aggregateSales(usdOnlyOrders);
    assert.equal(salesAgg.isMultiCurrency, false);
    assert.equal(salesAgg.currency, 'USD');
    assert.equal(salesAgg.byDay['2026-09-20'].revenue, 80);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ТЕСТЫ SAFE UX ДЛЯ ДИНАМИЧЕСКИХ ГРАФИКОВ
// ─────────────────────────────────────────────────────────────────────────────

function testSafeUxRendering(finData, hub) {
    const cardEl = createDOMElement('div');

    const mixedOrders = [
        { orderId: '1', orderStatus: 'closed', price: 1000, currency: 'RUB', orderDate: '2026-09-20T12:00:00Z' },
        { orderId: '2', orderStatus: 'closed', price: 10, currency: 'USD', orderDate: '2026-09-20T12:00:00Z' }
    ];

    // Call renderDynamicChart with mixed orders and no specific currency
    hub.renderDynamicChart(cardEl, mixedOrders, 'day');

    const container = cardEl.children[0];
    assert.ok(container, 'Chart container rendered');
    assert.ok(
        container.innerHTML.includes('Выберите валюту для отображения денежного графика'),
        'renderDynamicChart must show Safe UX message when mixed currencies exist under currency=all'
    );
    assert.ok(container.innerHTML.includes('RUB'), 'Currency button for RUB rendered');
    assert.ok(container.innerHTML.includes('USD'), 'Currency button for USD rendered');

    // Call renderDynamicChart with specific currency option
    const cardRub = createDOMElement('div');
    hub.renderDynamicChart(cardRub, mixedOrders, 'day', { currency: 'RUB' });
    const contRub = cardRub.children[0];
    assert.ok(!contRub.innerHTML.includes('Выберите валюту для отображения денежного графика'), 'Specific currency must render chart directly');
    assert.ok(contRub.innerHTML.includes('<svg'), 'SVG chart rendered for RUB');

    // Test operations chart Safe UX
    const opCard = createDOMElement('div');
    const mixedOpsAgg = {
        byDay: {
            '2026-09-20': { in: null, out: null, inByCur: { RUB: 500, USD: 20 }, outByCur: {} }
        },
        inByCur: { RUB: 500, USD: 20 },
        outByCur: {},
        isMultiCurrency: true
    };
    hub.operationFlowChart(opCard, mixedOpsAgg);
    const opBody = opCard.children[0];
    assert.ok(
        opBody.innerHTML.includes('Выберите валюту для отображения денежного графика'),
        'operationFlowChart must show Safe UX message when operations have mixed currencies'
    );
    assert.doesNotMatch(opBody.innerHTML, /визуальная ось нормализована к ₽/, 'Operation flow chart must never show guessed normalization text');

    // Test operations chart with single currency
    const singleOpCard = createDOMElement('div');
    const singleOpsAgg = {
        byDay: {
            '2026-09-20': { in: 500, out: 0, inByCur: { RUB: 500 }, outByCur: {} }
        },
        inByCur: { RUB: 500 },
        outByCur: {},
        isMultiCurrency: false
    };
    hub.operationFlowChart(singleOpCard, singleOpsAgg);
    const singleOpBody = singleOpCard.children[0];
    assert.ok(!singleOpBody.innerHTML.includes('Выберите валюту для отображения денежного графика'));
    assert.ok(singleOpBody.innerHTML.includes('<svg'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ТЕСТЫ ОПЕРАЦИЙ БЕЗ УГАДАННЫХ КУРСОВ (finance_data.js)
// ─────────────────────────────────────────────────────────────────────────────

function testOperationsAggregationTruth(finData) {
    const txns = [
        {
            id: 't-rub',
            status: 'complete',
            signed: 1000,
            currency: 'RUB',
            date: '2026-09-20T12:00:00Z'
        },
        {
            id: 't-usd',
            status: 'complete',
            signed: 10,
            currency: 'USD',
            date: '2026-09-20T12:00:00Z'
        }
    ];

    // Under currency=all / unspecified:
    const agg = finData.aggregateOperations(txns);
    assert.equal(agg.isMultiCurrency, true, 'Multi-currency operations must be flagged');
    assert.equal(agg.currency, null);
    assert.equal(agg.byDay['2026-09-20'].in, null, 'byDay.in must NOT sum 1000 + 10 * 90 = 1900 ₽');
    assert.equal(agg.byDay['2026-09-20'].inByCur.RUB, 1000);
    assert.equal(agg.byDay['2026-09-20'].inByCur.USD, 10);
    assert.equal(agg.netByCur.RUB, 1000);
    assert.equal(agg.netByCur.USD, 10);

    // Under explicit currency = RUB
    const rubAgg = finData.aggregateOperations(txns, { currency: 'RUB' });
    assert.equal(rubAgg.isMultiCurrency, false);
    assert.equal(rubAgg.currency, 'RUB');
    assert.equal(rubAgg.byDay['2026-09-20'].in, 1000);

    // Under explicit currency = USD
    const usdAgg = finData.aggregateOperations(txns, { currency: 'USD' });
    assert.equal(usdAgg.isMultiCurrency, false);
    assert.equal(usdAgg.currency, 'USD');
    assert.equal(usdAgg.byDay['2026-09-20'].in, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
    runStaticChecks();
    const { finData, hub } = setupEnvironment();
    testRegressionFixture(finData, hub);
    testSingleCurrencyAutoGraphing(finData, hub);
    testSafeUxRendering(finData, hub);
    testOperationsAggregationTruth(finData);

    console.log('T07_REMOVE_GUESSED_FX_PASS');
}

main();
