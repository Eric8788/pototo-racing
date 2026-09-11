import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room} from './room';
import {Rival,Competition} from '../src/competition';
import {Vehicle} from '../src/vehicle';
import {Race} from '../src/race';
import {TRACKS} from '../src/tracks';
import {setTrack,samples} from '../src/track';

test('distinct courses simulate simultaneously without mixing checkpoints or room scenery',()=>{
 const runs=TRACKS.map(t=>{
  const room=new Room(t.id,'a',t.id);room.add('a','甲','potato');room.add('b','乙','pencil');room.players.forEach(p=>p.ready=true);room.start('a');
  const drivers=[...room.players.values()];const bots=drivers.map((p,i)=>{const bot=new Rival(p.id,p.name,'#fff',i?2.2:-2.2,i?16:17);bot.vehicle=p.vehicle;bot.race=p.race;return bot;});
  return {room,drivers,bots};
 });
 const layouts=TRACKS.map(t=>{setTrack(t.id);return JSON.stringify(samples.map(p=>[p.x,p.z]));});assert.equal(new Set(layouts).size,3);
 for(let tick=0;tick<180*60;tick++){
  for(const {room,drivers,bots} of runs){setTrack(room.trackId);bots.forEach((bot,i)=>room.setInput(drivers[i],bot.control(bots)));room.step(1/60);assert.equal(room.snapshot().trackId,room.trackId);}
  if(runs.every(r=>r.room.phase==='results'))break;
 }
 for(const {room,drivers} of runs){assert.equal(room.phase,'results',room.trackId);assert.ok(drivers.every(p=>p.race.finished&&!p.dnf),room.trackId);assert.ok(drivers.every(p=>p.race.lapTimes.length===3));}
 setTrack('potato');
});

test('local AI finish after player, keep their actual times, and reset on rematch',()=>{
 setTrack('potato');const race=new Race(false),vehicle=new Vehicle(),competition=new Competition(vehicle,race);competition.reset('race');race.finished=true;race.elapsed=30;
 for(let i=0;i<120*60;i++)competition.step(1/60,[],[.08,.57,.85]);
 assert.ok(competition.rivals.every(r=>r.race.finished));assert.equal(race.elapsed,30);const times=competition.rivals.map(r=>r.race.elapsed);
 for(let i=0;i<60;i++)competition.step(1/60,[],[]);assert.deepEqual(competition.rivals.map(r=>r.race.elapsed),times);
 competition.reset('race');assert.ok(competition.entrants.every(e=>!e.race.finished&&e.race.elapsed===0));
});
