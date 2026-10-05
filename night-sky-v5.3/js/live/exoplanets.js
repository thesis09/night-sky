"use strict";
/* ================= EXOPLANETS ================= */
const starPlanets=new Map();let exoSource='';let exoLoaded=false;
function parseCSV(txt){const rows=[];let row=[],f='',q=false;for(let i=0;i<txt.length;i++){const c=txt[i];if(q){if(c==='"'){if(txt[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){row.push(f);f=''}else if(c==='\n'){row.push(f.replace(/\r$/,''));rows.push(row);row=[];f=''}else f+=c}if(f||row.length){row.push(f);rows.push(row)}return rows}
function matchHosts(list){ // list of {host,ra,dec,planet}
  // spatial grid of catalogue stars brighter than mag 12
  const grid=new Map();for(let i=0;i<N&&sMag[i]<12.5;i++){const ra=sRA[i]*RAD,de=sDE[i]*RAD;const k=Math.floor(ra)+':'+Math.floor(de+90);(grid.get(k)||grid.set(k,[]).get(k)).push(i)}
  const byHost=new Map();for(const p of list){(byHost.get(p.host)||byHost.set(p.host,[]).get(p.host)).push(p)}
  let matched=0;
  for(const [host,ps] of byHost){const ra=ps[0].ra,de=ps[0].dec;if(!(ra>=0))continue;const v=unit(ra,de);let best=-1,bs=1e9;
    for(let dr=-1;dr<=1;dr++)for(let dd=-1;dd<=1;dd++){const arr=grid.get(((Math.floor(ra)+dr+360)%360)+':'+(Math.floor(de+90)+dd));if(!arr)continue;for(const i of arr){const sep=Math.acos(clamp(sx[i]*v[0]+sy[i]*v[1]+sz[i]*v[2],-1,1))*RAD*3600;if(sep<bs){bs=sep;best=i}}}
    if(best>=0&&bs<45){starPlanets.set(best,{host,planets:ps});matched++}}
  return matched;
}
async function loadExo(){
  if(exoLoaded)return;exoLoaded=true;
  const cols='pl_name,hostname,ra,dec,pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_eqt,disc_year,discoverymethod,pl_orbeccen';
  for(const [src,url] of [['NASA Exoplanet Archive (via your site)','data/exoplanets.csv'],['NASA Exoplanet Archive','https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query='+encodeURIComponent('select '+cols+' from pscomppars')+'&format=csv']]){
    try{const t=await fetchText(url,20000);const rows=parseCSV(t);const h=rows[0];if(!h||h.indexOf('pl_name')<0)continue;const ix=n=>h.indexOf(n);const list=[];
      for(const r of rows.slice(1)){if(r.length<h.length)continue;const num=n=>{const x=parseFloat(r[ix(n)]);return isFinite(x)?x:null};
        list.push({planet:r[ix('pl_name')],host:r[ix('hostname')],ra:num('ra'),dec:num('dec'),per:num('pl_orbper'),a:num('pl_orbsmax'),rade:num('pl_rade'),masse:num('pl_bmasse'),eqt:num('pl_eqt'),year:num('disc_year'),method:r[ix('discoverymethod')],ecc:num('pl_orbeccen')})}
      if(list.length>1000){const m=matchHosts(list);exoSource=`${src}, ${list.length.toLocaleString('en-US')} confirmed planets (${m} host stars in this chart)`;refreshLayerStatus();requestRender();return}}catch(e){}
  }
  // fallback: embedded Open Exoplanet Catalogue snapshot
  const list=(SD.exo||[]).map(r=>({planet:r[0],host:r[1],ra:r[2],dec:r[3],per:r[4],a:r[5],rade:r[6],masse:r[7],eqt:r[8],year:r[9],method:r[10],ecc:r[11]}));
  const m=matchHosts(list);exoSource=`built-in Open Exoplanet Catalogue snapshot (to 2023), ${list.length.toLocaleString('en-US')} planets (${m} host stars in this chart). Newer discoveries appear once live NASA data loads on your hosted copy.`;refreshLayerStatus();requestRender();
}
function drawExoHosts(){
  if(!exoLoaded){loadExo();return}if(S.fov>60)return;
  ctx.strokeStyle='rgba(140,220,170,.75)';ctx.lineWidth=1;
  if(GL.ok){const sl=lastFrameInfo.showLim;for(const i of starPlanets.keys()){if(sMag[i]>sl)continue;applyM(M,sx[i],sy[i],sz[i],tmpH);const alt=refract(tmpH);if(S.ground===2&&alt<0)continue;projH(tmpH,tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<0||Y<0||X>W||Y>H)continue;ctx.beginPath();ctx.arc(X,Y,6,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(X+4.5,Y-4.5);ctx.lineTo(X+8,Y-8);ctx.stroke()}return}
  for(let k=0;k<hitCount;k++){const i=hitI[k];if(!starPlanets.has(i))continue;const X=hitN[2*k],Y=hitN[2*k+1];ctx.beginPath();ctx.arc(X,Y,6,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(X+4.5,Y-4.5);ctx.lineTo(X+8,Y-8);ctx.stroke()}
}
function exoHtml(i){const e=starPlanets.get(i);if(!e)return'';
  const rows=e.planets.slice().sort((a,b)=>(a.per||1e9)-(b.per||1e9)).map(p=>{
    const mass=p.masse==null?'—':p.masse>=100?(p.masse/317.8).toFixed(2)+' Jupiters':p.masse.toFixed(p.masse<10?2:1)+' Earths';
    const rad=p.rade==null?'':p.rade>=6?(p.rade/11.21).toFixed(2)+' Jupiter radii':p.rade.toFixed(2)+' Earth radii';
    const kind=p.rade!=null?(p.rade<1.25?'rocky, Earth-sized':p.rade<2?'super-Earth':p.rade<6?'Neptune-like':'gas giant'):(p.masse!=null?(p.masse<2?'Earth-mass':p.masse<10?'super-Earth mass':p.masse<50?'Neptune-like mass':'gas giant'):'');
    return `<div class="pl"><b>${escapeHtml(p.planet)}</b>${kind?' · '+kind:''}<br><span>${p.per!=null?'year: '+(p.per<2?(p.per*24).toFixed(1)+' hours':p.per<1000?p.per.toFixed(1)+' days':(p.per/365.25).toFixed(1)+' years'):''}${p.a!=null?' · orbit '+p.a.toFixed(3)+' AU':''} · mass ${mass}${rad?' · '+rad:''}${p.eqt!=null?' · about '+Math.round(p.eqt)+' K':''}${p.year?' · found '+p.year+(p.method?' by '+escapeHtml(p.method.toLowerCase()):''):''}</span></div>`}).join('');
  return `<div class="sec"><div class="lbl">Planets orbiting this star (${e.planets.length})</div>${rows}<div class="src" style="margin-top:6px">${escapeHtml(exoSource)}</div></div>`;
}

