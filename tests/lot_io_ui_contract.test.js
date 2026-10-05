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

test('lot management view defines the hero, tool tiles, import card, empty state and narrow layouts', () => {
    assert.match(page, /fpt-qr-hero fpt-lot-hero/);
    for (const label of ['Резервная копия', 'Импорт из файла', 'Массовое редактирование']) assert.ok(page.includes(`'${label}'`), `missing tool ${label}`);
    assert.match(styles, /\.fpt-lot-action-band \{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(styles, /\.fpt-lot-tool--import\.is-dragover/);
    assert.match(styles, /\.fpt-lot-progress-fill--error/);
    assert.match(styles, /\.fpt-lot-import-card \{[^}]*min-height:\s*96px/s);
    assert.match(styles, /\.fpt-lot-empty \{[^}]*min-height:\s*68px/s);
    assert.match(styles, /@container fpt-category \(max-width:\s*760px\)/);
    assert.match(styles, /@container fpt-category \(max-width:\s*520px\)/);
    assert.match(styles, /@container fpt-lot-io \(max-width:\s*600px\)/);
    assert.doesNotMatch(styles, /fpt-lot-action-group|fpt-lot-separator/, 'the old grouped action band is gone');
});

test('lot import accepts a JSON file dropped on the import tile through the same path as the file picker', () => {
    assert.match(page, /fileInput\.addEventListener\('change', \(\) => startImport\(fileInput\.files\?\.\[0\]\)\)/);
    assert.match(page, /importTool\.addEventListener\('drop'/);
    assert.match(page, /startImport\(file\)/);
});
