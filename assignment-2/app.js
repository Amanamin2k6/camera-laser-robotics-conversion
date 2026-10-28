import {DEFAULT,LIMITS,IMAGE,NEAR,compute,cameraFaces,project,clipSegment,reticule} from './geometry.js';

const $=id=>document.getElementById(id);
const specs=[
  ['z','Object depth z','Object center; camera at z = 0',.01],
  ['x','Lateral position x','Positive x is above the top-view axis',.01],
  ['angle','Object orientation θ','Degrees; face tilt is only defined modulo 180°',5.625],
  ['s','Laser offset s','Camera to each laser; separation = 2s',.01],
  ['f','Focal length λ','Pinhole to image plane',.01]
];
const presets={
  tilted:{z:5,x:0,angle:30,s:1,f:.5},negative:{z:5,x:0,angle:-30,s:1,f:.5},
  crossed:{z:5,x:0,angle:60,s:1,f:.5},miss:{z:5,x:2,angle:0,s:1,f:.5},
  edge:{z:5,x:0,angle:90,s:1,f:.5},outside:{z:1,x:-.2,angle:0,s:1,f:2},
  overlap:{z:15,x:0,angle:0,s:.1,f:.1},halfturn:{z:5,x:0,angle:180,s:1,f:.5}
};
let state={...DEFAULT},zoom=1,model,topMap,dragging=null;
const drafts=new Set();
const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const rounded=n=>Number(n.toFixed(6));
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d).replace(/^-0\.0+$/,Number(0).toFixed(d)):'—';
const short=n=>Number(n.toPrecision(12)).toString();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(a,b,color,width=1,dash='',extra='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" ${dash?`stroke-dasharray="${dash}"`:''} ${extra}/>`;
const poly=(p,fill,stroke='none',extra='')=>`<polygon points="${p.map(a=>a.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const text=(p,s,anchor='middle',cls='guide',extra='')=>`<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" class="${cls}" ${extra}>${escape(s)}</text>`;
const point=(p,r,fill,extra='')=>`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${fill}" ${extra}/>`;

$('controls').innerHTML=specs.map(([key,label,help])=>{
  const [min,max]=LIMITS[key];
  return `<div class="control"><label for="${key}Number">${label}</label><div class="pair"><input id="${key}" type="range" min="${min}" max="${max}" step="any" aria-label="${label} slider" aria-describedby="${key}Help"><input id="${key}Number" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${label}" aria-describedby="${key}Help ${key}Error"></div><small id="${key}Help">${help} · ${min} to ${max}</small><p class="field-error" id="${key}Error" role="status"></p></div>`;
}).join('');

function clearError(key) {$(`${key}Number`).removeAttribute('aria-invalid');$(`${key}Error`).textContent='';}
function setError(key,msg) {$(`${key}Number`).setAttribute('aria-invalid','true');$(`${key}Error`).textContent=msg;}
function applyField(key) {
  const input=$(`${key}Number`),raw=input.value.trim();
  if(!drafts.has(key)) return;
  if(!decimal.test(raw)||!Number.isFinite(Number(raw))) {setError(key,'Enter a complete number. The scene has not changed.');return;}
  const value=Number(raw),[min,max]=LIMITS[key];
  if(value<min||value>max) {setError(key,`Enter a value from ${min} to ${max}. The scene has not changed.`);return;}
  state[key]=value;drafts.delete(key);clearError(key);input.value=state[key];render();
}
function clearDrafts() {for(const [key] of specs){drafts.delete(key);clearError(key);}}
for(const [key,,,step] of specs) {
  const slider=$(key),input=$(`${key}Number`);
  input.addEventListener('input',()=>{drafts.add(key);clearError(key);});
  input.addEventListener('blur',()=>applyField(key));
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();applyField(key);}
    if(e.key==='Escape'){e.preventDefault();drafts.delete(key);clearError(key);input.value=state[key];}
  });
  slider.addEventListener('input',()=>{state[key]=rounded(Number(slider.value));drafts.delete(key);clearError(key);render();});
  slider.addEventListener('keydown',e=>{
    const [min,max]=LIMITS[key];let value;
    if(['ArrowLeft','ArrowDown'].includes(e.key)) value=state[key]-step*(e.shiftKey?10:1);
    else if(['ArrowRight','ArrowUp'].includes(e.key)) value=state[key]+step*(e.shiftKey?10:1);
    else if(e.key==='Home') value=min; else if(e.key==='End') value=max; else return;
    e.preventDefault();state[key]=rounded(Math.max(min,Math.min(max,value)));drafts.delete(key);clearError(key);render();
  });
}
$('reset').addEventListener('click',()=>{state={...DEFAULT};zoom=1;clearDrafts();$('notice').textContent='';render();});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  state={...state,...presets[button.dataset.preset]};zoom=1;clearDrafts();$('notice').textContent='';render();
}));
$('resolution').addEventListener('change',e=>{state.resolution=Number(e.target.value);render();});
$('zoom').addEventListener('change',e=>{zoom=Number(e.target.value);render();});

function renderTop(result) {
  const svg=$('top'),w=Math.max(280,Math.round(svg.clientWidth)),h=w/2,pad=25;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const zmin=Math.min(-1,-1.5*state.f-.25,...result.points.map(p=>p[0]-.5));
  const zmax=Math.max(15,...result.points.map(p=>p[0]+.7));
  const halfX=Math.max(4,...result.points.map(p=>Math.abs(p[1])+.7),state.s+.7);
  const scale=Math.min((w-2*pad)/(zmax-zmin),(h-2*pad)/(2*halfX));
  const cx=(zmin+zmax)/2,cy=0;
  const tp=([z,x])=>[w/2+(z-cx)*scale,h/2-(x-cy)*scale];
  const inv=([px,py])=>[(px-w/2)/scale+cx,(h/2-py)/scale+cy];
  topMap={tp,inv,w,h,zmin,zmax,scale};
  let out=`<defs><marker id="dim-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M6 3 0 0 0 6Z" fill="#4f6770"/></marker></defs>`;
  const tickStep=w<500?5:2;
  for(let z=Math.ceil(zmin);z<=zmax;z++){
    out+=line(tp([z,-halfX]),tp([z,halfX]),'#e6eded');
    if(z>=0&&z%tickStep===0) out+=text([tp([z,-halfX])[0],h-7],z,'middle','axis-label');
  }
  for(let x=-Math.floor(halfX);x<=halfX;x++) out+=line(tp([zmin,x]),tp([zmax,x]),'#e6eded');
  out+=poly([tp([0,0]),tp([zmax,zmax*.8/state.f]),tp([zmax,-zmax*.8/state.f])],'#2886ad13');
  out+=line(tp([0,0]),tp([zmax,0]),'#81969e',1,'5 5');
  out+=poly([tp([-1.5*state.f,-.8]),tp([0,-.8]),tp([0,.8]),tp([-1.5*state.f,.8])],'#53616c');
  out+=poly(result.points.map(tp),result.valid?'#b58952':'#d99e8a','#694d31','id="top-object"');
  for(const [hit,lateral,name] of [[result.left,state.s,'left'],[result.right,-state.s,'right']]){
    out+=line(tp([0,lateral]),tp([hit?.z??zmax,lateral]),'#c83b50',2);
    out+=poly([tp([-.5,lateral-.125]),tp([0,lateral-.125]),tp([0,lateral+.125]),tp([-.5,lateral+.125])],'#d89028','#9b6017');
    if(hit){out+=line(tp([0,0]),tp([hit.z,hit.x]),'#c83b50',1,'4 4');out+=point(tp([hit.z,hit.x]),3.5,'#c83b50',`data-hit="${name}"`);}
  }
  for(const sign of [-1,1])out+=line(tp([sign*state.f,-.8]),tp([sign*state.f,.8]),'#277aa7',3);
  out+=point(tp([0,0]),4,'#277aa7');
  // Object angle arc: reference is the positive lateral axis, as in the source.
  const t=state.angle*Math.PI/180,r=Math.min(.85,Math.max(.45,30/scale));
  const arcSteps=Math.max(2,Math.ceil(Math.abs(state.angle)/5));
  const arc=Array.from({length:arcSteps+1},(_,i)=>{const a=t*i/arcSteps;return tp([state.z-r*Math.sin(a),state.x+r*Math.cos(a)]);});
  out+=`<polyline points="${arc.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#243e48" stroke-width="1.2" marker-end="url(#dim-arrow)"/>`;
  out+=line(tp([state.z,state.x]),tp([state.z,state.x+r*1.4]),'#536975',1,'3 3');
  out+=line(tp([state.z,state.x]),tp([state.z-r*1.4*Math.sin(t),state.x+r*1.4*Math.cos(t)]),'#536975');
  if(Math.abs(state.angle)>3)out+=text(tp([state.z-r*1.75*Math.sin(t/2),state.x+r*1.75*Math.cos(t/2)]),'θ');
  const dim=(a,b,label,offset=[0,-5])=>{
    const pa=tp(a),pb=tp(b);
    out+=line(pa,pb,'#536975',1,'','marker-start="url(#dim-arrow)" marker-end="url(#dim-arrow)"');
    out+=text([(pa[0]+pb[0])/2+offset[0],(pa[1]+pb[1])/2+offset[1]],label);
  };
  dim([0,Math.max(state.s+.55,2.5)],[state.f,Math.max(state.s+.55,2.5)],'λ');
  dim([-.7,-state.s],[-.7,0],'s',[-8,3]);
  out+=text([w-8,h-7],'z →','end','axis-label');
  out+=text([9,15],'+x ↑','start','axis-label');
  const center=tp([state.z,state.x]);
  out+=`<g id="drag-handle" tabindex="0" role="button" aria-label="Move object center with arrow keys; Shift increases the step" aria-describedby="handle-description">${point(center,22,'transparent')}${point(center,7,'#173342','class="visible-handle" stroke="white" stroke-width="2"')}<title>Object center: z=${state.z}, x=${state.x}</title></g><desc id="handle-description">Right and left change depth. Up and down change lateral position.</desc>`;
  const focused=document.activeElement?.id==='drag-handle';
  svg.innerHTML=out;
  if(focused)$('drag-handle').focus({preventScroll:true});
}

function renderCamera(result) {
  const svg=$('camera'),w=Math.max(280,Math.round(svg.clientWidth)),h=w/2,scale=w/(1.6/zoom);
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const cp=([u,v])=>[w/2+u*scale,h/2-v*scale];
  const uMax=.8/zoom,vMax=.4/zoom;
  const clippedLine=(a,b,color='#bdcbd1',width=1)=>{const seg=clipSegment(a,b,uMax,vMax);return seg?line(cp(seg[0]),cp(seg[1]),color,width):'';};
  let out=`<rect x="0" y="${h/2}" width="${w}" height="${h/2}" fill="#eef5f7"/>`;
  const far=Math.round(20*state.f)+1;
  const farV=cp([0,-state.f/far])[1];
  out+=`<rect x="0" y="${h/2}" width="${w}" height="${Math.max(0,Math.min(h,farV)-h/2)}" fill="#e1e7e9" opacity=".6"/>`;
  for(let z=1;z<far;z++)out+=clippedLine(project([-50,-1,z],state.f),project([50,-1,z],state.f));
  for(let x=-Math.round(3/state.f);x<=Math.round(3/state.f);x++)out+=clippedLine(project([x,-1,NEAR],state.f),project([x,-1,far],state.f));
  for(const face of cameraFaces(state))out+=poly(face.image.map(cp),face.face%2?'#ad804b':'#bb915c','#6f512f',`class="camera-face" data-face="${face.face}" stroke-width="1"`);
  out+=line([0,h/2],[w,h/2],'#637a84')+line([w/2,0],[w/2,h],'#7c929b',1,'3 4');
  const ticks=reticule(state.f,state.s),minorPositions=[];
  for(const depth of ticks.minor)for(const sign of [-1,1]){
    const u=sign*state.f*state.s/depth,pos=cp([u,0])[0];
    if(pos<3||pos>w-3||Math.abs(pos-w/2)<3||minorPositions.some(p=>Math.abs(p-pos)<3))continue;
    minorPositions.push(pos);out+=line([pos,h/2+3],[pos,h/2+8],'#657b84');
  }
  // Preserve the original calibration/signs, but cull labels by their actual
  // screen-space extents rather than painting overlapping text at the origin.
  const occupied=[];
  for(const depth of ticks.major)for(const sign of [-1,1]){
    const u=sign*state.f*state.s/depth,pos=cp([u,0])[0],label=short(sign*depth),half=label.length*3.5+3;
    if(pos-half<3||pos+half>w-3||Math.abs(pos-w/2)<half+7||occupied.some(([a,b])=>pos+half>a&&pos-half<b))continue;
    occupied.push([pos-half-4,pos+half+4]);
    out+=line([pos,h/2-9],[pos,h/2+9],'#455d68',1.2);
    out+=text([pos,h/2+24],label,'middle','tick-label',`data-depth="${sign*depth}"`);
  }
  for(const [hit,name] of [[result.left,'left'],[result.right,'right']])if(hit&&hit.inFrame&&Math.abs(hit.u)<uMax+1e-9&&result.valid){
    const r=w*.1*state.f/hit.z*zoom;
    out+=point(cp([hit.u,0]),r,'#ce334a',`class="laser-spot" data-laser="${name}" data-u="${hit.u}" data-radius="${r}"`);
  }
  out+=text([w/2+6,15],'vanishing line','start','guide');
  if(!result.valid){
    out+=`<rect x="8" y="${h/2-25}" width="${w-16}" height="50" rx="4" fill="#fff4f1" opacity=".95"/>`;
    out+=text([w/2,h/2-4],'Invalid camera/object configuration','middle','invalid-overlay');
    out+=text([w/2,h/2+15],'Move the cuboid in front of the camera.','middle','guide');
  }
  svg.innerHTML=out;
  $('image-note').textContent=`Equal image-axis scaling. ${zoom===1?'Original bounds: u ∈ [−0.8, 0.8], v ∈ [−0.4, 0.4].':`${zoom}× viewing crop; the physical sensor bounds stay ±0.8 by ±0.4.`} Reticule signs follow image side; forward distances are positive. Spot size follows the original relative scale; tiny spots are not artificially enlarged.`;
}

function renderDial() {
  let out=point([60,60],43,'#f6faf8','stroke="#bfd2d0"');
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,r=i%2?39:36;
    out+=line([60+r*Math.cos(a),60-r*Math.sin(a)],[60+43*Math.cos(a),60-43*Math.sin(a)],'#879f9e',i%2?1:1.5);
  }
  const a=state.angle*Math.PI/180;
  out+=line([60,60],[60+33*Math.cos(a),60-33*Math.sin(a)],'#bd3d4e',3)+point([60,60],4,'#173342');
  out+=`<text x="111" y="64" text-anchor="middle" font-size="10" fill="#536975">0</text><text x="60" y="10" text-anchor="middle" font-size="10" fill="#536975">π/2</text><text x="9" y="64" text-anchor="middle" font-size="10" fill="#536975">π</text><text x="60" y="117" text-anchor="middle" font-size="10" fill="#536975">−π/2</text>`;
  $('dial').innerHTML=out;$('dial').setAttribute('aria-valuenow',state.angle);$('dial').setAttribute('aria-valuetext',`${state.angle} degrees`);
  $('radians').textContent=`${short(state.angle/180)}π rad`;
}

function readingLabel(hit) {return !model.valid?'Invalid scene':!hit?'No hit':hit.recovered===null?hit.status:`${fmt(hit.recovered)} units`;}
function numericCell(value,digits=6) {return value===null||value===undefined?'<td>—</td>':`<td title="${value}">${escape(digits===12?short(value):fmt(value,digits))}</td>`;}
function render() {
  model=compute(state);
  for(const [key] of specs){$(key).value=state[key];if(!drafts.has(key))$(`${key}Number`).value=state[key];}
  $('resolution').value=state.resolution;$('zoom').value=zoom;
  $('leftDepth').textContent=readingLabel(model.left);$('rightDepth').textContent=readingLabel(model.right);
  $('estimate').textContent=model.estimate===null?'Unavailable':`${fmt(model.estimate,2)}°`;
  $('status').textContent=model.reason||`Two usable laser hits share one face. Recovered face tilt: ${fmt(model.estimate,2)}° (modulo 180°). ${state.resolution===0?'Ideal geometry mode uses exact coordinates; no sampling check.':'Camera sampling check enabled.'}`;
  $('status').className=`status ${!model.valid?'invalid':model.reason?'warning':''}`;
  $('readings').innerHTML=[[model.left,'Left (+s)'],[model.right,'Right (−s)']].map(([hit,name])=>`<tr><th scope="row">${name}</th>${numericCell(hit?.z)}${numericCell(hit?.u,12)}${numericCell(hit?.recovered)}<td>${!model.valid?'Invalid scene':hit?.status||'No hit'}</td></tr>`).join('');
  renderTop(model);renderCamera(model);renderDial();
}

function localPointer(event,svg){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());return [p.x,p.y];}
const top=$('top');
top.addEventListener('pointerdown',e=>{if(e.target.closest('#drag-handle')){e.preventDefault();dragging=e.pointerId;top.setPointerCapture(e.pointerId);}});
top.addEventListener('pointermove',e=>{
  if(dragging!==e.pointerId)return;
  const [z,x]=topMap.inv(localPointer(e,top));state.z=rounded(Math.max(.1,Math.min(15,z)));state.x=rounded(Math.max(-4,Math.min(4,x)));
  for(const key of ['z','x']){drafts.delete(key);clearError(key);}render();
});
const stopDrag=()=>{dragging=null;};
top.addEventListener('pointerup',stopDrag);top.addEventListener('pointercancel',stopDrag);top.addEventListener('lostpointercapture',stopDrag);
top.addEventListener('keydown',e=>{
  if(e.target.id!=='drag-handle'||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();const step=e.shiftKey?1:.1;
  if(e.key==='ArrowUp')state.x=rounded(Math.min(4,state.x+step));if(e.key==='ArrowDown')state.x=rounded(Math.max(-4,state.x-step));
  if(e.key==='ArrowRight')state.z=rounded(Math.min(15,state.z+step));if(e.key==='ArrowLeft')state.z=rounded(Math.max(.1,state.z-step));
  for(const key of ['z','x']){drafts.delete(key);clearError(key);}render();
});
const dial=$('dial');let dialing=null;
function turnDial(e){const [x,y]=localPointer(e,dial);state.angle=rounded(Math.round(Math.atan2(60-y,x-60)*180/Math.PI/5.625)*5.625);drafts.delete('angle');clearError('angle');render();}
dial.addEventListener('pointerdown',e=>{e.preventDefault();dialing=e.pointerId;dial.setPointerCapture(e.pointerId);turnDial(e);});
dial.addEventListener('pointermove',e=>{if(dialing===e.pointerId)turnDial(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(event,()=>dialing=null);
dial.addEventListener('keydown',e=>{
  const step=['ArrowRight','ArrowUp'].includes(e.key)?5.625:['ArrowLeft','ArrowDown'].includes(e.key)?-5.625:0;
  if(!step)return;e.preventDefault();const q=state.angle/5.625,next=(step>0?Math.floor(q+1e-10)+1:Math.ceil(q-1e-10)-1)*5.625;state.angle=rounded(Math.max(-180,Math.min(180,next)));drafts.delete('angle');clearError('angle');render();
});

function snapshot(){return {state:{...state},view:{zoom},geometry:{points:model.points,left:model.left,right:model.right},measurement:{validScene:model.valid,faceTiltDegrees:model.estimate,sharedFaces:model.sharedFaces,separationPixels:model.separationPixels,reason:model.reason||'Two usable hits on one face'},convention:'u=-f*x/z; v=f*y/z; depths are forward axial distances; tilt is modulo 180 degrees'};}
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='camera-laser-readings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('notice').textContent='Exact scene, geometric intersections and camera-validity checks exported.';
});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.search='';for(const [key,value] of Object.entries(state))url.searchParams.set(key,value);if(zoom!==1)url.searchParams.set('zoom',zoom);
  try{await navigator.clipboard.writeText(url.href);$('notice').textContent='Scene link copied.';}
  catch{const a=document.createElement('a');a.href=url.href;a.textContent='Open this scene link, then copy its address.';$('notice').replaceChildren(a);}
});
const params=new URLSearchParams(location.search),ignored=[];
for(const [key,[lo,hi]] of Object.entries(LIMITS))if(params.has(key)){
  const raw=params.get(key),v=Number(raw);if(decimal.test(raw)&&Number.isFinite(v)&&v>=lo&&v<=hi)state[key]=v;else ignored.push(key);
}
if(params.has('resolution')){const n=Number(params.get('resolution'));if([0,320,640,1280].includes(n))state.resolution=n;else ignored.push('resolution');}
if([1,2,4,8].includes(Number(params.get('zoom'))))zoom=Number(params.get('zoom'));
if(ignored.length)$('notice').textContent=`Invalid scene-link values ignored: ${ignored.join(', ')}. Defaults used for those fields.`;
render();
let queued=false;
new ResizeObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}).observe(document.querySelector('.workspace'));
