"use strict";
/* ================= ASTROPHYSICS (computed from catalogue data) ================= */
const TEFF_CLASS={O:[50000,31500],B:[31000,10700],A:[9700,7400],F:[7220,6100],G:[5920,5300],K:[5280,3940],M:[3850,2300]};
function teffOf(i){
  const sp=SD.spect[sSp[i]]||'';const m=sp.replace(/^(sd|d|g|c)/,'').match(/^([OBAFGKM])(\d(?:\.\d)?)?/);
  if(m){const t=TEFF_CLASS[m[1]];const sub=m[2]!=null?+m[2]:5;return{T:t[0]+(t[1]-t[0])*sub/9.5,src:'spectral type'}}
  if(sCI[i]!==-128){const bv=sCI[i]/50;return{T:4600*(1/(0.92*bv+1.7)+1/(0.92*bv+0.62)),src:'B−V colour'}}
  return null;
}
const BC=[[2500,-4.5],[3000,-2.9],[3500,-1.5],[4000,-0.8],[4500,-0.45],[5000,-0.25],[5500,-0.12],[6000,-0.05],[6500,-0.02],[7000,0],[8000,-0.05],[9000,-0.15],[10000,-0.35],[12000,-0.8],[15000,-1.3],[20000,-2.0],[25000,-2.5],[30000,-2.9],[40000,-3.6],[50000,-4.2]];
function bcOf(T){if(T<=BC[0][0])return BC[0][1];for(let k=1;k<BC.length;k++)if(T<=BC[k][0]){const a=BC[k-1],b=BC[k];return lerp(a[1],b[1],(T-a[0])/(b[0]-a[0]))}return BC[BC.length-1][1]}
function lumClass(sp){const s=(sp||'').replace(/^(sd|d|g|c)/,'');if(/^sd/.test(sp))return'sd';if(/^D/.test(sp))return'D';if(/0-Ia|Ia0|Iab|Ia|Ib/.test(s))return'I';if(/III/.test(s))return'III';if(/II/.test(s))return'II';if(/IV/.test(s))return'IV';if(/V/.test(s))return'V';if(/\bI\b/.test(s))return'I';return''}
const STAGE={V:'It is on the main sequence: fusing hydrogen into helium in its core, the long, stable phase the Sun is in now.',IV:'It is a subgiant: its core hydrogen is nearly exhausted and the star is beginning to expand and cool on its way to becoming a giant.',III:'It is a giant: core hydrogen is gone, the core has contracted and heated while the outer layers swelled enormously. Many giants fuse helium into carbon in their cores.',II:'It is a bright giant, between giants and supergiants in luminosity.',I:'It is a supergiant: a massive star late in its life. Stars like this end in core-collapse supernovae, leaving a neutron star or black hole.',D:'It is a white dwarf: the exposed core of a dead Sun-like star. No fusion happens; it simply cools over billions of years.',sd:'It is a subdwarf: an old, metal-poor star slightly fainter than main-sequence stars of the same colour.'};
function starPhysics(i){
  const pc=starDistPc(i);if(!(pc>0))return'';
  const tf=teffOf(i);if(!tf)return'';
  if(pc>600)return `<div class="sec"><div class="lbl">Astrophysics</div><div class="dir">Its distance is too uncertain for reliable physical estimates (Hipparcos could not measure such a small parallax precisely).</div></div>`;
  const T=tf.T;const Mv=sMag[i]-5*Math.log10(pc/10);const Mbol=Mv+bcOf(T);const L=Math.pow(10,(4.74-Mbol)/2.5);
  const R=Math.sqrt(L)*Math.pow(5772/T,2);const peak=2.898e6/T;const sp=SD.spect[sSp[i]];const lc=lumClass(sp);
  let mass='',life='';
  if(lc==='V'){const Mm=L<0.033?Math.pow(L/0.23,1/2.3):L<16?Math.pow(L,1/4):Math.pow(L/1.4,1/3.5);mass=`<dt>Mass (estimate)</dt><dd>about ${Mm<10?Mm.toFixed(2):Mm.toFixed(0)} × Sun</dd>`;const tl=10*Mm/L;life=`<dt>Main-sequence lifetime</dt><dd>about ${tl>=1?tl.toFixed(tl<10?1:0)+' billion':(tl*1000).toFixed(0)+' million'} years in total</dd>`}
  const band=peak<380?'ultraviolet':peak<450?'violet-blue':peak<495?'blue':peak<570?'green (we still see it as white-yellow)':peak<590?'yellow':peak<750?'red':'infrared';
  const fmtX=x=>x>=1000?Math.round(x).toLocaleString('en-US'):x>=10?x.toFixed(0):x>=1?x.toFixed(1):x.toPrecision(2);
  return `<div class="sec"><div class="lbl">Astrophysics (estimated from catalogue data)</div>
  <dl class="kv"><dt>Surface temperature</dt><dd>about ${Math.round(T/50)*50} K (from ${tf.src})</dd>
  <dt>Total luminosity</dt><dd>about ${fmtX(L)} × Sun</dd><dt>Radius</dt><dd>about ${fmtX(R)} × Sun${R>200?` (${(R*0.00465).toFixed(1)} AU across)`:''}</dd>${mass}${life}
  <dt>Light peaks at</dt><dd>${Math.round(peak)} nm (${band})</dd></dl>
  ${lc&&STAGE[lc]?`<p class="phys">${STAGE[lc]}</p>`:''}
  <p class="phys small">How: absolute magnitude from distance, a bolometric correction for temperature, then the Stefan–Boltzmann law L = 4πR²σT⁴ gives the radius${mass?', and the mass–luminosity relation gives the mass':''}. Expect errors of 10–30%.</p>
  <canvas id="hrC" width="640" height="380" style="width:100%;height:auto;border-radius:10px;margin-top:8px;background:#05070f"></canvas>
  <div class="src">Hertzsprung–Russell diagram: stars within 650 light-years from this catalogue. The ring marks this star.</div></div>`;
}
let hrBase=null;
function drawHR(i){
  const c=$('hrC');if(!c)return;const g=c.getContext('2d');const Wc=c.width,Hc=c.height;
  const X=bv=>50+(bv+0.4)/2.4*(Wc-70),Y=M=>20+(M+8)/24*(Hc-60);
  if(!hrBase){hrBase=document.createElement('canvas');hrBase.width=Wc;hrBase.height=Hc;const b=hrBase.getContext('2d');b.fillStyle='#05070f';b.fillRect(0,0,Wc,Hc);
    for(let k=0;k<N;k++){if(sCI[k]===-128)continue;const pc=starDistPc(k);if(!(pc>0&&pc<200))continue;const bv=sCI[k]/50;const M=sMag[k]-5*Math.log10(pc/10);if(M<-8||M>16)continue;const col=bucketCss[bucketOfCI[sCI[k]+128]];b.fillStyle=col;b.globalAlpha=0.55;b.fillRect(X(bv+(Math.random()-0.5)*0.02),Y(M),1.4,1.4)}
    b.globalAlpha=1;b.strokeStyle='rgba(236,230,214,.35)';b.beginPath();b.moveTo(50,Hc-40);b.lineTo(Wc-20,Hc-40);b.moveTo(50,20);b.lineTo(50,Hc-40);b.stroke();
    b.fillStyle='rgba(236,230,214,.75)';b.font='15px Jost, sans-serif';b.fillText('hotter, bluer  ←  colour (B−V)  →  cooler, redder',90,Hc-14);
    b.save();b.translate(18,Hc/2+60);b.rotate(-Math.PI/2);b.fillText('brighter ↑  absolute magnitude',0,0);b.restore();
    b.font='italic 17px "Cormorant Garamond", Georgia, serif';b.fillStyle='rgba(217,182,108,.9)';
    b.fillText('main sequence',X(0.55),Y(6.2));b.fillText('giants',X(1.15),Y(-0.6));b.fillText('white dwarfs',X(0.05),Y(13.2));b.fillText('supergiants',X(0.6),Y(-6.4));}
  g.drawImage(hrBase,0,0);
  const pc=starDistPc(i);if(!(pc>0)||sCI[i]===-128)return;const M=sMag[i]-5*Math.log10(pc/10);const x=X(sCI[i]/50),y=Y(clamp(M,-8,16));
  g.strokeStyle='#d9b66c';g.lineWidth=2.5;g.beginPath();g.arc(x,y,9,0,TAU);g.stroke();g.fillStyle='#d9b66c';g.beginPath();g.arc(x,y,2.5,0,TAU);g.fill();
}
const DSOPHYS={HII:'Why it glows: ultraviolet light from hot young stars strips electrons off hydrogen atoms. When electrons recombine with protons they emit light at specific wavelengths, above all the red hydrogen-alpha line at 656.3 nm. Regions like this are stellar nurseries.',EmN:'Why it glows: gas excited by nearby hot stars emits light at specific wavelengths, mostly the red hydrogen-alpha line at 656.3 nm.',Neb:'A cloud of interstellar gas and dust, lit up by nearby stars.',RfN:'Why it glows: dust grains reflect the light of nearby stars. It looks blue because small grains scatter blue light more efficiently than red, the same reason Earth’s daytime sky is blue.',PN:'What it is: the outer layers shed by a dying Sun-like star at the end of its red-giant phase, lit up by the hot exposed core that will become a white dwarf. Planetary nebulae last only about 10,000–20,000 years. The name is historical; they have nothing to do with planets. Our Sun will make one in about 5 billion years.',SNR:'What it is: debris from an exploded star racing outward at thousands of km/s. Shock waves heat the surrounding gas, which glows from radio waves to X-rays. Supernovae seed space with the heavy elements later built into planets and people.',DrkN:'What it is: a cold, dense cloud of dust and molecular gas that blocks the light behind it. Clouds like this collapse under gravity to form new stars.',OCl:'What it is: a family of stars born together from the same gas cloud, loosely bound by gravity. Open clusters are typically tens to hundreds of millions of years old and slowly drift apart.','*Ass':'A loose group of stars that may share an origin, or a chance alignment.',GCl:'What it is: a dense ball of hundreds of thousands of very old stars, typically 10–13 billion years old, orbiting in the Milky Way’s halo. Their ages set a lower limit on the age of the universe.','Cl+N':'A young star cluster still surrounded by the glowing gas cloud it formed from.'};
function hubbleExplain(h){h=(h||'').trim();if(!h)return'';
  if(/^E/.test(h))return`Hubble type ${h}: an elliptical galaxy${/E(\d)/.test(h)?` (E0 is round, E7 very elongated; this is E${h.match(/E(\d)/)[1]})`:''}. Ellipticals are made mostly of old, reddish stars with little gas left to form new ones.`;
  if(/^S0|^SA0|^SB0/.test(h))return`Hubble type ${h}: a lenticular galaxy, a disk with a bulge but no spiral arms and little star formation.`;
  if(/^I|^IB|^IA/.test(h))return`Hubble type ${h}: an irregular galaxy without a clear shape, often rich in gas and young stars.`;
  if(/^S/.test(h)){const barred=/^SB/.test(h)||/^SAB/.test(h);const m=h.match(/S[AB]{0,2}(a|ab|b|bc|c|cd|d|m)/);const t=m?m[1]:'';
    const arm=t.startsWith('a')?'a large bulge and tightly wound arms':t.startsWith('b')?'a medium bulge and moderately wound arms':t.startsWith('c')?'a small bulge and loose, open arms full of star formation':t?'very loose, patchy arms and almost no bulge':'spiral arms';
    return`Hubble type ${h}: a ${barred?(h.startsWith('SAB')?'weakly barred ':'barred '):''}spiral galaxy with ${arm}.${barred?' A bar of stars runs through its centre, as in our own Milky Way.':''}`}
  return'';
}
function parseLyYears(str){if(!str)return null;const m=String(str).replace(/,/g,'').match(/([\d.]+)\s*(million|billion)?\s*ly/);if(!m)return null;let v=parseFloat(m[1]);if(m[2]==='million')v*=1e6;if(m[2]==='billion')v*=1e9;return v}
function lookbackText(years){if(!(years>0))return'';const f=years>=1e9?(years/1e9).toFixed(1)+' billion':years>=1e6?(years/1e6).toPrecision(3)+' million':Math.round(years).toLocaleString('en-US');
  const when=years<5000?'':years<12000?', around the end of the last ice age':years<300000?', when early humans were spreading across Africa':years<2.5e6?', before our species existed':years<66e6?', after the dinosaurs had died out':years<252e6?', when dinosaurs walked the Earth':years<541e6?', before the dinosaurs, when life was first spreading onto land':years<4.5e9?', when Earth’s life was still microscopic':', before the Sun and Earth formed';
  return`The light you see left it about ${f} years ago${when}.`}
function dsoPhysics(o){
  const parts=[];const t=o.type;
  if(t[0]==='G'&&t!=='GCl'){const h=hubbleExplain(o.hub);if(h)parts.push(h);if(o.z!=null&&o.rv!=null&&o.z>0)parts.push(`Its spectrum is redshifted by z = ${o.z.toFixed(5)}: it is moving away at about ${Math.round(o.rv).toLocaleString('en-US')} km/s.${o.z>0.008?' At this distance the recession is mainly the expansion of the universe itself (Hubble’s law, v = H₀d).':' This galaxy is so close that its own motion through space matters as much as cosmic expansion.'}`);
    if(o.z!=null&&o.z<0)parts.push(`It is blueshifted: moving towards us at about ${Math.abs(Math.round(o.rv||o.z*299792)).toLocaleString('en-US')} km/s, one of the few galaxies that is.`)}
  else if(DSOPHYS[t])parts.push(DSOPHYS[t]);
  const cd=DSODESC[o.M]||DSODESC[o.id];let ly=cd?parseLyYears(cd[1]):null;
  if(!ly&&o.z!=null&&o.z>0.008)ly=o.z*299792.458/70*3.2616e6;
  if(ly)parts.push(lookbackText(ly));
  if(!parts.length)return'';
  return `<div class="sec"><div class="lbl">Astrophysics</div>${parts.map(p=>`<p class="phys">${escapeHtml(p)}</p>`).join('')}</div>`;
}

