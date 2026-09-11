import * as THREE from 'three';
import {CONTACT_RADIUS} from './vehicle-dimensions';
import {frameAt,nearestTrack,groundHeight,TRACK_WIDTH,type Obstacle} from './track';
export interface Control {throttle:number;steer:number;brake:boolean;boost:boolean;}
export class Vehicle {
 x=0;z=0;y=.14;heading=0;vx=0;vz=0;vy=0;speed=0;steering=0;boost=1;boosting=false;drifting=false;offroad=false;airborne=false;hit=0;padBoost=0;boostLocked=false;lastGround=.13; traveled=0;
 constructor(){this.reset();}
 reset(progress=.01){const f=frameAt(progress);this.x=f.position.x;this.z=f.position.z;this.y=.14;this.heading=f.heading;this.vx=this.vz=this.vy=this.speed=this.steering=0;this.boosting=false;this.drifting=false;this.airborne=false;this.padBoost=0;this.lastGround=.13;}
 step(dt:number,input:Control,obstacles:Obstacle[]) {
  this.hit=Math.max(0,this.hit-dt);this.padBoost=Math.max(0,this.padBoost-dt);
  const nearest=nearestTrack(this.x,this.z);this.offroad=nearest.distance>TRACK_WIDTH/2;
  const oldSpeed=Math.hypot(this.vx,this.vz);
  if(this.boost<.03)this.boostLocked=true;
  if(!input.boost||this.boost>.25)this.boostLocked=false;
  this.boosting=(input.boost&&!this.boostLocked&&this.boost>.03&&input.throttle>0)||this.padBoost>0;
  this.boost=THREE.MathUtils.clamp(this.boost+(this.boosting&&this.padBoost<=0?-.25:.10)*dt,0,1);
  this.drifting=input.brake&&Math.abs(input.steer)>.1&&oldSpeed>5&&!this.airborne;
  this.steering=THREE.MathUtils.damp(this.steering,input.steer,9,dt);
  let fx=Math.sin(this.heading),fz=Math.cos(this.heading),sx=fz,sz=-fx;
  let longitudinal=this.vx*fx+this.vz*fz;
  let lateral=this.vx*sx+this.vz*sz;
  const maxSpeed=this.offroad?11:this.boosting?34:23;
  const acceleration=this.boosting?24:13;
  if(input.throttle>0)longitudinal+=acceleration*dt;
  if(input.throttle<0)longitudinal-= (longitudinal>1?25:9)*dt;
  const rolling=input.throttle===0?1.2:.22;
  longitudinal*=Math.exp(-rolling*dt);
  if(input.brake&&!this.drifting)longitudinal*=Math.exp(-3*dt);
  if(Math.abs(longitudinal)>maxSpeed)longitudinal=THREE.MathUtils.damp(longitudinal,Math.sign(longitudinal)*maxSpeed,4,dt);
  longitudinal=Math.max(-8,longitudinal);
  lateral*=Math.exp(-(this.drifting?1.2:this.offroad?4:8.5)*dt);
  const turnSpeed=THREE.MathUtils.clamp(Math.abs(longitudinal)/8,0,1);
  this.heading-=this.steering*turnSpeed*Math.sign(longitudinal||1)*(this.drifting?2.05:1.38)*(this.airborne?.35:1)*dt;
  // Reproject velocity onto the new heading; a little inertia keeps corners playful.
  const nfx=Math.sin(this.heading),nfz=Math.cos(this.heading);
  this.vx=longitudinal*(fx*.32+nfx*.68)+lateral*sx;
  this.vz=longitudinal*(fz*.32+nfz*.68)+lateral*sz;
  this.x+=this.vx*dt;this.z+=this.vz*dt;this.traveled+=Math.hypot(this.vx,this.vz)*dt;
  let ground=groundHeight(this.x,this.z);
  if(!this.airborne){
   if(this.lastGround-ground>.12&&oldSpeed>4){this.airborne=true;this.vy=Math.min(5,oldSpeed*.17);}
   else this.y=ground;
  }
  if(this.airborne){this.vy-=18*dt;this.y+=this.vy*dt;if(this.y<=ground){this.y=ground;this.vy=0;this.airborne=false;}}
  this.lastGround=ground;
  for(const ob of obstacles){
   const dx=this.x-ob.x,dz=this.z-ob.z,d=Math.hypot(dx,dz),min=ob.radius+CONTACT_RADIUS;
   if(d<min&&this.y<2){
    const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;
    this.x+=nx*(min-d);this.z+=nz*(min-d);
    const dot=this.vx*nx+this.vz*nz;
    if(dot<0){this.vx-=dot*nx*(ob.movable?.4:1.35);this.vz-=dot*nz*(ob.movable?.4:1.35);}
    if(ob.movable){ob.vx=(ob.vx||0)-nx*Math.max(3,oldSpeed)*.9;ob.vz=(ob.vz||0)-nz*Math.max(3,oldSpeed)*.9;}
    if(oldSpeed>3)this.hit=.3;
   }
  }
  this.speed=Math.hypot(this.vx,this.vz)*Math.sign(longitudinal||1);
  return (this.x/63)**2+(this.z/49)**2>1.06;
 }
}
