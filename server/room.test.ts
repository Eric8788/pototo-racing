import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room} from './room';
import {Rival} from '../src/competition';
import {frameAt} from '../src/track';
import {neutralInput} from '../src/net-protocol';
function setup(){const r=new Room('123456','a');r.add('a','土豆','potato');r.add('b','铅笔','pencil');return r;}
function advance(r:Room,seconds:number){for(let i=0;i<seconds*60;i++)r.step(1/60);}
test('room capacity, readiness, authority and countdown',()=>{
 const r=setup();assert.throws(()=>r.start('a'));r.players.forEach(p=>p.ready=true);assert.throws(()=>r.start('b'));r.start('a');
 const a=r.players.get('a')!,x=a.vehicle.x;r.setInput(a,{...neutralInput(),throttle:1});advance(r,2);assert.equal(a.vehicle.x,x);assert.equal(a.race.elapsed,0);assert.throws(()=>r.add('c','晚到','ufo'));advance(r,1.1);assert.equal(r.phase,'race');
 const full=setup();full.add('c','飞碟','ufo');full.add('d','绿车','apex');assert.throws(()=>full.add('e','超员','potato'));
});
test('shared collisions, stale input release, independent coins, no checkpoint shortcuts',()=>{
 const r=setup();r.players.forEach(p=>p.ready=true);r.start('a');advance(r,3.1);
 const a=r.players.get('a')!,b=r.players.get('b')!;a.vehicle.x=b.vehicle.x=0;a.vehicle.z=30;b.vehicle.z=32.5;a.vehicle.heading=b.vehicle.heading=0;a.vehicle.vz=10;
 r.step(1/60);assert.ok(b.vehicle.vz>0);assert.ok(Math.hypot(a.vehicle.x-b.vehicle.x,a.vehicle.z-b.vehicle.z)>2.7);
 a.vehicle.reset(.1);b.vehicle.reset(.4);for(let i=0;i<60;i++){r.setInput(a,{...neutralInput(),throttle:1});r.step(1/60);}const speed=a.vehicle.speed;advance(r,3);assert.ok(a.vehicle.speed<speed/2,'stale input cannot leave throttle held');
 a.collected.add(5);assert.equal(b.collected.has(5),false);
 const f=frameAt(.97),start=frameAt(.01);a.vehicle.x=f.position.x;a.vehicle.z=f.position.z;r.step(1/60);a.vehicle.x=start.position.x;a.vehicle.z=start.position.z;r.step(1/60);assert.equal(a.race.lap,1);
});
test('real shared simulation finishes three laps and rematch resets all players',()=>{
 const r=setup();r.players.forEach(p=>p.ready=true);r.start('a');advance(r,3.1);
 const drivers=[...r.players.values()];const bots=drivers.map((p,i)=>{const b=new Rival(p.id,p.name,'#fff',i?2.2:-2.2,i?16:17);b.vehicle=p.vehicle;b.race=p.race;return b;});
 for(let i=0;i<120*60&&r.phase==='race';i++){bots.forEach((b,j)=>r.setInput(drivers[j],b.control(bots)));r.step(1/60);}
 assert.equal(r.phase,'results');assert.ok(drivers.every(p=>p.race.finished&&!p.dnf));assert.ok(drivers.every(p=>p.race.lapTimes.length===3));
 const times=drivers.map(p=>p.race.elapsed);advance(r,3);assert.deepEqual(drivers.map(p=>p.race.elapsed),times);assert.throws(()=>r.lobby('b'));r.lobby('a');assert.equal(r.phase,'lobby');assert.ok(drivers.every(p=>!p.ready));drivers.forEach(p=>p.ready=true);r.start('a');assert.equal(r.round,2);assert.ok(drivers.every(p=>p.race.elapsed===0&&p.coins===0&&p.vehicle.boost===1));
 console.log('Three-lap simulation times:',times);
});
test('disconnect migrates host, marks DNF, and race time limit closes round',()=>{
 const r=setup();r.players.forEach(p=>p.ready=true);r.start('a');r.leave('a');assert.equal(r.host,'b');assert.equal(r.players.get('a')!.dnf,true);advance(r,3.1);r.elapsed=599.99;r.step(1/60);assert.equal(r.phase,'results');r.lobby('b');assert.equal(r.players.size,1);assert.equal(r.players.get('b')!.ready,false);
});
