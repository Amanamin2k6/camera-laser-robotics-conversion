// World points are [forward depth z, lateral x]. Cuboid half dimensions: .5, 2, 1.
export function corners({z,x,angle}) {
  const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return [[-.5,-2],[.5,-2],[.5,2],[-.5,2]].map(([a,b])=>[z+c*a-s*b,x+s*a+c*b]);
}
export function intersect(points,lateral) {
  let best=null;
  points.forEach((a,i)=>{
    const b=points[(i+1)%points.length],dy=b[1]-a[1];
    if(Math.abs(dy)<1e-10)return;
    const t=(lateral-a[1])/dy;
    if(t < -1e-9 || t > 1+1e-9)return;
    const z=a[0]+t*(b[0]-a[0]);
    if(z>1e-6 && (!best || z<best.z))best={z,x:lateral,face:i};
  });
  return best;
}
export function compute(state) {
  const points=corners(state),left=intersect(points,state.s),right=intersect(points,-state.s);
  for(const hit of [left,right])if(hit){hit.u=-state.f*hit.x/hit.z;hit.recovered=-state.f*hit.x/hit.u;hit.inFrame=Math.abs(hit.u)<=.8;}
  const estimate=left&&right?Math.atan2(right.recovered-left.recovered,2*state.s)*180/Math.PI:null;
  return {points,left,right,estimate};
}
