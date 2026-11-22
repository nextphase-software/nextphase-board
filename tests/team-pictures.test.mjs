// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash, randomUUID } from "node:crypto";
import { setImmediate as turn } from "node:timers/promises";
import { empty } from "../packages/board-rules/src/document.ts";

const noop = () => {};
const deferred = () => Promise.withResolvers();
let compiled;
function modules() {
  return compiled ??= build({
    stdin: { resolveDir: new URL("../apps/web/src/",import.meta.url).pathname, loader:"ts", contents:
      ["team/pictures","state/use-images","state/use-editing-commands","state/use-canvas-input","state/use-gif-playback",
        "state/use-hosted-board","scene/gif-marks","scene/image-body","scene/board-drawing","ui/notice","ui/palette","image-assets"]
        .map(path=>'export * from "./'+path+'";').join("\n")+'\nexport {render,dispose} from "react";' },
    footer:{js:"//# sourceURL=team-pictures-harness.mjs"}, bundle:true, write:false, format:"esm", platform:"node", jsx:"automatic",
    plugins:[{name:"picture-harness",setup(p){
      p.onResolve({filter:/^(react|react-konva)$/},({path})=>({path,namespace:"stub"}));
      p.onResolve({filter:/^react\/jsx-runtime$/},({path})=>({path:import.meta.resolve(path),external:true}));
      p.onResolve({filter:/^\.\/(auth|config)$/},args=>args.importer.endsWith("/team/pictures.ts")?{path:args.path,namespace:"stub"}:undefined);
      p.onLoad({filter:/.*/,namespace:"stub"},({path})=>({contents:path==="./auth"?'export const auth={getSession:async()=>({data:{session:{access_token:"fixture"}}})};':
        path==="./config"?'export const settings={serverUrl:"https://board.example"};':
        path==="react-konva"?'export const Stage="Stage",Layer="Layer",Group="Group",Image="Image",Rect="Rect",Text="Text",Circle="Circle",Ellipse="Ellipse",Path="Path",Line="Line";':`
          let slots, cursor, jobs;
          export function render(storage, fn, effects=true) {
            slots=storage;cursor=0;jobs=[]; const result=fn(); if(effects) for(const job of jobs) job(); return result;
          }
          export function dispose(storage){for(const cell of storage)cell.cleanup?.();}
          export function useRef(value){const i=cursor++;return slots[i]??={current:value};}
          export function useState(value){const i=cursor++;const cell=slots[i]??={current:typeof value==="function"?value():value};
            return [cell.current,next=>{cell.current=typeof next==="function"?next(cell.current):next;}];}
          export function useEffect(fn,deps){const cell=useRef();if(!deps||!cell.current||deps.some((d,i)=>!Object.is(d,cell.current[i])))jobs.push(()=>{
            cell.cleanup?.();cell.current=deps;cell.cleanup=fn();});}
        `, loader:"js"}));
    }}],
  }).then(r=>import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64")));
}
const cleanups = new WeakMap();
function cleanup(t, fn) {
  if (!cleanups.has(t)) { cleanups.set(t, []); t.after(() => { for (const undo of cleanups.get(t).reverse()) undo(); }); }
  cleanups.get(t).push(fn);
}
function replace(t,key,value) { const old=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});cleanup(t,()=>old?Object.defineProperty(globalThis,key,old):delete globalThis[key]); }
const hash = bytes=>createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
function gif(n=2,w=2,h=2,tag=0){
  const image=[44,0,0,0,0,1,0,1,0,0,2,2,68,1,0];
  return Uint8Array.from([...Buffer.from("GIF89a"),w&255,w>>8,h&255,h>>8,128,0,0,tag,0,0,0,255,0,...Array.from({length:n},()=>image).flat(),59]).buffer;
}
const file=(name,bytes=gif())=>({name,type:"image/gif",size:bytes.byteLength,arrayBuffer:async()=>bytes});
const bitmap=(width=2,height=2)=>({width,height,close:noop});
const item=(asset,change={})=>({id:randomUUID(),generation:randomUUID(),type:"image",page:"page",asset,pixelWidth:2,pixelHeight:2,
  x:0,y:0,width:100,height:100,displayHeight:100,description:"",order:0,group:null,section:null,...change});
function fakeHosted(board) {
  const listeners=new Set();
  return {boardId:board.boardId,snapshot:{connected:true,role:"editor"},history:{rejoining:false,locked:false,previewing:false},canEdit:true,
    pictures:{upload:async()=>({ok:true}),download:async()=>null},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    notify(){for(const fn of listeners)fn();}};
}
async function harness(t, local=false) {
  const m=await modules();m.tabPictures.clear();
  replace(t,"crypto",{randomUUID,subtle:{digest:async(_,bytes)=>Uint8Array.from(createHash("sha256").update(new Uint8Array(bytes)).digest()).buffer}});
  replace(t,"window",new EventTarget());replace(t,"document",new EventTarget());replace(t,"createImageBitmap",async()=>bitmap());
  const board=empty(), hosted=local?undefined:fakeHosted(board), slots=[],messages=[],edits=[],writes=[];
  const store={active:true,transactions:new Set(),db:{transaction(){const tx={objectStore:()=>({put:(_,key)=>writes.push(key)})};queueMicrotask(()=>tx.oncomplete?.());return tx;}}};
  const props={board,model:{current:board},page:board.boardId,selected:new Set(),hosted,pending:{current:{}},isAlive:()=>true,getStore:()=>{assert(local);return store;},
    getView:()=>({x:0,y:0,z:1}),barVisible:()=>true,setMessage:v=>messages.push(v),scene:{current:{focus:noop}},commit:(b,step)=>{edits.push([b,step]);props.model.current=props.board=b;},
    setComposing:noop,setInline:noop,select:noop,setTool:noop,setPanel:noop,finishTextSession:noop};
  const render=()=>m.render(slots,()=>m.useImages(props));
  cleanup(t,()=>m.dispose(slots));
  return {m,props,hosted,render,writes,messages,edits,drop(files){return render().drop({clientX:0,clientY:0,preventDefault:noop,
    currentTarget:{getBoundingClientRect:()=>({left:0,top:0,width:0,height:0})},dataTransfer:{files}});}};
}
async function settle(){for(let i=0;i<3;i++)await turn();}
function elements(tree) {
  if(Array.isArray(tree))return tree.flatMap(elements);
  return tree?.props?[tree,...elements(tree.props.children)]:[];
}
test("X7-U07 picture transport sends signed raw bytes, maps responses and bounds both timeouts",async t=>{
  const {BoardPictures}=await modules(), transport=new BoardPictures(()=>"test"), bytes=gif(), calls=[], timers=[];
  replace(t,"setTimeout",(fn,ms)=>{timers.push({fn,ms});return timers.length;});replace(t,"clearTimeout",noop);
  let response;replace(t,"fetch",async(url,init)=>{calls.push({url,init});if(response instanceof Error)throw response;if(response==="timeout"){timers.at(-1).fn();throw Error();}return response;});
  for(const [status,reason,kind] of [[200],[201],[413,"","too_large"],[409,"board_pictures_full","full"],[409,"other","refused"],[400,"","refused"],[204,"","refused"]]){
    response=new Response(status===204?null:JSON.stringify({error:{reason}}),{status});
    assert.deepEqual(await transport.upload("hash",bytes),kind?{ok:false,kind}:{ok:true});
    const {url,init}=calls.at(-1);assert.equal(url,"https://board.example/boards/test/assets/hash");assert.equal(init.body,bytes);
    assert.equal(init.method,"PUT");assert.deepEqual(init.headers,{Authorization:"Bearer fixture","Content-Type":"application/octet-stream"});assert.equal(timers.at(-1).ms,120000);
  }
  for(const [fail,kind] of [[Error(),"offline"],["timeout","refused"]]){response=fail;assert.deepEqual(await transport.upload("hash",bytes),{ok:false,kind});}
  response=new Response(bytes);assert.deepEqual(await transport.download("hash"),bytes);const {init}=calls.at(-1);
  assert.equal(init.cache,undefined);assert.equal(init.method,"GET");assert.equal(init.headers.Authorization,"Bearer fixture");assert.equal(timers.at(-1).ms,60000);
  for(response of [Error(),"timeout",new Response(null,{status:404})])assert.equal(await transport.download("hash"),null);
});
test("X7-U08 hosted upload precedes one edit, names the first three files, local import still writes",async t=>{
  const h=await harness(t), gate=deferred(),calls=[];h.hosted.pictures.upload=async(key,bytes)=>{calls.push(key);assert.equal(hash(bytes),key);await gate.promise;return {ok:true};};
  const files=["","b","c","d"].map(n=>file(n));const adding=h.drop(files);
  assert.equal(h.messages[0],"Adding Clipboard image, b and c and 1 more…");await settle();assert.equal(calls.length,1);assert.equal(h.edits.length,0);
  gate.resolve();await adding;assert.equal(calls.length,4);assert.equal(h.edits.length,1);assert.equal(h.edits[0][0].objects.length,4);
  assert.equal(h.edits[0][1],true);assert.equal(h.messages.at(-1),"");assert.deepEqual(h.writes,[]);
  const l=await harness(t,true);await l.drop([file("local")]);assert.equal(l.writes.length,1);assert.deepEqual(l.messages,["Added 1 image."]);
});
test("X7-U09 hosted import reasons, a single network failure and final object capacity",async t=>{
  const h=await harness(t), names=["offline","too_large","full","refused"];
  const reasons=["you are offline","it is larger than 20 MiB","this board already holds 50 MiB of pictures","the server did not accept it"];
  for(const [i,kind] of names.entries()){
    h.hosted.pictures.upload=async()=>({ok:false,kind});await h.drop([file("test")]);assert.equal(h.messages.at(-1),"Could not add test: "+reasons[i]+".");
  }
  h.hosted.pictures.upload=()=>assert.fail("oversize file uploaded");await h.drop([{...file("big"),size:20971521}]);
  assert.equal(h.messages.at(-1),"Could not add big: it is larger than 20 MiB.");
  h.hosted.pictures.upload=async()=>{h.hosted.pictures.upload=async()=>({ok:true});return {ok:false,kind:"offline"};};
  await h.drop([file("a"),file("b")]);assert.equal(h.edits.length,1);assert.equal(h.props.board.objects.length,1);assert.equal(h.messages.at(-1),"Could not add a: you are offline.");
  let uploads=0;h.hosted.pictures.upload=async()=>{if(++uploads===2)h.props.model.current={...h.props.board,objects:Array.from({length:249},()=>item("x"))};return {ok:true};};
  await h.drop([file("a"),file("b")]);assert.equal(h.edits.at(-1)[0].objects.length,250);assert.equal(h.messages.at(-1),"Could not add b: 250 object limit reached.");
});
test("X7-U10 role, preview, lock, navigation and page close stop an import; reconnection cannot restart it",async t=>{
  for(const reason of ["role","preview","lock","board","close","disconnect","rejoin","recovery"]){
    const h=await harness(t), gate=deferred(), started=deferred();let calls=0;
    h.hosted.pictures.upload=async()=>{if(++calls===2){started.resolve();await gate.promise;}return {ok:true};};
    const pending=h.drop([file("a"),file("b"),file("c")]);await started.promise;
    if(reason==="role")h.hosted.snapshot.role="viewer";if(reason==="preview")h.hosted.history.previewing=true;if(reason==="lock")h.hosted.history.locked=true;
    if(reason==="board")h.props.model.current={...h.props.board,boardId:randomUUID()};if(reason==="close")window.dispatchEvent(new Event("pagehide"));
    if(reason==="disconnect")h.hosted.snapshot.connected=false;if(reason==="rejoin")h.hosted.history.rejoining=true;if(reason==="recovery")h.hosted.canEdit=false;
    h.hosted.notify();h.hosted.snapshot.connected=true;h.hosted.history.rejoining=false;h.hosted.canEdit=true;h.hosted.notify();gate.resolve();await pending;
    assert.equal(calls,2);assert.equal(h.edits.length,0);assert.equal(h.messages.at(-1),["disconnect","rejoin","recovery"].includes(reason)?"Could not add a, b and c: you are offline.":"",reason);
  }
  const h=await harness(t),gate=deferred(),started=deferred();h.hosted.pictures.upload=()=>assert.fail("uploaded after preparation");
  const pending=h.drop([{...file("late"),arrayBuffer:()=>{started.resolve();return gate.promise;}}]);await started.promise;
  h.hosted.snapshot.role="viewer";gate.resolve(gif());await pending;assert.deepEqual(h.edits,[]);assert.equal(h.messages.at(-1),"");
});
test("X7-U11 per-opening loader fills four slots, retries failed hashes, ignores an ended opening",async t=>{
  const h=await harness(t),data=Array.from({length:6},(_,i)=>gif(i===2?1:2,2,2,i)),keys=data.map(hash),calls=[];
  const waits=new Map();let serial=0;
  replace(t,"setTimeout",(fn,ms)=>{const id=++serial;waits.set(id,{ms,fn});return id;});replace(t,"clearTimeout",id=>waits.delete(id));
  const retry=async ms=>{const entry=[...waits].find(([,v])=>v.ms===ms);assert(entry,"retry "+ms);waits.delete(entry[0]);entry[1].fn();await settle();};
  h.props.board={...h.props.board,objects:[...keys,keys[0]].map(k=>item(k))};h.props.model.current=h.props.board;
  h.hosted.pictures.download=k=>{const gate=deferred();calls.push({k,...gate});return gate.promise;};
  h.render();assert.deepEqual(calls.map(c=>c.k),keys.slice(0,4));assert.equal(h.render().loading.size,6);
  calls[0].resolve(null);await settle();assert.equal(calls[4].k,keys[4]);
  calls[1].resolve(data[2]);await settle();assert.equal(calls[5].k,keys[5]);assert(!h.m.tabPictures.has(keys[1]));
  calls[2].resolve(data[2]);calls[3].resolve(data[3]);await settle();assert(h.m.tabPictures.has(keys[2]));assert(!h.render().animated.has(keys[2]));assert(h.render().animated.has(keys[3]));
  await retry(1000);assert.equal(calls[6].k,keys[0]);calls[6].resolve(null);await settle();await retry(2000);assert.equal(calls[7].k,keys[0]);calls[7].resolve(null);await settle();assert(!h.render().loading.has(keys[0]));
  h.props.hosted=fakeHosted(h.props.board);h.props.hosted.pictures.download=()=>new Promise(noop);h.render();assert(h.render().loading.has(keys[0]));assert.equal(waits.size,0);
  calls[4].resolve(data[4]);await settle();assert(!h.m.tabPictures.has(keys[4]));assert(h.render().loading.has(keys[4]));
});
test("X7-U12 loader rejects unsupported signatures and decode failures; animation requires matching screen dimensions",async t=>{
  const h=await harness(t),bad=Uint8Array.of(1).buffer,broken=gif(2,2,2,4),different=gif(2,3,3,5);
  const store=new Map([bad,broken,different].map(bytes=>[hash(bytes),bytes]));h.hosted.pictures.download=async k=>store.get(k);
  h.props.board={...h.props.board,objects:[...store.keys()].map(k=>item(k))};
  globalThis.createImageBitmap=async blob=>{if(hash(await blob.arrayBuffer())===hash(broken))throw Error();return bitmap();};
  h.render();await settle();const r=h.render();
  for(const b of [bad,broken]){assert(!h.m.tabPictures.has(hash(b)));assert(r.loading.has(hash(b)));}
  assert(h.m.tabPictures.has(hash(different)));assert(!r.animated.has(hash(different)));
});
test("X7-U13 still and animated marks use screen coordinates, sizes and selection; export keeps the still",async()=>{
  const m=await modules(),o=item("hash"),still=bitmap(),playing=bitmap(),selected=new Set(),bitmaps=new Map([[o.asset,still]]);
  const props={objects:[o],animated:new Set([o.asset]),bitmaps,selected,hovered:o.id,pos:()=>({left:50,top:60}),zoom:1};
  const marks=()=>elements(m.GifMarks(props)).filter(e=>e.props.className);
  assert.deepEqual(marks().map(e=>[e.props.className,e.props.style,e.props["aria-hidden"]]),[
    ["gif-badge",{left:144,top:66},"true"],["gif-play",{left:80,top:90},"true"]]);
  for(const [w,h,n] of [[39,100,0],[40,27,0],[40,28,1],[56,55,1],[56,56,2]]){o.width=w;o.height=h;assert.equal(marks().length,n);}
  selected.add(o.id);assert.equal(marks().length,0);selected.clear();still.width=3;assert.equal(marks().length,0);still.width=2;props.animated.clear();assert.equal(marks().length,0);
  const board={...empty(),objects:[o]}, draw={board,size:{w:200,h:200},view:{x:0,y:0,z:1},tableGesture:{},objectLayouts:new Map([[o.id,{height:o.height}]]),selected,movingIds:[],faded:new Set(),bitmaps};
  const body=extra=>elements(m.BoardDrawing({...draw,...extra})).find(e=>e.type===m.ImageBody).props;
  assert.equal(body({}).bitmap,still);assert.equal(body({playing:{id:o.id,bitmap:playing}}).bitmap,playing);
  for(const loading of [true,false]){
    const p=body({bitmaps:new Map(),loading:new Set(loading?[o.asset]:[])}), nodes=elements(m.ImageBody(p));
    assert.equal(nodes.find(e=>e.type==="Rect").props.fill,loading?"#f1eff4":"#dedede");
    assert.equal(nodes.find(e=>e.type==="Text").props.text,loading?"Loading image…":"Image unavailable");
  }
});
test("X7-U14 importing notice and Image palette control respect local, editor, owner, guest grant and viewer roles",async()=>{
  const m=await modules();
  const p={pages:{list:[]},visibleMessage:"Adding photo.png…",invalidFields:["invalid"],busy:true,showNotice:true,tool:"Sticky",snapshots:[],importing:true};
  const notice=m.Notice({...p,hosted:true});assert.equal(notice.props.role,"status");assert.equal(notice.props.children,p.visibleMessage);
  assert(elements(m.Notice({...p,hosted:false})).length>1);
  for(const [role,guest] of [["owner",false],["editor",false],["editor",true],["viewer",false]]){
    const tree=m.Palette({team:{hosted:{snapshot:{role,guest},history:{}}},tool:"Select",readOnly:role==="viewer",imagePicker:{},drawing:{},panel:""});
    assert.equal(elements(tree).filter(e=>e.type?.name==="ImageButton").length,role==="viewer"?0:1);
    const msg=m.Notice({...p,hosted:true,importing:false,visibleMessage:"This GIF is too large to play.",busy:false,tool:"Select",invalidFields:[]});
    assert.equal(msg.props.children[0],"This GIF is too large to play.");
  }
});
test("X7-U15 reduced motion consumes the press once, loops, stops and reuses the last decoded frames",async t=>{
  const m=await modules(), o=item("playback"), frames=[],timers=new Map();let serial=0;
  const props={objects:[o],selected:new Set(),bitmaps:new Map([[o.asset,bitmap()]]),animated:new Set([o.asset]),pressedPlay:{id:"",sequence:0},setMessage:()=>assert.fail()};
  const slots=[];cleanup(t,()=>m.dispose(slots));m.tabPictures.set(o.asset,{bytes:gif()});
  replace(t,"matchMedia",()=>({matches:true}));replace(t,"ImageData",class{constructor(rgba){this.rgba=rgba;}});
  replace(t,"createImageBitmap",async()=>{const b=bitmap();frames.push(b);return b;});
  replace(t,"setTimeout",(fn,ms)=>{assert.equal(ms,100);timers.set(++serial,fn);return serial;});replace(t,"clearTimeout",id=>timers.delete(id));
  const render=()=>m.render(slots,()=>m.useGifPlayback(props)).playing, tick=()=>{const [id,fn]=[...timers][0];timers.delete(id);fn();};
  props.pressedPlay={id:o.id,sequence:1};render();props.selected.add(o.id);assert.equal(render(),undefined);await settle();assert.equal(frames.length,0);
  props.pressedPlay.sequence++;render();await settle();assert.equal(render().bitmap,frames[0]);tick();assert.equal(render().bitmap,frames[1]);tick();assert.equal(render().bitmap,frames[0]);
  props.selected.add("other");assert.equal(render(),undefined);assert.equal(timers.size,0);
  props.selected.delete("other");render();await settle();assert.equal(render(),undefined);
  globalThis.matchMedia=()=>({matches:false});render();await settle();assert.equal(render().bitmap,frames[0]);assert.equal(frames.length,2);
  props.bitmaps.get(o.asset).width=3;assert.equal(render(),undefined);assert.equal(timers.size,0);
});
test("X7-U16 playback cancels unfinished bitmaps, stays still on failure and warns once per oversized picture",async t=>{
  const m=await modules(),o=item("cancel"),messages=[],slots=[],gate=deferred();let closed=0;
  const p={objects:[o],selected:new Set([o.id]),animated:new Set([o.asset]),bitmaps:new Map([[o.asset,bitmap()]]),setMessage:s=>messages.push(s)};
  replace(t,"ImageData",class{});replace(t,"createImageBitmap",async()=>gate.promise);
  const render=()=>m.render(slots,()=>m.useGifPlayback(p)).playing;cleanup(t,()=>m.dispose(slots));
  m.tabPictures.set(o.asset,{bytes:gif()});render();p.selected.clear();render();gate.resolve({close(){closed++;}});await settle();assert.equal(closed,1);assert.equal(render(),undefined);
  o.asset="broken";p.animated.add(o.asset);p.bitmaps.set(o.asset,bitmap());m.tabPictures.set(o.asset,{bytes:Uint8Array.of(0).buffer});
  p.selected.add(o.id);render();await settle();assert.equal(render(),undefined);assert.deepEqual(messages,[]);
  o.asset="large";p.animated.add(o.asset);o.pixelWidth=o.pixelHeight=1000;p.bitmaps.set(o.asset,bitmap(1000,1000));m.tabPictures.set(o.asset,{bytes:gif(17,1000,1000)});
  for(let i=0;i<2;i++){p.selected.add(o.id);render();await settle();assert.equal(render(),undefined);p.selected.clear();render();}
  assert.deepEqual(messages,["This GIF is too large to play."]);
});
test("X7-U17 canvas hover follows topmost GIF, resets with the view, and only plain play presses advance its sequence",async()=>{
  const m=await modules(), o=item("hover"), other=item("still"),board={...empty(),objects:[o]}, slots=[];
  const scene={getBoundingClientRect:()=>({left:0,top:0}),focus:noop,setPointerCapture:noop};
  const props={page:"one",model:{current:board},scene:{current:scene},spacePanRef:{current:false},drag:{current:null},selected:new Set(),
    view:{x:50,y:50,z:1},size:{w:100,h:100},tool:"Select",drawing:{},trackPointer:noop,finishTextSession:noop,select:noop,setBusy:noop,setTool:noop,
    setSelectionBox:noop,handlePoints:[],objectLayouts:new Map(),displayedObjects:[o],animated:new Set([o.asset]),bitmaps:new Map([[o.asset,bitmap()]]),
    voting:{mode:false,pointerDown(){return this.mode;},pointerMove:()=>false}};
  const ev={target:scene,currentTarget:scene,clientX:50,clientY:50,isPrimary:true,button:0,buttons:0,pointerId:1,preventDefault:noop};
  const render=()=>m.render(slots,()=>m.useCanvasInput(props),false);
  const hover=()=>{render().pointerMove(ev);assert.equal(render().hovered,o.id);};
  hover();render().pointerLeave();assert.equal(render().hovered,"");
  for(const reset of [()=>props.tool="Pan",()=>props.page="two",()=>board.boardId=randomUUID(),()=>props.view.z=2]){
    hover();reset();assert.equal(render().hovered,"");props.tool="Select";props.view.z=1;
  }
  props.displayedObjects=[o,other];render().pointerMove(ev);assert.equal(render().hovered,"");props.displayedObjects=[o];
  for(const key of ["shiftKey","altKey","ctrlKey","metaKey","space","vote","notDrawn","outside","small","plain","plain"]){
    props.drag.current=null;props.spacePanRef.current=false;props.voting.mode=false;o.width=100;props.bitmaps.set(o.asset,bitmap());hover();
    const start=render().pressedPlay.sequence,e={...ev};
    if(key.endsWith("Key"))e[key]=true;if(key==="space")props.spacePanRef.current=true;if(key==="vote")props.voting.mode=true;
    if(key==="notDrawn")props.bitmaps.set(o.asset,bitmap(3));if(key==="outside")e.clientX+=22;if(key==="small")o.width=55;
    render().pointerDown(e);assert.equal(render().pressedPlay.sequence,start+Number(key==="plain"),key);
  }
  assert.equal(render().pressedPlay.id,o.id);
});
test("X7-U18 hosted file paste dispatch and synchronous missing-image object paste on both board kinds",async t=>{
  const h=await harness(t),{m,props}=h,files=[file("clipboard")],target={},event={currentTarget:target,target,preventDefault:noop,clipboardData:{files}};
  let objects=0,received;
  const handler=extra=>m.render([],()=>m.useHostedBoard({...props,paste:()=>objects++,...extra}),false);
  handler({})(event);assert.equal(objects,0);handler({pasteFiles:v=>received=v})(event);assert.deepEqual(received,files);
  handler({pasteFiles:()=>assert.fail()})({...event,clipboardData:{files:[]}});assert.equal(objects,1);
  const o=item("missing"),b={...props.board,objects:[o]};o.page=b.boardId;
  for(const hosted of [undefined,h.hosted]){
    const slots=[],clipboard={readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false};
    const p={...props,hosted,model:{current:b},selected:new Set([o.id]),displayedObjects:[o],selectionReason:"",commandReason:"",arrangementMembers:[o],clipboardState:clipboard,editingState:clipboard,
      messageSequence:{current:0},alive:{current:true},scene:{current:{clientWidth:900,clientHeight:900}},view:{x:0,y:0,z:1},lineCount:()=>1};
    const render=()=>m.render(slots,()=>m.useEditingCommands(p),false);
    render().clipboardCommand("Copy");render().clipboardCommand("Paste");
    assert.equal(h.messages.at(-1),"Could not paste the image: it has not loaded yet.");assert.equal(h.edits.length,0);
  }
});
test("X7-U19 hosted import stops before upload and before the edit, and maps the tab's 50 MiB check",async t=>{
  const h=await harness(t), {props,hosted}=h;
  const old=item("held");h.m.tabPictures.set(old.asset,{bytes:new ArrayBuffer(52428800)});
  props.model.current=props.board={...props.board,objects:[old]};let sent=0;hosted.pictures.upload=async()=>{sent++;return {ok:true};};
  await h.drop([file("another")]);assert.equal(sent,0);assert.equal(h.messages.at(-1),"Could not add another: this board already holds 50 MiB of pictures.");
  props.model.current=props.board={...props.board,objects:[]};
  // Capacity inspection happens after preparation and immediately before sending.
  const board=props.board;let reads=0;
  Object.defineProperty(board,"objects",{configurable:true,get(){if(++reads===2)hosted.history.locked=true;return [];}});
  const action=h.render();reads=0;await action.drop({clientX:0,clientY:0,preventDefault:noop,currentTarget:{getBoundingClientRect:()=>({left:0,top:0,width:1,height:1})},dataTransfer:{files:[file("a")]}});
  assert.equal(sent,0);assert.equal(h.messages.at(-1),"");assert.equal(h.edits.length,0);
  hosted.history.locked=false;Object.defineProperty(board,"objects",{value:[],configurable:true});
  const original=h.m.tabPictures.set.bind(h.m.tabPictures);
  h.m.tabPictures.set=(...args)=>{const r=original(...args);hosted.history.previewing=true;return r;};
  try{await h.drop([file("a")]);assert.equal(sent,1);assert.equal(h.edits.length,0);assert.equal(h.messages.at(-1),"");}finally{delete h.m.tabPictures.set;}
  props.readOnly=true;hosted.snapshot.role="viewer";assert.equal(h.render().picker.disabled,true);await h.drop([file("viewer")]);assert.equal(sent,1);
});
