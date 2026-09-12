import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vehicle } from './vehicle';
import { VEHICLE_SCALE } from './vehicle-dimensions';

export type KartId = 'apex' | 'potato' | 'pencil' | 'ufo';
export const KARTS: { id: KartId; name: string; english: string; color: string; tagline: string; description: string }[] = [
 { id:'apex',name:'歪嘴小钢炮',english:'SIDE-EYE GT',color:'#3f9b87',tagline:'嘴上不服，油门没松。',description:'经典赛车 × 眯眼坏笑。歪着尾翼，也要认真超车。' },
 { id:'potato',name:'暴走小土豆',english:'SPUD ROCKET',color:'#c88b4e',tagline:'外焦里嫩，内心狂野。',description:'整颗土豆装上四个小轮子。顶着一撮芽，露着一颗牙。' },
 { id:'pencil',name:'卷王铅笔',english:'NO.2 FAST',color:'#e8b434',tagline:'弯道不会，先画条直线。',description:'六角笔杆、石墨鼻尖、粉红橡皮尾翼。写不完的作业，跑得完的三圈。' },
 { id:'ufo',name:'迷路飞碟',english:'U.F.OOPS!',color:'#9984ca',tagline:'来自外星，导航欠费。',description:'椭圆小飞碟，环灯和悬浮引擎。里面的独眼乘客看起来不太聪明。' },
];
const matCache=new Map<string,THREE.MeshStandardMaterial>();
function mat(color:number,metalness=0,roughness=.65){const key=`${color}:${metalness}:${roughness}`;if(!matCache.has(key))matCache.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness}));return matCache.get(key)!;}
function add(g:THREE.Object3D,geo:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;g.add(o);return o;}
function ball(g:THREE.Object3D,color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const o=add(g,new THREE.SphereGeometry(1,28,20),mat(color),x,y,z);o.scale.set(sx,sy,sz);return o;}
function box(g:THREE.Object3D,color:number,x:number,y:number,z:number,w:number,h:number,d:number,r=.05){return add(g,new RoundedBoxGeometry(w,h,d,3,r),mat(color),x,y,z);}
function tube(g:THREE.Object3D,color:number,a:THREE.Vector3,b:THREE.Vector3,r:number){const o=add(g,new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),mat(color));o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
function eye(g:THREE.Object3D,x:number,y:number,z:number,s=.3,squint=false){
 const socket=new THREE.Group();socket.position.set(x,y,z);socket.name='Expression_Eye';g.add(socket);
 const white=ball(socket,0xfff8df,0,0,0,s,s*(squint?.75:1.08),s*.49);white.material=mat(0xfff8df,0,.36);
 const pupil=new THREE.Group();pupil.name='Expression_Pupil';socket.add(pupil);
 ball(pupil,0x3d5140,.025,-.015,s*.42,s*.42,s*.47,s*.17).material=mat(0x3d5140,0,.3);
 ball(pupil,0x152c26,.025,-.015,s*.52,s*.23,s*.29,s*.07);
 ball(pupil,0xffffff,.07,s*.18,s*.60,s*.11);ball(pupil,0xffffff,-.01,-s*.12,s*.57,s*.045);
 if(squint){const brow=box(g,0x17473e,x,y+s*.65,z+.025,s*1.8,.12,.17,.055);brow.rotation.z=x>0?-.14:.1;}
 return socket;
}
// Shared 256 px skin texture: freckles sit in the skin rather than on floating spheres.
let skin:THREE.MeshStandardMaterial|undefined;
function potatoSkin(){
 if(skin)return skin;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#b88236';ctx.fillRect(0,0,256,256);let n=371;const random=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 for(let i=0;i<5200;i++){const x=random()*256,y=random()*256,r=.3+random()*1.1;ctx.fillStyle=i%2?'#efb65a65':'#75431960';ctx.beginPath();ctx.ellipse(x,y,r,r*.7,0,0,Math.PI*2);ctx.fill();}
 for(let i=0;i<65;i++){ctx.fillStyle='#73451e90';ctx.beginPath();ctx.ellipse(random()*256,random()*256,1+random()*2,.65+random(),random()*3,0,Math.PI*2);ctx.fill();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 skin=new THREE.MeshStandardMaterial({map:texture,roughness:.86,bumpMap:texture,bumpScale:.045});return skin;
}
function arc(g:THREE.Object3D,color:number,r:number,tubeRadius:number,x:number,y:number,z:number,start:number,length:number){const a=add(g,new THREE.TorusGeometry(r,tubeRadius,8,36,length),mat(color,.2,.38),x,y,z);a.rotation.z=start;return a;}
function label(g:THREE.Object3D,text:string,color:string,bg:string,x:number,y:number,z:number,width:number,rotation=0){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='900 76px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=add(g,new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:t,roughness:.8}),x,y,z);o.rotation.y=rotation;return o;
}
export interface KartModel { id:KartId; root:THREE.Group; wheels:THREE.Object3D[]; steers:THREE.Object3D[]; hover?:THREE.Group; ring?:THREE.Group; phase:number; }
function wheelSet(model:KartModel,base:THREE.Group,r=.44,front=1.15,rear=-1.12,axle=.84,rim=0xf6ce75){
 for(const x of [-axle,axle])for(const z of [rear,front]){
  const pivot=new THREE.Group();pivot.position.set(x,r,z);base.add(pivot);if(z===front)model.steers.push(pivot);
  const spin=new THREE.Group();pivot.add(spin);model.wheels.push(spin);
  // A rounded tire shoulder and recessed wheel face give a continuous toy-car finish.
  const profile=[new THREE.Vector2(r*.58,-.175),new THREE.Vector2(r*.88,-.175),new THREE.Vector2(r*.98,-.13),new THREE.Vector2(r,-.07),new THREE.Vector2(r,.07),new THREE.Vector2(r*.98,.13),new THREE.Vector2(r*.88,.175),new THREE.Vector2(r*.58,.175)];
  const tire=add(spin,new THREE.LatheGeometry(profile,28),mat(0x28332f,0,.88));tire.rotation.z=Math.PI/2;
  const hub=add(spin,new THREE.CylinderGeometry(r*.67,r*.67,.31,24),mat(rim,.4,.3));hub.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
   const ring=add(spin,new THREE.TorusGeometry(r*.72,.022,8,28),mat(0xf3dfb9,.35,.4),side*.16);ring.rotation.y=Math.PI/2;
   const cap=add(spin,new THREE.CylinderGeometry(r*.21,r*.21,.028,20),mat(0xf6f0d9,.5,.25),side*.174);cap.rotation.z=Math.PI/2;
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const spoke=box(spin,0xf6e3c1,side*.164,Math.sin(a)*r*.4,Math.cos(a)*r*.4,.026,r*.16,r*.40,.022);spoke.rotation.x=-a;}
  }

 }
}
let completeFleet:THREE.Object3D|undefined;
export function setCompleteFleet(source:THREE.Object3D){
 for(const {id} of KARTS)if(!source.getObjectByName('Fleet_'+id))throw Error(`Missing complete vehicle: ${id}`);
 completeFleet=source;
}
function shell(_id:KartId,_parent:THREE.Object3D){
 // Blender shell draft remains available as a reference asset; use the tested
 // procedural assemblies until dedicated wheel and expression sockets are authored.
 return false;
}
export function createKart(id:KartId,apex:THREE.Object3D):KartModel{
 const root=new THREE.Group();root.name='Kart_'+id;root.scale.setScalar(VEHICLE_SCALE);
 const model:KartModel={id,root,wheels:[],steers:[],phase:0};
 const authored=completeFleet?.getObjectByName('Fleet_'+id);
 if(authored){
  const assembly=authored.clone(true);root.add(assembly);root.userData.modelVersion='blender-poster-v5';
  assembly.traverse(o=>{
   if(o.name.includes('__Wheel_'))model.wheels.push(o);
   if(o.name.includes('__Steer_F'))model.steers.push(o);
   if(o.name.includes('__Hover'))model.hover=o as THREE.Group;
   if(o.name.includes('__Expression_Eye_'))o.name='Expression_Eye';
   if(o.name.includes('__Expression_Pupil_'))o.name='Expression_Pupil';
   if(o.name.includes('__Inspection_Sprout'))o.name='Inspection_Sprout';
   if(o instanceof THREE.Mesh){
    o.castShadow=true;o.receiveShadow=false;
    if(o.name.startsWith('Sculpted_Potato_Skin'))o.material=potatoSkin();
    for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m.transparent){m.depthWrite=false;o.castShadow=false;}
   }
  });
  if(id==='potato'){
   assembly.traverse(o=>{if(o.name==='Expression_Eye')o.scale.multiplyScalar(.80);if(o.name==='Expression_Pupil')o.scale.multiplyScalar(.86);});
  }
  root.updateMatrixWorld(true);return model;
 }
 if(id==='apex'){
  const original=apex.clone(true);original.scale.setScalar(1);root.add(original);
  original.traverse(o=>{if(o.name.startsWith('Wheel_'))model.wheels.push(o);if(o.name.startsWith('Steer_F'))model.steers.push(o);});
  for(const x of [-.43,.43])eye(root,x,1.04,1.90,.25,true);
  box(root,0x224c43,0,.89,1.90,1.42,.52,.18,.17);
  for(const side of [-1,1]){const lamp=box(root,0xffedc1,side*.70,.67,1.98,.23,.14,.1,.06);lamp.material=mat(0xffedc1,.15,.2);box(root,0xd87860,side*.58,.71,-1.88,.31,.11,.09,.045);}
  const grille=box(root,0x172e29,0,.42,1.96,.9,.17,.11,.08);grille.material=mat(0x172e29,.25,.42);
  const grin=box(root,0x162e2a,.06,.61,2.0,.65,.11,.09);grin.rotation.z=-.16;
  box(root,0xfff1ce,.22,.59,2.054,.14,.15,.06,.01);
  const wing=original.getObjectByName('Rear_Wing');if(wing)wing.rotation.z=.07;
 }else if(id==='potato'){
  wheelSet(model,root,.43,1.03,-1.05,.84,0xd87057);
  if(!shell(id,root)){box(root,0x52766c,0,.45,0,1.65,.24,2.55,.1);
  const body=ball(root,0xd4a46c,0,1.01,-.06,.90,.83,1.51);body.rotation.z=-.06;
  body.material=potatoSkin();const positions=body.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),d=1+.035*Math.sin(y*5+z*3)*Math.cos(x*4);positions.setXYZ(i,x*d,y*(1+.025*Math.cos(z*5)),z*d);}body.geometry.computeVertexNormals();
  for(const side of [-1,1]){const fender=ball(root,0x52766c,side*.78,.62,-1.02,.29,.23,.61);fender.material=mat(0x52766c,.15,.42);}
  }
  const bumper=box(root,0x476b5b,0,.47,1.45,1.40,.20,.26,.10);bumper.material=mat(0x476b5b,.2,.4);
  for(const side of [-1,1]){ball(root,0xffe6b0,side*.54,.49,1.60,.10,.07,.035);box(root,0xd77760,side*.50,.65,-1.43,.2,.10,.10,.04);}
  eye(root,-.33,1.44,1.19,.27);eye(root,.32,1.50,1.16,.30);
  ball(root,0xe29076,-.65,1.10,1.13,.18,.08,.05);ball(root,0xe29076,.65,1.1,1.13,.18,.08,.05);
  const mouth=box(root,0x694c35,.02,.93,1.42,.49,.20,.07,.08);mouth.rotation.z=.08;box(root,0xfff4d6,.1,.90,1.475,.14,.21,.06,.015);
  tube(root,0x62865a,new THREE.Vector3(.02,1.77,-.35),new THREE.Vector3(.10,2.2,-.42),.065);
  const sprout=new THREE.Group();sprout.name='Inspection_Sprout';root.add(sprout);
  const leaf=ball(sprout,0x8cad69,.31,2.19,-.46,.35,.11,.18);leaf.rotation.z=.4;
  const leaf2=ball(sprout,0xabc881,-.12,2.17,-.32,.26,.10,.14);leaf2.rotation.z=-.6;
  for(const side of [-1,1]){const mitten=ball(root,0xd4a46c,side*.97,1.0,.1,.16,.23,.19);mitten.rotation.z=side*.4;}
  const exhaust=add(root,new THREE.CylinderGeometry(.12,.12,.45,10),mat(0x56625c,.5),.51,.65,-1.35);exhaust.rotation.x=-.7;
 }else if(id==='pencil'){
  wheelSet(model,root,.37,.90,-1.06,.69,0xd58c83);
  if(!shell(id,root)){
  box(root,0x42545a,0,.39,-.02,1.35,.15,2.5);
  const barrel=add(root,new THREE.CylinderGeometry(.56,.56,2.52,6),mat(0xedb72c),0,.89,-.15);barrel.rotation.x=Math.PI/2;barrel.geometry.rotateY(Math.PI/6);
  const wood=add(root,new THREE.ConeGeometry(.56,.76,6),mat(0xe8c893),0,.89,1.49);wood.rotation.x=Math.PI/2;wood.geometry.rotateY(Math.PI/6);
  const lead=add(root,new THREE.ConeGeometry(.14,.33,6),mat(0x34424b),0,.89,1.96);lead.rotation.x=Math.PI/2;
  const band=add(root,new THREE.CylinderGeometry(.58,.58,.32,12),mat(0xadc5bc,.7,.24),0,.89,-1.40);band.rotation.x=Math.PI/2;
  for(const z of [-1.5,-1.39,-1.28]){const ring=add(root,new THREE.TorusGeometry(.579,.018,4,16),mat(0x718a83,.5),0,.89,z);ring.rotation.z=.1;}
  const rubber=box(root,0xeb919a,0,.90,-1.70,.94,.89,.4,.2);rubber.rotation.z=-.05;
  }
  for(const x of [-.34,.34])eye(root,x,1.44,.35,.24,x<0);
  box(root,0x543d2a,0,1.19,.72,.30,.055,.075);
  label(root,'NO.2  FAST','#775c1f','#edb72c',.499,.90,-.14,1.74,Math.PI/2);
  label(root,'NO.2  FAST','#775c1f','#edb72c',-.499,.90,-.14,1.74,-Math.PI/2);
  for(const side of [-1,1]){const rail=box(root,0xf7d466,side*.40,.67,-.08,.09,.13,2.30,.04);rail.material=mat(0xf7d466,.15,.36);}
  for(const x of [-.44,.44])tube(root,0x9aada4,new THREE.Vector3(x,.89,-1.58),new THREE.Vector3(x,1.25,-1.58),.045);
  const wing=box(root,0xeb919a,0,1.26,-1.58,1.48,.13,.38,.06);wing.rotation.z=-.06;
 }else{
  // A complete hovercraft: no car hidden under the saucer.
  const hover=new THREE.Group();root.add(hover);model.hover=hover;
  if(!shell(id,hover)){
  const hull=ball(hover,0xa99bce,0,.77,0,1.03,.32,1.55);hull.material=mat(0xa99bce,.45,.3);
  const lower=ball(hover,0x566271,0,.60,0,.80,.28,1.26);lower.material=mat(0x566271,.55,.38);
  const rim=add(hover,new THREE.TorusGeometry(1,.065,8,40),mat(0xe3d8ee,.6,.26),0,.78,0);rim.rotation.x=Math.PI/2;rim.scale.set(1.04,1.56,1);
  }
  const ring=new THREE.Group();ring.position.y=.80;hover.add(ring);model.ring=ring;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const lamp=ball(ring,i%2?0xa8f3d3:0xfbd078,Math.sin(a)*.99,0,Math.cos(a)*1.48,.082,.042,.082);lamp.material=new THREE.MeshStandardMaterial({color:i%2?0xa8f3d3:0xfbd078,emissive:i%2?0x65d4ae:0xeeb347,emissiveIntensity:.35,roughness:.3});}
  const seal=arc(hover,0xdbc9e7,.66,.045,0,.97,-.09,0,Math.PI*2);seal.rotation.x=Math.PI/2;seal.scale.y=1.22;
  for(const side of [-1,1]){const pod=ball(hover,0x7f75a5,side*.69,.61,-.83,.26,.17,.43);pod.material=mat(0x7f75a5,.35,.3);}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const rivet=ball(hover,0xe5d7ec,Math.sin(a)*.83,.93,Math.cos(a)*1.27,.035);rivet.material=mat(0xe5d7ec,.6,.25);}
  // Open-front tinted canopy keeps the alien readable at game scale.
  const domeMat=new THREE.MeshStandardMaterial({color:0x9edac9,transparent:true,opacity:.25,roughness:.2,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
  const dome=add(hover,new THREE.SphereGeometry(.65,20,12,0,Math.PI*2,0,Math.PI/2),domeMat,0,.98,-.09);dome.scale.set(1,1.25,1.22);dome.castShadow=false;
  ball(hover,0xb9cd70,0,1.28,-.03,.39,.43,.35);eye(hover,0,1.33,.29,.24);
  const lip=box(hover,0x485d42,.10,1.12,.31,.19,.045,.07);lip.rotation.z=.15;
  for(const s of [-1,1])tube(hover,0xa8bd62,new THREE.Vector3(s*.18,1.60,-.10),new THREE.Vector3(s*.27,1.91,-.13),.028);
  for(const s of [-1,1])ball(hover,0xfac278,s*.27,1.91,-.13,.075);
  for(const x of [-.5,.5]){const thruster=add(hover,new THREE.CylinderGeometry(.18,.14,.25,10),mat(0x425159,.5),x,.32,-.30);thruster.name='Hover_Thruster';const glow=add(hover,new THREE.ConeGeometry(.12,.23,8),new THREE.MeshStandardMaterial({color:0x95ecd4,emissive:0x65ccbb,emissiveIntensity:.7}),x,.16,-.30);glow.rotation.z=Math.PI;}
  label(hover,'OOPS!','#57476c','#e4d9ee',0,.77,1.557,.62);
 }
 root.updateMatrixWorld(true);return model;
}
export function animateKart(model:KartModel,v:Vehicle,dt:number){
 model.phase+=dt;
 for(const w of model.wheels)w.rotation.x+=v.speed/(.43*VEHICLE_SCALE)*dt;
 for(const s of model.steers){if(model.id==='apex'&&!model.root.userData.modelVersion)s.rotation.z=-v.steering*.38;else s.rotation.y=-v.steering*.38;}
 if(model.hover){model.hover.position.y=.04+Math.sin(model.phase*3.5)*.06;model.hover.rotation.z=Math.sin(model.phase*2.1)*.022;}
}

// Single reusable offscreen renderer; previews are actual model renders, cached once.
export function kartThumbnails(models:KartModel[]):Map<KartId,string>{
 const r=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(560,360);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.35;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff4df,0x92ada1,2.5));const light=new THREE.DirectionalLight(0xffffff,3.2);light.position.set(-4,8,5);scene.add(light);
 const camera=new THREE.PerspectiveCamera(34,560/360,.1,30);camera.position.set(3.5,2.8,4.7);camera.lookAt(0,.75,0);
 const thumbnails=new Map<KartId,string>();
 for(const m of models){const copy=m.root.clone(true);copy.visible=true;const bounds=new THREE.Box3().setFromObject(copy),center=bounds.getCenter(new THREE.Vector3());copy.position.x-=center.x;copy.position.z-=center.z;if(m.id==='potato')copy.traverse(o=>{if(o.name==='Expression_Eye')o.scale.multiplyScalar(.80);if(o.name==='Expression_Pupil')o.scale.multiplyScalar(.86);});scene.add(copy);r.render(scene,camera);thumbnails.set(m.id,r.domElement.toDataURL('image/png'));scene.remove(copy);}
 r.dispose();r.forceContextLoss();return thumbnails;
}

const inspectionParts=new WeakMap<THREE.Object3D,{eyes:THREE.Object3D[];pupils:THREE.Object3D[];sprout?:THREE.Object3D}>();
export function animateShowroom(root:THREE.Object3D,time:number){
 let parts=inspectionParts.get(root);if(!parts){parts={eyes:[],pupils:[]};root.traverse(o=>{if(o.name==='Expression_Eye')parts!.eyes.push(o);if(o.name==='Expression_Pupil')parts!.pupils.push(o);if(o.name==='Inspection_Sprout')parts!.sprout=o;});inspectionParts.set(root,parts);}
 const t=time%6.5;const blink=(center:number)=>Math.max(0,1-Math.abs(t-center)/.14);const shut=Math.max(blink(3.3),blink(3.65));
 parts.eyes.forEach((eye,i)=>eye.scale.y=1-shut*(i?.90:.96));
 parts.pupils.forEach(p=>{p.position.x=Math.sin(time*.7)*.025;p.position.y=Math.sin(time*.9)*.012;});
 if(parts.sprout)parts.sprout.rotation.z=Math.sin(time*1.8)*.035;
 root.position.y=Math.sin(time*1.6)*.025;root.rotation.z=Math.sin(time*.8)*.014;
}
