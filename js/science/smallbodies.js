"use strict";
/* ================= COMETS AND ASTEROIDS =================
   Orbital elements (J2000 ecliptic) are refreshed by the data workflow: comets from the Minor Planet
   Center, bright asteroids (H < 11) from JPL. Positions are computed here with two-body Kepler orbits,
   which is accurate to roughly an arcminute while the elements are fresh. */
const SB={list:[],status:'not loaded',loaded:false,key:'',earth:null,sun:null};
const GAUSS_K=0.01720209895, OBL=23.4392911*DEG, AU_KM=149597870.7, C_AUD=173.1446327;
function jdOf(ms){return ms/864e5+2440587.5}
function calJD(y,m,d){return Date.UTC(y,m-1,1)/864e5+2440587.5+(d-1)}
function sbParseComets(txt){
  const out=[];for(const line of txt.split(/\r?\n/)){if(line.length<100)continue;
    const y=+line.slice(14,18),mo=+line.slice(19,21),d=parseFloat(line.slice(22,29));const q=parseFloat(line.slice(30,39)),e=parseFloat(line.slice(41,49));
    const w=parseFloat(line.slice(51,59)),om=parseFloat(line.slice(61,69)),inc=parseFloat(line.slice(71,79));const H=parseFloat(line.slice(91,95)),k=parseFloat(line.slice(96,100));
    const name=line.slice(102,158).trim();if(!name||!(q>0)||!(e>=0)||!y)continue;
    out.push({type:'comet',name,q,e,w,om,i:inc,T:calJD(y,mo,d),H:isFinite(H)?H:12,k:isFinite(k)?k:4})}
  return out;
}
function sbParseAsteroids(j){
  const f=j.fields||[];const ix=n=>f.indexOf(n);const out=[];
  for(const r of j.data||[]){const num=x=>{const v=parseFloat(r[ix(x)]);return isFinite(v)?v:null};
    let name=String(r[ix('full_name')]||'').trim().replace(/\s+\(.*\)$/,'').replace(/^(\d+)\s+/,'$1 ');
    const a=num('a'),e=num('e');if(!(a>0)||e==null)continue;
    out.push({type:'asteroid',name,a,e,q:num('q')||a*(1-e),i:num('i'),om:num('om'),w:num('w'),ma:num('ma'),epoch:num('epoch'),H:num('H')??12,G:num('G')??0.15,cls:r[ix('class')]||''})}
  return out;
}
// heliocentric J2000 equatorial position (AU) at Julian date jd
function sbHelio(o,jd){
  let x,y;const e=o.e;
  if(o.type==='asteroid'||e<0.9999){
    const a=o.type==='asteroid'?o.a:o.q/(1-e);const n=GAUSS_K/Math.pow(a,1.5);
    let M=o.type==='asteroid'?o.ma*DEG+n*(jd-o.epoch):n*(jd-o.T);M=((M%TAU)+TAU+Math.PI)%TAU-Math.PI;
    let E=e<0.8?M:Math.PI*Math.sign(M||1);for(let k=0;k<60;k++){const dE=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=dE;if(Math.abs(dE)<1e-12)break}
    x=a*(Math.cos(E)-e);y=a*Math.sqrt(1-e*e)*Math.sin(E);
  } else if(e>1.0001){
    const a=o.q/(e-1);const n=GAUSS_K/Math.pow(a,1.5);const M=n*(jd-o.T);
    let Hh=Math.sign(M)*Math.log(2*Math.abs(M)/e+1.8);for(let k=0;k<80;k++){const dH=(e*Math.sinh(Hh)-Hh-M)/(e*Math.cosh(Hh)-1);Hh-=dH;if(Math.abs(dH)<1e-12)break}
    x=a*(e-Math.cosh(Hh));y=a*Math.sqrt(e*e-1)*Math.sinh(Hh);
  } else { // parabolic (Barker's equation)
    const W=3*GAUSS_K*(jd-o.T)/Math.sqrt(2*o.q*o.q*o.q);const Y=Math.cbrt(W/2+Math.sqrt(W*W/4+1));const s=Y-1/Y;const r=o.q*(1+s*s);const nu=2*Math.atan(s);
    x=r*Math.cos(nu);y=r*Math.sin(nu);
  }
  const O=o.om*DEG,w=o.w*DEG,i=o.i*DEG;const cO=Math.cos(O),sO=Math.sin(O),cw=Math.cos(w),sw=Math.sin(w),ci=Math.cos(i),si=Math.sin(i);
  const X=(cO*cw-sO*sw*ci)*x+(-cO*sw-sO*cw*ci)*y,Yy=(sO*cw+cO*sw*ci)*x+(-sO*sw+cO*cw*ci)*y,Z=(sw*si)*x+(cw*si)*y;
  return[X,Yy*Math.cos(OBL)-Z*Math.sin(OBL),Yy*Math.sin(OBL)+Z*Math.cos(OBL)];
}
function sbState(o,ms,earth){
  const jd=jdOf(ms)+69.2/86400; // TT
  let h=sbHelio(o,jd);let g=[h[0]-earth[0],h[1]-earth[1],h[2]-earth[2]];let D=Math.hypot(...g);
  h=sbHelio(o,jd-D/C_AUD);g=[h[0]-earth[0],h[1]-earth[1],h[2]-earth[2]];D=Math.hypot(...g); // light-time
  const r=Math.hypot(...h);const cosA=clamp((r*r+D*D-Math.hypot(...earth)**2)/(2*r*D),-1,1);const alpha=Math.acos(cosA);
  let mag;
  if(o.type==='asteroid'){const t=Math.tan(alpha/2);const p1=Math.exp(-3.33*Math.pow(t,0.63)),p2=Math.exp(-1.87*Math.pow(t,1.22));mag=o.H+5*Math.log10(r*D)-2.5*Math.log10(Math.max(1e-6,(1-o.G)*p1+o.G*p2))}
  else mag=o.H+5*Math.log10(D)+2.5*o.k*Math.log10(r);
  return{v:[g[0]/D,g[1]/D,g[2]/D],D,r,helio:h,mag,alpha:alpha*RAD};
}
async function sbLoad(){
  if(SB.loaded)return;SB.loaded=true;const parts=[];
  try{const t=await fetchText('data/comets.txt',20000);const c=sbParseComets(t);SB.list.push(...c);parts.push(c.length.toLocaleString('en-US')+' comets')}catch(e){}
  try{const j=await fetchJSON('data/asteroids.json',20000);const a=sbParseAsteroids(j);SB.list.push(...a);parts.push(a.length.toLocaleString('en-US')+' asteroids')}catch(e){}
  SB.status=parts.length?parts.join(' and ')+' (orbits from the Minor Planet Center and JPL)':(HOSTED?'not downloaded yet: run the “Update sky data” action':'available on your hosted copy');
  for(const o of SB.list)addIdx(o.name,(o.type==='comet'?'Comet':'Asteroid')+(o.cls?' · '+o.cls:''),{kind:'sb',ref:o},[o.name,o.name.replace(/^\d+\s+/,''),o.name.replace(/[()]/g,'')],o.type==='comet'?3:Math.min(9,o.H));
  refreshLayerStatus();SB.key='';requestRender();
}
function sbUpdate(){
  if(!SB.list.length)return;const key=Math.floor(S.simMs/60000);if(key===SB.key)return;SB.key=key; // positions change slowly: once per simulated minute
  const t=A.MakeTime(new Date(S.simMs));const ev=A.HelioVector(A.Body.Earth,t);SB.earth=[ev.x,ev.y,ev.z];
  for(const o of SB.list){try{o.st=sbState(o,S.simMs,SB.earth)}catch(e){o.st=null}}
}
function drawSmallBodies(){
  if(!SB.loaded){sbLoad();return}if(!SB.list.length)return;sbUpdate();
  const lim=lastFrameInfo.showLim;const solid=S.ground===2;
  for(const o of SB.list){const st=o.st;if(!st||!isFinite(st.mag))continue;if(st.mag>lim+0.3&&!(S.sel&&S.sel.ref===o))continue;
    projE(st.v,tmpO,tmpH);const alt=Math.asin(clamp(tmpH[2],-1,1))*RAD;if(solid&&alt<0)continue;if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<-40||Y<-40||X>W+40||Y>H+40)continue;
    const dm=Math.max(0,lim-st.mag);const r=Math.min(4,1.2+0.35*dm);ctx.globalAlpha=alt<0?0.45:1;
    if(o.type==='comet'){
      if(st.mag<11){ // ion tail points away from the Sun
        const L=clamp(0.02+0.012*(11-st.mag),0.02,0.25)/Math.max(0.3,st.r);const rh=normV(st.helio);const g=[st.v[0]*st.D+rh[0]*L,st.v[1]*st.D+rh[1]*L,st.v[2]*st.D+rh[2]*L];
        const p=[0,0,0];projE(normV(g),p);if(!behind(p[2])){const gr=ctx.createLinearGradient(X,Y,p[0],p[1]);gr.addColorStop(0,'rgba(170,220,255,.55)');gr.addColorStop(1,'rgba(170,220,255,0)');ctx.strokeStyle=gr;ctx.lineWidth=Math.min(5,1+dm*0.5);ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(p[0],p[1]);ctx.stroke()}}
      const g2=ctx.createRadialGradient(X,Y,0,X,Y,r*2.5);g2.addColorStop(0,'rgba(220,245,255,1)');g2.addColorStop(1,'rgba(150,210,255,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(X,Y,r*2.5,0,TAU);ctx.fill();
    } else {ctx.fillStyle='#cdbdf2';ctx.beginPath();ctx.moveTo(X,Y-r-0.5);ctx.lineTo(X+r+0.5,Y);ctx.lineTo(X,Y+r+0.5);ctx.lineTo(X-r-0.5,Y);ctx.closePath();ctx.fill()}
    ctx.globalAlpha=1;
    if(st.mag<lim-2||S.fov<15)label(o.name,X,Y,'400 11.5px Jost, sans-serif',o.type==='comet'?'#bfe3ff':'#cdbdf2',5,-4);
    hitObjs.push({x:X,y:Y,r:10,kind:'sb',ref:o,prio:3});
  }
}
function sbVec(o){if(!o.st)sbUpdate();return o.st?o.st.v:null}
function sbNextPerihelion(o,jd){if(o.type==='comet')return o.T;const n=GAUSS_K/Math.pow(o.a,1.5);let M=(o.ma*DEG+n*(jd-o.epoch))%TAU;if(M<0)M+=TAU;return jd+(TAU-M)/n}
function sbInfo(o){
  const st=o.st||sbState(o,S.simMs,SB.earth||[1,0,0]);const jd=jdOf(S.simMs);
  const per=o.type==='asteroid'||o.e<1?2*Math.PI/(GAUSS_K/Math.pow(o.type==='asteroid'?o.a:o.q/(1-o.e),1.5))/365.25:null;
  const peri=sbNextPerihelion(o,jd);const periMs=(peri-2440587.5)*864e5;
  const neo=o.q<1.3;const kind=o.type==='comet'?(o.e>=1?'Comet on an open (hyperbolic or parabolic) orbit':per&&per<200?'Periodic comet':'Long-period comet'):(neo?'Near-Earth asteroid':o.cls==='TJN'?'Jupiter Trojan asteroid':o.cls==='TNO'?'Trans-Neptunian object':'Main-belt asteroid');
  const facts=`<dl class="kv"><dt>Brightness (predicted)</dt><dd>magnitude ${st.mag.toFixed(1)}${o.type==='comet'?' (comet brightness is notoriously hard to predict)':''}</dd>
  <dt>Distance from Earth</dt><dd>${st.D.toFixed(3)} AU (${Math.round(st.D*AU_KM/1e6).toLocaleString('en-US')} million km)</dd><dt>Distance from the Sun</dt><dd>${st.r.toFixed(3)} AU</dd><dt>Phase angle</dt><dd>${st.alpha.toFixed(1)}°</dd>
  ${per?`<dt>Orbital period</dt><dd>${per<2?(per*365.25).toFixed(0)+' days':per.toFixed(2)+' years'}</dd>`:''}<dt>${o.type==='comet'?'Perihelion':'Next perihelion'}</dt><dd>${fmtT(periMs,true)} at ${o.q.toFixed(3)} AU</dd>
  <dt>Eccentricity</dt><dd>${o.e.toFixed(4)}</dd><dt>Inclination</dt><dd>${o.i.toFixed(2)}°</dd>${o.type==='asteroid'?`<dt>Semi-major axis</dt><dd>${o.a.toFixed(3)} AU</dd><dt>Absolute magnitude H</dt><dd>${o.H.toFixed(1)}${o.H<=11?` (roughly ${Math.round(1329/Math.sqrt(0.15)*Math.pow(10,-o.H/5))} km across if it reflects 15% of light)`:''}</dd>`:''}</dl>`;
  const desc=o.type==='comet'?'A comet is a ball of ice and dust. Near the Sun it heats up and grows a fuzzy coma and tails that always point away from the Sun.':neo?'Its orbit brings it close to Earth’s. Near-Earth asteroids are tracked closely by planetary-defence surveys.':'A rocky or metallic body left over from the formation of the planets.';
  return{title:o.name,kind,aliases:o.cls?('JPL orbit class '+o.cls):'',v:st.v,mag:st.mag,isPoint:true,photo:'',facts,desc,src:'Orbital elements: '+(o.type==='comet'?'Minor Planet Center':'JPL Small-Body Database')+'; positions computed with a two-body orbit (no planetary perturbations), accurate to about an arcminute for recent elements.'};
}
