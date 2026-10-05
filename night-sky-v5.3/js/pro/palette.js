"use strict";
/* ================= COMMAND PALETTE ================= */
function paletteCommands(){
  const C=[];const add=(label,keys,run,group)=>C.push({label,keys:keys||'',run,group:group||'Commands'});
  add('Go to now (live time)','N',()=>setTime(Date.now(),true),'Time');
  add('Pause time','Space',()=>{S.live=false;S.rate=1;rateIdx=0;updateClock()},'Time');
  add('Time +1 hour',']',()=>setTime(S.simMs+3600e3,false),'Time');add('Time −1 hour','[',()=>setTime(S.simMs-3600e3,false),'Time');
  add('Time +1 day','Shift ]',()=>setTime(S.simMs+864e5,false),'Time');add('Time −1 day','Shift [',()=>setTime(S.simMs-864e5,false),'Time');
  add('Run time: 1 minute per second','',()=>{rateIdx=1;S.rate=60;S.live=false;$('speedBtn').textContent=RATES[1][1];requestRender()},'Time');
  add('Run time: 1 hour per second','',()=>{rateIdx=3;S.rate=3600;S.live=false;$('speedBtn').textContent=RATES[3][1];requestRender()},'Time');
  add('Tonight’s best targets','T',()=>{openTab('tonight');setTimeout(()=>{const b=$('bestBtn');if(b)b.click()},50)},'Planning');
  add('Open tonight planner','T',()=>openTab('tonight'),'Planning');
  add('Pin selected object to the altitude chart','',()=>{if(S.sel){pinSel(S.sel);openTab('tonight')}},'Planning');
  add('Open equipment / field of view','F',()=>openTab('equipment'),'Equipment');
  add('Toggle eyepiece / camera overlay','O',()=>toggleOverlay(),'Equipment');
  add('Frame the selected object','',()=>{if(S.sel){EQ.follow=true;store.set('eq.follow',true);EQ.overlay=EQ.overlay||'camera';flyTo(S.sel,Math.max(0.3,eqFrameFov()*2.2));refreshTab('equipment');requestRender()}},'Equipment');
  for(const [k,l] of LAYERDEF)add((S.layers[k]?'Hide ':'Show ')+l.toLowerCase(),{lines:'L',borders:'B',milky:'M',photos:'P',atmos:'A',eqgrid:'E',azgrid:'H',ecliptic:'K',sats:'S'}[k]||'',()=>toggleLayer(k),'Layers');
  add('Ground: see-through / solid / off','G',()=>cycleGround(),'Layers');
  LP.forEach((l,i)=>add('Light pollution: '+l[0],'',()=>{S.lp=i;store.set('lp',i);$('lpSel').value=i;requestRender()},'Sky'));
  CITIES.forEach(c=>add('Location: '+c[0],'',()=>setObs({name:c[0].replace(/ \(.+\)$/,''),lat:c[1],lon:c[2],elev:c[3]}),'Location'));
  add('Location and time…','',()=>toggleSheet('sheetPlace'),'Location');
  [['north',0],['east',90],['south',180],['west',270]].forEach(([n,a],i)=>add('Face '+n,String(i+1),()=>face(a),'View'));
  add('Look straight up (zenith)','Z',()=>animTo(S.az,89,null),'View');add('Zoom out to the whole sky','0',()=>animTo(S.az,35,100),'View');
  add('Centre the selected object','C',()=>{if(S.sel)flyTo(S.sel,null)},'View');
  add('Red light (night vision)','R',()=>$('redBtn').click(),'View');
  add('Show / hide side panel','\\',()=>{if(!PRO.on)setPro(true);else toggleDock()},'View');
  add('Desktop workspace on/off','',()=>$('proBtn').click(),'View');
  if(typeof SURVEYS!=='undefined'){add('Multi-wavelength survey view','W',()=>openSurvey(),'Surveys');SURVEYS.forEach((s,i)=>add('Survey: '+s.band+' ('+s.wl+')','',()=>openSurvey(i),'Surveys'));add('Open the Surveys panel','',()=>openTab('surveys'),'Surveys')}
  add('Upcoming events (eclipses, conjunctions, meteor showers…)','V',()=>{EV.mode='events';openTab('events')},'Events');
  add('Ephemeris table for the selected object','',()=>{EV.mode='ephem';openTab('events')},'Events');
  add('Astrophysics lab: HR diagram','',()=>{LAB.mode='hr';openTab('lab')},'Lab');add('Astrophysics lab: light curves','',()=>{LAB.mode='lc';openTab('lab')},'Lab');add('Astrophysics lab: spectra','',()=>{LAB.mode='sp';openTab('lab')},'Lab');
  add('3D: solar system','D',()=>open3D('solar'),'3D');add('3D: star neighbourhood','',()=>open3D('stars'),'3D');
  add('Keyboard shortcuts','?',()=>showKeys(),'Help');
  return C;
}
function fuzzy(q,t){q=q.toLowerCase();t=t.toLowerCase();if(!q)return 1;const i=t.indexOf(q);if(i>=0)return 100-i-(t.length-q.length)*0.05;
  let ti=0,score=0,run=0;for(const ch of q){const j=t.indexOf(ch,ti);if(j<0)return 0;run=j===ti?run+1:0;score+=1+run;ti=j+1}return score}
let palItems=[],palSel=0;
function openPalette(){const p=$('palette');p.hidden=false;const i=$('palInput');i.value='';palRender();setTimeout(()=>i.focus(),10)}
function closePalette(){$('palette').hidden=true}
function palRender(){
  const q=$('palInput').value.trim();const cmds=paletteCommands();
  let items=cmds.map(c=>({c,s:fuzzy(q,c.label)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,q?8:14).map(x=>({type:'cmd',label:x.c.label,keys:x.c.keys,group:x.c.group,run:x.c.run}));
  if(q.length>=1){const qq=q.toLowerCase().replace(/[\s\-'’.]/g,'').replace(/^messier/,'m');const objs=[];
    for(const e of IDX){let best=99;for(const k of e.keys){if(k===qq){best=0;break}if(k.startsWith(qq))best=Math.min(best,1);else if(qq.length>2&&k.includes(qq))best=Math.min(best,2)}if(best<99)objs.push({e,s:best*100+e.rank})}
    objs.sort((a,b)=>a.s-b.s);const top=objs.slice(0,7).map(x=>({type:'obj',label:x.e.label,keys:x.e.sub,group:'Sky objects',run:()=>{flyTo(x.e.sel,null);showInfo(x.e.sel)}}));
    items=(objs.length&&objs[0].s<100?top.concat(items):items.concat(top));}
  palItems=items;palSel=0;let g='';
  $('palList').innerHTML=items.length?items.map((it,k)=>{const h=it.group!==g?`<div class="grp">${escapeHtml(it.group)}</div>`:'';g=it.group;return h+`<button data-k="${k}" class="${k===0?'on':''}"><span>${escapeHtml(it.label)}</span><span class="k">${escapeHtml(it.keys||'')}</span></button>`}).join(''):'<div class="grp">No matches</div>';
  $('palList').querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>palRun(+b.dataset.k));
}
function palRun(k){const it=palItems[k];closePalette();if(it)try{it.run()}catch(e){console.warn(e)}}
$('palInput').addEventListener('input',palRender);
$('palInput').addEventListener('keydown',e=>{const bs=$('palList').querySelectorAll('button[data-k]');
  if(e.key==='Escape'){closePalette();e.preventDefault()}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();palSel=clamp(palSel+(e.key==='ArrowDown'?1:-1),0,bs.length-1);bs.forEach((b,i)=>b.classList.toggle('on',i===palSel));if(bs[palSel])bs[palSel].scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'){e.preventDefault();palRun(palSel)}});
$('palette').addEventListener('pointerdown',e=>{if(e.target.id==='palette')closePalette()});
