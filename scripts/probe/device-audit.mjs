// Drives the phone by UI text via uiautomator, not guessed pixel taps.
import { execFileSync } from 'child_process';
const ADB='D:/Android/Sdk/platform-tools/adb.exe';
const sh=(...a)=>execFileSync(ADB,a,{encoding:'utf8',maxBuffer:64*1024*1024});
const dump=()=>{ sh('shell','uiautomator','dump','/sdcard/u.xml');
  return sh('shell','cat','/sdcard/u.xml'); };

function tapText(label){
  const xml=dump();
  const re=new RegExp(`text="${label}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"`);
  const m=re.exec(xml);
  if(!m){ console.log(`  ! "${label}" not found`); return false; }
  const x=Math.round((+m[1]+ +m[3])/2), y=Math.round((+m[2]+ +m[4])/2);
  sh('shell','input','tap',String(x),String(y));
  return true;
}
const texts=()=>[...dump().matchAll(/text="([^"]{2,60})"/g)].map(m=>m[1]).filter(t=>t.trim());

for (const tab of ['DECK','PACKS','CHART','YOU']) {
  console.log(`\n=== ${tab} ===`);
  if(!tapText(tab)) continue;
  await new Promise(r=>setTimeout(r,6000));
  const t=texts();
  console.log(t.slice(0,22).join(' | ').slice(0,300));
}
