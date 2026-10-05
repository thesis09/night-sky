"use strict";
/* ================= MULTI-WAVELENGTH SURVEYS (Aladin Lite, CDS Strasbourg) =================
   Real all-sky survey images from gamma rays to microwaves. Each viewer lives in its own
   page (survey.html) inside an iframe and talks to the chart with postMessage. */
const SURVEYS=[
 {id:'P/Fermi/color',band:'Gamma rays',wl:'above 100 MeV (Fermi LAT)',what:'The most energetic light: pulsars, blazars (black-hole jets pointed at us) and cosmic rays striking gas along the Milky Way.'},
 {id:'ESAVO/P/XMM/PN/color',band:'X-rays',wl:'0.2–12 keV (XMM-Newton)',what:'Gas at millions of degrees: supernova remnants, galaxy clusters, matter falling onto black holes and neutron stars. Coverage is patchy because XMM only observed selected fields.'},
 {id:'P/GALEXGR6_7/color',band:'Ultraviolet',wl:'135–280 nm (GALEX)',what:'Hot, young, massive stars. Spiral arms light up while old elliptical galaxies fade away.'},
 {id:'P/DSS2/color',band:'Visible light',wl:'about 400–700 nm (DSS2 photographic survey)',what:'Roughly what a telescope camera sees: stars, galaxies and glowing nebulae, with dust showing as dark lanes.'},
 {id:'P/PanSTARRS/DR1/color-z-zg-g',band:'Visible, deep',wl:'g and z bands (Pan-STARRS, north of Dec −30°)',what:'Sharper and deeper than DSS2 across the northern three-quarters of the sky.'},
 {id:'P/Finkbeiner',band:'Hydrogen-alpha',wl:'656.3 nm',what:'Only the red light of ionised hydrogen: star-forming regions, supernova shells and the faint glowing gas threaded through the Milky Way.'},
 {id:'P/2MASS/color',band:'Near-infrared',wl:'1.2–2.2 µm (2MASS)',what:'Sees through dust: the hidden galactic centre, cool red giants and newborn stars inside dark clouds.'},
 {id:'P/allWISE/color',band:'Mid-infrared',wl:'3.4–22 µm (WISE)',what:'Warm dust heated by stars: star-forming regions glow and dusty galaxies stand out.'},
 {id:'P/IRIS/color',band:'Far-infrared',wl:'12–100 µm (IRAS)',what:'Cold interstellar dust everywhere, including the wispy “infrared cirrus” clouds that cover the whole sky.'},
 {id:'P/PLANCK/R2/HFI/color',band:'Microwaves',wl:'0.35–3 mm (Planck)',what:'The coldest dust in the galaxy. Away from the Milky Way, Planck also mapped the cosmic microwave background, the afterglow of the Big Bang.'},
 {id:'P/Mellinger/color',band:'Visible, whole-sky photo',wl:'visible (Mellinger mosaic)',what:'A seamless photograph of the entire Milky Way, best for very wide views.'}
];
const SV={open:false,compare:false,a:store.get('sv.a',3),b:store.get('sv.b',6),ready:{a:false,b:false},view:null};
(function buildPane(){
  const p=document.createElement('div');p.id='surveyPane';p.hidden=true;
  p.innerHTML=`<div class="svbar glass"><div class="svleft"><b id="svBand"></b><span id="svWl"></span></div>
    <input type="range" id="svSlider" min="0" max="${SURVEYS.length-1}" step="1" aria-label="Wavelength"><span class="svends"><span>γ-rays</span><span>radio</span></span>
    <button class="btn" id="svCompare">Compare</button><select id="svB" title="Second survey" hidden>${SURVEYS.map((s,i)=>`<option value="${i}">${escapeHtml(s.band)}</option>`).join('')}</select>
    <button class="btn" id="svSync" title="Point the survey at the chart's selection or view">Re-centre</button><button class="btn" id="svClose">Close</button></div>
    <div class="svframes"><div class="svf"><iframe id="svA" title="Survey viewer" loading="lazy"></iframe><div class="svlab" id="svLabA"></div></div><div class="svf" id="svFB" hidden><iframe id="svBf" title="Second survey viewer" loading="lazy"></iframe><div class="svlab" id="svLabB"></div></div></div>
    <div class="svnote" id="svNote"></div>`;
  $('stage').appendChild(p);
  const st=document.createElement('style');st.textContent=`#surveyPane{position:absolute;inset:0;z-index:7;background:#000;display:flex;flex-direction:column}#surveyPane[hidden]{display:none}
  .svbar{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:0;border-width:0 0 1px;flex-wrap:wrap}.svleft{display:flex;flex-direction:column;min-width:190px}.svleft b{font-weight:500;font-size:15px}.svleft span{font-size:12px;color:var(--dim)}
  #svSlider{flex:1;min-width:160px;accent-color:#d9b66c}.svends{display:none}.svframes{flex:1;display:flex;min-height:0}.svf{flex:1;position:relative;min-width:0}.svf+.svf{border-left:1px solid var(--line)}
  .svf iframe{width:100%;height:100%;border:0;display:block;background:#000}.svlab{position:absolute;left:10px;bottom:10px;font-size:12.5px;padding:4px 10px;border-radius:999px;background:rgba(12,16,32,.8);pointer-events:none}
  .svnote{position:absolute;left:12px;right:12px;bottom:12px;margin:0 auto;max-width:720px;font-size:13.5px;line-height:1.5;padding:10px 14px;border-radius:12px;background:rgba(12,16,32,.86);border:1px solid var(--line);pointer-events:none}
  .svf+.svf ~ .svnote{display:none}
  #surveyPane select{background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;padding:6px 8px;color:var(--text);font-size:13.5px}#surveyPane select option{background:var(--panel-solid)}`;document.head.appendChild(st);
  $('svSlider').value=SV.a;$('svB').value=SV.b;
  $('svSlider').oninput=e=>{SV.a=+e.target.value;store.set('sv.a',SV.a);svPost('a',{type:'survey',survey:SURVEYS[SV.a].id});svLabels()};
  $('svB').onchange=e=>{SV.b=+e.target.value;store.set('sv.b',SV.b);svPost('b',{type:'survey',survey:SURVEYS[SV.b].id});svLabels()};
  $('svCompare').onclick=()=>svSetCompare(!SV.compare);
  $('svSync').onclick=()=>svCentre();$('svClose').onclick=()=>closeSurvey();
})();
function svFrame(w){return w==='a'?$('svA'):$('svBf')}
function svPost(w,m){const f=svFrame(w);if(f&&f.contentWindow)f.contentWindow.postMessage(Object.assign({src:'sky'},m),location.origin)}
function svLabels(){const a=SURVEYS[SV.a],b=SURVEYS[SV.b];$('svBand').textContent=a.band;$('svWl').textContent=a.wl;$('svLabA').textContent=a.band;$('svLabB').textContent=b.band;
  $('svNote').textContent=SV.compare?'':a.what;$('svNote').hidden=SV.compare;$('svCompare').classList.toggle('on',SV.compare);$('svB').hidden=!SV.compare}
function svTarget(){
  let v=S.sel?selVec(S.sel):null,fov=null,label='';
  if(v){label=selName(S.sel);if(S.sel.kind==='dso'&&S.sel.ref.maj)fov=clamp(S.sel.ref.maj/60*3,0.08,30);else if(S.sel.kind==='planet')fov=0.5;else fov=clamp(S.fov,0.1,8)}
  else{v=hToEQJ(cam.f);fov=clamp(S.fov,0.2,60)}
  const rd=vecRaDec(v);return{ra:rd.ra*15,dec:rd.dec,fov,label,marker:!!S.sel}
}
function svCentre(){const t=svTarget();for(const w of SV.compare?['a','b']:['a']){svPost(w,{type:'goto',ra:t.ra,dec:t.dec,fov:t.fov});svPost(w,{type:'marker',ra:t.marker?t.ra:null,dec:t.dec,label:t.label})}}
function svEnsure(w){const f=svFrame(w);if(!f.src){SV.ready[w]=false;f.src='survey.html?id='+w}}
function openSurvey(bandIdx){
  if(bandIdx!=null){SV.a=bandIdx;store.set('sv.a',SV.a);$('svSlider').value=SV.a}
  $('surveyPane').hidden=false;SV.open=true;svEnsure('a');if(SV.compare)svEnsure('b');svLabels();
  if(SV.ready.a){svPost('a',{type:'survey',survey:SURVEYS[SV.a].id});svCentre()}
  if(!HOSTED)$('svNote').textContent='The survey viewer needs your hosted copy (GitHub Pages): this embedded viewer blocks it.';
}
function closeSurvey(){$('surveyPane').hidden=true;SV.open=false;requestRender()}
function svSetCompare(on){SV.compare=on;$('svFB').hidden=!on;if(on){svEnsure('b');if(SV.ready.b){svPost('b',{type:'survey',survey:SURVEYS[SV.b].id});svCentre()}}svLabels()}
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data||e.data.src!=='survey')return;const m=e.data,w=m.id;
  if(m.type==='ready'){SV.ready[w]=true;svPost(w,{type:'survey',survey:SURVEYS[w==='a'?SV.a:SV.b].id});const t=svTarget();svPost(w,{type:'goto',ra:t.ra,dec:t.dec,fov:t.fov});svPost(w,{type:'marker',ra:t.marker?t.ra:null,dec:t.dec,label:t.label})}
  else if(m.type==='view'){SV.view=m;if(SV.compare){const other=w==='a'?'b':'a';if(SV.ready[other])svPost(other,{type:'goto',ra:m.ra,dec:m.dec,fov:m.fov})}}
  else if(m.type==='error'){$('svNote').hidden=false;$('svNote').textContent=m.msg}
});
function renderSurveysTab(el){
  el.innerHTML=`<h4>See the sky in other kinds of light</h4><p class="muted">Each survey is a real all-sky image from a telescope or satellite. Pick a band to open it centred on your selection (or the centre of your view), then zoom and pan freely. Use Compare to put two wavelengths side by side; they stay in sync.</p>
  ${SURVEYS.map((s,i)=>`<button class="target" data-s="${i}"><b>${escapeHtml(s.band)}</b><span>${escapeHtml(s.wl)}</span><span>${escapeHtml(s.what)}</span></button>`).join('')}
  <p class="muted" style="margin-top:10px">Imagery: CDS Strasbourg HiPS service via Aladin Lite (Fermi/NASA, XMM-Newton/ESA, GALEX/NASA, DSS2/STScI, Pan-STARRS, Finkbeiner Hα, 2MASS/IPAC, WISE/NASA, IRAS/IRIS, Planck/ESA, Mellinger).</p>`;
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>openSurvey(+b.dataset.s));
}
registerTab('surveys','Surveys',renderSurveysTab);
window.addEventListener('keydown',e=>{const tag=e.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;
  if((e.key==='w'||e.key==='W')&&$('palette').hidden){e.preventDefault();SV.open?closeSurvey():openSurvey()}
  else if(e.key==='Escape'&&SV.open){closeSurvey()}});
KEYS.push(['W','Multi-wavelength survey view']);
