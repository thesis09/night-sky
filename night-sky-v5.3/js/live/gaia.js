"use strict";
/* ================= GAIA DR3 DEEP STARS =================
   Millions of stars in sky tiles (built by the "Build Gaia star tiles" GitHub Action).
   Tiles load only when you zoom in far enough to see stars fainter than the main catalogue,
   and only for the part of the sky in view. Each tile is drawn with the same GPU star shader. */
const GAIA={index:null,status:'not loaded',tiles:new Map(),loading:new Set(),queue:[],lru:[],cut:8.5,maxTiles:160,failed:false};
function gaiaEnabled(){return S.layers.gaia&&GL.ok&&GAIA.index&&GAIA.index.tiles.length>0}
function gaiaActive(showLim){return gaiaEnabled()&&showLim>GAIA.cut}
async function gaiaLoadIndex(){
  if(GAIA.index||GAIA.failed)return;GAIA.failed=true;
  try{const j=await fetchJSON('data/gaia/index.json?v='+Date.now().toString(36).slice(0,-3),15000);
    GAIA.index=j;GAIA.failed=false;j.tiles.forEach(t=>{t.v=unit(t.ra,t.dec)});
    GAIA.status=`${(j.count||0).toLocaleString('en-US')} stars to G ${j.glim} in ${j.tiles.length} tiles${/TEST/.test(j.source)?' (TEST DATA)':''}`;requestRender()}
  catch(e){GAIA.status=HOSTED?'not built yet: run the “Build Gaia star tiles” action on GitHub':'available on your hosted copy after running the “Build Gaia star tiles” action'}
  refreshLayerStatus();
}
// Gaia G and BP−RP → Johnson V and B−V (approximate colour transformations)
function gaiaV(G,c){if(!isFinite(c))return G+0.05;const x=clamp(c,-0.5,4);return G-(-0.02704+0.01424*x-0.2156*x*x+0.01426*x*x*x)}
function gaiaBV(c){return isFinite(c)?clamp(0.8*c-0.02,-0.4,2.0):0.6}
function gaiaTeff(c){if(!isFinite(c))return null;const x=clamp(c,-0.1,3.0);const th=0.4929+0.5092*x-0.0353*x*x;return 5040/th}
function parseTile(buf){
  const n=new Uint32Array(buf,0,1)[0];let o=8;
  const ids=new BigUint64Array(buf,o,n);o+=8*n;const ra=new Float32Array(buf,o,n);o+=4*n;const de=new Float32Array(buf,o,n);o+=4*n;
  const plx=new Float32Array(buf,o,n);o+=4*n;const g=new Int16Array(buf,o,n);o+=2*n;const bp=new Int16Array(buf.slice(o,o+2*n));
  // keep only stars fainter than the cut (brighter ones are already in the main catalogue)
  const keep=[];for(let i=0;i<n;i++){const G=g[i]/1000,c=bp[i]===-32768?NaN:bp[i]/1000;const V=gaiaV(G,c);if(V>GAIA.cut)keep.push(i)}
  // sort kept stars by V so "draw the first k" means "draw everything brighter than the limit"
  const V=new Float32Array(keep.length),idx=new Uint32Array(keep.length);
  const tmp=keep.map(i=>[gaiaV(g[i]/1000,bp[i]===-32768?NaN:bp[i]/1000),i]).sort((a,b)=>a[0]-b[0]);
  const m=tmp.length;const pos=new Float32Array(m*3),mag=new Float32Array(m),col=new Uint8Array(m*3);
  const T={n:m,ids:new BigUint64Array(m),ra:new Float32Array(m),de:new Float32Array(m),plx:new Float32Array(m),G:new Float32Array(m),bprp:new Float32Array(m),V:mag};
  for(let k=0;k<m;k++){const i=tmp[k][1];const c=bp[i]===-32768?NaN:bp[i]/1000;const r=ra[i],d=de[i],cd=Math.cos(d);
    pos[3*k]=cd*Math.cos(r);pos[3*k+1]=cd*Math.sin(r);pos[3*k+2]=Math.sin(d);mag[k]=tmp[k][0];
    const bv=gaiaBV(c);const b=bucketCol[Math.round(clamp((bv+0.4)/2.4,0,1)*(NB-1))];col[3*k]=b[0];col[3*k+1]=b[1];col[3*k+2]=b[2];
    T.ids[k]=ids[i];T.ra[k]=r;T.de[k]=d;T.plx[k]=plx[i];T.G[k]=g[i]/1000;T.bprp[k]=c}
  T.pos=pos;T.col=col;return T;
}
function gaiaUpload(T){const gl=GL.gl;T.bPos=glBuf(gl,T.pos);T.bMag=glBuf(gl,T.V);T.bCol=glBuf(gl,T.col);T.pos=null;T.col=null}
function gaiaFree(f){const T=GAIA.tiles.get(f);if(!T)return;const gl=GL.gl;try{gl.deleteBuffer(T.bPos);gl.deleteBuffer(T.bMag);gl.deleteBuffer(T.bCol)}catch(e){}GAIA.tiles.delete(f)}
function gaiaPump(){
  while(GAIA.loading.size<4&&GAIA.queue.length){const f=GAIA.queue.shift();if(GAIA.tiles.has(f)||GAIA.loading.has(f))continue;GAIA.loading.add(f);
    fetch('data/gaia/'+f).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()}).then(buf=>{const T=parseTile(buf);if(GL.ok)gaiaUpload(T);GAIA.tiles.set(f,T);
      GAIA.lru.push(f);while(GAIA.lru.length>GAIA.maxTiles){gaiaFree(GAIA.lru.shift())}requestRender()})
      .catch(()=>{}).finally(()=>{GAIA.loading.delete(f);gaiaPump()})}
}
function gaiaVisibleTiles(){
  const fE=[0,0,0];applyMT(M,...cam.f,fE);const half=Math.hypot(W,H)/2/scale;const viewAng=viewAngFromHalf(half)*RAD;
  const out=[];for(const t of GAIA.index.tiles){const sep=Math.acos(clamp(t.v[0]*fE[0]+t.v[1]*fE[1]+t.v[2]*fE[2],-1,1))*RAD;if(sep<viewAng+t.r)out.push(t)}return out;
}
// called from glFrame with the star program bound and uniforms set
function gaiaDraw(P,showLim){
  if(!gaiaActive(showLim))return 0;
  const vis=gaiaVisibleTiles();if(vis.length>GAIA.maxTiles*0.8)return 0; // too wide a view for deep stars
  const gl=GL.gl;let drawn=0;
  for(const t of vis){const T=GAIA.tiles.get(t.f);
    if(!T){if(!GAIA.loading.has(t.f)&&!GAIA.queue.includes(t.f))GAIA.queue.push(t.f);continue}
    const i=GAIA.lru.indexOf(t.f);if(i>=0){GAIA.lru.splice(i,1);GAIA.lru.push(t.f)}
    let lo=0,hi=T.n;while(lo<hi){const mid=(lo+hi)>>1;if(T.V[mid]<=showLim+0.05)lo=mid+1;else hi=mid}if(!lo)continue;
    bindAttr(P,'aPos',T.bPos,3);bindAttr(P,'aMag',T.bMag,1);bindAttr(P,'aCol',T.bCol,3,gl.UNSIGNED_BYTE,true);
    gl.drawArrays(gl.POINTS,0,lo);drawn+=lo;GL.stats.draws++}
  gaiaPump();GAIA.lastDrawn=drawn;return drawn;
}
// picking: nearest Gaia star to the pointer among the tiles in view
function gaiaPick(x,y,rpx){
  const showLim=lastFrameInfo.showLim;if(!gaiaActive(showLim))return null;
  const h=unprojH(x,y);const e=hToEQJ(h);const pxPerRad=scale*kOf(dotV(h,cam.f));const cosR=Math.cos((rpx+4)/Math.max(1,pxPerRad));
  let best=null,bs=1e9;
  for(const t of GAIA.index.tiles){const T=GAIA.tiles.get(t.f);if(!T)continue;if(Math.acos(clamp(t.v[0]*e[0]+t.v[1]*e[1]+t.v[2]*e[2],-1,1))*RAD>t.r+1)continue;
    for(let k=0;k<T.n&&T.V[k]<=showLim;k++){const cd=Math.cos(T.de[k]);const v=[cd*Math.cos(T.ra[k]),cd*Math.sin(T.ra[k]),Math.sin(T.de[k])];if(dotV(v,e)<cosR)continue;
      projE(v,tmpO,tmpH);const d=Math.hypot(tmpO[0]-x,tmpO[1]-y);if(d>rpx)continue;const sc=d-(showLim-T.V[k])*1.6;if(sc<bs){bs=sc;best={kind:'gaia',ref:{f:t.f,k},score:sc}}}}
  return best;
}
function gaiaVec(ref){const T=GAIA.tiles.get(ref.f);if(!T)return null;const k=ref.k,cd=Math.cos(T.de[k]);return[cd*Math.cos(T.ra[k]),cd*Math.sin(T.ra[k]),Math.sin(T.de[k])]}
function gaiaInfo(ref){
  const T=GAIA.tiles.get(ref.f);const k=ref.k;const v=gaiaVec(ref);const id=T.ids[k].toString();const G=T.G[k],c=T.bprp[k],p=T.plx[k],V=T.V[k];
  let facts=`<dl class="kv"><dt>Gaia G magnitude</dt><dd>${G.toFixed(2)}</dd>${isFinite(c)?`<dt>Colour BP−RP</dt><dd>${c.toFixed(2)}</dd>`:''}<dt>Visual magnitude (est.)</dt><dd>${V.toFixed(2)}</dd>`;
  let phys='';
  if(isFinite(p)&&p>0.15){const pc=1000/p,ly=pc*3.26156;const rel=p<1;facts+=`<dt>Parallax</dt><dd>${p.toFixed(3)} mas</dd><dt>Distance</dt><dd>${fmtLy(ly)}${rel?' (uncertain: small parallax)':''}</dd>`;
    const MG=G-5*Math.log10(pc/10);facts+=`<dt>Absolute G</dt><dd>${MG.toFixed(2)}</dd>`;
    const T2=gaiaTeff(c);if(T2){const L=Math.pow(10,(4.67-MG)/2.5);facts+=`<dt>Temperature (from colour)</dt><dd>about ${Math.round(T2/50)*50} K</dd><dt>Luminosity (G band)</dt><dd>about ${L>=10?Math.round(L).toLocaleString('en-US'):L.toPrecision(2)} × Sun</dd>`;
      phys=MG>10&&c<0.8?'Faint but blue-white: possibly a white dwarf.':MG<1&&c>1?'Bright and red: a giant star.':MG>5&&c>1.5?'Faint and red: likely a red dwarf, the most common kind of star in the galaxy.':'Its brightness and colour match a main-sequence star.'}}
  else facts+=`<dt>Parallax</dt><dd>${isFinite(p)?p.toFixed(3)+' mas (too small for a reliable distance)':'not measured'}</dd>`;
  facts+='</dl>';
  return{title:'Gaia DR3 star',kind:'Star from the Gaia catalogue',aliases:'Gaia DR3 '+id,v,mag:V,isPoint:true,photo:'',facts,desc:phys,src:`ESA Gaia Data Release 3 (${escapeHtml(GAIA.index.source||'')}); position moved to ${GAIA.index.epoch} with proper motion. Temperature and luminosity are rough estimates from colour and parallax.`,simbadId:'Gaia DR3 '+id};
}
