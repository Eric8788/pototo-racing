import * as THREE from 'three';
import type { Rival } from './competition';
import {createKart,animateKart,KARTS,type KartId,type KartModel} from './kart-models';

export class RivalVisual {
 root=new THREE.Group();
 private models=new Map<KartId,KartModel>();
 private label:THREE.Sprite;
 model:KartModel;
 constructor(public rival:Rival,source:THREE.Object3D,scene:THREE.Scene) {
  for(const spec of KARTS){const m=createKart(spec.id,source);m.root.visible=false;this.root.add(m.root);this.models.set(spec.id,m);}
  this.model=this.models.get('apex')!;
  this.label=new THREE.Sprite(new THREE.SpriteMaterial({depthWrite:false}));this.label.position.y=2.3;this.label.scale.set(2.1,.66,1);this.root.add(this.label);scene.add(this.root);
 }
 select(id:KartId,name?:string){
  this.model.root.visible=false;this.model=this.models.get(id)!;this.model.root.visible=true;
  const spec=KARTS.find(k=>k.id===id)!;this.rival.color=spec.color;this.rival.name=name||spec.name;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=80;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=spec.color;ctx.beginPath();ctx.roundRect(4,4,312,72,22);ctx.fill();ctx.font='bold 35px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff9e9';ctx.fillText(this.rival.name,160,42,295);
  this.label.material.map?.dispose();const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;this.label.material.map=tex;this.label.material.needsUpdate=true;
 }
 update(dt:number,visible:boolean) {
  const v=this.rival.vehicle;this.root.visible=visible;this.root.position.set(v.x,v.y,v.z);this.root.rotation.y=v.heading;animateKart(this.model,v,dt);
 }
}
