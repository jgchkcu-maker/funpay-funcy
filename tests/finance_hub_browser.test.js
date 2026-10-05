// Real-browser check of the Finance Hub screen with seeded sales, purchases, operations and lots.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const shotDir = process.env.FPT_SCREENSHOT_DIR;

const DARK = {
    '--fptm-bg': '#1e1f24', '--fptm-text': '#e7e8ec', '--fptm-muted': 'rgba(231,232,236,0.76)', '--fptm-faint': 'rgba(231,232,236,0.56)',
    '--fptm-accent': '#7663f6', '--fptm-accent-soft': 'rgba(118,99,246,0.22)', '--fptm-accent-border': 'rgba(118,99,246,0.5)',
    '--fptm-nav-border': 'rgba(255,255,255,0.10)', '--fptm-nav-field': '#2a2e37', '--fptm-hover': 'rgba(255,255,255,0.07)',
    '--fptm-shadow': 'rgba(0,0,0,0.55)', '--fptm-success': '#80d9ad', '--fptm-danger': '#ff9aa3', '--fptm-warning': '#ffd27a',
    '--fptm-success-soft': 'rgba(128,217,173,.12)', '--fptm-danger-soft': 'rgba(255,154,163,.12)', '--fptm-warning-soft': 'rgba(255,210,122,.12)',
    '--fptm-success-border': 'rgba(128,217,173,.34)', '--fptm-danger-border': 'rgba(255,154,163,.34)', '--fptm-warning-border': 'rgba(255,210,122,.34)',
    '--fptm-color-scheme': 'dark'
};

function seed() {
    const DAY = 86400000;
    const now = Date.now();
    const categories = ['Аккаунты Genshin Impact', 'Игровая валюта', 'Ключи Steam', 'Подписки', 'Услуги бустинга', 'Предметы Dota 2', 'Скины CS2'];
    const products = ['Аккаунт AR 55 с примогемами', '1000 алмазов', 'Ключ Cyberpunk 2077', 'Подписка Spotify 12 мес.', 'Буст ранга до Legend', 'Сет Immortal', 'Нож Karambit'];
    const buyers = ['kirill_77', 'AnnaPlay', 'dmitry.k', 'NoobMaster', 'alex_gamer', 'zhenya', 'olga_tt'];
    const orders = [];
    const purchases = [];
    let seq = 1000;
    for (let i = 0; i < 150; i++) {
        const daysAgo = Math.floor((i * 37) % 75) + (i % 3) * 0.17;
        const idx = (i * 5) % categories.length;
        const price = [350, 1200, 2490, 750, 4100, 890, 15200][idx] * (0.6 + ((i * 13) % 9) / 10);
        const status = i % 17 === 0 ? 'refunded' : (i % 6 === 0 ? 'paid' : 'closed');
        const usd = i % 11 === 0;
        orders.push({
            orderId: `QA${seq++}`, orderDate: now - daysAgo * DAY - (i % 5) * 3600000, orderStatus: status,
            price: usd ? Math.round(price / 90 * 100) / 100 : Math.round(price * 100) / 100, currency: usd ? 'USD' : 'RUB',
            description: products[idx], subcategoryName: categories[idx], buyerUsername: buyers[(i * 3) % buyers.length], buyerId: 100 + (i % 7),
            ...(status === 'closed' && i % 3 !== 0 ? { costBasisSnapshot: Math.round((usd ? price / 90 : price) * 0.55 * 100) / 100, costBasisCurrency: usd ? 'USD' : 'RUB', costBasisCapturedAt: now } : {})
        });
    }
    for (let i = 0; i < 40; i++) {
        const daysAgo = (i * 53) % 80;
        const idx = (i * 3) % categories.length;
        purchases.push({
            orderId: `PU${seq++}`, orderDate: now - daysAgo * DAY, orderStatus: i % 9 === 0 ? 'paid' : 'closed',
            price: [200, 640, 1500, 90, 3000, 410, 980][idx], currency: 'RUB', description: products[idx], subcategoryName: categories[idx],
            sellerUsername: ['gamestore', 'KeyShop', 'FastBoost', 'ProSeller'][i % 4], sellerId: 500 + (i % 4)
        });
    }
    const operations = [];
    for (let i = 0; i < 60; i++) {
        const daysAgo = (i * 29) % 85;
        const kind = i % 5;
        const amount = [1850, 5000, 12000, 640, 2300][kind] + i * 10;
        const type = ['order', 'payment', 'withdraw', 'order', 'order'][kind];
        const signed = type === 'withdraw' ? -amount : amount;
        operations.push({
            id: `op${i}`, type, status: i % 13 === 0 ? 'waiting' : 'complete',
            title: type === 'order' ? `Заказ #QA${1000 + i}` : type === 'payment' ? 'Пополнение баланса' : 'Вывод денег на карту',
            amount, signed, currency: 'RUB', date: now - daysAgo * DAY, dateText: '', wallet: 'main'
        });
    }
    const lots = categories.flatMap((category, c) => [0, 1, 2].map(n => ({
        offerId: String(9000 + c * 10 + n), title: `${products[c]} — вариант ${n + 1}`, category, active: true,
        stock: n === 2 ? null : (c + 1) * (n + 2) * 3, stockKind: n === 2 ? 'unknown' : 'finite',
        sellerPrice: [350, 1200, 2490, 750, 4100, 890, 15200][c] * (1 + n * 0.1), buyerPrice: null, currency: 'RUB', costBasis: n === 1 ? null : [200, 700, 1500, 400, 2500, 500, 9000][c]
    })));
    return { orders, purchases, operations, lots };
}

async function boot({ width = 1204, height = 900, data = seed() } = {}) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
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
    await page.evaluate(seedData => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
        const state = { fpToolsSalesLastUpdate: Date.now() - 3600000, fpToolsPurchasesLastUpdate: Date.now() - 7200000, fpToolsFinanceLastUpdate: Date.now() - 5400000 };
        window.qaState = state;
        window.qaMessages = [];
        window.qaFailRefresh = false;
        window.qaData = seedData;
        const get = keys => keys == null ? { ...state } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, state[key]]));
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = get(keys); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) { Object.assign(state, structuredClone(patch)); callback?.(); return Promise.resolve(); },
                remove(keys, callback) { callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`, getManifest: () => ({ version: 'test' }), id: 'qa',
                sendMessage(message, callback) {
                    qaMessages.push(structuredClone(message));
                    const d = qaData;
                    let result = { success: true };
                    switch (message.action) {
                        case 'getSalesOrders': result = { success: true, orders: d.orders }; break;
                        case 'getSalesCount': result = { success: true, count: d.orders.length }; break;
                        case 'getPurchaseOrders': result = { success: true, orders: d.purchases }; break;
                        case 'getPurchaseCount': result = { success: true, count: d.purchases.length }; break;
                        case 'getFinanceTxns': result = { success: true, txns: d.operations }; break;
                        case 'getFinanceCount': result = { success: true, count: d.operations.length }; break;
                        case 'updateSales': case 'updatePurchases': case 'updateFinance':
                            result = qaFailRefresh && message.action === 'updatePurchases' ? { success: false, error: 'Нет авторизации' } : { success: true };
                            if (!qaFailRefresh) state.fpToolsSalesLastUpdate = Date.now();
                            break;
                        default: result = { success: true, ok: true, data: [] };
                    }
                    callback?.(result);
                    return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            }
        };
    }, data);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    await page.evaluate(() => {
        window.FPTPotential.getInventory = async () => window.qaData.lots.map(lot => window.FPTPotential.calculateRowPotential(lot));
    });
    await page.locator('#fpToolsButton').click();
    await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
    await page.evaluate(() => window.fptOpenPopupPage('finance_hub'));
    await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'finance_hub');
    return { browser, page, errors };
}

const applyTheme = (page, dark) => page.evaluate(({ isDark, values }) => {
    const popup = document.querySelector('.fp-tools-popup');
    popup.classList.toggle('fptm-dark', isDark);
    popup.classList.toggle('fptm-light', !isDark);
    document.documentElement.classList.toggle('fpt-theme-dark', isDark);
    if (isDark) for (const [name, value] of Object.entries(values)) popup.style.setProperty(name, value);
    else for (const name of Object.keys(values)) popup.style.removeProperty(name);
    document.body.style.backgroundColor = isDark ? '#15161a' : '#fff';
}, { isDark: dark, values: DARK });

const shot = async (page, name) => {
    if (!shotDir) return;
    fs.mkdirSync(shotDir, { recursive: true });
    await page.waitForTimeout(700);
    const popup = page.locator('.fp-tools-popup');
    await page.screenshot({ path: path.join(shotDir, `${name}.png`) });
    // Full-length capture: grow the popup to the content height for review.
    const full = await page.locator('.fp-tools-page-content.active').evaluate(el => el.scrollHeight);
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: viewport.width, height: Math.min(full + 200, 4000) });
    await page.addStyleTag({ content: '.fp-tools-popup{height:auto!important;max-height:none!important}.fp-tools-content,.fp-tools-page-content{max-height:none!important;overflow:visible!important}' }).then(handle => handle.evaluate(el => { el.dataset.qaShot = '1'; }));
    await page.waitForTimeout(400);
    await popup.screenshot({ path: path.join(shotDir, `${name}-full.png`) });
    await page.evaluate(() => document.querySelectorAll('style[data-qa-shot]').forEach(el => el.remove()));
    await page.setViewportSize(viewport);
};

test('finance hub renders every tab with seeded data and responds to filters', async () => {
    const { browser, page, errors } = await boot();
    try {
        await page.locator('.fpt-finance .fpt-fin-kpi').first().waitFor();
        const icons = new Set();
        const collectIcons = async () => (await page.locator('.fpt-finance .material-symbols-rounded').allTextContents()).forEach(name => icons.add(name.trim()));
        await collectIcons();
        assert.equal(await page.locator('.fpt-fin-tab').count(), 6);
        assert.equal(await page.locator('.fpt-fin-tab.is-active').getAttribute('data-mode'), 'overview');
        assert.equal(await page.locator('.fpt-fin-tab-pane[data-subtab="overview"]').count(), 1);
        assert.equal(await page.locator('.fpt-fin-kpi').count(), 8, 'overview has eight KPI cards');
        await page.locator('.fpt-fin-line').first().waitFor();
        assert.ok(await page.locator('.fpt-fin-line').count() >= 1, 'the dynamics chart is drawn');
        await page.waitForSelector('.fpt-fin-statusline span');
        await page.locator('.fp-tools-page-content.active').evaluate(element =>
            Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
        assert.match(await page.locator('.fpt-fin-statusline').textContent(), /Данные обновлены/);
        await shot(page, 'overview-light');
        await applyTheme(page, true);
        await shot(page, 'overview-dark');
        await applyTheme(page, false);

        // Chart hover shows a tooltip.
        const hit = page.locator('.fpt-fin-chart--line .fpt-fin-hit').first();
        await page.waitForTimeout(500); // the chart redraws once when the layout settles
        await hit.scrollIntoViewIfNeeded();
        const box = await hit.boundingBox();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
        await page.locator('.fpt-fin-tip:not([hidden])').waitFor();
        assert.match(await page.locator('.fpt-fin-tip:not([hidden])').textContent(), /₽/);

        // Metric switch redraws the chart.
        await page.getByRole('button', { name: 'Заказы', exact: true }).first().click();
        await page.waitForFunction(() => /Заказы/.test(document.querySelector('.fpt-fin-card--chart .fpt-fin-card-sub')?.textContent || ''));

        for (const [tabId, selector] of [['sales', '.fpt-fin-table'], ['purchases', '.fpt-fin-hbars'], ['profit', '.fpt-fin-meter'], ['potential', '.fpt-fin-table'], ['operations', '.fpt-fin-donut']]) {
            await page.locator(`#fptFinTab${tabId[0].toUpperCase()}${tabId.slice(1)}`).click();
            await page.waitForFunction(id => document.querySelector(`.fpt-fin-tab-pane[data-subtab="${id}"] .fpt-fin-kpi`), tabId);
            assert.ok(await page.locator(`.fpt-fin-tab-pane[data-subtab="${tabId}"] ${selector}`).count() > 0, `${tabId} renders ${selector}`);
            assert.equal(await page.locator('.fp-tools-page-content.active').getAttribute('data-fpt-page-mode'), tabId);
            await collectIcons();
            await shot(page, `${tabId}-light`);
        }
        // Every icon ligature exists in the bundled (subset) icon font; a missing one would render as plain text.
        const broken = await page.evaluate(async names => {
            await document.fonts.load('24px "Material Symbols Rounded"');
            const probe = document.createElement('span');
            probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:24px "Material Symbols Rounded";font-feature-settings:"liga";';
            document.body.appendChild(probe);
            const bad = [];
            for (const name of names) { probe.textContent = name; if (probe.getBoundingClientRect().width > 34) bad.push(name); }
            probe.remove();
            return bad;
        }, Array.from(icons).filter(Boolean));
        assert.deepEqual(broken, [], 'icons missing from the bundled font');
        await applyTheme(page, true);
        for (const tabId of ['sales', 'profit', 'operations']) {
            await page.locator(`#fptFinTab${tabId[0].toUpperCase()}${tabId.slice(1)}`).click();
            await page.waitForFunction(id => document.querySelector(`.fpt-fin-tab-pane[data-subtab="${id}"] .fpt-fin-kpi`), tabId);
            await shot(page, `${tabId}-dark`);
        }
        await applyTheme(page, false);

        // Filters: the 7-day period shows fewer sales than the 90-day one.
        await page.locator('#fptFinTabSales').click();
        await page.waitForFunction(() => document.querySelector('.fpt-fin-tab-pane[data-subtab="sales"] .fpt-fin-table'));
        const countFor = async period => {
            await page.locator('[data-field="period"] select').selectOption(period);
            await page.waitForTimeout(400);
            await page.waitForFunction(() => !document.querySelector('.fpt-fin-statusline[data-kind="loading"]'));
            return Number((await page.locator('.fpt-fin-table-count').first().textContent()).match(/из (\d+)/)?.[1] ?? 0);
        };
        const week = await countFor('7d');
        const quarter = await countFor('90d');
        assert.ok(week > 0 && quarter > week, `week ${week} < quarter ${quarter}`);

        // Paging: "show more" adds rows.
        const before = await page.locator('.fpt-fin-table tbody tr').count();
        await page.getByRole('button', { name: 'Показать ещё' }).click();
        assert.ok(await page.locator('.fpt-fin-table tbody tr').count() > before);

        // Custom range validation.
        await page.locator('[data-field="period"] select').selectOption('custom');
        await page.locator('#fptFinCustomApplyBtn').click();
        assert.match(await page.locator('.fpt-fin-range-error').textContent(), /корректный диапазон/);

        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('finance controls preserve unrelated cards and contain scrolling inside the popup', async () => {
    const { browser, page, errors } = await boot({ width: 1600 });
    try {
        await page.locator('.fpt-fin-kpi').first().waitFor();
        await page.locator('#fptFinTabPotential').click();
        await page.locator('.fpt-fin-tab-pane[data-subtab="potential"] .fpt-fin-kpi').first().waitFor();
        await page.evaluate(() => {
            window.qaKpi = document.querySelector('.fpt-fin-kpi');
            document.body.style.minHeight = '4000px';
        });
        await page.getByRole('button', { name: 'Без себестоимости', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-fin-chips [aria-pressed="true"]')?.textContent === 'Без себестоимости');
        assert.equal(await page.evaluate(() => window.qaKpi === document.querySelector('.fpt-fin-kpi')), true, 'table filtering preserves KPI DOM');
        await page.locator('#fptFinTabSales').click();
        await page.locator('.fpt-fin-tab-pane[data-subtab="sales"] .fpt-fin-kpi').first().waitFor();
        await page.evaluate(() => {
            window.qaKpi = document.querySelector('.fpt-fin-kpi');
            window.qaTable = document.querySelector('.fpt-fin-card--table');
            window.qaChartCard = document.querySelector('.fpt-fin-card--chart');
            window.qaMetricControl = document.querySelector('.fpt-fin-card-controls .fpt-fin-segmented');
            window.qaMetricPill = window.qaMetricControl.querySelector('.fpt-fin-seg-pill');
        });
        await page.getByRole('button', { name: 'Заказы', exact: true }).click();
        await page.waitForFunction(() => /Заказы/.test(document.querySelector('.fpt-fin-card--chart .fpt-fin-card-sub')?.textContent || ''));
        assert.equal(await page.evaluate(() => window.qaKpi === document.querySelector('.fpt-fin-kpi') && window.qaTable === document.querySelector('.fpt-fin-card--table')), true, 'chart switching preserves KPI and table DOM');
        assert.equal(await page.evaluate(() => window.qaChartCard === document.querySelector('.fpt-fin-card--chart') && window.qaMetricControl.isConnected && window.qaMetricPill === document.querySelector('.fpt-fin-card-controls .fpt-fin-seg-pill')), true, 'switching keeps the live card, controls and animating pill');
        assert.equal(await page.getByRole('button', { name: 'Заказы', exact: true }).evaluate(button => document.activeElement === button), true, 'switching preserves keyboard focus');
        await page.evaluate(() => Promise.all(window.qaMetricPill.getAnimations().map(animation => animation.finished.catch(() => undefined))));
        assert.ok(await page.evaluate(() => {
            const pill = window.qaMetricPill.getBoundingClientRect();
            const active = window.qaMetricControl.querySelector('[aria-pressed="true"]').getBoundingClientRect();
            return Math.abs(pill.left - active.left) < 1 && Math.abs(pill.width - active.width) < 1;
        }), 'pill finishes aligned with the selected button');
        await page.evaluate(() => {
            window.qaBlankFrames = 0;
            window.qaBodyObserver = new MutationObserver(() => {
                if (!document.querySelector('.fpt-fin-tab-pane[data-subtab="sales"] .fpt-fin-kpi')) window.qaBlankFrames++;
            });
            window.qaBodyObserver.observe(document.querySelector('.fpt-fin-body'), { childList: true, subtree: true });
        });
        await page.locator('[data-field="period"] select').selectOption('90d');
        await page.waitForFunction(() => !document.querySelector('.fpt-fin-statusline[data-kind="loading"]'));
        assert.equal(await page.evaluate(() => { window.qaBodyObserver.disconnect(); return window.qaBlankFrames; }), 0, 'global filters keep content visible while loading');
        const title = page.locator('.fp-tools-page-content.active .fpt-category-header');
        await title.hover();
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.scrollY), 0, 'wheel over popup header never scrolls FunPay');
        await page.locator('.fpt-fin-kpi').first().hover();
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(200);
        assert.ok(await page.evaluate(() => document.querySelector('.fp-tools-content').scrollTop) > 0, 'popup content still scrolls');
        assert.equal(await page.evaluate(() => window.scrollY), 0);
        await page.evaluate(() => { const content = document.querySelector('.fp-tools-content'); content.scrollTop = content.scrollHeight; });
        await page.locator('.fpt-fin-table').last().hover();
        await page.mouse.wheel(0, 1500);
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.scrollY), 0, 'bottom boundary does not chain scroll to FunPay');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('finance notifications preserve layout and the tab pill tracks responsive tabs', async () => {
    const { browser, page, errors } = await boot();
    const settle = () => page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.all(document.querySelector('.fp-tools-popup').getAnimations({ subtree: true })
            .filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined)));
    });
    const geometry = () => page.locator('.fpt-finance').evaluate(view => {
        const rect = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
        return [rect(view), rect(view.querySelector('.fpt-fin-tabs')), rect(view.querySelector('.fpt-fin-body'))];
    });
    const checkPill = async () => {
        await settle();
        const positions = await page.locator('.fpt-fin-tabs').evaluate(tabs => {
            const pill = tabs.querySelector('.fpt-fin-tab-pill').getBoundingClientRect();
            const active = tabs.querySelector('[aria-selected="true"]').getBoundingClientRect();
            return { count: tabs.querySelectorAll('.fpt-fin-tab-pill').length, x: pill.x - active.x, width: pill.width - active.width };
        });
        assert.equal(positions.count, 1);
        assert.ok(Math.abs(positions.x) <= 1 && Math.abs(positions.width) <= 1, JSON.stringify(positions));
    };
    try {
        await page.locator('.fpt-fin-kpi').first().waitFor();
        await settle();
        const before = await geometry();
        await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup');
            window.FPTPopupUI.showToast(popup, 'Overlay one', 'success', { durationMs: 650 });
            window.FPTPopupUI.showToast(popup, 'Overlay two', 'error', { durationMs: 650 });
        });
        await page.locator('.fpt-popup-toast').waitFor();
        assert.deepEqual(await geometry(), before, 'toast entry does not move page content');
        assert.equal(await page.locator('.fpt-popup-toast-region--page').evaluate(el => getComputedStyle(el).position), 'fixed');
        await page.locator('.fpt-popup-toast.is-leaving').waitFor();
        assert.deepEqual(await geometry(), before, 'toast exit does not move page content');
        await page.waitForFunction(() => document.querySelector('.fpt-popup-toast-text')?.textContent === 'Overlay two');
        await page.locator('.fpt-popup-toast').waitFor({ state: 'detached' });
        assert.deepEqual(await geometry(), before, 'the queue drains without moving content');
        await page.locator('#fptFinRefreshBtn').click();
        await page.waitForFunction(() => document.querySelector('.fpt-popup-toast-text')?.textContent === 'Данные обновлены');
        await settle();
        assert.deepEqual(await geometry(), before, 'refresh feedback does not move page content');
        const caption = page.locator('.fpt-fin-statusline');
        const captionHeight = (await caption.boundingBox()).height;
        await caption.evaluate(el => el.replaceChildren());
        assert.equal((await caption.boundingBox()).height, captionHeight, 'empty freshness caption retains its height');
        await checkPill();
        for (const mode of ['sales', 'purchases', 'profit', 'potential', 'operations', 'overview']) {
            await page.locator(`.fpt-fin-tab[data-mode="${mode}"]`).click();
            await page.locator(`.fpt-fin-tab-pane[data-subtab="${mode}"]`).waitFor();
            await page.mouse.move(0, 0);
            await checkPill();
        }
        await page.setViewportSize({ width: 520, height: 880 });
        await checkPill();
        assert.equal(await page.locator('.fpt-fin-tab-label:visible').count(), 1);
        await page.locator('.fpt-fin-tab[data-mode="sales"]').click();
        await page.mouse.move(0, 0);
        await checkPill();
        await applyTheme(page, true);
        await checkPill();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => window.FPTPopupUI.showToast(document.querySelector('.fp-tools-popup'), 'Reduced motion', 'success', { durationMs: 50 }));
        assert.equal(await page.locator('.fpt-popup-toast').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.locator('.fpt-popup-toast').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.fpt-fin-tab-pill').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('finance hub refresh reports partial failures and exports CSV', async () => {
    const { browser, page, errors } = await boot();
    try {
        await page.locator('.fpt-fin-kpi').first().waitFor();
        await page.evaluate(() => { window.qaFailRefresh = true; });
        await page.locator('#fptFinRefreshBtn').click();
        await page.waitForFunction(() => /Не удалось обновить: покупки/.test(document.querySelector('.fpt-fin-statusline')?.textContent || ''));
        const actions = (await page.evaluate(() => window.qaMessages)).map(message => message.action);
        for (const action of ['updateSales', 'updatePurchases', 'updateFinance']) assert.ok(actions.includes(action), action);

        await page.locator('#fptFinTabSales').click();
        await page.waitForFunction(() => document.querySelector('.fpt-fin-tab-pane[data-subtab="sales"] .fpt-fin-table'));
        await page.locator('#fptFinExportBtn').click();
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#fptFinExportDownloadCsv').click()]);
        assert.match(download.suggestedFilename(), /^funpay-sales-\d{4}-\d{2}-\d{2}\.csv$/);
        assert.deepEqual(errors.filter(message => !/Не удалось|Нет авторизации/.test(message)), []);
    } finally {
        await browser.close();
    }
});

test('finance screenshot layouts align controls and separate coverage and table filters', async () => {
    const { browser, page, errors } = await boot({ width: 1440 });
    const problems = [];
    const check = (passed, message) => { if (!passed) problems.push(message); };
    const settleLayout = () => page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.all(document.querySelector('.fp-tools-popup').getAnimations({ subtree: true })
            .filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined)));
    });
    const capture = async name => {
        if (!shotDir) return;
        fs.mkdirSync(shotDir, { recursive: true });
        const selector = name.startsWith('operations') ? '.fpt-fin-toolbar' : name.startsWith('potential') ? '.fpt-fin-card--table .fpt-fin-card-head' : '.fpt-fin-coverage';
        await page.locator(selector).screenshot({ path: path.join(shotDir, `${process.env.FPT_LAYOUT_STAGE || 'after'}-${name}.png`) });
    };
    try {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // FunPay uses Bootstrap's global label spacing. Load that baseline too.
        await page.addStyleTag({ content: 'label { display:inline-block; max-width:100%; margin-bottom:5px; font-weight:700; }' });
        await page.locator('#fptFinTabOperations').click();
        await page.locator('.fpt-fin-tab-pane[data-subtab="operations"] .fpt-fin-kpi').first().waitFor();
        await capture('operations-toolbar');
        const toolbar = await page.evaluate(() => {
            const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
            return [...document.querySelectorAll('.fpt-fin-field:not([hidden]) select, .fpt-fin-actions > button, .fpt-fin-actions .fpt-fin-export > button')].map(rect);
        });
        check(Math.max(...toolbar.map(r => r.bottom)) - Math.min(...toolbar.map(r => r.bottom)) <= 1, 'filters and action buttons share a bottom edge with FunPay styles');
        check(Math.max(...toolbar.map(r => r.height)) - Math.min(...toolbar.map(r => r.height)) <= 1, 'filters and actions share a height');

        await page.locator('#fptFinTabPotential').click();
        await page.locator('.fpt-fin-chips').waitFor();
        await capture('potential-filters');
        check(await page.evaluate(() => {
            const chips = document.querySelector('.fpt-fin-chips');
            const copy = chips.closest('.fpt-fin-card-head').querySelector('.fpt-fin-card-copy');
            return chips.getBoundingClientRect().top >= copy.getBoundingClientRect().bottom + 8 && chips.scrollWidth <= chips.clientWidth + 1;
        }), 'table filters have a separate row clear of the title and subtitle');
        for (const width of [900, 420]) {
            await page.setViewportSize({ width, height: 900 });
            await settleLayout();
            await capture(`potential-filters-${width}`);
            check(await page.locator('.fpt-fin-chips').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `table filters fit ${width}px screens`);
        }
        await page.setViewportSize({ width: 1440, height: 900 });

        await page.locator('#fptFinTabProfit').click();
        await page.locator('.fpt-fin-coverage').waitFor();
        await capture('profit-coverage');
        check(await page.evaluate(() => {
            const meter = document.querySelector('.fpt-fin-meter').getBoundingClientRect();
            const warning = document.querySelector('.fpt-fin-warning').getBoundingClientRect();
            const copy = document.querySelector('.fpt-fin-warning-copy').getBoundingClientRect();
            const button = document.querySelector('#fptFinProfitCostWarningAction').getBoundingClientRect();
            return warning.top >= meter.bottom + 10 && button.top >= copy.bottom + 8;
        }), 'coverage meter, explanation and action have separate spacing');
        await applyTheme(page, true);
        await capture('profit-coverage-dark');
        await applyTheme(page, false);
        for (const width of [900, 420]) {
            await page.setViewportSize({ width, height: 900 });
            await settleLayout();
            await capture(`profit-coverage-${width}`);
            check(await page.locator('.fpt-fin-coverage').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `coverage fits ${width}px screens`);
            check(await page.locator('#fptFinProfitCostWarningAction').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `full action label fits ${width}px screens`);
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(problems, []);
    } finally { await browser.close(); }
});

test('zero cost coverage keeps truthful totals and filters only its orders table', async () => {
    const data = seed();
    data.orders = Array.from({ length: 282 }, (_, i) => ({
        orderId: `missing-${i}`, orderDate: Date.now() - i * 86400000, orderStatus: 'closed',
        price: 1000, currency: 'RUB', description: `Заказ без себестоимости ${i + 1}`, subcategoryName: 'Аккаунты'
    }));
    const { browser, page, errors } = await boot({ width: 1440, data });
    try {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('#fptFinTabProfit').click();
        await page.locator('.fpt-fin-coverage').waitFor();
        await page.locator('[data-field="period"] select').selectOption('all');
        await page.waitForFunction(() => document.querySelector('.fpt-fin-coverage-text')?.textContent.includes('0 из 282'));
        assert.equal(await page.locator('.fpt-fin-coverage-value').textContent(), '0%');
        if (shotDir) {
            fs.mkdirSync(shotDir, { recursive: true });
            await page.locator('.fpt-fin-coverage').screenshot({ path: path.join(shotDir, 'after-profit-zero-coverage.png') });
        }
        await page.evaluate(() => { window.qaCoverage = document.querySelector('.fpt-fin-coverage'); window.qaKpi = document.querySelector('.fpt-fin-kpi'); });
        await page.locator('#fptFinProfitCostWarningAction').click();
        await page.waitForFunction(() => document.querySelector('.fpt-fin-chips [aria-pressed="true"]')?.textContent === 'Без себестоимости');
        assert.equal(await page.evaluate(() => window.qaCoverage === document.querySelector('.fpt-fin-coverage') && window.qaKpi === document.querySelector('.fpt-fin-kpi')), true);
        assert.match(await page.locator('[data-table-key="profit"] .fpt-fin-table-count').textContent(), /из 282/);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('finance hub shows onboarding when there is no data and fits a narrow popup', async () => {
    const { browser, page, errors } = await boot({ width: 520, data: { orders: [], purchases: [], operations: [], lots: [] } });
    try {
        await page.locator('.fpt-fin-state').waitFor();
        assert.match(await page.locator('.fpt-fin-state').textContent(), /Данных пока нет/);
        await shot(page, 'empty-narrow');
        assert.equal(await page.evaluate(() => {
            const view = document.querySelector('.fpt-finance');
            return view.scrollWidth <= view.clientWidth + 1;
        }), true, 'no horizontal overflow');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('finance hub is readable at phone width', async () => {
    const { browser, page } = await boot({ width: 420, height: 900 });
    try {
        await page.locator('.fpt-fin-kpi').first().waitFor();
        await page.waitForSelector('.fpt-fin-chart--line svg');
        await shot(page, 'overview-narrow');
        assert.equal(await page.evaluate(() => {
            const view = document.querySelector('.fpt-finance');
            return view.scrollWidth <= view.clientWidth + 1;
        }), true, 'no horizontal overflow');
    } finally {
        await browser.close();
    }
});
