"use strict";
/* ================= DATA DECODE ================= */
function b64bytes(s){const b=atob(s),n=b.length,u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=b.charCodeAt(i);return u}
const N=SD.starCount;
const sbuf=window.SKYSTARS_BUF;
const sRA=new Float32Array(sbuf,0,N), sDE=new Float32Array(sbuf,4*N,N), sDistQ=new Uint16Array(sbuf,8*N,N), sSp=new Uint16Array(sbuf,10*N,N),
      sMagQ=new Int16Array(sbuf,12*N,N), sCon=new Uint8Array(sbuf,14*N,N), sCI=new Int8Array(sbuf,15*N,N), sHip=new Uint32Array(sbuf,16*N,N);
const sx=new Float32Array(N), sy=new Float32Array(N), sz=new Float32Array(N), sMag=new Float32Array(N);
for(let i=0;i<N;i++){const c=Math.cos(sDE[i]);sx[i]=c*Math.cos(sRA[i]);sy[i]=c*Math.sin(sRA[i]);sz[i]=Math.sin(sDE[i]);sMag[i]=sMagQ[i]/100}
function starDistPc(i){const v=sDistQ[i];return v?Math.pow(10,v/65535*6-1):NaN}
const named=new Map();
for(const r of SD.named) named.set(r[0],{proper:r[1],bayer:r[2],flam:r[3],vr:r[4],vmax:r[5],vmin:r[6],hd:r[7],gl:r[8]});
const CONS=SD.cons; // [id,name,gen,hi,ra,dec,rank]
const conByAbbr={}; CONS.forEach((c,i)=>{conByAbbr[c[0]]=i; conByAbbr[c[0].slice(0,3)]=conByAbbr[c[0].slice(0,3)]??i});
const GREEK={Alp:'α',Bet:'β',Gam:'γ',Del:'δ',Eps:'ε',Zet:'ζ',Eta:'η',The:'θ',Iot:'ι',Kap:'κ',Lam:'λ',Mu:'μ',Nu:'ν',Xi:'ξ',Omi:'ο',Pi:'π',Rho:'ρ',Sig:'σ',Tau:'τ',Ups:'υ',Phi:'φ',Chi:'χ',Psi:'ψ',Ome:'ω'};
const GREEKW={Alp:'alpha',Bet:'beta',Gam:'gamma',Del:'delta',Eps:'epsilon',Zet:'zeta',Eta:'eta',The:'theta',Iot:'iota',Kap:'kappa',Lam:'lambda',Mu:'mu',Nu:'nu',Xi:'xi',Omi:'omicron',Pi:'pi',Rho:'rho',Sig:'sigma',Tau:'tau',Ups:'upsilon',Phi:'phi',Chi:'chi',Psi:'psi',Ome:'omega'};
const SUP={'1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
function bayerStr(b){if(!b)return'';const [g,n]=b.split('-');return (GREEK[g]||g)+(n?(SUP[n]||n):'')}
function conGen(i){const c=CONS[sCon[i]];return c?c[2]:''}
function conName(i){const c=CONS[i];return c?c[1]:''}

// DSO: [id,type,ra,dec,con,maj,min,pa,mag,hub,M,common,z,rv,tex,ngcx,icx]
const DSO=SD.dso.map(r=>{const ra=r[2]*DEG,de=r[3]*DEG,c=Math.cos(de);return{id:r[0],type:r[1],ra:r[2],dec:r[3],con:r[4],maj:r[5],min:r[6],pa:r[7],mag:r[8],hub:r[9],M:r[10],common:r[11]?r[11].split(','):[],z:r[12],rv:r[13],tex:r[14],ngcx:r[15],icx:r[16],x:c*Math.cos(ra),y:c*Math.sin(ra),z3:Math.sin(de)}});
const TEX=SD.tex.map((t,k)=>{const cs=t[0].map(p=>{const ra=p[0]*DEG,de=p[1]*DEG,c=Math.cos(de);return[c*Math.cos(ra),c*Math.sin(ra),Math.sin(de)]});
  let cx=0,cy=0,cz=0;cs.forEach(v=>{cx+=v[0];cy+=v[1];cz+=v[2]});const l=Math.hypot(cx,cy,cz);cx/=l;cy/=l;cz/=l;
  let rad=0;cs.forEach(v=>{rad=Math.max(rad,Math.acos(clamp(v[0]*cx+v[1]*cy+v[2]*cz,-1,1)))});
  return{c:cs,cr:t[1],mb:t[2],n:t[3],cx,cy,cz,rad,img:null,state:0}});
function texImage(k){const t=TEX[k];if(t.state===0){t.state=1;const im=new Image();im.onload=()=>{t.img=im;t.state=2;requestRender()};im.onerror=()=>{t.state=3};im.src='img/dso/'+encodeURIComponent(t.n)+'.webp'}return t.img}
function unit(raDeg,decDeg){const ra=raDeg*DEG,de=decDeg*DEG,c=Math.cos(de);return[c*Math.cos(ra),c*Math.sin(ra),Math.sin(de)]}
const LINES=SD.lines.map(f=>({id:f[0],segs:f[1].map(ln=>ln.map(p=>unit(p[0],p[1])))}));
const BORDERS=SD.borders.map(ln=>ln.map(p=>unit(p[0],p[1])));
const CONLAB=CONS.map(c=>({name:c[1],v:unit(c[4],c[5]),rank:c[6]}));

