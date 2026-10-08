const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;
const DAY = 86400000;

async function openBlacklistPage(browser, { dark = false, viewport = { width: 1204, height: 789 }, seed = {} } = {}) {
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
    await page.setContent(`<html><head></head><body style="background:${dark ? '#101014' : '#f2f2f6'}"><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>`);
    await page.evaluate(initial => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { fpToolsNavCollapsed: false, ...initial };
        const listeners = [];
        window.qaState = state;
        const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
        const notify = changes => listeners.forEach(listener => listener(changes, 'local'));
        window.qaNotify = notify;
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = structuredClone(get(keys)); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) {
                    const changes = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { oldValue: state[key], newValue: structuredClone(value) }]));
                    Object.assign(state, structuredClone(patch));
                    notify(changes); callback?.(); return Promise.resolve();
                },
                remove(keys, callback) {
                    const changes = {};
                    (Array.isArray(keys) ? keys : [keys]).forEach(key => { changes[key] = { oldValue: state[key] }; delete state[key]; });
                    notify(changes); callback?.(); return Promise.resolve();
                }
            }, onChanged: { addListener(listener) { listeners.push(listener); } } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`,
                getManifest: () => ({ version: 'test' }),
                id: 'qa',
                sendMessage(message, callback) { const result = { success: true, ok: true, data: [] }; callback?.(result); return Promise.resolve(result); },
                onMessage: { addListener() {} }
            }
        };
    }, seed);

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
    await page.evaluate(() => window.fptOpenPopupPage('blacklist'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'blacklist');
    await page.locator('.fpt-bl .fpt-bl-add-form').waitFor();
    return { page, errors };
}

const settle = page => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(document.getAnimations()
        .filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => undefined)));
    await new Promise(resolve => setTimeout(resolve, 420));
});
const launch = () => chromium.launch({
    executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
});
const stored = page => page.evaluate(() => structuredClone(window.qaState.fpToolsBlacklist || []));
const names = page => page.locator('.fpt-bl-row .fpt-bl-name').allTextContents();
const seedEntries = () => {
    const now = Date.now();
    return [
        { username: 'scammer_777', note: 'Открыл арбитраж после выдачи', blockDelivery: true, blockResponse: true, addedAt: now - 3 * DAY },
        { username: 'RudeBuyer', note: '', blockDelivery: false, blockResponse: true, addedAt: now - 2 * 3600000 },
        { username: 'quiet', note: 'Попросил не писать', blockDelivery: false, blockResponse: false, addedAt: now - 40 * DAY }
    ];
};

test('blacklist page: empty state, adding with flags, duplicates and validation', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openBlacklistPage(browser);
        await page.locator('.fpt-bl-empty').waitFor();
        assert.match(await page.locator('.fpt-bl-hero .fpt-qr-pill').textContent(), /Список пуст/);
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'blacklist-empty.png') }); }

        await page.locator('#fp-bl-add-btn').click();
        assert.match(await page.locator('.fpt-bl-error').textContent(), /Укажите ник/);
        assert.equal(await page.locator('#fptBlUsername').getAttribute('aria-invalid'), 'true');

        await page.locator('#fptBlUsername').fill('Cheater');
        await page.locator('#fptBlNote').fill('Чарджбэк');
        await page.locator('.fpt-bl-add .fpt-bl-chip[data-flag="blockDelivery"]').click();
        await page.locator('#fptBlUsername').press('Enter');
        await page.locator('.fpt-bl-row').first().waitFor();
        assert.deepEqual(await names(page), ['Cheater']);
        const [entry] = await stored(page);
        assert.equal(entry.note, 'Чарджбэк');
        assert.equal(entry.blockDelivery, false);
        assert.equal(entry.blockResponse, true);
        assert.equal(await page.locator('#fptBlUsername').inputValue(), '');
        assert.equal(await page.locator('.fpt-bl-row .fpt-bl-chip[data-flag="blockDelivery"]').getAttribute('aria-pressed'), 'false');

        await page.locator('#fptBlUsername').fill('cheater');
        await page.locator('#fp-bl-add-btn').click();
        assert.match(await page.locator('.fpt-bl-error').textContent(), /уже в списке/);
        assert.equal((await stored(page)).length, 1, 'duplicates are not written');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('blacklist page: rows toggle flags, edit notes, search, remove and follow outside changes', async () => {
    const browser = await launch();
    try {
        const { page, errors } = await openBlacklistPage(browser, { seed: { fpToolsBlacklist: seedEntries() } });
        await page.locator('.fpt-bl-row').nth(2).waitFor();
        assert.deepEqual(await names(page), ['RudeBuyer', 'scammer_777', 'quiet'], 'newest first');
        assert.deepEqual(await page.locator('.fpt-bl-hero .fpt-qr-metric-value').allTextContents(), ['3', '1', '2']);
        assert.equal(await page.locator('.fpt-bl-row[data-user="quiet"] .fpt-bl-tag--idle').count(), 1);
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'blacklist-list.png') }); }

        await page.locator('.fpt-bl-row[data-user="rudebuyer"] .fpt-bl-chip[data-flag="blockDelivery"]').click();
        await page.waitForFunction(() => window.qaState.fpToolsBlacklist.find(item => item.username === 'RudeBuyer').blockDelivery === true);
        assert.equal(await page.locator('.fpt-bl-row[data-user="rudebuyer"] .fpt-bl-chip[data-flag="blockDelivery"]').getAttribute('aria-pressed'), 'true');

        await page.locator('.fpt-bl-row[data-user="rudebuyer"] .fpt-bl-edit').click();
        await page.locator('.fpt-bl-note-edit').fill('Хамил в чате');
        if (shotDir) { await settle(page); await page.locator('.fpt-bl-list-section').screenshot({ path: path.join(shotDir, 'blacklist-edit.png') }); }
        await page.locator('.fpt-bl-note-edit').press('Enter');
        await page.waitForFunction(() => window.qaState.fpToolsBlacklist.find(item => item.username === 'RudeBuyer').note === 'Хамил в чате');
        assert.equal(await page.locator('.fpt-bl-row[data-user="rudebuyer"] .fpt-bl-note').textContent(), 'Хамил в чате');

        await page.locator('.fpt-bl-row[data-user="scammer_777"] .fpt-bl-delete').click();
        await page.locator('.fpt-lot-dialog .fpt-qr-danger').click();
        await page.waitForFunction(() => !window.qaState.fpToolsBlacklist.some(item => item.username === 'scammer_777'));
        await page.waitForFunction(() => !document.querySelector('.fpt-bl-row[data-user="scammer_777"]'));
        assert.deepEqual(await names(page), ['RudeBuyer', 'quiet']);

        // Added from a buyer's chat while the popup is open.
        await page.evaluate(() => chrome.storage.local.set({ fpToolsBlacklist: [...window.qaState.fpToolsBlacklist,
            { username: 'FromChat', note: 'Добавлен из чата', blockDelivery: true, blockResponse: true, addedAt: Date.now() }] }));
        await page.locator('.fpt-bl-row[data-user="fromchat"]').waitFor();
        assert.deepEqual(await names(page), ['FromChat', 'RudeBuyer', 'quiet']);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('blacklist page: search appears for long lists; dark theme and narrow popup keep the layout', async () => {
    const browser = await launch();
    try {
        const many = Array.from({ length: 8 }, (_, index) => ({
            username: `buyer${index}`, note: index === 5 ? 'мошенник' : '', blockDelivery: index % 2 === 0, blockResponse: true, addedAt: Date.now() - index * DAY
        }));
        const { page, errors } = await openBlacklistPage(browser, { dark: true, seed: { fpToolsBlacklist: many } });
        await page.locator('.fpt-bl-row').nth(7).waitFor();
        assert.equal(await page.locator('.fpt-bl-search').isVisible(), true);
        await page.locator('.fpt-bl-search').fill('мошен');
        assert.deepEqual(await names(page), ['buyer5']);
        await page.locator('.fpt-bl-search').fill('nobody');
        assert.match(await page.locator('.fpt-bl-empty').textContent(), /Ничего не найдено/);
        await page.locator('.fpt-bl-empty .fpt-qr-button').click();
        assert.equal(await page.locator('.fpt-bl-row').count(), 8);
        if (shotDir) { await settle(page); await page.screenshot({ path: path.join(shotDir, 'blacklist-dark.png') }); }

        await page.setViewportSize({ width: 560, height: 900 });
        await settle(page);
        const overflow = await page.evaluate(() => {
            const view = document.querySelector('.fpt-bl');
            return [...view.querySelectorAll('*')].some(node => node.getBoundingClientRect().right > view.getBoundingClientRect().right + 1);
        });
        assert.equal(overflow, false, 'nothing sticks out of the screen at narrow widths');
        if (shotDir) await page.screenshot({ path: path.join(shotDir, 'blacklist-narrow.png') });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
