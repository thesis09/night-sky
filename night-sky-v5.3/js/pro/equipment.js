"use strict";
/* ================= EQUIPMENT: telescope, eyepiece, camera, mosaic ================= */
const SCOPES=[['70/700 refractor',70,700],['80/480 ED refractor',80,480],['102/1300 Maksutov',102,1300],['114/900 Newtonian',114,900],['130/650 Newtonian',130,650],['150/750 Newtonian',150,750],['200/1200 Dobsonian',200,1200],['203/2032 Schmidt-Cassegrain (8")',203,2032],['250/1200 Dobsonian',250,1200],['300/1500 Dobsonian',300,1500],['Custom',0,0]];
const EYEPIECES=[['32 mm Plössl (52°)',32,52],['25 mm Plössl (52°)',25,52],['20 mm wide (68°)',20,68],['15 mm (52°)',15,52],['10 mm Plössl (52°)',10,52],['9 mm (66°)',9,66],['6 mm (66°)',6,66],['4 mm (58°)',4,58],['Custom',0,0]];
const CAMERAS=[['ZWO ASI533MC Pro',11.31,11.31,3.76],['ZWO ASI585MC',11.14,6.26,2.9],['ZWO ASI294MC Pro',19.1,13.0,4.63],['ZWO ASI2600MC Pro (APS-C)',23.5,15.7,3.76],['Canon APS-C DSLR (24 MP)',22.3,14.9,3.72],['Full-frame camera (24 MP)',36,24,5.95],['Custom',0,0,0]];
const EQ=Object.assign({scope:{name:SCOPES[6][0],ap:200,fl:1200},ep:{name:EYEPIECES[1][0],fl:25,afov:52},cam:{name:CAMERAS[0][0],w:11.31,h:11.31,px:3.76},barlow:1,overlay:'',rot:0,follow:true,mosaic:{rows:1,cols:1,overlap:15},seeing:2.0},store.get('eq',{}));
function eqSave(){store.set('eq',{scope:EQ.scope,ep:EQ.ep,cam:EQ.cam,barlow:EQ.barlow,overlay:EQ.overlay,rot:EQ.rot,follow:EQ.follow,mosaic:EQ.mosaic,seeing:EQ.seeing})}
function eqCalc(){
  const F=EQ.scope.fl*EQ.barlow,D=EQ.scope.ap;
  const mag=F/EQ.ep.fl,tfov=EQ.ep.afov/mag,exit=D/mag;
  const camW=2*Math.atan(EQ.cam.w/(2*F))*RAD,camH=2*Math.atan(EQ.cam.h/(2*F))*RAD,scaleAs=206.265*EQ.cam.px/F;
  return{F,D,fr:F/D,mag,tfov,exit,maxMag:2*D,minMag:D/7,lim:2.7+5*Math.log10(D),dawes:116/D,camW,camH,scaleAs};
}
function eqFrameFov(){const c=eqCalc();if(EQ.overlay==='eyepiece')return c.tfov;const m=EQ.mosaic;return Math.max(c.camW*(m.cols-(m.cols-1)*m.overlap/100),c.camH*(m.rows-(m.rows-1)*m.overlap/100))}
function toggleOverlay(){EQ.overlay=EQ.overlay==='eyepiece'?'camera':EQ.overlay==='camera'?'':'eyepiece';eqSave();refreshTab('equipment');requestRender();toast(EQ.overlay?(EQ.overlay==='eyepiece'?'Eyepiece view overlay':'Camera frame overlay'):'Overlay off')}
function opts(list,cur){return list.map((x,i)=>`<option value="${i}" ${x[0]===cur?'selected':''}>${escapeHtml(x[0])}</option>`).join('')}
function renderEquipment(el){
  const c=eqCalc();
  const exitNote=c.exit>7?'wider than a dark-adapted pupil (≈7 mm): some light is wasted':c.exit<0.5?'very small: the view will be dim and fuzzy':c.exit<1?'small: good for planets and double stars':c.exit<=2.5?'medium: good for planets, globulars and small nebulae':'large: bright, wide views of galaxies and big nebulae';
  const magNote=c.mag>c.maxMag?`<span class="warn">Above the useful maximum (~${Math.round(c.maxMag)}×): the image just gets blurrier.</span>`:c.mag<c.minMag?`<span class="warn">Below the minimum useful magnification (~${Math.round(c.minMag)}×).</span>`:'<span class="good">Within the telescope’s useful range.</span>';
  const samp=c.scaleAs;const ideal=[EQ.seeing/3,EQ.seeing/2];const sampNote=samp<ideal[0]?`<span class="warn">Oversampled for ${EQ.seeing}″ seeing: consider a focal reducer or 2×2 binning.</span>`:samp>ideal[1]*1.6?`<span class="warn">Undersampled for ${EQ.seeing}″ seeing: stars may look blocky; fine for wide fields.</span>`:`<span class="good">Well matched to ${EQ.seeing}″ seeing (ideal ≈ ${ideal[0].toFixed(2)}–${ideal[1].toFixed(2)}″/px).</span>`;
  const m=EQ.mosaic;
  el.innerHTML=`<h4>Telescope</h4>
  <div class="row2"><select id="eqScope" style="flex:1">${opts(SCOPES,EQ.scope.name)}</select></div>
  <div class="row2"><label class="f">Aperture (mm)<input type="number" id="eqAp" value="${EQ.scope.ap}" min="20" max="2000"></label><label class="f">Focal length (mm)<input type="number" id="eqFl" value="${EQ.scope.fl}" min="50" max="20000"></label>
  <label class="f">Barlow / reducer<select id="eqBar">${[0.5,0.63,0.7,0.8,1,1.5,2,2.5,3,5].map(b=>`<option ${b===EQ.barlow?'selected':''}>${b}</option>`).join('')}</select></label></div>
  <dl class="kv"><dt>Focal ratio</dt><dd>f/${c.fr.toFixed(1)}${EQ.barlow!==1?` (with ${EQ.barlow}×)`:''}</dd><dt>Faintest stars</dt><dd>about magnitude ${c.lim.toFixed(1)} under a dark sky</dd><dt>Resolution (Dawes)</dt><dd>${c.dawes.toFixed(2)}″ (two stars this close can be split)</dd><dt>Light grasp</dt><dd>${Math.round((c.D/7)**2).toLocaleString('en-US')}× the dark-adapted eye</dd></dl>
  <h4>Eyepiece</h4>
  <div class="row2"><select id="eqEp" style="flex:1">${opts(EYEPIECES,EQ.ep.name)}</select></div>
  <div class="row2"><label class="f">Focal length (mm)<input type="number" id="eqEpFl" value="${EQ.ep.fl}" min="2" max="60" step="0.5"></label><label class="f">Apparent field (°)<input type="number" id="eqEpAf" value="${EQ.ep.afov}" min="30" max="120"></label></div>
  <dl class="kv"><dt>Magnification</dt><dd>${c.mag.toFixed(0)}×</dd><dt>True field of view</dt><dd>${c.tfov>=1?c.tfov.toFixed(2)+'°':(c.tfov*60).toFixed(1)+'′'} (the full Moon is about 0.5°)</dd><dt>Exit pupil</dt><dd>${c.exit.toFixed(1)} mm, ${exitNote}</dd></dl>
  <div class="verdict">${magNote}</div>
  <h4>Camera</h4>
  <div class="row2"><select id="eqCam" style="flex:1">${opts(CAMERAS,EQ.cam.name)}</select></div>
  <div class="row2"><label class="f">Sensor width (mm)<input type="number" id="eqCw" value="${EQ.cam.w}" step="0.01"></label><label class="f">Height (mm)<input type="number" id="eqCh" value="${EQ.cam.h}" step="0.01"></label><label class="f">Pixel (µm)<input type="number" id="eqPx" value="${EQ.cam.px}" step="0.01"></label></div>
  <div class="row2"><label class="f">Your typical seeing (″)<input type="number" id="eqSee" value="${EQ.seeing}" step="0.1" min="0.5" max="6"></label><label class="f">Frame rotation (°)<input type="number" id="eqRot" value="${EQ.rot}" step="1" min="0" max="359"></label></div>
  <dl class="kv"><dt>Field of view</dt><dd>${c.camW>=1?c.camW.toFixed(2)+'°':(c.camW*60).toFixed(1)+'′'} × ${c.camH>=1?c.camH.toFixed(2)+'°':(c.camH*60).toFixed(1)+'′'}</dd><dt>Image scale</dt><dd>${c.scaleAs.toFixed(2)}″ per pixel</dd></dl>
  <div class="verdict">${sampNote}</div>
  <h4>Show on the sky</h4>
  <div class="row2"><span class="seg" id="eqOv">${[['','Off'],['eyepiece','Eyepiece view'],['camera','Camera frame']].map(([k,l])=>`<button data-o="${k}" class="${EQ.overlay===k?'on':''}">${l}</button>`).join('')}</span></div>
  <div class="row2"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px"><input type="checkbox" id="eqFollow" ${EQ.follow?'checked':''}> Centre on the selected object (otherwise the centre of view)</label></div>
  <div class="row2"><button class="btn" id="eqFrame">Frame the selected object</button></div>
  <h4>Mosaic planner</h4>
  <div class="row2"><label class="f">Columns<input type="number" id="eqMc" value="${m.cols}" min="1" max="10"></label><label class="f">Rows<input type="number" id="eqMr" value="${m.rows}" min="1" max="10"></label><label class="f">Overlap (%)<input type="number" id="eqMo" value="${m.overlap}" min="0" max="50"></label></div>
  <div class="muted">${m.rows*m.cols>1?`Covers about ${(c.camW*(m.cols-(m.cols-1)*m.overlap/100)).toFixed(2)}° × ${(c.camH*(m.rows-(m.rows-1)*m.overlap/100)).toFixed(2)}° in ${m.rows*m.cols} panels.`:'Set more than one row or column to plan a mosaic.'}</div>
  <div id="eqPanels"></div>`;
  const num=id=>parseFloat($(id).value);
  const upd=()=>{const ap0=EQ.scope.ap,fl0=EQ.scope.fl,ef0=EQ.ep.fl,ea0=EQ.ep.afov,cw0=EQ.cam.w,ch0=EQ.cam.h,px0=EQ.cam.px;EQ.scope.ap=num('eqAp')||EQ.scope.ap;EQ.scope.fl=num('eqFl')||EQ.scope.fl;EQ.barlow=num('eqBar')||1;EQ.ep.fl=num('eqEpFl')||EQ.ep.fl;EQ.ep.afov=num('eqEpAf')||EQ.ep.afov;
    EQ.cam.w=num('eqCw')||EQ.cam.w;EQ.cam.h=num('eqCh')||EQ.cam.h;EQ.cam.px=num('eqPx')||EQ.cam.px;EQ.seeing=num('eqSee')||EQ.seeing;EQ.rot=((num('eqRot')||0)%360+360)%360;
    EQ.mosaic={cols:clamp(Math.round(num('eqMc')||1),1,10),rows:clamp(Math.round(num('eqMr')||1),1,10),overlap:clamp(num('eqMo')||0,0,50)};
    if(EQ.scope.ap!==ap0||EQ.scope.fl!==fl0)EQ.scope.name='Custom';if(EQ.ep.fl!==ef0||EQ.ep.afov!==ea0)EQ.ep.name='Custom';if(EQ.cam.w!==cw0||EQ.cam.h!==ch0||EQ.cam.px!==px0)EQ.cam.name='Custom';eqSave();renderEquipment(el);requestRender()};
  ['eqAp','eqFl','eqEpFl','eqEpAf','eqCw','eqCh','eqPx','eqSee','eqRot','eqMc','eqMr','eqMo'].forEach(id=>$(id).addEventListener('change',upd));
  $('eqBar').onchange=upd;
  $('eqScope').onchange=e=>{const s=SCOPES[+e.target.value];EQ.scope={name:s[0],ap:s[1]||EQ.scope.ap,fl:s[2]||EQ.scope.fl};eqSave();renderEquipment(el);requestRender()};
  $('eqEp').onchange=e=>{const s=EYEPIECES[+e.target.value];EQ.ep={name:s[0],fl:s[1]||EQ.ep.fl,afov:s[2]||EQ.ep.afov};eqSave();renderEquipment(el);requestRender()};
  $('eqCam').onchange=e=>{const s=CAMERAS[+e.target.value];EQ.cam={name:s[0],w:s[1]||EQ.cam.w,h:s[2]||EQ.cam.h,px:s[3]||EQ.cam.px};eqSave();renderEquipment(el);requestRender()};
  el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{EQ.overlay=b.dataset.o;eqSave();renderEquipment(el);requestRender()});
  $('eqFollow').onchange=e=>{EQ.follow=e.target.checked;eqSave();requestRender()};
  $('eqFrame').onclick=()=>{if(!S.sel){toast('Select an object first');return}if(!EQ.overlay)EQ.overlay='camera';EQ.follow=true;eqSave();flyTo(S.sel,Math.max(0.15,eqFrameFov()*2.2));renderEquipment(el)};
  paintPanels();
}
function eqCenter(){if(EQ.follow&&S.sel){const v=selVec(S.sel);if(v)return v}return hToEQJ(cam.f)}
function eqBasis(c){let E=normV(crossV([0,0,1],c));if(!isFinite(E[0])||Math.hypot(...crossV([0,0,1],c))<1e-6)E=[1,0,0];const Nn=crossV(c,E);const t=EQ.rot*DEG;
  return{U:[0,1,2].map(i=>Nn[i]*Math.cos(t)+E[i]*Math.sin(t)),Rr:[0,1,2].map(i=>E[i]*Math.cos(t)-Nn[i]*Math.sin(t))}}
function tanToVec(c,b,x,y){return normV([c[0]+x*b.Rr[0]+y*b.U[0],c[1]+x*b.Rr[1]+y*b.U[1],c[2]+x*b.Rr[2]+y*b.U[2]])}
function mosaicPanels(){
  const c=eqCenter();const b=eqBasis(c);const k=eqCalc();const m=EQ.mosaic;
  const w=Math.tan(k.camW*DEG/2)*2,h=Math.tan(k.camH*DEG/2)*2;const sx=w*(1-m.overlap/100),sy=h*(1-m.overlap/100);
  const out=[];let n=1;
  for(let r=0;r<m.rows;r++)for(let q=0;q<m.cols;q++){const x=(q-(m.cols-1)/2)*sx,y=((m.rows-1)/2-r)*sy;const v=tanToVec(c,b,x,y);const rd=vecRaDec(v);
    const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,bb])=>[x+a,y+bb]);out.push({n:n++,x,y,v,ra:rd.ra,dec:rd.dec,corners})}
  return{c,b,panels:out};
}
function drawEquipment(){
  if(!EQ.overlay)return;const c=eqCenter();const b=eqBasis(c);const k=eqCalc();
  ctx.save();ctx.strokeStyle='rgba(217,182,108,.9)';ctx.lineWidth=1.5;
  const path=(pts)=>{ctx.beginPath();let pen=false;for(const v of pts){projE(v,tmpO,tmpH);if(behind(tmpO[2])){pen=false;continue}pen?ctx.lineTo(tmpO[0],tmpO[1]):ctx.moveTo(tmpO[0],tmpO[1]);pen=true}ctx.stroke()};
  if(EQ.overlay==='eyepiece'){const r=Math.tan(k.tfov/2*DEG);const pts=[];for(let a=0;a<=360;a+=3)pts.push(tanToVec(c,b,r*Math.cos(a*DEG),r*Math.sin(a*DEG)));path(pts);
    const lp=tanToVec(c,b,0,r*1.04);projE(lp,tmpO,tmpH);if(!behind(tmpO[2]))label(`${k.mag.toFixed(0)}× · ${k.tfov>=1?k.tfov.toFixed(2)+'°':(k.tfov*60).toFixed(1)+'′'} field`,tmpO[0],tmpO[1],'500 12px Jost, sans-serif','#d9b66c',-40,-6,true)}
  else{const M2=mosaicPanels();
    for(const p of M2.panels){const pts=[];const cs=p.corners;for(let e=0;e<4;e++){const a=cs[e],bb=cs[(e+1)%4];for(let t=0;t<=1.0001;t+=0.1)pts.push(tanToVec(M2.c,M2.b,a[0]+(bb[0]-a[0])*t,a[1]+(bb[1]-a[1])*t))}path(pts);
      if(M2.panels.length>1){projE(p.v,tmpO,tmpH);if(!behind(tmpO[2])){ctx.font='600 12px Jost, sans-serif';ctx.fillStyle='rgba(217,182,108,.9)';ctx.textAlign='center';ctx.fillText(String(p.n),tmpO[0],tmpO[1]+4);ctx.textAlign='left'}}}
    // "up" tick on the first panel shows frame orientation
    const top=tanToVec(M2.c,M2.b,0,Math.tan(k.camH*DEG/2)*M2.panels.length**0.5);projE(top,tmpO,tmpH);
    if(!behind(tmpO[2]))label(`${EQ.cam.name} · ${(k.camW).toFixed(2)}° × ${(k.camH).toFixed(2)}°`,tmpO[0],tmpO[1],'500 12px Jost, sans-serif','#d9b66c',-60,-8,true)}
  ctx.restore();
}
function paintPanels(){
  const el=$('eqPanels');if(!el)return;const m=EQ.mosaic;if(m.rows*m.cols<2){el.innerHTML='';return}
  const P=mosaicPanels().panels;
  el.innerHTML=`<table><tr><th>#</th><th>RA (J2000)</th><th>Dec (J2000)</th></tr>${P.map(p=>`<tr><td>${p.n}</td><td>${fmtRA(p.ra).replace(/\.\ds/,'s')}</td><td>${fmtDec(p.dec)}</td></tr>`).join('')}</table>
  <div class="row2" style="margin-top:8px"><button class="btn" id="eqCopy">Copy as CSV</button><button class="btn" id="eqDl">Download CSV</button></div>`;
  const csv=()=>'panel,ra_deg,dec_deg,ra_hms,dec_dms\n'+P.map(p=>`${p.n},${(p.ra*15).toFixed(5)},${p.dec.toFixed(5)},"${fmtRA(p.ra)}","${fmtDec(p.dec)}"`).join('\n');
  $('eqCopy').onclick=async()=>{try{await navigator.clipboard.writeText(csv());toast('Copied panel coordinates')}catch(e){toast('Copy failed: your browser blocked the clipboard')}};
  $('eqDl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv()],{type:'text/csv'}));a.download='mosaic-panels.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
}
registerTab('equipment','Equipment',renderEquipment);
// keep the panel list and the altitude chart in step with the selection
const _showInfoBase=showInfo;
showInfo=function(sel){_showInfoBase(sel);if(PRO.on&&PRO.tab==='tonight'&&$('plChart')){drawPlanChart(nightInfo());if($('plPinSel'))$('plPinSel').disabled=!selKey(sel)}if(PRO.on&&PRO.tab==='equipment')paintPanels();if(EQ.overlay)requestRender()};
