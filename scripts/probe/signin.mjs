import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[], logs=[];
p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{ if(m.type()==='error') logs.push(m.text().slice(0,160)); });
await p.goto('http://localhost:3100/signin',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(4000);
const d = await p.evaluate(()=>({
  bodyChars:(document.body.innerText||'').length,
  html: document.body.innerHTML.length,
  main: (document.querySelector('main')?.innerHTML||'').slice(0,200),
  rootKids: document.body.children.length,
}));
console.log('body text chars :', d.bodyChars);
console.log('body html length:', d.html);
console.log('body children   :', d.rootKids);
console.log('main snippet    :', d.main || '(empty)');
console.log('\npage errors :', errs.length?errs:'none');
console.log('console errs:', logs.length?logs:'none');
await b.close();
