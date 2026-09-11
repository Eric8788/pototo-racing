import * as THREE from 'three';
import {Vehicle,type Control} from '../src/vehicle';
import {Race} from '../src/race';
import {World} from '../src/world';
import {resolveVehicleContacts,raceProgress} from '../src/competition';
import {frameAt,nearestTrack,setTrack,type Obstacle} from '../src/track';
import {neutralInput,vehicleKeys,type RoomState,type NetPlayer} from '../src/net-protocol';
import type {TrackId} from '../src/tracks';
import type {KartId} from '../src/kart-models';

// Build the same deterministic scene once; each room gets independent collision props.
const worlds=new Map<TrackId,World>();
export class Driver {
 vehicle=new Vehicle();race=new Race(false);ready=false;connected=true;dnf=false;
 input=neutralInput();lastInput=0;padCooldown=0;respawnCooldown=0;coins=0;collected=new Set<number>();
 constructor(public id:string,public name:string,public kart:KartId){}
}
export class Room {
 players=new Map<string,Driver>();phase:RoomState['phase']='lobby';countdown=3;round=0;tick=0;elapsed=0;
 obstacles:Obstacle[]=[];
 world:World;
 constructor(public code:string,public host:string,public readonly trackId:TrackId='potato'){setTrack(trackId);if(!worlds.has(trackId))worlds.set(trackId,new World(new THREE.Scene()));this.world=worlds.get(trackId)!;this.resetProps();}
 resetProps(){this.obstacles=this.world.obstacles.map(o=>({x:o.x,z:o.z,radius:o.radius,movable:o.movable,object:new THREE.Object3D(),vx:0,vz:0}));}
 add(id:string,name:string,kart:KartId){setTrack(this.trackId);
  if(this.phase!=='lobby')throw Error('比赛已经开始，请等下一局再加入。');
  if(this.players.size>=4)throw Error('这个房间已经满员（最多 4 人）。');
  this.players.set(id,new Driver(id,name,kart));
 }
 leave(id:string){
  const p=this.players.get(id);if(!p)return;
  if(this.phase==='lobby')this.players.delete(id);else{p.connected=false;p.dnf=!p.race.finished;p.input=neutralInput();p.vehicle.vx=p.vehicle.vz=p.vehicle.speed=0;}
  if(this.host===id)this.host=[...this.players.values()].find(p=>p.connected)?.id||'';
 }
 start(id:string){setTrack(this.trackId);
  if(id!==this.host)throw Error('只有房主可以发车。');
  if(this.phase!=='lobby')throw Error('本局已经发车。');
  const players=[...this.players.values()];
  if(players.length<2||players.some(p=>!p.ready))throw Error('至少 2 人加入，并且所有人都准备好后才能发车。');
  this.resetProps();this.phase='countdown';this.countdown=3;this.round++;this.elapsed=0;
  players.forEach((p,i)=>{p.race.reset();p.vehicle=new Vehicle();const t=i<2?.011:.030;p.vehicle.reset(t);const f=frameAt(t),lane=i%2===0?2.3:-2.3;p.vehicle.x+=f.normal.x*lane;p.vehicle.z+=f.normal.z*lane;p.dnf=false;p.coins=0;p.collected.clear();p.input=neutralInput();p.lastInput=this.tick;p.padCooldown=p.respawnCooldown=0;});
 }
 lobby(id:string){
  if(id!==this.host||this.phase!=='results')throw Error('请等本局结束后由房主返回候场。');
  for(const p of this.players.values()){if(!p.connected)this.players.delete(p.id);else p.ready=false;}
  this.phase='lobby';
 }
 respawn(p:Driver){setTrack(this.trackId);if(this.phase!=='race'||p.race.finished||p.dnf||p.respawnCooldown>0)return;p.vehicle.reset(p.race.respawnProgress());p.respawnCooldown=1;}
 setInput(p:Driver,input:Control){p.input=input;p.lastInput=this.tick;}
 step(dt:number){setTrack(this.trackId);
  this.tick++;
  if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.phase='race';return;}
  if(this.phase!=='race')return;
  this.elapsed+=dt;
  const active=[...this.players.values()].filter(p=>p.connected&&!p.dnf&&!p.race.finished);
  for(const p of active){
   p.padCooldown-=dt;p.respawnCooldown-=dt;
   if(p.vehicle.step(dt,this.tick-p.lastInput>20?neutralInput():p.input,this.obstacles))this.respawn(p);
   const near=nearestTrack(p.vehicle.x,p.vehicle.z);
   if(p.padCooldown<=0&&p.vehicle.speed>3&&near.distance<2.6&&this.world.boosts.some(t=>Math.abs(t-near.progress)<.011)){p.vehicle.padBoost=1.1;p.padCooldown=2;}
   this.world.coins.forEach((c,i)=>{if(!p.collected.has(i)&&Math.hypot(p.vehicle.x-c.x,p.vehicle.z-c.z)<1.8&&p.vehicle.y<2){p.collected.add(i);p.coins++;p.vehicle.boost=Math.min(1,p.vehicle.boost+.15);}});
  }
  resolveVehicleContacts(active.map(p=>p.vehicle));
  for(const p of active){
   const event=p.race.step(p.vehicle.x,p.vehicle.z,dt);if(event==='lap')p.collected.clear();
   if(event==='finish')p.vehicle.vx=p.vehicle.vz=p.vehicle.speed=0;
   if(this.elapsed>=600)p.dnf=true;
  }
  for(const o of this.obstacles){if(!o.movable)continue;o.x+=(o.vx||0)*dt;o.z+=(o.vz||0)*dt;o.vx=(o.vx||0)*Math.exp(-3*dt);o.vz=(o.vz||0)*Math.exp(-3*dt);o.object.rotation.z=THREE.MathUtils.damp(o.object.rotation.z,THREE.MathUtils.clamp((o.vx||0)*.06,-1,1),5,dt);}
  if([...this.players.values()].every(p=>p.race.finished||p.dnf||!p.connected))this.phase='results';
 }
 snapshot():RoomState{setTrack(this.trackId);
  const entries=[...this.players.values()];
  const order=[...entries].sort((a,b)=>{
   if(a.race.finished!==b.race.finished)return a.race.finished?-1:1;
   if(a.race.finished)return a.race.elapsed-b.race.elapsed||a.id.localeCompare(b.id);
   if(a.dnf!==b.dnf)return a.dnf?1:-1;
   return raceProgress({...b,color:''})-raceProgress({...a,color:''})||a.id.localeCompare(b.id);
  }).map(p=>p.id);
  const players:NetPlayer[]=entries.map(p=>({id:p.id,name:p.name,kart:p.kart,ready:p.ready,connected:p.connected,dnf:p.dnf,vehicle:Object.fromEntries(vehicleKeys.map(k=>[k,p.vehicle[k]])) as NetPlayer['vehicle'],race:{lap:p.race.lap,elapsed:p.race.elapsed,lapTime:p.race.lapTime,nextGate:p.race.nextGate,finished:p.race.finished,lapTimes:p.race.lapTimes,best:Number.isFinite(p.race.best)?p.race.best:null},coins:p.coins,collected:[...p.collected]}));
  return {trackId:this.trackId,code:this.code,host:this.host,phase:this.phase,countdown:this.countdown,round:this.round,players,order,tick:this.tick,props:this.obstacles.filter(o=>o.movable).map(o=>({x:o.x,z:o.z,tilt:o.object.rotation.z}))};
 }
}
