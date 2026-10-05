"use strict";
/* ================= CAMERA (AR) MODE ================= */
let camStream=null;
S.camLongFov=store.get('camLongFov',66);
function camFovForScreen(){const v=$('camVideo');const vw=v.videoWidth||1920,vh=v.videoHeight||1080;const sc=Math.max(W/vw,H/vh);const long=Math.max(vw,vh);const tL=Math.tan(S.camLongFov*DEG/2);const halfMinPx=Math.min(W,H)/2/sc;return 2*Math.atan(tL*halfMinPx/(long/2))*RAD}
function camFovToLong(fov){const v=$('camVideo');const vw=v.videoWidth||1920,vh=v.videoHeight||1080;const sc=Math.max(W/vw,H/vh);const long=Math.max(vw,vh);const halfMinPx=Math.min(W,H)/2/sc;return 2*Math.atan(Math.tan(fov*DEG/2)*(long/2)/halfMinPx)*RAD}
async function startCamera(){
  if(!sensor.on){const ok=await startSensor();if(!ok)return}   // first await = the permission prompt (keeps the user gesture on iOS)
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alertNote('This browser does not offer camera access to web pages. The chart still follows your phone.');return}
  try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false})}
  catch(e){stopCameraUI();let embedded=false;try{embedded=window.top!==window.self}catch(_){embedded=true}
    alertNote(embedded?'Camera access is blocked inside this embedded viewer. Use your hosted copy (GitHub Pages).':'Camera access was refused ('+e.name+'). Allow the camera for this site in the browser’s site settings. The chart still follows your phone without it.',9000);return}
  const v=$('camVideo');v.srcObject=camStream;v.style.display='block';try{await v.play()}catch(e){}
  S.camera=true;S.preCamFov=S.fov;PROJ='gnomo';document.body.classList.add('cam');$('camBtn').classList.add('on');
  const setF=()=>{S.fov=camFovForScreen();requestRender()};if(v.videoWidth)setF();else v.onloadedmetadata=setF;
  alertNote('Camera mode: the chart is drawn over the live view. If the star spacing doesn’t match the real sky, pinch to adjust (it’s remembered). Use Align to remove the compass error.');
  requestRender();
}
function stopCameraUI(){S.camera=false;PROJ='stereo';document.body.classList.remove('cam');$('camBtn').classList.remove('on');const v=$('camVideo');v.style.display='none';v.srcObject=null}
function stopCamera(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}const wasCam=S.camera;stopCameraUI();if(wasCam&&S.preCamFov)S.fov=S.preCamFov;requestRender()}
$('camBtn').onclick=()=>{if(S.camera)stopCamera();else startCamera()};

