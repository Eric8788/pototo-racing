import {neutralInput,type ClientMessage,type ServerMessage,type RoomState} from './net-protocol';
import type {Control} from './vehicle';

export class Network {
 id='';state?:RoomState;latency=0;private socket?:WebSocket;private timer?:ReturnType<typeof setInterval>;private lastMessage=0;
 onState:(state:RoomState)=>void=()=>{};onError:(message:string)=>void=()=>{};onClose:()=>void=()=>{};
 input:()=>Control=neutralInput;
 async connect(){
  if(this.socket?.readyState===WebSocket.OPEN)return;
  this.disconnect();this.id='';
  await new Promise<void>((resolve,reject)=>{
   const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);this.socket=ws;
   const timeout=setTimeout(()=>{reject(Error('连接超时，请确认主机的联机服务正在运行。'));this.disconnect();},5000);
   ws.onmessage=e=>{
    const m=JSON.parse(e.data) as ServerMessage;this.lastMessage=performance.now();
    if(m.type==='welcome'){clearTimeout(timeout);this.id=m.id;resolve();}
    if(m.type==='state'){this.state=m.state;this.onState(m.state);}
    if(m.type==='error')this.onError(m.message);
    if(m.type==='pong')this.latency=Math.round(performance.now()-m.at);
   };
   ws.onerror=()=>{clearTimeout(timeout);reject(Error('无法连接联机服务。请使用主机提供的局域网地址。'));};
   ws.onclose=()=>{clearTimeout(timeout);if(this.socket!==ws)return;const wasInRoom=!!this.state;this.disconnect();reject(Error('服务器连接已断开。'));if(wasInRoom)this.onClose();};
  });
  let ticks=0;this.timer=setInterval(()=>{
   if(performance.now()-this.lastMessage>6000){this.disconnect();this.onClose();return;}
   if(this.state)this.send({type:'input',input:this.input()});
   if(++ticks%30===0)this.send({type:'ping',at:performance.now()});
  },1000/30);
 }
 send(m:ClientMessage){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(m));}
 disconnect(){if(this.timer)clearInterval(this.timer);this.timer=undefined;const s=this.socket;this.socket=undefined;this.state=undefined;if(s){s.onclose=null;s.close();}}
}
