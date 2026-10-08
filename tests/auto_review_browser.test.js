const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, openReviews } = require('./helpers/auto_review_browser_harness');
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('review help follows shared page typography, fits both themes and closes by click or Escape', async () => {
    const browser = await launch();
    try {
        for (const dark of [false, true]) {
            for (const width of [1480, 760]) {
                const { page } = await openReviews(browser, {}, { dark, width, height: 1000 });
                await page.emulateMedia({ reducedMotion: 'reduce' });
                const trigger = page.locator('.fpt-category-help');
                const panel = page.locator('#fpt-rv-help');
                await trigger.click();
                assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
                assert.equal(await panel.locator('li').count(), 5);
                const textStyle = await panel.locator('li').first().evaluate(el => ({ font: getComputedStyle(el).fontSize, height: getComputedStyle(el).lineHeight }));
                assert.equal(textStyle.font, '13px');
                assert.equal(textStyle.height, '18.85px');
                const box = await panel.boundingBox();
                const button = await trigger.boundingBox();
                assert.ok(box.x >= 0 && box.x + box.width <= width);
                assert.ok(Math.abs(box.x + box.width - button.x - button.width) < 1);
                assert.ok(Math.abs(box.y - button.y - button.height - 8) < 1);
                await trigger.click();
                assert.equal(await panel.isVisible(), false);
                await trigger.click();
                await page.mouse.click(box.x + 12, box.y + box.height + 12);
                assert.equal(await panel.isVisible(), false);
                await trigger.click();
                await page.keyboard.press('Escape');
                assert.equal(await panel.isVisible(), false);
                assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
                await page.close();
            }
        }
    } finally { await browser.close(); }
});

test('rating rail sits beside the editor and stars reflect saved answers', async () => {
    const browser = await launch();
    try {
        const { page } = await openReviews(browser, { reviewTemplates: { 4: 'Сохранённый ответ' } }, { width: 1440, height: 1000 });
        const boxes = await page.locator('.fpt-rv-rating').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
        assert.ok(boxes.every((box, index) => !index || box.top >= boxes[index - 1].bottom), 'ratings stack vertically');
        const editor = await page.locator('#fpt-rv-review-text').boundingBox();
        assert.ok(boxes[0].right <= editor.x, 'rail sits left of the editor');
        assert.equal(await page.locator('[data-rating="4"] .fpt-rv-rating-meta').innerText(), 'Сохранённый ответ');
        await page.locator('#fpt-rv-review-text').fill('Новый ответ');
        assert.equal(await page.locator('[data-rating="5"]').getAttribute('data-saved'), 'false');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-rating="5"]').dataset.saved === 'true');
        for (const rating of [4, 5]) {
            const fill = await page.locator(`[data-rating="${rating}"] svg`).evaluate(el => getComputedStyle(el).fill);
            assert.notEqual(fill, 'none');
        }
        await page.locator('#fpt-rv-review-text').fill('');
        assert.equal(await page.locator('[data-rating="5"]').getAttribute('data-saved'), 'true');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-rating="5"]').dataset.saved === 'false');
        assert.equal(await page.locator('[data-rating="5"] svg').evaluate(el => getComputedStyle(el).fill), 'none');
    } finally { await browser.close(); }
});

test('reviews: drafts survive ratings, independent saves preserve runtime and unrelated settings', async () => {
    const browser = await launch();
    try {
        const initial = { reviewTemplates: { 5: 'Спасибо!', 2: 'Поможем' }, greetingEnabled: true, repliedOrderIds: ['123'],
            bonusForReviewEnabled: true, bonusMode: 'single', singleBonusText: 'Ваш бонус' };
        const env = await openReviews(browser, initial);
        const { page } = env;
        assert.equal(env.patches.length, 0);
        await page.locator('#fpt-rv-review-text').fill('Спасибо, {buyername}!');
        await page.locator('[data-rating="2"]').click();
        await page.locator('#fpt-rv-review-text').fill('Напишите нам');
        await page.locator('[data-rating="5"]').click();
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Спасибо, {buyername}!');
        await page.locator('#fpt-rv-single-text').fill('Новый бонус');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fpt-popup-toast')].some(t => /сохранены/.test(t.textContent)) && !document.querySelector('.fpt-rv-card--reviews .fpt-rv-save-busy, .fpt-rv-card--reviews fieldset:disabled'));
        assert.equal(env.state().reviewTemplates[2], 'Напишите нам');
        assert.equal(env.state().singleBonusText, 'Ваш бонус');
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Новый бонус');
        await env.external({ set: { lastSeenMsgIds: { chat: 'new' } } });
        assert.equal(await page.locator('.fpt-rv-conflict:visible').count(), 0);
        await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fpt-popup-toast')].some(t => /сохранены/.test(t.textContent)) && !document.querySelector('.fpt-rv-card--bonuses .fpt-rv-save-busy, .fpt-rv-card--bonuses fieldset:disabled'));
        assert.equal(env.state().singleBonusText, 'Новый бонус');
        assert.equal(env.state().greetingEnabled, true);
        assert.deepEqual(env.state().repliedOrderIds, ['123']);
        assert.deepEqual(env.state().lastSeenMsgIds, { chat: 'new' });
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('reviews: validation, variables, image routing, save error and retry', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser);
        const { page } = env;
        await page.getByRole('switch', { name: 'Ответы на отзывы', exact: true }).check();
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        assert.match(await page.locator('.fpt-rv-card--reviews .fpt-rv-status').innerText(), /Добавьте текст/);
        assert.equal(env.patches.length, 0);
        await page.locator('#fpt-rv-review-text').fill('Спасибо, ');
        await page.locator('.fpt-rv-card--reviews').getByRole('button', { name: 'Имя покупателя', exact: true }).click();
        assert.match(await page.locator('#fpt-rv-review-text').inputValue(), /\{buyername\}/);
        await page.locator('.fpt-rv-card--reviews input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
        await page.waitForSelector('.fpt-rv-image img');
        assert.equal(await page.locator('.fpt-rv-preview').count(), 0);
        const help = page.getByRole('region', { name: 'Справка по отзывам и бонусам', includeHidden: true });
        assert.equal(await help.isVisible(), false);
        assert.equal(await page.locator('.fpt-rv-attachment-head button').count(), 1);
        await page.locator('.fpt-category-header').getByRole('button', { name: 'Справка', exact: true }).click();
        assert.match(await help.innerText(), /до 5 изображений, каждое до 1 МБ/);
        assert.equal(await help.isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await help.isVisible(), false);
        env.failSave();
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-rv-card--reviews .fpt-rv-status').dataset.kind === 'error');
        assert.equal(await page.locator('.fpt-rv-image img').count(), 1);
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fpt-popup-toast')].some(t => /сохранены/.test(t.textContent)) && !document.querySelector('.fpt-rv-card--reviews .fpt-rv-save-busy, .fpt-rv-card--reviews fieldset:disabled'));
        assert.equal(env.state().reviewTemplateImages[5].length, 1);
        assert.equal(env.state().autoReviewEnabled, true);
        await page.getByRole('button', { name: 'Удалить изображение 1', exact: true }).click();
        await page.locator('.fpt-rv-card--reviews').getByRole('button', { name: 'Отменить изменения', exact: true }).click();
        assert.equal(await page.locator('.fpt-rv-image img').count(), 1);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('first single bonus save persists the mode required by the background sender', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser);
        const { page } = env;
        await page.getByRole('switch', { name: 'Бонус за 5★', exact: true }).check();
        await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).click();
        assert.equal(env.patches.length, 0);
        await page.locator('#fpt-rv-single-text').fill('Спасибо за отзыв! Ваш бонус: THANKS');
        await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fpt-popup-toast')].some(t => /сохранены/.test(t.textContent)) && !document.querySelector('.fpt-rv-card--bonuses .fpt-rv-save-busy, .fpt-rv-card--bonuses fieldset:disabled'));
        assert.equal(env.state().bonusForReviewEnabled, true);
        assert.equal(env.state().bonusMode, 'single');
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('bonuses: local list edits use a single checked patch; mode changes and cancel keep data', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { randomBonuses: ['Первый', 'Второй', 'Третий'], singleBonusText: 'Одиночный' });
        const { page } = env;
        await page.getByRole('radio', { name: 'Случайный из списка', exact: true }).click();
        await page.getByRole('button', { name: 'Удалить вариант 1', exact: true }).click();
        await page.getByRole('button', { name: 'Редактировать вариант 1', exact: true }).click();
        await page.locator('#fpt-rv-bonus-dialog-text').fill('Обновлённый');
        await page.getByRole('button', { name: 'Применить', exact: true }).click();
        await page.getByRole('button', { name: 'Добавить вариант', exact: true }).click();
        await page.locator('#fpt-rv-bonus-dialog-text').fill('Новый {buyername}');
        await page.getByRole('button', { name: 'Добавить', exact: true }).click();
        assert.equal(env.patches.length, 0);
        await page.getByRole('radio', { name: 'Один бонус', exact: true }).click();
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Одиночный');
        await page.getByRole('radio', { name: 'Случайный из списка', exact: true }).click();
        assert.equal(await page.locator('.fpt-rv-bonus-row').count(), 3);
        await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.fpt-popup-toast')].some(t => /сохранены/.test(t.textContent)) && !document.querySelector('.fpt-rv-card--bonuses .fpt-rv-save-busy, .fpt-rv-card--bonuses fieldset:disabled'));
        assert.deepEqual(env.state().randomBonuses, ['Обновлённый', 'Третий', 'Новый {buyername}']);
        assert.equal(env.patches.length, 1);
        assert.ok(env.patches[0].arrayOps.randomBonuses.every(op => op.op === 'append' || Object.hasOwn(op, 'expected')));
        await page.getByRole('button', { name: 'Удалить вариант 1', exact: true }).click();
        await page.locator('.fpt-rv-card--bonuses').getByRole('button', { name: 'Отменить изменения', exact: true }).click();
        assert.equal(await page.locator('.fpt-rv-bonus-row').count(), 3);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('reviews: external updates refresh clean blocks, preserve dirty drafts and expose conflict recovery', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Старый' } });
        const { page } = env;
        await page.locator('#fpt-rv-review-text').fill('Мой черновик');
        await env.external({ merge: { reviewTemplates: { 5: 'Из другого окна' } }, set: { singleBonusText: 'Новый бонус' } });
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Мой черновик');
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Новый бонус');
        assert.equal(await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'Перечитать', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Перечитать', exact: true }).click();
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Из другого окна');
        await page.evaluate(() => window.FPTAutoReviewPage.mount(document.querySelector('.fp-tools-popup')));
        assert.equal(await page.locator('.fpt-reviews').count(), 1);
        assert.equal(await page.locator('[data-page="auto_review"] > .fpt-category-header').count(), 1);
        assert.equal(await page.evaluate(() => window.qaListeners.length), 1);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('bonus dialog survives external list shifts and cannot overwrite a different item', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { bonusMode: 'random', randomBonuses: ['Первый', 'Второй'] });
        const { page } = env;
        await page.getByRole('button', { name: 'Редактировать вариант 1', exact: true }).click();
        await page.locator('#fpt-rv-bonus-dialog-text').fill('Мой первый');
        await env.external({ arrayOps: { randomBonuses: [{ op: 'remove', index: 0, expected: 'Первый' }] } });
        await page.getByRole('button', { name: 'Применить', exact: true }).click();
        assert.equal(env.state().randomBonuses[0], 'Второй');
        assert.equal(await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.fpt-rv-card--bonuses .fpt-rv-conflict:visible').count(), 1);
        assert.equal(await page.locator('.fpt-rv-bonus-text').first().innerText(), 'Мой первый');
        assert.equal(await page.evaluate(() => document.activeElement === document.body), false);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('reviews: both themes, responsive stacking, transparent header and keyboard selection', async () => {
    const browser = await launch();
    try {
        for (const dark of [true, false]) {
            const { page, errors } = await openReviews(browser, {}, { dark });
            assert.ok(await page.locator('#fpt-rv-review-text').evaluate(el => el.getBoundingClientRect().height >= 112), 'review editor keeps a usable height after shared control normalization');
            assert.ok(await page.locator('.fpt-rv-card--bonuses').evaluate(el => el.getBoundingClientRect().top)
                >= await page.locator('.fpt-rv-card--reviews').evaluate(el => el.getBoundingClientRect().bottom), 'bonus card follows the reviews card');
            assert.equal(await page.locator('[data-page="auto_review"] .fpt-category-header').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
            await page.locator('[data-rating="5"]').focus(); await page.keyboard.press('ArrowRight');
            assert.equal(await page.locator('[data-rating="4"]').getAttribute('aria-checked'), 'true');
            for (const width of [1000, 760]) {
                await page.setViewportSize({ width, height: 930 });
                await page.evaluate(() => document.querySelector('.fp-tools-popup').style.width = `${innerWidth - 24}px`);
                const geometry = await page.locator('.fpt-rv-grid').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth,
                    columns: getComputedStyle(el).gridTemplateColumns.split(' ').length }));
                assert.ok(geometry.scroll <= geometry.client + 1, 'no horizontal overflow');
                assert.equal(geometry.columns, 1);
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('review save rejects a change made after preflight without losing the draft', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Исходный' } });
        const { page } = env;
        await page.evaluate(() => {
            const actions = window.fptPopupActions;
            const gate = new Promise(resolve => { window.qaRelease = resolve; });
            window.fptPopupActions = { ...actions, async run(page, action, payload) {
                if (action === 'saveSettings') { window.qaWaiting = true; await gate; }
                return actions.run(page, action, payload);
            } };
        });
        await page.locator('#fpt-rv-review-text').fill('Мой черновик');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => window.qaWaiting);
        await env.external({ merge: { reviewTemplates: { 5: 'Из другого окна' } } });
        await page.evaluate(() => window.qaRelease());
        await page.waitForFunction(() => document.querySelector('.fpt-rv-card--reviews .fpt-rv-status').dataset.kind === 'error');
        assert.equal(env.state().reviewTemplates[5], 'Из другого окна');
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Мой черновик');
        assert.equal(await page.locator('.fpt-rv-card--reviews .fpt-rv-conflict:visible').count(), 1);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('upload completion replays external changes and enables the other save button', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Исходный' } });
        const { page } = env;
        await page.evaluate(() => {
            const actions = window.fptPopupActions;
            const gate = new Promise(resolve => { window.qaRelease = resolve; });
            window.fptPopupActions = { ...actions, async run(page, action, payload) {
                if (action === 'handleImageAddClick') { window.qaWaiting = true; await gate; }
                return actions.run(page, action, payload);
            } };
        });
        await page.locator('.fpt-rv-card--reviews input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
        await page.waitForFunction(() => window.qaWaiting);
        await page.locator('#fpt-rv-single-text').fill('Мой бонус');
        assert.equal(await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).isDisabled(), true);
        await env.external({ merge: { reviewTemplates: { 5: 'Новый ответ' } } });
        await page.evaluate(() => window.qaRelease());
        await page.waitForSelector('.fpt-rv-image img');
        assert.equal(await page.getByRole('button', { name: 'Сохранить бонусы', exact: true }).isEnabled(), true);
        assert.equal(await page.locator('.fpt-rv-card--reviews .fpt-rv-conflict:visible').count(), 1);
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Исходный');
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Мой бонус');
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('bonus text opens its editor; removing popup disposes the storage listener', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openReviews(browser, { bonusMode: 'random', randomBonuses: ['Первый', 'Второй'] });
        await page.locator('.fpt-rv-bonus-text').first().focus(); await page.keyboard.press('Enter');
        assert.equal(await page.getByRole('dialog').count(), 1);
        await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
        await page.getByRole('button', { name: 'Удалить вариант 1', exact: true }).focus(); await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Удалить вариант 1');
        await page.evaluate(() => document.querySelector('.fp-tools-popup').remove());
        assert.equal(await page.evaluate(() => window.qaListeners.length), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('failed image upload keeps an actionable error on a clean block', async () => {
    const browser = await launch();
    try {
        const { page } = await openReviews(browser);
        await page.locator('.fpt-rv-card--reviews input[type="file"]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(1024 * 1024 + 1) });
        await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reviews fieldset').disabled);
        assert.equal(await page.locator('.fpt-rv-card--reviews .fpt-rv-status').getAttribute('data-kind'), 'error');
        assert.match(await page.locator('.fpt-rv-card--reviews .fpt-rv-status').innerText(), /1 МБ/);
    } finally { await browser.close(); }
});

test('newer storage events win over a delayed successful save response', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Исходный' } });
        const { page } = env;
        await page.evaluate(() => {
            const actions = window.fptPopupActions;
            const gate = new Promise(resolve => { window.qaRelease = resolve; });
            window.fptPopupActions = { ...actions, async run(page, action, payload) {
                const result = await actions.run(page, action, payload);
                if (action === 'saveSettings') { window.qaWaiting = true; await gate; }
                return result;
            } };
        });
        await page.locator('#fpt-rv-review-text').fill('Мой ответ');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => window.qaWaiting);
        await env.external({ merge: { reviewTemplates: { 5: 'Более новый ответ' } }, set: { singleBonusText: 'Более новый бонус' } });
        await page.evaluate(() => window.qaRelease());
        await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reviews fieldset').disabled);
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Более новый ответ');
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Более новый бонус');
        assert.equal(env.state().reviewTemplates[5], 'Более новый ответ');
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('a stale preflight result cannot roll clean bonus settings back', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Исходный' } });
        const { page } = env;
        await page.evaluate(() => {
            const actions = window.fptPopupActions;
            const before = new Promise(resolve => { window.qaReadNow = resolve; });
            const after = new Promise(resolve => { window.qaReturnRead = resolve; });
            window.fptPopupActions = { ...actions, async run(page, action, payload) {
                if (action !== 'getSettings') return actions.run(page, action, payload);
                window.qaWaiting = true; await before;
                const result = await actions.run(page, action, payload);
                window.qaCaptured = true; await after; return result;
            } };
        });
        await page.locator('#fpt-rv-review-text').fill('Мой черновик');
        await page.getByRole('button', { name: 'Сохранить ответы', exact: true }).click();
        await page.waitForFunction(() => window.qaWaiting);
        await env.external({ merge: { reviewTemplates: { 5: 'Ответ A' } }, set: { singleBonusText: 'Бонус A' } });
        await page.evaluate(() => window.qaReadNow());
        await page.waitForFunction(() => window.qaCaptured);
        await env.external({ merge: { reviewTemplates: { 5: 'Ответ B' } }, set: { singleBonusText: 'Бонус B' } });
        await page.evaluate(() => window.qaReturnRead());
        await page.waitForFunction(() => !document.querySelector('.fpt-rv-card--reviews fieldset').disabled);
        assert.equal(await page.locator('#fpt-rv-single-text').inputValue(), 'Бонус B');
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Мой черновик');
        assert.equal(env.patches.length, 0);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});

test('removing popup with an open bonus dialog releases keyboard interception', async () => {
    const browser = await launch();
    try {
        const { page } = await openReviews(browser, { bonusMode: 'random', randomBonuses: ['Первый'] });
        await page.getByRole('button', { name: 'Редактировать вариант 1', exact: true }).click();
        await page.evaluate(() => document.querySelector('.fp-tools-popup').remove());
        const prevented = await page.evaluate(() => {
            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            window.dispatchEvent(event); return event.defaultPrevented;
        });
        assert.equal(prevented, false);
    } finally { await browser.close(); }
});

test('loading failure offers retry without enabling defaults or overwriting saved settings', async () => {
    const browser = await launch();
    try {
        const env = await openReviews(browser, { reviewTemplates: { 5: 'Сохранённый ответ' } }, { initialReadFailure: true });
        const { page } = env;
        assert.equal(await page.getByRole('switch', { name: 'Ответы на отзывы', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.fpt-rv-card--reviews .fpt-rv-status').getAttribute('data-kind'), 'error');
        env.failReads(false);
        await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
        assert.equal(await page.locator('#fpt-rv-review-text').inputValue(), 'Сохранённый ответ');
        assert.equal(await page.getByRole('switch', { name: 'Ответы на отзывы', exact: true }).isEnabled(), true);
        assert.equal(env.patches.length, 0);
        assert.deepEqual(env.errors, []);
    } finally { await browser.close(); }
});
