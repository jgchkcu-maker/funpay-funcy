const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../content/ui/auto_review_page.js'), 'utf8'), context);
const api = context.window.FPTAutoReviewPage;
const plain = value => JSON.parse(JSON.stringify(value));

test('defaults do not enable automation or invent user content', () => {
    const settings = api.normalizeSettings({ greetingEnabled: true, repliedOrderIds: ['123'] });
    assert.equal(settings.autoReviewEnabled, false);
    assert.equal(settings.bonusForReviewEnabled, false);
    assert.equal(settings.bonusForReviewDelaySec, 4);
    assert.equal(settings.reviewTemplates[5], '');
    assert.deepEqual(plain(settings.randomBonuses), []);
});

test('review patch merges only edited ratings and never writes runtime or bonus settings', () => {
    const base = api.normalizeSettings({ reviewTemplates: { 5: 'Спасибо!', 2: 'Поможем' }, repliedOrderIds: ['123'] });
    const draft = plain(base);
    draft.reviewTemplates[5] = 'Спасибо за покупку!';
    draft.reviewTemplateImages[3] = ['data:image/png;base64,AAA'];
    assert.deepEqual(plain(api.buildReviewPatch(base, draft)), {
        set: {}, merge: { reviewTemplates: { 5: 'Спасибо за покупку!' }, reviewTemplateImages: { 3: ['data:image/png;base64,AAA'] } }
    });
});

test('bonus operations keep indexes and expected values correct after multiple removals', () => {
    const base = ['Первый', 'Второй', 'Третий', 'Четвёртый'];
    const rows = [{ originalIndex: 1, text: 'Обновлённый' }, { originalIndex: 3, text: 'Четвёртый' }, { originalIndex: null, text: 'Новый' }];
    const ops = plain(api.buildBonusOperations(base, rows));
    const list = [...base];
    for (const op of ops) {
        if (op.op === 'append') list.push(op.value);
        else {
            assert.equal(list[op.index], op.expected);
            if (op.op === 'remove') list.splice(op.index, 1);
            else list[op.index] = op.value;
        }
    }
    assert.deepEqual(list, ['Обновлённый', 'Четвёртый', 'Новый']);
});

test('validation allows skipped ratings but not image-only enabled replies', () => {
    const s = api.normalizeSettings({ autoReviewEnabled: true, reviewTemplateImages: { 5: ['image'] } });
    assert.ok(api.validateReviews(s));
    s.reviewTemplates[2] = 'Поможем решить проблему';
    assert.equal(api.validateReviews(s), '');
    const b = api.normalizeSettings({ bonusForReviewEnabled: true, bonusMode: 'random' });
    assert.ok(api.validateBonuses(b, []));
    assert.equal(api.validateBonuses(b, [{ text: 'Бонус' }]), '');
    b.bonusForReviewDelaySec = '';
    assert.ok(api.validateBonuses(b, [{ text: 'Бонус' }]));
    b.bonusForReviewDelaySec = -1;
    assert.ok(api.validateBonuses(b, [{ text: 'Бонус' }]));
});

test('preview substitutes supported tokens and leaves arbitrary markup as plain text', () => {
    const text = api.previewText('{buyername}: {lotname}, {orderid}, {orderlink}, {welcome}, {date} <script>');
    assert.ok(!text.includes('{buyername}'));
    assert.ok(text.includes('https://funpay.com/orders/'));
    assert.ok(text.endsWith('<script>'));
});
