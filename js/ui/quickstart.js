"use strict";
/* ================= QUICK START GUIDE =================
   Shown automatically on a first visit, and any time from the "Guide" button or the command palette.
   Each step can spotlight a real control on screen. Self-contained: adds its own styles and button. */
const QS={i:0,steps:[],open:false};
(function qsSetup(){
  const st=document.createElement('style');
  st.textContent=`#qsLayer{position:fixed;inset:0;z-index:80;pointer-events:none}
  #qsShade{position:fixed;inset:0;background:rgba(3,5,12,.62);pointer-events:auto}
  #qsSpot{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(3,5,12,.62),0 0 0 2px #d9b66c;pointer-events:none;transition:all .25s ease}
  #qsCard{position:fixed;width:min(380px,calc(100vw - 24px));background:rgba(12,16,32,.97);border:1px solid rgba(217,182,108,.45);border-radius:16px;padding:16px 18px 14px;pointer-events:auto;box-shadow:0 18px 50px rgba(0,0,0,.5)}
  #qsCard h3{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:500;font-size:24px;margin:0 0 6px;color:#ece6d6}
  #qsCard p{font-size:14.5px;line-height:1.55;color:#ddd6c4;margin:0 0 8px}
  #qsCard p b{color:#ece6d6;font-weight:500}
  #qsCard .qsfoot{display:flex;align-items:center;gap:8px;margin-top:10px}
  #qsCard .qsdots{flex:1;display:flex;gap:4px;flex-wrap:wrap}
  #qsCard .qsdots i{width:6px;height:6px;border-radius:50%;background:rgba(236,230,214,.25)}
  #qsCard .qsdots i.on{background:#d9b66c}
  #qsCard button{font:inherit;font-size:13.5px;border-radius:10px;padding:7px 12px;border:1px solid rgba(150,170,215,.25);background:rgba(255,255,255,.06);color:#ece6d6;cursor:pointer}
  #qsCard button.primary{border-color:rgba(217,182,108,.5);color:#d9b66c}
  #qsCard .qsskip{background:none;border:0;color:#97a1b7;padding:7px 4px}
  #qsCard kbd{font-family:inherit;font-size:12px;background:rgba(255,255,255,.08);border:1px solid rgba(150,170,215,.25);border-bottom-width:2px;border-radius:6px;padding:0 6px}`;
  document.head.appendChild(st);
  // "Guide" button next to Red light
  const red=$('redBtn');if(red){const b=document.createElement('button');b.id='guideBtn';b.title='Quick start guide';b.textContent='Guide';red.parentNode.insertBefore(b,red);b.onclick=()=>openQuickStart()}
})();
function qsIsDesktop(){return typeof PRO!=='undefined'&&PRO.on}
function qsBuildSteps(){
  const desk=qsIsDesktop(),touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
  const s=[
    {t:'Welcome to Night Sky',p:`This is the <b>real sky above you, right now</b>: 119,000 stars, the planets, the Moon, galaxies, nebulae and satellites, all calculated live for your location.<br>This quick tour takes about a minute.`},
    {t:'1 · Set your location',el:'#where',p:`Tap this card to choose a city, type your coordinates, or use <b>your device’s location</b>. It also shows the time, whether it’s dark, and the Moon’s phase. You can jump to any date and time here too.`},
    {t:'2 · Look around',p:`${touch?'<b>Drag</b> to look around and <b>pinch</b> to zoom.':'<b>Drag</b> to look around and <b>scroll</b> to zoom.'} Zoom in and fainter stars, galaxies and real telescope photos appear.<br><b>${touch?'Tap':'Click'} anything</b> to open its details: where to look, rise and set times, photos, NASA material and the astrophysics behind it.`},
    {t:'3 · Find anything',el:'#searchWrap',p:`Search by name or catalogue number: <b>Jupiter</b>, <b>M42</b>, <b>Andromeda</b>, <b>ISS</b>, <b>Ceres</b>, even Indian names like <b>Dhruva</b> or <b>Rohini</b>. The view swings to it and the details open.`},
    {t:'4 · Know where you are looking',p:`The <b>compass strip</b> at the bottom shows which way you face, the <b>scale on the left</b> shows how high you look, and the <b>round map</b> shows your whole sky with your view always at the top.<br>If your selected object is off-screen, a <b>brass arrow</b> tells you which way to turn.`},
    {t:'5 · Move through time',el:'#bar .group',p:`Step an hour or a day, press <b>Now</b> to return to live time, or use <b>Live speed</b> to fast-forward and watch the sky turn.`},
    {t:'6 · What can I see now?',el:'#upBtn',p:`<b>Up now</b> lists the planets, bright stars, binocular targets and satellites in your sky at this moment, plus the next visible ISS passes.`},
    {t:'7 · Make it match your sky',el:'#layersBtn',p:`In <b>Layers</b>, set your <b>light pollution</b> (city, suburb, dark site) so the chart shows what your eyes can really see. You can also switch constellation lines, the Milky Way, photos, satellites and grids on or off.`}];
  if(touch&&$('gyroBtn')&&!$('gyroBtn').hidden)s.push({t:'8 · Point your phone at the sky',el:'#gyroBtn',p:`Tap <b>Phone compass</b> and hold your phone up: the chart follows where you point. <b>Camera</b> draws it over your live camera view.<br>Compasses are a few degrees off, so tap <b>Align</b>, aim the crosshair at a bright star you can see, and tap that star on the chart to correct it.`});
  if(desk)s.push(
    {t:'Your desktop workspace',el:'#dock',p:`On a computer you get tools on the left: <b>Tonight</b> (best targets and an altitude chart), <b>Equipment</b> (telescope and camera views), <b>Surveys</b> (the sky in 11 wavelengths), <b>Lab</b> (HR diagram, light curves, spectra), <b>Events</b> (eclipses, conjunctions, meteor showers) and <b>3D</b> (solar system and nearby stars).`},
    {t:'Keyboard power',p:`Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the <b>command palette</b>: type anything, like “best targets”, “survey infrared” or “M31”. Press <kbd>?</kbd> for all shortcuts. A few favourites: <kbd>N</kbd> live time, <kbd>[</kbd> <kbd>]</kbd> ±1 hour, <kbd>W</kbd> surveys, <kbd>D</kbd> 3D.`});
  s.push({t:'Clear skies!',el:'#guideBtn',p:`Try this first: ${desk?'open <b>Tonight → Find the best targets</b> and click the top result':'tap <b>Up now</b> and pick the brightest planet'}. Use <b>Red light</b> outdoors so your eyes stay adapted to the dark.<br>You can reopen this guide any time with the <b>Guide</b> button.`});
  return s;
}
function openQuickStart(){
  if(QS.open)return;QS.steps=qsBuildSteps();QS.i=0;QS.open=true;
  if(typeof closeSheets==='function')closeSheets();
  const L=document.createElement('div');L.id='qsLayer';L.innerHTML='<div id="qsShade"></div><div id="qsSpot" hidden></div><div id="qsCard" role="dialog" aria-modal="true" aria-labelledby="qsTitle"></div>';document.body.appendChild(L);
  $('qsShade').onclick=()=>{};qsRender();window.addEventListener('resize',qsPlace);window.addEventListener('keydown',qsKeys,true);
}
function closeQuickStart(){if(!QS.open)return;QS.open=false;const L=$('qsLayer');if(L)L.remove();window.removeEventListener('resize',qsPlace);window.removeEventListener('keydown',qsKeys,true);store.set('qs.done',true)}
function qsKeys(e){if(!QS.open)return;if(e.key==='Escape'){closeQuickStart()}else if(e.key==='ArrowRight'||e.key==='Enter'){qsGo(1)}else if(e.key==='ArrowLeft'){qsGo(-1)}else return;e.preventDefault();e.stopPropagation()}
function qsGo(d){const n=QS.i+d;if(n<0)return;if(n>=QS.steps.length){closeQuickStart();return}QS.i=n;qsRender()}
function qsRender(){
  const st=QS.steps[QS.i],last=QS.i===QS.steps.length-1;
  $('qsCard').innerHTML=`<h3 id="qsTitle">${st.t}</h3><p>${st.p}</p><div class="qsfoot"><div class="qsdots">${QS.steps.map((_,k)=>`<i class="${k===QS.i?'on':''}"></i>`).join('')}</div>
    ${QS.i>0?'<button id="qsBack">Back</button>':'<button class="qsskip" id="qsSkip">Skip</button>'}<button class="primary" id="qsNext">${last?'Start exploring':'Next'}</button></div>`;
  if($('qsBack'))$('qsBack').onclick=()=>qsGo(-1);if($('qsSkip'))$('qsSkip').onclick=()=>closeQuickStart();$('qsNext').onclick=()=>qsGo(1);
  qsPlace();setTimeout(()=>{const b=$('qsNext');if(b)b.focus()},30);
}
function qsPlace(){
  if(!QS.open)return;const st=QS.steps[QS.i];const card=$('qsCard'),spot=$('qsSpot'),shade=$('qsShade');
  const el=st.el?document.querySelector(st.el):null;const r=el&&el.offsetParent!==null?el.getBoundingClientRect():null;
  const vw=window.innerWidth,vh=window.innerHeight,cw=card.offsetWidth,ch=card.offsetHeight,pad=8;
  if(r&&r.width>0&&r.height>0){
    spot.hidden=false;shade.style.background='transparent';
    Object.assign(spot.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+2*pad)+'px',height:(r.height+2*pad)+'px'});
    // put the card below the target if there is room, otherwise above, otherwise beside it
    let top=r.bottom+16,left=clamp(r.left+r.width/2-cw/2,12,vw-cw-12);
    if(top+ch>vh-12)top=r.top-ch-16;
    if(top<12){top=clamp(r.top,12,vh-ch-12);left=r.right+16+cw<vw?r.right+16:clamp(r.left-cw-16,12,vw-cw-12)}
    Object.assign(card.style,{left:left+'px',top:top+'px'});
  } else {
    spot.hidden=true;shade.style.background='rgba(3,5,12,.62)';
    Object.assign(card.style,{left:((vw-cw)/2)+'px',top:Math.max(12,(vh-ch)/2)+'px'});
  }
}
// add to the command palette
if(typeof paletteCommands==='function'){const _qsPC=paletteCommands;paletteCommands=function(){const c=_qsPC();c.unshift({label:'Quick start guide',keys:'',run:()=>openQuickStart(),group:'Help'});return c}}
// first visit: wait until the app has finished starting, then show the guide once
(function qsFirstRun(){if(store.get('qs.done',false))return;let n=0;const iv=setInterval(()=>{n++;if(typeof appReady!=='undefined'&&appReady){clearInterval(iv);setTimeout(()=>{if(!store.get('qs.done',false))openQuickStart()},700)}else if(n>120)clearInterval(iv)},250)})();
