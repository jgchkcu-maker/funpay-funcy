const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.FPT_PLAYWRIGHT||'C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root = process.env.FPT_PROBE_WORKDIR || path.join(require('node:os').tmpdir(),'funcy-cardinal-portability-probe');
async function run() {
  const dir = path.join(root,'probe-extension');
  await fs.mkdir(dir,{recursive:true});
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({cookie:req.headers.cookie||null,origin:req.headers.origin||null,userAgent:req.headers['user-agent']||null}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({manifest_version:3,name:'Isolated portability probe',version:'1.0',permissions:['storage','alarms','cookies','offscreen','declarativeNetRequest'],host_permissions:['http://127.0.0.1/*'],background:{service_worker:'worker.js'}}));
  await fs.writeFile(path.join(dir,'probe.html'),'<!doctype html><meta charset="utf-8"><title>Isolated research probe</title>');
  await fs.writeFile(path.join(dir,'worker.js'),`globalThis.probeInstanceId=crypto.randomUUID();chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m==='checkpoint'){chrome.storage.local.get('checkpoint').then(saved=>reply({...saved,instanceId:globalThis.probeInstanceId}));return true;}});`);
  let ctx;
  const result={date:'2026-11-03',scope:'separate blank profile and synthetic MV3; loopback HTTP only'};
  try {
    ctx=await chromium.launchPersistentContext(path.join(root,'probe-profile-cft-'+Date.now()),{executablePath:process.env.FPT_PROBE_CHROME || chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${dir}`,`--load-extension=${dir}`]});
    let w=ctx.serviceWorkers()[0];
    if(!w)w=await ctx.waitForEvent('serviceworker',{timeout:12000});
    result.workerUrl=w.url();result.browserVersion=ctx.browser().version();
    result.runtime=await w.evaluate(async(port)=>{
      const echo=await (await fetch('http://127.0.0.1:'+port+'/',{headers:{Cookie:'synthetic=manual'},credentials:'omit'})).json();
      const cookieEcho=await (async()=>{await chrome.cookies.set({url:'http://127.0.0.1:'+port,name:'synthetic',value:'jar'});return(await fetch('http://127.0.0.1:'+port+'/',{credentials:'include'})).json();})();
      const secret=new TextEncoder().encode('12345678901234567890');
      const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-1'},false,['sign']);
      const counter=new Uint8Array(8);new DataView(counter.buffer).setUint32(4,1);
      const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter));const off=digest[19]&15;
      const code=((digest[off]&127)*0x1000000+(digest[off+1]<<16)+(digest[off+2]<<8)+digest[off+3])%100000000;
      let steamInt=(digest[off]&127)*0x1000000+(digest[off+1]<<16)+(digest[off+2]<<8)+digest[off+3];
      const alphabet='23456789BCDFGHJKMNPQRTVWXY';let steamCode='';for(let n=0;n<5;n++){steamCode+=alphabet[steamInt%alphabet.length];steamInt=Math.floor(steamInt/alphabet.length);}
      await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:[1],addRules:[{id:1,priority:1,action:{type:'modifyHeaders',requestHeaders:[{header:'User-Agent',operation:'set',value:'CardinalPortabilityProbe/1.0'}]},condition:{urlFilter:'http://127.0.0.1:'+port+'/',initiatorDomains:[chrome.runtime.id],resourceTypes:['xmlhttprequest']}}]});
      const uaEcho=await (await fetch('http://127.0.0.1:'+port+'/ua')).json();
      await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:[1]});
      const checkpoint={phase:'waiting',providerOrder:'synthetic-123',updatedAt:Date.now()};await chrome.storage.local.set({checkpoint});
      await chrome.alarms.create('probe',{when:Date.now()+30000});
      return {instanceId:globalThis.probeInstanceId,sockets:typeof chrome.sockets,process:typeof process,require:typeof require,subtle:typeof crypto.subtle,offscreen:typeof chrome.offscreen?.createDocument,crossOriginFetchWithoutACAO:!!echo,manualCookieHeader:echo.cookie,cookieJar:cookieEcho.cookie,rfc6238at59:String(code).padStart(8,'0'),steamCodeAt59:steamCode,dnrUserAgent:uaEcho.userAgent,alarm:await chrome.alarms.get('probe'),checkpoint:await chrome.storage.local.get('checkpoint')};
    },port);
    const browser=ctx.browser();const cdp=await browser.newBrowserCDPSession();
    const targets=await cdp.send('Target.getTargets');const target=targets.targetInfos.find(t=>t.type==='service_worker'&&t.url===w.url());
    const page=await ctx.newPage();await page.goto(w.url().replace(/worker\.js$/,'probe.html'));
    const swcdp=await ctx.newCDPSession(page);const versions=[];
    swcdp.on('ServiceWorker.workerVersionUpdated',event=>versions.push(...event.versions));
    await swcdp.send('ServiceWorker.enable');
    for(let n=0;n<20&&!versions.some(v=>v.scriptURL===w.url());n++)await new Promise(r=>setTimeout(r,50));
    const version=versions.findLast(v=>v.scriptURL===w.url()&&v.runningStatus==='running');
    result.serviceWorkerVersion=version||versions;
    if(!version)throw new Error('No running extension ServiceWorker version was reported');
    await swcdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
    for(let n=0;n<40&&!versions.some(v=>v.versionId===version.versionId&&v.runningStatus==='stopped');n++)await new Promise(r=>setTimeout(r,50));
    result.workerObservedStopped=versions.some(v=>v.versionId===version.versionId&&v.runningStatus==='stopped');
    result.afterWorkerRestart=await page.evaluate(()=>chrome.runtime.sendMessage('checkpoint'));
    const after=await cdp.send('Target.getTargets');const restarted=after.targetInfos.find(t=>t.type==='service_worker'&&t.url===w.url());result.workerTargetBefore=target?.targetId;result.workerTargetAfter=restarted?.targetId;result.workerRestarted=result.workerObservedStopped&&result.runtime.instanceId!==result.afterWorkerRestart?.instanceId;
    result.pass=result.runtime.rfc6238at59==='94287082'&&result.runtime.steamCodeAt59==='PV9M4'&&result.runtime.manualCookieHeader===null&&result.runtime.cookieJar==='synthetic=jar'&&result.runtime.sockets==='undefined'&&result.afterWorkerRestart?.checkpoint?.providerOrder==='synthetic-123'&&result.workerRestarted&&result.workerObservedStopped&&result.runtime.dnrUserAgent==='CardinalPortabilityProbe/1.0';
  } catch(e) { result.error=String(e.message||e); result.pass=false; }
  finally {if(ctx)await ctx.close();await new Promise(resolve=>server.close(resolve));}
  await fs.writeFile(path.join(root,'probe-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
