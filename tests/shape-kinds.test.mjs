// SPDX-License-Identifier: Apache-2.0
import { withoutPages } from "./import-fixture.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
const load=p=>import(new URL('../'+p,import.meta.url));
const registry=()=>load('packages/board-rules/src/objects/registry.ts');
const names=['Square','Circle','Rounded rectangle','Diamond','Triangle','Inverted triangle','Pentagon','Octagon','Star','Cross','Left arrow','Right arrow','Chevron','Speech bubble'];
test('SK-U1 fourteen kinds keep their order, names, placement tools and only two keys and Add choices',async()=>{
 const r=await registry(); assert.deepEqual(r.SHAPE_KINDS.map(k=>k.name),names);
 for(const k of r.SHAPE_KINDS){assert.equal(r.kindForTool(k.tool),k.kind);assert.equal(r.placementTool(k.tool),r.shape);assert.equal(r.labelPrefix({type:'shape',shape:k.kind}),k.name.toLowerCase());assert.equal(k.validFrom,k.key?6:12);if(k.key)assert.equal(r.toolForKey(k.key),k.tool);}
 assert.deepEqual(r.ADD_OPTIONS.map(o=>o.label),['sticky','text','square','circle','section']);assert.equal(r.toolForKey('w'),undefined);
});
test('SK-U2 each new kind is accepted only from schema 12, older square and circle unchanged',async()=>{
 const r=await registry(),{add,empty,validate}=await load('packages/board-rules/src/document.ts'),b=add({...empty(),title:'Shapes'},'shape',0,0);
 for(const k of r.SHAPE_KINDS) for(let version=6;version<=12;version++) {const check=()=>validate({...withoutPages(b),schemaVersion:version,objects:[{...withoutPages(b).objects[0],shape:k.kind}]});if(version>=k.validFrom)assert.doesNotThrow(check);else assert.throws(check);}
 assert.throws(()=>validate({...b,objects:[{...b.objects[0],shape:'hexagon'}]}));
});
test('SK-U3 all polygon outlines have the contracted vertices including the star centre',async()=>{
 const {SHAPE_KINDS}=await registry(); const outlines=[null,null,null,[[.5,0],[1,.5],[.5,1],[0,.5]],[[.5,0],[1,1],[0,1]],[[0,0],[1,0],[.5,1]],[[.5,0],[1,.38],[.81,1],[.19,1],[0,.38]],[[.29,0],[.71,0],[1,.29],[1,.71],[.71,1],[.29,1],[0,.71],[0,.29]],Array.from({length:10},(_,i)=>[.5+Math.cos(-Math.PI/2+i*Math.PI/5)*(i%2?.2:.5),.54+Math.sin(-Math.PI/2+i*Math.PI/5)*(i%2?.2:.5)]),[[.33,0],[.67,0],[.67,.33],[1,.33],[1,.67],[.67,.67],[.67,1],[.33,1],[.33,.67],[0,.67],[0,.33],[.33,.33]],[[0,.5],[.4,0],[.4,.28],[1,.28],[1,.72],[.4,.72],[.4,1]],[[1,.5],[.6,0],[.6,.28],[0,.28],[0,.72],[.6,.72],[.6,1]],[[0,0],[.7,0],[1,.5],[.7,1],[0,1],[.3,.5]],[[0,0],[1,0],[1,.78],[.4,.78],[.2,1],[.2,.78],[0,.78]]];
 assert.deepEqual(SHAPE_KINDS.slice(0,3).map(k=>k.outline),['rounded','round','rounded']);for(let i=3;i<14;i++)assert.deepEqual(SHAPE_KINDS[i].outline,outlines[i],names[i]);
});
test('SK-U4 each text box and fractional Grow use its contracted spans',async()=>{
 const {SHAPE_KINDS,shapeTextBox,fitHeight,shapeTextLayout}=await registry(); const fractions=[null,null,null,[.25,.75,.25,.75],[.25,.75,.45,.92],[.25,.75,.08,.55],[.18,.82,.32,.92],[.14,.86,.14,.86],[.32,.68,.38,.72],[.06,.94,.35,.65],[.4,.96,.3,.7],[.04,.6,.3,.7],[.32,.72,.1,.9],[.05,.95,.06,.74]];
 for(let i=0;i<14;i++){const o={x:10,y:20,width:180,height:180,shape:SHAPE_KINDS[i].kind,text:'Two lines\nof text',textSize:'small'},f=fractions[i],box=shapeTextBox(o);if(f){for(const [key,want] of Object.entries({x:10+180*f[0],y:20+180*f[2],width:180*(f[1]-f[0]),height:180*(f[3]-f[2])}))assert(Math.abs(box[key]-want)<1e-9);}
 const layout=()=>Array.from({length:9},()=>({width:10,pieces:[{text:'x',style:{},x:0,width:10}]})),height=fitHeight(o,layout,()=>10);assert(shapeTextLayout({...o,height},layout,()=>10).fits);if(f){assert(Number.isInteger(height));assert(!shapeTextLayout({...o,height:height-1},layout,()=>10).fits);}}
});
test('SK-U5 straight and curved connector ends clip each outline and vertex normals are finite',async()=>{
 const r=await registry(),{connectorLayout,sideMidpoints}=await load('apps/web/src/connectors.ts');
 for(const k of r.SHAPE_KINDS){const o={type:'shape',shape:k.kind,x:0,y:0,width:180,height:180},other={...o,x:400,y:120};const end=r.outlinePoint(o,{x:490,y:210});assert(Number.isFinite(end.normal.x));assert(Math.abs(Math.hypot(end.normal.x,end.normal.y)-1)<1e-8);
 const objects=new Map([['a',{...o,id:'a'}],['b',{...other,id:'b'}]]),line={type:'connector',from:{object:'a',anchor:'right'},to:{object:'b',anchor:'left'},text:'',...r.defaultConnectorStyle(),lineShape:'straight'};
 const layout=connectorLayout(line,objects,()=>0);assert(Math.hypot(layout.from.x-end.point.x,layout.from.y-end.point.y)<1e-8,k.kind);
 const curved=connectorLayout({...line,lineShape:'curved'},objects,()=>0),mid=sideMidpoints(o).find(p=>p.side==='right'),clipped=r.outlinePoint(o,mid);assert(Math.hypot(curved.from.x-clipped.point.x,curved.from.y-clipped.point.y)<1e-8,k.kind);
 }
 const diamond=r.outlinePoint({type:'shape',shape:'diamond',x:0,y:0,width:180,height:180},{x:500,y:90});assert.deepEqual(diamond.point,{x:180,y:90});assert(Math.abs(diamond.normal.x-1)<1e-10);assert(Math.abs(diamond.normal.y)<1e-10);
});
