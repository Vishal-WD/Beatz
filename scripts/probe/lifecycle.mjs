import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const email=`player.${Date.now()}@gmail.com`, pass='AuxWars!2026';

const auth=[];
p.on('response', async r=>{ const u=r.url();
  if(/\/auth\/v1\/(signup|token)/.test(u)){
    let has=false; try{ const j=await r.json(); has=!!j.access_token; }catch{}
    auth.push(`${r.status()} ${u.split('/auth/v1/')[1].split('?')[0]} session=${has}`); }});

console.log('=== 1. REGISTER ===  ', email);
await p.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p.waitForSelector('input',{timeout:25000});
await p.locator('button',{hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForTimeout(600);
const i=p.locator('input');
await i.nth(0).fill('Test Player'); await i.nth(1).fill(email); await i.nth(2).fill(pass);
await p.locator('form button').last().click();
await p.waitForTimeout(7000);
console.log('auth calls:', auth);
const msg = await p.evaluate(()=>{const t=[...document.querySelectorAll('*')].filter(n=>!n.children.length)
  .map(n=>n.textContent.trim()); return t.find(x=>/confirm|invalid|already/i.test(x)&&x.length<90)||'(no message)';});
console.log('message   :', msg);
console.log('url now   :', new URL(p.url()).pathname);
const tok = await p.evaluate(()=>Object.values(localStorage).some(v=>/access_token/.test(v||'')));
console.log('session stored:', tok);

if (tok){
  console.log('\n=== 2. NEW TAB KEEPS SESSION ===');
  const p2=await ctx.newPage();
  await p2.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
  await p2.waitForTimeout(4000);
  const so = await p2.locator('button',{hasText:/SIGN OUT/i}).count();
  console.log('shows signed-in:', so>0);
  console.log('text:', (await p2.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,110));
  if(so){
    console.log('\n=== 3. SIGN OUT ===');
    await p2.locator('button',{hasText:/SIGN OUT/i}).first().click();
    await p2.waitForTimeout(3000);
    console.log('token cleared:', !(await p2.evaluate(()=>Object.values(localStorage).some(v=>/access_token/.test(v||'')))));
    console.log('text:', (await p2.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,90));
  }
}
console.log('\nACCOUNT:', email);
await b.close();
