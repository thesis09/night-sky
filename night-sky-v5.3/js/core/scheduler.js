"use strict";
/* ================= FRAME SCHEDULING (battery-friendly) =================
   Nothing is drawn unless something changed: user input, a sensor movement, an animation,
   or the sky having turned far enough (on screen) since the last frame. */
let lastRenderSim=0,lastRenderReal=0,framesDrawn=0;
function frame(now){
  rafPending=false;
  const dt=now-S.lastReal;S.lastReal=now;
  let keepGoing=false;
  if(S.live)S.simMs=Date.now();
  else if(S.rate!==1){S.simMs+=Math.min(dt,250)*S.rate;needRender=true;keepGoing=true}
  if(anim){stepAnim(now);keepGoing=true}
  const covered=(typeof S3!=='undefined'&&S3.open)||(typeof SV!=='undefined'&&SV.open); // a full-screen view hides the sky: skip drawing it
  if(needRender&&!covered){needRender=false;render();framesDrawn++;lastRenderSim=S.simMs;lastRenderReal=now}
  if(keepGoing)scheduleFrame();
}
// how long until the sky moves ~0.4 px on screen at the current zoom (sidereal rate ≈ 0.0042°/s)
function idleInterval(){const pxPerDeg=scale*DEG*(PROJ==='gnomo'?1:1);const pxPerSec=Math.max(1e-6,pxPerDeg*0.004178);return clamp(0.4/pxPerSec*1000,1000,30000)}
let satsOnScreen=false;
setInterval(()=>{ // 1 Hz housekeeping: clock text, live time, idle redraws
  if(document.hidden)return;
  if(S.live)S.simMs=Date.now();
  const before=astroKey;updateAstro();if(astroKey!==before)updateClock();
  if(S.live&&(S.simMs-lastRenderSim)>=idleInterval())requestRender();
},1000);
setInterval(()=>{ // satellites move fast: 4 Hz, but only while one is actually on screen
  if(document.hidden||!S.layers.sats||!satsOnScreen)return;if(S.live||S.rate!==1){if(S.live)S.simMs=Date.now();requestRender()}
},250);
setInterval(()=>{if(!document.hidden&&S.sel)refreshInfoLive()},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){S.lastReal=performance.now();if(S.live)S.simMs=Date.now();requestRender()}});

