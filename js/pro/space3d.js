"use strict";
/* ================= 3D VIEWS (three.js, loaded only when opened) =================
   Solar system: real heliocentric positions from Astronomy Engine, true orbits, comets and asteroids.
   Star neighbourhood: every catalogue star with a measured distance, placed in 3D in galactic coordinates. */
const S3={open:false,mode:store.get('s3.mode','solar'),ready:false,loading:null,R:null,scene:null,cam:null,ctl:null,objs:{},labels:[],pick:[],
  trueSize:store.get('s3.true',false),range:store.get('s3.range',100),con:store.get('s3.con',true),ast:store.get('s3.ast',true),dirty:true,lastMs:0,follow:null,raf:0};
const LIB3D=window.LIB3D_OVERRIDE||['https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js','https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
function load3D(){if(S3.loading)return S3.loading;S3.loading=new Promise((res,rej)=>{let i=0;const next=()=>{if(i>=LIB3D.length){res();return}const s=document.createElement('script');s.src=LIB3D[i++];s.onload=next;s.onerror=()=>rej(new Error('Could not load '+s.src));document.head.appendChild(s)};next()});return S3.loading}
(function buildPane(){
  const p=document.createElement('div');p.id='spacePane';p.hidden=true;
  p.innerHTML=`<div class="s3bar glass"><span class="seg" id="s3Mode"><button data-m="solar">Solar system</button><button data-m="stars">Star neighbourhood</button></span>
    <span id="s3Opts"></span><span style="flex:1"></span><span id="s3Date" class="s3date"></span><button class="btn" id="s3Close">Close</button></div>
    <div class="s3wrap"><canvas id="s3c"></canvas><canvas id="s3l"></canvas><div class="s3hint" id="s3Hint"></div></div>`;
  $('stage').appendChild(p);
  const st=document.createElement('style');st.textContent=`#spacePane{position:absolute;inset:0;z-index:7;background:#000;display:flex;flex-direction:column}#spacePane[hidden]{display:none}
  .s3bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:0;border-width:0 0 1px;flex-wrap:wrap}.s3bar .seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .s3bar .seg button{background:none;border:0;padding:6px 10px;font-size:13px;color:var(--dim)}.s3bar .seg button+button{border-left:1px solid var(--line)}.s3bar .seg button.on{color:var(--brass);background:rgba(217,182,108,.08)}
  .s3bar label{font-size:13px;display:inline-flex;gap:5px;align-items:center;margin-left:6px}.s3bar select{background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;padding:5px 7px;color:var(--text);font-size:13px}.s3bar select option{background:var(--panel-solid)}
  .s3date{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}.s3wrap{flex:1;position:relative;min-height:0}#s3c,#s3l{position:absolute;inset:0;width:100%;height:100%;display:block}#s3l{pointer-events:none}
  .s3hint{position:absolute;left:12px;bottom:12px;max-width:560px;font-size:12.5px;line-height:1.45;color:var(--dim);background:rgba(12,16,32,.78);border:1px solid var(--line);border-radius:10px;padding:8px 12px;pointer-events:none}`;document.head.appendChild(st);
  $('s3Close').onclick=()=>close3D();
  $('s3Mode').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{S3.mode=b.dataset.m;store.set('s3.mode',S3.mode);build3D()});
})();
async function open3D(mode){
  if(mode){S3.mode=mode;store.set('s3.mode',mode)}
  $('spacePane').hidden=false;S3.open=true;$('s3Hint').textContent='Loading the 3D engine…';
  try{await load3D()}catch(e){$('s3Hint').textContent=HOSTED?'The 3D engine (three.js) could not load. Check your internet connection.':'The 3D view needs your hosted copy (GitHub Pages): this embedded viewer blocks the 3D library.';return}
  if(!S3.ready)init3D();build3D();loop3D();
}
function close3D(){$('spacePane').hidden=true;S3.open=false;cancelAnimationFrame(S3.raf);requestRender()}
function init3D(){
  const c=$('s3c');S3.R=new THREE.WebGLRenderer({canvas:c,antialias:true,powerPreference:'high-performance'});S3.R.setPixelRatio(Math.min(devicePixelRatio||1,2));
  S3.cam=new THREE.PerspectiveCamera(50,1,0.0005,1e6);S3.ctl=new THREE.OrbitControls(S3.cam,c);S3.ctl.enableDamping=true;S3.ctl.dampingFactor=0.12;S3.ctl.addEventListener('change',()=>{S3.dirty=true});
  S3.ray=new THREE.Raycaster();S3.ray.params.Points.threshold=0.5;
  let down=null;c.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
  c.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)return;pick3D(e)});
  c.addEventListener('dblclick',e=>{const hit=pick3D(e,true);if(hit)focus3D(hit)});
  if(window.ResizeObserver)new ResizeObserver(()=>{S3.dirty=true}).observe(c);
  S3.ready=true;
}
function size3D(){const c=$('s3c');const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;if(S3.w!==w||S3.h!==h){S3.w=w;S3.h=h;S3.R.setSize(w,h,false);S3.cam.aspect=w/h;S3.cam.updateProjectionMatrix();const l=$('s3l');l.width=w*DPR;l.height=h*DPR;S3.dirty=true}}
// ecliptic (x,y,z; z = ecliptic north) -> three.js (y up)
const e2t=(x,y,z)=>new THREE.Vector3(x,z,-y);
let ROT_EQJ_ECL=null,ROT_EQJ_GAL=null;
function eqjToEcl(v){if(!ROT_EQJ_ECL){ROT_EQJ_ECL=new Float64Array(9);setRot(ROT_EQJ_ECL,A.Rotation_EQJ_ECL().rot)}const o=[0,0,0];applyM(ROT_EQJ_ECL,v[0],v[1],v[2],o);return o}
function eqjToGal(v){if(!ROT_EQJ_GAL){ROT_EQJ_GAL=new Float64Array(9);setRot(ROT_EQJ_GAL,A.Rotation_EQJ_GAL().rot)}const o=[0,0,0];applyM(ROT_EQJ_GAL,v[0],v[1],v[2],o);return o}
function clear3D(){if(!S3.scene)return;S3.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})}});S3.scene=null;S3.objs={};S3.labels=[];S3.pick=[];S3.follow=null}
function build3D(){
  clear3D();S3.scene=new THREE.Scene();S3.dirty=true;
  $('s3Mode').querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===S3.mode));
  if(S3.mode==='solar')buildSolar();else buildStars();
}
/* ---------- solar system ---------- */
const ORRERY=[['Mercury',87.97,0.025,'#b9aa96'],['Venus',224.7,0.04,'#e8d9b0'],['Earth',365.256,0.042,'#4a7fd0'],['Mars',686.98,0.032,'#d27a52'],['Jupiter',4332.6,0.12,'#d9c2a0'],['Saturn',10759,0.1,'#e3cf9a'],['Uranus',30687,0.07,'#a8dfe6'],['Neptune',60190,0.07,'#6f8fe8'],['Pluto',90560,0.02,'#d8c4ad']];
const BODY_R={Mercury:2439.7,Venus:6051.8,Earth:6371,Mars:3389.5,Jupiter:71492,Saturn:60268,Uranus:25559,Neptune:24764,Pluto:1188,Moon:1737.4,Sun:695700};
function radius3D(name,big){const t=BODY_R[name]/AU_KM;if(S3.trueSize)return t;if(name==='Sun')return 0.11;if(name==='Moon')return 0.012;return(ORRERY.find(o=>o[0]===name)||[0,0,0.03])[2]}
function solarOpts(){
  $('s3Opts').innerHTML=`<span class="seg" id="s3Speed">${[[0,'Pause'],[86400,'1 day/s'],[604800,'1 week/s'],[2592000,'1 month/s'],[31557600,'1 year/s']].map(([r,l])=>`<button data-r="${r}" class="${(S.live?1:S.rate)===r||(r===0&&!S.live&&S.rate===1)?'on':''}">${l}</button>`).join('')}</span>
   <label><input type="checkbox" id="s3True" ${S3.trueSize?'checked':''}> True sizes</label><label><input type="checkbox" id="s3Ast" ${S3.ast?'checked':''}> Asteroids &amp; comets</label>
   <select id="s3View"><option value="">Go to…</option><option value="inner">Inner planets</option><option value="outer">Whole system</option>${ORRERY.map(o=>`<option>${o[0]}</option>`).join('')}<option>Sun</option></select>`;
  $('s3Speed').querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=+b.dataset.r;if(r===0){S.live=false;S.rate=1;rateIdx=0}else{S.live=false;S.rate=r}$('nowBtn').classList.remove('on');updateClock();requestRender();solarOpts()});
  $('s3True').onchange=e=>{S3.trueSize=e.target.checked;store.set('s3.true',S3.trueSize);build3D()};
  $('s3Ast').onchange=e=>{S3.ast=e.target.checked;store.set('s3.ast',S3.ast);build3D()};
  $('s3View').onchange=e=>{const v=e.target.value;e.target.value='';if(v==='inner')setView3D([0,2.2,3.2],[0,0,0]);else if(v==='outer')setView3D([0,30,42],[0,0,0]);else if(v){const o=S3.objs[v];if(o)focus3D(o)}};
}
function buildSolar(){
  solarOpts();const sc=S3.scene;sc.add(new THREE.AmbientLight(0x404858,0.35));const light=new THREE.PointLight(0xffffff,1.6,0,0);sc.add(light);
  const tl=new THREE.TextureLoader();
  const sun=new THREE.Mesh(new THREE.SphereGeometry(radius3D('Sun'),48,32),new THREE.MeshBasicMaterial({color:0xfff2cc}));sun.userData={name:'Sun',sel:{kind:'planet',ref:PLANETS[0]}};sc.add(sun);S3.objs.Sun=sun;S3.pick.push(sun);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffe7b0,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.setScalar(radius3D('Sun')*(S3.trueSize?12:6));sun.add(glow);
  const t=A.MakeTime(new Date(S.simMs));
  for(const [name,period,,col] of ORRERY){
    const body=A.Body[name];const r=radius3D(name);const key=name.toLowerCase();
    const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0});
    tl.load('img/planets/'+key+'.webp',tx=>{mat.map=tx;mat.needsUpdate=true;S3.dirty=true},undefined,()=>{mat.color.set(col);S3.dirty=true});
    const g=new THREE.Group();const m=new THREE.Mesh(new THREE.SphereGeometry(r,48,32),mat);g.add(m);
    if(name==='Saturn'){const rg=new THREE.RingGeometry(r*1.24,r*2.27,96,1);const pos=rg.attributes.position,uv=rg.attributes.uv;for(let i=0;i<pos.count;i++){const d=Math.hypot(pos.getX(i),pos.getY(i));uv.setXY(i,(d-r*1.24)/(r*1.03),0.5)}
      const ring=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({map:ringTex(),side:THREE.DoubleSide,transparent:true,depthWrite:false}));ring.rotation.x=-Math.PI/2;g.add(ring)}
    orientBody(g,name,t);g.userData={name,sel:{kind:'planet',ref:PLANETS.find(p=>p.key===name)}||null};m.userData=g.userData;sc.add(g);S3.objs[name]=g;S3.pick.push(m);
    // orbit: sample one full period ending now
    const pts=[];const n=360;for(let k=0;k<=n;k++){const tt=A.MakeTime(new Date(S.simMs-period*864e5*k/n));const v=A.HelioVector(body,tt);const e=eqjToEcl([v.x,v.y,v.z]);pts.push(e2t(e[0],e[1],e[2]))}
    const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:new THREE.Color(col),transparent:true,opacity:0.45}));sc.add(orbit);
    if(name==='Earth'){const mm=new THREE.Mesh(new THREE.SphereGeometry(radius3D('Moon'),24,16),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}));tl.load('img/planets/moon.webp',tx=>{mm.material.map=tx;mm.material.needsUpdate=true;S3.dirty=true});mm.userData={name:'Moon',sel:{kind:'planet',ref:PLANETS.find(p=>p.key==='Moon')}};sc.add(mm);S3.objs.Moon=mm;S3.pick.push(mm)}
  }
  if(S3.ast&&typeof SB!=='undefined'){SB.key='';sbUpdate();if(!SB.loaded)sbLoad().then(()=>{if(S3.open&&S3.mode==='solar')build3D()});
    const as=SB.list.filter(o=>o.type==='asteroid');if(as.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(as.length*3),3));
      const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xb9a8e8,size:2,sizeAttenuation:false,transparent:true,opacity:0.75}));pts.userData={asteroids:as};sc.add(pts);S3.objs._ast=pts}
    const jd=jdOf(S.simMs);for(const o of SB.list.filter(o=>o.type==='comet')){if(!o.st)continue;if(o.st.mag>12&&!(S.sel&&S.sel.ref===o))continue;
      const pts=[];const span=o.e<1?Math.min(2*Math.PI/(GAUSS_K/Math.pow(o.q/(1-o.e),1.5)),3650):730;for(let k=0;k<=240;k++){const h=sbHelio(o,o.T-span/2+span*k/240);const e=eqjToEcl(h);pts.push(e2t(e[0],e[1],e[2]))}
      sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x9fd4ff,transparent:true,opacity:0.5})));
      const cm=new THREE.Mesh(new THREE.SphereGeometry(S3.trueSize?0.0005:0.015,12,8),new THREE.MeshBasicMaterial({color:0xcfefff}));cm.userData={name:o.name,sel:{kind:'sb',ref:o},comet:o};sc.add(cm);S3.objs['comet:'+o.name]=cm;S3.pick.push(cm)}}
  S3.lastMs=0;updateSolar();if(!S3.viewSet){setView3D([0,2.2,3.2],[0,0,0]);S3.viewSet=true}
  $('s3Hint').textContent='Drag to orbit, scroll to zoom, right-drag to pan. Click a body for details; double-click to follow it. Planet sizes are enlarged unless “True sizes” is on (then they are invisible dots, which is the real scale of the solar system). Positions are computed for the date shown, so speed up time to watch the planets move.';
}
function orientBody(g,name,t){try{const ax=A.RotationAxis(A.Body[name],t);const n=eqjToEcl([ax.north.x,ax.north.y,ax.north.z]);const up=e2t(n[0],n[1],n[2]).normalize();
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);g.children[0].rotation.y=(ax.spin%360)*DEG}catch(e){}}
function updateSolar(){
  if(Math.abs(S.simMs-S3.lastMs)<1000&&S3.lastMs)return;S3.lastMs=S.simMs;const t=A.MakeTime(new Date(S.simMs));
  for(const [name] of ORRERY){const g=S3.objs[name];if(!g)continue;const v=A.HelioVector(A.Body[name],t);const e=eqjToEcl([v.x,v.y,v.z]);g.position.copy(e2t(e[0],e[1],e[2]));orientBody(g,name,t)}
  const E=S3.objs.Earth,Mo=S3.objs.Moon;if(E&&Mo){const mv=A.GeoMoon(t);const e=eqjToEcl([mv.x,mv.y,mv.z]);const k=S3.trueSize?1:40;Mo.position.copy(E.position).add(e2t(e[0]*k,e[1]*k,e[2]*k))}
  const ast=S3.objs._ast;if(ast){const jd=jdOf(S.simMs)+69.2/86400;const arr=ast.geometry.attributes.position.array;ast.userData.asteroids.forEach((o,i)=>{const h=sbHelio(o,jd);const e=eqjToEcl(h);arr[3*i]=e[0];arr[3*i+1]=e[2];arr[3*i+2]=-e[1]});ast.geometry.attributes.position.needsUpdate=true}
  for(const k in S3.objs)if(k.startsWith('comet:')){const m=S3.objs[k];const h=sbHelio(m.userData.comet,jdOf(S.simMs));const e=eqjToEcl(h);m.position.copy(e2t(e[0],e[1],e[2]))}
  if(S3.follow){const p=S3.follow.getWorldPosition(new THREE.Vector3());const d=p.clone().sub(S3.ctl.target);S3.ctl.target.add(d);S3.cam.position.add(d)}
  $('s3Date').textContent=fmtT(S.simMs,true)+' '+tzLabel(S.simMs);S3.dirty=true;
}
let _glowTex=null;function glowTex(){if(_glowTex)return _glowTex;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.2,'rgba(255,240,200,.6)');gr.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);_glowTex=new THREE.CanvasTexture(c);return _glowTex}
function ringTex(){const c=document.createElement('canvas');c.width=256;c.height=4;const g=c.getContext('2d');for(let x=0;x<256;x++){const rr=1.24+1.03*x/256;let a=0;if(rr<1.53)a=0.22;else if(rr<1.95)a=0.9;else if(rr<2.03)a=0.08;else a=0.65;const b=180+Math.sin(x*0.7)*20;g.fillStyle=`rgba(${b+30},${b+15},${b-10},${a})`;g.fillRect(x,0,1,4)}return new THREE.CanvasTexture(c)}
/* ---------- star neighbourhood ---------- */
function starsOpts(){
  $('s3Opts').innerHTML=`<label>Show stars within <select id="s3Range">${[20,50,100,250,500,1000,3000].map(r=>`<option value="${r}" ${r===S3.range?'selected':''}>${r.toLocaleString('en-US')} light-years</option>`).join('')}</select></label>
   <label><input type="checkbox" id="s3Con" ${S3.con?'checked':''}> Constellation figures in 3D</label><button class="btn" id="s3Home">Back to the Sun</button>`;
  $('s3Range').onchange=e=>{S3.range=+e.target.value;store.set('s3.range',S3.range);build3D()};
  $('s3Con').onchange=e=>{S3.con=e.target.checked;store.set('s3.con',S3.con);build3D()};
  $('s3Home').onclick=()=>{S3.follow=null;setView3D([0,S3.range*0.5,S3.range*1.1],[0,0,0])};
}
function starPos(i,maxLy){const pc=starDistPc(i);if(!(pc>0))return null;const ly=pc*3.26156;if(maxLy&&ly>maxLy)return null;const g=eqjToGal([sx[i],sy[i],sz[i]]);return new THREE.Vector3(g[0]*ly,g[2]*ly,-g[1]*ly)}
function buildStars(){
  starsOpts();const sc=S3.scene;const R=S3.range;
  const idx=[];for(let i=0;i<N;i++){const pc=starDistPc(i);if(pc>0&&pc*3.26156<=R&&!(sMag[i]<-1&&pc<0.01))idx.push(i)}
  const pos=new Float32Array(idx.length*3),col=new Float32Array(idx.length*3),size=new Float32Array(idx.length);
  idx.forEach((i,k)=>{const p=starPos(i);pos[3*k]=p.x;pos[3*k+1]=p.y;pos[3*k+2]=p.z;const c=bucketCol[bucketOfCI[sCI[i]+128]];col[3*k]=c[0]/255;col[3*k+1]=c[1]/255;col[3*k+2]=c[2]/255;
    const absM=sMag[i]-5*Math.log10(starDistPc(i)/10);size[k]=clamp(9-absM*0.9,1.6,18)});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('size',new THREE.BufferAttribute(size,1));
  const mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:1}},vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float size;varying vec3 vC;uniform float uScale;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(size*uScale*30.0/max(-mv.z,0.5),1.5,size*2.2);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vC;void main(){vec2 q=gl_PointCoord*2.0-1.0;float d=dot(q,q);if(d>1.0)discard;float a=exp(-d*5.0)+0.4*exp(-d*60.0);gl_FragColor=vec4(mix(vC,vec3(1.0),exp(-d*40.0)*0.8),a);}`});
  mat.uniforms.uScale.value=Math.max(1,R/30);
  const points=new THREE.Points(geo,mat);points.userData={idx};sc.add(points);S3.objs._stars=points;S3.pick.push(points);S3.ray.params.Points.threshold=Math.max(0.15,R/400);
  // the Sun
  const sun=new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.05,R/600),16,12),new THREE.MeshBasicMaterial({color:0xffe9a8}));sun.userData={name:'Sun (you are here)'};sc.add(sun);S3.objs.SunMark=sun;
  // distance rings in the galactic plane + galactic centre direction
  for(const r of[10,25,50,100,250,500,1000,2500].filter(r=>r<=R)){const pts=[];for(let a=0;a<=360;a+=3)pts.push(new THREE.Vector3(Math.cos(a*DEG)*r,0,-Math.sin(a*DEG)*r));sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x3a4a6a,transparent:true,opacity:0.55})));S3.labels.push({p:new THREE.Vector3(r*0.71,0,-r*0.71),t:r.toLocaleString('en-US')+' ly',ring:true})}
  sc.add(new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,0),R*0.9,0xd9b66c,R*0.04,R*0.02));S3.labels.push({p:new THREE.Vector3(R*0.92,0,0),t:'toward the galactic centre (26,000 ly, in Sagittarius)',dir:true});
  // constellation figures in true 3D
  if(S3.con){const segs=[];const near=v=>{let best=-1,bc=Math.cos(0.35*DEG);for(let i=0;i<N&&sMag[i]<6.6;i++){const c=sx[i]*v[0]+sy[i]*v[1]+sz[i]*v[2];if(c>bc){bc=c;best=i}}return best};
    for(const c of LINES)for(const s of c.segs)for(let k=0;k+1<s.length;k++){const a=near(s[k]),b=near(s[k+1]);if(a<0||b<0)continue;const pa=starPos(a,R*1.5),pb=starPos(b,R*1.5);if(pa&&pb)segs.push(pa,pb)}
    sc.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs),new THREE.LineBasicMaterial({color:0x7896d2,transparent:true,opacity:0.35})))}
  // labels: named stars
  for(const i of idx){const n=named.get(i);if(!n||!n.proper)continue;const absM=sMag[i]-5*Math.log10(starDistPc(i)/10);if(absM<2.5||starDistPc(i)*3.26156<15)S3.labels.push({p:starPos(i),t:n.proper,i})}
  if(S3.con)for(let i=0;i<N&&sMag[i]<1.6;i++){const n=named.get(i);if(n&&n.proper&&!idx.includes(i)){const p=starPos(i,R*1.5);if(p)S3.labels.push({p,t:n.proper+' ('+Math.round(starDistPc(i)*3.26156).toLocaleString('en-US')+' ly)',i,far:true})}}
  setView3D([0,R*0.5,R*1.1],[0,0,0]);
  $('s3Hint').textContent=`${idx.length.toLocaleString('en-US')} stars within ${R.toLocaleString('en-US')} light-years, in their true 3D positions (galactic plane horizontal, the Sun at the centre). ${S3.con?'Blue lines are constellation figures (drawn where their stars lie within this range; choose 1,000 or 3,000 ly to see whole constellations): from out here you can see their stars lie at very different distances, so a constellation is only a pattern as seen from Earth. ':''}Click a star for details, double-click to fly to it and orbit around it.`;
}
/* ---------- shared ---------- */
function setView3D(p,t){S3.follow=null;S3.cam.position.set(p[0],p[1],p[2]);S3.ctl.target.set(t[0],t[1],t[2]);S3.ctl.update();S3.dirty=true}
function pick3D(e,noInfo){
  const c=$('s3c');const r=c.getBoundingClientRect();const m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);S3.ray.setFromCamera(m,S3.cam);
  const hits=S3.ray.intersectObjects(S3.pick,false);if(!hits.length)return null;const h=hits[0];
  if(h.object===S3.objs._stars){const i=h.object.userData.idx[h.index];const sel={kind:'star',ref:i};if(!noInfo)showInfo(sel);return{star:i,point:starPos(i)}}
  const ud=h.object.userData;if(ud.sel&&!noInfo)showInfo(ud.sel);return{obj:h.object.parent&&h.object.parent.type==='Group'?h.object.parent:h.object};
}
function focus3D(hit){
  if(hit.star!=null){const p=hit.point;const d=Math.max(0.5,S3.range/40);S3.ctl.target.copy(p);S3.cam.position.copy(p.clone().add(new THREE.Vector3(d,d*0.4,d)));S3.ctl.update();S3.dirty=true;return}
  const o=hit.obj||hit;const p=o.getWorldPosition(new THREE.Vector3());const rad=(o.children&&o.children[0]&&o.children[0].geometry&&o.children[0].geometry.parameters.radius)||(o.geometry&&o.geometry.parameters&&o.geometry.parameters.radius)||0.05;
  const d=rad*8;S3.ctl.target.copy(p);S3.cam.position.copy(p.clone().add(new THREE.Vector3(d,d*0.5,d)));S3.follow=o;S3.ctl.update();S3.dirty=true;
}
function drawLabels3D(){
  const l=$('s3l');const g=l.getContext('2d');g.setTransform(DPR,0,0,DPR,0,0);g.clearRect(0,0,S3.w,S3.h);g.font='12px Jost, sans-serif';const occ=[];
  const put=(v,text,color)=>{const p=v.clone().project(S3.cam);if(p.z>1||p.z<-1)return;const x=(p.x+1)/2*S3.w,y=(1-p.y)/2*S3.h;if(x<0||y<0||x>S3.w||y>S3.h)return;const w=g.measureText(text).width;
    for(const o of occ)if(x+6<o[0]+o[2]&&x+6+w>o[0]&&y-14<o[1]+14&&y>o[1])return;occ.push([x+6,y-14,w]);g.fillStyle='rgba(0,0,0,.6)';g.fillText(text,x+7,y-5);g.fillStyle=color;g.fillText(text,x+6,y-6)};
  if(S3.mode==='solar'){for(const k in S3.objs){if(k.startsWith('_'))continue;const o=S3.objs[k];if(!o.userData||!o.userData.name)continue;put(o.getWorldPosition(new THREE.Vector3()),o.userData.name,k.startsWith('comet:')?'#bfe3ff':'#f2cf86')}}
  else{put(new THREE.Vector3(0,0,0),'Sun','#ffe9a8');for(const L of S3.labels)put(L.p,L.t,L.ring?'rgba(140,160,200,.8)':L.dir?'#d9b66c':L.far?'rgba(160,180,230,.85)':'#d8d1be')}
}
function loop3D(){
  cancelAnimationFrame(S3.raf);
  const tick=()=>{if(!S3.open)return;size3D();S3.ctl.update();
    if(S3.mode==='solar')updateSolar();
    if(S3.dirty){S3.dirty=false;S3.R.render(S3.scene,S3.cam);drawLabels3D()}
    S3.raf=requestAnimationFrame(tick)};tick();
}
registerTab('space','3D',el=>{el.innerHTML=`<h4>Explore in 3D</h4><p class="muted">Leave the sky behind and see where things really are.</p>
  <button class="target" id="s3a"><b>Solar system</b><span>The planets in their real positions for the chosen date, with true orbits, the Moon, asteroids and comets. Speed up time to watch them move.</span></button>
  <button class="target" id="s3b"><b>Star neighbourhood</b><span>Every catalogue star with a measured distance, placed in 3D around the Sun. Turn on constellation figures to see that their stars lie at very different distances.</span></button>`;
  $('s3a').onclick=()=>open3D('solar');$('s3b').onclick=()=>open3D('stars')});
KEYS.push(['D','3D view']);
window.addEventListener('keydown',e=>{const tag=e.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;if(!$('palette').hidden)return;
  if(e.key==='d'||e.key==='D'){e.preventDefault();S3.open?close3D():open3D()}else if(e.key==='Escape'&&S3.open)close3D()});
