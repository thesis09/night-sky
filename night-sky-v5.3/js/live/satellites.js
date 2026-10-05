"use strict";
/* ================= SATELLITES ================= */
const SATS=[];const satByNorad=new Map();let satStatus='not loaded';let satLoaded=false,starlinkLoaded=false;
const FAMOUS={25544:'ISS',48274:'Tiangong',20580:'Hubble Space Telescope'};
function prettySat(n,id){if(FAMOUS[id])return FAMOUS[id];return n.replace(/\s+/g,' ').trim()}
function parseTLE(txt,group){let n=0;const L=txt.split(/\r?\n/).map(s=>s.trimEnd()).filter(Boolean);
  for(let i=0;i+2<L.length+1;i++){if(L[i]&&L[i+1]&&L[i+2]&&L[i+1].startsWith('1 ')&&L[i+2].startsWith('2 ')){const id=+L[i+1].slice(2,7);if(!satByNorad.has(id)){try{const rec=satellite.twoline2satrec(L[i+1],L[i+2]);const o={name:prettySat(L[i],id),raw:L[i].trim(),id,rec,group,h:null,el:-99,lit:false};SATS.push(o);satByNorad.set(id,o);n++}catch(e){}}i+=2}}
  return n}
async function loadTLE(group){
  const local='data/'+group+'.tle';const remote='https://celestrak.org/NORAD/elements/gp.php?GROUP='+group+'&FORMAT=tle';
  const key='tle.'+group;
  for(const [src,url] of [['your site',local],['CelesTrak',remote]]){
    try{const t=await fetchText(url,15000);if(/^1 \d/m.test(t)){const n=parseTLE(t,group);store.set(key,{t:Date.now(),txt:group==='starlink'?'':t});return{src,n,age:0}}}catch(e){}
  }
  const c=store.get(key,null);if(c&&c.txt&&Date.now()-c.t<7*864e5){const n=parseTLE(c.txt,group);return{src:'saved copy',n,age:(Date.now()-c.t)/36e5}}
  return null;
}
async function loadSats(){
  if(satLoaded||!window.satellite){if(!window.satellite)satStatus='satellite library could not load';return}
  satLoaded=true;satStatus='loading…';
  const a=await loadTLE('stations'),b=await loadTLE('visual');
  if(!a&&!b){satStatus=HOSTED?'could not download orbit data (see the setup note for the data/ folder)':'live satellite data needs your hosted copy (GitHub Pages)';satLoaded=false;refreshLayerStatus();return}
  satStatus=`${SATS.length} satellites from ${(a||b).src}`;buildSatIndex();refreshLayerStatus();requestRender();
}
async function loadStarlink(){if(starlinkLoaded||!window.satellite)return;starlinkLoaded=true;const r=await loadTLE('starlink');if(!r){starlinkLoaded=false;alertNote('Starlink orbit data could not be downloaded.');return}satStatus=`${SATS.length} satellites`;refreshLayerStatus();requestRender()}
let satSun=[1,0,0],satT=0;
function satLook(o,date,gmst,obsGd){
  const pv=satellite.propagate(o.rec,date);if(!pv||!pv.position)return null;
  const ecf=satellite.eciToEcf(pv.position,gmst);const la=satellite.ecfToLookAngles(obsGd,ecf);
  const az=la.azimuth,el=la.elevation;const p=pv.position;
  const d=p.x*satSun[0]+p.y*satSun[1]+p.z*satSun[2];const perp=Math.hypot(p.x-d*satSun[0],p.y-d*satSun[1],p.z-d*satSun[2]);
  const lit=!(d<0&&perp<6371);
  return{az:((az*RAD)+360)%360,el:el*RAD,range:la.rangeSat,lit,pos:p,vel:pv.velocity};
}
function satEnv(ms){const date=new Date(ms);const t=A.MakeTime(date);const sv=A.GeoVector(A.Body.Sun,t,false);const l=Math.hypot(sv.x,sv.y,sv.z);satSun=[sv.x/l,sv.y/l,sv.z/l];
  return{date,gmst:satellite.gstime(date),obsGd:{longitude:S.obs.lon*DEG,latitude:S.obs.lat*DEG,height:(S.obs.elev||0)/1000}}}
let lastSatMs=0,lastStarlinkMs=0;
function updateSats(){
  if(!SATS.length)return;const ms=S.simMs;const env=satEnv(ms);
  const doStar=Math.abs(ms-lastStarlinkMs)>900;if(doStar)lastStarlinkMs=ms;
  for(const o of SATS){if(o.group==='starlink'&&(!S.layers.starlink||!doStar))continue;const r=satLook(o,env.date,env.gmst,env.obsGd);if(!r){o.el=-99;continue}
    o.el=r.el;o.az=r.az;o.lit=r.lit;o.range=r.range;const c=Math.cos(o.el*DEG);o.h=[c*Math.cos(o.az*DEG),-c*Math.sin(o.az*DEG),Math.sin(o.el*DEG)]}
}
function drawSats(){
  if(!satLoaded){loadSats();return}
  updateSats();const dark=sunAltDeg<-6;const solid=S.ground===2;satsOnScreen=false;
  for(const o of SATS){if(!o.h||o.el<-90)continue;if(o.group==='starlink'&&!S.layers.starlink)continue;if(solid&&o.el<0)continue;
    const h=o.h.slice();if(o.el>0)refract(h);projH(h,tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<-20||Y<-20||X>W+20||Y>H+20)continue;
    const famous=!!FAMOUS[o.id];const vis=o.lit&&dark&&o.el>0;satsOnScreen=true;
    const a=o.el<0?0.35:1;
    ctx.globalAlpha=a;ctx.fillStyle=vis?'#ffffff':o.lit?'rgba(220,225,240,.75)':'rgba(140,150,170,.6)';
    const r=famous?3.2:o.group==='starlink'?1.3:2;
    ctx.beginPath();ctx.moveTo(X,Y-r-1);ctx.lineTo(X+r+1,Y);ctx.lineTo(X,Y+r+1);ctx.lineTo(X-r-1,Y);ctx.closePath();ctx.fill();
    if(vis&&famous){const g=ctx.createRadialGradient(X,Y,0,X,Y,10);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,10,0,TAU);ctx.fill()}
    ctx.globalAlpha=1;
    if(famous||(S.fov<30&&o.group!=='starlink')||(S.sel&&S.sel.kind==='sat'&&S.sel.ref===o))label(o.name,X,Y,'500 12px Jost, sans-serif',vis?'#cfe3ff':'#8f9bb3',6,-5,famous);
    hitObjs.push({x:X,y:Y,r:10,kind:'sat',ref:o,prio:famous?4:2});
  }
  // ground track for ISS and the selected satellite
  const tr=[satByNorad.get(25544)];if(S.sel&&S.sel.kind==='sat')tr.push(S.sel.ref);
  for(const o of tr){if(!o||o.el<-20)continue;const pts=[];const env0=satEnv(S.simMs);
    for(let k=-6;k<=12;k++){const ms=S.simMs+k*30000;const env=k===0?env0:{date:new Date(ms),gmst:satellite.gstime(new Date(ms)),obsGd:env0.obsGd};const r=satLook(o,env.date,env.gmst,env.obsGd);if(!r)continue;const c=Math.cos(r.el*DEG);pts.push([c*Math.cos(r.az*DEG),-c*Math.sin(r.az*DEG),Math.sin(r.el*DEG)])}
    polyline(pts,horToH,'rgba(170,200,255,.45)',1.2,[3,4],false)}
}
const sunAltCache=new Map();
function sunAltAt(ms){const k=Math.round(ms/300000);if(sunAltCache.has(k))return sunAltCache.get(k);const t=A.MakeTime(new Date(k*300000));const e=A.Equator(A.Body.Sun,t,obsA,true,true);const a=A.Horizon(t,obsA,e.ra,e.dec,null).altitude;if(sunAltCache.size>5000)sunAltCache.clear();sunAltCache.set(k,a);return a}
function satPasses(o,days){
  const out=[];const step=20000;const t0=S.simMs;let inPass=null;
  const env0=satEnv(t0);
  for(let ms=t0;ms<t0+days*864e5;ms+=step){
    const date=new Date(ms);const r=satLook(o,date,satellite.gstime(date),env0.obsGd);if(!r)break;
    if(r.el>10){if(!inPass)inPass={start:ms,startAz:r.az,max:-1,maxMs:ms,maxAz:r.az,litAny:false};if(r.el>inPass.max){inPass.max=r.el;inPass.maxMs=ms;inPass.maxAz=r.az}
      if(r.lit&&!inPass.litAny&&sunAltAt(ms)<-6)inPass.litAny=true}
    else if(inPass){inPass.end=ms;inPass.endAz=r.az;out.push(inPass);inPass=null;if(out.length>=8)break}
  }
  return out;
}
function satInfo(o){
  const v=o.h?hToEQJ(o.h):[1,0,0];const env=satEnv(S.simMs);const r=satLook(o,env.date,env.gmst,env.obsGd);
  const geo=r?satellite.eciToGeodetic(r.pos,env.gmst):null;const spd=r?Math.hypot(r.vel.x,r.vel.y,r.vel.z):0;
  const incl=o.rec.inclo*RAD,per=TAU/o.rec.no;const epochAge=(Date.now()-epochToMs(o.rec))/864e5;
  let facts=`<dl class="kv"><dt>Altitude above Earth</dt><dd>${geo?Math.round(geo.height).toLocaleString('en-US')+' km':'—'}</dd><dt>Distance from you</dt><dd>${r?Math.round(r.range).toLocaleString('en-US')+' km':'—'}</dd><dt>Speed</dt><dd>${spd.toFixed(2)} km/s (${Math.round(spd*3600).toLocaleString('en-US')} km/h)</dd>
    <dt>Lighting</dt><dd>${r&&r.lit?'in sunlight':'in Earth’s shadow (invisible)'}</dd><dt>Orbit</dt><dd>one lap every ${per.toFixed(1)} min, inclination ${incl.toFixed(1)}°</dd><dt>NORAD ID</dt><dd>${o.id} (${escapeHtml(o.raw)})</dd><dt>Orbit data age</dt><dd>${epochAge.toFixed(1)} days${epochAge>5?' (older data drifts by a few degrees)':''}</dd></dl>`;
  const desc={25544:'The International Space Station, about 109 m across, the largest structure humans have put in orbit. It reflects sunlight brilliantly and can outshine every star. Crews have lived aboard continuously since November 2000.',48274:'China’s Tiangong space station, crewed since 2021.',20580:'The Hubble Space Telescope, launched in 1990, orbiting about 530 km up.'}[o.id]||'An artificial satellite. It is only visible when it is in sunlight while your sky is dark, typically within a couple of hours of sunset or sunrise.';
  return{title:o.name,kind:'Artificial satellite',aliases:o.raw,v,mag:null,isPoint:true,photo:'',facts,desc,src:'Orbit: CelesTrak GP elements, propagated live with SGP4 (satellite.js). Positions are accurate to a fraction of a degree when the data is fresh.',sat:o};
}
function epochToMs(rec){const yr=rec.epochyr<57?2000+rec.epochyr:1900+rec.epochyr;return Date.UTC(yr,0,1)+(rec.epochdays-1)*864e5}
function passesHtml(o){
  const ps=satPasses(o,3);if(!ps.length)return'<div class="dir">No passes higher than 10° in the next 3 days.</div>';
  return ps.map(p=>`<div class="pass ${p.litAny?'vis':''}"><b>${fmtT(p.start)} ${fmtDay(p.start)}</b> · ${compass(p.startAz)} → highest ${p.max.toFixed(0)}° in the ${compass(p.maxAz)} at ${fmtT(p.maxMs)} → ${compass(p.endAz)} · ${Math.round((p.end-p.start)/60000)} min${p.litAny?' · <span>visible</span>':' · not visible (daylight or shadow)'}</div>`).join('');
}
function buildSatIndex(){for(const o of SATS)if(o.group!=='starlink')addIdx(o.name,'Satellite · NORAD '+o.id,{kind:'sat',ref:o},[o.name,o.raw,'norad'+o.id,o.id===25544?'international space station':''].filter(Boolean),FAMOUS[o.id]?-20:5)}

