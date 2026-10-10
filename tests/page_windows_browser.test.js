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

async function openPage(browser, { dark = false, viewport = { width: 1280, height: 860 } } = {}) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const pathname = new URL(route.request().url()).pathname;
        if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
            const asset = path.join(root, pathname);
            if (fs.existsSync(asset)) return route.fulfill({ path: asset });
        }
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}">${BODY}</body></html>`);
    await page.evaluate(([source]) => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = {};
        const replies = { cloneGetSource: { success: true, source, fields: { node_id: '1234' }, csrf: 'x' } };
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = {}; callback?.(value); return Promise.resolve(value); },
                set(patch, callback) { Object.assign(state, patch); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) {
                    const result = replies[message?.action] || { success: true, ok: true, data: [] };
                    callback?.(result);
                    return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            }
        };
    }, [SOURCE]);
    const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
    await page.evaluate(() => document.fonts.ready);
    if (dark) await page.evaluate(() => { window.fptComputePalette = () => ({ dark: true }); });
    return { page, errors };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
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
