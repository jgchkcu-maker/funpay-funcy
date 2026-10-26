const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openAccounts } = require('./helpers/accounts_browser_harness');

const now = Date.now();
// Stored in the old format (keys inside the records): the service moves them out on start.
const ACCOUNTS = [
    { name: 'Outlik', key: 'key-main', userId: '1', balance: '12 480 ₽', unread: 3, _snapTs: now - 2 * 60000, loggedIn: true, username: 'Outlik',
        pending: { totals: { '₽': 3200 }, count: 4 },
        funds: { available: { '₽': 9000, '$': null, '€': null }, total: { '₽': 12480, '$': null, '€': null } } },
    { name: 'Склад ключей', key: 'key-store', userId: '2', balance: '1 250,50 ₽', unread: 0, _snapTs: now - 5 * 60000, loggedIn: true, username: 'KeyStorePro',
        pending: { totals: { '₽': 0 }, count: 0 } },
    { name: 'Старый аккаунт', key: 'key-old', userId: '3', balance: '', unread: 0, _snapTs: now - 10 * 60000, loggedIn: false }
];
// key-old is not known to FunPay any more: its session expired.
const USERS = { 'key-main': { id: '1', name: 'Outlik' }, 'key-store': { id: '2', name: 'KeyStorePro' } };
const names = page => page.locator('.fpt-am-row .fpt-am-name').allTextContents();
const main = (extra = {}) => ({ session: 'key-main', userName: 'Outlik', users: USERS, ...extra });

test('accounts screen fits both themes and widths and never renders or stores session keys', async () => {
    const browser = await launch();
    try {
        for (const dark of [false, true]) {
            for (const width of [1480, 900, 620]) {
                const { page, state, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS },
                    { dark, width, height: 1000, session: 'key-store', userName: 'KeyStorePro', users: USERS });
                const overflow = await page.evaluate(() => {
                    const content = document.querySelector('.fp-tools-page-content[data-page="accounts"]');
                    return content.scrollWidth - content.clientWidth;
                });
                assert.ok(overflow <= 0, `no horizontal scroll (${dark ? 'dark' : 'light'}, ${width})`);
                assert.deepEqual(await names(page), ['Склад ключей', 'Outlik', 'Старый аккаунт'], 'active account first');
                const html = await page.locator('.fp-tools-popup').evaluate(popup => popup.outerHTML);
                assert.doesNotMatch(html, /key-main|key-store|key-old/);
                assert.doesNotMatch(JSON.stringify((await state()).fpToolsAccounts), /key-main|key-store|key-old/, 'keys moved out of storage');
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
    } finally { await browser.close(); }
});

test('hero, active row, unread badge and expired session reflect stored data', async () => {
    const browser = await launch();
    try {
        const { page, snapshotCalls, external, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS }, main());
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
        assert.match((await active.locator('.fpt-am-balance').textContent()).replace(/\s/g, ' '), /Баланс 12 480 ₽/);
        assert.match((await active.locator('.fpt-am-pending').textContent()).replace(/\s/g, ' '), /В ожидании 3 200 ₽ · 4 заказа/);
        assert.equal(await page.locator('.fpt-am-row').nth(1).locator('.fpt-am-pending').getAttribute('data-empty'), 'true');
        assert.match((await active.locator('.fpt-am-available').textContent()).replace(/\s/g, ' '), /Доступно 9 000 ₽/);
        assert.equal(await page.locator('.fpt-am-row').nth(1).locator('.fpt-am-available').count(), 0, 'no funds data or equal to the balance');
        assert.equal(await page.locator('.fpt-am-row[data-expired="true"] .fpt-am-pending').count(), 0, 'no pending data yet');
        const accounts = await page.evaluate(() => window.qaStorage.read().fpToolsAccounts);
        accounts[2].balance = 'Финансы';
        await external({ fpToolsAccounts: accounts });
        await page.waitForFunction(() => document.querySelector('.fpt-am-row[data-expired="true"] .fpt-am-balance')?.textContent.includes('неизвестен'));
        assert.equal((await page.locator('.fpt-am-metric-sub:not([hidden])').textContent()).replace(/\s/g, ' '), '+3 200 ₽ в ожидании');
        assert.equal(await snapshotCalls(), 0, 'fresh data is not refetched');
        assert.equal(await page.locator('.fpt-am-search').isVisible(), false, 'search appears from four accounts');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('empty list offers the current account and adding it saves the session without the key', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, {}, { session: 'key-new', userName: 'NewSeller', users: { 'key-new': { id: '77', name: 'NewSeller' } } });
        assert.equal(await page.locator('.fpt-am-empty').isVisible(), true);
        assert.match(await page.locator('.fpt-am-hero .fpt-qr-pill').textContent(), /NewSeller не сохранён/);
        assert.equal(await page.locator('#fptRefreshAccountsBtn').isVisible(), false);
        await page.locator('#addCurrentAccountBtn').click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts?.length === 1);
        const [saved] = (await state()).fpToolsAccounts;
        assert.match(saved.id, /^acc_[0-9a-f]{16}$/);
        assert.deepEqual({ ...saved, id: undefined }, { id: undefined, userId: '77', name: 'NewSeller', username: 'NewSeller', note: '', loggedIn: true });
        assert.equal(await page.evaluate(id => window.qaVault.getSecret(id).then(secret => secret.key), saved.id), 'key-new');
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

test('a signed-in account with an expired saved session can refresh it in place', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS },
            { session: 'key-old-2', userName: 'Old', users: { ...USERS, 'key-old-2': { id: '3', name: 'Old' } } });
        assert.equal(await page.locator('.fpt-am-row[data-active="true"] .fpt-am-name').textContent(), 'Старый аккаунт');
        assert.equal(await page.locator('#fpt-am-current-title').textContent(), 'Обновите сессию «Старый аккаунт»');
        assert.match(await page.locator('#addCurrentAccountBtn').textContent(), /Обновить сессию/);
        await page.locator('#addCurrentAccountBtn').click();
        await page.waitForSelector('.fpt-popup-toast');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Сессия «Старый аккаунт» обновлена/);
        const accounts = (await state()).fpToolsAccounts;
        assert.equal(accounts.length, 3, 'no duplicate record');
        assert.equal(accounts[2].loggedIn, true);
        assert.equal(await page.evaluate(id => window.qaVault.getSecret(id).then(secret => secret.key), accounts[2].id), 'key-old-2');
        assert.equal(await page.locator('.fpt-am-current').isVisible(), false);
        assert.equal(await page.locator('.fpt-am-tag--expired').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('switching asks first, moves each account to its own config and rolls back an expired session', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, {
            fpToolsAccounts: ACCOUNTS, fpToolsAutoReplies: { greetingEnabled: true, greetingText: 'Привет' }, fpToolsBlacklist: [{ username: 'spam' }]
        }, main({ automation: true }));
        await page.getByRole('button', { name: 'Войти в Склад ключей' }).click();
        const dialog = page.locator('.fpt-am-switch-dialog');
        await dialog.waitFor();
        assert.match(await dialog.textContent(), /Автоматизация «Outlik» остановится/);
        assert.match(await dialog.textContent(), /ещё нет своих настроек/);
        await dialog.getByRole('button', { name: 'Отмена' }).click();
        assert.equal(await page.evaluate(() => window.qaSession), 'key-main', 'cancel keeps the session');

        await page.getByRole('button', { name: 'Войти в Склад ключей' }).click();
        await dialog.getByRole('button', { name: 'Войти' }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-am-row[data-active="true"] .fpt-am-name')?.textContent === 'Склад ключей');
        let stored = await state();
        assert.equal(await page.evaluate(() => window.qaSession), 'key-store');
        assert.equal(await page.evaluate(() => window.qaReloads), 1, 'FunPay tabs reload');
        assert.equal(stored.fpToolsProfileOwner.accountId, '2');
        assert.deepEqual(stored.fpToolsAutoReplies, {}, 'automation of Outlik is off');
        assert.equal(stored.fpToolsBlacklist, undefined);
        await page.waitForSelector('.fpt-am-notice:not([hidden])');
        assert.match(await page.locator('.fpt-am-notice').textContent(), /У аккаунта «Склад ключей» стандартные настройки/);
        assert.match(await page.locator('.fpt-am-row').filter({ hasText: 'Outlik' }).locator('.fpt-am-tag--auto').textContent(), /Автоматизация/);

        await page.evaluate(() => { window.qaAutomation = false; });
        await page.getByRole('button', { name: 'Войти в Outlik' }).click();
        await dialog.waitFor();
        assert.match(await dialog.textContent(), /У «Outlik» включена автоматизация/);
        await dialog.getByRole('button', { name: 'Войти' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsProfileOwner?.accountId === '1');
        stored = await state();
        assert.equal(stored.fpToolsAutoReplies.greetingText, 'Привет');
        assert.equal(stored.fpToolsAutoReplies.greetingEnabled, true);
        assert.deepEqual(stored.fpToolsBlacklist, [{ username: 'spam' }]);

        await page.getByRole('button', { name: 'Войти в Старый аккаунт' }).click();
        await page.locator('.fpt-am-switch-dialog').getByRole('button', { name: 'Войти' }).click();
        await page.waitForSelector('.fpt-popup-toast[data-kind="error"]');
        assert.match(await page.locator('.fpt-popup-toast[data-kind="error"]').textContent(), /Сессия истекла/);
        assert.equal(await page.evaluate(() => window.qaSession), 'key-main');
        stored = await state();
        assert.equal(stored.fpToolsProfileOwner.accountId, '1');
        assert.equal(stored.fpToolsAutoReplies.greetingEnabled, true, 'config of Outlik is back after the rollback');
        assert.equal(await page.getByRole('button', { name: 'Войти в Старый аккаунт' }).isDisabled(), false);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('a plain switch between configured accounts without automation stays one click', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS }, main({ profiles: { 2: { fpToolsBlacklist: [] } } }));
        await page.getByRole('button', { name: 'Войти в Склад ключей' }).click();
        await page.waitForFunction(() => window.qaSession === 'key-store');
        assert.equal(await page.locator('.fpt-am-switch-dialog').count(), 0);
        await page.waitForSelector('.fpt-popup-toast');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Переключаюсь на «Склад ключей»/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('rename inline with Enter, cancel with Escape and delete through the dialog', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS }, main());
        await page.getByRole('button', { name: 'Переименовать Склад ключей' }).click();
        const input = page.getByRole('textbox', { name: 'Новое название аккаунта' });
        assert.equal(await input.inputValue(), 'Склад ключей');
        await input.fill('Ключи Steam');
        await input.press('Enter');
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[1].name === 'Ключи Steam');
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-rename-input').length === 0);
        assert.deepEqual(await names(page), ['Outlik', 'Ключи Steam', 'Старый аккаунт']);

        await page.getByRole('button', { name: 'Переименовать Outlik' }).click();
        await page.getByRole('textbox', { name: 'Новое название аккаунта' }).fill('Другое');
        await page.getByRole('textbox', { name: 'Новое название аккаунта' }).press('Escape');
        assert.equal(await page.locator('.fpt-am-rename-input').count(), 0);
        assert.equal((await state()).fpToolsAccounts[0].name, 'Outlik');

        await page.getByRole('button', { name: 'Удалить Старый аккаунт' }).click();
        const dialog = page.locator('.fpt-lot-dialog');
        assert.match(await dialog.textContent(), /«Старый аккаунт» пропадёт из списка/);
        assert.match(await dialog.textContent(), /настройки Funcy сохранятся/);
        await dialog.getByRole('button', { name: 'Удалить' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts.length === 2);
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-row').length === 2);
        assert.equal(await page.locator('.fpt-lot-dialog').count(), 0);
        assert.deepEqual(await names(page), ['Outlik', 'Ключи Steam']);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('notes are written inline, shown under the name and found by search', async () => {
    const browser = await launch();
    try {
        const extra = { name: 'Четвёртый', key: 'key-4', userId: '4', balance: '1 ₽' };
        const { page, state, errors } = await openAccounts(browser, { fpToolsAccounts: [...ACCOUNTS, extra] }, main());
        await page.getByRole('button', { name: 'Заметка к Склад ключей' }).click();
        const note = page.getByRole('textbox', { name: 'Заметка к аккаунту' });
        await note.fill('Ключи Steam\nвывод по пятницам');
        assert.match(await page.locator('.fpt-am-note-counter').textContent(), /^29\/500$/);
        await note.press('Control+Enter');
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[1].note === 'Ключи Steam\nвывод по пятницам');
        await page.waitForSelector('.fpt-am-row .fpt-am-note');
        assert.match(await page.locator('.fpt-am-row').nth(1).locator('.fpt-am-note').textContent(), /вывод по пятницам/);

        await page.getByRole('button', { name: 'Заметка к Outlik' }).click();
        await page.getByRole('textbox', { name: 'Заметка к аккаунту' }).fill('черновик');
        await page.getByRole('textbox', { name: 'Заметка к аккаунту' }).press('Escape');
        assert.equal((await state()).fpToolsAccounts[0].note, undefined);

        await page.locator('.fpt-am-search').fill('пятниц');
        assert.deepEqual(await names(page), ['Склад ключей']);
        await page.locator('.fpt-am-search').fill('');

        await page.getByRole('button', { name: 'Заметка к Склад ключей' }).click();
        await page.getByRole('textbox', { name: 'Заметка к аккаунту' }).fill('');
        await page.locator('.fpt-am-note-save').click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[1].note === '');
        await page.waitForFunction(() => !document.querySelector('.fpt-am-row .fpt-am-note'));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('refresh updates every account in turn, failures keep their old time and stale data refreshes on open', async () => {
    const browser = await launch();
    try {
        const stale = ACCOUNTS.map(account => ({ ...account, _snapTs: now - 3 * 3600000 }));
        const snapshots = {
            'key-main': { userId: '1', username: 'Outlik', avatar: '', balance: '15 000 ₽', unread: 7, loggedIn: true, pending: { totals: { '₽': 500, '$': 2 }, count: 3 } },
            'key-store': { userId: '2', username: 'KeyStorePro', avatar: '', balance: '900 ₽', unread: 0, loggedIn: true }
        };
        const { page, state, snapshotCalls, errors } = await openAccounts(browser, { fpToolsAccounts: stale }, main({ snapshots }));
        // Opening the page with hour-old data refreshes it once, without toasts.
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[0].balance === '15 000 ₽');
        await page.waitForFunction(() => !document.querySelector('#fptRefreshAccountsBtn').disabled);
        // «Обновить» uses the shared toolbar button: same size as on the other category pages.
        assert.deepEqual(await page.locator('#fptRefreshAccountsBtn').evaluate(el => {
            const css = getComputedStyle(el);
            return [Math.round(el.getBoundingClientRect().height), css.borderTopLeftRadius, css.fontSize];
        }), [40, '12px', '14px']);
        assert.equal((await state()).fpToolsAccounts[1].balance, '900 ₽');
        assert.equal(await page.locator('.fpt-am-row[data-active="true"] .fpt-am-unread').textContent(), '7');
        assert.equal(await page.locator('.fpt-popup-toast').count(), 0);
        assert.deepEqual((await state()).fpToolsAccounts[0].pending, { totals: { '₽': 500, '$': 2 }, count: 3 });
        assert.match((await page.locator('.fpt-am-row[data-active="true"] .fpt-am-pending').textContent()).replace(/\s/g, ' '), /500 ₽ \+ 2 \$ · 3 заказа/);
        const old = (await state()).fpToolsAccounts[2];
        assert.equal(old._snapTs, now - 3 * 3600000, 'a failed refresh does not look like fresh data');
        assert.equal(old.refresh.status, 'failed');
        assert.match(await page.locator('.fpt-am-row').nth(2).locator('.fpt-am-tag--failed').textContent(), /Ошибка обновления/);

        await page.evaluate(() => { window.qaSnapshots['key-main'].balance = '16 000 ₽'; window.qaSnapshotDelay = 60; });
        await page.locator('#fptRefreshAccountsBtn').click();
        await page.waitForSelector('.fpt-am-row[data-busy="refresh"] .fpt-am-avatar-spinner');
        await page.waitForSelector('.fpt-popup-toast[data-kind="warning"]');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Не удалось обновить 1 аккаунт из 3/);
        assert.equal((await state()).fpToolsAccounts[0].balance, '16 000 ₽');
        assert.equal(await snapshotCalls(), 6);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('while automation runs other accounts are not refreshed and say so instead of failing', async () => {
    const browser = await launch();
    try {
        const stale = ACCOUNTS.map(account => ({ ...account, _snapTs: now - 3 * 3600000 }));
        const snapshots = { 'key-main': { userId: '1', username: 'Outlik', balance: '15 000 ₽', unread: 0, loggedIn: true } };
        const { page, state, snapshotCalls, errors } = await openAccounts(browser, { fpToolsAccounts: stale }, main({ snapshots, automation: true }));
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[0].balance === '15 000 ₽');
        assert.equal(await snapshotCalls(), 1, 'opening the page refreshes only the current account');
        await page.waitForFunction(() => !document.querySelector('#fptRefreshAccountsBtn').disabled);
        await page.locator('#fptRefreshAccountsBtn').click();
        await page.waitForSelector('.fpt-popup-toast[data-kind="warning"]');
        assert.match(await page.locator('.fpt-popup-toast').textContent(), /Обновлено 1 из 3\. Остальные не обновлялись, пока работает автоматизация/);
        assert.equal(await snapshotCalls(), 2);
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-tag--locked').length === 2);
        assert.equal((await state()).fpToolsAccounts[1].balance, '1 250,50 ₽', 'the previous snapshot stays');
        assert.equal(await page.locator('.fpt-am-tag--failed').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('sync copies the config after two steps and can be undone', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAccounts(browser, {
            fpToolsAccounts: ACCOUNTS, fpToolsBlacklist: [{ username: 'spam' }], fpToolsAutoReplies: { greetingEnabled: true }, fpToolsPinnedLots: [{ offerId: '1' }]
        }, main());
        await page.locator('.fpt-am-sync').click();
        const dialog = page.locator('.fpt-am-sync-dialog');
        await dialog.waitFor();
        // Both lists are the themed menu, not the native one.
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-sync-dialog .fpt-select-trigger').length === 2);
        assert.equal(await dialog.locator('select.fpt-select-native').count(), 2);
        assert.deepEqual(await dialog.locator('.fpt-select-value').allTextContents(), ['Outlik (вы здесь)', 'Склад ключей']);
        await dialog.locator('.fpt-select-trigger').nth(1).click();
        await page.locator('.fpt-select-option:visible', { hasText: 'Outlik' }).click();
        assert.equal(await dialog.locator('.fpt-am-sync-hint').textContent(), 'Выберите разные аккаунты.');
        assert.equal(await dialog.getByRole('button', { name: 'Далее' }).isDisabled(), true);
        await dialog.locator('.fpt-select-trigger').nth(1).click();
        await page.locator('.fpt-select-option:visible', { hasText: 'Старый аккаунт' }).click();
        await dialog.getByRole('button', { name: 'Далее' }).click();
        assert.match(await dialog.textContent(), /Настройки «Старый аккаунт» будут заменены настройками «Outlik»/);
        assert.match(await dialog.textContent(), /Привязки к конкретным лотам/);
        await dialog.getByRole('button', { name: 'Назад' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-sync-dialog .fpt-select-trigger').length === 2);
        assert.deepEqual(await dialog.locator('.fpt-select-value').allTextContents(), ['Outlik (вы здесь)', 'Старый аккаунт'], 'the choice survives going back');
        await dialog.getByRole('button', { name: 'Далее' }).click();
        await dialog.getByRole('button', { name: 'Заменить настройки' }).click();
        await page.waitForSelector('.fpt-am-sync-banner:not([hidden])');
        assert.equal(await page.locator('.fpt-am-sync-dialog').count(), 0);
        const profile = await page.evaluate(() => window.qaVault.getProfile('3'));
        assert.deepEqual(profile.values.fpToolsBlacklist, [{ username: 'spam' }]);
        assert.equal(profile.values.fpToolsAutoReplies.greetingEnabled, true);
        assert.equal(profile.values.fpToolsPinnedLots, undefined, 'lot data is not copied');
        assert.match(await page.locator('.fpt-am-sync-banner').textContent(), /Настройки «Старый аккаунт» заменены настройками «Outlik»/);
        assert.match(await page.locator('.fpt-am-row').filter({ hasText: 'Старый аккаунт' }).locator('.fpt-am-tag--auto').textContent(), /Автоматизация/);

        await page.locator('.fpt-am-undo').click();
        await page.waitForSelector('.fpt-am-sync-banner', { state: 'hidden' });
        const undone = await page.evaluate(() => window.qaVault.getProfile('3'));
        assert.equal(undone.values.fpToolsBlacklist, undefined);
        assert.equal(await page.locator('.fpt-am-row').filter({ hasText: 'Старый аккаунт' }).locator('.fpt-am-tag--auto').count(), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('external storage changes re-render and a failed read can be retried', async () => {
    const browser = await launch();
    try {
        const { page, external, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS.slice(0, 1) }, main({ failFirstRead: true }));
        assert.equal(await page.locator('.fpt-accounts .fpt-qr-banner[role="alert"]').isVisible(), true);
        await page.locator('.fpt-accounts .fpt-qr-banner[role="alert"]').getByRole('button', { name: 'Повторить' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.fpt-am-row').length === 1);
        assert.equal(await page.locator('.fpt-accounts .fpt-qr-banner[role="alert"]').isVisible(), false);

        const current = await page.evaluate(() => window.qaStorage.read().fpToolsAccounts);
        await external({ fpToolsAccounts: [...current,
            { id: 'acc_b', name: 'Склад ключей', balance: '1 250,50 ₽' }, { id: 'acc_c', name: 'Старый аккаунт' }, { id: 'acc_d', name: 'Четвёртый', balance: '1 $' }] });
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
        const snapshots = { 'key-main': { userId: '1', username: 'Outlik', balance: '99 ₽', unread: 0, loggedIn: true, pending: { totals: { '₽': 0 }, count: 0 } } };
        const { page, state, snapshotCalls, external, errors } = await openAccounts(browser, { fpToolsAccounts: ACCOUNTS.slice(0, 1) }, main({ snapshots }));
        assert.equal(await snapshotCalls(), 0);
        await page.evaluate(() => window.fptOpenPopupPage('general'));
        await page.evaluate(() => window.fptOpenPopupPage('accounts'));
        assert.equal(await snapshotCalls(), 0, 'still fresh');

        await page.evaluate(() => window.fptOpenPopupPage('general'));
        const accounts = await page.evaluate(() => window.qaStorage.read().fpToolsAccounts);
        accounts[0]._snapTs = Date.now() - 20 * 60000;
        await external({ fpToolsAccounts: accounts });
        await page.evaluate(() => window.fptOpenPopupPage('accounts'));
        await page.waitForFunction(() => window.qaStorage.read().fpToolsAccounts[0].balance === '99 ₽');
        assert.equal(await snapshotCalls(), 1);
        assert.equal((await state()).fpToolsAccounts[0].pending.count, 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
