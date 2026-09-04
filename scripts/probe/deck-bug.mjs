import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
const ADB='D:/Android/Sdk/platform-tools/adb.exe';
const sh=(...a)=>execFileSync(ADB,a,{encoding:'utf8'});
const sock=sh('shell','cat','/proc/net/unix').split('\n')
  .map(l=>l.match(/@?(webview_devtools_remote_\d+)/)).filter(Boolean)[0]?.[1];
try{ sh('forward','tcp:9333','localabstract:'+sock); }catch{}
const b=await chromium.connectOverCDP('http://localhost:9333');
const p=b.contexts()[0].pages()[0];
await p.goto('https://localhost/deck',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(9000);
const t=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('deck text:', t.slice(0,300));
console.log('\nbuttons:', await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,30)).filter(Boolean).slice(0,10)));
await b.close();
