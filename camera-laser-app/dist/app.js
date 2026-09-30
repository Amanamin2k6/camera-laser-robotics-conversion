import {compute} from './geometry.js';
const initial={z:3,x:-.2,angle:0,s:1,f:.5};
let state={...initial};
const specs=[['z','Object depth z',.1,15,.01,'Object center; camera at z = 0'],['x','Lateral position x',-4,4,.01,'Positive x is above the optical axis'],['angle','Object orientation θ',-180,180,1,'Degrees; 0° faces the camera'],['s','Laser offset s',.1,2,.01,'Camera to each laser; total spacing = 2s'],['f','Focal length λ',.1,2,.01,'Distance from pinhole to image plane']];
document.querySelector('#controls').innerHTML=specs.map(([key,label,min,max,step,help])=>`<div class="control"><label for="${key}">${label}</label><div class="pair"><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${label} slider"><input id="${key}Number" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}"></div><small>${help}</small></div>`).join('');
for(const [key,,min,max] of specs)for(const id of [key,key+'Number'])document.getElementById(id).addEventListener('input',e=>{const val=Number(e.target.value);if(Number.isFinite(val))state[key]=Math.max(min,Math.min(max,val));render();});
document.getElementById('reset').addEventListener('click',()=>{state={...initial};render();});
const presets={tilted:{z:5,x:0,angle:30,s:1,f:.5},miss:{z:5,x:2,angle:0,s:1,f:.5},edge:{z:5,x:0,angle:90,s:1,f:.5}};
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{state={...presets[b.dataset.preset]};render();}));
const fmt=(x,n=3)=>Number.isFinite(x)?x.toFixed(n):'—';
const tp=([z,x])=>[(z+1)*50,200-x*50];
const cp=([u,v])=>[400+u*500,140-v*350];
const line=(a,b,color,width=2,dash='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const poly=(p,fill,stroke='none')=>`<polygon points="${p.map(a=>a.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}"/>`;
const text=(p,value,anchor='middle')=>`<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}">${value}</text>`;
function render(){
  for(const [key] of specs)for(const id of [key,key+'Number'])document.getElementById(id).value=state[key];
  const {points,left,right,estimate}=compute(state);
  let top='';
  for(let z=0;z<=15;z++){top+=line(tp([z,-4]),tp([z,4]),'#e1e9f0',1);top+=text([tp([z,-4])[0],392],z);}
  for(let x=-3;x<=3;x++)top+=line(tp([-1,x]),tp([15,x]),'#e1e9f0',1);
  top+=poly([tp([0,0]),tp([15,15*.8/state.f]),tp([15,-15*.8/state.f])],'#2783c81a');
  top+=line(tp([0,0]),tp([15,0]),'#72889b',1,'5 5');
  top+=poly(points.map(tp),'#a67645','#5d4129');
  top+=line(tp([state.f,-.8]),tp([state.f,.8]),'#2783c8',4);
  top+=line(tp([-state.f,-.8]),tp([-state.f,.8]),'#2783c8',4);
  top+=`<circle cx="50" cy="200" r="5" fill="#2783c8"/>`;
  for(const [hit,lateral] of [[left,state.s],[right,-state.s]]){
    top+=line(tp([0,lateral]),tp([hit?.z??15,lateral]),'#df3549',2);
    top+=poly([tp([-.5,lateral-.12]),tp([0,lateral-.12]),tp([0,lateral+.12]),tp([-.5,lateral+.12])],'#e69826');
    if(hit){top+=line(tp([0,0]),tp([hit.z,hit.x]),'#df3549',1,'5 5');const p=tp([hit.z,hit.x]);top+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#df3549"/>`;}
  }
  const h=tp([state.z,state.x]);
  top+=`<circle id="handle" cx="${h[0]}" cy="${h[1]}" r="8" fill="#182938" stroke="white" stroke-width="2"/><title>Object center z ${fmt(state.z)}, x ${fmt(state.x)}</title>`;
  document.getElementById('top').innerHTML=top;
  let cam=poly([[0,140],[800,140],[800,280],[0,280]],'#2783c812');
  for(let i=0;i<4;i++){
    const a=points[i],b=points[(i+1)%4];
    if(a[0]<=.001||b[0]<=.001)continue;
    if(a[1]/a[0]>b[1]/b[0]){
      const ua=-state.f*a[1]/a[0],ub=-state.f*b[1]/b[0];
      cam+=poly([cp([ua,-state.f/a[0]]),cp([ua,state.f/a[0]]),cp([ub,state.f/b[0]]),cp([ub,-state.f/b[0]])],'#a67645','#5d4129');
    }
  }
  cam+=line([0,140],[800,140],'#667c8e',1)+line([400,0],[400,280],'#667c8e',1,'3 4');
  for(const depth of [.8,1,1.2,1.5,2,3,5,10,20,50])for(const sign of [-1,1]){
    const u=sign*state.f*state.s/depth;
    if(Math.abs(u)<=.79){const pos=cp([u,0]);cam+=line([pos[0],140],[pos[0],154],'#526677',1)+text([pos[0],173],depth);}
  }
  for(const hit of [left,right])if(hit){const p=cp([hit.u,0]);cam+=`<circle cx="${p[0]}" cy="${p[1]}" r="${Math.max(3,state.f*.1/hit.z*500)}" fill="#ed3349" stroke="white" stroke-width="1"/>`;}
  cam+=text([410,20],'vanishing point','start');
  document.getElementById('camera').innerHTML=cam;
  document.getElementById('leftDepth').textContent=left?fmt(left.z)+' units':'No hit';
  document.getElementById('rightDepth').textContent=right?fmt(right.z)+' units':'No hit';
  document.getElementById('estimate').textContent=estimate===null?'Unavailable':fmt(estimate,2)+'°';
  document.getElementById('status').textContent=left&&right?'Both lasers intersect the cuboid.':!left&&!right?'Both lasers miss the cuboid. Orientation cannot be estimated.':'One laser misses the cuboid. Orientation needs two distances.';
  document.getElementById('readings').innerHTML=[[left,'Left',state.s],[right,'Right',-state.s]].map(([hit,name,x])=>`<tr><td>${name}</td><td>${fmt(x)}</td><td>${hit?fmt(hit.u,5):'—'}</td><td>${hit?fmt(hit.recovered):'—'}</td></tr>`).join('');
}
let dragging=false;
const top=document.getElementById('top');
top.addEventListener('pointerdown',e=>{if(e.target.id==='handle'){dragging=true;top.setPointerCapture(e.pointerId);}});
top.addEventListener('pointermove',e=>{if(!dragging)return;const r=top.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*800,py=(e.clientY-r.top)/r.height*400;state.z=Math.max(.1,Math.min(15,px/50-1));state.x=Math.max(-4,Math.min(4,(200-py)/50));render();});
top.addEventListener('pointerup',()=>dragging=false);
top.addEventListener('pointercancel',()=>dragging=false);
render();
