import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {KARTS,type KartId,type KartModel} from './kart-models';
import {TRACKS,trackSpec,type TrackId} from './tracks';
import {trackLength} from './track';
export type EntryMode='single'|'online';
interface Options {
 renderer:THREE.WebGLRenderer;scene:THREE.Scene;
 models:()=>Map<KartId,KartModel>;thumbnails:()=>Map<KartId,string>;
 selected:()=>KartId;select:(id:KartId)=>void;
 track:()=>TrackId;selectTrack:(id:TrackId)=>void;
 previewWorld:(id:TrackId)=>THREE.Group;
 start:(mode:EntryMode,practice:boolean)=>void;reset:()=>void;
}
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export class LaunchFlow {
 stage:'home'|'garage'|'map'|'hidden'='home';entry:EntryMode='single';practice=false;
 private ui=document.createElement('section');
 private garage=new THREE.Scene();private garageCamera=new THREE.PerspectiveCamera(38,1,.1,60);
 private mapCamera=new THREE.PerspectiveCamera(42,1,1,600);
 private holder=new THREE.Group();private controls?:OrbitControls;private previews=new Map<KartId,THREE.Object3D>();
 private moving=0;private pending:TrackId='potato';private swapped=false;
 private orbitScene=new THREE.Scene();private orbit=new THREE.Group();private planets:THREE.Group[]=[];
 private orbitAngle=0;private fromAngle=0;private targetAngle=0;private viewAngle=.65;private spin=0;private rotateResume=0;
 constructor(private o:Options){
  this.ui.id='setup-ui';this.ui.hidden=true;document.body.append(this.ui);
  this.garage.background=new THREE.Color(0xe1e6d9);this.garage.fog=new THREE.Fog(0xe1e6d9,18,42);
  this.garage.add(new THREE.HemisphereLight(0xfff9e5,0x668c83,3));
  const light=new THREE.DirectionalLight(0xffe8c9,3.2);light.position.set(-4,9,6);this.garage.add(light);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xe1e6d9,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.21;this.garage.add(ground);
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(3,3.15,.26,72),new THREE.MeshStandardMaterial({color:0xf6f2df,roughness:.8}));stand.position.y=-.08;this.garage.add(stand);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.03,.035,8,72),new THREE.MeshBasicMaterial({color:0xe4a963}));ring.rotation.x=Math.PI/2;ring.position.y=.065;this.garage.add(ring);
  const grid=new THREE.GridHelper(60,30,0xbdcabc,0xd0dacd);grid.position.y=-.195;this.garage.add(grid);this.garage.add(this.holder);
  this.orbitScene.background=new THREE.Color(0xbcdad3);this.orbit.position.z=-190;this.orbitScene.add(this.orbit);
  this.orbitScene.add(new THREE.HemisphereLight(0xfff4d9,0x719995,2.6));const orbitSun=new THREE.DirectionalLight(0xffe5c2,3.1);orbitSun.position.set(-60,100,70);this.orbitScene.add(orbitSun);
  const orbitRing=new THREE.Mesh(new THREE.TorusGeometry(190,.32,6,180),new THREE.MeshBasicMaterial({color:0xa2c5bf,transparent:true,opacity:.6}));orbitRing.rotation.x=Math.PI/2;orbitRing.position.set(0,-9,-190);this.orbitScene.add(orbitRing);
 
  window.addEventListener('keydown',e=>{
   if(el('modal-backdrop')?.classList.contains('visible'))return;
   if(e.key==='Escape'&&(this.stage==='garage'||this.stage==='map')){e.preventDefault();this.back();}
   if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&this.stage==='map'){e.preventDefault();this.slide(e.key==='ArrowLeft'?-1:1);}
  });
 }
 home(){this.controls?.dispose();this.controls=undefined;this.stage='home';this.ui.hidden=true;this.o.reset();el('landing').hidden=false;document.body.dataset.screen='home';el('entry-single').focus();}
 hide(screen='race'){this.controls?.dispose();this.controls=undefined;this.stage='hidden';this.ui.hidden=true;el('landing').hidden=true;document.body.dataset.screen=screen;}
 begin(mode:EntryMode){this.entry=mode;this.o.reset();this.showGarage();}
 private header(step:number){return `<header class="setup-header"><button id="setup-back" class="setup-back" aria-label="返回上一步">← <span>返回</span></button><nav aria-label="开局步骤"><span>01 模式</span><b class="${step===2?'current':''}">02 选车</b><b class="${step===3?'current':''}">03 地图</b></nav><span class="setup-mode">${this.entry==='single'?'单人游戏':'多人联机'}</span></header>`;}
 showGarage(){
  this.controls?.dispose();this.controls=undefined;this.stage='garage';this.moving=0;el('landing').hidden=true;this.ui.hidden=false;document.body.dataset.screen='garage';
  this.ui.innerHTML=`${this.header(2)}<div class="setup-copy"><small>THE ODD GARAGE</small><h1>你的怪车库。</h1><div class="kart-details"><span id="garage-number"></span><h2 id="garage-name"></h2><p id="garage-tagline"></p><small>四款怪车 · 一样认真地跑</small></div></div><div id="model-drag" tabindex="0" role="img" aria-label="三维车辆预览，拖动旋转，双指缩放"><span class="rotate-hint">↔ 拨动小车 · 松手后自动环绕</span></div><div class="orbit-buttons"><button id="orbit-left" aria-label="向左旋转模型">↶</button><button id="orbit-right" aria-label="向右旋转模型">↷</button><button id="orbit-reset">重置视角</button></div><footer class="setup-footer"><div class="kart-tabs" role="group" aria-label="选择车辆">${KARTS.map((k,i)=>`<button data-choice="${k.id}" aria-pressed="false"><span>0${i+1}</span><img alt="" src="${this.o.thumbnails().get(k.id)||''}"><b>${k.name}</b></button>`).join('')}</div><button id="garage-next" class="setup-primary">就开这辆，选地图 <b>→</b></button></footer>`;
  this.garageCamera.aspect=innerWidth/innerHeight;this.garageCamera.fov=this.garageCamera.aspect<1?58:38;this.garageCamera.updateProjectionMatrix();this.garageCamera.position.set(6,3.5,7);
  this.controls=new OrbitControls(this.garageCamera,el('model-drag'));this.controls.target.set(0,.8,0);this.controls.enablePan=false;this.controls.enableDamping=true;this.controls.minDistance=5;this.controls.maxDistance=11;this.controls.minPolarAngle=.3;this.controls.maxPolarAngle=Math.PI/2-.08;this.controls.update();this.controls.autoRotate=true;this.controls.autoRotateSpeed=.5;this.controls.addEventListener('start',()=>{this.rotateResume=Infinity;});this.controls.addEventListener('end',()=>{this.rotateResume=performance.now()+3500;});
  el('setup-back').onclick=()=>this.back();el('garage-next').onclick=()=>this.showMap();
  this.ui.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.onclick=()=>this.choose(b.dataset.choice as KartId));
  const rotate=(a:number)=>{const offset=this.garageCamera.position.clone().sub(this.controls!.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),a);this.garageCamera.position.copy(this.controls!.target).add(offset);this.controls!.update();this.rotateResume=performance.now()+3500;};
  el('orbit-left').onclick=()=>rotate(-Math.PI/4);el('orbit-right').onclick=()=>rotate(Math.PI/4);el('orbit-reset').onclick=()=>{this.garageCamera.position.set(6,3.5,7);this.controls!.update();this.rotateResume=performance.now()+3500;};
  el('model-drag').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?-.2:.2);}};
  this.choose(this.o.selected());el('garage-next').focus();
 }
 private choose(id:KartId){
  this.o.select(id);this.holder.clear();
  if(!this.previews.has(id)){const clone=this.o.models().get(id)!.root.clone(true);clone.visible=true;this.previews.set(id,clone);}
  this.holder.add(this.previews.get(id)!);this.holder.position.x=2.5;
  const k=KARTS.find(k=>k.id===id)!;el('garage-name').textContent=k.name;el('garage-tagline').textContent=k.tagline;el('garage-number').textContent=`0${KARTS.indexOf(k)+1} / ${k.english}`;
  this.ui.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===id)));
 }
 showMap(){
  this.controls?.dispose();this.controls=undefined;this.stage='map';document.body.dataset.screen='map';this.ui.hidden=false;this.moving=0;
  if(!this.planets.length)for(const [i,t] of TRACKS.entries()){const slot=new THREE.Group();const angle=i*Math.PI*2/TRACKS.length;slot.position.set(Math.sin(angle)*190,0,Math.cos(angle)*190);const preview=this.o.previewWorld(t.id);slot.add(preview);this.orbit.add(slot);this.planets.push(slot);}
  this.orbitAngle=-TRACKS.findIndex(t=>t.id===this.o.track())*Math.PI*2/TRACKS.length;this.orbit.rotation.y=this.orbitAngle;
  this.ui.innerHTML=`${this.header(3)}<div class="setup-copy map-copy"><small>CHOOSE YOUR LITTLE WORLD</small><h1>今天，去哪儿歪？</h1></div><div id="map-swipe" role="img" aria-label="斜角环绕赛道预览，可沿轨道左右切换"></div><button id="map-prev" class="map-nav prev" aria-label="上一张地图">‹</button><button id="map-next" class="map-nav next" aria-label="下一张地图">›</button><footer class="setup-footer map-footer"><div class="map-details"><small id="course-tag"></small><h2 id="course-title"></h2><p id="course-description"></p><span id="course-length"></span></div><div class="map-options"><div class="course-dots">${TRACKS.map(t=>`<button data-course="${t.id}" aria-label="选择${t.name}" aria-pressed="false"></button>`).join('')}</div>${this.entry==='single'?`<label class="practice-option"><input id="solo-practice" type="checkbox" ${this.practice?'checked':''}>单车练习 <span>默认和 3 辆 AI 比赛</span></label>`:'<p class="room-map-hint">创建房间时使用此地图；加入时跟随房主。</p>'}<button id="map-go" class="setup-primary">${this.entry==='single'?'出发，歪一下':'进入联机房间'} <b>↗</b></button></div></footer>`;
  el('setup-back').onclick=()=>this.back();el('map-prev').onclick=()=>this.slide(-1);el('map-next').onclick=()=>this.slide(1);
  this.ui.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(b=>b.onclick=()=>{const target=b.dataset.course as TrackId;if(target!==this.o.track())this.transition(target,TRACKS.findIndex(t=>t.id===target)>TRACKS.findIndex(t=>t.id===this.o.track())?1:-1);});
  el('map-go').onclick=()=>{if(this.moving)return;this.practice=el<HTMLInputElement>('solo-practice')?.checked??false;this.o.start(this.entry,this.practice);};
  let startX=0;el('map-swipe').onpointerdown=e=>{startX=e.clientX;el('map-swipe').setPointerCapture(e.pointerId);};el('map-swipe').onpointerup=e=>{if(Math.abs(e.clientX-startX)>40)this.slide(e.clientX<startX?1:-1);};
  this.mapInfo();el('map-go').focus();
 }
 private mapInfo(){const spec=trackSpec(this.o.track());el('course-tag').textContent=spec.english;el('course-title').textContent=spec.name;el('course-description').textContent=spec.description;el('course-length').textContent=`${spec.tag} · ${Math.round(trackLength)} m · 3 圈`;this.ui.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.course===spec.id)));}
 private slide(dir:number){const i=TRACKS.findIndex(t=>t.id===this.o.track());this.transition(TRACKS[(i+dir+TRACKS.length)%TRACKS.length].id,dir);}
 private transition(id:TrackId,_dir:number){if(this.moving)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.o.selectTrack(id);this.orbitAngle=-TRACKS.findIndex(t=>t.id===id)*Math.PI*2/TRACKS.length;this.mapInfo();return;}this.pending=id;this.fromAngle=this.orbitAngle;const distance=(TRACKS.findIndex(t=>t.id===id)-TRACKS.findIndex(t=>t.id===this.o.track())+TRACKS.length)%TRACKS.length;const step=distance>TRACKS.length/2?distance-TRACKS.length:distance;this.targetAngle=this.orbitAngle-step*Math.PI*2/TRACKS.length;this.moving=.001;this.swapped=false;el<HTMLButtonElement>('map-go').disabled=true;}
 back(){if(this.stage==='map'){if(this.moving&&!this.swapped)this.o.selectTrack(this.pending);this.showGarage();}else this.home();}
 frame(dt:number){
  if(this.stage==='home')return true;
  if(this.stage==='hidden')return false;
  if(this.stage==='garage'){
   this.garageCamera.aspect=innerWidth/innerHeight;this.garageCamera.fov=this.garageCamera.aspect<1?58:38;this.garageCamera.updateProjectionMatrix();this.holder.position.x=THREE.MathUtils.damp(this.holder.position.x,0,11,dt);this.controls!.autoRotate=performance.now()>this.rotateResume&&!matchMedia('(prefers-reduced-motion: reduce)').matches;this.controls!.update(dt);this.o.renderer.render(this.garage,this.garageCamera);return true;
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced){this.viewAngle+=dt*.028;this.spin+=dt*.018;}
  if(this.moving){
   this.moving+=dt;const t=Math.min(1,this.moving/.95),ease=t*t*(3-2*t);
   this.orbitAngle=THREE.MathUtils.lerp(this.fromAngle,this.targetAngle,ease);
   if(t>=.5&&!this.swapped){this.o.selectTrack(this.pending);this.swapped=true;this.mapInfo();}
   if(t===1){this.moving=0;el<HTMLButtonElement>('map-go').disabled=false;}
  }
  this.orbit.rotation.y=this.orbitAngle;
  this.planets.forEach((slot,i)=>{const a=i*Math.PI*2/TRACKS.length+this.orbitAngle;slot.visible=Math.cos(a)>-.1;slot.children[0].rotation.y=this.spin-this.orbitAngle;});
  const aspect=innerWidth/innerHeight,zoom=aspect<1?1.95:1;
  this.mapCamera.aspect=aspect;this.mapCamera.far=900;this.mapCamera.updateProjectionMatrix();
  // Orbit near the original three-quarter view, keeping the island and its depth in view.
  const angle=.65+Math.sin(this.viewAngle-.65)*.18;
  this.mapCamera.position.set(Math.sin(angle)*165*zoom,94*zoom,Math.cos(angle)*165*zoom);this.mapCamera.lookAt(0,0,0);
  this.o.renderer.render(this.orbitScene,this.mapCamera);return true;
 }
}
