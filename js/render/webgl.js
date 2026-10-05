"use strict";
/* ================= WEBGL RENDERER ================= */
const GL={ok:false,maxPt:64,tex:new Map(),stats:{stars:0,draws:0}};
const GLSL_PROJ=`
uniform mat3 uM; uniform vec3 uR,uU,uF; uniform vec2 uRes,uCtr; uniform float uScale,uProj,uAtm,uSolid;
float refractH(inout vec3 h){
  float alt=degrees(asin(clamp(h.z,-1.0,1.0)));
  if(uAtm>0.5&&alt>-1.5&&alt<89.0){
    float R=1.02/tan(radians(alt+10.3/(alt+5.11)))/60.0;float na=alt+R;float c0=cos(radians(alt));
    if(c0>1e-6){float k=cos(radians(na))/c0;h.xy*=k;h.z=sin(radians(na));}
    alt=na;}
  return alt;}
vec2 projPx(vec3 h,out float z){
  float x=dot(h,uR),y=dot(h,uU);z=dot(h,uF);
  float k=uProj<0.5?2.0/(1.0+max(z,-0.999)):(z>0.02?1.0/z:50.0);
  return uCtr+uScale*k*vec2(x,-y);}
bool isBehind(float z){return uProj<0.5?z<-0.45:z<0.06;}
vec4 pxToClip(vec2 p){return vec4(p.x/uRes.x*2.0-1.0,1.0-p.y/uRes.y*2.0,0.0,1.0);}
`;
const VS_STARS=`precision highp float;${GLSL_PROJ}
attribute vec3 aPos;attribute float aMag;attribute vec3 aCol;
uniform float uShowLim,uBoost,uDPR,uMaxPt;
varying vec3 vCol;varying float vA;varying float vSize;
void main(){
  vec3 h=uM*aPos;float alt=refractH(h);
  float mag=aMag;
  if(uAtm>0.5&&alt>0.0){float X=1.0/(sin(radians(alt))+0.50572*pow(alt+6.07995,-1.6364));mag+=0.25*(X-1.0);}
  float dm=uShowLim-mag;float z;vec2 p=projPx(h,z);
  if(dm<0.0||isBehind(z)||(uSolid>0.5&&alt<0.0)){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;return;}
  float rad=min(9.0,0.55+0.42*pow(max(dm,0.0),1.18)*uBoost);
  vA=clamp(dm/1.2+0.08,0.08,1.0)*(alt<0.0?0.5:1.0);
  float s=rad<1.15?2.0:rad*6.8;
  vSize=s*uDPR;gl_PointSize=min(vSize,uMaxPt);vCol=aCol;gl_Position=pxToClip(p);}`;
const FS_STARS=`precision mediump float;
varying vec3 vCol;varying float vA;varying float vSize;
void main(){
  vec2 q=gl_PointCoord*2.0-1.0;float d2=dot(q,q);if(d2>1.0)discard;
  float a;vec3 c;
  if(vSize<4.0){a=1.0-smoothstep(0.35,1.0,d2);c=vCol;}
  else{float core=exp(-d2*70.0);a=clamp(exp(-d2*8.9)+0.06*(1.0-d2)+core,0.0,1.0);c=mix(vCol,vec3(1.0),min(core*1.2,0.95));}
  gl_FragColor=vec4(c,a*vA);}`;
const VS_LINES=`precision highp float;${GLSL_PROJ}
attribute vec3 aA;attribute vec3 aB;attribute float aSide;attribute float aEnd;
uniform float uWidth;varying float vAlt;
void main(){
  vec3 ha=uM*aA,hb=uM*aB;float alta=refractH(ha),altb=refractH(hb);
  float za,zb;vec2 sa=projPx(ha,za),sb=projPx(hb,zb);
  vec2 dd=sb-sa;float L=length(dd);
  if(isBehind(za)||isBehind(zb)||L>uRes.x*1.5||L<1e-4){gl_Position=vec4(2.0,2.0,2.0,1.0);vAlt=-90.0;return;}
  vec2 dir=dd/L;vec2 n=vec2(-dir.y,dir.x);
  vec2 s=mix(sa,sb,aEnd)+n*aSide*uWidth*0.5;
  vAlt=mix(alta,altb,aEnd);gl_Position=pxToClip(s);}`;
const FS_LINES=`precision mediump float;uniform vec4 uColor;uniform float uSolid;varying float vAlt;
void main(){if(uSolid>0.5&&vAlt<0.0)discard;gl_FragColor=uColor;}`;
const VS_QUAD=`precision highp float;attribute vec2 aP;attribute vec2 aUV;uniform vec2 uRes;varying vec2 vUV;
void main(){vUV=aUV;gl_Position=vec4(aP.x/uRes.x*2.0-1.0,1.0-aP.y/uRes.y*2.0,0.0,1.0);}`;
const FS_QUAD=`precision mediump float;uniform sampler2D uTex;uniform float uAlpha;varying vec2 vUV;
void main(){vec4 t=texture2D(uTex,vUV);gl_FragColor=vec4(t.rgb*uAlpha,1.0);}`;
const VS_BG=`attribute vec2 aP;void main(){gl_Position=vec4(aP,0.0,1.0);}`;
const FS_BG=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uR,uU,uF;uniform vec2 uRes,uCtr;uniform float uScale,uProj,uDPR;
uniform mat3 uMT;uniform vec3 uSun,uMoon;uniform float uSunAlt,uDay,uTw,uLp,uMw,uMoonB,uAtm,uSolidG;
uniform sampler2D uMwTex;
void main(){
  float px=gl_FragCoord.x/uDPR, py=uRes.y-gl_FragCoord.y/uDPR;
  float p=(px-uCtr.x)/uScale,q=(uCtr.y-py)/uScale;
  vec3 h;
  if(uProj<0.5){float r2=p*p+q*q;float z=(4.0-r2)/(4.0+r2);float k=(1.0+z)*0.5;h=p*k*uR+q*k*uU+z*uF;}
  else h=normalize(p*uR+q*uU+uF);
  float alt=max(h.z,0.0);float hzw=pow(1.0-alt,3.0);
  vec3 night=vec3(2.0+6.0*hzw,4.0+8.0*hzw,10.0+14.0*hzw);
  night+=uLp*vec3(10.0+60.0*hzw,9.0+42.0*hzw,12.0+30.0*hzw);
  night+=uMoonB*vec3(10.0+18.0*hzw,16.0+24.0*hzw,32.0+34.0*hzw);
  float cosS=dot(h,uSun);float tz=uTw*uTw*(1.0-uDay);float ss=(cosS+1.0)*0.5;
  vec3 tw=vec3(mix(22.0,70.0,hzw)+hzw*ss*ss*150.0,mix(36.0,62.0,hzw)+hzw*ss*ss*70.0,mix(80.0,92.0,hzw)+hzw*ss*20.0);
  vec3 col=mix(night,tw,tz);
  if(uDay>0.0){vec3 day=vec3(mix(52.0,178.0,hzw),mix(112.0,208.0,hzw),mix(208.0,238.0,hzw));col=mix(col,day,uDay);}
  if(uAtm>0.5&&uSunAlt>-12.0){float gl=exp((cosS-1.0)*12.0)*(0.25+0.75*uDay)+exp((cosS-1.0)*600.0)*2.0*uDay;float s2=clamp((uSunAlt+12.0)/12.0,0.0,1.0);col+=gl*s2*vec3(255.0,215.0,170.0);}
  if(uMoonB>0.0){float cm=dot(h,uMoon);float g=exp((cm-1.0)*40.0)*uMoonB*55.0;col+=vec3(g,g,g*1.05);}
  if(uMw>0.0&&(h.z>-0.2||uSolidG<0.5)){
    vec3 e=uMT*h;float ra=degrees(atan(e.y,e.x));float de=degrees(asin(clamp(e.z,-1.0,1.0)));
    vec2 uv=vec2(fract((90.0-ra)/360.0),(90.0-de)/180.0);
    vec3 m=texture2D(uMwTex,uv).rgb*255.0;
    float ext=h.z<0.0?0.55:(uAtm>0.5?clamp(h.z*3.0,0.25,1.0):1.0);
    col+=m*uMw*ext*1.25;}
  gl_FragColor=vec4(min(col/255.0,vec3(1.0)),1.0);}`;
function glCompile(gl,vs,fs){
  const mk=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={},a={};const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<nu;i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n)}
  const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);for(let i=0;i<na;i++){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n)}
  return{p,u,a};
}
function glBuf(gl,data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b}
function buildLineBuf(gl,segsList){ // list of [vecA,vecB]
  const n=segsList.length;const f=new Float32Array(n*6*8);let o=0;
  const corners=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
  for(const [A,B] of segsList)for(const [side,end] of corners){f[o++]=A[0];f[o++]=A[1];f[o++]=A[2];f[o++]=B[0];f[o++]=B[1];f[o++]=B[2];f[o++]=side;f[o++]=end}
  return{buf:glBuf(gl,f),count:n*6};
}
function initGL(){
  if(store.get('forceCanvas',false))return false;
  const c=$('gl');let gl=null;
  try{gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:false,powerPreference:'low-power'})||c.getContext('experimental-webgl')}catch(e){gl=null}
  if(!gl)return false;
  try{
    GL.gl=gl;GL.c=c;
    GL.stars=glCompile(gl,VS_STARS,FS_STARS);GL.lines=glCompile(gl,VS_LINES,FS_LINES);GL.quad=glCompile(gl,VS_QUAD,FS_QUAD);GL.bg=glCompile(gl,VS_BG,FS_BG);
    const pr=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);GL.maxPt=pr?pr[1]:64;
    // star buffers (stars are sorted by magnitude, so drawing the first n = everything brighter than the limit)
    const pos=new Float32Array(N*3),mag=new Float32Array(N),col=new Uint8Array(N*3);
    for(let i=0;i<N;i++){pos[3*i]=sx[i];pos[3*i+1]=sy[i];pos[3*i+2]=sz[i];mag[i]=sMag[i];const c3=bucketCol[bucketOfCI[sCI[i]+128]];col[3*i]=c3[0];col[3*i+1]=c3[1];col[3*i+2]=c3[2]}
    GL.bPos=glBuf(gl,pos);GL.bMag=glBuf(gl,mag);GL.bCol=glBuf(gl,col);
    // constellation lines and boundaries
    const cl=[];for(const c of LINES)for(const s of c.segs)for(let k=0;k+1<s.length;k++)cl.push([s[k],s[k+1]]);
    GL.conLines=buildLineBuf(gl,cl);
    const bl=[];for(const ln of BORDERS)for(let k=0;k+1<ln.length;k++)bl.push([ln[k],ln[k+1]]);
    GL.borderLines=buildLineBuf(gl,bl);
    GL.bgBuf=glBuf(gl,new Float32Array([-1,-1,3,-1,-1,3]));
    GL.quadBuf=gl.createBuffer();
    // Milky Way texture (power-of-two, wraps in RA)
    GL.mwTex=null;
    c.addEventListener('webglcontextlost',e=>{e.preventDefault();GL.ok=false;requestRender()},false);
    c.addEventListener('webglcontextrestored',()=>{GL.tex.clear();if(initGL())requestRender()},false);
    GL.ok=true;return true;
  }catch(e){console.warn('WebGL init failed, using canvas fallback:',e);GL.ok=false;return false}
}
function glMwTexture(){
  if(GL.mwTex||!mwImageEl)return GL.mwTex;const gl=GL.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,mwImageEl);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  GL.mwTex=t;return t;
}
function glPhotoTex(k){
  if(GL.tex.has(k))return GL.tex.get(k);const im=texImage(k);if(!im)return null;const gl=GL.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  GL.tex.set(k,t);return t;
}
function setProjUniforms(prog){
  const gl=GL.gl,u=prog.u;
  if(u.uM){const m=M;gl.uniformMatrix3fv(u.uM,false,new Float32Array([m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]]))}
  if(u.uR)gl.uniform3fv(u.uR,cam.r);if(u.uU)gl.uniform3fv(u.uU,cam.u);if(u.uF)gl.uniform3fv(u.uF,cam.f);
  if(u.uRes)gl.uniform2f(u.uRes,W,H);if(u.uCtr)gl.uniform2f(u.uCtr,CX,CY);if(u.uScale)gl.uniform1f(u.uScale,scale);
  if(u.uProj)gl.uniform1f(u.uProj,PROJ==='gnomo'?1:0);if(u.uAtm)gl.uniform1f(u.uAtm,S.layers.atmos?1:0);if(u.uSolid)gl.uniform1f(u.uSolid,S.ground===2?1:0);
}
function bindAttr(prog,name,buf,size,type,norm,stride,off){const gl=GL.gl,loc=prog.a[name];if(loc==null||loc<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type||gl.FLOAT,!!norm,stride||0,off||0)}
function unbindAll(prog){const gl=GL.gl;for(const k in prog.a){const l=prog.a[k];if(l>=0)gl.disableVertexAttribArray(l)}}
function glDrawLines(lb,width,rgba){
  const gl=GL.gl,P=GL.lines;gl.useProgram(P.p);setProjUniforms(P);gl.uniform1f(P.u.uWidth,width);gl.uniform4f(P.u.uColor,rgba[0],rgba[1],rgba[2],rgba[3]);
  const st=32;bindAttr(P,'aA',lb.buf,3,gl.FLOAT,false,st,0);bindAttr(P,'aB',lb.buf,3,gl.FLOAT,false,st,12);bindAttr(P,'aSide',lb.buf,1,gl.FLOAT,false,st,24);bindAttr(P,'aEnd',lb.buf,1,gl.FLOAT,false,st,28);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,lb.count);unbindAll(P);GL.stats.draws++;
}
function glFrame(lim,showLim,dark){
  const gl=GL.gl;const c=GL.c;
  if(c.width!==Math.round(W*DPR)||c.height!==Math.round(H*DPR)){c.width=Math.round(W*DPR);c.height=Math.round(H*DPR)}
  gl.viewport(0,0,c.width,c.height);GL.stats.draws=0;
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
  const L=S.layers;
  // ---- background sky (one full-screen pass)
  if(S.camera){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)}
  else{
    const P=GL.bg,u=P.u;gl.useProgram(P.p);gl.disable(gl.BLEND);
    setProjUniforms(P);gl.uniform1f(u.uDPR,DPR);
    gl.uniformMatrix3fv(u.uMT,false,new Float32Array([M[0],M[1],M[2],M[3],M[4],M[5],M[6],M[7],M[8]]));
    const sun=[0,0,0];applyM(M,...bodies.Sun.e,sun);const moon=[0,0,0];applyM(M,...bodies.Moon.e,moon);
    const atm=L.atmos;const day=atm?clamp((sunAltDeg+4)/10,0,1):0,tw=atm?clamp((sunAltDeg+18)/14,0,1):0;
    gl.uniform3fv(u.uSun,sun);gl.uniform3fv(u.uMoon,moon);gl.uniform1f(u.uSunAlt,sunAltDeg);gl.uniform1f(u.uDay,day);gl.uniform1f(u.uTw,tw);
    gl.uniform1f(u.uLp,atm?LP[S.lp][2]:0);gl.uniform1f(u.uMw,L.milky&&mwImageEl?clamp((lim-4.0)/2.4,0,1):0);
    gl.uniform1f(u.uMoonB,atm&&moonAltDeg>0?moonFrac*clamp(moonAltDeg/20,0,1)*(1-day):0);gl.uniform1f(u.uAtm,atm?1:0);gl.uniform1f(u.uSolidG,S.ground===2?1:0);
    const mt=glMwTexture();gl.activeTexture(gl.TEXTURE0);if(mt)gl.bindTexture(gl.TEXTURE_2D,mt);gl.uniform1i(u.uMwTex,0);
    bindAttr(P,'aP',GL.bgBuf,2);gl.drawArrays(gl.TRIANGLES,0,3);unbindAll(P);GL.stats.draws++;gl.enable(gl.BLEND);
  }
  // ---- telescope photos (additive)
  drawnTex.clear();
  if(!S.camera&&L.photos&&L.dso&&S.fov<75&&dark>0.05){
    const fE=[0,0,0];applyMT(M,...cam.f,fE);const half=Math.hypot(W,H)/2/scale;const viewAng=viewAngFromHalf(half);
    const P=GL.quad;gl.useProgram(P.p);gl.uniform2f(P.u.uRes,W,H);gl.blendFunc(gl.ONE,gl.ONE);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(P.u.uTex,0);
    for(let k=0;k<TEX.length;k++){const t=TEX[k];
      const cosd=t.cx*fE[0]+t.cy*fE[1]+t.cz*fE[2];if(Math.acos(clamp(cosd,-1,1))>viewAng+t.rad)continue;
      const pxSize=t.rad*scale*1.5;if(pxSize<10)continue;
      const tx=glPhotoTex(k);if(!tx)continue;
      const s=t.c.map(v=>{const o=[0,0,0];projE(v,o);return o});if(s.some(o=>behind(o[2])))continue;
      const a=clamp(dark*clamp((pxSize-10)/50,0,1)*0.95,0,1);
      const d=new Float32Array([s[3][0],s[3][1],0,0, s[2][0],s[2][1],1,0, s[1][0],s[1][1],1,1, s[3][0],s[3][1],0,0, s[1][0],s[1][1],1,1, s[0][0],s[0][1],0,1]);
      gl.bindBuffer(gl.ARRAY_BUFFER,GL.quadBuf);gl.bufferData(gl.ARRAY_BUFFER,d,gl.DYNAMIC_DRAW);
      bindAttr(P,'aP',GL.quadBuf,2,gl.FLOAT,false,16,0);bindAttr(P,'aUV',GL.quadBuf,2,gl.FLOAT,false,16,8);
      gl.bindTexture(gl.TEXTURE_2D,tx);gl.uniform1f(P.u.uAlpha,a);gl.drawArrays(gl.TRIANGLES,0,6);GL.stats.draws++;
      if(pxSize>40)drawnTex.add(k);
    }
    unbindAll(P);
  }
  // ---- boundaries and constellation figures (thick lines built from triangles)
  if(L.borders)glDrawLines(GL.borderLines,1.0,[150/255,140/255,190/255,0.26]);
  if(L.lines){const a=S.camera?0.6:clamp(0.2+0.22*dark,0.2,0.42);glDrawLines(GL.conLines,S.camera?1.6:1.15,[120/255,150/255,210/255,a])}
  // ---- every star in ONE draw call (point sprites; the GPU culls and sizes them)
  const P=GL.stars;gl.useProgram(P.p);setProjUniforms(P);
  gl.uniform1f(P.u.uShowLim,showLim);gl.uniform1f(P.u.uBoost,clamp(2.2-S.fov/90,0.9,1.8));gl.uniform1f(P.u.uDPR,DPR);gl.uniform1f(P.u.uMaxPt,GL.maxPt);
  bindAttr(P,'aPos',GL.bPos,3);bindAttr(P,'aMag',GL.bMag,1);bindAttr(P,'aCol',GL.bCol,3,gl.UNSIGNED_BYTE,true);
  if(typeof GAIA!=='undefined'&&S.layers.gaia&&!GAIA.index&&S.fov<8)gaiaLoadIndex(); // tiles may have been built since the page loaded
  const gOn=typeof gaiaActive==='function'&&gaiaActive(showLim);
  let n=starCountBrighter(Math.min(showLim,gOn?GAIA.cut:99)+0.05);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.drawArrays(gl.POINTS,0,n);GL.stats.draws++;GL.stats.stars=n;
  if(gOn)GL.stats.stars+=gaiaDraw(P,showLim);
  unbindAll(P);
}
function starCountBrighter(m){let lo=0,hi=N;while(lo<hi){const mid=(lo+hi)>>1;if(sMag[mid]<=m)lo=mid+1;else hi=mid}return lo}
// CPU work that the GPU can't do: labels for bright named stars (a few hundred at most)
function starLabelsCPU(showLim){
  if(!S.layers.starNames)return;
  const labelLim=Math.min(showLim-3.2,Math.max(1.6,showLim-5));const n=starCountBrighter(labelLim);
  const fE=[0,0,0];applyMT(M,...cam.f,fE);const half=Math.hypot(W,H)/2/scale;const cosView=Math.cos(Math.min(Math.PI,viewAngFromHalf(half)+0.02));
  const brightBoost=clamp(2.2-S.fov/90,0.9,1.8);
  for(let i=0;i<n;i++){if(!named.has(i))continue;if(sx[i]*fE[0]+sy[i]*fE[1]+sz[i]*fE[2]<cosView)continue;
    applyM(M,sx[i],sy[i],sz[i],tmpH);const alt=refract(tmpH);if(S.ground===2&&alt<0)continue;const mag=S.layers.atmos&&alt>0?sMag[i]+extinct(alt):sMag[i];if(mag>=labelLim)continue;
    projH(tmpH,tmpO);if(behind(tmpO[2]))continue;const X=tmpO[0],Y=tmpO[1];if(X<0||Y<0||X>W||Y>H)continue;
    const nm=starName(i);if(!nm)continue;const dm=showLim-mag;const rad=Math.min(9,0.55+0.42*Math.pow(dm,1.18)*brightBoost);
    ctx.globalAlpha=clamp((labelLim-mag)*1.5,0.35,0.9);label(nm,X,Y,'400 12px Jost, sans-serif','#d8d1be',rad+3,-rad-1)}
  ctx.globalAlpha=1;
}
// on-demand star picking: only runs when the pointer moves or taps, not every frame
function gatherStarsNear(x,y,rpx){
  hitCount=0;const showLim=lastFrameInfo.showLim;const n=starCountBrighter(Math.min(showLim,(typeof gaiaActive==='function'&&gaiaActive(showLim))?GAIA.cut:99)+0.05);
  const e=hToEQJ(unprojH(x,y));const pxPerRad=scale*kOf(dotV(unprojH(x,y),cam.f));const cosR=Math.cos(Math.min(0.5,(rpx+4)/Math.max(1,pxPerRad)));
  for(let i=0;i<n;i++){if(sx[i]*e[0]+sy[i]*e[1]+sz[i]*e[2]<cosR)continue;
    applyM(M,sx[i],sy[i],sz[i],tmpH);const alt=refract(tmpH);if(S.ground===2&&alt<0)continue;const mag=S.layers.atmos&&alt>0?sMag[i]+extinct(alt):sMag[i];if(mag>showLim)continue;
    projH(tmpH,tmpO);if(behind(tmpO[2]))continue;hitN[hitCount*2]=tmpO[0];hitN[hitCount*2+1]=tmpO[1];hitI[hitCount]=i;hitCount++}
}

