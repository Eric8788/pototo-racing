import {gameAudio} from './audio';
import './style.css';
import './online.css';
import './launch.css';
import {LaunchFlow,type EntryMode} from './launch-flow';
import {trackSpec,type TrackId} from './tracks';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vehicle,type Control} from './vehicle';
import {World} from './world';
import {Race,formatTime} from './race';
import {samples,frameAt,nearestTrack,setTrack} from './track';
import {Competition,type GameMode} from './competition';
import {RivalVisual} from './rival-visual';
import {KARTS,setCompleteFleet,createKart,animateKart,kartThumbnails,type KartId,type KartModel} from './kart-models';
import {OnlineGame} from './online-game';
import {TiltSteering} from './tilt-steering';

const icons={sound:'<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',muted:'<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/>',camera:'<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="3"/>',reset:'<path d="M5 9a8 8 0 1 1 0 8M5 3v6h6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>'};
const svg=(key:keyof typeof icons)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
document.querySelector('#app')!.innerHTML=`
<canvas id="scene" tabindex="0" aria-label="土豆环岛三维赛车场。使用方向键或 WASD 驾驶，空格漂移，Shift 加速。"></canvas>
<div class="hud" id="hud">
 <header class="topbar"><div class="brand"><div class="brand-icon">W</div><div class="brand-name">歪瓜大奖赛<small>WOBBLE GP <span class="version-badge">01</span></small></div></div>
 <div class="toolbar"><span class="tag">单人练习 · SINGLE PLAYER</span><button id="sound" class="icon-btn" aria-label="开启声音" title="声音 · M">${svg('muted')}</button><button id="camera" class="icon-btn" aria-label="切换侧后方跟随" title="切换镜头 · C">${svg('camera')}</button><button id="reset" class="icon-btn" aria-label="返回赛道" title="返回赛道 · R">${svg('reset')}</button><button id="help" class="icon-btn help-button" aria-label="操作说明" title="操作说明">${svg('help')}</button></div></header>
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
// Define device detection before renderer setup; this function is used immediately below.
const isMobileDevice=()=>matchMedia('(pointer:coarse)').matches||innerWidth<760;
const modePicker=document.createElement('fieldset');modePicker.className='mode-picker';modePicker.innerHTML='<legend>比赛模式</legend><label><input type="radio" name="game-mode" value="race" checked><span>四车大奖赛</span></label><label><input type="radio" name="game-mode" value="practice"><span>单车练习</span></label>';
$('start').before(modePicker);
const garageButton=document.createElement('button');garageButton.id='garage-open';garageButton.className='garage-open';garageButton.disabled=true;garageButton.innerHTML='<span>准备你的怪车…</span>';modePicker.before(garageButton);
const onlineButton=document.createElement('button');onlineButton.id='online-open';onlineButton.className='online-open';onlineButton.disabled=true;onlineButton.textContent='和朋友联机 ↗ · 2–4 人';$('start').after(onlineButton);
const leaderboard=document.createElement('aside');leaderboard.className='leaderboard';leaderboard.setAttribute('aria-label','实时排名');leaderboard.innerHTML='<div class="leaderboard-title"><span>POSITION</span><strong id="position">4 <small>/ 4</small></strong></div><ol id="standings"></ol>';$('hud').append(leaderboard);
document.querySelector('.tag')!.textContent='四车大奖赛 · VS 3 AI';
document.querySelector('.intro p')!.innerHTML='土豆、铅笔、飞碟，谁说不能当赛车？<br/>选一辆不太正常的小车，出发兜个歪风。';
let renderer:THREE.WebGLRenderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('loading').textContent='你的浏览器暂时无法启动 WebGL。请开启硬件加速后刷新页面。';throw error;}
const renderPixelRatio=()=>Math.min(devicePixelRatio,isMobileDevice()?1.25:1.5);
renderer.setPixelRatio(renderPixelRatio());renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc1dcdb);scene.fog=new THREE.Fog(0xc1dcdb,145,370);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,1,400);camera.position.set(84,98,116);
scene.add(new THREE.HemisphereLight(0xfff7df,0x729391,2.5));const sun=new THREE.DirectionalLight(0xffedcc,3.2);sun.position.set(-35,70,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-78,right:78,top:65,bottom:-65,near:1,far:170});sun.shadow.normalBias=.12;sun.shadow.bias=-.00008;sun.shadow.radius=3;scene.add(sun);
let world=new World(scene);
const vehicle=new Vehicle(),race=new Race();
const worlds=new Map<TrackId,World>([['potato',world]]);let chosenTrack:TrackId='potato';
let flow:LaunchFlow;
let readyResolve:()=>void,readyReject:(error:unknown)=>void;
const gameReady=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
export async function enterSetup(entry:EntryMode){await gameReady;flow.begin(entry);}
function selectTrack(id:TrackId){
 if(chosenTrack===id)return;world.group.visible=false;setTrack(id);chosenTrack=id;
 if(!worlds.has(id))worlds.set(id,new World(scene));world=worlds.get(id)!;world.group.visible=true;world.resetCoins();online.setWorld(world);
 const spec=trackSpec(id);scene.background=new THREE.Color(spec.sky);scene.fog=new THREE.Fog(spec.sky,145,370);
 document.querySelector('.map-title b')!.textContent=spec.name;competition.reset(selectedGameMode);updateCar(0);
}
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
let loaded=false,mode:'intro'|'countdown'|'race'|'finished'='intro',paused=false,countdown=3,lastCountdown=-1,coins=0,elapsedVisual=0,cameraMode:'rear'|'side'='rear',toastTimer=0,coinSoundCooldown=0,padCooldown=0,respawnCooldown=0,accumulator=0,previousFrame=performance.now(),hudTick=0;
let debugManual=false;
const keys=new Set<string>(),touch=new Set<string>();
const emptyInput:Control={throttle:0,steer:0,brake:false,boost:false};

let gyroEnabled=false,steeringSetupOpen=false;
const tilt=new TiltSteering();
const gyroButton=$<HTMLButtonElement>('gyro-toggle');
function setGyroLabel(){gyroButton.textContent=gyroEnabled?'倾斜转向 · 校准':'方向键 · 改用倾斜';gyroButton.setAttribute('aria-pressed',String(gyroEnabled));document.body.classList.toggle('tilt-active',gyroEnabled);}
function onOrientation(e:DeviceOrientationEvent){const legacy=(window as unknown as {orientation?:number}).orientation;tilt.sample(e.beta,e.gamma,screen.orientation?.angle??legacy??0,performance.now());}
function disableGyro(){gyroEnabled=false;tilt.reset();window.removeEventListener('deviceorientation',onOrientation);setGyroLabel();}
function prepareSteering(proceed:()=>void){
 if(!isMobileDevice()){proceed();return;}
 if(steeringSetupOpen)return;steeringSetupOpen=true;
 openModal(`<small>READY TO STEER / 开局前准备</small><h2 id="modal-title">先把方向调正。</h2><p>允许使用手机方向传感器，然后按驾驶时的姿势握稳手机。平放也可以；当前姿势会设为直行。</p><button class="primary" id="tilt-allow">${gyroEnabled?'重新校准当前姿势':'允许倾斜控制并校准'}</button><p id="tilt-status" role="status">授权并校准完成前，不会开始比赛或自动前进。</p><div class="tilt-preview" aria-label="转向预览"><span>左</span><i id="tilt-indicator"></i><span>右</span></div><button class="primary" id="tilt-go" disabled>校准后继续</button><button class="secondary" id="tilt-touch">改用方向键继续</button>`);
 const allow=$<HTMLButtonElement>('tilt-allow'),go=$<HTMLButtonElement>('tilt-go');
 let timer:ReturnType<typeof setInterval>|undefined,request=0;
 const finishSetup=(touchMode:boolean)=>{request++;if(timer)clearInterval(timer);if(touchMode)disableGyro();steeringSetupOpen=false;closeModal();proceed();};
 $('tilt-touch').onclick=()=>finishSetup(true);
 go.onclick=()=>{if(tilt.calibrated&&tilt.fresh(performance.now()))finishSetup(false);};
 allow.onclick=async()=>{
  const attempt=++request;if(timer)clearInterval(timer);allow.disabled=true;go.disabled=true;tilt.reset();
  try{
   if(!window.isSecureContext||typeof DeviceOrientationEvent==='undefined')throw Error('当前浏览器无法读取传感器，请使用 HTTPS 页面或方向键。');
   const sensor=DeviceOrientationEvent as unknown as {requestPermission?:()=>Promise<string>};
   // Called directly from this button's click, as required by iOS.
   if(sensor.requestPermission&&await sensor.requestPermission()!=='granted')throw Error('未获得传感器权限。你可以用方向键开始。');
   if(attempt!==request)return;
   gyroEnabled=true;setGyroLabel();window.addEventListener('deviceorientation',onOrientation);
   $('tilt-status').textContent='保持手机稳定约 1 秒，正在校准…';
   const began=performance.now();timer=setInterval(()=>{
    const now=performance.now(),ready=tilt.calibrated&&tilt.fresh(now);go.disabled=!ready;
    go.textContent=ready?'方向正确，继续 ↗':'校准后继续';
    $('tilt-indicator').style.transform=`translateX(${tilt.value(now)*90}px)`;
    $('tilt-status').textContent=ready?'已校准。左右倾斜试试，回到当前姿势应为直行。':'保持手机稳定约 1 秒，正在校准…';
    if(!ready&&now-began>8000){clearInterval(timer);disableGyro();$('tilt-status').textContent='未收到稳定的传感器读数。请重试，或改用方向键。';allow.disabled=false;}
   },80);
   allow.disabled=false;allow.textContent='重新校准当前姿势';
  }catch(e){if(attempt!==request)return;disableGyro();$('tilt-status').textContent=(e as Error).message;allow.disabled=false;}
 };
}
gyroButton.onclick=()=>prepareSteering(()=>{});setGyroLabel();
const online=new OnlineGame({
 open:html=>{openModal(html);$('modal').classList.add('net-modal');},close:closeModal,
 intro:()=>{if(online.active)flow.hide('lobby');else flow.home();mode='intro';$('intro').classList.remove('hidden');$('intro').inert=false;$('hud').classList.remove('finished','playing');$('countdown').textContent='';competition.reset(selectedGameMode);document.querySelector('.leaderboard-title>span')!.textContent='POSITION';},
 phase:phase=>{flow.hide();car.visible=true;mode=phase;$('intro').classList.add('hidden');$('intro').inert=true;$('hud').classList.toggle('playing',phase!=='finished');$('hud').classList.toggle('finished',phase==='finished');if(phase==='countdown'){for(const s of skids)s.visible=false;for(const d of dust){d.life=0;d.mesh.visible=false;}$('toast').classList.remove('show');}},
 select:selectKart,selected:()=>selectedKart,thumbnails:()=>thumbnails,track:()=>chosenTrack,selectTrack,toast,prepare:prepareSteering
},vehicle,race,world,rivalVisuals);
online.net.input=()=>paused||document.hidden?emptyInput:controls();
onlineButton.onclick=()=>flow.begin('online');
function controls():Control{const brake=keys.has('Space')||touch.has('brake'),reverse=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('reverse');const autoForward=isMobileDevice()&&mode==='race'&&!reverse&&!brake;return {throttle:reverse?-1:(keys.has('KeyW')||keys.has('ArrowUp')||touch.has('gas')||autoForward?1:0),steer:gyroEnabled?tilt.value(performance.now()):(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left')?1:0),brake,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.has('boost')};}
class Sound {
 engine?:OscillatorNode;engineGain?:GainNode;
 get context(){return gameAudio.context;}
 get muted(){return gameAudio.muted;}
 init(){void gameAudio.unlock();if(this.engine||!this.context)return;const c=this.context;this.engine=c.createOscillator();this.engine.type='triangle';this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain).connect(gameAudio.output!);this.engine.start();}
 toggle(){gameAudio.toggle();}
 tone(frequency:number,length=.12,type:OscillatorType='sine',volume=.08){if(this.muted||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,c.currentTime);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+length);o.connect(g).connect(gameAudio.output!);o.start();o.stop(c.currentTime+length);o.onended=()=>{o.disconnect();g.disconnect();};}
 update(){gameAudio.setScene(mode==='race'||mode==='countdown'?'race':'menu');if(!this.engine&&this.context)this.init();if(!this.context||!this.engine||!this.engineGain)return;this.engine.frequency.setTargetAtTime(42+Math.abs(vehicle.speed)*6+(vehicle.boosting?25:0),this.context.currentTime,.08);this.engineGain.gain.setTargetAtTime(!this.muted&&mode==='race'&&!paused?.018+Math.min(.012,Math.abs(vehicle.speed)*.0005):0,this.context.currentTime,.12);}
}
const sound=new Sound();
function soundLabel(){const b=$('sound');b.innerHTML=svg(sound.muted?'muted':'sound');b.setAttribute('aria-label',sound.muted?'开启音乐与音效':'关闭音乐与音效');b.title=sound.muted?'开启音乐与音效 · M':'关闭音乐与音效 · M';}
window.addEventListener('wobble-audio-change',soundLabel);soundLabel();

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
function openGarage(){if(loaded)flow.begin('single');}
function returnToGarage(){closeModal();mode='intro';$('intro').classList.remove('hidden');$('intro').inert=false;$('hud').classList.remove('finished','playing');competition.reset(selectedGameMode);updateHUD();openGarage();}
garageButton.onclick=()=>openGarage();
function beginRace(){if(!loaded)return;closeModal();flow.hide();car.visible=true;rivalVisuals.forEach(v=>v.rival.vehicle.speed=0);competition.reset(selectedGameMode);world.resetCoins();coins=0;mode='countdown';countdown=3;lastCountdown=-1;padCooldown=0;keys.clear();touch.clear();for(const s of skids)s.visible=false;for(const d of dust){d.life=0;d.mesh.visible=false;}$('intro').classList.add('hidden');$('intro').inert=true;$('hud').classList.remove('finished');$('hud').classList.add('playing');$('countdown').textContent='3';canvas.focus();toast(selectedGameMode==='race'?'四辆车，三圈路。土豆冠军只有一个！':'跟着箭头跑三圈。土豆评委已经就位。',3);updateHUD();}
function startRace(){prepareSteering(beginRace);}
function respawn(){if(online.active){online.net.send({type:'respawn'});keys.clear();touch.clear();return;}if(mode==='intro')return;vehicle.reset(race.respawnProgress());keys.clear();touch.clear();respawnCooldown=1;toast('稳住！把你捞回赛道了。');updateCar(0);}
function toggleCamera(){cameraMode=cameraMode==='rear'?'side':'rear';$('camera').setAttribute('aria-label',cameraMode==='rear'?'切换侧后方跟随':'切换正后方跟随');toast(cameraMode==='rear'?'正后方跟随 · 赛车视角':'侧后方跟随 · 看见漂移');}
function closeModal(){$('modal').classList.remove('garage-modal','net-modal');paused=false;$('modal-backdrop').classList.remove('visible');keys.clear();touch.clear();canvas.focus();}
function openModal(content:string){paused=true;keys.clear();touch.clear();$('modal').innerHTML=content;$('modal-backdrop').classList.add('visible');$('modal').querySelector<HTMLButtonElement>('button')?.focus();}
function help(){openModal(`<small>DRIVER'S VERY SHORT MANUAL</small><h2 id="modal-title">小车上手指南</h2><p>先跑起来。漂不漂亮，土豆说了算。</p><div class="help-row"><span>加速 / 刹车与倒车</span><span><kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd></span></div><div class="help-row"><span>方向</span><span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span></div><div class="help-row"><span>刹车 / 转弯时漂移</span><kbd>SPACE</kbd></div><div class="help-row"><span>氮气 / 回到检查点</span><span><kbd>SHIFT</kbd> / <kbd>R</kbd></span></div><div class="help-row"><span>镜头 / 声音 / 喇叭</span><span><kbd>C</kbd> <kbd>M</kbd> <kbd>H</kbd></span></div><p>黄色箭头会加速，跳台可以起飞。收集薯币补充氮气；草地会减速。顺序通过检查点才算一圈。</p><button class="primary" id="resume">知道了，继续开</button><button class="secondary" id="leave-race">结束本局，返回车库</button>`);$('resume').onclick=closeModal;$('leave-race').onclick=returnToGarage;}
let resultsSignature='';
function refreshLocalResults(){
 const list=document.getElementById('local-results');if(!list||mode!=='finished')return;
 const entries=competition.standings(),signature=JSON.stringify(entries.map(e=>[e.id,e.race.finished,e.race.finished?e.race.elapsed:e.race.lap]));
 if(signature===resultsSignature)return;resultsSignature=signature;
 list.innerHTML=entries.map((e,i)=>`<li><span>${i+1}. ${e.name}</span><strong>${e.race.finished?formatTime(e.race.elapsed):`比赛中 · 第 ${e.race.lap} 圈`}</strong></li>`).join('');
 $('results-wait').textContent=entries.every(e=>e.race.finished)?'全员到齐，这一圈歪得漂亮。':'你已冲线，其他车手继续比赛，成绩会自动更新。';
}
function finish(){
 mode='finished';vehicle.vx=vehicle.vz=vehicle.speed=0;vehicle.boosting=vehicle.drifting=false;resultsSignature='';
 $('hud').classList.add('finished');$('hud').classList.remove('playing');sound.tone(660,.3);
 openModal(`<small>FINISH! / 土豆认证完赛</small><h2 id="modal-title">${selectedGameMode==='race'?(competition.place===1?'冠军，薯你最歪！':`第 ${competition.place} 名，也很帅。`):'有点歪，但很帅。'}</h2><div class="results-time">${formatTime(race.elapsed)}</div>${selectedGameMode==='race'?'<ol class="results-ranking" id="local-results"></ol><p id="results-wait" role="status"></p>':''}<div class="lap-list">${race.lapTimes.map((t,i)=>`第 ${i+1} 圈 <strong style="float:right">${formatTime(t)}</strong>`).join('<br/>')}</div><p>捡到 ${coins} 枚薯币 · 最佳单圈 ${formatTime(race.best)}</p><button id="again" class="primary">再跑一次 ↗</button><button id="back-home" class="secondary">返回首页</button>`);
 refreshLocalResults();$('again').onclick=startRace;$('back-home').onclick=()=>flow.home();
}
function showHelp(){
 if(online.active&&(online.net.state?.phase==='lobby'||online.me?.race.finished||online.me?.dnf||online.net.state?.phase==='results'))return;
 help();
 if(online.active){$('modal-title').textContent='联机菜单 · 比赛继续';$('modal').querySelector('p')!.textContent='已松开你的油门，其他车手仍在比赛。';$('leave-race').textContent='退出本局联机';$('leave-race').onclick=()=>online.exit();online.net.send({type:'input',input:emptyInput});}
}
$('start').onclick=()=>flow.begin('single');$('sound').onclick=()=>sound.toggle();$('camera').onclick=toggleCamera;$('reset').onclick=respawn;$('help').onclick=showHelp;
window.addEventListener('keydown',e=>{
 if(document.body.dataset.screen!=='race'&&!$('modal-backdrop').classList.contains('visible'))return;
 if((e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)&&e.code!=='Escape')return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&!(e.target instanceof HTMLButtonElement))e.preventDefault();
 if(e.repeat){keys.add(e.code);return;}
 if(e.code==='Escape'){if(online.active&&(online.net.state?.phase==='lobby'||online.me?.race.finished||online.me?.dnf||online.net.state?.phase==='results'))return;if($('modal-backdrop').classList.contains('visible')){if(mode!=='finished')closeModal();}else if(mode==='race')showHelp();return;}
 if(paused)return;
 if(e.code==='KeyR')respawn();else if(e.code==='KeyC')toggleCamera();else if(e.code==='KeyM')sound.toggle();else if(e.code==='KeyH'){sound.init();sound.tone(330,.09,'square',.045);setTimeout(()=>sound.tone(210,.12,'sawtooth',.04),85);setTimeout(()=>sound.tone(120,.18,'square',.035),205);toast('叭叭——土豆车表示：借过一下啦！',1.8);}else if(e.code==='Enter'&&mode==='intro')return;keys.add(e.code);
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
 if(mode==='finished'&&selectedGameMode==='race'){competition.step(dt,world.obstacles,world.boosts);world.update(dt,elapsedVisual);return;}
 if(!paused){
  if(mode==='countdown'){countdown-=dt;const n=Math.ceil(countdown);if(n!==lastCountdown){lastCountdown=n;$('countdown').textContent=n>0?String(n):'GO!';sound.tone(n>0?440:880,.13);}if(countdown<=0){mode='race';setTimeout(()=>{$('countdown').textContent='';},650);}}
  if(mode==='race'){
   const fell=vehicle.step(dt,override||controls(),world.obstacles);if(fell&&respawnCooldown<=0)respawn();
   competition.step(dt,world.obstacles,world.boosts);
   const nearest=nearestTrack(vehicle.x,vehicle.z);
   for(const t of world.boosts)if(Math.abs(nearest.progress-t)<.011&&nearest.distance<2.6&&padCooldown<=0&&vehicle.speed>3){vehicle.padBoost=1.1;padCooldown=2;sound.tone(180,.25,'sawtooth',.025);toast('咻——！土豆起飞，谁还在写作业？！',2.2);}
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
 }else{
  const f=new THREE.Vector3(Math.sin(vehicle.heading),0,Math.cos(vehicle.heading));
  const side=new THREE.Vector3(f.z,0,-f.x),rear=cameraMode==='rear';
  desiredTarget.set(vehicle.x,vehicle.y+1,vehicle.z).addScaledVector(f,3.4);
  desiredPosition.set(vehicle.x,vehicle.y,vehicle.z).addScaledVector(f,rear?-13.8:-15.5).addScaledVector(side,rear?0:6.5);
  desiredPosition.y+=rear?8.5:15;
 }
 // Keep rear mode centered on the car even through turns: smooth the orbit radius,
 // not the world-space heading, which would leave the camera drifting sideways.
 if(mode!=='intro'&&cameraMode==='rear'){
  const blend=1-Math.exp(-dt*7);
  const distance=THREE.MathUtils.lerp(Math.hypot(camera.position.x-vehicle.x,camera.position.z-vehicle.z),13.8,blend);
  camera.position.set(vehicle.x-Math.sin(vehicle.heading)*distance,THREE.MathUtils.lerp(camera.position.y,desiredPosition.y,blend),vehicle.z-Math.cos(vehicle.heading)*distance);
  cameraTarget.copy(desiredTarget);
 }

 const lerp=1-Math.exp(-dt*(mode==='intro'?1.5:4));camera.position.lerp(desiredPosition,lerp);cameraTarget.lerp(desiredTarget,lerp);camera.lookAt(cameraTarget);const targetFov=mode==='intro'?42:innerWidth<760?(vehicle.boosting?66:60):(vehicle.boosting?52:46);camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,4,dt);camera.updateProjectionMatrix();
}
const map=$<HTMLCanvasElement>('minimap'),ctx=map.getContext('2d')!;
function drawMap(){ctx.clearRect(0,0,300,228);const mapPoint=(x:number,z:number)=>({x:x*2.5+150,y:z*2.5+114});ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<=samples.length;i++){const p=samples[i%samples.length],m=mapPoint(p.x,p.z);if(i===0)ctx.moveTo(m.x,m.y);else ctx.lineTo(m.x,m.y);}ctx.strokeStyle='#d5dbc7';ctx.lineWidth=21;ctx.stroke();ctx.strokeStyle='#82917d';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#f5f3de';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);const start=mapPoint(samples[0].x,samples[0].z);ctx.fillStyle='#fbf8ea';ctx.fillRect(start.x-2,start.y-12,4,24);const cp=mapPoint(vehicle.x,vehicle.z);ctx.save();ctx.translate(cp.x,cp.y);ctx.rotate(-vehicle.heading);ctx.shadowColor='#5f7d6744';ctx.shadowBlur=8;ctx.fillStyle='#f28563';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(-6,-6);ctx.lineTo(0,-3);ctx.lineTo(6,-6);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff9e9';ctx.lineWidth=2;ctx.stroke();ctx.restore();const next=frameAt((race.nextGate%8)/8),np=mapPoint(next.position.x,next.position.z);if(mode==='race'){ctx.fillStyle='#f0cf73';ctx.beginPath();ctx.arc(np.x,np.y,4,0,Math.PI*2);ctx.fill();}}
function updateHUD(){
 if(!online.active)refreshLocalResults();
 leaderboard.classList.toggle('visible',selectedGameMode==='race'&&(mode==='race'||mode==='countdown'));
 $('position').innerHTML=`${competition.place} <small>/ 4</small>`;
 $('standings').innerHTML=competition.standings().map((e,i)=>`<li class="${e.id==='player'?'is-player':''}"><b>${i+1}</b><i style="background:${e.color}"></i><span>${e.name}</span><small>${e.race.finished?'完成':`${e.race.lap}/3`}</small></li>`).join('');
 $('speed').textContent=String(Math.round(Math.abs(vehicle.speed)*3.6));$('boost-bar').style.width=`${vehicle.boost*100}%`;$('boost-percent').textContent=`${Math.round(vehicle.boost*100)}%`;$('lap').innerHTML=`${String(race.lap).padStart(2,'0')} <small>/ 03</small>`;$('time').textContent=formatTime(race.elapsed);$('coins').textContent=String(coins).padStart(2,'0');$('drift').classList.toggle('show',mode==='race'&&!paused&&(vehicle.drifting||vehicle.airborne||vehicle.boosting));$('drift').textContent=vehicle.airborne?'起飞！土豆航空已上线 ✈':vehicle.boosting?'冲刺！这颗土豆开挂了！':'NICE & WOBBLY!';drawMap();
 if(online.active)online.hud();
 if(selectedGameMode==='race'||online.active)for(const [i,rival] of competition.rivals.entries()){if(online.active&&(!online.remote[i]?.connected||online.remote[i]?.dnf))continue;ctx.fillStyle=rival.color;ctx.beginPath();ctx.arc(rival.vehicle.x*2.5+150,rival.vehicle.z*2.5+114,4.8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff9e9';ctx.lineWidth=1.5;ctx.stroke();}
}
const modelTimeout=setTimeout(()=>{if(!loaded)readyReject(Error('模型请求超时，请重试'));},20000);
const modelLoader=new GLTFLoader(),assetBase=`${import.meta.env?.BASE_URL||'/'}assets/`;
modelLoader.loadAsync(assetBase+'fleet-final.glb').then(gltf=>{
 setCompleteFleet(gltf.scene);
 clearTimeout(modelTimeout);
 // Apply shared depth settings before cloning materials for opponent liveries.
 gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=false;if(o.name.startsWith('Livery_')){o.renderOrder=2;for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2;}}}});
 for(const spec of KARTS){const model=createKart(spec.id,gltf.scene);model.root.visible=false;playerModels.set(spec.id,model);carBody.add(model.root);}
 for(const rival of competition.rivals)rivalVisuals.push(new RivalVisual(rival,gltf.scene,scene));
 try{thumbnails=kartThumbnails([...playerModels.values()]);}catch(error){console.warn('Garage previews unavailable',error);}
 try{const saved=localStorage.getItem('wobble-gp:kart');if(KARTS.some(k=>k.id===saved))selectedKart=saved as KartId;}catch{}
 selectKart(selectedKart);loaded=true;garageButton.disabled=false;onlineButton.disabled=false;$('start').removeAttribute('disabled');$('start').querySelector('span')!.textContent='出发，歪一下';$('loading').classList.add('hidden');updateCar(0);readyResolve();

}).catch(error=>{clearTimeout(modelTimeout);$('loading').innerHTML='小车没有加载成功。<button id="retry">重新加载</button>';$('retry').onclick=()=>location.reload();console.error('Car model loading failed',error);readyReject(error);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(renderPixelRatio());});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('loading').classList.remove('hidden');$('loading').textContent='画面连接暂时丢失，请刷新页面重新启动。';});
// Only exposed in development: deterministic gameplay checks without a permanent autopilot.
if(import.meta.env?.DEV){(window as unknown as {__game:unknown}).__game={vehicle,race,world,get mode(){return mode;},get paused(){return paused;},get loaded(){return loaded;},get coins(){return coins;},get stats(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},start:startRace,respawn,controls,manual:(enabled:boolean)=>{debugManual=enabled;},advance:(seconds:number,input=emptyInput)=>{for(let i=0;i<Math.round(seconds*60);i++)step(1/60,input);updateCar(paused?0:seconds);updateHUD();},place:(t:number)=>{const f=frameAt(t);vehicle.x=f.position.x;vehicle.z=f.position.z;vehicle.heading=f.heading;vehicle.y=.13;},frameAt};}
if(import.meta.env.DEV){const debug=(window as unknown as {__game:object}).__game;Object.assign(debug,{competition,playerModels,selectKart,openGarage,selectMode:(value:GameMode)=>{selectedGameMode=value;competition.reset(value);},help,closeModal,finish});Object.defineProperty(debug,'selectedKart',{get:()=>selectedKart});}
function loop(now:number){requestAnimationFrame(loop);const delta=Math.min((now-previousFrame)/1000,.06);previousFrame=now;if(document.hidden)return;if(flow.frame(delta)){accumulator=0;sound.update();return;}if(!debugManual){accumulator+=delta;let steps=0;while(accumulator>=1/60&&steps<4){step(1/60);accumulator-=1/60;steps++;}}updateCar(paused?0:delta);updateCamera(delta);world.updateGantryVisibility(camera,car.position.clone().add(new THREE.Vector3(0,.7,0)),mode!=='intro');sound.update();hudTick+=delta;if(hudTick>.06){updateHUD();hudTick=0;}renderer.render(scene,camera);}
flow=new LaunchFlow({renderer,scene,models:()=>playerModels,thumbnails:()=>thumbnails,selected:()=>selectedKart,select:selectKart,track:()=>chosenTrack,selectTrack,
 previewWorld:(id)=>{const previous=chosenTrack;setTrack(id);if(!worlds.has(id)){const w=new World(scene);w.group.visible=false;worlds.set(id,w);}const preview=worlds.get(id)!.group.clone(true);preview.visible=true;preview.getObjectByName('Ocean')?.removeFromParent();setTrack(previous);return preview;},
 reset:()=>{closeModal();mode='intro';keys.clear();touch.clear();competition.reset(selectedGameMode);$('hud').classList.remove('playing','finished');$('countdown').textContent='';resultsSignature='';for(const skid of skids)skid.visible=false;},
 start:(entry,practice)=>{selectedGameMode=practice?'practice':'race';competition.reset(selectedGameMode);flow.hide('lobby');if(entry==='online')prepareSteering(()=>online.open());else startRace();}
});
updateHUD();requestAnimationFrame(loop);
