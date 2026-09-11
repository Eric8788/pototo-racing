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
const matCache=new Map<number,THREE.MeshStandardMaterial>();
function mat(color:number,metalness=0,roughness=.65){const key=color+metalness*0x1000000;if(!matCache.has(key))matCache.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness}));return matCache.get(key)!;}
function add(g:THREE.Object3D,geo:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;g.add(o);return o;}
function ball(g:THREE.Object3D,color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const o=add(g,new THREE.SphereGeometry(1,16,12),mat(color),x,y,z);o.scale.set(sx,sy,sz);return o;}
function box(g:THREE.Object3D,color:number,x:number,y:number,z:number,w:number,h:number,d:number,r=.05){return add(g,new RoundedBoxGeometry(w,h,d,2,r),mat(color),x,y,z);}
function tube(g:THREE.Object3D,color:number,a:THREE.Vector3,b:THREE.Vector3,r:number){const o=add(g,new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),mat(color));o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
function eye(g:THREE.Object3D,x:number,y:number,z:number,s=.3,squint=false){
 ball(g,0xfff8df,x,y,z,s,s*(squint?.66:1.15),s*.55);
 ball(g,0x263c36,x+.045,y-.02,z+s*.48,s*.36,s*.44,s*.15);
 ball(g,0xffffff,x+.065,y+s*.16,z+s*.58,s*.10);
 if(squint){const brow=box(g,0x17473e,x,y+s*.53,z+.07,s*2.06,.15,.22);brow.rotation.z=x>0?-.18:.08;}
}
function label(g:THREE.Object3D,text:string,color:string,bg:string,x:number,y:number,z:number,width:number,rotation=0){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='900 76px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=add(g,new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:t,roughness:.8}),x,y,z);o.rotation.y=rotation;return o;
}
export interface KartModel { id:KartId; root:THREE.Group; wheels:THREE.Object3D[]; steers:THREE.Object3D[]; hover?:THREE.Group; ring?:THREE.Group; phase:number; }
function wheelSet(model:KartModel,base:THREE.Group,r=.44,front=1.15,rear=-1.12,axle=.84,rim=0xf6ce75){
 for(const x of [-axle,axle])for(const z of [rear,front]){
  const pivot=new THREE.Group();pivot.position.set(x,r,z);base.add(pivot);if(z===front)model.steers.push(pivot);
  const spin=new THREE.Group();pivot.add(spin);model.wheels.push(spin);
  const tire=add(spin,new THREE.CylinderGeometry(r,r,.30,14),mat(0x2d373e));tire.rotation.z=Math.PI/2;
  const hub=add(spin,new THREE.CylinderGeometry(r*.62,r*.62,.32,12),mat(rim,.45,.32));hub.rotation.z=Math.PI/2;
  for(const side of [-1,1]){const cap=add(spin,new THREE.CylinderGeometry(r*.19,r*.19,.015,8),mat(0xf6f0d9),side*.168);cap.rotation.z=Math.PI/2;}
 }
}
export function createKart(id:KartId,apex:THREE.Object3D):KartModel{
 const root=new THREE.Group();root.name='Kart_'+id;root.scale.setScalar(VEHICLE_SCALE);
 const model:KartModel={id,root,wheels:[],steers:[],phase:0};
 if(id==='apex'){
  const original=apex.clone(true);original.scale.setScalar(1);root.add(original);
  original.traverse(o=>{if(o.name.startsWith('Wheel_'))model.wheels.push(o);if(o.name.startsWith('Steer_F'))model.steers.push(o);});
  for(const x of [-.43,.43])eye(root,x,1.04,1.90,.25,true);
  const grin=box(root,0x162e2a,.06,.61,2.0,.65,.11,.09);grin.rotation.z=-.16;
  box(root,0xfff1ce,.22,.59,2.054,.14,.15,.06,.01);
  const wing=original.getObjectByName('Rear_Wing');if(wing)wing.rotation.z=.07;
 }else if(id==='potato'){
  box(root,0x52766c,0,.45,0,1.65,.24,2.55,.1);wheelSet(model,root,.43,1.03,-1.05,.84,0xd87057);
  const body=ball(root,0xd4a46c,0,1.01,-.06,.90,.83,1.51);body.rotation.z=-.06;
  // Deterministic raised potato dimples, placed on the visible skin surface.
  for(let i=0;i<22;i++){const a=i*2.399963,b=.22+(i%5)*.24;const x=Math.cos(a)*.89*Math.sin(b),y=1.01+Math.cos(b)*.80,z=-.06+Math.sin(a)*1.5*Math.sin(b);const dot=ball(root,i%3?0xbb8c58:0xe0b783,x,y,z,.055,.034,.07);dot.rotation.y=a;}
  eye(root,-.33,1.44,1.19,.27);eye(root,.32,1.50,1.16,.30);
  ball(root,0xe29076,-.65,1.10,1.13,.18,.08,.05);ball(root,0xe29076,.65,1.1,1.13,.18,.08,.05);
  const mouth=box(root,0x694c35,.02,.93,1.42,.49,.20,.07,.08);mouth.rotation.z=.08;box(root,0xfff4d6,.1,.90,1.475,.14,.21,.06,.015);
  tube(root,0x62865a,new THREE.Vector3(.02,1.77,-.35),new THREE.Vector3(.10,2.2,-.42),.065);
  const leaf=ball(root,0x8cad69,.31,2.19,-.46,.35,.11,.18);leaf.rotation.z=.4;
  const leaf2=ball(root,0xabc881,-.12,2.17,-.32,.26,.10,.14);leaf2.rotation.z=-.6;
  for(const side of [-1,1]){const mitten=ball(root,0xd4a46c,side*.97,1.0,.1,.16,.23,.19);mitten.rotation.z=side*.4;}
  const exhaust=add(root,new THREE.CylinderGeometry(.12,.12,.45,10),mat(0x56625c,.5),.51,.65,-1.35);exhaust.rotation.x=-.7;
 }else if(id==='pencil'){
  wheelSet(model,root,.37,.90,-1.06,.69,0xd58c83);
  box(root,0x42545a,0,.39,-.02,1.35,.15,2.5);
  const barrel=add(root,new THREE.CylinderGeometry(.56,.56,2.52,6),mat(0xedb72c),0,.89,-.15);barrel.rotation.x=Math.PI/2;barrel.geometry.rotateY(Math.PI/6);
  const wood=add(root,new THREE.ConeGeometry(.56,.76,6),mat(0xe8c893),0,.89,1.49);wood.rotation.x=Math.PI/2;wood.rotation.y=Math.PI/6;
  const lead=add(root,new THREE.ConeGeometry(.14,.33,6),mat(0x34424b),0,.89,1.96);lead.rotation.x=Math.PI/2;
  const band=add(root,new THREE.CylinderGeometry(.58,.58,.32,12),mat(0xadc5bc,.7,.24),0,.89,-1.40);band.rotation.x=Math.PI/2;
  for(const z of [-1.5,-1.39,-1.28]){const ring=add(root,new THREE.TorusGeometry(.579,.018,4,16),mat(0x718a83,.5),0,.89,z);ring.rotation.z=.1;}
  const rubber=box(root,0xeb919a,0,.90,-1.70,.94,.89,.4,.2);rubber.rotation.z=-.05;
  for(const x of [-.34,.34])eye(root,x,1.44,.35,.24,x<0);
  box(root,0x543d2a,0,1.19,.72,.30,.055,.075);
  label(root,'NO.2  FAST','#775c1f','#edb72c',.499,.90,-.14,1.74,Math.PI/2);
  label(root,'NO.2  FAST','#775c1f','#edb72c',-.499,.90,-.14,1.74,-Math.PI/2);
  const wing=box(root,0xeb919a,0,1.26,-1.58,1.48,.13,.38,.06);wing.rotation.z=-.06;
 }else{
  // A complete hovercraft: no car hidden under the saucer.
  const hover=new THREE.Group();root.add(hover);model.hover=hover;
  const hull=ball(hover,0xa99bce,0,.77,0,1.03,.32,1.55);hull.material=mat(0xa99bce,.45,.3);
  const lower=ball(hover,0x566271,0,.60,0,.80,.28,1.26);lower.material=mat(0x566271,.55,.38);
  const rim=add(hover,new THREE.TorusGeometry(1,.065,8,40),mat(0xe3d8ee,.6,.26),0,.78,0);rim.rotation.x=Math.PI/2;rim.scale.set(1.04,1.56,1);
  const ring=new THREE.Group();ring.position.y=.80;hover.add(ring);model.ring=ring;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const lamp=ball(ring,i%2?0xa8f3d3:0xfbd078,Math.sin(a)*.99,0,Math.cos(a)*1.48,.082,.042,.082);lamp.material=new THREE.MeshStandardMaterial({color:i%2?0xa8f3d3:0xfbd078,emissive:i%2?0x65d4ae:0xeeb347,emissiveIntensity:.35,roughness:.3});}
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
 for(const s of model.steers){if(model.id==='apex')s.rotation.z=-v.steering*.38;else s.rotation.y=-v.steering*.38;}
 if(model.hover){model.hover.position.y=.04+Math.sin(model.phase*3.5)*.06;model.hover.rotation.z=Math.sin(model.phase*2.1)*.022;}
}

// Single reusable offscreen renderer; previews are actual model renders, cached once.
export function kartThumbnails(models:KartModel[]):Map<KartId,string>{
 const r=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(560,360);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.35;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff4df,0x92ada1,2.5));const light=new THREE.DirectionalLight(0xffffff,3.2);light.position.set(-4,8,5);scene.add(light);
 const camera=new THREE.PerspectiveCamera(34,560/360,.1,30);camera.position.set(3.5,2.8,4.7);camera.lookAt(0,.75,0);
 const thumbnails=new Map<KartId,string>();
 for(const m of models){const copy=m.root.clone(true);copy.visible=true;scene.add(copy);r.render(scene,camera);thumbnails.set(m.id,r.domElement.toDataURL('image/png'));scene.remove(copy);}
 r.dispose();r.forceContextLoss();return thumbnails;
}
