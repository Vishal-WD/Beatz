import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
const ADB='D:/Android/Sdk/platform-tools/adb.exe';
const sh=(...a)=>execFileSync(ADB,a,{encoding:'utf8'});
const sock=sh('shell','cat','/proc/net/unix').split('\n')
  .map(l=>l.match(/@?(webview_devtools_remote_\d+)/)).filter(Boolean)[0]?.[1];
try{ sh('forward','tcp:9333','localabstract:'+sock); }catch{}
const b=await chromium.connectOverCDP('http://localhost:9333');
const p=b.contexts()[0].pages()[0];

const go=async(path)=>{ await p.goto('https://localhost'+path,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000); };

console.log('=== DECK: does a song play, is the room live? ===');
let media=0; p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media++; });
await go('/deck');
const hand=p.locator('button[aria-label^="Play "]');
console.log('cards in hand:', await hand.count());
if(await hand.count()){
  await hand.last().click(); await p.waitForTimeout(2500);
  const play=p.locator('button[aria-label^="Play "]').first();
  console.log('play disabled?', await play.isDisabled());
  if(!(await play.isDisabled())){ await play.click(); await p.waitForTimeout(7000); }
}
const t=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('status   :', /(PLAYING|BUFFERING|UNAVAILABLE|PREVIEW · 30s)/.exec(t)?.[1]??'none');
console.log('room mode:', /(LIVE ROOM|SOLO PRACTICE)/.exec(t)?.[1]??'?');
console.log('media    :', media);

console.log('\n=== LAYOUT: overflow + tiny text + tap targets ===');
for(const path of ['/','/deck','/packs','/chart','/profile','/events','/social']){
  await go(path);
  const r=await p.evaluate(()=>{
    const de=document.documentElement;
    const over=[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).length;
    const small=[...document.querySelectorAll('button,a')].filter(e=>{const b=e.getBoundingClientRect();
      return b.width>0 && (b.height<32||b.width<32);}).length;
    const clipped=[...document.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+2 &&
      getComputedStyle(e).overflowX==='hidden').length;
    return {hs:de.scrollWidth>window.innerWidth, over, small, clipped};
  });
  console.log(`${path.padEnd(10)} hscroll:${r.hs?'YES':'no '} offscreen:${String(r.over).padStart(3)} smallTap:${String(r.small).padStart(2)} clipped:${r.clipped}`);
}
await b.close();
