const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'content/ui/lot_io_page.js'), 'utf8');
const components = fs.readFileSync(path.join(root, 'content/ui/popup_components.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/popup_categories.css'), 'utf8');

test('lot_io mounts its category view and keeps the existing action contracts', () => {
    assert.match(page, /ensureCategoryHeader\(page, 'Управление лотами'/);
    assert.match(page, /Текущий импорт/);
    assert.match(page, /Нет незавершённых импортов/);
    for (const action of [
        'lot-io-export-btn', 'lot-io-export-confirm', 'lot-io-import-btn',
        'lot-io-continue-btn', 'lot-io-postpone-btn', 'lot-io-cancel-btn',
        'fp-bulk-edit-btn', 'fp-bulk-apply-btn'
    ]) assert.ok(page.includes(action), `missing action ${action}`);
    assert.match(page, /fpt:lot-import-progress/);
});

test('lot_io reuses the shell category header and keeps the shared title track', () => {
    assert.match(components, /className = 'fpt-category-header'/);
    assert.match(page, /ensureCategoryHeader\(page, 'Управление лотами'/);
    assert.match(styles, /grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)\s+36px/);
    assert.match(styles, /font-size:\s*26px\s*!important;\s*font-weight:\s*600\s*!important;\s*line-height:\s*32px\s*!important/);
    assert.match(styles, /width:\s*36px;\s*height:\s*36px/);
});

test('lot management view defines compact controls, import card, empty state and narrow layouts', () => {
    assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s+minmax\(220px,\s*\.85fr\)/);
    assert.match(styles, /height:\s*48px/);
    assert.match(styles, /border-radius:\s*16px/);
    assert.match(styles, /fpt-lot-action-group-copy/);
    assert.match(styles, /min-height:\s*40px/);
    assert.match(styles, /min-height:\s*96px/);
    assert.match(styles, /min-height:\s*68px/);
    assert.match(styles, /@container fpt-category \(max-width:\s*760px\)/);
    assert.match(styles, /@container fpt-category \(max-width:\s*520px\)/);
});
