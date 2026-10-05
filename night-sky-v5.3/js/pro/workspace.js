"use strict";
/* ================= DESKTOP "PRO" WORKSPACE =================
   Switches on automatically on a large screen with a mouse (or via the Workspace button).
   Layout: tool dock on the left, sky in the middle, object inspector docked on the right. */
const PRO={on:false,tab:store.get('pro.tab','tonight'),tabs:[],dockW:store.get('pro.dockW',360),infoW:store.get('pro.infoW',400)};
const proQuery=window.matchMedia?window.matchMedia('(pointer: fine) and (min-width: 1100px)'):null;
function proWanted(){const pref=store.get('pro.mode','auto');if(pref==='on')return true;if(pref==='off')return false;return !!(proQuery&&proQuery.matches)}
function registerTab(id,label,render){PRO.tabs.push({id,label,render})}
function setPro(on){
  PRO.on=on;document.body.classList.toggle('pro',on);$('proBtn').classList.toggle('on',on);
  document.body.style.setProperty('--dock-w',PRO.dockW+'px');document.body.style.setProperty('--info-open-w',PRO.infoW+'px');
  syncInfoWidth();if(on)renderDock();requestAnimationFrame(()=>resize());
}
function syncInfoWidth(){const open=$('info').classList.contains('open');document.body.classList.toggle('info-open',open);document.body.style.setProperty('--info-w',(PRO.on&&open?PRO.infoW:0)+'px')}
new MutationObserver(()=>{const was=document.body.style.getPropertyValue('--info-w');syncInfoWidth();if(PRO.on&&document.body.style.getPropertyValue('--info-w')!==was)requestAnimationFrame(()=>resize())}).observe($('info'),{attributes:true,attributeFilter:['class']});
if(window.ResizeObserver)new ResizeObserver(()=>{if(cv.clientWidth&&(cv.clientWidth!==W||cv.clientHeight!==H))resize()}).observe($('stage'));
function renderDock(){
  const d=$('dock');if(!PRO.on)return;
  if(!PRO.tabs.find(t=>t.id===PRO.tab))PRO.tab=PRO.tabs[0]&&PRO.tabs[0].id;
  d.innerHTML=`<div class="dhead">${PRO.tabs.map(t=>`<button class="tab ${t.id===PRO.tab?'on':''}" data-tab="${t.id}">${t.label}</button>`).join('')}<button class="dclose" title="Hide panel ( \\ )" aria-label="Hide panel">‹</button></div><div class="dbody" id="dockBody"></div><div class="resizer" id="dockResizer" title="Drag to resize"></div>`;
  d.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.tab));
  d.querySelector('.dclose').onclick=()=>toggleDock(false);
  makeResizer($('dockResizer'),x=>{PRO.dockW=clamp(x,260,620);document.body.style.setProperty('--dock-w',PRO.dockW+'px');store.set('pro.dockW',PRO.dockW)});
  const t=PRO.tabs.find(t=>t.id===PRO.tab);if(t)t.render($('dockBody'));
}
function openTab(id){if(!PRO.on)setPro(true);document.body.classList.remove('dock-hidden');PRO.tab=id;store.set('pro.tab',id);renderDock();requestAnimationFrame(()=>resize())}
function refreshTab(id){if(PRO.on&&PRO.tab===id&&$('dockBody')){const t=PRO.tabs.find(t=>t.id===id);if(t)t.render($('dockBody'))}}
function toggleDock(show){const hidden=show==null?!document.body.classList.contains('dock-hidden'):!show;document.body.classList.toggle('dock-hidden',hidden);requestAnimationFrame(()=>resize())}
function makeResizer(el,onX,fromRight){
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('drag');
    const mv=ev=>{onX(fromRight?window.innerWidth-ev.clientX:ev.clientX)};
    const up=()=>{el.classList.remove('drag');el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);resize()};
    el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up)});
}
(function(){const r=document.createElement('div');r.className='resizer';r.id='infoResizer';r.title='Drag to resize';$('app').appendChild(r);
  makeResizer(r,x=>{PRO.infoW=clamp(x,300,720);document.body.style.setProperty('--info-open-w',PRO.infoW+'px');document.body.style.setProperty('--info-w',PRO.infoW+'px')},true)})();
$('proBtn').hidden=!(window.matchMedia&&(matchMedia('(pointer: fine)').matches||innerWidth>=900));
$('proBtn').onclick=()=>{const on=!PRO.on;store.set('pro.mode',on?'on':'off');setPro(on)};
if(proQuery&&proQuery.addEventListener)proQuery.addEventListener('change',()=>{if(store.get('pro.mode','auto')==='auto')setPro(proWanted())});

/* ---------- keyboard shortcuts ---------- */
const KEYS=[
 ['Ctrl/⌘ K  or  :','Command palette'],['/','Search'],['?','This list'],['Esc','Close panel / dialog'],
 ['← → ↑ ↓','Look around'],['+  −','Zoom in / out'],['0','Zoom out to the whole sky'],['C','Centre the selected object'],
 ['N','Back to now (live)'],['[  ]','Time −1 hour / +1 hour'],['Shift [  ]','Time −1 day / +1 day'],['Space','Pause / resume time'],
 ['1 2 3 4','Face N / E / S / W'],['Z','Look at the zenith'],
 ['L','Constellation lines'],['B','Constellation boundaries'],['M','Milky Way'],['P','Telescope photos'],['A','Atmosphere'],['G','Ground: see-through → solid → off'],
 ['E','Equatorial grid'],['H','Alt-az grid'],['K','Ecliptic'],['S','Satellites'],['R','Red light'],
 ['T','Tonight planner'],['F','Equipment (field of view)'],['O','Toggle eyepiece / camera overlay'],['V','Events'],['Y','Astrophysics lab'],['\\','Show / hide side panel']];
function showKeys(){const k=$('keysHelp');k.innerHTML=`<div class="box"><h3>Keyboard shortcuts</h3><div class="cols">${KEYS.map(([a,b])=>`<div class="kr"><span>${escapeHtml(b)}</span><span>${a.split('  ').map(x=>`<kbd>${escapeHtml(x)}</kbd>`).join(' ')}</span></div>`).join('')}</div><p class="note" style="color:var(--dim);font-size:13px;margin:12px 0 0">Shortcuts work whenever you are not typing in a box.</p></div>`;k.hidden=false;k.onclick=()=>{k.hidden=true}}
function toggleLayer(k){S.layers[k]=!S.layers[k];store.set('layers',S.layers);const el=$('ly_'+k);if(el)el.checked=S.layers[k];if(k==='starlink'&&S.layers[k])loadStarlink();requestRender();toast((S.layers[k]?'Showing ':'Hiding ')+(LAYERDEF.find(x=>x[0]===k)||[0,k])[1].toLowerCase())}
function cycleGround(){S.ground=S.ground===1?2:S.ground===2?0:1;store.set('ground',S.ground);$('groundSel').value=S.ground;requestRender();toast('Ground: '+['off','see-through','solid'][S.ground])}
let toastT=0;function toast(t){let e=$('toast');if(!e){e=document.createElement('div');e.id='toast';e.className='glass';e.style.cssText='position:absolute;left:50%;transform:translateX(-50%);top:16px;padding:8px 14px;border-radius:999px;font-size:13.5px;z-index:8;pointer-events:none';$('stage').appendChild(e)}e.textContent=t;e.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>e.style.display='none',1600)}
function face(az,alt){animTo(az,alt==null?(S.alt<5?25:S.alt):alt,null)}
window.addEventListener('keydown',e=>{
  const tag=e.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  if(!$('palette').hidden)return;
  if(!$('keysHelp').hidden){if(e.key==='Escape'||e.key==='?'){$('keysHelp').hidden=true;e.preventDefault()}return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();return}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key;let used=true;
  if(k===':'){openPalette()}else if(k==='?'){showKeys()}
  else if(k==='0'){animTo(S.az,35,100)}
  else if(k==='c'||k==='C'){if(S.sel)flyTo(S.sel,null)}
  else if(k==='n'||k==='N'){setTime(Date.now(),true);toast('Live time')}
  else if(k==='['||k==='{'){setTime(S.simMs-(e.shiftKey?86400:3600)*1000,false)}
  else if(k===']'||k==='}'){setTime(S.simMs+(e.shiftKey?86400:3600)*1000,false)}
  else if(k===' '){if(S.live||S.rate!==1){S.live=false;S.rate=1;rateIdx=0;$('speedBtn').textContent=RATES[0][1];$('nowBtn').classList.remove('on');toast('Time paused')}else{setTime(Date.now(),true);toast('Live time')}updateClock()}
  else if(k>='1'&&k<='4'){face([0,90,180,270][+k-1])}
  else if(k==='z'||k==='Z'){animTo(S.az,89,null)}
  else if('lbmpaehks'.includes(k.toLowerCase())&&k.length===1){toggleLayer({l:'lines',b:'borders',m:'milky',p:'photos',a:'atmos',e:'eqgrid',h:'azgrid',k:'ecliptic',s:'sats'}[k.toLowerCase()])}
  else if(k==='g'||k==='G'){cycleGround()}
  else if(k==='r'||k==='R'){$('redBtn').click()}
  else if(k==='t'||k==='T'){openTab('tonight')}
  else if(k==='f'||k==='F'){openTab('equipment')}
  else if(k==='o'||k==='O'){toggleOverlay()}
  else if(k==='v'||k==='V'){openTab('events')}
  else if(k==='y'||k==='Y'){openTab('lab')}
  else if(k==='\\'){if(!PRO.on)setPro(true);else toggleDock()}
  else used=false;
  if(used)e.preventDefault();
});
