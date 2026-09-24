const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(root, 'content', 'features', 'finance_hub', 'potential.js'), 'utf8').replace(/\r\n/g, '\n');
const popup = fs.readFileSync(path.join(root, 'content', 'ui', 'main_popup.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(root, 'css', 'content_styles.css'), 'utf8').replace(/\r\n/g, '\n');

const toggleMatch = hub.match(/function setPotentialTableEmptyState\(pane, showEmpty, titleText, descriptionText, isError = false\)\s*\{[\s\S]*?\n\s{12}\}/);
assert.ok(toggleMatch, 'Potential table and its empty state must be toggled together');
const setPotentialTableEmptyState = new Function(`${toggleMatch[0]}; return setPotentialTableEmptyState;`)();
function fakeClassList(initial = []) {
    const values = new Set(initial);
    return {
        values,
        toggle(name, force) { if (force) values.add(name); else values.delete(name); },
        contains(name) { return values.has(name); }
    };
}
const tableWrap = { classList: fakeClassList() };
const empty = { classList: fakeClassList(['fpt-fin-control-hidden']), setAttribute(name, value) { this[name] = value; } };
const title = { textContent: '' };
const description = { textContent: '' };
const pane = { querySelector(selector) { return ({ '#fptFinPotTableWrap': tableWrap, '#fptFinPotEmptyState': empty, '#fptFinPotEmptyTitle': title, '#fptFinPotEmptyDescription': description })[selector] || null; } };

setPotentialTableEmptyState(pane, true, 'Нет активных предложений', 'Добавьте или активируйте лоты.');
assert.equal(tableWrap.classList.contains('fpt-fin-control-hidden'), true, 'empty inventory must hide the scroll wrapper');
assert.equal(empty.classList.contains('fpt-fin-control-hidden'), false, 'empty inventory must show its standalone state');
assert.equal(empty['aria-hidden'], 'false');
assert.equal(title.textContent, 'Нет активных предложений');
setPotentialTableEmptyState(pane, false, '', '');
assert.equal(tableWrap.classList.contains('fpt-fin-control-hidden'), false, 'populated results must show the table wrapper');
assert.equal(empty.classList.contains('fpt-fin-control-hidden'), true, 'populated results must hide the empty state');

assert.match(popup, /id="fptFinPotTableWrap"[\s\S]*?<table[\s\S]*?<\/table>\s*<\/div>\s*<div class="fpt-fin-empty-state[^>]*id="fptFinPotEmptyState"/, 'Potential empty state must be outside the table and its scroll wrapper');
assert.match(hub, /setPotentialTableEmptyState\(pane,\s*true[\s\S]*?tbody\.innerHTML = ''/, 'empty results must clear table rows and toggle the standalone state');
assert.match(hub, /setPotentialTableEmptyState\(pane,\s*false/, 'loading and populated results must reveal the table wrapper');

const donut = css.match(/\.fpt-fin-donut-wrap\s*\{[^}]*\}/);
const donutSvg = css.match(/\.fpt-fin-donut-svg\s*\{[^}]*\}/);
const donutLegend = css.match(/\.fpt-fin-donut-legend\s*\{[^}]*\}/);
assert.ok(donut && /overflow-x:\s*hidden/.test(donut[0]) && /min-width:\s*0/.test(donut[0]), 'donut container must clip horizontal overflow and be shrinkable');
assert.ok(donutSvg && /min-width:\s*0/.test(donutSvg[0]) && /max-width:\s*100%/.test(donutSvg[0]), 'donut SVG must shrink within its column');
assert.ok(donutLegend && /min-width:\s*0/.test(donutLegend[0]) && /overflow-x:\s*hidden/.test(donutLegend[0]), 'donut legend must shrink and clip its own horizontal overflow');
const legendRow = css.match(/\.fpt-fin-legend-row\s*\{[^}]*\}/);
const legendLabel = css.match(/\.fpt-fin-legend-label\s*\{[^}]*\}/);
const legendValue = css.match(/\.fpt-fin-legend-val\s*\{[^}]*\}/);
assert.ok(legendRow && /min-width:\s*0/.test(legendRow[0]), 'donut legend rows must be allowed to shrink below their contents');
assert.ok(legendLabel && /min-width:\s*0/.test(legendLabel[0]), 'donut legend labels must be allowed to shrink');
assert.ok(legendValue && /min-width:\s*0/.test(legendValue[0]) && /flex-shrink:\s*1/.test(legendValue[0]), 'donut legend values must shrink instead of forcing horizontal overflow');
assert.match(css, /\.fpt-fin-pot-table-wrap\s*\{[^}]*overflow-x:\s*auto/s, 'populated Potential table must keep its own horizontal scrolling');

console.log('T23_SCROLL_AND_EMPTY_STATE_CLEANUP_PASS');
