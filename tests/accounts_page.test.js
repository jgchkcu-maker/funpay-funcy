const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
    const ctx = vm.createContext({ window: {}, console, URL });
    const file = 'content/ui/accounts_page.js';
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, { filename: file });
    return ctx.window.FPTAccountsPage;
}

test('balances parse FunPay formats with spaces, commas and currency signs', () => {
    const page = load();
    assert.deepEqual({ ...page.parseBalance('1 234,50 ₽') }, { amount: 1234.5, currency: '₽' });
    assert.deepEqual({ ...page.parseBalance('12 480 ₽') }, { amount: 12480, currency: '₽' });
    assert.deepEqual({ ...page.parseBalance('$ 3.20') }, { amount: 3.2, currency: '$' });
    assert.equal(page.parseBalance(''), null);
    assert.equal(page.parseBalance('—'), null);
});

test('summary adds balances of one currency and counts unread and expired sessions', () => {
    const page = load();
    const summary = page.summarize([
        { balance: '12 480 ₽', unread: 3, _snapTs: 2000, loggedIn: true },
        { balance: '1 250,50 ₽', unread: 0, _snapTs: 1000 },
        { balance: '', unread: 'x', loggedIn: false }
    ]);
    assert.equal(summary.total, 3);
    assert.equal(summary.unread, 3);
    assert.equal(summary.expired, 1);
    assert.equal(summary.updatedAt, 1000, 'the oldest snapshot decides freshness');
    assert.equal(summary.balance.replace(/\s/g, ' '), '13 730,50 ₽');
    assert.equal(page.summarize([{ balance: '10 ₽' }, { balance: '5 $' }]).balance, 'разные валюты');
    assert.equal(page.summarize([]).balance, '');
    assert.equal(page.summarize(undefined).total, 0);
});

test('initials, relative time and avatar urls', () => {
    const page = load();
    assert.equal(page.initials('Outlik'), 'O');
    assert.equal(page.initials('Склад ключей'), 'СК');
    assert.equal(page.initials('key_store'), 'KS');
    assert.equal(page.initials(''), '?');
    const now = 10 * 24 * 3600 * 1000;
    assert.equal(page.formatAgo(0, now), '');
    assert.equal(page.formatAgo(now - 20000, now), 'только что');
    assert.equal(page.formatAgo(now - 12 * 60000, now), '12 мин назад');
    assert.equal(page.formatAgo(now - 3 * 3600000, now), '3 ч назад');
    assert.equal(page.formatAgo(now - 2 * 86400000, now), '2 дня назад');
    assert.equal(page.avatarUrl('/img/layout/avatar.png'), '', 'FunPay placeholder shows initials');
    assert.equal(page.avatarUrl('//sfunpay.com/s/avatar/ab/cd.jpg'), 'https://sfunpay.com/s/avatar/ab/cd.jpg');
    assert.equal(page.avatarUrl('javascript:alert(1)'), '');
});

test('pending money is summed per currency across accounts', () => {
    const page = load();
    const summary = page.summarize([
        { pending: { totals: { '₽': 3200 }, count: 4 } },
        { pending: { totals: { '₽': 800, '$': 2.5 }, count: 2 } },
        { balance: '10 ₽' }
    ]);
    assert.equal(summary.pending.replace(/\s/g, ' '), '4 000 ₽ + 2,50 $');
    assert.equal(summary.pendingCount, 6);
    assert.equal(page.summarize([{ balance: '1 ₽' }]).pending, '', 'no pending data yet');
    assert.equal(page.formatPending({ '₽': 0 }), '0 ₽');
    assert.equal(page.formatPending({}), '0 ₽');
});
