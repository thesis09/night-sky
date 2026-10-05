"use strict";
/* ================= ASTRONOMY STATE ================= */
let obsA=new A.Observer(S.obs.lat,S.obs.lon,S.obs.elev);
const M=new Float64Array(9);   // EQJ -> HOR : h_i = M[3i+0]*x + M[3i+1]*y + M[3i+2]*z
const MD=new Float64Array(9);  // EQD -> HOR
let astroT=null, astroKey='';
const bodies={}; // key -> {e:[x,y,z] EQJ unit topocentric, dist AU, mag, rad (rad), phase}
let sunAltDeg=0, moonAltDeg=-90, moonFrac=0;
let ECL=null; // ecliptic points EQJ
function setRot(dst,rot){for(let i=0;i<3;i++)for(let j=0;j<3;j++)dst[3*i+j]=rot[j][i]}
function applyM(m,x,y,z,o){o[0]=m[0]*x+m[1]*y+m[2]*z;o[1]=m[3]*x+m[4]*y+m[5]*z;o[2]=m[6]*x+m[7]*y+m[8]*z;return o}
function applyMT(m,x,y,z,o){o[0]=m[0]*x+m[3]*y+m[6]*z;o[1]=m[1]*x+m[4]*y+m[7]*z;o[2]=m[2]*x+m[5]*y+m[8]*z;return o}
function eqToVec(eq){const ra=eq.ra*15*DEG,de=eq.dec*DEG,c=Math.cos(de);return[c*Math.cos(ra),c*Math.sin(ra),Math.sin(de)]}
function updateAstro(force){
  const tsec=Math.floor(S.simMs/1000);
  const key=tsec+'|'+S.obs.lat+'|'+S.obs.lon;
  if(!force&&key===astroKey)return;
  astroKey=key;
  const t=A.MakeTime(new Date(S.simMs)); astroT=t;
  setRot(M,A.Rotation_EQJ_HOR(t,obsA).rot);
  setRot(MD,A.Rotation_EQD_HOR(t,obsA).rot);
  for(const p of PLANETS){
    const eq=A.Equator(p.body,t,obsA,false,true);
    const b=bodies[p.key]||(bodies[p.key]={});
    b.e=eqToVec(eq); b.dist=eq.dist; b.ra=eq.ra; b.dec=eq.dec;
    b.rad=Math.asin(Math.min(1,p.R/(eq.dist*149597870.7)));
    if(p.key==='Sun'){b.mag=-26.74;b.frac=1}
    else{try{const il=A.Illumination(p.body,t);b.mag=il.mag;b.frac=il.phase_fraction;b.phaseAngle=il.phase_angle;b.ringTilt=il.ring_tilt;b.helio=il.helio_dist}catch(e){b.mag=6;b.frac=1}}
  }
  // Galilean moons
  const J=bodies.Jupiter; const jv=[J.e[0]*J.dist,J.e[1]*J.dist,J.e[2]*J.dist];
  const jm=A.JupiterMoons(t.AddDays(-J.dist*0.0057755183));
  for(const g of GALILEAN){const s=jm[g.k];const v=[jv[0]+s.x,jv[1]+s.y,jv[2]+s.z];const d=Math.hypot(v[0],v[1],v[2]);
    const b=bodies[g.k]||(bodies[g.k]={});b.e=[v[0]/d,v[1]/d,v[2]/d];b.dist=d;b.mag=g.mag;b.rad=0;
    // hidden behind Jupiter?
    const sep=Math.acos(clamp(b.e[0]*J.e[0]+b.e[1]*J.e[1]+b.e[2]*J.e[2],-1,1));b.hidden=(sep<J.rad&&d>J.dist);}
  const tmp=[0,0,0];
  applyM(M,...bodies.Sun.e,tmp); sunAltDeg=Math.asin(tmp[2])*RAD;
  applyM(M,...bodies.Moon.e,tmp); moonAltDeg=Math.asin(tmp[2])*RAD; moonFrac=bodies.Moon.frac||0;
  if(!ECL){const r=A.Rotation_ECL_EQJ();const m=new Float64Array(9);setRot(m,r.rot);ECL=[];for(let l=0;l<=360;l+=2){const o=[0,0,0];applyM(m,Math.cos(l*DEG),Math.sin(l*DEG),0,o);ECL.push(o)}}
}

/* ================= SKY CONDITIONS ================= */
function interp(tbl,x){if(x>=tbl[0][0])return tbl[0][1];for(let i=1;i<tbl.length;i++){if(x>=tbl[i][0]){const a=tbl[i-1],b=tbl[i];return lerp(b[1],a[1],(x-b[0])/(a[0]-b[0]))}}return tbl[tbl.length-1][1]}
const TWI=[[10,-3.9],[0,-2.0],[-3,0.6],[-6,2.6],[-9,3.9],[-12,4.9],[-15,5.9],[-18,7.2]];
function nakedLimit(){
  if(!S.layers.atmos)return 6.8;
  let lim=Math.min(LP[S.lp][1],interp(TWI,sunAltDeg));
  if(moonAltDeg>0&&sunAltDeg<-6){lim-=moonFrac*Math.min(1.3,Math.max(0,(lim-3.2)*0.45))*Math.sqrt(Math.sin(moonAltDeg*DEG))}
  return lim;
}
function airmass(altDeg){if(altDeg<=0)return 40;return 1/(Math.sin(altDeg*DEG)+0.50572*Math.pow(altDeg+6.07995,-1.6364))}
function extinct(altDeg){return S.layers.atmos?0.25*(airmass(altDeg)-1):0}
function zoomGain(){return Math.max(0,3.4*Math.log10(60/S.fov))} // roughly what binoculars/telescopes with a matching field would show

