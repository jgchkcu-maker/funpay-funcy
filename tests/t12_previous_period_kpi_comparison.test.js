const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFinanceHub } = require('./helpers/finance_hub_loader');

const ROOT = path.join(__dirname, '..');
const financeDataSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubOverviewSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub', 'overview.js'), 'utf8').replace(/\r\n/g, '\n');
const cssSource = fs.readFileSync(path.join(ROOT, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

function createFinanceData(customSales = []) {
    const databases = {
        FPTSalesDB: {
            getAllAsArray: async () => customSales
        },
        FPTPurchasesDB: {
            getAllAsArray: async () => []
        },
        FPTFinanceDB: {
            getAllAsArray: async () => []
        }
    };
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
        document: { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}) },
        ...databases
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(financeDataSource, ctx, { filename: 'finance_data.js' });
    return ctx.FPTFinanceData;
}

function createFinanceHub() {
    const stored = new Map();
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
        Error,
        console: { log() {}, warn() {}, error() {} },
        document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
        sessionStorage: {
            getItem: key => stored.has(key) ? stored.get(key) : null,
            setItem: (key, value) => stored.set(key, String(value)),
            removeItem: key => stored.delete(key)
        },
        FPTFinanceData: {
            getSales: async () => [],
            aggregateSales: () => ({ byCurrency: {}, byStatus: {}, count: 0, total: 0 }),
            resolvePreviousPeriodRange: (p, o) => ({ start: 100, end: 200, label: 'prev' }),
            formatKpiComparison: () => ({ diffPercent: 12.4, badgeHtml: '<span class="fpt-fin-kpi-diff fpt-fin-diff-positive">+12.4% vs previous period</span>' }),
            compareKpis: () => ({
                revenue: { diffPercent: 12.4, badgeHtml: '<span class="fpt-fin-kpi-diff fpt-fin-diff-positive">+12.4% vs previous period</span>' },
                orders: { diffPercent: -8.1, badgeHtml: '<span class="fpt-fin-kpi-diff fpt-fin-diff-negative">−8.1% vs previous period</span>' },
                averageCheck: { diffPercent: 0, badgeHtml: '<span class="fpt-fin-kpi-diff fpt-fin-diff-neutral">0.0% vs previous period</span>' },
                profit: { diffPercent: null, badgeHtml: '<span class="fpt-fin-kpi-diff fpt-fin-diff-neutral">—</span>' }
            })
        },
        FPTProfitEngine: { getRealisedProfit: async () => ({ orders: [], byCurrency: {} }) },
        FPTPotential: { getInventory: async () => [] }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    loadFinanceHub(vm, ctx);
    return {
        hub: ctx.FPTFinanceHub || ctx.fptFinanceHub,
        getStored: key => stored.get(key)
    };
}

// 1. Exact Period Boundary Tests
function testExactPeriodBoundaries() {
    const finData = createFinanceData();
    assert.equal(typeof finData.resolvePreviousPeriodRange, 'function', 'resolvePreviousPeriodRange is exposed on FPTFinanceData');

    const now = 1774000000000;
    const opts = { now, useMsk: true };

    // Preset '7d'
    const curr7d = finData.resolvePeriodRange('7d', opts);
    const prev7d = finData.resolvePreviousPeriodRange('7d', opts);
    assert.ok(curr7d && prev7d, '7d ranges exist');
    assert.equal(prev7d.end + 1, curr7d.start, 'Previous 7d immediately precedes current 7d without gap or overlap');
    const curr7dEnd = curr7d.end !== null ? curr7d.end : now;
    const curr7dDuration = curr7dEnd - curr7d.start;
    const prev7dDuration = prev7d.end - prev7d.start + 1;
    assert.equal(curr7dDuration, prev7dDuration, '7d durations are exactly equal');
    assert.equal(prev7dDuration, 7 * 24 * 60 * 60 * 1000, 'Duration is exactly 7 MSK days');

    // Preset '30d'
    const curr30d = finData.resolvePeriodRange('30d', opts);
    const prev30d = finData.resolvePreviousPeriodRange('30d', opts);
    assert.ok(curr30d && prev30d, '30d ranges exist');
    assert.equal(prev30d.end + 1, curr30d.start, 'Previous 30d immediately precedes current 30d');
    const curr30dEnd = curr30d.end !== null ? curr30d.end : now;
    assert.equal(curr30dEnd - curr30d.start, prev30d.end - prev30d.start + 1, '30d durations are exactly equal');

    // Preset '24h'
    const curr24h = finData.resolvePeriodRange('24h', opts);
    const prev24h = finData.resolvePreviousPeriodRange('24h', opts);
    assert.ok(curr24h && prev24h, '24h ranges exist');
    assert.equal(prev24h.end + 1, curr24h.start, 'Previous 24h immediately precedes current 24h');
    const curr24hEnd = curr24h.end !== null ? curr24h.end : now;
    assert.equal(curr24hEnd - curr24h.start, prev24h.end - prev24h.start + 1, '24h durations are exactly equal');
    assert.equal(prev24h.end - prev24h.start + 1, 24 * 60 * 60 * 1000, 'Previous 24h duration is 24 hours');

    // Custom range: Sep 10 - Sep 18 (9 calendar days)
    // 2026-09-10 to 2026-09-18 -> immediately previous equal-duration range must be 2026-09-01 to 2026-09-09
    const customSep = { from: '2026-09-10', to: '2026-09-18' };
    const currCustom = finData.resolvePeriodRange(customSep, { useMsk: true });
    const prevCustom = finData.resolvePreviousPeriodRange(customSep, { useMsk: true });
    assert.ok(currCustom && prevCustom, 'Custom period ranges exist');
    assert.equal(prevCustom.end + 1, currCustom.start, 'Custom previous period ends exactly 1ms before current period start');
    assert.equal(prevCustom.end - prevCustom.start + 1, currCustom.end - currCustom.start + 1, 'Custom durations are exactly identical');
    assert.equal(prevCustom.from, '2026-09-01', 'Previous custom start date is 2026-09-01');
    assert.equal(prevCustom.to, '2026-09-09', 'Previous custom end date is 2026-09-09');
    assert.match(prevCustom.label, /01\.09\.2026.*09\.09\.2026/, 'Previous custom label reflects MSK dates');

    // 'all' period -> no preceding equal-length period
    assert.equal(finData.resolvePreviousPeriodRange('all'), null, 'all period has no previous period');
    assert.equal(finData.resolvePreviousPeriodRange(null), null, 'null period returns null');
}

// 2. Divide-by-Zero Protection (R13) and Neutral State
function testDivideByZeroProtection() {
    const finData = createFinanceData();
    assert.equal(typeof finData.formatKpiComparison, 'function', 'formatKpiComparison is exposed on FPTFinanceData');

    // previous = 0, current > 0 -> Never emit Infinity or NaN
    const zeroPrev = finData.formatKpiComparison(1500, 0);
    assert.equal(zeroPrev.available, false, 'zero baseline is marked unavailable');
    assert.equal(zeroPrev.diffPercent, null, 'diffPercent is null on zero baseline (no Infinity)');
    assert.equal(zeroPrev.formattedText, '—', 'formattedText is neutral dash');
    assert.equal(zeroPrev.badgeHtml, '', 'unavailable comparison does not render a placeholder badge');
    assert.doesNotMatch(zeroPrev.badgeHtml, /Infinity|NaN/, 'no Infinity or NaN in output');

    // previous = 0, current = 0
    const bothZero = finData.formatKpiComparison(0, 0);
    assert.equal(bothZero.available, false, '0 vs 0 is unavailable');
    assert.equal(bothZero.diffPercent, null);
    assert.equal(bothZero.formattedText, '—');

    // null or undefined or NaN previous
    const nullPrev = finData.formatKpiComparison(100, null);
    assert.equal(nullPrev.available, false);
    assert.equal(nullPrev.formattedText, '—');

    const nanPrev = finData.formatKpiComparison(100, NaN);
    assert.equal(nanPrev.available, false);
    assert.equal(nanPrev.formattedText, '—');

    // null or NaN current
    const nullCurr = finData.formatKpiComparison(null, 100);
    assert.equal(nullCurr.available, false);
    assert.equal(nullCurr.formattedText, '—');
}

// 3. Formatting, Direction, and Unicode Minus
function testFormattingAndUnicodeMinus() {
    const finData = createFinanceData();

    // Positive delta: +12.4%
    const pos = finData.formatKpiComparison(112.4, 100);
    assert.equal(pos.available, true);
    assert.equal(pos.direction, 'up');
    assert.equal(pos.diffPercent, 12.4);
    assert.equal(pos.formattedText, '+12.4% к пред. периоду');
    assert.match(pos.badgeHtml, /fpt-fin-diff-positive/, 'positive badge class');
    assert.match(pos.badgeHtml, /\+12\.4%/, 'includes positive sign');

    // Negative delta: -8.1% (must use Unicode minus \u2212)
    const neg = finData.formatKpiComparison(91.9, 100);
    assert.equal(neg.available, true);
    assert.equal(neg.direction, 'down');
    assert.equal(neg.diffPercent, -8.1);
    assert.equal(neg.formattedText, '\u22128.1% к пред. периоду');
    assert.ok(neg.formattedText.includes('\u2212'), 'Uses unicode minus character');
    assert.match(neg.badgeHtml, /fpt-fin-diff-negative/, 'negative badge class');
    assert.match(neg.badgeHtml, /\u22128\.1%/, 'badge includes unicode minus');

    // Neutral delta: 0.0%
    const zeroDelta = finData.formatKpiComparison(100, 100);
    assert.equal(zeroDelta.available, true);
    assert.equal(zeroDelta.direction, 'neutral');
    assert.equal(zeroDelta.diffPercent, 0);
    assert.equal(zeroDelta.formattedText, '0.0% к пред. периоду');
    assert.match(zeroDelta.badgeHtml, /fpt-fin-diff-neutral/);
}

// 4. Strict Currency Isolation (compareKpis)
function testStrictCurrencyIsolation() {
    const finData = createFinanceData();
    assert.equal(typeof finData.compareKpis, 'function', 'compareKpis is exposed on FPTFinanceData');

    // Case 1: Same currency (RUB) -> comparison succeeds
    const current1 = {
        salesAgg: {
            byCurrency: { RUB: 120000 },
            count: 12,
            averageCheck: { RUB: 10000 }
        },
        profitData: {
            byCurrency: {
                RUB: { realisedNetProfit: 30000 }
            }
        }
    };
    const previous1 = {
        salesAgg: {
            byCurrency: { RUB: 100000 },
            count: 10,
            averageCheck: { RUB: 10000 }
        },
        profitData: {
            byCurrency: {
                RUB: { realisedNetProfit: 20000 }
            }
        }
    };
    const diffs1 = finData.compareKpis(current1, previous1, { currency: 'RUB', primaryCurrency: 'RUB' });
    assert.ok(diffs1.revenue.available, 'Revenue comparison available for RUB');
    assert.equal(diffs1.revenue.diffPercent, 20.0, 'Revenue +20%');
    assert.equal(diffs1.orders.diffPercent, 20.0, 'Orders +20%');
    assert.equal(diffs1.averageCheck.diffPercent, 0.0, 'Average check 0%');
    assert.equal(diffs1.profit.diffPercent, 50.0, 'Profit +50%');

    // Case 2: Mismatched currencies without common currency -> isolation prevents comparison
    const current2 = {
        salesAgg: {
            byCurrency: { USD: 500 },
            count: 5,
            averageCheck: { USD: 100 }
        },
        profitData: {
            byCurrency: {
                USD: { realisedNetProfit: 150 }
            }
        }
    };
    const previous2 = {
        salesAgg: {
            byCurrency: { EUR: 400 },
            count: 4,
            averageCheck: { EUR: 100 }
        },
        profitData: {
            byCurrency: {
                EUR: { realisedNetProfit: 120 }
            }
        }
    };
    const diffs2 = finData.compareKpis(current2, previous2, { currency: 'all' });
    assert.equal(diffs2.revenue.available, false, 'Currency mismatch makes revenue comparison unavailable');
    assert.equal(diffs2.revenue.formattedText, '—', 'Shows neutral dash for mismatched currencies');
    assert.equal(diffs2.averageCheck.available, false, 'Average check unavailable across currencies');
    assert.equal(diffs2.profit.available, false, 'Profit unavailable across currencies');
    // Orders count is unitless and still comparable
    assert.equal(diffs2.orders.available, true, 'Orders count is unitless and comparable');
    assert.equal(diffs2.orders.diffPercent, 25.0, 'Orders count: 5 vs 4 is +25%');

    // Case 3: Empty previous period -> all monetary KPIs are unavailable neutral
    const diffs3 = finData.compareKpis(current1, null, { currency: 'RUB' });
    assert.equal(diffs3.revenue.available, false);
    assert.equal(diffs3.orders.available, false);
    assert.equal(diffs3.averageCheck.available, false);
    assert.equal(diffs3.profit.available, false);
}

// 5. Finance Hub Integration & DOM rendering
function testFinanceHubIntegration() {
    const env = createFinanceHub();
    assert.equal(typeof env.hub.resolvePreviousPeriodRange, 'function', 'Hub re-exports resolvePreviousPeriodRange');
    assert.equal(typeof env.hub.formatKpiComparison, 'function', 'Hub re-exports formatKpiComparison');
    assert.equal(typeof env.hub.compareKpis, 'function', 'Hub re-exports compareKpis');

    // Check that CSS contains KPI difference classes
    assert.match(cssSource, /\.fpt-fin-kpi-diff/, 'CSS defines .fpt-fin-kpi-diff');
    assert.match(cssSource, /\.fpt-fin-diff-positive/, 'CSS defines .fpt-fin-diff-positive');
    assert.match(cssSource, /\.fpt-fin-diff-negative/, 'CSS defines .fpt-fin-diff-negative');
    assert.match(cssSource, /\.fpt-fin-diff-neutral/, 'CSS defines .fpt-fin-diff-neutral');
    assert.match(cssSource, /\.fpt-fin-diff-value/, 'CSS defines .fpt-fin-diff-value');
    assert.match(cssSource, /\.fpt-fin-diff-label/, 'CSS defines .fpt-fin-diff-label');

    // Check that finance_hub.js has row 1 and subtab badges wired
    assert.match(financeHubOverviewSource, /fpt-fin-kpi-diff|diffs\.revenue|diffHtml/, 'Finance Hub markup includes KPI diff badges');
}

// 6. Zero-baseline fixtures (R13 in RISK_REGISTER.md)
function testZeroBaselineFixturesR13() {
    const finData = createFinanceData();

    const currentNonZero = {
        salesAgg: {
            byCurrency: { RUB: 50000 },
            count: 10,
            averageCheck: { RUB: 5000 }
        },
        profitData: {
            byCurrency: {
                RUB: { realisedNetProfit: 15000 }
            }
        }
    };

    const previousZero = {
        salesAgg: {
            byCurrency: { RUB: 0 },
            count: 0,
            averageCheck: { RUB: 0 }
        },
        profitData: {
            byCurrency: {
                RUB: { realisedNetProfit: 0 }
            }
        }
    };

    const diffs = finData.compareKpis(currentNonZero, previousZero, { currency: 'RUB', primaryCurrency: 'RUB' });

    // Assert that every single KPI returns unavailable neutral and never Infinity/NaN
    for (const kpiKey of ['revenue', 'orders', 'averageCheck', 'profit']) {
        const item = diffs[kpiKey];
        assert.ok(item, `${kpiKey} comparison result exists`);
        assert.equal(item.available, false, `${kpiKey} is unavailable on zero baseline`);
        assert.equal(item.diffPercent, null, `${kpiKey} diffPercent is null (no Infinity)`);
        assert.equal(item.formattedText, '—', `${kpiKey} formattedText is neutral dash`);
        assert.doesNotMatch(item.badgeHtml, /Infinity|NaN/, `${kpiKey} markup does not contain Infinity or NaN`);
        assert.equal(item.badgeHtml, '', `${kpiKey} does not render a meaningless unavailable badge`);
    }

    // Both periods zero
    const diffsBothZero = finData.compareKpis(previousZero, previousZero, { currency: 'RUB' });
    for (const kpiKey of ['revenue', 'orders', 'averageCheck', 'profit']) {
        const item = diffsBothZero[kpiKey];
        assert.equal(item.available, false, `Both zero: ${kpiKey} is unavailable`);
        assert.equal(item.diffPercent, null);
        assert.equal(item.formattedText, '—');
    }
}

// 7. Historical DB sales boundary filtering across current and previous periods
async function testHistoricalSalesBoundaryFiltering() {
    // Current range: 2026-09-10 to 2026-09-18 (MSK: 2026-09-09T21:00:00.000Z to 2026-09-18T20:59:59.999Z)
    // Previous range: 2026-09-01 to 2026-09-09 (MSK: 2026-08-31T21:00:00.000Z to 2026-09-09T20:59:59.999Z)
    const rawSales = [
        // Before previous period
        { orderId: 's-too-early', orderDate: '2026-08-31T20:59:59Z', orderStatus: 'closed', price: 100, currency: 'RUB' },
        // Inside previous period
        { orderId: 's-prev-start', orderDate: '2026-08-31T21:00:00Z', orderStatus: 'closed', price: 200, currency: 'RUB' },
        { orderId: 's-prev-end', orderDate: '2026-09-09T20:59:59Z', orderStatus: 'closed', price: 300, currency: 'RUB' },
        // Inside current period
        { orderId: 's-curr-start', orderDate: '2026-09-09T21:00:00Z', orderStatus: 'closed', price: 400, currency: 'RUB' },
        { orderId: 's-curr-end', orderDate: '2026-09-18T20:59:59Z', orderStatus: 'closed', price: 600, currency: 'RUB' },
        // After current period
        { orderId: 's-too-late', orderDate: '2026-09-18T21:00:00Z', orderStatus: 'closed', price: 700, currency: 'RUB' }
    ];

    const finData = createFinanceData(rawSales);
    const customPeriod = { from: '2026-09-10', to: '2026-09-18' };
    const prevPeriod = finData.resolvePreviousPeriodRange(customPeriod, { useMsk: true });

    const currOrders = await finData.getSales({ period: customPeriod, useMsk: true });
    const prevOrders = await finData.getSales({ period: prevPeriod, useMsk: true });

    assert.deepEqual(currOrders.map(o => o.orderId).sort(), ['s-curr-end', 's-curr-start'].sort(), 'Current period includes only current boundary orders');
    assert.deepEqual(prevOrders.map(o => o.orderId).sort(), ['s-prev-end', 's-prev-start'].sort(), 'Previous period includes only previous boundary orders');

    const currAgg = finData.aggregateSales(currOrders, { period: customPeriod, useMsk: true });
    const prevAgg = finData.aggregateSales(prevOrders, { period: prevPeriod, useMsk: true });

    assert.equal(currAgg.count, 2, 'Current count is 2');
    assert.equal(currAgg.byCurrency.RUB, 1000, 'Current revenue is 1000 RUB (400 + 600)');
    assert.equal(currAgg.averageCheck.RUB, 500, 'Current average check is 500 RUB');

    assert.equal(prevAgg.count, 2, 'Previous count is 2');
    assert.equal(prevAgg.byCurrency.RUB, 500, 'Previous revenue is 500 RUB (200 + 300)');
    assert.equal(prevAgg.averageCheck.RUB, 250, 'Previous average check is 250 RUB');

    const comparison = finData.compareKpis({ salesAgg: currAgg }, { salesAgg: prevAgg }, { currency: 'RUB' });
    assert.equal(comparison.revenue.diffPercent, 100.0, 'Revenue doubled (+100.0%)');
    assert.equal(comparison.revenue.direction, 'up');
    assert.equal(comparison.orders.diffPercent, 0.0, 'Orders count identical (0.0%)');
    assert.equal(comparison.orders.direction, 'neutral');
    assert.equal(comparison.averageCheck.diffPercent, 100.0, 'Average check doubled (+100.0%)');
}

// 8. Odd Custom Ranges (1-day, 3-day)
function testOddCustomRanges() {
    const finData = createFinanceData();

    // 1-day range: 2026-09-15 to 2026-09-15
    const oneDayCustom = { from: '2026-09-15', to: '2026-09-15' };
    const prevOneDay = finData.resolvePreviousPeriodRange(oneDayCustom, { useMsk: true });
    assert.equal(prevOneDay.from, '2026-09-14', 'Previous 1-day range start is 2026-09-14');
    assert.equal(prevOneDay.to, '2026-09-14', 'Previous 1-day range end is 2026-09-14');
    assert.equal(prevOneDay.end - prevOneDay.start + 1, 24 * 60 * 60 * 1000, 'Duration is exactly 1 MSK day');

    // 3-day range: 2026-09-15 to 2026-09-17 (Sep 15, 16, 17)
    const threeDayCustom = { from: '2026-09-15', to: '2026-09-17' };
    const prevThreeDay = finData.resolvePreviousPeriodRange(threeDayCustom, { useMsk: true });
    assert.equal(prevThreeDay.from, '2026-09-12', 'Previous 3-day range start is 2026-09-12');
    assert.equal(prevThreeDay.to, '2026-09-14', 'Previous 3-day range end is 2026-09-14');
    assert.equal(prevThreeDay.end - prevThreeDay.start + 1, 3 * 24 * 60 * 60 * 1000, 'Duration is exactly 3 MSK days');
}

async function runAll() {
    testExactPeriodBoundaries();
    testDivideByZeroProtection();
    testFormattingAndUnicodeMinus();
    testStrictCurrencyIsolation();
    testFinanceHubIntegration();
    testZeroBaselineFixturesR13();
    await testHistoricalSalesBoundaryFiltering();
    testOddCustomRanges();
    console.log('T12_PREVIOUS_PERIOD_KPI_COMPARISON_PASS');
}

runAll().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
