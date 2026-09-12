export type MusicScene='menu'|'race';
// Original scores synthesized locally, with separate buses for scene crossfades.
class GameAudio {
 context?:AudioContext;
 output?:GainNode;
 private buses?:Record<MusicScene,GainNode>;
 private noise?:AudioBuffer;
 private timer?:ReturnType<typeof setInterval>;
 private next=0;
 private beat=0;
 private scene:MusicScene='menu';
 muted=false;
 get musicScene(){return this.scene;}
 constructor(){
  try{this.muted=localStorage.getItem('wobble-gp:muted')==='true';}catch{}
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden)void this.context?.suspend().catch(()=>{});
   else void this.unlock();
  });
 }
 async unlock(){
  try{
   if(!this.context){
    const c=this.context=new AudioContext();
    this.output=c.createGain();this.output.gain.value=this.muted?0:.7;this.output.connect(c.destination);
    this.buses={menu:c.createGain(),race:c.createGain()};
    for(const name of ['menu','race'] as const){this.buses[name].gain.value=name===this.scene?.32:0;this.buses[name].connect(this.output);}
    this.noise=c.createBuffer(1,c.sampleRate*.3,c.sampleRate);
    const data=this.noise.getChannelData(0);let seed=771;
    for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
    this.next=c.currentTime+.04;
    this.timer=setInterval(()=>this.schedule(),80);
   }
   if(!document.hidden)await this.context.resume();
   this.schedule();
  }catch{/* Browsers retry audio unlock on the next trusted gesture. */}
 }
 setScene(scene:MusicScene){
  if(this.scene===scene)return;
  this.scene=scene;this.beat=0;
  if(!this.context||!this.buses)return;
  const now=this.context.currentTime;this.next=now+.03;
  for(const name of ['menu','race'] as const){
   const gain=this.buses[name].gain;
   gain.cancelAndHoldAtTime(now);gain.linearRampToValueAtTime(name===scene?.32:0,now+.45);
  }
  this.schedule();
 }
 toggle(){
  this.muted=!this.muted;try{localStorage.setItem('wobble-gp:muted',String(this.muted));}catch{}
  void this.unlock();
  if(this.context&&this.output)this.output.gain.setTargetAtTime(this.muted?0:.7,this.context.currentTime,.04);
  window.dispatchEvent(new Event('wobble-audio-change'));
 }
 private note(midi:number,time:number,length:number,volume:number,type:OscillatorType='triangle'){
  const c=this.context!,o=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter();
  o.type=type;o.frequency.value=440*2**((midi-69)/12);
  filter.type='lowpass';filter.frequency.value=type==='sawtooth'?1400:4800;
  g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.008);
  g.gain.exponentialRampToValueAtTime(.0001,time+length);
  o.connect(filter).connect(g).connect(this.buses![this.scene]);o.start(time);o.stop(time+length+.02);
  o.onended=()=>{o.disconnect();filter.disconnect();g.disconnect();};
 }
 private drum(kind:'kick'|'snare'|'hat',time:number,volume:number){
  const c=this.context!,g=c.createGain();g.connect(this.buses!.race);
  const length=kind==='kick'?.19:kind==='snare'?.14:.045;
  g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+length);
  if(kind==='kick'){
   const o=c.createOscillator();o.frequency.setValueAtTime(145,time);o.frequency.exponentialRampToValueAtTime(43,time+.13);
   o.connect(g);o.start(time);o.stop(time+length);o.onended=()=>{o.disconnect();g.disconnect();};
  }else{
   const s=c.createBufferSource(),f=c.createBiquadFilter();s.buffer=this.noise!;
   f.type='highpass';f.frequency.value=kind==='hat'?7000:1500;
   s.connect(f).connect(g);s.start(time);s.stop(time+length);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
 }
 private schedule(){
  const c=this.context;if(!c||c.state!=='running'||document.hidden)return;
  const racing=this.scene==='race',step=60/(racing?148:104)/2;
  if(this.next<c.currentTime)this.next=c.currentTime+.025;
  const melody=racing
   ?[76,0,79,81,83,81,79,76,74,76,79,0,74,76,79,83,81,0,84,83,81,79,76,79,77,81,79,77,76,74,71,74]
   :[76,79,81,79,76,0,74,72,74,76,79,76,74,0,71,74,72,76,79,81,79,76,72,0,74,77,76,74,72,0,67,71];
  const roots=racing?[45,41,48,43]:[48,43,45,41];
  while(this.next<c.currentTime+.16){
   const i=this.beat%64,bar=Math.floor(i/8),root=roots[bar%4];
   if(!this.muted){
    const m=melody[i%32],t=this.next;if(m)this.note(m,t,racing?.14:.28,racing?.065:.075);
    if(racing){
     this.note(root+[0,12,0,7,0,12,7,12][i%8],t,.145,.10,'sawtooth');
     if(i%2===0)this.drum('kick',t,.30);
     if(i%8===2||i%8===6)this.drum('snare',t,.14);
     this.drum('hat',t,i%2?.045:.022);
     if(i%4===0)for(const n of [12,root===45?15:16,19])this.note(root+n,t,.18,.023,'sawtooth');
    }else{
     if(i%2===0)this.note(root+(i%8===4?7:0),t,.36,.12,'sine');
     if(i%8===0)for(const n of [12,root===45?15:16,19])this.note(root+n,t,.8,.026);
     if(i%4===3)this.note(88,t,.04,.016,'triangle');
    }
   }
   this.beat++;this.next+=step;
  }
 }
}
export const gameAudio=new GameAudio();
