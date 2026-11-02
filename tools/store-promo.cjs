#!/usr/bin/env node
// Exact Chrome Web Store exports using generated artwork and original product assets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/store/upload');
const art = path.join(root, 'docs/store/promo');
const data = file => `data:image/png;base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;

function html(width, height, small) {
    return `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
    body{position:relative;background:#171137;color:#fff;font-family:'Segoe UI Variable Display','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
    .background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,10,42,.22),transparent 65%)}
    .brand{position:absolute;left:56px;top:52px;display:flex;align-items:center;gap:19px}
    .brand img{width:64px;height:64px;filter:drop-shadow(0 9px 16px rgba(0,0,0,.2))}
    .brand span{font-size:45px;font-weight:750;letter-spacing:-1.5px;line-height:1}
    .kicker{position:absolute;left:60px;top:153px;font-size:12px;font-weight:650;letter-spacing:2px;color:#c8c0ff}
    h1{position:absolute;left:56px;top:192px;margin:0;font-size:62px;line-height:1.05;font-weight:750;letter-spacing:-2px}
    .description{position:absolute;left:60px;top:353px;margin:0;font-size:21px;line-height:1.45;color:#e0dafa}
    .footer{position:absolute;left:60px;bottom:43px;font-size:14px;letter-spacing:.2px;color:#bcb1e9}
    .window{position:absolute;left:695px;top:90px;width:790px;border:1px solid rgba(255,255,255,.65);border-radius:18px;overflow:hidden;transform:rotate(-4deg);box-shadow:0 28px 70px rgba(10,5,35,.6),0 0 0 7px rgba(255,255,255,.07)}
    .window>img{display:block;width:100%}
    ${small ? `
    .background{object-position:62% center}
    .shade{background:linear-gradient(90deg,rgba(15,10,42,.28),transparent)}
    .brand{left:26px;top:24px;gap:12px}
    .brand img{width:52px;height:52px}
    .brand span{font-size:35px;letter-spacing:-1px}
    .kicker{display:none}
    h1{left:28px;top:107px;font-size:30px;line-height:1.12;letter-spacing:-.8px}
    .description{left:29px;top:190px;font-size:13px;line-height:1.4;color:#ded6fb}
    .footer{left:29px;bottom:22px;font-size:11px;letter-spacing:0}
    .window{left:282px;top:104px;width:285px;border-radius:12px;transform:rotate(-9deg);box-shadow:0 18px 38px rgba(10,5,35,.55),0 0 0 4px rgba(255,255,255,.07)}
    ` : ''}
    </style><body>
    <img class="background" src="${data('docs/store/promo/source-background.png')}" alt=""><div class="shade"></div>
    <div class="window"><img src="${data('docs/store/screenshots/raw/finance.png')}" alt="Интерфейс Funcy"></div>
    <div class="brand"><img src="${data('icons/funcy-logo.png')}" alt=""><span>Funcy</span></div>
    <div class="kicker">ДЛЯ ПРОДАВЦОВ FUNPAY</div>
    <h1>${small ? 'Ваш магазин.<br>Под контролем.' : 'Магазин<br>под контролем.'}</h1>
    <p class="description">${small ? 'Инструменты для FunPay' : 'Автовыдача, автоответы<br>и аналитика — прямо в браузере.'}</p>
    <div class="footer">${small ? 'Автовыдача · Автоответы · Аналитика' : 'Лоты · Заказы · Оформление'}</div>
    </body></html>`;
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        for (const [file, width, height, small] of [
            ['06-small-promo-440x280.png', 440, 280, true],
            ['07-marquee-1400x560.png', 1400, 560, false]
        ]) {
            const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
            await page.setContent(html(width, height, small));
            await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images, img => img.decode())]));
            const overflow = await page.locator('h1,.brand,.description,.footer').evaluateAll(nodes => nodes.filter(el => {
                const r = el.getBoundingClientRect();
                return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
            }).map(el => el.className || el.tagName));
            if (overflow.length) throw new Error(`Text outside ${file}: ${overflow.join(', ')}`);
            await page.screenshot({ path: path.join(output, file) });
            await page.close();
        }
    } finally { await browser.close(); }
    fs.copyFileSync(path.join(root, 'icons/icon128.png'), path.join(output, '00-store-icon-128x128.png'));
    for (const file of fs.readdirSync(path.join(root, 'docs/store/screenshots')).filter(file => /^0[1-5]-.+\.png$/.test(file))) {
        fs.copyFileSync(path.join(root, 'docs/store/screenshots', file), path.join(output, file));
    }
    const listing = fs.readFileSync(path.join(root, 'docs/store/listing.md'), 'utf8');
    const description = listing.split('## Основное описание')[1].split('## Перед подачей')[0].trim().replace(/\*\*/g, '');
    fs.writeFileSync(path.join(output, 'description.txt'), description + '\n', 'utf8');
    const fields = `ПОЛЯ КАБИНЕТА CHROME WEB STORE — FUNCY\n\nОписание: содержимое description.txt.\nКатегория: Workflow & Planning.\nЯзык: русский / Russian.\nЗначок магазина: 00-store-icon-128x128.png.\nСкриншоты: пять файлов 01…05.png.\nМаленькое рекламное изображение: 06-small-promo-440x280.png.\nОчень большое рекламное изображение: 07-marquee-1400x560.png.\nГлобальный проморолик: оставить пустым, пока нет видео на YouTube.\nОфициальный URL: Нет, пока нет подтверждённого собственного сайта.\nURL главной страницы: https://github.com/jgchkcu-maker/funpay-funcy (если репозиторий доступен публично).\nURL службы поддержки: https://github.com/jgchkcu-maker/funpay-funcy/issues (если раздел доступен публично).\nТолько для взрослых: выключено для текущего содержимого Funcy.\n\nТексты для вкладки «Конфиденциальность»: ../dashboard.md.\nПубличный URL политики нужно получить после её публикации.\n\nПромо содержит действующую иконку и настоящий интерфейс расширения с демонстрационными данными. Фон сгенерирован встроенным ImageGen.\n`;
    fs.writeFileSync(path.join(output, 'fields.txt'), fields, 'utf8');
    const files = fs.readdirSync(output).map(file => {
        const buffer = fs.readFileSync(path.join(output, file));
        const png = file.endsWith('.png');
        const record = { file, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
        if (png) Object.assign(record, { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), pngColorType: buffer[25] });
        return record;
    });
    const provenance = { generatedAt: new Date().toISOString(), method: 'Built-in ImageGen background; deterministic HTML composition and Chrome export', sourceArtwork: 'docs/store/promo/source-background.png', sourceLogo: 'icons/funcy-logo.png', sourceScreenshot: 'docs/store/screenshots/raw/finance.png', descriptionCharacters: description.length, files };
    fs.writeFileSync(path.join(art, 'exports.json'), JSON.stringify(provenance, null, 2) + '\n');
    console.log(JSON.stringify(provenance, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
