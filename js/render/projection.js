"use strict";
/* ================= CANVAS & PROJECTION ================= */
const cv=$('sky'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,scale=1,CX=0,CY=0;
const cam={f:[1,0,0],r:[0,-1,0],u:[0,0,1]};
const C=new Float64Array(9); // EQJ -> camera(x right,y up,z fwd)
const CD=new Float64Array(9);// EQD -> camera
function resize(){if(S.camera){setTimeout(()=>{S.fov=camFovForScreen();requestRender()},50)}DPR=Math.min(window.devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);setupBG();requestRender()}
function setCam(){
  let f,r,u;
  if(sensor.on&&sensor.cam){f=sensor.cam.f;u=sensor.cam.u;r=sensor.cam.r;S.az=((Math.atan2(-f[1],f[0])*RAD)+360)%360;S.alt=Math.asin(clamp(f[2],-1,1))*RAD}
  else{
  const az=S.az*DEG, al=clamp(S.alt,-89.9,89.9)*DEG;
  f=[Math.cos(al)*Math.cos(az),-Math.cos(al)*Math.sin(az),Math.sin(al)];
  r=[f[1]*1-f[2]*0, f[2]*0-f[0]*1, 0]; // cross(f, z)
  const rl=Math.hypot(r[0],r[1]);r=[r[0]/rl,r[1]/rl,0];
  u=[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  }
  cam.f=f;cam.r=r;cam.u=u;
  const minDim=Math.min(W,H);
  scale=PROJ==='gnomo'?(minDim/2)/Math.tan(Math.min(S.fov,160)*DEG/2):(minDim/2)/(2*Math.tan(S.fov*DEG/4));
  CX=W/2;CY=H/2;
  for(const [dst,src] of [[C,M],[CD,MD]]){
    for(let j=0;j<3;j++){
      dst[j]=r[0]*src[j]+r[1]*src[3+j]+r[2]*src[6+j];
      dst[3+j]=u[0]*src[j]+u[1]*src[3+j]+u[2]*src[6+j];
      dst[6+j]=f[0]*src[j]+f[1]*src[3+j]+f[2]*src[6+j];
    }
  }
}
// refraction: modifies horizon vector h (in place); returns altitude (deg, apparent)
function refract(h){
  if(!S.layers.atmos)return Math.asin(clamp(h[2],-1,1))*RAD;
  const alt=Math.asin(clamp(h[2],-1,1))*RAD;
  if(alt<-1.5||alt>89)return alt;
  const R=1.02/Math.tan((alt+10.3/(alt+5.11))*DEG)/60;
  const na=alt+R;const c0=Math.cos(alt*DEG);if(c0<1e-9)return na;
  const k=Math.cos(na*DEG)/c0;h[0]*=k;h[1]*=k;h[2]=Math.sin(na*DEG);return na;
}
const _h=[0,0,0];
let PROJ='stereo'; // 'stereo' normally, 'gnomo' (rectilinear, like a camera lens) in camera mode
function kOf(z){return PROJ==='gnomo'?(z>0.02?1/z:50):2/(1+Math.max(z,-0.999))}
function behind(z){return PROJ==='gnomo'?z<0.06:z<-0.45}
function viewAngFromHalf(half){return PROJ==='gnomo'?Math.atan(half):2*Math.atan(half/2)}
// project horizon-frame vector -> screen [X,Y,z]
function projH(h,out){
  const x=h[0]*cam.r[0]+h[1]*cam.r[1]+h[2]*cam.r[2];
  const y=h[0]*cam.u[0]+h[1]*cam.u[1]+h[2]*cam.u[2];
  const z=h[0]*cam.f[0]+h[1]*cam.f[1]+h[2]*cam.f[2];
  const k=kOf(z);out[0]=CX+scale*k*x;out[1]=CY-scale*k*y;out[2]=z;return out;
}
// EQJ vector -> horizon (with refraction) -> screen
const _p=[0,0,0];
function projE(v,out,hout){const h=hout||_h;applyM(M,v[0],v[1],v[2],h);refract(h);return projH(h,out)}
function unprojH(X,Y){
  if(PROJ==='gnomo'){const px=(X-CX)/scale,py=(CY-Y)/scale;const v=[px*cam.r[0]+py*cam.u[0]+cam.f[0],px*cam.r[1]+py*cam.u[1]+cam.f[1],px*cam.r[2]+py*cam.u[2]+cam.f[2]];const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l,v[1]/l,v[2]/l]}
  const px=(X-CX)/scale, py=(CY-Y)/scale, r2=px*px+py*py;
  const z=(4-r2)/(4+r2), k=(1+z)/2, x=px*k, y=py*k;
  return[x*cam.r[0]+y*cam.u[0]+z*cam.f[0], x*cam.r[1]+y*cam.u[1]+z*cam.f[1], x*cam.r[2]+y*cam.u[2]+z*cam.f[2]];
}
function hToAzAlt(h){return{az:((Math.atan2(-h[1],h[0])*RAD)+360)%360,alt:Math.asin(clamp(h[2],-1,1))*RAD}}
function unrefractAlt(alt){ // apparent -> true (Bennett)
  if(!S.layers.atmos||alt<-1.5)return alt;const R=1/Math.tan((alt+7.31/(alt+4.4))*DEG)/60;return alt-R}
function hToEQJ(h){ // apparent horizon dir -> EQJ (removing refraction)
  const aa=hToAzAlt(h);const ta=unrefractAlt(aa.alt)*DEG;const az=aa.az*DEG;
  const v=[Math.cos(ta)*Math.cos(az),-Math.cos(ta)*Math.sin(az),Math.sin(ta)];
  const o=[0,0,0];applyMT(M,v[0],v[1],v[2],o);return o;
}

