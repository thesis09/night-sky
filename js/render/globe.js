"use strict";
/* ================= GLOBE RENDERING ================= */
const ptex={};
const PLANET_TEX=['mercury','venus','moon','mars','jupiter','saturn','uranus','neptune','pluto'];
function loadPlanetTex(){const ps=[];for(const k of PLANET_TEX){ps.push(new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);ptex[k]={d:g.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};res()};im.onerror=res;im.src='img/planets/'+k+'.webp'}))}return Promise.all(ps)}
const crossV=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dotV=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normV=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
// draws globe of planet p into canvas of size px, with screen-up vector upE (EQJ). returns canvas
function renderGlobe(p,sizePx,upE,canvas){
  const b=bodies[p.key];const d=b.e;
  const isSat=p.key==='Saturn';
  const ext=isSat?2.35:1.0;
  const size=Math.max(8,Math.min(600,Math.round(sizePx*ext)));
  const c=canvas||document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');const img=g.createImageData(size,size);const D=img.data;
  let up=normV([upE[0]-dotV(upE,d)*d[0],upE[1]-dotV(upE,d)*d[1],upE[2]-dotV(upE,d)*d[2]]);
  const right=crossV(d,up);
  // sun direction from body
  const sb=bodies.Sun;const sunV=[sb.e[0]*sb.dist-d[0]*b.dist,sb.e[1]*sb.dist-d[1]*b.dist,sb.e[2]*sb.dist-d[2]*b.dist];const L=normV(sunV);
  let P=[0,0,1],X=[1,0,0],Y=[0,1,0];
  try{const ax=A.RotationAxis(p.body,astroT);P=[ax.north.x,ax.north.y,ax.north.z];const Q=normV(crossV([0,0,1],P));const Wa=(ax.spin%360)*DEG;const QP=crossV(P,Q);X=[0,1,2].map(i=>Q[i]*Math.cos(Wa)+QP[i]*Math.sin(Wa));Y=crossV(P,X)}catch(e){}
  const T=p.tex?ptex[p.tex]:null;
  const half=size/2, rp=half/ext; // planet radius in px
  const isSun=p.key==='Sun';
  const dP=dotV(d,P), rP=dotV(right,P), uP=dotV(up,P);
  const ringLit=isSat?(dotV(L,P)*(-dP)>0):true; // sun and observer on same side of ring plane
  for(let j=0;j<size;j++){for(let i=0;i<size;i++){
    const sxp=(i+0.5-half)/rp, syp=(half-(j+0.5))/rp;const r2=sxp*sxp+syp*syp;const q=(j*size+i)*4;
    let R=0,G=0,B=0,Aa=0;
    const inDisk=r2<=1;let kz=0;
    if(inDisk){
      kz=Math.sqrt(1-r2);
      const n=[sxp*right[0]+syp*up[0]-kz*d[0],sxp*right[1]+syp*up[1]-kz*d[1],sxp*right[2]+syp*up[2]-kz*d[2]];
      if(isSun){const ld=0.4+0.6*Math.pow(kz,0.6);R=255*ld;G=240*ld;B=205*ld;Aa=255}
      else{
        let tr=200,tg=200,tb=200;
        if(T){const lon=Math.atan2(dotV(n,Y),dotV(n,X));const lat=Math.asin(clamp(dotV(n,P),-1,1));let u=0.5+lon/TAU;u-=Math.floor(u);const v=0.5-lat/Math.PI;const ti=((Math.min(T.h-1,(v*T.h)|0))*T.w+Math.min(T.w-1,(u*T.w)|0))*4;tr=T.d[ti];tg=T.d[ti+1];tb=T.d[ti+2]}
        const lit=dotV(n,L);const rocky=p.key==='Moon'||p.key==='Mercury'||p.key==='Pluto';
        // Lommel–Seeliger for airless rocky bodies (stays bright up to the terminator), Lambert for cloudy planets
        const sh=lit>0?(rocky?Math.min(1.25,2.2*lit/(lit+kz+1e-6)*0.62):Math.pow(lit,0.8)*(0.92+0.08*kz)):0;const amb=p.key==='Moon'?0.03:0.015;
        const gain=p.key==='Moon'?1.75:1.08;const f=Math.max(sh,amb);R=tr*f*gain;G=tg*f*gain;B=tb*f*gain;Aa=255;
        const edge=clamp((1-Math.sqrt(r2))*rp,0,1);Aa=255*edge;
      }
    }
    if(isSat){
      // ring intersection: point s + t d on plane P
      const sp=sxp*rP+syp*uP;
      if(Math.abs(dP)>1e-4){const t=-sp/dP;const pr=[sxp*right[0]+syp*up[0]+t*d[0],sxp*right[1]+syp*up[1]+t*d[1],sxp*right[2]+syp*up[2]+t*d[2]];const rr=Math.hypot(pr[0],pr[1],pr[2]);
        let op=0;if(rr>1.24&&rr<1.53)op=0.22;else if(rr>=1.53&&rr<1.95)op=0.92;else if(rr>=1.95&&rr<2.03)op=0.08;else if(rr>=2.03&&rr<2.27)op=0.66;
        if(op>0){const front=t<-kz||!inDisk;const shade=ringLit?1:0.28;
          // planet shadow on ring: point pr, sun dir L, shadow if line from pr toward L hits sphere
          const bdl=dotV(pr,L);const shadow=(bdl<0&&(dotV(pr,pr)-bdl*bdl)<1)?0.15:1;
          const rc=[212,196,166];
          if(front){const a=op;R=lerp(R,rc[0]*shade*shadow,a);G=lerp(G,rc[1]*shade*shadow,a);B=lerp(B,rc[2]*shade*shadow,a);Aa=Math.max(Aa,255*a)}
        }}
    }
    D[q]=R;D[q+1]=G;D[q+2]=B;D[q+3]=Aa;
  }}
  g.putImageData(img,0,0);return c;
}
const globeCache={};

