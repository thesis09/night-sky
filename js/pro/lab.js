"use strict";
/* ================= ASTROPHYSICS LAB ================= */
const LAB={index:null,status:'',mode:store.get('lab.mode','hr'),hr:null,lc:null,lcId:store.get('lab.lc',''),sp:null,spId:store.get('lab.sp',''),fold:true,period:null,lcView:null,ls:null,smooth:true};
async function labLoadIndex(){if(LAB.index)return LAB.index;try{LAB.index=await fetchJSON('data/lab/index.json?v='+Math.floor(Date.now()/36e5),15000)}catch(e){LAB.index={};LAB.status=HOSTED?'Lab data has not been built yet: run Actions → “Build astrophysics lab data”.':'Lab data loads on your hosted copy after running the “Build astrophysics lab data” action.'}return LAB.index}
function labCanvas(id,h){const c=$(id);const w=c.clientWidth||320;c.width=w*DPR;c.height=h*DPR;c.style.height=h+'px';const g=c.getContext('2d');g.setTransform(DPR,0,0,DPR,0,0);return{c,g,w,h}}
function renderLab(el){
  el.innerHTML=`<div class="row2"><span class="seg">${[['hr','HR diagram'],['lc','Light curves'],['sp','Spectra']].map(([k,l])=>`<button data-m="${k}" class="${LAB.mode===k?'on':''}">${l}</button>`).join('')}</span></div><div id="labBody"><div class="muted">Loading…</div></div>`;
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{LAB.mode=b.dataset.m;store.set('lab.mode',LAB.mode);renderLab(el)});
  labLoadIndex().then(()=>{const b=$('labBody');if(!b)return;if(LAB.mode==='hr')renderHRLab(b);else if(LAB.mode==='lc')renderLCLab(b);else renderSPLab(b)});
}
/* ---------- HR diagram ---------- */
async function hrData(){
  if(LAB.hr)return LAB.hr;
  if(LAB.index&&LAB.index.hr){try{const r=await fetch('data/lab/'+LAB.index.hr.file);if(r.ok){const buf=await r.arrayBuffer();const n=new Uint32Array(buf,0,1)[0];const c=new Int16Array(buf,8,n),m=new Int16Array(buf,8+2*n,n);LAB.hr={n,x:i=>c[i]/1000,y:i=>m[i]/1000,gaia:true,src:LAB.index.hr.source};return LAB.hr}}catch(e){}}
  const xs=[],ys=[];for(let i=0;i<N;i++){if(sCI[i]===-128)continue;const pc=starDistPc(i);if(!(pc>0&&pc<200))continue;xs.push(sCI[i]/50);ys.push(sMag[i]-5*Math.log10(pc/10))}
  LAB.hr={n:xs.length,x:i=>xs[i],y:i=>ys[i],gaia:false,src:'Hipparcos stars within 650 light-years (Gaia sample not built yet)'};return LAB.hr;
}
function selHRPoint(gaia){
  const s=S.sel;if(!s)return null;
  if(s.kind==='gaia'){const T=GAIA.tiles.get(s.ref.f);if(!T)return null;const k=s.ref.k,p=T.plx[k];if(!(p>0)||!isFinite(T.bprp[k]))return null;const MG=T.G[k]+5*Math.log10(p)-10;return gaia?{x:T.bprp[k],y:MG}:{x:gaiaBV(T.bprp[k]),y:MG-(-0.02704)}}
  if(s.kind==='star'){const i=s.ref,pc=starDistPc(i);if(!(pc>0)||sCI[i]===-128)return null;const bv=sCI[i]/50,Mv=sMag[i]-5*Math.log10(pc/10);if(!gaia)return{x:bv,y:Mv};const x=(bv+0.02)/0.8;return{x,y:Mv+(-0.02704+0.01424*x-0.2156*x*x+0.01426*x*x*x)}}
  return null;
}
async function renderHRLab(el){
  const D=await hrData();
  el.innerHTML=`<h4>Hertzsprung–Russell diagram</h4><p class="muted">Every dot is a real star: colour (temperature) across, true brightness up. Stars spend most of their lives on the diagonal main sequence, then swell into giants, and Sun-like stars end as white dwarfs in the lower left.</p>
  <canvas class="chart" id="hrLab" height="360"></canvas><div class="muted" id="hrRead" style="min-height:2.6em"></div>
  <div class="muted">${D.n.toLocaleString('en-US')} stars · ${escapeHtml(D.src)}. ${S.sel&&selHRPoint(D.gaia)?'The brass ring is your selected star.':'Select a star in the sky to see where it sits.'}</div>`;
  const {c,g,w,h}=labCanvas('hrLab',360);const L=36,B=26,T=8,R=8;const xr=D.gaia?[-0.6,4.2]:[-0.4,2.0],yr=[-5,17];
  const X=x=>L+(x-xr[0])/(xr[1]-xr[0])*(w-L-R),Y=y=>T+(y-yr[0])/(yr[1]-yr[0])*(h-T-B);
  g.fillStyle='#05070f';g.fillRect(0,0,w,h);
  const img=g.getImageData(0,0,c.width,c.height);const d=img.data;const cw=c.width;
  for(let i=0;i<D.n;i++){const x=D.x(i),y=D.y(i);if(x<xr[0]||x>xr[1]||y<yr[0]||y>yr[1])continue;const px=Math.round(X(x)*DPR),py=Math.round(Y(y)*DPR);const q=(py*cw+px)*4;
    const bv=D.gaia?clamp(0.8*x-0.02,-0.4,2):x;const col=bucketCol[Math.round(clamp((bv+0.4)/2.4,0,1)*(NB-1))];d[q]=Math.min(255,d[q]+col[0]*0.35);d[q+1]=Math.min(255,d[q+1]+col[1]*0.35);d[q+2]=Math.min(255,d[q+2]+col[2]*0.35)}
  g.putImageData(img,0,0);g.setTransform(DPR,0,0,DPR,0,0);
  g.strokeStyle='rgba(236,230,214,.3)';g.beginPath();g.moveTo(L,T);g.lineTo(L,h-B);g.lineTo(w-R,h-B);g.stroke();g.fillStyle='rgba(236,230,214,.7)';g.font='11px Jost, sans-serif';
  for(let y=-4;y<=16;y+=4){g.fillText(String(y),4,Y(y)+4)}for(let x=Math.ceil(xr[0]);x<=xr[1];x+=1){g.fillText(String(x),X(x)-3,h-10)}
  g.fillText(D.gaia?'BP−RP colour →  redder, cooler':'B−V colour →  redder, cooler',L+30,h-1);
  g.font='italic 15px "Cormorant Garamond", Georgia, serif';g.fillStyle='rgba(217,182,108,.95)';
  if(D.gaia){g.fillText('main sequence',X(1.4),Y(7.5));g.fillText('giants',X(1.3),Y(0.6));g.fillText('white dwarfs',X(-0.1),Y(14.5));g.fillText('red dwarfs',X(2.7),Y(13.2))}
  else{g.fillText('main sequence',X(0.55),Y(6.2));g.fillText('giants',X(1.15),Y(-0.6));g.fillText('white dwarfs',X(0.05),Y(13.2))}
  const sp=selHRPoint(D.gaia);if(sp){g.strokeStyle='#d9b66c';g.lineWidth=2.5;g.beginPath();g.arc(X(sp.x),Y(clamp(sp.y,yr[0],yr[1])),8,0,TAU);g.stroke()}
  c.onmousemove=e=>{const r=c.getBoundingClientRect();const x=xr[0]+(e.clientX-r.left-L)/(w-L-R)*(xr[1]-xr[0]),y=yr[0]+(e.clientY-r.top-T)/(h-T-B)*(yr[1]-yr[0]);
    const bv=D.gaia?0.8*x:x;const Tk=D.gaia?gaiaTeff(x):4600*(1/(0.92*bv+1.7)+1/(0.92*bv+0.62));const Lsun=Math.pow(10,(4.74-y)/2.5);
    $('hrRead').textContent=`colour ${x.toFixed(2)}, absolute mag ${y.toFixed(1)} → about ${Tk?Math.round(Tk/100)*100:'?'} K, ${Lsun>=1?Math.round(Lsun).toLocaleString('en-US'):Lsun.toPrecision(2)}× the Sun’s brightness`}
}
/* ---------- light curves ---------- */
async function renderLCLab(el){
  const list=(LAB.index&&LAB.index.lightcurves)||[];
  if(!list.length){el.innerHTML=`<p class="muted" style="margin-top:8px">${escapeHtml(LAB.status||'No light curves built yet. Run Actions → “Build astrophysics lab data” (step lc). Targets are listed in tools/lab_targets.json, so you can add your own.')}</p>`;return}
  if(!LAB.lcId||!list.find(x=>x.id===LAB.lcId))LAB.lcId=list[0].id;
  el.innerHTML=`<h4>Light curves from Kepler and TESS</h4><p class="muted">Brightness of a star measured every few minutes by NASA space telescopes. Transiting planets make tiny regular dips; pulsating and eclipsing stars vary in rhythm.</p>
  <div class="row2"><select id="lcSel" style="flex:1">${list.map(x=>`<option value="${x.id}" ${x.id===LAB.lcId?'selected':''}>${escapeHtml(x.name)}</option>`).join('')}</select></div>
  <canvas class="chart" id="lcRaw" height="190"></canvas><div class="muted" id="lcInfo"></div>
  <div class="row2"><label class="f">Period (days)<input type="number" id="lcP" step="0.00001"></label><button class="btn" id="lcFold">Fold</button><button class="btn" id="lcLS">Find period</button></div>
  <canvas class="chart" id="lcFoldC" height="200"></canvas><div class="verdict" id="lcResult"></div>`;
  $('lcSel').onchange=e=>{LAB.lcId=e.target.value;store.set('lab.lc',LAB.lcId);LAB.lc=null;LAB.lcView=null;renderLCLab(el)};
  if(!LAB.lc||LAB.lc.id!==LAB.lcId){try{LAB.lc=await fetchJSON('data/lab/lc/'+LAB.lcId+'.json',20000);LAB.period=LAB.lc.period||null}catch(e){$('lcInfo').textContent='Could not load this light curve.';return}}
  const lc=LAB.lc;$('lcP').value=LAB.period||'';
  $('lcInfo').textContent=`${lc.time.length.toLocaleString('en-US')} measurements over ${(lc.time[lc.time.length-1]-lc.time[0]).toFixed(1)} days · ${lc.mission||''} ${lc.product||''} · scroll to zoom, drag to pan`;
  drawLCRaw();
  $('lcFold').onclick=()=>{LAB.period=parseFloat($('lcP').value)||null;drawFold()};
  $('lcLS').onclick=()=>{$('lcResult').textContent='Searching periods…';setTimeout(()=>{const p=lombScargle(lc.time,lc.flux);LAB.period=p;$('lcP').value=p.toFixed(5);drawFold(true)},20)};
  drawFold();
}
function drawLCRaw(){
  const lc=LAB.lc;const {c,g,w,h}=labCanvas('lcRaw',190);const t0=lc.time[0],t1=lc.time[lc.time.length-1];if(!LAB.lcView)LAB.lcView=[t0,t1];const [a,b]=LAB.lcView;
  let lo=Infinity,hi=-Infinity;for(let i=0;i<lc.time.length;i++){const t=lc.time[i];if(t<a||t>b)continue;const f=lc.flux[i];if(f<lo)lo=f;if(f>hi)hi=f}if(!isFinite(lo)){lo=0.99;hi=1.01}const pad=(hi-lo)*0.08||0.001;lo-=pad;hi+=pad;
  const L=46,B=20,X=t=>L+(t-a)/(b-a)*(w-L-6),Y=f=>6+(hi-f)/(hi-lo)*(h-B-6);
  g.fillStyle='#05070f';g.fillRect(0,0,w,h);g.fillStyle='rgba(236,230,214,.6)';g.font='10.5px Jost, sans-serif';
  for(let k=0;k<=4;k++){const f=lo+(hi-lo)*k/4;g.fillText(((f-1)*100).toFixed(f-1<0.01&&f-1>-0.01?2:1)+'%',2,Y(f)+3)}
  g.fillText(`${a.toFixed(1)}`,L,h-4);g.fillText(`${b.toFixed(1)} d`,w-48,h-4);
  g.fillStyle='rgba(159,198,255,.8)';for(let i=0;i<lc.time.length;i++){const t=lc.time[i];if(t<a||t>b)continue;g.fillRect(X(t),Y(lc.flux[i]),1.2,1.2)}
  const c2=$('lcRaw');let drag=null;
  c2.onwheel=e=>{e.preventDefault();const r=c2.getBoundingClientRect();const tm=a+(e.clientX-r.left-L)/(w-L-6)*(b-a);const k=Math.exp(e.deltaY*0.0015);let na=tm-(tm-a)*k,nb=tm+(b-tm)*k;if(nb-na>t1-t0){na=t0;nb=t1}LAB.lcView=[Math.max(t0,na),Math.min(t1,nb)];drawLCRaw()};
  c2.onpointerdown=e=>{drag={x:e.clientX,v:LAB.lcView.slice()};c2.setPointerCapture(e.pointerId)};
  c2.onpointermove=e=>{if(!drag)return;const dt=(e.clientX-drag.x)/(w-L-6)*(drag.v[1]-drag.v[0]);let na=drag.v[0]-dt,nb=drag.v[1]-dt;if(na<t0){nb+=t0-na;na=t0}if(nb>t1){na-=nb-t1;nb=t1}LAB.lcView=[na,nb];drawLCRaw()};
  c2.onpointerup=()=>{drag=null};
}
function foldBins(time,flux,P,nb){const s=new Float64Array(nb),n=new Uint32Array(nb);for(let i=0;i<time.length;i++){let ph=(time[i]/P)%1;if(ph<0)ph+=1;const k=Math.min(nb-1,Math.floor(ph*nb));s[k]+=flux[i];n[k]++}return Array.from(s,(v,k)=>n[k]?v/n[k]:NaN)}
function drawFold(fromLS){
  const lc=LAB.lc,P=LAB.period;const {g,w,h}=labCanvas('lcFoldC',200);g.fillStyle='#05070f';g.fillRect(0,0,w,h);
  if(!P||!(P>0)){g.fillStyle='rgba(236,230,214,.6)';g.font='12px Jost, sans-serif';g.fillText('Enter a period, or press “Find period”, to fold the light curve.',10,h/2);$('lcResult').textContent='';return}
  const nb=200;const bins=foldBins(lc.time,lc.flux,P,nb);let kmin=0;for(let k=0;k<nb;k++)if(bins[k]<bins[kmin]||!isFinite(bins[kmin]))kmin=k;
  const shift=(kmin+0.5)/nb; // put the deepest point at phase 0
  let lo=Infinity,hi=-Infinity;const pts=[];for(let i=0;i<lc.time.length;i++){let ph=((lc.time[i]/P)%1+1)%1-shift;ph=((ph+0.5)%1+1)%1-0.5;pts.push([ph,lc.flux[i]]);if(lc.flux[i]<lo)lo=lc.flux[i];if(lc.flux[i]>hi)hi=lc.flux[i]}
  const fb=bins.filter(isFinite);const bl=Math.min(...fb),bh=Math.max(...fb);lo=Math.max(lo,bl-(bh-bl)*0.6);hi=Math.min(hi,bh+(bh-bl)*0.6);const pad=(hi-lo)*0.06||0.001;lo-=pad;hi+=pad;
  const L=46,B=20,X=p=>L+(p+0.5)*(w-L-6),Y=f=>6+(hi-f)/(hi-lo)*(h-B-6);
  g.fillStyle='rgba(159,198,255,.35)';for(const [p,f] of pts)if(f>=lo&&f<=hi)g.fillRect(X(p),Y(f),1.2,1.2);
  g.strokeStyle='#d9b66c';g.lineWidth=2;g.beginPath();let pen=false;for(let k=0;k<nb;k++){const kk=(k+kmin+nb/2)%nb;const v=bins[kk];if(!isFinite(v)){pen=false;continue}const ph=(k+0.5)/nb-0.5;pen?g.lineTo(X(ph),Y(v)):g.moveTo(X(ph),Y(v));pen=true}g.stroke();
  g.fillStyle='rgba(236,230,214,.6)';g.font='10.5px Jost, sans-serif';g.fillText('phase −0.5',L,h-4);g.fillText('0',X(0)-3,h-4);g.fillText('+0.5',w-30,h-4);
  const base=median(fb),depth=base-bl,amp=bh-bl;let txt=`Folded at ${P.toFixed(5)} days (${P<1?(P*24).toFixed(2)+' hours':P.toFixed(2)+' days'}). `;
  if(lc.kind==='transit'&&depth>0){const rr=Math.sqrt(depth/base);const rs=lc.rstar||1;const re=rr*rs*109.1;
    let below=0;for(const v of bins)if(isFinite(v)&&v<base-depth/2)below++;const dur=below/nb*P*24;
    txt+=`Transit depth ${(depth/base*100).toFixed(3)}%, so the planet blocks that fraction of the star’s disk: radius ≈ √depth × star radius = ${rr.toFixed(3)} × ${rs} R☉ ≈ ${re.toFixed(1)} Earth radii (${(re/11.21).toFixed(2)} Jupiter radii). Transit lasts about ${dur.toFixed(1)} hours.`}
  else if(lc.kind==='variable')txt+=`Brightness swings by ${(amp/base*100).toFixed(1)}% each cycle. ${lc.name.includes('Cephe')?'Cepheids pulsate in and out; their period reveals their true luminosity (Leavitt’s law), which made them the first yardsticks for measuring distances to other galaxies.':'RR Lyrae stars are old, pulsating giants with nearly identical luminosities, so they serve as standard candles for distances inside our galaxy.'}`;
  else if(lc.kind==='eclipsing')txt+=`Deepest eclipse ${(depth/base*100).toFixed(1)}%: one star passing in front of the other. Eclipse depths and timings give the stars’ sizes and masses directly.`;
  if(fromLS&&LAB.ls)txt+=` The periodogram’s strongest signal is at ${LAB.ls.toFixed(5)} d${lc.kind==='transit'||lc.kind==='eclipsing'?'; for transits and eclipses the true period is often double that':''}.`;
  $('lcResult').textContent=txt;
}
function median(a){const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN}
function lombScargle(t,y){ // classic Lomb–Scargle periodogram over 0.1–30 day periods
  const stp=Math.ceil(t.length/2500);t=t.filter((_,i)=>i%stp===0);y=y.filter((_,i)=>i%stp===0);
  const n=t.length;let m=0;for(const v of y)m+=v;m/=n;const yy=y.map(v=>v-m);const span=t[n-1]-t[0];
  const fmin=1/Math.min(30,span/2),fmax=10,nf=3000;let best=0,bp=null;
  for(let k=0;k<nf;k++){const f=fmin*Math.pow(fmax/fmin,k/(nf-1));const w=TAU*f;let s2=0,c2=0;for(let i=0;i<n;i++){s2+=Math.sin(2*w*t[i]);c2+=Math.cos(2*w*t[i])}const tau=Math.atan2(s2,c2)/(2*w);
    let yc=0,ys=0,cc=0,ss=0;for(let i=0;i<n;i++){const a=w*(t[i]-tau),c=Math.cos(a),s=Math.sin(a);yc+=yy[i]*c;ys+=yy[i]*s;cc+=c*c;ss+=s*s}const p=yc*yc/cc+ys*ys/ss;if(p>best){best=p;bp=1/f}}
  LAB.ls=bp;const lc=LAB.lc;return(lc&&(lc.kind==='transit'||lc.kind==='eclipsing'))?bp*2:bp;
}
/* ---------- spectra ---------- */
const SPEC_LINES=[{w:6562.8,n:'Hα',t:'b'},{w:4861.3,n:'Hβ',t:'b'},{w:4340.5,n:'Hγ',t:'b'},{w:4101.7,n:'Hδ',t:'b'},{w:3933.7,n:'Ca K',t:'a'},{w:3968.5,n:'Ca H',t:'a'},{w:5175.4,n:'Mg b',t:'a'},{w:5892.9,n:'Na D',t:'a'},
 {w:7054,n:'TiO',t:'m'},{w:6158,n:'TiO',t:'m'},{w:3727.4,n:'[O II]',t:'e'},{w:5006.8,n:'[O III]',t:'e'},{w:4958.9,n:'[O III]',t:'e'},{w:6583.5,n:'[N II]',t:'e'},{w:6716.4,n:'[S II]',t:'e'},{w:2798.8,n:'Mg II',t:'q'},{w:1908.7,n:'C III]',t:'q'},{w:1549,n:'C IV',t:'q'},{w:1215.7,n:'Lyα',t:'q'}];
async function renderSPLab(el){
  const list=(LAB.index&&LAB.index.spectra)||[];
  if(!list.length){el.innerHTML=`<p class="muted" style="margin-top:8px">${escapeHtml(LAB.status||'No spectra built yet. Run Actions → “Build astrophysics lab data” (step spectra).')}</p>`;return}
  if(!LAB.spId||!list.find(x=>x.id===LAB.spId))LAB.spId=list[0].id;
  const groups={};list.forEach(x=>{(groups[x.group||'Spectra']=groups[x.group||'Spectra']||[]).push(x)});
  el.innerHTML=`<h4>Spectra from the Sloan Digital Sky Survey</h4><p class="muted">Light spread out by wavelength. Dark absorption lines and bright emission lines are chemical fingerprints, and their shift towards red measures how fast an object is moving away.</p>
  <div class="row2"><select id="spSel" style="flex:1">${Object.entries(groups).map(([g,xs])=>`<optgroup label="${escapeHtml(g)}">${xs.map(x=>`<option value="${x.id}" ${x.id===LAB.spId?'selected':''}>${escapeHtml(x.name)}${x.subclass?' · '+escapeHtml(x.subclass):''}</option>`).join('')}</optgroup>`).join('')}</select></div>
  <canvas class="chart" id="spC" height="240"></canvas><div class="row2"><label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="spSm" ${LAB.smooth?'checked':''}> Smooth</label><button class="btn" id="spGo">Show in the sky</button></div><div class="verdict" id="spRes"></div>`;
  $('spSel').onchange=e=>{LAB.spId=e.target.value;store.set('lab.sp',LAB.spId);LAB.sp=null;renderSPLab(el)};$('spSm').onchange=e=>{LAB.smooth=e.target.checked;drawSpectrum()};
  if(!LAB.sp||LAB.sp.id!==LAB.spId){try{LAB.sp=await fetchJSON('data/lab/spectra/'+LAB.spId+'.json',20000)}catch(e){$('spRes').textContent='Could not load this spectrum.';return}}
  $('spGo').onclick=()=>{const s=LAB.sp;const o=s.dso?DSO.find(d=>d.id===s.dso):null;if(o){showInfo({kind:'dso',ref:o});flyTo({kind:'dso',ref:o},null)}else{const v=unit(s.ra,s.dec);const h=[0,0,0];applyM(M,v[0],v[1],v[2],h);const a=hToAzAlt(h);animTo(a.az,a.alt,2)}};
  drawSpectrum();
}
function drawSpectrum(){
  const s=LAB.sp;const {g,w,h}=labCanvas('spC',240);g.fillStyle='#05070f';g.fillRect(0,0,w,h);
  let fl=s.flux.slice();if(LAB.smooth){const k=3;fl=fl.map((_,i)=>{let a=0,n=0;for(let j=i-k;j<=i+k;j++)if(j>=0&&j<fl.length&&isFinite(s.flux[j])){a+=s.flux[j];n++}return n?a/n:NaN})}
  const ws=s.wave;const w0=ws[0],w1=ws[ws.length-1];const fv=fl.filter(isFinite).sort((a,b)=>a-b);const lo=Math.min(0,fv[Math.floor(fv.length*0.005)]),hi=fv[Math.floor(fv.length*0.995)]*1.15;
  const L=10,B=22,X=x=>L+(x-w0)/(w1-w0)*(w-L-8),Y=f=>8+(hi-f)/(hi-lo)*(h-B-8);
  // rainbow strip under the visible part of the axis
  for(let x=Math.ceil(w0);x<w1;x+=20){if(x<3800||x>7500)continue;const hue=270-(x-3800)/(7500-3800)*270;g.fillStyle=`hsla(${hue},80%,55%,.35)`;g.fillRect(X(x),h-B+2,X(x+20)-X(x)+1,5)}
  g.strokeStyle='#e9e4d4';g.lineWidth=1.2;g.beginPath();let pen=false;for(let i=0;i<ws.length;i++){const f=fl[i];if(!isFinite(f)){pen=false;continue}pen?g.lineTo(X(ws[i]),Y(f)):g.moveTo(X(ws[i]),Y(f));pen=true}g.stroke();
  const z=(s.class==='STAR')?0:s.z;const kinds=s.class==='STAR'?['b','a','m']:s.class==='QSO'?['b','e','q']:['b','a','e'];
  g.font='10.5px Jost, sans-serif';let lastX=-99;
  for(const ln of SPEC_LINES.filter(l=>kinds.includes(l.t)).sort((a,b)=>a.w-b.w)){const ow=ln.w*(1+z);if(ow<w0||ow>w1)continue;const x=X(ow);g.strokeStyle=ln.t==='e'||ln.t==='q'?'rgba(127,214,207,.55)':'rgba(217,182,108,.55)';g.setLineDash([3,3]);g.beginPath();g.moveTo(x,8);g.lineTo(x,h-B);g.stroke();g.setLineDash([]);
    g.fillStyle=g.strokeStyle.replace('.55','.95');if(x-lastX>22){g.fillText(ln.n,x+2,16);lastX=x}}
  g.fillStyle='rgba(236,230,214,.65)';for(let x=Math.ceil(w0/1000)*1000;x<w1;x+=1000)g.fillText(x+' Å',X(x)-14,h-4);
  let txt='';const c=299792.458;
  if(s.class==='STAR'){const sub=(s.subclass||'').toUpperCase();const L0=sub[0];
    txt=`A ${escapeHtml(s.subclass||'')} star. `+({O:'Very hot (over 30,000 K): few lines, mostly ionised helium; the light peaks in the ultraviolet.',B:'Hot and blue: helium and hydrogen lines, a continuum rising to the blue.',A:'Hydrogen (Balmer) lines are at their strongest in A stars, around 9,000 K.',F:'Balmer lines weaken while metal lines such as calcium H and K strengthen.',G:'Sun-like: strong calcium H and K lines and many metal lines; the continuum peaks in the yellow-green.',K:'Cooler and orange: metal lines dominate, magnesium and sodium are strong.',M:'Cool red dwarfs or giants: broad molecular bands of titanium oxide (TiO) carve up the red end.',W:'A white dwarf: very broad hydrogen lines from its extreme surface gravity.',C:'A carbon star: carbon molecules absorb most of the blue light.'}[L0]||'');}
  else{const zz=s.z;const v=zz<0.1?c*zz:c*((1+zz)**2-1)/((1+zz)**2+1);const d=zz>0.003?v/70:null;
    txt=`Redshift z = ${zz.toFixed(4)}: every line appears ${(zz*100).toFixed(2)}% longer in wavelength than in the lab, so it is receding at about ${Math.round(v).toLocaleString('en-US')} km/s. `+(d?`By Hubble’s law that is roughly ${d>=1000?(d/1000).toFixed(2)+' billion':Math.round(d)+' million'} parsecs (${(d*3.2616/(d>=1000?1000:1)).toFixed(d>=1000?2:0)} ${d>=1000?'billion':'million'} light-years). `:'')+
      (s.class==='QSO'?'Broad emission lines come from gas whirling at thousands of km/s around a supermassive black hole.':'Emission lines ([O III], Hα, [N II]) mean gas is being lit by young stars or an active nucleus; strong absorption (Ca H and K, Mg b, Na D) means older stars dominate.')}
  $('spRes').innerHTML=txt+` <span class="muted">SDSS ${escapeHtml(s.class||'')}${s.subclass?' · '+escapeHtml(s.subclass):''}.</span>`;
}
// details-panel buttons for objects that have lab data
function labActionsFor(sel){if(!LAB.index||!sel)return'';if(sel.kind==='dso'&&(LAB.index.spectra||[]).some(x=>x.dso===sel.ref.id))return'<button class="btn" id="labSpBtn">Spectrum (SDSS)</button>';return''}
function labWire(sel){const b=$('labSpBtn');if(!b)return;b.onclick=()=>{const x=LAB.index.spectra.find(x=>x.dso===sel.ref.id);LAB.spId=x.id;LAB.sp=null;LAB.mode='sp';store.set('lab.mode','sp');openTab('lab')}}
registerTab('lab','Lab',renderLab);
labLoadIndex();
