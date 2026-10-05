"use strict";
/* ================= BACKGROUND SKY (low-res per-pixel) ================= */
let bgC=null,bgX=null,bgImg=null,bw=0,bh=0,mwData=null,mwW=0,mwH=0,mwImageEl=null;
function setupBG(){
  const k=Math.max(3,Math.ceil(Math.sqrt(W*H/70000)));
  bw=Math.ceil(W/k);bh=Math.ceil(H/k);
  bgC=document.createElement('canvas');bgC.width=bw;bgC.height=bh;bgX=bgC.getContext('2d');bgImg=bgX.createImageData(bw,bh);
}
function loadMW(){return new Promise(res=>{const im=new Image();im.onload=()=>{mwImageEl=im;const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);mwData=g.getImageData(0,0,c.width,c.height).data;mwW=c.width;mwH=c.height;res()};im.onerror=()=>res();im.src='img/milkyway.webp'})}
function renderBG(lim){
  const d=bgImg.data;
  const sun=[0,0,0];applyM(M,...bodies.Sun.e,sun);
  const moon=[0,0,0];applyM(M,...bodies.Moon.e,moon);
  const sAlt=sunAltDeg, atm=S.layers.atmos;
  const day=atm?clamp((sAlt+4)/10,0,1):0;
  const tw=atm?clamp((sAlt+18)/14,0,1):0;
  const lpS=atm?LP[S.lp][2]:0;
  const mwVis=S.layers.milky&&mwData?clamp((lim-4.0)/2.4,0,1)*(atm?1:1):0;
  const moonB=atm&&moonAltDeg>0?moonFrac*clamp(moonAltDeg/20,0,1)*(1-day):0;
  const sx_=W/bw, sy_=H/bh;
  const rr=cam.r,uu=cam.u,ff=cam.f;
  let p=0;
  for(let j=0;j<bh;j++){
    const Y=(j+0.5)*sy_;const py=(CY-Y)/scale;
    for(let i=0;i<bw;i++,p+=4){
      const X=(i+0.5)*sx_;const px=(X-CX)/scale;const r2=px*px+py*py;
      const z=(4-r2)/(4+r2),k=(1+z)/2,x=px*k,y=py*k;
      const hx=x*rr[0]+y*uu[0]+z*ff[0], hy=x*rr[1]+y*uu[1]+z*ff[1], hz=x*rr[2]+y*uu[2]+z*ff[2];
      let R,G,B;
      const alt=Math.max(hz,0);
      // sky model
      const hzw=Math.pow(1-alt,3);
      // night
      let nr=2+6*hzw, ng=4+8*hzw, nb=10+14*hzw;
      // light pollution dome (warm)
      nr+=lpS*(10+60*hzw);ng+=lpS*(9+42*hzw);nb+=lpS*(12+30*hzw);
      // moonlit sky
      nr+=moonB*(10+18*hzw);ng+=moonB*(16+24*hzw);nb+=moonB*(32+34*hzw);
      // twilight
      const cosS=hx*sun[0]+hy*sun[1]+hz*sun[2];
      const tz=tw*tw*(1-day);
      const sunSide=(cosS+1)/2;
      let tr=lerp(22,70,hzw)+hzw*sunSide*sunSide*150, tg=lerp(36,62,hzw)+hzw*sunSide*sunSide*70, tb=lerp(80,92,hzw)+hzw*sunSide*20;
      R=lerp(nr,tr,tz);G=lerp(ng,tg,tz);B=lerp(nb,tb,tz);
      // day
      if(day>0){const dr=lerp(52,178,hzw), dg=lerp(112,208,hzw), db=lerp(208,238,hzw);R=lerp(R,dr,day);G=lerp(G,dg,day);B=lerp(B,db,day)}
      // sun glow
      if(atm&&sAlt>-12){const gl=Math.exp((cosS-1)*12)*(0.25+0.75*day)+Math.exp((cosS-1)*600)*2*day;const s2=clamp((sAlt+12)/12,0,1);R+=gl*s2*255;G+=gl*s2*215;B+=gl*s2*170}
      // moon halo
      if(moonB>0){const cm=hx*moon[0]+hy*moon[1]+hz*moon[2];const gl=Math.exp((cm-1)*40)*moonB*55;R+=gl;G+=gl;B+=gl*1.05}
      // milky way
      if(mwVis>0&&(hz>-0.2||S.ground!==2)){
        const ex=M[0]*hx+M[3]*hy+M[6]*hz, ey=M[1]*hx+M[4]*hy+M[7]*hz, ez=M[2]*hx+M[5]*hy+M[8]*hz;
        let ra=Math.atan2(ey,ex)*RAD;const de=Math.asin(clamp(ez,-1,1))*RAD;
        let u=(90-ra)/360;u-=Math.floor(u);const v=(90-de)/180;
        const ti=((Math.min(mwH-1,(v*mwH)|0))*mwW+Math.min(mwW-1,(u*mwW)|0))*4;
        const ext=hz<0?0.55:(atm?clamp(hz*3,0.25,1):1);
        const f=mwVis*ext*1.25;
        R+=mwData[ti]*f;G+=mwData[ti+1]*f;B+=mwData[ti+2]*f;
      }
      d[p]=R>255?255:R;d[p+1]=G>255?255:G;d[p+2]=B>255?255:B;d[p+3]=255;
    }
  }
  bgX.putImageData(bgImg,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(bgC,0,0,W,H);
}
// horizon circle in screen space
function horizonCircle(){
  const nx=cam.r[2],ny=cam.u[2],nz=cam.f[2];
  if(Math.abs(nz)<1e-5)return{line:true,nx,ny};
  return{cx:CX+scale*2*nx/nz,cy:CY-scale*2*ny/nz,r:scale*2/Math.abs(nz),skyInside:nz>0};
}
function clipSky(){
  const hc=horizonCircle();ctx.beginPath();
  if(hc.line){ // half-plane nx*X + ny*Y' > 0
    const L=1e5,dx=-hc.ny,dy=-hc.nx; // direction along line in screen (Y flipped)
    const nX=hc.nx,nY=-hc.ny; // sky-side normal in screen coords
    ctx.moveTo(CX+dx*L,CY+dy*L);ctx.lineTo(CX-dx*L,CY-dy*L);ctx.lineTo(CX-dx*L+nX*L,CY-dy*L+nY*L);ctx.lineTo(CX+dx*L+nX*L,CY+dy*L+nY*L);ctx.closePath();
  } else if(hc.skyInside){ctx.arc(hc.cx,hc.cy,hc.r,0,TAU)}
  else{ctx.rect(-10,-10,W+20,H+20);ctx.arc(hc.cx,hc.cy,hc.r,0,TAU,true)}
  ctx.clip('evenodd');
}
function groundPath(){
  const hc=horizonCircle();ctx.beginPath();
  if(hc.line){const L=1e5,dx=-hc.ny,dy=-hc.nx,nX=-hc.nx,nY=hc.ny;ctx.moveTo(CX+dx*L,CY+dy*L);ctx.lineTo(CX-dx*L,CY-dy*L);ctx.lineTo(CX-dx*L+nX*L,CY-dy*L+nY*L);ctx.lineTo(CX+dx*L+nX*L,CY+dy*L+nY*L);ctx.closePath()}
  else if(!hc.skyInside){ctx.arc(hc.cx,hc.cy,hc.r,0,TAU)}
  else{ctx.rect(-10,-10,W+20,H+20);ctx.arc(hc.cx,hc.cy,hc.r,0,TAU,true)}
}

