const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openAccounts } = require('./helpers/accounts_browser_harness');

const now = Date.now();
const ACCOUNTS = [
    { name: 'Outlik', key: 'key-main', balance: '12 480 ₽', unread: 3, _snapTs: now - 2 * 60000, loggedIn: true, username: 'Outlik',
        pending: { totals: { '₽': 3200 }, count: 4 } },
    { name: 'Склад ключей', key: 'key-store', balance: '1 250,50 ₽', unread: 0, _snapTs: now - 5 * 60000, loggedIn: true, username: 'KeyStorePro',
        pending: { totals: { '₽': 0 }, count: 0 } },
    { name: 'Старый аккаунт', key: 'key-old', balance: '', unread: 0, _snapTs: now - 10 * 60000, loggedIn: false }
];
const names = page => page.locator('.fpt-am-row .fpt-am-name').allTextContents();

test('accounts screen fits both themes and widths and never renders session keys', async () => {
    const browser = await launch();
    try {
        for (const dark of [false, true]) {
            for (const width of [1480, 900, 620]) {
                const { page, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS },
                    { dark, width, height: 1000, session: 'key-store', userName: 'KeyStorePro' });
                const overflow = await page.evaluate(() => {
                    const content = document.querySelector('.fp-tools-page-content[data-page="accounts"]');
                    return content.scrollWidth - content.clientWidth;
                });
                assert.ok(overflow <= 0, `no horizontal scroll (${dark ? 'dark' : 'light'}, ${width})`);
                assert.deepEqual(await names(page), ['Склад ключей', 'Outlik', 'Старый аккаунт'], 'active account first');
                const html = await page.locator('.fp-tools-popup').evaluate(popup => popup.outerHTML);
                assert.doesNotMatch(html, /key-main|key-store|key-old/);
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
    } finally { await browser.close(); }
});

test('hero, active row, unread badge and expired session reflect stored data', async () => {
    const browser = await launch();
    try {
        const { page, messages, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS }, { session: 'key-main', userName: 'Outlik' });
        assert.match(await page.locator('.fpt-am-hero .fpt-qr-pill').textContent(), /Вы в аккаунте Outlik/);
        const metrics = await page.locator('.fpt-am-hero .fpt-qr-metric-value').allTextContents();
        assert.deepEqual(metrics.map(value => value.replace(/\s/g, ' ')), ['3', '13 730,50 ₽', '3']);
        assert.equal(await page.locator('.fpt-am-current').isVisible(), false, 'current account is already saved');
        const active = page.locator('.fpt-am-row[data-active="true"]');
        assert.equal(await active.count(), 1);
        assert.equal(await active.locator('.fpt-am-unread').textContent(), '3');
        assert.equal(await active.getByRole('button', { name: 'Активен' }).isDisabled(), true);
        assert.equal(await page.locator('.fpt-am-row[data-expired="true"] .fpt-am-tag--expired').textContent(), 'link_offСессия истекла');
        assert.match(await page.locator('.fpt-am-row').nth(1).locator('.fpt-am-nick').textContent(), /KeyStorePro/);
        assert.match((await active.locator('.fpt-am-balance').textContent()).replace(/\s/g, ' '), /Доступно 12 480 ₽/);
        assert.match((await active.locator('.fpt-am-pending').textContent()).replace(/\s/g, ' '), /В ожидании 3 200 ₽ · 4 заказа/);
        assert.equal(await page.locator('.fpt-am-row').nth(1).locator('.fpt-am-pending').getAttribute('data-empty'), 'true');
        assert.equal(await page.locator('.fpt-am-row[data-expired="true"] .fpt-am-pending').count(), 0, 'no pending data yet');
        assert.equal((await page.locator('.fpt-am-metric-sub:not([hidden])').textContent()).replace(/\s/g, ' '), '+3 200 ₽ в ожидании');
        assert.equal(await page.locator('.fpt-qr-metric').filter({ hasText: 'Общий баланс' }).locator('.fpt-am-metric-sub').isVisible(), true);
        assert.equal((await messages()).filter(message => message.action === 'getAccountSnapshot').length, 0, 'fresh data is not refetched');
        assert.equal(await page.locator('.fpt-am-search').isVisible(), false, 'search appears from four accounts');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('empty list offers the current account and adding it saves the session', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, {}, { session: 'key-new', userName: 'NewSeller' });
        assert.equal(await page.locator('.fpt-am-empty').isVisible(), true);
        assert.match(await page.locator('.fpt-am-hero .fpt-qr-pill').textContent(), /NewSeller не сохранён/);
        assert.equal(await page.locator('#fptRefreshAccountsBtn').isVisible(), false);
        await page.locator('#addCurrentAccountBtn').click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts?.length === 1);
        assert.deepEqual((await state()).fpToolsAccounts, [{ name: 'NewSeller', key: 'key-new', username: 'NewSeller', loggedIn: true }]);
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-row').length === 1);
        assert.equal(await page.locator('.fpt-am-current').isVisible(), false);
        assert.equal(await page.locator('.fpt-am-row').getAttribute('data-active'), 'true');
        assert.match(await page.locator('.fpt-am-hero .fpt-qr-pill').textContent(), /Вы в аккаунте NewSeller/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('signed-out visitors see a hint instead of the add button', async () => {
    const browser = await launch();
    try {
        const { page } = await openAccounts(browser, {}, { session: '', userName: '' });
        assert.equal(await page.locator('#fpt-am-current-title').textContent(), 'Вы не вошли в FunPay');
        assert.equal(await page.locator('#addCurrentAccountBtn').isVisible(), false);
        assert.match(await page.locator('.fpt-am-hero .fpt-qr-pill').textContent(), /Вход не выполнен/);
    } finally { await browser.close(); }
});

test('switching sends the stored key and reports a rejected session', async () => {
    const browser = await launch();
    try {
        const { page, messages, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS },
            { session: 'key-main', userName: 'Outlik', switchReply: { success: false, error: 'cookie rejected' } });
        await page.getByRole('button', { name: 'Войти в Склад ключей' }).click();
        await page.waitForSelector('.fpt-popup-toast[data-kind="error"]');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Не удалось войти в «Склад ключей»: cookie rejected/);
        assert.equal(await page.getByRole('button', { name: 'Войти в Склад ключей' }).isDisabled(), false);

        await page.evaluate(() => { window.qaSwitchReply = { success: true }; });
        await page.getByRole('button', { name: 'Войти в Склад ключей' }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-am-row[data-active="true"] .fpt-am-name')?.textContent === 'Склад ключей');
        const sent = (await messages()).filter(message => message.action === 'setGoldenKey').map(message => message.key);
        assert.deepEqual(sent, ['key-store', 'key-store']);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('rename inline with Enter, cancel with Escape and delete through the dialog', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS }, { session: 'key-main', userName: 'Outlik' });
        await page.getByRole('button', { name: 'Переименовать Склад ключей' }).click();
        const input = page.getByRole('textbox', { name: 'Новое название аккаунта' });
        assert.equal(await input.inputValue(), 'Склад ключей');
        await input.fill('Ключи Steam');
        await input.press('Enter');
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[1].name === 'Ключи Steam');
        assert.deepEqual(await names(page), ['Outlik', 'Ключи Steam', 'Старый аккаунт']);
        assert.equal((await state()).fpToolsAccounts[1].key, 'key-store');

        await page.getByRole('button', { name: 'Переименовать Outlik' }).click();
        await page.getByRole('textbox', { name: 'Новое название аккаунта' }).fill('Другое');
        await page.getByRole('textbox', { name: 'Новое название аккаунта' }).press('Escape');
        assert.equal(await page.locator('.fpt-am-rename-input').count(), 0);
        assert.equal((await state()).fpToolsAccounts[0].name, 'Outlik');

        await page.getByRole('button', { name: 'Удалить Старый аккаунт' }).click();
        const dialog = page.locator('.fpt-lot-dialog');
        assert.match(await dialog.textContent(), /«Старый аккаунт» пропадёт из списка/);
        await dialog.getByRole('button', { name: 'Удалить' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts.length === 2);
        assert.equal(await page.locator('.fpt-lot-dialog').count(), 0);
        assert.deepEqual(await names(page), ['Outlik', 'Ключи Steam']);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('refresh updates every account in turn and stale data refreshes on open', async () => {
    const browser = await launch();
    try {
        const stale = ACCOUNTS.map(account => ({ ...account, _snapTs: now - 3 * 3600000 }));
        const snapshots = {
            'key-main': { username: 'Outlik', avatar: '', balance: '15 000 ₽', unread: 7, loggedIn: true, pending: { totals: { '₽': 500, '$': 2 }, count: 3 } },
            'key-store': { username: 'KeyStorePro', avatar: '', balance: '900 ₽', unread: 0, loggedIn: true }
        };
        const { page, state, messages, errors } = await openAccounts(browser, { fpToolsAccounts: stale },
            { session: 'key-main', userName: 'Outlik', snapshots });
        // Opening the page with hour-old data refreshes it once, without toasts.
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[0].balance === '15 000 ₽');
        await page.waitForFunction(() => !document.querySelector('#fptRefreshAccountsBtn').disabled);
        assert.equal((await state()).fpToolsAccounts[1].balance, '900 ₽');
        assert.equal(await page.locator('.fpt-am-row[data-active="true"] .fpt-am-unread').textContent(), '7');
        assert.equal(await page.locator('.fpt-popup-toast').count(), 0);
        assert.deepEqual((await state()).fpToolsAccounts[0].pending, { totals: { '₽': 500, '$': 2 }, count: 3 });
        assert.match((await page.locator('.fpt-am-row[data-active="true"] .fpt-am-pending').textContent()).replace(/\s/g, ' '), /500 ₽ \+ 2 \$ · 3 заказа/);

        await page.evaluate(() => { window.qaSnapshots['key-main'].balance = '16 000 ₽'; window.qaSnapshotDelay = 60; });
        await page.locator('#fptRefreshAccountsBtn').click();
        await page.waitForSelector('.fpt-am-row[data-busy="refresh"] .fpt-am-avatar-spinner');
        await page.waitForSelector('.fpt-popup-toast[data-kind="warning"]');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Не удалось обновить 1 аккаунт из 3/);
        assert.equal((await state()).fpToolsAccounts[0].balance, '16 000 ₽');
        assert.equal((await messages()).filter(message => message.action === 'getAccountSnapshot').length, 6);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('external storage changes re-render and a failed read can be retried', async () => {
    const browser = await launch();
    try {
        const { page, external, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS.slice(0, 1) },
            { session: 'key-main', userName: 'Outlik', failFirstRead: true });
        assert.equal(await page.locator('.fpt-accounts .fpt-qr-banner').isVisible(), true);
        await page.locator('.fpt-accounts .fpt-qr-banner').getByRole('button', { name: 'Повторить' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-row').length === 1);
        assert.equal(await page.locator('.fpt-accounts .fpt-qr-banner').isVisible(), false);

        await external({ fpToolsAccounts: [...ACCOUNTS, { name: 'Четвёртый', key: 'key-4', balance: '1 $' }] });
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-row').length === 4);
        assert.equal(await page.locator('.fpt-am-search').isVisible(), true);
        assert.equal(await page.locator('.fpt-am-hero .fpt-qr-metric-value').nth(1).textContent(), 'разные валюты');
        await page.locator('.fpt-am-search').fill('склад');
        assert.deepEqual(await names(page), ['Склад ключей']);
        await page.locator('.fpt-am-search').fill('нет такого');
        assert.equal(await page.locator('.fpt-am-empty').isVisible(), true);
        await page.locator('.fpt-am-empty').getByRole('button', { name: 'Сбросить поиск' }).click();
        assert.equal(await page.locator('.fpt-am-row').count(), 4);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('returning to the page refreshes data that went stale while it was closed', async () => {
    const browser = await launch();
    try {
        const snapshots = { 'key-main': { username: 'Outlik', balance: '99 ₽', unread: 0, loggedIn: true, pending: { totals: { '₽': 0 }, count: 0 } } };
        const { page, state, messages, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS.slice(0, 1) },
            { session: 'key-main', userName: 'Outlik', snapshots });
        const snapshotCalls = async () => (await messages()).filter(message => message.action === 'getAccountSnapshot').length;
        assert.equal(await snapshotCalls(), 0);
        await page.evaluate(() => window.fptOpenPopupPage('general'));
        await page.evaluate(() => window.fptOpenPopupPage('accounts'));
        assert.equal(await snapshotCalls(), 0, 'still fresh');

        await page.evaluate(() => window.fptOpenPopupPage('general'));
        await page.evaluate(() => {
            const accounts = window.qaStorage.read().fpToolsAccounts;
            accounts[0]._snapTs = Date.now() - 20 * 60000;
            window.qaStorage.external({ fpToolsAccounts: accounts });
        });
        await page.evaluate(() => window.fptOpenPopupPage('accounts'));
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[0].balance === '99 ₽');
        assert.equal(await snapshotCalls(), 1);
        assert.equal((await state()).fpToolsAccounts[0].pending.count, 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
