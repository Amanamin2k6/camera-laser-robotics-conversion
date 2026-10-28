import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DEFAULT,IMAGE,NEAR,corners,compute,cameraFaces,clipPolygon,clipSegment,reticule} from './geometry.js';

// Independent reference: express a ray in cuboid-local coordinates and
// intersect two axis-aligned slabs. This does not use polygon-edge intersections.
function slab(scene,lateral) {
  const t=scene.angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  const origin=[-c*scene.z+s*(lateral-scene.x),s*scene.z+c*(lateral-scene.x)];
  const velocity=[c,-s],extent=[.5,2];let enter=-Infinity,exit=Infinity;
  for(let i=0;i<2;i++){
    if(Math.abs(velocity[i])<1e-12){if(Math.abs(origin[i])>extent[i]+1e-9)return null;continue;}
    let a=(-extent[i]-origin[i])/velocity[i],b=(extent[i]-origin[i])/velocity[i];
    if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);
  }
  if(exit<enter-1e-9||exit<=1e-9)return null;
  return enter>1e-9?enter:exit;
}
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
const inclination=angle=>((angle+90)%180+180)%180-90;
let rays=0,tilts=0,clippedFaces=0;
function check(scene){
  const r=compute(scene);
  for(const [hit,x] of [[r.left,scene.s],[r.right,-scene.s]]){
    const expected=slab(scene,x);rays++;
    if(expected===null)assert.equal(hit,null);else{assert.ok(hit);near(hit.z,expected);near(hit.u,-scene.f*x/expected);}
    if(hit?.recovered!==null&&hit?.recovered!==undefined){assert.ok(r.valid&&hit.inFrame&&!r.overlap);near(hit.recovered,expected);}
  }
  if(r.estimate!==null){
    assert.ok(r.valid&&r.sharedFaces.length&&r.left.inFrame&&r.right.inFrame&&!r.overlap);
    const expected=inclination(scene.angle-(r.sharedFaces[0]%2===0?90:0));
    near(r.estimate,expected,1e-7);tilts++;
  }
  for(const f of cameraFaces(scene)){
    assert.ok(f.image.length>=3);
    for(const p of f.image){assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<=IMAGE.u+1e-8&&Math.abs(p[1])<=IMAGE.v+1e-8);}
    clippedFaces++;
  }
}
const angles=[...new Set([...Array.from({length:65},(_,i)=>-180+i*5.625),-30,30,-60,60])];
for(const z of [.1,.5,1,3,5,15])for(const x of [-4,-.2,0,2,4])for(const angle of angles)for(const s of [.1,.5,1,2])check({z,x,angle,s,f:.5,resolution:640});
let seed=0x627a;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<2000;i++)check({z:.1+14.9*random(),x:-4+8*random(),angle:-180+360*random(),s:.1+1.9*random(),f:.1+1.9*random(),resolution:[0,320,640,1280][i%4]});

const base=compute({...DEFAULT});near(base.left.z,2.5);near(base.right.z,2.5);near(base.left.u,-.2);near(base.right.u,.2);near(base.estimate,0);
for(const angle of [-30,30]){const r=compute({...DEFAULT,z:5,x:0,angle});near(r.left.z,5-.5/Math.cos(angle*Math.PI/180)-Math.tan(angle*Math.PI/180));near(r.estimate,angle);}
const sixty=compute({...DEFAULT,z:5,x:0,angle:60});near(sixty.left.z,3.267949192431123);near(sixty.right.z,5.732050807568877);assert.equal(sixty.estimate,null);assert.match(sixty.reason,/different faces/);
const student=compute({...DEFAULT,z:4,x:0,angle:50.625});near(student.left.z,2.2333916573887);near(student.right.z,4.430348902136725);assert.equal(student.estimate,null);assert.match(student.reason,/different faces/);
const half=compute({...DEFAULT,z:5,x:0,angle:180});near(half.left.z,4.5);near(half.estimate,0);
const out=compute({...DEFAULT,z:1,f:2});near(out.left.u,-4);near(out.right.u,4);assert.equal(out.left.recovered,null);assert.equal(out.right.recovered,null);assert.equal(out.estimate,null);
const originalBoundary=compute({...DEFAULT,f:2});assert.ok(originalBoundary.left.inFrame&&originalBoundary.right.inFrame);near(originalBoundary.left.recovered,2.5);
for(const angle of [-180,-90,0,30,60,90,180]){const r=compute({...DEFAULT,z:.1,x:0,angle});assert.equal(r.valid,false);assert.equal(r.estimate,null);for(const hit of [r.left,r.right])if(hit)assert.equal(hit.recovered,null);}
const missing=compute({...DEFAULT,z:5,x:2});assert.ok(missing.left);assert.equal(missing.right,null);assert.equal(missing.estimate,null);
const edge=compute({...DEFAULT,z:5,x:0,angle:90});assert.equal(edge.left,null);assert.equal(edge.right,null);
const far=compute({...DEFAULT,z:15,x:0,s:.1,f:.1});assert.ok(far.overlap);assert.equal(far.left.recovered,null);assert.equal(far.estimate,null);
const ideal=compute({...DEFAULT,z:15,x:0,s:.1,f:.1,resolution:0});assert.equal(ideal.overlap,false);near(ideal.left.recovered,14.5);near(ideal.estimate,0);
const resized=compute({...DEFAULT,f:1});near(resized.left.u,2*base.left.u);near(resized.left.recovered,base.left.recovered);
const surface=cameraFaces(DEFAULT);assert.equal(surface.length,1);const u=surface[0].image.map(p=>p[0]),v=surface[0].image.map(p=>p[1]);near((Math.max(...u)-Math.min(...u))/(Math.max(...v)-Math.min(...v)),2);
near(reticule(.1,.1).scale,.02);near(reticule(.5,.3).scale,.1);near(reticule(.5,.7).scale,.5);near(reticule(.5,1).scale,1);
const segment=clipSegment([-2,0],[2,0]);near(segment[0][0],-.8);near(segment[1][0],.8);near(segment[0][1],0);near(segment[1][1],0);assert.equal(clipSegment([2,2],[3,3]),null);
const clipped=clipPolygon([[-1,-1,-1],[1,-1,2],[1,1,2],[-1,1,-1]],2,NEAR,true);assert.equal(clipped.length,4);assert.ok(clipped.every(p=>p[2]>=NEAR-1e-9));

// Previously observed live-Wolfram SVG coordinates are an external reference,
// not a fresh comparison with a running Mathematica kernel.
const reference=JSON.parse(await fs.readFile(new URL('../evidence/live-comparison/live-observations.json',import.meta.url),'utf8'));
const sourceScenes=[{...DEFAULT},{...DEFAULT,f:2},{...DEFAULT,s:.1,f:.1},{...DEFAULT,angle:50.625,s:.1,f:.1}];
let referenceChecks=0,maxReferenceError=0;
for(let i=0;i<4;i++){
  const actual=compute(sourceScenes[i]),spots=reference.cases[i].original.spots;
  const expected=spots.map(s=>(s.cx-reference.normalization.originalCamera.imageCenter[0])/reference.normalization.originalCamera.unitsPerImageUnit).sort((a,b)=>a-b);
  const values=[actual.left.u,actual.right.u].sort((a,b)=>a-b);
  for(let j=0;j<2;j++){const error=Math.abs(values[j]-expected[j]);assert.ok(error<2e-6,`Stored Wolfram scene ${i}: ${error}`);maxReferenceError=Math.max(maxReferenceError,error);referenceChecks++;}
}
const live=JSON.parse(await fs.readFile(new URL('../evidence/assignment-2/live-original-comparison.json',import.meta.url),'utf8'));
let freshSpotChecks=0,maxFreshSpotError=0,maxFreshRadiusError=0;
for(const entry of live.cases){
  assert.equal(entry.original.spots.length,entry.final.spots.length);
  for(let i=0;i<entry.original.spots.length;i++){
    const error=Math.abs(entry.original.spots[i].u-entry.final.spots[i].u);
    const radiusError=Math.abs(entry.original.spots[i].relativeRadius-entry.final.spots[i].relativeRadius);
    assert.ok(error<2e-6);assert.ok(radiusError<2e-6);maxFreshSpotError=Math.max(maxFreshSpotError,error);maxFreshRadiusError=Math.max(maxFreshRadiusError,radiusError);freshSpotChecks++;
  }
}
const originalVertices=live.rotatedFaces.original.flat(),finalVertices=live.rotatedFaces.final.flat();
let maxFreshFaceError=0;
assert.equal(originalVertices.length,finalVertices.length);
for(const p of originalVertices){const closest=Math.min(...finalVertices.map(q=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))));assert.ok(closest<2e-6);maxFreshFaceError=Math.max(maxFreshFaceError,closest);}
const result={rayChecks:rays,validFaceTilts:tilts,clippedFaces,storedWolframSpotChecks:referenceChecks,maxStoredWolframError:maxReferenceError,freshLiveWolframScenes:live.cases.length,freshSpotChecks,maxFreshSpotError,maxFreshRadiusError,maxFreshFaceError,closedFormAndRegressionChecks:'passed',limitations:'Finite deterministic sample. Stored September 30 observations and fresh October 28 live-browser comparisons are separate evidence; neither is a desktop Mathematica kernel execution.'};
const dir=new URL('../evidence/assignment-2/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('geometry-results.json',dir),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
