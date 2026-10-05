"use strict";
/* ================= SHEETS & CONTROLS ================= */
function closeSheets(except){document.querySelectorAll('.sheet').forEach(s=>{if(s!==except)s.classList.remove('open')})}
function toggleSheet(id){const s=$(id);const open=!s.classList.contains('open');closeSheets();if(open){s.classList.add('open');if(id==='sheetUp')buildUpList();if(id==='sheetPlace')fillPlace()}}
$('where').onclick=()=>toggleSheet('sheetPlace');$('layersBtn').onclick=()=>toggleSheet('sheetLayers');$('upBtn').onclick=()=>toggleSheet('sheetUp');
const LAYERDEF=[['lines','Constellation lines'],['conNames','Constellation names'],['borders','Constellation boundaries'],['starNames','Star names'],['planets','Sun, Moon and planets'],['dso','Galaxies, nebulae, clusters'],['photos','Telescope photos on the sky'],['milky','Milky Way'],['atmos','Atmosphere (daylight, twilight, haze)'],['azgrid','Altitude–azimuth grid'],['eqgrid','Equatorial grid (RA/Dec of date)'],['ecliptic','Ecliptic (path of Sun and planets)'],['sats','Satellites (ISS, Hubble, Tiangong…)'],['starlink','Starlink satellites (heavy)'],['exo','Mark stars with known planets'],['live','Live NASA & research data in details'],['gaia','Gaia DR3 deep stars (millions; zoom in)'],['sb','Comets and asteroids']];
$('layerRows').innerHTML=LAYERDEF.map(([k,l])=>`<div class="row"><label for="ly_${k}">${l}</label><input class="toggle" type="checkbox" id="ly_${k}" ${S.layers[k]?'checked':''}></div>`).join('');
LAYERDEF.forEach(([k])=>$('ly_'+k).addEventListener('change',e=>{S.layers[k]=e.target.checked;store.set('layers',S.layers);if(k==='starlink'&&e.target.checked)loadStarlink();requestRender()}));
$('resetCalib').onclick=()=>resetCalib();
$('rendSel').value=store.get('forceCanvas',false)?'2d':'gl';$('rendSel').onchange=e=>{store.set('forceCanvas',e.target.value==='2d');location.reload()};
$('groundSel').value=S.ground;$('groundSel').onchange=e=>{S.ground=+e.target.value;store.set('ground',S.ground);requestRender()};
$('ly_hud').checked=S.hud;$('ly_hud').onchange=e=>{S.hud=e.target.checked;store.set('hud',S.hud);requestRender()};
$('lpSel').innerHTML=LP.map((l,i)=>`<option value="${i}">${l[0]} · stars to mag ${l[1]}</option>`).join('');$('lpSel').value=S.lp;
$('lpSel').onchange=e=>{S.lp=+e.target.value;store.set('lp',S.lp);requestRender()};
// place sheet
$('cities').innerHTML=CITIES.map((c,i)=>`<button data-c="${i}">${c[0]}</button>`).join('');
$('cities').querySelectorAll('button').forEach(b=>b.onclick=()=>{const c=CITIES[+b.dataset.c];setObs({name:c[0].replace(/ \(.+\)$/,''),lat:c[1],lon:c[2],elev:c[3]});fillPlace()});
const TZS=['device',-720,-600,-480,-420,-360,-300,-240,-180,-120,-60,0,60,120,180,210,240,270,300,330,345,360,390,420,480,540,570,600,660,720,780];
$('tzSel').innerHTML=TZS.map(z=>`<option value="${z}">${z==='device'?'This device’s time zone':'UTC'+(z<0?'−':'+')+Math.floor(Math.abs(z)/60)+(Math.abs(z)%60?':'+String(Math.abs(z)%60).padStart(2,'0'):'')}</option>`).join('');
$('tzSel').value=S.tz;$('tzSel').onchange=e=>{S.tz=e.target.value==='device'?'device':+e.target.value;store.set('tz',S.tz);updateClock();if(S.sel)showInfo(S.sel)};
function fillPlace(){$('inLat').value=S.obs.lat;$('inLon').value=S.obs.lon;$('inElev').value=S.obs.elev;$('inName').value=S.obs.name;
  const d=new Date(S.simMs+tzOffsetMin(S.simMs)*60000);$('inTime').value=d.toISOString().slice(0,16)}
function setObs(o){S.obs=o;store.set('obs',o);obsA=new A.Observer(o.lat,o.lon,o.elev||0);sunAltCache.clear();updateAstro(true);globeKeyReset();updateClock();if(S.sel)showInfo(S.sel);requestRender()}
function globeKeyReset(){for(const k in globeCache)globeCache[k].key=''}
$('applyLoc').onclick=()=>{const lat=+$('inLat').value,lon=+$('inLon').value,el=+$('inElev').value||0;if(!(lat>=-90&&lat<=90&&lon>=-180&&lon<=180)){$('gpsNote').textContent='Latitude must be between −90 and 90, longitude between −180 and 180.';return}
  setObs({name:$('inName').value.trim()||(Math.abs(lat).toFixed(2)+(lat>=0?'°N ':'°S ')+Math.abs(lon).toFixed(2)+(lon>=0?'°E':'°W')),lat,lon,elev:el});$('gpsNote').textContent='Location updated.'};
$('gpsLoc').onclick=()=>{if(!navigator.geolocation){$('gpsNote').textContent='This browser does not offer location access. Pick a city or type your coordinates.';return}
  $('gpsNote').textContent='Asking your device for its location…';
  navigator.geolocation.getCurrentPosition(p=>{setObs({name:'My location',lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),elev:Math.round(p.coords.altitude||0)});fillPlace();$('gpsNote').textContent='Using your device location (±'+Math.round(p.coords.accuracy)+' m).'},
    err=>{$('gpsNote').textContent='Location access was blocked ('+err.message+'). Pick a city or type your coordinates; you can read them from any maps app.'},{enableHighAccuracy:true,timeout:12000})};
$('applyTime').onclick=()=>{const v=$('inTime').value;if(!v)return;const [dp,tp]=v.split('T');const [y,mo,d]=dp.split('-').map(Number);const [hh,mm]=tp.split(':').map(Number);
  const local=Date.UTC(y,mo-1,d,hh,mm);let ms=local-tzOffsetMin(local)*60000;ms=local-tzOffsetMin(ms)*60000;setTime(ms,false)};
function setTime(ms,live){S.simMs=ms;S.live=live;if(live){rateIdx=0;S.rate=1}$('nowBtn').classList.toggle('on',live);$('speedBtn').textContent=RATES[rateIdx][1];updateAstro(true);updateClock();if(S.sel)showInfo(S.sel);requestRender()}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>setTime(S.simMs+(+b.dataset.step)*1000,false));
$('nowBtn').onclick=()=>setTime(Date.now(),true);
$('speedBtn').onclick=()=>{rateIdx=(rateIdx+1)%RATES.length;S.rate=RATES[rateIdx][0];requestRender();$('speedBtn').textContent=RATES[rateIdx][1];if(S.rate!==1){S.live=false;$('nowBtn').classList.remove('on')}};
$('redBtn').onclick=()=>{document.body.classList.toggle('red');$('redBtn').classList.toggle('on')};
function buildUpList(){
  updateAstro(true);const lim=nakedLimit();const out=[];
  const row=(sel,name,sub)=>`<button data-up="${out.length}"><span>${escapeHtml(name)}</span><span class="u2">${sub}</span></button>`;
  let html='';const items=[];
  const fmtAA=v=>{const a=objAltAz(v);return{a,s:`${compass(a.az)} · ${a.alt.toFixed(0)}° up`}};
  const pl=[];for(const p of PLANETS){const b=bodies[p.key];const r=fmtAA(b.e);if(r.a.alt>0)pl.push({sel:{kind:'planet',ref:p},name:p.name,sub:r.s+(p.key!=='Sun'?' · mag '+b.mag.toFixed(1):''),m:b.mag})}
  pl.sort((a,b)=>a.m-b.m);
  const pb=[];for(const p of PLANETS){if(p.key==='Pluto')continue;const b=bodies[p.key];const r=fmtAA(b.e);if(r.a.alt<=0)pb.push({sel:{kind:'planet',ref:p},name:p.name,sub:`${compass(r.a.az)} · ${(-r.a.alt).toFixed(0)}° below`,m:b.mag})}
  const st=[];for(let i=0;i<N&&sMag[i]<1.8;i++){const r=fmtAA([sx[i],sy[i],sz[i]]);if(r.a.alt>3&&named.has(i)&&named.get(i).proper)st.push({sel:{kind:'star',ref:i},name:named.get(i).proper,sub:r.s+' · mag '+sMag[i].toFixed(1)})}
  const ds=[];for(const o of DSO){if(!o.M&&!o.common.length)continue;if(o.mag==null||o.mag>6.5)continue;const r=fmtAA([o.x,o.y,o.z3]);if(r.a.alt>15)ds.push({sel:{kind:'dso',ref:o},name:o.common[0]||'M'+o.M,sub:r.s+' · mag '+o.mag.toFixed(1),m:o.mag})}
  ds.sort((a,b)=>a.m-b.m);
  const sec=(t,arr)=>{if(!arr.length)return;html+=`<h4>${t}</h4>`;for(const x of arr){items.push(x);html+=`<button data-up="${items.length-1}"><span>${escapeHtml(x.name)}</span><span class="u2">${x.sub}</span></button>`}};
  sec('Sun, Moon and planets',pl);sec('Brightest stars',st.slice(0,14));sec('Deep-sky sights for binoculars',ds.slice(0,10));sec('Below the horizon now (tap to see through the ground)',pb);
  if(SATS.length){updateSats();const sv=SATS.filter(o=>o.group!=='starlink'&&o.el>10&&o.lit&&sunAltDeg<-6).sort((a,b)=>b.el-a.el).slice(0,8).map(o=>({sel:{kind:'sat',ref:o},name:o.name,sub:`${compass(o.az)} · ${o.el.toFixed(0)}° up · sunlit`}));sec('Satellites you can see now',sv);const iss=satByNorad.get(25544);if(iss){const ps=satPasses(iss,3).filter(p=>p.litAny).slice(0,3).map(p=>({sel:{kind:'sat',ref:iss},name:'ISS '+fmtT(p.start)+' '+fmtDay(p.start),sub:`${compass(p.startAz)} → ${compass(p.endAz)} · up to ${p.max.toFixed(0)}°`}));sec('Next visible ISS passes',ps)}}
  if(!items.length)html='<p class="note">Nothing bright is above the horizon right now.</p>';
  html+=`<p class="note">${lim<1?'It is daytime or bright twilight where you are, so most of these are not visible yet.':'With your chosen sky quality, stars down to about magnitude '+lim.toFixed(1)+' are visible to the eye now.'}</p>`;
  $('upList').innerHTML=html;$('upList').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const x=items[+b.dataset.up];flyTo(x.sel,null);showInfo(x.sel);closeSheets()});
}

/* ================= CLOCK ================= */
function updateClock(){
  $('placeName').textContent=S.obs.name;
  $('placeCoord').textContent=Math.abs(S.obs.lat).toFixed(4)+'°'+(S.obs.lat>=0?'N':'S')+'  '+Math.abs(S.obs.lon).toFixed(4)+'°'+(S.obs.lon>=0?'E':'W');
  $('clock').innerHTML=fmtT(S.simMs,true,true)+' '+tzLabel(S.simMs)+(S.live?'':' <span class="rate">· '+(S.rate===1?'paused at chosen time':RATES[rateIdx][1])+'</span>');
  const s=sunAltDeg;const st=s>0?'Daytime':s>-6?'Civil twilight':s>-12?'Nautical twilight':s>-18?'Astronomical twilight':'Dark night';
  let moon='';if(bodies.Moon){const ph=A.MoonPhase(astroT);const nm=ph<11||ph>349?'new Moon':ph<79?'waxing crescent Moon':ph<101?'first-quarter Moon':ph<169?'waxing gibbous Moon':ph<191?'full Moon':ph<259?'waning gibbous Moon':ph<281?'last-quarter Moon':'waning crescent Moon';moon=`${nm} ${(moonFrac*100).toFixed(0)}% lit, ${moonAltDeg>0?'up':'below horizon'}`}
  $('cond').textContent=`${st} · Sun ${s.toFixed(1)}° · ${moon}`;
}

