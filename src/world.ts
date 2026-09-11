import * as THREE from 'three';
import {getTrack} from './track';
import {trackSpec} from './tracks';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {frameAt,ribbon,TRACK_WIDTH,nearestTrack,ramp,type Obstacle} from './track';
const C={grass:0xc5cc91,sand:0xf3ddad,road:0x566f75,ivory:0xfff6dd,ink:0x263f40,coral:0xf48368,yellow:0xf6ca62,teal:0x408b80,leaf:0x85a877,purple:0xa3a2bc};
const mats=new Map<number,THREE.MeshStandardMaterial>();
function mat(c:number){c=(trackSpec(getTrack()).colors as Record<number,number>)[c]??c;if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.82}));return mats.get(c)!;}
function mesh(g:THREE.BufferGeometry,c:number,parent:THREE.Object3D,x=0,y=0,z=0){const m=new THREE.Mesh(g,mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(p:THREE.Object3D,c:number,x:number,y:number,z:number,w:number,h:number,d:number,r=.12){return mesh(r?new RoundedBoxGeometry(w,h,d,2,r):new THREE.BoxGeometry(w,h,d),c,p,x,y,z);}
function sphere(p:THREE.Object3D,c:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=mesh(new THREE.SphereGeometry(1,14,10),c,p,x,y,z);m.scale.set(sx,sy,sz);return m;}
function cylinder(p:THREE.Object3D,c:number,x:number,y:number,z:number,r:number,h:number,top=r,sides=12){return mesh(new THREE.CylinderGeometry(top,r,h,sides),c,p,x,y,z);}
function textTexture(text:string,bg:string,fg='#263f40',small?:string){
 if(typeof document==='undefined')return new THREE.Texture();
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle=bg;c.fillRect(0,0,1024,256);c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.font='900 91px "Arial", "PingFang SC", sans-serif';c.fillText(text,512,small?102:135);if(small){c.font='600 29px Arial, sans-serif';c.fillText(small,512,203);}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function sign(p:THREE.Object3D,text:string,x:number,y:number,z:number,width:number,bg='#fff4d8',small?:string){
 const m=new THREE.Mesh(new THREE.BoxGeometry(width,width/4,.2),new THREE.MeshStandardMaterial({map:textTexture(text,bg,undefined,small),roughness:.9}));m.position.set(x,y,z);m.castShadow=true;p.add(m);return m;
}
let seed=9307;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
export interface Coin {object:THREE.Group;x:number;z:number;collected:boolean;}
export class World {
 gantry=new THREE.Group();private gantryRay=new THREE.Raycaster();
 group=new THREE.Group();obstacles:Obstacle[]=[];coins:Coin[]=[];mascots:THREE.Group[]=[];boosts:number[]=[.08,.57,.85];clouds:THREE.Group[]=[];
 constructor(scene:THREE.Scene){
  seed=9307;
  scene.add(this.group);const p=this.group;
  // A thick toy island, floating in a mint-blue sea.
  const ocean=mesh(new THREE.PlaneGeometry(1800,1800),0xc1dcdb,p,0,-3.5,0);ocean.name='Ocean';ocean.rotation.x=-Math.PI/2;ocean.castShadow=false;
  const island=cylinder(p,C.sand,0,-1.65,0,1,3.2,1,96);island.scale.set(64,1,49);
  const grass=cylinder(p,C.grass,0,-.10,0,1,.2,1,96);grass.scale.set(61.8,1,47.2);
  mesh(ribbon(-TRACK_WIDTH/2-.6,TRACK_WIDTH/2+.6,.055),C.ivory,p).castShadow=false;
  mesh(ribbon(-TRACK_WIDTH/2,TRACK_WIDTH/2,.12),C.road,p).castShadow=false;
  // Repeated curb strips and lane markers follow the exact driveable centerline.
  for(let i=0;i<126;i++){
   const f=frameAt(i/126);
   for(const s of [-1,1]){const a=frameAt((i-.43)/126),b=frameAt((i+.43)/126);a.position.addScaledVector(a.normal,(TRACK_WIDTH/2+.2)*s);b.position.addScaledVector(b.normal,(TRACK_WIDTH/2+.2)*s);const mid=a.position.clone().add(b.position).multiplyScalar(.5);const direction=b.position.clone().sub(a.position);const m=box(p,i%2?C.ivory:C.coral,mid.x,.18,mid.z,.59,.16,direction.length(),.025);m.rotation.y=Math.atan2(direction.x,direction.z);}
  }
  for(let i=0;i<64;i++){const f=frameAt(i/64);const m=box(p,0xb4c4bc,f.position.x,.132,f.position.z,.1,.025,1.2,0);m.rotation.y=f.heading;m.castShadow=false;}
  // Checkered start line, bright arch and cheeky track furniture.
  const start=frameAt(.002);const gate=new THREE.Group();gate.position.copy(start.position);gate.rotation.y=start.heading;p.add(gate);
  for(let i=0;i<12;i++)for(let j=0;j<3;j++)box(gate,(i+j)%2?C.ink:C.ivory,(i-5.5)*.85,.143,(j-1)*.7,.85,.03,.7,0).castShadow=false;
  for(const s of [-1,1]){box(gate,C.coral,s*6,3.15,0,.9,6.3,.9,.35);sphere(gate,C.yellow,s*6,6.6,0,.7);box(gate,C.ivory,s*6,1,0,1.3,1.8,1.3,.12);}
  gate.add(this.gantry);box(this.gantry,C.yellow,0,6.1,0,12.5,1.7,.9,.35);sign(this.gantry,'WOBBLE GP',0,6.2,.5,9.5,'#f6ca62','CERTIFIED NOT VERY SERIOUS');
  this.gantry.traverse(o=>{if(o instanceof THREE.Mesh){o.material=o.material.clone();o.material.transparent=true;}});
  for(const t of this.boosts){const f=frameAt(t);const g=new THREE.Group();g.position.copy(f.position);g.position.y=.16;g.rotation.y=f.heading;p.add(g);box(g,C.yellow,0,0,0,5,.08,4,.12);for(let i=0;i<3;i++){
   const arrow=new THREE.Shape();arrow.moveTo(-1.7,-.5);arrow.lineTo(0,.25);arrow.lineTo(1.7,-.5);arrow.lineTo(1.7,.05);arrow.lineTo(0,.85);arrow.lineTo(-1.7,.05);arrow.closePath();const a=new THREE.Mesh(new THREE.ShapeGeometry(arrow),mat(C.ivory));a.rotation.x=-Math.PI/2;a.rotation.z=Math.PI;a.position.set(0,.06,i*1.1-1.1);g.add(a);
  }}
  // Ramp: the same dimensions feed vehicle ground contact and jump physics.
  const rg=new THREE.BufferGeometry();const w=ramp.width/2,l=ramp.length/2,h=ramp.height;rg.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,-l,w,0,-l,w,h,l,-w,h,l,-w,0,l,w,0,l],3));rg.setIndex([0,3,1,1,3,2,3,4,2,2,4,5,0,4,3,1,2,5,0,1,4,1,5,4]);rg.computeVertexNormals();const rm=mesh(rg,C.coral,p,ramp.x,.13,ramp.z);rm.rotation.y=ramp.heading;
  const rampGroup=new THREE.Group();rampGroup.position.set(ramp.x,.13,ramp.z);rampGroup.rotation.y=ramp.heading;p.add(rampGroup);
  for(const s of [-1,1]){const edge=box(rampGroup,C.ivory,s*(w-.15),h/2+.035,0,.15,.08,ramp.length,.015);edge.rotation.x=-Math.atan(h/ramp.length);}
  // Collectible potato tokens, placed along the racing line.
  for(let i=0;i<26;i++){const t=(i+.5)/26;const f=frameAt(t);const g=new THREE.Group();g.position.set(f.position.x,.95,f.position.z);p.add(g);const token=mesh(new THREE.CylinderGeometry(.55,.55,.18,10),C.yellow,g);token.rotation.x=Math.PI/2;const mark=box(g,C.ivory,0,0,.12,.17,.49,.06,.035);mark.rotation.z=-.3;this.coins.push({object:g,x:f.position.x,z:f.position.z,collected:false});}
  this.potato(0,-2,1.5,0);this.potato(-26,-3,.42,.4);this.potato(29,6,.37,-1);
  // Central paddock / picnic village.
  const plaza=cylinder(p,0xe9d7b2,-3,-.01,-1,15,.1,15,48);plaza.scale.z=.84;plaza.castShadow=false;
  this.building(-17,9,0);this.building(16,-12,.35);
  for(let i=0;i<5;i++){const x=-12+i*4.5;box(p,C.ivory,x,.23,-16,2.8,.45,1.2);box(p,i%2?C.teal:C.coral,x,.52,-16,2.6,.12,1.05);}
  const billboard=new THREE.Group();billboard.position.set(-7,0,18);billboard.rotation.y=.12;p.add(billboard);for(const s of [-1,1])box(billboard,C.ink,s*3,1.5,0,.2,3,.2);sign(billboard,'小心，前方有薯',0,3.6,0,8.5,'#fff4dd','WATCH OUT FOR THE LOCAL POTATO');
  const rampSign=new THREE.Group();rampSign.position.set(ramp.x+7,0,ramp.z);rampSign.rotation.y=.6;p.add(rampSign);box(rampSign,C.teal,0,1.7,0,.2,3.4,.2);sign(rampSign,'起飞！',0,3.5,0,4,'#f7c967');
  // Keep trees and props out of the driveable road.
  for(let i=0;i<53;i++){
   const x=(rand()-.5)*116,z=(rand()-.5)*87;
   if((x/59)**2+(z/44)**2>.92||nearestTrack(x,z).distance<9||Math.abs(x)<24&&Math.abs(z)<20)continue;
   this.tree(x,z,.7+rand()*.8);
  }
  for(let i=0;i<22;i++){
   const f=frameAt(i/22);const s=i%2?1:-1;const x=f.position.x+f.normal.x*8*s,z=f.position.z+f.normal.z*8*s;this.cone(x,z);
  }
  for(let i=0;i<20;i++){
   const x=(rand()-.5)*112,z=(rand()-.5)*82;if(nearestTrack(x,z).distance<8||Math.abs(x)<24&&Math.abs(z)<20)continue;
   const r=.4+rand()*.8;const rock=mesh(new THREE.DodecahedronGeometry(r),i%3?0xd7c59f:0xa5b79d,p,x,r*.5,z);rock.scale.y=.7;rock.rotation.set(rand(),rand(),rand());
  }
  for(const t of [.19,.43,.67,.93]){const f=frameAt(t);const g=new THREE.Group();g.position.set(f.position.x+f.normal.x*8,0,f.position.z+f.normal.z*8);g.rotation.y=f.heading+Math.PI/2;p.add(g);for(const s of [-1,1])box(g,C.ink,s*1.2,1.1,0,.1,2.2,.1);sign(g,'› › ›',0,2.5,0,4,'#fff4d8');}
  for(let i=0;i<6;i++){const g=new THREE.Group();p.add(g);g.position.set((rand()-.5)*140,20+rand()*10,(rand()-.5)*110);for(let j=0;j<3;j++)sphere(g,C.ivory,(j-1)*2,Math.sin(j)*.7,0,2.7,1.1,1.7).castShadow=false;this.clouds.push(g);}
  // Tiny flowers, tufts and mushrooms add scale without heavy textures.
  for(let i=0;i<95;i++){
   const x=(rand()-.5)*116,z=(rand()-.5)*85;if((x/59)**2+(z/44)**2>.9||nearestTrack(x,z).distance<7||Math.abs(x)<21&&Math.abs(z)<18)continue;
   sphere(p,i%3?0xe9e9bd:C.coral,x,.16,z,.18,.22,.18).castShadow=false;
  }
  this.mergeStatic();
 }
 mergeStatic(){
  this.group.updateMatrixWorld(true);
  const moving=new Set<THREE.Object3D>([this.gantry,...this.mascots,...this.coins.map(c=>c.object),...this.obstacles.filter(o=>o.movable).map(o=>o.object)]);
  const batches=new Map<string,{material:THREE.Material;shadow:boolean;receive:boolean;meshes:THREE.Mesh[]}>();
  this.group.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material)||o.name==='Ocean')return;let ancestor:THREE.Object3D|null=o;while(ancestor){if(moving.has(ancestor))return;ancestor=ancestor.parent;}const key=o.material.uuid+o.castShadow+o.receiveShadow;let batch=batches.get(key);if(!batch){batch={material:o.material,shadow:o.castShadow,receive:o.receiveShadow,meshes:[]};batches.set(key,batch);}batch.meshes.push(o);});
  for(const b of batches.values()){if(b.meshes.length<2)continue;const geometries=b.meshes.map(m=>{let g=m.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(m.matrixWorld);if(!g.getAttribute("uv"))g.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count*2),2));return g;});const merged=mergeGeometries(geometries,false);if(!merged)continue;const m=new THREE.Mesh(merged,b.material);m.castShadow=b.shadow;m.receiveShadow=b.receive;m.name="Static scenery batch";this.group.add(m);for(const old of b.meshes)old.removeFromParent();for(const g of geometries)g.dispose();}
 }
 tree(x:number,z:number,s:number){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);this.group.add(g);cylinder(g,0x998963,0,1.1,0,.24,2.2);sphere(g,C.leaf,0,3.2,0,1.6,2.1,1.4);sphere(g,0xa9bf88,.8,2.8,.2,1.0,1.5,1.1);this.obstacles.push({x,z,radius:.65*s,object:g});}
 cone(x:number,z:number){const g=new THREE.Group();g.position.set(x,0,z);this.group.add(g);box(g,C.ink,0,.1,0,.85,.18,.85);cylinder(g,C.coral,0,.62,0,.33,1.05,.045);cylinder(g,C.ivory,0,.65,0,.22,.18,.17);this.obstacles.push({x,z,radius:.4,object:g,movable:true,vx:0,vz:0});}
 potato(x:number,z:number,s:number,rotation:number){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);g.rotation.y=rotation;this.group.add(g);this.mascots.push(g);
  const body=sphere(g,0xd1a169,0,3.6,0,2.6,3.2,2.0);body.rotation.z=-.12;
  for(const side of [-1,1]){const eye=sphere(g,C.ivory,side*.83,4.6,1.86,.72,.87,.34);eye.rotation.z=side*.14;sphere(g,C.ink,side*.83+.12,4.51,2.18,.23,.31,.13);sphere(g,C.coral,side*1.5,3.7,1.7,.35,.17,.10);const foot=box(g,C.teal,side*1.1,.43,.5,1.5,.72,1.9,.34);foot.rotation.y=side*.25;const arm=box(g,0xbc925f,side*2.8,3,0,.7,2.6,.7,.28);arm.rotation.z=side*.6;}
  box(g,C.ink,.15,3.3,1.95,1.0,.24,.2,.09);box(g,C.ivory,.25,3.24,2.08,.27,.35,.13,.025);
  for(let i=0;i<9;i++){const a=rand()*Math.PI*2;sphere(g,0xbf905d,Math.sin(a)*2.36,1.8+rand()*3,Math.cos(a)*1.87,.13,.17,.08);}
  const leaf=box(g,C.leaf,.4,6.85,0,.55,1.3,.3,.15);leaf.rotation.z=-.5;
  if(s>.8){const cap=cylinder(g,C.coral,0,6.6,0,1.2,.5,1.0);cap.rotation.z=-.12;sign(g,'NO. 1',0,6.65,1.06,1.5,'#f48368');}
  this.obstacles.push({x,z,radius:2.7*s,object:g});
 }
 building(x:number,z:number,rot:number){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;this.group.add(g);box(g,C.ivory,0,1.8,0,7,3.6,4.6,.25);box(g,C.teal,0,3.75,0,7.8,.5,5.3,.18);box(g,C.ink,-1.6,1.6,2.34,2,1.6,.05,.1);box(g,C.coral,1.6,1.6,2.34,1.5,2.7,.08,.1);for(let i=0;i<7;i++)box(g,i%2?C.ivory:C.coral,i-3,2.9,3.1,1,.17,1.8,.025);sign(g,'PIT STOP',0,4.55,0,5,'#f7cf79','SNACKS BEFORE SPEED');this.obstacles.push({x,z,radius:4,object:g});}
 update(dt:number,time:number){
  for(const c of this.coins){c.object.rotation.y=time*1.6;c.object.position.y=.95+Math.sin(time*3+c.x)*.16;}
  for(let i=0;i<this.mascots.length;i++)this.mascots[i].rotation.z=Math.sin(time*1.8+i)*.028;
  for(const o of this.obstacles){if(!o.movable)continue;o.x+=(o.vx||0)*dt;o.z+=(o.vz||0)*dt;o.vx=(o.vx||0)*Math.exp(-3*dt);o.vz=(o.vz||0)*Math.exp(-3*dt);o.object.position.set(o.x,0,o.z);o.object.rotation.z=THREE.MathUtils.damp(o.object.rotation.z,THREE.MathUtils.clamp((o.vx||0)*.06,-1,1),5,dt);}
 }
 updateGantryVisibility(camera:THREE.Camera,target:THREE.Vector3,following:boolean){
  const direction=target.clone().sub(camera.position);this.gantryRay.set(camera.position,direction.clone().normalize());this.gantryRay.far=direction.length();
  const occluded=following&&this.gantryRay.intersectObject(this.gantry,true).length>0;
  this.gantry.traverse(o=>{if(o instanceof THREE.Mesh){o.material.opacity=occluded?.12:1;o.material.depthWrite=!occluded;}});
 }
 resetCoins(){for(const c of this.coins){c.collected=false;c.object.visible=true;}}
}
