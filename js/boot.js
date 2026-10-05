"use strict";
/* Boot loader: fetches the sky catalogue and star data, then loads the app's scripts in order.
   Each script is a plain (non-module) script that shares the page's global scope. */
(function(){
  const VERSION='5.5';
  const SCRIPTS=["js/core/util.js", "js/core/data.js", "js/data/knowledge.js", "js/core/state.js", "js/core/astro.js", "js/render/colors.js", "js/render/projection.js", "js/render/background2d.js", "js/render/draw-helpers.js", "js/render/globe.js", "js/render/webgl.js", "js/render/render.js", "js/ui/hud.js", "js/ui/format.js", "js/ui/info.js", "js/ui/interaction.js", "js/ui/search.js", "js/ui/controls.js", "js/sensors/orientation.js", "js/sensors/camera.js", "js/live/net.js", "js/live/satellites.js", "js/live/exoplanets.js", "js/science/astrophysics.js", "js/science/smallbodies.js", "js/live/references.js", "js/live/gaia.js", "js/core/scheduler.js", "js/pro/workspace.js", "js/pro/palette.js", "js/pro/planner.js", "js/pro/equipment.js", "js/pro/surveys.js", "js/pro/lab.js", "js/pro/events.js", "js/pro/space3d.js", "js/ui/quickstart.js", "js/main.js"];
  const $=id=>document.getElementById(id);
  function fail(msg){const e=$('err');e.style.display='block';e.textContent=msg;$('loading').style.display='none'}
  if(!window.Astronomy){fail('The astronomy engine could not load, so positions cannot be computed. Check the internet connection and reload the page.');return}
  const v='?v='+VERSION;
  const note=t=>{const s=$('loading').querySelector('small');if(s)s.textContent=t};
  Promise.all([
    fetch('data/catalog.json'+v).then(r=>{if(!r.ok)throw new Error('catalog '+r.status);return r.json()}),
    fetch('data/stars.bin'+v).then(r=>{if(!r.ok)throw new Error('stars '+r.status);return r.arrayBuffer()})
  ]).then(([cat,stars])=>{
    window.SKYDATA=cat;window.SKYSTARS_BUF=stars;note('Starting the planetarium…');
    let i=0;const next=()=>{if(i>=SCRIPTS.length)return;const s=document.createElement('script');s.src=SCRIPTS[i++]+v;s.async=false;s.onload=next;s.onerror=()=>fail('Could not load '+s.src+'. Reload the page.');document.body.appendChild(s)};
    next();
  }).catch(e=>fail('Could not load the sky data ('+e.message+'). If you opened index.html straight from your disk, use the hosted site instead: browsers block data files on file:// pages.'));
})();
