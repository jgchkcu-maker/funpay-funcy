const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openQuickReplies } = require('./helpers/quick_replies_browser_harness');
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('quick replies screen fits both themes and widths without horizontal scroll', async () => {
    const browser = await launch();
    try {
        for (const dark of [false, true]) {
            for (const width of [1480, 900]) {
                const { page, errors } = await openQuickReplies(browser, {}, { dark, width, height: 1000 });
                for (const tab of ['#fptQuickRepliesTemplatesTab', '#fptQuickRepliesCommandsTab']) {
                    await page.click(tab);
                    const overflow = await page.evaluate(() => {
                        const content = document.querySelector('.fp-tools-page-content[data-page="templates"]');
                        return content.scrollWidth - content.clientWidth;
                    });
                    assert.ok(overflow <= 0, `no horizontal scroll (${dark ? 'dark' : 'light'}, ${width}, ${tab})`);
                }
                assert.equal(await page.locator('.fpt-qr-row--template').count(), 4);
                assert.equal(await page.locator('.fpt-qr-empty').isVisible(), true, 'commands empty state');
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
    } finally { await browser.close(); }
});

test('route modes, tab keyboard navigation and search panes stay in sync', async () => {
    const browser = await launch();
    try {
        const { page } = await openQuickReplies(browser, {}, { mode: 'commands' });
        assert.equal(await page.getAttribute('#fptQuickRepliesCommandsTab', 'aria-selected'), 'true');
        assert.equal(await page.locator('[data-quick-replies-pane="commands"]').isVisible(), true);
        assert.equal(await page.locator('[data-quick-replies-pane="templates"]').isVisible(), false);
        await page.focus('#fptQuickRepliesCommandsTab');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.getAttribute('#fptQuickRepliesTemplatesTab', 'aria-selected'), 'true');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'fptQuickRepliesTemplatesTab');
        await page.waitForFunction(() => window.qaStorage.read().fpToolsPageModes?.templates === 'templates');
        // The chat popover gear opens the templates tab.
        await page.click('#fptQuickRepliesCommandsTab');
        await page.evaluate(() => window.fptOpenPopupPage('templates', { mode: 'templates' }));
        assert.equal(await page.getAttribute('#fptQuickRepliesTemplatesTab', 'aria-selected'), 'true');
        await page.evaluate(() => window.fptOpenPopupPage('slash_commands'));
        assert.equal(await page.getAttribute('#fptQuickRepliesCommandsTab', 'aria-selected'), 'true');
        await page.close();
    } finally { await browser.close(); }
});

test('templates can be toggled, created with images, edited, reset and deleted', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openQuickReplies(browser, {});
        await page.getByRole('switch', { name: 'Отправлять сразу по клику' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsTemplateSettings?.sendTemplatesImmediately === false);
        assert.match(await page.locator('.fpt-qr-metric').nth(2).textContent(), /В поле ввода/);
        await page.getByRole('switch', { name: 'Показывать шаблон «Попросить отзыв»' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsTemplateSettings?.standard?.review?.enabled === false);
        assert.match(await page.locator('.fpt-qr-metric').first().textContent(), /3 из 4/);

        await page.getByRole('button', { name: 'Новый шаблон' }).click();
        const dialog = page.locator('.fpt-lot-dialog');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'fpt-qr-label-input');
        await dialog.getByRole('button', { name: 'Добавить шаблон' }).click();
        assert.match(await dialog.locator('.fpt-qr-error').first().textContent(), /название/);
        await page.fill('#fpt-qr-label-input', 'Инструкция');
        await page.click('#fpt-qr-text-input');
        await dialog.getByRole('button', { name: 'Имя покупателя' }).click();
        await page.keyboard.type(', данные в чате.');
        assert.equal(await page.inputValue('#fpt-qr-text-input'), '{buyername}, данные в чате.');
        assert.match(await dialog.locator('.fpt-qr-bubble').textContent(), /^Алексей, данные в чате\.$/);
        assert.equal(await dialog.locator('.fpt-qr-order').isVisible(), false, 'send order appears only with images');
        await dialog.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
        await dialog.locator('.fpt-qr-thumb').waitFor();
        assert.equal(await dialog.locator('.fpt-qr-order').isVisible(), true);
        await dialog.getByRole('radio', { name: 'Сначала картинка' }).click();
        assert.equal(await dialog.locator('.fpt-qr-message-body > .fpt-qr-bubble').first().evaluate(el => el.classList.contains('fpt-qr-bubble--images')), true);
        // Focus stays inside the dialog.
        for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('.fpt-lot-dialog')), true);
        await dialog.getByRole('button', { name: 'Добавить шаблон' }).click();
        await dialog.waitFor({ state: 'detached' });
        let saved = (await state()).fpToolsTemplateSettings;
        assert.equal(saved.custom.length, 1);
        assert.equal(saved.custom[0].label, 'Инструкция');
        assert.equal(saved.custom[0].images.length, 1);
        assert.equal(saved.custom[0].sendOrder, 'image_first');
        const row = page.locator('.fpt-qr-row', { hasText: 'Инструкция' });
        assert.match(await row.locator('.fpt-qr-badge').textContent(), /1/);

        await page.getByRole('button', { name: 'Редактировать шаблон «Приветствие»' }).click();
        await page.fill('#fpt-qr-text-input', 'Здравствуйте!');
        await dialog.getByRole('button', { name: 'Сохранить' }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal((await state()).fpToolsTemplateSettings.standard.greeting.text, 'Здравствуйте!');
        const greeting = page.locator('.fpt-qr-row', { hasText: 'Приветствие' });
        await greeting.getByRole('button', { name: 'Сбросить к исходному' }).click();
        await dialog.getByRole('button', { name: 'Сбросить' }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal((await state()).fpToolsTemplateSettings.standard.greeting.text, '{welcome}, {buyername}! Чем могу помочь?');
        assert.equal(await greeting.getByRole('button', { name: 'Сбросить к исходному' }).count(), 0);

        await row.getByRole('button', { name: 'Удалить' }).click();
        await dialog.getByRole('button', { name: 'Отмена' }).click();
        assert.equal((await state()).fpToolsTemplateSettings.custom.length, 1);
        await row.getByRole('button', { name: 'Удалить' }).click();
        await dialog.getByRole('button', { name: 'Удалить' }).click();
        await dialog.waitFor({ state: 'detached' });
        saved = (await state()).fpToolsTemplateSettings;
        assert.equal(saved.custom.length, 0);
        assert.equal(await page.locator('.fpt-qr-row--template').count(), 4);
        assert.deepEqual(errors, []);
        await page.close();
    } finally { await browser.close(); }
});

test('slash commands validate triggers and save, edit and delete through the store', async () => {
    const browser = await launch();
    try {
        const { page, state, errors } = await openQuickReplies(browser, {
            fpToolsSlashCommands: { commands: [{ id: '1', trigger: '/привет', response: 'Здравствуйте!' }, { trigger: '/legacy', response: 'Старая' }] }
        }, { mode: 'commands' });
        const dialog = page.locator('.fpt-lot-dialog');
        await page.getByRole('radio', { name: 'Только Tab' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsSlashCommands?.expandKey === 'tab');
        assert.equal((await state()).fpToolsSlashCommands.commands.length, 2, 'settings merge keeps commands');

        await page.getByRole('button', { name: 'Новая команда' }).click();
        await page.fill('#fpt-qr-trigger-input', 'Привет');
        assert.match(await dialog.locator('#fpt-qr-trigger-input-error').textContent(), /уже есть/);
        await page.fill('#fpt-qr-trigger-input', 'два слова');
        assert.match(await dialog.locator('#fpt-qr-trigger-input-error').textContent(), /без пробелов/);
        await page.fill('#fpt-qr-trigger-input', '/оплата');
        assert.equal(await page.inputValue('#fpt-qr-trigger-input'), 'оплата', 'the fixed prefix replaces a typed slash');
        await dialog.getByRole('button', { name: 'Добавить команду' }).click();
        assert.match(await dialog.locator('#fpt-qr-response-input-error').textContent(), /текст ответа/);
        await page.fill('#fpt-qr-response-input', 'Оплата через FunPay, {buyername}.');
        assert.match(await dialog.locator('.fpt-qr-bubble').textContent(), /Алексей/);
        assert.equal(await dialog.locator('.fpt-qr-kbd').textContent(), 'Tab');
        await dialog.getByRole('button', { name: 'Добавить команду' }).click();
        await dialog.waitFor({ state: 'detached' });
        let commands = (await state()).fpToolsSlashCommands.commands;
        assert.equal(commands.length, 3);
        assert.equal(commands[2].trigger, '/оплата');

        await page.getByRole('button', { name: 'Редактировать команду /legacy' }).click();
        await page.fill('#fpt-qr-response-input', 'Новая');
        await dialog.getByRole('button', { name: 'Сохранить' }).click();
        await dialog.waitFor({ state: 'detached' });
        commands = (await state()).fpToolsSlashCommands.commands;
        assert.ok(commands[1].id, 'legacy command received an id');
        assert.equal(commands[1].response, 'Новая');

        await page.locator('.fpt-qr-row', { hasText: '/привет' }).getByRole('button', { name: 'Удалить' }).click();
        await dialog.getByRole('button', { name: 'Удалить' }).click();
        await dialog.waitFor({ state: 'detached' });
        commands = (await state()).fpToolsSlashCommands.commands;
        assert.deepEqual(commands.map(command => command.trigger), ['/legacy', '/оплата']);
        assert.equal(await page.locator('.fpt-qr-row--command').count(), 2);
        assert.deepEqual(errors, []);
        await page.close();
    } finally { await browser.close(); }
});

test('external changes rerender after the editor closes and load errors offer a retry', async () => {
    const browser = await launch();
    try {
        const { page, external } = await openQuickReplies(browser, {}, { mode: 'commands', failFirstRead: true });
        assert.equal(await page.locator('.fpt-qr-banner').isVisible(), true);
        assert.equal(await page.getByRole('button', { name: 'Новая команда' }).isDisabled(), true);
        await page.getByRole('button', { name: 'Повторить' }).click();
        await page.locator('.fpt-qr-banner').waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('button', { name: 'Новая команда' }).isDisabled(), false);

        await page.getByRole('button', { name: 'Новая команда' }).click();
        await external({ fpToolsSlashCommands: { commands: [{ id: '9', trigger: '/извне', response: 'Привет' }] } });
        assert.equal(await page.locator('.fpt-qr-row--command').count(), 0, 'list waits while the editor is open');
        await page.keyboard.press('Escape');
        await page.locator('.fpt-qr-row', { hasText: '/извне' }).waitFor();
        await external({ fpToolsTemplateSettings: { enabled: false } });
        await page.click('#fptQuickRepliesTemplatesTab');
        assert.equal(await page.getByRole('switch', { name: 'Включить шаблоны' }).isChecked(), false);
        assert.equal(await page.locator('.fpt-qr-note').first().isVisible(), true);
        await page.close();
    } finally { await browser.close(); }
});
