// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
const load = (p) => import(new URL('../' + p, import.meta.url));
const registry = () => load('packages/board-rules/src/objects/registry.ts');
const rules = () => load('packages/board-rules/src/document.ts');
const tape = () => load('apps/web/src/tape.ts');
async function sample() {
  const { empty } = await rules(), { makeTape } = await tape();
  const b = { ...empty(), title: 'Tape check' };
  return { ...b, objects: [makeTape(b, { x: 0, y: 0 }, { x: 160, y: 0 }, 'stripes')] };
}
test('TP-U1 tape record, patterns, predicates and exact saved keys', async () => {
  const r = await registry(), t = r.objectType('tape');
  assert.equal(r.OBJECT_TYPES.at(-1), t);
  assert.deepEqual([t.tool, t.validFrom, t.body, t.points, t.text, t.ends, t.container, t.richText, t.voting, t.shapePaint, t.growsWithText],
    [null, 12, 'tape-body', false, false, false, false, false, false, false, false]);
  assert.deepEqual(t.kinds, []); assert.deepEqual(t.extraKeys, ['pattern', 'points']);
  assert.deepEqual(t.sizeRange, { min: 28, max: 2028 }); assert.equal(t.labelPrefix({}), 'washi tape'); assert.equal(t.contextLabel({}), 'Washi tape');
  assert.deepEqual(r.TAPE_PATTERNS.map(p => [p.value, p.name]), [['stripes','Stripes'],['dots','Dots'],['grid','Grid'],['zigzag','Zigzag'],['checks','Checks'],['kraft','Kraft']]);
  assert(r.isTape({ type: 'tape' })); assert(!r.hasPoints({ type: 'tape' })); assert(!r.eligibleIdea({ type: 'tape' })); assert(!r.eligibleVote({ type: 'tape' })); assert(r.sectionIdea({ type: 'tape' }));
  const b = await sample(), { canonical } = await rules();
  assert.deepEqual(Object.keys(JSON.parse(canonical(b)).objects[0]), ['id','generation','type','pattern','group','section','x','y','width','height','points','order']);
  assert.deepEqual(r.objectKeys('tape', 12), t.savedKeys);
});
test('TP-U2 every tape rule and older-version gate refuses without repair', async () => {
  const { validate, canonical } = await rules(), b = await sample(), o = b.objects[0];
  const bad = [{ points: [...o.points, [20,14]] }, { points: [[14,14],[29,14]], width:43 }, { points: [[14,14],[2015,14]], width:2029 },
    { pattern:'plaid' }, { color:'red' }, { points:[[13,14],[174,14]] }, { points:[[14,14],[175,14]] }, { points:[[14,14],[174,15]] }, { points:[[14,14],[174.5,14]] }, { width:188.5 }, { points:[[14,14]] }, { points:[[14,14],[-1,14]] }];
  for (const change of bad) assert.throws(() => canonical({ ...b, objects:[{...o,...change}] }), JSON.stringify(change));
  for (const key of Object.keys(o)) { const broken = {...o}; delete broken[key]; assert.throws(() => validate({...b,objects:[broken]}), key); }
  for(let v=1;v<=11;v++) assert.throws(() => validate({...b,schemaVersion:v}));
  for(const p of (await registry()).TAPE_PATTERNS) assert.doesNotThrow(() => canonical({...b,objects:[{...o,pattern:p.value}]}));
});
test('TP-U3 click, whole units, direction and both length clamps remain valid', async () => {
  const { tapeGeometry, clickTape } = await tape(), { validate } = await rules(), b = await sample();
  assert.deepEqual(clickTape({x:100,y:200}), {x:6,y:186,width:188,height:28,points:[[14,14],[174,14]]});
  for(const length of [0,5,16,16.2,200,1999.9,2000,9000]) for(let deg=0;deg<360;deg+=7) {
    const rad=deg*Math.PI/180, g=tapeGeometry({x:-.5,y:-.5},{x:-.5+length*Math.cos(rad),y:-.5+length*Math.sin(rad)});
    const d=Math.hypot(g.points[1][0]-g.points[0][0],g.points[1][1]-g.points[0][1]); assert(d>=16&&d<=2000);
    assert.doesNotThrow(() => validate({...b,objects:[{...b.objects[0],...g}]}));
  }
});
test('TP-U4 end moves keep the other absolute end and pattern, clamp and undo', async () => {
  const { moveTapeEnd, tapeEnds } = await tape(), b = await sample(), o=b.objects[0];
  for(const end of [0,1]) { const fixed=tapeEnds(o)[1-end], moved=moveTapeEnd(o,end,{x:fixed.x+3,y:fixed.y+4});
    assert.deepEqual(tapeEnds(moved)[1-end],fixed); assert.equal(moved.pattern,o.pattern); assert(Math.hypot(moved.points[1][0]-moved.points[0][0],moved.points[1][1]-moved.points[0][1])>=16);
  }
  const {validate}=await rules();
  const fractional={...o,x:999700.4,y:-.3};const moved=moveTapeEnd(fractional,1,{x:1e6,y:0});
  assert.deepEqual(tapeEnds(moved)[0],tapeEnds(fractional)[0]);assert.doesNotThrow(()=>validate({...b,objects:[moved]}));
  const { record, emptyHistory, undo } = await load('apps/web/src/history.ts'), { canonical } = await rules();
  const next={...b,objects:[moveTapeEnd(o,1,{x:300,y:90})]}; assert.equal(canonical(undo(next,record(emptyHistory(),b,next)).board),canonical(b));
});
test('TP-U5 torn band, rotated outline, end handles and band hit tolerance', async () => {
  const { bandPolygon, tapeHit, tapeOutline, tapeEnds, tapeInBox } = await tape(), o=(await sample()).objects[0];
  const p=bandPolygon(160); assert.equal(p.length,14); assert.deepEqual(p.slice(0,3),[{x:0,y:-14},{x:3,y:-14+28/6},{x:0,y:-14+56/6}]); assert.deepEqual(p[7],{x:160,y:14});
  assert(tapeHit(o,{x:80,y:18},1)); assert(!tapeHit(o,{x:80,y:18.01},1)); assert(tapeHit(o,{x:80,y:16},2)); assert(!tapeHit(o,{x:80,y:16.01},2));
  assert.deepEqual(tapeEnds(o),[{x:0,y:0},{x:160,y:0}]); assert.deepEqual(tapeOutline(o,1),[{x:-4,y:-18},{x:164,y:-18},{x:164,y:18},{x:-4,y:18}]);
  assert(tapeInBox(o,o)); assert(!tapeInBox(o,{...o,width:o.width-1}));
  const {tapeGeometry}=await tape(), diagonal={...o,...tapeGeometry({x:0,y:0},{x:100,y:100})}; assert(!tapeHit(diagonal,{x:0,y:100},1)); assert(tapeHit(diagonal,{x:50,y:50},1));
});
test('TP-U6 tape hit and full box selection are separate from stroke ink and erasure', async () => {
  const {hitObject,selectInBox}=await load('apps/web/src/connectors.ts'), {erasedStrokes,makeStroke}=await load('apps/web/src/strokes.ts');
  const b=await sample(),o=b.objects[0], displayed=[{...o,displayHeight:o.height}];
  assert.equal(hitObject(displayed,{x:80,y:0},1)?.id,o.id); assert.equal(hitObject(displayed,{x:-13,y:13},1),undefined);
  assert.deepEqual(selectInBox({x:o.x,y:o.y},{x:o.x+o.width,y:o.y+o.height},displayed),[o.id]); assert.deepEqual(selectInBox({x:50,y:-10},{x:90,y:10},displayed),[]);
  const stroke=makeStroke(b,[{x:80,y:-30},{x:80,y:30}],{kind:'marker',color:'black',weight:'thin'},true);
  assert.deepEqual(erasedStrokes([o,stroke],[{x:0,y:0},{x:160,y:0}],1).map(o=>o.id),[stroke.id]);
});
test('TP-U7 tape codec and adapter preserve pattern and atomic points', async () => {
  const {Adapter}=await load('packages/board-sync/src/document-adapter.ts'),{readBoard}=await load('packages/board-sync/src/codec.ts'),{canonical}=await rules(),b=await sample();
  const a=new Adapter(); try { a.set(b); assert.equal(canonical(readBoard(a.doc)),canonical(b)); const mapped=a.doc.getMap('objects').get(b.objects[0].id); assert.equal(mapped.get('pattern'),'stripes'); assert.deepEqual(mapped.get('points'),b.objects[0].points); assert(!mapped.has('style')); } finally {a.destroy();}
});
test('TP-U8 tape copies keep relative points and patterns, join groups/sections and name comments',async()=>{
 const {add}=await rules(),{placeObject,objectLabel}=await load('apps/web/src/sections.ts'),{groupObjects,ungroupObjects,groupNumbers}=await load('apps/web/src/group.ts'),{buildSnapshot,buildPaste}=await load('apps/web/src/clipboard.ts'),{nameObject}=await load('packages/board-sync/src/comments.ts');
 let b=await sample();b=add(b,'sticky',300,0);b=groupObjects(b,new Set(b.objects.map(o=>o.id)));assert.equal(b.objects[0].group,b.objects[1].group);b=ungroupObjects(b,new Set([b.objects[0].id]));assert.equal(b.objects[0].group,null);
 const displayed=b.objects.map(o=>({...o,displayHeight:o.height})),snapshot=buildSnapshot(b,new Set(b.objects.map(o=>o.id)),displayed),pasted=buildPaste(b,snapshot,{centerX:0,centerY:0,zoom:1,width:1280,height:800}).board,copy=pasted.objects.filter(o=>o.type==='tape').at(-1);
 assert.deepEqual(copy.points,b.objects[0].points);assert.equal(copy.pattern,b.objects[0].pattern);assert.notEqual(copy.id,b.objects[0].id);assert.equal(nameObject(copy).objectType,'washi tape');assert.match(objectLabel(b,b.objects[0],groupNumbers(b.objects)),/washi tape 1 · Stripes/);
 const section=add(b,'section',150,0).objects.at(-1);b=placeObject(b,section);assert.equal(b.objects.find(o=>o.type==='tape').section,section.id);
});
async function canvasHarness(board,tool='Washi tape',selected=new Set()) {
 const {build}=await import('esbuild'),reactURL=new URL('../node_modules/react/index.js',import.meta.url),{createElement}=await import(reactURL),{renderToStaticMarkup}=await import('react-dom/server');
 const output=await build({stdin:{contents:'export {useBoardDocument} from "./state/use-board-document.ts";export {useCanvasInput} from "./state/use-canvas-input.ts";export {useEditingCommands} from "./state/use-editing-commands.ts";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'ports',setup(b){b.onResolve({filter:/^(react(?:\/.*)?|yjs)$/},args=>({path:args.path==='react'?reactURL.href:new URL(args.path==='yjs'?'../node_modules/yjs/dist/yjs.mjs':'../node_modules/'+args.path+'.js',import.meta.url).href,external:true}));}}]});
 const hooks=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));let doc,canvas,commands;
 const render=fn=>renderToStaticMarkup(createElement(()=>{fn();return null;}));const events={tool,preview:board,message:''},capture=new Set(),surface={focus(){},getBoundingClientRect:()=>({left:0,top:0,right:1280,bottom:800}),setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)},drag={current:null};
 render(()=>{doc=hooks.useBoardDocument({readOnly:false,setStatus(){}});});doc.load(board);
 const state={readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false};
 const common={...doc,selected,select(){},scene:{current:surface},tool,setTool:value=>{events.tool=typeof value==='function'?value(events.tool):value;},readOnly:false,composing:false,busy:false,inline:false,textEditing:false,invalidObjectText:false,finishTextSession(){},setInline(){},setPanel(){},setMessage:value=>events.message=value,displayedObjects:board.objects.map(o=>({...o,displayHeight:o.height})),view:{x:0,y:0,z:1}};
 render(()=>{canvas=hooks.useCanvasInput({...common,drawing:{style:(()=>({marker:{kind:'marker',color:'black',weight:'thin'},highlighter:{kind:'highlighter',color:'yellow',weight:'thin'}}))(),pattern:'dots'},drag,setBoard:b=>events.preview=b,setBusy(){},size:{w:1280,h:800},trackPointer(){},spacePanRef:{current:false},setSpacePan(){},setSelectionBox(){},handlesVisible:false,handlePoints:[],edit(){},clearHistory(){}});commands=hooks.useEditingCommands({...common,selectionReason:'',commandReason:'',clipboardState:state,editingState:state,arrangementMembers:[],messageSequence:{current:0},alive:{current:true}});});
 const pointer=p=>({target:surface,currentTarget:surface,clientX:p.x+640,clientY:p.y+400,pointerId:1,button:0,isPrimary:true,preventDefault(){},stopPropagation(){}});
 return {doc,canvas,commands,events,drag,pointer,close:()=>doc.adapter.current.destroy()};
}
test('TP-U9 actual canvas click and drag create one tape step and cancel records none',async()=>{
 const {empty,canonical}=await rules();for(const drag of [false,true]){const h=await canvasHarness({...empty(),title:'Gesture'});try{
 h.canvas.pointerDown(h.pointer({x:0,y:0}));if(drag)h.canvas.pointerMove(h.pointer({x:200,y:73}));h.canvas.pointerUp(h.pointer(drag?{x:200,y:73}:{x:0,y:0}));
 const saved=h.doc.model.current.objects[0];assert.equal(saved.type,'tape');assert.equal(saved.pattern,'dots');assert.equal(h.doc.historyRef.current.past.length,1);assert.equal(h.events.tool,'Washi tape');assert.doesNotThrow(()=>canonical(h.doc.model.current));h.commands.command('Undo');assert.equal(h.doc.model.current.objects.length,0);
 h.canvas.pointerDown(h.pointer({x:0,y:0}));h.canvas.pointerCancel();assert.equal(h.doc.model.current.objects.length,0);
 }finally{h.close();}}
});
test('TP-U10 actual tape end drag commits once and Escape restores without an edit',async()=>{
 for(const cancel of [false,true]){const b=await sample(),o=b.objects[0],h=await canvasHarness(b,'Select',new Set([o.id]));try{
 h.canvas.pointerDown(h.pointer({x:160,y:0}));h.canvas.pointerMove(h.pointer({x:300,y:80}));assert.deepEqual(h.doc.model.current,b);if(cancel)h.canvas.sceneKeyDown({target:h.pointer({x:0,y:0}).target,currentTarget:h.pointer({x:0,y:0}).currentTarget,key:'Escape',preventDefault(){},stopPropagation(){}});else h.canvas.pointerUp(h.pointer({x:300,y:80}));
 assert.equal(h.doc.historyRef.current.past.length,cancel?0:1);assert.equal(h.doc.model.current.objects[0].id,o.id);if(cancel)assert.deepEqual(h.doc.model.current,b);else assert.deepEqual((await tape()).tapeEnds(h.doc.model.current.objects[0]),[{x:0,y:0},{x:300,y:80}]);
 }finally{h.close();}}
});
