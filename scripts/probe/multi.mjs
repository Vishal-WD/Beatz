import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
let media=0; p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media++; });
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(3000);
console.log('=== PLAY SEVERAL DIFFERENT CARDS ===\n');
for (let i=0;i<3;i++){
  const before=media;
  const hand = p.locator('button[aria-label^="Play "]');
  const n = await hand.count();
  await hand.nth(n-1-i).click();          // pick a different hand card each time
  await p.waitForTimeout(1200);
  const play = p.locator('button[aria-label^="Play "]').first();
  if (await play.isDisabled()) { console.log(`card ${i+1}: BUTTON DISABLED`); continue; }
  await play.click();
  await p.waitForTimeout(4000);
  const s = await p.evaluate(()=>{
    const t=[...document.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent.trim());
    return { label:t.find(x=>/PLAYING|BUFFERING|UNAVAILABLE|PREVIEW|ENDED/.test(x))||'?',
             title:t.find(x=>x.length>2&&x===x.toUpperCase()&&/[A-Z]{3}/.test(x))||'?' };
  });
  console.log(`card ${i+1}: ${s.label.padEnd(12)} media +${media-before}`);
  // return to hand for the next round
  const ret=p.locator('button', {hasText:'RETURN TO HAND'});
  if (await ret.count()) await ret.first().click();
  await p.waitForTimeout(700);
}
console.log('\ntotal media requests:', media);
await b.close();
