// World coordinates are [forward z, lateral x]; vertical height is y.
// The source cuboid is 1 deep, 4 wide and 2 high. All lengths share one unit.
export const IMAGE = Object.freeze({u: .8, v: .4});
export const NEAR = .01;
export const DEFAULT = Object.freeze({z: 3, x: -.2, angle: 0, s: 1, f: .5, resolution: 640});
export const LIMITS = Object.freeze({z: [.1, 15], x: [-4, 4], angle: [-180, 180], s: [.1, 2], f: [.1, 2]});
const EPS = 1e-9;

export function corners({z, x, angle}) {
  const t = angle * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return [[-.5,-2],[.5,-2],[.5,2],[-.5,2]].map(([a,b]) => [z+c*a-s*b, x+s*a+c*b]);
}

export function intersect(points, lateral) {
  const candidates = [];
  points.forEach((a, i) => {
    const b = points[(i+1)%points.length], dx = b[1]-a[1];
    if (Math.abs(dx) < EPS) {
      // A ray on a boundary is allowed; endpoint contacts retain both face IDs.
      if (Math.abs(lateral-a[1]) < EPS) for (const p of [a,b]) if (p[0] > EPS) candidates.push({z:p[0],face:i});
      return;
    }
    const t = (lateral-a[1])/dx;
    if (t >= -EPS && t <= 1+EPS) {
      const z = a[0]+Math.max(0, Math.min(1,t))*(b[0]-a[0]);
      if (z > EPS) candidates.push({z,face:i});
    }
  });
  if (!candidates.length) return null;
  const z = Math.min(...candidates.map(p => p.z));
  return {z, x:lateral, faces:[...new Set(candidates.filter(p => Math.abs(p.z-z) < EPS*10).map(p => p.face))]};
}

export function compute(scene) {
  const points = corners(scene);
  const minDepth = Math.min(...points.map(p => p[0]));
  const valid = Object.entries(LIMITS).every(([key, [lo,hi]]) => Number.isFinite(scene[key]) && scene[key]>=lo && scene[key]<=hi) && minDepth > NEAR;
  const left = intersect(points,scene.s), right = intersect(points,-scene.s);
  for (const hit of [left,right]) if (hit) {
    hit.u = -scene.f*hit.x/hit.z;
    hit.inFrame = Math.abs(hit.u) <= IMAGE.u+EPS;
    hit.recovered = null;
  }
  const resolution = scene.resolution ?? 640;
  const separationPixels = left && right ? Math.abs(right.u-left.u)*resolution/(2*IMAGE.u) : null;
  // Match the original's drawn spot diameters, then apply an explicitly disclosed
  // display-overlap / one-pixel sampling check. This is not a calibrated sensor.
  const spotRadii = left && right ? resolution*.1*scene.f*(1/left.z+1/right.z) : 0;
  const overlap = !!(resolution && left?.inFrame && right?.inFrame && separationPixels < Math.max(1,spotRadii)-EPS);
  for (const hit of [left,right]) if (hit) {
    hit.status = !valid ? 'Invalid scene' : !hit.inFrame ? 'Outside image' : overlap ? 'Unresolved spots' : 'Visible';
    if (hit.status === 'Visible') hit.recovered = -scene.f*hit.x/hit.u;
  }
  const sharedFaces = left && right ? left.faces.filter(face => right.faces.includes(face)) : [];
  let reason = '';
  if (!valid) reason = 'Invalid scene: the entire cuboid must be in front of the camera plane (z > 0.01). Move it forward or reduce its rotation.';
  else if (!left && !right) reason = 'Both lasers miss the cuboid. Two visible hits on one face are required.';
  else if (!left || !right) reason = 'One laser misses the cuboid. Face tilt needs two visible hits.';
  else if (!left.inFrame || !right.inFrame) reason = 'A laser hit is outside the camera image. Geometric intersections are shown, but off-image camera depths are unavailable.';
  else if (overlap) reason = 'Laser spots overlap or are less than one pixel apart at the selected resolution. Separate camera measurements are unavailable; exact geometric values remain in the table.';
  else if (!sharedFaces.length) reason = 'The lasers hit different faces. The same-face angle formula is not applicable.';
  const estimate = reason ? null : Math.atan2(right.recovered-left.recovered,2*scene.s)*180/Math.PI;
  return {points, minDepth, valid, left, right, sharedFaces, separationPixels, overlap, estimate, reason};
}

// Sutherland-Hodgman clipping. Clip in world space before dividing by z, then
// in image space so neither camera-plane crossings nor huge polygons leak out.
export function clipPolygon(vertices, axis, bound, greater) {
  if (!vertices.length) return [];
  const result = [], inside = p => greater ? p[axis]>=bound : p[axis]<=bound;
  let a = vertices.at(-1);
  for (const b of vertices) {
    const ai=inside(a), bi=inside(b);
    if (ai !== bi) {
      const t=(bound-a[axis])/(b[axis]-a[axis]);
      result.push(a.map((v,i) => v+t*(b[i]-v)));
    }
    if (bi) result.push(b);
    a=b;
  }
  return result;
}

export function project([x,y,z], f) { return [-f*x/z, f*y/z]; }

export function cameraFaces(scene) {
  const pts=corners(scene), faces=[];
  pts.forEach((a,i) => {
    const b=pts[(i+1)%4];
    const facing=(b[1]-a[1])*(-a[0])-(b[0]-a[0])*(-a[1]);
    if (facing <= EPS) return;
    const world=clipPolygon([[a[1],-1,a[0]],[a[1],1,a[0]],[b[1],1,b[0]],[b[1],-1,b[0]]],2,NEAR,true);
    let image=world.map(p => project(p,scene.f));
    for (const [axis,bound,greater] of [[0,-IMAGE.u,true],[0,IMAGE.u,false],[1,-IMAGE.v,true],[1,IMAGE.v,false]]) image=clipPolygon(image,axis,bound,greater);
    if (image.length>=3) faces.push({face:i, depth:(a[0]+b[0])/2, image});
  });
  return faces.sort((a,b) => b.depth-a.depth);
}

export function clipSegment(a,b, u=IMAGE.u, v=IMAGE.v) {
  const d=[b[0]-a[0],b[1]-a[1]];
  let lo=0,hi=1;
  for (let i=0;i<2;i++) {
    const bound=i===0?u:v;
    if (Math.abs(d[i])<EPS) { if (Math.abs(a[i])>bound) return null; continue; }
    let t1=(-bound-a[i])/d[i],t2=(bound-a[i])/d[i];
    if(t1>t2) [t1,t2]=[t2,t1];
    lo=Math.max(lo,t1); hi=Math.min(hi,t2);
    if(lo>hi) return null;
  }
  return [[a[0]+lo*d[0],a[1]+lo*d[1]],[a[0]+hi*d[0],a[1]+hi*d[1]]];
}

export function reticule(f,s) {
  const product=f*s, scale=product<.1?.02:product<.25?.1:product<.5?.5:1;
  return {
    scale,
    major:[.8,1,1.2,1.5,2,3,5,10].map(d => d*scale),
    minor:[.5,.6,.7,.8,.9,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2,3,4,5,6,7,8,9,10,20,30,50,100,200].map(d => d*scale)
  };
}
