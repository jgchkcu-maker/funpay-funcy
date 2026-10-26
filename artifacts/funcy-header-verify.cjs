const fs = require('node:fs');
const assert = require('node:assert/strict');
const {launch, openSite, root} = require('../tests/helpers/perf_browser_harness');
(async()=>{
 const browser=await launch();
 try {
  for(const dark of [false,true]) {
   const {page,errors}=await openSite(browser,{dark,width:734});
   await page.addStyleTag({content:`body{margin:0;background:${dark?'#06345f':'#fff'};font-family:Arial,sans-serif} .nav{display:flex;align-items:center;justify-content:flex-end;list-style:none;margin:10px 16px 0;padding:0;border-bottom:1px solid #7f91aa;min-height:60px} .nav>li>a:not(#fpToolsButton){display:block;padding:20px 7px;font-size:14px;line-height:20px;color:${dark?'#e9edf6':'#555'}}`});
   await page.evaluate(()=>{const nav=document.querySelector('.nav');for(const text of ['Покупки','Продажи','Сообщения','Финансы']){const li=document.createElement('li');li.innerHTML='<a>'+text+'</a>';nav.insertBefore(li,nav.firstElementChild)}document.querySelector('.user-link').textContent='Профиль';document.querySelector('main').style.display='none'});
   const geometry=await page.evaluate(()=>{const b=document.querySelector('#fpToolsButton'),c=getComputedStyle(b),r=b.getBoundingClientRect(),s=document.querySelector('.user-link').getBoundingClientRect();return{width:r.width,height:r.height,center:r.y+r.height/2,neighborCenter:s.y+s.height/2,bg:c.backgroundColor,border:c.borderTopWidth,icon:b.querySelector('img').getBoundingClientRect().width,loaded:b.querySelector('img').naturalWidth,text:b.textContent}});
   assert.equal(geometry.height,60);assert.equal(geometry.icon,22);assert.equal(geometry.center,geometry.neighborCenter);assert.equal(geometry.bg,'rgba(0, 0, 0, 0)');assert.equal(geometry.border,'0px');assert.ok(geometry.loaded);assert.equal(geometry.text,'Funcy');
   await page.screenshot({path:root+'/artifacts/funcy-header-'+(dark?'dark':'light')+'.png',clip:{x:0,y:0,width:734,height:163}});
   await page.locator('#fpToolsButton').hover();
   assert.equal(await page.locator('#fpToolsButton').evaluate(b=>getComputedStyle(b).backgroundColor),'rgba(0, 0, 0, 0)');
   await page.locator('#fpToolsButton').press('Enter');await page.waitForSelector('.fp-tools-popup.active');
   await page.evaluate(()=>document.querySelector('.fp-tools-popup')._fptClose());
   await page.waitForFunction(()=>!document.querySelector('.fp-tools-popup').classList.contains('is-closing'));
   await page.locator('#fpToolsButton').click({button:'right'});assert.equal(await page.locator('#fp-tools-button-styler').isVisible(),true);
   await page.evaluate(()=>applyButtonStyles({size:18,opacity:80}));assert.equal(await page.locator('#fpToolsButton').evaluate(b=>getComputedStyle(b).fontSize),'18px');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#fpToolsButton').evaluate(b=>getComputedStyle(b).transitionDuration),'0s');
   await page.setViewportSize({width:390,height:789});assert.ok(await page.locator('#fpToolsButton').isVisible());
   await page.evaluate(()=>document.querySelector('#fpToolsButton').parentElement.remove());await page.addScriptTag({path:root+'/content/header_button_early.js'});assert.equal(await page.locator('#fpToolsButton').textContent(),'Funcy');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({dark,geometry,checks:'hover, keyboard opening, right-click settings, saved size, reduced motion, narrow viewport, early insertion passed'}));await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
