import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const media=[]; p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media.push(r.url()); });
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(3000);

const list = async (tag) => {
  const b = await p.evaluate(()=>[...document.querySelectorAll('button')].map((x,i)=>
    `${i}:${(x.getAttribute('aria-label')||x.textContent||'').trim().slice(0,28)}${x.disabled?' [DISABLED]':''}`));
  console.log(tag, JSON.stringify(b,null,0).slice(0,400));
};
console.log('=== BUTTONS BEFORE ==='); await list('');
await p.locator('[aria-label^="Play "]').first().click();
await p.waitForTimeout(1500);
console.log('\n=== BUTTONS AFTER SELECTING A CARD ==='); await list('');
await b.close();
