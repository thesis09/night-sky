"use strict";
/* ================= DRAW HELPERS ================= */
const hitN=new Float32Array(N*2), hitI=new Int32Array(N); let hitCount=0;
let hitObjs=[];
function polyline(vecs,toH,style,width,dash,closeLoop){
  ctx.strokeStyle=style;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.beginPath();
  let pen=false,lx=0,ly=0;const o=[0,0,0],h=[0,0,0];
  const n=vecs.length;
  for(let i=0;i<n+(closeLoop?1:0);i++){
    const v=vecs[i%n];toH(v,h);projH(h,o);
    if(behind(o[2])){pen=false;continue}
    if(pen&&Math.abs(o[0]-lx)+Math.abs(o[1]-ly)>W*0.9){pen=false}
    if(!pen){ctx.moveTo(o[0],o[1]);pen=true}else ctx.lineTo(o[0],o[1]);
    lx=o[0];ly=o[1];
  }
  ctx.stroke();ctx.setLineDash([]);
}
const eqjToH=(v,h)=>{applyM(M,v[0],v[1],v[2],h);refract(h);return h};
const eqdToH=(v,h)=>{applyM(MD,v[0],v[1],v[2],h);refract(h);return h};
const horToH=(v,h)=>{h[0]=v[0];h[1]=v[1];h[2]=v[2];return h};
// label occupancy
let occ=null,occW=0,occH=0;const OC=10;
function occReset(){occW=Math.ceil(W/OC)+1;occH=Math.ceil(H/OC)+1;occ=new Uint8Array(occW*occH)}
function occTry(x,y,w,h){const x0=Math.floor(x/OC),y0=Math.floor(y/OC),x1=Math.floor((x+w)/OC),y1=Math.floor((y+h)/OC);
  if(x0<0||y0<0||x1>=occW||y1>=occH)return false;
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++)if(occ[j*occW+i])return false;
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++)occ[j*occW+i]=1;return true}
function label(txt,x,y,font,color,dx,dy,force){
  ctx.font=font;const w=ctx.measureText(txt).width;const lx=x+(dx||6),ly=y+(dy||-6);
  if(!force&&!occTry(lx,ly-11,w,13))return false;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(txt,lx+1,ly+1);ctx.fillStyle=color;ctx.fillText(txt,lx,ly);return true;
}
function starName(i){const n=named.get(i);if(!n)return'';if(n.proper)return n.proper;if(n.bayer)return bayerStr(n.bayer)+' '+(CONS[sCon[i]]?CONS[sCon[i]][0].slice(0,3):'');if(n.flam)return n.flam+' '+(CONS[sCon[i]]?CONS[sCon[i]][0].slice(0,3):'');return''}

