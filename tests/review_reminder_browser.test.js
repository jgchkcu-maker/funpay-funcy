const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openReviews } = require('./helpers/auto_review_browser_harness');

const NOW = Date.UTC(2026, 9, 9, 12, 0);
const reminders = () => ({
    list: () => ({
        counts: { scheduled: 1, sent: 1 },
        tasks: [
            { key: 'review-reminder:1:TASK0001', orderId: 'TASK0001', lotName: 'Ключ Steam', buyerName: 'Petya', state: 'scheduled', dueAt: NOW, nextCheckAt: NOW, manual: false },
            { key: 'review-reminder:1:TASK0002', orderId: 'TASK0002', lotName: 'Аккаунт', buyerName: 'Vasya', state: 'sent', dueAt: NOW, manual: true }
        ],
        recent: [{ orderId: 'RECENT01', reason: 'Отзыв уже есть' }]
    }),
    candidates: () => ({
        orders: [
            { orderId: 'AAA111', lotName: 'Ключ Steam', offerId: '555', buyerName: 'Petya', orderDate: NOW, price: 120, currency: 'RUB', eligible: true, reminder: null },
            { orderId: 'BBB222', lotName: 'Ключ Steam', offerId: '555', buyerName: 'Kolya', orderDate: NOW - 1000, price: 120, currency: 'RUB', eligible: false, problem: 'Чат с покупателем не найден', reminder: null },
            { orderId: 'CCC333', lotName: 'Очень длинное название лота, которое не должно ломать раскладку карточки заказа', offerId: '777', buyerName: 'Masha', orderDate: NOW - 2000, price: 50, currency: 'RUB', eligible: true, reminder: { state: 'sent', manual: true } }
        ],
        lots: [{ offerId: '555', title: 'Ключ Steam', count: 2 }, { offerId: '777', title: 'Длинный лот', count: 1 }],
        buyers: [{ name: 'Petya', count: 1 }, { name: 'Kolya', count: 1 }],
        pending: 2, unknown: 1, failed: 0, salesError: null
    }),
    sendManual: ({ orderIds }) => ({ results: orderIds.map(orderId => ({ orderId, state: 'sent' })) })
});

test('reminder block: variable chips, preview, lot picker, manual send and no overflow', async () => {
    const browser = await launch();
    try {
        for (const dark of [true, false]) {
            for (const width of [1480, 760]) {
                const { page, errors, patches, reminderCalls } = await openReviews(browser, { reviewReminderEnabled: false },
                    { dark, width, height: 1000, reminders: reminders() });
                const settings = page.locator('.fpt-rv-card--reminders');
                await settings.waitFor();
                assert.equal(await settings.locator('.fpt-rv-variable').count(), 4, 'only the variables the reminder supports');
                await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reminders .fpt-rv-controls').disabled);
                assert.match(await settings.locator('.fpt-qr-bubble').textContent(), /funpay\.com\/orders\/DEMO123/);

                const orders = page.locator('.fpt-rv-card--reminder-orders');
                await orders.scrollIntoViewIfNeeded();
                await orders.locator('.fpt-rm-order').first().waitFor();
                assert.equal(await orders.locator('.fpt-rm-order').count(), 3);
                assert.equal(await orders.locator('.fpt-rm-order input[value="AAA111"]').isDisabled(), false);
                assert.equal(await orders.locator('.fpt-rm-order input[value="BBB222"]').isDisabled(), true, 'an order that failed the check is not selectable');
                assert.equal(await orders.locator('.fpt-rm-order input[value="CCC333"]').isDisabled(), true, 'an order that already got a reminder is not selectable');

                // Lot exclusions are picked from completed orders without a review.
                await settings.locator('.fpt-rm-tag-add').first().click();
                const dialog = page.locator('.fpt-lot-dialog');
                await dialog.locator('.fpt-auto-lot-row', { hasText: 'Ключ Steam' }).locator('input').check();
                await dialog.locator('button', { hasText: 'Применить' }).click();
                assert.equal(await settings.locator('.fpt-rm-tag-text').first().textContent(), 'Ключ Steam');
                await settings.locator('button', { hasText: 'Сохранить напоминание' }).click();
                await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reminders .fpt-rv-status[data-kind="loading"]'));
                assert.deepEqual(patches.at(-1).set.reviewReminderExcludedLots, ['555']);

                await orders.locator('.fpt-rm-order', { hasText: 'AAA111' }).click();
                const send = orders.locator('button', { hasText: 'Напомнить выбранным' });
                assert.match(await send.textContent(), /\(1\)/);
                await send.click();
                await page.locator('.fpt-lot-dialog button', { hasText: 'Отправить' }).click();
                await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reminder-orders .fpt-rv-status[data-kind="loading"]'));
                assert.deepEqual(reminderCalls.find(call => call.command === 'sendManual').orderIds, ['AAA111']);

                await orders.locator('.fpt-rv-mode', { hasText: 'Задачи' }).click();
                assert.equal(await orders.locator('.fpt-rm-task').count(), 2);
                assert.equal(await orders.locator('.fpt-rm-task .fpt-rv-icon-button').count(), 1, 'only waiting tasks can be cancelled');

                const overflow = await page.evaluate(() => [...document.querySelectorAll('.fpt-rv-card--reminders, .fpt-rv-card--reminder-orders, .fpt-rm-order, .fpt-rm-timing, .fpt-rm-tags')]
                    .filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className));
                assert.deepEqual(overflow, [], `no horizontal overflow at ${width}px (${dark ? 'dark' : 'light'})`);
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
});
