import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Blender fleet exports four complete assemblies with independent animation pivots',()=>{
 const file=readFileSync(new URL('../public/assets/fleet-final.glb',import.meta.url));
 assert.equal(file.toString('ascii',0,4),'glTF');
 const gltf=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
 const nodes=gltf.nodes as {name?:string;children?:number[];mesh?:number}[];
 const descendants=(i:number):number[]=>[i,...(nodes[i].children??[]).flatMap(descendants)];
 for(const id of ['potato','pencil','apex','ufo']){
  const index=nodes.findIndex(n=>n.name===`Fleet_${id}`);assert.notEqual(index,-1);
  const parts=descendants(index).map(i=>nodes[i]);
  const wheels=parts.filter(n=>n.name?.includes('__Wheel_'));
  assert.equal(wheels.length,id==='ufo'?0:4);
  assert.equal(parts.filter(n=>n.name?.includes('__Steer_F')).length,id==='ufo'?0:2);
  assert.equal(parts.filter(n=>n.name?.includes('__Expression_Eye_')).length,id==='ufo'?1:2);
  for(const w of wheels)assert.ok(w.children?.length,'Wheel needs tire and rim geometry');
  assert.ok(parts.some(n=>n.mesh!==undefined),'Assembly must contain its own body');
 }
 // The barrel, eraser, ferrule, wood and lead are material sections of ONE object.
 const pencil=nodes.find(n=>n.name?.startsWith('Pencil_continuous_body'))!;assert.ok(pencil);
 const parts=descendants(nodes.indexOf(pencil)).map(i=>nodes[i]).filter(n=>n.mesh!==undefined);
 assert.equal(parts.length,1);assert.equal(gltf.meshes[parts[0].mesh!].primitives.length,5);
});
