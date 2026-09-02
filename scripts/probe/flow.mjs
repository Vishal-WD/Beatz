import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile' });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));

const routes = ['/','/deck','/room','/chart','/packs','/events','/social','/signin','/profile'];
console.log('=== ROUTE HEALTH (mobile viewport) ===\n');
for (const r of routes) {
  try {
    const res = await p.goto('http://localhost:3000'+r,{waitUntil:'domcontentloaded',timeout:20000});
    await p.waitForTimeout(900);
    const d = await p.evaluate(()=>{
      const nav=[...document.querySelectorAll('a[href],nav')].filter(n=>/deck|room|chart|packs|events|social|profile/i.test(n.getAttribute?.('href')||''));
      const btns=document.querySelectorAll('button').length;
      const txt=(document.body.innerText||'').trim();
      return { navLinks:new Set(nav.map(n=>n.getAttribute('href'))).size, btns, chars:txt.length,
               scrollW:document.documentElement.scrollWidth, blank:txt.length<40 };
    });
    console.log(`${r.padEnd(10)} ${res.status()}  nav:${String(d.navLinks).padStart(2)}  btns:${String(d.btns).padStart(2)}  text:${String(d.chars).padStart(5)}  hscroll:${d.scrollW>390?'YES ⚠':'no'}  ${d.blank?'⚠ BLANK':''}`);
  } catch(e){ console.log(`${r.padEnd(10)} FAILED ${e.message.slice(0,50)}`); }
}
console.log('\njs errors:', errs.length? errs.slice(0,4):'none');
await b.close();
