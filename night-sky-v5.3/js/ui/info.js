"use strict";
/* ================= INFO / SELECTION ================= */
function objAltAz(v){const h=[0,0,0];applyM(M,v[0],v[1],v[2],h);const ta=Math.asin(clamp(h[2],-1,1))*RAD;const hh=h.slice();const app=refract(hh);const az=((Math.atan2(-h[1],h[0])*RAD)+360)%360;return{az,alt:app,trueAlt:ta}}
function vecRaDec(v){return{ra:((Math.atan2(v[1],v[0])*RAD/15)+24)%24,dec:Math.asin(clamp(v[2],-1,1))*RAD}}
function ofDate(v){const r=A.Rotation_EQJ_EQD(astroT);const o=A.RotateVector(r,new A.Vector(v[0],v[1],v[2],astroT));return vecRaDec([o.x,o.y,o.z])}
function galactic(v){const r=A.Rotation_EQJ_GAL();const o=A.RotateVector(r,new A.Vector(v[0],v[1],v[2],astroT));return{l:((Math.atan2(o.y,o.x)*RAD)+360)%360,b:Math.asin(clamp(o.z,-1,1))*RAD}}
function riseSet(bodyOrStar,v){
  // returns {rise,set,transit,transitAlt,always,never}
  let body=bodyOrStar;
  if(!body){const rd=vecRaDec(v);A.DefineStar(A.Body.Star1,rd.ra,rd.dec,1000);body=A.Body.Star1}
  const t0=A.MakeTime(new Date(S.simMs));
  const out={};
  try{
    const up=objAltAz(v).alt>0;
    if(up){const r=A.SearchRiseSet(body,obsA,+1,t0,-1.05);out.rise=r?r.date:null;const s=A.SearchRiseSet(body,obsA,-1,t0,1.05);out.set=s?s.date:null}
    else{const r=A.SearchRiseSet(body,obsA,+1,t0,1.05);out.rise=r?r.date:null;const s=A.SearchRiseSet(body,obsA,-1,r||t0,1.05);out.set=s?s.date:null}
    const tr=A.SearchHourAngle(body,obsA,0,up&&out.rise?A.MakeTime(out.rise):t0,+1);out.transit=tr.time.date;out.transitAlt=tr.hor.altitude;
    if(!out.rise&&!out.set){if(up)out.always=true;else out.never=true}
  }catch(e){}
  return out;
}
function guideStar(v,selfIdx){
  // nearest bright star above horizon (mag<2.2), excluding self
  const aa=objAltAz(v);let best=null;
  for(let i=0;i<N&&sMag[i]<2.2;i++){if(i===selfIdx)continue;const c=sx[i]*v[0]+sy[i]*v[1]+sz[i]*v[2];const sep=Math.acos(clamp(c,-1,1))*RAD;if(sep<0.3)continue;
    const g=objAltAz([sx[i],sy[i],sz[i]]);if(g.alt<5)continue;if(!best||sep<best.sep)best={i,sep,g}}
  if(!best||best.sep>25)return'';
  let dAz=aa.az-best.g.az;if(dAz>180)dAz-=360;if(dAz<-180)dAz+=360;const dx=dAz*Math.cos(((aa.alt+best.g.alt)/2)*DEG),dy=aa.alt-best.g.alt;
  const parts=[];if(Math.abs(dx)>=0.5)parts.push(Math.abs(dx).toFixed(1)+'° to the '+(dx>0?'right':'left'));if(Math.abs(dy)>=0.5)parts.push(Math.abs(dy).toFixed(1)+'° '+(dy>0?'above':'below'));
  if(!parts.length)return'';
  return `Star-hop: it sits ${parts.join(' and ')} of <b>${escapeHtml(starName(best.i))}</b> (as you face that part of the sky).`;
}
function lookBlock(v,mag,isPoint,opts){
  opts=opts||{};
  const aa=objAltAz(v);const lim=nakedLimit();
  const magApp=mag==null?null:mag+(aa.alt>0?extinct(aa.alt):0);
  let verdict,cls;
  if(aa.alt<0){verdict='Below your horizon right now.';cls='no'}
  else if(opts.sun){verdict='Up now. Do not look at it directly.';cls='mid'}
  else if(magApp==null){verdict='Above the horizon now.';cls='mid'}
  else if(magApp<=lim-(isPoint?0:0.6)){verdict=aa.alt<8?'Up now, but very low: you need a clear, flat horizon.':'Visible to the naked eye right now.';cls='yes'}
  else if(magApp<=lim+(isPoint?3.2:2.2)){verdict='Above the horizon; use binoculars'+(lim<0?' after dark':'')+'.';cls='mid'}
  else{verdict='Above the horizon, but it needs a telescope'+(lim<0?' and a dark sky':'')+'.';cls='mid'}
  if(lim<0&&aa.alt>0&&!opts.sun&&cls!=='yes')verdict='Above the horizon, but the sky is too bright right now.';
  const fists=aa.alt/10;
  let dir='';
  if(aa.alt>=0){dir=`Face <b>${compassW(aa.az)}</b> (azimuth ${aa.az.toFixed(1)}°) and look <b>${aa.alt.toFixed(1)}°</b> up`+(aa.alt>84?', almost straight overhead':`, about ${fists<0.75?'a few fingers':fists<1.25?'one fist':fists.toFixed(1).replace(/\.0$/,'')+' fists'} above the horizon with your arm stretched out (a fist ≈ 10°)`)+'.';}
  else dir=`It is ${(-aa.alt).toFixed(1)}° below the horizon toward the ${compassW(aa.az)} (azimuth ${aa.az.toFixed(1)}°).`;
  const gs=aa.alt>3?guideStar(v,opts.selfIdx):'';
  return `<div class="verdict ${cls}">${verdict}</div><div class="dir">${dir}${gs?'<br>'+gs:''}</div>`;
}
function timesBlock(rs){
  if(rs.always)return `<div class="dir">Never sets from your location (circumpolar). Highest at ${fmtT(+rs.transit)} ${fmtDay(+rs.transit)}, ${rs.transitAlt.toFixed(0)}° up.</div>`;
  if(rs.never)return `<div class="dir">Never rises from your latitude.</div>`;
  const f=d=>d?`<b>${fmtT(+d)}</b>${fmtDay(+d)}`:'<b>—</b>';
  return `<div class="times"><div>${rs.rise&&+rs.rise<S.simMs?'Rose':'Rises'}${f(rs.rise)}</div><div>Highest${f(rs.transit)}${rs.transitAlt!=null?' at '+rs.transitAlt.toFixed(0)+'°':''}</div><div>Sets${f(rs.set)}</div></div>`;
}
function coordsBlock(v){
  const j=vecRaDec(v),d=ofDate(v),aa=objAltAz(v),g=galactic(v);
  const lst=(A.SiderealTime(astroT)+S.obs.lon/15+48)%24;let ha=lst-d.ra;ha=((ha+12)%24+24)%24-12;
  return `<dl class="kv"><dt>Azimuth / altitude</dt><dd>${aa.az.toFixed(2)}° / ${aa.alt.toFixed(2)}°${S.layers.atmos?' (refracted)':''}</dd>
  <dt>RA / Dec (J2000)</dt><dd>${fmtRA(j.ra)}<br>${fmtDec(j.dec)}</dd>
  <dt>RA / Dec (today)</dt><dd>${fmtRA(d.ra)}<br>${fmtDec(d.dec)}</dd>
  <dt>Hour angle</dt><dd>${ha>=0?'+':'−'}${fmtRA(Math.abs(ha)).replace(/\.\ds/,'s')} ${ha>=0?'(past the meridian)':'(before the meridian)'}</dd>
  <dt>Galactic l / b</dt><dd>${g.l.toFixed(2)}° / ${g.b.toFixed(2)}°</dd></dl>`;
}
function spectralInfo(sp){
  if(!sp)return null;const s=sp.replace(/^(sd|d|g|c)/,'');const L=s[0];
  const T={O:['above 30,000 K','blue'],B:['10,000–30,000 K','blue-white'],A:['7,500–10,000 K','white'],F:['6,000–7,500 K','yellow-white'],G:['5,200–6,000 K','yellow, like the Sun'],K:['3,700–5,200 K','orange'],M:['2,400–3,700 K','red-orange'],W:['very hot','blue (Wolf–Rayet)'],C:['cool','deep red (carbon star)'],S:['cool','red (S-type)'],N:['cool','deep red (carbon star)'],D:['hot','white (white dwarf)']}[L];
  let lc='';if(/^sd/.test(sp))lc='subdwarf';else if(/^D/.test(sp))lc='white dwarf';else if(/Ia|Iab|Ib|0-Ia|Ia0/.test(s)&&!/III|II/.test(s.replace(/Iab?/,'')))lc='supergiant';else if(/III/.test(s))lc='giant';else if(/II/.test(s))lc='bright giant';else if(/IV/.test(s))lc='subgiant';else if(/V/.test(s))lc='main-sequence (dwarf) star';else if(/\bI\b|I$/.test(s))lc='supergiant';
  return T?{temp:T[0],col:T[1],lc}:{temp:'',col:'',lc};
}
function starInfo(i){
  const n=named.get(i)||{};const v=[sx[i],sy[i],sz[i]];const conI=sCon[i];const con=CONS[conI];
  const title=n.proper||(n.bayer?bayerStr(n.bayer)+' '+(con?con[2]:''):n.flam?n.flam+' '+(con?con[2]:''):sHip[i]?'HIP '+sHip[i]:n.gl?n.gl:'Star');
  const aliases=[];if(n.bayer&&n.proper)aliases.push(bayerStr(n.bayer)+' '+(con?con[2]:''));if(n.flam)aliases.push(n.flam+' '+(con?con[2]:''));if(sHip[i])aliases.push('HIP '+sHip[i]);if(n.hd)aliases.push('HD '+n.hd);if(n.gl)aliases.push(n.gl);if(n.vr)aliases.push(n.vr+' '+(con?con[2]:''));
  const sp=SD.spect[sSp[i]];const si=spectralInfo(sp);const pc=starDistPc(i);
  const ind=n.proper?INDIAN[n.proper]:null;
  const kind=si&&si.lc?(si.col?si.col[0].toUpperCase()+si.col.slice(1)+' ':'')+si.lc:'Star';
  let facts=`<dl class="kv"><dt>Brightness</dt><dd>magnitude ${sMag[i].toFixed(2)}${n.vmax!=null?` (variable, ${n.vmax.toFixed(1)} to ${n.vmin.toFixed(1)})`:''}</dd>`;
  if(sp)facts+=`<dt>Spectral type</dt><dd>${escapeHtml(sp)}${si&&si.temp?` · surface ${si.temp}`:''}</dd>`;
  if(sCI[i]!==-128)facts+=`<dt>Colour index B−V</dt><dd>${(sCI[i]/50).toFixed(2)}</dd>`;
  if(pc>0){const ly=pc*3.26156;const unc=pc>500?' (very uncertain: too far for a precise parallax)':pc>200?' (approximate)':'';facts+=`<dt>Distance</dt><dd>${fmtLy(ly)} (${pc<10?pc.toFixed(2):Math.round(pc)} parsecs)${unc}</dd>`;
    const absM=sMag[i]-5*Math.log10(pc/10);const lum=Math.pow(10,(4.83-absM)/2.5);facts+=`<dt>Absolute magnitude</dt><dd>${absM.toFixed(2)}</dd><dt>Visual luminosity</dt><dd>${lum>=100?Math.round(lum).toLocaleString('en-US'):lum>=1?lum.toFixed(1):lum.toPrecision(2)} × Sun</dd>`;
    if(ly<5000){const yr=new Date(S.simMs).getUTCFullYear()-Math.round(ly);facts+=`<dt>Light you see left it</dt><dd>around ${yr<0?Math.abs(yr).toLocaleString('en-US')+' BCE':yr+' CE'}</dd>`}}
  if(con)facts+=`<dt>Constellation</dt><dd>${con[1]}</dd>`;
  facts+='</dl>';
  const desc=n.proper&&STARDESC[n.proper]?STARDESC[n.proper]:'';
  const bk=bucketCol[bucketOfCI[sCI[i]+128]];
  return{title,kind,aliases:(ind?['Indian name: '+ind]:[]).concat(aliases).join(' · '),v,mag:sMag[i],isPoint:true,selfIdx:i,
    photo:`<div style="height:120px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 50%, rgba(${bk[0]},${bk[1]},${bk[2]},.55) 0%, rgba(${bk[0]},${bk[1]},${bk[2]},.12) 18%, #000 45%)"><div style="width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 0 18px 8px rgb(${bk[0]},${bk[1]},${bk[2]})"></div></div><div class="cr">Colour as computed from the star's B−V index</div>`,
    facts,desc,src:'Star data: HYG database v4.1 (Hipparcos, Yale Bright Star, Gliese catalogues), positions moved to the current epoch with proper motion.'};
}
function dsoInfo(o){
  const v=[o.x,o.y,o.z3];
  const title=o.common[0]||(o.M?'Messier '+o.M:o.id);
  const al=[];if(o.M)al.push('M'+o.M);al.push(o.id);if(o.ngcx)al.push('NGC '+o.ngcx.split(',').map(s=>+s).join(', '));if(o.icx)al.push('IC '+o.icx.split(',').map(s=>+s).join(', '));o.common.slice(1).forEach(c=>al.push(c));
  const kind=(DSOTYPE[o.type]||o.type)+(o.hub?' · Hubble type '+o.hub:'');
  const cd=DSODESC[o.M]||DSODESC[o.id];
  let facts='<dl class="kv">';
  if(o.mag!=null)facts+=`<dt>Brightness</dt><dd>magnitude ${o.mag.toFixed(1)} (total, spread over its area)</dd>`;
  if(o.maj)facts+=`<dt>Apparent size</dt><dd>${o.maj>=60?(o.maj/60).toFixed(1)+'°':o.maj.toFixed(1)+'′'}${o.min&&o.min!==o.maj?' × '+(o.min>=60?(o.min/60).toFixed(1)+'°':o.min.toFixed(1)+'′'):''}${o.maj>=31?' (bigger than the full Moon)':''}</dd>`;
  if(cd&&cd[1])facts+=`<dt>Distance</dt><dd>${cd[1]}</dd>`;
  if(o.z!=null&&o.type[0]==='G'&&o.type!=='GCl'){facts+=`<dt>Redshift</dt><dd>z = ${o.z.toFixed(5)}${o.rv!=null?` (${o.rv>0?'receding':'approaching'} at ${Math.abs(o.rv).toLocaleString('en-US')} km/s)`:''}</dd>`;
    if(!cd&&o.z>0.008){const mly=o.z*299792.458/70*3.2616;facts+=`<dt>Distance (from redshift)</dt><dd>roughly ${mly>=1000?(mly/1000).toFixed(2)+' billion':Math.round(mly)+' million'} light-years</dd>`}}
  facts+=`<dt>Constellation</dt><dd>${(()=>{const i=conByAbbr[o.con];return i!=null?CONS[i][1]:o.con})()}</dd></dl>`;
  let photo='';
  if(o.tex!=null){const t=TEX[o.tex];photo=`<img alt="Telescope image of ${escapeHtml(title)}" src="img/dso/${encodeURIComponent(t.n)}.webp"><div class="cr">Image: ${escapeHtml(t.cr||'Stellarium')}${t.n.indexOf('virgo')>=0||t.n==='m31'&&o.M!==31?' (wider field)':''}</div>`}
  return{title,kind,aliases:al.filter(x=>x!==title).join(' · '),v,mag:o.mag,isPoint:false,photo,facts,desc:cd?cd[0]:'',src:'Catalogue: OpenNGC (M. Verga). Images: Stellarium deep-sky collection, credited per image.'};
}
function planetInfo(p){
  const b=bodies[p.key];const v=b.e;const au=b.dist;
  let facts='<dl class="kv">';
  if(p.key!=='Sun')facts+=`<dt>Brightness</dt><dd>magnitude ${b.mag.toFixed(1)}</dd>`;
  facts+=`<dt>Distance from you</dt><dd>${p.key==='Moon'?Math.round(au*149597870.7).toLocaleString('en-US')+' km':au.toFixed(4)+' AU ('+(au*149.5978707).toFixed(1)+' million km)'}</dd><dt>Light travel time</dt><dd>${au*499.0047838<120?(au*499.0047838).toFixed(1)+' seconds':(au*499.0047838/60).toFixed(1)+' minutes'}</dd>`;
  facts+=`<dt>Apparent diameter</dt><dd>${b.rad*2*RAD*60>=1?(b.rad*2*RAD*60).toFixed(2)+'′':(b.rad*2*RAD*3600).toFixed(1)+'″'}</dd>`;
  if(p.key!=='Sun'&&b.frac!=null)facts+=`<dt>Lit fraction</dt><dd>${(b.frac*100).toFixed(1)}%</dd>`;
  if(b.helio)facts+=`<dt>Distance from Sun</dt><dd>${b.helio.toFixed(3)} AU</dd>`;
  if(p.key==='Saturn'&&b.ringTilt!=null)facts+=`<dt>Ring tilt</dt><dd>${b.ringTilt.toFixed(1)}° ${Math.abs(b.ringTilt)<4?'(rings nearly edge-on)':''}</dd>`;
  if(p.key!=='Sun'&&p.key!=='Moon'){try{const el=A.Elongation(p.body,astroT);facts+=`<dt>Angle from the Sun</dt><dd>${el.elongation.toFixed(1)}° (${el.visibility} sky)</dd>`}catch(e){}}
  try{const rd=vecRaDec(v);facts+=`<dt>Constellation</dt><dd>${A.Constellation(rd.ra,rd.dec).name}</dd>`}catch(e){}
  for(const f of p.facts)facts+=`<dt>${f[0]}</dt><dd>${f[1]}</dd>`;
  if(p.key==='Moon'){const ph=A.MoonPhase(astroT);const names=[[0,'New Moon'],[22.5,'Waxing crescent'],[67.5,'First quarter'],[112.5,'Waxing gibbous'],[157.5,'Full Moon'],[202.5,'Waning gibbous'],[247.5,'Last quarter'],[292.5,'Waning crescent'],[337.5,'New Moon']];let nm='';for(const n of names)if(ph>=n[0])nm=n[1];
    facts+=`<dt>Phase</dt><dd>${nm}, ${(ph/360*29.5306).toFixed(1)} days since new Moon</dd>`;
    try{let q=A.SearchMoonQuarter(astroT);const qn=['New Moon','First quarter','Full Moon','Last quarter'];for(let k=0;k<4;k++){facts+=`<dt>Next ${qn[q.quarter].toLowerCase()}</dt><dd>${fmtT(+q.time.date,true)}</dd>`;q=A.NextMoonQuarter(q)}}catch(e){}}
  if(p.key==='Sun'){try{const t0=A.MakeTime(new Date(S.simMs));const ev=[['Astronomical dawn',+1,-18],['Sunrise',+1,null],['Sunset',-1,null],['Astronomical dusk',-1,-18]];for(const e of ev){const r=e[2]==null?A.SearchRiseSet(A.Body.Sun,obsA,e[1],t0,1):A.SearchAltitude(A.Body.Sun,obsA,e[1],t0,1,e[2]);if(r)facts+=`<dt>Next ${e[0].toLowerCase()}</dt><dd>${fmtT(+r.date)} ${fmtDay(+r.date)}</dd>`}}catch(e){}}
  facts+='</dl>';
  const upE=[0,0,0];applyMT(M,...cam.u,upE);
  let photo='';
  if(p.tex||p.key==='Sun'){photo='<canvas id="globeC" width="300" height="300" style="aspect-ratio:1"></canvas><div class="cr">'+(p.key==='Sun'?'Rendered disk':'Rendered with true phase and orientation as seen from your location now · map: Stellarium')+'</div>'}
  return{title:p.name,kind:p.kind||(p.key==='Moon'?'Earth’s Moon':'Planet'),aliases:p.key==='Moon'?'Chandra':p.key==='Sun'?'Surya':({Mercury:'Budha',Venus:'Shukra',Mars:'Mangal',Jupiter:'Guru (Brihaspati)',Saturn:'Shani'}[p.key]||''),v,mag:b.mag,isPoint:true,photo,facts,desc:p.desc,
    sun:p.key==='Sun',body:p.body,src:'Positions computed live with Astronomy Engine (D. Cross), accurate to about an arcminute.',globe:p};
}
function galInfo(g){const b=bodies[g.k];return{title:g.name,kind:'Moon of Jupiter',aliases:'Galilean moon',v:b.e,mag:g.mag,isPoint:true,photo:'',facts:`<dl class="kv"><dt>Brightness</dt><dd>about magnitude ${g.mag}</dd><dt>Status</dt><dd>${b.hidden?'behind Jupiter right now':'visible beside Jupiter'}</dd></dl>`,desc:g.desc+' Easily seen with binoculars held steady.',src:'Positions: Astronomy Engine (L1.2 theory).'}}
function conInfo(c){const i=CONLAB.indexOf(c);const cc=CONS[i];return{title:cc[1],kind:'Constellation',aliases:cc[3]?'Hindi: '+cc[3]:'',v:c.v,mag:null,isPoint:false,photo:'',facts:`<dl class="kv"><dt>Genitive</dt><dd>${cc[2]} (used in star names, e.g. α ${cc[2]})</dd><dt>Abbreviation</dt><dd>${cc[0].slice(0,3)}</dd></dl>`,desc:'',src:'Constellation figures: d3-celestial (O. Frohn).'}}
function infoFor(sel){if(sel.kind==='gaia')return gaiaInfo(sel.ref);if(sel.kind==='sb')return sbInfo(sel.ref);if(sel.kind==='star')return starInfo(sel.ref);if(sel.kind==='dso')return dsoInfo(sel.ref);if(sel.kind==='planet')return planetInfo(sel.ref);if(sel.kind==='gal')return galInfo(sel.ref);if(sel.kind==='con')return conInfo(sel.ref);if(sel.kind==='sat')return satInfo(sel.ref);}
let infoTimer=0;
function showInfo(sel){
  S.sel=sel;const el=$('info');if(!sel){el.classList.remove('open');el.innerHTML='';requestRender();return}
  const I=infoFor(sel);
  const body=sel.kind==='planet'?sel.ref.body:null;
  const rs=sel.kind==='planet'||sel.kind==='star'||sel.kind==='dso'||sel.kind==='con'||sel.kind==='gaia'||sel.kind==='sb'?riseSet(body,I.v):null;
  if(!I.v){el.classList.remove('open');return}
  el.innerHTML=`<div class="hd"><button class="close" aria-label="Close">×</button><h2>${escapeHtml(I.title)}</h2><div class="kind">${escapeHtml(I.kind)}</div>${I.aliases?`<div class="alias">${escapeHtml(I.aliases)}</div>`:''}</div>
  ${I.photo?`<div class="photo">${I.photo}</div>`:''}
  <div class="sec"><div class="lbl">Where to look now</div><div id="lookNow">${lookBlock(I.v,I.mag,I.isPoint,{sun:I.sun,selfIdx:I.selfIdx})}</div></div>
  ${rs?`<div class="sec"><div class="lbl">Rise and set (${tzLabel(S.simMs)})</div>${timesBlock(rs)}</div>`:''}
  ${I.desc?`<div class="sec"><div class="desc">${escapeHtml(I.desc)}</div></div>`:''}
  ${sel.kind==='sat'?`<div class="sec"><div class="lbl">Passes over you, next 3 days (${tzLabel(S.simMs)})</div>${passesHtml(sel.ref)}</div>`:''}
  <div class="sec"><div class="lbl">Facts</div>${I.facts}</div>
  ${sel.kind==='star'?starPhysics(sel.ref)+exoHtml(sel.ref):sel.kind==='dso'?dsoPhysics(sel.ref):''}
  <div class="sec" id="liveSec"><div id="liveBox"></div></div>
  <div class="sec"><div class="lbl">Exact position</div><div id="coordNow">${coordsBlock(I.v)}</div></div>
  <div class="sec acts"><button class="btn primary" id="centerBtn">Centre in view</button>${sel.kind==='planet'&&sel.ref.key!=='Sun'?'<button class="btn" id="zoomDisk">Zoom to disk</button>':''}${sel.kind!=='sat'&&sel.ref&&!(sel.kind==='planet'&&sel.ref.key==='Sun')?'<button class="btn" id="svBtn">Other wavelengths</button>':''}${typeof labActionsFor==='function'?labActionsFor(sel):''}</div>
  <div class="sec src">${I.src}</div>`;
  el.classList.add('open');el.scrollTop=0;
  el.querySelector('.close').onclick=()=>showInfo(null);
  $('centerBtn').onclick=()=>flyTo(sel,null);
  if($('svBtn'))$('svBtn').onclick=()=>openSurvey();
  if(typeof labWire==='function')labWire(sel);
  if($('zoomDisk'))$('zoomDisk').onclick=()=>{const b=bodies[sel.ref.key];flyTo(sel,Math.max(0.02,b.rad*2*RAD*(sel.ref.key==='Saturn'?7:5)))};
  if(sel.kind==='star')drawHR(sel.ref);
  loadLive(sel);
  if(I.globe){const gc=$('globeC');const upE=[0,0,0];applyMT(M,...cam.u,upE);const c=renderGlobe(I.globe,300/(I.globe.key==='Saturn'?2.35:1),upE);const g=gc.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,300,300);if(I.globe.key==='Sun'){g.drawImage(c,0,0,300,300)}else g.drawImage(c,(300-c.width)/2,(300-c.height)/2)}
  requestRender();
}
function refreshInfoLive(){if(!S.sel)return;const I=infoFor(S.sel);const a=$('lookNow'),b=$('coordNow');if(a)a.innerHTML=lookBlock(I.v,I.mag,I.isPoint,{sun:I.sun,selfIdx:I.selfIdx});if(b)b.innerHTML=coordsBlock(I.v)}

