"use strict";
const A=window.Astronomy, SD=window.SKYDATA;
const DEG=Math.PI/180, RAD=180/Math.PI, TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem('nsky.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('nsky.'+k,JSON.stringify(v))}catch(e){}}};

