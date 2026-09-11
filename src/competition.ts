import * as THREE from 'three';
import {CONTACT_RADIUS,CONTACT_AXLE} from './vehicle-dimensions';
import { Vehicle, type Control } from './vehicle';
import { Race } from './race';
import { frameAt, nearestTrack, trackLength, type Obstacle } from './track';

export type GameMode = 'race' | 'practice';
export interface Entrant {
 id: string;
 name: string;
 color: string;
 vehicle: Vehicle;
 race: Race;
}
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export class Rival implements Entrant {
 vehicle = new Vehicle();
 race = new Race(false);
 stuck = 0;
 recoveries = 0;
 padCooldown = 0;
 constructor(public id: string, public name: string, public color: string,
  public lane: number, public pace: number) {}

 reset(progress: number, lane: number) {
  this.race.reset();this.vehicle.reset(progress);
  const f = frameAt(progress);
  this.vehicle.x += f.normal.x * lane;this.vehicle.z += f.normal.z * lane;
  this.vehicle.boost = 1;this.vehicle.boostLocked = false;
  this.stuck = 0;this.recoveries = 0;this.padCooldown = 0;
 }

 control(traffic: Entrant[]): Control {
  const v = this.vehicle;
  const near = nearestTrack(v.x, v.z);
  const lookAhead = 4.2 + Math.abs(v.speed) * .32;
  const target = frameAt(near.progress + lookAhead / trackLength);
  let offset = this.lane;
  let targetSpeed = this.pace;
  for (const other of traffic) {
   if (other === this || other.race.finished) continue;
   const dx = other.vehicle.x-v.x, dz = other.vehicle.z-v.z;
   const ahead = dx*Math.sin(v.heading)+dz*Math.cos(v.heading);
   const side = dx*Math.cos(v.heading)-dz*Math.sin(v.heading);
   if (ahead > 0 && ahead < 8 && Math.abs(side)<2.5) {
    offset = THREE.MathUtils.clamp(this.lane+(side>0?2:-2),-3.1,3.1);
    if(ahead<4)targetSpeed=Math.min(targetSpeed,Math.max(7,other.vehicle.speed));
   }
  }
  target.position.addScaledVector(target.normal,offset);
  const angle = wrapAngle(Math.atan2(target.position.x-v.x,target.position.z-v.z)-v.heading);
  const curveTurn = Math.abs(wrapAngle(frameAt(near.progress+.055).heading-frameAt(near.progress).heading));
  targetSpeed *= THREE.MathUtils.clamp(1-curveTurn*.42,.55,1);
  const steer = THREE.MathUtils.clamp(-angle*2.4,-1,1);
  return {throttle:v.speed>targetSpeed+.7?0:1,steer,brake:v.speed>targetSpeed+4,
   boost:curveTurn<.14&&Math.abs(angle)<.1&&v.boost>.8&&near.distance<3};
 }

 step(dt: number, obstacles: Obstacle[], traffic: Entrant[], boostPads: number[]) {
  if (this.race.finished) return;
  this.padCooldown -= dt;
  const fell = this.vehicle.step(dt,this.control(traffic),obstacles);
  const near = nearestTrack(this.vehicle.x,this.vehicle.z);
  this.stuck = Math.abs(this.vehicle.speed)<2 || near.distance>9 ? this.stuck+dt : 0;
  if(fell || this.stuck>3) {
   this.vehicle.reset(this.race.respawnProgress());this.stuck=0;this.recoveries++;
  }
  if(this.padCooldown<=0 && near.distance<2.6 && boostPads.some(t=>Math.abs(t-near.progress)<.011)) {
   this.vehicle.padBoost=1.1;this.padCooldown=2;
  }
 }
}

export function raceProgress(entrant: Entrant) {
 const {race:r,vehicle:v}=entrant;
 if(r.finished)return r.totalLaps;
 const p=nearestTrack(v.x,v.z).progress;
 // Rank only within the next valid checkpoint interval; shortcuts earn no lead.
 const low=(r.nextGate-1)/8,high=r.nextGate/8;
 return r.lap-1+THREE.MathUtils.clamp(p,low,high);
}

export class Competition {
 mode: GameMode = 'race';
 rivals = [new Rival('peel','皮皮薯','#ef8164',-2.2,17),
  new Rival('bean','豆不急','#b7bd48',2.2,15.5),
  new Rival('turnip','萝卜头','#9b83ba',0,16.2)];
 player: Entrant;
 constructor(vehicle: Vehicle, race: Race) {
  this.player={id:'player',name:'你 · APEX 07',color:'#328c7b',vehicle,race};
 }
 get entrants(): Entrant[] { return this.mode==='race'?[this.player,...this.rivals]:[this.player]; }
 reset(mode: GameMode) {
  this.mode=mode;
  const p=this.player;p.race.reset();p.vehicle.reset(.011);p.vehicle.boost=1;p.vehicle.boostLocked=false;
  if(mode==='race') {
   const f=frameAt(.011);p.vehicle.x+=f.normal.x*2.3;p.vehicle.z+=f.normal.z*2.3;
  }
  this.rivals[0].reset(.011,-2.3);
  this.rivals[1].reset(.030,2.3);
  this.rivals[2].reset(.030,-2.3);
 }
 step(dt:number,obstacles:Obstacle[],boostPads:number[]) {
  if(this.mode==='practice')return;
  const entries=this.entrants;
  for(const rival of this.rivals)rival.step(dt,obstacles,entries,boostPads);
  resolveVehicleContacts(entries.filter(e=>!e.race.finished).map(e=>e.vehicle));
  for(const rival of this.rivals) {
   if(rival.race.step(rival.vehicle.x,rival.vehicle.z,dt)==='finish') {
    const parking=frameAt(.05+this.rivals.indexOf(rival)*.027);
    rival.vehicle.x=parking.position.x+parking.normal.x*8;
    rival.vehicle.z=parking.position.z+parking.normal.z*8;
    rival.vehicle.y=.025;rival.vehicle.heading=parking.heading;
    rival.vehicle.vx=rival.vehicle.vz=rival.vehicle.speed=0;
   }
  }
 }
 standings(): Entrant[] {
  return [...this.entrants].sort((a,b)=>{
   if(a.race.finished&&b.race.finished)return a.race.elapsed-b.race.elapsed || a.id.localeCompare(b.id);
   if(a.race.finished!==b.race.finished)return a.race.finished?-1:1;
   return raceProgress(b)-raceProgress(a) || a.id.localeCompare(b.id);
  });
 }
 get place() {return this.standings().findIndex(e=>e.id==='player')+1;}
}

// Two contact circles approximate each chassis, avoiding nose-to-tail overlap.
export function resolveVehicleContacts(vehicles: Vehicle[]) {
 for(let pass=0;pass<2;pass++)for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++) {
  const a=vehicles[i],b=vehicles[j];if(Math.abs(a.y-b.y)>1.05)continue;
  for(const da of [-CONTACT_AXLE,CONTACT_AXLE])for(const db of [-CONTACT_AXLE,CONTACT_AXLE]) {
   const dx=b.x+Math.sin(b.heading)*db-a.x-Math.sin(a.heading)*da;
   const dz=b.z+Math.cos(b.heading)*db-a.z-Math.cos(a.heading)*da;
   const distance=Math.hypot(dx,dz);if(distance>=CONTACT_RADIUS*2)continue;
   const nx=distance>1e-5?dx/distance:Math.cos(a.heading),nz=distance>1e-5?dz/distance:-Math.sin(a.heading);
   const overlap=(CONTACT_RADIUS*2-distance)*.5;a.x-=nx*overlap;a.z-=nz*overlap;b.x+=nx*overlap;b.z+=nz*overlap;
   const closing=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
   if(closing<0){const impulse=-closing*.58;a.vx-=nx*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vz+=nz*impulse;a.hit=b.hit=.18;}
  }
 }
}
