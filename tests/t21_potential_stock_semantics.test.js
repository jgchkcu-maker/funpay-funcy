const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const potentialHub = fs.readFileSync(path.join(__dirname, '..', 'content', 'features', 'finance_hub', 'potential.js'), 'utf8').replace(/\r\n/g, '\n');
const overviewHub = fs.readFileSync(path.join(__dirname, '..', 'content', 'features', 'finance_hub', 'overview.js'), 'utf8').replace(/\r\n/g, '\n');

const breakdownMatch = potentialHub.match(/function getPotentialStockBreakdown\(lots, currency\)\s*\{[\s\S]*?\n\s{12}\}/);
assert.ok(breakdownMatch, 'stock breakdown helper must classify every active stock type');
const getPotentialStockBreakdown = new Function(`${breakdownMatch[0]}; return getPotentialStockBreakdown;`)();
assert.deepEqual(getPotentialStockBreakdown([
    { active: true, currency: 'RUB', stockKind: 'finite', stock: 4 },
    { active: true, currency: 'RUB', stockKind: 'finite', stock: 0 },
    { active: true, currency: 'RUB', stockKind: 'unknown', stock: null },
    { active: true, currency: 'RUB', stockKind: 'unlimited', stock: null },
    { active: false, currency: 'RUB', stockKind: 'finite', stock: 9 },
    { active: true, currency: 'USD', stockKind: 'finite', stock: 2 }
], 'RUB'), {
    totalActiveOffers: 4,
    availableOffers: 1,
    zeroStockOffers: 1,
    unknownStockOffers: 1,
    unlimitedStockOffers: 1
}, 'zero, positive, unknown, and unlimited stock must remain distinct');

const potentialCards = potentialHub.slice(potentialHub.indexOf('function renderPotentialCards('), potentialHub.indexOf('\n            function setPotentialTableEmptyState', potentialHub.indexOf('function renderPotentialCards(')));
assert.match(potentialCards, /totals\.totalActiveOffers/, 'Potential card must count every active offer');
assert.match(potentialCards, /getPotentialStockBreakdown\(filteredLots,\s*currency\)/, 'Potential breakdown must follow selected lot filters and currency');

const overviewCards = overviewHub.slice(overviewHub.indexOf('function renderOverviewRow2('), overviewHub.indexOf('\n            function renderOverviewDynamicChart', overviewHub.indexOf('function renderOverviewRow2(')));
assert.match(overviewCards, /potTotals\.totalActiveOffers/, 'Overview card must count every active offer');
assert.match(overviewCards, /getPotentialStockBreakdown\(lotsList,\s*potCurrency\)/, 'Overview breakdown must follow its lot selection and currency');
assert.match(potentialHub, /fpt-fin-badge-unknown[^>]*title="[^"]*(?:остат|запас|stock)[^"]*"[^>]*aria-label="/i, 'unknown stock table badge must explain the unknown value accessibly');

console.log('T21_POTENTIAL_STOCK_SEMANTICS_PASS');
