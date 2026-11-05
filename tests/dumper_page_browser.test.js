const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');

async function createPage(width = 1100, options = {}) {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width, height: 860 } });
    page.on('pageerror', error => { throw error; });
    await page.setContent(`<body data-app-data='{"userId":100}'><div class="fp-tools-popup fptm-themed active"><main class="fp-tools-content"><div class="fp-tools-page-content active" data-page="dumper"></div></main></div></body>`);
    for (const file of ['css/content_styles.css', 'css/popup_categories.css', 'css/fpt_icons_theme.css', 'css/automation.css', 'css/dumper.css']) {
        await page.addStyleTag({ path: path.join(root, file) });
    }
    const iconFont = fs.readFileSync(path.join(root, 'fonts/material-symbols-rounded.woff2')).toString('base64');
    await page.addStyleTag({ content: `@font-face { font-family: 'Material Symbols Rounded'; src: url(data:font/woff2;base64,${iconFont}) format('woff2'); }
        body { margin: 0; font-family: Arial, sans-serif; }
        .fp-tools-popup { position: relative; width: min(100vw, 1100px); height: 860px; overflow: hidden; }
        .fp-tools-popup.fptm-themed { --fptm-bg: #fff; --fptm-surface: #f7f9f8; --fptm-text: #18201d; --fptm-muted: #59645f; --fptm-border: #d7e0db;
            --fptm-accent: #247653; --fptm-accent-soft: #e5f2ec; --fptm-accent-border: #8cb6a2; --fptm-nav-border: #d7e0db; --fptm-nav-field: #f4f7f5; --fptm-hover: #e9efeb; }` });
    await page.addScriptTag({ path: path.join(root, 'content/ui/popup_components.js') });
    await page.evaluate(options => {
        window.qaCalls = [];
        const accountRule = { enabled: options.enabled !== false, rules: options.rules || [] };
        window.qaState = accountRule;
        const included = Array.from({ length: options.marketRows || 1 }, (_, index) => ({ offerId: String(11 + index), title: options.longTitles ? 'Spotify Individual · подписка на один месяц с продлением и подробным описанием условий предложения' : 'Spotify Individual 1 мес', sellerId: String(911 + index), sellerName: index ? `Seller ${index}` : 'Alpha', price: options.currency ? '0.00012345' : String(115 + index), unit: '₽', rating: 5, online: true, auto: true, fields: { type: 'individual', time: '1 месяц' }, reasons: ['Совпали все параметры схемы'], fingerprint: `fp${11 + index}`, place: { from: index + 1, to: index + 1 } }));
        const excluded = [
            { offerId: '12', title: 'Spotify Duo', sellerId: '912', sellerName: 'Beta', price: '90', unit: '₽', fields: { type: 'duo' }, reasons: ['Другое значение «type»: duo'], fingerprint: 'fp12' },
            { offerId: '13', title: 'Spotify 12 мес', sellerId: '913', sellerName: 'Gamma', price: '80', unit: '₽', fields: { time: '12 месяцев' }, reasons: ['Другое значение «Количество месяцев»: 12 месяцев'], fingerprint: 'fp13' }
        ];
        let saved = options.saved || null;
        window.chrome = { runtime: { sendMessage: async message => {
            window.qaCalls.push(message);
            if (window.qaError && window.qaError.command === message.command) return { success: false, error: window.qaError.message };
            if (message.action === 'getUserLotsList') return options.empty ? [] : [
                { id: '500', nodeId: '1217', title: options.longTitles ? 'Spotify Premium Individual · очень длинное название лота для проверки отображения и переноса в окне настройки автодемпера' : 'Spotify Premium Individual', categoryName: 'Spotify Premium' },
                { id: '501', nodeId: '1217', title: 'Spotify Duo', categoryName: 'Spotify Premium' },
                { id: '100-24-26-191-11', kind: 'chips', nodeId: '26', title: 'Кинары (EN) Stormwing', categoryName: 'Aion Кинары' }
            ];
            if (message.action !== 'fptDumper') return { success: true, data: null };
            const ok = data => ({ success: true, data });
            switch (message.command) {
                case 'list': return ok({ accountId: '100', enabled: accountRule.enabled, rules: accountRule.rules });
                case 'get': return ok({ rule: saved || { revision: 0, enabled: false, strategy: 'undercut', position: 1, step: { mode: 'amount', value: '1' }, quantum: '0.01', intervalMin: 5, limits: { writeIntervalMin: 5, maxChangePercent: '5', maxHourlyDropPercent: '10' }, competitors: { mode: 'schema' } }, runtime: saved?.enabled ? { status: 'active' } : {} });
                case 'save': saved = { ...message.rule, revision: (saved?.revision || 0) + 1, enabled: false }; accountRule.rules = [{ ...saved, key: '100:lots:1217:500', kind: 'lots', nodeId: '1217', offerId: '500', runtime: {} }]; return ok(saved);
                case 'check': return ok({ ok: !options.blocked, configHash: 'h', blockers: options.blocked ? ['Комиссия не подтверждена'] : [], notes: [], own: { price: options.currency ? '0.00012345' : '100' }, currencyUnit: '₽', floor: options.currency ? '0.0001' : '50',
                    conversion: { verified: true, coefficient: '1.15', note: 'Комиссия сверена с вашей строкой в выдаче.' },
                    decision: { action: options.noCompetitors ? 'keep' : 'lower', reference: options.noCompetitors ? null : options.currency ? '0.00012345' : '115', target: options.noCompetitors ? '100' : options.currency ? '0.00010647' : '99.13', currentPlace: { from: 1, to: 2 }, reasons: [options.noCompetitors ? 'Подходящих конкурентов нет.' : options.currency ? 'Опорная цена в выдаче 0.00012345. Цена продавца после пересчёта 0.00010647.' : 'Конкурент на месте 1: 115. Новая цена 99.13.'] },
                    market: { schema: { present: true } },
                    selection: { mode: 'schema', fields: [{ id: 'type', label: null, values: { value: 'individual', label: 'Individual' } }, { id: 'time', label: 'Количество месяцев', values: { value: '1 месяц', label: '1 месяц' } }],
                        included: options.noCompetitors ? [] : included, excluded, excludedTotal: 2, reasonCounts: { 'Другое значение «type»': 1, 'Другое значение «Количество месяцев»': 1 } } });
                case 'enable': saved = { ...saved, enabled: true }; accountRule.rules[0] = { ...accountRule.rules[0], enabled: true, runtime: { status: 'active' } }; return ok(saved);
                case 'disable': saved = { ...saved, enabled: false }; return ok(saved);
                case 'setGlobal': accountRule.enabled = message.enabled; return ok({ enabled: message.enabled });
                case 'history': return ok([{ at: Date.now(), type: 'write', text: 'Цена 100 → 99.13 подтверждена FunPay.' }, { at: Date.now() - 1000, type: 'observation', text: 'Проверка: 1 подходящих, 2 исключено.' }]);
                case 'copy': return ok({ created: message.targets.map(t => `100:lots:${t.nodeId}:${t.offerId}`) });
                default: return { success: false, error: 'unknown' };
            }
        } } };
        window.fptPageUserId = () => '100';
        window.FPTPopupUI.observePopupControls(document.querySelector('.fp-tools-popup'));
    }, options);
    await page.addScriptTag({ path: path.join(root, 'content/ui/automation_ui.js') });
    await page.addScriptTag({ path: path.join(root, 'content/ui/dumper_page.js') });
    await page.evaluate(() => window.FPTDumperPage.mount(document.querySelector('.fp-tools-popup')));
    if (!options.empty) await page.waitForSelector('.fpt-dumper-row');
    return { browser, page };
}

test('lists own lots and currency offers with status, filters by search and category', async () => {
    const { browser, page } = await createPage();
    try {
        assert.equal(await page.locator('.fpt-dumper-row').count(), 3);
        assert.match(await page.locator('.fpt-dumper-row').nth(2).innerText(), /валюта/);
        assert.match(await page.locator('.fpt-dumper-row').first().innerText(), /Не настроен/);
        await page.fill('.fpt-dumper-search', 'duo');
        assert.equal(await page.locator('.fpt-dumper-row').count(), 1);
        await page.fill('.fpt-dumper-search', '');
        await page.locator('.fpt-dumper-controls .fpt-select-trigger').click();
        await page.locator('.fpt-select-option', { hasText: 'Aion Кинары' }).click();
        assert.equal(await page.locator('.fpt-dumper-row').count(), 1);
        // Нативный список нигде не показывается: <select> заменён тематическим меню.
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('select')].every(s => s.dataset.fptEnhanced === '1')), true);
        const overflow = await page.evaluate(() => document.querySelector('.fpt-dumper').scrollWidth - document.querySelector('.fpt-dumper').clientWidth);
        assert.ok(overflow <= 1, `no horizontal overflow (${overflow})`);
    } finally { await browser.close(); }
});

test('clicking a lot opens its settings in the standard dialog with three tabs', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.waitForSelector('.fpt-lot-dialog.fpt-dumper-dialog');
        assert.equal(await page.locator('.fpt-lot-dialog-header h2').innerText(), 'Spotify Premium Individual');
        assert.deepEqual(await page.locator('.fpt-dumper-tab').allInnerTexts(), ['Цена', 'Конкуренты', 'История']);
        assert.equal(await page.locator('.fpt-dumper-panel[data-tab="price"]').isVisible(), true);
        assert.equal(await page.locator('.fpt-dumper-panel[data-tab="competitors"]').isVisible(), false);
        assert.equal(await page.locator('.fpt-dumper-automation input').isDisabled(), true, 'cannot enable before save and check');
        assert.ok(['Проверить', 'Сохранить'].every(async label => page.locator('.fpt-lot-dialog-footer button', { hasText: label }).count()));
        await page.locator('.fpt-dumper-tab', { hasText: 'История' }).click();
        await page.waitForSelector('.fpt-dumper-history-item');
        assert.match(await page.locator('.fpt-dumper-history-item').first().innerText(), /Запись цены/);
    } finally { await browser.close(); }
});

test('check explains inclusion and exclusion; enabling only after save and a matching check', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().locator('button', { hasText: 'Настроить' }).click();
        await page.waitForSelector('.fpt-dumper-dialog');
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.waitForFunction(() => window.qaCalls.some(c => c.command === 'save'));
        const saveCall = await page.evaluate(() => window.qaCalls.find(c => c.command === 'save'));
        assert.deepEqual(saveCall.ref, { kind: 'lots', nodeId: '1217', offerId: '500', title: 'Spotify Premium Individual' });
        assert.equal(saveCall.rule.minPrice, '50');
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
        await page.waitForSelector('.fpt-dumper-facts');
        assert.match(await page.locator('.fpt-dumper-summary').innerText(), /99\.13/);
        assert.match(await page.locator('.fpt-dumper-summary').innerText(), /×1\.1500/);
        await page.locator('.fpt-dumper-tab', { hasText: 'Конкуренты' }).click();
        const results = await page.locator('.fpt-dumper-results').innerText();
        assert.match(results, /Подходят \(1\)/);
        assert.match(results, /Совпали все параметры схемы/);
        assert.match(results, /Исключены \(2\)/);
        await page.locator('.fpt-dumper-excluded summary').click();
        assert.match(await page.locator('.fpt-dumper-excluded').innerText(), /12 месяцев/);
        assert.equal(await page.locator('.fpt-dumper-automation input').isDisabled(), false);
        await page.locator('.fpt-dumper-automation .fpt-ad-switch-control').click();
        await page.waitForFunction(() => window.qaCalls.some(c => c.command === 'enable'));
        assert.equal(await page.evaluate(() => window.qaCalls.some(c => c.command === 'disable')), false);
        await page.waitForFunction(() => document.querySelector('.fpt-dumper-footer-status').textContent.includes('работает'));
        // Снятие поля схемы — осознанное ослабление: меняет настройки и требует сохранения.
        await page.locator('.fpt-dumper-fields .fpt-auto-check', { hasText: 'Количество месяцев' }).click();
        assert.match(await page.locator('.fpt-dumper-footer-status').innerText(), /несохранённые/);
    } finally { await browser.close(); }
});

test('an unsaved draft survives closing the dialog; exclusions add sellers; copy creates disabled rules', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.waitForSelector('.fpt-dumper-dialog');
        await page.locator('.fpt-dumper-disclosure > summary', { hasText: 'Повышение и точность' }).click();
        await page.getByRole('textbox', { name: /^Потолок/ }).fill('300');
        await page.locator('.fpt-lot-dialog-close').click();
        await page.locator('.fpt-dumper-row').first().click();
        await page.waitForSelector('.fpt-dumper-dialog');
        await page.waitForFunction(() => document.querySelector('.fpt-dumper-summary').textContent.includes('черновик'));
        await page.locator('.fpt-dumper-disclosure > summary', { hasText: 'Повышение и точность' }).click();
        assert.equal(await page.getByRole('textbox', { name: /^Потолок/ }).inputValue(), '300');
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
        await page.waitForSelector('.fpt-dumper-facts');
        await page.locator('.fpt-dumper-tab', { hasText: 'Конкуренты' }).click();
        await page.locator('.fpt-dumper-results .fpt-dumper-link', { hasText: 'Исключить продавца' }).first().click();
        assert.match(await page.locator('.fpt-dumper-picks').innerText(), /Исключён: Alpha/);
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.waitForFunction(() => window.qaCalls.filter(c => c.command === 'save').length === 1);
        const rule = await page.evaluate(() => window.qaCalls.find(c => c.command === 'save').rule);
        assert.deepEqual(rule.competitors.excludedSellers, [{ id: '911', name: 'Alpha' }]);
        assert.equal(rule.ceiling, '300');
        await page.locator('.fpt-dumper-more > summary').click();
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Копировать' }).click();
        const picker = page.locator('.fpt-dumper-copy');
        assert.equal(await picker.locator('.fpt-auto-lot-row').count(), 1, 'only lots of the same kind');
        await picker.locator('.fpt-auto-lot-row').first().click();
        await picker.locator('button', { hasText: 'Скопировать на выбранные' }).click();
        await page.waitForFunction(() => window.qaCalls.some(c => c.command === 'copy'));
        const copy = await page.evaluate(() => window.qaCalls.find(c => c.command === 'copy'));
        assert.deepEqual(copy.targets.map(t => t.offerId), ['501']);
    } finally { await browser.close(); }
});

test('the general switch stops every rule and the layout stays compact on narrow popups', async () => {
    const { browser, page } = await createPage(640);
    try {
        await page.locator('.fpt-dumper-master .fpt-ad-switch-control').click();
        await page.waitForFunction(() => window.qaCalls.some(c => c.command === 'setGlobal' && c.enabled === false));
        assert.match(await page.locator('.fpt-dumper-banner').innerText(), /остановлен/);
        const overflow = await page.evaluate(() => document.querySelector('.fpt-dumper').scrollWidth - document.querySelector('.fpt-dumper').clientWidth);
        assert.ok(overflow <= 1, `no horizontal overflow at 640px (${overflow})`);
        await page.locator('.fpt-dumper-row').first().click();
        await page.waitForSelector('.fpt-dumper-dialog');
        const box = await page.locator('.fpt-dumper-dialog').boundingBox();
        assert.ok(box.width <= 640);
    } finally { await browser.close(); }
});

test('state filters distinguish unconfigured, running, paused, errors and account stop', async () => {
    const rule = (offerId, extra = {}) => ({ revision: 1, enabled: true, key: `100:lots:1217:${offerId}`, kind: 'lots', nodeId: '1217', offerId, title: `Лот ${offerId}`, ...extra });
    const { browser, page } = await createPage(1100, { rules: [
        rule('500'), rule('501', { runtime: { status: 'paused', pauseReason: 'manual-edit' } }),
        rule('502', { runtime: { lastError: { message: 'FunPay недоступен' } } }),
        rule('503', { enabled: false })
    ] });
    try {
        const filters = page.locator('.fpt-dumper > .fpt-dumper-filters');
        assert.match(await filters.innerText(), /Все · 5/);
        await filters.locator('[data-filter="attention"]').click();
        assert.equal(await page.locator('.fpt-dumper-row').count(), 2);
        assert.match(await page.locator('.fpt-dumper-list').innerText(), /цену изменили вне демпера/);
        assert.match(await page.locator('.fpt-dumper-list').innerText(), /Ошибка/);
        await filters.locator('[data-filter="active"]').click();
        assert.equal(await page.locator('.fpt-dumper-row').count(), 1);
        await page.locator('.fpt-dumper-master input').setChecked(false);
        await page.waitForFunction(() => window.qaState.enabled === false);
        assert.equal(await page.locator('.fpt-dumper-row').count(), 0);
        await filters.locator('[data-filter="all"]').click();
        assert.match(await page.locator('.fpt-dumper-row[data-offer-id="500"]').innerText(), /Общий выключатель/);
        await filters.locator('[data-filter="off"]').click();
        assert.equal(await page.locator('.fpt-dumper-row').count(), 2);
    } finally { await browser.close(); }
});

test('refresh errors remain visible and keep the previous list; successful retry clears them', async () => {
    const { browser, page } = await createPage();
    try {
        await page.evaluate(() => { window.qaError = { command: 'list', message: 'Сеть недоступна' }; });
        await page.getByRole('button', { name: 'Обновить', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.fpt-dumper-banner').textContent.includes('Сеть недоступна'));
        assert.equal(await page.locator('.fpt-dumper-row').count(), 3);
        await page.fill('.fpt-dumper-search', 'duo');
        assert.match(await page.locator('.fpt-dumper-banner').innerText(), /Сеть недоступна/);
        await page.evaluate(() => { window.qaError = null; });
        await page.getByRole('button', { name: 'Обновить', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.fpt-dumper-banner').textContent);
        assert.equal(await page.locator('.fpt-dumper-row').count(), 1);
    } finally { await browser.close(); }
});

test('editing marks calculation stale; expiration disables enabling without an input event', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
        await page.waitForSelector('.fpt-dumper-facts');
        assert.equal(await page.locator('.fpt-dumper-automation input').isEnabled(), true);
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('51');
        assert.match(await page.locator('.fpt-dumper-summary').innerText(), /расчёт неактуален/);
        assert.equal(await page.locator('.fpt-dumper-automation input').isEnabled(), false);
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        assert.equal(await page.locator('.fpt-dumper-automation input').isEnabled(), true);
        await page.evaluate(() => { const originalNow = Date.now; Date.now = () => originalNow() + 16 * 60 * 1000; });
        await page.waitForFunction(() => document.querySelector('.fpt-dumper-automation input').disabled);
        assert.match(await page.locator('.fpt-dumper-summary').innerText(), /больше 15 минут/);
        assert.equal(await page.evaluate(() => window.qaCalls.some(c => ['enable', 'write'].includes(c.command))), false);
    } finally { await browser.close(); }
});

test('hidden invalid field opens and receives focus; tabs and close restore keyboard focus', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.waitForFunction(() => !document.querySelector('.fpt-lot-dialog-footer button:last-child').disabled);
        await page.evaluate(() => { window.qaError = { command: 'save', message: 'Точность цены должна быть больше нуля.' }; });
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-invalid') === 'true');
        assert.equal(await page.locator('.fpt-dumper-disclosure', { hasText: 'Повышение и точность' }).getAttribute('open'), '');
        assert.match(await page.locator('.fpt-lot-dialog-body [role="alert"]').innerText(), /Точность цены/);
        await page.locator('.fpt-dumper-tab[data-tab="price"]').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('.fpt-dumper-tab[data-tab="competitors"]').getAttribute('aria-selected'), 'true');
        await page.keyboard.press('End');
        assert.equal(await page.locator('.fpt-dumper-tab[data-tab="history"]').getAttribute('aria-selected'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('fpt-dumper-row')), true);
    } finally { await browser.close(); }
});

test('history filters local entries and competitor preview preserves reference and exclusions', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.locator('.fpt-dumper-tab[data-tab="competitors"]').click();
        assert.match(await page.locator('.fpt-dumper-results').innerText(), /После проверки/);
        await page.locator('.fpt-dumper-results button', { hasText: 'Проверить рынок' }).click();
        await page.waitForSelector('.fpt-dumper-reference');
        assert.match(await page.locator('.fpt-dumper-reference').innerText(), /Опорное предложение/);
        await page.locator('.fpt-dumper-tab[data-tab="history"]').click();
        await page.waitForSelector('.fpt-dumper-history-item');
        await page.locator('.fpt-dumper-panel[data-tab="history"] [data-filter="write"]').click();
        assert.equal(await page.locator('.fpt-dumper-history-item').count(), 1);
        assert.match(await page.locator('.fpt-dumper-history-item strong').innerText(), /100 → 99.13/);
        await page.locator('.fpt-dumper-panel[data-tab="history"] [data-filter="attention"]').click();
        assert.match(await page.locator('.fpt-dumper-history').innerText(), /В этом фильтре событий нет/);
        assert.equal(await page.evaluate(() => window.qaCalls.filter(c => c.command === 'history').length), 1);
    } finally { await browser.close(); }
});

test('blocked checks and no competitors stay understandable and cannot silently enable', async () => {
    const { browser, page } = await createPage(640, { blocked: true, noCompetitors: true });
    try {
        await page.locator('.fpt-dumper-row').first().click();
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
        await page.waitForSelector('.fpt-dumper-facts');
        assert.equal(await page.locator('.fpt-dumper-automation input').isDisabled(), true);
        assert.match(await page.locator('.fpt-dumper-summary [role="alert"]').innerText(), /Комиссия не подтверждена/);
        await page.locator('.fpt-dumper-tab[data-tab="competitors"]').click();
        assert.match(await page.locator('.fpt-dumper-results').innerText(), /Подходящих конкурентов нет/);
    } finally { await browser.close(); }
});

test('responsive layouts and theme snapshots keep footer visible and precise prices intact', async () => {
    for (const width of [1100, 640, 390]) {
        const { browser, page } = await createPage(width, { longTitles: width === 390, currency: width === 390, marketRows: 30 });
        try {
            const artifactDir = path.join(root, 'artifacts', 'dumper-ui-2026-11-05');
            fs.mkdirSync(artifactDir, { recursive: true });
            await page.screenshot({ path: path.join(artifactDir, `list-light-${width}.png`) });
            await page.locator('.fpt-dumper-row').first().click();
            await page.getByRole('textbox', { name: /^Минимум/ }).fill('0.00012345');
            await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
            await page.waitForSelector('.fpt-dumper-facts');
            await page.evaluate(() => { document.querySelector('.fpt-lot-dialog-body').scrollTop = 0; });
            for (const theme of ['light', 'dark']) {
                if (theme === 'dark') await page.addStyleTag({ content: `.fp-tools-popup.fptm-themed { --fptm-bg:#171a1f; --fptm-surface:#20252c; --fptm-text:#edf2f0; --fptm-muted:#a9b5b0; --fptm-border:#38453f; --fptm-nav-border:#38453f; --fptm-nav-field:#252d29; --fptm-accent:#89dab2; --fptm-accent-soft:#273f33; --fptm-accent-border:#49715c; --fptm-hover:#2a332f; }` });
                await page.screenshot({ path: path.join(artifactDir, `dialog-${theme}-${width}.png`) });
                const geometry = await page.evaluate(() => {
                    const dialog = document.querySelector('.fpt-dumper-dialog');
                    const body = dialog.querySelector('.fpt-lot-dialog-body');
                    const footer = dialog.querySelector('.fpt-lot-dialog-footer');
                    return { overflow: body.scrollWidth - body.clientWidth, bottom: footer.getBoundingClientRect().bottom, height: innerHeight };
                });
                assert.ok(geometry.overflow <= 1, `${theme} ${width}: no horizontal overflow (${geometry.overflow})`);
                assert.ok(geometry.bottom <= geometry.height, `${theme} ${width}: footer visible`);
                assert.equal(await page.getByRole('textbox', { name: /^Минимум/ }).inputValue(), '0.00012345');
            }
            await page.locator('.fpt-dumper-tab[data-tab="competitors"]').click();
            await page.evaluate(() => { document.querySelector('.fpt-lot-dialog-body').scrollTop = 0; });
            await page.screenshot({ path: path.join(artifactDir, `competitors-dark-${width}.png`) });
            const competitorsOverflow = await page.locator('.fpt-lot-dialog-body').evaluate(element => element.scrollWidth - element.clientWidth);
            assert.ok(competitorsOverflow <= 1, `competitors ${width}: scroll inside table, not dialog`);
            assert.equal(await page.locator('.fpt-dumper-results > .fpt-auto-table-wrap tbody tr').count(), 30);
        } finally { await browser.close(); }
    }
});

test('all existing rule parameters round-trip and selected competitors can be removed and re-added', async () => {
    const { browser, page } = await createPage();
    try {
        await page.locator('.fpt-dumper-row').first().click();
        const price = page.locator('.fpt-dumper-panel[data-tab="price"]');
        await price.locator('select').nth(0).selectOption('position');
        await page.getByRole('spinbutton', { name: /^Место/ }).fill('3');
        await page.getByRole('textbox', { name: /^Шаг/ }).fill('2.5');
        await price.locator('select').nth(1).selectOption('percent');
        await page.getByRole('textbox', { name: /^Минимум/ }).fill('50');
        await page.getByRole('spinbutton', { name: /^Проверка рынка/ }).fill('10');
        for (const title of ['Себестоимость и прибыль', 'Повышение и точность', 'Частота и защитные лимиты']) {
            await page.locator('.fpt-dumper-disclosure > summary', { hasText: title }).click();
        }
        for (const [label, value] of [['Себестоимость', '40'], ['Прибыль', '8'], ['Потолок', '300'], ['Точность цены', '0.0001'], ['Изменение за проход', '7'], ['Снижение за час', '12']]) {
            await page.getByRole('textbox', { name: new RegExp(`^${label}`) }).fill(value);
        }
        await page.getByRole('spinbutton', { name: /^Запись не чаще/ }).fill('6');
        await price.locator('.fpt-auto-check', { hasText: 'Брать себестоимость' }).click();
        await price.locator('.fpt-auto-check', { hasText: 'Автоповышение' }).click();
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Проверить' }).click();
        await page.waitForSelector('.fpt-dumper-facts');
        await page.locator('.fpt-dumper-tab[data-tab="competitors"]').click();
        await page.locator('.fpt-dumper-results .fpt-dumper-link', { hasText: 'Выбрать', exact: true }).first().click();
        const picks = page.locator('.fpt-dumper-picks');
        assert.match(await picks.innerText(), /Предложение:/);
        await picks.getByRole('button', { name: 'Убрать', exact: true }).click();
        assert.equal(await picks.locator('.fpt-dumper-chip').count(), 0);
        await page.locator('.fpt-dumper-results .fpt-dumper-link', { hasText: 'Выбрать', exact: true }).first().click();
        await page.locator('.fpt-dumper-results .fpt-dumper-link', { hasText: 'Исключить продавца' }).first().click();
        await page.locator('.fpt-dumper-results .fpt-dumper-link', { hasText: 'В свои продавцы' }).first().click();
        await page.locator('.fpt-dumper-fields .fpt-auto-check', { hasText: 'Количество месяцев' }).click();
        const competitors = page.locator('.fpt-dumper-panel[data-tab="competitors"]');
        await competitors.locator('select').nth(0).selectOption('selected');
        await competitors.locator('select').nth(1).selectOption('4');
        await page.locator('.fpt-dumper-disclosure > summary', { hasText: 'Словесные фильтры' }).click();
        await page.getByRole('textbox', { name: /^Обязательные слова/ }).fill('individual, месяц');
        await page.getByRole('textbox', { name: /^Исключающие слова/ }).fill('duo; family');
        for (const label of ['Только продавцы онлайн', 'Только с автовыдачей', 'Только выбранные продавцы']) await competitors.locator('.fpt-auto-check', { hasText: label }).click();
        await page.locator('.fpt-lot-dialog-footer button', { hasText: 'Сохранить' }).click();
        await page.waitForFunction(() => window.qaCalls.some(c => c.command === 'save'));
        const rule = await page.evaluate(() => window.qaCalls.find(c => c.command === 'save').rule);
        assert.deepEqual({ ...rule, competitors: undefined }, {
            strategy: 'position', position: 3, step: { mode: 'percent', value: '2.5' }, minPrice: '50', cost: '40', minProfit: '8', ceiling: '300', quantum: '0.0001', useCostBasis: true, allowRaise: true, intervalMin: 10,
            limits: { writeIntervalMin: 6, maxChangePercent: '7', maxHourlyDropPercent: '12' }, competitors: undefined
        });
        assert.deepEqual(rule.competitors, { mode: 'selected', ignoreFields: ['time'], selected: [{ offerId: '11', sellerId: '911', sellerName: 'Alpha', title: 'Spotify Individual 1 мес', fingerprint: 'fp11', confirmedAt: rule.competitors.selected[0].confirmedAt }], requiredWords: ['individual', 'месяц'], excludedWords: ['duo', 'family'], minRating: 4, onlineOnly: true, autoOnly: true, excludedSellers: [{ id: '911', name: 'Alpha' }], onlySellers: true, sellers: [{ id: '911', name: 'Alpha' }] });
        assert.equal(await page.locator('.fpt-dumper-automation input').isDisabled(), true, 'changed configuration needs its own check');
    } finally { await browser.close(); }
});

test('an empty account has an explicit empty state', async () => {
    const { browser, page } = await createPage(640, { empty: true });
    try {
        await page.waitForFunction(() => document.querySelector('.fpt-dumper-list')?.getAttribute('aria-busy') === 'false');
        assert.match(await page.locator('.fpt-dumper-list').innerText(), /Лоты не найдены/);
        assert.match(await page.locator('.fpt-dumper > .fpt-dumper-filters').innerText(), /Все · 0/);
    } finally { await browser.close(); }
});
