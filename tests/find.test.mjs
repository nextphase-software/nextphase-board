// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
const rules = () => import('../apps/web/src/find.ts');
const object = (id, type = 'sticky', text = 'launch', x = 0, y = 0, width = 100, displayHeight = 100) =>
  ({ id, type, text, x, y, width, height: displayHeight, displayHeight });
const ids = results => results.map(r => r.id);

test('F1-U1 searchable displayed types exclude empty text and hidden mind nodes', async () => {
  const { findResults } = await rules();
  const { hiddenIds } = await import('../apps/web/src/mind-map.ts');
  const objects = ['sticky', 'shape', 'text', 'section', 'connector', 'mindNode', 'stroke', 'tape', 'image'].map((type, i) => object(String(i), type));
  objects.push(object('empty', 'sticky', ''), { ...object('root', 'mindNode'), parent: null, collapsed: false },
    { ...object('branch', 'mindNode'), parent: 'root', collapsed: true }, { ...object('hidden', 'mindNode'), parent: 'branch', collapsed: false });
  const hidden = hiddenIds(objects);
  const results = findResults(objects.filter(o => !hidden.has(o.id)), 'launch');
  assert.deepEqual(new Set(ids(results)), new Set(['0','1','2','3','4','5','root','branch']));
  assert(hidden.has('hidden'));
});

test('F1-U2 matching trims query, normalizes NFC and case, and returns one result per object', async () => {
  const { findResults } = await rules();
  const objects = [object('a', 'sticky', 'CAFE\u0301 launch LAUNCH'), object('b', 'shape', 'unrelated')];
  assert.deepEqual(ids(findResults(objects, '  CAFÉ  ')), ['a']);
  assert.deepEqual(ids(findResults(objects, 'LAUNCH')), ['a']);
  for (const query of ['', '  ', 'zzz']) assert.deepEqual(findResults(objects, query), []);
});

test('F1-U3 boxes use displayed height, section band, connector label union and multiple-object union', async () => {
  const { objectBox, unionBoxes } = await rules();
  const note = { ...object('a'), height: 20, displayHeight: 150 };
  assert.deepEqual(objectBox(note), { x:0, y:0, width:100, height:150 });
  const section = objectBox(object('s','section','',40,-200,640,480));
  assert.deepEqual(section, { x:40, y:-226, width:640, height:506 });
  const connector = { ...object('c','connector','label',10,20,30,40), connectorLayout: { labelBox:{ x:-50,y:30,width:150,height:20 } } };
  assert.deepEqual(objectBox(connector), { x:-50,y:20,width:150,height:40 });
  assert.deepEqual(objectBox({...connector,text:''}), { x:10,y:20,width:30,height:40 });
  assert.deepEqual(unionBoxes([objectBox(note),section]), { x:0,y:-226,width:680,height:506 });
  assert.equal(unionBoxes([]), null);
});

test('F1-U4 results use reading-order bands with centre and id ties', async () => {
  const { findResults } = await rules();
  const objects = [object('z','text','launch',90,0,20,20),object('b','text','launch',0,5,20,20),
    object('a','text','launch',0,6,20,20),object('lone','text','launch',-100,90,20,20),object('deep','text','launch',-50,30,20,20)];
  assert.deepEqual(ids(findResults(objects,'launch')), ['a','b','z','deep','lone']);
});

test('F1-U5 query chooses first result and Next/Previous wrap, including no-current and empty states', async () => {
  const { findResults, queryCursor, stepResult } = await rules();
  const results = findResults([object('a'),object('b','text','launch',200),object('c','text','launch',400)],'launch');
  let cursor = queryCursor(results);
  assert.equal(cursor.current.id,'a');
  cursor=stepResult(results,cursor,-1); assert.equal(cursor.current.id,'c');
  cursor=stepResult(results,cursor,1); assert.equal(cursor.current.id,'a');
  cursor=stepResult(results,cursor,1); assert.equal(cursor.current.id,'b');
  assert.equal(stepResult(results,queryCursor([]),1).current.id,'a');
  assert.equal(stepResult(results,queryCursor([]),-1).current.id,'c');
  assert.deepEqual(stepResult([],cursor,1),cursor);
});

test('F1-U6 recomputation keeps current, remembers its latest box, removes without moving, and counts restoration', async () => {
  const { findResults, queryCursor, reconcileCursor, stepResult, findCounter, removedMessage } = await rules();
  const objects=[object('a'),object('b','text','launch',200),object('c','text','launch',400)];
  let results=findResults(objects,'launch'),cursor=stepResult(results,queryCursor(results),1);
  const moved=findResults(objects.map(o=>o.id==='b'?{...o,x:220}:o),'launch');
  cursor=reconcileCursor(moved,cursor); assert.equal(cursor.current.x,220);
  results=findResults(objects.filter(o=>o.id!=='b'),'launch'); cursor=reconcileCursor(results,cursor);
  assert.equal(cursor.current,null); assert.equal(cursor.removed.id,'b'); assert.equal(cursor.removed.x,220);
  assert.equal(findCounter('launch',results,cursor),'– of 2');
  assert.equal(removedMessage(results,cursor),'The result you were on was removed. Return goes to the next one.');
  assert.equal(stepResult(results,cursor,1).current.id,'c'); assert.equal(stepResult(results,cursor,-1).current.id,'a');
  const restored=findResults(objects,'launch'); cursor=reconcileCursor(restored,cursor);
  assert.equal(cursor.current,null); assert.equal(findCounter('launch',restored,cursor),'– of 3');
  for(const direction of [-1,1]) assert.equal(stepResult(restored,cursor,direction).current.id,'b');
  cursor=stepResult(results,cursor,1); cursor=reconcileCursor(restored,cursor);
  assert.equal(cursor.current.id,'c'); assert.equal(findCounter('launch',restored,cursor),'3 of 3');
  assert.equal(removedMessage(restored,cursor),'');
  const changed=findResults(objects.map(o=>o.id==='c'?{...o,text:'else'}:o),'launch');
  cursor=reconcileCursor(changed,cursor); assert.equal(cursor.current,null); assert.equal(cursor.removed.id,'c');
  assert.equal(stepResult(changed,cursor,1).current.id,'a');
  assert.equal(stepResult(changed,cursor,-1).current.id,'b');
});

test('F1-U7 removed place is reinserted into reading order, including bands and wrap', async () => {
  const { stepResult } = await rules();
  const result=(id,x,y,width=20,height=20)=>({id,x,y,width,height});
  // The removed tall box seeds a band; a simple y/x comparison gives the wrong answer.
  const removed=result('old',0,0,20,100),results=[result('right',50,40),result('left',-20,70),result('below',0,200)];
  const cursor={current:null,removed};
  assert.equal(stepResult(results,cursor,1).current.id,'right');
  assert.equal(stepResult(results,cursor,-1).current.id,'left');
  assert.equal(stepResult([result('a',0,0)],{current:null,removed:result('z',0,200)},1).current.id,'a');
});

test('F1-U8 counter and removed line distinguish empty, no results, current and removed', async () => {
  const { findResults, queryCursor, reconcileCursor, findCounter, removedMessage } = await rules();
  const results=findResults([object('a')],'launch'),cursor=queryCursor(results),removed=reconcileCursor([],cursor);
  assert.equal(findCounter('',[],queryCursor([])),''); assert.equal(findCounter('  ',[],queryCursor([])),'');
  assert.equal(findCounter('launch',[],removed),'No results'); assert.equal(removedMessage([],removed),'');
  assert.equal(findCounter('launch',results,cursor),'1 of 1'); assert.equal(removedMessage(results,cursor),'');
});

test('F1-U9 faded ids never include sections or matches, and selection or no results disables fading', async () => {
  const { findResults, fadedIds } = await rules();
  const objects=[object('a'),object('b','shape','other'),object('s','section','other'),object('image','image',''),object('stroke','stroke','')];
  const results=findResults(objects,'launch');
  assert.deepEqual([...fadedIds(objects,results,new Set())],['b','image','stroke']);
  assert.equal(fadedIds(objects,results,new Set(['a'])).size,0);
  assert.equal(fadedIds(objects,[],new Set()).size,0);
});

test('F1-U10 sections list uses reading order, trimmed names and Untitled section', async () => {
  const { sectionsList } = await rules();
  assert.deepEqual(sectionsList([object('b','section','  Retro zone ',400),object('note'),object('a','section','  ',0)]).map(({id,label})=>({id,label})),
    [{id:'a',label:'Untitled section'},{id:'b',label:'Retro zone'}]);
  assert.deepEqual(sectionsList([]),[]);
});

// Run the production hook and bar handlers with a small hook scheduler and measured
// DOM doubles. This starts no browser and exercises no saved-board or service path.
async function findHarness() {
  const { build } = await import('esbuild');
  const runtime = `let slots=[],cursor=0,pending=[],changed=false;
export const begin=()=>{cursor=0;pending=[];changed=false;};export const dirty=()=>changed;
export const flush=()=>pending.splice(0).forEach(fn=>fn());
export const dispose=()=>slots.forEach(s=>s?.cleanup?.());
export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i])){slots[i]=value;changed=true;}}];}
export function useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});}
export function useCallback(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,j)=>!Object.is(x,old.deps[j])))slots[i]={deps,fn};return slots[i].fn;}
export function useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,j)=>!Object.is(x,old.deps[j])))pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}`;
  const built=await build({stdin:{contents:'export {useFind} from "./state/use-find.ts"; export {FindBar} from "./ui/find-bar.tsx"; export {FindRings} from "./scene/find-rings.tsx"; export {begin,dirty,flush,dispose} from "test-react";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'hook-scheduler',setup(b){b.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'scheduler'}));b.onResolve({filter:/^(react|test-react)$/},()=>({path:'runtime',namespace:'scheduler'}));b.onLoad({filter:/.*/,namespace:'scheduler'},args=>({contents:args.path==='jsx'?`export const Fragment='fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`:runtime,loader:'js'}));}}]});
  const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64')+'#'+crypto.randomUUID());
  const original=Object.fromEntries(['document','navigator','Element','HTMLInputElement'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const listeners=new Map(),events={views:[],selections:[],finished:0,inline:[],focus:0,fieldFocus:0,fieldSelect:0,measures:0};
  class Element { closest(selector){return selector==='.find-bar'&&this.inBar?this:null;} }
  class Input extends Element { focus(){events.fieldFocus++;}select(){events.fieldSelect++;} }
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{platform:'MacIntel'}});
  globalThis.Element=Element;globalThis.HTMLInputElement=Input;
  const state={panelLeft:undefined,paletteTop:732};
  globalThis.document={addEventListener:(name,fn,capture)=>{assert.equal(capture,true);assert(!listeners.has(name));listeners.set(name,fn);},removeEventListener:(name,fn,capture)=>{assert.equal(listeners.get(name),fn);assert.equal(capture,true);listeners.delete(name);},
    querySelector:selector=>selector==='nav.palette'?{getBoundingClientRect(){events.measures++;return {top:state.paletteTop};}}:state.panelLeft===undefined?null:{getBoundingClientRect:()=>({left:state.panelLeft})}};
  const props={boardId:'board-a',displayedObjects:[object('a','sticky','launch',0,-390),object('b','sticky','launch',1140,-80),object('other','sticky','budget')],selected:new Set(),view:{x:0,y:0,z:1},size:{w:1280,h:800},scene:{current:{clientWidth:1280,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0}),focus(){events.focus++;}}},composing:false,busy:false,tidy:{open:false},finishTextSession(){events.finished++;},setInline:v=>events.inline.push(v),select:id=>events.selections.push(id),setView:next=>{props.view=typeof next==='function'?next(props.view):next;events.views.push(props.view);}};
  const h={props,state,events,listeners,Input,m,refresh(){for(let i=0;i<10;i++){m.begin();h.find=m.useFind(props);if(!m.dirty()){m.flush();return h.find;}m.flush();}throw Error('Find did not settle');},key(patch={}){const event={key:'f',metaKey:true,ctrlKey:false,altKey:false,isComposing:false,target:{},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...patch};listeners.get('keydown')(event);h.refresh();return event;},cleanup(){m.dispose();for(const[k,d]of Object.entries(original))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}};
  h.refresh();return h;
}

test('F1-U11 Find owner opens globally, guards composing/preview, measures each move, reconciles and closes without editing', async () => {
  await rules(); const h=await findHarness();
  try {
    const {props,events}=h,boardBefore=JSON.stringify(props.displayedObjects);
    assert.equal(h.listeners.size,1);assert.equal(h.find.open,false);
    props.composing=true;h.refresh();assert(h.key().prevented);assert.equal(h.find.open,false);
    props.composing=false;props.tidy.open=true;h.refresh();assert(h.key().prevented);assert.equal(h.find.open,false);
    props.tidy.open=false;h.refresh();assert(h.key({isComposing:true}).prevented);assert.equal(h.find.open,false);
    assert(!h.key({altKey:true}).prevented);assert(!h.key({metaKey:false,ctrlKey:true}).prevented);
    // Body, editor and panel targets all use the same document capture handler.
    for(const target of [{body:true},new h.Input(),{panel:true}]) {
      assert(h.key({target}).prevented);assert(h.find.open);h.find.close();h.refresh();
    }
    h.key(); const input=new h.Input();h.find.field(input);
    const fieldCallback=h.find.field;
    h.find.changeQuery('launch');h.refresh();assert.equal(h.find.field,fieldCallback);
    assert.equal(h.find.counter,'1 of 2');assert.equal(events.views.at(-1).y,-336);
    const moves=events.views.length,finished=events.finished;
    h.key();assert.equal(events.views.length,moves);assert.equal(events.finished,finished+1);
    assert.equal(events.fieldFocus,2);assert.equal(events.fieldSelect,2);
    h.find.step(1);h.refresh();assert.equal(h.find.counter,'2 of 2');assert.equal(props.view.x,1190);
    props.displayedObjects=props.displayedObjects.filter(o=>o.id!=='b');h.refresh();
    assert.equal(h.find.counter,'– of 1');assert(h.find.removed);assert.equal(events.views.length,moves+1);
    props.displayedObjects.push(object('b','sticky','launch',1140,-80));h.refresh();
    assert.equal(h.find.counter,'– of 2');assert.equal(h.find.cursor.current,null);
    h.find.step(-1);h.refresh();assert.equal(h.find.cursor.current.id,'b');
    h.find.close();h.refresh();assert.deepEqual(events.selections.at(-1),'b');assert(!h.find.open);assert.equal(h.find.faded.size,0);
    h.key();assert.equal(h.find.query,'launch');assert.equal(h.find.cursor.current.id,'a');
    h.find.changeQuery('zzz');h.refresh();h.find.close();h.refresh();assert.equal(events.selections.length,1);
    h.key();props.displayedObjects.push(object('s','section',' Retro ',40,-200,640,480));h.refresh();
    h.state.panelLeft=980;const selectedBefore=events.selections.length;
    h.find.fitSection('s');h.refresh();assert.equal(events.views.at(-1).z,560/506);assert.equal(events.selections.length,selectedBefore);
    const measure=events.measures;h.state.paletteTop=600;h.find.zoomToFit();h.refresh();assert.equal(events.measures,measure+1);
    const count=events.views.length;h.find.zoomToSelection();h.refresh();assert.equal(events.views.length,count);
    props.selected=new Set(['a']);h.refresh();h.find.zoomToSelection();h.refresh();assert.equal(props.view.z,2);
    h.find.changeQuery('launch');h.refresh();props.boardId='board-b';h.refresh();assert(!h.find.open);assert.equal(h.find.results.length,0);assert.equal(events.selections.length,selectedBefore);
    assert.equal(JSON.stringify(props.displayedObjects.slice(0,2)),JSON.stringify(JSON.parse(boardBefore).filter(o=>o.id!=='b')));
    assert.equal(h.listeners.size,1);
  } finally {h.cleanup();}
});

test('F1-U12 bar keys keep native editing, stop Escape/Return, and rings stay in screen coordinates', async () => {
  await rules();const h=await findHarness();
  try {
    h.key();h.find.changeQuery('launch');h.refresh();
    const tree=h.m.FindBar({find:h.find});
    const event=(key,target,patch={})=>({key,target,nativeEvent:{isComposing:false},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...patch});
    const native=event('z',new h.Input(),{metaKey:true});tree.props.onKeyDown(native);assert(!native.prevented);
    const next=event('Enter',new h.Input());tree.props.onKeyDown(next);h.refresh();assert(next.prevented&&next.stopped);assert.equal(h.find.cursor.current.id,'b');
    const previous=event('Enter',new h.Input(),{shiftKey:true});h.m.FindBar({find:h.find}).props.onKeyDown(previous);h.refresh();assert.equal(h.find.cursor.current.id,'a');
    const composing=event('Enter',new h.Input(),{nativeEvent:{isComposing:true}});h.m.FindBar({find:h.find}).props.onKeyDown(composing);assert(!composing.prevented);
    const rings=h.m.FindRings({find:h.find,pos:o=>({left:o.x,top:o.y}),zoom:.5}).props.children;
    assert.deepEqual(rings[0].props.style,{left:-5,top:-395,width:60,height:60});
    assert.equal(rings[0].props.className,'find-ring current');assert.equal(rings[1].props.style.width,58);
    const escape=event('Escape',{});h.m.FindBar({find:h.find}).props.onKeyDown(escape);h.refresh();assert(escape.prevented&&escape.stopped);assert.equal(h.find.open,false);assert.equal(h.events.selections.at(-1),'a');
  } finally {h.cleanup();}
});

test('F1-U13 hosted listeners each add only the find-bar guard to the baseline', async () => {
  await rules();
  const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process');
  for(const [file,variable] of [['team/reactions-layer.tsx','e'],['team/comments/layer.tsx','event'],['team/spotlight-layer.tsx','e'],['state/use-presence.ts','event']]) {
    const path='apps/web/src/'+file,source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    const guard=file==='team/comments/layer.tsx'?"      if (target.closest('.find-bar')) return;\n":`      if (${variable}.target instanceof Element && ${variable}.target.closest('.find-bar')) return;\n`;
    assert.equal(source.split(guard).length,2,file);
    const exportGuard=file==='team/comments/layer.tsx'?'      if (target.closest(".export-dialog")) return;\n':`      if (${variable}.target instanceof Element && ${variable}.target.closest(".export-dialog")) return;\n`;
    assert.equal(source.split(exportGuard).length-1,file==='team/reactions-layer.tsx'?2:1,file);
    if(file==='team/reactions-layer.tsx') assert.equal(source.split('    const key = (e: KeyboardEvent) => {\n'+exportGuard).length-1,2,file);
    if(file==='team/spotlight-layer.tsx') assert.equal(source.replace(guard,'').replace(exportGuard,''),execFileSync('git',['show','4f53e7f:'+path],{encoding:'utf8'}),file);
  }
});

test('F1-U14 canvas fit keys require physical shifted digits, canvas focus and idle non-editing input', async () => {
  await rules();
  const {readFileSync}=await import('node:fs'),{transform}=await import('esbuild');
  const source=readFileSync(new URL('../apps/web/src/state/use-canvas-input.ts',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf('  function sceneKeyDown('),source.indexOf('  function pointerDown('));
  const js=(await transform(handler,{loader:'ts'})).code;
  const make=new Function('state',`with(state){${js};return sceneKeyDown;}`);
  const calls=[],canvas={},state={tableSelection:undefined,composing:false,inline:false,textEditing:false,busy:false,drag:{current:null},tidy:{open:false},
    find:{zoomToFit:()=>calls.push('all'),zoomToSelection:()=>calls.push('selection')},voting:null,readOnly:true,
    drawingKey:()=>null,isDrawingTool:()=>false,toolForKey:()=>null,tool:'Select'};
  const event=patch=>({key:'!',code:'Digit1',target:canvas,currentTarget:canvas,shiftKey:true,ctrlKey:false,metaKey:false,altKey:false,nativeEvent:{isComposing:false},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...patch});
  for(const code of ['Digit1','Digit2']){const e=event({code});make(state)(e);assert(e.prevented&&e.stopped);}
  assert.deepEqual(calls,['all','selection']);calls.length=0;
  for(const patch of [{target:{}},{shiftKey:false},{ctrlKey:true},{metaKey:true},{altKey:true},{code:'Numpad1'},{nativeEvent:{isComposing:true}}])make(state)(event(patch));
  for(const property of ['composing','inline','textEditing','busy']){state[property]=true;make(state)(event({}));state[property]=false;}
  state.drag.current={};make(state)(event({}));state.drag.current=null;
  state.tidy.open=true;make(state)(event({}));assert.deepEqual(calls,[]);
});
