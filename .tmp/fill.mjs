// Look up an Apple 30s preview for the 10 hand-curated cards that have none.
const want = [
  ['Arabic Kuthu - Halamithi Habibo','Anirudh Ravichander'],
  ['As It Was','Harry Styles'],
  ['Badtameez Dil','Benny Dayal'],
  ['Blinding Lights','The Weeknd'],
  ['Chaleya','Arijit Singh'],
  ['Malhari','Vishal Dadlani'],
  ['Naa Ready','Anirudh Ravichander'],
  ['Naatu Naatu','Rahul Sipligunj'],
  ['Vaathi Coming','Anirudh Ravichander'],
  ['Why This Kolaveri Di? (from "3") (The Soup of Love)','Anirudh Ravichander'],
];
const clean = t => t.replace(/\s*[-(].*$/,'').trim();
const out=[];
for (const [title,artist] of want){
  const term=encodeURIComponent(`${clean(title)} ${artist}`);
  try{
    const r=await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=5`);
    const j=await r.json();
    const hit=(j.results||[]).find(x=>x.previewUrl);
    console.log(JSON.stringify({title, ok:!!hit, preview:hit?hit.previewUrl:null,
                                got:hit?`${hit.trackName} — ${hit.artistName}`:null}));
    if(hit) out.push({title, preview:hit.previewUrl});
  }catch(e){ console.log(JSON.stringify({title, ok:false, err:e.message})); }
  await new Promise(r=>setTimeout(r,350));
}
require('fs').writeFileSync('.tmp/fill.json',JSON.stringify(out,null,1));
