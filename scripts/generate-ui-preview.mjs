import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { stat, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'ui-preview');
await mkdir(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8'
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const resolved = resolve(root, normalize(clean));
  if (!resolved.startsWith(resolve(root))) throw new Error('Invalid path');
  return resolved;
}

function fixture(port) {
  return '<!doctype html><html lang="ru"><head>'
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>FunPay Funcy UI Preview</title>'
    + '<link rel="stylesheet" href="/css/content_styles.css">'
    + '<link rel="stylesheet" href="/css/ai_creator.css">'
    + '<link rel="stylesheet" href="/css/fpt_icons_theme.css">'
    + '<link rel="stylesheet" href="/css/template_popover_material.css">'
    + '<link rel="stylesheet" href="/css/settings_sidebar_material3.css">'
    + '<link rel="stylesheet" href="/css/subtabs_material3.css">'
    + '<link rel="stylesheet" href="/css/settings_responsive_guard.css">'
    + '<link rel="stylesheet" href="/css/pixel_expressive.css">'
    + '<link rel="stylesheet" href="/css/reference_layout.css">'
    + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:radial-gradient(900px 420px at 8% 0%,#eaf4ff,transparent 70%),linear-gradient(180deg,#f8fbff,#edf4fb);font-family:Inter,"Segoe UI",Arial,sans-serif}body::before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(rgba(255,255,255,.45),rgba(255,255,255,.2))}.fp-tools-popup{resize:none!important}</style>'
    + '<script>(function(){'
    + 'const store={autoBumpEnabled:true,autoBumpInterval:30,fpAutoRestoreEnabled:true,fpAutoDisableEnabled:true,fpToolsAutoDeliveryLots:{"Steam Wallet 1000 RUB":{enabled:true}},fpToolsAutoReplies:{greeting:true,orderConfirmed:true},telegramBotToken:"preview-token",discordWebhookUrl:"https://example.invalid/webhook",notificationVolume:72};'
    + 'const pick=(keys)=>{if(keys==null)return Object.assign({},store);if(typeof keys==="string")return {[keys]:store[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==="object")return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]??v]));return {}};'
    + 'window.chrome={runtime:{id:"funpay-funcy-preview",getURL:(p)=>"http://127.0.0.1:' + port + '/"+(String(p).startsWith("/")?String(p).slice(1):String(p)),sendMessage:async()=>({ok:true}),onMessage:{addListener(){},removeListener(){}}},storage:{local:{get:async(keys)=>pick(keys),set:async(obj)=>Object.assign(store,obj||{}),remove:async(keys)=>{for(const k of [].concat(keys||[]))delete store[k]}},sync:{get:async(keys)=>pick(keys),set:async(obj)=>Object.assign(store,obj||{})},onChanged:{addListener(){},removeListener(){}}},tabs:{create:async()=>({}),query:async()=>[],sendMessage:async()=>({})},alarms:{create(){},clear:async()=>true,onAlarm:{addListener(){}}},notifications:{create:async()=>"preview"},cookies:{getAll:async()=>[]}};'
    + 'window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>"";'
    + '})();<\/script>'
    + '</head><body>'
    + '<script src="/content/ui/main_popup.js"><\/script>'
    + '<script src="/content/ui/pixel_expressive_shell.js"><\/script>'
    + '<script src="/content/ui/reference_layout.js"><\/script>'
    + '<script>(function(){'
    + 'const popup=createMainPopup();popup.classList.add("active");document.body.appendChild(popup);setupPopupNavigation();'
    + 'const sampleRow=(title,subtitle,badge="Активно")=>{const row=document.createElement("div");row.className="fpt-setting-card fpf-preview-row";row.innerHTML="<div class=\\"fpt-setting-info\\"><div class=\\"fpt-setting-title-row\\"><span class=\\"fpt-setting-title\\">"+title+"</span><span class=\\"fpt-badge fpt-badge-location\\">"+badge+"</span></div><div class=\\"fpt-setting-desc\\">"+subtitle+"</div></div><label class=\\"fpt-switch\\"><input type=\\"checkbox\\" checked><span class=\\"fpt-switch-slider\\"></span></label>";return row};'
    + 'const templates=document.getElementById("template-settings-container");if(templates){[["Приветствие (стандарт)","Здравствуйте! 👋 Спасибо за интерес к товару."],["Подтверждение оплаты","Оплату получил ✅ Начинаю выполнение заказа."],["Инструкция после покупки","Вот что нужно сделать после покупки…"],["Завершение сделки","Спасибо за покупку! Если остались вопросы — пишите."],["Задержка / ожидание","Извините за ожидание, сейчас занят, вернусь в ближайшее время."]].forEach(([title,text],i)=>{const row=document.createElement("div");row.className="template-item";row.innerHTML="<div class=\\"template-item-header\\"><input type=\\"checkbox\\" class=\\"template-toggle\\" checked><div class=\\"template-label\\">"+title+"</div><span class=\\"fpt-badge fpt-badge-location\\">"+(i===1?"Оплата":i===2?"Информация":"Шаблон")+"</span></div><textarea class=\\"template-input\\" rows=\\"2\\">"+text+"</textarea>";templates.appendChild(row)})}'
    + 'const accounts=document.getElementById("fpToolsAccountsList");if(accounts)accounts.append(sampleRow("main_seller","Основной аккаунт · Баланс 47 320 ₽","Основной"),sampleRow("backup_shop","Резервный профиль · Последняя синхронизация 2 мин назад","Сохранён"));'
    + 'const delivery=document.getElementById("fp-delivery-lots-list");if(delivery)delivery.append(sampleRow("Steam Wallet 1000 RUB","Выдача: из списка секретов · Остаток 12","Авто-выдача"),sampleRow("Valorant Points 1750","Выдача: сообщение + ключ · Остаток 6","Авто-выдача"),sampleRow("Minecraft Premium","Выдача: из секрета лота · Остаток 4","Авто-выдача"));'
    + 'const blacklist=document.getElementById("fp-bl-list");if(blacklist)blacklist.append(sampleRow("markus","Причина: спор после оплаты","В ЧС"),sampleRow("delay_user","Причина: многократные отмены","В ЧС"));'
    + 'const needs=document.getElementById("fpt-needs-list");if(needs&&!needs.children.length){[["Кнопка «Заметка» в чате","Показывает кнопку заметок под панелью покупателя."],["Блок быстрых действий в чате","Дополнительные инструменты и кнопки для работы с клиентами."],["Кнопка «Копировать лот»","Кнопка под блоком товара на странице заказа."],["Копирование номера заказа","Кликабельный номер заказа в заголовке страницы."],["Кнопка «Выбрать» лоты","Режим выделения нескольких лотов для массовых действий."],["Пункт «Добавить новую метку»","Добавляет пункт в меню статусов собеседника."]].forEach(([title,desc])=>needs.appendChild(sampleRow(title,desc,"Включено")))}'
    + 'const pending=document.getElementById("lot-io-pending-imports-list");if(pending)pending.innerHTML="<div class=\\"fpf-ref-empty\\">Незавершённых импортов нет.</div>";'
    + 'document.documentElement.dataset.previewReady="1";'
    + '})();<\/script>'
    + '</body></html>';
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__preview') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fixture(server.address().port));
      return;
    }
    const path = safePath(req.url || '/');
    const s = await stat(path);
    if (!s.isFile()) throw new Error('Not file');
    res.writeHead(200, {
      'content-type': mime[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });

const labels = {
  dashboard: '01-dashboard',
  autobump: '02-automation-auto-bump',
  auto_delivery: '03-automation-auto-delivery',
  auto_review: '04-automation-auto-reviews',
  templates: '05-chat-templates',
  slash_commands: '06-chat-slash-commands',
  notes: '07-chat-notes',
  blacklist: '08-chat-blacklist',
  lot_io: '09-lots-management',
  pricing: '10-lots-pricing',
  sales_stats: '11-finance-statistics',
  calculator: '12-finance-calculator',
  currency_calc: '13-finance-currency',
  theme: '14-appearance-theme',
  needs: '15-appearance-customization',
  general: '16-system-notifications',
  accounts: '17-system-accounts',
  telegram: '18-system-telegram',
  settings_io: '19-system-backups',
  tickets: '20-system-support',
  support: '21-about'
};

const gallery = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  await page.goto('http://127.0.0.1:' + port + '/__preview', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.previewReady === '1');
  await page.waitForTimeout(700);

  for (const [pageId, fileBase] of Object.entries(labels)) {
    await page.evaluate((id) => {
      if (typeof window.openPage === 'function') window.openPage(id);
      const content = document.querySelector('.fp-tools-content');
      if (content) content.scrollTop = 0;
    }, pageId);
    await page.waitForTimeout(300);
    const path = join(outDir, fileBase + '.png');
    await page.screenshot({ path });
    gallery.push({ id: pageId, file: fileBase + '.png', title: fileBase.replace(/^\\d+-/, '').replaceAll('-', ' ') });
  }
  await page.close();

  const popupPage = await browser.newPage({ viewport: { width: 430, height: 720 }, deviceScaleFactor: 1 });
  await popupPage.addInitScript(({ p }) => {
    const store = {};
    window.chrome = {
      runtime: { id: 'preview', getManifest: () => ({ version: '2.9.9' }), getURL: x => 'http://127.0.0.1:' + p + '/' + x },
      storage: { local: { get: async () => store, set: async x => Object.assign(store, x) } },
      tabs: { create: async () => ({}) }
    };
  }, { p: port });
  await popupPage.goto('http://127.0.0.1:' + port + '/popup/popup.html', { waitUntil: 'networkidle' });
  await popupPage.waitForTimeout(400);
  await popupPage.screenshot({ path: join(outDir, '00-browser-popup.png'), fullPage: true });
  gallery.unshift({ id: 'browser-popup', file: '00-browser-popup.png', title: 'browser popup' });
  await popupPage.close();
} finally {
  await browser.close();
  server.close();
}

const cards = gallery.map(x => '<section class="card"><h2>' + x.title + '</h2><img src="' + x.file + '" alt="' + x.title + '"></section>').join('');
const galleryHtml = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>FunPay Funcy — UI Preview</title><style>'
  + 'body{margin:0;background:#eef4fb;color:#142033;font-family:Inter,Segoe UI,Arial,sans-serif}main{max-width:1500px;margin:auto;padding:32px}h1{margin:0 0 6px;font-size:32px}p{margin:0 0 24px;color:#66758c}.grid{display:grid;grid-template-columns:1fr;gap:28px}.card{background:#fff;border:1px solid #dbe6f2;border-radius:18px;padding:14px;box-shadow:0 10px 32px rgba(42,67,106,.07)}.card h2{font-size:16px;margin:0 0 10px;text-transform:capitalize}.card img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid #edf2f7}'
  + '</style></head><body><main><h1>FunPay Funcy — UI Preview</h1><p>Автоматический визуальный снимок интерфейса из GitHub Actions.</p><div class="grid">'
  + cards + '</div></main></body></html>';

await writeFile(join(outDir, 'index.html'), galleryHtml, 'utf8');
await writeFile(join(outDir, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), screenshots: gallery }, null, 2), 'utf8');

console.log('Generated ' + gallery.length + ' screenshots in ' + outDir);
