"use strict";
/* ================= PHONE ORIENTATION =================
   Orientation arrives as Euler angles (alpha, beta, gamma). They are converted to a quaternion,
   smoothed with an adaptive SLERP low-pass filter (heavy smoothing for tiny jitter, fast response
   for deliberate movement), then turned into the camera's forward/up/right vectors. */
const sensor={on:false,got:0,abs:false,cam:null,q:null,handler:null,timer:0,lastT:0,lastRendered:null,relOffset:null,acc:null,mode:''};
let calib=store.get('calib',{yaw:0,pitch:0,star:''});
const HAS_ORIENT=typeof window.DeviceOrientationEvent!=='undefined';
const IS_TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
if(HAS_ORIENT&&IS_TOUCH){$('gyroBtn').hidden=false;$('camBtn').hidden=false}
function screenAngle(){let a=0;try{a=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0)}catch(e){}return((a%360)+360)%360}
// quaternion helpers [w,x,y,z]
function qMul(a,b){return[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]]}
function qAxis(ax,ang){const s=Math.sin(ang/2);return[Math.cos(ang/2),ax[0]*s,ax[1]*s,ax[2]*s]}
function qRot(q,v){const p=[0,v[0],v[1],v[2]];const c=[q[0],-q[1],-q[2],-q[3]];const r=qMul(qMul(q,p),c);return[r[1],r[2],r[3]]}
function qNorm(q){const l=Math.hypot(q[0],q[1],q[2],q[3])||1;return[q[0]/l,q[1]/l,q[2]/l,q[3]/l]}
function qSlerp(a,b,t){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];if(d<0){b=[-b[0],-b[1],-b[2],-b[3]];d=-d}
  if(d>0.9995)return qNorm([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t]);
  const th=Math.acos(d),s=Math.sin(th),wa=Math.sin((1-t)*th)/s,wb=Math.sin(t*th)/s;return[a[0]*wa+b[0]*wb,a[1]*wa+b[1]*wb,a[2]*wa+b[2]*wb,a[3]*wa+b[3]*wb]}
function qAngle(a,b){const d=Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]);return 2*Math.acos(Math.min(1,d))}
// W3C device orientation: R = Rz(alpha)·Rx(beta)·Ry(gamma), in East-North-Up
function eulerToQ(alpha,beta,gamma){return qMul(qMul(qAxis([0,0,1],alpha*DEG),qAxis([1,0,0],beta*DEG)),qAxis([0,1,0],gamma*DEG))}
const enuToH=v=>[v[1],-v[0],v[2]];
function rotZ(v,ang){const c=Math.cos(ang),s=Math.sin(ang);return[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]]}
function applyCalib(f,u){
  const yaw=calib.yaw+(sensor.relOffset||0);
  f=rotZ(f,-yaw*DEG);u=rotZ(u,-yaw*DEG);
  const p=calib.pitch*DEG,c=Math.cos(p),s=Math.sin(p);
  return[[f[0]*c+u[0]*s,f[1]*c+u[1]*s,f[2]*c+u[2]*s],[u[0]*c-f[0]*s,u[1]*c-f[1]*s,u[2]*c-f[2]*s]];
}
function sensorPill(){const p=$('sensorPill');if(!sensor.on){p.style.display='none';$('alignBtn').hidden=true;return}p.style.display='block';
  let t;
  if(S.aligning)t='Align: aim the crosshair at a bright star or planet you can really see, hold still, then tap that object on the chart.';
  else if(!sensor.got)t='Waiting for motion sensors… hold the phone up toward the sky.';
  else if(sensor.mode==='gyro')t='Gyro-only mode (no compass found): turning works, but north is a guess. Tap Align and pick a star to fix the heading. Tap here to stop.';
  else t='Following your phone'+(sensor.acc!=null&&sensor.acc>20?` · compass accuracy ±${Math.round(sensor.acc)}°, move the phone in a figure-8`:'')+(calib.star?` · aligned on ${calib.star}`:'')+'. Tap to stop.';
  p.textContent=t;$('alignBtn').hidden=!sensor.on;$('alignBtn').classList.toggle('on',!!S.aligning)}
function stopSensor(reason){
  if(!sensor.on)return;sensor.on=false;sensor.cam=null;sensor.q=null;S.aligning=false;
  try{window.removeEventListener('deviceorientationabsolute',sensor.handler,true);window.removeEventListener('deviceorientation',sensor.handler,true)}catch(e){}
  clearTimeout(sensor.timer);clearTimeout(sensor.gyroTimer);$('gyroBtn').classList.remove('on');sensorPill();if(S.camera)stopCamera();
  if(reason)alertNote(reason);requestRender();
}
function showPermHelp(kind){
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const t=kind==='denied'?(ios
      ?'Motion access was not allowed, so the chart stays on touch control (drag to look around). To allow it: close this tab, open the site again and tap Phone compass, then choose Allow. If Safari no longer asks, go to Settings → Apps → Safari → Advanced → Website Data, delete this site, and try again.'
      :'Motion access was not allowed, so the chart stays on touch control (drag to look around). In Chrome: tap ⋮ → ⓘ (site info) → Permissions or Site settings → Motion sensors → Allow, then tap Phone compass again.')
    :kind==='embedded'?'Your phone is fine. This copy of the chart runs inside an embedded viewer, and browsers do not pass motion data into embedded pages. Open your hosted copy (GitHub Pages) to use Phone compass. Touch control still works here.'
    :'No motion readings arrived, so the chart stays on touch control. Check that motion sensors are allowed for this site in your browser’s site settings, then try again.';
  alertNote(t,12000);
}
async function startSensor(){
  // NOTE: requestPermission must be the first thing awaited inside the tap handler (iOS requires a user gesture)
  if(!HAS_ORIENT){alertNote('This device does not report its orientation. Drag to look around instead.');return false}
  try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted'){showPermHelp('denied');return false}}}
  catch(e){let embedded=false;try{embedded=window.top!==window.self}catch(_){embedded=true}showPermHelp(embedded?'embedded':'denied');return false}
  sensor.on=true;sensor.got=0;sensor.abs=false;sensor.q=null;sensor.relOffset=null;sensor.mode='';sensor.lastT=0;sensor.lastRendered=null;
  sensor.handler=ev=>{try{onOrientation(ev)}catch(e){console.warn(e)}};
  window.addEventListener('deviceorientationabsolute',sensor.handler,true);window.addEventListener('deviceorientation',sensor.handler,true);
  $('gyroBtn').classList.add('on');sensorPill();
  sensor.timer=setTimeout(()=>{if(sensor.on&&!sensor.got){let embedded=false;try{embedded=window.top!==window.self}catch(e){embedded=true}stopSensor();showPermHelp(embedded?'embedded':'none')}},3000);
  // if after 1.5 s we only have relative readings, there is no magnetometer: run gyro-only, keeping the current heading
  sensor.gyroTimer=setTimeout(()=>{if(sensor.on&&sensor.got&&!sensor.abs){sensor.mode='gyro';sensorPill()}},1500);
  return true;
}
function onOrientation(ev){
  if(!sensor.on||document.hidden)return;
  let alpha=null,abs=false;
  if(typeof ev.webkitCompassHeading==='number'&&!isNaN(ev.webkitCompassHeading)&&ev.webkitCompassHeading>=0){alpha=360-ev.webkitCompassHeading;abs=true;sensor.acc=typeof ev.webkitCompassAccuracy==='number'?ev.webkitCompassAccuracy:null}
  else if(ev.type==='deviceorientationabsolute'||ev.absolute===true){alpha=ev.alpha;abs=true}
  else alpha=ev.alpha;
  if(alpha==null||ev.beta==null||ev.gamma==null||!isFinite(alpha))return;
  if(sensor.abs&&!abs)return; // a true-north stream exists: ignore the relative one
  const first=!sensor.got;sensor.got++;
  if(abs&&!sensor.abs){sensor.abs=true;sensor.q=null;sensor.relOffset=null;sensor.mode=''}
  // device quaternion, then account for how the screen is rotated (portrait/landscape)
  let q=qMul(eulerToQ(alpha,ev.beta,ev.gamma),qAxis([0,0,1],-screenAngle()*DEG));
  const now=performance.now();const dt=sensor.lastT?Math.min(0.2,(now-sensor.lastT)/1000):0.016;sensor.lastT=now;
  if(!sensor.q)sensor.q=q;
  else{
    const ang=qAngle(sensor.q,q)*RAD;            // how far the raw reading is from the smoothed one
    if(ang<0.04&&!first){/* dead-band: ignore sensor noise */}
    else{const speed=ang/Math.max(dt,0.008);      // deg/s
      const tau=lerp(0.28,0.035,clamp(speed/60,0,1)); // slow → strong smoothing, fast → responsive
      sensor.q=qNorm(qSlerp(sensor.q,q,1-Math.exp(-dt/tau)))}
  }
  let f=enuToH(qRot(sensor.q,[0,0,-1])),u=enuToH(qRot(sensor.q,[0,1,0]));
  if(!sensor.abs&&sensor.relOffset==null){ // gyro-only: start from the heading the user was already looking at
    const az=((Math.atan2(-f[1],f[0])*RAD)+360)%360;sensor.relOffset=((S.az-az+540)%360)-180}
  let [F,U]=applyCalib(f,u);F=normV(F);const d=dotV(U,F);U=normV([U[0]-d*F[0],U[1]-d*F[1],U[2]-d*F[2]]);
  sensor.cam={f:F,u:U,r:crossV(F,U)};anim=null;
  // battery: only redraw when the view has visibly moved (about a third of a pixel)
  const thr=0.35/Math.max(1,scale);
  if(!sensor.lastRendered||Math.acos(clamp(dotV(F,sensor.lastRendered.f),-1,1))>thr||Math.acos(clamp(dotV(U,sensor.lastRendered.u),-1,1))>thr){sensor.lastRendered={f:F,u:U};requestRender()}
  if(first||sensor.got%45===0)sensorPill();
}
$('gyroBtn').onclick=()=>{if(sensor.on)stopSensor();else startSensor()};
$('sensorPill').onclick=()=>{if(S.aligning){S.aligning=false;sensorPill()}else stopSensor()};
$('alignBtn').onclick=()=>{S.aligning=!S.aligning;sensorPill();if(S.aligning)showInfo(null)};
function alignOn(sel){
  const v=selVec(sel);const t=objAltAz(v);const c=hToAzAlt(cam.f);
  let dAz=t.az-c.az;dAz=((dAz+540)%360)-180;const dAlt=t.alt-c.alt;
  const maxErr=sensor.mode==='gyro'?180:60;
  if(Math.abs(dAz)>maxErr||Math.abs(dAlt)>40){alertNote('That object is too far from the crosshair to be the one you are aiming at. Aim the crosshair at it in the real sky and try again.');return}
  calib.yaw=((calib.yaw+dAz+540)%360)-180;calib.pitch=clamp(calib.pitch+dAlt,-30,30);calib.star=selName(sel);store.set('calib',calib);
  if(sensor.mode==='gyro')sensor.mode='gyro-aligned';
  S.aligning=false;sensorPill();sensor.lastRendered=null;requestRender();
  alertNote(`Aligned on ${calib.star}: corrected ${Math.abs(dAz).toFixed(1)}° of heading and ${Math.abs(dAlt).toFixed(1)}° of tilt. Aligning on a second object far from the first refines it further.`);
}
function resetCalib(){calib={yaw:0,pitch:0,star:''};store.set('calib',calib);sensorPill();alertNote('Compass alignment cleared.');requestRender()}

