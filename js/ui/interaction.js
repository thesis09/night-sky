"use strict";
/* ================= CAMERA ANIMATION ================= */
let anim=null;
function flyTo(sel,fov){
  if(sensor.on){requestRender();return}
  const v=selVec(sel);const h=[0,0,0];applyM(M,v[0],v[1],v[2],h);refract(h);const aa=hToAzAlt(h);
  let targetFov=fov;
  if(targetFov==null){if(sel.kind==='dso')targetFov=clamp((sel.ref.maj||5)/60*4,0.6,40);else if(sel.kind==='planet')targetFov=sel.ref.key==='Jupiter'?1.2:sel.ref.key==='Moon'||sel.ref.key==='Sun'?4:12;else if(sel.kind==='gal')targetFov=0.6;else if(sel.kind==='con')targetFov=60;else targetFov=Math.min(S.fov,40)}
  let dAz=aa.az-S.az;dAz=((dAz+540)%360)-180;
  scheduleFrame();anim={t0:performance.now(),dur:900,az0:S.az,alt0:S.alt,fov0:S.fov,dAz,alt1:clamp(aa.alt,-89,89),fov1:targetFov,sel};
}
function stepAnim(now){if(!anim)return;const k=clamp((now-anim.t0)/anim.dur,0,1);const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  S.az=(anim.az0+anim.dAz*e+360)%360;S.alt=lerp(anim.alt0,anim.alt1,e);S.fov=Math.exp(lerp(Math.log(anim.fov0),Math.log(anim.fov1),e));requestRender();if(k>=1)anim=null}

/* ================= INTERACTION ================= */
let drag=null,pinch=null,moved=false;const pointers=new Map();
function pickAt(x,y){
  let best=null,bd=1e9;
  for(const o of hitObjs){const d=Math.hypot(o.x-x,o.y-y);if(d<o.r){const sc=d-o.prio*6;if(sc<bd){bd=sc;best={kind:o.kind,ref:o.ref}}}}
  if(best&&(best.kind==='planet'||best.kind==='gal'||best.kind==='sat'||best.kind==='sb'))return best;
  const lim=lastFrameInfo.showLim;
  if(GL.ok)gatherStarsNear(x,y,14);
  let bi=-1,bs=1e9;
  for(let k=0;k<hitCount;k++){const dx=hitN[2*k]-x,dy=hitN[2*k+1]-y;const d2=dx*dx+dy*dy;if(d2>196)continue;const i=hitI[k];const sc=Math.sqrt(d2)-(lim-sMag[i])*1.6;if(sc<bs){bs=sc;bi=i}}
  const gp=typeof gaiaPick==='function'?gaiaPick(x,y,14):null;
  if(gp&&(bi<0||gp.score<bs)&&(best==null||gp.score<bd))return{kind:'gaia',ref:gp.ref};
  if(bi>=0&&(best==null||bs<bd))return{kind:'star',ref:bi};
  return best;
}
function onDown(e){if(sensor.on&&!overHud(e.offsetX,e.offsetY)){/* dragging takes over from the phone compass */}cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.offsetX,y:e.offsetY});moved=false;anim=null;
  if(pointers.size===1){drag={x:e.offsetX,y:e.offsetY,az:S.az,alt:S.alt};cv.classList.add('dragging')}
  else if(pointers.size===2){const p=[...pointers.values()];pinch={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),fov:S.fov};drag=null}}
function onMove(e){
  const x=e.offsetX,y=e.offsetY;
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x,y});
  if(pinch&&pointers.size===2){const p=[...pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);S.fov=clamp(pinch.fov*pinch.d/Math.max(10,d),0.02,200);if(S.camera){S.fov=clamp(S.fov,10,120);S.camLongFov=clamp(camFovToLong(S.fov),30,120);store.set('camLongFov',S.camLongFov)}moved=true;requestRender();return}
  if(drag){const dx=x-drag.x,dy=y-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
    if(sensor.on){if(Math.abs(dx)+Math.abs(dy)>40){const a=hToAzAlt(cam.f);stopSensor('Switched to touch control because you dragged the view. Tap Phone compass to follow the phone again.');S.az=a.az;S.alt=a.alt;drag={x,y,az:S.az,alt:S.alt}}return}
    const k=S.fov/Math.min(W,H)*1.0;S.az=((drag.az-dx*k/Math.max(0.15,Math.cos(clamp(S.alt,-80,80)*DEG)))%360+360)%360;S.alt=clamp(drag.alt+dy*k,-89.5,89.5);requestRender();$('tip').style.display='none';return}
  if(e.pointerType==='mouse'){mouse={x,y};if(overHud(x,y)){$('tip').style.display='none';cv.style.cursor='pointer'}else hoverAt(x,y);requestLook()}
}
let lookPending=false;function requestLook(){if(!lookPending){lookPending=true;requestAnimationFrame(()=>{lookPending=false;updateLook()})}}
function onUp(e){pointers.delete(e.pointerId);cv.classList.remove('dragging');
  if(!moved&&drag&&hudHit(e.offsetX,e.offsetY)){}
  else if(!moved&&drag){const hit=pickAt(e.offsetX,e.offsetY);if(hit&&S.aligning)alignOn(hit);else if(hit)showInfo(hit);else if(S.sel)showInfo(null)}
  if(pointers.size<2)pinch=null;if(pointers.size===0)drag=null;else if(pointers.size===1){const p=[...pointers.values()][0];drag={x:p.x,y:p.y,az:S.az,alt:S.alt}}}
function hoverAt(x,y){
  const hit=pickAt(x,y);const tip=$('tip');
  if(!hit){tip.style.display='none';cv.style.cursor='';S.hover=null;return}
  cv.style.cursor='pointer';
  let name='',sub='';const v=selVec(hit);const aa=objAltAz(v);
  if(hit.kind==='star'){name=starName(hit.ref)||('HIP '+sHip[hit.ref]);const pc=starDistPc(hit.ref);sub=`Star · mag ${sMag[hit.ref].toFixed(2)}${pc>0?' · '+fmtLy(pc*3.26156):''}`}
  else if(hit.kind==='dso'){const o=hit.ref;name=o.common[0]||(o.M?'M'+o.M:o.id);sub=(DSOTYPE[o.type]||o.type)+(o.mag!=null?' · mag '+o.mag.toFixed(1):'')+(o.M&&o.common[0]?' · M'+o.M:'')}
  else if(hit.kind==='planet'){name=hit.ref.name;const b=bodies[hit.ref.key];sub=(hit.ref.key==='Sun'?'Star':'mag '+b.mag.toFixed(1))+' · '+(hit.ref.key==='Moon'?Math.round(b.dist*149597870.7).toLocaleString('en-US')+' km':b.dist.toFixed(2)+' AU')}
  else if(hit.kind==='gal'){name=hit.ref.name;sub='Moon of Jupiter'}
  else if(hit.kind==='sb'){const o=hit.ref;name=o.name;sub=(o.type==='comet'?'Comet':'Asteroid')+(o.st?` · mag ${o.st.mag.toFixed(1)} · ${o.st.D.toFixed(2)} AU`:'')}
  else if(hit.kind==='gaia'){const T=GAIA.tiles.get(hit.ref.f);name='Gaia DR3 '+T.ids[hit.ref.k];const p=T.plx[hit.ref.k];sub=`Star · G ${T.G[hit.ref.k].toFixed(2)}${p>0.5?' · '+fmtLy(3261.56/p):''}`}
  else if(hit.kind==='sat'){name=hit.ref.name;sub='Satellite · '+(hit.ref.lit?'in sunlight':'in Earth’s shadow')+(hit.ref.range?' · '+Math.round(hit.ref.range).toLocaleString('en-US')+' km away':'')}
  tip.innerHTML=`<b>${escapeHtml(name)}</b><br><span>${escapeHtml(sub)}</span><br><span>${compass(aa.az)} ${aa.az.toFixed(1)}°, alt ${aa.alt.toFixed(1)}° · click for details</span>`;
  tip.style.display='block';const tw=tip.offsetWidth,th=tip.offsetHeight;tip.style.left=clamp(x+16,4,W-tw-4)+'px';tip.style.top=clamp(y+14,4,H-th-4)+'px';
}
cv.addEventListener('pointerdown',onDown);cv.addEventListener('pointermove',onMove);cv.addEventListener('pointerup',onUp);cv.addEventListener('pointercancel',onUp);
cv.addEventListener('pointerleave',()=>{mouse=null;$('tip').style.display='none';requestLook()});
cv.addEventListener('wheel',e=>{e.preventDefault();anim=null;const x=e.offsetX,y=e.offsetY;const h0=unprojH(x,y);const a0=hToAzAlt(h0);
  S.fov=clamp(S.fov*Math.exp(e.deltaY*(e.deltaMode?0.05:0.0016)),0.02,200);setCam();const a1=hToAzAlt(unprojH(x,y));
  let dAz=a0.az-a1.az;dAz=((dAz+540)%360)-180;S.az=(S.az+dAz+360)%360;S.alt=clamp(S.alt+(a0.alt-a1.alt),-89.5,89.5);requestRender();$('tip').style.display='none'},{passive:false});
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;const k=S.fov*0.08;
  if(e.key==='ArrowLeft'){S.az=(S.az-k+360)%360}else if(e.key==='ArrowRight'){S.az=(S.az+k)%360}else if(e.key==='ArrowUp'){S.alt=clamp(S.alt+k,-89.5,89.5)}else if(e.key==='ArrowDown'){S.alt=clamp(S.alt-k,-89.5,89.5)}
  else if(e.key==='+'||e.key==='='){S.fov=clamp(S.fov/1.25,0.02,200)}else if(e.key==='-'){S.fov=clamp(S.fov*1.25,0.02,200)}else if(e.key==='/'){e.preventDefault();$('search').focus();return}else if(e.key==='Escape'){showInfo(null);closeSheets();return}else return;
  e.preventDefault();anim=null;requestRender()});
window.addEventListener('resize',resize);

