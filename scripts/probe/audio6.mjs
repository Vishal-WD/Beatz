import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
// Capture every Audio construction and what src it ends up with.
await p.addInitScript(() => {
  window.__log = [];
  const O = window.Audio;
  window.Audio = function(...a){
    const el = new O(...a);
    window.__all = window.__all || []; window.__all.push(el);
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
    Object.defineProperty(el,'src',{ get(){return d.get.call(el);}, set(v){ window.__log.push('src set -> '+String(v).slice(0,50)); d.set.call(el,v); }, configurable:true });
    return el;
  };
});
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(3000);
await p.locator('[aria-label^="Play "]').first().click();
await p.waitForTimeout(2500);

console.log('=== AUDIO ELEMENT SRC TRACE ===\n');
console.log('src assignments:', await p.evaluate(()=>window.__log));
console.log('elements made  :', await p.evaluate(()=>(window.__all||[]).length));
console.log('final srcs     :', await p.evaluate(()=>(window.__all||[]).map(a=>a.src.slice(0,55))));
await b.close();
