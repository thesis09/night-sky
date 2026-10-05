"use strict";
/* ================= EVENTS FINDER + EPHEMERIS ================= */
const EV={mode:store.get('ev.mode','events'),list:null,key:'',filter:store.get('ev.filter','all'),busy:false};
const SHOWERS=[ // IMO data: peak (month, day), ZHR, radiant RA/Dec (deg), parent body
 ['Quadrantids',1,3,110,230,49,'asteroid 2003 EH1'],['Lyrids',4,22,18,271,34,'comet C/1861 G1 Thatcher'],['Eta Aquariids',5,6,50,338,-1,'comet 1P/Halley'],
 ['Perseids',8,12,100,48,58,'comet 109P/Swift–Tuttle'],['Draconids',10,8,10,262,54,'comet 21P/Giacobini–Zinner'],['Orionids',10,21,20,95,16,'comet 1P/Halley'],
 ['Leonids',11,17,15,152,22,'comet 55P/Tempel–Tuttle'],['Geminids',12,14,150,112,33,'asteroid 3200 Phaethon'],['Ursids',12,22,10,217,76,'comet 8P/Tuttle']];
const EV_STARS=['Regulus','Spica','Antares','Aldebaran','Pollux'];
function evTitleSel(name){const p=PLANETS.find(p=>p.name===name);if(p)return{kind:'planet',ref:p};if(name==='Pleiades'){const o=DSO.find(d=>d.M===45);return o?{kind:'dso',ref:o}:null}
  for(const [i,n] of named)if(n.proper===name)return{kind:'star',ref:i};return null}
function sepDeg(a,b){return Math.acos(clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2],-1,1))*RAD}
function evVec(name,t){const p=PLANETS.find(p=>p.name===name);if(p)return eqToVec(A.Equator(p.body,t,obsA,false,true));const s=evTitleSel(name);return s?selVec(s):null}
function altAt(v,t){const R=new Float64Array(9);setRot(R,A.Rotation_EQJ_HOR(t,obsA).rot);return Math.asin(clamp(R[6]*v[0]+R[7]*v[1]+R[8]*v[2],-1,1))*RAD}
function sunAltT(t){const e=eqToVec(A.Equator(A.Body.Sun,t,obsA,false,true));return altAt(e,t)}
async function findEvents(){
  const start=A.MakeTime(new Date(S.simMs)),endMs=S.simMs+365*864e5,out=[];const push=(ms,cat,title,detail,sel,vis)=>{if(ms>=S.simMs-864e5&&ms<=endMs)out.push({ms,cat,title,detail,sel,vis})};
  const yieldUI=()=>new Promise(r=>setTimeout(r,0));const prog=t=>{const e=$('evProg');if(e)e.textContent=t};
  try{let q=A.SearchMoonQuarter(start);for(let k=0;k<52;k++){const ms=+q.time.date;if(ms>endMs)break;if(q.quarter===0||q.quarter===2)push(ms,'moon',['New Moon','First quarter','Full Moon','Last quarter'][q.quarter],q.quarter===0?'Darkest skies of the month for faint galaxies and nebulae.':'The Moon lights up the sky all night.',{kind:'planet',ref:PLANETS.find(p=>p.key==='Moon')});q=A.NextMoonQuarter(q)}}catch(e){}
  try{const y=new Date(S.simMs).getUTCFullYear();for(const yy of[y,y+1]){const s=A.Seasons(yy);[['mar_equinox','March equinox'],['jun_solstice','June solstice'],['sep_equinox','September equinox'],['dec_solstice','December solstice']].forEach(([k,n])=>push(+s[k].date,'sky',n,k.includes('equinox')?'Day and night are nearly equal everywhere.':(k==='jun_solstice'?'Longest day in the northern hemisphere.':'Shortest day in the northern hemisphere.'),null))}}catch(e){}
  try{let a=A.SearchPlanetApsis(A.Body.Earth,start);for(let k=0;k<3;k++){push(+a.time.date,'sky',a.kind===0?'Earth at perihelion':'Earth at aphelion',`Earth is ${a.dist_au.toFixed(4)} AU from the Sun, its ${a.kind===0?'closest':'farthest'} for the year.`,null);a=A.NextPlanetApsis(A.Body.Earth,a)}}catch(e){}
  prog('Eclipses…');await yieldUI();
  try{let e=A.SearchLunarEclipse(start);for(let k=0;k<4;k++){const ms=+e.peak.date;if(ms>endMs)break;const mv=eqToVec(A.Equator(A.Body.Moon,e.peak,obsA,false,true));const alt=altAt(mv,e.peak);
    push(ms,'eclipse',`${e.kind[0].toUpperCase()+e.kind.slice(1)} lunar eclipse`,`${alt>0?`Visible from your location: the Moon is ${alt.toFixed(0)}° up at mid-eclipse`:'Not visible from your location (the Moon is below the horizon at mid-eclipse)'}. Total phase lasts ${(e.sd_total*2).toFixed(0)} min${e.sd_total>0?'':' (none)'}.`,{kind:'planet',ref:PLANETS.find(p=>p.key==='Moon')},alt>0);e=A.NextLunarEclipse(e.peak)}}catch(err){}
  try{let e=A.SearchGlobalSolarEclipse(start);for(let k=0;k<4;k++){const ms=+e.peak.date;if(ms>endMs)break;let local='';
    try{const l=A.SearchLocalSolarEclipse(A.MakeTime(new Date(ms-2*864e5)),obsA);if(Math.abs(+l.peak.time.date-ms)<2*864e5&&l.peak.altitude>0)local=` Seen from your location as a ${l.kind} eclipse, Sun ${l.peak.altitude.toFixed(0)}° up at ${fmtT(+l.peak.time.date)}.`}catch(_){}
    push(ms,'eclipse',`${e.kind[0].toUpperCase()+e.kind.slice(1)} solar eclipse`,(e.latitude!=null?`Centre of the eclipse near latitude ${e.latitude.toFixed(1)}°, longitude ${e.longitude.toFixed(1)}°.`:'')+(local||' Not visible from your location.')+' Never look at the Sun without a certified solar filter.',{kind:'planet',ref:PLANETS[0]},!!local);e=A.NextGlobalSolarEclipse(e.peak)}}catch(err){}
  prog('Planets…');await yieldUI();
  for(const p of PLANETS.filter(p=>['Mars','Jupiter','Saturn','Uranus','Neptune'].includes(p.key))){try{const t=A.SearchRelativeLongitude(p.body,0,start);push(+t.date,'planet',`${p.name} at opposition`,`${p.name} is opposite the Sun: up all night and at its brightest for the year. A good time to observe it.`,{kind:'planet',ref:p})}catch(e){}
    try{const t=A.SearchRelativeLongitude(p.body,180,start);push(+t.date,'planet',`${p.name} in conjunction with the Sun`,`${p.name} is behind the Sun and lost in its glare for a few weeks.`,{kind:'planet',ref:p})}catch(e){}}
  for(const p of PLANETS.filter(p=>p.key==='Mercury'||p.key==='Venus')){try{let t=start;for(let k=0;k<(p.key==='Mercury'?7:2);k++){const el=A.SearchMaxElongation(p.body,t);if(+el.time.date>endMs)break;push(+el.time.date,'planet',`${p.name} at greatest ${el.visibility} elongation`,`${el.elongation.toFixed(1)}° from the Sun: the best ${el.visibility==='evening'?'evening (after sunset, west)':'morning (before sunrise, east)'} view of ${p.name}.`,{kind:'planet',ref:p});t=A.MakeTime(new Date(+el.time.date+10*864e5))}}catch(e){}}
  // close approaches: planet pairs (daily scan) and the Moon with planets/bright stars (2-hour scan)
  prog('Conjunctions…');await yieldUI();
  const pl=['Mercury','Venus','Mars','Jupiter','Saturn'];
  const dayV={};for(const n of pl)dayV[n]=[];const days=[];for(let d=0;d<=365;d++){const t=A.MakeTime(new Date(S.simMs+d*864e5));days.push(t);for(const n of pl)dayV[n].push(evVec(n,t))}
  for(let a=0;a<pl.length;a++)for(let b=a+1;b<pl.length;b++){const s=days.map((_,d)=>sepDeg(dayV[pl[a]][d],dayV[pl[b]][d]));
    for(let d=1;d<s.length-1;d++)if(s[d]<s[d-1]&&s[d]<=s[d+1]&&s[d]<3){let best=s[d],bms=+days[d].date;for(let h=-24;h<=24;h++){const t=A.MakeTime(new Date(+days[d].date+h*36e5));const x=sepDeg(evVec(pl[a],t),evVec(pl[b],t));if(x<best){best=x;bms=+t.date}}
      const sun=sepDeg(evVec(pl[a],A.MakeTime(new Date(bms))),eqToVec(A.Equator(A.Body.Sun,A.MakeTime(new Date(bms)),obsA,false,true)));
      push(bms,'conj',`${pl[a]} and ${pl[b]} meet`,`Only ${best<1?(best*60).toFixed(0)+'′':best.toFixed(1)+'°'} apart${sun<15?' (but close to the Sun, hard to see)':''}. ${best<1?'They will fit in one binocular or low-power telescope field.':''}`,{kind:'planet',ref:PLANETS.find(p=>p.name===pl[a])})}}
  const tgt=pl.concat(EV_STARS,['Pleiades']);const moon=[];const steps=[];for(let h=0;h<=365*24;h+=2){const t=A.MakeTime(new Date(S.simMs+h*36e5));steps.push(t);moon.push(eqToVec(A.Equator(A.Body.Moon,t,obsA,false,true)))}
  await yieldUI();
  for(const n of tgt){const fixed=pl.includes(n)?null:evVec(n,start);if(!fixed&&!pl.includes(n))continue;
    const s=steps.map((t,i)=>sepDeg(moon[i],fixed||evVec(n,t)));
    for(let i=1;i<s.length-1;i++)if(s[i]<s[i-1]&&s[i]<=s[i+1]&&s[i]<2.5){let best=s[i],bt=steps[i];
      for(let m=-120;m<=120;m+=5){const t=A.MakeTime(new Date(+steps[i].date+m*60000));const mv=eqToVec(A.Equator(A.Body.Moon,t,obsA,false,true));const x=sepDeg(mv,fixed||evVec(n,t));if(x<best){best=x;bt=t}}
      const mv=eqToVec(A.Equator(A.Body.Moon,bt,obsA,false,true));const alt=altAt(mv,bt);const dark=sunAltT(bt)<-6;const rad=Math.asin(1737.4/(A.Equator(A.Body.Moon,bt,obsA,false,true).dist*AU_KM))*RAD;
      const occ=best<rad;const vis=alt>5&&(dark||['Venus','Jupiter'].includes(n));
      push(+bt.date,occ?'occult':'conj',occ?`The Moon covers ${n} (occultation)`:`Moon near ${n}`,`${occ?`${n} disappears behind the Moon as seen from your location`:`${best.toFixed(1)}° apart as seen from your location`}${alt>0?`, Moon ${alt.toFixed(0)}° up${dark?'':' in daylight or twilight'}`:' (below your horizon at that moment)'}.`,evTitleSel(n),vis);
      i+=6}}
  // meteor showers
  const y0=new Date(S.simMs).getUTCFullYear();
  for(const yy of[y0,y0+1])for(const [n,m,d,zhr,ra,dec,parent] of SHOWERS){const peak=Date.UTC(yy,m-1,d,22-S.obs.lon/15);if(peak<S.simMs-864e5||peak>endMs)continue;
    let ill=0;try{ill=A.Illumination(A.Body.Moon,A.MakeTime(new Date(peak))).phase_fraction}catch(e){}
    const rv=unit(ra,dec);let best=-90;for(let h=-4;h<=8;h++){const t=A.MakeTime(new Date(peak+h*36e5));if(sunAltT(t)<-12)best=Math.max(best,altAt(rv,t))}
    push(peak,'meteor',`${n} meteor shower peak`,`Up to about ${zhr} meteors an hour under ideal dark skies (expect far fewer from a city). Radiant reaches ${best.toFixed(0)}° up in the dark hours; Moon ${Math.round(ill*100)}% lit${ill>0.6?', which will wash out fainter meteors':''}. Debris from ${parent}. Peak date is approximate (±1 day).`,null,best>15)}
  out.sort((a,b)=>a.ms-b.ms);return out;
}
const EV_CATS=[['all','All'],['eclipse','Eclipses'],['conj','Conjunctions'],['occult','Occultations'],['planet','Planets'],['meteor','Meteors'],['moon','Moon'],['sky','Seasons']];
function renderEvents(el){
  el.innerHTML=`<div class="row2"><span class="seg">${[['events','Events (next 12 months)'],['ephem','Ephemeris']].map(([k,l])=>`<button data-m="${k}" class="${EV.mode===k?'on':''}">${l}</button>`).join('')}</span></div><div id="evBody"></div>`;
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{EV.mode=b.dataset.m;store.set('ev.mode',EV.mode);renderEvents(el)});
  if(EV.mode==='events')renderEventList($('evBody'));else renderEphem($('evBody'));
}
function renderEventList(el){
  const key=Math.floor(S.simMs/864e5)+'|'+S.obs.lat+'|'+S.obs.lon;
  el.innerHTML=`<div class="row2" style="flex-wrap:wrap">${EV_CATS.map(([k,l])=>`<button class="btn ${EV.filter===k?'primary':''}" data-f="${k}" style="padding:5px 9px;font-size:12.5px">${l}</button>`).join('')}</div>
  <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0"><input type="checkbox" id="evVis" ${store.get('ev.vis',false)?'checked':''}> Only events visible from my location</label>
  <div class="muted" id="evProg"></div><div id="evList"></div>`;
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{EV.filter=b.dataset.f;store.set('ev.filter',EV.filter);renderEventList(el)});
  $('evVis').onchange=e=>{store.set('ev.vis',e.target.checked);renderEventList(el)};
  const paint=()=>{const onlyVis=store.get('ev.vis',false);const items=EV.list.filter(x=>(EV.filter==='all'||x.cat===EV.filter)&&(!onlyVis||x.vis!==false));let month='';
    $('evList').innerHTML=items.length?items.map((x,k)=>{const d=new Date(x.ms+tzOffsetMin(x.ms)*60000);const m=d.toUTCString().slice(8,16);const h=m!==month?`<h4 style="font-size:17px;margin:12px 0 2px">${m}</h4>`:'';month=m;
      return h+`<button class="target" data-k="${EV.list.indexOf(x)}"><b>${escapeHtml(x.title)}</b>${x.vis===true?' <span style="display:inline;color:#bfe3b4">· visible here</span>':''}<span>${fmtT(x.ms,true)}</span><span>${escapeHtml(x.detail)}</span></button>`}).join(''):'<div class="muted">No events in this category.</div>';
    $('evList').querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const x=EV.list[+b.dataset.k];setTime(x.ms,false);if(x.sel){showInfo(x.sel);flyTo(x.sel,x.cat==='conj'||x.cat==='occult'?6:null)}})};
  if(EV.list&&EV.key===key){paint();return}
  if(EV.busy)return;EV.busy=true;$('evProg').textContent='Searching the next 12 months…';
  setTimeout(async()=>{try{EV.list=await findEvents();EV.key=key}catch(e){console.warn(e);EV.list=[]}EV.busy=false;if($('evProg')){$('evProg').textContent=`${EV.list.length} events found for ${S.obs.name}. Times in ${tzLabel(S.simMs)}.`;paint()}},30);
}
/* ---------- ephemeris ---------- */
function posAt(sel,ms){
  const t=A.MakeTime(new Date(ms));
  if(sel.kind==='planet'){const eq=A.Equator(sel.ref.body,t,obsA,false,true);let mag=null;try{mag=sel.ref.key==='Sun'?-26.74:A.Illumination(sel.ref.body,t).mag}catch(e){}return{v:eqToVec(eq),dist:eq.dist,mag}}
  if(sel.kind==='sb'){const ev=A.HelioVector(A.Body.Earth,t);const st=sbState(sel.ref,ms,[ev.x,ev.y,ev.z]);return{v:st.v,dist:st.D,mag:st.mag}}
  if(sel.kind==='sat'){const env=satEnv(ms);const r=satLook(sel.ref,env.date,env.gmst,env.obsGd);if(!r)return null;const c=Math.cos(r.el*DEG);const h=[c*Math.cos(r.az*DEG),-c*Math.sin(r.az*DEG),Math.sin(r.el*DEG)];
    const R=new Float64Array(9);setRot(R,A.Rotation_EQJ_HOR(t,obsA).rot);const e=[0,0,0];applyMT(R,h[0],h[1],h[2],e);return{v:e,dist:r.range/AU_KM,mag:null}}
  const v=selVec(sel);return v?{v,dist:null,mag:null}:null;
}
function renderEphem(el){
  const sel=S.sel;
  if(!sel||!['planet','star','dso','sb','sat','gaia','gal'].includes(sel.kind)){el.innerHTML='<div class="muted" style="margin-top:8px">Select an object in the sky (or search for one), then come back here to build its ephemeris: a table of where it will be over time.</div>';return}
  const st=store.get('ephem',{step:3600,n:48});
  const d=new Date(S.simMs+tzOffsetMin(S.simMs)*60000);
  el.innerHTML=`<h4>${escapeHtml(selName(sel))}</h4>
  <div class="row2"><label class="f">Start<input type="datetime-local" id="ephStart" value="${d.toISOString().slice(0,16)}"></label></div>
  <div class="row2"><label class="f">Step<select id="ephStep">${[[60,'1 minute'],[600,'10 minutes'],[3600,'1 hour'],[21600,'6 hours'],[86400,'1 day'],[604800,'1 week']].map(([s,l])=>`<option value="${s}" ${s===st.step?'selected':''}>${l}</option>`).join('')}</select></label><label class="f">Rows<input type="number" id="ephN" value="${st.n}" min="2" max="1000"></label></div>
  <div class="row2"><button class="btn primary" id="ephGo">Build table</button><button class="btn" id="ephCsv" disabled>Download CSV</button></div><div id="ephOut"></div>`;
  let rows=null;
  $('ephGo').onclick=()=>{const v=$('ephStart').value;const [dp,tp]=v.split('T');const [y,mo,dd]=dp.split('-').map(Number);const [hh,mm]=tp.split(':').map(Number);const loc=Date.UTC(y,mo-1,dd,hh,mm);const start=loc-tzOffsetMin(loc)*60000;
    const step=+$('ephStep').value,n=clamp(Math.round(+$('ephN').value||48),2,1000);store.set('ephem',{step,n});
    rows=[];for(let k=0;k<n;k++){const ms=start+k*step*1000;const p=posAt(sel,ms);if(!p)continue;const t=A.MakeTime(new Date(ms));const R=new Float64Array(9);setRot(R,A.Rotation_EQJ_HOR(t,obsA).rot);
      const h=[0,0,0];applyM(R,p.v[0],p.v[1],p.v[2],h);const hh2=h.slice();const alt=(()=>{const a=Math.asin(clamp(h[2],-1,1))*RAD;if(a<-1.5)return a;const Rf=1.02/Math.tan((a+10.3/(a+5.11))*DEG)/60;return a+Rf})();
      const az=((Math.atan2(-hh2[1],hh2[0])*RAD)+360)%360;const j=vecRaDec(p.v);const r=A.RotateVector(A.Rotation_EQJ_EQD(t),new A.Vector(p.v[0],p.v[1],p.v[2],t));const dd2=vecRaDec([r.x,r.y,r.z]);
      rows.push({ms,ra:j.ra,dec:j.dec,rad:dd2.ra,decd:dd2.dec,alt,az,dist:p.dist,mag:p.mag})}
    const showD=rows.some(r=>r.dist!=null),showM=rows.some(r=>r.mag!=null);
    $('ephOut').innerHTML=`<div style="overflow-x:auto;margin-top:8px"><table><tr><th>Time (${tzLabel(start)})</th><th>RA (J2000)</th><th>Dec</th><th>Alt</th><th>Az</th>${showD?'<th>Dist (AU)</th>':''}${showM?'<th>Mag</th>':''}</tr>${rows.map(r=>`<tr style="${r.alt<0?'color:var(--faint)':''}"><td>${fmtT(r.ms,true)}</td><td>${fmtRA(r.ra).replace(/\.\ds/,'s')}</td><td>${fmtDec(r.dec)}</td><td>${r.alt.toFixed(1)}°</td><td>${r.az.toFixed(1)}°</td>${showD?`<td>${r.dist!=null?r.dist.toFixed(r.dist<0.01?6:4):''}</td>`:''}${showM?`<td>${r.mag!=null?r.mag.toFixed(1):''}</td>`:''}</tr>`).join('')}</table></div><div class="muted">Grey rows: below your horizon. Altitudes include atmospheric refraction.</div>`;
    $('ephCsv').disabled=false};
  $('ephCsv').onclick=()=>{if(!rows)return;const csv='utc_time,ra_j2000_deg,dec_j2000_deg,ra_of_date_deg,dec_of_date_deg,altitude_deg,azimuth_deg,distance_au,magnitude\n'+rows.map(r=>[new Date(r.ms).toISOString(),(r.ra*15).toFixed(6),r.dec.toFixed(6),(r.rad*15).toFixed(6),r.decd.toFixed(6),r.alt.toFixed(3),r.az.toFixed(3),r.dist??'',r.mag!=null?r.mag.toFixed(2):''].join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=('ephemeris-'+selName(sel)).replace(/[^\w\-]+/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
}
registerTab('events','Events',renderEvents);
