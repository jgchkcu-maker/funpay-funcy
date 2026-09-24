const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const popup = fs.readFileSync(path.join(ROOT, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const hub = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_hub.js'), 'utf8').replace(/\r\n/g, '\n');
const financeData = fs.readFileSync(path.join(ROOT, 'content', 'features', 'finance_data.js'), 'utf8').replace(/\r\n/g, '\n');

const customPeriodMarkup = popup.match(/<option value="custom">([^<]+)<\/option>/);
assert.ok(customPeriodMarkup, 'custom period option must remain present');
assert.equal(customPeriodMarkup[1], 'Произвольный период…', 'custom period option must be localized');

const customRangeStart = popup.indexOf('id="fptFinCustomRange"');
const customRangeEnd = popup.indexOf('</div>', customRangeStart);
assert.ok(customRangeStart >= 0 && customRangeEnd > customRangeStart, 'custom date range controls must remain present');
const customRangeMarkup = popup.slice(customRangeStart, customRangeEnd);
for (const label of ['С', 'По', 'Применить', 'Сбросить']) {
    assert.ok(customRangeMarkup.includes(`>${label}<`), `custom range must display the Russian label ${label}`);
}
assert.doesNotMatch(customRangeMarkup, /Custom date range|>From<|>To<|>Apply<|>Reset</, 'custom range must not expose English labels');

assert.ok(hub.includes('Начальная дата не может быть позже конечной.'), 'invalid date order must have Russian validation copy');
assert.doesNotMatch(hub, /Дата From не может быть позже даты To/, 'date validation must not expose English From/To labels');

const comparisonStart = financeData.indexOf('function formatKpiComparison(');
const comparisonEnd = financeData.indexOf('\n    function ', comparisonStart + 1);
assert.ok(comparisonStart >= 0 && comparisonEnd > comparisonStart, 'KPI comparison formatter must exist');
const comparisonCode = financeData.slice(comparisonStart, comparisonEnd);
assert.match(comparisonCode, /к пред\. периоду/, 'comparison suffix must remain Russian');
assert.doesNotMatch(comparisonCode, /vs previous period/, 'comparison suffix must not regress to English');

console.log('T19_FINANCE_UI_LOCALIZATION_PASS');
