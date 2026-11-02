const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.join(__dirname, '..');

test('selling editor cells have consistent padding, centered controls and contained mobile scrolling', async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        for (const width of [360, 768, 1280]) for (const dark of [true, false]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } });
            await page.setContent(`<!doctype html><html><head><style>
                *{box-sizing:border-box} body{margin:0;background:${dark ? '#111416' : '#f6f7f9'};color:${dark ? '#eef0f2' : '#292c33'};font:14px/20px 'Segoe UI',sans-serif}
                .page-content{width:100%;max-width:990px;margin:40px auto;padding:0 24px}.page-header{font-size:28px;line-height:1.2;margin:20px 0 16px}
                .alert{padding:16px 20px;border:1px solid #709fdc;border-radius:14px;background:${dark ? '#263341' : '#eaf2fc'};margin-bottom:12px}
                .row{margin:0 -5px}.row:after{content:'';display:table;clear:both}[class*=col-sm]{padding:0 5px}
                @media(min-width:768px){.col-sm-9{float:left;width:75%}.col-sm-3{float:left;width:25%}}
                .tc{display:table;width:100%;border-spacing:0;border:1px solid ${dark ? '#34383e' : '#dce0e5'};border-radius:14px;background:${dark ? '#1b1e21' : '#fff'}}
                .tc-header,.tc-item{display:table-row}.tc-header>div,.tc-item>div{display:table-cell;vertical-align:top;padding-left:8px;padding-right:8px}
                .tc-header>div{padding-top:12px;padding-bottom:12px;border-bottom:1px solid ${dark ? '#34383e' : '#dce0e5'}}
                .tc-selling{margin-bottom:17px}.tc-selling .tc-item>div{height:auto}.tc-selling .tc-item>div.tc-input{padding-top:4px;padding-bottom:16px}
                .tc-selling .tc-item>div.tc-checkbox,.tc-selling .tc-item>div.tc-server{padding-top:3px;padding-bottom:5px}
                .tc-selling .tc-header>div,.tc-selling .tc-item>div{padding-right:0;padding-left:8px}.tc-selling .tc-header>div:first-child,.tc-selling .tc-item>div:first-child,.tc-selling .tc-header>div.tc-server{padding-left:0}
                .tc-server{white-space:nowrap}.tc-input{width:23%}.tc-price{white-space:nowrap}.form-group{margin-bottom:17px}.tc-selling .form-group{margin:0}
                .form-group>label{display:block;font-size:9px;line-height:14px;letter-spacing:1px;margin-bottom:7px;text-transform:uppercase}
                .input-group{display:flex;align-items:center;background:${dark ? '#292c30' : '#edf0f4'};border-radius:14px;overflow:hidden}
                .form-control{width:100%;min-width:0;height:38px;padding:8px 12px;border:0;background:transparent;color:inherit;font:600 14px/20px 'Segoe UI',sans-serif}
                .unit{padding-right:12px;font-size:12px;font-weight:600}.help-block{display:block;margin:8px 0 10px;opacity:.7}.selling-min{margin-top:32px;margin-bottom:30px}
                .btn{display:block;width:100%;min-height:36px;padding:8px 12px;background:${dark ? '#393a47' : '#dce3f0'};color:inherit;font:600 14px/20px 'Segoe UI',sans-serif;border:0;border-radius:14px;cursor:pointer}
                .switch{position:relative;display:inline-flex;align-items:center;width:28px;height:16px;vertical-align:top;margin:0;background:#4384d0;border-radius:12px}.switch:after{content:'';position:absolute;right:2px;top:2px;width:12px;height:12px;background:white;border-radius:50%;pointer-events:none}.switch input{position:absolute;inset:0;margin:0;width:100%;height:100%;opacity:0}
            </style></head><body><main class="page-content">
                <div class="alert">Покупатель должен получить ровно столько, сколько указано в заказе. Все дополнительные расходы лежат на продавце.</div>
                <div class="alert">Чтобы избежать блокировок, указывайте наличие неточно и обновляйте его с задержкой.</div>
                <h1 class="page-header">Вирты GTA 5 RP, SAMP</h1><form><div class="row">
                <div class="col-sm-9"><div class="tc tc-selling"><div class="tc-header"><div class="tc-checkbox"></div><div class="tc-server">Сервер</div><div class="tc-input">Наличие</div><div class="tc-input">Цена/1кк</div><div class="tc-price">Цена в каталоге</div></div>
                <div class="tc-item"><div class="tc-checkbox"><label class="switch"><input type="checkbox" name="active" checked></label></div><div class="tc-server">7HillsRP.ru</div>
                <div class="tc-input"><div class="form-group"><div class="input-group"><input class="form-control" name="amount" value="111"><span class="unit">кк</span></div></div></div>
                <div class="tc-input"><div class="form-group"><div class="input-group"><input class="form-control" name="price" value="111"><span class="unit">₽</span></div></div></div><div class="tc-price"><span class="help-block">135.64 ₽</span></div></div></div>
                <button class="btn show-more" type="button">Показать ещё серверы</button></div>
                <div class="col-sm-3"><div class="selling-min"><div class="form-group"><label for="minimum">Минимальная сумма заказа</label><div class="input-group"><input id="minimum" class="form-control" name="minimum" value="100"><span class="unit">₽</span></div><span class="help-block">Чем меньше, тем лучше!</span></div><button type="submit" class="btn">Сохранить</button></div></div>
                </div></form></main></body></html>`);
            await page.addStyleTag({ path: path.join(root, 'css/content_styles.css') });
            await page.evaluate(() => {
                document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.saved = Object.fromEntries(new FormData(event.currentTarget)); });
                document.querySelector('.show-more').addEventListener('click', () => { const row = document.querySelector('.tc-item').cloneNode(true); row.querySelector('.tc-server').textContent = 'Второй сервер'; row.querySelectorAll('[name]').forEach(input => { input.name += '_second'; }); document.querySelector('.tc-selling').append(row); });
            });
            const geometry = await page.evaluate(() => {
                const cells = Array.from(document.querySelectorAll('.tc-item>div'));
                const middle = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
                const table = document.querySelector('.tc-selling').getBoundingClientRect();
                const more = document.querySelector('.show-more').getBoundingClientRect();
                return {
                    paddings: cells.map(cell => [getComputedStyle(cell).paddingTop, getComputedStyle(cell).paddingBottom, getComputedStyle(cell).paddingLeft]),
                    centers: cells.map(middle), inputCenter: middle(document.querySelector('[name=amount]')), toggleCenter: middle(document.querySelector('.switch')),
                    pageOverflow: document.documentElement.scrollWidth > innerWidth,
                    scrollContained: document.querySelector('.col-sm-9').scrollWidth > document.querySelector('.col-sm-9').clientWidth,
                    buttonGap: more.top - table.bottom,
                    inputHeight: document.querySelector('[name=amount]').getBoundingClientRect().height,
                    buttonBottomDelta: Math.abs(more.bottom - document.querySelector('.selling-min .btn').getBoundingClientRect().bottom)
                };
            });
            for (const padding of geometry.paddings) assert.deepEqual(padding, ['12px', '12px', '16px']);
            assert.ok(geometry.centers.every(center => Math.abs(center - geometry.inputCenter) <= 1));
            assert.ok(Math.abs(geometry.toggleCenter - geometry.inputCenter) <= 1);
            assert.ok(geometry.buttonGap >= 16);
            if (width >= 768) assert.ok(geometry.buttonBottomDelta <= 1, 'bottom actions should align');
            assert.equal(geometry.inputHeight, 40);
            assert.equal(geometry.pageOverflow, false, `page overflows at ${width}`);
            assert.equal(geometry.scrollContained, width <= 640);
            if (process.env.FPT_TOOLBAR_SCREENSHOTS) {
                const dir = path.join(root, 'output/selling-editor-spacing');
                fs.mkdirSync(dir, { recursive: true });
                await page.screenshot({ path: path.join(dir, `${dark ? 'dark' : 'light'}-${width}.png`), fullPage: true });
            }
            await page.locator('.show-more').click();
            assert.equal(await page.locator('.tc-item').count(), 2);
            await page.locator('[name=amount]').first().fill('222');
            await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
            assert.equal(await page.evaluate(() => window.saved.amount), '222');
            await page.close();
        }
    } finally { await browser.close(); }
});
