const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadPage() {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(path.join(root, 'content/ui/auto_delivery_page.js'), 'utf8'), context);
    return context.window.FPTAutoDeliveryPage;
}

test('auto-delivery preview splits messages on $sleep and fills template variables like the runtime', () => {
    const { previewDeliveryParts } = loadPage();
    const now = new Date(2026, 9, 5, 14, 30);
    const parts = previewDeliveryParts('{welcome} {buyername}!\n$sleep=2.5 Заказ {orderid}: {lotname}\n$sleep=3', 'Ключ Steam', now);
    assert.deepEqual(JSON.parse(JSON.stringify(parts)), [
        { type: 'message', text: 'Добрый день! Алексей!' },
        { type: 'pause', seconds: 2.5 },
        { type: 'message', text: 'Заказ AB12CD34: Ключ Steam' }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(previewDeliveryParts('Ссылка: {ORDERLINK} · {date}', 'Лот', now))), [
        { type: 'message', text: 'Ссылка: https://funpay.com/orders/AB12CD34/ · 05.10.2026 14:30' }
    ]);
    assert.equal(previewDeliveryParts('   $sleep=5  ', 'Лот', now).length, 0, 'pauses alone send nothing');
});

test('auto-delivery screen keeps the hero, lot cards and sticky save bar contracts, with no stock rules card', () => {
    const page = fs.readFileSync(path.join(root, 'content/ui/auto_delivery_page.js'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'css/popup_categories.css'), 'utf8');
    assert.match(page, /fpt-qr-hero fpt-ad-hero/);
    for (const id of ['fp-load-delivery-lots-btn', 'autoSaveDeliveryLot']) {
        assert.ok(page.includes(id), `missing ${id}`);
    }
    assert.doesNotMatch(page, /fpToolsAutoRestoreEnabled|fpToolsAutoDisableEnabled|Правила склада/);
    assert.match(styles, /\.fpt-ad-savebar \{[^}]*position:\s*sticky/s);
    assert.match(styles, /\.fpt-qr-metrics\.fpt-ad-metrics \{[^}]*repeat\(4,/s);
    assert.match(styles, /@container fpt-auto-delivery \(max-width:\s*600px\)[^@]*\.fpt-ad-lot-row \{ grid-template-columns: minmax\(0, 1fr\)/s);
    assert.doesNotMatch(styles, /fpt-ad-divider/);
});
