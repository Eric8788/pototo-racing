import * as THREE from 'three';
import {Network} from './network';
import {KARTS,type KartId} from './kart-models';
import {vehicleKeys,type RoomState,type NetPlayer} from './net-protocol';
import {Vehicle} from './vehicle';
import {Race,formatTime} from './race';
import type {RivalVisual} from './rival-visual';
import type {World} from './world';
const $=(id:string)=>document.getElementById(id)!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const spec=(p:NetPlayer)=>KARTS.find(k=>k.id===p.kart)!;
interface UI {
 open:(html:string)=>void;close:()=>void;intro:()=>void;
 phase:(phase:'countdown'|'race'|'finished')=>void;
 select:(id:KartId)=>void;selected:()=>KartId;thumbnails:()=>Map<KartId,string>;
 toast:(message:string)=>void;
 prepare:(proceed:()=>void)=>void;
}
export class OnlineGame {
 net=new Network();remote:NetPlayer[]=[];private signature='';private visualSignature='';private round=-1;private lastPhase='';private resultsOpen=false;
 constructor(private ui:UI,private vehicle:Vehicle,private race:Race,private world:World,private visuals:RivalVisual[]){
  this.net.onState=s=>this.receive(s);
  this.net.onError=message=>{const el=document.getElementById('net-error');if(el)el.textContent=message;else ui.toast(message);};
  this.net.onClose=()=>{this.exit();ui.open('<small>CONNECTION LOST</small><h2 id="modal-title">和主机走散了</h2><p>本局已退出。确认主机服务和 Wi-Fi 后，可重新进入房间参加下一局。</p><button class="primary" id="net-dismiss">返回小岛</button>');$('net-dismiss').onclick=ui.close;};
 }
 get active(){return !!this.net.state;}
 get me(){return this.net.state?.players.find(p=>p.id===this.net.id);}
 open(){
  if(this.active){this.lobby(this.net.state!);return;}
  let name='';try{name=localStorage.getItem('wobble-gp:name')||'';}catch{}
  const invited=new URLSearchParams(location.search).get('room')||'';
  this.ui.open(`<small>LAN PARTY / 局域网开黑</small><h2 id="modal-title">今天，和真人一起歪。</h2><p>2–4 人同场。朋友用同一 Wi-Fi 打开本页，再输入房间码加入。</p><label class="net-label" for="net-name">你的称呼</label><input class="net-input" id="net-name" maxlength="12" value="${escape(name)}" placeholder="给自己起个歪名"><div class="net-actions"><button class="primary" id="net-create">创建房间 ↗</button><span>或者，加入朋友</span><label class="net-label" for="net-code">6 位房间码</label><input class="net-input" id="net-code" maxlength="6" inputmode="numeric" value="${escape(invited.slice(0,6))}" placeholder="例如 123456"><button class="secondary" id="net-join">加入房间</button></div><p id="net-error" role="status" class="net-error"></p><button class="secondary" id="net-cancel">返回小岛</button>`);
  const connect=async(join:boolean)=>{
   const name=($('net-name') as HTMLInputElement).value.trim()||'无名小瓜',code=($('net-code') as HTMLInputElement).value.trim();
   if(join&&!/^\d{6}$/.test(code)){$('net-error').textContent='请输入完整的 6 位房间码。';return;}
   const buttons=['net-create','net-join'].map(id=>$(id) as HTMLButtonElement);buttons.forEach(b=>b.disabled=true);$('net-error').textContent='正在连接主机…';
   try{await this.net.connect();try{localStorage.setItem('wobble-gp:name',name);}catch{}this.net.send(join?{type:'join',code,name,kart:this.ui.selected()}:{type:'create',name,kart:this.ui.selected()});}
   catch(e){if(document.getElementById('net-error'))$('net-error').textContent=(e as Error).message;}
   finally{buttons.forEach(b=>b.disabled=false);}
  };
  $('net-create').onclick=()=>void connect(false);$('net-join').onclick=()=>void connect(true);$('net-cancel').onclick=()=>{this.net.disconnect();this.ui.close();};
 }
 exit(){this.net.send({type:'leave'});this.net.disconnect();this.signature=this.visualSignature=this.lastPhase='';this.round=-1;this.resultsOpen=false;this.remote=[];this.world.resetCoins();this.ui.close();this.ui.intro();this.ui.select(this.ui.selected());}
 private receive(s:RoomState){
  const me=this.me;if(!me)return;
  if(s.round!==this.round){this.round=s.round;this.resultsOpen=false;this.snap();}
  if(s.phase!==this.lastPhase){
   this.lastPhase=s.phase;this.signature='';
   if(s.phase==='lobby'){this.resultsOpen=false;this.ui.intro();}
   else {this.ui.close();this.ui.phase(s.phase==='results'?'finished':s.phase);}
  }
  const signature=s.players.map(p=>p.id+p.kart+p.name).join('|');
  this.remote=s.players.filter(p=>p.id!==this.net.id);
  if(signature!==this.visualSignature){
   this.visualSignature=signature;this.ui.select(me.kart);
   this.remote.forEach((p,i)=>this.visuals[i]?.select(p.kart,p.name));this.snap();
  }
  if(s.phase==='lobby')this.lobby(s);
  else if(s.phase==='results'||me.race.finished||me.dnf)this.results(s);
 }
 private snap(){const s=this.net.state;if(!s)return;const me=this.me;if(me)Object.assign(this.vehicle,me.vehicle);s.players.filter(p=>p.id!==this.net.id).forEach((p,i)=>{if(this.visuals[i])Object.assign(this.visuals[i].rival.vehicle,p.vehicle);});}
 private lobby(s:RoomState){
  const signature=JSON.stringify([s.host,s.players.map(p=>[p.id,p.name,p.kart,p.ready])]);if(signature===this.signature)return;this.signature=signature;
  const me=this.me!,host=s.host===this.net.id,canStart=s.players.length>=2&&s.players.every(p=>p.ready);
  const link=new URL(location.href);link.search='';link.searchParams.set('room',s.code);
  this.ui.open(`<small>THE ODD ROOM / 怪车候场中</small><h2 id="modal-title">叫上朋友，凑一桌怪车。</h2><div class="room-code"><span>房间码 · ${s.players.length}/4 人</span><strong>${s.code}</strong><button id="net-copy">复制邀请链接</button></div><ol class="room-roster">${s.players.map(p=>`<li data-peer="${p.id}"><img src="${this.ui.thumbnails().get(p.kart)||''}" alt="${spec(p).name}"><span><b>${escape(p.name)}${p.id===this.net.id?' · 你':''}</b><small>${spec(p).name}${p.id===s.host?' · 房主':''}</small></span><em>${p.ready?'已准备 ✓':'挑车中'}</em></li>`).join('')}</ol><label class="net-label" for="net-kart">你的怪车（换车后需重新准备）</label><select class="net-input" id="net-kart">${KARTS.map(k=>`<option value="${k.id}" ${k.id===me.kart?'selected':''}>${k.name}</option>`).join('')}</select><div class="room-buttons"><button class="primary" id="net-ready">${me.ready?'取消准备':'我准备好了 ✓'}</button>${host?`<button class="primary" id="net-start" ${canStart?'':'disabled'}>全员发车 ↗</button>`:'<span>等待房主发车</span>'}</div><p class="net-footnote">至少 2 人且全员准备后发车。比赛期间不能中途加入；每局最多 10 分钟。</p><p id="net-error" role="status" class="net-error"></p><button class="secondary" id="net-leave">退出房间</button>`);
  $('net-ready').onclick=()=>this.net.send({type:'ready',ready:!this.me?.ready});
  if(host)$('net-start').onclick=()=>this.ui.prepare(()=>this.net.send({type:'start'}));
  $('net-kart').onchange=()=>this.net.send({type:'kart',kart:($('net-kart') as HTMLSelectElement).value as KartId});
  $('net-leave').onclick=()=>this.exit();
  $('net-copy').onclick=async()=>{
   if(location.hostname==='localhost'||location.hostname==='127.0.0.1')try{const health=await(await fetch('/health')).json();if(health.lanUrls?.[0]){const lan=new URL(health.lanUrls[0]);link.host=lan.host;}}catch{}
   try{await navigator.clipboard.writeText(link.href);if(document.getElementById('net-error'))$('net-error').textContent='邀请链接已复制。';}catch{if(document.getElementById('net-error'))$('net-error').textContent=link.href;}
  };
 }
 private results(s:RoomState){
  const signature=JSON.stringify([s.phase,s.host,s.order,s.players.map(p=>[p.id,p.connected,p.dnf,p.race.finished,p.race.finished?p.race.elapsed:0])]);
  if(signature===this.signature&&this.resultsOpen)return;this.signature=signature;this.resultsOpen=true;
  const me=this.me!,done=s.phase==='results';
  this.ui.open(`<small>${done?'RACE COMPLETE':'FINISH!'} / 真人同场</small><h2 id="modal-title">${done?'这一桌，歪得漂亮。':me.dnf?'本局已结束，看看大家。':'你到终点了，等朋友冲线。'}</h2><ol class="results-ranking">${s.order.map((id,i)=>{const p=s.players.find(p=>p.id===id)!;return `<li>${i+1}. ${escape(p.name)}${id===this.net.id?' · 你':''}<strong>${p.race.finished?formatTime(p.race.elapsed):p.dnf?'退出 / 未完赛':'比赛中'}</strong></li>`;}).join('')}</ol><p>${done?'房主返回候场后，大家可换车再来。':'排名会随其他玩家完赛继续更新。'}</p>${done&&s.host===this.net.id?'<button class="primary" id="net-rematch">返回候场，再来一局 ↗</button>':''}<button class="secondary" id="net-exit-results">退出房间</button>`);
  if(document.getElementById('net-rematch'))$('net-rematch').onclick=()=>this.net.send({type:'lobby'});
  $('net-exit-results').onclick=()=>this.exit();
 }
 frame(dt:number){
  const s=this.net.state,me=this.me;if(!s||!me)return;
  const apply=(v:Vehicle,p:NetPlayer)=>{
   const distance=Math.hypot(v.x-p.vehicle.x,v.z-p.vehicle.z),alpha=distance>6?1:1-Math.exp(-dt*30);
   const x=THREE.MathUtils.lerp(v.x,p.vehicle.x,alpha),z=THREE.MathUtils.lerp(v.z,p.vehicle.z,alpha),y=THREE.MathUtils.lerp(v.y,p.vehicle.y,alpha);
   const heading=v.heading+Math.atan2(Math.sin(p.vehicle.heading-v.heading),Math.cos(p.vehicle.heading-v.heading))*alpha;
   for(const k of vehicleKeys)(v as unknown as Record<string,unknown>)[k]=p.vehicle[k];Object.assign(v,{x,z,y,heading});
  };
  apply(this.vehicle,me);Object.assign(this.race,me.race,{best:me.race.best??Infinity});
  this.remote.forEach((p,i)=>{if(this.visuals[i])apply(this.visuals[i].rival.vehicle,p);});
  this.world.coins.forEach((c,i)=>{c.collected=me.collected.includes(i);c.object.visible=!c.collected;});
  this.world.obstacles.filter(o=>o.movable).forEach((o,i)=>{const p=s.props[i];if(p){o.x=p.x;o.z=p.z;o.vx=o.vz=0;o.object.position.set(p.x,0,p.z);o.object.rotation.z=p.tilt;}});
  $('countdown').textContent=s.phase==='countdown'?String(Math.ceil(s.countdown)):'';
 }
 hud(){
  const s=this.net.state;if(!s)return;
  document.querySelector('.leaderboard')!.classList.toggle('visible',s.phase==='race'||s.phase==='countdown');
  $('position').innerHTML=`${s.order.indexOf(this.net.id)+1} <small>/ ${s.players.length}</small>`;
  $('standings').innerHTML=s.order.map((id,i)=>{const p=s.players.find(p=>p.id===id)!;return `<li class="${id===this.net.id?'is-player':''}"><b>${i+1}</b><i style="background:${spec(p).color}"></i><span>${escape(p.name)}</span><small>${p.race.finished?'完成':p.dnf?'掉线':`${p.race.lap}/3`}</small></li>`;}).join('');
  $('coins').textContent=String(this.me?.coins||0).padStart(2,'0');
  document.querySelector('.leaderboard-title>span')!.textContent=`联机 · ${this.net.latency} ms`;
 }
}
