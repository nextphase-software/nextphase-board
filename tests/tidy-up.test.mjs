// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load=p=>import(new URL('../'+p,import.meta.url));
const tidy=()=>load('apps/web/src/tidy-up.ts');
async function six(){const {empty,add}=await load('packages/board-rules/src/document.ts');let b={...empty(),title:'Layout'};for(const [x,y]of [[0,0],[400,0],[800,0],[0,400],[400,400],[800,400]]) b=add(b,'sticky',x,y);return b;}
const ids=b=>new Set(b.objects.map(o=>o.id));
test('TU-U1 placeable items carry whole groups and sections, never connectors',async()=>{
 const {placeableItems}=await tidy(),{add}=await load('packages/board-rules/src/document.ts'),b=await six(),group=crypto.randomUUID();
 b.objects[0].group=group;b.objects[1].group=group;const section=add(b,'section',0,0).objects.at(-1);b.objects.push({...section,order:6});b.objects[2].section=section.id;
 const connector={id:'line',type:'connector',group:null,section:null};b.objects.push(connector);
 const items=placeableItems(b,new Set([b.objects[0].id,b.objects[1].id,section.id,b.objects[2].id,b.objects[3].id,'line']));assert.equal(items.length,3);assert.deepEqual(items.find(i=>i.id===group).ids,[b.objects[0].id,b.objects[1].id]);assert.deepEqual(items.find(i=>i.id===section.id).ids,[b.objects[2].id,section.id]);
});
test('TU-U2 reading order bands by seed bounds, centre ties by id and lone rows',async()=>{
 const {readingOrder}=await tidy(),item=(id,x,y,width=20,height=20)=>({id,x,y,width,height,ids:[id]});
 const items=[item('z',90,0),item('b',0,5),item('a',0,6),item('lone',-100,90),item('deep',-50,30)];
 assert.deepEqual(readingOrder(items).map(i=>i.id),['a','b','z','deep','lone']);
 assert.deepEqual(readingOrder([item('t',0,0,10,100),item('a',50,40),item('b',-20,70)]).map(i=>i.id),['b','t','a']);
});
test('TU-U3 default and bounded columns/spacing, widest columns, tallest rows, centred cells and seven handles',async()=>{
 const {placeableItems,tidyGrid}=await tidy(),b=await six(),items=placeableItems(b,ids(b)),g=tidyGrid(items);
 assert.equal(g.columns,3);assert.equal(g.spacing,24);assert.deepEqual(g.widths,[240,240,240]);assert.deepEqual(g.heights,[240,240]);assert.equal(g.bounds.width,768);assert.equal(g.bounds.height,504);assert.equal(g.bounds.x+384,400);assert.equal(g.bounds.y+252,200);assert.equal(g.handles.length,7);assert.deepEqual(g.handles[0],{id:'v-0-0',axis:'x',x:268,y:68});
 assert.equal(tidyGrid(items,0,-1).columns,1);assert.equal(tidyGrid(items,99,900).columns,6);assert.equal(tidyGrid(items,2,900).spacing,400);
 items[0].width=100;items[3].height=100;const varied=tidyGrid(items);assert.equal(varied.widths[0],240);assert.equal(varied.heights[1],240);assert.equal(varied.offsets.get(items[0].id).x,Math.round(varied.bounds.x+70-items[0].x));
});
test('TU-U4 board edges, halves away from zero and shared whole offsets preserve fractional positions',async()=>{
 const {placeableItems,tidyGrid,applyTidy}=await tidy(),b=await six();b.objects=b.objects.map((o,i)=>({...o,x:999000+i*.1,y:999000+i*.2}));
 const items=placeableItems(b,ids(b)),g=tidyGrid(items,3,400),after=applyTidy(b,g);assert(g.bounds.x+g.bounds.width<=1e6);assert(g.bounds.y+g.bounds.height<=1e6);
 for(let i=0;i<6;i++){assert(Number.isInteger(after.objects[i].x-b.objects[i].x));assert(Number.isInteger(after.objects[i].y-b.objects[i].y));assert(after.objects[i].x+240<=1e6);assert(after.objects[i].y+240<=1e6);}
 const {whole}=await load('apps/web/src/tape.ts');assert.equal(whole(-1.5),-2);assert.equal(whole(1.5),2);
});
test('TU-U5 Apply changes only positions, section members share offsets, one Undo and Redo',async()=>{
 const {placeableItems,tidyGrid,applyTidy}=await tidy(),{canonical,add}=await load('packages/board-rules/src/document.ts'),{record,emptyHistory,undo,redo}=await load('apps/web/src/history.ts');let b=await six();b=add(b,'section',1000,1000);const section=b.objects.at(-1);b.objects[0].section=section.id;
 const items=placeableItems(b,ids(b)),g=tidyGrid(items),after=applyTidy(b,g);for(let i=0;i<b.objects.length;i++)assert.deepEqual({...after.objects[i],x:b.objects[i].x,y:b.objects[i].y},b.objects[i]);assert.equal(after.objects[0].x-b.objects[0].x,after.objects.at(-1).x-section.x);
 const history=record(emptyHistory(),b,after);assert.equal(history.past.length,1);const back=undo(after,history);assert.equal(canonical(back.board),canonical(b));assert.equal(canonical(redo(back.board,back.history).board),canonical(after));
});
test('TU-U6 incoming edits to placed ids or their members cancel, other objects do not',async()=>{
 const {placeableItems,placedChanged}=await tidy(),b=await six(),items=placeableItems(b,new Set(b.objects.slice(0,3).map(o=>o.id))),copy=structuredClone(b);assert(!placedChanged(b,copy,items));copy.objects[5].text='Elsewhere';assert(!placedChanged(b,copy,items));copy.objects[0].text='Changed';assert(placedChanged(b,copy,items));assert(placedChanged(b,{...b,objects:b.objects.slice(1)},items));
});
test('TU-U7 availability refuses mind nodes, fewer than three items and editing states',async()=>{
 const {tidyReason}=await tidy(),{add}=await load('packages/board-rules/src/document.ts'),b=await six(),editable={readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false};assert.equal(tidyReason(b,ids(b),editable),'');assert.equal(tidyReason(b,new Set([b.objects[0].id]),editable),'Select three or more objects to tidy up.');const nodes=add(b,'mindNode',0,0);assert.equal(tidyReason(nodes,ids(nodes),editable),'Mind map nodes are placed by their map.');assert(tidyReason(b,ids(b),{...editable,readOnly:true}));
});
// The actual state owner runs against a small hook scheduler; no DOM renderer or
// browser is started. Effects and event handlers are the production functions.
async function stateHarness(board, hosted, withContext=false) {
 const {build}=await import('esbuild');
 const runtime=`let slots=[],cursor=0,pending=[],changed=false;
 export const begin=()=>{cursor=0;pending=[];changed=false;};export const dirty=()=>changed;export const flush=()=>pending.splice(0).forEach(fn=>fn());
 export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i])){slots[i]=value;changed=true;}}];}
 export function useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});}
 export function useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,j)=>!Object.is(x,old.deps[j]))){pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}}
 export const useLayoutEffect=useEffect;`;
 const result=await build({stdin:{contents:'export {useTidyUp} from "./state/use-tidy-up.ts";export {useContextBar} from "./state/use-context-bar.ts";export {begin,flush,dirty} from "test-react";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'hook-scheduler',setup(b){b.onResolve({filter:/^(react|test-react)$/},()=>({path:'runtime',namespace:'scheduler'}));b.onLoad({filter:/.*/,namespace:'scheduler'},()=>({contents:runtime,loader:'js'}));}}]});
 const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64')+'#'+crypto.randomUUID());
 const listeners=new Map(),oldWindow=globalThis.window;globalThis.window={innerWidth:1280,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const events={commits:[],messages:[],focus:0},props={board,selected:ids(board),tool:'Select',hosted,scene:{current:{focus(){events.focus++;}}},commit:(next,record)=>events.commits.push({next,record}),setMessage:value=>events.messages.push(value)};
 const oldObserver=globalThis.ResizeObserver,observers=new Set(),node={mounted:false,getBoundingClientRect(){return {width:this.mounted?640:0};}};
 if(withContext)globalThis.ResizeObserver=class{constructor(measure){this.measure=measure;}observe(target){this.target=target;observers.add(this);}disconnect(){observers.delete(this);}};
 const h={props,events,listeners,refresh(){for(let i=0;i<8;i++){
 m.begin();h.tidy=m.useTidyUp(props);let removed=false;
 if(withContext){
 h.context=m.useContextBar({selectionKey:JSON.stringify([...props.selected].sort()),selected:props.selected,selectionReason:h.tidy.open?'Apply or cancel Tidy up first.':'',bounds:{x:0,y:100,width:768,height:504},pos:o=>({left:o.x,top:o.y}),view:{x:0,y:0,z:1},size:{w:window.innerWidth,h:800},layout:{notice:80,panel:130},inline:false,item:undefined,itemHeight:0});
 const mounted=props.selected.size>0&&!h.tidy.open;removed=node.mounted&&!mounted;node.mounted=mounted;h.context.contextBar.current=mounted?node:null;
 }
 m.flush();
 // A still-observed removed element reports width 0 after the layout phase.
 if(removed)for(const observer of observers)if(observer.target===node)observer.measure();
 if(!m.dirty())return h.tidy;
 }assert.fail('Hook did not settle');},close(){globalThis.window=oldWindow;if(withContext)globalThis.ResizeObserver=oldObserver;}};h.refresh();return h;
}
const editable={readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false};
test('TU-U8 actual preview edits nothing, measures displayed height and applies one real edit',async()=>{
 const b=await six(),h=await stateHarness(b);try{
 h.tidy.measure(b.objects.map((o,i)=>({...o,displayHeight:i?o.height:300})));h.tidy.start(editable);h.refresh();assert(h.tidy.open);assert.equal(h.tidy.selected.size,0);assert.equal(h.tidy.grid.heights[0],300);assert.equal(h.events.commits.length,0);assert.deepEqual(h.props.board,b);
 h.tidy.changeColumns(2);h.refresh();h.tidy.changeSpacing(40);h.refresh();assert.equal(h.tidy.columns,2);assert.equal(h.tidy.spacing,40);assert.equal(h.events.commits.length,0);
 const preview=h.tidy.board;h.tidy.apply();h.refresh();assert(!h.tidy.open);assert.deepEqual(h.events.commits,[{next:preview,record:true}]);assert.equal(h.events.messages.at(-1),'Tidied 6 objects into 2 columns.');assert(h.events.focus>=2);
 }finally{h.close();}
});
test('TU-U9 actual Cancel, tool/selection changes and narrow resize discard previews without edits',async()=>{
 const h=await stateHarness(await six());try{
 for(const route of ['button','tool','selection','resize']){h.props.selected=ids(h.props.board);h.props.tool='Select';window.innerWidth=1280;h.refresh();h.tidy.start(editable);h.refresh();assert(h.tidy.open);
 if(route==='button')h.tidy.cancel(true);if(route==='tool')h.props.tool='Sticky';if(route==='selection')h.props.selected=new Set();if(route==='resize'){window.innerWidth=375;h.listeners.get('resize')();}h.refresh();assert(!h.tidy.open);assert.equal(h.events.commits.length,0);}
 assert(h.events.messages.includes('Tidy up cancelled.'));window.innerWidth=375;h.props.selected=ids(h.props.board);h.refresh();h.tidy.start(editable);h.refresh();assert(!h.tidy.open);
 }finally{h.close();}
});
test('TU-U10 actual hosted change cancels only when a placed object or member changes',async()=>{
 const toasts=[],b=await six(),h=await stateHarness(b,{toast:value=>toasts.push(value)});try{
 h.props.selected=new Set(b.objects.slice(0,3).map(o=>o.id));h.refresh();h.tidy.start(editable);h.refresh();h.props.board={...b,objects:b.objects.map((o,i)=>i===5?{...o,text:'Other edit'}:o)};h.refresh();assert(h.tidy.open);assert.equal(h.tidy.board.objects[5].text,'Other edit');
 h.props.board={...h.props.board,objects:h.props.board.objects.map((o,i)=>i===0?{...o,x:o.x+1}:o)};h.refresh();assert(!h.tidy.open);assert.deepEqual(toasts,['Tidy up was cancelled because the objects changed.']);assert.equal(h.events.commits.length,0);
 }finally{h.close();}
});
test('TU-U11 spacing handles override scene hit suppression while the grid and label stay pointer-free',()=>{
 const css=readFileSync(new URL('../apps/web/style.css',import.meta.url),'utf8');
 const rule=selector=>css.match(new RegExp('(?:^|})\\s*'+selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^}]*)\\}'))?.[1]??'';
 assert.match(rule('.scene > div'),/pointer-events:\s*none/);
 // Two classes outrank the scene's class + element rule; a bare handle class does not.
 assert.match(rule('.scene > .tidy-handle'),/pointer-events:\s*auto/);
 for(const selector of ['.tidy-grid','.tidy-spacing-label'])assert.match(rule(selector),/pointer-events:\s*none/);
});
let screenParts;
async function screens(){
 if(!screenParts)screenParts=(async()=>{
 const {build}=await import('esbuild'),reactURL=new URL('../node_modules/react/index.js',import.meta.url),{createElement}=await import(reactURL),{renderToStaticMarkup}=await import('react-dom/server');
 const result=await build({stdin:{contents:'export {TidyUpBar} from "./ui/tidy-up-bar.tsx";export {ObjectsPanel} from "./ui/objects-panel.tsx";export {useCanvasInput} from "./state/use-canvas-input.ts";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:args.path==='react'?reactURL.href:new URL('../node_modules/'+args.path+'.js',import.meta.url).href,external:true}));}}]});
 const parts=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 return {...parts,render:(part,props)=>renderToStaticMarkup(createElement(part,props))};
 })();return screenParts;
}
test('TU-U12 Objects move buttons have titles only during a Tidy up preview',async()=>{
 const {ObjectsPanel,render}=await screens(),{empty}=await load('packages/board-rules/src/document.ts');
 const props={board:{...empty(),title:'Layout'},selected:new Set(),description:{},tapeSelection:{objects:[]},strokeSelection:{objects:[]},shapeSelection:{objects:[]},shapeCommands:{},numbers:new Map(),drafts:{},selectionReason:'Select an object to duplicate or delete.',duplicateReason:'Select an object to duplicate or delete.',clipboardState:editable,objectClipboard:null,view:{x:0,y:0,z:1}};
 for(const open of [false,true]){
 const html=render(ObjectsPanel,{...props,tidy:{open}}),buttons=[...html.matchAll(/<button[^>]*aria-label="Move object (?:left|up|down|right)"[^>]*>/g)].map(m=>m[0]);assert.equal(buttons.length,4);
 for(const button of buttons){assert.match(button,/disabled=""/);if(open)assert.match(button,/title="Apply or cancel Tidy up first\."/);else assert.doesNotMatch(button,/\btitle=/);}
 }
});
test('TU-U13 oversized width or height pins to the board edge and refuses Apply/Enter until columns or spacing fit',async()=>{
 const {empty,validate}=await load('packages/board-rules/src/document.ts'),{TidyUpBar,useCanvasInput,render}=await screens();
 for(const axis of ['x','y'])for(const change of ['columns','spacing']){
 const initial=empty(), board={...initial,title:'Large layout',objects:Array.from({length:3},(_,order)=>({id:crypto.randomUUID(),generation:crypto.randomUUID(),type:'stroke',page:initial.boardId,kind:'marker',color:'black',weight:'thin',group:null,section:null,x:axis==='x'?-1e6:order*10,y:axis==='y'?-1e6:order*10,width:axis==='x'?1e6:4,height:axis==='y'?1e6:4,points:axis==='x'?[[2,2],[999998,2]]:[[2,2],[2,999998]],order}))};
 assert.doesNotThrow(()=>validate(board));const before=structuredClone(board),h=await stateHarness(board);
 try{
 h.tidy.start(editable);h.refresh();assert(h.tidy.open);assert.equal(h.tidy.grid.fits,false);assert.equal(h.tidy.grid.bounds[axis],-1e6);
 const bar=()=>render(TidyUpBar,{tidy:h.tidy,pos:o=>({left:o.x,top:o.y}),view:{x:0,y:0,z:1},size:{w:1280,h:800},layout:{notice:0,panel:0}});
 const applyButton=()=>bar().match(/<button[^>]*class="tidy-apply"[^>]*>/)?.[0];assert.match(applyButton(),/disabled=""/);assert.match(applyButton(),/title="The grid doesn&#x27;t fit on the board\."/);
 h.tidy.apply();h.refresh();assert(h.tidy.open);assert.equal(h.events.commits.length,0);
 let input;render(()=>{input=useCanvasInput({tidy:h.tidy,tool:'Select',selected:ids(board),drag:{current:null},spacePanRef:{current:false},view:{x:0,y:0,z:1},displayedObjects:[]});return null;});
 const target={};input.sceneKeyDown({key:'Enter',target,currentTarget:target,preventDefault(){},stopPropagation(){}});h.refresh();assert(h.tidy.open);assert.equal(h.events.commits.length,0);assert.deepEqual(board,before);assert.equal(h.events.messages.length,0);
 if(change==='spacing')h.tidy.changeSpacing(0);else h.tidy.changeColumns(axis==='x'?1:3);h.refresh();assert(h.tidy.grid.fits);assert.doesNotMatch(applyButton(),/\b(?:disabled|title)=/);
 const preview=h.tidy.board;h.tidy.apply();h.refresh();assert(!h.tidy.open);assert.deepEqual(h.events.commits,[{next:preview,record:true}]);assert.doesNotThrow(()=>validate(preview));
 }finally{h.close();}
 }
});
test('TU-U14 only the Tidy up bar stacks above the floating palette and zoom bar',()=>{
 const css=readFileSync(new URL('../apps/web/style.css',import.meta.url),'utf8');
 const z=selector=>Number(css.match(new RegExp('(?:^|})\\s*'+selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{[^}]*z-index:\\s*(\\d+)'))?.[1]);
 assert.equal(z('.context'),1);assert.equal(z('.floating'),3);assert(z('.context.tidy-bar')>z('.floating'));
});
const barPosition={pos:o=>({left:o.x,top:o.y}),view:{x:0,y:0,z:1},size:{w:1280,h:800},layout:{notice:80,panel:130}};
const descendants=node=>Array.isArray(node)?node.flatMap(descendants):node&&typeof node==='object'?[node,...descendants(node.props?.children)]:[];
async function canvasInput(tidy){const {useCanvasInput,render}=await screens();let input;render(()=>{input=useCanvasInput({tidy,tool:'Select',selected:new Set(),drag:{current:null},spacePanRef:{current:false},view:{x:0,y:0,z:1},displayedObjects:[],trackPointer(){}});return null;});return input;}
test('TU-U15 normal context bar measures its remount after Apply and every Cancel route',async()=>{
 const {TidyUpBar}=await screens();
 for(const route of ['apply','button','canvasEscape','barEscape','canvasPress','tool','selection','resize','incoming']){
 const h=await stateHarness(await six(),undefined,true);try{
 assert(h.context.contextFits);assert.equal(h.context.contextWidth,640);h.tidy.start(editable);h.refresh();assert(h.tidy.open);
 if(route==='apply')h.tidy.apply();if(route==='button')h.tidy.cancel(true);
 if(route==='barEscape')TidyUpBar({tidy:h.tidy,...barPosition}).props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});
 if(route==='canvasEscape'||route==='canvasPress'){const input=await canvasInput(h.tidy),target={};const e={target,currentTarget:target,key:'Escape',button:0,preventDefault(){},stopPropagation(){}};if(route==='canvasEscape')input.sceneKeyDown(e);else input.pointerDown(e);}
 if(route==='tool')h.props.tool='Sticky';if(route==='selection')h.props.selected=new Set([...h.props.selected].slice(0,3));
 if(route==='resize'){window.innerWidth=375;h.listeners.get('resize')();}
 if(route==='incoming')h.props.board={...h.props.board,objects:h.props.board.objects.map((o,i)=>i===0?{...o,x:o.x+1}:o)};
 h.refresh();assert(!h.tidy.open,route);assert.equal(h.context.contextWidth,640,route);if(route==='resize'){window.innerWidth=1280;h.refresh();}assert(h.context.contextFits,route);assert.equal(h.events.commits.length,route==='apply'?1:0);
 }finally{h.close();}
 }
});
test('TU-U16 Escape from every Tidy up control survives focus-triggered field blur',async()=>{
 const {TidyUpBar}=await screens();
 for(const name of ['Fewer columns','Columns','More columns','Spacing','Cancel','Apply']){
 const h=await stateHarness(await six());try{
 h.tidy.start(editable);h.refresh();const bar=TidyUpBar({tidy:h.tidy,...barPosition}),control=descendants(bar).find(n=>(n.type==='input'||n.type==='button')&&(n.props['aria-label']??n.props.children)===name);assert(control,name);
 const field={value:name==='Columns'?'2':'40'},focus=h.events.focus;let active=true,prevented=false,stopped=false;
 h.props.scene.current.focus=()=>{h.events.focus++;if(active){active=false;control.props.onBlur?.({currentTarget:field});}};
 const e={key:'Escape',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}};control.props.onKeyDown?.(e);if(!stopped)bar.props.onKeyDown(e);h.refresh();
 assert(prevented&&stopped,name);assert.equal(h.events.focus,focus+1,name);assert.deepEqual(h.events.messages,['Tidy up cancelled.'],name);assert.equal(h.events.commits.length,0);assert.equal(h.tidy.open,false,name);
 }finally{h.close();}
 }
});
test('TU-U17 size-button titles appear only for tapes or an open Tidy up preview',async()=>{
 const {ObjectsPanel,render}=await screens(),{empty}=await load('packages/board-rules/src/document.ts'),{makeTape}=await load('apps/web/src/tape.ts'),board={...empty(),title:'Layout'},tape=makeTape(board,{x:0,y:0},{x:160,y:0},'stripes');
 for(const holdsTape of [false,true])for(const open of [false,true]){
 const html=render(ObjectsPanel,{board:holdsTape?{...board,objects:[tape]}:board,selected:holdsTape?new Set([tape.id]):new Set(),description:{},tapeSelection:{objects:holdsTape?[tape]:[]},strokeSelection:{objects:[]},shapeSelection:{objects:[]},shapeCommands:{},numbers:new Map(),drafts:{},selectionReason:'Select an object to duplicate or delete.',duplicateReason:'Select an object to duplicate or delete.',clipboardState:editable,objectClipboard:null,view:{x:0,y:0,z:1},tidy:{open},arrangementReason:()=>''});
 const buttons=[...html.matchAll(/<button[^>]*aria-label="Make object (?:wider|narrower|taller|shorter)"[^>]*>/g)].map(m=>m[0]);assert.equal(buttons.length,4);
 for(const button of buttons){assert.match(button,/disabled=""/);if(open)assert.match(button,/title="Apply or cancel Tidy up first\."/);else if(holdsTape)assert.match(button,/title="Washi tape can&#x27;t be resized\."/);else assert.doesNotMatch(button,/\btitle=/);}
 }
});
