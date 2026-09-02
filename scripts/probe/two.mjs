import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
for (const r of ['/room','/packs']) {
  await p.goto('http://localhost:3000'+r,{waitUntil:'networkidle',timeout:25000});
  await p.waitForTimeout(1500);
  const d = await p.evaluate(()=>({
    text:(document.body.innerText||'').trim().replace(/\n+/g,' | ').slice(0,300),
    hasShell: !!document.querySelector('nav'),
  }));
  console.log(`\n=== ${r} ===`);
  console.log('nav element:', d.hasShell);
  console.log('content:', d.text);
}
await b.close();
