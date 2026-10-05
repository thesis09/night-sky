"use strict";
/* ================= TONIGHT PLANNER ================= */
const PL={nightOffset:0,equip:store.get('pl.equip','bin'),pins:store.get('pl.pins',[]),cache:null,best:null,bestKey:''};
const PIN_COLORS=['#7fd6cf','#e59ac4','#9fc6ff','#bfe3b4','#f0a77a','#c7b3ff'];
function selKey(sel){if(!sel)return'';if(sel.kind==='star')return'star:'+sel.ref;if(sel.kind==='dso')return'dso:'+sel.ref.id;if(sel.kind==='planet')return'planet:'+sel.ref.key;return''}
function selFromKey(k){const [t,v]=[k.slice(0,k.indexOf(':')),k.slice(k.indexOf(':')+1)];if(t==='star')return{kind:'star',ref:+v};if(t==='dso'){const o=DSO.find(d=>d.id===v);return o?{kind:'dso',ref:o}:null}if(t==='planet'){const p=PLANETS.find(p=>p.key===v);return p?{kind:'planet',ref:p}:null}return null}
function pinSel(sel){const k=selKey(sel);if(!k||PL.pins.includes(k))return;PL.pins.push(k);if(PL.pins.length>6)PL.pins.shift();store.set('pl.pins',PL.pins);PL.cache=null;refreshTab('tonight')}
function unpin(k){PL.pins=PL.pins.filter(x=>x!==k);store.set('pl.pins',PL.pins);refreshTab('tonight')}
function localNoonUTC(ms){const off=tzOffsetMin(ms)*60000;const d=new Date(ms+off);let y=d.getUTCFullYear(),m=d.getUTCMonth(),day=d.getUTCDate();if(d.getUTCHours()<12){const p=new Date(Date.UTC(y,m,day)-864e5);y=p.getUTCFullYear();m=p.getUTCMonth();day=p.getUTCDate()}return Date.UTC(y,m,day,12)-off}
function nightInfo(){
  const noon=localNoonUTC(S.simMs)+PL.nightOffset*864e5;const key=noon+'|'+S.obs.lat+'|'+S.obs.lon;
  if(PL.cache&&PL.cache.key===key)return PL.cache;
  const t0=A.MakeTime(new Date(noon));const ms=x=>x?+x.date:null;
  const sr=(dir,start)=>{try{return ms(A.SearchRiseSet(A.Body.Sun,obsA,dir,start,1.2))}catch(e){return null}};
  const sa=(dir,start,alt)=>{try{return ms(A.SearchAltitude(A.Body.Sun,obsA,dir,start,1.2,alt))}catch(e){return null}};
  const sunset=sr(-1,t0);const after=sunset?A.MakeTime(new Date(sunset)):t0;
  const N={key,noon,sunset,sunrise:sr(+1,after),civilDusk:sa(-1,t0,-6),nautDusk:sa(-1,t0,-12),astroDusk:sa(-1,t0,-18)};
  N.astroDawn=sa(+1,N.astroDusk?A.MakeTime(new Date(N.astroDusk)):after,-18);N.nautDawn=sa(+1,N.nautDusk?A.MakeTime(new Date(N.nautDusk)):after,-12);N.civilDawn=sa(+1,N.civilDusk?A.MakeTime(new Date(N.civilDusk)):after,-6);
  N.start=(N.sunset||noon+5*36e5)-36e5;N.end=(N.sunrise||noon+19*36e5)+36e5;
  // samples every 5 minutes: rotation matrices, Sun and Moon altitudes
  N.t=[];N.R=[];N.sun=[];N.moon=[];N.moonV=[];
  for(let ms2=N.start;ms2<=N.end;ms2+=5*60000){const t=A.MakeTime(new Date(ms2));const R=new Float64Array(9);setRot(R,A.Rotation_EQJ_HOR(t,obsA).rot);N.t.push(ms2);N.R.push(R);
    const se=eqToVec(A.Equator(A.Body.Sun,t,obsA,false,true));N.sun.push(Math.asin(R[6]*se[0]+R[7]*se[1]+R[8]*se[2])*RAD);
    const me=eqToVec(A.Equator(A.Body.Moon,t,obsA,false,true));N.moonV.push(me);N.moon.push(Math.asin(R[6]*me[0]+R[7]*me[1]+R[8]*me[2])*RAD)}
  try{N.moonFrac=A.Illumination(A.Body.Moon,A.MakeTime(new Date((N.start+N.end)/2))).phase_fraction}catch(e){N.moonFrac=0}
  N.dark=N.t.map((_,i)=>N.sun[i]<-18);if(!N.dark.some(Boolean))N.dark=N.t.map((_,i)=>N.sun[i]<-12);
  let darkMin=0,freeMin=0;N.t.forEach((_,i)=>{if(N.dark[i]){darkMin+=5;if(N.moon[i]<0)freeMin+=5}});N.darkMin=darkMin;N.moonFreeMin=freeMin;
  PL.cache=N;return N;
}
function altSeries(N,sel){
  if(sel.kind==='planet'){return N.t.map((ms,i)=>{const t=A.MakeTime(new Date(ms));const v=eqToVec(A.Equator(sel.ref.body,t,obsA,false,true));const R=N.R[i];return Math.asin(R[6]*v[0]+R[7]*v[1]+R[8]*v[2])*RAD})}
  const v=selVec(sel);if(!v)return null;return N.R.map(R=>Math.asin(clamp(R[6]*v[0]+R[7]*v[1]+R[8]*v[2],-1,1))*RAD);
}
function fmtDur(min){const h=Math.floor(min/60),m=Math.round(min%60);return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min`}
function renderTonight(el){
  const N=nightInfo();const ft=ms=>ms?fmtT(ms)+(fmtDay(ms)==='today'?'':' '+fmtDay(ms)):'—';
  const nightDate=new Date(N.noon+tzOffsetMin(N.noon)*60000);const dl=nightDate.toUTCString().slice(0,16);
  el.innerHTML=`<div class="row2" style="justify-content:space-between;flex-wrap:nowrap"><button class="btn" id="plPrev" title="Previous night" aria-label="Previous night">‹</button><b style="font-weight:500;text-align:center">Night of ${dl}</b><button class="btn" id="plNext" title="Next night" aria-label="Next night">›</button></div>
  ${PL.nightOffset?'<div class="row2"><button class="btn" id="plTonight">Back to tonight</button></div>':''}
  <dl class="kv" style="margin-top:8px"><dt>Sunset</dt><dd>${ft(N.sunset)}</dd><dt>Dark from (astronomical dusk)</dt><dd>${ft(N.astroDusk)}</dd><dt>Dark until (astronomical dawn)</dt><dd>${ft(N.astroDawn)}</dd><dt>Sunrise</dt><dd>${ft(N.sunrise)}</dd>
  <dt>Full darkness</dt><dd>${fmtDur(N.darkMin)}</dd><dt>Moon</dt><dd>${Math.round(N.moonFrac*100)}% lit · ${fmtDur(N.moonFreeMin)} of darkness without the Moon</dd></dl>
  <h4>Altitude through the night</h4>
  <canvas class="chart" id="plChart" height="230"></canvas>
  <div class="muted" id="plRead" style="min-height:2.6em;margin-top:4px">Hover to read altitudes; click to jump to that time.</div>
  <div class="pins" id="plPins"></div>
  <div class="row2"><button class="btn" id="plPinSel" ${S.sel&&selKey(S.sel)?'':'disabled'}>Pin selected object</button></div>
  <h4>Best targets tonight</h4>
  <div class="row2"><span class="seg" id="plEquip">${[['eye','Eyes'],['bin','Binoculars'],['small','Small scope'],['large','Large scope'],['mine','My telescope']].map(([k,l])=>`<button data-e="${k}" class="${PL.equip===k?'on':''}">${l}</button>`).join('')}</span></div>
  <div class="muted" id="plEqNote"></div>
  <div class="row2"><button class="btn primary" id="bestBtn">Find the best targets</button></div>
  <div id="plBest"></div>`;
  $('plPrev').onclick=()=>{PL.nightOffset--;PL.cache=null;renderTonight(el)};$('plNext').onclick=()=>{PL.nightOffset++;PL.cache=null;renderTonight(el)};
  if($('plTonight'))$('plTonight').onclick=()=>{PL.nightOffset=0;PL.cache=null;renderTonight(el)};
  $('plPinSel').onclick=()=>{if(S.sel)pinSel(S.sel)};
  el.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{PL.equip=b.dataset.e;store.set('pl.equip',PL.equip);renderTonight(el)});
  $('plEqNote').textContent=equipLimits().note;
  $('bestBtn').onclick=()=>{$('plBest').innerHTML='<div class="muted">Calculating…</div>';setTimeout(()=>showBest(N),20)};
  if(PL.best&&PL.bestKey===bestKey(N))paintBest(PL.best);
  drawPlanChart(N);
}
function drawPlanChart(N){
  const c=$('plChart');if(!c)return;const w=c.clientWidth||320,h=230;c.width=w*DPR;c.height=h*DPR;c.style.height=h+'px';const g=c.getContext('2d');g.setTransform(DPR,0,0,DPR,0,0);
  const L=34,Rp=8,T=10,B=24,pw=w-L-Rp,ph=h-T-B;const X=ms=>L+(ms-N.start)/(N.end-N.start)*pw,Y=a=>T+(1-clamp(a,0,90)/90)*ph;
  // background bands by Sun altitude
  for(let i=0;i<N.t.length-1;i++){const s=N.sun[i];const col=s>0?'#2b3f66':s>-6?'#1e2b4a':s>-12?'#141d35':s>-18?'#0d1426':'#05070f';g.fillStyle=col;g.fillRect(X(N.t[i]),T,X(N.t[i+1])-X(N.t[i])+0.6,ph)}
  g.strokeStyle='rgba(236,230,214,.12)';g.lineWidth=1;g.font='11px Jost, sans-serif';g.fillStyle='rgba(236,230,214,.55)';
  for(const a of[0,30,60,90]){g.beginPath();g.moveTo(L,Y(a));g.lineTo(L+pw,Y(a));g.stroke();g.fillText(a+'°',4,Y(a)+4)}
  // hour ticks
  const off=tzOffsetMin(N.start)*60000;let hr=Math.ceil((N.start+off)/36e5)*36e5-off;for(;hr<=N.end;hr+=36e5){const x=X(hr);g.beginPath();g.moveTo(x,T+ph);g.lineTo(x,T+ph+4);g.stroke();const lab=new Date(hr+off).getUTCHours();if(lab%2===0)g.fillText(String(lab).padStart(2,'0'),x-6,h-6)}
  // Moon
  const line=(arr,col,dash,wid)=>{g.strokeStyle=col;g.lineWidth=wid||1.8;g.setLineDash(dash||[]);g.beginPath();let pen=false;arr.forEach((a,i)=>{const x=X(N.t[i]),y=Y(a);if(a<-2){pen=false;return}pen?g.lineTo(x,y):g.moveTo(x,y);pen=true});g.stroke();g.setLineDash([])};
  line(N.moon,'rgba(240,240,255,.55)',[4,4],1.3);
  const series=[];PL.pins.forEach((k,i)=>{const s=selFromKey(k);if(!s)return;const a=altSeries(N,s);if(a)series.push({name:selName(s),a,col:PIN_COLORS[i%PIN_COLORS.length],k})});
  if(S.sel&&!PL.pins.includes(selKey(S.sel))&&(S.sel.kind==='star'||S.sel.kind==='dso'||S.sel.kind==='planet')){const a=altSeries(N,S.sel);if(a)series.push({name:selName(S.sel)+' (selected)',a,col:'#d9b66c',sel:true})}
  series.forEach(s=>line(s.a,s.col,s.sel?[6,3]:null,2));
  // now marker
  if(S.simMs>=N.start&&S.simMs<=N.end){g.strokeStyle='#d9b66c';g.lineWidth=1;g.beginPath();g.moveTo(X(S.simMs),T);g.lineTo(X(S.simMs),T+ph);g.stroke()}
  // pins legend
  $('plPins').innerHTML=series.map(s=>`<span class="pin"><i style="background:${s.col}"></i>${escapeHtml(s.name)}${s.k?`<button data-un="${escapeHtml(s.k)}" aria-label="Remove">×</button>`:''}</span>`).join('')+'<span class="pin"><i style="background:rgba(240,240,255,.55)"></i>Moon</span>';
  $('plPins').querySelectorAll('[data-un]').forEach(b=>b.onclick=()=>unpin(b.dataset.un));
  const idxAt=ex=>{const ms=N.start+(ex-L)/pw*(N.end-N.start);return clamp(Math.round((ms-N.start)/(5*60000)),0,N.t.length-1)};
  c.onmousemove=e=>{const r=c.getBoundingClientRect();const i=idxAt(e.clientX-r.left);const parts=series.map(s=>`${s.name.replace(' (selected)','')}: ${s.a[i].toFixed(0)}°`);parts.push(`Moon ${N.moon[i].toFixed(0)}°`);
    const sun=N.sun[i];$('plRead').textContent=`${fmtT(N.t[i])} · ${sun>0?'day':sun>-6?'civil twilight':sun>-12?'nautical twilight':sun>-18?'astronomical twilight':'dark'} · `+parts.join(' · ')};
  c.onclick=e=>{const r=c.getBoundingClientRect();const i=idxAt(e.clientX-r.left);setTime(N.t[i],false);drawPlanChart(N)};
}
function equipLimits(){
  const sky=LP[S.lp][1];const myAp=EQ&&EQ.scope?EQ.scope.ap:null;
  const ap={eye:7,bin:50,small:100,large:250,mine:myAp||150}[PL.equip];
  const gain=PL.equip==='eye'?0:5*Math.log10(ap/7)*(PL.equip==='bin'?0.85:1);
  const point=sky+gain;const ext=PL.equip==='eye'?sky-1.3:point-2.6;
  const names={eye:'naked eye',bin:'10×50 binoculars',small:'a 100 mm telescope',large:'a 250 mm telescope',mine:myAp?`your ${myAp} mm telescope`:'your telescope (set it in Equipment; using 150 mm)'};
  return{point,ext,sky,note:`With ${names[PL.equip]} under your sky (naked-eye limit ${sky.toFixed(1)}): stars to about mag ${point.toFixed(1)}, galaxies and nebulae to roughly ${ext.toFixed(1)} if they are not too spread out.`};
}
function bestKey(N){return N.key+'|'+PL.equip+'|'+S.lp+'|'+(EQ&&EQ.scope?EQ.scope.ap:'')}
function showBest(N){
  const lim=equipLimits();const skySB=21.6-(6.5-lim.sky)*1.3; // sky background, mag/arcsec²
  const darkIdx=N.t.map((_,i)=>i).filter(i=>N.dark[i]);if(!darkIdx.length){$('plBest').innerHTML='<div class="muted">The sky never gets fully dark on this night at your location.</div>';return}
  const out=[];
  const consider=(sel,mag,v,meta)=>{
    let best=-90,bi=-1,above=0;
    for(const i of darkIdx){const R=N.R[i];const vv=v||meta.vAt(i);const a=Math.asin(clamp(R[6]*vv[0]+R[7]*vv[1]+R[8]*vv[2],-1,1))*RAD;if(a>best){best=a;bi=i}if(a>30)above+=5}
    if(best<15)return;
    const isPoint=meta.point;const L=isPoint?lim.point:lim.ext;const margin=L-mag;if(margin<-0.3)return;
    let sbPen=0,sb=null;if(!isPoint&&meta.maj){const area=Math.PI/4*meta.maj*(meta.min||meta.maj);sb=mag+2.5*Math.log10(Math.max(area,0.01))+8.89;sbPen=Math.max(0,sb-(skySB+0.8))*7;if(PL.equip==='eye'&&sb>skySB+2)return}
    const mv=N.moonV[bi];const vv=v||meta.vAt(bi);const sep=Math.acos(clamp(mv[0]*vv[0]+mv[1]*vv[1]+mv[2]*vv[2],-1,1))*RAD;
    const moonPen=N.moon[bi]>0?N.moonFrac*Math.max(0,1-sep/70)*25+N.moonFrac*8:0;
    const score=Math.min(best,70)/70*35+Math.min(above/60,5)*4+clamp(margin,0,4)*5+(meta.bonus||0)-moonPen-sbPen;
    out.push({sel,score,best,bt:N.t[bi],above,mag,sep,moonUp:N.moon[bi]>0,margin,sb,meta});
  };
  for(const p of PLANETS){if(p.key==='Sun'||p.key==='Moon'||p.key==='Pluto')continue;consider({kind:'planet',ref:p},bodies[p.key].mag,null,{point:true,bonus:14,vAt:i=>eqToVec(A.Equator(p.body,A.MakeTime(new Date(N.t[i])),obsA,false,true))})}
  for(const o of DSO){if(o.mag==null)continue;if(!(o.M||o.common.length||o.mag<=10))continue;if(o.type==='**'||o.type==='Other')continue;
    consider({kind:'dso',ref:o},o.mag,[o.x,o.y,o.z3],{point:false,maj:o.maj,min:o.min,bonus:(o.M?6:0)+((DSODESC[o.M]||DSODESC[o.id])?5:0)})}
  out.sort((a,b)=>b.score-a.score);PL.best=out.slice(0,30);PL.bestKey=bestKey(N);paintBest(PL.best);
}
function paintBest(list){
  if(!list.length){$('plBest').innerHTML='<div class="muted">Nothing suitable rises high enough in the dark hours with this equipment.</div>';return}
  $('plBest').innerHTML=list.map((r,k)=>{const name=selName(r.sel);const type=r.sel.kind==='planet'?'Planet':(DSOTYPE[r.sel.ref.type]||r.sel.ref.type);
    const why=[`best ${fmtT(r.bt)} at ${r.best.toFixed(0)}°`,r.above?`${fmtDur(r.above)} above 30°`:null,r.moonUp?`Moon ${r.sep.toFixed(0)}° away`:'Moon down',`mag ${r.mag.toFixed(1)}`+(r.sb!=null?`, surface ${r.sb.toFixed(1)}`:'')].filter(Boolean).join(' · ');
    return `<button class="target" data-b="${k}"><span class="sc">${r.score.toFixed(0)}</span><b>${escapeHtml(name)}</b> <span style="display:inline;color:var(--dim)">· ${escapeHtml(type)}</span><span>${why}</span></button>`}).join('')+'<div class="muted" style="margin-top:8px">Score blends height in the dark sky, time above 30°, brightness against your equipment’s limit, surface brightness and Moon interference. Click to select; use “Pin selected object” to compare on the chart.</div>';
  $('plBest').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{const r=list[+b.dataset.b];showInfo(r.sel);flyTo(r.sel,null);drawPlanChart(nightInfo())});
}
registerTab('tonight','Tonight',renderTonight);
// follow time jumps: a different night (or the moving "now" marker) refreshes the planner
let plLastNoon=0;
const _setTimeBase=setTime;
setTime=function(ms,live){_setTimeBase(ms,live);if(!PRO.on||PRO.tab!=='tonight')return;const n=localNoonUTC(S.simMs);if(n!==plLastNoon){plLastNoon=n;PL.cache=null;PL.best=null;refreshTab('tonight')}else if($('plChart'))drawPlanChart(nightInfo())};
