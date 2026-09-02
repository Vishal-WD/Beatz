import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
// Capture the actual Supabase response the browser gets.
let payload = null;
p.on('response', async r => {
  if (/\/rest\/v1\/cards/.test(r.url()) && r.status()===200) {
    try { const j = await r.json(); if (Array.isArray(j) && j.length) payload = j; } catch {}
  }
});
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(4000);

console.log('=== WHAT THE BROWSER ACTUALLY RECEIVES ===\n');
if (!payload) { console.log('no /rest/v1/cards response captured'); }
else {
  console.log('rows received:', payload.length);
  const k = Object.keys(payload[0]);
  console.log('preview_url in response keys?', k.includes('preview_url'));
  const withP = payload.filter(r=>r.preview_url).length;
  console.log('rows with a preview_url:', withP, '/', payload.length);
  const s = payload.find(r=>r.preview_url);
  console.log('sample preview_url:', s ? s.preview_url.slice(0,55)+'…' : 'NONE');
  console.log('sample title      :', s ? s.title : '-');
}
// And what the component sees after mapping
const seen = await p.evaluate(() => {
  const el=[...document.querySelectorAll('*')].find(n=>/PREVIEW · 30s|NO PLAYBACK SOURCE/.test(n.textContent||''));
  return el ? el.textContent.trim().slice(0,40) : 'no status label';
});
console.log('\nstatus label on screen:', seen);
await b.close();
