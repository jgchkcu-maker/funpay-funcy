const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.join(__dirname, '..');

test('real browser: lot management screen, navigation and shell geometry', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (/^\/(icons\/[\w-]+\.png|fonts\/[\w-]+\.woff2)$/.test(pathname)) {
                const file = path.join(root, pathname);
                if (fs.existsSync(file)) return route.fulfill({ path: file });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        await page.goto('https://funpay.com/');
        await page.setContent('<html><head></head><body><ul class="nav navbar-nav navbar-right logged"><li><a class="user-link" data-toggle="dropdown"></a></li></ul><main id="content"></main></body></html>');
        await page.evaluate(() => {
            document.body.dataset.appData = JSON.stringify([{ userId: 'qa-user' }]);
            const initial = {
                showSalesStats: false, viewSellersPromo: false, hideBalance: true,
                fpToolsAutoReplies: { greetingText: 'keep' }, fpToolsNavCollapsed: false,
                fpToolsPopupSize: { width: '500px', height: '400px' },
                fpToolsPopupPosition: { left: '70px', top: '40px' }, fpToolsPopupDragged: true
            };
            window.qaInitial = structuredClone(initial); window.qaSaved = initial; window.qaWrites = [];
            const listeners = [];
            const get = keys => keys == null ? { ...initial } : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys]).map(k => [k, initial[k]]));
            window.qaMessages = [];
            window.chrome = { storage: { local: {
                get(keys, cb) { const value = get(keys); cb?.(value); return Promise.resolve(value); },
                set(values, cb) { window.qaWrites.push(structuredClone(values)); Object.assign(initial, values); cb?.(); return Promise.resolve(); },
                remove(keys, cb) { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete initial[k]); cb?.(); return Promise.resolve(); }
            }, onChanged: { addListener(fn) { listeners.push(fn); } } }, runtime: {
                getURL: path => 'https://funpay.com/' + path, getManifest: () => ({ version: 'test' }), id: 'qa',
                sendMessage(message, cb) {
                    window.qaMessages.push(structuredClone(message));
                    const result = message?.action === 'getUserLotsList'
                        ? [
                            { id: '501', title: 'Премиум аккаунт', nodeId: '42', categoryName: 'Аккаунты' },
                            { id: '502', title: 'Игровая валюта', nodeId: '43', categoryName: 'Валюта' }
                        ]
                        : message?.action === 'getUserCategories'
                            ? { success: true, data: [
                                { id: '/lots/42', name: 'Аккаунты', lots: [{ id: '501', nodeId: '42', title: 'Премиум аккаунт' }] },
                                { id: '/lots/43', name: 'Пустая категория', lots: [] }
                            ] }
                            : message?.action === 'getLotForExport'
                                ? { success: true, data: { 'fields[summary][ru]': 'Премиум аккаунт', price: '100' } }
                                : { success: true, data: [], ok: true };
                    cb?.(result); return Promise.resolve(result);
                },
                onMessage: { addListener() {} }
            } };
            window.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => '' });
        });
        const manifest = require('./helpers/popup_bundle_harness').withPopupBundle(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))));
        const content = manifest.content_scripts.find(s => s.js?.includes('content/content_script.js'));
        for (const css of content.css) await page.addStyleTag({ path: path.join(root, css) });
        for (const js of content.js) await page.addScriptTag({ path: path.join(root, js) });
        assert.equal(await page.evaluate(() => typeof window.FPTPopupUI?.ensureCategoryHeader), 'function');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => typeof window.__fpEnsurePopup === 'function');
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'lot_io');
        const pages = await page.locator('.fp-tools-page-content').evaluateAll(nodes => nodes.map(n => n.dataset.page));
        assert.equal(pages.length, 17);
        assert.ok(!pages.includes('telegram') && !pages.includes('support') && !pages.includes('global_chat'));
        assert.equal(await page.locator('.fpt-nav-footer, .fpt-nav-quick-actions, [data-page="telegram"], [data-page="support"]').count(), 0);
        await page.evaluate(() => window.fptOpenPopupPage('lot_io'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'lot_io');
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.getAnimations().every(animation => animation.playState === 'finished'));
        assert.equal(await page.locator('.fp-tools-page-content.active > .fpt-category-header').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="lot_io"] > .fpt-lot-io').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="finance_hub"] > .fpt-finance').count(), 1);
        assert.equal(await page.locator('.fpt-lot-empty > span:last-child').innerText(),
            'Нет незавершённых импортов. Выберите или перетащите JSON-файл в карточку «Импорт из файла».');
        const compactMetrics = await page.evaluate(() => {
            const brand = document.querySelector('.fpt-nav-brand-title');
            const title = document.querySelector('.fp-tools-page-content.active .fpt-category-title');
            const band = document.querySelector('.fpt-lot-action-band');
            const empty = document.querySelector('.fpt-lot-empty');
            const baseline = element => {
                const style = getComputedStyle(element), rect = element.getBoundingClientRect();
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                const metrics = context.measureText(element.textContent.trim());
                const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
                const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
                return rect.top + (parseFloat(style.lineHeight) - ascent - descent) / 2 + ascent;
            };
            return {
                titleFont: getComputedStyle(title).fontSize,
                titleWeight: getComputedStyle(title).fontWeight,
                titleLineHeight: getComputedStyle(title).lineHeight,
                headerOffset: getComputedStyle(title.closest('.fpt-category-header')).top,
                titleTop: title.getBoundingClientRect().top,
                brandTop: brand.getBoundingClientRect().top,
                pageTop: title.closest('.fp-tools-page-content').getBoundingClientRect().top,
                popupTop: document.querySelector('.fp-tools-popup').getBoundingClientRect().top,
                actionHeight: band.getBoundingClientRect().height,
                actionOverflow: band.scrollWidth > band.clientWidth + 1,
                emptyHeight: empty.getBoundingClientRect().height,
                emptyOverflow: empty.scrollWidth > empty.clientWidth + 1
            };
        });
        assert.equal(compactMetrics.titleFont, '26px');
        assert.equal(compactMetrics.titleWeight, '600');
        assert.equal(compactMetrics.titleLineHeight, '32px');
        assert.equal(compactMetrics.headerOffset, '0px', 'category header has no visual offset');
        assert.ok(compactMetrics.actionHeight <= 260, `grouped action band should remain compact: ${compactMetrics.actionHeight}px`);
        assert.equal(compactMetrics.actionOverflow, false);
        assert.ok(compactMetrics.emptyHeight <= 70);
        assert.equal(compactMetrics.emptyOverflow, false);

        const activeImport = { name: 'lots_backup.json', state: 'running', currentIndex: 1, lots: [{ status: 'success' }, { status: 'pending' }] };
        const postponedImport = { ...activeImport, state: 'postponed' };
        for (const process of [activeImport, postponedImport]) {
            await page.evaluate(value => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: value })), process);
            await page.locator('.fpt-lot-import-card').waitFor();
            const card = await page.locator('.fpt-lot-import-card').evaluate(element => ({
                text: element.innerText,
                progress: element.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),
                overflow: element.scrollWidth > element.clientWidth + 1,
                continueDisabled: element.querySelector('.fpt-lot-continue').disabled
            }));
            assert.match(card.text, /1 из 2/);
            assert.equal(card.progress, '50');
            assert.equal(card.overflow, false);
            assert.equal(card.continueDisabled, process.state === 'running');
        }
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: { finished: true, lots: [] } })));
        await page.locator('.fpt-lot-import-report').waitFor();
        for (const viewport of [
            { width: 1000, height: 700 },
            { width: 740, height: 600 },
            { width: 520, height: 600 }
        ]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(380);
            await page.evaluate(value => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: value })), postponedImport);
            if (viewport.width === 520) {
                const compactNav = await page.evaluate(() => {
                    const nav = document.querySelector('.fp-tools-nav');
                    return {
                        collapsed: nav.classList.contains('is-nav-collapsed'),
                        labels: Array.from(nav.querySelectorAll('.fpt-nav-child a > span:last-child')).map(label => ({
                            width: label.getBoundingClientRect().width,
                            opacity: getComputedStyle(label).opacity,
                            visibility: getComputedStyle(label).visibility,
                            accessibleName: label.parentElement.getAttribute('aria-label') || label.parentElement.title
                        }))
                    };
                });
                assert.equal(compactNav.collapsed, true, 'the sidebar should use the compact rail below its auto-collapse breakpoint');
                assert.ok(compactNav.labels.every(label => label.width <= 1 && label.accessibleName),
                    `compact navigation should hide clipped child labels while keeping tooltips: ${JSON.stringify(compactNav)}`);
            }
            const responsive = await page.locator('.fp-tools-page-content[data-page="lot_io"]').evaluate(view => {
                const selectors = ['.fpt-category-header', '.fpt-lot-action-band', '.fpt-lot-import-card'];
                return selectors.map(selector => {
                    const element = selector === '.fpt-category-header'
                        ? view.querySelector(':scope > .fpt-category-header')
                        : view.querySelector(`.fpt-lot-io ${selector}`);
                    const title = selector === '.fpt-category-header' ? element.querySelector('.fpt-category-title') : null;
                    const brand = document.querySelector('.fpt-nav-brand-title');
                    const baseline = target => {
                        const style = getComputedStyle(target), rect = target.getBoundingClientRect();
                        const context = document.createElement('canvas').getContext('2d');
                        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                        const metrics = context.measureText(target.textContent.trim());
                        const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
                        const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
                        return rect.top + (parseFloat(style.lineHeight) - ascent - descent) / 2 + ascent;
                    };
                    return {
                        selector,
                        client: element.clientWidth,
                        scroll: element.scrollWidth,
                        headerOffset: title ? getComputedStyle(element).top : null,
                        titleTop: title?.getBoundingClientRect().top,
                        brandTop: title ? brand.getBoundingClientRect().top : null,
                        pageTop: view.getBoundingClientRect().top,
                        titleFont: title ? getComputedStyle(title).fontSize : null,
                        titleLineHeight: title ? getComputedStyle(title).lineHeight : null,
                        popupTop: document.querySelector('.fp-tools-popup').getBoundingClientRect().top,
                        contentTop: document.querySelector('.fp-tools-content').getBoundingClientRect().top,
                        brandBaseline: brand ? baseline(brand) : null,
                        titleBaseline: title ? baseline(title) : null,
                        transform: getComputedStyle(view).transform,
                        animation: getComputedStyle(view).animationName
                    };
                });
            });
            for (const element of responsive) {
                assert.ok(element.scroll <= element.client + 1, `${viewport.width}px viewport: ${element.selector} overflowed (${element.scroll} > ${element.client})`);
                if (element.headerOffset !== null) {
                    assert.equal(element.headerOffset, '0px', `${viewport.width}px category header has no visual offset`);
                }
            }
            await page.evaluate(() => window.dispatchEvent(new CustomEvent('fpt:lot-import-progress', { detail: { finished: true, lots: [] } })));
        }
        await page.setViewportSize({ width: 1200, height: 780 });
        await page.waitForTimeout(380);
        for (const id of pages) {
            await page.evaluate(id => document.querySelector('.fp-tools-popup')._fptNavSections.showSectionForPage(id), id);
            await page.locator(`.fp-tools-nav li[data-page="${id}"] a`).click();
            await page.waitForFunction(id => document.querySelector('.fp-tools-page-content.active')?.dataset.page === id, id);
            await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.getAnimations().every(animation => animation.playState === 'finished'));
            const header = page.locator(`.fp-tools-page-content[data-page="${id}"] > .fpt-category-header`);
            assert.equal(await header.count(), 1, `${id} should have exactly one shared category header`);
            const expectedTitle = await page.locator(`.fp-tools-nav li[data-page="${id}"] a span:last-child`).innerText();
            assert.equal(await header.locator('.fpt-category-title').innerText(), expectedTitle.trim(), `${id} title should match navigation`);
            const headingMetrics = await header.locator('.fpt-category-title').evaluate(heading => {
                const brand = document.querySelector('.fpt-nav-brand-title');
                const baseline = element => {
                    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
                    const context = document.createElement('canvas').getContext('2d');
                    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                    const metrics = context.measureText(element.textContent.trim());
                    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
                    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
                    return rect.top + (parseFloat(style.lineHeight) - ascent - descent) / 2 + ascent;
                };
                const style = getComputedStyle(heading);
                return { weight: style.fontWeight, headerOffset: getComputedStyle(heading.closest('.fpt-category-header')).top };
            });
            assert.equal(headingMetrics.weight, '600', `${id} title should use the shared lighter weight`);
            assert.equal(headingMetrics.headerOffset, '0px', `${id} category header has no visual offset`);
            if (id === 'lot_io') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="lot_io"] > .fpt-lot-io').count(), 1);
            } else if (id === 'auto_delivery') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="auto_delivery"] > .fpt-auto-delivery').count(), 1);
            } else if (id === 'autobump') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="autobump"] > .fpt-auto-bump').count(), 1);
            } else if (id === 'finance_hub') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="finance_hub"] > .fpt-finance').count(), 1);
            } else if (id === 'theme') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="theme"] > .fpt-th').count(), 1);
            } else if (id === 'auto_reply') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="auto_reply"] > .fpt-auto-reply').count(), 1);
            } else if (id === 'needs') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="needs"] > .fpt-interface-elements').count(), 1);
            } else if (id === 'templates') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="templates"] > .fpt-quick-replies').count(), 1);
            } else if (id === 'auto_review') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="auto_review"] > .fpt-reviews').count(), 1);
            } else if (id === 'accounts') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="accounts"] > .fpt-accounts').count(), 1);
            } else if (id === 'effects') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="effects"] > .fpt-fx').count(), 1);
            } else if (id === 'tickets') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="tickets"] > .fpt-sp').count(), 1);
            } else if (id === 'sounds') {
                assert.equal(await page.locator('.fp-tools-page-content[data-page="sounds"] > .fpt-ns').count(), 1);
            } else {
                assert.equal(await page.locator(`.fp-tools-page-content[data-page="${id}"] > *:not(.fpt-category-header):not(.fpt-popup-toast-region)`).count(), 0, id);
            }
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.evaluate(() => {
            document.querySelectorAll('.fp-tools-page-content').forEach((screen, index) => {
                const fixture = document.createElement('section');
                fixture.className = 'fpt-controls-test-fixture';
                fixture.innerHTML = `
                    <label><input type="checkbox" checked> Отмечено ${index}</label>
                    <label><input type="checkbox" id="fpt-unchecked-${index}"> Пусто ${index}</label>
                    <label><input type="checkbox" disabled> Отключено ${index}</label>
                    <label for="fpt-text-${index}">Текст ${index}</label><input id="fpt-text-${index}" type="text">
                    <textarea aria-label="Описание ${index}"></textarea>
                    <select aria-label="Список ${index}"><option>Значение</option></select>
                    <div class="switch"><input type="checkbox" aria-label="Особый переключатель"><span class="slider"></span></div>
                    <input type="range" aria-label="Ползунок"><input type="color" aria-label="Цвет">
                    <input type="file" aria-label="Файл">
                `;
                if (index === 0) {
                    const sharedCheckbox = window.FPTPopupUI.createCheckboxControl('Общий чекбокс', {
                        id: 'fpt-shared-checkbox-test', checked: true
                    });
                    fixture.appendChild(sharedCheckbox.element);
                }
                screen.appendChild(fixture);
            });
        });
        await page.waitForTimeout(100);
        const decorationState = await page.evaluate(() => ({
            api: typeof window.FPTPopupUI?.observePopupControls,
            observing: Boolean(document.querySelector('.fp-tools-popup')?._fptPopupControlsObserver),
            fixtures: document.querySelectorAll('.fpt-controls-test-fixture').length,
            checkboxes: document.querySelectorAll('.fpt-controls-test-fixture input[type="checkbox"]').length,
            decorated: document.querySelectorAll('.fpt-controls-test-fixture .fpt-checkbox-control').length
        }));
        assert.equal(decorationState.decorated, decorationState.fixtures * 3 + 1, `all category fixtures should receive checkbox controls: ${JSON.stringify({ ...decorationState, errors })}`);
        const sharedCheckboxComponent = await page.locator('#fpt-shared-checkbox-test').evaluate(input => ({
            checked: input.checked,
            caption: input.closest('label').querySelector('.fpt-checkbox-caption')?.textContent,
            indicator: input.nextElementSibling?.className,
            markerInsideControl: input.nextElementSibling?.parentElement === input.parentElement
        }));
        assert.deepEqual(sharedCheckboxComponent, {
            checked: true,
            caption: 'Общий чекбокс',
            indicator: 'fpt-checkbox-indicator',
            markerInsideControl: true
        });
        const sharedControlMetrics = await page.locator('.fp-tools-popup').evaluate(popup => {
            const screens = [...popup.querySelectorAll('.fp-tools-page-content')];
            return screens.map(screen => {
                const fixture = screen.querySelector('.fpt-controls-test-fixture');
                const checkbox = fixture.querySelector('input[type="checkbox"]');
                const indicator = checkbox.nextElementSibling;
                const text = fixture.querySelector('input[type="text"]');
                const textarea = fixture.querySelector('textarea');
                const select = fixture.querySelector('select');
                return {
                    checkboxClass: checkbox.classList.contains('fpt-checkbox-input'),
                    indicatorClass: indicator.classList.contains('fpt-checkbox-indicator'),
                    indicatorSize: [getComputedStyle(indicator).width, getComputedStyle(indicator).height],
                    labelGap: getComputedStyle(checkbox.closest('label')).gap,
                    disabledOpacity: getComputedStyle(fixture.querySelector('input[type="checkbox"][disabled]').nextElementSibling).opacity,
                    fieldClass: text.classList.contains('fpt-control-field'),
                    fieldHeight: getComputedStyle(text).height,
                    fieldRadius: getComputedStyle(text).borderRadius,
                    textareaHeight: getComputedStyle(textarea).height,
                    textareaResize: getComputedStyle(textarea).resize,
                    selectHeight: getComputedStyle(select).height,
                    specialCheckboxDecorated: !!fixture.querySelector('.switch .fpt-checkbox-control'),
                    specialControlsDecorated: !!fixture.querySelector('.fpt-control-field[type="range"], .fpt-control-field[type="color"], .fpt-control-field[type="file"]')
                };
            });
        });
        for (const controls of sharedControlMetrics) {
            assert.equal(controls.checkboxClass, true);
            assert.equal(controls.indicatorClass, true);
            assert.deepEqual(controls.indicatorSize, ['19px', '19px']);
            assert.equal(controls.labelGap, '8px');
            assert.equal(controls.disabledOpacity, '0.5');
            assert.equal(controls.fieldClass, true);
            assert.equal(controls.fieldHeight, '40px');
            assert.equal(controls.fieldRadius, '10px');
            assert.equal(controls.textareaHeight, '76px');
            assert.equal(controls.textareaResize, 'none');
            assert.equal(controls.selectHeight, '40px');
            assert.equal(controls.specialCheckboxDecorated, false);
            assert.equal(controls.specialControlsDecorated, false);
        }
        await page.evaluate(() => window.fptOpenPopupPage('lot_io'));
        const fixtureUnchecked = page.locator('.fp-tools-page-content[data-page="lot_io"] .fpt-controls-test-fixture input[id^="fpt-unchecked-"]');
        await fixtureUnchecked.click();
        assert.equal(await fixtureUnchecked.isChecked(), true);
        await fixtureUnchecked.press('Space');
        assert.equal(await fixtureUnchecked.isChecked(), false);
        const checkedMark = page.locator('.fp-tools-page-content[data-page="lot_io"] .fpt-checkbox-control input:checked + .fpt-checkbox-indicator').first();
        const checkedMarkColor = await checkedMark.evaluate(element => getComputedStyle(element).backgroundColor);
        assert.notEqual(checkedMarkColor, 'rgba(0, 0, 0, 0)');
        const fieldThemeColors = [];
        for (const dark of [false, true]) {
            await page.evaluate(dark => {
                document.body.style.backgroundColor = dark ? '#15171a' : '#ffffff';
                window.fptComputePalette = () => ({ dark });
                fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
            }, dark);
            fieldThemeColors.push(await page.locator('.fpt-controls-test-fixture .fpt-control-field').first().evaluate(field => getComputedStyle(field).backgroundColor));
        }
        assert.notEqual(fieldThemeColors[0], fieldThemeColors[1], 'shared fields follow light and dark popup themes');
        await page.evaluate(() => {
            document.body.style.backgroundColor = '#ffffff';
            window.fptComputePalette = () => ({ dark: false });
            fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
        });
        await page.evaluate(() => window.fptOpenPopupPage('lot_io'));
        for (const viewport of [{ width: 700, height: 560 }, { width: 520, height: 520 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(220);
            const compactFields = await page.locator('.fp-tools-page-content[data-page="lot_io"] .fpt-controls-test-fixture').evaluate(fixture => {
                const bounds = fixture.getBoundingClientRect();
                return {
                    fixtureOverflow: fixture.scrollWidth > fixture.clientWidth + 1,
                    controlsFit: Array.from(fixture.querySelectorAll('.fpt-control-field')).every(field => {
                        const rect = field.getBoundingClientRect();
                        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
                    })
                };
            });
            assert.equal(compactFields.fixtureOverflow, false, `${viewport.width}px controls should not overflow their category`);
            assert.equal(compactFields.controlsFit, true, `${viewport.width}px standard fields should fit their category`);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForTimeout(220);
        await page.evaluate(() => document.querySelectorAll('.fpt-controls-test-fixture').forEach(fixture => fixture.remove()));
        const qaDialogScreenshots = path.join(require('node:os').tmpdir(), 'funpay-popup-reset-20261002');
        fs.mkdirSync(qaDialogScreenshots, { recursive: true });
        await page.locator('#lot-io-export-btn').click();
        await page.locator('.fpt-lot-dialog:not(.fpt-lot-dialog--bulk)').waitFor();
        await page.screenshot({ path: path.join(qaDialogScreenshots, 'export-dialog-light.png') });
        const exportControls = await page.locator('.fpt-lot-category-row').evaluateAll(rows => rows.map(row => {
            const input = row.querySelector('input[type="checkbox"]');
            const indicator = input.nextElementSibling;
            return {
                decorated: input.classList.contains('fpt-checkbox-input') && indicator.classList.contains('fpt-checkbox-indicator'),
                indicatorSize: [getComputedStyle(indicator).width, getComputedStyle(indicator).height],
                labelGap: getComputedStyle(row).gap,
                disabled: input.disabled
            };
        }));
        assert.equal(exportControls.length, 2);
        assert.deepEqual(exportControls.map(item => item.decorated), [true, true]);
        assert.deepEqual(exportControls.map(item => item.indicatorSize), [['19px', '19px'], ['19px', '19px']]);
        assert.deepEqual(exportControls.map(item => item.labelGap), ['8px', '8px']);
        assert.deepEqual(exportControls.map(item => item.disabled), [false, true]);
        const exportCheck = page.locator('.fpt-lot-category-row input[type="checkbox"]').first();
        await exportCheck.click();
        assert.equal(await exportCheck.isChecked(), true);
        const exportMarkColor = await exportCheck.evaluate(input => getComputedStyle(input.nextElementSibling).backgroundColor);
        assert.notEqual(exportMarkColor, 'rgba(0, 0, 0, 0)');
        await exportCheck.press('Space');
        assert.equal(await exportCheck.isChecked(), false);
        await page.locator('.fpt-lot-dialog-close').click();

        await page.locator('#fp-bulk-edit-btn').click();
        await page.locator('.fpt-lot-dialog--bulk').waitFor();
        await page.screenshot({ path: path.join(qaDialogScreenshots, 'bulk-dialog-light.png') });
        const bulkControlMetrics = await page.locator('.fpt-lot-dialog--bulk').evaluate(dialog => {
            const field = selector => dialog.querySelector(selector);
            const style = selector => getComputedStyle(field(selector));
            const checkbox = field('#fptBulkFindName');
            return {
                textHeight: style('#fptBulkName').height,
                textRadius: style('#fptBulkName').borderRadius,
                textareaHeight: style('#fptBulkDescription').height,
                textareaResize: style('#fptBulkDescription').resize,
                priceSelectHeight: style('#fptBulkPriceMode').height,
                priceSelectRadius: style('#fptBulkPriceMode').borderRadius,
                filterHeight: style('.fpt-bulk-lot-filter').height,
                minimumPriceHeight: style('#fptBulkPriceMinimum').height,
                checkboxSize: [getComputedStyle(checkbox.nextElementSibling).width, getComputedStyle(checkbox.nextElementSibling).height],
                checkboxGap: getComputedStyle(checkbox.closest('label')).gap,
                groupRadius: getComputedStyle(field('.fpt-bulk-group')).borderRadius,
                special: [field('input[type="range"]')?.classList.contains('fpt-control-field') || false,
                    field('input[type="color"]')?.classList.contains('fpt-control-field') || false,
                    field('input[type="file"]')?.classList.contains('fpt-control-field') || false]
            };
        });
        assert.equal(bulkControlMetrics.textHeight, '40px');
        assert.equal(bulkControlMetrics.textRadius, '10px');
        assert.equal(bulkControlMetrics.textareaHeight, '76px');
        assert.equal(bulkControlMetrics.textareaResize, 'none');
        assert.equal(bulkControlMetrics.priceSelectHeight, '40px');
        assert.equal(bulkControlMetrics.priceSelectRadius, '10px');
        assert.equal(bulkControlMetrics.filterHeight, '40px');
        assert.equal(bulkControlMetrics.minimumPriceHeight, '40px');
        assert.deepEqual(bulkControlMetrics.checkboxSize, ['19px', '19px']);
        assert.equal(bulkControlMetrics.checkboxGap, '8px');
        assert.equal(bulkControlMetrics.groupRadius, '14px');
        assert.deepEqual(bulkControlMetrics.special, [false, false, false]);
        const bulkTextField = page.locator('#fptBulkName');
        await bulkTextField.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(200);
        const fieldFocusRing = await bulkTextField.evaluate(field => getComputedStyle(field).boxShadow);
        assert.equal(fieldFocusRing, 'none');
        const fieldFocusStyle = await bulkTextField.evaluate(field => {
            const style = getComputedStyle(field);
            return { outline: style.outlineStyle, borderColor: style.borderTopColor, visible: field.matches(':focus-visible'), focusedId: document.activeElement.id };
        });
        assert.equal(fieldFocusStyle.focusedId, 'fptBulkName');
        assert.equal(fieldFocusStyle.visible, true);
        assert.equal(fieldFocusStyle.outline, 'none');
        assert.equal(fieldFocusStyle.borderColor, 'rgb(118, 99, 246)');
        const bulkCheck = page.locator('#fptBulkFindName');
        await bulkCheck.focus();
        await page.keyboard.press('Space');
        assert.equal(await bulkCheck.isChecked(), false);
        const bulkCheckFocus = await bulkCheck.evaluate(input => getComputedStyle(input.nextElementSibling).outlineStyle);
        assert.equal(bulkCheckFocus, 'solid');
        assert.equal(await bulkCheck.evaluate(input => getComputedStyle(input.nextElementSibling).boxShadow), 'none');
        await page.keyboard.press('Space');
        assert.equal(await bulkCheck.isChecked(), true);
        const bulkDialogButton = page.locator('.fpt-lot-dialog--bulk .fpt-lot-dialog-close');
        await bulkDialogButton.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(200);
        const buttonFocus = await bulkDialogButton.evaluate(button => {
            const style = getComputedStyle(button);
            return { outline: style.outlineStyle, shadow: style.boxShadow };
        });
        assert.equal(buttonFocus.outline, 'solid');
        assert.equal(buttonFocus.shadow, 'none');
        for (const viewport of [{ width: 700, height: 560 }, { width: 520, height: 520 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(220);
            const compactDialog = await page.locator('.fpt-lot-dialog--bulk').evaluate(dialog => {
                const body = dialog.querySelector('.fpt-lot-dialog-body');
                const form = dialog.querySelector('.fpt-bulk-form');
                const fields = Array.from(form.querySelectorAll('.fpt-bulk-field'));
                return {
                    dialogWidth: dialog.getBoundingClientRect().width,
                    columns: Array.from(form.querySelectorAll('.fpt-bulk-dialog-grid')).map(grid => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length),
                    formOverflow: form.scrollWidth > form.clientWidth + 1,
                    secondFieldBelow: fields[1].getBoundingClientRect().top > fields[0].getBoundingClientRect().top,
                    bodyOverflow: body.scrollWidth > body.clientWidth + 1
                };
            });
            const shouldStackFields = viewport.width <= 520;
            assert.deepEqual(compactDialog.columns, shouldStackFields ? [1, 1] : [2, 2], `compact ${viewport.width}px dialog layout: ${JSON.stringify(compactDialog)}`);
            assert.equal(compactDialog.formOverflow, false);
            assert.equal(compactDialog.secondFieldBelow, shouldStackFields);
            assert.equal(compactDialog.bodyOverflow, false);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForTimeout(220);
        await page.locator('.fpt-lot-dialog-body').evaluate(body => { body.scrollTop = body.scrollHeight; });
        await page.screenshot({ path: path.join(qaDialogScreenshots, 'bulk-dialog-light-bottom.png') });
        await page.locator('.fpt-lot-dialog--bulk .fpt-lot-dialog-close').click();
        await page.evaluate(() => window.fptOpenPopupPage('slash_commands'));
        assert.equal(await page.locator('[data-page="templates"].fp-tools-page-content').getAttribute('data-fpt-page-mode'), 'commands');
        for (const retiredRoute of ['currency_calc', 'calculator', 'piggy_banks', 'telegram', 'support', 'global_chat']) {
            await page.evaluate(route => window.fptOpenPopupPage(route), retiredRoute);
            assert.equal(await page.locator('.fp-tools-page-content.active').getAttribute('data-page'), 'lot_io',
                `${retiredRoute} falls back to the supported lot page`);
        }
        await page.locator('#fptNavSearch').fill('приветствие');
        await page.waitForFunction(() => document.querySelectorAll('.fpt-nav-search-result').length > 0);
        assert.ok(await page.locator('.fpt-nav-search-result .fpt-nsr-page').filter({ hasText: 'Автоответчик' }).count() > 0);
        await page.locator('.fpt-nav-search-result').first().click();
        assert.equal(await page.locator('.fp-tools-page-content.active').getAttribute('data-page'), 'auto_reply');
        await page.locator('#fptNavCollapse').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.locator('#fptNavCollapse').click();
        await page.waitForFunction(() => !document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        const coverage = await page.evaluate(() => Object.entries(FPTPopupMetadata.pages).flatMap(([id, data]) => data.buttons.filter(button => !fptPopupActions.list(id).includes(button)).map(button => `${id}:${button}`)));
        assert.deepEqual(coverage, [], 'Every removed static button retains an action');
        const geometry = await page.evaluate(() => {
            const popup = document.querySelector('.fp-tools-popup'), nav = popup.querySelector('.fp-tools-nav');
            const p = popup.getBoundingClientRect();
            const pageSurface = popup.querySelector('.fp-tools-page-content.active');
            return { radius: getComputedStyle(popup).borderRadius, navRadius: getComputedStyle(nav).borderRadius,
                pageRadius: getComputedStyle(pageSurface).borderRadius, pageMarginTop: getComputedStyle(pageSurface).marginTop,
                pageTop: pageSurface.getBoundingClientRect().top-p.top,
                width:p.width, height:p.height, left:p.left, top:p.top, hasClose:!!popup.querySelector('.close-btn'),
                resize:getComputedStyle(popup).resize, centered:Math.abs(p.left+p.width/2-innerWidth/2)<1 && Math.abs(p.top+p.height/2-innerHeight/2)<1 };
        });
        assert.equal(geometry.radius, '24px'); assert.equal(geometry.navRadius, '24px');
        assert.equal(geometry.pageRadius, '24px'); assert.equal(geometry.pageMarginTop, '16px');
        assert.ok(Math.abs(geometry.pageTop - 17) <= 1);
        assert.equal(geometry.hasClose, false); assert.equal(geometry.resize, 'none'); assert.equal(geometry.centered, true);
        assert.equal(geometry.width, 1320); assert.equal(geometry.height, 780);
        assert.equal(await page.evaluate(() => document.querySelector('.fp-tools-popup').classList.contains('no-transform')), false);
        const brand = await page.locator('.fpt-nav-brand-title').boundingBox();
        const beforeDrag = await page.locator('.fp-tools-popup').boundingBox();
        await page.mouse.move(brand.x + 12, brand.y + 10); await page.mouse.down();
        await page.mouse.move(brand.x + 52, brand.y + 40, { steps: 5 }); await page.mouse.up();
        await page.waitForTimeout(100);
        const afterDrag = await page.locator('.fp-tools-popup').boundingBox();
        assert.ok(Math.abs(afterDrag.x-beforeDrag.x)<1); assert.ok(Math.abs(afterDrag.y-beforeDrag.y)<1);
        assert.ok(Math.abs(afterDrag.width-beforeDrag.width)<1); assert.ok(Math.abs(afterDrag.height-beforeDrag.height)<1);
        await page.evaluate(() => window.getSelection()?.removeAllRanges());

        for (const viewport of [
            { width: 1000, height: 700, expectedWidth: 940, expectedHeight: 630 },
            { width: 740, height: 600, expectedWidth: 696, expectedHeight: 540 },
            { width: 700, height: 500, expectedWidth: 658, expectedHeight: 450 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.waitForFunction(({ expectedWidth, expectedHeight }) => {
                const rect = document.querySelector('.fp-tools-popup').getBoundingClientRect();
                return Math.abs(rect.width-expectedWidth)<1 && Math.abs(rect.height-expectedHeight)<1
                    && Math.abs(rect.left+rect.width/2-innerWidth/2)<1
                    && Math.abs(rect.top+rect.height/2-innerHeight/2)<1;
            }, viewport);
            assert.ok(await page.locator('.fp-tools-popup').evaluate(p => {
                const r = p.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
            }));
        }
        await page.waitForFunction(() => document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.setViewportSize({ width: 900, height: 700 });
        await page.waitForFunction(() => !document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.locator('#fptNavCollapse').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.setViewportSize({ width: 700, height: 500 });
        await page.waitForFunction(() => document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.setViewportSize({ width: 900, height: 700 });
        await page.waitForFunction(() => document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        await page.locator('#fptNavCollapse').click();
        await page.waitForFunction(() => !document.querySelector('.fp-tools-nav').classList.contains('is-nav-collapsed'));
        for (const dark of [false, true]) {
            await page.evaluate(dark => {
                document.body.style.backgroundColor = dark ? '#15171a' : '#ffffff';
                window.fptComputePalette = () => ({ dark });
                fptApplyMenuTheme(document.querySelector('.fp-tools-popup'));
            }, dark);
            await page.waitForTimeout(400);
            const small = await page.locator('.fp-tools-popup').evaluate(popup => ({
                radius: getComputedStyle(popup).borderRadius,
                nav: getComputedStyle(popup.querySelector('.fp-tools-nav')).borderRadius,
                pageTop: popup.querySelector('.fp-tools-page-content.active').getBoundingClientRect().top-popup.getBoundingClientRect().top
            }));
            assert.equal(small.radius, '24px'); assert.equal(small.nav, '24px');
            assert.ok(Math.abs(small.pageTop - 17) <= 1);
        }
        const screenshotDir = path.join(require('node:os').tmpdir(), 'funpay-popup-reset-20261002');
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.setViewportSize({ width: 1204, height: 789 });
        await page.evaluate(() => window.fptOpenPopupPage('settings_io'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'settings_io');
        await page.waitForTimeout(380);
        const settingsNavigation = await page.evaluate(() => {
            const scroll = document.querySelector('.fpt-nav-scroll');
            const row = document.querySelector('.fpt-nav-child[data-page="settings_io"]');
            const viewport = scroll.getBoundingClientRect();
            const bounds = row.getBoundingClientRect();
            return { top: bounds.top, bottom: bounds.bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom };
        });
        assert.ok(settingsNavigation.top >= settingsNavigation.viewportTop - 1
            && settingsNavigation.bottom <= settingsNavigation.viewportBottom + 1,
        `the active settings row should remain visible above the sidebar footer: ${JSON.stringify(settingsNavigation)}`);
        await page.evaluate(() => window.fptOpenPopupPage('lot_io'));
        await page.waitForFunction(() => document.querySelector('.fp-tools-page-content.active')?.dataset.page === 'lot_io');
        const categoryThemeColors = [];
        await page.evaluate(() => { document.body.style.backgroundColor = '#fff'; window.fptComputePalette = () => ({ dark: false }); fptApplyMenuTheme(document.querySelector('.fp-tools-popup')); });
        await page.waitForTimeout(400);
        categoryThemeColors.push(await page.locator('.fp-tools-page-content[data-page="lot_io"]').evaluate(view => ({
            title: getComputedStyle(view.querySelector(':scope > .fpt-category-header .fpt-category-title')).color,
            action: getComputedStyle(view.querySelector('.fpt-lot-action-band')).backgroundColor,
            empty: getComputedStyle(view.querySelector('.fpt-lot-import-report')).backgroundColor
        })));
        await page.screenshot({ path: path.join(screenshotDir, 'lot-io-light.png') });
        await page.screenshot({ path: path.join(screenshotDir, 'shell-light.png') });
        await page.evaluate(() => { document.body.style.backgroundColor = '#15171a'; window.fptComputePalette = () => ({ dark: true }); fptApplyMenuTheme(document.querySelector('.fp-tools-popup')); });
        await page.waitForTimeout(400);
        categoryThemeColors.push(await page.locator('.fp-tools-page-content[data-page="lot_io"]').evaluate(view => ({
            title: getComputedStyle(view.querySelector(':scope > .fpt-category-header .fpt-category-title')).color,
            action: getComputedStyle(view.querySelector('.fpt-lot-action-band')).backgroundColor,
            empty: getComputedStyle(view.querySelector('.fpt-lot-import-report')).backgroundColor
        })));
        await page.screenshot({ path: path.join(screenshotDir, 'lot-io-dark.png') });
        await page.screenshot({ path: path.join(screenshotDir, 'shell-dark.png') });
        assert.notDeepEqual(categoryThemeColors[0], categoryThemeColors[1], 'category palette adapts to the selected theme');

        await page.mouse.click(1400, 950);
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup').classList.contains('is-closing'));
        assert.equal(await page.locator('.fp-tools-popup.active').count(), 1, 'the shell remains during its exit animation');
        await page.waitForFunction(() => !document.querySelector('.fp-tools-popup.active'), { timeout: 1000 });
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => window.fptOpenPopupPage('lot_io'));
        const reducedMotionButton = page.locator('.fpt-lot-action-button').first();
        const reducedMotionDuration = await reducedMotionButton.evaluate(button => getComputedStyle(button).transitionDuration);
        await reducedMotionButton.hover();
        await page.mouse.down();
        const reducedMotionPress = await reducedMotionButton.evaluate(button => getComputedStyle(button).transform);
        await page.mouse.up();
        assert.equal(reducedMotionDuration, '0s');
        assert.equal(reducedMotionPress, 'none');
        await page.locator('#fpToolsButton').dispatchEvent('click');
        await page.waitForFunction(() => !document.querySelector('.fp-tools-popup.active'));

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        await page.mouse.click(1400, 950);
        await page.waitForFunction(() => !document.querySelector('.fp-tools-popup.active'), { timeout: 300 });
        await page.locator('#fpToolsButton').click();
        await page.waitForFunction(() => document.querySelector('.fp-tools-popup.active'));
        assert.equal(await page.locator('.fp-tools-popup').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content:not([data-page="lot_io"]):not([data-page="auto_delivery"]):not([data-page="autobump"]):not([data-page="finance_hub"]):not([data-page="theme"]):not([data-page="auto_reply"]):not([data-page="needs"]):not([data-page="templates"]):not([data-page="auto_review"]):not([data-page="accounts"]):not([data-page="effects"]):not([data-page="tickets"]):not([data-page="sounds"]) > *:not(.fpt-category-header):not(.fpt-popup-toast-region)').count(), 0);
        assert.equal(await page.locator('.fp-tools-page-content > .fpt-category-header').count(), 17);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="lot_io"] > .fpt-lot-io').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="auto_delivery"] > .fpt-category-header').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="auto_delivery"] > .fpt-auto-delivery').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="autobump"] > .fpt-auto-bump').count(), 1);
        assert.equal(await page.locator('.fp-tools-page-content[data-page="theme"] > .fpt-th').count(), 1);
        const changed = await page.evaluate(() => Object.keys(qaInitial).filter(k => JSON.stringify(qaInitial[k]) !== JSON.stringify(qaSaved[k])));
        assert.deepEqual(changed, [], 'Navigation must not change feature settings');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
