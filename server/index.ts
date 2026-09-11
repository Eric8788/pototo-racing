import {isTrackId} from '../src/tracks';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomInt,randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {WebSocketServer,WebSocket} from 'ws';
import {Room} from './room';
import {KART_IDS,type ClientMessage,type ServerMessage} from '../src/net-protocol';
import type {KartId} from '../src/kart-models';

const port=Number(process.env.PORT||4173),dist=resolve('dist');
const rooms=new Map<string,Room>();
const lanUrls=()=>Object.entries(networkInterfaces()).sort(([a],[b])=>Number(b==='en0')-Number(a==='en0')).flatMap(([,list])=>(list||[]).filter(n=>n.family==='IPv4'&&!n.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n=>`http://${n.address}:${port}`));
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.ttf':'font/ttf','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size,maxPlayers:4,lanUrls:lanUrls()}));return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const path=resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
  const info=await stat(path);if(!info.isFile())throw Error('Not a file');
  const ext=extname(path),cache=/\/assets\/[^/]+-[\w-]{8}\.(js|css)$/.test(pathname)?'public, max-age=31536000, immutable':'no-cache';
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Content-Length':info.size,'Cache-Control':cache});
  res.end(req.method==='HEAD'?undefined:await readFile(path));
 }catch{res.writeHead(404);res.end('Not found');}
});
interface Peer {id:string;ws:WebSocket;room?:Room;alive:boolean;count:number;window:number;}
const peers=new Map<string,Peer>();
const send=(p:Peer,m:ServerMessage)=>{if(p.ws.readyState===WebSocket.OPEN&&p.ws.bufferedAmount<256000)p.ws.send(JSON.stringify(m));};
const broadcast=(room:Room)=>{const state=room.snapshot();for(const p of peers.values())if(p.room===room)send(p,{type:'state',state});};
function leave(p:Peer){if(!p.room)return;const room=p.room;p.room=undefined;room.leave(p.id);if(![...room.players.values()].some(d=>d.connected))rooms.delete(room.code);else broadcast(room);}
const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096});
wss.on('connection',ws=>{
 if(peers.size>=64){ws.close(1013,'Server full');return;}
 const p:Peer={id:randomUUID(),ws,alive:true,count:0,window:Date.now()};peers.set(p.id,p);send(p,{type:'welcome',id:p.id});
 ws.on('pong',()=>{p.alive=true;});
 ws.on('message',raw=>{
  try{
   const now=Date.now();if(now-p.window>1000){p.count=0;p.window=now;}if(++p.count>120){ws.close(1008,'Too many messages');return;}
   const m=JSON.parse(raw.toString()) as ClientMessage;if(!m||typeof m!=='object')return;
   if(m.type==='ping'){if(Number.isFinite(m.at))send(p,{type:'pong',at:m.at});return;}
   if(m.type==='leave'){leave(p);send(p,{type:'left'});return;}
   if(m.type==='create'||m.type==='join'){
    if(p.room)throw Error('请先退出当前房间。');
    const name=typeof m.name==='string'?m.name.replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,12):'';
    const kart=KART_IDS.includes(m.kart)?m.kart:'potato';
    let room:Room|undefined;
    if(m.type==='create'){
     if(rooms.size>=12)throw Error('房间数量已满，请稍后再试。');
     let code='';do{code=String(randomInt(100000,1000000));}while(rooms.has(code));room=new Room(code,p.id,isTrackId(m.trackId)?m.trackId:'potato');
    }else{room=rooms.get(String(m.code).trim());if(!room)throw Error('找不到这个房间，请检查 6 位房间码。');}
    room.add(p.id,name||'无名小瓜',kart as KartId);rooms.set(room.code,room);p.room=room;broadcast(room);return;
   }
   const room=p.room,driver=room?.players.get(p.id);if(!room||!driver)return;
   if(m.type==='input'){
    const i=m.input;if(!i||!Number.isFinite(i.throttle)||!Number.isFinite(i.steer))return;
    room.setInput(driver,{throttle:Math.max(-1,Math.min(1,i.throttle)),steer:Math.max(-1,Math.min(1,i.steer)),brake:i.brake===true,boost:i.boost===true});return;
   }
   if(m.type==='ready'&&room.phase==='lobby')driver.ready=m.ready===true;
   else if(m.type==='kart'&&room.phase==='lobby'&&KART_IDS.includes(m.kart)){driver.kart=m.kart;driver.ready=false;}
   else if(m.type==='start')room.start(p.id);
   else if(m.type==='lobby')room.lobby(p.id);
   else if(m.type==='respawn')room.respawn(driver);
   broadcast(room);
  }catch(error){send(p,{type:'error',message:error instanceof Error?error.message:'消息无法处理。'});}
 });
 ws.on('close',()=>{leave(p);peers.delete(p.id);});ws.on('error',()=>ws.terminate());
});
// Fixed simulation clock; snapshots at 20 Hz. A bounded accumulator avoids huge jumps.
let previous=performance.now(),accumulator=0,steps=0;
const simulation=setInterval(()=>{const now=performance.now();accumulator+=Math.min(.25,(now-previous)/1000);previous=now;while(accumulator>=1/60){for(const room of rooms.values())room.step(1/60);accumulator-=1/60;if(++steps%3===0)for(const room of rooms.values())broadcast(room);}},16);
const heartbeat=setInterval(()=>{for(const p of peers.values()){if(!p.alive){p.ws.terminate();continue;}p.alive=false;p.ws.ping();}},10000);
server.listen(port,'0.0.0.0',()=>{console.log(`WOBBLE GP 联机服务器 http://localhost:${port}`);for(const list of Object.values(networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal&&!n.address.startsWith('198.18.'))console.log(`局域网 http://${n.address}:${port}`);});
function shutdown(){clearInterval(simulation);clearInterval(heartbeat);for(const p of peers.values())p.ws.close(1001,'Server shutting down');wss.close();server.close();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
