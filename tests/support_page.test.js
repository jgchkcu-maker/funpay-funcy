// The FunPay support category is an empty shell in the static popup and is filled in at runtime by FPTSupportPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function loadPage() {
    const window = {};
    new Function('window', read('content/ui/support_page.js'))(window);
    return window.FPTSupportPage;
}

test('support: static markup stays empty and search metadata remains', () => assertEmptyCategory('tickets'));

test('support: the category view is mounted into the existing popup shell', () => {
    assert.ok(read('content/content_script.js').includes('FPTSupportPage.mount(toolsPopup)'), 'the popup boot path mounts the support view');
    const manifest = JSON.parse(read('manifest.json'));
    const scripts = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js')).js;
    assert.ok(scripts.includes('content/ui/support_page.js'), 'manifest loads the support page module');
    assert.ok(scripts.indexOf('content/ui/support_page.js') < scripts.indexOf('content/content_script.js'),
        'the module loads before the content script that mounts it');
});

test('support: the page talks to support only through the registered popup actions', () => {
    const source = read('content/ui/support_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Поддержка FunPay'/);
    const registered = read('content/features/support.js');
    for (const action of ['fp-ticket-refresh-btn', 'fp-create-ticket-btn', 'getTicketFields', 'fp-new-ticket-submit',
        'fp-ticket-confirm-yes', 'openTicket', 'fp-ticket-reply-btn', 'closeTicket', 'fp-send-auto-ticket-btn']) {
        assert.ok(source.includes(`'${action}'`), `${action} is used by the page`);
        assert.ok(registered.includes(action), `${action} is registered in support.js`);
    }
    assert.ok(!/innerHTML/.test(source), 'comment HTML is rebuilt node by node, never injected');
    assert.ok(!/chrome\.(runtime\.sendMessage|storage\.local\.(get|set))/.test(source), 'network and storage go through popup actions');
    const metadata = read('content/ui/popup_metadata.js');
    assert.ok(!metadata.includes('"fp-tarm"'), 'the attachment action without an upload path is no longer advertised');
});

test('support: styles are scoped, responsive and respect reduced motion', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-sp\s*\{[^}]*container-name: fpt-support/);
    assert.match(css, /@container fpt-support \(max-width: 560px\)/);
    assert.match(css, /\.fpt-sp-dialog \[hidden\] \{ display: none !important; \}/, 'conditional form fields can hide inside the dialog');
    assert.match(css, /\.fpt-sp-composer-input\.fpt-control-field \{[^}]*max-height: 160px !important/, 'the reply box can grow past the shared textarea height');
    assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.fp-tools-popup\.fptm-themed \.fpt-sp \*/);
});

test('support: statuses are grouped by word stem', () => {
    const { statusKind } = loadPage();
    assert.equal(statusKind('Открыта'), 'open');
    assert.equal(statusKind('Открыт'), 'open');
    assert.equal(statusKind('В ожидании'), 'pending');
    assert.equal(statusKind('Решено'), 'solved');
    assert.equal(statusKind('Закрыта'), 'closed');
    assert.equal(statusKind(''), 'unknown');
    assert.equal(statusKind(undefined), 'unknown');
});

test('support: tickets are counted, filtered and sorted locally', () => {
    const { countTickets, filterTickets } = loadPage();
    const tickets = [
        { id: '20', title: 'Вывод средств', status: 'В ожидании', sortKey: 20 },
        { id: '35', title: 'Заказ не подтверждён', status: 'Открыта', sortKey: 35 },
        { id: '7', title: 'Лот', status: 'Решена', sortKey: 7 },
        { id: '12', title: 'Старый вопрос', status: 'Закрыта' }
    ];
    assert.deepEqual(countTickets(tickets), { all: 4, active: 2, solved: 2 });
    assert.deepEqual(countTickets(null), { all: 0, active: 0, solved: 0 });
    const ids = options => filterTickets(tickets, options).map(ticket => ticket.id);
    assert.deepEqual(ids({}), ['35', '20', '12', '7']);
    assert.deepEqual(ids({ sort: 'oldest_first' }), ['7', '12', '20', '35']);
    assert.deepEqual(ids({ sort: 'last_answered' }), ['20', '35', '7', '12'], 'server order is kept');
    assert.deepEqual(ids({ status: 'active' }), ['35', '20']);
    assert.deepEqual(ids({ status: 'solved' }), ['12', '7']);
    assert.deepEqual(ids({ query: '#3' }), ['35'], 'a leading # searches by number');
    assert.deepEqual(ids({ query: 'ВЫВОД' }), ['20']);
    assert.deepEqual(filterTickets(tickets, {}).length, 4);
    assert.equal(tickets[0].id, '20', 'the cached list is not reordered in place');
});

test('support: order request limits are clamped with safe defaults', () => {
    const { normalizeAuto, DEFAULT_AUTO } = loadPage();
    assert.deepEqual(normalizeAuto(undefined), { ...DEFAULT_AUTO });
    assert.deepEqual(normalizeAuto({ ageHours: '0', maxOrders: 99 }), { ageHours: 1, maxOrders: 20 });
    assert.deepEqual(normalizeAuto({ ageHours: 400, maxOrders: 'x' }), { ageHours: 168, maxOrders: 5 });
    assert.deepEqual(normalizeAuto({ ageHours: 36.4, maxOrders: 3 }), { ageHours: 36, maxOrders: 3 });
});

test('support: form conditions and order ages read as on the site', () => {
    const { evaluateCondition, formatAge } = loadPage();
    assert.equal(evaluateCondition(null, {}), true);
    assert.equal(evaluateCondition('{"type":"equals","fieldId":3,"value":2}', { 'ticket[fields][3]': '2' }), true);
    assert.equal(evaluateCondition('{"type":"equals","fieldId":3,"value":2}', { 'ticket[fields][3]': '1' }), false);
    assert.equal(evaluateCondition('not json', {}), false);
    assert.equal(formatAge(0.4), 'меньше часа');
    assert.equal(formatAge(30.5), '30 ч');
    assert.equal(formatAge(52), '2 дн');
    assert.equal(formatAge(null), '');
});

test('support: typed text is escaped before it becomes ticket HTML', () => {
    const source = read('background/background.js');
    const match = source.match(/function supportMessageHtml\(message\) \{[\s\S]*?\n\}/);
    assert.ok(match, 'the helper exists');
    const supportMessageHtml = new Function(`${match[0]}; return supportMessageHtml;`)();
    assert.equal(supportMessageHtml('Заказ <AB12CD34> & "срочно"'), '<p>Заказ &lt;AB12CD34&gt; &amp; &quot;срочно&quot;</p>');
    assert.equal(supportMessageHtml('Строка 1\nСтрока 2\n\nАбзац'), '<p>Строка 1<br>Строка 2</p><p>Абзац</p>');
    assert.ok(source.includes("params.set('ticket[comment][body_html]', supportMessageHtml(message))"));
    assert.ok(source.includes("params.set('add_comment[comment][body_html]', supportMessageHtml(message))"));
});

test('support: unconfirmed orders are filtered by age, oldest first', () => {
    const source = read('background/background.js');
    assert.match(source, /const due = orders\.filter\(order => order\.ageHours === null \|\| order\.ageHours >= minAgeHours\)/);
    assert.match(source, /youngerCount: orders\.length - due\.length/);
    const offscreen = read('offscreen/offscreen.js');
    assert.match(offscreen, /function parseOrdersPage\(html\)[\s\S]*?time: dateText \? parseFunPayDate\(dateText\) : null/);
});
