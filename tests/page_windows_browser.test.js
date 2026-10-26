// Real-browser checks for the windows the extension opens on FunPay pages (content/ui/page_windows.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;
const launch = () => chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

const SOURCE = {
    summary_ru: 'Exitlag подписка 365 дней', summary_en: 'Exitlag subscription 365 days',
    desc_ru: 'После оплаты вы получите лицензионный ключ.', desc_en: 'You will receive a license key after payment.',
    enDiffers: true, attributePairs: [{ label: 'Тип устройства', value: 'PC' }, { label: 'Срок подписки', value: '12 месяцев' }],
    images: [], categoryName: 'Подписка ExitLag', sellerName: 'Niffleheim', nodeId: 1234, finalPrice: 450
};
const BODY = `
    <h1 class="page-header page-header-no-hr">Редактирование предложения</h1>
    <form class="form-offer-editor">
        <div class="form-group"><label>Сервер</label><select class="form-control" name="server_id"><option value="10">EU</option><option value="11">NA</option></select></div>
        <div class="auto-delivery-box"><textarea class="textarea-lot-secrets">KEY-1\nKEY-2</textarea><div class="help-block"></div></div>
        <input name="amount" value="2">
    </form>`;

async function openPage(browser, { dark = false, viewport = { width: 1280, height: 860 }, body = BODY, initial = {}, url = 'https://funpay.com/' } = {}) {
    const page = await browser.newPage({ viewport });
    const errors = [], requests = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        requests.push(route.request().url());
        const requestUrl = new URL(route.request().url());
        if (requestUrl.hostname === 'translate.googleapis.com') return route.fulfill({ json: [[[`RU:${requestUrl.searchParams.get('q')}`]]] });
        const pathname = requestUrl.pathname;
        if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
            const asset = path.join(root, pathname);
            if (fs.existsSync(asset)) return route.fulfill({ path: asset });
        }
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
    });
    await page.goto(url);
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}">${body}</body></html>`);
    await page.evaluate(([source, initial]) => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = structuredClone(initial);
        window.qaStorage = state;
        window.qaMessages = [];
        const replies = { cloneGetSource: { success: true, source, fields: { node_id: '1234' }, csrf: 'x' } };
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const list = keys == null ? Object.keys(state) : Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys); const value = Object.fromEntries(list.filter(key => Object.hasOwn(state, key)).map(key => [key, structuredClone(state[key])])); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) { Object.assign(state, patch); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) {
                    window.qaMessages.push(structuredClone(message));
                    const result = message?.action === 'translateLotText'
                        ? { success: true, data: Object.fromEntries(Object.entries(message.data).map(([key, text]) => [key, 'EN:' + text])) }
                        : replies[message?.action] || { success: true, ok: true, data: [] };
                    callback?.(result);
                    return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            }
        };
    }, [SOURCE, initial]);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(root, js) });
    await page.evaluate(() => document.fonts.ready);
    if (dark) await page.evaluate(() => { window.fptComputePalette = () => ({ dark: true }); });
    return { page, errors, requests };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
});

const serverRequest = url => /fptools\.onrender\.com|fptools-ai-server\.vercel\.app|fpt-descs\.starobinskiy01\.workers\.dev|https:\/\/funpay\.tools\//.test(url);

test('release: chat, review and lot AI stay absent after focus and dynamic markup; translations and manual images work', async () => {
    const browser = await launch();
    try {
        const body = BODY.replace('</form>', `
            <div class="lot-fields-multilingual"><ul class="nav-tabs"><li data-locale="en"><a href="#">English</a></li></ul></div>
            <input name="fields[summary][ru]" value="Название"><input name="fields[summary][en]">
            <textarea name="fields[desc][ru]">Описание</textarea><textarea name="fields[desc][en]"></textarea>
            <textarea name="fields[payment_msg][ru]">Спасибо</textarea><textarea name="fields[payment_msg][en]"></textarea>
            <div class="lot-field" data-id="images"><div class="attachments-box"></div></div>
            </form>`) + `
            <form class="chat-form" id="qa-chat"><input name="node" value="44">
                <div class="chat-form-input" id="comments"><textarea class="form-control">existing draft</textarea></div>
                <div class="chat-form-attach"></div><button type="submit">Отправить</button>
            </form>
            <div class="review-item-answer-form"><textarea name="text"></textarea><button class="btn" data-action="save">Опубликовать</button></div>`;
        const { page, errors, requests } = await openPage(browser, { body, initial: {
            aiModeActive: true,
            fpToolsSlashCommands: { enabled: true, autocomplete: false, expandKey: 'tab', commands: [{ id: '1', trigger: '/ready', response: 'Обычный ответ' }] }
        }, url: 'https://funpay.com/lots/offerEdit?node=1234' });
        const hidden = '#aiModeToggleBtn, #fpToolsProfanityWarning, #fp-tools-ai-gen-btn, #fp-tools-ai-gen-modal, #fp-tools-ai-review-reply-btn, #fp-rmthub-form';
        await page.locator('#fpToolsGenerateImageBtn').waitFor();
        await page.evaluate(() => window.fptReloadSlashCommands());
        await page.locator('.chat-form-input textarea').fill('/ready');
        await page.locator('.chat-form-input textarea').press('Tab');
        assert.equal(await page.inputValue('.chat-form-input textarea'), 'Обычный ответ');
        await page.locator('.chat-form-input textarea').focus();
        await page.locator('.chat-form-input textarea').fill('message');
        assert.equal(await page.locator('#fp-chat-char-count').textContent(), '7');
        assert.equal(await page.locator(hidden).count(), 0);
        assert.equal(await page.evaluate(() => aiModeActive), false);
        assert.equal(await page.evaluate(() => window.qaStorage.aiModeActive), true);
        const enterPrevented = await page.evaluate(() => {
            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
            document.querySelector('.chat-form-input textarea').dispatchEvent(event);
            return event.defaultPrevented;
        });
        assert.equal(enterPrevented, false, 'disabled AI does not intercept Enter');
        // The production mutation observer is throttled at 500 ms.
        await page.waitForTimeout(550);
        await page.evaluate(() => {
            document.getElementById('fpToolsGenerateImageBtn').closest('.generate-btn-container').remove();
            const review = document.querySelector('.review-item-answer-form');
            review.replaceWith(review.cloneNode(true));
        });
        await page.locator('#fpToolsGenerateImageBtn').waitFor();
        assert.equal(await page.locator(hidden).count(), 0, 'dynamic initialization cannot restore AI');
        assert.equal(await page.evaluate(() => translateText('Hello')), 'RU:Hello');
        await page.click('#fp-tools-translate-btn');
        assert.equal(await page.inputValue('input[name="fields[summary][en]"]'), 'EN:Название');
        assert.equal(await page.inputValue('textarea[name="fields[desc][en]"]'), 'EN:Описание');
        assert.equal(await page.inputValue('textarea[name="fields[payment_msg][en]"]'), 'EN:Спасибо');

        await page.click('#fpToolsGenerateImageBtn');
        await page.locator('#fpToolsImageGeneratorModal.is-open').waitFor();
        assert.equal(await page.locator('#igAiPrompt, #igAiGenerateBtn, .fp-tools-ig-ai-generator').count(), 0);
        const before = await page.locator('#fpToolsImageCanvas').evaluate(canvas => canvas.toDataURL());
        await page.locator('.fp-tools-ig-tab[data-tab="text"]').click();
        await page.fill('#igText1', 'MANUAL IMAGE');
        const after = await page.locator('#fpToolsImageCanvas').evaluate(canvas => canvas.toDataURL());
        assert.notEqual(after, before, 'manual settings redraw the canvas');
        const downloadPromise = page.waitForEvent('download');
        await page.evaluate(() => imageGeneratorInstance.saveToComputer());
        const download = await downloadPromise;
        assert.match(download.suggestedFilename(), /^funpay-image-\d+\.png$/);
        await download.delete();
        assert.deepEqual(requests.filter(serverRequest), []);
        assert.equal(await page.evaluate(() => window.qaMessages.filter(message => ['getAIProcessedText', 'generateAILot', 'getAIImageSettings', 'rmthubFetch'].includes(message.action)).length), 0);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('release: own and other profiles keep cached data and do not mount server descriptions', async () => {
    const browser = await launch();
    try {
        for (const id of ['1', '2']) {
            const initial = { aiModeActive: true, fptProfileSession: { token: 'retained' }, fptProfileDescrCache: { [id]: { description: 'retained description' } } };
            const { page, errors, requests } = await openPage(browser, {
                url: `https://funpay.com/users/${id}/`, initial,
                body: '<div class="profile-header"><div class="profile-header-cols">Profile</div></div>'
            });
            await page.evaluate(() => {
                const profile = document.querySelector('.profile-header-cols');
                profile.append(document.createElement('span'));
                window.dispatchEvent(new PopStateEvent('popstate'));
            });
            assert.equal(await page.locator('.fpt-pd, .fpt-pd-row, #fp-rmthub-form').count(), 0);
            const saved = await page.evaluate(() => window.qaStorage);
            for (const key of Object.keys(initial)) assert.deepEqual(saved[key], initial[key]);
            assert.deepEqual(requests.filter(serverRequest), []);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally { await browser.close(); }
});

test('page windows: lot copy uses the menu palette, switches languages and closes like a dialog', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openPage(browser);
        await page.evaluate(() => {
            const button = document.createElement('button');
            button.id = 'qa-trigger';
            document.body.appendChild(button);
            button.focus();
            openCloneWizard('42');
        });
        await page.locator('#fp-clone-wizard .fp-cw-grid').waitFor();
        await settle(page);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'page-window-clone-light.png') });

        const look = await page.evaluate(() => {
            const scrim = document.getElementById('fp-clone-wizard-overlay');
            const dialog = document.getElementById('fp-clone-wizard');
            const primary = document.getElementById('fp-cw-create');
            return {
                themed: scrim.classList.contains('fptm-themed') && scrim.classList.contains('fptm-light'),
                accent: getComputedStyle(primary).backgroundColor,
                dialogBg: getComputedStyle(dialog).backgroundColor,
                radius: getComputedStyle(dialog).borderTopLeftRadius,
                subtitle: dialog.querySelector('.fpt-win-sub').textContent,
                role: dialog.getAttribute('role'),
                modal: dialog.getAttribute('aria-modal'),
                labelled: !!document.getElementById(dialog.getAttribute('aria-labelledby'))
            };
        });
        assert.equal(look.themed, true, 'the window gets the menu palette');
        assert.equal(look.accent, 'rgb(118, 99, 246)', 'primary actions use the menu accent');
        assert.equal(look.dialogBg, 'rgb(255, 255, 255)');
        assert.equal(look.radius, '22px');
        assert.equal(look.subtitle, 'Подписка ExitLag · продавец Niffleheim');
        assert.equal(look.role, 'dialog');
        assert.equal(look.modal, 'true');
        assert.equal(look.labelled, true);

        await page.locator('#fp-clone-wizard .fpt-win-seg-btn[data-tab="en"]').click();
        assert.equal(await page.locator('#fp-cw-summary-en').isVisible(), true, 'EN pane is shown');
        assert.equal(await page.locator('#fp-cw-summary-ru').isVisible(), false, 'RU pane is hidden');

        await page.fill('#fp-cw-find', 'Exitlag');
        await page.fill('#fp-cw-replace', 'ExitLag');
        await page.click('#fp-cw-apply-replace');
        assert.equal(await page.inputValue('#fp-cw-summary-ru'), 'ExitLag подписка 365 дней');

        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('fp-clone-wizard-overlay').classList.contains('is-open'));
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'qa-trigger', 'focus returns to the opener');

        await page.evaluate(() => openCloneWizard('42'));
        await page.locator('#fp-clone-wizard .fp-cw-grid').waitFor();
        await page.mouse.click(10, 10);
        await page.waitForFunction(() => !document.getElementById('fp-clone-wizard-overlay').classList.contains('is-open'));
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('page windows: stacked windows close one at a time and dark pages get the dark menu palette', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openPage(browser, { dark: true });
        await page.evaluate(() => initializeAutoDeliveryManager());
        await page.locator('#ad-open-manager-btn').click();
        await page.locator('#fp-tools-ad-manager-popup.is-open .ad-item-input').first().waitFor();
        assert.equal(await page.locator('#fp-tools-ad-manager-popup .ad-item-input').count(), 2, 'the manager lists the existing items');
        await page.locator('#ad-mass-add-btn').click();
        await page.locator('#ad-mass-add-popup.is-open').waitFor();
        await settle(page);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'page-window-stacked-dark.png') });

        const dark = await page.evaluate(() => ({
            themed: document.getElementById('ad-mass-add-popup').classList.contains('fptm-dark'),
            bg: getComputedStyle(document.querySelector('#ad-mass-add-popup .fpt-win')).backgroundColor
        }));
        assert.equal(dark.themed, true);
        assert.equal(dark.bg, 'rgb(30, 31, 36)', 'dark windows use the dark menu surface');

        await page.fill('#ad-mass-add-textarea', 'KEY-3\nKEY-4');
        await page.click('#ad-mass-add-confirm');
        await page.waitForFunction(() => !document.getElementById('ad-mass-add-popup').classList.contains('is-open'));
        assert.equal(await page.locator('#fp-tools-ad-manager-popup .ad-item-input').count(), 4);

        await page.locator('#ad-duplicate-btn').click();
        await page.locator('#ad-duplicate-popup.is-open').waitFor();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('ad-duplicate-popup').classList.contains('is-open'));
        assert.equal(await page.evaluate(() => document.getElementById('fp-tools-ad-manager-popup').classList.contains('is-open')), true,
            'Escape closes only the top window');

        await page.click('#ad-manager-save-btn');
        await page.waitForFunction(() => !document.getElementById('fp-tools-ad-manager-popup').classList.contains('is-open'));
        assert.equal(await page.inputValue('textarea.textarea-lot-secrets'), 'KEY-1\nKEY-2\nKEY-3\nKEY-4');
        assert.equal(await page.inputValue('input[name="amount"]'), '4');

        // «Отмена» discards edits; Escape keeps them, like the manager's old close button.
        const editLast = async value => {
            await page.locator('#ad-open-manager-btn').click();
            await page.locator('#fp-tools-ad-manager-popup.is-open').waitFor();
            await page.locator('#fp-tools-ad-manager-popup .ad-item-input').last().fill(value);
        };
        await editLast('KEY-CANCELLED');
        await page.click('#ad-manager-cancel-btn');
        await page.waitForFunction(() => !document.getElementById('fp-tools-ad-manager-popup').classList.contains('is-open'));
        assert.equal(await page.inputValue('textarea.textarea-lot-secrets'), 'KEY-1\nKEY-2\nKEY-3\nKEY-4');
        await editLast('KEY-KEPT');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('fp-tools-ad-manager-popup').classList.contains('is-open'));
        assert.equal(await page.inputValue('textarea.textarea-lot-secrets'), 'KEY-1\nKEY-2\nKEY-3\nKEY-KEPT');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('page windows: narrow screens show windows as bottom sheets without horizontal overflow', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openPage(browser, { viewport: { width: 420, height: 820 } });
        await page.evaluate(() => openCloneWizard('42'));
        await page.locator('#fp-clone-wizard .fp-cw-grid').waitFor();
        await settle(page);
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'page-window-clone-420.png') });
        const geometry = await page.evaluate(() => {
            const dialog = document.getElementById('fp-clone-wizard');
            const body = dialog.querySelector('.fpt-win-body');
            const rect = dialog.getBoundingClientRect();
            return {
                overflow: body.scrollWidth - body.clientWidth,
                left: rect.left, right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom,
                columns: getComputedStyle(dialog.querySelector('.fp-cw-grid')).gridTemplateColumns.split(' ').length
            };
        });
        assert.equal(geometry.overflow, 0);
        assert.ok(geometry.left >= 11 && geometry.right >= 11, 'the window keeps its side gutters');
        assert.ok(geometry.bottom <= 13, 'the window sits at the bottom of the screen');
        assert.equal(geometry.columns, 1, 'the two columns stack');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
