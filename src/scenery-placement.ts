import * as THREE from 'three';
import {samples,TRACK_WIDTH,type Obstacle} from './track';

export interface SceneryFootprint {name:string;x:number;z:number;halfX:number;halfZ:number;}

// Reserve the whole ribbon plus a shoulder, including bends and neighbouring lanes.
export function roadClear(x:number,z:number,halfX:number,halfZ:number){
 const clearance=TRACK_WIDTH/2+1.2;
 return samples.every(p=>{
  const dx=Math.max(0,Math.abs(p.x-x)-halfX),dz=Math.max(0,Math.abs(p.z-z)-halfZ);
  return dx*dx+dz*dz>clearance*clearance;
 });
}

export function placeScenery(objects:THREE.Object3D[],obstacles:Obstacle[]):SceneryFootprint[]{
 const footprints:SceneryFootprint[]=[];
 for(const object of objects){
  object.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(object);
  if(bounds.isEmpty()||bounds.min.y>3)continue;
  const members=new Set<THREE.Object3D>();object.traverse(o=>members.add(o));
  const colliders=obstacles.filter(o=>members.has(o.object));
  for(const c of colliders){bounds.expandByPoint(new THREE.Vector3(c.x-c.radius,0,c.z-c.radius));bounds.expandByPoint(new THREE.Vector3(c.x+c.radius,0,c.z+c.radius));}
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const inside=(x:number,z:number,hx:number,hz:number)=>((Math.abs(x)+hx)/61)**2+((Math.abs(z)+hz)/46)**2<.98;
  const fits=(x:number,z:number,hx:number,hz:number)=>inside(x,z,hx,hz)&&roadClear(x,z,hx,hz)&&footprints.every(f=>Math.abs(f.x-x)>f.halfX+hx+.25||Math.abs(f.z-z)>f.halfZ+hz+.25);
  let placement:{x:number;z:number;scale:number}|undefined;
  for(let scale=1;scale>=.26&&!placement;scale*=.78){
   const hx=size.x*scale/2,hz=size.z*scale/2;
   if(fits(center.x,center.z,hx,hz)){placement={x:center.x,z:center.z,scale};break;}
   let nearest=Infinity;
   for(let x=-54;x<=54;x+=3)for(let z=-39;z<=39;z+=3){
    const d=(x-center.x)**2+(z-center.z)**2;
    if(d<nearest&&fits(x,z,hx,hz)){nearest=d;placement={x,z,scale};}
   }
  }
  if(!placement){
   object.removeFromParent();
   for(const c of colliders)obstacles.splice(obstacles.indexOf(c),1);
   continue;
  }
  const {x,z,scale}=placement,origin=object.position.clone();
  object.scale.multiplyScalar(scale);
  object.position.x=x-(center.x-origin.x)*scale;object.position.z=z-(center.z-origin.z)*scale;
  for(const c of colliders){c.x=x+(c.x-center.x)*scale;c.z=z+(c.z-center.z)*scale;c.radius*=scale;}
  footprints.push({name:object.name||object.type,x,z,halfX:size.x*scale/2,halfZ:size.z*scale/2});
 }
 return footprints;
}
