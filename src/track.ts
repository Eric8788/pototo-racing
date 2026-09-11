import * as THREE from 'three';

export const TRACK_WIDTH = 10.5;
export const TRACK_POINTS = [[0,31],[27,30],[44,14],[39,-12],[25,-29],[-1,-30],[-19,-25],[-38,-12],[-41,10],[-25,28]];
export const curve = new THREE.CatmullRomCurve3(TRACK_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
export const trackLength = curve.getLength();
export const samples = Array.from({length:400},(_,i)=>curve.getPointAt(i/400));
export function frameAt(t:number) {
  const position=curve.getPointAt(((t%1)+1)%1);
  const tangent=curve.getTangentAt(((t%1)+1)%1).normalize();
  const normal=new THREE.Vector3(-tangent.z,0,tangent.x);
  return {position,tangent,normal,heading:Math.atan2(tangent.x,tangent.z)};
}
export function nearestTrack(x:number,z:number) {
 let distance=Infinity,index=0;
 for(let i=0;i<samples.length;i++){const p=samples[i];const d=(x-p.x)**2+(z-p.z)**2;if(d<distance){distance=d;index=i;}}
 return {distance:Math.sqrt(distance),progress:index/samples.length,index};
}
export function ribbon(inner:number,outer:number,height:number) {
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let i=0;i<=400;i++) {
  const {position:p,normal:n}=frameAt(i/400);
  for(const offset of [inner,outer]){positions.push(p.x+n.x*offset,height,p.z+n.z*offset);normals.push(0,1,0);uv.push(offset===inner?0:1,i/10);}
  if(i<400){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
export interface Obstacle {x:number;z:number;radius:number;object:THREE.Object3D; movable?:boolean;vx?:number;vz?:number;}
export interface Ramp {x:number;z:number;heading:number;length:number;width:number;height:number;}
export const rampFrame=frameAt(.31);
export const ramp:Ramp={x:rampFrame.position.x,z:rampFrame.position.z,heading:rampFrame.heading,length:7,width:4.7,height:1.35};
export function groundHeight(x:number,z:number) {
 const dx=x-ramp.x,dz=z-ramp.z;
 const forward=dx*Math.sin(ramp.heading)+dz*Math.cos(ramp.heading);
 const lateral=dx*Math.cos(ramp.heading)-dz*Math.sin(ramp.heading);
 if(Math.abs(lateral)<ramp.width/2 && forward>=-ramp.length/2 && forward<=ramp.length/2)return .13+(forward/ramp.length+.5)*ramp.height;
 return nearestTrack(x,z).distance<TRACK_WIDTH/2+.7?.13:.025;
}
