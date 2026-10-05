"use strict";
/* ================= HUD: horizon scale, compass tape, altitude ladder, sky map ================= */
let HUD=null;
function hudLayout(){
  const app=$('stage').getBoundingClientRect();const bt=$('bottom').getBoundingClientRect().top-app.top;
  const mobile=W<720;
  const tw=Math.min(640,W-20),th=42;
  const tape={x:(W-tw)/2,y:bt-th-30,w:tw,h:th};
  const Rm=mobile?40:58;
  const mm=mobile?{cx:W-Rm*1.33-10,cy:tape.y-Rm*1.33-14,r:Rm}:{cx:16+Rm*1.33,cy:tape.y-Rm*1.33-16,r:Rm};
  const lh=Math.min(300,H*0.4);
  let ly0=H/2-lh/2;
  const lyMax=(mobile?tape.y-20:mm.cy-Rm*1.33-20)-lh;ly0=Math.min(ly0,lyMax);ly0=Math.max(ly0,mobile?210:120);
  const ladder={x:mobile?6:14,y:ly0,w:44,h:Math.min(lh,(mobile?tape.y-20:mm.cy-Rm*1.33-20)-ly0)};
  HUD={tape,mm,ladder,mobile};
}
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function selName(sel){if(!sel)return'';if(sel.kind==='star')return starName(sel.ref)||('HIP '+sHip[sel.ref]);if(sel.kind==='dso')return sel.ref.common[0]||(sel.ref.M?'M'+sel.ref.M:sel.ref.id);if(sel.kind==='planet')return sel.ref.name;if(sel.kind==='gal')return sel.ref.name;if(sel.kind==='con')return sel.ref.name;if(sel.kind==='sb')return sel.ref.name;if(sel.kind==='gaia'){const T=GAIA.tiles.get(sel.ref.f);return T?'Gaia DR3 '+T.ids[sel.ref.k]:'Gaia star'}return''}
function viewAzAlt(){return{az:((S.az%360)+360)%360,alt:S.alt}}
function drawHorizonScale(){
  const step=S.fov<12?1:S.fov<45?2:5;
  ctx.lineWidth=1;ctx.textAlign='center';
  const up=[0,0,0];
  for(let d=0;d<360;d+=step){
    const z=d*DEG;projH([Math.cos(z),-Math.sin(z),0],tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<-5||X>W+5||Y<-5||Y>H+5)continue;
    const ea=0.4*DEG;projH([Math.cos(z)*Math.cos(ea),-Math.sin(z)*Math.cos(ea),Math.sin(ea)],up);let ux=up[0]-X,uy=up[1]-Y;const ul=Math.hypot(ux,uy)||1;ux/=ul;uy/=ul;
    const major=d%10===0,mid=d%5===0;const len=d%45===0?12:major?8:mid?5:3;
    ctx.strokeStyle=d%45===0?'rgba(230,215,170,.8)':'rgba(220,210,180,.45)';ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(X+ux*len,Y+uy*len);ctx.stroke();
    const labEvery=S.fov<12?5:S.fov<45?10:30;
    if(d%labEvery===0&&d%45!==0){ctx.font='400 11px Jost, sans-serif';ctx.fillStyle='rgba(220,210,180,.7)';ctx.fillText(d+'°',X-ux*13,Y-uy*13+4)}
  }
  ctx.textAlign='left';
}
function drawTape(t,az,target){
  ctx.save();rrect(t.x,t.y,t.w,t.h,12);ctx.fillStyle='rgba(12,16,32,.74)';ctx.fill();ctx.strokeStyle='rgba(150,170,215,.18)';ctx.lineWidth=1;ctx.stroke();ctx.clip();
  const span=clamp(S.fov*1.15,40,200),ppd=t.w/span,cx=t.x+t.w/2;
  const lstep=ppd>7?10:ppd>2.4?30:45;
  ctx.textAlign='center';
  for(let d=Math.floor((az-span/2)/5)*5;d<=az+span/2+5;d+=5){
    const x=cx+(d-az)*ppd;const dn=((d%360)+360)%360;const major=dn%45===0,ten=dn%10===0;
    const len=major?13:ten?8:4;
    ctx.strokeStyle=major?'rgba(236,230,214,.9)':'rgba(236,230,214,.38)';ctx.lineWidth=major?1.6:1;
    ctx.beginPath();ctx.moveTo(x,t.y+t.h);ctx.lineTo(x,t.y+t.h-len);ctx.stroke();
    let lab=null;if(major)lab=COMPASS[dn/22.5];else if(dn%lstep===0)lab=dn+'°';
    if(lab){ctx.font=(major?'600 14px':'400 11px')+' Jost, sans-serif';ctx.fillStyle=major?(dn===0?'#f0a77a':'#ece6d6'):'rgba(236,230,214,.6)';ctx.fillText(lab,x,t.y+t.h-(major?17:13))}
  }
  if(target){let d=target.az-az;d=((d+540)%360)-180;const x=cx+d*ppd;ctx.fillStyle='#d9b66c';
    if(Math.abs(d)<=span/2-4){ctx.beginPath();ctx.moveTo(x,t.y+2);ctx.lineTo(x+5,t.y+8);ctx.lineTo(x,t.y+14);ctx.lineTo(x-5,t.y+8);ctx.closePath();ctx.fill()}
    else{const left=d<0,ex=left?t.x+12:t.x+t.w-12;ctx.beginPath();ctx.moveTo(ex+(left?-6:6),t.y+9);ctx.lineTo(ex+(left?4:-4),t.y+3);ctx.lineTo(ex+(left?4:-4),t.y+15);ctx.closePath();ctx.fill()}}
  ctx.restore();
  // centre needle
  ctx.strokeStyle='#d9b66c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,t.y+3);ctx.lineTo(cx,t.y+t.h-1);ctx.stroke();
  // readout bubble
  const txt=`Facing ${compassW(az)} · ${az.toFixed(1)}°`;ctx.font='500 14px Jost, sans-serif';const w=ctx.measureText(txt).width+22;
  rrect(cx-w/2,t.y-27,w,23,11.5);ctx.fillStyle='rgba(12,16,32,.82)';ctx.fill();ctx.strokeStyle='rgba(217,182,108,.45)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#ece6d6';ctx.textAlign='center';ctx.fillText(txt,cx,t.y-10.5);ctx.textAlign='left';
}
function drawLadder(l,alt,target){
  if(l.h<80)return;
  ctx.save();rrect(l.x,l.y,l.w,l.h,12);ctx.fillStyle='rgba(12,16,32,.74)';ctx.fill();ctx.strokeStyle='rgba(150,170,215,.18)';ctx.lineWidth=1;ctx.stroke();ctx.clip();
  const span=clamp(S.fov*1.15,30,190),ppd=l.h/span,cy=l.y+l.h/2;
  const y0=cy+alt*ppd; // horizon y
  if(y0<l.y+l.h){ctx.fillStyle='rgba(70,62,40,.35)';ctx.fillRect(l.x,Math.max(l.y,y0),l.w,l.y+l.h-Math.max(l.y,y0))}
  const lstep=ppd>3?10:30;
  ctx.textAlign='left';
  for(let d=Math.ceil((alt-span/2)/5)*5;d<=alt+span/2;d+=5){
    if(d<-90||d>90)continue;const y=cy-(d-alt)*ppd;const ten=d%10===0;
    ctx.strokeStyle=d===0?'rgba(200,215,170,.95)':ten?'rgba(236,230,214,.5)':'rgba(236,230,214,.25)';ctx.lineWidth=d===0?1.6:1;
    ctx.beginPath();ctx.moveTo(l.x+l.w,y);ctx.lineTo(l.x+l.w-(d===0?l.w:ten?9:5),y);ctx.stroke();
    if(d%lstep===0){ctx.font='400 10.5px Jost, sans-serif';ctx.fillStyle=d===0?'#cfdcae':'rgba(236,230,214,.6)';ctx.fillText(d===90?'zen':d===0?'hor':(d>0?d:'−'+(-d))+'°',l.x+4,y+(d===0?-3:3.5))}
  }
  if(target){const d=target.alt;const y=cy-(d-alt)*ppd;ctx.fillStyle='#d9b66c';
    if(y>l.y+6&&y<l.y+l.h-6){ctx.beginPath();ctx.moveTo(l.x+l.w-14,y);ctx.lineTo(l.x+l.w-8,y-5);ctx.lineTo(l.x+l.w-2,y);ctx.lineTo(l.x+l.w-8,y+5);ctx.closePath();ctx.fill()}
    else{const top=y<=l.y+6;const yy=top?l.y+8:l.y+l.h-8;ctx.beginPath();ctx.moveTo(l.x+l.w/2,yy+(top?-5:5));ctx.lineTo(l.x+l.w/2-6,yy+(top?4:-4));ctx.lineTo(l.x+l.w/2+6,yy+(top?4:-4));ctx.closePath();ctx.fill()}}
  ctx.restore();
  ctx.strokeStyle='#d9b66c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(l.x+2,cy);ctx.lineTo(l.x+l.w-2,cy);ctx.stroke();
  const txt=alt>=0.05?`${alt.toFixed(1)}° up`:alt<=-0.05?`${(-alt).toFixed(1)}° below horizon`:'at the horizon';
  ctx.font='500 13px Jost, sans-serif';const w=ctx.measureText(txt).width+18;
  rrect(l.x+l.w+6,cy-11,w,22,11);ctx.fillStyle='rgba(12,16,32,.82)';ctx.fill();ctx.strokeStyle='rgba(217,182,108,.45)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#ece6d6';ctx.fillText(txt,l.x+l.w+15,cy+4.5);
}
function mmPos(m,az,alt){const r=m.r*clamp((90-alt)/90,0,1.33);const a=(az-S.az)*DEG;return[m.cx+r*Math.sin(a),m.cy-r*Math.cos(a)]}
function drawMiniMap(m,target){
  const R1=m.r*1.33;
  ctx.save();ctx.beginPath();ctx.arc(m.cx,m.cy,R1,0,TAU);ctx.fillStyle='rgba(12,16,32,.78)';ctx.fill();ctx.strokeStyle='rgba(150,170,215,.2)';ctx.lineWidth=1;ctx.stroke();ctx.clip();
  // below-horizon ring
  ctx.beginPath();ctx.arc(m.cx,m.cy,R1,0,TAU);ctx.arc(m.cx,m.cy,m.r,0,TAU,true);ctx.fillStyle='rgba(70,62,40,.38)';ctx.fill('evenodd');
  ctx.strokeStyle='rgba(200,215,170,.7)';ctx.beginPath();ctx.arc(m.cx,m.cy,m.r,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(236,230,214,.14)';for(const a of[30,60]){ctx.beginPath();ctx.arc(m.cx,m.cy,m.r*(90-a)/90,0,TAU);ctx.stroke()}
  // field of view wedge (heading-up: always points up)
  const hf=clamp(S.fov*Math.max(W,H)/Math.min(W,H)/2,2,170)*DEG*0.5*2/2;
  const halfH=Math.min(Math.PI*0.98,clamp(S.fov*(W/Math.min(W,H))/2,1,179)*DEG);
  ctx.beginPath();ctx.moveTo(m.cx,m.cy);ctx.arc(m.cx,m.cy,R1,-Math.PI/2-halfH,-Math.PI/2+halfH);ctx.closePath();ctx.fillStyle='rgba(217,182,108,.13)';ctx.fill();
  // cardinal letters
  ctx.font='600 11px Jost, sans-serif';ctx.textAlign='center';
  for(const [lab,az] of[['N',0],['E',90],['S',180],['W',270]]){const a=(az-S.az)*DEG;const r=R1-8;ctx.fillStyle=lab==='N'?'#f0a77a':'rgba(236,230,214,.75)';ctx.fillText(lab,m.cx+r*Math.sin(a),m.cy-r*Math.cos(a)+4)}
  // bodies
  const dot=(v,col,rad)=>{const a=objAltAz(v);if(a.alt<-30)return;const p=mmPos(m,a.az,a.alt);ctx.fillStyle=col;ctx.beginPath();ctx.arc(p[0],p[1],rad,0,TAU);ctx.fill()};
  for(const p of PLANETS){if(p.key==='Pluto'||p.key==='Neptune'||p.key==='Uranus')continue;const b=bodies[p.key];dot(b.e,p.key==='Sun'?'#ffd36b':p.key==='Moon'?'#f4f1e8':'#e7c27a',p.key==='Sun'?4:p.key==='Moon'?3.5:2)}
  // view centre
  const vc=mmPos(m,S.az,S.alt);ctx.strokeStyle='#d9b66c';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(vc[0]-4,vc[1]);ctx.lineTo(vc[0]+4,vc[1]);ctx.moveTo(vc[0],vc[1]-4);ctx.lineTo(vc[0],vc[1]+4);ctx.stroke();
  if(target){const p=mmPos(m,target.az,Math.max(target.alt,-30));ctx.strokeStyle='#d9b66c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],4.5,0,TAU);ctx.stroke()}
  ctx.restore();ctx.textAlign='left';
  ctx.font='400 10.5px Jost, sans-serif';ctx.fillStyle='rgba(200,195,180,.6)';ctx.textAlign='center';ctx.fillText('your sky · you face up',m.cx,m.cy+R1+12);ctx.textAlign='left';
}
function drawCrosshair(){const g=5,l=9;ctx.strokeStyle='rgba(236,230,214,.55)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(CX-g-l,CY);ctx.lineTo(CX-g,CY);ctx.moveTo(CX+g,CY);ctx.lineTo(CX+g+l,CY);ctx.moveTo(CX,CY-g-l);ctx.lineTo(CX,CY-g);ctx.moveTo(CX,CY+g);ctx.lineTo(CX,CY+g+l);ctx.stroke()}
function drawTargetArrow(target){
  if(!target)return;const v=selVec(S.sel);projE(v,tmpO,tmpH);
  const on=tmpO[2]>-0.3&&tmpO[0]>30&&tmpO[0]<W-30&&tmpO[1]>30&&tmpO[1]<H-30;if(on)return;
  let dAz=target.az-S.az;dAz=((dAz+540)%360)-180;const dAlt=target.alt-S.alt;
  const dx=dAz*Math.cos(clamp((target.alt+S.alt)/2,-80,80)*DEG),dy=-dAlt;const ang=Math.atan2(dy,dx);
  const rx=W/2-90,ry=H/2-120;const ex=clamp(CX+Math.cos(ang)*rx,90,W-90),ey=clamp(CY+Math.sin(ang)*ry,HUD.mobile?230:130,Math.min(HUD.tape.y-60,HUD.mm.cy-HUD.mm.r*1.33-34));
  ctx.save();ctx.translate(ex,ey);ctx.rotate(ang);ctx.fillStyle='#d9b66c';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-6,-10);ctx.lineTo(-1,0);ctx.lineTo(-6,10);ctx.closePath();ctx.fill();ctx.restore();
  const parts=[];if(Math.abs(dAz)>=150)parts.push(`turn around (${Math.abs(dAz).toFixed(0)}° ${dAz>0?'right':'left'})`);else if(Math.abs(dAz)>=1)parts.push(`turn ${dAz>0?'right':'left'} ${Math.abs(dAz).toFixed(0)}°`);if(Math.abs(dAlt)>=1)parts.push(`look ${dAlt>0?'up':'down'} ${Math.abs(dAlt).toFixed(0)}°`);
  const txt=selName(S.sel)+(parts.length?': '+parts.join(', '):'')+(target.alt<0?' (below horizon)':'');
  ctx.font='500 13px Jost, sans-serif';const w=ctx.measureText(txt).width+18;let tx=clamp(ex-w/2-Math.cos(ang)*40,8,W-w-8),ty=clamp(ey-11-Math.sin(ang)*30,8,H-30);
  rrect(tx,ty,w,22,11);ctx.fillStyle='rgba(12,16,32,.85)';ctx.fill();ctx.strokeStyle='rgba(217,182,108,.5)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#ece6d6';ctx.fillText(txt,tx+9,ty+15.5);
}
function drawHUD(){
  hudLayout();const va=viewAzAlt();const target=S.sel?objAltAz(selVec(S.sel)):null;
  drawCrosshair();drawTargetArrow(target);
  drawLadder(HUD.ladder,va.alt,target);drawMiniMap(HUD.mm,target);drawTape(HUD.tape,va.az,target);
}
function animTo(az,alt,fov){scheduleFrame();let dAz=az-S.az;dAz=((dAz+540)%360)-180;anim={t0:performance.now(),dur:600,az0:S.az,alt0:S.alt,fov0:S.fov,dAz,alt1:clamp(alt,-89.5,89.5),fov1:fov||S.fov};requestRender()}
function hudHit(x,y){
  if(!S.hud||!HUD)return false;const t=HUD.tape,l=HUD.ladder,m=HUD.mm;
  if(x>=t.x&&x<=t.x+t.w&&y>=t.y-28&&y<=t.y+t.h){const span=clamp(S.fov*1.15,40,200);animTo(S.az+(x-(t.x+t.w/2))*span/t.w,S.alt);return true}
  if(x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h){const span=clamp(S.fov*1.15,30,190);animTo(S.az,S.alt-(y-(l.y+l.h/2))*span/l.h);return true}
  const dx=x-m.cx,dy=y-m.cy,r=Math.hypot(dx,dy);if(r<=m.r*1.33){const az=S.az+Math.atan2(dx,-dy)*RAD,alt=90-r/m.r*90;animTo(az,clamp(alt,-30,89),null);return true}
  return false;
}
function overHud(x,y){if(!S.hud||!HUD)return false;const t=HUD.tape,l=HUD.ladder,m=HUD.mm;return (x>=t.x&&x<=t.x+t.w&&y>=t.y-28&&y<=t.y+t.h)||(x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h)||Math.hypot(x-m.cx,y-m.cy)<=m.r*1.33}

