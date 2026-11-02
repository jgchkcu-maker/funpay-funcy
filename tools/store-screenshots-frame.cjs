#!/usr/bin/env node
// Frames the raw captures from tools/store-screenshots.cjs into 1280x800 Chrome Web Store images:
// a headline about the feature on the brand gradient, the real interface below it.
//
//   node tools/store-screenshots-frame.cjs [outDir]
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.FPT_PLAYWRIGHT || 'playwright')); }
catch { ({ chromium } = require('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'docs/store/screenshots'));
const rawDir = path.join(outDir, 'raw');

const SLIDES = [
    { file: '01-analytics', raw: 'finance', kicker: 'Финансы', title: 'Видно, сколько вы реально зарабатываете',
        text: 'Выручка, чистая прибыль с учётом себестоимости и потенциал склада по дням и категориям.' },
    { file: '02-auto-delivery', raw: 'delivery', kicker: 'Автовыдача', title: 'Товар уходит покупателю сам — и только один раз',
        text: 'Склад или шаблон с переменными и паузами. Журнал каждой отправки защищает от повторов.' },
    { file: '03-bulk-editor', raw: 'bulk', kicker: 'Лоты', title: 'Десятки лотов — одним действием',
        text: 'Названия, цены и описания сразу у всей категории. Предпросмотр до сохранения.' },
    { file: '04-auto-reply', raw: 'autoreply', kicker: 'Покупатели', title: 'Отвечает, пока вас нет',
        text: 'Приветствие, ответы по ключевым словам и напоминание об отзыве. С картинками.' },
    { file: '05-themes', raw: 'theme', kicker: 'Оформление', title: 'FunPay в вашем стиле',
        text: 'Свои цвета, фон и видеофон, шрифты и стекло. Плавные анимации и тёмная тема.' }
];

function html(slide, image) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
    body {
        font-family: 'Segoe UI Variable Display', 'Segoe UI', Inter, system-ui, sans-serif;
        color: #fff;
        background:
            radial-gradient(900px 520px at 88% -10%, rgba(141, 120, 255, .55), transparent 60%),
            radial-gradient(700px 480px at -5% 110%, rgba(255, 122, 182, .35), transparent 60%),
            linear-gradient(160deg, #1b1442 0%, #2a1d6b 45%, #5137c9 100%);
        position: relative;
    }
    .grain { position: absolute; inset: 0; opacity: .08; background-image: radial-gradient(rgba(255,255,255,.7) 1px, transparent 1px); background-size: 22px 22px; mask-image: linear-gradient(#000, transparent 55%); }
    header { position: absolute; left: 64px; right: 64px; top: 48px; display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
    .kicker { display: inline-flex; align-items: center; gap: 10px; padding: 7px 14px 7px 8px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22); font-size: 17px; font-weight: 600; letter-spacing: .2px; }
    .kicker img { width: 26px; height: 26px; border-radius: 8px; }
    h1 { margin: 16px 0 0; font-size: 46px; line-height: 1.08; font-weight: 750; letter-spacing: -.8px; max-width: 760px; }
    p { margin: 0 0 6px; max-width: 360px; font-size: 19px; line-height: 1.45; color: rgba(255,255,255,.82); }
    .shot { position: absolute; left: 50%; top: 236px; width: 1120px; transform: translateX(-50%); border-radius: 22px; overflow: hidden;
        box-shadow: 0 40px 90px rgba(10, 4, 40, .55), 0 0 0 1px rgba(255,255,255,.18); }
    .shot img { display: block; width: 100%; }
    </style></head><body>
    <div class="grain"></div>
    <header>
        <div>
            <span class="kicker"><img src="${path.join(root, 'icons/icon128.png').replace(/\\/g, '/').replace(/^/, 'file:///')}" alt="">${slide.kicker}</span>
            <h1>${slide.title}</h1>
        </div>
        <p>${slide.text}</p>
    </header>
    <div class="shot"><img src="${image}"></div>
    </body></html>`;
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.FPT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
        for (const slide of SLIDES) {
            const raw = path.join(rawDir, `${slide.raw}.png`);
            if (!fs.existsSync(raw)) { console.warn('missing', raw); continue; }
            const htmlFile = path.join(rawDir, `${slide.file}.html`);
            fs.writeFileSync(htmlFile, html(slide, 'file:///' + raw.replace(/\\/g, '/')));
            await page.goto('file:///' + htmlFile.replace(/\\/g, '/'));
            await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(img => img.decode())]));
            const target = path.join(outDir, `${slide.file}.png`);
            await page.screenshot({ path: target });
            fs.unlinkSync(htmlFile);
            console.log('framed', path.relative(root, target));
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
