const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openAutoReply(browser, autoReplies) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
    await page.setContent('<html><head></head><body><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>');
    await page.evaluate(initial => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { showSalesStats: false, viewSellersPromo: false, hideBalance: true, fpToolsNavCollapsed: false, fpToolsAutoReplies: initial };
        window.qaState = state;
        window.qaPatches = [];
        window.qaDirectWrites = [];
        window.qaStale = false;
        const get = keys => keys == null ? { ...state }
            : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys]).map(key => [key, state[key]]));
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = get(keys); callback?.(value); return Promise.resolve(value); },
                set(values, callback) { window.qaDirectWrites.push(Object.keys(values)); Object.assign(state, structuredClone(values)); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`, getManifest: () => ({ version: 'test' }), id: 'qa',
                // Mirrors background/auto_reply_store.js for the operations the screen uses.
                sendMessage(message, callback) {
                    let result = { success: true, data: [], ok: true };
                    if (message?.action === 'fptPatchAutoReplies') {
                        window.qaPatches.push(structuredClone(message.patch));
                        if (window.qaStale) {
                            result = { ok: false, code: 'STALE_AUTO_REPLY_EDIT', error: 'The keywords list changed.' };
                        } else {
                            const current = structuredClone(state.fpToolsAutoReplies || {});
                            const patch = message.patch || {};
                            Object.assign(current, structuredClone(patch.set || {}));
                            for (const [field, operations] of Object.entries(patch.arrayOps || {})) {
                                const list = Array.isArray(current[field]) ? current[field] : [];
                                for (const operation of operations) {
                                    if (operation.op === 'append') list.push(structuredClone(operation.value));
                                    else if (operation.op === 'upsert') list[operation.index] = structuredClone(operation.value);
                                    else if (operation.op === 'remove') list.splice(operation.index, 1);
                                }
                                current[field] = list;
                            }
                            state.fpToolsAutoReplies = current;
                            result = { ok: true, autoReplies: current };
                        }
                    }
                    callback?.(result);
                    return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            }
        };
        window.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => '' });
    }, autoReplies);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(root, js) });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    await page.locator('#fpToolsButton').click();
    await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
    await page.evaluate(() => window.fptOpenPopupPage('auto_reply'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'auto_reply');
    await page.locator('.fpt-auto-reply').waitFor();
    await page.waitForFunction(() => document.querySelector('.fpt-ar-pill')?.textContent !== 'Загрузка…');
    return { page, errors };
}

// Cards expand with a transition; typing starts only once the editor has its final size.
const settle = page => page.waitForFunction(() => document.getAnimations()
    .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
    .every(animation => animation.playState === 'finished'));

const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

test('autoresponder: empty settings show collapsed scenarios, an empty rule list and write nothing on open', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAutoReply(browser, {});
        assert.equal(await page.locator('.fpt-ar-pill').innerText(), 'Выключен');
        assert.deepEqual(await page.locator('.fpt-ar-card[data-scenario]').evaluateAll(cards => cards.map(card => card.dataset.state)), ['off', 'off', 'off']);
        assert.equal(await page.locator('.fpt-ar-card[data-scenario] .fpt-ar-collapse').evaluateAll(nodes => nodes.every(node => node.inert)), true,
            'collapsed scenario editors are not reachable by keyboard');
        assert.equal(await page.locator('.fpt-ar-rule-list .fpt-ad-list-state--empty').count(), 1);
        assert.equal(await page.locator('.fpt-ar-add:visible').count(), 1, 'the empty state carries the only visible add button');
        assert.equal(await page.locator('.fpt-auto-reply h3').filter({ hasText: 'Приветствие новых покупателей' }).count(), 1, 'scenario titles are h3 so popup search can index them');
        const writes = await page.evaluate(() => ({ patches: window.qaPatches.length, direct: window.qaDirectWrites.filter(keys => keys.includes('fpToolsAutoReplies')).length }));
        assert.deepEqual(writes, { patches: 0, direct: 0 });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('autoresponder: scenarios save through the store patch with explicit unsaved state and validation', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAutoReply(browser, {});
        const greeting = page.locator('.fpt-ar-card[data-scenario="greeting"]');
        await greeting.locator('#fpt-ar-greeting-enabled').evaluate(input => input.click());
        await page.waitForFunction(() => document.querySelector('.fpt-ar-card[data-scenario="greeting"]')?.dataset.state === 'on');
        await settle(page);
        assert.deepEqual(await page.evaluate(() => window.qaPatches), [{ set: { greetingEnabled: true } }], 'a switch saves immediately and only its own field');
        assert.equal(await greeting.locator('textarea').inputValue(), 'Здравствуйте! Чем могу помочь?');
        assert.equal(await page.locator('.fpt-ar-pill').innerText(), 'Работает');
        assert.equal(await greeting.locator('.fpt-ar-save').isDisabled(), true, 'nothing to save yet');

        await greeting.locator('textarea').fill('Привет, {buyername}!');
        await greeting.locator('.fpt-ad-variable-chip[data-template-token="{welcome}"]').click();
        assert.equal(await greeting.locator('textarea').inputValue(), 'Привет, {buyername}!{welcome}', 'a chip inserts its token at the caret');
        assert.equal(await greeting.locator('.fpt-ar-unsaved').isVisible(), true);
        await greeting.locator('input[type="number"]').fill('2');
        await greeting.locator('.fpt-ar-save').click();
        await page.waitForFunction(() => window.qaPatches.length === 2);
        const saved = await page.evaluate(() => window.qaPatches[1]);
        assert.deepEqual(saved, { set: {
            greetingText: 'Привет, {buyername}!{welcome}', greetingImages: [], greetingSendOrder: 'text_first', greetingCooldownDays: 2
        } });
        await page.waitForFunction(() => document.querySelector('.fpt-ar-card[data-scenario="greeting"] .fpt-ar-unsaved')?.hidden);
        assert.equal(await page.locator('.fpt-ar-metric-value').nth(2).innerText(), 'Через 2 дня');

        const order = page.locator('.fpt-ar-card[data-scenario="newOrder"]');
        await order.locator('#fpt-ar-newOrder-enabled').evaluate(input => input.click());
        await page.waitForFunction(() => document.querySelector('.fpt-ar-card[data-scenario="newOrder"]')?.dataset.state === 'on');
        await settle(page);
        assert.equal(await order.locator('.fpt-ad-variable-chip[data-template-token="{lotname}"]').count(), 0, 'only variables the engine fills for this event are offered');
        assert.equal(await order.locator('.fpt-ad-variable-chip[data-template-token="{orderlink}"]').count(), 1);
        const before = await page.evaluate(() => window.qaPatches.length);
        await order.locator('textarea').fill('x');
        await order.locator('textarea').fill('');
        assert.equal(await order.locator('.fpt-ar-save').isDisabled(), true, 'an empty draft equal to the saved value is not savable');
        await order.locator('textarea').fill('  ');
        await order.locator('.fpt-ar-save').click();
        assert.equal(await order.locator('.fpt-ar-field-error').isVisible(), true, 'empty text is rejected with an inline alert');
        assert.equal(await page.evaluate(() => window.qaPatches.length), before, 'an invalid draft is not sent');
        await order.locator('.fpt-ar-revert').click();
        assert.equal(await order.locator('textarea').inputValue(), '');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('autoresponder: images attach, order is chosen and the saved reply keeps them', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAutoReply(browser, { newOrderReplyEnabled: true, newOrderReplyText: 'Спасибо!' });
        const card = page.locator('.fpt-ar-card[data-scenario="newOrder"]');
        assert.equal(await card.locator('.fpt-ar-order-row').isHidden(), true, 'send order is meaningless without a picture');
        await card.locator('.fpt-ar-file').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
        await card.locator('.fpt-ar-thumb').waitFor();
        assert.equal(await card.locator('.fpt-ar-order-row').isVisible(), true);
        await card.locator('.fpt-ar-seg-button[data-value="image_first"]').click();
        assert.equal(await card.locator('.fpt-ar-seg-button[data-value="image_first"]').getAttribute('aria-checked'), 'true');
        await card.locator('.fpt-ar-save').click();
        await page.waitForFunction(() => window.qaPatches.length === 1);
        const patch = await page.evaluate(() => window.qaPatches[0]);
        assert.equal(patch.set.newOrderReplyImages.length, 1);
        assert.match(patch.set.newOrderReplyImages[0], /^data:image\/png;base64,/);
        assert.equal(patch.set.newOrderReplySendOrder, 'image_first');
        await card.locator('.fpt-ar-thumb-remove').click();
        assert.equal(await card.locator('.fpt-ar-thumb').count(), 0);
        assert.equal(await card.locator('.fpt-ar-unsaved').isVisible(), true, 'removing a saved picture is an unsaved change');

        await card.locator('.fpt-ar-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') });
        await page.waitForSelector('.fpt-popup-toast, .fpt-ar-image-status:not(:empty)');
        assert.equal(await card.locator('.fpt-ar-thumb').count(), 0, 'non-image files are refused');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('autoresponder: keyword rules are added, edited and removed with indexed store operations', async () => {
    const browser = await launch();
    try {
        const rule = { keyword: 'гарантия', response: 'Есть', matchMode: 'contains', extra: 'kept' };
        const { page, errors } = await openAutoReply(browser, { keywordsEnabled: true, keywords: [rule] });
        assert.equal(await page.locator('.fpt-ar-rule').count(), 1);
        assert.equal(await page.locator('.fpt-ar-search').isHidden(), true, 'search appears only for longer lists');

        await page.locator('.fpt-ar-keywords-toolbar .fpt-ar-add').click();
        const dialog = page.locator('.fpt-lot-dialog');
        await dialog.locator('.fpt-ar-input').fill('когда доставка?');
        await dialog.locator('.fpt-lot-dialog-button--primary').click();
        assert.equal(await dialog.locator('.fpt-ar-field-error:not([hidden])').count(), 1, 'a rule needs text or a picture');
        assert.equal(await page.evaluate(() => window.qaPatches.length), 0);
        await dialog.locator('textarea').fill('Привет, {buyername}!');
        await dialog.locator('.fpt-lot-dialog-button--primary').click();
        await page.locator('.fpt-lot-dialog').waitFor({ state: 'detached' });
        assert.deepEqual(await page.evaluate(() => window.qaPatches[0]), { arrayOps: { keywords: [{ op: 'append',
            value: { keyword: 'когда доставка?', response: 'Привет, {buyername}!', matchMode: 'exact' } }] } });
        assert.equal(await page.locator('.fpt-ar-rule').count(), 2);

        await page.locator('.fpt-ar-rule').first().getByRole('button', { name: /Изменить/ }).click();
        await page.locator('.fpt-lot-dialog .fpt-ar-input').fill('гарантия 7 дней');
        await page.locator('.fpt-lot-dialog .fpt-lot-dialog-button--primary').click();
        await page.locator('.fpt-lot-dialog').waitFor({ state: 'detached' });
        const update = await page.evaluate(() => window.qaPatches[1].arrayOps.keywords[0]);
        assert.equal(update.op, 'upsert');
        assert.equal(update.index, 0);
        assert.deepEqual(update.expected, rule, 'the edit is guarded by the rule as it was loaded');
        assert.equal(update.value.keyword, 'гарантия 7 дней');
        assert.equal(update.value.extra, 'kept', 'fields the screen does not know about survive an edit');

        await page.locator('.fpt-ar-rule').nth(1).getByRole('button', { name: /Удалить/ }).click();
        await page.locator('.fpt-lot-dialog .fpt-lot-dialog-button--danger').click();
        await page.locator('.fpt-lot-dialog').waitFor({ state: 'detached' });
        const removal = await page.evaluate(() => window.qaPatches[2].arrayOps.keywords[0]);
        assert.equal(removal.op, 'remove');
        assert.equal(removal.index, 1);
        assert.equal(removal.expected.keyword, 'когда доставка?');
        assert.equal(await page.locator('.fpt-ar-rule').count(), 1);

        await page.evaluate(() => { window.qaStale = true; });
        await page.locator('.fpt-ar-rule').first().getByRole('button', { name: /Удалить/ }).click();
        await page.locator('.fpt-lot-dialog .fpt-lot-dialog-button--danger').click();
        await page.locator('.fpt-lot-dialog').waitFor({ state: 'detached' });
        // Toasts are queued by the shared component, so assert the effect rather than waiting for the warning.
        assert.equal(await page.evaluate(() => window.qaPatches.length), 4, 'the stale delete reached the store');
        assert.equal(await page.locator('.fpt-ar-rule').count(), 1, 'a stale delete leaves the list intact');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('autoresponder: disabled keyword rules stay visible with an explanation and fit narrow popups', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openAutoReply(browser, {
            keywordsEnabled: false,
            keywords: Array.from({ length: 7 }, (_, index) => ({ keyword: `правило ${index}`, response: 'Ответ '.repeat(40), matchMode: 'contains' })),
            greetingEnabled: true, greetingText: 'Привет'
        });
        assert.equal(await page.locator('.fpt-ar-rule').count(), 7);
        assert.equal(await page.locator('.fpt-ar-disabled-note').isVisible(), true);
        assert.equal(await page.locator('.fpt-ar-search').isVisible(), true);
        await page.locator('.fpt-ar-search').fill('правило 3');
        assert.equal(await page.locator('.fpt-ar-rule').count(), 1);
        await page.locator('.fpt-ar-search').fill('нет такого');
        assert.equal(await page.locator('.fpt-ar-rule-list .fpt-ad-list-state--empty').count(), 1);
        for (const width of [1000, 740, 520]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(380);
            const fit = await page.locator('.fpt-auto-reply').evaluate(view => ({ client: view.clientWidth, scroll: view.scrollWidth }));
            assert.ok(fit.scroll <= fit.client + 1, `${width}px: autoresponder overflowed (${fit.scroll} > ${fit.client})`);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
