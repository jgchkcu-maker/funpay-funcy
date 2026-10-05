const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openInterfaceElements } = require('./helpers/interface_elements_browser_harness');

const disabled = page => page.evaluate(() => (window.qaStorage.read().fpToolsDisabledFeatures || []).slice().sort());

test('interface elements screen fits both themes and widths without horizontal scroll', async () => {
    const browser = await launch();
    try {
        for (const dark of [false, true]) {
            for (const width of [1480, 900, 620]) {
                const { page, errors } = await openInterfaceElements(browser, { fpToolsDisabledFeatures: ['chat_reply'] }, { dark, width, height: 1000 });
                const overflow = await page.evaluate(() => {
                    const content = document.querySelector('.fp-tools-page-content[data-page="needs"]');
                    return content.scrollWidth - content.clientWidth;
                });
                assert.ok(overflow <= 0, `no horizontal scroll (${dark ? 'dark' : 'light'}, ${width})`);
                assert.equal(await page.locator('.fpt-ie-row').count(), 36);
                assert.equal(await page.locator('.fpt-ie-group').count(), 6);
                assert.equal(await page.locator('.fpt-ie-nav').isVisible(), width === 1480, 'section nav only on wide screens');
                assert.match(await page.locator('.fpt-ie-hero .fpt-qr-pill').textContent(), /Скрыто 1/);
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
    } finally { await browser.close(); }
});

test('element and section switches save instantly and keep unrelated ids', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openInterfaceElements(browser, { fpToolsDisabledFeatures: ['rmthub_seller_search'] });
        await page.getByRole('switch', { name: 'Показывать «Счётчик символов в чате»' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsDisabledFeatures.includes('chat_char_counter'));
        assert.deepEqual(await disabled(page), ['chat_char_counter', 'rmthub_seller_search']);
        assert.equal(await page.getAttribute('.fpt-ie-row[data-id="chat_char_counter"]', 'data-state'), 'off');
        assert.match(await page.locator('.fpt-ie-group[data-group="Чат"] .fpt-qr-card-copy p').textContent(), /Показано 10 из 11/);
        assert.match(await page.locator('.fpt-qr-metric').nth(1).textContent(), /2 элемента/);
        // The disabler CSS hides the live element right away.
        assert.match(await page.evaluate(() => document.getElementById('fp-tools-disabled-features').textContent), /#fp-chat-char-count/);

        await page.getByRole('switch', { name: 'Показывать все элементы раздела «Копирование и импорт лотов»' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsDisabledFeatures.length === 7);
        assert.equal(await page.getAttribute('.fpt-ie-group[data-group="Копирование и импорт лотов"]', 'data-state'), 'off');
        await page.getByRole('switch', { name: 'Показывать все элементы раздела «Копирование и импорт лотов»' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsDisabledFeatures.length === 2);

        await page.getByRole('button', { name: 'Показать всё' }).click();
        await page.locator('.fpt-lot-dialog').getByRole('button', { name: 'Показать всё' }).click();
        await page.waitForFunction(() => window.qaStorage.read().fpToolsDisabledFeatures.length === 0);
        assert.equal(await page.getByRole('button', { name: 'Показать всё' }).isDisabled(), true);
        assert.match(await page.locator('.fpt-ie-hero .fpt-qr-pill').textContent(), /Всё на месте/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('keyboard row explains the hidden font block and search shows the parent as context', async () => {
    const browser = await launch();
    try {
        const { page } = await openInterfaceElements(browser, { fpToolsDisabledFeatures: ['lot_font_controls', 'lot_keyboard_btn'] });
        const keyboard = page.locator('.fpt-ie-row[data-id="lot_keyboard_btn"]');
        assert.equal(await keyboard.locator('.fpt-ie-row-note').isVisible(), true);
        await page.getByRole('switch', { name: 'Показывать «Блок шрифта и спецсимволов»' }).click();
        await page.waitForFunction(() => !window.qaStorage.read().fpToolsDisabledFeatures.includes('lot_font_controls'));
        assert.equal(await keyboard.locator('.fpt-ie-row-note').isVisible(), false);

        await page.getByRole('radio', { name: /Скрыты/ }).click();
        assert.equal(await page.locator('.fpt-ie-row:visible').count(), 2, 'hidden keyboard plus its parent as context');
        assert.equal(await page.getAttribute('.fpt-ie-row[data-id="lot_font_controls"]', 'data-context'), 'true');
        assert.equal(await page.getByRole('switch', { name: 'Показывать «Блок шрифта и спецсимволов»' }).isDisabled(), true);

        await page.getByRole('radio', { name: /Все/ }).click();
        await page.fill('#fptNeedsFilter', 'несуществующий элемент');
        assert.equal(await page.locator('.fpt-ie-empty').isVisible(), true);
        await page.locator('.fpt-ie-empty').getByRole('button', { name: 'Сбросить поиск' }).click();
        assert.equal(await page.locator('.fpt-ie-row:visible').count(), 36);
        await page.fill('#fptNeedsFilter', 'шапка диалога');
        assert.equal(await page.locator('.fpt-ie-row:visible').count(), 2);
        assert.equal(await page.locator('.fpt-ie-group:visible').count(), 1);
    } finally { await browser.close(); }
});

test('preview opens a replica with the real AI icon', async () => {
    const browser = await launch();
    try {
        const { page } = await openInterfaceElements(browser, {});
        const preview = page.getByRole('button', { name: 'Как выглядит «Кнопка ИИ-режима в чате»' });
        await preview.click();
        assert.equal(await preview.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.getAttribute('#fpt-ie-preview-chat_ai_rewrite_btn img', 'src'), 'https://funpay.com/icons/magic.png');
        await preview.click();
        assert.equal(await page.locator('#fpt-ie-preview-chat_ai_rewrite_btn').isVisible(), false);
    } finally { await browser.close(); }
});

test('AI suggestions hide only the checked elements', async () => {
    const browser = await launch();
    try {
        const ai = { delay: 150, response: { success: true, data: '```json\n' + JSON.stringify([
            { id: 'chat_menu_translate', confidence: 0.9, reason: 'Не нужен перевод' },
            { id: 'lot_translate_btn', confidence: 0.6, reason: 'Перевод лота' },
            { id: 'invented', confidence: 1 }]) + '\n```' } };
        const { page, errors } = await openInterfaceElements(browser, { fpToolsDisabledFeatures: ['chat_reply'] }, { ai });
        assert.equal(await page.locator('#fptNeedsAskBtn').isDisabled(), true, 'empty request cannot be sent');
        await page.locator('.fpt-ie-ai-examples').getByRole('button', { name: 'Скрой всё про ИИ' }).click();
        await page.fill('#fptNeedsInput', 'не пользуюсь переводом');
        await page.click('#fptNeedsAskBtn');
        await page.locator('.fpt-ie-ai-result[data-kind="loading"]').waitFor();
        await page.locator('.fpt-ie-suggestion').first().waitFor();
        assert.equal(await page.locator('.fpt-ie-suggestion').count(), 2, 'unknown ids are dropped');
        assert.match(await page.locator('.fpt-ie-confidence').first().textContent(), /90%/);
        await page.locator('.fpt-ie-suggestion[data-id="lot_translate_btn"]').click();
        assert.match(await page.locator('#fptNeedsAiConfirm').textContent(), /Скрыть 1 элемент$/);
        await page.click('#fptNeedsAiConfirm');
        await page.locator('.fpt-ie-ai-result[data-kind="success"]').waitFor();
        assert.deepEqual(await disabled(page), ['chat_menu_translate', 'chat_reply']);
        assert.equal(await page.getAttribute('.fpt-ie-row[data-id="chat_menu_translate"]', 'data-state'), 'off');
        assert.equal(JSON.parse((await page.evaluate(() => window.qaMessages[0].context))).length, 36);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('AI errors and load errors are reported with recovery', async () => {
    const browser = await launch();
    try {
        const { page } = await openInterfaceElements(browser, {}, { failFirstRead: true, ai: { response: { success: false, error: 'Нет ключа API' } } });
        assert.equal(await page.locator('.fpt-qr-banner').isVisible(), true);
        assert.equal(await page.getByRole('switch', { name: 'Показывать «Ответы на сообщения»' }).isDisabled(), true);
        await page.locator('.fpt-qr-banner').getByRole('button', { name: 'Повторить' }).click();
        await page.locator('.fpt-qr-banner').waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('switch', { name: 'Показывать «Ответы на сообщения»' }).isDisabled(), false);
        await page.fill('#fptNeedsInput', 'убери перевод');
        await page.click('#fptNeedsAskBtn');
        await page.locator('.fpt-ie-ai-result[data-kind="error"]').waitFor();
        assert.match(await page.locator('.fpt-ie-ai-result').textContent(), /Нет ключа API/);
    } finally { await browser.close(); }
});

test('external storage changes update the screen', async () => {
    const browser = await launch();
    try {
        const { page, external } = await openInterfaceElements(browser, {});
        await external({ fpToolsDisabledFeatures: ['lot_search_bar'] });
        await page.waitForFunction(() => document.querySelector('.fpt-ie-row[data-id="lot_search_bar"]').dataset.state === 'off');
        assert.equal(await page.getByRole('switch', { name: 'Показывать «Строка поиска по лотам»' }).isChecked(), false);
        assert.equal(await page.locator('.fpt-ie-map-tick[data-state="off"]').count(), 1);
    } finally { await browser.close(); }
});
