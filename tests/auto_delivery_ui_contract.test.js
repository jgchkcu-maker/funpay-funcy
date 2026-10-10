// Former auto_delivery_ui_contract view was retired for the empty category shell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');
test('auto_delivery: auto_delivery_ui_contract markup is removed and search metadata remains', () => assertEmptyCategory('auto_delivery'));

test('auto_delivery: the category view is mounted into the existing popup shell', () => {
    const source = fs.readFileSync(path.join(__dirname, '../content/content_script.js'), 'utf8');
    assert.ok(source.includes('FPTAutoDeliveryPage'), 'the existing popup boot path mounts the auto-delivery category view');
});

test('orders and deliveries mount as a separate popup category', () => {
    const boot = fs.readFileSync(path.join(__dirname, '../content/content_script.js'), 'utf8');
    const page = fs.readFileSync(path.join(__dirname, '../content/ui/auto_orders_page.js'), 'utf8');
    assert.ok(boot.includes('FPTAutoOrdersPage'), 'the popup boot path mounts the standalone orders page');
    assert.match(page, /const PAGE_ID = 'auto_orders'/);
    assert.match(page, /FPTOrdersView\.mount/);
});
