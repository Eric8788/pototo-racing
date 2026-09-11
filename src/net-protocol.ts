import type {TrackId} from './tracks';
import type {Control,Vehicle} from './vehicle';
import type {KartId} from './kart-models';
export const KART_IDS:KartId[]=['apex','potato','pencil','ufo'];
export const vehicleKeys=['x','y','z','heading','vx','vz','vy','speed','steering','boost','boosting','drifting','offroad','airborne','hit','padBoost','boostLocked','lastGround','traveled'] as const;
export type VehicleState=Pick<Vehicle,typeof vehicleKeys[number]>;
export interface RaceState {lap:number;elapsed:number;lapTime:number;nextGate:number;finished:boolean;lapTimes:number[];best:number|null;}
export interface NetPlayer {id:string;name:string;kart:KartId;ready:boolean;connected:boolean;dnf:boolean;vehicle:VehicleState;race:RaceState;coins:number;collected:number[];}
export interface RoomState {trackId:TrackId;code:string;host:string;phase:'lobby'|'countdown'|'race'|'results';countdown:number;round:number;players:NetPlayer[];order:string[];props:{x:number;z:number;tilt:number}[];tick:number;}
export type ClientMessage=
 | {type:'create';name:string;kart:KartId;trackId?:TrackId}
 | {type:'join';code:string;name:string;kart:KartId}
 | {type:'ready';ready:boolean}
 | {type:'kart';kart:KartId}
 | {type:'start'|'leave'|'lobby'|'respawn'}
 | {type:'input';input:Control}
 | {type:'ping';at:number};
export type ServerMessage={type:'welcome';id:string}|{type:'state';state:RoomState}|{type:'error';message:string}|{type:'pong';at:number}|{type:'left'};
export const neutralInput=():Control=>({throttle:0,steer:0,brake:false,boost:false});
