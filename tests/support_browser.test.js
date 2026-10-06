const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;

const TICKETS = [
    { id: '120045', title: 'Покупатель не подтверждает заказ', status: 'Открыта', lastUpdate: 'сегодня, 12:40', sortKey: 120045 },
    { id: '119870', title: 'Вопрос по выводу средств', status: 'В ожидании', lastUpdate: 'вчера, 18:02', sortKey: 119870 },
    { id: '118511', title: 'Ошибка при создании лота', status: 'Решена', lastUpdate: '2 октября', sortKey: 118511 },
    { id: '117004', title: 'Подтверждение заказов #AB12CD34', status: 'Закрыта', lastUpdate: '28 сентября', sortKey: 117004 }
];
const DETAILS = {
    title: 'Покупатель не подтверждает заказ',
    status: 'Открыт',
    token: 'reply-token',
    canReply: true,
    comments: [
        { author: 'qa-seller', text: '<p>Здравствуйте! Покупатель не подтверждает заказ <b>#AB12CD34</b> уже двое суток.</p>', timestamp: '6 октября, 10:12', avatarUrl: '' },
        { author: 'Агент поддержки', text: '<p>Добрый день! Проверим заказ и вернёмся с ответом.</p><p>Подробнее: <a href="/help/orders" onclick="window.qaPwned=1">правила</a></p><img src="x" onerror="window.qaPwned=1"><script>window.qaPwned=1</script>', timestamp: '6 октября, 11:30', avatarUrl: '' }
    ]
};
const CATEGORIES = [{ id: '1', name: 'Подтверждение заказа' }, { id: '4', name: 'Проблема с выводом средств' }];
const FIELDS = {
    '1': [
        { id: 'ticket[fields][1]', name: 'Ваш никнейм', type: 'text', required: true, options: [], condition: null, defaultValue: '' },
        { id: 'ticket[fields][3]', name: 'Ваша роль', type: 'radio', required: true, options: [{ value: '1', text: 'Покупатель' }, { value: '2', text: 'Продавец' }], condition: null, defaultValue: '' },
        { id: 'ticket[fields][2]', name: 'Номер заказа', type: 'text', required: true, options: [], condition: '{"type":"equals","fieldId":3,"value":2}', defaultValue: '' },
        { id: 'ticket[comment][body_html]', name: 'Сообщение', type: 'textarea', required: true, options: [], condition: null, defaultValue: '' }
    ]
};

async function openSupportPage(browser, { dark = false, viewport = { width: 1204, height: 789 }, mode = {} } = {}) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
            const asset = path.join(root, pathname);
            if (fs.existsSync(asset)) return route.fulfill({ path: asset });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"><span class="user-link-name">qa-seller</span></a></li></ul><main id="content"></main></body></html>`);
    await page.evaluate(({ tickets, details, categories, fields, mode }) => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { fpToolsNavCollapsed: false };
        window.qaState = state;
        window.qaMessages = [];
        window.qaMode = mode;
        window.qaTickets = tickets;
        const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        async function answer(message) {
            const mode = window.qaMode;
            await delay(mode.slow || 30);
            switch (message.action) {
                case 'supportGetTickets':
                    if (mode.ticketsError) return { success: false, error: 'Не авторизован на FunPay' };
                    return { success: true, tickets: mode.noTickets ? [] : window.qaTickets };
                case 'supportGetTicketDetails': return { success: true, ...structuredClone(details) };
                case 'supportAddComment': return mode.replyError ? { success: false, error: 'Слишком часто' } : { success: true };
                case 'supportCloseTicket':
                    window.qaTickets = window.qaTickets.map(ticket => ticket.id === message.ticketId ? { ...ticket, status: 'Закрыта' } : ticket);
                    return { success: true };
                case 'supportGetCategories': return { success: true, categories };
                case 'supportGetFields': return { success: true, fields: fields[message.categoryId] || [] };
                case 'supportCreateTicket': return mode.createError && !window.qaCreateFailed++ ? { success: false, error: 'Сервер поддержки недоступен' } : { success: true, ticketId: '120100' };
                case 'getUnconfirmedOrders':
                    if (mode.noOrders) return { success: true, orderIds: [], orders: [], youngerCount: 2 };
                    return { success: true, orderIds: ['AB12CD34', 'EF56GH78'], orders: [{ id: 'AB12CD34', ageHours: 52 }, { id: 'EF56GH78', ageHours: 30.5 }], youngerCount: 1 };
                default: return { success: true, ok: true, data: [] };
            }
        }
        window.qaCreateFailed = 0;
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = structuredClone(get(keys)); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) { Object.assign(state, structuredClone(patch)); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) {
                    window.qaMessages.push(structuredClone(message));
                    const result = answer(message);
                    result.then(value => callback?.(value));
                    return result;
                },
                onMessage: { addListener() {} }
            }
        };
    }, { tickets: TICKETS, details: DETAILS, categories: CATEGORIES, fields: FIELDS, mode });

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    await page.locator('#fpToolsButton').click();
    await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
    if (dark) {
        await page.evaluate(() => {
            window.fptComputePalette = () => ({ dark: true });
            fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
        });
    }
    await page.evaluate(() => window.fptOpenPopupPage('tickets'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'tickets');
    await page.locator('.fpt-sp .fpt-sp-hero').waitFor();
    return { page, errors };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
});
const sent = (page, action) => page.evaluate(name => window.qaMessages.filter(message => message.action === name), action);
const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const rowIds = page => page.locator('.fpt-sp-ticket').evaluateAll(rows => rows.map(row => row.dataset.ticketId));

test('support page: tickets load on open, filter, search and sort locally', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser, { mode: { slow: 200 } });
        // Loading state first, then the list.
        await page.locator('.fpt-sp-skeleton').waitFor();
        assert.equal((await page.locator('.fpt-sp-hero .fpt-sp-pill').textContent()).trim(), 'Загрузка…');
        await page.locator('.fpt-sp-ticket').first().waitFor();
        assert.equal((await sent(page, 'supportGetTickets')).length, 1, 'the list loads once when the page opens');
        assert.equal(await page.locator('.fpt-sp-metric').count(), 0, 'the hero has no metric tiles');
        assert.deepEqual(await page.locator('.fpt-sp-seg-count').allTextContents(), ['4', '2', '2']);
        assert.equal((await page.locator('.fpt-sp-hero .fpt-sp-pill').textContent()).trim(), '2 актуальные');
        assert.deepEqual(await rowIds(page), ['120045', '119870', '118511', '117004']);
        assert.deepEqual(await page.locator('.fpt-sp-ticket .fpt-sp-status').evaluateAll(items => items.map(item => item.dataset.kind)), ['open', 'pending', 'solved', 'closed']);
        assert.equal(await page.locator('.fpt-sp-ticket[data-kind="open"] .fpt-sp-row-action').count(), 1, 'only active tickets offer closing');
        const heights = await page.locator('.fpt-sp-hero-actions .fpt-sp-button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().height)));
        assert.deepEqual(heights, [40, 40], 'hero buttons share one height');
        if (shotDir) {
            await settle(page);
            await page.screenshot({ path: path.join(shotDir, 'support-light.png') });
            await page.locator('.fpt-sp-list-card').screenshot({ path: path.join(shotDir, 'support-list.png') });
        }

        await page.locator('.fpt-sp-seg-button[data-value="active"]').click();
        assert.deepEqual(await rowIds(page), ['120045', '119870']);
        await page.keyboard.press('ArrowRight');
        assert.deepEqual(await rowIds(page), ['118511', '117004']);

        await page.locator('.fpt-sp-seg-button[data-value="all"]').click();
        await page.locator('#fp-tickets-search').fill('#1185');
        assert.deepEqual(await rowIds(page), ['118511']);
        await page.locator('#fp-tickets-search').fill('нет такого');
        await page.locator('.fpt-sp-empty-title', { hasText: 'Ничего не найдено' }).waitFor();
        await page.locator('.fpt-sp-empty .fpt-sp-button').click();
        assert.equal(await page.locator('#fp-tickets-search').inputValue(), '');
        assert.equal(await page.locator('.fpt-sp-ticket').count(), 4);

        await page.locator('.fpt-sp-sort .fpt-select-trigger').click();
        await page.locator('.fpt-sp-sort .fpt-select-option', { hasText: 'Сначала старые' }).click();
        assert.deepEqual(await rowIds(page), ['117004', '118511', '119870', '120045']);

        // Refresh keeps the list on screen while it reloads.
        await page.locator('#fp-ticket-refresh-btn').click();
        assert.equal(await page.locator('.fpt-sp-ticket').count(), 4);
        await page.waitForFunction(() => window.qaMessages.filter(message => message.action === 'supportGetTickets').length === 2);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('support page: a conversation opens, renders safe HTML, replies and closes the ticket', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser);
        await page.locator('.fpt-sp-ticket-open').first().click();
        await page.locator('.fpt-sp-msg').first().waitFor();
        assert.equal(await page.locator('.fpt-sp-home').isHidden(), true);
        assert.equal((await page.locator('#fp-ticket-detail-title').textContent()).trim(), 'Покупатель не подтверждает заказ');
        assert.equal(await page.locator('.fpt-sp-thread-meta .fpt-sp-status').getAttribute('data-kind'), 'open');
        assert.deepEqual(await page.locator('.fpt-sp-msg').evaluateAll(rows => rows.map(row => row.dataset.side)), ['me', 'them']);
        assert.equal(await page.locator('#fp-tdm script, #fp-tdm [onclick], #fp-tdm [onerror]').count(), 0, 'site markup is rebuilt from an allow-list');
        assert.equal(await page.locator('#fp-tdm a[href="https://support.funpay.com/help/orders"]').count(), 1, 'relative links point at the support site');
        assert.equal(await page.evaluate(() => window.qaPwned), undefined);
        assert.equal((await sent(page, 'supportGetTicketDetails'))[0].ticketId, '120045');
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'support-thread.png') }); }

        assert.equal(await page.locator('#fp-ticket-reply-btn').isDisabled(), true, 'an empty reply cannot be sent');
        await page.locator('#fp-tri').fill('Спасибо, жду.\nЗаказ <AB12CD34>');
        await page.locator('#fp-tri').press('Enter');
        await page.waitForFunction(() => window.qaMessages.some(message => message.action === 'supportAddComment'));
        const [reply] = await sent(page, 'supportAddComment');
        assert.deepEqual({ ...reply, message: reply.message }, { action: 'supportAddComment', ticketId: '120045', message: 'Спасибо, жду.\nЗаказ <AB12CD34>', token: 'reply-token' });
        await page.locator('.fpt-popup-toast', { hasText: 'Ответ отправлен.' }).waitFor();
        await page.waitForFunction(() => window.qaMessages.filter(message => message.action === 'supportGetTicketDetails').length === 2);
        assert.equal(await page.locator('#fp-tri').inputValue(), '');

        // Closing asks first, then reloads the ticket and the list.
        await page.locator('.fpt-sp-thread-tools .fpt-sp-button--danger').click();
        await page.locator('.fpt-sp-dialog').waitFor();
        await page.locator('.fpt-sp-dialog .fpt-lot-dialog-button--danger').click();
        await page.waitForFunction(() => window.qaMessages.some(message => message.action === 'supportCloseTicket'));
        await page.locator('.fpt-popup-toast', { hasText: 'Заявка #120045 закрыта.' }).waitFor();

        await page.locator('#fp-ticket-detail-back').click();
        assert.equal(await page.locator('.fpt-sp-thread').isHidden(), true);
        await page.waitForFunction(() => document.querySelector('[data-ticket-id="120045"]')?.dataset.kind === 'closed');
        assert.equal(await page.evaluate(() => document.activeElement.closest('[data-ticket-id]')?.dataset.ticketId), '120045', 'focus returns to the ticket');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('support page: a new ticket is built from the site form and sent only after the preview', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser, { mode: { createError: true } });
        await page.locator('.fpt-sp-ticket').first().waitFor();
        await page.locator('#fp-create-ticket-btn').click();
        await page.locator('.fpt-sp-topic').first().waitFor();
        assert.equal(await page.locator('#fp-new-ticket-submit').isDisabled(), true);
        assert.equal(await page.locator('.fpt-sp-dialog select, .fpt-sp-dialog .fpt-select-trigger').count(), 0, 'no dropdown to be clipped by the dialog');
        assert.deepEqual(await page.locator('.fpt-sp-topic').allTextContents(), ['Подтверждение заказа', 'Проблема с выводом средств']);
        const tile = await page.locator('.fpt-sp-topic').first().boundingBox();
        assert.ok(tile.width >= 220 && tile.height >= 44, `topic tiles are roomy: ${JSON.stringify(tile)}`);
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'support-topics.png') }); }
        await page.locator('.fpt-sp-topic', { hasText: 'Подтверждение заказа' }).click();
        await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][1]"] input').waitFor();
        assert.equal(await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][1]"] input').inputValue(), 'qa-seller', 'the nickname is filled in');
        assert.equal(await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][2]"]').isHidden(), true, 'conditional fields wait for their trigger');
        await page.locator('.fpt-sp-choice', { hasText: 'Продавец' }).click();
        assert.equal(await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][2]"]').isVisible(), true);

        // Required fields are checked before the preview.
        await page.locator('#fp-new-ticket-submit').click();
        await page.locator('.fpt-sp-form-field[data-invalid="true"]').waitFor();
        await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][2]"] input').fill('AB12CD34');
        await page.locator('.fpt-sp-form-field[data-field-id="ticket[comment][body_html]"] textarea').fill('Покупатель не выходит на связь.');
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'support-new-ticket.png') }); }
        await page.locator('#fp-new-ticket-submit').click();
        await page.locator('#fp-ticket-confirm-text').waitFor();
        const preview = await page.locator('#fp-ticket-confirm-text').textContent();
        assert.match(preview, /Тема: Подтверждение заказа/);
        assert.match(preview, /Ваша роль: Продавец/);
        assert.match(preview, /Сообщение:\nПокупатель не выходит на связь\./);
        assert.equal((await sent(page, 'supportCreateTicket')).length, 0, 'nothing is sent before confirmation');

        // Back returns to the filled-in form.
        await page.locator('#fp-ticket-confirm-no').click();
        await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][2]"] input').waitFor();
        assert.equal(await page.locator('.fpt-sp-form-field[data-field-id="ticket[fields][2]"] input').inputValue(), 'AB12CD34');
        assert.equal(await page.locator('.fpt-sp-form-field[data-field-id="ticket[comment][body_html]"] textarea').inputValue(), 'Покупатель не выходит на связь.');
        await page.locator('#fp-new-ticket-submit').click();

        // A failed send keeps the preview open for another try.
        await page.locator('#fp-ticket-confirm-yes').click();
        await page.locator('.fpt-popup-toast[data-kind="error"]', { hasText: 'Сервер поддержки недоступен' }).waitFor();
        assert.equal(await page.locator('#fp-ticket-confirm-text').isVisible(), true);
        await page.locator('#fp-ticket-confirm-yes').click();
        await page.locator('.fpt-popup-toast', { hasText: 'Заявка #120100 отправлена.' }).waitFor();
        await page.locator('.fpt-sp-dialog').waitFor({ state: 'detached' });
        const created = await sent(page, 'supportCreateTicket');
        assert.equal(created.length, 2);
        assert.equal(created[1].categoryId, '1');
        assert.equal(created[1].message, 'Покупатель не выходит на связь.');
        assert.deepEqual(created[1].fieldValues, { 'ticket[fields][1]': 'qa-seller', 'ticket[fields][3]': '2', 'ticket[fields][2]': 'AB12CD34' });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('support page: order confirmation collects old orders, remembers limits and confirms before sending', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser);
        // Typed values are centred and digits-only; the stepper buttons and arrow keys move by one.
        assert.equal(await page.locator('#fp-ticket-age-hours').evaluate(input => getComputedStyle(input).textAlign), 'center');
        await page.locator('#fp-ticket-age-hours').fill('3a5');
        assert.equal(await page.locator('#fp-ticket-age-hours').inputValue(), '35');
        await page.locator('#fp-ticket-age-hours').press('ArrowUp');
        assert.equal(await page.locator('#fp-ticket-age-hours').inputValue(), '36');
        await page.locator('#fp-ticket-max-orders').fill('19');
        await page.locator('#fp-ticket-max-orders').blur();
        await page.locator('.fpt-sp-number').nth(1).locator('.fpt-sp-step').nth(1).click();
        assert.equal(await page.locator('.fpt-sp-number').nth(1).locator('.fpt-sp-step').nth(1).isDisabled(), true, 'plus stops at the maximum');
        await page.locator('#fp-ticket-max-orders').fill('50');
        await page.locator('#fp-ticket-max-orders').blur();
        await page.waitForFunction(() => window.qaState.fpToolsSupportAutoTicket?.maxOrders === 20);
        assert.deepEqual(await page.evaluate(() => window.qaState.fpToolsSupportAutoTicket), { ageHours: 36, maxOrders: 20 });
        assert.equal(await page.locator('#fp-ticket-max-orders').inputValue(), '20', 'out-of-range values are clamped');

        await page.locator('#fp-send-auto-ticket-btn').click();
        await page.locator('#fp-ticket-confirm-text').waitFor();
        const [request] = await sent(page, 'getUnconfirmedOrders');
        assert.equal(request.ageHours, 36);
        assert.equal(request.maxOrders, 20);
        assert.deepEqual(await page.locator('.fpt-sp-order-chip').allTextContents(), ['2 дн#AB12CD34north_east', '30 ч#EF56GH78north_east']);
        assert.match(await page.locator('#fp-ticket-confirm-text').textContent(), /Прошу подтвердить заказы: AB12CD34, EF56GH78\. С уважением, qa-seller!/);
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'support-auto-preview.png') }); }
        await page.locator('#fp-ticket-confirm-yes').click();
        await page.locator('#fp-auto-ticket-status[data-kind="success"]').waitFor();
        const [created] = await sent(page, 'supportCreateTicket');
        assert.equal(created.fieldValues['ticket[fields][2]'], 'AB12CD34, EF56GH78');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('support page: no orders, load errors and the empty list explain themselves', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser, { mode: { ticketsError: true, noOrders: true } });
        await page.locator('.fpt-sp-empty[data-kind="error"]').waitFor();
        assert.match(await page.locator('.fpt-sp-empty-text').textContent(), /Не авторизован на FunPay/);
        assert.deepEqual(await page.locator('.fpt-sp-seg-count').allTextContents(), ['', '', ''], 'unknown counts are not shown as zero');
        assert.equal(await page.locator('#fp-tickets-search').isDisabled(), true);

        await page.locator('#fp-send-auto-ticket-btn').click();
        await page.locator('#fp-auto-ticket-status').waitFor();
        assert.match(await page.locator('#fp-auto-ticket-status').textContent(), /старше 24 ч нет\. Моложе — 2/);
        assert.equal(await page.locator('.fpt-sp-dialog').count(), 0, 'nothing to confirm without orders');

        await page.evaluate(() => { window.qaMode = { noTickets: true }; });
        await page.locator('.fpt-sp-empty .fpt-sp-button').click();
        await page.locator('.fpt-sp-empty-title', { hasText: 'Заявок пока нет' }).waitFor();
        assert.equal((await page.locator('.fpt-sp-hero .fpt-sp-pill').textContent()).trim(), 'Открытых заявок нет');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('support page: dark popup and narrow widths stay inside the frame', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openSupportPage(browser, { dark: true });
        await page.locator('.fpt-sp-ticket').first().waitFor();
        await settle(page);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'support-dark.png') });
        const checkOverflow = async width => {
            const overflow = await page.evaluate(() => {
                const view = document.querySelector('.fpt-sp');
                const limit = view.getBoundingClientRect().right + 1;
                const wide = Array.from(view.querySelectorAll('*')).filter(el => el.getClientRects().length && el.getBoundingClientRect().right > limit)
                    .slice(0, 5).map(el => `${el.className} ${Math.round(el.getBoundingClientRect().right - limit)}`);
                return { ok: view.scrollWidth <= view.clientWidth + 1 && !wide.length, wide };
            });
            assert.equal(overflow.ok, true, `the screen must not overflow horizontally at ${width}px: ${JSON.stringify(overflow)}`);
        };
        for (const width of [860, 560]) {
            await page.setViewportSize({ width, height: 800 });
            await settle(page);
            if (shotDir) await page.screenshot({ path: path.join(shotDir, `support-dark-${width}.png`) });
            await checkOverflow(width);
        }
        await page.locator('.fpt-sp-ticket-open').first().click();
        await page.locator('.fpt-sp-msg').first().waitFor();
        await settle(page);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'support-dark-thread-560.png') });
        await checkOverflow(560);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
