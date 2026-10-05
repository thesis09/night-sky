"use strict";
/* ================= AUTOMATIC LOCATION FOR FIRST-TIME VISITORS =================
   1) Right away, without any permission: an approximate place from the device's time zone.
   2) Then, once: ask for the precise device location. If allowed, switch to it; if not, keep the estimate.
   People who already chose a location (saved in their browser) are never changed. */
const TZ_PLACES={
 'America/New_York':['New York',40.7128,-74.006],'America/Detroit':['Detroit',42.3314,-83.0458],'America/Chicago':['Chicago',41.8781,-87.6298],
 'America/Denver':['Denver',39.7392,-104.9903],'America/Phoenix':['Phoenix',33.4484,-112.074],'America/Los_Angeles':['Los Angeles',34.0522,-118.2437],
 'America/Anchorage':['Anchorage',61.2181,-149.9003],'Pacific/Honolulu':['Honolulu',21.3069,-157.8583],'America/Toronto':['Toronto',43.6532,-79.3832],
 'America/Vancouver':['Vancouver',49.2827,-123.1207],'America/Mexico_City':['Mexico City',19.4326,-99.1332],'America/Sao_Paulo':['São Paulo',-23.5505,-46.6333],
 'America/Argentina/Buenos_Aires':['Buenos Aires',-34.6037,-58.3816],'Europe/London':['London',51.5074,-0.1278],'Europe/Dublin':['Dublin',53.3498,-6.2603],
 'Europe/Paris':['Paris',48.8566,2.3522],'Europe/Berlin':['Berlin',52.52,13.405],'Europe/Madrid':['Madrid',40.4168,-3.7038],'Europe/Rome':['Rome',41.9028,12.4964],
 'Europe/Amsterdam':['Amsterdam',52.3676,4.9041],'Europe/Stockholm':['Stockholm',59.3293,18.0686],'Europe/Moscow':['Moscow',55.7558,37.6173],
 'Asia/Dubai':['Dubai',25.2048,55.2708],'Asia/Kolkata':['Nagpur',21.1458,79.0882],'Asia/Calcutta':['Nagpur',21.1458,79.0882],'Asia/Kathmandu':['Kathmandu',27.7172,85.324],
 'Asia/Dhaka':['Dhaka',23.8103,90.4125],'Asia/Karachi':['Karachi',24.8607,67.0011],'Asia/Singapore':['Singapore',1.3521,103.8198],'Asia/Shanghai':['Shanghai',31.2304,121.4737],
 'Asia/Hong_Kong':['Hong Kong',22.3193,114.1694],'Asia/Tokyo':['Tokyo',35.6762,139.6503],'Asia/Seoul':['Seoul',37.5665,126.978],'Asia/Jakarta':['Jakarta',-6.2088,106.8456],
 'Australia/Sydney':['Sydney',-33.8688,151.2093],'Australia/Melbourne':['Melbourne',-37.8136,144.9631],'Australia/Brisbane':['Brisbane',-27.4698,153.0251],
 'Australia/Perth':['Perth',-31.9505,115.8605],'Pacific/Auckland':['Auckland',-36.8485,174.7633],'Africa/Johannesburg':['Johannesburg',-26.2041,28.0473],
 'Africa/Cairo':['Cairo',30.0444,31.2357],'Africa/Lagos':['Lagos',6.5244,3.3792],'Africa/Nairobi':['Nairobi',-1.2921,36.8219],'Etc/UTC':['Greenwich',51.4769,0],'UTC':['Greenwich',51.4769,0]};
function tzGuess(){
  let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
  const p=TZ_PLACES[tz];if(p)return{name:p[0]+' (approximate)',lat:p[1],lon:p[2],elev:0};
  // unknown zone: longitude from the UTC offset, a mid-northern latitude, named after the zone's city
  const off=-new Date().getTimezoneOffset()/60;const city=(tz.split('/').pop()||'Your area').replace(/_/g,' ');
  return{name:city+' (approximate)',lat:30,lon:clamp(off*15,-180,180),elev:0};
}
const AUTOLOC={first:false};
(function autoLocate(){
  let saved=null;try{saved=localStorage.getItem('nsky.obs')}catch(e){}
  if(saved)return; // the visitor already chose a place
  AUTOLOC.first=true;
  const g=tzGuess();S.obs=g; // used by start-up, so the very first sky drawn is already roughly right
  if(g.lat<0)S.az=0; // southern hemisphere: start facing north, where the sky's best view is
  // after start-up, ask once for the precise location
  let n=0;const iv=setInterval(()=>{n++;if(typeof appReady!=='undefined'&&appReady){clearInterval(iv);setTimeout(askPrecise,1200)}else if(n>120)clearInterval(iv)},250);
  function askPrecise(){
    const keepGuess=msg=>{try{localStorage.setItem('nsky.obs',JSON.stringify(S.obs))}catch(e){}if(msg&&typeof alertNote==='function')alertNote(msg,9000)};
    if(!navigator.geolocation){keepGuess(`Showing the sky for ${g.name.replace(' (approximate)','')}, estimated from your time zone. Tap the place card (top left) to set your exact location.`);return}
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=+pos.coords.latitude.toFixed(4),lon=+pos.coords.longitude.toFixed(4);
      setObs({name:'My location',lat,lon,elev:Math.round(pos.coords.altitude||0)});
      if(typeof toast==='function')toast('Using your location: '+Math.abs(lat).toFixed(2)+'°'+(lat>=0?'N':'S')+' '+Math.abs(lon).toFixed(2)+'°'+(lon>=0?'E':'W'));
    },()=>keepGuess(`Showing the sky for ${g.name.replace(' (approximate)','')}, estimated from your time zone. For your exact sky, tap the place card (top left) → “Use my device location”, or pick a city.`),
    {enableHighAccuracy:false,timeout:15000,maximumAge:600000});
  }
})();
