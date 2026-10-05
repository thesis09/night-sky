"use strict";
/* ================= START ================= */
async function start(){
  makeSprites();buildIndex();
  await Promise.all([loadMW(),loadPlanetTex(),document.fonts&&document.fonts.load?Promise.race([Promise.all([document.fonts.load('400 12px Jost'),document.fonts.load('italic 500 17px "Cormorant Garamond"')]),new Promise(r=>setTimeout(r,1500))]):0]);
  obsA=new A.Observer(S.obs.lat,S.obs.lon,S.obs.elev||0);
  updateAstro(true);
  initGL();
  // start looking toward the most interesting direction: the brightest planet above horizon or south
  S.az=S.obs.lat>=0?180:0;S.alt=window.innerHeight>window.innerWidth?50:35;
  resize();updateClock();
  $('loading').style.display='none';
  appReady=true;requestRender();
  refreshLayerStatus();if(S.layers.sats)loadSats();if(S.layers.exo)loadExo();if(S.layers.starlink)loadStarlink();
  setPro(proWanted());
  if(GL.ok)gaiaLoadIndex();
  window.__sky={PRO,EQ,setPro,openTab,openPalette,GL,frames:()=>framesDrawn,objAltAz,selVec,testCam:()=>{S.camera=true;PROJ='gnomo';S.fov=34;requestRender()},startSensor,sensor,alignOn,calib:()=>calib,S,bodies,render,showInfo,flyTo,DSO,named,setTime,setObs,starName};
}
start();
