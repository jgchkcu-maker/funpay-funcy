import { chromium } from 'file:///C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { stat, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'audit');
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
    + '<link rel="stylesheet" href="/css/reference_layout.css"><link rel="stylesheet" href="/css/reference_exact.css">'
    + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#e5effb;background-image:radial-gradient(900px 420px at 8% 0%,#eaf4ff,transparent 70%),linear-gradient(180deg,#f8fbff,#edf4fb);font-family:Inter,"Segoe UI",Arial,sans-serif}body::before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(rgba(255,255,255,.45),rgba(255,255,255,.2))}.fp-tools-popup{resize:none!important}</style>'
    + '<script>(function(){'
    + 'const store={autoBumpEnabled:true,autoBumpInterval:30,fpAutoRestoreEnabled:true,fpAutoDisableEnabled:true,fpToolsAutoDeliveryLots:{"Steam Wallet 1000 RUB":{enabled:true}},fpToolsAutoReplies:{greeting:true,orderConfirmed:true},telegramBotToken:"preview-token",discordWebhookUrl:"https://example.invalid/webhook",notificationVolume:72};'
    + 'const pick=(keys)=>{if(keys==null)return Object.assign({},store);if(typeof keys==="string")return {[keys]:store[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));if(typeof keys==="object")return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]??v]));return {}};'
    + 'window.chrome={runtime:{id:"funpay-funcy-preview",getURL:(p)=>"http://127.0.0.1:' + port + '/"+(String(p).startsWith("/")?String(p).slice(1):String(p)),sendMessage:async()=>({ok:true}),onMessage:{addListener(){},removeListener(){}}},storage:{local:{get:async(keys)=>pick(keys),set:async(obj)=>Object.assign(store,obj||{}),remove:async(keys)=>{for(const k of [].concat(keys||[]))delete store[k]}},sync:{get:async(keys)=>pick(keys),set:async(obj)=>Object.assign(store,obj||{})},onChanged:{addListener(){},removeListener(){}}},tabs:{create:async()=>({}),query:async()=>[],sendMessage:async()=>({})},alarms:{create(){},clear:async()=>true,onAlarm:{addListener(){}}},notifications:{create:async()=>"preview"},cookies:{getAll:async()=>[]}};'
    + 'window.initializeCurrencyCalculator=()=>{};'
    + '})();<\/script>'
    + '</head><body>'
    + '<script src="/content/ui/main_popup.js"><\/script>'
    + '<script src="/content/ui/pixel_expressive_shell.js"><\/script>'
    + '<script src="/content/ui/reference_layout.js"><\/script><script src="/content/ui/reference_exact.js"><\/script>'
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


const results = {};
try {
 const page = await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('https://**/*',r=>r.abort());
 await page.goto(`http://127.0.0.1:${port}/__preview`);
 await page.waitForFunction(()=>document.querySelector('.fpf-exact-dashboard'));
 await page.addScriptTag({url:`http://127.0.0.1:${port}/content/ui/popup_viewport_guard.js`});
 await page.addScriptTag({url:`http://127.0.0.1:${port}/content/ui/subtabs_motion.js`});
 const go=async id=>{await page.evaluate(id=>window.openPage(id),id);await page.waitForTimeout(250)};
 results.dashboard=await page.locator('.fpf-exact-dashboard .fpf-kpi-grid').innerText();
 await page.getByRole('button',{name:'Запустить авто-поднятие',exact:false}).click();
 results.quickAction=await page.evaluate(()=>({page:[...document.querySelectorAll('.fp-tools-page-content')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.page),enabled:document.querySelector('#autoBumpEnabled')?.checked}));
 await page.locator('.fpf-auto-state input').uncheck();
 results.autoState=await page.locator('.fpf-auto-state').innerText();
 await go('theme');
 results.font=await page.locator('[data-sync-value="#themeFontSelect"]').evaluate(e=>({value:e.value,selected:e.selectedIndex,options:[...e.options].map(o=>({value:o.value,text:o.text}))}));
 await page.locator('[data-sync-value="#themeBgBlur"]').fill('7');
 results.blur=await page.locator('[data-sync-value="#themeBgBlur"]').evaluate(e=>({value:e.value,label:e.parentElement.innerText,source:document.querySelector('#themeBgBlur')?.value}));
 await page.evaluate(()=>{let p=document.querySelector('.fp-tools-popup');p.classList.remove('fptm-light');p.classList.add('fptm-dark')});
 await page.waitForTimeout(100);
 results.dark=await page.locator('.fp-tools-popup').getAttribute('class');
 await go('needs');
 results.a11yNeeds=await page.locator('.fpf-custom-view').ariaSnapshot();
 const before=await page.locator('.fpf-custom-groups').innerText();
 await page.locator('.fpf-custom-filter input').fill('NO_MATCH_9283');
 results.searchUnchanged=(await page.locator('.fpf-custom-groups').innerText())===before;
 await go('dashboard');
 for(const width of [1366,768,320]) {
 await page.setViewportSize({width,height:768});await page.waitForTimeout(250);
 results['layout'+width]=await page.evaluate(()=>{let p=document.querySelector('.fp-tools-popup'), c=document.querySelector('.fp-tools-content');let r=p.getBoundingClientRect();return {popup:{x:r.x,y:r.y,width:r.width,height:r.height},content:{client:c.clientWidth,scroll:c.scrollWidth},overflow:[...document.querySelectorAll('.fpf-exact-dashboard button')].filter(e=>{let b=e.getBoundingClientRect();return b.width&&b.right>innerWidth}).map(e=>e.innerText)}});
 await page.screenshot({path:join(outDir,`dashboard-${width}.png`)});
 }
 const pp=await browser.newPage({viewport:{width:320,height:720},reducedMotion:'reduce'});
 await pp.route('https://**/*',r=>r.abort());
 await pp.addInitScript(()=>{window.chrome={runtime:{getManifest:()=>({version:'2.9.9'})},tabs:{query:(q,cb)=>cb([])},storage:{local:{get:(q,cb)=>cb({}),set:()=>{}}}}});
 await pp.goto(`http://127.0.0.1:${port}/popup/popup.html`);
 await pp.waitForTimeout(350);
 results.popup=await pp.evaluate(()=>({animation:getComputedStyle(document.querySelector('.popup-wrapper')).animationName,text:document.body.innerText,pairs:['.instruction-text','.quick-links a','.stat-label'].map(sel=>{let e=document.querySelector(sel),s=getComputedStyle(e);return {sel,color:s.color,background:getComputedStyle(document.body).backgroundColor,size:s.fontSize}})}));
 await pp.screenshot({path:join(outDir,'browser-popup.png'),fullPage:true});
 const lum=s=>{let a=s.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};
 for(const p of results.popup.pairs){const a=lum(p.color),b=lum(p.background);p.contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
 await writeFile(join(outDir,'runtime-results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
} finally {await browser.close();server.close()}


