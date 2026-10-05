"use strict";
/* ================= SEARCH ================= */
const IDX=[];
function addIdx(label,sub,sel,keys,rank){IDX.push({label,sub,sel,keys:keys.map(k=>k.toLowerCase().replace(/[\s\-'’.]/g,'')),rank})}
function buildIndex(){
  for(const p of PLANETS)addIdx(p.name,p.key==='Sun'?'Our star':p.key==='Moon'?'Earth’s Moon':'Planet',{kind:'planet',ref:p},[p.name,p.key==='Moon'?'chandra':p.key==='Sun'?'surya':'',({Mercury:'budha',Venus:'shukra',Mars:'mangal',Jupiter:'guru brihaspati',Saturn:'shani'}[p.key]||'')].filter(Boolean),-30);
  for(const g of GALILEAN)addIdx(g.name,'Moon of Jupiter',{kind:'gal',ref:g},[g.name],-5);
  for(const [i,n] of named){const con=CONS[sCon[i]];const keys=[];if(n.proper)keys.push(n.proper);if(n.bayer&&con){const [g,num]=n.bayer.split('-');keys.push((GREEKW[g]||g)+(num||'')+con[2],bayerStr(n.bayer)+con[0].slice(0,3),(GREEKW[g]||g)+(num||'')+con[0].slice(0,3))}
    if(n.flam&&con)keys.push(n.flam+con[0].slice(0,3),n.flam+con[2]);if(n.hd)keys.push('hd'+n.hd);if(n.gl)keys.push(n.gl);if(n.vr&&con)keys.push(n.vr+con[0].slice(0,3));if(n.proper&&INDIAN[n.proper])keys.push(INDIAN[n.proper]);
    if(!keys.length)continue;const label=n.proper||(n.bayer?bayerStr(n.bayer)+' '+(con?con[2]:''):n.flam?n.flam+' '+(con?con[2]:''):n.gl||n.vr);
    addIdx(label,'Star · mag '+sMag[i].toFixed(1)+(con?' · '+con[1]:''),{kind:'star',ref:i},keys,sMag[i])}
  for(const o of DSO){const keys=[o.id];if(o.M)keys.push('m'+o.M,'messier'+o.M);o.common.forEach(c=>keys.push(c));if(o.ngcx)o.ngcx.split(',').forEach(s=>keys.push('ngc'+(+s)));if(o.icx)o.icx.split(',').forEach(s=>keys.push('ic'+(+s)));
    addIdx(o.common[0]||(o.M?'M'+o.M:o.id),(o.M&&o.common[0]?'M'+o.M+' · ':'')+(DSOTYPE[o.type]||o.type)+(o.mag!=null?' · mag '+o.mag.toFixed(1):''),{kind:'dso',ref:o},keys,(o.mag??12)-(o.M?4:0))}
  CONLAB.forEach((c,i)=>addIdx(c.name,'Constellation',{kind:'con',ref:c},[c.name,CONS[i][0].slice(0,3),CONS[i][2]],-2));
}
function hipLookup(q){const m=q.match(/^hip\s*(\d+)$/i);if(!m)return null;const h=+m[1];for(let i=0;i<N;i++)if(sHip[i]===h)return i;return -1}
let resSel=0,resList=[];
function doSearch(){
  const q=$('search').value.trim();const box=$('results');if(!q){box.style.display='none';resList=[];return}
  const qq=q.toLowerCase().replace(/[\s\-'’.]/g,'').replace(/^messier/,'m');
  const out=[];
  const hi=hipLookup(q);if(hi!=null&&hi>=0)out.push({label:'HIP '+sHip[hi],sub:'Star · mag '+sMag[hi].toFixed(1),sel:{kind:'star',ref:hi},score:-100});
  for(const e of IDX){let best=99;for(const k of e.keys){if(k===qq){best=0;break}if(k.startsWith(qq))best=Math.min(best,1);else if(qq.length>2&&k.includes(qq))best=Math.min(best,2)}if(best<99)out.push(Object.assign({score:best*100+e.rank},e))}
  out.sort((a,b)=>a.score-b.score);resList=out.slice(0,9);resSel=0;
  if(!resList.length){box.innerHTML='<button disabled><span class="r1">Nothing by that name in the catalogue</span><span class="r2">Try “M42”, “Vega” or “HIP 27989”</span></button>';box.style.display='block';return}
  box.innerHTML=resList.map((r,k)=>`<button data-k="${k}" class="${k===0?'on':''}"><span class="r1">${escapeHtml(r.label)}</span><span class="r2">${escapeHtml(r.sub)}</span></button>`).join('');box.style.display='block';
  box.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>pickResult(+b.dataset.k));
}
function pickResult(k){const r=resList[k];if(!r)return;$('results').style.display='none';$('search').value='';$('search').blur();flyTo(r.sel,null);showInfo(r.sel)}
$('search').addEventListener('input',doSearch);
$('search').addEventListener('keydown',e=>{const bs=$('results').querySelectorAll('button[data-k]');if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();resSel=clamp(resSel+(e.key==='ArrowDown'?1:-1),0,bs.length-1);bs.forEach((b,k)=>b.classList.toggle('on',k===resSel))}else if(e.key==='Enter'){pickResult(resSel)}else if(e.key==='Escape'){$('results').style.display='none';$('search').blur()}});
document.addEventListener('pointerdown',e=>{if(!$('searchWrap').contains(e.target))$('results').style.display='none'});

