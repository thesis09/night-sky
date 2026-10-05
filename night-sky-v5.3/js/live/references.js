"use strict";
/* ================= LIVE: NASA, WIKIPEDIA, SIMBAD ================= */
function liveQuery(sel){
  if(sel.kind==='planet')return{nasa:sel.ref.key==='Moon'?'Moon':sel.ref.name,tokens:[sel.ref.name.toLowerCase()],wiki:[{Mercury:'Mercury (planet)',Moon:'Moon',Sun:'Sun'}[sel.ref.key]||sel.ref.name]};
  if(sel.kind==='dso'){const o=sel.ref;const names=[];if(o.common[0])names.push(o.common[0]);if(o.M)names.push('Messier '+o.M);names.push(o.id);
    const tokens=[];o.common.forEach(c=>tokens.push(c.toLowerCase()));if(o.M)tokens.push('m'+o.M,'m '+o.M,'messier '+o.M);tokens.push(o.id.toLowerCase(),o.id.toLowerCase().replace(' ',''));
    return{nasa:o.common[0]||(o.M?'Messier '+o.M:o.id),tokens,wiki:names}}
  if(sel.kind==='star'){const n=named.get(sel.ref);const nm=n&&n.proper;const con=CONS[sCon[sel.ref]];
    const wiki=[];if(nm)wiki.push(nm+' (star)',nm);if(n&&n.bayer&&con)wiki.push((GREEKW[n.bayer.split('-')[0]]||'')[0].toUpperCase()+(GREEKW[n.bayer.split('-')[0]]||'').slice(1)+' '+con[2]);
    return{nasa:nm||'',tokens:nm?[nm.toLowerCase()]:[],wiki,simbad:sHip[sel.ref]?'HIP '+sHip[sel.ref]:(n&&n.hd?'HD '+n.hd:null)}}
  if(sel.kind==='sat'){const m={25544:'International Space Station',48274:'Tiangong space station',20580:'Hubble Space Telescope'}[sel.ref.id];return{nasa:m||'',tokens:m?[m.toLowerCase().split(' ')[0]]:[],wiki:m?[m]:[]}}
  if(sel.kind==='gal')return{nasa:sel.ref.name+' Jupiter moon',tokens:[sel.ref.name.toLowerCase()],wiki:[sel.ref.name+' (moon)']};
  if(sel.kind==='con')return{nasa:'',tokens:[],wiki:[sel.ref.name+' (constellation)']};
  if(sel.kind==='sb'){const n=sel.ref.name;const bare=n.replace(/^\d+\s+/,'');return{nasa:bare,tokens:[bare.toLowerCase()],wiki:[bare+' (dwarf planet)',n.replace(/^(\d+)\s+/,'$1 '),bare]}}
  if(sel.kind==='gaia'){const T=GAIA.tiles.get(sel.ref.f);return{nasa:'',tokens:[],wiki:[],simbad:T?'Gaia DR3 '+T.ids[sel.ref.k]:null}}
  return{};
}
async function nasaSearch(q,tokens){
  return cached('nasa:'+q,async()=>{const j=await fetchJSON('https://images-api.nasa.gov/search?media_type=image&q='+encodeURIComponent(q),15000);
    const items=(j.collection&&j.collection.items)||[];const out=[];
    for(const it of items){const d=it.data&&it.data[0];if(!d)continue;const hay=((d.title||'')+' '+(d.keywords||[]).join(' ')+' '+(d.description||'').slice(0,400)).toLowerCase();
      if(tokens.length&&!tokens.some(t=>hay.includes(t)))continue;const thumb=it.links&&it.links.find(l=>l.render==='image'||/\.jpe?g|\.png/i.test(l.href||''));if(!thumb)continue;
      out.push({title:d.title,desc:stripHtml(d.description||d.description_508||''),center:d.center,date:(d.date_created||'').slice(0,10),id:d.nasa_id,thumb:thumb.href,credit:d.secondary_creator||d.photographer||''});if(out.length>=4)break}
    return out})}
async function wikiSummary(titles){
  for(const t of titles){try{const j=await cached('wiki:'+t,()=>fetchJSON('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t.replace(/ /g,'_')),12000));
    if(j&&j.type!=='disambiguation'&&j.extract&&!/may refer to/.test(j.extract))return j}catch(e){}}
  return null}
async function simbadStar(id){
  const q=`SELECT TOP 1 b.main_id,b.sp_type,b.plx_value,b.plx_err,b.rvz_radvel,b.pmra,b.pmdec,d.description FROM basic AS b JOIN ident AS i ON i.oidref=b.oid LEFT JOIN otypedef AS d ON d.otype=b.otype WHERE i.id='${id.replace(/'/g,"''")}'`;
  return cached('simbad:'+id,async()=>{const j=await fetchJSON('https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query='+encodeURIComponent(q),15000);
    const r=j.data&&j.data[0];if(!r)return null;const m={};(j.metadata||[]).forEach((c,k)=>m[c.name]=r[k]);return m})}
let liveToken=0;
async function loadLive(sel){
  const box=$('liveBox');if(!box)return;const tok=++liveToken;
  if(!S.layers.live){box.innerHTML='<div class="dir">Live NASA and research data is switched off in Layers.</div>';return}
  const q=liveQuery(sel);const parts={nasa:'',wiki:'',simbad:''};
  const paint=()=>{if(tok!==liveToken||!$('liveBox'))return;const html=parts.nasa+parts.simbad+parts.wiki;$('liveBox').innerHTML=html||'<div class="dir">Loading…</div>';
    $('liveBox').querySelectorAll('[data-nasa]').forEach(b=>b.onclick=()=>{const it=JSON.parse(decodeURIComponent(b.dataset.nasa));parts.nasa=nasaHtml(it,lastNasa);paint()});
    $('liveBox').querySelectorAll('.more').forEach(b=>b.onclick=()=>{b.previousElementSibling.classList.toggle('open');b.textContent=b.previousElementSibling.classList.contains('open')?'Show less':'Read the full NASA text'})};
  let lastNasa=[];
  const nasaHtml=(it,all)=>`<div class="nasa"><div class="lbl">From NASA</div><a href="https://images.nasa.gov/details/${encodeURIComponent(it.id)}" target="_blank" rel="noopener"><img src="${it.thumb}" alt="${escapeHtml(it.title)}" loading="lazy"></a>
    <div class="nt">${escapeHtml(it.title)}</div><div class="nd">${escapeHtml(it.desc)}</div>${it.desc.length>420?'<button class="more">Read the full NASA text</button>':''}
    <div class="src">${escapeHtml([it.center,it.date,it.credit].filter(Boolean).join(' · '))} · <a href="https://images.nasa.gov/details/${encodeURIComponent(it.id)}" target="_blank" rel="noopener">NASA Image Library</a></div>
    ${all.length>1?`<div class="thumbs">${all.map(a=>`<button data-nasa="${encodeURIComponent(JSON.stringify(a))}" class="${a.id===it.id?'on':''}" aria-label="${escapeHtml(a.title)}"><img src="${a.thumb}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</div>`;
  paint();
  const jobs=[];
  if(q.nasa)jobs.push(nasaSearch(q.nasa,q.tokens||[]).then(r=>{lastNasa=r;parts.nasa=r.length?nasaHtml(r[0],r):'';paint()}).catch(()=>{parts.nasa=''}));
  if(q.wiki&&q.wiki.length)jobs.push(wikiSummary(q.wiki).then(j=>{if(j)parts.wiki=`<div class="wk"><div class="lbl">Encyclopedia summary</div><div class="nd">${escapeHtml(j.extract)}</div><div class="src"><a href="${j.content_urls&&j.content_urls.desktop?j.content_urls.desktop.page:'#'}" target="_blank" rel="noopener">Wikipedia: ${escapeHtml(j.title)}</a> · CC BY-SA</div></div>`;paint()}).catch(()=>{}));
  if(q.simbad)jobs.push(simbadStar(q.simbad).then(m=>{if(!m)return;const plx=m.plx_value,pe=m.plx_err;let dist='';
    if(plx>0){const d=1000/plx*3.26156;const lo=pe&&plx-pe>0?1000/(plx+pe)*3.26156:null,hi=pe&&plx-pe>0?1000/(plx-pe)*3.26156:null;dist=`<dt>Distance (modern parallax)</dt><dd>${d<100?d.toFixed(2):Math.round(d).toLocaleString('en-US')} light-years${lo?` (range ${lo<100?lo.toFixed(1):Math.round(lo).toLocaleString('en-US')}–${hi<100?hi.toFixed(1):Math.round(hi).toLocaleString('en-US')})`:''}</dd><dt>Parallax</dt><dd>${plx.toFixed(3)} ± ${pe!=null?pe.toFixed(3):'?'} mas</dd>`}
    parts.simbad=`<div class="sb"><div class="lbl">Professional data (SIMBAD, CDS Strasbourg)</div><dl class="kv"><dt>Main identifier</dt><dd>${escapeHtml(m.main_id||'')}</dd>${m.description?`<dt>Object type</dt><dd>${escapeHtml(m.description)}</dd>`:''}${m.sp_type?`<dt>Spectral type</dt><dd>${escapeHtml(m.sp_type)}</dd>`:''}${dist}${m.rvz_radvel!=null?`<dt>Radial velocity</dt><dd>${m.rvz_radvel>0?'receding':'approaching'} at ${Math.abs(m.rvz_radvel).toFixed(1)} km/s</dd>`:''}${m.pmra!=null?`<dt>Proper motion</dt><dd>${(Math.hypot(m.pmra,m.pmdec)/1000).toFixed(3)}″ per year</dd>`:''}</dl></div>`;paint()}).catch(()=>{}));
  await Promise.all(jobs);
  if(tok!==liveToken||!$('liveBox'))return;
  if(!parts.nasa&&!parts.wiki&&!parts.simbad)$('liveBox').innerHTML=`<div class="dir">${HOSTED?'No NASA or reference material found for this object, or the services did not respond.':'Live NASA and research data loads on your hosted copy (GitHub Pages). This embedded viewer blocks internet requests.'}</div>`;
}
function refreshLayerStatus(){const e=$('liveStatus');if(e)e.innerHTML=`Satellites: ${escapeHtml(satStatus)}.<br>Exoplanets: ${escapeHtml(exoSource||'not loaded yet')}.<br>Gaia deep stars: ${escapeHtml(typeof GAIA!=='undefined'?GAIA.status:'')}.<br>Comets and asteroids: ${escapeHtml(typeof SB!=='undefined'?SB.status:'')}.`}

let noteTimer=0;function alertNote(t,ms){const e=$('err');e.textContent=t;e.style.display='block';clearTimeout(noteTimer);noteTimer=setTimeout(()=>e.style.display='none',ms||7000)}
$('err').addEventListener('click',()=>{$('err').style.display='none'});

