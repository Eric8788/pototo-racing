import './style.css';
import './online.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vehicle,type Control} from './vehicle';
import {World} from './world';
import {Race,formatTime} from './race';
import {samples,frameAt,nearestTrack} from './track';
import {Competition,type GameMode} from './competition';
import {RivalVisual} from './rival-visual';
import {KARTS,createKart,animateKart,kartThumbnails,type KartId,type KartModel} from './kart-models';
import {OnlineGame} from './online-game';

const icons={sound:'<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',muted:'<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/>',camera:'<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="3"/>',reset:'<path d="M5 9a8 8 0 1 1 0 8M5 3v6h6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>'};
const svg=(key:keyof typeof icons)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
document.querySelector('#app')!.innerHTML=`
<canvas id="scene" tabindex="0" aria-label="土豆环岛三维赛车场。使用方向键或 WASD 驾驶，空格漂移，Shift 加速。"></canvas>
<div class="hud" id="hud">
 <header class="topbar"><div class="brand"><div class="brand-icon">W</div><div class="brand-name">歪瓜大奖赛<small>WOBBLE GP <span class="version-badge">01</span></small></div></div>
 <div class="toolbar"><span class="tag">单人练习 · SINGLE PLAYER</span><button id="sound" class="icon-btn" aria-label="开启声音" title="声音 · M">${svg('muted')}</button><button id="camera" class="icon-btn" aria-label="切换俯瞰镜头" title="切换镜头 · C">${svg('camera')}</button><button id="reset" class="icon-btn" aria-label="返回赛道" title="返回赛道 · R">${svg('reset')}</button><button id="help" class="icon-btn help-button" aria-label="操作说明" title="操作说明">${svg('help')}</button></div></header>
 <div class="stats"><div class="stat"><label>LAP / 圈数</label><strong id="lap">01 <small>/ 03</small></strong></div><div class="stat"><label>TIME / 用时</label><strong id="time">00:00.00</strong></div><div class="stat"><label>POTATO COINS</label><strong><i class="coin-icon">◉</i><span id="coins">00</span></strong></div></div>
 <section class="intro" id="intro"><div class="eyebrow"><span></span> SMALL CAR. BIG NONSENSE.</div><h1>正经赛车，<em>不太正经地开。</em></h1><p>欢迎来到土豆环岛。<br/>踩下油门，拐个歪弯，和路边的憨瓜打个招呼。<br/>这里只有你、风，以及一颗不服输的土豆。</p><button class="primary" id="start" disabled><span>正在把小车搬上岛…</span><b>↗</b></button><div class="intro-hint">3 圈小比赛 · 随时重来 · 不用驾照</div></section>
 <aside class="track-card"><span class="card-stamp">新手<br/>友好</span><div class="card-tag">TRACK 01 / THE FIRST LAP</div><h2>土豆环岛 🥔</h2><div class="card-meta"><span>晴，宜乱开</span><span>约 260 m</span><span>3 圈</span></div></aside>
 <div class="toast" id="toast" role="status" aria-live="polite"></div><div class="countdown" id="countdown" aria-live="assertive"></div><div class="drift-feedback" id="drift">NICE & WOBBLY!</div>
 <div class="touch-pad"><div class="touch-area"><button class="touch-control" data-control="left" aria-label="左转">‹</button><button class="touch-control" data-control="right" aria-label="右转">›</button></div><div class="touch-area"><button class="touch-control brake" data-control="brake" aria-label="刹车漂移">漂移</button><button class="touch-control boost" data-control="boost" aria-label="氮气加速">BOOST</button><button class="touch-control gas" data-control="gas" aria-label="加速">↑</button><button class="touch-control" data-control="reverse" aria-label="倒车">↓</button></div><button id="gyro-toggle" class="gyro-toggle" type="button" aria-pressed="false">手机倾斜：关</button></div>
 <div class="bottom-row"><div class="minimap-wrap"><div class="map-title"><b>土豆环岛</b><span>01 / MAP</span></div><canvas id="minimap" width="300" height="228" aria-label="赛道小地图"></canvas><div class="map-caption"><span>你在这里</span><span>别迷路，瓜。</span></div></div><div class="controls"><div class="control"><kbd>WASD</kbd><span>/</span><kbd>↑↓←→</kbd><span>驾驶</span></div><div class="control"><kbd>SPACE</kbd><span>漂移</span></div><div class="control"><kbd>SHIFT</kbd><span>加速</span></div><div class="control honk-control"><kbd>H</kbd><span>叭叭</span></div><div class="control"><kbd>R</kbd><span>回正</span></div></div><div class="speedometer"><div class="speed-header"><span>APEX 07</span><i></i></div><div class="speed-main"><strong id="speed">0</strong><span>KM/H<br/>小心超萌</span></div><div class="boost-track"><i id="boost-bar"></i></div><div class="boost-label"><span>BOOST AVAILABLE</span><b id="boost-percent">100%</b></div></div></div>
 <div class="footer-note">BUILT FOR THE JOY OF DRIVING. NOT FOR YOUR DRIVING TEST.</div>
</div>
<div id="loading" class="loading">正在种土豆，铺赛道…</div>
<div id="modal-backdrop" class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" id="modal"></section></div>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('scene');
const modePicker=document.createElement('fieldset');modePicker.className='mode-picker';modePicker.innerHTML='<legend>比赛模式</legend><label><input type="radio" name="game-mode" value="race" checked><span>四车大奖赛</span></label><label><input type="radio" name="game-mode" value="practice"><span>单车练习</span></label>';
$('start').before(modePicker);
const garageButton=document.createElement('button');garageButton.id='garage-open';garageButton.className='garage-open';garageButton.disabled=true;garageButton.innerHTML='<span>准备你的怪车…</span>';modePicker.before(garageButton);
const onlineButton=document.createElement('button');onlineButton.id='online-open';onlineButton.className='online-open';onlineButton.disabled=true;onlineButton.textContent='和朋友联机 ↗ · 2–4 人';$('start').after(onlineButton);
const leaderboard=document.createElement('aside');leaderboard.className='leaderboard';leaderboard.setAttribute('aria-label','实时排名');leaderboard.innerHTML='<div class="leaderboard-title"><span>POSITION</span><strong id="position">4 <small>/ 4</small></strong></div><ol id="standings"></ol>';$('hud').append(leaderboard);
document.querySelector('.tag')!.textContent='四车大奖赛 · VS 3 AI';
document.querySelector('.intro p')!.innerHTML='土豆、铅笔、飞碟，谁说不能当赛车？<br/>选一辆不太正常的小车，出发兜个歪风。';
let renderer:THREE.WebGLRenderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('loading').textContent='你的浏览器暂时无法启动 WebGL。请开启硬件加速后刷新页面。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc1dcdb);scene.fog=new THREE.Fog(0xc1dcdb,145,370);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,1,400);camera.position.set(84,98,116);
scene.add(new THREE.HemisphereLight(0xfff7df,0x729391,2.5));const sun=new THREE.DirectionalLight(0xffedcc,3.2);sun.position.set(-35,70,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-78,right:78,top:65,bottom:-65,near:1,far:170});sun.shadow.normalBias=.12;sun.shadow.bias=-.00008;sun.shadow.radius=3;scene.add(sun);
const world=new World(scene),vehicle=new Vehicle(),race=new Race();
const competition=new Competition(vehicle,race),rivalVisuals:RivalVisual[]=[];
let selectedGameMode:GameMode='race';
competition.reset(selectedGameMode);
modePicker.addEventListener('change',()=>{
 selectedGameMode=modePicker.querySelector<HTMLInputElement>('input:checked')!.value as GameMode;
 competition.reset(selectedGameMode);
 document.querySelector('.tag')!.textContent=selectedGameMode==='race'?'四车大奖赛 · VS 3 AI':'单车练习 · SOLO';
 updateCar(0);updateHUD();
});
const car=new THREE.Group(),carBody=new THREE.Group();car.add(carBody);scene.add(car);const playerModels=new Map<KartId,KartModel>();let playerModel:KartModel|undefined;let selectedKart:KartId='potato';let thumbnails=new Map<KartId,string>();
let loaded=false,mode:'intro'|'countdown'|'race'|'finished'='intro',paused=false,countdown=3,lastCountdown=-1,coins=0,elapsedVisual=0,cameraMode:'follow'|'overview'='follow',toastTimer=0,coinSoundCooldown=0,padCooldown=0,respawnCooldown=0,accumulator=0,previousFrame=performance.now(),hudTick=0;
let debugManual=false;
const keys=new Set<string>(),touch=new Set<string>();
const emptyInput:Control={throttle:0,steer:0,brake:false,boost:false};
const mobileDevice=matchMedia('(pointer:coarse)').matches||innerWidth<760;
let gyroEnabled=mobileDevice,gyroSteer=0,gyroBaseline=0,gyroCalibrated=false,gyroPermissionAsked=false;
const gyroButton=$<HTMLButtonElement>('gyro-toggle');
function setGyroLabel(){gyroButton.textContent=gyroEnabled?'手机倾斜：开':'手机倾斜：关';gyroButton.setAttribute('aria-pressed',String(gyroEnabled));}
function onOrientation(e:DeviceOrientationEvent){const angle=screen.orientation?.angle||0;const raw=angle===90?-(e.beta||0):angle===270?(e.beta||0):(e.gamma||0);if(!gyroCalibrated){gyroBaseline=raw;gyroCalibrated=true;}if(Math.abs(raw-gyroBaseline)<45)gyroSteer=THREE.MathUtils.clamp((raw-gyroBaseline)/18,-1,1);}
async function toggleGyro(){
 if(gyroEnabled){gyroEnabled=false;window.removeEventListener('deviceorientation',onOrientation);gyroSteer=0;gyroCalibrated=false;setGyroLabel();return;}
 try{const ask=(DeviceOrientationEvent as unknown as {requestPermission?:()=>Promise<string>}).requestPermission;if(ask&&await ask()!=='granted')throw Error('permission');gyroCalibrated=false;gyroEnabled=true;window.addEventListener('deviceorientation',onOrientation);setGyroLabel();toast('保持当前姿势，倾斜手机控制左右，油门继续按 ↑');}
 catch{toast('没有获得陀螺仪权限，仍可用屏幕方向键。',2.5);}
}
async function ensureGyroPermission(){if(!mobileDevice||gyroPermissionAsked)return;gyroPermissionAsked=true;try{const ask=(DeviceOrientationEvent as unknown as {requestPermission?:()=>Promise<string>}).requestPermission;if(ask&&await ask()!=='granted'){gyroEnabled=false;setGyroLabel();return;}window.addEventListener('deviceorientation',onOrientation);setGyroLabel();}catch{gyroEnabled=false;setGyroLabel();}}
if(mobileDevice){window.addEventListener('deviceorientation',onOrientation);document.addEventListener('pointerdown',()=>void ensureGyroPermission(),{once:true});}
gyroButton.onclick=()=>void toggleGyro();setGyroLabel();
const online=new OnlineGame({
 open:html=>{openModal(html);$('modal').classList.add('net-modal');},close:closeModal,
 intro:()=>{mode='intro';$('intro').classList.remove('hidden');$('intro').inert=false;$('hud').classList.remove('finished','playing');$('countdown').textContent='';competition.reset(selectedGameMode);document.querySelector('.leaderboard-title>span')!.textContent='POSITION';},
 phase:phase=>{mode=phase;$('intro').classList.add('hidden');$('intro').inert=true;$('hud').classList.toggle('playing',phase!=='finished');$('hud').classList.toggle('finished',phase==='finished');if(phase==='countdown'){for(const s of skids)s.visible=false;for(const d of dust){d.life=0;d.mesh.visible=false;}$('toast').classList.remove('show');}},
 select:selectKart,selected:()=>selectedKart,thumbnails:()=>thumbnails,toast
},vehicle,race,world,rivalVisuals);
online.net.input=()=>paused||document.hidden?emptyInput:controls();
onlineButton.onclick=()=>online.open();
function controls():Control{const brake=keys.has('Space')||touch.has('brake'),reverse=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('reverse');const autoForward=mobileDevice&&mode==='race'&&!reverse&&!brake;return {throttle:(keys.has('KeyW')||keys.has('ArrowUp')||touch.has('gas')||autoForward?1:0)-(reverse?1:0),steer:gyroEnabled?gyroSteer:(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left')?1:0),brake,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.has('boost')};}
class Sound {
 context?:AudioContext;engine?:OscillatorNode;engineGain?:GainNode;muted=true;
 init(){if(this.context)return;this.context=new AudioContext();this.engine=this.context.createOscillator();this.engine.type='triangle';this.engineGain=this.context.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain).connect(this.context.destination);this.engine.start();}
 toggle(){this.init();this.muted=!this.muted;void this.context?.resume();$('sound').innerHTML=svg(this.muted?'muted':'sound');$('sound').setAttribute('aria-label',this.muted?'开启声音':'关闭声音');}
 tone(frequency:number,length=.12,type:OscillatorType='sine',volume=.08){if(this.muted||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,c.currentTime);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+length);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+length);o.onended=()=>{o.disconnect();g.disconnect();};}
 update(){if(!this.context||!this.engine||!this.engineGain)return;this.engine.frequency.setTargetAtTime(42+Math.abs(vehicle.speed)*6+(vehicle.boosting?25:0),this.context.currentTime,.08);this.engineGain.gain.setTargetAtTime(!this.muted&&mode==='race'&&!paused?.018+Math.min(.012,Math.abs(vehicle.speed)*.0005):0,this.context.currentTime,.12);}
}
const sound=new Sound();
function toast(text:string,duration=2.5){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=duration;}
function selectKart(id:KartId){
 const spec=KARTS.find(k=>k.id===id);if(!spec||!playerModels.has(id))return;
 if(playerModel)playerModel.root.visible=false;playerModel=playerModels.get(id)!;playerModel.root.visible=true;selectedKart=id;
 competition.player.name=`你 · ${spec.name}`;competition.player.color=spec.color;
 const others=KARTS.filter(k=>k.id!==id);rivalVisuals.forEach((v,i)=>v.select(others[i].id));
 garageButton.innerHTML=`${thumbnails.has(id)?`<img src="${thumbnails.get(id)}" alt="${spec.name}">`:''}<span><small>你的座驾</small><b>${spec.name}</b></span><strong>换辆怪车 ↗</strong>`;
 document.querySelector('.speed-header span')!.textContent=spec.english;
 try{localStorage.setItem('wobble-gp:kart',id);}catch{}
 updateCar(0);updateHUD();
}
function openGarage(){
 if(!loaded)return;
 openModal(`<small>THE ODD GARAGE / 不正经车库</small><h2 id="modal-title">车不一定正经，快乐一定超标。</h2><p class="garage-subtitle">四个怪东西，同一颗赛车的心。挑一辆，其他三辆就是你的对手。</p><div class="garage-grid">${KARTS.map(k=>`<button class="kart-card" data-kart="${k.id}" aria-pressed="${selectedKart===k.id}"><span class="kart-number">0${KARTS.indexOf(k)+1}</span>${thumbnails.has(k.id)?`<img src="${thumbnails.get(k.id)}" alt="${k.name}三维模型预览">`:'<span class="no-preview">3D 座驾</span>'}<small>${k.english}</small><b>${k.name}</b><span class="kart-tagline">${k.tagline}</span><i class="kart-selected">已选择 ✓</i></button>`).join('')}</div><p id="kart-description" class="kart-description"></p><div class="garage-footer"><span>更小的车身 · 更大的撒野空间</span><button class="primary" id="garage-done">就开这辆，出发 ↗</button></div>`);
 $('modal').classList.add('garage-modal');
 const sync=()=>{for(const b of $('modal').querySelectorAll<HTMLButtonElement>('[data-kart]'))b.setAttribute('aria-pressed',String(b.dataset.kart===selectedKart));$('kart-description').textContent=KARTS.find(k=>k.id===selectedKart)!.description;};
 for(const b of $('modal').querySelectorAll<HTMLButtonElement>('[data-kart]'))b.onclick=()=>{selectKart(b.dataset.kart as KartId);sync();};
 sync();$('garage-done').onclick=closeModal;
}
function returnToGarage(){closeModal();mode='intro';$('intro').classList.remove('hidden');$('intro').inert=false;$('hud').classList.remove('finished','playing');competition.reset(selectedGameMode);updateHUD();openGarage();}
garageButton.onclick=openGarage;
function startRace(){if(!loaded)return;closeModal();competition.reset(selectedGameMode);world.resetCoins();coins=0;mode='countdown';countdown=3;lastCountdown=-1;padCooldown=0;keys.clear();touch.clear();for(const s of skids)s.visible=false;for(const d of dust){d.life=0;d.mesh.visible=false;}$('intro').classList.add('hidden');$('intro').inert=true;$('hud').classList.remove('finished');$('hud').classList.add('playing');$('countdown').textContent='3';canvas.focus();toast(selectedGameMode==='race'?'四辆车，三圈路。土豆冠军只有一个！':'跟着箭头跑三圈。土豆评委已经就位。',3);updateHUD();}
function respawn(){if(online.active){online.net.send({type:'respawn'});keys.clear();touch.clear();return;}if(mode==='intro')return;vehicle.reset(race.respawnProgress());keys.clear();touch.clear();respawnCooldown=1;toast('稳住！把你捞回赛道了。');updateCar(0);}
function toggleCamera(){cameraMode=cameraMode==='follow'?'overview':'follow';$('camera').setAttribute('aria-label',cameraMode==='follow'?'切换俯瞰镜头':'切换跟车镜头');toast(cameraMode==='follow'?'跟车镜头 · 贴着小车跑':'俯瞰镜头 · 看得更远');}
function closeModal(){$('modal').classList.remove('garage-modal','net-modal');paused=false;$('modal-backdrop').classList.remove('visible');keys.clear();touch.clear();canvas.focus();}
function openModal(content:string){paused=true;keys.clear();touch.clear();$('modal').innerHTML=content;$('modal-backdrop').classList.add('visible');$('modal').querySelector<HTMLButtonElement>('button')?.focus();}
function help(){openModal(`<small>DRIVER'S VERY SHORT MANUAL</small><h2 id="modal-title">小车上手指南</h2><p>先跑起来。漂不漂亮，土豆说了算。</p><div class="help-row"><span>加速 / 刹车与倒车</span><span><kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd></span></div><div class="help-row"><span>方向</span><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span></div><div class="help-row"><span>刹车 / 转弯时漂移</span><kbd>SPACE</kbd></div><div class="help-row"><span>氮气 / 回到检查点</span><span><kbd>SHIFT</kbd> / <kbd>R</kbd></span></div><div class="help-row"><span>镜头 / 声音 / 喇叭</span><span><kbd>C</kbd> <kbd>M</kbd> <kbd>H</kbd></span></div><p>黄色箭头会加速，跳台可以起飞。收集薯币补充氮气；草地会减速。顺序通过检查点才算一圈。</p><button class="primary" id="resume">知道了，继续开</button><button class="secondary" id="leave-race">结束本局，返回车库</button>`);$('resume').onclick=closeModal;$('leave-race').onclick=returnToGarage;}
function finish(){mode='finished';$('hud').classList.add('finished');$('hud').classList.remove('playing');sound.tone(660,.3);setTimeout(()=>sound.tone(880,.4),130);openModal(`<small>FINISH! / 土豆认证完赛</small><h2 id="modal-title">${selectedGameMode==='race'?(competition.place===1?'冠军，薯你最歪！':`第 ${competition.place} 名，也很帅。`):'有点歪，但很帅。'}</h2><div class="results-time">${formatTime(race.elapsed)}</div>${selectedGameMode==='race'?`<ol class="results-ranking">${competition.standings().map(e=>`<li><span style="color:${e.color}">●</span> ${e.name}<strong>${e.race.finished?formatTime(e.race.elapsed):'尚未完赛'}</strong></li>`).join('')}</ol>`:''}<div class="lap-list">${race.lapTimes.map((t,i)=>`第 ${i+1} 圈 <strong style="float:right">${formatTime(t)}</strong>`).join('<br/>')}</div><p>捡到 ${coins} 枚薯币 · 最佳单圈 ${formatTime(race.best)}</p><button id="again" class="primary">再跑一次 ↗</button><button id="back-home" class="secondary">回到小岛</button>`);$('again').onclick=startRace;$('back-home').onclick=()=>{closeModal();mode='intro';$('intro').classList.remove('hidden');$('intro').inert=false;$('hud').classList.remove('finished','playing');competition.reset(selectedGameMode);updateHUD();};}
function showHelp(){
 if(online.active&&(online.net.state?.phase==='lobby'||online.me?.race.finished||online.me?.dnf||online.net.state?.phase==='results'))return;
 help();
 if(online.active){$('modal-title').textContent='联机菜单 · 比赛继续';$('modal').querySelector('p')!.textContent='已松开你的油门，其他车手仍在比赛。';$('leave-race').textContent='退出本局联机';$('leave-race').onclick=()=>online.exit();online.net.send({type:'input',input:emptyInput});}
}
$('start').onclick=startRace;$('sound').onclick=()=>sound.toggle();$('camera').onclick=toggleCamera;$('reset').onclick=respawn;$('help').onclick=showHelp;
window.addEventListener('keydown',e=>{
 if((e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)&&e.code!=='Escape')return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&!(e.target instanceof HTMLButtonElement))e.preventDefault();
 if(e.repeat){keys.add(e.code);return;}
 if(e.code==='Escape'){if(online.active&&(online.net.state?.phase==='lobby'||online.me?.race.finished||online.me?.dnf||online.net.state?.phase==='results'))return;if($('modal-backdrop').classList.contains('visible')){if(mode!=='finished')closeModal();}else if(mode==='race')showHelp();return;}
 if(paused)return;
 if(e.code==='KeyR')respawn();else if(e.code==='KeyC')toggleCamera();else if(e.code==='KeyM')sound.toggle();else if(e.code==='KeyH'){sound.init();sound.tone(220,.2,'square',.035);setTimeout(()=>sound.tone(165,.15,'square',.03),110);toast('叭叭！土豆让一让。',1.4);}else if(e.code==='Enter'&&mode==='intro')startRace();keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function releaseInput(){keys.clear();touch.clear();document.querySelectorAll('.touch-control.active').forEach(e=>e.classList.remove('active'));}
window.addEventListener('blur',()=>{releaseInput();if(mode==='race'&&!paused)showHelp();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseInput();if(mode==='race'&&!paused)showHelp();}});
$('modal-backdrop').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const list=Array.from($('modal').querySelectorAll<HTMLElement>('button:not(:disabled),input,select'));if(!list.length)return;const at=list.indexOf(document.activeElement as HTMLElement);e.preventDefault();list[(at+(e.shiftKey?-1:1)+list.length)%list.length].focus();});
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-control]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.control!);b.classList.add('active');});
 const up=()=>{touch.delete(b.dataset.control!);b.classList.remove('active');};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
}
// Pooled dust and skid marks: fixed allocations even during a long race.
const dustGeo=new THREE.SphereGeometry(.15,5,4);const dust:Array<{mesh:THREE.Mesh;life:number;vx:number;vz:number}>=[];let dustIndex=0;
for(let i=0;i<50;i++){const m=new THREE.Mesh(dustGeo,new THREE.MeshBasicMaterial({color:0xf5dfb0,transparent:true,opacity:0,depthWrite:false}));m.visible=false;scene.add(m);dust.push({mesh:m,life:0,vx:0,vz:0});}
const skidGeo=new THREE.PlaneGeometry(.28,.8);const skidMat=new THREE.MeshBasicMaterial({color:0x2b4145,transparent:true,opacity:.3,depthWrite:false});const skids:THREE.Mesh[]=[];let skidIndex=0,skidCooldown=0;
for(let i=0;i<180;i++){const m=new THREE.Mesh(skidGeo,skidMat);m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);skids.push(m);}
function emitDust(){const d=dust[dustIndex++%dust.length];d.life=.7;d.mesh.visible=true;d.mesh.position.set(vehicle.x-Math.sin(vehicle.heading)*1.5+(Math.random()-.5),vehicle.y+.2,vehicle.z-Math.cos(vehicle.heading)*1.5);d.vx=(Math.random()-.5)*2-vehicle.vx*.05;d.vz=(Math.random()-.5)*2-vehicle.vz*.05;}
function step(dt:number,override?:Control){
 if(online.active){elapsedVisual+=dt;online.frame(dt);world.update(0,elapsedVisual);return;}
 elapsedVisual+=dt;coinSoundCooldown-=dt;padCooldown-=dt;respawnCooldown-=dt;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(!paused){
  if(mode==='countdown'){countdown-=dt;const n=Math.ceil(countdown);if(n!==lastCountdown){lastCountdown=n;$('countdown').textContent=n>0?String(n):'GO!';sound.tone(n>0?440:880,.13);}if(countdown<=0){mode='race';setTimeout(()=>{$('countdown').textContent='';},650);}}
  if(mode==='race'){
   const fell=vehicle.step(dt,override||controls(),world.obstacles);if(fell&&respawnCooldown<=0)respawn();
   competition.step(dt,world.obstacles,world.boosts);
   const nearest=nearestTrack(vehicle.x,vehicle.z);
   for(const t of world.boosts)if(Math.abs(nearest.progress-t)<.011&&nearest.distance<2.6&&padCooldown<=0&&vehicle.speed>3){vehicle.padBoost=1.1;padCooldown=2;sound.tone(180,.25,'sawtooth',.025);toast('咻——！土豆涡轮启动。',1.5);}
   for(const c of world.coins)if(!c.collected&&Math.hypot(vehicle.x-c.x,vehicle.z-c.z)<1.8&&vehicle.y<2){c.collected=true;c.object.visible=false;coins++;vehicle.boost=Math.min(1,vehicle.boost+.15);if(coinSoundCooldown<=0){sound.tone(880,.1);coinSoundCooldown=.1;}}
   const event=race.step(vehicle.x,vehicle.z,dt);if(event==='lap'){world.resetCoins();toast(`第 ${race.lap} 圈！${race.lap===3?'最后一圈，土豆都站起来了。':'刚才那圈有点帅。'}`,3);sound.tone(660,.25);}if(event==='finish')finish();
   if((vehicle.drifting||vehicle.offroad||vehicle.boosting)&&Math.abs(vehicle.speed)>4&&Math.random()>.35)emitDust();
   skidCooldown-=dt;if(vehicle.drifting&&skidCooldown<=0){skidCooldown=.055;for(const s of [-1,1]){const m=skids[skidIndex++%skids.length];m.visible=true;m.position.set(vehicle.x+Math.cos(vehicle.heading)*s*.7,vehicle.y+.025,vehicle.z-Math.sin(vehicle.heading)*s*.7);m.rotation.set(-Math.PI/2,0,-vehicle.heading);}}
  }
  world.update(dt,elapsedVisual);
 }
 for(const d of dust)if(d.life>0){d.life-=dt;d.mesh.visible=d.life>0;d.mesh.position.x+=d.vx*dt;d.mesh.position.z+=d.vz*dt;d.mesh.position.y+=dt*.4;d.mesh.scale.setScalar(1+(1-d.life/.7)*2);(d.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,d.life/.7*.35);}
}
function updateCar(dt:number){
 rivalVisuals.forEach((visual,i)=>visual.update(online.active?dt:paused||mode==='intro'||mode==='countdown'?0:dt,online.active?!!online.remote[i]?.connected&&!online.remote[i]?.dnf:selectedGameMode==='race'));
 car.position.set(vehicle.x,vehicle.y,vehicle.z);car.rotation.y=vehicle.heading;
 const pitch=vehicle.airborne?-vehicle.vy*.025:0;carBody.rotation.x=THREE.MathUtils.damp(carBody.rotation.x,pitch,8,dt);carBody.rotation.z=THREE.MathUtils.damp(carBody.rotation.z,-vehicle.steering*Math.min(Math.abs(vehicle.speed)/23,1)*.10,8,dt);
 if(playerModel)animateKart(playerModel,vehicle,dt);
}
 const cameraTarget=new THREE.Vector3(),desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3();
function updateCamera(dt:number){
 if(mode==='intro'){
  const mobile=innerWidth<760;desiredTarget.set(mobile?0:-12,0,mobile?4:1);desiredPosition.set(mobile?88:83,mobile?130:104,mobile?124:116);
 }else if(cameraMode==='overview'){
  desiredTarget.set(vehicle.x,0,vehicle.z);desiredPosition.copy(desiredTarget).add(new THREE.Vector3(21,29,24));
 }else{
  const f=new THREE.Vector3(Math.sin(vehicle.heading),0,Math.cos(vehicle.heading));const side=new THREE.Vector3(f.z,0,-f.x);desiredTarget.set(vehicle.x,vehicle.y+.7,vehicle.z).addScaledVector(f,3);desiredPosition.set(vehicle.x,vehicle.y,vehicle.z).addScaledVector(f,-15.5).addScaledVector(side,6.5);desiredPosition.y+=15.0;
  if(mobileDevice){desiredTarget.set(vehicle.x,vehicle.y+1.0,vehicle.z).addScaledVector(f,3.4);desiredPosition.set(vehicle.x,vehicle.y,vehicle.z).addScaledVector(f,-13.8);desiredPosition.y+=8.5;}
 }
 const lerp=1-Math.exp(-dt*(mode==='intro'?1.5:4));camera.position.lerp(desiredPosition,lerp);cameraTarget.lerp(desiredTarget,lerp);camera.lookAt(cameraTarget);const targetFov=mode==='intro'?42:innerWidth<760?(vehicle.boosting?66:60):(vehicle.boosting?52:46);camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,4,dt);camera.updateProjectionMatrix();
}
const map=$<HTMLCanvasElement>('minimap'),ctx=map.getContext('2d')!;
function drawMap(){ctx.clearRect(0,0,300,228);const mapPoint=(x:number,z:number)=>({x:x*2.5+150,y:z*2.5+114});ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<=samples.length;i++){const p=samples[i%samples.length],m=mapPoint(p.x,p.z);if(i===0)ctx.moveTo(m.x,m.y);else ctx.lineTo(m.x,m.y);}ctx.strokeStyle='#d5dbc7';ctx.lineWidth=21;ctx.stroke();ctx.strokeStyle='#82917d';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#f5f3de';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);const start=mapPoint(samples[0].x,samples[0].z);ctx.fillStyle='#fbf8ea';ctx.fillRect(start.x-2,start.y-12,4,24);const cp=mapPoint(vehicle.x,vehicle.z);ctx.save();ctx.translate(cp.x,cp.y);ctx.rotate(-vehicle.heading);ctx.shadowColor='#5f7d6744';ctx.shadowBlur=8;ctx.fillStyle='#f28563';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(-6,-6);ctx.lineTo(0,-3);ctx.lineTo(6,-6);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff9e9';ctx.lineWidth=2;ctx.stroke();ctx.restore();const next=frameAt((race.nextGate%8)/8),np=mapPoint(next.position.x,next.position.z);if(mode==='race'){ctx.fillStyle='#f0cf73';ctx.beginPath();ctx.arc(np.x,np.y,4,0,Math.PI*2);ctx.fill();}}
function updateHUD(){
 leaderboard.classList.toggle('visible',selectedGameMode==='race'&&(mode==='race'||mode==='countdown'));
 $('position').innerHTML=`${competition.place} <small>/ 4</small>`;
 $('standings').innerHTML=competition.standings().map((e,i)=>`<li class="${e.id==='player'?'is-player':''}"><b>${i+1}</b><i style="background:${e.color}"></i><span>${e.name}</span><small>${e.race.finished?'完成':`${e.race.lap}/3`}</small></li>`).join('');
 $('speed').textContent=String(Math.round(Math.abs(vehicle.speed)*3.6));$('boost-bar').style.width=`${vehicle.boost*100}%`;$('boost-percent').textContent=`${Math.round(vehicle.boost*100)}%`;$('lap').innerHTML=`${String(race.lap).padStart(2,'0')} <small>/ 03</small>`;$('time').textContent=formatTime(race.elapsed);$('coins').textContent=String(coins).padStart(2,'0');$('drift').classList.toggle('show',mode==='race'&&!paused&&(vehicle.drifting||vehicle.airborne||vehicle.boosting));$('drift').textContent=vehicle.airborne?'POTATO AIRLINES!':vehicle.boosting?'FULL POTATO!':'NICE & WOBBLY!';drawMap();
 if(online.active)online.hud();
 if(selectedGameMode==='race'||online.active)for(const [i,rival] of competition.rivals.entries()){if(online.active&&(!online.remote[i]?.connected||online.remote[i]?.dnf))continue;ctx.fillStyle=rival.color;ctx.beginPath();ctx.arc(rival.vehicle.x*2.5+150,rival.vehicle.z*2.5+114,4.8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff9e9';ctx.lineWidth=1.5;ctx.stroke();}
}
new GLTFLoader().load(`${import.meta.env?.BASE_URL||'/'}assets/apex-07.glb`,gltf=>{
 // Apply shared depth settings before cloning materials for opponent liveries.
 gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=false;if(o.name.startsWith('Livery_')){o.renderOrder=2;for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2;}}}});
 for(const spec of KARTS){const model=createKart(spec.id,gltf.scene);model.root.visible=false;playerModels.set(spec.id,model);carBody.add(model.root);}
 for(const rival of competition.rivals)rivalVisuals.push(new RivalVisual(rival,gltf.scene,scene));
 try{thumbnails=kartThumbnails([...playerModels.values()]);}catch(error){console.warn('Garage previews unavailable',error);}
 try{const saved=localStorage.getItem('wobble-gp:kart');if(KARTS.some(k=>k.id===saved))selectedKart=saved as KartId;}catch{}
 selectKart(selectedKart);loaded=true;garageButton.disabled=false;onlineButton.disabled=false;$('start').removeAttribute('disabled');$('start').querySelector('span')!.textContent='出发，歪一下';$('loading').classList.add('hidden');updateCar(0);if(new URLSearchParams(location.search).has('room'))online.open();

},undefined,error=>{$('loading').innerHTML='小车没有加载成功。<button id="retry">重新加载</button>';$('retry').onclick=()=>location.reload();console.error('Car model loading failed',error);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('loading').classList.remove('hidden');$('loading').textContent='画面连接暂时丢失，请刷新页面重新启动。';});
// Only exposed in development: deterministic gameplay checks without a permanent autopilot.
if(import.meta.env?.DEV){(window as unknown as {__game:unknown}).__game={vehicle,race,world,get mode(){return mode;},get paused(){return paused;},get loaded(){return loaded;},get coins(){return coins;},get stats(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},start:startRace,respawn,controls,manual:(enabled:boolean)=>{debugManual=enabled;},advance:(seconds:number,input=emptyInput)=>{for(let i=0;i<Math.round(seconds*60);i++)step(1/60,input);updateCar(paused?0:seconds);updateHUD();},place:(t:number)=>{const f=frameAt(t);vehicle.x=f.position.x;vehicle.z=f.position.z;vehicle.heading=f.heading;vehicle.y=.13;},frameAt};}
if(import.meta.env.DEV){const debug=(window as unknown as {__game:object}).__game;Object.assign(debug,{competition,playerModels,selectKart,openGarage,selectMode:(value:GameMode)=>{selectedGameMode=value;competition.reset(value);},help,closeModal,finish});Object.defineProperty(debug,'selectedKart',{get:()=>selectedKart});}
function loop(now:number){requestAnimationFrame(loop);const delta=Math.min((now-previousFrame)/1000,.06);previousFrame=now;if(!debugManual){accumulator+=delta;let steps=0;while(accumulator>=1/60&&steps<4){step(1/60);accumulator-=1/60;steps++;}}updateCar(paused?0:delta);updateCamera(delta);world.updateGantryVisibility(camera,car.position.clone().add(new THREE.Vector3(0,.7,0)),mode!=='intro'&&cameraMode==='follow');sound.update();hudTick+=delta;if(hudTick>.06){updateHUD();hudTick=0;}renderer.render(scene,camera);}
updateHUD();requestAnimationFrame(loop);
