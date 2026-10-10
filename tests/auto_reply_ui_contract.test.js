// The autoresponder category is an empty shell in the static popup and is filled in at runtime by FPTAutoReplyPage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertEmptyCategory } = require('./helpers/empty_category_contract');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function loadPage() {
    const window = {};
    new Function('window', read('content/ui/popup_components.js'))(window);
    new Function('window', read('content/ui/auto_reply_page.js'))(window);
    return window.FPTAutoReplyPage;
}

test('auto_reply: static markup stays empty and search metadata remains', () => assertEmptyCategory('auto_reply'));

test('auto_reply: the category view is mounted into the existing popup shell', () => {
    assert.ok(read('content/content_script.js').includes('FPTAutoReplyPage'), 'the popup boot path mounts the autoresponder view');
    const manifest = JSON.parse(read('manifest.json'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    const scripts = content.js;
    assert.ok(scripts.includes('content/ui/auto_reply_page.js'), 'manifest loads the autoresponder page module');
    assert.ok(scripts.indexOf('content/ui/auto_reply_page.js') < scripts.indexOf('content/content_script.js'),
        'the module loads before the content script that mounts it');
    assert.ok(scripts.indexOf('content/ui/popup_components.js') < scripts.indexOf('content/ui/auto_reply_page.js'),
        'the shared popup components load first');
});

test('auto_reply: the page uses the shared frame, the store patch API and never writes the settings key itself', () => {
    const source = read('content/ui/auto_reply_page.js');
    assert.match(source, /ensureCategoryHeader\(page, 'Автоответчик'/);
    assert.ok(!/innerHTML/.test(source), 'the page builds DOM nodes instead of injecting HTML');
    assert.ok(!/storage\.local\.set/.test(source), 'writes go through fptPopupActions, never straight to storage');
    for (const key of ['fpToolsAutoReplies', 'greetingEnabled', 'greetingText', 'greetingImages', 'greetingSendOrder', 'onlyNewChats',
        'ignoreSystemMessages', 'greetingCooldownDays', 'newOrderReplyEnabled', 'newOrderReplyText', 'newOrderReplyImages',
        'newOrderReplySendOrder', 'orderConfirmReplyEnabled', 'orderConfirmReplyText', 'orderConfirmReplyImages',
        'orderConfirmReplySendOrder', 'keywordsEnabled', 'keywords']) {
        assert.ok(source.includes(`'${key}'`) || source.includes(`${key}:`), `${key} is still used`);
    }
    for (const action of ["'getSettings'", "'saveSettings'", "'addKeywordBtn'", "'updateListItem'", "'removeListItem'", "'handleImageAddClick'"]) {
        assert.ok(source.includes(action), `${action} is routed through fptPopupActions`);
    }
    assert.ok(!source.includes("'images_first'"), 'the engine only understands text_first and image_first');
    assert.ok(!/\{lotname\}|\$sleep/.test(source), 'variables the engine does not fill for these replies are not offered');
});

test('auto_reply: page-owned widgets do not reuse class names other pages are tested by', () => {
    // Every page lives in the same popup DOM, and the neighbouring browser tests look these up document-wide.
    const source = read('content/ui/auto_reply_page.js');
    for (const shared of ['fpt-ab-hero', 'fpt-ab-pill', 'fpt-ab-metric', 'fpt-th-', 'fpt-ad-search', 'fpt-fin-']) {
        assert.ok(!source.includes(shared), `${shared} belongs to another page`);
    }
});

test('auto_reply: styles are responsive, motion-safe and scoped to the themed popup', () => {
    const css = read('css/popup_categories.css');
    assert.match(css, /\.fpt-auto-reply\s*\{/);
    assert.match(css, /@container fpt-auto-reply \(max-width: 640px\)/);
    assert.match(css, /@container fpt-auto-reply \(max-width: 520px\)/);
    assert.match(css, /fpt-ar-card\[data-state="on"\]/);
    const section = css.slice(css.indexOf('/* Autoresponder screen'));
    assert.match(section, /prefers-reduced-motion: reduce[\s\S]*fpt-ar-collapse/, 'the card expansion is covered by the reduced-motion block');
    const rules = section.split('}').map(block => block.trim().split('{')[0]).filter(selector => /^[.@]/.test(selector));
    for (const selector of rules.filter(selector => selector.startsWith('.'))) {
        assert.ok(selector.split(',').every(part => /\.fp-tools-popup\.fptm-themed/.test(part)), `unscoped selector: ${selector}`);
    }
});

test('auto_reply: popup metadata keeps the searchable titles of every scenario', () => {
    const metadata = read('content/ui/popup_metadata.js');
    for (const title of ['Приветствие новых покупателей', 'Ответ на новый заказ', 'Ответ при подтверждении заказа', 'Ответы по ключевым словам']) {
        assert.ok(metadata.includes(title), `${title} is searchable`);
    }
});

test('auto_reply: settings are normalized with the engine defaults and malformed data is tolerated', () => {
    const page = loadPage();
    const empty = page.normalizeSettings(null);
    assert.equal(empty.greetingText, 'Здравствуйте! Чем могу помочь?');
    assert.equal(empty.greetingEnabled, false);
    assert.deepEqual(empty.keywords, []);
    assert.equal(empty.greetingSendOrder, 'text_first');
    const loaded = page.normalizeSettings({
        greetingEnabled: true, greetingCooldownDays: '400', newOrderReplyImages: ['data:a', 7, ''], newOrderReplySendOrder: 'images_first',
        keywords: [{ keyword: 'a' }, 'junk'], processedMessageIds: ['runtime'], keywordsEnabled: 'yes'
    });
    assert.equal(loaded.greetingEnabled, true);
    assert.equal(loaded.greetingCooldownDays, 365, 'the cooldown is clamped to a year');
    assert.deepEqual(loaded.newOrderReplyImages, ['data:a']);
    assert.equal(loaded.newOrderReplySendOrder, 'text_first', 'unknown send orders fall back to the engine default');
    assert.equal(loaded.keywords.length, 2, 'malformed entries keep their slot so list indexes stay valid');
    assert.equal(loaded.keywordsEnabled, false, 'only a real boolean enables a scenario');
    assert.equal('processedMessageIds' in loaded, false, 'runtime fields never reach the screen');
    assert.equal(page.countActiveScenarios(loaded), 1);
});

test('auto_reply: keyword rules are built the way the engine reads them', () => {
    const page = loadPage();
    assert.deepEqual(page.buildKeywordRule({ keyword: '  Привет ', response: ' Ответ ', matchMode: 'contains' }),
        { keyword: 'Привет', response: 'Ответ', matchMode: 'contains' });
    assert.deepEqual(page.buildKeywordRule({ keyword: 'a', response: '', images: ['data:x'], sendOrder: 'image_first' }),
        { keyword: 'a', response: '', matchMode: 'exact', images: ['data:x'], sendOrder: 'image_first' });
    const edited = page.buildKeywordRule({ keyword: 'a', response: 'text', images: [] }, { keyword: 'a', response: '', images: ['data:x'], sendOrder: 'image_first', note: 'keep' });
    assert.deepEqual(edited, { keyword: 'a', response: 'text', matchMode: 'exact', note: 'keep' }, 'removing the pictures drops their order and keeps unknown fields');
    assert.throws(() => page.buildKeywordRule({ keyword: '', response: 'x' }), /ключевое слово/);
    assert.throws(() => page.buildKeywordRule({ keyword: 'a', response: ' ' }), /текст ответа или изображение/);
});

test('auto_reply: duplicates, filtering and the summary text are computed from the stored rules', () => {
    const page = loadPage();
    const keywords = [{ keyword: 'Гарантия ', response: 'Да', matchMode: 'contains' }, 'junk', { keyword: 'доставка', response: 'Скоро', matchMode: 'exact' }];
    assert.equal(page.findDuplicateRule(keywords, { keyword: ' гарантия', matchMode: 'contains' }, -1), 0);
    assert.equal(page.findDuplicateRule(keywords, { keyword: 'гарантия', matchMode: 'exact' }, -1), -1, 'the same phrase in another mode is a different rule');
    assert.equal(page.findDuplicateRule(keywords, { keyword: 'гарантия', matchMode: 'contains' }, 0), -1, 'a rule is not its own duplicate');
    assert.deepEqual(page.filterKeywords(keywords, 'скоро').map(item => item.index), [2], 'filtering keeps the original list index');
    assert.equal(page.filterKeywords(keywords, '').length, 2, 'malformed entries are skipped when drawing');
    assert.equal(page.cooldownText(0), 'Один раз на чат');
    assert.equal(page.cooldownText(1), 'Через 1 день');
    assert.equal(page.cooldownText(3), 'Через 3 дня');
    assert.equal(page.cooldownText(11), 'Через 11 дней');
});

test('auto_reply: each scenario offers only variables the engine fills for it', () => {
    const page = loadPage();
    const byId = Object.fromEntries(page.SCENARIOS.map(scenario => [scenario.id, scenario.variables]));
    assert.ok(!byId.greeting.includes('{orderid}') && !byId.greeting.includes('{orderlink}'), 'a greeting has no order');
    assert.ok(byId.newOrder.includes('{orderlink}') && byId.orderConfirm.includes('{orderid}'));
    assert.ok(!page.KEYWORD_VARIABLES.includes('{orderid}'));
    const engine = read('background/autoresponder.js');
    for (const token of [...new Set([...page.KEYWORD_VARIABLES, ...byId.newOrder, ...byId.orderConfirm])]) {
        assert.ok(engine.includes(`/${token}/gi`), `${token} is substituted by the background engine`);
    }
});
