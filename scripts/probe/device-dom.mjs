// Inspect the APK's WebView over the Chrome DevTools Protocol, so we read
// the real DOM the phone is rendering rather than guessing from pixels.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
const ADB='D:/Android/Sdk/platform-tools/adb.exe';
const sh=(...a)=>execFileSync(ADB,a,{encoding:'utf8'});

// Forward the WebView's devtools socket to a local port.
const sock=sh('shell','cat','/proc/net/unix').split('\n')
  .map(l=>l.match(/@?(webview_devtools_remote_\d+)/)).filter(Boolean)[0]?.[1];
if(!sock){ console.log('no webview devtools socket — is the app running?'); process.exit(1); }
console.log('socket:', sock);
try{ sh('forward','tcp:9333','localabstract:'+sock); }catch(e){ console.log('forward failed'); }

const b=await chromium.connectOverCDP('http://localhost:9333');
const ctx=b.contexts()[0];
const p=ctx.pages()[0];
console.log('url:', p.url());

const nav=async (label)=>{
  const el=p.locator(`text=${label}`).first();
  if(await el.count()){ await el.click(); await p.waitForTimeout(5500); }
};
for(const tab of ['DECK','PACKS','CHART','YOU','SOCIAL']){
  await nav(tab);
  const t=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
  const sw=await p.evaluate(()=>({w:document.documentElement.scrollWidth, vw:window.innerWidth}));
  console.log(`\n=== ${tab} ===`);
  console.log('overflow-x:', sw.w>sw.vw ? `YES (${sw.w} > ${sw.vw})  <-- MISALIGNED` : 'no');
  console.log(t.slice(0,260));
}
await b.close();
