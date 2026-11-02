#!/usr/bin/env node
// Captures the extension menu on demo data for the Chrome Web Store listing.
// The real content scripts run on a stand-in funpay.com page with chrome.* mocked in the page,
// the same way the browser tests do. No FunPay account, no real buyers, no network.
//
//   node tools/store-screenshots.cjs [outDir]
//
// Raw captures (2x) land in outDir/raw; tools/store-screenshots-frame.cjs turns them into
// 1280x800 listing images.
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'docs/store/screenshots'));
const rawDir = path.join(outDir, 'raw');
const VIEWPORT = { width: 1440, height: 900 };

const DAY = 86400000;
const CATEGORIES = ['Игровые аккаунты', 'Игровая валюта', 'Ключи активации', 'Подписки', 'Услуги прокачки', 'Внутриигровые предметы'];
const PRODUCTS = ['Аккаунт 60 уровня с редкими скинами', '5000 кристаллов', 'Ключ активации игры', 'Премиум-подписка на 12 месяцев',
    'Прокачка рейтинга до «Легенды»', 'Набор легендарного снаряжения'];
const BUYERS = ['north_wind', 'PixelFox', 'mira.games', 'Lucky_Otter', 'gamer_ivan', 'Starfall', 'kote_play'];

function demoData() {
    const now = Date.now();
    const orders = [];
    const purchases = [];
    let seq = 4200;
    for (let i = 0; i < 160; i++) {
        const idx = (i * 5) % CATEGORIES.length;
        const daysAgo = Math.floor((i * 37) % 60) + (i % 3) * 0.2;
        const price = [1490, 320, 690, 2390, 3100, 870][idx] * (0.7 + ((i * 13) % 9) / 10);
        const status = i % 19 === 0 ? 'refunded' : (i % 7 === 0 ? 'paid' : 'closed');
        orders.push({
            orderId: `DM${seq++}`, orderDate: now - daysAgo * DAY - (i % 5) * 3600000, orderStatus: status,
            price: Math.round(price), currency: 'RUB', description: PRODUCTS[idx], subcategoryName: CATEGORIES[idx],
            buyerUsername: BUYERS[(i * 3) % BUYERS.length], buyerId: 100 + (i % 7),
            ...(status === 'closed' ? { costBasisSnapshot: Math.round(price * 0.52), costBasisCurrency: 'RUB', costBasisCapturedAt: now } : {})
        });
    }
    for (let i = 0; i < 30; i++) {
        const idx = (i * 3) % CATEGORIES.length;
        purchases.push({
            orderId: `PU${seq++}`, orderDate: now - ((i * 53) % 60) * DAY, orderStatus: 'closed',
            price: [700, 150, 300, 1200, 1500, 400][idx], currency: 'RUB', description: PRODUCTS[idx], subcategoryName: CATEGORIES[idx],
            sellerUsername: ['supply_hub', 'KeyBox', 'FastLvl'][i % 3], sellerId: 500 + (i % 3)
        });
    }
    const operations = Array.from({ length: 50 }, (_, i) => {
        const type = ['order', 'order', 'withdraw', 'order', 'payment'][i % 5];
        const amount = [1850, 2600, 15000, 940, 5000][i % 5] + i * 10;
        return {
            id: `op${i}`, type, status: 'complete', amount, signed: type === 'withdraw' ? -amount : amount, currency: 'RUB',
            title: type === 'order' ? `Заказ #DM${4200 + i}` : type === 'payment' ? 'Пополнение баланса' : 'Вывод на карту',
            date: now - ((i * 29) % 60) * DAY, dateText: '', wallet: 'main'
        };
    });
    const lots = CATEGORIES.flatMap((category, c) => [0, 1, 2].map(n => ({
        offerId: String(9000 + c * 10 + n), title: `${PRODUCTS[c]}${n ? ` — вариант ${n + 1}` : ''}`, category, active: true,
        stock: n === 2 ? null : (c + 2) * (n + 2) * 2, stockKind: n === 2 ? 'unknown' : 'finite',
        sellerPrice: [1490, 320, 690, 2390, 3100, 870][c] * (1 + n * 0.1), buyerPrice: null, currency: 'RUB',
        costBasis: [760, 160, 350, 1250, 1600, 450][c]
    })));
    const lotList = CATEGORIES.flatMap((category, c) => [0, 1].map(n => ({
        id: String(700 + c * 10 + n), offerId: String(700 + c * 10 + n), nodeId: String(40 + c),
        title: `${PRODUCTS[c]}${n ? ' — экспресс' : ''}`, categoryName: category, price: String([1490, 320, 690, 2390, 3100, 870][c])
    })));
    return { orders, purchases, operations, lots, lotList };
}

function demoStorage(data) {
    const now = Date.now();
    return {
        fpToolsSalesLastUpdate: now - 3600000, fpToolsPurchasesLastUpdate: now - 7200000, fpToolsFinanceLastUpdate: now - 5400000,
        fpToolsAutoReplies: { autoDeliveryEnabled: true, greetingEnabled: true, greetingText: 'Здравствуйте! Спасибо, что выбрали мой магазин 🙂' },
        fpToolsAutoDeliveryLots: {
            700: { enabled: true, mode: 'secrets', productCount: 14 },
            710: { enabled: true, mode: 'template', text: 'Спасибо за покупку, {buyername}! Заказ #{orderid} выполнен: кристаллы уже на вашем аккаунте. Хорошей игры!', productCount: null },
            720: { enabled: true, mode: 'secrets', productCount: 37 },
            721: { enabled: false, mode: 'secrets', productCount: 0 },
            730: { enabled: true, mode: 'secrets', productCount: 6 }
        },
        fpToolsAutoDeliveryLotsCache: { updatedAt: now - 15 * 60000, lots: data.lotList.map(lot => ({ ...lot })) }
    };
}

async function boot(browser, { dark = false } = {}) {
    const data = demoData();
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'funpay.com' && /^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(url.pathname)) {
            const asset = path.join(root, url.pathname);
            if (fs.existsSync(asset)) return route.fulfill({ path: asset });
        }
        // Theme catalogue: none in screenshots, the rights to its images are still being checked.
        if (url.pathname.endsWith('/index.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"version":1,"themes":[]}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('https://funpay.com/');
    await page.setContent(`<html${dark ? ' class="fpt-theme-dark"' : ''}><head></head><body style="margin:0;min-height:100vh;background:${dark ? '#121318' : '#eef0f4'}">
        <ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>`);
    await page.evaluate(({ data, storage }) => {
        document.body.dataset.appData = JSON.stringify([{ userId: 'demo-seller' }]);
        const state = storage;
        const listeners = [];
        const get = keys => keys == null ? { ...state }
            : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys))
                .filter(key => Object.hasOwn(state, key)).map(key => [key, structuredClone(state[key])]));
        window.chrome = {
            storage: { local: {
                get(keys, callback) { const value = get(keys); callback?.(value); return Promise.resolve(value); },
                set(patch, callback) {
                    const changes = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { oldValue: state[key], newValue: value }]));
                    Object.assign(state, structuredClone(patch)); listeners.forEach(fn => fn(changes, 'local')); callback?.(); return Promise.resolve();
                },
                remove(keys, callback) { [].concat(keys).forEach(key => delete state[key]); callback?.(); return Promise.resolve(); }
            }, onChanged: { addListener(fn) { listeners.push(fn); }, removeListener() {} } },
            runtime: {
                getURL: file => `https://funpay.com/${file}`, getManifest: () => ({ version: '0.9.12' }), id: 'demo',
                sendMessage(message, callback) {
                    let result = { success: true, ok: true, data: [] };
                    switch (message.action) {
                        case 'getSalesOrders': result = { success: true, orders: data.orders }; break;
                        case 'getSalesCount': result = { success: true, count: data.orders.length }; break;
                        case 'getPurchaseOrders': result = { success: true, orders: data.purchases }; break;
                        case 'getPurchaseCount': result = { success: true, count: data.purchases.length }; break;
                        case 'getFinanceTxns': result = { success: true, txns: data.operations }; break;
                        case 'getFinanceCount': result = { success: true, count: data.operations.length }; break;
                        case 'getUserLotsList': result = data.lotList; break;
                        case 'syncAutoDeliveryStockCounts':
                            result = { success: true, counts: { 700: 14, 720: 37, 721: 0, 730: 6 }, errors: [] }; break;
                    }
                    callback?.(result);
                    return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            }
        };
        window.__fptDemoData = data;
    }, { data, storage: demoStorage(data) });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const content = manifest.content_scripts.find(script => script.js?.includes('content/content_script.js'));
    for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
    for (const js of ['content/safe_values.js', ...content.js]) await page.addScriptTag({ path: path.join(root, js) });
    await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
    await page.evaluate(() => {
        window.FPTPotential.getInventory = async () => window.__fptDemoData.lots.map(lot => window.FPTPotential.calculateRowPotential(lot));
    });
    await page.locator('#fpToolsButton').click();
    await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
    return { page, errors };
}

async function settle(page) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'
        || animation.effect?.getComputedTiming?.().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
}

async function openPage(page, id) {
    await page.evaluate(pageId => window.fptOpenPopupPage(pageId), id);
    await page.waitForFunction(pageId => document.querySelector('.fp-tools-page-content.active')?.dataset.page === pageId, id);
    await settle(page);
}

async function capture(page, name, selector = '.fp-tools-popup') {
    fs.mkdirSync(rawDir, { recursive: true });
    // The FunPay header button sits under the popup's top-left corner.
    await page.addStyleTag({ content: '#fpToolsButton, .fpt-header-button { visibility: hidden !important; }' });
    const target = path.join(rawDir, `${name}.png`);
    await page.locator(selector).first().screenshot({ path: target, animations: 'disabled' });
    console.log('captured', path.relative(root, target));
}

const SHOTS = [
    { name: 'finance', dark: false, run: async page => { await openPage(page, 'finance_hub'); await page.waitForSelector('.fpt-fin-line'); await settle(page); } },
    { name: 'delivery', dark: false, run: async page => { await openPage(page, 'auto_delivery'); await page.waitForSelector('.fpt-ad-lot-row'); await settle(page); } },
    { name: 'bulk', dark: false, run: async page => {
        await openPage(page, 'lot_io');
        await page.locator('#fp-bulk-edit-btn').click();
        await page.locator('.fpt-bulk-form').waitFor();
        await page.locator('.fpt-bulk-group-toggle').first().click();
        await page.locator('.fpt-bulk-group-check').first().check();
        await page.locator('.fpt-bulk-tab[data-pane="price"]').click();
        await page.evaluate(() => {
            const mode = document.querySelector('#fptBulkPriceMode');
            mode.value = 'pct_up';
            mode.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.locator('#fptBulkPriceValue').fill('10');
        await page.locator('.fpt-bulk-tab[data-pane="text"]').click();
        await page.locator('#fptBulkName').fill('🔥 {current}');
        await settle(page);
    } },
    { name: 'autoreply', dark: true, run: async page => { await openPage(page, 'auto_reply'); } },
    { name: 'theme', dark: true, run: async page => {
        await openPage(page, 'theme');
        await page.locator('.fpt-th-preset', { hasText: 'Своя' }).click();
        await settle(page);
    } },
    { name: 'templates', dark: true, run: async page => { await openPage(page, 'templates'); } }
];

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const only = process.env.FPT_SHOT ? new Set(process.env.FPT_SHOT.split(',')) : null;
    try {
        for (const shot of SHOTS) {
            if (only && !only.has(shot.name)) continue;
            const { page, errors } = await boot(browser, { dark: shot.dark });
            if (shot.dark) {
                await page.evaluate(() => {
                    window.fptComputePalette = () => ({ dark: true });
                    window.fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
                });
            }
            await shot.run(page);
            await capture(page, shot.name);
            if (errors.length) console.warn(shot.name, 'page errors:', errors);
            await page.close();
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
