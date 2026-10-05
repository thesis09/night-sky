"use strict";
/* ================= NETWORK HELPERS ================= */
const HOSTED=(()=>{try{return location.protocol==='https:'&&!/claude\.ai|claudeusercontent|anthropic/.test(location.hostname)&&window.top===window.self}catch(e){return false}})();
async function fetchText(url,ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms||12000);try{const r=await fetch(url,{signal:c.signal,cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t)}}
async function fetchJSON(url,ms){return JSON.parse(await fetchText(url,ms))}
const liveCache=new Map();
function cached(key,fn){if(!liveCache.has(key))liveCache.set(key,fn().catch(e=>{liveCache.delete(key);throw e}));return liveCache.get(key)}
function stripHtml(t){const d=document.createElement('div');d.innerHTML=String(t||'');return(d.textContent||'').replace(/\s+/g,' ').trim()}

