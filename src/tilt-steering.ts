// Screen-relative gravity avoids beta/gamma wrapping when a phone is held sideways.
export function screenTilt(beta:number|null,gamma:number|null,angle:number):number|null {
 if(beta===null||gamma===null||!Number.isFinite(beta)||!Number.isFinite(gamma))return null;
 const rad=Math.PI/180,b=beta*rad,g=gamma*rad,a=angle*rad;
 const x=Math.cos(b)*Math.sin(g),y=Math.sin(b);
 return Math.asin(Math.max(-1,Math.min(1,x*Math.cos(a)-y*Math.sin(a))))/rad;
}
export class TiltSteering {
 baseline=0;calibrated=false;private angle:number|undefined;private lastSample=-Infinity;
 private samples:{time:number;value:number}[]=[];private output=0;
 reset(){this.calibrated=false;this.samples=[];this.output=0;this.lastSample=-Infinity;}
 sample(beta:number|null,gamma:number|null,angle:number,time:number){
  const normalized=((angle%360)+360)%360;
  if(this.angle!==normalized){this.reset();this.angle=normalized;}
  const raw=screenTilt(beta,gamma,normalized);
  if(raw===null){this.reset();return;}
  if(time-this.lastSample>1000)this.reset();
  const dt=Math.max(0,Math.min(100,time-this.lastSample));this.lastSample=time;
  if(!this.calibrated){
   this.samples.push({time,value:raw});this.samples=this.samples.filter(s=>time-s.time<=850);
   const values=this.samples.map(s=>s.value);
   if(Math.max(...values)-Math.min(...values)>2){this.samples=[{time,value:raw}];return;}
   if(this.samples.length>=8&&time-this.samples[0].time>=600){this.baseline=values.reduce((a,b)=>a+b,0)/values.length;this.calibrated=true;}
   return;
  }
  const delta=raw-this.baseline;
  // A dead zone removes sensor noise. Large tilts clamp instead of freezing old input.
  const target=Math.abs(delta)<=3?0:Math.sign(delta)*Math.min(1,(Math.abs(delta)-3)/18);
  this.output=target===0?0:this.output+(target-this.output)*(1-Math.exp(-dt/65));
 }
 value(time:number){return this.calibrated&&time-this.lastSample<=1000?this.output:0;}
 fresh(time:number){return time-this.lastSample<=1000;}
}
