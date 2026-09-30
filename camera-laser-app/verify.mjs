import assert from 'node:assert/strict';
import {compute} from './dist/geometry.js';

// Independent analytical reference: transform a forward ray into object-local
// coordinates, then intersect it with the cuboid's two rectangular slabs.
function slabDepth(scene,lateral) {
  const a=scene.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const origin=[-c*scene.z+s*(lateral-scene.x),s*scene.z+c*(lateral-scene.x)];
  const velocity=[c,-s],extent=[.5,2];
  let enter=-Infinity,exit=Infinity;
  for(let i=0;i<2;i++){
    if(Math.abs(velocity[i])<1e-12){if(Math.abs(origin[i])>extent[i]+1e-9)return null;continue;}
    let lo=(-extent[i]-origin[i])/velocity[i],hi=(extent[i]-origin[i])/velocity[i];
    if(lo>hi)[lo,hi]=[hi,lo];
    enter=Math.max(enter,lo);exit=Math.min(exit,hi);
  }
  if(exit<enter-1e-9||exit<=1e-6)return null;
  return enter>1e-6?enter:exit;
}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);}
let rayChecks=0;
for(const z of [3,5,15])for(const x of [-4,-.2,0,2,4])for(const angle of [-180,-120,-90,-60,-30,0,30,60,90,120,180])for(const s of [.1,1,2]){
  const scene={z,x,angle,s,f:.5},r=compute(scene);
  for(const [actual,lateral] of [[r.left,s],[r.right,-s]]){
    const expected=slabDepth(scene,lateral);
    if(expected===null)assert.equal(actual,null);else{assert.ok(actual);near(actual.z,expected);near(actual.recovered,expected);}
    rayChecks++;
  }
}
const base=compute({z:3,x:-.2,angle:0,s:1,f:.5});
near(base.left.z,2.5);near(base.right.z,2.5);near(base.left.u,-.2);near(base.right.u,.2);near(base.estimate,0);
for(const angle of [-30,30]){
  const r=compute({z:5,x:0,angle,s:1,f:.5});
  near(r.left.z,5-.5/Math.cos(angle*Math.PI/180)-Math.tan(angle*Math.PI/180));
  near(r.estimate,angle);
}
const calibration=compute({z:3,x:-.2,angle:0,s:1,f:1});
near(calibration.left.u,2*base.left.u);near(calibration.left.recovered,base.left.recovered);
const miss=compute({z:5,x:2,angle:0,s:1,f:.5});assert.ok(miss.left);assert.equal(miss.right,null);assert.equal(miss.estimate,null);
const edge=compute({z:5,x:0,angle:90,s:1,f:.5});assert.equal(edge.left,null);assert.equal(edge.right,null);
const crossed=compute({z:5,x:0,angle:60,s:1,f:.5});assert.notEqual(crossed.left.face,crossed.right.face);
console.log(`PASS: ${rayChecks} laser-ray cases agree with independent oriented-box slab calculations.`);
console.log('PASS: default projection, common-face +/-30 degrees, focal scaling, one miss and two misses.');
console.log(`OBSERVED LIMITATION: theta=60 degrees, two different faces, estimator=${crossed.estimate.toFixed(5)} degrees.`);
console.log('These checks validate ideal geometry; they do not validate camera visibility, UI or full orientation recovery.');
