import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import type {RoomState,ServerMessage} from '../src/net-protocol';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('five independent sockets: room admission, sync, authority, disconnect and cleanup', {timeout:25000},async t=>{
 const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:'4181'},stdio:['ignore','pipe','pipe']});
 const sockets:WebSocket[]=[];t.after(()=>{sockets.forEach(s=>s.terminate());server.kill('SIGTERM');});
 await new Promise<void>((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('localhost:4181'))resolve();});server.stderr.on('data',d=>reject(Error(String(d))));server.on('exit',code=>{if(code)reject(Error('Server exit '+code));});});
 async function peer(){const ws=new WebSocket('ws://localhost:4181/ws');sockets.push(ws);const p={ws,id:'',state:undefined as RoomState|undefined,messages:[] as ServerMessage[]};ws.on('message',data=>{const m=JSON.parse(String(data));p.messages.push(m);if(m.type==='welcome')p.id=m.id;if(m.type==='state')p.state=m.state;});await wait(()=>!!p.id);return p;}
 async function wait(predicate:()=>boolean){for(let i=0;i<500;i++){if(predicate())return;await delay(10);}throw Error('Timed out');}
 const a=await peer(),b=await peer(),c=await peer(),d=await peer(),e=await peer();
 const send=(p:typeof a,m:unknown)=>p.ws.send(JSON.stringify(m));
 send(a,{type:'create',name:'土豆甲',kart:'potato'});await wait(()=>!!a.state);const code=a.state!.code;
 send(e,{type:'join',code:'000000',name:'wrong',kart:'ufo'});await wait(()=>e.messages.some(m=>m.type==='error'));assert.equal(e.state,undefined);
 for(const [p,name,kart] of [[b,'铅笔乙','pencil'],[c,'飞碟丙','ufo'],[d,'钢炮丁','apex']] as const)send(p,{type:'join',code,name,kart});
 await wait(()=>a.state?.players.length===4&&d.state?.players.length===4);
 send(e,{type:'join',code,name:'full',kart:'ufo'});await wait(()=>e.messages.filter(m=>m.type==='error').length===2);assert.equal(e.state,undefined);
 send(a,{type:'start'});await wait(()=>a.messages.some(m=>m.type==='error'));assert.equal(a.state!.phase,'lobby');
 for(const p of [a,b,c,d])send(p,{type:'ready',ready:true});await wait(()=>a.state!.players.every(p=>p.ready));
 send(b,{type:'start'});await wait(()=>b.messages.some(m=>m.type==='error'));assert.equal(a.state!.phase,'lobby');
 send(a,{type:'start'});await wait(()=>a.state!.phase==='countdown'&&b.state!.phase==='countdown');
 assert.equal(a.state!.round,b.state!.round);const before=a.state!.players.find(p=>p.id===a.id)!.vehicle;
 send(a,{type:'state',vehicle:{x:99999},race:{lap:3,finished:true}});await delay(100);assert.notEqual(a.state!.players[0].vehicle.x,99999);
 await wait(()=>a.state!.phase==='race');const input=setInterval(()=>send(a,{type:'input',input:{throttle:1,steer:0,brake:false,boost:false}}),30);await delay(1000);clearInterval(input);
 await wait(()=>b.state!.players.find(p=>p.id===a.id)!.vehicle.speed>5);
 const observed=b.state!.players.find(p=>p.id===a.id)!;assert.ok(Math.hypot(observed.vehicle.x-before.x,observed.vehicle.z-before.z)>3);assert.equal(observed.kart,'potato');
 // A player cannot pause the shared clock; stopping packets releases their throttle.
 const elapsed=b.state!.players[0].race.elapsed;await delay(1000);assert.ok(b.state!.players[0].race.elapsed>elapsed+.7);
 a.ws.close();await wait(()=>b.state!.host===b.id);assert.equal(b.state!.players.find(p=>p.id===a.id)!.dnf,true);
 for(const p of [b,c,d])send(p,{type:'leave'});await wait(()=>[b,c,d].every(p=>p.messages.some(m=>m.type==='left')));
 const health=await (await fetch('http://localhost:4181/health')).json() as {rooms:number};assert.equal(health.rooms,0);
});
