"use strict";
/* ================= STATE ================= */
const CITIES=[['Nagpur',21.1458,79.0882,310],['Mumbai',19.076,72.8777,14],['Delhi',28.6139,77.209,216],['Bengaluru',12.9716,77.5946,920],['Pune',18.5204,73.8567,560],['Hyderabad',17.385,78.4867,505],['Chennai',13.0827,80.2707,6],['Kolkata',22.5726,88.3639,9],['Hanle (dark-sky reserve)',32.7794,78.9642,4500],['London',51.5074,-0.1278,11],['New York',40.7128,-74.006,10],['San Francisco',37.7749,-122.4194,16],['Sydney',-33.8688,151.2093,58],['Tokyo',35.6762,139.6503,40],['Singapore',1.3521,103.8198,15],['Atacama (ALMA)',-23.0294,-67.7548,5000]];
const LP=[['Excellent dark site (Bortle 1–2)',7.0,0],['Rural sky (Bortle 3)',6.3,.15],['Rural–suburban (Bortle 4)',5.8,.3],['Suburban (Bortle 5)',5.2,.5],['Bright suburban (Bortle 6)',4.7,.7],['City (Bortle 7–8)',4.2,.9],['Inner city (Bortle 9)',3.7,1]];
const S={
  obs:store.get('obs',{name:'Nagpur',lat:21.1458,lon:79.0882,elev:310}),
  tz:store.get('tz','device'),
  lp:store.get('lp',3),
  ground:store.get('ground',1), hud:store.get('hud',true), // 0 off, 1 see-through, 2 solid
  layers:Object.assign({lines:true,conNames:true,borders:false,starNames:true,planets:true,dso:true,photos:true,milky:true,ground:true,atmos:true,azgrid:false,eqgrid:false,ecliptic:false,sats:true,starlink:false,exo:true,live:true,gaia:true,sb:true},store.get('layers',{})),
  az:180, alt:35, fov:100,
  simMs:Date.now(), rate:1, live:true, lastReal:performance.now(),
  sel:null, hover:null
};
const RATES=[[1,'Live speed'],[60,'1 min / s'],[600,'10 min / s'],[3600,'1 hour / s'],[-3600,'−1 hour / s']];
let rateIdx=0;

