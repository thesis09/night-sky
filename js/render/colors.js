"use strict";
/* ================= COLORS ================= */
function bvToRGB(bv){
  bv=clamp(bv,-0.4,2.0);
  const T=4600*(1/(0.92*bv+1.7)+1/(0.92*bv+0.62));
  const t=T/100;let r,g,b;
  if(t<=66){r=255;g=99.4708025861*Math.log(t)-161.1195681661;b=t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307}
  else{r=329.698727446*Math.pow(t-60,-0.1332047592);g=288.1221695283*Math.pow(t-60,-0.0755148492);b=255}
  r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255);
  const s=0.55; // desaturate toward white: stars look mostly white to the eye
  return[Math.round(lerp(255,r,s)),Math.round(lerp(255,g,s)),Math.round(lerp(255,b,s))];
}
const NB=40, SPR=[];
const bucketCol=[];
for(let k=0;k<NB;k++){const bv=-0.4+2.4*k/(NB-1);bucketCol.push(bvToRGB(bv))}
function makeSprites(){
  for(let k=0;k<NB;k++){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const [r,gg,b]=bucketCol[k];
    const gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.12,`rgba(${r},${gg},${b},1)`);gr.addColorStop(0.3,`rgba(${r},${gg},${b},0.45)`);gr.addColorStop(0.6,`rgba(${r},${gg},${b},0.09)`);gr.addColorStop(1,`rgba(${r},${gg},${b},0)`);
    g.fillStyle=gr;g.fillRect(0,0,64,64);SPR.push(c)}
}
const bucketOfCI=new Uint8Array(256);
for(let q=-128;q<128;q++){const bv=q===-128?0.6:q/50;bucketOfCI[q+128]=Math.round(clamp((bv+0.4)/2.4,0,1)*(NB-1))}
const bucketCss=bucketCol.map(c=>`rgb(${c[0]},${c[1]},${c[2]})`);

