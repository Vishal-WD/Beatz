import { chromium } from 'playwright';
const b = await chromium.launch();               // NO autoplay override — real conditions
const p = await b.newPage({ viewport:{width:390,height:844} });
const logs=[]; p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,110)));
p.on('pageerror',e=>logs.push('PAGEERROR: '+e.message.slice(0,110)));

await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(2500);

// Instrument Audio BEFORE interacting so we see construction + play() outcome.
await p.evaluate(() => {
  window.__audioLog = [];
  const OrigAudio = window.Audio;
  window.Audio = function(...a){
    const el = new OrigAudio(...a);
    window.__audioLog.push('constructed');
    const origPlay = el.play.bind(el);
    el.play = () => origPlay().then(
      () => { window.__audioLog.push('play() RESOLVED'); },
      (e) => { window.__audioLog.push('play() REJECTED: '+e.name+' '+e.message.slice(0,60)); }
    );
    el.addEventListener('error', () => window.__audioLog.push('media error code='+(el.error&&el.error.code)));
    el.addEventListener('canplay', () => window.__audioLog.push('canplay'));
    window.__lastAudio = el;
    return el;
  };
});

console.log('=== REAL CLICK PATH ===\n');
const card = p.locator('[aria-label^="Play "]').first();
await card.click();
await p.waitForTimeout(2000);
console.log('after selecting a card:', await p.evaluate(()=>window.__audioLog));
console.log('card has previewUrl?  ', await p.evaluate(()=>{
  const el=[...document.querySelectorAll('*')].find(n=>/PREVIEW · 30s|NO PLAYBACK/.test(n.textContent||''));
  return el ? el.textContent.trim().slice(0,40) : 'no status label found';
}));

const btn = p.locator('[aria-label^="Play "], [aria-label^="Pause "]').last();
await btn.click();
await p.waitForTimeout(4000);
console.log('\nafter pressing play:', await p.evaluate(()=>window.__audioLog));
console.log('audio state        :', await p.evaluate(()=>{
  const a=window.__lastAudio; return a?{paused:a.paused,t:+a.currentTime.toFixed(2),dur:+(a.duration||0).toFixed(1),src:a.src.slice(0,45)}:null;
}));
console.log('\nconsole:', logs.length?logs.slice(0,5):'clean');
await b.close();
