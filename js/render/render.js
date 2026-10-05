"use strict";
/* ================= MAIN RENDER ================= */
let needRender=true,rafPending=false;
function requestRender(){needRender=true;scheduleFrame()}
function scheduleFrame(){if(!rafPending&&!document.hidden){rafPending=true;requestAnimationFrame(frame)}}
let lastFrameInfo={lim:6,gain:0};
function render(){
  updateAstro();setCam();
  const L=S.layers;
  const lim=nakedLimit(), gain=zoomGain();let showLim=lim+gain;
  if(S.camera)showLim=Math.max(showLim,4.6+gain*0.5);
  lastFrameInfo={lim,gain,showLim};
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const dark=clamp((lim-1.5)/4,0,1); // how dark the sky is
  if(GL.ok){ctx.clearRect(0,0,W,H);glFrame(lim,showLim,dark);if(S.camera){ctx.fillStyle='rgba(0,2,10,.16)';ctx.fillRect(0,0,W,H)}}
  else if(S.camera){ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(0,2,10,.16)';ctx.fillRect(0,0,W,H)}else renderBG(lim);
  occReset();hitObjs=[];if(!GL.ok)hitCount=0;
  ctx.save();
  const solid=S.ground===2;
  if(solid)clipSky();
  // ---- photos on sky
  if(!GL.ok)drawnTex.clear();
  if(!GL.ok&&!S.camera&&L.photos&&L.dso&&S.fov<75&&dark>0.05){
    const fE=[0,0,0];applyMT(M,...cam.f,fE);
    const half=Math.hypot(W,H)/2/scale; const viewAng=viewAngFromHalf(half);
    ctx.globalCompositeOperation='lighter';
    for(let k=0;k<TEX.length;k++){const t=TEX[k];
      const cosd=t.cx*fE[0]+t.cy*fE[1]+t.cz*fE[2];if(Math.acos(clamp(cosd,-1,1))>viewAng+t.rad)continue;
      const pxSize=t.rad*scale*1.5;if(pxSize<10)continue;
      const im=texImage(k);if(!im)continue;
      const s=t.c.map(v=>{const o=[0,0,0];projE(v,o);return o});
      if(s.some(o=>behind(o[2])))continue;
      const Wi=im.width,Hi=im.height;
      const a=(s[1][0]-s[0][0])/Wi,b=(s[1][1]-s[0][1])/Wi,c=(s[0][0]-s[3][0])/Hi,d=(s[0][1]-s[3][1])/Hi;
      ctx.globalAlpha=clamp(dark*clamp((pxSize-10)/50,0,1)*0.95,0,1);
      ctx.setTransform(DPR*a,DPR*b,DPR*c,DPR*d,DPR*s[3][0],DPR*s[3][1]);
      ctx.drawImage(im,0,0);if(pxSize>40)drawnTex.add(k);
    }
    ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  // ---- grids
  if(L.azgrid){
    for(let a=-80;a<=80;a+=10){const pts=[];for(let z=0;z<=360;z+=2){const ca=Math.cos(a*DEG);pts.push([ca*Math.cos(z*DEG),-ca*Math.sin(z*DEG),Math.sin(a*DEG)])}polyline(pts,horToH,a===0?'rgba(140,200,150,.55)':'rgba(120,190,140,.22)',1,null,false)}
    for(let z=0;z<360;z+=15){const pts=[];for(let a=-88;a<=88;a+=2){const ca=Math.cos(a*DEG);pts.push([ca*Math.cos(z*DEG),-ca*Math.sin(z*DEG),Math.sin(a*DEG)])}polyline(pts,horToH,'rgba(120,190,140,.22)',1,null,false)}
  }
  if(L.eqgrid){
    for(let dd=-80;dd<=80;dd+=10){const pts=[];for(let r=0;r<=360;r+=2){const c=Math.cos(dd*DEG);pts.push([c*Math.cos(r*DEG),c*Math.sin(r*DEG),Math.sin(dd*DEG)])}polyline(pts,eqdToH,dd===0?'rgba(120,160,255,.55)':'rgba(110,150,240,.22)',1,null,false)}
    for(let hr=0;hr<24;hr++){const pts=[];for(let dd=-88;dd<=88;dd+=2){const c=Math.cos(dd*DEG);pts.push([c*Math.cos(hr*15*DEG),c*Math.sin(hr*15*DEG),Math.sin(dd*DEG)])}polyline(pts,eqdToH,'rgba(110,150,240,.22)',1,null,false)}
  }
  if(L.ecliptic&&ECL)polyline(ECL,eqjToH,'rgba(230,190,110,.45)',1,[6,5],false);
  // ---- constellation borders & lines
  if(L.borders&&!GL.ok)for(const ln of BORDERS)polyline(ln,eqjToH,'rgba(150,140,190,.28)',1,[2,4],false);
  if(L.lines&&!GL.ok){const a=clamp(0.2+0.22*dark,0.2,0.42);for(const c of LINES)for(const s of c.segs)polyline(s,eqjToH,`rgba(120,150,210,${a})`,1.1,null,false)}
  // ---- stars
  if(GL.ok)starLabelsCPU(showLim);else drawStars(showLim,lim);
  // ---- DSO markers
  if(L.dso&&dark>0.12)drawDSO(lim,dark);
  // ---- planets
  if(L.planets)drawPlanets(lim);
  ctx.restore();
  // ---- ground
  if(S.ground>0&&!S.camera)drawGround();
  if(S.camera){const pts=[];for(let z=0;z<=360;z+=1)pts.push([Math.cos(z*DEG),-Math.sin(z*DEG),0]);polyline(pts,horToH,'rgba(200,215,170,.8)',1.5,null,false)}
  if(L.sats)drawSats();
  if(L.sb&&typeof drawSmallBodies==='function')drawSmallBodies();
  if(L.exo)drawExoHosts();
  if(typeof drawEquipment==='function')drawEquipment();
  drawHorizonScale();
  // ---- labels on top
  if(L.conNames)drawConNames(dark);
  drawCardinals();
  if(S.sel)drawReticle(S.sel);
  if(S.hud)drawHUD();
  updateLook();
}
const tmpO=[0,0,0],tmpH=[0,0,0];const drawnTex=new Set();
function drawStars(showLim,lim){
  const fE=[0,0,0];applyMT(M,...cam.f,fE);
  const half=Math.hypot(W,H)/2/scale; const viewAng=Math.min(Math.PI,viewAngFromHalf(half)+0.02);const cosView=Math.cos(viewAng);
  const ground=S.ground===2, atm=S.layers.atmos;
  const pxPerDeg=scale*2*DEG/2;
  const labelLim=Math.min(showLim-3.2,Math.max(1.6,showLim-5));
  const m=M,cr=cam.r,cu=cam.u,cf=cam.f;
  const brightBoost=clamp(2.2-S.fov/90,0.9,1.8);
  for(let i=0;i<N;i++){
    const mag0=sMag[i];if(mag0>showLim+0.05)break;
    const x=sx[i],y=sy[i],z=sz[i];
    if(x*fE[0]+y*fE[1]+z*fE[2]<cosView)continue;
    tmpH[0]=m[0]*x+m[1]*y+m[2]*z;tmpH[1]=m[3]*x+m[4]*y+m[5]*z;tmpH[2]=m[6]*x+m[7]*y+m[8]*z;
    const altApprox=tmpH[2];
    if(ground&&altApprox<-0.02)continue;
    let alt=altApprox<0.75?refract(tmpH):Math.asin(altApprox)*RAD;
    if(ground&&alt<0)continue;
    const below=alt<0;
    const mag=atm&&!below?mag0+extinct(alt):mag0;
    const dm=showLim-mag;if(dm<0)continue;
    const hx=tmpH[0],hy=tmpH[1],hz=tmpH[2];
    const pz=hx*cf[0]+hy*cf[1]+hz*cf[2];if(behind(pz))continue;
    const kk=kOf(pz);const X=CX+scale*kk*(hx*cr[0]+hy*cr[1]+hz*cr[2]),Y=CY-scale*kk*(hx*cu[0]+hy*cu[1]+hz*cu[2]);
    if(X<-20||Y<-20||X>W+20||Y>H+20)continue;
    const rad=Math.min(9,0.55+0.42*Math.pow(dm,1.18)*brightBoost);
    const alpha=clamp(dm/1.2+0.08,0.08,1)*(below?0.5:1);
    const bk=bucketOfCI[sCI[i]+128];
    if(rad<1.15){ctx.globalAlpha=alpha;ctx.fillStyle=bucketCss[bk];ctx.fillRect(X-0.75,Y-0.75,1.5,1.5)}
    else{ctx.globalAlpha=alpha;const s=rad*3.4;ctx.drawImage(SPR[bk],X-s,Y-s,2*s,2*s)}
    hitN[hitCount*2]=X;hitN[hitCount*2+1]=Y;hitI[hitCount]=i;hitCount++;
    if(S.layers.starNames&&mag<labelLim&&named.has(i)){const nm=starName(i);if(nm){ctx.globalAlpha=clamp((labelLim-mag)*1.5,0.35,0.9);label(nm,X,Y,'400 12px Jost, sans-serif','#d8d1be',rad+3,-rad-1)}}
  }
  ctx.globalAlpha=1;
}
function dsoShowLimit(){return clamp(4.5+9*Math.log10(120/S.fov)/Math.log10(120/0.5),4.5,13)}
function drawDSO(lim,dark){
  const dl=dsoShowLimit();
  const fE=[0,0,0];applyMT(M,...cam.f,fE);
  const half=Math.hypot(W,H)/2/scale;const cosView=Math.cos(Math.min(Math.PI,viewAngFromHalf(half)+0.05));
  const showMessier=S.fov<60;
  ctx.lineWidth=1;
  for(const o of DSO){
    const mg=o.mag==null?(o.M?8:12):o.mag;
    if(!(mg<=dl||(o.M&&(showMessier||(S.fov<120&&mg<=6.5)))||(o.common.length&&S.fov<40&&mg<=dl+1.5)))continue;
    if(o.x*fE[0]+o.y*fE[1]+o.z3*fE[2]<cosView)continue;
    applyM(M,o.x,o.y,o.z3,tmpH);const alt=refract(tmpH);if(S.ground===2&&alt<0)continue;
    projH(tmpH,tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<-50||Y<-50||X>W+50||Y>H+50)continue;
    const pxPerRad=scale*kOf(tmpO[2]);
    const majPx=Math.max(4,(o.maj||1)/60*DEG*pxPerRad/2);
    const minPx=Math.max(3,((o.min||o.maj||1)/60)*DEG*pxPerRad/2);
    const t=o.type;
    const col=t[0]==='G'&&t!=='GCl'?'rgba(235,165,150,.62)':(t==='OCl'||t==='*Ass'||t==='GCl')?'rgba(240,215,140,.6)':'rgba(140,215,200,.62)';
    ctx.strokeStyle=col;ctx.globalAlpha=1;
    const underPhoto=o.tex!=null&&drawnTex.has(o.tex);
    if(!underPhoto){
    if(t==='G'||t==='GPair'||t==='GTrpl'||t==='GGroup'){
      // orientation: north vector on screen
      const nv=unit(o.ra,Math.min(89.9,o.dec+0.05));projE(nv,_p);const nx=_p[0]-X,ny=_p[1]-Y;const ang0=Math.atan2(ny,nx);
      const ev=unit(o.ra+0.05/Math.max(0.01,Math.cos(o.dec*DEG)),o.dec);const ep=[0,0,0];projE(ev,ep);
      const crossz=nx*(ep[1]-Y)-ny*(ep[0]-X); // east sign
      const pa=(o.pa||0)*DEG;const rot=ang0+(crossz>0?1:-1)*pa;
      ctx.beginPath();ctx.ellipse(X,Y,Math.max(majPx,minPx),Math.min(majPx,minPx)||3,rot,0,TAU);ctx.stroke();
    } else if(t==='OCl'||t==='*Ass'){ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(X,Y,majPx,0,TAU);ctx.stroke();ctx.setLineDash([])}
    else if(t==='GCl'){ctx.beginPath();ctx.arc(X,Y,majPx,0,TAU);ctx.moveTo(X-majPx,Y);ctx.lineTo(X+majPx,Y);ctx.moveTo(X,Y-majPx);ctx.lineTo(X,Y+majPx);ctx.stroke()}
    else if(t==='PN'){ctx.beginPath();ctx.arc(X,Y,Math.max(4,majPx),0,TAU);ctx.stroke();ctx.beginPath();for(const a of[0,1,2,3]){const c=Math.cos(a*Math.PI/2),s=Math.sin(a*Math.PI/2),r=Math.max(4,majPx);ctx.moveTo(X+c*r,Y+s*r);ctx.lineTo(X+c*(r+4),Y+s*(r+4))}ctx.stroke()}
    else{ctx.beginPath();ctx.rect(X-majPx,Y-minPx,majPx*2,minPx*2);ctx.stroke()}
    }
    hitObjs.push({x:X,y:Y,r:Math.max(9,Math.min(majPx,40)),kind:'dso',ref:o,prio:o.M?2:1});
    const nm=o.M?('M'+o.M+(S.fov<35&&o.common[0]?' '+o.common[0]:'')):(S.fov<25?(o.common[0]||o.id):(o.common[0]&&S.fov<60?o.common[0]:''));
    if(nm)label(nm,X,Y,'400 11.5px Jost, sans-serif',col.replace(/[\d.]+\)$/,'0.95)'),majPx+3,4);
  }
}
function drawPlanets(lim){
  const ground=S.ground===2,atm=S.layers.atmos;
  const upH=cam.u;const upE=[0,0,0];applyMT(M,upH[0],upH[1],upH[2],upE);
  const showLim=lastFrameInfo.showLim;
  const list=PLANETS.slice().sort((a,b)=>bodies[b.key].dist-bodies[a.key].dist);
  for(const p of list){
    const b=bodies[p.key];projE(b.e,tmpO,tmpH);const alt=Math.asin(clamp(tmpH[2],-1,1))*RAD;
    if(ground&&alt<-Math.max(0.3,b.rad*RAD))continue;if(behind(tmpO[2]))continue;
    const X=tmpO[0],Y=tmpO[1];if(X<-80||Y<-80||X>W+80||Y>H+80)continue;
    const pxPerRad=scale*kOf(tmpO[2]);const rpx=b.rad*pxPerRad;
    const mag=b.mag+(atm&&alt>0?extinct(alt):0);
    const vis=p.key==='Sun'||p.key==='Moon'||mag<=showLim+0.5;
    if(!vis){continue}
    if(p.key==='Sun'){
      const g=ctx.createRadialGradient(X,Y,0,X,Y,Math.max(rpx*6,40));g.addColorStop(0,'rgba(255,250,235,1)');g.addColorStop(0.15,'rgba(255,250,235,.5)');g.addColorStop(1,'rgba(255,245,225,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,Math.max(rpx*6,40),0,TAU);ctx.fill();
      ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(X,Y,Math.max(rpx,4),0,TAU);ctx.fill();
    } else if(rpx>=2.2&&p.tex){
      const key=p.key+'|'+Math.round(rpx*2)+'|'+Math.floor(S.simMs/60000)+'|'+Math.round(S.az)+'|'+Math.round(S.alt);
      let gc=globeCache[p.key];if(!gc||gc.key!==key){gc={key,c:renderGlobe(p,rpx*2,upE,gc&&gc.c)};globeCache[p.key]=gc}
      const sz=gc.c.width;ctx.drawImage(gc.c,X-sz/2,Y-sz/2,sz,sz);
      if(p.key==='Moon'&&rpx<40){const gg=ctx.createRadialGradient(X,Y,rpx,X,Y,rpx*3);gg.addColorStop(0,`rgba(230,235,255,${0.12*moonFrac})`);gg.addColorStop(1,'rgba(230,235,255,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.arc(X,Y,rpx*3,0,TAU);ctx.fill()}
    } else {
      const dm=Math.max(0.3,showLim-mag);const r=Math.min(10,0.8+0.5*Math.pow(dm,1.15));
      const g=ctx.createRadialGradient(X,Y,0,X,Y,r*3);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.25,p.col);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,r*3,0,TAU);ctx.fill();
    }
    hitObjs.push({x:X,y:Y,r:Math.max(12,rpx),kind:'planet',ref:p,prio:5});
    label(p.name,X,Y,'500 13px Jost, sans-serif','#f2cf86',Math.max(rpx,5)+4,-Math.max(rpx,5)-2,true);
  }
  // Galilean moons
  if(S.fov<3){
    for(const g of GALILEAN){const b=bodies[g.k];if(b.hidden)continue;projE(b.e,tmpO,tmpH);if(ground&&tmpH[2]<0)continue;const X=tmpO[0],Y=tmpO[1];
      ctx.fillStyle='#f4efe4';ctx.beginPath();ctx.arc(X,Y,1.6,0,TAU);ctx.fill();
      label(g.name,X,Y,'400 11.5px Jost, sans-serif','#d9c79a',4,-4);hitObjs.push({x:X,y:Y,r:9,kind:'gal',ref:g,prio:4})}
  }
}
function drawGround(){
  const day=S.layers.atmos?clamp((sunAltDeg+6)/12,0,1):0;
  groundPath();
  const top=Math.round(lerp(9,62,day)),mid=Math.round(lerp(6,44,day));
  const ga=S.ground===2?0.97:0.62;
  ctx.fillStyle=`rgba(${top},${Math.round(top*1.05)},${Math.round(top*0.9)},${ga})`;ctx.fill();
  if(S.ground===1){ // faint label so it's clear the area is underground
    const h=[Math.cos(S.az*DEG)*Math.cos(-30*DEG),-Math.sin(S.az*DEG)*Math.cos(-30*DEG),Math.sin(-30*DEG)];projH(h,tmpO);
    if(tmpO[2]>-0.3&&tmpO[1]>0&&tmpO[1]<H-60){ctx.font='italic 500 15px "Cormorant Garamond", Georgia, serif';ctx.textAlign='center';ctx.fillStyle='rgba(200,190,160,.35)';ctx.fillText('below your horizon',tmpO[0],tmpO[1]);ctx.textAlign='left'}
  }
  // horizon line glow
  const pts=[];for(let z=0;z<=360;z+=1)pts.push([Math.cos(z*DEG),-Math.sin(z*DEG),0]);
  polyline(pts,horToH,`rgba(${lerp(80,160,day)|0},${lerp(100,170,day)|0},${lerp(140,190,day)|0},.55)`,1.2,null,false);
}
function drawCardinals(){
  const names=['N','NE','E','SE','S','SW','W','NW'];
  for(let k=0;k<8;k++){const z=k*45*DEG;const h=[Math.cos(z),-Math.sin(z),0];projH(h,tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<0||X>W||Y<0||Y>H+10)continue;
    ctx.font=(k%2?'500 14px':'600 18px')+' Jost, sans-serif';ctx.textAlign='center';ctx.fillStyle=k===0?'#e9a77e':'#c9b98c';ctx.fillText(names[k],X,Math.min(H-6,Y+22));ctx.textAlign='left'}
}
function drawConNames(dark){
  ctx.globalAlpha=clamp(0.45+0.4*dark,0.45,0.85);
  for(const c of CONLAB){if(S.fov>130&&c.rank>2)continue;projE(c.v,tmpO,tmpH);if(behind(tmpO[2]))continue;if(S.ground===2&&tmpH[2]<0.02)continue;const X=tmpO[0],Y=tmpO[1];if(X<0||Y<0||X>W||Y>H)continue;
    ctx.font='italic 500 17px "Cormorant Garamond", Georgia, serif';const w=ctx.measureText(c.name).width;
    if(occTry(X-w/2,Y-12,w,14)){ctx.fillStyle='#8ea3cf';ctx.fillText(c.name,X-w/2,Y)}}
  ctx.globalAlpha=1;
}
function selVec(sel){
  if(sel.kind==='star')return[sx[sel.ref],sy[sel.ref],sz[sel.ref]];
  if(sel.kind==='dso')return[sel.ref.x,sel.ref.y,sel.ref.z3];
  if(sel.kind==='planet')return bodies[sel.ref.key].e;
  if(sel.kind==='gaia')return gaiaVec(sel.ref);
  if(sel.kind==='sb')return sbVec(sel.ref);
  if(sel.kind==='gal')return bodies[sel.ref.k].e;
  if(sel.kind==='con')return sel.ref.v;
  if(sel.kind==='sat')return sel.ref.h?hToEQJ(sel.ref.h):null;
  return null;
}
function drawReticle(sel){
  const v=selVec(sel);if(!v)return;projE(v,tmpO,tmpH);if(behind(tmpO[2]))return;const X=tmpO[0],Y=tmpO[1];
  let r=14;if(sel.kind==='planet'){r=Math.max(14,bodies[sel.ref.key].rad*scale*kOf(tmpO[2])+8)}if(sel.kind==='dso'&&sel.ref.maj){r=Math.max(14,Math.min(160,sel.ref.maj/60*DEG*scale*kOf(tmpO[2])/2+8))}
  ctx.strokeStyle='#d9b66c';ctx.lineWidth=1.5;ctx.beginPath();
  for(let k=0;k<4;k++){const a0=k*Math.PI/2+0.25,a1=a0+Math.PI/2-0.5;ctx.moveTo(X+r*Math.cos(a0),Y+r*Math.sin(a0));ctx.arc(X,Y,r,a0,a1)}ctx.stroke();
}

