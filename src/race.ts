import {nearestTrack} from './track';
export class Race {
 lap=1;totalLaps=3;elapsed=0;lapTime=0;nextGate=1;finished=false;lastProgress=.01;best=Infinity;lapTimes:number[]=[];
 constructor(private persistBest=true){if(persistBest)try{const n=Number(localStorage.getItem('wobble-gp:best'));if(n>0)this.best=n;}catch{/* Private browsers can refuse storage. */}}
 reset(){this.lap=1;this.elapsed=0;this.lapTime=0;this.nextGate=1;this.finished=false;this.lastProgress=.01;this.lapTimes=[];}
 step(x:number,z:number,dt:number){
  if(this.finished)return '';
  this.elapsed+=dt;this.lapTime+=dt;
  const {progress:p,distance}=nearestTrack(x,z);let event:''|'lap'|'finish'='';
  if(distance<7.2){
   if(this.nextGate<8&&p>=this.nextGate/8&&p<this.nextGate/8+.055){this.nextGate++;}
   // Finish gate is deliberately forgiving on tight custom courses: once the final
   // checkpoint is reached, crossing the start sector counts even if a frame
   // skips over the exact .94 -> .06 seam.
   if(this.nextGate>=7&&this.lastProgress>.82&&p<.10){
    this.nextGate=8;
    this.lapTimes.push(this.lapTime);
    if(this.lapTime<this.best){this.best=this.lapTime;if(this.persistBest)try{localStorage.setItem('wobble-gp:best',String(this.best));}catch{}}
    this.lapTime=0;this.nextGate=1;
    if(this.lap>=this.totalLaps){this.finished=true;event='finish';}else{this.lap++;event='lap';}
   }
  }
  this.lastProgress=p;return event;
 }
 respawnProgress(){return ((this.nextGate-1)/8+.012)%1;}
}
export function formatTime(seconds:number){if(!Number.isFinite(seconds))return '—:—.—';const min=Math.floor(seconds/60),s=seconds%60;return `${String(min).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}`;}
