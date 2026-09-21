const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const financeDataSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');
const financeHubSource = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. СТАТИЧЕСКИЕ ПРОВЕРКИ КОНТРАКТА (T06)
// ─────────────────────────────────────────────────────────────────────────────

function runStaticContractChecks() {
    // 1. Helpers in finance_data.js
    assert.match(financeDataSource, /function getMskParts\(/, 'finance_data.js must define getMskParts');
    assert.match(financeDataSource, /function getMskDayKey\(/, 'finance_data.js must define getMskDayKey');
    assert.match(financeDataSource, /function getMskMonthKey\(/, 'finance_data.js must define getMskMonthKey');
    assert.match(financeDataSource, /function getMskWeekKey\(/, 'finance_data.js must define getMskWeekKey');
    assert.match(financeDataSource, /function formatMskDateTime\(/, 'finance_data.js must define formatMskDateTime');

    // 2. Integration in calculateSalesAggregation and calculateOperationsAggregation
    assert.match(financeDataSource, /const dayKey = getMskDayKey\(ts\);/, 'calculateSalesAggregation must use getMskDayKey');
    assert.match(financeDataSource, /const mk = getMskMonthKey\(ts\);/, 'calculateOperationsAggregation must use getMskMonthKey');
    assert.match(financeDataSource, /const dk = getMskDayKey\(ts\);/, 'calculateOperationsAggregation must use getMskDayKey');

    // 3. Integration in finance_hub.js
    assert.match(financeHubSource, /function getMskParts\(/, 'finance_hub.js must define or import getMskParts');
    assert.match(financeHubSource, /function getMskDayKey\(/, 'finance_hub.js must define or import getMskDayKey');
    assert.match(financeHubSource, /function getMskMonthKey\(/, 'finance_hub.js must define or import getMskMonthKey');
    assert.match(financeHubSource, /function getMskWeekKey\(/, 'finance_hub.js must define or import getMskWeekKey');
    assert.match(financeHubSource, /formatMskDateTime/, 'finance_hub.js must use formatMskDateTime');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ЗАГРУЗКА МОДУЛЕЙ В ИЗОЛИРОВАННОЙ СРЕДЕ (VM)
// ─────────────────────────────────────────────────────────────────────────────

function setupModules() {
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
            createElement: () => ({ style: {}, classList: { add() {}, remove() {} } })
        }
    };
    sandbox.window = sandbox;
    sandbox.root = sandbox;
    sandbox.self = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(financeDataSource, ctx, { filename: 'finance_data.js' });
    vm.runInContext(financeHubSource, ctx, { filename: 'finance_hub.js' });

    return {
        finData: ctx.FPTFinanceData,
        hub: ctx.fptFinanceHub || ctx.FPTFinanceHub
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ТЕСТОВЫЕ СЦЕНАРИИ
// ─────────────────────────────────────────────────────────────────────────────

function testMandatoryFixtures(finData, hub) {
    // Фикстура 1: 2026-09-20T20:59:59Z → 20.09.2026 23:59:59 MSK
    const f1Str = '2026-09-20T20:59:59Z';
    const f1Parts = finData.getMskParts(f1Str);
    assert.equal(f1Parts.year, 2026, 'F1 year');
    assert.equal(f1Parts.month, 9, 'F1 month');
    assert.equal(f1Parts.day, 20, 'F1 day must be 20 in MSK');
    assert.equal(f1Parts.hours, 23, 'F1 hours must be 23 in MSK');
    assert.equal(f1Parts.minutes, 59, 'F1 minutes');
    assert.equal(f1Parts.seconds, 59, 'F1 seconds');

    const f1Formatted = finData.formatMskDateTime(f1Str, true);
    assert.equal(f1Formatted, '20.09.2026 23:59:59', 'F1 formatMskDateTime with seconds');
    assert.equal(finData.getMskDayKey(f1Str), '2026-09-20', 'F1 dayKey must be 2026-09-20');
    assert.equal(finData.getMskMonthKey(f1Str), '2026-09', 'F1 monthKey must be 2026-09');

    // Проверяем то же самое через hub helpers
    assert.equal(hub.getMskDayKey(f1Str), '2026-09-20', 'hub.getMskDayKey F1');
    assert.equal(hub.formatMskDateTime(f1Str, true), '20.09.2026 23:59:59', 'hub.formatMskDateTime F1');

    // Фикстура 2: 2026-09-20T21:00:00Z → 21.09.2026 00:00:00 MSK
    const f2Str = '2026-09-20T21:00:00Z';
    const f2Parts = finData.getMskParts(f2Str);
    assert.equal(f2Parts.year, 2026, 'F2 year');
    assert.equal(f2Parts.month, 9, 'F2 month');
    assert.equal(f2Parts.day, 21, 'F2 day must be 21 in MSK');
    assert.equal(f2Parts.hours, 0, 'F2 hours must be 0 in MSK');
    assert.equal(f2Parts.minutes, 0, 'F2 minutes');
    assert.equal(f2Parts.seconds, 0, 'F2 seconds');

    const f2Formatted = finData.formatMskDateTime(f2Str, true);
    assert.equal(f2Formatted, '21.09.2026 00:00:00', 'F2 formatMskDateTime with seconds');
    assert.equal(finData.getMskDayKey(f2Str), '2026-09-21', 'F2 dayKey must be 2026-09-21');
    assert.equal(finData.getMskMonthKey(f2Str), '2026-09', 'F2 monthKey must be 2026-09');

    assert.equal(hub.getMskDayKey(f2Str), '2026-09-21', 'hub.getMskDayKey F2');
    assert.equal(hub.formatMskDateTime(f2Str, true), '21.09.2026 00:00:00', 'hub.formatMskDateTime F2');
}

function testSalesDailyGroupingAcrossMidnight(finData) {
    const orders = [
        {
            orderId: 'o1',
            orderDate: '2026-09-20T20:59:59Z', // 20.09.2026 23:59:59 MSK
            orderStatus: 'closed',
            price: 150,
            currency: 'RUB'
        },
        {
            orderId: 'o2',
            orderDate: '2026-09-20T21:00:00Z', // 21.09.2026 00:00:00 MSK
            orderStatus: 'closed',
            price: 250,
            currency: 'RUB'
        }
    ];

    const agg = finData.aggregateSales(orders);
    assert.ok(agg.byDay['2026-09-20'], '2026-09-20 bucket must exist');
    assert.ok(agg.byDay['2026-09-21'], '2026-09-21 bucket must exist');

    assert.equal(agg.byDay['2026-09-20'].count, 1, 'o1 must fall into 2026-09-20');
    assert.ok(Math.abs(agg.byDay['2026-09-20'].revenue - 150) < 0.001, 'revenue for 2026-09-20');

    assert.equal(agg.byDay['2026-09-21'].count, 1, 'o2 must fall into 2026-09-21');
    assert.ok(Math.abs(agg.byDay['2026-09-21'].revenue - 250) < 0.001, 'revenue for 2026-09-21');
}

function testOperationsGroupingByDayAndMonth(finData) {
    const txns = [
        // 30 сентября 23:59:59 MSK
        {
            id: 't1',
            date: '2026-09-30T20:59:59Z',
            status: 'complete',
            signed: 100,
            currency: 'RUB'
        },
        // 1 октября 00:00:00 MSK
        {
            id: 't2',
            date: '2026-09-30T21:00:00Z',
            status: 'complete',
            signed: 200,
            currency: 'RUB'
        }
    ];

    const agg = finData.aggregateOperations(txns);

    // Day grouping
    assert.ok(agg.byDay['2026-09-30'], 'byDay 2026-09-30 exists');
    assert.equal(agg.byDay['2026-09-30'].in, 100);
    assert.ok(agg.byDay['2026-10-01'], 'byDay 2026-10-01 exists');
    assert.equal(agg.byDay['2026-10-01'].in, 200);

    // Month grouping
    assert.ok(agg.byMonth['2026-09'], 'byMonth 2026-09 exists');
    assert.equal(agg.byMonth['2026-09'].in, 100);
    assert.ok(agg.byMonth['2026-10'], 'byMonth 2026-10 exists');
    assert.equal(agg.byMonth['2026-10'].in, 200);
}

function testMskWeeklyGrouping(finData, hub) {
    // Вторник 2026-09-22 15:00:00 MSK
    const tue = '2026-09-22T12:00:00Z';
    assert.equal(finData.getMskWeekKey(tue), '2026-09-21', 'Tuesday week key is Monday 2026-09-21');
    assert.equal(hub.getMskWeekKey(tue), '2026-09-21', 'hub Tuesday week key');

    // Воскресенье 2026-09-27 23:59:59 MSK
    const sun = '2026-09-27T20:59:59Z';
    assert.equal(finData.getMskWeekKey(sun), '2026-09-21', 'Sunday 23:59:59 MSK belongs to 2026-09-21 week');

    // Следующий понедельник 00:00:00 MSK (UTC: 2026-09-27T21:00:00Z)
    const nextMon = '2026-09-27T21:00:00Z';
    assert.equal(finData.getMskWeekKey(nextMon), '2026-09-28', 'Next Monday starts week 2026-09-28');
}

function testMskPeriodBoundaries(finData) {
    // Зададим фиксированное время 'now': 21.09.2026 01:30:00 MSK (UTC: 2026-09-20T22:30:00Z)
    const now = Date.parse('2026-09-20T22:30:00Z');

    const todayRange = finData.resolvePeriodRange('today', { now, useMsk: true });
    // Полночь 21.09.2026 00:00:00 MSK соответствует 2026-09-20T21:00:00Z
    const expectedTodayMidnight = Date.parse('2026-09-20T21:00:00Z');
    assert.equal(todayRange.start, expectedTodayMidnight, 'today start must be MSK midnight in UTC ms');

    const yesterdayRange = finData.resolvePeriodRange('yesterday', { now, useMsk: true });
    const expectedYesterdayMidnight = Date.parse('2026-09-19T21:00:00Z');
    assert.equal(yesterdayRange.start, expectedYesterdayMidnight, 'yesterday start must be previous MSK midnight');
    assert.equal(yesterdayRange.end, expectedTodayMidnight, 'yesterday end must be today MSK midnight');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ТОЧКА ВХОДА
// ─────────────────────────────────────────────────────────────────────────────

function main() {
    runStaticContractChecks();
    const { finData, hub } = setupModules();

    testMandatoryFixtures(finData, hub);
    testSalesDailyGroupingAcrossMidnight(finData);
    testOperationsGroupingByDayAndMonth(finData);
    testMskWeeklyGrouping(finData, hub);
    testMskPeriodBoundaries(finData);

    console.log('T06_SINGLE_MSK_CALENDAR_MODEL_PASS');
}

main();
