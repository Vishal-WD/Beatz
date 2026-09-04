// The genuine data path: rooms.format was written in the DATABASE, with no
// response interception. This proves the real read path carries the format
// through to the screen — the gap the task reviewer flagged.
import { chromium } from 'playwright';
const B='http://localhost:3100';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));

await p.goto(B+'/deck',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(9000);
const t = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));

const has = (re) => re.test(t);
console.log('=== basement-4am restored to format=disco (CONTESTED) ===');
console.log('dethrone/throne wording  :', has(/THRONE|DETHRON|LOSE THE/i) ? 'PRESENT — BUG' : 'absent (correct)');
console.log('collapse wording         :', has(/COLLAPS/i) ? 'PRESENT — BUG' : 'absent (correct)');
console.log('challenger line          :', has(/CHALLENGER|IN LINE/i) ? 'PRESENT — BUG' : 'absent (correct)');
console.log('applause / vibe retained :', has(/APPLAUSE|VIBE/i) ? 'yes (correct)' : 'MISSING');
console.log('performer framing        :', has(/PERFORM|FOLLOW/i) ? 'yes' : 'not found');
console.log('js errors                :', errs.length ? errs.slice(0,2) : 'none');
console.log('\nfirst 220 chars:', t.slice(0,220));
await b.close();
