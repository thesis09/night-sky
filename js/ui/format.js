"use strict";
/* ================= FORMATTING ================= */
function tzOffsetMin(ms){if(S.tz==='device')return -new Date(ms).getTimezoneOffset();return +S.tz}
function tzLabel(ms){const o=tzOffsetMin(ms);if(S.tz==='device'){try{const p=new Intl.DateTimeFormat(undefined,{timeZoneName:'short'}).formatToParts(new Date(ms)).find(x=>x.type==='timeZoneName');if(p)return p.value}catch(e){}}
  const s=o<0?'−':'+',a=Math.abs(o);return 'UTC'+s+Math.floor(a/60)+(a%60?':'+String(a%60).padStart(2,'0'):'')}
function fmtT(ms,withDate,withSec){const d=new Date(ms+tzOffsetMin(ms)*60000);const p=n=>String(n).padStart(2,'0');let s=p(d.getUTCHours())+':'+p(d.getUTCMinutes())+(withSec?':'+p(d.getUTCSeconds()):'');
  if(withDate){const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];s=days[d.getUTCDay()]+' '+d.getUTCDate()+' '+mons[d.getUTCMonth()]+' '+d.getUTCFullYear()+', '+s}return s}
function fmtDay(ms){const now=S.simMs;const a=new Date(ms+tzOffsetMin(ms)*60000),b=new Date(now+tzOffsetMin(now)*60000);const da=Math.floor((a-Date.UTC(1970,0,1))/864e5)-Math.floor((b-Date.UTC(1970,0,1))/864e5);
  if(da===0)return'today';if(da===1)return'tomorrow';if(da===-1)return'yesterday';const mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return a.getUTCDate()+' '+mons[a.getUTCMonth()]}
function fmtRA(hours){let h=((hours%24)+24)%24;let hh=Math.floor(h),mm=Math.floor((h-hh)*60),ss=((h-hh)*60-mm)*60;if(ss>=59.95){ss=0;mm++}if(mm>=60){mm=0;hh=(hh+1)%24}return hh+'h '+String(mm).padStart(2,'0')+'m '+ss.toFixed(1).padStart(4,'0')+'s'}
function fmtDec(d){const s=d<0?'−':'+';d=Math.abs(d);let dd=Math.floor(d),mm=Math.floor((d-dd)*60),ss=((d-dd)*60-mm)*60;if(ss>=59.5){ss=0;mm++}if(mm>=60){mm=0;dd++}return s+dd+'° '+String(mm).padStart(2,'0')+'′ '+String(Math.round(ss)).padStart(2,'0')+'″'}
function fmtDeg(d,dp){return d.toFixed(dp==null?1:dp)+'°'}
const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const COMPASSW=['north','north-northeast','northeast','east-northeast','east','east-southeast','southeast','south-southeast','south','south-southwest','southwest','west-southwest','west','west-northwest','northwest','north-northwest'];
function compass(az){return COMPASS[Math.round(az/22.5)%16]}
function compassW(az){return COMPASSW[Math.round(az/22.5)%16]}
function fmtNum(x,dp){return x.toLocaleString('en-IN',{maximumFractionDigits:dp||0,minimumFractionDigits:dp||0})}
function fmtLy(ly){if(ly>=1e6)return (ly/1e6).toLocaleString('en-US',{maximumSignificantDigits:3})+' million light-years';return Math.round(ly).toLocaleString('en-US')+' light-years'}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

/* ================= LOOK READOUT ================= */
let mouse=null;
function updateLook(){
  const h=cam.f;const aa=hToAzAlt(h);const e=hToEQJ(h);
  const ra=Math.atan2(e[1],e[0])*RAD/15, de=Math.asin(clamp(e[2],-1,1))*RAD;
  let s=`Centre ${S.hud?'':'<b>'+compass(aa.az)+' '+fmtDeg(aa.az)+'</b>, alt <b>'+fmtDeg(aa.alt)+'</b> · '}RA ${fmtRA(ra).replace(/\.\ds/,'s')}, Dec ${fmtDec(de)} · field ${S.fov>=10?S.fov.toFixed(0):S.fov>=1?S.fov.toFixed(1):(S.fov*60).toFixed(1)+'′'}${S.fov>=1?'°':''}`;
  if(mouse){const hm=unprojH(mouse.x,mouse.y);const am=hToAzAlt(hm);const em=hToEQJ(hm);const rr=Math.atan2(em[1],em[0])*RAD/15,dd=Math.asin(clamp(em[2],-1,1))*RAD;let cn='';try{cn=A.Constellation((rr+24)%24,dd).name}catch(e){}
    s+=`<br>Pointer ${compass(am.az)} ${fmtDeg(am.az)}, alt ${fmtDeg(am.alt)} · RA ${fmtRA(rr).replace(/\.\ds/,'s')}, Dec ${fmtDec(dd)}${cn?' · in '+cn:''}`}
  $('look').innerHTML=s;
}

